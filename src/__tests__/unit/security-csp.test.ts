/**
 * Unit Tests — Content Security Policy Builder (P6-FIX-25)
 *
 * Verifies CSP directives are correctly constructed and include
 * all required origins for Supabase, Stripe, Sentry, and fonts.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/security-csp.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('lib/security/csp — buildCSP()', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function loadCSP() {
    return import('@/lib/security/csp');
  }

  it('returns a non-empty string', async () => {
    const { buildCSP } = await loadCSP();
    const csp = buildCSP();
    expect(typeof csp).toBe('string');
    expect(csp.length).toBeGreaterThan(0);
  });

  it("includes default-src 'self'", async () => {
    const { buildCSP } = await loadCSP();
    expect(buildCSP()).toContain("default-src 'self'");
  });

  it('includes script-src with Stripe JS', async () => {
    const { buildCSP } = await loadCSP();
    const csp = buildCSP();
    expect(csp).toContain('script-src');
    expect(csp).toContain('https://js.stripe.com');
  });

  it('includes style-src with Google Fonts', async () => {
    const { buildCSP } = await loadCSP();
    const csp = buildCSP();
    expect(csp).toContain('style-src');
    expect(csp).toContain('https://fonts.googleapis.com');
  });

  it('includes font-src with Google Fonts static', async () => {
    const { buildCSP } = await loadCSP();
    expect(buildCSP()).toContain('https://fonts.gstatic.com');
  });

  it('includes connect-src with Supabase HTTPS and WSS', async () => {
    const { buildCSP } = await loadCSP();
    const csp = buildCSP();
    expect(csp).toContain('https://*.supabase.co');
    expect(csp).toContain('wss://*.supabase.co');
  });

  it('includes connect-src with Sentry', async () => {
    const { buildCSP } = await loadCSP();
    expect(buildCSP()).toContain('https://*.sentry.io');
  });

  it('includes connect-src with Stripe API', async () => {
    const { buildCSP } = await loadCSP();
    expect(buildCSP()).toContain('https://api.stripe.com');
  });

  it('includes frame-src for Stripe JS', async () => {
    const { buildCSP } = await loadCSP();
    expect(buildCSP()).toMatch(/frame-src[^;]*https:\/\/js\.stripe\.com/);
  });

  it("sets object-src to 'none'", async () => {
    const { buildCSP } = await loadCSP();
    expect(buildCSP()).toContain("object-src 'none'");
  });

  it("sets base-uri to 'self'", async () => {
    const { buildCSP } = await loadCSP();
    expect(buildCSP()).toContain("base-uri 'self'");
  });

  it("sets form-action to 'self'", async () => {
    const { buildCSP } = await loadCSP();
    expect(buildCSP()).toContain("form-action 'self'");
  });

  it('does NOT contain unsafe-eval', async () => {
    const { buildCSP } = await loadCSP();
    expect(buildCSP()).not.toContain('unsafe-eval');
  });

  it('includes upgrade-insecure-requests as a bare directive', async () => {
    const { buildCSP } = await loadCSP();
    expect(buildCSP()).toContain('upgrade-insecure-requests');
  });

  it('includes img-src with data: and blob: schemes', async () => {
    const { buildCSP } = await loadCSP();
    const csp = buildCSP();
    expect(csp).toContain('img-src');
    expect(csp).toContain('data:');
    expect(csp).toContain('blob:');
  });

  it("includes frame-ancestors 'self'", async () => {
    const { buildCSP } = await loadCSP();
    expect(buildCSP()).toContain("frame-ancestors 'self'");
  });

  it('separates directives with semicolons', async () => {
    const { buildCSP } = await loadCSP();
    const parts = buildCSP().split('; ');
    expect(parts.length).toBeGreaterThanOrEqual(10);
  });
});

describe('lib/security/csp — getCSPHeaderName()', () => {
  it('returns Content-Security-Policy in production', async () => {
    const savedEnv = process.env.NODE_ENV;
    // @ts-expect-error — NODE_ENV is normally readonly
    process.env.NODE_ENV = 'production';
    try {
      vi.resetModules();
      const { getCSPHeaderName } = await import('@/lib/security/csp');
      expect(getCSPHeaderName()).toBe('Content-Security-Policy');
    } finally {
      // @ts-expect-error
      process.env.NODE_ENV = savedEnv;
    }
  });

  it('returns Content-Security-Policy-Report-Only in development', async () => {
    const savedEnv = process.env.NODE_ENV;
    // @ts-expect-error
    process.env.NODE_ENV = 'development';
    try {
      vi.resetModules();
      const { getCSPHeaderName } = await import('@/lib/security/csp');
      expect(getCSPHeaderName()).toBe('Content-Security-Policy-Report-Only');
    } finally {
      // @ts-expect-error
      process.env.NODE_ENV = savedEnv;
    }
  });
});
