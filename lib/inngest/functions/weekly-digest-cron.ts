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

import { inngest } from '../client';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { fetchDigestForOrg } from '@/lib/data/weekly-digest';
import { sendDigestEmail } from '@/lib/email/send-digest';

export const weeklyDigestCron = inngest.createFunction(
  {
    id: 'weekly-digest-cron',
    concurrency: { limit: 5 },
    retries: 1, // Email is best-effort — don't retry aggressively
  },
  { event: 'cron/digest.weekly' },
  async ({ step }) => {
    // Step 1: Fetch all active orgs with digest enabled
    const orgs = await step.run('fetch-orgs', async () => {
      const supabase = createServiceRoleClient();
      const { data } = await supabase
        .from('organizations')
        .select('id')
        .eq('notify_weekly_digest', true)
        .in('plan_status', ['active', 'trialing']);
      return data ?? [];
    });

    // Step 2: Fan-out — one step per org
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const org of orgs) {
      await step.run(`digest-${org.id}`, async () => {
        const supabase = createServiceRoleClient(); // Per-step client (§30.3)

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

    return { sent, skipped, failed, total: orgs.length };
  },
);
