// ---------------------------------------------------------------------------
// app/api/cron/degradation-check/route.ts — S22: AI Degradation Check Cron
//
// Weekly cron, Monday 10 AM UTC (after SOV runs at 7 AM Sunday).
// Detects cross-org hallucination spikes indicating AI model updates.
// Inserts events to ai_model_degradation_events table.
// Sends email alerts to Growth+ org owners.
//
// Kill switch: STOP_DEGRADATION_CHECK_CRON=true
// Auth: Authorization: Bearer <CRON_SECRET>
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { detectModelDegradation } from '@/lib/analytics/degradation-detector';
import { sendDegradationAlert } from '@/lib/email';
import * as Sentry from '@sentry/nextjs';
import type { Json } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Auth guard
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Kill switch
  if (process.env.STOP_DEGRADATION_CHECK_CRON === 'true') {
    return NextResponse.json({ skipped: true, reason: 'kill_switch' });
  }

  const startTime = Date.now();
  const supabase = createServiceRoleClient();

  try {
    const events = await detectModelDegradation(supabase);

    if (events.length === 0) {
      return NextResponse.json({ status: 'ok', events_detected: 0, duration_ms: Date.now() - startTime });
    }

    // Insert degradation events
    let insertedCount = 0;
    for (const event of events) {
      try {
        const { error } = await supabase
          .from('ai_model_degradation_events' as 'cron_run_log')
          .insert({
            model_provider: event.model_provider,
            affected_org_count: event.affected_org_count,
            avg_alert_spike: event.avg_alert_spike,
            sigma_above_mean: event.sigma_above_mean,
          } as unknown as Json);

        if (!error) insertedCount++;
      } catch (err) {
        Sentry.captureException(err, { tags: { cron: 'degradation-check', sprint: 'S22' } });
      }
    }

    // Send email alerts to Growth+ org owners (fire-and-forget)
    try {
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, plan')
        .in('plan', ['growth', 'agency']);

      if (orgs && orgs.length > 0) {
        for (const org of orgs) {
          try {
            const { data: owner } = await supabase
              .from('memberships')
              .select('users!user_id(email)' as 'user_id')
              .eq('org_id', org.id)
              .eq('role', 'owner')
              .limit(1)
              .maybeSingle();

            const email = (owner as unknown as { users: { email: string } } | null)?.users?.email;
            if (email) {
              for (const event of events) {
                void sendDegradationAlert(email, {
                  modelProvider: event.model_provider,
                  affectedOrgCount: event.affected_org_count,
                }).catch((err) =>
                  Sentry.captureException(err, { tags: { cron: 'degradation-check', sprint: 'S22' } }),
                );
              }
            }
          } catch (err) {
            Sentry.captureException(err);
            // Per-org email failure is non-critical
          }
        }
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { cron: 'degradation-check', sprint: 'S22', phase: 'email' } });
    }

    // Log cron run
    try {
      await supabase.from('cron_run_log').insert({
        cron_name: 'degradation-check',
        status: 'success',
        duration_ms: Date.now() - startTime,
        summary: { events_detected: events.length, events_inserted: insertedCount } as unknown as Json,
      });
    } catch (err) {
      Sentry.captureException(err);
      // Cron logging failure is non-critical
    }

    return NextResponse.json({
      status: 'ok',
      events_detected: events.length,
      events_inserted: insertedCount,
      duration_ms: Date.now() - startTime,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: 'degradation-check', sprint: 'S22' } });

    try {
      await supabase.from('cron_run_log').insert({
        cron_name: 'degradation-check',
        status: 'error',
        duration_ms: Date.now() - startTime,
        summary: { error: String(err) } as unknown as Json,
      });
    } catch (err) {
      Sentry.captureException(err);
      // Logging failure is non-critical
    }

    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
