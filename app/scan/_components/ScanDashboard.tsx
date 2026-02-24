'use client';
// ---------------------------------------------------------------------------
// ScanDashboard — Public AI Audit Result Dashboard (Sprint 34+35, restyled Sprint 39)
//
// Receives parsed ScanDisplayData from the Server Component page.
//
// Sprint 39: full visual restyle to match Sprint 37 landing page design
// language. Uses .lv-card, .lv-section, .lv-grid2, Reveal scroll animations,
// Bar progress fills, SectionLabel eyebrow text, JetBrains Mono for data
// elements, and alternating navy/navyLight section backgrounds.
//
// Data flow is unchanged — all business logic, helper functions, and
// scan-params.ts types are identical to Sprint 35.
//
// Sections:
//   0. Nav strip (logo + "Run Another Scan" outline button)
//   1. Alert banner (real result: fail / pass / not_found)
//   2. KPI section — Row 1: 2 real free cards | Row 2: 2 locked score cards
//   3. Competitive landscape (sample data, clearly labeled + locked)
//   4. Detected Issues (items 1–3 with real or generic locked content)
//   5. Primary CTA (Claim My AI Profile → /signup)
//
// AI_RULES §12: all Tailwind class strings are literals (ternary operators only).
// AI_RULES §24: real categoricals shown free; locked numericals honest.
// DESIGN-SYSTEM.md: all colors, fonts, animations, and hard rules followed.
// ---------------------------------------------------------------------------

import type { ScanDisplayData, IssueCategory } from '../_utils/scan-params';
import { getAccuracyIssueCategories } from '../_utils/scan-params';
import Reveal from '@/app/_components/Reveal';
import Bar from '@/app/_components/Bar';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  result: ScanDisplayData;
}

// ---------------------------------------------------------------------------
// Local sub-component: SectionLabel (mirrors app/page.tsx)
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

// ---------------------------------------------------------------------------
// Local sub-component: LockOverlay (SVG lock icon, no emoji)
// ---------------------------------------------------------------------------

function LockOverlay({ text = 'Sign up to unlock' }: { text?: string }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      style={{ backgroundColor: 'rgba(10,22,40,0.85)', backdropFilter: 'blur(3px)', borderRadius: 16 }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
        className="h-5 w-5 text-slate-500 mb-2" aria-hidden>
        <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clipRule="evenodd" />
      </svg>
      <p
        className="text-xs font-semibold"
        style={{ color: '#94A3B8', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
      >
        {text}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local sub-component: LockPill (inline pill for locked items)
// ---------------------------------------------------------------------------

function LockPill() {
  return (
    <div className="absolute inset-0 backdrop-blur-[2px] flex items-center justify-center z-10"
      style={{ backgroundColor: 'rgba(10,22,40,0.75)', borderRadius: 16 }}>
      <div className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5"
        style={{ backgroundColor: 'rgba(10,22,40,0.9)' }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
          className="h-3.5 w-3.5 text-slate-400" aria-hidden>
          <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clipRule="evenodd" />
        </svg>
        <span className="text-xs text-slate-400 font-medium">Signup to unlock</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper functions — AI_RULES §12: ternary literals only, no template concat
// ---------------------------------------------------------------------------

function mentionsColor(m: 'none' | 'low' | 'medium' | 'high'): string {
  return m === 'high'   ? '#00F5A0'
       : m === 'medium' ? '#FFB800'
       : m === 'low'    ? '#94A3B8'
       :                  '#475569';
}

function mentionsBorderColor(m: 'none' | 'low' | 'medium' | 'high'): string {
  return m === 'high'   ? '#00F5A0'
       : m === 'medium' ? '#FFB800'
       :                  '#64748B';
}

function mentionsDescription(m: 'none' | 'low' | 'medium' | 'high'): string {
  return m === 'high'   ? 'Your business is prominently cited in AI responses'
       : m === 'medium' ? 'Your business appears in some AI responses with moderate detail'
       : m === 'low'    ? 'AI has limited information about your business'
       :                  'AI has no data about your business';
}

function sentimentColor(s: 'positive' | 'neutral' | 'negative'): string {
  return s === 'positive' ? '#00F5A0' : s === 'negative' ? '#EF4444' : '#94A3B8';
}

function sentimentBorderColor(s: 'positive' | 'neutral' | 'negative'): string {
  return s === 'positive' ? '#00F5A0' : s === 'negative' ? '#EF4444' : '#64748B';
}

function sentimentIcon(s: 'positive' | 'neutral' | 'negative'): string {
  return s === 'positive' ? '↑' : s === 'negative' ? '↓' : '→';
}

function sentimentDescription(s: 'positive' | 'neutral' | 'negative'): string {
  return s === 'positive' ? 'AI describes your business in a favorable, premium context'
       : s === 'negative' ? 'AI uses unfavorable or budget-tier language for your business'
       :                    'AI describes your business in a neutral, factual tone';
}

function categoryLabel(c: IssueCategory): string {
  return c === 'hours'   ? 'Hours'
       : c === 'address' ? 'Address'
       : c === 'menu'    ? 'Menu'
       : c === 'phone'   ? 'Phone'
       :                   'Other';
}

function categoryBorderColor(c: IssueCategory): string {
  return c === 'hours'   ? '#FFB800'
       : c === 'address' ? '#6366f1'
       : c === 'menu'    ? '#00F5A0'
       :                   '#64748B';
}

function getMentions(r: ScanDisplayData): 'none' | 'low' | 'medium' | 'high' {
  return r.status === 'fail' || r.status === 'pass' ? r.mentions : 'none';
}

function getSentiment(r: ScanDisplayData): 'positive' | 'neutral' | 'negative' {
  return r.status === 'fail' || r.status === 'pass' ? r.sentiment : 'neutral';
}

function getAccuracyIssues(r: ScanDisplayData): string[] {
  return r.status === 'fail' || r.status === 'pass' ? r.accuracyIssues : [];
}

/** Accent color for the alert banner per result status. */
function statusAccent(s: 'fail' | 'pass' | 'not_found'): string {
  return s === 'fail' ? '#EF4444' : s === 'pass' ? '#00F5A0' : '#64748B';
}

// ---------------------------------------------------------------------------
// ScanDashboard
// ---------------------------------------------------------------------------

export default function ScanDashboard({ result }: Props) {
  // Invalid / missing params — show simple fallback
  if (result.status === 'invalid') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <p className="text-base font-semibold mb-4" style={{ color: '#94A3B8' }}>
          No valid scan result found.
        </p>
        <a href="/" className="lv-btn-outline" style={{ padding: '8px 24px', fontSize: 13 }}>
          ← Run a free scan
        </a>
      </div>
    );
  }

  const mentions                = getMentions(result);
  const sentiment               = getSentiment(result);
  const accuracyIssues          = getAccuracyIssues(result);
  const accuracyIssueCategories = getAccuracyIssueCategories(result);
  const accent                  = statusAccent(result.status);

  return (
    <>
      {/* ── 0. Nav Strip ─────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-20 border-b border-white/5 backdrop-blur-sm"
        style={{ backgroundColor: 'rgba(5,10,21,0.92)' }}
      >
        <div className="mx-auto flex max-w-[1120px] items-center justify-between px-6" style={{ height: 64 }}>
          <a href="/" className="flex items-center gap-2 text-base font-bold" style={{ letterSpacing: '-0.02em' }}>
            <img src="/logo.svg" alt="" className="h-7 w-auto" aria-hidden />
            <span style={{ color: '#00F5A0' }}>LocalVector</span>
            <span className="text-slate-600">.ai</span>
          </a>
          <a
            href="/"
            className="lv-btn-outline"
            style={{ padding: '8px 20px', fontSize: 13, animation: 'none' }}
          >
            Run Another Scan &rarr;
          </a>
        </div>
      </nav>

      {/* ── 1. Alert Banner ──────────────────────────────────────────────── */}
      <section className="px-4" style={{ backgroundColor: '#050A15' }}>
        <div className="lv-section" style={{ paddingTop: 48, paddingBottom: 48 }}>
          <Reveal>
            <SectionLabel color={accent}>AI Audit Result</SectionLabel>
          </Reveal>
          <Reveal delay={80}>
            <h1
              className="font-bold leading-tight mb-8"
              style={{
                fontSize: 'clamp(24px,3.5vw,38px)',
                letterSpacing: '-0.02em',
                color: '#F1F5F9',
              }}
            >
              AI Audit: {result.businessName}
            </h1>
          </Reveal>

          <Reveal delay={160}>
            {result.status === 'fail' && (
              <div
                className="lv-card relative overflow-hidden"
                style={{ borderLeft: '3px solid #EF4444' }}
              >
                {/* Scan sweep line */}
                <div
                  aria-hidden
                  className="absolute top-0 left-0 right-0"
                  style={{
                    height: 1,
                    background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.27), transparent)',
                    animation: 'lv-scan 3s linear infinite',
                    opacity: 0.5,
                  }}
                />
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  {/* PulseDot */}
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span
                      className="absolute inline-flex h-full w-full rounded-full"
                      style={{ background: '#EF4444', animation: 'lv-ping 1.8s cubic-bezier(0,0,0.2,1) infinite' }}
                    />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: '#EF4444' }} />
                  </span>
                  <p className="text-base font-bold" style={{ color: '#EF4444' }}>
                    AI Hallucination Detected
                  </p>
                  <span
                    className="rounded-md px-2.5 py-0.5 text-xs font-semibold uppercase"
                    style={{
                      color: '#EF4444',
                      background: 'rgba(239,68,68,0.10)',
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {result.severity}
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: '#CBD5E1' }}>
                  <span className="font-semibold" style={{ color: '#F1F5F9' }}>{result.engine}</span>{' '}
                  is reporting your business{' '}
                  <span className="font-semibold" style={{ color: '#EF4444' }}>&ldquo;{result.businessName}&rdquo;</span>{' '}
                  as <span className="font-semibold" style={{ color: '#EF4444' }}>&ldquo;{result.claimText}&rdquo;</span>.{' '}
                  Reality: <span className="font-semibold" style={{ color: '#00F5A0' }}>{result.expectedTruth}</span>.
                </p>
              </div>
            )}
            {result.status === 'pass' && (
              <div
                className="lv-card relative overflow-hidden"
                style={{ borderLeft: '3px solid #00F5A0' }}
              >
                <div
                  aria-hidden
                  className="absolute top-0 left-0 right-0"
                  style={{
                    height: 1,
                    background: 'linear-gradient(90deg, transparent, rgba(0,245,160,0.27), transparent)',
                    animation: 'lv-scan 3s linear infinite',
                    opacity: 0.5,
                  }}
                />
                <div className="flex items-center gap-3 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                    className="h-5 w-5 shrink-0" style={{ color: '#00F5A0' }} aria-hidden>
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  <p className="text-base font-bold" style={{ color: '#00F5A0' }}>
                    No Hallucinations Detected
                  </p>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: '#CBD5E1' }}>
                  <span className="font-semibold" style={{ color: '#F1F5F9' }}>{result.engine}</span>{' '}
                  currently describes{' '}
                  <span className="font-semibold" style={{ color: '#F1F5F9' }}>&ldquo;{result.businessName}&rdquo;</span>{' '}
                  accurately. AI hallucinations can appear at any time — monitoring keeps you protected.
                </p>
              </div>
            )}
            {result.status === 'not_found' && (
              <div
                className="lv-card relative overflow-hidden"
                style={{ borderLeft: '3px solid #64748B' }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                    className="h-5 w-5 shrink-0" style={{ color: '#94A3B8' }} aria-hidden>
                    <path d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" />
                  </svg>
                  <p className="text-base font-bold" style={{ color: '#CBD5E1' }}>
                    Zero AI Visibility
                  </p>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>
                  <span className="font-semibold" style={{ color: '#CBD5E1' }}>{result.engine}</span>{' '}
                  has no data for{' '}
                  <span className="font-semibold" style={{ color: '#CBD5E1' }}>&ldquo;{result.businessName}&rdquo;</span>.
                  Customers searching AI assistants won&apos;t find you — costing you revenue silently.
                </p>
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/* ── 2. KPI Section ───────────────────────────────────────────────── */}
      <section
        className="px-4"
        style={{
          background: '#0A1628',
          borderTop: '1px solid rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.03)',
        }}
      >
        <div className="lv-section">

          {/* Row 1: Real data from scan — shown free */}
          <Reveal>
            <div className="flex items-center justify-between mb-4">
              <SectionLabel>From Your Scan</SectionLabel>
              <span
                className="text-xs font-semibold rounded-md px-2.5 py-1"
                style={{
                  color: '#00F5A0',
                  background: 'rgba(0,245,160,0.12)',
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                }}
              >
                Live
              </span>
            </div>
          </Reveal>
          <div className="lv-grid2 mb-12">
            <Reveal delay={0}>
              <RealMentionsCard mentions={mentions} />
            </Reveal>
            <Reveal delay={150}>
              <RealSentimentCard sentiment={sentiment} />
            </Reveal>
          </div>

          {/* Row 2: Locked numerical scores — require continuous monitoring */}
          <Reveal delay={200}>
            <div className="flex items-center justify-between mb-4">
              <SectionLabel color="#FFB800">Unlock Full Scores</SectionLabel>
              <span
                className="text-xs font-semibold rounded-md px-2.5 py-1"
                style={{
                  color: '#FFB800',
                  background: 'rgba(255,184,0,0.12)',
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                }}
              >
                Plan required
              </span>
            </div>
          </Reveal>
          <div className="lv-grid2">
            <Reveal delay={250}>
              <LockedScoreCard
                title="AI Visibility Score"
                abbr="AVS"
                description="How often AI cites your business accurately"
              />
            </Reveal>
            <Reveal delay={400}>
              <LockedScoreCard
                title="Citation Integrity"
                abbr="CI"
                description="AI accuracy on hours, address, and menu"
              />
            </Reveal>
          </div>

        </div>
      </section>

      {/* ── 3. Competitive Landscape ─────────────────────────────────────── */}
      <section className="px-4" style={{ backgroundColor: '#050A15' }}>
        <div className="lv-section">
          <Reveal>
            <div className="flex items-center justify-between mb-4">
              <SectionLabel color="#FFB800">Competitive Landscape</SectionLabel>
              <span
                style={{ fontSize: 11, color: '#334155', fontFamily: 'var(--font-jetbrains-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}
              >
                Sample data
              </span>
            </div>
          </Reveal>
          <Reveal delay={160}>
            <div className="lv-card relative overflow-hidden" style={{ padding: 24 }}>
              {/* Gradient lock overlay */}
              <div
                className="absolute inset-0 flex items-end justify-center pb-5 z-10"
                style={{ background: 'linear-gradient(to bottom, transparent 20%, rgba(5,10,21,0.95) 75%)', borderRadius: 16 }}
              >
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
                      className="h-3.5 w-3.5 text-slate-500" aria-hidden>
                      <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm font-semibold" style={{ color: '#94A3B8' }}>
                      Real competitor data unlocked after signup
                    </p>
                  </div>
                  <p style={{ fontSize: 11, color: '#475569', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                    Sample data · Real analysis requires an account
                  </p>
                </div>
              </div>

              <div className="space-y-5 select-none">
                <CompetitorBar
                  label="My Brand"
                  sublabel={result.businessName}
                  pct={result.status === 'pass' ? 70 : 30}
                  color={result.status === 'pass' ? '#00F5A0' : '#EF4444'}
                  isMine
                />
                <CompetitorBar label="Top Competitor 1" sublabel="Sample · Real data after signup" pct={60} color="#334155" isMine={false} />
                <CompetitorBar label="Top Competitor 2" sublabel="Sample · Real data after signup" pct={45} color="#334155" isMine={false} />
                <CompetitorBar label="Top Competitor 3" sublabel="Sample · Real data after signup" pct={35} color="#334155" isMine={false} />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 4. Detected Issues & Fixes ───────────────────────────────────── */}
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
            <SectionLabel color="#EF4444">Detected Issues &amp; Fixes</SectionLabel>
          </Reveal>
          <Reveal delay={80}>
            <h2
              className="font-bold leading-tight mb-8"
              style={{ fontSize: 'clamp(24px,3.5vw,38px)', letterSpacing: '-0.02em', color: '#F1F5F9' }}
            >
              What AI gets wrong about your business
            </h2>
          </Reveal>

          <div className="space-y-4">
            {/* Item 1 — UNLOCKED */}
            <Reveal delay={120}>
              {accuracyIssues.length > 0 ? (
                <AccuracyIssueItem
                  text={accuracyIssues[0]}
                  category={accuracyIssueCategories[0] ?? 'other'}
                  isLocked={false}
                />
              ) : (
                <FallbackIssueCard result={result} />
              )}
            </Reveal>

            {/* Item 2 — LOCKED */}
            <Reveal delay={240}>
              {accuracyIssues.length >= 2 ? (
                <AccuracyIssueItem
                  text={accuracyIssues[1]}
                  category={accuracyIssueCategories[1] ?? 'other'}
                  isLocked
                />
              ) : (
                <LockedFixItem
                  title="Suppress hallucination across 6 AI Knowledge Graphs"
                  description="Push verified business data to override incorrect AI sources"
                />
              )}
            </Reveal>

            {/* Item 3 — LOCKED */}
            <Reveal delay={360}>
              {accuracyIssues.length >= 3 ? (
                <AccuracyIssueItem
                  text={accuracyIssues[2]}
                  category={accuracyIssueCategories[2] ?? 'other'}
                  isLocked
                />
              ) : (
                <LockedFixItem
                  title="Inject verified NAP data via Magic Menu"
                  description="Convert your menu + hours into structured data AI models trust"
                />
              )}
            </Reveal>
          </div>

          <Reveal delay={480}>
            <p
              className="mt-5"
              style={{ fontSize: 11, color: '#475569', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
            >
              Unlock all fixes and set up continuous monitoring with a free account.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── 5. Primary CTA ───────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden px-4"
        style={{ background: 'linear-gradient(180deg, #050A15 0%, #0A1628 100%)' }}
      >
        {/* Floating glow */}
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
              className="font-extrabold leading-tight mb-4"
              style={{ fontSize: 'clamp(26px,4vw,44px)', letterSpacing: '-0.03em', color: '#F1F5F9' }}
            >
              Your AI profile is live.
              <br />
              <span style={{ color: '#00F5A0' }}>Take control of it.</span>
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="text-base mb-9" style={{ color: '#94A3B8' }}>
              Claim your AI profile. Fix the lies. Monitor forever.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <a
              href="/signup"
              className="lv-btn-green"
              style={{ display: 'inline-block', fontSize: 15, padding: '16px 40px' }}
            >
              Claim My AI Profile — Start Free
            </a>
            <p
              className="mt-3"
              style={{ fontSize: 11, color: '#475569', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
            >
              No credit card required &middot; Cancel anytime
            </p>
            <div className="mt-5">
              <a
                href="/"
                className="lv-btn-outline"
                style={{ display: 'inline-block', padding: '8px 24px', fontSize: 13 }}
              >
                ← Run Another Scan
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// RealMentionsCard — real categorical from Perplexity scan
// ---------------------------------------------------------------------------

function RealMentionsCard({ mentions }: { mentions: 'none' | 'low' | 'medium' | 'high' }) {
  const color = mentionsColor(mentions);
  const border = mentionsBorderColor(mentions);

  return (
    <div className="lv-card" style={{ borderLeft: `3px solid ${border}` }}>
      <div className="mb-4">
        <p
          className="text-xs font-bold uppercase mb-0.5"
          style={{ color: '#64748B', letterSpacing: '0.14em', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
        >
          AI Mentions
        </p>
        <p style={{ fontSize: 11, color: '#475569' }}>Volume detected</p>
      </div>
      <div className="flex items-center gap-3 mb-3">
        {/* PulseDot */}
        <span className="relative flex h-2 w-2 shrink-0">
          <span
            className="absolute inline-flex h-full w-full rounded-full"
            style={{ background: color, animation: 'lv-ping 1.8s cubic-bezier(0,0,0.2,1) infinite' }}
          />
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
        </span>
        <p
          className="font-extrabold capitalize"
          style={{ fontSize: 'clamp(28px,3.5vw,40px)', color, fontFamily: 'var(--font-jetbrains-mono), monospace' }}
        >
          {mentions}
        </p>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>
        {mentionsDescription(mentions)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RealSentimentCard — real categorical from Perplexity scan
// ---------------------------------------------------------------------------

function RealSentimentCard({ sentiment }: { sentiment: 'positive' | 'neutral' | 'negative' }) {
  const color = sentimentColor(sentiment);
  const border = sentimentBorderColor(sentiment);

  return (
    <div className="lv-card" style={{ borderLeft: `3px solid ${border}` }}>
      <div className="mb-4">
        <p
          className="text-xs font-bold uppercase mb-0.5"
          style={{ color: '#64748B', letterSpacing: '0.14em', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
        >
          AI Sentiment
        </p>
        <p style={{ fontSize: 11, color: '#475569' }}>Tone AI uses for your brand</p>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <p
          className="font-extrabold"
          style={{ fontSize: 'clamp(28px,3.5vw,40px)', color, fontFamily: 'var(--font-jetbrains-mono), monospace' }}
        >
          {sentimentIcon(sentiment)}
        </p>
        <p
          className="font-extrabold capitalize"
          style={{ fontSize: 'clamp(28px,3.5vw,40px)', color, fontFamily: 'var(--font-jetbrains-mono), monospace' }}
        >
          {sentiment}
        </p>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>
        {sentimentDescription(sentiment)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LockedScoreCard — numerical score gated behind plan
// ---------------------------------------------------------------------------

function LockedScoreCard({
  title,
  abbr,
  description,
}: {
  title: string;
  abbr: string;
  description: string;
}) {
  return (
    <div className="lv-card relative overflow-hidden" style={{ borderLeft: '3px solid rgba(100,116,139,0.3)' }}>
      <LockOverlay />
      {/* Background content (behind lock overlay) */}
      <p
        className="text-xs font-bold uppercase mb-0.5"
        style={{ color: '#475569', letterSpacing: '0.14em', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
      >
        {title}
      </p>
      <p style={{ fontSize: 11, color: '#334155', marginBottom: 12 }}>{abbr}</p>
      <p
        className="font-extrabold select-none tabular-nums mb-3"
        style={{ fontSize: 'clamp(32px,4vw,48px)', color: '#334155', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
      >
        ██<span className="text-xl">/100</span>
      </p>
      <Bar pct={0} color="#334155" />
      <p className="mt-3" style={{ fontSize: 11, color: '#334155' }}>{description}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CompetitorBar — redesigned with Bar component
// ---------------------------------------------------------------------------

function CompetitorBar({
  label,
  sublabel,
  pct,
  color,
  isMine,
}: {
  label: string;
  sublabel: string;
  pct: number;
  color: string;
  isMine: boolean;
}) {
  return (
    <div
      className="flex items-center gap-4"
      style={isMine ? { borderLeft: `2px solid ${color}`, paddingLeft: 12 } : undefined}
    >
      <div className="w-32 shrink-0">
        <p
          className="text-xs font-semibold leading-tight"
          style={{ color: isMine ? '#F1F5F9' : '#64748B' }}
        >
          {label}
        </p>
        <p className="truncate" style={{ fontSize: 10, color: '#475569' }}>{sublabel}</p>
      </div>
      <div className="flex-1">
        <Bar pct={pct} color={color} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AccuracyIssueItem — real accuracy issue with category badge
// ---------------------------------------------------------------------------

function AccuracyIssueItem({
  text,
  category,
  isLocked,
}: {
  text: string;
  category: IssueCategory;
  isLocked: boolean;
}) {
  const accent = categoryBorderColor(category);

  const inner = (
    <div className="flex items-start gap-3">
      <span
        className="mt-0.5 shrink-0 rounded-md px-2 py-0.5"
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: accent,
          border: `1px solid ${accent}33`,
          fontFamily: 'var(--font-jetbrains-mono), monospace',
        }}
      >
        {categoryLabel(category)}
      </span>
      <p className="text-sm" style={{ color: '#CBD5E1' }}>{text}</p>
    </div>
  );

  if (!isLocked) {
    return (
      <div className="lv-card" style={{ borderLeft: `3px solid ${accent}` }}>
        {inner}
        {/* "Detected via" sub-card */}
        <div
          className="mt-3 rounded-xl p-3"
          style={{ background: 'rgba(255,255,255,0.03)', borderLeft: `2px solid ${accent}44` }}
        >
          <p
            className="text-xs font-semibold uppercase mb-1"
            style={{ color: '#64748B', letterSpacing: '0.08em' }}
          >
            Detected via
          </p>
          <p className="text-xs" style={{ color: '#CBD5E1' }}>Perplexity Sonar scan</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lv-card relative overflow-hidden select-none" style={{ borderLeft: `3px solid ${accent}33` }}>
      <LockPill />
      {inner}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FallbackIssueCard — shown when no accuracy issues, uses scan result
// ---------------------------------------------------------------------------

function FallbackIssueCard({ result }: { result: ScanDisplayData }) {
  if (result.status === 'invalid') return null;

  if (result.status === 'fail') {
    return (
      <div className="lv-card" style={{ borderLeft: '3px solid #EF4444' }}>
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 shrink-0 rounded-md px-2 py-0.5"
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#EF4444',
              background: 'rgba(239,68,68,0.10)',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
            }}
          >
            {result.severity}
          </span>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>
              {result.engine} reports &ldquo;{result.businessName}&rdquo; as &ldquo;{result.claimText}&rdquo;
            </p>
            <p className="text-xs mt-1" style={{ color: '#64748B' }}>
              Detected via Perplexity Sonar scan · Reality: {result.expectedTruth}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (result.status === 'pass') {
    return (
      <div className="lv-card" style={{ borderLeft: '3px solid #00F5A0' }}>
        <div className="flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
            className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#00F5A0' }} aria-hidden>
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#00F5A0' }}>
              No critical hallucinations found
            </p>
            <p className="text-xs mt-1" style={{ color: '#64748B' }}>
              {result.engine} currently shows accurate information. Monitoring ensures it stays that way.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // not_found
  return (
    <div className="lv-card" style={{ borderLeft: '3px solid #64748B' }}>
      <div className="flex items-start gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
          className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#94A3B8' }} aria-hidden>
          <path d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" />
        </svg>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#CBD5E1' }}>
            AI models have no data about your business
          </p>
          <p className="text-xs mt-1" style={{ color: '#64748B' }}>
            You have zero AI visibility — potential customers can&apos;t find you via AI search.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LockedFixItem — generic locked item
// ---------------------------------------------------------------------------

function LockedFixItem({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="lv-card relative overflow-hidden select-none">
      <LockPill />
      <p className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>{title}</p>
      <p className="text-xs mt-1" style={{ color: '#64748B' }}>{description}</p>
    </div>
  );
}
