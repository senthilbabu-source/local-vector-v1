/**
 * GET /api/team/members — Sprint 111
 *
 * Returns all members of the authenticated user's org.
 * No plan gate on GET — every plan can see their own members.
 */

import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getOrgMembers } from '@/lib/membership/membership-service';
import { getMaxSeats, canAddMember } from '@/lib/plan-enforcer';
import * as Sentry from '@sentry/nextjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  try {
    // Use service role client to JOIN users table
    const supabase = createServiceRoleClient();

    const members = await getOrgMembers(supabase, ctx.orgId);

    // Read org for plan + seat_count
    const { data: org } = await supabase
      .from('organizations')
      .select('plan, seat_count')
      .eq('id', ctx.orgId)
      .single();

    const planTier = org?.plan ?? 'trial';
    const seatCount = org?.seat_count ?? members.length;
    const maxSeats = getMaxSeats(planTier);
    const canAdd = canAddMember(planTier, seatCount);

    return NextResponse.json({
      members,
      seat_count: seatCount,
      max_seats: maxSeats,
      can_add: canAdd,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'team-members', sprint: '111' } });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
