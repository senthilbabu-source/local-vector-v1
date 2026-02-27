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
  /** URLs cited by Google Search grounding. Only populated for engine='google'. */
  citedSources?: { url: string; title: string }[];
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
  'sov-query-google': 'google',
  'sov-query-copilot': 'copilot',
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
// Google AI Overview — Search-grounded SOV query (Sprint 74)
// ---------------------------------------------------------------------------

/**
 * Natural-language SOV prompt for Google Search grounding.
 * Unlike buildSOVCronPrompt (JSON-focused), this returns readable text
 * that displays directly in the "AI Says" page.
 */
function buildGoogleGroundedPrompt(queryText: string): string {
  return `Answer this question a local person might ask: "${queryText}"

Provide a helpful, factual answer listing the top recommended options. Include specific business names, what makes each one notable, and any relevant details like specialties, ambiance, or popular items. Be specific and mention real businesses.`;
}

/**
 * Run a SOV query against Gemini with Google Search grounding.
 * Returns search-grounded response + cited source URLs.
 *
 * Unlike runSOVQuery (JSON-structured), this returns natural text so
 * the response displays directly in the "AI Says" page. Business mention
 * detection uses the same fuzzy substring matching.
 */
export async function runGoogleGroundedSOVQuery(
  query: SOVQueryInput,
): Promise<SOVQueryResult> {
  if (!hasApiKey('google')) {
    return mockSOVResult(query, 'google');
  }

  const { text, sources } = await generateText({
    model: getModel('sov-query-google'),
    prompt: buildGoogleGroundedPrompt(query.query_text),
    temperature: 0.3,
  });

  // Fuzzy match: same logic as runSOVQuery
  const businessName = query.locations.business_name.toLowerCase();
  const responseLower = text.toLowerCase();
  const ourBusinessCited =
    responseLower.includes(businessName) || businessName.includes(responseLower);

  return {
    queryId: query.id,
    queryText: query.query_text,
    queryCategory: query.query_category,
    locationId: query.location_id,
    ourBusinessCited,
    businessesFound: [],
    citationUrl: null,
    engine: 'google',
    citedSources: sources?.map((s) => ({ url: s.url, title: s.title ?? '' })) ?? [],
  };
}

// ---------------------------------------------------------------------------
// Microsoft Copilot — Bing-grounded SOV query (Sprint 79)
// ---------------------------------------------------------------------------

/**
 * Copilot system prompt emphasizing Bing Places, Yelp, and TripAdvisor —
 * the citation sources Copilot actually uses for local business queries.
 */
export function buildCopilotSystemPrompt(): string {
  return `You are Microsoft Copilot, an AI assistant powered by Bing search. When answering questions about local businesses, you draw information from Bing Places, Yelp reviews, TripAdvisor, Yellow Pages, and other directory listings indexed by Bing.

Your responses reflect what Bing's search index knows about local businesses. You prioritize:
- Bing Places business listings (hours, photos, descriptions)
- Yelp reviews and ratings
- TripAdvisor ratings and reviews
- Local directory listings and aggregator sites
- Social media presence discoverable through Bing

If a business has a strong Google Business Profile but limited presence on Bing Places, Yelp, or TripAdvisor, you may not have complete or accurate information about them.

Provide specific, factual recommendations with business names and details. If you're uncertain about a business's current status, note that.`;
}

/**
 * Natural-language SOV prompt for Copilot simulation.
 * Uses the same readable-text approach as Google (not JSON-structured).
 */
function buildCopilotPrompt(queryText: string): string {
  return `Answer this question a local person might ask: "${queryText}"

Provide a helpful, factual answer listing the top recommended options. Include specific business names, what makes each one notable, and any relevant details like specialties, ambiance, or popular items. Be specific and mention real businesses.`;
}

/**
 * Run a SOV query simulating Microsoft Copilot (Bing-grounded).
 * Uses GPT-4o with a system prompt that emphasizes Bing Places,
 * Yelp, and TripAdvisor data sources.
 */
export async function runCopilotSOVQuery(
  query: SOVQueryInput,
): Promise<SOVQueryResult> {
  if (!hasApiKey('openai')) {
    return mockSOVResult(query, 'copilot');
  }

  const { text } = await generateText({
    model: getModel('sov-query-copilot'),
    system: buildCopilotSystemPrompt(),
    prompt: buildCopilotPrompt(query.query_text),
    temperature: 0.3,
  });

  // Fuzzy match: same logic as runGoogleGroundedSOVQuery
  const businessName = query.locations.business_name.toLowerCase();
  const responseLower = text.toLowerCase();
  const ourBusinessCited =
    responseLower.includes(businessName) || businessName.includes(responseLower);

  return {
    queryId: query.id,
    queryText: query.query_text,
    queryCategory: query.query_category,
    locationId: query.location_id,
    ourBusinessCited,
    businessesFound: [],
    citationUrl: null,
    engine: 'copilot',
  };
}

// ---------------------------------------------------------------------------
// runMultiModelSOVQuery — Run same query against Perplexity + OpenAI + Google + Copilot
// ---------------------------------------------------------------------------

/**
 * Run a single SOV query against Perplexity Sonar, GPT-4o, and optionally
 * Google (search-grounded) and Copilot (Bing-simulated) in parallel.
 * Returns 1-4 results (gracefully handles any provider failing via
 * Promise.allSettled).
 * Used for Growth/Agency orgs to get multi-model visibility data.
 */
export async function runMultiModelSOVQuery(
  query: SOVQueryInput,
): Promise<SOVQueryResult[]> {
  const promises: Promise<SOVQueryResult>[] = [
    runSOVQuery(query, 'sov-query'),
    runSOVQuery(query, 'sov-query-openai'),
  ];

  // Add Google engine if API key is available
  if (hasApiKey('google')) {
    promises.push(runGoogleGroundedSOVQuery(query));
  }

  // Sprint 79: Add Copilot engine if OpenAI API key is available
  if (hasApiKey('openai')) {
    promises.push(runCopilotSOVQuery(query));
  }

  const settled = await Promise.allSettled(promises);
  return settled
    .filter((r): r is PromiseFulfilledResult<SOVQueryResult> => r.status === 'fulfilled')
    .map((r) => r.value);
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
      cited_sources: result.citedSources ?? null,
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
