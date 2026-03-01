// ---------------------------------------------------------------------------
// POST /api/review-engine/sync — On-demand review sync
//
// Sprint 107: Authenticated endpoint for manual review sync from dashboard.
// Plan gate: Growth+ only.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { planSatisfies, type PlanTier } from '@/lib/plan-enforcer';
import { runReviewSync } from '@/lib/review-engine/review-sync-service';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const ctx = await getSafeAuthContext();
    if (!ctx || !ctx.orgId) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Authentication required' },
        { status: 401 },
      );
    }

    const supabase = await createClient();
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('plan')
      .eq('id', ctx.orgId)
      .single();

    const plan = (orgRow?.plan ?? 'trial') as PlanTier;
    if (!planSatisfies(plan, 'growth')) {
      return NextResponse.json(
        { error: 'plan_upgrade_required', message: 'Review Intelligence requires Growth plan or above' },
        { status: 403 },
      );
    }

    const { data: location } = await supabase
      .from('locations')
      .select('id')
      .eq('org_id', ctx.orgId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!location) {
      return NextResponse.json(
        { error: 'no_location', message: 'No location found for this organization' },
        { status: 404 },
      );
    }

    const serviceRole = createServiceRoleClient();
    const result = await runReviewSync(serviceRole, location.id, ctx.orgId);

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'review-sync', sprint: '107' } });
    return NextResponse.json(
      { error: 'sync_failed', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
