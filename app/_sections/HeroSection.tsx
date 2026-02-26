// ---------------------------------------------------------------------------
// HeroSection — JSON-LD + Navigation + Hero (above fold, static import)
// ---------------------------------------------------------------------------

import ViralScanner from '../_components/ViralScanner';
import Reveal from '../_components/Reveal';
import ScrollHint from '../_components/ScrollHint';
import { safeJsonLd } from '../m/[slug]/page';

export default function HeroSection() {
  return (
    <>
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
    </>
  );
}
