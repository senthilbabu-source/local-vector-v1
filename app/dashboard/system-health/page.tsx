import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { fetchCronHealth } from '@/lib/data/cron-health';
import type { CronRunRow, CronJobSummary } from '@/lib/services/cron-health.service';
import { Activity, CheckCircle, AlertTriangle, Clock, XCircle } from 'lucide-react';

export default async function SystemHealthPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) redirect('/login');

  const health = await fetchCronHealth();

  // Null state — no cron runs at all
  if (health.recentRuns.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">System Health</h1>
          <p className="mt-0.5 text-sm text-slate-400">Cron job status and execution history</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-surface-dark px-6 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-electric-indigo/10">
            <Activity className="h-6 w-6 text-electric-indigo" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-white">No cron runs recorded yet</h2>
          <p className="mt-2 max-w-md mx-auto text-sm text-slate-400">
            Cron jobs run on a schedule. The first audit scan runs daily at 3 AM EST.
            Check back after your first scheduled run.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">System Health</h1>
        <p className="mt-0.5 text-sm text-slate-400">Cron job status and execution history</p>
      </div>

      {/* Failure alert banner */}
      {health.hasRecentFailures && (
        <div className="rounded-xl border border-alert-crimson/20 bg-alert-crimson/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-alert-crimson shrink-0" />
            <p className="text-sm font-medium text-alert-crimson">
              {health.jobs.reduce((sum, j) => sum + j.recentFailureCount, 0)} failure{health.jobs.reduce((sum, j) => sum + j.recentFailureCount, 0) === 1 ? '' : 's'} in the last 7 days
            </p>
          </div>
        </div>
      )}

      {/* Summary strip — one card per cron */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {health.jobs.map((job) => (
          <CronJobCard key={job.cronName} job={job} />
        ))}
      </div>

      {/* Recent runs table */}
      <div className="rounded-xl border border-white/5 bg-surface-dark">
        <div className="border-b border-white/5 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Recent Runs</h2>
        </div>
        <div className="divide-y divide-white/5">
          {health.recentRuns.map((run) => (
            <RunRow key={run.id} run={run} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function CronJobCard({ job }: { job: CronJobSummary }) {
  return (
    <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-slate-400 truncate">{job.label}</p>
        <StatusBadge status={job.lastStatus} />
      </div>
      <p className="text-xs text-slate-500">{job.schedule}</p>
      <p className="mt-1.5 text-xs text-slate-400">
        {job.lastRunAt ? `Last: ${formatRelative(job.lastRunAt)}` : 'Never run'}
      </p>
      {job.lastDurationMs != null && (
        <p className="text-xs text-slate-500">
          Duration: <span className="font-mono">{formatDuration(job.lastDurationMs)}</span>
        </p>
      )}
      {job.recentFailureCount > 0 && (
        <p className="mt-1 text-xs font-medium text-alert-crimson">
          {job.recentFailureCount} failure{job.recentFailureCount === 1 ? '' : 's'} (7d)
        </p>
      )}
    </div>
  );
}

function RunRow({ run }: { run: CronRunRow }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <StatusIcon status={run.status} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{cronLabel(run.cron_name)}</p>
            <p className="text-xs text-slate-500">{formatRelative(run.started_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {run.duration_ms != null && (
            <p className="text-xs font-mono text-slate-400">{formatDuration(run.duration_ms)}</p>
          )}
          <StatusBadge status={run.status} />
        </div>
      </div>
      {run.error_message && (
        <p className="mt-2 ml-7 text-xs text-alert-crimson/80 bg-alert-crimson/5 rounded px-2 py-1">
          {run.error_message}
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: CronRunRow['status'] | null }) {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center rounded-md bg-truth-emerald/10 px-2 py-0.5 text-xs font-medium text-truth-emerald">
        Success
      </span>
    );
  }
  if (status === 'running') {
    return (
      <span className="inline-flex items-center rounded-md bg-electric-indigo/10 px-2 py-0.5 text-xs font-medium text-electric-indigo">
        Running
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center rounded-md bg-alert-crimson/10 px-2 py-0.5 text-xs font-medium text-alert-crimson">
        Failed
      </span>
    );
  }
  if (status === 'timeout') {
    return (
      <span className="inline-flex items-center rounded-md bg-alert-amber/10 px-2 py-0.5 text-xs font-medium text-alert-amber">
        Timeout
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-slate-500/10 px-2 py-0.5 text-xs font-medium text-slate-500">
      Pending
    </span>
  );
}

function StatusIcon({ status }: { status: CronRunRow['status'] }) {
  if (status === 'success') return <CheckCircle className="h-4 w-4 text-truth-emerald shrink-0" />;
  if (status === 'running') return <Clock className="h-4 w-4 text-electric-indigo shrink-0" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 text-alert-crimson shrink-0" />;
  if (status === 'timeout') return <AlertTriangle className="h-4 w-4 text-alert-amber shrink-0" />;
  return <Clock className="h-4 w-4 text-slate-500 shrink-0" />;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const CRON_LABELS: Record<string, string> = {
  audit: 'AI Audit',
  sov: 'SOV Engine',
  citation: 'Citation Scan',
  'content-audit': 'Content Audit',
};

function cronLabel(cronName: string): string {
  return CRON_LABELS[cronName] ?? cronName;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatRelative(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
