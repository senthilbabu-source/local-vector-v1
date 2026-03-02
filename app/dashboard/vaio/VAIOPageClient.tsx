'use client';

// ---------------------------------------------------------------------------
// VAIOPageClient — Full Voice Readiness dashboard (client component)
//
// Sprint 109: VAIO
// ---------------------------------------------------------------------------

import { useEffect, useState, useCallback } from 'react';
import {
  Mic, ShieldCheck, ShieldAlert, ShieldX,
  Loader2, Copy, Check, AlertTriangle,
} from 'lucide-react';

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
    default: return <ShieldAlert className="h-3.5 w-3.5 text-slate-500" />;
  }
}

export default function VAIOPageClient() {
  const [profile, setProfile] = useState<VAIOProfile | null>(null);
  const [queries, setQueries] = useState<VoiceQueryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  const score = profile?.voice_readiness_score ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="h-5 w-5 text-electric-indigo" />
          <h1 className="text-xl font-bold text-white">Voice Readiness</h1>
        </div>
        <button
          onClick={handleRunScan}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-lg bg-electric-indigo px-4 py-2 text-sm font-medium text-white hover:bg-electric-indigo/90 transition-colors disabled:opacity-50"
          data-testid="vaio-run-scan"
        >
          {running && <Loader2 className="h-4 w-4 animate-spin" />}
          {running ? 'Scanning...' : 'Run VAIO Scan'}
        </button>
      </div>

      {/* Score Card */}
      <div className="rounded-xl border border-white/5 bg-surface-dark p-6" data-testid="vaio-score-card">
        <div className="flex items-baseline gap-3">
          <span className={`font-mono text-5xl font-bold ${scoreColor(score)}`}>
            {score}
          </span>
          <span className="text-lg text-slate-500">/ 100</span>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          {score >= 70 ? 'Your business is well-optimized for voice search.' :
           score >= 40 ? 'Some improvements needed for voice search readiness.' :
           'Voice search optimization needs attention.'}
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
                  <span className="text-xs text-slate-500">({c.used_by})</span>
                </div>
                <span className={`text-xs ${
                  c.status === 'allowed' ? 'text-green-400' :
                  c.status === 'blocked' ? 'text-red-400' :
                  'text-slate-500'
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
                  <span className="text-xs text-slate-500 capitalize">{q.query_category}</span>
                  <span className={`font-mono text-xs ${
                    q.citation_rate !== null && q.citation_rate > 0
                      ? 'text-green-400' : 'text-slate-500'
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
                <p className="text-xs text-slate-500 italic">
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
              llms.txt
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
                  <p className="text-xs text-slate-500">{issue.fix}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
