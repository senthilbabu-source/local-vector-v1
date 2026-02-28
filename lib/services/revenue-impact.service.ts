// ---------------------------------------------------------------------------
// lib/services/revenue-impact.service.ts — Revenue Impact Calculator
//
// Sprint 85: Pure functions that estimate recoverable revenue from AI
// visibility gaps. Three revenue streams: SOV gaps, hallucination deterrence,
// and competitor advantage.
//
// No I/O, no side effects. Caller passes pre-fetched data.
// ---------------------------------------------------------------------------

// ── Types ─────────────────────────────────────────────────────────────────

export interface RevenueConfig {
  avgCustomerValue: number; // dollars per visit
  monthlyCovers: number; // total monthly customers
}

export interface RevenueImpactInput {
  config: RevenueConfig;

  /** SOV gap queries — queries where business is NOT ranked */
  sovGaps: Array<{
    queryText: string;
    queryCategory: string;
    missingEngineCount: number;
    totalEngineCount: number;
  }>;

  /** Open hallucinations */
  openHallucinations: Array<{
    claimText: string;
    severity: string;
  }>;

  /** Competitor advantage data */
  competitorData: {
    /** Your average SOV (0-1) across all queries */
    yourSov: number | null;
    /** Top competitor's average SOV (0-1) */
    topCompetitorSov: number | null;
    topCompetitorName: string | null;
  };
}

export interface RevenueLineItem {
  category: 'sov_gap' | 'hallucination' | 'competitor';
  label: string;
  description: string;
  monthlyRevenue: number;
  /** Supporting detail for tooltip/expansion */
  detail: string;
}

export interface RevenueImpactResult {
  /** Total estimated recoverable monthly revenue */
  totalMonthlyRevenue: number;
  /** Annual projection */
  totalAnnualRevenue: number;
  /** Breakdown by category */
  lineItems: RevenueLineItem[];
  /** Per-category subtotals */
  sovGapRevenue: number;
  hallucinationRevenue: number;
  competitorRevenue: number;
  /** Config used for calculation (for display) */
  config: RevenueConfig;
  /** Whether user has customized config (vs defaults) */
  isDefaultConfig: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────

/**
 * Restaurant-optimized default revenue configuration.
 * Modeled after Charcoal N Chill (hookah lounge + fusion restaurant, Alpharetta GA).
 * Sprint D (M4): $55 avg check (food + hookah premium), 60 covers/night × 30 days.
 */
export const DEFAULT_REVENUE_CONFIG: RevenueConfig = {
  avgCustomerValue: 55,
  monthlyCovers: 1800,
};

/** Estimated monthly AI-assisted searches per query category */
export const CATEGORY_SEARCH_VOLUME: Record<string, number> = {
  discovery: 90,
  comparison: 60,
  occasion: 45,
  near_me: 120,
  custom: 30,
};

/** Click-through rate from AI recommendation to visit */
export const AI_RECOMMENDATION_CTR = 0.08;

/** Percentage of total restaurant traffic influenced by AI */
export const AI_INFLUENCE_RATE = 0.05;

/** Customers deterred per open hallucination per month, by severity */
export const SEVERITY_IMPACT: Record<string, number> = {
  critical: 8,
  high: 5,
  medium: 2,
  low: 1,
};

// ── Pure computation ──────────────────────────────────────────────────────

/**
 * Compute revenue impact from visibility gaps.
 * Pure function — no I/O, no side effects.
 */
export function computeRevenueImpact(
  input: RevenueImpactInput,
): RevenueImpactResult {
  const lineItems: RevenueLineItem[] = [];

  // ── SOV Gap Revenue ──
  let sovGapRevenue = 0;
  const sovGapQueries = input.sovGaps;

  if (sovGapQueries.length > 0) {
    let totalMissedVisits = 0;

    for (const gap of sovGapQueries) {
      const searchVolume =
        CATEGORY_SEARCH_VOLUME[gap.queryCategory] ??
        CATEGORY_SEARCH_VOLUME.custom;
      // Scale by gap severity: all engines missing = full impact, some = partial
      const gapRatio =
        gap.totalEngineCount > 0
          ? gap.missingEngineCount / gap.totalEngineCount
          : 1;
      const missedVisits = searchVolume * AI_RECOMMENDATION_CTR * gapRatio;
      totalMissedVisits += missedVisits;
    }

    sovGapRevenue = roundTo(
      totalMissedVisits * input.config.avgCustomerValue,
      0,
    );

    lineItems.push({
      category: 'sov_gap',
      label: 'SOV Gaps',
      description: `You're invisible for ${sovGapQueries.length} quer${sovGapQueries.length === 1 ? 'y' : 'ies'} that drive an estimated ${Math.round(totalMissedVisits)} AI-assisted visits/month`,
      monthlyRevenue: sovGapRevenue,
      detail: sovGapQueries
        .map(
          (q) =>
            `"${q.queryText}" (${q.missingEngineCount}/${q.totalEngineCount} engines)`,
        )
        .join(', '),
    });
  }

  // ── Hallucination Revenue ──
  let hallucinationRevenue = 0;

  if (input.openHallucinations.length > 0) {
    let totalDeterred = 0;

    for (const h of input.openHallucinations) {
      const impact = SEVERITY_IMPACT[h.severity] ?? SEVERITY_IMPACT.low;
      totalDeterred += impact;
    }

    hallucinationRevenue = roundTo(
      totalDeterred * input.config.avgCustomerValue,
      0,
    );

    lineItems.push({
      category: 'hallucination',
      label: 'Hallucination Impact',
      description: `${input.openHallucinations.length} active hallucination${input.openHallucinations.length === 1 ? '' : 's'} may deter ~${totalDeterred} potential customers/month`,
      monthlyRevenue: hallucinationRevenue,
      detail: input.openHallucinations
        .map((h) => `"${truncate(h.claimText, 50)}" (${h.severity})`)
        .join(', '),
    });
  }

  // ── Competitor Revenue ──
  let competitorRevenue = 0;

  if (
    input.competitorData.yourSov !== null &&
    input.competitorData.topCompetitorSov !== null &&
    input.competitorData.topCompetitorSov > (input.competitorData.yourSov ?? 0)
  ) {
    const yourSov = input.competitorData.yourSov;
    const compSov = input.competitorData.topCompetitorSov;
    const competitorAdvantage =
      yourSov > 0
        ? (compSov - yourSov) / yourSov
        : compSov > 0
          ? 1
          : 0; // If you have 0 SOV, competitor has 100% advantage

    const divertedCovers =
      input.config.monthlyCovers * competitorAdvantage * AI_INFLUENCE_RATE;
    competitorRevenue = roundTo(
      divertedCovers * input.config.avgCustomerValue,
      0,
    );

    const advantagePercent = Math.round(competitorAdvantage * 100);

    lineItems.push({
      category: 'competitor',
      label: 'Competitor Advantage',
      description: `${input.competitorData.topCompetitorName ?? 'Top competitor'} recommended ${advantagePercent}% more often across head-to-head queries`,
      monthlyRevenue: competitorRevenue,
      detail: `Your SOV: ${(yourSov * 100).toFixed(0)}% vs ${input.competitorData.topCompetitorName ?? 'competitor'}: ${(compSov * 100).toFixed(0)}%`,
    });
  }

  const totalMonthlyRevenue =
    sovGapRevenue + hallucinationRevenue + competitorRevenue;

  // Determine if config is default
  const isDefaultConfig =
    input.config.avgCustomerValue ===
      DEFAULT_REVENUE_CONFIG.avgCustomerValue &&
    input.config.monthlyCovers === DEFAULT_REVENUE_CONFIG.monthlyCovers;

  return {
    totalMonthlyRevenue,
    totalAnnualRevenue: totalMonthlyRevenue * 12,
    lineItems,
    sovGapRevenue,
    hallucinationRevenue,
    competitorRevenue,
    config: input.config,
    isDefaultConfig,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '\u2026' : text;
}
