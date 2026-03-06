// ---------------------------------------------------------------------------
// FixSpotlightCard — S20 (AI_RULES §220)
//
// Green card celebrating a high-value fix (revenue_recovered_monthly >= $100).
// Shown for 7 days after fix. Dismissible via localStorage.
// ---------------------------------------------------------------------------

'use client';

import { useState, useEffect } from 'react';
import { Trophy, X } from 'lucide-react';

export interface SpotlightFix {
  id: string;
  category: string | null;
  model_provider: string;
  revenue_recovered_monthly: number;
  fixed_at: string;
}

interface FixSpotlightCardProps {
  fix: SpotlightFix;
}

const STORAGE_PREFIX = 'lv_fix_spotlight_';

export default function FixSpotlightCard({ fix }: FixSpotlightCardProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const key = `${STORAGE_PREFIX}${fix.id}`;
    setDismissed(localStorage.getItem(key) === '1');
  }, [fix.id]);

  if (dismissed) return null;

  const category = fix.category ?? 'an AI error';
  const model = fix.model_provider.replace(/-/g, ' ');

  function handleDismiss() {
    localStorage.setItem(`${STORAGE_PREFIX}${fix.id}`, '1');
    setDismissed(true);
  }

  return (
    <div
      data-testid="fix-spotlight-card"
      className="relative rounded-xl border border-green-400/20 bg-green-400/5 px-5 py-4"
    >
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-3 text-slate-400 hover:text-white transition"
        aria-label="Dismiss spotlight"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <Trophy className="mt-0.5 h-5 w-5 text-yellow-400 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-green-400">
            You recovered ${fix.revenue_recovered_monthly.toLocaleString()}/mo this week
          </p>
          <p className="mt-1 text-xs text-slate-400">
            by correcting {category} on {model}
          </p>
        </div>
      </div>
    </div>
  );
}
