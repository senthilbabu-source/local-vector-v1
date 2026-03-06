import { describe, it, expect } from 'vitest';
import {
  computeMedian,
  computeP75,
  buildBenchmarks,
  computePercentileRank,
} from '@/lib/analytics/correction-benchmark';

// Helper: create a date N days ago
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

describe('S23: Correction Effectiveness Database', () => {
  describe('computeMedian', () => {
    it('returns middle value for odd-length array', () => {
      expect(computeMedian([1, 2, 3])).toBe(2);
    });

    it('returns average of two middle values for even-length array', () => {
      expect(computeMedian([1, 2, 3, 4])).toBe(2.5);
    });

    it('returns the value for single-element array', () => {
      expect(computeMedian([42])).toBe(42);
    });

    it('returns 0 for empty array', () => {
      expect(computeMedian([])).toBe(0);
    });
  });

  describe('computeP75', () => {
    it('returns 75th percentile', () => {
      const result = computeP75([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(result).toBeGreaterThanOrEqual(6);
      expect(result).toBeLessThanOrEqual(7);
    });

    it('returns the value for single-element array', () => {
      expect(computeP75([10])).toBe(10);
    });
  });

  describe('buildBenchmarks', () => {
    it('groups by model_category key', () => {
      const rows = [
        { model_provider: 'chatgpt', fix_guidance_category: 'wrong_hours', first_detected_at: daysAgo(10), fixed_at: daysAgo(5), verified_at: null, follow_up_result: null },
        { model_provider: 'chatgpt', fix_guidance_category: 'wrong_hours', first_detected_at: daysAgo(20), fixed_at: null, verified_at: daysAgo(10), follow_up_result: 'fixed' },
        { model_provider: 'perplexity', fix_guidance_category: 'wrong_address', first_detected_at: daysAgo(15), fixed_at: daysAgo(12), verified_at: null, follow_up_result: null },
      ];
      const result = buildBenchmarks(rows);
      expect(Object.keys(result)).toHaveLength(2);
      expect(result['chatgpt_wrong_hours']).toBeDefined();
      expect(result['perplexity_wrong_address']).toBeDefined();
    });

    it('computes avg_days_to_fix from dates', () => {
      const now = Date.now();
      const rows = [
        { model_provider: 'chatgpt', fix_guidance_category: 'hours', first_detected_at: new Date(now - 5 * 86400000).toISOString(), fixed_at: new Date(now).toISOString(), verified_at: null, follow_up_result: null },
      ];
      const result = buildBenchmarks(rows);
      const entry = result['chatgpt_hours'];
      expect(entry).toBeDefined();
      expect(entry.avg_days_to_fix).toBeCloseTo(5, 0);
    });

    it('computes recurrence_rate from follow_up_result', () => {
      const rows = [
        { model_provider: 'chatgpt', fix_guidance_category: 'x', first_detected_at: daysAgo(10), fixed_at: daysAgo(5), verified_at: null, follow_up_result: 'recurring' },
        { model_provider: 'chatgpt', fix_guidance_category: 'x', first_detected_at: daysAgo(20), fixed_at: daysAgo(15), verified_at: null, follow_up_result: 'fixed' },
        { model_provider: 'chatgpt', fix_guidance_category: 'x', first_detected_at: daysAgo(30), fixed_at: daysAgo(25), verified_at: null, follow_up_result: 'fixed' },
      ];
      const result = buildBenchmarks(rows);
      const entry = result['chatgpt_x'];
      expect(entry).toBeDefined();
      expect(entry.recurrence_rate).toBeCloseTo(1 / 3, 1);
    });

    it('returns sample_size = count of resolved rows', () => {
      const rows = [
        { model_provider: 'a', fix_guidance_category: 'b', first_detected_at: daysAgo(10), fixed_at: daysAgo(5), verified_at: null, follow_up_result: null },
        { model_provider: 'a', fix_guidance_category: 'b', first_detected_at: daysAgo(20), fixed_at: daysAgo(15), verified_at: null, follow_up_result: null },
      ];
      const result = buildBenchmarks(rows);
      expect(result['a_b'].sample_size).toBe(2);
    });

    it('returns empty object for empty input', () => {
      expect(buildBenchmarks([])).toEqual({});
    });

    it('uses null category as "unknown"', () => {
      const rows = [
        { model_provider: 'chatgpt', fix_guidance_category: null, first_detected_at: daysAgo(10), fixed_at: daysAgo(5), verified_at: null, follow_up_result: null },
      ];
      const result = buildBenchmarks(rows);
      expect(result['chatgpt_unknown']).toBeDefined();
    });

    it('skips rows with no resolved date', () => {
      const rows = [
        { model_provider: 'chatgpt', fix_guidance_category: 'x', first_detected_at: daysAgo(10), fixed_at: null, verified_at: null, follow_up_result: null },
      ];
      const result = buildBenchmarks(rows);
      // No resolved rows → empty
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('computePercentileRank', () => {
    it('returns null for undefined entry', () => {
      expect(computePercentileRank(5, undefined)).toBeNull();
    });

    it('returns null when sample_size < 30', () => {
      expect(computePercentileRank(5, {
        avg_days_to_fix: 10,
        median_days_to_fix: 8,
        p75_days_to_fix: 14,
        recurrence_rate: 0.1,
        sample_size: 20,
      })).toBeNull();
    });

    it('returns 99 for zero days', () => {
      expect(computePercentileRank(0, {
        avg_days_to_fix: 10,
        median_days_to_fix: 8,
        p75_days_to_fix: 14,
        recurrence_rate: 0.1,
        sample_size: 50,
      })).toBe(99);
    });

    it('returns value between 1-99 for normal fix time', () => {
      const rank = computePercentileRank(7, {
        avg_days_to_fix: 10,
        median_days_to_fix: 8,
        p75_days_to_fix: 14,
        recurrence_rate: 0.1,
        sample_size: 50,
      });
      expect(rank).toBeGreaterThanOrEqual(1);
      expect(rank).toBeLessThanOrEqual(99);
    });
  });
});
