/**
 * Unit Tests — Auth Route Handlers
 *
 * Strategy: the Supabase server module is fully mocked at the module level.
 * Each test controls what the mock client returns, allowing us to test
 * route logic (validation, error mapping, response shape) without a live DB.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/auth-routes.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as register } from '@/app/api/auth/register/route';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as logout } from '@/app/api/auth/logout/route';

// ---------------------------------------------------------------------------
// Module-level mock — replaces lib/supabase/server for all tests in this file
// ---------------------------------------------------------------------------

const mockAdminCreateUser = vi.fn();
const mockAdminDeleteUser = vi.fn();
const mockFrom = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignOut = vi.fn();

const mockServiceClient = {
  auth: {
    admin: {
      createUser: mockAdminCreateUser,
      deleteUser: mockAdminDeleteUser,
    },
  },
  from: mockFrom,
};

const mockServerClient = {
  auth: {
    signInWithPassword: mockSignInWithPassword,
    signOut: mockSignOut,
  },
  from: mockFrom,
};

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(() => mockServiceClient),
  createClient: vi.fn(async () => mockServerClient),
}));

// §314: Mock account lockout (defaults to unlocked)
vi.mock('@/lib/auth/account-lockout', () => ({
  checkAccountLockout: vi.fn(async () => ({ locked: false, attemptsRemaining: 5 })),
  recordFailedLogin: vi.fn(async () => {}),
  clearFailedLogins: vi.fn(async () => {}),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'origin': 'http://localhost:3000' },
    body: JSON.stringify(body),
  });
}

/**
 * Chains `.from().select().eq().single()` style query builders.
 * Each call to `mockFrom` returns a builder that records the table name and
 * resolves to `returnValue` at the terminal method (single/maybeSingle/insert/update).
 */
function mockQuery(returnValue: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(returnValue),
    maybeSingle: vi.fn().mockResolvedValue(returnValue),
  };
  mockFrom.mockReturnValue(builder);
  return builder;
}

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------

describe('POST /api/auth/register', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Zod validation ────────────────────────────────────────────────────────

  it('returns 400 when body is missing required fields', async () => {
    const res = await register(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.issues).toBeDefined();
    expect(body.issues.email).toBeDefined();
    expect(body.issues.password).toBeDefined();
  });

  it('returns 400 for invalid email format', async () => {
    const res = await register(
      makeRequest({ email: 'not-an-email', password: 'SecureP@ss9', full_name: 'Test', business_name: 'Test Biz' })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.issues.email).toBeDefined();
  });

  it('returns 400 when password is too weak (no uppercase)', async () => {
    const res = await register(
      makeRequest({ email: 'a@b.com', password: 'password1', full_name: 'Test', business_name: 'Test Biz' })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.issues.password).toBeDefined();
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'origin': 'http://localhost:3000' },
      body: 'not-valid-json',
    });
    const res = await register(req);
    expect(res.status).toBe(400);
  });

  // ── Auth user creation ────────────────────────────────────────────────────

  it('returns 409 when email is already registered', async () => {
    mockAdminCreateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'User already registered' },
    });

    const res = await register(
      makeRequest({ email: 'existing@test.com', password: 'SecureP@ss9', full_name: 'Test', business_name: 'Test Biz' })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('Email already registered');
  });

  it('returns 500 when auth user creation fails for an unknown reason', async () => {
    mockAdminCreateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Database connection error' },
    });

    const res = await register(
      makeRequest({ email: 'a@b.com', password: 'SecureP@ss9', full_name: 'Test', business_name: 'Test Biz' })
    );
    expect(res.status).toBe(500);
  });

  // ── Atomicity / rollback ──────────────────────────────────────────────────

  it('deletes the auth user (rollback) if public.users row is not found after creation', async () => {
    mockAdminCreateUser.mockResolvedValue({
      data: { user: { id: 'auth-user-uuid' } },
      error: null,
    });
    mockAdminDeleteUser.mockResolvedValue({ error: null });

    // §315: Step 3 (users lookup) returns null on ALL retry attempts → triggers rollback
    const failBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Row not found' } }),
    };
    mockFrom.mockReturnValue(failBuilder);

    const res = await register(
      makeRequest({ email: 'a@b.com', password: 'SecureP@ss9', full_name: 'Test', business_name: 'Test Biz' })
    );

    expect(res.status).toBe(500);
    expect(mockAdminDeleteUser).toHaveBeenCalledOnce();
    expect(mockAdminDeleteUser).toHaveBeenCalledWith('auth-user-uuid');
    const body = await res.json();
    expect(body.code).toBe('ROLLED_BACK');
  });

  it('deletes the auth user (rollback) if membership is not found after creation', async () => {
    mockAdminCreateUser.mockResolvedValue({
      data: { user: { id: 'auth-user-uuid' } },
      error: null,
    });
    mockAdminDeleteUser.mockResolvedValue({ error: null });

    // §315: Step 3 (users lookup) succeeds on first attempt
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'public-user-uuid' }, error: null }),
    });
    // §315: Step 4 (membership lookup) fails on ALL retry attempts → triggers rollback
    const failBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'No membership' } }),
    };
    mockFrom.mockReturnValue(failBuilder);

    const res = await register(
      makeRequest({ email: 'a@b.com', password: 'SecureP@ss9', full_name: 'Test', business_name: 'Test Biz' })
    );

    expect(res.status).toBe(500);
    expect(mockAdminDeleteUser).toHaveBeenCalledOnce();
    expect(mockAdminDeleteUser).toHaveBeenCalledWith('auth-user-uuid');
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns 201 with user_id and org_id on success', async () => {
    mockAdminCreateUser.mockResolvedValue({
      data: { user: { id: 'auth-user-uuid' } },
      error: null,
    });

    // Each .from() call must return its own builder chain in call order:
    // 1. from('users').select().eq().single()         → public user row
    // 2. from('memberships').select().eq().single()   → membership row
    // 3. from('organizations').update().eq()          → update org name
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'public-user-uuid' }, error: null }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { org_id: 'org-uuid' }, error: null }),
      })
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

    const res = await register(
      makeRequest({ email: 'new@test.com', password: 'SecureP@ss9', full_name: 'New User', business_name: 'My Restaurant' })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user_id).toBe('auth-user-uuid');
    expect(body.org_id).toBe('org-uuid');
    expect(body.org_name).toBe('My Restaurant');
    expect(body.message).toContain('verify');
    expect(body.email_verification_required).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

describe('POST /api/auth/login', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Zod validation ────────────────────────────────────────────────────────

  it('returns 400 for missing credentials', async () => {
    const res = await login(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.issues.email).toBeDefined();
  });

  it('returns 400 for invalid email', async () => {
    const res = await login(makeRequest({ email: 'bad', password: 'pass' }));
    expect(res.status).toBe(400);
  });

  // ── Credential errors ─────────────────────────────────────────────────────

  it('returns 401 for invalid credentials', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials' },
    });

    const res = await login(makeRequest({ email: 'a@b.com', password: 'WrongPass1' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid email or password');
  });

  // §P0-C3: Email not confirmed — returns 401 (same as invalid credentials) to prevent enumeration
  it('returns 401 with email_verification_required when email is not confirmed', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Email not confirmed' },
    });

    const res = await login(makeRequest({ email: 'a@b.com', password: 'SecureP@ss9' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.email_verification_required).toBe(true);
    expect(body.error).toBe('Invalid email or password');
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  // §P0-H5: Session tokens are NOT exposed in response body (httpOnly cookies only)
  it('returns 200 with user info but no session tokens on valid credentials', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'user-uuid', email: 'a@b.com', email_confirmed_at: '2026-01-01T00:00:00Z' },
        session: {
          access_token: 'access-tok',
          refresh_token: 'refresh-tok',
          expires_at: 9999999999,
        },
      },
      error: null,
    });

    const res = await login(makeRequest({ email: 'a@b.com', password: 'SecureP@ss9' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user_id).toBe('user-uuid');
    expect(body.email).toBe('a@b.com');
    expect(body.email_verified).toBe(true);
    // Session tokens must NOT be in the response body
    expect(body.session).toBeUndefined();
    expect(body.access_token).toBeUndefined();
    expect(body.refresh_token).toBeUndefined();
  });

  it('returns email_verified=false for unverified user login', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'user-uuid', email: 'a@b.com', email_confirmed_at: null },
        session: {
          access_token: 'access-tok',
          refresh_token: 'refresh-tok',
          expires_at: 9999999999,
        },
      },
      error: null,
    });

    const res = await login(makeRequest({ email: 'a@b.com', password: 'SecureP@ss9' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.email_verified).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------

describe('POST /api/auth/logout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with success message when session exists', async () => {
    mockSignOut.mockResolvedValue({ error: null });

    const res = await logout(makeRequest({}));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('Logged out successfully');
  });

  it('returns 200 even when no session exists (idempotent)', async () => {
    mockSignOut.mockResolvedValue({ error: { message: 'No session' } });

    const res = await logout(makeRequest({}));
    expect(res.status).toBe(200);
  });
});
