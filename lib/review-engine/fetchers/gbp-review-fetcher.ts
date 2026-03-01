// ---------------------------------------------------------------------------
// lib/review-engine/fetchers/gbp-review-fetcher.ts — GBP Reviews API
//
// Sprint 107: Fetches reviews from Google Business Profile using the
// My Business Reviews API v4. Reuses token refresh from Sprint 89.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { isTokenExpired, refreshGBPAccessToken } from '@/lib/services/gbp-token-refresh';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { Review } from '../types';

export const GBP_REVIEWS_API_BASE = 'https://mybusiness.googleapis.com/v4';
export const GBP_ACCOUNTS_API_BASE = 'https://mybusinessaccountmanagement.googleapis.com/v1';
export const MAX_REVIEWS_PER_FETCH = 200;

const STAR_RATING_MAP: Record<string, number> = {
  FIVE: 5,
  FOUR: 4,
  THREE: 3,
  TWO: 2,
  ONE: 1,
};

/**
 * Maps GBP starRating string enum to integer.
 */
export function mapGBPStarRating(starRating: string): number {
  return STAR_RATING_MAP[starRating] ?? 3;
}

/**
 * Looks up or fetches the GBP account ID. Caches in google_oauth_tokens.account_id.
 */
async function getGBPAccountId(
  supabase: SupabaseClient<Database>,
  orgId: string,
  accessToken: string,
): Promise<string | null> {
  // Check cached account_id first
  const { data: tokenRow } = await supabase
    .from('google_oauth_tokens')
    .select('account_id')
    .eq('org_id', orgId)
    .maybeSingle();

  if (tokenRow?.account_id) {
    return tokenRow.account_id;
  }

  // Fetch from GBP Accounts API
  try {
    const response = await fetch(`${GBP_ACCOUNTS_API_BASE}/accounts`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      Sentry.captureMessage(`GBP Accounts API error: ${response.status}`, {
        tags: { component: 'gbp-review-fetcher', sprint: '107' },
      });
      return null;
    }

    const data = await response.json();
    const accounts = data.accounts;
    if (!accounts || accounts.length === 0) return null;

    // Use the first account — most businesses have one
    const accountName: string = accounts[0].name; // "accounts/123456"
    const accountId = accountName.replace('accounts/', '');

    // Cache for future use
    await supabase
      .from('google_oauth_tokens')
      .update({ account_id: accountId })
      .eq('org_id', orgId);

    return accountId;
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'gbp-review-fetcher', sprint: '107' },
    });
    return null;
  }
}

/**
 * Ensures the GBP access token is valid, refreshing if needed.
 * Returns the valid access token or null on failure.
 */
async function ensureValidToken(
  supabase: SupabaseClient<Database>,
  orgId: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: string | null,
): Promise<string | null> {
  if (!isTokenExpired(expiresAt)) return accessToken;

  const result = await refreshGBPAccessToken(orgId, refreshToken, supabase);
  if (result.success && result.newAccessToken) {
    return result.newAccessToken;
  }
  return null;
}

interface GBPReviewResponse {
  reviews?: Array<{
    name: string;
    reviewId: string;
    reviewer: { profilePhotoUrl?: string; displayName?: string };
    starRating: string;
    comment?: string;
    createTime: string;
    updateTime: string;
    reviewReply?: { comment: string; updateTime: string } | null;
  }>;
  nextPageToken?: string;
  totalReviewCount?: number;
}

/**
 * Fetches reviews from Google Business Profile using the My Business Reviews API.
 * Returns Review[] with platform = 'google'. On error: returns [].
 */
export async function fetchGBPReviews(
  supabase: SupabaseClient<Database>,
  locationId: string,
  orgId: string,
): Promise<Review[]> {
  try {
    // 1. Get OAuth token
    const { data: tokenRow } = await supabase
      .from('google_oauth_tokens')
      .select('access_token, refresh_token, expires_at, gbp_account_name')
      .eq('org_id', orgId)
      .maybeSingle();

    if (!tokenRow?.access_token || !tokenRow?.refresh_token) return [];

    // 2. Ensure token is valid
    const validToken = await ensureValidToken(
      supabase, orgId, tokenRow.access_token,
      tokenRow.refresh_token, tokenRow.expires_at,
    );
    if (!validToken) return [];

    // 3. Get GBP account ID
    const accountId = await getGBPAccountId(supabase, orgId, validToken);
    if (!accountId) return [];

    // 4. Get GBP location ID from locations table
    const { data: location } = await supabase
      .from('locations')
      .select('gbp_integration_id')
      .eq('id', locationId)
      .maybeSingle();

    const gbpLocationId = location?.gbp_integration_id;
    if (!gbpLocationId) return [];

    // 5. Fetch reviews with pagination
    const reviews: Review[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        pageSize: '50',
        orderBy: 'updateTime desc',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const parent = `accounts/${accountId}/locations/${gbpLocationId}`;
      const url = `${GBP_REVIEWS_API_BASE}/${parent}/reviews?${params}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${validToken}` },
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'unknown');
        Sentry.captureMessage(`GBP Reviews API error: ${response.status} — ${errorBody}`, {
          tags: { component: 'gbp-review-fetcher', sprint: '107' },
        });
        break;
      }

      const data: GBPReviewResponse = await response.json();

      if (data.reviews) {
        for (const gbpReview of data.reviews) {
          const review: Review = {
            id: gbpReview.reviewId ?? gbpReview.name,
            platform: 'google',
            location_id: locationId,
            org_id: orgId,
            reviewer_name: gbpReview.reviewer?.displayName ?? 'Anonymous',
            reviewer_photo_url: gbpReview.reviewer?.profilePhotoUrl,
            rating: mapGBPStarRating(gbpReview.starRating),
            text: gbpReview.comment ?? '',
            published_at: gbpReview.createTime,
            platform_url: undefined,
          };
          reviews.push(review);
        }
      }

      pageToken = data.nextPageToken;
    } while (pageToken && reviews.length < MAX_REVIEWS_PER_FETCH);

    return reviews;
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'gbp-review-fetcher', sprint: '107' },
    });
    return [];
  }
}
