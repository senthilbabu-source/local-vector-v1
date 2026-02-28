// ---------------------------------------------------------------------------
// lib/stripe/get-monthly-cost-per-seat.ts — Fetch per-seat cost from Stripe
//
// Sprint C (H6): Fetches the monthly per-seat cost from a Stripe Price.
// Returns dollars (not cents) as a number, or null if unavailable.
//
// Graceful fallback: returns null on any error — never crashes seat actions.
// ---------------------------------------------------------------------------

import Stripe from 'stripe';
import * as Sentry from '@sentry/nextjs';

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return _stripe;
}

/**
 * Fetches the monthly per-seat cost from a Stripe Price object.
 *
 * @param stripePriceId - The Stripe Price ID (e.g., "price_1ABC..."). Null for custom pricing.
 * @returns Dollar amount per seat per month, or null if unavailable.
 */
export async function getMonthlyCostPerSeat(stripePriceId: string | null): Promise<number | null> {
  if (!stripePriceId) return null;

  if (!process.env.STRIPE_SECRET_KEY) {
    return null;
  }

  try {
    const stripe = getStripe();
    const price = await stripe.prices.retrieve(stripePriceId);

    if (!price.unit_amount) return null; // metered or variable pricing

    if (price.recurring?.interval === 'year') {
      // Convert annual price to monthly equivalent
      return Math.round((price.unit_amount / 12) / 100);
    }

    // Monthly price: convert from cents to dollars
    return price.unit_amount / 100;
  } catch (err) {
    Sentry.captureException(err, {
      tags: { function: 'getMonthlyCostPerSeat', sprint: 'C' },
      extra: { stripePriceId },
    });
    return null;
  }
}
