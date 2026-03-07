// ---------------------------------------------------------------------------
// lib/services/competitor-watch.ts — S46: Competitor Watch Alerts
//
// Pure functions that detect significant competitor SOV changes.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompetitorChange {
  name: string;
  currentMentions: number;
  previousMentions: number;
  deltaPct: number;
  direction: 'up' | 'down';
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Detects competitor changes by comparing current vs previous mention counts.
 */
export function detectCompetitorChanges(
  currentCounts: Map<string, number>,
  previousCounts: Map<string, number>,
): CompetitorChange[] {
  const changes: CompetitorChange[] = [];

  // Check all competitors in current period
  for (const [name, current] of currentCounts) {
    const previous = previousCounts.get(name) ?? 0;
    if (previous === 0 && current > 0) {
      // New competitor — treat as 100% increase
      changes.push({ name, currentMentions: current, previousMentions: 0, deltaPct: 100, direction: 'up' });
      continue;
    }
    if (previous === 0) continue;
    const deltaPct = Math.round(((current - previous) / previous) * 100);
    if (deltaPct !== 0) {
      changes.push({
        name,
        currentMentions: current,
        previousMentions: previous,
        deltaPct: Math.abs(deltaPct),
        direction: deltaPct > 0 ? 'up' : 'down',
      });
    }
  }

  // Check competitors that disappeared
  for (const [name, previous] of previousCounts) {
    if (!currentCounts.has(name) && previous > 0) {
      changes.push({ name, currentMentions: 0, previousMentions: previous, deltaPct: 100, direction: 'down' });
    }
  }

  // Sort by magnitude
  return changes.sort((a, b) => b.deltaPct - a.deltaPct);
}

/**
 * Returns true when a change is significant (>= threshold %).
 */
export function isSignificantChange(change: CompetitorChange, threshold = 10): boolean {
  return change.deltaPct >= threshold;
}

/**
 * Formats a competitor change as a plain-English alert.
 */
export function formatCompetitorAlert(change: CompetitorChange): string {
  if (change.direction === 'up') {
    return `${change.name} jumped ${change.deltaPct}% in AI mentions this week`;
  }
  return `${change.name} dropped ${change.deltaPct}% in AI mentions this week`;
}

// ---------------------------------------------------------------------------
// I/O — Fetch competitor changes from DB
// ---------------------------------------------------------------------------

function countCompetitors(rows: Array<{ mentioned_competitors: unknown }>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const competitors = row.mentioned_competitors as string[] | null;
    if (!Array.isArray(competitors)) continue;
    for (const c of competitors) {
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Gets significant competitor changes over the last week vs previous week.
 * Never throws — returns empty array on error.
 */
export async function getCompetitorChanges(
  supabase: SupabaseClient,
  orgId: string,
  threshold = 10,
): Promise<CompetitorChange[]> {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const [currentResult, previousResult] = await Promise.all([
      supabase
        .from('sov_evaluations')
        .select('mentioned_competitors')
        .eq('org_id', orgId)
        .gte('created_at', sevenDaysAgo),

      supabase
        .from('sov_evaluations')
        .select('mentioned_competitors')
        .eq('org_id', orgId)
        .gte('created_at', fourteenDaysAgo)
        .lt('created_at', sevenDaysAgo),
    ]);

    const currentCounts = countCompetitors(currentResult.data ?? []);
    const previousCounts = countCompetitors(previousResult.data ?? []);

    const changes = detectCompetitorChanges(currentCounts, previousCounts);
    return changes.filter(c => isSignificantChange(c, threshold));
  } catch (err) {
    Sentry.captureException(err, { tags: { service: 'competitor-watch', sprint: 'S46' } });
    return [];
  }
}
