// ---------------------------------------------------------------------------
// scripts/verify-stripe.ts — Stripe Live Mode Verification (P7-FIX-32)
//
// Run: npx tsx scripts/verify-stripe.ts
//
// Checks Stripe is in live mode, all price IDs are active, and the
// production webhook endpoint is registered and enabled.
// ---------------------------------------------------------------------------

import Stripe from 'stripe';

async function verifyStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.log('  ❌ STRIPE_SECRET_KEY is not set');
    process.exit(1);
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  console.log('Checking Stripe configuration...\n');

  // 1. Verify live mode
  const isLive = process.env.STRIPE_SECRET_KEY.startsWith('sk_live_');
  console.log(
    isLive
      ? '  ✅ Stripe is in live mode'
      : '  ⚠️  Stripe is in TEST mode'
  );

  // 2. Verify all price IDs exist and are active
  const prices = [
    { name: 'Starter', id: process.env.STRIPE_PRICE_ID_STARTER },
    { name: 'Growth', id: process.env.STRIPE_PRICE_ID_GROWTH },
    { name: 'Agency Seat', id: process.env.STRIPE_PRICE_ID_AGENCY_SEAT },
  ];

  for (const { name, id } of prices) {
    if (!id) {
      console.log(`  ❌ ${name} price ID not set`);
      continue;
    }
    try {
      const price = await stripe.prices.retrieve(id);
      console.log(
        price.active
          ? `  ✅ ${name} price active ($${price.unit_amount! / 100}/mo)`
          : `  ❌ ${name} price is INACTIVE`
      );
    } catch {
      console.log(`  ❌ ${name} price not found: ${id}`);
    }
  }

  // 3. Verify webhook endpoint
  try {
    const webhooks = await stripe.webhookEndpoints.list();
    const appWebhook = webhooks.data.find((w) =>
      w.url.includes('localvector.ai/api/webhooks/stripe')
    );
    console.log(
      appWebhook?.status === 'enabled'
        ? '  ✅ Webhook registered and enabled'
        : '  ❌ Webhook not found for localvector.ai'
    );
  } catch {
    console.log('  ❌ Failed to list webhook endpoints');
  }
}

verifyStripe().catch(console.error);
