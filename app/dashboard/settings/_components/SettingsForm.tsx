'use client';

// ---------------------------------------------------------------------------
// SettingsForm — Settings page client form.
//
// Sections:
//   1. Account        — displayName (editable), email (read-only)
//   2. Security       — new password + confirm password + forgot password link
//   3. Organization   — org name (read-only), plan chip, billing link
//   4. AI Monitoring  — model toggle switches (Sprint B)
//   5. Notifications  — 3 toggle switches + score drop threshold (Sprint 62 + B)
//   6. Webhooks       — webhook URL for agency plan (Sprint B)
//   7. Danger Zone    — delete organization modal (Sprint 62)
//
// Uses useTransition for non-blocking server action calls.
// ---------------------------------------------------------------------------

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  updateDisplayName,
  changePassword,
  updateNotificationPrefs,
  updateAIMonitoringPrefs,
  updateAdvancedPrefs,
} from '../actions';
import DeleteOrgModal from './DeleteOrgModal';
import { getPlanDisplayName } from '@/lib/plan-display-names';
import { UpgradePlanPrompt } from '@/components/ui/UpgradePlanPrompt';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NotifyPrefs {
  notify_hallucination_alerts: boolean;
  notify_weekly_digest:        boolean;
  notify_sov_alerts:           boolean;
  notify_score_drop_alert:     boolean;
  notify_new_competitor:       boolean;
}

interface ExpandedPrefs {
  monitored_ai_models:  string[];
  score_drop_threshold: number;
  webhook_url:          string;
  scan_day_of_week:     number;
}

interface SettingsFormProps {
  displayName:     string;
  email:           string;
  orgName:         string;
  plan:            string | null;
  notifyPrefs:     NotifyPrefs;
  expandedPrefs:   ExpandedPrefs;
  competitorCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AI_MODELS = [
  { id: 'openai',     label: 'ChatGPT (OpenAI)',   description: 'GPT-4o and o1 responses' },
  { id: 'perplexity', label: 'Perplexity',         description: 'Real-time web-grounded answers' },
  { id: 'gemini',     label: 'Google Gemini',       description: 'Gemini 2.0 Flash responses' },
  { id: 'copilot',    label: 'Microsoft Copilot',   description: 'Copilot and Bing AI responses' },
  { id: 'claude',     label: 'Claude (Anthropic)',   description: 'Claude Sonnet responses' },
] as const;

const SCAN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

const TOUR_STORAGE_KEY = 'lv_tour_completed';

// ---------------------------------------------------------------------------
// Toggle component
// ---------------------------------------------------------------------------

function Toggle({
  checked,
  onChange,
  label,
  description,
  testId,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  description: string;
  testId?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        data-testid={testId}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          checked ? 'bg-signal-green' : 'bg-slate-700'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SettingsForm
// ---------------------------------------------------------------------------

export default function SettingsForm({ displayName, email, orgName, plan, notifyPrefs, expandedPrefs, competitorCount }: SettingsFormProps) {
  const [nameStatus, setNameStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [pwStatus,   setPwStatus]   = useState<{ success: boolean; message: string } | null>(null);
  const [notifyStatus, setNotifyStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [modelStatus, setModelStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [advancedStatus, setAdvancedStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [nameIsPending, startNameTransition] = useTransition();
  const [pwIsPending,   startPwTransition]   = useTransition();
  const [notifyIsPending, startNotifyTransition] = useTransition();
  const [modelIsPending, startModelTransition] = useTransition();
  const [advancedIsPending, startAdvancedTransition] = useTransition();

  const pwFormRef = useRef<HTMLFormElement>(null);

  // Notification toggle state
  const [hallAlerts, setHallAlerts] = useState(notifyPrefs.notify_hallucination_alerts);
  const [weeklyDigest, setWeeklyDigest] = useState(notifyPrefs.notify_weekly_digest);
  const [sovAlerts, setSovAlerts] = useState(notifyPrefs.notify_sov_alerts);
  const [scoreDropAlert, setScoreDropAlert] = useState(notifyPrefs.notify_score_drop_alert);
  const [newCompetitorAlert, setNewCompetitorAlert] = useState(notifyPrefs.notify_new_competitor);

  // Sprint B: AI Monitoring state
  const [monitoredModels, setMonitoredModels] = useState<string[]>(expandedPrefs.monitored_ai_models);
  const [scanDayOfWeek, setScanDayOfWeek] = useState(expandedPrefs.scan_day_of_week);

  // Sprint B: Advanced prefs state
  const [scoreDropThreshold, setScoreDropThreshold] = useState(expandedPrefs.score_drop_threshold);
  const [webhookUrl, setWebhookUrl] = useState(expandedPrefs.webhook_url);

  const isAgency = plan === 'agency';
  const planLabel = getPlanDisplayName(plan);

  function toggleModel(modelId: string, checked: boolean) {
    setMonitoredModels((prev) =>
      checked ? [...prev, modelId] : prev.filter((m) => m !== modelId)
    );
  }

  async function handleNameSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startNameTransition(async () => {
      const result = await updateDisplayName(form);
      setNameStatus(
        result.success
          ? { success: true,  message: 'Display name updated' }
          : { success: false, message: result.error }
      );
    });
  }

  async function handlePwSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startPwTransition(async () => {
      const result = await changePassword(form);
      if (result.success) {
        setPwStatus({ success: true, message: 'Password updated' });
        pwFormRef.current?.reset();
      } else {
        setPwStatus({ success: false, message: result.error });
      }
    });
  }

  function handleNotifySave() {
    setNotifyStatus(null);
    const form = new FormData();
    form.set('notify_hallucination_alerts', String(hallAlerts));
    form.set('notify_weekly_digest', String(weeklyDigest));
    form.set('notify_sov_alerts', String(sovAlerts));
    form.set('notify_score_drop_alert', String(scoreDropAlert));
    form.set('notify_new_competitor', String(newCompetitorAlert));
    startNotifyTransition(async () => {
      const result = await updateNotificationPrefs(form);
      setNotifyStatus(
        result.success
          ? { success: true,  message: 'Notification preferences saved' }
          : { success: false, message: result.error }
      );
    });
  }

  function handleModelSave() {
    setModelStatus(null);
    const form = new FormData();
    form.set('monitored_ai_models', JSON.stringify(monitoredModels));
    form.set('scan_day_of_week', String(scanDayOfWeek));
    startModelTransition(async () => {
      const result = await updateAIMonitoringPrefs(form);
      setModelStatus(
        result.success
          ? { success: true,  message: 'AI monitoring preferences saved' }
          : { success: false, message: result.error }
      );
    });
  }

  function handleAdvancedSave() {
    setAdvancedStatus(null);
    const form = new FormData();
    form.set('score_drop_threshold', String(scoreDropThreshold));
    form.set('webhook_url', webhookUrl);
    startAdvancedTransition(async () => {
      const result = await updateAdvancedPrefs(form);
      setAdvancedStatus(
        result.success
          ? { success: true,  message: 'Settings saved' }
          : { success: false, message: result.error }
      );
    });
  }

  function handleRestartTour() {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    window.location.reload();
  }

  return (
    <div className="space-y-6">

      {/* ── Section 1: Account ──────────────────────────────────────── */}
      <section className="rounded-2xl bg-surface-dark border border-white/5 p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Account</h2>
        <form onSubmit={handleNameSubmit} className="space-y-4">
          <div>
            <label htmlFor="displayName" className="block text-xs font-medium text-slate-400 mb-1.5">
              Display Name
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              defaultValue={displayName}
              minLength={2}
              maxLength={80}
              required
              className="w-full rounded-xl bg-midnight-slate border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-signal-green"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 mb-1.5">Email</p>
            <p className="text-sm text-slate-400">{email}</p>
          </div>

          {nameStatus && (
            <p className={`text-xs ${nameStatus.success ? 'text-signal-green' : 'text-alert-crimson'}`}>
              {nameStatus.message}
            </p>
          )}

          <button
            type="submit"
            disabled={nameIsPending}
            className="rounded-xl bg-signal-green px-4 py-2 text-sm font-semibold text-deep-navy hover:bg-signal-green/90 disabled:opacity-60 transition"
          >
            {nameIsPending ? 'Saving\u2026' : 'Save changes'}
          </button>
        </form>

        {/* Restart Tour (Sprint B) */}
        <div className="flex items-center justify-between py-2 border-t border-white/5 mt-4 pt-4">
          <div>
            <p className="text-sm font-medium text-white">Product Tour</p>
            <p className="text-xs text-slate-500">Re-run the guided tour of LocalVector&apos;s key features.</p>
          </div>
          <button
            type="button"
            onClick={handleRestartTour}
            className="rounded-xl border border-white/10 bg-surface-dark px-3 py-1.5 text-sm text-slate-300 hover:bg-midnight-slate transition"
            data-testid="restart-tour-btn"
          >
            Restart Tour
          </button>
        </div>
      </section>

      {/* ── Section 2: Security ─────────────────────────────────────── */}
      <section className="rounded-2xl bg-surface-dark border border-white/5 p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Security</h2>
        <form ref={pwFormRef} onSubmit={handlePwSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-xs font-medium text-slate-400 mb-1.5">
              New Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              minLength={8}
              required
              className="w-full rounded-xl bg-midnight-slate border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-signal-green"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-medium text-slate-400 mb-1.5">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              minLength={8}
              required
              className="w-full rounded-xl bg-midnight-slate border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-signal-green"
            />
          </div>

          {pwStatus && (
            <p className={`text-xs ${pwStatus.success ? 'text-signal-green' : 'text-alert-crimson'}`}>
              {pwStatus.message}
            </p>
          )}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={pwIsPending}
              className="rounded-xl bg-signal-green px-4 py-2 text-sm font-semibold text-deep-navy hover:bg-signal-green/90 disabled:opacity-60 transition"
            >
              {pwIsPending ? 'Updating\u2026' : 'Update password'}
            </button>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-slate-400 hover:text-signal-green transition"
            >
              Forgot password?
            </Link>
          </div>
        </form>
      </section>

      {/* ── Section 3: Organization ─────────────────────────────────── */}
      <section className="rounded-2xl bg-surface-dark border border-white/5 p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Organization</h2>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-slate-400 mb-1.5">Organization Name</p>
            <p className="text-sm text-slate-300">{orgName}</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1.5">Plan</p>
              <span className="inline-flex items-center rounded-md bg-signal-green/15 px-2 py-0.5 text-xs font-semibold text-signal-green">
                {planLabel}
              </span>
            </div>
            <Link
              href="/dashboard/billing"
              className="text-xs font-medium text-signal-green hover:underline"
            >
              Manage billing &rarr;
            </Link>
          </div>
          <div className="pt-2 border-t border-white/5 space-y-2">
            <Link
              href="/dashboard/settings/business-info"
              className="block text-xs font-medium text-signal-green hover:underline"
            >
              Edit business information &rarr;
            </Link>
            <Link
              data-testid="settings-team-tab"
              href="/dashboard/settings/team"
              className="block text-xs font-medium text-signal-green hover:underline"
            >
              Manage team members &rarr;
            </Link>
            <Link
              data-testid="settings-locations-tab"
              href="/dashboard/settings/locations"
              className="block text-xs font-medium text-signal-green hover:underline"
            >
              Manage locations &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ── Section 4: AI Monitoring (Sprint B) ──────────────────────── */}
      <section className="rounded-2xl bg-surface-dark border border-white/5 p-6">
        <h2 className="text-sm font-semibold text-white mb-1">AI Monitoring</h2>
        <p className="text-xs text-slate-500 mb-4">Choose which AI models LocalVector tracks for your business.</p>
        <div className="divide-y divide-white/5">
          {AI_MODELS.map((model) => (
            <Toggle
              key={model.id}
              checked={monitoredModels.includes(model.id)}
              onChange={(checked) => toggleModel(model.id, checked)}
              label={model.label}
              description={model.description}
              testId={`model-toggle-${model.id}`}
            />
          ))}
        </div>

        {/* Sprint N: Scan day preference */}
        <div className="flex items-center justify-between py-3 border-t border-white/5 mt-2 pt-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-white">Weekly scan day</p>
            <p className="text-xs text-slate-500">
              Your Reality Score updates the morning after this day&apos;s scan completes.
            </p>
          </div>
          <select
            value={scanDayOfWeek}
            onChange={(e) => setScanDayOfWeek(Number(e.target.value))}
            className="rounded-xl border border-white/10 bg-midnight-slate px-3 py-1.5 text-sm text-white"
            data-testid="scan-day-select"
          >
            {SCAN_DAYS.map((day, i) => (
              <option key={day} value={i}>{day}</option>
            ))}
          </select>
        </div>

        {modelStatus && (
          <p className={`text-xs mt-3 ${modelStatus.success ? 'text-signal-green' : 'text-alert-crimson'}`}>
            {modelStatus.message}
          </p>
        )}

        <button
          type="button"
          onClick={handleModelSave}
          disabled={modelIsPending}
          className="mt-4 rounded-xl bg-signal-green px-4 py-2 text-sm font-semibold text-deep-navy hover:bg-signal-green/90 disabled:opacity-60 transition"
        >
          {modelIsPending ? 'Saving\u2026' : 'Save model preferences'}
        </button>
      </section>

      {/* ── Section 5: Notifications (Sprint 62 + Sprint B score drop) ── */}
      <section className="rounded-2xl bg-surface-dark border border-white/5 p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Notifications</h2>
        <div className="divide-y divide-white/5">
          <Toggle
            checked={hallAlerts}
            onChange={setHallAlerts}
            label="Hallucination alerts"
            description="Get emailed when AI says something wrong about your business"
          />
          <Toggle
            checked={weeklyDigest}
            onChange={setWeeklyDigest}
            label="Weekly digest"
            description="Weekly summary of your AI visibility performance"
          />
          <Toggle
            checked={sovAlerts}
            onChange={setSovAlerts}
            label="Share of Voice alerts"
            description="Get notified about significant changes in your AI share of voice"
          />
          <Toggle
            checked={scoreDropAlert}
            onChange={setScoreDropAlert}
            label="Reality Score drops"
            description="Alert when your Reality Score drops by the threshold set below"
            testId="toggle-score-drop-alert"
          />
          <Toggle
            checked={newCompetitorAlert}
            onChange={setNewCompetitorAlert}
            label="New competitor detected"
            description="Alert when a new competitor appears in your AI visibility results"
            testId="toggle-new-competitor"
          />
        </div>

        {/* Sprint B: Score Drop Threshold */}
        <div className="flex items-center justify-between py-3 border-t border-white/5 mt-2 pt-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-white">Reality Score Drop Alert</p>
            <p className="text-xs text-slate-500">
              Send an alert if your Reality Score drops by this many points between weekly scans.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={scoreDropThreshold}
              onChange={(e) => setScoreDropThreshold(Number(e.target.value))}
              className="rounded-xl border border-white/10 bg-midnight-slate px-2 py-1 text-sm text-white"
              data-testid="score-drop-threshold"
            >
              <option value={0}>Disabled</option>
              <option value={5}>5 points</option>
              <option value={10}>10 points</option>
              <option value={15}>15 points</option>
              <option value={20}>20 points</option>
            </select>
          </div>
        </div>

        {notifyStatus && (
          <p className={`text-xs mt-3 ${notifyStatus.success ? 'text-signal-green' : 'text-alert-crimson'}`}>
            {notifyStatus.message}
          </p>
        )}

        <button
          type="button"
          onClick={() => { handleNotifySave(); handleAdvancedSave(); }}
          disabled={notifyIsPending || advancedIsPending}
          className="mt-4 rounded-xl bg-signal-green px-4 py-2 text-sm font-semibold text-deep-navy hover:bg-signal-green/90 disabled:opacity-60 transition"
        >
          {notifyIsPending || advancedIsPending ? 'Saving\u2026' : 'Save preferences'}
        </button>
      </section>

      {/* ── Section 6: Webhooks (Sprint B — Agency plan only) ────────── */}
      <section className="rounded-2xl bg-surface-dark border border-white/5 p-6">
        <h2 className="text-sm font-semibold text-white mb-1">Webhooks</h2>
        <p className="text-xs text-slate-500 mb-4">Send alert notifications to an external URL (Slack, Zapier, n8n).</p>
        {isAgency ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5" htmlFor="webhook-url">
                Alert Webhook URL
              </label>
              <input
                id="webhook-url"
                type="url"
                placeholder="https://hooks.slack.com/services/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-midnight-slate px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-signal-green"
                data-testid="webhook-url-input"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                POST requests are sent when a hallucination is detected or your Reality Score drops.
              </p>
            </div>

            {advancedStatus && (
              <p className={`text-xs ${advancedStatus.success ? 'text-signal-green' : 'text-alert-crimson'}`}>
                {advancedStatus.message}
              </p>
            )}

            <button
              type="button"
              onClick={handleAdvancedSave}
              disabled={advancedIsPending}
              className="rounded-xl bg-signal-green px-4 py-2 text-sm font-semibold text-deep-navy hover:bg-signal-green/90 disabled:opacity-60 transition"
            >
              {advancedIsPending ? 'Saving\u2026' : 'Save webhook'}
            </button>
          </div>
        ) : (
          <UpgradePlanPrompt feature="Webhooks" requiredPlan="Brand Fortress" />
        )}
      </section>

      {/* ── Section 7: Competitors (Sprint N) ─────────────────────── */}
      <section className="rounded-2xl bg-surface-dark border border-white/5 p-6">
        <h2 className="text-sm font-semibold text-white mb-1">Competitors</h2>
        <p className="text-xs text-slate-500 mb-4">
          Manage the competitors LocalVector tracks in your AI visibility comparisons.
        </p>
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-white" data-testid="competitor-count">{competitorCount}</span>
            {' '}competitor{competitorCount !== 1 ? 's' : ''} tracked
          </p>
          <Link
            href="/dashboard/compete"
            className="inline-flex items-center gap-1 text-xs font-medium text-signal-green hover:underline transition"
            data-testid="manage-competitors-link"
          >
            Manage competitors &rarr;
          </Link>
        </div>
      </section>

      {/* ── Section 8: Danger Zone (Sprint 62) ────────────────────── */}
      <section className="rounded-2xl border border-alert-crimson/20 p-6">
        <h2 className="text-sm font-semibold text-alert-crimson mb-2">Danger Zone</h2>
        <p className="text-xs text-slate-400 mb-4">
          Permanently delete your organization. This cancels your subscription
          and deactivates all monitoring. Data is retained for 30 days.
        </p>
        <DeleteOrgModal orgName={orgName} />
      </section>

    </div>
  );
}
