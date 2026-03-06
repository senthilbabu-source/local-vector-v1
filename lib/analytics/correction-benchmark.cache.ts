// ---------------------------------------------------------------------------
// lib/analytics/correction-benchmark.cache.ts — S23: Redis Cache for Benchmarks
//
// 24-hour TTL cache for correction benchmarks. Fail-open — returns null
// when Redis is unavailable.
// ---------------------------------------------------------------------------

import type { CorrectionBenchmarkData } from './correction-benchmark';
import * as Sentry from '@sentry/nextjs';

const CACHE_KEY = 'lv:correction_benchmarks';
const TTL_SECONDS = 24 * 60 * 60; // 24 hours

let redisClient: { get: (key: string) => Promise<string | null>; set: (key: string, value: string, opts?: { ex: number }) => Promise<unknown> } | null = null;

async function getRedis() {
  if (redisClient) return redisClient;
  try {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
    const { Redis } = await import('@upstash/redis');
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    return redisClient;
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

/**
 * Retrieves cached correction benchmarks. Returns null on miss or error.
 */
export async function getCachedBenchmarks(): Promise<CorrectionBenchmarkData | null> {
  try {
    const redis = await getRedis();
    if (!redis) return null;
    const cached = await redis.get(CACHE_KEY);
    if (!cached) return null;
    return typeof cached === 'string' ? JSON.parse(cached) : cached as CorrectionBenchmarkData;
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

/**
 * Stores correction benchmarks in cache with 24h TTL.
 */
export async function setCachedBenchmarks(data: CorrectionBenchmarkData): Promise<void> {
  try {
    const redis = await getRedis();
    if (!redis) return;
    await redis.set(CACHE_KEY, JSON.stringify(data), { ex: TTL_SECONDS });
  } catch (err) {
    Sentry.captureException(err);
    // Fail-open — cache write failure is non-critical
  }
}
