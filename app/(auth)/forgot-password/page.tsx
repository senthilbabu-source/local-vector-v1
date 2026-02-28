'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import * as Sentry from '@sentry/nextjs';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('loading');
    setErrorMsg(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setErrorMsg(error.message);
        setStatus('error');
        return;
      }

      setStatus('sent');
    } catch (err) {
      Sentry.captureException(err, { tags: { file: 'forgot-password/page.tsx', sprint: 'A' } });
      setErrorMsg('A network error occurred. Please try again.');
      setStatus('error');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-midnight-slate px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-surface-dark px-8 py-10 border border-white/5">
          {/* Brand */}
          <div className="mb-8 text-center">
            <svg width="40" height="40" viewBox="0 0 28 28" fill="none" aria-hidden className="mx-auto">
              <rect width="28" height="28" rx="7" fill="url(#lv-fp-grad)" />
              <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle"
                fill="#050A15" fontSize="13" fontWeight="800" fontFamily="var(--font-outfit), sans-serif">LV</text>
              <defs><linearGradient id="lv-fp-grad" x1="0" y1="0" x2="28" y2="28">
                <stop stopColor="#00F5A0" /><stop offset="1" stopColor="#00F5A088" />
              </linearGradient></defs>
            </svg>
            <h1 className="mt-3" style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.02em' }}>
              Reset your password
            </h1>
            <p style={{ marginTop: 4, fontSize: 14, color: '#94A3B8' }}>
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>

          {status === 'sent' ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-signal-green/10">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00F5A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <p className="text-sm text-slate-300">
                Check your email for a password reset link. It may take a minute to arrive.
              </p>
              <Link
                href="/login"
                className="mt-4 inline-block text-sm font-semibold text-signal-green hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div
                  role="alert"
                  className="mb-5 rounded-lg bg-alert-crimson/10 px-4 py-3 text-sm text-alert-crimson ring-1 ring-alert-crimson/30"
                >
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#CBD5E1' }}
                  >
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@business.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-white/10 px-3 py-2.5 text-sm outline-none transition focus:border-signal-green/50 focus:ring-2 focus:ring-signal-green/20"
                    style={{ backgroundColor: '#050A15', color: '#F1F5F9', fontSize: 14 }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="lv-btn-green mt-1 w-full disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ padding: '12px 24px', fontSize: 14, animation: 'none' }}
                >
                  {status === 'loading' ? 'Sending…' : 'Send reset link'}
                </button>
              </form>

              <p style={{ marginTop: 24, textAlign: 'center', fontSize: 14, color: '#94A3B8' }}>
                Remember your password?{' '}
                <Link
                  href="/login"
                  style={{ fontWeight: 600, color: '#00F5A0' }}
                  className="hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
