# LocalVector.ai — Development Log

---
## 2026-02-20 — Phase 6: Magic Menu Editor (Completed)

**Scope:**
- `supabase/migrations/20260220000001_create_menu_categories.sql` — Migration: creates proper relational `menu_categories` table, drops flat `category VARCHAR` column from `menu_items`, adds `category_id UUID FK`, adds all missing RLS INSERT/UPDATE policies for `menu_categories`, `menu_items`, `magic_menus`, and `ai_hallucinations` (idempotent patches). User ran `npx supabase db reset` successfully.
- `lib/schemas/menu-items.ts` — `CreateCategorySchema` (name, menu_id) + `CreateMenuItemSchema` (name, description?, price, category_id, menu_id) shared between Server Actions and Client forms
- `app/dashboard/magic-menus/[id]/actions.ts` — `createMenuCategory` + `createMenuItem` Server Actions; org_id always from `getSafeAuthContext()`; revalidates `/dashboard/magic-menus/[id]`
- `app/dashboard/magic-menus/[id]/_components/AddCategoryModal.tsx` — react-hook-form modal for adding a category to a menu
- `app/dashboard/magic-menus/[id]/_components/AddItemModal.tsx` — react-hook-form modal: name, category select (pre-selected from row context), price, description; submit disabled when no categories exist
- `app/dashboard/magic-menus/[id]/page.tsx` — Dynamic Server Component (Next.js 16 async params); fetches menu header (joined with locations) + categories (nested with menu_items via Supabase relational select); renders breadcrumb, menu header card with status badge + PublishToggle, category cards each with items table and per-category AddItemModal, global AddCategoryModal; `notFound()` if RLS filters the menu out
- `app/dashboard/magic-menus/page.tsx` — Edit link column added to menus table; each row navigates to `/dashboard/magic-menus/${menu.id}`

**RLS / Security pattern followed:**
- `org_id` derived exclusively from `getSafeAuthContext()` inside every Server Action — never from the client payload
- `revalidatePath()` called after every successful mutation
- `createClient()` (cookie-based SSR client) used throughout — Service Role Key never used in Server Actions
- Client forms: `"use client"` + react-hook-form + zodResolver; submit disabled while `isSubmitting`

---
## 2026-02-20 — Phase 6: Magic Menu Editor (started — pending schema decision)

**Status:** Pre-implementation schema audit surfaced two schema gaps that must be resolved before code is written. See schema findings section below. Implementation is paused pending decision on approach.

**⚠️ Schema Finding 1 — No `menu_categories` Table Exists:**
`prod_schema.sql` has no `menu_categories` table. Categories are a flat `category VARCHAR(100)` column on `menu_items`. There is no `category_id` foreign key anywhere in the schema. The Phase 6 plan assumes a separate categories table — this assumption is incorrect.

**⚠️ Schema Finding 2 — No INSERT or UPDATE RLS Policy on `menu_items`:**
`menu_items` has `org_isolation_select` and `org_isolation_delete` policies only. There is no INSERT or UPDATE policy for authenticated users. Any `createMenuItem` Server Action will hit the RLS Shadowban (silent 0-row insert) until this patch is applied:
```sql
CREATE POLICY "org_isolation_insert" ON public.menu_items
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "org_isolation_update" ON public.menu_items
  FOR UPDATE USING (org_id = public.current_user_org_id());
```

---
## 2026-02-20 — Phase 5: Magic Menu System (Completed)

**Context:** Phase 4 (Locations + Hallucinations CRUD) is complete and verified. Beginning Phase 5: the Magic Menu creation and management UI.

**Scope:**
- `lib/schemas/magic-menus.ts` — Zod schema shared between Server Action and Client form
- `app/dashboard/magic-menus/actions.ts` — `createMagicMenu` + `toggleMenuStatus` Server Actions
- `app/dashboard/magic-menus/page.tsx` — Server Component; fetches menus joined with `locations`
- `app/dashboard/magic-menus/_components/AddMenuModal.tsx` — react-hook-form creation modal
- `app/dashboard/magic-menus/_components/PublishToggle.tsx` — `useTransition` publish/unpublish toggle
- `app/dashboard/layout.tsx` — Magic Menus nav link activated

**⚠️ Required Schema Patch — RLS INSERT Policy Missing on `magic_menus`:**
`prod_schema.sql` currently has no INSERT policy for authenticated users on `magic_menus`. The `createMagicMenu` action will receive a silent RLS rejection (zero rows inserted, no error thrown) until this is applied:
```sql
CREATE POLICY "org_isolation_insert" ON public.magic_menus
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
```
Apply in Supabase Studio → SQL Editor, or add to `supabase/migrations/`. The identical gap exists for `ai_hallucinations` (documented in Phase 0).

**⚠️ Schema Gap — No `name` Column on `magic_menus`:**
The table has no `name` column. The user-supplied name is stored as `public_slug` (via `toUniqueSlug(name)`). The UI uses the linked location name as the primary display label. A future migration should add `name VARCHAR(255)` for cleaner labeling.

**Architectural Decisions (Phase 5)**

* **Zero Client Trust:** Both `createMagicMenu` and `toggleMenuStatus` call `getSafeAuthContext()` to derive `org_id` server-side. Passing `org_id` from the client or omitting it causes RLS to silently reject the row (the "RLS Shadowban" pattern documented in Phase 4).
* **`toggleMenuStatus` is a read-then-write:** The action fetches the current `is_published` state from the DB before toggling, so the server is always the source of truth. This prevents stale client state from causing incorrect toggles.
* **Parallel data fetching:** `fetchPageData()` uses `Promise.all` to fetch menus and locations in parallel, minimising SSR render latency.
* **Supabase relational select:** The page uses `.select('... locations(name, business_name, city, state)')` to join `magic_menus` ↔ `locations` in a single query, avoiding N+1 fetches.

---
## 2026-02-20 — Phase 4: Entity Management & CRUD Views (Completed)

**Scope:** Server Actions for mutations + live CRUD views for Locations and AI Hallucinations.

**Files Added / Changed**

| File | Purpose |
|------|---------|
| `lib/schemas/locations.ts` | Zod schema `CreateLocationSchema` — shared between Server Action (server-side validation) and `AddLocationModal` (client-side `react-hook-form` validation) |
| `app/dashboard/actions.ts` | `createLocation` and `updateHallucinationStatus` Server Actions |
| `app/dashboard/locations/page.tsx` | Server Component — fetches and renders all org locations via RLS-scoped client |
| `app/dashboard/locations/_components/AddLocationModal.tsx` | Client Component — modal form using `react-hook-form` + `zodResolver`; calls `createLocation` Server Action |
| `app/dashboard/hallucinations/page.tsx` | Server Component — fetches all `ai_hallucinations`, renders severity-coded badges |
| `app/dashboard/hallucinations/_components/StatusDropdown.tsx` | Client Component — `<select>` with `useTransition`; calls `updateHallucinationStatus` Server Action |
| `app/dashboard/layout.tsx` | Nav links for `/dashboard/hallucinations` and `/dashboard/locations` now active (Phase 4 routes wired up) |

**Architectural Decisions & Critical Learnings**

**🔴 The RLS Shadowban (Most Critical Learning from Phase 4)**
PostgreSQL RLS fails **silently**. When a policy rejects a write, it does not throw an error — it returns zero affected rows. This manifests in two dangerous ways:

1. **Client-supplied `org_id`:** If the client sends any `org_id` (malicious or mistaken), and it doesn't match `current_user_org_id()`, the INSERT/UPDATE silently affects 0 rows. The UI shows nothing.
2. **Missing `org_id`:** If `org_id` is null, the policy `WITH CHECK (org_id = current_user_org_id())` evaluates to `NULL = UUID` → `false`. Row is silently rejected.

**The mandatory fix for every Server Action that mutates tenant data:**
```typescript
// ALWAYS derive org_id server-side — never accept it from the client
const ctx = await getSafeAuthContext();
if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };
// Use ctx.orgId in the insert payload
await supabase.from('table').insert({ org_id: ctx.orgId, ... });
```
This ensures the application-level `org_id` and the RLS policy always agree, and inserted rows are immediately visible.

* **Defense in Depth:** Even with `getSafeAuthContext()` guarding the entry point, the cookie-based `createClient()` client means RLS policies fire as a second layer.
* **`revalidatePath` on every mutation:** Purges the Next.js RSC payload cache so the page re-fetches fresh data on next navigation without a hard refresh.
* **Schema co-location:** Zod schemas in `lib/schemas/` are importable by both `"use server"` actions and `"use client"` forms without bundling issues.
* **Status dropdown uses `useTransition`, not a full form:** Single-field updates don't need react-hook-form overhead — `useTransition` provides the pending state to disable the control during flight.
* **Slug uniqueness:** `toUniqueSlug()` (timestamp suffix) satisfies `UNIQUE(org_id, slug)` without an extra round-trip.

---
## 2026-02-18 — Phase 3: Core Dashboard Data & RLS Integration (Completed)

**Architectural Fix: User Identity Resolution (`lib/auth.ts`)**
* **The Bug:** The previous `getSafeAuthContext()` was querying `memberships.user_id = auth.uid()`. However, `memberships.user_id` is a foreign key to `public.users.id` (a newly generated UUID), NOT the Supabase Auth ID. This caused silent query failures where `orgId` and `plan` were returning null.
* **The Fix:** Created a new `resolvePublicUser()` helper that queries `public.users` where `auth_provider_id = auth.uid()`, retrieves the correct `public.users.id` and `full_name`, and uses *that* ID for the `memberships` join. 

**Feature Implementation: Dashboard Layout & RLS Metrics**
* **Sidebar (`app/dashboard/layout.tsx`):** Now dynamically displays the real `fullName` and `orgName` fetched securely via the resolved user context.
* **Stat Cards (`app/dashboard/page.tsx`):** Replaced static placeholders with live database counts for `ai_hallucinations`, `magic_menus`, and `locations`.
* **Performance & Security:** Utilized `select('*', { count: 'exact', head: true })` for all metrics. This ensures PostgreSQL's Row-Level Security (RLS) automatically filters the counts to the logged-in user's tenant without transmitting actual row data over the wire.
* **Graceful UI:** Implemented a conditional zero-state that displays an onboarding prompt only if all three metric counts return `0`.

**Testing & Environment Fixes**
* Resolved an integration test failure (`Database error creating new user`) caused by orphaned test users by running `npx supabase db reset`. All 22/22 Vitest tests are now passing.
* Manually verified frontend RLS enforcement: successfully injected a row via local Supabase Studio using a test user's `org_id` and observed the Next.js dashboard securely increment the count from 0 to 1 upon refresh.

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
