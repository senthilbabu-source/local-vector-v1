// ---------------------------------------------------------------------------
// HeroSection — Marketing landing page hero (Light theme)
// Server Component — no 'use client'
// ---------------------------------------------------------------------------

import React from 'react';
import dynamic from 'next/dynamic';
import MarketingNav from '../_components/MarketingNav';
import ViralScanner from '../../_components/ViralScanner';

const WordRotator = dynamic(() => import('../_components/WordRotator'));

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': ['SoftwareApplication', 'WebApplication'],
  name: 'LocalVector.ai',
  headline: 'AI Hallucination Detection & Fix for Local Businesses',
  description:
    'LocalVector.ai monitors what ChatGPT, Gemini, and Perplexity say about local businesses, detects hallucinations and factual errors, and provides automated tools to correct them.',
  applicationCategory: 'BusinessApplication',
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: '0',
    highPrice: '649',
    priceCurrency: 'USD',
  },
  creator: {
    '@type': 'Organization',
    name: 'LocalVector.ai',
    url: 'https://localvector.ai',
    foundingDate: '2026',
    founder: { '@type': 'Person', name: 'Aruna Surendera Babu' },
  },
  featureList: [
    'AI Hallucination Detection across ChatGPT, Gemini, Perplexity, Claude, Copilot',
    'AI Health Score and Reality Score Dashboard',
    'Competitor AI Recommendation Intercept Analysis',
    'Magic Menu — PDF to JSON-LD and llms.txt Conversion',
    'Share of Voice Tracking in AI Search Results',
    'NAP Sync Engine for Google, Apple, Bing',
  ],
};

const AI_MODELS = ['ChatGPT', 'Perplexity', 'Google Gemini', 'Claude', 'Copilot'] as const;

export default function HeroSection() {
  return (
    <>
      {/* ── JSON-LD ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      {/* ── Navigation (shared) ── */}
      <MarketingNav />

      {/* ── Hero ── */}
      <section
        id="scanner"
        style={{
          position: 'relative',
          background: 'linear-gradient(160deg, #F5F7ED 0%, #E8F5EE 40%, #F0F4F8 100%)',
          overflow: 'hidden',
          paddingTop: 72,
          paddingBottom: 80,
        }}
      >
        {/* Grid overlay */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(var(--m-text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--m-text-primary) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            opacity: 0.04,
            pointerEvents: 'none',
          }}
        />

        {/* Floating accent shapes */}
        <div
          aria-hidden="true"
          className="m-float-slow"
          style={{
            position: 'absolute',
            top: '12%',
            right: '6%',
            width: 160,
            height: 160,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,168,107,0.06) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          aria-hidden="true"
          className="m-float-slow-reverse"
          style={{
            position: 'absolute',
            bottom: '8%',
            left: '4%',
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(30,58,95,0.05) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div
          className="m-hero-animate"
          style={{
            maxWidth: 1120,
            marginLeft: 'auto',
            marginRight: 'auto',
            padding: '0 24px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          {/* Eyebrow badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 16px',
              borderRadius: 100,
              backgroundColor: 'var(--m-amber-light)',
              border: '1px solid rgba(217,119,6,0.25)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--m-amber)',
              marginBottom: 28,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: 'var(--m-amber)',
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
            RIGHT NOW: AI is answering questions about your business
          </div>

          {/* H1 */}
          <h1
            className="m-display"
            style={{
              fontSize: 'clamp(40px, 5.5vw, 68px)',
              fontWeight: 800,
              color: '#0B1629',
              lineHeight: 1.08,
              maxWidth: 900,
              marginBottom: 24,
              letterSpacing: '-0.025em',
            }}
          >
            Every hour, AI answers thousands of questions about{' '}
            <WordRotator
              words={[
                'restaurants',
                'dentists',
                'salons',
                'law firms',
                'florists',
                'plumbers',
                'chiropractors',
                'auto shops',
                'veterinarians',
                'bakeries',
                'gyms',
                'spas',
                'accountants',
                'realtors',
                'photographers',
                'pet groomers',
                'tutors',
                'daycares',
                'landscapers',
                'electricians',
                'local businesses',
              ]}
              style={{ color: 'var(--m-green)' }}
            />{'. '}
            <span className="m-text-shimmer">Yours included.</span>
          </h1>

          {/* Subheadline */}
          <p
            style={{
              fontSize: 'clamp(16px, 1.5vw, 18px)',
              lineHeight: 1.7,
              color: '#475569',
              maxWidth: 600,
              marginBottom: 44,
            }}
          >
            Most of those answers are wrong. Wrong hours. Wrong prices. &ldquo;Permanently
            closed&rdquo; when you&apos;re wide open. Every wrong answer sends a customer to your
            competitor&nbsp;&mdash; silently, invisibly, forever. Your current tools have no idea
            this is happening.
          </p>

          {/* Scanner CTA */}
          <div
            style={{
              width: '100%',
              maxWidth: 640,
            }}
          >
            <p
              style={{
                fontSize: 15,
                color: 'var(--m-text-secondary)',
                lineHeight: 1.6,
                marginBottom: 20,
              }}
            >
              Run a free AI audit&nbsp;&mdash; see exactly what ChatGPT, Perplexity, and Gemini are
              telling your customers right now.
            </p>

            <ViralScanner variant="light" />

            <p
              style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: 12,
                color: 'var(--m-text-muted)',
                marginTop: 14,
                letterSpacing: '0.01em',
              }}
            >
              No signup &middot; No credit card &middot; 8 seconds &middot; Real AI responses
            </p>
          </div>

          {/* Trust strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 10,
              marginTop: 36,
            }}
          >
            <span
              className="m-label"
              style={{
                fontSize: 11,
                letterSpacing: '0.08em',
                color: 'var(--m-text-muted)',
                marginRight: 4,
              }}
            >
              MONITORING:
            </span>
            {AI_MODELS.map((model) => (
              <span
                key={model}
                style={{
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '4px 10px',
                  borderRadius: 6,
                  backgroundColor: '#EEF2F7',
                  color: 'var(--m-text-secondary)',
                  border: '1px solid var(--m-border-base)',
                  whiteSpace: 'nowrap',
                }}
              >
                {model}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Pulse animation + nav bar Safari fix + hero animations */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.5; transform: scale(1.4); }
            }
            /* Safari-safe nav: solid fallback + progressive blur */
            .m-nav-bar {
              background-color: rgba(255,255,255,0.92);
              -webkit-backdrop-filter: saturate(180%) blur(16px);
              backdrop-filter: saturate(180%) blur(16px);
            }
            @supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) {
              .m-nav-bar { background-color: #FFFFFF; }
            }
            .m-trust-bar { display: none; }
            .m-nav-links { display: none !important; }
            .m-mobile-cta { display: inline-flex !important; }
            @media (min-width: 768px) {
              .m-trust-bar { display: block; }
              .m-nav-links { display: flex !important; }
              .m-mobile-cta { display: none !important; }
            }
            /* Hero entrance animation */
            @keyframes hero-fade-up {
              from { opacity: 0; transform: translateY(24px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            .m-hero-animate > * {
              animation: hero-fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
            }
            .m-hero-animate > *:nth-child(1) { animation-delay: 0.1s; }
            .m-hero-animate > *:nth-child(2) { animation-delay: 0.25s; }
            .m-hero-animate > *:nth-child(3) { animation-delay: 0.4s; }
            .m-hero-animate > *:nth-child(4) { animation-delay: 0.55s; }
            .m-hero-animate > *:nth-child(5) { animation-delay: 0.7s; }
            @media (prefers-reduced-motion: reduce) {
              .m-hero-animate > * { animation: none; opacity: 1; transform: none; }
            }
          `,
        }}
      />
    </>
  );
}
