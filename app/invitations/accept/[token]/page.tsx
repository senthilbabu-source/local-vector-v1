'use client';

/**
 * /invitations/accept/[token] — Sprint 112
 *
 * PUBLIC page — no auth required. Standalone (no dashboard chrome).
 *
 * States:
 * - LOADING: skeleton spinner
 * - INVALID: error card with message
 * - VALID + existing_user: JoinOrgPrompt
 * - VALID + new_user: AcceptInviteForm
 * - SUCCESS: redirect to /dashboard
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import type { InvitationValidation } from '@/lib/invitations/types';
import AcceptInviteForm from './_components/AcceptInviteForm';
import JoinOrgPrompt from './_components/JoinOrgPrompt';

const ERROR_MESSAGES: Record<string, string> = {
  not_found: 'This invitation link is invalid or has already been used.',
  expired: 'This invitation has expired. Ask your team admin to send a new one.',
  already_accepted: "You've already joined this organization. Sign in to continue.",
  revoked: 'This invitation was revoked by your team admin.',
};

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [validation, setValidation] = useState<InvitationValidation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchValidation() {
      try {
        const res = await fetch(`/api/invitations/accept/${token}`);
        const data: InvitationValidation = await res.json();
        setValidation(data);
      } catch (err) {
        Sentry.captureException(err);
        setValidation({ valid: false, invitation: null, error: 'not_found', existing_user: false });
      } finally {
        setLoading(false);
      }
    }

    fetchValidation();
  }, [token]);

  function handleSuccess() {
    router.push('/dashboard');
  }

  return (
    <div
      data-testid="accept-invite-page"
      className="min-h-screen bg-[#050A15] flex items-center justify-center px-4"
    >
      <div className="w-full max-w-md rounded-xl border border-white/5 bg-surface-dark p-8">
        {/* LocalVector branding */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-electric-indigo">LocalVector</h1>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-electric-indigo" />
          </div>
        )}

        {/* Invalid */}
        {!loading && validation && !validation.valid && (
          <div data-testid="accept-invite-error-card" className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10">
              <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <p className="text-sm text-slate-300">
              {ERROR_MESSAGES[validation.error ?? 'not_found']}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-electric-indigo hover:text-electric-indigo/80 transition-colors"
            >
              Go to LocalVector
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        )}

        {/* Valid — existing user */}
        {!loading && validation?.valid && validation.existing_user && validation.invitation && (
          <JoinOrgPrompt
            invitation={validation.invitation}
            token={token}
            onSuccess={handleSuccess}
          />
        )}

        {/* Valid — new user */}
        {!loading && validation?.valid && !validation.existing_user && validation.invitation && (
          <AcceptInviteForm
            invitation={validation.invitation}
            token={token}
            onSuccess={handleSuccess}
          />
        )}
      </div>
    </div>
  );
}
