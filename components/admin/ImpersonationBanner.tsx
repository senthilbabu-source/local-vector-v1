'use client';

// ---------------------------------------------------------------------------
// ImpersonationBanner — Sprint §204 (Admin Write Operations)
//
// Fixed banner shown at the top of the dashboard when an admin is
// impersonating a customer org. Calls adminStopImpersonation() on exit.
// ---------------------------------------------------------------------------

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { adminStopImpersonation } from '@/lib/admin/admin-actions';

interface ImpersonationBannerProps {
  orgName: string;
}

export default function ImpersonationBanner({ orgName }: ImpersonationBannerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleExit() {
    startTransition(async () => {
      const res = await adminStopImpersonation();
      if (res.success && res.redirectTo) {
        router.push(res.redirectTo);
      }
    });
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-deep-navy px-4 py-2 flex items-center justify-between text-sm font-medium"
      data-testid="impersonation-banner"
    >
      <span>
        Admin View: Viewing as <strong>{orgName}</strong>
      </span>
      <button
        onClick={handleExit}
        disabled={isPending}
        className="rounded bg-deep-navy/20 hover:bg-deep-navy/30 px-3 py-1 text-xs font-semibold transition disabled:opacity-50"
        data-testid="stop-impersonation-btn"
      >
        {isPending ? 'Exiting...' : 'Exit Impersonation'}
      </button>
    </div>
  );
}
