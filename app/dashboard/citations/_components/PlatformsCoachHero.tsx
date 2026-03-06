// ---------------------------------------------------------------------------
// PlatformsCoachHero — S11 Citations / Platforms coaching hero
//
// Pure server component. No state or effects — CSS animations only.
// ConfettiTrigger fires once per session when coverage reaches 100%.
//
// Tiers (based on platform coverage score):
//   covered    score ≥ 80 — green          — "Most platforms know you"
//   good       score ≥ 60 — blue           — "Good coverage"
//   gaps       score ≥ 30 — amber          — "Missing key platforms"
//   invisible  score < 30 — red + lv-ping  — "AI can barely find you"
//   no-data    no platforms — slate        — "Scanning platforms"
//
// Orb shows the coverage % (how many important platforms have you listed).
//
// Confetti: fires once per session when gapScore >= 100
// ---------------------------------------------------------------------------

import Link from 'next/link';
import ConfettiTrigger from '@/components/ui/ConfettiTrigger';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlatformTier = 'covered' | 'good' | 'gaps' | 'invisible' | 'no-data';

export interface PlatformsCoachHeroProps {
  gapScore: number;
  platformsCovered: number;
  platformsThatMatter: number;
  topGapPlatform: string | null;
  topGapAction: string | null;
  topGapFrequency: number | null;
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

const TIER: Record<PlatformTier, TierCfg> = {
  'covered': {
    label:    'Well Covered',
    headline: 'Your business shows up on most platforms AI checks.',
    detail:   'Great coverage! AI apps like ChatGPT and Gemini pull from these platforms when answering local queries. Stay listed to maintain your visibility.',
    textHex:  '#00F5A0',
    ringRgba: 'rgba(0,245,160,0.45)',
    glowRgba: 'rgba(0,245,160,0.08)',
    pulse:    false,
  },
  'good': {
    label:    'Good Coverage',
    headline: "You're on most of the platforms that matter.",
    detail:   'Solid coverage across key AI reference sources. Filling the remaining gaps will help AI apps give more complete answers about your business.',
    textHex:  '#60A5FA',
    ringRgba: 'rgba(96,165,250,0.40)',
    glowRgba: 'rgba(96,165,250,0.08)',
    pulse:    false,
  },
  'gaps': {
    label:    'Gaps Found',
    headline: 'Some important platforms are missing your business.',
    detail:   'When customers ask AI apps about restaurants near them, your business may not appear because these platforms lack your listing. Each gap is a missed recommendation.',
    textHex:  '#FFB800',
    ringRgba: 'rgba(255,184,0,0.40)',
    glowRgba: 'rgba(255,184,0,0.08)',
    pulse:    false,
  },
  'invisible': {
    label:    'Nearly Invisible',
    headline: "AI apps can barely find your business online.",
    detail:   "Your business is missing from most of the platforms AI searches when customers ask for local recommendations. Every uncovered platform is a missed customer.",
    textHex:  '#ef4444',
    ringRgba: 'rgba(239,68,68,0.45)',
    glowRgba: 'rgba(239,68,68,0.10)',
    pulse:    true,
  },
  'no-data': {
    label:    'Scanning',
    headline: 'Platform data is being collected.',
    detail:   'The citation engine runs weekly. Your first coverage results will appear after the next scan.',
    textHex:  '#64748B',
    ringRgba: 'rgba(100,116,139,0.30)',
    glowRgba: 'rgba(100,116,139,0.06)',
    pulse:    false,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTier(gapScore: number, platformsThatMatter: number): PlatformTier {
  if (platformsThatMatter === 0) return 'no-data';
  if (gapScore >= 80) return 'covered';
  if (gapScore >= 60) return 'good';
  if (gapScore >= 30) return 'gaps';
  return 'invisible';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlatformsCoachHero({
  gapScore,
  platformsCovered,
  platformsThatMatter,
  topGapPlatform,
  topGapAction,
  topGapFrequency,
}: PlatformsCoachHeroProps) {
  const tier       = getTier(gapScore, platformsThatMatter);
  const cfg        = TIER[tier];
  const hasData    = platformsThatMatter > 0;
  const allCovered = hasData && gapScore >= 100;
  const gapCount   = Math.max(0, platformsThatMatter - platformsCovered);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/5 bg-surface-dark px-6 py-6"
      data-testid="platforms-coach-hero"
    >
      {/* ── Confetti island — fires once when fully covered ── */}
      <ConfettiTrigger fire={allCovered} storageKey="platforms-full-coverage" />

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

        {/* ── Coverage orb — left ── */}
        <div className="flex flex-col items-center shrink-0">
          <div className="relative flex h-28 w-28 items-center justify-center">

            {/* lv-ping rings — invisible only */}
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
                    className="text-2xl font-bold tabular-nums leading-tight"
                    style={{ color: cfg.textHex, fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                  >
                    {gapScore}
                  </span>
                  <span
                    className="text-[9px] font-medium leading-none"
                    style={{ color: cfg.textHex, opacity: 0.75 }}
                  >
                    / 100
                  </span>
                </>
              ) : (
                <span className="text-xl text-slate-500" aria-label="No data">—</span>
              )}
            </span>
          </div>

          {/* Tier label */}
          <span
            className="mt-2 text-xs font-semibold text-center"
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
            Platform Coverage
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
                  Covered
                </p>
                <p
                  className="text-lg font-bold tabular-nums text-truth-emerald"
                  style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                >
                  {platformsCovered}
                </p>
              </div>
              <div>
                <p
                  className="text-[10px] uppercase tracking-wide text-slate-500"
                  style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                >
                  Missing
                </p>
                <p
                  className="text-lg font-bold tabular-nums"
                  style={{
                    color: gapCount > 0 ? cfg.textHex : '#00F5A0',
                    fontFamily: 'var(--font-jetbrains-mono, monospace)',
                  }}
                >
                  {gapCount}
                </p>
              </div>
              <div>
                <p
                  className="text-[10px] uppercase tracking-wide text-slate-500"
                  style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                >
                  Total
                </p>
                <p
                  className="text-lg font-bold tabular-nums text-slate-300"
                  style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                >
                  {platformsThatMatter}
                </p>
              </div>
            </div>
          )}

          {/* Coverage progress bar */}
          {hasData && (
            <div className="mt-3 max-w-xs">
              <div className="flex items-center justify-between mb-1">
                <p
                  className="text-[10px] uppercase tracking-wide text-slate-500"
                  style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                >
                  AI Coverage
                </p>
                <p
                  className="text-[10px] tabular-nums text-slate-400"
                  style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                >
                  {platformsCovered}/{platformsThatMatter}
                </p>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${platformsThatMatter > 0 ? Math.round((platformsCovered / platformsThatMatter) * 100) : 0}%`,
                    background: cfg.textHex,
                    boxShadow: `0 0 6px ${cfg.ringRgba}`,
                    transition: 'width 0.7s ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* Coaching action card — top gap or all-clear */}
          {hasData && (
            <div className="mt-4">
              {topGapPlatform && topGapAction ? (
                /* Show the #1 gap to fix */
                <div
                  className="flex items-start justify-between gap-4 rounded-xl p-4"
                  style={{
                    background: `${cfg.textHex}0d`,
                    border: `1px solid ${cfg.textHex}2e`,
                  }}
                >
                  <div>
                    <p className="text-xs font-semibold text-white">
                      Biggest gap: {topGapPlatform}
                      {topGapFrequency !== null && (
                        <span className="ml-2 text-slate-400 font-normal">
                          cited in {Math.round(topGapFrequency * 100)}% of AI answers
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {topGapAction}
                    </p>
                  </div>
                  <Link
                    href="#platform-detail"
                    className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
                    style={{
                      background: `${cfg.textHex}26`,
                      color: cfg.textHex,
                      border: `1px solid ${cfg.textHex}4d`,
                    }}
                  >
                    Fix this →
                  </Link>
                </div>
              ) : (
                /* All covered */
                <div
                  className="flex items-center gap-3 rounded-xl p-4"
                  style={{
                    background: 'rgba(0,245,160,0.06)',
                    border: '1px solid rgba(0,245,160,0.18)',
                  }}
                >
                  <span className="text-truth-emerald text-base" aria-hidden="true">✓</span>
                  <p className="text-xs font-semibold text-truth-emerald">
                    Fully covered — AI apps can find you on every major platform.
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
