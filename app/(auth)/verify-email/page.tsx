'use client';

import { useState } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';

/**
 * /verify-email — Shown after registration when email is not yet confirmed.
 *
 * §313: Email Verification Flow.
 * Users land here after signup (auto-redirect from proxy.ts for unverified
 * sessions) or directly after register. They can resend the verification email.
 */
export default function VerifyEmailPage() {
  const [resendStatus, setResendStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleResend() {
    setResendStatus('loading');
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        setResendStatus('success');
        return;
      }

      const body = await res.json().catch(() => ({}));
      setErrorMessage(body.error ?? 'Failed to resend verification email.');
      setResendStatus('error');
    } catch (err) {
      Sentry.captureException(err, { tags: { file: 'verify-email/page.tsx', sprint: '§313' } });
      setErrorMessage('A network error occurred. Please try again.');
      setResendStatus('error');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-midnight-slate px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-surface-dark px-8 py-10 border border-white/5 text-center">
          {/* Brand */}
          <svg width="40" height="40" viewBox="0 0 28 28" fill="none" aria-hidden className="mx-auto">
            <rect width="28" height="28" rx="7" fill="url(#lv-verify-grad)" />
            <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle"
              fill="#050A15" fontSize="13" fontWeight="800" fontFamily="var(--font-outfit), sans-serif">LV</text>
            <defs><linearGradient id="lv-verify-grad" x1="0" y1="0" x2="28" y2="28">
              <stop stopColor="#00F5A0" /><stop offset="1" stopColor="#00F5A088" />
            </linearGradient></defs>
          </svg>

          {/* Email icon */}
          <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-signal-green/10">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00F5A0" strokeWidth="1.5" aria-hidden>
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <h1 className="mt-5" style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.02em' }}>
            Check your email
          </h1>

          <p className="mt-3" style={{ fontSize: 14, lineHeight: 1.7, color: '#94A3B8' }}>
            We sent a verification link to your email address.
            Click the link to verify your account and start using LocalVector.
          </p>

          {/* Resend button */}
          <div className="mt-8">
            {resendStatus === 'success' ? (
              <p className="text-sm text-signal-green" role="status">
                Verification email sent! Check your inbox.
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resendStatus === 'loading'}
                className="lv-btn-green w-full disabled:cursor-not-allowed disabled:opacity-60"
                style={{ padding: '12px 24px', fontSize: 14, animation: 'none' }}
              >
                {resendStatus === 'loading' ? 'Sending...' : 'Resend verification email'}
              </button>
            )}

            {errorMessage && (
              <div
                role="alert"
                className="mt-4 rounded-lg bg-alert-crimson/10 px-4 py-3 text-sm text-alert-crimson ring-1 ring-alert-crimson/30"
              >
                {errorMessage}
              </div>
            )}
          </div>

          {/* Footer links */}
          <div className="mt-8 space-y-3">
            <p style={{ fontSize: 13, color: '#94A3B8' }}>
              Wrong email?{' '}
              <Link href="/register" style={{ fontWeight: 600, color: '#00F5A0' }} className="hover:underline">
                Sign up again
              </Link>
            </p>
            <p style={{ fontSize: 13, color: '#94A3B8' }}>
              Already verified?{' '}
              <Link href="/login" style={{ fontWeight: 600, color: '#00F5A0' }} className="hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
