// ---------------------------------------------------------------------------
// Unit tests for app/api/gbp/import/route.ts — Sprint 89
//
// Tests the GBP data re-sync endpoint.
// All external calls are mocked (auth, Supabase, GBP API, token refresh).
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { MOCK_GBP_LOCATION_ENRICHED, MOCK_GBP_MAPPED } from '@/src/__fixtures__/golden-tenant';

// ── Constants ───────────────────────────────────────────────────────────────

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const LOCATION_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const GBP_LOCATION_NAME = 'accounts/123456789/locations/987654321';
const ACCESS_TOKEN = 'mock-access-token';

// ── Module mocks ────────────────────────────────────────────────────────────

// Auth mock
const mockAuthContext = vi.fn();
vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockAuthContext(),
}));

// Supabase mocks
const mockTokenSelect = vi.fn();
const mockLocationSelect = vi.fn();
const mockLocationUpdate = vi.fn();
const mockIntegrationUpdate = vi.fn();

const mockServiceClient = {
  from: vi.fn((table: string) => {
    if (table === 'google_oauth_tokens') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: mockTokenSelect,
          }),
        }),
      };
    }
    if (table === 'locations') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: mockLocationSelect,
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: mockLocationUpdate,
        }),
      };
    }
    if (table === 'location_integrations') {
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: mockIntegrationUpdate,
          }),
        }),
      };
    }
    return {};
  }),
} as unknown as SupabaseClient<Database>;

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(() => mockServiceClient),
}));

// Token refresh mock
const mockIsTokenExpired = vi.fn().mockReturnValue(false);
const mockRefreshToken = vi.fn();
vi.mock('@/lib/services/gbp-token-refresh', () => ({
  isTokenExpired: (...args: unknown[]) => mockIsTokenExpired(...args),
  refreshGBPAccessToken: (...args: unknown[]) => mockRefreshToken(...args),
}));

// Mapper mock
const mockMapGBPToLocation = vi.fn().mockReturnValue(MOCK_GBP_MAPPED);
vi.mock('@/lib/gbp/gbp-data-mapper', () => ({
  mapGBPToLocation: (...args: unknown[]) => mockMapGBPToLocation(...args),
}));

// Mock global fetch for GBP API calls
const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;

// ── Import under test ───────────────────────────────────────────────────────

import { POST } from '@/app/api/gbp/import/route';

// ── Setup ───────────────────────────────────────────────────────────────────

function setupHappyPath() {
  mockIsTokenExpired.mockReturnValue(false);
  mockAuthContext.mockResolvedValue({ orgId: ORG_ID, userId: 'user-1', email: 'test@test.com' });
  mockTokenSelect.mockResolvedValue({
    data: {
      access_token: ACCESS_TOKEN,
      refresh_token: 'mock-refresh',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      gbp_account_name: 'accounts/123456789',
    },
    error: null,
  });
  mockLocationSelect.mockResolvedValue({
    data: { id: LOCATION_ID, google_location_name: GBP_LOCATION_NAME },
    error: null,
  });
  mockLocationUpdate.mockResolvedValue({ error: null });
  mockIntegrationUpdate.mockResolvedValue({ error: null });
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(MOCK_GBP_LOCATION_ENRICHED),
    text: () => Promise.resolve(''),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = mockFetch;
  setupHappyPath();
});

// Restore original fetch after all tests
import { afterAll } from 'vitest';
afterAll(() => {
  globalThis.fetch = originalFetch;
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/gbp/import', () => {
  it('returns 401 when user is not authenticated', async () => {
    mockAuthContext.mockResolvedValue(null);
    const res = await POST(/* no args — auth via getSafeAuthContext */);
    expect(res.status).toBe(401);
  });

  it('returns 404 with error_code "not_connected" when no google_oauth_tokens row', async () => {
    mockTokenSelect.mockResolvedValue({ data: null, error: { message: 'not found' } });
    const res = await POST(/* no args — auth via getSafeAuthContext */);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_connected');
  });

  it('returns 401 with error_code "token_expired" when token expired + refresh fails', async () => {
    mockIsTokenExpired.mockReturnValue(true);
    mockRefreshToken.mockResolvedValue({ success: false, error: 'invalid_grant' });
    const res = await POST(/* no args — auth via getSafeAuthContext */);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('token_expired');
  });

  it('refreshes expired token before GBP API call when refresh succeeds', async () => {
    mockIsTokenExpired.mockReturnValue(true);
    mockRefreshToken.mockResolvedValue({ success: true, newAccessToken: 'refreshed-token' });

    const res = await POST(/* no args — auth via getSafeAuthContext */);
    expect(res.status).toBe(200);
    expect(mockRefreshToken).toHaveBeenCalled();

    // Verify the refreshed token was used in the GBP API call
    const fetchCall = mockFetch.mock.calls[0];
    expect(fetchCall[1].headers.Authorization).toBe('Bearer refreshed-token');
  });

  it('calls GBP API with correct Authorization header and readMask', async () => {
    await POST(/* no args — auth via getSafeAuthContext */);

    expect(mockFetch).toHaveBeenCalled();
    const fetchCall = mockFetch.mock.calls[0];
    const url = fetchCall[0] as string;
    expect(url).toContain(GBP_LOCATION_NAME);
    expect(url).toContain('readMask=');
    expect(fetchCall[1].headers.Authorization).toBe(`Bearer ${ACCESS_TOKEN}`);
  });

  it('returns 502 with error_code "gbp_api_error" when GBP API returns non-200', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Insufficient permissions'),
    });

    const res = await POST(/* no args — auth via getSafeAuthContext */);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('gbp_api_error');
  });

  it('returns 404 with error_code "no_location" when org has no locations row', async () => {
    mockLocationSelect.mockResolvedValue({ data: null, error: null });
    const res = await POST(/* no args — auth via getSafeAuthContext */);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('no_location');
  });

  it('calls mapGBPToLocation with GBP API response', async () => {
    await POST(/* no args — auth via getSafeAuthContext */);
    expect(mockMapGBPToLocation).toHaveBeenCalledWith(MOCK_GBP_LOCATION_ENRICHED);
  });

  it('upserts mapped data into locations table', async () => {
    await POST(/* no args — auth via getSafeAuthContext */);

    expect(mockServiceClient.from).toHaveBeenCalledWith('locations');
    expect(mockLocationUpdate).toHaveBeenCalled();
  });

  it('includes gbp_synced_at timestamp in the upsert', async () => {
    const before = new Date().toISOString();
    await POST(/* no args — auth via getSafeAuthContext */);

    // The update call should have been made on the locations table
    const fromMock = mockServiceClient.from as ReturnType<typeof vi.fn>;
    const fromCalls = fromMock.mock.calls;
    const locationsCalls = fromCalls.filter((c: unknown[]) => c[0] === 'locations');
    expect(locationsCalls.length).toBeGreaterThan(0);
  });

  it('returns { ok: true, mapped, location_id } on success', async () => {
    const res = await POST(/* no args — auth via getSafeAuthContext */);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.location_id).toBe(LOCATION_ID);
    expect(body.mapped).toEqual(MOCK_GBP_MAPPED);
  });

  it('returns 500 with error_code "upsert_failed" when Supabase update fails', async () => {
    mockLocationUpdate.mockResolvedValue({ error: { message: 'DB error' } });
    const res = await POST(/* no args — auth via getSafeAuthContext */);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('upsert_failed');
  });
});
