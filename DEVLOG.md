# LocalVector.ai — Development Log

---

## 2026-02-18 — Phase 3: Core Dashboard Data & RLS Integration (started)

**Context:** Phase 2 (Auth UI & Middleware) complete and manually tested. Beginning Phase 3: replacing all static placeholders in the dashboard with real RLS-scoped data from the local Supabase instance.

**Scope:**
- `lib/auth.ts` — bug-fixed and extended: both `getAuthContext()` and `getSafeAuthContext()` previously queried `memberships.user_id = auth.uid()` which is wrong — `memberships.user_id` references `public.users.id`, a different UUID. Fixed by adding a preceding `public.users` lookup via `auth_provider_id = auth.uid()`, then using the resolved `public.users.id` for the membership join. Also added `fullName: string | null` to `SafeAuthContext`.
- `app/dashboard/layout.tsx` — sidebar now shows the real `full_name` and `email` from the auth context instead of the email-prefix fallback.
- `app/dashboard/page.tsx` — "Welcome back" uses the user's actual first name; stat cards now show live counts from `ai_hallucinations`, `magic_menus`, and `locations` fetched via `createClient()` (user-session, RLS-scoped — not service role).

**Architectural decisions:**
- Count queries use `supabase.select('*', { count: 'exact', head: true })` — Postgres returns only the `count` header with no row data, keeping payloads tiny.
- All three counts are fetched in parallel via `Promise.all` to minimise page render latency.
- Graceful fallback: if a count query errors or returns null (e.g. newly registered user with no data yet), the displayed value falls back to `0` rather than crashing.
- The `full_name` field in `SafeAuthContext` is nullable so the Onboarding Guard polling shape (org-pending state) is not affected.

**Bug discovered:** `getSafeAuthContext()` / `getAuthContext()` had a latent ID mismatch introduced in Phase 1 that was invisible to unit tests (which mock the Supabase client) but would have broken the dashboard for every real login. Fixed in this phase before it caused user-facing issues.

---

## 2026-02-18 — Phase 2: Frontend Auth UI & Middleware (started)

**Context:** Phase 1 (Auth API endpoints) is complete and all unit tests pass. Beginning Phase 2: Next.js Middleware, Auth UI pages, and Dashboard shell.

**Scope:**
- `middleware.ts` — route protection using `supabase.auth.getUser()` (never `getSession()`); secured cookies forwarded to `NextResponse`
- `lib/supabase/middleware.ts` — dedicated middleware Supabase client (reads from `NextRequest` cookies, writes to both request and response so refreshed tokens reach the browser)
- `app/(auth)/login/page.tsx` + `app/(auth)/register/page.tsx` — client-side forms using `react-hook-form` + `@hookform/resolvers/zod`; submit via `fetch()` to our `/api/auth/*` endpoints (never calling Supabase SDK directly from the browser)
- `app/dashboard/layout.tsx` + `page.tsx` — authenticated shell with sidebar, header, and logout button; `LogoutButton` calls `POST /api/auth/logout` then hard-refreshes to `/login`
- `app/page.tsx` updated to redirect to `/dashboard` (middleware handles the onward redirect to `/login` for unauthenticated users)

**Architectural decisions:**
- Auth pages live under `app/(auth)/` route group (no URL segment) so `/login` and `/register` share a centered card layout without affecting `/dashboard` or future marketing pages
- Middleware operates on all non-static routes; the matcher explicitly excludes `_next/`, `api/`, and asset extensions to avoid intercepting health-check or API traffic
- Dashboard data is fetched via `getSafeAuthContext()` in Server Components; the `LogoutButton` is a separate `"use client"` island to avoid forcing the entire layout into a client bundle

---

## 2026-02-18 — Phase 0: Test Environment Debugging & Fixes

**Context:** After running `npx supabase start` and `npx supabase db reset`, the local stack started but the integration tests were failing with networking and JWT errors. Two specific fixes were required.

### Fix 1 — Docker "Ghost Port" Networking Issue

**Symptom:** `supabase start` would report all containers healthy but API calls to `http://localhost:54321` hung or returned connection refused. The Supabase Studio UI also failed to load.

**Root cause:** Stale Docker containers and dangling bridge networks from previous runs were occupying the required ports and conflicting with the new containers. Additionally, the `config.toml` had the analytics service enabled, which adds a dependency on an extra container that can fail silently and block startup.

**Fix:**
```bash
# Kill and remove all existing containers
docker rm -f $(docker ps -aq)

# Prune orphaned networks
docker network prune -f

# Then restart cleanly
npx supabase start
```

And in `supabase/config.toml`, disable analytics to remove the extra dependency:
```toml
[analytics]
enabled = false
```

### Fix 2 — "invalid JWT: token contains an invalid number of segments"

**Symptom:** After starting Supabase, copying the keys from the `supabase start` output into `.env.test` and running the tests, every Supabase client call threw `invalid JWT: token contains an invalid number of segments`.

**Root cause:** The `supabase start` terminal output truncates long JWT tokens with `...` for display purposes. Copying those truncated values into `.env.test` produced malformed tokens that the Supabase client rejected.

**Fix:** Use `npx supabase status -o env` to get the full, untruncated token values in shell-exportable format:
```bash
npx supabase status -o env
# Outputs:
# SUPABASE_URL=http://localhost:54321
# SUPABASE_ANON_KEY=eyJ...full token...
# SUPABASE_SERVICE_ROLE_KEY=eyJ...full token...
```

Copy `SUPABASE_ANON_KEY` → `SUPABASE_LOCAL_ANON_KEY` in `.env.test`.  
Copy `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_LOCAL_SERVICE_ROLE_KEY` in `.env.test`.

The variable names in `.env.test` must exactly match the `process.env.*` references in `src/__helpers__/supabase-test-client.ts` (`SUPABASE_LOCAL_ANON_KEY` and `SUPABASE_LOCAL_SERVICE_ROLE_KEY`).

---

## 2026-02-18 — Phase 0: Next.js Shell + Supabase Auth Bootstrap

**Build Plan ref:** Doc 09, Phase 0 — "Next.js Scaffold" checklist items

### Files Created

| File | Purpose |
|------|---------|
| `package.json` | Next.js 15 scaffold (App Router, TypeScript, Tailwind CSS) |
| `lib/supabase/database.types.ts` | Stub type file; replace with `supabase gen types typescript` output once project is linked |
| `lib/supabase/client.ts` | `createBrowserClient` wrapper for use in Client Components |
| `lib/supabase/server.ts` | `createServerClient` wrapper for Server Components / Route Handlers; also exports `createServiceRoleClient()` for webhook/cron contexts (bypasses RLS) |
| `lib/auth.ts` | Two-variant auth helper (see decisions below) |
| `app/api/v1/auth/context/route.ts` | `GET /api/v1/auth/context` session-bootstrap endpoint (Doc 05 §1.1) |
| `.env.local.example` | Full environment variable manifest (Doc 02 §7) |

### Architectural Decisions

**Two-variant auth helper (`lib/auth.ts`)**
Per the Agent Rule in Doc 02 §4, `getAuthContext()` and `getSafeAuthContext()` are kept as separate exported functions rather than a single function with an options flag.

- `getAuthContext()` — throws on missing session or missing org. Used by all protected API routes where an unauthenticated call is a hard error.
- `getSafeAuthContext()` — never throws; returns `orgId: null` when the `handle_new_user` DB trigger has not yet fired. Used exclusively by `GET /api/v1/auth/context` and the dashboard page loader to support the Onboarding Guard polling pattern (Doc 06 §3).

**`any` casts in Supabase queries**
The `Database` type in `lib/supabase/database.types.ts` is an empty stub until `supabase gen types` is run. To avoid `never`-typed query results blocking compilation, the two join queries in `lib/auth.ts` cast the client to `any` and re-assert the return type explicitly. These casts are annotated with `// eslint-disable-next-line` and will be removed automatically once the generated types replace the stub.

**`createServiceRoleClient` placement**
Exported from `lib/supabase/server.ts` rather than a separate file to keep server-only utilities co-located. It must never be imported from a Client Component — this is enforced by the `'server-only'` boundary implicit in Next.js App Router (server files cannot be bundled into client chunks).

**No `middleware.ts` yet**
Subdomain routing middleware (Doc 02 §3) is intentionally deferred. The `GET /api/v1/auth/context` route works correctly on `localhost` without it; middleware is only required once `app.localvector.ai` and `menu.localvector.ai` domains are configured in Vercel.

---

## 2026-02-18 — Phase 0: Testing Infrastructure

**Build Plan ref:** Doc 09, Phase 0 — "Testing Infrastructure" checklist items  
**Doc ref:** Doc 11, Sections 2–5

### Packages Installed (dev)

| Package | Version | Purpose |
|---------|---------|---------|
| `vitest` | 4.0.18 | Test runner (unit + integration) |
| `@vitest/coverage-v8` | latest | Coverage reports via V8 |
| `msw` | 2.12.10 | Mock Service Worker — intercepts external API calls |
| `@faker-js/faker` | latest | Realistic test data generation |
| `dotenv` | latest | Loads `.env.test` in test setup |

### Files Created

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Vitest configuration with custom path alias strategy |
| `.env.test` | Test environment variables (local Supabase URLs, mock API keys) |
| `src/__fixtures__/golden-tenant.ts` | Charcoal N Chill canonical test data + RIVAL_TENANT |
| `src/__fixtures__/mock-perplexity-responses.ts` | Canned Perplexity API response envelopes for MSW |
| `src/__helpers__/setup.ts` | Global test setup: loads `.env.test`, starts MSW node server |
| `src/__helpers__/supabase-test-client.ts` | `createTestClient`, `createServiceClient`, `seedTenant`, `cleanupTenants` |
| `src/__tests__/integration/rls-isolation.test.ts` | RLS isolation test suite (7 test cases — Doc 11 §5.1) |

### Architectural Decisions

**Path alias strategy (`vitest.config.ts`)**  
The project has no `src/` directory for production code (Next.js files live at root: `lib/`, `app/`). Tests live under `src/`. Vite's alias array is ordered most-specific-first:

```
@/__helpers__ → src/__helpers__   (test utilities)
@/__fixtures__ → src/__fixtures__ (test fixtures)
@/__tests__   → src/__tests__    (cross-test imports)
@/            → ./               (fallback: project root for lib/, app/)
```

This allows test files to import `@/lib/auth` (resolves to `./lib/auth`) and `@/__helpers__/supabase-test-client` (resolves to `./src/__helpers__/supabase-test-client`) using the same `@` prefix, consistent with both `tsconfig.json` and Doc 11's test file imports.

**`seedTenant` resilience pattern**  
`seedTenant` in `supabase-test-client.ts` does not assume the `handle_new_user` PostgreSQL trigger has fired. It checks for an existing membership row first, and if absent (trigger timing in CI, or trigger not yet configured), creates org + membership manually via service role. This prevents flaky tests caused by trigger latency.

**Known schema gap — `ai_hallucinations` INSERT policy**  
`prod_schema.sql` currently has no INSERT policy for regular users on `ai_hallucinations`. The `beforeAll` seed in `rls-isolation.test.ts` uses `tenantA.client` (user-scoped) to insert, per the spec in Doc 11 §5.1. Until the following policy is added to the schema, that seed will fail with an RLS violation:

```sql
CREATE POLICY "org_isolation_insert" ON public.ai_hallucinations
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
```

This is left as a deliberate red test — it surfaces the missing policy when `npx supabase db reset` is run and the test suite is executed. The same gap exists for `magic_menus`. Adding these INSERT policies is a Phase 0 schema task.

---

## 2026-02-18 — Phase 0: Auth API Routes

**Build Plan ref:** Doc 09, Phase 0 — "Auth Flow" checklist items

### Packages Added
`zod` (runtime) — request body validation for all API routes.

### Files Created

| File | Purpose |
|------|---------|
| `lib/schemas/auth.ts` | Zod schemas: `RegisterSchema`, `LoginSchema` and inferred input types |
| `lib/utils/slug.ts` | `toSlug()` / `toUniqueSlug()` — URL-safe slug generator used by register route |
| `app/api/auth/register/route.ts` | `POST /api/auth/register` |
| `app/api/auth/login/route.ts` | `POST /api/auth/login` |
| `app/api/auth/logout/route.ts` | `POST /api/auth/logout` |
| `src/__tests__/unit/auth-routes.test.ts` | 13 unit tests — all passing |

### Architectural Decisions

**Register route follows the idempotent signup pattern (Doc 09)**
Rather than creating the org directly, `POST /api/auth/register` calls `auth.admin.createUser()` with `user_metadata: { full_name }`, which fires the trigger chain:
- `on_auth_user_created` → inserts `public.users` with `full_name` from metadata
- `on_user_created` → inserts `organizations` (name = `"<full_name>'s Venue"`) + `memberships`

The route then `PATCH`es the org name to the user-supplied `business_name`. This matches the build plan's Agent Rule: "Onboarding code MUST perform a PATCH/UPDATE on the existing organization record."

**Register returns 201, not a session**
Registration deliberately does not return a session. The client is instructed to call `POST /api/auth/login` immediately after. This keeps the two operations decoupled — a session failure during registration doesn't mask a successful account creation.

**Login uses SSR cookie client**
`POST /api/auth/login` calls `createClient()` (the SSR server client) so Supabase writes the session into HTTP-only cookies automatically. The response body also returns `access_token` and `refresh_token` for API clients that can't use cookies.

**Logout is idempotent**
`POST /api/auth/logout` always returns 200 regardless of whether a session was active. Errors from `signOut` are intentionally swallowed — the goal is always a clean state.

**Unit test mock strategy**
Route handlers are tested by mocking `@/lib/supabase/server` at the module level with `vi.mock()`. Each Supabase `.from()` call is chained via a `mockReturnValueOnce` sequence, preserving call order for the register route's multi-step DB sequence. No live DB or network needed.

**Atomicity / orphan-cleanup (added)**
The register route wraps all post-auth-creation steps in a `rollback()` helper that calls `auth.admin.deleteUser(authUserId)` before returning any 500. This prevents orphaned Supabase Auth users when the trigger chain or org-name PATCH fails. Two dedicated rollback test cases verify the cleanup fires for both the `public.users` lookup failure and the `memberships` lookup failure. The mock service client now includes `mockAdminDeleteUser` alongside `mockAdminCreateUser`.

**MSW handler registry (`src/__helpers__/msw/handlers.ts`)**
Three named handler groups, imported by `setup.ts` via `setupServer(...handlers)`:

| Group | Behaviour |
|-------|-----------|
| `supabaseHandlers` | `passthrough()` for all `localhost:54321/*` — integration tests hit the real local DB |
| `authApiHandlers` | `passthrough()` for our own `/api/auth/*` routes — safe for future E2E tests |
| `externalApiGuards` | Returns 500 with an instructive error for Perplexity, OpenAI, Google Places, and Resend — prevents accidental paid API calls in any test |

Override per-test with `server.use(http.post(...))` and rely on `afterEach → resetHandlers()` to restore defaults. The `onUnhandledRequest: 'warn'` setting in `setup.ts` is retained so unexpected requests surface as warnings rather than hard failures while the handler registry is still growing.
