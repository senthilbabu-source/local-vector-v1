// ---------------------------------------------------------------------------
// lib/credits/credit-limits.ts — Sprint D (N1): Plan-based credit limits
//
// Monthly credit limits per plan. One credit = one user-initiated LLM API call.
// Automated cron operations do NOT consume credits.
//
// Source: lib/plan-enforcer.ts plan hierarchy.
// ---------------------------------------------------------------------------

/**
 * Monthly credit limits per plan.
 */
export const PLAN_CREDIT_LIMITS: Record<string, number> = {
  trial: 25,
  starter: 100,
  growth: 500,
  agency: 2000,
};

/**
 * Returns the credit limit for a given plan.
 * Falls back to trial limit for unknown/null plans (defensive).
 */
export function getCreditLimit(plan: string | null | undefined): number {
  return PLAN_CREDIT_LIMITS[plan ?? 'trial'] ?? PLAN_CREDIT_LIMITS.trial;
}

/**
 * Returns UTC midnight on the first day of the next calendar month.
 * Used for computing reset_date on credit row creation.
 */
export function getNextResetDate(from: Date = new Date()): Date {
  return new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
}
