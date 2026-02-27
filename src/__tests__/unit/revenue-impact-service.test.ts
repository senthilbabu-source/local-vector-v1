// ---------------------------------------------------------------------------
// revenue-impact-service.test.ts — Unit tests for Revenue Impact Calculator
//
// Sprint 85: 35 tests — pure functions, no mocks needed.
//
// Run:
//   npx vitest run src/__tests__/unit/revenue-impact-service.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  computeRevenueImpact,
  DEFAULT_REVENUE_CONFIG,
  CATEGORY_SEARCH_VOLUME,
  AI_RECOMMENDATION_CTR,
  AI_INFLUENCE_RATE,
  SEVERITY_IMPACT,
  roundTo,
  truncate,
  type RevenueImpactInput,
} from '@/lib/services/revenue-impact.service';
import { MOCK_REVENUE_IMPACT_INPUT } from '@/src/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(
  overrides: Partial<RevenueImpactInput> = {},
): RevenueImpactInput {
  return {
    config: { avgCustomerValue: 45, monthlyCovers: 800 },
    sovGaps: [],
    openHallucinations: [],
    competitorData: {
      yourSov: null,
      topCompetitorSov: null,
      topCompetitorName: null,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Empty input
// ---------------------------------------------------------------------------

describe('computeRevenueImpact', () => {
  describe('Empty input', () => {
    it('1. returns 0 total for empty gaps/hallucinations/no competitor advantage', () => {
      const result = computeRevenueImpact(makeInput());
      expect(result.totalMonthlyRevenue).toBe(0);
    });

    it('2. returns empty lineItems for zero impact', () => {
      const result = computeRevenueImpact(makeInput());
      expect(result.lineItems).toHaveLength(0);
    });

    it('3. annualRevenue is 12x monthly', () => {
      const result = computeRevenueImpact(makeInput());
      expect(result.totalAnnualRevenue).toBe(result.totalMonthlyRevenue * 12);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SOV gap revenue
  // ─────────────────────────────────────────────────────────────────────────

  describe('SOV gap revenue', () => {
    it('4. computes revenue for near_me queries (120 volume x 0.08 CTR x $45)', () => {
      const result = computeRevenueImpact(
        makeInput({
          sovGaps: [
            {
              queryText: 'hookah near me',
              queryCategory: 'near_me',
              missingEngineCount: 3,
              totalEngineCount: 3,
            },
          ],
        }),
      );
      // 120 * 0.08 * 1.0 * 45 = 432
      expect(result.sovGapRevenue).toBe(432);
    });

    it('5. computes revenue for discovery queries (90 volume x 0.08 CTR x $45)', () => {
      const result = computeRevenueImpact(
        makeInput({
          sovGaps: [
            {
              queryText: 'best hookah Alpharetta',
              queryCategory: 'discovery',
              missingEngineCount: 3,
              totalEngineCount: 3,
            },
          ],
        }),
      );
      // 90 * 0.08 * 1.0 * 45 = 324
      expect(result.sovGapRevenue).toBe(324);
    });

    it('6. computes revenue for occasion queries (45 volume)', () => {
      const result = computeRevenueImpact(
        makeInput({
          sovGaps: [
            {
              queryText: 'valentines dinner',
              queryCategory: 'occasion',
              missingEngineCount: 2,
              totalEngineCount: 2,
            },
          ],
        }),
      );
      // 45 * 0.08 * 1.0 * 45 = 162
      expect(result.sovGapRevenue).toBe(162);
    });

    it('7. computes revenue for comparison queries (60 volume)', () => {
      const result = computeRevenueImpact(
        makeInput({
          sovGaps: [
            {
              queryText: 'hookah vs lounge',
              queryCategory: 'comparison',
              missingEngineCount: 1,
              totalEngineCount: 1,
            },
          ],
        }),
      );
      // 60 * 0.08 * 1.0 * 45 = 216
      expect(result.sovGapRevenue).toBe(216);
    });

    it('8. falls back to custom volume for unknown category', () => {
      const result = computeRevenueImpact(
        makeInput({
          sovGaps: [
            {
              queryText: 'something random',
              queryCategory: 'unknown_category',
              missingEngineCount: 2,
              totalEngineCount: 2,
            },
          ],
        }),
      );
      // Falls back to custom: 30 * 0.08 * 1.0 * 45 = 108
      expect(result.sovGapRevenue).toBe(108);
    });

    it('9. scales by gap ratio (2/3 engines missing = 2/3 impact)', () => {
      const result = computeRevenueImpact(
        makeInput({
          sovGaps: [
            {
              queryText: 'hookah near me',
              queryCategory: 'near_me',
              missingEngineCount: 2,
              totalEngineCount: 3,
            },
          ],
        }),
      );
      // 120 * 0.08 * (2/3) * 45 = 288
      expect(result.sovGapRevenue).toBe(288);
    });

    it('10. sums revenue across all gap queries', () => {
      const result = computeRevenueImpact(
        makeInput({
          sovGaps: [
            {
              queryText: 'hookah near me',
              queryCategory: 'near_me',
              missingEngineCount: 3,
              totalEngineCount: 3,
            },
            {
              queryText: 'best hookah',
              queryCategory: 'discovery',
              missingEngineCount: 3,
              totalEngineCount: 3,
            },
          ],
        }),
      );
      // (120 * 0.08 * 1.0 + 90 * 0.08 * 1.0) * 45 = (9.6 + 7.2) * 45 = 756
      expect(result.sovGapRevenue).toBe(756);
    });

    it('11. creates line item with correct query count', () => {
      const result = computeRevenueImpact(
        makeInput({
          sovGaps: [
            {
              queryText: 'q1',
              queryCategory: 'near_me',
              missingEngineCount: 3,
              totalEngineCount: 3,
            },
            {
              queryText: 'q2',
              queryCategory: 'discovery',
              missingEngineCount: 3,
              totalEngineCount: 3,
            },
          ],
        }),
      );
      const sovItem = result.lineItems.find((li) => li.category === 'sov_gap');
      expect(sovItem).toBeDefined();
      expect(sovItem!.description).toContain('2 queries');
    });

    it('12. description includes estimated visits', () => {
      const result = computeRevenueImpact(
        makeInput({
          sovGaps: [
            {
              queryText: 'hookah near me',
              queryCategory: 'near_me',
              missingEngineCount: 3,
              totalEngineCount: 3,
            },
          ],
        }),
      );
      const sovItem = result.lineItems.find((li) => li.category === 'sov_gap');
      expect(sovItem!.description).toMatch(/\d+ AI-assisted visits\/month/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Hallucination revenue
  // ─────────────────────────────────────────────────────────────────────────

  describe('Hallucination revenue', () => {
    it('13. critical severity deters 8 customers', () => {
      const result = computeRevenueImpact(
        makeInput({
          openHallucinations: [
            { claimText: 'permanently closed', severity: 'critical' },
          ],
        }),
      );
      // 8 * 45 = 360
      expect(result.hallucinationRevenue).toBe(360);
    });

    it('14. high severity deters 5 customers', () => {
      const result = computeRevenueImpact(
        makeInput({
          openHallucinations: [
            { claimText: 'wrong hours', severity: 'high' },
          ],
        }),
      );
      // 5 * 45 = 225
      expect(result.hallucinationRevenue).toBe(225);
    });

    it('15. medium severity deters 2 customers', () => {
      const result = computeRevenueImpact(
        makeInput({
          openHallucinations: [
            { claimText: 'minor error', severity: 'medium' },
          ],
        }),
      );
      // 2 * 45 = 90
      expect(result.hallucinationRevenue).toBe(90);
    });

    it('16. low severity deters 1 customer', () => {
      const result = computeRevenueImpact(
        makeInput({
          openHallucinations: [
            { claimText: 'trivial thing', severity: 'low' },
          ],
        }),
      );
      // 1 * 45 = 45
      expect(result.hallucinationRevenue).toBe(45);
    });

    it('17. defaults to low for unknown severity', () => {
      const result = computeRevenueImpact(
        makeInput({
          openHallucinations: [
            { claimText: 'something', severity: 'banana' },
          ],
        }),
      );
      // Falls back to low: 1 * 45 = 45
      expect(result.hallucinationRevenue).toBe(45);
    });

    it('18. sums deterred customers across all hallucinations', () => {
      const result = computeRevenueImpact(
        makeInput({
          openHallucinations: [
            { claimText: 'closed', severity: 'critical' },
            { claimText: 'wrong hours', severity: 'high' },
          ],
        }),
      );
      // (8 + 5) * 45 = 585
      expect(result.hallucinationRevenue).toBe(585);
    });

    it('19. computes revenue as deterred x avgCustomerValue', () => {
      const result = computeRevenueImpact(
        makeInput({
          config: { avgCustomerValue: 100, monthlyCovers: 800 },
          openHallucinations: [
            { claimText: 'closed', severity: 'critical' },
          ],
        }),
      );
      // 8 * 100 = 800
      expect(result.hallucinationRevenue).toBe(800);
    });

    it('20. creates line item with hallucination count', () => {
      const result = computeRevenueImpact(
        makeInput({
          openHallucinations: [
            { claimText: 'a', severity: 'high' },
            { claimText: 'b', severity: 'medium' },
            { claimText: 'c', severity: 'low' },
          ],
        }),
      );
      const halItem = result.lineItems.find(
        (li) => li.category === 'hallucination',
      );
      expect(halItem).toBeDefined();
      expect(halItem!.description).toContain('3 active hallucinations');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Competitor revenue
  // ─────────────────────────────────────────────────────────────────────────

  describe('Competitor revenue', () => {
    it('21. computes competitor advantage ratio correctly', () => {
      const result = computeRevenueImpact(
        makeInput({
          competitorData: {
            yourSov: 0.20,
            topCompetitorSov: 0.30,
            topCompetitorName: 'Rival',
          },
        }),
      );
      // advantage = (0.30 - 0.20) / 0.20 = 0.50
      // diverted = 800 * 0.50 * 0.05 = 20
      // revenue = 20 * 45 = 900
      expect(result.competitorRevenue).toBe(900);
    });

    it('22. multiplies advantage by monthlyCovers x AI_INFLUENCE_RATE x avgCustomerValue', () => {
      const result = computeRevenueImpact(
        makeInput({
          config: { avgCustomerValue: 60, monthlyCovers: 1000 },
          competitorData: {
            yourSov: 0.10,
            topCompetitorSov: 0.20,
            topCompetitorName: 'Rival',
          },
        }),
      );
      // advantage = (0.20 - 0.10) / 0.10 = 1.0
      // diverted = 1000 * 1.0 * 0.05 = 50
      // revenue = 50 * 60 = 3000
      expect(result.competitorRevenue).toBe(3000);
    });

    it('23. handles zero yourSov (100% competitor advantage, capped)', () => {
      const result = computeRevenueImpact(
        makeInput({
          competitorData: {
            yourSov: 0,
            topCompetitorSov: 0.30,
            topCompetitorName: 'Rival',
          },
        }),
      );
      // advantage = 1 (capped)
      // diverted = 800 * 1.0 * 0.05 = 40
      // revenue = 40 * 45 = 1800
      expect(result.competitorRevenue).toBe(1800);
    });

    it('24. skips competitor line item when no competitor data', () => {
      const result = computeRevenueImpact(
        makeInput({
          competitorData: {
            yourSov: null,
            topCompetitorSov: null,
            topCompetitorName: null,
          },
        }),
      );
      expect(result.competitorRevenue).toBe(0);
      expect(
        result.lineItems.find((li) => li.category === 'competitor'),
      ).toBeUndefined();
    });

    it('25. skips when competitor SOV <= your SOV (no advantage)', () => {
      const result = computeRevenueImpact(
        makeInput({
          competitorData: {
            yourSov: 0.30,
            topCompetitorSov: 0.20,
            topCompetitorName: 'Weak Rival',
          },
        }),
      );
      expect(result.competitorRevenue).toBe(0);
      expect(
        result.lineItems.find((li) => li.category === 'competitor'),
      ).toBeUndefined();
    });

    it('26. includes competitor name in description', () => {
      const result = computeRevenueImpact(
        makeInput({
          competitorData: {
            yourSov: 0.19,
            topCompetitorSov: 0.24,
            topCompetitorName: 'Cloud 9 Lounge',
          },
        }),
      );
      const compItem = result.lineItems.find(
        (li) => li.category === 'competitor',
      );
      expect(compItem).toBeDefined();
      expect(compItem!.description).toContain('Cloud 9 Lounge');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Config
  // ─────────────────────────────────────────────────────────────────────────

  describe('Config', () => {
    it('27. uses provided avgCustomerValue for all calculations', () => {
      const result = computeRevenueImpact(
        makeInput({
          config: { avgCustomerValue: 100, monthlyCovers: 800 },
          sovGaps: [
            {
              queryText: 'hookah near me',
              queryCategory: 'near_me',
              missingEngineCount: 3,
              totalEngineCount: 3,
            },
          ],
        }),
      );
      // 120 * 0.08 * 1.0 * 100 = 960
      expect(result.sovGapRevenue).toBe(960);
    });

    it('28. uses provided monthlyCovers for competitor calc', () => {
      const result = computeRevenueImpact(
        makeInput({
          config: { avgCustomerValue: 45, monthlyCovers: 2000 },
          competitorData: {
            yourSov: 0.20,
            topCompetitorSov: 0.30,
            topCompetitorName: 'Rival',
          },
        }),
      );
      // advantage = 0.50, diverted = 2000 * 0.50 * 0.05 = 50, revenue = 50 * 45 = 2250
      expect(result.competitorRevenue).toBe(2250);
    });

    it('29. isDefaultConfig true when matching DEFAULT_REVENUE_CONFIG', () => {
      const result = computeRevenueImpact(
        makeInput({
          config: {
            avgCustomerValue: DEFAULT_REVENUE_CONFIG.avgCustomerValue,
            monthlyCovers: DEFAULT_REVENUE_CONFIG.monthlyCovers,
          },
        }),
      );
      expect(result.isDefaultConfig).toBe(true);
    });

    it('30. isDefaultConfig false when config differs from default', () => {
      const result = computeRevenueImpact(
        makeInput({
          config: { avgCustomerValue: 60, monthlyCovers: 1200 },
        }),
      );
      expect(result.isDefaultConfig).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Integration (MOCK_REVENUE_IMPACT_INPUT)
  // ─────────────────────────────────────────────────────────────────────────

  describe('Integration', () => {
    it('31. produces expected result from MOCK_REVENUE_IMPACT_INPUT', () => {
      const result = computeRevenueImpact(MOCK_REVENUE_IMPACT_INPUT);
      expect(result.totalMonthlyRevenue).toBeGreaterThan(0);
      expect(result.totalAnnualRevenue).toBe(result.totalMonthlyRevenue * 12);
    });

    it('32. MOCK total is sum of all three categories', () => {
      const result = computeRevenueImpact(MOCK_REVENUE_IMPACT_INPUT);
      expect(result.totalMonthlyRevenue).toBe(
        result.sovGapRevenue +
          result.hallucinationRevenue +
          result.competitorRevenue,
      );
    });

    it('33. all three line items present in MOCK result', () => {
      const result = computeRevenueImpact(MOCK_REVENUE_IMPACT_INPUT);
      const categories = result.lineItems.map((li) => li.category);
      expect(categories).toContain('sov_gap');
      expect(categories).toContain('hallucination');
      expect(categories).toContain('competitor');
    });
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

describe('helpers', () => {
  it('34. roundTo rounds to specified decimals', () => {
    expect(roundTo(1.2345, 2)).toBe(1.23);
    expect(roundTo(1.235, 2)).toBe(1.24);
    expect(roundTo(123.456, 0)).toBe(123);
  });

  it('35. truncate shortens long text with ellipsis', () => {
    expect(truncate('Hello World', 50)).toBe('Hello World');
    expect(truncate('This is a very long text that should be truncated', 20)).toBe(
      'This is a very long\u2026',
    );
  });
});
