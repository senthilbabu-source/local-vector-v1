'use client';
// ---------------------------------------------------------------------------
// ScanDashboard — Public AI Audit Result Dashboard (Sprint 34+35)
//
// Receives parsed ScanDisplayData from the Server Component page.
//
// Sprint 34: replaced fake KPI lookup table with real scan fields:
//   • Free tier  — AI Mentions (categorical) + AI Sentiment (categorical)
//                  Both are real from Perplexity; shown with a "Live" badge
//   • Locked     — AI Visibility Score ██/100 + Citation Integrity ██/100
//                  Numerical scores require continuous monitoring (plan required)
//
// Sprint 35: Detected Issues section uses real accuracy_issues:
//   • Item 1 (unlocked) — first accuracy issue with category badge,
//     falls back to the main result (fail/pass/not_found) if no issues
//   • Items 2–3 (locked/blurred) — real accuracy issues if present,
//     else generic locked items (zero-issues fallback)
//
// Sections:
//   0. Nav strip (logo + "Run another scan" link)
//   1. Alert banner (real result: fail / pass / not_found)
//   2. KPI section — Row 1: 2 real free cards | Row 2: 2 locked score cards
//   3. Competitive landscape (sample data, clearly labeled + locked)
//   4. Detected Issues (items 1–3 with real or generic locked content)
//   5. Primary CTA (Claim My AI Profile → /signup)
//
// AI_RULES §12: all Tailwind class strings are literals (ternary operators only).
// AI_RULES §24: real categoricals shown free; locked numericals honest about
//               requiring monitoring — no fabricated numbers anywhere.
// ---------------------------------------------------------------------------

import type { ScanDisplayData, IssueCategory } from '../_utils/scan-params';
import { getAccuracyIssueCategories } from '../_utils/scan-params';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  result: ScanDisplayData;
}

// ---------------------------------------------------------------------------
// Helper functions — AI_RULES §12: ternary literals only, no template concat
// ---------------------------------------------------------------------------

function mentionsColor(m: 'none' | 'low' | 'medium' | 'high'): string {
  return m === 'high'   ? 'text-signal-green'
       : m === 'medium' ? 'text-alert-amber'
       : m === 'low'    ? 'text-slate-400'
       :                  'text-slate-600';
}

function mentionsDotColor(m: 'none' | 'low' | 'medium' | 'high'): string {
  return m === 'high'   ? 'bg-signal-green'
       : m === 'medium' ? 'bg-alert-amber'
       : m === 'low'    ? 'bg-slate-500'
       :                  'bg-slate-700';
}

function mentionsDescription(m: 'none' | 'low' | 'medium' | 'high'): string {
  return m === 'high'   ? 'Your business is prominently cited in AI responses'
       : m === 'medium' ? 'Your business appears in some AI responses with moderate detail'
       : m === 'low'    ? 'AI has limited information about your business'
       :                  'AI has no data about your business';
}

function sentimentColor(s: 'positive' | 'neutral' | 'negative'): string {
  return s === 'positive' ? 'text-signal-green'
       : s === 'negative' ? 'text-alert-crimson'
       :                    'text-slate-400';
}

function sentimentIcon(s: 'positive' | 'neutral' | 'negative'): string {
  return s === 'positive' ? '↑' : s === 'negative' ? '↓' : '→';
}

function sentimentDescription(s: 'positive' | 'neutral' | 'negative'): string {
  return s === 'positive' ? 'AI describes your business in a favorable, premium context'
       : s === 'negative' ? 'AI uses unfavorable or budget-tier language for your business'
       :                    'AI describes your business in a neutral, factual tone';
}

/** Sprint 35: human-readable label for an issue category badge. */
function categoryLabel(c: IssueCategory): string {
  return c === 'hours'   ? 'Hours'
       : c === 'address' ? 'Address'
       : c === 'menu'    ? 'Menu'
       : c === 'phone'   ? 'Phone'
       :                   'Other';
}

/** Sprint 35: Tailwind border+text classes for an issue category badge. AI_RULES §12: ternary literals. */
function categoryColor(c: IssueCategory): string {
  return c === 'hours'   ? 'border-alert-amber/40 text-alert-amber'
       : c === 'address' ? 'border-electric-indigo/40 text-electric-indigo'
       : c === 'menu'    ? 'border-signal-green/30 text-signal-green'
       : c === 'phone'   ? 'border-slate-500/40 text-slate-400'
       :                   'border-slate-600/40 text-slate-500';
}

/** Extract mentions — not_found is implicitly 'none' (no AI coverage). */
function getMentions(r: ScanDisplayData): 'none' | 'low' | 'medium' | 'high' {
  return r.status === 'fail' || r.status === 'pass' ? r.mentions : 'none';
}

/** Extract sentiment — not_found is implicitly 'neutral'. */
function getSentiment(r: ScanDisplayData): 'positive' | 'neutral' | 'negative' {
  return r.status === 'fail' || r.status === 'pass' ? r.sentiment : 'neutral';
}

/** Extract accuracy issues — not_found returns empty array. */
function getAccuracyIssues(r: ScanDisplayData): string[] {
  return r.status === 'fail' || r.status === 'pass' ? r.accuracyIssues : [];
}

// ---------------------------------------------------------------------------
// ScanDashboard
// ---------------------------------------------------------------------------

export default function ScanDashboard({ result }: Props) {
  // Invalid / missing params — show simple fallback
  if (result.status === 'invalid') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <p className="text-base font-semibold text-slate-400 mb-4">No valid scan result found.</p>
        <a href="/" className="text-sm text-signal-green underline underline-offset-2">
          ← Run a free scan
        </a>
      </div>
    );
  }

  const mentions                = getMentions(result);
  const sentiment               = getSentiment(result);
  const accuracyIssues          = getAccuracyIssues(result);
  const accuracyIssueCategories = getAccuracyIssueCategories(result);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-20">

      {/* ── 0. Nav strip ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-10 -mx-4 px-4 py-4 flex items-center justify-between border-b border-white/5 backdrop-blur-sm"
        style={{ backgroundColor: 'rgba(5,10,21,0.92)' }}>
        <span className="text-base font-bold tracking-tight">
          <span style={{ color: '#00F5A0' }}>LocalVector</span>
          <span className="text-slate-600">.ai</span>
        </span>
        <a href="/" className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-300 transition">
          ← Run another scan
        </a>
      </nav>

      {/* ── 1. Alert Banner ──────────────────────────────────────────────── */}
      <div className="mt-8">
        {result.status === 'fail' && (
          <div className="rounded-2xl border-2 border-alert-crimson/50 bg-alert-crimson/5 px-6 py-5">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-alert-crimson opacity-75"
                  style={{ animation: 'ping-dot 1.5s cubic-bezier(0,0,0.2,1) infinite' }} />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-alert-crimson" />
              </span>
              <p className="text-base font-bold text-alert-crimson">AI Hallucination Detected</p>
              <span className="rounded-full bg-alert-crimson/15 px-2.5 py-0.5 text-xs font-semibold text-alert-crimson uppercase tracking-wide">
                {result.severity}
              </span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              <span className="font-semibold text-white">{result.engine}</span> is reporting your business{' '}
              <span className="font-semibold text-alert-crimson">&ldquo;{result.businessName}&rdquo;</span>{' '}
              as <span className="font-semibold text-alert-crimson">&ldquo;{result.claimText}&rdquo;</span>.{' '}
              Reality: <span className="font-semibold text-truth-emerald">{result.expectedTruth}</span>.
            </p>
          </div>
        )}
        {result.status === 'pass' && (
          <div className="rounded-2xl border-2 border-truth-emerald/40 bg-truth-emerald/5 px-6 py-5">
            <div className="flex items-center gap-3 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                className="h-5 w-5 shrink-0 text-truth-emerald" aria-hidden>
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              <p className="text-base font-bold text-truth-emerald">No Hallucinations Detected</p>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              <span className="font-semibold text-white">{result.engine}</span> currently describes{' '}
              <span className="font-semibold text-white">&ldquo;{result.businessName}&rdquo;</span>{' '}
              accurately. AI hallucinations can appear at any time — monitoring keeps you protected.
            </p>
          </div>
        )}
        {result.status === 'not_found' && (
          <div className="rounded-2xl border-2 border-slate-600/60 bg-slate-800/20 px-6 py-5">
            <div className="flex items-center gap-3 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                className="h-5 w-5 shrink-0 text-slate-400" aria-hidden>
                <path d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" />
              </svg>
              <p className="text-base font-bold text-slate-300">Zero AI Visibility</p>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              <span className="font-semibold text-slate-200">{result.engine}</span> has no data for{' '}
              <span className="font-semibold text-slate-200">&ldquo;{result.businessName}&rdquo;</span>.
              Customers searching AI assistants won&apos;t find you — costing you revenue silently.
            </p>
          </div>
        )}
      </div>

      {/* ── 2. KPI Section ───────────────────────────────────────────────── */}
      <div className="mt-8 space-y-6">

        {/* Row 1: Real data from scan — shown free */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              From Your Scan
            </p>
            <span className="rounded-full border border-signal-green/30 px-2.5 py-0.5 text-[10px] font-semibold text-signal-green uppercase tracking-wide">
              Live
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <RealMentionsCard mentions={mentions} />
            <RealSentimentCard sentiment={sentiment} />
          </div>
        </div>

        {/* Row 2: Locked numerical scores — require continuous monitoring */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Unlock Full Scores
            </p>
            <span className="rounded-full border border-alert-amber/30 px-2.5 py-0.5 text-[10px] font-semibold text-alert-amber uppercase tracking-wide">
              Plan required
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <LockedScoreCard
              title="AI Visibility Score"
              abbr="AVS"
              description="How often AI cites your business accurately"
            />
            <LockedScoreCard
              title="Citation Integrity"
              abbr="CI"
              description="AI accuracy on hours, address, and menu"
            />
          </div>
        </div>

      </div>

      {/* ── 3. Competitive Landscape ─────────────────────────────────────── */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Competitive Landscape
          </p>
          <span className="text-[10px] text-slate-700 uppercase tracking-wide">Sample data</span>
        </div>
        <div className="relative rounded-2xl bg-surface-dark border border-white/5 p-6">
          {/* Lock overlay */}
          <div className="absolute inset-0 rounded-2xl flex items-end justify-center pb-5 z-10"
            style={{ background: 'linear-gradient(to bottom, transparent 30%, rgba(5,10,21,0.92) 80%)' }}>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-400 mb-1">
                🔒 Real competitor data unlocked after signup
              </p>
              <p className="text-xs text-slate-600">Sample data · Real analysis requires an account</p>
            </div>
          </div>

          <div className="space-y-4 select-none">
            {/* My Brand — colored bar, no numerical score */}
            <CompetitorBar
              label="My Brand"
              sublabel={result.businessName}
              isMine
              isGood={result.status === 'pass'}
            />
            {/* Static sample competitors — no scores shown */}
            <CompetitorBar label="Top Competitor 1" sublabel="Sample · Real data after signup" isMine={false} isGood={false} />
            <CompetitorBar label="Top Competitor 2" sublabel="Sample · Real data after signup" isMine={false} isGood={false} />
            <CompetitorBar label="Top Competitor 3" sublabel="Sample · Real data after signup" isMine={false} isGood={false} />
          </div>
        </div>
      </div>

      {/* ── 4. Detected Issues & Fixes ───────────────────────────────────── */}
      <div className="mt-10">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
          Detected Issues &amp; Fixes
        </p>
        <div className="space-y-3">

          {/* Item 1 — UNLOCKED: real accuracy issue if present, else scan result */}
          {accuracyIssues.length > 0 ? (
            <AccuracyIssueItem
              text={accuracyIssues[0]}
              category={accuracyIssueCategories[0] ?? 'other'}
              isLocked={false}
            />
          ) : (
            <div className="rounded-xl border border-white/10 bg-surface-dark px-5 py-4">
              {result.status === 'fail' && (
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 rounded-full bg-alert-crimson/10 px-2 py-0.5 text-xs font-bold text-alert-crimson uppercase shrink-0">
                    {result.severity}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {result.engine} reports &ldquo;{result.businessName}&rdquo; as &ldquo;{result.claimText}&rdquo;
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Detected via Perplexity Sonar scan · Reality: {result.expectedTruth}</p>
                  </div>
                </div>
              )}
              {result.status === 'pass' && (
                <div className="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                    className="h-4 w-4 shrink-0 mt-0.5 text-truth-emerald" aria-hidden>
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-truth-emerald">No critical hallucinations found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {result.engine} currently shows accurate information. Monitoring ensures it stays that way.
                    </p>
                  </div>
                </div>
              )}
              {result.status === 'not_found' && (
                <div className="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                    className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" aria-hidden>
                    <path d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-slate-300">AI models have no data about your business</p>
                    <p className="text-xs text-slate-500 mt-1">You have zero AI visibility — potential customers can&apos;t find you via AI search.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Item 2 — LOCKED: real issue[1] if present, else generic */}
          {accuracyIssues.length >= 2 ? (
            <AccuracyIssueItem
              text={accuracyIssues[1]}
              category={accuracyIssueCategories[1] ?? 'other'}
              isLocked={true}
            />
          ) : (
            <LockedFixItem
              title="Suppress hallucination across 6 AI Knowledge Graphs"
              description="Push verified business data to override incorrect AI sources"
            />
          )}

          {/* Item 3 — LOCKED: real issue[2] if present, else generic */}
          {accuracyIssues.length >= 3 ? (
            <AccuracyIssueItem
              text={accuracyIssues[2]}
              category={accuracyIssueCategories[2] ?? 'other'}
              isLocked={true}
            />
          ) : (
            <LockedFixItem
              title="Inject verified NAP data via Magic Menu"
              description="Convert your menu + hours into structured data AI models trust"
            />
          )}

        </div>

        <p className="mt-3 text-xs text-slate-600">
          Unlock all fixes and set up continuous monitoring with a free account.
        </p>
      </div>

      {/* ── 5. Primary CTA ───────────────────────────────────────────────── */}
      <div className="mt-10">
        <a
          href="/signup"
          className="block w-full rounded-xl py-3.5 text-center text-sm font-bold transition hover:opacity-90"
          style={{ backgroundColor: '#00F5A0', color: '#050A15' }}
        >
          Claim My AI Profile — Start Free
        </a>
        <p className="mt-2 text-center text-xs text-slate-500">
          No credit card required · Cancel anytime
        </p>
        <div className="mt-4 text-center">
          <a href="/" className="text-xs text-slate-600 underline underline-offset-2 hover:text-slate-300 transition">
            ← Run another scan
          </a>
        </div>
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// RealMentionsCard — real categorical from Perplexity scan (Sprint 34)
// AI_RULES §12: all class strings are literals via helper functions
// ---------------------------------------------------------------------------

function RealMentionsCard({ mentions }: { mentions: 'none' | 'low' | 'medium' | 'high' }) {
  return (
    <div className="rounded-2xl bg-surface-dark border border-white/5 p-5">
      <div className="mb-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AI Mentions</p>
        <p className="text-[10px] text-slate-600">Volume detected</p>
      </div>
      <div className="flex items-center gap-2">
        <span className={['h-3 w-3 rounded-full shrink-0', mentionsDotColor(mentions)].join(' ')} />
        <p className={['text-2xl font-bold', mentionsColor(mentions)].join(' ')}>
          {mentions.charAt(0).toUpperCase() + mentions.slice(1)}
        </p>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">{mentionsDescription(mentions)}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RealSentimentCard — real categorical from Perplexity scan (Sprint 34)
// ---------------------------------------------------------------------------

function RealSentimentCard({ sentiment }: { sentiment: 'positive' | 'neutral' | 'negative' }) {
  return (
    <div className="rounded-2xl bg-surface-dark border border-white/5 p-5">
      <div className="mb-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AI Sentiment</p>
        <p className="text-[10px] text-slate-600">Tone AI uses for your brand</p>
      </div>
      <div className="flex items-center gap-2">
        <p className={['text-2xl font-bold', sentimentColor(sentiment)].join(' ')}>
          {sentimentIcon(sentiment)}
        </p>
        <p className={['text-2xl font-bold capitalize', sentimentColor(sentiment)].join(' ')}>
          {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
        </p>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">{sentimentDescription(sentiment)}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LockedScoreCard — numerical score gated behind plan (Sprint 34)
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
    <div className="relative rounded-2xl bg-surface-dark border border-white/5 p-5 overflow-hidden">
      {/* Lock overlay */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl z-10"
        style={{ backgroundColor: 'rgba(5,10,21,0.82)', backdropFilter: 'blur(3px)' }}
      >
        <span className="text-lg mb-1" aria-hidden>🔒</span>
        <p className="text-xs font-semibold text-slate-400">Sign up to unlock</p>
      </div>
      {/* Background content (behind lock overlay) */}
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
      <p className="text-[10px] text-slate-600 mb-3">{abbr}</p>
      <p className="text-4xl font-bold text-slate-700 select-none tabular-nums">
        ██<span className="text-xl">/100</span>
      </p>
      <p className="mt-2 text-[10px] text-slate-700">{description}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CompetitorBar — score is optional (Sprint 34: no fake numbers)
// ---------------------------------------------------------------------------

function CompetitorBar({
  label,
  sublabel,
  score,
  isMine,
  isGood,
}: {
  label: string;
  sublabel: string;
  score?: number;
  isMine: boolean;
  isGood: boolean;
}) {
  const barPct = score !== undefined ? `${score}%` : '50%';
  const fill   = isMine
    ? isGood ? '#00F5A0' : '#ef4444'
    : '#374151';

  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0">
        <p className={['text-xs font-semibold leading-tight', isMine ? 'text-white' : 'text-slate-500'].join(' ')}>
          {label}
        </p>
        {sublabel && (
          <p className="text-[10px] text-slate-600 truncate">{sublabel}</p>
        )}
      </div>
      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ backgroundColor: fill, width: barPct }}
        />
      </div>
      <span className={['text-xs tabular-nums shrink-0 w-8 text-right', isMine ? 'text-white font-bold' : 'text-slate-600'].join(' ')}>
        {score !== undefined ? score : '—'}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AccuracyIssueItem — Sprint 35: real accuracy issue with category badge
// Handles both unlocked (item 1) and locked/blurred (items 2–3) states.
// AI_RULES §12: ternary literals only for all Tailwind class strings.
// ---------------------------------------------------------------------------

function AccuracyIssueItem({
  text,
  category,
  isLocked,
}: {
  text:     string;
  category: IssueCategory;
  isLocked: boolean;
}) {
  const inner = (
    <div className="flex items-start gap-3">
      <span className={[
        'mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
        categoryColor(category),
      ].join(' ')}>
        {categoryLabel(category)}
      </span>
      <p className="text-sm text-slate-300">{text}</p>
    </div>
  );

  if (!isLocked) {
    return (
      <div className="rounded-xl border border-white/10 bg-surface-dark px-5 py-4">
        {inner}
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-white/5 bg-surface-dark px-5 py-4 overflow-hidden select-none">
      {/* Blur overlay — same pattern as LockedFixItem */}
      <div className="absolute inset-0 backdrop-blur-[2px] bg-midnight-slate/60 flex items-center justify-center z-10">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-midnight-slate/90 px-3 py-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
            className="h-3.5 w-3.5 text-slate-400" aria-hidden>
            <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clipRule="evenodd" />
          </svg>
          <span className="text-xs text-slate-400 font-medium">Signup to unlock</span>
        </div>
      </div>
      {inner}
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
    <div className="relative rounded-xl border border-white/5 bg-surface-dark px-5 py-4 overflow-hidden select-none">
      {/* Blur overlay */}
      <div className="absolute inset-0 backdrop-blur-[2px] bg-midnight-slate/60 flex items-center justify-center z-10">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-midnight-slate/90 px-3 py-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
            className="h-3.5 w-3.5 text-slate-400" aria-hidden>
            <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clipRule="evenodd" />
          </svg>
          <span className="text-xs text-slate-400 font-medium">Signup to unlock</span>
        </div>
      </div>
      {/* Background content (blurred) */}
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-xs text-slate-500 mt-1">{description}</p>
    </div>
  );
}
