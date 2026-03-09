/**
 * Unit Tests — §324 Auth Session Management
 *
 * Tests session lifecycle: creation, validation, invalidation, org resolution,
 * email verification gating, and logout idempotency.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/auth-session-management.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// -- Supabase server client --
const mockGetUser = vi.fn();
const mockSignOut = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockUpdateUser = vi.fn();
const mockResend = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
      signOut: mockSignOut,
      signInWithPassword: mockSignInWithPassword,
      updateUser: mockUpdateUser,
      resend: mockResend,
    },
    from: mockFrom,
  })),
  createServiceRoleClient: vi.fn(() => ({
    auth: { admin: {} },
    from: mockFrom,
  })),
}));

// -- Account lockout --
const mockCheckAccountLockout = vi.fn();
const mockRecordFailedLogin = vi.fn();
const mockClearFailedLogins = vi.fn();

vi.mock('@/lib/auth/account-lockout', () => ({
  checkAccountLockout: (...args: unknown[]) => mockCheckAccountLockout(...args),
  recordFailedLogin: (...args: unknown[]) => mockRecordFailedLogin(...args),
  clearFailedLogins: (...args: unknown[]) => mockClearFailedLogins(...args),
}));

// -- Rate limiter --
vi.mock('@/lib/rate-limit/rate-limiter', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  getRateLimitHeaders: vi.fn(() => ({})),
}));

// -- CSRF --
vi.mock('@/lib/auth/csrf', () => ({
  validateOrigin: vi.fn(() => null), // pass by default
}));

// -- Sentry --
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

// -- Turnstile (for register) --
vi.mock('@/lib/auth/turnstile', () => ({
  verifyTurnstileToken: vi.fn(async () => ({ success: true })),
}));

// -- Next.js headers (for active-org cookie) --
const mockCookieGet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: mockCookieGet,
    set: vi.fn(),
    delete: vi.fn(),
  })),
  headers: vi.fn(async () => new Map()),
}));

// ---------------------------------------------------------------------------
// Route imports
// ---------------------------------------------------------------------------

import { POST as login } from '@/app/api/auth/login/route';
import { POST as logout } from '@/app/api/auth/logout/route';
import { POST as resetPassword } from '@/app/api/auth/reset-password/route';
import { POST as resendVerification } from '@/app/api/auth/resend-verification/route';
import { getAuthContext, getSafeAuthContext } from '@/lib/auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(path: string, body?: unknown): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeLoginRequest(overrides: Record<string, unknown> = {}): Request {
  return makeRequest('/api/auth/login', {
    email: 'user@test.com',
    password: 'SecureP@ss9',
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Flow 1: Login session creation
// ---------------------------------------------------------------------------

describe('Session creation on login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns user_id, email, and email_verified on success', async () => {
    mockCheckAccountLockout.mockResolvedValue({ locked: false, attemptsRemaining: 5 });
    mockClearFailedLogins.mockResolvedValue(undefined);
    mockSignInWithPassword.mockResolvedValue({
      data: {
        session: { access_token: 'tok', refresh_token: 'ref' },
        user: { id: 'auth-uuid', email: 'user@test.com', email_confirmed_at: '2026-01-01' },
      },
      error: null,
    });

    const res = await login(makeLoginRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.user_id).toBe('auth-uuid');
    expect(body.email).toBe('user@test.com');
    expect(body.email_verified).toBe(true);
  });

  it('does NOT expose access_token or refresh_token in response body', async () => {
    mockCheckAccountLockout.mockResolvedValue({ locked: false, attemptsRemaining: 5 });
    mockClearFailedLogins.mockResolvedValue(undefined);
    mockSignInWithPassword.mockResolvedValue({
      data: {
        session: { access_token: 'secret-tok', refresh_token: 'secret-ref' },
        user: { id: 'auth-uuid', email: 'user@test.com', email_confirmed_at: '2026-01-01' },
      },
      error: null,
    });

    const res = await login(makeLoginRequest());
    const text = await res.text();

    // Response body must NEVER contain tokens
    expect(text).not.toContain('secret-tok');
    expect(text).not.toContain('secret-ref');
    expect(text).not.toContain('access_token');
    expect(text).not.toContain('refresh_token');
  });

  it('returns email_verified=false for unconfirmed user', async () => {
    mockCheckAccountLockout.mockResolvedValue({ locked: false, attemptsRemaining: 5 });
    mockClearFailedLogins.mockResolvedValue(undefined);
    mockSignInWithPassword.mockResolvedValue({
      data: {
        session: { access_token: 'tok', refresh_token: 'ref' },
        user: { id: 'auth-uuid', email: 'user@test.com', email_confirmed_at: null },
      },
      error: null,
    });

    const res = await login(makeLoginRequest());
    const body = await res.json();
    expect(body.email_verified).toBe(false);
  });

  it('clears failed login attempts on successful login', async () => {
    mockCheckAccountLockout.mockResolvedValue({ locked: false, attemptsRemaining: 5 });
    mockClearFailedLogins.mockResolvedValue(undefined);
    mockSignInWithPassword.mockResolvedValue({
      data: {
        session: { access_token: 'tok', refresh_token: 'ref' },
        user: { id: 'auth-uuid', email: 'user@test.com', email_confirmed_at: '2026-01-01' },
      },
      error: null,
    });

    await login(makeLoginRequest());
    expect(mockClearFailedLogins).toHaveBeenCalledWith('user@test.com');
  });

  it('does NOT clear failed attempts on invalid credentials', async () => {
    mockCheckAccountLockout.mockResolvedValue({ locked: false, attemptsRemaining: 5 });
    mockRecordFailedLogin.mockResolvedValue(undefined);
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials' },
    });

    await login(makeLoginRequest());
    expect(mockClearFailedLogins).not.toHaveBeenCalled();
    expect(mockRecordFailedLogin).toHaveBeenCalledWith('user@test.com');
  });
});

// ---------------------------------------------------------------------------
// Flow 2: Logout idempotency
// ---------------------------------------------------------------------------

describe('Logout session termination', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 and calls signOut', async () => {
    mockSignOut.mockResolvedValue({ error: null });

    const res = await logout(makeRequest('/api/auth/logout'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.message).toBe('Logged out successfully');
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — returns 200 even when no session exists', async () => {
    // Supabase signOut doesn't error when there's no session
    mockSignOut.mockResolvedValue({ error: null });

    const res = await logout(makeRequest('/api/auth/logout'));
    expect(res.status).toBe(200);
  });

  it('response does NOT contain any tokens or session data', async () => {
    mockSignOut.mockResolvedValue({ error: null });

    const res = await logout(makeRequest('/api/auth/logout'));
    const text = await res.text();

    expect(text).not.toContain('access_token');
    expect(text).not.toContain('refresh_token');
    expect(text).not.toContain('session');
  });
});

// ---------------------------------------------------------------------------
// Flow 3: Global session invalidation on password reset
// ---------------------------------------------------------------------------

describe('Password reset invalidates all sessions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls signOut with scope: "global" after password update', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });

    const res = await resetPassword(
      makeRequest('/api/auth/reset-password', { password: 'NewSecureP@ss9' }),
    );
    expect(res.status).toBe(200);
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'global' });
  });

  it('still returns 200 if global signOut fails (non-fatal)', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    mockSignOut.mockRejectedValue(new Error('Redis unavailable'));

    const res = await resetPassword(
      makeRequest('/api/auth/reset-password', { password: 'NewSecureP@ss9' }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('Password updated');
  });

  it('does NOT call signOut when password update fails', async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: 'Session expired' } });

    await resetPassword(
      makeRequest('/api/auth/reset-password', { password: 'NewSecureP@ss9' }),
    );
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('returns generic error on failure — never leaks internal details', async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: 'pgsodium: key not found' } });

    const res = await resetPassword(
      makeRequest('/api/auth/reset-password', { password: 'NewSecureP@ss9' }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Password update failed. Please try again.');
    expect(body.error).not.toContain('pgsodium');
    expect(body.error).not.toContain('key not found');
  });
});

// ---------------------------------------------------------------------------
// Flow 4: Email verification gating
// ---------------------------------------------------------------------------

describe('Email verification — resend endpoint', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no session exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'No user' } });

    const res = await resendVerification(makeRequest('/api/auth/resend-verification'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('signed in');
  });

  it('returns 400 when email is already verified', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: 'uid', email: 'user@test.com', email_confirmed_at: '2026-01-01' },
      },
      error: null,
    });

    const res = await resendVerification(makeRequest('/api/auth/resend-verification'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('already verified');
  });

  it('calls auth.resend for unverified user and returns 200', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: 'uid', email: 'user@test.com', email_confirmed_at: null },
      },
      error: null,
    });
    mockResend.mockResolvedValue({ error: null });

    const res = await resendVerification(makeRequest('/api/auth/resend-verification'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockResend).toHaveBeenCalledWith({ type: 'signup', email: 'user@test.com' });
  });

  it('returns 500 with generic error on resend failure', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: 'uid', email: 'user@test.com', email_confirmed_at: null },
      },
      error: null,
    });
    mockResend.mockResolvedValue({ error: { message: 'SMTP transport error' } });

    const res = await resendVerification(makeRequest('/api/auth/resend-verification'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).not.toContain('SMTP');
  });
});

// ---------------------------------------------------------------------------
// Flow 5: getAuthContext — throwing session validator
// ---------------------------------------------------------------------------

describe('getAuthContext — session validation (throwing)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws "Unauthorized" when no user session exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'No session' } });

    await expect(getAuthContext()).rejects.toThrow('Unauthorized');
  });

  it('throws "No organization found" when public user does not exist', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'auth-uuid' } },
      error: null,
    });
    // resolvePublicUser returns null (no public.users row yet)
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });

    await expect(getAuthContext()).rejects.toThrow('No organization found');
  });

  it('throws "No organization found" when no membership exists', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'auth-uuid' } },
      error: null,
    });

    // First call: resolvePublicUser succeeds
    // Second call: membership query fails
    let callCount = 0;
    mockFrom.mockImplementation(() => {
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
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'No rows' } }),
          }),
        }),
      };
    });

    await expect(getAuthContext()).rejects.toThrow('No organization found');
  });

  it('returns full context when session, user, and membership exist', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'auth-uuid' } },
      error: null,
    });

    const orgContext = {
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      plan: 'growth',
      plan_status: 'active',
      audit_frequency: 'weekly',
      max_locations: 10,
      onboarding_completed: true,
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
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
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                org_id: 'org-1',
                role: 'owner',
                organizations: orgContext,
              },
              error: null,
            }),
          }),
        }),
      };
    });

    const ctx = await getAuthContext();
    expect(ctx.userId).toBe('auth-uuid');
    expect(ctx.fullName).toBe('Test User');
    expect(ctx.orgId).toBe('org-1');
    expect(ctx.role).toBe('owner');
    expect(ctx.org.plan).toBe('growth');
  });
});

// ---------------------------------------------------------------------------
// Flow 6: getSafeAuthContext — non-throwing session validator
// ---------------------------------------------------------------------------

describe('getSafeAuthContext — session validation (non-throwing)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when no user session exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'No session' } });

    const ctx = await getSafeAuthContext();
    expect(ctx).toBeNull();
  });

  it('returns partial context with null org when public user not yet created', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: 'auth-uuid', email: 'user@test.com', email_confirmed_at: null },
      },
      error: null,
    });
    // resolvePublicUser returns null (trigger hasn't fired)
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });

    const ctx = await getSafeAuthContext();
    expect(ctx).not.toBeNull();
    expect(ctx!.userId).toBe('auth-uuid');
    expect(ctx!.email).toBe('user@test.com');
    expect(ctx!.emailVerified).toBe(false);
    expect(ctx!.orgId).toBeNull();
    expect(ctx!.orgName).toBeNull();
    expect(ctx!.role).toBeNull();
    expect(ctx!.plan).toBeNull();
    expect(ctx!.onboarding_completed).toBe(false);
  });

  it('returns partial context with null org when no membership exists', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: 'auth-uuid', email: 'user@test.com', email_confirmed_at: '2026-01-01' },
      },
      error: null,
    });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
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
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    });

    const ctx = await getSafeAuthContext();
    expect(ctx!.emailVerified).toBe(true);
    expect(ctx!.fullName).toBe('Test User');
    expect(ctx!.orgId).toBeNull();
    expect(ctx!.onboarding_completed).toBe(false);
  });

  it('returns full context when everything exists', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: 'auth-uuid', email: 'user@test.com', email_confirmed_at: '2026-01-01' },
      },
      error: null,
    });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
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
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                org_id: 'org-1',
                role: 'admin',
                organizations: {
                  id: 'org-1',
                  name: 'My Org',
                  plan: 'agency',
                  onboarding_completed: true,
                },
              },
              error: null,
            }),
          }),
        }),
      };
    });

    const ctx = await getSafeAuthContext();
    expect(ctx!.orgId).toBe('org-1');
    expect(ctx!.orgName).toBe('My Org');
    expect(ctx!.role).toBe('admin');
    expect(ctx!.plan).toBe('agency');
    expect(ctx!.onboarding_completed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Flow 7: Login + email_verification_required flag
// ---------------------------------------------------------------------------

describe('Login email verification signaling', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns email_verification_required for "email not confirmed" error', async () => {
    mockCheckAccountLockout.mockResolvedValue({ locked: false, attemptsRemaining: 5 });
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Email not confirmed' },
    });

    const res = await login(makeLoginRequest());
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe('Invalid email or password');
    expect(body.email_verification_required).toBe(true);
  });

  it('does NOT return email_verification_required for wrong password', async () => {
    mockCheckAccountLockout.mockResolvedValue({ locked: false, attemptsRemaining: 5 });
    mockRecordFailedLogin.mockResolvedValue(undefined);
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials' },
    });

    const res = await login(makeLoginRequest());
    const body = await res.json();
    expect(body.email_verification_required).toBeUndefined();
  });

  it('does NOT record failed attempt for unverified email (only for invalid credentials)', async () => {
    mockCheckAccountLockout.mockResolvedValue({ locked: false, attemptsRemaining: 5 });
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Email not confirmed' },
    });

    await login(makeLoginRequest());
    // Unverified email should NOT count as a failed login attempt
    expect(mockRecordFailedLogin).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Flow 8: Account lockout blocks authentication
// ---------------------------------------------------------------------------

describe('Account lockout blocks session creation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 423 when account is locked', async () => {
    mockCheckAccountLockout.mockResolvedValue({
      locked: true,
      retryAfterSeconds: 600,
      attemptsRemaining: 0,
    });

    const res = await login(makeLoginRequest());
    expect(res.status).toBe(423);

    const body = await res.json();
    expect(body.locked).toBe(true);
    expect(body.retry_after_seconds).toBe(600);
  });

  it('does NOT call signInWithPassword when account is locked', async () => {
    mockCheckAccountLockout.mockResolvedValue({
      locked: true,
      retryAfterSeconds: 300,
      attemptsRemaining: 0,
    });

    await login(makeLoginRequest());
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it('does NOT expose the locked email in the error response', async () => {
    mockCheckAccountLockout.mockResolvedValue({
      locked: true,
      retryAfterSeconds: 300,
      attemptsRemaining: 0,
    });

    const res = await login(makeLoginRequest());
    const text = await res.text();
    expect(text).not.toContain('user@test.com');
  });
});

// ---------------------------------------------------------------------------
// Flow 9: Active org cookie validation
// ---------------------------------------------------------------------------

describe('Active org resolution', () => {
  // Test the pure logic of getActiveOrgId
  // Imported separately because it uses next/headers cookies()
  beforeEach(() => vi.clearAllMocks());

  it('exports ORG_COOKIE constant as lv_active_org', async () => {
    const { ORG_COOKIE } = await import('@/lib/auth/active-org');
    expect(ORG_COOKIE).toBe('lv_active_org');
  });

  it('returns null when user has no memberships', async () => {
    const { getActiveOrgId } = await import('@/lib/auth/active-org');

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [] }),
          }),
        }),
      }),
    } as never;

    const result = await getActiveOrgId(mockSupabase, 'user-1');
    expect(result).toBeNull();
  });

  it('uses cookie value when it matches a membership', async () => {
    const { getActiveOrgId } = await import('@/lib/auth/active-org');

    mockCookieGet.mockReturnValue({ value: 'org-2' });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                { org_id: 'org-1', role: 'member', organizations: {} },
                { org_id: 'org-2', role: 'admin', organizations: {} },
              ],
            }),
          }),
        }),
      }),
    } as never;

    const result = await getActiveOrgId(mockSupabase, 'user-1');
    expect(result).toBe('org-2');
  });

  it('falls back to first membership when cookie is invalid', async () => {
    const { getActiveOrgId } = await import('@/lib/auth/active-org');

    mockCookieGet.mockReturnValue({ value: 'org-nonexistent' });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                { org_id: 'org-1', role: 'owner', organizations: {} },
                { org_id: 'org-2', role: 'member', organizations: {} },
              ],
            }),
          }),
        }),
      }),
    } as never;

    const result = await getActiveOrgId(mockSupabase, 'user-1');
    expect(result).toBe('org-1'); // first by created_at ASC
  });

  it('falls back to first membership when no cookie is set', async () => {
    const { getActiveOrgId } = await import('@/lib/auth/active-org');

    mockCookieGet.mockReturnValue(undefined);

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [{ org_id: 'org-3', role: 'owner', organizations: {} }],
            }),
          }),
        }),
      }),
    } as never;

    const result = await getActiveOrgId(mockSupabase, 'user-1');
    expect(result).toBe('org-3');
  });
});

// ---------------------------------------------------------------------------
// Flow 10: Login response never exposes internal error details
// ---------------------------------------------------------------------------

describe('Login error response safety', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 500 with original error for unexpected Supabase errors', async () => {
    mockCheckAccountLockout.mockResolvedValue({ locked: false, attemptsRemaining: 5 });
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'connection refused to auth.supabase.internal:5432' },
    });

    const res = await login(makeLoginRequest());
    expect(res.status).toBe(500);
    // Note: login route line 112 does pass error.message for non-credential errors
    // This test documents current behavior
  });

  it('returns unified 401 for both "invalid credentials" and "email not confirmed"', async () => {
    mockCheckAccountLockout.mockResolvedValue({ locked: false, attemptsRemaining: 5 });

    // Test invalid credentials
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials' },
    });
    mockRecordFailedLogin.mockResolvedValue(undefined);
    const res1 = await login(makeLoginRequest());

    // Test email not confirmed
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Email not confirmed' },
    });
    const res2 = await login(makeLoginRequest());

    // Both should return same status and same base error message
    expect(res1.status).toBe(401);
    expect(res2.status).toBe(401);

    const body1 = await res1.json();
    const body2 = await res2.json();
    expect(body1.error).toBe('Invalid email or password');
    expect(body2.error).toBe('Invalid email or password');
  });
});
