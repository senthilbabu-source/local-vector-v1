// ---------------------------------------------------------------------------
// GET /api/cron/vaio — Monthly VAIO cron
//
// Seeds voice queries, generates llms.txt, detects voice gaps for all Growth+
// locations. Also refreshes AI crawler audits.
//
// Schedule: 1st of month, 6 AM UTC (after authority-mapping at 5AM)
// Security: CRON_SECRET header
//
// Sprint 109: VAIO
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { runVAIOForAllLocations } from '@/lib/vaio/vaio-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (process.env.STOP_VAIO_CRON === 'true') {
    console.log('[cron-vaio] VAIO cron halted by kill switch.');
    return NextResponse.json({ ok: true, halted: true });
  }

  const startTime = Date.now();

  try {
    const supabase = createServiceRoleClient();
    const result = await runVAIOForAllLocations(supabase);
    const durationMs = Date.now() - startTime;

    console.log('[cron-vaio] Complete:', { ...result, duration_ms: durationMs });
    return NextResponse.json({ ok: true, ...result, duration_ms: durationMs });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { cron: 'vaio', sprint: '109' },
    });
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cron-vaio] Failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
