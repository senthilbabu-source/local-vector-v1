# LocalVector.ai — AI Agent Instructions

> 🤖 **SYSTEM INSTRUCTION FOR AI AGENTS**
> You are working on **LocalVector.ai**, a mission-critical SaaS for restaurant visibility.
> You MUST follow these rules strictly when generating code, writing tests, or answering questions.

---

## 1. 🛑 CRITICAL: The Database Source of Truth
* **The Schema File:** The executable, authoritative database definition is **`supabase/prod_schema.sql`**.
* **The Rule:** ALWAYS read `prod_schema.sql` to understand table structures, relationships, and RLS policies.
* **The Prohibition:** **DO NOT** use SQL code blocks found in Markdown documentation (e.g., `03-DATABASE-SCHEMA.md`) for implementation. Those are for conceptual reference only and may be outdated.
* **Conflict Resolution:** If a Markdown file conflicts with `prod_schema.sql`, the **SQL file wins**.
* **Backup Files:** **DO NOT** read, reference, or modify any file in `docs/` whose name ends with `_BACKUP.md` (e.g., `00-INDEX_BAKCUP.md`, `03-DATABASE-SCHEMA_BACKUP.md`). These are stale snapshots that predate the current documentation suite. The canonical version of every doc is the file **without** a backup suffix.
* **`docs/20260223000001_sov_engine.sql` — DO NOT PROMOTE:** This SQL file in `docs/` was intentionally NOT moved to `supabase/migrations/`. It creates tables named `sov_target_queries` and `sov_first_mover_alerts`, but the live codebase uses `target_queries` and `sov_evaluations` (from migration `20260221000004`). Promoting it would create orphaned parallel tables and break all existing SOV queries. **Phase 5 agents:** use this file as a schema reference only — the Phase 5 migration must create the correct tables (`target_queries` already exists; write to it).

## Local Development & Seeding
* Every time a new database table or major feature is created, you MUST update `supabase/seed.sql` to insert realistic mock data for that feature. Local development relies on `npx supabase db reset`, so the seed file must always represent the complete, current state of the app's test data.
* **UUID reference card:** `supabase/seed.sql` has a UUID reference card at the top of the file listing every hand-crafted UUID used across all INSERT blocks. When adding new seed rows that require new UUIDs, register them in the reference card first — this prevents collisions and makes FK relationships traceable. Use the existing naming convention (`a0…`, `b0…`, `c0…` prefixes per section). Remember: UUIDs must be hex-only (AI_RULES §7).

## 2. 📐 Data Structures & Types
* **JSONB Columns:** The database uses `JSONB` for flexible data (e.g., `hours_data`, `amenities`, `extracted_data`).
* **The Authority:** You MUST use the **TypeScript interfaces defined in `03-DATABASE-SCHEMA.md` (Section 15)** as the strict schema for these columns.
    * *Example:* Do not invent a shape for `hours_data`. Use the `DayHours` interface defined in Doc 03.
* **Enums:** Always check `prod_schema.sql` for valid Enum values (e.g., `plan_tier`, `hallucination_severity`, `audit_prompt_type`).

## 3. 🔐 Security & Multi-Tenancy
* **RLS is Mandatory:** Every query to a tenant-scoped table (`locations`, `ai_audits`, `magic_menus`) MUST respect Row Level Security.
* **Organization ID:**
    * Every tenant table has an `org_id`.
    * **Never** query tenant data without an `org_id` context.
    * Use the helper `current_user_org_id()` in SQL or the appropriate auth helper in Next.js:
* **Two auth helpers — pick the right one:**
    * `getSafeAuthContext()` — returns `null` when session is absent. Use in **all Server Actions** that return a structured `{ success: false, error: 'Unauthorized' }` response.
    * `getAuthContext()` — **throws** when session is absent. Use only in routes where an unhandled throw is acceptable (e.g., billing checkout).
    * **Never** use `getAuthContext()` in a Server Action — it produces an unhandled server error instead of a clean error response.
* **Auth Provider:** The `public.users` table links to Supabase Auth via `auth_provider_id` (UUID), NOT `id`.

## 4. 🧪 Testing Strategy ("Red-Green-Refactor")
* **Tests are the Spec:** When writing features, create the test file **FIRST** based on the requirements in Docs 04, 05, or 06.
* **Golden Tenant:** All tests must use the **Charcoal N Chill** fixture data defined in `src/__fixtures__/golden-tenant.ts`.
* **Mocking:** NEVER hit real external APIs (Perplexity, OpenAI, Stripe) in tests. Use MSW (Mock Service Worker) handlers.
* **Server Action mock patterns — use the right technique:**
  * **Supabase client:** `vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))` then `vi.mocked(createClient as any).mockResolvedValue({ from: vi.fn(...) })`.
  * **Direct `fetch` calls** (Server Actions that call `fetch` themselves, not via a module): use `vi.stubGlobal('fetch', vi.fn())` — `vi.mock` cannot intercept global fetch.
  * **`setTimeout` mock delays** (SOV/evaluation actions with no API key): use `vi.useFakeTimers()` in `beforeEach` and `await vi.runAllTimersAsync()` before awaiting the result. Without this, tests wait 3 real seconds.
  * **`vi.mock()` declarations must be hoisted** before any `import` statements. File must be read with the `Read` tool before any `Edit` to a test file.

## 5. 💰 Cost & Performance Guardrails
* **No API Calls on Load:** NEVER trigger an LLM API call (OpenAI/Perplexity) directly from a frontend page load. All AI operations must be:
    1.  Scheduled (Cron jobs)
    2.  User-initiated (Button click)
    3.  Cached (Served from Supabase DB).
* **Plan Gating:** Always check feature availability using the helpers in `lib/plan-enforcer.ts` before enabling premium features. Never inline plan-tier checks — always call these functions. The nine exported functions are:
  - `canRunDailyAudit` — daily automated AI audit cron (Growth+)
  - `canRunSovEvaluation` — Share of Voice on-demand evaluation (Growth+)
  - `canRunCompetitorIntercept` — Greed Engine competitor analysis (Growth+)
  - `canRunAutopilot` — Autopilot content draft generation + publish pipeline (Growth+)
  - `canRunPageAudit` — Content Grader / AEO page audit (Growth+)
  - `canRunOccasionEngine` — Occasion Module seasonal scheduler (Growth+)
  - `canConnectGBP` — Google Business Profile OAuth connection (Starter+)
  - `maxLocations` — max locations per org (returns `number`)
  - `maxCompetitors` — max tracked competitors per org (returns `number`)

## 6. 📂 Architecture & Stack
* **Framework:** Next.js 16 (App Router). Use Server Components by default.
* **Styling:** Tailwind CSS v4 + shadcn/ui (manually installed — **NEVER** run `npx shadcn@latest init`, it overwrites `globals.css`).
  * Add new shadcn components via `npx shadcn@latest add <component> --yes --overwrite`. The `.npmrc` has `legacy-peer-deps=true` for Zod v4 compatibility.
  * Components live in `components/ui/`. The `cn()` helper is at `lib/utils.ts` (coexists with `lib/utils/` directory).
  * shadcn CSS variables in `app/globals.css` `:root` are pre-mapped to Deep Night tokens (signal-green → `--primary`, electric-indigo → `--accent`, etc.). See `DESIGN-SYSTEM.md` for the full mapping.
* **Charts:** Tremor Raw (copy-paste) + Recharts. **NEVER `npm install @tremor/react`** — it requires `tailwind.config.js` (incompatible with Tailwind v4).
  * Chart components go in `components/tremor/` (not `components/ui/`).
  * Tremor components import `{ cx }` from `@/lib/utils` and colors from `@/lib/chartUtils`.
  * `cx()` and `cn()` are identical (`twMerge(clsx(…))`). Both exported from `lib/utils.ts`.
* **Routing:**
    * `app.localvector.ai` → Dashboard (Authenticated)
    * `menu.localvector.ai` → Public Magic Menus (Edge Cached, No Auth).
* **Cron Jobs:** All scheduled operations run as **Next.js Route Handlers** at `app/api/cron/*/route.ts`. Every cron endpoint is a standard `GET` handler secured by the `CRON_SECRET` header check. **Do NOT create files under `supabase/functions/`** — Supabase Edge Functions (Deno) are not used in this project.
* **Middleware filename:** The Next.js middleware file is **`proxy.ts`** (at the project root), not `middleware.ts`. This rename follows the Next.js 16 convention adopted on 2026-02-23 (see DEVLOG). Do not create a new `middleware.ts` — it will be ignored by the framework.

## 7. 🔑 PostgreSQL UUID Hex Constraint (Phase 10)
* UUIDs are strictly hexadecimal: only characters `0-9` and `a-f` are valid.
* **Never** generate a mock UUID where any segment starts with a character beyond `f` (e.g., `g0eebc99-...` causes a fatal `invalid input syntax for type uuid` during `npx supabase db reset`).
* When manually crafting dummy UUIDs for `seed.sql`, use only `a`–`f` hex prefixes:
  ```
  ✅ a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
  ✅ b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11
  ❌ g0eebc99-9c0b-4ef8-bb6d-6bb9bd380g11  ← crashes db reset
  ```

## 8. 🔧 Zod v4 Error Syntax
* Zod v4 renamed the `errors` property → `issues` on the `ZodError` object.
* **Never** write `parsed.error.errors[0]?.message` — it returns `undefined` in Zod v4.
* **Always** write `parsed.error.issues[0]?.message`:
  ```typescript
  // ❌ Zod v3 syntax (broken in v4)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input' };
  // ✅ Zod v4 syntax (correct)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  ```

## 9. 📌 Ground Truth Types — Single Source of Truth (Phase 12)
* The canonical TypeScript interfaces for all JSONB columns live in **`lib/types/ground-truth.ts`**.
* **Every** file that touches `hours_data`, `amenities`, `categories`, or `attributes` on the `locations` table MUST import from there.
* Ad-hoc inline type definitions for these columns are a spec violation (AI_RULES §2):
  ```typescript
  // ❌ Inline type — spec violation
  type DayHours = { open: string; close: string } | 'closed';
  // ✅ Import from ground truth
  import { DayHours, HoursData, Amenities } from '@/lib/types/ground-truth';
  ```

## 10. ⏰ JSONB `hours_data` Closed-Day Encoding (Phase 12)
* A **missing day key** in `hours_data` means "hours unknown" — NOT "closed".
* To explicitly mark a day as closed, use the string literal `"closed"`:
  ```json
  {
    "monday": { "open": "11:00", "close": "22:00" },
    "tuesday": "closed",
    "wednesday": { "open": "11:00", "close": "22:00" }
  }
  ```
* The Zod schema in `app/onboarding/actions.ts` accepts `z.literal('closed') | z.object({ open, close })`. No other values are valid.

## 11. 🛡️ The RLS Shadowban — org_id Must Always Be Server-Side (Phase 4)
* PostgreSQL RLS fails **silently**: a rejected `INSERT`/`UPDATE` returns zero affected rows with no error thrown.
* Two failure modes:
  1. **Client-supplied `org_id`:** If it doesn't match `current_user_org_id()`, the write is silently dropped.
  2. **Missing `org_id`:** `NULL = UUID` → `NULL` (falsy) → row silently rejected.
* **Every Server Action that mutates tenant data** MUST derive `org_id` server-side via `getSafeAuthContext()`:
  ```typescript
  // ✅ Mandatory pattern — never accept org_id from the client
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };
  await supabase.from('table').insert({ org_id: ctx.orgId, ...data });
  ```

## 12. 🎨 Tailwind Literal Classes — No Dynamic Concatenation
* Tailwind's JIT compiler requires literal class strings at build time. Dynamically constructed class names are silently omitted from the CSS bundle.
* **Never** build Tailwind class names with template literals or string interpolation:
  ```typescript
  // ❌ Dynamic — class never generated by JIT
  const cls = `text-${color}-500`;
  // ✅ Literal — always included
  const cls = color === 'red' ? 'text-red-500' : 'text-green-500';
  ```
* This applies to all Tailwind utilities: colors, spacing, borders, typography, and design tokens.

## 13. 📓 DEVLOG.md — The Living Engineering Record

`DEVLOG.md` is the authoritative log of every phase, bug fix, and test sprint. An AI agent that
builds something without logging it has created invisible debt. **A phase is NOT "Completed" until
`DEVLOG.md` has an entry for it.**

### 13.1 — When to write a DEVLOG entry
Write or update `DEVLOG.md` at the end of EVERY task that:
- Introduces a new feature, route, component, or Server Action
- Fixes a bug (even a one-line fix — it gets its own `Bug Fix:` header)
- Writes, deletes, or significantly modifies test files
- Clears documented testing debt
- Changes `supabase/seed.sql` or any migration

### 13.2 — DEVLOG entry format
```markdown
## YYYY-MM-DD — Phase N: Short Title (Completed | In Progress)

**Goal:** One sentence describing the objective.

**Scope:**
- `path/to/file.ts` — What changed and why (1–2 sentences per file).

**Tests added:**           ← REQUIRED if any test files were created or modified
- `src/__tests__/path/file.test.ts` — **N Vitest tests.** What they validate.

**Run command:**           ← Include the exact command to verify
```bash
npx vitest run path/to/file.test.ts   # N tests passing
```
```

### 13.3 — Test count rule (no estimation)
**NEVER write a test count from memory or from an agent's report.**
Always verify with:
```bash
grep -cE "^\s*(it|test)\(" src/__tests__/path/to/file.test.ts
```
A wrong count in DEVLOG is documentation debt. If you discover a stale count,
correct it in place and note the correction in the active phase's entry.

### 13.4 — DEVLOG placement
`DEVLOG.md` is reverse-chronological (newest entry at the top, oldest at the bottom).
Insert new entries immediately after the `# LocalVector.ai — Development Log` heading.
Retroactive entries (e.g., clearing old testing debt) are inserted at their chronological
position — between the phases they logically follow and precede.

### 13.5 — Definition of Done checklist
Before marking any phase "Completed", verify all of the following are true:

- [ ] Feature code committed and working locally
- [ ] `supabase/seed.sql` updated if new tables or test users were added
- [ ] Test file(s) written (AI_RULES §4 Red-Green-Refactor)
- [ ] Test counts verified with `grep -cE` and logged in DEVLOG
- [ ] `DEVLOG.md` entry written with **Scope** and **Tests added** sections
- [ ] `AI_RULES.md` updated if a new engineering constraint was discovered
- [ ] `docs/14_TESTING_STRATEGY.md` updated if new test files were added or counts changed
- [ ] `docs/09-BUILD-PLAN.md` acceptance criteria satisfied by this phase ticked with `[x]`
- [ ] `docs/` updated if architecture, the core loop, or test strategy changed

## 14. 🧩 Zod v4 Enum Error Message Format (Phase 21)
* Zod v4 generates enum validation errors in this exact format:
  `'Invalid option: expected one of "optionA"|"optionB"'`
* Custom `errorMap` callbacks in Zod v4 behave differently than v3 — they may not fire for enum/union errors.
* **Never** assert Zod error strings with `.toContain('optionA or optionB')` in tests — that string is never produced.
* **Always** use `.toMatch(/optionA/i)` when asserting on Zod validation error messages:
  ```typescript
  // ❌ Brittle — will never match Zod v4 enum output
  expect(result.error).toContain('openai or perplexity');
  // ✅ Robust — matches regardless of exact Zod v4 phrasing
  expect(result.error).toMatch(/openai/i);
  ```

## 15. 👻 `is_primary` — Ghost Data Prevention (Phase 22 Bug Fix)
* The `locations` table defaults `is_primary` to `FALSE`.
* **Every** dashboard query that matters filters by `.eq('is_primary', true)`:
  the OnboardingGuard, magic-menus page, and dashboard stats.
* A location inserted without `is_primary = true` exists in the database but is **invisible to the entire app** — a "Ghost Location".
* **Rule:** `createLocation()` MUST check whether the org already has a primary location before inserting.
  If no primary location exists, the new insert MUST set `is_primary: true`:
  ```typescript
  // ✅ Mandatory pattern in createLocation()
  const { data: existing } = await supabase
    .from('locations').select('id').eq('org_id', ctx.orgId).eq('is_primary', true).maybeSingle();
  await supabase.from('locations').insert({
    org_id: ctx.orgId,
    is_primary: !existing,   // true only if no primary exists yet
    ...data,
  });
  ```

## 16. 🔄 `revalidatePath` Must Target the Consuming Layout (Phase 22 Bug Fix)
* `revalidatePath('/dashboard/locations')` does **NOT** invalidate `app/dashboard/layout.tsx`.
  The OnboardingGuard in the layout only re-runs when `/dashboard` itself is invalidated.
* **Rule:** Any Server Action whose mutation should trigger a layout-level guard re-check
  (e.g., the OnboardingGuard) MUST call `revalidatePath('/dashboard')`, not just the sub-route:
  ```typescript
  // ❌ Sub-route only — layout guard does NOT re-run
  revalidatePath('/dashboard/locations');
  // ✅ Parent path — layout guard re-runs on next navigation
  revalidatePath('/dashboard');
  ```
* For actions that only affect a single page and have no layout-guard dependency,
  the specific path (`revalidatePath('/dashboard/share-of-voice')`) is fine and preferred.

## 17. 🛟 Side-Effect Resilience — Always Use `.catch()` (Phase 21)
* Non-critical side effects (email alerts, analytics pings, webhook calls) inside a
  Server Action or cron route MUST be wrapped in `.catch()`.
* A side-effect failure must **never** abort the primary write operation:
  ```typescript
  // ❌ Uncaught — a Resend failure aborts the entire cron run
  await sendHallucinationAlert({ to: ownerEmail, ... });

  // ✅ Absorbed — cron run completes regardless of email status
  await sendHallucinationAlert({ to: ownerEmail, ... })
    .catch((err: unknown) => console.error('[cron] Email failed:', err));
  ```
* This pattern applies to: email (Resend), Slack/Discord webhooks, analytics events,
  third-party audit pings — anything that is not the primary DB write.

## 18. 🗝️ `createClient()` vs `createServiceRoleClient()` — Role Selection (Phase 21)
* **`createClient()`** — cookie-based, RLS-scoped. The only client permitted in:
  - Server Actions (`'use server'` functions)
  - Page-level data fetching (RSC `async` functions)
  - Any context where a user session exists
* **`createServiceRoleClient()`** — bypasses ALL RLS policies. Permitted ONLY in:
  - Cron route handlers (`app/api/cron/*/route.ts`) — no user session in background jobs
  - Admin seed scripts and Supabase migrations
  - Test `beforeAll`/`afterAll` blocks in integration tests
* **Never** use `createServiceRoleClient()` inside a user-facing Server Action —
  it bypasses the tenant isolation that RLS enforces.
* **Belt-and-suspenders for SELECT queries:** Even with RLS active, OR'd SELECT policies
  (e.g., `org_isolation_select` OR `public_published_location`) can expose cross-tenant rows.
  Always add an explicit `.eq('org_id', orgId)` filter to SELECT queries on tenant tables —
  do not rely on RLS alone:
  ```typescript
  // ❌ RLS alone — OR'd policies can leak cross-tenant rows
  const { data } = await supabase.from('locations').select('*').eq('is_primary', true);

  // ✅ Belt-and-suspenders — explicit org scope + RLS
  const { data } = await supabase.from('locations').select('*')
    .eq('org_id', ctx.orgId).eq('is_primary', true);
  ```

## 19. 🥊 Competitor Intercept — JSONB Types, Plan Limits, and MSW Discrimination (Phase 3)

### 19.1 — `GapAnalysis` JSONB type (§15.7)
* The `competitor_intercepts.gap_analysis` column is typed as `GapAnalysis` from `lib/types/ground-truth.ts`.
* **Every** file that reads or writes `gap_analysis` MUST import from there — never define an inline type:
  ```typescript
  // ❌ Inline — spec violation
  type GapAnalysis = { competitor_mentions: number; your_mentions: number };
  // ✅ Ground truth import
  import { GapAnalysis } from '@/lib/types/ground-truth';
  ```

### 19.2 — `maxCompetitors()` for competitor count limits
* **Never** inline the per-plan competitor limit (e.g., `count >= 3`).
* **Always** call `maxCompetitors(plan)` from `lib/plan-enforcer.ts`:
  ```typescript
  // ❌ Hardcoded limit — breaks when plan tiers change
  if (existingCount >= 3) return { success: false, error: 'Competitor limit reached' };
  // ✅ Plan-enforcer helper
  import { maxCompetitors } from '@/lib/plan-enforcer';
  if (existingCount >= maxCompetitors(plan)) return { success: false, error: 'Competitor limit reached' };
  ```
* Limits by tier: `trial`=0, `starter`=0, `growth`=3, `agency`=10.

### 19.3 — MSW handler model discrimination
* The OpenAI MSW handler in `src/mocks/handlers.ts` discriminates by the `model` field in the request body:
  - `gpt-4o` → Magic Menu OCR extraction (Phase 18) — returns `MenuExtractedData` JSON
  - `gpt-4o-mini` → Competitor Intercept Analysis (Phase 3) — returns intercept analysis JSON
* **Never** add a second `http.post('https://api.openai.com/...')` handler. MSW only fires the first matching handler.
  Route new OpenAI model variants inside the **existing** handler using `if (body.model === '...')`.

**When multiple features share the same model (e.g., two Phase 2 features both use `gpt-4o-mini`):**

* Primary discriminator (`body.model`) is no longer sufficient on its own.
* Use a **secondary discriminator**: each feature's first system message MUST begin with a unique `[FEATURE_TAG]` marker.
* When adding a new `gpt-4o-mini` caller, you MUST:
  1. Prefix the new feature's system message with a unique tag (e.g., `[CONTENT_GRADER]`).
  2. Retrofit the existing intercept service (`lib/services/competitor-intercept.service.ts`) to prefix its system message with `[INTERCEPT_ANALYSIS]`.
  3. Update the MSW handler to nest the `gpt-4o-mini` branch on the system message tag:
  ```typescript
  const openAiHandler = http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
    const body = await request.json() as { model?: string; messages?: Array<{ role: string; content: string }> };
    if (body.model === 'gpt-4o-mini') {
      const systemMsg = body.messages?.[0]?.content ?? '';
      if (systemMsg.startsWith('[CONTENT_GRADER]')) { /* content grader response */ }
      /* default gpt-4o-mini branch: intercept analysis */
      return HttpResponse.json({ /* MOCK_INTERCEPT_ANALYSIS */ });
    }
    /* default: gpt-4o menu OCR */
  });
  ```
* **Current system message inventory** (update this list when adding new callers):
  - `gpt-4o-mini` / Intercept: `'You are an AI search analyst for local businesses.'` — no tag yet; add `[INTERCEPT_ANALYSIS]` tag when Content Grader is built.
  - `gpt-4o` / Magic Menu: no system message tag needed (only one `gpt-4o` caller).

### 19.4 — Fixture canonical data
* All Competitor Intercept unit and integration tests MUST use `MOCK_COMPETITOR` and `MOCK_INTERCEPT`
  from `src/__fixtures__/golden-tenant.ts` — never invent ad-hoc fixture data for intercept tests.
* The stable UUIDs in these fixtures match `supabase/seed.sql` Section 13:
  - `a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11` — competitor record (Cloud 9 Lounge)
  - `a2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11` — intercept result

## 20. 🚫 Never Hardcode Placeholder Metric Values (Sprint 24A)

When a live data source for a metric hasn't been seeded yet (e.g., the SOV cron hasn't run, a scan hasn't completed), the correct response is **null / pending state** — never a hardcoded number that looks like real data.

* **Rule:** Any score, percentage, or count derived from a DB query MUST propagate `null` when the source row is absent. UI components MUST display a neutral "pending" indicator (e.g., `—`, "Pending") and a human-readable explanation, not a fabricated value.
* **Anti-pattern:** Using a hardcoded constant like `const visibility = 98` as a placeholder while waiting for real data to exist. This misleads paying users and creates silent debt that is hard to trace.
* **Correct pattern:**
  ```typescript
  // ✅ Query the source; propagate null when absent
  const visibilityScore: number | null =
    visRow?.share_of_voice != null
      ? Math.round(visRow.share_of_voice * 100)
      : null;                    // null → show "—" / "Pending" in UI

  // ❌ Hardcoded placeholder — looks like real data, isn't
  const visibilityScore = 98;
  ```
* **Scope:** Applies to all computed metrics: Reality Score, Visibility component, Accuracy component, any KPI card, any progress bar.
* **DB float → display integer:** Columns stored as `FLOAT` (e.g., `share_of_voice 0.0–1.0`) MUST be multiplied by 100 before display. Never display the raw float value.

---

## 21. 🔍 Always Use Every Parsed Field (Sprint 28B)

When you define a Zod schema that includes a boolean (or any field) whose value determines which code path to take, **the code MUST branch on that field**. Ignoring a parsed field produces always-fail or always-pass logic that the type system cannot catch.

* **Rule:** If a parsed schema object has a field that determines the outcome of a function (e.g., `is_closed: boolean`), you MUST read that field and branch on it. Silently discarding it and returning a hardcoded outcome is a logic bug.
* **Anti-pattern (the Sprint 28B bug):** `runFreeScan()` called `PerplexityScanSchema.safeParse()` which includes `is_closed`, then **ignored** `is_closed` and always returned `status: 'fail'` — meaning businesses correctly described by AI were shown a red "Hallucination Detected" alert.
* **Correct pattern:**
  ```typescript
  const parsed = PerplexityScanSchema.safeParse(JSON.parse(cleaned));
  if (parsed.success) {
    // ✅ Branch on the parsed boolean — never ignore it
    if (!parsed.data.is_closed) {
      return { status: 'pass', engine: 'ChatGPT', business_name };
    }
    return { status: 'fail', ...parsed.data, business_name };
  }

  // ❌ Always returning 'fail' regardless of is_closed value
  if (parsed.success) {
    return { status: 'fail', ...parsed.data };  // is_closed ignored!
  }
  ```
* **Scope:** Any function that parses an external API response (AI, webhook, third-party JSON) with a Zod schema. Review schemas after writing — every field should appear in a conditional, assignment, or return statement.
* **Test requirement:** Unit tests MUST cover both branches (`is_closed=true` → `fail`, `is_closed=false` → `pass`). A test suite that only exercises one branch does not validate the logic.

---

## 22. 🌐 Public API Endpoint Pattern (Sprint 29)

When a server-side feature must be accessible from an unauthenticated public page (e.g., the marketing landing page), create a **public endpoint** rather than relaxing auth on an existing authenticated endpoint.

* **Namespace:** Public endpoints live under `app/api/public/` — visually distinct from auth-gated `app/api/v1/`.
  * `app/api/public/places/search/route.ts` — Google Places autocomplete for the ViralScanner
* **Rate limiting (mandatory):** Every public endpoint MUST implement IP-based rate limiting via Vercel KV (same `kv.incr + kv.expire + kv.ttl` pattern as `checkRateLimit()` in `app/actions/marketing.ts`).
  * Exceeded → return `Response.json({ error: '...' }, { status: 429 })` — never silently bypass.
  * `KV_REST_API_URL` absent (dev/CI) → bypass silently. *(AI_RULES §17 — KV is optional infrastructure)*
  * KV throws → absorb in try/catch and allow the request. *(AI_RULES §17)*
* **Safe empty response:** On any error (bad API key, network failure, non-200 upstream) → return the empty/safe response shape (e.g., `{ suggestions: [] }`). Never expose stack traces or error messages from upstream services.
* **MSW registration:** Every new public endpoint must have a corresponding MSW handler in `src/mocks/handlers.ts` so Playwright E2E tests never hit real external APIs. Pattern: `http.get('*/api/public/<path>', ...)`.
* **No auth guard:** Public endpoints intentionally omit `getSafeAuthContext()`. Do not add session checks — use rate limiting as the only abuse-prevention layer.
* **Rate limit constants:** Choose limits appropriate to the use case (e.g., 20 searches/IP/hour for autocomplete; 5 scans/IP/day for AI model invocations). Document the rationale in a comment above the constants.

---

## 23. 🕒 Never Show Fake Timestamps or Hardcoded Status Lists (Sprint 30)

When a live data source for a timestamp or status indicator hasn't run yet, the correct response is **a clear pending state** — never a hardcoded string that looks like real data.

* **Rule:** Any "last updated" timestamp or status list derived from a DB row MUST use the real DB value. UI MUST display "No scans yet" / "First scan runs Sunday, [date]" when the row is absent — not a fabricated relative time.
* **Anti-pattern:** Hardcoding `"Updated just now"` or a static list of bot names + fake times (e.g., `"GPTBot — 2h ago"`, `"Perplexity — 5h ago"`) in a Server Component. Every customer sees the same fabricated values. This is indistinguishable from a lie to paying users.
* **Correct pattern for timestamps:**
  ```typescript
  // ✅ Real DB value → formatRelativeTime(); absent → honest pending state
  {lastAuditAt ? `Updated ${formatRelativeTime(lastAuditAt)}` : 'No scans yet'}

  // ❌ Hardcoded — static string, never reflects reality
  <p>Updated just now</p>
  ```
* **Correct pattern for status lists:**
  ```tsx
  // ✅ Conditional on real DB timestamp
  {lastAuditAt ? (
    <p>Last scan: {formatRelativeTime(lastAuditAt)}</p>
  ) : (
    <p>First scan runs Sunday, {nextSundayLabel()}</p>
  )}

  // ❌ Hardcoded list — every user sees the same fake bots
  <p>GPTBot — 2h ago</p>
  <p>Perplexity — 5h ago</p>
  ```
* **Pure utility functions → co-located utils file:** Timestamp formatting helpers MUST be extracted to a pure TS module (no React imports) so they can be unit tested without jsdom. Pattern: `app/dashboard/_components/scan-health-utils.ts`.
* **Scope:** Applies to all dashboard status cards, last-run timestamps, bot health indicators, crawl status lists — anything that shows a "when did this last happen" or "who ran recently" indicator.

---

## 24. 🚫 Never Return Fabricated Scan Results (Sprint 31)

When an external API (e.g., Perplexity) is unavailable (no API key, non-OK HTTP, network failure), the correct response is an **`unavailable` result state** — never a hardcoded fabricated result that looks like a real detection.

* **Rule:** Fallback paths in scan functions MUST return `{ status: 'unavailable', reason: ... }` — never a hardcoded `{ status: 'fail', claim_text: '...' }` that would display a false "Hallucination Detected" alert to the user.
* **Anti-pattern:** A `demoFallback()` function that returns `{ status: 'fail', claim_text: 'Permanently Closed' }` on all error paths. Every scan with no API key returns a red alert — even for legitimately open, well-described businesses.
* **Correct pattern:**
  ```typescript
  // ✅ Honest unavailable state
  if (!apiKey) return { status: 'unavailable', reason: 'no_api_key' };
  if (!response.ok) return { status: 'unavailable', reason: 'api_error' };

  // ❌ Fabricated failure — misleads users
  if (!apiKey) return demoFallback(businessName);  // { status: 'fail', claim_text: 'Permanently Closed' }
  ```
* **`unavailable` ScanResult variant:**
  ```typescript
  | { status: 'unavailable'; reason: 'no_api_key' | 'api_error' }
  ```
* **UI:** The `unavailable` card uses a neutral amber border (`border-yellow-500/40`), "Scan Unavailable" heading, and a "Try again →" button. It MUST NOT use a red error color (that implies a detected hallucination).
* **Demo functions:** If a hardcoded demo/fallback shape is needed for testing the fail-path UI, it MUST be: (a) named with an `@internal` / test-only marker (e.g., `_demoFallbackForTesting()`), (b) never called automatically on error paths in production, (c) exported only for explicit test import.
* **Test requirement:** Unit tests MUST cover all three unavailable paths: `no_api_key`, `api_error` (non-OK HTTP), and `api_error` (uncaught/network error).

---

## 25. ⚡ `'use server'` Files — All Exports Must Be Async (Bug Fix 2026-02-23)

Next.js 16 enforces that **every exported function** in a `'use server'` file is an async Server Action. A sync export causes a build-time error: `Server Actions must be async functions`.

* **Rule:** In any file with `'use server'` at the top, every exported function MUST be `async`:
  ```typescript
  // ✅ Correct — async export in a 'use server' file
  export async function myHelper(arg: string): Promise<string> {
    return arg.toUpperCase();
  }

  // ❌ Build error — sync export in a 'use server' file
  export function myHelper(arg: string): string {
    return arg.toUpperCase();
  }
  ```
* **Sync helpers:** If you need a sync utility function inside a `'use server'` file, either:
  1. Keep it **unexported** (module-private) — sync private functions are fine.
  2. Move it to a **separate non-`'use server'` module** (e.g., a co-located `*-utils.ts` file).
* **`@internal` test-only exports** are not exempt — they are still exports and must be async:
  ```typescript
  // ✅ @internal export — still must be async
  export async function _demoFallbackForTesting(name: string): Promise<ScanResult> { ... }
  ```
* **Scope:** Applies to `app/actions/*.ts`, `app/dashboard/*/actions.ts`, and any other file with the `'use server'` directive at module level.

---

## 26. 📊 Free vs. Locked AI Audit Metrics — Honesty Pattern (Sprint 34)

The `/scan` public dashboard uses a **real-categoricals-free / locked-numericals** split:

* **Free tier (real data):** Categorical fields returned directly by Perplexity —
  `mentions_volume` (`none`|`low`|`medium`|`high`) and `sentiment` (`positive`|`neutral`|`negative`)
  — are shown free with a "Live" badge. They are real, not derived or fabricated.

* **Locked tier (honest placeholder):** Numerical scores (AI Visibility Score, Citation Integrity)
  require continuous monitoring across multiple scans to be meaningful. Show `██/100` with a lock
  overlay and "Sign up to unlock" — never show a fake number.

* **Why this split works:**
  - Categorical real data is §24-compliant (real, not fabricated)
  - Locking numericals is §24-compliant (honest that monitoring is required)
  - The old `deriveKpiScores` lookup table (Sprint 33) was removed in Sprint 34 — identical
    numbers for every "pass" scan eroded trust faster than no numbers at all

* **Prohibited patterns:**
  ```typescript
  // ❌ Fabrication — removed in Sprint 34
  if (status === 'pass') return { avs: 79, sentiment: 74, citation: 82 }; // lookup table

  // ❌ Random — never acceptable
  return { avs: Math.floor(Math.random() * 100) };
  ```

* **See also:** AI_RULES §24 (no fabricated scan results), AI_RULES §20 (null states).

---

## 27. 🎬 CSS Animation Re-trigger — Use `key` Prop, Not JS Animation Libraries (Sprint 33)

To re-trigger a CSS keyframe animation on a React element (e.g., cycling through messages with
a fade-in effect), use the `key` prop to force React to unmount and remount the element.
This restarts the CSS animation without any JavaScript animation library.

* **Pattern:**
  ```tsx
  // ✅ Correct — key change forces remount → CSS animation restarts
  <p
    key={msgIndex}
    style={{ animation: 'fade-up 0.3s ease-out both' }}
  >
    {MESSAGES[msgIndex]}
  </p>

  // ❌ Avoid — adds a JS animation dependency for something CSS handles natively
  <motion.p
    key={msgIndex}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
  >
    {MESSAGES[msgIndex]}
  </motion.p>
  ```
* **Rule:** This project uses CSS keyframes only (no Framer Motion). The existing keyframes
  (`fill-bar`, `fade-up`, `ping-dot`, `pulse-glow-green`, `shield-beat`) in `globals.css` MUST
  be reused before adding new animations. Do NOT install `framer-motion`.
* **Scope:** All animated UI in `app/` — loading states, scan overlays, KPI cards, progress bars.

---

## 28. 🏷️ Parallel Array Pattern — Categories for Structured Lists (Sprint 35)

When a Perplexity/OpenAI response returns an array of string findings (e.g., `accuracy_issues`),
use a **parallel array** of categories/types (`accuracy_issue_categories`) at the same index,
rather than nesting objects. This keeps URL encoding simple and Zod defaults clean.

* **Pattern:**
  ```typescript
  // ✅ Parallel arrays — clean Zod, simple URL encoding
  accuracy_issues:           z.array(z.string()).max(3).default([]),
  accuracy_issue_categories: z.array(z.enum(['hours','address','menu','phone','other'])).max(3).default([]),

  // ❌ Avoid nested objects (harder to URL-encode, more complex Zod schema)
  accuracy_issues: z.array(z.object({ text: z.string(), category: z.enum([...]) })).max(3).default([]),
  ```
* **Invariant:** Both arrays MUST have the same length. The system prompt MUST state: "A parallel array of the SAME LENGTH as `accuracy_issues`". The Zod schema enforces `max(3)` on both.
* **URL encoding:** The categories array encodes as a single `issue_cats` param (pipe-separated). Categories are not URL-encoded (they are a fixed enum with no special characters).
* **Graceful defaults:** Both arrays default to `[]` via Zod. Missing `issue_cats` in a URL (Sprint 33/34 backwards-compat) decodes to `[]` — `??[0] ?? 'other'` at render time handles index mismatches gracefully.
* **Index access:** Always use `array[i] ?? 'other'` (never `array[i]!`) to access the parallel array — protects against off-by-one if the model returns mismatched lengths.
* **See also:** AI_RULES §21 (all parsed fields must be branched on), AI_RULES §24 (no fabricated results).

---

## 29. 🧪 Playwright E2E Spec Patterns (Sprint 42)

The E2E suite lives in `tests/e2e/` with 14 spec files and 47 tests. Key patterns:

### 29.1 — Locator hygiene
* **Duplicated components:** ViralScanner renders in both hero and CTA sections. All form locators MUST use `.first()`:
  ```typescript
  await page.getByPlaceholder('Business Name').first().fill('Charcoal N Chill');
  await page.getByRole('button', { name: /Run Free AI Audit/i }).first().click();
  ```
* **Heading levels:** Always specify `level` to avoid strict-mode violations:
  ```typescript
  page.getByRole('heading', { name: /Content Drafts/i, level: 1 })
  ```
* **Text vs role disambiguation:** When a string appears in both a `<button>` and a `<p>`, scope with role:
  ```typescript
  // ❌ Matches both filter tab button AND summary strip paragraph
  page.getByText('Approved', { exact: true });
  // ✅ Scoped to paragraph
  page.getByRole('paragraph').filter({ hasText: 'Approved' });
  ```

### 29.2 — API-result-agnostic assertions
MSW server-side interception does NOT reliably intercept Perplexity/OpenAI in E2E (real APIs get called).
* **Never** assert specific pass/fail text from an AI API response:
  ```typescript
  // ❌ Brittle — real API may return pass or fail
  await expect(page.getByText('AI Hallucination Detected')).toBeVisible();
  // ✅ Structural — works regardless of API result
  await expect(page.getByRole('heading', { name: /AI Audit/i, level: 1 })).toBeVisible();
  ```

### 29.3 — Auth session files
* `dev-user.json` — dev@localvector.ai (Growth plan, golden tenant). Used for all dashboard specs.
* `e2e-tester.json` — dynamically provisioned by global.setup.ts.
* `incomplete-user.json` — incomplete@ (null hours/amenities). Used for onboarding guard.
* `upload-user.json` — upload@ (shared for hybrid-upload). `workers: 1` prevents race conditions.

### 29.4 — Test count verification
E2E spec inventory is maintained in `docs/DEVLOG.md` (bottom section). Update it when adding/removing specs.

---
> **End of System Instructions**