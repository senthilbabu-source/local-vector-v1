// ---------------------------------------------------------------------------
// org-roles.test.ts — Unit tests for Sprint 98 role enforcement library
//
// Tests lib/auth/org-roles.ts:
//   • roleSatisfies() hierarchy logic
//   • ROLE_PERMISSIONS permission matrix
//   • assertOrgRole() async assertion + error throwing
//
// Run:
//   npx vitest run src/__tests__/unit/org-roles.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import {
  roleSatisfies,
  ROLE_HIERARCHY,
  ROLE_PERMISSIONS,
  assertOrgRole,
  getOrgRole,
  InsufficientRoleError,
} from '@/lib/auth/org-roles';

// ── roleSatisfies ─────────────────────────────────────────────────────────

describe('roleSatisfies', () => {
  it('viewer satisfies viewer', () => {
    expect(roleSatisfies('viewer', 'viewer')).toBe(true);
  });

  it('admin satisfies viewer', () => {
    expect(roleSatisfies('admin', 'viewer')).toBe(true);
  });

  it('owner satisfies viewer', () => {
    expect(roleSatisfies('owner', 'viewer')).toBe(true);
  });

  it('admin satisfies admin', () => {
    expect(roleSatisfies('admin', 'admin')).toBe(true);
  });

  it('owner satisfies admin', () => {
    expect(roleSatisfies('owner', 'admin')).toBe(true);
  });

  it('owner satisfies owner', () => {
    expect(roleSatisfies('owner', 'owner')).toBe(true);
  });

  it('viewer does NOT satisfy admin', () => {
    expect(roleSatisfies('viewer', 'admin')).toBe(false);
  });

  it('viewer does NOT satisfy owner', () => {
    expect(roleSatisfies('viewer', 'owner')).toBe(false);
  });

  it('admin does NOT satisfy owner', () => {
    expect(roleSatisfies('admin', 'owner')).toBe(false);
  });

  it('unknown role treated as viewer (level 0)', () => {
    expect(roleSatisfies('banana', 'viewer')).toBe(true);
    expect(roleSatisfies('banana', 'admin')).toBe(false);
  });

  it('null role treated as viewer (level 0)', () => {
    expect(roleSatisfies(null, 'viewer')).toBe(true);
    expect(roleSatisfies(null, 'admin')).toBe(false);
  });

  it('undefined role treated as viewer (level 0)', () => {
    expect(roleSatisfies(undefined, 'viewer')).toBe(true);
    expect(roleSatisfies(undefined, 'admin')).toBe(false);
  });

  it('member treated as viewer (legacy role)', () => {
    expect(ROLE_HIERARCHY['member']).toBe(0);
    expect(ROLE_HIERARCHY['viewer']).toBe(0);
    expect(roleSatisfies('member', 'viewer')).toBe(true);
    expect(roleSatisfies('member', 'admin')).toBe(false);
  });
});

// ── ROLE_PERMISSIONS ──────────────────────────────────────────────────────

describe('ROLE_PERMISSIONS', () => {
  it('viewDashboard requires viewer (lowest)', () => {
    expect(ROLE_PERMISSIONS.viewDashboard).toBe('viewer');
  });

  it('inviteMembers requires admin', () => {
    expect(ROLE_PERMISSIONS.inviteMembers).toBe('admin');
  });

  it('removeMember requires owner', () => {
    expect(ROLE_PERMISSIONS.removeMember).toBe('owner');
  });

  it('manageBilling requires owner', () => {
    expect(ROLE_PERMISSIONS.manageBilling).toBe('owner');
  });

  it('deleteOrg requires owner', () => {
    expect(ROLE_PERMISSIONS.deleteOrg).toBe('owner');
  });

  it('editBusinessInfo requires admin', () => {
    expect(ROLE_PERMISSIONS.editBusinessInfo).toBe('admin');
  });

  it('publishContent requires admin', () => {
    expect(ROLE_PERMISSIONS.publishContent).toBe('admin');
  });

  it('changeRole requires owner', () => {
    expect(ROLE_PERMISSIONS.changeRole).toBe('owner');
  });

  it('revokeInvite requires admin', () => {
    expect(ROLE_PERMISSIONS.revokeInvite).toBe('admin');
  });

  it('triggerAudit requires admin', () => {
    expect(ROLE_PERMISSIONS.triggerAudit).toBe('admin');
  });
});

// ── assertOrgRole ─────────────────────────────────────────────────────────

describe('assertOrgRole', () => {
  const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const USER_ID = 'u0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  function mockSupabase(role: string | null) {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: role ? { role } : null,
      error: null,
    });
    const eq2 = vi.fn().mockReturnValue({ maybeSingle });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    const from = vi.fn().mockReturnValue({ select });
    return { from } as unknown as Parameters<typeof assertOrgRole>[0];
  }

  it('resolves when user meets required role', async () => {
    const supabase = mockSupabase('admin');
    await expect(assertOrgRole(supabase, ORG_ID, USER_ID, 'admin')).resolves.toBeUndefined();
  });

  it('resolves when user exceeds required role', async () => {
    const supabase = mockSupabase('owner');
    await expect(assertOrgRole(supabase, ORG_ID, USER_ID, 'admin')).resolves.toBeUndefined();
  });

  it('throws INSUFFICIENT_ROLE when user is viewer and admin required', async () => {
    const supabase = mockSupabase('viewer');
    await expect(assertOrgRole(supabase, ORG_ID, USER_ID, 'admin')).rejects.toThrow(
      InsufficientRoleError
    );
  });

  it('throws INSUFFICIENT_ROLE when user is not a member (null role)', async () => {
    const supabase = mockSupabase(null);
    await expect(assertOrgRole(supabase, ORG_ID, USER_ID, 'viewer')).rejects.toThrow(
      InsufficientRoleError
    );
  });

  it('includes actual and required role in thrown error', async () => {
    const supabase = mockSupabase('viewer');
    try {
      await assertOrgRole(supabase, ORG_ID, USER_ID, 'owner');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InsufficientRoleError);
      const e = err as InsufficientRoleError;
      expect(e.code).toBe('INSUFFICIENT_ROLE');
      expect(e.required).toBe('owner');
      expect(e.actual).toBe('viewer');
    }
  });

  it('includes null actual when user is not a member', async () => {
    const supabase = mockSupabase(null);
    try {
      await assertOrgRole(supabase, ORG_ID, USER_ID, 'viewer');
      expect.fail('Should have thrown');
    } catch (err) {
      const e = err as InsufficientRoleError;
      expect(e.actual).toBeNull();
    }
  });
});

// ── getOrgRole ────────────────────────────────────────────────────────────

describe('getOrgRole', () => {
  const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const USER_ID = 'u0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  function mockSupabase(role: string | null) {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: role ? { role } : null,
      error: null,
    });
    const eq2 = vi.fn().mockReturnValue({ maybeSingle });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    const from = vi.fn().mockReturnValue({ select });
    return { from } as unknown as Parameters<typeof getOrgRole>[0];
  }

  it('returns role when user is a member', async () => {
    const supabase = mockSupabase('admin');
    expect(await getOrgRole(supabase, ORG_ID, USER_ID)).toBe('admin');
  });

  it('returns null when user is not a member', async () => {
    const supabase = mockSupabase(null);
    expect(await getOrgRole(supabase, ORG_ID, USER_ID)).toBeNull();
  });
});
