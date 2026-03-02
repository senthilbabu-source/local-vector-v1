'use client';

// ---------------------------------------------------------------------------
// OnboardingInterstitial.tsx — First-login modal (Sprint 117)
//
// Full-screen modal overlay shown when show_interstitial = true.
// Dismissed via localStorage. Uses createPortal to render over dashboard.
// ---------------------------------------------------------------------------

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';

const DISMISS_KEY = 'lv_interstitial_dismissed';

interface OnboardingInterstitialProps {
  show: boolean;
}

export default function OnboardingInterstitial({ show }: OnboardingInterstitialProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (show && typeof window !== 'undefined') {
      const wasDismissed = localStorage.getItem(DISMISS_KEY) === 'true';
      if (!wasDismissed) {
        setVisible(true);
      }
    }
  }, [show]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, 'true');
  };

  if (!mounted || !visible) return null;

  const content = (
    <div
      data-testid="onboarding-interstitial"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="mx-4 max-w-md rounded-xl border border-white/10 bg-[#0A1628] p-8 shadow-2xl">
        <h2 className="mb-2 text-xl font-bold text-slate-100">
          Welcome to LocalVector {'\uD83D\uDC4B'}
        </h2>
        <p className="mb-6 text-sm text-slate-400">
          Here&apos;s how to get the most out of your AI visibility platform in 5 minutes:
        </p>

        <ol className="mb-6 space-y-4">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
              1
            </span>
            <div>
              <p className="text-sm font-medium text-slate-200">Complete your profile</p>
              <p className="text-xs text-slate-400">So we know which AI queries to track</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
              2
            </span>
            <div>
              <p className="text-sm font-medium text-slate-200">Your first scan runs Sunday</p>
              <p className="text-xs text-slate-400">We&apos;ll email you when your score is ready</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
              3
            </span>
            <div>
              <p className="text-sm font-medium text-slate-200">Review content recommendations</p>
              <p className="text-xs text-slate-400">AI-generated drafts to improve visibility</p>
            </div>
          </li>
        </ol>

        <div className="flex gap-3">
          <button
            data-testid="onboarding-interstitial-cta"
            onClick={() => {
              dismiss();
              router.push('/dashboard/settings/profile');
            }}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
          >
            Let&apos;s get started →
          </button>
          <button
            data-testid="onboarding-interstitial-skip"
            onClick={dismiss}
            className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
