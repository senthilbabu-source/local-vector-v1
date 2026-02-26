// ---------------------------------------------------------------------------
// AuditScoreOverview — Sprint 58B: Summary card with overall AEO score
// ---------------------------------------------------------------------------

'use client';

interface Props {
  overallScore: number;
  totalPages: number;
  lastAuditedAt: string | null;
}

export default function AuditScoreOverview({ overallScore, totalPages, lastAuditedAt }: Props) {
  const color =
    overallScore >= 80 ? 'text-signal-green' :
    overallScore >= 50 ? 'text-alert-amber' :
    'text-alert-crimson';

  const strokeColor =
    overallScore >= 80 ? '#00F5A0' :
    overallScore >= 50 ? '#FFB800' :
    '#ef4444';

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (overallScore / 100) * circumference;

  return (
    <div className="rounded-2xl bg-surface-dark border border-white/5 p-6 flex flex-col items-center">
      <h2 className="text-sm font-semibold text-white tracking-tight mb-4">AEO Readiness Score</h2>

      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60" cy="60" r={radius}
            fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8"
          />
          <circle
            cx="60" cy="60" r={radius}
            fill="none" stroke={strokeColor} strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold tabular-nums ${color}`}>{overallScore}</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wide">AEO</span>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-center">
        <p className="text-sm text-slate-400">
          <span className="font-semibold text-white">{totalPages}</span> page{totalPages !== 1 ? 's' : ''} audited
        </p>
        {lastAuditedAt && (
          <p className="text-xs text-slate-500">
            Last audit:{' '}
            {new Date(lastAuditedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        )}
      </div>
    </div>
  );
}
