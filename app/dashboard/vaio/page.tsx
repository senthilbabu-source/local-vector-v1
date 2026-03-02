// ---------------------------------------------------------------------------
// Voice Readiness (VAIO) — Full dashboard page
//
// Sprint 109: Voice & Conversational AI Optimization
// ---------------------------------------------------------------------------

import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { canRunVAIO } from '@/lib/plan-enforcer';
import type { PlanTier } from '@/lib/plan-enforcer';
import VAIOPageClient from './VAIOPageClient';

export default async function VAIOPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx || !ctx.orgId) redirect('/login');

  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', ctx.orgId)
    .single();

  const planTier = (org?.plan ?? 'trial') as PlanTier;

  if (!canRunVAIO(planTier)) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h2 className="mb-2 text-lg font-semibold text-white">Voice Readiness</h2>
          <p className="text-sm text-slate-400">
            Upgrade to Growth or Agency plan to unlock voice search optimization,
            llms.txt generation, and AI crawler audits.
          </p>
        </div>
      </div>
    );
  }

  return <VAIOPageClient />;
}
