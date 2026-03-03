// ---------------------------------------------------------------------------
// lib/stripe/plan-tier-resolver.ts — Resolve Stripe price ID → plan tier
//
// Pure function mapping a Stripe subscription price ID to the internal
// plan_tier enum. Used by the webhook handler to sync plan changes when
// users upgrade/downgrade via Stripe Billing Portal.
//
// Env vars:
//   STRIPE_PRICE_ID_STARTER     → 'starter'
//   STRIPE_PRICE_ID_GROWTH      → 'growth'
//   STRIPE_PRICE_ID_AGENCY_SEAT → 'agency'
// ---------------------------------------------------------------------------

import type { PlanTier } from '@/lib/plan-enforcer';

/**
 * Maps a Stripe price ID to the internal plan tier.
 * Returns null if the price ID doesn't match any known plan.
 *
 * Pure function — reads env vars but has no side effects.
 */
export function resolvePlanTierFromPriceId(
  priceId: string | null | undefined,
): PlanTier | null {
  if (!priceId) return null;

  const mapping: Record<string, PlanTier> = {
    ...(process.env.STRIPE_PRICE_ID_STARTER && {
      [process.env.STRIPE_PRICE_ID_STARTER]: 'starter' as const,
    }),
    ...(process.env.STRIPE_PRICE_ID_GROWTH && {
      [process.env.STRIPE_PRICE_ID_GROWTH]: 'growth' as const,
    }),
    ...(process.env.STRIPE_PRICE_ID_AGENCY_SEAT && {
      [process.env.STRIPE_PRICE_ID_AGENCY_SEAT]: 'agency' as const,
    }),
  };

  return mapping[priceId] ?? null;
}
