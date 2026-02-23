'use server';

// ---------------------------------------------------------------------------
// app/dashboard/compete/actions.ts — Phase 3 Competitor Intercept Server Actions
//
// Four Server Actions for the Greed Engine:
//   addCompetitor        — add a competitor to track (plan-gated, count-limited)
//   deleteCompetitor     — remove a competitor
//   runCompetitorIntercept — delegates to competitor-intercept.service (AI_RULES §19.3)
//   markInterceptActionComplete — update action_status (pending → completed/dismissed)
//
// All actions:
//   • Derive org_id server-side via getSafeAuthContext() (AI_RULES §11)
//   • Use canRunCompetitorIntercept() + maxCompetitors() from plan-enforcer (AI_RULES §19.2)
//   • The 2-stage LLM pipeline lives in lib/services/competitor-intercept.service.ts
// ---------------------------------------------------------------------------

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { canRunCompetitorIntercept, maxCompetitors } from '@/lib/plan-enforcer';
import { runInterceptForCompetitor } from '@/lib/services/competitor-intercept.service';

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
 * Delegates the Perplexity → GPT-4o-mini pipeline to
 * lib/services/competitor-intercept.service.ts so the same logic can be
 * reused from the daily audit cron (AI_RULES §19.3).
 *
 * Flow:
 *  1. Authenticate + plan gate (canRunCompetitorIntercept)
 *  2. Fetch competitor (RLS-scoped)
 *  3. Fetch primary location for ground-truth + query generation
 *  4. Delegate to runInterceptForCompetitor (service)
 *  5. revalidatePath('/dashboard/compete')
 *
 * SECURITY: org_id always server-derived. RLS INSERT policy enforces isolation.
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

  // ── Delegate to service ───────────────────────────────────────────────────
  try {
    await runInterceptForCompetitor(
      {
        orgId:        ctx.orgId,
        locationId:   location.id,
        businessName: location.business_name,
        categories:   Array.isArray(location.categories) ? location.categories : [],
        city:         location.city,
        state:        location.state,
        competitor,
      },
      supabase,
    );
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Intercept failed' };
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
