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
* **The Authority:** You MUST use the **TypeScript interfaces defined in `lib/types/ground-truth.ts`** as the strict schema for these columns. `03-DATABASE-SCHEMA.md` (Section 15) is a conceptual reference only — the live code in `ground-truth.ts` is the canonical source.
    * *Example:* Do not invent a shape for `hours_data`. Use the `DayHours` interface from `lib/types/ground-truth.ts`.
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
  * **Supabase client:** `vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))` then `vi.mocked(createClient).mockResolvedValue({ from: vi.fn(...) })` (no `as any` — see §38.2).
  * **AI SDK calls** (`generateText`, `generateObject`): `vi.mock('ai', () => ({ generateText: vi.fn(), generateObject: vi.fn(), jsonSchema: vi.fn((s: unknown) => ({ jsonSchema: s })) }))` + `vi.mock('@/lib/ai/providers', () => ({ getModel: vi.fn().mockReturnValue('mock-model'), hasApiKey: vi.fn().mockReturnValue(true) }))`. The `jsonSchema` mock is **required** — `lib/ai/schemas.ts` imports it for the Zod v4 adapter. Mock return shapes: `{ text: '...' }` for `generateText`, `{ object: {...} }` for `generateObject`. Control fallback paths with `vi.mocked(hasApiKey).mockReturnValue(false)`.
  * **Direct `fetch` calls** (non-AI HTTP calls where no SDK wrapper exists): use `vi.stubGlobal('fetch', vi.fn())` — `vi.mock` cannot intercept global fetch. **Note:** All AI API calls (Perplexity, OpenAI) now use the Vercel AI SDK — never raw `fetch`.
  * **`setTimeout` mock delays** (SOV/evaluation actions with no API key): use `vi.useFakeTimers()` in `beforeEach` and `await vi.runAllTimersAsync()` before awaiting the result. Without this, tests wait 3 real seconds.
  * **`vi.mock()` declarations must be hoisted** before any `import` statements. File must be read with the `Read` tool before any `Edit` to a test file.

## 5. 💰 Cost & Performance Guardrails
* **No API Calls on Load:** NEVER trigger an LLM API call (OpenAI/Perplexity) directly from a frontend page load. All AI operations must be:
    1.  Scheduled (Cron jobs)
    2.  User-initiated (Button click)
    3.  Cached (Served from Supabase DB).
* **Plan Gating:** Always check feature availability using the helpers in `lib/plan-enforcer.ts` before enabling premium features. Never inline plan-tier checks — always call these functions. The eleven exported functions are:
  - `canRunDailyAudit` — daily automated AI audit cron (Growth+)
  - `canRunSovEvaluation` — Share of Voice on-demand evaluation (Growth+)
  - `canRunCompetitorIntercept` — Greed Engine competitor analysis (Growth+)
  - `canRunAutopilot` — Autopilot content draft generation + publish pipeline (Growth+)
  - `canRunPageAudit` — Content Grader / AEO page audit + Page Audit Dashboard (Growth+)
  - `canRunOccasionEngine` — Occasion Module seasonal scheduler (Growth+)
  - `canViewCitationGap` — Citation Gap Dashboard (Growth+)
  - `canConnectGBP` — Google Business Profile OAuth connection (Starter+)
  - `canRunMultiModelSOV` — Multi-model SOV queries (Perplexity + OpenAI in parallel) (Growth+)
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
* **Cron Jobs:** All scheduled operations run as **Next.js Route Handlers** at `app/api/cron/*/route.ts`. Every cron endpoint is a standard `GET` handler secured by the `CRON_SECRET` header check. Cron routes are thin dispatchers: they validate auth, check kill switches, then dispatch to Inngest (primary) with an inline fallback (AI_RULES §17, §30). **Do NOT create files under `supabase/functions/`** — Supabase Edge Functions (Deno) are not used in this project.
* **Middleware filename:** All middleware logic lives in **`proxy.ts`** (at the project root). A thin `middleware.ts` re-export shim (`export { proxy as middleware, config } from './proxy'`) exists so Next.js auto-discovers the middleware. **Always edit `proxy.ts`** — never add logic to `middleware.ts`.

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
  - Inngest step functions (`lib/inngest/functions/*.ts`) — background fan-out, no user session
  - Stripe webhook handler (`app/api/webhooks/stripe/route.ts`) — no user session in callbacks
  - Google OAuth callback (`app/api/auth/google/callback/route.ts`) — `google_oauth_tokens` grants only to `service_role`
  - Server Actions that mutate service-role-only tables (e.g., `disconnectGBP()`) — when a table has **no authenticated grants**, derive org_id via `getSafeAuthContext()` and use service-role client
  - Admin seed scripts and Supabase migrations
  - Test `beforeAll`/`afterAll` blocks in integration tests
* **Never** use `createServiceRoleClient()` inside a user-facing Server Action
  **unless** the target table has no RLS policies granting to `authenticated` (e.g., `google_oauth_tokens`).
  In that case, always derive `org_id` server-side — never accept from the client.
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

### 19.3 — AI SDK model keys and MSW handler discrimination

**All AI API calls use the Vercel AI SDK** (`generateText` / `generateObject`) via model keys in `lib/ai/providers.ts`. Never use raw `fetch()` to call Perplexity or OpenAI.

**Model key registry** (defined in `lib/ai/providers.ts`):
| Key | Provider | SDK Function | Purpose |
|-----|----------|-------------|---------|
| `fear-audit` | OpenAI gpt-4o | `generateObject` | Fear Engine — hallucination detection (high reasoning). Uses `AuditResultSchema`. |
| `greed-headtohead` | Perplexity Sonar | `generateText` | Greed Engine Stage 1 — head-to-head comparison (live web). Uses `generateText` because Perplexity's `compatibility: 'compatible'` mode does not support `response_format: json_schema`. |
| `greed-intercept` | OpenAI gpt-4o-mini | `generateObject` | Greed Engine Stage 2 — intercept analysis. Structured output via Zod schema. |
| `sov-query` | Perplexity Sonar | `generateText` | SOV Engine — share-of-voice queries (live web results). |
| `sov-query-openai` | OpenAI gpt-4o | `generateText` | SOV Engine — OpenAI alternative for multi-model SOV. |
| `truth-audit-openai` | OpenAI gpt-4o-mini | `generateText` | Truth Audit — OpenAI engine (multi-engine accuracy scoring). |
| `truth-audit-perplexity` | Perplexity Sonar | `generateText` | Truth Audit — Perplexity engine (live web, multi-engine). |
| `truth-audit-anthropic` | Anthropic Claude Sonnet | `generateText` | Truth Audit — Anthropic engine (multi-engine comparison). |
| `truth-audit-gemini` | Google Gemini 2.0 Flash | `generateText` | Truth Audit — Google engine (multi-engine comparison). |
| `chat-assistant` | OpenAI gpt-4o | `generateText` | AI Chat Assistant — streaming conversational agent with tool calls. |
| `menu-ocr` | OpenAI gpt-4o | `generateObject` | Menu OCR — GPT-4o Vision for PDF/image menu extraction. Uses `MenuOCRSchema`. |

**Zod schemas** live in `lib/ai/schemas.ts` — imported by both services and tests. Never define AI output types inline. **Important:** `zod-to-json-schema@3` (bundled with `ai@4`) cannot convert Zod v4 schemas. Always wrap Zod schemas with `zodSchema()` (exported from `lib/ai/schemas.ts`) when passing to `generateObject({ schema })` or `tool({ parameters })`.

**MSW handler discrimination** (for E2E tests only):
* The OpenAI MSW handler in `src/mocks/handlers.ts` discriminates by the `model` field in the request body:
  - `gpt-4o` → Magic Menu OCR extraction — returns `MenuExtractedData` JSON
  - `gpt-4o-mini` → discriminate by system message tag (see below)
* **Never** add a second `http.post('https://api.openai.com/...')` handler. MSW only fires the first matching handler.

**When multiple features share the same model (e.g., two features both use `gpt-4o-mini`):**
* Use a **secondary discriminator**: each feature's first system message MUST begin with a unique `[FEATURE_TAG]` marker.
* **Current system message inventory** (update this list when adding new callers):
  - `gpt-4o-mini` / Intercept: `'You are an AI search analyst for local businesses.'`
  - `gpt-4o-mini` / Content Grader: `'[CONTENT_GRADER] ...'`
  - `gpt-4o` / Magic Menu + Menu OCR Vision: system message `'You are a restaurant menu digitizer.'` — discriminate by request payload (file content part present = OCR Vision, text-only = legacy menu parse)
  - `gpt-4o` / Chat Assistant: uses streaming via `/api/chat` endpoint, not `/v1/chat/completions`
  - `gpt-4o` / SOV OpenAI: discriminate by system message (different from menu/chat callers)

**Unit test mocking** (preferred over MSW for unit tests):
* Mock the AI SDK directly with `vi.mock('ai')` + `vi.mock('@/lib/ai/providers')` — see §4 for the pattern.
* This avoids MSW handler routing entirely and is faster + more deterministic.

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

The E2E suite lives in `tests/e2e/` with 18 spec files. Key patterns:

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

## 30. 🚀 Inngest Job Queue — Dispatcher + Fan-Out Patterns (Sprint 49)

All async cron pipelines use **Inngest** for event-driven fan-out with automatic retries, per-step timeouts, and concurrency limits. The cron route is a thin dispatcher; the real work lives in `lib/inngest/functions/`.

### 30.1 — Cron route dispatcher pattern
Every cron route follows this structure: auth guard → kill switch → Inngest dispatch → inline fallback:
```typescript
// ── Primary: Inngest dispatch ──
try {
  await inngest.send({ name: 'cron/sov.weekly', data: {} });
  return NextResponse.json({ ok: true, dispatched: true });
} catch (inngestErr) {
  console.error('[cron] Inngest dispatch failed, running inline:', inngestErr);
}
// ── Fallback: inline sequential loop (AI_RULES §17) ──
return await runInlineSOV();
```
* Kill switches: `STOP_SOV_CRON`, `STOP_AUDIT_CRON`, `STOP_CONTENT_AUDIT_CRON`
* The inline fallback (`runInline*()`) keeps the full original orchestration as a private function in the same file.

### 30.2 — Inngest function architecture
* **Client:** `lib/inngest/client.ts` — singleton with typed `EventSchemas`
* **Events:** `lib/inngest/events.ts` — typed event definitions (4 events)
* **Functions:** `lib/inngest/functions/*.ts` — one file per function
* **Webhook:** `app/api/inngest/route.ts` — registers all functions via `serve()`

### 30.3 — Service-role client per step
`createServiceRoleClient()` MUST be called **inside each `step.run()`**. The Supabase client cannot be serialized across Inngest step boundaries:
```typescript
step.run('audit-org', async () => {
  const supabase = createServiceRoleClient(); // ← inside the step
  // ... use supabase
});
```

### 30.4 — Concurrency and retry limits

| Function ID | concurrency.limit | retries | Reason |
|---|---|---|---|
| `sov-weekly-cron` | 3 | 2 | Perplexity rate limit |
| `audit-daily-cron` | 5 | 3 | OpenAI rate limit |
| `content-audit-monthly-cron` | 3 | 2 | Polite crawling |
| `post-publish-sov-check` | 10 | 1 | Best-effort SOV re-check; no retry storm needed |

### 30.5 — Durable sleep for deferred work
Use `step.sleep()` instead of Redis TTL scheduling for long-running waits:
```typescript
await step.sleep('wait-14-days', '14d');  // survives deploys + restarts
```

### 30.6 — Per-step timeout protection
Every `step.run()` that calls an external API MUST be wrapped with `withTimeout()` from
`lib/inngest/timeout.ts`. This enforces a 55-second deadline (Vercel Pro allows 60s per step;
55s gives a 5s buffer for Inngest overhead):
```typescript
// ✅ Correct — withTimeout wraps the work, step rejects after 55s
step.run('audit-org', () => withTimeout(() => processOrgAudit(org)));

// ❌ Wrong — no timeout, step hangs indefinitely on API failure
step.run('audit-org', () => processOrgAudit(org));
```

### 30.7 — Health check endpoint
`GET /api/inngest/health` returns JSON listing all 4 registered function IDs and whether
`INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` are set. Protected by `Authorization: Bearer <CRON_SECRET>`.
Use this to verify Inngest is wired correctly before deploying.

### 30.8 — Testability pattern
Export the per-org/per-location processor function (e.g., `processOrgSOV`, `processOrgAudit`,
`processLocationAudit`) for unit testing. The Inngest function definition wraps these processors
in `step.run()` calls. Exception: `post-publish-sov-check` has no exported processor — its logic
is a single `step.sleep('14d')` + one `runSOVQuery()` call; tested via SOV query unit tests.

---

## 31. Stripe Webhook & Billing Patterns

### 31.1 — Handled webhook events
The Stripe webhook at `app/api/webhooks/stripe/route.ts` handles exactly 3 events:
- `checkout.session.completed` — initial purchase; sets plan + Stripe IDs
- `customer.subscription.updated` — plan changes, renewals; updates `plan_status`
- `customer.subscription.deleted` — subscription fully canceled; downgrades to `plan='trial'`, `plan_status='canceled'`

All other event types receive an immediate 200 OK (Stripe retries on non-2xx).

### 31.2 — Raw body requirement
`request.text()` MUST be called before any JSON parsing. `stripe.webhooks.constructEvent()` requires
the exact raw bytes to validate the HMAC. Any intermediate `JSON.parse` breaks the signature.

### 31.3 — UI plan name → DB tier mapping
Stripe metadata `plan` uses UI names. Always map via the `UI_PLAN_TO_DB_TIER` lookup:
- `pro` → `growth`
- `enterprise` → `agency`
- `starter` → `starter` (passthrough)
- `growth` → `growth` (passthrough)

Never store the UI name directly in the `plan_tier` enum column.

### 31.4 — Customer Portal
`createPortalSession()` in `app/dashboard/billing/actions.ts` creates a Stripe Billing Portal
session. Requires `stripe_customer_id` on the org's DB record. Falls back to `{ url: null, demo: true }`
when `STRIPE_SECRET_KEY` is absent or org has no Stripe customer.

### 31.5 — Demo mode contract
When `STRIPE_SECRET_KEY` is absent (local dev, CI, preview deploys), all billing actions return
demo results. Existing Playwright billing tests rely on this — they MUST keep passing unchanged.

---

## 32. Google OAuth & GBP Connection (Sprint 57B)

### 32.1 — OAuth Redirect Flow
`GET /api/auth/google` generates a random CSRF `state` token, stores it in an httpOnly cookie
(`google_oauth_state`, 10-min maxAge, path restricted to callback), and stores `org_id` in a
second httpOnly cookie (`google_oauth_org`). Then redirects to Google's consent screen with
scopes `business.manage` + `userinfo.email`, `access_type: 'offline'`, `prompt: 'consent'`.

### 32.2 — Callback Handler
`GET /api/auth/google/callback` does exactly:
1. Verify `state` query param matches `google_oauth_state` cookie (CSRF protection)
2. Read `org_id` from `google_oauth_org` cookie
3. Delete both cookies immediately
4. Exchange authorization code for tokens via `POST https://oauth2.googleapis.com/token`
5. Fetch GBP account name via `GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts`
6. Fetch Google email via `GET https://www.googleapis.com/oauth2/v2/userinfo`
7. Upsert tokens into `google_oauth_tokens` (service-role client, `ON CONFLICT org_id`)
8. Redirect to `/dashboard/integrations?gbp_connected=true` or `?gbp_error=<code>`

Error codes: `access_denied`, `missing_params`, `csrf_mismatch`, `no_org`, `not_configured`,
`token_exchange`, `no_access_token`, `db_error`.

### 32.3 — Token Storage Security
`google_oauth_tokens` table has:
- RLS enabled, `org_isolation_select` policy for `authenticated` (read-only)
- INSERT/UPDATE/DELETE grants only to `service_role` (not `authenticated`)
- Tokens are NEVER exposed to the client — only `google_email` and `gbp_account_name` are read

### 32.4 — GBPConnectButton UI (4 states)
The `GBPConnectButton` component in `app/dashboard/integrations/_components/` renders one of:
1. **Not configured** — `GOOGLE_CLIENT_ID` absent → grey "Not configured" badge
2. **Plan-gated** — `canConnectGBP(plan)` returns false (trial) → "Upgrade to Connect" link
3. **Not connected** — no `google_oauth_tokens` row → "Connect Google Business Profile" OAuth link
4. **Connected** — shows email + account name + "Disconnect" button

### 32.5 — Disconnect Flow
`disconnectGBP()` in `app/dashboard/integrations/actions.ts` uses `createServiceRoleClient()`
to delete the org's `google_oauth_tokens` row. Org_id derived server-side via `getSafeAuthContext()`.

### 32.6 — Token Refresh
Token refresh is handled internally by `lib/autopilot/publish-gbp.ts`. That file must NOT be
modified for OAuth connect/disconnect. It reads `google_oauth_tokens` via service-role, checks
`expires_at`, and refreshes via Google's token endpoint when expired.

---

## 33. AI Chat Assistant — useChat, Tool Calls, and Streaming (Sprint 57A)

### 33.1 — Chat API Endpoint
`POST /api/chat` uses `streamText()` with tool calls. System prompt injects org context.
Model key: `chat-assistant`. Max steps: 5 (tool call round-trips per message).

### 33.2 — useChat() Hook
The client component destructures the full API surface:
```typescript
const { messages, input, handleInputChange, handleSubmit, isLoading, error, reload, stop, append } = useChat({ api: '/api/chat' });
```
- `append({ role: 'user', content })` — for quick-action buttons (never use `requestSubmit` hack)
- `stop()` — stop token generation mid-stream
- `error` + `reload` — error detection and retry

### 33.3 — Tool Result Cards
Tool `result.type` maps to UI components:
| `result.type` | Component | Data shape |
|---|---|---|
| `visibility_score` | ScoreCard | `share_of_voice`, `reality_score`, `accuracy_score`, `open_hallucinations` |
| `sov_trend` | TrendSparkline | `data: [{ date, sov }]` → recharts AreaChart |
| `hallucinations` | AlertList | `items: [{ severity, model, category, claim, truth }]` |
| `competitor_comparison` | CompetitorList | `competitors: [{ name, analyses, recommendation }]` |

### 33.4 — Error Handling (two layers)

**Layer 1 — Stream errors (route.ts):**
`toDataStreamResponse({ getErrorMessage })` maps raw OpenAI/provider errors to user-friendly messages before they reach the client. Categories: API key misconfiguration, rate limiting (429), timeouts, and generic fallback. This fires when the provider fails **mid-stream** (HTTP 200 already sent).

**Layer 2 — Client error banner (Chat.tsx):**
- `ErrorBanner` displays the server-provided error message from the stream (not a generic fallback)
- If the message is generic/empty (`"Failed to fetch the chat response."`, `"Unauthorized"`), shows "AI service temporarily unavailable"
- Retry button (`reload()`) always visible on any error
- 401 detection: `onResponse` callback checks `response.status === 401` (fires before stream errors)
- On first 401: silently calls `supabase.auth.refreshSession()` via browser client, then auto-retries
- On persistent 401 (refresh failed): shows "Session expired" banner with "Sign in" link to `/login`

### 33.5 — SOV Sparkline
Uses recharts `AreaChart` (NOT Tremor) — 120px height, signal-green stroke with gradient fill,
`XAxis` with date labels, `Tooltip` with surface-dark background. Gradient defined as SVG
`<linearGradient>` from 30% opacity to 0%.

### 33.6 — Copy Message
`CopyButton` uses `navigator.clipboard.writeText()`. Shows on hover only (`opacity-0 group-hover:opacity-100`).
"Copied!" text displayed for 2 seconds. Only appears on assistant messages (never user messages).

## 34. Citation Gap, Page Audit, and Prompt Intelligence Dashboards (Sprint 58)

### 34.1 — Citation Gap Dashboard (`/dashboard/citations`)
Server component. Fetches `citation_source_intelligence` for the tenant's **primary category + city** (aggregate market data, not org-scoped). Joins `listings` with `directories` to produce `TenantListing[]`. Calls `calculateCitationGapScore()` (pure function, no DB calls). Plan gate: `canViewCitationGap()` (Growth+). Components:
- `CitationGapScore` — SVG circular score ring (green 80+, amber 50-79, red <50)
- `PlatformCitationBar` — horizontal bars sorted by `citation_frequency` descending, "Listed ✓" / "Not listed" indicator per platform
- `TopGapCard` — highlighted card for the #1 uncovered platform gap with "Claim Your Listing" CTA (links to platform signup URL)

### 34.2 — Page Audit Dashboard (`/dashboard/page-audits`)
Server component. Reads `page_audits` table (org-scoped via RLS). Computes average `overall_score` across all audited pages. Plan gate: `canRunPageAudit()` (Growth+). Components:
- `AuditScoreOverview` — SVG circular score ring for aggregate AEO readiness
- `PageAuditCard` — per-page card with 5 dimension bars (Answer-First 35%, Schema 25%, FAQ 20%, Keyword 10%, Entity 10%), top recommendation, re-audit button
- `DimensionBar` — reusable score bar with label, weight text, and color-coded fill
- `PageAuditCardWrapper` — client wrapper binding `reauditPage` server action

### 34.3 — Re-audit Server Action
`reauditPage(pageUrl)` in `app/dashboard/page-audits/actions.ts`. Rate limited: 1 re-audit per page per 5 minutes (in-memory `Map`). Fetches existing audit row for `page_type` + `location_id`, calls `auditPage()` from `lib/page-audit/auditor.ts`, upserts result to `page_audits` (conflict on `org_id, page_url`).

### 34.4 — Prompt Intelligence Gap Alerts on SOV Page
Added to `app/dashboard/share-of-voice/page.tsx` (Growth+ only). Calls `detectQueryGaps(orgId, locationId, supabase)` from `lib/services/prompt-intelligence.service.ts` — returns up to 10 gaps. Calls `computeCategoryBreakdown(queries, evaluations)` — pure function, no DB calls. Shows section between First Mover Opportunities and Query Library with:
- `CategoryBreakdownChart` — horizontal bar chart of citation rates per query category
- `GapAlertCard` — per-gap card with type badge (untracked=amber, competitor_discovered=crimson, zero_citation_cluster=indigo), impact level, and suggested action

### 34.5 — Sidebar Navigation
`Citations` (Globe icon) and `Page Audits` (FileSearch icon) added to `NAV_ITEMS` in `components/layout/Sidebar.tsx`, positioned after "Listings" and before "Settings". `AI Assistant` (MessageSquare icon) added Sprint 68 after Page Audits. `AI Says` (Quote icon, `href: /dashboard/ai-responses`) added Sprint 69 after AI Assistant. `data-testid="nav-ai-says"`.

---

## 35. Error Boundaries, Auth OAuth, and Password Reset (Sprint 60)

### 35.1 — Dashboard Error Boundaries
Every dashboard section has an `error.tsx` file (Next.js App Router error boundary). Pattern:
```typescript
'use client';
import * as Sentry from '@sentry/nextjs';
import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';

export default function SectionError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  // ... AlertTriangle icon + "Something went wrong" + error.message + "Try again" button
}
```
Current error boundaries: `app/dashboard/error.tsx`, `hallucinations/error.tsx`, `share-of-voice/error.tsx`, `ai-assistant/error.tsx`, `content-drafts/error.tsx`, `ai-responses/error.tsx`. When adding new dashboard sections, create a matching `error.tsx`.

### 35.2 — Google OAuth Login (Supabase Auth, NOT GBP)
Login and register pages use Supabase's built-in `signInWithOAuth({ provider: 'google' })` for user authentication. This is **separate** from the GBP OAuth flow in `app/api/auth/google/` (Rule 32), which connects Google Business Profile for data import.

- Uses `createClient()` from `lib/supabase/client.ts` (browser client)
- `redirectTo: ${window.location.origin}/dashboard`
- Wraps in try/catch — displays error message if Google provider is not configured in Supabase Dashboard > Auth > Providers
- Google provider must be enabled in Supabase Dashboard separately (not automatic)

### 35.3 — Password Reset Flow
- **Forgot password:** `app/(auth)/forgot-password/page.tsx` — calls `supabase.auth.resetPasswordForEmail()` with `redirectTo` to `/reset-password`
- **Reset password:** `app/(auth)/reset-password/page.tsx` — calls `supabase.auth.updateUser({ password })`, validates min 8 chars + match confirmation
- Both pages match the dark auth theme (bg-midnight-slate, surface-dark cards, signal-green accents)

### 35.4 — Sidebar `data-testid` Convention
All sidebar nav links have `data-testid={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}`:
`nav-dashboard`, `nav-alerts`, `nav-menu`, `nav-share-of-voice`, `nav-content`, `nav-compete`, `nav-listings`, `nav-citations`, `nav-page-audits`, `nav-ai-assistant`, `nav-ai-says`, `nav-settings`, `nav-billing`.
E2E specs should use `page.getByTestId('nav-xyz')` for sidebar navigation.

### 35.5 — E2E Spec Inventory (updated)
18 spec files, ~55+ tests total:
- `01-viral-wedge` through `10-truth-audit` (original suite)
- `auth.spec.ts`, `billing.spec.ts`, `hybrid-upload.spec.ts`, `onboarding.spec.ts`
- `11-ai-assistant.spec.ts` — chat UI, quick-action buttons, input
- `12-citations.spec.ts` — heading, gap score or empty state, sidebar nav
- `13-page-audits.spec.ts` — heading, audit cards or empty state, sidebar nav
- `14-sidebar-nav.spec.ts` — 9 sidebar links navigate to correct pages

---

## 36. Occasion Calendar, Multi-Model SOV, WordPress Connect (Sprint 61)

### 36.1 — Occasion Calendar UI (`OccasionTimeline`)
Client component at `app/dashboard/content-drafts/_components/OccasionTimeline.tsx`. Renders upcoming occasions as horizontal scrollable cards between the summary strip and filter tabs on the Content Drafts page.

- **Data source:** `local_occasions` table filtered to occasions within trigger window (`daysUntilPeak >= 0 && daysUntilPeak <= trigger_days_before`), sorted by soonest first.
- **Countdown badge colors:** red ≤7 days, amber ≤14 days, slate otherwise.
- **Create Draft action:** Sets `trigger_type='occasion'` and `trigger_id` on the new draft. The `CreateDraftSchema` in `actions.ts` accepts optional `trigger_type` and `trigger_id` fields.
- **Collapsible:** Default expanded, toggles with ChevronDown/ChevronUp.

### 36.2 — Multi-Model SOV (Perplexity + OpenAI)
Growth and Agency orgs run SOV queries against both Perplexity and OpenAI in parallel, doubling AI coverage. Starter/Trial orgs use single-model (Perplexity only).

- **Plan gate:** `canRunMultiModelSOV(plan)` from `lib/plan-enforcer.ts` (Growth+).
- **Entry point:** `runMultiModelSOVQuery()` in `lib/services/sov-engine.service.ts` — uses `Promise.allSettled` so one provider failing doesn't kill both.
- **Engine tracking:** `SOVQueryResult.engine` field (`'perplexity'` | `'openai'`). `writeSOVResults()` writes `result.engine` to `sov_evaluations.engine`.
- **Model keys:** `'sov-query'` (Perplexity) and `'sov-query-openai'` (OpenAI) in `lib/ai/providers.ts`.
- **Cron integration:** Both `lib/inngest/functions/sov-cron.ts` and `app/api/cron/sov/route.ts` branch on `canRunMultiModelSOV(plan)`.

### 36.3 — WordPress Credential Management
Integrations page now has a WordPress section (below GBP) for connecting WordPress sites via Application Password auth.

- **Migration:** `20260226000007_wp_credentials.sql` adds `wp_username` and `wp_app_password` columns to `location_integrations`.
- **Server actions** in `app/dashboard/integrations/actions.ts`:
  - `testWordPressConnection(siteUrl, username, appPassword)` — HEAD request to `${siteUrl}/wp-json/wp/v2/pages` with 10s timeout
  - `saveWordPressCredentials(locationId, siteUrl, username, appPassword)` — upserts `platform='wordpress'` row
  - `disconnectWordPress(locationId)` — deletes the row
- **UI components:**
  - `WordPressConnectButton.tsx` — two states: not connected (opens modal) or connected (green badge + disconnect)
  - `WordPressConnectModal.tsx` — form with "Test Connection" → "Save & Connect" two-step flow
- **Credential security:** `wp_username` and `wp_app_password` are stored server-side only, never exposed to the client. Used in `publishDraft()` WordPress branch.
- **Publish flow wired:** `publishDraft()` in `content-drafts/actions.ts` fetches `wp_username`/`wp_app_password` from `location_integrations` when `publish_target='wordpress'`.

## 37. Scale Prep — Cron Logging, Guided Tour, Subdomains, Landing Split, Settings, Multi-Location (Sprint 62)

### 37.1 — Cron Health Logging (`cron_run_log` + `cron-logger.ts`)
All 4 cron routes (`sov`, `audit`, `content-audit`, `citation`) are now instrumented with `lib/services/cron-logger.ts`.

- **Table:** `cron_run_log` — RLS enabled, no policies (service-role writes only). Columns: `cron_name`, `started_at`, `completed_at`, `duration_ms`, `status` (running/success/failed/timeout), `summary` JSONB, `error_message`.
- **Service pattern:** `logCronStart(cronName)` → returns `{ logId, startedAt }`. `logCronComplete(logId, summary, startedAt)` → computes `duration_ms` from `startedAt`. `logCronFailed(logId, errorMessage, startedAt)` → sets status='failed'.
- **Fail-safe:** All logger calls are wrapped in try/catch internally — a logger failure never crashes the cron.
- **Wiring pattern:**
  ```typescript
  const { logId, startedAt } = await logCronStart('sov');
  try {
    // ... existing cron logic ...
    await logCronComplete(logId, summary, startedAt);
  } catch (err) {
    await logCronFailed(logId, err instanceof Error ? err.message : String(err), startedAt);
    // ... error response ...
  }
  ```

### 37.2 — Post-Onboarding Guided Tour (`GuidedTour.tsx`)
Custom tooltip-based tour at `app/dashboard/_components/GuidedTour.tsx`. No external libraries (no react-joyride, no framer-motion).

- **localStorage key:** `lv_tour_completed` — set to `'true'` when user finishes or skips. Tour only shows on first visit.
- **Target resolution:** Uses `document.querySelector('[data-testid="nav-dashboard"]')` etc. + `getBoundingClientRect()` for tooltip positioning.
- **Screen guard:** Only renders on `lg+` screens (checks `window.matchMedia('(min-width: 1024px)')`). Has `typeof window.matchMedia !== 'function'` guard for jsdom compatibility.
- **Mount delay:** 800ms `setTimeout` on mount to ensure sidebar renders first.
- **Rendered in:** `DashboardShell.tsx` after main content area.

### 37.3 — Subdomain Routing (`proxy.ts`)
The Next.js middleware (logic in `proxy.ts`, re-exported via `middleware.ts`) handles subdomain routing at the top of the handler:

- `menu.*` hostname → `NextResponse.rewrite()` to `/m/` path prefix (public, no auth needed)
- `app.*` or bare domain → falls through to existing auth logic
- **DNS:** `*.localvector.ai` CNAME to Vercel deployment
- **Local test:** `curl -H "Host: menu.localhost:3000" http://localhost:3000/charcoal-n-chill`

### 37.4 — Landing Page Code-Splitting (`app/_sections/`)
The landing page (`app/page.tsx`) is split from 1,181 lines into 6 section files under `app/_sections/`:

| File | Sections | Import Type |
|------|----------|-------------|
| `shared.tsx` | SectionLabel, MetricCard, PricingCard helpers | Named exports |
| `HeroSection.tsx` | JSON-LD + Nav + Hero | **Static** (above fold) |
| `ProblemSection.tsx` | Revenue Leak + AVS | Dynamic (`next/dynamic`) |
| `CompareSection.tsx` | Compare + Table | Dynamic |
| `EnginesSection.tsx` | Three Engines + Case Study | Dynamic |
| `PricingSection.tsx` | Pricing + FAQ + CTA + Footer | Dynamic |

- **Pattern:** HeroSection is statically imported (above-fold performance). All below-fold sections use `next/dynamic` for lazy loading.
- **`safeJsonLd` import:** HeroSection imports from `../m/[slug]/page` (the public menu page already has the utility).

### 37.5 — Settings Notifications & Danger Zone
Settings page (`app/dashboard/settings/`) now has 5 sections: Account, Security, Organization, Notifications, Danger Zone.

- **Notification prefs columns** on `organizations` table: `notify_hallucination_alerts`, `notify_weekly_digest`, `notify_sov_alerts` (all `BOOLEAN DEFAULT TRUE`). Migration `20260226000009`.
- **Server action:** `updateNotificationPrefs(formData)` — Zod-validates 3 boolean fields, updates via service-role client.
- **Soft delete:** `softDeleteOrganization()` — checks `ctx.role === 'owner'`, sets `plan_status='canceled'`, signs out, redirects to `/login`. Does NOT hard-delete — data retained 30 days.
- **DeleteOrgModal:** Type-to-confirm pattern — user must type exact org name before "Delete Organization" button becomes active.
- **Toggle component:** Inline `Toggle` in SettingsForm.tsx with `role="switch"` and `aria-checked` for accessibility.

### 37.6 — Agency Multi-Location UI (`LocationSwitcher`)
Agency-tier orgs with multiple locations can switch between them via a sidebar dropdown.

- **LocationSwitcher** at `components/layout/LocationSwitcher.tsx` — client component, only renders when `locations.length > 1`.
- **Cookie-based selection:** Sets `lv_selected_location` cookie via `document.cookie` (1-year expiry, SameSite=Lax). `window.location.reload()` after selection (V1 pragmatic approach).
- **Data flow:** `dashboard/layout.tsx` fetches all org locations → reads cookie → passes `locations` + `selectedLocationId` through `DashboardShell` → `Sidebar` → `LocationSwitcher`.
- **Locations page:** Card grid layout (`grid gap-4 sm:grid-cols-2 lg:grid-cols-3`). Plan-gated via `maxLocations(plan)` — shows "Upgrade to Agency" when at limit.
- **Props threading:** `DashboardShell` and `Sidebar` accept optional `locations?: LocationOption[]` and `selectedLocationId?: string | null`.

## 38. 🗂️ Supabase Database Types & Type Safety (Sprint 63)

### 38.1 — `database.types.ts` Is the Type Authority
`lib/supabase/database.types.ts` contains the full `Database` type definition covering all 28 tables, 9 enums, and FK `Relationships`. It was manually generated from `supabase/prod_schema.sql` + migration files. When the schema changes (new tables, columns, or enums), this file **must be updated** to match.

### 38.2 — No `as any` on Supabase Clients
The clients in `lib/supabase/server.ts` are generic-typed with `<Database>`. **Never** cast `createClient()` or `createServiceRoleClient()` to `any`. The typed client provides autocomplete on `.from()` table names, `.select()` column inference, and return type safety.

### 38.3 — Service Function Parameter Type
Functions that accept an injected Supabase client must use the typed parameter:
```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export async function myService(supabase: SupabaseClient<Database>) { ... }
```
**Never** use `supabase: any` as a parameter type.

### 38.4 — JSONB Column Casting Convention
Database JSONB columns are typed as `Json` (a union of primitives, arrays, and objects). When reading JSONB values that the application expects as a specific type, cast explicitly:
```typescript
const categories = location.categories as string[] | null;
const amenities = location.amenities as Record<string, boolean | undefined> | null;
```
When writing typed objects into JSONB columns, cast via `unknown`:
```typescript
import type { Json } from '@/lib/supabase/database.types';
await supabase.from('magic_menus').update({ extracted_data: menuData as unknown as Json });
```

### 38.5 — Remaining Permitted `as any` Casts
Only 4 non-Supabase `as any` casts are permitted in the codebase:
- `zodResolver(CreateMenuItemSchema) as any` — react-hook-form resolver type mismatch
- `(item as any).dietary_tags` — JSONB field access in `generateMenuJsonLd.ts`
- `row['dietary_tags'] as any` — CSV parse in `parseCsvMenu.ts`
- `part as any` — AI SDK UIMessage discriminated union in `Chat.tsx`

Any new `as any` on Supabase clients, queries, or service params will be flagged as a rule violation.

---
> **End of System Instructions**