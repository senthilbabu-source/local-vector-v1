// ---------------------------------------------------------------------------
// GET /api/cron/data-health-refresh — Nightly DataHealth Recompute
//
// Sprint 124: Recomputes data_health_score for all active locations.
// Reads ground truth from locations + magic_menus, writes cached score.
//
// Schedule: Daily, 5 AM UTC (after other crons)
// Auth: CRON_SECRET bearer token
// Kill switch: STOP_DATA_HEALTH_CRON
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { computeDataHealth } from '@/lib/services/data-health.service';
import { logCronStart, logCronComplete, logCronFailed } from '@/lib/services/cron-logger';
import * as Sentry from '@sentry/nextjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 55;

const CRON_NAME = 'data-health-refresh';

export async function GET(request: NextRequest) {
  // Auth guard
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Kill switch
  if (process.env.STOP_DATA_HEALTH_CRON === 'true') {
    return NextResponse.json({ skipped: true, reason: 'Kill switch active' });
  }

  const runId = await logCronStart(CRON_NAME);
  const supabase = createServiceRoleClient();

  try {
    // Fetch all active (non-archived) locations
    const { data: locations, error: fetchError } = await supabase
      .from('locations')
      .select('id')
      .eq('is_archived', false);

    if (fetchError || !locations) {
      await logCronFailed(runId, fetchError?.message ?? 'No locations found');
      return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
    }

    let updated = 0;
    let errors = 0;

    for (const loc of locations) {
      try {
        const breakdown = await computeDataHealth(supabase, loc.id);

        await supabase
          .from('locations')
          .update({ data_health_score: breakdown.total })
          .eq('id', loc.id);

        updated++;
      } catch (err) {
        errors++;
        Sentry.captureException(err, {
          tags: { component: CRON_NAME, sprint: '124', locationId: loc.id },
        });
      }
    }

    await logCronComplete(runId, { updated, errors, total: locations.length });

    return NextResponse.json({
      ok: true,
      updated,
      errors,
      total: locations.length,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { component: CRON_NAME, sprint: '124' } });
    await logCronFailed(runId, err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}
