// ---------------------------------------------------------------------------
// lib/redis.ts — Centralized Upstash Redis Client
//
// Replaces the deprecated @vercel/kv import across the codebase.
// Uses @upstash/redis which reads env vars in this priority:
//   1. UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
//   2. KV_REST_API_URL / KV_REST_API_TOKEN (backward-compatible fallback)
//
// The existing Vercel environment variables (KV_REST_API_URL, KV_REST_API_TOKEN)
// work without any changes in Vercel's dashboard.
//
// Lazy initialization: the Redis client is only created when first accessed,
// matching the behavior of the previous @vercel/kv export.
//
// AI_RULES §17: KV/Redis is optional infrastructure. All callers MUST wrap
// Redis operations in try/catch and gracefully degrade when unavailable.
// ---------------------------------------------------------------------------

import { Redis } from '@upstash/redis';

let _redis: Redis | null = null;

/**
 * Lazily-initialized Upstash Redis client.
 *
 * Reads connection config from environment variables:
 *   - UPSTASH_REDIS_REST_URL (preferred) or KV_REST_API_URL (fallback)
 *   - UPSTASH_REDIS_REST_TOKEN (preferred) or KV_REST_API_TOKEN (fallback)
 *
 * Throws if neither URL env var is set — callers should check
 * `process.env.KV_REST_API_URL` before calling (existing pattern).
 */
export function getRedis(): Redis {
  if (!_redis) {
    const url =
      process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token =
      process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
      throw new Error(
        '[lib/redis] Missing Redis config. Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN ' +
        '(or KV_REST_API_URL + KV_REST_API_TOKEN).'
      );
    }

    _redis = new Redis({ url, token });
  }
  return _redis;
}
