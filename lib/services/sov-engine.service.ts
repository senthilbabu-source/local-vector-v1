// ---------------------------------------------------------------------------
// lib/services/sov-engine.service.ts — SOV Engine Core Logic
//
// Surgery 2: Implements the Share-of-Answer engine from Doc 04c.
//
// Provides:
//   runSOVQuery()      — Runs a single SOV query against Perplexity Sonar,
//                        returns structured result with business mentions.
//   writeSOVResults()  — Aggregates per-query results into visibility_analytics
//                        and checks for First Mover Alert opportunities.
//
// This module is a pure service — it never creates its own Supabase client.
// The cron route passes in a service-role client; future on-demand endpoints
// can pass an RLS-scoped client.
//
// Spec: docs/04c-SOV-ENGINE.md §4
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { generateText } from 'ai';
import { getModel, hasApiKey, type ModelKey } from '@/lib/ai/providers';
import { SovCronResultSchema, type SovCronResultOutput } from '@/lib/ai/schemas';
import { createDraft } from '@/lib/autopilot/create-draft';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SOVQueryInput {
  id: string;
  query_text: string;
  query_category: string;
  location_id: string;
  org_id: string;
  locations: {
    business_name: string;
    city: string | null;
    state: string | null;
  };
}

export interface SOVQueryResult {
  queryId: string;
  queryText: string;
  queryCategory: string;
  locationId: string;
  ourBusinessCited: boolean;
  businessesFound: string[];
  citationUrl: string | null;
  engine: string;
}

// ---------------------------------------------------------------------------
// SOV Prompt — Doc 04c §4.2
// ---------------------------------------------------------------------------

function buildSOVCronPrompt(queryText: string): string {
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
// Mock result — used when API keys are absent (local dev, CI)
// ---------------------------------------------------------------------------

function mockSOVResult(query: SOVQueryInput, engine = 'perplexity'): SOVQueryResult {
  return {
    queryId: query.id,
    queryText: query.query_text,
    queryCategory: query.query_category,
    locationId: query.location_id,
    ourBusinessCited: false,
    businessesFound: [],
    citationUrl: null,
    engine,
  };
}

// ---------------------------------------------------------------------------
// Model key → engine name mapping
// ---------------------------------------------------------------------------

const MODEL_ENGINE_MAP: Record<string, string> = {
  'sov-query': 'perplexity',
  'sov-query-openai': 'openai',
};

// ---------------------------------------------------------------------------
// runSOVQuery — Executes a single SOV query against a configurable model
// ---------------------------------------------------------------------------

/**
 * Run a single SOV query and determine if the target business was cited.
 *
 * Uses fuzzy name matching (case-insensitive substring) to detect mentions —
 * AI responses may abbreviate or slightly alter business names.
 *
 * @param modelKey — defaults to 'sov-query' (Perplexity Sonar). Pass
 *   'sov-query-openai' for GPT-4o multi-model SOV.
 *
 * Falls back to mock result when required API key is absent.
 * Throws on API errors — caller must handle per-query failures.
 */
export async function runSOVQuery(
  query: SOVQueryInput,
  modelKey: ModelKey = 'sov-query',
): Promise<SOVQueryResult> {
  const engine = MODEL_ENGINE_MAP[modelKey] ?? 'perplexity';
  const provider = engine === 'openai' ? 'openai' : 'perplexity';

  if (!hasApiKey(provider)) {
    return mockSOVResult(query, engine);
  }

  const { text } = await generateText({
    model: getModel(modelKey),
    system: 'You are a local business search assistant. Always respond with valid JSON only.',
    prompt: buildSOVCronPrompt(query.query_text),
    temperature: 0.3,
  });

  let businesses: string[] = [];
  let citationUrl: string | null = null;
  try {
    const parsed = SovCronResultSchema.parse(JSON.parse(text));
    businesses = parsed.businesses ?? [];
    citationUrl = parsed.cited_url ?? null;
  } catch {
    // unparseable response — treat as no results
  }
  // Fuzzy match: case-insensitive substring check.
  // "Charcoal N Chill" matches "charcoal n chill", "Charcoal n Chill Hookah Lounge", etc.
  const businessName = query.locations.business_name.toLowerCase();
  const ourBusinessCited = businesses.some(
    (b) => b.toLowerCase().includes(businessName) || businessName.includes(b.toLowerCase())
  );

  return {
    queryId: query.id,
    queryText: query.query_text,
    queryCategory: query.query_category,
    locationId: query.location_id,
    ourBusinessCited,
    businessesFound: businesses.filter(
      (b) => !b.toLowerCase().includes(businessName) && !businessName.includes(b.toLowerCase())
    ),
    citationUrl,
    engine,
  };
}

// ---------------------------------------------------------------------------
// runMultiModelSOVQuery — Run same query against Perplexity + OpenAI in parallel
// ---------------------------------------------------------------------------

/**
 * Run a single SOV query against both Perplexity Sonar and GPT-4o in parallel.
 * Returns 1-2 results (gracefully handles one provider failing).
 * Used for Growth/Agency orgs to get multi-model visibility data.
 */
export async function runMultiModelSOVQuery(
  query: SOVQueryInput,
): Promise<SOVQueryResult[]> {
  const [perplexityResult, openaiResult] = await Promise.allSettled([
    runSOVQuery(query, 'sov-query'),
    runSOVQuery(query, 'sov-query-openai'),
  ]);

  const results: SOVQueryResult[] = [];
  if (perplexityResult.status === 'fulfilled') results.push(perplexityResult.value);
  if (openaiResult.status === 'fulfilled') results.push(openaiResult.value);
  return results;
}

// ---------------------------------------------------------------------------
// writeSOVResults — Aggregate and persist SOV data (Doc 04c §4.3)
// ---------------------------------------------------------------------------

/**
 * Writes SOV results to the database:
 *   1. Updates per-query last_run state on target_queries
 *   2. Aggregates into visibility_analytics (share_of_voice, citation_rate)
 *   3. Checks for First Mover Alert opportunities
 *
 * All writes use the passed Supabase client (service-role for cron).
 */
export async function writeSOVResults(
  orgId: string,
  results: SOVQueryResult[],
  supabase: SupabaseClient<Database>,
): Promise<{ shareOfVoice: number; citationRate: number; firstMoverCount: number }> {
  if (results.length === 0) {
    return { shareOfVoice: 0, citationRate: 0, firstMoverCount: 0 };
  }

  const today = new Date().toISOString().split('T')[0];

  // ── 1. Insert per-query evaluation history ─────────────────────────────
  // Each run is recorded in sov_evaluations with a created_at timestamp.
  // (target_queries has no updated_at/last_run_at column — we rely on
  //  sov_evaluations.created_at for "last run" semantics.)
  for (const result of results) {
    await supabase.from('sov_evaluations').insert({
      org_id: orgId,
      location_id: result.locationId,
      query_id: result.queryId,
      engine: result.engine ?? 'perplexity',
      rank_position: result.ourBusinessCited ? 1 : null,
      mentioned_competitors: result.businessesFound,
      raw_response: JSON.stringify({
        businesses: [...result.businessesFound, ...(result.ourBusinessCited ? [result.queryText] : [])],
        cited_url: result.citationUrl,
      }),
    });
  }

  // ── 2. Aggregate SOV metrics ────────────────────────────────────────────
  // share_of_voice: what % of queries cited our business?
  const citedCount = results.filter((r) => r.ourBusinessCited).length;
  const shareOfVoice = results.length > 0 ? (citedCount / results.length) * 100 : 0;

  // citation_rate: of queries where we appeared, what % had a citation URL?
  const citedResults = results.filter((r) => r.ourBusinessCited);
  const citationRate =
    citedResults.length > 0
      ? (citedResults.filter((r) => r.citationUrl).length / citedResults.length) * 100
      : 0;

  // ── 3. Upsert visibility_analytics ──────────────────────────────────────
  // share_of_voice is stored as 0.0–1.0 float (dashboard multiplies by 100)
  await supabase.from('visibility_analytics').upsert(
    {
      org_id: orgId,
      location_id: results[0].locationId,
      share_of_voice: parseFloat((shareOfVoice / 100).toFixed(3)), // percentage → 0.0–1.0 float (3 decimal places)
      citation_rate: parseFloat((citationRate / 100).toFixed(3)),
      snapshot_date: today,
    },
    { onConflict: 'org_id,location_id,snapshot_date' },
  );

  // ── 4. Check First Mover Alerts (Doc 04c §6.1) ─────────────────────────
  const firstMoverOpps = results.filter(
    (r) =>
      !r.ourBusinessCited &&
      r.businessesFound.length === 0 &&
      ['discovery', 'occasion', 'near_me'].includes(r.queryCategory),
  );

  for (const opp of firstMoverOpps) {
    await createDraft(
      {
        triggerType: 'first_mover',
        triggerId: opp.queryId,
        orgId,
        locationId: opp.locationId,
        context: { targetQuery: opp.queryText },
      },
      supabase,
    );
  }

  return {
    shareOfVoice: parseFloat(shareOfVoice.toFixed(1)), // percentage rounded to 1 decimal place
    citationRate: parseFloat(citationRate.toFixed(1)),
    firstMoverCount: firstMoverOpps.length,
  };
}

// ---------------------------------------------------------------------------
// Utility — sleep for rate limiting
// ---------------------------------------------------------------------------

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
