// ---------------------------------------------------------------------------
// lib/services/hallucination-dedup.ts — Semantic dedup for hallucinations (Sprint 119)
//
// Before inserting a new hallucination claim, check if a semantically similar
// one already exists (threshold 0.92 — very strict, near-identical only).
// Fails open: on any error, returns { isDuplicate: false }.
// ---------------------------------------------------------------------------

import { generateEmbedding } from './embedding-service';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ── Types ────────────────────────────────────────────────────────────────────

export type DedupResult =
  | { isDuplicate: true; existingId: string; similarity: number }
  | { isDuplicate: false };

// ── Constants ────────────────────────────────────────────────────────────────

const HALLUCINATION_SIMILARITY_THRESHOLD = 0.92;

// ── Main function ────────────────────────────────────────────────────────────

/**
 * Checks if a hallucination claim is semantically similar to an existing one.
 * Returns { isDuplicate: true, existingId, similarity } or { isDuplicate: false }.
 * Never throws — fails open on all errors.
 */
export async function isDuplicateHallucination(
  supabase: SupabaseClient<Database>,
  orgId: string,
  claimText: string,
): Promise<DedupResult> {
  try {
    const embedding = await generateEmbedding(claimText);

    const { data, error } = await supabase.rpc('match_hallucinations', {
      query_embedding: JSON.stringify(embedding),
      filter_org_id: orgId,
      match_count: 1,
      similarity_threshold: HALLUCINATION_SIMILARITY_THRESHOLD,
    });

    if (error || !data || data.length === 0) {
      return { isDuplicate: false };
    }

    return {
      isDuplicate: true,
      existingId: data[0].id,
      similarity: data[0].similarity,
    };
  } catch (err) {
    console.warn(
      '[hallucination-dedup] isDuplicateHallucination failed (fail open):',
      err instanceof Error ? err.message : err,
    );
    return { isDuplicate: false };
  }
}
