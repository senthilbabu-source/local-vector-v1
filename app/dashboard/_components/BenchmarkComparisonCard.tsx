// ---------------------------------------------------------------------------
// app/dashboard/_components/BenchmarkComparisonCard.tsx — Sprint F (N4)
//
// Shows org's Reality Score vs. city+industry average.
// Two states:
//   "Collecting" (org_count < MIN_DISPLAY_THRESHOLD):
//     Shows org's own score + progress toward benchmark threshold
//   "Ready" (org_count >= MIN_DISPLAY_THRESHOLD):
//     Shows org score vs. avg, relative position, min/max range bar
//
// Server Component — receives props from dashboard page.
// ---------------------------------------------------------------------------

import { InfoTooltip } from '@/components/ui/InfoTooltip';
import type { BenchmarkData } from '@/lib/data/benchmarks';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_DISPLAY_THRESHOLD = 10;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BenchmarkComparisonCardProps {
  orgScore: number | null;
  orgCity: string | null;
  orgIndustry: string | null;
  benchmark: BenchmarkData | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BenchmarkComparisonCard({
  orgScore,
  orgCity,
  orgIndustry,
  benchmark,
}: BenchmarkComparisonCardProps) {
  if (!orgCity) return null; // No city = no benchmark context

  const industryLabel = orgIndustry ?? 'Restaurant';
  const isReady = benchmark && benchmark.org_count >= MIN_DISPLAY_THRESHOLD;
  const orgCount = benchmark?.org_count ?? 0;

  return (
    <div
      className="rounded-xl border border-white/5 bg-surface-dark p-5"
      data-testid="benchmark-comparison-card"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-white">{orgCity} Benchmark</h3>
          <InfoTooltip
            content={
              <div className="space-y-1.5 text-xs">
                <p className="font-semibold text-white">City Benchmark</p>
                <p>
                  How your Reality Score compares to other {industryLabel.toLowerCase()} businesses
                  in {orgCity} on LocalVector.
                </p>
                <p>
                  Computed weekly from anonymized scores. Requires at least{' '}
                  {MIN_DISPLAY_THRESHOLD} businesses.
                </p>
                <p className="text-signal-green">
                  Improve your score by resolving open hallucination alerts.
                </p>
              </div>
            }
          />
        </div>
        {isReady && (
          <span className="text-xs text-slate-500">{benchmark.org_count} businesses</span>
        )}
      </div>

      {/* Collecting state */}
      {!isReady && (
        <div data-testid="benchmark-collecting-state">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-white">
              {orgScore ?? '—'}
            </span>
            <span className="text-sm text-slate-400">your score</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Benchmark data is collecting. {orgCount} of {MIN_DISPLAY_THRESHOLD}{' '}
            {industryLabel.toLowerCase()} businesses needed in {orgCity}.
          </p>
          {/* Progress bar toward threshold */}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-signal-green/40 transition-all"
              style={{
                width: `${Math.min(100, (orgCount / MIN_DISPLAY_THRESHOLD) * 100)}%`,
              }}
              aria-label={`${orgCount} of ${MIN_DISPLAY_THRESHOLD} businesses`}
            />
          </div>
        </div>
      )}

      {/* Comparison ready state */}
      {isReady && orgScore !== null && (
        <div data-testid="benchmark-ready-state">
          {/* Score vs Average */}
          <div className="flex items-end gap-6">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                Your Score
              </span>
              <p className="text-2xl font-bold tabular-nums text-white">{orgScore}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                {orgCity} Avg
              </span>
              <p className="text-2xl font-bold tabular-nums text-slate-400">
                {benchmark.avg_score}
              </p>
            </div>
            <div className="flex-1 text-right">
              <PercentileLabel orgScore={orgScore} avgScore={benchmark.avg_score} />
            </div>
          </div>

          {/* Range bar: min → you → max */}
          <div className="mt-4">
            <ScoreRangeBar
              min={benchmark.min_score}
              max={benchmark.max_score}
              avg={benchmark.avg_score}
              you={orgScore}
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-600 tabular-nums">
              <span>{benchmark.min_score}</span>
              <span>{benchmark.max_score}</span>
            </div>
          </div>
        </div>
      )}

      {/* Ready state but no org score yet */}
      {isReady && orgScore === null && (
        <div data-testid="benchmark-no-score-state">
          <p className="text-xs text-slate-500">
            Benchmark data is ready ({benchmark.org_count} businesses in {orgCity}).
            Your Reality Score will appear after your first AI scan.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Percentile label
// ---------------------------------------------------------------------------

function PercentileLabel({
  orgScore,
  avgScore,
}: {
  orgScore: number;
  avgScore: number;
}) {
  const diff = orgScore - avgScore;
  if (Math.abs(diff) < 2) {
    return (
      <span className="text-xs text-slate-400">At the city average</span>
    );
  }
  if (diff > 0) {
    return (
      <span className="text-xs font-medium text-signal-green">
        +{diff.toFixed(0)} above average
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-amber-400">
      {diff.toFixed(0)} below average
    </span>
  );
}

// ---------------------------------------------------------------------------
// Score range bar visualization
// ---------------------------------------------------------------------------

function ScoreRangeBar({
  min,
  max,
  avg,
  you,
}: {
  min: number;
  max: number;
  avg: number;
  you: number;
}) {
  const range = max - min || 1;
  const avgPct = ((avg - min) / range) * 100;
  const youPct = Math.min(100, Math.max(0, ((you - min) / range) * 100));

  return (
    <div className="relative h-2 w-full rounded-full bg-white/5">
      {/* Average marker */}
      <div
        className="absolute top-0 h-full w-px bg-slate-500"
        style={{ left: `${avgPct}%` }}
        title={`Average: ${avg}`}
      />
      {/* Your score marker */}
      <div
        className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 border-signal-green bg-surface-dark"
        style={{ left: `${youPct}%`, transform: `translateX(-50%) translateY(-50%)` }}
        title={`You: ${you}`}
      />
    </div>
  );
}
