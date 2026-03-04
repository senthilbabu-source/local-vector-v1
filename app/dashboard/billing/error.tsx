'use client';

import * as Sentry from '@sentry/nextjs';
import { CreditCard } from 'lucide-react';
import { useEffect } from 'react';

export default function BillingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { page: 'billing' } });
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-alert-crimson/10">
          <CreditCard className="h-6 w-6 text-alert-crimson" />
        </div>
        <h2 className="text-xl font-semibold text-white">Billing Unavailable</h2>
        <p className="text-sm text-slate-400">
          We couldn&apos;t load your billing information. This is usually temporary.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-500 font-mono">Error ID: {error.digest}</p>
        )}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={reset}
            className="rounded-xl bg-electric-indigo px-6 py-2.5 text-sm font-semibold text-white hover:bg-electric-indigo/90 transition"
          >
            Try again
          </button>
          <a
            href="mailto:hello@localvector.ai"
            className="text-xs text-slate-400 hover:text-white transition underline"
          >
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}
