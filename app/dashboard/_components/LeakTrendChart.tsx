'use client';

import { AreaChart } from '@/components/tremor';

export interface LeakSnapshotPoint {
  snapshot_date: string;
  leak_high: number;
}

interface LeakTrendChartProps {
  snapshots: LeakSnapshotPoint[];
}

export default function LeakTrendChart({ snapshots }: LeakTrendChartProps) {
  if (snapshots.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl bg-surface-dark border border-white/5 px-5 py-4 h-[268px]"
        data-testid="leak-trend-chart"
      >
        <p className="text-sm text-slate-500">
          Revenue trend data will appear after the first weekly scan.
        </p>
      </div>
    );
  }

  // Determine trend direction: compare last vs first
  const firstVal = snapshots[0]?.leak_high ?? 0;
  const lastVal = snapshots[snapshots.length - 1]?.leak_high ?? 0;
  const trendingDown = lastVal < firstVal;

  const data = snapshots.map((s) => ({
    date: s.snapshot_date,
    'Revenue Leak': Math.round(s.leak_high),
  }));

  return (
    <div
      className="rounded-2xl bg-surface-dark border border-white/5 px-5 py-4"
      data-testid="leak-trend-chart"
    >
      <p
        className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500"
        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
      >
        Leak Trend
      </p>
      <AreaChart
        data={data}
        index="date"
        categories={['Revenue Leak']}
        colors={[trendingDown ? 'emerald' : 'pink']}
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
