// ---------------------------------------------------------------------------
// SOVVerdictPanel — Sprint H: Verdict-first panel for Share of Voice page.
//
// Shows the plain-English answer to "Am I winning or losing in AI search?"
// before any chart or data table.
// ---------------------------------------------------------------------------

import { cn } from '@/lib/utils';

interface SOVVerdictPanelProps {
  /** Current SOV percentage (0–100), or null if no data yet */
  currentPct: number | null;
  /** Previous-period SOV percentage (0–100), or null if only one snapshot */
  previousPct: number | null;
  /** Most-mentioned competitor and how many queries they appeared in */
  topCompetitor: { name: string; mentionCount: number } | null;
  /** Total evaluated queries for competitor context */
  totalQueries: number;
}

export default function SOVVerdictPanel({
  currentPct,
  previousPct,
  topCompetitor,
  totalQueries,
}: SOVVerdictPanelProps) {
  if (currentPct === null) {
    return (
      <div
        className="rounded-2xl border border-white/5 bg-surface-dark p-5"
        data-testid="sov-verdict-no-data"
      >
        <p className="text-sm text-muted-foreground">
          Share of Voice data is collecting. Check back after Sunday&apos;s scan.
        </p>
      </div>
    );
  }

  const delta = previousPct !== null ? currentPct - previousPct : null;

  return (
    <div
      className="rounded-2xl border border-white/5 bg-surface-dark p-5 space-y-4"
      data-testid="sov-verdict-panel"
    >
      {/* Primary verdict: score + delta */}
      <div>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold tabular-nums text-foreground">
            {currentPct.toFixed(0)}%
          </span>
          {delta !== null && (
            <span
              className={cn(
                'text-sm font-medium',
                delta > 0
                  ? 'text-signal-green'
                  : delta < 0
                    ? 'text-alert-crimson'
                    : 'text-muted-foreground',
              )}
              data-testid="sov-verdict-delta"
            >
              {delta > 0 ? '+' : ''}
              {delta.toFixed(0)} pts this week
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          of AI searches mention your business
        </p>
      </div>

      {/* Competitor context */}
      {topCompetitor && totalQueries > 0 && (
        <div
          className={cn(
            'rounded-md border px-4 py-3 text-sm',
            topCompetitor.mentionCount > totalQueries / 2
              ? 'bg-alert-amber/10 border-alert-amber/20 text-alert-amber'
              : 'bg-signal-green/10 border-signal-green/20 text-signal-green',
          )}
          data-testid="sov-competitor-verdict"
        >
          <span className="font-semibold">{topCompetitor.name}</span> appeared in{' '}
          <span className="font-semibold">{topCompetitor.mentionCount}</span> of{' '}
          {totalQueries} evaluated queries.
          {topCompetitor.mentionCount > totalQueries / 2 && (
            <span className="block mt-1 text-xs opacity-80">
              Fix hallucination alerts and add more citations to improve your position.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
