'use client';

// ---------------------------------------------------------------------------
// ListingHealthPanel — Sprint 105: NAP Health Score + discrepancy cards
//
// Displays on the main dashboard. Calls GET /api/nap-sync/status on mount.
// Plan gate: Growth+ only.
// ---------------------------------------------------------------------------

import { useEffect, useState, useCallback } from 'react';
import { MapPin, RefreshCw, ExternalLink, CheckCircle, AlertCircle, AlertTriangle, XCircle } from 'lucide-react';
import ListingFixModal from './ListingFixModal';

interface DiscrepancyField {
  field: string;
  ground_truth_value: string | null;
  platform_value: string | null;
}

interface Discrepancy {
  platform: string;
  status: string;
  severity: string;
  discrepant_fields: DiscrepancyField[];
  auto_correctable: boolean;
  fix_instructions: string | null;
}

interface HealthScore {
  score: number;
  grade: string;
}

interface NAPStatusResponse {
  health_score: HealthScore | null;
  discrepancies: Discrepancy[];
  last_checked_at: string | null;
}

const PLATFORM_LABELS: Record<string, string> = {
  google: 'Google Business Profile',
  yelp: 'Yelp',
  apple_maps: 'Apple Maps',
  bing: 'Bing Places',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-400/10 border-red-400/20',
  high: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  low: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  none: 'text-signal-green bg-signal-green/10 border-signal-green/20',
};

const STATUS_ICONS: Record<string, typeof CheckCircle> = {
  match: CheckCircle,
  discrepancy: XCircle,
  unconfigured: AlertTriangle,
  api_error: AlertCircle,
  not_found: AlertTriangle,
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

interface ListingHealthPanelProps {
  isGrowthPlan: boolean;
}

export default function ListingHealthPanel({ isGrowthPlan }: ListingHealthPanelProps) {
  const [data, setData] = useState<NAPStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [fixModal, setFixModal] = useState<{ platform: string; instructions: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/nap-sync/status');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Non-critical — panel renders empty state
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

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/nap-sync/run', { method: 'POST' });
      if (res.ok) {
        await fetchStatus();
      }
    } catch {
      // Handled silently
    } finally {
      setSyncing(false);
    }
  };

  if (!isGrowthPlan) return null;

  if (loading) {
    return (
      <div
        className="rounded-xl border border-white/5 bg-surface-dark p-5 animate-pulse"
        data-testid="listing-health-panel-skeleton"
      >
        <div className="h-5 w-40 bg-white/10 rounded mb-4" />
        <div className="space-y-3">
          <div className="h-16 bg-white/5 rounded-lg" />
          <div className="h-16 bg-white/5 rounded-lg" />
        </div>
      </div>
    );
  }

  const healthScore = data?.health_score;
  const discrepancies = data?.discrepancies ?? [];
  const lastChecked = data?.last_checked_at;

  return (
    <div
      className="rounded-xl border border-white/5 bg-surface-dark p-5"
      data-testid="listing-health-panel"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-signal-green" />
          <h2 className="text-base font-semibold text-white">Listing Health</h2>
        </div>
        <div className="flex items-center gap-3">
          {healthScore && (
            <span
              className="text-sm font-semibold text-white"
              data-testid="nap-score"
            >
              NAP Score: {healthScore.score}/100{' '}
              <span className="text-signal-green">{healthScore.grade}</span>
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg bg-signal-green/10 px-3 py-1.5 text-xs font-medium text-signal-green hover:bg-signal-green/20 transition disabled:opacity-50"
            data-testid="nap-sync-button"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Run Sync Now'}
          </button>
        </div>
      </div>

      {/* Last checked */}
      {lastChecked && (
        <p className="text-xs text-slate-500 mb-3" data-testid="nap-last-checked">
          Last checked: {formatRelativeTime(lastChecked)}
        </p>
      )}

      {/* Platform cards */}
      {discrepancies.length === 0 && !healthScore && (
        <p className="text-sm text-slate-400">
          No NAP sync data yet. Click &quot;Run Sync Now&quot; to check your listings.
        </p>
      )}

      {discrepancies.length === 0 && healthScore && healthScore.score === 100 && (
        <div className="flex items-center gap-2 rounded-lg bg-signal-green/10 border border-signal-green/20 px-4 py-3">
          <CheckCircle className="h-5 w-5 text-signal-green" />
          <p className="text-sm font-medium text-signal-green">
            All listings are accurate!
          </p>
        </div>
      )}

      <div className="space-y-2">
        {discrepancies.map((d) => {
          const Icon = STATUS_ICONS[d.status] ?? AlertCircle;
          const colorClass = d.status === 'match'
            ? SEVERITY_COLORS.none
            : SEVERITY_COLORS[d.severity] ?? SEVERITY_COLORS.none;

          return (
            <div
              key={d.platform}
              className={`rounded-lg border px-4 py-3 ${colorClass}`}
              data-testid={`nap-card-${d.platform}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-medium">
                    {PLATFORM_LABELS[d.platform] ?? d.platform}
                  </span>
                </div>
                <span className="text-xs font-semibold uppercase">
                  {d.status === 'match' && 'MATCH'}
                  {d.status === 'discrepancy' && d.severity.toUpperCase()}
                  {d.status === 'unconfigured' && 'UNCONFIGURED'}
                  {d.status === 'api_error' && 'API ERROR'}
                  {d.status === 'not_found' && 'NOT FOUND'}
                </span>
              </div>

              {/* Discrepancy details */}
              {d.status === 'discrepancy' && d.discrepant_fields.length > 0 && (
                <div className="mt-2 space-y-1">
                  {d.discrepant_fields.map((field) => (
                    <div key={field.field} className="text-xs">
                      <span className="text-slate-400">{field.field}:</span>{' '}
                      <span className="line-through opacity-60">{field.platform_value ?? 'missing'}</span>{' '}
                      <span className="text-white">→ {field.ground_truth_value ?? 'N/A'}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-2 flex gap-2">
                {d.status === 'discrepancy' && d.fix_instructions && (
                  <button
                    onClick={() =>
                      setFixModal({ platform: d.platform, instructions: d.fix_instructions! })
                    }
                    className="flex items-center gap-1 text-xs font-medium hover:underline"
                    data-testid={`nap-fix-instructions-${d.platform}`}
                  >
                    <ExternalLink className="h-3 w-3" />
                    View Fix Instructions
                  </button>
                )}
                {d.status === 'discrepancy' && d.auto_correctable && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-signal-green/15 px-2 py-0.5 text-xs font-medium text-signal-green"
                    data-testid={`nap-auto-fix-${d.platform}`}
                  >
                    Auto-Fix Available
                  </span>
                )}
                {d.status === 'unconfigured' && (
                  <a
                    href="/dashboard/settings#platform-credentials"
                    className="flex items-center gap-1 text-xs font-medium hover:underline"
                    data-testid={`nap-connect-${d.platform}`}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Connect {PLATFORM_LABELS[d.platform]}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Fix instructions modal */}
      {fixModal && (
        <ListingFixModal
          isOpen
          onClose={() => setFixModal(null)}
          platform={fixModal.platform}
          instructions={fixModal.instructions}
        />
      )}
    </div>
  );
}
