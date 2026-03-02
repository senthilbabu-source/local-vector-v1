/**
 * POST /api/billing/seats/sync — Sprint 113
 *
 * Force-syncs seat count to Stripe. Recovery tool for owners.
 * Auth: session required. Owner only. Agency plan only.
 */

import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { roleSatisfies } from '@/lib/auth/org-roles';
import { canManageTeamSeats } from '@/lib/plan-enforcer';
import type { PlanTier } from '@/lib/plan-enforcer';
import { syncSeatsToStripe } from '@/lib/billing/seat-billing-service';
import * as Sentry from '@sentry/nextjs';

export const dynamic = 'force-dynamic';

export async function POST() {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  if (!roleSatisfies(ctx.role, 'owner')) {
    return NextResponse.json({ error: 'not_owner' }, { status: 403 });
  }

  const planTier = (ctx.plan ?? 'trial') as PlanTier;
  if (!canManageTeamSeats(planTier)) {
    return NextResponse.json({ error: 'plan_upgrade_required' }, { status: 403 });
  }

  try {
    const supabase = createServiceRoleClient();

    // Fetch current seat count from DB
    const { data: org } = await supabase
      .from('organizations')
      .select('seat_count')
      .eq('id', ctx.orgId)
      .single();

    const seatCount = org?.seat_count ?? 1;

    const result = await syncSeatsToStripe(supabase, ctx.orgId, seatCount);

    return NextResponse.json({
      ok: true,
      previous_stripe_quantity: null,
      new_quantity: seatCount,
      success: result.success,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'billing-seats-sync', sprint: '113' } });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
