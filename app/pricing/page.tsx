// ---------------------------------------------------------------------------
// /pricing — Public Pricing Page (Sprint 25A)
//
// No auth required. Three tiers aligned with plan_tier enum (starter|growth|agency)
// and Doc 08 §6 pricing. Growth column highlighted with electric-indigo.
// No Stripe calls — pure marketing page.
// ---------------------------------------------------------------------------

import { Check } from 'lucide-react';

// ---------------------------------------------------------------------------
// Tier definitions
// ---------------------------------------------------------------------------

interface PricingTier {
  id:        string;
  name:      string;
  price:     string;
  period:    string;
  tagline:   string;
  features:  string[];
  cta:       string;
  ctaHref:   string;
  highlight: boolean;
}

const TIERS: PricingTier[] = [
  {
    id:      'starter',
    name:    'Starter',
    price:   '$29',
    period:  '/mo',
    tagline: 'Protect your core listing data with weekly AI hallucination scans.',
    features: [
      'Weekly hallucination scans',
      'ChatGPT + Perplexity + Gemini',
      'Magic Menu with JSON-LD schema',
      'Google Business Profile connect',
      'Email hallucination alerts',
      '1 location',
    ],
    cta:       'Get Started',
    ctaHref:   '/signup',
    highlight: false,
  },
  {
    id:      'growth',
    name:    'Growth',
    price:   '$59',
    period:  '/mo',
    tagline: 'Daily scans plus the competitive intelligence to grow faster.',
    features: [
      'Daily hallucination scans',
      'All AI engines covered',
      'Competitor Intercept analysis',
      'Share-of-Voice tracking',
      'Magic Menu + GBP + Apple + Bing',
      'Priority support',
      '1 location',
    ],
    cta:       'Get Started',
    ctaHref:   '/signup',
    highlight: true,
  },
  {
    id:      'agency',
    name:    'Agency',
    price:   'Custom',
    period:  '',
    tagline: 'White-label API access for agencies and multi-location brands.',
    features: [
      'Up to 10 locations',
      'White-label reporting',
      'Full REST + webhook API access',
      'Dedicated account manager',
      'SLA guarantees',
      'Custom integrations',
    ],
    cta:     'Contact Us',
    ctaHref: 'mailto:hello@localvector.ai',
    highlight: false,
  },
];

// ---------------------------------------------------------------------------
// TierCard
// ---------------------------------------------------------------------------

function TierCard({ tier }: { tier: PricingTier }) {
  return (
    <div
      className={[
        'relative flex flex-col rounded-2xl p-8',
        tier.highlight
          ? 'bg-surface-dark border-2 border-signal-green shadow-xl shadow-signal-green/10'
          : 'bg-surface-dark border border-white/5',
      ].join(' ')}
    >
      {/* Header */}
      <div className="mb-6">
        {tier.highlight && (
          <span className="mb-3 inline-block rounded-full bg-signal-green/15 px-3 py-0.5 text-xs font-semibold text-signal-green">
            Most Popular
          </span>
        )}
        <h2 className="text-lg font-semibold text-white">{tier.name}</h2>
        <p className="mt-1 text-sm text-slate-400">{tier.tagline}</p>

        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-4xl font-bold text-white font-mono">{tier.price}</span>
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
      <a
        href={tier.ctaHref}
        className={[
          'block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold transition',
          tier.highlight
            ? 'bg-signal-green text-deep-navy font-bold hover:brightness-110'
            : 'border border-white/10 text-slate-300 hover:border-signal-green/50 hover:text-signal-green',
        ].join(' ')}
      >
        {tier.cta}
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PricingPage
// ---------------------------------------------------------------------------

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-midnight-slate text-slate-300">

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-10 border-b border-white/5 bg-midnight-slate/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <a href="/" className="flex items-center gap-2 text-lg font-bold text-signal-green tracking-tight hover:opacity-80 transition">
            <img src="/logo.svg" alt="" className="h-7 w-auto" aria-hidden />
            LocalVector
          </a>
          <a
            href="/login"
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition"
          >
            Sign In
          </a>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="px-4 pt-16 pb-10">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold text-white">
            Simple, Transparent Pricing
          </h1>
          <p className="mt-4 text-lg text-slate-400">
            Stop AI hallucinations from costing you customers. No contracts. Cancel anytime.
          </p>
        </div>
      </section>

      {/* ── Tier grid ────────────────────────────────────────────────────── */}
      <section className="px-4 pb-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 sm:grid-cols-3">
            {TIERS.map((tier) => (
              <TierCard key={tier.id} tier={tier} />
            ))}
          </div>

          {/* Footer note */}
          <p className="mt-8 text-center text-xs text-slate-600">
            All prices in USD. Starter and Growth billed monthly. No contracts. Cancel anytime.
          </p>
        </div>
      </section>

    </main>
  );
}
