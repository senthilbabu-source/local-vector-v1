/**
 * AIVisibilityPanel — the primary "how are we doing?" gauge
 *
 * Shows:
 * - Reality Score as a circular gauge (0–100)
 * - Delta from last week (+/- N points)
 * - Benchmark comparison from Sprint F
 *
 * Sprint G — Human-Readable Dashboard.
 */

import { InfoTooltip } from '@/components/ui/InfoTooltip';
import type { BenchmarkData } from '@/lib/data/benchmarks';

interface AIVisibilityPanelProps {
  score: number | null;
  previousScore: number | null;
  benchmark: BenchmarkData | null;
  orgCity: string | null;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-signal-green';
  if (score >= 60) return 'text-amber-400';
  return 'text-alert-crimson';
}

function ringStroke(score: number): string {
  if (score >= 80) return 'stroke-signal-green';
  if (score >= 60) return 'stroke-amber-400';
  return 'stroke-alert-crimson';
}

export default function AIVisibilityPanel({
  score,
  previousScore,
  benchmark,
  orgCity,
}: AIVisibilityPanelProps) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const delta =
    score !== null && previousScore !== null ? score - previousScore : null;

  const benchmarkReady = benchmark && benchmark.org_count >= 10;
  const benchmarkDiff =
    benchmarkReady && score !== null
      ? Math.round(score - benchmark.avg_score)
      : null;

  return (
    <div
      className="rounded-xl border border-white/5 bg-surface-dark p-5"
      data-testid="ai-visibility-panel"
    >
      <div className="mb-3 flex items-center gap-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          AI Visibility
        </h3>
        <InfoTooltip content="Your AI Visibility score (0–100) measures how accurately and prominently AI models represent your business across ChatGPT, Perplexity, and Gemini." />
      </div>

      <div className="flex items-center gap-4">
        {/* Gauge */}
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
          <svg
            className="absolute inset-0 h-full w-full -rotate-90"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              strokeWidth="6"
              className="stroke-white/5"
            />
            {score !== null && (
              <circle
                cx="50"
                cy="50"
                r={r}
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                className={ringStroke(score)}
                strokeDasharray={circ}
                strokeDashoffset={circ - (score / 100) * circ}
              />
            )}
          </svg>
          <span
            className={`relative text-2xl font-bold font-mono tabular-nums ${score !== null ? scoreColor(score) : 'text-slate-500'}`}
            data-testid="ai-visibility-score"
          >
            {score !== null ? score : '—'}
          </span>
        </div>

        {/* Details */}
        <div className="min-w-0 flex-1">
          {delta !== null && (
            <p
              className={`text-sm font-medium ${delta > 0 ? 'text-truth-emerald' : delta < 0 ? 'text-alert-crimson' : 'text-slate-400'}`}
              data-testid="ai-visibility-delta"
            >
              {delta > 0 ? '+' : ''}
              {delta} pts this week
            </p>
          )}

          {benchmarkReady && benchmarkDiff !== null ? (
            <p
              className="mt-0.5 text-xs text-slate-500"
              data-testid="ai-visibility-benchmark"
            >
              {benchmarkDiff > 0
                ? `${benchmarkDiff} above ${orgCity ?? 'city'} avg`
                : benchmarkDiff < 0
                  ? `${Math.abs(benchmarkDiff)} below ${orgCity ?? 'city'} avg`
                  : `At ${orgCity ?? 'city'} average`}
            </p>
          ) : (
            <p
              className="mt-0.5 text-xs text-slate-500"
              data-testid="ai-visibility-benchmark"
            >
              Building benchmark...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
