'use client';

// ---------------------------------------------------------------------------
// TruthScoreCard — SVG gauge showing the composite Truth Score (0–100).
//
// Props:
//   score       — 0–100 integer (or null if no data)
//   consensus   — whether all engines agree (≥80)
//   enginesReporting — number of engines with data
// ---------------------------------------------------------------------------

interface TruthScoreCardProps {
  score: number | null;
  consensus: boolean;
  enginesReporting: number;
}

function scoreColor(score: number): string {
  if (score >= 90) return '#00F5A0'; // signal-green
  if (score >= 70) return '#FFB800'; // alert-amber
  if (score >= 50) return '#f97316'; // orange
  return '#ef4444'; // alert-crimson
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Poor';
}

export default function TruthScoreCard({
  score,
  consensus,
  enginesReporting,
}: TruthScoreCardProps) {
  // SVG gauge: semicircle arc from 180° to 0° (left to right)
  const radius = 60;
  const circumference = Math.PI * radius; // half-circle
  const progress = score !== null ? score / 100 : 0;
  const strokeDashoffset = circumference * (1 - progress);
  const color = score !== null ? scoreColor(score) : '#475569';

  return (
    <div className="rounded-xl bg-surface-dark border border-white/5 p-6" data-testid="truth-score-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Truth Score</h2>
          <p className="text-xs text-slate-400">
            Weighted composite across {enginesReporting} engine{enginesReporting !== 1 ? 's' : ''}
          </p>
        </div>
        {consensus && (
          <span className="inline-flex items-center gap-1 rounded-full bg-signal-green/10 px-2.5 py-0.5 text-xs font-semibold text-signal-green ring-1 ring-inset ring-signal-green/20">
            Consensus
          </span>
        )}
      </div>

      {/* SVG Gauge */}
      <div className="flex flex-col items-center">
        <svg
          width="160"
          height="90"
          viewBox="0 0 160 90"
          className="overflow-visible"
          data-testid="truth-gauge"
        >
          {/* Background arc */}
          <path
            d="M 20 80 A 60 60 0 0 1 140 80"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Progress arc */}
          {score !== null && (
            <path
              d="M 20 80 A 60 60 0 0 1 140 80"
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-700 ease-out"
            />
          )}
          {/* Score text */}
          <text
            x="80"
            y="72"
            textAnchor="middle"
            className="text-3xl font-bold"
            fill={color}
          >
            {score !== null ? score : '—'}
          </text>
        </svg>

        {score !== null && (
          <p className="mt-1 text-xs font-medium" style={{ color }}>
            {scoreLabel(score)}
          </p>
        )}

        {score === null && (
          <p className="mt-1 text-xs text-slate-400">
            Run a multi-engine audit to calculate your Truth Score
          </p>
        )}
      </div>
    </div>
  );
}
