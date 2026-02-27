// ---------------------------------------------------------------------------
// lib/stripe/seat-manager.ts — All Stripe seat quantity operations
//
// Design principles:
// 1. DB-first: always update organizations.seat_limit AFTER Stripe confirms.
//    If Stripe fails, the DB is not updated — user retries.
// 2. Idempotent: calling updateSeatQuantity(5) when already at 5 is a no-op.
// 3. Error-typed: all functions return typed error codes, never throw to callers.
// 4. Atomic seat check: checkSeatAvailability reads member count + seat_limit
//    in a single DB query to avoid TOCTOU race conditions.
//
// Sprint 99 — Seat-Based Billing
// ---------------------------------------------------------------------------

import Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { SEAT_PLANS, isMultiUserPlan } from './seat-plans';

// ── Lazy Stripe client ────────────────────────────────────────────────────
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return _stripe;
}

// ── Error types ───────────────────────────────────────────────────────────

export type SeatManagerError =
  | 'no_subscription'
  | 'not_agency_plan'
  | 'seat_limit_reached'
  | 'below_minimum_seats'
  | 'stripe_error'
  | 'db_error'
  | 'subscription_not_active';

export interface SeatAvailability {
  canAdd: boolean;
  currentMembers: number;
  seatLimit: number;
  seatsRemaining: number;
  error?: SeatManagerError;
}

// ── checkSeatAvailability ─────────────────────────────────────────────────

/**
 * Checks whether the org can add another member.
 * Atomic: reads member count and seat_limit in one round-trip.
 * Does NOT call Stripe — DB only.
 */
export async function checkSeatAvailability(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<SeatAvailability> {
  // Read org seat_limit
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('seat_limit, plan')
    .eq('id', orgId)
    .single();

  if (orgError || !org) {
    return {
      canAdd: false,
      currentMembers: 0,
      seatLimit: 1,
      seatsRemaining: 0,
      error: 'db_error',
    };
  }

  // Read member count
  const { count: memberCount, error: countError } = await supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId);

  if (countError) {
    return {
      canAdd: false,
      currentMembers: 0,
      seatLimit: org.seat_limit ?? 1,
      seatsRemaining: 0,
      error: 'db_error',
    };
  }

  const current = memberCount ?? 0;
  const limit = org.seat_limit ?? 1;
  const remaining = Math.max(0, limit - current);

  if (current >= limit) {
    return {
      canAdd: false,
      currentMembers: current,
      seatLimit: limit,
      seatsRemaining: 0,
      error: 'seat_limit_reached',
    };
  }

  return {
    canAdd: true,
    currentMembers: current,
    seatLimit: limit,
    seatsRemaining: remaining,
  };
}

// ── updateSeatQuantity ────────────────────────────────────────────────────

/**
 * Updates the Stripe subscription quantity to newSeatCount.
 * Handles proration automatically.
 *
 * @param newSeatCount — the TOTAL desired seat count (not a delta)
 */
export async function updateSeatQuantity(
  supabase: SupabaseClient<Database>,
  orgId: string,
  newSeatCount: number
): Promise<{
  success: boolean;
  error?: SeatManagerError;
  previousQuantity?: number;
  newQuantity?: number;
  stripeSubscriptionId?: string;
}> {
  // 1. Load org
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('stripe_subscription_id, plan, plan_status, seat_limit')
    .eq('id', orgId)
    .single();

  if (orgError || !org) {
    return { success: false, error: 'db_error' };
  }

  // 2. Validate plan supports multi-user
  if (!isMultiUserPlan(org.plan ?? '')) {
    return { success: false, error: 'not_agency_plan' };
  }

  // 3. Check subscription exists
  if (!org.stripe_subscription_id) {
    return { success: false, error: 'no_subscription' };
  }

  // 4. Check subscription is active/trialing
  const activeStatuses = ['active', 'trialing'];
  if (!activeStatuses.includes(org.plan_status ?? '')) {
    return { success: false, error: 'subscription_not_active' };
  }

  // 5. Check minimum seats
  const planConfig = SEAT_PLANS[org.plan ?? ''];
  if (planConfig && newSeatCount < planConfig.minSeats) {
    return { success: false, error: 'below_minimum_seats' };
  }

  // 6. No-op if quantity unchanged
  const currentQuantity = org.seat_limit ?? 1;
  if (currentQuantity === newSeatCount) {
    return {
      success: true,
      previousQuantity: currentQuantity,
      newQuantity: newSeatCount,
      stripeSubscriptionId: org.stripe_subscription_id,
    };
  }

  // 7. Call Stripe — use top-level quantity (works for single-item subscriptions)
  try {
    await getStripe().subscriptions.update(org.stripe_subscription_id, {
      quantity: newSeatCount,
      proration_behavior: 'create_prorations',
    });
  } catch (err) {
    console.error(
      '[seat-manager] Stripe subscription update failed:',
      err instanceof Error ? err.message : String(err)
    );
    return { success: false, error: 'stripe_error' };
  }

  // 8. Update DB after Stripe success
  const { error: dbError } = await supabase
    .from('organizations')
    .update({
      seat_limit: newSeatCount,
      seats_updated_at: new Date().toISOString(),
    })
    .eq('id', orgId);

  if (dbError) {
    console.error('[seat-manager] DB update failed after Stripe success:', dbError.message);
    return { success: false, error: 'db_error' };
  }

  return {
    success: true,
    previousQuantity: currentQuantity,
    newQuantity: newSeatCount,
    stripeSubscriptionId: org.stripe_subscription_id,
  };
}

// ── syncSeatLimitFromWebhook ──────────────────────────────────────────────

/**
 * Syncs seat_limit from Stripe to DB.
 * Called by the webhook handler when subscription quantity changes externally.
 * Uses service role client — called from webhook handler.
 */
export async function syncSeatLimitFromWebhook(
  serviceRoleClient: SupabaseClient<Database>,
  stripeCustomerId: string,
  newQuantity: number,
  subscriptionStatus: string
): Promise<{ success: boolean; orgId?: string; error?: string }> {
  // Canceled subscriptions → seat_limit = 1
  const effectiveLimit =
    subscriptionStatus === 'canceled' || subscriptionStatus === 'unpaid'
      ? 1
      : newQuantity;

  const { data: org, error: lookupError } = await serviceRoleClient
    .from('organizations')
    .select('id')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();

  if (lookupError) {
    return { success: false, error: `Org lookup failed: ${lookupError.message}` };
  }

  if (!org) {
    return { success: false, error: `No org found for stripe_customer_id: ${stripeCustomerId}` };
  }

  const { error: updateError } = await serviceRoleClient
    .from('organizations')
    .update({
      seat_limit: effectiveLimit,
      seats_updated_at: new Date().toISOString(),
    })
    .eq('id', org.id);

  if (updateError) {
    return { success: false, orgId: org.id, error: `DB update failed: ${updateError.message}` };
  }

  return { success: true, orgId: org.id };
}

// ── calculateSeatOverage ──────────────────────────────────────────────────

/**
 * Calculates how many members exceed the seat limit.
 * Does NOT remove members — returns overage count for the caller.
 */
export async function calculateSeatOverage(
  serviceRoleClient: SupabaseClient<Database>,
  orgId: string
): Promise<{ overage: number; currentMembers: number; seatLimit: number }> {
  const { data: org } = await serviceRoleClient
    .from('organizations')
    .select('seat_limit')
    .eq('id', orgId)
    .single();

  const seatLimit = org?.seat_limit ?? 1;

  const { count: memberCount } = await serviceRoleClient
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId);

  const current = memberCount ?? 0;
  const overage = Math.max(0, current - seatLimit);

  return { overage, currentMembers: current, seatLimit };
}
