// ---------------------------------------------------------------------------
// lib/review-engine/gbp-reply-pusher.ts — GBP Reply Publisher
//
// Sprint 107: Posts approved review responses to Google Business Profile
// via the My Business Reviews API. Only works for Google reviews.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { isTokenExpired, refreshGBPAccessToken } from '@/lib/services/gbp-token-refresh';
import { GBP_REVIEWS_API_BASE } from './fetchers/gbp-review-fetcher';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Posts an approved response to Google Business Profile via the GMB Reviews API.
 *
 * On success: updates review row to published status.
 * On failure: reverts to draft_ready and stores error.
 */
export async function pushGBPReply(
  supabase: SupabaseClient<Database>,
  reviewId: string,
  approvedText: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    // 1. Fetch the review record
    const { data: review } = await supabase
      .from('reviews')
      .select('id, platform_review_id, platform, location_id, org_id, response_status')
      .eq('id', reviewId)
      .maybeSingle();

    if (!review) {
      return { ok: false, error: 'Review not found' };
    }

    if (review.platform !== 'google') {
      return { ok: false, error: 'GBP reply only supported for Google reviews' };
    }

    if (review.response_status === 'published') {
      return { ok: false, error: 'Review already has a published response' };
    }

    // 2. Get OAuth token
    const { data: tokenRow } = await supabase
      .from('google_oauth_tokens')
      .select('access_token, refresh_token, expires_at, account_id')
      .eq('org_id', review.org_id)
      .maybeSingle();

    if (!tokenRow?.access_token || !tokenRow?.refresh_token) {
      return { ok: false, error: 'No GBP connection found' };
    }

    // 3. Ensure token is valid
    let accessToken = tokenRow.access_token;
    if (isTokenExpired(tokenRow.expires_at)) {
      const refreshResult = await refreshGBPAccessToken(review.org_id, tokenRow.refresh_token, supabase);
      if (!refreshResult.success || !refreshResult.newAccessToken) {
        return { ok: false, error: `Token refresh failed: ${refreshResult.error}` };
      }
      accessToken = refreshResult.newAccessToken;
    }

    // 4. Get GBP account ID and location ID
    const accountId = tokenRow.account_id;
    if (!accountId) {
      return { ok: false, error: 'GBP account ID not cached — run a review sync first' };
    }

    const { data: location } = await supabase
      .from('locations')
      .select('gbp_integration_id')
      .eq('id', review.location_id)
      .maybeSingle();

    const gbpLocationId = location?.gbp_integration_id;
    if (!gbpLocationId) {
      return { ok: false, error: 'GBP location ID not found' };
    }

    // 5. Post reply to GBP
    // The platform_review_id for GBP is the review name path
    const reviewName = `accounts/${accountId}/locations/${gbpLocationId}/reviews/${review.platform_review_id}`;
    const url = `${GBP_REVIEWS_API_BASE}/${reviewName}/reply`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ comment: approvedText }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown');

      // Revert to draft_ready so user can try again
      await supabase
        .from('reviews')
        .update({
          response_status: 'draft_ready',
          response_error: `GBP API error: ${response.status} — ${errorBody}`,
        })
        .eq('id', reviewId);

      return { ok: false, error: `GBP API error: ${response.status} — ${errorBody}` };
    }

    // 6. Update review as published
    await supabase
      .from('reviews')
      .update({
        response_status: 'published',
        response_published_at: new Date().toISOString(),
        response_published_text: approvedText,
        response_error: null,
      })
      .eq('id', reviewId);

    return { ok: true };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'gbp-reply-pusher', sprint: '107' },
    });

    // Try to revert status
    try {
      await supabase
        .from('reviews')
        .update({
          response_status: 'draft_ready',
          response_error: err instanceof Error ? err.message : String(err),
        })
        .eq('id', reviewId);
    } catch (revertErr) {
      Sentry.captureException(revertErr, { tags: { component: 'gbp-reply-pusher-revert', sprint: '107' } });
    }

    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Updates an existing GBP reply. Uses the same PUT endpoint.
 */
export async function updateGBPReply(
  supabase: SupabaseClient<Database>,
  reviewId: string,
  updatedText: string,
): Promise<{ ok: boolean; error?: string }> {
  // Same endpoint — GBP uses PUT for both create and update
  return pushGBPReply(supabase, reviewId, updatedText);
}
