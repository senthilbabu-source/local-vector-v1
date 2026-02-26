// ---------------------------------------------------------------------------
// lib/services/competitor-intercept.service.ts — Competitor Intercept Pipeline
//
// 2-stage LLM pipeline: Perplexity (head-to-head) → GPT-4o-mini (intercept).
// Uses Vercel AI SDK for both stages:
//   • Stage 1: generateText + Zod validation (Perplexity — compatible mode)
//   • Stage 2: generateObject with Zod schema (OpenAI — strict structured output)
//
// Called from:
//   1. Server Action (RLS-scoped client, user session)
//   2. Cron route   (service-role client, no user session)
//   3. Inngest step (service-role client, fan-out)
//
// Both callers pass their already-created Supabase client as a parameter.
// This module never creates its own client — it is a pure service.
//
// AI_RULES §19.1: GapAnalysis imported from lib/types/ground-truth.
// AI_RULES §19.3: Model discrimination — gpt-4o-mini for intercept analysis.
// AI_RULES §4:    Mock fallback (3s delay) when API keys are absent.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { generateText, generateObject } from 'ai';
import { getModel, hasApiKey } from '@/lib/ai/providers';
import {
  PerplexityHeadToHeadSchema,
  InterceptAnalysisSchema,
  zodSchema,
  type PerplexityHeadToHeadOutput,
  type InterceptAnalysisOutput,
} from '@/lib/ai/schemas';
import type { GapAnalysis } from '@/lib/types/ground-truth';
import type { Json } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Public params interface
// ---------------------------------------------------------------------------

export interface InterceptParams {
  orgId:        string;
  locationId:   string | null;
  businessName: string;
  categories:   string[];
  city:         string | null;
  state:        string | null;
  competitor: {
    id:              string;
    competitor_name: string;
  };
}

// ---------------------------------------------------------------------------
// Stage 1 — Perplexity head-to-head comparison (sonar model)
//
// Uses generateText + manual Zod validation because Perplexity's
// OpenAI-compatible API (compatibility: 'compatible') does not support
// response_format: { type: 'json_schema' } required by generateObject.
// ---------------------------------------------------------------------------

async function callPerplexityHeadToHead(
  myBusiness:     string,
  competitorName: string,
  queryAsked:     string,
): Promise<PerplexityHeadToHeadOutput> {
  const { text } = await generateText({
    model: getModel('greed-headtohead'),
    system: 'You are an AI search analyst. Always respond with valid JSON only.',
    prompt:
      `Compare "${myBusiness}" and "${competitorName}" for someone searching: "${queryAsked}". ` +
      `Which would you recommend and why? Consider reviews, atmosphere, and value.\n\n` +
      `Return ONLY valid JSON:\n` +
      `{\n  "winner": "Business Name",\n  "reasoning": "Why they won",\n  "key_differentiators": ["factor1"]\n}`,
    temperature: 0.3,
  });

  return PerplexityHeadToHeadSchema.parse(JSON.parse(text));
}

// ---------------------------------------------------------------------------
// Stage 2 — GPT-4o-mini intercept analysis (AI_RULES §19.3)
//
// Uses generateObject with Zod schema — OpenAI enforces structured output
// server-side, SDK validates with Zod, no manual JSON.parse needed.
// ---------------------------------------------------------------------------

async function callGptIntercept(
  myBusiness:       string,
  competitorName:   string,
  perplexityResult: PerplexityHeadToHeadOutput,
): Promise<InterceptAnalysisOutput> {
  const { object } = await generateObject({
    model: getModel('greed-intercept'),
    schema: zodSchema(InterceptAnalysisSchema),
    system: 'You are an AI search analyst for local businesses.',
    prompt:
      `User's Business: ${myBusiness}\n` +
      `Competitor: ${competitorName}\n` +
      `AI Recommendation: ${JSON.stringify(perplexityResult)}\n\n` +
      `Analyze WHY the winner won and extract one specific action the losing business can take THIS WEEK.`,
    temperature: 0.3,
  });

  return object as InterceptAnalysisOutput;
}

// ---------------------------------------------------------------------------
// Mock fallbacks — used when API keys absent or calls fail (AI_RULES §4)
// ---------------------------------------------------------------------------

function mockPerplexityResult(competitorName: string): PerplexityHeadToHeadOutput {
  return {
    winner:              competitorName,
    reasoning:           '[MOCK] Configure PERPLEXITY_API_KEY in .env.local to run real comparisons.',
    key_differentiators: ['more reviews', 'late-night hours'],
  };
}

function mockInterceptAnalysis(competitorName: string): InterceptAnalysisOutput {
  return {
    winner:           competitorName,
    winning_factor:   '[MOCK] Configure OPENAI_API_KEY in .env.local for real analysis.',
    gap_magnitude:    'medium',
    gap_details:      { competitor_mentions: 5, your_mentions: 2 },
    suggested_action: '[MOCK] Configure OPENAI_API_KEY in .env.local to get real action items.',
    action_category:  'content',
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Run a 2-stage Perplexity → GPT-4o-mini intercept analysis and persist the
 * result to competitor_intercepts using the provided Supabase client.
 *
 * Accepts any Supabase client:
 *   • RLS-scoped (createClient) from Server Actions — org isolation via RLS
 *   • Service-role (createServiceRoleClient) from cron — bypasses RLS
 *
 * Falls back to mock results when API keys are absent (AI_RULES §4).
 * Throws on DB insert error — the caller is responsible for error handling.
 */
export async function runInterceptForCompetitor(
  params:  InterceptParams,
  supabase: SupabaseClient<Database>,
): Promise<void> {
  const { orgId, locationId, businessName, categories, city, state, competitor } = params;

  // ── Build query string ──────────────────────────────────────────────────
  const primaryCategory = categories[0] ?? 'restaurant';
  const cityState       = [city, state].filter(Boolean).join(', ');
  const queryAsked      = `Best ${primaryCategory} in ${cityState}`;

  // ── Stage 1: Perplexity head-to-head ─────────────────────────────────
  let perplexityResult: PerplexityHeadToHeadOutput;

  if (!hasApiKey('perplexity')) {
    await new Promise((r) => setTimeout(r, 3000));
    perplexityResult = mockPerplexityResult(competitor.competitor_name);
  } else {
    try {
      perplexityResult = await callPerplexityHeadToHead(
        businessName,
        competitor.competitor_name,
        queryAsked,
      );
    } catch {
      await new Promise((r) => setTimeout(r, 3000));
      perplexityResult = mockPerplexityResult(competitor.competitor_name);
    }
  }

  // ── Stage 2: GPT-4o-mini intercept analysis ───────────────────────────
  let interceptAnalysis: InterceptAnalysisOutput;

  if (!hasApiKey('openai')) {
    await new Promise((r) => setTimeout(r, 3000));
    interceptAnalysis = mockInterceptAnalysis(competitor.competitor_name);
  } else {
    try {
      interceptAnalysis = await callGptIntercept(
        businessName,
        competitor.competitor_name,
        perplexityResult,
      );
    } catch {
      await new Promise((r) => setTimeout(r, 3000));
      interceptAnalysis = mockInterceptAnalysis(competitor.competitor_name);
    }
  }

  // ── Persist result ────────────────────────────────────────────────────
  const gapAnalysis: GapAnalysis = interceptAnalysis.gap_details;

  const { error: insertError } = await supabase.from('competitor_intercepts').insert({
    org_id:           orgId,
    location_id:      locationId,
    competitor_name:  competitor.competitor_name,
    query_asked:      queryAsked,
    model_provider:   'openai-gpt4o-mini',
    winner:           interceptAnalysis.winner,
    winner_reason:    perplexityResult.reasoning,
    winning_factor:   interceptAnalysis.winning_factor,
    gap_analysis:     gapAnalysis as unknown as Json,
    gap_magnitude:    interceptAnalysis.gap_magnitude,
    suggested_action: interceptAnalysis.suggested_action,
    action_status:    'pending',
  });

  if (insertError) {
    throw new Error(insertError.message);
  }
}
