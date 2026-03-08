// ---------------------------------------------------------------------------
// MenuCoachHero — S7 menu coaching hero
//
// Pure server component. CSS animations only.
//
// Added above the MenuWorkspace on the magic-menus page. Makes the owner
// immediately feel whether their AI-readable menu is working for them:
//
//   • Item count as the DOMINANT number in the orb when published
//   • Tier badge: "Live & Distributed" / "Published" / "In Review" / "Not Uploaded"
//   • lv-ping rings when Not Uploaded
//   • "Live in AI" coaching card when propagation_events includes live_in_ai
//   • Single CTA tied to current menu state
// ---------------------------------------------------------------------------

import type { MenuWorkspaceData } from '@/lib/types/menu';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import ConfettiTrigger from '@/components/ui/ConfettiTrigger';

// ─── Types ────────────────────────────────────────────────────────────────────

type MenuTier = 'live-distributed' | 'live' | 'in-review' | 'none';

export interface MenuCoachHeroProps {
  menu:         MenuWorkspaceData | null;
  locationName: string;
  industryNoun: string;    // e.g. "menu", "services list", "catalog"
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

const TIER: Record<MenuTier, TierCfg> = {
  'live-distributed': {
    label:    'Live & Distributed',
    headline: "Your AI-readable menu is live and has been pushed to AI engines — you're in the answer.",
    textHex:  '#00F5A0',
    ringRgba: 'rgba(0,245,160,0.35)',
    glowRgba: 'rgba(0,245,160,0.08)',
    pulse:    false,
    ctaText:  'See distribution status →',
    ctaHref:  '#workspace',
  },
  'live': {
    label:    'Published',
    headline: "Your AI-readable menu is published — distribute it so AI engines can reference your items.",
    textHex:  '#00F5A0',
    ringRgba: 'rgba(0,245,160,0.35)',
    glowRgba: 'rgba(0,245,160,0.08)',
    pulse:    false,
    ctaText:  'Distribute your menu →',
    ctaHref:  '#workspace',
  },
  'in-review': {
    label:    'In Review',
    headline: "Your menu is ready to review — check the items and publish so AI can learn what you serve.",
    textHex:  '#FFB800',
    ringRgba: 'rgba(255,184,0,0.45)',
    glowRgba: 'rgba(255,184,0,0.10)',
    pulse:    false,
    ctaText:  'Review and publish →',
    ctaHref:  '#workspace',
  },
  'none': {
    label:    'Not Uploaded',
    headline: "You have no AI-readable menu — when customers ask AI what you serve, it may guess or say nothing.",
    textHex:  '#ef4444',
    ringRgba: 'rgba(239,68,68,0.45)',
    glowRgba: 'rgba(239,68,68,0.10)',
    pulse:    true,
    ctaText:  'Upload your menu →',
    ctaHref:  '#workspace',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTier(menu: MenuWorkspaceData | null): MenuTier {
  if (!menu || menu.processing_status === 'failed') return 'none';
  if (!menu.is_published) return 'in-review';
  const hasDistributionEvent = (menu.propagation_events ?? []).some(
    (e) => e.event === 'live_in_ai' || e.event === 'indexnow_pinged' || e.event === 'gbp_menu_pushed',
  );
  if (hasDistributionEvent || menu.last_distributed_at) return 'live-distributed';
  return 'live';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MenuCoachHero({ menu, locationName, industryNoun }: MenuCoachHeroProps) {
  const tier    = getTier(menu);
  const cfg     = TIER[tier];
  const hasMenu = menu !== null && menu.processing_status !== 'failed';

  // Fire confetti when menu is fully live and distributed to AI engines
  const shouldCelebrate = tier === 'live-distributed';

  const itemCount = menu?.extracted_data?.items?.length ?? null;
  const isLiveInAI = (menu?.propagation_events ?? []).some((e) => e.event === 'live_in_ai');

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/5 bg-surface-dark px-6 py-6"
      data-testid="menu-coach-hero"
    >
      {/* S8: Milestone confetti — fires once per session when live + distributed */}
      <ConfettiTrigger fire={shouldCelebrate} storageKey="menu-live-distributed" />

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

            <span
              className="relative flex h-24 w-24 flex-col items-center justify-center rounded-full border-2"
              style={{
                borderColor: cfg.ringRgba,
                boxShadow: `0 0 24px ${cfg.ringRgba}, 0 0 48px ${cfg.glowRgba}`,
                animation: !hasMenu ? 'lv-orb-breathe 4s ease-in-out infinite' : undefined,
              }}
            >
              {hasMenu && itemCount !== null ? (
                <>
                  <span
                    className="text-2xl font-bold tabular-nums leading-tight"
                    style={{ color: cfg.textHex, fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                    data-testid="menu-item-count"
                  >
                    {itemCount}
                  </span>
                  <span
                    className="text-[10px] font-semibold leading-none mt-0.5 text-center px-1"
                    style={{ color: cfg.textHex, fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                  >
                    items
                  </span>
                </>
              ) : (
                <span className="text-2xl text-slate-500" aria-label="No menu yet">—</span>
              )}
            </span>
          </div>

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

        {/* Right content */}
        <div className="flex-1 min-w-0">

          {/* Label + tooltip */}
          <div className="flex items-center gap-1.5 mb-3">
            <p
              className="text-[10px] font-bold uppercase tracking-widest text-slate-500"
              style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
            >
              AI-Readable {industryNoun.charAt(0).toUpperCase() + industryNoun.slice(1)}
            </p>
            <InfoTooltip
              content={
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-white">Why does this matter?</p>
                  <p className="text-xs text-slate-300">
                    When customers ask AI &ldquo;what does {locationName} serve?&rdquo; or
                    &ldquo;does {locationName} have X?&rdquo; — AI reads your published {industryNoun}
                    to answer accurately.
                  </p>
                  <p className="text-xs text-slate-400">
                    Without a published {industryNoun}, AI guesses or says it doesn&apos;t know.
                  </p>
                </div>
              }
            />
          </div>

          {/* Headline */}
          <p className="text-base font-semibold text-white leading-snug">
            {cfg.headline}
          </p>

          {/* Live-in-AI coaching card */}
          {isLiveInAI && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-signal-green/20 bg-signal-green/5 px-3 py-2">
              <span className="mt-0.5 text-xs shrink-0" style={{ color: '#00F5A0' }}>✓</span>
              <p className="text-xs leading-relaxed" style={{ color: '#00F5A0' }}>
                AI has cited your {industryNoun} in responses — your items are being discovered by real customers.
              </p>
            </div>
          )}

          {/* No-menu nudge */}
          {!hasMenu && (
            <p className="mt-2 text-sm text-slate-400">
              Upload a PDF, photo, or CSV of your {industryNoun} to get started.
            </p>
          )}

          {/* CTA */}
          <a
            href={cfg.ctaHref}
            className="mt-4 inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
            style={{
              borderColor: `${cfg.textHex}40`,
              background: `${cfg.textHex}10`,
              color: cfg.textHex,
            }}
          >
            {cfg.ctaText}
          </a>
        </div>
      </div>
    </div>
  );
}
