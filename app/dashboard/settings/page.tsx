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

  // Fetch notification + Sprint B expanded preferences + Sprint N additions
  const supabase = await createClient();
  const { data: org } = ctx.orgId
    ? await supabase
        .from('organizations')
        .select('notify_hallucination_alerts, notify_weekly_digest, notify_sov_alerts, monitored_ai_models, score_drop_threshold, webhook_url, scan_day_of_week, notify_score_drop_alert, notify_new_competitor' as '*')
        .eq('id', ctx.orgId)
        .maybeSingle()
    : { data: null };

  // Sprint N: Competitor count for shortcut section
  const competitorCount = ctx.orgId
    ? ((await supabase
        .from('competitors')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', ctx.orgId)).count ?? 0)
    : 0;

  const orgData = org as Record<string, unknown> | null;

  const notifyPrefs = {
    notify_hallucination_alerts: (orgData?.notify_hallucination_alerts as boolean | null) ?? true,
    notify_weekly_digest:        (orgData?.notify_weekly_digest as boolean | null) ?? true,
    notify_sov_alerts:           (orgData?.notify_sov_alerts as boolean | null) ?? true,
    notify_score_drop_alert:     (orgData?.notify_score_drop_alert as boolean | null) ?? true,
    notify_new_competitor:       (orgData?.notify_new_competitor as boolean | null) ?? false,
  };

  const expandedPrefs = {
    monitored_ai_models: (orgData?.monitored_ai_models as string[] | null) ?? ['openai', 'perplexity', 'gemini', 'copilot'],
    score_drop_threshold: (orgData?.score_drop_threshold as number | null) ?? 10,
    webhook_url: (orgData?.webhook_url as string | null) ?? '',
    scan_day_of_week: (orgData?.scan_day_of_week as number | null) ?? 0,
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
        competitorCount={competitorCount}
      />

    </div>
  );
}
