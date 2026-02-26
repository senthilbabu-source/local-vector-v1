'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import {
  AddQuerySchema,
  RunSovSchema,
  type AddQueryInput,
  type RunSovInput,
  type SovEngine,
} from '@/lib/schemas/sov';
import { generateText, Output } from 'ai';
import { getModel, hasApiKey } from '@/lib/ai/providers';
import { SovQueryResultSchema } from '@/lib/ai/schemas';

// ---------------------------------------------------------------------------
// Shared result type
// ---------------------------------------------------------------------------

export type ActionResult = { success: true } | { success: false; error: string };

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type LocationData = {
  id: string;
  business_name: string;
  city: string | null;
  state: string | null;
};

type SovResult = {
  rank_position: number | null;
  mentioned_competitors: string[];
  raw_response: string;
};

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildSovPrompt(
  businessName: string,
  city: string | null,
  state: string | null,
  queryText: string
): string {
  const location = [city, state].filter(Boolean).join(', ');
  return `You are a Share of Voice analyst measuring AI visibility for local businesses.

SEARCH QUERY: "${queryText}"

BUSINESS TO TRACK: ${businessName}${location ? ` (located in ${location})` : ''}

TASK:
1. Generate a realistic AI assistant response to the search query above — the kind a user would receive from a conversational AI or search engine AI overview.
2. Analyze your generated response:
   - Is "${businessName}" mentioned? If yes, at what numeric position (1 = first business named, 2 = second, etc.)? If not mentioned at all, use null.
   - List the names of all OTHER businesses mentioned (competitors). Exclude "${businessName}" from this list.

Return a JSON object with exactly these three fields:
- "rank_position": integer (position of ${businessName}) or null (if not mentioned)
- "mentioned_competitors": array of strings (other business names mentioned)
- "raw_response": string (the realistic AI response you generated)

Return only valid JSON. No markdown, no explanation outside the JSON object.`;
}

// ---------------------------------------------------------------------------
// Mock fallback — used when API key is absent or the API call fails
// ---------------------------------------------------------------------------

function mockSovResult(engine: SovEngine): SovResult {
  return {
    rank_position: 1,
    mentioned_competitors: [],
    raw_response: `[MOCK] Simulated ${engine} response. Configure ${
      engine === 'openai' ? 'OPENAI_API_KEY' : 'PERPLEXITY_API_KEY'
    } in .env.local to run a real Share of Voice evaluation.`,
  };
}

// ---------------------------------------------------------------------------
// AI SDK calls — Surgery 1: Replaces raw fetch() with Vercel AI SDK - FIXED
// ---------------------------------------------------------------------------

async function callOpenAI(prompt: string): Promise<SovResult> {
  const { text } = await generateText({
    model: getModel('sov-query-openai'),
    prompt,
    temperature: 0.3,
  });

  try {
    const parsed = JSON.parse(text);
    const output = SovQueryResultSchema.parse(parsed);
    return {
      rank_position: output.rank_position !== null ? Math.max(1, output.rank_position) : null,
      mentioned_competitors: output.mentioned_competitors,
      raw_response: output.raw_response,
    };
  } catch {
    return { rank_position: null, mentioned_competitors: [], raw_response: text };
  }
}

async function callPerplexity(prompt: string): Promise<SovResult> {
  const { text } = await generateText({
    model: getModel('sov-query'),
    system: 'You are a Share of Voice analyst. Always respond with valid JSON only.',
    prompt,
    temperature: 0.3,
  });

  try {
    const parsed = JSON.parse(text);
    const output = SovQueryResultSchema.parse(parsed);
    return {
      rank_position: output.rank_position !== null ? Math.max(1, output.rank_position) : null,
      mentioned_competitors: output.mentioned_competitors,
      raw_response: output.raw_response,
    };
  } catch {
    return { rank_position: null, mentioned_competitors: [], raw_response: text };
  }
}

// ---------------------------------------------------------------------------
// addTargetQuery — Server Action
// ---------------------------------------------------------------------------

/**
 * Server Action: add a new target query for a location.
 *
 * Validates input, derives org_id server-side, and inserts into target_queries.
 * The RLS INSERT policy provides a second enforcement layer.
 */
export async function addTargetQuery(input: AddQueryInput): Promise<ActionResult> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  // ── Input validation ──────────────────────────────────────────────────────
  const parsed = AddQuerySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  const { location_id, query_text } = parsed.data;

  const supabase = await createClient();

  const { error } = await supabase.from('target_queries').insert({
    org_id: ctx.orgId,
    location_id,
    query_text: query_text.trim(),
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/share-of-voice');
  return { success: true };
}

// ---------------------------------------------------------------------------
// runSovEvaluation — Server Action
// ---------------------------------------------------------------------------

/**
 * Server Action: run an on-demand Share of Voice evaluation for a target query.
 *
 * Flow:
 *  1. Authenticate and derive org_id server-side.
 *  2. Validate input via Zod.
 *  3. Fetch the query + its location's ground-truth data (RLS-scoped).
 *  4. Check for the relevant API key in process.env.
 *     • Key missing or API call fails → 3-second mock delay + mock result.
 *     • Key present → real OpenAI / Perplexity API call.
 *  5. Insert the result into sov_evaluations.
 *  6. revalidatePath to refresh the Server Component.
 *
 * SECURITY: org_id is ALWAYS sourced from getSafeAuthContext() on the server.
 */
export async function runSovEvaluation(input: RunSovInput): Promise<ActionResult> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  // ── Input validation ──────────────────────────────────────────────────────
  const parsed = RunSovSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  const { query_id, engine } = parsed.data;

  const supabase = await createClient();

  // ── Fetch query + location data (RLS-scoped) ──────────────────────────────
  const { data: queryRow, error: queryError } = await supabase
    .from('target_queries')
    .select('id, location_id, query_text, locations(id, business_name, city, state)')
    .eq('id', query_id)
    .single();

  if (queryError || !queryRow) {
    return { success: false, error: 'Query not found or access denied' };
  }

  const location = queryRow.locations as LocationData | null;
  if (!location) {
    return { success: false, error: 'Location data not found' };
  }

  // ── Run evaluation (real or mock) ─────────────────────────────────────────
  const promptText = buildSovPrompt(
    location.business_name,
    location.city,
    location.state,
    queryRow.query_text
  );

  const hasKey = hasApiKey(engine === 'openai' ? 'openai' : 'perplexity');

  let result: SovResult;

  if (!hasKey) {
    await new Promise((r) => setTimeout(r, 3000));
    result = mockSovResult(engine);
  } else {
    try {
      result =
        engine === 'openai'
          ? await callOpenAI(promptText)
          : await callPerplexity(promptText);
    } catch {
      await new Promise((r) => setTimeout(r, 3000));
      result = mockSovResult(engine);
    }
  }

  // ── Persist result ────────────────────────────────────────────────────────
  const { error: insertError } = await supabase.from('sov_evaluations').insert({
    org_id: ctx.orgId,
    location_id: queryRow.location_id,
    query_id,
    engine,
    rank_position: result.rank_position,
    mentioned_competitors: result.mentioned_competitors,
    raw_response: result.raw_response,
  });

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  revalidatePath('/dashboard/share-of-voice');
  return { success: true };
}
