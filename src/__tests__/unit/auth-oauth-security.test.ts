/**
 * Unit Tests — §325 Google OAuth Security
 *
 * Tests the Google OAuth 2.0 initiation and callback routes for CSRF protection,
 * token storage isolation, cookie security, and error handling.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/auth-oauth-security.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

// -- Auth context --
const mockGetAuthContext = vi.fn();
vi.mock('@/lib/auth', () => ({
  getAuthContext: (...args: unknown[]) => mockGetAuthContext(...args),
  getSafeAuthContext: vi.fn(),
}));

// -- Supabase server --
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
  createServiceRoleClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// -- Sentry --
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

// -- Next.js cookies --
const mockCookies: Record<string, string> = {};
const mockCookieSet = vi.fn((name: string, value: string) => {
  mockCookies[name] = value;
});
const mockCookieGet = vi.fn((name: string) => {
  if (name in mockCookies) return { value: mockCookies[name] };
  return undefined;
});
const mockCookieDelete = vi.fn((name: string) => {
  delete mockCookies[name];
});

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: mockCookieGet,
    set: mockCookieSet,
    delete: mockCookieDelete,
  })),
  headers: vi.fn(async () => new Map()),
}));

// -- GBP mapper --
vi.mock('@/lib/services/gbp-mapper', () => ({
  mapGBPLocationToRow: vi.fn(() => ({
    business_name: 'Test Biz',
    city: 'Atlanta',
    state: 'GA',
    hours_data: null,
    amenities: null,
  })),
}));

// -- SOV seed --
vi.mock('@/lib/services/sov-seed', () => ({
  seedSOVQueries: vi.fn(async () => {}),
}));

// -- Global fetch mock --
const mockFetch = vi.fn();
// Must restub after clearAllMocks in each test group
function stubFetch() {
  vi.stubGlobal('fetch', mockFetch);
}

// ---------------------------------------------------------------------------
// Route imports
// ---------------------------------------------------------------------------

import { GET as initiateOAuth } from '@/app/api/auth/google/route';
import { GET as oauthCallback } from '@/app/api/auth/google/callback/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInitiateRequest(source = 'integrations'): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/auth/google?source=${source}`,
  );
}

function makeCallbackRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/auth/google/callback');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

// ---------------------------------------------------------------------------
// Flow 1: OAuth Initiation Security
// ---------------------------------------------------------------------------

describe('OAuth initiation — GET /api/auth/google', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockCookies).forEach((k) => delete mockCookies[k]);
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetAuthContext.mockRejectedValue(new Error('Unauthorized'));

    const res = await initiateOAuth(makeInitiateRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 503 when GOOGLE_CLIENT_ID is not configured', async () => {
    delete process.env.GOOGLE_CLIENT_ID;

    const res = await initiateOAuth(makeInitiateRequest());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain('not configured');
  });

  it('redirects to Google with correct parameters', async () => {
    mockGetAuthContext.mockResolvedValue({
      userId: 'auth-uuid',
      orgId: 'org-1',
      role: 'owner',
      org: { plan: 'growth' },
    });

    const res = await initiateOAuth(makeInitiateRequest());
    expect(res.status).toBe(307); // redirect

    const location = res.headers.get('location')!;
    expect(location).toContain('accounts.google.com/o/oauth2/v2/auth');
    expect(location).toContain('client_id=test-client-id');
    expect(location).toContain('response_type=code');
    expect(location).toContain('access_type=offline');
    expect(location).toContain('prompt=consent');
    expect(location).toContain('business.manage');
    expect(location).toContain('state=');
  });

  it('sets CSRF state cookie as httpOnly with 10-min maxAge', async () => {
    mockGetAuthContext.mockResolvedValue({
      userId: 'auth-uuid',
      orgId: 'org-1',
      role: 'owner',
      org: { plan: 'growth' },
    });

    await initiateOAuth(makeInitiateRequest());

    // Verify state cookie was set with security attributes
    const stateCall = mockCookieSet.mock.calls.find(
      (c: unknown[]) => c[0] === 'google_oauth_state',
    );
    expect(stateCall).toBeDefined();
    expect(stateCall![2]).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 600,
      path: '/api/auth/google/callback',
    });
  });

  it('generates 32-byte random state (64 hex chars)', async () => {
    mockGetAuthContext.mockResolvedValue({
      userId: 'auth-uuid',
      orgId: 'org-1',
      role: 'owner',
      org: { plan: 'growth' },
    });

    await initiateOAuth(makeInitiateRequest());

    const stateCall = mockCookieSet.mock.calls.find(
      (c: unknown[]) => c[0] === 'google_oauth_state',
    );
    const stateValue = stateCall![1] as string;
    expect(stateValue).toMatch(/^[0-9a-f]{64}$/);
  });

  it('stores org_id in httpOnly cookie for callback association', async () => {
    mockGetAuthContext.mockResolvedValue({
      userId: 'auth-uuid',
      orgId: 'org-42',
      role: 'owner',
      org: { plan: 'growth' },
    });

    await initiateOAuth(makeInitiateRequest());

    const orgCall = mockCookieSet.mock.calls.find(
      (c: unknown[]) => c[0] === 'google_oauth_org',
    );
    expect(orgCall).toBeDefined();
    expect(orgCall![1]).toBe('org-42');
    expect(orgCall![2]).toMatchObject({ httpOnly: true, maxAge: 600 });
  });

  it('stores OAuth source in cookie for redirect routing', async () => {
    mockGetAuthContext.mockResolvedValue({
      userId: 'auth-uuid',
      orgId: 'org-1',
      role: 'owner',
      org: { plan: 'growth' },
    });

    await initiateOAuth(makeInitiateRequest('onboarding'));

    const sourceCall = mockCookieSet.mock.calls.find(
      (c: unknown[]) => c[0] === 'gbp_oauth_source',
    );
    expect(sourceCall).toBeDefined();
    expect(sourceCall![1]).toBe('onboarding');
  });

  it('state in redirect URL matches state in cookie', async () => {
    mockGetAuthContext.mockResolvedValue({
      userId: 'auth-uuid',
      orgId: 'org-1',
      role: 'owner',
      org: { plan: 'growth' },
    });

    const res = await initiateOAuth(makeInitiateRequest());
    const location = res.headers.get('location')!;
    const urlState = new URL(location).searchParams.get('state');

    const cookieState = mockCookieSet.mock.calls.find(
      (c: unknown[]) => c[0] === 'google_oauth_state',
    )![1];

    expect(urlState).toBe(cookieState);
  });
});

// ---------------------------------------------------------------------------
// Flow 2: OAuth Callback — CSRF Validation
// ---------------------------------------------------------------------------

describe('OAuth callback — CSRF state validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockCookies).forEach((k) => delete mockCookies[k]);
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  it('redirects with error when state parameter is missing', async () => {
    const res = await oauthCallback(
      makeCallbackRequest({ code: 'auth-code' }),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('gbp_failed');
  });

  it('redirects with error when code parameter is missing', async () => {
    const res = await oauthCallback(
      makeCallbackRequest({ state: 'some-state' }),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('gbp_failed');
  });

  it('redirects with error when state does not match cookie', async () => {
    mockCookies['google_oauth_state'] = 'correct-state';
    mockCookies['google_oauth_org'] = 'org-1';

    const res = await oauthCallback(
      makeCallbackRequest({ code: 'auth-code', state: 'wrong-state' }),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('gbp_failed');
  });

  it('redirects with error when state cookie is missing', async () => {
    // No google_oauth_state cookie set
    mockCookies['google_oauth_org'] = 'org-1';

    const res = await oauthCallback(
      makeCallbackRequest({ code: 'auth-code', state: 'any-state' }),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('gbp_failed');
  });

  it('redirects with error when org cookie is missing', async () => {
    mockCookies['google_oauth_state'] = 'valid-state';
    // No google_oauth_org cookie

    const res = await oauthCallback(
      makeCallbackRequest({ code: 'auth-code', state: 'valid-state' }),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('gbp_failed');
  });

  it('cleans up OAuth cookies after callback (even on error)', async () => {
    mockCookies['google_oauth_state'] = 'valid-state';
    mockCookies['google_oauth_org'] = 'org-1';
    mockCookies['gbp_oauth_source'] = 'integrations';

    await oauthCallback(
      makeCallbackRequest({ code: 'auth-code', state: 'wrong-state' }),
    );

    // All 3 OAuth cookies should be deleted
    expect(mockCookieDelete).toHaveBeenCalledWith('google_oauth_state');
    expect(mockCookieDelete).toHaveBeenCalledWith('google_oauth_org');
    expect(mockCookieDelete).toHaveBeenCalledWith('gbp_oauth_source');
  });
});

// ---------------------------------------------------------------------------
// Flow 3: OAuth Callback — User Consent Denied
// ---------------------------------------------------------------------------

describe('OAuth callback — user denied consent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockCookies).forEach((k) => delete mockCookies[k]);
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  it('redirects with gbp_denied when Google returns error param', async () => {
    const res = await oauthCallback(
      makeCallbackRequest({ error: 'access_denied' }),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('gbp_denied');
  });

  it('routes onboarding source to /onboarding redirect', async () => {
    mockCookies['gbp_oauth_source'] = 'onboarding';

    const res = await oauthCallback(
      makeCallbackRequest({ error: 'access_denied' }),
    );
    expect(res.headers.get('location')).toContain('/onboarding');
  });

  it('routes integrations source to /dashboard/integrations redirect', async () => {
    mockCookies['gbp_oauth_source'] = 'integrations';

    const res = await oauthCallback(
      makeCallbackRequest({ error: 'access_denied' }),
    );
    expect(res.headers.get('location')).toContain('/dashboard/integrations');
  });
});

// ---------------------------------------------------------------------------
// Flow 4: OAuth Callback — Token Exchange Security
// ---------------------------------------------------------------------------

describe('OAuth callback — token exchange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubFetch();
    Object.keys(mockCookies).forEach((k) => delete mockCookies[k]);
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

    // Set valid state
    mockCookies['google_oauth_state'] = 'valid-csrf-state';
    mockCookies['google_oauth_org'] = 'org-1';
    mockCookies['gbp_oauth_source'] = 'integrations';
  });

  it('exchanges code server-side (client_secret never in response)', async () => {
    // Token exchange succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'at-secret',
        refresh_token: 'rt-secret',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    });

    // Accounts API — no accounts
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: [] }),
    });

    // Userinfo
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ email: 'user@google.com' }),
    });

    // DB upsert
    mockFrom.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });

    const res = await oauthCallback(
      makeCallbackRequest({ code: 'auth-code', state: 'valid-csrf-state' }),
    );

    // The token exchange call should include client_secret in the body
    const tokenCall = mockFetch.mock.calls[0];
    const body = tokenCall[1].body as URLSearchParams;
    expect(body.get('client_secret')).toBe('test-secret');
    expect(body.get('grant_type')).toBe('authorization_code');

    // Response should be a redirect, never containing tokens
    expect(res.status).toBe(307);
    const location = res.headers.get('location')!;
    expect(location).not.toContain('at-secret');
    expect(location).not.toContain('rt-secret');
  });

  it('redirects with error when token exchange fails (HTTP error)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => '{"error": "invalid_grant"}',
    });

    const res = await oauthCallback(
      makeCallbackRequest({ code: 'bad-code', state: 'valid-csrf-state' }),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('gbp_failed');
  });

  it('redirects with error when token exchange throws (network error)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('DNS resolution failed'));

    const res = await oauthCallback(
      makeCallbackRequest({ code: 'auth-code', state: 'valid-csrf-state' }),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('gbp_failed');
  });

  it('redirects with error when env vars are missing', async () => {
    delete process.env.GOOGLE_CLIENT_SECRET;

    const res = await oauthCallback(
      makeCallbackRequest({ code: 'auth-code', state: 'valid-csrf-state' }),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('gbp_failed');
  });
});

// ---------------------------------------------------------------------------
// Flow 5: Token storage isolation
// ---------------------------------------------------------------------------

describe('OAuth callback — token storage security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubFetch();
    Object.keys(mockCookies).forEach((k) => delete mockCookies[k]);
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    mockCookies['google_oauth_state'] = 'valid-csrf-state';
    mockCookies['google_oauth_org'] = 'org-1';
    mockCookies['gbp_oauth_source'] = 'integrations';
  });

  it('uses createServiceRoleClient for token storage (not user RLS client)', async () => {
    // The callback route imports createServiceRoleClient (not createClient)
    // This is verified by the import statement in the route file
    // Here we verify the route uses it for DB operations by checking mockFrom is called
    const { createServiceRoleClient } = await import('@/lib/supabase/server');

    // Token exchange — return tokens
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'access-tok',
        refresh_token: 'refresh-tok',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    });
    // Accounts — empty (triggers early redirect, avoiding complex mock chain)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: [] }),
    });
    // Userinfo
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ email: 'u@g.com' }),
    });
    // Token upsert
    mockFrom.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });

    await oauthCallback(
      makeCallbackRequest({ code: 'auth-code', state: 'valid-csrf-state' }),
    );

    // Service-role client was used (not the user-scoped createClient)
    expect(createServiceRoleClient).toHaveBeenCalled();
    // google_oauth_tokens table was accessed via from()
    expect(mockFrom).toHaveBeenCalledWith('google_oauth_tokens');
  });

  it('redirect URL never contains tokens', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'super-secret-token',
        refresh_token: 'super-secret-refresh',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: [] }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ email: 'u@g.com' }),
    });
    mockFrom.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });

    const res = await oauthCallback(
      makeCallbackRequest({ code: 'auth-code', state: 'valid-csrf-state' }),
    );

    const location = res.headers.get('location') ?? '';
    expect(location).not.toContain('super-secret-token');
    expect(location).not.toContain('super-secret-refresh');
    expect(location).not.toContain('access_token');
    expect(location).not.toContain('refresh_token');
  });
});

// ---------------------------------------------------------------------------
// Flow 6: Multi-location cookie-pointer pattern
// ---------------------------------------------------------------------------

describe('OAuth callback — multi-location cookie pointer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubFetch();
    Object.keys(mockCookies).forEach((k) => delete mockCookies[k]);
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    mockCookies['google_oauth_state'] = 'valid-state';
    mockCookies['google_oauth_org'] = 'org-1';
    mockCookies['gbp_oauth_source'] = 'onboarding';
  });

  it('stores UUID in cookie (not raw location JSON) for multi-location flow', async () => {
    // Token exchange
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'tok',
        refresh_token: 'ref',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    });

    // Accounts
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accounts: [{ name: 'accounts/123' }],
      }),
    });

    // Userinfo
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ email: 'u@g.com' }),
    });

    // Token upsert
    mockFrom.mockReturnValueOnce({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });

    // Locations — multiple
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        locations: [
          { name: 'locations/1', title: 'Loc A' },
          { name: 'locations/2', title: 'Loc B' },
        ],
      }),
    });

    // pending_gbp_imports insert
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'import-uuid-123' },
            error: null,
          }),
        }),
      }),
    });

    const res = await oauthCallback(
      makeCallbackRequest({ code: 'auth-code', state: 'valid-state' }),
    );

    // Verify redirect to picker page
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/onboarding/connect/select');

    // Verify import cookie stores UUID, not raw JSON
    const importCookieCall = mockCookieSet.mock.calls.find(
      (c: unknown[]) => c[0] === 'gbp_import_id',
    );
    expect(importCookieCall).toBeDefined();
    expect(importCookieCall![1]).toBe('import-uuid-123');
    expect(importCookieCall![2]).toMatchObject({
      httpOnly: true,
      maxAge: 600,
    });
  });
});
