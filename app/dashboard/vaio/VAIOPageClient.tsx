'use client';

// ---------------------------------------------------------------------------
// VAIOPageClient — Full Voice Readiness dashboard (client component)
//
// Sprint 109: VAIO
// Sprint §208: Animated score card with breakdown bars, milestone track,
//              coaching message, and revenue stakes line.
// ---------------------------------------------------------------------------

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Mic, ShieldCheck, ShieldAlert, ShieldX,
  Loader2, Copy, Check, AlertTriangle,
} from 'lucide-react';
import type { ScoreBreakdown } from '@/lib/vaio/types';
import {
  getMilestoneLabel,
  getCoachingMessage,
  getRevenueStakesLine,
  SCORE_BAR_ITEMS,
  barColor,
} from '@/lib/vaio/score-card-helpers';

interface VAIOProfile {
  voice_readiness_score: number;
  llms_txt_standard: string | null;
  llms_txt_full: string | null;
  llms_txt_status: string;
  llms_txt_generated_at: string | null;
  crawler_audit: {
    overall_health: string;
    crawlers: Array<{
      name: string;
      user_agent: string;
      status: string;
      used_by: string;
      impact: string;
    }>;
    blocked_count: number;
    allowed_count: number;
    missing_count: number;
  } | null;
  voice_queries_tracked: number;
  voice_citation_rate: number;
  voice_gaps: Array<{
    category: string;
    queries: string[];
    weeks_at_zero: number;
    suggested_query_answer: string;
  }>;
  top_content_issues: Array<{
    type: string;
    severity: string;
    description: string;
    fix: string;
  }>;
  last_run_at: string | null;
  score_breakdown: ScoreBreakdown | null;
}

interface VoiceQueryRow {
  id: string;
  query_text: string;
  query_category: string;
  citation_rate: number | null;
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-green-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function crawlerIcon(status: string) {
  switch (status) {
    case 'allowed': return <ShieldCheck className="h-3.5 w-3.5 text-green-400" />;
    case 'blocked': return <ShieldX className="h-3.5 w-3.5 text-red-400" />;
    default: return <ShieldAlert className="h-3.5 w-3.5 text-slate-400" />;
  }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function VAIOPageClient() {
  const [profile, setProfile] = useState<VAIOProfile | null>(null);
  const [queries, setQueries] = useState<VoiceQueryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // 4a — prev score ref for delta animation
  const prevScoreRef = useRef<number | null>(null);

  // 4b — animated display score
  const [displayScore, setDisplayScore] = useState(0);
  const countUpRef = useRef<number | null>(null);

  // 4c — bar fill state (one boolean per bar, crawlers first)
  const [barFills, setBarFills] = useState<boolean[]>([false, false, false, false]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/vaio/status');
      const data = await res.json();
      setProfile(data.profile);
      setQueries(data.voice_queries ?? []);
    } catch (err) {
      console.error('[VAIOPageClient] fetch status failed', err);
    }
  }, []);

  useEffect(() => {
    fetchStatus().finally(() => setLoading(false));
  }, [fetchStatus]);

  const handleRunScan = async () => {
    // 4a — capture score before re-fetch so animation can animate delta
    prevScoreRef.current = profile?.voice_readiness_score ?? 0;
    setRunning(true);
    try {
      await fetch('/api/vaio/run', { method: 'POST' });
      await fetchStatus();
    } catch (err) {
      console.error('[VAIOPageClient] run scan failed', err);
    } finally {
      setRunning(false);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const score = profile?.voice_readiness_score ?? 0;

  // 4b — count-up animation (respects prefers-reduced-motion)
  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const from = prevScoreRef.current ?? 0;
    const to = score;

    if (prefersReducedMotion) {
      setDisplayScore(to);
      prevScoreRef.current = to;
      return;
    }

    if (countUpRef.current) cancelAnimationFrame(countUpRef.current);

    const duration = 900;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      setDisplayScore(Math.round(from + (to - from) * easeOutCubic(t)));
      if (t < 1) {
        countUpRef.current = requestAnimationFrame(animate);
      } else {
        prevScoreRef.current = to;
      }
    };

    countUpRef.current = requestAnimationFrame(animate);

    return () => {
      if (countUpRef.current) cancelAnimationFrame(countUpRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  // 4c — bar fill animations (stagger 150ms each, starting after 920ms count-up)
  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Reset bars on score change
    setBarFills([false, false, false, false]);

    if (prefersReducedMotion) {
      setBarFills([true, true, true, true]);
      return;
    }

    const timers = [0, 1, 2, 3].map((i) =>
      setTimeout(() => {
        setBarFills((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
      }, 920 + i * 150),
    );

    return () => timers.forEach((t) => clearTimeout(t));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const breakdown = profile?.score_breakdown ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="h-5 w-5 text-electric-indigo" />
          <h1 className="text-xl font-bold text-white">Ready for Voice Search?</h1>
        </div>
        <button
          onClick={handleRunScan}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-lg bg-electric-indigo px-4 py-2 text-sm font-medium text-white hover:bg-electric-indigo/90 transition-colors disabled:opacity-50"
          data-testid="vaio-run-scan"
        >
          {running && <Loader2 className="h-4 w-4 animate-spin" />}
          {running ? 'Scanning...' : 'Run Voice Check'}
        </button>
      </div>

      {/* Score Card — §208 animated, context-rich coaching header */}
      <div className="rounded-xl border border-white/5 bg-surface-dark p-6" data-testid="vaio-score-card">

        {/* 4b — Animated score number */}
        <div className="flex items-baseline gap-3">
          <span className={`font-mono text-5xl font-bold ${scoreColor(score)}`} data-testid="vaio-score-display">
            {displayScore}
          </span>
          <span className="text-lg text-slate-400">/ 100</span>
        </div>

        {/* 4c — Sub-component bars in 2×2 grid */}
        {breakdown && (
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3" data-testid="vaio-score-bars">
            {SCORE_BAR_ITEMS.map((item, i) => {
              const earned = breakdown[item.key];
              const ratio = earned / item.max;
              const color = barColor(earned, item.max);
              return (
                <div key={item.key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-400">{item.label}</span>
                    <span className="tabular-nums text-slate-300">
                      {earned} / {item.max}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${color}`}
                      style={{
                        width: barFills[i] ? `${(ratio * 100).toFixed(1)}%` : '0%',
                        transition: 'width 600ms ease-out',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 4d — Milestone track */}
        <div className="mt-6" data-testid="vaio-milestone-track">
          <div className="relative h-1.5 w-full rounded-full bg-white/10">
            {/* Progress fill */}
            <div
              className="absolute h-full rounded-full bg-electric-indigo/70"
              style={{ width: `${score}%` }}
            />
            {/* User position dot */}
            <div
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-electric-indigo shadow-md"
              style={{ left: `${Math.min(score, 97)}%` }}
            />
            {/* Milestone tick at 70 */}
            <div className="absolute top-0 h-full w-px bg-white/40" style={{ left: '70%' }} />
            {/* Milestone tick at 100 */}
            <div className="absolute right-0 top-0 h-full w-px bg-white/40" />
          </div>

          {/* Milestone labels */}
          <div className="relative mt-1.5 h-4 text-xs text-slate-500">
            <span
              className="absolute -translate-x-1/2"
              style={{ left: '70%' }}
            >
              Well-Optimized
            </span>
            <span className="absolute right-0">Voice Champion</span>
          </div>

          {/* YOU label */}
          <div className="relative mt-0.5 h-4 text-xs">
            <span
              className="-translate-x-1/2 absolute font-semibold text-electric-indigo"
              style={{ left: `${Math.min(score, 97)}%` }}
            >
              YOU {score}
            </span>
          </div>

          {/* Next milestone text */}
          <p className="mt-5 text-sm font-medium text-slate-300" data-testid="vaio-milestone-label">
            {getMilestoneLabel(score)}
          </p>
        </div>

        {/* 4e — Personalised coaching message */}
        <p className="mt-3 text-sm text-slate-400" data-testid="vaio-coaching-message">
          {getCoachingMessage(breakdown, score)}
        </p>

        {/* 4f — Revenue stakes line */}
        <p className="mt-2 text-xs text-slate-500" data-testid="vaio-revenue-stakes">
          {getRevenueStakesLine(profile?.voice_citation_rate, profile?.voice_queries_tracked)}
        </p>
      </div>

      {/* AI Crawler Audit */}
      {profile?.crawler_audit && (
        <div className="rounded-xl border border-white/5 bg-surface-dark p-5" data-testid="vaio-crawler-audit">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            AI Crawler Access
          </h2>
          <div className="space-y-2">
            {profile.crawler_audit.crawlers.map((c) => (
              <div key={c.user_agent} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {crawlerIcon(c.status)}
                  <span className="text-slate-300">{c.name}</span>
                  <span className="text-xs text-slate-400">({c.used_by})</span>
                </div>
                <span className={`text-xs ${
                  c.status === 'allowed' ? 'text-green-400' :
                  c.status === 'blocked' ? 'text-red-400' :
                  'text-slate-400'
                }`}>
                  {c.status === 'allowed' ? 'Allowed' :
                   c.status === 'blocked' ? 'Blocked' : 'Not specified'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Voice Queries */}
      {queries.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-surface-dark p-5" data-testid="vaio-voice-queries">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Voice Queries ({queries.length})
          </h2>
          <div className="space-y-1.5">
            {queries.map((q) => (
              <div key={q.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-300 truncate max-w-md">&ldquo;{q.query_text}&rdquo;</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 capitalize">{q.query_category}</span>
                  <span className={`font-mono text-xs ${
                    q.citation_rate !== null && q.citation_rate > 0
                      ? 'text-green-400' : 'text-slate-400'
                  }`}>
                    {q.citation_rate !== null ? `${Math.round(q.citation_rate * 100)}%` : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Voice Gaps */}
      {profile?.voice_gaps && profile.voice_gaps.length > 0 && (
        <div className="rounded-xl border border-amber-400/20 bg-surface-dark p-5" data-testid="vaio-voice-gaps">
          <div className="mb-3 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Voice Gaps
            </h2>
          </div>
          <div className="space-y-3">
            {profile.voice_gaps.map((gap, i) => (
              <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <p className="text-xs font-medium text-amber-400 capitalize mb-1">
                  {gap.category} — {gap.weeks_at_zero} weeks at zero citations
                </p>
                <p className="text-xs text-slate-400 mb-2">
                  {gap.queries.length} queries getting zero AI citations
                </p>
                <p className="text-xs text-slate-400 italic">
                  Suggested answer: &ldquo;{gap.suggested_query_answer}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* llms.txt Preview */}
      {profile?.llms_txt_standard && (
        <div className="rounded-xl border border-white/5 bg-surface-dark p-5" data-testid="vaio-llms-txt">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              AI Business Profile
            </h2>
            <button
              onClick={() => handleCopy(profile.llms_txt_standard!, 'standard')}
              className="inline-flex items-center gap-1 text-xs text-electric-indigo hover:text-electric-indigo/80"
              data-testid="vaio-copy-llms-txt"
            >
              {copied === 'standard' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied === 'standard' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="max-h-64 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-slate-300 font-mono whitespace-pre-wrap">
            {profile.llms_txt_standard}
          </pre>
        </div>
      )}

      {/* Content Issues */}
      {profile?.top_content_issues && profile.top_content_issues.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-surface-dark p-5" data-testid="vaio-issues">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Voice Content Issues
          </h2>
          <div className="space-y-2">
            {profile.top_content_issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className={`mt-0.5 inline-block h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                  issue.severity === 'critical' ? 'bg-red-400' :
                  issue.severity === 'warning' ? 'bg-amber-400' :
                  'bg-slate-500'
                }`} />
                <div>
                  <p className="text-slate-300">{issue.description}</p>
                  <p className="text-xs text-slate-400">{issue.fix}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
