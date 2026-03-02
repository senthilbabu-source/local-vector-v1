'use client';

/**
 * InviteMemberModal — Sprint 112
 *
 * Modal triggered by [Invite Member] button.
 * Fields: email input + role selector + send button.
 */

import { useState, useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { X } from 'lucide-react';

interface InviteMemberModalProps {
  open: boolean;
  onClose: () => void;
  onInviteSent: () => void;
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin', description: 'Can invite, remove, and manage all content' },
  { value: 'analyst', label: 'Analyst', description: 'Can view all data and generate reports' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access to dashboard data' },
] as const;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ERROR_LABELS: Record<string, string> = {
  seat_limit_reached: "You've reached the seat limit for your plan.",
  already_member: 'is already a member of this organization.',
  invitation_already_pending: 'An invitation is already pending for this email.',
  send_failed: 'Invitation created but email failed to send.',
  invalid_email: 'Please enter a valid email address.',
  invalid_role: 'Please select a valid role.',
};

export default function InviteMemberModal({ open, onClose, onInviteSent }: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setEmail('');
      setRole('viewer');
      setError('');
      setSuccess(false);
    }
  }, [open]);

  // Auto-close on success after 2 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        onClose();
        onInviteSent();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [success, onClose, onInviteSent]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      setError(ERROR_LABELS.invalid_email);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/team/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, role }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        const code = data.error ?? 'unknown';
        if (code === 'already_member') {
          setError(`${trimmedEmail} ${ERROR_LABELS.already_member}`);
        } else {
          setError(ERROR_LABELS[code] ?? data.message ?? 'Failed to send invitation.');
        }
        return;
      }

      setSuccess(true);
    } catch (err) {
      Sentry.captureException(err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        data-testid="invite-member-modal"
        className="relative w-full max-w-md rounded-xl border border-white/5 bg-surface-dark p-6 shadow-xl"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-500 hover:text-slate-300 transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-lg font-semibold text-white mb-4">Invite Team Member</h2>

        {/* Success state */}
        {success && (
          <div data-testid="invite-success-message" className="text-center py-4 space-y-2">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-signal-green/10">
              <svg className="h-5 w-5 text-signal-green" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-sm text-slate-300">
              Invitation sent to <span className="text-white font-medium">{email.trim()}</span>
            </p>
          </div>
        )}

        {/* Form */}
        {!success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="invite-email" className="block text-sm font-medium text-slate-300 mb-1">
                Email Address
              </label>
              <input
                id="invite-email"
                data-testid="invite-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-electric-indigo"
                placeholder="colleague@company.com"
              />
            </div>

            {/* Role */}
            <div>
              <label htmlFor="invite-role" className="block text-sm font-medium text-slate-300 mb-1">
                Role
              </label>
              <select
                id="invite-role"
                data-testid="invite-role-select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-electric-indigo"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                {ROLE_OPTIONS.find((r) => r.value === role)?.description}
              </p>
            </div>

            {/* Error */}
            {error && (
              <p data-testid="invite-error-message" className="text-sm text-red-400">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              data-testid="invite-submit-btn"
              disabled={loading}
              className="w-full rounded-lg bg-electric-indigo px-4 py-2.5 text-sm font-medium text-white hover:bg-electric-indigo/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Invitation'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
