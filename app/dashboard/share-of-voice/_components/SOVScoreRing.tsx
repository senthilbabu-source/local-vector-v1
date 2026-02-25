// ---------------------------------------------------------------------------
// SOVScoreRing — Aggregate SOV score display (Doc 06 §8.2)
//
// Server Component: no interactivity required.
// Displays the aggregate share-of-voice percentage from visibility_analytics
// as a circular ring with color thresholds, citation rate, and week-over-week delta.
//
// Design tokens: surface-dark, signal-green, amber-400, alert-crimson.
// Ring pattern adapted from RealityScoreCard's ScoreGauge.
// ---------------------------------------------------------------------------

interface SOVScoreRingProps {
  shareOfVoice: number | null;   // null = first scan hasn't run yet
  citationRate: number | null;
  weekOverWeekDelta: number | null;
}

// ---------------------------------------------------------------------------
// Color helpers (literal Tailwind classes — §12 safe for JIT scanner)
// ---------------------------------------------------------------------------

function ringStroke(pct: number): string {
  if (pct >= 40) return 'stroke-signal-green';
  if (pct >= 20) return 'stroke-amber-400';
  return 'stroke-alert-crimson';
}

function textColor(pct: number): string {
  if (pct >= 40) return 'text-signal-green';
  if (pct >= 20) return 'text-amber-400';
  return 'text-alert-crimson';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SOVScoreRing({
  shareOfVoice,
  citationRate,
  weekOverWeekDelta,
}: SOVScoreRingProps) {
  const r = 40;
  const circ = 2 * Math.PI * r;

  // ── Calculating state — no data yet ────────────────────────────────────
  if (shareOfVoice === null) {
    return (
      <div
        className="rounded-2xl bg-surface-dark border border-white/5 p-5"
        data-testid="sov-score-ring"
      >
        <h2 className="text-sm font-semibold text-white tracking-tight mb-4">
          AI Share of Voice
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
              Your first AI visibility scan runs Sunday. Check back Monday.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Data present — render ring + metrics ────────────────────────────────
  const displayPct = Math.round(shareOfVoice);
  const dashOffset = circ - (displayPct / 100) * circ;

  return (
    <div
      className="rounded-2xl bg-surface-dark border border-white/5 p-5"
      data-testid="sov-score-ring"
    >
      <h2 className="text-sm font-semibold text-white tracking-tight mb-4">
        AI Share of Voice
      </h2>
      <div className="flex items-center gap-6">
        {/* Circular gauge */}
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
              className={ringStroke(displayPct)}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div className="relative text-center">
            <span
              className={`text-3xl font-bold tabular-nums leading-none ${textColor(displayPct)}`}
              data-testid="sov-percentage"
            >
              {displayPct}%
            </span>
          </div>
        </div>

        {/* Metrics sidebar */}
        <div className="min-w-0 space-y-2">
          {/* Citation rate */}
          <div>
            <span className="text-xs text-slate-500 block">Citation Rate</span>
            <span className="text-sm font-semibold text-white tabular-nums">
              {citationRate !== null ? `${Math.round(citationRate)}%` : '—'}
            </span>
          </div>

          {/* Week-over-week delta */}
          {weekOverWeekDelta !== null && (
            <div data-testid="sov-delta">
              <span className="text-xs text-slate-500 block">vs Last Week</span>
              <span
                className={`text-sm font-semibold tabular-nums ${
                  weekOverWeekDelta >= 0 ? 'text-signal-green' : 'text-alert-crimson'
                }`}
              >
                {weekOverWeekDelta >= 0 ? '\u25B2' : '\u25BC'}{' '}
                {Math.abs(Math.round(weekOverWeekDelta * 100))}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
