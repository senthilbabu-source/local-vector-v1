import { describe, it, expect } from 'vitest';
import {
  computeRollingStats,
  isDegraded,
} from '@/lib/analytics/degradation-detector';

describe('S22: AI Accuracy Degradation Alerts', () => {
  describe('computeRollingStats', () => {
    it('returns zero stats for empty series', () => {
      const stats = computeRollingStats([]);
      expect(stats.mean).toBe(0);
      expect(stats.stddev).toBe(0);
      expect(stats.sampleCount).toBe(0);
    });

    it('returns zero stddev for single-element series', () => {
      const stats = computeRollingStats([5]);
      expect(stats.mean).toBe(5);
      expect(stats.stddev).toBe(0);
      expect(stats.sampleCount).toBe(1);
    });

    it('computes mean correctly', () => {
      const stats = computeRollingStats([2, 4, 6, 8, 10]);
      expect(stats.mean).toBe(6);
    });

    it('computes stddev = 0 for identical values', () => {
      const stats = computeRollingStats([10, 10, 10, 10, 10]);
      expect(stats.stddev).toBe(0);
    });

    it('handles two-element series', () => {
      const stats = computeRollingStats([5, 15]);
      expect(stats.mean).toBe(10);
      expect(stats.stddev).toBeGreaterThan(0);
    });

    it('returns sampleCount matching array length', () => {
      const stats = computeRollingStats([1, 2, 3]);
      expect(stats.sampleCount).toBe(3);
    });
  });

  describe('isDegraded', () => {
    it('returns true when current > mean + 2σ', () => {
      expect(isDegraded(15, { mean: 10, stddev: 2, sampleCount: 5 })).toBe(true);
    });

    it('returns false when current ≤ mean + 2σ', () => {
      expect(isDegraded(13, { mean: 10, stddev: 2, sampleCount: 5 })).toBe(false);
    });

    it('returns false when exactly at threshold', () => {
      expect(isDegraded(14, { mean: 10, stddev: 2, sampleCount: 5 })).toBe(false);
    });

    it('returns false for zero stddev (no anomaly possible)', () => {
      expect(isDegraded(11, { mean: 10, stddev: 0, sampleCount: 5 })).toBe(false);
    });

    it('returns false when sampleCount < 2', () => {
      expect(isDegraded(100, { mean: 10, stddev: 5, sampleCount: 1 })).toBe(false);
    });

    it('detects large spike', () => {
      expect(isDegraded(100, { mean: 10, stddev: 5, sampleCount: 5 })).toBe(true);
    });
  });
});
