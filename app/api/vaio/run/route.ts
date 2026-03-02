// ---------------------------------------------------------------------------
// POST /api/vaio/run — On-demand VAIO scan
//
// Sprint 109: Voice & Conversational AI Optimization
//
// Auth: User session (getSafeAuthContext)
// Plan gate: Growth+ only
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { planSatisfies } from '@/lib/plan-enforcer';
import { runVAIO } from '@/lib/vaio/vaio-service';

export const dynamic = 'force-dynamic';

export async function POST() {
  const ctx = await getSafeAuthContext();
  if (!ctx || !ctx.orgId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const supabase = await createClient();
    const { data: org } = await supabase
      .from('organizations')
      .select('plan')
      .eq('id', ctx.orgId)
      .single();

    if (!org || !planSatisfies(org.plan, 'growth')) {
      return NextResponse.json({ error: 'plan_upgrade_required' }, { status: 403 });
    }

    const { data: location } = await supabase
      .from('locations')
      .select('id')
      .eq('org_id', ctx.orgId)
      .eq('is_archived', false)
      .limit(1)
      .single();

    if (!location) {
      return NextResponse.json({ error: 'no_location' }, { status: 422 });
    }

    const serviceRole = createServiceRoleClient();
    const result = await runVAIO(serviceRole, location.id, ctx.orgId);

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: 'vaio-run', sprint: '109' },
    });
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'run_failed', message: msg }, { status: 500 });
  }
}
