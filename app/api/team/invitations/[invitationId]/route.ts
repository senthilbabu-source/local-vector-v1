/**
 * DELETE /api/team/invitations/[invitationId] — Sprint 112
 *
 * Revokes a pending invitation.
 * Agency plan, owner/admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { roleSatisfies } from '@/lib/auth/org-roles';
import { canManageTeamSeats } from '@/lib/plan-enforcer';
import { revokeInvitation } from '@/lib/invitations/invitation-service';
import { MembershipError } from '@/lib/membership/membership-service';
import type { PlanTier } from '@/lib/plan-enforcer';
import * as Sentry from '@sentry/nextjs';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const planTier = (ctx.plan ?? 'trial') as PlanTier;
  if (!canManageTeamSeats(planTier)) {
    return NextResponse.json({ error: 'plan_upgrade_required' }, { status: 403 });
  }

  if (!roleSatisfies(ctx.role, 'admin')) {
    return NextResponse.json({ error: 'insufficient_role' }, { status: 403 });
  }

  const { invitationId } = await params;

  try {
    const supabase = createServiceRoleClient();
    await revokeInvitation(supabase, invitationId, ctx.orgId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof MembershipError) {
      const statusMap: Record<string, number> = {
        invitation_not_found: 404,
        invitation_not_revocable: 409,
      };
      return NextResponse.json(
        { error: err.code },
        { status: statusMap[err.code] ?? 500 }
      );
    }
    Sentry.captureException(err, { tags: { route: 'team-invitations-delete', sprint: '112' } });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
