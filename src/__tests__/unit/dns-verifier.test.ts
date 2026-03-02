/**
 * Sprint 114 — DNS Verifier unit tests.
 * Target: lib/whitelabel/dns-verifier.ts
 *
 * Uses MSW to mock Cloudflare DNS-over-HTTPS endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/__helpers__/setup';
import { verifyCustomDomain, buildVerificationToken } from '@/lib/whitelabel/dns-verifier';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DOMAIN = 'menu.bestpizza.com';
const TOKEN = 'localvector-verify=abc123';
const DOH_URL = 'https://cloudflare-dns.com/dns-query';

function dohJsonResponse(answers: Array<{ type: number; data: string }>) {
  return HttpResponse.json({
    Status: 0,
    Answer: answers.map((a) => ({
      name: DOMAIN,
      type: a.type,
      TTL: 300,
      data: a.data,
    })),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('verifyCustomDomain — fetch mocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { verified: true } when TXT record matches', async () => {
    server.use(
      http.get(DOH_URL, () => dohJsonResponse([{ type: 16, data: TOKEN }])),
    );

    const result = await verifyCustomDomain(DOMAIN, TOKEN);

    expect(result.verified).toBe(true);
    expect(result.status).toBe('verified');
    expect(result.error).toBeNull();
    expect(result.checked_at).toBeTruthy();
  });

  it('returns { verified: false, error: "TXT record not found" } when no matching record', async () => {
    server.use(
      http.get(DOH_URL, () =>
        dohJsonResponse([{ type: 16, data: 'localvector-verify=wrong-token' }]),
      ),
    );

    const result = await verifyCustomDomain(DOMAIN, TOKEN);

    expect(result.verified).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.error).toBe('TXT record not found');
  });

  it('handles TXT record with surrounding quotes (strips them before compare)', async () => {
    // Cloudflare DoH returns TXT data wrapped in quotes: "\"localvector-verify=abc123\""
    server.use(
      http.get(DOH_URL, () =>
        dohJsonResponse([{ type: 16, data: `"${TOKEN}"` }]),
      ),
    );

    const result = await verifyCustomDomain(DOMAIN, TOKEN);

    expect(result.verified).toBe(true);
    expect(result.status).toBe('verified');
    expect(result.error).toBeNull();
  });

  it('returns { verified: false, error: "DNS lookup timed out" } on timeout', async () => {
    server.use(
      http.get(DOH_URL, () => {
        // Return a promise that never resolves — the AbortController will trigger
        return new Promise(() => {});
      }),
    );

    // Use fake timers to trigger the 5-second timeout instantly
    vi.useFakeTimers();
    const promise = verifyCustomDomain(DOMAIN, TOKEN);
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;
    vi.useRealTimers();

    expect(result.verified).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.error).toBe('DNS lookup timed out');
  });

  it('returns { verified: false, error: "DNS lookup failed: ..." } on fetch error', async () => {
    server.use(
      http.get(DOH_URL, () => HttpResponse.error()),
    );

    const result = await verifyCustomDomain(DOMAIN, TOKEN);

    expect(result.verified).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/^DNS lookup failed:/);
  });

  it('always returns DomainVerificationResult — never throws', async () => {
    // Non-ok HTTP response
    server.use(
      http.get(DOH_URL, () =>
        HttpResponse.json({ error: 'server error' }, { status: 503 }),
      ),
    );
    const r1 = await verifyCustomDomain(DOMAIN, TOKEN);
    expect(r1.verified).toBe(false);
    expect(r1.error).toBe('DNS lookup failed: HTTP 503');

    // Empty Answer array
    server.use(
      http.get(DOH_URL, () =>
        HttpResponse.json({ Status: 0, Answer: [] }),
      ),
    );
    const r2 = await verifyCustomDomain(DOMAIN, TOKEN);
    expect(r2.verified).toBe(false);
    expect(r2.error).toBe('TXT record not found');

    // Network error
    server.use(
      http.get(DOH_URL, () => HttpResponse.error()),
    );
    const r3 = await verifyCustomDomain(DOMAIN, TOKEN);
    expect(r3.verified).toBe(false);
    expect(r3.error).toMatch(/^DNS lookup failed:/);

    // All three returned valid DomainVerificationResult shapes
    for (const r of [r1, r2, r3]) {
      expect(r).toHaveProperty('verified');
      expect(r).toHaveProperty('status');
      expect(r).toHaveProperty('checked_at');
      expect(r).toHaveProperty('error');
    }
  });
});

describe('buildVerificationToken — pure', () => {
  it('prepends "localvector-verify=" to raw token', () => {
    const result = buildVerificationToken('abc123');
    expect(result).toBe('localvector-verify=abc123');
  });

  it('returns as-is when token already has prefix', () => {
    const result = buildVerificationToken('localvector-verify=abc123');
    expect(result).toBe('localvector-verify=abc123');
  });
});
