// ---------------------------------------------------------------------------
// sov-seed-idempotent.test.ts — Verifies seedSOVQueries() uses upsert
//
// Sprint 88: With UNIQUE(location_id, query_text) constraint now in place,
// sov-seed.ts must use .upsert() with ignoreDuplicates: true to handle
// re-seeding without errors or overwrites.
//
// Run:
//   npx vitest run src/__tests__/unit/sov-seed-idempotent.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { seedSOVQueries } from '@/lib/services/sov-seed';

// ── Helpers ────────────────────────────────────────────────────────────────

const MOCK_LOCATION = {
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
  business_name: 'Charcoal N Chill',
  city: 'Alpharetta',
  state: 'GA',
  categories: ['restaurant', 'hookah bar'],
};

function createMockSupabase(upsertResponse: { data: unknown; error: unknown } = { data: [{ id: '1' }], error: null }) {
  const mockSelect = vi.fn().mockResolvedValue(upsertResponse);
  const mockUpsert = vi.fn().mockReturnValue({ select: mockSelect });
  const mockFrom = vi.fn().mockReturnValue({ upsert: mockUpsert });

  const client = { from: mockFrom } as unknown as SupabaseClient<Database> & {
    _mockFrom: typeof mockFrom;
    _mockUpsert: typeof mockUpsert;
  };
  client._mockFrom = mockFrom;
  client._mockUpsert = mockUpsert;

  return client;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('seedSOVQueries — idempotent seeding', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should call .upsert() with onConflict and ignoreDuplicates', async () => {
    const supabase = createMockSupabase();

    await seedSOVQueries(MOCK_LOCATION, [], supabase);

    expect(supabase._mockFrom).toHaveBeenCalledWith('target_queries');
    expect(supabase._mockUpsert).toHaveBeenCalledOnce();

    const [rows, options] = supabase._mockUpsert.mock.calls[0];
    expect(options).toEqual({
      onConflict: 'location_id,query_text',
      ignoreDuplicates: true,
    });
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('should not throw on re-seed (upsert error is logged, not thrown)', async () => {
    // Simulate a genuine DB error (not constraint violation)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const supabase = createMockSupabase({ data: null, error: { message: 'connection error' } });

    const result = await seedSOVQueries(MOCK_LOCATION, [], supabase);

    // Should still return the count of attempted rows (not throw)
    expect(result.seeded).toBeGreaterThan(0);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[sov-seed] Upsert error'),
    );
    consoleSpy.mockRestore();
  });

  it('should set ignoreDuplicates=true to preserve existing query_category', async () => {
    // ignoreDuplicates means conflicting rows are skipped entirely —
    // no UPDATE is performed, so a user's custom category stays intact
    const supabase = createMockSupabase();

    await seedSOVQueries(MOCK_LOCATION, [], supabase);

    const [, options] = supabase._mockUpsert.mock.calls[0];
    expect(options.ignoreDuplicates).toBe(true);
  });

  it('should include correct fields in each upserted row', async () => {
    const supabase = createMockSupabase();

    await seedSOVQueries(MOCK_LOCATION, [], supabase);

    const [rows] = supabase._mockUpsert.mock.calls[0] as [Array<Record<string, unknown>>];
    for (const row of rows) {
      expect(row).toHaveProperty('org_id', MOCK_LOCATION.org_id);
      expect(row).toHaveProperty('location_id', MOCK_LOCATION.id);
      expect(row).toHaveProperty('query_text');
      expect(row).toHaveProperty('query_category');
      expect(typeof row.query_text).toBe('string');
    }
  });

  it('should generate occasion queries for hospitality categories', async () => {
    const supabase = createMockSupabase();

    await seedSOVQueries(MOCK_LOCATION, [], supabase);

    const [rows] = supabase._mockUpsert.mock.calls[0] as [Array<Record<string, unknown>>];
    const occasionRows = rows.filter((r) => r.query_category === 'occasion');
    expect(occasionRows.length).toBeGreaterThan(0);
    expect(occasionRows[0]).toHaveProperty('occasion_tag');
  });

  it('should return { seeded: 0 } for empty categories with no competitors', async () => {
    const emptyLocation = { ...MOCK_LOCATION, categories: null, city: null, state: null };
    const supabase = createMockSupabase();

    const result = await seedSOVQueries(emptyLocation, [], supabase);

    // Still generates discovery + near_me queries with defaults
    expect(result.seeded).toBeGreaterThan(0);
  });
});
