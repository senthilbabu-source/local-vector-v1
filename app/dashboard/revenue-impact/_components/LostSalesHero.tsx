// ---------------------------------------------------------------------------
// LostSalesHero — S4 Revenue Impact coaching hero
//
// Pure server component. No state or effects — CSS animations only.
//
// Replaces the clinical RevenueEstimatePanel with a coaching panel that
// makes the owner feel the stakes instantly:
//
//   • Annual loss as the DOMINANT number — "$18,000/year" lands harder than
//     "$1,500/month"
//   • Grade tier: "High Stakes" / "Worth Fixing" / "Small Gap" / "You're Covered"
//   • lv-ping rings on the loss orb when High Stakes ($5k+/mo)
//   • Three inline breakdown bars in plain English — no jargon:
//       "Wrong information"  (was: hallucination)
//       "Not showing up"     (was: SOV gap)
//       "Lost to competitors"(was: competitor advantage)
//   • Coaching statement: estimated customers lost per month
//   • Single most-impactful fix CTA
//   • Smart-defaults disclosure kept but de-emphasised
//   • lv-scan top edge + lv-orb-breathe ambient glow
// ---------------------------------------------------------------------------

import { InfoTooltip } from '@/components/ui/InfoTooltip';

// ─── Types ────────────────────────────────────────────────────────────────────

type LossTier = 'high-stakes' | 'worth-fixing' | 'small-gap' | 'covered';

export interface LostSalesHeroProps {
  monthlyLoss: number;
  annualLoss: number;
  sovGapRevenue: number;
  hallucinationRevenue: number;
  competitorRevenue: number;
  isDefaultConfig: boolean;
  avgCustomerValue: number;
  monthlyCovers: number;
  industryLabel: string | null;
}

// ─── Design constants ─────────────────────────────────────────────────────────

interface TierCfg {
  label:     string;
  headline:  string;
  textHex:   string;
  ringRgba:  string;
  glowRgba:  string;
  pulse:     boolean;
}

const TIER: Record<LossTier, TierCfg> = {
  'high-stakes': {
    label:    'High Stakes',
    headline: 'AI is costing you real customers every month.',
    textHex:  '#ef4444',
    ringRgba: 'rgba(239,68,68,0.45)',
    glowRgba: 'rgba(239,68,68,0.10)',
    pulse:    true,
  },
  'worth-fixing': {
    label:    'Worth Fixing',
    headline: 'You\'re losing customers to fixable AI problems.',
    textHex:  '#FFB800',
    ringRgba: 'rgba(255,184,0,0.45)',
    glowRgba: 'rgba(255,184,0,0.10)',
    pulse:    false,
  },
  'small-gap': {
    label:    'Small Gap',
    headline: 'A few small AI issues are costing you a handful of customers.',
    textHex:  '#f97316',
    ringRgba: 'rgba(249,115,22,0.35)',
    glowRgba: 'rgba(249,115,22,0.08)',
    pulse:    false,
  },
  'covered': {
    label:    'You\'re Covered',
    headline: 'No significant revenue lost to AI problems.',
    textHex:  '#00F5A0',
    ringRgba: 'rgba(0,245,160,0.35)',
    glowRgba: 'rgba(0,245,160,0.08)',
    pulse:    false,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTier(monthlyLoss: number): LossTier {
  if (monthlyLoss === 0)     return 'covered';
  if (monthlyLoss < 1000)    return 'small-gap';
  if (monthlyLoss < 5000)    return 'worth-fixing';
  return 'high-stakes';
}

function fmt(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LostSalesHero({
  monthlyLoss,
  annualLoss,
  sovGapRevenue,
  hallucinationRevenue,
  competitorRevenue,
  isDefaultConfig,
  avgCustomerValue,
  industryLabel,
}: LostSalesHeroProps) {
  const tier = getTier(monthlyLoss);
  const cfg  = TIER[tier];
  const hasLoss = monthlyLoss > 0;

  // Customers lost per month — rough coaching number
  const customersLost = avgCustomerValue > 0
    ? Math.round(monthlyLoss / avgCustomerValue)
    : 0;

  // Breakdown bars — plain English labels
  const bars = [
    { label: 'Wrong information',   amount: hallucinationRevenue, hex: '#ef4444', href: '/dashboard/hallucinations' },
    { label: 'Not showing up',      amount: sovGapRevenue,        hex: '#6366f1', href: '/dashboard/share-of-voice' },
    { label: 'Lost to competitors', amount: competitorRevenue,    hex: '#FFB800', href: '/dashboard/compete'        },
  ].filter(b => b.amount > 0);

  const maxBar = Math.max(...bars.map(b => b.amount), 1);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/5 bg-surface-dark px-6 py-6"
      data-testid="lost-sales-hero"
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

      {/* ── Smart-defaults disclosure ─────────────────────────────────── */}
      {isDefaultConfig && hasLoss && (
        <div className="relative mb-4 flex items-center gap-2 rounded-lg border border-electric-indigo/20 bg-electric-indigo/5 px-3 py-2">
          <p className="text-xs text-electric-indigo/80">
            Based on typical {industryLabel ?? 'restaurant'} figures.{' '}
            <a href="#adjust" className="font-semibold underline">
              Update with your numbers
            </a>{' '}
            for a more accurate estimate.
          </p>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────── */}
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8">

        {/* Loss orb — left */}
        <div className="flex flex-col items-center shrink-0">
          <div className="relative flex h-28 w-28 items-center justify-center">
            {/* Pulse rings — only for High Stakes */}
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
                animation: !hasLoss ? 'lv-orb-breathe 4s ease-in-out infinite' : undefined,
              }}
            >
              {hasLoss ? (
                <>
                  <span
                    className="text-xs font-semibold leading-none"
                    style={{ color: cfg.textHex, fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                  >
                    /year
                  </span>
                  <span
                    className="text-xl font-bold tabular-nums leading-tight"
                    style={{ color: cfg.textHex, fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                  >
                    {fmt(annualLoss)}
                  </span>
                </>
              ) : (
                <span
                  className="text-2xl"
                  aria-label="All clear"
                >
                  ✓
                </span>
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
              Lost Sales Estimate
            </p>
            <InfoTooltip
              content={
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-white">How is this calculated?</p>
                  <p className="text-xs text-slate-300">
                    We estimate revenue lost from customers who get wrong information
                    about your business from AI apps, or never see you in AI search results.
                  </p>
                  <p className="text-xs text-slate-400">
                    Based on your monthly covers and average spend. Update the numbers
                    below for a more accurate figure.
                  </p>
                </div>
              }
            />
          </div>

          {/* Headline */}
          <p className="text-base font-semibold text-white leading-snug">
            {cfg.headline}
          </p>

          {/* Monthly + customers coaching line */}
          {hasLoss && (
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span
                className="text-2xl font-bold tabular-nums"
                style={{ color: cfg.textHex, fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                data-testid="revenue-monthly-loss"
              >
                {fmt(monthlyLoss)}/mo
              </span>
              {customersLost > 0 && (
                <span className="text-sm text-slate-400">
                  ≈ {customersLost} customer{customersLost !== 1 ? 's' : ''}/month choosing somewhere else
                </span>
              )}
            </div>
          )}

          {/* Breakdown bars */}
          {bars.length > 0 && (
            <div className="mt-4 space-y-2.5">
              <p
                className="text-[10px] font-bold uppercase tracking-widest text-slate-500"
                style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
              >
                Where it comes from:
              </p>
              {bars.map(bar => {
                const barPct = Math.round((bar.amount / maxBar) * 100);
                return (
                  <div key={bar.label} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 text-xs text-slate-300">{bar.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${barPct}%`,
                          background: bar.hex,
                          boxShadow: `0 0 6px ${bar.hex}60`,
                        }}
                      />
                    </div>
                    <span
                      className="w-20 shrink-0 text-right text-xs font-mono tabular-nums"
                      style={{ color: bar.hex }}
                    >
                      {fmt(bar.amount)}/mo
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── All-clear coaching when no loss ──────────────────────────── */}
      {!hasLoss && (
        <div className="relative mt-4">
          <p className="text-sm text-slate-400">
            No significant AI visibility gaps detected. Run your weekly scan to keep monitoring.
          </p>
        </div>
      )}
    </div>
  );
}
