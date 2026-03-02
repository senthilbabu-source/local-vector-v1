/**
 * DELETE /api/team/members/[memberId] — Sprint 111
 *
 * Removes a member from the org.
 *
 * Guards (in order):
 * 1. Caller authenticated → 401
 * 2. Caller is owner or admin → 403 'insufficient_role'
 * 3. Member exists in caller's org → 404 'member_not_found'
 * 4. Target is not an owner → 403 'cannot_remove_owner'
 * 5. Caller is not removing themselves as sole owner → 403 'last_owner'
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { roleSatisfies } from '@/lib/auth/org-roles';
import { removeMember, MembershipError } from '@/lib/membership/membership-service';
import * as Sentry from '@sentry/nextjs';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // Guard 2: Caller must be owner or admin
  if (!roleSatisfies(ctx.role, 'admin')) {
    return NextResponse.json({ error: 'insufficient_role' }, { status: 403 });
  }

  const { memberId } = await params;

  try {
    const supabase = createServiceRoleClient();

    // Guard 5: Check last_owner case — if target is removing themselves
    // and they are the sole owner
    const { data: targetMember } = await supabase
      .from('memberships')
      .select('id, role, user_id, org_id')
      .eq('id', memberId)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (!targetMember) {
      return NextResponse.json({ error: 'member_not_found' }, { status: 404 });
    }

    // Check if caller is trying to remove themselves and they're the last owner
    if (targetMember.role === 'owner') {
      return NextResponse.json({ error: 'cannot_remove_owner' }, { status: 403 });
    }

    // Delegate to service for the actual delete
    await removeMember(supabase, memberId, ctx.orgId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof MembershipError) {
      const statusMap: Record<string, number> = {
        member_not_found: 404,
        cannot_remove_owner: 403,
        last_owner: 403,
      };
      return NextResponse.json(
        { error: err.code },
        { status: statusMap[err.code] ?? 500 }
      );
    }
    Sentry.captureException(err, { tags: { route: 'team-members-delete', sprint: '111' } });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
