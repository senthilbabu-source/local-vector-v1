// ---------------------------------------------------------------------------
// POST /api/sandbox/run — On-demand sandbox simulation
//
// Sprint 110: Authenticated endpoint for running sandbox simulations.
// Plan gate: Growth+ only. Rate limit: 20 runs/day/org.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { planSatisfies, type PlanTier } from '@/lib/plan-enforcer';
import { runSimulation, checkDailyRateLimit } from '@/lib/sandbox/simulation-orchestrator';
import type { SimulationInput, SimulationMode, ContentSource } from '@/lib/sandbox/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
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
        { error: 'plan_upgrade_required', message: 'AI Sandbox requires Growth plan or above' },
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

    // Parse body
    const body = await request.json() as {
      content_text?: string;
      content_source?: ContentSource;
      draft_id?: string;
      modes?: SimulationMode[];
    };

    if (!body.content_text || body.content_text.trim().length === 0) {
      return NextResponse.json(
        { error: 'empty_content', message: 'Content text is required' },
        { status: 422 },
      );
    }

    // Rate limit check
    const serviceRole = createServiceRoleClient();
    const rateLimit = await checkDailyRateLimit(serviceRole, ctx.orgId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'rate_limit_exceeded',
          message: `Daily limit reached (${rateLimit.runs_today}/${rateLimit.runs_today + rateLimit.remaining})`,
          runs_today: rateLimit.runs_today,
          remaining: rateLimit.remaining,
        },
        { status: 429 },
      );
    }

    const input: SimulationInput = {
      location_id: location.id,
      org_id: ctx.orgId,
      content_text: body.content_text,
      content_source: body.content_source ?? 'freeform',
      draft_id: body.draft_id,
      modes: body.modes ?? ['ingestion', 'query', 'gap_analysis'],
    };

    const run = await runSimulation(serviceRole, input);

    return NextResponse.json({ ok: true, run });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'sandbox-run', sprint: '110' } });
    return NextResponse.json(
      { error: 'simulation_failed', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
