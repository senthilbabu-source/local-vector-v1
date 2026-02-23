'use client';
// ---------------------------------------------------------------------------
// ScanDashboard — Public AI Audit Result Dashboard (Sprint 33 Part 3)
//
// Receives parsed ScanDisplayData from the Server Component page.
// All KPI scores labeled "Estimated" — driven by the real Perplexity scan
// result but not claimed as live monitored data (AI_RULES §24 / §20).
//
// Sections:
//   0. Nav strip (logo + "Run another scan" link)
//   1. Alert banner (real result: fail / pass / not_found)
//   2. Four KPI cards (estimated scores + sparklines + fill-bar animations)
//   3. Competitive landscape (sample data, clearly labeled + locked)
//   4. Locked fixes (item 1 = real result, items 2–3 = locked)
//   5. Primary CTA (Claim My AI Profile → /signup)
//
// AI_RULES §12: all Tailwind class strings are literals (no dynamic concat).
// ---------------------------------------------------------------------------

import type { ScanDisplayData } from '../_utils/scan-params';
import { deriveKpiScores } from '../_utils/scan-params';
import { buildSparklinePath } from '../_utils/sparkline';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  result: ScanDisplayData;
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

  const kpi   = deriveKpiScores(result);
  const trend = result.status === 'pass' ? 'up' : result.status === 'not_found' ? 'flat' : 'down';

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

      {/* ── 2. Four KPI Cards ────────────────────────────────────────────── */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            AI Visibility Metrics
          </p>
          <span className="rounded-full border border-alert-amber/30 px-2.5 py-0.5 text-[10px] font-semibold text-alert-amber uppercase tracking-wide">
            Estimated
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard
            title="AI Visibility Score"
            abbr="AVS"
            score={kpi.avs}
            description="How often AI cites your business accurately"
            trend={trend}
            delay="0s"
          />
          <KpiCard
            title="Sentiment Index"
            abbr="SI"
            score={kpi.sentiment}
            description="Premium vs. Budget tone in AI responses"
            trend={trend}
            delay="0.1s"
          />
          <KpiCard
            title="Citation Integrity"
            abbr="CI"
            score={kpi.citation}
            description="AI accuracy on hours, address, and menu"
            trend={trend}
            delay="0.2s"
          />
          <MentionsCard
            mentions={kpi.mentions}
            delay="0.3s"
          />
        </div>
        <p className="mt-3 text-xs text-slate-700">
          Estimated scores based on scan result. Continuous monitoring requires an account.
        </p>
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
            {/* My Brand */}
            <CompetitorBar
              label="My Brand"
              sublabel={result.businessName}
              score={kpi.avs}
              isMine
              isGood={result.status === 'pass'}
            />
            {/* Static sample competitors */}
            <CompetitorBar label="Competitor A" sublabel="Nearby Business" score={68} isMine={false} isGood={false} />
            <CompetitorBar label="Competitor B" sublabel="Nearby Business" score={71} isMine={false} isGood={false} />
            <CompetitorBar label="Competitor C" sublabel="Nearby Business" score={65} isMine={false} isGood={false} />
          </div>
        </div>
      </div>

      {/* ── 4. Locked Fixes ──────────────────────────────────────────────── */}
      <div className="mt-10">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
          Detected Issues &amp; Fixes
        </p>
        <div className="space-y-3">
          {/* Item 1 — UNLOCKED: based on real scan result */}
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

          {/* Item 2 — LOCKED */}
          <LockedFixItem
            title="Suppress hallucination across 6 AI Knowledge Graphs"
            description="Push verified business data to override incorrect AI sources"
          />

          {/* Item 3 — LOCKED */}
          <LockedFixItem
            title="Inject verified NAP data via Magic Menu"
            description="Convert your menu + hours into structured data AI models trust"
          />
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
// KpiCard — animated fill-bar + SVG sparkline
// AI_RULES §12: all class strings are literals
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score >= 70) return 'text-signal-green';
  if (score >= 40) return 'text-alert-amber';
  return 'text-alert-crimson';
}

function barColor(score: number): string {
  if (score >= 70) return '#00F5A0';
  if (score >= 40) return '#FFB800';
  return '#ef4444';
}

function KpiCard({
  title,
  abbr,
  score,
  description,
  trend,
  delay,
}: {
  title: string;
  abbr: string;
  score: number;
  description: string;
  trend: 'up' | 'flat' | 'down';
  delay: string;
}) {
  const sparkPoints = buildSparklinePath(trend, 64, 20);
  const color = scoreColor(score);
  const fill  = barColor(score);

  return (
    <div
      className="rounded-2xl bg-surface-dark border border-white/5 p-4"
      style={{ animation: `fade-up 0.6s ease-out ${delay} both` }}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs font-semibold text-white leading-tight">{title}</p>
          <p className="text-[10px] text-slate-600">{abbr}</p>
        </div>
        {/* Mini sparkline */}
        <svg width="64" height="20" viewBox="0 0 64 20" aria-hidden className="shrink-0">
          <polyline
            points={sparkPoints}
            fill="none"
            stroke={fill}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.6"
          />
        </svg>
      </div>

      <p className={['text-3xl font-bold tabular-nums', color].join(' ')}>
        {score}
        <span className="text-sm text-slate-600 font-normal">/100</span>
      </p>

      <div className="mt-2 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            backgroundColor: fill,
            '--bar-w': `${score}%`,
            animation: `fill-bar 1.4s cubic-bezier(0.4,0,0.2,1) ${delay} both`,
          } as React.CSSProperties}
        />
      </div>

      <p className="mt-2 text-[10px] text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MentionsCard — qualitative AI mention volume
// ---------------------------------------------------------------------------

function MentionsCard({
  mentions,
  delay,
}: {
  mentions: 'None' | 'Low' | 'Medium' | 'High';
  delay: string;
}) {
  const colorMap: Record<typeof mentions, string> = {
    None:   'text-slate-500',
    Low:    'text-alert-crimson',
    Medium: 'text-alert-amber',
    High:   'text-signal-green',
  };
  const dotMap: Record<typeof mentions, string> = {
    None:   'bg-slate-600',
    Low:    'bg-alert-crimson',
    Medium: 'bg-alert-amber',
    High:   'bg-signal-green',
  };

  return (
    <div
      className="rounded-2xl bg-surface-dark border border-white/5 p-4"
      style={{ animation: `fade-up 0.6s ease-out ${delay} both` }}
    >
      <p className="text-xs font-semibold text-white leading-tight mb-0.5">AI Mentions</p>
      <p className="text-[10px] text-slate-600 mb-3">Volume detected</p>

      <div className="flex items-center gap-2">
        <span className={['h-2.5 w-2.5 rounded-full shrink-0', dotMap[mentions]].join(' ')} />
        <p className={['text-2xl font-bold', colorMap[mentions]].join(' ')}>{mentions}</p>
      </div>

      <p className="mt-2 text-[10px] text-slate-500 leading-relaxed">
        How often your business appears in AI search responses
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CompetitorBar
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
  score: number;
  isMine: boolean;
  isGood: boolean;
}) {
  const pct  = `${score}%`;
  const fill = isMine
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
          style={{ backgroundColor: fill, width: pct }}
        />
      </div>
      <span className={['text-xs tabular-nums shrink-0 w-8 text-right', isMine ? 'text-white font-bold' : 'text-slate-600'].join(' ')}>
        {score}
      </span>
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
