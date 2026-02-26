// ---------------------------------------------------------------------------
// PageAuditCard — Sprint 58B: Individual page audit result card
// ---------------------------------------------------------------------------

'use client';

import { useTransition } from 'react';
import DimensionBar from './DimensionBar';

interface Recommendation {
  issue: string;
  fix: string;
  impactPoints: number;
}

interface Props {
  pageUrl: string;
  pageType: string;
  overallScore: number;
  answerFirstScore: number;
  schemaCompletenessScore: number;
  faqSchemaPresent: boolean;
  faqSchemaScore: number;
  keywordDensityScore: number;
  entityClarityScore: number;
  recommendations: Recommendation[];
  lastAuditedAt: string;
  onReaudit: (pageUrl: string) => Promise<{ success: boolean; error?: string }>;
}

export default function PageAuditCard({
  pageUrl,
  pageType,
  overallScore,
  answerFirstScore,
  schemaCompletenessScore,
  faqSchemaPresent,
  faqSchemaScore,
  keywordDensityScore,
  entityClarityScore,
  recommendations,
  lastAuditedAt,
  onReaudit,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const scoreColor =
    overallScore >= 80 ? 'text-signal-green' :
    overallScore >= 50 ? 'text-alert-amber' :
    'text-alert-crimson';

  const scoreBg =
    overallScore >= 80 ? 'bg-signal-green/10' :
    overallScore >= 50 ? 'bg-alert-amber/10' :
    'bg-alert-crimson/10';

  const displayUrl = pageUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

  return (
    <div className="rounded-2xl bg-surface-dark border border-white/5 p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-400 uppercase">
              {pageType}
            </span>
            <span className={`inline-flex items-center rounded-md ${scoreBg} px-2 py-0.5 text-[10px] font-bold ${scoreColor}`}>
              {overallScore}/100
            </span>
          </div>
          <p className="mt-1.5 text-sm font-medium text-white truncate" title={pageUrl}>
            {displayUrl}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            Audited {new Date(lastAuditedAt).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </p>
        </div>

        {/* Re-audit button */}
        <button
          onClick={() => startTransition(async () => { await onReaudit(pageUrl); })}
          disabled={isPending}
          className="shrink-0 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Auditing…' : 'Re-audit'}
        </button>
      </div>

      {/* Dimension breakdown */}
      <div className="space-y-2.5">
        <DimensionBar label="Answer-First Structure" score={answerFirstScore} weight="35%" />
        <DimensionBar label="Schema Completeness" score={schemaCompletenessScore} weight="25%" />
        <DimensionBar label={`FAQ Schema${faqSchemaPresent ? ' ✓' : ''}`} score={faqSchemaScore} weight="20%" />
        <DimensionBar label="Keyword Density" score={keywordDensityScore} weight="10%" />
        <DimensionBar label="Entity Clarity" score={entityClarityScore} weight="10%" />
      </div>

      {/* Top recommendation */}
      {recommendations.length > 0 && (
        <div className="mt-4 rounded-xl bg-white/[0.02] border border-white/5 p-3">
          <p className="text-[10px] font-semibold text-alert-amber uppercase tracking-wide mb-1">
            Top Fix (+{recommendations[0].impactPoints} pts)
          </p>
          <p className="text-xs text-slate-300">{recommendations[0].issue}</p>
          <p className="mt-1 text-xs text-slate-500">{recommendations[0].fix}</p>
        </div>
      )}
    </div>
  );
}
