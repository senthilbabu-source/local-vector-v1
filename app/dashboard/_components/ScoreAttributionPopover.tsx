'use client';

// ---------------------------------------------------------------------------
// ScoreAttributionPopover — S16 (Wave 1, AI_RULES §216)
//
// Popover showing what drove the Reality Score change since the previous
// snapshot. Renders as a small info icon next to the score delta.
//
// Rules:
//   - Only shown when prevScoreSnapshot is not null
//   - Shows delta for each component: accuracy, visibility, data health
//   - Positive delta → green, negative → red, zero → neutral
//   - data-testid="score-attribution-popover"
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { Info } from 'lucide-react';
import type { ScoreSnapshot } from '@/lib/data/dashboard';

interface ScoreAttributionPopoverProps {
  current: {
    accuracy_score: number | null;
    visibility_score: number | null;
    data_health_score: number | null;
    reality_score: number | null;
  };
  previous: ScoreSnapshot;
}

interface ScoreRow {
  label: string;
  current: number | null;
  previous: number | null;
}

function delta(curr: number | null, prev: number | null): number | null {
  if (curr == null || prev == null) return null;
  return Math.round(curr - prev);
}

function DeltaBadge({ d }: { d: number | null }) {
  if (d == null) return <span className="text-slate-500 text-xs">—</span>;
  if (d > 0) return <span className="text-signal-green text-xs font-medium">+{d}</span>;
  if (d < 0) return <span className="text-alert-crimson text-xs font-medium">{d}</span>;
  return <span className="text-slate-500 text-xs">0</span>;
}

export default function ScoreAttributionPopover({
  current,
  previous,
}: ScoreAttributionPopoverProps) {
  const [open, setOpen] = useState(false);

  const rows: ScoreRow[] = [
    { label: 'AI Accuracy', current: current.accuracy_score != null ? Math.round(current.accuracy_score) : null, previous: previous.accuracy_score != null ? Math.round(previous.accuracy_score) : null },
    { label: 'AI Visibility', current: current.visibility_score != null ? Math.round(current.visibility_score) : null, previous: previous.visibility_score != null ? Math.round(previous.visibility_score) : null },
    { label: 'Data Health', current: current.data_health_score != null ? Math.round(current.data_health_score) : null, previous: previous.data_health_score != null ? Math.round(previous.data_health_score) : null },
  ];

  const overallDelta = delta(current.reality_score, previous.reality_score);

  return (
    <div className="relative inline-block" data-testid="score-attribution-popover">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        aria-label="What changed in your score"
        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-slate-500 hover:text-slate-300 transition-colors"
        data-testid="score-attribution-trigger"
      >
        {overallDelta != null && (
          <span className={`text-xs font-semibold ${overallDelta > 0 ? 'text-signal-green' : overallDelta < 0 ? 'text-alert-crimson' : 'text-slate-500'}`}>
            {overallDelta > 0 ? `+${overallDelta}` : overallDelta}
          </span>
        )}
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <button
            type="button"
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-label="Close"
            tabIndex={-1}
          />
          {/* Panel */}
          <div
            className="absolute left-0 top-full z-20 mt-1 min-w-[220px] rounded-xl border border-white/10 bg-card p-3 shadow-xl"
            data-testid="score-attribution-panel"
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              What changed
            </p>
            <div className="space-y-1.5">
              {rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">{row.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 tabular-nums">
                      {row.previous ?? '—'}
                    </span>
                    <span className="text-slate-600">→</span>
                    <span className="text-xs text-foreground tabular-nums">
                      {row.current ?? '—'}
                    </span>
                    <DeltaBadge d={delta(row.current, row.previous)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
