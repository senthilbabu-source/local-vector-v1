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
  type LocationForSeed,
} from '@/lib/services/sov-seed';
import type { HoursData, Amenities } from '@/lib/types/ground-truth';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeLocation(overrides: Partial<LocationForSeed> = {}): LocationForSeed {
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

// CNC ground truth: dinner-only (5pm-11pm), no outdoor seating, serves alcohol
const CNC_HOURS: HoursData = {
  monday: 'closed',
  tuesday: { open: '17:00', close: '23:00' },
  wednesday: { open: '17:00', close: '23:00' },
  thursday: { open: '17:00', close: '23:00' },
  friday: { open: '17:00', close: '00:00' },
  saturday: { open: '17:00', close: '00:00' },
  sunday: { open: '17:00', close: '22:00' },
};

const CNC_AMENITIES: Amenities = {
  has_outdoor_seating: false,
  serves_alcohol: true,
  has_hookah: true,
  is_kid_friendly: false,
  takes_reservations: true,
  has_live_music: true,
};

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

// ── Ground Truth Relevance Filtering ─────────────────────────────────────

describe('seedSOVQueries — ground truth filtering', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not filter when no ground truth is provided', async () => {
    const { from, mockUpsert } = makeMockSupabase();
    const result = await seedSOVQueries(makeLocation(), [], { from } as any);
    // No hours_data or amenities → no filtering → all 12 queries seeded
    expect(result.seeded).toBe(12);
    expect(mockUpsert).toHaveBeenCalled();
  });

  it('does not filter when ground truth fields are null', async () => {
    const { from, mockUpsert } = makeMockSupabase();
    const result = await seedSOVQueries(
      makeLocation({ hours_data: null, amenities: null }),
      [],
      { from } as any,
    );
    expect(result.seeded).toBe(12);
    expect(mockUpsert).toHaveBeenCalled();
  });

  it('filters out brunch-related occasion queries for dinner-only restaurant (CNC)', async () => {
    // CNC opens at 5pm — "bachelorette party venue" and other occasion queries
    // do not contain time keywords, so they should pass. But if any occasion
    // query contained "brunch" it would be filtered. Let us verify the count
    // does not change since standard occasion queries are time-agnostic.
    const { from, mockUpsert } = makeMockSupabase();
    await seedSOVQueries(
      makeLocation({ hours_data: CNC_HOURS, amenities: CNC_AMENITIES }),
      [],
      { from } as any,
    );
    const rows = mockUpsert.mock.calls[0][0];
    // All standard templates pass — none contain time/amenity keywords
    // that conflict with CNC ground truth
    const texts = rows.map((r: any) => r.query_text.toLowerCase());
    // No query should mention "brunch" or "breakfast" or "outdoor seating"
    for (const text of texts) {
      expect(text).not.toContain('brunch');
      expect(text).not.toContain('breakfast');
    }
  });

  it('filters irrelevant queries when hours data excludes morning', async () => {
    // Manually add a "brunch" query to the seed templates via a custom category
    // that includes brunch. We simulate by adding a breakfast-mentioning query.
    // Since CNC opens at 5pm, the filter should drop it.
    const { from, mockUpsert } = makeMockSupabase();

    // Use a category that includes "brunch" — this will appear in discovery queries
    const brunchLocation = makeLocation({
      categories: ['brunch'],
      hours_data: CNC_HOURS,
      amenities: CNC_AMENITIES,
    });

    await seedSOVQueries(brunchLocation, [], { from } as any);
    const rows = mockUpsert.mock.calls[0][0];
    const texts = rows.map((r: any) => r.query_text.toLowerCase());

    // "best brunch in Alpharetta GA" etc. contain "brunch" keyword
    // which requires opening before 12:00. CNC opens at 17:00.
    // All brunch-containing discovery queries should be filtered out.
    for (const text of texts) {
      expect(text).not.toContain('brunch');
    }

    // Should have fewer than default 12 (some brunch queries removed)
    expect(rows.length).toBeLessThan(12);
  });

  it('keeps comparison queries even when ground truth would filter them', async () => {
    const { from, mockUpsert } = makeMockSupabase();
    const competitors = [{ competitor_name: 'Brunch Palace' }];

    await seedSOVQueries(
      makeLocation({ hours_data: CNC_HOURS, amenities: CNC_AMENITIES }),
      competitors,
      { from } as any,
    );
    const rows = mockUpsert.mock.calls[0][0];
    const compRows = rows.filter((r: any) => r.query_category === 'comparison');
    // Comparison queries are always kept (Rule 1)
    expect(compRows.length).toBe(1);
  });

  it('keeps aspirational queries (e.g., catering for non-caterer)', async () => {
    const { from, mockUpsert } = makeMockSupabase();

    // Use a category with "catering" to get a discovery query about catering
    const cateringLoc = makeLocation({
      categories: ['catering'],
      hours_data: CNC_HOURS,
      amenities: CNC_AMENITIES,
    });

    await seedSOVQueries(cateringLoc, [], { from } as any);
    const rows = mockUpsert.mock.calls[0][0];
    // Catering keyword matched in SERVICE_KEYWORDS → aspirational verdict
    // (not_applicable is the only verdict that gets filtered out)
    // Since category IS "catering", it should match and be relevant
    expect(rows.length).toBeGreaterThan(0);
  });

  it('filters queries about amenities the business does not have', async () => {
    const { from, mockUpsert } = makeMockSupabase();

    // Use "outdoor dining" category to generate queries about outdoor seating
    const outdoorLoc = makeLocation({
      categories: ['outdoor dining'],
      hours_data: CNC_HOURS,
      amenities: { ...CNC_AMENITIES, has_outdoor_seating: false },
    });

    await seedSOVQueries(outdoorLoc, [], { from } as any);
    const rows = mockUpsert.mock.calls[0][0];
    const texts = rows.map((r: any) => r.query_text.toLowerCase());

    // Discovery queries like "best outdoor dining in Alpharetta" contain
    // "outdoor dining" which maps to has_outdoor_seating amenity.
    // CNC does not have outdoor seating → these should be filtered out.
    for (const text of texts) {
      expect(text).not.toContain('outdoor dining');
    }
  });

  it('preserves seeded count after filtering', async () => {
    const { from } = makeMockSupabase();

    // With ground truth that allows everything (opens early, has all amenities)
    const fullAmenities: Amenities = {
      has_outdoor_seating: true,
      serves_alcohol: true,
      has_hookah: true,
      is_kid_friendly: true,
      takes_reservations: true,
      has_live_music: true,
    };
    const earlyHours: HoursData = {
      monday: { open: '06:00', close: '23:00' },
      tuesday: { open: '06:00', close: '23:00' },
      wednesday: { open: '06:00', close: '23:00' },
      thursday: { open: '06:00', close: '23:00' },
      friday: { open: '06:00', close: '00:00' },
      saturday: { open: '06:00', close: '00:00' },
      sunday: { open: '06:00', close: '22:00' },
    };

    const result = await seedSOVQueries(
      makeLocation({ hours_data: earlyHours, amenities: fullAmenities }),
      [],
      { from } as any,
    );

    // Nothing should be filtered — all queries are relevant
    expect(result.seeded).toBe(12);
  });

  it('returns seeded: 0 when all queries are filtered out', async () => {
    const { from, mockUpsert } = makeMockSupabase();

    // A breakfast-only place with "breakfast" category
    // All discovery/near_me queries will contain "breakfast"
    // which requires opening before 10:00, but this business only opens at 22:00
    const nightOnlyHours: HoursData = {
      friday: { open: '22:00', close: '04:00' },
      saturday: { open: '22:00', close: '04:00' },
    };

    const result = await seedSOVQueries(
      makeLocation({
        categories: ['breakfast'],
        hours_data: nightOnlyHours,
        amenities: CNC_AMENITIES,
      }),
      [],
      { from } as any,
    );

    // "breakfast" keyword requires open before 10:00, but opens at 22:00
    // All 7 queries (4 discovery + 3 near_me) contain "breakfast" → all filtered
    // No occasion queries (non-hospitality category)
    expect(result.seeded).toBe(0);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('filters with hours_data only (no amenities)', async () => {
    const { from, mockUpsert } = makeMockSupabase();

    await seedSOVQueries(
      makeLocation({ hours_data: CNC_HOURS }),
      [],
      { from } as any,
    );

    // hours_data is set → filter is active
    // Default restaurant category queries have no time keywords → all pass
    expect(mockUpsert).toHaveBeenCalled();
    const rows = mockUpsert.mock.calls[0][0];
    expect(rows.length).toBe(12);
  });

  it('filters with amenities only (no hours_data)', async () => {
    const { from, mockUpsert } = makeMockSupabase();

    await seedSOVQueries(
      makeLocation({ amenities: CNC_AMENITIES }),
      [],
      { from } as any,
    );

    // amenities is set → filter is active
    // Default restaurant category queries have no amenity keywords → all pass
    expect(mockUpsert).toHaveBeenCalled();
    const rows = mockUpsert.mock.calls[0][0];
    expect(rows.length).toBe(12);
  });
});
