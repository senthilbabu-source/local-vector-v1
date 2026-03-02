'use client';

// ---------------------------------------------------------------------------
// BenchmarkCard.tsx — Sprint 122: Benchmark Comparisons
//
// "You're in the top 23% of hookah lounges in Alpharetta"
// Fetches GET /api/benchmarks/{orgId}?weeks=8
// States: loading (skeleton), insufficient_data, data, error
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import BenchmarkPercentileBar from './BenchmarkPercentileBar';
import BenchmarkTrendChart from './BenchmarkTrendChart';
import type { OrgBenchmarkResult } from '@/lib/services/benchmark-service';

interface BenchmarkCardProps {
  orgId: string;
  orgName: string;
}

interface BenchmarkResponse {
  current: OrgBenchmarkResult | null;
  history: OrgBenchmarkResult[];
  insufficient_data: boolean;
  reason?: string;
}

function formatPercentileText(percentileRank: number): string {
  if (percentileRank === 0) return 'bottom tier';
  const topPct = Math.max(1, Math.round(100 - percentileRank));
  return `top ${topPct}%`;
}

export default function BenchmarkCard({ orgId, orgName }: BenchmarkCardProps) {
  const [data, setData] = useState<BenchmarkResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchBenchmark() {
      try {
        const res = await fetch(`/api/benchmarks/${orgId}?weeks=8`);
        if (!res.ok) {
          setError(true);
          return;
        }
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchBenchmark();
    return () => { cancelled = true; };
  }, [orgId]);

  // Loading skeleton
  if (loading) {
    return (
      <div
        className="rounded-xl border border-white/5 bg-surface-dark p-5 animate-pulse"
        data-testid="benchmark-card"
      >
        <div className="h-4 w-48 rounded bg-white/10 mb-3" />
        <div className="h-8 w-64 rounded bg-white/10 mb-4" />
        <div className="h-3 w-full rounded bg-white/10 mb-3" />
        <div className="h-12 w-full rounded bg-white/10" />
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return null;
  }

  // Insufficient data
  if (data.insufficient_data) {
    return (
      <div
        className="rounded-xl border border-white/5 bg-surface-dark p-5"
        data-testid="benchmark-card"
      >
        <h3 className="text-sm font-semibold text-white mb-2">
          Industry Benchmark
        </h3>
        <p
          className="text-xs text-slate-500"
          data-testid="benchmark-insufficient-data"
        >
          Not enough businesses in your area to compute benchmarks yet. We need
          at least 5 similar businesses to provide meaningful comparisons.
        </p>
      </div>
    );
  }

  const { current, history } = data;
  if (!current) return null;

  const percentileText = formatPercentileText(current.percentile_rank);

  return (
    <div
      className="rounded-xl border border-white/5 bg-surface-dark p-5"
      data-testid="benchmark-card"
    >
      {/* Percentile headline */}
      <p
        className="text-lg font-semibold text-white mb-4"
        data-testid="benchmark-percentile-text"
      >
        {current.percentile_rank === 0
          ? `You're in the ${percentileText} of ${current.category_label} in ${current.location_label}`
          : `You're in the ${percentileText} of ${current.category_label} in ${current.location_label}`}
      </p>

      {/* Percentile bar */}
      <BenchmarkPercentileBar
        percentile_rank={current.percentile_rank}
        median={current.industry_median}
        top_quartile={current.top_quartile_threshold}
        className="mb-4"
      />

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
        <div>
          <span className="text-slate-500">Your score</span>
          <p
            className="text-white font-semibold tabular-nums"
            data-testid="benchmark-your-score"
          >
            {current.org_sov_score}%
          </p>
        </div>
        <div>
          <span className="text-slate-500">Industry median</span>
          <p
            className="text-white font-semibold tabular-nums"
            data-testid="benchmark-industry-median"
          >
            {current.industry_median}%
          </p>
        </div>
        <div>
          <span className="text-slate-500">Top quartile</span>
          <p className="text-white font-semibold tabular-nums">
            {current.top_quartile_threshold}%
          </p>
        </div>
        <div>
          <span className="text-slate-500">Top 10%</span>
          <p className="text-white font-semibold tabular-nums">
            {current.top_10pct_threshold}%
          </p>
        </div>
      </div>

      {/* Sample count */}
      <p
        className="text-[10px] text-slate-500 mb-4"
        data-testid="benchmark-sample-count"
      >
        Based on {current.sample_count} businesses this week
      </p>

      {/* Trend chart */}
      <BenchmarkTrendChart history={history} />
    </div>
  );
}
