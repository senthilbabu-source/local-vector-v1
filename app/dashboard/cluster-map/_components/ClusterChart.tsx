'use client';

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ZAxis,
} from 'recharts';
import type { ClusterMapPoint, HallucinationZone } from '@/lib/services/cluster-map.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClusterChartProps {
  points: ClusterMapPoint[];
  hallucinationZones: HallucinationZone[];
  selfPoint: ClusterMapPoint | null;
}

// ---------------------------------------------------------------------------
// Custom dot renderer
// ---------------------------------------------------------------------------

function renderDot(props: unknown): React.ReactElement {
  const { cx, cy, payload } = props as {
    cx?: number;
    cy?: number;
    payload?: ClusterMapPoint;
  };
  if (cx == null || cy == null || !payload) return <g />;

  const radius = Math.max(8, (payload.sov ?? 0) * 50);

  if (payload.type === 'self') {
    return (
      <g>
        <circle cx={cx} cy={cy} r={radius + 4} fill="#00F5A0" opacity={0.2} />
        <circle cx={cx} cy={cy} r={radius} fill="#00F5A0" stroke="#050A15" strokeWidth={2} />
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fill="#050A15"
          fontSize={12}
          fontWeight="bold"
        >
          ★
        </text>
      </g>
    );
  }

  return (
    <circle
      cx={cx}
      cy={cy}
      r={Math.max(6, radius * 0.7)}
      fill="#6366f1"
      fillOpacity={0.6}
      stroke="#6366f1"
      strokeWidth={1}
    />
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ClusterMapPoint }>;
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;
  const isSelf = point.type === 'self';

  return (
    <div className="rounded-lg bg-midnight-slate border border-white/10 px-3 py-2 shadow-lg max-w-xs">
      <p className={`text-sm font-bold ${isSelf ? 'text-signal-green' : 'text-electric-indigo'}`}>
        {isSelf ? `★ ${point.name}` : point.name}
      </p>
      <div className="mt-1 space-y-0.5 text-xs text-slate-400">
        <p>AI Mention Rate: {point.brandAuthority}%</p>
        <p>Information Accuracy: {point.factAccuracy}%</p>
        <p>
          SOV: {(point.sov * 100).toFixed(0)}% ({point.citationCount}/{point.totalQueries} queries)
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fog overlay (SVG layer)
// ---------------------------------------------------------------------------

function FogOverlay({ zones }: { zones: HallucinationZone[] }) {
  if (zones.length === 0) return null;

  return (
    <>
      <defs>
        <filter id="cluster-fog-blur">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>
      {zones.map((zone) => (
        <circle
          key={zone.id}
          cx={`${zone.cx}%`}
          cy={`${100 - zone.cy}%`}
          r={zone.radius}
          fill="#ef4444"
          fillOpacity={0.12}
          filter="url(#cluster-fog-blur)"
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Quadrant labels
// ---------------------------------------------------------------------------

function QuadrantLabels() {
  return (
    <>
      <text x="78%" y="8%" fill="#334155" fontSize={10} textAnchor="middle">
        Often Mentioned
      </text>
      <text x="78%" y="12%" fill="#334155" fontSize={10} textAnchor="middle">
        Accurate Info
      </text>
      <text x="22%" y="8%" fill="#334155" fontSize={10} textAnchor="middle">
        Rarely Mentioned
      </text>
      <text x="22%" y="12%" fill="#334155" fontSize={10} textAnchor="middle">
        Accurate Info
      </text>
      <text x="22%" y="92%" fill="#334155" fontSize={10} textAnchor="middle">
        Invisible
      </text>
      <text x="78%" y="92%" fill="#334155" fontSize={10} textAnchor="middle">
        Wrong Info Spreading
      </text>
    </>
  );
}

// ---------------------------------------------------------------------------
// ClusterChart
// ---------------------------------------------------------------------------

export default function ClusterChart({
  points,
  hallucinationZones,
}: ClusterChartProps) {
  const selfData = points.filter((p) => p.type === 'self');
  const competitorData = points.filter((p) => p.type === 'competitor');

  return (
    <div className="rounded-xl bg-surface-dark border border-white/5 p-5">
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
          />
          <XAxis
            type="number"
            dataKey="brandAuthority"
            name="Brand Authority"
            domain={[0, 100]}
            tick={{ fill: '#64748B', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
            tickLine={false}
            label={{
              value: 'How Often AI Mentions You',
              position: 'bottom',
              fill: '#94A3B8',
              fontSize: 12,
              offset: 0,
            }}
          />
          <YAxis
            type="number"
            dataKey="factAccuracy"
            name="Fact Accuracy"
            domain={[0, 100]}
            tick={{ fill: '#64748B', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={{
              value: 'Information Accuracy',
              angle: -90,
              position: 'insideLeft',
              fill: '#94A3B8',
              fontSize: 12,
              offset: 10,
            }}
          />
          <ZAxis type="number" dataKey="sov" range={[100, 2000]} />

          {/* Quadrant reference lines */}
          <ReferenceLine x={50} stroke="#334155" strokeDasharray="4 4" />
          <ReferenceLine y={50} stroke="#334155" strokeDasharray="4 4" />

          <Tooltip content={<CustomTooltip />} />

          {/* Competitor scatter */}
          <Scatter
            name="Competitors"
            data={competitorData}
            shape={renderDot}
          />

          {/* Self scatter (rendered last = on top) */}
          <Scatter
            name="Your Business"
            data={selfData}
            shape={renderDot}
          />

          {/* SVG overlays */}
          <FogOverlay zones={hallucinationZones} />
          <QuadrantLabels />
        </ScatterChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-signal-green" />
          Your Business
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-electric-indigo/60" />
          Competitors
        </div>
        {hallucinationZones.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-alert-crimson/30" />
            Wrong Information Zones
          </div>
        )}
        <span className="text-slate-600">Bubble size = AI visibility share</span>
      </div>
    </div>
  );
}
