'use client';

/**
 * JoinOrgPrompt — Sprint 112
 *
 * Shown when the invitee already has a LocalVector account.
 * Simple "Join [Org Name]" confirmation.
 */

import { useState } from 'react';
import * as Sentry from '@sentry/nextjs';
import type { OrgInvitationDisplay } from '@/lib/invitations/types';

interface JoinOrgPromptProps {
  invitation: OrgInvitationDisplay;
  token: string;
  onSuccess: () => void;
}

export default function JoinOrgPrompt({ invitation, token, onSuccess }: JoinOrgPromptProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAccept() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/invitations/accept/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.message ?? data.error ?? 'Failed to join organization.');
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
    <div data-testid="join-org-prompt" className="text-center space-y-5">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-white">
          Join {invitation.org_name}
        </h2>
        <p className="text-sm text-slate-400">
          <span className="text-slate-300">{invitation.invited_by_name}</span> invited you
          to join as{' '}
          <span className="capitalize text-slate-300">{invitation.role}</span>.
        </p>
      </div>

      {error && (
        <p data-testid="join-org-error" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        data-testid="accept-invite-btn"
        onClick={handleAccept}
        disabled={loading}
        className="w-full rounded-lg bg-electric-indigo px-4 py-2.5 text-sm font-medium text-white hover:bg-electric-indigo/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Joining...' : 'Accept Invitation'}
      </button>
    </div>
  );
}
