'use client';

// ---------------------------------------------------------------------------
// SettingsForm — three-section client form for Sprint 24B Settings page.
//
// Sections:
//   1. Account   — displayName (editable), email (read-only)
//   2. Security  — new password + confirm password
//   3. Organization — org name (read-only), plan chip, billing link
//
// Uses useTransition for non-blocking server action calls.
// Password form is reset on success via ref.
// ---------------------------------------------------------------------------

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { updateDisplayName, changePassword } from '../actions';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SettingsFormProps {
  displayName: string;
  email:       string;
  orgName:     string;
  plan:        string | null;
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
// SettingsForm
// ---------------------------------------------------------------------------

export default function SettingsForm({ displayName, email, orgName, plan }: SettingsFormProps) {
  const [nameStatus, setNameStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [pwStatus,   setPwStatus]   = useState<{ success: boolean; message: string } | null>(null);
  const [nameIsPending, startNameTransition] = useTransition();
  const [pwIsPending,   startPwTransition]   = useTransition();

  const pwFormRef = useRef<HTMLFormElement>(null);

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

          <button
            type="submit"
            disabled={pwIsPending}
            className="rounded-xl bg-signal-green px-4 py-2 text-sm font-semibold text-deep-navy hover:bg-signal-green/90 disabled:opacity-60 transition"
          >
            {pwIsPending ? 'Updating…' : 'Update password'}
          </button>
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
              Manage billing →
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
