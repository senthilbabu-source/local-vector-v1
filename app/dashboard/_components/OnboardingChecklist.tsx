'use client';

// ---------------------------------------------------------------------------
// OnboardingChecklist.tsx — Setup progress widget (Sprint 117, P0-FIX-03)
//
// Fetches from GET /api/onboarding/state on mount. Shows on the main
// dashboard page until all steps complete. Dismiss via localStorage.
//
// P0-FIX-03: Now renders only plan-visible steps from the state response
// instead of the static ONBOARDING_STEPS array.
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import { ONBOARDING_STEPS } from '@/lib/onboarding/types';
import type { OnboardingState } from '@/lib/onboarding/types';

const DISMISS_KEY = 'lv_onboarding_dismissed';

interface OnboardingChecklistProps {
  initialState?: OnboardingState | null;
}

export default function OnboardingChecklist({ initialState }: OnboardingChecklistProps) {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState | null>(initialState ?? null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(!initialState);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/onboarding/state');
      if (res.ok) {
        const data: OnboardingState = await res.json();
        setState(data);
      }
    } catch (err) {
      Sentry.captureException(err);
    }
  }, []);

  useEffect(() => {
    // Check localStorage for dismiss
    if (typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY) === 'true') {
      setDismissed(true);
    }

    if (!initialState) {
      fetchState().finally(() => setLoading(false));
    }

    // Poll every 30 seconds while visible
    const interval = setInterval(fetchState, 30_000);
    const onFocus = () => fetchState();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [initialState, fetchState]);

  if (loading || !state || state.is_complete || dismissed) return null;

  const progress = state.total_steps > 0
    ? Math.round((state.completed_steps / state.total_steps) * 100)
    : 0;

  return (
    <div data-testid="onboarding-checklist" className="mb-6 rounded-lg border border-white/10 bg-[#0A1628] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">
          Getting Started ({state.completed_steps}/{state.total_steps})
        </h3>
        <button
          data-testid="onboarding-dismiss-btn"
          onClick={() => {
            setDismissed(true);
            localStorage.setItem(DISMISS_KEY, 'true');
          }}
          className="text-slate-400 hover:text-slate-300 text-xs"
          aria-label="Dismiss onboarding checklist"
        >
          {'\u2715'}
        </button>
      </div>

      {/* Progress bar */}
      <div data-testid="onboarding-progress-bar" className="mb-4 h-2 w-full rounded-full bg-white/5">
        <div
          className="h-2 rounded-full bg-indigo-600 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps — render only plan-visible steps from state */}
      <ul className="space-y-2">
        {state.steps.map((stepState) => {
          const step = ONBOARDING_STEPS.find((s) => s.id === stepState.step_id);
          if (!step) return null;

          const isComplete = stepState.completed;

          return (
            <li
              key={step.id}
              data-testid={`onboarding-step-${step.id}`}
              className="flex items-center justify-between text-sm"
            >
              <span className={isComplete ? 'text-slate-400 line-through' : 'text-slate-300'}>
                {isComplete ? '\u2705' : '\u25CB'}{' '}
                {step.label}
              </span>
              {!isComplete && (
                step.auto_completable ? (
                  <span className="text-xs text-slate-400">
                    {step.id === 'first_scan'
                      ? 'Scan runs every Sunday'
                      : 'Will complete automatically'}
                  </span>
                ) : (
                  <button
                    data-testid={`onboarding-step-${step.id}-action`}
                    onClick={() => router.push(step.action_url)}
                    className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
                  >
                    {step.action_label} →
                  </button>
                )
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
