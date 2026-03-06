// ---------------------------------------------------------------------------
// PostsCoachHero — S10 Content Drafts (Posts) coaching hero
//
// Pure server component. No state or effects — CSS animations only.
// ConfettiTrigger fires once per session when all drafts are reviewed.
//
// Tiers (based on pending review queue):
//   on-fire   draftCount ≥ 5  — amber + lv-ping — "Lots of posts waiting"
//   incoming  draftCount > 0  — blue             — "Posts ready to review"
//   all-clear draftCount = 0, total > 0 — green  — "All caught up"
//   building  total = 0       — slate             — "Posts will appear here"
//
// Orb shows:
//   • draftCount when draftCount > 0  (action number — "to review")
//   • publishedCount when all clear   (achievement number — "published")
//   • "—" when empty
//
// Confetti: fires once per session when draftCount === 0 && total > 0
// ---------------------------------------------------------------------------

import Link from 'next/link';
import ConfettiTrigger from '@/components/ui/ConfettiTrigger';

// ─── Types ────────────────────────────────────────────────────────────────────

type PostsTier = 'on-fire' | 'incoming' | 'all-clear' | 'building';

export interface PostsCoachHeroProps {
  total: number;
  draftCount: number;
  approvedCount: number;
  publishedCount: number;
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

const TIER: Record<PostsTier, TierCfg> = {
  'on-fire': {
    label:    'Review Needed',
    headline: 'AI-written posts are piling up — take a minute to review.',
    detail:   'Each approved post signals to Google and AI apps that your business is active and well-described. Approving takes less than a minute per post.',
    textHex:  '#FFB800',
    ringRgba: 'rgba(255,184,0,0.45)',
    glowRgba: 'rgba(255,184,0,0.10)',
    pulse:    true,
  },
  'incoming': {
    label:    'Ready to Review',
    headline: 'New posts are ready for your approval.',
    detail:   'Your AI has drafted content based on what customers are asking about. A quick review and approve is all it takes to get them published.',
    textHex:  '#60A5FA',
    ringRgba: 'rgba(96,165,250,0.40)',
    glowRgba: 'rgba(96,165,250,0.08)',
    pulse:    false,
  },
  'all-clear': {
    label:    'All Reviewed',
    headline: 'All posts have been reviewed. Great work!',
    detail:   'Your published posts are helping AI apps learn what makes your business special. New drafts will appear here as your AI monitors trends and competitor gaps.',
    textHex:  '#00F5A0',
    ringRgba: 'rgba(0,245,160,0.40)',
    glowRgba: 'rgba(0,245,160,0.08)',
    pulse:    false,
  },
  'building': {
    label:    'Getting Started',
    headline: 'Your first AI-written post is on its way.',
    detail:   'Posts are auto-generated overnight when LocalVector spots a competitor outranking you on an AI search query. Check back tomorrow.',
    textHex:  '#64748B',
    ringRgba: 'rgba(100,116,139,0.30)',
    glowRgba: 'rgba(100,116,139,0.06)',
    pulse:    false,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTier(total: number, draftCount: number): PostsTier {
  if (total === 0) return 'building';
  if (draftCount === 0) return 'all-clear';
  if (draftCount >= 5) return 'on-fire';
  return 'incoming';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PostsCoachHero({
  total,
  draftCount,
  approvedCount,
  publishedCount,
}: PostsCoachHeroProps) {
  const tier       = getTier(total, draftCount);
  const cfg        = TIER[tier];
  const hasData    = total > 0;
  const allClear   = hasData && draftCount === 0;

  // What to show in orb
  const orbNumber  = draftCount > 0 ? draftCount : publishedCount > 0 ? publishedCount : total;
  const orbLabel   = draftCount > 0 ? 'to review' : publishedCount > 0 ? 'published' : 'posts';

  // Publish rate: published / total
  const publishRate = total > 0 ? Math.round((publishedCount / total) * 100) : 0;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/5 bg-surface-dark px-6 py-6"
      data-testid="posts-coach-hero"
    >
      {/* ── Confetti island — fires once when all drafts reviewed ── */}
      <ConfettiTrigger fire={allClear} storageKey="posts-all-clear" />

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

        {/* ── Draft count orb — left ── */}
        <div className="flex flex-col items-center shrink-0">
          <div className="relative flex h-28 w-28 items-center justify-center">

            {/* lv-ping rings — on-fire only */}
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
                <span className="text-xl text-slate-500" aria-label="No posts yet">—</span>
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
            Your Content Pipeline
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
                  Needs Review
                </p>
                <p
                  className="text-lg font-bold tabular-nums"
                  style={{
                    color: draftCount > 0 ? '#FFB800' : '#00F5A0',
                    fontFamily: 'var(--font-jetbrains-mono, monospace)',
                  }}
                >
                  {draftCount}
                </p>
              </div>
              <div>
                <p
                  className="text-[10px] uppercase tracking-wide text-slate-500"
                  style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                >
                  Approved
                </p>
                <p
                  className="text-lg font-bold tabular-nums text-blue-400"
                  style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                >
                  {approvedCount}
                </p>
              </div>
              <div>
                <p
                  className="text-[10px] uppercase tracking-wide text-slate-500"
                  style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                >
                  Published
                </p>
                <p
                  className="text-lg font-bold tabular-nums text-truth-emerald"
                  style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                >
                  {publishedCount}
                </p>
              </div>
            </div>
          )}

          {/* Publish progress bar */}
          {total > 0 && (
            <div className="mt-3 max-w-xs">
              <div className="flex items-center justify-between mb-1">
                <p
                  className="text-[10px] uppercase tracking-wide text-slate-500"
                  style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                >
                  Published
                </p>
                <p
                  className="text-[10px] tabular-nums text-slate-400"
                  style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                >
                  {publishRate}%
                </p>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${publishRate}%`,
                    background: publishRate === 100 ? '#00F5A0' : '#60A5FA',
                    boxShadow: `0 0 6px ${publishRate === 100 ? 'rgba(0,245,160,0.4)' : 'rgba(96,165,250,0.4)'}`,
                    transition: 'width 0.7s ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* Coaching action card */}
          {hasData && (
            <div className="mt-4">
              {draftCount > 0 ? (
                /* Posts waiting for review */
                <div
                  className="flex items-start justify-between gap-4 rounded-xl p-4"
                  style={{
                    background: `${cfg.textHex}0d`,
                    border: `1px solid ${cfg.textHex}2e`,
                  }}
                >
                  <div>
                    <p className="text-xs font-semibold text-white">
                      {draftCount} post{draftCount !== 1 ? 's' : ''} ready for your approval
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Each published post signals to AI apps that your business is active and well-described.
                    </p>
                  </div>
                  <Link
                    href="#drafts"
                    className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
                    style={{
                      background: `${cfg.textHex}26`,
                      color: cfg.textHex,
                      border: `1px solid ${cfg.textHex}4d`,
                    }}
                  >
                    Review now →
                  </Link>
                </div>
              ) : approvedCount > 0 ? (
                /* Approved but not yet published */
                <div
                  className="flex items-start justify-between gap-4 rounded-xl p-4"
                  style={{
                    background: 'rgba(96,165,250,0.06)',
                    border: '1px solid rgba(96,165,250,0.18)',
                  }}
                >
                  <div>
                    <p className="text-xs font-semibold text-white">
                      {approvedCount} approved post{approvedCount !== 1 ? 's' : ''} ready to go live
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      These posts have been approved and are waiting to be published to your channels.
                    </p>
                  </div>
                  <Link
                    href="#drafts"
                    className="shrink-0 rounded-lg bg-blue-500/15 px-3 py-1.5 text-xs font-semibold text-blue-400 transition hover:bg-blue-500/25"
                    style={{ border: '1px solid rgba(96,165,250,0.30)' }}
                  >
                    Publish →
                  </Link>
                </div>
              ) : (
                /* All clear */
                <div
                  className="flex items-center gap-3 rounded-xl p-4"
                  style={{
                    background: 'rgba(0,245,160,0.06)',
                    border: '1px solid rgba(0,245,160,0.18)',
                  }}
                >
                  <span className="text-truth-emerald text-base" aria-hidden="true">✓</span>
                  <p className="text-xs font-semibold text-truth-emerald">
                    Nothing in your queue right now. New posts will appear as your AI finds opportunities.
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
