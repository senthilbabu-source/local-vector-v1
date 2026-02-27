// ---------------------------------------------------------------------------
// GET /api/cron/weekly-digest — Weekly AI Snapshot Digest (Inngest Dispatcher)
//
// Sprint 78: Triggered by Vercel Cron every Monday at 1pm UTC (8am EST).
// Dispatches to Inngest for fan-out processing per org.
// Falls back to inline execution if Inngest is unavailable (AI_RULES §17).
//
// Architecture:
//   • CRON_SECRET auth guard
//   • Kill switch (STOP_DIGEST_CRON)
//   • Primary: Inngest event dispatch → fan-out per org
//   • Fallback: Inline sequential loop
//
// Schedule: Monday 1pm UTC (configured in vercel.json)
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';
import { logCronStart, logCronComplete, logCronFailed } from '@/lib/services/cron-logger';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { fetchDigestForOrg } from '@/lib/data/weekly-digest';
import { sendDigestEmail } from '@/lib/email/send-digest';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // ── Auth guard ──
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Kill switch ──
  if (process.env.STOP_DIGEST_CRON === 'true') {
    return NextResponse.json({ ok: true, skipped: true, reason: 'Kill switch active' });
  }

  const handle = await logCronStart('weekly-digest');

  // ── Primary: Inngest dispatch ──
  try {
    await inngest.send({ name: 'cron/digest.weekly', data: {} });
    await logCronComplete(handle, { dispatched: true });
    return NextResponse.json({ ok: true, dispatched: true });
  } catch (inngestErr) {
    console.error('[cron] Inngest dispatch failed, running inline:', inngestErr);
  }

  // ── Fallback: inline sequential ──
  try {
    const result = await runInlineDigest();
    await logCronComplete(handle, result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await logCronFailed(handle, err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: 'Digest failed' }, { status: 500 });
  }
}

async function runInlineDigest() {
  const supabase = createServiceRoleClient();

  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .eq('notify_weekly_digest', true)
    .in('plan_status', ['active', 'trialing']);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const org of orgs ?? []) {
    try {
      const payload = await fetchDigestForOrg(supabase, org.id);
      if (!payload) {
        skipped++;
        continue;
      }
      await sendDigestEmail(payload).catch(() => {
        failed++;
      }); // §17 — side-effect resilience
      sent++;
    } catch {
      failed++;
    }
  }

  return { sent, skipped, failed, total: (orgs ?? []).length };
}
