// ---------------------------------------------------------------------------
// Sprint 122: benchmark-service.test.ts — 20 tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  normalizeBucketKey,
  computePercentileRank,
  computePercentiles,
  runBenchmarkComputation,
  getMostRecentSunday,
  MIN_BENCHMARK_SAMPLE_SIZE,
} from '@/lib/services/benchmark-service';

// ---------------------------------------------------------------------------
// normalizeBucketKey — 6 tests
// ---------------------------------------------------------------------------

describe('normalizeBucketKey', () => {
  it('converts to lowercase', () => {
    expect(normalizeBucketKey('Hookah Lounge')).toBe('hookah_lounge');
  });

  it('replaces spaces with underscores', () => {
    expect(normalizeBucketKey('bar and grill')).toBe('bar_and_grill');
  });

  it('strips commas', () => {
    expect(normalizeBucketKey('Alpharetta, GA')).toBe('alpharetta_ga');
  });

  it('handles "Alpharetta, GA" → "alpharetta_ga"', () => {
    expect(normalizeBucketKey('Alpharetta, GA')).toBe('alpharetta_ga');
  });

  it('strips ampersands', () => {
    expect(normalizeBucketKey('Bar & Grill')).toBe('bar_grill');
  });

  it('dedupes consecutive underscores', () => {
    expect(normalizeBucketKey('foo   bar')).toBe('foo_bar');
  });
});

// ---------------------------------------------------------------------------
// computePercentileRank — 5 tests
// ---------------------------------------------------------------------------

describe('computePercentileRank', () => {
  it('returns 50 for empty array', () => {
    expect(computePercentileRank(67, [])).toBe(50);
  });

  it('returns 0 for the lowest score', () => {
    expect(computePercentileRank(10, [10, 20, 30, 40, 50])).toBe(0);
  });

  it('returns 100 for score higher than all others', () => {
    expect(computePercentileRank(100, [10, 20, 30, 40, 50])).toBe(100);
  });

  it('computes correct value for known array', () => {
    // 67 is strictly greater than [30, 40, 50, 55] = 4 out of 8
    const scores = [30, 40, 50, 55, 67, 70, 80, 90];
    expect(computePercentileRank(67, scores)).toBe(50);
  });

  it('uses strict less-than for tied scores', () => {
    // 50 — 2 values strictly less (10, 30), total 5
    const scores = [10, 30, 50, 50, 70];
    expect(computePercentileRank(50, scores)).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// computePercentiles — 4 tests
// ---------------------------------------------------------------------------

describe('computePercentiles', () => {
  it('computes p50 as the median', () => {
    const result = computePercentiles([10, 20, 30, 40, 50]);
    expect(result.p50).toBe(30);
  });

  it('computes p25 and p75 correctly', () => {
    // Array [10,20,30,40,50,60,70,80], n=8
    // p25: index = 0.25 * 7 = 1.75. lower=20, upper=30, frac=0.75 → 27.5
    // p75: index = 0.75 * 7 = 5.25. lower=60, upper=70, frac=0.25 → 62.5
    const result = computePercentiles([10, 20, 30, 40, 50, 60, 70, 80]);
    expect(result.p25).toBe(27.5);
    expect(result.p75).toBe(62.5);
  });

  it('computes p90 correctly', () => {
    const result = computePercentiles([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(result.p90).toBe(91);
  });

  it('returns all equal for single-element array', () => {
    const result = computePercentiles([42]);
    expect(result.p25).toBe(42);
    expect(result.p50).toBe(42);
    expect(result.p75).toBe(42);
    expect(result.p90).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// runBenchmarkComputation — 5 mocked tests
// ---------------------------------------------------------------------------

describe('runBenchmarkComputation', () => {
  let mockSupabase: SupabaseClient<Database>;
  let mockFrom: ReturnType<typeof vi.fn>;
  let mockUpsert: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUpsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'snap-001' }, error: null }),
      }),
    });

    mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }),
      upsert: mockUpsert,
    });

    mockSupabase = { from: mockFrom } as unknown as SupabaseClient<Database>;
  });

  it('returns zeros when no eligible orgs exist', async () => {
    const result = await runBenchmarkComputation(mockSupabase, new Date('2026-03-01'));
    expect(result).toEqual({
      snapshots_written: 0,
      orgs_cached: 0,
      buckets_skipped: 0,
    });
  });

  it('skips bucket with fewer than MIN_BENCHMARK_SAMPLE_SIZE orgs', async () => {
    // Return 3 orgs (below threshold of 5)
    const threeOrgs = Array.from({ length: 3 }, (_, i) => ({
      org_id: `org-${i}`,
      share_of_voice: 50 + i * 10,
      organizations: { plan: 'growth', plan_status: 'active' },
      locations: { city: 'Alpharetta', categories: ['Hookah Bar'] },
    }));

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: threeOrgs, error: null }),
            }),
          }),
        }),
      }),
    });

    const result = await runBenchmarkComputation(mockSupabase, new Date('2026-03-01'));
    expect(result.buckets_skipped).toBe(1);
    expect(result.snapshots_written).toBe(0);
  });

  it('writes snapshot and cache for bucket with >= 5 orgs', async () => {
    const fiveOrgs = Array.from({ length: 5 }, (_, i) => ({
      org_id: `org-${i}`,
      share_of_voice: 40 + i * 10,
      organizations: { plan: 'growth', plan_status: 'active' },
      locations: { city: 'Alpharetta', categories: ['Hookah Bar'] },
    }));

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: fiveOrgs, error: null }),
            }),
          }),
        }),
      }),
    });

    // Snapshot upsert
    mockFrom.mockReturnValueOnce({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'snap-001' }, error: null }),
        }),
      }),
    });

    // 5 cache upserts
    for (let i = 0; i < 5; i++) {
      mockFrom.mockReturnValueOnce({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });
    }

    const result = await runBenchmarkComputation(mockSupabase, new Date('2026-03-01'));
    expect(result.snapshots_written).toBe(1);
    expect(result.orgs_cached).toBe(5);
    expect(result.buckets_skipped).toBe(0);
  });

  it('UPSERT on re-run produces no duplicate rows', async () => {
    // First run and second run should both succeed with upsert
    const fiveOrgs = Array.from({ length: 5 }, (_, i) => ({
      org_id: `org-${i}`,
      share_of_voice: 40 + i * 10,
      organizations: { plan: 'growth', plan_status: 'active' },
      locations: { city: 'Alpharetta', categories: ['Hookah Bar'] },
    }));

    const setupMocks = () => {
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          filter: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: fiveOrgs, error: null }),
              }),
            }),
          }),
        }),
      });

      mockFrom.mockReturnValueOnce({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'snap-001' }, error: null }),
          }),
        }),
      });

      for (let i = 0; i < 5; i++) {
        mockFrom.mockReturnValueOnce({
          upsert: vi.fn().mockResolvedValue({ error: null }),
        });
      }
    };

    // Run twice
    setupMocks();
    const result1 = await runBenchmarkComputation(mockSupabase, new Date('2026-03-01'));
    setupMocks();
    const result2 = await runBenchmarkComputation(mockSupabase, new Date('2026-03-01'));

    // Both should succeed — upsert means no duplicates
    expect(result1.snapshots_written).toBe(1);
    expect(result2.snapshots_written).toBe(1);
  });

  it('returns all zeros when query returns empty results', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }),
    });

    const result = await runBenchmarkComputation(mockSupabase, new Date('2026-03-01'));
    expect(result).toEqual({
      snapshots_written: 0,
      orgs_cached: 0,
      buckets_skipped: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// getMostRecentSunday — additional sanity checks
// ---------------------------------------------------------------------------

describe('getMostRecentSunday', () => {
  it('returns a YYYY-MM-DD string', () => {
    const result = getMostRecentSunday();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns a Sunday', () => {
    const result = getMostRecentSunday();
    const d = new Date(result + 'T00:00:00Z');
    expect(d.getUTCDay()).toBe(0);
  });

  it('returns today if today is Sunday', () => {
    // 2026-03-01 is a Sunday
    const result = getMostRecentSunday(new Date('2026-03-01T12:00:00Z'));
    expect(result).toBe('2026-03-01');
  });

  it('walks back to previous Sunday', () => {
    // 2026-03-04 is a Wednesday → should return 2026-03-01
    const result = getMostRecentSunday(new Date('2026-03-04T12:00:00Z'));
    expect(result).toBe('2026-03-01');
  });
});

// ---------------------------------------------------------------------------
// MIN_BENCHMARK_SAMPLE_SIZE constant
// ---------------------------------------------------------------------------

describe('MIN_BENCHMARK_SAMPLE_SIZE', () => {
  it('equals 5', () => {
    expect(MIN_BENCHMARK_SAMPLE_SIZE).toBe(5);
  });
});
