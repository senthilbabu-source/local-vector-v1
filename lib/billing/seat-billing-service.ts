/**
 * Seat Billing Service — Sprint 113
 *
 * Stripe seat metering: getSeatState, syncSeatsToStripe, syncSeatsFromStripe.
 * Caller passes Supabase client. Stripe client initialized lazily.
 *
 * Error handling: syncSeatsToStripe NEVER throws. Billing failures
 * must not block membership operations.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { SeatState } from './types';
import { SEAT_PRICE_CENTS } from './types';
import { SEAT_LIMITS } from '@/lib/membership/types';
import { logSeatSync } from './activity-log-service';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Lazy Stripe init — same version as existing webhook handler
// ---------------------------------------------------------------------------

let _stripe: import('stripe').default | null = null;

async function getStripe(): Promise<import('stripe').default> {
  if (!_stripe) {
    const Stripe = (await import('stripe')).default;
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return _stripe;
}

// ---------------------------------------------------------------------------
// getSeatState
// ---------------------------------------------------------------------------

export async function getSeatState(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<SeatState> {
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('plan, seat_count, stripe_subscription_id, stripe_subscription_item_id')
    .eq('id', orgId)
    .single();

  if (orgError || !org) {
    throw new Error(`Organization not found: ${orgId}`);
  }

  const planTier = org.plan ?? 'trial';
  const currentSeatCount = org.seat_count ?? 1;
  const maxSeats = SEAT_LIMITS[planTier] ?? 1;
  const perSeatPriceCents = SEAT_PRICE_CENTS[planTier] ?? 0;
  const monthlySeatCostCents = Math.max(0, currentSeatCount - 1) * perSeatPriceCents;

  const usagePercent = maxSeats !== null && maxSeats > 0
    ? Math.round((currentSeatCount / maxSeats) * 100)
    : 0;

  // No Stripe subscription → return local-only state
  if (!org.stripe_subscription_id) {
    return {
      org_id: orgId,
      plan_tier: planTier,
      current_seat_count: currentSeatCount,
      max_seats: maxSeats,
      usage_percent: usagePercent,
      stripe_subscription_id: null,
      stripe_quantity: null,
      in_sync: true,
      monthly_seat_cost_cents: monthlySeatCostCents,
      per_seat_price_cents: perSeatPriceCents,
    };
  }

  // Fetch Stripe subscription for current quantity
  let stripeQuantity: number | null = null;
  try {
    const stripe = await getStripe();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const subscription = await stripe.subscriptions.retrieve(
      org.stripe_subscription_id,
      { expand: ['items'] }
    );
    clearTimeout(timeout);

    const itemId = org.stripe_subscription_item_id;
    const item = itemId
      ? subscription.items.data.find((i) => i.id === itemId)
      : subscription.items.data[0];

    stripeQuantity = item?.quantity ?? null;
  } catch (err) {
    // Stripe timeout or error — return conservative state
    Sentry.captureException(err, { tags: { service: 'seat-billing', action: 'getSeatState', sprint: '113' } });
  }

  return {
    org_id: orgId,
    plan_tier: planTier,
    current_seat_count: currentSeatCount,
    max_seats: maxSeats,
    usage_percent: usagePercent,
    stripe_subscription_id: org.stripe_subscription_id,
    stripe_quantity: stripeQuantity,
    in_sync: stripeQuantity === null || stripeQuantity === currentSeatCount,
    monthly_seat_cost_cents: monthlySeatCostCents,
    per_seat_price_cents: perSeatPriceCents,
  };
}

// ---------------------------------------------------------------------------
// syncSeatsToStripe — NEVER throws
// ---------------------------------------------------------------------------

export async function syncSeatsToStripe(
  supabase: SupabaseClient<Database>,
  orgId: string,
  newSeatCount: number
): Promise<{ success: boolean; stripe_quantity: number | null }> {
  try {
    // Fetch org
    const { data: org } = await supabase
      .from('organizations')
      .select('plan, stripe_subscription_id, stripe_subscription_item_id')
      .eq('id', orgId)
      .single();

    if (!org?.stripe_subscription_id) {
      console.log('[seat-billing] no_stripe_subscription for org=%s — skipping sync', orgId);
      return { success: true, stripe_quantity: null };
    }

    const stripe = await getStripe();
    let itemId = org.stripe_subscription_item_id;

    // Lazy-populate item ID if missing
    if (!itemId) {
      const subscription = await stripe.subscriptions.retrieve(
        org.stripe_subscription_id,
        { expand: ['items'] }
      );

      if (subscription.items.data.length > 1) {
        console.warn(
          '[seat-billing] subscription %s has %d items — using first item. Consider setting stripe_subscription_item_id explicitly.',
          org.stripe_subscription_id,
          subscription.items.data.length
        );
      }

      itemId = subscription.items.data[0]?.id ?? null;

      if (itemId) {
        await supabase
          .from('organizations')
          .update({ stripe_subscription_item_id: itemId })
          .eq('id', orgId);
      }
    }

    if (!itemId) {
      const msg = `No subscription item found for subscription ${org.stripe_subscription_id}`;
      console.error('[seat-billing]', msg);
      void logSeatSync(supabase, {
        orgId,
        previousCount: null,
        newCount: newSeatCount,
        success: false,
        source: 'app',
        error: msg,
      });
      return { success: false, stripe_quantity: null };
    }

    // Get previous quantity before update
    let previousQuantity: number | null = null;
    try {
      const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id, { expand: ['items'] });
      const existingItem = sub.items.data.find((i) => i.id === itemId);
      previousQuantity = existingItem?.quantity ?? null;
    } catch (err) {
      Sentry.captureException(err, { tags: { service: 'seat-billing', action: 'fetchPreviousQuantity', sprint: '113' } });
    }

    // Update Stripe
    await stripe.subscriptions.update(org.stripe_subscription_id, {
      items: [{ id: itemId, quantity: newSeatCount }],
      proration_behavior: 'create_prorations',
    });

    // Log success
    void logSeatSync(supabase, {
      orgId,
      previousCount: previousQuantity,
      newCount: newSeatCount,
      success: true,
      source: 'app',
    });

    // Check for overage
    const planTier = org.plan ?? 'trial';
    const maxSeats = SEAT_LIMITS[planTier] ?? 1;
    if (maxSeats !== null && newSeatCount > maxSeats) {
      await supabase
        .from('organizations')
        .update({ seat_overage_flagged: true })
        .eq('id', orgId);
      console.warn('[seat-billing] seat overage flagged for org=%s (%d > %d)', orgId, newSeatCount, maxSeats);
    }

    return { success: true, stripe_quantity: newSeatCount };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[seat-billing] syncSeatsToStripe failed for org=%s:', orgId, msg);
    Sentry.captureException(err, { tags: { service: 'seat-billing', action: 'syncSeatsToStripe', sprint: '113' } });

    void logSeatSync(supabase, {
      orgId,
      previousCount: null,
      newCount: newSeatCount,
      success: false,
      source: 'app',
      error: msg,
    });

    return { success: false, stripe_quantity: null };
  }
}

// ---------------------------------------------------------------------------
// syncSeatsFromStripe — called by webhook
// ---------------------------------------------------------------------------

export async function syncSeatsFromStripe(
  supabase: SupabaseClient<Database>,
  orgId: string,
  stripeQuantity: number
): Promise<void> {
  const { data: org } = await supabase
    .from('organizations')
    .select('seat_count')
    .eq('id', orgId)
    .single();

  if (!org) return;

  const currentCount = org.seat_count ?? 1;

  if (stripeQuantity === currentCount) return;

  await supabase
    .from('organizations')
    .update({ seat_count: stripeQuantity })
    .eq('id', orgId);

  void logSeatSync(supabase, {
    orgId,
    previousCount: currentCount,
    newCount: stripeQuantity,
    success: true,
    source: 'stripe_webhook',
  });

  console.log(
    '[seat-billing] syncSeatsFromStripe: org=%s previous=%d new=%d',
    orgId, currentCount, stripeQuantity
  );
}
