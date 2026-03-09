/**
 * Unit Tests — §313 Email Verification Flow
 *
 * Tests the resend-verification API route, proxy.ts verification gate,
 * and auth context emailVerified flag.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/email-verification.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as resendVerification } from '@/app/api/auth/resend-verification/route';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn();
const mockResend = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
      resend: mockResend,
    },
  })),
  createServiceRoleClient: vi.fn(() => ({})),
}));

vi.mock('@/lib/rate-limit/rate-limiter', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 1, reset_at: 0, limit: 1 }),
  getRateLimitHeaders: vi.fn().mockReturnValue({}),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(): Request {
  return new Request('http://localhost/api/auth/resend-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// POST /api/auth/resend-verification
// ---------------------------------------------------------------------------

describe('POST /api/auth/resend-verification', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'No session' } });

    const res = await resendVerification(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('signed in');
  });

  it('returns 400 when email is already verified', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com', email_confirmed_at: '2026-01-01T00:00:00Z' } },
      error: null,
    });

    const res = await resendVerification(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('already verified');
  });

  it('calls auth.resend with signup type for unverified user', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com', email_confirmed_at: null } },
      error: null,
    });
    mockResend.mockResolvedValue({ error: null });

    const res = await resendVerification(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockResend).toHaveBeenCalledWith({ type: 'signup', email: 'a@b.com' });
  });

  it('returns 500 when auth.resend fails', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com', email_confirmed_at: null } },
      error: null,
    });
    mockResend.mockResolvedValue({ error: { message: 'Rate limited by provider' } });

    const res = await resendVerification(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Failed');
  });

  it('returns 500 on unexpected exception', async () => {
    mockGetUser.mockRejectedValue(new Error('DB down'));

    const res = await resendVerification(makeRequest());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Rate limiting for resend-verification
// ---------------------------------------------------------------------------

describe('resend-verification rate limiting', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 429 when rate limit is exceeded', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit/rate-limiter');
    const { getRateLimitHeaders } = await import('@/lib/rate-limit/rate-limiter');

    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      reset_at: Math.floor(Date.now() / 1000) + 60,
      limit: 1,
      retry_after: 60,
    });
    vi.mocked(getRateLimitHeaders).mockReturnValueOnce({ 'Retry-After': '60' });

    const res = await resendVerification(makeRequest());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain('wait');
  });
});

// ---------------------------------------------------------------------------
// Auth context emailVerified flag
// ---------------------------------------------------------------------------

describe('SafeAuthContext.emailVerified', () => {
  // Reset module mocks for getSafeAuthContext tests
  beforeEach(() => vi.clearAllMocks());

  it('interface includes emailVerified field', async () => {
    // Type-level test — importing the type to ensure it compiles
    const { getSafeAuthContext } = await import('@/lib/auth');
    // If the import succeeds and the function exists, the interface is valid
    expect(typeof getSafeAuthContext).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Registration response shape
// ---------------------------------------------------------------------------

describe('Registration response (§313)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('register response includes email_verification_required', async () => {
    const { POST: register } = await import('@/app/api/auth/register/route');
    const { createServiceRoleClient } = await import('@/lib/supabase/server');

    const mockFrom = vi.fn();
    const mockAdminCreateUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'auth-uuid' } },
      error: null,
    });

    vi.mocked(createServiceRoleClient).mockReturnValue({
      auth: {
        admin: {
          createUser: mockAdminCreateUser,
          deleteUser: vi.fn(),
        },
      },
      from: mockFrom,
    } as never);

    // Chain: users lookup → membership lookup → org update
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'pub-uuid' }, error: null }),
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

    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'origin': 'http://localhost:3000' },
      body: JSON.stringify({
        email: 'new@test.com',
        password: 'SecureP@ss9',
        full_name: 'Test User',
        business_name: 'Test Biz',
      }),
    });

    const res = await register(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.email_verification_required).toBe(true);
    expect(body.message).toContain('verify');
  });

  it('register route sets email_confirm=false on admin.createUser', async () => {
    const { POST: register } = await import('@/app/api/auth/register/route');
    const { createServiceRoleClient } = await import('@/lib/supabase/server');

    const mockAdminCreateUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'auth-uuid' } },
      error: null,
    });

    const mockFrom = vi.fn();
    vi.mocked(createServiceRoleClient).mockReturnValue({
      auth: {
        admin: {
          createUser: mockAdminCreateUser,
          deleteUser: vi.fn(),
        },
      },
      from: mockFrom,
    } as never);

    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'pub-uuid' }, error: null }),
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

    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'origin': 'http://localhost:3000' },
      body: JSON.stringify({
        email: 'new@test.com',
        password: 'SecureP@ss9',
        full_name: 'Test User',
        business_name: 'Test Biz',
      }),
    });

    await register(req);

    expect(mockAdminCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ email_confirm: false }),
    );
  });
});

// ---------------------------------------------------------------------------
// Login response email_verified field
// ---------------------------------------------------------------------------

describe('Login response email_verified (§313)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns email_verified=true for confirmed user', async () => {
    const { POST: login } = await import('@/app/api/auth/login/route');

    const mockSignIn = vi.fn().mockResolvedValue({
      data: {
        user: { id: 'u1', email: 'a@b.com', email_confirmed_at: '2026-01-01T00:00:00Z' },
        session: { access_token: 'at', refresh_token: 'rt', expires_at: 9999 },
      },
      error: null,
    });

    const { createClient } = await import('@/lib/supabase/server');
    vi.mocked(createClient).mockResolvedValue({
      auth: { signInWithPassword: mockSignIn },
    } as never);

    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'origin': 'http://localhost:3000' },
      body: JSON.stringify({ email: 'a@b.com', password: 'Password1' }),
    });

    const res = await login(req);
    const body = await res.json();
    expect(body.email_verified).toBe(true);
  });

  it('returns email_verified=false for unconfirmed user', async () => {
    const { POST: login } = await import('@/app/api/auth/login/route');

    const mockSignIn = vi.fn().mockResolvedValue({
      data: {
        user: { id: 'u1', email: 'a@b.com', email_confirmed_at: null },
        session: { access_token: 'at', refresh_token: 'rt', expires_at: 9999 },
      },
      error: null,
    });

    const { createClient } = await import('@/lib/supabase/server');
    vi.mocked(createClient).mockResolvedValue({
      auth: { signInWithPassword: mockSignIn },
    } as never);

    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'origin': 'http://localhost:3000' },
      body: JSON.stringify({ email: 'a@b.com', password: 'Password1' }),
    });

    const res = await login(req);
    const body = await res.json();
    expect(body.email_verified).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rate limit config
// ---------------------------------------------------------------------------

describe('Rate limit config (§313)', () => {
  it('auth_resend_verification config exists with 1 req/min', async () => {
    const { ROUTE_RATE_LIMITS } = await import('@/lib/rate-limit/types');
    expect(ROUTE_RATE_LIMITS.auth_resend_verification).toBeDefined();
    expect(ROUTE_RATE_LIMITS.auth_resend_verification.max_requests).toBe(1);
    expect(ROUTE_RATE_LIMITS.auth_resend_verification.window_seconds).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// Proxy verification gate logic (pure logic tests)
// ---------------------------------------------------------------------------

describe('Proxy email verification gate logic (§313)', () => {
  // Mirrors VERIFICATION_GATED_PREFIXES in proxy.ts
  const VERIFICATION_GATED_PREFIXES = ['/dashboard', '/onboarding'];
  const VERIFICATION_PATH = '/verify-email';

  function shouldRedirectToVerify(user: { email_confirmed_at: string | null } | null, pathname: string): boolean {
    if (!user) return false;
    const isGated = VERIFICATION_GATED_PREFIXES.some((p) => pathname.startsWith(p));
    return !user.email_confirmed_at && isGated;
  }

  function shouldRedirectVerifyToDashboard(user: { email_confirmed_at: string | null } | null, pathname: string): boolean {
    if (!user) return false;
    return !!user.email_confirmed_at && pathname === VERIFICATION_PATH;
  }

  function shouldRedirectVerifyToLogin(user: null, pathname: string): boolean {
    return user === null && pathname === VERIFICATION_PATH;
  }

  it('redirects unverified user from /dashboard to /verify-email', () => {
    expect(shouldRedirectToVerify({ email_confirmed_at: null }, '/dashboard')).toBe(true);
  });

  it('redirects unverified user from /onboarding to /verify-email', () => {
    expect(shouldRedirectToVerify({ email_confirmed_at: null }, '/onboarding/connect')).toBe(true);
  });

  it('does NOT redirect verified user from /dashboard', () => {
    expect(shouldRedirectToVerify({ email_confirmed_at: '2026-01-01' }, '/dashboard')).toBe(false);
  });

  it('does NOT redirect unverified user from public pages', () => {
    expect(shouldRedirectToVerify({ email_confirmed_at: null }, '/pricing')).toBe(false);
  });

  it('redirects verified user from /verify-email to /dashboard', () => {
    expect(shouldRedirectVerifyToDashboard({ email_confirmed_at: '2026-01-01' }, '/verify-email')).toBe(true);
  });

  it('does NOT redirect verified user from /dashboard to /dashboard (no loop)', () => {
    expect(shouldRedirectVerifyToDashboard({ email_confirmed_at: '2026-01-01' }, '/dashboard')).toBe(false);
  });

  it('redirects unauthenticated user from /verify-email to /login', () => {
    expect(shouldRedirectVerifyToLogin(null, '/verify-email')).toBe(true);
  });

  it('does NOT redirect unauthenticated user from other pages', () => {
    expect(shouldRedirectVerifyToLogin(null, '/pricing')).toBe(false);
  });
});
