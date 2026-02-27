'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { acceptInvitation } from '@/app/actions/accept-invitation';

interface InviteAcceptClientProps {
  token: string;
  initialState: 'invalid' | 'pending_login' | 'pending_accept' | 'wrong_account';
  invalidReason?: string;
  orgName?: string;
  inviterName?: string;
  role?: string;
  inviteEmail?: string;
}

export default function InviteAcceptClient({
  token,
  initialState,
  invalidReason,
  orgName,
  inviterName,
  role,
  inviteEmail,
}: InviteAcceptClientProps) {
  const router = useRouter();
  const [state, setState] = useState<
    'invalid' | 'pending_login' | 'pending_accept' | 'wrong_account' | 'success' | 'error'
  >(initialState);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleAccept() {
    startTransition(async () => {
      const result = await acceptInvitation({ token });
      if (result.success) {
        setState('success');
        setTimeout(() => router.push('/dashboard'), 2000);
      } else {
        setErrorMessage(result.error ?? 'Failed to accept invitation');
        setState('error');
      }
    });
  }

  // ── Invalid state ─────────────────────────────────────────────
  if (state === 'invalid') {
    return (
      <div
        data-testid="invite-page-invalid"
        className="max-w-md w-full bg-slate-800/50 rounded-2xl border border-slate-700 p-8 text-center"
      >
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
          <span className="text-red-400 text-xl">!</span>
        </div>
        <h1 className="text-lg font-semibold text-white mb-2">
          Invalid Invitation
        </h1>
        <p className="text-sm text-slate-400 mb-6">
          {invalidReason ?? 'This invitation link is not valid.'}
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-2.5 rounded-lg bg-slate-700 text-white text-sm font-medium hover:bg-slate-600 transition-colors"
        >
          Go to Homepage
        </Link>
      </div>
    );
  }

  // ── Pending login ─────────────────────────────────────────────
  if (state === 'pending_login') {
    return (
      <div
        data-testid="invite-page-pending-login"
        className="max-w-md w-full bg-slate-800/50 rounded-2xl border border-slate-700 p-8 text-center"
      >
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-electric-indigo/10 flex items-center justify-center">
          <span className="text-electric-indigo text-xl">+</span>
        </div>
        <h1 className="text-lg font-semibold text-white mb-2">
          Team Invitation
        </h1>
        {inviterName && (
          <p data-testid="invite-inviter-name" className="text-sm text-slate-400 mb-1">
            {inviterName} invited you to join
          </p>
        )}
        <p data-testid="invite-org-name" className="text-base font-semibold text-white mb-3">
          {orgName ?? 'a team'}
        </p>
        {role && (
          <span
            data-testid="invite-role-badge"
            className="inline-block mb-6 px-3 py-1 rounded-full text-xs font-semibold bg-electric-indigo/10 text-electric-indigo uppercase tracking-wide"
          >
            {role}
          </span>
        )}
        <div className="space-y-3">
          <Link
            href={`/login?redirect=/invite/${token}`}
            className="block w-full px-6 py-3 rounded-xl bg-electric-indigo text-white font-semibold text-sm text-center hover:bg-electric-indigo/90 transition-colors"
          >
            Sign in to accept
          </Link>
          <Link
            href={`/register?redirect=/invite/${token}`}
            className="block w-full px-6 py-3 rounded-xl bg-slate-700 text-white font-semibold text-sm text-center hover:bg-slate-600 transition-colors"
          >
            Create account to accept
          </Link>
        </div>
      </div>
    );
  }

  // ── Wrong account ─────────────────────────────────────────────
  if (state === 'wrong_account') {
    return (
      <div
        data-testid="invite-page-wrong-account"
        className="max-w-md w-full bg-slate-800/50 rounded-2xl border border-slate-700 p-8 text-center"
      >
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
          <span className="text-yellow-400 text-xl">!</span>
        </div>
        <h1 className="text-lg font-semibold text-white mb-2">
          Wrong Account
        </h1>
        <p className="text-sm text-slate-400 mb-2">
          This invitation was sent to <strong className="text-white">{inviteEmail}</strong>.
        </p>
        <p className="text-sm text-slate-400 mb-6">
          Please sign in with that email address to accept.
        </p>
        <Link
          href={`/login?redirect=/invite/${token}`}
          className="inline-block px-6 py-2.5 rounded-lg bg-electric-indigo text-white text-sm font-medium hover:bg-electric-indigo/90 transition-colors"
        >
          Sign in with correct account
        </Link>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────
  if (state === 'success') {
    return (
      <div
        data-testid="invite-page-success"
        className="max-w-md w-full bg-slate-800/50 rounded-2xl border border-slate-700 p-8 text-center"
      >
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
          <span className="text-green-400 text-xl">✓</span>
        </div>
        <h1 className="text-lg font-semibold text-white mb-2">
          Welcome to {orgName}!
        </h1>
        <p className="text-sm text-slate-400">
          Redirecting to your dashboard...
        </p>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div
        data-testid="invite-page-invalid"
        className="max-w-md w-full bg-slate-800/50 rounded-2xl border border-slate-700 p-8 text-center"
      >
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
          <span className="text-red-400 text-xl">!</span>
        </div>
        <h1 className="text-lg font-semibold text-white mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-slate-400 mb-6">
          {errorMessage ?? 'Unable to accept the invitation. Please try again.'}
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-2.5 rounded-lg bg-slate-700 text-white text-sm font-medium hover:bg-slate-600 transition-colors"
        >
          Go to Homepage
        </Link>
      </div>
    );
  }

  // ── Pending accept (logged in, email matches) ─────────────────
  return (
    <div
      data-testid="invite-page-pending-accept"
      className="max-w-md w-full bg-slate-800/50 rounded-2xl border border-slate-700 p-8 text-center"
    >
      <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-electric-indigo/10 flex items-center justify-center">
        <span className="text-electric-indigo text-xl">+</span>
      </div>
      <h1 className="text-lg font-semibold text-white mb-2">
        Join {orgName}
      </h1>
      {inviterName && (
        <p data-testid="invite-inviter-name" className="text-sm text-slate-400 mb-1">
          Invited by {inviterName}
        </p>
      )}
      {role && (
        <span
          data-testid="invite-role-badge"
          className="inline-block mt-2 mb-6 px-3 py-1 rounded-full text-xs font-semibold bg-electric-indigo/10 text-electric-indigo uppercase tracking-wide"
        >
          {role}
        </span>
      )}
      <button
        data-testid="invite-accept-btn"
        onClick={handleAccept}
        disabled={isPending}
        className="block w-full mt-4 px-6 py-3 rounded-xl bg-signal-green/10 text-signal-green font-semibold text-sm ring-1 ring-inset ring-signal-green/20 hover:bg-signal-green/20 transition-colors disabled:opacity-50"
      >
        {isPending ? 'Accepting...' : 'Accept Invitation'}
      </button>
    </div>
  );
}
