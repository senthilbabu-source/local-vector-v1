'use client';

// ---------------------------------------------------------------------------
// VAIOPageClient — Full Voice Readiness dashboard (client component)
//
// Sprint 109: VAIO
// Sprint §208: Animated score card with breakdown bars, milestone track,
//              coaching message, and revenue stakes line.
// Sprint 2:   Mission Board — "Replace the report with a coach"
//             Score card → Mission Board (top 3 missions) → Raw details
// Sprint §210: Live Scan Experience + Query Diagnostic
//   - Scan overlay with sequential stage labels (3 steps)
//   - Delta badge (▲ +N pts / No change) after scan
//   - Mission pulse on newly-completed missions
//   - Failing (0%) query rows clickable → QueryDrawer side panel
// ---------------------------------------------------------------------------

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Mic, ShieldCheck, ShieldAlert, ShieldX,
  Loader2, Copy, Check, AlertTriangle, ChevronDown, ChevronRight,
} from 'lucide-react';
import type { ScoreBreakdown } from '@/lib/vaio/types';
import {
  getMilestoneLabel,
  getCoachingMessage,
  getRevenueStakesLine,
  SCORE_BAR_ITEMS,
  barColor,
} from '@/lib/vaio/score-card-helpers';
import { generateMissions } from '@/lib/vaio/mission-generator';
import { MissionBoard } from './_components/MissionBoard';
import { ScanOverlay } from './_components/ScanOverlay';
import { QueryDrawer } from './_components/QueryDrawer';

interface VAIOProfile {
  voice_readiness_score: number;
  llms_txt_standard: string | null;
  llms_txt_full: string | null;
  llms_txt_status: 'generated' | 'not_generated' | 'stale';
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

interface StatusData {
  profile: VAIOProfile;
  voice_queries: VoiceQueryRow[];
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
  const [rawOpen, setRawOpen] = useState(false);

  // §210 — scan overlay stage (0/1/2 = stage index, null = hidden)
  const [scanPhase, setScanPhase] = useState<number | null>(null);

  // §210 — delta badge: score diff shown after scan (auto-dismissed)
  const [deltaScore, setDeltaScore] = useState<number | null>(null);

  // §210 — mission pulse: set of mission IDs that just became done
  const [justCompletedMissions, setJustCompletedMissions] = useState<Set<string>>(new Set());

  // §210 — selected failing query for drawer
  const [selectedQuery, setSelectedQuery] = useState<VoiceQueryRow | null>(null);

  // 4a — prev score ref for delta animation
  const prevScoreRef = useRef<number | null>(null);

  // 4b — animated display score
  const [displayScore, setDisplayScore] = useState(0);
  const countUpRef = useRef<number | null>(null);

  // 4c — bar fill state (one boolean per bar, crawlers first)
  const [barFills, setBarFills] = useState<boolean[]>([false, false, false, false]);

  // fetchStatus returns the raw data so handleRunScan can read it synchronously
  const fetchStatus = useCallback(async (): Promise<StatusData | null> => {
    try {
      const res = await fetch('/api/vaio/status');
      const data: StatusData = await res.json();
      setProfile(data.profile);
      setQueries(data.voice_queries ?? []);
      return data;
    } catch (err) {
      console.error('[VAIOPageClient] fetch status failed', err);
      return null;
    }
  }, []);

  useEffect(() => {
    fetchStatus().finally(() => setLoading(false));
  }, [fetchStatus]);

  const handleRunScan = async () => {
    // Capture state before scan for delta + pulse comparisons
    prevScoreRef.current = profile?.voice_readiness_score ?? 0;

    // Capture mission statuses before scan
    const breakdown = profile?.score_breakdown ?? null;
    const currentMissions =
      profile && breakdown
        ? generateMissions({
            breakdown,
            llms_txt_status: profile.llms_txt_status,
            voice_gaps: profile.voice_gaps,
            top_content_issues: profile.top_content_issues,
          })
        : [];
    const prevStatusMap = new Map(currentMissions.map((m) => [m.id, m.status]));

    // Start scan overlay
    setScanPhase(0);
    setRunning(true);

    // Advance stages on a fake timeline (accurate order)
    const t1 = setTimeout(() => setScanPhase(1), 1500);
    const t2 = setTimeout(() => setScanPhase(2), 3000);

    try {
      await fetch('/api/vaio/run', { method: 'POST' });
      const data = await fetchStatus();

      if (data?.profile) {
        // Delta badge
        const delta = data.profile.voice_readiness_score - (prevScoreRef.current ?? 0);
        setDeltaScore(delta);
        const deltaDismiss = setTimeout(() => setDeltaScore(null), 5000);
        // Store for cleanup — not strictly needed but prevents stale timer
        void deltaDismiss;

        // Mission pulse — find missions that just became done
        if (data.profile.score_breakdown) {
          const newMissions = generateMissions({
            breakdown: data.profile.score_breakdown,
            llms_txt_status: data.profile.llms_txt_status,
            voice_gaps: data.profile.voice_gaps,
            top_content_issues: data.profile.top_content_issues,
          });
          const justCompleted = new Set(
            newMissions
              .filter((m) => m.status === 'done' && prevStatusMap.get(m.id) === 'open')
              .map((m) => m.id),
          );
          if (justCompleted.size > 0) {
            setJustCompletedMissions(justCompleted);
            setTimeout(() => setJustCompletedMissions(new Set()), 3000);
          }
        }
      }
    } catch (err) {
      console.error('[VAIOPageClient] run scan failed', err);
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      // Brief pause so the user sees the final stage before closing
      setTimeout(() => {
        setScanPhase(null);
        setRunning(false);
      }, 500);
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

  // Compute missions from profile + breakdown (Sprint 2)
  const missions =
    profile && breakdown
      ? generateMissions({
          breakdown,
          llms_txt_status: profile.llms_txt_status,
          voice_gaps: profile.voice_gaps,
          top_content_issues: profile.top_content_issues,
        })
      : [];

  return (
    <>
      {/* §210 — Scan overlay (portal-like fixed overlay) */}
      <ScanOverlay scanPhase={scanPhase} />

      {/* §210 — Failing query drawer */}
      <QueryDrawer
        query={selectedQuery}
        voiceGaps={profile?.voice_gaps ?? []}
        onClose={() => setSelectedQuery(null)}
      />

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

          {/* 4b — Animated score number + §210 delta badge */}
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className={`font-mono text-5xl font-bold ${scoreColor(score)}`} data-testid="vaio-score-display">
              {displayScore}
            </span>
            <span className="text-lg text-slate-400">/ 100</span>

            {/* §210 — Delta badge (auto-dismissed after 5s) */}
            {deltaScore !== null && (
              <span
                className={`text-sm font-semibold tabular-nums ${
                  deltaScore > 0 ? 'text-green-400' : 'text-slate-400'
                }`}
                data-testid="vaio-score-delta"
              >
                {deltaScore > 0 ? `▲ +${deltaScore} pts` : 'No change'}
              </span>
            )}
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

        {/* Mission Board (Sprint 2) */}
        {profile && missions.length > 0 && (
          <MissionBoard
            missions={missions}
            profile={{
              llms_txt_standard: profile.llms_txt_standard,
              crawler_audit: profile.crawler_audit,
              voice_gaps: profile.voice_gaps,
              top_content_issues: profile.top_content_issues,
            }}
            queries={queries}
            justCompletedMissions={justCompletedMissions}
          />
        )}

        {/* Raw Details — collapsed accordion (power-user view) */}
        {profile && (
          <div
            className="rounded-xl border border-white/5 bg-surface-dark"
            data-testid="vaio-raw-details"
          >
            <button
              onClick={() => setRawOpen((v) => !v)}
              className="flex w-full items-center justify-between p-4 text-left"
              aria-expanded={rawOpen}
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Technical Details
              </span>
              {rawOpen ? (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-500" />
              )}
            </button>

            {rawOpen && (
              <div className="space-y-5 border-t border-white/5 p-5">

                {/* AI Crawler Audit */}
                {profile.crawler_audit && (
                  <div data-testid="vaio-crawler-audit">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      AI Crawler Access
                    </h3>
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

                {/* Voice Queries — §210: 0% rows are clickable */}
                {queries.length > 0 && (
                  <div data-testid="vaio-voice-queries">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Voice Queries ({queries.length})
                    </h3>
                    <p className="mb-2 text-xs text-slate-500">
                      Click any 0% row to see why it&apos;s failing and get a suggested fix.
                    </p>
                    <div className="space-y-0.5">
                      {queries.map((q) => {
                        const isFailing =
                          q.citation_rate === null || q.citation_rate === 0;
                        return isFailing ? (
                          <button
                            key={q.id}
                            onClick={() => setSelectedQuery(q)}
                            className="-mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-center justify-between rounded px-2 py-1 text-sm transition-colors hover:bg-white/5"
                            data-testid="failing-query-row"
                          >
                            <span className="truncate max-w-md text-left text-slate-300">
                              &ldquo;{q.query_text}&rdquo;
                            </span>
                            <div className="ml-3 flex flex-shrink-0 items-center gap-3">
                              <span className="text-xs capitalize text-slate-400">
                                {q.query_category}
                              </span>
                              <ChevronRight className="h-3 w-3 text-slate-600" />
                              <span className="font-mono text-xs text-slate-400">
                                {q.citation_rate !== null
                                  ? `${Math.round(q.citation_rate * 100)}%`
                                  : '—'}
                              </span>
                            </div>
                          </button>
                        ) : (
                          <div
                            key={q.id}
                            className="flex items-center justify-between px-2 py-1 text-sm"
                          >
                            <span className="truncate max-w-md text-slate-300">
                              &ldquo;{q.query_text}&rdquo;
                            </span>
                            <div className="ml-3 flex flex-shrink-0 items-center gap-3">
                              <span className="text-xs capitalize text-slate-400">
                                {q.query_category}
                              </span>
                              <span className="font-mono text-xs text-green-400">
                                {Math.round((q.citation_rate ?? 0) * 100)}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Voice Gaps */}
                {profile.voice_gaps.length > 0 && (
                  <div data-testid="vaio-voice-gaps">
                    <div className="mb-3 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                        Voice Gaps
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {profile.voice_gaps.map((gap, i) => (
                        <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                          <p className="text-xs font-medium text-amber-400 capitalize mb-1">
                            {gap.category} — {gap.weeks_at_zero} weeks at zero citations
                          </p>
                          <p className="text-xs text-slate-400 mb-2">
                            {gap.queries?.length ?? 0} queries getting zero AI citations
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
                {profile.llms_txt_standard && (
                  <div data-testid="vaio-llms-txt">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        AI Business Profile
                      </h3>
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
                {profile.top_content_issues.filter((i) => i.description).length > 0 && (
                  <div data-testid="vaio-issues">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Voice Content Issues
                    </h3>
                    <div className="space-y-2">
                      {profile.top_content_issues.filter((i) => i.description).map((issue, i) => (
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
            )}
          </div>
        )}
      </div>
    </>
  );
}
