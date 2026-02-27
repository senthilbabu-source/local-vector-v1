// ---------------------------------------------------------------------------
// GET /api/cron/refresh-gbp-tokens — Proactive GBP Token Refresh
//
// Sprint 90: Runs hourly via Vercel Cron. Finds GBP tokens expiring within
// 1 hour and refreshes them proactively. Prevents silent GBP integration
// failures when no content is published.
//
// Architecture:
//   - CRON_SECRET auth guard
//   - Kill switch (STOP_TOKEN_REFRESH_CRON)
//   - Primary: Inngest event dispatch
//   - Fallback: Inline refreshExpiringTokens()
//
// Schedule: Every hour (configured in vercel.json)
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';
import { logCronStart, logCronComplete, logCronFailed } from '@/lib/services/cron-logger';
import { refreshExpiringTokens } from '@/lib/services/gbp-token-refresh';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // ── Auth guard ──
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Kill switch ──
  if (process.env.STOP_TOKEN_REFRESH_CRON === 'true') {
    return NextResponse.json({ ok: true, skipped: true, reason: 'Kill switch active' });
  }

  const handle = await logCronStart('refresh-gbp-tokens');

  // ── Primary: Inngest dispatch ──
  try {
    await inngest.send({ name: 'cron/gbp-token-refresh.hourly', data: {} });
    await logCronComplete(handle, { dispatched: true });
    return NextResponse.json({ ok: true, dispatched: true });
  } catch (inngestErr) {
    console.error('[cron] Inngest dispatch failed, running inline:', inngestErr);
  }

  // ── Fallback: inline ──
  try {
    const result = await refreshExpiringTokens(60);
    await logCronComplete(handle, result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await logCronFailed(handle, err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: 'Token refresh failed' }, { status: 500 });
  }
}
