// ---------------------------------------------------------------------------
// app/api/cron/benchmarks/route.ts — Sprint F (N4) + Sprint 122
//
// Weekly cron that:
//   1. Sprint F: Computes city+industry benchmark averages (benchmarks table)
//   2. Sprint 122: Computes percentile snapshots (benchmark_snapshots +
//      org_benchmark_cache tables)
//
// Schedule: 0 6 * * 0 (Sunday at 6:00 UTC, 4h after SOV cron)
// Auth: Bearer CRON_SECRET
// Kill switch: STOP_BENCHMARK_CRON
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { logCronStart, logCronComplete, logCronFailed } from '@/lib/services/cron-logger';
import { runBenchmarkComputation, getMostRecentSunday } from '@/lib/services/benchmark-service';
import * as Sentry from '@sentry/nextjs';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Kill switch ───────────────────────────────────────────────────────────
  if (process.env.STOP_BENCHMARK_CRON === 'true') {
    console.log('[cron-benchmarks] Halted by kill switch.');
    return NextResponse.json({ ok: true, halted: true });
  }

  const startMs = Date.now();
  const handle = await logCronStart('benchmarks');
  const supabase = createServiceRoleClient();

  try {
    // ── Phase 1: Sprint F — city+industry avg benchmarks ──────────────────
    let sprintFUpserted = 0;
    try {
      const { data, error } = await supabase.rpc('compute_benchmarks');
      if (error) {
        console.error('[cron-benchmarks] Sprint F RPC failed:', error.message);
      } else {
        for (const row of data ?? []) {
          const { error: upsertErr } = await supabase
            .from('benchmarks')
            .upsert(
              {
                city: row.city,
                industry: row.industry,
                org_count: row.org_count,
                avg_score: row.avg_score,
                min_score: row.min_score,
                max_score: row.max_score,
                computed_at: new Date().toISOString(),
              },
              { onConflict: 'city,industry' },
            );
          if (!upsertErr) sprintFUpserted++;
        }
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { cron: 'benchmarks', phase: 'sprint-f' } });
      // Sprint F is non-critical — continue to Sprint 122
    }

    // ── Phase 2: Sprint 122 — percentile benchmark computation ────────────
    const weekOfStr = getMostRecentSunday();
    const weekOfDate = new Date(weekOfStr + 'T00:00:00Z');

    const result = await runBenchmarkComputation(supabase, weekOfDate);

    const summary = {
      ok: true,
      week_of: weekOfStr,
      snapshots_written: result.snapshots_written,
      orgs_cached: result.orgs_cached,
      buckets_skipped: result.buckets_skipped,
      sprint_f_upserted: sprintFUpserted,
      duration_ms: Date.now() - startMs,
    };

    console.log('[cron-benchmarks]', summary);
    await logCronComplete(handle, summary as unknown as Record<string, unknown>);
    return NextResponse.json(summary);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: 'benchmarks', sprint: '122' } });
    await logCronFailed(handle, msg);
    console.error('[cron-benchmarks] Failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
