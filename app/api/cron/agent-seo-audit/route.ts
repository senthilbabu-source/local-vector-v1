// ---------------------------------------------------------------------------
// GET /api/cron/agent-seo-audit — Weekly Agent-SEO Action Readiness Audit
//
// Sprint 126: Fetches and parses action schemas from location websites,
// scores action readiness, caches result on locations table.
//
// Schedule: "0 8 * * 1" (8 AM UTC every Monday)
// Auth: CRON_SECRET bearer token
// Kill switch: AGENT_SEO_CRON_DISABLED=true
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { fetchAndParseActionSchemas } from '@/lib/agent-seo/action-schema-detector';
import { computeAgentSEOScore } from '@/lib/agent-seo/agent-seo-scorer';
import { logCronStart, logCronComplete, logCronFailed } from '@/lib/services/cron-logger';
import * as Sentry from '@sentry/nextjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 55;

const CRON_NAME = 'agent-seo-audit';

export async function GET(request: NextRequest) {
  // Auth guard
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Kill switch
  if (process.env.AGENT_SEO_CRON_DISABLED === 'true') {
    return NextResponse.json({ skipped: true, reason: 'Kill switch active' });
  }

  const handle = await logCronStart(CRON_NAME);
  const supabase = createServiceRoleClient();

  try {
    // Fetch all active locations with a website_url
    const { data: locations, error: fetchError } = await supabase
      .from('locations')
      .select('id, website_url')
      .eq('is_archived', false)
      .not('website_url', 'is', null);

    if (fetchError || !locations) {
      await logCronFailed(handle, fetchError?.message ?? 'No locations found');
      return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
    }

    let audited = 0;
    let skipped = 0;
    let failed = 0;

    for (const location of locations) {
      if (!location.website_url) {
        skipped++;
        continue;
      }

      try {
        // Fetch magic_menus JSON-LD for this location
        const { data: menuData } = await supabase
          .from('magic_menus')
          .select('json_ld_schema')
          .eq('location_id', location.id)
          .eq('is_published', true)
          .limit(1)
          .maybeSingle();

        const magicMenuJsonLd = menuData?.json_ld_schema as Record<string, unknown> | null ?? null;

        // Fetch and parse action schemas from the website
        const detected = await fetchAndParseActionSchemas(location.website_url);

        // Score
        const auditResult = computeAgentSEOScore(
          detected,
          magicMenuJsonLd,
          location.website_url,
          new Date().toISOString(),
        );

        // Cache result on locations table
        // Note: agent_seo_cache and agent_seo_audited_at added in migration 20260303000004
        // Type cast needed until database.types.ts is regenerated
        await (supabase
          .from('locations') as ReturnType<typeof supabase.from>)
          .update({
            agent_seo_cache: auditResult,
            agent_seo_audited_at: new Date().toISOString(),
          } as Record<string, unknown>)
          .eq('id', location.id);

        audited++;
      } catch (err) {
        Sentry.captureException(err, {
          tags: { component: 'agent-seo-audit', sprint: '126' },
          extra: { locationId: location.id },
        });
        failed++;
        // Continue on per-location failure
      }
    }

    await logCronComplete(handle, {
      audited,
      skipped,
      failed,
      total: locations.length,
    });

    return NextResponse.json({
      ok: true,
      audited,
      skipped,
      failed,
      total: locations.length,
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'agent-seo-audit', sprint: '126', scope: 'cron' },
    });
    await logCronFailed(handle, err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
