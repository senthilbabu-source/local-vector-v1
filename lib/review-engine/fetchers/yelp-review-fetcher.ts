// ---------------------------------------------------------------------------
// lib/review-engine/fetchers/yelp-review-fetcher.ts — Yelp Fusion Reviews API
//
// Sprint 107: Fetches reviews from Yelp. Limited to 3 reviews per request
// (hard Yelp API constraint). Reuses YELP_FUSION_API_KEY from Sprint 105.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { Review } from '../types';

const YELP_API_BASE = 'https://api.yelp.com/v3';

interface YelpReviewResponse {
  reviews: Array<{
    id: string;
    url: string;
    text: string;
    rating: number;
    time_created: string;
    user: { id: string; profile_url?: string; image_url?: string; name: string };
  }>;
  total: number;
}

/**
 * Fetches reviews from Yelp Fusion API.
 *
 * IMPORTANT: Yelp Fusion API only returns 3 reviews per request (API limitation).
 * Returns: { reviews: Review[], total_count: number }
 * On error: returns { reviews: [], total_count: 0 }.
 */
export async function fetchYelpReviews(
  supabase: SupabaseClient<Database>,
  locationId: string,
  orgId: string,
): Promise<{ reviews: Review[]; total_count: number }> {
  const empty = { reviews: [], total_count: 0 };

  try {
    const apiKey = process.env.YELP_FUSION_API_KEY;
    if (!apiKey) return empty;

    // Look up yelp_business_id from listing_platform_ids
    const { data: platformRow } = await supabase
      .from('listing_platform_ids')
      .select('platform_id')
      .eq('location_id', locationId)
      .eq('platform', 'yelp')
      .maybeSingle();

    if (!platformRow?.platform_id) return empty;

    const yelpBusinessId = platformRow.platform_id;
    const url = `${YELP_API_BASE}/businesses/${encodeURIComponent(yelpBusinessId)}/reviews?limit=50&sort_by=yelp_sort&locale=en_US`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      if (response.status === 404) return empty;
      const errorBody = await response.text().catch(() => 'unknown');
      Sentry.captureMessage(`Yelp Reviews API error: ${response.status} — ${errorBody}`, {
        tags: { component: 'yelp-review-fetcher', sprint: '107' },
      });
      return empty;
    }

    const data: YelpReviewResponse = await response.json();

    const reviews: Review[] = (data.reviews ?? []).map((yr) => ({
      id: yr.id,
      platform: 'yelp' as const,
      location_id: locationId,
      org_id: orgId,
      reviewer_name: yr.user?.name ?? 'Anonymous',
      reviewer_photo_url: yr.user?.image_url,
      rating: yr.rating,
      text: yr.text ?? '',
      published_at: yr.time_created ? new Date(yr.time_created).toISOString() : new Date().toISOString(),
      platform_url: yr.url,
    }));

    return { reviews, total_count: data.total ?? reviews.length };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'yelp-review-fetcher', sprint: '107' },
    });
    return empty;
  }
}
