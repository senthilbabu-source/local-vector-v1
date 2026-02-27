// ---------------------------------------------------------------------------
// lib/stripe/seat-plans.ts — Seat plan configuration
//
// Single source of truth for seat plan definitions.
// Never hardcode seat counts or price IDs outside this file.
//
// Seat model: Per-seat licensed for Agency tier.
//   Agency = $X/seat/month. Stripe subscription quantity = seat count.
//   Starter/Growth = fixed single-user plans (quantity always 1).
//
// Sprint 99 — Seat-Based Billing
// ---------------------------------------------------------------------------

export interface SeatPlanConfig {
  /** Stripe Price ID for this plan's per-seat charge */
  stripePriceId: string;
  /** Default seat limit when org upgrades to this plan */
  defaultSeats: number;
  /** Minimum seats (cannot go below this) */
  minSeats: number;
  /** Maximum seats (null = unlimited) */
  maxSeats: number | null;
  /** Whether this plan supports multiple seats at all */
  multiUserEnabled: boolean;
}

export const SEAT_PLANS: Record<string, SeatPlanConfig> = {
  trial: {
    stripePriceId: '',
    defaultSeats: 1,
    minSeats: 1,
    maxSeats: 1,
    multiUserEnabled: false,
  },
  starter: {
    stripePriceId: process.env.STRIPE_PRICE_ID_STARTER ?? '',
    defaultSeats: 1,
    minSeats: 1,
    maxSeats: 1,
    multiUserEnabled: false,
  },
  growth: {
    stripePriceId: process.env.STRIPE_PRICE_ID_GROWTH ?? '',
    defaultSeats: 1,
    minSeats: 1,
    maxSeats: 1,
    multiUserEnabled: false,
  },
  agency: {
    stripePriceId: process.env.STRIPE_PRICE_ID_AGENCY_SEAT ?? '',
    defaultSeats: 5,
    minSeats: 1,
    maxSeats: null,
    multiUserEnabled: true,
  },
};

/**
 * Returns the seat limit for a given plan.
 * For non-Agency plans: always 1.
 * For Agency: reads from the subscription quantity (passed in).
 */
export function getSeatLimit(
  plan: string,
  subscriptionQuantity?: number
): number {
  const config = SEAT_PLANS[plan];
  if (!config) return 1;
  if (!config.multiUserEnabled) return 1;
  return subscriptionQuantity ?? config.defaultSeats;
}

/**
 * Returns true if the given plan supports multi-user.
 */
export function isMultiUserPlan(plan: string): boolean {
  return SEAT_PLANS[plan]?.multiUserEnabled ?? false;
}
