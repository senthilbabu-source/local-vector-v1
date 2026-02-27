// ---------------------------------------------------------------------------
// AIHealthScoreCard — AI Health Score dashboard card (Sprint 72)
//
// Server Component: displays the composite 0–100 AI Health Score with
// 4 component bars and a top recommendation. No 'use client' needed.
//
// Design tokens: surface-dark, signal-green, alert-amber, alert-crimson.
// Ring pattern adapted from SOVScoreRing.tsx.
// ---------------------------------------------------------------------------

import Link from 'next/link';
import { nextSundayLabel } from './scan-health-utils';
import type { HealthScoreResult } from '@/lib/services/ai-health-score.service';
import { gradeDescription } from '@/lib/services/ai-health-score.service';

interface AIHealthScoreCardProps {
  healthScore: HealthScoreResult;
}

// ---------------------------------------------------------------------------
// Color helpers (literal Tailwind classes — AI_RULES §12 JIT safe)
// ---------------------------------------------------------------------------

function ringStroke(score: number): string {
  if (score >= 80) return 'stroke-signal-green';
  if (score >= 40) return 'stroke-amber-400';
  return 'stroke-alert-crimson';
}

function scoreTextColor(score: number): string {
  if (score >= 80) return 'text-signal-green';
  if (score >= 40) return 'text-amber-400';
  return 'text-alert-crimson';
}

function gradeTextColor(grade: string): string {
  if (grade === 'A' || grade === 'B') return 'text-signal-green';
  if (grade === 'C') return 'text-amber-400';
  return 'text-alert-crimson';
}

function barColor(score: number): string {
  if (score >= 80) return 'bg-signal-green';
  if (score >= 40) return 'bg-amber-400';
  return 'bg-alert-crimson';
}

/** Map score to a literal Tailwind width class (AI_RULES §12 — no dynamic class construction). */
function barWidthClass(score: number | null): string {
  if (score === null) return 'w-0';
  if (score >= 95) return 'w-full';
  if (score >= 85) return 'w-11/12';
  if (score >= 75) return 'w-3/4';
  if (score >= 65) return 'w-2/3';
  if (score >= 55) return 'w-1/2';
  if (score >= 45) return 'w-5/12';
  if (score >= 35) return 'w-1/3';
  if (score >= 25) return 'w-1/4';
  if (score >= 15) return 'w-1/6';
  if (score >= 5) return 'w-1/12';
  return 'w-0';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AIHealthScoreCard({ healthScore }: AIHealthScoreCardProps) {
  const { score, grade, components, topRecommendation } = healthScore;

  const r = 40;
  const circ = 2 * Math.PI * r;

  // ── Null state — no data yet ────────────────────────────────────────────
  if (score === null || grade === null) {
    return (
      <div
        className="rounded-2xl bg-surface-dark border border-white/5 p-5"
        data-testid="ai-health-score-card"
      >
        <h2 className="text-sm font-semibold text-white tracking-tight mb-4">
          AI Health Score
        </h2>
        <div className="flex items-center gap-6">
          <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="stroke-white/5" />
            </svg>
            <span className="relative text-3xl font-bold tabular-nums text-slate-500">
              &mdash;
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm text-slate-400">
              Your AI Health Score will appear after your first scan runs.
              Check back Monday, {nextSundayLabel()}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Data present — render full card ─────────────────────────────────────
  const dashOffset = circ - (score / 100) * circ;
  const description = gradeDescription(grade);

  const componentEntries = [
    { key: 'visibility', ...components.visibility },
    { key: 'accuracy', ...components.accuracy },
    { key: 'structure', ...components.structure },
    { key: 'freshness', ...components.freshness },
  ];

  return (
    <div
      className="rounded-2xl bg-surface-dark border border-white/5 p-5"
      data-testid="ai-health-score-card"
    >
      <h2 className="text-sm font-semibold text-white tracking-tight mb-4">
        AI Health Score
      </h2>

      {/* Score ring + grade */}
      <div className="flex items-center gap-6 mb-5">
        <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
          <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="stroke-white/5" />
            <circle
              cx="50" cy="50" r={r}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={dashOffset}
              className={ringStroke(score)}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div className="relative text-center">
            <span
              className={`text-3xl font-bold tabular-nums leading-none ${scoreTextColor(score)}`}
              data-testid="health-score-value"
            >
              {score}
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold ${gradeTextColor(grade)}`}
              data-testid="health-score-grade"
            >
              {grade}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-0.5">{description}</p>
        </div>
      </div>

      {/* Component bars */}
      <div className="space-y-2.5">
        {componentEntries.map((comp) => (
          <div key={comp.key} className="flex items-center gap-3">
            <span className="text-xs text-slate-500 w-20 shrink-0">{comp.label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full ${comp.score !== null ? barColor(comp.score) : ''} ${barWidthClass(comp.score)} transition-all duration-700`}
              />
            </div>
            <span className="text-xs tabular-nums text-slate-400 w-8 text-right">
              {comp.score !== null ? `${comp.score}%` : '—'}
            </span>
          </div>
        ))}
      </div>

      {/* Top Recommendation */}
      {topRecommendation && (
        <>
          <div className="border-t border-white/5 mt-4 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Top Recommendation
            </p>
            <p className="text-sm text-slate-300">
              {topRecommendation.title}
              <span className="text-signal-green ml-1">
                (+est. {topRecommendation.estimatedImpact} points)
              </span>
            </p>
            <Link
              href={topRecommendation.actionHref}
              className="mt-2 inline-flex items-center text-xs font-semibold text-electric-indigo hover:text-electric-indigo/80 transition-colors"
            >
              {topRecommendation.actionLabel} &rarr;
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
