// ---------------------------------------------------------------------------
// SampleModeBanner — Sprint B (C4)
//
// Shown at the top of the dashboard when in sample mode.
// Explains what sample data is. Dismissible (sessionStorage — reappears on
// next login). Auto-hides when sample mode becomes false.
// ---------------------------------------------------------------------------

'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface SampleModeBannerProps {
  nextScanDate: string;
}

export function SampleModeBanner({ nextScanDate }: SampleModeBannerProps) {
  const [dismissed, setDismissed] = useState(() =>
    typeof window !== 'undefined'
      ? sessionStorage.getItem('lv_sample_banner_dismissed') === 'true'
      : false
  );

  if (dismissed) return null;

  return (
    <div
      className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200/30 bg-amber-900/10 px-4 py-3"
      data-testid="sample-mode-banner"
      role="status"
    >
      <span className="mt-0.5 text-amber-400 shrink-0" aria-hidden="true">&#9670;</span>
      <div className="flex-1 text-sm text-amber-200/90">
        <p className="font-medium text-amber-100">You&apos;re looking at sample data.</p>
        <p className="mt-0.5 text-amber-300/80">
          Your first automated scan runs on <strong className="text-amber-100">{nextScanDate}</strong>.
          These cards will populate with your real AI visibility data after that scan completes.
        </p>
      </div>
      <button
        onClick={() => {
          sessionStorage.setItem('lv_sample_banner_dismissed', 'true');
          setDismissed(true);
        }}
        className="ml-2 mt-0.5 rounded text-amber-400/60 hover:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
        aria-label="Dismiss sample data notice"
        data-testid="sample-banner-dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
