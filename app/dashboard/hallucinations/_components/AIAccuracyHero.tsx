// ---------------------------------------------------------------------------
// AIAccuracyHero — S3 AI Mistakes coaching hero
//
// Pure server component. No state or effects — CSS animations only.
//
// Replaces the clinical TruthScoreCard + EngineComparisonGrid side-by-side
// grid with a full-bleed coaching panel that tells the owner:
//   1. Exactly where they stand ("Spot On / Mostly Right / A Few Errors / Needs Fixing")
//   2. What it means in plain English
//   3. The #1 issue to fix right now (coaching card with "Fix in 2 min →" CTA)
//   4. Per-engine breakdown as colored dots + score (no jargon)
//
// Design consistent with CustomerLoveHero (S2):
//   • lv-scan accent sweep on top edge
//   • lv-orb-breathe ambient glow in grade color
//   • lv-ping rings on score orb when issues exist
//   • Flat inline engine row (no separate card)
//   • InfoTooltip — plain owner language, no AI/SEO jargon
// ---------------------------------------------------------------------------

import Link from 'next/link';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import type { EvaluationEngine } from '@/lib/schemas/evaluations';

// ─── Types ────────────────────────────────────────────────────────────────────

type Grade = 'spot-on' | 'mostly-right' | 'a-few-errors' | 'needs-fixing' | 'no-data';

export interface TopIssue {
  claim_text: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  model_provider: string;
}

export interface AIAccuracyHeroProps {
  score: number | null;
  enginesReporting: number;
  engineScores: Record<EvaluationEngine, number | null>;
  topIssue: TopIssue | null;
  openCount: number;
  resolvedCount: number;
}

// ─── Design constants ─────────────────────────────────────────────────────────

interface GradeCfg {
  label:     string;
  headline:  string;
  detail:    string;
  textHex:   string;
  ringRgba:  string;
  glowRgba:  string;
}

const GRADE: Record<Grade, GradeCfg> = {
  'spot-on': {
    label:    'Spot On',
    headline: 'AI apps are describing your business correctly.',
    detail:   'Great — your hours, location, and key facts are accurate across all AI platforms. Keep it up.',
    textHex:  '#00F5A0',
    ringRgba: 'rgba(0,245,160,0.45)',
    glowRgba: 'rgba(0,245,160,0.10)',
  },
  'mostly-right': {
    label:    'Mostly Right',
    headline: 'A few AI apps have minor errors about your business.',
    detail:   'Most apps describe you correctly, but a couple have small mistakes worth fixing before they cost you a customer.',
    textHex:  '#FFB800',
    ringRgba: 'rgba(255,184,0,0.45)',
    glowRgba: 'rgba(255,184,0,0.10)',
  },
  'a-few-errors': {
    label:    'A Few Errors',
    headline: 'Some AI apps are spreading wrong information.',
    detail:   'Wrong facts send customers to the wrong place or the wrong time. Each fix takes about 2 minutes.',
    textHex:  '#f97316',
    ringRgba: 'rgba(249,115,22,0.45)',
    glowRgba: 'rgba(249,115,22,0.10)',
  },
  'needs-fixing': {
    label:    'Needs Fixing',
    headline: 'AI apps are describing you incorrectly.',
    detail:   'Customers are getting wrong information before they even visit. Start with the most urgent issue below — it takes 2 minutes to fix.',
    textHex:  '#ef4444',
    ringRgba: 'rgba(239,68,68,0.45)',
    glowRgba: 'rgba(239,68,68,0.10)',
  },
  'no-data': {
    label:    'Not checked yet',
    headline: 'Your first accuracy check will run automatically.',
    detail:   'When your weekly AI scan runs, we\'ll check how every major AI app describes your business and flag anything wrong.',
    textHex:  '#64748b',
    ringRgba: 'rgba(100,116,139,0.30)',
    glowRgba: 'rgba(100,116,139,0.08)',
  },
};

// ─── Engine display names (long format) ───────────────────────────────────────

const ENGINE_DISPLAY: Record<string, string> = {
  openai:             'ChatGPT',
  perplexity:         'Perplexity',
  anthropic:          'Anthropic',
  gemini:             'Gemini',
  'openai-gpt4o':     'ChatGPT',
  'perplexity-sonar': 'Perplexity',
  'google-gemini':    'Google AI',
  'anthropic-claude': 'Anthropic',
  'microsoft-copilot':'Copilot',
};

function engineName(key: string): string {
  return ENGINE_DISPLAY[key] ?? key.replace(/-/g, ' ');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGrade(score: number | null): Grade {
  if (score === null) return 'no-data';
  if (score >= 90) return 'spot-on';
  if (score >= 70) return 'mostly-right';
  if (score >= 50) return 'a-few-errors';
  return 'needs-fixing';
}

function engineDotHex(score: number | null): string {
  if (score === null) return '#475569';
  if (score >= 90) return '#00F5A0';
  if (score >= 70) return '#FFB800';
  if (score >= 50) return '#f97316';
  return '#ef4444';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AIAccuracyHero({
  score,
  enginesReporting,
  engineScores,
  topIssue,
  openCount,
  resolvedCount,
}: AIAccuracyHeroProps) {
  const grade   = getGrade(score);
  const cfg     = GRADE[grade];
  const hasIssues = openCount > 0;
  const isClean   = grade === 'spot-on' || grade === 'no-data';

  // Per-engine rows — only those with a score, best → worst
  const engineEntries = (Object.entries(engineScores) as [EvaluationEngine, number | null][])
    .filter(([, s]) => s !== null)
    .sort(([, a], [, b]) => (b as number) - (a as number));

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/5 bg-surface-dark px-6 py-6"
      data-testid="ai-accuracy-hero"
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

      {/* ── Ambient breathing glow (grade color) ─────────────────────── */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        aria-hidden="true"
        style={{
          background: `radial-gradient(ellipse 70% 50% at 15% 55%, ${cfg.glowRgba} 0%, transparent 70%)`,
          animation: 'lv-orb-breathe 5s ease-in-out infinite',
        }}
      />

      {/* ── Main content ─────────────────────────────────────────────── */}
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8">

        {/* Score orb — left side */}
        <div
          className="flex flex-col items-center shrink-0"
          role="img"
          aria-label={`AI accuracy score: ${score !== null ? score : 'not available'}, grade: ${cfg.label}`}
        >
          <div className="relative flex h-28 w-28 items-center justify-center">
            {/* Ping rings — only when issues exist */}
            {hasIssues && (
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

            {/* Score circle */}
            <span
              className="relative flex h-24 w-24 items-center justify-center rounded-full border-2"
              style={{
                borderColor: cfg.ringRgba,
                boxShadow: `0 0 24px ${cfg.ringRgba}, 0 0 48px ${cfg.glowRgba}`,
                animation: isClean ? 'lv-orb-breathe 4s ease-in-out infinite' : undefined,
              }}
            >
              <span
                className="text-3xl font-bold tabular-nums leading-none"
                style={{
                  color: cfg.textHex,
                  fontFamily: 'var(--font-jetbrains-mono, monospace)',
                }}
              >
                {score !== null ? score : '—'}
              </span>
            </span>
          </div>

          {/* Grade label under orb */}
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

          {/* Label row with tooltip + badges */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-1.5">
              <p
                className="text-[10px] font-bold uppercase tracking-widest text-slate-500"
                style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
              >
                AI Accuracy
              </p>
              <InfoTooltip
                content={
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-white">What is AI Accuracy?</p>
                    <p className="text-xs text-slate-300">
                      When a customer asks ChatGPT or Perplexity about your restaurant,
                      this shows how correctly AI apps describe your hours, address, prices, and menu.
                    </p>
                    <p className="text-xs text-slate-400">
                      Wrong information makes customers miss you — or show up at the wrong time.
                      Fixing each error takes about 2 minutes.
                    </p>
                  </div>
                }
              />
              {enginesReporting > 0 && (
                <span className="text-[10px] text-slate-500">
                  ({enginesReporting} app{enginesReporting !== 1 ? 's' : ''} checked)
                </span>
              )}
            </div>

            {/* Status badge */}
            {grade === 'spot-on' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-signal-green/10 px-2.5 py-1 text-xs font-semibold text-signal-green ring-1 ring-signal-green/25">
                All Clear
              </span>
            )}
            {hasIssues && (
              <span className="inline-flex items-center gap-1 rounded-full bg-alert-crimson/10 px-2.5 py-1 text-xs font-semibold text-alert-crimson ring-1 ring-alert-crimson/25">
                {openCount} open issue{openCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Headline + detail */}
          <p className="text-base font-semibold text-white leading-snug">
            {cfg.headline}
          </p>
          <p className="mt-1.5 text-sm text-slate-400 leading-relaxed max-w-lg">
            {cfg.detail}
          </p>

          {/* Per-engine accuracy row */}
          {engineEntries.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
              <span
                className="text-[10px] font-bold uppercase tracking-widest text-slate-500"
                style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
              >
                By app:
              </span>
              {engineEntries.map(([engine, engineScore]) => (
                <div key={engine} className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ background: engineDotHex(engineScore) }}
                    aria-hidden="true"
                  />
                  <span className="text-xs text-slate-300">{engineName(engine)}</span>
                  <span
                    className="text-xs font-mono tabular-nums"
                    style={{ color: engineDotHex(engineScore) }}
                  >
                    {engineScore}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Resolved count — positive reinforcement when all clear */}
          {resolvedCount > 0 && !hasIssues && grade !== 'no-data' && (
            <p className="mt-3 text-xs text-slate-400">
              {resolvedCount} previously fixed issue{resolvedCount !== 1 ? 's' : ''} — nice work.
            </p>
          )}
        </div>
      </div>

      {/* ── Top-issue coaching card ───────────────────────────────────── */}
      {topIssue && hasIssues && (
        <div
          className="relative mt-5 flex items-start justify-between gap-4 rounded-xl border border-alert-crimson/20 bg-alert-crimson/5 px-4 py-3"
          data-testid="ai-accuracy-top-issue"
        >
          <div className="flex items-start gap-3 min-w-0">
            {/* Severity indicator */}
            <span
              className="mt-1 h-2 w-2 rounded-full shrink-0"
              style={{
                background: topIssue.severity === 'critical' ? '#ef4444' : '#f97316',
                boxShadow: `0 0 6px ${topIssue.severity === 'critical' ? 'rgba(239,68,68,0.6)' : 'rgba(249,115,22,0.6)'}`,
                animation: 'lv-heartbeat 2.5s ease-in-out infinite',
              }}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p
                className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5"
                style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
              >
                Most urgent right now
              </p>
              <p className="text-sm text-white leading-snug">{topIssue.claim_text}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                Found by {engineName(topIssue.model_provider)}
              </p>
            </div>
          </div>
          <Link
            href="#fix-now"
            className="shrink-0 mt-0.5 inline-flex items-center gap-1 rounded-lg border border-alert-crimson/30 bg-alert-crimson/10 px-3 py-1.5 text-xs font-semibold text-alert-crimson transition hover:bg-alert-crimson/20 whitespace-nowrap"
          >
            Fix in 2 min →
          </Link>
        </div>
      )}
    </div>
  );
}
