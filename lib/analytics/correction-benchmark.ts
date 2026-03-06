// ---------------------------------------------------------------------------
// lib/analytics/correction-benchmark.ts — S23: Correction Effectiveness Database
//
// Cross-org aggregation of correction timing data to build proprietary
// benchmarks. Shows owners how their correction speed compares.
//
// Pure analysis functions + I/O layer (service-role queries).
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CorrectionBenchmarkEntry {
  avg_days_to_fix: number;
  median_days_to_fix: number;
  p75_days_to_fix: number;
  recurrence_rate: number; // 0-1
  sample_size: number;
}

export type CorrectionBenchmarkData = Record<string, CorrectionBenchmarkEntry>;

// Internal row shape from DB
interface CorrectionRow {
  model_provider: string;
  fix_guidance_category: string | null;
  first_detected_at: string;
  fixed_at: string | null;
  verified_at: string | null;
  follow_up_result: string | null;
}

// ---------------------------------------------------------------------------
// Pure analysis functions
// ---------------------------------------------------------------------------

/**
 * Computes median of a sorted numeric array.
 */
export function computeMedian(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Computes the 75th percentile of a sorted numeric array.
 */
export function computeP75(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = 0.75 * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

/**
 * Groups correction rows by model+category key and computes benchmark stats.
 */
export function buildBenchmarks(rows: CorrectionRow[]): CorrectionBenchmarkData {
  const groups = new Map<string, { daysToFix: number[]; recurringCount: number; totalVerified: number }>();

  for (const row of rows) {
    const category = row.fix_guidance_category ?? 'unknown';
    const key = `${row.model_provider}_${category}`;

    if (!groups.has(key)) {
      groups.set(key, { daysToFix: [], recurringCount: 0, totalVerified: 0 });
    }
    const group = groups.get(key)!;

    // Calculate days to fix (first_detected_at → verified_at or fixed_at)
    const resolvedAt = row.verified_at ?? row.fixed_at;
    if (resolvedAt && row.first_detected_at) {
      const days = (new Date(resolvedAt).getTime() - new Date(row.first_detected_at).getTime()) / (1000 * 60 * 60 * 24);
      if (days >= 0) group.daysToFix.push(days);
    }

    // Track recurrence rate
    if (row.follow_up_result === 'recurring') group.recurringCount++;
    if (row.follow_up_result) group.totalVerified++;
  }

  const result: CorrectionBenchmarkData = {};

  for (const [key, group] of groups) {
    if (group.daysToFix.length === 0) continue;

    const sorted = [...group.daysToFix].sort((a, b) => a - b);
    const avg = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;

    result[key] = {
      avg_days_to_fix: Math.round(avg * 100) / 100,
      median_days_to_fix: Math.round(computeMedian(sorted) * 100) / 100,
      p75_days_to_fix: Math.round(computeP75(sorted) * 100) / 100,
      recurrence_rate: group.totalVerified > 0
        ? Math.round((group.recurringCount / group.totalVerified) * 100) / 100
        : 0,
      sample_size: sorted.length,
    };
  }

  return result;
}

/**
 * Computes percentile rank of a specific correction's days-to-fix against
 * the benchmark for its model+category. Returns null when sample_size < 30.
 */
export function computePercentileRank(
  daysToFix: number,
  benchmarkEntry: CorrectionBenchmarkEntry | undefined,
): number | null {
  if (!benchmarkEntry) return null;
  if (benchmarkEntry.sample_size < 30) return null;

  // Faster = better → higher percentile
  // Use the median and p75 as reference points for estimation
  const { avg_days_to_fix, median_days_to_fix, p75_days_to_fix } = benchmarkEntry;

  // Simple percentile estimation: what fraction of fixes are slower than this one?
  // Linear interpolation between known quantile points
  if (daysToFix <= 0) return 99;
  if (daysToFix <= median_days_to_fix) {
    // Faster than median → 50-99th percentile
    const ratio = median_days_to_fix > 0 ? daysToFix / median_days_to_fix : 0;
    return Math.round(99 - ratio * 49);
  }
  if (daysToFix <= p75_days_to_fix) {
    // Between median and p75 → 25-50th percentile
    const range = p75_days_to_fix - median_days_to_fix;
    const ratio = range > 0 ? (daysToFix - median_days_to_fix) / range : 0;
    return Math.round(50 - ratio * 25);
  }
  if (daysToFix <= avg_days_to_fix * 2) {
    // Slower than p75 → 1-25th percentile
    const range = avg_days_to_fix * 2 - p75_days_to_fix;
    const ratio = range > 0 ? (daysToFix - p75_days_to_fix) / range : 1;
    return Math.max(1, Math.round(25 - ratio * 24));
  }

  return 1;
}

// ---------------------------------------------------------------------------
// I/O — Service-role queries
// ---------------------------------------------------------------------------

/**
 * Fetches all corrections with verified_at across all orgs and builds
 * benchmark data. Requires service-role client.
 */
export async function computeCorrectionBenchmarks(
  supabase: SupabaseClient,
): Promise<CorrectionBenchmarkData> {
  try {
    const { data: rows, error } = await supabase
      .from('ai_hallucinations')
      .select('model_provider, fix_guidance_category, first_detected_at, fixed_at, verified_at, follow_up_result' as 'model_provider, first_detected_at')
      .not('verified_at' as 'first_detected_at', 'is', null)
      .limit(5000);

    if (error || !rows) return {};
    return buildBenchmarks(rows as unknown as CorrectionRow[]);
  } catch (err) {
    Sentry.captureException(err, { tags: { service: 'correction-benchmark', sprint: 'S23' } });
    return {};
  }
}

/**
 * Gets the percentile rank for a specific fixed hallucination.
 * Returns null when insufficient benchmark data.
 */
export async function getCorrectionPercentile(
  supabase: SupabaseClient,
  hallucinationId: string,
  benchmarks: CorrectionBenchmarkData,
): Promise<number | null> {
  try {
    const { data: row } = await supabase
      .from('ai_hallucinations')
      .select('model_provider, fix_guidance_category, first_detected_at, verified_at, fixed_at' as 'model_provider, first_detected_at')
      .eq('id', hallucinationId)
      .maybeSingle();

    if (!row) return null;
    const typed = row as unknown as CorrectionRow;

    const resolvedAt = typed.verified_at ?? typed.fixed_at;
    if (!resolvedAt || !typed.first_detected_at) return null;

    const daysToFix = (new Date(resolvedAt).getTime() - new Date(typed.first_detected_at).getTime()) / (1000 * 60 * 60 * 24);
    const category = typed.fix_guidance_category ?? 'unknown';
    const key = `${typed.model_provider}_${category}`;

    return computePercentileRank(daysToFix, benchmarks[key]);
  } catch (err) {
    Sentry.captureException(err, { tags: { service: 'correction-benchmark', sprint: 'S23' } });
    return null;
  }
}
