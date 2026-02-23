'use client';

// ---------------------------------------------------------------------------
// Billing Page — Phase 17: Auth & Billing UI
//
// Three-tier pricing: Free Scanner / Pro AI Defense / Enterprise API.
// The Pro tier is highlighted with electric-indigo (Doc 06 §8 brand accent).
//
// Upgrade button calls createCheckoutSession Server Action. When STRIPE_SECRET_KEY
// is absent (local dev / preview) it shows a "Demo mode" banner instead of
// attempting a real checkout.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { Check } from 'lucide-react';
import { createCheckoutSession } from './actions';

// ---------------------------------------------------------------------------
// Tier definitions
// ---------------------------------------------------------------------------

type Plan = 'pro' | 'enterprise';

interface Tier {
  id: string;
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: string[];
  cta: string;
  plan: Plan | null;
  highlight: boolean;
}

const TIERS: Tier[] = [
  {
    id: 'free',
    name: 'Free Scanner',
    price: '$0',
    period: '/mo',
    tagline: 'Scan for AI hallucinations affecting your business listing.',
    features: [
      '5 free scans per month',
      'ChatGPT + Perplexity coverage',
      'Email hallucination alerts',
    ],
    cta: 'Get started free',
    plan: null,
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro AI Defense',
    price: '$99',
    period: '/mo',
    tagline: 'Everything in Free, plus automated correction and Magic Menus.',
    features: [
      'Unlimited scans across all AI engines',
      'Magic Menu with JSON-LD schema',
      'Auto-correction submissions',
      'Share-of-Voice competitive tracking',
      'Priority support',
    ],
    cta: 'Upgrade',
    plan: 'pro',
    highlight: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise API',
    price: 'Custom',
    period: '',
    tagline: 'White-label API access for agencies and multi-location brands.',
    features: [
      'Unlimited locations',
      'Full REST + webhook API access',
      'Dedicated account manager',
      'SLA guarantees',
      'Custom integrations',
    ],
    cta: 'Contact sales',
    plan: 'enterprise',
    highlight: false,
  },
];

// ---------------------------------------------------------------------------
// UpgradeButton
// ---------------------------------------------------------------------------

function UpgradeButton({ tier }: { tier: Tier }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'demo'>('idle');

  if (tier.plan === null) {
    return (
      <button
        className="w-full rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-400 transition hover:border-white/20 hover:text-white"
        disabled
      >
        {tier.cta}
      </button>
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
          ? 'bg-electric-indigo text-white hover:bg-electric-indigo/90'
          : 'border border-white/10 text-slate-300 hover:border-electric-indigo/50 hover:text-electric-indigo',
        status === 'loading' ? 'opacity-60 cursor-not-allowed' : '',
      ].join(' ')}
    >
      {status === 'loading' ? 'Processing…' : tier.cta}
    </button>
  );
}

// ---------------------------------------------------------------------------
// TierCard
// ---------------------------------------------------------------------------

function TierCard({ tier }: { tier: Tier }) {
  return (
    <div
      className={[
        'flex flex-col rounded-2xl p-8 transition',
        tier.highlight
          ? 'bg-surface-dark border-2 border-electric-indigo shadow-xl shadow-electric-indigo/10'
          : 'bg-surface-dark border border-white/5',
      ].join(' ')}
    >
      {/* Header */}
      <div className="mb-6">
        {tier.highlight && (
          <span className="mb-3 inline-block rounded-full bg-electric-indigo/15 px-3 py-0.5 text-xs font-semibold text-electric-indigo">
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
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-truth-emerald" />
            <span className="text-sm text-slate-300">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <UpgradeButton tier={tier} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// BillingPage
// ---------------------------------------------------------------------------

export default function BillingPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Plans &amp; Pricing</h1>
        <p className="mt-2 text-sm text-slate-400">
          Protect your business from AI hallucinations. Cancel anytime.
        </p>
      </div>

      {/* Tier grid */}
      <div className="grid gap-6 sm:grid-cols-3">
        {TIERS.map((tier) => (
          <TierCard key={tier.id} tier={tier} />
        ))}
      </div>

      {/* Footer note */}
      <p className="text-center text-xs text-slate-600">
        All prices in USD. Pro billed monthly. Enterprise billed annually or custom.
      </p>
    </div>
  );
}
