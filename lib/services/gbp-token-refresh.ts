// ---------------------------------------------------------------------------
// lib/services/gbp-token-refresh.ts — GBP OAuth Token Refresh
//
// Shared service used by:
//   1. Proactive cron (/api/cron/refresh-gbp-tokens) — hourly bulk refresh
//   2. Reactive refresh in publish-gbp.ts — on-demand before GBP API call
//
// SECURITY: Uses createServiceRoleClient(). Never call from client code.
// Spec: RFC_GBP_ONBOARDING_V2_REPLACEMENT.md Phase 21d §2
// ---------------------------------------------------------------------------

import { createServiceRoleClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Returns true if the token expires within the next 5 minutes.
 * Used by the import route to decide whether to refresh before calling GBP API.
 */
export function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  const BUFFER_MS = 5 * 60 * 1000;
  return new Date(expiresAt).getTime() - BUFFER_MS < Date.now();
}

export interface TokenRefreshResult {
  orgId: string;
  success: boolean;
  error?: string;
  newExpiresAt?: string;
  newAccessToken?: string;
}

/**
 * Refreshes a single org's GBP access token using the stored refresh_token.
 *
 * Steps:
 *   1. POST to Google's token endpoint with grant_type=refresh_token
 *   2. Parse the new access_token + expires_in from response
 *   3. Update google_oauth_tokens row with new access_token + expires_at
 *
 * @param orgId - The org whose token to refresh
 * @param refreshToken - The stored refresh_token from google_oauth_tokens
 * @param supabase - Optional: pass a service-role client for testing
 * @returns TokenRefreshResult with success/failure + new expiry + new token
 */
export async function refreshGBPAccessToken(
  orgId: string,
  refreshToken: string,
  supabase?: SupabaseClient<Database>,
): Promise<TokenRefreshResult> {
  const db = supabase ?? createServiceRoleClient();

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown');
      return {
        orgId,
        success: false,
        error: `Google token refresh failed: ${response.status} — ${errorBody}`,
      };
    }

    const data = await response.json();
    const newAccessToken = data.access_token;
    const expiresIn = data.expires_in ?? 3600;
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Update the token row
    const { error: updateError } = await db
      .from('google_oauth_tokens')
      .update({
        access_token: newAccessToken,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', orgId);

    if (updateError) {
      return {
        orgId,
        success: false,
        error: `DB update failed: ${updateError.message}`,
      };
    }

    return { orgId, success: true, newExpiresAt, newAccessToken };
  } catch (err) {
    return {
      orgId,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Finds all GBP tokens expiring within the given window and refreshes them.
 * Used by the proactive cron job.
 *
 * @param withinMinutes - Refresh tokens expiring within this many minutes (default: 60)
 * @param supabase - Optional: pass a service-role client for testing
 * @returns Summary of refresh results
 */
export async function refreshExpiringTokens(
  withinMinutes: number = 60,
  supabase?: SupabaseClient<Database>,
): Promise<{ total: number; refreshed: number; failed: number; errors: string[] }> {
  const db = supabase ?? createServiceRoleClient();

  const expiryThreshold = new Date(Date.now() + withinMinutes * 60 * 1000).toISOString();

  // Find tokens expiring within the window that still have a refresh_token
  const { data: expiringTokens, error: queryError } = await db
    .from('google_oauth_tokens')
    .select('org_id, refresh_token, expires_at')
    .lt('expires_at', expiryThreshold)
    .not('refresh_token', 'is', null);

  if (queryError) {
    return { total: 0, refreshed: 0, failed: 0, errors: [`Query failed: ${queryError.message}`] };
  }

  if (!expiringTokens?.length) {
    return { total: 0, refreshed: 0, failed: 0, errors: [] };
  }

  const errors: string[] = [];
  let refreshed = 0;
  let failed = 0;

  for (const token of expiringTokens) {
    const result = await refreshGBPAccessToken(token.org_id, token.refresh_token, db);
    if (result.success) {
      refreshed++;
    } else {
      failed++;
      errors.push(`org=${token.org_id}: ${result.error}`);
    }
  }

  return { total: expiringTokens.length, refreshed, failed, errors };
}
