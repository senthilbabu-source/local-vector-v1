// ---------------------------------------------------------------------------
// rate-limit.test.ts — Unit tests for runFreeScan IP-based rate limiting
//
// Tests app/actions/marketing.ts:
//   • checkRateLimit() via runFreeScan — KV incr/expire/ttl interaction
//   • rate_limited result when count exceeds RATE_LIMIT_MAX (5)
//   • bypass when KV_REST_API_URL is absent (dev / CI)
//   • resilience when kv.incr() throws (AI_RULES §17)
//
// Run:
//   npx vitest run src/__tests__/unit/rate-limit.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoist vi.mock declarations before any imports (AI_RULES §4) ──────────

vi.mock('@vercel/kv', () => ({
  kv: { incr: vi.fn(), expire: vi.fn(), ttl: vi.fn() },
}));
vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSafeAuthContext: vi.fn() }));

// ── Import subjects and mocks after declarations ──────────────────────────

import { runFreeScan } from '@/app/actions/marketing';
import { kv } from '@vercel/kv';
import { headers } from 'next/headers';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeForm(businessName = 'Test Biz', city = 'Atlanta, GA'): FormData {
  const fd = new FormData();
  fd.append('businessName', businessName);
  fd.append('city', city);
  return fd;
}

function mockHeaders(ip = '1.2.3.4') {
  vi.mocked(headers as ReturnType<typeof vi.fn>).mockResolvedValue({
    get: (name: string) => (name === 'x-forwarded-for' ? ip : null),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('runFreeScan — rate limiting', () => {
  describe('when KV is configured', () => {
    beforeEach(() => {
      process.env.KV_REST_API_URL = 'http://localhost:6379';
      delete process.env.PERPLEXITY_API_KEY; // force demo fallback; no real fetch
      mockHeaders();
      vi.mocked(kv.expire as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      vi.mocked(kv.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(86400);
    });

    afterEach(() => {
      delete process.env.KV_REST_API_URL;
      vi.clearAllMocks();
    });

    it('returns scan result when request count is under limit (count=1)', async () => {
      vi.mocked(kv.incr as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      const result = await runFreeScan(makeForm());
      expect(result.status).toBe('fail');
    });

    it('returns scan result when request count equals limit exactly (count=5)', async () => {
      vi.mocked(kv.incr as ReturnType<typeof vi.fn>).mockResolvedValue(5);
      const result = await runFreeScan(makeForm());
      expect(result.status).toBe('fail');
    });

    it('returns { status: "rate_limited" } when count exceeds limit (count=6)', async () => {
      vi.mocked(kv.incr as ReturnType<typeof vi.fn>).mockResolvedValue(6);
      const result = await runFreeScan(makeForm());
      expect(result.status).toBe('rate_limited');
    });

    it('rate_limited result includes retryAfterSeconds from KV ttl()', async () => {
      vi.mocked(kv.incr as ReturnType<typeof vi.fn>).mockResolvedValue(6);
      vi.mocked(kv.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(7200);
      const result = await runFreeScan(makeForm());
      expect(result).toEqual({ status: 'rate_limited', retryAfterSeconds: 7200 });
    });
  });

  describe('when KV_REST_API_URL is absent', () => {
    beforeEach(() => {
      delete process.env.KV_REST_API_URL;
      delete process.env.PERPLEXITY_API_KEY;
      mockHeaders();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('skips rate limiting entirely when KV_REST_API_URL is absent', async () => {
      const result = await runFreeScan(makeForm());
      // Demo fallback path — not rate limited
      expect(result.status).toBe('fail');
      expect(kv.incr).not.toHaveBeenCalled();
    });
  });

  describe('when kv.incr() throws', () => {
    beforeEach(() => {
      process.env.KV_REST_API_URL = 'http://localhost:6379';
      delete process.env.PERPLEXITY_API_KEY;
      mockHeaders();
    });

    afterEach(() => {
      delete process.env.KV_REST_API_URL;
      vi.clearAllMocks();
    });

    it('falls through to scan when kv.incr() throws (resilience — no crash)', async () => {
      vi.mocked(kv.incr as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('KV connection refused')
      );
      const result = await runFreeScan(makeForm());
      // try/catch in runFreeScan absorbs the KV failure — scan continues via demo fallback
      expect(result.status).toBe('fail');
    });
  });
});
