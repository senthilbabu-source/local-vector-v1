// ---------------------------------------------------------------------------
// cron-refresh-tokens-route.test.ts — Route handler tests
//
// Sprint 90: Tests auth guard, kill switch, Inngest dispatch, inline fallback.
// Follows the exact pattern from weekly-digest-cron-route.test.ts.
//
// Run:
//   npx vitest run src/__tests__/unit/cron-refresh-tokens-route.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoist mocks ───────────────────────────────────────────────────────────

const mockInngestSend = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: (...args: unknown[]) => mockInngestSend(...args) },
}));

const mockLogCronStart = vi.fn().mockResolvedValue({ logId: 'log-1', startedAt: Date.now() });
const mockLogCronComplete = vi.fn().mockResolvedValue(undefined);
const mockLogCronFailed = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/services/cron-logger', () => ({
  logCronStart: (...args: unknown[]) => mockLogCronStart(...args),
  logCronComplete: (...args: unknown[]) => mockLogCronComplete(...args),
  logCronFailed: (...args: unknown[]) => mockLogCronFailed(...args),
}));

const mockRefreshExpiringTokens = vi.fn().mockResolvedValue({
  total: 3, refreshed: 2, failed: 1, errors: ['org-3: invalid_grant'],
});
vi.mock('@/lib/services/gbp-token-refresh', () => ({
  refreshExpiringTokens: (...args: unknown[]) => mockRefreshExpiringTokens(...args),
}));

// ── Import subject ────────────────────────────────────────────────────────

import { GET } from '@/app/api/cron/refresh-gbp-tokens/route';

// ── Helper ────────────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/cron/refresh-gbp-tokens', {
    method: 'GET',
    headers,
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/cron/refresh-gbp-tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('CRON_SECRET', 'test-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 401 when CRON_SECRET is missing', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });

  it('returns 401 when authorization header is wrong', async () => {
    const response = await GET(makeRequest({ authorization: 'Bearer wrong' }));
    expect(response.status).toBe(401);
  });

  it('returns skipped when kill switch is active', async () => {
    vi.stubEnv('STOP_TOKEN_REFRESH_CRON', 'true');
    const response = await GET(makeRequest({ authorization: 'Bearer test-secret' }));
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe('Kill switch active');
  });

  it('dispatches to Inngest on happy path', async () => {
    const response = await GET(makeRequest({ authorization: 'Bearer test-secret' }));
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.dispatched).toBe(true);
    expect(mockInngestSend).toHaveBeenCalledWith({
      name: 'cron/gbp-token-refresh.hourly',
      data: {},
    });
  });

  it('falls back to inline when Inngest fails', async () => {
    mockInngestSend.mockRejectedValueOnce(new Error('Inngest down'));
    const response = await GET(makeRequest({ authorization: 'Bearer test-secret' }));
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.total).toBe(3);
    expect(body.refreshed).toBe(2);
    expect(mockRefreshExpiringTokens).toHaveBeenCalledWith(60);
  });

  it('logs cron start and complete', async () => {
    await GET(makeRequest({ authorization: 'Bearer test-secret' }));
    expect(mockLogCronStart).toHaveBeenCalledWith('refresh-gbp-tokens');
    expect(mockLogCronComplete).toHaveBeenCalled();
  });
});
