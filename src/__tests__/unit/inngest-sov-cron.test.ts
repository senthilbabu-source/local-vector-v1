// ---------------------------------------------------------------------------
// inngest-sov-cron.test.ts — Unit tests for SOV weekly Inngest function
//
// Tests the processOrgSOV helper (extracted for testability) which contains
// the per-org orchestration logic: query execution, result writing, email,
// occasion engine, and prompt intelligence sub-steps.
//
// Run: npx vitest run src/__tests__/unit/inngest-sov-cron.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ── Mock services before imports ──────────────────────────────────────────
vi.mock('@/lib/services/sov-engine.service', () => ({
  runSOVQuery: vi.fn().mockResolvedValue({
    queryId: 'q-001',
    queryText: 'Best pizza in Atlanta',
    queryCategory: 'discovery',
    locationId: 'loc-001',
    ourBusinessCited: false,
    businessesFound: [],
    citationUrl: null,
    engine: 'perplexity',
  }),
  runMultiModelSOVQuery: vi.fn().mockResolvedValue([{
    queryId: 'q-001',
    queryText: 'Best pizza in Atlanta',
    queryCategory: 'discovery',
    locationId: 'loc-001',
    ourBusinessCited: false,
    businessesFound: [],
    citationUrl: null,
    engine: 'perplexity',
  }]),
  writeSOVResults: vi.fn().mockResolvedValue({
    shareOfVoice: 33.3,
    citationRate: 50,
    firstMoverCount: 1,
  }),
  sleep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  sendSOVReport: vi.fn().mockResolvedValue(undefined),
  sendWeeklyDigest: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/services/occasion-engine.service', () => ({
  runOccasionScheduler: vi.fn().mockResolvedValue({ draftsCreated: 0, alerts: [] }),
}));

vi.mock('@/lib/services/prompt-intelligence.service', () => ({
  detectQueryGaps: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/plan-enforcer', () => ({
  canRunAutopilot: vi.fn().mockReturnValue(false),
  canRunMultiModelSOV: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/autopilot/create-draft', () => ({
  createDraft: vi.fn().mockResolvedValue(null),
  archiveExpiredOccasionDrafts: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/lib/autopilot/post-publish', () => ({
  getPendingRechecks: vi.fn().mockResolvedValue([]),
  completeRecheck: vi.fn().mockResolvedValue(undefined),
}));

// ── Import after mocks ──────────────────────────────────────────────────
import { processOrgSOV, type OrgBatch } from '@/lib/inngest/functions/sov-cron';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { runSOVQuery, writeSOVResults } from '@/lib/services/sov-engine.service';
import { sendSOVReport, sendWeeklyDigest } from '@/lib/email';
import { runOccasionScheduler } from '@/lib/services/occasion-engine.service';
import { detectQueryGaps } from '@/lib/services/prompt-intelligence.service';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeBatch(overrides?: Partial<OrgBatch>): OrgBatch {
  return {
    orgId: 'org-001',
    plan: 'growth',
    queries: [
      {
        id: 'q-001',
        query_text: 'Best pizza in Atlanta',
        query_category: 'discovery',
        location_id: 'loc-001',
        org_id: 'org-001',
        locations: { business_name: 'Test Pizza', city: 'Atlanta', state: 'GA' },
      },
    ],
    ...overrides,
  };
}

function mockSupabase() {
  const mockMaybeSingle = vi.fn().mockResolvedValue({
    data: { users: { email: 'owner@test.com' } },
    error: null,
  });
  const mock = {
    from: vi.fn((table: string) => {
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: mockMaybeSingle,
                }),
              }),
            }),
          }),
        };
      }
      const chainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      return chainable;
    }),
  } as unknown as SupabaseClient<Database>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(createServiceRoleClient as any).mockReturnValue(mock);
  return { mock, mockMaybeSingle };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('processOrgSOV', () => {
  beforeEach(() => {
    mockSupabase();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('runs queries and returns result summary', async () => {
    const result = await processOrgSOV(makeBatch());

    expect(result.success).toBe(true);
    expect(result.queriesRun).toBe(1);
    expect(vi.mocked(runSOVQuery)).toHaveBeenCalledOnce();
    expect(vi.mocked(writeSOVResults)).toHaveBeenCalledOnce();
  });

  it('counts cited queries correctly', async () => {
    vi.mocked(runSOVQuery).mockResolvedValueOnce({
      queryId: 'q-001',
      queryText: 'Best pizza in Atlanta',
      queryCategory: 'discovery',
      locationId: 'loc-001',
      ourBusinessCited: true,
      businessesFound: ['Test Pizza'],
      citationUrl: 'https://yelp.com/test-pizza',
      engine: 'perplexity',
    });

    const result = await processOrgSOV(makeBatch());
    expect(result.queriesCited).toBe(1);
  });

  it('continues when a single query fails', async () => {
    vi.mocked(runSOVQuery)
      .mockRejectedValueOnce(new Error('Perplexity 429'))
      .mockResolvedValueOnce({
        queryId: 'q-002',
        queryText: 'Best pasta in Atlanta',
        queryCategory: 'discovery',
        locationId: 'loc-001',
        ourBusinessCited: false,
        businessesFound: [],
        citationUrl: null,
        engine: 'perplexity',
      });

    const batch = makeBatch({
      queries: [
        {
          id: 'q-001', query_text: 'Best pizza', query_category: 'discovery',
          location_id: 'loc-001', org_id: 'org-001',
          locations: { business_name: 'Test Pizza', city: 'Atlanta', state: 'GA' },
        },
        {
          id: 'q-002', query_text: 'Best pasta', query_category: 'discovery',
          location_id: 'loc-001', org_id: 'org-001',
          locations: { business_name: 'Test Pizza', city: 'Atlanta', state: 'GA' },
        },
      ],
    });

    const result = await processOrgSOV(batch);
    expect(result.success).toBe(true);
    expect(result.queriesRun).toBe(1); // Only the successful query
    expect(vi.mocked(runSOVQuery)).toHaveBeenCalledTimes(2);
  });

  it('returns success: false when all queries fail', async () => {
    vi.mocked(runSOVQuery).mockRejectedValueOnce(new Error('API down'));

    const result = await processOrgSOV(makeBatch());
    expect(result.success).toBe(false);
    expect(result.queriesRun).toBe(0);
  });

  it('sends email report with correct payload', async () => {
    await processOrgSOV(makeBatch());

    expect(vi.mocked(sendWeeklyDigest)).toHaveBeenCalledOnce();
    const payload = vi.mocked(sendWeeklyDigest).mock.calls[0][0];
    expect(payload.to).toBe('owner@test.com');
    expect(payload.businessName).toBe('Test Pizza');
    expect(payload.queriesRun).toBe(1);
  });

  it('does not fail when email send throws', async () => {
    vi.mocked(sendWeeklyDigest).mockRejectedValueOnce(new Error('Resend unavailable'));

    const result = await processOrgSOV(makeBatch());
    expect(result.success).toBe(true);
  });

  it('calls occasion engine (non-critical)', async () => {
    await processOrgSOV(makeBatch());

    expect(vi.mocked(runOccasionScheduler)).toHaveBeenCalledOnce();
    const args = vi.mocked(runOccasionScheduler).mock.calls[0];
    expect(args[0]).toBe('org-001'); // orgId
    expect(args[1]).toBe('loc-001'); // locationId
  });

  it('does not fail when occasion engine throws', async () => {
    vi.mocked(runOccasionScheduler).mockRejectedValueOnce(new Error('Occasion fail'));

    const result = await processOrgSOV(makeBatch());
    expect(result.success).toBe(true);
    expect(result.occasionDrafts).toBe(0);
  });

  it('calls prompt intelligence (non-critical)', async () => {
    await processOrgSOV(makeBatch());

    expect(vi.mocked(detectQueryGaps)).toHaveBeenCalledOnce();
    const args = vi.mocked(detectQueryGaps).mock.calls[0];
    expect(args[0]).toBe('org-001');
    expect(args[1]).toBe('loc-001');
  });

  it('does not fail when prompt intelligence throws', async () => {
    vi.mocked(detectQueryGaps).mockRejectedValueOnce(new Error('Gap detection fail'));

    const result = await processOrgSOV(makeBatch());
    expect(result.success).toBe(true);
    expect(result.gapsDetected).toBe(0);
  });

  it('tracks first mover alerts from writeSOVResults', async () => {
    vi.mocked(writeSOVResults).mockResolvedValueOnce({
      shareOfVoice: 0,
      citationRate: 0,
      firstMoverCount: 3,
    });

    const result = await processOrgSOV(makeBatch());
    expect(result.firstMoverAlerts).toBe(3);
  });
});
