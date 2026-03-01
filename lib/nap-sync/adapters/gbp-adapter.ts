// ---------------------------------------------------------------------------
// lib/nap-sync/adapters/gbp-adapter.ts — Google Business Profile NAP adapter
//
// Sprint 105: Reads live NAP data from GBP.
// Reuses Sprint 89 token refresh + field mapping.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NAPAdapter } from './base-adapter';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { isTokenExpired, refreshGBPAccessToken } from '@/lib/services/gbp-token-refresh';
import { mapGBPToLocation } from '@/lib/gbp/gbp-data-mapper';
import type { PlatformId, AdapterResult, PlatformContext, NAPData } from '../types';

const NAP_READ_MASK = [
  'name',
  'title',
  'phoneNumbers',
  'storefrontAddress',
  'websiteUri',
  'regularHours',
  'openInfo',
].join(',');

export class GBPNAPAdapter extends NAPAdapter {
  readonly platformId: PlatformId = 'google';

  async fetchNAP(
    locationId: string,
    orgId: string,
    context: PlatformContext,
  ): Promise<AdapterResult> {
    try {
      if (!context.gbp_location_id) {
        return { status: 'unconfigured', platform: 'google', reason: 'no_gbp_location_id' };
      }

      const supabase = createServiceRoleClient();

      // Look up GBP connection
      const { data: tokenRow, error: tokenError } = await supabase
        .from('google_oauth_tokens')
        .select('access_token, refresh_token, expires_at')
        .eq('org_id', orgId)
        .maybeSingle();

      if (tokenError || !tokenRow) {
        return { status: 'unconfigured', platform: 'google', reason: 'not_connected' };
      }

      // Refresh token if expired
      let accessToken = tokenRow.access_token;
      if (isTokenExpired(tokenRow.expires_at)) {
        const refreshResult = await refreshGBPAccessToken(orgId, tokenRow.refresh_token, supabase);
        if (!refreshResult.success || !refreshResult.newAccessToken) {
          return {
            status: 'api_error',
            platform: 'google',
            message: `Token refresh failed: ${refreshResult.error ?? 'unknown'}`,
          };
        }
        accessToken = refreshResult.newAccessToken;
      }

      // Fetch location data from GBP API
      const gbpName = context.gbp_location_id;
      const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${gbpName}?readMask=${NAP_READ_MASK}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'unknown');
        return {
          status: 'api_error',
          platform: 'google',
          message: `GBP API error: ${response.status} — ${errorBody}`,
          http_status: response.status,
        };
      }

      const gbpLocation = await response.json();
      const mapped = mapGBPToLocation(gbpLocation);

      // Map MappedLocationData → NAPData
      const napData: NAPData = {};
      if (mapped.business_name) napData.name = mapped.business_name;
      if (mapped.address_line1) napData.address = mapped.address_line1;
      if (mapped.city) napData.city = mapped.city;
      if (mapped.state) napData.state = mapped.state;
      if (mapped.zip) napData.zip = mapped.zip;
      if (mapped.phone) napData.phone = mapped.phone;
      if (mapped.website_url) napData.website = mapped.website_url;
      if (mapped.operational_status) {
        napData.operational_status = mapped.operational_status as NAPData['operational_status'];
      }
      if (mapped.hours_data) {
        const hours: Record<string, { open: string; close: string; closed: boolean }> = {};
        for (const [day, val] of Object.entries(mapped.hours_data)) {
          if (val === 'closed') {
            hours[day] = { open: '', close: '', closed: true };
          } else if (val && typeof val === 'object') {
            hours[day] = { open: val.open, close: val.close, closed: false };
          }
        }
        napData.hours = hours;
      }

      return {
        status: 'ok',
        platform: 'google',
        data: napData,
        fetched_at: new Date().toISOString(),
      };
    } catch (err) {
      Sentry.captureException(err, { tags: { adapter: 'gbp', sprint: '105' } });
      return {
        status: 'api_error',
        platform: 'google',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
