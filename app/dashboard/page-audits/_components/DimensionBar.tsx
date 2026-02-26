// ---------------------------------------------------------------------------
// DimensionBar — Sprint 58B + Sprint 71: Single dimension score bar (reusable)
//
// Sprint 71: Nullable score, expandable detail section with recommendations
// ---------------------------------------------------------------------------

'use client';

import DimensionDetail from './DimensionDetail';
import type { PageAuditRecommendation, DimensionKey } from '@/lib/page-audit/auditor';

interface Props {
  label: string;
  score: number | null;
  weight: string;
  dimensionKey: DimensionKey;
  recommendations?: PageAuditRecommendation[];
  expanded?: boolean;
  onToggle?: () => void;
  onGenerateSchema?: (schemaType: string) => void;
}

export default function DimensionBar({
  label,
  score,
  weight,
  dimensionKey,
  recommendations = [],
  expanded = false,
  onToggle,
  onGenerateSchema,
}: Props) {
  const barColor =
    score === null ? 'bg-white/10' :
    score >= 80 ? 'bg-signal-green' :
    score >= 50 ? 'bg-alert-amber' :
    'bg-alert-crimson';

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left group"
        aria-expanded={expanded}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors">
              {label}
            </span>
            <svg
              className={`h-3 w-3 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{weight}</span>
            {score !== null ? (
              <span className="text-xs font-semibold tabular-nums text-white">{score}</span>
            ) : (
              <span className="text-xs font-medium text-slate-500">&mdash;</span>
            )}
          </div>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${score ?? 0}%` }}
          />
        </div>
      </button>

      {expanded && (
        <DimensionDetail
          dimensionKey={dimensionKey}
          recommendations={recommendations}
          onGenerateSchema={onGenerateSchema}
        />
      )}
    </div>
  );
}
