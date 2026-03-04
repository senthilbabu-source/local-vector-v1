// ---------------------------------------------------------------------------
// lib/onboarding/onboarding-service.ts — Onboarding Service (Sprint 117, P0-FIX-03)
//
// Per-org onboarding checklist operations. Caller passes Supabase client.
// Service role client required for autoCompleteSteps() (reads across tables).
//
// Steps are org-scoped — any member completing a step marks it for all.
// Auto-completable steps are checked on every getOnboardingState() call.
//
// P0-FIX-03: Steps are now plan-filtered. Only steps visible for the org's
// plan are counted toward total_steps and completed_steps.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { PlanTier } from '@/lib/plan-enforcer';
import { ONBOARDING_STEPS, getVisibleSteps } from './types';
import type { OnboardingStepId, OnboardingStepState, OnboardingState } from './types';

const VALID_STEP_IDS = new Set<string>(ONBOARDING_STEPS.map((s) => s.id));
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// initOnboardingSteps — lazy init 5 rows per org
// ---------------------------------------------------------------------------

export async function initOnboardingSteps(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<void> {
  const rows = ONBOARDING_STEPS.map((step) => ({
    org_id: orgId,
    step_id: step.id,
    completed: false,
  }));

  await supabase
    .from('onboarding_steps')
    .upsert(rows, { onConflict: 'org_id,step_id', ignoreDuplicates: true });
}

// ---------------------------------------------------------------------------
// autoCompleteSteps — check real DB state for auto-completable steps
// ---------------------------------------------------------------------------

export async function autoCompleteSteps(
  supabase: SupabaseClient<Database>,
  orgId: string,
  orgPlan?: PlanTier,
): Promise<void> {
  // Fetch current step states
  const { data: steps } = await supabase
    .from('onboarding_steps')
    .select('step_id, completed')
    .eq('org_id', orgId);

  // Only check steps visible for the org's plan
  const visibleIds = new Set(
    getVisibleSteps(orgPlan ?? 'trial').map((s) => s.id),
  );

  const incomplete = (steps ?? [])
    .filter((s) => !s.completed && visibleIds.has(s.step_id as OnboardingStepId))
    .map((s) => s.step_id);

  if (incomplete.length === 0) return;

  const toComplete: OnboardingStepId[] = [];

  // Check each incomplete step
  for (const stepId of incomplete) {
    let shouldComplete = false;

    switch (stepId) {
      case 'first_scan': {
        const { count } = await supabase
          .from('sov_evaluations')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId);
        shouldComplete = (count ?? 0) > 0;
        break;
      }
      case 'first_draft': {
        const { count } = await supabase
          .from('content_drafts')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId);
        shouldComplete = (count ?? 0) > 0;
        break;
      }
      case 'invite_teammate': {
        const { count } = await supabase
          .from('memberships')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId);
        shouldComplete = (count ?? 0) > 1;
        break;
      }
      case 'connect_domain': {
        const { count } = await supabase
          .from('org_domains')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('domain_type', 'custom')
          .eq('verification_status', 'verified');
        shouldComplete = (count ?? 0) > 0;
        break;
      }
      case 'business_profile': {
        // Check org name is non-empty AND at least one location exists
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', orgId)
          .single();
        if (org?.name && org.name.trim().length > 0) {
          const { count } = await supabase
            .from('locations')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', orgId);
          shouldComplete = (count ?? 0) > 0;
        }
        break;
      }
    }

    if (shouldComplete) {
      toComplete.push(stepId as OnboardingStepId);
    }
  }

  // Batch update completed steps
  for (const stepId of toComplete) {
    await markStepComplete(supabase, orgId, stepId, null);
  }
}

// ---------------------------------------------------------------------------
// markStepComplete — idempotent step completion
// ---------------------------------------------------------------------------

export async function markStepComplete(
  supabase: SupabaseClient<Database>,
  orgId: string,
  stepId: OnboardingStepId,
  userId: string | null,
): Promise<OnboardingStepState> {
  if (!VALID_STEP_IDS.has(stepId)) {
    throw new Error(`Invalid onboarding step: ${stepId}`);
  }

  const { data, error } = await supabase
    .from('onboarding_steps')
    .update({
      completed: true,
      completed_at: new Date().toISOString(),
      completed_by_user_id: userId,
    })
    .eq('org_id', orgId)
    .eq('step_id', stepId)
    .eq('completed', false)
    .select('step_id, completed, completed_at, completed_by_user_id')
    .maybeSingle();

  // If no row was updated (already complete), fetch current state
  if (!data) {
    const { data: current } = await supabase
      .from('onboarding_steps')
      .select('step_id, completed, completed_at, completed_by_user_id')
      .eq('org_id', orgId)
      .eq('step_id', stepId)
      .single();

    if (!current) {
      throw new Error(`Onboarding step not found: ${stepId}`);
    }

    return {
      step_id: current.step_id as OnboardingStepId,
      completed: current.completed,
      completed_at: current.completed_at,
      completed_by_user_id: current.completed_by_user_id,
    };
  }

  if (error) {
    throw new Error(`Failed to mark step complete: ${(error as { message: string }).message}`);
  }

  return {
    step_id: data.step_id as OnboardingStepId,
    completed: data.completed,
    completed_at: data.completed_at,
    completed_by_user_id: data.completed_by_user_id,
  };
}

// ---------------------------------------------------------------------------
// getOnboardingState — full onboarding state for an org
// ---------------------------------------------------------------------------

export async function getOnboardingState(
  supabase: SupabaseClient<Database>,
  orgId: string,
  orgCreatedAt?: string | null,
  orgPlan?: PlanTier,
): Promise<OnboardingState> {
  // 1. Fetch steps (lazy init if none exist)
  let { data: rows } = await supabase
    .from('onboarding_steps')
    .select('step_id, completed, completed_at, completed_by_user_id')
    .eq('org_id', orgId);

  if (!rows || rows.length === 0) {
    await initOnboardingSteps(supabase, orgId);
    const refetch = await supabase
      .from('onboarding_steps')
      .select('step_id, completed, completed_at, completed_by_user_id')
      .eq('org_id', orgId);
    rows = refetch.data ?? [];
  }

  // 2. Auto-complete eligible steps (plan-filtered)
  await autoCompleteSteps(supabase, orgId, orgPlan);

  // Re-fetch after auto-complete
  const { data: updated } = await supabase
    .from('onboarding_steps')
    .select('step_id, completed, completed_at, completed_by_user_id')
    .eq('org_id', orgId);

  const allSteps: OnboardingStepState[] = (updated ?? rows).map((row) => ({
    step_id: row.step_id as OnboardingStepId,
    completed: row.completed,
    completed_at: row.completed_at,
    completed_by_user_id: row.completed_by_user_id,
  }));

  // 3. Filter to only plan-visible steps
  const visibleSteps = getVisibleSteps(orgPlan ?? 'trial');
  const visibleStepIds = new Set(visibleSteps.map((s) => s.id));
  const filteredSteps = allSteps.filter((s) => visibleStepIds.has(s.step_id));

  const completedSteps = filteredSteps.filter((s) => s.completed).length;
  const totalSteps = filteredSteps.length;
  const hasRealData = allSteps.some(
    (s) => s.step_id === 'first_scan' && s.completed,
  );

  // Determine show_interstitial: < 2 steps done AND org < 7 days old
  let showInterstitial = false;
  if (completedSteps < 2 && orgCreatedAt) {
    const created = new Date(orgCreatedAt);
    if (!isNaN(created.getTime())) {
      const ageMs = Date.now() - created.getTime();
      showInterstitial = ageMs < SEVEN_DAYS_MS;
    }
  }

  return {
    org_id: orgId,
    steps: filteredSteps,
    visible_step_ids: visibleSteps.map((s) => s.id),
    total_steps: totalSteps,
    completed_steps: completedSteps,
    is_complete: completedSteps >= totalSteps,
    show_interstitial: showInterstitial,
    has_real_data: hasRealData,
  };
}
