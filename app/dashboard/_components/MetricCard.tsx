// ---------------------------------------------------------------------------
// app/dashboard/_components/MetricCard.tsx — Enhanced Quick Stat with Sparkline
//
// Surgery 4: Replaces the inline QuickStat with a richer card that can
// optionally show a mini sparkline trend.
//
// Two modes:
//   • Simple: just label + value (drop-in replacement for QuickStat)
//   • Sparkline: label + value + tiny trend line from recent data points
//
// Design tokens: surface-dark, signal-green, alert-crimson, alert-amber.
// ---------------------------------------------------------------------------

'use client';

import { LineChart, Line, ResponsiveContainer } from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MetricCardProps {
    label: string;
    value: number | string;
    /** Optional trend data for sparkline (last 7-14 data points) */
    trend?: number[];
    /** Color theme: green (positive), red (negative), amber (warning) */
    color?: 'green' | 'red' | 'amber' | 'default';
    /** Optional change indicator: "+12%" or "-5%" */
    change?: string;
    /** Additional class names */
    className?: string;
}

// ---------------------------------------------------------------------------
// Color mapping
// ---------------------------------------------------------------------------

const VALUE_COLORS: Record<string, string> = {
    green: 'text-signal-green',
    red: 'text-alert-crimson',
    amber: 'text-alert-amber',
    default: 'text-white',
};

const SPARK_COLORS: Record<string, string> = {
    green: '#00F5A0',
    red: '#ef4444',
    amber: '#FFB800',
    default: '#6366f1',
};

const CHANGE_COLORS: Record<string, string> = {
    green: 'text-signal-green bg-signal-green/10',
    red: 'text-alert-crimson bg-alert-crimson/10',
    amber: 'text-alert-amber bg-alert-amber/10',
    default: 'text-electric-indigo bg-electric-indigo/10',
};

// ---------------------------------------------------------------------------
// MetricCard
// ---------------------------------------------------------------------------

export default function MetricCard({
    label,
    value,
    trend,
    color = 'default',
    change,
    className = '',
}: MetricCardProps) {
    const sparkData = trend?.map((v, i) => ({ i, v }));

    return (
        <div
            className={[
                'rounded-xl bg-surface-dark border border-white/5 px-4 py-4',
                className,
            ].join(' ')}
        >
            {/* Label */}
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {label}
            </p>

            {/* Value + Change badge */}
            <div className="flex items-end gap-2 mt-1.5">
                <p className={['text-2xl font-bold tabular-nums', VALUE_COLORS[color]].join(' ')}>
                    {value}
                </p>
                {change && (
                    <span
                        className={[
                            'text-xs font-semibold px-1.5 py-0.5 rounded-md',
                            CHANGE_COLORS[color],
                        ].join(' ')}
                    >
                        {change}
                    </span>
                )}
            </div>

            {/* Optional sparkline */}
            {sparkData && sparkData.length > 1 && (
                <div className="mt-2 h-8">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sparkData}>
                            <Line
                                type="monotone"
                                dataKey="v"
                                stroke={SPARK_COLORS[color]}
                                strokeWidth={1.5}
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
