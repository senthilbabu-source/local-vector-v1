// ---------------------------------------------------------------------------
// GET /api/auth/google/callback — Google OAuth 2.0 Callback (Sprint 89)
//
// Handles the OAuth redirect from Google:
//   1. Verify CSRF state parameter against cookie
//   2. Exchange authorization code for access + refresh tokens
//   3. Fetch the user's GBP accounts + locations
//   4. Upsert tokens into google_oauth_tokens (service role — no RLS policies)
//   5. Auto-import single location OR write to pending_gbp_imports for picker
//   6. Redirect based on source (onboarding vs integrations)
//
// Security:
//   • State parameter MUST match the cookie set in /api/auth/google
//   • Tokens are NEVER exposed to the client
//   • Uses createServiceRoleClient() — google_oauth_tokens has service_role-only grants
//   • Cookies are cleaned up after use
//
// Spec: RFC_GBP_ONBOARDING_V2_REPLACEMENT.md §3.3
//
// Required env vars:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXT_PUBLIC_APP_URL
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { mapGBPLocationToRow } from '@/lib/services/gbp-mapper';
import type { GBPLocation } from '@/lib/types/gbp';
import type { Json } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GBP_ACCOUNTS_URL =
  'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
const GBP_LOCATIONS_READ_MASK =
  'name,title,storefrontAddress,regularHours,primaryPhone,websiteUri,metadata';

// ---------------------------------------------------------------------------
// Auto-import helper — imports a single GBP location (RFC §3.3)
// ---------------------------------------------------------------------------

async function importSingleLocation(orgId: string, gbpLocation: GBPLocation) {
  const supabase = createServiceRoleClient();

  // Check is_primary rule
  const { count } = await supabase
    .from('locations')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('is_primary', true);
  const isPrimary = (count ?? 0) === 0;

  const mapped = mapGBPLocationToRow(gbpLocation, isPrimary);

  const { data: location, error } = await supabase
    .from('locations')
    .insert({
      ...mapped,
      org_id: orgId,
      hours_data: mapped.hours_data as unknown as Json,
      amenities: mapped.amenities as unknown as Json,
    })
    .select('id')
    .single();

  if (error || !location) {
    throw new Error(`Location insert failed: ${error?.message}`);
  }

  // Create location_integrations row
  await supabase.from('location_integrations').upsert(
    {
      org_id: orgId,
      location_id: location.id,
      platform: 'google',
      status: 'connected',
      external_id: gbpLocation.name,
      last_sync_at: new Date().toISOString(),
    },
    { onConflict: 'location_id,platform' },
  );

  // Seed SOV queries for the new location
  const { seedSOVQueries } = await import('@/lib/services/sov-seed');
  await seedSOVQueries(
    {
      id: location.id,
      org_id: orgId,
      business_name: mapped.business_name,
      city: mapped.city,
      state: mapped.state,
      categories: null,
    },
    [],
    supabase,
  );
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const cookieStore = await cookies();

  // Determine redirect target based on source
  const source = cookieStore.get('gbp_oauth_source')?.value ?? 'integrations';
  const fallback = `${appUrl}/onboarding`;
  const integrations = `${appUrl}/dashboard/integrations`;

  function redirectOnError(code: string): NextResponse {
    if (source === 'onboarding') {
      return NextResponse.redirect(`${fallback}?source=${code}`);
    }
    return NextResponse.redirect(`${integrations}?gbp_error=${code}`);
  }

  function redirectOnSuccess(): NextResponse {
    if (source === 'onboarding') {
      return NextResponse.redirect(`${appUrl}/dashboard`);
    }
    return NextResponse.redirect(`${integrations}?gbp_connected=true`);
  }

  // ── Read query params ─────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  // User denied access at Google consent screen
  if (errorParam) {
    return redirectOnError('gbp_denied');
  }

  if (!code || !state) {
    return redirectOnError('gbp_failed');
  }

  // ── CSRF: Compare state with cookie ───────────────────────────────────
  const savedState = cookieStore.get('google_oauth_state')?.value;
  const orgId = cookieStore.get('google_oauth_org')?.value;

  // Clean up OAuth cookies regardless of outcome
  cookieStore.delete('google_oauth_state');
  cookieStore.delete('google_oauth_org');
  cookieStore.delete('gbp_oauth_source');

  if (!savedState || state !== savedState) {
    return redirectOnError('gbp_failed');
  }

  if (!orgId) {
    return redirectOnError('gbp_failed');
  }

  // ── Guard: env must be configured ─────────────────────────────────────
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return redirectOnError('gbp_failed');
  }

  // ── Exchange code for tokens ──────────────────────────────────────────
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  let tokenData: {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in: number;
    scope?: string;
  };

  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('[google-oauth] Token exchange failed:', err);
      return redirectOnError('gbp_failed');
    }

    tokenData = await tokenRes.json();
  } catch (err) {
    console.error('[google-oauth] Token exchange error:', err);
    return redirectOnError('gbp_failed');
  }

  if (!tokenData.access_token) {
    return redirectOnError('gbp_failed');
  }

  // ── Fetch GBP accounts ────────────────────────────────────────────────
  let gbpAccountName: string | null = null;
  let googleEmail: string | null = null;

  interface AccountsResponse {
    accounts?: Array<{ name: string; accountName?: string; type?: string }>;
  }
  let accountsData: AccountsResponse = {};

  try {
    const accountsRes = await fetch(GBP_ACCOUNTS_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (accountsRes.ok) {
      accountsData = await accountsRes.json();
      gbpAccountName = accountsData.accounts?.[0]?.name ?? null;
    }
  } catch {
    console.warn('[google-oauth] Could not fetch GBP accounts');
  }

  // Fetch email from userinfo
  try {
    const userInfoRes = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
    );
    if (userInfoRes.ok) {
      const userInfo = await userInfoRes.json();
      googleEmail = userInfo.email ?? null;
    }
  } catch {
    // Non-fatal
  }

  // ── Upsert tokens into DB ────────────────────────────────────────────
  const supabase = createServiceRoleClient();
  const expiresAt = new Date(
    Date.now() + tokenData.expires_in * 1000,
  ).toISOString();

  const { error: dbError } = await supabase
    .from('google_oauth_tokens')
    .upsert(
      {
        org_id: orgId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token ?? '',
        token_type: tokenData.token_type ?? 'Bearer',
        expires_at: expiresAt,
        gbp_account_name: gbpAccountName,
        google_email: googleEmail,
        scopes: tokenData.scope ?? '',
      },
      { onConflict: 'org_id' },
    );

  if (dbError) {
    console.error('[google-oauth] DB upsert failed:', dbError.message);
    return redirectOnError('gbp_failed');
  }

  // ── No GBP accounts → fallback ────────────────────────────────────────
  if (!accountsData.accounts || accountsData.accounts.length === 0) {
    console.warn('[google-oauth] No GBP accounts found for org=%s', orgId);
    return redirectOnError('gbp_no_accounts');
  }

  // ── Fetch GBP locations for the first account ─────────────────────────
  let locations: GBPLocation[] = [];
  let hasMore = false;

  try {
    const locationsUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/${gbpAccountName}/locations?readMask=${GBP_LOCATIONS_READ_MASK}`;
    const locationsRes = await fetch(locationsUrl, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (locationsRes.ok) {
      const locationsData = await locationsRes.json();
      locations = (locationsData.locations ?? []) as GBPLocation[];
      hasMore = !!locationsData.nextPageToken;
    } else {
      console.error(
        '[google-oauth] Locations fetch failed:',
        locationsRes.status,
        await locationsRes.text(),
      );
      return redirectOnError('gbp_failed');
    }
  } catch (err) {
    console.error('[google-oauth] Locations fetch error:', err);
    return redirectOnError('gbp_failed');
  }

  // ── No locations → fallback ───────────────────────────────────────────
  if (locations.length === 0) {
    console.warn('[google-oauth] No locations found for org=%s', orgId);
    return redirectOnError('gbp_no_locations');
  }

  // ── Single location → auto-import ────────────────────────────────────
  if (locations.length === 1 && !hasMore) {
    try {
      await importSingleLocation(orgId, locations[0]);
      console.log(
        '[google-oauth] Auto-imported single location for org=%s',
        orgId,
      );
      return redirectOnSuccess();
    } catch (err) {
      console.error('[google-oauth] Auto-import failed:', err);
      return redirectOnError('gbp_failed');
    }
  }

  // ── Multiple locations → pending_gbp_imports + picker redirect ───────
  try {
    const { data: pending, error: pendingError } = await supabase
      .from('pending_gbp_imports')
      .insert({
        org_id: orgId,
        locations_data: locations as unknown as Json,
        account_name: gbpAccountName,
        has_more: hasMore,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();

    if (pendingError || !pending) {
      console.error(
        '[google-oauth] pending_gbp_imports insert failed:',
        pendingError?.message,
      );
      return redirectOnError('gbp_failed');
    }

    // Store ONLY the UUID in the cookie (not raw JSON — RFC cookie-pointer pattern)
    cookieStore.set('gbp_import_id', pending.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });

    console.log(
      '[google-oauth] %d locations → picker for org=%s import=%s',
      locations.length,
      orgId,
      pending.id,
    );

    return NextResponse.redirect(
      `${appUrl}/onboarding/connect/select`,
    );
  } catch (err) {
    console.error('[google-oauth] Multi-location flow error:', err);
    return redirectOnError('gbp_failed');
  }
}
