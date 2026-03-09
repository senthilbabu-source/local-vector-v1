// ---------------------------------------------------------------------------
// app/api/cron/correction-benchmarks/route.ts — S23: Correction Benchmarks Cron
//
// Weekly cron, Saturday 5 AM UTC. Computes correction timing benchmarks
// across all orgs and caches result in Redis.
//
// Kill switch: STOP_CORRECTION_BENCHMARKS_CRON=true
// Auth: Authorization: Bearer <CRON_SECRET>
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { computeCorrectionBenchmarks } from '@/lib/analytics/correction-benchmark';
import { setCachedBenchmarks } from '@/lib/analytics/correction-benchmark.cache';
import * as Sentry from '@sentry/nextjs';
import type { Json } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';
export const maxDuration = 55;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (process.env.STOP_CORRECTION_BENCHMARKS_CRON === 'true') {
    return NextResponse.json({ skipped: true, reason: 'kill_switch' });
  }

  const startTime = Date.now();
  const supabase = createServiceRoleClient();

  try {
    const benchmarks = await computeCorrectionBenchmarks(supabase);
    const entryCount = Object.keys(benchmarks).length;

    // Cache result
    await setCachedBenchmarks(benchmarks);

    // Log cron run
    try {
      await supabase.from('cron_run_log').insert({
        cron_name: 'correction-benchmarks',
        status: 'success',
        duration_ms: Date.now() - startTime,
        summary: { entry_count: entryCount } as unknown as Json,
      });
    } catch (err) {
      Sentry.captureException(err);
      // Logging failure is non-critical
    }

    return NextResponse.json({
      status: 'ok',
      entry_count: entryCount,
      duration_ms: Date.now() - startTime,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: 'correction-benchmarks', sprint: 'S23' } });

    try {
      await supabase.from('cron_run_log').insert({
        cron_name: 'correction-benchmarks',
        status: 'error',
        duration_ms: Date.now() - startTime,
        summary: { error: String(err) } as unknown as Json,
      });
    } catch (err) {
      Sentry.captureException(err);
      // Logging failure is non-critical
    }

    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
