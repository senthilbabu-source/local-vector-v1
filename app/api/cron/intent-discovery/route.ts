// ---------------------------------------------------------------------------
// app/api/cron/intent-discovery/route.ts — Weekly Intent Discovery (Sprint 135)
//
// Schedule: "0 10 * * 4" (10 AM UTC every Thursday)
// Kill switch: INTENT_CRON_DISABLED=true
// Agency-only: needs 200+ Perplexity sov_model_results rows.
// AI_RULES §168
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { discoverIntents } from '@/lib/intent/intent-discoverer';
import * as Sentry from '@sentry/nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes — 50 sequential Perplexity calls

export async function GET(request: Request) {
  // ── Auth guard ────────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Kill switch ───────────────────────────────────────────────────────
  if (process.env.INTENT_CRON_DISABLED === 'true') {
    return NextResponse.json({ skipped: true, reason: 'Kill switch active' });
  }

  try {
    const supabase = createServiceRoleClient();

    // Fetch Agency orgs
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('plan', 'agency');

    if (orgError || !orgs) {
      Sentry.captureException(
        orgError ?? new Error('Failed to fetch organizations'),
        { tags: { cron: 'intent-discovery', sprint: '135' } },
      );
      return NextResponse.json(
        { error: 'Failed to fetch organizations' },
        { status: 500 },
      );
    }

    let processed = 0;
    let skippedInsufficientData = 0;
    let failed = 0;

    for (const org of orgs) {
      try {
        // Get primary location
        const { data: location } = await supabase
          .from('locations')
          .select('id')
          .eq('org_id', org.id)
          .eq('is_archived', false)
          .limit(1)
          .single();

        if (!location) {
          skippedInsufficientData++;
          continue;
        }

        // Data gate: need ≥200 Perplexity results
        const { count } = await supabase
          .from('sov_model_results')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', org.id)
          .eq('model_provider', 'perplexity_sonar');

        if ((count ?? 0) < 200) {
          skippedInsufficientData++;
          continue;
        }

        await discoverIntents(
          location.id,
          org.id,
          org.name ?? '',
          supabase,
        );
        processed++;
      } catch (err) {
        failed++;
        Sentry.captureException(err, {
          tags: {
            cron: 'intent-discovery',
            sprint: '135',
            orgId: org.id,
          },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      processed,
      skipped_insufficient_data: skippedInsufficientData,
      failed,
      total: orgs.length,
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { cron: 'intent-discovery', sprint: '135' },
    });
    return NextResponse.json(
      { error: 'Intent discovery failed' },
      { status: 500 },
    );
  }
}
