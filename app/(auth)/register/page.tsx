'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RegisterSchema, type RegisterInput } from '@/lib/schemas/auth';
import { createClient } from '@/lib/supabase/client';

type FieldName = keyof RegisterInput;

const fields: {
  name: FieldName;
  label: string;
  type: string;
  placeholder: string;
  autoComplete: string;
}[] = [
  {
    name: 'full_name',
    label: 'Full name',
    type: 'text',
    placeholder: 'Jane Smith',
    autoComplete: 'name',
  },
  {
    name: 'business_name',
    label: 'Business name',
    type: 'text',
    placeholder: 'Charcoal N Chill',
    autoComplete: 'organization',
  },
  {
    name: 'email',
    label: 'Work email',
    type: 'email',
    placeholder: 'jane@business.com',
    autoComplete: 'email',
  },
  {
    name: 'password',
    label: 'Password',
    type: 'password',
    placeholder: '••••••••',
    autoComplete: 'new-password',
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);

  async function handleGoogleSignUp() {
    setGlobalError(null);
    setOauthLoading(true);
    try {
      const supabase = createClient();
      // Google OAuth provider must be enabled in Supabase Dashboard > Auth > Providers
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
    } catch {
      setGlobalError('Google sign-up is not available. Please use email and password.');
      setOauthLoading(false);
    }
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(RegisterSchema),
  });

  async function onSubmit(data: RegisterInput) {
    setGlobalError(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        // Registration succeeded — log the user in immediately
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.email, password: data.password }),
        });

        if (loginRes.ok) {
          router.push('/dashboard');
          router.refresh();
          return;
        }
        // Login after register failed — send to login page with the email pre-filled
        router.push('/login');
        return;
      }

      const body = await res.json().catch(() => ({}));
      setGlobalError(body.error ?? 'Registration failed. Please try again.');
    } catch {
      setGlobalError('A network error occurred. Please try again.');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-midnight-slate px-4">
    <div className="w-full max-w-md">
      {/* Card */}
      <div className="rounded-2xl bg-surface-dark px-8 py-10 border border-white/5">
        {/* Brand */}
        <div className="mb-8 text-center">
          <svg width="40" height="40" viewBox="0 0 28 28" fill="none" aria-hidden className="mx-auto">
            <rect width="28" height="28" rx="7" fill="url(#lv-reg-grad)" />
            <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle"
              fill="#050A15" fontSize="13" fontWeight="800" fontFamily="var(--font-outfit), sans-serif">LV</text>
            <defs><linearGradient id="lv-reg-grad" x1="0" y1="0" x2="28" y2="28">
              <stop stopColor="#00F5A0" /><stop offset="1" stopColor="#00F5A088" />
            </linearGradient></defs>
          </svg>
          <h1 className="mt-3" style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.02em' }}>
            LocalVector<span style={{ color: '#00F5A0' }}>.ai</span>
          </h1>
          <p style={{ marginTop: 4, fontSize: 14, color: '#94A3B8' }}>Create your free account</p>
        </div>

        {/* Global error */}
        {globalError && (
          <div
            role="alert"
            className="mb-5 rounded-lg bg-alert-crimson/10 px-4 py-3 text-sm text-alert-crimson ring-1 ring-alert-crimson/30"
          >
            {globalError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {fields.map(({ name, label, type, placeholder, autoComplete }) => (
            <div key={name}>
              <label
                htmlFor={name}
                style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#CBD5E1' }}
              >
                {label}
              </label>
              <input
                id={name}
                type={type}
                autoComplete={autoComplete}
                placeholder={placeholder}
                {...register(name)}
                className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2 ${
                  errors[name]
                    ? 'border-alert-crimson/50 focus:ring-alert-crimson/30'
                    : 'border-white/10 focus:border-signal-green/50 focus:ring-signal-green/20'
                }`}
                style={{ backgroundColor: '#050A15', color: '#F1F5F9', fontSize: 14 }}
              />
              {errors[name] && (
                <p className="mt-1.5 text-xs text-alert-crimson">{errors[name]?.message}</p>
              )}
            </div>
          ))}

          {/* Password hint */}
          <p style={{ fontSize: 12, color: '#64748B' }}>
            Must be 8+ characters with an uppercase letter, lowercase letter, and number.
          </p>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="lv-btn-green mt-1 w-full disabled:cursor-not-allowed disabled:opacity-60"
            style={{ padding: '12px 24px', fontSize: 14, animation: 'none' }}
          >
            {isSubmitting ? 'Creating account…' : 'Create account'}
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
          onClick={handleGoogleSignUp}
          disabled={oauthLoading}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          {oauthLoading ? 'Redirecting…' : 'Sign up with Google'}
        </button>

        {/* Footer link */}
        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 14, color: '#94A3B8' }}>
          Already have an account?{' '}
          <Link
            href="/login"
            style={{ fontWeight: 600, color: '#00F5A0' }}
            className="hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
    </div>
  );
}
