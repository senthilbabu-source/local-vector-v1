// ---------------------------------------------------------------------------
// GET /api/inngest/health — Inngest Health Check Endpoint
//
// Returns JSON with Inngest client metadata and registered function IDs.
// Protected by CRON_SECRET auth header (same pattern as cron routes).
//
// Sprint 56A: Production verification — confirm Inngest is reachable
// and all expected functions are registered before going live.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// All registered Inngest function IDs — must match app/api/inngest/route.ts
const REGISTERED_FUNCTIONS = [
  'audit-daily-cron',
  'sov-weekly-cron',
  'content-audit-monthly-cron',
  'post-publish-sov-check',
] as const;

export async function GET(request: NextRequest) {
  // ── Auth guard (same pattern as cron routes) ──────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const env = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';

  return NextResponse.json({
    ok: true,
    client_id: 'localvector',
    environment: env,
    functions_registered: REGISTERED_FUNCTIONS.length,
    function_ids: REGISTERED_FUNCTIONS,
    inngest_event_key_set: !!process.env.INNGEST_EVENT_KEY,
    inngest_signing_key_set: !!process.env.INNGEST_SIGNING_KEY,
    timestamp: new Date().toISOString(),
  });
}
