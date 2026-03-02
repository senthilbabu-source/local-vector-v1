// ---------------------------------------------------------------------------
// GET /api/public/menu/search — Public semantic menu search (Sprint 119)
//
// PUBLIC endpoint. No authentication required.
// Searches menu items using pgvector cosine similarity.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { generateEmbedding } from '@/lib/services/embedding-service';

export const dynamic = 'force-dynamic';

export type MenuSearchResult = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  category: string | null;
  similarity: number;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  const q = searchParams.get('q');
  const limitParam = parseInt(searchParams.get('limit') ?? '5', 10);

  // ── Validation ──────────────────────────────────────────────────────────
  if (!slug) {
    return NextResponse.json(
      { error: 'missing_slug' },
      { status: 400 },
    );
  }
  if (!q) {
    return NextResponse.json(
      { error: 'missing_query' },
      { status: 400 },
    );
  }
  if (q.length > 200) {
    return NextResponse.json(
      { error: 'query_too_long' },
      { status: 400 },
    );
  }

  const limit = Math.min(Math.max(1, isNaN(limitParam) ? 5 : limitParam), 10);

  const supabase = createServiceRoleClient();

  // ── Lookup menu by public_slug ────────────────────────────────────────────
  const { data: menu } = await supabase
    .from('magic_menus')
    .select('id')
    .eq('public_slug', slug)
    .eq('is_published', true)
    .single();

  if (!menu) {
    return NextResponse.json(
      { error: 'menu_not_found' },
      { status: 404 },
    );
  }

  // ── Generate embedding for search query ───────────────────────────────────
  let embedding: number[];
  try {
    embedding = await generateEmbedding(q);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json(
      { error: 'search_unavailable' },
      { status: 500 },
    );
  }

  // ── Call match_menu_items RPC ──────────────────────────────────────────────
  const { data: results, error: rpcError } = await supabase.rpc('match_menu_items', {
    query_embedding: JSON.stringify(embedding),
    filter_menu_id: menu.id,
    match_count: limit,
    similarity_threshold: 0.65,
  });

  if (rpcError) {
    console.error('[menu-search] RPC error:', rpcError.message);
    return NextResponse.json(
      { error: 'search_unavailable' },
      { status: 500 },
    );
  }

  const searchResults: MenuSearchResult[] = (results ?? []).map(
    (r: { id: string; name: string; description: string | null; price: number | null; category: string | null; similarity: number }) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      price: r.price,
      category: r.category,
      similarity: r.similarity,
    }),
  );

  return NextResponse.json(
    { results: searchResults, query: q, count: searchResults.length },
    {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    },
  );
}
