// ---------------------------------------------------------------------------
// app/api/cron/benchmarks/route.ts — Sprint F (N4): Benchmark Aggregation
//
// Weekly cron that computes city+industry benchmark averages from
// visibility_scores.reality_score and stores them in the benchmarks table.
//
// Schedule: 0 8 * * 0 (Sunday at 8:00 UTC, after SOV scan)
// Auth: Bearer CRON_SECRET
// Kill switch: STOP_BENCHMARK_CRON
//
// NOTE: Uses type casts because benchmarks table + compute_benchmarks RPC
// are not in database.types.ts until types are regenerated post-migration.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { logCronStart, logCronComplete, logCronFailed } from '@/lib/services/cron-logger';
import * as Sentry from '@sentry/nextjs';

interface BenchmarkRow {
  city: string;
  industry: string;
  org_count: number;
  avg_score: number;
  min_score: number;
  max_score: number;
}

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

  const handle = await logCronStart('benchmarks');
  const supabase = createServiceRoleClient();

  try {
    // Aggregate benchmarks via RPC (uses service-role — bypasses RLS)
    const { data, error } = await (supabase.rpc as Function)(
      'compute_benchmarks',
    ) as { data: BenchmarkRow[] | null; error: { message: string } | null };

    if (error) throw new Error(`Benchmark aggregation failed: ${error.message}`);

    let upsertCount = 0;
    for (const row of data ?? []) {
      const { error: upsertErr } = await (supabase.from as Function)(
        'benchmarks',
      ).upsert(
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

      if (!upsertErr) upsertCount++;
    }

    const summary = { upserted: upsertCount, total_rows: data?.length ?? 0 };
    console.log('[cron-benchmarks]', summary);
    await logCronComplete(handle, summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: 'benchmarks', sprint: 'F' } });
    await logCronFailed(handle, msg);
    console.error('[cron-benchmarks] Failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
