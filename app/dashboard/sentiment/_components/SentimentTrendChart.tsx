'use client';

// ---------------------------------------------------------------------------
// SentimentTrendChart — recharts AreaChart for weekly sentiment scores
//
// Wave 2, S21 (AI_RULES §221).
//
// Shows sentiment score (−1 to +1) over 12 weeks with:
//   - Gradient fill: green above 0, red below 0
//   - Reference line at y=0
//   - Annotated "new error" markers when a hallucination first appeared
//   - Custom tooltip with score + plain-English label
//   - prefers-reduced-motion: disables animation
// ---------------------------------------------------------------------------

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
  type TooltipProps,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SentimentWeekPoint {
  weekStart: string;        // ISO date string "YYYY-MM-DD"
  averageScore: number;     // −1 to +1
  evaluationCount: number;
  hasNewError?: boolean;    // S21: annotate weeks where a new hallucination appeared
}

interface SentimentTrendChartProps {
  data: SentimentWeekPoint[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatWeekLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function sentimentLabel(score: number): string {
  if (score > 0.3) return 'Positive';
  if (score < -0.3) return 'Negative';
  return 'Neutral';
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const score = payload[0]?.value ?? 0;
  const hasError = (payload[0]?.payload as SentimentWeekPoint)?.hasNewError;

  return (
    <div className="rounded-lg border border-white/10 bg-[#0f1117] px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="font-semibold text-white">
        {score >= 0 ? '+' : ''}{score.toFixed(2)} · {sentimentLabel(score)}
      </p>
      {hasError && (
        <p className="mt-1 text-alert-crimson">⚠ New AI error detected this week</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SentimentTrendChart({ data }: SentimentTrendChartProps) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center rounded-xl bg-surface-dark border border-white/5 px-6 py-10 text-center">
        <p className="text-sm text-slate-400">
          Not enough data yet — trend appears after 2+ weekly scans.
        </p>
      </div>
    );
  }

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div
      className="rounded-xl bg-surface-dark border border-white/5 p-5"
      data-testid="sentiment-trend-chart"
    >
      <p
        className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4"
        style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
      >
        Sentiment Trend — last {data.length} weeks
      </p>

      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
          <defs>
            {/* Gradient: green above 0, transitions to red below */}
            <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="50%"  stopColor="#10b981" stopOpacity={0.05} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.25} />
            </linearGradient>
            <linearGradient id="sentimentStroke" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#10b981" stopOpacity={1} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={1} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />

          <XAxis
            dataKey="weekStart"
            tickFormatter={formatWeekLabel}
            tick={{ fontSize: 10, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />

          <YAxis
            domain={[-1, 1]}
            tickCount={5}
            tickFormatter={(v: number) => v.toFixed(1)}
            tick={{ fontSize: 10, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />

          {/* Zero reference line */}
          <ReferenceLine
            y={0}
            stroke="rgba(255,255,255,0.15)"
            strokeDasharray="4 4"
          />

          <Tooltip content={<CustomTooltip />} />

          <Area
            type="monotone"
            dataKey="averageScore"
            stroke="url(#sentimentStroke)"
            strokeWidth={2}
            fill="url(#sentimentGradient)"
            dot={(props) => {
              const point = props.payload as SentimentWeekPoint;
              if (!point.hasNewError) return <g key={props.key} />;
              const { cx, cy } = props;
              return (
                <g key={props.key}>
                  <path
                    d={`M${cx},${cy - 6} L${cx + 5},${cy} L${cx},${cy + 6} L${cx - 5},${cy} Z`}
                    fill="#ef4444"
                    opacity={0.9}
                  />
                </g>
              );
            }}
            activeDot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
            isAnimationActive={!prefersReduced}
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="mt-3 flex items-center gap-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-signal-green" />
          Positive
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-alert-amber" />
          Neutral
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-alert-crimson" />
          Negative
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              background: '#ef4444',
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            }}
          />
          New AI error
        </span>
      </div>
    </div>
  );
}
