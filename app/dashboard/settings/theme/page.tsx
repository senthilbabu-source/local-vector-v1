/**
 * Theme Settings Page — Sprint 115
 *
 * Server Component. Fetches current theme and renders the editor.
 * Plan gate: non-Agency users see upgrade prompt.
 */

import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { canCustomizeTheme } from '@/lib/plan-enforcer';
import type { PlanTier } from '@/lib/plan-enforcer';
import { getOrgThemeOrDefault } from '@/lib/whitelabel/theme-service';
import ThemeEditorForm from './_components/ThemeEditorForm';

export const metadata = { title: 'Theme | LocalVector.ai' };

export default async function ThemeSettingsPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) {
    redirect('/login');
  }

  const plan = (ctx.plan ?? 'trial') as PlanTier;

  // Non-Agency: show upgrade prompt
  if (!canCustomizeTheme(plan)) {
    return (
      <div className="max-w-2xl space-y-5" data-testid="upgrade-prompt">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Brand Theme</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Customize your brand&apos;s look and feel across the dashboard, emails, and login page.
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#0A1628] p-8 text-center">
          <p className="text-slate-300 mb-4">
            Brand theming is available on the Agency plan.
          </p>
          <a
            href="/dashboard/billing"
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Upgrade to Agency
          </a>
        </div>
      </div>
    );
  }

  // Fetch current theme
  const supabase = await createClient();
  const theme = await getOrgThemeOrDefault(supabase, ctx.orgId!);
  const orgName = ctx.orgName ?? 'My Organization';

  return (
    <div className="max-w-5xl space-y-5" data-testid="theme-settings-page">
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">Brand Theme</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Customize your brand&apos;s look and feel across the dashboard, emails, and login page.
        </p>
      </div>

      <ThemeEditorForm
        initialTheme={theme}
        orgName={orgName}
      />
    </div>
  );
}
