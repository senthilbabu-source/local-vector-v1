// ---------------------------------------------------------------------------
// DELETE /api/settings/danger/delete-org — Sprint 121 + P6-FIX-26
// OWNER ONLY. Service role client. Confirmation = org slug.
// P6-FIX-26: 7-day grace period. Cron data-cleanup handles hard delete.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { roleSatisfies } from '@/lib/auth/org-roles';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit/rate-limiter';
import { ROUTE_RATE_LIMITS } from '@/lib/rate-limit/types';

export async function DELETE(request: NextRequest) {
  const ctx = await getSafeAuthContext();
  if (!ctx || !ctx.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // P5-FIX-22: Strict rate limit on destructive operations (1/hour/org)
  const rl = await checkRateLimit(ROUTE_RATE_LIMITS.danger_delete_org, ctx.orgId);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limited. This operation can only be performed once per hour.' },
      { status: 429, headers: getRateLimitHeaders(rl) },
    );
  }

  if (!roleSatisfies(ctx.role, 'owner')) {
    return NextResponse.json({ error: 'owner_required' }, { status: 403 });
  }

  let body: { confirmation?: string };
  try {
    body = await request.json();
  } catch (_err) {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.confirmation) {
    return NextResponse.json({ error: 'confirmation_required' }, { status: 400 });
  }

  // Fetch org slug for verification
  const supabase = createServiceRoleClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', ctx.orgId)
    .maybeSingle();

  const orgSlug = (org as { slug: string } | null)?.slug;
  if (!orgSlug || body.confirmation !== orgSlug) {
    return NextResponse.json({ error: 'wrong_confirmation' }, { status: 400 });
  }

  try {
    // Cancel Stripe subscription (log warning on error, proceed)
    try {
      const { data: orgRow } = await supabase
        .from('organizations')
        .select('stripe_subscription_id')
        .eq('id', ctx.orgId)
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
        tags: { sprint: '121', route: 'delete-org', step: 'stripe-cancel' },
      });
    }

    // P6-FIX-26: Set deletion_requested_at for 7-day grace period.
    // Cron /api/cron/data-cleanup does the actual CASCADE hard delete.
    const now = new Date();
    const deletionDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await supabase
      .from('organizations')
      .update({
        deletion_requested_at: now.toISOString(),
        plan_status: 'pending_deletion',
      })
      .eq('id', ctx.orgId);

    return NextResponse.json({
      ok: true,
      deletion_date: deletionDate.toISOString(),
      message: 'Account scheduled for deletion. You have 7 days to cancel.',
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { sprint: '121', route: 'delete-org' } });
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }
}
