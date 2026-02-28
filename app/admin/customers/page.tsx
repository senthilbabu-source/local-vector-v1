import { createServiceRoleClient } from '@/lib/supabase/server';
import { getPlanDisplayName } from '@/lib/plan-display-names';
import { formatRelativeDate } from '@/lib/admin/format-relative-date';
import PlanBadge from '../_components/PlanBadge';

// ---------------------------------------------------------------------------
// MRR constants — intentionally simple (Stripe handles real-time accounting)
// ---------------------------------------------------------------------------

const PLAN_MRR: Record<string, number> = {
  trial: 0,
  starter: 29,
  growth: 59,
  agency: 0, // custom — would need Stripe lookup for actual amount
};

function calculateMRR(plan: string | null): number {
  return PLAN_MRR[plan ?? 'trial'] ?? 0;
}

/**
 * Admin Customer List — shows all orgs with plan, MRR, and activity data.
 * Sprint D (L1).
 */
export default async function AdminCustomersPage() {
  const supabaseAdmin = createServiceRoleClient();

  const { data: orgs } = await supabaseAdmin
    .from('organizations')
    .select('id, name, plan, created_at, stripe_customer_id')
    .order('created_at', { ascending: false });

  const orgList = orgs ?? [];
  const totalMRR = orgList.reduce((sum, org) => sum + calculateMRR(org.plan), 0);
  const trialCount = orgList.filter((org) => org.plan === 'trial').length;
  const payingCount = orgList.filter((org) => org.plan !== 'trial' && org.plan !== null).length;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-white">Customers</h1>

      {/* Summary stats */}
      <div className="flex gap-8 text-sm">
        <div>
          <span className="text-slate-400">Total customers:</span>
          <span className="ml-2 font-semibold text-white">{orgList.length}</span>
        </div>
        <div>
          <span className="text-slate-400">MRR:</span>
          <span className="ml-2 font-semibold text-signal-green">${totalMRR}/mo</span>
        </div>
        <div>
          <span className="text-slate-400">Active trials:</span>
          <span className="ml-2 font-semibold text-white">{trialCount}</span>
        </div>
        <div>
          <span className="text-slate-400">Paying:</span>
          <span className="ml-2 font-semibold text-white">{payingCount}</span>
        </div>
      </div>

      {/* Customer table */}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm" data-testid="admin-customer-table">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">Organization</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">MRR</th>
              <th className="px-4 py-3">Stripe</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {orgList.map((org) => (
              <tr
                key={org.id}
                className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-4 py-3 font-medium text-white">
                  {org.name ?? 'Unnamed'}
                </td>
                <td className="px-4 py-3">
                  <PlanBadge plan={org.plan} />
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-300">
                  ${calculateMRR(org.plan)}/mo
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {org.stripe_customer_id ? 'Connected' : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {formatRelativeDate(org.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
