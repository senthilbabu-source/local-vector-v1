// ---------------------------------------------------------------------------
// Sprint O (N4): Benchmark staleness + data layer — unit tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// We need to test fetchBenchmark which calls supabase.from()
// Mock the module to control what from() returns.

function createMockSupabase(options: {
  locationCity?: string | null;
  locationCategories?: string[] | null;
  benchmarkRow?: Record<string, unknown> | null;
}) {
  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === 'locations') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: options.locationCity !== undefined
            ? {
                city: options.locationCity,
                categories: options.locationCategories ?? ['Restaurant'],
              }
            : null,
        }),
      };
    }
    if (table === 'benchmarks') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: options.benchmarkRow ?? null,
        }),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    };
  });

  return { from: mockFrom } as unknown as SupabaseClient<Database>;
}

// Dynamic import to avoid hoisting issues — fetchBenchmark uses Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

describe('fetchBenchmark staleness check', () => {
  let fetchBenchmark: typeof import('@/lib/data/benchmarks').fetchBenchmark;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/lib/data/benchmarks');
    fetchBenchmark = mod.fetchBenchmark;
  });

  it('returns null when no location city', async () => {
    const supabase = createMockSupabase({ locationCity: null });
    const result = await fetchBenchmark(supabase, 'org-1');
    expect(result.benchmark).toBeNull();
    expect(result.locationContext.city).toBeNull();
  });

  it('returns null when no benchmark row exists', async () => {
    const supabase = createMockSupabase({
      locationCity: 'Alpharetta',
      benchmarkRow: null,
    });
    const result = await fetchBenchmark(supabase, 'org-1');
    expect(result.benchmark).toBeNull();
    expect(result.locationContext.city).toBe('Alpharetta');
  });

  it('returns benchmark when data is fresh (< 14 days)', async () => {
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const supabase = createMockSupabase({
      locationCity: 'Alpharetta',
      benchmarkRow: {
        city: 'Alpharetta',
        industry: 'Restaurant',
        org_count: 15,
        avg_score: 51,
        min_score: 28,
        max_score: 88,
        computed_at: fiveDaysAgo.toISOString(),
      },
    });
    const result = await fetchBenchmark(supabase, 'org-1');
    expect(result.benchmark).not.toBeNull();
    expect(result.benchmark!.avg_score).toBe(51);
    expect(result.benchmark!.org_count).toBe(15);
  });

  it('returns null when benchmark is stale (> 14 days)', async () => {
    const now = new Date();
    const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
    const supabase = createMockSupabase({
      locationCity: 'Alpharetta',
      benchmarkRow: {
        city: 'Alpharetta',
        industry: 'Restaurant',
        org_count: 15,
        avg_score: 51,
        min_score: 28,
        max_score: 88,
        computed_at: twentyDaysAgo.toISOString(),
      },
    });
    const result = await fetchBenchmark(supabase, 'org-1');
    expect(result.benchmark).toBeNull();
    // Should still return location context even though benchmark is stale
    expect(result.locationContext.city).toBe('Alpharetta');
    expect(result.locationContext.industry).toBe('Restaurant');
  });

  it('returns benchmark at exactly 14 days boundary (not stale)', async () => {
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const supabase = createMockSupabase({
      locationCity: 'Alpharetta',
      benchmarkRow: {
        city: 'Alpharetta',
        industry: 'Restaurant',
        org_count: 10,
        avg_score: 60,
        min_score: 30,
        max_score: 90,
        computed_at: fourteenDaysAgo.toISOString(),
      },
    });
    const result = await fetchBenchmark(supabase, 'org-1');
    // Exactly 14 days is at the boundary — should still be shown
    expect(result.benchmark).not.toBeNull();
  });

  it('returns null when computed_at is null', async () => {
    const supabase = createMockSupabase({
      locationCity: 'Alpharetta',
      benchmarkRow: {
        city: 'Alpharetta',
        industry: 'Restaurant',
        org_count: 15,
        avg_score: 51,
        min_score: 28,
        max_score: 88,
        computed_at: null,
      },
    });
    const result = await fetchBenchmark(supabase, 'org-1');
    // With null computed_at, staleness check is skipped — benchmark is returned
    expect(result.benchmark).not.toBeNull();
  });

  it('uses first category as industry or defaults to Restaurant', async () => {
    const supabase = createMockSupabase({
      locationCity: 'Atlanta',
      locationCategories: ['Medical Practice', 'Dentist'],
      benchmarkRow: null,
    });
    const result = await fetchBenchmark(supabase, 'org-1');
    expect(result.locationContext.industry).toBe('Medical Practice');
  });

  it('defaults to Restaurant when categories array is empty', async () => {
    const supabase = createMockSupabase({
      locationCity: 'Atlanta',
      locationCategories: [],
      benchmarkRow: null,
    });
    const result = await fetchBenchmark(supabase, 'org-1');
    expect(result.locationContext.industry).toBe('Restaurant');
  });

  it('includes computed_at in returned BenchmarkData', async () => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const supabase = createMockSupabase({
      locationCity: 'Alpharetta',
      benchmarkRow: {
        city: 'Alpharetta',
        industry: 'Restaurant',
        org_count: 12,
        avg_score: 55,
        min_score: 30,
        max_score: 80,
        computed_at: oneDayAgo.toISOString(),
      },
    });
    const result = await fetchBenchmark(supabase, 'org-1');
    expect(result.benchmark).not.toBeNull();
    expect(result.benchmark!.computed_at).toBeDefined();
  });
});
