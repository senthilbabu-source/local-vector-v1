import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import SettingsForm from './_components/SettingsForm';

// ---------------------------------------------------------------------------
// SettingsPage — Server Component (Sprint 24B + Sprint 62 notification prefs)
//
// Fetches user identity from getSafeAuthContext() and notification prefs
// from the organizations table. Pre-fills the form with both.
// ---------------------------------------------------------------------------

export default async function SettingsPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) {
    redirect('/login');
  }

  const displayName = ctx.fullName ?? ctx.email.split('@')[0];

  // Fetch notification preferences
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const { data: org } = await supabase
    .from('organizations')
    .select('notify_hallucination_alerts, notify_weekly_digest, notify_sov_alerts')
    .eq('id', ctx.orgId)
    .maybeSingle();

  const notifyPrefs = {
    notify_hallucination_alerts: org?.notify_hallucination_alerts ?? true,
    notify_weekly_digest:        org?.notify_weekly_digest ?? true,
    notify_sov_alerts:           org?.notify_sov_alerts ?? true,
  };

  return (
    <div className="max-w-2xl space-y-5">

      {/* ── Page header ───────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">Settings</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Manage your account, security, and organization preferences.
        </p>
      </div>

      <SettingsForm
        displayName={displayName}
        email={ctx.email}
        orgName={ctx.orgName ?? '—'}
        plan={ctx.plan}
        notifyPrefs={notifyPrefs}
      />

    </div>
  );
}
