// ---------------------------------------------------------------------------
// lib/autopilot/triggers/prompt-missing-trigger.ts
//
// Detects zero-citation query clusters that should generate content drafts.
// Groups target_queries by query_category where no SOV evaluation has
// produced a citation for 2+ consecutive scan cycles.
//
// Sprint 86 — Autopilot Engine
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { DraftTrigger, DraftContext } from '@/lib/types/autopilot';

/** Minimum queries with zero citations to form a cluster. */
const MIN_CLUSTER_SIZE = 2;

/** Maximum queries per cluster to include in context. */
const MAX_QUERIES_PER_CLUSTER = 5;

/**
 * Detects zero-citation query clusters that should generate content drafts.
 *
 * A zero-citation cluster = MIN_CLUSTER_SIZE+ tracked queries in the same
 * query_category that ALL have rank_position IS NULL across recent SOV evals.
 *
 * Returns one DraftTrigger per zero-citation category cluster.
 */
export async function detectPromptMissingTriggers(
  supabase: SupabaseClient<Database>,
  locationId: string,
  orgId: string,
): Promise<DraftTrigger[]> {
  // Fetch active target queries for this location
  const { data: queries, error: qErr } = await supabase
    .from('target_queries')
    .select('id, query_text, query_category')
    .eq('org_id', orgId)
    .eq('location_id', locationId)
    .eq('is_active', true);

  if (qErr || !queries || queries.length === 0) {
    return [];
  }

  // For each query, check if it has any SOV evaluation with a non-null rank_position
  const queryIds = queries.map((q) => q.id);

  const { data: citedEvals, error: eErr } = await supabase
    .from('sov_evaluations')
    .select('query_id')
    .in('query_id', queryIds)
    .not('rank_position', 'is', null);

  if (eErr) return [];

  const citedQueryIds = new Set((citedEvals ?? []).map((e) => e.query_id));

  // Find zero-citation queries (never cited in any evaluation)
  const zeroCitationQueries = queries.filter((q) => !citedQueryIds.has(q.id));

  if (zeroCitationQueries.length < MIN_CLUSTER_SIZE) {
    return [];
  }

  // Group by query_category
  const clusters = new Map<string, typeof zeroCitationQueries>();
  for (const q of zeroCitationQueries) {
    const cat = q.query_category ?? 'uncategorized';
    const existing = clusters.get(cat) ?? [];
    existing.push(q);
    clusters.set(cat, existing);
  }

  const triggers: DraftTrigger[] = [];

  for (const [category, clusterQueries] of clusters) {
    if (clusterQueries.length < MIN_CLUSTER_SIZE) continue;

    const queryTexts = clusterQueries
      .slice(0, MAX_QUERIES_PER_CLUSTER)
      .map((q) => q.query_text);

    const context: DraftContext = {
      targetQuery: queryTexts[0],
      zeroCitationQueries: queryTexts,
      consecutiveZeroWeeks: 2, // Minimum assumption — 2 weeks of zero citations
    };

    triggers.push({
      triggerType: 'prompt_missing',
      triggerId: clusterQueries[0].id, // Use first query's ID as trigger reference
      orgId,
      locationId,
      context,
    });
  }

  return triggers;
}
