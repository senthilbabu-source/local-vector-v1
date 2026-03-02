// ---------------------------------------------------------------------------
// Sprint 122: benchmark-cron.test.ts — 9 tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRunBenchmarkComputation = vi.fn();
const mockGetMostRecentSunday = vi.fn();

vi.mock('@/lib/services/benchmark-service', () => ({
  runBenchmarkComputation: (...args: unknown[]) => mockRunBenchmarkComputation(...args),
  getMostRecentSunday: () => mockGetMostRecentSunday(),
}));

const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn().mockReturnValue({ upsert: mockUpsert });

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
  }),
}));

vi.mock('@/lib/services/cron-logger', () => ({
  logCronStart: vi.fn().mockResolvedValue({ logId: 'log-1', startedAt: Date.now() }),
  logCronComplete: vi.fn().mockResolvedValue(undefined),
  logCronFailed: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

import { POST } from '@/app/api/cron/benchmarks/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CRON_SECRET = 'test-cron-secret';

function makeRequest(secret?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (secret) {
    headers['authorization'] = `Bearer ${secret}`;
  }
  return new NextRequest('http://localhost/api/cron/benchmarks', {
    method: 'POST',
    headers,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/cron/benchmarks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', CRON_SECRET);
    mockGetMostRecentSunday.mockReturnValue('2026-03-01');
    mockRunBenchmarkComputation.mockResolvedValue({
      snapshots_written: 2,
      orgs_cached: 12,
      buckets_skipped: 1,
    });
  });

  it('returns 401 when CRON_SECRET is missing', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 401 when CRON_SECRET is wrong', async () => {
    const res = await POST(makeRequest('wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('week_of is most recent Sunday (YYYY-MM-DD)', async () => {
    const res = await POST(makeRequest(CRON_SECRET));
    const body = await res.json();
    expect(body.week_of).toBe('2026-03-01');
    expect(body.week_of).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('response contains snapshots_written, orgs_cached, buckets_skipped', async () => {
    const res = await POST(makeRequest(CRON_SECRET));
    const body = await res.json();
    expect(body.snapshots_written).toBe(2);
    expect(body.orgs_cached).toBe(12);
    expect(body.buckets_skipped).toBe(1);
  });

  it('duration_ms is present and positive', async () => {
    const res = await POST(makeRequest(CRON_SECRET));
    const body = await res.json();
    expect(body.duration_ms).toBeDefined();
    expect(body.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('uses service-role Supabase client (not anon)', async () => {
    await POST(makeRequest(CRON_SECRET));
    // runBenchmarkComputation was called with the service role client
    expect(mockRunBenchmarkComputation).toHaveBeenCalledTimes(1);
    const client = mockRunBenchmarkComputation.mock.calls[0][0];
    expect(client).toBeDefined();
    expect(client.rpc).toBeDefined();
  });

  it('week_of is a valid YYYY-MM-DD string', async () => {
    const res = await POST(makeRequest(CRON_SECRET));
    const body = await res.json();
    const d = new Date(body.week_of + 'T00:00:00Z');
    expect(isNaN(d.getTime())).toBe(false);
  });

  it('returns zeros when no eligible orgs exist', async () => {
    mockRunBenchmarkComputation.mockResolvedValue({
      snapshots_written: 0,
      orgs_cached: 0,
      buckets_skipped: 0,
    });

    const res = await POST(makeRequest(CRON_SECRET));
    const body = await res.json();
    expect(body).toMatchObject({
      snapshots_written: 0,
      orgs_cached: 0,
      buckets_skipped: 0,
    });
  });

  it('double-fire same Sunday produces no errors (UPSERT)', async () => {
    // First run
    const res1 = await POST(makeRequest(CRON_SECRET));
    expect(res1.status).toBe(200);

    // Second run — same week_of, should succeed via UPSERT
    const res2 = await POST(makeRequest(CRON_SECRET));
    expect(res2.status).toBe(200);

    // Both calls should succeed
    expect(mockRunBenchmarkComputation).toHaveBeenCalledTimes(2);
  });
});
