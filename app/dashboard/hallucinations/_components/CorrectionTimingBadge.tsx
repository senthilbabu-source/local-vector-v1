'use client';

import { Clock } from 'lucide-react';

// ---------------------------------------------------------------------------
// S23: Correction Timing Badge
//
// Shows "Corrected in N days — faster than X% of corrections we've tracked"
// on resolved hallucination cards when benchmark data is available.
// ---------------------------------------------------------------------------

interface CorrectionTimingBadgeProps {
  daysToFix: number;
  percentile: number; // 1-99
}

export default function CorrectionTimingBadge({ daysToFix, percentile }: CorrectionTimingBadgeProps) {
  const daysLabel = daysToFix < 1
    ? 'less than a day'
    : `${Math.round(daysToFix)} day${Math.round(daysToFix) === 1 ? '' : 's'}`;

  return (
    <div
      className="flex items-center gap-2 rounded-lg bg-signal-green/10 border border-signal-green/20 px-3 py-2 text-xs"
      data-testid="correction-timing-badge"
    >
      <Clock className="h-3.5 w-3.5 text-signal-green shrink-0" aria-hidden="true" />
      <span className="text-slate-300">
        Corrected in {daysLabel} — faster than {percentile}% of corrections we&apos;ve tracked
      </span>
    </div>
  );
}
