'use client';

// ---------------------------------------------------------------------------
// components/dashboard/TrialWarningBanner.tsx — PLG-MECHANICS.md §2
//
// Shown inside the dashboard main content area when:
//   • plan === 'trial'
//   • org is between 7 and 14 days old
//
// Shows the open hallucination count and a direct link to billing.
// Dismissible via localStorage (one-shot per session — resets on page load).
// AI_RULES §211.
// ---------------------------------------------------------------------------

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, AlertTriangle } from 'lucide-react';

interface TrialWarningBannerProps {
  plan: string | null;
  orgCreatedAt: string | null;
  openHallucinationCount?: number;
}

function daysSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
}

export default function TrialWarningBanner({
  plan,
  orgCreatedAt,
  openHallucinationCount = 0,
}: TrialWarningBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Read sessionStorage on mount only (avoids hydration mismatch)
  useEffect(() => {
    if (sessionStorage.getItem('lv_trial_warning_dismissed') === '1') {
      setDismissed(true);
    }
  }, []);

  // Only show for trial plan
  if (plan !== 'trial') return null;
  // Only show if org age is between 7 and 14 days
  if (!orgCreatedAt) return null;
  const age = daysSince(orgCreatedAt);
  if (age < 7 || age > 14) return null;
  if (dismissed) return null;

  const daysLeft = 14 - age;
  const issueText =
    openHallucinationCount > 0
      ? `${openHallucinationCount} AI issue${openHallucinationCount === 1 ? '' : 's'} still unresolved.`
      : 'Monitor and fix AI issues automatically.';

  function handleDismiss() {
    sessionStorage.setItem('lv_trial_warning_dismissed', '1');
    setDismissed(true);
  }

  return (
    <div
      role="alert"
      className="relative mb-4 flex items-center gap-3 rounded-lg border px-4 py-3"
      style={{
        borderColor: 'rgba(251,191,36,0.35)',
        backgroundColor: 'rgba(251,191,36,0.07)',
      }}
    >
      <AlertTriangle
        className="h-4 w-4 shrink-0"
        style={{ color: '#FBBF24' }}
        aria-hidden
      />

      <p className="flex-1 text-sm" style={{ color: '#CBD5E1' }}>
        <span className="font-semibold" style={{ color: '#F1F5F9' }}>
          Your free audit ends in {daysLeft} day{daysLeft === 1 ? '' : 's'}.
        </span>{' '}
        {issueText}
      </p>

      <Link
        href="/dashboard/billing"
        className="shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition hover:opacity-90"
        style={{ backgroundColor: '#FBBF24', color: '#0A1628' }}
      >
        Upgrade to Starter →
      </Link>

      <button
        onClick={handleDismiss}
        className="shrink-0 rounded p-1 text-slate-400 hover:text-white transition"
        aria-label="Dismiss trial warning"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
