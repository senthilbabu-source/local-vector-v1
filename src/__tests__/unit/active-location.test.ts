// ---------------------------------------------------------------------------
// src/__tests__/unit/active-location.test.ts
//
// Unit tests for lib/location/active-location.ts:
//   - resolveActiveLocation: cookie, primary, oldest, null fallbacks
//   - getActiveLocationId: convenience wrapper
//
// Strategy:
//   - vi.mock('next/headers') for cookies (async, returns { get })
//   - Mock Supabase client with chained .from().select().eq().eq().order().order().order()
//   - No live DB — pure unit tests.
//
// Run:
//   npx vitest run src/__tests__/unit/active-location.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ── Mock next/headers cookies ───────────────────────────────────────────
const mockCookieGet = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: (...args: unknown[]) => mockCookieGet(...args),
  }),
}));

// ── Mock Supabase client with chained query builder ─────────────────────
const mockOrder3 = vi.fn(); // third .order(created_at)
const mockOrder2 = vi.fn().mockReturnValue({ order: mockOrder3 }); // second .order(location_order)
const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 }); // first .order(is_primary)
const mockEq2 = vi.fn().mockReturnValue({ order: mockOrder1 }); // .eq(is_archived, false)
const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 }); // .eq(org_id, ...)
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

const mockSupabase = { from: mockFrom } as unknown as SupabaseClient<Database>;

// ── Import under test (after mocks) ────────────────────────────────────
import {
  resolveActiveLocation,
  getActiveLocationId,
  LOCATION_COOKIE,
} from '@/lib/location/active-location';

// ── Fixtures ────────────────────────────────────────────────────────────
const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

interface LocationFixture {
  id: string;
  business_name: string;
  display_name: string | null;
  city: string | null;
  state: string | null;
  is_primary: boolean;
}

const LOC_PRIMARY: LocationFixture = {
  id: 'loc-primary-001',
  business_name: 'Downtown Grill',
  display_name: 'Downtown',
  city: 'Austin',
  state: 'TX',
  is_primary: true,
};

const LOC_SECONDARY: LocationFixture = {
  id: 'loc-secondary-002',
  business_name: 'Uptown Grill',
  display_name: 'Uptown',
  city: 'Dallas',
  state: 'TX',
  is_primary: false,
};

const LOC_TERTIARY: LocationFixture = {
  id: 'loc-tertiary-003',
  business_name: 'Midtown Grill',
  display_name: null,
  city: null,
  state: null,
  is_primary: false,
};

/** Helper: configure the Supabase mock to resolve with given data/error. */
function setDbResult(data: LocationFixture[] | null, error: { message: string } | null = null) {
  mockOrder3.mockResolvedValue({ data, error });
}

/** Helper: configure the cookie mock. */
function setCookie(value: string | undefined) {
  if (value === undefined) {
    mockCookieGet.mockReturnValue(undefined);
  } else {
    mockCookieGet.mockReturnValue({ value });
  }
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('resolveActiveLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no cookie set
    setCookie(undefined);
  });

  // ── Empty / no locations ────────────────────────────────────────────

  it('1. returns null location + empty array when org has no locations', async () => {
    setDbResult([]);
    const result = await resolveActiveLocation(mockSupabase, ORG_ID);

    expect(result.location).toBeNull();
    expect(result.allLocations).toEqual([]);
  });

  it('2. returns null location + empty array when DB returns null data', async () => {
    setDbResult(null);
    const result = await resolveActiveLocation(mockSupabase, ORG_ID);

    expect(result.location).toBeNull();
    expect(result.allLocations).toEqual([]);
  });

  // ── Primary fallback (no cookie) ────────────────────────────────────

  it('3. returns primary location when no cookie is set', async () => {
    setDbResult([LOC_PRIMARY, LOC_SECONDARY]);
    setCookie(undefined);

    const result = await resolveActiveLocation(mockSupabase, ORG_ID);

    expect(result.location).toEqual({
      id: LOC_PRIMARY.id,
      business_name: LOC_PRIMARY.business_name,
      display_name: LOC_PRIMARY.display_name,
      city: LOC_PRIMARY.city,
      state: LOC_PRIMARY.state,
      is_primary: true,
    });
  });

  it('4. returns primary even when it is not the first element in array', async () => {
    // Simulate DB returning secondary first, primary second
    setDbResult([LOC_SECONDARY, LOC_PRIMARY]);
    setCookie(undefined);

    const result = await resolveActiveLocation(mockSupabase, ORG_ID);

    expect(result.location!.id).toBe(LOC_PRIMARY.id);
    expect(result.location!.is_primary).toBe(true);
  });

  // ── Cookie resolution ───────────────────────────────────────────────

  it('5. returns cookie location when valid cookie is set', async () => {
    setDbResult([LOC_PRIMARY, LOC_SECONDARY]);
    setCookie(LOC_SECONDARY.id);

    const result = await resolveActiveLocation(mockSupabase, ORG_ID);

    expect(result.location!.id).toBe(LOC_SECONDARY.id);
    expect(result.location!.business_name).toBe('Uptown Grill');
  });

  it('6. cookie takes precedence over primary', async () => {
    setDbResult([LOC_PRIMARY, LOC_SECONDARY, LOC_TERTIARY]);
    setCookie(LOC_TERTIARY.id);

    const result = await resolveActiveLocation(mockSupabase, ORG_ID);

    expect(result.location!.id).toBe(LOC_TERTIARY.id);
    expect(result.location!.is_primary).toBe(false);
  });

  // ── Invalid cookie fallback ─────────────────────────────────────────

  it('7. falls back to primary when cookie value is not in org locations', async () => {
    setDbResult([LOC_PRIMARY, LOC_SECONDARY]);
    setCookie('nonexistent-location-id');

    const result = await resolveActiveLocation(mockSupabase, ORG_ID);

    expect(result.location!.id).toBe(LOC_PRIMARY.id);
  });

  it('8. ignores cookie pointing to archived location (not in results)', async () => {
    // Archived location not returned by DB query, so cookie ID won't match
    const archivedId = 'loc-archived-999';
    setDbResult([LOC_PRIMARY, LOC_SECONDARY]);
    setCookie(archivedId);

    const result = await resolveActiveLocation(mockSupabase, ORG_ID);

    expect(result.location!.id).toBe(LOC_PRIMARY.id);
  });

  it('9. falls back to primary when cookie is an empty string', async () => {
    setDbResult([LOC_PRIMARY, LOC_SECONDARY]);
    setCookie('');

    const result = await resolveActiveLocation(mockSupabase, ORG_ID);

    // Empty string is falsy, so cookie branch skipped → primary fallback
    expect(result.location!.id).toBe(LOC_PRIMARY.id);
  });

  // ── Oldest fallback (no cookie, no primary) ─────────────────────────

  it('10. falls back to oldest (first in array) when no primary exists and no cookie', async () => {
    setDbResult([LOC_SECONDARY, LOC_TERTIARY]);
    setCookie(undefined);

    const result = await resolveActiveLocation(mockSupabase, ORG_ID);

    // No primary → first element (oldest by created_at sort) wins
    expect(result.location!.id).toBe(LOC_SECONDARY.id);
  });

  it('11. falls back to oldest when cookie is invalid and no primary exists', async () => {
    setDbResult([LOC_SECONDARY, LOC_TERTIARY]);
    setCookie('bad-cookie-value');

    const result = await resolveActiveLocation(mockSupabase, ORG_ID);

    expect(result.location!.id).toBe(LOC_SECONDARY.id);
  });

  // ── allLocations array ──────────────────────────────────────────────

  it('12. returns allLocations array with all non-archived locations', async () => {
    setDbResult([LOC_PRIMARY, LOC_SECONDARY, LOC_TERTIARY]);
    setCookie(undefined);

    const result = await resolveActiveLocation(mockSupabase, ORG_ID);

    expect(result.allLocations).toHaveLength(3);
    expect(result.allLocations.map((l) => l.id)).toEqual([
      LOC_PRIMARY.id,
      LOC_SECONDARY.id,
      LOC_TERTIARY.id,
    ]);
  });

  it('13. allLocations is always returned even when cookie selects a specific location', async () => {
    setDbResult([LOC_PRIMARY, LOC_SECONDARY]);
    setCookie(LOC_SECONDARY.id);

    const result = await resolveActiveLocation(mockSupabase, ORG_ID);

    expect(result.location!.id).toBe(LOC_SECONDARY.id);
    expect(result.allLocations).toHaveLength(2);
  });

  // ── Single location org ─────────────────────────────────────────────

  it('14. single location org resolves to that location without cookie', async () => {
    setDbResult([LOC_SECONDARY]);
    setCookie(undefined);

    const result = await resolveActiveLocation(mockSupabase, ORG_ID);

    expect(result.location!.id).toBe(LOC_SECONDARY.id);
    expect(result.allLocations).toHaveLength(1);
  });

  it('15. single location org resolves via cookie if it matches', async () => {
    setDbResult([LOC_SECONDARY]);
    setCookie(LOC_SECONDARY.id);

    const result = await resolveActiveLocation(mockSupabase, ORG_ID);

    expect(result.location!.id).toBe(LOC_SECONDARY.id);
  });

  // ── Data mapping ────────────────────────────────────────────────────

  it('16. maps null is_primary to false in returned location', async () => {
    const locWithNullPrimary = { ...LOC_SECONDARY, is_primary: null };
    setDbResult([locWithNullPrimary as unknown as typeof LOC_PRIMARY]);
    setCookie(undefined);

    const result = await resolveActiveLocation(mockSupabase, ORG_ID);

    expect(result.location!.is_primary).toBe(false);
    expect(result.allLocations[0].is_primary).toBe(false);
  });

  it('17. preserves null display_name, city, and state fields', async () => {
    setDbResult([LOC_TERTIARY]);
    setCookie(undefined);

    const result = await resolveActiveLocation(mockSupabase, ORG_ID);

    expect(result.location!.display_name).toBeNull();
    expect(result.location!.city).toBeNull();
    expect(result.location!.state).toBeNull();
  });

  // ── Supabase query correctness ──────────────────────────────────────

  it('18. passes correct table, columns, and filters to Supabase', async () => {
    setDbResult([LOC_PRIMARY]);
    setCookie(undefined);

    await resolveActiveLocation(mockSupabase, ORG_ID);

    expect(mockFrom).toHaveBeenCalledWith('locations');
    expect(mockSelect).toHaveBeenCalledWith(
      'id, business_name, display_name, city, state, is_primary',
    );
    expect(mockEq1).toHaveBeenCalledWith('org_id', ORG_ID);
    expect(mockEq2).toHaveBeenCalledWith('is_archived', false);
    expect(mockOrder1).toHaveBeenCalledWith('is_primary', { ascending: false });
    expect(mockOrder2).toHaveBeenCalledWith('location_order', { ascending: true });
    expect(mockOrder3).toHaveBeenCalledWith('created_at', { ascending: true });
  });

  it('19. reads the correct cookie name', async () => {
    setDbResult([LOC_PRIMARY]);
    setCookie(undefined);

    await resolveActiveLocation(mockSupabase, ORG_ID);

    expect(mockCookieGet).toHaveBeenCalledWith(LOCATION_COOKIE);
    expect(LOCATION_COOKIE).toBe('lv_selected_location');
  });

  // ── DB error handling ───────────────────────────────────────────────

  it('20. handles DB error gracefully — null data returns empty result', async () => {
    setDbResult(null, { message: 'connection timeout' });

    const result = await resolveActiveLocation(mockSupabase, ORG_ID);

    expect(result.location).toBeNull();
    expect(result.allLocations).toEqual([]);
  });
});

// ── getActiveLocationId ─────────────────────────────────────────────────

describe('getActiveLocationId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCookie(undefined);
  });

  it('21. returns location ID string when resolved', async () => {
    setDbResult([LOC_PRIMARY, LOC_SECONDARY]);
    setCookie(undefined);

    const id = await getActiveLocationId(mockSupabase, ORG_ID);

    expect(id).toBe(LOC_PRIMARY.id);
    expect(typeof id).toBe('string');
  });

  it('22. returns null when no locations exist', async () => {
    setDbResult([]);

    const id = await getActiveLocationId(mockSupabase, ORG_ID);

    expect(id).toBeNull();
  });

  it('23. returns cookie location ID when cookie is set', async () => {
    setDbResult([LOC_PRIMARY, LOC_SECONDARY]);
    setCookie(LOC_SECONDARY.id);

    const id = await getActiveLocationId(mockSupabase, ORG_ID);

    expect(id).toBe(LOC_SECONDARY.id);
  });

  it('24. returns null when DB returns null data', async () => {
    setDbResult(null, { message: 'network error' });

    const id = await getActiveLocationId(mockSupabase, ORG_ID);

    expect(id).toBeNull();
  });
});
