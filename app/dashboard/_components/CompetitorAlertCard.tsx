'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, X } from 'lucide-react';
import type { CompetitorChange } from '@/lib/services/competitor-watch';

// ---------------------------------------------------------------------------
// S46: CompetitorAlertCard — competitor SOV change alert on dashboard
// Growth+ only. Dismissible via localStorage.
// ---------------------------------------------------------------------------

interface CompetitorAlertCardProps {
  changes: CompetitorChange[];
  isGrowthPlus: boolean;
}

const STORAGE_KEY = 'lv_competitor_alert_dismissed';

function getDismissedKey(): string {
  // Dismiss key changes weekly so alerts re-appear next week
  const now = new Date();
  const weekNum = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
  return `${STORAGE_KEY}_${weekNum}`;
}

export default function CompetitorAlertCard({ changes, isGrowthPlus }: CompetitorAlertCardProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && localStorage.getItem(getDismissedKey())) {
        setDismissed(true);
      }
    } catch (_e) {
      // localStorage not available
    }
  }, []);

  if (!isGrowthPlus || changes.length === 0 || dismissed) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(getDismissedKey(), '1');
    } catch (_e) {
      // Silent fail
    }
    setDismissed(true);
  };

  const topChange = changes[0];

  return (
    <section
      className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3"
      data-testid="competitor-alert-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {topChange.direction === 'up' ? (
              <TrendingUp className="h-4 w-4 text-amber-400" aria-hidden="true" />
            ) : (
              <TrendingDown className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              {topChange.name}{' '}
              {topChange.direction === 'up' ? 'jumped' : 'dropped'}{' '}
              {topChange.deltaPct}% in AI mentions this week
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {topChange.currentMentions} mentions (was {topChange.previousMentions})
              {changes.length > 1 && ` · ${changes.length - 1} more changes`}
            </p>
            <a
              href="/dashboard/compete"
              className="mt-1 inline-block text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
            >
              View competitor details &rarr;
            </a>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 text-slate-500 hover:text-white transition-colors"
          aria-label="Dismiss"
          data-testid="dismiss-competitor-alert"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
