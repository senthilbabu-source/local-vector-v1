// ---------------------------------------------------------------------------
// POST /api/gbp/import — GBP Data Re-sync Endpoint (Sprint 89)
//
// Fetches the authenticated user's GBP location data via stored tokens,
// maps it through the enhanced gbp-data-mapper, and updates the existing
// locations row with enriched data (hours, amenities, operational status).
//
// This differs from the OAuth callback auto-import (Sprint 57B) which does
// an INSERT of a new location. This endpoint UPDATEs the existing location
// with fresh data from the GBP API.
//
// Security: Uses createClient() for auth + createServiceRoleClient() for
// token access and the location update (bypasses RLS).
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { mapGBPToLocation } from '@/lib/gbp/gbp-data-mapper';
import {
  isTokenExpired,
  refreshGBPAccessToken,
} from '@/lib/services/gbp-token-refresh';
import type { GBPLocation } from '@/lib/types/gbp';
import type { Json } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';

const GBP_READ_MASK = [
  'name',
  'title',
  'storefrontAddress',
  'regularHours',
  'primaryPhone',
  'websiteUri',
  'metadata',
  'openInfo',
  'attributes',
  'categories',
].join(',');

export async function POST() {
  // 1. Verify user session
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = ctx.orgId;
  const supabase = createServiceRoleClient();

  // 2. Fetch google_oauth_tokens row for org
  const { data: tokenRow, error: tokenError } = await supabase
    .from('google_oauth_tokens')
    .select('access_token, refresh_token, expires_at, gbp_account_name')
    .eq('org_id', orgId)
    .single();

  if (tokenError || !tokenRow) {
    return NextResponse.json(
      { error: 'not_connected', message: 'No GBP connection found for this organization.' },
      { status: 404 },
    );
  }

  // 3. Check token expiry — refresh if needed
  let accessToken = tokenRow.access_token;

  if (isTokenExpired(tokenRow.expires_at)) {
    const refreshResult = await refreshGBPAccessToken(
      orgId,
      tokenRow.refresh_token,
      supabase,
    );
    if (!refreshResult.success || !refreshResult.newAccessToken) {
      return NextResponse.json(
        { error: 'token_expired', message: 'GBP access token expired. Please reconnect.' },
        { status: 401 },
      );
    }
    accessToken = refreshResult.newAccessToken;
  }

  // 4. Get existing location for org (primary, first created)
  const { data: location } = await supabase
    .from('locations')
    .select('id, google_location_name')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (!location) {
    return NextResponse.json(
      { error: 'no_location', message: 'No location found for this organization.' },
      { status: 404 },
    );
  }

  // 5. Determine the GBP location resource name
  // Prefer stored google_location_name; fall back to fetching locations list
  let gbpLocationName = location.google_location_name;

  if (!gbpLocationName && tokenRow.gbp_account_name) {
    // Fetch locations list from GBP API to discover the location name
    try {
      const listUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/${tokenRow.gbp_account_name}/locations?readMask=name`;
      const listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (listRes.ok) {
        const listData = await listRes.json();
        const firstLoc = (listData.locations ?? [])[0];
        if (firstLoc?.name) {
          gbpLocationName = firstLoc.name;
        }
      }
    } catch {
      // Fall through — will error below
    }
  }

  if (!gbpLocationName) {
    return NextResponse.json(
      { error: 'no_location', message: 'No GBP location resource name found.' },
      { status: 404 },
    );
  }

  // 6. Call GBP API to fetch fresh location data
  const gbpUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/${gbpLocationName}?readMask=${GBP_READ_MASK}`;
  let gbpResponse: Response;

  try {
    gbpResponse = await fetch(gbpUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'gbp_api_error', message: `GBP API request failed: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 502 },
    );
  }

  if (!gbpResponse.ok) {
    const errBody = await gbpResponse.text().catch(() => 'unknown');
    return NextResponse.json(
      { error: 'gbp_api_error', message: `GBP API returned ${gbpResponse.status}: ${errBody}` },
      { status: 502 },
    );
  }

  const gbpData = (await gbpResponse.json()) as GBPLocation;

  // 7. Map response via enhanced mapper
  const mapped = mapGBPToLocation(gbpData);

  // 8. Build update payload — only include non-undefined fields
  const updatePayload: Record<string, unknown> = {
    gbp_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (mapped.business_name !== undefined) updatePayload.business_name = mapped.business_name;
  if (mapped.phone !== undefined) updatePayload.phone = mapped.phone;
  if (mapped.website_url !== undefined) updatePayload.website_url = mapped.website_url;
  if (mapped.address_line1 !== undefined) updatePayload.address_line1 = mapped.address_line1;
  if (mapped.city !== undefined) updatePayload.city = mapped.city;
  if (mapped.state !== undefined) updatePayload.state = mapped.state;
  if (mapped.zip !== undefined) updatePayload.zip = mapped.zip;
  if (mapped.hours_data !== undefined) updatePayload.hours_data = mapped.hours_data as unknown as Json;
  if (mapped.operational_status !== undefined) updatePayload.operational_status = mapped.operational_status;
  if (mapped.amenities !== undefined) updatePayload.amenities = mapped.amenities as unknown as Json;

  // 9. Upsert (update) existing location
  const { error: updateError } = await supabase
    .from('locations')
    .update(updatePayload)
    .eq('id', location.id);

  if (updateError) {
    return NextResponse.json(
      { error: 'upsert_failed', message: `Location update failed: ${updateError.message}` },
      { status: 500 },
    );
  }

  // 10. Update location_integrations sync timestamp
  await supabase
    .from('location_integrations')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('location_id', location.id)
    .eq('platform', 'google');

  return NextResponse.json({
    ok: true,
    location_id: location.id,
    mapped,
  });
}
