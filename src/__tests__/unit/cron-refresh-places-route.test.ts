// ---------------------------------------------------------------------------
// cron-refresh-places-route.test.ts — Route handler tests
//
// Sprint 90: Tests auth guard, kill switch, Inngest dispatch, inline fallback.
//
// Run:
//   npx vitest run src/__tests__/unit/cron-refresh-places-route.test.ts
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

const mockRefreshStalePlaceDetails = vi.fn().mockResolvedValue({
  total: 5, refreshed: 4, failed: 0, skipped: 1, errors: [],
});
vi.mock('@/lib/services/places-refresh', () => ({
  refreshStalePlaceDetails: (...args: unknown[]) => mockRefreshStalePlaceDetails(...args),
}));

// ── Import subject ────────────────────────────────────────────────────────

import { GET } from '@/app/api/cron/refresh-places/route';

// ── Helper ────────────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/cron/refresh-places', {
    method: 'GET',
    headers,
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/cron/refresh-places', () => {
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
    vi.stubEnv('STOP_PLACES_REFRESH_CRON', 'true');
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
      name: 'cron/places-refresh.daily',
      data: {},
    });
  });

  it('falls back to inline when Inngest fails', async () => {
    mockInngestSend.mockRejectedValueOnce(new Error('Inngest down'));
    const response = await GET(makeRequest({ authorization: 'Bearer test-secret' }));
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.total).toBe(5);
    expect(body.refreshed).toBe(4);
    expect(mockRefreshStalePlaceDetails).toHaveBeenCalled();
  });

  it('logs cron start and complete', async () => {
    await GET(makeRequest({ authorization: 'Bearer test-secret' }));
    expect(mockLogCronStart).toHaveBeenCalledWith('refresh-places');
    expect(mockLogCronComplete).toHaveBeenCalled();
  });
});
