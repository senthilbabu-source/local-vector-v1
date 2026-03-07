// ---------------------------------------------------------------------------
// wave5-s31-per-issue-revenue.test.ts — S31 (§234)
//
// Pure function tests for per-issue revenue estimation.
// Run: npx vitest run src/__tests__/unit/wave5-s31-per-issue-revenue.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  estimateRevenueAtRisk,
  formatRevenueAtRisk,
  sumRevenueAtRisk,
} from '@/lib/services/per-issue-revenue';

// ---------------------------------------------------------------------------
// estimateRevenueAtRisk
// ---------------------------------------------------------------------------

describe('S31 — estimateRevenueAtRisk', () => {
  // Default config: avgCustomerValue=55, monthlyCovers=1800 → base=99000

  it('critical severity baseline: 2% of monthly revenue', () => {
    const result = estimateRevenueAtRisk('critical', null);
    // 55 * 1800 * 0.02 = 1980
    expect(result).toBe(1980);
  });

  it('high severity: 1% of monthly revenue', () => {
    const result = estimateRevenueAtRisk('high', null);
    // 55 * 1800 * 0.01 = 990
    expect(result).toBe(990);
  });

  it('medium severity: 0.5% of monthly revenue', () => {
    const result = estimateRevenueAtRisk('medium', null);
    // 55 * 1800 * 0.005 = 495
    expect(result).toBe(495);
  });

  it('low severity: 0.2% of monthly revenue', () => {
    const result = estimateRevenueAtRisk('low', null);
    // 55 * 1800 * 0.002 = 198
    expect(result).toBe(198);
  });

  it('hours category multiplier (1.5x)', () => {
    const result = estimateRevenueAtRisk('critical', 'hours');
    // 1980 * 1.5 = 2970
    expect(result).toBe(2970);
  });

  it('address category multiplier (2x)', () => {
    const result = estimateRevenueAtRisk('critical', 'address');
    // 1980 * 2.0 = 3960
    expect(result).toBe(3960);
  });

  it('uses default avgCustomerValue/monthlyCovers when not provided', () => {
    const result = estimateRevenueAtRisk('low', null);
    expect(result).toBe(198); // 55 * 1800 * 0.002
  });

  it('accepts custom config values', () => {
    const result = estimateRevenueAtRisk('critical', null, 100, 3000);
    // 100 * 3000 * 0.02 = 6000
    expect(result).toBe(6000);
  });

  it('unknown severity falls back to low', () => {
    const result = estimateRevenueAtRisk('unknown', null);
    expect(result).toBe(198); // same as low
  });

  it('unknown category has no multiplier', () => {
    const result = estimateRevenueAtRisk('critical', 'menu');
    expect(result).toBe(1980); // no category multiplier
  });
});

// ---------------------------------------------------------------------------
// formatRevenueAtRisk
// ---------------------------------------------------------------------------

describe('S31 — formatRevenueAtRisk', () => {
  it('formats to "$X/mo"', () => {
    expect(formatRevenueAtRisk(1980)).toBe('$1,980/mo');
  });

  it('returns null for amount < 10', () => {
    expect(formatRevenueAtRisk(5)).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(formatRevenueAtRisk(null)).toBeNull();
    expect(formatRevenueAtRisk(undefined)).toBeNull();
  });

  it('rounds to nearest dollar', () => {
    expect(formatRevenueAtRisk(99.7)).toBe('$100/mo');
  });

  it('formats $10 (boundary)', () => {
    expect(formatRevenueAtRisk(10)).toBe('$10/mo');
  });
});

// ---------------------------------------------------------------------------
// sumRevenueAtRisk
// ---------------------------------------------------------------------------

describe('S31 — sumRevenueAtRisk', () => {
  it('aggregates revenue across array', () => {
    const items = [
      { severity: 'critical', category: null },
      { severity: 'high', category: null },
    ];
    const result = sumRevenueAtRisk(items);
    expect(result).toBe(1980 + 990);
  });

  it('returns 0 for empty array', () => {
    expect(sumRevenueAtRisk([])).toBe(0);
  });

  it('handles mixed severities and categories', () => {
    const items = [
      { severity: 'critical', category: 'hours' },
      { severity: 'low', category: null },
    ];
    const result = sumRevenueAtRisk(items);
    expect(result).toBe(2970 + 198);
  });
});
