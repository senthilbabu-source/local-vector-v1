// ---------------------------------------------------------------------------
// schema-generator-data.test.ts — Sprint 70: Data layer for schema generation
//
// Run: npx vitest run src/__tests__/unit/schema-generator-data.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { fetchSchemaGeneratorData } from '@/lib/data/schema-generator';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// ---------------------------------------------------------------------------
// Mock Supabase builder
// ---------------------------------------------------------------------------

function createMockSupabase(opts: {
  location?: Record<string, unknown> | null;
  queries?: { query_text: string; query_category: string }[];
  integrations?: { platform: string; listing_url: string | null }[];
}) {
  const locChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnValue({
      data: opts.location ?? null,
      error: null,
    }),
  };

  const queryChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnValue({
      data: opts.queries ?? [],
      error: null,
    }),
  };

  const integChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnValue({
      data: opts.integrations ?? [],
      error: null,
    }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === 'locations') return locChain;
      if (table === 'target_queries') return queryChain;
      if (table === 'location_integrations') return integChain;
      return locChain;
    }),
  } as unknown as SupabaseClient<Database>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchSchemaGeneratorData', () => {
  it('returns location with all fields cast to ground-truth types', async () => {
    const mockLoc = {
      business_name: 'Test Biz',
      address_line1: '123 Main St',
      city: 'Atlanta',
      state: 'GA',
      zip: '30301',
      country: 'US',
      phone: '(555) 123-4567',
      website_url: 'https://test.com',
      hours_data: { monday: { open: '09:00', close: '17:00' } },
      amenities: { has_outdoor_seating: true, serves_alcohol: false },
      categories: ['Restaurant'],
      google_place_id: 'ChIJtest',
    };

    const supabase = createMockSupabase({ location: mockLoc });
    const result = await fetchSchemaGeneratorData(ORG_ID, supabase);

    expect(result.location).not.toBeNull();
    expect(result.location!.business_name).toBe('Test Biz');
    expect(result.location!.address_line1).toBe('123 Main St');
    expect(result.location!.city).toBe('Atlanta');
    expect(result.location!.state).toBe('GA');
    expect(result.location!.zip).toBe('30301');
    expect(result.location!.country).toBe('US');
    expect(result.location!.phone).toBe('(555) 123-4567');
    expect(result.location!.website_url).toBe('https://test.com');
    expect(result.location!.google_place_id).toBe('ChIJtest');
  });

  it('returns null location when no primary location exists', async () => {
    const supabase = createMockSupabase({ location: null });
    const result = await fetchSchemaGeneratorData(ORG_ID, supabase);

    expect(result.location).toBeNull();
  });

  it('returns queries from target_queries table', async () => {
    const mockQueries = [
      { query_text: 'Best BBQ in Atlanta', query_category: 'discovery' },
      { query_text: 'hookah near me', query_category: 'near_me' },
    ];

    const supabase = createMockSupabase({ queries: mockQueries });
    const result = await fetchSchemaGeneratorData(ORG_ID, supabase);

    expect(result.queries).toHaveLength(2);
    expect(result.queries[0].query_text).toBe('Best BBQ in Atlanta');
    expect(result.queries[1].query_category).toBe('near_me');
  });

  it('returns integrations from location_integrations table', async () => {
    const mockIntegrations = [
      { platform: 'google', listing_url: 'https://g.page/test' },
      { platform: 'yelp', listing_url: null },
    ];

    const supabase = createMockSupabase({ integrations: mockIntegrations });
    const result = await fetchSchemaGeneratorData(ORG_ID, supabase);

    expect(result.integrations).toHaveLength(2);
    expect(result.integrations[0].platform).toBe('google');
    expect(result.integrations[0].listing_url).toBe('https://g.page/test');
    expect(result.integrations[1].listing_url).toBeNull();
  });

  it('casts hours_data JSONB to HoursData type', async () => {
    const mockLoc = {
      business_name: 'Test',
      address_line1: null,
      city: null,
      state: null,
      zip: null,
      country: 'US',
      phone: null,
      website_url: null,
      hours_data: {
        monday: { open: '09:00', close: '17:00' },
        tuesday: 'closed',
      },
      amenities: null,
      categories: null,
      google_place_id: null,
    };

    const supabase = createMockSupabase({ location: mockLoc });
    const result = await fetchSchemaGeneratorData(ORG_ID, supabase);

    expect(result.location!.hours_data).toEqual({
      monday: { open: '09:00', close: '17:00' },
      tuesday: 'closed',
    });
  });

  it('casts amenities JSONB to Amenities type', async () => {
    const mockLoc = {
      business_name: 'Test',
      address_line1: null,
      city: null,
      state: null,
      zip: null,
      country: 'US',
      phone: null,
      website_url: null,
      hours_data: null,
      amenities: {
        has_outdoor_seating: true,
        serves_alcohol: true,
        has_hookah: false,
        is_kid_friendly: true,
        takes_reservations: false,
        has_live_music: false,
      },
      categories: null,
      google_place_id: null,
    };

    const supabase = createMockSupabase({ location: mockLoc });
    const result = await fetchSchemaGeneratorData(ORG_ID, supabase);

    expect(result.location!.amenities).toEqual({
      has_outdoor_seating: true,
      serves_alcohol: true,
      has_hookah: false,
      is_kid_friendly: true,
      takes_reservations: false,
      has_live_music: false,
    });
  });

  it('defaults country to US when null', async () => {
    const mockLoc = {
      business_name: 'Test',
      address_line1: null,
      city: null,
      state: null,
      zip: null,
      country: null,
      phone: null,
      website_url: null,
      hours_data: null,
      amenities: null,
      categories: null,
      google_place_id: null,
    };

    const supabase = createMockSupabase({ location: mockLoc });
    const result = await fetchSchemaGeneratorData(ORG_ID, supabase);

    expect(result.location!.country).toBe('US');
  });

  it('returns empty arrays when no queries or integrations exist', async () => {
    const supabase = createMockSupabase({
      location: null,
      queries: [],
      integrations: [],
    });

    const result = await fetchSchemaGeneratorData(ORG_ID, supabase);

    expect(result.queries).toEqual([]);
    expect(result.integrations).toEqual([]);
  });
});
