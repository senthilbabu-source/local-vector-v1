// ---------------------------------------------------------------------------
// DELETE /api/settings/danger/delete-org — Sprint 121: Delete Organization
// OWNER ONLY. Service role client. Confirmation = org slug.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { roleSatisfies } from '@/lib/auth/org-roles';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function DELETE(request: NextRequest) {
  const ctx = await getSafeAuthContext();
  if (!ctx || !ctx.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!roleSatisfies(ctx.role, 'owner')) {
    return NextResponse.json({ error: 'owner_required' }, { status: 403 });
  }

  let body: { confirmation?: string };
  try {
    body = await request.json();
  } catch {
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
      console.warn('[delete-org] Stripe cancellation failed (proceeding):', stripeErr);
    }

    // DELETE organization (CASCADE will remove all child data)
    await supabase.from('organizations').delete().eq('id', ctx.orgId);

    return NextResponse.json({ ok: true, redirect: '/' });
  } catch (err) {
    Sentry.captureException(err, { tags: { sprint: '121', route: 'delete-org' } });
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }
}
