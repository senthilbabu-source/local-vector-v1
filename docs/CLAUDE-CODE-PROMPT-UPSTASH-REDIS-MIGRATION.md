# Claude Code Prompt #3 — Migrate @vercel/kv → @upstash/redis

## Context

You are working on the **LocalVector.ai** codebase at `local-vector-v1/`. This is a Next.js 16.1.6 app with React 19.2.3, TypeScript, Tailwind CSS 4.2.0. Read `docs/AI_RULES.md` before making any changes.

The codebase currently uses `@vercel/kv` for IP-based rate limiting on two public endpoints. `@vercel/kv` is **deprecated** — Vercel officially recommends migrating to `@upstash/redis`. Internally, `@vercel/kv` is just a thin wrapper around `@upstash/redis` (it literally imports `Redis` from `@upstash/redis` and re-exports it with lazy initialization). The API methods used (`incr`, `expire`, `ttl`) are identical in both packages.

## What This Migration Touches

**Exactly 5 files will be modified. Exactly 0 new files will be created.**

Production code (2 files):
1. `app/actions/marketing.ts` — free scan rate limiter (5 scans/IP/24hr)
2. `app/api/public/places/search/route.ts` — places autocomplete rate limiter (20 searches/IP/hr)

Test code (3 files):
3. `src/__tests__/unit/rate-limit.test.ts` — rate limit tests (6 tests)
4. `src/__tests__/unit/free-scan-pass.test.ts` — free scan tests (11 tests)
5. `src/__tests__/unit/public-places-search.test.ts` — places search tests (8 tests)

**Plus `package.json` (dependency swap).**

## Step 1 — Install @upstash/redis, remove @vercel/kv

```bash
npm install @upstash/redis
npm uninstall @vercel/kv
```

Verify `package.json`:
- `@upstash/redis` should be in `dependencies`
- `@vercel/kv` should be GONE from `dependencies`

**IMPORTANT:** `@upstash/redis` has zero peer dependencies. It requires no additional packages.

## Step 2 — Create the centralized Redis client

Create `lib/redis.ts`:

```typescript
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

/**
 * Convenience re-export matching the old `import { kv } from '@vercel/kv'`
 * usage pattern — but as a function call to preserve lazy initialization.
 *
 * Migration path:
 *   BEFORE:  import { kv } from '@vercel/kv';     kv.incr(key)
 *   AFTER:   import { getRedis } from '@/lib/redis'; getRedis().incr(key)
 */
```

## Step 3 — Update production code

### 3a — `app/actions/marketing.ts`

Make these **exact** changes:

**Change 1:** Replace the import (line 44):
```
BEFORE: import { kv } from '@vercel/kv';
AFTER:  import { getRedis } from '@/lib/redis';
```

**Change 2:** In the `checkRateLimit()` function, replace all 3 instances of `kv.` with `getRedis().`:
```
BEFORE: const count = await kv.incr(key);
AFTER:  const count = await getRedis().incr(key);

BEFORE: if (count === 1) await kv.expire(key, RATE_LIMIT_WINDOW);
AFTER:  if (count === 1) await getRedis().expire(key, RATE_LIMIT_WINDOW);

BEFORE: const ttl = await kv.ttl(key);
AFTER:  const ttl = await getRedis().ttl(key);
```

**Change 3:** Update the deprecation comment near the top of the file (around lines 18-19):
```
BEFORE:
//   Note: @vercel/kv is deprecated; production deployments should use the Upstash
//   Redis integration from the Vercel Marketplace (env vars are identical).

AFTER:
//   Uses @upstash/redis via lib/redis.ts. Reads UPSTASH_REDIS_REST_URL (preferred)
//   or KV_REST_API_URL (Vercel legacy fallback). Env vars are identical.
```

**DO NOT change anything else in this file.** The `KV_REST_API_URL` check at line 112 stays as-is — it's the bypass guard for dev/CI environments.

### 3b — `app/api/public/places/search/route.ts`

Make these **exact** changes:

**Change 1:** Replace the import (line 27):
```
BEFORE: import { kv } from '@vercel/kv';
AFTER:  import { getRedis } from '@/lib/redis';
```

**Change 2:** In the `checkRateLimit()` function, replace both instances of `kv.`:
```
BEFORE: const count = await kv.incr(key);
AFTER:  const count = await getRedis().incr(key);

BEFORE: if (count === 1) await kv.expire(key, RATE_LIMIT_WINDOW);
AFTER:  if (count === 1) await getRedis().expire(key, RATE_LIMIT_WINDOW);
```

**DO NOT change anything else in this file.**

## Step 4 — Update test mocks

All three test files use this mock pattern:
```typescript
vi.mock('@vercel/kv', () => ({
  kv: { incr: vi.fn(), expire: vi.fn(), ttl: vi.fn() },
}));
```

Replace with a mock that matches the new `lib/redis.ts` module:
```typescript
vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(() => ({
    incr: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
  })),
}));
```

**CRITICAL DETAIL:** The old mock created a singleton object with persistent `vi.fn()` instances that could be individually mocked per test (e.g., `vi.mocked(kv.incr).mockResolvedValue(6)`). The new mock needs the SAME capability. Since `getRedis()` now returns a new object each time the mock factory runs, tests that call `vi.mocked(kv.incr)` need a different approach.

**The safest pattern:** Create a shared mock object at the module scope and return it from the mock:

```typescript
const mockRedis = {
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
};
vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(() => mockRedis),
}));
```

Then update all test assertions that previously referenced `kv.incr`, `kv.expire`, `kv.ttl` to reference `mockRedis.incr`, `mockRedis.expire`, `mockRedis.ttl`.

### 4a — `src/__tests__/unit/rate-limit.test.ts`

**Replace the mock block:**
```
BEFORE:
vi.mock('@vercel/kv', () => ({
  kv: { incr: vi.fn(), expire: vi.fn(), ttl: vi.fn() },
}));

AFTER:
const mockRedis = {
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
};
vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(() => mockRedis),
}));
```

**Replace the import:**
```
BEFORE: import { kv } from '@vercel/kv';
AFTER:  // mockRedis is defined above — no import needed
```

**Replace all `kv.incr` / `kv.expire` / `kv.ttl` references in tests:**
```
BEFORE: vi.mocked(kv.expire as ReturnType<typeof vi.fn>).mockResolvedValue(1);
AFTER:  mockRedis.expire.mockResolvedValue(1);

BEFORE: vi.mocked(kv.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(86400);
AFTER:  mockRedis.ttl.mockResolvedValue(86400);

BEFORE: vi.mocked(kv.incr as ReturnType<typeof vi.fn>).mockResolvedValue(1);
AFTER:  mockRedis.incr.mockResolvedValue(1);

BEFORE: vi.mocked(kv.incr as ReturnType<typeof vi.fn>).mockResolvedValue(5);
AFTER:  mockRedis.incr.mockResolvedValue(5);

BEFORE: vi.mocked(kv.incr as ReturnType<typeof vi.fn>).mockResolvedValue(6);
AFTER:  mockRedis.incr.mockResolvedValue(6);

BEFORE: vi.mocked(kv.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(7200);
AFTER:  mockRedis.ttl.mockResolvedValue(7200);

BEFORE: expect(kv.incr).not.toHaveBeenCalled();
AFTER:  expect(mockRedis.incr).not.toHaveBeenCalled();

BEFORE: vi.mocked(kv.incr as ReturnType<typeof vi.fn>).mockRejectedValue(
AFTER:  mockRedis.incr.mockRejectedValue(
```

### 4b — `src/__tests__/unit/free-scan-pass.test.ts`

**Replace the mock block:**
```
BEFORE:
vi.mock('@vercel/kv', () => ({
  kv: { incr: vi.fn(), expire: vi.fn(), ttl: vi.fn() },
}));

AFTER:
const mockRedis = {
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
};
vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(() => mockRedis),
}));
```

**Remove the kv import if present.** This test file does not directly reference `kv.incr` etc. in its assertions — it only mocks `@vercel/kv` because `marketing.ts` imports it. The mock swap is sufficient.

**Check all `beforeEach` / `afterEach` blocks:** If any reference `kv.` directly, update them to `mockRedis.`.

### 4c — `src/__tests__/unit/public-places-search.test.ts`

**Replace the mock block:**
```
BEFORE:
vi.mock('@vercel/kv', () => ({
  kv: { incr: vi.fn(), expire: vi.fn(), ttl: vi.fn() },
}));

AFTER:
const mockRedis = {
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
};
vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(() => mockRedis),
}));
```

**Replace the import:**
```
BEFORE: import { kv } from '@vercel/kv';
AFTER:  // mockRedis is defined above — no import needed
```

**Replace all `kv.` references in test code:**
```
BEFORE: vi.mocked(kv.incr   as ReturnType<typeof vi.fn>).mockResolvedValue(1);
AFTER:  mockRedis.incr.mockResolvedValue(1);

BEFORE: vi.mocked(kv.expire as ReturnType<typeof vi.fn>).mockResolvedValue(1);
AFTER:  mockRedis.expire.mockResolvedValue(1);

BEFORE: vi.mocked(kv.ttl    as ReturnType<typeof vi.fn>).mockResolvedValue(3600);
AFTER:  mockRedis.ttl.mockResolvedValue(3600);

BEFORE: vi.mocked(kv.incr as ReturnType<typeof vi.fn>).mockResolvedValue(21);
AFTER:  mockRedis.incr.mockResolvedValue(21);

BEFORE: expect(kv.incr).not.toHaveBeenCalled();
AFTER:  expect(mockRedis.incr).not.toHaveBeenCalled();

BEFORE: vi.mocked(kv.incr as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('KV down'));
AFTER:  mockRedis.incr.mockRejectedValue(new Error('KV down'));
```

## Step 5 — Verify build and ALL tests

```bash
npm run build
npm run test
```

**Expected test count:** All existing tests must pass. No test count should decrease. Pay specific attention to:
- `rate-limit.test.ts` — 6 tests
- `free-scan-pass.test.ts` — 11 tests
- `public-places-search.test.ts` — 8 tests

If any test fails, STOP and report the exact error. Do NOT modify test assertions or production logic to make tests pass — the migration should be transparent.

## Step 6 — Verify no stale references remain

Run this grep to confirm zero remaining references to `@vercel/kv`:

```bash
grep -rn "@vercel/kv" --include="*.ts" --include="*.tsx" --include="*.json" . | grep -v node_modules | grep -v ".next" | grep -v package-lock
```

**Expected output:** Only `package-lock.json` may still reference `@vercel/kv` as a resolved historical entry. No `.ts`, `.tsx`, or `package.json` file should contain `@vercel/kv`.

If any source file still references `@vercel/kv`, fix it before committing.

## Step 7 — Commit

```
refactor: migrate @vercel/kv → @upstash/redis

@vercel/kv is deprecated. Replaced with direct @upstash/redis dependency.

Changes:
- Created lib/redis.ts: centralized lazy Redis client with getRedis()
- Reads UPSTASH_REDIS_REST_URL (preferred) or KV_REST_API_URL (fallback)
- Updated app/actions/marketing.ts: kv.incr → getRedis().incr
- Updated app/api/public/places/search/route.ts: same pattern
- Updated 3 test files: mock '@/lib/redis' instead of '@vercel/kv'
- Removed @vercel/kv from dependencies

Existing Vercel env vars (KV_REST_API_URL, KV_REST_API_TOKEN) continue
to work without any dashboard changes. Zero breaking changes.
```

## Rules

- Files you may MODIFY: `app/actions/marketing.ts`, `app/api/public/places/search/route.ts`, `src/__tests__/unit/rate-limit.test.ts`, `src/__tests__/unit/free-scan-pass.test.ts`, `src/__tests__/unit/public-places-search.test.ts`, `package.json`
- Files you may CREATE: `lib/redis.ts` (and ONLY this file)
- Do NOT modify `app/globals.css`
- Do NOT modify `lib/ai/providers.ts`
- Do NOT modify any dashboard component
- Do NOT modify `docs/` files (doc sync is a separate step)
- Do NOT create or modify `.env`, `.env.local`, or `.env.test` files
- Do NOT change the `KV_REST_API_URL` env var check in `marketing.ts` line 112 or `route.ts` line 58 — this is the dev/CI bypass guard and must remain as-is
- Do NOT rename env vars in Vercel — the existing `KV_REST_API_URL` and `KV_REST_API_TOKEN` continue to work via `@upstash/redis` fallback
- If `npm run build` or `npm run test` fails, STOP and report — do not attempt fixes to production logic
