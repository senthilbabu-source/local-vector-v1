import Link from 'next/link';
import { Activity, ArrowRight } from 'lucide-react';
import type { CronHealthSummary } from '@/lib/data/cron-health';

interface CronHealthCardProps {
  cronHealth: CronHealthSummary | null;
}

export default function CronHealthCard({ cronHealth }: CronHealthCardProps) {
  // No data yet
  if (!cronHealth || cronHealth.recentRuns.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-4 w-4 text-electric-indigo" />
          <h3 className="text-sm font-semibold text-white">System Health</h3>
        </div>
        <p className="text-xs text-slate-400">
          System health data will appear after your first cron runs.
        </p>
      </div>
    );
  }

  const failureCount = cronHealth.jobs.reduce((sum, j) => sum + j.recentFailureCount, 0);

  return (
    <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="h-4 w-4 text-electric-indigo" />
        <h3 className="text-sm font-semibold text-white">System Health</h3>
      </div>
      <p className="text-sm text-slate-300">
        <OverallStatusBadge status={cronHealth.overallStatus} />
        {failureCount > 0 && (
          <>
            {' · '}
            <span className="text-alert-crimson">
              {failureCount} failure{failureCount === 1 ? '' : 's'} (7d)
            </span>
          </>
        )}
      </p>
      <Link
        href="/dashboard/system-health"
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-electric-indigo hover:text-electric-indigo/80 transition"
      >
        View System Health <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function OverallStatusBadge({ status }: { status: CronHealthSummary['overallStatus'] }) {
  if (status === 'healthy') {
    return (
      <span className="inline-flex items-center rounded-md bg-truth-emerald/10 px-2 py-0.5 text-xs font-medium text-truth-emerald">
        All Systems Healthy
      </span>
    );
  }
  if (status === 'degraded') {
    return (
      <span className="inline-flex items-center rounded-md bg-alert-amber/10 px-2 py-0.5 text-xs font-medium text-alert-amber">
        Degraded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-alert-crimson/10 px-2 py-0.5 text-xs font-medium text-alert-crimson">
      Failing
    </span>
  );
}
