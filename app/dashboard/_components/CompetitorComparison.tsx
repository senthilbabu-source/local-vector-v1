// ---------------------------------------------------------------------------
// app/dashboard/_components/CompetitorComparison.tsx — Competitor Visibility
//
// Surgery 4: Shows how your business compares to competitors in AI mentions.
// Uses a simple horizontal stacked bar for clarity.
//
// Data source: competitor_intercepts table aggregated by competitor name.
// ---------------------------------------------------------------------------

'use client';

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompetitorComparisonData {
    competitor: string;
    theirMentions: number;
    yourMentions: number;
}

interface CompetitorComparisonProps {
    data: CompetitorComparisonData[];
    businessName?: string;
    title?: string;
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

function CustomTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: { name: string; value: number; fill: string }[];
    label?: string;
}) {
    if (!active || !payload?.length) return null;

    return (
        <div className="rounded-lg bg-midnight-slate border border-white/10 px-3 py-2 shadow-lg">
            <p className="text-xs font-medium text-slate-300 mb-1">{label}</p>
            {payload.map((p) => (
                <p key={p.name} className="text-xs tabular-nums" style={{ color: p.fill }}>
                    {p.name}: {p.value} mention{p.value === 1 ? '' : 's'}
                </p>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// CompetitorComparison
// ---------------------------------------------------------------------------

export default function CompetitorComparison({
    data,
    businessName = 'You',
    title = 'AI Mentions: You vs. Competitors',
}: CompetitorComparisonProps) {
    if (data.length === 0) {
        return (
            <div className="rounded-xl bg-surface-dark border border-white/5 p-5">
                <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
                <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
                    No competitor data yet — run an intercept analysis first.
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl bg-surface-dark border border-white/5 p-5">
            <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
            <ResponsiveContainer width="100%" height={Math.max(180, data.length * 50)}>
                <BarChart
                    data={data}
                    layout="vertical"
                    margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                >
                    <XAxis
                        type="number"
                        tick={{ fill: '#64748B', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        type="category"
                        dataKey="competitor"
                        tick={{ fill: '#94A3B8', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        width={100}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 11, color: '#94A3B8' }}
                    />
                    <Bar
                        dataKey="yourMentions"
                        name={businessName}
                        fill="#00F5A0"
                        radius={[0, 4, 4, 0]}
                        barSize={16}
                    />
                    <Bar
                        dataKey="theirMentions"
                        name="Competitor"
                        fill="#ef4444"
                        radius={[0, 4, 4, 0]}
                        barSize={16}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
