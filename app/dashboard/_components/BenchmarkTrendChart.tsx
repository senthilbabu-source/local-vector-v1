'use client';

// ---------------------------------------------------------------------------
// BenchmarkTrendChart.tsx — Sprint 122: Benchmark Comparisons
//
// 8-week sparkline of percentile rank trend using recharts.
// History MUST be ASC order (oldest→newest) for trend direction to be correct.
// ---------------------------------------------------------------------------

import type { OrgBenchmarkResult } from '@/lib/services/benchmark-service';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

interface BenchmarkTrendChartProps {
  history: OrgBenchmarkResult[];
}

export default function BenchmarkTrendChart({ history }: BenchmarkTrendChartProps) {
  if (history.length < 2) {
    return (
      <p
        className="text-xs text-slate-500"
        data-testid="benchmark-trend-chart"
      >
        Not enough history yet.
      </p>
    );
  }

  const first = history[0].percentile_rank;
  const last = history[history.length - 1].percentile_rank;

  let trendTestId: string;
  let trendLabel: string;
  let trendColor: string;

  if (last > first) {
    trendTestId = 'benchmark-trend-improving';
    trendLabel = 'Improving';
    trendColor = '#22c55e'; // green
  } else if (last < first) {
    trendTestId = 'benchmark-trend-declining';
    trendLabel = 'Declining';
    trendColor = '#ef4444'; // red
  } else {
    trendTestId = 'benchmark-trend-stable';
    trendLabel = 'Stable';
    trendColor = '#94a3b8'; // gray
  }

  const chartData = history.map((h) => ({
    week: h.week_of,
    rank: h.percentile_rank,
  }));

  return (
    <div data-testid="benchmark-trend-chart">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-slate-400">
          8-Week Trend
        </span>
        <span
          className="text-xs font-medium"
          style={{ color: trendColor }}
          data-testid={trendTestId}
        >
          {trendLabel}
        </span>
      </div>
      <div className="h-12 w-full" role="img" aria-label={`Benchmark percentile trend. ${trendLabel}: from ${first}th to ${last}th percentile over ${chartData.length} weeks.`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <Line
              type="monotone"
              dataKey="rank"
              stroke={trendColor}
              strokeWidth={2}
              dot={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                fontSize: '11px',
              }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={(value: number) => [`${value}th %ile`, 'Rank']}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
