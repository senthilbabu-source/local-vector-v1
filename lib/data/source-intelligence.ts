// ---------------------------------------------------------------------------
// lib/data/source-intelligence.ts — Source Intelligence Data Fetcher
//
// Sprint 82: Fetches SOV evaluation data and runs pure source analysis.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  analyzeSourceIntelligence,
  type SourceIntelligenceInput,
  type SourceIntelligenceResult,
} from '@/lib/services/source-intelligence.service';
import type { SourceMentionExtraction } from '@/lib/ai/schemas';

/**
 * Fetch source intelligence data for the dashboard.
 */
export async function fetchSourceIntelligence(
  supabase: SupabaseClient<Database>,
  orgId: string,
  locationId: string,
  options?: { dayRange?: number },
): Promise<SourceIntelligenceResult> {
  const dayRange = options?.dayRange ?? 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - dayRange);

  // Fetch evaluations with their sources and query text
  const [evalsResult, locationResult] = await Promise.all([
    supabase
      .from('sov_evaluations')
      .select(`
        engine,
        cited_sources,
        source_mentions,
        raw_response,
        target_queries!inner ( query_text )
      `)
      .eq('org_id', orgId)
      .eq('location_id', locationId)
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: false }),

    supabase
      .from('locations')
      .select('business_name, website_url')
      .eq('id', locationId)
      .eq('org_id', orgId)
      .single(),
  ]);

  const location = locationResult.data;
  const evaluations = evalsResult.data ?? [];

  const input: SourceIntelligenceInput = {
    businessName: location?.business_name ?? 'Unknown',
    websiteUrl: location?.website_url ?? null,
    evaluations: evaluations.map((e: any) => ({
      engine: e.engine,
      citedSources: e.cited_sources as Array<{ url: string; title: string }> | null,
      extractedMentions: e.source_mentions as SourceMentionExtraction | null,
      queryText: e.target_queries?.query_text ?? '',
    })),
  };

  return analyzeSourceIntelligence(input);
}
