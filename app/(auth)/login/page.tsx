'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoginSchema, type LoginInput } from '@/lib/schemas/auth';
import { createClient } from '@/lib/supabase/client';
import * as Sentry from '@sentry/nextjs';

export default function LoginPage() {
  const router = useRouter();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);

  async function handleGoogleSignIn() {
    setGlobalError(null);
    setOauthLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) {
        setGlobalError(error.message);
        setOauthLoading(false);
      }
      // If no error, Supabase redirects to Google — no need to reset loading
    } catch (err) {
      Sentry.captureException(err, { tags: { file: 'login/page.tsx', sprint: 'A' } });
      setGlobalError('Google sign-in is not available. Please use email and password.');
      setOauthLoading(false);
    }
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
  });

  async function onSubmit(data: LoginInput) {
    setGlobalError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        router.push('/dashboard');
        router.refresh();
        return;
      }

      const body = await res.json().catch(() => ({}));
      setGlobalError(
        body.error ?? 'Unable to sign in. Please check your credentials and try again.'
      );
    } catch (err) {
      Sentry.captureException(err, { tags: { file: 'login/page.tsx', sprint: 'A' } });
      setGlobalError('A network error occurred. Please try again.');
    }
  }

  return (
    <div className="flex min-h-screen">

      {/* ── Left panel — Fear/Greed marketing copy ─────────────────────── */}
      <section
        aria-label="LocalVector marketing"
        className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-midnight-slate px-16 py-12"
      >
        {/* Brand */}
        <div className="flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
            <rect width="28" height="28" rx="7" fill="url(#lv-logo-grad)" />
            <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle"
              fill="#050A15" fontSize="13" fontWeight="800" fontFamily="var(--font-outfit), sans-serif">LV</text>
            <defs><linearGradient id="lv-logo-grad" x1="0" y1="0" x2="28" y2="28">
              <stop stopColor="#00F5A0" /><stop offset="1" stopColor="#00F5A088" />
            </linearGradient></defs>
          </svg>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.02em' }}>
            LocalVector<span style={{ color: '#00F5A0' }}>.ai</span>
          </span>
        </div>

        {/* Headline + copy blocks */}
        <div className="space-y-10">
          <h1 style={{ fontSize: 'clamp(28px, 3.5vw, 40px)', fontWeight: 800, color: '#F1F5F9', lineHeight: 1.15, letterSpacing: '-0.03em' }}>
            Don&rsquo;t let AI<br />lie about your<br />business.
          </h1>

          {/* Fear block */}
          <div className="space-y-2">
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: '#EF4444', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
              The Fear
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: '#94A3B8' }}>
              72% of diners trust AI answers over your own website.
              When ChatGPT says you&rsquo;re closed, they don&rsquo;t call to check.
            </p>
          </div>

          {/* Greed block */}
          <div className="space-y-2">
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: '#00F5A0', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
              The Greed
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: '#94A3B8' }}>
              Restaurants on LocalVector see 3&times; more AI-driven reservations.
              Be the answer &mdash; not the footnote.
            </p>
          </div>
        </div>

        {/* Footer stat */}
        <p style={{ fontSize: 11, color: '#475569', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
          Protecting 1,200+ restaurant brands from AI hallucinations.
        </p>
      </section>

      {/* ── Right panel — login form ────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-surface-dark px-8 py-12">
        <div className="w-full max-w-md">

          {/* Card */}
          <div className="rounded-2xl bg-midnight-slate px-8 py-10 border border-white/5">

            {/* Brand (shown on mobile when left panel is hidden) */}
            <div className="mb-8 text-center lg:hidden">
              <svg width="40" height="40" viewBox="0 0 28 28" fill="none" aria-hidden className="mx-auto">
                <rect width="28" height="28" rx="7" fill="url(#lv-logo-grad-m)" />
                <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle"
                  fill="#050A15" fontSize="13" fontWeight="800" fontFamily="var(--font-outfit), sans-serif">LV</text>
                <defs><linearGradient id="lv-logo-grad-m" x1="0" y1="0" x2="28" y2="28">
                  <stop stopColor="#00F5A0" /><stop offset="1" stopColor="#00F5A088" />
                </linearGradient></defs>
              </svg>
              <h1 className="mt-3" style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.02em' }}>
                LocalVector<span style={{ color: '#00F5A0' }}>.ai</span>
              </h1>
            </div>

            <p style={{ marginBottom: 24, textAlign: 'center', fontSize: 14, color: '#94A3B8' }}>Sign in to your account</p>

            {/* Global error */}
            {globalError && (
              <div
                role="alert"
                className="mb-5 rounded-lg bg-alert-crimson/10 px-4 py-3 text-sm text-alert-crimson ring-1 ring-alert-crimson/30"
              >
                {globalError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
              {/* Email */}
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
                  {...register('email')}
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2 ${
                    errors.email
                      ? 'border-alert-crimson/50 focus:ring-alert-crimson/30'
                      : 'border-white/10 focus:border-signal-green/50 focus:ring-signal-green/20'
                  }`}
                  style={{ backgroundColor: '#0A1628', color: '#F1F5F9', fontSize: 14 }}
                />
                {errors.email && (
                  <p className="mt-1.5 text-xs text-alert-crimson">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#CBD5E1' }}
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-signal-green hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register('password')}
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2 ${
                    errors.password
                      ? 'border-alert-crimson/50 focus:ring-alert-crimson/30'
                      : 'border-white/10 focus:border-signal-green/50 focus:ring-signal-green/20'
                  }`}
                  style={{ backgroundColor: '#0A1628', color: '#F1F5F9', fontSize: 14 }}
                />
                {errors.password && (
                  <p className="mt-1.5 text-xs text-alert-crimson">{errors.password.message}</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="lv-btn-green mt-1 w-full disabled:cursor-not-allowed disabled:opacity-60"
                style={{ padding: '12px 24px', fontSize: 14, animation: 'none' }}
              >
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-slate-500">or</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            {/* Google OAuth — requires Google provider enabled in Supabase Dashboard > Auth > Providers */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={oauthLoading}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              {oauthLoading ? 'Redirecting…' : 'Sign in with Google'}
            </button>

            {/* Footer link */}
            <p style={{ marginTop: 24, textAlign: 'center', fontSize: 14, color: '#94A3B8' }}>
              Don&apos;t have an account?{' '}
              <Link
                href="/register"
                style={{ fontWeight: 600, color: '#00F5A0' }}
                className="hover:underline"
              >
                Create one free
              </Link>
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
