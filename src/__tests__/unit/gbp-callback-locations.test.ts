// ---------------------------------------------------------------------------
// gbp-callback-locations.test.ts — Unit tests for OAuth callback location flow
//
// Sprint 89: 7 tests — uses MSW for external HTTP, mocks cookies + Supabase.
//
// Run:
//   npx vitest run src/__tests__/unit/gbp-callback-locations.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/__helpers__/setup';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCookies: Record<string, string> = {};
const mockCookieSet = vi.fn();
const mockCookieDelete = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: (name: string) =>
      mockCookies[name] ? { value: mockCookies[name] } : undefined,
    set: (...args: unknown[]) => mockCookieSet(...args),
    delete: (...args: unknown[]) => mockCookieDelete(...args),
  }),
}));

// Supabase mock
const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockInsertSingle = vi.fn();
const mockInsertSelect = vi.fn().mockReturnValue({ single: mockInsertSingle });
const mockInsert = vi.fn().mockReturnValue({ select: mockInsertSelect });
const mockCountEq2 = vi.fn().mockResolvedValue({ count: 0 });
const mockCountEq1 = vi.fn().mockReturnValue({ eq: mockCountEq2 });
const mockCountSelect = vi.fn().mockReturnValue({ eq: mockCountEq1 });

const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'google_oauth_tokens') return { upsert: mockUpsert };
  if (table === 'pending_gbp_imports') return { insert: mockInsert };
  if (table === 'locations') return { select: mockCountSelect, insert: mockInsert };
  if (table === 'location_integrations') return { upsert: mockUpsert };
  return {};
});

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock('@/lib/services/sov-seed', () => ({
  seedSOVQueries: vi.fn().mockResolvedValue({ seeded: 5 }),
}));

// ---------------------------------------------------------------------------
// MSW helpers — register Google API handlers per test
// ---------------------------------------------------------------------------

function setupGoogleHandlers(config: {
  tokenOk?: boolean;
  accounts?: Array<{ name: string }> | null;
  locations?: Array<Record<string, unknown>> | null;
  hasMore?: boolean;
}) {
  server.use(
    // Token exchange
    http.post('https://oauth2.googleapis.com/token', () => {
      if (!config.tokenOk) {
        return HttpResponse.text('token error', { status: 400 });
      }
      return HttpResponse.json({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'business.manage',
      });
    }),
    // Accounts
    http.get('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', () => {
      return HttpResponse.json({ accounts: config.accounts ?? [] });
    }),
    // Userinfo
    http.get('https://www.googleapis.com/oauth2/v2/userinfo', () => {
      return HttpResponse.json({ email: 'test@example.com' });
    }),
    // Locations — use wildcard to match nested account path (accounts/111/locations)
    http.get('https://mybusinessbusinessinformation.googleapis.com/v1/accounts/:accountId/locations', () => {
      if (config.locations === null) {
        return HttpResponse.text('API error', { status: 500 });
      }
      return HttpResponse.json({
        locations: config.locations ?? [],
        nextPageToken: config.hasMore ? 'next-page' : undefined,
      });
    }),
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const APP_URL = 'http://localhost:3000';

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL(`${APP_URL}/api/auth/google/callback`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

function setDefaultCookies() {
  mockCookies['google_oauth_state'] = 'valid-state';
  mockCookies['google_oauth_org'] = 'org-123';
  mockCookies['gbp_oauth_source'] = 'onboarding';
}

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

const { GET } = await import('@/app/api/auth/google/callback/route');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/auth/google/callback — location flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockCookies).forEach((k) => delete mockCookies[k]);
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.NEXT_PUBLIC_APP_URL = APP_URL;
  });

  it('auto-imports when exactly 1 GBP location → redirect to /dashboard', async () => {
    setDefaultCookies();
    setupGoogleHandlers({
      tokenOk: true,
      accounts: [{ name: 'accounts/111' }],
      locations: [
        {
          name: 'accounts/111/locations/222',
          title: 'Solo Spot',
          regularHours: {
            periods: [
              { openDay: 'MONDAY', openTime: { hours: 9 }, closeDay: 'MONDAY', closeTime: { hours: 17 } },
            ],
          },
        },
      ],
    });

    mockInsertSingle.mockResolvedValue({
      data: { id: 'loc-auto-1' },
      error: null,
    });

    const res = await GET(makeRequest({ code: 'test-code', state: 'valid-state' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/dashboard');
    expect(res.headers.get('location')).not.toContain('/onboarding');
  });

  it('writes to pending_gbp_imports when 2+ locations → redirect to /onboarding/connect/select', async () => {
    setDefaultCookies();
    setupGoogleHandlers({
      tokenOk: true,
      accounts: [{ name: 'accounts/111' }],
      locations: [
        { name: 'accounts/111/locations/222', title: 'Spot A' },
        { name: 'accounts/111/locations/333', title: 'Spot B' },
      ],
    });

    mockInsertSingle.mockResolvedValue({
      data: { id: 'pending-uuid-1' },
      error: null,
    });

    const res = await GET(makeRequest({ code: 'test-code', state: 'valid-state' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/onboarding/connect/select');
  });

  it('sets gbp_import_id cookie for multi-location flow', async () => {
    setDefaultCookies();
    setupGoogleHandlers({
      tokenOk: true,
      accounts: [{ name: 'accounts/111' }],
      locations: [
        { name: 'accounts/111/locations/222', title: 'Spot A' },
        { name: 'accounts/111/locations/333', title: 'Spot B' },
      ],
    });

    mockInsertSingle.mockResolvedValue({
      data: { id: 'pending-uuid-1' },
      error: null,
    });

    await GET(makeRequest({ code: 'test-code', state: 'valid-state' }));
    expect(mockCookieSet).toHaveBeenCalledWith(
      'gbp_import_id',
      'pending-uuid-1',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('redirects to /onboarding?source=gbp_no_accounts when 0 accounts', async () => {
    setDefaultCookies();
    setupGoogleHandlers({
      tokenOk: true,
      accounts: [],
    });

    const res = await GET(makeRequest({ code: 'test-code', state: 'valid-state' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('source=gbp_no_accounts');
  });

  it('redirects to /onboarding?source=gbp_no_locations when 0 locations', async () => {
    setDefaultCookies();
    setupGoogleHandlers({
      tokenOk: true,
      accounts: [{ name: 'accounts/111' }],
      locations: [],
    });

    const res = await GET(makeRequest({ code: 'test-code', state: 'valid-state' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('source=gbp_no_locations');
  });

  it('redirects to /onboarding?source=gbp_failed on GBP API error', async () => {
    setDefaultCookies();
    setupGoogleHandlers({
      tokenOk: true,
      accounts: [{ name: 'accounts/111' }],
      locations: null, // triggers API error
    });

    const res = await GET(makeRequest({ code: 'test-code', state: 'valid-state' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('source=gbp_failed');
  });

  it('stores tokens in google_oauth_tokens before fetching locations', async () => {
    setDefaultCookies();
    setupGoogleHandlers({
      tokenOk: true,
      accounts: [{ name: 'accounts/111' }],
      locations: [],
    });

    await GET(makeRequest({ code: 'test-code', state: 'valid-state' }));

    expect(mockFrom).toHaveBeenCalledWith('google_oauth_tokens');
    expect(mockUpsert).toHaveBeenCalled();
    const upsertArgs = mockUpsert.mock.calls[0][0];
    expect(upsertArgs.access_token).toBe('test-access-token');
    expect(upsertArgs.org_id).toBe('org-123');
  });
});
