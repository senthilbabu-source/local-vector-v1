// ---------------------------------------------------------------------------
// lib/services/benchmark-service.ts — Sprint 122: Benchmark Comparisons
//
// Pure computation functions + cron orchestrator + cache reader.
// Uses visibility_analytics.share_of_voice as the source SOV score.
//
// Privacy guarantee: benchmark_snapshots stores ONLY aggregates (count,
// median, p25, p75, p90) — never org_ids or individual scores. Minimum
// 5-org sample before any benchmark is shown.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MIN_BENCHMARK_SAMPLE_SIZE = 5;

// Paid plan tiers eligible for benchmark pool (excludes trial/free)
const PAID_PLAN_TIERS = ['starter', 'growth', 'agency'] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BucketKey {
  category_key: string;
  location_key: string;
  category_label: string;
  location_label: string;
}

export interface BenchmarkRunResult {
  snapshots_written: number;
  orgs_cached: number;
  buckets_skipped: number;
}

export interface OrgBenchmarkResult {
  percentile_rank: number;
  org_sov_score: number;
  industry_median: number;
  top_quartile_threshold: number;
  top_10pct_threshold: number;
  sample_count: number;
  category_label: string;
  location_label: string;
  week_of: string;
}

interface OrgScoreRow {
  org_id: string;
  city: string | null;
  categories: unknown;
  share_of_voice: number;
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Normalize a raw string into a bucket key.
 * lowercase → trim → replace non-alphanum with _ → dedupe underscores → trim _
 */
export function normalizeBucketKey(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Compute percentile rank using strict less-than.
 * Percentile = (count of scores strictly < orgScore / total) * 100
 * Rounded to 1 decimal. Empty array → 50.
 */
export function computePercentileRank(orgScore: number, allScores: number[]): number {
  if (allScores.length === 0) return 50;
  const below = allScores.filter((s) => s < orgScore).length;
  return Math.round((below / allScores.length) * 1000) / 10;
}

/**
 * Compute percentiles using linear interpolation.
 * index = (p/100) * (n-1)
 * Single-element array: all percentiles = that value.
 */
export function computePercentiles(scores: number[]): {
  p25: number;
  p50: number;
  p75: number;
  p90: number;
} {
  if (scores.length === 0) {
    return { p25: 0, p50: 0, p75: 0, p90: 0 };
  }

  const sorted = [...scores].sort((a, b) => a - b);

  if (sorted.length === 1) {
    const val = sorted[0];
    return { p25: val, p50: val, p75: val, p90: val };
  }

  function percentile(p: number): number {
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    const fraction = index - lower;
    return Math.round((sorted[lower] + fraction * (sorted[upper] - sorted[lower])) * 10) / 10;
  }

  return {
    p25: percentile(25),
    p50: percentile(50),
    p75: percentile(75),
    p90: percentile(90),
  };
}

// ---------------------------------------------------------------------------
// Database functions
// ---------------------------------------------------------------------------

/**
 * Get the bucket key for an org based on their primary location's
 * category + city.
 */
export async function getBucketKeyForOrg(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<BucketKey | null> {
  const { data: location } = await supabase
    .from('locations')
    .select('city, categories')
    .eq('org_id', orgId)
    .eq('is_primary', true)
    .maybeSingle();

  if (!location?.city) return null;

  const categories = location.categories as string[] | null;
  const primaryCategory = categories?.[0] ?? 'Restaurant';
  const city = location.city;

  return {
    category_key: normalizeBucketKey(primaryCategory),
    location_key: normalizeBucketKey(city),
    category_label: primaryCategory,
    location_label: city,
  };
}

/**
 * Compute the most recent Sunday date (YYYY-MM-DD).
 * Walks backward from today until getDay() === 0.
 * If today IS Sunday, returns today.
 * Does NOT use date-fns startOf('week') — it returns Monday.
 */
export function getMostRecentSunday(from?: Date): string {
  const d = from ? new Date(from) : new Date();
  // Use UTC to avoid timezone issues
  while (d.getUTCDay() !== 0) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Cron orchestrator
// ---------------------------------------------------------------------------

/**
 * Run benchmark computation for a given week.
 *
 * 1. Fetch all org scores for the week from visibility_analytics
 * 2. Group by (category_key, location_key) in TypeScript
 * 3. For each group with >= MIN_BENCHMARK_SAMPLE_SIZE:
 *    a. Compute percentiles → UPSERT benchmark_snapshots
 *    b. For each org → compute percentile rank → UPSERT org_benchmark_cache
 */
export async function runBenchmarkComputation(
  supabase: SupabaseClient<Database>,
  weekOf: Date,
): Promise<BenchmarkRunResult> {
  const weekOfStr = weekOf.toISOString().split('T')[0];

  // Fetch org SOV scores for this week (paid plans only)
  // Join visibility_analytics → organizations → locations
  const { data: rows, error } = await supabase
    .from('visibility_analytics')
    .select(`
      org_id,
      share_of_voice,
      organizations!inner ( plan, plan_status ),
      locations!inner ( city, categories )
    `)
    .filter('snapshot_date', 'eq', weekOfStr)
    .not('share_of_voice', 'is', null)
    .in('organizations.plan', PAID_PLAN_TIERS as unknown as readonly ('trial' | 'starter' | 'growth' | 'agency' | null)[])
    .eq('organizations.plan_status', 'active');

  if (error) {
    throw new Error(`Benchmark query failed: ${error.message}`);
  }

  if (!rows || rows.length === 0) {
    return { snapshots_written: 0, orgs_cached: 0, buckets_skipped: 0 };
  }

  // Map to typed rows
  const orgScores: OrgScoreRow[] = rows
    .filter((r) => r.organizations && r.locations)
    .map((r) => ({
      org_id: r.org_id,
      city: (r.locations as unknown as { city: string | null; categories: unknown }).city,
      categories: (r.locations as unknown as { city: string | null; categories: unknown }).categories,
      share_of_voice: r.share_of_voice!,
    }));

  // Group by (category_key, location_key) in TypeScript
  const buckets: Record<string, {
    category_key: string;
    location_key: string;
    category_label: string;
    location_label: string;
    orgs: Array<{ org_id: string; score: number }>;
  }> = {};

  for (const row of orgScores) {
    if (!row.city) continue;
    const categories = row.categories as string[] | null;
    const primaryCategory = categories?.[0] ?? 'Restaurant';

    const catKey = normalizeBucketKey(primaryCategory);
    const locKey = normalizeBucketKey(row.city);
    const bucketId = `${catKey}_${locKey}`;

    if (!buckets[bucketId]) {
      buckets[bucketId] = {
        category_key: catKey,
        location_key: locKey,
        category_label: primaryCategory,
        location_label: row.city,
        orgs: [],
      };
    }
    buckets[bucketId].orgs.push({ org_id: row.org_id, score: row.share_of_voice });
  }

  let snapshotsWritten = 0;
  let orgsCached = 0;
  let bucketsSkipped = 0;

  for (const bucket of Object.values(buckets)) {
    if (bucket.orgs.length < MIN_BENCHMARK_SAMPLE_SIZE) {
      bucketsSkipped++;
      continue;
    }

    const scores = bucket.orgs.map((o) => o.score);
    const percentiles = computePercentiles(scores);

    // UPSERT benchmark_snapshots
    const { data: snapshotRow, error: snapErr } = await supabase
      .from('benchmark_snapshots')
      .upsert(
        {
          category_key: bucket.category_key,
          location_key: bucket.location_key,
          category_label: bucket.category_label,
          location_label: bucket.location_label,
          sample_count: bucket.orgs.length,
          score_median: percentiles.p50,
          score_p25: percentiles.p25,
          score_p75: percentiles.p75,
          score_p90: percentiles.p90,
          week_of: weekOfStr,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'category_key,location_key,week_of' },
      )
      .select('id')
      .single();

    if (snapErr) {
      console.error(`[benchmark] Snapshot upsert failed for ${bucket.category_key}/${bucket.location_key}:`, snapErr.message);
      continue;
    }

    snapshotsWritten++;
    const snapshotId = snapshotRow.id;

    // UPSERT org_benchmark_cache for each org
    for (const org of bucket.orgs) {
      const rank = computePercentileRank(org.score, scores);
      const { error: cacheErr } = await supabase
        .from('org_benchmark_cache')
        .upsert(
          {
            org_id: org.org_id,
            snapshot_id: snapshotId,
            week_of: weekOfStr,
            org_sov_score: org.score,
            percentile_rank: rank,
            category_key: bucket.category_key,
            location_key: bucket.location_key,
          },
          { onConflict: 'org_id,week_of' },
        );

      if (!cacheErr) orgsCached++;
    }
  }

  return {
    snapshots_written: snapshotsWritten,
    orgs_cached: orgsCached,
    buckets_skipped: bucketsSkipped,
  };
}

// ---------------------------------------------------------------------------
// Cache readers
// ---------------------------------------------------------------------------

/**
 * Read the pre-computed benchmark result for an org.
 * weekOf defaults to most recent Sunday.
 * Returns null if no data.
 */
export async function getOrgBenchmark(
  supabase: SupabaseClient<Database>,
  orgId: string,
  weekOf?: string,
): Promise<OrgBenchmarkResult | null> {
  const targetWeek = weekOf ?? getMostRecentSunday();

  const { data: cache } = await supabase
    .from('org_benchmark_cache')
    .select('*, benchmark_snapshots(*)')
    .eq('org_id', orgId)
    .eq('week_of', targetWeek)
    .maybeSingle();

  if (!cache) return null;

  const snapshot = cache.benchmark_snapshots as unknown as {
    score_median: number;
    score_p75: number;
    score_p90: number;
    sample_count: number;
    category_label: string;
    location_label: string;
  } | null;

  if (!snapshot) return null;

  return {
    percentile_rank: Number(cache.percentile_rank),
    org_sov_score: Number(cache.org_sov_score),
    industry_median: Number(snapshot.score_median),
    top_quartile_threshold: Number(snapshot.score_p75),
    top_10pct_threshold: Number(snapshot.score_p90),
    sample_count: snapshot.sample_count,
    category_label: snapshot.category_label,
    location_label: snapshot.location_label,
    week_of: cache.week_of,
  };
}

/**
 * Read benchmark history for an org (oldest first).
 * ORDER BY week_of ASC — trend direction depends on this.
 */
export async function getOrgBenchmarkHistory(
  supabase: SupabaseClient<Database>,
  orgId: string,
  weeks: number = 8,
): Promise<OrgBenchmarkResult[]> {
  const { data: rows } = await supabase
    .from('org_benchmark_cache')
    .select('*, benchmark_snapshots(*)')
    .eq('org_id', orgId)
    .order('week_of', { ascending: true })
    .limit(weeks);

  if (!rows || rows.length === 0) return [];

  return rows
    .map((cache) => {
      const snapshot = cache.benchmark_snapshots as unknown as {
        score_median: number;
        score_p75: number;
        score_p90: number;
        sample_count: number;
        category_label: string;
        location_label: string;
      } | null;

      if (!snapshot) return null;

      return {
        percentile_rank: Number(cache.percentile_rank),
        org_sov_score: Number(cache.org_sov_score),
        industry_median: Number(snapshot.score_median),
        top_quartile_threshold: Number(snapshot.score_p75),
        top_10pct_threshold: Number(snapshot.score_p90),
        sample_count: snapshot.sample_count,
        category_label: snapshot.category_label,
        location_label: snapshot.location_label,
        week_of: cache.week_of,
      };
    })
    .filter((r): r is OrgBenchmarkResult => r !== null);
}
