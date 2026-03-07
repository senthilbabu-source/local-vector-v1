// ---------------------------------------------------------------------------
// lib/inngest/functions/weekly-digest-cron.ts — Weekly Digest Fan-Out
//
// Sprint 78: Inngest function that fans out one step per org to send the
// weekly AI snapshot digest email. Triggered by cron/digest.weekly event.
//
// Architecture:
//   Step 1: fetch-orgs — fetch all orgs with notify_weekly_digest=true
//   Step 2: digest-{orgId} — fan-out per org (sequential, max 5 concurrent)
//
// Services are pure — no service code changes. createServiceRoleClient()
// is called inside each step (cannot serialize across step boundaries).
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { inngest } from '../client';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { fetchDigestForOrg } from '@/lib/data/weekly-digest';
import { sendDigestEmail } from '@/lib/email/send-digest';
import { generateWeeklyReportCard } from '@/lib/services/weekly-report-card';
import { sendWeeklyReportCard } from '@/lib/email';
import { planSatisfies, type PlanTier } from '@/lib/plan-enforcer';
import { shouldSendDigest, validateFrequency, type DigestFrequency } from '@/lib/services/digest-preferences';

export const weeklyDigestCron = inngest.createFunction(
  {
    id: 'weekly-digest-cron',
    concurrency: { limit: 5 },
    retries: 1, // Email is best-effort — don't retry aggressively
  },
  { event: 'cron/digest.weekly' },
  async ({ step }) => {
    // Step 1: Fetch all active orgs with digest enabled (include plan for report card routing)
    const orgs = await step.run('fetch-orgs', async () => {
      const supabase = createServiceRoleClient();
      const { data } = await supabase
        .from('organizations')
        .select('id, plan, owner_user_id, name')
        .eq('notify_weekly_digest', true)
        .in('plan_status', ['active', 'trialing']);
      return (data ?? []) as Array<{ id: string; plan: string | null; owner_user_id: string | null; name: string | null }>;
    });

    // Step 2: Fan-out — one step per org
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    let reportCards = 0;

    for (const org of orgs) {
      await step.run(`digest-${org.id}`, async () => {
        const supabase = createServiceRoleClient(); // Per-step client (§30.3)

        // S74: Check digest frequency preference before sending
        try {
          const { data: settingsRow } = await supabase
            .from('org_settings' as never)
            .select('digest_preferences, updated_at' as never)
            .eq('org_id' as never, org.id as never)
            .maybeSingle();
          const prefs = (settingsRow as { digest_preferences?: { frequency?: string } } | null)?.digest_preferences;
          const frequency = validateFrequency(prefs?.frequency) as DigestFrequency;
          // Use updated_at as proxy for last digest sent (conservative — slightly over-sends is OK)
          const lastSent = (settingsRow as { updated_at?: string } | null)?.updated_at ?? null;
          if (frequency !== 'weekly' && !shouldSendDigest(frequency, lastSent)) {
            skipped++;
            return;
          }
        } catch (err) {
          Sentry.captureException(err, { tags: { file: 'weekly-digest-cron.ts', sprint: 'S74' } });
          // Fail-open: send if we can't read preferences
        }

        // S70: Growth+ orgs get enhanced weekly report card instead of basic digest
        const orgPlan = (org.plan ?? 'trial') as PlanTier;
        if (planSatisfies(orgPlan, 'growth') && org.owner_user_id) {
          try {
            const card = await generateWeeklyReportCard(supabase, org.id);
            if (card) {
              const { data: owner } = await supabase
                .from('users')
                .select('email, full_name')
                .eq('id', org.owner_user_id)
                .single();

              if (owner?.email) {
                await sendWeeklyReportCard({
                  to: owner.email,
                  card,
                  businessName: org.name ?? 'Your Business',
                  recipientName: owner.full_name ?? owner.email.split('@')[0],
                });
                reportCards++;
                sent++;
                return;
              }
            }
          } catch (err) {
            Sentry.captureException(err, { tags: { file: 'weekly-digest-cron.ts', sprint: 'S70' } });
            // Fall through to basic digest on report card failure
          }
        }

        // Basic digest for Trial/Starter or report card fallback
        const payload = await fetchDigestForOrg(supabase, org.id);
        if (!payload) {
          skipped++;
          return;
        }

        await sendDigestEmail(payload).catch((err: unknown) => {
          console.error(`[digest] Failed for org ${org.id}:`, err);
          failed++;
        });

        sent++;
      });
    }

    return { sent, skipped, failed, reportCards, total: orgs.length };
  },
);
