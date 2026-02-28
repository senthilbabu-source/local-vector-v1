import { createServiceRoleClient } from '@/lib/supabase/server';
import { getPlanDisplayName } from '@/lib/plan-display-names';
import AdminStatCard from '../_components/AdminStatCard';

// Blended estimate of Perplexity + OpenAI cost per manual trigger.
// Update ESTIMATED_COST_PER_CREDIT as actual cost data becomes available.
const ESTIMATED_COST_PER_CREDIT = 0.02;

/**
 * Admin API Usage Summary — per-org credit consumption.
 * Sprint D (L1 + N1).
 */
export default async function AdminApiUsagePage() {
  const supabaseAdmin = createServiceRoleClient();

  // Fetch credit usage joined with org names
  const { data: creditRows } = await supabaseAdmin
    .from('api_credits')
    .select('org_id, plan, credits_used, credits_limit, reset_date')
    .order('credits_used', { ascending: false });

  const { data: orgs } = await supabaseAdmin
    .from('organizations')
    .select('id, name');

  const orgMap = new Map((orgs ?? []).map((o) => [o.id, o.name]));
  const rows = creditRows ?? [];

  const totalCreditsUsed = rows.reduce((sum, r) => sum + r.credits_used, 0);
  const nearLimitCount = rows.filter((r) => r.credits_used / r.credits_limit >= 0.8 && r.credits_used / r.credits_limit < 1).length;
  const cappedCount = rows.filter((r) => r.credits_used >= r.credits_limit).length;
  const estimatedCost = (totalCreditsUsed * ESTIMATED_COST_PER_CREDIT).toFixed(2);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-white">API Usage</h1>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <AdminStatCard label="Total API calls this month" value={totalCreditsUsed} />
        <AdminStatCard label="Orgs at >80% usage" value={nearLimitCount} highlight={nearLimitCount > 0 ? 'warning' : undefined} />
        <AdminStatCard label="Orgs hard-capped (100%)" value={cappedCount} highlight={cappedCount > 0 ? 'danger' : undefined} />
        <AdminStatCard label="Estimated API cost" value={`$${estimatedCost}`} />
      </div>

      {/* Usage table */}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm" data-testid="admin-api-usage-table">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">Organization</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Credits Used</th>
              <th className="px-4 py-3">Limit</th>
              <th className="px-4 py-3">% Used</th>
              <th className="px-4 py-3">Reset Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const usagePercent = Math.round((row.credits_used / row.credits_limit) * 100);
              const rowClass = usagePercent >= 100
                ? 'bg-red-500/5 border-red-500/20'
                : usagePercent >= 80
                  ? 'bg-amber-500/5 border-amber-500/20'
                  : 'border-white/5';

              return (
                <tr key={row.org_id} className={`border-b transition-colors ${rowClass}`}>
                  <td className="px-4 py-3 font-medium text-white">
                    {orgMap.get(row.org_id) ?? 'Unknown'}
                  </td>
                  <td className="px-4 py-3 text-slate-300 capitalize">
                    {getPlanDisplayName(row.plan)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-300">{row.credits_used}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-300">{row.credits_limit}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-300">{usagePercent}%</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(row.reset_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No API credit usage recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
