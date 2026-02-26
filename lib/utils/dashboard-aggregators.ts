// ---------------------------------------------------------------------------
// lib/utils/dashboard-aggregators.ts — Pure aggregation helpers for dashboard
//
// Surgery 4: Extracted from app/dashboard/page.tsx (Sprint 64).
// Pure functions with zero side effects (AI_RULES §6).
// ---------------------------------------------------------------------------

import type { ModelHallucinationData } from '@/app/dashboard/_components/HallucinationsByModel';
import type { CompetitorComparisonData } from '@/app/dashboard/_components/CompetitorComparison';

export function aggregateByModel(rows: { model_provider: string }[]): ModelHallucinationData[] {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.model_provider] = (counts[row.model_provider] ?? 0) + 1;
  }
  return Object.entries(counts).map(([model, count]) => ({ model, count }));
}

export function aggregateCompetitors(
  rows: { competitor_name: string; gap_analysis: { competitor_mentions: number; your_mentions: number } }[],
): CompetitorComparisonData[] {
  const agg: Record<string, { theirMentions: number; yourMentions: number }> = {};
  for (const row of rows) {
    if (!agg[row.competitor_name]) {
      agg[row.competitor_name] = { theirMentions: 0, yourMentions: 0 };
    }
    agg[row.competitor_name].theirMentions += row.gap_analysis?.competitor_mentions ?? 0;
    agg[row.competitor_name].yourMentions += row.gap_analysis?.your_mentions ?? 0;
  }
  return Object.entries(agg).map(([competitor, data]) => ({
    competitor,
    ...data,
  }));
}
