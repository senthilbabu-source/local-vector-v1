/**
 * P7-FIX-32 — Env Guard Unit Tests (4 tests)
 *
 * Validates that assertEnvironment() correctly guards production builds
 * against missing env vars and Stripe test keys.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('lib/env-guard', () => {
  const ORIGINAL_ENV = { ...process.env };

  // All 15 required vars with plausible production values
  const FULL_ENV: Record<string, string> = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon',
    SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service',
    STRIPE_SECRET_KEY: 'sk_live_abc123',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_abc123',
    STRIPE_WEBHOOK_SECRET: 'whsec_live_abc123',
    STRIPE_PRICE_ID_STARTER: 'price_starter_123',
    STRIPE_PRICE_ID_GROWTH: 'price_growth_123',
    STRIPE_PRICE_ID_AGENCY_SEAT: 'price_agency_123',
    RESEND_API_KEY: 're_abc123',
    NEXT_PUBLIC_APP_URL: 'https://localvector.ai',
    CRON_SECRET: 'cron-secret-abc123',
    NEXT_PUBLIC_SENTRY_DSN: 'https://abc@sentry.io/123',
    INNGEST_EVENT_KEY: 'inngest-event-key',
    INNGEST_SIGNING_KEY: 'inngest-signing-key',
  };

  beforeEach(() => {
    vi.resetModules();
    // Start with a clean env
    for (const key of Object.keys(FULL_ENV)) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...ORIGINAL_ENV };
  });

  it('does not throw when all required vars are present', async () => {
    Object.assign(process.env, FULL_ENV);
    const { assertEnvironment } = await import('@/lib/env-guard');
    expect(() => assertEnvironment()).not.toThrow();
  });

  it('throws listing all missing vars when any are absent', async () => {
    // Set only 12 of 15 — omit 3
    const partial = { ...FULL_ENV };
    delete partial.STRIPE_SECRET_KEY;
    delete partial.RESEND_API_KEY;
    delete partial.CRON_SECRET;
    Object.assign(process.env, partial);

    const { assertEnvironment } = await import('@/lib/env-guard');
    expect(() => assertEnvironment()).toThrow('[env-guard] Missing required environment variables');
    try {
      assertEnvironment();
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain('STRIPE_SECRET_KEY');
      expect(msg).toContain('RESEND_API_KEY');
      expect(msg).toContain('CRON_SECRET');
    }
  });

  it('throws when STRIPE_SECRET_KEY starts with sk_test_ in production', async () => {
    Object.assign(process.env, FULL_ENV, {
      NODE_ENV: 'production',
      STRIPE_SECRET_KEY: 'sk_test_abc123',
    });
    const { assertEnvironment } = await import('@/lib/env-guard');
    expect(() => assertEnvironment()).toThrow('test key in production');
  });

  it('does not throw for test keys in development', async () => {
    Object.assign(process.env, FULL_ENV, {
      NODE_ENV: 'development',
      STRIPE_SECRET_KEY: 'sk_test_abc123',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_abc123',
    });
    const { assertEnvironment } = await import('@/lib/env-guard');
    expect(() => assertEnvironment()).not.toThrow();
  });
});
