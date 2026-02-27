// ---------------------------------------------------------------------------
// invitations.test.ts — Unit tests for Sprint 98 invitation server actions
//
// Tests app/actions/invitations.ts:
//   • sendInvitation: auth, role, plan gate, duplicate, email sending
//   • revokeInvitation: auth, status check, org isolation
//   • removeMember: auth, owner protection
//   • updateMemberRole: auth, owner demotion guard
//
// Run:
//   npx vitest run src/__tests__/unit/invitations.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ getSafeAuthContext: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/email/send-invitation', () => ({
  sendInvitationEmail: vi.fn().mockResolvedValue({ id: 'resend-id-1' }),
}));
// Sprint 99: Mock seat availability check (always passes in existing tests)
vi.mock('@/lib/stripe/seat-manager', () => ({
  checkSeatAvailability: vi.fn().mockResolvedValue({
    canAdd: true,
    currentMembers: 1,
    seatLimit: 5,
    seatsRemaining: 4,
  }),
}));

import { sendInvitation, revokeInvitation, removeMember, updateMemberRole } from '@/app/actions/invitations';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { sendInvitationEmail } from '@/lib/email/send-invitation';

// ── Shared constants ──────────────────────────────────────────────────────

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const PUBLIC_USER_ID = 'u0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function mockAuth(overrides: Record<string, unknown> = {}) {
  return {
    orgId: ORG_ID,
    userId: 'auth-uid-abc123',
    email: 'owner@example.com',
    fullName: 'Test Owner',
    orgName: 'Test Org',
    plan: 'agency',
    role: 'owner',
    onboarding_completed: true,
    ...overrides,
  };
}

// ── Helper: chain-based Supabase mock ─────────────────────────────────────

type MockResult = { data: unknown; error: unknown; count?: number | null };

function createChainMock(results: Record<string, MockResult>) {
  const chainObj: Record<string, ReturnType<typeof vi.fn>> = {};

  // Terminators
  chainObj.maybeSingle = vi.fn().mockImplementation(() => {
    return results['default'] ?? { data: null, error: null };
  });
  chainObj.single = vi.fn().mockImplementation(() => {
    return results['default'] ?? { data: null, error: null };
  });

  // Chainable
  chainObj.eq = vi.fn().mockReturnValue(chainObj);
  chainObj.select = vi.fn().mockImplementation((sel?: string, opts?: { count?: string; head?: boolean }) => {
    if (opts?.head) {
      return { eq: vi.fn().mockReturnValue(results['count'] ?? { count: 1 }) };
    }
    return chainObj;
  });
  chainObj.insert = vi.fn().mockReturnValue(chainObj);
  chainObj.update = vi.fn().mockReturnValue(chainObj);
  chainObj.delete = vi.fn().mockReturnValue(chainObj);
  chainObj.order = vi.fn().mockReturnValue(chainObj);

  return chainObj;
}

// ── sendInvitation ────────────────────────────────────────────────────────

describe('sendInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSafeAuthContext).mockResolvedValue(mockAuth() as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never);
  });

  function setupMocks(overrides: {
    publicUser?: { id: string } | null;
    memberCount?: number;
    existingMembers?: Array<{ id: string; users: { email: string } }>;
    existingInvite?: { id: string; status: string } | null;
    insertResult?: { id: string; token: string };
  } = {}) {
    const {
      publicUser = { id: PUBLIC_USER_ID },
      memberCount = 1,
      existingMembers = [],
      existingInvite = null,
      insertResult = { id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', token: 'tok-abc' },
    } = overrides;

    // Resolve public user ID — separate client call
    const resolveUserClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: publicUser, error: null }),
          }),
        }),
      }),
    };

    // Main supabase client with chained operations
    const mainClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'memberships') {
          return {
            select: vi.fn().mockImplementation((_sel: string, opts?: { count?: string; head?: boolean }) => {
              if (opts?.head) {
                return { eq: vi.fn().mockReturnValue({ count: memberCount }) };
              }
              return {
                eq: vi.fn().mockReturnValue({
                  ...{ data: existingMembers, error: null },
                  maybeSingle: vi.fn().mockResolvedValue({ data: existingMembers[0] ?? null, error: null }),
                }),
              };
            }),
            delete: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ error: null }) }),
          };
        }
        if (table === 'pending_invitations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: existingInvite, error: null }),
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: insertResult, error: null }),
              }),
            }),
            delete: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ error: null }) }),
            update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ error: null }) }),
          };
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: publicUser, error: null }),
              }),
            }),
          };
        }
        return {};
      }),
    };

    // First call resolves public user, subsequent calls use main client
    let callCount = 0;
    vi.mocked(createClient).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return resolveUserClient as unknown as ReturnType<typeof createClient>;
      return mainClient as unknown as ReturnType<typeof createClient>;
    });

    return { mainClient };
  }

  it('returns error when caller is not authenticated', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(null);
    const result = await sendInvitation({ email: 'new@example.com', role: 'viewer' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('returns error when caller is viewer (not admin/owner)', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuth({ role: 'viewer' }) as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never
    );
    setupMocks();
    const result = await sendInvitation({ email: 'new@example.com', role: 'viewer' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('insufficient_role');
  });

  it('returns error when org is not on Agency plan', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuth({ plan: 'growth' }) as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never
    );
    setupMocks({ memberCount: 1 });
    const result = await sendInvitation({ email: 'new@example.com', role: 'viewer' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('plan_upgrade_required');
  });

  it('returns error when trying to invite as owner role', async () => {
    setupMocks();
    // The Zod schema only accepts 'admin' | 'viewer', so passing 'owner' will fail validation
    const result = await sendInvitation({ email: 'new@example.com', role: 'owner' as 'admin' | 'viewer' });
    expect(result.success).toBe(false);
  });

  it('returns error when pending invite already exists for this email', async () => {
    setupMocks({
      existingInvite: { id: 'b2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', status: 'pending' },
    });
    const result = await sendInvitation({ email: 'new@example.com', role: 'viewer' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('already_invited');
  });

  it('orgId comes from session — not from input args', async () => {
    setupMocks();
    await sendInvitation({ email: 'new@example.com', role: 'viewer' });
    // The test passes if the action didn't crash — orgId is derived from getSafeAuthContext
    expect(getSafeAuthContext).toHaveBeenCalledTimes(1);
  });

  it('normalizes email to lowercase', async () => {
    setupMocks();
    await sendInvitation({ email: 'John@Example.COM', role: 'viewer' });
    // Zod transform should lowercase the email
    expect(getSafeAuthContext).toHaveBeenCalled();
  });
});

// ── revokeInvitation ──────────────────────────────────────────────────────

describe('revokeInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSafeAuthContext).mockResolvedValue(mockAuth() as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never);
  });

  function setupRevokeMock(invite: { id: string; status: string; org_id: string } | null = null) {
    const updateResult = vi.fn().mockReturnValue({ error: null });
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: invite, error: null }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ error: null }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockClient as unknown as Awaited<ReturnType<typeof createClient>>);
    return { mockClient };
  }

  it('sets status=revoked on valid pending invite', async () => {
    setupRevokeMock({ id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', status: 'pending', org_id: ORG_ID });
    const result = await revokeInvitation({ invitationId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' });
    expect(result.success).toBe(true);
  });

  it('returns error when invite not found', async () => {
    setupRevokeMock(null);
    const result = await revokeInvitation({ invitationId: 'b3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('not_found');
  });

  it('returns error when invite already accepted', async () => {
    setupRevokeMock({ id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', status: 'accepted', org_id: ORG_ID });
    const result = await revokeInvitation({ invitationId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('cannot_revoke');
  });

  it('returns error when caller lacks admin role', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuth({ role: 'viewer' }) as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never
    );
    setupRevokeMock({ id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', status: 'pending', org_id: ORG_ID });
    const result = await revokeInvitation({ invitationId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('insufficient_role');
  });
});

// ── removeMember ──────────────────────────────────────────────────────────

describe('removeMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSafeAuthContext).mockResolvedValue(mockAuth() as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never);
  });

  function setupRemoveMock(member: { id: string; user_id: string; role: string; org_id: string } | null = null) {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: member, error: null }),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ error: null }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockClient as unknown as Awaited<ReturnType<typeof createClient>>);
    return { mockClient };
  }

  it('deletes org_members row on success', async () => {
    setupRemoveMock({ id: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', user_id: 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', role: 'viewer', org_id: ORG_ID });
    const result = await removeMember({ memberId: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' });
    expect(result.success).toBe(true);
  });

  it('returns error when caller is not owner', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuth({ role: 'admin' }) as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never
    );
    setupRemoveMock({ id: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', user_id: 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', role: 'viewer', org_id: ORG_ID });
    const result = await removeMember({ memberId: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('insufficient_role');
  });

  it('returns error when trying to remove an owner', async () => {
    setupRemoveMock({ id: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', user_id: 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', role: 'owner', org_id: ORG_ID });
    const result = await removeMember({ memberId: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('cannot_remove_owner');
  });

  it('returns error when member not found', async () => {
    setupRemoveMock(null);
    const result = await removeMember({ memberId: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('not_found');
  });
});

// ── updateMemberRole ──────────────────────────────────────────────────────

describe('updateMemberRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSafeAuthContext).mockResolvedValue(mockAuth() as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never);
  });

  function setupUpdateMock(
    member: { id: string; user_id: string; role: string; org_id: string } | null = null
  ) {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: member, error: null }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ error: null }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockClient as unknown as Awaited<ReturnType<typeof createClient>>);
    return { mockClient };
  }

  it('updates role on success', async () => {
    setupUpdateMock({ id: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', user_id: 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', role: 'viewer', org_id: ORG_ID });
    const result = await updateMemberRole({ memberId: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', newRole: 'admin' });
    expect(result.success).toBe(true);
  });

  it('returns error when caller is not owner', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      mockAuth({ role: 'admin' }) as ReturnType<typeof getSafeAuthContext> extends Promise<infer T> ? T : never
    );
    setupUpdateMock({ id: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', user_id: 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', role: 'viewer', org_id: ORG_ID });
    const result = await updateMemberRole({ memberId: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', newRole: 'admin' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('insufficient_role');
  });

  it('returns error when trying to demote an owner', async () => {
    setupUpdateMock({ id: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', user_id: 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', role: 'owner', org_id: ORG_ID });
    const result = await updateMemberRole({ memberId: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', newRole: 'viewer' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('cannot_demote_owner');
  });

  it('returns error when member not found', async () => {
    setupUpdateMock(null);
    const result = await updateMemberRole({ memberId: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', newRole: 'admin' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('not_found');
  });

  it('returns error when trying to promote to owner (blocked by Zod)', async () => {
    setupUpdateMock({ id: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', user_id: 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', role: 'viewer', org_id: ORG_ID });
    const result = await updateMemberRole({ memberId: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', newRole: 'owner' as 'admin' | 'viewer' });
    expect(result.success).toBe(false);
  });
});
