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
    <div className="w-full max-w-md">
      {/* Card */}
      <div className="rounded-2xl bg-white px-8 py-10 shadow-lg ring-1 ring-slate-900/5">
        {/* Brand */}
        <div className="mb-8 text-center">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-lg select-none">
            LV
          </span>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
            LocalVector<span className="text-indigo-600">.ai</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">Create your free account</p>
        </div>

        {/* Global error */}
        {globalError && (
          <div
            role="alert"
            className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
          >
            {globalError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {fields.map(({ name, label, type, placeholder, autoComplete }) => (
            <div key={name}>
              <label
                htmlFor={name}
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                {label}
              </label>
              <input
                id={name}
                type={type}
                autoComplete={autoComplete}
                placeholder={placeholder}
                {...register(name)}
                className={`w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:ring-2 ${
                  errors[name]
                    ? 'border-red-400 focus:ring-red-300'
                    : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-200'
                }`}
              />
              {errors[name] && (
                <p className="mt-1.5 text-xs text-red-600">{errors[name]?.message}</p>
              )}
            </div>
          ))}

          {/* Password hint */}
          <p className="text-xs text-slate-400">
            Must be 8+ characters with an uppercase letter, lowercase letter, and number.
          </p>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        {/* Footer link */}
        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-indigo-600 hover:text-indigo-500"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
