// ---------------------------------------------------------------------------
// Landing Page — LocalVector.ai (Sprint 37)
//
// High-converting landing page updated to match reference design
// (docs/localvector-landing.jsx) — refined copy, Fear/Greed/Magic engine
// naming, narrative case study, animated progress bars.
//
// Server Component throughout; only ViralScanner, Reveal, Counter, Bar,
// FaqAccordion, ScrollHint are 'use client'.
//
// Sections:
//   1. JSON-LD  — SoftwareApplication schema
//   2. Nav      — sticky, Logo + How It Works + Pricing + Free AI Audit
//   3. Hero     — "11,000 questions" headline, ViralScanner CTA
//   4. Problem  — The Invisible Revenue Leak (3 stat cards)
//   5. AVS      — Proprietary Metrics (3 gauge cards)
//   6. Compare  — "Practice What We Preach" with animated Bar components
//   7. Table    — Us vs Listing Tools (6-row grid)
//   8. Engines  — Fear / Greed / Magic (3-column)
//   9. Case     — "$12,000 Steakhouse" narrative + before/after cards
//  10. Pricing  — Free / Starter $29 / AI Shield $59 / Brand Fortress
//  11. FAQ      — 5 accordions
//  12. CTA      — Final ViralScanner
//  13. Footer
//
// Design system: docs/DESIGN-SYSTEM.md tokens, animations, hard rules.
// No Framer Motion. CSS keyframes + IntersectionObserver only.
// ---------------------------------------------------------------------------

import ViralScanner from './_components/ViralScanner';
import Reveal from './_components/Reveal';
import Counter from './_components/Counter';
import Bar from './_components/Bar';
import FaqAccordion from './_components/FaqAccordion';
import ScrollHint from './_components/ScrollHint';
import { safeJsonLd } from './m/[slug]/page';
import {
  Shield,
  Zap,
  Cpu,
  CheckCircle,
  Eye,
  Star,
  TrendingUp,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RootPage() {
  return (
    <div
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
    <main className="min-h-screen text-slate-300 overflow-x-hidden">

      {/* ── 1. JSON-LD ─────────────────────────────────────────────────────── */}
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
        <div className="mx-auto flex max-w-[1120px] items-center justify-between px-6" style={{ height: 64 }}>
          {/* Logo */}
          <span className="flex items-center gap-2 text-base font-bold" style={{ letterSpacing: '-0.02em' }}>
            <img src="/logo.svg" alt="" className="h-7 w-auto" aria-hidden />
            <span style={{ color: '#00F5A0' }}>LocalVector</span>
            <span className="text-slate-600">.ai</span>
          </span>

          {/* Links */}
          <div className="flex items-center gap-7 text-sm font-medium text-slate-400">
            <a href="#how" className="hidden sm:block hover:text-white transition">
              How It Works
            </a>
            <a href="#pricing" className="hidden sm:block hover:text-white transition">
              Pricing
            </a>
            <a
              href="/signup"
              className="lv-btn-green"
              style={{ padding: '8px 20px', fontSize: 13, animation: 'none' }}
            >
              Free AI Audit &rarr;
            </a>
          </div>
        </div>
      </nav>

      {/* ── 3. Hero ───────────────────────────────────────────────────────── */}
      <section
        className="relative flex flex-col justify-center overflow-hidden"
        style={{
          minHeight: '100vh',
          paddingTop: 80,
          backgroundColor: '#050A15',
          backgroundImage: 'radial-gradient(ellipse 70% 50% at 50% 30%, rgba(0,245,160,0.06) 0%, transparent 70%)',
        }}
      >
        {/* Grid overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            opacity: 0.03,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="lv-section relative" style={{ padding: '0 24px' }}>
          {/* Eyebrow — amber "RIGHT NOW" badge */}
          <Reveal>
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-7"
              style={{ background: 'rgba(255,184,0,0.12)' }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span
                  className="absolute inline-flex h-full w-full rounded-full"
                  style={{ background: '#FFB800', animation: 'lv-ping 1.8s cubic-bezier(0,0,0.2,1) infinite' }}
                />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: '#FFB800' }} />
              </span>
              <span
                className="text-xs font-semibold"
                style={{ color: '#FFB800', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
              >
                RIGHT NOW: AI is answering questions about your business
              </span>
            </div>
          </Reveal>

          {/* Headline */}
          <Reveal delay={120}>
            <h1
              className="font-extrabold text-white leading-tight"
              style={{
                fontSize: 'clamp(32px, 5vw, 58px)',
                letterSpacing: '-0.03em',
                maxWidth: 780,
                marginBottom: 20,
              }}
            >
              Every hour, ChatGPT answers{' '}
              <span className="relative" style={{ color: '#00F5A0' }}>
                11,000 questions
                <span
                  className="absolute left-0 right-0"
                  style={{
                    bottom: -2,
                    height: 3,
                    background: 'linear-gradient(90deg, #00F5A0, transparent)',
                    borderRadius: 2,
                    opacity: 0.5,
                  }}
                />
              </span>{' '}
              about local restaurants.
              <br />
              Yours included.
            </h1>
          </Reveal>

          {/* Subheadline */}
          <Reveal delay={240}>
            <p
              className="text-lg leading-relaxed text-slate-400"
              style={{ maxWidth: 620, marginBottom: 40 }}
            >
              Most of those answers are wrong. Wrong hours. Wrong prices.
              &ldquo;Permanently closed&rdquo; when you&apos;re wide open.
              Every wrong answer sends a customer to your competitor &mdash;
              and you never know it happened.
            </p>
          </Reveal>

          {/* CTA area — ViralScanner in card container */}
          <Reveal delay={360}>
            <div
              className="lv-card"
              style={{
                maxWidth: 560,
                border: '1px solid rgba(0,245,160,0.12)',
              }}
            >
              <p className="text-sm font-medium text-slate-400 mb-3.5">
                See exactly what AI is telling your customers right now.
              </p>
              <ViralScanner />
              <p
                className="text-xs mt-2.5"
                style={{
                  color: '#475569',
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                }}
              >
                No signup &middot; No credit card &middot; 8 seconds &middot; Real results
              </p>
            </div>
          </Reveal>

          {/* Model strip */}
          <Reveal delay={480}>
            <div className="flex flex-wrap items-center gap-5 mt-12">
              <span
                className="text-xs uppercase font-semibold text-slate-600"
                style={{ letterSpacing: '0.1em', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
              >
                Monitoring:
              </span>
              {(['ChatGPT', 'Perplexity', 'Google Gemini', 'Claude', 'Copilot'] as const).map((model, i) => (
                <span
                  key={model}
                  className="text-xs font-medium text-slate-500 px-3 py-1 rounded-md"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    opacity: 0,
                    animation: 'lv-shimmer 2s ease-in-out forwards',
                    animationDelay: `${600 + i * 150}ms`,
                  }}
                >
                  {model}
                </span>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Scroll hint */}
        <ScrollHint />
      </section>

      {/* ── 4. The Invisible Revenue Leak ─────────────────────────────────── */}
      <section
        className="px-4"
        style={{
          background: '#0A1628',
          borderTop: '1px solid rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.03)',
        }}
      >
        <div className="lv-section">
          <Reveal>
            <SectionLabel color="#FFB800">The Invisible Revenue Leak</SectionLabel>
          </Reveal>
          <Reveal delay={80}>
            <h2
              className="font-bold text-white leading-tight mb-12"
              style={{ fontSize: 'clamp(24px,3.5vw,40px)', letterSpacing: '-0.02em', maxWidth: 700 }}
            >
              AI doesn&apos;t guess. It states. And when it&apos;s wrong,
              customers don&apos;t verify &mdash; they leave.
            </h2>
          </Reveal>

          <div className="lv-grid3">
            {([
              { val: 1600, prefix: '$', suffix: '/month', desc: "Revenue one restaurant lost because ChatGPT said they were closed on Mondays. They weren't.", border: '#EF4444' },
              { val: 68, prefix: '', suffix: '%', desc: 'Of consumers now use AI assistants to decide where to eat — before they ever see your website.', border: '#FFB800' },
              { val: 0, prefix: '', suffix: ' alerts', desc: 'How many notifications you get when AI sends customers to your competitor. It happens silently. Every day.', border: '#EF4444' },
            ] as const).map((c, i) => (
              <Reveal key={i} delay={i * 120}>
                <div
                  className="lv-card"
                  style={{ borderLeft: `3px solid ${c.border}`, position: 'relative', overflow: 'hidden' }}
                >
                  <div
                    aria-hidden
                    style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: 1,
                      background: `linear-gradient(90deg, transparent, ${c.border}44, transparent)`,
                      animation: 'lv-scan 3s linear infinite',
                      animationDelay: `${i * 1000}ms`,
                      opacity: 0.5,
                    }}
                  />
                  <div
                    className="font-extrabold text-white mb-2"
                    style={{
                      fontSize: 'clamp(32px,4vw,48px)',
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                    }}
                  >
                    {c.val === 0
                      ? <>0<span className="text-2xl font-normal">{c.suffix}</span></>
                      : <Counter end={c.val} prefix={c.prefix} suffix={c.suffix} />
                    }
                  </div>
                  <p className="text-sm leading-relaxed text-slate-400">{c.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={400}>
            <p className="text-center text-sm text-slate-500 mt-10 max-w-xl mx-auto">
              Traditional SEO tools check if your address is right on Yelp.
              They never check if ChatGPT is telling customers you don&apos;t exist.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── 5. AVS — Proprietary Metrics ──────────────────────────────────── */}
      <section
        className="px-4"
        style={{ backgroundColor: '#050A15' }}
      >
        <div className="lv-section">
          <Reveal><SectionLabel>Proprietary Intelligence</SectionLabel></Reveal>
          <Reveal delay={80}>
            <h2
              className="font-bold text-white leading-tight mb-3"
              style={{ fontSize: 'clamp(24px,3.5vw,38px)', letterSpacing: '-0.02em' }}
            >
              The AI Visibility Score (AVS) Dashboard
            </h2>
            <p className="text-slate-400 max-w-xl mb-12">
              Three signals that tell you exactly how AI engines perceive your business —
              and precisely what to fix.
            </p>
          </Reveal>

          <div className="lv-grid3">
            <Reveal delay={0}>
              <MetricCard
                icon={<Eye className="h-5 w-5" />}
                iconColor="text-signal-green"
                title="AI Visibility Score"
                subtitle="AVS"
                score={98}
                outOf={100}
                barColor="#00F5A0"
                description="How often your business is accurately cited when users ask AI about businesses like yours."
              />
            </Reveal>
            <Reveal delay={150}>
              <MetricCard
                icon={<TrendingUp className="h-5 w-5" />}
                iconColor="text-electric-indigo"
                title="Sentiment Index"
                subtitle="SI"
                score={87}
                outOf={100}
                barColor="#6366f1"
                description="Whether AI mentions of your business are positive, neutral, or damaging your reputation."
              />
            </Reveal>
            <Reveal delay={300}>
              <MetricCard
                icon={<Star className="h-5 w-5" />}
                iconColor="text-alert-amber"
                title="Citation Accuracy"
                subtitle="CA"
                score={94}
                outOf={100}
                barColor="#FFB800"
                description="How precisely AI engines reproduce your hours, address, menu, and pricing."
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 6. Practice What We Preach ────────────────────────────────────── */}
      <section
        className="px-4"
        style={{
          background: '#0A1628',
          borderTop: '1px solid rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.03)',
        }}
      >
        <div className="lv-section">
          <Reveal><SectionLabel>Practice What We Preach</SectionLabel></Reveal>
          <Reveal delay={80}>
            <h2
              className="font-bold text-white leading-tight mb-12"
              style={{ fontSize: 'clamp(24px,3.5vw,38px)', letterSpacing: '-0.02em' }}
            >
              We built an AI Visibility platform. So we score ourselves.
            </h2>
          </Reveal>

          <div className="lv-grid2">
            {/* Our score */}
            <Reveal delay={100}>
              <div
                className="lv-card relative overflow-hidden"
                style={{ border: '1px solid rgba(0,245,160,0.2)' }}
              >
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{ opacity: 0.04, background: 'radial-gradient(circle at 30% 30%, #00F5A0, transparent 60%)' }}
                />
                <div className="relative">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-sm font-bold text-white">LocalVector.ai</span>
                    <span
                      className="text-xs font-semibold rounded-md px-2.5 py-1"
                      style={{ color: '#00F5A0', background: 'rgba(0,245,160,0.12)' }}
                    >
                      Fully Protected
                    </span>
                  </div>
                  {([
                    { label: 'AI Visibility Score', val: 97, color: '#00F5A0', isZero: false },
                    { label: 'Citation Accuracy', val: 100, color: '#00F5A0', isZero: false },
                    { label: 'Hallucinations Detected', val: 0, color: '#00F5A0', isZero: true },
                  ] as const).map((r, i) => (
                    <div key={i} className="mb-4">
                      <div className="flex justify-between mb-1.5 text-sm text-slate-400">
                        <span>{r.label}</span>
                        <span
                          className="font-bold text-white"
                          style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                        >
                          {r.isZero ? '0' : <Counter end={r.val} />}
                          {!r.isZero && '/100'}
                        </span>
                      </div>
                      <Bar pct={r.isZero ? 100 : r.val} color={r.color} delay={i * 200} />
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* Average business */}
            <Reveal delay={250}>
              <div
                className="lv-card relative overflow-hidden"
                style={{ border: '1px solid rgba(239,68,68,0.12)' }}
              >
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{ opacity: 0.03, background: 'radial-gradient(circle at 70% 70%, #EF4444, transparent 60%)' }}
                />
                <div className="relative">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-sm font-bold text-white">Average Local Business</span>
                    <span
                      className="text-xs font-semibold rounded-md px-2.5 py-1"
                      style={{ color: '#FFB800', background: 'rgba(255,184,0,0.12)' }}
                    >
                      Flying Blind
                    </span>
                  </div>
                  {([
                    { label: 'AI Visibility Score', display: 'Unknown' },
                    { label: 'Citation Accuracy', display: 'Unknown' },
                    { label: 'Hallucinations Detected', display: 'Unknown' },
                  ] as const).map((r, i) => (
                    <div key={i} className="mb-4">
                      <div className="flex justify-between mb-1.5 text-sm text-slate-400">
                        <span>{r.label}</span>
                        <span
                          className="font-bold"
                          style={{
                            color: '#475569',
                            fontFamily: 'var(--font-jetbrains-mono), monospace',
                          }}
                        >
                          {r.display}
                        </span>
                      </div>
                      <Bar pct={12} color="#334155" delay={i * 200} />
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal delay={400}>
            <p className="text-center text-slate-400 text-base font-medium mt-10">
              You wouldn&apos;t run a restaurant without a fire alarm.
              <br />
              Why run one without an AI alarm?
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── 7. Comparison Table ────────────────────────────────────────────── */}
      <section className="px-4" style={{ backgroundColor: '#050A15' }}>
        <div className="lv-section">
          <Reveal><SectionLabel color="#FFB800">The Difference</SectionLabel></Reveal>
          <Reveal delay={80}>
            <h2
              className="font-bold text-white leading-tight mb-12"
              style={{ fontSize: 'clamp(24px,3.5vw,36px)', letterSpacing: '-0.02em' }}
            >
              Static listings were built for Google.
              <br />
              <span style={{ color: '#00F5A0' }}>AI runs on a completely different trust model.</span>
            </h2>
          </Reveal>

          <Reveal delay={160}>
            <div
              className="rounded-2xl overflow-x-auto"
              style={{ border: '1px solid rgba(255,255,255,0.05)' }}
            >
            <div style={{ minWidth: 540 }}>
              {/* Header row */}
              <div
                className="grid gap-0 px-6 py-3.5"
                style={{
                  gridTemplateColumns: '1fr 160px 160px',
                  background: '#111D33',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <span className="text-xs font-bold uppercase text-slate-500" style={{ letterSpacing: '0.08em' }}>Capability</span>
                <span className="text-xs font-bold text-center" style={{ color: '#00F5A0' }}>LocalVector</span>
                <span className="text-xs font-bold text-center text-slate-500">Listing Tools</span>
              </div>

              {([
                ['Detects AI hallucinations about your business', true, false],
                ['Shows what ChatGPT actually says about you', true, false],
                ['Tells you WHY competitors win AI recommendations', true, false],
                ['Converts PDF menu into AI-readable data', true, false],
                ['Monitors AI sentiment (Premium vs. Budget)', true, false],
                ['Pushes to 48 directories nobody visits', false, true],
              ] as const).map(([cap, us, them], i) => (
                <div
                  key={i}
                  className="grid gap-0 px-6 py-3.5"
                  style={{
                    gridTemplateColumns: '1fr 160px 160px',
                    background: i % 2 === 0 ? '#0A1628' : 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                  }}
                >
                  <span className="text-sm text-slate-300">{cap}</span>
                  <span className="text-center text-base">
                    {us
                      ? <span style={{ color: '#00F5A0' }}>&check;</span>
                      : <span style={{ color: '#334155' }}>&mdash;</span>
                    }
                  </span>
                  <span className="text-center text-base">
                    {them
                      ? <span className="text-slate-500">&check;</span>
                      : <span style={{ color: '#EF4444', opacity: 0.6 }}>&times;</span>
                    }
                  </span>
                </div>
              ))}
            </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 8. Three Engines — How It Works ───────────────────────────────── */}
      <section
        id="how"
        className="px-4"
        style={{
          background: '#0A1628',
          borderTop: '1px solid rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.03)',
        }}
      >
        <div className="lv-section">
          <Reveal><SectionLabel>The Three Engines</SectionLabel></Reveal>
          <Reveal delay={80}>
            <h2
              className="font-bold text-white leading-tight mb-14"
              style={{ fontSize: 'clamp(24px,3.5vw,38px)', letterSpacing: '-0.02em' }}
            >
              Detect the lies. Steal the spotlight. Force the truth.
            </h2>
          </Reveal>

          <div className="lv-grid3">
            {([
              {
                num: '01', accent: '#EF4444',
                title: 'The Fear Engine',
                subtitle: 'AI Hallucination Auditor',
                body: 'We interrogate ChatGPT, Perplexity, and Gemini with the same questions your customers ask. Then we compare every answer against your verified data. When AI says you\'re closed and you\'re not — Red Alert.',
                result: 'A priority-ranked feed of every lie AI is telling about you, with severity scores and dollar-cost estimates.',
              },
              {
                num: '02', accent: '#FFB800',
                title: 'The Greed Engine',
                subtitle: 'Competitor Intelligence',
                body: 'We ask AI: "Who\'s the best in your city?" Then we analyze exactly why your competitor won — and you didn\'t. Not vague advice. Specific action items you can execute this week.',
                result: 'Competitor gap analysis showing the exact words and signals costing you recommendations.',
              },
              {
                num: '03', accent: '#00F5A0',
                title: 'The Magic Engine',
                subtitle: 'AI-Readable Menu Generator',
                body: "AI can't read your PDF menu. So it guesses — or pulls prices from DoorDash with their 30% markup. Upload your menu. We convert it into structured data every AI on earth can understand.",
                result: 'Your menu, readable by every AI, hosted on a page you control — with one-click Google injection.',
              },
            ] as const).map((e, i) => (
              <Reveal key={i} delay={i * 150}>
                <div className="lv-card relative overflow-hidden h-full" style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Top accent line */}
                  <div
                    aria-hidden
                    className="absolute top-0 left-0 right-0"
                    style={{ height: 2, background: e.accent, opacity: 0.5 }}
                  />
                  <div
                    aria-hidden
                    className="absolute top-0 left-0"
                    style={{
                      width: 60, height: 2,
                      background: e.accent,
                      animation: 'lv-scan 4s linear infinite',
                      animationDelay: `${i * 600}ms`,
                    }}
                  />

                  <div className="flex items-center gap-3 mb-5">
                    <span
                      className="text-xs font-bold rounded-md px-2 py-0.5"
                      style={{
                        color: e.accent,
                        border: `1px solid ${e.accent}33`,
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                      }}
                    >
                      {e.num}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-1">{e.title}</h3>
                  <p
                    className="text-xs font-semibold mb-4"
                    style={{ color: e.accent, fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                  >
                    {e.subtitle}
                  </p>
                  <p className="text-sm leading-relaxed text-slate-400 mb-5 flex-1">{e.body}</p>

                  {/* "What you see" sub-card */}
                  <div
                    className="rounded-xl p-3"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      borderLeft: `2px solid ${e.accent}44`,
                    }}
                  >
                    <p
                      className="text-xs font-semibold uppercase mb-1 text-slate-500"
                      style={{ letterSpacing: '0.08em' }}
                    >
                      What you see
                    </p>
                    <p className="text-xs leading-relaxed text-slate-300">{e.result}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={500}>
            <p className="text-center text-sm font-semibold mt-12" style={{ color: '#00F5A0' }}>
              Every engine runs automatically. Open the dashboard, see the problems, fix them in minutes.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── 9. Case Study ─────────────────────────────────────────────────── */}
      <section className="px-4" style={{ backgroundColor: '#050A15' }}>
        <div className="lv-section">
          <Reveal><SectionLabel color="#EF4444">Real Damage. Real Recovery.</SectionLabel></Reveal>
          <Reveal delay={80}>
            <h2
              className="font-bold text-white leading-tight mb-12"
              style={{ fontSize: 'clamp(24px,3.5vw,38px)', letterSpacing: '-0.02em' }}
            >
              The $12,000 Steakhouse That Didn&apos;t Exist
            </h2>
          </Reveal>

          <div className="lv-grid2" style={{ gap: 32 }}>
            {/* Narrative */}
            <Reveal delay={120}>
              <div>
                <p className="text-sm leading-relaxed text-slate-400 mb-5">
                  A well-reviewed steakhouse in Dallas ran a thriving Friday night business for 11 years.
                  In September 2025, their revenue started dropping. They blamed the economy. Changed the menu twice.
                </p>
                <p className="text-sm leading-relaxed text-slate-300 mb-5">
                  <strong className="text-white">The actual problem:</strong> ChatGPT had been telling customers
                  the restaurant was &ldquo;permanently closed&rdquo; since August. For three months, every person who asked
                  &ldquo;best steakhouse near downtown Dallas&rdquo; was sent somewhere else.
                </p>
                <p className="text-sm leading-relaxed text-slate-400 mb-7">
                  Nobody told them. No tool flagged it. No alert fired. By the time they found out &mdash; by accident &mdash;
                  they&apos;d lost an estimated <strong style={{ color: '#EF4444' }}>$12,000</strong>.
                </p>
                <div
                  className="rounded-xl p-4"
                  style={{ background: 'rgba(0,245,160,0.12)', borderLeft: '3px solid #00F5A0' }}
                >
                  <p className="text-sm font-semibold" style={{ color: '#00F5A0' }}>
                    The fix took 24 hours.
                  </p>
                </div>
              </div>
            </Reveal>

            {/* Before / After cards */}
            <Reveal delay={280}>
              <div className="flex flex-col gap-4">
                {/* Before */}
                <div className="lv-card" style={{ borderLeft: '3px solid #EF4444' }}>
                  <p
                    className="text-xs font-bold uppercase mb-3.5"
                    style={{ color: '#EF4444', letterSpacing: '0.1em' }}
                  >
                    Before LocalVector
                  </p>
                  {([
                    ['AI Status', '"Permanently Closed" \u274C'],
                    ['Monthly AI Recommendations', '0'],
                    ['Revenue Impact', '\u2212$4,000/mo'],
                    ['Time to Discovery', '3 months (by accident)'],
                  ] as const).map(([k, v], i) => (
                    <div
                      key={i}
                      className="flex justify-between py-1.5"
                      style={{ borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                    >
                      <span className="text-xs text-slate-500">{k}</span>
                      <span
                        className="text-xs font-semibold text-slate-300"
                        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                      >
                        {v}
                      </span>
                    </div>
                  ))}
                </div>

                {/* After */}
                <div className="lv-card" style={{ borderLeft: '3px solid #00F5A0' }}>
                  <p
                    className="text-xs font-bold uppercase mb-3.5"
                    style={{ color: '#00F5A0', letterSpacing: '0.1em' }}
                  >
                    After LocalVector
                  </p>
                  {([
                    ['AI Status', '"Open, Serving Dinner" \u2705'],
                    ['Monthly AI Recommendations', '47'],
                    ['Revenue Recovered', '+$4,000/mo'],
                    ['Time to Detection', '24 hours (automated)'],
                  ] as const).map(([k, v], i) => (
                    <div
                      key={i}
                      className="flex justify-between py-1.5"
                      style={{ borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                    >
                      <span className="text-xs text-slate-500">{k}</span>
                      <span
                        className="text-xs font-semibold text-slate-300"
                        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                      >
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 10. Pricing ───────────────────────────────────────────────────── */}
      <section
        id="pricing"
        className="px-4"
        style={{
          background: '#0A1628',
          borderTop: '1px solid rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.03)',
        }}
      >
        <div className="lv-section">
          <Reveal><SectionLabel>Pricing</SectionLabel></Reveal>
          <Reveal delay={80}>
            <h2
              className="font-bold text-white leading-tight mb-2"
              style={{ fontSize: 'clamp(24px,3.5vw,38px)', letterSpacing: '-0.02em' }}
            >
              Cheaper than one lost table.
            </h2>
            <p className="text-base text-slate-400 mb-14" style={{ maxWidth: 540 }}>
              One wrong AI answer costs you a customer. One lost Friday reservation: $120.
              Our monthly price: less than that.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {([
              {
                name: 'THE AUDIT', price: 'Free', period: '', sub: 'See the damage.', popular: false,
                features: ['One-time AI hallucination scan', 'Real AI mentions + sentiment', 'ChatGPT, Perplexity, Gemini', 'No signup required'],
                cta: 'Run Free Audit \u2192', ctaStyle: 'outline' as const, ctaHref: '/',
              },
              {
                name: 'STARTER', price: '$29', period: '/mo', sub: 'Stop the bleeding.', popular: false,
                features: ['Weekly automated AI audits', 'Hallucination email alerts', 'Reality Score dashboard', 'Magic Menu (1 menu)', 'Big 6 listing tracker', '1 location'],
                cta: 'Start for $29/mo \u2192', ctaStyle: 'outline' as const, ctaHref: '/signup',
              },
              {
                name: 'AI SHIELD', price: '$59', period: '/mo', sub: 'Go on offense.', popular: true,
                features: ['Daily AI audits', 'Competitor Intercept analysis', 'AI Sentiment tracking', 'Content recommendations', 'Share of Voice tracking', 'Priority alerts', '1 location'],
                cta: 'Get AI Shield \u2192', ctaStyle: 'green' as const, ctaHref: '/signup',
              },
              {
                name: 'BRAND FORTRESS', price: 'Custom', period: '', sub: 'Agencies & multi-location.', popular: false,
                features: ['Up to 25 locations', 'White-label reports', 'Agency dashboard', 'Dedicated onboarding', 'Custom query monitoring', 'API access'],
                cta: 'Talk to Us \u2192', ctaStyle: 'outline' as const, ctaHref: 'mailto:hello@localvector.ai',
              },
            ] as const).map((tier, i) => (
              <Reveal key={i} delay={i * 100}>
                <PricingCard
                  name={tier.name}
                  price={tier.price}
                  period={tier.period}
                  description={tier.sub}
                  features={[...tier.features]}
                  cta={tier.cta}
                  ctaHref={tier.ctaHref}
                  ctaStyle={tier.ctaStyle}
                  highlighted={tier.popular}
                  badge={tier.popular ? 'Most Popular' : undefined}
                />
              </Reveal>
            ))}
          </div>

          <Reveal delay={500}>
            <p className="text-center text-sm text-slate-500 mt-8">
              14-day free trial on all plans. Cancel anytime. No contracts. No setup fees.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── 11. FAQ ───────────────────────────────────────────────────────── */}
      <section
        className="px-4"
        style={{
          background: '#050A15',
          borderTop: '1px solid rgba(255,255,255,0.03)',
        }}
      >
        <div className="lv-section">
          <Reveal><SectionLabel>Questions</SectionLabel></Reveal>
          <Reveal delay={80}>
            <h2
              className="font-bold text-white mb-12"
              style={{ fontSize: 'clamp(24px,3.5vw,36px)', letterSpacing: '-0.02em' }}
            >
              Straight answers.
            </h2>
          </Reveal>

          <FaqAccordion
            q="What exactly does LocalVector do?"
            a={'LocalVector monitors what AI models (ChatGPT, Gemini, Perplexity) say about your business. When they get something wrong \u2014 wrong hours, wrong prices, "permanently closed" when you\'re open \u2014 we detect it, alert you, and give you the tools to fix it.'}
            delay={0}
          />
          <FaqAccordion
            q="How is this different from Yelp or Google Business Profile?"
            a="Yelp and GBP manage your listings on their specific platforms. LocalVector monitors what AI engines synthesize from ALL sources. AI combines data from Yelp, TripAdvisor, Reddit, food blogs, and more. If any source is wrong, AI will be wrong. We catch errors across the entire AI ecosystem."
            delay={80}
          />
          <FaqAccordion
            q="I'm not a tech person. Can I actually use this?"
            a="Yes. Sign up, enter your business details, and monitoring starts automatically. When something is wrong, you get a plain-English alert. Fixing it is one click. The whole product was built by a restaurant owner who also runs a lounge in Alpharetta, GA."
            delay={160}
          />
          <FaqAccordion
            q="What if AI isn't saying anything wrong about me?"
            a={'Then your dashboard shows "All Clear" and your Reality Score. But AI models update constantly \u2014 a clean audit today doesn\'t guarantee next month. We keep watching so you don\'t have to.'}
            delay={240}
          />
          <FaqAccordion
            q="Do I need to cancel my BrightLocal or Yext?"
            a="No. Those tools manage directory listings, which is still useful. LocalVector monitors and optimizes for AI answers \u2014 a layer those tools don't touch. Many customers use both."
            delay={320}
          />
        </div>
      </section>

      {/* ── 12. Final CTA ─────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden px-4"
        style={{
          background: 'linear-gradient(180deg, #050A15 0%, #0A1628 100%)',
        }}
      >
        {/* Radial floating glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: 600,
            height: 600,
            background: 'radial-gradient(circle, rgba(0,245,160,0.06) 0%, transparent 70%)',
            animation: 'lv-float 6s ease-in-out infinite',
          }}
        />

        <div className="lv-section relative text-center">
          <Reveal>
            <h2
              className="font-extrabold text-white leading-tight mb-4"
              style={{ fontSize: 'clamp(26px,4vw,44px)', letterSpacing: '-0.03em' }}
            >
              Right now, AI is describing your business to someone.
              <br />
              <span style={{ color: '#00F5A0' }}>Is it telling the truth?</span>
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="text-slate-400 text-base mb-9">
              Find out in 8 seconds. No signup required.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="max-w-md mx-auto">
              <ViralScanner />
              <p
                className="mt-3 text-xs text-slate-600"
                style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
              >
                Free &middot; Instant &middot; Real results from real AI models
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 13. Footer ────────────────────────────────────────────────────── */}
      <footer
        className="border-t border-white/5 py-10 px-6"
        style={{ backgroundColor: '#050A15' }}
      >
        <div className="mx-auto max-w-[1120px] flex flex-wrap items-center justify-between gap-5">
          <div>
            <span className="text-sm font-bold text-white">
              LocalVector<span style={{ color: '#00F5A0' }}>.ai</span>
            </span>
            <p className="text-xs text-slate-600 mt-1">
              Defending the truth for local business. Built for the Generative Age.
            </p>
          </div>
          <div className="flex gap-5 text-xs text-slate-600">
            <a href="/privacy" className="hover:text-slate-300 transition">Privacy</a>
            <a href="/terms" className="hover:text-slate-300 transition">Terms</a>
            <a href="/login" className="hover:text-slate-300 transition">Log In</a>
          </div>
        </div>
        <div className="mx-auto max-w-[1120px] mt-5 text-center">
          <p className="text-xs" style={{ color: '#334155' }}>&copy; 2026 LocalVector.ai</p>
        </div>
      </footer>

    </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components (Server, co-located)
// ---------------------------------------------------------------------------

function SectionLabel({ children, color = '#00F5A0' }: { children: React.ReactNode; color?: string }) {
  return (
    <p
      className="text-xs font-bold uppercase mb-3"
      style={{
        color,
        letterSpacing: '0.14em',
        fontFamily: 'var(--font-jetbrains-mono), monospace',
      }}
    >
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
  description,
}: {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  subtitle: string;
  score: number;
  outOf: number;
  barColor: string;
  description: string;
}) {
  const pct = Math.round((score / outOf) * 100);
  return (
    <div className="lv-card">
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

      <div className="mt-3 h-2 w-full rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            backgroundColor: barColor,
            '--bar-w': `${pct}%`,
            animation: 'fill-bar 1.4s cubic-bezier(0.4,0,0.2,1) 0.3s both',
          } as React.CSSProperties}
        />
      </div>

      <p className="mt-4 text-xs text-slate-500 leading-relaxed">{description}</p>
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
  ctaStyle: 'green' | 'outline';
  highlighted: boolean;
  badge?: string;
}) {
  return (
    <div
      className="lv-card relative flex flex-col h-full overflow-hidden"
      style={highlighted ? { border: '1px solid rgba(0,245,160,0.3)' } : undefined}
    >
      {badge && (
        <div
          className="absolute text-xs font-bold uppercase"
          style={{
            top: 12,
            right: 12,
            color: '#050A15',
            background: '#00F5A0',
            padding: '3px 10px',
            borderRadius: 100,
            letterSpacing: '0.06em',
            fontSize: 10,
          }}
        >
          {badge}
        </div>
      )}

      <p
        className="text-xs font-bold uppercase text-slate-500 mb-3"
        style={{ letterSpacing: '0.1em' }}
      >
        {name}
      </p>
      <div className="mb-1">
        <span
          className="text-4xl font-extrabold text-white"
          style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
        >
          {price}
        </span>
        {period && <span className="text-sm text-slate-500">{period}</span>}
      </div>
      <p className="text-sm text-slate-400 mb-6">{description}</p>

      <div className="flex-1">
        {features.map((f) => (
          <div key={f} className="flex items-start gap-2 mb-2.5">
            <span className="text-sm leading-5 shrink-0" style={{ color: '#00F5A0' }}>&check;</span>
            <span className="text-sm text-slate-400 leading-5">{f}</span>
          </div>
        ))}
      </div>

      <a
        href={ctaHref}
        className={ctaStyle === 'green' ? 'lv-btn-green' : 'lv-btn-outline'}
        style={{ width: '100%', marginTop: 20, fontSize: 13, textAlign: 'center', display: 'block' }}
      >
        {cta}
      </a>
    </div>
  );
}
