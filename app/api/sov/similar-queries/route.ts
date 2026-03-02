// ---------------------------------------------------------------------------
// POST /api/sov/similar-queries — Authenticated similar queries (Sprint 119)
//
// Given a query text and location, returns semantically similar target_queries.
// Used by SimilarQueriesWidget on the SOV dashboard.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { generateEmbedding } from '@/lib/services/embedding-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // ── Auth guard ────────────────────────────────────────────────────────────
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { query_text?: string; location_id?: string };
  try {
    body = await request.json();
  } catch (_err) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { query_text, location_id } = body;

  if (!query_text || !location_id) {
    return NextResponse.json(
      { error: 'missing_fields' },
      { status: 400 },
    );
  }

  // ── Generate embedding ────────────────────────────────────────────────────
  let embedding: number[];
  try {
    embedding = await generateEmbedding(query_text);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json(
      { error: 'embedding_unavailable' },
      { status: 500 },
    );
  }

  // ── Call match_target_queries RPC ──────────────────────────────────────────
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('match_target_queries', {
    query_embedding: JSON.stringify(embedding),
    filter_location_id: location_id,
    match_count: 5,
    similarity_threshold: 0.80,
  });

  if (error) {
    console.error('[similar-queries] RPC error:', error.message);
    return NextResponse.json(
      { error: 'search_unavailable' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    results: (data ?? []).map(
      (r: { id: string; query_text: string; similarity: number }) => ({
        id: r.id,
        query_text: r.query_text,
        similarity: r.similarity,
      }),
    ),
  });
}
