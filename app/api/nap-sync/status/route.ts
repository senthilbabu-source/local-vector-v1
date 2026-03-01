// ---------------------------------------------------------------------------
// GET /api/nap-sync/status — Current NAP health state
//
// Sprint 105: Returns discrepancies + health score for dashboard panel.
// Plan gate: Growth+ only.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { planSatisfies, type PlanTier } from '@/lib/plan-enforcer';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ctx = await getSafeAuthContext();
    if (!ctx || !ctx.orgId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Plan gate
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('plan')
      .eq('id', ctx.orgId)
      .single();

    const plan = (orgRow?.plan ?? 'trial') as PlanTier;
    if (!planSatisfies(plan, 'growth')) {
      return NextResponse.json(
        { error: 'plan_upgrade_required' },
        { status: 403 },
      );
    }

    // Fetch primary location
    const { data: location } = await supabase
      .from('locations')
      .select('id, nap_health_score, nap_last_checked_at')
      .eq('org_id', ctx.orgId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!location) {
      return NextResponse.json({
        health_score: null,
        discrepancies: [],
        last_checked_at: null,
      });
    }

    // Fetch most recent unresolved discrepancies per platform
    const { data: discrepancies } = await supabase
      .from('nap_discrepancies')
      .select('*')
      .eq('location_id', location.id)
      .is('resolved_at', null)
      .order('detected_at', { ascending: false });

    // Deduplicate: keep only the most recent per platform
    const latestByPlatform = new Map<string, (typeof discrepancies extends (infer T)[] | null ? T : never)>();
    for (const d of discrepancies ?? []) {
      if (!latestByPlatform.has(d.platform)) {
        latestByPlatform.set(d.platform, d);
      }
    }

    const healthScore = location.nap_health_score != null
      ? {
          score: location.nap_health_score,
          grade: scoreToGrade(location.nap_health_score),
        }
      : null;

    return NextResponse.json({
      health_score: healthScore,
      discrepancies: Array.from(latestByPlatform.values()),
      last_checked_at: location.nap_last_checked_at,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'nap-sync-status', sprint: '105' } });
    return NextResponse.json(
      { error: 'internal_error' },
      { status: 500 },
    );
  }
}

function scoreToGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}
