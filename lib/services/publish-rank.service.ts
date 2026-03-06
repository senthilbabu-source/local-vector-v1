// ---------------------------------------------------------------------------
// lib/services/publish-rank.service.ts — S17: Content → SOV Feedback Loop
//
// Wave 2, AI_RULES §217.
//
// Pure + I/O functions to capture and update citation rank data when content
// drafts are published and re-scanned.
//
// Flow:
//   1. capturePrePublishRank() — called at publish time (fire-and-forget safe)
//      Looks up the most recent sov_evaluations.rank_position for the
//      target_query linked via content_drafts.trigger_id.
//      Writes pre_publish_rank to content_drafts.
//
//   2. backfillPostPublishRanks() — called from SOV cron after evaluations run
//      For published drafts with pre_publish_rank set and post_publish_rank null,
//      published > 7 days ago, finds the latest sov_evaluations entry created
//      AFTER published_at and writes it as post_publish_rank.
//
// Both functions are fail-open: callers should wrap in try/catch or void.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Derives a citation percentage (0–100) from a rank_position value.
 * rank_position in sov_evaluations is stored as fraction (0.0–1.0).
 */
export function rankToPercent(rank: number | null): number | null {
  if (rank === null || rank === undefined) return null;
  return Math.round(rank * 100);
}

/**
 * Pure function: builds a human-readable label for post-impact display.
 * Returns null when either rank is null.
 */
export function buildImpactLabel(
  prePct: number | null,
  postPct: number | null,
): { label: string; improved: boolean } | null {
  if (prePct === null || postPct === null) return null;
  const delta = postPct - prePct;
  if (delta > 0) {
    return { label: `Citation rate improved from ${prePct}% → ${postPct}% (+${delta}pts)`, improved: true };
  }
  if (delta < 0) {
    return { label: `Citation rate moved from ${prePct}% → ${postPct}% (${delta}pts)`, improved: false };
  }
  return { label: `Citation rate unchanged at ${prePct}%`, improved: false };
}

// ---------------------------------------------------------------------------
// capturePrePublishRank
// ---------------------------------------------------------------------------

/**
 * Snapshot the current citation rank for the draft's linked target_query.
 * Called fire-and-forget when a draft transitions to 'published'.
 *
 * @param supabase — service-role or RLS client (org-scoped)
 * @param draftId  — content_drafts.id
 * @param orgId    — for RLS-scoped queries
 */
export async function capturePrePublishRank(
  supabase: SupabaseClient<Database>,
  draftId: string,
  orgId: string,
): Promise<void> {
  // Fetch the draft to get trigger_id and location_id
  const { data: draft, error: draftErr } = await supabase
    .from('content_drafts')
    .select('id, trigger_id, location_id, trigger_type')
    .eq('id', draftId)
    .eq('org_id', orgId)
    .maybeSingle();

  if (draftErr || !draft || draft.trigger_type !== 'prompt_missing' || !draft.trigger_id) {
    // Only SOV-linked drafts (trigger_type=prompt_missing) have a query to track
    return;
  }

  // Find the most recent sov_evaluations rank_position for this query
  let rankQuery = supabase
    .from('sov_evaluations')
    .select('rank_position' as 'id')
    .eq('org_id', orgId)
    .eq('query_id' as 'id', draft.trigger_id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (draft.location_id) {
    rankQuery = rankQuery.eq('location_id', draft.location_id);
  }

  const { data: rankRows } = await rankQuery;
  const rankRow = (rankRows as unknown as { rank_position: number | null }[] | null)?.[0];
  const rankValue = rankRow?.rank_position ?? null;

  // Update draft with pre_publish_rank
  await supabase
    .from('content_drafts')
    .update({
      pre_publish_rank: rankValue as unknown as never,
    } as never)
    .eq('id', draftId)
    .eq('org_id', orgId);
}

// ---------------------------------------------------------------------------
// backfillPostPublishRanks
// ---------------------------------------------------------------------------

/**
 * Called from the SOV cron after evaluations run.
 * Finds drafts that have been published with a pre_publish_rank but no
 * post_publish_rank yet, and fills in the first post-publish scan result.
 *
 * Uses service-role client (cron context).
 */
export async function backfillPostPublishRanks(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<number> {
  // Find eligible drafts: published + pre_publish_rank set + no post yet
  const minDaysAgo = new Date();
  minDaysAgo.setDate(minDaysAgo.getDate() - 7);

  const { data: drafts, error } = await supabase
    .from('content_drafts')
    .select('id, trigger_id, location_id, published_at, pre_publish_rank' as 'id, trigger_id, location_id, published_at')
    .eq('org_id', orgId)
    .eq('status', 'published')
    .eq('trigger_type', 'prompt_missing')
    .not('published_at', 'is', null)
    .lte('published_at', minDaysAgo.toISOString())
    .is('post_publish_rank' as unknown as never, null)
    .not('pre_publish_rank' as unknown as never, 'is', null)
    .limit(50);

  if (error || !drafts) return 0;

  let updated = 0;
  for (const draft of drafts as unknown as Array<{
    id: string;
    trigger_id: string | null;
    location_id: string | null;
    published_at: string | null;
    pre_publish_rank: number | null;
  }>) {
    if (!draft.trigger_id || !draft.published_at) continue;

    try {
      let rankQuery = supabase
        .from('sov_evaluations')
        .select('rank_position' as 'id')
        .eq('org_id', orgId)
        .eq('query_id' as 'id', draft.trigger_id)
        .gte('created_at', draft.published_at)
        .order('created_at', { ascending: false })
        .limit(1);

      if (draft.location_id) {
        rankQuery = rankQuery.eq('location_id', draft.location_id);
      }

      const { data: rankRows } = await rankQuery;
      const rankRow = (rankRows as unknown as { rank_position: number | null }[] | null)?.[0];
      if (rankRow === undefined) continue; // no post-publish eval yet

      const postRank = rankRow?.rank_position ?? 0;

      await supabase
        .from('content_drafts')
        .update({ post_publish_rank: postRank as unknown as never } as never)
        .eq('id', draft.id)
        .eq('org_id', orgId);

      updated++;
    } catch (err) {
      Sentry.captureException(err, { tags: { file: 'publish-rank.service.ts', sprint: 'S17' } });
    }
  }

  return updated;
}
