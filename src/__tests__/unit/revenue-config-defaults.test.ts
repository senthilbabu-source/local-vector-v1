// ---------------------------------------------------------------------------
// revenue-config-defaults.test.ts — Sprint D (M4): Restaurant-specific defaults
//
// 12 tests: validates DEFAULT_REVENUE_CONFIG values, revenue calculations
// with new defaults, and form integration expectations.
//
// Run:
//   npx vitest run src/__tests__/unit/revenue-config-defaults.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_REVENUE_CONFIG,
  computeRevenueImpact,
} from '@/lib/services/revenue-impact.service';
import {
  CHARCOAL_N_CHILL_REVENUE_CONFIG,
  MOCK_REVENUE_IMPACT_INPUT,
} from '@/src/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// DEFAULT_REVENUE_CONFIG validation
// ---------------------------------------------------------------------------

describe('DEFAULT_REVENUE_CONFIG', () => {
  it('1. avgCustomerValue is between $30 and $100 (reasonable restaurant range)', () => {
    expect(DEFAULT_REVENUE_CONFIG.avgCustomerValue).toBeGreaterThanOrEqual(30);
    expect(DEFAULT_REVENUE_CONFIG.avgCustomerValue).toBeLessThanOrEqual(100);
  });

  it('2. monthlyCovers is a positive integer', () => {
    expect(DEFAULT_REVENUE_CONFIG.monthlyCovers).toBeGreaterThan(0);
    expect(Number.isInteger(DEFAULT_REVENUE_CONFIG.monthlyCovers)).toBe(true);
  });

  it('3. all values are positive numbers (no zeros, no negatives)', () => {
    for (const [key, value] of Object.entries(DEFAULT_REVENUE_CONFIG)) {
      expect(value, `${key} must be positive`).toBeGreaterThan(0);
      expect(typeof value, `${key} must be a number`).toBe('number');
    }
  });

  it('4. avgCustomerValue is $55 (restaurant + hookah premium)', () => {
    expect(DEFAULT_REVENUE_CONFIG.avgCustomerValue).toBe(55);
  });

  it('5. monthlyCovers is 1800 (60 covers/night × 30 days)', () => {
    expect(DEFAULT_REVENUE_CONFIG.monthlyCovers).toBe(1800);
  });
});

// ---------------------------------------------------------------------------
// CHARCOAL_N_CHILL_REVENUE_CONFIG fixture
// ---------------------------------------------------------------------------

describe('CHARCOAL_N_CHILL_REVENUE_CONFIG fixture', () => {
  it('6. matches DEFAULT_REVENUE_CONFIG exactly', () => {
    expect(CHARCOAL_N_CHILL_REVENUE_CONFIG.avgCustomerValue).toBe(
      DEFAULT_REVENUE_CONFIG.avgCustomerValue,
    );
    expect(CHARCOAL_N_CHILL_REVENUE_CONFIG.monthlyCovers).toBe(
      DEFAULT_REVENUE_CONFIG.monthlyCovers,
    );
  });
});

// ---------------------------------------------------------------------------
// Revenue calculation with restaurant defaults
// ---------------------------------------------------------------------------

describe('revenue-impact.service with restaurant defaults', () => {
  it('7. computeRevenueImpact with DEFAULT_REVENUE_CONFIG returns positive for MOCK input', () => {
    const result = computeRevenueImpact(MOCK_REVENUE_IMPACT_INPUT);
    expect(result.totalMonthlyRevenue).toBeGreaterThan(0);
  });

  it('8. monthly revenue is between $500 and $50,000 (sanity range for a restaurant)', () => {
    const result = computeRevenueImpact(MOCK_REVENUE_IMPACT_INPUT);
    expect(result.totalMonthlyRevenue).toBeGreaterThanOrEqual(500);
    expect(result.totalMonthlyRevenue).toBeLessThanOrEqual(50000);
  });

  it('9. isDefaultConfig is true when MOCK uses default config values', () => {
    const result = computeRevenueImpact(MOCK_REVENUE_IMPACT_INPUT);
    expect(result.isDefaultConfig).toBe(true);
  });

  it('10. SOV gap revenue uses avgCustomerValue=$55', () => {
    // Single near_me query: 120 searches × 0.08 CTR × 1.0 gap ratio × $55
    const result = computeRevenueImpact({
      config: DEFAULT_REVENUE_CONFIG,
      sovGaps: [
        {
          queryText: 'hookah near me',
          queryCategory: 'near_me',
          missingEngineCount: 3,
          totalEngineCount: 3,
        },
      ],
      openHallucinations: [],
      competitorData: { yourSov: null, topCompetitorSov: null, topCompetitorName: null },
    });
    // 120 * 0.08 * 1.0 * 55 = 528
    expect(result.sovGapRevenue).toBe(528);
  });

  it('11. hallucination revenue uses avgCustomerValue=$55', () => {
    const result = computeRevenueImpact({
      config: DEFAULT_REVENUE_CONFIG,
      sovGaps: [],
      openHallucinations: [
        { claimText: 'permanently closed', severity: 'critical' },
      ],
      competitorData: { yourSov: null, topCompetitorSov: null, topCompetitorName: null },
    });
    // 8 deterred × $55 = 440
    expect(result.hallucinationRevenue).toBe(440);
  });

  it('12. competitor revenue uses monthlyCovers=1800', () => {
    const result = computeRevenueImpact({
      config: DEFAULT_REVENUE_CONFIG,
      sovGaps: [],
      openHallucinations: [],
      competitorData: {
        yourSov: 0.20,
        topCompetitorSov: 0.30,
        topCompetitorName: 'Rival',
      },
    });
    // advantage = (0.30-0.20)/0.20 = 0.50
    // diverted = 1800 × 0.50 × 0.05 = 45
    // revenue = 45 × 55 = 2475
    expect(result.competitorRevenue).toBe(2475);
  });
});
