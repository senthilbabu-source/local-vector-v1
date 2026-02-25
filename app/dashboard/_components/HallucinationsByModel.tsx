// ---------------------------------------------------------------------------
// app/dashboard/_components/HallucinationsByModel.tsx — Hallucinations by Model
//
// Surgery 4: Horizontal bar chart showing hallucination counts per AI model.
// Helps clients see which AI model is most inaccurate about their business.
//
// Design: Dark theme bars with model-specific colors.
// ---------------------------------------------------------------------------

'use client';

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelHallucinationData {
    model: string;
    count: number;
}

interface HallucinationsByModelProps {
    data: ModelHallucinationData[];
    title?: string;
}

// ---------------------------------------------------------------------------
// Model color palette
// ---------------------------------------------------------------------------

const MODEL_COLORS: Record<string, string> = {
    'openai-gpt4o': '#10B981',       // emerald
    'perplexity-sonar': '#6366F1',   // indigo
    'google-gemini': '#3B82F6',      // blue
    'anthropic-claude': '#F59E0B',   // amber
    'microsoft-copilot': '#8B5CF6',  // violet
};

function getModelColor(model: string): string {
    return MODEL_COLORS[model] ?? '#64748B';
}

function formatModelName(model: string): string {
    const names: Record<string, string> = {
        'openai-gpt4o': 'GPT-4o',
        'perplexity-sonar': 'Perplexity',
        'google-gemini': 'Gemini',
        'anthropic-claude': 'Claude',
        'microsoft-copilot': 'Copilot',
    };
    return names[model] ?? model;
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

function CustomTooltip({
    active,
    payload,
}: {
    active?: boolean;
    payload?: { payload: ModelHallucinationData }[];
}) {
    if (!active || !payload?.length) return null;

    const d = payload[0].payload;
    return (
        <div className="rounded-lg bg-midnight-slate border border-white/10 px-3 py-2 shadow-lg">
            <p className="text-xs text-slate-400">{formatModelName(d.model)}</p>
            <p className="text-sm font-bold text-alert-crimson tabular-nums">
                {d.count} hallucination{d.count === 1 ? '' : 's'}
            </p>
        </div>
    );
}

// ---------------------------------------------------------------------------
// HallucinationsByModel
// ---------------------------------------------------------------------------

export default function HallucinationsByModel({
    data,
    title = 'Hallucinations by AI Model',
}: HallucinationsByModelProps) {
    if (data.length === 0) {
        return (
            <div className="rounded-xl bg-surface-dark border border-white/5 p-5">
                <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
                <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
                    No hallucination data yet.
                </div>
            </div>
        );
    }

    const chartData = data
        .map((d) => ({ ...d, label: formatModelName(d.model) }))
        .sort((a, b) => b.count - a.count);

    return (
        <div className="rounded-xl bg-surface-dark border border-white/5 p-5">
            <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
            <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 44)}>
                <BarChart
                    data={chartData}
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
                        dataKey="label"
                        tick={{ fill: '#94A3B8', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        width={80}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                        {chartData.map((entry) => (
                            <Cell key={entry.model} fill={getModelColor(entry.model)} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
