'use client';
// ---------------------------------------------------------------------------
// ScanDashboard — Live AI Audit Dashboard (Sprint D Marketing: Conversion Upgrade)
//
// Receives parsed ScanDisplayData from the Server Component page.
//
// Redesigned for maximum conversion impact. Dashboard-feel layout with:
//   - Animated Visibility Score ring (derived from real scan data)
//   - Urgency elements (AI refresh warnings)
//   - Interactive expandable issue cards
//   - "What paid users see" dashboard preview
//   - Price-anchored CTAs (no free trial language)
//   - Enhanced model coverage progress
//
// AI_RULES §24: real categoricals shown free; locked numericals honest.
// AI_RULES §12: all Tailwind class strings are literals (ternary operators only).
// ---------------------------------------------------------------------------

import { useState, useEffect, useRef } from 'react';
import type { ScanDisplayData, IssueCategory } from '../_utils/scan-params';
import { getAccuracyIssueCategories } from '../_utils/scan-params';
import Reveal from '@/app/_components/Reveal';
import Bar from '@/app/_components/Bar';
import EmailCaptureForm from './EmailCaptureForm';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  result: ScanDisplayData;
}

// ---------------------------------------------------------------------------
// Local sub-component: SectionLabel
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
// Local sub-component: LockOverlay
// ---------------------------------------------------------------------------

function LockOverlay({ text = 'Sign up to unlock' }: { text?: string }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      style={{ backgroundColor: 'rgba(10,22,40,0.85)', backdropFilter: 'blur(3px)', borderRadius: 16 }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
        className="h-5 w-5 text-slate-400 mb-2" aria-hidden>
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
// Local sub-component: LockPill
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
// Helper functions
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
       :                  '#94A3B8';
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
  return s === 'positive' ? '#00F5A0' : s === 'negative' ? '#EF4444' : '#94A3B8';
}

function sentimentIcon(s: 'positive' | 'neutral' | 'negative'): string {
  return s === 'positive' ? '\u2191' : s === 'negative' ? '\u2193' : '\u2192';
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
       :                   '#94A3B8';
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

function statusAccent(s: 'fail' | 'pass' | 'not_found'): string {
  return s === 'fail' ? '#EF4444' : s === 'pass' ? '#00F5A0' : '#94A3B8';
}

// ---------------------------------------------------------------------------
// Visibility Score computation — derived from real scan data (§24 compliant)
//
// Composite metric based on:
//   mentions volume (0-70 pts)
//   sentiment modifier (-15 to +15 pts)
//   accuracy issues penalty (-5 per issue, max -15)
//   not_found override -> 0
//   pass bonus -> +10
// Capped at 0-100. Labeled "Based on your scan data" for transparency.
// ---------------------------------------------------------------------------

/** Exported for testing — derive visibility score from real scan data. */
export function computeVisibilityScore(result: ScanDisplayData): number {
  if (result.status === 'not_found') return 0;
  if (result.status === 'invalid') return 0;

  const mentions = getMentions(result);
  const sentiment = getSentiment(result);
  const issues = getAccuracyIssues(result);

  // Base from mentions
  let score = mentions === 'high' ? 70
            : mentions === 'medium' ? 45
            : mentions === 'low' ? 20
            : 5;

  // Sentiment modifier
  score += sentiment === 'positive' ? 15
         : sentiment === 'negative' ? -15
         : 0;

  // Issues penalty
  score -= Math.min(issues.length, 3) * 5;

  // Pass bonus
  if (result.status === 'pass') score += 10;

  return Math.max(0, Math.min(100, score));
}

/** Exported for testing — derive grade from visibility score. */
export function scoreGrade(score: number): { label: string; color: string; urgency: string } {
  if (score >= 70) return { label: 'Good', color: '#00F5A0', urgency: 'Maintain your position with continuous monitoring' };
  if (score >= 50) return { label: 'Needs Attention', color: '#FFB800', urgency: 'Competitors are being recommended over you right now' };
  if (score >= 25) return { label: 'At Risk', color: '#EF4444', urgency: 'AI is actively sending customers to your competitors' };
  return { label: 'Critical', color: '#EF4444', urgency: 'Your business is invisible to AI \u2014 every day costs you customers' };
}

// ---------------------------------------------------------------------------
// ScoreRing — animated SVG circular score
// ---------------------------------------------------------------------------

function ScoreRing({ score, color }: { score: number; color: string }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [strokeProgress, setStrokeProgress] = useState(0);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const duration = 1500; // ms
    startTimeRef.current = performance.now();

    function animate(now: number) {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);

      setAnimatedScore(Math.round(eased * score));
      setStrokeProgress(eased * score);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [score]);

  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (strokeProgress / 100) * circumference;

  return (
    <div className="relative" style={{ width: 180, height: 180 }}>
      <svg viewBox="0 0 180 180" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
        {/* Background ring */}
        <circle
          cx="90" cy="90" r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="8"
        />
        {/* Progress ring */}
        <circle
          cx="90" cy="90" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke 0.3s' }}
        />
        {/* Glow effect */}
        <circle
          cx="90" cy="90" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ filter: `drop-shadow(0 0 8px ${color}44)` }}
        />
      </svg>
      {/* Score number in center */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p
          className="font-extrabold tabular-nums"
          style={{
            fontSize: 48,
            color,
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            lineHeight: 1,
          }}
        >
          {animatedScore}
        </p>
        <p
          className="text-xs font-semibold uppercase"
          style={{
            color: '#94A3B8',
            letterSpacing: '0.1em',
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            marginTop: 4,
          }}
        >
          / 100
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScanDashboard
// ---------------------------------------------------------------------------

export default function ScanDashboard({ result }: Props) {
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);

  // Invalid / missing params — show simple fallback
  if (result.status === 'invalid') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <p className="text-base font-semibold mb-4" style={{ color: '#94A3B8' }}>
          No valid scan result found.
        </p>
        <a href="/" className="lv-btn-outline" style={{ padding: '8px 24px', fontSize: 13 }}>
          &larr; Run a free scan
        </a>
      </div>
    );
  }

  const mentions                = getMentions(result);
  const sentiment               = getSentiment(result);
  const accuracyIssues          = getAccuracyIssues(result);
  const accuracyIssueCategories = getAccuracyIssueCategories(result);
  const accent                  = statusAccent(result.status);
  const visibilityScore         = computeVisibilityScore(result);
  const grade                   = scoreGrade(visibilityScore);

  return (
    <>
      {/* ── Inline styles for scan dashboard animations ──────────────── */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes scan-slide-in {
              from { opacity: 0; transform: translateX(-12px); }
              to { opacity: 1; transform: translateX(0); }
            }
            @keyframes scan-urgency-pulse {
              0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.3); }
              50% { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
            }
            @keyframes scan-check-appear {
              from { opacity: 0; transform: scale(0.5); }
              to { opacity: 1; transform: scale(1); }
            }
            .scan-issue-expand {
              max-height: 0;
              overflow: hidden;
              transition: max-height 0.4s cubic-bezier(.16,1,.3,1), opacity 0.3s;
              opacity: 0;
            }
            .scan-issue-expand.open {
              max-height: 200px;
              opacity: 1;
            }
          `,
        }}
      />

      {/* ── 0. Dashboard Nav ───────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-20 border-b border-white/5 backdrop-blur-sm"
        style={{ backgroundColor: 'rgba(5,10,21,0.92)' }}
      >
        <div className="mx-auto flex max-w-[1120px] items-center justify-between px-6" style={{ height: 64 }}>
          <a href="/" className="flex items-center gap-2 text-base font-bold" style={{ letterSpacing: '-0.02em' }}>
            <img src="/logo.svg" alt="" className="h-7 w-auto" aria-hidden />
            <span style={{ color: '#00F5A0' }}>LocalVector</span>
            <span className="text-slate-500">.ai</span>
          </a>
          <div className="flex items-center gap-3">
            {/* Score badge in nav */}
            <div
              className="hidden sm:flex items-center gap-2 rounded-full px-3 py-1.5"
              style={{ background: `${grade.color}12`, border: `1px solid ${grade.color}33` }}
            >
              <span
                className="text-xs font-bold tabular-nums"
                style={{ color: grade.color, fontFamily: 'var(--font-jetbrains-mono), monospace' }}
              >
                Score: {visibilityScore}
              </span>
            </div>
            <a
              href="/signup"
              className="lv-btn-green"
              style={{ padding: '8px 20px', fontSize: 13, animation: 'none' }}
            >
              Fix This Now &rarr;
            </a>
          </div>
        </div>
      </nav>

      {/* ── 1. Score Hero ──────────────────────────────────────────────── */}
      <section className="px-4" style={{ backgroundColor: '#050A15' }}>
        <div className="lv-section" style={{ paddingTop: 48, paddingBottom: 32 }}>
          <Reveal>
            <SectionLabel color={accent}>AI Audit Result</SectionLabel>
          </Reveal>
          <Reveal delay={80}>
            <h1
              className="font-bold leading-tight mb-2"
              style={{
                fontSize: 'clamp(22px,3vw,32px)',
                letterSpacing: '-0.02em',
                color: '#F1F5F9',
              }}
            >
              AI Audit: {result.businessName}
            </h1>
            <p className="text-sm mb-8" style={{ color: '#64748B' }}>
              Scanned via Perplexity Sonar &middot; {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </Reveal>

          {/* Score ring + grade */}
          <Reveal delay={160}>
            <div className="flex flex-col sm:flex-row items-center gap-8 mb-8">
              <ScoreRing score={visibilityScore} color={grade.color} />
              <div className="text-center sm:text-left">
                <p className="text-sm font-semibold uppercase mb-1" style={{ color: '#94A3B8', letterSpacing: '0.1em', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                  AI Visibility Score
                </p>
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="rounded-md px-3 py-1 text-sm font-bold uppercase"
                    style={{
                      color: grade.color,
                      background: `${grade.color}15`,
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {grade.label}
                  </span>
                </div>
                <p className="text-sm" style={{ color: '#CBD5E1', maxWidth: 360, lineHeight: 1.6 }}>
                  {grade.urgency}
                </p>
                <p
                  className="text-xs mt-3"
                  style={{ color: '#475569', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                >
                  Based on your scan data &middot; 1 of 5 AI models scanned
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 1a. Urgency strip ──────────────────────────────────────────── */}
      <section className="px-4" style={{ backgroundColor: '#050A15' }}>
        <div className="lv-section" style={{ paddingTop: 0, paddingBottom: 24 }}>
          <Reveal>
            <div
              className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 rounded-xl py-4 px-6"
              style={{
                background: 'rgba(239,68,68,0.04)',
                border: '1px solid rgba(239,68,68,0.12)',
              }}
            >
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span
                    className="absolute inline-flex h-full w-full rounded-full"
                    style={{ background: '#EF4444', animation: 'lv-ping 1.8s cubic-bezier(0,0,0.2,1) infinite' }}
                  />
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: '#EF4444' }} />
                </span>
                <p className="text-xs font-semibold" style={{ color: '#EF4444', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                  AI models refresh every 48-72 hours
                </p>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.08)' }}>|</span>
              <p className="text-xs" style={{ color: '#94A3B8' }}>
                Your score could change at any time without monitoring
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 1b. Alert Banner ──────────────────────────────────────────── */}
      <section className="px-4" style={{ backgroundColor: '#050A15' }}>
        <div className="lv-section" style={{ paddingTop: 0, paddingBottom: 32 }}>
          <Reveal delay={200}>
            {result.status === 'fail' && (
              <div
                className="lv-card relative overflow-hidden"
                style={{ borderLeft: '3px solid #EF4444' }}
              >
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
                  shows accurate data today.{' '}
                  AI knowledge bases refresh every 48{'\u2013'}72 hours {'\u2014'} the next refresh could introduce wrong hours, a closed status, or outdated menu prices.{' '}
                  You won&apos;t know until a customer doesn&apos;t show up.
                </p>
              </div>
            )}
            {result.status === 'not_found' && (
              <div
                className="lv-card relative overflow-hidden"
                style={{ borderLeft: '3px solid #94A3B8', animation: 'scan-urgency-pulse 2s ease-in-out infinite' }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                    className="h-5 w-5 shrink-0" style={{ color: '#EF4444' }} aria-hidden>
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  <p className="text-base font-bold" style={{ color: '#EF4444' }}>
                    Invisible to AI Search
                  </p>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>
                  ChatGPT, Perplexity, and Gemini handle <span className="font-semibold" style={{ color: '#F1F5F9' }}>millions</span> of restaurant questions daily.
                  None of them have data for{' '}
                  <span className="font-semibold" style={{ color: '#CBD5E1' }}>&ldquo;{result.businessName}&rdquo;</span>.
                  While competitors get recommended, you don&apos;t exist {'\u2014'} and you&apos;re losing customers to them right now.
                </p>
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/* ── 1c. Email capture — above fold for fail results ──────────── */}
      {result.status === 'fail' && (
        <section className="px-4" style={{ backgroundColor: '#050A15' }}>
          <div className="lv-section" style={{ paddingTop: 0, paddingBottom: 32 }}>
            <Reveal>
              <div className="mx-auto" style={{ maxWidth: 560 }}>
                <EmailCaptureForm
                  businessName={result.businessName}
                  scanStatus={result.status}
                />
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ── 1d. Trust signals ──────────────────────────────────────────── */}
      <section className="px-4" style={{ backgroundColor: '#050A15' }}>
        <div className="lv-section" style={{ paddingTop: 0, paddingBottom: 24 }}>
          <Reveal>
            <div
              className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
              style={{ fontSize: 12, color: '#475569', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
            >
              <span className="flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
                  <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clipRule="evenodd" />
                </svg>
                No data stored
              </span>
              <span style={{ color: 'rgba(255,255,255,0.08)' }}>|</span>
              <span className="flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
                  <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12.735 14c.618 0 1.093-.561.872-1.139a6.002 6.002 0 0 0-11.215 0c-.22.578.254 1.139.872 1.139h9.47Z" />
                </svg>
                Real AI data, not simulated
              </span>
              <span style={{ color: 'rgba(255,255,255,0.08)' }}>|</span>
              <span className="flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
                  <path fillRule="evenodd" d="M1 8a7 7 0 1 1 14 0A7 7 0 0 1 1 8Zm7.75-4.25a.75.75 0 0 0-1.5 0V8c0 .414.336.75.75.75h3.25a.75.75 0 0 0 0-1.5h-2.5v-3.5Z" clipRule="evenodd" />
                </svg>
                8-second scan
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 2. AI Model Coverage (enhanced) ────────────────────────────── */}
      <section className="px-4" style={{ backgroundColor: '#050A15' }}>
        <div className="lv-section" style={{ paddingTop: 0, paddingBottom: 48 }}>
          <Reveal>
            <div className="lv-card" style={{ padding: 24 }}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <SectionLabel>AI Model Coverage</SectionLabel>
                  <p className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>
                    Scanned 1 of 5 AI models
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Mini progress ring */}
                  <div className="relative" style={{ width: 40, height: 40 }}>
                    <svg viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                      <circle cx="20" cy="20" r="16" fill="none" stroke="#FFB800" strokeWidth="3" strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 16}`}
                        strokeDashoffset={`${2 * Math.PI * 16 * 0.8}`}
                      />
                    </svg>
                    <span
                      className="absolute inset-0 flex items-center justify-center text-xs font-bold"
                      style={{ color: '#FFB800', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                    >
                      20%
                    </span>
                  </div>
                  <span
                    className="text-xs font-semibold rounded-md px-2.5 py-1"
                    style={{
                      color: '#FFB800',
                      background: 'rgba(255,184,0,0.12)',
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                    }}
                  >
                    Incomplete
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                {/* Perplexity Sonar — scanned */}
                <div
                  className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ background: 'rgba(0,245,160,0.06)', border: '1px solid rgba(0,245,160,0.15)' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                    className="h-4 w-4 shrink-0" style={{ color: '#00F5A0', animation: 'scan-check-appear 0.5s ease-out both' }} aria-hidden>
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>Perplexity Sonar</span>
                  <span
                    className="ml-auto text-xs font-semibold rounded-md px-2 py-0.5"
                    style={{
                      color: '#00F5A0',
                      background: 'rgba(0,245,160,0.12)',
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                    }}
                  >
                    Scanned
                  </span>
                </div>
                {/* Locked models with individual urgency hints */}
                {([
                  { name: 'ChatGPT', hint: 'Most used AI for restaurant searches' },
                  { name: 'Google Gemini', hint: 'Powers Google AI Overview' },
                  { name: 'Claude', hint: 'Used by AI assistants & booking apps' },
                  { name: 'Microsoft Copilot', hint: 'Integrated into Bing & Edge' },
                ] as const).map((model, i) => (
                  <div key={model.name} className="relative overflow-hidden rounded-xl" style={{ animation: `scan-slide-in 0.4s ease-out ${(i + 1) * 100}ms both` }}>
                    <LockPill />
                    <div
                      className="flex items-center gap-3 px-4 py-3 select-none"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
                        className="h-4 w-4 shrink-0 text-slate-600" aria-hidden>
                        <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <span className="text-sm font-semibold text-slate-600">{model.name}</span>
                        <p className="text-xs" style={{ color: '#334155' }}>{model.hint}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div
                className="mt-5 rounded-xl p-4 text-center"
                style={{ background: 'rgba(255,184,0,0.04)', border: '1px solid rgba(255,184,0,0.12)' }}
              >
                <p className="text-sm font-semibold mb-1" style={{ color: '#FFB800' }}>
                  You&apos;re only seeing 20% of the picture
                </p>
                <p className="text-xs" style={{ color: '#94A3B8' }}>
                  ChatGPT alone handles 100M+ queries/week. Your business could be misrepresented on models you haven&apos;t checked.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 3. Real Data KPI Cards ─────────────────────────────────────── */}
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
          <div className="lv-grid2 mb-6">
            <Reveal delay={0}>
              <RealMentionsCard mentions={mentions} />
            </Reveal>
            <Reveal delay={150}>
              <RealSentimentCard sentiment={sentiment} />
            </Reveal>
          </div>

          {/* Revenue impact (locked) */}
          <Reveal delay={160}>
            <LockedRevenueCard mentions={mentions} status={result.status} />
          </Reveal>

          {/* Locked score cards */}
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
                title="AI Health Score"
                abbr="AHS"
                description="How often AI cites your business accurately"
              />
            </Reveal>
            <Reveal delay={400}>
              <LockedScoreCard
                title="Platform Coverage"
                abbr="PC"
                description="AI accuracy on hours, address, and menu"
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 4. What Paid Users See — Dashboard Preview ──────────────────── */}
      <section className="px-4" style={{ backgroundColor: '#050A15' }}>
        <div className="lv-section">
          <Reveal>
            <SectionLabel color="#6366f1">What Your Dashboard Looks Like</SectionLabel>
            <h2
              className="font-bold leading-tight mb-3"
              style={{ fontSize: 'clamp(20px,3vw,30px)', letterSpacing: '-0.02em', color: '#F1F5F9' }}
            >
              This is what monitoring looks like
            </h2>
            <p className="text-sm mb-8" style={{ color: '#94A3B8', maxWidth: 560, lineHeight: 1.6 }}>
              LocalVector customers see this dashboard every day. Real-time alerts, competitor tracking, and automated fixes {'\u2014'} not a one-time scan.
            </p>
          </Reveal>

          {/* Dashboard feature grid */}
          <div className="lv-grid2 mb-8">
            {([
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                ),
                title: 'Daily AI Monitoring',
                desc: 'Automatic scans across 5 AI models. Instant alerts when something changes.',
                color: '#00F5A0',
              },
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
                    <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z" />
                    <path d="M11.603 7.963a.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 105.656 5.656l3-3a4 4 0 00-.225-5.865z" />
                  </svg>
                ),
                title: 'Hallucination Fix Engine',
                desc: 'We detect the lie, generate the correction, and push it to the source.',
                color: '#EF4444',
              },
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
                    <path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 002 4.25v11.5A2.25 2.25 0 004.25 18h11.5A2.25 2.25 0 0018 15.75V4.25A2.25 2.25 0 0015.75 2H4.25zm4.03 6.28a.75.75 0 00-1.06-1.06L4.97 9.47a.75.75 0 000 1.06l2.25 2.25a.75.75 0 001.06-1.06L6.56 10l1.72-1.72zm3.44-1.06a.75.75 0 10-1.06 1.06L12.38 10l-1.72 1.72a.75.75 0 101.06 1.06l2.25-2.25a.75.75 0 000-1.06l-2.25-2.25z" clipRule="evenodd" />
                  </svg>
                ),
                title: 'Competitor Intelligence',
                desc: 'See who AI recommends instead of you, and why. Track share-of-voice weekly.',
                color: '#6366f1',
              },
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
                    <path fillRule="evenodd" d="M1 4a1 1 0 011-1h16a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V4zm12 1a.75.75 0 01.75.75v.5a.75.75 0 01-1.5 0v-.5A.75.75 0 0113 5zM7.5 7.75A.75.75 0 018.25 7h3.5a.75.75 0 01.664 1.102l-2 3.75a.75.75 0 01-1.328-.706L10.797 8.5H8.25A.75.75 0 017.5 7.75zM2 17.5h16a.75.75 0 010 1.5H2a.75.75 0 010-1.5z" clipRule="evenodd" />
                  </svg>
                ),
                title: 'Revenue Impact Calculator',
                desc: 'See exactly how much revenue you lose when AI sends customers elsewhere.',
                color: '#FFB800',
              },
            ] as const).map((feature, i) => (
              <Reveal key={feature.title} delay={i * 100}>
                <div
                  className="lv-card"
                  style={{ borderLeft: `3px solid ${feature.color}33` }}
                >
                  <div className="flex items-start gap-3">
                    <div style={{ color: feature.color }} className="shrink-0 mt-0.5">
                      {feature.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold mb-1" style={{ color: '#F1F5F9' }}>
                        {feature.title}
                      </p>
                      <p className="text-xs" style={{ color: '#94A3B8', lineHeight: 1.5 }}>
                        {feature.desc}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* "What you're missing" summary */}
          <Reveal delay={400}>
            <div
              className="rounded-xl p-5 text-center"
              style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)' }}
            >
              <p className="text-sm font-semibold mb-2" style={{ color: '#F1F5F9' }}>
                You just saw a snapshot. Customers see the full movie.
              </p>
              <p className="text-xs mb-4" style={{ color: '#94A3B8', lineHeight: 1.6 }}>
                This scan checked 1 AI model, once. LocalVector monitors 5 models, every day,
                and fixes problems automatically.
              </p>
              <a
                href="/signup"
                className="lv-btn-green"
                style={{ display: 'inline-block', fontSize: 14, padding: '12px 28px' }}
              >
                Get the Full Dashboard &rarr;
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 5. Competitive Landscape (enhanced teaser) ──────────────────── */}
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
              <div
                className="absolute inset-0 flex items-end justify-center pb-5 z-10"
                style={{ background: 'linear-gradient(to bottom, transparent 20%, rgba(5,10,21,0.95) 75%)', borderRadius: 16 }}
              >
                <div className="text-center">
                  <p className="text-sm font-semibold mb-1" style={{ color: '#FFB800' }}>
                    Who is AI recommending instead of you?
                  </p>
                  <p style={{ fontSize: 11, color: '#475569', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                    Real competitor data unlocked after signup
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
                <CompetitorBar label="Top Competitor 1" sublabel="Sample &middot; Real data after signup" pct={60} color="#334155" isMine={false} />
                <CompetitorBar label="Top Competitor 2" sublabel="Sample &middot; Real data after signup" pct={45} color="#334155" isMine={false} />
                <CompetitorBar label="Top Competitor 3" sublabel="Sample &middot; Real data after signup" pct={35} color="#334155" isMine={false} />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 6. Detected Issues (interactive, expandable) ────────────────── */}
      <section className="px-4" style={{ backgroundColor: '#050A15' }}>
        <div className="lv-section">
          <Reveal>
            <SectionLabel color="#EF4444">Detected Issues &amp; Fixes</SectionLabel>
          </Reveal>
          <Reveal delay={80}>
            <h2
              className="font-bold leading-tight mb-3"
              style={{ fontSize: 'clamp(20px,3vw,30px)', letterSpacing: '-0.02em', color: '#F1F5F9' }}
            >
              What AI gets wrong about your business
            </h2>
            <p className="text-sm mb-8" style={{ color: '#94A3B8', lineHeight: 1.6 }}>
              {accuracyIssues.length > 0
                ? `We found ${accuracyIssues.length} issue${accuracyIssues.length > 1 ? 's' : ''} in this scan. Tap any issue to see what happens next.`
                : 'Here\u2019s what we found in your scan.'}
            </p>
          </Reveal>

          <div className="space-y-4">
            {/* Issue 1 — UNLOCKED + expandable */}
            <Reveal delay={120}>
              {accuracyIssues.length > 0 ? (
                <InteractiveIssueCard
                  text={accuracyIssues[0]}
                  category={accuracyIssueCategories[0] ?? 'other'}
                  isLocked={false}
                  isExpanded={expandedIssue === 0}
                  onToggle={() => setExpandedIssue(expandedIssue === 0 ? null : 0)}
                />
              ) : (
                <FallbackIssueCard result={result} />
              )}
            </Reveal>

            {/* Issue 2 — LOCKED */}
            <Reveal delay={240}>
              {accuracyIssues.length >= 2 ? (
                <InteractiveIssueCard
                  text={accuracyIssues[1]}
                  category={accuracyIssueCategories[1] ?? 'other'}
                  isLocked
                  isExpanded={false}
                  onToggle={() => {}}
                />
              ) : (
                <LockedFixItem
                  title="Suppress hallucination across 6 AI Knowledge Graphs"
                  description="Push verified business data to override incorrect AI sources"
                />
              )}
            </Reveal>

            {/* Issue 3 — LOCKED */}
            <Reveal delay={360}>
              {accuracyIssues.length >= 3 ? (
                <InteractiveIssueCard
                  text={accuracyIssues[2]}
                  category={accuracyIssueCategories[2] ?? 'other'}
                  isLocked
                  isExpanded={false}
                  onToggle={() => {}}
                />
              ) : (
                <LockedFixItem
                  title="Push verified data via Distribution Engine to 6+ AI platforms"
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
              LocalVector fixes these automatically {'\u2014'} no manual work required.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── 7. Price-Anchored Final CTA ────────────────────────────────── */}
      <section
        className="relative overflow-hidden px-4"
        style={{ background: 'linear-gradient(180deg, #050A15 0%, #0A1628 100%)' }}
      >
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

        <div className="lv-section relative">
          {/* Score recap */}
          <Reveal>
            <div className="text-center mb-8">
              <p
                className="text-xs font-bold uppercase mb-4"
                style={{ color: grade.color, letterSpacing: '0.14em', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
              >
                Your AI Visibility Score: {visibilityScore}/100
              </p>
              <h2
                className="font-extrabold leading-tight mb-4"
                style={{ fontSize: 'clamp(26px,4vw,44px)', letterSpacing: '-0.03em', color: '#F1F5F9' }}
              >
                {visibilityScore < 50
                  ? (<>AI is losing you customers.<br /><span style={{ color: '#00F5A0' }}>Fix it today.</span></>)
                  : (<>Your AI profile is live.<br /><span style={{ color: '#00F5A0' }}>Take control of it.</span></>)
                }
              </h2>
              <p className="text-base mb-2" style={{ color: '#94A3B8', maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
                {visibilityScore < 50
                  ? 'Every day without monitoring is another day AI sends customers to your competitors.'
                  : 'Claim your AI profile. Fix the lies. Monitor forever.'}
              </p>
            </div>
          </Reveal>

          {/* Price anchor card */}
          <Reveal delay={120}>
            <div
              className="mx-auto mb-8 rounded-xl p-6 text-center"
              style={{
                maxWidth: 520,
                background: 'rgba(0,245,160,0.03)',
                border: '1px solid rgba(0,245,160,0.15)',
              }}
            >
              <p className="text-sm font-semibold mb-1" style={{ color: '#F1F5F9' }}>
                Starts at $49/mo {'\u2014'} less than one lost customer
              </p>
              <p className="text-xs mb-5" style={{ color: '#94A3B8' }}>
                The average restaurant loses $800+/mo to AI misinformation. You&apos;ll see ROI on day one.
              </p>
              <a
                href="/signup"
                className="lv-btn-green"
                style={{ display: 'inline-block', fontSize: 15, padding: '14px 36px', fontWeight: 700 }}
              >
                Claim My AI Profile &rarr;
              </a>
              <p
                className="mt-3"
                style={{ fontSize: 11, color: '#475569', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
              >
                No credit card required &middot; Setup in 2 minutes
              </p>
            </div>
          </Reveal>

          {/* Email capture */}
          <Reveal delay={200}>
            <div className="mx-auto mb-8" style={{ maxWidth: 560 }}>
              <EmailCaptureForm
                businessName={result.businessName}
                scanStatus={result.status}
              />
            </div>
          </Reveal>

          {/* Trust quote */}
          <Reveal delay={280}>
            <div
              className="mx-auto text-center"
              style={{
                maxWidth: 480,
                marginBottom: 32,
                padding: '20px 24px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <p
                className="text-sm italic"
                style={{ color: '#94A3B8', lineHeight: 1.65, marginBottom: 8 }}
              >
                &ldquo;ChatGPT was telling people we were permanently closed. We had no idea
                until LocalVector flagged it.&rdquo;
              </p>
              <p
                className="text-xs"
                style={{ color: '#475569', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
              >
                {'\u2014'} Restaurant owner, Atlanta
              </p>
            </div>
          </Reveal>

          {/* Secondary links */}
          <Reveal delay={360}>
            <div className="text-center">
              <a
                href="/pricing"
                className="text-sm underline underline-offset-2"
                style={{ color: '#94A3B8' }}
              >
                Compare plans
              </a>
              <span className="mx-3" style={{ color: 'rgba(255,255,255,0.08)' }}>|</span>
              <a
                href="/"
                className="text-sm underline underline-offset-2"
                style={{ color: '#94A3B8' }}
              >
                Run another scan
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// RealMentionsCard
// ---------------------------------------------------------------------------

function RealMentionsCard({ mentions }: { mentions: 'none' | 'low' | 'medium' | 'high' }) {
  const color = mentionsColor(mentions);
  const border = mentionsBorderColor(mentions);

  return (
    <div className="lv-card" style={{ borderLeft: `3px solid ${border}` }}>
      <div className="mb-4">
        <p
          className="text-xs font-bold uppercase mb-0.5"
          style={{ color: '#94A3B8', letterSpacing: '0.14em', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
        >
          AI Mentions
        </p>
        <p style={{ fontSize: 11, color: '#475569' }}>Volume detected</p>
      </div>
      <div className="flex items-center gap-3 mb-3">
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
// RealSentimentCard
// ---------------------------------------------------------------------------

function RealSentimentCard({ sentiment }: { sentiment: 'positive' | 'neutral' | 'negative' }) {
  const color = sentimentColor(sentiment);
  const border = sentimentBorderColor(sentiment);

  return (
    <div className="lv-card" style={{ borderLeft: `3px solid ${border}` }}>
      <div className="mb-4">
        <p
          className="text-xs font-bold uppercase mb-0.5"
          style={{ color: '#94A3B8', letterSpacing: '0.14em', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
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
// LockedScoreCard
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
        {'\u2588\u2588'}<span className="text-xl">/100</span>
      </p>
      <Bar pct={0} color="#334155" />
      <p className="mt-3" style={{ fontSize: 11, color: '#334155' }}>{description}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CompetitorBar
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
          style={{ color: isMine ? '#F1F5F9' : '#94A3B8' }}
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
// InteractiveIssueCard — expandable issue with fix preview
// ---------------------------------------------------------------------------

function InteractiveIssueCard({
  text,
  category,
  isLocked,
  isExpanded,
  onToggle,
}: {
  text: string;
  category: IssueCategory;
  isLocked: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const accent = categoryBorderColor(category);

  if (isLocked) {
    return (
      <div className="lv-card relative overflow-hidden select-none" style={{ borderLeft: `3px solid ${accent}33` }}>
        <LockPill />
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
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full text-left"
      style={{ all: 'unset', display: 'block', width: '100%', cursor: 'pointer', boxSizing: 'border-box' }}
    >
      <div className="lv-card" style={{ borderLeft: `3px solid ${accent}` }}>
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
          <div className="flex-1">
            <p className="text-sm" style={{ color: '#CBD5E1' }}>{text}</p>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
            className="h-4 w-4 shrink-0 mt-1"
            style={{
              color: '#64748B',
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s',
            }}
            aria-hidden
          >
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>

        {/* Detected via */}
        <div
          className="mt-3 rounded-xl p-3"
          style={{ background: 'rgba(255,255,255,0.03)', borderLeft: `2px solid ${accent}44` }}
        >
          <p
            className="text-xs font-semibold uppercase mb-1"
            style={{ color: '#94A3B8', letterSpacing: '0.08em' }}
          >
            Detected via
          </p>
          <p className="text-xs" style={{ color: '#CBD5E1' }}>Perplexity Sonar scan</p>
        </div>

        {/* Expandable fix preview */}
        <div className={`scan-issue-expand ${isExpanded ? 'open' : ''}`}>
          <div
            className="mt-3 rounded-xl p-4"
            style={{ background: 'rgba(0,245,160,0.04)', border: '1px solid rgba(0,245,160,0.12)' }}
          >
            <p
              className="text-xs font-bold uppercase mb-2"
              style={{ color: '#00F5A0', letterSpacing: '0.1em', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
            >
              How LocalVector fixes this
            </p>
            <div className="space-y-2">
              <FixStep text="Detect the inaccuracy across all AI models" />
              <FixStep text="Generate correction content with verified data" />
              <FixStep text="Push fixes to 6+ AI knowledge graphs automatically" />
              <FixStep text="Monitor until verified corrected" />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// FixStep — single step in the fix preview
// ---------------------------------------------------------------------------

function FixStep({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 shrink-0" style={{ color: '#00F5A0' }} aria-hidden>
        <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 01.208 1.04l-5 7.5a.75.75 0 01-1.154.114l-3-3a.75.75 0 011.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 011.04-.207z" clipRule="evenodd" />
      </svg>
      <p className="text-xs" style={{ color: '#CBD5E1' }}>{text}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FallbackIssueCard
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
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
              Detected via Perplexity Sonar scan &middot; Reality: {result.expectedTruth}
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
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
              {result.engine} currently shows accurate information. Monitoring ensures it stays that way.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // not_found
  return (
    <div className="lv-card" style={{ borderLeft: '3px solid #FFB800' }}>
      <div className="flex items-start gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
          className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#FFB800' }} aria-hidden>
          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#FFB800' }}>
            AI models have no data about your business
          </p>
          <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
            This is a critical visibility gap {'\u2014'} when customers ask AI for recommendations, your business won&apos;t appear. LocalVector fixes this by pushing your data to AI platforms.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LockedRevenueCard
// ---------------------------------------------------------------------------

function LockedRevenueCard({
  mentions,
  status,
}: {
  mentions: 'none' | 'low' | 'medium' | 'high';
  status: 'fail' | 'pass' | 'not_found';
}) {
  const isHighRisk = status === 'not_found' || mentions === 'none' || mentions === 'low';
  const isMedRisk  = !isHighRisk && mentions === 'medium';

  const accentColor  = isHighRisk ? '#EF4444' : isMedRisk ? '#FFB800' : '#94A3B8';
  const accentBorder = isHighRisk ? '#EF4444' : isMedRisk ? '#FFB800' : '#94A3B8';
  const redactColor  = isHighRisk ? '#EF4444' : isMedRisk ? '#FFB800' : '#94A3B8';

  return (
    <div
      className="lv-card relative overflow-hidden mb-12"
      style={{ borderLeft: `3px solid ${accentBorder}` }}
    >
      <LockOverlay text="Sign up to see your estimated revenue impact" />
      <p
        className="text-xs font-bold uppercase mb-1"
        style={{ color: '#475569', letterSpacing: '0.14em', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
      >
        Estimated Monthly Revenue at Risk
      </p>
      <p
        className="font-extrabold select-none tabular-nums mb-2"
        style={{ fontSize: 'clamp(28px,3.5vw,40px)', color: redactColor, fontFamily: 'var(--font-jetbrains-mono), monospace' }}
      >
        {'\u2588\u2588\u2588\u2588'} / mo
      </p>
      <p style={{ fontSize: 12, color: accentColor }}>
        Based on your AI visibility level and typical restaurant traffic in your market
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LockedFixItem
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
      <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>{description}</p>
    </div>
  );
}
