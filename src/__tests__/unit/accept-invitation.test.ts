// ---------------------------------------------------------------------------
// accept-invitation.test.ts — Unit tests for Sprint 98 accept invitation action
//
// Tests app/actions/accept-invitation.ts:
//   • Token validation, status checks, email matching
//   • Service role client usage for membership insert
//   • Double-accept prevention, org name return
//
// Run:
//   npx vitest run src/__tests__/unit/accept-invitation.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { acceptInvitation } from '@/app/actions/accept-invitation';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

// ── Constants ─────────────────────────────────────────────────────────────

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const AUTH_UID = 'auth-uid-abc123';
const PUBLIC_USER_ID = 'u0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const INVITER_ID = 'u1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function validInvitation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    org_id: ORG_ID,
    email: 'invitee@example.com',
    role: 'viewer',
    status: 'pending',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    invited_by: INVITER_ID,
    ...overrides,
  };
}

function setupMocks(opts: {
  user?: { id: string; email: string } | null;
  invitation?: ReturnType<typeof validInvitation> | null;
  publicUser?: { id: string } | null;
  existingMembership?: { id: string } | null;
  orgName?: string;
  insertError?: { message: string } | null;
} = {}) {
  const {
    user = { id: AUTH_UID, email: 'invitee@example.com' },
    invitation = validInvitation(),
    publicUser = { id: PUBLIC_USER_ID },
    existingMembership = null,
    orgName = 'Test Org',
    insertError = null,
  } = opts;

  // Auth client (createClient) — for getUser
  const authClient = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: 'Not authenticated' },
      }),
    },
  };
  vi.mocked(createClient).mockResolvedValue(authClient as unknown as Awaited<ReturnType<typeof createClient>>);

  // Service role client
  const serviceClient = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'pending_invitations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: invitation, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ error: null }),
          }),
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
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: existingMembership, error: null }),
              }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: insertError }),
        };
      }
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { name: orgName }, error: null }),
            }),
          }),
        };
      }
      return {};
    }),
  };
  vi.mocked(createServiceRoleClient).mockReturnValue(serviceClient as unknown as ReturnType<typeof createServiceRoleClient>);

  return { authClient, serviceClient };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('acceptInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when token not found', async () => {
    setupMocks({ invitation: null });
    const result = await acceptInvitation({ token: 'nonexistent-token' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('not_found');
  });

  it('returns error when invitation already accepted', async () => {
    setupMocks({ invitation: validInvitation({ status: 'accepted' }) });
    const result = await acceptInvitation({ token: 'tok-1' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('already_accepted');
  });

  it('returns error when invitation revoked', async () => {
    setupMocks({ invitation: validInvitation({ status: 'revoked' }) });
    const result = await acceptInvitation({ token: 'tok-1' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('revoked');
  });

  it('returns error when invitation expired', async () => {
    setupMocks({
      invitation: validInvitation({
        expires_at: new Date(Date.now() - 1000).toISOString(),
      }),
    });
    const result = await acceptInvitation({ token: 'tok-1' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('expired');
  });

  it('returns error when session user email does not match invite email', async () => {
    setupMocks({
      user: { id: AUTH_UID, email: 'different@example.com' },
    });
    const result = await acceptInvitation({ token: 'tok-1' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('email_mismatch');
  });

  it('returns error when not authenticated', async () => {
    setupMocks({ user: null });
    const result = await acceptInvitation({ token: 'tok-1' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('not_authenticated');
  });

  it('returns orgId and orgName on success', async () => {
    setupMocks();
    const result = await acceptInvitation({ token: 'tok-1' });
    expect(result.success).toBe(true);
    expect(result.orgId).toBe(ORG_ID);
    expect(result.orgName).toBe('Test Org');
  });

  it('does not expose token in error messages', async () => {
    setupMocks({ invitation: null });
    const result = await acceptInvitation({ token: 'super-secret-token' });
    expect(result.error).not.toContain('super-secret-token');
  });

  it('uses service role client for DB write (bypasses RLS)', async () => {
    setupMocks();
    await acceptInvitation({ token: 'tok-1' });
    expect(createServiceRoleClient).toHaveBeenCalled();
  });

  it('returns error when user record not found', async () => {
    setupMocks({ publicUser: null });
    const result = await acceptInvitation({ token: 'tok-1' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('user_not_found');
  });

  it('email matching is case-insensitive', async () => {
    setupMocks({
      user: { id: AUTH_UID, email: 'INVITEE@Example.COM' },
      invitation: validInvitation({ email: 'invitee@example.com' }),
    });
    const result = await acceptInvitation({ token: 'tok-1' });
    expect(result.success).toBe(true);
  });

  it('handles already_member case (idempotency)', async () => {
    setupMocks({ existingMembership: { id: 'mem-existing' } });
    const result = await acceptInvitation({ token: 'tok-1' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('already_member');
  });
});
