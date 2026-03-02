// ---------------------------------------------------------------------------
// lib/services/draft-dedup.ts — Semantic dedup for content drafts (Sprint 119)
//
// Before generating a new content draft, check if a semantically similar one
// already exists (threshold 0.85 — catches near-duplicate topics).
// Fails open: on any error, returns empty array.
// ---------------------------------------------------------------------------

import { generateEmbedding } from './embedding-service';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ── Types ────────────────────────────────────────────────────────────────────

export type SimilarDraft = {
  id: string;
  draft_title: string;
  status: string;
  similarity: number;
};

// ── Constants ────────────────────────────────────────────────────────────────

const DRAFT_SIMILARITY_THRESHOLD = 0.85;

// ── Main functions ───────────────────────────────────────────────────────────

/**
 * Finds existing drafts similar to a proposed new draft topic.
 * Returns array of similar drafts (empty if none, or on error — fail open).
 */
export async function findSimilarDrafts(
  supabase: SupabaseClient<Database>,
  orgId: string,
  draftTitle: string,
  targetPrompt?: string | null,
): Promise<SimilarDraft[]> {
  try {
    const combinedText = `${draftTitle} ${targetPrompt ?? ''}`.trim();
    const embedding = await generateEmbedding(combinedText);

    const { data, error } = await supabase.rpc('match_content_drafts', {
      query_embedding: JSON.stringify(embedding),
      filter_org_id: orgId,
      match_count: 3,
      similarity_threshold: DRAFT_SIMILARITY_THRESHOLD,
    });

    if (error || !data) {
      return [];
    }

    return data.map((d: { id: string; draft_title: string; status: string; similarity: number }) => ({
      id: d.id,
      draft_title: d.draft_title,
      status: d.status,
      similarity: d.similarity,
    }));
  } catch (err) {
    console.warn(
      '[draft-dedup] findSimilarDrafts failed (fail open):',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

/**
 * Convenience wrapper. Returns true if any similar draft exists.
 */
export async function hasSimilarDraft(
  supabase: SupabaseClient<Database>,
  orgId: string,
  draftTitle: string,
  targetPrompt?: string | null,
): Promise<boolean> {
  const results = await findSimilarDrafts(supabase, orgId, draftTitle, targetPrompt);
  return results.length > 0;
}
