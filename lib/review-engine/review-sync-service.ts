// ---------------------------------------------------------------------------
// lib/review-engine/review-sync-service.ts — Review Sync Orchestrator
//
// Sprint 107: Orchestrates the full review pipeline: fetch → analyze →
// upsert → generate response drafts. Runs in cron and on-demand contexts.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { Review, ReviewSyncResult } from './types';
import type { GroundTruth } from '@/lib/nap-sync/types';
import { fetchGBPReviews } from './fetchers/gbp-review-fetcher';
import { fetchYelpReviews } from './fetchers/yelp-review-fetcher';
import { analyzeSentiment } from './sentiment-analyzer';
import { deriveOrUpdateBrandVoice } from './brand-voice-profiler';
import { generateResponseDraft, RESPONSE_GENERATION_LIMITS } from './response-generator';
import { planSatisfies } from '@/lib/plan-enforcer';

/**
 * Fetches Ground Truth data for a location.
 */
async function fetchGroundTruth(
  supabase: SupabaseClient<Database>,
  locationId: string,
  orgId: string,
): Promise<GroundTruth | null> {
  const { data } = await supabase
    .from('locations')
    .select('id, org_id, business_name, address_line1, city, state, zip, phone, website_url')
    .eq('id', locationId)
    .maybeSingle();

  if (!data) return null;

  return {
    location_id: data.id,
    org_id: data.org_id,
    name: data.business_name ?? '',
    address: data.address_line1 ?? '',
    city: data.city ?? '',
    state: data.state ?? '',
    zip: data.zip ?? '',
    phone: data.phone ?? '',
    website: data.website_url ?? undefined,
  };
}

/**
 * Counts drafts generated this month for rate limiting.
 */
async function getDraftsGeneratedThisMonth(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('reviews')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .neq('response_status', 'pending_draft')
    .neq('response_status', 'skipped')
    .gte('fetched_at', startOfMonth.toISOString());

  return count ?? 0;
}

/**
 * Runs a full review sync for a single location.
 * Never throws — returns partial results with errors array.
 */
export async function runReviewSync(
  supabase: SupabaseClient<Database>,
  locationId: string,
  orgId: string,
): Promise<ReviewSyncResult> {
  const result: ReviewSyncResult = {
    location_id: locationId,
    org_id: orgId,
    new_reviews_fetched: 0,
    reviews_analyzed: 0,
    drafts_generated: 0,
    errors: [],
    run_at: new Date().toISOString(),
  };

  try {
    // 1. Fetch Ground Truth
    const groundTruth = await fetchGroundTruth(supabase, locationId, orgId);
    if (!groundTruth) {
      result.errors.push('Location not found');
      return result;
    }

    // 2. Fetch/refresh brand voice profile
    const brandVoice = await deriveOrUpdateBrandVoice(supabase, locationId, orgId);

    // 3. Fetch reviews from GBP + Yelp in parallel
    const [gbpReviews, yelpResult] = await Promise.all([
      fetchGBPReviews(supabase, locationId, orgId),
      fetchYelpReviews(supabase, locationId, orgId),
    ]);

    const allFetchedReviews: Review[] = [...gbpReviews, ...yelpResult.reviews];

    // 4. Process each review
    const newReviews: Array<{ review: Review; isNew: boolean }> = [];

    for (const review of allFetchedReviews) {
      // Check if review already exists
      const { data: existing } = await supabase
        .from('reviews')
        .select('id, response_status')
        .eq('platform_review_id', review.id)
        .eq('platform', review.platform)
        .eq('location_id', locationId)
        .maybeSingle();

      if (existing) {
        // Skip if already has a published or approved response
        if (['published', 'approved', 'skipped'].includes(existing.response_status)) {
          continue;
        }
        // Skip if draft already exists
        if (['draft_ready', 'pending_approval'].includes(existing.response_status)) {
          continue;
        }
        newReviews.push({ review, isNew: false });
      } else {
        newReviews.push({ review, isNew: true });
      }
    }

    // 5. Analyze and upsert new reviews
    for (const { review, isNew } of newReviews) {
      const sentiment = analyzeSentiment(review);
      result.reviews_analyzed++;

      if (isNew) {
        const { error } = await supabase.from('reviews').insert({
          platform_review_id: review.id,
          platform: review.platform,
          location_id: locationId,
          org_id: orgId,
          reviewer_name: review.reviewer_name,
          reviewer_photo_url: review.reviewer_photo_url ?? null,
          rating: review.rating,
          text: review.text,
          published_at: review.published_at,
          platform_url: review.platform_url ?? null,
          sentiment_label: sentiment.label,
          sentiment_score: sentiment.score,
          keywords: sentiment.keywords,
          topics: sentiment.topics as unknown as Database['public']['Tables']['reviews']['Insert']['topics'],
          response_status: 'pending_draft',
        });

        if (error) {
          result.errors.push(`Insert failed for ${review.platform}/${review.id}: ${error.message}`);
          continue;
        }
        result.new_reviews_fetched++;
      }
    }

    // 6. Generate response drafts for new reviews (respecting limits)
    const { data: org } = await supabase
      .from('organizations')
      .select('plan')
      .eq('id', orgId)
      .maybeSingle();

    const plan = org?.plan ?? 'trial';
    const limit = RESPONSE_GENERATION_LIMITS[plan] ?? 5;
    const generated = await getDraftsGeneratedThisMonth(supabase, orgId);
    let remaining = Math.max(0, limit - generated);

    // Get reviews that need drafts
    const { data: pendingReviews } = await supabase
      .from('reviews')
      .select('id, platform_review_id, platform, location_id, org_id, reviewer_name, rating, text, published_at')
      .eq('location_id', locationId)
      .eq('response_status', 'pending_draft')
      .order('rating', { ascending: true }) // Negative first (priority)
      .limit(20);

    if (pendingReviews && remaining > 0) {
      for (const row of pendingReviews) {
        if (remaining <= 0) break;

        const reviewForDraft: Review = {
          id: row.platform_review_id,
          platform: row.platform as 'google' | 'yelp',
          location_id: row.location_id,
          org_id: row.org_id,
          reviewer_name: row.reviewer_name,
          rating: row.rating,
          text: row.text,
          published_at: row.published_at,
        };

        const sentiment = analyzeSentiment(reviewForDraft);

        try {
          const draft = await generateResponseDraft(reviewForDraft, sentiment, brandVoice, groundTruth);
          const responseStatus = draft.requires_approval ? 'pending_approval' : 'draft_ready';

          await supabase
            .from('reviews')
            .update({
              response_draft: draft.draft_text,
              response_status: responseStatus,
            })
            .eq('id', row.id);

          result.drafts_generated++;
          remaining--;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Draft generation failed for review ${row.id}: ${msg}`);
        }
      }
    }

    // 7. Update location review stats
    const { count: totalCount } = await supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', locationId);

    const { data: ratingData } = await supabase
      .from('reviews')
      .select('rating')
      .eq('location_id', locationId);

    const avgRating = ratingData && ratingData.length > 0
      ? Math.round(ratingData.reduce((sum, r) => sum + r.rating, 0) / ratingData.length * 10) / 10
      : null;

    // Calculate review health score (0-100)
    const { count: answeredCount } = await supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .in('response_status', ['published', 'approved']);

    const responseRate = (totalCount ?? 0) > 0
      ? (answeredCount ?? 0) / (totalCount ?? 1) * 100
      : 0;

    // Health = weighted: response rate (40%) + avg rating normalized (40%) + recency (20%)
    const ratingScore = avgRating ? (avgRating / 5) * 100 : 50;
    const reviewHealthScore = Math.round(responseRate * 0.4 + ratingScore * 0.4 + 50 * 0.2);

    await supabase
      .from('locations')
      .update({
        review_health_score: Math.min(100, reviewHealthScore),
        reviews_last_synced_at: new Date().toISOString(),
        total_review_count: totalCount ?? 0,
        avg_rating: avgRating,
      })
      .eq('id', locationId);

  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'review-sync-service', sprint: '107' },
    });
    result.errors.push(err instanceof Error ? err.message : String(err));
  }

  return result;
}

/**
 * Runs review sync for ALL active Growth+ locations.
 * Processes sequentially to respect rate limits.
 */
export async function runReviewSyncForAllLocations(
  supabase: SupabaseClient<Database>,
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  try {
    // Get all Growth+ orgs
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, plan')
      .in('plan', ['growth', 'agency']);

    if (!orgs || orgs.length === 0) {
      return { processed: 0, errors: 0 };
    }

    for (const org of orgs) {
      if (!planSatisfies(org.plan, 'growth')) continue;

      // Get all locations for this org
      const { data: locations } = await supabase
        .from('locations')
        .select('id')
        .eq('org_id', org.id);

      if (!locations) continue;

      for (const location of locations) {
        const result = await runReviewSync(supabase, location.id, org.id);
        processed++;
        if (result.errors.length > 0) errors++;
      }
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'review-sync-service', sprint: '107', scope: 'all-locations' },
    });
    errors++;
  }

  return { processed, errors };
}
