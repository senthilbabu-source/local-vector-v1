// ---------------------------------------------------------------------------
// app/dashboard/_components/SOVTrendChart.tsx — SOV Trend Line Chart
//
// Surgery 4: Client component showing share-of-voice trend over time.
// Uses recharts (lightweight, React-native charting library).
//
// Design tokens from globals.css: signal-green, alert-crimson, surface-dark.
// Tailwind classes match existing dashboard aesthetic.
//
// Props:
//   data — array of { date: string, sov: number } from visibility_analytics.
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

export interface SOVDataPoint {
    /** ISO date string or display label (e.g. "Feb 10") */
    date: string;
    /** Share of Voice percentage 0–100 */
    sov: number;
}

interface SOVTrendChartProps {
    data: SOVDataPoint[];
    title?: string;
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
                {payload[0].value}% SOV
            </p>
        </div>
    );
}

// ---------------------------------------------------------------------------
// SOVTrendChart
// ---------------------------------------------------------------------------

export default function SOVTrendChart({ data, title = 'AI Visibility Trend' }: SOVTrendChartProps) {
    if (data.length === 0) {
        return (
            <div className="rounded-xl bg-surface-dark border border-white/5 p-5">
                <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
                <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
                    No visibility data yet — first SOV scan populates this chart.
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
        <div className="rounded-xl bg-surface-dark border border-white/5 p-5">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-semibold text-white">{title}</h3>
                    <InfoTooltip content={TOOLTIP_CONTENT.shareOfVoice} />
                </div>
                <Link href="/dashboard/share-of-voice" className="text-xs text-primary hover:underline flex items-center gap-1">
                    View details
                    <ChevronRight className="h-3 w-3" />
                </Link>
            </div>
            <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="sovGradient" x1="0" y1="0" x2="0" y2="1">
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
                        tick={{ fill: '#64748B', fontSize: 11 }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
                        tickLine={false}
                    />
                    <YAxis
                        domain={[0, 100]}
                        tick={{ fill: '#64748B', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => `${v}%`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                        type="monotone"
                        dataKey="sov"
                        stroke="#00F5A0"
                        strokeWidth={2}
                        fill="url(#sovGradient)"
                        dot={{ fill: '#00F5A0', r: 3, strokeWidth: 0 }}
                        activeDot={{ fill: '#00F5A0', r: 5, strokeWidth: 2, stroke: '#050A15' }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
