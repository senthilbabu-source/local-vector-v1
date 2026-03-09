// ---------------------------------------------------------------------------
// GET /api/cron/ai-overviews — GSC AI Overview Weekly Sync (Sprint 3)
//
// Syncs Google Search Console AI Overview data for all growth+ orgs
// that have granted the webmasters.readonly OAuth scope.
//
// Schedule: Weekly, Monday at 6 AM UTC (configured in vercel.json)
// Kill switch: STOP_AI_OVERVIEWS_CRON=true
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { canRunGSCOverviews, type PlanTier } from '@/lib/plan-enforcer';
import { isTokenExpired } from '@/lib/services/gbp-token-refresh';
import { refreshGBPAccessToken } from '@/lib/services/gbp-token-refresh';
import {
  fetchGSCSearchAnalytics,
  GSCTokenExpiredError,
  GSCScopeNotGrantedError,
} from '@/lib/services/gsc-client';
import { inngest } from '@/lib/inngest/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 55;

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

  // ── 2. Kill switch ─────────────────────────────────────────────────────
  if (process.env.STOP_AI_OVERVIEWS_CRON === 'true') {
    console.log('[cron-ai-overviews] Halted by kill switch.');
    return NextResponse.json({ ok: true, halted: true });
  }

  // ── 3. Dispatch to Inngest (primary path) ──────────────────────────────
  try {
    await inngest.send({ name: 'cron/ai-overviews.weekly', data: {} });
    console.log('[cron-ai-overviews] Dispatched to Inngest.');
    return NextResponse.json({ ok: true, dispatched: true });
  } catch (inngestErr) {
    console.error('[cron-ai-overviews] Inngest dispatch failed, running inline:', inngestErr);
  }

  // ── 4. Inline fallback ─────────────────────────────────────────────────
  return await runInlineAIOverviewSync();
}

// ---------------------------------------------------------------------------
// Inline fallback — sequential sync for all eligible orgs
// ---------------------------------------------------------------------------

function normalizeSiteUrl(websiteUrl: string): string {
  let url = websiteUrl.trim();
  if (!url.startsWith('http')) url = `https://${url}`;
  if (!url.endsWith('/')) url = `${url}/`;
  return url;
}

async function runInlineAIOverviewSync(): Promise<NextResponse> {
  const supabase = createServiceRoleClient();

  const summary = {
    ok: true,
    orgs_synced: 0,
    queries_stored: 0,
    errors: 0,
  };

  try {
    // Find all orgs with:
    // 1. Active plan (growth+)
    // 2. google_oauth_tokens row with webmasters scope
    const { data: tokenRows, error: tokenError } = await supabase
      .from('google_oauth_tokens')
      .select(`
        org_id,
        access_token,
        refresh_token,
        expires_at,
        scopes,
        organizations ( plan, plan_status )
      `)
      .like('scopes', '%webmasters%');

    if (tokenError) {
      console.error('[cron-ai-overviews] Token query failed:', tokenError.message);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!tokenRows?.length) {
      console.log('[cron-ai-overviews] No eligible orgs found.');
      return NextResponse.json({ ok: true, orgs_synced: 0, queries_stored: 0, errors: 0 });
    }

    // Date range: last 28 days
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    for (const row of tokenRows) {
      try {
        const org = row.organizations as { plan: string; plan_status: string } | null;
        if (!org || org.plan_status !== 'active') continue;
        if (!canRunGSCOverviews(org.plan as PlanTier)) continue;

        // Get location(s) with website_url
        const { data: locations } = await supabase
          .from('locations')
          .select('id, website_url')
          .eq('org_id', row.org_id)
          .not('website_url', 'is', null);

        if (!locations?.length) continue;

        // Ensure token is fresh
        let accessToken = row.access_token;
        if (isTokenExpired(row.expires_at)) {
          const refreshResult = await refreshGBPAccessToken(row.org_id, row.refresh_token, supabase);
          if (!refreshResult.success || !refreshResult.newAccessToken) {
            console.error(`[cron-ai-overviews] Token refresh failed for org=${row.org_id}`);
            summary.errors++;
            continue;
          }
          accessToken = refreshResult.newAccessToken;
        }

        for (const location of locations) {
          if (!location.website_url) continue;

          const siteUrl = normalizeSiteUrl(location.website_url);

          const result = await fetchGSCSearchAnalytics(
            accessToken,
            siteUrl,
            startDate,
            endDate,
          );

          // Upsert AI Overview rows
          for (const queryRow of result.aiOverviewQueries) {
            const { error: upsertError } = await supabase
              .from('gsc_ai_overview_data')
              .upsert(
                {
                  org_id: row.org_id,
                  location_id: location.id,
                  site_url: siteUrl,
                  query: queryRow.query,
                  date: queryRow.date,
                  clicks: queryRow.clicks,
                  impressions: queryRow.impressions,
                  ctr: queryRow.ctr,
                  position: queryRow.position,
                  has_ai_overview: true,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'org_id,site_url,query,date' },
              );

            if (upsertError) {
              console.error(`[cron-ai-overviews] Upsert failed:`, upsertError.message);
            } else {
              summary.queries_stored++;
            }
          }
        }

        summary.orgs_synced++;
      } catch (err) {
        if (err instanceof GSCTokenExpiredError) {
          console.error(`[cron-ai-overviews] Token expired for org=${row.org_id}, skipping`);
        } else if (err instanceof GSCScopeNotGrantedError) {
          console.error(`[cron-ai-overviews] Scope not granted for org=${row.org_id}, skipping`);
        } else {
          Sentry.captureException(err, {
            tags: { cron: 'ai-overviews', sprint: '3' },
            extra: { orgId: row.org_id },
          });
          console.error(`[cron-ai-overviews] Org ${row.org_id} failed:`, err);
        }
        summary.errors++;
      }
    }

    console.log('[cron-ai-overviews] Sync complete:', summary);
    return NextResponse.json(summary);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: 'ai-overviews', sprint: '3' } });
    console.error('[cron-ai-overviews] Fatal error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
