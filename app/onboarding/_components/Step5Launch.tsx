'use client';

// ---------------------------------------------------------------------------
// Step5Launch — Sprint 91
//
// Triggers the first Fear Engine audit, polls for completion, then celebrates
// and redirects to the dashboard. Caps polling at 90 seconds with graceful
// degradation. Auto-redirect countdown after success.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { triggerFirstAudit, completeOnboarding } from '../actions';
import * as Sentry from '@sentry/nextjs';

type LaunchState = 'launching' | 'complete' | 'error';

const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_DURATION_MS = 90_000;
const REDIRECT_COUNTDOWN_S = 5;

export default function Step5Launch() {
  const router = useRouter();
  const [state, setState] = useState<LaunchState>('launching');
  const [countdown, setCountdown] = useState(REDIRECT_COUNTDOWN_S);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(Date.now());
  const hasTriggeredRef = useRef(false);
  const hasCompletedRef = useRef(false);

  const finishOnboarding = useCallback(
    async (launchState: 'complete' | 'error') => {
      if (hasCompletedRef.current) return;
      hasCompletedRef.current = true;

      // Clean up poll timer
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }

      // Mark onboarding complete (fire-and-forget on error)
      await completeOnboarding().catch((err: unknown) =>
        console.error('[step5] completeOnboarding failed:', err),
      );

      setState(launchState);

      // Start redirect countdown
      setCountdown(REDIRECT_COUNTDOWN_S);
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current);
              countdownTimerRef.current = null;
            }
            router.push('/dashboard');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [router],
  );

  useEffect(() => {
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;
    startTimeRef.current = Date.now();

    // Fire the audit (non-blocking — failure still allows onboarding to complete)
    triggerFirstAudit().then((result) => {
      if (!result.success) {
        console.warn('[step5] Audit trigger failed:', result.error);
      }
    });

    // Start polling for audit completion
    pollTimerRef.current = setInterval(async () => {
      // Check timeout
      if (Date.now() - startTimeRef.current > MAX_POLL_DURATION_MS) {
        void finishOnboarding('error');
        return;
      }

      try {
        const res = await fetch('/api/onboarding/audit-status');
        if (!res.ok) return;

        const data = (await res.json()) as { status: string; auditId?: string };
        if (data.status === 'complete') {
          void finishOnboarding('complete');
        }
      } catch (err) {
        Sentry.captureException(err, { tags: { file: 'Step5Launch.tsx', sprint: 'A' } });
        // Ignore fetch errors — keep polling
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [finishOnboarding]);

  // ── Launching state ──────────────────────────────────────────────────────
  if (state === 'launching') {
    return (
      <div data-testid="step5-launching-state" className="text-center py-8 space-y-6">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-signal-green/10 text-3xl">
          &#128640;
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white mb-2">
            Launching your AI Visibility Engine...
          </h2>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            Running your first AI audit across ChatGPT, Perplexity,
            Google Gemini, and Microsoft Copilot...
          </p>
        </div>
        <p className="text-xs text-slate-500">
          This takes about 30–60 seconds.
        </p>

        {/* Spinner */}
        <div className="flex justify-center">
          <svg className="h-8 w-8 animate-spin text-signal-green" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      </div>
    );
  }

  // ── Complete state ─────────────────────────────────────────────────────
  if (state === 'complete') {
    return (
      <div data-testid="step5-complete-state" className="text-center py-8 space-y-6">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-signal-green/20 text-signal-green text-3xl">
          &#10003;
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white mb-2">
            You&apos;re live! Your AI visibility profile is ready.
          </h2>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            We checked 4 AI engines for mentions of your business.
            Your Risk Dashboard is now populated.
          </p>
        </div>
        <button
          data-testid="step5-dashboard-btn"
          type="button"
          onClick={() => router.push('/dashboard')}
          className="rounded-lg bg-signal-green px-6 py-2.5 text-sm font-semibold text-deep-navy hover:brightness-110 transition"
        >
          Go to My Dashboard &rarr;
        </button>
        <p data-testid="step5-countdown" className="text-xs text-slate-500">
          Auto-redirecting in {countdown} second{countdown !== 1 ? 's' : ''}...
        </p>
      </div>
    );
  }

  // ── Error / graceful degradation state ──────────────────────────────────
  return (
    <div data-testid="step5-error-state" className="text-center py-8 space-y-6">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-signal-green/20 text-signal-green text-3xl">
        &#10003;
      </div>
      <div>
        <h2 className="text-lg font-semibold text-white mb-2">
          You&apos;re set up! Your profile is ready.
        </h2>
        <p className="text-sm text-slate-400 max-w-sm mx-auto">
          Your first AI audit is queued and will complete within
          the next few minutes. Check back shortly.
        </p>
      </div>
      <button
        data-testid="step5-dashboard-btn"
        type="button"
        onClick={() => router.push('/dashboard')}
        className="rounded-lg bg-signal-green px-6 py-2.5 text-sm font-semibold text-deep-navy hover:brightness-110 transition"
      >
        Go to My Dashboard &rarr;
      </button>
      <p data-testid="step5-countdown" className="text-xs text-slate-500">
        Auto-redirecting in {countdown} second{countdown !== 1 ? 's' : ''}...
      </p>
    </div>
  );
}
