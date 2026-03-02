/**
 * invitation-routes.test.ts — Sprint 112
 *
 * Tests for invitation API routes.
 * All dependencies mocked (auth, supabase, invitation-service, email).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  MOCK_ORG_INVITATION_SAFE,
} from '@/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetSafeAuthContext = vi.fn();
const mockCreateServiceRoleClient = vi.fn();
const mockRoleSatisfies = vi.fn();
const mockCanManageTeamSeats = vi.fn();
const mockSendInvitation = vi.fn();
const mockGetOrgInvitations = vi.fn();
const mockRevokeInvitation = vi.fn();
const mockValidateToken = vi.fn();
const mockAcceptInvitation = vi.fn();
const mockBuildInvitationEmailProps = vi.fn();
const mockBuildInvitationSubject = vi.fn();
const mockSendInvitationEmail = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => mockCreateServiceRoleClient(),
}));

vi.mock('@/lib/auth/org-roles', () => ({
  roleSatisfies: (...args: unknown[]) => mockRoleSatisfies(...args),
}));

vi.mock('@/lib/plan-enforcer', () => ({
  canManageTeamSeats: (...args: unknown[]) => mockCanManageTeamSeats(...args),
}));

vi.mock('@/lib/invitations/invitation-service', () => ({
  sendInvitation: (...args: unknown[]) => mockSendInvitation(...args),
  getOrgInvitations: (...args: unknown[]) => mockGetOrgInvitations(...args),
  revokeInvitation: (...args: unknown[]) => mockRevokeInvitation(...args),
  validateToken: (...args: unknown[]) => mockValidateToken(...args),
  acceptInvitation: (...args: unknown[]) => mockAcceptInvitation(...args),
}));

vi.mock('@/lib/invitations/invitation-email', () => ({
  buildInvitationEmailProps: (...args: unknown[]) => mockBuildInvitationEmailProps(...args),
  buildInvitationSubject: (...args: unknown[]) => mockBuildInvitationSubject(...args),
}));

vi.mock('@/lib/email', () => ({
  sendInvitationEmail: (...args: unknown[]) => mockSendInvitationEmail(...args),
}));

vi.mock('@/lib/whitelabel/theme-service', () => ({
  getOrgTheme: vi.fn().mockResolvedValue(null),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockAuthenticatedOwner() {
  mockGetSafeAuthContext.mockResolvedValue({
    orgId: 'org-1',
    userId: 'auth-uid-1',
    email: 'owner@test.com',
    role: 'owner',
    plan: 'agency',
  });
  mockCanManageTeamSeats.mockReturnValue(true);
  mockRoleSatisfies.mockReturnValue(true);

  const mockSupabase = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'user-pub-1', full_name: 'Owner', email: 'owner@test.com' },
        error: null,
      }),
    }),
  };
  mockCreateServiceRoleClient.mockReturnValue(mockSupabase);
  return mockSupabase;
}

function createRequest(method: string, body?: unknown): NextRequest {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return new NextRequest('http://localhost/api/team/invitations', init);
}

// ---------------------------------------------------------------------------
// POST /api/team/invitations
// ---------------------------------------------------------------------------

describe('POST /api/team/invitations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);

    const { POST } = await import('@/app/api/team/invitations/route');
    const res = await POST(createRequest('POST', { email: 'a@b.com', role: 'admin' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 plan_upgrade_required for non-Agency plan', async () => {
    mockGetSafeAuthContext.mockResolvedValue({
      orgId: 'org-1', userId: 'u-1', role: 'owner', plan: 'growth',
    });
    mockCanManageTeamSeats.mockReturnValue(false);

    const { POST } = await import('@/app/api/team/invitations/route');
    const res = await POST(createRequest('POST', { email: 'a@b.com', role: 'admin' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('plan_upgrade_required');
  });

  it('returns 403 insufficient_role for analyst/viewer callers', async () => {
    mockGetSafeAuthContext.mockResolvedValue({
      orgId: 'org-1', userId: 'u-1', role: 'analyst', plan: 'agency',
    });
    mockCanManageTeamSeats.mockReturnValue(true);
    mockRoleSatisfies.mockReturnValue(false);

    const { POST } = await import('@/app/api/team/invitations/route');
    const res = await POST(createRequest('POST', { email: 'a@b.com', role: 'admin' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('insufficient_role');
  });

  it('returns 400 invalid_email for malformed email', async () => {
    mockAuthenticatedOwner();

    const { POST } = await import('@/app/api/team/invitations/route');
    const res = await POST(createRequest('POST', { email: 'notanemail', role: 'admin' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_email');
  });

  it('returns 400 invalid_role for role=owner', async () => {
    mockAuthenticatedOwner();

    const { POST } = await import('@/app/api/team/invitations/route');
    const res = await POST(createRequest('POST', { email: 'a@b.com', role: 'owner' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_role');
  });

  it('returns ok:true and OrgInvitationSafe on success', async () => {
    const mockSupa = mockAuthenticatedOwner();

    mockSendInvitation.mockResolvedValue({
      invitation: MOCK_ORG_INVITATION_SAFE,
      token: 'abc123',
    });
    mockBuildInvitationEmailProps.mockReturnValue({});
    mockBuildInvitationSubject.mockReturnValue('Subject');
    mockSendInvitationEmail.mockResolvedValue(undefined);

    // Second from() call for org name
    mockSupa.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'u1', full_name: 'Owner', email: 'o@t.com' }, error: null }),
    });
    mockSupa.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { name: 'Org' }, error: null }),
    });

    const { POST } = await import('@/app/api/team/invitations/route');
    const res = await POST(createRequest('POST', { email: 'new@example.com', role: 'analyst' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.invitation).toBeDefined();
  });

  it('token NOT present in success response', async () => {
    mockAuthenticatedOwner();

    mockSendInvitation.mockResolvedValue({
      invitation: MOCK_ORG_INVITATION_SAFE,
      token: 'secret-token',
    });
    mockBuildInvitationEmailProps.mockReturnValue({});
    mockBuildInvitationSubject.mockReturnValue('Subject');
    mockSendInvitationEmail.mockResolvedValue(undefined);

    const { POST } = await import('@/app/api/team/invitations/route');
    const res = await POST(createRequest('POST', { email: 'new@example.com', role: 'analyst' }));
    const body = await res.json();
    // Token should NOT be in the response
    expect(body.token).toBeUndefined();
    expect(body.invitation?.token).toBeUndefined();
  });

  it('returns 429 seat_limit_reached', async () => {
    mockAuthenticatedOwner();

    const { MembershipError } = await import('@/lib/membership/membership-service');
    mockSendInvitation.mockRejectedValue(
      new MembershipError('seat_limit_reached', 'Seat limit reached')
    );

    const { POST } = await import('@/app/api/team/invitations/route');
    const res = await POST(createRequest('POST', { email: 'a@b.com', role: 'analyst' }));
    expect(res.status).toBe(429);
  });

  it('returns 409 already_member', async () => {
    mockAuthenticatedOwner();

    const { MembershipError } = await import('@/lib/membership/membership-service');
    mockSendInvitation.mockRejectedValue(
      new MembershipError('already_member', 'Already a member')
    );

    const { POST } = await import('@/app/api/team/invitations/route');
    const res = await POST(createRequest('POST', { email: 'a@b.com', role: 'analyst' }));
    expect(res.status).toBe(409);
  });

  it('returns 409 invitation_already_pending', async () => {
    mockAuthenticatedOwner();

    const { MembershipError } = await import('@/lib/membership/membership-service');
    mockSendInvitation.mockRejectedValue(
      new MembershipError('invitation_already_pending', 'Already pending')
    );

    const { POST } = await import('@/app/api/team/invitations/route');
    const res = await POST(createRequest('POST', { email: 'a@b.com', role: 'analyst' }));
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// GET /api/team/invitations
// ---------------------------------------------------------------------------

describe('GET /api/team/invitations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);

    const { GET } = await import('@/app/api/team/invitations/route');
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-Agency plan', async () => {
    mockGetSafeAuthContext.mockResolvedValue({
      orgId: 'org-1', userId: 'u-1', role: 'owner', plan: 'growth',
    });
    mockCanManageTeamSeats.mockReturnValue(false);

    const { GET } = await import('@/app/api/team/invitations/route');
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns invitations on success', async () => {
    mockAuthenticatedOwner();
    mockGetOrgInvitations.mockResolvedValue([MOCK_ORG_INVITATION_SAFE]);

    const { GET } = await import('@/app/api/team/invitations/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invitations).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/team/invitations/[invitationId]
// ---------------------------------------------------------------------------

describe('DELETE /api/team/invitations/[invitationId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);

    const { DELETE } = await import('@/app/api/team/invitations/[invitationId]/route');
    const req = new NextRequest('http://localhost/api/team/invitations/inv-1', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ invitationId: 'inv-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 403 for insufficient role', async () => {
    mockGetSafeAuthContext.mockResolvedValue({
      orgId: 'org-1', userId: 'u-1', role: 'analyst', plan: 'agency',
    });
    mockCanManageTeamSeats.mockReturnValue(true);
    mockRoleSatisfies.mockReturnValue(false);

    const { DELETE } = await import('@/app/api/team/invitations/[invitationId]/route');
    const req = new NextRequest('http://localhost/api/team/invitations/inv-1', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ invitationId: 'inv-1' }) });
    expect(res.status).toBe(403);
  });

  it('returns 404 invitation_not_found', async () => {
    mockAuthenticatedOwner();

    const { MembershipError } = await import('@/lib/membership/membership-service');
    mockRevokeInvitation.mockRejectedValue(
      new MembershipError('invitation_not_found', 'Not found')
    );

    const { DELETE } = await import('@/app/api/team/invitations/[invitationId]/route');
    const req = new NextRequest('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ invitationId: 'inv-missing' }) });
    expect(res.status).toBe(404);
  });

  it('returns 409 invitation_not_revocable', async () => {
    mockAuthenticatedOwner();

    const { MembershipError } = await import('@/lib/membership/membership-service');
    mockRevokeInvitation.mockRejectedValue(
      new MembershipError('invitation_not_revocable', 'Already accepted')
    );

    const { DELETE } = await import('@/app/api/team/invitations/[invitationId]/route');
    const req = new NextRequest('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ invitationId: 'inv-1' }) });
    expect(res.status).toBe(409);
  });

  it('returns ok:true on success', async () => {
    mockAuthenticatedOwner();
    mockRevokeInvitation.mockResolvedValue({ success: true });

    const { DELETE } = await import('@/app/api/team/invitations/[invitationId]/route');
    const req = new NextRequest('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ invitationId: 'inv-1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/invitations/accept/[token]
// ---------------------------------------------------------------------------

describe('GET /api/invitations/accept/[token] — PUBLIC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns InvitationValidation with valid=true for valid token', async () => {
    mockCreateServiceRoleClient.mockReturnValue({});

    mockValidateToken.mockResolvedValue({
      valid: true,
      invitation: MOCK_ORG_INVITATION_SAFE,
      error: null,
      existing_user: false,
    });

    const { GET } = await import('@/app/api/invitations/accept/[token]/route');
    const req = new NextRequest('http://localhost/api/invitations/accept/tok');
    const res = await GET(req, { params: Promise.resolve({ token: 'tok' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
  });

  it('returns valid=false for expired token (200, not 4xx)', async () => {
    mockCreateServiceRoleClient.mockReturnValue({});

    mockValidateToken.mockResolvedValue({
      valid: false,
      invitation: null,
      error: 'expired',
      existing_user: false,
    });

    const { GET } = await import('@/app/api/invitations/accept/[token]/route');
    const req = new NextRequest('http://localhost/api/invitations/accept/tok');
    const res = await GET(req, { params: Promise.resolve({ token: 'tok' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.error).toBe('expired');
  });

  it('returns existing_user=true when email exists', async () => {
    mockCreateServiceRoleClient.mockReturnValue({});

    mockValidateToken.mockResolvedValue({
      valid: true,
      invitation: MOCK_ORG_INVITATION_SAFE,
      error: null,
      existing_user: true,
    });

    const { GET } = await import('@/app/api/invitations/accept/[token]/route');
    const req = new NextRequest('http://localhost/api/invitations/accept/tok');
    const res = await GET(req, { params: Promise.resolve({ token: 'tok' }) });
    const body = await res.json();
    expect(body.existing_user).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// POST /api/invitations/accept/[token]
// ---------------------------------------------------------------------------

describe('POST /api/invitations/accept/[token] — PUBLIC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 expired for expired token', async () => {
    mockCreateServiceRoleClient.mockReturnValue({});

    const { MembershipError } = await import('@/lib/membership/membership-service');
    mockAcceptInvitation.mockRejectedValue(
      new MembershipError('expired', 'Invitation is expired.')
    );

    const { POST } = await import('@/app/api/invitations/accept/[token]/route');
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ token: 'tok' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('expired');
  });

  it('returns 400 password_required for new user without password', async () => {
    mockCreateServiceRoleClient.mockReturnValue({});

    const { MembershipError } = await import('@/lib/membership/membership-service');
    mockAcceptInvitation.mockRejectedValue(
      new MembershipError('password_required', 'Password is required.')
    );

    const { POST } = await import('@/app/api/invitations/accept/[token]/route');
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ token: 'tok' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('password_required');
  });

  it('returns 400 password_too_short for password < 8 chars', async () => {
    mockCreateServiceRoleClient.mockReturnValue({});

    const { MembershipError } = await import('@/lib/membership/membership-service');
    mockAcceptInvitation.mockRejectedValue(
      new MembershipError('password_too_short', 'Password too short.')
    );

    const { POST } = await import('@/app/api/invitations/accept/[token]/route');
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ full_name: 'Test', password: 'short' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ token: 'tok' }) });
    expect(res.status).toBe(400);
  });

  it('returns ok:true, org_name, role on success', async () => {
    mockCreateServiceRoleClient.mockReturnValue({});

    mockAcceptInvitation.mockResolvedValue({
      success: true,
      org_name: 'Charcoal N Chill',
      role: 'analyst',
    });

    const { POST } = await import('@/app/api/invitations/accept/[token]/route');
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ token: 'tok' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.org_name).toBe('Charcoal N Chill');
    expect(body.role).toBe('analyst');
  });

  it('does NOT require session (no auth header needed)', async () => {
    mockCreateServiceRoleClient.mockReturnValue({});

    mockAcceptInvitation.mockResolvedValue({
      success: true,
      org_name: 'Org',
      role: 'viewer',
    });

    const { POST } = await import('@/app/api/invitations/accept/[token]/route');
    // No auth headers at all
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ token: 'tok' }) });
    expect(res.status).toBe(200);
    // getSafeAuthContext was NOT called (public route)
    expect(mockGetSafeAuthContext).not.toHaveBeenCalled();
  });
});
