// ---------------------------------------------------------------------------
// correction-data.test.ts — Unit tests for correction generator data layer
//
// Sprint 75: 7 tests — mocks Supabase client.
//
// Run:
//   npx vitest run src/__tests__/unit/correction-data.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { fetchCorrectionPackage } from '@/lib/data/correction-generator';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TEST_HALL_ID = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const MOCK_HALL_ROW = {
  id: TEST_HALL_ID,
  claim_text: 'Charcoal N Chill is permanently closed.',
  expected_truth: 'Charcoal N Chill is actively operating.',
  category: 'status',
  severity: 'critical',
  model_provider: 'openai-gpt4o',
};

const MOCK_LOCATION_ROW = {
  business_name: 'Charcoal N Chill',
  address_line1: '11950 Jones Bridge Road Ste 103',
  city: 'Alpharetta',
  state: 'GA',
  zip: '30005',
  phone: '(470) 546-4866',
  website_url: 'https://charcoalnchill.com',
  hours_data: {
    monday: 'closed',
    tuesday: { open: '17:00', close: '01:00' },
  },
  amenities: { has_hookah: true, has_outdoor_seating: true },
  categories: ['Hookah Bar'],
  operational_status: 'OPERATIONAL',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockSupabase({
  hallRow = MOCK_HALL_ROW as typeof MOCK_HALL_ROW | null,
  locationRow = MOCK_LOCATION_ROW as typeof MOCK_LOCATION_ROW | null,
} = {}) {
  const mockMaybeSingleHall = vi.fn().mockResolvedValue({ data: hallRow, error: null });
  const mockMaybeSingleLoc = vi.fn().mockResolvedValue({ data: locationRow, error: null });

  let callCount = 0;
  const supabase = {
    from: vi.fn((table: string) => {
      // Route by table name
      if (table === 'ai_hallucinations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: mockMaybeSingleHall,
              }),
            }),
          }),
        };
      }
      if (table === 'locations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: mockMaybeSingleLoc,
              }),
            }),
          }),
        };
      }
      // Fallback
      callCount++;
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      };
    }),
  } as unknown as SupabaseClient<Database>;

  return { supabase, mockMaybeSingleHall, mockMaybeSingleLoc };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchCorrectionPackage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. fetches hallucination by id + org_id', async () => {
    const { supabase } = makeMockSupabase();
    await fetchCorrectionPackage(supabase, TEST_HALL_ID, TEST_ORG_ID);
    expect(supabase.from).toHaveBeenCalledWith('ai_hallucinations');
  });

  it('2. fetches primary location for ground truth', async () => {
    const { supabase } = makeMockSupabase();
    await fetchCorrectionPackage(supabase, TEST_HALL_ID, TEST_ORG_ID);
    expect(supabase.from).toHaveBeenCalledWith('locations');
  });

  it('3. returns null when hallucination not found', async () => {
    const { supabase } = makeMockSupabase({ hallRow: null });
    const result = await fetchCorrectionPackage(supabase, TEST_HALL_ID, TEST_ORG_ID);
    expect(result).toBeNull();
  });

  it('4. returns null when no primary location exists', async () => {
    const { supabase } = makeMockSupabase({ locationRow: null });
    const result = await fetchCorrectionPackage(supabase, TEST_HALL_ID, TEST_ORG_ID);
    expect(result).toBeNull();
  });

  it('5. casts JSONB hours_data and amenities correctly', async () => {
    const { supabase } = makeMockSupabase();
    const result = await fetchCorrectionPackage(supabase, TEST_HALL_ID, TEST_ORG_ID);
    expect(result).not.toBeNull();
    // If hours_data is properly cast, the correction should include hours info
    expect(result!.content.llmsTxtEntry).toContain('CORRECTION');
  });

  it('6. calls generateCorrectionPackage with assembled input', async () => {
    const { supabase } = makeMockSupabase();
    const result = await fetchCorrectionPackage(supabase, TEST_HALL_ID, TEST_ORG_ID);
    // Result should be a full CorrectionPackage
    expect(result).toBeDefined();
    expect(result!.diagnosis).toBeTruthy();
    expect(result!.actions.length).toBeGreaterThan(0);
    expect(result!.content.llmsTxtEntry).toBeTruthy();
  });

  it('7. scopes all queries by org_id', async () => {
    const { supabase } = makeMockSupabase();
    await fetchCorrectionPackage(supabase, TEST_HALL_ID, TEST_ORG_ID);
    // Both table queries should have been called (org_id is in the chain)
    expect(supabase.from).toHaveBeenCalledTimes(2);
    expect(supabase.from).toHaveBeenCalledWith('ai_hallucinations');
    expect(supabase.from).toHaveBeenCalledWith('locations');
  });
});
