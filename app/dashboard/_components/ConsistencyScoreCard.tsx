'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SubScore {
  label: string;
  value: number;
  max: number;
}

interface ConsistencyScoreCardProps {
  score: number;
  nameScore: number;
  addressScore: number;
  phoneScore: number;
  hoursScore: number;
  menuScore: number;
  previousScore: number | null;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-signal-green';
  if (score >= 50) return 'text-alert-amber';
  return 'text-alert-crimson';
}

function barColor(score: number, max: number): string {
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.9) return 'bg-signal-green';
  if (pct >= 0.5) return 'bg-alert-amber';
  return 'bg-alert-crimson';
}

export default function ConsistencyScoreCard({
  score,
  nameScore,
  addressScore,
  phoneScore,
  hoursScore,
  menuScore,
  previousScore,
}: ConsistencyScoreCardProps) {
  const delta = previousScore !== null ? score - previousScore : null;

  const subScores: SubScore[] = [
    { label: 'Name', value: nameScore, max: 30 },
    { label: 'Address', value: addressScore, max: 25 },
    { label: 'Phone', value: phoneScore, max: 20 },
    { label: 'Hours', value: hoursScore, max: 15 },
    { label: 'Menu', value: menuScore, max: 10 },
  ];

  return (
    <div
      data-testid="consistency-score-card"
      className="rounded-xl border border-white/5 bg-surface-dark p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Business Info Consistency</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            How consistently your info matches across platforms AI uses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold tabular-nums ${scoreColor(score)}`}>
            {score}
          </span>
          <span className="text-xs text-slate-400">/100</span>
        </div>
      </div>

      {/* Trend */}
      {delta !== null && (
        <div className="flex items-center gap-1 mb-4 text-xs">
          {delta > 0 ? (
            <>
              <TrendingUp className="h-3.5 w-3.5 text-signal-green" />
              <span className="text-signal-green font-medium">+{delta} vs last week</span>
            </>
          ) : delta < 0 ? (
            <>
              <TrendingDown className="h-3.5 w-3.5 text-alert-crimson" />
              <span className="text-alert-crimson font-medium">{delta} vs last week</span>
            </>
          ) : (
            <>
              <Minus className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-slate-400">No change</span>
            </>
          )}
        </div>
      )}

      {/* Sub-score bars */}
      <div className="space-y-2">
        {subScores.map((sub) => (
          <div key={sub.label} className="flex items-center gap-3">
            <span className="w-16 text-xs text-slate-400">{sub.label}</span>
            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor(sub.value, sub.max)}`}
                style={{ width: `${sub.max > 0 ? (sub.value / sub.max) * 100 : 0}%` }}
              />
            </div>
            <span className="w-10 text-right text-xs text-slate-400 tabular-nums">
              {sub.value}/{sub.max}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
