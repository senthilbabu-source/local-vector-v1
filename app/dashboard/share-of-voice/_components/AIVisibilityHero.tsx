// ---------------------------------------------------------------------------
// AIVisibilityHero — S5 AI Mentions coaching hero
//
// Pure server component. No state or effects — CSS animations only.
//
// Replaces SOVVerdictPanel + SOVScoreRing + Quick Stats grid with a
// coaching hero that makes the owner feel the visibility gap instantly:
//
//   • Mention rate as the DOMINANT number in the orb — "33%" of AI searches
//   • Tier badge: "Leading" / "In The Game" / "Being Missed" / "Invisible"
//   • lv-ping rings when Being Missed or Invisible
//   • Per-engine rows: "ChatGPT — 45%  Perplexity — 22%"
//   • Competitor coaching card when a rival is dominating
//   • Week-over-week delta inline
//   • Single CTA tied to tier urgency
// ---------------------------------------------------------------------------

import Link from 'next/link';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import ConfettiTrigger from '@/components/ui/ConfettiTrigger';

// ─── Types ────────────────────────────────────────────────────────────────────

type VisibilityTier = 'leading' | 'in-the-game' | 'being-missed' | 'invisible' | 'no-data';

export interface EngineStats {
  pct: number;       // 0–100
  citedQueries: number;
  totalQueries: number;
}

export interface AIVisibilityHeroProps {
  shareOfVoice: number | null;           // 0–100, null = no scan yet
  weekOverWeekDeltaPct: number | null;   // percentage points diff, can be negative
  totalQueries: number;
  topCompetitor: { name: string; mentionCount: number } | null;
  engineStats: Record<string, EngineStats>;
  nextScanLabel: string;
  scanStreak: number;                    // consecutive weeks with scan data (0 = no streak)
}

// ─── Design constants ─────────────────────────────────────────────────────────

interface TierCfg {
  label:     string;
  headline:  string;
  textHex:   string;
  ringRgba:  string;
  glowRgba:  string;
  pulse:     boolean;
  ctaText:   string;
  ctaHref:   string;
}

const TIER: Record<VisibilityTier, TierCfg> = {
  'leading': {
    label:    'Leading',
    headline: 'You show up well when customers ask AI to recommend businesses like yours.',
    textHex:  '#00F5A0',
    ringRgba: 'rgba(0,245,160,0.35)',
    glowRgba: 'rgba(0,245,160,0.08)',
    pulse:    false,
    ctaText:  'See all tracked searches →',
    ctaHref:  '#queries',
  },
  'in-the-game': {
    label:    'In The Game',
    headline: "You're getting some AI mentions but missing searches where customers are deciding.",
    textHex:  '#FFB800',
    ringRgba: 'rgba(255,184,0,0.45)',
    glowRgba: 'rgba(255,184,0,0.10)',
    pulse:    false,
    ctaText:  'See what you\'re missing →',
    ctaHref:  '#gaps',
  },
  'being-missed': {
    label:    'Being Missed',
    headline: "Customers are asking AI for businesses like yours and you're not in the answer.",
    textHex:  '#f97316',
    ringRgba: 'rgba(249,115,22,0.40)',
    glowRgba: 'rgba(249,115,22,0.08)',
    pulse:    true,
    ctaText:  'See the searches you\'re missing →',
    ctaHref:  '#gaps',
  },
  'invisible': {
    label:    'Invisible',
    headline: "You don't show up when customers ask AI to find businesses like yours.",
    textHex:  '#ef4444',
    ringRgba: 'rgba(239,68,68,0.45)',
    glowRgba: 'rgba(239,68,68,0.10)',
    pulse:    true,
    ctaText:  'Fix your AI visibility →',
    ctaHref:  '#gaps',
  },
  'no-data': {
    label:    'Not Yet Scanned',
    headline: 'Run your first AI visibility check to see how often customers find you.',
    textHex:  '#64748b',
    ringRgba: 'rgba(100,116,139,0.30)',
    glowRgba: 'rgba(100,116,139,0.06)',
    pulse:    false,
    ctaText:  'See when your scan runs →',
    ctaHref:  '#queries',
  },
};

// ─── Engine display names ──────────────────────────────────────────────────────

const ENGINE_LABELS: Record<string, string> = {
  openai:     'ChatGPT',
  perplexity: 'Perplexity',
  gemini:     'Gemini',
  claude:     'Claude',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTier(pct: number | null): VisibilityTier {
  if (pct === null) return 'no-data';
  if (pct >= 40)    return 'leading';
  if (pct >= 20)    return 'in-the-game';
  if (pct >= 5)     return 'being-missed';
  return 'invisible';
}

function engineDotHex(pct: number): string {
  if (pct >= 40) return '#00F5A0';
  if (pct >= 20) return '#FFB800';
  return '#ef4444';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AIVisibilityHero({
  shareOfVoice,
  weekOverWeekDeltaPct,
  totalQueries,
  topCompetitor,
  engineStats,
  nextScanLabel,
  scanStreak,
}: AIVisibilityHeroProps) {
  const tier    = getTier(shareOfVoice);
  const cfg     = TIER[tier];
  const hasData = shareOfVoice !== null;

  // Fire confetti when the owner reaches Leading with a positive week-over-week improvement
  const shouldCelebrate = tier === 'leading' && (weekOverWeekDeltaPct ?? 0) > 0;

  const displayPct = hasData ? Math.round(shareOfVoice!) : null;

  // Is the competitor dominating (appears in >50% of queries)?
  const competitorDominates =
    topCompetitor && totalQueries > 0 &&
    topCompetitor.mentionCount > totalQueries * 0.5;

  // Engine rows — only engines that have run at least one query
  const engineRows = Object.entries(engineStats)
    .filter(([, s]) => s.totalQueries > 0)
    .map(([engine, s]) => ({
      name: ENGINE_LABELS[engine] ?? engine,
      pct:  Math.round(s.pct),
      hex:  engineDotHex(s.pct),
    }));

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/5 bg-surface-dark px-6 py-6"
      data-testid="ai-visibility-hero"
    >
      {/* S8: Milestone confetti — fires once per session when Leading + improving */}
      <ConfettiTrigger fire={shouldCelebrate} storageKey="sov-leading" />
      {/* ── lv-scan accent sweep on top edge ──────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden rounded-t-2xl"
        aria-hidden="true"
      >
        <div
          className="h-full w-1/3"
          style={{
            background: `linear-gradient(to right, transparent, ${cfg.textHex}, transparent)`,
            animation: 'lv-scan 4s linear infinite',
          }}
        />
      </div>

      {/* ── Ambient breathing glow ────────────────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        aria-hidden="true"
        style={{
          background: `radial-gradient(ellipse 70% 50% at 15% 55%, ${cfg.glowRgba} 0%, transparent 70%)`,
          animation: 'lv-orb-breathe 5s ease-in-out infinite',
        }}
      />

      {/* ── Main content ─────────────────────────────────────────────── */}
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8">

        {/* Orb — left */}
        <div className="flex flex-col items-center shrink-0">
          <div className="relative flex h-28 w-28 items-center justify-center">
            {/* Pulse rings — only for urgent tiers */}
            {cfg.pulse && (
              <>
                <span
                  className="absolute inset-0 rounded-full"
                  aria-hidden="true"
                  style={{
                    border: `1.5px solid ${cfg.ringRgba}`,
                    animation: 'lv-ping 2.4s cubic-bezier(0,0,0.2,1) 0ms infinite',
                  }}
                />
                <span
                  className="absolute inset-0 rounded-full"
                  aria-hidden="true"
                  style={{
                    border: `1.5px solid ${cfg.ringRgba}`,
                    animation: 'lv-ping 2.4s cubic-bezier(0,0,0.2,1) 900ms infinite',
                  }}
                />
              </>
            )}

            {/* Orb circle */}
            <span
              className="relative flex h-24 w-24 flex-col items-center justify-center rounded-full border-2"
              style={{
                borderColor: cfg.ringRgba,
                boxShadow: `0 0 24px ${cfg.ringRgba}, 0 0 48px ${cfg.glowRgba}`,
                animation: !hasData ? 'lv-orb-breathe 4s ease-in-out infinite' : undefined,
              }}
            >
              {hasData ? (
                <>
                  <span
                    className="text-2xl font-bold tabular-nums leading-tight"
                    style={{ color: cfg.textHex, fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                  >
                    {displayPct}%
                  </span>
                  <span
                    className="text-[10px] font-semibold leading-none mt-0.5"
                    style={{ color: cfg.textHex, fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                  >
                    of searches
                  </span>
                </>
              ) : (
                <span className="text-2xl text-slate-500" aria-label="No data yet">—</span>
              )}
            </span>
          </div>

          {/* Tier label */}
          <span
            className="mt-2 text-xs font-semibold"
            style={{
              color: cfg.textHex,
              fontFamily: 'var(--font-jetbrains-mono, monospace)',
            }}
          >
            {cfg.label}
          </span>

          {/* S8: Streak badge — show when 2+ consecutive weeks */}
          {scanStreak >= 2 && (
            <span
              className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
              style={{
                background: `${cfg.textHex}15`,
                color: cfg.textHex,
                border: `1px solid ${cfg.textHex}30`,
                fontFamily: 'var(--font-jetbrains-mono, monospace)',
              }}
              data-testid="scan-streak-badge"
            >
              {scanStreak}W streak
            </span>
          )}
        </div>

        {/* Right content */}
        <div className="flex-1 min-w-0">

          {/* Label + tooltip */}
          <div className="flex items-center gap-1.5 mb-3">
            <p
              className="text-[10px] font-bold uppercase tracking-widest text-slate-500"
              style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
            >
              AI Visibility
            </p>
            <InfoTooltip
              content={
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-white">How is this measured?</p>
                  <p className="text-xs text-slate-300">
                    We run your tracked searches through ChatGPT, Perplexity, and Gemini
                    and record whether your business appears in the answer.
                  </p>
                  <p className="text-xs text-slate-400">
                    The percentage shows how often you appear across all tracked searches.
                  </p>
                </div>
              }
            />
          </div>

          {/* Headline */}
          <p className="text-base font-semibold text-white leading-snug">
            {cfg.headline}
          </p>

          {/* Week-over-week delta */}
          {weekOverWeekDeltaPct !== null && (
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className="text-sm font-bold tabular-nums"
                style={{
                  color: weekOverWeekDeltaPct > 0 ? '#00F5A0'
                       : weekOverWeekDeltaPct < 0 ? '#ef4444'
                       : '#64748b',
                  fontFamily: 'var(--font-jetbrains-mono, monospace)',
                }}
                data-testid="visibility-delta"
              >
                {weekOverWeekDeltaPct > 0 ? '+' : ''}{weekOverWeekDeltaPct.toFixed(1)} pts
              </span>
              <span className="text-xs text-slate-400">vs last week</span>
            </div>
          )}

          {!hasData && (
            <p className="mt-2 text-sm text-slate-400">
              First scan runs {nextScanLabel}.
            </p>
          )}

          {/* Per-engine breakdown */}
          {engineRows.length > 0 && (
            <div className="mt-4 space-y-2">
              <p
                className="text-[10px] font-bold uppercase tracking-widest text-slate-500"
                style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
              >
                By AI app:
              </p>
              {engineRows.map(row => (
                <div key={row.name} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-xs text-slate-300">{row.name}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${row.pct}%`,
                        background: row.hex,
                        boxShadow: `0 0 4px ${row.hex}60`,
                      }}
                    />
                  </div>
                  <span
                    className="w-10 shrink-0 text-right text-xs font-mono tabular-nums"
                    style={{ color: row.hex }}
                  >
                    {row.pct}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Competitor coaching card */}
          {topCompetitor && hasData && (
            <div
              className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-2 ${
                competitorDominates
                  ? 'border-alert-amber/20 bg-alert-amber/5'
                  : 'border-white/5 bg-white/[0.02]'
              }`}
            >
              <span
                className="mt-0.5 text-xs shrink-0"
                style={{ color: competitorDominates ? '#FFB800' : '#64748b' }}
              >
                {competitorDominates ? '!' : 'i'}
              </span>
              <p className="text-xs leading-relaxed" style={{ color: competitorDominates ? '#FFB800' : '#94a3b8' }}>
                {competitorDominates
                  ? <><span className="font-semibold">{topCompetitor.name}</span> appears in more AI searches than you — they&apos;re taking customers who ask AI for a recommendation.</>
                  : <><span className="font-semibold">{topCompetitor.name}</span> is your most-mentioned competitor in AI responses.</>
                }
              </p>
            </div>
          )}

          {/* CTA */}
          {hasData && (
            <Link
              href={cfg.ctaHref}
              className="mt-4 inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
              style={{
                borderColor: `${cfg.textHex}40`,
                background: `${cfg.textHex}10`,
                color: cfg.textHex,
              }}
            >
              {cfg.ctaText}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
