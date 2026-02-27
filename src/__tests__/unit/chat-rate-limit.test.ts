// ---------------------------------------------------------------------------
// chat-rate-limit.test.ts — POST /api/chat rate limiting tests
//
// Sprint FIX-4: Verifies Upstash sliding window rate limit enforcement,
// Redis unavailability resilience, and rate limit headers on responses.
//
// Run:
//   npx vitest run src/__tests__/unit/chat-rate-limit.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted setup — runs BEFORE module imports ───────────────────────────
// vi.hoisted runs before vi.mock factories and module evaluation.
// This ensures UPSTASH env vars are available when the route module's
// module-level code checks for them.

const { mockLimit, mockGetSafeAuthContext } = vi.hoisted(() => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  return {
    mockLimit: vi.fn(),
    mockGetSafeAuthContext: vi.fn(),
  };
});

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock('@upstash/redis', () => {
  // Must use regular function (not arrow) for constructor compatibility (vitest 4.x)
  function MockRedis() { return { url: 'mock' }; }
  return { Redis: MockRedis };
});

vi.mock('@upstash/ratelimit', () => {
  // Must use regular function (not arrow) for constructor compatibility (vitest 4.x)
  function MockRatelimit() { return { limit: mockLimit }; }
  MockRatelimit.slidingWindow = vi.fn().mockReturnValue('sliding-window-config');
  return { Ratelimit: MockRatelimit };
});

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
}));

vi.mock('ai', () => ({
  streamText: vi.fn(() => ({
    toDataStreamResponse: vi.fn(() => new Response('stream data', { status: 200 })),
  })),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn(() => ({})),
}));

vi.mock('@/lib/tools/visibility-tools', () => ({
  makeVisibilityTools: vi.fn(() => ({})),
}));

// ── Import route handler AFTER mocks (vi.mock is hoisted) ────────────────

import { POST } from '@/app/api/chat/route';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeChatRequest(body = { messages: [{ role: 'user', content: 'hello' }] }): Request {
  return new Request('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockLimit.mockReset();
  mockGetSafeAuthContext.mockReset();

  // Default: authenticated org with rate limit passing
  mockGetSafeAuthContext.mockResolvedValue({
    userId: 'user-1',
    email: 'test@test.com',
    orgId: 'org-123',
    role: 'owner',
    plan: 'growth',
    onboarding_completed: true,
  });

  mockLimit.mockResolvedValue({
    success: true,
    limit: 20,
    remaining: 19,
    reset: Date.now() + 3600000,
  });
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('POST /api/chat — rate limiting', () => {
  describe('rate limit enforcement', () => {
    it('returns 429 when org has exceeded 20 requests in the sliding window', async () => {
      mockLimit.mockResolvedValueOnce({
        success: false,
        limit: 20,
        remaining: 0,
        reset: Date.now() + 1800000,
      });

      const res = await POST(makeChatRequest());
      expect(res.status).toBe(429);
    });

    it('returns 429 response body with { error: "rate_limit_exceeded", retry_after: N }', async () => {
      mockLimit.mockResolvedValueOnce({
        success: false,
        limit: 20,
        remaining: 0,
        reset: Date.now() + 1800000,
      });

      const res = await POST(makeChatRequest());
      const body = await res.json();

      expect(body.error).toBe('rate_limit_exceeded');
      expect(body.retry_after).toBeGreaterThan(0);
      expect(body.message).toContain('Too many AI chat requests');
    });

    it('returns 429 with X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After headers', async () => {
      mockLimit.mockResolvedValueOnce({
        success: false,
        limit: 20,
        remaining: 0,
        reset: Date.now() + 1800000,
      });

      const res = await POST(makeChatRequest());

      expect(res.headers.get('X-RateLimit-Limit')).toBe('20');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(res.headers.get('Retry-After')).toBeTruthy();
    });

    it('returns 200 when org is within the rate limit window', async () => {
      const res = await POST(makeChatRequest());
      expect(res.status).toBe(200);
    });

    it('rate limit key is scoped per org (orgA throttled, orgB still succeeds)', async () => {
      // First call: orgA is throttled
      mockLimit.mockResolvedValueOnce({
        success: false,
        limit: 20,
        remaining: 0,
        reset: Date.now() + 1800000,
      });

      const resA = await POST(makeChatRequest());
      expect(resA.status).toBe(429);

      // Verify the limit was called with orgA's key
      expect(mockLimit).toHaveBeenCalledWith('chat:org-123');

      // Second call: orgB succeeds (different org)
      mockGetSafeAuthContext.mockResolvedValueOnce({
        userId: 'user-2',
        email: 'other@test.com',
        orgId: 'org-456',
        role: 'owner',
        plan: 'growth',
        onboarding_completed: true,
      });
      mockLimit.mockResolvedValueOnce({
        success: true,
        limit: 20,
        remaining: 15,
        reset: Date.now() + 3600000,
      });

      const resB = await POST(makeChatRequest());
      expect(resB.status).toBe(200);
      // Verify the limit was called with orgB's key
      expect(mockLimit).toHaveBeenCalledWith('chat:org-456');
    });

    it('unauthenticated request returns 401 before rate limit check (no rate limit credit burned)', async () => {
      mockGetSafeAuthContext.mockResolvedValueOnce(null);

      const res = await POST(makeChatRequest());
      expect(res.status).toBe(401);
      // Verify rate limit was NOT called
      expect(mockLimit).not.toHaveBeenCalled();
    });
  });

  describe('Redis unavailability resilience', () => {
    it('when Redis throws, request is allowed through (fail open — no 500 returned)', async () => {
      mockLimit.mockRejectedValueOnce(new Error('Redis connection refused'));

      const res = await POST(makeChatRequest());
      expect(res.status).toBe(200);
    });

    it('when Redis throws, error is logged to console.error (not swallowed silently)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLimit.mockRejectedValueOnce(new Error('Redis timeout'));

      await POST(makeChatRequest());

      expect(consoleSpy).toHaveBeenCalledWith(
        '[chat] Rate limit check failed — allowing request:',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('rate limit headers on successful requests', () => {
    it('successful 200 response includes X-RateLimit-Limit header', async () => {
      const res = await POST(makeChatRequest());
      expect(res.headers.get('X-RateLimit-Limit')).toBe('20');
    });

    it('successful 200 response includes X-RateLimit-Remaining header', async () => {
      const res = await POST(makeChatRequest());
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('19');
    });
  });
});
