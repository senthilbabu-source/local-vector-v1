// ---------------------------------------------------------------------------
// GET /api/cron/refresh-places — Google Places Detail Refresh (ToS Compliance)
//
// Sprint 90: Runs daily at 4am EST (9am UTC) via Vercel Cron.
// Refreshes cached Google Place Details older than 29 days for active orgs.
//
// Architecture:
//   - CRON_SECRET auth guard
//   - Kill switch (STOP_PLACES_REFRESH_CRON)
//   - Primary: Inngest event dispatch
//   - Fallback: Inline refreshStalePlaceDetails()
//
// Schedule: Daily at 9:00 UTC (configured in vercel.json)
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';
import { logCronStart, logCronComplete, logCronFailed } from '@/lib/services/cron-logger';
import { refreshStalePlaceDetails } from '@/lib/services/places-refresh';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // ── Auth guard ──
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Kill switch ──
  if (process.env.STOP_PLACES_REFRESH_CRON === 'true') {
    return NextResponse.json({ ok: true, skipped: true, reason: 'Kill switch active' });
  }

  const handle = await logCronStart('refresh-places');

  // ── Primary: Inngest dispatch ──
  try {
    await inngest.send({ name: 'cron/places-refresh.daily', data: {} });
    await logCronComplete(handle, { dispatched: true });
    return NextResponse.json({ ok: true, dispatched: true });
  } catch (inngestErr) {
    console.error('[cron] Inngest dispatch failed, running inline:', inngestErr);
  }

  // ── Fallback: inline ──
  try {
    const result = await refreshStalePlaceDetails();
    await logCronComplete(handle, result as unknown as Record<string, unknown>);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await logCronFailed(handle, err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: 'Places refresh failed' }, { status: 500 });
  }
}
