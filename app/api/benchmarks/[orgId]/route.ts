// ---------------------------------------------------------------------------
// GET /api/benchmarks/[orgId] — Sprint 122: Benchmark Comparisons
//
// Returns percentile rank, industry median, p75, p90, sample count, and
// history for the given org. Auth: user must be a member of the org.
// Missing data → 200 { insufficient_data: true }, never 404.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getOrgBenchmark, getOrgBenchmarkHistory } from '@/lib/services/benchmark-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const ctx = await getSafeAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { orgId } = await params;

  // Membership check: user must be a member of the requested org
  if (ctx.orgId !== orgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const weeks = Math.min(
    Math.max(1, parseInt(searchParams.get('weeks') ?? '8') || 8),
    52,
  );

  const supabase = await createClient();
  const current = await getOrgBenchmark(supabase, orgId);
  const history = await getOrgBenchmarkHistory(supabase, orgId, weeks);

  if (!current && history.length === 0) {
    return NextResponse.json({
      insufficient_data: true,
      reason: 'no_benchmark_data',
    });
  }

  return NextResponse.json({
    current,
    history,
    insufficient_data: false,
  });
}
