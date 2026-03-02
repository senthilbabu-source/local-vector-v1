/**
 * Membership Service Tests — Sprint 111
 *
 * 30 tests covering:
 * - getMaxSeats (pure, from plan-enforcer)
 * - canAddMember (pure, from plan-enforcer)
 * - ROLE_PERMISSIONS (pure object checks)
 * - getOrgMembers (Supabase mocked)
 * - getCallerMembership (Supabase mocked)
 * - getMemberById (Supabase mocked)
 * - removeMember (Supabase mocked)
 * - canAddMemberCheck (Supabase mocked)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMaxSeats, canAddMember } from '@/lib/plan-enforcer';
import { ROLE_PERMISSIONS, SEAT_LIMITS } from '@/lib/membership/types';
import {
  getOrgMembers,
  getCallerMembership,
  getMemberById,
  removeMember,
  canAddMemberCheck,
  MembershipError,
} from '@/lib/membership/membership-service';
import {
  MOCK_ORG_MEMBER_OWNER,
  MOCK_ORG_MEMBER_ADMIN,
  MOCK_ORG_MEMBER_ANALYST,
  MOCK_MEMBERS_LIST,
} from '@/__fixtures__/golden-tenant';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Supabase mock helper
// ---------------------------------------------------------------------------

function buildChainMock(resolvedValue: { data: unknown; error: unknown } = { data: null, error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;

  for (const method of [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'not',
    'filter', 'order', 'limit', 'range', 'match',
  ]) {
    chain[method] = vi.fn(self);
  }
  chain.single = vi.fn().mockResolvedValue(resolvedValue);
  chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  return chain;
}

function createMockSupabase(chainOverride?: ReturnType<typeof buildChainMock>) {
  const chain = chainOverride ?? buildChainMock();
  return {
    from: vi.fn(() => chain),
  } as unknown as SupabaseClient<Database>;
}

// ═══════════════════════════════════════════════════════════════════════════
// PURE FUNCTION TESTS — no mocks needed
// ═══════════════════════════════════════════════════════════════════════════

describe('getMaxSeats — pure (from plan-enforcer)', () => {
  it('trial → 1', () => {
    expect(getMaxSeats('trial')).toBe(1);
  });

  it('starter → 1', () => {
    expect(getMaxSeats('starter')).toBe(1);
  });

  it('growth → 1', () => {
    expect(getMaxSeats('growth')).toBe(1);
  });

  it('agency → 10', () => {
    expect(getMaxSeats('agency')).toBe(10);
  });

  it('unknown plan → 1 (safe default)', () => {
    expect(getMaxSeats('enterprise')).toBe(1);
  });
});

describe('canAddMember — pure (from plan-enforcer)', () => {
  it('agency plan, 0 current seats → true', () => {
    expect(canAddMember('agency', 0)).toBe(true);
  });

  it('agency plan, 9 current seats → true', () => {
    expect(canAddMember('agency', 9)).toBe(true);
  });

  it('agency plan, 10 current seats → false (at limit)', () => {
    expect(canAddMember('agency', 10)).toBe(false);
  });

  it('growth plan, 0 current seats → true', () => {
    expect(canAddMember('growth', 0)).toBe(true);
  });

  it('growth plan, 1 current seat → false (at limit)', () => {
    expect(canAddMember('growth', 1)).toBe(false);
  });

  it('trial plan, 1 seat → false', () => {
    expect(canAddMember('trial', 1)).toBe(false);
  });
});

describe('ROLE_PERMISSIONS — pure object checks', () => {
  it('owner.canManageBilling === true', () => {
    expect(ROLE_PERMISSIONS.owner.canManageBilling).toBe(true);
  });

  it('admin.canManageBilling === false', () => {
    expect(ROLE_PERMISSIONS.admin.canManageBilling).toBe(false);
  });

  it('analyst.canEditContent === false', () => {
    expect(ROLE_PERMISSIONS.analyst.canEditContent).toBe(false);
  });

  it('viewer.canEditContent === false', () => {
    expect(ROLE_PERMISSIONS.viewer.canEditContent).toBe(false);
  });

  it('owner.canDeleteOrg === true', () => {
    expect(ROLE_PERMISSIONS.owner.canDeleteOrg).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUPABASE-MOCKED TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('getOrgMembers — Supabase mocked', () => {
  it('returns members sorted: owner first, then admin, then analyst', async () => {
    const mockData = [
      {
        id: MOCK_ORG_MEMBER_ANALYST.id,
        org_id: MOCK_ORG_MEMBER_ANALYST.org_id,
        user_id: MOCK_ORG_MEMBER_ANALYST.user_id,
        role: 'analyst',
        joined_at: '2026-02-15T00:00:00.000Z',
        created_at: '2026-02-15T00:00:00.000Z',
        users: { id: MOCK_ORG_MEMBER_ANALYST.user_id, email: 'analyst@charcoalnchill.com', full_name: 'Test Analyst' },
      },
      {
        id: MOCK_ORG_MEMBER_OWNER.id,
        org_id: MOCK_ORG_MEMBER_OWNER.org_id,
        user_id: MOCK_ORG_MEMBER_OWNER.user_id,
        role: 'owner',
        joined_at: '2026-01-01T00:00:00.000Z',
        created_at: '2026-01-01T00:00:00.000Z',
        users: { id: MOCK_ORG_MEMBER_OWNER.user_id, email: 'dev@localvector.ai', full_name: 'Dev User' },
      },
      {
        id: MOCK_ORG_MEMBER_ADMIN.id,
        org_id: MOCK_ORG_MEMBER_ADMIN.org_id,
        user_id: MOCK_ORG_MEMBER_ADMIN.user_id,
        role: 'admin',
        joined_at: '2026-02-01T00:00:00.000Z',
        created_at: '2026-02-01T00:00:00.000Z',
        users: { id: MOCK_ORG_MEMBER_ADMIN.user_id, email: 'admin@charcoalnchill.com', full_name: 'Test Admin' },
      },
    ];

    const chain = buildChainMock({ data: mockData, error: null });
    const supabase = createMockSupabase(chain);

    // Override order to return the data as-is (pre-chained)
    chain.order = vi.fn().mockResolvedValue({ data: mockData, error: null });

    const members = await getOrgMembers(supabase, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

    expect(members).toHaveLength(3);
    expect(members[0].role).toBe('owner');
    expect(members[1].role).toBe('admin');
    expect(members[2].role).toBe('analyst');
  });

  it('returns empty array when no members found', async () => {
    const chain = buildChainMock({ data: null, error: { message: 'not found' } });
    chain.order = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } });
    const supabase = createMockSupabase(chain);

    const members = await getOrgMembers(supabase, 'nonexistent-org');
    expect(members).toEqual([]);
  });
});

describe('getCallerMembership — Supabase mocked', () => {
  it('returns MembershipContext with correct role for authenticated user', async () => {
    const chain = buildChainMock({
      data: {
        id: MOCK_ORG_MEMBER_OWNER.id,
        org_id: MOCK_ORG_MEMBER_OWNER.org_id,
        user_id: MOCK_ORG_MEMBER_OWNER.user_id,
        role: 'owner',
      },
      error: null,
    });
    const supabase = createMockSupabase(chain);

    const ctx = await getCallerMembership(supabase, MOCK_ORG_MEMBER_OWNER.user_id);

    expect(ctx).not.toBeNull();
    expect(ctx!.role).toBe('owner');
    expect(ctx!.permissions.canManageBilling).toBe(true);
  });

  it('returns null when user has no org membership', async () => {
    const chain = buildChainMock({ data: null, error: null });
    const supabase = createMockSupabase(chain);

    const ctx = await getCallerMembership(supabase, 'nonexistent-user');
    expect(ctx).toBeNull();
  });
});

describe('getMemberById — Supabase mocked', () => {
  it('returns OrgMember when found', async () => {
    const chain = buildChainMock({
      data: {
        id: MOCK_ORG_MEMBER_ADMIN.id,
        org_id: MOCK_ORG_MEMBER_ADMIN.org_id,
        user_id: MOCK_ORG_MEMBER_ADMIN.user_id,
        role: 'admin',
        joined_at: '2026-02-01T00:00:00.000Z',
        created_at: '2026-02-01T00:00:00.000Z',
        users: { id: MOCK_ORG_MEMBER_ADMIN.user_id, email: 'admin@charcoalnchill.com', full_name: 'Test Admin' },
      },
      error: null,
    });
    const supabase = createMockSupabase(chain);

    const member = await getMemberById(supabase, MOCK_ORG_MEMBER_ADMIN.id);
    expect(member).not.toBeNull();
    expect(member!.role).toBe('admin');
    expect(member!.email).toBe('admin@charcoalnchill.com');
  });

  it('returns null when member not found', async () => {
    const chain = buildChainMock({ data: null, error: null });
    const supabase = createMockSupabase(chain);

    const member = await getMemberById(supabase, 'nonexistent-id');
    expect(member).toBeNull();
  });
});

describe('removeMember — Supabase mocked', () => {
  it('throws member_not_found when member does not exist', async () => {
    const chain = buildChainMock({ data: null, error: null });
    const supabase = createMockSupabase(chain);

    await expect(
      removeMember(supabase, 'nonexistent-id', 'some-org')
    ).rejects.toThrow(MembershipError);

    try {
      await removeMember(supabase, 'nonexistent-id', 'some-org');
    } catch (err) {
      expect((err as MembershipError).code).toBe('member_not_found');
    }
  });

  it('throws cannot_remove_owner when target role is owner', async () => {
    const chain = buildChainMock({
      data: { id: 'mem-1', role: 'owner', org_id: 'org-1' },
      error: null,
    });
    const supabase = createMockSupabase(chain);

    await expect(
      removeMember(supabase, 'mem-1', 'org-1')
    ).rejects.toThrow(MembershipError);

    try {
      await removeMember(supabase, 'mem-1', 'org-1');
    } catch (err) {
      expect((err as MembershipError).code).toBe('cannot_remove_owner');
    }
  });

  it('calls DELETE on memberships when all guards pass', async () => {
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const chain = buildChainMock({
      data: { id: 'mem-2', role: 'admin', org_id: 'org-1', user_id: 'user-2', users: { email: 'admin@test.com' } },
      error: null,
    });

    const orgChain = buildChainMock({
      data: { seat_count: 1 },
      error: null,
    });

    // Calls: 1=memberships SELECT, 2=memberships DELETE, 3=organizations SELECT
    let callCount = 0;
    const supabase = {
      from: vi.fn(() => {
        callCount++;
        if (callCount === 1) return chain; // SELECT member
        if (callCount === 2) return { delete: mockDelete }; // DELETE
        return orgChain; // SELECT organizations seat_count
      }),
    } as unknown as SupabaseClient<Database>;

    const result = await removeMember(supabase, 'mem-2', 'org-1');
    expect(result.success).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
  });

  it('returns { success: true } on successful removal', async () => {
    let callCount = 0;
    const chain = buildChainMock({
      data: { id: 'mem-3', role: 'viewer', org_id: 'org-1', user_id: 'user-3', users: { email: 'viewer@test.com' } },
      error: null,
    });
    const deleteChain = {
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };
    const orgChain = buildChainMock({
      data: { seat_count: 1 },
      error: null,
    });

    const supabase = {
      from: vi.fn(() => {
        callCount++;
        if (callCount === 1) return chain; // SELECT member
        if (callCount === 2) return deleteChain; // DELETE
        return orgChain; // SELECT organizations seat_count
      }),
    } as unknown as SupabaseClient<Database>;

    const result = await removeMember(supabase, 'mem-3', 'org-1');
    expect(result).toEqual({ success: true });
  });
});

describe('canAddMemberCheck (service) — Supabase mocked', () => {
  it('returns { allowed: false, current: 1, max: 1 } for growth plan with 1 member', async () => {
    const chain = buildChainMock({
      data: { plan: 'growth', seat_count: 1 },
      error: null,
    });
    const supabase = createMockSupabase(chain);

    const result = await canAddMemberCheck(supabase, 'org-1');
    expect(result.allowed).toBe(false);
    expect(result.current).toBe(1);
    expect(result.max).toBe(1);
  });

  it('returns { allowed: true, current: 3, max: 10 } for agency plan with 3 members', async () => {
    const chain = buildChainMock({
      data: { plan: 'agency', seat_count: 3 },
      error: null,
    });
    const supabase = createMockSupabase(chain);

    const result = await canAddMemberCheck(supabase, 'org-1');
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(3);
    expect(result.max).toBe(10);
  });

  it('returns { allowed: false, current: 10, max: 10 } for agency plan at limit', async () => {
    const chain = buildChainMock({
      data: { plan: 'agency', seat_count: 10 },
      error: null,
    });
    const supabase = createMockSupabase(chain);

    const result = await canAddMemberCheck(supabase, 'org-1');
    expect(result.allowed).toBe(false);
    expect(result.current).toBe(10);
    expect(result.max).toBe(10);
  });
});
