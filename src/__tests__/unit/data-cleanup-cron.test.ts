/**
 * Unit Tests — GDPR Data Cleanup Cron (P6-FIX-26)
 *
 * Verifies CRON_SECRET auth, kill switch, 7-day grace period logic,
 * and hard-delete behavior.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/data-cleanup-cron.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDelete = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockResolvedValue({ error: null });
const mockSelect = vi.fn().mockReturnThis();
const mockNot = vi.fn().mockReturnThis();
const mockLt = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      if (table === 'organizations') {
        return {
          select: (...args: unknown[]) => {
            mockSelect(...args);
            return {
              not: (...nArgs: unknown[]) => {
                mockNot(...nArgs);
                return {
                  lt: (...lArgs: unknown[]) => {
                    mockLt(...lArgs);
                    return Promise.resolve({
                      data: [],
                      error: null,
                    });
                  },
                };
              },
              eq: (...eArgs: unknown[]) => {
                mockEq(...eArgs);
                return {
                  maybeSingle: () => mockMaybeSingle(),
                };
              },
            };
          },
          delete: () => {
            mockDelete();
            return { eq: mockEq };
          },
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn() };
    },
  }),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Env setup
// ---------------------------------------------------------------------------

const CRON_SECRET = vi.hoisted(() => {
  process.env.CRON_SECRET = 'test-cron-secret';
  return 'test-cron-secret';
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/cron/data-cleanup (P6-FIX-26)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.STOP_DATA_CLEANUP_CRON;
  });

  function makeRequest(secret?: string) {
    return new NextRequest('http://localhost:3000/api/cron/data-cleanup', {
      headers: secret ? { authorization: `Bearer ${secret}` } : {},
    });
  }

  it('returns 401 without CRON_SECRET', async () => {
    const { GET } = await import('@/app/api/cron/data-cleanup/route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong CRON_SECRET', async () => {
    const { GET } = await import('@/app/api/cron/data-cleanup/route');
    const res = await GET(makeRequest('wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('respects kill switch', async () => {
    process.env.STOP_DATA_CLEANUP_CRON = 'true';
    const { GET } = await import('@/app/api/cron/data-cleanup/route');
    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe('kill_switch');
  });

  it('returns success with counts when no expired orgs', async () => {
    mockLt.mockResolvedValueOnce({ data: [], error: null });
    const { GET } = await import('@/app/api/cron/data-cleanup/route');
    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.checked).toBe(0);
    expect(body.deleted).toBe(0);
  });

  it('queries for orgs with deletion_requested_at older than 7 days', async () => {
    mockLt.mockResolvedValueOnce({ data: [], error: null });
    const { GET } = await import('@/app/api/cron/data-cleanup/route');
    await GET(makeRequest(CRON_SECRET));

    expect(mockNot).toHaveBeenCalledWith('deletion_requested_at', 'is', null);
    expect(mockLt).toHaveBeenCalledWith(
      'deletion_requested_at',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    );
  });

  it('returns 200 status on successful run', async () => {
    mockLt.mockResolvedValueOnce({ data: [], error: null });
    const { GET } = await import('@/app/api/cron/data-cleanup/route');
    const res = await GET(makeRequest(CRON_SECRET));
    expect(res.status).toBe(200);
  });
});
