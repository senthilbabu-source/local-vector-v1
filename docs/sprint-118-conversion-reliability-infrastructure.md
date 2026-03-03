# Sprint 118 — Conversion & Reliability + Infrastructure

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`,
> `golden-tenant.ts`, `database.types.ts`, `lib/redis.ts`,
> `middleware.ts`, `next.config.ts`, `app/m/[slug]/page.tsx`

---

## 🎯 Objective

Build **Conversion & Reliability + Infrastructure** — the operational layer that keeps LocalVector healthy in production: Slack alerts for SOV drops, Redis-based API rate limiting, edge caching for public menu pages, Sentry error tracking, and a complete README replacing the Next.js boilerplate.

**What this sprint answers:** "How do I know when something goes wrong? How do I prevent abuse? How do I get a new developer onboarded?"

**What Sprint 118 delivers:**
- Slack webhook alert when an org's SOV score drops ≥ 5 points week-over-week (configurable threshold)
- Redis-based rate limiting middleware for all `/api/` routes — tiered limits by plan
- Edge caching for `/m/[slug]` (public menu pages) via Next.js `revalidate` + cache tags
- `POST /api/revalidate` — on-demand cache revalidation for menu pages
- Sentry integration: error tracking wired into Next.js App Router error boundaries and API routes
- `README.md` — complete replacement of Next.js boilerplate with setup instructions, env var documentation, architecture overview, and local dev guide
- `lib/alerts/slack.ts` — Slack webhook sender utility used by the SOV cron
- `lib/rate-limit/` — rate limiting service using the existing `lib/redis.ts` pattern

**What this sprint does NOT build:** PagerDuty/OpsGenie integration, full distributed tracing, database connection pooling changes, custom Sentry dashboards.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read AI_RULES.md                                     — All rules (55 rules as of Sprint 117)
Read CLAUDE.md                                       — Full implementation inventory
Read lib/redis.ts                                    — CRITICAL: existing Redis pattern + client
Read middleware.ts                                   — Current state (Sprint 114 + 117 edits)
Read next.config.ts (or next.config.js)             — Current Next.js config
Read app/m/[slug]/page.tsx                           — Public menu page to add caching to
Read app/api/cron/sov/route.ts                       — Where Slack alert will be called
Read supabase/prod_schema.sql
  § FIND: organizations — plan_tier, slug, name
  § FIND: sov_evaluations — sov_score or share_of_voice column name (exact)
Read lib/supabase/database.types.ts                 — Current types
Read src/__fixtures__/golden-tenant.ts               — All existing fixtures
Read .env.example (if exists)                        — Existing env var documentation
Read package.json                                    — Current dependencies (check for @sentry/nextjs)
```

**Specifically understand before writing code:**

1. **`lib/redis.ts` pattern.** Read the entire file. Every Redis operation in this sprint must use the SAME client initialization and SAME graceful degradation pattern already established. AI_RULES §17: Redis failures must never crash the app. Rate limiting and cache invalidation must both degrade gracefully — if Redis is down, requests pass through (fail open).

2. **The SOV score column name.** Before writing the Slack alert query, find the exact column name in `sov_evaluations` — it may be `sov_score`, `share_of_voice`, or something else. Using the wrong name causes a silent DB error.

3. **`/m/[slug]` caching strategy.** Read the current page implementation. It's a public Server Component. The caching approach is `export const revalidate = 3600` (1-hour ISR) plus on-demand revalidation via `revalidateTag()`. Check whether the page currently uses `noStore()` or any cache-busting that would conflict.

4. **Sentry setup for Next.js App Router.** Requires `instrumentation.ts` at the root, plus `sentry.client.config.ts`, `sentry.server.config.ts`, and `sentry.edge.config.ts`. Check `package.json` to see if `@sentry/nextjs` is already installed before attempting to install it.

5. **Rate limit tiers by plan.** The tier mapping lives in `lib/rate-limit/` — not in middleware. Middleware reads plan from session/header, then applies the correct limit. Public routes use IP-based anonymous limit.

6. **README completeness.** Read `CLAUDE.md` for the current feature inventory. The README is public-facing — explain what LocalVector is, how to set it up locally, and the architecture at a high level. Do NOT reveal proprietary business logic.

---

## 🏗️ Architecture — What to Build

```
lib/alerts/
  index.ts
  slack.ts                    — Slack webhook sender + message builders

lib/rate-limit/
  index.ts
  types.ts                    — RateLimitConfig, RateLimitResult, PLAN_RATE_LIMITS
  rate-limiter.ts             — Core Redis sliding window implementation

app/api/
  revalidate/
    route.ts                  — POST on-demand cache revalidation

instrumentation.ts            — Sentry App Router integration
sentry.client.config.ts
sentry.server.config.ts
sentry.edge.config.ts
app/global-error.tsx          — Top-level error boundary

middleware.ts                 — MODIFY: add rate limiting layer
next.config.ts                — MODIFY: wrap with withSentryConfig
README.md                     — REPLACE boilerplate with complete docs
.env.example                  — CREATE/UPDATE with all env vars
```

---

### Component 1: Types — `lib/rate-limit/types.ts`

```typescript
export interface RateLimitConfig {
  max_requests: number;
  window_seconds: number;
  key_prefix: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_at: number;        // Unix timestamp
  limit: number;
  retry_after?: number;    // seconds until allowed (only when allowed=false)
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
  anonymous: { max_requests: 20,  window_seconds: 60, key_prefix: 'rl:anon'    },
  trial:     { max_requests: 60,  window_seconds: 60, key_prefix: 'rl:trial'   },
  starter:   { max_requests: 120, window_seconds: 60, key_prefix: 'rl:starter' },
  growth:    { max_requests: 300, window_seconds: 60, key_prefix: 'rl:growth'  },
  agency:    { max_requests: 600, window_seconds: 60, key_prefix: 'rl:agency'  },
} as const;

// Routes that bypass rate limiting entirely
export const RATE_LIMIT_BYPASS_PREFIXES = [
  '/api/webhooks/',   // Stripe webhooks — must never be rate limited
  '/api/cron/',       // Cron routes — protected by CRON_SECRET
  '/api/email/',      // Unsubscribe links — must always work
  '/api/revalidate',  // Cache revalidation — server-to-server
] as const;
```

---

### Component 2: Rate Limiter — `lib/rate-limit/rate-limiter.ts`

```typescript
/**
 * Redis sliding window rate limiter.
 * Uses existing lib/redis.ts client — never creates a new Redis connection.
 *
 * checkRateLimit(config, identifier): Promise<RateLimitResult>
 *   identifier: '{key_prefix}:{org_id}' for auth'd, '{key_prefix}:{ip}' for anon
 *
 * Algorithm (Redis sorted set sliding window):
 *   key = '{config.key_prefix}:{identifier}'
 *   now = Date.now() (ms)
 *   window_start = now - (config.window_seconds * 1000)
 *   Pipeline:
 *     ZREMRANGEBYSCORE key -inf window_start   (remove old entries)
 *     ZADD key now now                          (add current request)
 *     ZCARD key                                 (count in window)
 *     EXPIRE key config.window_seconds          (TTL for cleanup)
 *   request_count = ZCARD result
 *   allowed = request_count <= config.max_requests
 *   remaining = max(0, config.max_requests - request_count)
 *   reset_at = ceil((now + config.window_seconds * 1000) / 1000)
 *
 * GRACEFUL DEGRADATION (AI_RULES §17):
 *   If Redis throws: log warning, return { allowed: true, remaining: max, ... }
 *   NEVER block requests due to Redis failure.
 *
 * getRateLimitHeaders(result): Record<string, string>
 *   Pure function. Returns the 4 standard rate limit headers.
 *   Retry-After only included when allowed=false.
 */
```

---

### Component 3: Slack Alerts — `lib/alerts/slack.ts`

```typescript
/**
 * Slack webhook integration. All outbound operational alerts.
 * Uses SLACK_WEBHOOK_URL env var. Missing = silent no-op.
 *
 * sendSlackAlert(message: SlackMessage): Promise<{ sent: boolean; reason?: string }>
 *   POST to SLACK_WEBHOOK_URL. fetch() only — no extra library.
 *   5-second timeout via AbortController.
 *   Never throws. On error: log warning, return { sent: false }.
 *   Missing env var: return { sent: false, reason: 'no_webhook_url' }.
 *
 * buildSOVDropAlert(params): SlackMessage — PURE
 *   params: { org_name, org_id, current_score, previous_score, delta, week_of }
 *   text: "⚠️ SOV Drop Alert: {org_name}"
 *   blocks: header + fields (current, previous, delta, week) + context (org_id)
 *
 * buildFirstMoverAlert(params): SlackMessage — PURE
 *   params: { org_name, query_text, count }
 *   text: "🚀 {count} new first mover opportunities for {org_name}"
 *
 * SOV_DROP_THRESHOLD: number
 *   = parseInt(process.env.SLACK_SOV_DROP_THRESHOLD ?? '5', 10)
 *   Alert fires when delta <= -SOV_DROP_THRESHOLD.
 *
 * These are INTERNAL operational alerts — go to the LocalVector team Slack,
 * not to org users. Org users get the weekly digest email (Sprint 117).
 */
```

---

### Component 4: Middleware Rate Limiting — `middleware.ts` MODIFY

```typescript
/**
 * Third authorized middleware.ts edit (Sprint 114 = domain resolution,
 * Sprint 117 = unsubscribe paths, Sprint 118 = rate limiting).
 * AI_RULES §6 exception. Minimum change only.
 *
 * WHERE: Add rate limiting AFTER domain resolution, BEFORE the auth guard.
 * Early placement means we rate limit before touching Supabase.
 *
 * LOGIC:
 * 1. pathname not starting with '/api/' → skip (no limit on pages)
 * 2. RATE_LIMIT_BYPASS_PREFIXES.some(p => pathname.startsWith(p)) → skip
 * 3. Determine identifier + config:
 *    - If x-org-plan header present (set by Sprint 114 domain resolution):
 *        plan_tier = request.headers.get('x-org-plan')
 *        org_id = request.headers.get('x-org-id')
 *        identifier = org_id, config = PLAN_RATE_LIMITS[plan_tier]
 *    - Else try session (reuse existing Supabase client from auth guard):
 *        same pattern
 *    - Else anonymous:
 *        ip = request.ip ?? request.headers.get('x-forwarded-for') ?? 'unknown'
 *        identifier = ip, config = PLAN_RATE_LIMITS['anonymous']
 * 4. result = await checkRateLimit(config, identifier)
 * 5. if (!result.allowed):
 *      return NextResponse.json(
 *        { error: 'rate_limited', message: 'Too many requests',
 *          retry_after: result.retry_after },
 *        { status: 429, headers: getRateLimitHeaders(result) }
 *      )
 * 6. Continue to next step. Add rate limit headers to outgoing response.
 *
 * Also add /api/revalidate to public routes allowlist so REVALIDATE_SECRET
 * auth works without a user session.
 * This is the only other change — two line additions to the allowlist.
 */
```

---

### Component 5: SOV Cron — `app/api/cron/sov/route.ts` MODIFY

```typescript
/**
 * Add Slack SOV drop alert. Read the file first to find delta computation.
 * Sprint 117 already computes delta for sendWeeklyDigest — reuse that value.
 *
 * After the Sprint 117 void sendWeeklyDigest() call, add:
 *
 * if (delta !== null && delta <= -SOV_DROP_THRESHOLD) {
 *   void sendSlackAlert(buildSOVDropAlert({
 *     org_name, org_id, current_score, previous_score, delta, week_of
 *   }));
 * }
 *
 * Three fire-and-forget calls per org (in order):
 * 1. void notifyOrg(...)          — Sprint 116
 * 2. void sendWeeklyDigest(...)   — Sprint 117
 * 3. void sendSlackAlert(...)     — Sprint 118 (conditional)
 *
 * Change nothing else.
 */
```

---

### Component 6: ISR Caching — `app/m/[slug]/page.tsx` MODIFY

```typescript
/**
 * Read the current page first. Add ISR without changing any UI logic.
 *
 * Add at module level:
 *   export const revalidate = 3600;        // 1-hour ISR
 *   export const dynamicParams = true;     // generate unknown slugs on first request
 *
 * Add generateStaticParams():
 *   export async function generateStaticParams() {
 *     const supabase = createServiceRoleClient();
 *     const { data } = await supabase
 *       .from('organizations')
 *       .select('slug')
 *       .not('slug', 'is', null);
 *     return (data ?? []).map(org => ({ slug: org.slug }));
 *   }
 *
 * Wrap the menu data fetch with unstable_cache:
 *   import { unstable_cache } from 'next/cache';
 *
 *   const getMenuData = unstable_cache(
 *     async (slug: string) => {
 *       // existing fetch logic here — move into this wrapper
 *     },
 *     ['menu-data'],
 *     { revalidate: 3600, tags: [`menu-${slug}`] }
 *   );
 *
 * SAFETY CHECK: Confirm this page only shows PUBLIC data before caching.
 * If the page shows any org-private information, DO NOT add caching
 * and leave a comment explaining why.
 */
```

---

### Component 7: Revalidate Route — `app/api/revalidate/route.ts`

```typescript
/**
 * POST /api/revalidate
 * Server-to-server. Protected by REVALIDATE_SECRET (not user session).
 *
 * Body: { slug?: string; org_id?: string; secret: string }
 *
 * 1. body.secret !== process.env.REVALIDATE_SECRET → 401
 * 2. !body.slug && !body.org_id → 400
 * 3. If org_id provided, no slug: fetch org slug from organizations table
 * 4. revalidateTag(`menu-${slug}`)
 * 5. Return { ok: true, revalidated: slug, timestamp: new Date().toISOString() }
 *
 * Returns 404 if org_id provided but org not found.
 */
```

---

### Component 8: Sentry Files

```typescript
/**
 * instrumentation.ts (project root):
 *   export async function register() {
 *     if (process.env.NEXT_RUNTIME === 'nodejs') {
 *       await import('./sentry.server.config');
 *     }
 *     if (process.env.NEXT_RUNTIME === 'edge') {
 *       await import('./sentry.edge.config');
 *     }
 *   }
 *
 * sentry.client.config.ts:
 *   Sentry.init({
 *     dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
 *     environment: process.env.NODE_ENV,
 *     enabled: process.env.NODE_ENV === 'production',
 *     tracesSampleRate: 0.1,
 *     beforeSend(event) {
 *       if (event.request?.url?.includes('localhost')) return null;
 *       return event;
 *     },
 *   });
 *
 * sentry.server.config.ts + sentry.edge.config.ts:
 *   Same init but using SENTRY_DSN (not NEXT_PUBLIC_SENTRY_DSN).
 *   Same enabled + tracesSampleRate settings.
 *
 * app/global-error.tsx:
 *   'use client'
 *   useEffect(() => { Sentry.captureException(error); }, [error]);
 *   Renders minimal "Something went wrong" + retry button UI.
 *
 * next.config.ts:
 *   Wrap existing config object with withSentryConfig(nextConfig, {
 *     org: process.env.SENTRY_ORG,
 *     project: process.env.SENTRY_PROJECT,
 *     silent: !process.env.CI,
 *     widenClientFileUpload: true,
 *     hideSourceMaps: true,
 *     disableLogger: true,
 *     automaticVercelMonitors: false,
 *   });
 *   READ the existing config fully before wrapping. Preserve all settings.
 */
```

---

### Component 9: README.md — Complete Replacement

Write a real README (not pseudocode). Sections:

1. **# LocalVector** — one-paragraph product description
2. **## Features** — 8-10 shipped features as bullet list
3. **## Tech Stack** — Next.js, Supabase, Upstash Redis, Resend, Stripe, Sentry, Vercel
4. **## Prerequisites** — Node 20+, Supabase CLI, Upstash, Resend
5. **## Local Development Setup** — clone, npm install, supabase start, supabase db reset, npm run dev
6. **## Environment Variables** — table: Variable | Required | Description | Example (all vars from Sprints 111–118)
7. **## Running Tests** — vitest, playwright, tsc --noEmit commands
8. **## Database Migrations** — supabase migration new, db reset, db push
9. **## Deployment** — Vercel, env vars in dashboard, supabase db push post-deploy, SENTRY_AUTH_TOKEN note
10. **## Architecture Notes** — multi-tenancy (org_id RLS), SOV cron flow, white-label routing, Realtime
11. **## License** — Private / Proprietary

Pull actual values from CLAUDE.md for feature names. Do not expose: prompt templates, scoring algorithms, proprietary logic.

---

### Component 10: .env.example — Complete

All env vars from all sprints. Placeholder values only. Grouped with comments.
Groups: Core Supabase, Redis, Email, App URL, AI Providers, Billing, Cron, Monitoring, Alerts, Cache.

---

### Component 11: Golden Tenant Fixtures

```typescript
// Sprint 118 fixtures
import type { RateLimitResult } from '@/lib/rate-limit/types';

export const MOCK_RATE_LIMIT_ALLOWED: RateLimitResult = {
  allowed: true,
  remaining: 59,
  reset_at: Math.floor(Date.now() / 1000) + 60,
  limit: 60,
};

export const MOCK_RATE_LIMIT_BLOCKED: RateLimitResult = {
  allowed: false,
  remaining: 0,
  reset_at: Math.floor(Date.now() / 1000) + 45,
  limit: 60,
  retry_after: 45,
};

export const MOCK_SOV_DROP_ALERT_PARAMS = {
  org_name: 'Charcoal N Chill',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  current_score: 30,
  previous_score: 42,
  delta: -12,
  week_of: '2026-03-01T00:00:00.000Z',
};
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/rate-limiter.test.ts` — 18 tests

```
describe('checkRateLimit — Redis mocked')
  1.  allowed=true when count < max
  2.  allowed=false when count >= max
  3.  remaining = max(0, max - count)
  4.  reset_at is a future Unix timestamp
  5.  retry_after set only when allowed=false
  6.  Redis key = '{key_prefix}:{identifier}'
  7.  calls ZREMRANGEBYSCORE to clean old entries
  8.  calls EXPIRE for auto-cleanup
  9.  returns allowed=true when Redis throws (graceful degradation)
  10. logs warning (not error) on Redis failure

describe('getRateLimitHeaders — pure')
  11. sets X-RateLimit-Limit
  12. sets X-RateLimit-Remaining
  13. sets X-RateLimit-Reset
  14. sets Retry-After only when allowed=false
  15. no Retry-After when allowed=true

describe('PLAN_RATE_LIMITS — constants')
  16. agency > growth > starter > trial > anonymous (by max_requests)
  17. all configs have max_requests, window_seconds, key_prefix
  18. key_prefix values are unique across all plans
```

### Test File 2: `src/__tests__/unit/slack-alerts.test.ts` — 15 tests

```
describe('buildSOVDropAlert — pure')
  1.  text contains org_name and '⚠️'
  2.  blocks include current_score and previous_score
  3.  blocks show delta as negative number
  4.  blocks include formatted week_of

describe('buildFirstMoverAlert — pure')
  5.  text contains org_name, count, and '🚀'

describe('sendSlackAlert — fetch mocked')
  6.  POSTs to SLACK_WEBHOOK_URL with application/json
  7.  request body has text field
  8.  returns { sent: false, reason: 'no_webhook_url' } when env var missing
  9.  returns { sent: false } on fetch error — does NOT throw
  10. returns { sent: false } on 5-second timeout — does NOT throw
  11. returns { sent: true } on HTTP 200 response

describe('SOV_DROP_THRESHOLD')
  12. defaults to 5 when env var not set
  13. reads from SLACK_SOV_DROP_THRESHOLD env var when set
  14. alert condition: delta <= -threshold (not < -threshold)
  15. threshold=5: delta=-5 fires, delta=-4 does not
```

### Test File 3: `src/__tests__/unit/revalidate-route.test.ts` — 7 tests

```
1.  401 when secret missing
2.  401 when secret doesn't match REVALIDATE_SECRET
3.  400 when neither slug nor org_id provided
4.  calls revalidateTag('menu-{slug}') with correct tag
5.  resolves slug from org_id when only org_id provided
6.  returns { ok: true, revalidated: slug, timestamp }
7.  404 when org_id has no matching org
```

### Test File 4: `src/__tests__/unit/middleware-rate-limit.test.ts` — 13 tests

```
1.  bypasses /api/webhooks/
2.  bypasses /api/cron/
3.  bypasses /api/email/
4.  bypasses /api/revalidate
5.  bypasses non-API routes
6.  applies agency limits for agency plan session
7.  applies anonymous limits for unauthenticated request
8.  returns 429 with rate limit headers when blocked
9.  429 body has { error: 'rate_limited', retry_after }
10. adds X-RateLimit-* headers to allowed responses
11. uses org_id as identifier for authenticated users
12. uses IP as identifier for anonymous
13. request passes through when Redis is down (fail open)
```

### Test File 5: `src/__tests__/e2e/infrastructure.spec.ts` — 5 Playwright tests

```
1.  Menu page /m/charcoal-n-chill loads without error
2.  Rate limit headers present on authenticated API response
3.  429 returned when rate limit mocked as exceeded
4.  POST /api/revalidate returns 401 with wrong secret
5.  POST /api/revalidate returns { ok: true } with correct secret
```

---

### Run Commands

```bash
npx vitest run src/__tests__/unit/rate-limiter.test.ts           # 18 tests
npx vitest run src/__tests__/unit/slack-alerts.test.ts           # 15 tests
npx vitest run src/__tests__/unit/revalidate-route.test.ts       # 7 tests
npx vitest run src/__tests__/unit/middleware-rate-limit.test.ts  # 13 tests
npx vitest run                                                    # ALL — zero regressions
npx playwright test src/__tests__/e2e/infrastructure.spec.ts     # 5 Playwright tests
npx tsc --noEmit                                                  # 0 type errors
```

**Total: 53 Vitest + 5 Playwright = 58 tests**

---

## 📂 Files to Create/Modify — 23 files

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/rate-limit/types.ts` | **CREATE** | Types, PLAN_RATE_LIMITS, bypass list |
| 2 | `lib/rate-limit/rate-limiter.ts` | **CREATE** | Sliding window Redis implementation |
| 3 | `lib/rate-limit/index.ts` | **CREATE** | Barrel export |
| 4 | `lib/alerts/slack.ts` | **CREATE** | Webhook sender + message builders |
| 5 | `lib/alerts/index.ts` | **CREATE** | Barrel export |
| 6 | `middleware.ts` | **MODIFY** | Add rate limiting layer |
| 7 | `app/m/[slug]/page.tsx` | **MODIFY** | ISR + unstable_cache + generateStaticParams |
| 8 | `app/api/revalidate/route.ts` | **CREATE** | POST on-demand revalidation |
| 9 | `app/api/cron/sov/route.ts` | **MODIFY** | Add void sendSlackAlert() on drop |
| 10 | `instrumentation.ts` | **CREATE** | Sentry App Router entry point |
| 11 | `sentry.client.config.ts` | **CREATE** | Browser Sentry init |
| 12 | `sentry.server.config.ts` | **CREATE** | Server Sentry init |
| 13 | `sentry.edge.config.ts` | **CREATE** | Edge Sentry init |
| 14 | `app/global-error.tsx` | **CREATE** | Error boundary + Sentry capture |
| 15 | `next.config.ts` | **MODIFY** | Wrap with withSentryConfig() |
| 16 | `README.md` | **REPLACE** | Complete documentation |
| 17 | `.env.example` | **CREATE/UPDATE** | All env vars documented |
| 18 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | 3 new fixtures |
| 19 | `src/__tests__/unit/rate-limiter.test.ts` | **CREATE** | 18 tests |
| 20 | `src/__tests__/unit/slack-alerts.test.ts` | **CREATE** | 15 tests |
| 21 | `src/__tests__/unit/revalidate-route.test.ts` | **CREATE** | 7 tests |
| 22 | `src/__tests__/unit/middleware-rate-limit.test.ts` | **CREATE** | 13 tests |
| 23 | `src/__tests__/e2e/infrastructure.spec.ts` | **CREATE** | 5 Playwright tests |

---

## 🚫 What NOT to Do

1. **DO NOT block requests when Redis is unavailable** — fail open. AI_RULES §17.
2. **DO NOT rate limit cron, webhook, email, or revalidate routes** — bypass list covers all four.
3. **DO NOT use IP rate limiting for authenticated users** — use org_id as identifier.
4. **DO NOT send Slack alert on every cron run** — only when delta <= -SOV_DROP_THRESHOLD.
5. **DO NOT enable Sentry in development** — `enabled: process.env.NODE_ENV === 'production'` in all three configs.
6. **DO NOT break existing next.config.ts** — read fully before wrapping with withSentryConfig().
7. **DO NOT expose business logic in README** — architecture overview only.
8. **DO NOT cache org-private data** — confirm /m/[slug] is fully public before adding ISR.
9. **DO NOT add `revalidate = 0`** — ISR goal, not cache-busting.
10. **DO NOT edit middleware.ts beyond rate limit layer + /api/revalidate allowlist** — AI_RULES §6 third authorized exception.
11. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).
12. **DO NOT use `page.waitForTimeout()` in Playwright**.

---

## ✅ Definition of Done

- [ ] `lib/rate-limit/types.ts` — 5 plan tiers, 4 bypass prefixes, headers constants
- [ ] `rate-limiter.ts` — sliding window, graceful degradation, getRateLimitHeaders() pure
- [ ] `lib/alerts/slack.ts` — never throws, 5s timeout, buildSOVDropAlert() + buildFirstMoverAlert() pure, SOV_DROP_THRESHOLD constant
- [ ] `middleware.ts` MODIFIED — bypass check → identifier → checkRateLimit → 429 or headers; /api/revalidate in allowlist
- [ ] `/m/[slug]` MODIFIED — revalidate=3600, dynamicParams=true, generateStaticParams(), unstable_cache with tag `menu-{slug}`
- [ ] `POST /api/revalidate` — REVALIDATE_SECRET auth, slug or org_id, revalidateTag, { ok, revalidated, timestamp }
- [ ] `app/api/cron/sov/route.ts` MODIFIED — conditional void sendSlackAlert(), 3 fire-and-forget calls total
- [ ] 4 Sentry files created (instrumentation + 3 configs)
- [ ] `app/global-error.tsx` — Sentry.captureException + retry UI
- [ ] `next.config.ts` MODIFIED — withSentryConfig wrapping, existing config preserved
- [ ] `README.md` REPLACED — 11 sections, complete setup guide, env var table
- [ ] `.env.example` — all vars from Sprints 111–118 with placeholder values
- [ ] golden-tenant.ts: 3 new fixtures
- [ ] **53 Vitest + 5 Playwright = 58 tests passing**
- [ ] `npx vitest run` — ALL tests, zero regressions
- [ ] `npx tsc --noEmit` — 0 type errors
- [ ] DEVLOG.md entry written
- [ ] AI_RULES Rule 56 written
- [ ] roadmap.md Sprint 118 marked ✅

---

## ⚠️ Edge Cases

1. **Same-millisecond requests in sliding window** — two requests in the same ms get identical ZADD score+member. Second is a no-op. At ≤600 req/min this is effectively impossible. Acceptable.
2. **org_id not available in middleware** — some public routes have no session. Falls back to IP-based anonymous limits. Correct.
3. **x-org-plan header from Sprint 114** — reuse it to avoid a second Supabase call for rate limit tier lookup.
4. **generateStaticParams() at build time for many orgs** — may be slow. Accept for MVP. Post-launch: add `fallback: 'blocking'` or move to purely dynamic ISR.
5. **Sentry DSN not set in dev** — all configs have `enabled: production`. Sentry.init() no-ops in dev. No noise.
6. **withSentryConfig and existing rewrites/headers** — Sentry's wrapper preserves all existing config. Test with `npx tsc --noEmit` to confirm no breakage.
7. **Slack webhook rate limiting** — Slack allows 1 msg/sec per webhook. Sequential fire-and-forget calls are fine at any realistic org count.

---

## 🔮 AI_RULES Update (Add Rule 56)

```markdown
## 56. 🛡️ Rate Limiting + Alerts + Infrastructure (Sprint 118)

* **Rate limiting fails open:** checkRateLimit() catches ALL Redis errors, returns
  { allowed: true }. Never block traffic due to Redis failure (AI_RULES §17).
* **Bypass list is exhaustive:** webhooks, cron, email, revalidate. Never rate-limit these.
* **org_id for auth'd, IP for anon:** Never IP-rate-limit authenticated users.
* **sendSlackAlert() never throws.** 5s AbortController timeout. Missing
  SLACK_WEBHOOK_URL = silent no-op. SOV drop: conditional, not per-cron-run.
* **ISR for /m/[slug]:** revalidate=3600, unstable_cache, tag='menu-{slug}'.
  On-demand via POST /api/revalidate with REVALIDATE_SECRET. PUBLIC data only.
* **Sentry: production-only, 10% traces.** enabled: NODE_ENV==='production'.
  beforeSend filters localhost. instrumentation.ts is the App Router entry point.
* **middleware.ts edit #3:** Rate limit layer + /api/revalidate allowlist only.
  Existing domain resolution (Sprint 114) and auth guard unchanged.
```

---

## 🗺️ What Comes Next

**Sprint 119 — pgvector Integration:** Install the `vector` Postgres extension, add embedding columns to `menu_items` and `content_drafts`, build the embedding pipeline using OpenAI `text-embedding-3-small`, implement semantic similarity search for menu items, and wire up the first vector-powered feature: "similar queries" on the SOV dashboard.
