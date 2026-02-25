// ---------------------------------------------------------------------------
// GET /api/cron/sov — Surgery 2: SOV Engine Weekly Cron
//
// Triggered by Vercel Cron (or curl in local dev). Runs Share-of-Answer
// queries for every active org's locations and writes results to
// visibility_analytics.
//
// Architecture mirrors GET /api/cron/audit exactly:
//   • CRON_SECRET auth guard
//   • Service-role client (bypasses RLS)
//   • Per-org try/catch resilience
//   • Plan-gated (starter can run SOV; trial cannot)
//   • Rate-limited (500ms delay between Perplexity calls)
//
// Schedule: Weekly, Sunday at 2 AM EST (configured in vercel.json)
//
// Spec: docs/04c-SOV-ENGINE.md §4
//
// Required env vars:
//   CRON_SECRET              — shared secret validated below
//   SUPABASE_SERVICE_ROLE_KEY — used by createServiceRoleClient()
//   PERPLEXITY_API_KEY       — used by sov-engine.service (falls back to mock)
//
// Local dev:
//   curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/sov
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
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

// Force dynamic so Vercel never caches this route between cron invocations.
export const dynamic = 'force-dynamic';

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
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // ── 1. Auth guard ──────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. Kill switch (Doc 04c §4.1) ──────────────────────────────────────
  if (process.env.STOP_SOV_CRON === 'true') {
    console.log('[cron-sov] SOV cron halted by kill switch.');
    return NextResponse.json({ ok: true, halted: true });
  }

  // ── 3. Service-role client (bypasses RLS) ──────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceRoleClient() as any;

  // ── 4. Fetch all target queries that need running ──────────────────────
  // Only active orgs with plan_status = 'active' (excludes trials with no plan)
  // Queries not run in last 6 days (or never run) are eligible
  const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();

  const { data: queries, error: queryError } = await supabase
    .from('target_queries')
    .select(`
      id, query_text, query_category, location_id, org_id,
      locations ( business_name, city, state, categories ),
      organizations ( plan_status, plan )
    `)
    .eq('organizations.plan_status', 'active')
    .limit(500);

  if (queryError) {
    console.error('[cron-sov] Failed to fetch target queries:', queryError.message);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  if (!queries?.length) {
    console.log('[cron-sov] No eligible queries found.');
    return NextResponse.json({ ok: true, orgs_processed: 0, queries_run: 0 });
  }

  // ── 5. Group by org and enforce plan caps ──────────────────────────────
  const summary = {
    ok: true,
    orgs_processed: 0,
    orgs_failed: 0,
    queries_run: 0,
    queries_cited: 0,
    first_mover_alerts: 0,
    occasion_drafts: 0,
    gaps_detected: 0,
  };

  // Filter to valid queries (with locations and active orgs)
  const validQueries = queries.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q: any) => q.locations && q.organizations?.plan_status === 'active',
  );

  const byOrg = groupBy(validQueries, (q: SOVQueryInput) => q.org_id);

  // ── 6. Process each org ────────────────────────────────────────────────
  for (const [orgId, orgQueries] of Object.entries(byOrg)) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plan = (orgQueries[0] as any).organizations?.plan ?? 'starter';
      const queryCap = getQueryCap(plan);
      const batch = orgQueries.slice(0, queryCap);

      const results: SOVQueryResult[] = [];

      for (const query of batch) {
        try {
          const result = await runSOVQuery(query as SOVQueryInput);
          results.push(result);
          summary.queries_run++;
          if (result.ourBusinessCited) summary.queries_cited++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[cron-sov] Query "${(query as SOVQueryInput).query_text}" failed:`, msg);
        }

        // Rate limit: 500ms between Perplexity calls (Doc 04c §4.1)
        await sleep(500);
      }

      // Write aggregated results
      if (results.length > 0) {
        const { shareOfVoice, firstMoverCount } = await writeSOVResults(
          orgId,
          results,
          supabase,
        );
        summary.first_mover_alerts += firstMoverCount;

        // ── 7. Send weekly SOV report email (Doc 04c §7) ──────────────
        const { data: membershipRow } = await supabase
          .from('memberships')
          .select('users(email)')
          .eq('org_id', orgId)
          .eq('role', 'owner')
          .limit(1)
          .maybeSingle();

        const ownerEmail = (
          membershipRow?.users as { email: string } | null
        )?.email;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const businessName = (batch[0] as any).locations?.business_name ?? 'Your Business';

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
            console.error('[cron-sov] Email send failed:', err),
          );
        }

        // ── 8. Occasion Engine sub-step (Doc 16 §3.1) ────────────────────
        try {
          const locationId = batch[0].location_id;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const loc = (batch[0] as any).locations;
          const locationCategories: string[] = loc?.categories ?? ['restaurant'];
          const city = loc?.city ?? '';
          const state = loc?.state ?? '';
          const primaryCategory = locationCategories[0] ?? 'restaurant';

          const occasionResult = await runOccasionScheduler(
            orgId,
            locationId,
            locationCategories,
            plan,
            results,
            businessName,
            city,
            state,
            primaryCategory,
            supabase,
          );
          summary.occasion_drafts += occasionResult.draftsCreated;
        } catch (err) {
          const occasionMsg = err instanceof Error ? err.message : String(err);
          console.error(`[cron-sov] Occasion engine failed for org ${orgId}:`, occasionMsg);
          // Non-critical — never abort SOV cron for occasion failures
        }

        // ── 9. Prompt Intelligence sub-step (Doc 15 §3) ────────────────────
        try {
          const locationId = batch[0].location_id;
          const gaps = await detectQueryGaps(orgId, locationId, supabase);
          summary.gaps_detected += gaps.length;

          // Auto-create content drafts for zero_citation_cluster gaps (Growth+ only)
          if (canRunAutopilot(plan as PlanTier)) {
            for (const gap of gaps.filter((g) => g.gapType === 'zero_citation_cluster')) {
              await createDraft(
                {
                  triggerType: 'prompt_missing',
                  triggerId: null,
                  orgId,
                  locationId,
                  context: { zeroCitationQueries: gap.queryText.split(',').map((q: string) => q.trim()) },
                },
                supabase,
              );
            }
          }
        } catch (err) {
          const gapMsg = err instanceof Error ? err.message : String(err);
          console.error(`[cron-sov] Prompt intelligence failed for org ${orgId}:`, gapMsg);
          // Non-critical — never abort SOV cron for gap detection failures
        }
      }

      summary.orgs_processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron-sov] Org ${orgId} failed:`, msg);
      summary.orgs_failed++;
    }
  }

  // ── 10. Archive expired occasion drafts ──────────────────────────────────
  try {
    const archivedCount = await archiveExpiredOccasionDrafts(supabase);
    if (archivedCount > 0) {
      console.log(`[cron-sov] Archived ${archivedCount} expired occasion drafts`);
    }
  } catch (err) {
    const archiveMsg = err instanceof Error ? err.message : String(err);
    console.error(`[cron-sov] Occasion draft archival failed:`, archiveMsg);
    // Non-critical — never abort SOV cron for archival failures
  }

  // ── 11. Post-publish SOV re-checks ───────────────────────────────────────
  try {
    const rechecks = await getPendingRechecks();
    for (const task of rechecks) {
      try {
        const result = await runSOVQuery({
          id: task.payload.draftId,
          query_text: task.payload.targetQuery,
          query_category: 'discovery',
          location_id: task.payload.locationId,
          org_id: '',
        });
        console.log(
          `[cron-sov] Post-publish recheck for draft ${task.payload.draftId}: cited=${result.ourBusinessCited}`,
        );
        await completeRecheck(task.payload.draftId);
      } catch (recheckErr) {
        console.error(`[cron-sov] Recheck failed for draft ${task.payload.draftId}:`, recheckErr);
      }
    }
  } catch (err) {
    const recheckMsg = err instanceof Error ? err.message : String(err);
    console.error(`[cron-sov] Post-publish recheck scan failed:`, recheckMsg);
    // Non-critical — never abort SOV cron for recheck failures
  }

  console.log('[cron-sov] Run complete:', summary);
  return NextResponse.json(summary);
}
