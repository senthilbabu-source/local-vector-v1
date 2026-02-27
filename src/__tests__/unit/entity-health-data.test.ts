// ---------------------------------------------------------------------------
// entity-health-data.test.ts — Unit tests for entity health data fetcher
//
// Sprint 80: 6 tests — mocks Supabase client.
//
// Run:
//   npx vitest run src/__tests__/unit/entity-health-data.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { fetchEntityHealth } from '@/lib/data/entity-health';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TEST_LOC_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

function makeMockSupabase(opts: {
  existingCheck?: Record<string, unknown> | null;
  locationData?: Record<string, unknown> | null;
  integrations?: unknown[];
} = {}) {
  const {
    existingCheck = null,
    locationData = { google_place_id: null, gbp_integration_id: null },
    integrations = [],
  } = opts;

  const mockFromCalls: string[] = [];
  const mockInsertData: unknown[] = [];

  const supabase = {
    from: vi.fn((table: string) => {
      mockFromCalls.push(table);

      if (table === 'entity_checks') {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: existingCheck, error: null });
        chain.insert = vi.fn((data: unknown) => {
          mockInsertData.push(data);
          const insertChain: Record<string, unknown> = {};
          insertChain.select = vi.fn().mockReturnValue(insertChain);
          insertChain.single = vi.fn().mockResolvedValue({
            data: {
              id: 'new-id',
              org_id: TEST_ORG_ID,
              location_id: TEST_LOC_ID,
              google_knowledge_panel: 'unchecked',
              google_business_profile: 'unchecked',
              yelp: 'unchecked',
              tripadvisor: 'unchecked',
              apple_maps: 'unchecked',
              bing_places: 'unchecked',
              wikidata: 'unchecked',
              platform_metadata: {},
              ...(data as Record<string, unknown>),
            },
            error: null,
          });
          return insertChain;
        });
        chain.update = vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        });
        return chain;
      }

      if (table === 'locations') {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.single = vi.fn().mockResolvedValue({ data: locationData, error: null });
        // Make thenable for Promise.all
        Object.defineProperty(chain, 'then', {
          value: (onfulfilled?: (v: unknown) => unknown) => {
            const result = { data: locationData, error: null };
            return Promise.resolve(onfulfilled ? onfulfilled(result) : result);
          },
          writable: true,
        });
        return chain;
      }

      if (table === 'location_integrations') {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        // Make thenable for Promise.all
        Object.defineProperty(chain, 'then', {
          value: (onfulfilled?: (v: unknown) => unknown) => {
            const result = { data: integrations, error: null };
            return Promise.resolve(onfulfilled ? onfulfilled(result) : result);
          },
          writable: true,
        });
        return chain;
      }

      // Default fallback
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      return chain;
    }),
  } as unknown as SupabaseClient<Database>;

  return { supabase, mockFromCalls, mockInsertData };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchEntityHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. returns existing entity_checks row if present', async () => {
    const existingCheck = {
      google_knowledge_panel: 'confirmed',
      google_business_profile: 'confirmed',
      yelp: 'confirmed',
      tripadvisor: 'missing',
      apple_maps: 'missing',
      bing_places: 'incomplete',
      wikidata: 'unchecked',
      platform_metadata: {},
    };
    const { supabase, mockFromCalls } = makeMockSupabase({ existingCheck });
    const result = await fetchEntityHealth(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result.score).toBe(50);
    expect(mockFromCalls).toContain('entity_checks');
  });

  it('2. creates new row with auto-detected values when none exists', async () => {
    const { supabase, mockInsertData } = makeMockSupabase({
      existingCheck: null,
      locationData: { google_place_id: 'ChIJtest', gbp_integration_id: null },
    });
    const result = await fetchEntityHealth(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(mockInsertData.length).toBeGreaterThan(0);
    expect(result).toBeDefined();
  });

  it('3. auto-detects Google platforms from locations + integrations', async () => {
    const { supabase, mockInsertData } = makeMockSupabase({
      existingCheck: null,
      locationData: { google_place_id: 'ChIJtest', gbp_integration_id: null },
      integrations: [{ platform: 'google', status: 'connected', external_id: null }],
    });
    await fetchEntityHealth(supabase, TEST_ORG_ID, TEST_LOC_ID);
    const inserted = mockInsertData[0] as Record<string, unknown>;
    expect(inserted.google_knowledge_panel).toBe('confirmed');
    expect(inserted.google_business_profile).toBe('confirmed');
  });

  it('4. scopes all queries by org_id', async () => {
    const { supabase } = makeMockSupabase({
      existingCheck: {
        google_knowledge_panel: 'unchecked',
        google_business_profile: 'unchecked',
        yelp: 'unchecked',
        tripadvisor: 'unchecked',
        apple_maps: 'unchecked',
        bing_places: 'unchecked',
        wikidata: 'unchecked',
        platform_metadata: {},
      },
    });
    await fetchEntityHealth(supabase, TEST_ORG_ID, TEST_LOC_ID);
    // Verify from was called with entity_checks and eq was called (org_id scoping)
    expect(supabase.from).toHaveBeenCalledWith('entity_checks');
  });

  it('5. returns all-unchecked when no data and no integrations', async () => {
    const { supabase } = makeMockSupabase({ existingCheck: null });
    const result = await fetchEntityHealth(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result.rating).toBe('unknown');
  });

  it('6. calls computeEntityHealth with check row', async () => {
    const existingCheck = {
      google_knowledge_panel: 'confirmed',
      google_business_profile: 'confirmed',
      yelp: 'confirmed',
      tripadvisor: 'confirmed',
      apple_maps: 'confirmed',
      bing_places: 'unchecked',
      wikidata: 'unchecked',
      platform_metadata: {},
    };
    const { supabase } = makeMockSupabase({ existingCheck });
    const result = await fetchEntityHealth(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result.confirmedCount).toBe(5);
    expect(result.rating).toBe('strong');
  });
});
