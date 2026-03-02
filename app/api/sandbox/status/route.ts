// ---------------------------------------------------------------------------
// GET /api/sandbox/status — Latest simulation + history + rate limit
//
// Sprint 110: Returns sandbox status for the authenticated user's location.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import {
  getLatestSimulationRun,
  getSimulationHistory,
  checkDailyRateLimit,
} from '@/lib/sandbox/simulation-orchestrator';
import { SANDBOX_LIMITS } from '@/lib/sandbox/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ctx = await getSafeAuthContext();
    if (!ctx || !ctx.orgId) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Authentication required' },
        { status: 401 },
      );
    }

    const supabase = await createClient();
    const { data: location } = await supabase
      .from('locations')
      .select('id')
      .eq('org_id', ctx.orgId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!location) {
      return NextResponse.json({
        latest_run: null,
        history: [],
        rate_limit: { runs_today: 0, remaining: SANDBOX_LIMITS.MAX_RUNS_PER_DAY_PER_ORG, max: SANDBOX_LIMITS.MAX_RUNS_PER_DAY_PER_ORG },
      });
    }

    const serviceRole = createServiceRoleClient();
    const [latestRun, history, rateLimit] = await Promise.all([
      getLatestSimulationRun(serviceRole, location.id),
      getSimulationHistory(serviceRole, location.id, 10),
      checkDailyRateLimit(serviceRole, ctx.orgId),
    ]);

    return NextResponse.json({
      latest_run: latestRun,
      history,
      rate_limit: {
        runs_today: rateLimit.runs_today,
        remaining: rateLimit.remaining,
        max: SANDBOX_LIMITS.MAX_RUNS_PER_DAY_PER_ORG,
      },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'sandbox-status', sprint: '110' } });
    return NextResponse.json(
      { error: 'status_failed', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
