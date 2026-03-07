'use client';

import { Zap } from 'lucide-react';
import type { QuickWin } from '@/lib/services/quick-win';

// ---------------------------------------------------------------------------
// S39: QuickWinCard — single highest-impact action on dashboard
// Rendered before the header as a full-width accent card.
// Hidden when null.
// ---------------------------------------------------------------------------

interface QuickWinCardProps {
  quickWin: QuickWin | null;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'border-red-500/30 bg-red-500/5',
  high: 'border-amber-500/30 bg-amber-500/5',
  medium: 'border-violet-500/30 bg-violet-500/5',
  low: 'border-slate-500/30 bg-slate-500/5',
};

const SEVERITY_ICON_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-amber-400',
  medium: 'text-violet-400',
  low: 'text-slate-400',
};

const SEVERITY_CTA_COLORS: Record<string, string> = {
  critical: 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20',
  high: 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20',
  medium: 'bg-violet-500/10 border-violet-500/30 text-violet-400 hover:bg-violet-500/20',
  low: 'bg-slate-500/10 border-slate-500/30 text-slate-400 hover:bg-slate-500/20',
};

export default function QuickWinCard({ quickWin }: QuickWinCardProps) {
  if (!quickWin) return null;

  const borderBg = SEVERITY_COLORS[quickWin.severity] ?? SEVERITY_COLORS.low;
  const iconColor = SEVERITY_ICON_COLORS[quickWin.severity] ?? SEVERITY_ICON_COLORS.low;
  const ctaColor = SEVERITY_CTA_COLORS[quickWin.severity] ?? SEVERITY_CTA_COLORS.low;

  return (
    <section
      className={`rounded-2xl border px-5 py-4 ${borderBg}`}
      data-testid="quick-win-card"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5">
          <Zap className={`h-4 w-4 ${iconColor}`} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{quickWin.action}</p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-slate-400">{quickWin.timeEstimate}</span>
            {quickWin.estimatedRecovery > 0 && (
              <span className="text-xs font-semibold text-emerald-400">
                ~${quickWin.estimatedRecovery.toLocaleString()}/mo recovery
              </span>
            )}
          </div>
        </div>
        <a
          href={quickWin.href}
          className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${ctaColor}`}
          data-testid="quick-win-cta"
        >
          {quickWin.ctaText}
        </a>
      </div>
    </section>
  );
}
