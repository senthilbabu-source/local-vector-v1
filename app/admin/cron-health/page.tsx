import { createServiceRoleClient } from '@/lib/supabase/server';
import { formatRelativeDate } from '@/lib/admin/format-relative-date';

/**
 * StatusDot — colored circle for cron run status. Sprint D (L1).
 */
function StatusDot({ status }: { status: string }) {
  const color =
    status === 'success'
      ? 'bg-signal-green'
      : status === 'failed'
        ? 'bg-red-500'
        : 'bg-amber-500';

  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

/**
 * Admin Cron Health — shows scheduled job health across all orgs.
 * Reads from cron_run_log (created in earlier sprints).
 * Sprint D (L1).
 */
export default async function AdminCronHealthPage() {
  const supabaseAdmin = createServiceRoleClient();

  const { data: cronRuns } = await supabaseAdmin
    .from('cron_run_log')
    .select('id, cron_name, started_at, completed_at, duration_ms, status, summary, error_message')
    .order('started_at', { ascending: false })
    .limit(100);

  const runs = cronRuns ?? [];
  const cronNames = [...new Set(runs.map((r) => r.cron_name))];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-white">Cron Health</h1>

      {/* Summary cards per cron */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {cronNames.map((cron) => {
          const cronRuns = runs.filter((r) => r.cron_name === cron);
          const lastRun = cronRuns[0];
          const last10 = cronRuns.slice(0, 10);
          const successRate = last10.length > 0
            ? Math.round((last10.filter((r) => r.status === 'success').length / last10.length) * 100)
            : 0;

          return (
            <div key={cron} className="rounded-lg border border-white/10 bg-surface-dark p-4" data-testid="cron-health-card">
              <p className="text-sm font-semibold text-white">{cron}</p>
              <p className="text-xs text-slate-500 mt-1">
                Last run: {formatRelativeDate(lastRun?.started_at)}
              </p>
              <div className="flex items-center gap-2 mt-2">
                {lastRun && <StatusDot status={lastRun.status} />}
                <span className="text-xs text-slate-400">{successRate}% success (last 10)</span>
              </div>
            </div>
          );
        })}
        {cronNames.length === 0 && (
          <p className="col-span-full text-sm text-slate-500">No cron runs recorded yet.</p>
        )}
      </div>

      {/* Full run log table */}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm" data-testid="admin-cron-table">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">Cron Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Started At</th>
              <th className="px-4 py-3">Error</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-b border-white/5">
                <td className="px-4 py-3 font-medium text-white">{run.cron_name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <StatusDot status={run.status} />
                    <span className="text-slate-300 capitalize">{run.status}</span>
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-300">
                  {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {formatRelativeDate(run.started_at)}
                </td>
                <td className="px-4 py-3 text-xs text-red-400 max-w-xs truncate">
                  {run.error_message ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
