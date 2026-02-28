// ---------------------------------------------------------------------------
// src/__tests__/unit/plan-feature-matrix.test.ts — Sprint B + Sprint M (M3)
//
// Validates the feature matrix data integrity.
// Sprint M: verifies matrix is derived from plan-enforcer.ts gating functions.
// Pure data tests — no jsdom needed.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { PLAN_FEATURE_MATRIX, buildFeatureMatrix, type FeatureRow } from '@/lib/plan-feature-matrix';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Count features that are truthy (true or a non-empty string) for a plan. */
function countIncluded(plan: 'trial' | 'starter' | 'growth' | 'agency'): number {
  return PLAN_FEATURE_MATRIX.filter((f) => f[plan] === true || typeof f[plan] === 'string').length;
}

// ---------------------------------------------------------------------------
// PLAN_FEATURE_MATRIX
// ---------------------------------------------------------------------------

describe('PLAN_FEATURE_MATRIX', () => {
  it('has at least 15 feature rows', () => {
    expect(PLAN_FEATURE_MATRIX.length).toBeGreaterThanOrEqual(15);
  });

  it('every row has a non-empty label', () => {
    for (const row of PLAN_FEATURE_MATRIX) {
      expect(row.label.length).toBeGreaterThan(0);
    }
  });

  it('every row has a valid category value', () => {
    const validCategories: FeatureRow['category'][] = [
      'Core', 'AI Monitoring', 'Competitive', 'Content', 'Integrations', 'Support',
    ];
    for (const row of PLAN_FEATURE_MATRIX) {
      expect(validCategories).toContain(row.category);
    }
  });

  it('every row has trial, starter, growth, agency keys', () => {
    for (const row of PLAN_FEATURE_MATRIX) {
      expect('trial' in row).toBe(true);
      expect('starter' in row).toBe(true);
      expect('growth' in row).toBe(true);
      expect('agency' in row).toBe(true);
    }
  });

  it('agency plan has at least as many features as growth plan', () => {
    expect(countIncluded('agency')).toBeGreaterThanOrEqual(countIncluded('growth'));
  });

  it('growth plan has at least as many features as starter plan', () => {
    expect(countIncluded('growth')).toBeGreaterThanOrEqual(countIncluded('starter'));
  });

  it('starter plan has at least as many features as trial plan', () => {
    expect(countIncluded('starter')).toBeGreaterThanOrEqual(countIncluded('trial'));
  });

  it('no feature label appears more than once (no duplicates)', () => {
    const labels = PLAN_FEATURE_MATRIX.map((f) => f.label);
    const unique = new Set(labels);
    expect(unique.size).toBe(labels.length);
  });

  it('webhook alerts feature is agency-only', () => {
    const row = PLAN_FEATURE_MATRIX.find((f) => f.label.includes('Webhook'));
    expect(row).toBeDefined();
    expect(row!.trial).toBe(false);
    expect(row!.starter).toBe(false);
    expect(row!.growth).toBe(false);
    expect(row!.agency).toBe(true);
  });

  it('multiple locations row has numeric string values', () => {
    const row = PLAN_FEATURE_MATRIX.find((f) => f.label.includes('Multiple locations'));
    expect(row).toBeDefined();
    expect(row!.agency).toBe('10');
  });

  it('every value is boolean or string — no undefined or null', () => {
    const plans = ['trial', 'starter', 'growth', 'agency'] as const;
    for (const row of PLAN_FEATURE_MATRIX) {
      for (const plan of plans) {
        const val = row[plan];
        expect(typeof val === 'boolean' || typeof val === 'string').toBe(true);
      }
    }
  });

  it('Reality Score is available on all plans', () => {
    const row = PLAN_FEATURE_MATRIX.find((f) => f.label === 'Reality Score');
    expect(row).toBeDefined();
    expect(row!.trial).toBe(true);
    expect(row!.starter).toBe(true);
    expect(row!.growth).toBe(true);
    expect(row!.agency).toBe(true);
  });

  it('competitor tracking has numeric limits for growth and agency', () => {
    const row = PLAN_FEATURE_MATRIX.find((f) => f.label === 'Competitor tracking');
    expect(row).toBeDefined();
    expect(typeof row!.growth).toBe('string');
    expect(typeof row!.agency).toBe('string');
  });

  it('team seats row has numeric string values for all tiers', () => {
    const row = PLAN_FEATURE_MATRIX.find((f) => f.label === 'Team seats');
    expect(row).toBeDefined();
    expect(row!.trial).toBe('1');
    expect(row!.starter).toBe('1');
    expect(row!.growth).toBe('1');
    expect(row!.agency).toBe('5');
  });

  it('daily scan is growth+ only', () => {
    const row = PLAN_FEATURE_MATRIX.find((f) => f.label === 'Daily hallucination scan');
    expect(row).toBeDefined();
    expect(row!.trial).toBe(false);
    expect(row!.starter).toBe(false);
    expect(row!.growth).toBe(true);
    expect(row!.agency).toBe(true);
  });

  it('GBP sync is starter+ only', () => {
    const row = PLAN_FEATURE_MATRIX.find((f) => f.label === 'Google Business Profile sync');
    expect(row).toBeDefined();
    expect(row!.trial).toBe(false);
    expect(row!.starter).toBe(true);
    expect(row!.growth).toBe(true);
    expect(row!.agency).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildFeatureMatrix() — Sprint M
// ---------------------------------------------------------------------------

describe('buildFeatureMatrix()', () => {
  it('returns the same data as PLAN_FEATURE_MATRIX export', () => {
    const built = buildFeatureMatrix();
    expect(built).toEqual(PLAN_FEATURE_MATRIX);
  });

  it('returns a new array on each call (not a shared reference)', () => {
    const a = buildFeatureMatrix();
    const b = buildFeatureMatrix();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('produces consistent results across multiple calls', () => {
    const results = Array.from({ length: 5 }, () => buildFeatureMatrix());
    for (const r of results) {
      expect(r.length).toBe(results[0].length);
      expect(r.map((row) => row.label)).toEqual(results[0].map((row) => row.label));
    }
  });
});
