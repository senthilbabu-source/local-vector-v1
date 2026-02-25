'use client';

import { BarChart } from '@/components/tremor';
import type { LeakBreakdown } from '@/lib/services/revenue-leak.service';

interface LeakBreakdownChartProps {
  breakdown: LeakBreakdown;
}

export default function LeakBreakdownChart({ breakdown }: LeakBreakdownChartProps) {
  const data = [
    {
      name: 'Inaccuracies',
      'Low Estimate': breakdown.hallucination_cost.low,
      'High Estimate': breakdown.hallucination_cost.high,
    },
    {
      name: 'SOV Gap',
      'Low Estimate': breakdown.sov_gap_cost.low,
      'High Estimate': breakdown.sov_gap_cost.high,
    },
    {
      name: 'Competitor Steal',
      'Low Estimate': breakdown.competitor_steal_cost.low,
      'High Estimate': breakdown.competitor_steal_cost.high,
    },
  ];

  return (
    <div
      className="rounded-2xl bg-surface-dark border border-white/5 px-5 py-4"
      data-testid="leak-breakdown-chart"
    >
      <p
        className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500"
        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
      >
        Leak Breakdown
      </p>
      <BarChart
        data={data}
        index="name"
        categories={['Low Estimate', 'High Estimate']}
        colors={['amber', 'pink']}
        valueFormatter={(v: number) =>
          new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
          }).format(v)
        }
        yAxisWidth={60}
        className="h-52"
      />
    </div>
  );
}
