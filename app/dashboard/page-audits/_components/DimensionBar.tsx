// ---------------------------------------------------------------------------
// DimensionBar — Sprint 58B: Single dimension score bar (reusable)
// ---------------------------------------------------------------------------

'use client';

interface Props {
  label: string;
  score: number;
  weight: string;
}

export default function DimensionBar({ label, score, weight }: Props) {
  const barColor =
    score >= 80 ? 'bg-signal-green' :
    score >= 50 ? 'bg-alert-amber' :
    'bg-alert-crimson';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{weight}</span>
          <span className="text-xs font-semibold tabular-nums text-white">{score}</span>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
