// ---------------------------------------------------------------------------
// competitor-actions.test.ts — Unit tests for Phase 3 Competitor Intercept Server Actions
//
// Tests app/dashboard/compete/actions.ts:
//   • addCompetitor             — auth, plan gate, count limit, Zod, DB insert
//   • deleteCompetitor          — auth, DB delete, org scope
//   • runCompetitorIntercept    — auth, plan gate, 2-stage LLM, DB insert, mock fallback
//   • markInterceptActionComplete — auth, status validation, DB update
//
// Strategy:
//   • Supabase client, auth context, and next/cache mocked via vi.mock() (hoisted).
//   • vi.mock('ai') + vi.mock('@/lib/ai/providers') intercepts AI SDK calls.
//   • vi.useFakeTimers() eliminates the 3-second mock delay in fallback paths.
//   • Fixture data from golden-tenant.ts (AI_RULES §19.4).
//
// Run:
//   npx vitest run src/__tests__/unit/competitor-actions.test.ts
// ---------------------------------------------------------------------------

// ── Hoist vi.mock declarations BEFORE any imports (AI_RULES §4) ───────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSafeAuthContext: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('ai', () => ({ generateText: vi.fn(), generateObject: vi.fn(), jsonSchema: vi.fn((s: unknown) => ({ jsonSchema: s })) }));
vi.mock('@/lib/ai/providers', () => ({
  getModel:  vi.fn().mockReturnValue('mock-model'),
  hasApiKey: vi.fn().mockReturnValue(true),
}));

// ── Imports after mock declarations ──────────────────────────────────────

import {
  addCompetitor,
  deleteCompetitor,
  runCompetitorIntercept,
  markInterceptActionComplete,
} from '@/app/dashboard/compete/actions';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { MOCK_COMPETITOR, MOCK_INTERCEPT } from '@/src/__fixtures__/golden-tenant';
import { generateText, generateObject } from 'ai';
import { hasApiKey } from '@/lib/ai/providers';

// ── Shared fixtures ───────────────────────────────────────────────────────

const ORG_ID      = MOCK_COMPETITOR.org_id;       // 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const COMPETITOR_ID = MOCK_COMPETITOR.id;          // 'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const LOCATION_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11';
const INTERCEPT_ID = MOCK_INTERCEPT.id;            // 'a2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

const MOCK_AUTH = { orgId: ORG_ID, userId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11' };

const MOCK_ORG_GROWTH  = { plan: 'growth' };
const MOCK_ORG_STARTER = { plan: 'starter' };
const MOCK_ORG_TRIAL   = { plan: 'trial' };

const MOCK_LOCATION = {
  id:            LOCATION_ID,
  business_name: 'Charcoal N Chill',
  city:          'Alpharetta',
  state:         'GA',
  categories:    ['Hookah Bar', 'Indian Restaurant'],
};

const MOCK_COMPETITOR_ROW = {
  id:                 COMPETITOR_ID,
  org_id:             ORG_ID,
  competitor_name:    MOCK_COMPETITOR.competitor_name,
  competitor_address: MOCK_COMPETITOR.competitor_address,
};

// ── AI SDK mock response helpers ──────────────────────────────────────────

/** Mock generateText return value for Stage 1 (Perplexity). */
function mockGenerateTextResult() {
  return {
    text: JSON.stringify({
      winner:              'Cloud 9 Lounge',
      reasoning:           'More review mentions of late-night atmosphere.',
      key_differentiators: ['late-night hours', 'happy hour'],
    }),
  };
}

/** Mock generateObject return value for Stage 2 (OpenAI). */
function mockGenerateObjectResult() {
  return {
    object: {
      winner:           'Cloud 9 Lounge',
      winning_factor:   '15 more review mentions of "late night" atmosphere',
      gap_magnitude:    'high' as const,
      gap_details:      { competitor_mentions: 15, your_mentions: 2 },
      suggested_action: 'Ask 3 customers to mention "late night" in reviews this week',
      action_category:  'reviews' as const,
    },
  };
}

// ── Supabase mock factories ───────────────────────────────────────────────

/** Mock for addCompetitor — routes by table, returns growth org by default */
function mockSupabaseForAdd({
  plan       = 'growth',
  count      = 0,
  location   = { id: LOCATION_ID },
  insertError = null,
}: {
  plan?:        string;
  count?:       number;
  location?:    { id: string } | null;
  insertError?: unknown;
} = {}) {
  const mockInsert = vi.fn().mockResolvedValue({ data: null, error: insertError });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(createClient as any).mockResolvedValue({
    from: vi.fn((table: string) => {
      if (table === 'organizations') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { plan }, error: null }) };
      }
      if (table === 'competitors') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), insert: mockInsert, _count: count };
      }
      if (table === 'locations') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: location, error: null }) };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    }),
  });
  return { mockInsert };
}

/** Mock for deleteCompetitor */
function mockSupabaseForDelete(deleteError: unknown = null) {
  const mockDelete = vi.fn().mockReturnThis();
  const mockEq = vi.fn().mockReturnThis();
  const mockFinalEq = vi.fn().mockResolvedValue({ error: deleteError });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(createClient as any).mockResolvedValue({
    from: vi.fn(() => ({
      delete: mockDelete,
      eq:     mockEq,
    })),
  });
  void mockFinalEq; // silence unused warning
}

/** Full mock for runCompetitorIntercept — routes by table */
function mockSupabaseForIntercept({
  plan           = 'growth',
  competitor     = MOCK_COMPETITOR_ROW,
  competitorError = null,
  location       = MOCK_LOCATION,
  locationError  = null,
  insertError    = null,
}: {
  plan?:            string;
  competitor?:      typeof MOCK_COMPETITOR_ROW | null;
  competitorError?: unknown;
  location?:        typeof MOCK_LOCATION | null;
  locationError?:   unknown;
  insertError?:     unknown;
} = {}) {
  const mockInsert = vi.fn().mockResolvedValue({ data: null, error: insertError });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(createClient as any).mockResolvedValue({
    from: vi.fn((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnThis(),
          eq:     vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { plan }, error: null }),
        };
      }
      if (table === 'competitors') {
        return {
          select: vi.fn().mockReturnThis(),
          eq:     vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: competitor, error: competitorError }),
        };
      }
      if (table === 'locations') {
        return {
          select: vi.fn().mockReturnThis(),
          eq:     vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: location, error: locationError }),
        };
      }
      if (table === 'competitor_intercepts') {
        return { insert: mockInsert };
      }
      return {};
    }),
  });

  return { mockInsert };
}

/** Mock for markInterceptActionComplete */
function mockSupabaseForMark(updateError: unknown = null) {
  const mockUpdate = vi.fn().mockReturnThis();
  const mockEq1    = vi.fn().mockReturnThis();
  const mockEq2    = vi.fn().mockResolvedValue({ error: updateError });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(createClient as any).mockResolvedValue({
    from: vi.fn(() => ({
      update: mockUpdate,
      eq:     vi.fn().mockReturnValueOnce({ eq: mockEq2 }).mockReturnValueOnce(mockEq1),
    })),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// addCompetitor — 7 tests
// ═══════════════════════════════════════════════════════════════════════════

describe('addCompetitor', () => {
  beforeEach(() => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(MOCK_AUTH as never);
    mockSupabaseForAdd();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns Unauthorized when getSafeAuthContext() returns null', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValueOnce(null);

    const result = await addCompetitor({ competitor_name: 'Cloud 9 Lounge' });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns error when org plan is Starter (canRunCompetitorIntercept = false)', async () => {
    mockSupabaseForAdd({ plan: 'starter' });

    const result = await addCompetitor({ competitor_name: 'Cloud 9 Lounge' });

    expect(result).toEqual({ success: false, error: 'Upgrade to Growth plan to track competitors' });
  });

  it('returns Zod error when competitor_name is shorter than 2 characters', async () => {
    const result = await addCompetitor({ competitor_name: 'X' }); // 1 char — too short

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('2 characters');
    }
  });

  it('returns error when competitor count equals maxCompetitors for Growth plan', async () => {
    // Growth plan = max 3 competitors; count=3 means limit reached
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createClient as any).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'organizations') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { plan: 'growth' }, error: null }) };
        }
        if (table === 'competitors') {
          return {
            select: vi.fn().mockReturnThis(),
            eq:     vi.fn().mockReturnThis(),
            // count query returns 3 (at limit)
            then:   vi.fn().mockResolvedValue({ count: 3, error: null }),
          };
        }
        return {};
      }),
    });

    // Simpler: mock the supabase chain to return count=3
    const mockInsert = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createClient as any).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'organizations') return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { plan: 'growth' }, error: null }) };
        if (table === 'competitors') return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ count: 3, error: null }), insert: mockInsert };
        return {};
      }),
    });

    const result = await addCompetitor({ competitor_name: 'Cloud 9 Lounge' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('limit reached');
    }
  });

  it('inserts with server-derived org_id (never from client)', async () => {
    const { mockInsert } = mockSupabaseForAdd({ count: 0 });

    await addCompetitor({
      competitor_name:    'Cloud 9 Lounge',
      competitor_address: '123 Main St, Alpharetta, GA',
    });

    expect(mockInsert).toHaveBeenCalledOnce();
    const inserted = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.org_id).toBe(ORG_ID);
    expect(inserted.competitor_name).toBe('Cloud 9 Lounge');
  });

  it('includes location_id from primary location in insert', async () => {
    const { mockInsert } = mockSupabaseForAdd({ location: { id: LOCATION_ID } });

    await addCompetitor({ competitor_name: 'Cloud 9 Lounge' });

    const inserted = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.location_id).toBe(LOCATION_ID);
  });

  it('calls revalidatePath on success', async () => {
    mockSupabaseForAdd();

    await addCompetitor({ competitor_name: 'Cloud 9 Lounge' });

    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/dashboard/compete');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// deleteCompetitor — 3 tests
// ═══════════════════════════════════════════════════════════════════════════

describe('deleteCompetitor', () => {
  beforeEach(() => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(MOCK_AUTH as never);
    mockSupabaseForDelete();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns Unauthorized when getSafeAuthContext() returns null', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValueOnce(null);

    const result = await deleteCompetitor(COMPETITOR_ID);

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('deletes competitor with org_id scope and returns success', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createClient as any).mockResolvedValue({
      from: vi.fn(() => ({
        delete: vi.fn().mockReturnThis(),
        eq:     vi.fn().mockReturnThis(),
      })),
    });

    const result = await deleteCompetitor(COMPETITOR_ID);

    expect(result).toEqual({ success: true });
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/dashboard/compete');
  });

  it('returns DB error string on delete failure', async () => {
    // Explicit chain: delete().eq('id').eq('org_id') → { error }
    const finalEq  = vi.fn().mockResolvedValue({ error: { message: 'DB delete error' } });
    const firstEq  = vi.fn().mockReturnValue({ eq: finalEq });
    const deleteOp = vi.fn().mockReturnValue({ eq: firstEq });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createClient as any).mockResolvedValue({
      from: vi.fn().mockReturnValue({ delete: deleteOp }),
    });

    const result = await deleteCompetitor(COMPETITOR_ID);

    expect(result).toEqual({ success: false, error: 'DB delete error' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// runCompetitorIntercept — 8 tests
// ═══════════════════════════════════════════════════════════════════════════

describe('runCompetitorIntercept', () => {
  beforeEach(() => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(MOCK_AUTH as never);
    vi.useFakeTimers(); // eliminates 3-second mock delay (AI_RULES §4)
    // Default: both API keys present (hasApiKey returns true for all)
    vi.mocked(hasApiKey).mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('returns Unauthorized when getSafeAuthContext() returns null', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValueOnce(null);

    const result = await runCompetitorIntercept(COMPETITOR_ID);

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns error for Trial plan (canRunCompetitorIntercept = false)', async () => {
    mockSupabaseForIntercept({ plan: 'trial' });

    const resultPromise = runCompetitorIntercept(COMPETITOR_ID);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toEqual({ success: false, error: 'Upgrade to Growth plan to run competitor analysis' });
  });

  it('returns error when competitor not found', async () => {
    mockSupabaseForIntercept({ competitor: null, competitorError: { message: 'not found' } });

    const resultPromise = runCompetitorIntercept(COMPETITOR_ID);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toEqual({ success: false, error: 'Competitor not found or access denied' });
  });

  it('calls Perplexity (generateText) then OpenAI (generateObject) when both API keys are set', async () => {
    vi.mocked(generateText).mockResolvedValue(mockGenerateTextResult() as never);
    vi.mocked(generateObject).mockResolvedValue(mockGenerateObjectResult() as never);
    mockSupabaseForIntercept();

    const resultPromise = runCompetitorIntercept(COMPETITOR_ID);
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(vi.mocked(generateText)).toHaveBeenCalledOnce();
    expect(vi.mocked(generateObject)).toHaveBeenCalledOnce();
  });

  it('uses mock fallback (no AI SDK calls) when API keys are absent', async () => {
    // Both keys absent — mock fallback path
    vi.mocked(hasApiKey).mockReturnValue(false);
    mockSupabaseForIntercept();

    const resultPromise = runCompetitorIntercept(COMPETITOR_ID);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(vi.mocked(generateText)).not.toHaveBeenCalled();
    expect(vi.mocked(generateObject)).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it('inserts into competitor_intercepts with server-derived org_id and model_provider=openai-gpt4o-mini', async () => {
    vi.mocked(generateText).mockResolvedValue(mockGenerateTextResult() as never);
    vi.mocked(generateObject).mockResolvedValue(mockGenerateObjectResult() as never);

    const { mockInsert } = mockSupabaseForIntercept();

    const resultPromise = runCompetitorIntercept(COMPETITOR_ID);
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(mockInsert).toHaveBeenCalledOnce();
    const inserted = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.org_id).toBe(ORG_ID);
    expect(inserted.model_provider).toBe('openai-gpt4o-mini');
    expect(inserted.action_status).toBe('pending');
  });

  it('gap_analysis JSONB contains correct competitor_mentions and your_mentions', async () => {
    vi.mocked(generateText).mockResolvedValue(mockGenerateTextResult() as never);
    vi.mocked(generateObject).mockResolvedValue(mockGenerateObjectResult() as never);

    const { mockInsert } = mockSupabaseForIntercept();

    const resultPromise = runCompetitorIntercept(COMPETITOR_ID);
    await vi.runAllTimersAsync();
    await resultPromise;

    const inserted = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.gap_analysis).toEqual({ competitor_mentions: 15, your_mentions: 2 });
  });

  it('handles Perplexity error gracefully and falls back to mock, still inserts successfully', async () => {
    // Perplexity call throws → mock fallback for Stage 1
    // OpenAI call succeeds
    vi.mocked(generateText).mockRejectedValue(new Error('Perplexity network error'));
    vi.mocked(generateObject).mockResolvedValue(mockGenerateObjectResult() as never);

    const { mockInsert } = mockSupabaseForIntercept();

    const resultPromise = runCompetitorIntercept(COMPETITOR_ID);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    // Action succeeded despite Stage 1 failure
    expect(result).toEqual({ success: true });
    expect(mockInsert).toHaveBeenCalledOnce();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// markInterceptActionComplete — 4 tests
// ═══════════════════════════════════════════════════════════════════════════

describe('markInterceptActionComplete', () => {
  beforeEach(() => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(MOCK_AUTH as never);
    mockSupabaseForMark();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns Unauthorized when getSafeAuthContext() returns null', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValueOnce(null);

    const result = await markInterceptActionComplete(INTERCEPT_ID, 'completed');

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('updates action_status to completed with org_id scope', async () => {
    // Explicit chain: update(payload).eq('id').eq('org_id') → { error: null }
    const finalEq  = vi.fn().mockResolvedValue({ error: null });
    const firstEq  = vi.fn().mockReturnValue({ eq: finalEq });
    const updateOp = vi.fn().mockReturnValue({ eq: firstEq });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createClient as any).mockResolvedValue({
      from: vi.fn().mockReturnValue({ update: updateOp }),
    });

    const result = await markInterceptActionComplete(INTERCEPT_ID, 'completed');

    expect(result).toEqual({ success: true });
    expect(updateOp).toHaveBeenCalledWith({ action_status: 'completed' });
  });

  it('updates action_status to dismissed', async () => {
    // Explicit chain: update(payload).eq('id').eq('org_id') → { error: null }
    const finalEq  = vi.fn().mockResolvedValue({ error: null });
    const firstEq  = vi.fn().mockReturnValue({ eq: finalEq });
    const updateOp = vi.fn().mockReturnValue({ eq: firstEq });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createClient as any).mockResolvedValue({
      from: vi.fn().mockReturnValue({ update: updateOp }),
    });

    const result = await markInterceptActionComplete(INTERCEPT_ID, 'dismissed');

    expect(result).toEqual({ success: true });
    expect(updateOp).toHaveBeenCalledWith({ action_status: 'dismissed' });
  });

  it('calls revalidatePath on success', async () => {
    // Explicit chain: update(payload).eq('id').eq('org_id') → { error: null }
    const finalEq  = vi.fn().mockResolvedValue({ error: null });
    const firstEq  = vi.fn().mockReturnValue({ eq: finalEq });
    const updateOp = vi.fn().mockReturnValue({ eq: firstEq });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createClient as any).mockResolvedValue({
      from: vi.fn().mockReturnValue({ update: updateOp }),
    });

    await markInterceptActionComplete(INTERCEPT_ID, 'completed');

    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/dashboard/compete');
  });
});
