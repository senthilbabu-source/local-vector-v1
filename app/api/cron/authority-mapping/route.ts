// ---------------------------------------------------------------------------
// GET /api/cron/authority-mapping — Monthly Authority Mapping Cron Job
//
// Sprint 108: Processes all active Growth+ locations.
// Schedule: 1st of month at 5:00 AM UTC (vercel.json).
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { runAuthorityMappingForAllLocations } from '@/lib/authority/authority-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 1. Auth guard
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Kill switch
  if (process.env.STOP_AUTHORITY_CRON === 'true') {
    console.log('[cron-authority-mapping] Authority mapping cron halted by kill switch.');
    return NextResponse.json({ ok: true, halted: true });
  }

  const startTime = Date.now();

  try {
    const supabase = createServiceRoleClient();
    const result = await runAuthorityMappingForAllLocations(supabase);

    const durationMs = Date.now() - startTime;
    console.log('[cron-authority-mapping] Complete:', { ...result, duration_ms: durationMs });

    return NextResponse.json({
      ok: true,
      processed: result.processed,
      errors: result.errors,
      duration_ms: durationMs,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: 'authority-mapping', sprint: '108' } });
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cron-authority-mapping] Failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
