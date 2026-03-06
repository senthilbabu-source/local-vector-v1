// ---------------------------------------------------------------------------
// app/api/cron/ai-shopper/route.ts — S25: AI Shopper Simulation Cron
//
// Weekly cron, Wednesday 5 AM UTC. Growth+ orgs only.
// Runs 1 scenario per org per week (rotating).
//
// Kill switch: STOP_AI_SHOPPER_CRON=true
// Auth: Authorization: Bearer <CRON_SECRET>
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { runAIShopperScenario } from '@/lib/ai-shopper/shopper-runner';
import { SHOPPER_SCENARIOS } from '@/lib/ai-shopper/shopper-scenarios';
import * as Sentry from '@sentry/nextjs';
import type { Json } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';

const SCENARIO_TYPES = Object.keys(SHOPPER_SCENARIOS);

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (process.env.STOP_AI_SHOPPER_CRON === 'true') {
    return NextResponse.json({ skipped: true, reason: 'kill_switch' });
  }

  const startTime = Date.now();
  const supabase = createServiceRoleClient();

  try {
    // Fetch Growth+ orgs with primary location
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, plan')
      .in('plan', ['growth', 'agency']);

    if (!orgs || orgs.length === 0) {
      return NextResponse.json({ status: 'ok', runs: 0, duration_ms: Date.now() - startTime });
    }

    let runsCompleted = 0;
    const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));

    for (const org of orgs) {
      try {
        // Get primary location with ground truth
        const { data: location } = await supabase
          .from('locations')
          .select('id, business_name, city, state, cuisine_type' as 'id, business_name, city, state')
          .eq('org_id', org.id)
          .eq('is_primary', true)
          .maybeSingle();

        if (!location) continue;

        const locTyped = location as unknown as {
          id: string;
          business_name: string;
          city: string | null;
          state: string | null;
          cuisine_type: string | null;
        };

        // Rotate scenario type per org per week
        const scenarioIndex = weekNumber % SCENARIO_TYPES.length;
        const scenarioType = SCENARIO_TYPES[scenarioIndex];

        await runAIShopperScenario(supabase, org.id, locTyped.id, scenarioType, {
          business_name: locTyped.business_name ?? 'the restaurant',
          city: locTyped.city ?? 'the area',
          cuisine: locTyped.cuisine_type ?? 'restaurant',
        });

        runsCompleted++;
      } catch (err) {
        Sentry.captureException(err, { tags: { cron: 'ai-shopper', sprint: 'S25' }, extra: { orgId: org.id } });
      }
    }

    try {
      await supabase.from('cron_run_log').insert({
        cron_name: 'ai-shopper',
        status: 'success',
        duration_ms: Date.now() - startTime,
        summary: { orgs_processed: orgs.length, runs_completed: runsCompleted } as unknown as Json,
      });
    } catch (err) {
      Sentry.captureException(err);
      // Logging failure is non-critical
    }

    return NextResponse.json({
      status: 'ok',
      runs: runsCompleted,
      duration_ms: Date.now() - startTime,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: 'ai-shopper', sprint: 'S25' } });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
