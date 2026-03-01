/**
 * Sprint 105 — NAP Sync API route tests.
 * Covers: POST /api/nap-sync/run (auth, plan gate, no-location, success, error)
 *         GET  /api/nap-sync/status (auth, plan gate, empty, populated)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks (before module evaluation) ─────────────────────────────────

const mockGetSafeAuthContext = vi.fn();
const mockCreateClient = vi.fn();
const mockCreateServiceRoleClient = vi.fn();
const mockRunNAPSync = vi.fn();
const mockCaptureException = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: mockGetSafeAuthContext,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
  createServiceRoleClient: mockCreateServiceRoleClient,
}));

vi.mock('@/lib/nap-sync/nap-sync-service', () => ({
  runNAPSync: mockRunNAPSync,
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: mockCaptureException,
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal chain mock for supabase. */
function buildSupabaseMock(tableOverrides: Record<string, unknown> = {}) {
  const base = {
    from: vi.fn((tableName: string) => {
      if (tableOverrides[tableName]) return tableOverrides[tableName];
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      };
    }),
  };
  return base;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/nap-sync/run
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/nap-sync/run', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValueOnce(null);

    const { POST } = await import('@/app/api/nap-sync/run/route');
    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('unauthorized');
  });

  it('returns 403 when plan does not satisfy Growth', async () => {
    mockGetSafeAuthContext.mockResolvedValueOnce({ userId: 'u-1', orgId: 'org-1' });

    const orgChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { plan: 'starter' }, error: null }),
        }),
      }),
    };
    const supabase = buildSupabaseMock({ organizations: orgChain });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const { POST } = await import('@/app/api/nap-sync/run/route');
    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('plan_upgrade_required');
  });

  it('returns 404 when no location found', async () => {
    mockGetSafeAuthContext.mockResolvedValueOnce({ userId: 'u-1', orgId: 'org-1' });

    const orgChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { plan: 'growth' }, error: null }),
        }),
      }),
    };
    const locationChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    };
    const supabase = buildSupabaseMock({
      organizations: orgChain,
      locations: locationChain,
    });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const { POST } = await import('@/app/api/nap-sync/run/route');
    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('no_location');
  });

  it('returns ok + result on successful sync', async () => {
    mockGetSafeAuthContext.mockResolvedValueOnce({ userId: 'u-1', orgId: 'org-1' });

    const orgChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { plan: 'growth' }, error: null }),
        }),
      }),
    };
    const locationChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'loc-1' }, error: null }),
            }),
          }),
        }),
      }),
    };
    const supabase = buildSupabaseMock({
      organizations: orgChain,
      locations: locationChain,
    });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const mockServiceRole = {};
    mockCreateServiceRoleClient.mockReturnValueOnce(mockServiceRole);

    const mockResult = { health_score: { score: 85, grade: 'B' }, discrepancies: [] };
    mockRunNAPSync.mockResolvedValueOnce(mockResult);

    const { POST } = await import('@/app/api/nap-sync/run/route');
    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.result).toEqual(mockResult);
    expect(mockRunNAPSync).toHaveBeenCalledWith(mockServiceRole, 'loc-1', 'org-1');
  });

  it('returns 500 and captures exception on sync failure', async () => {
    mockGetSafeAuthContext.mockResolvedValueOnce({ userId: 'u-1', orgId: 'org-1' });

    const orgChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { plan: 'agency' }, error: null }),
        }),
      }),
    };
    const locationChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'loc-1' }, error: null }),
            }),
          }),
        }),
      }),
    };
    const supabase = buildSupabaseMock({
      organizations: orgChain,
      locations: locationChain,
    });
    mockCreateClient.mockResolvedValueOnce(supabase);
    mockCreateServiceRoleClient.mockReturnValueOnce({});
    mockRunNAPSync.mockRejectedValueOnce(new Error('GBP token expired'));

    const { POST } = await import('@/app/api/nap-sync/run/route');
    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('sync_failed');
    expect(body.message).toBe('GBP token expired');
    expect(mockCaptureException).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/nap-sync/status
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/nap-sync/status', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValueOnce(null);

    const { GET } = await import('@/app/api/nap-sync/status/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('unauthorized');
  });

  it('returns 403 when plan is below Growth', async () => {
    mockGetSafeAuthContext.mockResolvedValueOnce({ userId: 'u-1', orgId: 'org-1' });

    const orgChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { plan: 'trial' }, error: null }),
        }),
      }),
    };
    const supabase = buildSupabaseMock({ organizations: orgChain });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const { GET } = await import('@/app/api/nap-sync/status/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('plan_upgrade_required');
  });

  it('returns null health_score when no location exists', async () => {
    mockGetSafeAuthContext.mockResolvedValueOnce({ userId: 'u-1', orgId: 'org-1' });

    const orgChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { plan: 'growth' }, error: null }),
        }),
      }),
    };
    const locationChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    };
    const supabase = buildSupabaseMock({
      organizations: orgChain,
      locations: locationChain,
    });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const { GET } = await import('@/app/api/nap-sync/status/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.health_score).toBeNull();
    expect(body.discrepancies).toEqual([]);
    expect(body.last_checked_at).toBeNull();
  });

  it('returns health_score with grade and deduped discrepancies', async () => {
    mockGetSafeAuthContext.mockResolvedValueOnce({ userId: 'u-1', orgId: 'org-1' });

    const orgChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { plan: 'growth' }, error: null }),
        }),
      }),
    };
    const locationChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'loc-1',
                  nap_health_score: 72,
                  nap_last_checked_at: '2026-03-01T03:00:00Z',
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    const discrepancyChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                { id: 'd-1', platform: 'yelp', detected_at: '2026-03-01T03:00:00Z', severity: 'critical' },
                { id: 'd-2', platform: 'yelp', detected_at: '2026-02-28T03:00:00Z', severity: 'high' },
                { id: 'd-3', platform: 'bing', detected_at: '2026-03-01T03:00:00Z', severity: 'medium' },
              ],
              error: null,
            }),
          }),
        }),
      }),
    };
    const supabase = buildSupabaseMock({
      organizations: orgChain,
      locations: locationChain,
      nap_discrepancies: discrepancyChain,
    });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const { GET } = await import('@/app/api/nap-sync/status/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.health_score).toEqual({ score: 72, grade: 'C' });
    expect(body.last_checked_at).toBe('2026-03-01T03:00:00Z');
    // Deduplication: only latest per platform (yelp d-1, bing d-3)
    expect(body.discrepancies).toHaveLength(2);
    expect(body.discrepancies[0].platform).toBe('yelp');
    expect(body.discrepancies[0].id).toBe('d-1');
    expect(body.discrepancies[1].platform).toBe('bing');
  });
});
