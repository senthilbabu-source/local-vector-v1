// ---------------------------------------------------------------------------
// GET /api/cron/community-monitor — Weekly Community Platform Monitor Cron
//
// Sprint 6: Searches Nextdoor + Quora for brand mentions via Perplexity web
// search, and runs Perplexity Pages detection on existing SOV data.
// Schedule: Every Wednesday at 9:00 AM UTC (vercel.json).
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { planSatisfies, type PlanTier } from '@/lib/plan-enforcer';
import { monitorCommunityPlatforms } from '@/lib/services/community-monitor.service';
import { detectPerplexityPages } from '@/lib/services/perplexity-pages-detector.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 1. Auth guard
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Kill switch
  if (process.env.STOP_COMMUNITY_MONITOR_CRON === 'true') {
    console.log('[cron-community-monitor] Halted by kill switch.');
    return NextResponse.json({ ok: true, halted: true });
  }

  const startTime = Date.now();

  try {
    const supabase = createServiceRoleClient();

    // 3. Fetch Growth+ orgs
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, plan')
      .in('plan', ['growth', 'agency']);

    if (orgsError) throw orgsError;
    if (!orgs || orgs.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, message: 'No growth+ orgs' });
    }

    let orgsProcessed = 0;
    let totalNextdoor = 0;
    let totalQuora = 0;
    let totalPPDetections = 0;
    let totalErrors = 0;

    for (const org of orgs) {
      try {
        if (!planSatisfies(org.plan as PlanTier, 'growth')) continue;

        // 4. Fetch locations for this org
        const { data: locations } = await supabase
          .from('locations')
          .select('id, business_name, city, state')
          .eq('org_id', org.id);

        if (!locations || locations.length === 0) continue;

        for (const location of locations) {
          // Community monitoring (Nextdoor + Quora)
          const communityResult = await monitorCommunityPlatforms(
            supabase,
            location.id,
            org.id,
            location.business_name ?? '',
            location.city ?? '',
            location.state ?? '',
          );

          totalNextdoor += communityResult.nextdoor_mentions;
          totalQuora += communityResult.quora_mentions;
          if (communityResult.errors.length > 0) totalErrors += communityResult.errors.length;

          // Perplexity Pages detection
          const ppResult = await detectPerplexityPages(supabase, org.id, location.id);
          totalPPDetections += ppResult.new_detections;
          if (ppResult.errors.length > 0) totalErrors += ppResult.errors.length;
        }

        orgsProcessed++;
      } catch (orgErr) {
        Sentry.captureException(orgErr, {
          tags: { cron: 'community-monitor', org_id: org.id },
        });
        totalErrors++;
      }
    }

    const durationMs = Date.now() - startTime;
    console.log('[cron-community-monitor] Complete:', {
      orgs_processed: orgsProcessed,
      nextdoor_mentions: totalNextdoor,
      quora_mentions: totalQuora,
      pp_detections: totalPPDetections,
      errors: totalErrors,
      duration_ms: durationMs,
    });

    return NextResponse.json({
      ok: true,
      orgs_processed: orgsProcessed,
      nextdoor_mentions: totalNextdoor,
      quora_mentions: totalQuora,
      pp_detections: totalPPDetections,
      errors: totalErrors,
      duration_ms: durationMs,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: 'community-monitor', sprint: '6' } });
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cron-community-monitor] Failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
