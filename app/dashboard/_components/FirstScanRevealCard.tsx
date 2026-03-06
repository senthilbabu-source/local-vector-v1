'use client';

import { useEffect, useState } from 'react';
import { X, AlertTriangle, TrendingDown, Eye } from 'lucide-react';

const STORAGE_KEY = 'lv_first_reveal_shown';

interface FirstScanRevealProps {
  sovPercent: number | null;
  errorCount: number;
  monthlyImpact: number;
  criticalClaimText: string | null;
}

export default function FirstScanRevealCard({
  sovPercent,
  errorCount,
  monthlyImpact,
  criticalClaimText,
}: FirstScanRevealProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const alreadyShown = sessionStorage.getItem(STORAGE_KEY);
    if (!alreadyShown) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem(STORAGE_KEY, '1');
  };

  if (!visible) return null;

  return (
    <div
      data-testid="first-scan-reveal-card"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in"
      style={{ animationDuration: '300ms' }}
    >
      <div className="relative mx-4 max-w-lg w-full rounded-2xl bg-surface-dark border border-white/10 p-8 shadow-2xl">
        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 text-slate-500 hover:text-slate-300 transition"
          aria-label="Dismiss"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-lg font-semibold text-white">
          Here&apos;s what AI is saying about your business
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          We just scanned the top AI models. Here&apos;s your first snapshot.
        </p>

        {/* Stats grid */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          {/* AI Mentions */}
          <div className="rounded-xl bg-white/5 p-4 text-center">
            <Eye className="mx-auto h-5 w-5 text-electric-indigo" aria-hidden="true" />
            <p className="mt-2 text-2xl font-bold text-white tabular-nums">
              {sovPercent !== null ? `${sovPercent}%` : '—'}
            </p>
            <p className="text-xs text-slate-400">AI Mentions</p>
          </div>

          {/* Errors */}
          <div className="rounded-xl bg-white/5 p-4 text-center">
            <AlertTriangle className="mx-auto h-5 w-5 text-alert-amber" aria-hidden="true" />
            <p className="mt-2 text-2xl font-bold text-white tabular-nums">{errorCount}</p>
            <p className="text-xs text-slate-400">AI Errors Found</p>
          </div>

          {/* Impact */}
          <div className="rounded-xl bg-white/5 p-4 text-center">
            <TrendingDown className="mx-auto h-5 w-5 text-alert-crimson" aria-hidden="true" />
            <p className="mt-2 text-2xl font-bold text-white tabular-nums">
              -${Math.round(monthlyImpact).toLocaleString()}
            </p>
            <p className="text-xs text-slate-400">Monthly Impact</p>
          </div>
        </div>

        {/* Critical quote */}
        {criticalClaimText && (
          <div className="mt-4 rounded-lg bg-alert-crimson/10 border border-alert-crimson/20 p-3">
            <p className="text-xs text-slate-300 italic">
              &ldquo;{criticalClaimText}&rdquo;
            </p>
            <p className="mt-1 text-xs text-alert-crimson font-medium">
              Most critical AI error found
            </p>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={dismiss}
          className="mt-6 w-full rounded-lg bg-signal-green px-4 py-2.5 text-sm font-semibold text-deep-navy hover:bg-signal-green/90 transition"
        >
          See your personalized fix plan
        </button>
      </div>
    </div>
  );
}
