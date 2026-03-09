// ---------------------------------------------------------------------------
// GET /api/cron/hijack-detection — Weekly Hijacking Detection Cron
//
// P8-FIX-37: Detects when AI engines confuse a business with a competitor.
// Schedule: Every Monday at 9:00 AM UTC (vercel.json).
// Processes only Agency-tier orgs.
// AI_RULES §193.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { canDetectHijacking, type PlanTier } from '@/lib/plan-enforcer';
import { detectHijacking, type DetectionInput, type HijackingEvent } from '@/lib/hijack/hijacking-detector';
import { sendHijackingAlert } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const maxDuration = 55;

export async function GET(request: NextRequest) {
  // 1. Auth guard
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Kill switch
  if (process.env.STOP_HIJACK_DETECTION_CRON === 'true') {
    console.log('[cron-hijack-detection] Halted by kill switch.');
    return NextResponse.json({ ok: true, halted: true });
  }

  const startTime = Date.now();

  try {
    const supabase = createServiceRoleClient();

    // 3. Fetch agency-tier orgs
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name, plan, owner_user_id')
      .eq('plan', 'agency');

    if (orgsError) throw orgsError;
    if (!orgs || orgs.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, message: 'No agency orgs' });
    }

    let totalProcessed = 0;
    let totalNewAlerts = 0;
    let totalEmailsSent = 0;
    let totalErrors = 0;

    for (const org of orgs) {
      try {
        if (!canDetectHijacking(org.plan as PlanTier)) continue;

        // 4. Fetch locations for this org
        const { data: locations } = await supabase
          .from('locations')
          .select('id, business_name, address_line1, city, state')
          .eq('org_id', org.id)
          .eq('is_archived', false);

        if (!locations || locations.length === 0) continue;

        for (const location of locations) {
          try {
            // 5. Fetch non-cited SOV model results from last 14 days
            const twoWeeksAgo = new Date();
            twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

            const { data: sovResults } = await supabase
              .from('sov_model_results')
              .select('model_provider, query_text, ai_response, cited')
              .eq('org_id', org.id)
              .eq('location_id', location.id)
              .eq('cited', false)
              .gte('run_at', twoWeeksAgo.toISOString());

            if (!sovResults || sovResults.length === 0) continue;

            // 6. Fetch mentioned_competitors from sov_evaluations
            const { data: sovEvals } = await supabase
              .from('sov_evaluations')
              .select('engine, mentioned_competitors, raw_response')
              .eq('org_id', org.id)
              .eq('location_id', location.id)
              .gte('created_at', twoWeeksAgo.toISOString());

            // Build competitor map from evaluations
            const competitorsByEngine = new Map<string, string[]>();
            for (const ev of sovEvals ?? []) {
              const competitors = Array.isArray(ev.mentioned_competitors)
                ? (ev.mentioned_competitors as string[])
                : [];
              if (competitors.length > 0) {
                competitorsByEngine.set(ev.engine, competitors);
              }
            }

            // 7. Build detection input
            const detectionInput: DetectionInput = {
              orgId: org.id,
              locationId: location.id,
              businessName: location.business_name,
              businessAddress: location.address_line1 ?? '',
              city: location.city ?? '',
              state: location.state ?? '',
              sovResults: sovResults.map((r) => ({
                engine: r.model_provider,
                queryText: r.query_text,
                aiResponse: r.ai_response ?? '',
                cited: r.cited,
                mentionedCompetitors: competitorsByEngine.get(r.model_provider) ?? [],
              })),
            };

            // 8. Run pure detection
            const events: HijackingEvent[] = detectHijacking(detectionInput);

            // 9. Insert new alerts
            for (const event of events) {
              const { error: insertError } = await supabase
                .from('hijacking_alerts')
                .insert({
                  org_id: event.orgId,
                  location_id: event.locationId,
                  engine: event.engine,
                  query_text: event.queryText,
                  hijack_type: event.hijackType,
                  our_business: event.ourBusiness,
                  competitor_name: event.competitorName,
                  evidence_text: event.evidenceText,
                  severity: event.severity,
                  status: 'new',
                  detected_at: event.detectedAt,
                });

              if (insertError) {
                console.error('[cron-hijack-detection] Insert error:', insertError.message);
                continue;
              }

              totalNewAlerts++;

              // 10. Send email for critical severity
              if (event.severity === 'critical' && org.owner_user_id) {
                try {
                  const { data: ownerUser } = await supabase
                    .from('users')
                    .select('email')
                    .eq('id', org.owner_user_id)
                    .maybeSingle();
                  if (!ownerUser?.email) continue;
                  await sendHijackingAlert({
                    to: ownerUser.email,
                    businessName: event.ourBusiness,
                    competitorName: event.competitorName,
                    hijackType: event.hijackType,
                    engine: event.engine,
                    queryCount: 1,
                    dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.localvector.ai'}/dashboard/hallucinations`,
                  });
                  totalEmailsSent++;
                } catch (emailErr) {
                  Sentry.captureException(emailErr, {
                    tags: { cron: 'hijack-detection', phase: 'email' },
                  });
                }
              }
            }

            totalProcessed++;
          } catch (locationErr) {
            Sentry.captureException(locationErr, {
              tags: { cron: 'hijack-detection', org_id: org.id, location_id: location.id },
            });
            totalErrors++;
          }
        }
      } catch (orgErr) {
        Sentry.captureException(orgErr, {
          tags: { cron: 'hijack-detection', org_id: org.id },
        });
        totalErrors++;
      }
    }

    const durationMs = Date.now() - startTime;
    console.log('[cron-hijack-detection] Complete:', {
      processed: totalProcessed,
      newAlerts: totalNewAlerts,
      emailsSent: totalEmailsSent,
      errors: totalErrors,
      duration_ms: durationMs,
    });

    return NextResponse.json({
      ok: true,
      processed: totalProcessed,
      newAlerts: totalNewAlerts,
      emailsSent: totalEmailsSent,
      errors: totalErrors,
      duration_ms: durationMs,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: 'hijack-detection', sprint: 'P8-FIX-37' } });
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cron-hijack-detection] Failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
