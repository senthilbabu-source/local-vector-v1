import { describe, it, expect } from 'vitest';
import {
  calculateHallucinationCost,
  calculateSOVGapCost,
  calculateCompetitorStealCost,
  calculateRevenueLeak,
  DEFAULT_CONFIG,
  type RevenueConfig,
  type HallucinationInput,
  type CompetitorInput,
} from '@/lib/services/revenue-leak.service';

// Golden tenant config (Charcoal N Chill — hookah lounge + fusion restaurant)
const GOLDEN_CONFIG: RevenueConfig = {
  avg_ticket: 47.5,
  monthly_searches: 2400,
  local_conversion_rate: 0.032,
  walk_away_rate: 0.65,
};

describe('revenue-leak.service', () => {
  // ─── calculateHallucinationCost ─────────────────────────────────────

  describe('calculateHallucinationCost', () => {
    it('returns {low:0, high:0} when hallucinations array is empty', () => {
      const result = calculateHallucinationCost([], GOLDEN_CONFIG);
      expect(result).toEqual({ low: 0, high: 0 });
    });

    it('calculates cost for single critical hallucination', () => {
      const hallucinations: HallucinationInput[] = [
        { severity: 'critical', correction_status: 'open' },
      ];
      const result = calculateHallucinationCost(hallucinations, GOLDEN_CONFIG);

      // daily = 47.5 × 2.0 × 0.65 = 61.75
      // monthly = 61.75 × 30 = 1852.50
      // high = 1852.50, low = 1852.50 × 0.6 = 1111.50
      expect(result.high).toBe(1852.5);
      expect(result.low).toBe(1111.5);
    });

    it('calculates cost for mixed severities (critical + high + medium)', () => {
      const hallucinations: HallucinationInput[] = [
        { severity: 'critical', correction_status: 'open' },
        { severity: 'high', correction_status: 'open' },
        { severity: 'medium', correction_status: 'open' },
      ];
      const result = calculateHallucinationCost(hallucinations, GOLDEN_CONFIG);

      // critical: 47.5 × 2.0 × 0.65 × 30 = 1852.50
      // high:     47.5 × 1.0 × 0.65 × 30 = 926.25
      // medium:   47.5 × 0.3 × 0.65 × 30 = 277.875
      // total high = 3056.625 → round2 = 3056.63
      // total low  = 3056.625 × 0.6 = 1833.975 → round2 = 1833.98
      expect(result.high).toBe(3056.63);
      expect(result.low).toBe(1833.98);
    });

    it('only counts open hallucinations (ignores fixed/dismissed)', () => {
      const hallucinations: HallucinationInput[] = [
        { severity: 'critical', correction_status: 'open' },
        { severity: 'high', correction_status: 'fixed' },
        { severity: 'medium', correction_status: 'dismissed' },
      ];
      const result = calculateHallucinationCost(hallucinations, GOLDEN_CONFIG);

      // Only the critical one counts
      expect(result.high).toBe(1852.5);
      expect(result.low).toBe(1111.5);
    });

    it('low estimate is 60% of high estimate', () => {
      const hallucinations: HallucinationInput[] = [
        { severity: 'high', correction_status: 'open' },
      ];
      const result = calculateHallucinationCost(hallucinations, GOLDEN_CONFIG);

      // high = 47.5 × 1.0 × 0.65 × 30 = 926.25
      // low = 926.25 × 0.6 = 555.75
      expect(result.high).toBe(926.25);
      expect(result.low).toBe(555.75);
      expect(result.low).toBe(Math.round(result.high * 0.6 * 100) / 100);
    });
  });

  // ─── calculateSOVGapCost ────────────────────────────────────────────

  describe('calculateSOVGapCost', () => {
    it('returns {low:0, high:0} when SOV >= 0.25 (ideal)', () => {
      const result = calculateSOVGapCost(0.25, GOLDEN_CONFIG);
      expect(result).toEqual({ low: 0, high: 0 });
    });

    it('calculates gap cost when SOV is 0.10 (below ideal)', () => {
      const result = calculateSOVGapCost(0.1, GOLDEN_CONFIG);

      // sov_gap = 0.25 - 0.10 = 0.15
      // missed_customers = 2400 × 0.15 × 0.032 = 11.52
      // cost = 11.52 × 47.5 = 547.2
      // low = 547.2 × 0.7 = 383.04
      // high = 547.2 × 1.2 = 656.64
      expect(result.low).toBe(383.04);
      expect(result.high).toBe(656.64);
    });

    it('handles SOV of 0 (not mentioned at all)', () => {
      const result = calculateSOVGapCost(0, GOLDEN_CONFIG);

      // sov_gap = 0.25
      // missed_customers = 2400 × 0.25 × 0.032 = 19.2
      // cost = 19.2 × 47.5 = 912
      // low = 912 × 0.7 = 638.4
      // high = 912 × 1.2 = 1094.4
      expect(result.low).toBe(638.4);
      expect(result.high).toBe(1094.4);
    });

    it('handles SOV of 1.0 (dominates — no gap)', () => {
      const result = calculateSOVGapCost(1.0, GOLDEN_CONFIG);
      expect(result).toEqual({ low: 0, high: 0 });
    });
  });

  // ─── calculateCompetitorStealCost ───────────────────────────────────

  describe('calculateCompetitorStealCost', () => {
    it('returns {low:0, high:0} when no intercepts', () => {
      const result = calculateCompetitorStealCost([], 5, GOLDEN_CONFIG);
      expect(result).toEqual({ low: 0, high: 0 });
    });

    it('returns {low:0, high:0} when business wins all intercepts', () => {
      const intercepts: CompetitorInput[] = [
        { winner: 'Charcoal N Chill', business_name: 'Charcoal N Chill' },
        { winner: 'Charcoal N Chill', business_name: 'Charcoal N Chill' },
      ];
      const result = calculateCompetitorStealCost(intercepts, 5, GOLDEN_CONFIG);
      expect(result).toEqual({ low: 0, high: 0 });
    });

    it('calculates steal cost when competitors win', () => {
      const intercepts: CompetitorInput[] = [
        { winner: 'Cloud 9 Lounge', business_name: 'Charcoal N Chill' },
      ];
      const result = calculateCompetitorStealCost(intercepts, 5, GOLDEN_CONFIG);

      // steal = 47.5 × 0.032 × (2400 / 5) × 0.1 = 47.5 × 0.032 × 480 × 0.1
      //       = 47.5 × 0.032 × 48 = 72.96
      // low = 72.96 × 0.5 = 36.48
      // high = 72.96
      expect(result.high).toBe(72.96);
      expect(result.low).toBe(36.48);
    });

    it('handles mix of wins and losses', () => {
      const intercepts: CompetitorInput[] = [
        { winner: 'Cloud 9 Lounge', business_name: 'Charcoal N Chill' },
        { winner: 'Charcoal N Chill', business_name: 'Charcoal N Chill' },
        { winner: 'Sahara Hookah', business_name: 'Charcoal N Chill' },
      ];
      const result = calculateCompetitorStealCost(intercepts, 5, GOLDEN_CONFIG);

      // 2 losses × 72.96 = 145.92
      // low = 145.92 × 0.5 = 72.96
      // high = 145.92
      expect(result.high).toBe(145.92);
      expect(result.low).toBe(72.96);
    });
  });

  // ─── calculateRevenueLeak (integration) ─────────────────────────────

  describe('calculateRevenueLeak', () => {
    it('sums all three components correctly', () => {
      const hallucinations: HallucinationInput[] = [
        { severity: 'high', correction_status: 'open' },
      ];
      const intercepts: CompetitorInput[] = [
        { winner: 'Cloud 9 Lounge', business_name: 'Charcoal N Chill' },
      ];

      const result = calculateRevenueLeak(
        hallucinations,
        0.1,
        intercepts,
        5,
        GOLDEN_CONFIG,
      );

      // hallucination: low=555.75, high=926.25
      // sov_gap: low=383.04, high=656.64
      // competitor: low=36.48, high=72.96
      // total low = 555.75 + 383.04 + 36.48 = 975.27
      // total high = 926.25 + 656.64 + 72.96 = 1655.85
      expect(result.leak_low).toBe(975.27);
      expect(result.leak_high).toBe(1655.85);
      expect(result.breakdown.hallucination_cost.high).toBe(926.25);
      expect(result.breakdown.sov_gap_cost.high).toBe(656.64);
      expect(result.breakdown.competitor_steal_cost.high).toBe(72.96);
    });

    it('returns all zeros when no issues exist', () => {
      const result = calculateRevenueLeak([], 0.30, [], 0, GOLDEN_CONFIG);

      expect(result.leak_low).toBe(0);
      expect(result.leak_high).toBe(0);
      expect(result.breakdown.hallucination_cost).toEqual({ low: 0, high: 0 });
      expect(result.breakdown.sov_gap_cost).toEqual({ low: 0, high: 0 });
      expect(result.breakdown.competitor_steal_cost).toEqual({ low: 0, high: 0 });
    });

    it('handles golden tenant realistic scenario (2 hallucinations, 0.42 SOV, 1 lost intercept)', () => {
      const hallucinations: HallucinationInput[] = [
        { severity: 'high', correction_status: 'open' },
        { severity: 'medium', correction_status: 'open' },
      ];
      const intercepts: CompetitorInput[] = [
        { winner: 'Cloud 9 Lounge', business_name: 'Charcoal N Chill' },
      ];

      const result = calculateRevenueLeak(
        hallucinations,
        0.42,
        intercepts,
        5,
        GOLDEN_CONFIG,
      );

      // SOV 0.42 >= 0.25 → no gap cost
      expect(result.breakdown.sov_gap_cost).toEqual({ low: 0, high: 0 });

      // hallucination: high=(926.25+277.875)=1204.125 → round2=1204.13
      //                low=1204.125*0.6=722.475 → round2=722.48
      expect(result.breakdown.hallucination_cost.high).toBe(1204.13);
      expect(result.breakdown.hallucination_cost.low).toBe(722.48);

      // competitor: high=72.96, low=36.48
      expect(result.breakdown.competitor_steal_cost.high).toBe(72.96);

      // total: high=1204.13+0+72.96=1277.09, low=722.48+0+36.48=758.96
      expect(result.leak_high).toBe(1277.09);
      expect(result.leak_low).toBe(758.96);
    });

    it('leak_low <= leak_high always', () => {
      const hallucinations: HallucinationInput[] = [
        { severity: 'critical', correction_status: 'open' },
        { severity: 'high', correction_status: 'open' },
        { severity: 'medium', correction_status: 'open' },
        { severity: 'low', correction_status: 'open' },
      ];
      const intercepts: CompetitorInput[] = [
        { winner: 'Cloud 9 Lounge', business_name: 'Charcoal N Chill' },
        { winner: 'Sahara Hookah', business_name: 'Charcoal N Chill' },
      ];

      const result = calculateRevenueLeak(
        hallucinations,
        0.05,
        intercepts,
        10,
        GOLDEN_CONFIG,
      );

      expect(result.leak_low).toBeLessThanOrEqual(result.leak_high);
    });
  });
});
