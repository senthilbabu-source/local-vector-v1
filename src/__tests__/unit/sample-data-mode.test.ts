// ---------------------------------------------------------------------------
// src/__tests__/unit/sample-data-mode.test.ts — Sprint B (C4)
//
// Validates sample data logic — pure function tests.
// No jsdom needed — these are plain TypeScript function tests.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, afterEach } from 'vitest';
import { isSampleMode } from '@/lib/sample-data/use-sample-mode';
import {
  SAMPLE_VISIBILITY_SCORE,
  SAMPLE_SOV_TREND,
  SAMPLE_HALLUCINATIONS_BY_MODEL,
  SAMPLE_HEALTH_SCORE,
  SAMPLE_FIXED_COUNT,
  SAMPLE_INTERCEPTS_THIS_MONTH,
  SAMPLE_OPEN_ALERT_COUNT,
} from '@/lib/sample-data/sample-dashboard-data';

// ---------------------------------------------------------------------------
// isSampleMode()
// ---------------------------------------------------------------------------

describe('isSampleMode()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false when realityScore is not null (real data exists)', () => {
    expect(isSampleMode(75, new Date().toISOString())).toBe(false);
  });

  it('returns false when realityScore is 0 (0 is a valid real score)', () => {
    expect(isSampleMode(0, new Date().toISOString())).toBe(false);
  });

  it('returns true when realityScore is null and org is 1 day old', () => {
    const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    expect(isSampleMode(null, yesterday)).toBe(true);
  });

  it('returns true when realityScore is null and org is 13 days old', () => {
    const thirteenDaysAgo = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString();
    expect(isSampleMode(null, thirteenDaysAgo)).toBe(true);
  });

  it('returns false when realityScore is null but org is 15 days old (past 14-day window)', () => {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    expect(isSampleMode(null, fifteenDaysAgo)).toBe(false);
  });

  it('returns false when realityScore is null but orgCreatedAt is null', () => {
    expect(isSampleMode(null, null)).toBe(false);
  });

  it('returns false when realityScore is null but orgCreatedAt is invalid ISO string', () => {
    expect(isSampleMode(null, 'not-a-date')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Sample data shape validation
// ---------------------------------------------------------------------------

describe('SAMPLE data shapes', () => {
  it('SAMPLE_VISIBILITY_SCORE is a number between 0 and 100', () => {
    expect(typeof SAMPLE_VISIBILITY_SCORE).toBe('number');
    expect(SAMPLE_VISIBILITY_SCORE).toBeGreaterThanOrEqual(0);
    expect(SAMPLE_VISIBILITY_SCORE).toBeLessThanOrEqual(100);
  });

  it('SAMPLE_SOV_TREND is an array with at least 4 entries', () => {
    expect(Array.isArray(SAMPLE_SOV_TREND)).toBe(true);
    expect(SAMPLE_SOV_TREND.length).toBeGreaterThanOrEqual(4);
  });

  it('SAMPLE_SOV_TREND entries have date (string) and sov (number) fields', () => {
    for (const entry of SAMPLE_SOV_TREND) {
      expect(typeof entry.date).toBe('string');
      expect(typeof entry.sov).toBe('number');
      expect(entry.sov).toBeGreaterThanOrEqual(0);
      expect(entry.sov).toBeLessThanOrEqual(100);
    }
  });

  it('SAMPLE_HALLUCINATIONS_BY_MODEL has entries for at least 3 models', () => {
    expect(SAMPLE_HALLUCINATIONS_BY_MODEL.length).toBeGreaterThanOrEqual(3);
    for (const entry of SAMPLE_HALLUCINATIONS_BY_MODEL) {
      expect(typeof entry.model).toBe('string');
      expect(typeof entry.count).toBe('number');
    }
  });

  it('SAMPLE_HEALTH_SCORE has score, grade, and components', () => {
    expect(typeof SAMPLE_HEALTH_SCORE.score).toBe('number');
    expect(typeof SAMPLE_HEALTH_SCORE.grade).toBe('string');
    expect(SAMPLE_HEALTH_SCORE.components).toBeDefined();
    expect(SAMPLE_HEALTH_SCORE.components.visibility).toBeDefined();
    expect(SAMPLE_HEALTH_SCORE.components.accuracy).toBeDefined();
    expect(SAMPLE_HEALTH_SCORE.components.structure).toBeDefined();
    expect(SAMPLE_HEALTH_SCORE.components.freshness).toBeDefined();
  });

  it('SAMPLE_FIXED_COUNT is a non-negative number', () => {
    expect(typeof SAMPLE_FIXED_COUNT).toBe('number');
    expect(SAMPLE_FIXED_COUNT).toBeGreaterThanOrEqual(0);
  });

  it('SAMPLE_INTERCEPTS_THIS_MONTH is a non-negative number', () => {
    expect(typeof SAMPLE_INTERCEPTS_THIS_MONTH).toBe('number');
    expect(SAMPLE_INTERCEPTS_THIS_MONTH).toBeGreaterThanOrEqual(0);
  });

  it('SAMPLE_OPEN_ALERT_COUNT is a positive number', () => {
    expect(typeof SAMPLE_OPEN_ALERT_COUNT).toBe('number');
    expect(SAMPLE_OPEN_ALERT_COUNT).toBeGreaterThan(0);
  });
});
