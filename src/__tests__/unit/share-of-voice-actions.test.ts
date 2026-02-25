// ---------------------------------------------------------------------------
// share-of-voice-actions.test.ts — Unit tests for SOV Server Actions
//
// Tests app/dashboard/share-of-voice/actions.ts:
//   • addTargetQuery  — auth, Zod validation, DB insert, revalidation
//   • runSovEvaluation — auth, Zod, DB fetch, API call (mocked), DB insert
//
// Strategy:
//   • Supabase client, auth context, and next/cache are mocked via vi.mock().
//   • global.fetch is replaced with vi.fn() for OpenAI / Perplexity calls.
//   • vi.useFakeTimers() eliminates the 3-second mock-delay in the fallback path.
//
// Run:
//   npx vitest run src/__tests__/unit/share-of-voice-actions.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoist vi.mock declarations before any imports ─────────────────────────

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSafeAuthContext: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// ── Import subjects and mocks after declarations ──────────────────────────

import { addTargetQuery, runSovEvaluation, deleteTargetQuery } from '@/app/dashboard/share-of-voice/actions';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// ── Shared fixtures ───────────────────────────────────────────────────────

const LOCATION_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const ORG_ID      = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11';
const QUERY_ID    = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11';

const MOCK_AUTH = { orgId: ORG_ID, userId: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d11' };

const MOCK_LOCATION = {
  id: LOCATION_ID,
  business_name: 'Charcoal N Chill',
  city: 'Alpharetta',
  state: 'GA',
};

const MOCK_QUERY_ROW = {
  id: QUERY_ID,
  location_id: LOCATION_ID,
  query_text: 'Best hookah bar near Alpharetta GA',
  locations: MOCK_LOCATION,
};

// ── Supabase mock factory — addTargetQuery ────────────────────────────────

function mockSupabaseInsert(error: unknown = null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(createClient as any).mockResolvedValue({
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ data: null, error }),
    })),
  });
}

// ── Supabase mock factory — runSovEvaluation ──────────────────────────────

function mockSupabaseForSov({
  queryRow = MOCK_QUERY_ROW,
  queryError = null,
  insertError = null,
}: {
  queryRow?: typeof MOCK_QUERY_ROW | null;
  queryError?: unknown;
  insertError?: unknown;
} = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(createClient as any).mockResolvedValue({
    from: vi.fn((table: string) => {
      if (table === 'target_queries') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: queryRow, error: queryError }),
            }),
          }),
        };
      }
      if (table === 'sov_evaluations') {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: insertError }),
        };
      }
      return {};
    }),
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Returns a fetch mock that resolves with a valid SOV JSON response. */
function mockFetchSovResponse(rankPosition = 1, competitors: string[] = []) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              rank_position: rankPosition,
              mentioned_competitors: competitors,
              raw_response: 'Charcoal N Chill is the best hookah bar in Alpharetta.',
            }),
          },
        },
      ],
    }),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('addTargetQuery', () => {
  beforeEach(() => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(MOCK_AUTH as never);
    mockSupabaseInsert();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns Unauthorized when getSafeAuthContext() returns null', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValueOnce(null);

    const result = await addTargetQuery({
      location_id: LOCATION_ID,
      query_text: 'best hookah bar',
    });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns Unauthorized when orgId is missing from context', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValueOnce({ orgId: null } as never);

    const result = await addTargetQuery({
      location_id: LOCATION_ID,
      query_text: 'best hookah bar',
    });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns Zod validation error for empty query_text (too short)', async () => {
    const result = await addTargetQuery({
      location_id: LOCATION_ID,
      query_text: 'ab', // too short — min 3 chars
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      // Zod v4 fix: error comes from .issues[0] not .errors[0]
      expect(result.error).toContain('3 characters');
    }
  });

  it('inserts to target_queries with server-derived org_id', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createClient as any).mockResolvedValue({
      from: vi.fn(() => ({ insert: mockInsert })),
    });

    await addTargetQuery({
      location_id: LOCATION_ID,
      query_text: 'best hookah bar Alpharetta',
    });

    expect(mockInsert).toHaveBeenCalledOnce();
    const inserted = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.org_id).toBe(ORG_ID);
    expect(inserted.location_id).toBe(LOCATION_ID);
  });

  it('trims whitespace from query_text before inserting', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createClient as any).mockResolvedValue({
      from: vi.fn(() => ({ insert: mockInsert })),
    });

    await addTargetQuery({
      location_id: LOCATION_ID,
      query_text: '  best hookah bar Alpharetta  ',
    });

    const inserted = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.query_text).toBe('best hookah bar Alpharetta');
  });

  it('calls revalidatePath on success', async () => {
    await addTargetQuery({
      location_id: LOCATION_ID,
      query_text: 'best hookah bar Alpharetta',
    });

    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/dashboard/share-of-voice');
  });

  it('returns error when DB insert fails', async () => {
    mockSupabaseInsert({ message: 'DB insert error' });

    const result = await addTargetQuery({
      location_id: LOCATION_ID,
      query_text: 'best hookah bar Alpharetta',
    });

    expect(result).toEqual({ success: false, error: 'DB insert error' });
  });
});

describe('runSovEvaluation', () => {
  beforeEach(() => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(MOCK_AUTH as never);
    mockSupabaseForSov();
    vi.useFakeTimers(); // eliminates the 3-second mock delay
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.OPENAI_API_KEY;
    delete process.env.PERPLEXITY_API_KEY;
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('returns Unauthorized when getSafeAuthContext() returns null', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValueOnce(null);

    const result = await runSovEvaluation({ query_id: QUERY_ID, engine: 'openai' });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns Zod validation error for invalid engine value', async () => {
    const result = await runSovEvaluation({
      query_id: QUERY_ID,
      engine: 'google' as never, // invalid — must be 'openai' | 'perplexity'
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      // Zod v4 emits "Invalid option: expected one of "openai"|"perplexity""
      // Either way, the error must mention the valid engines.
      expect(result.error).toMatch(/openai/i);
    }
  });

  it('returns error when query not found in DB', async () => {
    mockSupabaseForSov({ queryRow: null });

    const result = await runSovEvaluation({ query_id: QUERY_ID, engine: 'openai' });

    expect(result).toEqual({ success: false, error: 'Query not found or access denied' });
  });

  it('calls the OpenAI fetch endpoint when engine=openai and API key is set', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-openai-key';
    const mockFetch = mockFetchSovResponse();
    vi.stubGlobal('fetch', mockFetch);
    mockSupabaseForSov();

    const resultPromise = runSovEvaluation({ query_id: QUERY_ID, engine: 'openai' });
    await vi.runAllTimersAsync();
    await resultPromise;

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('calls the Perplexity fetch endpoint when engine=perplexity and API key is set', async () => {
    process.env.PERPLEXITY_API_KEY = 'pplx-test-key';
    const mockFetch = mockFetchSovResponse();
    vi.stubGlobal('fetch', mockFetch);
    mockSupabaseForSov();

    const resultPromise = runSovEvaluation({ query_id: QUERY_ID, engine: 'perplexity' });
    await vi.runAllTimersAsync();
    await resultPromise;

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe('https://api.perplexity.ai/chat/completions');
  });

  it('uses mock fallback (no API call) when API key is absent', async () => {
    // Neither key is set — should return mock result after fake 3s delay
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    mockSupabaseForSov();

    const resultPromise = runSovEvaluation({ query_id: QUERY_ID, engine: 'openai' });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    // fetch should NOT have been called (fallback path)
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it('inserts into sov_evaluations with server-derived org_id', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-openai-key';
    vi.stubGlobal('fetch', mockFetchSovResponse(2, ['Competitor A']));

    const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createClient as any).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'target_queries') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: MOCK_QUERY_ROW, error: null }),
              }),
            }),
          };
        }
        if (table === 'sov_evaluations') {
          return { insert: mockInsert };
        }
        return {};
      }),
    });

    const resultPromise = runSovEvaluation({ query_id: QUERY_ID, engine: 'openai' });
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(mockInsert).toHaveBeenCalledOnce();
    const inserted = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.org_id).toBe(ORG_ID);
    expect(inserted.query_id).toBe(QUERY_ID);
    expect(inserted.engine).toBe('openai');
  });

  it('calls revalidatePath on success', async () => {
    mockSupabaseForSov();

    const resultPromise = runSovEvaluation({ query_id: QUERY_ID, engine: 'openai' });
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/dashboard/share-of-voice');
  });

  it('returns DB error on failed insert into sov_evaluations', async () => {
    mockSupabaseForSov({ insertError: { message: 'DB insert failed' } });

    const resultPromise = runSovEvaluation({ query_id: QUERY_ID, engine: 'openai' });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toEqual({ success: false, error: 'DB insert failed' });
  });
});

// ── deleteTargetQuery ────────────────────────────────────────────────────────

function makeDeleteFormData(queryId: string): FormData {
  const fd = new FormData();
  fd.set('query_id', queryId);
  return fd;
}

describe('deleteTargetQuery', () => {
  beforeEach(() => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(MOCK_AUTH as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns Unauthorized when not authenticated', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValueOnce(null);

    const result = await deleteTargetQuery(makeDeleteFormData(QUERY_ID));
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns error for invalid query_id (not a UUID)', async () => {
    const result = await deleteTargetQuery(makeDeleteFormData('not-a-uuid'));
    expect(result).toEqual({ success: false, error: 'Invalid query ID' });
  });

  it('deletes the target query successfully', async () => {
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createClient as any).mockResolvedValue({
      from: vi.fn(() => ({ delete: mockDelete })),
    });

    const result = await deleteTargetQuery(makeDeleteFormData(QUERY_ID));
    expect(result).toEqual({ success: true });
    expect(mockDelete).toHaveBeenCalledOnce();
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/dashboard/share-of-voice');
  });

  it('returns error on DB failure', async () => {
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: 'Cannot delete' } }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createClient as any).mockResolvedValue({
      from: vi.fn(() => ({ delete: mockDelete })),
    });

    const result = await deleteTargetQuery(makeDeleteFormData(QUERY_ID));
    expect(result).toEqual({ success: false, error: 'Cannot delete' });
  });
});
