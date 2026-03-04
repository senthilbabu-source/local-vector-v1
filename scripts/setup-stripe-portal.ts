// ---------------------------------------------------------------------------
// scripts/setup-stripe-portal.ts — Stripe Billing Portal Configuration (§203)
//
// Run: npx tsx scripts/setup-stripe-portal.ts
//
// Creates a programmatic Billing Portal Configuration via Stripe SDK so
// portal features (cancellation, invoices, payment methods) are
// version-controlled, not just Stripe Dashboard settings.
//
// Outputs STRIPE_PORTAL_CONFIGURATION_ID to copy into .env.local / Vercel.
// ---------------------------------------------------------------------------

import Stripe from 'stripe';

async function setupPortal() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY is not set');
    process.exit(1);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  console.log('Creating Stripe Billing Portal configuration...\n');

  // Collect active product IDs for subscription_update
  const priceIds = [
    process.env.STRIPE_PRICE_ID_STARTER,
    process.env.STRIPE_PRICE_ID_GROWTH,
    process.env.STRIPE_PRICE_ID_AGENCY_SEAT,
  ].filter(Boolean) as string[];

  // Resolve product IDs from prices
  const productSet = new Set<string>();
  for (const priceId of priceIds) {
    try {
      const price = await stripe.prices.retrieve(priceId);
      const productId = typeof price.product === 'string' ? price.product : price.product.id;
      productSet.add(productId);
    } catch (err) {
      console.warn(`  Warning: could not resolve price ${priceId}:`, err instanceof Error ? err.message : err);
    }
  }

  const products = Array.from(productSet).map((productId) => ({
    product: productId,
    prices: priceIds.filter(Boolean),
  }));

  const config = await stripe.billingPortal.configurations.create({
    business_profile: {
      headline: 'LocalVector.ai - Manage Your Subscription',
      privacy_policy_url: `${appUrl}/privacy`,
      terms_of_service_url: `${appUrl}/terms`,
    },
    features: {
      customer_update: {
        enabled: true,
        allowed_updates: ['email', 'address', 'tax_id'],
      },
      payment_method_update: {
        enabled: true,
      },
      invoice_history: {
        enabled: true,
      },
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end',
        cancellation_reason: {
          enabled: true,
          options: [
            'too_expensive',
            'missing_features',
            'switched_service',
            'unused',
            'other',
          ],
        },
      },
      ...(products.length > 0 && {
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price', 'quantity'] as Stripe.BillingPortal.ConfigurationCreateParams.Features.SubscriptionUpdate.DefaultAllowedUpdate[],
          proration_behavior: 'create_prorations' as const,
          products,
        },
      }),
    },
  });

  console.log('Portal Configuration created successfully!\n');
  console.log('Configuration ID:', config.id);
  console.log('\nAdd to .env.local and Vercel:');
  console.log(`  STRIPE_PORTAL_CONFIGURATION_ID=${config.id}`);
}

setupPortal().catch((err) => {
  console.error('Failed to create portal configuration:', err);
  process.exit(1);
});
