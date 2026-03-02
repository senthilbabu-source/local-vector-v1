// ---------------------------------------------------------------------------
// lib/rate-limit/types.ts — Rate Limiting Types & Configuration (Sprint 118)
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
  max_requests: number;
  window_seconds: number;
  key_prefix: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_at: number; // Unix timestamp (seconds)
  limit: number;
  retry_after?: number; // seconds until allowed (only when allowed=false)
}

export const RATE_LIMIT_HEADERS = {
  LIMIT: 'X-RateLimit-Limit',
  REMAINING: 'X-RateLimit-Remaining',
  RESET: 'X-RateLimit-Reset',
  RETRY_AFTER: 'Retry-After',
} as const;

/**
 * Requests per minute by plan tier.
 * Generous limits designed to stop abuse, not normal usage.
 */
export const PLAN_RATE_LIMITS: Record<string, RateLimitConfig> = {
  anonymous: { max_requests: 20, window_seconds: 60, key_prefix: 'rl:anon' },
  trial: { max_requests: 60, window_seconds: 60, key_prefix: 'rl:trial' },
  starter: { max_requests: 120, window_seconds: 60, key_prefix: 'rl:starter' },
  growth: { max_requests: 300, window_seconds: 60, key_prefix: 'rl:growth' },
  agency: { max_requests: 600, window_seconds: 60, key_prefix: 'rl:agency' },
} as const;

/** Routes that bypass rate limiting entirely. */
export const RATE_LIMIT_BYPASS_PREFIXES = [
  '/api/webhooks/', // Stripe webhooks — must never be rate limited
  '/api/cron/', // Cron routes — protected by CRON_SECRET
  '/api/email/', // Unsubscribe links — must always work
  '/api/revalidate', // Cache revalidation — server-to-server
] as const;
