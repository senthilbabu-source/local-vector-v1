// ---------------------------------------------------------------------------
// lib/sov/first-scan.ts — First-scan auto-trigger for new Trial/Starter orgs
//
// Dispatches an immediate SOV scan when a new org's first primary location is
// created. Bypasses the Growth+ plan gate in POST /api/sov/trigger-manual —
// all plans get exactly one free first scan so they reach activation (Step 6)
// without waiting up to 6 days for the weekly SOV cron.
//
// Fire-and-forget: never throws. Inngest dispatch failures are logged to Sentry
// but must never block location creation. Called via `void triggerFirstScan()`.
//
// PLG-MECHANICS.md §2 — Trial activation / Step 4 fix.
// AI_RULES §211.
// ---------------------------------------------------------------------------

import { createServiceRoleClient } from '@/lib/supabase/server';
import { inngest } from '@/lib/inngest/client';
import * as Sentry from '@sentry/nextjs';

/**
 * Triggers the first SOV scan for a newly-created primary location.
 * Safe to call for all plan tiers — ignores the Growth+ gate.
 * No-ops if a scan has already been triggered for this org.
 */
export async function triggerFirstScan(orgId: string, userId: string): Promise<void> {
  try {
    const supabase = createServiceRoleClient();

    // Only trigger when this is genuinely the first scan. If last_manual_scan_triggered_at
    // is already set (e.g. the GBP OAuth flow started a scan earlier), do nothing.
    const { data: org } = await supabase
      .from('organizations')
      .select('last_manual_scan_triggered_at, manual_scan_status')
      .eq('id', orgId)
      .single();

    if (!org) return;
    if (org.last_manual_scan_triggered_at !== null) return;

    // Mark pending before dispatching so concurrent calls de-dup correctly.
    await supabase
      .from('organizations')
      .update({
        last_manual_scan_triggered_at: new Date().toISOString(),
        manual_scan_status: 'pending',
      })
      .eq('id', orgId);

    await inngest.send({
      name: 'manual/sov.triggered',
      data: { orgId, triggeredByUserId: userId, isFirstScan: true },
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { file: 'lib/sov/first-scan.ts', fn: 'triggerFirstScan' },
    });
    // Never rethrow — first-scan failure must not block location creation.
  }
}
