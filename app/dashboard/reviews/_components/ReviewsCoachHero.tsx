// ---------------------------------------------------------------------------
// ReviewsCoachHero — S9 Reviews coaching hero
//
// Pure server component. No state or effects — CSS animations only.
// ConfettiTrigger client island fires once per session when all reviews
// have been replied to.
//
// Tiers (based on avg star rating):
//   loved      ≥ 4.5 ★  — emerald green — "Customers love you"
//   solid      ≥ 4.0 ★  — blue          — "Strong reputation"
//   mixed      ≥ 3.5 ★  — amber         — "Some room to improve"
//   at-risk    < 3.5 ★  — red + lv-ping — "Reputation needs attention"
//   no-data    0 reviews — slate         — "No reviews yet"
//
// Animations:
//   • lv-scan   — accent sweep on top border edge
//   • lv-orb-breathe — ambient radial glow pulses behind orb
//   • lv-ping   — expansion rings on orb when at-risk
//
// Confetti: fires once per session when pending === 0 && published > 0
// ---------------------------------------------------------------------------

import Link from 'next/link';
import ConfettiTrigger from '@/components/ui/ConfettiTrigger';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReviewTier = 'loved' | 'solid' | 'mixed' | 'at-risk' | 'no-data';

export interface ReviewsCoachHeroProps {
  avgRating: number;
  total: number;
  pending: number;
  published: number;
}

// ─── Design constants ─────────────────────────────────────────────────────────

interface TierCfg {
  label:    string;
  headline: string;
  detail:   string;
  textHex:  string;
  ringRgba: string;
  glowRgba: string;
  pulse:    boolean;
}

const TIER: Record<ReviewTier, TierCfg> = {
  'loved': {
    label:    'Loved',
    headline: 'Customers love your business.',
    detail:   'Excellent ratings — keep the streak going by replying to every review. It signals quality to AI apps and shows future customers you care.',
    textHex:  '#00F5A0',
    ringRgba: 'rgba(0,245,160,0.45)',
    glowRgba: 'rgba(0,245,160,0.08)',
    pulse:    false,
  },
  'solid': {
    label:    'Solid',
    headline: 'You have a strong reputation.',
    detail:   'Good ratings across the board. Responding to every review — especially the lower-star ones — shows you care and pushes your average higher.',
    textHex:  '#60A5FA',
    ringRgba: 'rgba(96,165,250,0.40)',
    glowRgba: 'rgba(96,165,250,0.08)',
    pulse:    false,
  },
  'mixed': {
    label:    'Mixed',
    headline: 'Some customers are not fully happy.',
    detail:   'A few low ratings are pulling your average down. A personal reply to unhappy customers can turn a bad experience into a loyal one.',
    textHex:  '#FFB800',
    ringRgba: 'rgba(255,184,0,0.40)',
    glowRgba: 'rgba(255,184,0,0.08)',
    pulse:    false,
  },
  'at-risk': {
    label:    'Needs Attention',
    headline: 'Your reputation is hurting your business.',
    detail:   'Low ratings are a red flag for both AI apps and new customers searching for a place to eat. Respond to every review this week — it makes a real difference.',
    textHex:  '#ef4444',
    ringRgba: 'rgba(239,68,68,0.45)',
    glowRgba: 'rgba(239,68,68,0.10)',
    pulse:    true,
  },
  'no-data': {
    label:    'No Reviews Yet',
    headline: 'No reviews synced yet.',
    detail:   'Once your reviews are connected, we will draft AI-powered replies and track your reputation score right here.',
    textHex:  '#64748B',
    ringRgba: 'rgba(100,116,139,0.30)',
    glowRgba: 'rgba(100,116,139,0.06)',
    pulse:    false,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTier(avgRating: number, total: number): ReviewTier {
  if (total === 0) return 'no-data';
  if (avgRating >= 4.5) return 'loved';
  if (avgRating >= 4.0) return 'solid';
  if (avgRating >= 3.5) return 'mixed';
  return 'at-risk';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReviewsCoachHero({
  avgRating,
  total,
  pending,
  published,
}: ReviewsCoachHeroProps) {
  const tier      = getTier(avgRating, total);
  const cfg       = TIER[tier];
  const hasData   = total > 0;
  const responded = published + (total - pending - published); // published + skipped/approved
  const allCaughtUp = hasData && pending === 0 && published > 0;

  // Response rate: of reviews that had drafts generated, how many were replied to
  const denominator  = published + pending;
  const responseRate = denominator > 0 ? Math.round((published / denominator) * 100) : 0;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/5 bg-surface-dark px-6 py-6"
      data-testid="reviews-coach-hero"
    >
      {/* ── Confetti island — fires once when all caught up ── */}
      <ConfettiTrigger fire={allCaughtUp} storageKey="reviews-all-caught-up" />

      {/* ── lv-scan accent sweep on top edge ── */}
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

      {/* ── Ambient breathing glow ── */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        aria-hidden="true"
        style={{
          background: `radial-gradient(ellipse 70% 50% at 15% 55%, ${cfg.glowRgba} 0%, transparent 70%)`,
          animation: 'lv-orb-breathe 5s ease-in-out infinite',
        }}
      />

      {/* ── Main two-column layout ── */}
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8">

        {/* ── Rating orb — left ── */}
        <div className="flex flex-col items-center shrink-0">
          <div className="relative flex h-28 w-28 items-center justify-center">

            {/* lv-ping rings — at-risk only */}
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
              }}
            >
              {hasData ? (
                <>
                  <span
                    className="text-sm font-semibold leading-none"
                    style={{ color: cfg.textHex }}
                    aria-hidden="true"
                  >
                    ★
                  </span>
                  <span
                    className="text-2xl font-bold tabular-nums leading-tight"
                    style={{ color: cfg.textHex, fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                  >
                    {avgRating.toFixed(1)}
                  </span>
                </>
              ) : (
                <span className="text-xl text-slate-500" aria-label="No rating data">—</span>
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

        {/* ── Right content ── */}
        <div className="flex-1 min-w-0">

          {/* Section label */}
          <p
            className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500"
            style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
          >
            Your Reputation
          </p>

          {/* Headline */}
          <p className="text-base font-semibold text-white leading-snug">
            {cfg.headline}
          </p>

          {/* Detail */}
          <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
            {cfg.detail}
          </p>

          {/* Inline stats row */}
          {hasData && (
            <div className="mt-4 flex flex-wrap gap-5">
              <div>
                <p
                  className="text-[10px] uppercase tracking-wide text-slate-500"
                  style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                >
                  Total
                </p>
                <p
                  className="text-lg font-bold tabular-nums text-white"
                  style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                >
                  {total}
                </p>
              </div>
              <div>
                <p
                  className="text-[10px] uppercase tracking-wide text-slate-500"
                  style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                >
                  Need Reply
                </p>
                <p
                  className="text-lg font-bold tabular-nums"
                  style={{
                    color: pending > 0 ? '#FFB800' : '#00F5A0',
                    fontFamily: 'var(--font-jetbrains-mono, monospace)',
                  }}
                >
                  {pending}
                </p>
              </div>
              <div>
                <p
                  className="text-[10px] uppercase tracking-wide text-slate-500"
                  style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                >
                  Replied
                </p>
                <p
                  className="text-lg font-bold tabular-nums text-truth-emerald"
                  style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                >
                  {published}
                </p>
              </div>
            </div>
          )}

          {/* Response rate progress bar */}
          {hasData && denominator > 0 && (
            <div className="mt-3 max-w-xs">
              <div className="flex items-center justify-between mb-1">
                <p
                  className="text-[10px] uppercase tracking-wide text-slate-500"
                  style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                >
                  Response rate
                </p>
                <p
                  className="text-[10px] tabular-nums text-slate-400"
                  style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                >
                  {responseRate}%
                </p>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${responseRate}%`,
                    background: responseRate === 100 ? '#00F5A0' : '#FFB800',
                    boxShadow: `0 0 6px ${responseRate === 100 ? 'rgba(0,245,160,0.4)' : 'rgba(255,184,0,0.4)'}`,
                    transition: 'width 0.7s ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* Coaching action card */}
          {hasData && (
            <div className="mt-4">
              {pending > 0 ? (
                /* Pending: show urgency + CTA */
                <div
                  className="flex items-start justify-between gap-4 rounded-xl p-4"
                  style={{
                    background: 'rgba(255,184,0,0.06)',
                    border: '1px solid rgba(255,184,0,0.18)',
                  }}
                >
                  <div>
                    <p className="text-xs font-semibold text-white">
                      {pending} review{pending !== 1 ? 's' : ''} waiting for your reply
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Responding within 24 hours improves your standing with AI apps and shows future customers you care.
                    </p>
                  </div>
                  <Link
                    href="#needs-response"
                    className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
                    style={{
                      background: 'rgba(255,184,0,0.15)',
                      color: '#FFB800',
                      border: '1px solid rgba(255,184,0,0.30)',
                    }}
                  >
                    Reply now →
                  </Link>
                </div>
              ) : (
                /* All caught up */
                <div
                  className="flex items-center gap-3 rounded-xl p-4"
                  style={{
                    background: 'rgba(0,245,160,0.06)',
                    border: '1px solid rgba(0,245,160,0.18)',
                  }}
                >
                  <span className="text-truth-emerald text-base" aria-hidden="true">✓</span>
                  <p className="text-xs font-semibold text-truth-emerald">
                    All caught up — every review has been replied to. Nice work!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
