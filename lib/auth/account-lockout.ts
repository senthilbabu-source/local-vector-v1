// ---------------------------------------------------------------------------
// lib/auth/account-lockout.ts — Account Lockout After Failed Logins (§314)
//
// Uses Redis sliding window (same as rate limiter) to track failed login
// attempts per email. After MAX_FAILED_ATTEMPTS within LOCKOUT_WINDOW_SECONDS,
// the account is temporarily locked for LOCKOUT_DURATION_SECONDS.
//
// Fail-open: if Redis is unavailable, lockout is not enforced (AI_RULES §17).
// ---------------------------------------------------------------------------

import { getRedis } from '@/lib/redis';

/** Maximum failed attempts before lockout triggers. */
export const MAX_FAILED_ATTEMPTS = 5;

/** Window in which failed attempts are counted (seconds). */
export const LOCKOUT_WINDOW_SECONDS = 900; // 15 minutes

/** How long the account stays locked after threshold is reached (seconds). */
export const LOCKOUT_DURATION_SECONDS = 900; // 15 minutes

export interface LockoutStatus {
  locked: boolean;
  attemptsRemaining: number;
  retryAfterSeconds?: number;
}

/**
 * Build the Redis key for tracking failed login attempts.
 * Keyed by normalized email to prevent bypass via casing.
 */
function lockoutKey(email: string): string {
  return `lockout:${email.toLowerCase().trim()}`;
}

/**
 * Check whether an account is currently locked out.
 * Fail-open: returns unlocked if Redis is unavailable.
 */
export async function checkAccountLockout(email: string): Promise<LockoutStatus> {
  try {
    const redis = getRedis();
    const key = lockoutKey(email);
    const now = Date.now();
    const windowStart = now - LOCKOUT_WINDOW_SECONDS * 1000;

    // Remove expired entries
    await redis.zremrangebyscore(key, 0, windowStart);

    // Count recent failures
    const failCount = await redis.zcard(key);

    if (failCount >= MAX_FAILED_ATTEMPTS) {
      // Locked — retry after the full lockout duration from now
      return {
        locked: true,
        attemptsRemaining: 0,
        retryAfterSeconds: LOCKOUT_DURATION_SECONDS,
      };
    }

    return {
      locked: false,
      attemptsRemaining: MAX_FAILED_ATTEMPTS - failCount,
    };
  } catch (_e) {
    // AI_RULES §17: Redis failure → fail open
    console.warn('[account-lockout] Redis error, skipping lockout check');
    return { locked: false, attemptsRemaining: MAX_FAILED_ATTEMPTS };
  }
}

/**
 * Record a failed login attempt for the given email.
 * Fail-open: if Redis is unavailable, the failure is silently dropped.
 */
export async function recordFailedLogin(email: string): Promise<void> {
  try {
    const redis = getRedis();
    const key = lockoutKey(email);
    const now = Date.now();
    const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;

    const pipeline = redis.pipeline();
    pipeline.zadd(key, { score: now, member });
    pipeline.expire(key, LOCKOUT_WINDOW_SECONDS);
    await pipeline.exec();
  } catch (_e) {
    console.warn('[account-lockout] Redis error, skipping failure recording');
  }
}

/**
 * Clear failed login attempts for the given email (called on successful login).
 * Fail-open: if Redis is unavailable, the clear is silently dropped.
 */
export async function clearFailedLogins(email: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.del(lockoutKey(email));
  } catch (_e) {
    console.warn('[account-lockout] Redis error, skipping clear');
  }
}
