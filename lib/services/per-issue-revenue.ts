// ---------------------------------------------------------------------------
// lib/services/per-issue-revenue.ts — S31 (§234)
//
// Pure functions for estimating per-hallucination revenue at risk.
// ---------------------------------------------------------------------------

/** Default revenue config (restaurant industry) */
const DEFAULT_AVG_CUSTOMER_VALUE = 55;
const DEFAULT_MONTHLY_COVERS = 1800;

/** Severity multipliers as fraction of monthly revenue */
const SEVERITY_MULTIPLIERS: Record<string, number> = {
  critical: 0.02,
  high: 0.01,
  medium: 0.005,
  low: 0.002,
};

/** Category multipliers — certain error types have outsized impact */
const CATEGORY_MULTIPLIERS: Record<string, number> = {
  hours: 1.5,
  address: 2.0,
};

/**
 * Estimate monthly revenue at risk for a single hallucination.
 * Pure function — no I/O.
 */
export function estimateRevenueAtRisk(
  severity: string,
  category: string | null | undefined,
  avgCustomerValue = DEFAULT_AVG_CUSTOMER_VALUE,
  monthlyCovers = DEFAULT_MONTHLY_COVERS,
): number {
  const base = avgCustomerValue * monthlyCovers;
  const severityMult = SEVERITY_MULTIPLIERS[severity] ?? SEVERITY_MULTIPLIERS.low;
  const catKey = (category ?? '').toLowerCase();
  const categoryMult = CATEGORY_MULTIPLIERS[catKey] ?? 1.0;
  return Math.round(base * severityMult * categoryMult);
}

/**
 * Format a revenue amount as "$X/mo". Returns null if amount < $10.
 */
export function formatRevenueAtRisk(amount: number | null | undefined): string | null {
  if (amount == null || amount < 10) return null;
  return `$${Math.round(amount).toLocaleString('en-US')}/mo`;
}

/**
 * Sum revenue at risk across an array of hallucinations.
 */
export function sumRevenueAtRisk(
  hallucinations: Array<{ severity: string; category?: string | null }>,
  avgCustomerValue = DEFAULT_AVG_CUSTOMER_VALUE,
  monthlyCovers = DEFAULT_MONTHLY_COVERS,
): number {
  return hallucinations.reduce(
    (sum, h) => sum + estimateRevenueAtRisk(h.severity, h.category, avgCustomerValue, monthlyCovers),
    0,
  );
}
