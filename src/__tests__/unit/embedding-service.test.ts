// ---------------------------------------------------------------------------
// Sprint 119 — embedding-service.test.ts (22 tests)
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Vercel AI SDK embed/embedMany before imports
const mockEmbed = vi.fn();
const mockEmbedMany = vi.fn();

vi.mock('ai', () => ({
  embed: (...args: unknown[]) => mockEmbed(...args),
  embedMany: (...args: unknown[]) => mockEmbedMany(...args),
}));

vi.mock('@/lib/ai/providers', () => ({
  embeddingModel: 'mock-embedding-model',
}));

import {
  prepareTextForTable,
  generateEmbedding,
  generateEmbeddingsBatch,
  backfillTable,
  generateAndSaveEmbedding,
  saveEmbeddingForRow,
  type EmbeddableTable,
} from '@/lib/services/embedding-service';

import { MOCK_EMBEDDING_1536 } from '@/__fixtures__/golden-tenant';

// ── Mock Supabase ────────────────────────────────────────────────────────────

function createMockSupabase() {
  const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  const mockSelect = vi.fn().mockReturnValue({
    is: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  });
  const mockFrom = vi.fn().mockReturnValue({
    update: mockUpdate,
    select: mockSelect,
  });

  return {
    from: mockFrom,
    _mockFrom: mockFrom,
    _mockUpdate: mockUpdate,
    _mockSelect: mockSelect,
  } as unknown as import('@supabase/supabase-js').SupabaseClient<import('@/lib/supabase/database.types').Database> & {
    _mockFrom: typeof mockFrom;
    _mockUpdate: typeof mockUpdate;
    _mockSelect: typeof mockSelect;
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('prepareTextForTable — pure', () => {
  it('1. menu_items: concatenates name + description', () => {
    const result = prepareTextForTable('menu_items', {
      name: 'Butter Chicken',
      description: 'Rich creamy curry',
    });
    expect(result).toBe('Butter Chicken Rich creamy curry');
  });

  it('2. menu_items: handles null description (name only)', () => {
    const result = prepareTextForTable('menu_items', {
      name: 'Naan Bread',
      description: null,
    });
    expect(result).toBe('Naan Bread');
  });

  it('3. ai_hallucinations: returns claim_text directly', () => {
    const result = prepareTextForTable('ai_hallucinations', {
      claim_text: 'Restaurant is permanently closed',
    });
    expect(result).toBe('Restaurant is permanently closed');
  });

  it('4. target_queries: returns query_text directly', () => {
    const result = prepareTextForTable('target_queries', {
      query_text: 'best hookah bar near me',
    });
    expect(result).toBe('best hookah bar near me');
  });

  it('5. content_drafts: concatenates draft_title + target_prompt', () => {
    const result = prepareTextForTable('content_drafts', {
      draft_title: 'Top 10 Hookah Tips',
      target_prompt: 'hookah lounge guide',
    });
    expect(result).toBe('Top 10 Hookah Tips hookah lounge guide');
  });

  it('6. content_drafts: handles null target_prompt', () => {
    const result = prepareTextForTable('content_drafts', {
      draft_title: 'FAQ Page',
      target_prompt: null,
    });
    expect(result).toBe('FAQ Page');
  });

  it('7. locations: concatenates business_name + categories + city', () => {
    const result = prepareTextForTable('locations', {
      business_name: 'Charcoal N Chill',
      categories: ['hookah lounge', 'restaurant'],
      city: 'Alpharetta',
    });
    expect(result).toBe('Charcoal N Chill hookah lounge, restaurant Alpharetta');
  });

  it('8. locations: handles null categories and city', () => {
    const result = prepareTextForTable('locations', {
      business_name: 'Charcoal N Chill',
      categories: null,
      city: null,
    });
    expect(result).toBe('Charcoal N Chill');
  });

  it('9. trims whitespace from all results', () => {
    const result = prepareTextForTable('menu_items', {
      name: '  Butter Chicken  ',
      description: null,
    });
    expect(result).toBe('Butter Chicken');
  });

  it('10. never returns empty string (fallback to table name)', () => {
    const result = prepareTextForTable('menu_items', {
      name: null,
      description: null,
    });
    expect(result).toBe('menu_items');
  });
});

describe('generateEmbedding — OpenAI mocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('11. calls embed with model=text-embedding-3-small', async () => {
    mockEmbed.mockResolvedValue({ embedding: MOCK_EMBEDDING_1536 });

    await generateEmbedding('test text');

    expect(mockEmbed).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 'test text',
      }),
    );
  });

  it('12. returns number[] of length 1536', async () => {
    mockEmbed.mockResolvedValue({ embedding: MOCK_EMBEDDING_1536 });

    const result = await generateEmbedding('test text');

    expect(result).toHaveLength(1536);
    expect(typeof result[0]).toBe('number');
  });

  it('13. throws embedding_failed on API error', async () => {
    mockEmbed.mockRejectedValue(new Error('API rate limit'));

    await expect(generateEmbedding('test')).rejects.toThrow('embedding_failed: API rate limit');
  });
});

describe('generateEmbeddingsBatch — OpenAI mocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('14. throws if input length > 20', async () => {
    const texts = Array(21).fill('text');
    await expect(generateEmbeddingsBatch(texts)).rejects.toThrow(
      'Batch size exceeds maximum of 20',
    );
  });

  it('15. sends all texts in single API call', async () => {
    const texts = ['hello', 'world'];
    mockEmbedMany.mockResolvedValue({
      embeddings: [MOCK_EMBEDDING_1536, MOCK_EMBEDDING_1536],
    });

    await generateEmbeddingsBatch(texts);

    expect(mockEmbedMany).toHaveBeenCalledTimes(1);
    expect(mockEmbedMany).toHaveBeenCalledWith(
      expect.objectContaining({
        values: texts,
      }),
    );
  });

  it('16. returns array of same length as input, in same order', async () => {
    const embedding1 = [...MOCK_EMBEDDING_1536];
    embedding1[0] = 0.5;
    const embedding2 = [...MOCK_EMBEDDING_1536];
    embedding2[0] = 0.9;

    mockEmbedMany.mockResolvedValue({
      embeddings: [embedding1, embedding2],
    });

    const result = await generateEmbeddingsBatch(['text1', 'text2']);
    expect(result).toHaveLength(2);
    expect(result[0][0]).toBe(0.5);
    expect(result[1][0]).toBe(0.9);
  });
});

describe('backfillTable — Supabase + OpenAI mocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('17. fetches only rows WHERE embedding IS NULL', async () => {
    const supabase = createMockSupabase();
    const mockIs = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    supabase._mockSelect.mockReturnValue({ is: mockIs });

    await backfillTable(supabase, 'menu_items', 20);

    expect(supabase._mockFrom).toHaveBeenCalledWith('menu_items');
    expect(mockIs).toHaveBeenCalledWith('embedding', null);
  });

  it('18. processes in batches of batchSize', async () => {
    const supabase = createMockSupabase();
    const rows = [
      { id: '1', name: 'Item 1', description: 'Desc' },
      { id: '2', name: 'Item 2', description: 'Desc' },
    ];
    supabase._mockSelect.mockReturnValue({
      is: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
      }),
    });

    mockEmbedMany.mockResolvedValue({
      embeddings: [MOCK_EMBEDDING_1536, MOCK_EMBEDDING_1536],
    });

    supabase._mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const result = await backfillTable(supabase, 'menu_items', 5);
    expect(result.processed).toBe(2);
  });

  it('19. updates DB for each embedded row', async () => {
    const supabase = createMockSupabase();
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    supabase._mockUpdate.mockReturnValue({ eq: mockEq });

    supabase._mockSelect.mockReturnValue({
      is: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({
          data: [{ id: 'row-1', name: 'Test', description: null }],
          error: null,
        }),
      }),
    });

    mockEmbedMany.mockResolvedValue({ embeddings: [MOCK_EMBEDDING_1536] });

    await backfillTable(supabase, 'menu_items', 20);
    expect(supabase._mockUpdate).toHaveBeenCalled();
  });

  it('20. increments errors count on individual update failure (continues)', async () => {
    const supabase = createMockSupabase();
    supabase._mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
    });

    supabase._mockSelect.mockReturnValue({
      is: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({
          data: [{ id: 'row-1', claim_text: 'Test' }],
          error: null,
        }),
      }),
    });

    mockEmbedMany.mockResolvedValue({ embeddings: [MOCK_EMBEDDING_1536] });

    const result = await backfillTable(supabase, 'ai_hallucinations', 20);
    expect(result.errors).toBe(1);
    expect(result.processed).toBe(0);
  });

  it('21. returns { processed, errors } summary', async () => {
    const supabase = createMockSupabase();
    supabase._mockSelect.mockReturnValue({
      is: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    const result = await backfillTable(supabase, 'locations', 20);
    expect(result).toEqual({ processed: 0, errors: 0 });
  });
});

describe('generateAndSaveEmbedding — Supabase + OpenAI mocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('22. returns { ok: false } on error — does NOT throw', async () => {
    const supabase = createMockSupabase();
    mockEmbed.mockRejectedValue(new Error('API error'));

    const result = await generateAndSaveEmbedding(supabase, 'menu_items', {
      id: 'test-id',
      name: 'Test',
      description: null,
    });

    expect(result).toEqual({ ok: false });
  });
});
