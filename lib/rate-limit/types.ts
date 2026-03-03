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

// ---------------------------------------------------------------------------
// P5-FIX-22: Route-specific rate limit configs
//
// Stricter limits for sensitive endpoints, layered on top of plan-based
// middleware limits. These protect against brute force, abuse of expensive
// operations, and destructive actions.
// ---------------------------------------------------------------------------

export const ROUTE_RATE_LIMITS = {
  /** Auth — brute force protection (IP-based) */
  auth_login: { max_requests: 5, window_seconds: 60, key_prefix: 'rl:auth:login' },
  auth_register: { max_requests: 3, window_seconds: 60, key_prefix: 'rl:auth:register' },
  auth_oauth: { max_requests: 10, window_seconds: 60, key_prefix: 'rl:auth:oauth' },

  /** Destructive operations — very tight (org-based) */
  danger_delete_org: { max_requests: 1, window_seconds: 3600, key_prefix: 'rl:danger:org' },
  danger_delete_data: { max_requests: 1, window_seconds: 3600, key_prefix: 'rl:danger:data' },

  /** Expensive AI operations (org-based) */
  ai_preview: { max_requests: 20, window_seconds: 3600, key_prefix: 'rl:ai:preview' },
  content_stream: { max_requests: 30, window_seconds: 3600, key_prefix: 'rl:ai:content' },
  review_generate: { max_requests: 20, window_seconds: 86400, key_prefix: 'rl:review:gen' },
  schema_run: { max_requests: 5, window_seconds: 86400, key_prefix: 'rl:schema:run' },
  vaio_run: { max_requests: 2, window_seconds: 86400, key_prefix: 'rl:vaio:run' },
  nap_sync: { max_requests: 5, window_seconds: 86400, key_prefix: 'rl:nap:sync' },

  /** Team/billing mutations (org-based) */
  team_mutate: { max_requests: 20, window_seconds: 60, key_prefix: 'rl:team:mutate' },
  billing_sync: { max_requests: 5, window_seconds: 60, key_prefix: 'rl:billing:sync' },

  /** Public endpoints (IP-based) */
  public_search: { max_requests: 20, window_seconds: 60, key_prefix: 'rl:pub:search' },
  public_menu: { max_requests: 30, window_seconds: 60, key_prefix: 'rl:pub:menu' },
} as const satisfies Record<string, RateLimitConfig>;
