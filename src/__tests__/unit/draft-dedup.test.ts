// ---------------------------------------------------------------------------
// Sprint 119 — draft-dedup.test.ts (6 tests)
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock embedding service
const mockGenerateEmbedding = vi.fn();
vi.mock('@/lib/services/embedding-service', () => ({
  generateEmbedding: (...args: unknown[]) => mockGenerateEmbedding(...args),
}));

import { findSimilarDrafts, hasSimilarDraft } from '@/lib/services/draft-dedup';
import { MOCK_EMBEDDING_1536 } from '@/__fixtures__/golden-tenant';

// ── Mock Supabase ────────────────────────────────────────────────────────────

function createMockSupabase(rpcResult?: { data: unknown; error: unknown }) {
  const mockRpc = vi.fn().mockResolvedValue(
    rpcResult ?? { data: [], error: null },
  );
  return {
    rpc: mockRpc,
    _mockRpc: mockRpc,
  } as unknown as import('@supabase/supabase-js').SupabaseClient<import('@/lib/supabase/database.types').Database> & {
    _mockRpc: typeof mockRpc;
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('findSimilarDrafts — Supabase + OpenAI mocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateEmbedding.mockResolvedValue(MOCK_EMBEDDING_1536);
  });

  it('1. combines draft_title + target_prompt for embedding', async () => {
    const supabase = createMockSupabase({ data: [], error: null });

    await findSimilarDrafts(supabase, 'org-123', 'Title', 'Prompt');

    expect(mockGenerateEmbedding).toHaveBeenCalledWith('Title Prompt');
  });

  it('2. calls match_content_drafts with threshold=0.85', async () => {
    const supabase = createMockSupabase({ data: [], error: null });

    await findSimilarDrafts(supabase, 'org-123', 'Title');

    expect(supabase._mockRpc).toHaveBeenCalledWith(
      'match_content_drafts',
      expect.objectContaining({
        similarity_threshold: 0.85,
      }),
    );
  });

  it('3. returns array of similar drafts', async () => {
    const supabase = createMockSupabase({
      data: [
        { id: 'draft-1', draft_title: 'Existing Draft', status: 'draft', similarity: 0.92 },
      ],
      error: null,
    });

    const results = await findSimilarDrafts(supabase, 'org-123', 'Similar Title');

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: 'draft-1',
      draft_title: 'Existing Draft',
      status: 'draft',
      similarity: 0.92,
    });
  });

  it('4. returns [] on embedding error (fail open)', async () => {
    mockGenerateEmbedding.mockRejectedValue(new Error('API error'));
    const supabase = createMockSupabase();

    const results = await findSimilarDrafts(supabase, 'org-123', 'Title');
    expect(results).toEqual([]);
  });

  it('5. returns [] on RPC error', async () => {
    const supabase = createMockSupabase({ data: null, error: { message: 'RPC error' } });

    const results = await findSimilarDrafts(supabase, 'org-123', 'Title');
    expect(results).toEqual([]);
  });
});

describe('hasSimilarDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateEmbedding.mockResolvedValue(MOCK_EMBEDDING_1536);
  });

  it('6. returns true if findSimilarDrafts().length > 0', async () => {
    const supabase = createMockSupabase({
      data: [{ id: 'draft-1', draft_title: 'Test', status: 'draft', similarity: 0.90 }],
      error: null,
    });

    const result = await hasSimilarDraft(supabase, 'org-123', 'Similar');
    expect(result).toBe(true);
  });
});
