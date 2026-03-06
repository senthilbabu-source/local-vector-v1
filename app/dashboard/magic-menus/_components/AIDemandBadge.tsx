'use client';

import { Sparkles } from 'lucide-react';

// ---------------------------------------------------------------------------
// S24: AI Demand Badge — inline badge per menu item
// Shows "Mentioned N× in AI searches" when N > 0, muted otherwise.
// ---------------------------------------------------------------------------

interface AIDemandBadgeProps {
  itemId: string;
  mentionCount: number;
}

export default function AIDemandBadge({ itemId, mentionCount }: AIDemandBadgeProps) {
  if (mentionCount > 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-xs text-violet-300"
        data-testid={`ai-demand-badge-${itemId}`}
      >
        <Sparkles className="h-3 w-3" aria-hidden="true" />
        Mentioned {mentionCount}&times; in AI searches
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-500"
      data-testid={`ai-demand-badge-${itemId}`}
    >
      Not yet in AI searches
    </span>
  );
}
