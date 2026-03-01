// ---------------------------------------------------------------------------
// src/__tests__/unit/review-engine-plan-gate.test.ts
//
// Sprint 107: Tests for the canRunReviewEngine plan gate + GBP fetcher helpers.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { canRunReviewEngine, planSatisfies } from '@/lib/plan-enforcer';
import { mapGBPStarRating } from '@/lib/review-engine/fetchers/gbp-review-fetcher';

describe('canRunReviewEngine', () => {
  it('denies trial plan', () => {
    expect(canRunReviewEngine('trial')).toBe(false);
  });

  it('denies starter plan', () => {
    expect(canRunReviewEngine('starter')).toBe(false);
  });

  it('allows growth plan', () => {
    expect(canRunReviewEngine('growth')).toBe(true);
  });

  it('allows agency plan', () => {
    expect(canRunReviewEngine('agency')).toBe(true);
  });

  it('is consistent with planSatisfies("growth")', () => {
    expect(canRunReviewEngine('growth')).toBe(planSatisfies('growth', 'growth'));
    expect(canRunReviewEngine('agency')).toBe(planSatisfies('agency', 'growth'));
    expect(canRunReviewEngine('starter')).toBe(planSatisfies('starter', 'growth'));
    expect(canRunReviewEngine('trial')).toBe(planSatisfies('trial', 'growth'));
  });
});

describe('mapGBPStarRating', () => {
  it('maps FIVE to 5', () => {
    expect(mapGBPStarRating('FIVE')).toBe(5);
  });

  it('maps FOUR to 4', () => {
    expect(mapGBPStarRating('FOUR')).toBe(4);
  });

  it('maps THREE to 3', () => {
    expect(mapGBPStarRating('THREE')).toBe(3);
  });

  it('maps TWO to 2', () => {
    expect(mapGBPStarRating('TWO')).toBe(2);
  });

  it('maps ONE to 1', () => {
    expect(mapGBPStarRating('ONE')).toBe(1);
  });

  it('returns 3 for unknown rating', () => {
    expect(mapGBPStarRating('UNKNOWN')).toBe(3);
    expect(mapGBPStarRating('')).toBe(3);
  });
});
