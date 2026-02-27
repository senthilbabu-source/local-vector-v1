import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchAIResponses } from '@/lib/data/ai-responses';
import { getActiveLocationId } from '@/lib/location/active-location';
import { canRunSovEvaluation, type PlanTier } from '@/lib/plan-enforcer';
import ResponseLibrary from './_components/ResponseLibrary';

export default async function AIResponsesPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) redirect('/login');

  const supabase = await createClient();

  const { data: orgData } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', ctx.orgId)
    .single();

  const plan = (orgData?.plan as string) ?? 'trial';
  const canView = canRunSovEvaluation(plan as PlanTier);

  if (!canView) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-white">AI Says</h1>
          <p className="mt-0.5 text-sm text-[#94A3B8]">
            See the exact words AI engines use when describing your business.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl bg-surface-dark px-6 py-16 text-center border border-white/5">
          <p className="text-sm font-medium text-[#94A3B8]">
            Upgrade to Growth to see how AI describes your business.
          </p>
          <a
            href="/dashboard/billing"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-signal-green px-4 py-2 text-sm font-medium text-deep-navy transition hover:brightness-110"
          >
            Upgrade Plan
          </a>
        </div>
      </div>
    );
  }

  // Sprint 100: location-scoped AI responses
  const activeLocationId = await getActiveLocationId(supabase, ctx.orgId);
  const entries = await fetchAIResponses(ctx.orgId, supabase, activeLocationId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">AI Says</h1>
        <p className="mt-0.5 text-sm text-[#94A3B8]">
          The exact words AI engines use when asked about your business. Screenshot these, share them with your team.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-surface-dark px-6 py-16 text-center border border-white/5">
          <p className="text-sm font-medium text-[#94A3B8]">No AI responses yet</p>
          <p className="mt-1 text-xs text-slate-400">
            Run SOV evaluations on your queries first. AI responses will appear here.
          </p>
          <a
            href="/dashboard/share-of-voice"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-surface-dark px-4 py-2 text-sm font-medium text-white transition hover:bg-white/5"
          >
            Go to Share of Voice →
          </a>
        </div>
      ) : (
        <ResponseLibrary entries={entries} />
      )}
    </div>
  );
}
