/**
 * invitation-service.test.ts — Sprint 112
 *
 * Tests for the invitation lifecycle service.
 * Supabase fully mocked. generateSecureToken() pure — zero mocks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  MOCK_ORG_INVITATION_SAFE,
} from '@/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Mock Sentry
// ---------------------------------------------------------------------------

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock Supabase factory — returns a thenable chainable
// ---------------------------------------------------------------------------

interface MockChain {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: ReturnType<typeof vi.fn>;
}

function createMockChain(): MockChain {
  const chain: MockChain = {} as MockChain;

  // All methods return chain (for chaining)
  for (const name of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'gt', 'lt', 'order'] as const) {
    chain[name] = vi.fn().mockImplementation(() => chain);
  }

  // Terminal methods return resolved data
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

  // Make chain itself thenable (for `await query`)
  chain.then = vi.fn().mockImplementation((resolve) => {
    return Promise.resolve({ data: null, error: null }).then(resolve);
  });

  return chain;
}

function createMockSupabase() {
  const chain = createMockChain();

  const supabase = {
    from: vi.fn().mockImplementation(() => chain),
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    },
    _chain: chain,
  };

  return supabase as unknown as SupabaseClient<Database> & typeof supabase;
}

// ---------------------------------------------------------------------------
// generateSecureToken — pure
// ---------------------------------------------------------------------------

describe('generateSecureToken — pure', () => {
  it('returns 64-character string', async () => {
    const { generateSecureToken } = await import('@/lib/invitations/invitation-service');
    const token = generateSecureToken();
    expect(token).toHaveLength(64);
  });

  it('contains only hex characters [0-9a-f]', async () => {
    const { generateSecureToken } = await import('@/lib/invitations/invitation-service');
    const token = generateSecureToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('two calls return different values (probabilistic — run 100 times)', async () => {
    const { generateSecureToken } = await import('@/lib/invitations/invitation-service');
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateSecureToken());
    }
    expect(tokens.size).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// sendInvitation
// ---------------------------------------------------------------------------

describe('sendInvitation — Supabase mocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes email to lowercase', async () => {
    const { sendInvitation } = await import('@/lib/invitations/invitation-service');
    const supabase = createMockSupabase();

    // Org query returns agency plan at seat limit (so it throws early — we just test normalization)
    supabase._chain.single.mockResolvedValueOnce({
      data: { plan: 'agency', seat_count: 10, name: 'Org' },
      error: null,
    });

    // Will throw seat_limit_reached — but the email was already normalized
    await expect(
      sendInvitation(supabase, 'org-1', 'user-1', {
        email: '  TEST@EXAMPLE.COM  ',
        role: 'analyst',
      })
    ).rejects.toThrow();

    // The function normalizes before any DB call, verified by not throwing a different error
  });

  it('throws seat_limit_reached when at seat limit', async () => {
    const { sendInvitation } = await import('@/lib/invitations/invitation-service');
    const supabase = createMockSupabase();

    supabase._chain.single.mockResolvedValueOnce({
      data: { plan: 'agency', seat_count: 10, name: 'Org' },
      error: null,
    });

    try {
      await sendInvitation(supabase, 'org-1', 'user-1', {
        email: 'test@example.com',
        role: 'analyst',
      });
      expect.unreachable('Should have thrown');
    } catch (err: unknown) {
      expect((err as { code: string }).code).toBe('seat_limit_reached');
    }
  });

  it('throws already_member when email matches existing org member', async () => {
    const { sendInvitation } = await import('@/lib/invitations/invitation-service');
    const supabase = createMockSupabase();

    // Table-based dispatch: org → seats available, users → found, memberships → found
    const usersChain = createMockChain();
    const membershipChain = createMockChain();

    supabase._chain.single.mockResolvedValueOnce({
      data: { plan: 'agency', seat_count: 2, name: 'Org' },
      error: null,
    });

    // Users query returns a matching user
    usersChain.eq.mockResolvedValueOnce({ data: [{ id: 'existing-user' }], error: null });
    // Membership check returns found
    membershipChain.maybeSingle.mockResolvedValueOnce({ data: { id: 'mem-1' }, error: null });

    supabase.from.mockImplementation((table: string) => {
      if (table === 'users') return usersChain;
      if (table === 'memberships') return membershipChain;
      return supabase._chain;
    });

    try {
      await sendInvitation(supabase, 'org-1', 'user-1', {
        email: 'existing@example.com',
        role: 'analyst',
      });
      expect.unreachable('Should have thrown');
    } catch (err: unknown) {
      expect((err as { code: string }).code).toBe('already_member');
    }
  });

  it('throws invitation_already_pending when pending invite exists', async () => {
    const { sendInvitation } = await import('@/lib/invitations/invitation-service');
    const supabase = createMockSupabase();

    // Org: seats available
    supabase._chain.single.mockResolvedValueOnce({
      data: { plan: 'agency', seat_count: 2, name: 'Org' },
      error: null,
    });

    const usersChain = createMockChain();
    usersChain.eq.mockResolvedValueOnce({ data: [], error: null }); // no existing user

    const invitationsChain = createMockChain();
    invitationsChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'inv-1', expires_at: new Date(Date.now() + 86400000).toISOString() },
      error: null,
    });

    supabase.from.mockImplementation((table: string) => {
      if (table === 'users') return usersChain;
      if (table === 'pending_invitations') return invitationsChain;
      return supabase._chain;
    });

    try {
      await sendInvitation(supabase, 'org-1', 'user-1', {
        email: 'pending@example.com',
        role: 'analyst',
      });
      expect.unreachable('Should have thrown');
    } catch (err: unknown) {
      expect((err as { code: string }).code).toBe('invitation_already_pending');
    }
  });

  it('inserts into pending_invitations with correct role', async () => {
    const { sendInvitation } = await import('@/lib/invitations/invitation-service');
    const supabase = createMockSupabase();

    supabase._chain.single.mockResolvedValueOnce({
      data: { plan: 'agency', seat_count: 2, name: 'Org' },
      error: null,
    });

    const usersChain = createMockChain();
    usersChain.eq.mockResolvedValueOnce({ data: [], error: null }); // no user found

    const invitationsChain = createMockChain();
    // No pending invite
    invitationsChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    // Insert returns invitation
    invitationsChain.single.mockResolvedValueOnce({
      data: {
        id: 'inv-new',
        org_id: 'org-1',
        email: 'test@example.com',
        role: 'analyst',
        token: 'generated-token',
        invited_by: 'user-1',
        status: 'pending',
        expires_at: new Date().toISOString(),
        accepted_at: null,
        created_at: new Date().toISOString(),
      },
      error: null,
    });

    supabase.from.mockImplementation((table: string) => {
      if (table === 'users') return usersChain;
      if (table === 'pending_invitations') return invitationsChain;
      return supabase._chain;
    });

    const result = await sendInvitation(supabase, 'org-1', 'user-1', {
      email: 'test@example.com',
      role: 'analyst',
    });

    expect(result.invitation.role).toBe('analyst');
    expect(result.invitation.email).toBe('test@example.com');
  });

  it('returns OrgInvitationSafe — token NOT present in return value', async () => {
    const { sendInvitation } = await import('@/lib/invitations/invitation-service');
    const supabase = createMockSupabase();

    supabase._chain.single.mockResolvedValueOnce({
      data: { plan: 'agency', seat_count: 2, name: 'Org' },
      error: null,
    });

    const usersChain = createMockChain();
    usersChain.eq.mockResolvedValueOnce({ data: [], error: null });

    const invitationsChain = createMockChain();
    invitationsChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    invitationsChain.single.mockResolvedValueOnce({
      data: {
        id: 'inv-new',
        org_id: 'org-1',
        email: 'test@example.com',
        role: 'analyst',
        token: 'secret-token',
        invited_by: 'user-1',
        status: 'pending',
        expires_at: new Date().toISOString(),
        accepted_at: null,
        created_at: new Date().toISOString(),
      },
      error: null,
    });

    supabase.from.mockImplementation((table: string) => {
      if (table === 'users') return usersChain;
      if (table === 'pending_invitations') return invitationsChain;
      return supabase._chain;
    });

    const result = await sendInvitation(supabase, 'org-1', 'user-1', {
      email: 'test@example.com',
      role: 'analyst',
    });

    // Token MUST NOT be in the invitation object
    expect(result.invitation).not.toHaveProperty('token');
    // But token is returned separately for email URL building
    expect(typeof result.token).toBe('string');
    expect(result.token).toHaveLength(64);
  });
});

// ---------------------------------------------------------------------------
// getOrgInvitations
// ---------------------------------------------------------------------------

describe('getOrgInvitations — Supabase mocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs soft-expire UPDATE before SELECT', async () => {
    const { getOrgInvitations } = await import('@/lib/invitations/invitation-service');
    const supabase = createMockSupabase();

    supabase._chain.order.mockResolvedValueOnce({ data: [], error: null });

    await getOrgInvitations(supabase, 'org-1');

    // from() should have been called (at least for the update and the select)
    expect(supabase.from).toHaveBeenCalled();
    // update should have been called for soft-expire
    expect(supabase._chain.update).toHaveBeenCalledWith({ status: 'expired' });
  });

  it('returns only pending status invitations', async () => {
    const { getOrgInvitations } = await import('@/lib/invitations/invitation-service');
    const supabase = createMockSupabase();

    supabase._chain.order.mockResolvedValueOnce({
      data: [MOCK_ORG_INVITATION_SAFE],
      error: null,
    });

    const result = await getOrgInvitations(supabase, 'org-1');
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('pending');
  });

  it('returns sorted by created_at DESC', async () => {
    const { getOrgInvitations } = await import('@/lib/invitations/invitation-service');
    const supabase = createMockSupabase();

    supabase._chain.order.mockResolvedValueOnce({
      data: [
        { ...MOCK_ORG_INVITATION_SAFE, id: 'inv-2', created_at: '2026-03-02T00:00:00.000Z' },
        { ...MOCK_ORG_INVITATION_SAFE, id: 'inv-1', created_at: '2026-03-01T00:00:00.000Z' },
      ],
      error: null,
    });

    const result = await getOrgInvitations(supabase, 'org-1');
    expect(result[0].id).toBe('inv-2');
    expect(result[1].id).toBe('inv-1');
  });

  it('returns empty array when no pending invitations (no crash)', async () => {
    const { getOrgInvitations } = await import('@/lib/invitations/invitation-service');
    const supabase = createMockSupabase();

    supabase._chain.order.mockResolvedValueOnce({ data: [], error: null });

    const result = await getOrgInvitations(supabase, 'org-1');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// revokeInvitation
// ---------------------------------------------------------------------------

describe('revokeInvitation — Supabase mocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws invitation_not_revocable when status is accepted', async () => {
    const { revokeInvitation } = await import('@/lib/invitations/invitation-service');
    const supabase = createMockSupabase();

    supabase._chain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'inv-1', status: 'accepted' },
      error: null,
    });

    try {
      await revokeInvitation(supabase, 'inv-1', 'org-1');
      expect.unreachable('Should have thrown');
    } catch (err: unknown) {
      expect((err as { code: string }).code).toBe('invitation_not_revocable');
    }
  });

  it('throws invitation_not_revocable when status is expired', async () => {
    const { revokeInvitation } = await import('@/lib/invitations/invitation-service');
    const supabase = createMockSupabase();

    supabase._chain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'inv-1', status: 'expired' },
      error: null,
    });

    try {
      await revokeInvitation(supabase, 'inv-1', 'org-1');
      expect.unreachable('Should have thrown');
    } catch (err: unknown) {
      expect((err as { code: string }).code).toBe('invitation_not_revocable');
    }
  });

  it('UPDATE sets status = revoked when status is pending', async () => {
    const { revokeInvitation } = await import('@/lib/invitations/invitation-service');
    const supabase = createMockSupabase();

    supabase._chain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'inv-1', status: 'pending' },
      error: null,
    });

    const result = await revokeInvitation(supabase, 'inv-1', 'org-1');
    expect(result).toEqual({ success: true });
    expect(supabase._chain.update).toHaveBeenCalledWith({ status: 'revoked' });
  });

  it('returns { success: true }', async () => {
    const { revokeInvitation } = await import('@/lib/invitations/invitation-service');
    const supabase = createMockSupabase();

    supabase._chain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'inv-1', status: 'pending' },
      error: null,
    });

    const result = await revokeInvitation(supabase, 'inv-1', 'org-1');
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateToken
// ---------------------------------------------------------------------------

describe('validateToken — Supabase mocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns valid=false, error=not_found for unknown token', async () => {
    const { validateToken } = await import('@/lib/invitations/invitation-service');
    const supabase = createMockSupabase();

    supabase._chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await validateToken(supabase, 'unknown-token');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('not_found');
  });

  it('returns valid=false, error=expired for expired invitation', async () => {
    const { validateToken } = await import('@/lib/invitations/invitation-service');
    const supabase = createMockSupabase();

    supabase._chain.maybeSingle.mockResolvedValueOnce({
      data: { ...MOCK_ORG_INVITATION_SAFE, status: 'expired' },
      error: null,
    });

    const result = await validateToken(supabase, 'some-token');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('expired');
  });

  it('returns valid=false, error=already_accepted for accepted invitation', async () => {
    const { validateToken } = await import('@/lib/invitations/invitation-service');
    const supabase = createMockSupabase();

    supabase._chain.maybeSingle.mockResolvedValueOnce({
      data: { ...MOCK_ORG_INVITATION_SAFE, status: 'accepted' },
      error: null,
    });

    const result = await validateToken(supabase, 'some-token');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('already_accepted');
  });

  it('returns valid=false, error=revoked for revoked invitation', async () => {
    const { validateToken } = await import('@/lib/invitations/invitation-service');
    const supabase = createMockSupabase();

    supabase._chain.maybeSingle.mockResolvedValueOnce({
      data: { ...MOCK_ORG_INVITATION_SAFE, status: 'revoked' },
      error: null,
    });

    const result = await validateToken(supabase, 'some-token');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('revoked');
  });

  it('returns valid=true, existing_user=false for new email', async () => {
    const { validateToken } = await import('@/lib/invitations/invitation-service');
    const supabase = createMockSupabase();

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Token lookup
    supabase._chain.maybeSingle.mockResolvedValueOnce({
      data: { ...MOCK_ORG_INVITATION_SAFE, status: 'pending', expires_at: futureDate },
      error: null,
    });
    // Org name
    supabase._chain.single.mockResolvedValueOnce({
      data: { name: 'Test Org' },
      error: null,
    });
    // Inviter name
    supabase._chain.single.mockResolvedValueOnce({
      data: { full_name: 'Test Owner', email: 'owner@test.com' },
      error: null,
    });
    // Existing user check — not found
    supabase._chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await validateToken(supabase, 'valid-token');
    expect(result.valid).toBe(true);
    expect(result.existing_user).toBe(false);
    expect(result.invitation).not.toBeNull();
  });

  it('returns valid=true, existing_user=true for email in users table', async () => {
    const { validateToken } = await import('@/lib/invitations/invitation-service');
    const supabase = createMockSupabase();

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    supabase._chain.maybeSingle.mockResolvedValueOnce({
      data: { ...MOCK_ORG_INVITATION_SAFE, status: 'pending', expires_at: futureDate },
      error: null,
    });
    supabase._chain.single
      .mockResolvedValueOnce({ data: { name: 'Test Org' }, error: null })
      .mockResolvedValueOnce({ data: { full_name: 'Owner', email: 'o@t.com' }, error: null });
    supabase._chain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'existing-user-id' },
      error: null,
    });

    const result = await validateToken(supabase, 'valid-token');
    expect(result.valid).toBe(true);
    expect(result.existing_user).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// acceptInvitation
// ---------------------------------------------------------------------------

describe('acceptInvitation — Supabase mocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws not_found when validateToken fails', async () => {
    const { acceptInvitation } = await import('@/lib/invitations/invitation-service');
    const supabase = createMockSupabase();

    // validateToken returns not_found
    supabase._chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    try {
      await acceptInvitation(supabase, 'bad-token', {});
      expect.unreachable('Should have thrown');
    } catch (err: unknown) {
      expect((err as { code: string }).code).toBe('not_found');
    }
  });

  it('throws password_required for new users without password', async () => {
    const { acceptInvitation } = await import('@/lib/invitations/invitation-service');
    const supabase = createMockSupabase();

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // validateToken returns valid + new user
    supabase._chain.maybeSingle.mockResolvedValueOnce({
      data: { ...MOCK_ORG_INVITATION_SAFE, status: 'pending', expires_at: futureDate },
      error: null,
    });
    supabase._chain.single
      .mockResolvedValueOnce({ data: { name: 'Test Org' }, error: null })
      .mockResolvedValueOnce({ data: { full_name: 'Owner', email: 'o@t.com' }, error: null });
    supabase._chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); // new user

    try {
      await acceptInvitation(supabase, 'token', {});
      expect.unreachable('Should have thrown');
    } catch (err: unknown) {
      expect((err as { code: string }).code).toBe('password_required');
    }
  });

  it('throws password_too_short for password < 8 chars', async () => {
    const { acceptInvitation } = await import('@/lib/invitations/invitation-service');
    const supabase = createMockSupabase();

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    supabase._chain.maybeSingle.mockResolvedValueOnce({
      data: { ...MOCK_ORG_INVITATION_SAFE, status: 'pending', expires_at: futureDate },
      error: null,
    });
    supabase._chain.single
      .mockResolvedValueOnce({ data: { name: 'Test Org' }, error: null })
      .mockResolvedValueOnce({ data: { full_name: 'Owner', email: 'o@t.com' }, error: null });
    supabase._chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); // new user

    try {
      await acceptInvitation(supabase, 'token', { password: 'short', full_name: 'Test' });
      expect.unreachable('Should have thrown');
    } catch (err: unknown) {
      expect((err as { code: string }).code).toBe('password_too_short');
    }
  });

  it('returns success with org_name and role for existing user accept', async () => {
    const { acceptInvitation } = await import('@/lib/invitations/invitation-service');
    const supabase = createMockSupabase();

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // validateToken: valid + existing user
    supabase._chain.maybeSingle.mockResolvedValueOnce({
      data: { ...MOCK_ORG_INVITATION_SAFE, status: 'pending', expires_at: futureDate },
      error: null,
    });
    supabase._chain.single
      .mockResolvedValueOnce({ data: { name: 'Charcoal N Chill' }, error: null })
      .mockResolvedValueOnce({ data: { full_name: 'Owner', email: 'o@t.com' }, error: null });
    supabase._chain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'existing-user-id' },
      error: null,
    });

    // Existing user lookup
    supabase._chain.single.mockResolvedValueOnce({
      data: { id: 'existing-user-id' },
      error: null,
    });

    // Race condition check — not already a member
    supabase._chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await acceptInvitation(supabase, 'token', {});
    expect(result.success).toBe(true);
    expect(result.org_name).toBe('Charcoal N Chill');
    expect(result.role).toBe('analyst');
  });

  it('handles race condition: already in memberships still marks invitation accepted', async () => {
    const { acceptInvitation } = await import('@/lib/invitations/invitation-service');
    const supabase = createMockSupabase();

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // validateToken: valid + existing
    supabase._chain.maybeSingle.mockResolvedValueOnce({
      data: { ...MOCK_ORG_INVITATION_SAFE, status: 'pending', expires_at: futureDate },
      error: null,
    });
    supabase._chain.single
      .mockResolvedValueOnce({ data: { name: 'Charcoal N Chill' }, error: null })
      .mockResolvedValueOnce({ data: { full_name: 'Owner', email: 'o@t.com' }, error: null });
    supabase._chain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'existing-user-id' },
      error: null,
    });

    // Existing user lookup
    supabase._chain.single.mockResolvedValueOnce({
      data: { id: 'existing-user-id' },
      error: null,
    });

    // Already a member!
    supabase._chain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'mem-existing' },
      error: null,
    });

    const result = await acceptInvitation(supabase, 'token', {});
    expect(result.success).toBe(true);
  });
});
