// ---------------------------------------------------------------------------
// lib/autopilot/autopilot-service.ts — Autopilot Orchestrator
//
// Central orchestrator that runs all trigger detectors for a location,
// deduplicates triggers, and creates drafts in priority order.
//
// Called by: weekly autopilot cron, on-demand API route.
//
// Sprint 86 — Autopilot Engine
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { DraftTrigger, AutopilotRunResult } from '@/lib/types/autopilot';
import { canRunAutopilot } from '@/lib/plan-enforcer';
import { createDraft } from './create-draft';
import { checkDraftLimit } from './draft-limits';
import { deduplicateTriggers } from './draft-deduplicator';
import {
  detectCompetitorGapTriggers,
  detectPromptMissingTriggers,
  detectReviewGapTriggers,
  detectSchemaGapTriggers,
} from './triggers';

/**
 * Priority order for trigger types.
 * Lower number = higher priority (processed first).
 */
const TRIGGER_PRIORITY: Record<string, number> = {
  competitor_gap: 1,
  prompt_missing: 2,
  review_gap: 3,
  schema_gap: 4,
};

/**
 * Runs the full autopilot scan for a single location.
 *
 * Flow:
 * 1. Check draft limit
 * 2. Load location business context
 * 3. Run all 4 trigger detectors in parallel
 * 4. Flatten + sort by priority
 * 5. Deduplicate
 * 6. Create drafts (up to remaining limit)
 * 7. Update location tracking columns
 */
export async function runAutopilotForLocation(
  supabase: SupabaseClient<Database>,
  orgId: string,
  locationId: string,
  plan: string,
): Promise<AutopilotRunResult> {
  const result: AutopilotRunResult = {
    orgId,
    locationId,
    draftsCreated: 0,
    draftsSkippedDedup: 0,
    draftsSkippedLimit: 0,
    errors: [],
    runAt: new Date().toISOString(),
  };

  // 1. Check draft limit
  const { allowed, current, limit } = await checkDraftLimit(supabase, orgId, plan);
  if (!allowed) {
    result.draftsSkippedLimit = 1;
    return result;
  }

  // 2. Load business name for competitor gap trigger
  const { data: location } = await supabase
    .from('locations')
    .select('business_name')
    .eq('id', locationId)
    .single();

  const businessName = location?.business_name ?? 'Local Business';

  // 3. Run all trigger detectors in parallel
  const [competitorResult, promptResult, reviewResult, schemaResult] =
    await Promise.allSettled([
      detectCompetitorGapTriggers(supabase, locationId, orgId, businessName),
      detectPromptMissingTriggers(supabase, locationId, orgId),
      detectReviewGapTriggers(supabase, locationId, orgId),
      detectSchemaGapTriggers(supabase, locationId, orgId),
    ]);

  // Collect triggers, logging any detector failures
  const allTriggers: DraftTrigger[] = [];

  for (const [name, settledResult] of [
    ['competitor_gap', competitorResult],
    ['prompt_missing', promptResult],
    ['review_gap', reviewResult],
    ['schema_gap', schemaResult],
  ] as const) {
    if (settledResult.status === 'fulfilled') {
      allTriggers.push(...settledResult.value);
    } else {
      const errMsg = `Trigger detector ${name} failed: ${settledResult.reason}`;
      result.errors.push(errMsg);
      Sentry.captureException(settledResult.reason, {
        tags: { component: 'autopilot', trigger: name, sprint: '86' },
      });
    }
  }

  if (allTriggers.length === 0) {
    await updateLocationTracking(supabase, locationId);
    return result;
  }

  // 4. Sort by priority
  allTriggers.sort(
    (a, b) =>
      (TRIGGER_PRIORITY[a.triggerType] ?? 99) -
      (TRIGGER_PRIORITY[b.triggerType] ?? 99),
  );

  // 5. Deduplicate
  const dedupedTriggers = await deduplicateTriggers(allTriggers, supabase, orgId);
  result.draftsSkippedDedup = allTriggers.length - dedupedTriggers.length;

  // 6. Create drafts (up to remaining limit)
  let remaining = limit - current;

  for (const trigger of dedupedTriggers) {
    if (remaining <= 0) {
      result.draftsSkippedLimit++;
      continue;
    }

    try {
      const draft = await createDraft(trigger, supabase);
      if (draft) {
        result.draftsCreated++;
        remaining--;
      }
    } catch (err) {
      const errMsg = `Draft creation failed for ${trigger.triggerType}: ${err}`;
      result.errors.push(errMsg);
      Sentry.captureException(err, {
        tags: { component: 'autopilot', trigger: trigger.triggerType, sprint: '86' },
      });
    }
  }

  // 7. Update location tracking
  await updateLocationTracking(supabase, locationId);

  return result;
}

/**
 * Runs autopilot for ALL active Growth+ locations.
 * Called by the weekly autopilot cron.
 * Sequential processing to avoid overloading Supabase and GPT-4o-mini.
 */
export async function runAutopilotForAllOrgs(
  supabase: SupabaseClient<Database>,
): Promise<{ processed: number; draftsCreated: number; errors: number }> {
  // Fetch all Growth+ orgs
  const { data: orgs, error: orgErr } = await supabase
    .from('organizations')
    .select('id, plan')
    .in('plan', ['growth', 'agency']);

  if (orgErr || !orgs || orgs.length === 0) {
    return { processed: 0, draftsCreated: 0, errors: 0 };
  }

  let totalProcessed = 0;
  let totalDraftsCreated = 0;
  let totalErrors = 0;

  for (const org of orgs) {
    if (!canRunAutopilot(org.plan as 'growth' | 'agency')) continue;

    // Fetch active locations for this org
    const { data: locations } = await supabase
      .from('locations')
      .select('id')
      .eq('org_id', org.id)
      .eq('is_archived', false);

    if (!locations || locations.length === 0) continue;

    for (const loc of locations) {
      try {
        const result = await runAutopilotForLocation(
          supabase,
          org.id,
          loc.id,
          org.plan ?? 'trial',
        );
        totalDraftsCreated += result.draftsCreated;
        totalErrors += result.errors.length;
        totalProcessed++;
      } catch (err) {
        totalErrors++;
        Sentry.captureException(err, {
          tags: { component: 'autopilot-cron', orgId: org.id, sprint: '86' },
        });
      }
    }
  }

  return { processed: totalProcessed, draftsCreated: totalDraftsCreated, errors: totalErrors };
}

/**
 * Updates location tracking columns after an autopilot run.
 */
async function updateLocationTracking(
  supabase: SupabaseClient<Database>,
  locationId: string,
): Promise<void> {
  // Count pending drafts for this location
  const { count } = await supabase
    .from('content_drafts')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('status', 'draft');

  await supabase
    .from('locations')
    .update({
      autopilot_last_run_at: new Date().toISOString(),
      drafts_pending_count: count ?? 0,
    })
    .eq('id', locationId);
}
