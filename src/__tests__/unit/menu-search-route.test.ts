// ---------------------------------------------------------------------------
// Sprint 119 — menu-search-route.test.ts (10 tests)
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { MOCK_EMBEDDING_1536, MOCK_MENU_SEARCH_RESULTS } from '@/__fixtures__/golden-tenant';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockGenerateEmbedding = vi.fn();
vi.mock('@/lib/services/embedding-service', () => ({
  generateEmbedding: (...args: unknown[]) => mockGenerateEmbedding(...args),
}));

const mockSingle = vi.fn();
const mockRpc = vi.fn();
const mockSupabase = {
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockSingle,
        }),
      }),
    }),
  }),
  rpc: mockRpc,
};

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => mockSupabase,
}));

import { GET } from '@/app/api/public/menu/search/route';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost/api/public/menu/search');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/public/menu/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateEmbedding.mockResolvedValue(MOCK_EMBEDDING_1536);
    mockSingle.mockResolvedValue({ data: { id: 'menu-uuid' }, error: null });
    mockRpc.mockResolvedValue({ data: MOCK_MENU_SEARCH_RESULTS, error: null });
  });

  it('1. 400 when q is missing', async () => {
    const res = await GET(makeRequest({ slug: 'test-menu' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('missing_query');
  });

  it('2. 400 when slug is missing', async () => {
    const res = await GET(makeRequest({ q: 'chicken' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('missing_slug');
  });

  it('3. 400 when q.length > 200', async () => {
    const res = await GET(makeRequest({ slug: 'test', q: 'a'.repeat(201) }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('query_too_long');
  });

  it('4. 404 when menu not found (no matching slug or not published)', async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });

    const res = await GET(makeRequest({ slug: 'nonexistent', q: 'chicken' }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('menu_not_found');
  });

  it('5. calls match_menu_items RPC with filter_menu_id and similarity_threshold=0.65', async () => {
    await GET(makeRequest({ slug: 'test-menu', q: 'spicy wings' }));

    expect(mockRpc).toHaveBeenCalledWith(
      'match_menu_items',
      expect.objectContaining({
        filter_menu_id: 'menu-uuid',
        similarity_threshold: 0.65,
      }),
    );
  });

  it('6. returns { results, query, count } on success', async () => {
    const res = await GET(makeRequest({ slug: 'test-menu', q: 'spicy wings' }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.query).toBe('spicy wings');
    expect(body.count).toBe(MOCK_MENU_SEARCH_RESULTS.length);
    expect(body.results).toHaveLength(MOCK_MENU_SEARCH_RESULTS.length);
    expect(body.results[0].name).toBe('Spicy Hookah Chicken Wings');
  });

  it('7. returns 500 with error=search_unavailable when embedding fails', async () => {
    mockGenerateEmbedding.mockRejectedValue(new Error('OpenAI error'));

    const res = await GET(makeRequest({ slug: 'test-menu', q: 'spicy wings' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('search_unavailable');
  });

  it('8. limit param respected (default 5, max 10)', async () => {
    await GET(makeRequest({ slug: 'test-menu', q: 'test', limit: '3' }));

    expect(mockRpc).toHaveBeenCalledWith(
      'match_menu_items',
      expect.objectContaining({
        match_count: 3,
      }),
    );
  });

  it('9. limit capped at 10 even if param is higher', async () => {
    await GET(makeRequest({ slug: 'test-menu', q: 'test', limit: '50' }));

    expect(mockRpc).toHaveBeenCalledWith(
      'match_menu_items',
      expect.objectContaining({
        match_count: 10,
      }),
    );
  });

  it('10. Cache-Control header is set on response', async () => {
    const res = await GET(makeRequest({ slug: 'test-menu', q: 'test' }));
    expect(res.headers.get('Cache-Control')).toBe(
      'public, max-age=60, stale-while-revalidate=300',
    );
  });
});
