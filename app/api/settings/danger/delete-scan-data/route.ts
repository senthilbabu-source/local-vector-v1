// ---------------------------------------------------------------------------
// DELETE /api/settings/danger/delete-scan-data — Sprint 121: Danger Zone
// OWNER ONLY. Service role client for destructive DELETE.
// AI_RULES §59: Auth check first. Exact confirmation text required.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { roleSatisfies } from '@/lib/auth/org-roles';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function DELETE(request: NextRequest) {
  const ctx = await getSafeAuthContext();
  if (!ctx || !ctx.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!roleSatisfies(ctx.role, 'owner')) {
    return NextResponse.json({ error: 'owner_required' }, { status: 403 });
  }

  let body: { confirmation?: string };
  try {
    body = await request.json();
  } catch (_err) {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.confirmation) {
    return NextResponse.json({ error: 'confirmation_required' }, { status: 400 });
  }

  if (body.confirmation !== 'DELETE') {
    return NextResponse.json({ error: 'wrong_confirmation' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  try {
    // Delete in order respecting foreign key constraints
    await supabase
      .from('correction_follow_ups' as never)
      .delete()
      .eq('org_id' as never, ctx.orgId as never);

    await supabase
      .from('ai_hallucinations')
      .delete()
      .eq('org_id', ctx.orgId);

    await supabase
      .from('sov_evaluations')
      .delete()
      .eq('org_id', ctx.orgId);

    return NextResponse.json({
      ok: true,
      deleted_at: new Date().toISOString(),
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { sprint: '121', route: 'delete-scan-data' } });
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }
}
