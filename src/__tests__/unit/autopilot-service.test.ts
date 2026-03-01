import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { DraftTrigger } from '@/lib/types/autopilot';

// ---------------------------------------------------------------------------
// Hoisted mocks (vi.hoisted ensures these exist before vi.mock runs)
// ---------------------------------------------------------------------------

const {
  mockCheckDraftLimit,
  mockCreateDraft,
  mockDeduplicateTriggers,
  mockDetectCompetitorGap,
  mockDetectPromptMissing,
  mockDetectReviewGap,
  mockDetectSchemaGap,
  mockCanRunAutopilot,
  mockCaptureException,
} = vi.hoisted(() => ({
  mockCheckDraftLimit: vi.fn(),
  mockCreateDraft: vi.fn(),
  mockDeduplicateTriggers: vi.fn(),
  mockDetectCompetitorGap: vi.fn(),
  mockDetectPromptMissing: vi.fn(),
  mockDetectReviewGap: vi.fn(),
  mockDetectSchemaGap: vi.fn(),
  mockCanRunAutopilot: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({ captureException: mockCaptureException }));
vi.mock('@/lib/plan-enforcer', () => ({ canRunAutopilot: mockCanRunAutopilot }));
vi.mock('@/lib/autopilot/create-draft', () => ({ createDraft: mockCreateDraft }));
vi.mock('@/lib/autopilot/draft-limits', () => ({
  checkDraftLimit: mockCheckDraftLimit,
}));
vi.mock('@/lib/autopilot/draft-deduplicator', () => ({
  deduplicateTriggers: mockDeduplicateTriggers,
}));
vi.mock('@/lib/autopilot/triggers', () => ({
  detectCompetitorGapTriggers: mockDetectCompetitorGap,
  detectPromptMissingTriggers: mockDetectPromptMissing,
  detectReviewGapTriggers: mockDetectReviewGap,
  detectSchemaGapTriggers: mockDetectSchemaGap,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  runAutopilotForLocation,
  runAutopilotForAllOrgs,
} from '@/lib/autopilot/autopilot-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTrigger(overrides?: Partial<DraftTrigger>): DraftTrigger {
  return {
    triggerType: 'competitor_gap',
    triggerId: 'trigger-uuid-001',
    orgId: 'org-uuid-001',
    locationId: 'loc-uuid-001',
    context: {
      targetQuery: 'best italian restaurant in austin',
      competitorName: 'Pizza Palace',
      winningFactor: 'outdoor seating',
    },
    ...overrides,
  };
}

/**
 * Creates a mock Supabase client that handles the chained calls used by
 * runAutopilotForLocation (locations select + single, content_drafts count,
 * locations update) and runAutopilotForAllOrgs (organizations select + in,
 * locations select + eq + eq for active locations).
 */
function makeMockSupabase(opts: {
  businessName?: string;
  pendingCount?: number;
  orgs?: Array<{ id: string; plan: string }>;
  locations?: Array<{ id: string }>;
} = {}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'locations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              // .eq('id', locId).single() — used by runAutopilotForLocation
              single: vi.fn().mockResolvedValue({
                data: {
                  business_name: opts.businessName ?? 'Test Business',
                },
                error: null,
              }),
              // .eq('org_id', orgId).eq('is_archived', false) — used by runAutopilotForAllOrgs
              eq: vi.fn().mockResolvedValue({
                data: opts.locations ?? [{ id: 'loc-uuid-001' }],
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'content_drafts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                count: opts.pendingCount ?? 2,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: opts.orgs ?? [{ id: 'org-001', plan: 'growth' }],
              error: null,
            }),
          }),
        };
      }
      return {};
    }),
  } as unknown as SupabaseClient<Database>;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();

  // Sensible defaults — override per test as needed
  mockCheckDraftLimit.mockResolvedValue({
    allowed: true,
    current: 2,
    limit: 10,
  });
  mockDetectCompetitorGap.mockResolvedValue([]);
  mockDetectPromptMissing.mockResolvedValue([]);
  mockDetectReviewGap.mockResolvedValue([]);
  mockDetectSchemaGap.mockResolvedValue([]);
  mockDeduplicateTriggers.mockImplementation(
    (triggers: DraftTrigger[]) => triggers,
  );
  mockCreateDraft.mockResolvedValue({ id: 'new-draft-uuid' });
  mockCanRunAutopilot.mockReturnValue(true);
});

// ===========================================================================
// runAutopilotForLocation
// ===========================================================================

describe('runAutopilotForLocation', () => {
  const ORG_ID = 'org-uuid-001';
  const LOC_ID = 'loc-uuid-001';
  const PLAN = 'growth';

  it('returns early with draftsSkippedLimit=1 when draft limit exceeded', async () => {
    mockCheckDraftLimit.mockResolvedValue({
      allowed: false,
      current: 10,
      limit: 10,
    });
    const supabase = makeMockSupabase();

    const result = await runAutopilotForLocation(supabase, ORG_ID, LOC_ID, PLAN);

    expect(result.draftsSkippedLimit).toBe(1);
    expect(result.draftsCreated).toBe(0);
    // Should NOT have called any trigger detectors
    expect(mockDetectCompetitorGap).not.toHaveBeenCalled();
    expect(mockDetectPromptMissing).not.toHaveBeenCalled();
    expect(mockDetectReviewGap).not.toHaveBeenCalled();
    expect(mockDetectSchemaGap).not.toHaveBeenCalled();
  });

  it('runs all 4 trigger detectors in parallel', async () => {
    const supabase = makeMockSupabase();

    await runAutopilotForLocation(supabase, ORG_ID, LOC_ID, PLAN);

    expect(mockDetectCompetitorGap).toHaveBeenCalledOnce();
    expect(mockDetectPromptMissing).toHaveBeenCalledOnce();
    expect(mockDetectReviewGap).toHaveBeenCalledOnce();
    expect(mockDetectSchemaGap).toHaveBeenCalledOnce();

    // competitor_gap detector receives businessName as 4th arg
    expect(mockDetectCompetitorGap).toHaveBeenCalledWith(
      supabase,
      LOC_ID,
      ORG_ID,
      'Test Business',
    );
    // The other 3 detectors receive (supabase, locationId, orgId)
    expect(mockDetectPromptMissing).toHaveBeenCalledWith(supabase, LOC_ID, ORG_ID);
    expect(mockDetectReviewGap).toHaveBeenCalledWith(supabase, LOC_ID, ORG_ID);
    expect(mockDetectSchemaGap).toHaveBeenCalledWith(supabase, LOC_ID, ORG_ID);
  });

  it('sorts triggers by priority (competitor_gap first)', async () => {
    const schemaGapTrigger = makeTrigger({
      triggerType: 'schema_gap',
      triggerId: 'schema-001',
    });
    const competitorGapTrigger = makeTrigger({
      triggerType: 'competitor_gap',
      triggerId: 'comp-001',
    });
    const reviewGapTrigger = makeTrigger({
      triggerType: 'review_gap',
      triggerId: 'review-001',
    });

    // Return triggers out of priority order
    mockDetectSchemaGap.mockResolvedValue([schemaGapTrigger]);
    mockDetectCompetitorGap.mockResolvedValue([competitorGapTrigger]);
    mockDetectReviewGap.mockResolvedValue([reviewGapTrigger]);

    // Capture what deduplicateTriggers receives
    let receivedTriggers: DraftTrigger[] = [];
    mockDeduplicateTriggers.mockImplementation((triggers: DraftTrigger[]) => {
      receivedTriggers = [...triggers];
      return triggers;
    });

    const supabase = makeMockSupabase();
    await runAutopilotForLocation(supabase, ORG_ID, LOC_ID, PLAN);

    // Triggers should be sorted: competitor_gap (1) < review_gap (3) < schema_gap (4)
    expect(receivedTriggers[0].triggerType).toBe('competitor_gap');
    expect(receivedTriggers[1].triggerType).toBe('review_gap');
    expect(receivedTriggers[2].triggerType).toBe('schema_gap');
  });

  it('calls deduplicateTriggers with all triggers', async () => {
    const trigger1 = makeTrigger({ triggerId: 'comp-001', triggerType: 'competitor_gap' });
    const trigger2 = makeTrigger({ triggerId: 'prompt-001', triggerType: 'prompt_missing' });

    mockDetectCompetitorGap.mockResolvedValue([trigger1]);
    mockDetectPromptMissing.mockResolvedValue([trigger2]);

    const supabase = makeMockSupabase();
    await runAutopilotForLocation(supabase, ORG_ID, LOC_ID, PLAN);

    expect(mockDeduplicateTriggers).toHaveBeenCalledOnce();
    const [triggers, sb, orgId] = mockDeduplicateTriggers.mock.calls[0];
    expect(triggers).toHaveLength(2);
    expect(sb).toBe(supabase);
    expect(orgId).toBe(ORG_ID);
  });

  it('creates drafts for each deduped trigger', async () => {
    const trigger1 = makeTrigger({ triggerId: 'comp-001' });
    const trigger2 = makeTrigger({ triggerId: 'prompt-001', triggerType: 'prompt_missing' });

    mockDetectCompetitorGap.mockResolvedValue([trigger1]);
    mockDetectPromptMissing.mockResolvedValue([trigger2]);

    const supabase = makeMockSupabase();
    const result = await runAutopilotForLocation(supabase, ORG_ID, LOC_ID, PLAN);

    expect(mockCreateDraft).toHaveBeenCalledTimes(2);
    expect(result.draftsCreated).toBe(2);
  });

  it('skips draft creation when remaining limit is 0', async () => {
    // current=9, limit=10 => remaining=1, so only 1 draft can be created
    mockCheckDraftLimit.mockResolvedValue({
      allowed: true,
      current: 9,
      limit: 10,
    });

    const trigger1 = makeTrigger({ triggerId: 'comp-001', triggerType: 'competitor_gap' });
    const trigger2 = makeTrigger({ triggerId: 'prompt-001', triggerType: 'prompt_missing' });
    const trigger3 = makeTrigger({ triggerId: 'review-001', triggerType: 'review_gap' });

    mockDetectCompetitorGap.mockResolvedValue([trigger1]);
    mockDetectPromptMissing.mockResolvedValue([trigger2]);
    mockDetectReviewGap.mockResolvedValue([trigger3]);

    const supabase = makeMockSupabase();
    const result = await runAutopilotForLocation(supabase, ORG_ID, LOC_ID, PLAN);

    expect(mockCreateDraft).toHaveBeenCalledTimes(1);
    expect(result.draftsCreated).toBe(1);
    expect(result.draftsSkippedLimit).toBe(2);
  });

  it('records errors when trigger detector fails (rejected promise)', async () => {
    const detectorError = new Error('Database connection lost');
    mockDetectCompetitorGap.mockRejectedValue(detectorError);

    const supabase = makeMockSupabase();
    const result = await runAutopilotForLocation(supabase, ORG_ID, LOC_ID, PLAN);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Trigger detector competitor_gap failed');
    expect(result.errors[0]).toContain('Database connection lost');
  });

  it('records errors when createDraft throws', async () => {
    const trigger = makeTrigger({ triggerId: 'comp-001' });
    mockDetectCompetitorGap.mockResolvedValue([trigger]);
    mockCreateDraft.mockRejectedValue(new Error('GPT-4o rate limit'));

    const supabase = makeMockSupabase();
    const result = await runAutopilotForLocation(supabase, ORG_ID, LOC_ID, PLAN);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Draft creation failed for competitor_gap');
    expect(result.errors[0]).toContain('GPT-4o rate limit');
    expect(result.draftsCreated).toBe(0);
  });

  it('calls Sentry.captureException on trigger detector failure', async () => {
    const detectorError = new Error('Supabase timeout');
    mockDetectReviewGap.mockRejectedValue(detectorError);

    const supabase = makeMockSupabase();
    await runAutopilotForLocation(supabase, ORG_ID, LOC_ID, PLAN);

    expect(mockCaptureException).toHaveBeenCalledWith(detectorError, {
      tags: { component: 'autopilot', trigger: 'review_gap', sprint: '86' },
    });
  });

  it('updates location tracking after run', async () => {
    const supabase = makeMockSupabase();
    await runAutopilotForLocation(supabase, ORG_ID, LOC_ID, PLAN);

    // updateLocationTracking queries content_drafts then updates locations
    // The mock supabase.from was called with both 'content_drafts' and 'locations'
    const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: string[]) => c[0],
    );
    expect(fromCalls).toContain('content_drafts');
    expect(fromCalls).toContain('locations');
  });

  it('returns correct draftsCreated count', async () => {
    const trigger1 = makeTrigger({ triggerId: 'comp-001', triggerType: 'competitor_gap' });
    const trigger2 = makeTrigger({ triggerId: 'prompt-001', triggerType: 'prompt_missing' });
    const trigger3 = makeTrigger({ triggerId: 'review-001', triggerType: 'review_gap' });

    mockDetectCompetitorGap.mockResolvedValue([trigger1]);
    mockDetectPromptMissing.mockResolvedValue([trigger2]);
    mockDetectReviewGap.mockResolvedValue([trigger3]);

    // createDraft returns a draft for the first two, null for the third
    mockCreateDraft
      .mockResolvedValueOnce({ id: 'draft-1' })
      .mockResolvedValueOnce({ id: 'draft-2' })
      .mockResolvedValueOnce(null);

    const supabase = makeMockSupabase();
    const result = await runAutopilotForLocation(supabase, ORG_ID, LOC_ID, PLAN);

    // Only 2 drafts were actually created (3rd returned null)
    expect(result.draftsCreated).toBe(2);
  });

  it('returns correct draftsSkippedDedup count', async () => {
    const trigger1 = makeTrigger({ triggerId: 'comp-001', triggerType: 'competitor_gap' });
    const trigger2 = makeTrigger({ triggerId: 'prompt-001', triggerType: 'prompt_missing' });
    const trigger3 = makeTrigger({ triggerId: 'review-001', triggerType: 'review_gap' });

    mockDetectCompetitorGap.mockResolvedValue([trigger1]);
    mockDetectPromptMissing.mockResolvedValue([trigger2]);
    mockDetectReviewGap.mockResolvedValue([trigger3]);

    // Deduplicator removes 1 trigger (returns only 2 of 3)
    mockDeduplicateTriggers.mockResolvedValue([trigger1, trigger3]);

    const supabase = makeMockSupabase();
    const result = await runAutopilotForLocation(supabase, ORG_ID, LOC_ID, PLAN);

    expect(result.draftsSkippedDedup).toBe(1);
  });
});

// ===========================================================================
// runAutopilotForAllOrgs
// ===========================================================================

describe('runAutopilotForAllOrgs', () => {
  it('returns zeros when no Growth+ orgs found', async () => {
    const supabase = makeMockSupabase({ orgs: [] });

    const result = await runAutopilotForAllOrgs(supabase);

    expect(result).toEqual({ processed: 0, draftsCreated: 0, errors: 0 });
  });

  it('processes all Growth+ orgs sequentially', async () => {
    const supabase = makeMockSupabase({
      orgs: [
        { id: 'org-001', plan: 'growth' },
        { id: 'org-002', plan: 'agency' },
      ],
      locations: [{ id: 'loc-001' }],
    });

    const result = await runAutopilotForAllOrgs(supabase);

    // 2 orgs x 1 location each = 2 processed
    expect(result.processed).toBe(2);
    expect(mockCheckDraftLimit).toHaveBeenCalledTimes(2);
  });

  it('skips orgs that fail canRunAutopilot check', async () => {
    mockCanRunAutopilot.mockReturnValue(false);

    const supabase = makeMockSupabase({
      orgs: [
        { id: 'org-001', plan: 'growth' },
        { id: 'org-002', plan: 'agency' },
      ],
    });

    const result = await runAutopilotForAllOrgs(supabase);

    expect(result.processed).toBe(0);
    expect(result.draftsCreated).toBe(0);
    // No location or draft queries should have been made
    expect(mockCheckDraftLimit).not.toHaveBeenCalled();
  });

  it('handles runAutopilotForLocation throwing error', async () => {
    // Make checkDraftLimit throw to simulate a total failure inside
    // runAutopilotForLocation — this causes the outer try/catch to fire
    mockCheckDraftLimit.mockRejectedValue(new Error('Unexpected DB failure'));

    const supabase = makeMockSupabase({
      orgs: [{ id: 'org-001', plan: 'growth' }],
      locations: [{ id: 'loc-001' }],
    });

    const result = await runAutopilotForAllOrgs(supabase);

    expect(result.errors).toBe(1);
    expect(result.processed).toBe(0);
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({
          component: 'autopilot-cron',
          orgId: 'org-001',
        }),
      }),
    );
  });
});
