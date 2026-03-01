// ---------------------------------------------------------------------------
// app/api/autopilot/run/route.ts — On-demand Autopilot Scan
//
// POST: Triggers gap detection and draft creation for the authenticated
// user's active location. Growth+ plan required.
//
// Sprint 86 — Autopilot Engine
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { canRunAutopilot, type PlanTier } from '@/lib/plan-enforcer';
import { getActiveLocationId } from '@/lib/location/active-location';
import { runAutopilotForLocation } from '@/lib/autopilot/autopilot-service';

export async function POST() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // ── Plan gating ───────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', ctx.orgId)
    .single();

  const plan = (org?.plan ?? 'trial') as PlanTier;
  if (!canRunAutopilot(plan)) {
    return NextResponse.json({ error: 'plan_upgrade_required' }, { status: 403 });
  }

  // ── Active location ───────────────────────────────────────────────────────
  const locationId = await getActiveLocationId(supabase, ctx.orgId);
  if (!locationId) {
    return NextResponse.json({ error: 'no_location' }, { status: 400 });
  }

  // ── Run autopilot (service-role for draft insertion) ──────────────────────
  try {
    const serviceSupabase = createServiceRoleClient();
    const result = await runAutopilotForLocation(
      serviceSupabase,
      ctx.orgId,
      locationId,
      plan,
    );

    return NextResponse.json({
      ok: true,
      drafts_created: result.draftsCreated,
      drafts_skipped_dedup: result.draftsSkippedDedup,
      drafts_skipped_limit: result.draftsSkippedLimit,
      errors: result.errors.length,
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'autopilot-run', sprint: '86' },
      extra: { orgId: ctx.orgId },
    });
    return NextResponse.json({ error: 'run_failed' }, { status: 500 });
  }
}
