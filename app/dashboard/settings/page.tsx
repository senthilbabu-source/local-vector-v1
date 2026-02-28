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

  // Fetch notification + Sprint B expanded preferences
  const supabase = await createClient();
  const { data: org } = ctx.orgId
    ? await supabase
        .from('organizations')
        .select('notify_hallucination_alerts, notify_weekly_digest, notify_sov_alerts, monitored_ai_models, score_drop_threshold, webhook_url')
        .eq('id', ctx.orgId)
        .maybeSingle()
    : { data: null };

  const notifyPrefs = {
    notify_hallucination_alerts: org?.notify_hallucination_alerts ?? true,
    notify_weekly_digest:        org?.notify_weekly_digest ?? true,
    notify_sov_alerts:           org?.notify_sov_alerts ?? true,
  };

  const expandedPrefs = {
    monitored_ai_models: (org?.monitored_ai_models as string[] | null) ?? ['openai', 'perplexity', 'gemini', 'copilot'],
    score_drop_threshold: (org?.score_drop_threshold as number | null) ?? 10,
    webhook_url: (org?.webhook_url as string | null) ?? '',
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
        expandedPrefs={expandedPrefs}
      />

    </div>
  );
}
