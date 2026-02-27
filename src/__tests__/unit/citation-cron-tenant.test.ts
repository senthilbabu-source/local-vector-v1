// ---------------------------------------------------------------------------
// citation-cron-tenant.test.ts — Unit tests for tenant-derived citation cron
//
// Sprint 97 — Gap #60 (Citation Intelligence Cron — Tenant-Derived)
// Tests the rewritten GET /api/cron/citation that derives category+metro
// pairs from real org data instead of hardcoded arrays.
//
// Run: npx vitest run src/__tests__/unit/citation-cron-tenant.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks (must be declared before vi.mock) ──────────────────────

const {
  mockRunCitationSample,
  mockWriteCitationResults,
  mockNormalizeCategoryLabel,
  mockPlanSatisfies,
  mockLogCronStart,
  mockLogCronComplete,
  mockLogCronFailed,
  mockSupabaseFrom,
} = vi.hoisted(() => {
  const mockSupabaseFrom = vi.fn();
  return {
    mockRunCitationSample: vi.fn(),
    mockWriteCitationResults: vi.fn(),
    mockNormalizeCategoryLabel: vi.fn((raw: string) => raw?.toLowerCase() ?? 'business'),
    mockPlanSatisfies: vi.fn((plan: string, required: string) => {
      const h: Record<string, number> = { trial: 0, starter: 1, growth: 2, agency: 3 };
      return (h[plan] ?? 0) >= (h[required] ?? 0);
    }),
    mockLogCronStart: vi.fn().mockResolvedValue({ logId: 'test-log-id', startedAt: Date.now() }),
    mockLogCronComplete: vi.fn().mockResolvedValue(undefined),
    mockLogCronFailed: vi.fn().mockResolvedValue(undefined),
    mockSupabaseFrom: mockSupabaseFrom,
  };
});

// ── Mock modules ─────────────────────────────────────────────────────────

vi.mock('@/lib/services/citation-engine.service', () => ({
  runCitationSample: mockRunCitationSample,
  writeCitationResults: mockWriteCitationResults,
}));

vi.mock('@/lib/citation/citation-query-builder', () => ({
  normalizeCategoryLabel: mockNormalizeCategoryLabel,
}));

vi.mock('@/lib/plan-enforcer', () => ({
  planSatisfies: mockPlanSatisfies,
}));

vi.mock('@/lib/services/cron-logger', () => ({
  logCronStart: mockLogCronStart,
  logCronComplete: mockLogCronComplete,
  logCronFailed: mockLogCronFailed,
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn().mockReturnValue({
    from: mockSupabaseFrom,
  }),
}));

// ── Import handler after vi.mock declarations ────────────────────────────
import { GET } from '@/app/api/cron/citation/route';

// ── Constants ────────────────────────────────────────────────────────────

const CRON_SECRET = 'test-cron-secret-tenant';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeRequest(secret?: string): NextRequest {
  const headers = new Headers();
  if (secret) headers.set('Authorization', `Bearer ${secret}`);
  return new NextRequest('http://localhost:3000/api/cron/citation', { headers });
}

/** Sets up mocks for a single Growth org with Hookah Bar + Indian Restaurant categories. */
function setupGrowthOrg() {
  const mockLocationMaybeSingle = vi.fn().mockResolvedValue({
    data: {
      categories: ['Hookah Bar', 'Indian Restaurant'],
      city: 'Alpharetta',
      state: 'GA',
    },
    error: null,
  });

  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'organizations') {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'org-1', plan: 'growth', slug: 'charcoal-n-chill', name: 'Charcoal N Chill' }],
            error: null,
          }),
        }),
      };
    }
    if (table === 'locations') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: mockLocationMaybeSingle,
              }),
            }),
          }),
        }),
      };
    }
    return { select: vi.fn(), upsert: vi.fn() };
  });
}

/** Sets up mocks for two orgs that share the same category+metro. */
function setupMultipleOrgs() {
  const mockLocationMaybeSingle = vi.fn().mockResolvedValue({
    data: {
      categories: ['Hookah Bar'],
      city: 'Alpharetta',
      state: 'GA',
    },
    error: null,
  });

  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'organizations') {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [
              { id: 'org-1', plan: 'growth', slug: 'org1', name: 'Org 1' },
              { id: 'org-2', plan: 'agency', slug: 'org2', name: 'Org 2' },
            ],
            error: null,
          }),
        }),
      };
    }
    if (table === 'locations') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: mockLocationMaybeSingle,
              }),
            }),
          }),
        }),
      };
    }
    return { select: vi.fn(), upsert: vi.fn() };
  });
}

/** Sets up mock for org with no location. */
function setupOrgNoLocation() {
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'organizations') {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'org-1', plan: 'growth', slug: 'test', name: 'Test' }],
            error: null,
          }),
        }),
      };
    }
    if (table === 'locations') {
      return {
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
    }
    return { select: vi.fn(), upsert: vi.fn() };
  });
}

/** Sets up mock for org with no category on location. */
function setupOrgNoCategory() {
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'organizations') {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'org-1', plan: 'growth', slug: 'test', name: 'Test' }],
            error: null,
          }),
        }),
      };
    }
    if (table === 'locations') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { categories: null, city: 'Dallas', state: 'TX' },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };
    }
    return { select: vi.fn(), upsert: vi.fn() };
  });
}

// ── Setup / Teardown ─────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CRON_SECRET', CRON_SECRET);
  vi.stubEnv('PERPLEXITY_API_KEY', 'test-key');
  delete process.env.STOP_CITATION_CRON;

  // Restore default mock return values
  mockRunCitationSample.mockResolvedValue({
    platformCounts: { yelp: 4, tripadvisor: 2, google: 5 },
    successfulQueries: 5,
    sampleQuery: 'best hookah bar in Alpharetta GA',
  });
  mockWriteCitationResults.mockResolvedValue(3);
  mockNormalizeCategoryLabel.mockImplementation((raw: string) => raw?.toLowerCase() ?? 'business');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('GET /api/cron/citation (tenant-derived)', () => {
  it('1. returns 401 when no Authorization header is present', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('2. returns 401 when Authorization header has wrong secret', async () => {
    const res = await GET(makeRequest('wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('3. returns 200 with halted flag when kill switch is set', async () => {
    vi.stubEnv('STOP_CITATION_CRON', 'true');
    const res = await GET(makeRequest(CRON_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.halted).toBe(true);
  });

  it('4. returns 500 when PERPLEXITY_API_KEY is missing', async () => {
    vi.stubEnv('PERPLEXITY_API_KEY', '');
    const res = await GET(makeRequest(CRON_SECRET));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('PERPLEXITY_API_KEY');
  });

  it('5. processes org with valid location category and city', async () => {
    setupGrowthOrg();
    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.orgs_processed).toBe(1);
  });

  it('6. calls runCitationSample for each unique category+metro tuple', async () => {
    setupGrowthOrg();
    await GET(makeRequest(CRON_SECRET));
    // Golden tenant has 2 categories: "Hookah Bar" and "Indian Restaurant"
    expect(mockRunCitationSample).toHaveBeenCalledTimes(2);
  });

  it('7. passes normalized category to runCitationSample', async () => {
    setupGrowthOrg();
    await GET(makeRequest(CRON_SECRET));
    expect(mockRunCitationSample).toHaveBeenCalledWith(
      'hookah bar',
      'Alpharetta',
      'GA',
    );
  });

  it('8. skips orgs with no location', async () => {
    setupOrgNoLocation();
    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();
    expect(body.orgs_skipped).toBe(1);
    expect(body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'no_location' }),
      ]),
    );
  });

  it('9. skips orgs with no category on their location', async () => {
    setupOrgNoCategory();
    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();
    expect(body.orgs_skipped).toBe(1);
    expect(body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'no_category' }),
      ]),
    );
  });

  it('10. deduplicates category+metro tuples across orgs', async () => {
    setupMultipleOrgs();
    await GET(makeRequest(CRON_SECRET));
    // Both orgs have same "Hookah Bar" + Alpharetta — should only run once
    expect(mockRunCitationSample).toHaveBeenCalledTimes(1);
  });

  it('11. one tuple failure does not abort other tuples', async () => {
    setupGrowthOrg();
    // First call throws, second succeeds
    mockRunCitationSample
      .mockRejectedValueOnce(new Error('Perplexity rate limit'))
      .mockResolvedValueOnce({
        platformCounts: { yelp: 3 },
        successfulQueries: 5,
        sampleQuery: 'test query',
      });

    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.errors.length).toBe(1);
    // Second call should still happen
    expect(mockRunCitationSample).toHaveBeenCalledTimes(2);
  });

  it('12. returns summary with platforms_found count', async () => {
    setupGrowthOrg();
    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();
    // 2 categories × 3 platforms each = 6
    expect(body.platforms_found).toBe(6);
  });

  it('13. returns summary with queries_run count', async () => {
    setupGrowthOrg();
    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();
    // 2 categories × 5 successful queries each = 10
    expect(body.queries_run).toBe(10);
  });

  it('14. returns empty summary when no eligible orgs exist', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.orgs_processed).toBe(0);
  });
});
