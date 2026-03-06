// ---------------------------------------------------------------------------
// HealthStreakBadge — S20 (AI_RULES §220)
//
// Flame icon + "{N}-week streak" badge on main dashboard header.
// Hidden when streak < 2. Respects prefers-reduced-motion.
// ---------------------------------------------------------------------------

'use client';

import { Flame } from 'lucide-react';

interface HealthStreakBadgeProps {
  streak: number;
}

export default function HealthStreakBadge({ streak }: HealthStreakBadgeProps) {
  if (streak < 2) return null;

  return (
    <span
      data-testid="health-streak-badge"
      className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-400 ring-1 ring-orange-500/20 motion-safe:animate-pulse"
    >
      <Flame className="h-3.5 w-3.5" aria-hidden="true" />
      {streak}-week streak
    </span>
  );
}
