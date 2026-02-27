// ---------------------------------------------------------------------------
// gbp-token-refresh.test.ts — Unit tests for GBP token refresh service
//
// Sprint 90: Tests refreshGBPAccessToken() and refreshExpiringTokens().
// Uses MSW to mock Google's OAuth token endpoint.
//
// Run:
//   npx vitest run src/__tests__/unit/gbp-token-refresh.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/__helpers__/setup';

// ── Hoist mocks ───────────────────────────────────────────────────────────

const mockFrom = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(() => ({ from: mockFrom })),
}));

// ── Import subjects ───────────────────────────────────────────────────────

import {
  isTokenExpired,
  refreshGBPAccessToken,
  refreshExpiringTokens,
} from '@/lib/services/gbp-token-refresh';

// ── Shared fixtures ───────────────────────────────────────────────────────

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const REFRESH_TOKEN = 'mock-refresh-token-123';

function mockGoogleTokenEndpoint(ok = true) {
  server.use(
    http.post('https://oauth2.googleapis.com/token', () => {
      if (!ok) return HttpResponse.json({ error: 'invalid_grant' }, { status: 400 });
      return HttpResponse.json({
        access_token: 'new-access-token-xyz',
        expires_in: 3600,
        token_type: 'Bearer',
      });
    }),
  );
}

function mockTokenUpdate(error: unknown = null) {
  const mockEq = vi.fn().mockResolvedValue({ data: null, error });
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ update: mockUpdate });
  return { mockUpdate, mockEq };
}

function mockExpiringTokensQuery(tokens: Array<{ org_id: string; refresh_token: string; expires_at: string }> = []) {
  const mockNot = vi.fn().mockResolvedValue({ data: tokens, error: null });
  const mockLt = vi.fn().mockReturnValue({ not: mockNot });
  const mockSelect = vi.fn().mockReturnValue({ lt: mockLt });

  // For the update chain after refresh
  const mockUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'google_oauth_tokens') {
      return { select: mockSelect, update: mockUpdate };
    }
    return {};
  });

  return { mockSelect, mockLt };
}

// ── Environment ───────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
});

afterEach(() => {
  vi.clearAllMocks();
  server.resetHandlers();
});

// ═══════════════════════════════════════════════════════════════════════════
// isTokenExpired — Sprint 89 addition — 5 tests
// ═══════════════════════════════════════════════════════════════════════════

describe('isTokenExpired', () => {
  it('returns true when expiresAt is null', () => {
    expect(isTokenExpired(null)).toBe(true);
  });

  it('returns true when expiresAt is in the past', () => {
    const pastDate = new Date(Date.now() - 60000).toISOString();
    expect(isTokenExpired(pastDate)).toBe(true);
  });

  it('returns true when token expires within 5 minutes', () => {
    const soonDate = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    expect(isTokenExpired(soonDate)).toBe(true);
  });

  it('returns false when token expires in > 5 minutes', () => {
    const futureDate = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    expect(isTokenExpired(futureDate)).toBe(false);
  });

  it('returns false when token expires exactly 10 minutes from now', () => {
    const tenMin = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    expect(isTokenExpired(tenMin)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// refreshGBPAccessToken — 7 tests
// ═══════════════════════════════════════════════════════════════════════════

describe('refreshGBPAccessToken', () => {
  it('should refresh token and update DB on success', async () => {
    mockGoogleTokenEndpoint(true);
    const { mockUpdate } = mockTokenUpdate();

    const result = await refreshGBPAccessToken(ORG_ID, REFRESH_TOKEN);

    expect(result.success).toBe(true);
    expect(result.orgId).toBe(ORG_ID);
    expect(result.newExpiresAt).toBeDefined();
    expect(result.newAccessToken).toBe('new-access-token-xyz');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ access_token: 'new-access-token-xyz' }),
    );
  });

  it('should return error when Google returns non-200', async () => {
    mockGoogleTokenEndpoint(false);
    mockTokenUpdate();

    const result = await refreshGBPAccessToken(ORG_ID, REFRESH_TOKEN);

    expect(result.success).toBe(false);
    expect(result.error).toContain('400');
  });

  it('should return error when DB update fails', async () => {
    mockGoogleTokenEndpoint(true);
    mockTokenUpdate({ message: 'DB connection error' });

    const result = await refreshGBPAccessToken(ORG_ID, REFRESH_TOKEN);

    expect(result.success).toBe(false);
    expect(result.error).toContain('DB update failed');
  });

  it('should send correct parameters to Google token endpoint', async () => {
    let capturedBody: string | undefined;
    server.use(
      http.post('https://oauth2.googleapis.com/token', async ({ request }) => {
        capturedBody = await request.text();
        return HttpResponse.json({ access_token: 'tok', expires_in: 3600 });
      }),
    );
    mockTokenUpdate();

    await refreshGBPAccessToken(ORG_ID, REFRESH_TOKEN);

    expect(capturedBody).toContain('grant_type=refresh_token');
    expect(capturedBody).toContain(`refresh_token=${REFRESH_TOKEN}`);
    expect(capturedBody).toContain('client_id=test-client-id');
  });

  it('should handle network errors gracefully', async () => {
    server.use(
      http.post('https://oauth2.googleapis.com/token', () => {
        return HttpResponse.error();
      }),
    );
    mockTokenUpdate();

    const result = await refreshGBPAccessToken(ORG_ID, REFRESH_TOKEN);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should compute expires_at from expires_in', async () => {
    mockGoogleTokenEndpoint(true);
    mockTokenUpdate();

    const before = Date.now();
    const result = await refreshGBPAccessToken(ORG_ID, REFRESH_TOKEN);
    const after = Date.now();

    expect(result.newExpiresAt).toBeDefined();
    const expiry = new Date(result.newExpiresAt!).getTime();
    // Should be approximately 1 hour from now (3600s)
    expect(expiry).toBeGreaterThan(before + 3500 * 1000);
    expect(expiry).toBeLessThan(after + 3700 * 1000);
  });

  it('should default expires_in to 3600 if not provided', async () => {
    server.use(
      http.post('https://oauth2.googleapis.com/token', () =>
        HttpResponse.json({ access_token: 'tok' }), // no expires_in
      ),
    );
    mockTokenUpdate();

    const result = await refreshGBPAccessToken(ORG_ID, REFRESH_TOKEN);

    expect(result.success).toBe(true);
    const expiry = new Date(result.newExpiresAt!).getTime();
    expect(expiry).toBeGreaterThan(Date.now() + 3500 * 1000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// refreshExpiringTokens — 5 tests
// ═══════════════════════════════════════════════════════════════════════════

describe('refreshExpiringTokens', () => {
  it('should return { total: 0 } when no tokens are expiring', async () => {
    mockExpiringTokensQuery([]);

    const result = await refreshExpiringTokens(60);

    expect(result.total).toBe(0);
    expect(result.refreshed).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('should refresh all expiring tokens and count successes', async () => {
    mockExpiringTokensQuery([
      { org_id: 'org-1', refresh_token: 'rt-1', expires_at: new Date().toISOString() },
      { org_id: 'org-2', refresh_token: 'rt-2', expires_at: new Date().toISOString() },
    ]);
    mockGoogleTokenEndpoint(true);

    const result = await refreshExpiringTokens(60);

    expect(result.total).toBe(2);
    expect(result.refreshed).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('should count failures separately and include error messages', async () => {
    mockExpiringTokensQuery([
      { org_id: 'org-1', refresh_token: 'rt-1', expires_at: new Date().toISOString() },
    ]);
    mockGoogleTokenEndpoint(false); // Google returns 400

    const result = await refreshExpiringTokens(60);

    expect(result.total).toBe(1);
    expect(result.refreshed).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('org-1');
  });

  it('should handle query error gracefully', async () => {
    const mockNot = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB down' } });
    const mockLt = vi.fn().mockReturnValue({ not: mockNot });
    const mockSelect = vi.fn().mockReturnValue({ lt: mockLt });
    mockFrom.mockReturnValue({ select: mockSelect });

    const result = await refreshExpiringTokens(60);

    expect(result.total).toBe(0);
    expect(result.errors[0]).toContain('Query failed');
  });

  it('should query tokens expiring within the specified window', async () => {
    const { mockLt } = mockExpiringTokensQuery([]);

    await refreshExpiringTokens(120); // 2 hours

    expect(mockLt).toHaveBeenCalledWith(
      'expires_at',
      expect.any(String), // ISO string ~2 hours from now
    );
    // Verify the threshold is approximately 2 hours from now
    const threshold = mockLt.mock.calls[0][1];
    const thresholdTime = new Date(threshold).getTime();
    expect(thresholdTime).toBeGreaterThan(Date.now() + 115 * 60 * 1000);
    expect(thresholdTime).toBeLessThan(Date.now() + 125 * 60 * 1000);
  });
});
