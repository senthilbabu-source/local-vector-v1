'use client';

// ---------------------------------------------------------------------------
// VAIOPanel — Voice Readiness summary panel for the dashboard
//
// Sprint 109: VAIO — Voice & Conversational AI Optimization
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { Mic, ShieldCheck, ShieldAlert, ShieldX, Loader2 } from 'lucide-react';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

interface VAIOPanelProps {
  isGrowthPlan: boolean;
}

interface VAIOStatus {
  profile: {
    voice_readiness_score: number;
    llms_txt_status: string;
    crawler_audit: {
      overall_health: string;
      blocked_count: number;
      allowed_count: number;
    } | null;
    voice_queries_tracked: number;
    voice_citation_rate: number;
    voice_gaps: unknown[];
    top_content_issues: Array<{
      type: string;
      severity: string;
      description: string;
      fix: string;
    }>;
    last_run_at: string | null;
  } | null;
  voice_queries: Array<{
    id: string;
    query_text: string;
    query_category: string;
    citation_rate: number | null;
  }>;
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-green-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function crawlerBadge(health: string | undefined) {
  switch (health) {
    case 'healthy':
      return { icon: ShieldCheck, color: 'text-green-400', label: 'All AI crawlers allowed' };
    case 'partial':
      return { icon: ShieldAlert, color: 'text-amber-400', label: 'Some crawlers blocked' };
    case 'blocked':
      return { icon: ShieldX, color: 'text-red-400', label: 'AI crawlers blocked' };
    default:
      return { icon: ShieldAlert, color: 'text-slate-500', label: 'Not checked' };
  }
}

export default function VAIOPanel({ isGrowthPlan }: VAIOPanelProps) {
  const [data, setData] = useState<VAIOStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!isGrowthPlan) {
      setLoading(false);
      return;
    }
    fetch('/api/vaio/status')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isGrowthPlan]);

  if (!isGrowthPlan) return null;

  if (loading) {
    return (
      <div
        className="rounded-xl border border-white/5 bg-surface-dark p-5 animate-pulse"
        data-testid="vaio-panel-skeleton"
      >
        <div className="h-4 w-32 rounded bg-white/10 mb-3" />
        <div className="h-10 w-20 rounded bg-white/10" />
      </div>
    );
  }

  const profile = data?.profile;
  const score = profile?.voice_readiness_score ?? 0;
  const crawlerHealth = profile?.crawler_audit?.overall_health;
  const badge = crawlerBadge(crawlerHealth);
  const BadgeIcon = badge.icon;
  const hasRun = !!profile?.last_run_at;

  const handleRunScan = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/vaio/run', { method: 'POST' });
      if (res.ok) {
        const statusRes = await fetch('/api/vaio/status');
        const updated = await statusRes.json();
        setData(updated);
      }
    } catch (err) {
      console.error('[VAIOPanel] run scan failed', err);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/5 bg-surface-dark p-5" data-testid="vaio-panel">
      {/* Header */}
      <div className="mb-3 flex items-center gap-1.5">
        <Mic className="h-4 w-4 text-electric-indigo" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Voice Readiness
        </h3>
        <InfoTooltip content="How optimized your business is for voice search — Siri, Alexa, Google Assistant, and AI-powered spoken answers." />
      </div>

      {!hasRun ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            Run a VAIO scan to measure your voice search readiness score.
          </p>
          <button
            onClick={handleRunScan}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-lg bg-electric-indigo/20 px-3 py-1.5 text-xs font-medium text-electric-indigo hover:bg-electric-indigo/30 transition-colors disabled:opacity-50"
            data-testid="vaio-run-button"
          >
            {running && <Loader2 className="h-3 w-3 animate-spin" />}
            {running ? 'Scanning...' : 'Run Voice Scan'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Score */}
          <div className="flex items-baseline gap-2">
            <span
              className={`font-mono text-3xl font-bold ${scoreColor(score)}`}
              data-testid="vaio-score"
            >
              {score}
            </span>
            <span className="text-xs text-slate-500">/ 100</span>
          </div>

          {/* Crawler health badge */}
          <div className="flex items-center gap-1.5">
            <BadgeIcon className={`h-3.5 w-3.5 ${badge.color}`} />
            <span className={`text-xs ${badge.color}`}>{badge.label}</span>
          </div>

          {/* Stats row */}
          <div className="flex gap-4 text-xs text-slate-400">
            <span>{profile?.voice_queries_tracked ?? 0} voice queries</span>
            <span>
              {Math.round((profile?.voice_citation_rate ?? 0) * 100)}% cited
            </span>
            {profile?.voice_gaps && profile.voice_gaps.length > 0 && (
              <span className="text-amber-400">{profile.voice_gaps.length} gap{profile.voice_gaps.length > 1 ? 's' : ''}</span>
            )}
          </div>

          {/* Top issue */}
          {profile?.top_content_issues?.[0] && (
            <p className="text-xs text-slate-500">
              <span className="text-amber-400">Top issue:</span>{' '}
              {profile.top_content_issues[0].description}
            </p>
          )}

          {/* llms.txt status */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500">llms.txt:</span>
            <span className={
              profile?.llms_txt_status === 'generated' ? 'text-green-400' :
              profile?.llms_txt_status === 'stale' ? 'text-amber-400' :
              'text-slate-500'
            }>
              {profile?.llms_txt_status === 'generated' ? 'Generated' :
               profile?.llms_txt_status === 'stale' ? 'Stale' : 'Not generated'}
            </span>
          </div>

          {/* Re-scan button */}
          <button
            onClick={handleRunScan}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/10 transition-colors disabled:opacity-50"
            data-testid="vaio-rescan-button"
          >
            {running && <Loader2 className="h-3 w-3 animate-spin" />}
            {running ? 'Scanning...' : 'Re-scan'}
          </button>
        </div>
      )}
    </div>
  );
}
