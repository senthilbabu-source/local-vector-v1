/**
 * GET /api/team/activity — Sprint 113
 *
 * Paginated audit log for the org. Owner and admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { roleSatisfies } from '@/lib/auth/org-roles';
import { getActivityLog } from '@/lib/billing/activity-log-service';
import * as Sentry from '@sentry/nextjs';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  if (!roleSatisfies(ctx.role, 'admin')) {
    return NextResponse.json({ error: 'insufficient_role' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') ?? '20', 10) || 20));

  try {
    const supabase = createServiceRoleClient();
    const result = await getActivityLog(supabase, ctx.orgId, { page, per_page: perPage });
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'team-activity', sprint: '113' } });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
