// ---------------------------------------------------------------------------
// ScanCompleteBanner — P3-FIX-13: Success banner after first scan completes
//
// Shown briefly (auto-dismisses after 8 seconds) when the first real scan
// has completed within the last 24 hours. Uses localStorage to only show once.
// ---------------------------------------------------------------------------

'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';

const STORAGE_KEY = 'lv_scan_complete_banner_shown';

interface ScanCompleteBannerProps {
  isFirstScanRecent: boolean;
}

export function ScanCompleteBanner({ isFirstScanRecent }: ScanCompleteBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isFirstScanRecent) return;

    // Only show once per browser
    const alreadyShown =
      typeof window !== 'undefined' &&
      localStorage.getItem(STORAGE_KEY) === 'true';

    if (!alreadyShown) {
      setVisible(true);
      localStorage.setItem(STORAGE_KEY, 'true');

      // Auto-dismiss after 8 seconds
      const timer = setTimeout(() => setVisible(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [isFirstScanRecent]);

  if (!visible) return null;

  return (
    <div
      className="mb-4 flex items-start gap-3 rounded-xl border border-signal-green/30 bg-signal-green/10 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300"
      data-testid="scan-complete-banner"
      role="status"
    >
      <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-signal-green" />
      <div className="flex-1 text-sm">
        <p className="font-medium text-signal-green">
          Your first AI visibility scan is complete!
        </p>
        <p className="mt-0.5 text-signal-green/80">
          Real data is now showing across your dashboard. Scans run automatically every week.
        </p>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="ml-2 mt-0.5 rounded text-signal-green/60 hover:text-signal-green focus:outline-none focus:ring-2 focus:ring-signal-green"
        aria-label="Dismiss scan complete notice"
        data-testid="scan-complete-banner-dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
