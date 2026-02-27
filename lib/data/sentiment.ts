// ---------------------------------------------------------------------------
// lib/data/sentiment.ts — Sentiment Data Fetchers
//
// Sprint 81: Queries sov_evaluations for sentiment_data and aggregates
// into dashboard-ready summaries and time-series trends.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { aggregateSentiment, type SentimentSummary } from '@/lib/services/sentiment.service';
import type { SentimentExtraction } from '@/lib/ai/schemas';

/**
 * Fetch sentiment data for the dashboard.
 * Returns aggregated sentiment across all recent evaluations.
 */
export async function fetchSentimentSummary(
  supabase: SupabaseClient<Database>,
  orgId: string,
  locationId: string,
  options?: { dayRange?: number },
): Promise<SentimentSummary> {
  const dayRange = options?.dayRange ?? 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - dayRange);

  const { data: evaluations } = await supabase
    .from('sov_evaluations')
    .select('engine, sentiment_data')
    .eq('org_id', orgId)
    .eq('location_id', locationId)
    .not('sentiment_data', 'is', null)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false });

  return aggregateSentiment(
    (evaluations ?? []).map(e => ({
      engine: e.engine,
      sentiment_data: e.sentiment_data as SentimentExtraction | null,
    })),
  );
}

/**
 * Fetch sentiment trend over time for charting.
 * Groups evaluations by week and computes average score per week.
 */
export async function fetchSentimentTrend(
  supabase: SupabaseClient<Database>,
  orgId: string,
  locationId: string,
  options?: { weekCount?: number },
): Promise<Array<{ weekStart: string; averageScore: number; evaluationCount: number }>> {
  const weekCount = options?.weekCount ?? 12;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weekCount * 7);

  const { data: evaluations } = await supabase
    .from('sov_evaluations')
    .select('created_at, sentiment_data')
    .eq('org_id', orgId)
    .eq('location_id', locationId)
    .not('sentiment_data', 'is', null)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: true });

  // Group by ISO week
  const weeks = new Map<string, { scores: number[]; count: number }>();
  for (const e of evaluations ?? []) {
    const sentiment = e.sentiment_data as SentimentExtraction | null;
    if (!sentiment) continue;

    const date = new Date(e.created_at);
    const weekStart = getWeekStart(date).toISOString().split('T')[0];

    const week = weeks.get(weekStart) ?? { scores: [], count: 0 };
    week.scores.push(sentiment.score);
    week.count++;
    weeks.set(weekStart, week);
  }

  return [...weeks.entries()].map(([weekStart, { scores, count }]) => ({
    weekStart,
    averageScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100,
    evaluationCount: count,
  }));
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}
