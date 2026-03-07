'use client';

import { Lightbulb, ArrowUpRight } from 'lucide-react';
import type { MenuSuggestion } from '@/lib/menu-intelligence/menu-optimizer';

// ---------------------------------------------------------------------------
// S43: MenuOptimizerCard — actionable menu improvement suggestions
// ---------------------------------------------------------------------------

interface MenuOptimizerCardProps {
  suggestions: MenuSuggestion[];
}

const IMPACT_STYLES: Record<string, string> = {
  high: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

export default function MenuOptimizerCard({ suggestions }: MenuOptimizerCardProps) {
  if (suggestions.length === 0) return null;

  return (
    <section data-testid="menu-optimizer-card" className="space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-amber-400" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-white">Menu Optimization Tips</h3>
      </div>

      <div className="space-y-2">
        {suggestions.map((s, i) => (
          <div
            key={i}
            className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3"
            data-testid="menu-suggestion"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white">{s.title}</p>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${IMPACT_STYLES[s.impact]}`}
                  >
                    {s.impact}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{s.description}</p>
              </div>
              <span className="shrink-0 text-xs text-slate-500">{s.effort}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
