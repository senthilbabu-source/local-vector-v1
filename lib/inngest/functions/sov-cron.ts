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
import { withTimeout } from '../timeout';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  runSOVQuery,
  runMultiModelSOVQuery,
  writeSOVResults,
  extractSOVSentiment,
  writeSentimentData,
  sleep,
  type SOVQueryInput,
  type SOVQueryResult,
} from '@/lib/services/sov-engine.service';
import { sendWeeklyDigest, sendFreshnessAlert } from '@/lib/email';
import { fetchFreshnessAlerts } from '@/lib/data/freshness-alerts';
import { runOccasionScheduler } from '@/lib/services/occasion-engine.service';
import { detectQueryGaps } from '@/lib/services/prompt-intelligence.service';
import { canRunAutopilot, canRunMultiModelSOV, type PlanTier } from '@/lib/plan-enforcer';
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
  const supabase = createServiceRoleClient();
  const results: SOVQueryResult[] = [];
  let queriesCited = 0;

  // Run queries sequentially with rate limiting.
  // Growth/Agency orgs get multi-model (Perplexity + OpenAI); Starter gets single-model.
  const useMultiModel = canRunMultiModelSOV(batch.plan as PlanTier);

  for (const query of batch.queries) {
    try {
      if (useMultiModel) {
        const multiResults = await runMultiModelSOVQuery(query);
        results.push(...multiResults);
        if (multiResults.some((r) => r.ourBusinessCited)) queriesCited++;
      } else {
        const result = await runSOVQuery(query);
        results.push(result);
        if (result.ourBusinessCited) queriesCited++;
      }
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
  const { shareOfVoice, firstMoverCount, evaluationIds } = await writeSOVResults(
    batch.orgId,
    results,
    supabase,
  );

  // Sprint 81: Sentiment extraction (non-critical, runs after SOV data is safe)
  try {
    const businessName = batch.queries[0].locations?.business_name ?? '';
    if (businessName && evaluationIds.length > 0) {
      const sentimentMap = await extractSOVSentiment(
        evaluationIds.map(e => ({ evaluationId: e.id, rawResponse: e.rawResponse, engine: e.engine })),
        businessName,
      );
      await writeSentimentData(supabase, sentimentMap);
    }
  } catch (err) {
    const sentimentMsg = err instanceof Error ? err.message : String(err);
    console.error(`[inngest-sov] Sentiment extraction failed for org ${batch.orgId}:`, sentimentMsg);
  }

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

  const businessName = batch.queries[0].locations?.business_name ?? 'Your Business';

  if (ownerEmail) {
    // Compute SOV delta from visibility_analytics
    const { data: prevVis } = await supabase
      .from('visibility_analytics')
      .select('share_of_voice')
      .eq('org_id', batch.orgId)
      .order('snapshot_date', { ascending: false })
      .limit(2);
    const visRows = prevVis ?? [];
    const sovDelta = visRows.length >= 2 && visRows[0] && visRows[1]
      ? (visRows[0].share_of_voice ?? 0) - (visRows[1].share_of_voice ?? 0)
      : null;

    // Find top competitor from recent evaluations
    const { data: recentEvals } = await supabase
      .from('sov_evaluations')
      .select('mentioned_competitors')
      .eq('org_id', batch.orgId)
      .order('created_at', { ascending: false })
      .limit(50);
    const competitorCounts: Record<string, number> = {};
    for (const ev of recentEvals ?? []) {
      for (const c of (ev.mentioned_competitors as string[] | null) ?? []) {
        competitorCounts[c] = (competitorCounts[c] ?? 0) + 1;
      }
    }
    const topCompetitor = Object.entries(competitorCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const citedCount = results.filter((r) => r.ourBusinessCited).length;
    const citationRate = results.length > 0
      ? Math.round((citedCount / results.length) * 100)
      : null;

    await sendWeeklyDigest({
      to: ownerEmail,
      businessName,
      shareOfVoice: Math.round(shareOfVoice),
      queriesRun: results.length,
      queriesCited: citedCount,
      firstMoverCount,
      dashboardUrl: 'https://app.localvector.ai/dashboard/share-of-voice',
      sovDelta,
      topCompetitor,
      citationRate,
    }).catch((err: unknown) =>
      console.error('[inngest-sov] Email send failed:', err),
    );
  }

  // Occasion Engine sub-step (non-critical)
  try {
    const locationId = batch.queries[0].location_id;
    const loc = batch.queries[0].locations as { business_name: string; city: string | null; state: string | null; categories?: string[] } | undefined;
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

  // Content Freshness Decay check (non-critical, Sprint 76)
  try {
    const freshness = await fetchFreshnessAlerts(supabase, batch.orgId);
    if (freshness.alerts.length > 0 && ownerEmail) {
      const { data: orgRow } = await supabase
        .from('organizations')
        .select('notify_sov_alerts')
        .eq('id', batch.orgId)
        .single();

      if (orgRow?.notify_sov_alerts) {
        const topAlert = freshness.alerts[0];
        await sendFreshnessAlert({
          to: ownerEmail,
          businessName,
          dropPercentage: topAlert.dropPercentage,
          previousRate: topAlert.previousRate,
          currentRate: topAlert.currentRate,
          dashboardUrl: 'https://app.localvector.ai/dashboard',
        }).catch((err: unknown) =>
          console.error('[inngest-sov] Freshness alert email failed:', err),
        );
      }
    }
  } catch {
    // Freshness check is non-critical
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
    retries: 2,
  },
  { event: 'cron/sov.weekly' },
  async ({ step }) => {
    const startedAt = new Date().toISOString();
    const t0 = Date.now();

    // Step 1: Fetch all eligible queries, group by org
    const orgBatches = await step.run('fetch-eligible-queries', async () => {
      const supabase = createServiceRoleClient();

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
      const validQueries = queries.filter(
        (q) => q.locations && q.organizations?.plan_status === 'active',
      );

      const byOrg = groupBy(validQueries, (q: SOVQueryInput) => q.org_id);

      return Object.entries(byOrg).map(([orgId, orgQueries]) => {
        const plan = orgQueries[0].organizations?.plan ?? 'starter';
        const queryCap = getQueryCap(plan);
        return {
          orgId,
          plan,
          queries: orgQueries.slice(0, queryCap),
        } as OrgBatch;
      });
    });

    if (!orgBatches.length) {
      return {
        function_id: 'sov-weekly-cron',
        event_name: 'cron/sov.weekly',
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - t0,
        orgs_processed: 0,
        queries_run: 0,
      };
    }

    // Step 2: Fan out — one step per org (55s timeout per step)
    const orgResults = await Promise.all(
      orgBatches.map((batch) =>
        step.run(`sov-org-${batch.orgId}`, async () => {
          return await withTimeout(() => processOrgSOV(batch));
        }),
      ),
    );

    // Step 3: Archive expired occasion drafts (non-critical)
    await step.run('archive-expired-drafts', async () => {
      try {
        const supabase = createServiceRoleClient();
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
    const summary = {
      function_id: 'sov-weekly-cron',
      event_name: 'cron/sov.weekly',
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - t0,
      orgs_processed: orgResults.filter((r) => r.success).length,
      orgs_failed: orgResults.filter((r) => !r.success).length,
      queries_run: orgResults.reduce((sum, r) => sum + r.queriesRun, 0),
      queries_cited: orgResults.reduce((sum, r) => sum + r.queriesCited, 0),
      first_mover_alerts: orgResults.reduce((sum, r) => sum + r.firstMoverAlerts, 0),
      occasion_drafts: orgResults.reduce((sum, r) => sum + r.occasionDrafts, 0),
      gaps_detected: orgResults.reduce((sum, r) => sum + r.gapsDetected, 0),
    };

    console.log('[inngest-sov] Run complete:', JSON.stringify(summary));
    return summary;
  },
);
