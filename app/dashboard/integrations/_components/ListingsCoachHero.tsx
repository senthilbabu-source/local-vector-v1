// ---------------------------------------------------------------------------
// ListingsCoachHero — S7 listings coaching hero
//
// Pure server component. CSS animations only.
//
// Replaces the plain summary strip (stat cards) on the Listings page with a
// coaching hero that makes the owner feel the platform coverage gap:
//
//   • Platform coverage % as the DOMINANT number in the orb
//   • Tier badge: "Fully Listed" / "Partially Listed" / "Barely Listed" / "Not Listed"
//   • lv-ping rings when Barely Listed or Not Listed
//   • "Needs attention" alert when platforms have stale/missing URLs
//   • Single CTA anchored to the platforms list below
// ---------------------------------------------------------------------------

import Link from 'next/link';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

// ─── Types ────────────────────────────────────────────────────────────────────

type ListingsTier = 'covered' | 'partial' | 'thin' | 'none' | 'no-locations';

export interface ListingsCoachHeroProps {
  totalConnected:      number;
  totalPossible:       number;
  needsAttentionCount: number;
  hasLocations:        boolean;
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

const TIER: Record<ListingsTier, TierCfg> = {
  'covered': {
    label:    'Fully Listed',
    headline: "Your business is well-connected across platforms — AI has multiple sources to verify your info.",
    textHex:  '#00F5A0',
    ringRgba: 'rgba(0,245,160,0.35)',
    glowRgba: 'rgba(0,245,160,0.08)',
    pulse:    false,
    ctaText:  'View all platforms →',
    ctaHref:  '#platforms',
  },
  'partial': {
    label:    'Partially Listed',
    headline: "You have some platforms connected, but gaps mean AI may show incomplete or outdated info.",
    textHex:  '#FFB800',
    ringRgba: 'rgba(255,184,0,0.45)',
    glowRgba: 'rgba(255,184,0,0.10)',
    pulse:    false,
    ctaText:  'Connect more platforms →',
    ctaHref:  '#platforms',
  },
  'thin': {
    label:    'Barely Listed',
    headline: "Very few platforms know about you — AI has almost no way to verify your business details.",
    textHex:  '#f97316',
    ringRgba: 'rgba(249,115,22,0.40)',
    glowRgba: 'rgba(249,115,22,0.08)',
    pulse:    true,
    ctaText:  'Connect platforms now →',
    ctaHref:  '#platforms',
  },
  'none': {
    label:    'Not Listed',
    headline: "You have no platforms connected — AI can't verify anything about your business from external sources.",
    textHex:  '#ef4444',
    ringRgba: 'rgba(239,68,68,0.45)',
    glowRgba: 'rgba(239,68,68,0.10)',
    pulse:    true,
    ctaText:  'Connect your first platform →',
    ctaHref:  '#platforms',
  },
  'no-locations': {
    label:    'No Locations',
    headline: "Add a business location to start tracking your platform listings.",
    textHex:  '#64748b',
    ringRgba: 'rgba(100,116,139,0.30)',
    glowRgba: 'rgba(100,116,139,0.06)',
    pulse:    false,
    ctaText:  'Add a location →',
    ctaHref:  '/dashboard/locations',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTier(
  totalConnected: number,
  totalPossible: number,
  hasLocations: boolean,
): ListingsTier {
  if (!hasLocations || totalPossible === 0) return 'no-locations';
  if (totalConnected === 0) return 'none';
  const pct = totalConnected / totalPossible;
  if (pct >= 0.67) return 'covered';
  if (pct >= 0.34) return 'partial';
  return 'thin';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ListingsCoachHero({
  totalConnected,
  totalPossible,
  needsAttentionCount,
  hasLocations,
}: ListingsCoachHeroProps) {
  const tier    = getTier(totalConnected, totalPossible, hasLocations);
  const cfg     = TIER[tier];
  const hasData = hasLocations && totalPossible > 0;

  const coveragePct = hasData
    ? Math.round((totalConnected / totalPossible) * 100)
    : null;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/5 bg-surface-dark px-6 py-6"
      data-testid="listings-coach-hero"
    >
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
                animation: !hasData ? 'lv-orb-breathe 4s ease-in-out infinite' : undefined,
              }}
            >
              {coveragePct !== null ? (
                <>
                  <span
                    className="text-2xl font-bold tabular-nums leading-tight"
                    style={{ color: cfg.textHex, fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                  >
                    {coveragePct}%
                  </span>
                  <span
                    className="text-[10px] font-semibold leading-none mt-0.5"
                    style={{ color: cfg.textHex, fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                  >
                    of platforms
                  </span>
                </>
              ) : (
                <span className="text-2xl text-slate-500" aria-label="No data yet">—</span>
              )}
            </span>
          </div>

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
              Platform Coverage
            </p>
            <InfoTooltip
              content={
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-white">Why does this matter?</p>
                  <p className="text-xs text-slate-300">
                    AI apps cross-reference multiple platforms when answering questions about
                    your business. More connected platforms means more accurate, consistent answers.
                  </p>
                  <p className="text-xs text-slate-400">
                    Coverage = platforms connected out of the Big 6 (Google, Yelp, Bing,
                    Tripadvisor, Apple Maps, Facebook).
                  </p>
                </div>
              }
            />
          </div>

          {/* Headline */}
          <p className="text-base font-semibold text-white leading-snug">
            {cfg.headline}
          </p>

          {/* Connected count */}
          {hasData && (
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: cfg.textHex, fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                data-testid="listings-connected-count"
              >
                {totalConnected}/{totalPossible}
              </span>
              <span className="text-xs text-slate-400">platforms connected</span>
            </div>
          )}

          {/* Needs-attention coaching card */}
          {needsAttentionCount > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-alert-amber/20 bg-alert-amber/5 px-3 py-2">
              <span className="mt-0.5 text-xs shrink-0" style={{ color: '#FFB800' }}>!</span>
              <p className="text-xs leading-relaxed" style={{ color: '#FFB800' }}>
                <span className="font-semibold">{needsAttentionCount}</span>{' '}
                platform{needsAttentionCount !== 1 ? 's' : ''} need{needsAttentionCount === 1 ? 's' : ''} attention — stale or missing listing URLs may cause AI to show wrong information.
              </p>
            </div>
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
