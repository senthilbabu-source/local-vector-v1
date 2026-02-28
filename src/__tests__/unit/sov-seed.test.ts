// ---------------------------------------------------------------------------
// sov-seed.test.ts — Unit tests for SOV query seeder service
//
// Sprint C (M1): Tests seedSOVQueries() and helper functions.
// Mocks Supabase upsert — no real DB calls.
//
// Run:
//   npx vitest run src/__tests__/unit/sov-seed.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  seedSOVQueries,
  discoveryQueries,
  nearMeQueries,
  occasionQueries,
  comparisonQueries,
  isHospitalityCategory,
  HOSPITALITY_CATEGORIES,
  type CompetitorForSeed,
} from '@/lib/services/sov-seed';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeLocation(overrides: Partial<{
  id: string;
  org_id: string;
  business_name: string;
  city: string | null;
  state: string | null;
  categories: string[] | null;
}> = {}) {
  return {
    id: 'loc-uuid-001',
    org_id: 'org-uuid-001',
    business_name: 'Charcoal N Chill',
    city: 'Alpharetta',
    state: 'GA',
    categories: ['restaurant'],
    ...overrides,
  };
}

function makeMockSupabase(upsertError: unknown = null) {
  const mockSelect = vi.fn().mockResolvedValue({ data: [], error: upsertError });
  const mockUpsert = vi.fn().mockReturnValue({ select: mockSelect });
  const mockFrom = vi.fn().mockReturnValue({ upsert: mockUpsert });
  return { from: mockFrom, mockUpsert, mockFrom };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('discoveryQueries', () => {
  it('returns 4 discovery queries containing category and city', () => {
    const queries = discoveryQueries('restaurant', 'Alpharetta', 'GA');
    expect(queries).toHaveLength(4);
    for (const q of queries) {
      expect(q.toLowerCase()).toContain('restaurant');
    }
    expect(queries[0]).toContain('Alpharetta');
  });
});

describe('nearMeQueries', () => {
  it('returns 3 near-me queries containing category and city', () => {
    const queries = nearMeQueries('bar', 'Atlanta');
    expect(queries).toHaveLength(3);
    for (const q of queries) {
      expect(q.toLowerCase()).toContain('bar');
    }
  });
});

describe('occasionQueries', () => {
  it('returns 5 occasion queries containing the city', () => {
    const queries = occasionQueries('Alpharetta');
    expect(queries).toHaveLength(5);
    for (const q of queries) {
      expect(q).toContain('Alpharetta');
    }
  });
});

describe('comparisonQueries', () => {
  it('generates one query per competitor (max 3)', () => {
    const competitors: CompetitorForSeed[] = [
      { competitor_name: 'Rival BBQ' },
      { competitor_name: 'Smoke House' },
      { competitor_name: 'Grill Master' },
      { competitor_name: 'Fourth Competitor' },
    ];
    const queries = comparisonQueries('bbq', 'Alpharetta', 'Charcoal N Chill', competitors);
    expect(queries).toHaveLength(3); // max 3
    expect(queries[0]).toContain('Charcoal N Chill');
    expect(queries[0]).toContain('Rival BBQ');
  });

  it('returns empty array when no competitors provided', () => {
    expect(comparisonQueries('restaurant', 'Atlanta', 'My Place', [])).toHaveLength(0);
  });
});

describe('isHospitalityCategory', () => {
  it('returns true for a restaurant category', () => {
    expect(isHospitalityCategory(['restaurant'])).toBe(true);
  });

  it('returns true for case-insensitive match', () => {
    expect(isHospitalityCategory(['Mexican Restaurant'])).toBe(true);
  });

  it('returns false for non-hospitality category', () => {
    expect(isHospitalityCategory(['dental', 'healthcare'])).toBe(false);
  });

  it('returns true when any category matches', () => {
    expect(isHospitalityCategory(['automotive', 'bar & grill'])).toBe(true);
  });

  it('returns false for empty array', () => {
    expect(isHospitalityCategory([])).toBe(false);
  });
});

describe('HOSPITALITY_CATEGORIES', () => {
  it('includes at least 20 categories', () => {
    expect(HOSPITALITY_CATEGORIES.length).toBeGreaterThanOrEqual(20);
  });

  it('includes "restaurant" and "bar"', () => {
    expect(HOSPITALITY_CATEGORIES).toContain('restaurant');
    expect(HOSPITALITY_CATEGORIES).toContain('bar');
  });
});

describe('seedSOVQueries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('generates and upserts queries for a restaurant location', async () => {
    const { from, mockUpsert } = makeMockSupabase();
    const result = await seedSOVQueries(makeLocation(), [], { from } as any);
    // Tier 1 (4) + Tier 2 (3) + Tier 3 occasion (5) = 12
    expect(result.seeded).toBe(12);
    expect(mockUpsert).toHaveBeenCalled();
  });

  it('includes occasion queries for hospitality categories', async () => {
    const { from, mockUpsert } = makeMockSupabase();
    await seedSOVQueries(makeLocation({ categories: ['bar'] }), [], { from } as any);
    const rows = mockUpsert.mock.calls[0][0];
    const occasionRows = rows.filter((r: any) => r.query_category === 'occasion');
    expect(occasionRows.length).toBe(5);
    expect(occasionRows[0].occasion_tag).toBeDefined();
  });

  it('skips occasion queries for non-hospitality categories', async () => {
    const { from, mockUpsert } = makeMockSupabase();
    await seedSOVQueries(makeLocation({ categories: ['dentist'] }), [], { from } as any);
    const rows = mockUpsert.mock.calls[0][0];
    const occasionRows = rows.filter((r: any) => r.query_category === 'occasion');
    expect(occasionRows.length).toBe(0);
  });

  it('adds comparison queries for provided competitors', async () => {
    const { from, mockUpsert } = makeMockSupabase();
    const competitors = [{ competitor_name: 'Rival BBQ' }];
    await seedSOVQueries(makeLocation(), competitors, { from } as any);
    const rows = mockUpsert.mock.calls[0][0];
    const compRows = rows.filter((r: any) => r.query_category === 'comparison');
    expect(compRows.length).toBe(1);
    expect(compRows[0].query_text).toContain('Rival BBQ');
  });

  it('deduplicates queries by text', async () => {
    const { from, mockUpsert } = makeMockSupabase();
    // Both city and state are same, so no accidental duplicates in normal flow
    await seedSOVQueries(makeLocation(), [], { from } as any);
    const rows = mockUpsert.mock.calls[0][0];
    const texts = rows.map((r: any) => r.query_text);
    const unique = new Set(texts);
    expect(unique.size).toBe(texts.length);
  });

  it('sets org_id and location_id on every row', async () => {
    const { from, mockUpsert } = makeMockSupabase();
    await seedSOVQueries(makeLocation(), [], { from } as any);
    const rows = mockUpsert.mock.calls[0][0];
    for (const row of rows) {
      expect(row.org_id).toBe('org-uuid-001');
      expect(row.location_id).toBe('loc-uuid-001');
    }
  });

  it('uses upsert with ignoreDuplicates for idempotency', async () => {
    const { from, mockUpsert } = makeMockSupabase();
    await seedSOVQueries(makeLocation(), [], { from } as any);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        onConflict: 'location_id,query_text',
        ignoreDuplicates: true,
      }),
    );
  });

  it('handles null city/state gracefully', async () => {
    const { from } = makeMockSupabase();
    const result = await seedSOVQueries(
      makeLocation({ city: null, state: null }),
      [],
      { from } as any,
    );
    expect(result.seeded).toBeGreaterThan(0);
  });

  it('handles null categories by defaulting to "restaurant"', async () => {
    const { from, mockUpsert } = makeMockSupabase();
    await seedSOVQueries(
      makeLocation({ categories: null }),
      [],
      { from } as any,
    );
    const rows = mockUpsert.mock.calls[0][0];
    expect(rows[0].query_text).toContain('restaurant');
  });

  it('does not throw on upsert error', async () => {
    const { from } = makeMockSupabase({ message: 'constraint violation' });
    const result = await seedSOVQueries(makeLocation(), [], { from } as any);
    expect(result.seeded).toBeGreaterThan(0);
  });

  it('tags occasion queries with correct occasion_tag values', async () => {
    const { from, mockUpsert } = makeMockSupabase();
    await seedSOVQueries(makeLocation(), [], { from } as any);
    const rows = mockUpsert.mock.calls[0][0];
    const occasionRows = rows.filter((r: any) => r.query_category === 'occasion');
    const tags = occasionRows.map((r: any) => r.occasion_tag);
    expect(tags).toContain('date_night');
    expect(tags).toContain('birthday');
    expect(tags).toContain('romantic');
  });
});
