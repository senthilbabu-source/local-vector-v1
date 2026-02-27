// ---------------------------------------------------------------------------
// lib/data/revenue-impact.ts — Revenue Impact data fetcher
//
// Sprint 85: Fetches revenue impact data from 5 parallel queries and
// computes the estimate via the pure service.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  computeRevenueImpact,
  DEFAULT_REVENUE_CONFIG,
  type RevenueImpactInput,
  type RevenueImpactResult,
} from '@/lib/services/revenue-impact.service';

/**
 * Fetch revenue impact data and compute the estimate.
 */
export async function fetchRevenueImpact(
  supabase: SupabaseClient<Database>,
  orgId: string,
  locationId: string,
): Promise<RevenueImpactResult> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    locationResult,
    targetQueriesResult,
    sovEvalsResult,
    hallucinationsResult,
    competitorEvalsResult,
  ] = await Promise.all([
    // Revenue config from location
    supabase
      .from('locations')
      .select('avg_customer_value, monthly_covers')
      .eq('id', locationId)
      .eq('org_id', orgId)
      .single(),

    // All target queries
    supabase
      .from('target_queries')
      .select('id, query_text, query_category')
      .eq('org_id', orgId)
      .eq('location_id', locationId),

    // Recent SOV evaluations for gap detection
    supabase
      .from('sov_evaluations')
      .select('query_id, engine, rank_position')
      .eq('org_id', orgId)
      .eq('location_id', locationId)
      .gte('created_at', thirtyDaysAgo.toISOString()),

    // Open hallucinations
    supabase
      .from('ai_hallucinations')
      .select('claim_text, severity')
      .eq('org_id', orgId)
      .eq('correction_status', 'open'),

    // Competitor SOV data — mentioned_competitors from recent evaluations
    supabase
      .from('sov_evaluations')
      .select('rank_position, mentioned_competitors')
      .eq('org_id', orgId)
      .eq('location_id', locationId)
      .gte('created_at', thirtyDaysAgo.toISOString()),
  ]);

  // ── Revenue config ──
  const loc = locationResult.data;
  const config = {
    avgCustomerValue:
      loc?.avg_customer_value ?? DEFAULT_REVENUE_CONFIG.avgCustomerValue,
    monthlyCovers:
      loc?.monthly_covers ?? DEFAULT_REVENUE_CONFIG.monthlyCovers,
  };

  // ── SOV gaps ──
  const queries = targetQueriesResult.data ?? [];
  const evals = sovEvalsResult.data ?? [];

  const evalsByQuery = new Map<string, typeof evals>();
  for (const e of evals) {
    const arr = evalsByQuery.get(e.query_id) ?? [];
    arr.push(e);
    evalsByQuery.set(e.query_id, arr);
  }

  const sovGaps = queries
    .map((q) => {
      const qEvals = evalsByQuery.get(q.id) ?? [];
      const engines = new Set(qEvals.map((e) => e.engine));
      const missingCount = qEvals.filter(
        (e) => e.rank_position === null,
      ).length;
      return {
        queryText: q.query_text,
        queryCategory: q.query_category,
        missingEngineCount: engines.size > 0 ? missingCount : 0,
        totalEngineCount: engines.size,
      };
    })
    .filter((g) => g.missingEngineCount > 0);

  // ── Hallucinations ──
  const openHallucinations = (hallucinationsResult.data ?? []).map((h) => ({
    claimText: h.claim_text,
    severity: h.severity ?? 'medium',
  }));

  // ── Competitor data ──
  const compEvals = competitorEvalsResult.data ?? [];

  // Calculate your SOV: % of evals where you're ranked
  const totalEvals = compEvals.length;
  const rankedEvals = compEvals.filter(
    (e) => e.rank_position !== null,
  ).length;
  const yourSov = totalEvals > 0 ? rankedEvals / totalEvals : null;

  // Find top competitor SOV from mentioned_competitors
  const competitorMentions = new Map<string, number>();
  for (const e of compEvals) {
    const competitors =
      (e.mentioned_competitors as Array<{ name?: string }>) ?? [];
    for (const c of competitors) {
      if (c.name) {
        competitorMentions.set(
          c.name,
          (competitorMentions.get(c.name) ?? 0) + 1,
        );
      }
    }
  }

  let topCompetitorName: string | null = null;
  let topCompetitorSov: number | null = null;
  for (const [name, count] of competitorMentions) {
    const sov = totalEvals > 0 ? count / totalEvals : 0;
    if (topCompetitorSov === null || sov > topCompetitorSov) {
      topCompetitorSov = sov;
      topCompetitorName = name;
    }
  }

  const input: RevenueImpactInput = {
    config,
    sovGaps,
    openHallucinations,
    competitorData: {
      yourSov,
      topCompetitorSov,
      topCompetitorName,
    },
  };

  return computeRevenueImpact(input);
}
