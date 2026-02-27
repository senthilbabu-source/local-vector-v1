// ---------------------------------------------------------------------------
// org-switcher.test.ts — Unit tests for org switcher + active org resolution
//
// Tests:
//   app/actions/switch-org.ts:
//     • switchActiveOrg: auth gate, user resolution, membership validation,
//       sets ORG_COOKIE, clears LOCATION_COOKIE, non-member rejection
//
//   lib/auth/active-org.ts:
//     • getActiveOrgId: valid cookie, invalid cookie fallback, no cookie
//       fallback, no memberships = null
//     • getUserOrgs: returns orgs with roles, empty for no memberships
//
// Run:
//   npx vitest run src/__tests__/unit/org-switcher.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({ getSafeAuthContext: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { switchActiveOrg } from '@/app/actions/switch-org';
import { getActiveOrgId, getUserOrgs, ORG_COOKIE } from '@/lib/auth/active-org';
import { LOCATION_COOKIE } from '@/lib/location/active-location';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

// ── Constants ─────────────────────────────────────────────────────────────

const AUTH_UID = 'auth-uid-abc123';
const PUBLIC_USER_ID = 'u0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const ORG_ID_A = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const ORG_ID_B = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';
const ORG_ID_FOREIGN = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99';
const MEMBERSHIP_ID = 'm0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// ── Helpers ───────────────────────────────────────────────────────────────

function mockAuthContext(overrides: Record<string, unknown> = {}) {
  return {
    userId: AUTH_UID,
    email: 'user@example.com',
    fullName: 'Test User',
    orgId: ORG_ID_A,
    orgName: 'Org A',
    role: 'owner',
    plan: 'agency',
    onboarding_completed: true,
    ...overrides,
  };
}

// ── switchActiveOrg ───────────────────────────────────────────────────────

describe('switchActiveOrg', () => {
  let cookieSet: ReturnType<typeof vi.fn>;
  let cookieDelete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default cookie mock
    cookieSet = vi.fn();
    cookieDelete = vi.fn();
    vi.mocked(cookies).mockResolvedValue({
      set: cookieSet,
      delete: cookieDelete,
      get: vi.fn(),
      getAll: vi.fn(),
      has: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
  });

  function setupSwitchMocks(opts: {
    publicUser?: { id: string } | null;
    membership?: { id: string } | null;
  } = {}) {
    const {
      publicUser = { id: PUBLIC_USER_ID },
      membership = { id: MEMBERSHIP_ID },
    } = opts;

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: publicUser, error: null }),
              }),
            }),
          };
        }
        if (table === 'memberships') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: membership, error: null }),
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

  it('returns error when user is not authenticated', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(null);

    const result = await switchActiveOrg(ORG_ID_A);

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns error when public user record is not found', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuthContext() as Awaited<ReturnType<typeof getSafeAuthContext>>,
    );
    setupSwitchMocks({ publicUser: null });

    const result = await switchActiveOrg(ORG_ID_A);

    expect(result).toEqual({ success: false, error: 'User not found' });
  });

  it('returns error when user is not a member of the target org', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuthContext() as Awaited<ReturnType<typeof getSafeAuthContext>>,
    );
    setupSwitchMocks({ membership: null });

    const result = await switchActiveOrg(ORG_ID_FOREIGN);

    expect(result).toEqual({ success: false, error: 'Not a member of this organization' });
  });

  it('sets ORG_COOKIE with correct options on success', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuthContext() as Awaited<ReturnType<typeof getSafeAuthContext>>,
    );
    setupSwitchMocks();

    const result = await switchActiveOrg(ORG_ID_A);

    expect(result).toEqual({ success: true });
    expect(cookieSet).toHaveBeenCalledWith(
      ORG_COOKIE,
      ORG_ID_A,
      expect.objectContaining({
        path: '/',
        maxAge: 365 * 24 * 60 * 60,
        sameSite: 'lax',
        httpOnly: true,
      }),
    );
  });

  it('clears the LOCATION_COOKIE when switching orgs', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuthContext() as Awaited<ReturnType<typeof getSafeAuthContext>>,
    );
    setupSwitchMocks();

    await switchActiveOrg(ORG_ID_A);

    expect(cookieDelete).toHaveBeenCalledWith(LOCATION_COOKIE);
  });

  it('derives userId from session context — never from input args', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuthContext() as Awaited<ReturnType<typeof getSafeAuthContext>>,
    );
    const { mockClient } = setupSwitchMocks();

    await switchActiveOrg(ORG_ID_A);

    // The first from('users') call resolves public user from auth UID
    expect(mockClient.from).toHaveBeenCalledWith('users');
    // getSafeAuthContext must have been called to derive the user
    expect(getSafeAuthContext).toHaveBeenCalledTimes(1);
  });

  it('sets the cookie value to the exact orgId passed in', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuthContext() as Awaited<ReturnType<typeof getSafeAuthContext>>,
    );
    setupSwitchMocks();

    await switchActiveOrg(ORG_ID_B);

    expect(cookieSet).toHaveBeenCalledWith(
      ORG_COOKIE,
      ORG_ID_B,
      expect.any(Object),
    );
  });
});

// ── getActiveOrgId ────────────────────────────────────────────────────────

describe('getActiveOrgId', () => {
  let cookieGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: no cookie set
    cookieGet = vi.fn().mockReturnValue(undefined);
    vi.mocked(cookies).mockResolvedValue({
      get: cookieGet,
      set: vi.fn(),
      delete: vi.fn(),
      getAll: vi.fn(),
      has: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
  });

  function mockSupabaseWithMemberships(
    memberships: Array<{
      org_id: string;
      role: string;
      organizations: { id: string; name: string; plan: string };
    }> | null,
  ) {
    const orderFn = vi.fn().mockResolvedValue({ data: memberships, error: null });
    const eqFn = vi.fn().mockReturnValue({ order: orderFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });
    return { from: fromFn } as unknown as Parameters<typeof getActiveOrgId>[0];
  }

  it('returns the cookie value when it matches a valid membership', async () => {
    cookieGet.mockReturnValue({ value: ORG_ID_A });

    const supabase = mockSupabaseWithMemberships([
      { org_id: ORG_ID_A, role: 'owner', organizations: { id: ORG_ID_A, name: 'Org A', plan: 'agency' } },
      { org_id: ORG_ID_B, role: 'viewer', organizations: { id: ORG_ID_B, name: 'Org B', plan: 'growth' } },
    ]);

    const result = await getActiveOrgId(supabase, PUBLIC_USER_ID);

    expect(result).toBe(ORG_ID_A);
  });

  it('falls back to first membership when cookie value does not match any org', async () => {
    cookieGet.mockReturnValue({ value: ORG_ID_FOREIGN });

    const supabase = mockSupabaseWithMemberships([
      { org_id: ORG_ID_A, role: 'owner', organizations: { id: ORG_ID_A, name: 'Org A', plan: 'agency' } },
      { org_id: ORG_ID_B, role: 'viewer', organizations: { id: ORG_ID_B, name: 'Org B', plan: 'growth' } },
    ]);

    const result = await getActiveOrgId(supabase, PUBLIC_USER_ID);

    expect(result).toBe(ORG_ID_A);
  });

  it('falls back to first membership when no cookie is set', async () => {
    cookieGet.mockReturnValue(undefined);

    const supabase = mockSupabaseWithMemberships([
      { org_id: ORG_ID_A, role: 'owner', organizations: { id: ORG_ID_A, name: 'Org A', plan: 'agency' } },
    ]);

    const result = await getActiveOrgId(supabase, PUBLIC_USER_ID);

    expect(result).toBe(ORG_ID_A);
  });

  it('returns null when user has no memberships', async () => {
    const supabase = mockSupabaseWithMemberships([]);

    const result = await getActiveOrgId(supabase, PUBLIC_USER_ID);

    expect(result).toBeNull();
  });

  it('returns null when memberships query returns null', async () => {
    const supabase = mockSupabaseWithMemberships(null);

    const result = await getActiveOrgId(supabase, PUBLIC_USER_ID);

    expect(result).toBeNull();
  });
});

// ── getUserOrgs ───────────────────────────────────────────────────────────

describe('getUserOrgs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockSupabaseForGetUserOrgs(
    memberships: Array<{
      org_id: string;
      role: string;
      organizations: { id: string; name: string; plan: string } | null;
    }> | null,
  ) {
    const orderFn = vi.fn().mockResolvedValue({ data: memberships, error: null });
    const eqFn = vi.fn().mockReturnValue({ order: orderFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });
    return { from: fromFn } as unknown as Parameters<typeof getUserOrgs>[0];
  }

  it('returns all orgs the user belongs to with correct roles', async () => {
    const supabase = mockSupabaseForGetUserOrgs([
      { org_id: ORG_ID_A, role: 'owner', organizations: { id: ORG_ID_A, name: 'Org Alpha', plan: 'agency' } },
      { org_id: ORG_ID_B, role: 'viewer', organizations: { id: ORG_ID_B, name: 'Org Beta', plan: 'growth' } },
    ]);

    const result = await getUserOrgs(supabase, PUBLIC_USER_ID);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: ORG_ID_A, name: 'Org Alpha', plan: 'agency', role: 'owner' });
    expect(result[1]).toEqual({ id: ORG_ID_B, name: 'Org Beta', plan: 'growth', role: 'viewer' });
  });

  it('returns empty array when user has no memberships', async () => {
    const supabase = mockSupabaseForGetUserOrgs(null);

    const result = await getUserOrgs(supabase, PUBLIC_USER_ID);

    expect(result).toEqual([]);
  });

  it('defaults plan to "trial" when org plan is null', async () => {
    const supabase = mockSupabaseForGetUserOrgs([
      { org_id: ORG_ID_A, role: 'viewer', organizations: { id: ORG_ID_A, name: 'New Org', plan: null as unknown as string } },
    ]);

    const result = await getUserOrgs(supabase, PUBLIC_USER_ID);

    expect(result).toHaveLength(1);
    expect(result[0].plan).toBe('trial');
  });

  it('filters out memberships where organizations join is null', async () => {
    const supabase = mockSupabaseForGetUserOrgs([
      { org_id: ORG_ID_A, role: 'owner', organizations: { id: ORG_ID_A, name: 'Real Org', plan: 'agency' } },
      { org_id: ORG_ID_B, role: 'viewer', organizations: null },
    ]);

    const result = await getUserOrgs(supabase, PUBLIC_USER_ID);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(ORG_ID_A);
  });
});
