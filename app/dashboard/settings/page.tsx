import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import SettingsForm from './_components/SettingsForm';
import NotificationSettings from './_components/NotificationSettings';
import ScanFrequencySettings from './_components/ScanFrequencySettings';
import ApiKeySettings from './_components/ApiKeySettings';
import DangerZoneSettings from './_components/DangerZoneSettings';
import DigestPreferencesForm from './_components/DigestPreferencesForm';
import GoalSettingsForm from './_components/GoalSettingsForm';
import { getOrCreateOrgSettings } from '@/lib/settings';
import type { OrgSettings } from '@/lib/settings/types';
import { DEFAULT_DIGEST_PREFERENCES, type DigestPreferences } from '@/lib/services/digest-preferences';
import type { ScoreGoal } from '@/lib/services/goal-tracker';
import { canManageApiKeys, type PlanTier } from '@/lib/plan-enforcer';
import { saveDigestPreferences } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings | LocalVector.ai' };

// ---------------------------------------------------------------------------
// SettingsPage — Server Component (Sprint 24B + Sprint 62 + Sprint 121)
//
// Fetches user identity from getSafeAuthContext() and notification prefs
// from the organizations table. Pre-fills the form with both.
// Sprint 121: Added org_settings fetch + 4 new sections.
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
        .select('notify_hallucination_alerts, notify_weekly_digest, notify_sov_alerts, monitored_ai_models, score_drop_threshold, webhook_url, scan_day_of_week, notify_score_drop_alert, notify_new_competitor, slug' as '*')
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

  // Sprint 121: Fetch org_settings
  let orgSettings: OrgSettings | null = null;
  if (ctx.orgId) {
    try {
      orgSettings = await getOrCreateOrgSettings(supabase, ctx.orgId);
    } catch (_err) {
      // Non-critical — show defaults in components
    }
  }

  const orgData = org as Record<string, unknown> | null;
  const orgSlug = (orgData?.slug as string) ?? '';

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

      {/* ── Sprint 121: New Settings Sections ─────────────────────── */}
      {orgSettings && (
        <>
          <div className="border-t border-white/5 pt-5">
            <NotificationSettings settings={orgSettings} />
          </div>

          {/* ── S65: Digest Email Preferences ──────────────────────────── */}
          <div className="border-t border-white/5 pt-5">
            <DigestPreferencesForm
              initialPreferences={
                (orgSettings as Record<string, unknown>)?.digest_preferences as DigestPreferences ?? DEFAULT_DIGEST_PREFERENCES
              }
              onSave={saveDigestPreferences}
            />
          </div>

          {/* ── S71: Score Goal ────────────────────────────────────────── */}
          <div className="border-t border-white/5 pt-5">
            <GoalSettingsForm
              initialGoal={
                (orgSettings as Record<string, unknown>)?.score_goal as ScoreGoal | null ?? null
              }
            />
          </div>

          <div className="border-t border-white/5 pt-5">
            <ScanFrequencySettings currentFrequency={orgSettings.scan_frequency} />
          </div>

          <div className="border-t border-white/5 pt-5">
            <ApiKeySettings isAgencyPlan={canManageApiKeys((ctx.plan ?? 'trial') as PlanTier)} />
          </div>
        </>
      )}

      <div className="border-t border-white/5 pt-5">
        <DangerZoneSettings
          orgSlug={orgSlug}
          isOwner={ctx.role === 'owner'}
        />
      </div>

    </div>
  );
}
