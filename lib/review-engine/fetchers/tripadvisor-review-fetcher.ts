// ---------------------------------------------------------------------------
// lib/review-engine/fetchers/tripadvisor-review-fetcher.ts — TripAdvisor Content API v1
//
// Sprint 4: Fetches reviews from TripAdvisor. Limited to 5 reviews per request
// (hard API cap). API key passed as query param, not header.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { Review } from '../types';

const TA_API_BASE = 'https://api.content.tripadvisor.com/api/v1';

interface TAReviewResponse {
  data: Array<{
    id: number;
    url: string;
    text: string;
    rating: number;
    published_date: string;
    user: { username: string };
  }>;
}

/**
 * Fetches reviews from TripAdvisor Content API v1.
 *
 * IMPORTANT: TripAdvisor API returns up to 5 reviews per request (API limitation).
 * Returns: { reviews: Review[], total_count: number }
 * On error: returns { reviews: [], total_count: 0 }.
 */
export async function fetchTripAdvisorReviews(
  supabase: SupabaseClient<Database>,
  locationId: string,
  orgId: string,
): Promise<{ reviews: Review[]; total_count: number }> {
  const empty = { reviews: [], total_count: 0 };

  try {
    const apiKey = process.env.TRIPADVISOR_API_KEY;
    if (!apiKey) return empty;

    // Look up tripadvisor location ID from listing_platform_ids
    const { data: platformRow } = await supabase
      .from('listing_platform_ids')
      .select('platform_id')
      .eq('location_id', locationId)
      .eq('platform', 'tripadvisor')
      .maybeSingle();

    if (!platformRow?.platform_id) return empty;

    const taLocationId = platformRow.platform_id;
    const url = `${TA_API_BASE}/location/${encodeURIComponent(taLocationId)}/reviews?key=${apiKey}&language=en`;

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) return empty;
      const errorBody = await response.text().catch(() => 'unknown');
      Sentry.captureMessage(`TripAdvisor Reviews API error: ${response.status} — ${errorBody}`, {
        tags: { component: 'tripadvisor-review-fetcher', sprint: '4' },
      });
      return empty;
    }

    const data: TAReviewResponse = await response.json();

    const reviews: Review[] = (data.data ?? []).map((r) => ({
      id: String(r.id),
      platform: 'tripadvisor' as const,
      location_id: locationId,
      org_id: orgId,
      reviewer_name: r.user?.username ?? 'Anonymous',
      rating: r.rating,
      text: r.text ?? '',
      published_at: r.published_date ?? new Date().toISOString(),
      platform_url: r.url,
    }));

    return { reviews, total_count: reviews.length };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'tripadvisor-review-fetcher', sprint: '4' },
    });
    return empty;
  }
}
