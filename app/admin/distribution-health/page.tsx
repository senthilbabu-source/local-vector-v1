import { createServiceRoleClient } from '@/lib/supabase/server';
import AdminStatCard from '../_components/AdminStatCard';
import { getDistributionHealthStats } from '@/lib/distribution/verification-service';

/**
 * Admin Distribution Health — shows distribution pipeline funnel stats.
 * DIST-4: Verification Pipeline (§199).
 */
export default async function AdminDistributionHealthPage() {
  const supabaseAdmin = createServiceRoleClient();
  const stats = await getDistributionHealthStats(supabaseAdmin);

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-white">Distribution Health</h1>

      {/* Top-line stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <AdminStatCard
          label="Orgs with published menus"
          value={stats.totalOrgsWithPublishedMenus}
        />
        <AdminStatCard
          label="Distributed"
          value={`${stats.pctDistributed}%`}
        />
        <AdminStatCard
          label="Crawled by AI"
          value={`${stats.pctCrawled}%`}
          highlight={stats.pctCrawled < 20 ? 'warning' : undefined}
        />
        <AdminStatCard
          label="Live in AI"
          value={`${stats.pctLiveInAI}%`}
          highlight={stats.pctLiveInAI < 10 ? 'danger' : undefined}
        />
      </div>

      {/* Funnel breakdown */}
      <section>
        <h2 className="text-sm font-semibold text-white mb-3">Distribution Funnel</h2>
        <div className="rounded-lg border border-white/10 divide-y divide-white/5" data-testid="distribution-funnel">
          <FunnelRow label="Published menus (total orgs)" value={stats.totalOrgsWithPublishedMenus} />
          <FunnelRow
            label="Distributed to engines"
            value={`${stats.orgsDistributed} (${stats.pctDistributed}%)`}
          />
          <FunnelRow
            label="Crawled by AI bots"
            value={`${stats.orgsCrawled} (${stats.pctCrawled}%)`}
          />
          <FunnelRow
            label="Live in AI answers"
            value={`${stats.orgsLiveInAI} (${stats.pctLiveInAI}%)`}
          />
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
