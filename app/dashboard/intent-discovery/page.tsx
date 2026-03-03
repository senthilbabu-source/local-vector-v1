// ---------------------------------------------------------------------------
// app/dashboard/intent-discovery/page.tsx — Intent Discovery (Sprint 135)
//
// Agency-only page showing discovered intent gaps and content brief generation.
// AI_RULES §168
// ---------------------------------------------------------------------------

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { canRunIntentDiscovery } from '@/lib/plan-enforcer';
import type { PlanTier } from '@/lib/plan-enforcer';
import { getActiveLocationId } from '@/lib/location/active-location';
import IntentDiscoveryClient from './IntentDiscoveryClient';

export default async function IntentDiscoveryPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) redirect('/login');

  const planTier = (ctx.plan ?? 'trial') as PlanTier;

  // ── Plan gate ───────────────────────────────────────────────────────
  if (!canRunIntentDiscovery(planTier)) {
    return (
      <div
        data-testid="intent-discovery-page"
        className="max-w-3xl space-y-5"
      >
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">
            Intent Discovery
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Find prompts real customers ask that your business is missing.
          </p>
        </div>
        <div
          data-testid="upgrade-prompt"
          className="rounded-2xl border border-white/5 bg-surface-dark p-8 text-center space-y-3"
        >
          <p className="text-sm text-slate-300">
            Intent Discovery is available on the Agency plan.
          </p>
          <Link
            href="/dashboard/billing"
            className="inline-block rounded-xl bg-electric-indigo px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-electric-indigo/90"
          >
            Upgrade to Agency
          </Link>
        </div>
      </div>
    );
  }

  // ── Fetch latest discoveries ────────────────────────────────────────
  const supabase = await createClient();
  const locationId = await getActiveLocationId(supabase, ctx.orgId!) as string | null;

  if (!locationId) {
    return (
      <div
        data-testid="intent-discovery-page"
        className="max-w-3xl space-y-5"
      >
        <h1 className="text-xl font-semibold text-white tracking-tight">
          Intent Discovery
        </h1>
        <p className="text-sm text-slate-400">
          No active location found. Add a location first.
        </p>
      </div>
    );
  }

  // Get the latest run_id
  const { data: latestRun } = await (supabase
    .from('intent_discoveries' as any) as any)
    .select('run_id, discovered_at')
    .eq('org_id', ctx.orgId)
    .order('discovered_at', { ascending: false })
    .limit(1)
    .single() as { data: { run_id: string; discovered_at: string } | null };

  let gaps: Array<{
    id: string;
    prompt: string;
    theme: string;
    competitors_cited: string[];
    opportunity_score: number;
    brief_created: boolean;
  }> = [];

  let coveredCount = 0;

  if (latestRun) {
    const { data: discoveries } = await (supabase
      .from('intent_discoveries' as any) as any)
      .select(
        'id, prompt, theme, client_cited, competitors_cited, opportunity_score, brief_created',
      )
      .eq('run_id', latestRun.run_id)
      .order('opportunity_score', { ascending: false }) as {
        data: Array<{
          id: string;
          prompt: string;
          theme: string;
          client_cited: boolean;
          competitors_cited: string[] | null;
          opportunity_score: number;
          brief_created: boolean;
        }> | null;
      };

    if (discoveries) {
      gaps = discoveries
        .filter((d) => !d.client_cited)
        .map((d) => ({
          id: d.id,
          prompt: d.prompt,
          theme: d.theme,
          competitors_cited: d.competitors_cited ?? [],
          opportunity_score: d.opportunity_score,
          brief_created: d.brief_created,
        }));
      coveredCount = discoveries.filter((d) => d.client_cited).length;
    }
  }

  return (
    <IntentDiscoveryClient
      gaps={gaps}
      coveredCount={coveredCount}
      latestRunDate={latestRun?.discovered_at ?? null}
      diminishingReturns={gaps.length < 5}
    />
  );
}
