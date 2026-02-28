// ---------------------------------------------------------------------------
// lib/data/benchmarks.ts — Sprint F (N4): Benchmark Comparison data layer
//
// Fetches the pre-computed benchmark for the user's city+industry from the
// benchmarks table. Also fetches the org's city and primary category from
// their primary/active location.
//
// Uses authenticated Supabase client (RLS: any authenticated user can read
// benchmarks). Location data is RLS-scoped to user's org.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BenchmarkData {
  city: string;
  industry: string;
  org_count: number;
  avg_score: number;
  min_score: number;
  max_score: number;
  computed_at?: string;
}

/** Sprint O: Benchmarks older than 14 days are stale and should not be shown */
const MAX_BENCHMARK_AGE_DAYS = 14;

export interface OrgLocationContext {
  city: string | null;
  industry: string | null;
}

// ---------------------------------------------------------------------------
// Fetch benchmark for an org
// ---------------------------------------------------------------------------

/**
 * Fetches the city+industry benchmark for the given org's primary/active location.
 * Returns null if no location, no city, or no benchmark row exists.
 */
export async function fetchBenchmark(
  supabase: SupabaseClient<Database>,
  orgId: string,
  locationId?: string | null,
): Promise<{ benchmark: BenchmarkData | null; locationContext: OrgLocationContext }> {
  try {
    // Get the org's location context (city + categories)
    let locationQuery = supabase
      .from('locations')
      .select('city, categories')
      .eq('org_id', orgId);

    if (locationId) {
      locationQuery = locationQuery.eq('id', locationId);
    } else {
      locationQuery = locationQuery.eq('is_primary', true);
    }

    const { data: location } = await locationQuery.maybeSingle();

    if (!location?.city) {
      return {
        benchmark: null,
        locationContext: { city: null, industry: null },
      };
    }

    const city = location.city;
    // Extract primary category from JSONB array
    const categories = location.categories as string[] | null;
    const industry = categories?.[0] || 'Restaurant';

    // Fetch the benchmark for this city + industry
    // Cast: benchmarks table is from Sprint F migration, not yet in database.types.ts
    const { data: benchmarkRow } = await (supabase.from as Function)('benchmarks')
      .select('city, industry, org_count, avg_score, min_score, max_score, computed_at')
      .eq('city', city)
      .eq('industry', industry)
      .maybeSingle() as { data: { city: string; industry: string; org_count: number; avg_score: number; min_score: number; max_score: number; computed_at: string | null } | null };

    // Sprint O: Staleness check — don't show benchmarks older than 14 days
    if (benchmarkRow?.computed_at) {
      const ageMs = Date.now() - new Date(benchmarkRow.computed_at).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays > MAX_BENCHMARK_AGE_DAYS) {
        return { benchmark: null, locationContext: { city, industry } };
      }
    }

    const benchmark: BenchmarkData | null = benchmarkRow
      ? {
          city: benchmarkRow.city,
          industry: benchmarkRow.industry,
          org_count: benchmarkRow.org_count,
          avg_score: Number(benchmarkRow.avg_score),
          min_score: Number(benchmarkRow.min_score),
          max_score: Number(benchmarkRow.max_score),
          computed_at: benchmarkRow.computed_at ?? undefined,
        }
      : null;

    return {
      benchmark,
      locationContext: { city, industry },
    };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { file: 'benchmarks.ts', sprint: 'F' },
      extra: { orgId },
    });
    return {
      benchmark: null,
      locationContext: { city: null, industry: null },
    };
  }
}
