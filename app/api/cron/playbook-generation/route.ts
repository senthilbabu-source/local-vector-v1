// ---------------------------------------------------------------------------
// app/api/cron/playbook-generation/route.ts — Weekly Playbook Generation (Sprint 134)
//
// Schedule: "0 9 * * 1" (9 AM UTC every Monday)
// Kill switch: PLAYBOOK_CRON_DISABLED=true
// Agency-only: only generates playbooks for Agency tier orgs.
// AI_RULES §167
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { generateAllPlaybooks } from '@/lib/playbooks/playbook-engine';
import * as Sentry from '@sentry/nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 55;

export async function GET(request: Request) {
  // ── Auth guard ────────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Kill switch ───────────────────────────────────────────────────────
  if (process.env.PLAYBOOK_CRON_DISABLED === 'true') {
    return NextResponse.json({ skipped: true, reason: 'Kill switch active' });
  }

  try {
    const supabase = createServiceRoleClient();

    // Fetch all Agency orgs with at least one location
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, plan')
      .eq('plan', 'agency');

    if (orgError || !orgs) {
      Sentry.captureException(
        orgError ?? new Error('Failed to fetch organizations'),
        { tags: { cron: 'playbook-generation', sprint: '134' } },
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

        // Check if enough SOV data exists
        const { count } = await supabase
          .from('sov_model_results')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', org.id);

        if ((count ?? 0) < 20) {
          skippedInsufficientData++;
          continue;
        }

        await generateAllPlaybooks(org.id, location.id, supabase);
        processed++;
      } catch (err) {
        failed++;
        Sentry.captureException(err, {
          tags: {
            cron: 'playbook-generation',
            sprint: '134',
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
      tags: { cron: 'playbook-generation', sprint: '134' },
    });
    return NextResponse.json(
      { error: 'Playbook generation failed' },
      { status: 500 },
    );
  }
}
