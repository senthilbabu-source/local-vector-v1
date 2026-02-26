// ---------------------------------------------------------------------------
// lib/services/prompt-intelligence.service.ts — Prompt Intelligence Engine
//
// Pure service (caller passes Supabase client). Detects 3 types of gaps in a
// tenant's SOV query library:
//   1. untracked       — reference queries missing from the library
//   2. competitor_discovered — competitors winning queries we don't track
//   3. zero_citation_cluster — 3+ queries all returning 0 citations
//
// Runs as a sub-step after the weekly SOV cron per-org, same pattern as the
// Occasion Engine. No AI calls — pure data comparison.
//
// Spec: docs/15-LOCAL-PROMPT-INTELLIGENCE.md §3
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  discoveryQueries,
  nearMeQueries,
  occasionQueries,
  comparisonQueries,
  isHospitalityCategory,
} from '@/lib/services/sov-seed';
import type {
  QueryGap,
  ReferenceQuery,
  QueryCategory,
  CategoryBreakdown,
} from '@/lib/types/prompt-intelligence';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max gaps per run to prevent alert fatigue (Doc 15 §3.1). */
const MAX_GAPS_PER_RUN = 10;

/** Min evaluations a query must have to be considered for zero-citation cluster. */
const MIN_EVAL_COUNT = 2;

/** Min queries in a zero-citation cluster to surface the gap. */
const MIN_CLUSTER_SIZE = 3;

// ---------------------------------------------------------------------------
// buildReferenceLibrary — Doc 15 §3.1
// ---------------------------------------------------------------------------

/**
 * Generate the full set of queries that SHOULD exist for a location based on
 * its category, city, state, and competitors. Reuses the template functions
 * from sov-seed.ts but does not insert anything.
 */
export async function buildReferenceLibrary(
  locationId: string,
  supabase: SupabaseClient<Database>,
): Promise<ReferenceQuery[]> {
  // Fetch location data
  const { data: location } = await supabase
    .from('locations')
    .select('business_name, city, state, categories, org_id')
    .eq('id', locationId)
    .single();

  if (!location) return [];

  const city = location.city ?? 'local area';
  const state = location.state ?? '';
  const categories: string[] = (location.categories as string[] | null) ?? ['restaurant'];
  const primaryCategory = categories[0] ?? 'restaurant';

  // Fetch competitors for this org
  const { data: competitors } = await supabase
    .from('competitors')
    .select('competitor_name')
    .eq('org_id', location.org_id);

  const comps: { competitor_name: string }[] = competitors ?? [];

  const refs: ReferenceQuery[] = [];

  // Tier 1 — Discovery (priority 1–4)
  const disco = discoveryQueries(primaryCategory, city, state);
  for (let i = 0; i < disco.length; i++) {
    refs.push({ queryText: disco[i], queryCategory: 'discovery', priority: i + 1 });
  }

  // Tier 2 — Near Me (priority 1–3)
  const nearMe = nearMeQueries(primaryCategory, city);
  for (let i = 0; i < nearMe.length; i++) {
    refs.push({ queryText: nearMe[i], queryCategory: 'near_me', priority: i + 1 });
  }

  // Tier 3 — Occasion (hospitality categories only, priority 1–5)
  if (isHospitalityCategory(categories)) {
    const occ = occasionQueries(city);
    for (let i = 0; i < occ.length; i++) {
      refs.push({ queryText: occ[i], queryCategory: 'occasion', priority: i + 1 });
    }
  }

  // Tier 4 — Comparison (priority 1 per competitor, max 3)
  if (comps.length > 0) {
    const comp = comparisonQueries(primaryCategory, city, location.business_name, comps);
    for (let i = 0; i < comp.length; i++) {
      refs.push({ queryText: comp[i], queryCategory: 'comparison', priority: 1 });
    }
  }

  return refs;
}

// ---------------------------------------------------------------------------
// detectQueryGaps — Doc 15 §3
// ---------------------------------------------------------------------------

/**
 * Run 3 gap detection algorithms and return up to MAX_GAPS_PER_RUN gaps.
 *
 * Gap Type 1: untracked — reference queries not in active library
 * Gap Type 2: competitor_discovered — competitors winning untracked queries
 * Gap Type 3: zero_citation_cluster — 3+ queries with 0 citations after 2+ runs
 */
export async function detectQueryGaps(
  orgId: string,
  locationId: string,
  supabase: SupabaseClient<Database>,
): Promise<QueryGap[]> {
  // Fetch data in parallel
  const [referenceQueries, activeQueryResult, interceptResult, evalResult] =
    await Promise.all([
      buildReferenceLibrary(locationId, supabase),
      supabase
        .from('target_queries')
        .select('id, query_text, query_category')
        .eq('location_id', locationId)
        .eq('org_id', orgId),
      supabase
        .from('competitor_intercepts')
        .select('query_asked, competitor_name, winner')
        .eq('org_id', orgId),
      supabase
        .from('sov_evaluations')
        .select('query_id, rank_position')
        .eq('org_id', orgId)
        .eq('location_id', locationId),
    ]);

  const activeQueries: { id: string; query_text: string; query_category: string }[] =
    activeQueryResult.data ?? [];
  const intercepts: { query_asked: string | null; competitor_name: string; winner: string | null }[] =
    interceptResult.data ?? [];
  const evaluations: { query_id: string; rank_position: number | null }[] =
    evalResult.data ?? [];

  const activeTexts = new Set(activeQueries.map((q) => q.query_text.trim().toLowerCase()));
  const gaps: QueryGap[] = [];

  // ── Gap Type 1: Untracked ───────────────────────────────────────────────
  for (const ref of referenceQueries) {
    if (!activeTexts.has(ref.queryText.trim().toLowerCase())) {
      gaps.push({
        gapType: 'untracked',
        queryText: ref.queryText,
        queryCategory: ref.queryCategory,
        estimatedImpact: ref.queryCategory === 'discovery' && ref.priority <= 2 ? 'high' : 'medium',
        suggestedAction: `Add "${ref.queryText}" to your tracking library.`,
      });
    }
  }

  // ── Gap Type 2: Competitor-discovered ───────────────────────────────────
  const seenCompetitorQueries = new Set<string>();
  for (const intercept of intercepts) {
    const queryLower = (intercept.query_asked ?? '').trim().toLowerCase();
    if (
      queryLower &&
      !activeTexts.has(queryLower) &&
      !seenCompetitorQueries.has(queryLower)
    ) {
      seenCompetitorQueries.add(queryLower);
      gaps.push({
        gapType: 'competitor_discovered',
        queryText: intercept.query_asked!,
        queryCategory: 'comparison',
        estimatedImpact: 'high',
        suggestedAction: `${intercept.competitor_name} is winning this query. Track it to measure your progress.`,
      });
    }
  }

  // ── Gap Type 3: Zero-citation cluster ───────────────────────────────────
  // Group evaluations by query_id → count runs and check if any had a citation
  const evalsByQuery = new Map<string, { runCount: number; everCited: boolean }>();
  for (const ev of evaluations) {
    const entry = evalsByQuery.get(ev.query_id) ?? { runCount: 0, everCited: false };
    entry.runCount++;
    if (ev.rank_position !== null) entry.everCited = true;
    evalsByQuery.set(ev.query_id, entry);
  }

  const zeroCitationQueries = activeQueries.filter((q) => {
    const stats = evalsByQuery.get(q.id);
    return stats && stats.runCount >= MIN_EVAL_COUNT && !stats.everCited;
  });

  if (zeroCitationQueries.length >= MIN_CLUSTER_SIZE) {
    const clusterTexts = zeroCitationQueries.slice(0, 5).map((q) => q.query_text);
    const primaryCategory = (zeroCitationQueries[0].query_category as QueryCategory) || 'discovery';
    gaps.push({
      gapType: 'zero_citation_cluster',
      queryText: clusterTexts.join(', '),
      queryCategory: primaryCategory,
      estimatedImpact: 'high',
      suggestedAction:
        'Multiple tracked queries are returning zero citations. This suggests a content gap, not a tracking gap — consider creating a page that directly answers these queries.',
    });
  }

  // Cap at MAX_GAPS_PER_RUN to prevent alert fatigue
  return gaps.slice(0, MAX_GAPS_PER_RUN);
}

// ---------------------------------------------------------------------------
// computeCategoryBreakdown — Doc 15 §5.3
// ---------------------------------------------------------------------------

/**
 * Pure function (no DB calls). Groups queries by category and counts how many
 * have a citation in their latest evaluation. Powers the category bar chart
 * on the SOV dashboard (Growth+ only).
 */
export function computeCategoryBreakdown(
  queries: { id: string; query_category: string }[],
  evaluations: { query_id: string; rank_position: number | null; created_at: string }[],
): Record<QueryCategory, CategoryBreakdown> {
  const categories: QueryCategory[] = ['discovery', 'comparison', 'occasion', 'near_me', 'custom'];

  // Find the latest evaluation per query
  const latestByQuery = new Map<string, { rank_position: number | null; created_at: string }>();
  for (const ev of evaluations) {
    const existing = latestByQuery.get(ev.query_id);
    if (!existing || ev.created_at > existing.created_at) {
      latestByQuery.set(ev.query_id, ev);
    }
  }

  const result = {} as Record<QueryCategory, CategoryBreakdown>;

  for (const cat of categories) {
    const catQueries = queries.filter((q) => q.query_category === cat);
    const cited = catQueries.filter((q) => {
      const latest = latestByQuery.get(q.id);
      return latest && latest.rank_position !== null;
    });

    result[cat] = {
      citedCount: cited.length,
      totalCount: catQueries.length,
      citationRate: catQueries.length > 0 ? (cited.length / catQueries.length) * 100 : 0,
    };
  }

  return result;
}
