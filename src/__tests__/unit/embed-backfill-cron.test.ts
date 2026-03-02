// ---------------------------------------------------------------------------
// Sprint 119 — embed-backfill-cron.test.ts (6 tests)
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockBackfillTable = vi.fn();
vi.mock('@/lib/services/embedding-service', () => ({
  backfillTable: (...args: unknown[]) => mockBackfillTable(...args),
}));

const mockSupabase = { from: vi.fn() };
vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => mockSupabase,
}));

import { GET } from '@/app/api/cron/embed-backfill/route';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/cron/embed-backfill', {
    headers,
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/cron/embed-backfill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', 'test-secret');
    mockBackfillTable.mockResolvedValue({ processed: 5, errors: 0 });
  });

  it('1. 401 when CRON_SECRET missing from headers', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('2. calls backfillTable() for all 5 tables', async () => {
    const res = await GET(
      makeRequest({ authorization: 'Bearer test-secret' }),
    );
    expect(res.status).toBe(200);

    expect(mockBackfillTable).toHaveBeenCalledTimes(5);
    const calledTables = mockBackfillTable.mock.calls.map(
      (c: unknown[]) => c[1],
    );
    expect(calledTables).toEqual([
      'menu_items',
      'ai_hallucinations',
      'target_queries',
      'content_drafts',
      'locations',
    ]);
  });

  it('3. returns results for each table in response', async () => {
    const res = await GET(
      makeRequest({ authorization: 'Bearer test-secret' }),
    );
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.results.menu_items).toEqual({ processed: 5, errors: 0 });
    expect(body.results.ai_hallucinations).toEqual({ processed: 5, errors: 0 });
    expect(body.results.target_queries).toEqual({ processed: 5, errors: 0 });
    expect(body.results.content_drafts).toEqual({ processed: 5, errors: 0 });
    expect(body.results.locations).toEqual({ processed: 5, errors: 0 });
  });

  it('4. returns duration_ms in response', async () => {
    const res = await GET(
      makeRequest({ authorization: 'Bearer test-secret' }),
    );
    const body = await res.json();

    expect(typeof body.duration_ms).toBe('number');
    expect(body.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('5. continues processing remaining tables if one table errors', async () => {
    mockBackfillTable
      .mockResolvedValueOnce({ processed: 5, errors: 0 })
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce({ processed: 3, errors: 0 })
      .mockResolvedValueOnce({ processed: 2, errors: 0 })
      .mockResolvedValueOnce({ processed: 1, errors: 0 });

    const res = await GET(
      makeRequest({ authorization: 'Bearer test-secret' }),
    );
    const body = await res.json();

    expect(body.ok).toBe(true);
    // The errored table should have fallback values
    expect(body.results.ai_hallucinations).toEqual({ processed: 0, errors: 1 });
    // Other tables should have succeeded
    expect(body.results.menu_items).toEqual({ processed: 5, errors: 0 });
    expect(body.results.target_queries).toEqual({ processed: 3, errors: 0 });
  });

  it('6. uses service role client (not user session)', async () => {
    await GET(makeRequest({ authorization: 'Bearer test-secret' }));

    // The first arg to backfillTable is the supabase client
    expect(mockBackfillTable.mock.calls[0][0]).toBe(mockSupabase);
  });
});
