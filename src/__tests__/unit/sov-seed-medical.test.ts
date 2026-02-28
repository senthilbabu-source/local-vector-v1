// ---------------------------------------------------------------------------
// sov-seed-medical.test.ts — Unit tests for SOV seed medical/dental path
//
// Sprint E (M5): Tests industry-aware seed generation for medical_dental vertical.
// Supplements the existing sov-seed.test.ts (restaurant path).
// Mocks Supabase upsert — no real DB calls.
//
// Run:
//   npx vitest run src/__tests__/unit/sov-seed-medical.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  seedSOVQueries,
  medicalDiscoveryQueries,
  medicalNearMeQueries,
  medicalSpecificQueries,
  isMedicalCategory,
} from '@/lib/services/sov-seed';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMedicalLocation(overrides: Partial<{
  id: string;
  org_id: string;
  business_name: string;
  city: string | null;
  state: string | null;
  categories: string[] | null;
}> = {}) {
  return {
    id: 'loc-dental-001',
    org_id: 'org-dental-001',
    business_name: 'Alpharetta Family Dental',
    city: 'Alpharetta',
    state: 'GA',
    categories: ['dentist'],
    ...overrides,
  };
}

function makeMockSupabase() {
  const mockSelect = vi.fn().mockResolvedValue({ data: [], error: null });
  const mockUpsert = vi.fn().mockReturnValue({ select: mockSelect });
  const mockFrom = vi.fn().mockReturnValue({ upsert: mockUpsert });
  return {
    supabase: { from: mockFrom } as unknown as SupabaseClient<Database>,
    mockUpsert,
    mockFrom,
  };
}

// ---------------------------------------------------------------------------
// medicalDiscoveryQueries
// ---------------------------------------------------------------------------

describe('medicalDiscoveryQueries', () => {
  it('returns an array of at least 4 queries', () => {
    const queries = medicalDiscoveryQueries('dentist', 'Alpharetta', 'GA');
    expect(queries.length).toBeGreaterThanOrEqual(4);
  });

  it('all queries contain the city name', () => {
    const queries = medicalDiscoveryQueries('dentist', 'Alpharetta', 'GA');
    for (const q of queries) {
      expect(q).toContain('Alpharetta');
    }
  });

  it('all queries contain the specialty', () => {
    const queries = medicalDiscoveryQueries('pediatric dentist', 'Alpharetta', 'GA');
    for (const q of queries) {
      expect(q.toLowerCase()).toContain('pediatric dentist');
    }
  });
});

// ---------------------------------------------------------------------------
// medicalNearMeQueries
// ---------------------------------------------------------------------------

describe('medicalNearMeQueries', () => {
  it('includes an "accepting new patients" query', () => {
    const queries = medicalNearMeQueries('dentist', 'Alpharetta');
    const hasAccepting = queries.some((q) =>
      q.toLowerCase().includes('accepting new patients'),
    );
    expect(hasAccepting).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isMedicalCategory
// ---------------------------------------------------------------------------

describe('isMedicalCategory', () => {
  it('returns true for ["dentist"]', () => {
    expect(isMedicalCategory(['dentist'])).toBe(true);
  });

  it('returns false for ["restaurant"]', () => {
    expect(isMedicalCategory(['restaurant'])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// medicalSpecificQueries
// ---------------------------------------------------------------------------

describe('medicalSpecificQueries', () => {
  it('includes an insurance-related query', () => {
    const queries = medicalSpecificQueries('dentist', 'Alpharetta');
    const hasInsurance = queries.some((q) =>
      q.toLowerCase().includes('insurance') || q.toLowerCase().includes('in-network'),
    );
    expect(hasInsurance).toBe(true);
  });

  it('all queries are non-empty strings', () => {
    const queries = medicalSpecificQueries('physician', 'Atlanta');
    for (const q of queries) {
      expect(typeof q).toBe('string');
      expect(q.trim().length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// seedSOVQueries — medical_dental path
// ---------------------------------------------------------------------------

describe('seedSOVQueries — medical_dental industry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('with industry="medical_dental" upserts queries that do not contain restaurant terms', async () => {
    const { supabase, mockUpsert } = makeMockSupabase();
    await seedSOVQueries(makeMedicalLocation(), [], supabase, 'medical_dental');
    const rows: Array<{ query_text: string }> = mockUpsert.mock.calls[0][0];
    const restaurantTerms = ['date night', 'birthday dinner', 'bachelorette', 'girls night', 'romantic restaurant'];
    for (const row of rows) {
      for (const term of restaurantTerms) {
        expect(row.query_text.toLowerCase()).not.toContain(term);
      }
    }
  });

  it('without industryId (backward compat) uses the restaurant path', async () => {
    const { supabase, mockUpsert } = makeMockSupabase();
    // Provide a restaurant location so it follows the hospitality path
    const restaurantLocation = makeMedicalLocation({ categories: ['restaurant'] });
    await seedSOVQueries(restaurantLocation, [], supabase);
    const rows: Array<{ query_text: string }> = mockUpsert.mock.calls[0][0];
    // Restaurant path produces occasion queries; verify at least one exists
    const occasionRows = rows.filter((r) =>
      r.query_text.toLowerCase().includes('date night') ||
      r.query_text.toLowerCase().includes('birthday'),
    );
    expect(occasionRows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// All medical query helpers return non-empty strings
// ---------------------------------------------------------------------------

describe('medical query helpers — output quality', () => {
  it('all medicalDiscoveryQueries results are non-empty strings', () => {
    const queries = medicalDiscoveryQueries('dentist', 'Alpharetta', 'GA');
    for (const q of queries) {
      expect(typeof q).toBe('string');
      expect(q.trim().length).toBeGreaterThan(0);
    }
  });

  it('all medicalNearMeQueries results are non-empty strings', () => {
    const queries = medicalNearMeQueries('physician', 'Atlanta');
    for (const q of queries) {
      expect(typeof q).toBe('string');
      expect(q.trim().length).toBeGreaterThan(0);
    }
  });
});
