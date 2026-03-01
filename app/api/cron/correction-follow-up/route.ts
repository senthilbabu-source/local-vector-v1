// ---------------------------------------------------------------------------
// app/api/cron/correction-follow-up/route.ts — Sprint F (N3) + Sprint N
//
// Daily cron that checks hallucination alerts in 'verifying' status.
// If verifying_since is 14+ days ago, re-runs the original query against
// the original AI model to check if the hallucination was corrected.
//
// Updates status → 'fixed' (resolved) or 'recurring' (still hallucinating).
//
// Sprint N enhancement: sends email notification to org owner when a
// correction follow-up completes (fixed or recurring).
//
// Schedule: 0 10 * * * (daily at 10:00 UTC)
// Auth: Bearer CRON_SECRET
// Kill switch: STOP_CORRECTION_FOLLOWUP_CRON
//
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { logCronStart, logCronComplete, logCronFailed } from '@/lib/services/cron-logger';
import { checkCorrectionStatus, type FollowUpAlert } from '@/lib/services/correction-verifier.service';
import { sendCorrectionFollowUpAlert } from '@/lib/email';
import type { Database } from '@/lib/supabase/database.types';
import * as Sentry from '@sentry/nextjs';

interface VerifyingAlert {
  id: string;
  org_id: string;
  correction_query: string | null;
  model_provider: string;
  claim_text: string;
  verifying_since: string | null;
}

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Kill switch ───────────────────────────────────────────────────────────
  if (process.env.STOP_CORRECTION_FOLLOWUP_CRON === 'true') {
    console.log('[cron-correction-followup] Halted by kill switch.');
    return NextResponse.json({ ok: true, halted: true });
  }

  const handle = await logCronStart('correction-follow-up');
  const supabase = createServiceRoleClient();

  let checkedCount = 0;
  let fixedCount = 0;
  let recurringCount = 0;
  let errorCount = 0;
  let emailsSent = 0;

  try {
    // Find alerts in 'verifying' status, not yet checked, 14+ days old
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    // Cast: correction_query, verifying_since, follow_up_checked_at are Sprint F columns
    const { data: alerts, error: fetchErr } = await supabase
      .from('ai_hallucinations')
      .select('id, org_id, correction_query, model_provider, claim_text, verifying_since' as '*')
      .eq('correction_status', 'verifying')
      .is('follow_up_checked_at' as 'resolved_at', null)
      .lt('verifying_since' as 'detected_at', fourteenDaysAgo)
      .not('correction_query' as 'claim_text', 'is', null)
      .limit(50) as unknown as { data: VerifyingAlert[] | null; error: { message: string } | null };

    if (fetchErr) throw new Error(`Failed to fetch verifying alerts: ${fetchErr.message}`);

    if (!alerts?.length) {
      console.log('[cron-correction-followup] No alerts to check.');
      await logCronComplete(handle, { checked: 0 });
      return NextResponse.json({ ok: true, checked: 0 });
    }

    console.log(`[cron-correction-followup] Found ${alerts.length} alerts to check.`);

    for (const alert of alerts) {
      try {
        const followUpAlert: FollowUpAlert = {
          id: alert.id,
          correction_query: alert.correction_query!,
          model_provider: alert.model_provider,
          claim_text: alert.claim_text,
        };

        const result = await checkCorrectionStatus(followUpAlert);
        const newStatus = result.stillHallucinating ? 'recurring' : 'fixed';

        const updatePayload: Database['public']['Tables']['ai_hallucinations']['Update'] = {
          correction_status: newStatus,
          follow_up_result: newStatus,
          follow_up_checked_at: new Date().toISOString(),
        };
        if (newStatus === 'fixed') {
          updatePayload.resolved_at = new Date().toISOString();
        }

        await supabase
          .from('ai_hallucinations')
          .update(updatePayload)
          .eq('id', alert.id);

        checkedCount++;
        if (newStatus === 'fixed') fixedCount++;
        else recurringCount++;

        // Sprint N: Send email notification to org owner
        await sendFollowUpEmail(supabase, alert, newStatus).then(() => { emailsSent++; }).catch((err) => {
          Sentry.captureException(err, {
            tags: { cron: 'correction-follow-up', action: 'email', sprint: 'N' },
            extra: { alertId: alert.id, orgId: alert.org_id },
          });
        });
      } catch (err) {
        errorCount++;
        Sentry.captureException(err, {
          tags: { cron: 'correction-follow-up', sprint: 'F' },
          extra: { alertId: alert.id, orgId: alert.org_id },
        });
        // Mark as checked so we don't retry endlessly on permanent failures
        await supabase
          .from('ai_hallucinations')
          .update({ follow_up_checked_at: new Date().toISOString() })
          .eq('id', alert.id);
      }
    }

    const summary = {
      checked: checkedCount,
      fixed: fixedCount,
      recurring: recurringCount,
      errors: errorCount,
      emailsSent,
    };
    console.log('[cron-correction-followup]', summary);
    await logCronComplete(handle, summary);

    if (errorCount > 0) {
      Sentry.captureMessage(`Correction follow-up: ${errorCount} check errors`, {
        level: 'warning',
        tags: { cron: 'correction-follow-up' },
        extra: summary,
      });
    }

    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: 'correction-follow-up', sprint: 'F' } });
    await logCronFailed(handle, msg);
    console.error('[cron-correction-followup] Failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Sprint N: Email notification after follow-up check
// ---------------------------------------------------------------------------

async function sendFollowUpEmail(
  supabase: ReturnType<typeof createServiceRoleClient>,
  alert: VerifyingAlert,
  result: 'fixed' | 'recurring',
) {
  // Look up org owner email + notification preference + business name
  const { data: org } = await supabase
    .from('organizations')
    .select('name, owner_user_id, notify_hallucination_alerts' as '*')
    .eq('id', alert.org_id)
    .single() as { data: { name: string; owner_user_id: string; notify_hallucination_alerts: boolean } | null };

  if (!org?.notify_hallucination_alerts) return; // Notifications disabled

  // Get owner email from auth
  const { data: ownerUser } = await supabase
    .from('users')
    .select('email')
    .eq('id', org.owner_user_id)
    .single();

  if (!ownerUser?.email) return;

  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.localvector.ai'}/dashboard/hallucinations`;

  await sendCorrectionFollowUpAlert({
    to: ownerUser.email,
    businessName: org.name,
    claimText: alert.claim_text,
    result,
    dashboardUrl,
  });
}
