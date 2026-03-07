// ---------------------------------------------------------------------------
// lib/bing-search/bing-grounded-sov.ts — Bing-grounded Copilot SOV runner
//
// Replaces the simulated Copilot SOV (GPT-4o with Bing-themed system prompt)
// with a two-step pipeline:
//   1. Fetch real Bing Web Search results for the query
//   2. Feed those results as context to GPT-4o so it generates a grounded answer
//
// This means the Copilot SOV now reflects what Bing's actual index contains,
// not what GPT-4o hallucinates about local businesses.
//
// Fallback: If Bing API is unavailable, falls back to the original simulation.
// ---------------------------------------------------------------------------

import { generateText } from 'ai';
import { getModel, hasApiKey } from '@/lib/ai/providers';
import * as Sentry from '@sentry/nextjs';
import type { SOVQueryInput, SOVQueryResult } from '@/lib/services/sov-engine.service';
import { searchBingWeb } from './bing-web-search-client';
import type { BingWebPage } from './types';

const MAX_BING_RESULTS = 10;
const MAX_CONTEXT_LENGTH = 4000;

/**
 * Format Bing search results into a context block for the LLM prompt.
 * Truncates to MAX_CONTEXT_LENGTH to avoid token waste.
 */
export function formatBingResultsAsContext(pages: BingWebPage[]): string {
  if (pages.length === 0) return '';

  const lines: string[] = [];
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    lines.push(`[${i + 1}] ${p.name}`);
    lines.push(`    URL: ${p.url}`);
    lines.push(`    ${p.snippet}`);
    lines.push('');
  }

  const context = lines.join('\n');
  if (context.length > MAX_CONTEXT_LENGTH) {
    return context.slice(0, MAX_CONTEXT_LENGTH) + '\n[...truncated]';
  }
  return context;
}

/**
 * Build the system prompt for Bing-grounded Copilot simulation.
 * Instructs the model to ONLY use the provided Bing search results.
 */
export function buildBingGroundedSystemPrompt(context: string): string {
  return `You are Microsoft Copilot, an AI assistant powered by Bing search. You are answering a question about local businesses.

IMPORTANT: You must ONLY use information from the Bing search results provided below. Do not add businesses or facts not present in these results. If a business is not in the search results, do not mention it.

Bing Search Results:
${context}

Based ONLY on these search results, provide a helpful answer listing recommended businesses. Include specific business names and details found in the results. If the results don't contain enough information to answer well, say so.`;
}

/**
 * Build the fallback system prompt (no Bing results available).
 * This is the original simulation prompt — used only when Bing API fails.
 */
export function buildFallbackSystemPrompt(): string {
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
 * Build the user prompt for the Copilot SOV query.
 */
function buildUserPrompt(queryText: string): string {
  return `Answer this question a local person might ask: "${queryText}"

Provide a helpful, factual answer listing the top recommended options. Include specific business names, what makes each one notable, and any relevant details like specialties, ambiance, or popular items. Be specific and mention real businesses.`;
}

/**
 * Extract cited URLs from Bing results that are relevant to the business.
 * A Bing result is "relevant" if its title or snippet mentions the business name.
 */
export function extractRelevantBingSources(
  pages: BingWebPage[],
  businessName: string,
): { url: string; title: string }[] {
  if (!businessName) return [];

  const nameLower = businessName.toLowerCase();
  const sources: { url: string; title: string }[] = [];

  for (const page of pages) {
    const titleLower = page.name.toLowerCase();
    const snippetLower = page.snippet.toLowerCase();

    if (titleLower.includes(nameLower) || snippetLower.includes(nameLower)) {
      sources.push({ url: page.url, title: page.name });
    }
  }

  return sources;
}

/**
 * Detect whether the AI response mentions the business.
 * Uses case-insensitive substring matching with normalization.
 */
export function detectBusinessMention(
  responseText: string,
  businessName: string,
): boolean {
  if (!businessName || !responseText) return false;

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/\bthe\s+/g, '')
      .replace(/\s*&\s*/g, ' and ')
      .replace(/\s*'n'\s*/g, ' and ')
      .replace(/\bn\b/g, 'and')
      .replace(/[''`]/g, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const normalizedResponse = normalize(responseText);
  const normalizedName = normalize(businessName);

  if (!normalizedName) return false;

  return normalizedResponse.includes(normalizedName);
}

/**
 * Run a Bing-grounded Copilot SOV query.
 *
 * Pipeline:
 *   1. Fetch real Bing Web Search results
 *   2. If results found: ground GPT-4o answer in those results
 *   3. If Bing unavailable: fall back to simulated Copilot prompt
 *   4. Check if our business is mentioned in the response
 *   5. Extract cited Bing URLs mentioning the business
 *
 * Fail-open: never throws — returns mock result on any unrecoverable error.
 */
export async function runBingGroundedSOVQuery(
  query: SOVQueryInput,
): Promise<SOVQueryResult> {
  const businessName = query.locations?.business_name ?? '';

  // Gate: need Perplexity API key for the LLM step (sonar-pro Copilot proxy)
  if (!hasApiKey('perplexity')) {
    return mockCopilotResult(query);
  }

  try {
    // Step 1: Fetch real Bing search results
    const bingResults = await searchBingWeb(
      {
        queryText: query.query_text,
        city: query.locations?.city,
        state: query.locations?.state,
      },
      MAX_BING_RESULTS,
    );

    // Step 2: Build system prompt — grounded if we have results, fallback otherwise
    const isGrounded = bingResults.fromLiveApi && bingResults.pages.length > 0;
    const context = formatBingResultsAsContext(bingResults.pages);
    const systemPrompt = isGrounded
      ? buildBingGroundedSystemPrompt(context)
      : buildFallbackSystemPrompt();

    // Step 3: Generate response via GPT-4o
    const { text } = await generateText({
      model: getModel('sov-query-copilot'),
      system: systemPrompt,
      prompt: buildUserPrompt(query.query_text),
      temperature: 0.3,
    });

    // Step 4: Detect business mention
    const ourBusinessCited = detectBusinessMention(text, businessName);

    // Step 5: Extract cited sources from Bing results
    const citedSources = isGrounded
      ? extractRelevantBingSources(bingResults.pages, businessName)
      : [];

    return {
      queryId: query.id,
      queryText: query.query_text,
      queryCategory: query.query_category,
      locationId: query.location_id,
      ourBusinessCited,
      businessesFound: [],
      citationUrl: citedSources[0]?.url ?? null,
      engine: 'copilot',
      citedSources: citedSources.length > 0 ? citedSources : undefined,
    };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { service: 'bing-grounded-sov', sprint: 'bing-grounding' },
      extra: { queryText: query.query_text },
    });
    return mockCopilotResult(query);
  }
}

/** Mock result for when API keys are absent or on unrecoverable error. */
function mockCopilotResult(query: SOVQueryInput): SOVQueryResult {
  return {
    queryId: query.id,
    queryText: query.query_text,
    queryCategory: query.query_category,
    locationId: query.location_id,
    ourBusinessCited: false,
    businessesFound: [],
    citationUrl: null,
    engine: 'copilot',
  };
}
