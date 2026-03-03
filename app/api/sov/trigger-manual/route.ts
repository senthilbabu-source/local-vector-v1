// ---------------------------------------------------------------------------
// app/api/sov/trigger-manual/route.ts — P1-FIX-05
//
// POST: Trigger a manual full-org SOV scan (Growth/Agency only)
// GET:  Poll current manual scan status
//
// Rate-limited to 1 manual scan per hour per org via Redis sliding window.
// Dispatches to Inngest for async processing (full-org scan can take minutes).
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { planSatisfies, type PlanTier } from '@/lib/plan-enforcer';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';
import { inngest } from '@/lib/inngest/client';

export const dynamic = 'force-dynamic';

// 1 manual scan per hour per org
const MANUAL_SCAN_RATE_LIMIT = {
  max_requests: 1,
  window_seconds: 3600,
  key_prefix: 'manual-sov',
};

// ---------------------------------------------------------------------------
// POST — Trigger manual scan
// ---------------------------------------------------------------------------

export async function POST() {
  try {
    const ctx = await getSafeAuthContext();
    if (!ctx?.orgId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // Fetch org plan + current scan status
    const supabase = await createClient();
    const { data: orgRow, error: orgError } = await supabase
      .from('organizations')
      .select('plan, manual_scan_status')
      .eq('id', ctx.orgId)
      .single();

    if (orgError || !orgRow) {
      return NextResponse.json({ error: 'org_not_found' }, { status: 404 });
    }

    // Plan gate — Growth+ only
    const plan = (orgRow.plan ?? 'trial') as PlanTier;
    if (!planSatisfies(plan, 'growth')) {
      return NextResponse.json(
        { error: 'plan_upgrade_required', message: 'Manual scan requires the AI Shield (Growth) plan or above.' },
        { status: 403 },
      );
    }

    // Check if already running
    if (orgRow.manual_scan_status === 'pending' || orgRow.manual_scan_status === 'running') {
      return NextResponse.json(
        { error: 'scan_in_progress', message: 'A scan is already in progress.' },
        { status: 409 },
      );
    }

    // Cooldown — 1 per hour per org
    const rateResult = await checkRateLimit(MANUAL_SCAN_RATE_LIMIT, ctx.orgId);
    if (!rateResult.allowed) {
      const headers = getRateLimitHeaders(rateResult);
      return NextResponse.json(
        {
          error: 'cooldown_active',
          message: 'A manual scan was already triggered recently. Please wait before triggering again.',
          retry_after: rateResult.retry_after,
        },
        { status: 429, headers },
      );
    }

    // Set status to pending
    await supabase
      .from('organizations')
      .update({
        last_manual_scan_triggered_at: new Date().toISOString(),
        manual_scan_status: 'pending',
      })
      .eq('id', ctx.orgId);

    // Dispatch to Inngest
    try {
      await inngest.send({
        name: 'manual/sov.triggered',
        data: { orgId: ctx.orgId, triggeredByUserId: ctx.userId },
      });
    } catch (inngestErr) {
      Sentry.captureException(inngestErr, { tags: { route: 'sov-trigger-manual' } });
      // Reset status if Inngest dispatch fails
      await supabase
        .from('organizations')
        .update({ manual_scan_status: null })
        .eq('id', ctx.orgId);
      return NextResponse.json(
        { error: 'dispatch_failed', message: 'Failed to queue scan. Please try again.' },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true, status: 'pending' });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'sov-trigger-manual' } });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// GET — Poll current scan status
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const ctx = await getSafeAuthContext();
    if (!ctx?.orgId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('manual_scan_status, last_manual_scan_triggered_at')
      .eq('id', ctx.orgId)
      .single();

    return NextResponse.json({
      status: orgRow?.manual_scan_status ?? null,
      last_triggered_at: orgRow?.last_manual_scan_triggered_at ?? null,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'sov-trigger-manual-status' } });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
