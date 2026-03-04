import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { canManageTeamSeats } from '@/lib/plan-enforcer';
import type { PlanTier } from '@/lib/plan-enforcer';
import { getDomainConfig } from '@/lib/whitelabel/domain-service';
import { SUBDOMAIN_BASE } from '@/lib/whitelabel/types';
import DomainConfigForm from './_components/DomainConfigForm';
import Link from 'next/link';

export const metadata = { title: 'Domain | LocalVector.ai' };

/**
 * Domain Settings Page — Sprint 114
 *
 * Server component. Agency plan only — others see upgrade prompt.
 * Shows subdomain (always active) + custom domain configuration.
 */

export default async function DomainSettingsPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) {
    redirect('/login');
  }

  const planTier = (ctx.plan ?? 'trial') as PlanTier;
  const isAgency = canManageTeamSeats(planTier);

  // Non-Agency: upgrade prompt
  if (!isAgency) {
    return (
      <div data-testid="domain-settings-page" className="max-w-2xl space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Domain Settings</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Configure a custom domain for your LocalVector dashboard.
          </p>
        </div>

        <div data-testid="upgrade-prompt" className="rounded-2xl border border-white/5 bg-surface-dark p-8 text-center space-y-3">
          <p className="text-sm text-slate-300">
            Custom domain routing is available on the Agency plan.
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

  // Agency: fetch domain config
  const supabase = createServiceRoleClient();
  const config = await getDomainConfig(supabase, ctx.orgId!);

  return (
    <div data-testid="domain-settings-page" className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">Domain Settings</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Configure how your team accesses LocalVector.
        </p>
      </div>

      {/* Subdomain — always active */}
      <div className="rounded-2xl border border-white/5 bg-surface-dark p-6 space-y-3">
        <h3 className="text-sm font-semibold text-white">Your Subdomain (Always Active)</h3>
        <p data-testid="subdomain-display" className="rounded-lg bg-deep-navy/50 px-3 py-2 text-sm text-electric-indigo font-mono">
          https://{config.subdomain}.{SUBDOMAIN_BASE}
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-truth-emerald/20 bg-truth-emerald/10 px-2.5 py-0.5 text-xs font-medium text-truth-emerald">
          Active
        </span>
      </div>

      {/* Custom domain configuration */}
      <div className="rounded-2xl border border-white/5 bg-surface-dark p-6">
        <DomainConfigForm initialCustomDomain={config.custom_domain} />
      </div>
    </div>
  );
}
