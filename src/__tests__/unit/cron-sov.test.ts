// ---------------------------------------------------------------------------
// cron-sov.test.ts — Unit tests for GET /api/cron/sov
//
// Strategy (mirrors cron-audit.test.ts):
//   • The SOV service (runSOVQuery, writeSOVResults) is mocked completely —
//     no real Perplexity calls, no MSW needed.
//   • The Supabase service-role client is mocked to return configurable data.
//   • Per-org resilience is tested: one org's failure never aborts the run.
//
// Run:
//   npx vitest run src/__tests__/unit/cron-sov.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ── Mock the SOV engine service ──────────────────────────────────────────
vi.mock('@/lib/services/sov-engine.service', () => ({
  runSOVQuery: vi.fn().mockResolvedValue({
    queryId: 'q1',
    queryText: 'best hookah in Alpharetta GA',
    queryCategory: 'discovery',
    locationId: 'loc-uuid-001',
    ourBusinessCited: false,
    businessesFound: [],
    citationUrl: null,
    engine: 'perplexity',
  }),
  runMultiModelSOVQuery: vi.fn().mockResolvedValue([{
    queryId: 'q1',
    queryText: 'best hookah in Alpharetta GA',
    queryCategory: 'discovery',
    locationId: 'loc-uuid-001',
    ourBusinessCited: false,
    businessesFound: [],
    citationUrl: null,
    engine: 'perplexity',
  }]),
  writeSOVResults: vi.fn().mockResolvedValue({
    shareOfVoice: 0,
    citationRate: 0,
    firstMoverCount: 0,
  }),
  sleep: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock the Supabase service-role client ────────────────────────────────
vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(),
}));

// ── Mock the email helper ────────────────────────────────────────────────
vi.mock('@/lib/email', () => ({
  sendSOVReport: vi.fn().mockResolvedValue(undefined),
  sendWeeklyDigest: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock the Occasion Engine ─────────────────────────────────────────────
vi.mock('@/lib/services/occasion-engine.service', () => ({
  runOccasionScheduler: vi.fn().mockResolvedValue({
    orgId: 'org-uuid-001',
    locationId: 'loc-uuid-001',
    alerts: [],
    alertsFired: 0,
    alertsSkipped: 0,
    draftsCreated: 0,
  }),
}));

// ── Mock the Prompt Intelligence Engine ──────────────────────────────────
vi.mock('@/lib/services/prompt-intelligence.service', () => ({
  detectQueryGaps: vi.fn().mockResolvedValue([]),
}));

// ── Mock the Plan Enforcer ───────────────────────────────────────────────
vi.mock('@/lib/plan-enforcer', () => ({
  canRunAutopilot: vi.fn().mockReturnValue(true),
  canRunMultiModelSOV: vi.fn().mockReturnValue(false),
}));

// ── Mock the Autopilot Create Draft ──────────────────────────────────────
vi.mock('@/lib/autopilot/create-draft', () => ({
  createDraft: vi.fn().mockResolvedValue(null),
  archiveExpiredOccasionDrafts: vi.fn().mockResolvedValue(0),
}));

// ── Mock the Autopilot Post-Publish ──────────────────────────────────────
vi.mock('@/lib/autopilot/post-publish', () => ({
  getPendingRechecks: vi.fn().mockResolvedValue([]),
  completeRecheck: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock the Inngest client ──────────────────────────────────────────────
// Default: throw so inline fallback runs (existing tests exercise fallback path).
const mockInngestSend = vi.fn().mockRejectedValue(new Error('Inngest unavailable'));
vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: (...args: unknown[]) => mockInngestSend(...args) },
}));

// ── Import handler and mocks after vi.mock declarations ──────────────────
import { GET } from '@/app/api/cron/sov/route';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { runSOVQuery, writeSOVResults } from '@/lib/services/sov-engine.service';
import { sendSOVReport, sendWeeklyDigest } from '@/lib/email';
import { runOccasionScheduler } from '@/lib/services/occasion-engine.service';
import { detectQueryGaps } from '@/lib/services/prompt-intelligence.service';
import { canRunAutopilot } from '@/lib/plan-enforcer';
import { createDraft, archiveExpiredOccasionDrafts } from '@/lib/autopilot/create-draft';
import { getPendingRechecks, completeRecheck } from '@/lib/autopilot/post-publish';

// ── Constants ────────────────────────────────────────────────────────────

const CRON_SECRET = 'test-cron-secret-sov';

const MOCK_QUERY = {
  id: 'q-uuid-001',
  query_text: 'best hookah bar in Alpharetta GA',
  query_category: 'discovery',
  location_id: 'loc-uuid-001',
  org_id: 'org-uuid-001',
  locations: { business_name: 'Charcoal N Chill', city: 'Alpharetta', state: 'GA' },
  organizations: { plan_status: 'active', plan: 'growth' },
};

// ── Helpers ──────────────────────────────────────────────────────────────

function makeRequest(secret?: string): NextRequest {
  const headers = new Headers();
  if (secret) headers.set('Authorization', `Bearer ${secret}`);
  return new NextRequest('http://localhost:3000/api/cron/sov', { headers });
}

/**
 * Build a mock Supabase client. Returns configurable query results.
 */
function makeMockSupabase(queries: unknown[] = []) {
  const mockMaybeSingle = vi.fn().mockResolvedValue({
    data: { users: { email: 'owner@test.com' } },
    error: null,
  });

  return {
    from: vi.fn((table: string) => {
      if (table === 'target_queries') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: queries, error: null }),
        };
      }
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    }),
  } as unknown as SupabaseClient<Database>;
}

// ── Setup / Teardown ─────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CRON_SECRET', CRON_SECRET);
  vi.stubEnv('PERPLEXITY_API_KEY', 'test-key');
  delete process.env.STOP_SOV_CRON;
  // Re-set Inngest mock default (throw → forces inline fallback in most tests)
  mockInngestSend.mockRejectedValue(new Error('Inngest unavailable'));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('GET /api/cron/sov', () => {
  it('returns 401 when no Authorization header is present', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when Authorization header has wrong secret', async () => {
    const res = await GET(makeRequest('wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with halted flag when STOP_SOV_CRON is set', async () => {
    vi.stubEnv('STOP_SOV_CRON', 'true');
    const res = await GET(makeRequest(CRON_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.halted).toBe(true);
  });

  // ── Inngest dispatch ──────────────────────────────────────────────────

  it('dispatches to Inngest and returns early when Inngest is available', async () => {
    mockInngestSend.mockResolvedValueOnce(undefined);
    const res = await GET(makeRequest(CRON_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dispatched).toBe(true);
    expect(mockInngestSend).toHaveBeenCalledWith({ name: 'cron/sov.weekly', data: {} });
    // Inline fallback should NOT have run
    expect(vi.mocked(createServiceRoleClient)).not.toHaveBeenCalled();
  });

  it('falls back to inline when Inngest dispatch throws', async () => {
    // Default mock already throws — inline fallback should run
    const mock = makeMockSupabase([MOCK_QUERY]);
    vi.mocked(createServiceRoleClient).mockReturnValue(mock as never);

    const res = await GET(makeRequest(CRON_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    // Inline fallback ran — no dispatched flag, but has orgs_processed
    expect(body.dispatched).toBeUndefined();
    expect(body.orgs_processed).toBe(1);
  });

  // ── Inline fallback (existing orchestration tests) ────────────────────

  it('returns 200 with zero counts when no eligible queries exist', async () => {
    const mock = makeMockSupabase([]);
    vi.mocked(createServiceRoleClient).mockReturnValue(mock as never);

    const res = await GET(makeRequest(CRON_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.queries_run).toBe(0);
  });

  it('calls runSOVQuery for each query in the batch', async () => {
    const queries = [
      { ...MOCK_QUERY, id: 'q1' },
      { ...MOCK_QUERY, id: 'q2', query_text: 'best Indian food Alpharetta' },
    ];
    const mock = makeMockSupabase(queries);
    vi.mocked(createServiceRoleClient).mockReturnValue(mock as never);

    const res = await GET(makeRequest(CRON_SECRET));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.queries_run).toBe(2);
    expect(vi.mocked(runSOVQuery)).toHaveBeenCalledTimes(2);
  });

  it('calls writeSOVResults after processing all queries for an org', async () => {
    const mock = makeMockSupabase([MOCK_QUERY]);
    vi.mocked(createServiceRoleClient).mockReturnValue(mock as never);

    await GET(makeRequest(CRON_SECRET));

    expect(vi.mocked(writeSOVResults)).toHaveBeenCalled();
    expect(vi.mocked(writeSOVResults)).toHaveBeenLastCalledWith(
      'org-uuid-001',
      expect.any(Array),
      expect.anything(),
    );
  });

  it('sends SOV report email after processing', async () => {
    const mock = makeMockSupabase([MOCK_QUERY]);
    vi.mocked(createServiceRoleClient).mockReturnValue(mock as never);

    await GET(makeRequest(CRON_SECRET));

    expect(vi.mocked(sendWeeklyDigest)).toHaveBeenCalled();
    expect(vi.mocked(sendWeeklyDigest)).toHaveBeenLastCalledWith(
      expect.objectContaining({
        to: 'owner@test.com',
        businessName: 'Charcoal N Chill',
      }),
    );
  });

  it('continues processing when a single query throws', async () => {
    const queries = [
      { ...MOCK_QUERY, id: 'q1' },
      { ...MOCK_QUERY, id: 'q2' },
    ];
    const mock = makeMockSupabase(queries);
    vi.mocked(createServiceRoleClient).mockReturnValue(mock as never);

    // First call throws, second succeeds
    vi.mocked(runSOVQuery)
      .mockRejectedValueOnce(new Error('Perplexity rate limit'))
      .mockResolvedValueOnce({
        queryId: 'q2',
        queryText: 'test',
        queryCategory: 'discovery',
        locationId: 'loc-uuid-001',
        ourBusinessCited: true,
        businessesFound: [],
        citationUrl: 'https://yelp.com/test',
        engine: 'perplexity',
      });

    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();

    // Only one query succeeded
    expect(body.queries_run).toBe(1);
    expect(body.queries_cited).toBe(1);
    expect(body.orgs_processed).toBe(1);
    expect(body.orgs_failed).toBe(0);
  });

  it('increments orgs_failed when writeSOVResults throws', async () => {
    const mock = makeMockSupabase([MOCK_QUERY]);
    vi.mocked(createServiceRoleClient).mockReturnValue(mock as never);
    vi.mocked(writeSOVResults).mockRejectedValueOnce(new Error('DB write failed'));

    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();

    expect(body.orgs_failed).toBe(1);
    expect(body.orgs_processed).toBe(0);
  });

  it('tracks queries_cited count when businesses are found', async () => {
    const mock = makeMockSupabase([MOCK_QUERY]);
    vi.mocked(createServiceRoleClient).mockReturnValue(mock as never);

    vi.mocked(runSOVQuery).mockResolvedValueOnce({
      queryId: 'q1',
      queryText: 'test',
      queryCategory: 'discovery',
      locationId: 'loc-uuid-001',
      ourBusinessCited: true,
      businessesFound: ['Cloud 9 Lounge'],
      citationUrl: 'https://yelp.com/charcoal-n-chill',
      engine: 'perplexity',
    });

    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();

    expect(body.queries_cited).toBe(1);
  });

  it('passes query_category to runSOVQuery', async () => {
    const query = { ...MOCK_QUERY, query_category: 'occasion' };
    const mock = makeMockSupabase([query]);
    vi.mocked(createServiceRoleClient).mockReturnValue(mock as never);

    await GET(makeRequest(CRON_SECRET));

    expect(vi.mocked(runSOVQuery)).toHaveBeenCalledWith(
      expect.objectContaining({ query_category: 'occasion' }),
    );
  });

  it('calls runOccasionScheduler after writeSOVResults', async () => {
    const mock = makeMockSupabase([MOCK_QUERY]);
    vi.mocked(createServiceRoleClient).mockReturnValue(mock as never);

    await GET(makeRequest(CRON_SECRET));

    expect(vi.mocked(runOccasionScheduler)).toHaveBeenCalledWith(
      'org-uuid-001',
      'loc-uuid-001',
      expect.any(Array),
      expect.any(String),
      expect.any(Array),
      'Charcoal N Chill',
      'Alpharetta',
      'GA',
      expect.any(String),
      expect.anything(),
    );
  });

  it('does not crash when occasion engine throws', async () => {
    const mock = makeMockSupabase([MOCK_QUERY]);
    vi.mocked(createServiceRoleClient).mockReturnValue(mock as never);
    vi.mocked(runOccasionScheduler).mockRejectedValueOnce(
      new Error('Occasion engine failed'),
    );

    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();

    // Cron should still succeed — occasion engine is non-critical
    expect(res.status).toBe(200);
    expect(body.orgs_processed).toBe(1);
    expect(body.orgs_failed).toBe(0);
  });

  it('calls detectQueryGaps after writeSOVResults', async () => {
    const mock = makeMockSupabase([MOCK_QUERY]);
    vi.mocked(createServiceRoleClient).mockReturnValue(mock as never);

    await GET(makeRequest(CRON_SECRET));

    expect(vi.mocked(detectQueryGaps)).toHaveBeenCalledWith(
      'org-uuid-001',
      'loc-uuid-001',
      expect.anything(),
    );
  });

  it('includes gaps_detected in summary response', async () => {
    const mock = makeMockSupabase([MOCK_QUERY]);
    vi.mocked(createServiceRoleClient).mockReturnValue(mock as never);
    vi.mocked(detectQueryGaps).mockResolvedValueOnce([
      {
        gapType: 'untracked',
        queryText: 'test query',
        queryCategory: 'discovery',
        estimatedImpact: 'high',
        suggestedAction: 'Add this query.',
      },
    ]);

    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();

    expect(body.gaps_detected).toBe(1);
  });

  it('does not crash when prompt intelligence throws', async () => {
    const mock = makeMockSupabase([MOCK_QUERY]);
    vi.mocked(createServiceRoleClient).mockReturnValue(mock as never);
    vi.mocked(detectQueryGaps).mockRejectedValueOnce(
      new Error('Gap detection failed'),
    );

    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();

    // Cron should still succeed — gap detection is non-critical
    expect(res.status).toBe(200);
    expect(body.orgs_processed).toBe(1);
    expect(body.orgs_failed).toBe(0);
  });

  it('calls archiveExpiredOccasionDrafts after org processing', async () => {
    const mock = makeMockSupabase([MOCK_QUERY]);
    vi.mocked(createServiceRoleClient).mockReturnValue(mock as never);

    await GET(makeRequest(CRON_SECRET));

    expect(vi.mocked(archiveExpiredOccasionDrafts)).toHaveBeenCalled();
  });

  it('does not crash when archiveExpiredOccasionDrafts throws', async () => {
    const mock = makeMockSupabase([MOCK_QUERY]);
    vi.mocked(createServiceRoleClient).mockReturnValue(mock as never);
    vi.mocked(archiveExpiredOccasionDrafts).mockRejectedValueOnce(
      new Error('Archive failed'),
    );

    const res = await GET(makeRequest(CRON_SECRET));
    expect(res.status).toBe(200);
  });

  it('calls getPendingRechecks after org processing', async () => {
    const mock = makeMockSupabase([MOCK_QUERY]);
    vi.mocked(createServiceRoleClient).mockReturnValue(mock as never);

    await GET(makeRequest(CRON_SECRET));

    expect(vi.mocked(getPendingRechecks)).toHaveBeenCalled();
  });

  it('does not crash when getPendingRechecks throws', async () => {
    const mock = makeMockSupabase([MOCK_QUERY]);
    vi.mocked(createServiceRoleClient).mockReturnValue(mock as never);
    vi.mocked(getPendingRechecks).mockRejectedValueOnce(
      new Error('Redis down'),
    );

    const res = await GET(makeRequest(CRON_SECRET));
    expect(res.status).toBe(200);
  });

  it('runs SOV recheck and completes for pending tasks', async () => {
    const mock = makeMockSupabase([MOCK_QUERY]);
    vi.mocked(createServiceRoleClient).mockReturnValue(mock as never);
    vi.mocked(getPendingRechecks).mockResolvedValueOnce([
      {
        taskType: 'sov_recheck' as const,
        targetDate: new Date().toISOString(),
        payload: {
          draftId: 'draft-123',
          locationId: 'loc-uuid-001',
          targetQuery: 'best italian austin',
        },
      },
    ]);

    await GET(makeRequest(CRON_SECRET));

    expect(vi.mocked(runSOVQuery)).toHaveBeenCalledWith(
      expect.objectContaining({ query_text: 'best italian austin' }),
    );
    expect(vi.mocked(completeRecheck)).toHaveBeenCalledWith('draft-123');
  });
});
