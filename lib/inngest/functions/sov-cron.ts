// ---------------------------------------------------------------------------
// lib/inngest/functions/sov-cron.ts — SOV Weekly Fan-Out Function
//
// Replaces the sequential for...of loop in app/api/cron/sov/route.ts with
// an Inngest step function that fans out per org. Each org gets its own
// Inngest step with independent timeout + retry.
//
// Event: 'cron/sov.weekly' (dispatched by Vercel Cron → SOV route)
//
// Architecture:
//   Step 1: fetch-eligible-queries — one DB call, group by org
//   Step 2: sov-org-{orgId}       — fan-out per org (parallel, max 3)
//   Step 3: archive-expired-drafts — post-processing
//   Step 4: post-publish-rechecks  — scheduled re-checks
//
// Services are pure — no service code changes. createServiceRoleClient()
// is called inside each step (cannot serialize across step boundaries).
// ---------------------------------------------------------------------------

import { inngest } from '../client';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  runSOVQuery,
  writeSOVResults,
  sleep,
  type SOVQueryInput,
  type SOVQueryResult,
} from '@/lib/services/sov-engine.service';
import { sendSOVReport } from '@/lib/email';
import { runOccasionScheduler } from '@/lib/services/occasion-engine.service';
import { detectQueryGaps } from '@/lib/services/prompt-intelligence.service';
import { canRunAutopilot, type PlanTier } from '@/lib/plan-enforcer';
import { createDraft, archiveExpiredOccasionDrafts } from '@/lib/autopilot/create-draft';
import { getPendingRechecks, completeRecheck } from '@/lib/autopilot/post-publish';

// ---------------------------------------------------------------------------
// Plan-based query caps (Doc 04c §4.1)
// ---------------------------------------------------------------------------

function getQueryCap(plan: string): number {
  switch (plan) {
    case 'starter': return 15;
    case 'growth':  return 30;
    case 'agency':  return 100;
    default:        return 15;
  }
}

// ---------------------------------------------------------------------------
// Group helper
// ---------------------------------------------------------------------------

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Per-org processor — exported for testability
// ---------------------------------------------------------------------------

export interface OrgBatch {
  orgId: string;
  plan: string;
  queries: SOVQueryInput[];
}

export interface OrgSOVResult {
  success: boolean;
  queriesRun: number;
  queriesCited: number;
  firstMoverAlerts: number;
  occasionDrafts: number;
  gapsDetected: number;
}

export async function processOrgSOV(batch: OrgBatch): Promise<OrgSOVResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceRoleClient() as any;
  const results: SOVQueryResult[] = [];
  let queriesCited = 0;

  // Run queries sequentially with rate limiting
  for (const query of batch.queries) {
    try {
      const result = await runSOVQuery(query);
      results.push(result);
      if (result.ourBusinessCited) queriesCited++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[inngest-sov] Query "${query.query_text}" failed:`, msg);
    }
    await sleep(500);
  }

  if (results.length === 0) {
    return {
      success: false,
      queriesRun: 0,
      queriesCited: 0,
      firstMoverAlerts: 0,
      occasionDrafts: 0,
      gapsDetected: 0,
    };
  }

  // Write aggregated results
  const { shareOfVoice, firstMoverCount } = await writeSOVResults(
    batch.orgId,
    results,
    supabase,
  );

  let occasionDrafts = 0;
  let gapsDetected = 0;

  // Send weekly SOV report email (fire-and-forget)
  const { data: membershipRow } = await supabase
    .from('memberships')
    .select('users(email)')
    .eq('org_id', batch.orgId)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle();

  const ownerEmail = (
    membershipRow?.users as { email: string } | null
  )?.email;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessName = (batch.queries[0] as any).locations?.business_name ?? 'Your Business';

  if (ownerEmail) {
    await sendSOVReport({
      to: ownerEmail,
      businessName,
      shareOfVoice: Math.round(shareOfVoice),
      queriesRun: results.length,
      queriesCited: results.filter((r) => r.ourBusinessCited).length,
      firstMoverCount,
      dashboardUrl: 'https://app.localvector.ai/dashboard/share-of-voice',
    }).catch((err: unknown) =>
      console.error('[inngest-sov] Email send failed:', err),
    );
  }

  // Occasion Engine sub-step (non-critical)
  try {
    const locationId = batch.queries[0].location_id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const loc = (batch.queries[0] as any).locations;
    const locationCategories: string[] = loc?.categories ?? ['restaurant'];
    const city = loc?.city ?? '';
    const state = loc?.state ?? '';
    const primaryCategory = locationCategories[0] ?? 'restaurant';

    const occasionResult = await runOccasionScheduler(
      batch.orgId,
      locationId,
      locationCategories,
      batch.plan,
      results,
      businessName,
      city,
      state,
      primaryCategory,
      supabase,
    );
    occasionDrafts = occasionResult.draftsCreated;
  } catch (err) {
    const occasionMsg = err instanceof Error ? err.message : String(err);
    console.error(`[inngest-sov] Occasion engine failed for org ${batch.orgId}:`, occasionMsg);
  }

  // Prompt Intelligence sub-step (non-critical)
  try {
    const locationId = batch.queries[0].location_id;
    const gaps = await detectQueryGaps(batch.orgId, locationId, supabase);
    gapsDetected = gaps.length;

    if (canRunAutopilot(batch.plan as PlanTier)) {
      for (const gap of gaps.filter((g) => g.gapType === 'zero_citation_cluster')) {
        await createDraft(
          {
            triggerType: 'prompt_missing',
            triggerId: null,
            orgId: batch.orgId,
            locationId,
            context: { zeroCitationQueries: gap.queryText.split(',').map((q: string) => q.trim()) },
          },
          supabase,
        );
      }
    }
  } catch (err) {
    const gapMsg = err instanceof Error ? err.message : String(err);
    console.error(`[inngest-sov] Prompt intelligence failed for org ${batch.orgId}:`, gapMsg);
  }

  return {
    success: true,
    queriesRun: results.length,
    queriesCited,
    firstMoverAlerts: firstMoverCount,
    occasionDrafts,
    gapsDetected,
  };
}

// ---------------------------------------------------------------------------
// Inngest function definition
// ---------------------------------------------------------------------------

export const sovCronFunction = inngest.createFunction(
  {
    id: 'sov-weekly-cron',
    concurrency: { limit: 3 },
    retries: 3,
  },
  { event: 'cron/sov.weekly' },
  async ({ step }) => {
    // Step 1: Fetch all eligible queries, group by org
    const orgBatches = await step.run('fetch-eligible-queries', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createServiceRoleClient() as any;

      const { data: queries, error } = await supabase
        .from('target_queries')
        .select(`
          id, query_text, query_category, location_id, org_id,
          locations ( business_name, city, state, categories ),
          organizations ( plan_status, plan )
        `)
        .eq('organizations.plan_status', 'active')
        .limit(500);

      if (error) throw new Error(`DB error: ${error.message}`);
      if (!queries?.length) return [];

      // Filter to valid queries
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const validQueries = queries.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (q: any) => q.locations && q.organizations?.plan_status === 'active',
      );

      const byOrg = groupBy(validQueries, (q: SOVQueryInput) => q.org_id);

      return Object.entries(byOrg).map(([orgId, orgQueries]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const plan = (orgQueries[0] as any).organizations?.plan ?? 'starter';
        const queryCap = getQueryCap(plan);
        return {
          orgId,
          plan,
          queries: orgQueries.slice(0, queryCap),
        } as OrgBatch;
      });
    });

    if (!orgBatches.length) {
      return { orgs_processed: 0, queries_run: 0 };
    }

    // Step 2: Fan out — one step per org
    const orgResults = await Promise.all(
      orgBatches.map((batch) =>
        step.run(`sov-org-${batch.orgId}`, async () => {
          return await processOrgSOV(batch);
        }),
      ),
    );

    // Step 3: Archive expired occasion drafts (non-critical)
    await step.run('archive-expired-drafts', async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabase = createServiceRoleClient() as any;
        const archivedCount = await archiveExpiredOccasionDrafts(supabase);
        if (archivedCount > 0) {
          console.log(`[inngest-sov] Archived ${archivedCount} expired occasion drafts`);
        }
        return { archived: archivedCount };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[inngest-sov] Occasion draft archival failed:`, msg);
        return { archived: 0 };
      }
    });

    // Step 4: Post-publish SOV re-checks (non-critical)
    await step.run('post-publish-rechecks', async () => {
      try {
        const rechecks = await getPendingRechecks();
        for (const task of rechecks) {
          try {
            if (!task.payload.targetQuery) continue;
            const result = await runSOVQuery({
              id: task.payload.draftId,
              query_text: task.payload.targetQuery,
              query_category: 'discovery',
              location_id: task.payload.locationId,
              org_id: '',
              locations: { business_name: '', city: null, state: null },
            });
            console.log(
              `[inngest-sov] Post-publish recheck for draft ${task.payload.draftId}: cited=${result.ourBusinessCited}`,
            );
            await completeRecheck(task.payload.draftId);
          } catch (recheckErr) {
            console.error(`[inngest-sov] Recheck failed for draft ${task.payload.draftId}:`, recheckErr);
          }
        }
        return { rechecks: rechecks.length };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[inngest-sov] Post-publish recheck scan failed:`, msg);
        return { rechecks: 0 };
      }
    });

    // Aggregate summary
    return {
      orgs_processed: orgResults.filter((r) => r.success).length,
      orgs_failed: orgResults.filter((r) => !r.success).length,
      queries_run: orgResults.reduce((sum, r) => sum + r.queriesRun, 0),
      queries_cited: orgResults.reduce((sum, r) => sum + r.queriesCited, 0),
      first_mover_alerts: orgResults.reduce((sum, r) => sum + r.firstMoverAlerts, 0),
      occasion_drafts: orgResults.reduce((sum, r) => sum + r.occasionDrafts, 0),
      gaps_detected: orgResults.reduce((sum, r) => sum + r.gapsDetected, 0),
    };
  },
);
