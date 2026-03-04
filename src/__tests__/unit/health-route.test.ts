/**
 * P7-FIX-32 — Health Check Route Unit Tests (5 tests)
 *
 * Tests GET /api/health endpoint for service connectivity reporting.
 * Uses vi.hoisted() + dynamic imports to avoid singleton caching issues.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() — define mocks before vi.mock hoisting
const { mockLimit, mockSelect, mockFrom, mockBalanceRetrieve, mockCaptureException } =
  vi.hoisted(() => {
    const mockLimit = vi.fn();
    const mockSelect = vi.fn(() => ({ limit: mockLimit }));
    const mockFrom = vi.fn(() => ({ select: mockSelect }));
    const mockBalanceRetrieve = vi.fn();
    const mockCaptureException = vi.fn();
    return { mockLimit, mockSelect, mockFrom, mockBalanceRetrieve, mockCaptureException };
  });

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('stripe', () => {
  return {
    default: function MockStripe() {
      return { balance: { retrieve: mockBalanceRetrieve } };
    },
  };
});

vi.mock('@sentry/nextjs', () => ({
  captureException: mockCaptureException,
}));

vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_mock123');
vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234567890');

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFrom.mockReset();
    mockSelect.mockReset();
    mockLimit.mockReset();
    mockBalanceRetrieve.mockReset();
    mockCaptureException.mockReset();

    // Default: all services healthy
    mockLimit.mockResolvedValue({ data: [{ id: '1' }], error: null });
    mockSelect.mockReturnValue({ limit: mockLimit });
    mockFrom.mockReturnValue({ select: mockSelect });
    mockBalanceRetrieve.mockResolvedValue({ available: [] });
  });

  async function callGET() {
    const { GET } = await import('@/app/api/health/route');
    return GET();
  }

  it('returns 200 with status=ok when all services healthy', async () => {
    const response = await callGET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  it('returns 503 with status=degraded when DB unreachable', async () => {
    mockLimit.mockRejectedValue(new Error('Connection refused'));

    const response = await callGET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.status).toBe('degraded');
    expect(body.checks.database).toBe(false);
    expect(body.checks.stripe).toBe(true);
    expect(mockCaptureException).toHaveBeenCalledOnce();
  });

  it('does not require authentication', async () => {
    // GET handler has no auth checks — calling without auth context succeeds
    const response = await callGET();
    expect(response.status).toBe(200);
  });

  it('response includes checks.database and checks.stripe fields', async () => {
    const response = await callGET();
    const body = await response.json();
    expect(body.checks).toHaveProperty('database', true);
    expect(body.checks).toHaveProperty('stripe', true);
  });

  it('response includes timestamp and version', async () => {
    const response = await callGET();
    const body = await response.json();
    expect(body.timestamp).toBeDefined();
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
    // VERCEL_GIT_COMMIT_SHA is stubbed to 'abc1234567890' → first 7 chars
    expect(body.version).toBe('abc1234');
  });
});
