/**
 * Unit Tests — Location Permissions (lib/auth/location-permissions.ts)
 *
 * Tests permission resolution, access listing, assertion, and grant/revoke.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/location-permissions.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

import {
  resolveLocationRole,
  getUserLocationAccess,
  assertLocationRole,
  setLocationPermission,
  revokeLocationPermission,
  InsufficientLocationRoleError,
} from '@/lib/auth/location-permissions';

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------

const mockFrom = vi.fn();
const supabase = { from: mockFrom } as unknown as SupabaseClient<Database>;

// Stable test UUIDs
const TEST_ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TEST_USER_ID = 'u1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TEST_OWNER_ID = 'u0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TEST_MEMBERSHIP_ID = 'm1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TEST_OWNER_MEMBERSHIP_ID = 'm0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const LOC_1 = 'l1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const LOC_2 = 'l2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const LOC_3 = 'l3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helper — mock chained Supabase calls
// ---------------------------------------------------------------------------

type TableMock = {
  memberships?: unknown;
  location_permissions?: unknown;
  locations?: unknown;
};

function setupMockTables(mocks: TableMock) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'memberships' && mocks.memberships) return mocks.memberships;
    if (table === 'location_permissions' && mocks.location_permissions)
      return mocks.location_permissions;
    if (table === 'locations' && mocks.locations) return mocks.locations;
    // Default empty chain
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    };
  });
}

function membershipChain(data: { id: string; role: string } | null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
        }),
      }),
    }),
  };
}

function locPermChain(data: { role: string } | null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
        }),
      }),
    }),
  };
}

function locationsChain(data: Array<{ id: string }>) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data, error: null }),
    }),
  };
}

function locPermListChain(data: Array<{ location_id: string; role: string }>) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data, error: null }),
    }),
  };
}

// ---------------------------------------------------------------------------
// resolveLocationRole
// ---------------------------------------------------------------------------

describe('resolveLocationRole', () => {
  it('owner gets owner role on any location regardless of location_permissions rows', async () => {
    setupMockTables({
      memberships: membershipChain({ id: TEST_OWNER_MEMBERSHIP_ID, role: 'owner' }),
    });

    const role = await resolveLocationRole(supabase, TEST_OWNER_ID, TEST_ORG_ID, LOC_1);
    expect(role).toBe('owner');
  });

  it('admin with viewer location override gets viewer role on that location', async () => {
    setupMockTables({
      memberships: membershipChain({ id: TEST_MEMBERSHIP_ID, role: 'admin' }),
      location_permissions: locPermChain({ role: 'viewer' }),
    });

    const role = await resolveLocationRole(supabase, TEST_USER_ID, TEST_ORG_ID, LOC_1);
    expect(role).toBe('viewer');
  });

  it('admin with no location override gets admin role (org fallback)', async () => {
    setupMockTables({
      memberships: membershipChain({ id: TEST_MEMBERSHIP_ID, role: 'admin' }),
      location_permissions: locPermChain(null),
    });

    const role = await resolveLocationRole(supabase, TEST_USER_ID, TEST_ORG_ID, LOC_1);
    expect(role).toBe('admin');
  });

  it('viewer with no location override gets viewer role (org fallback)', async () => {
    setupMockTables({
      memberships: membershipChain({ id: TEST_MEMBERSHIP_ID, role: 'viewer' }),
      location_permissions: locPermChain(null),
    });

    const role = await resolveLocationRole(supabase, TEST_USER_ID, TEST_ORG_ID, LOC_1);
    expect(role).toBe('viewer');
  });

  it('viewer CANNOT get admin role even if location_permissions says admin', async () => {
    setupMockTables({
      memberships: membershipChain({ id: TEST_MEMBERSHIP_ID, role: 'viewer' }),
      location_permissions: locPermChain({ role: 'admin' }),
    });

    const role = await resolveLocationRole(supabase, TEST_USER_ID, TEST_ORG_ID, LOC_1);
    expect(role).toBe('viewer'); // min(viewer, admin) = viewer
  });

  it('returns null for user not in org_members', async () => {
    setupMockTables({
      memberships: membershipChain(null),
    });

    const role = await resolveLocationRole(supabase, TEST_USER_ID, TEST_ORG_ID, LOC_1);
    expect(role).toBeNull();
  });

  it('handles supabase error gracefully — returns null (fail closed)', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Connection refused' },
            }),
          }),
        }),
      }),
    }));

    const role = await resolveLocationRole(supabase, TEST_USER_ID, TEST_ORG_ID, LOC_1);
    expect(role).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getUserLocationAccess
// ---------------------------------------------------------------------------

describe('getUserLocationAccess', () => {
  it('owner gets all org locations with owner role', async () => {
    const callState = { membershipCalled: false, locPermCalled: false };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'memberships') {
        return membershipChain({ id: TEST_OWNER_MEMBERSHIP_ID, role: 'owner' });
      }
      if (table === 'locations') {
        return locationsChain([{ id: LOC_1 }, { id: LOC_2 }]);
      }
      return locPermListChain([]);
    });

    const access = await getUserLocationAccess(supabase, TEST_OWNER_ID, TEST_ORG_ID);
    expect(access).toHaveLength(2);
    expect(access[0]).toEqual({ locationId: LOC_1, effectiveRole: 'owner' });
    expect(access[1]).toEqual({ locationId: LOC_2, effectiveRole: 'owner' });
  });

  it('admin gets all locations with admin role (no overrides)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'memberships') {
        return membershipChain({ id: TEST_MEMBERSHIP_ID, role: 'admin' });
      }
      if (table === 'locations') {
        return locationsChain([{ id: LOC_1 }, { id: LOC_2 }]);
      }
      if (table === 'location_permissions') {
        return locPermListChain([]);
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    const access = await getUserLocationAccess(supabase, TEST_USER_ID, TEST_ORG_ID);
    expect(access).toHaveLength(2);
    expect(access[0]?.effectiveRole).toBe('admin');
    expect(access[1]?.effectiveRole).toBe('admin');
  });

  it('admin gets viewer role on location with explicit viewer override', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'memberships') {
        return membershipChain({ id: TEST_MEMBERSHIP_ID, role: 'admin' });
      }
      if (table === 'locations') {
        return locationsChain([{ id: LOC_1 }, { id: LOC_2 }]);
      }
      if (table === 'location_permissions') {
        return locPermListChain([{ location_id: LOC_2, role: 'viewer' }]);
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    const access = await getUserLocationAccess(supabase, TEST_USER_ID, TEST_ORG_ID);
    const loc1 = access.find((a) => a.locationId === LOC_1);
    const loc2 = access.find((a) => a.locationId === LOC_2);
    expect(loc1?.effectiveRole).toBe('admin');
    expect(loc2?.effectiveRole).toBe('viewer');
  });

  it('viewer gets viewer role even with admin location override', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'memberships') {
        return membershipChain({ id: TEST_MEMBERSHIP_ID, role: 'viewer' });
      }
      if (table === 'locations') {
        return locationsChain([{ id: LOC_1 }]);
      }
      if (table === 'location_permissions') {
        return locPermListChain([{ location_id: LOC_1, role: 'admin' }]);
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    const access = await getUserLocationAccess(supabase, TEST_USER_ID, TEST_ORG_ID);
    expect(access[0]?.effectiveRole).toBe('viewer'); // min(viewer, admin) = viewer
  });

  it('returns empty array for user not in org', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'memberships') {
        return membershipChain(null);
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    const access = await getUserLocationAccess(supabase, TEST_USER_ID, TEST_ORG_ID);
    expect(access).toEqual([]);
  });

  it('handles org with single location correctly', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'memberships') {
        return membershipChain({ id: TEST_MEMBERSHIP_ID, role: 'admin' });
      }
      if (table === 'locations') {
        return locationsChain([{ id: LOC_1 }]);
      }
      if (table === 'location_permissions') {
        return locPermListChain([]);
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    const access = await getUserLocationAccess(supabase, TEST_USER_ID, TEST_ORG_ID);
    expect(access).toHaveLength(1);
    expect(access[0]).toEqual({ locationId: LOC_1, effectiveRole: 'admin' });
  });
});

// ---------------------------------------------------------------------------
// assertLocationRole
// ---------------------------------------------------------------------------

describe('assertLocationRole', () => {
  it('resolves when user meets required role on location', async () => {
    setupMockTables({
      memberships: membershipChain({ id: TEST_MEMBERSHIP_ID, role: 'admin' }),
      location_permissions: locPermChain(null),
    });

    await expect(
      assertLocationRole(supabase, TEST_USER_ID, TEST_ORG_ID, LOC_1, 'viewer')
    ).resolves.not.toThrow();
  });

  it('throws INSUFFICIENT_LOCATION_ROLE when viewer hits admin requirement', async () => {
    setupMockTables({
      memberships: membershipChain({ id: TEST_MEMBERSHIP_ID, role: 'viewer' }),
      location_permissions: locPermChain(null),
    });

    try {
      await assertLocationRole(supabase, TEST_USER_ID, TEST_ORG_ID, LOC_1, 'admin');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InsufficientLocationRoleError);
      const e = err as InsufficientLocationRoleError;
      expect(e.code).toBe('INSUFFICIENT_LOCATION_ROLE');
      expect(e.locationId).toBe(LOC_1);
      expect(e.required).toBe('admin');
      expect(e.actual).toBe('viewer');
    }
  });

  it('throws when user is not org member (null role)', async () => {
    setupMockTables({
      memberships: membershipChain(null),
    });

    try {
      await assertLocationRole(supabase, TEST_USER_ID, TEST_ORG_ID, LOC_1, 'viewer');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InsufficientLocationRoleError);
      const e = err as InsufficientLocationRoleError;
      expect(e.actual).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// setLocationPermission
// ---------------------------------------------------------------------------

describe('setLocationPermission', () => {
  it('returns error when caller is not owner', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'memberships') {
        // First call: check caller's role (admin, not owner)
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { role: 'admin' },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }) };
    });

    const result = await setLocationPermission(
      supabase,
      TEST_USER_ID,
      TEST_ORG_ID,
      TEST_MEMBERSHIP_ID,
      LOC_1,
      'viewer'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('owner');
  });

  it('returns error when role would elevate above org role', async () => {
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'memberships') {
        callCount++;
        if (callCount === 1) {
          // Caller is owner
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { role: 'owner' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        // Target is viewer
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { role: 'viewer', org_id: TEST_ORG_ID },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }) };
    });

    const result = await setLocationPermission(
      supabase,
      TEST_OWNER_ID,
      TEST_ORG_ID,
      TEST_MEMBERSHIP_ID,
      LOC_1,
      'admin' // Trying to elevate viewer to admin — should fail
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('elevate');
  });
});

// ---------------------------------------------------------------------------
// revokeLocationPermission
// ---------------------------------------------------------------------------

describe('revokeLocationPermission', () => {
  it('returns error when caller is not owner', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { role: 'admin' },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }) };
    });

    const result = await revokeLocationPermission(
      supabase,
      TEST_USER_ID,
      TEST_ORG_ID,
      TEST_MEMBERSHIP_ID,
      LOC_1
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('owner');
  });

  it('returns success when caller is owner', async () => {
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'memberships') {
        callCount++;
        if (callCount === 1) {
          // Caller is owner
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { role: 'owner' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        // Target membership
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { org_id: TEST_ORG_ID },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'location_permissions') {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }) };
    });

    const result = await revokeLocationPermission(
      supabase,
      TEST_OWNER_ID,
      TEST_ORG_ID,
      TEST_MEMBERSHIP_ID,
      LOC_1
    );
    expect(result.success).toBe(true);
  });
});
