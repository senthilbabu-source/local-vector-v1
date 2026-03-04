// ---------------------------------------------------------------------------
// BenchmarkPercentileBar.tsx — Sprint 122: Benchmark Comparisons
//
// Horizontal bar 0→100 showing the org's percentile rank with reference
// lines at the median and top-quartile thresholds.
// ---------------------------------------------------------------------------

interface BenchmarkPercentileBarProps {
  percentile_rank: number;
  median: number;
  top_quartile: number;
  className?: string;
}

function getTierColor(rank: number): string {
  if (rank >= 90) return 'bg-yellow-400';   // gold — top 10%
  if (rank >= 75) return 'bg-signal-green';  // green — top quartile
  if (rank >= 50) return 'bg-blue-400';      // blue — above median
  if (rank >= 25) return 'bg-orange-400';    // orange — below median
  return 'bg-red-400';                       // red — bottom quartile
}

export default function BenchmarkPercentileBar({
  percentile_rank,
  median,
  top_quartile,
  className = '',
}: BenchmarkPercentileBarProps) {
  const clampedRank = Math.min(100, Math.max(0, percentile_rank));
  const tierColor = getTierColor(clampedRank);

  return (
    <div
      className={`relative w-full ${className}`}
      data-testid="benchmark-percentile-bar"
      aria-label={`Your percentile rank: ${Math.round(clampedRank)}th percentile`}
    >
      {/* Track */}
      <div className="relative h-3 w-full rounded-full bg-white/5">
        {/* Fill */}
        <div
          className={`h-full rounded-full transition-all ${tierColor}`}
          style={{ width: `${clampedRank}%`, opacity: 0.3 }}
        />

        {/* Median reference line */}
        <div
          className="absolute top-0 h-full w-px bg-slate-400"
          style={{ left: `${median}%` }}
          title={`Median: ${median}%`}
        />

        {/* Top quartile reference line */}
        <div
          className="absolute top-0 h-full w-px bg-signal-green/60"
          style={{ left: `${top_quartile}%` }}
          title={`Top quartile: ${top_quartile}%`}
        />

        {/* Your position marker */}
        <div
          className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ${tierColor}`}
          style={{ left: `${clampedRank}%` }}
        />
      </div>

      {/* Labels */}
      <div className="mt-1.5 flex justify-between text-[10px] text-slate-400 tabular-nums">
        <span>0</span>
        <span>100</span>
      </div>
    </div>
  );
}
