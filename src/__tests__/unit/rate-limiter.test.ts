/**
 * Sprint 118 — Rate Limiter Unit Tests (18 tests)
 *
 * Tests the Redis sliding window rate limiter, header builder,
 * and plan rate limit constants.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis before importing the module under test
const mockPipeline = {
  zremrangebyscore: vi.fn().mockReturnThis(),
  zadd: vi.fn().mockReturnThis(),
  zcard: vi.fn().mockReturnThis(),
  expire: vi.fn().mockReturnThis(),
  exec: vi.fn(),
};

const mockRedis = {
  pipeline: vi.fn(() => mockPipeline),
};

vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(() => mockRedis),
}));

import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit/rate-limiter';
import { PLAN_RATE_LIMITS } from '@/lib/rate-limit/types';
import type { RateLimitConfig, RateLimitResult } from '@/lib/rate-limit/types';

const TEST_CONFIG: RateLimitConfig = {
  max_requests: 60,
  window_seconds: 60,
  key_prefix: 'rl:test',
};

describe('checkRateLimit — Redis mocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns allowed=true when count < max', async () => {
    mockPipeline.exec.mockResolvedValueOnce([0, 1, 5, 1]); // ZCARD=5
    const result = await checkRateLimit(TEST_CONFIG, 'user-1');
    expect(result.allowed).toBe(true);
  });

  it('returns allowed=false when count >= max', async () => {
    mockPipeline.exec.mockResolvedValueOnce([0, 1, 61, 1]); // ZCARD=61
    const result = await checkRateLimit(TEST_CONFIG, 'user-1');
    expect(result.allowed).toBe(false);
  });

  it('remaining = max(0, max - count)', async () => {
    mockPipeline.exec.mockResolvedValueOnce([0, 1, 55, 1]);
    const result = await checkRateLimit(TEST_CONFIG, 'user-1');
    expect(result.remaining).toBe(5);
  });

  it('remaining is 0 when count exceeds max', async () => {
    mockPipeline.exec.mockResolvedValueOnce([0, 1, 100, 1]);
    const result = await checkRateLimit(TEST_CONFIG, 'user-1');
    expect(result.remaining).toBe(0);
  });

  it('reset_at is a future Unix timestamp', async () => {
    mockPipeline.exec.mockResolvedValueOnce([0, 1, 1, 1]);
    const result = await checkRateLimit(TEST_CONFIG, 'user-1');
    const now = Math.floor(Date.now() / 1000);
    expect(result.reset_at).toBeGreaterThan(now);
  });

  it('retry_after set only when allowed=false', async () => {
    mockPipeline.exec.mockResolvedValueOnce([0, 1, 61, 1]);
    const result = await checkRateLimit(TEST_CONFIG, 'user-1');
    expect(result.allowed).toBe(false);
    expect(result.retry_after).toBeDefined();
    expect(typeof result.retry_after).toBe('number');
  });

  it('Redis key = "{key_prefix}:{identifier}"', async () => {
    mockPipeline.exec.mockResolvedValueOnce([0, 1, 1, 1]);
    await checkRateLimit(TEST_CONFIG, 'org-abc');
    // ZREMRANGEBYSCORE is called with the key as first arg
    expect(mockPipeline.zremrangebyscore).toHaveBeenCalledWith(
      'rl:test:org-abc',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('calls ZREMRANGEBYSCORE to clean old entries', async () => {
    mockPipeline.exec.mockResolvedValueOnce([0, 1, 1, 1]);
    await checkRateLimit(TEST_CONFIG, 'user-1');
    expect(mockPipeline.zremrangebyscore).toHaveBeenCalledTimes(1);
  });

  it('calls EXPIRE for auto-cleanup', async () => {
    mockPipeline.exec.mockResolvedValueOnce([0, 1, 1, 1]);
    await checkRateLimit(TEST_CONFIG, 'user-1');
    expect(mockPipeline.expire).toHaveBeenCalledWith(
      expect.stringContaining('rl:test:'),
      TEST_CONFIG.window_seconds,
    );
  });

  it('returns allowed=true when Redis throws (graceful degradation)', async () => {
    mockPipeline.exec.mockRejectedValueOnce(new Error('Redis connection refused'));
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await checkRateLimit(TEST_CONFIG, 'user-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(TEST_CONFIG.max_requests);
    consoleSpy.mockRestore();
  });

  it('logs warning (not error) on Redis failure', async () => {
    mockPipeline.exec.mockRejectedValueOnce(new Error('timeout'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await checkRateLimit(TEST_CONFIG, 'user-1');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe('getRateLimitHeaders — pure', () => {
  const allowedResult: RateLimitResult = {
    allowed: true,
    remaining: 55,
    reset_at: 1709337600,
    limit: 60,
  };

  const blockedResult: RateLimitResult = {
    allowed: false,
    remaining: 0,
    reset_at: 1709337600,
    limit: 60,
    retry_after: 45,
  };

  it('sets X-RateLimit-Limit', () => {
    const headers = getRateLimitHeaders(allowedResult);
    expect(headers['X-RateLimit-Limit']).toBe('60');
  });

  it('sets X-RateLimit-Remaining', () => {
    const headers = getRateLimitHeaders(allowedResult);
    expect(headers['X-RateLimit-Remaining']).toBe('55');
  });

  it('sets X-RateLimit-Reset', () => {
    const headers = getRateLimitHeaders(allowedResult);
    expect(headers['X-RateLimit-Reset']).toBe('1709337600');
  });

  it('sets Retry-After only when allowed=false', () => {
    const headers = getRateLimitHeaders(blockedResult);
    expect(headers['Retry-After']).toBe('45');
  });

  it('no Retry-After when allowed=true', () => {
    const headers = getRateLimitHeaders(allowedResult);
    expect(headers['Retry-After']).toBeUndefined();
  });
});

describe('PLAN_RATE_LIMITS — constants', () => {
  it('agency > growth > starter > trial > anonymous (by max_requests)', () => {
    expect(PLAN_RATE_LIMITS['agency'].max_requests).toBeGreaterThan(
      PLAN_RATE_LIMITS['growth'].max_requests,
    );
    expect(PLAN_RATE_LIMITS['growth'].max_requests).toBeGreaterThan(
      PLAN_RATE_LIMITS['starter'].max_requests,
    );
    expect(PLAN_RATE_LIMITS['starter'].max_requests).toBeGreaterThan(
      PLAN_RATE_LIMITS['trial'].max_requests,
    );
    expect(PLAN_RATE_LIMITS['trial'].max_requests).toBeGreaterThan(
      PLAN_RATE_LIMITS['anonymous'].max_requests,
    );
  });

  it('all configs have max_requests, window_seconds, key_prefix', () => {
    for (const [, config] of Object.entries(PLAN_RATE_LIMITS)) {
      expect(config).toHaveProperty('max_requests');
      expect(config).toHaveProperty('window_seconds');
      expect(config).toHaveProperty('key_prefix');
      expect(typeof config.max_requests).toBe('number');
      expect(typeof config.window_seconds).toBe('number');
      expect(typeof config.key_prefix).toBe('string');
    }
  });

  it('key_prefix values are unique across all plans', () => {
    const prefixes = Object.values(PLAN_RATE_LIMITS).map((c) => c.key_prefix);
    const unique = new Set(prefixes);
    expect(unique.size).toBe(prefixes.length);
  });
});
