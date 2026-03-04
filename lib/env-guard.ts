// ---------------------------------------------------------------------------
// lib/env-guard.ts — Build-time environment variable validation (P7-FIX-32)
//
// Called from next.config.ts in production builds. Blocks deployment if
// required env vars are missing or Stripe is in test mode.
// ---------------------------------------------------------------------------

const REQUIRED = [
  // Supabase (3)
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  // Stripe (6)
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_ID_STARTER',
  'STRIPE_PRICE_ID_GROWTH',
  'STRIPE_PRICE_ID_AGENCY_SEAT',
  // Email
  'RESEND_API_KEY',
  // App config
  'NEXT_PUBLIC_APP_URL',
  'CRON_SECRET',
  // Sentry
  'NEXT_PUBLIC_SENTRY_DSN',
  // Inngest
  'INNGEST_EVENT_KEY',
  'INNGEST_SIGNING_KEY',
] as const;

export { REQUIRED as REQUIRED_ENV_VARS };

export function assertEnvironment(): void {
  const missing = REQUIRED.filter((k) => !process.env[k]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `[env-guard] Missing required environment variables:\n${missing.map((k) => `  - ${k}`).join('\n')}`
    );
  }

  if (process.env.NODE_ENV === 'production') {
    if (process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
      throw new Error(
        '[env-guard] STRIPE_SECRET_KEY is a test key in production'
      );
    }
    if (process.env.STRIPE_WEBHOOK_SECRET?.includes('test')) {
      throw new Error(
        '[env-guard] STRIPE_WEBHOOK_SECRET appears to be a test secret'
      );
    }
  }
}
