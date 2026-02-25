'use client';

// ---------------------------------------------------------------------------
// EngineComparisonGrid — 4-column grid showing per-engine accuracy scores.
// ---------------------------------------------------------------------------

import type { EvaluationEngine } from '@/lib/schemas/evaluations';
import { ENGINE_WEIGHTS } from '@/lib/services/truth-audit.service';

interface EngineComparisonGridProps {
  engineScores: Record<EvaluationEngine, number | null>;
}

const ENGINE_META: Record<EvaluationEngine, { label: string; badge: string; badgeClass: string }> = {
  openai: {
    label: 'OpenAI',
    badge: 'AI',
    badgeClass: 'bg-signal-green/15 text-signal-green',
  },
  perplexity: {
    label: 'Perplexity',
    badge: 'PX',
    badgeClass: 'bg-electric-indigo/15 text-electric-indigo',
  },
  anthropic: {
    label: 'Anthropic',
    badge: 'AN',
    badgeClass: 'bg-amber-400/15 text-amber-400',
  },
  gemini: {
    label: 'Gemini',
    badge: 'GE',
    badgeClass: 'bg-sky-400/15 text-sky-400',
  },
};

function scoreBg(score: number | null): string {
  if (score === null) return 'bg-white/5 text-slate-400';
  if (score >= 90) return 'bg-signal-green/10 text-signal-green';
  if (score >= 70) return 'bg-alert-amber/10 text-alert-amber';
  if (score >= 50) return 'bg-orange-500/10 text-orange-400';
  return 'bg-alert-crimson/10 text-alert-crimson';
}

export default function EngineComparisonGrid({ engineScores }: EngineComparisonGridProps) {
  const engines: EvaluationEngine[] = ['openai', 'perplexity', 'anthropic', 'gemini'];

  return (
    <div className="rounded-xl bg-surface-dark border border-white/5 p-6" data-testid="engine-comparison-grid">
      <h2 className="text-sm font-semibold text-white mb-4">Engine Comparison</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {engines.map((engine) => {
          const meta = ENGINE_META[engine];
          const score = engineScores[engine];
          const weight = Math.round(ENGINE_WEIGHTS[engine] * 100);

          return (
            <div
              key={engine}
              className="flex flex-col items-center rounded-lg bg-midnight-slate border border-white/5 p-4"
            >
              {/* Badge */}
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold ${meta.badgeClass}`}
              >
                {meta.badge}
              </span>

              {/* Engine name */}
              <p className="mt-2 text-xs font-medium text-white">{meta.label}</p>

              {/* Score */}
              <span
                className={`mt-2 rounded-full px-2.5 py-0.5 text-sm font-bold ${scoreBg(score)}`}
              >
                {score !== null ? score : '—'}
              </span>

              {/* Weight */}
              <p className="mt-1 text-[10px] text-slate-500">
                Weight: {weight}%
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
