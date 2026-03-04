// ---------------------------------------------------------------------------
// app/(auth)/error.tsx — P5-FIX-23: Error boundary for auth pages
// ---------------------------------------------------------------------------

'use client';

import * as Sentry from '@sentry/nextjs';
import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-alert-crimson/10">
          <AlertTriangle className="h-6 w-6 text-alert-crimson" />
        </div>
        <h2 className="text-xl font-semibold text-white">Authentication Error</h2>
        <p className="text-sm text-slate-400">
          Something went wrong during authentication. Please try again.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-500 font-mono">Error ID: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="rounded-xl bg-electric-indigo px-6 py-2.5 text-sm font-semibold text-white hover:bg-electric-indigo/90 transition"
          >
            Try again
          </button>
          <a
            href="/login"
            className="rounded-xl border border-slate-700 px-6 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition"
          >
            Back to login
          </a>
        </div>
      </div>
    </div>
  );
}
