// ---------------------------------------------------------------------------
// lib/gbp/gbp-menu-client.ts — Sprint 2: GBP Food Menus Push
//
// API client: pushMenuToGBP(orgId, locationGBPId, menu).
// Reuses refreshGBPAccessToken() from gbp-token-refresh.ts.
// Calls PATCH accounts/{a}/locations/{l}/foodMenus.
// Fire-and-forget — never blocks publish. Errors → Sentry.
//
// SECURITY: Uses service-role client. Never call from client code.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  isTokenExpired,
  refreshGBPAccessToken,
} from '@/lib/services/gbp-token-refresh';
import type { GBPFoodMenu } from './gbp-menu-types';

const GBP_API_BASE = 'https://mybusiness.googleapis.com/v4';

export interface PushMenuResult {
  success: boolean;
  error?: string;
}

/**
 * Push a GBPFoodMenu payload to the GBP Food Menus API.
 *
 * Steps:
 *   1. Fetch org's OAuth token (service-role, bypasses RLS)
 *   2. Refresh if expired (5-min buffer)
 *   3. PATCH foodMenus endpoint
 *   4. On 401: refresh token and retry once
 *
 * Never throws. Returns PushMenuResult with success/error.
 */
export async function pushMenuToGBP(
  orgId: string,
  locationGBPId: string,
  menu: GBPFoodMenu,
): Promise<PushMenuResult> {
  try {
    const supabase = createServiceRoleClient();

    // Step 1: Fetch token
    const { data: tokenRow, error: tokenError } = await supabase
      .from('google_oauth_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('org_id', orgId)
      .single();

    if (tokenError || !tokenRow) {
      return { success: false, error: 'GBP not connected for this org' };
    }

    // Step 2: Refresh if expired
    let accessToken = tokenRow.access_token;
    if (isTokenExpired(tokenRow.expires_at)) {
      const refreshResult = await refreshGBPAccessToken(
        orgId,
        tokenRow.refresh_token,
        supabase,
      );
      if (!refreshResult.success) {
        return { success: false, error: refreshResult.error ?? 'Token refresh failed' };
      }
      accessToken = refreshResult.newAccessToken!;
    }

    // Step 3: PATCH foodMenus
    const url = `${GBP_API_BASE}/${locationGBPId}/foodMenus`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(menu),
    });

    // Step 4: Handle 401 with one retry
    if (response.status === 401) {
      const retryRefresh = await refreshGBPAccessToken(
        orgId,
        tokenRow.refresh_token,
        supabase,
      );
      if (!retryRefresh.success) {
        return { success: false, error: retryRefresh.error ?? 'Token refresh on 401 failed' };
      }

      const retryResponse = await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${retryRefresh.newAccessToken!}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(menu),
      });

      if (!retryResponse.ok) {
        const body = await retryResponse.text().catch(() => 'unknown');
        return {
          success: false,
          error: `GBP foodMenus PATCH failed after token refresh: ${retryResponse.status} — ${body}`,
        };
      }

      return { success: true };
    }

    if (!response.ok) {
      const body = await response.text().catch(() => 'unknown');
      return {
        success: false,
        error: `GBP foodMenus PATCH failed: ${response.status} — ${body}`,
      };
    }

    return { success: true };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { sprint: 'distribution-2', component: 'gbp-menu-client' },
      extra: { orgId, locationGBPId },
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
