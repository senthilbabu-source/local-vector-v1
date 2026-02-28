// ---------------------------------------------------------------------------
// PositioningBanner — Sprint D (M6)
//
// Shown at the top of the dashboard for new orgs (< 30 days old) that have
// real data (not in sample mode). Explains how LocalVector differs from
// traditional SEO tools (Yext, BrightLocal, Moz).
//
// Dismissed permanently via localStorage (unlike SampleModeBanner which uses
// sessionStorage). These two banners never appear simultaneously:
//   • SampleModeBanner → shown during sample mode (no scan yet)
//   • PositioningBanner → shown after sample mode ends, for first 30 days
// ---------------------------------------------------------------------------

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, X } from 'lucide-react';

const DISMISSED_KEY = 'lv_positioning_banner_dismissed';

export function PositioningBanner() {
  const [dismissed, setDismissed] = useState(() =>
    typeof window !== 'undefined'
      ? localStorage.getItem(DISMISSED_KEY) === 'true'
      : false,
  );

  if (dismissed) return null;

  return (
    <div
      className="mb-6 flex items-start gap-3 rounded-xl border border-electric-indigo/20 bg-electric-indigo/5 px-4 py-3"
      data-testid="positioning-banner"
      role="status"
    >
      <Sparkles className="mt-0.5 h-4 w-4 text-electric-indigo shrink-0" aria-hidden="true" />
      <div className="flex-1 text-sm">
        <p className="font-medium text-white">
          LocalVector measures a layer traditional SEO tools don&apos;t.
        </p>
        <p className="mt-0.5 text-slate-400">
          Traditional SEO tools track your Google search rankings.
          LocalVector tracks what AI models say about your business when
          customers ask them directly. These are separate measurements
          &mdash; your{' '}
          <span className="font-medium text-white">Reality Score</span>{' '}
          reflects AI visibility, which isn&apos;t captured by search ranking tools.{' '}
          <Link
            href="/dashboard/ai-responses"
            className="text-electric-indigo hover:underline font-medium"
          >
            See what AI says about your business &rarr;
          </Link>
        </p>
      </div>
      <button
        onClick={() => {
          localStorage.setItem(DISMISSED_KEY, 'true');
          setDismissed(true);
        }}
        className="ml-2 mt-0.5 rounded text-slate-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-electric-indigo"
        aria-label="Dismiss this notice"
        data-testid="positioning-banner-dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
