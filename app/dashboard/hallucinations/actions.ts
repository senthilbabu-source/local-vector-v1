'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { generateText } from 'ai';
import { getModel, hasApiKey } from '@/lib/ai/providers';
import {
  EVALUATION_ENGINES,
  RunEvaluationSchema,
  RunMultiAuditSchema,
  VerifyHallucinationSchema,
  type RunEvaluationInput,
  type RunMultiAuditInput,
  type VerifyHallucinationInput,
  type EvaluationEngine,
} from '@/lib/schemas/evaluations';
import { auditLocation } from '@/lib/services/ai-audit.service';

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
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  website_url: string | null;
};

type EvaluationResult = {
  accuracy_score: number;
  hallucinations_detected: string[];
  response_text: string;
};

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(location: LocationData): string {
  const address = [
    location.address_line1,
    location.city,
    location.state,
    location.zip,
  ]
    .filter(Boolean)
    .join(', ');

  return `You are an AI accuracy auditor for restaurant and business data.

GROUND TRUTH (from our verified database):
- Business name: ${location.business_name}
- Address: ${address || 'not listed'}
- Phone: ${location.phone ?? 'not listed'}
- Website: ${location.website_url ?? 'not listed'}

TASK:
1. Think about what an AI assistant would say if asked about "${location.business_name}" in "${location.city ?? ''}, ${location.state ?? ''}".
2. Compare that knowledge against the GROUND TRUTH above.
3. Identify any specific inaccuracies an AI might state.

Return a JSON object with exactly these three fields:
- "accuracy_score": integer 0-100 (100 = AI knowledge perfectly matches ground truth, 0 = entirely wrong)
- "hallucinations_detected": array of strings, each describing one specific inaccuracy (empty array if none)
- "response_text": a realistic AI response a user might receive when asking about this business

Return only valid JSON. No markdown, no explanation outside the JSON object.`;
}

// ---------------------------------------------------------------------------
// Mock fallback — used when API key is absent or the API call fails
// ---------------------------------------------------------------------------

const ENGINE_KEY_NAMES: Record<EvaluationEngine, string> = {
  openai: 'OPENAI_API_KEY',
  perplexity: 'PERPLEXITY_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GOOGLE_GENERATIVE_AI_API_KEY',
};

function mockResult(engine: EvaluationEngine): EvaluationResult {
  return {
    accuracy_score: 80,
    hallucinations_detected: [
      `Mock evaluation — no ${ENGINE_KEY_NAMES[engine]} is configured in .env.local.`,
      'Set the API key and re-run the audit to get real results.',
    ],
    response_text: `[MOCK] Simulated ${engine} response. Configure the API key to run a real audit.`,
  };
}

// Engine → hasApiKey provider mapping
const ENGINE_PROVIDER: Record<EvaluationEngine, 'openai' | 'perplexity' | 'anthropic' | 'google'> = {
  openai: 'openai',
  perplexity: 'perplexity',
  anthropic: 'anthropic',
  gemini: 'google',
};

// ---------------------------------------------------------------------------
// OpenAI API call
// ---------------------------------------------------------------------------

async function callOpenAI(
  prompt: string,
  apiKey: string
): Promise<EvaluationResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const content: string = json.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content);

  return {
    accuracy_score: Math.min(100, Math.max(0, Number(parsed.accuracy_score ?? 0))),
    hallucinations_detected: Array.isArray(parsed.hallucinations_detected)
      ? (parsed.hallucinations_detected as string[])
      : [],
    response_text: String(parsed.response_text ?? content),
  };
}

// ---------------------------------------------------------------------------
// Perplexity API call
// ---------------------------------------------------------------------------

async function callPerplexity(
  prompt: string,
  apiKey: string
): Promise<EvaluationResult> {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: 'You are an AI accuracy auditor. Always respond with valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    throw new Error(`Perplexity API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const content: string = json.choices?.[0]?.message?.content ?? '{}';

  // Perplexity may wrap JSON in markdown fences — extract the raw object
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

  return {
    accuracy_score: Math.min(100, Math.max(0, Number(parsed.accuracy_score ?? 0))),
    hallucinations_detected: Array.isArray(parsed.hallucinations_detected)
      ? (parsed.hallucinations_detected as string[])
      : [],
    response_text: String(parsed.response_text ?? content),
  };
}

// ---------------------------------------------------------------------------
// callEngine — Unified Vercel AI SDK helper for all 4 engines
// ---------------------------------------------------------------------------

/**
 * Calls a single AI engine via Vercel AI SDK generateText().
 * Falls back to mockResult() if the API key is missing or the call fails.
 */
async function callEngine(
  engine: EvaluationEngine,
  prompt: string,
): Promise<EvaluationResult> {
  const provider = ENGINE_PROVIDER[engine];

  if (!hasApiKey(provider)) {
    await new Promise((r) => setTimeout(r, 3000));
    return mockResult(engine);
  }

  try {
    const modelKey = `truth-audit-${engine}` as const;
    const { text } = await generateText({
      model: getModel(modelKey),
      prompt,
    });

    // Extract JSON from potential markdown fences
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return {
      accuracy_score: Math.min(100, Math.max(0, Number(parsed.accuracy_score ?? 0))),
      hallucinations_detected: Array.isArray(parsed.hallucinations_detected)
        ? (parsed.hallucinations_detected as string[])
        : [],
      response_text: String(parsed.response_text ?? text),
    };
  } catch {
    await new Promise((r) => setTimeout(r, 3000));
    return mockResult(engine);
  }
}

// ---------------------------------------------------------------------------
// runAIEvaluation — Server Action (single engine, backwards compatible)
// ---------------------------------------------------------------------------

/**
 * Server Action: trigger an on-demand AI accuracy evaluation for a location.
 *
 * Flow:
 *  1. Authenticate and derive org_id server-side (never from the client).
 *  2. Validate input via Zod.
 *  3. Fetch the location's ground-truth data from the DB (RLS-scoped).
 *  4. Check for the relevant API key in process.env.
 *     • Key missing or API call fails → 3-second mock delay + mock result.
 *     • Key present → real OpenAI / Perplexity API call.
 *  5. Insert the result into ai_evaluations.
 *  6. revalidatePath('/dashboard/hallucinations') to refresh the Server Component.
 *
 * SECURITY: org_id is ALWAYS sourced from getSafeAuthContext() on the server.
 * The org_isolation_insert RLS policy on ai_evaluations provides a second
 * enforcement layer — a mismatched org_id is silently rejected by Postgres.
 */
export async function runAIEvaluation(
  input: RunEvaluationInput
): Promise<ActionResult> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  // ── Input validation ──────────────────────────────────────────────────────
  const parsed = RunEvaluationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  const { location_id, engine } = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  // ── Fetch ground-truth location data (RLS-scoped) ─────────────────────────
  const { data: location, error: locError } = (await supabase
    .from('locations')
    .select('id, business_name, address_line1, city, state, zip, phone, website_url')
    .eq('id', location_id)
    .single()) as { data: LocationData | null; error: unknown };

  if (locError || !location) {
    return { success: false, error: 'Location not found or access denied' };
  }

  // ── Run evaluation (real or mock) ─────────────────────────────────────────
  const promptText = buildPrompt(location);
  const apiKey =
    engine === 'openai'
      ? process.env.OPENAI_API_KEY
      : process.env.PERPLEXITY_API_KEY;

  let result: EvaluationResult;

  if (!apiKey) {
    // Graceful fallback: simulate the LLM delay so the UI loading state is
    // visible and testable without any API keys configured.
    await new Promise((r) => setTimeout(r, 3000));
    result = mockResult(engine);
  } else {
    try {
      result =
        engine === 'openai'
          ? await callOpenAI(promptText, apiKey)
          : await callPerplexity(promptText, apiKey);
    } catch {
      // Real API call failed — degrade gracefully rather than crashing the UI.
      await new Promise((r) => setTimeout(r, 3000));
      result = mockResult(engine);
    }
  }

  // ── Persist result ────────────────────────────────────────────────────────
  // org_id is always server-derived — never from the client.
  const { error: insertError } = await supabase.from('ai_evaluations').insert({
    org_id: ctx.orgId,
    location_id,
    engine,
    prompt_used: promptText,
    response_text: result.response_text,
    accuracy_score: result.accuracy_score,
    hallucinations_detected: result.hallucinations_detected,
  });

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  revalidatePath('/dashboard/hallucinations');
  return { success: true };
}

// ---------------------------------------------------------------------------
// verifyHallucinationFix
// ---------------------------------------------------------------------------

export type VerifyResult =
  | { success: true; newStatus: 'fixed' | 'open' }
  | { success: false; error: string; retryAfterSeconds?: number };

/**
 * Server Action: re-run the AI audit for a specific hallucination to check
 * whether the fix has propagated.
 *
 * Flow:
 *  1. Authenticate and derive org_id server-side.
 *  2. Validate input via VerifyHallucinationSchema.
 *  3. Fetch the hallucination by ID (RLS-scoped — org isolation is automatic).
 *  4. Cooldown check: if correction_status === 'verifying', return 429-equivalent
 *     to prevent rapid re-checks during the AI propagation window.
 *  5. Mark the hallucination as 'verifying' and refresh last_seen_at.
 *  6. Fetch the linked location for ground-truth data.
 *  7. Call auditLocation() to get a fresh AI opinion.
 *  8. Compare results: if any returned hallucination's claim_text loosely
 *     matches the original, mark 'open'; otherwise mark 'fixed'.
 *  9. Persist the new correction_status (and resolved_at if fixed).
 * 10. revalidatePath('/dashboard') so the AlertFeed and Reality Score refresh.
 *
 * SECURITY: org_id is derived server-side. RLS on ai_hallucinations ensures
 * the authenticated user can only read/update their own org's rows.
 *
 * API contract reference: Doc 05 Section 1.1 — 24h cooldown rule.
 */
export async function verifyHallucinationFix(
  input: VerifyHallucinationInput
): Promise<VerifyResult> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  // ── Input validation ──────────────────────────────────────────────────────
  const parsed = VerifyHallucinationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  const { hallucination_id } = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  // ── Fetch hallucination (RLS-scoped) ──────────────────────────────────────
  const { data: hallucination, error: fetchError } = await supabase
    .from('ai_hallucinations')
    .select('id, location_id, claim_text, correction_status')
    .eq('id', hallucination_id)
    .single();

  if (fetchError || !hallucination) {
    return { success: false, error: 'Hallucination not found or access denied' };
  }

  // ── Cooldown check ────────────────────────────────────────────────────────
  // If correction_status is already 'verifying', the previous check is still
  // in the AI propagation window. Enforce a 24h cooldown.
  if (hallucination.correction_status === 'verifying') {
    return {
      success: false,
      error: 'Verification cooldown active. AI models need 24 hours to update.',
      retryAfterSeconds: 86400,
    };
  }

  // ── Mark as verifying ─────────────────────────────────────────────────────
  await supabase
    .from('ai_hallucinations')
    .update({
      correction_status: 'verifying',
      last_seen_at: new Date().toISOString(),
    })
    .eq('id', hallucination_id);

  // ── Fetch linked location ─────────────────────────────────────────────────
  const { data: location, error: locError } = await supabase
    .from('locations')
    .select('id, org_id, business_name, city, state, address_line1, hours_data, amenities')
    .eq('id', hallucination.location_id)
    .single();

  if (locError || !location) {
    // Location gone — treat as fixed (no longer detectable)
    await supabase
      .from('ai_hallucinations')
      .update({ correction_status: 'fixed', resolved_at: new Date().toISOString() })
      .eq('id', hallucination_id);
    revalidatePath('/dashboard');
    return { success: true, newStatus: 'fixed' };
  }

  // ── Re-run audit ──────────────────────────────────────────────────────────
  const freshHallucinations = await auditLocation(location);

  // ── Determine new status ──────────────────────────────────────────────────
  // If any returned hallucination's claim_text loosely matches the original,
  // the issue is still present → keep as 'open'. Otherwise → 'fixed'.
  const originalClaimLower = (hallucination.claim_text as string).toLowerCase();
  const stillPresent = freshHallucinations.some((h) =>
    h.claim_text.toLowerCase().includes(originalClaimLower.slice(0, 20))
  );

  const newStatus: 'fixed' | 'open' = stillPresent ? 'open' : 'fixed';

  const updatePayload: Record<string, unknown> = {
    correction_status: newStatus,
    last_seen_at: new Date().toISOString(),
  };
  if (newStatus === 'fixed') {
    updatePayload.resolved_at = new Date().toISOString();
  }

  await supabase
    .from('ai_hallucinations')
    .update(updatePayload)
    .eq('id', hallucination_id);

  revalidatePath('/dashboard');
  return { success: true, newStatus };
}

// ---------------------------------------------------------------------------
// runMultiEngineEvaluation — Server Action (all 4 engines in parallel)
// ---------------------------------------------------------------------------

/**
 * Server Action: trigger a multi-engine Truth Audit for a location.
 *
 * Runs all 4 engines (openai, perplexity, anthropic, gemini) in parallel
 * using Promise.allSettled so one failure doesn't block the others.
 * Each engine result is persisted as a separate ai_evaluations row.
 */
export async function runMultiEngineEvaluation(
  input: RunMultiAuditInput,
): Promise<ActionResult> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  // ── Input validation ──────────────────────────────────────────────────────
  const parsed = RunMultiAuditSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  const { location_id } = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  // ── Fetch ground-truth location data (RLS-scoped) ─────────────────────────
  const { data: location, error: locError } = (await supabase
    .from('locations')
    .select('id, business_name, address_line1, city, state, zip, phone, website_url')
    .eq('id', location_id)
    .single()) as { data: LocationData | null; error: unknown };

  if (locError || !location) {
    return { success: false, error: 'Location not found or access denied' };
  }

  // ── Run all 4 engines in parallel ─────────────────────────────────────────
  const promptText = buildPrompt(location);

  const results = await Promise.allSettled(
    EVALUATION_ENGINES.map(async (engine) => {
      const result = await callEngine(engine, promptText);
      return { engine, result };
    }),
  );

  // ── Persist results ───────────────────────────────────────────────────────
  let insertedCount = 0;

  for (const settled of results) {
    if (settled.status !== 'fulfilled') continue;

    const { engine, result } = settled.value;
    const { error: insertError } = await supabase.from('ai_evaluations').insert({
      org_id: ctx.orgId,
      location_id,
      engine,
      prompt_used: promptText,
      response_text: result.response_text,
      accuracy_score: result.accuracy_score,
      hallucinations_detected: result.hallucinations_detected,
    });

    if (!insertError) insertedCount++;
  }

  if (insertedCount === 0) {
    return { success: false, error: 'All engine evaluations failed' };
  }

  revalidatePath('/dashboard/hallucinations');
  return { success: true };
}
