// ---------------------------------------------------------------------------
// lib/rate-limit/rate-limiter.ts — Redis Sliding Window Rate Limiter (Sprint 118)
//
// Uses existing lib/redis.ts client — never creates a new Redis connection.
// AI_RULES §17: Redis failures must never crash the app. Fail open.
// ---------------------------------------------------------------------------

import { getRedis } from '@/lib/redis';
import type { RateLimitConfig, RateLimitResult } from './types';
import { RATE_LIMIT_HEADERS } from './types';

/**
 * Checks whether a request is within the rate limit using a Redis sorted set
 * sliding window algorithm.
 *
 * GRACEFUL DEGRADATION: If Redis is unavailable, logs a warning and returns
 * { allowed: true } so requests are never blocked due to infrastructure failure.
 */
export async function checkRateLimit(
  config: RateLimitConfig,
  identifier: string,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - config.window_seconds * 1000;
  const key = `${config.key_prefix}:${identifier}`;
  // Unique member to handle same-millisecond requests
  const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;

  try {
    const redis = getRedis();
    const pipeline = redis.pipeline();

    pipeline.zremrangebyscore(key, 0, windowStart); // Remove expired entries
    pipeline.zadd(key, { score: now, member }); // Add current request
    pipeline.zcard(key); // Count requests in window
    pipeline.expire(key, config.window_seconds); // Auto-cleanup TTL

    const results = await pipeline.exec();

    // ZCARD is the 3rd command (index 2)
    const requestCount = (results[2] as number) ?? 0;
    const allowed = requestCount <= config.max_requests;
    const remaining = Math.max(0, config.max_requests - requestCount);
    const resetAt = Math.ceil((now + config.window_seconds * 1000) / 1000);

    const result: RateLimitResult = {
      allowed,
      remaining,
      reset_at: resetAt,
      limit: config.max_requests,
    };

    if (!allowed) {
      result.retry_after = Math.ceil(config.window_seconds - (now - windowStart) / 1000);
    }

    return result;
  } catch (err) {
    // AI_RULES §17: Redis failure → fail open. Never block requests.
    console.warn('[rate-limit] Redis error, allowing request:', err);
    return {
      allowed: true,
      remaining: config.max_requests,
      reset_at: Math.ceil((now + config.window_seconds * 1000) / 1000),
      limit: config.max_requests,
    };
  }
}

/**
 * Builds standard rate limit response headers from a RateLimitResult.
 * Pure function — no side effects.
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    [RATE_LIMIT_HEADERS.LIMIT]: String(result.limit),
    [RATE_LIMIT_HEADERS.REMAINING]: String(result.remaining),
    [RATE_LIMIT_HEADERS.RESET]: String(result.reset_at),
  };

  if (!result.allowed && result.retry_after !== undefined) {
    headers[RATE_LIMIT_HEADERS.RETRY_AFTER] = String(result.retry_after);
  }

  return headers;
}
