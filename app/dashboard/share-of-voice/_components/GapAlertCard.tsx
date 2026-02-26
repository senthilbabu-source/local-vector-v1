// ---------------------------------------------------------------------------
// GapAlertCard — Sprint 58C: Single gap alert for Prompt Intelligence
// ---------------------------------------------------------------------------

'use client';

import type { GapType, GapImpact, QueryCategory } from '@/lib/types/prompt-intelligence';

interface Props {
  gapType: GapType;
  queryText: string;
  queryCategory: QueryCategory;
  estimatedImpact: GapImpact;
  suggestedAction: string;
}

const GAP_TYPE_LABELS: Record<GapType, string> = {
  untracked: 'Untracked Query',
  competitor_discovered: 'Competitor Gap',
  zero_citation_cluster: 'Zero Citations',
};

const GAP_TYPE_COLORS: Record<GapType, { bg: string; text: string; ring: string }> = {
  untracked: {
    bg: 'bg-alert-amber/10',
    text: 'text-alert-amber',
    ring: 'ring-alert-amber/20',
  },
  competitor_discovered: {
    bg: 'bg-alert-crimson/10',
    text: 'text-alert-crimson',
    ring: 'ring-alert-crimson/20',
  },
  zero_citation_cluster: {
    bg: 'bg-electric-indigo/10',
    text: 'text-electric-indigo',
    ring: 'ring-electric-indigo/20',
  },
};

const IMPACT_COLORS: Record<GapImpact, string> = {
  high: 'text-alert-crimson',
  medium: 'text-alert-amber',
  low: 'text-slate-400',
};

const CATEGORY_LABELS: Record<QueryCategory, string> = {
  discovery: 'Discovery',
  comparison: 'Comparison',
  occasion: 'Occasion',
  near_me: 'Near Me',
  custom: 'Custom',
};

export default function GapAlertCard({
  gapType,
  queryText,
  queryCategory,
  estimatedImpact,
  suggestedAction,
}: Props) {
  const colors = GAP_TYPE_COLORS[gapType];

  return (
    <div className="rounded-xl bg-surface-dark border border-white/5 p-4">
      <div className="flex items-start gap-3">
        {/* Type badge */}
        <span
          className={`inline-flex shrink-0 items-center rounded-md ${colors.bg} px-2 py-0.5 text-[10px] font-semibold ${colors.text} ring-1 ring-inset ${colors.ring}`}
        >
          {GAP_TYPE_LABELS[gapType]}
        </span>

        <div className="flex-1 min-w-0">
          {/* Query text */}
          <p className="text-sm font-medium text-white truncate" title={queryText}>
            &ldquo;{queryText}&rdquo;
          </p>

          {/* Metadata row */}
          <div className="mt-1 flex items-center gap-3 text-[10px]">
            <span className="text-slate-500">{CATEGORY_LABELS[queryCategory]}</span>
            <span className={`font-semibold uppercase ${IMPACT_COLORS[estimatedImpact]}`}>
              {estimatedImpact} impact
            </span>
          </div>

          {/* Suggested action */}
          <p className="mt-2 text-xs text-slate-400">{suggestedAction}</p>
        </div>
      </div>
    </div>
  );
}
