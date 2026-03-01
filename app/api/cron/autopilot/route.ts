// ---------------------------------------------------------------------------
// app/api/cron/autopilot/route.ts — Sprint 86: Weekly Autopilot Cron
//
// Runs gap detection and creates drafts for all Growth+ locations.
// Schedule: 0 2 * * 3 (Wednesday at 2:00 AM UTC)
// Auth: Bearer CRON_SECRET
// Kill switch: STOP_AUTOPILOT_CRON
//
// Sprint 86 — Autopilot Engine
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { logCronStart, logCronComplete, logCronFailed } from '@/lib/services/cron-logger';
import * as Sentry from '@sentry/nextjs';
import { runAutopilotForAllOrgs } from '@/lib/autopilot/autopilot-service';

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Kill switch ───────────────────────────────────────────────────────────
  if (process.env.STOP_AUTOPILOT_CRON === 'true') {
    console.log('[cron-autopilot] Halted by kill switch.');
    return NextResponse.json({ ok: true, halted: true });
  }

  const handle = await logCronStart('autopilot');
  const supabase = createServiceRoleClient();

  try {
    const result = await runAutopilotForAllOrgs(supabase);

    const summary = {
      orgs_processed: result.processed,
      drafts_created: result.draftsCreated,
      errors: result.errors,
    };

    console.log('[cron-autopilot]', summary);
    await logCronComplete(handle, summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: 'autopilot', sprint: '86' } });
    await logCronFailed(handle, msg);
    console.error('[cron-autopilot] Failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
