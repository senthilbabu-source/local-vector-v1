// ---------------------------------------------------------------------------
// app/dashboard/playbooks/page.tsx — Per-Engine Optimization Playbooks (Sprint 134)
//
// Agency-only page showing engine-specific optimization recommendations.
// Reads from locations.playbook_cache.
// AI_RULES §167
// ---------------------------------------------------------------------------

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { canViewPlaybooks } from '@/lib/plan-enforcer';
import type { PlanTier } from '@/lib/plan-enforcer';
import { getActiveLocationId } from '@/lib/location/active-location';
import PlaybooksPageClient from './PlaybooksPageClient';
import type { Playbook } from '@/lib/playbooks/playbook-types';

export default async function PlaybooksPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) redirect('/login');

  const planTier = (ctx.plan ?? 'trial') as PlanTier;

  // ── Plan gate ───────────────────────────────────────────────────────
  if (!canViewPlaybooks(planTier)) {
    return (
      <div data-testid="playbooks-page" className="max-w-3xl space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">
            How to Get Found by Each AI
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Simple steps to improve how each AI app talks about your business.
          </p>
        </div>
        <div
          data-testid="upgrade-prompt"
          className="rounded-2xl border border-white/5 bg-surface-dark p-8 text-center space-y-3"
        >
          <p className="text-sm text-slate-300">
            How to Get Found by Each AI is available on the Agency plan.
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

  // ── Fetch cached playbooks ──────────────────────────────────────────
  const supabase = await createClient();
  const locationId = await getActiveLocationId(supabase, ctx.orgId!) as string | null;

  if (!locationId) {
    return (
      <div data-testid="playbooks-page" className="max-w-3xl space-y-5">
        <h1 className="text-xl font-semibold text-white tracking-tight">
          How to Get Found by Each AI
        </h1>
        <p className="text-sm text-slate-400">
          No active location found. Add a location first.
        </p>
      </div>
    );
  }

  const { data: location } = await (supabase
    .from('locations') as any)
    .select('playbook_cache, playbook_generated_at')
    .eq('id', locationId)
    .single() as { data: { playbook_cache: Record<string, Playbook> | null; playbook_generated_at: string | null } | null };

  const cache = location?.playbook_cache ?? null;
  const generatedAt = location?.playbook_generated_at ?? null;

  return (
    <PlaybooksPageClient
      playbooks={cache ?? {}}
      generatedAt={generatedAt}
    />
  );
}
