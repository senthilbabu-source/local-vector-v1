'use client';

// ---------------------------------------------------------------------------
// app/dashboard/_components/ManualScanTrigger.tsx — P1-FIX-05
//
// "Check AI Mentions Now" button for Growth/Agency users.
// Trial/Starter see UpgradePlanPrompt instead.
// Polls GET /api/sov/trigger-manual every 5s while scan is pending/running.
//
// Enhanced: progress steps, elapsed timer, and animated progress bar so users
// always know something is actively happening during the 2–5 min scan.
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, CheckCircle, XCircle, Loader2, Search, Brain, BarChart3 } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { planSatisfies } from '@/lib/plan-enforcer';
import { UpgradePlanPrompt } from '@/components/ui/UpgradePlanPrompt';

interface ManualScanTriggerProps {
  plan: string | null;
}

type ScanStatus = 'idle' | 'pending' | 'running' | 'complete' | 'failed' | null;

const POLL_INTERVAL_MS = 5000;

// Simulated progress steps — gives the user a sense of what's happening
const SCAN_STEPS = [
  { label: 'Preparing your queries', icon: Search, durationMs: 8_000 },
  { label: 'Asking AI models about your business', icon: Brain, durationMs: 90_000 },
  { label: 'Analyzing responses & updating scores', icon: BarChart3, durationMs: 30_000 },
] as const;

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec.toString().padStart(2, '0')}s`;
}

export default function ManualScanTrigger({ plan }: ManualScanTriggerProps) {
  const [status, setStatus] = useState<ScanStatus>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const scanStartRef = useRef<number | null>(null);

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

  const isRunning = status === 'pending' || status === 'running';

  // Elapsed timer while scanning
  useEffect(() => {
    if (isRunning) {
      if (!scanStartRef.current) scanStartRef.current = Date.now();
      const tick = setInterval(() => {
        setElapsedMs(Date.now() - (scanStartRef.current ?? Date.now()));
      }, 1000);
      return () => clearInterval(tick);
    } else {
      scanStartRef.current = null;
      setElapsedMs(0);
    }
  }, [isRunning]);

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

  const isComplete = status === 'complete';
  const isFailed = status === 'failed';

  // Determine which step we're on based on elapsed time
  const currentStepIndex = isRunning
    ? SCAN_STEPS.reduce((idx, step, i) => {
        const stepStart = SCAN_STEPS.slice(0, i).reduce((sum, s) => sum + s.durationMs, 0);
        return elapsedMs >= stepStart ? i : idx;
      }, 0)
    : -1;

  return (
    <div data-testid="manual-scan-trigger" className="rounded-xl border border-white/5 bg-surface-dark p-4">
      {/* ── Header row: title + button ─────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">Check AI Mentions Now</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {isRunning
              ? `Scanning in progress — ${formatElapsed(elapsedMs)} elapsed`
              : isComplete
              ? 'Scan complete! Refresh the page to see updated scores.'
              : isFailed
              ? 'Last scan encountered an error. You can try again.'
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
            <CheckCircle className="h-4 w-4" aria-hidden="true" />
          ) : isFailed ? (
            <XCircle className="h-4 w-4" aria-hidden="true" />
          ) : (
            <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} aria-hidden="true" />
          )}
          {isRunning ? 'Scanning\u2026' : isComplete ? 'Complete' : isFailed ? 'Retry Scan' : 'Run Scan'}
        </button>
      </div>

      {/* ── Progress tracker (visible while scanning) ──────────────────── */}
      {isRunning && (
        <div className="mt-4 space-y-3" data-testid="scan-progress">
          {/* Animated progress bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-signal-green transition-all duration-1000 ease-out"
              style={{
                width: `${Math.min(95, (elapsedMs / 180_000) * 100)}%`,
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
          </div>

          {/* Step indicators */}
          <div className="flex flex-col gap-2">
            {SCAN_STEPS.map((step, i) => {
              const StepIcon = step.icon;
              const isActive = i === currentStepIndex;
              const isDone = i < currentStepIndex;

              return (
                <div
                  key={step.label}
                  className={`flex items-center gap-2.5 text-xs transition-opacity duration-300 ${
                    isActive ? 'text-signal-green opacity-100' : isDone ? 'text-slate-500 opacity-70' : 'text-slate-600 opacity-40'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle className="h-3.5 w-3.5 shrink-0 text-signal-green/60" aria-hidden="true" />
                  ) : isActive ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
                  ) : (
                    <StepIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span>{step.label}{isActive ? '\u2026' : ''}</span>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-500">
            This usually takes 2–5 minutes. You can leave this page — the scan continues in the background.
          </p>
        </div>
      )}

      {/* ── Completion banner ──────────────────────────────────────────── */}
      {isComplete && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-signal-green/5 px-3 py-2 ring-1 ring-inset ring-signal-green/10">
          <CheckCircle className="h-4 w-4 shrink-0 text-signal-green" aria-hidden="true" />
          <p className="text-xs text-signal-green">
            Your AI visibility scores have been updated. Refresh the page to see the latest results.
          </p>
        </div>
      )}

      {/* ── Failure banner ─────────────────────────────────────────────── */}
      {isFailed && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-alert-amber/5 px-3 py-2 ring-1 ring-inset ring-alert-amber/10">
          <XCircle className="h-4 w-4 shrink-0 text-alert-amber" aria-hidden="true" />
          <p className="text-xs text-alert-amber">
            The scan ran into an issue. This sometimes happens with AI model timeouts. Try again in a few minutes.
          </p>
        </div>
      )}

      {errorMsg && (
        <p data-testid="manual-scan-error" className="mt-2 text-xs text-alert-amber">{errorMsg}</p>
      )}
    </div>
  );
}
