// ---------------------------------------------------------------------------
// src/__tests__/unit/p5-fix-22/rate-limit-coverage.test.ts — P5-FIX-22
//
// Tests for systematic rate limiting coverage:
// - Route-specific rate limit configs (ROUTE_RATE_LIMITS)
// - Rate limit header generation
// - Plan-based rate limits (PLAN_RATE_LIMITS)
// - Bypass prefix rules
// - checkRateLimit pure behavior (mocked Redis)
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Redis before importing rate-limiter
// ---------------------------------------------------------------------------

const mockPipeline = {
  zremrangebyscore: vi.fn().mockReturnThis(),
  zadd: vi.fn().mockReturnThis(),
  zcard: vi.fn().mockReturnThis(),
  expire: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([null, null, 1, null]), // 1 request in window
};

vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(() => ({
    pipeline: vi.fn(() => mockPipeline),
  })),
}));

import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit/rate-limiter';
import {
  ROUTE_RATE_LIMITS,
  PLAN_RATE_LIMITS,
  RATE_LIMIT_BYPASS_PREFIXES,
  RATE_LIMIT_HEADERS,
  type RateLimitConfig,
  type RateLimitResult,
} from '@/lib/rate-limit/types';

// ---------------------------------------------------------------------------
// Route-specific rate limit configs
// ---------------------------------------------------------------------------

describe('ROUTE_RATE_LIMITS config', () => {
  it('defines auth login limits (5 req/min)', () => {
    expect(ROUTE_RATE_LIMITS.auth_login.max_requests).toBe(5);
    expect(ROUTE_RATE_LIMITS.auth_login.window_seconds).toBe(60);
  });

  it('defines auth register limits (3 req/min)', () => {
    expect(ROUTE_RATE_LIMITS.auth_register.max_requests).toBe(3);
    expect(ROUTE_RATE_LIMITS.auth_register.window_seconds).toBe(60);
  });

  it('defines destructive operation limits (1 req/hour)', () => {
    expect(ROUTE_RATE_LIMITS.danger_delete_org.max_requests).toBe(1);
    expect(ROUTE_RATE_LIMITS.danger_delete_org.window_seconds).toBe(3600);
    expect(ROUTE_RATE_LIMITS.danger_delete_data.max_requests).toBe(1);
    expect(ROUTE_RATE_LIMITS.danger_delete_data.window_seconds).toBe(3600);
  });

  it('defines AI operation limits', () => {
    expect(ROUTE_RATE_LIMITS.ai_preview.max_requests).toBe(20);
    expect(ROUTE_RATE_LIMITS.content_stream.max_requests).toBe(30);
    expect(ROUTE_RATE_LIMITS.vaio_run.max_requests).toBe(2);
  });

  it('defines team mutation limits', () => {
    expect(ROUTE_RATE_LIMITS.team_mutate.max_requests).toBe(20);
    expect(ROUTE_RATE_LIMITS.billing_sync.max_requests).toBe(5);
  });

  it('defines public endpoint limits', () => {
    expect(ROUTE_RATE_LIMITS.public_search.max_requests).toBe(20);
    expect(ROUTE_RATE_LIMITS.public_menu.max_requests).toBe(30);
  });

  it('all configs have unique key_prefix', () => {
    const prefixes = Object.values(ROUTE_RATE_LIMITS).map((c) => c.key_prefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it('all configs have positive max_requests and window_seconds', () => {
    for (const [name, config] of Object.entries(ROUTE_RATE_LIMITS)) {
      expect(config.max_requests, `${name}.max_requests`).toBeGreaterThan(0);
      expect(config.window_seconds, `${name}.window_seconds`).toBeGreaterThan(0);
    }
  });

  it('auth limits are stricter than plan-based limits', () => {
    // Auth login (5/min) should be stricter than any plan limit
    const lowestPlanLimit = PLAN_RATE_LIMITS.anonymous.max_requests; // 20/min
    expect(ROUTE_RATE_LIMITS.auth_login.max_requests).toBeLessThan(lowestPlanLimit);
    expect(ROUTE_RATE_LIMITS.auth_register.max_requests).toBeLessThan(lowestPlanLimit);
  });
});

// ---------------------------------------------------------------------------
// Plan-based rate limits
// ---------------------------------------------------------------------------

describe('PLAN_RATE_LIMITS', () => {
  it('defines all plan tiers', () => {
    expect(PLAN_RATE_LIMITS.anonymous).toBeDefined();
    expect(PLAN_RATE_LIMITS.trial).toBeDefined();
    expect(PLAN_RATE_LIMITS.starter).toBeDefined();
    expect(PLAN_RATE_LIMITS.growth).toBeDefined();
    expect(PLAN_RATE_LIMITS.agency).toBeDefined();
  });

  it('higher plans have higher limits', () => {
    expect(PLAN_RATE_LIMITS.trial.max_requests).toBeGreaterThan(PLAN_RATE_LIMITS.anonymous.max_requests);
    expect(PLAN_RATE_LIMITS.starter.max_requests).toBeGreaterThan(PLAN_RATE_LIMITS.trial.max_requests);
    expect(PLAN_RATE_LIMITS.growth.max_requests).toBeGreaterThan(PLAN_RATE_LIMITS.starter.max_requests);
    expect(PLAN_RATE_LIMITS.agency.max_requests).toBeGreaterThan(PLAN_RATE_LIMITS.growth.max_requests);
  });
});

// ---------------------------------------------------------------------------
// Bypass prefixes
// ---------------------------------------------------------------------------

describe('RATE_LIMIT_BYPASS_PREFIXES', () => {
  it('includes webhooks, cron, email, revalidate', () => {
    const prefixes = [...RATE_LIMIT_BYPASS_PREFIXES];
    expect(prefixes).toContain('/api/webhooks/');
    expect(prefixes).toContain('/api/cron/');
    expect(prefixes).toContain('/api/email/');
    expect(prefixes).toContain('/api/revalidate');
  });

  it('does not include auth routes', () => {
    for (const prefix of RATE_LIMIT_BYPASS_PREFIXES) {
      expect(prefix).not.toContain('/api/auth/');
    }
  });
});

// ---------------------------------------------------------------------------
// checkRateLimit
// ---------------------------------------------------------------------------

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: 1 request in window (allowed)
    mockPipeline.exec.mockResolvedValue([null, null, 1, null]);
  });

  it('allows request when under limit', async () => {
    const config: RateLimitConfig = { max_requests: 5, window_seconds: 60, key_prefix: 'test' };
    const result = await checkRateLimit(config, 'user-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it('blocks request when at limit', async () => {
    mockPipeline.exec.mockResolvedValue([null, null, 6, null]); // 6 > 5
    const config: RateLimitConfig = { max_requests: 5, window_seconds: 60, key_prefix: 'test' };
    const result = await checkRateLimit(config, 'user-1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retry_after).toBeDefined();
  });

  it('fails open on Redis error', async () => {
    mockPipeline.exec.mockRejectedValue(new Error('Redis down'));
    const config: RateLimitConfig = { max_requests: 5, window_seconds: 60, key_prefix: 'test' };
    const result = await checkRateLimit(config, 'user-1');
    expect(result.allowed).toBe(true); // fail-open
  });
});

// ---------------------------------------------------------------------------
// getRateLimitHeaders
// ---------------------------------------------------------------------------

describe('getRateLimitHeaders', () => {
  it('includes standard headers when allowed', () => {
    const result: RateLimitResult = { allowed: true, remaining: 4, reset_at: 1234567890, limit: 5 };
    const headers = getRateLimitHeaders(result);
    expect(headers[RATE_LIMIT_HEADERS.LIMIT]).toBe('5');
    expect(headers[RATE_LIMIT_HEADERS.REMAINING]).toBe('4');
    expect(headers[RATE_LIMIT_HEADERS.RESET]).toBe('1234567890');
    expect(headers[RATE_LIMIT_HEADERS.RETRY_AFTER]).toBeUndefined();
  });

  it('includes Retry-After when blocked', () => {
    const result: RateLimitResult = {
      allowed: false, remaining: 0, reset_at: 1234567890, limit: 5, retry_after: 30,
    };
    const headers = getRateLimitHeaders(result);
    expect(headers[RATE_LIMIT_HEADERS.RETRY_AFTER]).toBe('30');
  });
});

// ---------------------------------------------------------------------------
// Header constants
// ---------------------------------------------------------------------------

describe('RATE_LIMIT_HEADERS', () => {
  it('uses standard X-RateLimit-* header names', () => {
    expect(RATE_LIMIT_HEADERS.LIMIT).toBe('X-RateLimit-Limit');
    expect(RATE_LIMIT_HEADERS.REMAINING).toBe('X-RateLimit-Remaining');
    expect(RATE_LIMIT_HEADERS.RESET).toBe('X-RateLimit-Reset');
    expect(RATE_LIMIT_HEADERS.RETRY_AFTER).toBe('Retry-After');
  });
});
