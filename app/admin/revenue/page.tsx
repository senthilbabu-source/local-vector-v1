import { createServiceRoleClient } from '@/lib/supabase/server';
import { getPlanDisplayName } from '@/lib/plan-display-names';
import AdminStatCard from '../_components/AdminStatCard';

const PLAN_MRR: Record<string, number> = {
  trial: 0,
  starter: 29,
  growth: 59,
  agency: 0,
};

/**
 * Admin Revenue Summary — MRR, ARR, plan breakdown, trial funnel.
 * Sprint D (L1).
 */
export default async function AdminRevenuePage() {
  const supabaseAdmin = createServiceRoleClient();

  const { data: orgs } = await supabaseAdmin
    .from('organizations')
    .select('id, name, plan, created_at')
    .order('created_at', { ascending: false });

  const orgList = orgs ?? [];

  // MRR by plan
  const mrrByPlan: Record<string, number> = {};
  for (const org of orgList) {
    const plan = org.plan ?? 'trial';
    const mrr = PLAN_MRR[plan] ?? 0;
    mrrByPlan[plan] = (mrrByPlan[plan] ?? 0) + mrr;
  }

  const totalMRR = Object.values(mrrByPlan).reduce((a, b) => a + b, 0);
  const arr = totalMRR * 12;
  const payingCount = orgList.filter((o) => o.plan !== 'trial' && o.plan !== null).length;
  const trialCount = orgList.filter((o) => o.plan === 'trial' || o.plan === null).length;
  const conversionRate = orgList.length > 0
    ? Math.round((payingCount / orgList.length) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-white">Revenue Summary</h1>

      {/* Top-line metrics */}
      <div className="grid grid-cols-3 gap-4">
        <AdminStatCard label="MRR" value={`$${totalMRR}`} />
        <AdminStatCard label="ARR (projected)" value={`$${arr}`} />
        <AdminStatCard label="Paying customers" value={payingCount} />
      </div>

      {/* MRR by plan */}
      <section>
        <h2 className="text-sm font-semibold text-white mb-3">MRR by Plan</h2>
        <div className="rounded-lg border border-white/10 divide-y divide-white/5">
          {Object.entries(mrrByPlan).map(([plan, mrr]) => (
            <div key={plan} className="flex justify-between px-4 py-3">
              <span className="text-sm text-slate-300">{getPlanDisplayName(plan)}</span>
              <span className="text-sm font-medium tabular-nums text-white">${mrr}/mo</span>
            </div>
          ))}
        </div>
      </section>

      {/* Trial conversion funnel */}
      <section>
        <h2 className="text-sm font-semibold text-white mb-3">Trial Funnel</h2>
        <div className="rounded-lg border border-white/10 divide-y divide-white/5">
          <FunnelRow label="Total signups (all time)" value={orgList.length} />
          <FunnelRow label="Currently on trial" value={trialCount} />
          <FunnelRow label="Converted to paid" value={payingCount} />
          <FunnelRow label="Conversion rate" value={`${conversionRate}%`} />
        </div>
      </section>
    </div>
  );
}

function FunnelRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between px-4 py-3">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-medium tabular-nums text-white">{value}</span>
    </div>
  );
}
