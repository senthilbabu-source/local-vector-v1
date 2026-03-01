// ---------------------------------------------------------------------------
// GET /api/cron/schema-drift — Monthly Schema Drift Check
//
// Sprint 106: Re-crawls all active Growth+ locations and regenerates
// schemas where page content has changed since last run.
//
// Schedule: 1st of each month at 4 AM UTC (vercel.json)
// Kill switch: STOP_SCHEMA_DRIFT_CRON=true
// Auth: CRON_SECRET bearer token
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { runSchemaExpansionForAllLocations } from '@/lib/schema-expansion/schema-expansion-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 1. Auth guard
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Kill switch
  if (process.env.STOP_SCHEMA_DRIFT_CRON === 'true') {
    console.log('[cron-schema-drift] Schema drift cron halted by kill switch.');
    return NextResponse.json({ ok: true, halted: true });
  }

  const startTime = Date.now();

  try {
    const supabase = createServiceRoleClient();
    const result = await runSchemaExpansionForAllLocations(supabase);

    const durationMs = Date.now() - startTime;
    console.log('[cron-schema-drift] Complete:', { ...result, duration_ms: durationMs });

    return NextResponse.json({
      ok: true,
      processed: result.processed,
      errors: result.errors,
      duration_ms: durationMs,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: 'schema-drift', sprint: '106' } });
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cron-schema-drift] Failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
