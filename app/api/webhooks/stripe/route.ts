// ---------------------------------------------------------------------------
// POST /api/webhooks/stripe
//
// Receives Stripe webhook events, verifies the signature, and fulfils orders
// by updating the organisation's plan tier and subscription IDs in Supabase.
//
// Security:
//   • Reads raw body via request.text() — MUST happen before any JSON parsing
//     so the HMAC signature remains valid.
//   • Verifies the Stripe-Signature header with stripe.webhooks.constructEvent().
//     Any request that fails verification receives a 400 — it is never processed.
//   • Uses createServiceRoleClient() to bypass RLS. This route runs outside of
//     a user session so the normal RLS client cannot perform the update.
//
// Plan → DB tier mapping (prod_schema.sql is the authority — AI_RULES §1):
//   plan_tier enum = 'trial' | 'starter' | 'growth' | 'agency'
//   metadata.plan 'pro'        → DB tier 'growth'
//   metadata.plan 'enterprise' → DB tier 'agency'
//
// Handled events:
//   checkout.session.completed       — initial purchase; sets plan + stripe IDs
//   customer.subscription.updated    — plan changes, renewals, cancellations
//   customer.subscription.deleted    — subscription fully canceled; downgrade to trial
//
// All other event types receive an immediate 200 OK (Stripe requires this).
//
// Required env vars:
//   STRIPE_SECRET_KEY=sk_live_...
//   STRIPE_WEBHOOK_SECRET=whsec_...
//   SUPABASE_SERVICE_ROLE_KEY=...   (already used by createServiceRoleClient)
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ── Force dynamic so Next.js never caches this route ──────────────────────
export const dynamic = 'force-dynamic';

// ── Lazy Stripe client ────────────────────────────────────────────────────
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return _stripe;
}

// ── UI plan name → prod_schema.sql plan_tier enum value ───────────────────
const UI_PLAN_TO_DB_TIER: Record<string, string> = {
  pro: 'growth',
  enterprise: 'agency',
};

// ── Stripe subscription.status → plan_status enum value ──────────────────
const STRIPE_STATUS_TO_DB: Record<string, string> = {
  active: 'active',
  trialing: 'trialing',
  past_due: 'past_due',
  canceled: 'canceled',
  paused: 'paused',
  incomplete: 'past_due',
  incomplete_expired: 'canceled',
  unpaid: 'past_due',
};

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  supabase: SupabaseClient<Database>
): Promise<void> {
  // Prefer client_reference_id (most reliable); fall back to metadata.org_id.
  const orgId = session.client_reference_id ?? session.metadata?.org_id;

  if (!orgId) {
    console.warn(
      '[stripe-webhook] checkout.session.completed: no org_id in client_reference_id or metadata — skipping'
    );
    return;
  }

  const planName = session.metadata?.plan ?? 'pro';
  const tier = UI_PLAN_TO_DB_TIER[planName] ?? 'growth';

  // session.customer and session.subscription are string | Stripe.Customer |
  // Stripe.Subscription | null depending on expansion. We only pass IDs (no
  // expand), so they're always string | null here.
  const stripeCustomerId =
    typeof session.customer === 'string' ? session.customer : null;
  const stripeSubscriptionId =
    typeof session.subscription === 'string' ? session.subscription : null;

  const { error } = await supabase
    .from('organizations')
    .update({
      plan: tier as Database['public']['Enums']['plan_tier'],
      plan_status: 'active',
      ...(stripeCustomerId && { stripe_customer_id: stripeCustomerId }),
      ...(stripeSubscriptionId && { stripe_subscription_id: stripeSubscriptionId }),
    })
    .eq('id', orgId);

  if (error) {
    throw new Error(`[stripe-webhook] DB update failed (checkout.session.completed): ${error.message}`);
  }

  console.log(
    '[stripe-webhook] checkout.session.completed: org=%s plan=%s → tier=%s',
    orgId,
    planName,
    tier
  );
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  supabase: SupabaseClient<Database>
): Promise<void> {
  // The subscription's customer field is always a string ID when not expanded.
  const stripeCustomerId =
    typeof subscription.customer === 'string' ? subscription.customer : null;

  if (!stripeCustomerId) {
    console.warn('[stripe-webhook] customer.subscription.updated: no customer ID — skipping');
    return;
  }

  const planStatus = STRIPE_STATUS_TO_DB[subscription.status] ?? 'active';

  const { error } = await supabase
    .from('organizations')
    .update({ plan_status: planStatus as Database['public']['Enums']['plan_status'] })
    .eq('stripe_customer_id', stripeCustomerId);

  if (error) {
    throw new Error(
      `[stripe-webhook] DB update failed (customer.subscription.updated): ${error.message}`
    );
  }

  console.log(
    '[stripe-webhook] customer.subscription.updated: customer=%s status=%s → plan_status=%s',
    stripeCustomerId,
    subscription.status,
    planStatus
  );
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  supabase: SupabaseClient<Database>
): Promise<void> {
  const stripeCustomerId =
    typeof subscription.customer === 'string' ? subscription.customer : null;

  if (!stripeCustomerId) {
    console.warn('[stripe-webhook] customer.subscription.deleted: no customer ID — skipping');
    return;
  }

  // Downgrade to trial + canceled status
  const { error } = await supabase
    .from('organizations')
    .update({ plan: 'trial', plan_status: 'canceled' })
    .eq('stripe_customer_id', stripeCustomerId);

  if (error) {
    throw new Error(
      `[stripe-webhook] DB update failed (customer.subscription.deleted): ${error.message}`
    );
  }

  console.log(
    '[stripe-webhook] customer.subscription.deleted: customer=%s → plan=trial, plan_status=canceled',
    stripeCustomerId
  );
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // ── Guard: webhook secret must be configured ──────────────────────────────
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  // ── Guard: signature header must be present ───────────────────────────────
  const sig = request.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Missing Stripe-Signature header' }, { status: 400 });
  }

  // ── Read raw body BEFORE any parsing ─────────────────────────────────────
  // constructEvent requires the exact bytes Stripe sent; JSON.parse would
  // normalise whitespace and break the HMAC.
  const body = await request.text();

  // ── Verify signature ──────────────────────────────────────────────────────
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[stripe-webhook] Signature verification failed:', msg);
    return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 });
  }

  // ── Dispatch ──────────────────────────────────────────────────────────────
  const supabase = createServiceRoleClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
          supabase
        );
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
          supabase
        );
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
          supabase
        );
        break;

      default:
        // Return 200 for all unhandled event types — Stripe will retry on
        // non-2xx responses, so silently acknowledging unknown events is correct.
        break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[stripe-webhook] Handler threw:', msg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
