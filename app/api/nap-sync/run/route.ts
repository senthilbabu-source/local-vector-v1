// ---------------------------------------------------------------------------
// POST /api/nap-sync/run — Trigger on-demand NAP sync
//
// Sprint 105: Authenticated endpoint for manual NAP sync from dashboard.
// Plan gate: Growth+ only.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { planSatisfies, type PlanTier } from '@/lib/plan-enforcer';
import { runNAPSync } from '@/lib/nap-sync/nap-sync-service';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // 1. Verify user session
    const ctx = await getSafeAuthContext();
    if (!ctx || !ctx.orgId) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Authentication required' },
        { status: 401 },
      );
    }

    // 2. Plan gate — Growth+ only
    const supabase = await createClient();
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('plan')
      .eq('id', ctx.orgId)
      .single();

    const plan = (orgRow?.plan ?? 'trial') as PlanTier;
    if (!planSatisfies(plan, 'growth')) {
      return NextResponse.json(
        { error: 'plan_upgrade_required', message: 'NAP Sync requires Growth plan or above' },
        { status: 403 },
      );
    }

    // 3. Resolve location_id
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

    // 4. Run NAP sync (service-role for cross-table writes)
    const serviceRole = createServiceRoleClient();
    const result = await runNAPSync(serviceRole, location.id, ctx.orgId);

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'nap-sync-run', sprint: '105' } });
    return NextResponse.json(
      { error: 'sync_failed', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
