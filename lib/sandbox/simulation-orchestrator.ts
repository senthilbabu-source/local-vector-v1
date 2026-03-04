// ---------------------------------------------------------------------------
// lib/sandbox/simulation-orchestrator.ts — Simulation Orchestrator
//
// Sprint 110: Coordinates all three sandbox simulation modes.
// Uses createServiceRoleClient() for DB ops. Never throws.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';
import type {
  SimulationInput,
  SimulationRun,
  SimulationHistoryEntry,
  SandboxGroundTruth,
  HallucinationRisk,
  IngestionResult,
  SimulationMode,
} from './types';
import { SANDBOX_LIMITS } from './types';
import { analyzeContentIngestion } from './content-ingestion-analyzer';
import {
  simulateQueriesAgainstContent,
  selectQueriesForSimulation,
} from './query-simulation-engine';
import {
  buildGapAnalysis,
  computeHallucinationRisk,
  computeSimulationScore,
} from './hallucination-gap-scorer';

/**
 * Runs a full sandbox simulation.
 */
export async function runSimulation(
  supabase: SupabaseClient<Database>,
  input: SimulationInput,
): Promise<SimulationRun> {
  const errors: string[] = [];
  const startTime = Date.now();

  try {
    // 1. Check daily rate limit
    const rateLimit = await checkDailyRateLimit(supabase, input.org_id);
    if (!rateLimit.allowed) {
      return buildFailedRun(input, ['rate_limit_exceeded']);
    }

    // 2. Fetch Ground Truth from locations table
    const groundTruth = await fetchGroundTruth(supabase, input.location_id, input.org_id);
    if (!groundTruth) {
      return buildFailedRun(input, ['location_not_found']);
    }

    // 3. Truncate content
    const words = input.content_text.split(/\s+/);
    const contentText = words.length > SANDBOX_LIMITS.MAX_CONTENT_WORDS
      ? words.slice(0, SANDBOX_LIMITS.MAX_CONTENT_WORDS).join(' ')
      : input.content_text;

    const contentWordCount = contentText.split(/\s+/).filter(Boolean).length;

    // 4. Run modes in parallel where possible
    const modes = input.modes.length > 0 ? input.modes : ['ingestion', 'query', 'gap_analysis'] as const;
    const runIngestion = modes.includes('ingestion');
    const runQuery = modes.includes('query') || modes.includes('gap_analysis');

    let ingestionResult: IngestionResult | null = null;
    let queryResults: SimulationRun['query_results'] = [];
    let gapAnalysis: SimulationRun['gap_analysis'] = null;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Fetch queries if needed
    const queries = runQuery ? await selectQueriesForSimulation(supabase, input.location_id) : [];

    // Run ingestion and query simulation in parallel
    const promises: Promise<void>[] = [];

    if (runIngestion) {
      promises.push(
        analyzeContentIngestion(contentText, groundTruth)
          .then(({ result, tokensUsed }) => {
            ingestionResult = result;
            totalInputTokens += tokensUsed.input;
            totalOutputTokens += tokensUsed.output;
          })
          .catch(err => {
            Sentry.captureException(err, { tags: { component: 'sandbox-ingestion', sprint: '110' } });
            errors.push(`ingestion_error: ${err instanceof Error ? err.message : 'unknown'}`);
          }),
      );
    }

    if (runQuery && queries.length > 0) {
      promises.push(
        simulateQueriesAgainstContent(contentText, queries, groundTruth)
          .then(({ results, tokensUsed }) => {
            queryResults = results;
            totalInputTokens += tokensUsed.input;
            totalOutputTokens += tokensUsed.output;
          })
          .catch(err => {
            Sentry.captureException(err, { tags: { component: 'sandbox-query', sprint: '110' } });
            errors.push(`query_error: ${err instanceof Error ? err.message : 'unknown'}`);
          }),
      );
    }

    await Promise.all(promises);

    // 5. Build gap analysis from query results (pure, no API)
    if (modes.includes('gap_analysis') && queryResults.length > 0) {
      gapAnalysis = buildGapAnalysis(queryResults, groundTruth);
    }

    // 6. Compute scores
    const ingestionAccuracy = (ingestionResult as IngestionResult | null)?.accuracy_score ?? 0;
    const queryCoverageRate = queryResults.length > 0
      ? queryResults.filter(r => r.answer_quality === 'complete' || r.answer_quality === 'partial').length / queryResults.length
      : 0;
    const hallucinationRisk: HallucinationRisk = queryResults.length > 0
      ? computeHallucinationRisk(queryResults)
      : 'high';
    const simulationScore = computeSimulationScore(ingestionAccuracy, queryCoverageRate, hallucinationRisk);

    // 7. Store content (truncated)
    const storedContent = input.content_text.slice(0, SANDBOX_LIMITS.MAX_CONTENT_CHARS_STORED);

    // 8. Save to simulation_runs
    const { data: insertedRun, error: insertError } = await supabase
      .from('simulation_runs')
      .insert({
        location_id: input.location_id,
        org_id: input.org_id,
        content_source: input.content_source,
        draft_id: input.draft_id ?? null,
        content_text: storedContent,
        content_word_count: contentWordCount,
        modes_run: modes as SimulationMode[],
        ingestion_result: ingestionResult as unknown as Json | null,
        query_results: queryResults as unknown as Json[],
        gap_analysis: gapAnalysis as unknown as Json | null,
        simulation_score: simulationScore,
        ingestion_accuracy: ingestionAccuracy,
        query_coverage_rate: queryCoverageRate,
        hallucination_risk: hallucinationRisk,
        claude_model: SANDBOX_LIMITS.CLAUDE_MODEL,
        input_tokens_used: totalInputTokens,
        output_tokens_used: totalOutputTokens,
        status: errors.length > 0 ? 'partial' : 'completed',
        errors,
      })
      .select('id, run_at')
      .single();

    if (insertError) {
      Sentry.captureException(insertError, { tags: { component: 'sandbox-save', sprint: '110' } });
      errors.push(`save_error: ${insertError.message}`);
    }

    // 9. Update locations columns
    await supabase
      .from('locations')
      .update({
        last_simulation_score: simulationScore,
        simulation_last_run_at: new Date().toISOString(),
      })
      .eq('id', input.location_id);

    return {
      id: insertedRun?.id ?? crypto.randomUUID(),
      location_id: input.location_id,
      org_id: input.org_id,
      content_source: input.content_source,
      draft_id: input.draft_id ?? null,
      content_text: storedContent,
      content_word_count: contentWordCount,
      modes_run: modes as SimulationMode[],
      ingestion_result: ingestionResult,
      query_results: queryResults,
      gap_analysis: gapAnalysis,
      simulation_score: simulationScore,
      ingestion_accuracy: ingestionAccuracy,
      query_coverage_rate: queryCoverageRate,
      hallucination_risk: hallucinationRisk,
      run_at: insertedRun?.run_at ?? new Date().toISOString(),
      claude_model: SANDBOX_LIMITS.CLAUDE_MODEL,
      input_tokens_used: totalInputTokens,
      output_tokens_used: totalOutputTokens,
      status: errors.length > 0 ? 'partial' : 'completed',
      errors,
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'sandbox-orchestrator', sprint: '110' } });
    return buildFailedRun(input, [err instanceof Error ? err.message : 'unknown_error']);
  }
}

/**
 * Returns the simulation history for a location.
 */
export async function getSimulationHistory(
  supabase: SupabaseClient<Database>,
  locationId: string,
  limit = 20,
): Promise<SimulationHistoryEntry[]> {
  const { data, error } = await supabase
    .from('simulation_runs')
    .select('id, content_source, draft_id, simulation_score, hallucination_risk, query_coverage_rate, run_at')
    .eq('location_id', locationId)
    .order('run_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map(row => ({
    id: row.id,
    content_source: row.content_source as SimulationHistoryEntry['content_source'],
    draft_id: row.draft_id,
    simulation_score: row.simulation_score,
    hallucination_risk: row.hallucination_risk as SimulationHistoryEntry['hallucination_risk'],
    query_coverage_rate: Number(row.query_coverage_rate),
    run_at: row.run_at,
  }));
}

/**
 * Returns the most recent complete SimulationRun for a location.
 */
export async function getLatestSimulationRun(
  supabase: SupabaseClient<Database>,
  locationId: string,
): Promise<SimulationRun | null> {
  const { data, error } = await supabase
    .from('simulation_runs')
    .select('*')
    .eq('location_id', locationId)
    .eq('status', 'completed')
    .order('run_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    location_id: data.location_id,
    org_id: data.org_id,
    content_source: data.content_source as SimulationRun['content_source'],
    draft_id: data.draft_id,
    content_text: data.content_text,
    content_word_count: data.content_word_count,
    modes_run: data.modes_run as SimulationRun['modes_run'],
    ingestion_result: data.ingestion_result as SimulationRun['ingestion_result'],
    query_results: (data.query_results ?? []) as unknown as SimulationRun['query_results'],
    gap_analysis: data.gap_analysis as SimulationRun['gap_analysis'],
    simulation_score: data.simulation_score,
    ingestion_accuracy: data.ingestion_accuracy,
    query_coverage_rate: Number(data.query_coverage_rate),
    hallucination_risk: data.hallucination_risk as SimulationRun['hallucination_risk'],
    run_at: data.run_at,
    claude_model: data.claude_model,
    input_tokens_used: data.input_tokens_used,
    output_tokens_used: data.output_tokens_used,
    status: data.status as SimulationRun['status'],
    errors: data.errors,
  };
}

/**
 * Checks the daily rate limit for an org.
 */
export async function checkDailyRateLimit(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<{ allowed: boolean; runs_today: number; remaining: number }> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from('simulation_runs')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('run_at', twentyFourHoursAgo);

  const runsToday = error ? 0 : (count ?? 0);
  const remaining = Math.max(0, SANDBOX_LIMITS.MAX_RUNS_PER_DAY_PER_ORG - runsToday);

  return {
    allowed: runsToday < SANDBOX_LIMITS.MAX_RUNS_PER_DAY_PER_ORG,
    runs_today: runsToday,
    remaining,
  };
}

/**
 * Fetches Ground Truth from the locations table.
 */
async function fetchGroundTruth(
  supabase: SupabaseClient<Database>,
  locationId: string,
  orgId: string,
): Promise<SandboxGroundTruth | null> {
  const { data, error } = await supabase
    .from('locations')
    .select('id, org_id, business_name, address_line1, city, state, zip, phone, website_url, hours_data, amenities, categories')
    .eq('id', locationId)
    .eq('org_id', orgId)
    .maybeSingle();

  if (error || !data) return null;

  // Parse amenities from JSONB to flat list
  const amenitiesObj = (data.amenities ?? {}) as Record<string, boolean | undefined>;
  const amenityList = Object.entries(amenitiesObj)
    .filter(([, val]) => val === true)
    .map(([key]) => key.replace(/^has_|^is_|^serves_|^takes_/g, '').replace(/_/g, ' '));

  // Parse categories
  const categoriesList = (Array.isArray(data.categories) ? data.categories : []) as string[];
  const primaryCategory = categoriesList[0] ?? null;

  // Format hours for display
  const hoursData = data.hours_data as Record<string, { open: string; close: string } | 'closed'> | null;
  let hoursFormatted: string | null = null;
  if (hoursData && typeof hoursData === 'object') {
    const parts = Object.entries(hoursData).map(([day, val]) => {
      if (val === 'closed') return `${day}: closed`;
      if (typeof val === 'object' && val.open && val.close) return `${day}: ${val.open}-${val.close}`;
      return null;
    }).filter(Boolean);
    hoursFormatted = parts.length > 0 ? parts.join(', ') : null;
  }

  return {
    location_id: data.id,
    org_id: data.org_id,
    name: data.business_name,
    phone: data.phone,
    address: data.address_line1,
    city: data.city,
    state: data.state,
    zip: data.zip,
    website: data.website_url,
    category: primaryCategory,
    hours: hoursFormatted,
    hours_data: hoursData,
    description: null,
    amenities: amenityList,
  };
}

function buildFailedRun(input: SimulationInput, errors: string[]): SimulationRun {
  return {
    id: crypto.randomUUID(),
    location_id: input.location_id,
    org_id: input.org_id,
    content_source: input.content_source,
    draft_id: input.draft_id ?? null,
    content_text: input.content_text.slice(0, SANDBOX_LIMITS.MAX_CONTENT_CHARS_STORED),
    content_word_count: input.content_text.split(/\s+/).filter(Boolean).length,
    modes_run: input.modes,
    ingestion_result: null,
    query_results: [],
    gap_analysis: null,
    simulation_score: 0,
    ingestion_accuracy: 0,
    query_coverage_rate: 0,
    hallucination_risk: 'critical',
    run_at: new Date().toISOString(),
    claude_model: SANDBOX_LIMITS.CLAUDE_MODEL,
    input_tokens_used: 0,
    output_tokens_used: 0,
    status: 'failed',
    errors,
  };
}
