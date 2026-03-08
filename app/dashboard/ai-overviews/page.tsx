import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { planSatisfies } from '@/lib/plan-enforcer';

export const metadata = { title: 'AI Overviews | LocalVector.ai' };

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

interface AggregatedQuery {
  query: string;
  impressions: number;
  clicks: number;
  avgCtr: number;
  avgPosition: number;
}

async function fetchAIOverviewData(orgId: string) {
  const supabase = await createClient();

  // Last 28 days of AI Overview data, aggregated by query
  const twentyEightDaysAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: rows } = await supabase
    .from('gsc_ai_overview_data')
    .select('query, impressions, clicks, ctr, position')
    .eq('org_id', orgId)
    .eq('has_ai_overview', true)
    .gte('date', twentyEightDaysAgo)
    .order('impressions', { ascending: false });

  if (!rows?.length) return { queries: [], totalQueries: 0, avgCtr: 0 };

  // Aggregate by query (sum impressions/clicks, avg ctr/position)
  const byQuery = new Map<string, { impressions: number; clicks: number; ctrSum: number; posSum: number; count: number }>();
  for (const row of rows) {
    const existing = byQuery.get(row.query);
    if (existing) {
      existing.impressions += row.impressions;
      existing.clicks += row.clicks;
      existing.ctrSum += row.ctr;
      existing.posSum += row.position;
      existing.count++;
    } else {
      byQuery.set(row.query, {
        impressions: row.impressions,
        clicks: row.clicks,
        ctrSum: row.ctr,
        posSum: row.position,
        count: 1,
      });
    }
  }

  const queries: AggregatedQuery[] = Array.from(byQuery.entries())
    .map(([query, agg]) => ({
      query,
      impressions: agg.impressions,
      clicks: agg.clicks,
      avgCtr: agg.count > 0 ? agg.ctrSum / agg.count : 0,
      avgPosition: agg.count > 0 ? agg.posSum / agg.count : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions);

  const totalImpressions = queries.reduce((s, q) => s + q.impressions, 0);
  const totalClicks = queries.reduce((s, q) => s + q.clicks, 0);
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;

  return { queries, totalQueries: queries.length, avgCtr };
}

async function hasGSCScope(orgId: string): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('google_oauth_tokens')
    .select('scopes')
    .eq('org_id', orgId)
    .maybeSingle();

  return !!data?.scopes?.includes('webmasters');
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AIOverviewsPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) redirect('/login');

  const plan = ctx.plan ?? 'trial';
  const isGrowthPlus = planSatisfies(plan, 'growth');

  // Plan gate
  if (!isGrowthPlus) {
    return (
      <div className="space-y-6" data-testid="ai-overviews-page">
        <div>
          <h1 className="text-xl font-semibold text-white">AI Overviews in Google Search</h1>
          <p className="mt-0.5 text-sm text-[#94A3B8]">
            See which of your queries triggered Google AI Overviews.
          </p>
        </div>
        <div className="rounded-lg border border-[#1E293B] bg-[#0F172A] p-8 text-center">
          <p className="text-sm text-[#94A3B8]">
            AI Overview monitoring requires a <span className="font-medium text-white">Growth</span> plan or higher.
          </p>
          <a
            href="/dashboard/billing"
            className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Upgrade Plan
          </a>
        </div>
      </div>
    );
  }

  const gscConnected = await hasGSCScope(ctx.orgId);

  // Not connected — show CTA
  if (!gscConnected) {
    return (
      <div className="space-y-6" data-testid="ai-overviews-page">
        <div>
          <h1 className="text-xl font-semibold text-white">AI Overviews in Google Search</h1>
          <p className="mt-0.5 text-sm text-[#94A3B8]">
            See which of your queries triggered Google AI Overviews.
          </p>
        </div>
        <div className="rounded-lg border border-[#1E293B] bg-[#0F172A] p-8 text-center">
          <p className="text-sm text-[#94A3B8]">
            Connect Google Search Console to see which of your queries trigger AI Overviews in Google Search results.
          </p>
          <a
            href="/api/auth/google?source=ai-overviews"
            className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Connect Google Search Console
          </a>
        </div>
      </div>
    );
  }

  const { queries, totalQueries, avgCtr } = await fetchAIOverviewData(ctx.orgId);

  // Connected but no data yet
  if (queries.length === 0) {
    return (
      <div className="space-y-6" data-testid="ai-overviews-page">
        <div>
          <h1 className="text-xl font-semibold text-white">AI Overviews in Google Search</h1>
          <p className="mt-0.5 text-sm text-[#94A3B8]">
            See which of your queries triggered Google AI Overviews.
          </p>
        </div>
        <div className="rounded-lg border border-[#1E293B] bg-[#0F172A] p-8 text-center">
          <p className="text-sm text-[#94A3B8]">
            Syncing — first data appears within 24 hours after the next weekly scan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="ai-overviews-page">
      <div>
        <h1 className="text-xl font-semibold text-white">AI Overviews in Google Search</h1>
        <p className="mt-0.5 text-sm text-[#94A3B8]">
          See which of your queries triggered Google AI Overviews.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-[#1E293B] bg-[#0F172A] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8]">
            AI Overview Queries
          </p>
          <p className="mt-1 text-2xl font-bold text-white">{totalQueries}</p>
          <p className="mt-0.5 text-xs text-[#64748B]">Last 28 days</p>
        </div>
        <div className="rounded-lg border border-[#1E293B] bg-[#0F172A] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8]">
            Avg. CTR with AI Overview
          </p>
          <p className="mt-1 text-2xl font-bold text-white">
            {(avgCtr * 100).toFixed(1)}%
          </p>
          <p className="mt-0.5 text-xs text-[#64748B]">Click-through rate</p>
        </div>
        <div className="rounded-lg border border-[#1E293B] bg-[#0F172A] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8]">
            Total Impressions
          </p>
          <p className="mt-1 text-2xl font-bold text-white">
            {queries.reduce((s, q) => s + q.impressions, 0).toLocaleString()}
          </p>
          <p className="mt-0.5 text-xs text-[#64748B]">With AI Overview</p>
        </div>
      </div>

      {/* Data table */}
      <div className="overflow-x-auto rounded-lg border border-[#1E293B]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#1E293B] bg-[#0F172A]">
            <tr>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-[#94A3B8]">
                Query
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[#94A3B8]">
                Impressions
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[#94A3B8]">
                Clicks
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[#94A3B8]">
                CTR
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[#94A3B8]">
                Position
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B] bg-[#020617]">
            {queries.map((q) => (
              <tr key={q.query}>
                <td className="px-4 py-3 text-white">{q.query}</td>
                <td className="px-4 py-3 text-right tabular-nums text-[#94A3B8]">
                  {q.impressions.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[#94A3B8]">
                  {q.clicks.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[#94A3B8]">
                  {(q.avgCtr * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[#94A3B8]">
                  {q.avgPosition.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
