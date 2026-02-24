'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RegisterSchema, type RegisterInput } from '@/lib/schemas/auth';

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
