'use server';

// ---------------------------------------------------------------------------
// Billing Server Actions — Phase 18: Stripe Checkout
//
// Zero-regression contract:
//   • When STRIPE_SECRET_KEY is absent (local dev, CI, preview deploys) the
//     action returns { url: null, demo: true } — exactly as before Phase 18.
//   • Existing Playwright billing tests rely on this demo branch; they MUST
//     keep passing with no changes to the test files.
//
// Plan → DB tier mapping (AI_RULES §1 — prod_schema.sql is the authority):
//   plan_tier enum = 'trial' | 'starter' | 'growth' | 'agency'
//   createCheckoutSession accepts 'starter' or 'growth' — exact enum values.
//   Agency tier is a "Contact Us" flow — no Stripe session needed.
//
// Required env vars (add to .env.local and Vercel dashboard):
//   STRIPE_SECRET_KEY=sk_live_...
//   STRIPE_PRICE_ID_STARTER=price_...
//   STRIPE_PRICE_ID_GROWTH=price_...
//   NEXT_PUBLIC_APP_URL=https://app.localvector.ai
// ---------------------------------------------------------------------------

import Stripe from 'stripe';
import { getAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export type CheckoutResult =
  | { url: string; demo: false }
  | { url: null; demo: true };

export type PortalResult =
  | { url: string; demo: false }
  | { url: null; demo: true };

// Lazy Stripe client — only instantiated when STRIPE_SECRET_KEY is present.
// Avoids a crash at module-load time in demo / CI environments.
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return _stripe;
}

// ---------------------------------------------------------------------------
// createCheckoutSession
// ---------------------------------------------------------------------------

export async function createCheckoutSession(
  plan: 'starter' | 'growth'
): Promise<CheckoutResult> {
  // ── Demo mode ─────────────────────────────────────────────────────────────
  if (!process.env.STRIPE_SECRET_KEY) {
    console.log('[billing] STRIPE_SECRET_KEY absent — returning demo result for plan:', plan);
    return { url: null, demo: true };
  }

  // ── Resolve the authenticated org ─────────────────────────────────────────
  // getAuthContext() throws 'Unauthorized' if the session cookie is missing,
  // which surfaces as a server action error (500) — correct behaviour.
  const auth = await getAuthContext();
  const orgId = auth.orgId;

  // ── Resolve the Stripe Price ID ───────────────────────────────────────────
  const priceId =
    plan === 'starter'
      ? process.env.STRIPE_PRICE_ID_STARTER
      : process.env.STRIPE_PRICE_ID_GROWTH;

  if (!priceId) {
    // Price IDs not configured yet — fall back to demo rather than crash.
    console.warn(
      '[billing] STRIPE_PRICE_ID_%s is not set — returning demo result',
      plan === 'starter' ? 'STARTER' : 'GROWTH'
    );
    return { url: null, demo: true };
  }

  // ── Create the Checkout Session ───────────────────────────────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],

    // client_reference_id is the primary carrier — Stripe surfaces it in the
    // Dashboard and it's always present on the webhook event object.
    client_reference_id: orgId,

    // metadata duplicates org_id so the webhook handler can also find it when
    // processing subscription lifecycle events that lack client_reference_id.
    metadata: {
      org_id: orgId,
      // UI plan name — the webhook maps this to the DB plan_tier enum value.
      plan,
    },

    success_url: `${appUrl}/dashboard/billing?success=true`,
    cancel_url: `${appUrl}/dashboard/billing?canceled=true`,
  });

  return { url: session.url!, demo: false };
}

// ---------------------------------------------------------------------------
// createPortalSession — Stripe Customer Portal
// ---------------------------------------------------------------------------

/**
 * Server Action: create a Stripe Customer Portal session so the user can
 * manage their subscription (update payment method, cancel, view invoices).
 *
 * Looks up stripe_customer_id from the org's DB record. Falls back to demo
 * mode when STRIPE_SECRET_KEY is absent or the org has no Stripe customer.
 */
export async function createPortalSession(): Promise<PortalResult> {
  // ── Demo mode ─────────────────────────────────────────────────────────────
  if (!process.env.STRIPE_SECRET_KEY) {
    console.log('[billing] STRIPE_SECRET_KEY absent — returning demo portal result');
    return { url: null, demo: true };
  }

  // ── Resolve the authenticated org ─────────────────────────────────────────
  const auth = await getAuthContext();
  const orgId = auth.orgId;

  // ── Fetch stripe_customer_id from DB ──────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const { data: org } = await supabase
    .from('organizations')
    .select('stripe_customer_id')
    .eq('id', orgId)
    .single();

  if (!org?.stripe_customer_id) {
    console.warn('[billing] No stripe_customer_id for org:', orgId);
    return { url: null, demo: true };
  }

  // ── Create the Portal Session ─────────────────────────────────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const portalSession = await getStripe().billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${appUrl}/dashboard/billing`,
  });

  return { url: portalSession.url, demo: false };
}

// ---------------------------------------------------------------------------
// getCurrentPlan — Fetch current plan state for the billing page
// ---------------------------------------------------------------------------

export interface CurrentPlanInfo {
  plan: string;
  plan_status: string;
  has_stripe_customer: boolean;
}

/**
 * Server Action: fetch the current org's plan tier and status.
 * Used by the billing page to display current plan state.
 */
export async function getCurrentPlan(): Promise<CurrentPlanInfo> {
  const auth = await getAuthContext();
  const orgId = auth.orgId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const { data: org } = await supabase
    .from('organizations')
    .select('plan, plan_status, stripe_customer_id')
    .eq('id', orgId)
    .single();

  return {
    plan: org?.plan ?? 'trial',
    plan_status: org?.plan_status ?? 'active',
    has_stripe_customer: !!org?.stripe_customer_id,
  };
}
