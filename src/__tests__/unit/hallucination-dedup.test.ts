// ---------------------------------------------------------------------------
// Sprint 119 — hallucination-dedup.test.ts (8 tests)
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock embedding service
const mockGenerateEmbedding = vi.fn();
vi.mock('@/lib/services/embedding-service', () => ({
  generateEmbedding: (...args: unknown[]) => mockGenerateEmbedding(...args),
}));

import { isDuplicateHallucination } from '@/lib/services/hallucination-dedup';
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

describe('isDuplicateHallucination — Supabase + OpenAI mocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateEmbedding.mockResolvedValue(MOCK_EMBEDDING_1536);
  });

  it('1. returns { isDuplicate: true, existingId, similarity } when match found', async () => {
    const supabase = createMockSupabase({
      data: [{ id: 'existing-id', claim_text: 'test', correction_status: 'open', similarity: 0.95 }],
      error: null,
    });

    const result = await isDuplicateHallucination(
      supabase,
      'org-123',
      'Restaurant is permanently closed',
    );

    expect(result).toEqual({
      isDuplicate: true,
      existingId: 'existing-id',
      similarity: 0.95,
    });
  });

  it('2. returns { isDuplicate: false } when no match (empty RPC result)', async () => {
    const supabase = createMockSupabase({ data: [], error: null });

    const result = await isDuplicateHallucination(
      supabase,
      'org-123',
      'A unique claim',
    );

    expect(result).toEqual({ isDuplicate: false });
  });

  it('3. calls match_hallucinations RPC with threshold=0.92', async () => {
    const supabase = createMockSupabase({ data: [], error: null });

    await isDuplicateHallucination(supabase, 'org-123', 'test');

    expect(supabase._mockRpc).toHaveBeenCalledWith(
      'match_hallucinations',
      expect.objectContaining({
        similarity_threshold: 0.92,
      }),
    );
  });

  it('4. returns { isDuplicate: false } when generateEmbedding throws (fail open)', async () => {
    mockGenerateEmbedding.mockRejectedValue(new Error('API error'));
    const supabase = createMockSupabase();

    const result = await isDuplicateHallucination(
      supabase,
      'org-123',
      'test claim',
    );

    expect(result).toEqual({ isDuplicate: false });
  });

  it('5. returns { isDuplicate: false } when RPC throws (fail open)', async () => {
    const supabase = createMockSupabase({ data: null, error: { message: 'RPC error' } });

    const result = await isDuplicateHallucination(
      supabase,
      'org-123',
      'test claim',
    );

    expect(result).toEqual({ isDuplicate: false });
  });

  it('6. passes orgId to filter_org_id parameter', async () => {
    const supabase = createMockSupabase({ data: [], error: null });

    await isDuplicateHallucination(supabase, 'my-org-id', 'test');

    expect(supabase._mockRpc).toHaveBeenCalledWith(
      'match_hallucinations',
      expect.objectContaining({
        filter_org_id: 'my-org-id',
      }),
    );
  });

  it('7. passes match_count=1 (only need to know if any duplicate exists)', async () => {
    const supabase = createMockSupabase({ data: [], error: null });

    await isDuplicateHallucination(supabase, 'org-123', 'test');

    expect(supabase._mockRpc).toHaveBeenCalledWith(
      'match_hallucinations',
      expect.objectContaining({
        match_count: 1,
      }),
    );
  });

  it('8. does not throw under any error condition', async () => {
    mockGenerateEmbedding.mockRejectedValue(new Error('Fatal'));
    const supabase = createMockSupabase();

    // Should resolve, not reject
    const result = await isDuplicateHallucination(
      supabase,
      'org-123',
      'test',
    );

    expect(result).toBeDefined();
    expect(result.isDuplicate).toBe(false);
  });
});
