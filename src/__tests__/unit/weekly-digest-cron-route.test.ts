// ---------------------------------------------------------------------------
// src/__tests__/unit/weekly-digest-cron-route.test.ts
//
// Sprint 78: Tests for the weekly digest cron route dispatcher.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be defined before imports
// ---------------------------------------------------------------------------

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

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock('@/lib/data/weekly-digest', () => ({
  fetchDigestForOrg: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/email/send-digest', () => ({
  sendDigestEmail: vi.fn().mockResolvedValue({ id: 'email-1' }),
}));

// ---------------------------------------------------------------------------
// Import the route handler after mocks are set up
// ---------------------------------------------------------------------------

import { GET } from '@/app/api/cron/weekly-digest/route';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/cron/weekly-digest', {
    method: 'GET',
    headers,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/cron/weekly-digest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', 'test-secret');
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
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when CRON_SECRET is wrong', async () => {
    const response = await GET(
      makeRequest({ authorization: 'Bearer wrong-secret' }),
    );
    expect(response.status).toBe(401);
  });

  it('returns skipped when kill switch is active', async () => {
    vi.stubEnv('STOP_DIGEST_CRON', 'true');
    const response = await GET(
      makeRequest({ authorization: 'Bearer test-secret' }),
    );
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe('Kill switch active');
  });

  it('dispatches to Inngest on happy path', async () => {
    const response = await GET(
      makeRequest({ authorization: 'Bearer test-secret' }),
    );
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.dispatched).toBe(true);
    expect(mockInngestSend).toHaveBeenCalledWith({
      name: 'cron/digest.weekly',
      data: {},
    });
  });

  it('falls back to inline when Inngest fails', async () => {
    mockInngestSend.mockRejectedValueOnce(new Error('Inngest down'));
    const response = await GET(
      makeRequest({ authorization: 'Bearer test-secret' }),
    );
    const body = await response.json();
    expect(body.ok).toBe(true);
    // Inline path runs — no Inngest dispatch
    expect(body.total).toBeDefined();
  });

  it('logs cron start/complete via cron-logger', async () => {
    await GET(makeRequest({ authorization: 'Bearer test-secret' }));
    expect(mockLogCronStart).toHaveBeenCalledWith('weekly-digest');
    expect(mockLogCronComplete).toHaveBeenCalled();
  });
});
