'use client';

// ---------------------------------------------------------------------------
// Billing Page — Sprint 56B: Current plan state + portal + success/cancel
//
// Three-tier pricing aligned with plan_tier DB enum (starter|growth|agency)
// and Doc 08 §6 pricing ($29 Starter / $59 Growth / Custom Agency).
// The Growth tier is highlighted with signal-green (Doc 06 §8 brand accent).
//
// Upgrade button calls createCheckoutSession Server Action. When STRIPE_SECRET_KEY
// is absent (local dev / preview) it shows a "Demo mode" banner instead of
// attempting a real checkout.
//
// Sprint 56B additions:
//   • Current plan badge at top of page
//   • Manage Subscription button → Stripe Customer Portal
//   • Success/canceled URL params → auto-dismissing banners
// ---------------------------------------------------------------------------

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import {
  createCheckoutSession,
  createPortalSession,
  getCurrentPlan,
  type CurrentPlanInfo,
} from './actions';
import SeatManagementCard from './_components/SeatManagementCard';
import PlanComparisonTable from './_components/PlanComparisonTable';
import { getPlanDisplayName } from '@/lib/plan-display-names';

// ---------------------------------------------------------------------------
// Tier definitions
// ---------------------------------------------------------------------------

type Plan = 'starter' | 'growth';

interface Tier {
  id:        string;
  name:      string;
  price:     string;
  period:    string;
  tagline:   string;
  features:  string[];
  cta:       string;
  plan:      Plan | null;
  highlight: boolean;
}

const TIERS: Tier[] = [
  {
    id:      'starter',
    name:    getPlanDisplayName('starter'),
    price:   '$29',
    period:  '/mo',
    tagline: 'Weekly AI scans to protect your core listing data.',
    features: [
      'Weekly hallucination scans',
      'ChatGPT + Perplexity + Gemini',
      'Magic Menu with JSON-LD schema',
      'Google Business Profile connect',
      'Email hallucination alerts',
    ],
    cta:       'Get Started',
    plan:      'starter',
    highlight: false,
  },
  {
    id:      'growth',
    name:    getPlanDisplayName('growth'),
    price:   '$59',
    period:  '/mo',
    tagline: 'Daily scans plus competitive intelligence.',
    features: [
      'Daily hallucination scans',
      'All AI engines covered',
      'Competitor Intercept analysis',
      'Share-of-Voice tracking',
      'Magic Menu + GBP + Apple + Bing',
      'Priority support',
    ],
    cta:       'Upgrade',
    plan:      'growth',
    highlight: true,
  },
  {
    id:      'agency',
    name:    getPlanDisplayName('agency'),
    price:   'Custom',
    period:  '',
    tagline: 'White-label API access for agencies and multi-location brands.',
    features: [
      'Up to 10 locations',
      'White-label reporting',
      'Full REST + webhook API access',
      'Dedicated account manager',
      'SLA guarantees',
    ],
    cta:  'Contact sales',
    plan: null,
    highlight: false,
  },
];

// ---------------------------------------------------------------------------
// SuccessBanner / CanceledBanner — auto-dismiss after 5 seconds
// ---------------------------------------------------------------------------

function SuccessBanner({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="rounded-xl border border-truth-emerald/30 bg-truth-emerald/10 px-4 py-3 text-sm text-truth-emerald">
      Subscription activated! Your plan has been updated.
      <button onClick={onDismiss} className="ml-3 text-xs underline opacity-70 hover:opacity-100">
        Dismiss
      </button>
    </div>
  );
}

function CanceledBanner({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="rounded-xl border border-alert-amber/30 bg-alert-amber/10 px-4 py-3 text-sm text-alert-amber">
      Checkout was canceled. No charges were made.
      <button onClick={onDismiss} className="ml-3 text-xs underline opacity-70 hover:opacity-100">
        Dismiss
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CurrentPlanBadge — shows the org's current plan and status
// ---------------------------------------------------------------------------

function CurrentPlanBadge({ planInfo }: { planInfo: CurrentPlanInfo | null }) {
  if (!planInfo) return null;

  const planLabel = getPlanDisplayName(planInfo.plan);
  const isActive = planInfo.plan_status === 'active';

  return (
    <div className="flex items-center justify-center gap-3">
      <span className="text-sm text-slate-400">Current plan:</span>
      <span className="rounded-full bg-electric-indigo/15 px-3 py-0.5 text-xs font-semibold text-electric-indigo">
        {planLabel}
      </span>
      {isActive && (
        <span className="rounded-full bg-truth-emerald/15 px-2 py-0.5 text-xs text-truth-emerald">
          Active
        </span>
      )}
      {planInfo.plan_status === 'canceled' && (
        <span className="rounded-full bg-alert-crimson/15 px-2 py-0.5 text-xs text-alert-crimson">
          Canceled
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ManageSubscriptionButton
// ---------------------------------------------------------------------------

function ManageSubscriptionButton({ planInfo }: { planInfo: CurrentPlanInfo | null }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'demo'>('idle');

  if (!planInfo?.has_stripe_customer) return null;
  if (planInfo.plan === 'trial') return null;

  if (status === 'demo') {
    return (
      <p className="text-center text-xs text-slate-500 py-2">
        Demo mode — Stripe not configured.
      </p>
    );
  }

  async function handleClick() {
    setStatus('loading');
    const result = await createPortalSession();
    if (result.demo) {
      setStatus('demo');
    } else if (result.url) {
      window.location.href = result.url;
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === 'loading'}
      className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-400 transition hover:border-white/20 hover:text-white disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {status === 'loading' ? 'Loading...' : 'Manage Subscription'}
    </button>
  );
}

// ---------------------------------------------------------------------------
// UpgradeButton
// ---------------------------------------------------------------------------

function UpgradeButton({ tier, currentPlan }: { tier: Tier; currentPlan: string | null }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'demo'>('idle');

  if (tier.plan === null) {
    return (
      <a
        href="mailto:hello@localvector.ai"
        className="block w-full rounded-xl border border-white/10 px-4 py-2.5 text-center text-sm font-semibold text-slate-400 transition hover:border-white/20 hover:text-white"
      >
        {tier.cta}
      </a>
    );
  }

  // Show "Current Plan" badge if this is the user's active plan
  if (currentPlan === tier.plan) {
    return (
      <div className="w-full rounded-xl border border-electric-indigo/30 bg-electric-indigo/10 px-4 py-2.5 text-center text-sm font-semibold text-electric-indigo">
        Current Plan
      </div>
    );
  }

  if (status === 'demo') {
    return (
      <p className="text-center text-xs text-slate-500 py-2">
        Demo mode — Stripe not configured.
      </p>
    );
  }

  async function handleClick() {
    if (!tier.plan) return;
    setStatus('loading');
    const result = await createCheckoutSession(tier.plan);
    if (result.demo) {
      setStatus('demo');
    } else if (result.url) {
      window.location.href = result.url;
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === 'loading'}
      className={[
        'w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition',
        tier.highlight
          ? 'bg-signal-green text-deep-navy hover:bg-signal-green/90'
          : 'border border-white/10 text-slate-300 hover:border-signal-green/50 hover:text-signal-green',
        status === 'loading' ? 'opacity-60 cursor-not-allowed' : '',
      ].join(' ')}
    >
      {status === 'loading' ? 'Processing...' : tier.cta}
    </button>
  );
}

// ---------------------------------------------------------------------------
// TierCard
// ---------------------------------------------------------------------------

function TierCard({ tier, currentPlan }: { tier: Tier; currentPlan: string | null }) {
  return (
    <div
      className={[
        'flex flex-col rounded-2xl p-8 transition',
        tier.highlight
          ? 'bg-surface-dark border-2 border-signal-green shadow-xl shadow-signal-green/10'
          : 'bg-surface-dark border border-white/5',
      ].join(' ')}
    >
      {/* Header */}
      <div className="mb-6">
        {tier.highlight && (
          <span className="mb-3 inline-block rounded-full bg-signal-green/15 px-3 py-0.5 text-xs font-semibold text-signal-green">
            Most popular
          </span>
        )}
        <h2 className="text-lg font-semibold text-white">{tier.name}</h2>
        <p className="mt-1 text-sm text-slate-400">{tier.tagline}</p>

        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-3xl font-bold text-white">{tier.price}</span>
          {tier.period && (
            <span className="text-sm text-slate-500">{tier.period}</span>
          )}
        </div>
      </div>

      {/* Features */}
      <ul className="mb-8 flex-1 space-y-2.5">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-signal-green" />
            <span className="text-sm text-slate-300">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <UpgradeButton tier={tier} currentPlan={currentPlan} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// BillingPage
// ---------------------------------------------------------------------------

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [showSuccess, setShowSuccess] = useState(searchParams.get('success') === 'true');
  const [showCanceled, setShowCanceled] = useState(searchParams.get('canceled') === 'true');
  const [planInfo, setPlanInfo] = useState<CurrentPlanInfo | null>(null);

  useEffect(() => {
    getCurrentPlan()
      .then(setPlanInfo)
      .catch((err) => {
        Sentry.captureException(err, { tags: { component: 'billing-page', sprint: 'A' } });
      });
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      {/* Success / Canceled banners */}
      {showSuccess && <SuccessBanner onDismiss={() => setShowSuccess(false)} />}
      {showCanceled && <CanceledBanner onDismiss={() => setShowCanceled(false)} />}

      {/* Header */}
      <div className="space-y-3 text-center">
        <h1 className="text-2xl font-bold text-white">Plans &amp; Pricing</h1>
        <p className="text-sm text-slate-400">
          Protect your business from AI hallucinations. No contracts. Cancel anytime.
        </p>
        <CurrentPlanBadge planInfo={planInfo} />
      </div>

      {/* Tier grid */}
      <div className="grid gap-6 sm:grid-cols-3">
        {TIERS.map((tier) => (
          <TierCard key={tier.id} tier={tier} currentPlan={planInfo?.plan ?? null} />
        ))}
      </div>

      {/* Seat Management — Agency plan only (Sprint 99) */}
      {planInfo?.plan === 'agency' && (
        <div className="flex justify-center">
          <div className="w-full max-w-sm">
            <SeatManagementCard />
          </div>
        </div>
      )}

      {/* Manage Subscription */}
      <div className="flex justify-center">
        <ManageSubscriptionButton planInfo={planInfo} />
      </div>

      {/* Sprint B: Plan Feature Comparison Table */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold text-white">Compare Plans</h2>
        <p className="mt-1 text-sm text-slate-400">
          See exactly what&apos;s included at each tier.
        </p>
        <PlanComparisonTable currentPlan={planInfo?.plan ?? null} />
      </section>

      {/* Footer note */}
      <p className="text-center text-xs text-slate-600">
        All prices in USD. Starter and Growth billed monthly. Agency billed annually or custom.
      </p>
    </div>
  );
}
