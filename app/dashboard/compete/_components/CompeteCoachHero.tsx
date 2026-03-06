// ---------------------------------------------------------------------------
// CompeteCoachHero — S6 competitor coaching hero
//
// Pure server component. CSS animations only.
//
// Replaces CompeteVerdictPanel with a coaching hero that makes the owner
// feel the competitive gap immediately:
//
//   • Win rate as the DOMINANT number in the orb — "38%" of intercepts
//   • Tier badge: "Winning" / "Competitive" / "Losing"
//   • lv-ping rings when Losing
//   • Who beats you most — top losing competitor coaching card
//   • Win/loss raw counts inline
//   • Single CTA tied to tier urgency
// ---------------------------------------------------------------------------

import Link from 'next/link';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import ConfettiTrigger from '@/components/ui/ConfettiTrigger';

// ─── Types ────────────────────────────────────────────────────────────────────

type CompeteTier = 'winning' | 'competitive' | 'losing' | 'no-data';

export interface CompeteCoachHeroProps {
  winCount:             number;
  lossCount:            number;
  businessName:         string;
  topLosingCompetitor:  { name: string; lossCount: number } | null;
}

// ─── Design constants ─────────────────────────────────────────────────────────

interface TierCfg {
  label:    string;
  headline: string;
  textHex:  string;
  ringRgba: string;
  glowRgba: string;
  pulse:    boolean;
  ctaText:  string;
  ctaHref:  string;
}

const TIER: Record<CompeteTier, TierCfg> = {
  'winning': {
    label:    'Winning',
    headline: "AI recommends you over your competitors more often than not — keep the edge sharp.",
    textHex:  '#00F5A0',
    ringRgba: 'rgba(0,245,160,0.35)',
    glowRgba: 'rgba(0,245,160,0.08)',
    pulse:    false,
    ctaText:  'See what keeps you ahead →',
    ctaHref:  '#intercepts',
  },
  'competitive': {
    label:    'Competitive',
    headline: "You win about half the AI recommendations — there are clear gaps you can close.",
    textHex:  '#FFB800',
    ringRgba: 'rgba(255,184,0,0.45)',
    glowRgba: 'rgba(255,184,0,0.10)',
    pulse:    false,
    ctaText:  "See where you're losing \u2192",
    ctaHref:  '#intercepts',
  },
  'losing': {
    label:    'Losing',
    headline: "Customers asking AI for recommendations are being sent to your competitors.",
    textHex:  '#ef4444',
    ringRgba: 'rgba(239,68,68,0.45)',
    glowRgba: 'rgba(239,68,68,0.10)',
    pulse:    true,
    ctaText:  'See the intercept details →',
    ctaHref:  '#intercepts',
  },
  'no-data': {
    label:    'No Data Yet',
    headline: "Add competitors above and run your first analysis to see who AI picks.",
    textHex:  '#64748b',
    ringRgba: 'rgba(100,116,139,0.30)',
    glowRgba: 'rgba(100,116,139,0.06)',
    pulse:    false,
    ctaText:  'Add a competitor to start →',
    ctaHref:  '#competitors',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTier(winCount: number, lossCount: number): CompeteTier {
  const total = winCount + lossCount;
  if (total === 0) return 'no-data';
  const rate = winCount / total;
  if (rate >= 0.6) return 'winning';
  if (rate >= 0.4) return 'competitive';
  return 'losing';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CompeteCoachHero({
  winCount,
  lossCount,
  businessName,
  topLosingCompetitor,
}: CompeteCoachHeroProps) {
  const total   = winCount + lossCount;
  const tier    = getTier(winCount, lossCount);
  const cfg     = TIER[tier];
  const hasData = total > 0;

  // Fire confetti the first time the owner achieves a winning state
  const shouldCelebrate = tier === 'winning';

  const winRatePct = hasData ? Math.round((winCount / total) * 100) : null;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/5 bg-surface-dark px-6 py-6"
      data-testid="compete-coach-hero"
    >
      {/* S8: Milestone confetti — fires once per session when winning */}
      <ConfettiTrigger fire={shouldCelebrate} storageKey="compete-winning" />

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
                    {winRatePct}%
                  </span>
                  <span
                    className="text-[10px] font-semibold leading-none mt-0.5"
                    style={{ color: cfg.textHex, fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                  >
                    win rate
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
        </div>

        {/* Right content */}
        <div className="flex-1 min-w-0">

          {/* Label + tooltip */}
          <div className="flex items-center gap-1.5 mb-3">
            <p
              className="text-[10px] font-bold uppercase tracking-widest text-slate-500"
              style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
            >
              AI Competitor Score
            </p>
            <InfoTooltip
              content={
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-white">How is this measured?</p>
                  <p className="text-xs text-slate-300">
                    We ask AI to compare your business against each competitor and record
                    which one it recommends.
                  </p>
                  <p className="text-xs text-slate-400">
                    Win rate = the percentage of matchups where AI picked you.
                  </p>
                </div>
              }
            />
          </div>

          {/* Headline */}
          <p className="text-base font-semibold text-white leading-snug">
            {cfg.headline}
          </p>

          {/* Win / Loss counts */}
          {hasData && (
            <div className="mt-2 flex items-baseline gap-4">
              <span className="flex items-baseline gap-1">
                <span
                  className="text-sm font-bold tabular-nums"
                  style={{ color: '#00F5A0', fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                  data-testid="compete-win-count"
                >
                  {winCount}W
                </span>
                <span className="text-xs text-slate-500">–</span>
                <span
                  className="text-sm font-bold tabular-nums"
                  style={{ color: '#ef4444', fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                  data-testid="compete-loss-count"
                >
                  {lossCount}L
                </span>
              </span>
              <span className="text-xs text-slate-400">across {total} matchup{total !== 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Top losing competitor coaching card */}
          {topLosingCompetitor && hasData && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-alert-amber/20 bg-alert-amber/5 px-3 py-2">
              <span className="mt-0.5 text-xs shrink-0" style={{ color: '#FFB800' }}>!</span>
              <p className="text-xs leading-relaxed" style={{ color: '#FFB800' }}>
                <span className="font-semibold">{topLosingCompetitor.name}</span> beats you in{' '}
                <span className="font-semibold">{topLosingCompetitor.lossCount}</span>{' '}
                matchup{topLosingCompetitor.lossCount !== 1 ? 's' : ''} — AI consistently picks them when customers ask for a recommendation.
              </p>
            </div>
          )}

          {!hasData && (
            <p className="mt-2 text-sm text-slate-400">
              Run your first analysis to see how {businessName} stacks up.
            </p>
          )}

          {/* CTA */}
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
        </div>
      </div>
    </div>
  );
}
