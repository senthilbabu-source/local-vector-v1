// ---------------------------------------------------------------------------
// CategoryBreakdownChart — Sprint 58C: Bar chart of citation rates by category
// ---------------------------------------------------------------------------

'use client';

import type { QueryCategory, CategoryBreakdown } from '@/lib/types/prompt-intelligence';

interface Props {
  breakdown: Record<QueryCategory, CategoryBreakdown>;
}

const CATEGORY_LABELS: Record<QueryCategory, string> = {
  discovery: 'Discovery',
  comparison: 'Comparison',
  occasion: 'Occasion',
  near_me: 'Near Me',
  custom: 'Custom',
};

const CATEGORY_ORDER: QueryCategory[] = ['discovery', 'near_me', 'comparison', 'occasion', 'custom'];

export default function CategoryBreakdownChart({ breakdown }: Props) {
  // Filter out categories with no queries
  const categories = CATEGORY_ORDER.filter((cat) => breakdown[cat]?.totalCount > 0);

  if (categories.length === 0) return null;

  return (
    <div className="rounded-2xl bg-surface-dark border border-white/5 p-5">
      <h2 className="text-sm font-semibold text-white tracking-tight mb-4">
        Citation Rate by Category
      </h2>
      <div className="space-y-3">
        {categories.map((cat) => {
          const data = breakdown[cat];
          const rate = Math.round(data.citationRate);
          const barColor =
            rate >= 70 ? 'bg-signal-green' :
            rate >= 40 ? 'bg-alert-amber' :
            'bg-alert-crimson';

          return (
            <div key={cat}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-300">
                  {CATEGORY_LABELS[cat]}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">
                    {data.citedCount}/{data.totalCount}
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-white">
                    {rate}%
                  </span>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${rate}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
