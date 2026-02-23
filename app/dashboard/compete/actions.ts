'use server';

// ---------------------------------------------------------------------------
// app/dashboard/compete/actions.ts — Phase 3 Competitor Intercept Server Actions
//
// Four Server Actions for the Greed Engine:
//   addCompetitor        — add a competitor to track (plan-gated, count-limited)
//   deleteCompetitor     — remove a competitor
//   runCompetitorIntercept — 2-stage LLM: Perplexity → GPT-4o-mini (AI_RULES §19.3)
//   markInterceptActionComplete — update action_status (pending → completed/dismissed)
//
// All actions:
//   • Derive org_id server-side via getSafeAuthContext() (AI_RULES §11)
//   • Use canRunCompetitorIntercept() + maxCompetitors() from plan-enforcer (AI_RULES §19.2)
//   • Import GapAnalysis from lib/types/ground-truth (AI_RULES §19.1)
//   • Fall back to mock results when API keys are absent (AI_RULES §4)
// ---------------------------------------------------------------------------

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { canRunCompetitorIntercept, maxCompetitors } from '@/lib/plan-enforcer';
import type { GapAnalysis } from '@/lib/types/ground-truth';

// ---------------------------------------------------------------------------
// Schemas (inline — single-file scope, not reused elsewhere)
// ---------------------------------------------------------------------------

const AddCompetitorSchema = z.object({
  competitor_name:    z.string().min(2, 'Competitor name must be at least 2 characters').max(255).trim(),
  competitor_address: z.string().max(500).trim().optional(),
});

const MarkCompleteSchema = z.object({
  status: z.enum(['completed', 'dismissed']),
});

export type AddCompetitorInput = z.infer<typeof AddCompetitorSchema>;
export type ActionResult = { success: true } | { success: false; error: string };

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
// addCompetitor — Server Action
// ---------------------------------------------------------------------------

/**
 * Add a competitor to track for the authenticated org.
 *
 * Flow:
 *  1. Authenticate — org_id derived server-side (AI_RULES §11)
 *  2. Zod validate input
 *  3. Check org plan via DB — canRunCompetitorIntercept gate
 *  4. Count existing competitors — maxCompetitors gate
 *  5. Fetch primary location for location_id FK
 *  6. INSERT into competitors
 *  7. revalidatePath('/dashboard/compete')
 *
 * SECURITY: org_id is NEVER accepted from client. RLS INSERT policy provides
 * a second enforcement layer.
 */
export async function addCompetitor(input: AddCompetitorInput): Promise<ActionResult> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  // ── Input validation ──────────────────────────────────────────────────────
  const parsed = AddCompetitorSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  // ── Plan gate ─────────────────────────────────────────────────────────────
  const { data: org } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', ctx.orgId)
    .single();

  if (!canRunCompetitorIntercept(org?.plan ?? 'trial')) {
    return { success: false, error: 'Upgrade to Growth plan to track competitors' };
  }

  // ── Competitor count limit ─────────────────────────────────────────────────
  const { count } = await supabase
    .from('competitors')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', ctx.orgId) as { count: number | null };

  if ((count ?? 0) >= maxCompetitors(org.plan)) {
    return {
      success: false,
      error: `Competitor limit reached (${maxCompetitors(org.plan)} max for ${org.plan} plan)`,
    };
  }

  // ── Fetch primary location (for location_id FK — nullable) ────────────────
  const { data: location } = await supabase
    .from('locations')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('is_primary', true)
    .maybeSingle();

  // ── Insert ────────────────────────────────────────────────────────────────
  const { error } = await supabase.from('competitors').insert({
    org_id:             ctx.orgId,
    location_id:        location?.id ?? null,
    competitor_name:    parsed.data.competitor_name,
    competitor_address: parsed.data.competitor_address ?? null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/compete');
  return { success: true };
}

// ---------------------------------------------------------------------------
// deleteCompetitor — Server Action
// ---------------------------------------------------------------------------

/**
 * Remove a tracked competitor from the authenticated org.
 *
 * SECURITY: Explicit `.eq('org_id', ctx.orgId)` + RLS DELETE policy
 * belt-and-suspenders (AI_RULES §18) — prevents cross-tenant deletes.
 */
export async function deleteCompetitor(competitorId: string): Promise<ActionResult> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const { error } = await supabase
    .from('competitors')
    .delete()
    .eq('id', competitorId)
    .eq('org_id', ctx.orgId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/compete');
  return { success: true };
}

// ---------------------------------------------------------------------------
// runCompetitorIntercept — Server Action
// ---------------------------------------------------------------------------

/**
 * Run a 2-stage AI intercept analysis for a competitor.
 *
 * Flow:
 *  1. Authenticate + plan gate (canRunCompetitorIntercept)
 *  2. Fetch competitor (RLS-scoped)
 *  3. Fetch primary location for ground-truth + query generation
 *  4. Build query_asked: "Best {category} in {city}, {state}"
 *  5. Stage 1 — Perplexity sonar: head-to-head comparison → PerplexityResult
 *     Missing PERPLEXITY_API_KEY or error → 3s delay + mock
 *  6. Stage 2 — GPT-4o-mini: structure the gap analysis → InterceptAnalysis
 *     Missing OPENAI_API_KEY or error → 3s delay + mock
 *  7. INSERT into competitor_intercepts (gap_analysis typed as GapAnalysis)
 *  8. revalidatePath('/dashboard/compete')
 *
 * SECURITY: org_id always server-derived. RLS INSERT policy enforces isolation.
 * Model discrimination: gpt-4o-mini (AI_RULES §19.3).
 */
export async function runCompetitorIntercept(competitorId: string): Promise<ActionResult> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  // ── Plan gate ─────────────────────────────────────────────────────────────
  const { data: org } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', ctx.orgId)
    .single();

  if (!canRunCompetitorIntercept(org?.plan ?? 'trial')) {
    return { success: false, error: 'Upgrade to Growth plan to run competitor analysis' };
  }

  // ── Fetch competitor (RLS-scoped, belt-and-suspenders org_id) ────────────
  const { data: competitor, error: competitorError } = await supabase
    .from('competitors')
    .select('*')
    .eq('id', competitorId)
    .eq('org_id', ctx.orgId)
    .single();

  if (competitorError || !competitor) {
    return { success: false, error: 'Competitor not found or access denied' };
  }

  // ── Fetch primary location ─────────────────────────────────────────────────
  const { data: location, error: locationError } = await supabase
    .from('locations')
    .select('id, business_name, city, state, categories')
    .eq('org_id', ctx.orgId)
    .eq('is_primary', true)
    .single();

  if (locationError || !location) {
    return { success: false, error: 'Primary location not found' };
  }

  // ── Build query_asked ──────────────────────────────────────────────────────
  const categories: string[] = Array.isArray(location.categories) ? location.categories : [];
  const primaryCategory = categories[0] ?? 'restaurant';
  const cityState = [location.city, location.state].filter(Boolean).join(', ');
  const queryAsked = `Best ${primaryCategory} in ${cityState}`;

  // ── Stage 1: Perplexity head-to-head ──────────────────────────────────────
  let perplexityResult: PerplexityResult;
  const perplexityKey = process.env.PERPLEXITY_API_KEY;

  if (!perplexityKey) {
    await new Promise((r) => setTimeout(r, 3000));
    perplexityResult = mockPerplexityResult(competitor.competitor_name);
  } else {
    try {
      perplexityResult = await callPerplexityHeadToHead(
        location.business_name,
        competitor.competitor_name,
        queryAsked,
        perplexityKey,
      );
    } catch {
      await new Promise((r) => setTimeout(r, 3000));
      perplexityResult = mockPerplexityResult(competitor.competitor_name);
    }
  }

  // ── Stage 2: GPT-4o-mini intercept analysis ────────────────────────────────
  let interceptAnalysis: InterceptAnalysis;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    await new Promise((r) => setTimeout(r, 3000));
    interceptAnalysis = mockInterceptAnalysis(competitor.competitor_name);
  } else {
    try {
      interceptAnalysis = await callGptIntercept(
        location.business_name,
        competitor.competitor_name,
        perplexityResult,
        openaiKey,
      );
    } catch {
      await new Promise((r) => setTimeout(r, 3000));
      interceptAnalysis = mockInterceptAnalysis(competitor.competitor_name);
    }
  }

  // ── Persist result ────────────────────────────────────────────────────────
  const gapAnalysis: GapAnalysis = interceptAnalysis.gap_details;

  const { error: insertError } = await supabase.from('competitor_intercepts').insert({
    org_id:           ctx.orgId,
    location_id:      location.id,
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
    return { success: false, error: insertError.message };
  }

  revalidatePath('/dashboard/compete');
  return { success: true };
}

// ---------------------------------------------------------------------------
// markInterceptActionComplete — Server Action
// ---------------------------------------------------------------------------

/**
 * Update the action_status of a competitor intercept result.
 *
 * Valid transitions: pending → completed | pending → dismissed
 *
 * SECURITY: Explicit org_id filter + RLS UPDATE policy (AI_RULES §18).
 */
export async function markInterceptActionComplete(
  interceptId: string,
  status: 'completed' | 'dismissed',
): Promise<ActionResult> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  // ── Validate status ───────────────────────────────────────────────────────
  const parsed = MarkCompleteSchema.safeParse({ status });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid status' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const { error } = await supabase
    .from('competitor_intercepts')
    .update({ action_status: parsed.data.status })
    .eq('id', interceptId)
    .eq('org_id', ctx.orgId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/compete');
  return { success: true };
}
