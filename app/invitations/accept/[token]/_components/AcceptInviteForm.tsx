'use client';

/**
 * AcceptInviteForm — Sprint 112
 *
 * New user signup form shown when the invitee has no LocalVector account.
 * Fields: Full Name, Password, Confirm Password.
 */

import { useState } from 'react';
import * as Sentry from '@sentry/nextjs';
import type { OrgInvitationDisplay } from '@/lib/invitations/types';

interface AcceptInviteFormProps {
  invitation: OrgInvitationDisplay;
  token: string;
  onSuccess: () => void;
}

export default function AcceptInviteForm({ invitation, token, onSuccess }: AcceptInviteFormProps) {
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (!fullName.trim()) {
      errors.full_name = 'Full name is required.';
    }
    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }
    if (password !== confirmPassword) {
      errors.confirm_password = 'Passwords do not match.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/invitations/accept/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.message ?? data.error ?? 'Failed to create account.');
        return;
      }

      onSuccess();
    } catch (err) {
      Sentry.captureException(err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      data-testid="accept-invite-form"
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      <div className="text-center space-y-2 mb-6">
        <h2 className="text-lg font-semibold text-white">
          Create your account to join {invitation.org_name}
        </h2>
        <p className="text-sm text-slate-400">
          {invitation.invited_by_name} invited you as{' '}
          <span className="capitalize text-slate-300">{invitation.role}</span>.
        </p>
      </div>

      {/* Full Name */}
      <div>
        <label htmlFor="full-name" className="block text-sm font-medium text-slate-300 mb-1">
          Full Name
        </label>
        <input
          id="full-name"
          data-testid="full-name-input"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-electric-indigo"
          placeholder="Your full name"
        />
        {fieldErrors.full_name && (
          <p className="mt-1 text-xs text-red-400">{fieldErrors.full_name}</p>
        )}
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
          Password
        </label>
        <input
          id="password"
          data-testid="password-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-electric-indigo"
          placeholder="At least 8 characters"
        />
        {fieldErrors.password && (
          <p className="mt-1 text-xs text-red-400">{fieldErrors.password}</p>
        )}
      </div>

      {/* Confirm Password */}
      <div>
        <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-300 mb-1">
          Confirm Password
        </label>
        <input
          id="confirm-password"
          data-testid="confirm-password-input"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-electric-indigo"
          placeholder="Re-enter password"
        />
        {fieldErrors.confirm_password && (
          <p className="mt-1 text-xs text-red-400">{fieldErrors.confirm_password}</p>
        )}
      </div>

      {/* Error */}
      {error && (
        <p data-testid="accept-invite-error" className="text-sm text-red-400 text-center">
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        data-testid="create-account-btn"
        disabled={loading}
        className="w-full rounded-lg bg-electric-indigo px-4 py-2.5 text-sm font-medium text-white hover:bg-electric-indigo/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Creating Account...' : 'Create Account & Join'}
      </button>
    </form>
  );
}
