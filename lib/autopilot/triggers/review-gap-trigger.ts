// ---------------------------------------------------------------------------
// lib/autopilot/triggers/review-gap-trigger.ts
//
// Detects recurring negative review keyword patterns that suggest a content gap.
// Requires 3+ negative reviews sharing a common keyword within the last 90 days.
//
// Sprint 86 — Autopilot Engine
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { DraftTrigger, DraftContext } from '@/lib/types/autopilot';

/** Minimum negative reviews sharing a keyword to trigger a draft. */
const MIN_SHARED_KEYWORD_COUNT = 3;

/** How far back to look for negative reviews (days). */
const REVIEW_LOOKBACK_DAYS = 90;

/**
 * Detects review keyword patterns that suggest a content gap.
 *
 * Returns at most 1 DraftTrigger per location (highest-frequency keyword).
 */
export async function detectReviewGapTriggers(
  supabase: SupabaseClient<Database>,
  locationId: string,
  orgId: string,
): Promise<DraftTrigger[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - REVIEW_LOOKBACK_DAYS);

  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('id, keywords, text, rating')
    .eq('location_id', locationId)
    .eq('sentiment_label', 'negative')
    .gte('fetched_at', cutoff.toISOString())
    .limit(50);

  if (error || !reviews || reviews.length < MIN_SHARED_KEYWORD_COUNT) {
    return [];
  }

  // Count keyword frequency across all negative reviews
  const keywordCounts = new Map<string, number>();
  for (const review of reviews) {
    const keywords = review.keywords ?? [];
    // Deduplicate keywords within a single review
    const uniqueKeywords = new Set(keywords.map((k: string) => k.toLowerCase().trim()));
    for (const keyword of uniqueKeywords) {
      if (!keyword) continue;
      keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1);
    }
  }

  // Find keywords that appear in MIN_SHARED_KEYWORD_COUNT+ reviews
  const topKeywords = [...keywordCounts.entries()]
    .filter(([, count]) => count >= MIN_SHARED_KEYWORD_COUNT)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([keyword]) => keyword);

  if (topKeywords.length === 0) {
    return [];
  }

  // Count unanswered negative reviews
  const unansweredCount = reviews.filter(
    (r) => !r.rating || r.rating <= 2,
  ).length;

  const context: DraftContext = {
    topNegativeKeywords: topKeywords,
    negativeReviewCount: reviews.length,
    unansweredNegativeCount: unansweredCount,
    targetQuery: `${topKeywords[0]} review response`,
  };

  return [
    {
      triggerType: 'review_gap',
      triggerId: reviews[0].id, // Use first review as trigger reference
      orgId,
      locationId,
      context,
    },
  ];
}
