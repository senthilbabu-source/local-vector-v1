// ---------------------------------------------------------------------------
// app/dashboard/_components/RealityScoreTrendChart.tsx — P8-FIX-33
//
// Client component showing AI Health Score trend over time.
// Follows SOVTrendChart pattern: recharts AreaChart, dark theme, a11y.
//
// Props:
//   data — array of { date: string, score: number } from visibility_scores.
// ---------------------------------------------------------------------------

'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { TOOLTIP_CONTENT } from '@/lib/tooltip-content';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RealityScoreTrendPoint {
  /** ISO date string or display label */
  date: string;
  /** Reality score 0–100 */
  score: number;
}

interface RealityScoreTrendChartProps {
  data: RealityScoreTrendPoint[];
}

// ---------------------------------------------------------------------------
// Custom tooltip (matches dark theme)
// ---------------------------------------------------------------------------

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg bg-midnight-slate border border-white/10 px-3 py-2 shadow-lg">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-bold text-signal-green tabular-nums">
        Score: {payload[0].value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RealityScoreTrendChart
// ---------------------------------------------------------------------------

export default function RealityScoreTrendChart({ data }: RealityScoreTrendChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="rounded-xl bg-surface-dark border border-white/5 p-5"
        data-testid="reality-score-trend-chart"
      >
        <h3 className="text-sm font-semibold text-white mb-3">AI Health Score Trend</h3>
        <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
          No score history yet — your first weekly scan will populate this chart.
        </div>
      </div>
    );
  }

  // Format dates for display
  const chartData = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  return (
    <div
      className="rounded-xl bg-surface-dark border border-white/5 p-5"
      data-testid="reality-score-trend-chart"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-white">AI Health Score Trend</h3>
          <InfoTooltip content={TOOLTIP_CONTENT.realityScore} />
        </div>
        <Link href="/dashboard/entity-health" className="text-xs text-primary hover:underline flex items-center gap-1">
          View details
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
      <div
        role="img"
        aria-label={`AI Health Score trend chart showing ${chartData.length} data points. Latest score: ${chartData[chartData.length - 1]?.score ?? 0}.`}
      >
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="realityScoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00F5A0" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#00F5A0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: '#94A3B8', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#94A3B8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#00F5A0"
              strokeWidth={2}
              fill="url(#realityScoreGradient)"
              dot={{ fill: '#00F5A0', r: 3, strokeWidth: 0 }}
              activeDot={{ fill: '#00F5A0', r: 5, strokeWidth: 2, stroke: '#050A15' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {/* P6-FIX-27: Screen reader data table */}
      <table className="sr-only">
        <caption>AI Health Score Trend Data</caption>
        <thead><tr><th>Date</th><th>Score</th></tr></thead>
        <tbody>
          {chartData.map((d) => (
            <tr key={d.date}><td>{d.label}</td><td>{d.score}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
