// ---------------------------------------------------------------------------
// lib/plan-enforcer.ts — Plan-tier feature gating
//
// Pure functions with no side effects. Import and call these before rendering
// premium UI or executing paid-tier operations. Mirrors the plan_tier enum
// in supabase/prod_schema.sql: 'trial' | 'starter' | 'growth' | 'agency'.
//
// AI_RULES §5: Always check feature availability via PlanGate logic before
// rendering premium features (Competitor Intercept, Daily Audits).
// ---------------------------------------------------------------------------

/** Valid plan tiers — mirrors the plan_tier ENUM in prod_schema.sql. */
export type PlanTier = 'trial' | 'starter' | 'growth' | 'agency';

/**
 * Daily automated AI audits (Phase 9 cron) require Growth or Agency plan.
 * Starter/Trial orgs receive weekly audits only.
 */
export function canRunDailyAudit(plan: PlanTier): boolean {
  return plan === 'growth' || plan === 'agency';
}

/**
 * Share of Voice on-demand evaluation requires Growth or Agency plan.
 * Starter/Trial users see an upgrade gate on the SOV page.
 */
export function canRunSovEvaluation(plan: PlanTier): boolean {
  return plan === 'growth' || plan === 'agency';
}

/**
 * Competitor intercept analysis (Phase 3) requires Growth or Agency plan.
 * Starter/Trial users see a locked "Upgrade" overlay on the Compete page.
 */
export function canRunCompetitorIntercept(plan: PlanTier): boolean {
  return plan === 'growth' || plan === 'agency';
}

/**
 * Maximum number of locations an org on this plan may create.
 * Agency tier allows up to 10 locations for multi-location restaurant groups.
 */
export function maxLocations(plan: PlanTier): number {
  const limits: Record<PlanTier, number> = {
    trial: 1,
    starter: 1,
    growth: 1,
    agency: 10,
  };
  return limits[plan];
}

/**
 * Maximum number of competitors an org on this plan may track.
 * Trial and Starter tiers cannot use Competitor Intercept at all.
 * Growth allows up to 3 competitors; Agency allows up to 10.
 *
 * Doc 05, Section 5 — Greed Engine API Contract.
 */
export function maxCompetitors(plan: PlanTier): number {
  const limits: Record<PlanTier, number> = {
    trial:   0,
    starter: 0,
    growth:  3,
    agency:  10,
  };
  return limits[plan];
}

/**
 * Autopilot Engine — AI-generated content draft creation (Doc 19).
 * Generates draft pages/posts when a competitor gap or occasion is detected.
 * Requires human approval before publish. Growth or Agency plan required.
 */
export function canRunAutopilot(plan: PlanTier): boolean {
  return plan === 'growth' || plan === 'agency';
}

/**
 * Content Grader — site-wide AEO page audit (Doc 17).
 * Scores pages on readability, answer-first structure, and schema completeness.
 * Growth or Agency plan required.
 */
export function canRunPageAudit(plan: PlanTier): boolean {
  return plan === 'growth' || plan === 'agency';
}

/**
 * Occasion Engine — seasonal content scheduler (Doc 16).
 * Triggers content drafts N days before holidays and recurring events.
 * Growth or Agency plan required.
 */
export function canRunOccasionEngine(plan: PlanTier): boolean {
  return plan === 'growth' || plan === 'agency';
}

/**
 * Google Business Profile OAuth connection (Doc GBP Onboarding RFC Rev 2).
 * Allows the org to link its GBP account for profile sync and post publishing.
 * Available on Starter, Growth, and Agency plans (not Trial).
 */
export function canConnectGBP(plan: PlanTier): boolean {
  return plan === 'starter' || plan === 'growth' || plan === 'agency';
}
