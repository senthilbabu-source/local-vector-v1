'use client';

// ---------------------------------------------------------------------------
// ForceRunButton — Sprint §204 (Admin Write Operations)
//
// Triggers a cron job manually via adminForceCronRun server action.
// ---------------------------------------------------------------------------

import { useState, useTransition } from 'react';
import { adminForceCronRun } from '@/lib/admin/admin-actions';

interface ForceRunButtonProps {
  cronName: string;
}

export default function ForceRunButton({ cronName }: ForceRunButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  function handleRun() {
    setResult(null);
    startTransition(async () => {
      const res = await adminForceCronRun(cronName);
      if (res.success) {
        setResult({ type: 'success', message: 'Triggered' });
      } else {
        setResult({ type: 'error', message: res.error });
      }
      setTimeout(() => setResult(null), 4000);
    });
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        onClick={handleRun}
        disabled={isPending}
        className="rounded px-2 py-0.5 text-xs font-medium bg-electric-indigo/10 text-electric-indigo border border-electric-indigo/20 hover:bg-electric-indigo/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
        data-testid="force-run-btn"
      >
        {isPending ? 'Running...' : 'Run Now'}
      </button>
      {result && (
        <span
          className={`text-xs ${result.type === 'success' ? 'text-signal-green' : 'text-red-400'}`}
          data-testid="force-run-result"
        >
          {result.message}
        </span>
      )}
    </div>
  );
}
