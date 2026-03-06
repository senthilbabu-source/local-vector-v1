// ---------------------------------------------------------------------------
// QuestionsCoachHero — S13 Intent Discovery coaching hero
//
// Pure server component. No state or effects — CSS animations only.
// ConfettiTrigger fires once per session when all discovered questions
// are answered (gapCount === 0).
//
// Tiers (based on gap count vs covered count):
//   winning     gaps = 0, covered > 0 — green         — "All questions answered"
//   mostly      coverage ≥ 70%        — blue           — "Well covered with a few gaps"
//   gaps        coverage ≥ 40%        — amber          — "Missing customer questions"
//   missing     coverage < 40%        — red + lv-ping  — "Customers aren't finding answers"
//   no-data     nothing discovered    — slate          — "Discovery runs weekly"
//
// Orb shows:
//   • gapCount when > 0  (questions to act on — "unanswered")
//   • coveredCount when no gaps (achievement — "answered")
//   • "—" when no data
//
// Confetti: fires once per session when gapCount === 0 && coveredCount > 0
// ---------------------------------------------------------------------------

import ConfettiTrigger from '@/components/ui/ConfettiTrigger';

// ─── Types ────────────────────────────────────────────────────────────────────

type QuestionsTier = 'winning' | 'mostly' | 'gaps' | 'missing' | 'no-data';

export interface QuestionsCoachHeroProps {
  gapCount: number;
  coveredCount: number;
  topGapPrompt: string | null;
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

const TIER: Record<QuestionsTier, TierCfg> = {
  'winning': {
    label:    'Fully Covered',
    headline: 'Your business answers all the questions customers are asking.',
    detail:   'Excellent — when someone asks AI about your category, you have content that answers every discovered question. Keep checking back as new questions emerge.',
    textHex:  '#00F5A0',
    ringRgba: 'rgba(0,245,160,0.45)',
    glowRgba: 'rgba(0,245,160,0.08)',
    pulse:    false,
  },
  'mostly': {
    label:    'Well Covered',
    headline: "You answer most questions — a few gaps remain.",
    detail:   "You're present for most queries customers ask AI. Filling the remaining gaps will help you appear in more AI responses and capture more of those customers.",
    textHex:  '#60A5FA',
    ringRgba: 'rgba(96,165,250,0.40)',
    glowRgba: 'rgba(96,165,250,0.08)',
    pulse:    false,
  },
  'gaps': {
    label:    'Gaps Found',
    headline: 'Customers are asking questions your business does not answer.',
    detail:   "When someone asks one of these questions, a competitor gets the recommendation instead of you. Creating one post per gap is the fastest way to show up in AI answers.",
    textHex:  '#FFB800',
    ringRgba: 'rgba(255,184,0,0.40)',
    glowRgba: 'rgba(255,184,0,0.08)',
    pulse:    false,
  },
  'missing': {
    label:    'Critical Gaps',
    headline: "You're missing most of the questions customers ask AI.",
    detail:   'Competitors are capturing most AI-assisted customers in your category. Each unanswered question below is a direct opportunity to get recommended instead.',
    textHex:  '#ef4444',
    ringRgba: 'rgba(239,68,68,0.45)',
    glowRgba: 'rgba(239,68,68,0.10)',
    pulse:    true,
  },
  'no-data': {
    label:    'Scanning',
    headline: 'Looking for questions your customers are asking AI.',
    detail:   'Discovery runs every week. Your first results will appear after the next Thursday scan. We analyze AI responses in your category and flag every question your business does not answer.',
    textHex:  '#64748B',
    ringRgba: 'rgba(100,116,139,0.30)',
    glowRgba: 'rgba(100,116,139,0.06)',
    pulse:    false,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTier(gapCount: number, coveredCount: number): QuestionsTier {
  const total = gapCount + coveredCount;
  if (total === 0) return 'no-data';
  if (gapCount === 0) return 'winning';
  const coverage = coveredCount / total;
  if (coverage >= 0.7) return 'mostly';
  if (coverage >= 0.4) return 'gaps';
  return 'missing';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuestionsCoachHero({
  gapCount,
  coveredCount,
  topGapPrompt,
}: QuestionsCoachHeroProps) {
  const total     = gapCount + coveredCount;
  const tier      = getTier(gapCount, coveredCount);
  const cfg       = TIER[tier];
  const hasData   = total > 0;
  const allGood   = hasData && gapCount === 0;

  // Orb value: show gap count when there are gaps, covered count when all good
  const orbNumber = gapCount > 0 ? gapCount : coveredCount;
  const orbLabel  = gapCount > 0 ? 'unanswered' : 'answered';

  const coveragePct = total > 0 ? Math.round((coveredCount / total) * 100) : 0;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/5 bg-surface-dark px-6 py-6"
      data-testid="questions-coach-hero"
    >
      {/* ── Confetti island — fires once when all gaps are closed ── */}
      <ConfettiTrigger fire={allGood} storageKey="questions-all-covered" />

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

        {/* ── Question gap orb — left ── */}
        <div className="flex flex-col items-center shrink-0">
          <div className="relative flex h-28 w-28 items-center justify-center">

            {/* lv-ping rings — missing tier only */}
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
                    {orbNumber}
                  </span>
                  <span
                    className="text-[9px] font-medium leading-none text-center px-1"
                    style={{ color: cfg.textHex, opacity: 0.75 }}
                  >
                    {orbLabel}
                  </span>
                </>
              ) : (
                <span className="text-xl text-slate-500" aria-label="No data yet">—</span>
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
            AI Question Coverage
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
                  Gaps
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
                  Covered
                </p>
                <p
                  className="text-lg font-bold tabular-nums text-truth-emerald"
                  style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                >
                  {coveredCount}
                </p>
              </div>
              <div>
                <p
                  className="text-[10px] uppercase tracking-wide text-slate-500"
                  style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                >
                  Coverage
                </p>
                <p
                  className="text-lg font-bold tabular-nums"
                  style={{
                    color: coveragePct >= 70 ? '#00F5A0' : coveragePct >= 40 ? '#FFB800' : '#ef4444',
                    fontFamily: 'var(--font-jetbrains-mono, monospace)',
                  }}
                >
                  {coveragePct}%
                </p>
              </div>
            </div>
          )}

          {/* Coverage progress bar */}
          {hasData && (
            <div className="mt-3 max-w-xs">
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${coveragePct}%`,
                    background: cfg.textHex,
                    boxShadow: `0 0 6px ${cfg.ringRgba}`,
                    transition: 'width 0.7s ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* Coaching action card */}
          <div className="mt-4">
            {!hasData ? (
              <div
                className="rounded-xl p-4"
                style={{
                  background: 'rgba(100,116,139,0.08)',
                  border: '1px solid rgba(100,116,139,0.20)',
                }}
              >
                <p className="text-xs font-semibold text-slate-300">
                  Discovery runs every Thursday
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  We scan AI responses in your category and flag every question your business does not answer. Check back after the next run.
                </p>
              </div>
            ) : gapCount > 0 && topGapPrompt ? (
              /* Top unanswered question */
              <div
                className="rounded-xl p-4"
                style={{
                  background: `${cfg.textHex}0d`,
                  border: `1px solid ${cfg.textHex}2e`,
                }}
              >
                <p className="text-xs font-semibold text-white">
                  Top unanswered question:
                </p>
                <p
                  className="mt-1 text-xs text-slate-300 italic leading-relaxed"
                >
                  &ldquo;{topGapPrompt}&rdquo;
                </p>
                <p className="mt-1.5 text-xs text-slate-400">
                  Creating one post that answers this question directly will help AI apps recommend your business when customers ask it.
                </p>
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
                  No open gaps. Your business answers every question customers are asking AI right now.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
