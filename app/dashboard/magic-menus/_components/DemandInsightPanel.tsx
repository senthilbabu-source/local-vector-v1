'use client';

import { TrendingUp } from 'lucide-react';
import type { MenuDemandResult } from '@/lib/menu-intelligence/demand-analyzer';

// ---------------------------------------------------------------------------
// S24: Demand Insight Panel — top 3 AI-searched items
// Only shown when at least one item has mention_count > 0.
// ---------------------------------------------------------------------------

interface DemandInsightPanelProps {
  demandResults: MenuDemandResult[];
}

export default function DemandInsightPanel({ demandResults }: DemandInsightPanelProps) {
  const topItems = demandResults
    .filter((r) => r.mention_count > 0)
    .slice(0, 3);

  if (topItems.length === 0) return null;

  return (
    <div
      className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-5 py-4"
      data-testid="demand-insight-panel"
    >
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="h-4 w-4 text-violet-400" aria-hidden="true" />
        <span className="text-sm font-semibold text-violet-300">AI Demand Signals</span>
      </div>
      <p className="text-sm text-slate-300">
        Top AI-searched items:{' '}
        {topItems.map((item, i) => (
          <span key={item.item_id}>
            <strong className="text-white">{item.item_name}</strong>
            {' '}({item.mention_count}&times;)
            {i < topItems.length - 1 ? ', ' : ''}
          </span>
        ))}
        . Consider highlighting these in your description.
      </p>
    </div>
  );
}
