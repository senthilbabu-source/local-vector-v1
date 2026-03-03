/**
 * Unit Tests — GDPR Data Export API (P6-FIX-26)
 *
 * Verifies auth, owner-only access, rate limiting, data shape,
 * and Stripe field redaction in the export response.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/data-export-route.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetSafeAuthContext = vi.fn();
const mockRoleSatisfies = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockGetRateLimitHeaders = vi.fn().mockReturnValue({});

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
}));
vi.mock('@/lib/auth/org-roles', () => ({
  roleSatisfies: (...args: unknown[]) => mockRoleSatisfies(...args),
}));
vi.mock('@/lib/rate-limit/rate-limiter', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getRateLimitHeaders: (...args: unknown[]) => mockGetRateLimitHeaders(...args),
}));

const mockFrom = vi.fn();
const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockMaybeSingle = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => ({
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return {
        select: (...sArgs: unknown[]) => {
          mockSelect(...sArgs);
          return {
            eq: (...eArgs: unknown[]) => {
              mockEq(...eArgs);
              return {
                maybeSingle: () => mockMaybeSingle(),
                then: (cb: (v: unknown) => unknown) => cb({ data: [], error: null }),
              };
            },
          };
        },
      };
    },
  }),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultAuth() {
  mockGetSafeAuthContext.mockResolvedValue({
    orgId: 'org-123',
    userId: 'user-456',
    role: 'owner',
  });
  mockRoleSatisfies.mockReturnValue(true);
  mockCheckRateLimit.mockResolvedValue({ allowed: true });
  mockMaybeSingle.mockResolvedValue({
    data: { id: 'org-123', slug: 'test-org', stripe_customer_id: 'cus_xxx', stripe_subscription_id: 'sub_xxx' },
    error: null,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/settings/data-export (P6-FIX-26)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const { GET } = await import('@/app/api/settings/data-export/route');
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not owner', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: 'org-1', role: 'member' });
    mockRoleSatisfies.mockReturnValue(false);
    mockCheckRateLimit.mockResolvedValue({ allowed: true });

    const { GET } = await import('@/app/api/settings/data-export/route');
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns 429 when rate limited', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: 'org-1', role: 'owner' });
    mockRoleSatisfies.mockReturnValue(true);
    mockCheckRateLimit.mockResolvedValue({ allowed: false, retry_after: 3600 });

    const { GET } = await import('@/app/api/settings/data-export/route');
    const res = await GET();
    expect(res.status).toBe(429);
  });

  it('returns a JSON file attachment', async () => {
    defaultAuth();
    const { GET } = await import('@/app/api/settings/data-export/route');
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(res.headers.get('content-disposition')).toContain('attachment');
    expect(res.headers.get('content-disposition')).toContain('localvector-data-export');
  });

  it('export JSON has correct structure', async () => {
    defaultAuth();
    const { GET } = await import('@/app/api/settings/data-export/route');
    const res = await GET();
    const body = await res.json();
    expect(body.exportVersion).toBe('1.0');
    expect(body.exportedAt).toBeDefined();
    expect(body).toHaveProperty('organization');
    expect(body).toHaveProperty('locations');
    expect(body).toHaveProperty('targetQueries');
    expect(body).toHaveProperty('sovEvaluations');
    expect(body).toHaveProperty('hallucinations');
    expect(body).toHaveProperty('contentDrafts');
    expect(body).toHaveProperty('pageAudits');
    expect(body).toHaveProperty('competitors');
    expect(body).toHaveProperty('entityChecks');
  });

  it('redacts stripe_customer_id in export', async () => {
    defaultAuth();
    const { GET } = await import('@/app/api/settings/data-export/route');
    const res = await GET();
    const body = await res.json();
    if (body.organization) {
      expect(body.organization.stripe_customer_id).toBe('[REDACTED]');
      expect(body.organization.stripe_subscription_id).toBe('[REDACTED]');
    }
  });
});
