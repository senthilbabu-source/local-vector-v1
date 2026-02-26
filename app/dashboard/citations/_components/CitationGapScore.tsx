// ---------------------------------------------------------------------------
// CitationGapScore — Sprint 58A: Circular score ring for citation gap coverage
// ---------------------------------------------------------------------------

'use client';

interface Props {
  gapScore: number;
  platformsCovered: number;
  platformsThatMatter: number;
}

export default function CitationGapScore({ gapScore, platformsCovered, platformsThatMatter }: Props) {
  const color =
    gapScore >= 80 ? 'text-signal-green' :
    gapScore >= 50 ? 'text-alert-amber' :
    'text-alert-crimson';

  const strokeColor =
    gapScore >= 80 ? '#00F5A0' :
    gapScore >= 50 ? '#FFB800' :
    '#ef4444';

  // SVG ring calculations
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (gapScore / 100) * circumference;

  return (
    <div className="rounded-2xl bg-surface-dark border border-white/5 p-6 flex flex-col items-center">
      <h2 className="text-sm font-semibold text-white tracking-tight mb-4">Citation Gap Score</h2>

      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          {/* Background ring */}
          <circle
            cx="60" cy="60" r={radius}
            fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8"
          />
          {/* Score ring */}
          <circle
            cx="60" cy="60" r={radius}
            fill="none" stroke={strokeColor} strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold tabular-nums ${color}`}>{gapScore}</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wide">Score</span>
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-400">
        <span className="font-semibold text-white">{platformsCovered}</span> of{' '}
        <span className="font-semibold text-white">{platformsThatMatter}</span> platforms covered
      </p>
    </div>
  );
}
