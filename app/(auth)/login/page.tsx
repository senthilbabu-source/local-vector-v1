'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoginSchema, type LoginInput } from '@/lib/schemas/auth';

export default function LoginPage() {
  const router = useRouter();
  const [globalError, setGlobalError] = useState<string | null>(null);

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
    } catch {
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
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-electric-indigo text-white font-bold text-lg select-none">
            LV
          </span>
          <span className="text-lg font-semibold text-white">
            LocalVector<span className="text-electric-indigo">.ai</span>
          </span>
        </div>

        {/* Headline + copy blocks */}
        <div className="space-y-10">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Don&rsquo;t let AI<br />lie about your<br />business.
          </h1>

          {/* Fear block */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-alert-crimson">
              The Fear
            </p>
            <p className="text-sm leading-relaxed text-slate-300">
              72% of diners trust AI answers over your own website.
              When ChatGPT says you&rsquo;re closed, they don&rsquo;t call to check.
            </p>
          </div>

          {/* Greed block */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-truth-emerald">
              The Greed
            </p>
            <p className="text-sm leading-relaxed text-slate-300">
              Restaurants on LocalVector see 3&times; more AI-driven reservations.
              Be the answer &mdash; not the footnote.
            </p>
          </div>
        </div>

        {/* Footer stat */}
        <p className="text-xs text-slate-600">
          Protecting 1,200+ restaurant brands from AI hallucinations.
        </p>
      </section>

      {/* ── Right panel — login form ────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 px-8 py-12">
        <div className="w-full max-w-md">

          {/* Card */}
          <div className="rounded-2xl bg-white px-8 py-10 shadow-lg ring-1 ring-slate-900/5">

            {/* Brand (shown on mobile when left panel is hidden) */}
            <div className="mb-8 text-center lg:hidden">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-lg select-none">
                LV
              </span>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                LocalVector<span className="text-indigo-600">.ai</span>
              </h1>
            </div>

            <p className="mb-6 text-center text-sm text-slate-500">Sign in to your account</p>

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
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@business.com"
                  {...register('email')}
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:ring-2 ${
                    errors.email
                      ? 'border-red-400 focus:ring-red-300'
                      : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-200'
                  }`}
                />
                {errors.email && (
                  <p className="mt-1.5 text-xs text-red-600">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Password
                  </label>
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register('password')}
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:ring-2 ${
                    errors.password
                      ? 'border-red-400 focus:ring-red-300'
                      : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-200'
                  }`}
                />
                {errors.password && (
                  <p className="mt-1.5 text-xs text-red-600">{errors.password.message}</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-1 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            {/* Footer link */}
            <p className="mt-6 text-center text-sm text-slate-500">
              Don&apos;t have an account?{' '}
              <Link
                href="/register"
                className="font-medium text-indigo-600 hover:text-indigo-500"
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
