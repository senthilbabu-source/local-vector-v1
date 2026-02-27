// ---------------------------------------------------------------------------
// gbp-callback-locations.test.ts — Unit tests for GBP OAuth callback rewrite
//
// Sprint 89: Tests the callback's new location-fetching + routing logic.
// Uses MSW to mock all Google API calls. NextRequest for route handler input.
//
// Run:
//   npx vitest run src/__tests__/unit/gbp-callback-locations.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { http, HttpResponse } from 'msw';
import { server } from '@/__helpers__/setup';
import {
  MOCK_GBP_ACCOUNT,
  MOCK_GBP_LOCATION,
  MOCK_GBP_LOCATION_SECOND,
} from '@/__fixtures__/golden-tenant';

// ── Hoist vi.mock declarations ────────────────────────────────────────────

const mockCookieStore: Record<string, string> = {
  google_oauth_state: 'test-state-123',
  google_oauth_org: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  gbp_oauth_source: 'onboarding',
};

vi.mock('@/lib/supabase/server', () => ({ createServiceRoleClient: vi.fn() }));
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn((name: string) => mockCookieStore[name] ? { value: mockCookieStore[name] } : undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));
// Mock sov-seed so auto-import doesn't fail on seeding
vi.mock('@/lib/services/sov-seed', () => ({
  seedSOVQueries: vi.fn().mockResolvedValue({ seeded: 10 }),
}));

// ── Import subjects ───────────────────────────────────────────────────────

import { GET } from '@/app/api/auth/google/callback/route';
import { createServiceRoleClient } from '@/lib/supabase/server';

// ── Shared fixtures ───────────────────────────────────────────────────────

const APP_URL = 'http://localhost:3000';

function makeCallbackRequest(overrides: Record<string, string> = {}): NextRequest {
  const params = new URLSearchParams({
    code: 'test-auth-code',
    state: 'test-state-123',
    ...overrides,
  });
  return new NextRequest(`${APP_URL}/api/auth/google/callback?${params.toString()}`);
}

function setupGoogleAPIs({
  tokenOk = true,
  accounts = [MOCK_GBP_ACCOUNT],
  locations = [MOCK_GBP_LOCATION] as unknown[],
  nextPageToken,
}: {
  tokenOk?: boolean;
  accounts?: unknown[];
  locations?: unknown[];
  nextPageToken?: string;
} = {}) {
  server.use(
    http.post('https://oauth2.googleapis.com/token', () => {
      if (!tokenOk) return HttpResponse.json({ error: 'invalid_grant' }, { status: 400 });
      return HttpResponse.json({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      });
    }),
    http.get('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', () =>
      HttpResponse.json({ accounts })
    ),
    http.get('https://mybusinessbusinessinformation.googleapis.com/v1/accounts/:accountId/locations', () =>
      HttpResponse.json({ locations, ...(nextPageToken ? { nextPageToken } : {}) })
    ),
    http.get('https://www.googleapis.com/oauth2/v2/userinfo', () =>
      HttpResponse.json({ email: 'aruna@charcoalnchill.com' })
    ),
  );
}

function createMockServiceRoleClient() {
  const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockInsertSingle = vi.fn().mockResolvedValue({ data: { id: 'pending-import-id-001' }, error: null });
  const mockInsertSelect = vi.fn().mockReturnValue({ single: mockInsertSingle });
  const mockInsert = vi.fn().mockReturnValue({ select: mockInsertSelect });

  // locations for auto-import
  const countResult = vi.fn().mockResolvedValue({ count: 0, error: null });
  const countEq2 = vi.fn().mockReturnValue(countResult);
  const countEq1 = vi.fn().mockReturnValue({ eq: countEq2 });
  const locSelect = vi.fn().mockReturnValue({ eq: countEq1 });
  const locInsertSingle = vi.fn().mockResolvedValue({ data: { id: 'new-loc-id' }, error: null });
  const locInsertSelect = vi.fn().mockReturnValue({ single: locInsertSingle });
  const locInsert = vi.fn().mockReturnValue({ select: locInsertSelect });

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'google_oauth_tokens') return { upsert: mockUpsert };
    if (table === 'pending_gbp_imports') return { insert: mockInsert };
    if (table === 'locations') return { select: locSelect, insert: locInsert };
    if (table === 'location_integrations') return { upsert: mockUpsert };
    return {};
  });
  vi.mocked(createServiceRoleClient).mockReturnValue({ from } as never);
  return { from, mockUpsert, mockInsert, locInsert };
}

// ── Environment ───────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.NEXT_PUBLIC_APP_URL = APP_URL;
});

afterEach(() => {
  vi.clearAllMocks();
  server.resetHandlers();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/auth/google/callback — location flow', () => {
  it('should auto-import when exactly 1 GBP location → redirect contains /dashboard', async () => {
    setupGoogleAPIs({ locations: [MOCK_GBP_LOCATION] });
    const { locInsert } = createMockServiceRoleClient();
    const response = await GET(makeCallbackRequest());
    expect(response.status).toBe(307);
    const loc = response.headers.get('location') ?? '';
    expect(loc).toContain('/dashboard');
    expect(loc).not.toContain('/onboarding/connect/select');
    expect(locInsert).toHaveBeenCalled();
  });

  it('should write to pending_gbp_imports when 2+ locations → redirect to picker', async () => {
    setupGoogleAPIs({ locations: [MOCK_GBP_LOCATION, MOCK_GBP_LOCATION_SECOND] });
    const { mockInsert, locInsert } = createMockServiceRoleClient();
    const response = await GET(makeCallbackRequest());
    const loc = response.headers.get('location') ?? '';
    expect(loc).toContain('/onboarding/connect/select');
    expect(mockInsert).toHaveBeenCalled();
    expect(locInsert).not.toHaveBeenCalled();
  });

  it('should store tokens in google_oauth_tokens before routing', async () => {
    setupGoogleAPIs({ locations: [MOCK_GBP_LOCATION] });
    const { mockUpsert } = createMockServiceRoleClient();
    await GET(makeCallbackRequest());
    expect(mockUpsert).toHaveBeenCalled();
    const call = mockUpsert.mock.calls[0][0];
    expect(call.access_token).toBe('mock-access-token');
    expect(call.org_id).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
  });

  it('should redirect with source=gbp_no_accounts when 0 accounts', async () => {
    setupGoogleAPIs({ accounts: [] });
    createMockServiceRoleClient();
    const response = await GET(makeCallbackRequest());
    const loc = response.headers.get('location') ?? '';
    expect(loc).toContain('source=gbp_no_accounts');
  });

  it('should redirect with source=gbp_no_locations when 0 locations', async () => {
    setupGoogleAPIs({ locations: [] });
    createMockServiceRoleClient();
    const response = await GET(makeCallbackRequest());
    const loc = response.headers.get('location') ?? '';
    expect(loc).toContain('source=gbp_no_locations');
  });

  it('should redirect with source=gbp_failed on token exchange failure', async () => {
    setupGoogleAPIs({ tokenOk: false });
    createMockServiceRoleClient();
    const response = await GET(makeCallbackRequest());
    const loc = response.headers.get('location') ?? '';
    expect(loc).toMatch(/gbp_failed|gbp_error/);
  });

  it('should redirect with gbp_denied when user denies OAuth', async () => {
    const request = new NextRequest(
      `${APP_URL}/api/auth/google/callback?error=access_denied`
    );
    const response = await GET(request);
    const loc = response.headers.get('location') ?? '';
    expect(loc).toMatch(/gbp_denied|access_denied/);
  });

  it('should redirect with error on CSRF state mismatch', async () => {
    const request = new NextRequest(
      `${APP_URL}/api/auth/google/callback?code=test&state=wrong-state-value`
    );
    const response = await GET(request);
    expect(response.status).toBe(307);
    const loc = response.headers.get('location') ?? '';
    expect(loc).toMatch(/gbp_error|gbp_failed|csrf/);
  });

  it('should set has_more=true when nextPageToken is present', async () => {
    setupGoogleAPIs({
      locations: [MOCK_GBP_LOCATION, MOCK_GBP_LOCATION_SECOND],
      nextPageToken: 'page2token',
    });
    const { mockInsert } = createMockServiceRoleClient();
    await GET(makeCallbackRequest());
    expect(mockInsert).toHaveBeenCalled();
    const arg = mockInsert.mock.calls[0][0];
    expect(arg.has_more).toBe(true);
  });
});
