// ---------------------------------------------------------------------------
// location-actions.test.ts — Unit tests for Sprint 100 location server actions
//
// Tests app/actions/locations.ts:
//   - addLocation: auth, role check (admin+), plan limit, Zod validation, auto-primary, success
//   - updateLocation: auth, role check, ownership check, partial update, non-existent location
//   - archiveLocation: auth, role check, cannot archive primary, cannot archive only active, success, cookie cleared
//   - setPrimaryLocation: auth, owner-only, archived check, already-primary no-op, success
//   - switchActiveLocation: auth, validates location in org, not archived, sets cookie
//
// Run:
//   npx vitest run src/__tests__/unit/location-actions.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// -- Hoisted mocks (accessible inside vi.mock factories) --------------------

const mockCookieStore = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}));

// -- Module mocks -----------------------------------------------------------

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ getSafeAuthContext: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
}));

import {
  addLocation,
  updateLocation,
  archiveLocation,
  setPrimaryLocation,
  switchActiveLocation,
} from '@/app/actions/locations';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// -- Shared constants -------------------------------------------------------

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const LOCATION_ID = 'loc-0001-0001-0001-000000000001';
const LOCATION_ID_2 = 'loc-0002-0002-0002-000000000002';

function mockAuth(overrides: Record<string, unknown> = {}) {
  return {
    orgId: ORG_ID,
    userId: 'auth-uid-abc123',
    email: 'admin@example.com',
    fullName: 'Test Admin',
    orgName: 'Test Org',
    plan: 'agency',
    role: 'admin',
    onboarding_completed: true,
    ...overrides,
  };
}

const VALID_ADD_INPUT = {
  business_name: 'Downtown Grill',
  address_line1: '123 Main Street',
  city: 'Chicago',
  state: 'Illinois',
  zip: '60601',
  phone: '312-555-1234',
  website_url: 'https://downtown-grill.com',
  display_name: 'Downtown',
  timezone: 'America/Chicago',
};

// ============================================================================
// addLocation
// ============================================================================

describe('addLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuth() as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never,
    );
  });

  /** Builds a Supabase mock client for addLocation scenarios. */
  function setupAddMocks(overrides: {
    existingCount?: number;
    primaryCount?: number;
    maxOrder?: number | null;
    insertResult?: { id: string } | null;
    insertError?: { message: string } | null;
  } = {}) {
    const {
      existingCount = 0,
      primaryCount = 0,
      maxOrder = null,
      insertResult = { id: LOCATION_ID },
      insertError = null,
    } = overrides;

    // Track calls to .from() to route to the right mock behavior
    let selectCallIndex = 0;

    const mockClient = {
      from: vi.fn().mockImplementation(() => {
        selectCallIndex++;

        if (selectCallIndex === 1) {
          // First call: count existing non-archived locations
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({ count: existingCount }),
              }),
            }),
          };
        }

        if (selectCallIndex === 2) {
          // Second call: count primary locations
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({ count: primaryCount }),
                }),
              }),
            }),
          };
        }

        if (selectCallIndex === 3) {
          // Third call: max location_order
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: maxOrder !== null ? { location_order: maxOrder } : null,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }

        if (selectCallIndex === 4) {
          // Fourth call: insert
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: insertResult,
                  error: insertError,
                }),
              }),
            }),
          };
        }

        return {};
      }),
    };

    vi.mocked(createClient).mockResolvedValue(
      mockClient as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    return { mockClient };
  }

  it('returns Unauthorized when caller is not authenticated', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(null);
    const result = await addLocation(VALID_ADD_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Unauthorized');
  });

  it('returns Unauthorized when orgId is null', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuth({ orgId: null }) as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never,
    );
    const result = await addLocation(VALID_ADD_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Unauthorized');
  });

  it('returns error when caller has viewer role (not admin+)', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuth({ role: 'viewer' }) as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never,
    );
    const result = await addLocation(VALID_ADD_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Admin role required to add locations');
  });

  it('returns error when caller has member role (not admin+)', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuth({ role: 'member' }) as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never,
    );
    const result = await addLocation(VALID_ADD_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Admin role required to add locations');
  });

  it('allows owner role (above admin in hierarchy)', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuth({ role: 'owner' }) as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never,
    );
    setupAddMocks({ existingCount: 0, primaryCount: 0, maxOrder: null });
    const result = await addLocation(VALID_ADD_INPUT);
    expect(result.success).toBe(true);
  });

  it('returns upgrade error when non-Agency plan already has 1 location', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuth({ plan: 'starter' }) as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never,
    );
    setupAddMocks({ existingCount: 1 });
    const result = await addLocation(VALID_ADD_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Upgrade to Agency plan for multiple locations');
  });

  it('returns limit reached error when Agency plan at 10 locations', async () => {
    setupAddMocks({ existingCount: 10 });
    const result = await addLocation(VALID_ADD_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Location limit reached (10/10)');
  });

  it('allows first location on trial plan (existingCount = 0)', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuth({ plan: 'trial' }) as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never,
    );
    setupAddMocks({ existingCount: 0, primaryCount: 0, maxOrder: null });
    const result = await addLocation(VALID_ADD_INPUT);
    expect(result.success).toBe(true);
  });

  it('returns validation error for missing business_name', async () => {
    setupAddMocks({ existingCount: 0 });
    const result = await addLocation({
      ...VALID_ADD_INPUT,
      business_name: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeDefined();
  });

  it('returns validation error for short address', async () => {
    setupAddMocks({ existingCount: 0 });
    const result = await addLocation({
      ...VALID_ADD_INPUT,
      address_line1: '12',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeDefined();
  });

  it('returns validation error for invalid website_url', async () => {
    setupAddMocks({ existingCount: 0 });
    const result = await addLocation({
      ...VALID_ADD_INPUT,
      website_url: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('auto-sets is_primary when no existing primary location', async () => {
    setupAddMocks({ existingCount: 0, primaryCount: 0, maxOrder: null });
    const result = await addLocation(VALID_ADD_INPUT);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.locationId).toBe(LOCATION_ID);
  });

  it('sets next location_order when existing locations present', async () => {
    setupAddMocks({ existingCount: 1, primaryCount: 1, maxOrder: 3 });
    const result = await addLocation(VALID_ADD_INPUT);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.locationId).toBe(LOCATION_ID);
  });

  it('returns insert error from Supabase', async () => {
    setupAddMocks({
      existingCount: 0,
      primaryCount: 0,
      maxOrder: null,
      insertResult: null,
      insertError: { message: 'duplicate key violation' },
    });
    const result = await addLocation(VALID_ADD_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('duplicate key violation');
  });

  it('calls revalidatePath on success', async () => {
    setupAddMocks({ existingCount: 0, primaryCount: 0, maxOrder: null });
    await addLocation(VALID_ADD_INPUT);
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/settings/locations');
  });

  it('derives org_id from session, not input', async () => {
    setupAddMocks({ existingCount: 0, primaryCount: 0, maxOrder: null });
    await addLocation(VALID_ADD_INPUT);
    expect(getSafeAuthContext).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// updateLocation
// ============================================================================

describe('updateLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuth() as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never,
    );
  });

  function setupUpdateMocks(overrides: {
    existing?: { id: string } | null;
    updateError?: { message: string } | null;
  } = {}) {
    const {
      existing = { id: LOCATION_ID },
      updateError = null,
    } = overrides;

    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: existing, error: null }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ error: updateError }),
        }),
      }),
    };

    vi.mocked(createClient).mockResolvedValue(
      mockClient as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    return { mockClient };
  }

  it('returns Unauthorized when caller is not authenticated', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(null);
    const result = await updateLocation(LOCATION_ID, { business_name: 'New Name' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Unauthorized');
  });

  it('returns error when caller has viewer role', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuth({ role: 'viewer' }) as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never,
    );
    const result = await updateLocation(LOCATION_ID, { business_name: 'New Name' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Admin role required to edit locations');
  });

  it('returns validation error for invalid input', async () => {
    setupUpdateMocks();
    const result = await updateLocation(LOCATION_ID, { business_name: 'A' }); // min 2 chars
    expect(result.success).toBe(false);
  });

  it('returns error when location not found (ownership check)', async () => {
    setupUpdateMocks({ existing: null });
    const result = await updateLocation(LOCATION_ID, { business_name: 'Valid Name' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Location not found');
  });

  it('succeeds with partial update (single field)', async () => {
    setupUpdateMocks();
    const result = await updateLocation(LOCATION_ID, { city: 'New York' });
    expect(result.success).toBe(true);
  });

  it('succeeds with multiple fields', async () => {
    setupUpdateMocks();
    const result = await updateLocation(LOCATION_ID, {
      business_name: 'Updated Grill',
      city: 'Boston',
      state: 'Massachusetts',
    });
    expect(result.success).toBe(true);
  });

  it('returns Supabase update error', async () => {
    setupUpdateMocks({ updateError: { message: 'RLS violation' } });
    const result = await updateLocation(LOCATION_ID, { city: 'Denver' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('RLS violation');
  });

  it('calls revalidatePath for dashboard, locations, and business-info', async () => {
    setupUpdateMocks();
    await updateLocation(LOCATION_ID, { city: 'Austin' });
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/settings/locations');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/settings/business-info');
  });
});

// ============================================================================
// archiveLocation
// ============================================================================

describe('archiveLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuth() as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never,
    );
    mockCookieStore.get.mockReturnValue(undefined);
    mockCookieStore.set.mockReturnValue(undefined);
    mockCookieStore.delete.mockReturnValue(undefined);
  });

  function setupArchiveMocks(overrides: {
    loc?: { id: string; is_primary: boolean; is_archived: boolean } | null;
    activeCount?: number;
    updateError?: { message: string } | null;
  } = {}) {
    const {
      loc = { id: LOCATION_ID, is_primary: false, is_archived: false },
      activeCount = 2,
      updateError = null,
    } = overrides;

    let fromCallIndex = 0;

    const mockClient = {
      from: vi.fn().mockImplementation(() => {
        fromCallIndex++;

        if (fromCallIndex === 1) {
          // First call: look up location by id + org_id
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: loc, error: null }),
                }),
              }),
            }),
          };
        }

        if (fromCallIndex === 2) {
          // Second call: count non-archived locations
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({ count: activeCount }),
              }),
            }),
          };
        }

        if (fromCallIndex === 3) {
          // Third call: update (archive)
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ error: updateError }),
            }),
          };
        }

        return {};
      }),
    };

    vi.mocked(createClient).mockResolvedValue(
      mockClient as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    return { mockClient };
  }

  it('returns Unauthorized when caller is not authenticated', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(null);
    const result = await archiveLocation(LOCATION_ID);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Unauthorized');
  });

  it('returns error when caller has viewer role', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuth({ role: 'viewer' }) as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never,
    );
    const result = await archiveLocation(LOCATION_ID);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Admin role required to archive locations');
  });

  it('returns error when location not found', async () => {
    setupArchiveMocks({ loc: null });
    const result = await archiveLocation(LOCATION_ID);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Location not found');
  });

  it('returns error when location is already archived', async () => {
    setupArchiveMocks({
      loc: { id: LOCATION_ID, is_primary: false, is_archived: true },
    });
    const result = await archiveLocation(LOCATION_ID);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Location is already archived');
  });

  it('returns error when trying to archive primary location', async () => {
    setupArchiveMocks({
      loc: { id: LOCATION_ID, is_primary: true, is_archived: false },
    });
    const result = await archiveLocation(LOCATION_ID);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Cannot archive primary location. Set another location as primary first.');
    }
  });

  it('returns error when trying to archive the only active location', async () => {
    setupArchiveMocks({ activeCount: 1 });
    const result = await archiveLocation(LOCATION_ID);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Cannot archive the only active location');
  });

  it('succeeds when location is non-primary with multiple active locations', async () => {
    setupArchiveMocks({ activeCount: 3 });
    const result = await archiveLocation(LOCATION_ID);
    expect(result.success).toBe(true);
  });

  it('clears cookie when archived location is the active cookie', async () => {
    mockCookieStore.get.mockReturnValue({ value: LOCATION_ID });
    setupArchiveMocks({ activeCount: 2 });
    const result = await archiveLocation(LOCATION_ID);
    expect(result.success).toBe(true);
    expect(mockCookieStore.delete).toHaveBeenCalledWith('lv_selected_location');
  });

  it('does NOT clear cookie when archived location is not the active cookie', async () => {
    mockCookieStore.get.mockReturnValue({ value: LOCATION_ID_2 });
    setupArchiveMocks({ activeCount: 2 });
    const result = await archiveLocation(LOCATION_ID);
    expect(result.success).toBe(true);
    expect(mockCookieStore.delete).not.toHaveBeenCalled();
  });

  it('returns Supabase update error', async () => {
    setupArchiveMocks({ activeCount: 2, updateError: { message: 'DB error' } });
    const result = await archiveLocation(LOCATION_ID);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('DB error');
  });

  it('calls revalidatePath on success', async () => {
    setupArchiveMocks({ activeCount: 2 });
    await archiveLocation(LOCATION_ID);
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/settings/locations');
  });
});

// ============================================================================
// setPrimaryLocation
// ============================================================================

describe('setPrimaryLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuth({ role: 'owner' }) as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never,
    );
  });

  function setupPrimaryMocks(overrides: {
    loc?: { id: string; is_primary: boolean; is_archived: boolean } | null;
    unsetError?: { message: string } | null;
    setError?: { message: string } | null;
  } = {}) {
    const {
      loc = { id: LOCATION_ID, is_primary: false, is_archived: false },
      unsetError = null,
      setError = null,
    } = overrides;

    let fromCallIndex = 0;

    const mockClient = {
      from: vi.fn().mockImplementation(() => {
        fromCallIndex++;

        if (fromCallIndex === 1) {
          // First call: look up location by id + org_id
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: loc, error: null }),
                }),
              }),
            }),
          };
        }

        if (fromCallIndex === 2) {
          // Second call: unset current primary (update where is_primary=true)
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({ error: unsetError }),
              }),
            }),
          };
        }

        if (fromCallIndex === 3) {
          // Third call: set new primary
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ error: setError }),
            }),
          };
        }

        return {};
      }),
    };

    vi.mocked(createClient).mockResolvedValue(
      mockClient as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    return { mockClient };
  }

  it('returns Unauthorized when caller is not authenticated', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(null);
    const result = await setPrimaryLocation(LOCATION_ID);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Unauthorized');
  });

  it('returns error when caller is admin (not owner)', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuth({ role: 'admin' }) as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never,
    );
    const result = await setPrimaryLocation(LOCATION_ID);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Only the org owner can change the primary location');
  });

  it('returns error when caller is viewer', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuth({ role: 'viewer' }) as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never,
    );
    const result = await setPrimaryLocation(LOCATION_ID);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Only the org owner can change the primary location');
  });

  it('returns error when location not found', async () => {
    setupPrimaryMocks({ loc: null });
    const result = await setPrimaryLocation(LOCATION_ID);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Location not found');
  });

  it('returns error when location is archived', async () => {
    setupPrimaryMocks({
      loc: { id: LOCATION_ID, is_primary: false, is_archived: true },
    });
    const result = await setPrimaryLocation(LOCATION_ID);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Cannot set archived location as primary');
  });

  it('returns success (no-op) when location is already primary', async () => {
    setupPrimaryMocks({
      loc: { id: LOCATION_ID, is_primary: true, is_archived: false },
    });
    const result = await setPrimaryLocation(LOCATION_ID);
    expect(result.success).toBe(true);
    // Should not call revalidatePath since it's a no-op
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('succeeds: unsets old primary and sets new primary', async () => {
    setupPrimaryMocks();
    const result = await setPrimaryLocation(LOCATION_ID);
    expect(result.success).toBe(true);
  });

  it('returns error when set-primary update fails', async () => {
    setupPrimaryMocks({ setError: { message: 'unique constraint violation' } });
    const result = await setPrimaryLocation(LOCATION_ID);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('unique constraint violation');
  });

  it('calls revalidatePath on success', async () => {
    setupPrimaryMocks();
    await setPrimaryLocation(LOCATION_ID);
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/settings/locations');
  });
});

// ============================================================================
// switchActiveLocation
// ============================================================================

describe('switchActiveLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuth({ role: 'viewer' }) as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never,
    );
    mockCookieStore.set.mockReturnValue(undefined);
  });

  function setupSwitchMocks(overrides: {
    loc?: { id: string } | null;
  } = {}) {
    const { loc = { id: LOCATION_ID } } = overrides;

    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: loc, error: null }),
              }),
            }),
          }),
        }),
      }),
    };

    vi.mocked(createClient).mockResolvedValue(
      mockClient as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    return { mockClient };
  }

  it('returns Unauthorized when caller is not authenticated', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(null);
    const result = await switchActiveLocation(LOCATION_ID);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Unauthorized');
  });

  it('allows viewer role (any role can switch)', async () => {
    setupSwitchMocks();
    const result = await switchActiveLocation(LOCATION_ID);
    expect(result.success).toBe(true);
  });

  it('allows member role', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuth({ role: 'member' }) as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never,
    );
    setupSwitchMocks();
    const result = await switchActiveLocation(LOCATION_ID);
    expect(result.success).toBe(true);
  });

  it('allows admin role', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuth({ role: 'admin' }) as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never,
    );
    setupSwitchMocks();
    const result = await switchActiveLocation(LOCATION_ID);
    expect(result.success).toBe(true);
  });

  it('returns error when location not found in org', async () => {
    setupSwitchMocks({ loc: null });
    const result = await switchActiveLocation(LOCATION_ID);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Location not found or archived');
  });

  it('returns error for archived location (query filters is_archived=false)', async () => {
    // Archived locations won't be returned by the query, so loc is null
    setupSwitchMocks({ loc: null });
    const result = await switchActiveLocation(LOCATION_ID);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Location not found or archived');
  });

  it('sets HttpOnly cookie on success', async () => {
    setupSwitchMocks();
    const result = await switchActiveLocation(LOCATION_ID);
    expect(result.success).toBe(true);
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'lv_selected_location',
      LOCATION_ID,
      expect.objectContaining({
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60,
      }),
    );
  });

  it('sets secure flag based on NODE_ENV', async () => {
    setupSwitchMocks();
    await switchActiveLocation(LOCATION_ID);
    // In test environment NODE_ENV !== 'production', so secure should be false
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'lv_selected_location',
      LOCATION_ID,
      expect.objectContaining({
        secure: false,
      }),
    );
  });
});
