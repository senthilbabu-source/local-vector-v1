/**
 * Correction Service — Unit Tests (Sprint 121)
 *
 * 16 tests covering markHallucinationCorrected, generateCorrectionBrief,
 * runCorrectionRescan, and getCorrectionEffectivenessScore.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  MOCK_CORRECTION_FOLLOW_UP_PENDING,
} from '@/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Hoisted mocks — vi.mock factories are hoisted above all other code
// ---------------------------------------------------------------------------

const {
  mockGenerateText,
  mockGetModel,
  mockCaptureException,
  mockBuildCorrectionBriefPrompt,
  mockBuildCorrectionDraftTitle,
} = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockGetModel: vi.fn().mockReturnValue('mock-model'),
  mockCaptureException: vi.fn(),
  mockBuildCorrectionBriefPrompt: vi.fn().mockReturnValue({
    systemPrompt: 'You are a content writer.',
    userPrompt: 'Write a correction article.',
  }),
  mockBuildCorrectionDraftTitle: vi.fn().mockReturnValue('Correction: Test claim — Test Org'),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('ai', () => ({ generateText: mockGenerateText }));
vi.mock('@/lib/ai/providers', () => ({ getModel: mockGetModel }));
vi.mock('@sentry/nextjs', () => ({ captureException: mockCaptureException }));
vi.mock('@/lib/corrections/correction-brief-prompt', () => ({
  buildCorrectionBriefPrompt: mockBuildCorrectionBriefPrompt,
  buildCorrectionDraftTitle: mockBuildCorrectionDraftTitle,
}));

// ---------------------------------------------------------------------------
// Supabase mock helper — returns chainable mock supporting
// .from().select().eq().eq().maybeSingle() and variants
// ---------------------------------------------------------------------------

interface MockSupabaseConfig {
  selectResult?: { data: unknown; error: unknown };
  updateResult?: { error: unknown };
  insertResult?: { data: unknown; error: unknown };
  orgNameResult?: { data: { name: string } | null; error: unknown };
}

function createMockSupabase(config: MockSupabaseConfig = {}) {
  const {
    selectResult = { data: null, error: null },
    updateResult = { error: null },
    insertResult = { data: null, error: null },
    orgNameResult = { data: { name: 'Charcoal N Chill' }, error: null },
  } = config;

  // Track calls by table name
  const tableCallLog: string[] = [];
  const mockUpdateFn = vi.fn();
  const mockInsertFn = vi.fn();

  const buildChain = (table: string) => {
    // Determine correct data for this table
    const isOrg = table === 'organizations';
    const isHallucination = table === 'ai_hallucinations';
    const isFollowUp = table === 'correction_follow_ups';
    const isDraft = table === 'content_drafts';

    const maybeSingleResult = isOrg
      ? orgNameResult
      : selectResult;

    const singleResult = isFollowUp || isDraft
      ? insertResult
      : selectResult;

    const maybeSingle = vi.fn().mockResolvedValue(maybeSingleResult);
    const single = vi.fn().mockResolvedValue(singleResult);

    const gteFn = vi.fn().mockReturnValue({ data: selectResult.data, error: selectResult.error });
    const inFn = vi.fn().mockReturnValue({ gte: gteFn });

    // eq chain: up to 2 levels deep + terminal
    const eqLevel2 = vi.fn().mockReturnValue({ maybeSingle, single });
    const eqLevel1 = vi.fn().mockReturnValue({
      eq: eqLevel2,
      maybeSingle,
      single,
      in: inFn,
      gte: gteFn,
    });

    const selectFn = vi.fn().mockReturnValue({
      eq: eqLevel1,
      single,
    });

    // update: returns { eq: fn } that resolves to updateResult
    const updateEq = vi.fn().mockReturnValue(updateResult);
    const updateFn = vi.fn((...args: unknown[]) => {
      mockUpdateFn(table, ...args);
      return { eq: updateEq };
    });

    // insert: returns chain with .select().single()
    const insertSelectSingle = vi.fn().mockResolvedValue(singleResult);
    const insertSelectFn = vi.fn().mockReturnValue({ single: insertSelectSingle });
    const insertFn = vi.fn((...args: unknown[]) => {
      mockInsertFn(table, ...args);
      return { select: insertSelectFn };
    });

    return { select: selectFn, update: updateFn, insert: insertFn };
  };

  const fromFn = vi.fn((table: string) => {
    tableCallLog.push(table);
    return buildChain(table);
  });

  return {
    supabase: { from: fromFn } as unknown as SupabaseClient<Database>,
    fromFn,
    mockUpdateFn,
    mockInsertFn,
    tableCallLog,
  };
}

// ---------------------------------------------------------------------------
// Import SUT
// ---------------------------------------------------------------------------

import {
  markHallucinationCorrected,
  generateCorrectionBrief,
  runCorrectionRescan,
  getCorrectionEffectivenessScore,
} from '@/lib/corrections/correction-service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const HALLUCINATION_ID = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const MOCK_HALLUCINATION = {
  id: HALLUCINATION_ID,
  claim_text: 'Charcoal N Chill appears to be permanently closed.',
  expected_truth: 'Charcoal N Chill is actively operating.',
  correction_status: 'open',
  org_id: ORG_ID,
};

// ---------------------------------------------------------------------------
// Reset mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockGenerateText.mockResolvedValue({ text: 'Corrected content about the business.' });
});

// ===========================================================================
// markHallucinationCorrected
// ===========================================================================

describe('markHallucinationCorrected', () => {
  it('1. updates status=corrected and corrected_at', async () => {
    const followUpData = { ...MOCK_CORRECTION_FOLLOW_UP_PENDING, hallucination_id: HALLUCINATION_ID };
    const { supabase, mockUpdateFn } = createMockSupabase({
      selectResult: { data: MOCK_HALLUCINATION, error: null },
      insertResult: { data: followUpData, error: null },
    });

    await markHallucinationCorrected(supabase, HALLUCINATION_ID, ORG_ID);

    // Verify ai_hallucinations update was called with corrected status
    const hallucinationUpdate = mockUpdateFn.mock.calls.find(
      (c: unknown[]) => c[0] === 'ai_hallucinations',
    );
    expect(hallucinationUpdate).toBeDefined();
    const updatePayload = hallucinationUpdate![1];
    expect(updatePayload.correction_status).toBe('corrected');
    expect(updatePayload.corrected_at).toBeDefined();
    expect(typeof updatePayload.corrected_at).toBe('string');
  });

  it('2. inserts correction_follow_ups with rescan_due_at ~14 days from now', async () => {
    const followUpData = { ...MOCK_CORRECTION_FOLLOW_UP_PENDING, hallucination_id: HALLUCINATION_ID };
    const { supabase, mockInsertFn } = createMockSupabase({
      selectResult: { data: MOCK_HALLUCINATION, error: null },
      insertResult: { data: followUpData, error: null },
    });

    const beforeCall = Date.now();
    await markHallucinationCorrected(supabase, HALLUCINATION_ID, ORG_ID);

    // Verify correction_follow_ups insert
    const followUpInsert = mockInsertFn.mock.calls.find(
      (c: unknown[]) => c[0] === 'correction_follow_ups',
    );
    expect(followUpInsert).toBeDefined();
    const insertPayload = followUpInsert![1];
    expect(insertPayload.hallucination_id).toBe(HALLUCINATION_ID);
    expect(insertPayload.org_id).toBe(ORG_ID);

    // rescan_due_at should be ~14 days in the future
    const rescanDate = new Date(insertPayload.rescan_due_at).getTime();
    const fourteenDays = 14 * 24 * 60 * 60 * 1000;
    expect(rescanDate).toBeGreaterThanOrEqual(beforeCall + fourteenDays - 1000);
    expect(rescanDate).toBeLessThanOrEqual(beforeCall + fourteenDays + 5000);
  });

  it('3. throws hallucination_not_found when id not found', async () => {
    const { supabase } = createMockSupabase({
      selectResult: { data: null, error: null },
    });

    await expect(
      markHallucinationCorrected(supabase, 'nonexistent-id', ORG_ID),
    ).rejects.toThrow('hallucination_not_found');
  });

  it('4. throws already_corrected when status is corrected', async () => {
    const { supabase } = createMockSupabase({
      selectResult: {
        data: { ...MOCK_HALLUCINATION, correction_status: 'corrected' },
        error: null,
      },
    });

    await expect(
      markHallucinationCorrected(supabase, HALLUCINATION_ID, ORG_ID),
    ).rejects.toThrow('already_corrected');
  });

  it('5. calls generateCorrectionBrief as fire-and-forget', async () => {
    const followUpData = { ...MOCK_CORRECTION_FOLLOW_UP_PENDING, hallucination_id: HALLUCINATION_ID };
    const { supabase, mockInsertFn } = createMockSupabase({
      selectResult: { data: MOCK_HALLUCINATION, error: null },
      insertResult: { data: followUpData, error: null },
    });

    const result = await markHallucinationCorrected(supabase, HALLUCINATION_ID, ORG_ID);

    // brief_id is null because generateCorrectionBrief is fire-and-forget
    expect(result.brief_id).toBeNull();
    // follow_up should be returned
    expect(result.follow_up).toBeDefined();

    // The content_drafts insert is triggered asynchronously by generateCorrectionBrief
    // Give the fire-and-forget promise a tick to resolve
    await vi.waitFor(() => {
      expect(mockGenerateText).toHaveBeenCalled();
    });
  });
});

// ===========================================================================
// generateCorrectionBrief
// ===========================================================================

describe('generateCorrectionBrief', () => {
  const hallucination = {
    id: HALLUCINATION_ID,
    claim_text: 'Charcoal N Chill appears to be permanently closed.',
    expected_truth: 'Charcoal N Chill is actively operating.',
  };

  it('6. calls AI with model streaming-preview', async () => {
    const draftId = 'draft-gen-001';
    const { supabase } = createMockSupabase({
      insertResult: { data: { id: draftId }, error: null },
    });

    await generateCorrectionBrief(supabase, hallucination, ORG_ID, 'Charcoal N Chill');

    expect(mockGetModel).toHaveBeenCalledWith('streaming-preview');
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'mock-model',
        maxTokens: 512,
      }),
    );
  });

  it('7. inserts content_drafts with trigger_type=hallucination_correction', async () => {
    const draftId = 'draft-gen-002';
    const { supabase, mockInsertFn } = createMockSupabase({
      insertResult: { data: { id: draftId }, error: null },
    });

    await generateCorrectionBrief(supabase, hallucination, ORG_ID, 'Charcoal N Chill');

    const draftInsert = mockInsertFn.mock.calls.find(
      (c: unknown[]) => c[0] === 'content_drafts',
    );
    expect(draftInsert).toBeDefined();
    const payload = draftInsert![1];
    expect(payload.trigger_type).toBe('hallucination_correction');
    expect(payload.trigger_id).toBe(HALLUCINATION_ID);
    expect(payload.org_id).toBe(ORG_ID);
    expect(payload.status).toBe('draft');
    expect(payload.content_type).toBe('blog_post');
    expect(payload.body).toBe('Corrected content about the business.');
  });

  it('8. updates correction_follow_ups.correction_brief_id', async () => {
    const draftId = 'draft-gen-003';
    const { supabase, mockUpdateFn } = createMockSupabase({
      insertResult: { data: { id: draftId }, error: null },
    });

    await generateCorrectionBrief(supabase, hallucination, ORG_ID, 'Charcoal N Chill');

    const followUpUpdate = mockUpdateFn.mock.calls.find(
      (c: unknown[]) => c[0] === 'correction_follow_ups',
    );
    expect(followUpUpdate).toBeDefined();
    expect(followUpUpdate![1]).toEqual({ correction_brief_id: draftId });
  });

  it('9. does NOT throw on AI error (logs warning)', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('AI service unavailable'));

    const { supabase } = createMockSupabase();
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Should NOT throw
    await expect(
      generateCorrectionBrief(supabase, hallucination, ORG_ID, 'Charcoal N Chill'),
    ).resolves.toBeUndefined();

    // Should log warning
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[correction-service] Brief generation failed'),
      expect.any(Error),
    );

    // Should capture exception in Sentry
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: { sprint: '121', phase: 'correction-brief' },
      }),
    );

    consoleSpy.mockRestore();
  });

  it('10. includes notes in prompt when provided', async () => {
    const draftId = 'draft-gen-004';
    const { supabase } = createMockSupabase({
      insertResult: { data: { id: draftId }, error: null },
    });

    const notes = 'We are open 7 days a week from 5pm to 2am.';
    await generateCorrectionBrief(supabase, hallucination, ORG_ID, 'Charcoal N Chill', notes);

    // buildCorrectionBriefPrompt should receive notes as correct_info
    expect(mockBuildCorrectionBriefPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        correct_info: notes,
      }),
    );
  });
});

// ===========================================================================
// runCorrectionRescan
// ===========================================================================

describe('runCorrectionRescan', () => {
  const followUp = MOCK_CORRECTION_FOLLOW_UP_PENDING;

  it('11. rescan_status=cleared when response has "not accurate"', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'This statement is not accurate based on current data.',
    });

    const { supabase, mockUpdateFn } = createMockSupabase({
      selectResult: {
        data: { claim_text: 'Charcoal N Chill appears to be permanently closed.' },
        error: null,
      },
    });

    await runCorrectionRescan(supabase, followUp);

    const followUpUpdate = mockUpdateFn.mock.calls.find(
      (c: unknown[]) => c[0] === 'correction_follow_ups',
    );
    expect(followUpUpdate).toBeDefined();
    expect(followUpUpdate![1].rescan_status).toBe('cleared');
  });

  it('12. rescan_status=persists when response has "accurate"', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'Yes, this statement appears to be accurate based on available sources.',
    });

    const { supabase, mockUpdateFn } = createMockSupabase({
      selectResult: {
        data: { claim_text: 'Charcoal N Chill appears to be permanently closed.' },
        error: null,
      },
    });

    await runCorrectionRescan(supabase, followUp);

    const followUpUpdate = mockUpdateFn.mock.calls.find(
      (c: unknown[]) => c[0] === 'correction_follow_ups',
    );
    expect(followUpUpdate).toBeDefined();
    expect(followUpUpdate![1].rescan_status).toBe('persists');
  });

  it('13. rescan_status=inconclusive for ambiguous response', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'I cannot determine the validity of this statement from available data.',
    });

    const { supabase, mockUpdateFn } = createMockSupabase({
      selectResult: {
        data: { claim_text: 'Charcoal N Chill appears to be permanently closed.' },
        error: null,
      },
    });

    await runCorrectionRescan(supabase, followUp);

    const followUpUpdate = mockUpdateFn.mock.calls.find(
      (c: unknown[]) => c[0] === 'correction_follow_ups',
    );
    expect(followUpUpdate).toBeDefined();
    expect(followUpUpdate![1].rescan_status).toBe('inconclusive');
  });

  it('14. sets rescan_completed_at', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'This claim is false and no longer valid.',
    });

    const beforeCall = Date.now();
    const { supabase, mockUpdateFn } = createMockSupabase({
      selectResult: {
        data: { claim_text: 'Charcoal N Chill appears to be permanently closed.' },
        error: null,
      },
    });

    await runCorrectionRescan(supabase, followUp);

    const followUpUpdate = mockUpdateFn.mock.calls.find(
      (c: unknown[]) => c[0] === 'correction_follow_ups',
    );
    expect(followUpUpdate).toBeDefined();

    const completedAt = new Date(followUpUpdate![1].rescan_completed_at).getTime();
    expect(completedAt).toBeGreaterThanOrEqual(beforeCall);
    expect(completedAt).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('15. stores rescan_ai_response text', async () => {
    const aiResponse = 'The information is no longer present in AI outputs.';
    mockGenerateText.mockResolvedValueOnce({ text: aiResponse });

    const { supabase, mockUpdateFn } = createMockSupabase({
      selectResult: {
        data: { claim_text: 'Charcoal N Chill appears to be permanently closed.' },
        error: null,
      },
    });

    await runCorrectionRescan(supabase, followUp);

    const followUpUpdate = mockUpdateFn.mock.calls.find(
      (c: unknown[]) => c[0] === 'correction_follow_ups',
    );
    expect(followUpUpdate).toBeDefined();
    expect(followUpUpdate![1].rescan_ai_response).toBe(aiResponse);
  });
});

// ===========================================================================
// getCorrectionEffectivenessScore
// ===========================================================================

describe('getCorrectionEffectivenessScore', () => {
  it('16. score = (cleared/total)*100; null when total_rescanned=0', async () => {
    // --- Case A: 3 cleared, 2 persists → score = 60 ---
    const rowsA = [
      { rescan_status: 'cleared' },
      { rescan_status: 'cleared' },
      { rescan_status: 'cleared' },
      { rescan_status: 'persists' },
      { rescan_status: 'persists' },
    ];

    const mockGteA = vi.fn().mockReturnValue({ data: rowsA, error: null });
    const mockInA = vi.fn().mockReturnValue({ gte: mockGteA });
    const mockEq1A = vi.fn().mockReturnValue({ in: mockInA });
    const mockSelectA = vi.fn().mockReturnValue({ eq: mockEq1A });
    const supabaseA = {
      from: vi.fn().mockReturnValue({ select: mockSelectA }),
    } as unknown as SupabaseClient<Database>;

    const resultA = await getCorrectionEffectivenessScore(supabaseA, ORG_ID);
    expect(resultA.cleared).toBe(3);
    expect(resultA.total_rescanned).toBe(5);
    expect(resultA.score).toBe(60);

    // --- Case B: 0 rows → score = null ---
    const mockGteB = vi.fn().mockReturnValue({ data: [], error: null });
    const mockInB = vi.fn().mockReturnValue({ gte: mockGteB });
    const mockEq1B = vi.fn().mockReturnValue({ in: mockInB });
    const mockSelectB = vi.fn().mockReturnValue({ eq: mockEq1B });
    const supabaseB = {
      from: vi.fn().mockReturnValue({ select: mockSelectB }),
    } as unknown as SupabaseClient<Database>;

    const resultB = await getCorrectionEffectivenessScore(supabaseB, ORG_ID);
    expect(resultB.cleared).toBe(0);
    expect(resultB.total_rescanned).toBe(0);
    expect(resultB.score).toBeNull();
  });
});
