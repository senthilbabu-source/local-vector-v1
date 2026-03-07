'use client';

import { Check, X } from 'lucide-react';
import type { AgentReadinessSummary } from '@/lib/services/agent-readiness-summary';

// ---------------------------------------------------------------------------
// S38: AgentReadinessTeaser — 4 yes/no indicators on dashboard
// Hidden in sample mode.
// ---------------------------------------------------------------------------

interface AgentReadinessTeaserProps {
  summary: AgentReadinessSummary;
  sampleMode: boolean;
}

const INDICATORS: { key: keyof AgentReadinessSummary; label: string }[] = [
  { key: 'canBook', label: 'Can AI book a table?' },
  { key: 'canOrder', label: 'Can AI order food?' },
  { key: 'canFindHours', label: 'Can AI find your hours?' },
  { key: 'canSeeMenu', label: 'Can AI see your menu?' },
];

export default function AgentReadinessTeaser({ summary, sampleMode }: AgentReadinessTeaserProps) {
  if (sampleMode) return null;

  const allFalse = !summary.canBook && !summary.canOrder && !summary.canFindHours && !summary.canSeeMenu;
  if (allFalse) return null;

  return (
    <section
      className="rounded-2xl bg-surface-dark border border-white/5 px-5 py-4"
      data-testid="agent-readiness-teaser"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white">AI Agent Readiness</h2>
        <a
          href="/dashboard/agent-readiness"
          className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          data-testid="agent-readiness-teaser-link"
        >
          Improve your AI readiness &rarr;
        </a>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {INDICATORS.map(({ key, label }) => {
          const ready = summary[key];
          return (
            <div
              key={key}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${
                ready
                  ? 'bg-emerald-500/5 border-emerald-500/10'
                  : 'bg-red-500/5 border-red-500/10'
              }`}
              data-testid={`agent-readiness-${key}`}
            >
              {ready ? (
                <Check className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden="true" />
              ) : (
                <X className="h-4 w-4 text-red-400 shrink-0" aria-hidden="true" />
              )}
              <span className="text-xs font-medium text-slate-300">
                {label}
              </span>
              <span className="sr-only">{ready ? 'Yes' : 'No'}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
