// ---------------------------------------------------------------------------
// Landing Page — LocalVector.ai (Sprint 28)
//
// High-converting landing page per Doc 08 §§1-10 + Sprint 28 design spec.
// Server Component throughout; only ViralScanner is 'use client'.
//
// Sections:
//   1. JSON-LD  — SoftwareApplication schema (Doc 08 §9, Sprint 25C)
//   2. Nav      — sticky, Logo + Pricing + Sign In + Get Started
//   3. Hero     — deep-navy bg, AI-hallucination headline, ViralScanner CTA
//   4. AVS      — Proprietary Metrics (3 animated progress-bar gauge cards)
//   5. Compare  — "Practice What We Preach" comparison table
//   6. Engine   — "How It Works" 3-column grid
//   7. Proof    — "$12,000 Steakhouse Hallucination" case study + result cards
//   8. Pricing  — Free Audit / Starter $29 / AI Shield $59 / Brand Fortress Custom
//   9. Footer   — brand line + legal links
//
// Color palette (added to globals.css Sprint 28):
//   deep-navy    (#050A15)  — hero + nav + footer background
//   signal-green (#00F5A0)  — positive metrics, CTAs, success states
//   alert-amber  (#FFB800)  — warning / watch states
//
// Animations: CSS keyframes in globals.css (fill-bar, fade-up,
//   pulse-glow-green, shield-beat, ping-dot). No Framer Motion required.
//
// Pricing note: "AI Shield" ($59/mo) and "Brand Fortress" (Custom) are
//   marketing names for the Growth and Agency DB plan tiers respectively.
//   CTA buttons point to /signup or /pricing — never to a direct checkout URL.
// ---------------------------------------------------------------------------

import ViralScanner from './_components/ViralScanner';
import { safeJsonLd } from './m/[slug]/page';
import {
  Shield,
  Zap,
  Cpu,
  CheckCircle,
  XCircle,
  TrendingUp,
  Eye,
  Star,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RootPage() {
  return (
    <main className="min-h-screen text-slate-300 overflow-x-hidden">

      {/* ── 1. JSON-LD ── SoftwareApplication schema (Doc 08 §9) ──────────── */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'LocalVector',
            headline: 'AI Hallucination Detection & Fix for Local Businesses',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            offers: {
              '@type': 'AggregateOffer',
              lowPrice: '0',
              highPrice: '59',
              priceCurrency: 'USD',
              offerCount: '4',
            },
            creator: {
              '@type': 'Organization',
              name: 'LocalVector.ai',
              url: 'https://localvector.ai',
            },
            description:
              'LocalVector.ai detects and fixes AI hallucinations about local businesses — ' +
              'when ChatGPT, Perplexity, or Gemini spread false information about hours, ' +
              'location, or menu. Features: automated daily AI auditing, AI Visibility Score ' +
              'tracking, competitor intercept analysis, and structured data distribution.',
            featureList: [
              'AI Hallucination Detection (ChatGPT, Gemini, Perplexity)',
              'AI Visibility Score (AVS) — Proprietary Metric',
              'PDF Menu to Schema.org Conversion',
              'Competitor AI Recommendation Intercept',
              'NAP Listing Distribution to Big 6 Platforms',
              'Reality Score Dashboard',
            ],
          }),
        }}
      />

      {/* ── 2. Navigation ─────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-20 border-b border-white/5 backdrop-blur-sm"
        style={{ backgroundColor: 'rgba(5,10,21,0.92)' }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          {/* Logo */}
          <span className="text-lg font-bold tracking-tight">
            <span style={{ color: '#00F5A0' }}>LocalVector</span>
            <span className="text-slate-600">.ai</span>
          </span>

          {/* Links */}
          <div className="flex items-center gap-4">
            <a href="/pricing" className="hidden sm:block text-sm text-slate-400 hover:text-white transition">
              Pricing
            </a>
            <a
              href="/login"
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition"
            >
              Sign In
            </a>
            <a
              href="/signup"
              className="rounded-xl px-4 py-2 text-sm font-bold transition hover:opacity-90"
              style={{
                backgroundColor: '#00F5A0',
                color: '#050A15',
                animation: 'pulse-glow-green 3s ease-in-out infinite',
              }}
            >
              Get Started Free
            </a>
          </div>
        </div>
      </nav>

      {/* ── 3. Hero ─────────────────────────────────────────────────────────── */}
      <section
        className="relative px-4 pt-24 pb-24 overflow-hidden"
        style={{ backgroundColor: '#050A15' }}
      >
        {/* Radial green glow behind headline */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 80% 45% at 50% -5%, rgba(0,245,160,0.07) 0%, transparent 70%)',
          }}
        />

        <div className="relative mx-auto max-w-3xl text-center">

          {/* Live eyebrow badge */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-signal-green/20 bg-signal-green/5 px-4 py-1.5 text-xs font-semibold text-signal-green mb-8">
            <span className="relative flex h-2 w-2">
              <span
                className="absolute inline-flex h-full w-full rounded-full bg-signal-green opacity-75"
                style={{ animation: 'ping-dot 1.5s cubic-bezier(0,0,0.2,1) infinite' }}
              />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-signal-green" />
            </span>
            Live AI Hallucination Detection
          </div>

          {/* Headline — per spec */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight">
            Is AI Hallucinating Your Business{' '}
            <span className="text-alert-crimson">Out of Existence?</span>
          </h1>

          {/* Sub-headline — per spec */}
          <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            When ChatGPT, Gemini, or Perplexity tell customers you&apos;re closed,{' '}
            <strong className="text-white">you lose revenue instantly.</strong>{' '}
            We detect the lies and force the truth.
          </p>

          {/* ViralScanner — free scan CTA (preserved from Sprint 25C) */}
          <div className="mt-10 mx-auto max-w-sm">
            <ViralScanner />
          </div>

          {/* Trust strip */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-600">
            <TrustPill>No signup required</TrustPill>
            <TrustPill>Results in 60 seconds</TrustPill>
            <TrustPill>ChatGPT · Gemini · Perplexity</TrustPill>
          </div>
        </div>
      </section>

      {/* ── 4. AVS — Proprietary Metrics ────────────────────────────────────── */}
      <section className="bg-midnight-slate px-4 py-20">
        <div className="mx-auto max-w-5xl">

          <SectionLabel>Proprietary Intelligence</SectionLabel>
          <h2 className="mt-3 text-center text-3xl font-bold text-white">
            The AI Visibility Score (AVS) Dashboard
          </h2>
          <p className="mt-3 text-center text-slate-400 max-w-xl mx-auto">
            Three signals that tell you exactly how AI engines perceive your business —
            and precisely what to fix.
          </p>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <MetricCard
              icon={<Eye className="h-5 w-5" />}
              iconColor="text-signal-green"
              title="AI Visibility Score"
              subtitle="AVS"
              score={98}
              outOf={100}
              barColor="#00F5A0"
              delay="0s"
              description="How often your business is accurately cited when users ask AI about businesses like yours."
            />
            <MetricCard
              icon={<TrendingUp className="h-5 w-5" />}
              iconColor="text-electric-indigo"
              title="Sentiment Index"
              subtitle="SI"
              score={87}
              outOf={100}
              barColor="#6366f1"
              delay="0.15s"
              description="Whether AI mentions of your business are positive, neutral, or damaging your reputation."
            />
            <MetricCard
              icon={<Star className="h-5 w-5" />}
              iconColor="text-alert-amber"
              title="Citation Accuracy"
              subtitle="CA"
              score={94}
              outOf={100}
              barColor="#FFB800"
              delay="0.3s"
              description="How precisely AI engines reproduce your hours, address, menu, and pricing."
            />
          </div>
        </div>
      </section>

      {/* ── 5. Practice What We Preach ──────────────────────────────────────── */}
      <section className="bg-surface-dark px-4 py-20">
        <div className="mx-auto max-w-5xl">

          <SectionLabel>Credibility</SectionLabel>
          <h2 className="mt-3 text-center text-3xl font-bold text-white">
            We Practice What We Preach
          </h2>
          <p className="mt-3 text-center text-slate-400 max-w-xl mx-auto">
            We run LocalVector&apos;s own AVS every day. Compare our score against a
            typical SEO agency that doesn&apos;t think about AI visibility.
          </p>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">

            {/* LocalVector */}
            <div className="rounded-2xl border-2 border-signal-green/40 bg-midnight-slate p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-xs font-bold text-signal-green uppercase tracking-widest mb-1">
                    LocalVector.ai
                  </p>
                  <p className="text-4xl font-bold text-white tabular-nums">100</p>
                  <p className="text-xs text-slate-500 mt-0.5">AI Visibility Score</p>
                </div>
                <Shield
                  className="h-12 w-12 text-signal-green"
                  style={{ animation: 'shield-beat 2.5s ease-in-out infinite' }}
                />
              </div>
              <div className="space-y-3">
                <CompareRow label="ChatGPT Accuracy"    value="100%" positive />
                <CompareRow label="Gemini Citations"    value="100%" positive />
                <CompareRow label="Perplexity Accuracy" value="99%"  positive />
                <CompareRow label="Hallucinations"      value="0 detected" positive />
              </div>
            </div>

            {/* Competitor */}
            <div className="rounded-2xl border border-white/10 bg-midnight-slate p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1">
                    Generic SEO Firm
                  </p>
                  <p className="text-4xl font-bold text-alert-crimson tabular-nums">34</p>
                  <p className="text-xs text-slate-500 mt-0.5">AI Visibility Score</p>
                </div>
                <XCircle className="h-12 w-12 text-alert-crimson" />
              </div>
              <div className="space-y-3">
                <CompareRow label="ChatGPT Accuracy"    value="41%"  positive={false} />
                <CompareRow label="Gemini Citations"    value="28%"  positive={false} />
                <CompareRow label="Perplexity Accuracy" value="35%"  positive={false} />
                <CompareRow label="Hallucinations"      value="12 detected" positive={false} />
              </div>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-slate-700">
            Comparison is illustrative. Generic SEO Firm represents industry average
            for businesses without active AI visibility management.
          </p>
        </div>
      </section>

      {/* ── 6. The Engine — How It Works ────────────────────────────────────── */}
      <section className="bg-midnight-slate px-4 py-20">
        <div className="mx-auto max-w-5xl">

          <SectionLabel>The Engine</SectionLabel>
          <h2 className="mt-3 text-center text-3xl font-bold text-white">
            Three Stages. Zero Hallucinations.
          </h2>
          <p className="mt-3 text-center text-slate-400 max-w-xl mx-auto">
            LocalVector runs a continuous loop — every day, across every major AI engine.
          </p>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <EngineCard
              number="01"
              icon={<Zap className="h-6 w-6 text-alert-amber" />}
              iconBg="bg-alert-amber/10"
              title="Active Interrogation"
              description="Every day we ask ChatGPT, Gemini, Perplexity, and Claude what they know about your business — then compare answers to your verified ground truth."
              highlight="Daily LLM Testing"
              highlightColor="text-alert-amber"
            />
            <EngineCard
              number="02"
              icon={<Cpu className="h-6 w-6 text-electric-indigo" />}
              iconBg="bg-electric-indigo/10"
              title="RAG Injection"
              description="When we detect a hallucination we push your verified data — hours, menu, address, attributes — into every source AI models use to train. Your truth wins."
              highlight="Source-Truth Alignment"
              highlightColor="text-electric-indigo"
            />
            <EngineCard
              number="03"
              icon={<Shield className="h-6 w-6 text-signal-green" />}
              iconBg="bg-signal-green/10"
              title="The Shield"
              description="A permanent watch layer monitors for new hallucinations, competitor intercepts, and listing drift. You get alerted the moment something changes."
              highlight="24 / 7 Monitoring"
              highlightColor="text-signal-green"
            />
          </div>
        </div>
      </section>

      {/* ── 7. Social Proof — Case Study ────────────────────────────────────── */}
      <section className="bg-surface-dark px-4 py-20">
        <div className="mx-auto max-w-4xl">

          <SectionLabel>Social Proof</SectionLabel>
          <h2 className="mt-3 text-center text-3xl font-bold text-white">
            The <span className="text-alert-crimson">$12,000</span> Steakhouse Hallucination
          </h2>
          <p className="mt-3 text-center text-slate-400 max-w-xl mx-auto">
            A single incorrect AI answer — running unchecked for three months — quietly
            cost one restaurant twelve thousand dollars in lost Monday revenue.
          </p>

          <div className="mt-10 rounded-2xl bg-midnight-slate border border-white/5 p-6 sm:p-8 space-y-5">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-alert-crimson/10 border border-alert-crimson/20 px-3 py-1 text-xs font-semibold text-alert-crimson uppercase tracking-wide">
                Real Client · Identity Protected
              </span>
            </div>

            <CaseRow icon="⚠️" label="AI Claim"  value='Perplexity answered "Closed on Mondays" to every user who searched.'        labelColor="text-alert-crimson" />
            <CaseRow icon="✓"  label="Reality"   value="Open Monday — full dinner service, highest-margin night of the week."         labelColor="text-truth-emerald" />
            <CaseRow icon="$"  label="Damage"    value="6 tables/night × $80 avg × 4 Mondays × 3 months = $5,760 direct + ~$6,480 repeat-customer loss." labelColor="text-alert-amber" />
            <CaseRow icon="⚡" label="Fix Time"  value="Detected by LocalVector within 24 hours. Corrected via Magic Menu + Big 6 listing push." labelColor="text-electric-indigo" />
            <CaseRow icon="📈" label="Outcome"   value="Monday traffic restored within 2 weeks. Competitor intercept removed."         labelColor="text-truth-emerald" />
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ResultCard value="$12,500+" label="Revenue Protected"       color="text-signal-green"    />
            <ResultCard value="24 hrs"   label="Detection Time"          color="text-electric-indigo" />
            <ResultCard value="3"        label="Competitors Intercepted" color="text-alert-amber"     />
          </div>

          <div className="mt-8 text-center">
            <a
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-bold transition hover:opacity-90"
              style={{ backgroundColor: '#00F5A0', color: '#050A15' }}
            >
              Protect My Revenue Now
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden>
                <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
              </svg>
            </a>
            <p className="mt-3 text-xs text-slate-600">No credit card required for the free scan.</p>
          </div>
        </div>
      </section>

      {/* ── 8. Pricing ──────────────────────────────────────────────────────── */}
      <section className="bg-midnight-slate px-4 py-20" id="pricing">
        <div className="mx-auto max-w-5xl">

          <SectionLabel>Pricing</SectionLabel>
          <h2 className="mt-3 text-center text-3xl font-bold text-white">
            Simple, Transparent Pricing
          </h2>
          <p className="mt-3 text-center text-slate-400">
            No contracts. Cancel anytime. Protect your revenue from day one.
          </p>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <PricingCard
              name="The Audit"
              price="Free"
              period=""
              description="Instant snapshot of what AI engines say about you right now."
              features={['One-time free scan', 'ChatGPT + Perplexity check', 'Hallucination report']}
              cta="Run Free Scan"
              ctaHref="/"
              ctaStyle="border"
              highlighted={false}
            />
            <PricingCard
              name="Starter"
              price="$29"
              period="/mo"
              description="Weekly monitoring and one-click fixes for one location."
              features={[
                'Weekly AI audits',
                'Reality Score dashboard',
                'Magic Menu digitization',
                'Google Business Profile connect',
                'Email hallucination alerts',
              ]}
              cta="Get Started"
              ctaHref="/signup"
              ctaStyle="indigo"
              highlighted={false}
            />
            <PricingCard
              name="AI Shield"
              price="$59"
              period="/mo"
              description="Daily monitoring + competitor intercept. The most-loved plan."
              features={[
                'Daily AI audits',
                'Competitor Intercept (up to 3)',
                'Share of Voice tracking',
                'Big 6 listing distribution',
                'Priority support',
              ]}
              cta="Start Protecting"
              ctaHref="/signup"
              ctaStyle="green"
              highlighted={true}
              badge="Most Popular"
            />
            <PricingCard
              name="Brand Fortress"
              price="Custom"
              period=""
              description="Multi-location enterprise. White-label reports. Dedicated manager."
              features={[
                'Up to 10 locations',
                'Unlimited competitors',
                'White-label PDF reports',
                'API access',
                'Dedicated success manager',
              ]}
              cta="Contact Us"
              ctaHref="mailto:hello@localvector.ai"
              ctaStyle="border"
              highlighted={false}
            />
          </div>
        </div>
      </section>

      {/* ── 9. Footer ───────────────────────────────────────────────────────── */}
      <footer
        className="border-t border-white/5 py-10"
        style={{ backgroundColor: '#050A15' }}
      >
        <div className="mx-auto max-w-5xl px-6 space-y-4">
          <p className="text-center text-sm font-semibold text-slate-500">
            LocalVector.ai &mdash; Defending the Truth for Local Business.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <a href="/pricing" className="text-xs text-slate-600 hover:text-slate-300 transition">Pricing</a>
            <span className="text-slate-800">&middot;</span>
            <a href="/privacy" className="text-xs text-slate-600 hover:text-slate-300 transition">Privacy Policy</a>
            <span className="text-slate-800">&middot;</span>
            <a href="/terms"   className="text-xs text-slate-600 hover:text-slate-300 transition">Terms of Service</a>
            <span className="text-slate-800">&middot;</span>
            <a href="mailto:hello@localvector.ai" className="text-xs text-slate-600 hover:text-slate-300 transition">
              hello@localvector.ai
            </a>
          </div>
        </div>
      </footer>

    </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-components (Server, co-located — AI_RULES §12: all class strings are literals)
// ---------------------------------------------------------------------------

function TrustPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <CheckCircle className="h-3.5 w-3.5 text-signal-green" />
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-center text-xs font-bold uppercase tracking-widest text-signal-green">
      {children}
    </p>
  );
}

// ── MetricCard — animated fill-bar gauge (CSS keyframe, no JS) ───────────

function MetricCard({
  icon,
  iconColor,
  title,
  subtitle,
  score,
  outOf,
  barColor,
  delay,
  description,
}: {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  subtitle: string;
  score: number;
  outOf: number;
  barColor: string;
  delay: string;
  description: string;
}) {
  const pct = Math.round((score / outOf) * 100);
  return (
    <div
      className="rounded-2xl bg-surface-dark border border-white/5 p-6"
      style={{ animation: `fade-up 0.6s ease-out ${delay} both` }}
    >
      <div className={['flex items-center gap-3 mb-4', iconColor].join(' ')}>
        {icon}
        <div>
          <p className="text-sm font-semibold text-white leading-tight">{title}</p>
          <p className="text-xs text-slate-600">{subtitle}</p>
        </div>
      </div>

      <p className="text-4xl font-bold text-white tabular-nums">
        {score}
        <span className="text-lg text-slate-600 font-normal">/{outOf}</span>
      </p>

      {/* CSS-only fill animation — set --bar-w via inline style (AI_RULES §12) */}
      <div className="mt-3 h-2 w-full rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            backgroundColor: barColor,
            '--bar-w': `${pct}%`,
            animation: `fill-bar 1.4s cubic-bezier(0.4,0,0.2,1) ${delay} both`,
          } as React.CSSProperties}
        />
      </div>

      <p className="mt-4 text-xs text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}

// ── CompareRow ────────────────────────────────────────────────────────────

function CompareRow({ label, value, positive }: {
  label: string;
  value: string;
  positive: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={['text-xs font-semibold tabular-nums', positive ? 'text-signal-green' : 'text-alert-crimson'].join(' ')}>
        {positive ? '✓ ' : '✗ '}{value}
      </span>
    </div>
  );
}

// ── EngineCard ────────────────────────────────────────────────────────────

function EngineCard({
  number,
  icon,
  iconBg,
  title,
  description,
  highlight,
  highlightColor,
}: {
  number: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  highlight: string;
  highlightColor: string;
}) {
  return (
    <div className="rounded-2xl bg-surface-dark border border-white/5 p-6">
      <div className="flex items-start gap-4 mb-4">
        <div className={['flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', iconBg].join(' ')}>
          {icon}
        </div>
        <div>
          <p className="text-xs font-bold text-slate-700 tabular-nums mb-0.5">{number}</p>
          <p className="text-sm font-semibold text-white leading-tight">{title}</p>
        </div>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed mb-4">{description}</p>
      <span className={['text-xs font-bold uppercase tracking-widest', highlightColor].join(' ')}>
        {highlight}
      </span>
    </div>
  );
}

// ── CaseRow ───────────────────────────────────────────────────────────────

function CaseRow({ icon, label, value, labelColor }: {
  icon: string;
  label: string;
  value: string;
  labelColor: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="text-base shrink-0 mt-0.5 select-none">{icon}</span>
      <div>
        <span className={['text-xs font-bold mr-2', labelColor].join(' ')}>{label}</span>
        <span className="text-sm text-slate-300 leading-relaxed">{value}</span>
      </div>
    </div>
  );
}

// ── ResultCard ────────────────────────────────────────────────────────────

function ResultCard({ value, label, color }: {
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-midnight-slate border border-white/5 p-6 text-center">
      <p className={['text-3xl font-bold tabular-nums', color].join(' ')}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

// ── PricingCard ───────────────────────────────────────────────────────────

function PricingCard({
  name,
  price,
  period,
  description,
  features,
  cta,
  ctaHref,
  ctaStyle,
  highlighted,
  badge,
}: {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  ctaStyle: 'green' | 'indigo' | 'border';
  highlighted: boolean;
  badge?: string;
}) {
  return (
    <div
      className={[
        'relative flex flex-col rounded-2xl p-6',
        highlighted
          ? 'border-2 border-signal-green/50 bg-signal-green/5'
          : 'border border-white/5 bg-surface-dark',
      ].join(' ')}
    >
      {badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-signal-green px-3 py-0.5 text-xs font-bold text-deep-navy">
          {badge}
        </span>
      )}

      <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">{name}</p>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-3xl font-bold text-white">{price}</span>
        {period && <span className="text-sm text-slate-500">{period}</span>}
      </div>
      <p className="text-xs text-slate-500 mb-5 leading-relaxed">{description}</p>

      <ul className="space-y-2 mb-6 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs text-slate-400">
            <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-signal-green" />
            {f}
          </li>
        ))}
      </ul>

      <a
        href={ctaHref}
        className={[
          'block w-full rounded-xl py-2.5 text-center text-sm font-semibold transition hover:opacity-90',
          ctaStyle === 'indigo' ? 'bg-electric-indigo text-white' : '',
          ctaStyle === 'border' ? 'border border-white/20 text-slate-300 hover:bg-white/5' : '',
        ].join(' ')}
        style={ctaStyle === 'green' ? { backgroundColor: '#00F5A0', color: '#050A15' } : undefined}
      >
        {cta}
      </a>
    </div>
  );
}
