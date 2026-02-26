// ---------------------------------------------------------------------------
// GET /api/auth/google/callback — Google OAuth 2.0 Callback (Sprint 57B)
//
// Handles the OAuth redirect from Google:
//   1. Verify CSRF state parameter against cookie
//   2. Exchange authorization code for access + refresh tokens
//   3. Fetch the user's GBP account name
//   4. Upsert tokens into google_oauth_tokens (service role — no RLS policies)
//   5. Redirect back to integrations page with success/error query param
//
// Security:
//   • State parameter MUST match the cookie set in /api/auth/google
//   • Tokens are NEVER exposed to the client
//   • Uses createServiceRoleClient() — google_oauth_tokens has service_role-only grants
//   • Cookies are cleared after use
//
// Required env vars:
//   GOOGLE_CLIENT_ID=...
//   GOOGLE_CLIENT_SECRET=...
//   NEXT_PUBLIC_APP_URL=https://app.localvector.ai
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GBP_ACCOUNTS_URL = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const integrations = `${appUrl}/dashboard/integrations`;

  // ── Read query params ─────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  // User denied access at Google consent screen
  if (errorParam) {
    return NextResponse.redirect(`${integrations}?gbp_error=access_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${integrations}?gbp_error=missing_params`);
  }

  // ── CSRF: Compare state with cookie ───────────────────────────────────
  const cookieStore = await cookies();
  const savedState = cookieStore.get('google_oauth_state')?.value;
  const orgId = cookieStore.get('google_oauth_org')?.value;

  // Clean up cookies regardless of outcome
  cookieStore.delete('google_oauth_state');
  cookieStore.delete('google_oauth_org');

  if (!savedState || state !== savedState) {
    return NextResponse.redirect(`${integrations}?gbp_error=csrf_mismatch`);
  }

  if (!orgId) {
    return NextResponse.redirect(`${integrations}?gbp_error=no_org`);
  }

  // ── Guard: env must be configured ─────────────────────────────────────
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${integrations}?gbp_error=not_configured`);
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
      return NextResponse.redirect(`${integrations}?gbp_error=token_exchange`);
    }

    tokenData = await tokenRes.json();
  } catch (err) {
    console.error('[google-oauth] Token exchange error:', err);
    return NextResponse.redirect(`${integrations}?gbp_error=token_exchange`);
  }

  if (!tokenData.access_token) {
    return NextResponse.redirect(`${integrations}?gbp_error=no_access_token`);
  }

  // ── Fetch GBP account name ────────────────────────────────────────────
  let gbpAccountName: string | null = null;
  let googleEmail: string | null = null;

  try {
    const accountsRes = await fetch(GBP_ACCOUNTS_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (accountsRes.ok) {
      const accountsData = await accountsRes.json();
      // Use the first account's name (format: "accounts/123456789")
      gbpAccountName = accountsData.accounts?.[0]?.name ?? null;
    }
  } catch {
    // Non-fatal — we can still store the token without the account name
    console.warn('[google-oauth] Could not fetch GBP accounts');
  }

  // Fetch email from userinfo
  try {
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (userInfoRes.ok) {
      const userInfo = await userInfoRes.json();
      googleEmail = userInfo.email ?? null;
    }
  } catch {
    // Non-fatal
  }

  // ── Upsert tokens into DB ────────────────────────────────────────────
  // google_oauth_tokens has UNIQUE(org_id), so upsert replaces any existing token.
  // Service role client — this table only grants to service_role.
  const supabase = createServiceRoleClient();

  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  const { error: dbError } = await supabase.from('google_oauth_tokens').upsert(
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
    { onConflict: 'org_id' }
  );

  if (dbError) {
    console.error('[google-oauth] DB upsert failed:', dbError.message);
    return NextResponse.redirect(`${integrations}?gbp_error=db_error`);
  }

  console.log(
    '[google-oauth] Tokens stored for org=%s email=%s account=%s',
    orgId,
    googleEmail,
    gbpAccountName
  );

  return NextResponse.redirect(`${integrations}?gbp_connected=true`);
}
