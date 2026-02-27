'use client';

// ---------------------------------------------------------------------------
// SettingsForm — five-section client form for Settings page.
//
// Sections:
//   1. Account        — displayName (editable), email (read-only)
//   2. Security       — new password + confirm password + forgot password link
//   3. Organization   — org name (read-only), plan chip, billing link
//   4. Notifications  — 3 toggle switches (Sprint 62)
//   5. Danger Zone    — delete organization modal (Sprint 62)
//
// Uses useTransition for non-blocking server action calls.
// Password form is reset on success via ref.
// ---------------------------------------------------------------------------

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { updateDisplayName, changePassword, updateNotificationPrefs } from '../actions';
import DeleteOrgModal from './DeleteOrgModal';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NotifyPrefs {
  notify_hallucination_alerts: boolean;
  notify_weekly_digest:        boolean;
  notify_sov_alerts:           boolean;
}

interface SettingsFormProps {
  displayName: string;
  email:       string;
  orgName:     string;
  plan:        string | null;
  notifyPrefs: NotifyPrefs;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  growth:  'Growth',
  agency:  'Agency',
};

// ---------------------------------------------------------------------------
// Toggle component
// ---------------------------------------------------------------------------

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  description: string;
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

export default function SettingsForm({ displayName, email, orgName, plan, notifyPrefs }: SettingsFormProps) {
  const [nameStatus, setNameStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [pwStatus,   setPwStatus]   = useState<{ success: boolean; message: string } | null>(null);
  const [notifyStatus, setNotifyStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [nameIsPending, startNameTransition] = useTransition();
  const [pwIsPending,   startPwTransition]   = useTransition();
  const [notifyIsPending, startNotifyTransition] = useTransition();

  const pwFormRef = useRef<HTMLFormElement>(null);

  // Notification toggle state
  const [hallAlerts, setHallAlerts] = useState(notifyPrefs.notify_hallucination_alerts);
  const [weeklyDigest, setWeeklyDigest] = useState(notifyPrefs.notify_weekly_digest);
  const [sovAlerts, setSovAlerts] = useState(notifyPrefs.notify_sov_alerts);

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
    startNotifyTransition(async () => {
      const result = await updateNotificationPrefs(form);
      setNotifyStatus(
        result.success
          ? { success: true,  message: 'Notification preferences saved' }
          : { success: false, message: result.error }
      );
    });
  }

  const planLabel = plan ? (PLAN_LABELS[plan] ?? plan) : 'Free';

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
            {nameIsPending ? 'Saving…' : 'Save changes'}
          </button>
        </form>
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
              {pwIsPending ? 'Updating…' : 'Update password'}
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
          <div className="pt-2 border-t border-white/5">
            <Link
              href="/dashboard/settings/business-info"
              className="text-xs font-medium text-signal-green hover:underline"
            >
              Edit business information &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ── Section 4: Notifications (Sprint 62) ──────────────────── */}
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
        </div>

        {notifyStatus && (
          <p className={`text-xs mt-3 ${notifyStatus.success ? 'text-signal-green' : 'text-alert-crimson'}`}>
            {notifyStatus.message}
          </p>
        )}

        <button
          type="button"
          onClick={handleNotifySave}
          disabled={notifyIsPending}
          className="mt-4 rounded-xl bg-signal-green px-4 py-2 text-sm font-semibold text-deep-navy hover:bg-signal-green/90 disabled:opacity-60 transition"
        >
          {notifyIsPending ? 'Saving…' : 'Save preferences'}
        </button>
      </section>

      {/* ── Section 5: Danger Zone (Sprint 62) ────────────────────── */}
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
