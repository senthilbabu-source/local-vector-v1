'use client';

import { TrendingUp } from 'lucide-react';
import type { MenuDemandResult } from '@/lib/menu-intelligence/demand-analyzer';

// ---------------------------------------------------------------------------
// S36: DemandSignalsTeaser — top 3 AI-mentioned menu items on dashboard
// Hidden when no data or in sample mode.
// ---------------------------------------------------------------------------

interface DemandSignalsTeaserProps {
  items: MenuDemandResult[];
  sampleMode: boolean;
}

export default function DemandSignalsTeaser({ items, sampleMode }: DemandSignalsTeaserProps) {
  if (sampleMode || items.length === 0) return null;

  return (
    <section
      className="rounded-2xl bg-surface-dark border border-white/5 px-5 py-4"
      data-testid="demand-signals-teaser"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-violet-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-white">What AI Is Talking About</h2>
        </div>
        <a
          href="/dashboard/magic-menus"
          className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
          data-testid="demand-signals-see-all"
        >
          See all demand signals &rarr;
        </a>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.item_id}
            className="flex items-center gap-3 rounded-xl bg-violet-500/5 border border-violet-500/10 px-3 py-2"
            data-testid="demand-signal-item"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate" title={item.item_name}>
                {item.item_name}
              </p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-violet-400">
              {item.mention_count}&times;
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
