// ---------------------------------------------------------------------------
// GET /api/cron/nap-sync — Weekly NAP Sync Cron Job
//
// Sprint 105: Processes all active Growth+ locations.
// Schedule: Every Monday at 3:00 AM UTC (vercel.json).
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { runNAPSyncForAllLocations } from '@/lib/nap-sync/nap-sync-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 1. Auth guard
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Kill switch
  if (process.env.STOP_NAP_SYNC_CRON === 'true') {
    console.log('[cron-nap-sync] NAP sync cron halted by kill switch.');
    return NextResponse.json({ ok: true, halted: true });
  }

  const startTime = Date.now();

  try {
    const supabase = createServiceRoleClient();
    const result = await runNAPSyncForAllLocations(supabase);

    const durationMs = Date.now() - startTime;
    console.log('[cron-nap-sync] Complete:', { ...result, duration_ms: durationMs });

    return NextResponse.json({
      ok: true,
      processed: result.processed,
      errors: result.errors,
      duration_ms: durationMs,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: 'nap-sync', sprint: '105' } });
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cron-nap-sync] Failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
