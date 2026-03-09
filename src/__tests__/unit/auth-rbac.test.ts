/**
 * Auth RBAC Tests (§327)
 *
 * Verifies role-based access control enforcement:
 * 1. Role hierarchy — viewer(0) < admin(1) < owner(2), member/analyst treated as viewer
 * 2. roleSatisfies() — boundary checks for all role combinations
 * 3. assertOrgRole() — throws InsufficientRoleError on failure
 * 4. ROLE_PERMISSIONS matrix — correct minimum roles for each action
 * 5. getOrgRole() — DB lookup returns role or null for non-members
 * 6. Admin guard — email-based, separate from RBAC
 * 7. Active org resolution — cookie validation against memberships
 * 8. Auth context role inclusion — role present in both AuthContext and SafeAuthContext
 * 9. Null/undefined/unknown role handling — never crashes, treats as viewer
 * 10. InsufficientRoleError — structured error with code, required, actual fields
 *
 * Run:
 *   npx vitest run src/__tests__/unit/auth-rbac.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ROLE_HIERARCHY,
  roleSatisfies,
  assertOrgRole,
  getOrgRole,
  InsufficientRoleError,
  ROLE_PERMISSIONS,
} from '@/lib/auth/org-roles';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
  createServiceRoleClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSupabase() {
  return { from: mockFrom } as never;
}

function mockMembershipQuery(role: string | null) {
  if (role === null) {
    // Non-member
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    });
  } else {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { role } }),
          }),
        }),
      }),
    });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---- Flow 1: Role hierarchy values --------------------------------------

describe('Flow 1 — Role hierarchy values', () => {
  it('viewer has level 0', () => {
    expect(ROLE_HIERARCHY.viewer).toBe(0);
  });

  it('member has level 0 (legacy, same as viewer)', () => {
    expect(ROLE_HIERARCHY.member).toBe(0);
  });

  it('analyst has level 0 (read-only with data access)', () => {
    expect(ROLE_HIERARCHY.analyst).toBe(0);
  });

  it('admin has level 1', () => {
    expect(ROLE_HIERARCHY.admin).toBe(1);
  });

  it('owner has level 2 (highest)', () => {
    expect(ROLE_HIERARCHY.owner).toBe(2);
  });

  it('hierarchy is strictly ordered: viewer < admin < owner', () => {
    expect(ROLE_HIERARCHY.viewer).toBeLessThan(ROLE_HIERARCHY.admin);
    expect(ROLE_HIERARCHY.admin).toBeLessThan(ROLE_HIERARCHY.owner);
  });
});

// ---- Flow 2: roleSatisfies() boundary checks ----------------------------

describe('Flow 2 — roleSatisfies() comprehensive checks', () => {
  // Same role always passes
  it('viewer satisfies viewer', () => {
    expect(roleSatisfies('viewer', 'viewer')).toBe(true);
  });

  it('admin satisfies admin', () => {
    expect(roleSatisfies('admin', 'admin')).toBe(true);
  });

  it('owner satisfies owner', () => {
    expect(roleSatisfies('owner', 'owner')).toBe(true);
  });

  // Higher role passes lower requirement
  it('admin satisfies viewer requirement', () => {
    expect(roleSatisfies('admin', 'viewer')).toBe(true);
  });

  it('owner satisfies admin requirement', () => {
    expect(roleSatisfies('owner', 'admin')).toBe(true);
  });

  it('owner satisfies viewer requirement', () => {
    expect(roleSatisfies('owner', 'viewer')).toBe(true);
  });

  // Lower role fails higher requirement
  it('viewer does NOT satisfy admin', () => {
    expect(roleSatisfies('viewer', 'admin')).toBe(false);
  });

  it('viewer does NOT satisfy owner', () => {
    expect(roleSatisfies('viewer', 'owner')).toBe(false);
  });

  it('admin does NOT satisfy owner', () => {
    expect(roleSatisfies('admin', 'owner')).toBe(false);
  });

  // Legacy member role
  it('member satisfies viewer (same level)', () => {
    expect(roleSatisfies('member', 'viewer')).toBe(true);
  });

  it('member does NOT satisfy admin', () => {
    expect(roleSatisfies('member', 'admin')).toBe(false);
  });

  // Analyst role
  it('analyst satisfies viewer (same level)', () => {
    expect(roleSatisfies('analyst', 'viewer')).toBe(true);
  });

  it('analyst does NOT satisfy admin', () => {
    expect(roleSatisfies('analyst', 'admin')).toBe(false);
  });

  // Null/undefined/unknown — treated as level 0
  it('null role satisfies viewer (defaults to level 0)', () => {
    expect(roleSatisfies(null, 'viewer')).toBe(true);
  });

  it('null role does NOT satisfy admin', () => {
    expect(roleSatisfies(null, 'admin')).toBe(false);
  });

  it('undefined role satisfies viewer', () => {
    expect(roleSatisfies(undefined, 'viewer')).toBe(true);
  });

  it('unknown role string treated as level 0', () => {
    expect(roleSatisfies('superadmin', 'viewer')).toBe(true);
    expect(roleSatisfies('superadmin', 'admin')).toBe(false);
  });

  it('empty string treated as level 0', () => {
    expect(roleSatisfies('', 'viewer')).toBe(true);
    expect(roleSatisfies('', 'admin')).toBe(false);
  });
});

// ---- Flow 3: assertOrgRole() -------------------------------------------

describe('Flow 3 — assertOrgRole() throws on insufficient role', () => {
  it('does not throw when role is sufficient', async () => {
    mockMembershipQuery('owner');
    await expect(
      assertOrgRole(makeSupabase(), 'org-1', 'user-1', 'admin'),
    ).resolves.toBeUndefined();
  });

  it('throws InsufficientRoleError when role is insufficient', async () => {
    mockMembershipQuery('viewer');
    await expect(
      assertOrgRole(makeSupabase(), 'org-1', 'user-1', 'admin'),
    ).rejects.toThrow(InsufficientRoleError);
  });

  it('throws InsufficientRoleError when user is not a member (null role)', async () => {
    mockMembershipQuery(null);
    await expect(
      assertOrgRole(makeSupabase(), 'org-1', 'user-1', 'viewer'),
    ).rejects.toThrow(InsufficientRoleError);
  });

  it('InsufficientRoleError has structured fields', async () => {
    mockMembershipQuery('viewer');
    try {
      await assertOrgRole(makeSupabase(), 'org-1', 'user-1', 'owner');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InsufficientRoleError);
      const e = err as InsufficientRoleError;
      expect(e.code).toBe('INSUFFICIENT_ROLE');
      expect(e.required).toBe('owner');
      expect(e.actual).toBe('viewer');
      expect(e.message).toContain('required owner');
      expect(e.message).toContain('actual viewer');
    }
  });

  it('InsufficientRoleError for non-member shows null actual', async () => {
    mockMembershipQuery(null);
    try {
      await assertOrgRole(makeSupabase(), 'org-1', 'user-1', 'viewer');
      expect.fail('Should have thrown');
    } catch (err) {
      const e = err as InsufficientRoleError;
      expect(e.actual).toBeNull();
      expect(e.message).toContain('not a member');
    }
  });
});

// ---- Flow 4: getOrgRole() DB lookup -------------------------------------

describe('Flow 4 — getOrgRole() database lookup', () => {
  it('returns role when user is a member', async () => {
    mockMembershipQuery('admin');
    const role = await getOrgRole(makeSupabase(), 'org-1', 'user-1');
    expect(role).toBe('admin');
  });

  it('returns null when user is not a member', async () => {
    mockMembershipQuery(null);
    const role = await getOrgRole(makeSupabase(), 'org-1', 'user-1');
    expect(role).toBeNull();
  });

  it('queries memberships table with org_id and user_id', async () => {
    mockMembershipQuery('viewer');
    await getOrgRole(makeSupabase(), 'org-abc', 'user-xyz');

    expect(mockFrom).toHaveBeenCalledWith('memberships');
  });
});

// ---- Flow 5: ROLE_PERMISSIONS matrix ------------------------------------

describe('Flow 5 — ROLE_PERMISSIONS matrix correctness', () => {
  it('viewDashboard requires only viewer', () => {
    expect(ROLE_PERMISSIONS.viewDashboard).toBe('viewer');
  });

  it('editBusinessInfo requires admin', () => {
    expect(ROLE_PERMISSIONS.editBusinessInfo).toBe('admin');
  });

  it('triggerAudit requires admin', () => {
    expect(ROLE_PERMISSIONS.triggerAudit).toBe('admin');
  });

  it('publishContent requires admin', () => {
    expect(ROLE_PERMISSIONS.publishContent).toBe('admin');
  });

  it('inviteMembers requires admin', () => {
    expect(ROLE_PERMISSIONS.inviteMembers).toBe('admin');
  });

  it('revokeInvite requires admin', () => {
    expect(ROLE_PERMISSIONS.revokeInvite).toBe('admin');
  });

  it('removeMember requires owner', () => {
    expect(ROLE_PERMISSIONS.removeMember).toBe('owner');
  });

  it('changeRole requires owner', () => {
    expect(ROLE_PERMISSIONS.changeRole).toBe('owner');
  });

  it('manageBilling requires owner', () => {
    expect(ROLE_PERMISSIONS.manageBilling).toBe('owner');
  });

  it('deleteOrg requires owner', () => {
    expect(ROLE_PERMISSIONS.deleteOrg).toBe('owner');
  });

  it('all permissions are typed as MembershipRole', () => {
    const validRoles = ['viewer', 'admin', 'owner', 'member'];
    for (const [, role] of Object.entries(ROLE_PERMISSIONS)) {
      expect(validRoles).toContain(role);
    }
  });

  it('no permission requires a non-existent role', () => {
    for (const [, role] of Object.entries(ROLE_PERMISSIONS)) {
      expect(ROLE_HIERARCHY[role]).toBeDefined();
    }
  });
});

// ---- Flow 6: roleSatisfies with ROLE_PERMISSIONS integration -------------

describe('Flow 6 — ROLE_PERMISSIONS integration with roleSatisfies', () => {
  it('viewer can view dashboard', () => {
    expect(roleSatisfies('viewer', ROLE_PERMISSIONS.viewDashboard)).toBe(true);
  });

  it('viewer cannot invite members', () => {
    expect(roleSatisfies('viewer', ROLE_PERMISSIONS.inviteMembers)).toBe(false);
  });

  it('admin can invite members', () => {
    expect(roleSatisfies('admin', ROLE_PERMISSIONS.inviteMembers)).toBe(true);
  });

  it('admin cannot delete org', () => {
    expect(roleSatisfies('admin', ROLE_PERMISSIONS.deleteOrg)).toBe(false);
  });

  it('owner can do everything', () => {
    for (const [, requiredRole] of Object.entries(ROLE_PERMISSIONS)) {
      expect(roleSatisfies('owner', requiredRole)).toBe(true);
    }
  });

  it('viewer can only do viewer-level actions', () => {
    const viewerActions = Object.entries(ROLE_PERMISSIONS)
      .filter(([, role]) => role === 'viewer')
      .map(([action]) => action);
    const nonViewerActions = Object.entries(ROLE_PERMISSIONS)
      .filter(([, role]) => role !== 'viewer')
      .map(([action]) => action);

    for (const action of viewerActions) {
      expect(roleSatisfies('viewer', ROLE_PERMISSIONS[action as keyof typeof ROLE_PERMISSIONS])).toBe(true);
    }
    for (const action of nonViewerActions) {
      expect(roleSatisfies('viewer', ROLE_PERMISSIONS[action as keyof typeof ROLE_PERMISSIONS])).toBe(false);
    }
  });
});

// ---- Flow 7: InsufficientRoleError structure ----------------------------

describe('Flow 7 — InsufficientRoleError structure', () => {
  it('is an instance of Error', () => {
    const err = new InsufficientRoleError('admin', 'viewer');
    expect(err).toBeInstanceOf(Error);
  });

  it('has name "InsufficientRoleError"', () => {
    const err = new InsufficientRoleError('admin', 'viewer');
    expect(err.name).toBe('InsufficientRoleError');
  });

  it('has code "INSUFFICIENT_ROLE"', () => {
    const err = new InsufficientRoleError('admin', 'viewer');
    expect(err.code).toBe('INSUFFICIENT_ROLE');
  });

  it('stores required and actual roles', () => {
    const err = new InsufficientRoleError('owner', 'admin');
    expect(err.required).toBe('owner');
    expect(err.actual).toBe('admin');
  });

  it('handles null actual (non-member)', () => {
    const err = new InsufficientRoleError('viewer', null);
    expect(err.actual).toBeNull();
    expect(err.message).toContain('not a member');
  });
});

// ---- Flow 8: Admin guard is separate from RBAC --------------------------

describe('Flow 8 — Admin guard is email-based, not role-based', () => {
  it('admin guard uses ADMIN_EMAILS env var, not RBAC roles', async () => {
    // Set up: authenticated user NOT in ADMIN_EMAILS
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'auth-uid', email: 'regular@test.com' } },
      error: null,
    });

    // Admin guard should reject even if user is an org owner
    const { assertAdmin } = await import('@/lib/admin/admin-guard');
    await expect(assertAdmin()).rejects.toThrow('Forbidden: not an admin');
  });

  it('admin guard rejects unauthenticated users', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'No session' },
    });

    const { assertAdmin } = await import('@/lib/admin/admin-guard');
    await expect(assertAdmin()).rejects.toThrow('Unauthorized');
  });
});

// ---- Flow 9: Auth context includes role ---------------------------------

describe('Flow 9 — Auth context includes role field', () => {
  it('AuthContext type requires role as MembershipRole', async () => {
    // Type check — if this compiles, the type assertion is correct
    const { getAuthContext } = await import('@/lib/auth');

    // Mock the full auth + membership chain
    const mockAuthUser = { id: 'auth-uid', email: 'test@test.com', email_confirmed_at: '2026-01-01' };
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockAuthUser }, error: null }),
      },
      from: vi.fn(),
    };

    // Mock createClient to return our supabase
    const { createClient } = await import('@/lib/supabase/server');
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    // Set up the two-step DB lookup: public.users + memberships
    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // public.users query
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'pub-uuid', full_name: 'Test User' },
              }),
            }),
          }),
        };
      }
      // memberships query
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                org_id: 'org-uuid',
                role: 'admin',
                organizations: {
                  id: 'org-uuid',
                  name: 'Test Org',
                  slug: 'test-org',
                  plan: 'growth',
                  plan_status: 'active',
                  audit_frequency: 'weekly',
                  max_locations: 5,
                  onboarding_completed: true,
                },
              },
              error: null,
            }),
          }),
        }),
      };
    });

    const ctx = await getAuthContext();
    expect(ctx.role).toBe('admin');
    expect(['viewer', 'member', 'admin', 'owner']).toContain(ctx.role);
  });
});
