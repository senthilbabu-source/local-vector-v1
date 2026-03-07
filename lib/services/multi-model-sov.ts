// ---------------------------------------------------------------------------
// lib/services/multi-model-sov.ts — Multi-Model SOV Orchestrator (Sprint 123)
//
// Runs a single SOV query across all plan-enabled models, normalizes results,
// and writes per-model citation data to sov_model_results.
//
// ADDITIVE ONLY: Never modifies sov_evaluations. The existing SOV engine
// logic in sov-engine.service.ts remains unchanged.
//
// Sequential model calls only — respects rate limit delays per model.
// Never throws — returns partial results on error.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { generateText } from 'ai';
import { getModel, hasApiKey, webSearchTool } from '@/lib/ai/providers';
import {
  getEnabledModels,
  SOV_MODEL_CONFIGS,
  type SOVModelId,
} from '@/lib/config/sov-models';
import { detectCitation, type NormalizedCitationResult } from './sov-model-normalizer';
import { sleep } from './sov-engine.service';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MultiModelQueryParams {
  supabase: SupabaseClient<Database>;
  queryText: string;
  queryId: string | null;
  orgId: string;
  orgName: string;
  locationId: string | null;
  planTier: string;
  weekOf: Date;
}

export interface MultiModelQueryResult {
  models_run: SOVModelId[];
  results: Partial<Record<SOVModelId, NormalizedCitationResult>>;
  cited_by_any: boolean;
  cited_by_all: boolean;
  consensus_citation_count: number;
}

// ---------------------------------------------------------------------------
// SOV prompt — identical to sov-engine.service.ts buildSOVCronPrompt
// ---------------------------------------------------------------------------

function buildSOVPrompt(queryText: string): string {
  return `Answer this question a local person might ask: '${queryText}'

List ALL businesses you would recommend or mention in your answer.

Return ONLY a valid JSON object:
{
  "businesses": ["Business Name 1", "Business Name 2", "Business Name 3"],
  "cited_url": "https://yelp.com/... or null if no single authoritative source"
}

Include every business mentioned. Do not summarize. Be exhaustive.`;
}

// ---------------------------------------------------------------------------
// runMultiModelQuery
// ---------------------------------------------------------------------------

/**
 * Run a single SOV query across all models enabled for the plan tier.
 *
 * Models are called SEQUENTIALLY with call_delay_ms between each.
 * Each model's result is upserted into sov_model_results.
 * If a model call fails, it is recorded as { cited: false, confidence: 'low' }.
 * This function NEVER throws — partial results are always returned.
 */
export async function runMultiModelQuery(
  params: MultiModelQueryParams,
): Promise<MultiModelQueryResult> {
  const { supabase, queryText, queryId, orgId, orgName, locationId, planTier, weekOf } =
    params;

  const enabledModels = getEnabledModels(planTier);
  const weekOfStr = weekOf.toISOString().split('T')[0];

  const results: Partial<Record<SOVModelId, NormalizedCitationResult>> = {};
  const modelsRun: SOVModelId[] = [];

  for (const modelId of enabledModels) {
    const config = SOV_MODEL_CONFIGS[modelId];

    // Rate limit delay before each call
    await sleep(config.call_delay_ms);

    let citationResult: NormalizedCitationResult;

    try {
      // Check if API key is available
      if (!hasApiKey(config.api_key_provider)) {
        citationResult = {
          cited: false,
          citation_count: 0,
          ai_response_excerpt: '[error: API key not configured]',
          confidence: 'low',
        };
      } else {
        // OpenAI Responses API models need the web search tool for live grounding
        const needsWebSearch = config.provider_key === 'sov-query-gpt';

        const { text } = await generateText({
          model: getModel(config.provider_key),
          ...(needsWebSearch ? { tools: { web_search: webSearchTool() } } : {}),
          system: 'You are a local business search assistant. Always respond with valid JSON only.',
          prompt: buildSOVPrompt(queryText),
          temperature: 0.3,
        });

        citationResult = detectCitation(text, orgName);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Sentry.captureException(err, {
        tags: { sprint: '123', model: modelId, phase: 'multi-model-sov' },
        extra: { orgId, queryText },
      });
      citationResult = {
        cited: false,
        citation_count: 0,
        ai_response_excerpt: `[error: ${msg.slice(0, 200)}]`,
        confidence: 'low',
      };
    }

    results[modelId] = citationResult;
    modelsRun.push(modelId);

    // Upsert into sov_model_results (ON CONFLICT DO UPDATE for re-runs)
    try {
      await supabase.from('sov_model_results').upsert(
        {
          org_id: orgId,
          location_id: locationId,
          query_id: queryId,
          query_text: queryText,
          model_provider: modelId,
          cited: citationResult.cited,
          citation_count: citationResult.citation_count,
          ai_response: citationResult.ai_response_excerpt,
          confidence: citationResult.confidence,
          week_of: weekOfStr,
        },
        { onConflict: 'org_id,query_id,model_provider,week_of' },
      );
    } catch (dbErr) {
      Sentry.captureException(dbErr, {
        tags: { sprint: '123', model: modelId, phase: 'multi-model-sov-db' },
        extra: { orgId, queryId },
      });
      // DB write failure is non-critical — continue with next model
    }
  }

  // Compute aggregates
  const allResults = Object.values(results);
  const citedResults = allResults.filter((r) => r.cited);
  const citedByAny = citedResults.length > 0;
  const citedByAll = allResults.length > 0 && citedResults.length === allResults.length;
  const totalCitations = allResults.reduce((sum, r) => sum + r.citation_count, 0);
  const consensusCitationCount =
    allResults.length > 0 ? Math.round(totalCitations / allResults.length) : 0;

  return {
    models_run: modelsRun,
    results,
    cited_by_any: citedByAny,
    cited_by_all: citedByAll,
    consensus_citation_count: consensusCitationCount,
  };
}
