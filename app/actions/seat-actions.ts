'use server';

// ---------------------------------------------------------------------------
// Seat Management Server Actions — Sprint 99
//
// All actions derive orgId from the authenticated session (AI_RULES §18).
// Owner only. Agency plan only.
// ---------------------------------------------------------------------------

import { revalidatePath } from 'next/cache';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { updateSeatQuantity } from '@/lib/stripe/seat-manager';
import { isMultiUserPlan, SEAT_PLANS } from '@/lib/stripe/seat-plans';
import { getMonthlyCostPerSeat } from '@/lib/stripe/get-monthly-cost-per-seat';
import type { SeatManagerError } from '@/lib/stripe/seat-manager';

// ---------------------------------------------------------------------------
// addSeat
// ---------------------------------------------------------------------------

export async function addSeat(): Promise<{
  success: boolean;
  error?: SeatManagerError | string;
  newSeatLimit?: number;
  prorationDescription?: string;
}> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  // Owner only
  if (ctx.role !== 'owner') {
    return { success: false, error: 'Only the org owner can manage seats' };
  }

  // Agency plan only
  if (!isMultiUserPlan(ctx.plan ?? '')) {
    return { success: false, error: 'Seat management requires the agency plan' };
  }

  const supabase = await createClient();

  // Load current seat limit
  const { data: org } = await supabase
    .from('organizations')
    .select('seat_limit, plan')
    .eq('id', ctx.orgId)
    .single();

  if (!org) return { success: false, error: 'Organization not found' };

  const currentLimit = org.seat_limit ?? 1;
  const newLimit = currentLimit + 1;

  const result = await updateSeatQuantity(supabase, ctx.orgId, newLimit);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath('/dashboard/billing');
  revalidatePath('/dashboard/settings/team');

  return {
    success: true,
    newSeatLimit: result.newQuantity,
    prorationDescription: `Seat added. Prorated charges apply for the remainder of the billing period.`,
  };
}

// ---------------------------------------------------------------------------
// removeSeat
// ---------------------------------------------------------------------------

export async function removeSeat(): Promise<{
  success: boolean;
  error?: SeatManagerError | 'would_create_overage' | 'below_minimum_seats' | string;
  newSeatLimit?: number;
}> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  // Owner only
  if (ctx.role !== 'owner') {
    return { success: false, error: 'Only the org owner can manage seats' };
  }

  // Agency plan only
  if (!isMultiUserPlan(ctx.plan ?? '')) {
    return { success: false, error: 'Seat management requires the agency plan' };
  }

  const supabase = await createClient();

  // Load current state
  const { data: org } = await supabase
    .from('organizations')
    .select('seat_limit, plan')
    .eq('id', ctx.orgId)
    .single();

  if (!org) return { success: false, error: 'Organization not found' };

  const currentLimit = org.seat_limit ?? 1;
  const newLimit = currentLimit - 1;

  // Check minimum seats
  const planConfig = SEAT_PLANS[org.plan ?? ''];
  if (planConfig && newLimit < planConfig.minSeats) {
    return { success: false, error: 'below_minimum_seats' };
  }

  // Check would_create_overage
  const { count: memberCount } = await supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', ctx.orgId);

  if ((memberCount ?? 0) >= newLimit) {
    return { success: false, error: 'would_create_overage' };
  }

  const result = await updateSeatQuantity(supabase, ctx.orgId, newLimit);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath('/dashboard/billing');
  revalidatePath('/dashboard/settings/team');

  return {
    success: true,
    newSeatLimit: result.newQuantity,
  };
}

// ---------------------------------------------------------------------------
// getSeatSummary
// ---------------------------------------------------------------------------

export async function getSeatSummary(): Promise<{
  seatLimit: number;
  currentMembers: number;
  seatsRemaining: number;
  seatOverage: number;
  plan: string;
  subscriptionStatus: string | null;
  monthlyCostPerSeat: number | null;
  isAgencyPlan: boolean;
}> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return {
      seatLimit: 1,
      currentMembers: 0,
      seatsRemaining: 0,
      seatOverage: 0,
      plan: 'trial',
      subscriptionStatus: null,
      monthlyCostPerSeat: null,
      isAgencyPlan: false,
    };
  }

  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('seat_limit, seat_overage_count, plan, plan_status, stripe_subscription_id')
    .eq('id', ctx.orgId)
    .single();

  const { count: memberCount } = await supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', ctx.orgId);

  const plan = org?.plan ?? 'trial';
  const seatLimit = org?.seat_limit ?? 1;
  const current = memberCount ?? 0;
  const isAgency = isMultiUserPlan(plan);

  return {
    seatLimit,
    currentMembers: current,
    seatsRemaining: Math.max(0, seatLimit - current),
    seatOverage: org?.seat_overage_count ?? 0,
    plan,
    subscriptionStatus: org?.plan_status ?? null,
    monthlyCostPerSeat: await getMonthlyCostPerSeat(SEAT_PLANS[plan]?.stripePriceId ?? null),
    isAgencyPlan: isAgency,
  };
}
