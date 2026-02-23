// Server Component — no interactivity required for Phase 13.
// Score expansion ("click to show breakdown") is deferred to a future phase.

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RealityScoreCardProps {
  realityScore: number | null; // null until first SOV snapshot runs (Phase 5)
  visibility:   number | null; // null until first SOV snapshot; live from visibility_analytics
  accuracy:     number;        // 0–100; degrades with open alert count
  dataHealth:   number;        // 0–100
  openAlertCount: number;      // used for the sub-headline only
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Color class for a 0–100 score: emerald ≥80, amber 60–79, crimson <60. */
function scoreColor(score: number): string {
  if (score >= 80) return 'text-truth-emerald';
  if (score >= 60) return 'text-amber-400';
  return 'text-alert-crimson';
}

/** SVG stroke color matching scoreColor. */
function ringColor(score: number): string {
  if (score >= 80) return 'stroke-truth-emerald';
  if (score >= 60) return 'stroke-amber-400';
  return 'stroke-alert-crimson';
}

/**
 * Explicit bar fill class — must be a literal string so Tailwind JIT includes
 * it. Do NOT derive via string replacement (`scoreColor().replace('text-','bg-')`)
 * because the scanner won't detect dynamically constructed class names.
 */
function barFillColor(score: number): string {
  if (score >= 80) return 'bg-truth-emerald';
  if (score >= 60) return 'bg-amber-400';
  return 'bg-alert-crimson';
}

// ---------------------------------------------------------------------------
// ScoreGauge — circular SVG badge
// ---------------------------------------------------------------------------

function ScoreGauge({ score }: { score: number | null }) {
  // SVG circle: r=40, circumference ≈ 251.3
  const r = 40;
  const circ = 2 * Math.PI * r;

  if (score === null) {
    return (
      <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="stroke-white/5" />
        </svg>
        <div className="relative text-center">
          <span className="text-3xl font-bold tabular-nums leading-none text-slate-500">—</span>
          <span className="block text-xs text-slate-600 leading-none mt-0.5">/100</span>
        </div>
      </div>
    );
  }

  const dashOffset = circ - (score / 100) * circ;

  return (
    <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
      {/* Background track */}
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50" cy="50" r={r}
          fill="none"
          strokeWidth="8"
          className="stroke-white/5"
        />
        {/* Filled arc */}
        <circle
          cx="50" cy="50" r={r}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          className={ringColor(score)}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      {/* Score number */}
      <div className="relative text-center">
        <span className={['text-3xl font-bold tabular-nums leading-none', scoreColor(score)].join(' ')}>
          {score}
        </span>
        <span className="block text-xs text-slate-500 leading-none mt-0.5">/100</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ComponentBar — single score row with label + bar + value
// ---------------------------------------------------------------------------

function ComponentBar({
  label,
  score,
}: {
  label: string;
  score: number | null;
}) {
  if (score === null) {
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-400">{label}</span>
          <span className="text-xs font-medium text-slate-500">Pending</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/5" aria-hidden />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400">{label}</span>
        <span className={['text-xs font-bold tabular-nums', scoreColor(score)].join(' ')}>
          {score}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/5">
        <div
          className={['h-1.5 rounded-full', barFillColor(score)].join(' ')}
          style={{ width: `${score}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RealityScoreCard
// ---------------------------------------------------------------------------

export default function RealityScoreCard({
  realityScore,
  visibility,
  accuracy,
  dataHealth,
  openAlertCount,
}: RealityScoreCardProps) {
  const subline =
    realityScore === null
      ? 'First AI visibility scan runs Sunday at 2 AM. Check back Monday.'
      : openAlertCount === 0
        ? 'All clear — no AI lies detected'
        : `${openAlertCount} open ${openAlertCount === 1 ? 'alert is' : 'alerts are'} lowering your Accuracy score`;

  return (
    <section
      aria-label="Reality Score Card"
      className="rounded-2xl bg-surface-dark border border-white/5 p-5"
    >
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white tracking-tight">
            Reality Score
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{subline}</p>
        </div>
        {/* Doc 06 §8.2: tabular-nums on all scores */}
        <span className="text-xs font-medium text-slate-500 tabular-nums">
          Updated just now
        </span>
      </div>

      {/* ── Gauge + Components ────────────────────────────────────── */}
      <div className="flex items-center gap-6">
        {/* Left: circular gauge */}
        <ScoreGauge score={realityScore} />

        {/* Right: component breakdown bars */}
        <div className="flex-1 space-y-3 min-w-0">
          <ComponentBar label="Visibility"   score={visibility} />
          <ComponentBar label="Accuracy"     score={accuracy} />
          <ComponentBar label="Data Health"  score={dataHealth} />
        </div>
      </div>

      {/* ── Crawl Health (hardcoded bots — Doc 06 §3) ────────────── */}
      <div className="mt-4 pt-4 border-t border-white/5">
        <p className="text-xs text-slate-500 mb-2">Crawl Health (last 24h)</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {[
            { bot: 'GPTBot',      time: '2h ago' },
            { bot: 'Perplexity',  time: '5h ago' },
            { bot: 'Google',      time: '1d ago' },
          ].map(({ bot, time }) => (
            <span key={bot} className="text-xs text-slate-400">
              <span className="text-slate-300 font-medium">{bot}</span>
              {' · '}
              {time}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
