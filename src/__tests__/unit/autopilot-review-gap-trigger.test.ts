/**
 * Autopilot Review Gap Trigger — unit tests.
 * Target: lib/autopilot/triggers/review-gap-trigger.ts
 *
 * detectReviewGapTriggers scans the last 90 days of negative reviews for a
 * location, counts keyword frequency, and emits a single DraftTrigger when
 * 3+ reviews share a common keyword.
 */

import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { detectReviewGapTriggers } from '@/lib/autopilot/triggers/review-gap-trigger';

// ── Helpers ──────────────────────────────────────────────────────────────────

const ORG_ID = 'org-uuid-001';
const LOCATION_ID = 'loc-uuid-001';

interface MockReview {
  id: string;
  keywords: string[] | null;
  text: string;
  rating: number | null;
}

function makeReview(overrides: Partial<MockReview> & { id: string }): MockReview {
  return {
    keywords: ['slow service'],
    text: 'Not great',
    rating: 1,
    ...overrides,
  };
}

function makeMockSupabase(opts: { data?: unknown[] | null; error?: unknown } = {}) {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({
      data: opts.data ?? null,
      error: opts.error ?? null,
    }),
  };
  return {
    from: vi.fn(() => mockChain),
  } as unknown as SupabaseClient<Database>;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('detectReviewGapTriggers', () => {
  // 1. Returns empty when no reviews found
  it('returns empty array when no reviews are found', async () => {
    const supabase = makeMockSupabase({ data: [] });
    const result = await detectReviewGapTriggers(supabase, LOCATION_ID, ORG_ID);
    expect(result).toEqual([]);
  });

  // 2. Returns empty on DB error
  it('returns empty array on database error', async () => {
    const supabase = makeMockSupabase({
      data: null,
      error: { message: 'connection refused', code: 'PGRST000' },
    });
    const result = await detectReviewGapTriggers(supabase, LOCATION_ID, ORG_ID);
    expect(result).toEqual([]);
  });

  // 3. Returns empty when fewer than 3 reviews
  it('returns empty array when fewer than MIN_SHARED_KEYWORD_COUNT reviews exist', async () => {
    const reviews = [
      makeReview({ id: 'r-1', keywords: ['slow service'] }),
      makeReview({ id: 'r-2', keywords: ['slow service'] }),
    ];
    const supabase = makeMockSupabase({ data: reviews });
    const result = await detectReviewGapTriggers(supabase, LOCATION_ID, ORG_ID);
    expect(result).toEqual([]);
  });

  // 4. Returns empty when no keyword appears in 3+ reviews
  it('returns empty array when no keyword reaches the minimum frequency threshold', async () => {
    const reviews = [
      makeReview({ id: 'r-1', keywords: ['cold food'] }),
      makeReview({ id: 'r-2', keywords: ['rude staff'] }),
      makeReview({ id: 'r-3', keywords: ['slow service'] }),
      makeReview({ id: 'r-4', keywords: ['noisy'] }),
    ];
    const supabase = makeMockSupabase({ data: reviews });
    const result = await detectReviewGapTriggers(supabase, LOCATION_ID, ORG_ID);
    expect(result).toEqual([]);
  });

  // 5. Returns trigger when a keyword appears in 3+ reviews
  it('returns a trigger when a keyword appears in 3 or more reviews', async () => {
    const reviews = [
      makeReview({ id: 'r-1', keywords: ['slow service'] }),
      makeReview({ id: 'r-2', keywords: ['slow service'] }),
      makeReview({ id: 'r-3', keywords: ['slow service'] }),
    ];
    const supabase = makeMockSupabase({ data: reviews });
    const result = await detectReviewGapTriggers(supabase, LOCATION_ID, ORG_ID);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      triggerType: 'review_gap',
      orgId: ORG_ID,
      locationId: LOCATION_ID,
    });
    expect(result[0].context.topNegativeKeywords).toContain('slow service');
  });

  // 6. Deduplicates keywords within a single review (case-insensitive)
  it('deduplicates keywords within a single review and normalizes case', async () => {
    // Each review has "Slow Service" repeated in different cases — should count
    // as 1 occurrence per review, not 3.
    const reviews = [
      makeReview({ id: 'r-1', keywords: ['Slow Service', 'SLOW SERVICE', 'slow service'] }),
      makeReview({ id: 'r-2', keywords: ['Slow Service', 'slow service'] }),
      makeReview({ id: 'r-3', keywords: ['SLOW SERVICE'] }),
    ];
    const supabase = makeMockSupabase({ data: reviews });
    const result = await detectReviewGapTriggers(supabase, LOCATION_ID, ORG_ID);

    expect(result).toHaveLength(1);
    // Keyword appears in exactly 3 reviews (not 7 raw occurrences)
    expect(result[0].context.topNegativeKeywords).toEqual(['slow service']);
  });

  // 7. Returns at most 1 trigger per location
  it('returns at most one trigger regardless of how many keywords qualify', async () => {
    const reviews = [
      makeReview({ id: 'r-1', keywords: ['slow service', 'cold food', 'rude staff'] }),
      makeReview({ id: 'r-2', keywords: ['slow service', 'cold food', 'rude staff'] }),
      makeReview({ id: 'r-3', keywords: ['slow service', 'cold food', 'rude staff'] }),
      makeReview({ id: 'r-4', keywords: ['slow service', 'cold food', 'rude staff'] }),
    ];
    const supabase = makeMockSupabase({ data: reviews });
    const result = await detectReviewGapTriggers(supabase, LOCATION_ID, ORG_ID);

    // All 3 keywords qualify, but only 1 trigger is returned
    expect(result).toHaveLength(1);
    expect(result[0].triggerType).toBe('review_gap');
  });

  // 8. Sorts top keywords by frequency (highest first)
  it('sorts top keywords by descending frequency', async () => {
    const reviews = [
      makeReview({ id: 'r-1', keywords: ['slow service', 'cold food', 'rude staff'] }),
      makeReview({ id: 'r-2', keywords: ['slow service', 'cold food', 'rude staff'] }),
      makeReview({ id: 'r-3', keywords: ['slow service', 'cold food', 'rude staff'] }),
      makeReview({ id: 'r-4', keywords: ['slow service', 'cold food'] }),
      makeReview({ id: 'r-5', keywords: ['slow service'] }),
    ];
    // slow service: 5, cold food: 4, rude staff: 3
    const supabase = makeMockSupabase({ data: reviews });
    const result = await detectReviewGapTriggers(supabase, LOCATION_ID, ORG_ID);

    expect(result[0].context.topNegativeKeywords).toEqual([
      'slow service',
      'cold food',
      'rude staff',
    ]);
  });

  // 9. Limits to 3 top keywords
  it('caps topNegativeKeywords at 3 even when more qualify', async () => {
    const reviews = [
      makeReview({ id: 'r-1', keywords: ['slow', 'cold', 'rude', 'noisy'] }),
      makeReview({ id: 'r-2', keywords: ['slow', 'cold', 'rude', 'noisy'] }),
      makeReview({ id: 'r-3', keywords: ['slow', 'cold', 'rude', 'noisy'] }),
    ];
    const supabase = makeMockSupabase({ data: reviews });
    const result = await detectReviewGapTriggers(supabase, LOCATION_ID, ORG_ID);

    // All 4 keywords appear in 3 reviews but only top 3 should be kept
    expect(result[0].context.topNegativeKeywords).toHaveLength(3);
  });

  // 10. Sets targetQuery from first top keyword
  it('builds targetQuery from the highest-frequency keyword', async () => {
    const reviews = [
      makeReview({ id: 'r-1', keywords: ['slow service', 'cold food'] }),
      makeReview({ id: 'r-2', keywords: ['slow service', 'cold food'] }),
      makeReview({ id: 'r-3', keywords: ['slow service', 'cold food'] }),
      makeReview({ id: 'r-4', keywords: ['slow service'] }),
    ];
    const supabase = makeMockSupabase({ data: reviews });
    const result = await detectReviewGapTriggers(supabase, LOCATION_ID, ORG_ID);

    expect(result[0].context.targetQuery).toBe('slow service review response');
  });

  // 11. Counts unanswered reviews (rating <= 2 or null)
  it('counts unanswered negative reviews where rating is null or <= 2', async () => {
    const reviews = [
      makeReview({ id: 'r-1', keywords: ['slow service'], rating: null }),
      makeReview({ id: 'r-2', keywords: ['slow service'], rating: 1 }),
      makeReview({ id: 'r-3', keywords: ['slow service'], rating: 2 }),
      makeReview({ id: 'r-4', keywords: ['slow service'], rating: 3 }),
      makeReview({ id: 'r-5', keywords: ['slow service'], rating: 5 }),
    ];
    const supabase = makeMockSupabase({ data: reviews });
    const result = await detectReviewGapTriggers(supabase, LOCATION_ID, ORG_ID);

    // null (unanswered), 1 (unanswered), 2 (unanswered), 3 (answered), 5 (answered)
    expect(result[0].context.unansweredNegativeCount).toBe(3);
    expect(result[0].context.negativeReviewCount).toBe(5);
  });

  // 12. Uses first review ID as triggerId
  it('uses the first review ID as the triggerId', async () => {
    const reviews = [
      makeReview({ id: 'review-first-abc', keywords: ['slow service'] }),
      makeReview({ id: 'review-second-def', keywords: ['slow service'] }),
      makeReview({ id: 'review-third-ghi', keywords: ['slow service'] }),
    ];
    const supabase = makeMockSupabase({ data: reviews });
    const result = await detectReviewGapTriggers(supabase, LOCATION_ID, ORG_ID);

    expect(result[0].triggerId).toBe('review-first-abc');
  });
});
