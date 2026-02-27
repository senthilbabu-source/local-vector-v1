// ---------------------------------------------------------------------------
// lib/data/cluster-map.ts — Cluster Map Data Fetcher
//
// Sprint 87: Fetches data from 4 existing tables and transforms via
// the pure cluster-map.service.ts. No new tables needed.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  buildClusterMap,
  type ClusterMapResult,
  type EngineFilter,
} from '@/lib/services/cluster-map.service';

/**
 * Fetch all data needed for the Cluster Map and transform it.
 *
 * Queries:
 * 1. locations — for business_name
 * 2. sov_evaluations (last 30 days) — for brand authority + competitor extraction
 * 3. ai_hallucinations (open only) — for hallucination fog overlay
 * 4. visibility_analytics (latest) — for self SOV score
 *
 * All queries are RLS-scoped via the passed-in Supabase client.
 */
export async function fetchClusterMapData(
  supabase: SupabaseClient<Database>,
  orgId: string,
  locationId: string,
  engineFilter: EngineFilter = 'all',
): Promise<ClusterMapResult> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [locationResult, evaluationsResult, hallucinationsResult, visAnalyticsResult] =
    await Promise.all([
      // 1. Fetch business name from location
      supabase
        .from('locations')
        .select('business_name')
        .eq('id', locationId)
        .single(),

      // 2. Fetch SOV evaluations (last 30 days)
      supabase
        .from('sov_evaluations')
        .select('engine, query_id, rank_position, mentioned_competitors')
        .eq('org_id', orgId)
        .eq('location_id', locationId)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false }),

      // 3. Fetch open hallucinations
      supabase
        .from('ai_hallucinations')
        .select('id, claim_text, severity, model_provider, category')
        .eq('org_id', orgId)
        .eq('correction_status', 'open'),

      // 4. Fetch latest visibility analytics for SOV
      supabase
        .from('visibility_analytics')
        .select('share_of_voice')
        .eq('org_id', orgId)
        .eq('location_id', locationId)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const businessName = locationResult.data?.business_name ?? 'My Business';
  const evaluations = evaluationsResult.data ?? [];
  const hallucinations = hallucinationsResult.data ?? [];
  const sovScore = visAnalyticsResult.data?.share_of_voice ?? null;

  // Compute truth score from hallucination ratio
  const totalEvals = evaluations.length;
  const openHallucinationCount = hallucinations.length;
  const truthScore =
    totalEvals > 0
      ? Math.max(
          0,
          Math.min(
            100,
            100 - (openHallucinationCount / Math.max(totalEvals, 1)) * 100,
          ),
        )
      : null;

  return buildClusterMap({
    businessName,
    evaluations: evaluations.map((e) => ({
      engine: e.engine,
      queryId: e.query_id,
      queryCategory: '',
      rankPosition: e.rank_position,
      mentionedCompetitors: (e.mentioned_competitors as string[]) ?? [],
    })),
    hallucinations: hallucinations.map((h) => ({
      id: h.id,
      claimText: h.claim_text,
      severity: h.severity as 'critical' | 'high' | 'medium' | 'low',
      modelProvider: h.model_provider,
      category: h.category,
    })),
    truthScore,
    sovScore,
    engineFilter,
  });
}
