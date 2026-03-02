/**
 * Membership Routes Tests — Sprint 111
 *
 * 12 tests covering:
 * - GET /api/team/members (5 tests)
 * - DELETE /api/team/members/[memberId] (7 tests)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — hoisted before module imports
// ---------------------------------------------------------------------------

const { mockGetSafeAuthContext, mockFrom, mockServiceFrom } = vi.hoisted(() => ({
  mockGetSafeAuthContext: vi.fn(),
  mockFrom: vi.fn(),
  mockServiceFrom: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
  createServiceRoleClient: vi.fn(() => ({ from: mockServiceFrom })),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

vi.mock('@/lib/auth/org-roles', () => ({
  roleSatisfies: vi.fn((current: string | null, required: string) => {
    const hierarchy: Record<string, number> = { viewer: 0, member: 0, analyst: 0, admin: 1, owner: 2 };
    return (hierarchy[current ?? ''] ?? 0) >= (hierarchy[required] ?? 0);
  }),
}));

// Import routes after mocks
import { GET } from '@/app/api/team/members/route';
import { DELETE } from '@/app/api/team/members/[memberId]/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockAuthCtx(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'auth-uid-001',
    email: 'dev@localvector.ai',
    fullName: 'Dev User',
    orgId: 'org-001',
    orgName: 'Test Org',
    role: 'owner',
    plan: 'agency',
    onboarding_completed: true,
    ...overrides,
  };
}

function buildServiceChain(resolvedValue: { data: unknown; error: unknown } = { data: null, error: null }) {
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

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/team/members
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/team/members', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('unauthenticated');
  });

  it('returns members, seat_count, max_seats, can_add on success', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx());

    const memberData = [
      {
        id: 'mem-1', org_id: 'org-001', user_id: 'user-1', role: 'owner',
        joined_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z',
        users: { id: 'user-1', email: 'owner@test.com', full_name: 'Owner' },
      },
    ];

    let callNum = 0;
    mockServiceFrom.mockImplementation((table: string) => {
      callNum++;
      if (table === 'memberships') {
        const chain = buildServiceChain({ data: memberData, error: null });
        chain.order = vi.fn().mockResolvedValue({ data: memberData, error: null });
        return chain;
      }
      if (table === 'organizations') {
        return buildServiceChain({ data: { plan: 'agency', seat_count: 1 }, error: null });
      }
      return buildServiceChain();
    });

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.members).toHaveLength(1);
    expect(body.seat_count).toBe(1);
    expect(body.max_seats).toBe(10);
    expect(body.can_add).toBe(true);
  });

  it('members array sorted owner-first', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx());

    const memberData = [
      {
        id: 'mem-2', org_id: 'org-001', user_id: 'user-2', role: 'admin',
        joined_at: '2026-02-01T00:00:00Z', created_at: '2026-02-01T00:00:00Z',
        users: { id: 'user-2', email: 'admin@test.com', full_name: 'Admin' },
      },
      {
        id: 'mem-1', org_id: 'org-001', user_id: 'user-1', role: 'owner',
        joined_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z',
        users: { id: 'user-1', email: 'owner@test.com', full_name: 'Owner' },
      },
    ];

    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'memberships') {
        const chain = buildServiceChain({ data: memberData, error: null });
        chain.order = vi.fn().mockResolvedValue({ data: memberData, error: null });
        return chain;
      }
      if (table === 'organizations') {
        return buildServiceChain({ data: { plan: 'agency', seat_count: 2 }, error: null });
      }
      return buildServiceChain();
    });

    const response = await GET();
    const body = await response.json();
    expect(body.members[0].role).toBe('owner');
    expect(body.members[1].role).toBe('admin');
  });

  it('can_add = false for growth plan', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx({ plan: 'growth' }));

    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'memberships') {
        const chain = buildServiceChain({ data: [], error: null });
        chain.order = vi.fn().mockResolvedValue({ data: [], error: null });
        return chain;
      }
      if (table === 'organizations') {
        return buildServiceChain({ data: { plan: 'growth', seat_count: 1 }, error: null });
      }
      return buildServiceChain();
    });

    const response = await GET();
    const body = await response.json();
    expect(body.can_add).toBe(false);
  });

  it('can_add = true for agency plan with < 10 seats', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx());

    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'memberships') {
        const chain = buildServiceChain({ data: [], error: null });
        chain.order = vi.fn().mockResolvedValue({ data: [], error: null });
        return chain;
      }
      if (table === 'organizations') {
        return buildServiceChain({ data: { plan: 'agency', seat_count: 5 }, error: null });
      }
      return buildServiceChain();
    });

    const response = await GET();
    const body = await response.json();
    expect(body.can_add).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/team/members/[memberId]
// ═══════════════════════════════════════════════════════════════════════════

function makeDeleteRequest(memberId: string) {
  return new Request(`http://localhost:3000/api/team/members/${memberId}`, {
    method: 'DELETE',
  }) as unknown as Parameters<typeof DELETE>[0];
}

describe('DELETE /api/team/members/[memberId]', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const response = await DELETE(
      makeDeleteRequest('mem-1'),
      { params: Promise.resolve({ memberId: 'mem-1' }) }
    );
    expect(response.status).toBe(401);
  });

  it('returns 403 insufficient_role when caller is viewer', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx({ role: 'viewer' }));
    const response = await DELETE(
      makeDeleteRequest('mem-1'),
      { params: Promise.resolve({ memberId: 'mem-1' }) }
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('insufficient_role');
  });

  it('returns 403 insufficient_role when caller is analyst', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx({ role: 'analyst' }));
    const response = await DELETE(
      makeDeleteRequest('mem-1'),
      { params: Promise.resolve({ memberId: 'mem-1' }) }
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('insufficient_role');
  });

  it('returns 404 member_not_found when memberId not in org', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx({ role: 'owner' }));

    mockServiceFrom.mockImplementation(() => {
      return buildServiceChain({ data: null, error: null });
    });

    const response = await DELETE(
      makeDeleteRequest('nonexistent'),
      { params: Promise.resolve({ memberId: 'nonexistent' }) }
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('member_not_found');
  });

  it('returns 403 cannot_remove_owner when target is owner', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx({ role: 'owner' }));

    mockServiceFrom.mockImplementation(() => {
      return buildServiceChain({
        data: { id: 'mem-owner', role: 'owner', user_id: 'other-user', org_id: 'org-001' },
        error: null,
      });
    });

    const response = await DELETE(
      makeDeleteRequest('mem-owner'),
      { params: Promise.resolve({ memberId: 'mem-owner' }) }
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('cannot_remove_owner');
  });

  it('returns { ok: true } when all guards pass', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx({ role: 'owner' }));

    let callCount = 0;
    mockServiceFrom.mockImplementation((table: string) => {
      callCount++;
      if (callCount === 1) {
        // First call: SELECT to check target member
        return buildServiceChain({
          data: { id: 'mem-admin', role: 'admin', user_id: 'user-admin', org_id: 'org-001' },
          error: null,
        });
      }
      // Subsequent calls: removeMember internals (SELECT then DELETE)
      if (callCount === 2) {
        return buildServiceChain({
          data: { id: 'mem-admin', role: 'admin', org_id: 'org-001' },
          error: null,
        });
      }
      // DELETE call
      const deleteChain = buildServiceChain({ data: null, error: null });
      deleteChain.delete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      return deleteChain;
    });

    const response = await DELETE(
      makeDeleteRequest('mem-admin'),
      { params: Promise.resolve({ memberId: 'mem-admin' }) }
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  it('does NOT call DELETE if target is owner', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx({ role: 'owner' }));

    const mockDeleteFn = vi.fn();
    mockServiceFrom.mockImplementation(() => {
      const chain = buildServiceChain({
        data: { id: 'mem-owner', role: 'owner', user_id: 'owner-user', org_id: 'org-001' },
        error: null,
      });
      chain.delete = mockDeleteFn;
      return chain;
    });

    await DELETE(
      makeDeleteRequest('mem-owner'),
      { params: Promise.resolve({ memberId: 'mem-owner' }) }
    );
    expect(mockDeleteFn).not.toHaveBeenCalled();
  });
});
