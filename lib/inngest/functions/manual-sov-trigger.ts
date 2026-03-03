// ---------------------------------------------------------------------------
// lib/inngest/functions/manual-sov-trigger.ts — P1-FIX-05
//
// Inngest function for on-demand single-org SOV scan. Triggered by the
// POST /api/sov/trigger-manual route when a Growth/Agency user clicks
// "Check AI Mentions Now".
//
// Reuses processOrgSOV() from the weekly cron function (sov-cron.ts).
// Updates organizations.manual_scan_status through the lifecycle:
//   NULL → pending (set by API route) → running → complete/failed → NULL
// ---------------------------------------------------------------------------

import { inngest } from '../client';
import * as Sentry from '@sentry/nextjs';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { processOrgSOV, type OrgBatch } from './sov-cron';
import { canRunMultiModelSOV, type PlanTier } from '@/lib/plan-enforcer';
import type { SOVQueryInput } from '@/lib/services/sov-engine.service';

// Plan-based query caps (mirrors sov-cron.ts)
function getQueryCap(plan: string): number {
  switch (plan) {
    case 'starter': return 15;
    case 'growth':  return 30;
    case 'agency':  return 100;
    default:        return 15;
  }
}

export const manualSOVTriggerFunction = inngest.createFunction(
  {
    id: 'manual-sov-trigger',
    retries: 1,
  },
  { event: 'manual/sov.triggered' },
  async ({ event, step }) => {
    const { orgId } = event.data;

    // Step 1: Fetch this org's queries and build the batch
    const batch = await step.run('fetch-org-queries', async () => {
      const supabase = createServiceRoleClient();

      const { data: org } = await supabase
        .from('organizations')
        .select('plan')
        .eq('id', orgId)
        .single();

      const plan = (org?.plan as string) ?? 'starter';
      const queryCap = getQueryCap(plan);

      const { data: queries, error } = await supabase
        .from('target_queries')
        .select(`
          id, query_text, query_category, location_id, org_id,
          locations ( business_name, city, state, categories )
        `)
        .eq('org_id', orgId)
        .eq('is_active', true)
        .limit(queryCap);

      if (error) {
        Sentry.captureException(new Error(`Manual SOV fetch error: ${error.message}`), {
          tags: { orgId },
        });
        return null;
      }

      const validQueries = (queries ?? []).filter((q) => q.locations);
      if (validQueries.length === 0) return null;

      return {
        orgId,
        plan,
        queries: validQueries as unknown as SOVQueryInput[],
      } satisfies OrgBatch;
    });

    if (!batch) {
      // No queries — mark failed and return
      await step.run('mark-failed-no-queries', async () => {
        const supabase = createServiceRoleClient();
        await supabase
          .from('organizations')
          .update({ manual_scan_status: 'failed' })
          .eq('id', orgId);
      });
      return { success: false, reason: 'no_queries' };
    }

    // Step 2: Mark running
    await step.run('mark-running', async () => {
      const supabase = createServiceRoleClient();
      await supabase
        .from('organizations')
        .update({ manual_scan_status: 'running' })
        .eq('id', orgId);
    });

    // Step 3: Run the full-org SOV scan (reuse processOrgSOV from weekly cron)
    let result;
    try {
      result = await step.run('run-sov', async () => {
        return await processOrgSOV(batch);
      });
    } catch (err) {
      Sentry.captureException(err, { tags: { orgId, function: 'manual-sov-trigger' } });
      await step.run('mark-failed-error', async () => {
        const supabase = createServiceRoleClient();
        await supabase
          .from('organizations')
          .update({ manual_scan_status: 'failed' })
          .eq('id', orgId);
      });
      return { success: false, reason: 'processing_error' };
    }

    // Step 4: Mark complete
    await step.run('mark-complete', async () => {
      const supabase = createServiceRoleClient();
      await supabase
        .from('organizations')
        .update({
          manual_scan_status: result.success ? 'complete' : 'failed',
        })
        .eq('id', orgId);
    });

    return result;
  },
);
