// ---------------------------------------------------------------------------
// lib/services/competitor-teaser.ts — S37: Competitor Teaser
//
// Pure functions + I/O to surface the top competitor mention on the dashboard.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompetitorMentionData {
  competitorName: string;
  theirMentions: number;
  yourMentions: number;
  ratio: number | null; // null when yourMentions === 0
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Formats a competitor insight string.
 * - "Joe's BBQ was mentioned 3x more than you this week"
 * - "Joe's BBQ was mentioned as often as you this week" (ratio 1)
 * - "Joe's BBQ was mentioned 5 times by AI this week" (yourMentions 0)
 */
export function formatCompetitorInsight(data: CompetitorMentionData): string {
  if (data.ratio === null) {
    return `${data.competitorName} was mentioned ${data.theirMentions} time${data.theirMentions === 1 ? '' : 's'} by AI this week`;
  }
  if (data.ratio <= 1) {
    return `${data.competitorName} was mentioned as often as you this week`;
  }
  return `${data.competitorName} was mentioned ${Math.round(data.ratio)}x more than you this week`;
}

/**
 * Returns true when there's meaningful competitor data to display.
 */
export function isCompetitorDataAvailable(data: CompetitorMentionData | null): boolean {
  return data !== null && data.theirMentions > 0;
}

// ---------------------------------------------------------------------------
// I/O — Fetches top competitor mention from sov_evaluations
// ---------------------------------------------------------------------------

/**
 * Returns the top competitor by mention count in the last N days.
 * Never throws — returns null on error.
 */
export async function getTopCompetitorMentions(
  supabase: SupabaseClient,
  orgId: string,
  days = 7,
): Promise<CompetitorMentionData | null> {
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: evaluations } = await supabase
      .from('sov_evaluations')
      .select('mentioned_competitors, rank_position')
      .eq('org_id', orgId)
      .gte('created_at', since)
      .not('mentioned_competitors', 'is', null)
      .limit(500);

    if (!evaluations || evaluations.length === 0) return null;

    // Count mentions per competitor
    const competitorCounts = new Map<string, number>();
    let yourMentions = 0;

    for (const row of evaluations) {
      // Count own mentions (rank_position not null = cited)
      if (row.rank_position !== null) {
        yourMentions++;
      }

      // Parse mentioned_competitors (JSONB — array of strings)
      const competitors = row.mentioned_competitors;
      if (Array.isArray(competitors)) {
        for (const name of competitors) {
          if (typeof name === 'string' && name.length > 0) {
            competitorCounts.set(name, (competitorCounts.get(name) ?? 0) + 1);
          }
        }
      }
    }

    if (competitorCounts.size === 0) return null;

    // Find top competitor
    let topName = '';
    let topCount = 0;
    for (const [name, count] of competitorCounts) {
      if (count > topCount) {
        topName = name;
        topCount = count;
      }
    }

    return {
      competitorName: topName,
      theirMentions: topCount,
      yourMentions,
      ratio: yourMentions > 0 ? topCount / yourMentions : null,
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { service: 'competitor-teaser', sprint: 'S37' } });
    return null;
  }
}
