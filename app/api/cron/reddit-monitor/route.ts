// ---------------------------------------------------------------------------
// GET /api/cron/reddit-monitor — Weekly Reddit Brand Monitoring Cron
//
// Sprint 4: Searches Reddit for brand mentions across all Growth+ orgs.
// Schedule: Every Tuesday at 8:00 AM UTC (vercel.json).
// Skips silently if REDDIT_CLIENT_ID is not configured.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { planSatisfies, type PlanTier } from '@/lib/plan-enforcer';
import { monitorRedditMentions } from '@/lib/services/reddit-monitor.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 55;

export async function GET(request: NextRequest) {
  // 1. Auth guard
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Kill switch
  if (process.env.STOP_REDDIT_MONITOR_CRON === 'true') {
    console.log('[cron-reddit-monitor] Halted by kill switch.');
    return NextResponse.json({ ok: true, halted: true });
  }

  // 3. Skip if Reddit credentials not configured
  if (!process.env.REDDIT_CLIENT_ID) {
    console.log('[cron-reddit-monitor] Skipped — REDDIT_CLIENT_ID not set.');
    return NextResponse.json({ ok: true, skipped: true, reason: 'no_credentials' });
  }

  const startTime = Date.now();

  try {
    const supabase = createServiceRoleClient();

    // 4. Fetch Growth+ orgs
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, plan')
      .in('plan', ['growth', 'agency']);

    if (orgsError) throw orgsError;
    if (!orgs || orgs.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, message: 'No growth+ orgs' });
    }

    let orgsProcessed = 0;
    let totalNewMentions = 0;
    let totalErrors = 0;

    for (const org of orgs) {
      try {
        if (!planSatisfies(org.plan as PlanTier, 'growth')) continue;

        // 5. Fetch locations for this org
        const { data: locations } = await supabase
          .from('locations')
          .select('id, business_name')
          .eq('org_id', org.id);

        if (!locations || locations.length === 0) continue;

        for (const location of locations) {
          const result = await monitorRedditMentions(
            supabase,
            location.id,
            org.id,
            location.business_name ?? '',
          );

          totalNewMentions += result.new_mentions;
          if (result.errors.length > 0) totalErrors += result.errors.length;
        }

        orgsProcessed++;
      } catch (orgErr) {
        Sentry.captureException(orgErr, {
          tags: { cron: 'reddit-monitor', org_id: org.id },
        });
        totalErrors++;
      }
    }

    const durationMs = Date.now() - startTime;
    console.log('[cron-reddit-monitor] Complete:', {
      orgs_processed: orgsProcessed,
      new_mentions: totalNewMentions,
      errors: totalErrors,
      duration_ms: durationMs,
    });

    return NextResponse.json({
      ok: true,
      orgs_processed: orgsProcessed,
      new_mentions: totalNewMentions,
      errors: totalErrors,
      duration_ms: durationMs,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: 'reddit-monitor', sprint: '4' } });
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cron-reddit-monitor] Failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
