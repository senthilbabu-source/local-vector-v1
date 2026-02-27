// ---------------------------------------------------------------------------
// lib/data/ai-health-score.ts — AI Health Score data fetcher
//
// Sprint 72: Fetches all data needed for AI Health Score computation from
// Supabase, then calls the pure scorer. Same pattern as lib/data/dashboard.ts
// (Sprint 64) and lib/data/schema-generator.ts (Sprint 70).
//
// Uses injected SupabaseClient (AI_RULES §38.3). All queries scoped by
// org_id (AI_RULES §3, §18 belt-and-suspenders).
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  computeHealthScore,
  type HealthScoreInput,
  type HealthScoreResult,
} from '@/lib/services/ai-health-score.service';
import type { PageAuditRecommendation } from '@/lib/page-audit/auditor';

/**
 * Fetches all data needed for AI Health Score computation, then calls the pure scorer.
 * Caller passes the Supabase client (RLS-scoped for user actions, service-role for cron).
 */
export async function fetchHealthScore(
  supabase: SupabaseClient<Database>,
  orgId: string,
  locationId: string,
): Promise<HealthScoreResult> {
  // All 4 queries in parallel (AI_RULES §39 — I/O in data layer, not service)
  const [sovResult, pageAuditResult, openHallucinationResult, totalAuditResult] =
    await Promise.all([
      // 1. Latest SOV score
      supabase
        .from('visibility_analytics')
        .select('share_of_voice')
        .eq('org_id', orgId)
        .eq('location_id', locationId)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // 2. Latest page audit
      supabase
        .from('page_audits')
        .select(
          'overall_score, answer_first_score, schema_completeness_score, faq_schema_score, entity_clarity_score, aeo_readability_score, faq_schema_present, recommendations',
        )
        .eq('org_id', orgId)
        .eq('location_id', locationId)
        .order('last_audited_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // 3. Open hallucination count
      supabase
        .from('ai_hallucinations')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('correction_status', 'open'),

      // 4. Total audit count
      supabase
        .from('ai_audits')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId),
    ]);

  // Assemble HealthScoreInput with null propagation (AI_RULES §20)
  const sovScore = sovResult.data?.share_of_voice ?? null;

  const pageAuditRow = pageAuditResult.data;
  const pageAudit: HealthScoreInput['pageAudit'] = pageAuditRow
    ? {
        overall_score: pageAuditRow.overall_score,
        answer_first_score: pageAuditRow.answer_first_score,
        schema_completeness_score: pageAuditRow.schema_completeness_score,
        faq_schema_score: pageAuditRow.faq_schema_score,
        entity_clarity_score: pageAuditRow.entity_clarity_score,
        aeo_readability_score: pageAuditRow.aeo_readability_score,
        faq_schema_present: pageAuditRow.faq_schema_present,
        // JSONB cast per AI_RULES §38.4
        recommendations: pageAuditRow.recommendations as PageAuditRecommendation[] | null,
      }
    : null;

  const openHallucinationCount = openHallucinationResult.count ?? 0;
  const totalAuditCount = totalAuditResult.count ?? 0;

  // Derive schema presence from page audit data
  const hasFaqSchema = pageAudit?.faq_schema_present === true;
  const hasLocalBusinessSchema =
    pageAudit !== null &&
    pageAudit.schema_completeness_score !== null &&
    pageAudit.schema_completeness_score > 0;

  const input: HealthScoreInput = {
    sovScore,
    pageAudit,
    openHallucinationCount,
    totalAuditCount,
    hasFaqSchema,
    hasLocalBusinessSchema,
  };

  return computeHealthScore(input);
}
