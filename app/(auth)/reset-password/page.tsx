'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import * as Sentry from '@sentry/nextjs';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      setStatus('error');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      setStatus('error');
      return;
    }

    setStatus('loading');

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErrorMsg(error.message);
        setStatus('error');
        return;
      }

      // Password updated — redirect to login
      router.push('/login');
    } catch (err) {
      Sentry.captureException(err, { tags: { file: 'reset-password/page.tsx', sprint: 'A' } });
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
              <rect width="28" height="28" rx="7" fill="url(#lv-rp-grad)" />
              <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle"
                fill="#050A15" fontSize="13" fontWeight="800" fontFamily="var(--font-outfit), sans-serif">LV</text>
              <defs><linearGradient id="lv-rp-grad" x1="0" y1="0" x2="28" y2="28">
                <stop stopColor="#00F5A0" /><stop offset="1" stopColor="#00F5A088" />
              </linearGradient></defs>
            </svg>
            <h1 className="mt-3" style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.02em' }}>
              Set new password
            </h1>
            <p style={{ marginTop: 4, fontSize: 14, color: '#94A3B8' }}>
              Enter your new password below.
            </p>
          </div>

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
                htmlFor="password"
                style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#CBD5E1' }}
              >
                New password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 px-3 py-2.5 text-sm outline-none transition focus:border-signal-green/50 focus:ring-2 focus:ring-signal-green/20"
                style={{ backgroundColor: '#050A15', color: '#F1F5F9', fontSize: 14 }}
              />
              <p className="mt-1.5 text-xs text-slate-500">Must be at least 8 characters.</p>
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#CBD5E1' }}
              >
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              {status === 'loading' ? 'Updating…' : 'Reset password'}
            </button>
          </form>

          <p style={{ marginTop: 24, textAlign: 'center', fontSize: 14, color: '#94A3B8' }}>
            <Link
              href="/login"
              style={{ fontWeight: 600, color: '#00F5A0' }}
              className="hover:underline"
            >
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
