# Sprint FIX-4 — Operational Hardening: Env Vars + /api/chat Rate Limiting

> **Claude Code Prompt — Bulletproof Production Fix Edition**
> Paste this entire prompt into Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`
> **Prerequisite:** Sprint FIX-1 complete (`npx tsc --noEmit` = 0 errors). FIX-3 complete (crons registered).

---

## 🎯 Objective

Close two operational gaps that cause silent feature failures on new deployments and expose an AI cost attack surface:

- **[HIGH-2.2]** `.env.local.example` is missing 13 environment variables that are referenced in production code. Every new developer, every Vercel preview deployment, every CI environment that lacks these variables will experience silent failures — cron jobs return 401, Google OAuth breaks, AI features fail quietly, kill switches are unknown and undocumented.
- **[MEDIUM-1.1]** `/api/chat/route.ts` has no per-user or per-org rate limiting. A single compromised account or a runaway client loop can call this endpoint indefinitely, triggering unbounded GPT-4o + tool-call costs with no circuit breaker.

These two fixes are bundled because they share a theme — operational readiness and cost protection — and together they complete the "zero silent failures" guarantee before customer onboarding begins.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                                 — All engineering rules, especially §17 (rate limiting)
Read docs/CLAUDE.md                                   — Architecture, Upstash Redis patterns
Read .env.local.example                               — Current state — see what IS documented
Read app/api/cron/audit/route.ts                      — CRON_SECRET + STOP_AUDIT_CRON usage
Read app/api/cron/sov/route.ts                        — STOP_SOV_CRON usage
Read app/api/cron/citation/route.ts                   — STOP_CITATION_CRON usage
Read app/api/cron/content-audit/route.ts              — STOP_CONTENT_AUDIT_CRON usage
Read app/api/cron/weekly-digest/route.ts              — STOP_DIGEST_CRON usage
Read app/api/cron/refresh-places/route.ts             — STOP_PLACES_REFRESH_CRON usage
Read app/api/cron/refresh-gbp-tokens/route.ts         — STOP_TOKEN_REFRESH_CRON usage
Read app/api/auth/google/route.ts                     — GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
Read lib/ai/providers.ts                              — ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY
Read app/api/chat/route.ts                            — Current chat endpoint (no rate limiting yet)
Read app/api/scan/route.ts                            — REFERENCE: existing Upstash rate limit pattern (AI_RULES §17)
Read lib/supabase/server.ts                           — Auth pattern used in chat route
Read package.json                                     — Confirm upstash/ratelimit is already installed
```

**Pre-implementation diagnosis:**

```bash
# 1. Audit what IS in .env.local.example currently
cat .env.local.example

# 2. Find every process.env reference in production code (not tests)
grep -rn "process\.env\." app/ lib/ --include="*.ts" --include="*.tsx" \
  | grep -v "__tests__\|\.test\.\|\.spec\." \
  | grep -oP "process\.env\.\K[A-Z_]+" \
  | sort -u
# This produces the complete list of env vars referenced in production code

# 3. Find what .env.local.example currently documents
grep -E "^[A-Z_]+=" .env.local.example | cut -d= -f1 | sort
# Compare with output of #2 — the gap is the 13 missing vars

# 4. Confirm CRON_SECRET is used in route files but absent from example
grep -rn "CRON_SECRET" app/api/cron/ --include="*.ts"
grep "CRON_SECRET" .env.local.example
# Expected first: multiple matches. Expected second: no output (it's missing)

# 5. Confirm STOP_*_CRON kill switches exist in route files
grep -rn "STOP_.*_CRON" app/api/cron/ --include="*.ts" | grep "process.env" | sort
# Expected: one STOP_*_CRON per cron route

# 6. Confirm Upstash is already installed (used in /api/scan)
cat package.json | grep upstash
# Expected: @upstash/redis and @upstash/ratelimit in dependencies

# 7. See existing rate limiter pattern in /api/scan
cat app/api/scan/route.ts | head -40
# Understand the Ratelimit import, redis client, and slidingWindow usage

# 8. Check current /api/chat route for any rate limiting
grep -n "ratelimit\|rate_limit\|Ratelimit" app/api/chat/route.ts
# Expected: no output (rate limit is absent)

# 9. Understand auth context in chat route
grep -n "getSafeAuthContext\|getUser\|orgId\|org_id" app/api/chat/route.ts | head -10

# 10. Run full test baseline
npx vitest run 2>&1 | tail -5
```

---

## 🏗️ Architecture — What to Build / Fix

### Part A: Complete `.env.local.example`

#### Step 1: Identify all 13 missing variables

Run the audit command from the pre-flight section. The 13 missing variables are:

| Variable | Used In | Type | Example Value |
|----------|---------|------|---------------|
| `CRON_SECRET` | All 7 cron routes (auth guard) | Required | `your-cron-secret-here` |
| `GOOGLE_CLIENT_ID` | `app/api/auth/google/` | Required | `12345-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `app/api/auth/google/` | Required | `GOCSPX-...` |
| `ANTHROPIC_API_KEY` | `lib/ai/providers.ts` | Required | `sk-ant-api03-...` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | `lib/ai/providers.ts` | Required | `AIza...` |
| `STOP_AUDIT_CRON` | `app/api/cron/audit/route.ts` | Optional kill switch | `false` |
| `STOP_SOV_CRON` | `app/api/cron/sov/route.ts` | Optional kill switch | `false` |
| `STOP_CITATION_CRON` | `app/api/cron/citation/route.ts` | Optional kill switch | `false` |
| `STOP_DIGEST_CRON` | `app/api/cron/weekly-digest/route.ts` | Optional kill switch | `false` |
| `STOP_PLACES_REFRESH_CRON` | `app/api/cron/refresh-places/route.ts` | Optional kill switch | `false` |
| `STOP_CONTENT_AUDIT_CRON` | `app/api/cron/content-audit/route.ts` | Optional kill switch | `false` |
| `STOP_TOKEN_REFRESH_CRON` | `app/api/cron/refresh-gbp-tokens/route.ts` | Optional kill switch | `false` |
| `UPSTASH_REDIS_REST_TOKEN` | `lib/upstash/redis.ts` or direct in routes | Required | `AX...` |

**Verify this list is complete — do not add or omit any variables.** Run the audit command in step #2 of Pre-Flight and compare.

#### Step 2: Add all missing variables to `.env.local.example`

The file must be organized into logical sections with clear comments. Add to the appropriate section if sections exist, or create a well-organized structure if the file is flat.

Append or integrate the following:

```bash
# ═══════════════════════════════════════════════════════════════
# CRON SECURITY
# ═══════════════════════════════════════════════════════════════

# Secret used to authenticate Vercel cron invocations.
# Vercel sends: Authorization: Bearer <CRON_SECRET>
# Generate a strong random value: openssl rand -hex 32
# Must also be set in Vercel dashboard → Project Settings → Environment Variables
CRON_SECRET=your-cron-secret-here

# ═══════════════════════════════════════════════════════════════
# GOOGLE OAUTH (for Google Business Profile and user sign-in)
# ═══════════════════════════════════════════════════════════════

# From Google Cloud Console → APIs & Services → Credentials
# Authorized redirect URIs must include: {BASE_URL}/api/auth/google/callback
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-google-client-secret

# ═══════════════════════════════════════════════════════════════
# AI PROVIDERS
# ═══════════════════════════════════════════════════════════════

# Anthropic API key for Claude-powered features (Fear Engine, content audit)
# From: https://console.anthropic.com/account/keys
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# Google AI API key for Gemini/Search Grounding features (SOV multi-engine)
# From: https://makersuite.google.com/app/apikey
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy-your-key-here

# ═══════════════════════════════════════════════════════════════
# CRON KILL SWITCHES
# Set to "true" to disable a specific cron without unregistering it.
# Useful for pausing expensive AI operations during budget reviews.
# Default: unset or "false" (cron runs normally)
# ═══════════════════════════════════════════════════════════════

STOP_AUDIT_CRON=false
STOP_SOV_CRON=false
STOP_CITATION_CRON=false
STOP_DIGEST_CRON=false
STOP_PLACES_REFRESH_CRON=false
STOP_CONTENT_AUDIT_CRON=false
STOP_TOKEN_REFRESH_CRON=false
```

**After editing, verify no previously documented variable was accidentally removed:**
```bash
grep -E "^[A-Z_]+=\|^# " .env.local.example | head -60
# Read the output — all original variables must still be present
```

---

### Part B: Rate Limit `/api/chat`

#### Step 1: Understand the existing rate limit pattern

Read `app/api/scan/route.ts` carefully. LocalVector already uses Upstash Ratelimit on the public ViralScanner — use the exact same import and pattern:

```typescript
// Existing pattern from /api/scan (AI_RULES §17):
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(N, '1 h'),  // N = requests per hour
  analytics: true,
  prefix: 'localvector_scan',
});
```

The `chat` route is authenticated (unlike `scan` which is public IP-based). Use `orgId` as the rate limit key instead of IP address. This ensures:
- Org-level throttling (a single org can't burn unbounded tokens)
- Multiple users in the same org share the quota
- Key is stable across requests (unlike IPs which change)

#### Step 2: Define the rate limit parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Limit | 20 requests | 20 AI chat messages/hour/org is generous for normal use, stops abuse loops |
| Window | 1 hour | Sliding window — distributes load, avoids cliff-edge resets |
| Key prefix | `localvector_chat` | Namespace isolation from scan rate limiter |
| Key | `chat:{orgId}` | Per-org (not per-user) — teams share the quota |
| Error response | 429 with `retry_after` | RFC 7231 compliant |

**If the org has an Agency tier with multiple active users:** Consider increasing to 50 or 100 requests/hour. Read the current plan structure in `lib/plan-enforcer.ts` and check if plan-based limits are appropriate. If so, implement as:
```typescript
const limit = planSatisfies(org.plan, 'agency') ? 100 : 20;
const ratelimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(limit, '1 h') });
```
If plan-based limits add complexity, defer and use a flat 20/hour limit. Document the decision.

#### Step 3: Implement rate limiting in `app/api/chat/route.ts`

Add the rate limit check **after auth verification** (don't burn rate limit credits for unauthenticated requests) and **before any AI provider calls** (the expensive operation):

```typescript
// In app/api/chat/route.ts:

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize outside the handler for connection reuse across invocations
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const chatRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 h'),
  analytics: true,
  prefix: 'localvector_chat',
});

export async function POST(request: Request) {
  // Step 1: Verify auth (existing code — do not change)
  const ctx = await getSafeAuthContext();
  if (!ctx.ok) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Step 2: Rate limit check (NEW — add here)
  const { success, limit, remaining, reset } = await chatRatelimit.limit(`chat:${ctx.orgId}`);
  if (!success) {
    return new Response(
      JSON.stringify({
        error: 'rate_limit_exceeded',
        message: 'Too many AI chat requests. Please wait before sending more messages.',
        retry_after: Math.ceil((reset - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
          'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  // Step 3: Existing AI provider call (do not change)
  // ... rest of the existing handler
}
```

**Critical implementation rules:**
- The redis client and ratelimit instance must be initialized **outside** the handler function (module-level). Initializing inside the handler creates a new connection on every request — very slow and wasteful.
- Add `X-RateLimit-*` response headers to both 429 responses AND successful responses (so the client can monitor usage).
- Do NOT catch errors from `chatRatelimit.limit()` silently — if Redis is unavailable, let the error propagate (fail open is acceptable for rate limiting; fail closed would block all users).

#### Step 4: Handle Redis unavailability gracefully

Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to the missing env vars section of `.env.local.example` if they are not already there. Also add a startup check:

```typescript
// Optional: warn at module load time if Upstash env vars are missing
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.warn('[chat] UPSTASH_REDIS_REST_URL or TOKEN not set — rate limiting disabled');
}
```

If Upstash env vars are missing (local dev without Redis configured), the `Ratelimit.limit()` call will throw. Wrap with a try-catch that logs the error but allows the request through:

```typescript
let rateLimitResult = { success: true, limit: 20, remaining: 20, reset: Date.now() + 3600000 };
try {
  rateLimitResult = await chatRatelimit.limit(`chat:${ctx.orgId}`);
} catch (e) {
  console.error('[chat] Rate limit check failed — allowing request:', e);
}

if (!rateLimitResult.success) {
  // ... 429 response
}
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### New Test File 1: `src/__tests__/unit/env-completeness.test.ts`

```
describe('.env.local.example completeness')

  describe('critical required variables are documented')
    1.  CRON_SECRET is documented in .env.local.example
    2.  GOOGLE_CLIENT_ID is documented
    3.  GOOGLE_CLIENT_SECRET is documented
    4.  ANTHROPIC_API_KEY is documented
    5.  GOOGLE_GENERATIVE_AI_API_KEY is documented
    6.  UPSTASH_REDIS_REST_URL is documented
    7.  UPSTASH_REDIS_REST_TOKEN is documented

  describe('cron kill switch variables are documented')
    8.  STOP_AUDIT_CRON is documented
    9.  STOP_SOV_CRON is documented
    10. STOP_CITATION_CRON is documented
    11. STOP_DIGEST_CRON is documented
    12. STOP_PLACES_REFRESH_CRON is documented
    13. STOP_CONTENT_AUDIT_CRON is documented
    14. STOP_TOKEN_REFRESH_CRON is documented

  describe('all production env vars are documented')
    15. every process.env.X reference in app/ and lib/ is present in .env.local.example
        (reads .env.local.example and scans source for process.env.VAR_NAME usage)
```

**Implementation:** Test 15 uses `glob` or `fs.readdirSync` to scan `app/**/*.ts`, `app/**/*.tsx`, `lib/**/*.ts` for `process.env.VARIABLE_NAME` patterns. Extracts variable names. Checks each against the keys present in `.env.local.example`. Fails with a readable message listing which variables are referenced in code but missing from the example file.

**15 tests total.**

### New Test File 2: `src/__tests__/unit/chat-rate-limit.test.ts`

```
describe('POST /api/chat — rate limiting')

  describe('rate limit enforcement')
    1.  returns 429 when org has exceeded 20 requests in the sliding window
    2.  returns 429 response body with { error: "rate_limit_exceeded", retry_after: N }
    3.  returns 429 with X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After headers
    4.  returns 200 when org is within the rate limit window
    5.  rate limit key is scoped per org (orgA throttled, orgB still succeeds)
    6.  unauthenticated request returns 401 before rate limit check (no rate limit credit burned)

  describe('Redis unavailability resilience')
    7.  when Redis throws, request is allowed through (fail open — no 500 returned)
    8.  when Redis throws, error is logged to console.error (not swallowed silently)

  describe('rate limit headers on successful requests')
    9.  successful 200 response includes X-RateLimit-Limit header
    10. successful 200 response includes X-RateLimit-Remaining header
```

**Mock strategy:**
```typescript
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: vi.fn().mockImplementation(() => ({
    limit: vi.fn().mockResolvedValue({ success: true, limit: 20, remaining: 19, reset: Date.now() + 3600000 }),
  })),
}));

// For throttled test: override the mock for that test
vi.mocked(mockRatelimitInstance.limit).mockResolvedValueOnce({
  success: false, limit: 20, remaining: 0, reset: Date.now() + 1800000
});
```

**10 tests total.**

### Extend existing cron tests: Kill switch coverage

Add to `src/__tests__/unit/cron-auth-guard.test.ts` (created in FIX-3):

```
describe('cron kill switch behavior')
  11. /api/cron/audit returns { skipped: true } when STOP_AUDIT_CRON=true
  12. /api/cron/sov returns { skipped: true } when STOP_SOV_CRON=true
  13. /api/cron/audit runs normally when STOP_AUDIT_CRON=false or unset
```

**3 additional tests.**

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `.env.local.example` | **MODIFY** | Add 13 missing env var entries with explanatory comments |
| 2 | `app/api/chat/route.ts` | **MODIFY** | Add Upstash sliding window rate limit (20 req/hr/org) |
| 3 | `src/__tests__/unit/env-completeness.test.ts` | **CREATE** | 15 env var coverage tests |
| 4 | `src/__tests__/unit/chat-rate-limit.test.ts` | **CREATE** | 10 rate limit behavior tests |
| 5 | `src/__tests__/unit/cron-auth-guard.test.ts` | **MODIFY** | Add 3 kill switch tests |

---

## 🚫 What NOT to Do

1. **DO NOT add actual secrets to `.env.local.example`** — the file is committed to git. All values must be placeholder strings (`your-secret-here`, `false`, `sk-ant-api03-...`).
2. **DO NOT initialize the Redis client inside the POST handler** — module-level initialization is required for connection reuse. One connection per invocation is O(n) and will exhaust Upstash connection limits.
3. **DO NOT change the rate limit to per-user** — use `orgId` not `userId`. Reason: the chat assistant is an org tool; if one user is heavy, the team should collectively manage usage. Also, `orgId` is always available in `getSafeAuthContext()` result.
4. **DO NOT block all requests when Redis is down** — the fail-open pattern (allow through if Redis errors) is intentional. AI chat is user-facing; losing rate limiting is acceptable downtime, blocking all chat when Redis hiccups is not.
5. **DO NOT remove any variable already in `.env.local.example`** — only add. The existing documented vars are correct.
6. **DO NOT add `OPENAI_API_KEY` unless it is actually referenced in the codebase** — only document variables that exist in production code. Adding phantom vars creates confusion.
7. **DO NOT change the existing `/api/scan` rate limit** — that is a separate endpoint with a separate use case (public ViralScanner). Copy the pattern, do not modify the original.
8. **DO NOT use `page.waitForTimeout()` in any tests.**
9. **DO NOT commit with secrets** — run `git diff .env.local.example` before committing and confirm all values are placeholders.

---

## ✅ Definition of Done (AI_RULES §13.5)

- [ ] `.env.local.example` documents all 13 previously-missing variables with clear comments
- [ ] `.env.local.example` is organized into logical sections (Auth, AI, Crons, Kill Switches)
- [ ] No actual secrets appear in `.env.local.example` (verified with `git diff`)
- [ ] `app/api/chat/route.ts` — Upstash sliding window rate limit (20 req/hr/org)
- [ ] Rate limit check runs AFTER auth check (not before — no wasted credits on 401)
- [ ] 429 response includes `retry_after`, `error: "rate_limit_exceeded"`, and `X-RateLimit-*` headers
- [ ] Redis client initialized at module level (not inside handler)
- [ ] Fail-open behavior when Redis is unavailable (try-catch, allow through, log error)
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `src/__tests__/unit/env-completeness.test.ts` — **15 tests passing**
- [ ] `src/__tests__/unit/chat-rate-limit.test.ts` — **10 tests passing**
- [ ] `src/__tests__/unit/cron-auth-guard.test.ts` — **13 tests passing** (10 original + 3 kill switch)
- [ ] `npx vitest run` — all tests passing, zero regressions
- [ ] DEVLOG.md entry written

---

## 🔮 AI_RULES Update (Append to `docs/AI_RULES.md`)

```markdown
## §59. Environment Variable Documentation (FIX-4)

Every environment variable referenced as `process.env.VAR_NAME` in `app/` or `lib/` MUST be documented in `.env.local.example` with a comment explaining its purpose and where to obtain the value.

**Enforcement:** `src/__tests__/unit/env-completeness.test.ts` scans all production source files and fails if any `process.env.X` reference is missing from `.env.local.example`.

**Rule:** Never add a new env var reference to production code without simultaneously adding it to `.env.local.example`.

## §60. Rate Limiting for AI Endpoints (FIX-4)

All endpoints that trigger AI model calls (OpenAI, Anthropic, Google Gemini) MUST implement Upstash rate limiting using the pattern from `app/api/scan/route.ts` and `app/api/chat/route.ts`.

**Pattern:**
- Authenticated endpoints: key = `{prefix}:{orgId}` (org-level, not user-level)
- Public endpoints: key = `{prefix}:{ip}` (IP-based, with fallback)
- Default limit: 20 requests/hour/org for AI chat; custom limits for batch operations
- Fail-open: if Redis is unavailable, allow the request through and log the error
- Response: 429 with `retry_after`, `error` body, and `X-RateLimit-*` headers

**Never initialize the Redis client inside a request handler** — always module-level.
```

---

## 📓 DEVLOG Entry Format

```markdown
## [DATE] — Sprint FIX-4: Env Var Documentation + /api/chat Rate Limiting (Completed)

**Problems fixed:**
1. .env.local.example was missing 13 env vars — cron auth, Google OAuth, AI keys, kill switches.
2. /api/chat had no rate limiting — single org/user could trigger unbounded AI costs.

**Changes:**
- `.env.local.example` — Added 13 missing variables with comments, organized into sections (CRON SECURITY, GOOGLE OAUTH, AI PROVIDERS, CRON KILL SWITCHES).
- `app/api/chat/route.ts` — Added Upstash sliding window rate limit: 20 requests/hour/org. Fail-open on Redis unavailability. 429 response with retry_after + X-RateLimit-* headers.
- `AI_RULES.md` — Added §59 (env var documentation) and §60 (AI endpoint rate limiting).

**Tests added:**
- `src/__tests__/unit/env-completeness.test.ts` — **15 Vitest tests.** Required vars documented + source scan for undocumented references.
- `src/__tests__/unit/chat-rate-limit.test.ts` — **10 Vitest tests.** Rate limit enforcement + Redis fail-open + headers.
- `src/__tests__/unit/cron-auth-guard.test.ts` — Extended with **3 kill switch tests** (13 total).

**Result:** All N tests passing. 0 TypeScript errors.
```

---

## 📚 Document Sync + Git Commit

```bash
git add -A
git status   # Verify: .env.local.example, app/api/chat/route.ts, 2 new test files, 1 modified test file
git commit -m "FIX-4: Complete env var documentation + /api/chat rate limiting

- .env.local.example: added 13 missing vars (CRON_SECRET, Google OAuth, AI keys,
  kill switches STOP_*_CRON). Organized into logical sections with comments.
- app/api/chat/route.ts: Upstash sliding window rate limit (20 req/hr/org).
  Fail-open on Redis unavailability. 429 with retry_after + X-RateLimit-* headers.
- AI_RULES: §59 env var documentation rule, §60 AI rate limiting rule
- tests: env-completeness.test.ts (15), chat-rate-limit.test.ts (10),
  cron-auth-guard.test.ts extended with 3 kill switch tests (13 total)

npx tsc --noEmit: 0 errors. All tests passing."
git push origin main
```

---

## 🏁 Sprint Outcome

After FIX-4 completes:
- Zero silent failures from missing environment variables on new deployments
- `/api/chat` protected against runaway cost loops at 20 requests/hour/org
- 28 new tests enforce env coverage and rate limiting behavior permanently
- The kill switch system is documented — any cron can be paused in under 30 seconds by setting `STOP_*_CRON=true` in Vercel dashboard
