// ---------------------------------------------------------------------------
// lib/analytics/degradation-detector.ts — S22: AI Model Degradation Detection
//
// Cross-org analysis of hallucination alert spikes to detect AI model updates.
// Pure analysis functions + I/O layer for Supabase queries.
//
// When 20%+ of orgs simultaneously show new error spikes (current week > mean
// + 2 standard deviations), the system generates a degradation event.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RollingStats {
  mean: number;
  stddev: number;
  sampleCount: number;
}

export interface DegradationEvent {
  model_provider: string;
  affected_org_count: number;
  total_org_count: number;
  avg_alert_spike: number;
  sigma_above_mean: number;
}

// Internal type for per-org weekly alert counts
interface OrgWeeklyAlerts {
  org_id: string;
  week_counts: number[]; // oldest first, length = weeks fetched
}

// ---------------------------------------------------------------------------
// Pure analysis functions
// ---------------------------------------------------------------------------

/**
 * Computes rolling mean and standard deviation from a numeric series.
 * Returns mean=0, stddev=0 for empty arrays.
 */
export function computeRollingStats(series: number[]): RollingStats {
  if (series.length === 0) {
    return { mean: 0, stddev: 0, sampleCount: 0 };
  }

  const n = series.length;
  const mean = series.reduce((sum, v) => sum + v, 0) / n;

  if (n < 2) {
    return { mean, stddev: 0, sampleCount: n };
  }

  const variance = series.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1);
  const stddev = Math.sqrt(variance);

  return { mean, stddev, sampleCount: n };
}

/**
 * Determines if a current value is a statistical anomaly (> mean + 2 sigma).
 * Returns false when stddev is 0 (all values equal — no anomaly possible).
 */
export function isDegraded(current: number, stats: RollingStats): boolean {
  if (stats.stddev === 0) return false;
  if (stats.sampleCount < 2) return false;
  return current > stats.mean + 2 * stats.stddev;
}

// ---------------------------------------------------------------------------
// I/O — Cross-org degradation detection (requires service-role client)
// ---------------------------------------------------------------------------

/**
 * Detects potential AI model degradation events by analyzing hallucination
 * alert counts across all orgs over the last 5 weeks.
 *
 * Threshold: if >= 20% of orgs show a spike (current week > mean + 2σ),
 * generates a degradation event for the given model provider.
 *
 * Never throws — returns empty array on any error.
 */
export async function detectModelDegradation(
  supabase: SupabaseClient,
  modelProvider?: string,
): Promise<DegradationEvent[]> {
  try {
    // Fetch last 5 weeks of open hallucination counts per org
    const fiveWeeksAgo = new Date(Date.now() - 5 * 7 * 24 * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from('ai_hallucinations')
      .select('org_id, first_detected_at, model_provider')
      .eq('correction_status', 'open')
      .gte('first_detected_at', fiveWeeksAgo);

    if (modelProvider) {
      query = query.eq('model_provider', modelProvider);
    }

    const { data: rows, error } = await query;
    if (error || !rows || rows.length === 0) return [];

    // Group by org + week bucket
    const orgWeeks = groupByOrgAndWeek(rows as { org_id: string; first_detected_at: string; model_provider: string }[]);
    if (orgWeeks.length === 0) return [];

    // Analyze each org's time series
    const events: DegradationEvent[] = [];
    const models = modelProvider ? [modelProvider] : getUniqueModels(rows as { model_provider: string }[]);

    for (const model of models) {
      const modelRows = modelProvider
        ? rows as { org_id: string; first_detected_at: string; model_provider: string }[]
        : (rows as { org_id: string; first_detected_at: string; model_provider: string }[]).filter(
            (r) => r.model_provider === model,
          );
      const modelOrgWeeks = groupByOrgAndWeek(modelRows);
      const result = analyzeOrgWeeks(modelOrgWeeks, model);
      if (result) events.push(result);
    }

    return events;
  } catch (err) {
    Sentry.captureException(err, { tags: { service: 'degradation-detector', sprint: 'S22' } });
    return [];
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getWeekBucket(dateStr: string): number {
  const d = new Date(dateStr);
  // Week number relative to epoch — just needs to be consistent for grouping
  return Math.floor(d.getTime() / (7 * 24 * 60 * 60 * 1000));
}

function groupByOrgAndWeek(
  rows: { org_id: string; first_detected_at: string }[],
): OrgWeeklyAlerts[] {
  // Get all week buckets present in data
  const allWeeks = new Set<number>();
  const orgMap = new Map<string, Map<number, number>>();

  for (const row of rows) {
    const week = getWeekBucket(row.first_detected_at);
    allWeeks.add(week);

    if (!orgMap.has(row.org_id)) {
      orgMap.set(row.org_id, new Map());
    }
    const weekMap = orgMap.get(row.org_id)!;
    weekMap.set(week, (weekMap.get(week) ?? 0) + 1);
  }

  const sortedWeeks = [...allWeeks].sort((a, b) => a - b);

  const result: OrgWeeklyAlerts[] = [];
  for (const [orgId, weekMap] of orgMap) {
    const weekCounts = sortedWeeks.map((w) => weekMap.get(w) ?? 0);
    result.push({ org_id: orgId, week_counts: weekCounts });
  }

  return result;
}

function getUniqueModels(rows: { model_provider: string }[]): string[] {
  return [...new Set(rows.map((r) => r.model_provider))];
}

function analyzeOrgWeeks(
  orgWeeks: OrgWeeklyAlerts[],
  modelProvider: string,
): DegradationEvent | null {
  if (orgWeeks.length === 0) return null;

  let flaggedCount = 0;
  let totalSpike = 0;
  let totalSigma = 0;

  for (const org of orgWeeks) {
    if (org.week_counts.length < 2) continue;

    const currentWeek = org.week_counts[org.week_counts.length - 1];
    const historicalWeeks = org.week_counts.slice(0, -1);
    const stats = computeRollingStats(historicalWeeks);

    if (isDegraded(currentWeek, stats)) {
      flaggedCount++;
      totalSpike += currentWeek - stats.mean;
      totalSigma += stats.stddev > 0 ? (currentWeek - stats.mean) / stats.stddev : 0;
    }
  }

  const totalOrgs = orgWeeks.length;
  const flaggedRatio = totalOrgs > 0 ? flaggedCount / totalOrgs : 0;

  // Threshold: >= 20% of orgs flagged
  if (flaggedRatio < 0.2 || flaggedCount === 0) return null;

  return {
    model_provider: modelProvider,
    affected_org_count: flaggedCount,
    total_org_count: totalOrgs,
    avg_alert_spike: Math.round((totalSpike / flaggedCount) * 100) / 100,
    sigma_above_mean: Math.round((totalSigma / flaggedCount) * 100) / 100,
  };
}
