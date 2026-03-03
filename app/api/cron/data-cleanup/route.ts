// ---------------------------------------------------------------------------
// GET /api/cron/data-cleanup — P6-FIX-26: GDPR Account Cleanup
// Daily cron. Deletes orgs where deletion was requested 7+ days ago.
// CRON_SECRET protected. Kill switch: STOP_DATA_CLEANUP_CRON.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  // CRON_SECRET validation
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Kill switch
  if (process.env.STOP_DATA_CLEANUP_CRON === 'true') {
    return NextResponse.json({ skipped: true, reason: 'kill_switch' });
  }

  try {
    const supabase = createServiceRoleClient();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Find orgs past the 7-day grace period
    // NOTE: deletion_requested_at column added via migration 20260304100002 but not yet
    // in generated database.types.ts — cast through unknown to bypass type mismatch.
    const { data: expiredOrgs, error: fetchError } = (await supabase
      .from('organizations')
      .select('id, slug, deletion_requested_at')
      .not('deletion_requested_at', 'is', null)
      .lt('deletion_requested_at', sevenDaysAgo)) as unknown as {
      data: Array<{ id: string; slug: string; deletion_requested_at: string }> | null;
      error: { message: string } | null;
    };

    if (fetchError) {
      throw fetchError;
    }

    const deleted: string[] = [];
    const failed: string[] = [];

    for (const org of expiredOrgs ?? []) {
      try {
        // Cancel Stripe subscription if exists
        try {
          const { data: orgRow } = await supabase
            .from('organizations')
            .select('stripe_subscription_id')
            .eq('id', org.id)
            .maybeSingle();

          const subId = (orgRow as { stripe_subscription_id: string | null } | null)
            ?.stripe_subscription_id;
          if (subId) {
            const stripe = await import('stripe').then(
              (m) => new m.default(process.env.STRIPE_SECRET_KEY!),
            );
            await stripe.subscriptions.cancel(subId);
          }
        } catch (stripeErr) {
          Sentry.captureException(stripeErr, {
            tags: { sprint: 'P6-FIX-26', cron: 'data-cleanup', step: 'stripe-cancel' },
            extra: { orgId: org.id },
          });
        }

        // Hard delete — CASCADE removes all child data
        const { error: deleteError } = await supabase
          .from('organizations')
          .delete()
          .eq('id', org.id);

        if (deleteError) throw deleteError;
        deleted.push(org.slug as string);

        Sentry.captureMessage(`GDPR deletion completed for org: ${org.slug}`, {
          level: 'info',
          tags: { sprint: 'P6-FIX-26', cron: 'data-cleanup' },
        });
      } catch (orgErr) {
        Sentry.captureException(orgErr, {
          tags: { sprint: 'P6-FIX-26', cron: 'data-cleanup' },
          extra: { orgId: org.id },
        });
        failed.push(org.id);
      }
    }

    return NextResponse.json({
      ok: true,
      checked: expiredOrgs?.length ?? 0,
      deleted: deleted.length,
      failed: failed.length,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { sprint: 'P6-FIX-26', cron: 'data-cleanup' } });
    return NextResponse.json({ error: 'cleanup_failed' }, { status: 500 });
  }
}
