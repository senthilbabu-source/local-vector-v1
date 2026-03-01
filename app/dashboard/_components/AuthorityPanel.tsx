'use client';

// ---------------------------------------------------------------------------
// AuthorityPanel — Sprint 108: Entity Authority Score + sameAs gaps
//
// Displays on the main dashboard. Calls GET /api/authority/status on mount.
// Plan gate: Growth+ only.
// ---------------------------------------------------------------------------

import { useEffect, useState, useCallback } from 'react';
import { Shield, RefreshCw, TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react';
import type { AuthorityStatusResponse, EntityAuthorityProfile, AuthoritySnapshot } from '@/lib/authority/types';

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function scoreToGrade(score: number): string {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

const GRADE_COLORS: Record<string, string> = {
  A: 'text-signal-green bg-signal-green/10 border-signal-green/20',
  B: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  C: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  D: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  F: 'text-red-400 bg-red-400/10 border-red-400/20',
};

interface AuthorityPanelProps {
  isGrowthPlan: boolean;
}

export default function AuthorityPanel({ isGrowthPlan }: AuthorityPanelProps) {
  const [data, setData] = useState<AuthorityStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/authority/status');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (_e) {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isGrowthPlan) {
      fetchStatus();
    } else {
      setLoading(false);
    }
  }, [isGrowthPlan, fetchStatus]);

  const handleRunMapping = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/authority/run', { method: 'POST' });
      if (res.ok) {
        await fetchStatus();
      }
    } finally {
      setRunning(false);
    }
  };

  if (!isGrowthPlan) return null;

  if (loading) {
    return (
      <div data-testid="authority-panel" className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-48 rounded bg-slate-700/50" />
          <div className="h-4 w-32 rounded bg-slate-700/50" />
          <div className="h-20 rounded bg-slate-700/50" />
        </div>
      </div>
    );
  }

  const profile = data?.profile;
  const history = data?.history ?? [];
  const lastRunAt = data?.last_run_at;

  return (
    <div data-testid="authority-panel" className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-electric-indigo" />
          <h3 className="text-sm font-semibold text-white">Entity Authority</h3>
        </div>
        <div className="flex items-center gap-2">
          {profile && (
            <span
              data-testid="authority-score"
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                GRADE_COLORS[scoreToGrade(profile.entity_authority_score)] ?? GRADE_COLORS.F
              }`}
            >
              {profile.entity_authority_score}/100 {scoreToGrade(profile.entity_authority_score)}
            </span>
          )}
          <button
            data-testid="authority-run-button"
            onClick={handleRunMapping}
            disabled={running}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-700 px-3 py-1 text-xs font-medium text-slate-300 transition hover:bg-slate-600 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${running ? 'animate-spin' : ''}`} />
            {running ? 'Mapping...' : 'Re-map Now'}
          </button>
        </div>
      </div>

      {/* ── Last run ────────────────────────────────────────────────── */}
      {lastRunAt && (
        <p data-testid="authority-last-run" className="mt-1 text-xs text-slate-500">
          Last mapped: {formatRelativeTime(lastRunAt)}
        </p>
      )}

      {/* ── Empty state ─────────────────────────────────────────────── */}
      {!profile && (
        <div className="mt-4 rounded-lg border border-slate-700/30 bg-slate-800/30 p-4 text-center">
          <p className="text-sm text-slate-400">
            No authority data yet. Click <strong>Re-map Now</strong> to analyze your entity citations.
          </p>
        </div>
      )}

      {/* ── Profile content ─────────────────────────────────────────── */}
      {profile && (
        <div className="mt-4 space-y-4">
          {/* Critical gap alert */}
          {profile.tier_breakdown.tier1 === 0 && (
            <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2">
              <p className="text-xs font-medium text-red-400">
                CRITICAL GAP: No Tier 1 press citations found. A single mention in local news adds 15–30 points.
              </p>
            </div>
          )}

          {/* Score breakdown + Citation sources */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Score breakdown */}
            <div data-testid="authority-tier-breakdown">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Score Breakdown</p>
              <div className="space-y-1.5">
                <ScoreDimension label="Tier 1 Citations" value={profile.dimensions.tier1_citation_score} max={30} />
                <ScoreDimension label="Tier 2 Coverage" value={profile.dimensions.tier2_coverage_score} max={25} />
                <ScoreDimension label="Platform Breadth" value={profile.dimensions.platform_breadth_score} max={20} />
                <ScoreDimension label="sameAs Links" value={profile.dimensions.sameas_score} max={15} />
                <ScoreDimension label="Velocity" value={profile.dimensions.velocity_score} max={10} />
              </div>
            </div>

            {/* Citation sources */}
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                Citation Sources ({profile.tier_breakdown.tier1 + profile.tier_breakdown.tier2 + profile.tier_breakdown.tier3} total)
              </p>
              <div className="space-y-1">
                <TierCount label="Tier 1 (Press/Gov)" count={profile.tier_breakdown.tier1} color="text-red-400" />
                <TierCount label="Tier 2 (Platforms)" count={profile.tier_breakdown.tier2} color="text-yellow-400" />
                <TierCount label="Tier 3 (Blogs)" count={profile.tier_breakdown.tier3} color="text-slate-400" />
              </div>

              {/* Velocity indicator */}
              <div data-testid="authority-velocity" className="mt-3 flex items-center gap-2">
                <VelocityIndicator velocity={profile.citation_velocity} label={profile.velocity_label} />
              </div>
            </div>
          </div>

          {/* sameAs gaps */}
          {profile.sameas_gaps.length > 0 && (
            <div data-testid="authority-sameas-gaps">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                sameAs Gaps ({profile.sameas_gaps.length})
              </p>
              <div className="space-y-1.5">
                {profile.sameas_gaps.slice(0, 3).map((gap) => (
                  <div key={gap.platform} className="flex items-center justify-between rounded-lg border border-slate-700/30 bg-slate-800/30 px-3 py-2">
                    <div>
                      <p className="text-xs font-medium text-slate-300">{gap.action_label}</p>
                      <p className="text-xs text-slate-500">Impact: {gap.estimated_impact}</p>
                    </div>
                    {gap.url && (
                      <a href={gap.url} target="_blank" rel="noopener noreferrer" className="text-electric-indigo hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {profile.recommendations.length > 0 && (
            <div data-testid="authority-recommendations">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                Top Recommendations
              </p>
              <div className="space-y-1.5">
                {profile.recommendations.slice(0, 3).map((rec, i) => (
                  <div key={i} className="rounded-lg border border-slate-700/30 bg-slate-800/30 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                        rec.priority === 1 ? 'bg-red-400/20 text-red-400' :
                        rec.priority === 2 ? 'bg-yellow-400/20 text-yellow-400' :
                        'bg-blue-400/20 text-blue-400'
                      }`}>
                        {rec.priority}
                      </span>
                      <p className="text-xs font-medium text-slate-300">{rec.title}</p>
                    </div>
                    <p className="mt-0.5 pl-6 text-xs text-slate-500">{rec.description.slice(0, 120)}...</p>
                    <p className="mt-0.5 pl-6 text-xs text-electric-indigo">+{rec.estimated_score_gain} pts estimated</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ScoreDimension({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  const color = pct >= 75 ? 'bg-signal-green' : pct >= 50 ? 'bg-yellow-400' : pct >= 25 ? 'bg-orange-400' : 'bg-red-400';

  return (
    <div className="flex items-center gap-2">
      <span className="w-28 text-xs text-slate-400 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-700/50">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-xs text-slate-500">{value}/{max}</span>
    </div>
  );
}

function TierCount({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-xs font-medium ${color}`}>{count}</span>
    </div>
  );
}

function VelocityIndicator({ velocity, label }: { velocity: number | null; label: string }) {
  if (velocity === null || label === 'unknown') {
    return (
      <div className="flex items-center gap-1 text-xs text-slate-500">
        <Minus className="h-3 w-3" /> First run — no velocity data yet
      </div>
    );
  }

  if (label === 'growing') {
    return (
      <div className="flex items-center gap-1 text-xs text-signal-green">
        <TrendingUp className="h-3 w-3" /> Citations growing +{Math.abs(Math.round(velocity))}%
      </div>
    );
  }

  if (label === 'declining') {
    return (
      <div className="flex items-center gap-1 text-xs text-red-400">
        <TrendingDown className="h-3 w-3" /> Citations declining {Math.round(velocity)}%
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-xs text-slate-400">
      <Minus className="h-3 w-3" /> Citations stable ({velocity > 0 ? '+' : ''}{Math.round(velocity)}%)
    </div>
  );
}
