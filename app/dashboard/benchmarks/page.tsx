// ---------------------------------------------------------------------------
// app/dashboard/benchmarks/page.tsx — Sprint 103
//
// Full-page benchmark comparison. Promotes the BenchmarkComparisonCard
// from an embedded dashboard card to a first-class route.
//
// States:
//   1. No city set on primary location → onboarding nudge
//   2. Collecting (org_count < 10) → collecting state + explainer
//   3. Ready (org_count >= 10) + orgScore → full comparison + actions
//   4. Ready + no orgScore → benchmark ready but no score yet
//
// Server Component — all data fetched at render time.
// ---------------------------------------------------------------------------

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchBenchmark } from '@/lib/data/benchmarks';
import { getActiveLocationId } from '@/lib/location/active-location';
import BenchmarkComparisonCard from '../_components/BenchmarkComparisonCard';
import { Trophy } from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants — matches BenchmarkComparisonCard.MIN_DISPLAY_THRESHOLD
// ---------------------------------------------------------------------------

const MIN_DISPLAY_THRESHOLD = 10;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function BenchmarksPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) redirect('/login');
  if (!ctx.orgId) redirect('/login');

  const supabase = await createClient();
  const activeLocationId = await getActiveLocationId(supabase, ctx.orgId);

  // Parallel data fetch: benchmark + latest reality score
  const [benchmarkResult, scoreResult] = await Promise.all([
    fetchBenchmark(supabase, ctx.orgId, activeLocationId),
    supabase
      .from('visibility_scores')
      .select('reality_score, snapshot_date')
      .eq('org_id', ctx.orgId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const { benchmark, locationContext } = benchmarkResult;
  const orgScore: number | null = scoreResult.data?.reality_score ?? null;
  const orgCity = locationContext.city;
  const orgIndustry = locationContext.industry;
  const industryLabel = orgIndustry ?? 'Restaurant';

  // State 1: No city set
  if (!orgCity) {
    return (
      <div className="space-y-5" data-testid="benchmark-page">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
            <Trophy className="h-5 w-5 text-signal-green" />
            City Benchmark
          </h1>
        </div>
        <div
          className="rounded-xl border border-white/5 bg-surface-dark px-5 py-8 text-center"
          data-testid="benchmark-no-city-state"
        >
          <p className="text-sm font-semibold text-white">
            No city set for your primary location.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Add your city in Settings to unlock city benchmark comparison.
          </p>
          <Link
            href="/dashboard/settings"
            className="mt-4 inline-flex items-center text-sm font-medium text-signal-green hover:text-signal-green/80 transition"
          >
            Go to Settings →
          </Link>
        </div>
      </div>
    );
  }

  const isReady = benchmark && benchmark.org_count >= MIN_DISPLAY_THRESHOLD;
  const isAboveAverage = orgScore !== null && benchmark !== null && orgScore > benchmark.avg_score;
  const isBelowAverage = orgScore !== null && benchmark !== null && orgScore <= benchmark.avg_score;

  return (
    <div className="space-y-5" data-testid="benchmark-page">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
          <Trophy className="h-5 w-5 text-signal-green" />
          City Benchmark
        </h1>
        <p className="mt-0.5 text-sm text-slate-400">
          How your AI Visibility Score compares to other {industryLabel.toLowerCase()} businesses
          in {orgCity} on LocalVector.
        </p>
      </div>

      {/* Hero: BenchmarkComparisonCard */}
      <BenchmarkComparisonCard
        orgScore={orgScore}
        orgCity={orgCity}
        orgIndustry={orgIndustry}
        benchmark={benchmark}
      />

      {/* About This Benchmark — only when ready */}
      {isReady && (
        <div
          className="rounded-xl border border-white/5 bg-surface-dark p-5"
          data-testid="benchmark-about-section"
        >
          <h2 className="text-sm font-semibold text-white mb-3">About This Benchmark</h2>
          <ul className="space-y-1.5 text-xs text-slate-400">
            <li>Computed every Sunday from anonymized Reality Scores.</li>
            <li>
              Last updated:{' '}
              {benchmark.computed_at
                ? new Date(benchmark.computed_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'Recently'}
            </li>
            <li>Based on {benchmark.org_count} businesses in {orgCity}.</li>
            <li>Minimum {MIN_DISPLAY_THRESHOLD} businesses required to display.</li>
          </ul>
        </div>
      )}

      {/* How to Improve — only when ready AND orgScore exists */}
      {isReady && orgScore !== null && (
        <div
          className="rounded-xl border border-white/5 bg-surface-dark p-5"
          data-testid="benchmark-improve-section"
        >
          <h2 className="text-sm font-semibold text-white mb-3">How to Improve Your Score</h2>
          {isBelowAverage && (
            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-amber-400">•</span>
                <span>
                  Resolve open hallucination alerts →{' '}
                  <Link
                    href="/dashboard/hallucinations"
                    className="text-signal-green hover:text-signal-green/80 transition"
                  >
                    View Alerts
                  </Link>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400">•</span>
                <span>
                  Review your AI Sources →{' '}
                  <Link
                    href="/dashboard/source-intelligence"
                    className="text-signal-green hover:text-signal-green/80 transition"
                  >
                    AI Sources
                  </Link>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400">•</span>
                <span>
                  Check your Citations →{' '}
                  <Link
                    href="/dashboard/citations"
                    className="text-signal-green hover:text-signal-green/80 transition"
                  >
                    Citations
                  </Link>
                </span>
              </li>
            </ul>
          )}
          {isAboveAverage && (
            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-signal-green">•</span>
                <span>You&apos;re above average. Keep your data fresh.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-signal-green">•</span>
                <span>
                  Set up weekly scanning →{' '}
                  <Link
                    href="/dashboard/settings"
                    className="text-signal-green hover:text-signal-green/80 transition"
                  >
                    Settings
                  </Link>
                </span>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
