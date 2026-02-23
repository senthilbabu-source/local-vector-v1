// ---------------------------------------------------------------------------
// lib/services/competitor-intercept.service.ts — Competitor Intercept Pipeline
//
// Extracted from app/dashboard/compete/actions.ts so that the 2-stage
// Perplexity → GPT-4o-mini pipeline can be called from two contexts:
//
//   1. Server Action (RLS-scoped client, user session)
//   2. Cron route   (service-role client, no user session)
//
// Both callers pass their already-created Supabase client as a parameter.
// This module never creates its own client — it is a pure service.
//
// AI_RULES §19.1: GapAnalysis imported from lib/types/ground-truth.
// AI_RULES §19.3: Model discrimination — gpt-4o-mini for intercept analysis.
// AI_RULES §4:    Mock fallback (3s delay) when API keys are absent.
// ---------------------------------------------------------------------------

import type { GapAnalysis } from '@/lib/types/ground-truth';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type PerplexityResult = {
  winner:              string;
  reasoning:           string;
  key_differentiators: string[];
};

type InterceptAnalysis = {
  winner:           string;
  winning_factor:   string;
  gap_magnitude:    string;
  gap_details:      GapAnalysis;
  suggested_action: string;
  action_category:  string;
};

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
// ---------------------------------------------------------------------------

async function callPerplexityHeadToHead(
  myBusiness:     string,
  competitorName: string,
  queryAsked:     string,
  apiKey:         string,
): Promise<PerplexityResult> {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: 'You are an AI search analyst. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content:
            `Compare "${myBusiness}" and "${competitorName}" for someone searching: "${queryAsked}". ` +
            `Which would you recommend and why? Consider reviews, atmosphere, and value.\n\n` +
            `Return ONLY valid JSON:\n` +
            `{\n  "winner": "Business Name",\n  "reasoning": "Why they won",\n  "key_differentiators": ["factor1"]\n}`,
        },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) throw new Error(`Perplexity API error: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const content: string = json.choices?.[0]?.message?.content ?? '{}';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

  return {
    winner:              String(parsed.winner ?? competitorName),
    reasoning:           String(parsed.reasoning ?? ''),
    key_differentiators: Array.isArray(parsed.key_differentiators) ? parsed.key_differentiators : [],
  };
}

// ---------------------------------------------------------------------------
// Stage 2 — GPT-4o-mini intercept analysis (AI_RULES §19.3)
// ---------------------------------------------------------------------------

async function callGptIntercept(
  myBusiness:       string,
  competitorName:   string,
  perplexityResult: PerplexityResult,
  apiKey:           string,
): Promise<InterceptAnalysis> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an AI search analyst for local businesses.',
        },
        {
          role: 'user',
          content:
            `User's Business: ${myBusiness}\n` +
            `Competitor: ${competitorName}\n` +
            `AI Recommendation: ${JSON.stringify(perplexityResult)}\n\n` +
            `Analyze WHY the winner won and extract one specific action the losing business can take THIS WEEK.\n\n` +
            `Return ONLY valid JSON:\n` +
            `{\n` +
            `  "winner": "string",\n` +
            `  "winning_factor": "string",\n` +
            `  "gap_magnitude": "high|medium|low",\n` +
            `  "gap_details": { "competitor_mentions": number, "your_mentions": number },\n` +
            `  "suggested_action": "string",\n` +
            `  "action_category": "reviews|menu|attributes|content|photos"\n` +
            `}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI API error: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const content: string = json.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content);

  return {
    winner:           String(parsed.winner ?? competitorName),
    winning_factor:   String(parsed.winning_factor ?? ''),
    gap_magnitude:    String(parsed.gap_magnitude ?? 'medium'),
    gap_details: {
      competitor_mentions: Number(parsed.gap_details?.competitor_mentions ?? 0),
      your_mentions:       Number(parsed.gap_details?.your_mentions ?? 0),
    },
    suggested_action: String(parsed.suggested_action ?? ''),
    action_category:  String(parsed.action_category ?? 'content'),
  };
}

// ---------------------------------------------------------------------------
// Mock fallbacks — used when API keys absent or calls fail (AI_RULES §4)
// ---------------------------------------------------------------------------

function mockPerplexityResult(competitorName: string): PerplexityResult {
  return {
    winner:              competitorName,
    reasoning:           '[MOCK] Configure PERPLEXITY_API_KEY in .env.local to run real comparisons.',
    key_differentiators: ['more reviews', 'late-night hours'],
  };
}

function mockInterceptAnalysis(competitorName: string): InterceptAnalysis {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<void> {
  const { orgId, locationId, businessName, categories, city, state, competitor } = params;

  // ── Build query string ──────────────────────────────────────────────────
  const primaryCategory = categories[0] ?? 'restaurant';
  const cityState       = [city, state].filter(Boolean).join(', ');
  const queryAsked      = `Best ${primaryCategory} in ${cityState}`;

  // ── Stage 1: Perplexity head-to-head ─────────────────────────────────
  let perplexityResult: PerplexityResult;
  const perplexityKey = process.env.PERPLEXITY_API_KEY;

  if (!perplexityKey) {
    await new Promise((r) => setTimeout(r, 3000));
    perplexityResult = mockPerplexityResult(competitor.competitor_name);
  } else {
    try {
      perplexityResult = await callPerplexityHeadToHead(
        businessName,
        competitor.competitor_name,
        queryAsked,
        perplexityKey,
      );
    } catch {
      await new Promise((r) => setTimeout(r, 3000));
      perplexityResult = mockPerplexityResult(competitor.competitor_name);
    }
  }

  // ── Stage 2: GPT-4o-mini intercept analysis ───────────────────────────
  let interceptAnalysis: InterceptAnalysis;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    await new Promise((r) => setTimeout(r, 3000));
    interceptAnalysis = mockInterceptAnalysis(competitor.competitor_name);
  } else {
    try {
      interceptAnalysis = await callGptIntercept(
        businessName,
        competitor.competitor_name,
        perplexityResult,
        openaiKey,
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
    gap_analysis:     gapAnalysis,
    gap_magnitude:    interceptAnalysis.gap_magnitude,
    suggested_action: interceptAnalysis.suggested_action,
    action_status:    'pending',
  });

  if (insertError) {
    throw new Error(insertError.message);
  }
}
