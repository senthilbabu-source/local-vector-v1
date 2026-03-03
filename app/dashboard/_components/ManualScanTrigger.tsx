'use client';

// ---------------------------------------------------------------------------
// app/dashboard/_components/ManualScanTrigger.tsx — P1-FIX-05
//
// "Check AI Mentions Now" button for Growth/Agency users.
// Trial/Starter see UpgradePlanPrompt instead.
// Polls GET /api/sov/trigger-manual every 5s while scan is pending/running.
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { planSatisfies } from '@/lib/plan-enforcer';
import { UpgradePlanPrompt } from '@/components/ui/UpgradePlanPrompt';

interface ManualScanTriggerProps {
  plan: string | null;
}

type ScanStatus = 'idle' | 'pending' | 'running' | 'complete' | 'failed' | null;

const POLL_INTERVAL_MS = 5000;

export default function ManualScanTrigger({ plan }: ManualScanTriggerProps) {
  const [status, setStatus] = useState<ScanStatus>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const canScan = planSatisfies(plan, 'growth');

  // Fetch current status
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/sov/trigger-manual');
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status ?? 'idle');
      }
    } catch (err) {
      Sentry.captureException(err);
    }
  }, []);

  // Initial status fetch
  useEffect(() => {
    if (!canScan) return;
    pollStatus().then(() => setInitialLoaded(true));
  }, [canScan, pollStatus]);

  // Poll while pending/running
  useEffect(() => {
    if (!canScan) return;
    if (status !== 'pending' && status !== 'running') return;
    const interval = setInterval(pollStatus, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [status, canScan, pollStatus]);

  async function handleTrigger() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/sov/trigger-manual', { method: 'POST' });
      const data = await res.json();
      if (res.status === 429) {
        setErrorMsg('Scan was triggered recently. Try again in 1 hour.');
      } else if (res.status === 409) {
        setStatus('running');
        setErrorMsg(null);
      } else if (res.status === 403) {
        setErrorMsg('Your plan does not support manual scans.');
      } else if (!res.ok) {
        setErrorMsg(data.message ?? 'Failed to start scan.');
      } else {
        setStatus('pending');
      }
    } catch (err) {
      Sentry.captureException(err);
      setErrorMsg('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Trial/Starter: show upgrade prompt
  if (!canScan) {
    return (
      <div data-testid="manual-scan-trigger">
        <UpgradePlanPrompt feature="Manual AI Scan" requiredPlan="AI Shield" />
      </div>
    );
  }

  const isRunning = status === 'pending' || status === 'running';
  const isComplete = status === 'complete';

  return (
    <div data-testid="manual-scan-trigger" className="rounded-xl border border-white/5 bg-surface-dark p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">Check AI Mentions Now</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {isRunning
              ? 'Scanning AI models — this takes 2\u20135 minutes\u2026'
              : isComplete
              ? 'Scan complete. Refresh the page to see updated scores.'
              : 'Manually run an AI visibility scan for all your queries.'}
          </p>
        </div>
        <button
          data-testid="manual-scan-btn"
          onClick={handleTrigger}
          disabled={loading || isRunning}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-signal-green/10 px-4 py-2 text-sm font-semibold text-signal-green ring-1 ring-inset ring-signal-green/20 hover:bg-signal-green/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isComplete ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
          )}
          {isRunning ? 'Scanning\u2026' : isComplete ? 'Complete' : 'Run Scan'}
        </button>
      </div>
      {errorMsg && (
        <p data-testid="manual-scan-error" className="mt-2 text-xs text-alert-amber">{errorMsg}</p>
      )}
    </div>
  );
}
