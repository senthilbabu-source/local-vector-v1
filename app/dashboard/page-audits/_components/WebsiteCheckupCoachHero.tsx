// ---------------------------------------------------------------------------
// WebsiteCheckupCoachHero — S12 Website Checkup (Page Audits) coaching hero
//
// Pure server component. No state or effects — CSS animations only.
// ConfettiTrigger fires once per session when avg score reaches 80+.
//
// Tiers (based on avg page score):
//   excellent  score ≥ 80 — green          — "AI can read your site well"
//   good       score ≥ 60 — blue           — "Good but improvable"
//   needs-work score ≥ 40 — amber          — "Key signals are missing"
//   not-ready  score < 40 — red + lv-ping  — "AI struggles to understand your site"
//   no-pages   total = 0  — slate          — "No pages audited yet"
//
// Orb shows the average score across all audited pages.
//
// Confetti: fires once per session when avgScore >= 80
// ---------------------------------------------------------------------------

import ConfettiTrigger from '@/components/ui/ConfettiTrigger';

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckupTier = 'excellent' | 'good' | 'needs-work' | 'not-ready' | 'no-pages';

export interface WebsiteCheckupCoachHeroProps {
  avgScore: number;
  total: number;
  /** Lowest-scoring page — shown in the coaching card */
  lowestPage: {
    url: string;
    score: number;
    topRecommendation: string | null;
  } | null;
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

const TIER: Record<CheckupTier, TierCfg> = {
  'excellent': {
    label:    'AI-Ready',
    headline: 'Your website is well-optimized for AI.',
    detail:   'Your pages have strong structure, clear facts, and good schema data. AI apps can read and reference your site accurately.',
    textHex:  '#00F5A0',
    ringRgba: 'rgba(0,245,160,0.45)',
    glowRgba: 'rgba(0,245,160,0.08)',
    pulse:    false,
  },
  'good': {
    label:    'Good Structure',
    headline: 'Your website has a solid foundation.',
    detail:   'Most pages are readable by AI, but a few improvements — like adding FAQ sections or clearer headings — would help AI apps reference you more often.',
    textHex:  '#60A5FA',
    ringRgba: 'rgba(96,165,250,0.40)',
    glowRgba: 'rgba(96,165,250,0.08)',
    pulse:    false,
  },
  'needs-work': {
    label:    'Needs Improvement',
    headline: 'Your website is missing key signals AI apps rely on.',
    detail:   'AI apps struggle to extract accurate facts from pages that lack structure. Adding FAQs, schema data, and clear headings has a direct impact on how often AI recommends your business.',
    textHex:  '#FFB800',
    ringRgba: 'rgba(255,184,0,0.40)',
    glowRgba: 'rgba(255,184,0,0.08)',
    pulse:    false,
  },
  'not-ready': {
    label:    'Not AI-Ready',
    headline: "AI apps can't reliably read your website.",
    detail:   'Pages without structured content, schema markup, or clear answers are often skipped by AI apps entirely. This directly reduces how often your business gets recommended.',
    textHex:  '#ef4444',
    ringRgba: 'rgba(239,68,68,0.45)',
    glowRgba: 'rgba(239,68,68,0.10)',
    pulse:    true,
  },
  'no-pages': {
    label:    'Not Audited',
    headline: "No pages have been audited yet.",
    detail:   "Add any public URL from your website to see how well AI can read and understand it. Start with your homepage or menu page.",
    textHex:  '#64748B',
    ringRgba: 'rgba(100,116,139,0.30)',
    glowRgba: 'rgba(100,116,139,0.06)',
    pulse:    false,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTier(avgScore: number, total: number): CheckupTier {
  if (total === 0) return 'no-pages';
  if (avgScore >= 80) return 'excellent';
  if (avgScore >= 60) return 'good';
  if (avgScore >= 40) return 'needs-work';
  return 'not-ready';
}

function scoreColor(score: number): string {
  if (score >= 80) return '#00F5A0';
  if (score >= 60) return '#60A5FA';
  if (score >= 40) return '#FFB800';
  return '#ef4444';
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === '/' ? '' : u.pathname;
    return (u.hostname + path).replace(/^www\./, '');
  } catch {
    return url.length > 40 ? url.slice(0, 40) + '…' : url;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WebsiteCheckupCoachHero({
  avgScore,
  total,
  lowestPage,
}: WebsiteCheckupCoachHeroProps) {
  const tier    = getTier(avgScore, total);
  const cfg     = TIER[tier];
  const hasData = total > 0;
  const isGreat = hasData && avgScore >= 80;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/5 bg-surface-dark px-6 py-6"
      data-testid="website-checkup-coach-hero"
    >
      {/* ── Confetti island — fires once when all pages score well ── */}
      <ConfettiTrigger fire={isGreat} storageKey="website-checkup-excellent" />

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

        {/* ── Score orb — left ── */}
        <div className="flex flex-col items-center shrink-0">
          <div className="relative flex h-28 w-28 items-center justify-center">

            {/* lv-ping rings — not-ready only */}
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
                    {avgScore}
                  </span>
                  <span
                    className="text-[9px] font-medium leading-none"
                    style={{ color: cfg.textHex, opacity: 0.75 }}
                  >
                    avg
                  </span>
                </>
              ) : (
                <span className="text-xl text-slate-500" aria-label="No pages audited">—</span>
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
            AI Readability Score
          </p>

          {/* Headline */}
          <p className="text-base font-semibold text-white leading-snug">
            {cfg.headline}
          </p>

          {/* Detail */}
          <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
            {cfg.detail}
          </p>

          {/* Stats row */}
          {hasData && (
            <div className="mt-4 flex flex-wrap gap-5">
              <div>
                <p
                  className="text-[10px] uppercase tracking-wide text-slate-500"
                  style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                >
                  Pages audited
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
                  Avg score
                </p>
                <p
                  className="text-lg font-bold tabular-nums"
                  style={{
                    color: scoreColor(avgScore),
                    fontFamily: 'var(--font-jetbrains-mono, monospace)',
                  }}
                >
                  {avgScore}
                  <span className="text-xs font-normal text-slate-500">/100</span>
                </p>
              </div>
            </div>
          )}

          {/* Score bar */}
          {hasData && (
            <div className="mt-3 max-w-xs">
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${avgScore}%`,
                    background: cfg.textHex,
                    boxShadow: `0 0 6px ${cfg.ringRgba}`,
                    transition: 'width 0.7s ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* Coaching card */}
          <div className="mt-4">
            {!hasData ? (
              /* No pages — point to the form */
              <div
                className="rounded-xl p-4"
                style={{
                  background: 'rgba(99,102,241,0.06)',
                  border: '1px solid rgba(99,102,241,0.20)',
                }}
              >
                <p className="text-xs font-semibold text-white">
                  Start by auditing your homepage or menu page
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Enter any public URL below. We score it on 5 dimensions that affect how AI apps understand your business.
                </p>
              </div>
            ) : lowestPage && lowestPage.score < 80 ? (
              /* Show the weakest page */
              <div
                className="rounded-xl p-4"
                style={{
                  background: `${scoreColor(lowestPage.score)}0d`,
                  border: `1px solid ${scoreColor(lowestPage.score)}2e`,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white">
                      Weakest page:{' '}
                      <span
                        className="font-mono text-slate-300"
                        style={{ fontSize: '10px' }}
                      >
                        {shortenUrl(lowestPage.url)}
                      </span>
                      <span
                        className="ml-2 text-xs font-bold"
                        style={{ color: scoreColor(lowestPage.score) }}
                      >
                        {lowestPage.score}/100
                      </span>
                    </p>
                    {lowestPage.topRecommendation && (
                      <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">
                        {lowestPage.topRecommendation}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* All pages excellent */
              <div
                className="flex items-center gap-3 rounded-xl p-4"
                style={{
                  background: 'rgba(0,245,160,0.06)',
                  border: '1px solid rgba(0,245,160,0.18)',
                }}
              >
                <span className="text-truth-emerald text-base" aria-hidden="true">✓</span>
                <p className="text-xs font-semibold text-truth-emerald">
                  All audited pages score 80 or above. Excellent AI readability!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
