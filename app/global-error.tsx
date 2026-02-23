'use client';

// ---------------------------------------------------------------------------
// app/global-error.tsx — Next.js App Router global error boundary (Sprint 26A)
//
// Catches unhandled errors in the root layout. Captures to Sentry and renders
// a Deep Night-themed fallback UI. Must be a Client Component per Next.js spec.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
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
    <html lang="en">
      <body className="min-h-screen bg-midnight-slate flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
          <p className="text-sm text-slate-400">
            An unexpected error occurred. Our team has been notified.
          </p>
          {error.digest && (
            <p className="text-xs text-slate-600 font-mono">Error ID: {error.digest}</p>
          )}
          <button
            onClick={reset}
            className="mt-4 rounded-xl bg-electric-indigo px-6 py-2.5 text-sm font-semibold text-white hover:bg-electric-indigo/90 transition"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
