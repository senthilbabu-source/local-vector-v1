'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import {
  RunEvaluationSchema,
  RunMultiAuditSchema,
  VerifyHallucinationSchema,
  type RunEvaluationInput,
  type RunMultiAuditInput,
  type VerifyHallucinationInput,
} from '@/lib/schemas/evaluations';
import { auditLocation, type LocationAuditInput } from '@/lib/services/ai-audit.service';
import {
  callEngine,
  runAllEngines,
  buildEvalPrompt,
  type MultiEngineEvalInput,
} from '@/lib/services/multi-engine-eval.service';

// ---------------------------------------------------------------------------
// Shared result type
// ---------------------------------------------------------------------------

export type ActionResult = { success: true } | { success: false; error: string };

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
 *  4. Delegate to callEngine() from multi-engine-eval.service (AI SDK).
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

  const supabase = await createClient();

  // ── Fetch ground-truth location data (RLS-scoped) ─────────────────────────
  const { data: location, error: locError } = (await supabase
    .from('locations')
    .select('id, business_name, address_line1, city, state, zip, phone, website_url')
    .eq('id', location_id)
    .single()) as { data: MultiEngineEvalInput | null; error: unknown };

  if (locError || !location) {
    return { success: false, error: 'Location not found or access denied' };
  }

  // ── Run evaluation via service (real or mock) ─────────────────────────────
  const promptText = buildEvalPrompt(location);
  const result = await callEngine(engine, promptText);

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

  const supabase = await createClient();

  // ── Fetch hallucination (RLS-scoped) ──────────────────────────────────────
  const { data: hallucination, error: fetchError } = await supabase
    .from('ai_hallucinations')
    .select('id, location_id, claim_text, correction_status, model_provider')
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
  // Sprint F (N3): Set verifying_since + correction_query for the follow-up cron
  await supabase
    .from('ai_hallucinations')
    .update({
      correction_status: 'verifying',
      last_seen_at: new Date().toISOString(),
      verifying_since: new Date().toISOString(),
      correction_query: hallucination.claim_text,
    })
    .eq('id', hallucination_id);

  // ── Fetch linked location ─────────────────────────────────────────────────
  if (!hallucination.location_id) {
    await supabase
      .from('ai_hallucinations')
      .update({ correction_status: 'fixed', resolved_at: new Date().toISOString() })
      .eq('id', hallucination_id);
    revalidatePath('/dashboard');
    return { success: true, newStatus: 'fixed' };
  }

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
  const freshHallucinations = await auditLocation(location as LocationAuditInput);

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

  const supabase = await createClient();

  // ── Fetch ground-truth location data (RLS-scoped) ─────────────────────────
  const { data: location, error: locError } = (await supabase
    .from('locations')
    .select('id, business_name, address_line1, city, state, zip, phone, website_url')
    .eq('id', location_id)
    .single()) as { data: MultiEngineEvalInput | null; error: unknown };

  if (locError || !location) {
    return { success: false, error: 'Location not found or access denied' };
  }

  // ── Run all 4 engines in parallel via service ──────────────────────────────
  const evaluations = await runAllEngines(location);

  if (evaluations.length === 0) {
    return { success: false, error: 'All engine evaluations failed' };
  }

  // ── Persist results ───────────────────────────────────────────────────────
  const promptText = buildEvalPrompt(location);
  let insertedCount = 0;

  for (const { engine, result } of evaluations) {
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
