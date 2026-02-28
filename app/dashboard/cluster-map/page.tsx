import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchClusterMapData } from '@/lib/data/cluster-map';
import { Map } from 'lucide-react';
import ClusterMapWrapper from './_components/ClusterMapWrapper';
import { FirstVisitTooltip } from '@/components/ui/FirstVisitTooltip';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ClusterMapPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) redirect('/login');

  const supabase = await createClient();

  const { data: location } = await supabase
    .from('locations')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('is_primary', true)
    .maybeSingle();

  if (!location) {
    return (
      <div className="space-y-5">
        <PageHeader />
        <div className="rounded-xl border border-white/5 bg-surface-dark px-5 py-8 text-center">
          <p className="text-sm text-slate-400">
            No primary location found. Complete onboarding to get started.
          </p>
        </div>
      </div>
    );
  }

  const result = await fetchClusterMapData(supabase, ctx.orgId, location.id);

  // Empty state: no evaluations at all
  if (result.stats.totalQueries === 0) {
    return (
      <div className="space-y-5">
        <PageHeader />
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <FirstVisitTooltip
        pageKey="cluster-map"
        title="What is the Cluster Map?"
        content="AI models group businesses into semantic 'clusters' when answering search queries. This map shows which cluster your business is in, who else is in your cluster, and how to move into higher-visibility clusters."
      />
      <PageHeader />
      <ClusterMapWrapper initialData={result} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

function PageHeader() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
        <Map className="h-5 w-5 text-signal-green" />
        AI Visibility Cluster Map
      </h1>
      <p className="mt-0.5 text-sm text-slate-400">
        Where your business sits in each AI engine&apos;s recommendation space
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-surface-dark px-6 py-16 text-center border border-white/5">
      <p className="text-sm font-medium text-slate-300">No AI scan data yet</p>
      <p className="mt-1 text-xs text-slate-400">
        Run your first AI scan to populate the Cluster Map. The scatter plot will show
        your position across AI engines alongside competitors.
      </p>
      <a
        href="/dashboard/share-of-voice"
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-surface-dark px-4 py-2 text-sm font-medium text-white transition hover:bg-white/5"
      >
        Start AI Scan →
      </a>
    </div>
  );
}
