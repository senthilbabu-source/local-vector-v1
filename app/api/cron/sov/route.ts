// ---------------------------------------------------------------------------
// GET /api/cron/sov — SOV Engine Weekly Cron (Inngest Dispatcher)
//
// Triggered by Vercel Cron. Dispatches to Inngest for fan-out processing.
// Falls back to inline execution if Inngest is unavailable (AI_RULES §17).
//
// Architecture:
//   • CRON_SECRET auth guard
//   • Kill switch (STOP_SOV_CRON)
//   • Primary: Inngest event dispatch → fan-out per org
//   • Fallback: Inline sequential loop (original architecture)
//
// Schedule: Weekly, Sunday at 2 AM EST (configured in vercel.json)
// Spec: docs/04c-SOV-ENGINE.md §4
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  runSOVQuery,
  runMultiModelSOVQuery,
  writeSOVResults,
  extractSOVSentiment,
  writeSentimentData,
  extractSOVSourceMentions,
  writeSourceMentions,
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
import { inngest } from '@/lib/inngest/client';
import { logCronStart, logCronComplete, logCronFailed } from '@/lib/services/cron-logger';

// Force dynamic so Vercel never caches this route between cron invocations.
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Helpers (used by inline fallback)
// ---------------------------------------------------------------------------

function getQueryCap(plan: string): number {
  switch (plan) {
    case 'starter': return 15;
    case 'growth':  return 30;
    case 'agency':  return 100;
    default:        return 15;
  }
}

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

  // ── 3. Dispatch to Inngest (primary path) ──────────────────────────────
  try {
    await inngest.send({ name: 'cron/sov.weekly', data: {} });
    console.log('[cron-sov] Dispatched to Inngest.');
    return NextResponse.json({ ok: true, dispatched: true });
  } catch (inngestErr) {
    console.error('[cron-sov] Inngest dispatch failed, running inline:', inngestErr);
  }

  // ── 4. Inline fallback (runs when Inngest is unavailable) ──────────────
  return await runInlineSOV();
}

// ---------------------------------------------------------------------------
// Inline fallback — original sequential orchestration
// ---------------------------------------------------------------------------

async function runInlineSOV(): Promise<NextResponse> {
  const handle = await logCronStart('sov');
  try {
  return await _runInlineSOVImpl(handle);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logCronFailed(handle, msg);
    console.error('[cron-sov] Inline run failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function _runInlineSOVImpl(handle: { logId: string | null; startedAt: number }): Promise<NextResponse> {
  const supabase = createServiceRoleClient();

  const { data: queries, error: queryError } = await supabase
    .from('target_queries')
    .select(`
      id, query_text, query_category, location_id, org_id,
      locations ( business_name, city, state, categories ),
      organizations ( plan_status, plan )
    `)
    .eq('is_active', true)
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

  const validQueries = queries.filter(
    (q) => q.locations && q.organizations?.plan_status === 'active',
  );

  const byOrg = groupBy(validQueries, (q: SOVQueryInput) => q.org_id);

  for (const [orgId, orgQueries] of Object.entries(byOrg)) {
    try {
      const plan = orgQueries[0].organizations?.plan ?? 'starter';
      const queryCap = getQueryCap(plan);
      const batch = orgQueries.slice(0, queryCap);

      const results: SOVQueryResult[] = [];
      const useMultiModel = canRunMultiModelSOV(plan as PlanTier);

      for (const query of batch) {
        try {
          if (useMultiModel) {
            const multiResults = await runMultiModelSOVQuery(query as SOVQueryInput);
            results.push(...multiResults);
            summary.queries_run++;
            if (multiResults.some((r) => r.ourBusinessCited)) summary.queries_cited++;
          } else {
            const result = await runSOVQuery(query as SOVQueryInput);
            results.push(result);
            summary.queries_run++;
            if (result.ourBusinessCited) summary.queries_cited++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[cron-sov] Query "${(query as SOVQueryInput).query_text}" failed:`, msg);
        }
        await sleep(500);
      }

      if (results.length > 0) {
        const { shareOfVoice, firstMoverCount, evaluationIds } = await writeSOVResults(
          orgId,
          results,
          supabase,
        );
        summary.first_mover_alerts += firstMoverCount;

        // Sprint 81: Sentiment extraction (non-critical)
        try {
          const bName = batch[0].locations?.business_name ?? '';
          if (bName && evaluationIds.length > 0) {
            const sentimentMap = await extractSOVSentiment(
              evaluationIds.map(e => ({ evaluationId: e.id, rawResponse: e.rawResponse, engine: e.engine })),
              bName,
            );
            await writeSentimentData(supabase, sentimentMap);
          }
        } catch {
          // Sentiment extraction is non-critical
        }

        // Sprint 82: Source mention extraction (non-critical)
        try {
          const bName = batch[0].locations?.business_name ?? '';
          if (bName && evaluationIds.length > 0) {
            const mentionsMap = await extractSOVSourceMentions(
              evaluationIds.map(e => ({ evaluationId: e.id, rawResponse: e.rawResponse, engine: e.engine })),
              bName,
            );
            await writeSourceMentions(supabase, mentionsMap);
          }
        } catch {
          // Source extraction is non-critical
        }

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

        const businessName = batch[0].locations?.business_name ?? 'Your Business';

        if (ownerEmail) {
          // Compute SOV delta from visibility_analytics
          const { data: prevVis } = await supabase
            .from('visibility_analytics')
            .select('share_of_voice')
            .eq('org_id', orgId)
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
            .eq('org_id', orgId)
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
            console.error('[cron-sov] Email send failed:', err),
          );
        }

        // Content Freshness Decay check (non-critical, Sprint 76)
        try {
          const freshness = await fetchFreshnessAlerts(supabase, orgId);
          if (freshness.alerts.length > 0) {
            const { data: orgRow } = await supabase
              .from('organizations')
              .select('notify_sov_alerts')
              .eq('id', orgId)
              .single();

            if (orgRow?.notify_sov_alerts && ownerEmail) {
              const topAlert = freshness.alerts[0];
              await sendFreshnessAlert({
                to: ownerEmail,
                businessName,
                dropPercentage: topAlert.dropPercentage,
                previousRate: topAlert.previousRate,
                currentRate: topAlert.currentRate,
                dashboardUrl: 'https://app.localvector.ai/dashboard',
              }).catch((err: unknown) =>
                console.error('[cron-sov] Freshness alert email failed:', err),
              );
            }
          }
        } catch {
          // Freshness check is non-critical
        }

        // Occasion Engine sub-step (non-critical)
        try {
          const locationId = batch[0].location_id;
          const loc = batch[0].locations as { business_name: string; city: string | null; state: string | null; categories?: string[] } | undefined;
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
        }

        // Prompt Intelligence sub-step (non-critical)
        try {
          const locationId = batch[0].location_id;
          const gaps = await detectQueryGaps(orgId, locationId, supabase);
          summary.gaps_detected += gaps.length;

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
        }
      }

      summary.orgs_processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron-sov] Org ${orgId} failed:`, msg);
      summary.orgs_failed++;
    }
  }

  // Archive expired occasion drafts
  try {
    const archivedCount = await archiveExpiredOccasionDrafts(supabase);
    if (archivedCount > 0) {
      console.log(`[cron-sov] Archived ${archivedCount} expired occasion drafts`);
    }
  } catch (err) {
    const archiveMsg = err instanceof Error ? err.message : String(err);
    console.error(`[cron-sov] Occasion draft archival failed:`, archiveMsg);
  }

  // Post-publish SOV re-checks
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
        console.error(`[cron-sov] Recheck failed for draft ${task.payload.draftId}:`, recheckErr);
      }
    }
  } catch (err) {
    const recheckMsg = err instanceof Error ? err.message : String(err);
    console.error(`[cron-sov] Post-publish recheck scan failed:`, recheckMsg);
  }

  console.log('[cron-sov] Inline run complete:', summary);
  await logCronComplete(handle, summary as unknown as Record<string, unknown>);
  return NextResponse.json(summary);
}
