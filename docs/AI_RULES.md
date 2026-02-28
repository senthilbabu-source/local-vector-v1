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
| `sov-query-google` | Google Gemini 2.0 Flash + Search Grounding | `generateText` | SOV Engine — Google AI Overview simulation. Uses `useSearchGrounding: true` for search-grounded responses with cited source URLs. |
| `sov-query-copilot` | OpenAI GPT-4o (Copilot simulation) | `generateText` | SOV Engine — Microsoft Copilot simulation. Uses Bing-focused system prompt emphasizing Bing Places, Yelp, TripAdvisor citation sources. |
| `truth-audit-openai` | OpenAI gpt-4o-mini | `generateText` | Truth Audit — OpenAI engine (multi-engine accuracy scoring). |
| `truth-audit-perplexity` | Perplexity Sonar | `generateText` | Truth Audit — Perplexity engine (live web, multi-engine). |
| `truth-audit-anthropic` | Anthropic Claude Sonnet | `generateText` | Truth Audit — Anthropic engine (multi-engine comparison). |
| `truth-audit-gemini` | Google Gemini 2.0 Flash | `generateText` | Truth Audit — Google engine (multi-engine comparison). |
| `chat-assistant` | OpenAI gpt-4o | `generateText` | AI Chat Assistant — streaming conversational agent with tool calls. |
| `menu-ocr` | OpenAI gpt-4o | `generateObject` | Menu OCR — GPT-4o Vision for PDF/image menu extraction. Uses `MenuOCRSchema`. |
| `sentiment-extract` | OpenAI gpt-4o-mini | `generateObject` | Sentiment Extraction — per-evaluation sentiment scoring from SOV raw responses. Uses `SentimentExtractionSchema`. |
| `source-extract` | OpenAI gpt-4o-mini | `generateObject` | Source mention extraction from SOV raw_response. Uses `SourceMentionExtractionSchema`. Only for engines without structured citations. |

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
| `weekly-digest-cron` | 5 | 1 | Best-effort email; no retry storm for send failures |

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
- `PageAuditCard` — per-page card with 5 expandable dimension bars (Answer-First 35%, Schema 25%, FAQ 20%, Keyword 10%, Entity 10%), accordion state (one expanded at a time), top recommendation, re-audit button. All dimension scores accept `number | null` — null renders "—" pending state (§20).
- `DimensionBar` — expandable score bar with label, weight text, color-coded fill (green ≥80, amber ≥50, red <50), and chevron toggle. Expands to show `DimensionDetail`.
- `DimensionDetail` — per-dimension explanation text + filtered recommendations (by `dimensionKey`). Schema-type recommendations show "Generate {schemaType} →" button linking to Sprint 70 generators.
- `PageAuditCardWrapper` — client wrapper binding `reauditPage` and `generateSchemaFixes` server actions

### 34.2.1 — PageAuditRecommendation Shape (Sprint 71)
`PageAuditRecommendation` in `lib/page-audit/auditor.ts` has:
- `issue: string` — what's wrong
- `fix: string` — how to fix it
- `impactPoints: number` — estimated score improvement
- `dimensionKey?: DimensionKey` — which of the 5 dimensions this recommendation targets (`'answerFirst' | 'schemaCompleteness' | 'faqSchema' | 'keywordDensity' | 'entityClarity'`)
- `schemaType?: SchemaFixType` — if the fix is "add schema", which type (`'FAQPage' | 'OpeningHoursSpecification' | 'LocalBusiness'`)

Old recommendations without `dimensionKey`/`schemaType` (pre-Sprint 71) render fine — both fields are optional.

### 34.3 — Re-audit Server Action
`reauditPage(pageUrl)` in `app/dashboard/page-audits/actions.ts`. Rate limited: 1 re-audit per page per 5 minutes (in-memory `Map`). Fetches existing audit row for `page_type` + `location_id`, calls `auditPage()` from `lib/page-audit/auditor.ts`, upserts all 5 dimension scores (`answer_first_score`, `schema_completeness_score`, `faq_schema_score`, `entity_clarity_score`, `aeo_readability_score`) + `faq_schema_present` + `overall_score` to `page_audits` (conflict on `org_id, page_url`).

### 34.4 — Prompt Intelligence Gap Alerts on SOV Page
Added to `app/dashboard/share-of-voice/page.tsx` (Growth+ only). Calls `detectQueryGaps(orgId, locationId, supabase)` from `lib/services/prompt-intelligence.service.ts` — returns up to 10 gaps. Calls `computeCategoryBreakdown(queries, evaluations)` — pure function, no DB calls. Shows section between First Mover Opportunities and Query Library with:
- `CategoryBreakdownChart` — horizontal bar chart of citation rates per query category
- `GapAlertCard` — per-gap card with type badge (untracked=amber, competitor_discovered=crimson, zero_citation_cluster=indigo), impact level, and suggested action

### 34.5 — Sidebar Navigation
`Citations` (Globe icon) and `Page Audits` (FileSearch icon) added to `NAV_ITEMS` in `components/layout/Sidebar.tsx`, positioned after "Listings" and before "Settings". `AI Assistant` (MessageSquare icon) added Sprint 68 after Page Audits. `AI Says` (Quote icon, `href: /dashboard/ai-responses`) added Sprint 69 after AI Assistant. `Crawler Analytics` (Bot icon, `href: /dashboard/crawler-analytics`) added Sprint 73. `Proof Timeline` (GitCompareArrows icon, `href: /dashboard/proof-timeline`) added Sprint 77 after Bot Activity. `System Health` (Activity icon, `href: /dashboard/system-health`) added Sprint 76, positioned after AI Says, before Settings. `Entity Health` (HeartPulse icon, `href: /dashboard/entity-health`) added Sprint 80 after Proof Timeline. `AI Sentiment` (SmilePlus icon, `href: /dashboard/sentiment`) added Sprint 81 after Entity Health. Total: 19 nav items.

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
Current error boundaries: `app/dashboard/error.tsx`, `hallucinations/error.tsx`, `share-of-voice/error.tsx`, `ai-assistant/error.tsx`, `content-drafts/error.tsx`, `ai-responses/error.tsx`, `crawler-analytics/error.tsx`, `proof-timeline/error.tsx`, `entity-health/error.tsx`, `sentiment/error.tsx`. When adding new dashboard sections, create a matching `error.tsx`.

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
`nav-dashboard`, `nav-alerts`, `nav-menu`, `nav-share-of-voice`, `nav-content`, `nav-compete`, `nav-listings`, `nav-citations`, `nav-page-audits`, `nav-ai-assistant`, `nav-ai-says`, `nav-crawler-analytics`, `nav-proof-timeline`, `nav-system-health`, `nav-entity-health`, `nav-ai-sentiment`, `nav-settings`, `nav-billing`.
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

### 36.2 — Multi-Model SOV (Perplexity + OpenAI + Google + Copilot)
Growth and Agency orgs run SOV queries against Perplexity, OpenAI, Google (search-grounded), and Copilot (Bing-simulated) in parallel. Starter/Trial orgs use single-model (Perplexity only).

- **Plan gate:** `canRunMultiModelSOV(plan)` from `lib/plan-enforcer.ts` (Growth+).
- **Entry point:** `runMultiModelSOVQuery()` in `lib/services/sov-engine.service.ts` — uses `Promise.allSettled` so one provider failing doesn't kill the rest.
- **Engine tracking:** `SOVQueryResult.engine` field (`'perplexity'` | `'openai'` | `'google'` | `'copilot'`). `writeSOVResults()` writes `result.engine` to `sov_evaluations.engine`.
- **Citation sources:** Google engine returns `citedSources: { url, title }[]` from search grounding. Stored in `sov_evaluations.cited_sources` JSONB. NULL for non-Google engines.
- **Model keys:** `'sov-query'` (Perplexity), `'sov-query-openai'` (OpenAI), `'sov-query-google'` (Google + Search Grounding), and `'sov-query-copilot'` (OpenAI GPT-4o + Copilot system prompt) in `lib/ai/providers.ts`.
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
- **Dashboard UI (Sprint 76):** `app/dashboard/system-health/page.tsx` — Server Component that reads `cron_run_log` via `createServiceRoleClient()` (no user RLS). Pure service `lib/services/cron-health.service.ts` transforms rows into `CronHealthSummary` with per-job stats and overall status (healthy/degraded/failing). Dashboard card: `app/dashboard/_components/CronHealthCard.tsx`.
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
`lib/supabase/database.types.ts` contains the full `Database` type definition covering all 29 tables, 9 enums, and FK `Relationships`. It was manually generated from `supabase/prod_schema.sql` + migration files. When the schema changes (new tables, columns, or enums), this file **must be updated** to match.

### 38.2 — No `as any` on Supabase Clients
The clients in `lib/supabase/server.ts` are generic-typed with `<Database>`. **Never** cast `createClient()` or `createServiceRoleClient()` to `any`. The typed client provides autocomplete on `.from()` table names, `.select()` column inference, and return type safety.

**Test mocks:** In unit tests, mock Supabase with `as unknown as SupabaseClient<Database>` (not bare objects or `as any`). If the test needs access to mock internals (e.g., `_mockUpsert`), use an intersection type:
```typescript
return client as unknown as SupabaseClient<Database> & { _mockUpsert: typeof mockUpsert };
```

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

## 39. Schema Generator — Pure Functions Only (Sprint 70)

All functions in `lib/schema-generator/` are **pure** — they take typed inputs and return JSON-LD objects. They MUST NOT import Supabase clients, call `fetch()`, or perform any I/O.

- **Generators:** `faq-schema.ts`, `hours-schema.ts`, `local-business-schema.ts` — pure functions, no side effects.
- **Data layer:** `lib/data/schema-generator.ts` — the ONLY file that touches Supabase. Casts JSONB columns to ground-truth types (§2, §9, §38.4).
- **Server action:** `app/dashboard/page-audits/schema-actions.ts` — orchestrates data fetch → generate → return. Uses `getSafeAuthContext()` (§3).
- **FAQ answers are ground truth only.** `generateFAQPageSchema()` builds answers from `SchemaLocationInput` fields (address, hours, amenities, categories). No AI-generated text, no marketing language, no fabricated claims.
- **Hours edge cases (§10 applies):** `"closed"` literal → omit from OpeningHoursSpecification. Missing day key → omit. Cross-midnight closes → valid as-is.
- **Schema generation is on-demand** — triggered by user click ("Generate Schema Fix"), not on page load (§5).

## 40. AI Health Score (Sprint 72) — Pure Composite Metric

The AI Health Score is a **computed metric** — no new database tables. It composites data from 4 existing engines into a single 0–100 score with a letter grade (A/B/C/D/F).

**Architecture (3-layer, same as Schema Generator §39):**
- **Pure service:** `lib/services/ai-health-score.service.ts` — `computeHealthScore(input)` takes pre-fetched data, returns `HealthScoreResult`. No I/O, no Supabase. Exports `scoreToGrade()`, `gradeDescription()`.
- **Data layer:** `lib/data/ai-health-score.ts` — `fetchHealthScore(supabase, orgId, locationId)` runs 4 parallel queries (visibility_analytics, page_audits, ai_hallucinations count, ai_audits count), assembles `HealthScoreInput`, calls `computeHealthScore`.
- **Server action:** `app/dashboard/actions/health-score.ts` — `getHealthScore()` with `getSafeAuthContext()` (§3).

**Scoring formula:**
- Visibility (30%): `sovScore × 100`
- Accuracy (25%): `100 - (openHallucinations / totalAudits × 100)`, clamped 0–100
- Structure (25%): `page_audits.overall_score`
- Freshness (20%): 50% schema presence (FAQ 25pts + LocalBiz 25pts) + 50% avg(faq_schema_score, entity_clarity_score)

Null components are excluded and remaining weights re-normalized proportionally. ALL null → score null → null state UI.

**Top Recommendation:** Ranked by `estimatedImpact` descending. Sources: page audit recs, missing schema injections, high hallucination count, low SOV. Max 5 returned.

**Dashboard integration:** `AIHealthScoreCard` is a Server Component in `app/dashboard/_components/`. Added to `DashboardData` interface in `lib/data/dashboard.ts`. No plan gating — available to all tiers.

**Fixture:** `MOCK_HEALTH_SCORE_INPUT` in `src/__fixtures__/golden-tenant.ts`.

## 41. AI Bot Detection Registry — Centralized in `lib/crawler/bot-detector.ts` (Sprint 73)

All AI bot user-agent detection is centralized in `lib/crawler/bot-detector.ts`. The `AI_BOT_REGISTRY` array is the single source of truth for known AI crawlers.

* **Rule:** Never hardcode bot UA patterns inline in middleware, routes, or services. Always import from `bot-detector.ts`.
* **Adding new bots:** Append to `AI_BOT_REGISTRY`. The order matters — first match wins.
* **Dashboard display:** `getAllTrackedBots()` returns the full registry including bots with 0 visits. New bots added to the registry automatically appear in the dashboard.

**Middleware integration (proxy.ts):**
- Bot detection runs in the `menu.*` subdomain handler.
- Logging is fire-and-forget via `fetch()` to `POST /api/internal/crawler-log` — **never awaited** (§17).
- The internal route uses `createServiceRoleClient()` because `crawler_hits` has `service_role_insert` policy only.
- Auth: `x-internal-secret` header matching `CRON_SECRET`.

**Data layer:** `lib/data/crawler-analytics.ts` — `fetchCrawlerAnalytics(supabase, orgId)` aggregates last 30 days by bot_type, cross-references with registry for blind spot detection. Status thresholds: ≥5=active, 1-4=low, 0=blind_spot.

**Fixtures:** `MOCK_CRAWLER_HIT`, `MOCK_CRAWLER_SUMMARY` in `src/__fixtures__/golden-tenant.ts`. Seed UUIDs: g0–g5.

---

## 42. Correction Content Is Ground-Truth Only — No AI Generation (Sprint 75)

Correction content for hallucinations is generated deterministically from verified ground truth data. **No AI/LLM calls** are used to generate correction text.

* **Why:** Using an LLM to correct an LLM hallucination risks producing a new hallucination. Correction content must be factually verifiable.
* **Pattern:** `generateCorrectionPackage()` in `lib/services/correction-generator.service.ts` uses template interpolation with data from the `locations` table (hours, address, amenities, etc.).
* **Never amplify:** GBP posts, website snippets, and social posts MUST NOT include the hallucinated claim. Only `llms.txt` entries reference the false claim (explicitly labeled as incorrect) because AI crawlers need to see the correction paired with the error.
* **Ground truth imports:** Always use types from `lib/types/ground-truth.ts` (§9) for hours_data, amenities, etc.
* **Content_drafts trigger_type:** Correction drafts use `trigger_type='hallucination_correction'` with `trigger_id` pointing to the `ai_hallucinations.id`.
* **Fixtures:** `MOCK_CORRECTION_INPUT` in `src/__fixtures__/golden-tenant.ts`.

---

## 43. Content Freshness Decay Alerts — Citation Rate Drop Detection (Sprint 76)

The freshness alert system detects significant drops in `citation_rate` across consecutive `visibility_analytics` snapshots and optionally emails the org owner.

* **Pure service:** `lib/services/freshness-alert.service.ts` — exports `detectFreshnessDecay(snapshots)` and `formatFreshnessMessage(alert)`. No I/O.
* **Thresholds:** >20% relative drop in `citation_rate` between consecutive snapshots = `warning`. >40% = `critical`. Formula: `((prev - curr) / prev) * 100`.
* **Edge cases:** Null `citation_rate` snapshots are skipped. Zero previous rate skips comparison (avoids division by zero). <2 valid snapshots = `insufficient_data`.
* **Data layer:** `lib/data/freshness-alerts.ts` — `fetchFreshnessAlerts(supabase, orgId)` queries last 5 `visibility_analytics` rows ascending, delegates to `detectFreshnessDecay()`.
* **Email:** `sendFreshnessAlert()` in `lib/email.ts`. Subject: "Citation rate dropped {X}% for {business}". Graceful no-op when `RESEND_API_KEY` absent.
* **Cron wiring:** Both `app/api/cron/sov/route.ts` (inline fallback) and `lib/inngest/functions/sov-cron.ts` (Inngest path) check freshness after the weekly SOV run. Sends email only if `organizations.notify_sov_alerts = true`. Wrapped in try/catch — non-critical (§17).
* **Dashboard:** `app/dashboard/_components/ContentFreshnessCard.tsx` — shows trend badge (declining=amber/crimson, stable/improving=emerald) with current citation rate.
* **Fixtures:** `MOCK_FRESHNESS_SNAPSHOTS` in `src/__fixtures__/golden-tenant.ts` (3 snapshots: 0.45→0.42→0.30, 28.6% decline). Seed UUIDs: e1–e2.

---

## 44. System Health Dashboard — Cron Run Log UI (Sprint 76)

The System Health page provides visibility into the `cron_run_log` table that all 5 crons write to (§37.1).

* **Pure service:** `lib/services/cron-health.service.ts` — exports `buildCronHealthSummary(rows)`, `CRON_REGISTRY` (5 crons with labels + schedules: audit, sov, citation, content-audit, weekly-digest), `CronHealthSummary`, `CronJobSummary`, `CronRunRow`.
* **Overall status:** `healthy` (0 recent failures), `degraded` (1 job with failures), `failing` (2+ jobs with failures or 3+ total failures in recent runs).
* **Data layer:** `lib/data/cron-health.ts` — `fetchCronHealth()` uses `createServiceRoleClient()` internally (cron_run_log has no user RLS policies, same as cron-logger). Queries last 100 rows by `started_at DESC`.
* **Page:** `app/dashboard/system-health/page.tsx` — Server Component. Auth guard. 5 cron job summary cards + recent runs table (last 20). Status badge colors: success=truth-emerald, running=electric-indigo, failed=alert-crimson, timeout=alert-amber.
* **Dashboard card:** `app/dashboard/_components/CronHealthCard.tsx` — overall status badge + failure count + link to `/dashboard/system-health`.
* **Sidebar:** `System Health` nav item with Activity icon, `href: /dashboard/system-health`, positioned after "AI Says", before "Settings".
* **Fixtures:** `MOCK_CRON_RUN_SUCCESS`, `MOCK_CRON_RUN_FAILED` in `src/__fixtures__/golden-tenant.ts`. Seed UUIDs: f0–f3.

---

## 45. Before/After Proof Timeline — Cause→Effect Correlation (Sprint 77)

The Proof Timeline is a visual timeline correlating user actions with measurable outcomes. It proves ROI by connecting cause → effect across data LocalVector already collects. **No new data collection** — everything is derived from 5 existing tables.

* **Pure service:** `lib/services/proof-timeline.service.ts` — exports `buildProofTimeline(input)`, `formatContentType()`, `formatTriggerType()`, `formatBotLabel()`, `truncate()`. 8 event types: `metric_snapshot`, `content_published`, `bot_crawl`, `audit_completed`, `hallucination_detected`, `hallucination_resolved`, `schema_added`, `sov_milestone`. No I/O.
* **Data layer:** `lib/data/proof-timeline.ts` — `fetchProofTimeline(supabase, orgId, locationId, windowDays=90)`. 5 parallel queries (visibility_analytics, page_audits, content_drafts, crawler_hits, ai_hallucinations). Aggregates first bot visit per bot_type in TypeScript.
* **Server Action:** `app/dashboard/actions/proof-timeline.ts` — `getProofTimeline()` with `getSafeAuthContext()` + primary location lookup.
* **Page:** `app/dashboard/proof-timeline/page.tsx` — Server Component. Summary strip (SOV delta, actions completed, issues fixed, timeline window). Reverse-chronological events grouped by date. Impact coloring: positive=green-400, negative=red-400, milestone=indigo-400, neutral=slate-400 (literal Tailwind classes).
* **Dashboard card:** `app/dashboard/_components/ProofTimelineCard.tsx` — summary card linking to full timeline.
* **No plan gating.** Timeline is available to ALL tiers — it's the retention feature.
* **No stored timeline table.** Timeline is computed on-demand from existing data. No `proof_timeline` table.
* **Bot label map:** Lightweight `formatBotLabel()` map in the service — does NOT import `detectAIBot` from `lib/crawler/bot-detector.ts` to keep the service pure.
* **Fixtures:** `MOCK_TIMELINE_INPUT` in `src/__fixtures__/golden-tenant.ts`. Seed UUIDs: h0–h3 (visibility_analytics history).

---

## 46. Weekly Digest Email — Cron + Inngest + Resend Pattern (Sprint 78)

The weekly digest email runs as a cron → Inngest fan-out → per-org Resend send pipeline.

* **Cron route:** `app/api/cron/weekly-digest/route.ts` — dispatches `cron/digest.weekly` event.
* **Kill switch:** `STOP_DIGEST_CRON`
* **Inngest function:** `weekly-digest-cron` (concurrency=5, retries=1)
* **Opt-out:** Respects `organizations.notify_weekly_digest` (default `true`). Only sends to `plan_status` in `['active', 'trialing']`.
* **Recipient:** `users.email` resolved via `organizations.owner_user_id`.
* **Side-effect resilience (§17):** Every `sendDigestEmail()` call is wrapped in `.catch()`. A failed email for one org never aborts the fan-out.
* **React Email template:** `emails/weekly-digest.tsx` — rendered via Resend's `react:` prop.
* **No AI calls.** All content is deterministic from existing dashboard data.
* **Pure service:** `lib/services/weekly-digest.service.ts` — `buildDigestPayload()`. No I/O.
* **Data layer:** `lib/data/weekly-digest.ts` — `fetchDigestForOrg()`. 7 parallel queries + Health Score fetch.
* **Email sender:** `lib/email/send-digest.ts` — `sendDigestEmail()`. Resend wrapper with API key guard.
* **Fixtures:** `MOCK_DIGEST_INPUT` in `src/__fixtures__/golden-tenant.ts`.

## 47. Entity Knowledge Graph — Semi-Manual + Auto-Detect Pattern (Sprint 80)

The Entity Knowledge Graph Health Monitor tracks business presence across 7 AI knowledge graph platforms.

* **Table:** `entity_checks` — one row per org+location, 7 platform columns (confirmed/missing/unchecked/incomplete), `platform_metadata` JSONB, `entity_score` integer.
* **Auto-detection:** Google KP (from `google_place_id`), GBP (from `location_integrations`), Yelp (from integrations). All others are user self-assessed via the checklist UI.
* **Score:** N/6 core platforms confirmed (Wikidata excluded — it's advanced/optional).
* **Rating thresholds:** >=5 = strong, 3-4 = at_risk, 0-2 = critical, all unchecked = unknown.
* **Registry:** `ENTITY_PLATFORM_REGISTRY` in `lib/services/entity-health.service.ts` is the canonical list of platforms with claim guides and AI impact descriptions.
* **Lazy initialization:** `entity_checks` row is created on first page visit via `fetchEntityHealth()`.
* **Pure service:** `lib/services/entity-health.service.ts` — `computeEntityHealth()`. No I/O.
* **Auto-detect service:** `lib/services/entity-auto-detect.ts` — `autoDetectEntityPresence()`. No I/O.
* **Data layer:** `lib/data/entity-health.ts` — `fetchEntityHealth()`. Lazy init + auto-detection.
* **Server actions:** `app/dashboard/actions/entity-health.ts` — `getEntityHealth()`, `updateEntityStatus()`.
* **Page:** `app/dashboard/entity-health/page.tsx` — checklist UI with status dropdowns, claim guides, score bar.
* **Dashboard card:** `app/dashboard/_components/EntityHealthCard.tsx`.
* **Fixtures:** `MOCK_ENTITY_CHECK` in `src/__fixtures__/golden-tenant.ts`.

## 48. AI Sentiment Extraction Pipeline — SOV Post-Processing (Sprint 81)

The Sentiment Tracker extracts per-evaluation sentiment from SOV raw responses using `generateObject` + `SentimentExtractionSchema`, then aggregates into dashboard-ready summaries.

* **Table column:** `sov_evaluations.sentiment_data` — JSONB column added via migration `20260226000010`. Partial index on `(org_id, created_at DESC) WHERE sentiment_data IS NOT NULL`.
* **Schema:** `SentimentExtractionSchema` in `lib/ai/schemas.ts` — score (-1 to 1), label (5 values), descriptors (positive/negative/neutral arrays), tone (6 values), recommendation_strength (4 values).
* **Model key:** `sentiment-extract` → OpenAI gpt-4o-mini in `lib/ai/providers.ts`. Uses `generateObject` with `zodSchema()` wrapper for Zod v4 compatibility.
* **Extraction service:** `lib/services/sentiment.service.ts` — `extractSentiment(rawResponse, businessName)`. Pre-checks: null/empty → null, `hasApiKey('openai')` false → null, business name not in response → quick `not_mentioned` result (no API call). On API error → null (never throws).
* **Aggregation (pure):** `aggregateSentiment(evaluations)` — average score (2dp), dominant label/tone via frequency, deduped descriptors by frequency (case-insensitive, max 15 per category), per-engine breakdown (max 10 descriptors each). Exported utility helpers: `countFrequencies`, `topKey`, `dedupeByFrequency`, `groupBy`.
* **Pipeline integration:** `extractSOVSentiment(results, businessName)` and `writeSentimentData(supabase, sentimentMap)` in `lib/services/sov-engine.service.ts`. Called after `writeSOVResults()` in both Inngest cron and inline cron fallback. Uses `Promise.allSettled` — individual extraction failures are isolated.
* **`writeSOVResults()` change:** Returns `evaluationIds: Array<{ id, engine, rawResponse }>` (via `.insert().select('id')`) to feed the sentiment pipeline.
* **Data layer:** `lib/data/sentiment.ts` — `fetchSentimentSummary()` (30-day default, non-null sentiment_data) and `fetchSentimentTrend()` (12-week default, grouped by ISO week).
* **Dashboard page:** `app/dashboard/sentiment/page.tsx` — Server Component with score card, descriptor display, engine breakdown, trend summary, empty state. Error boundary at `error.tsx`.
* **Sidebar:** "AI Sentiment" nav item with `SmilePlus` icon, path `/dashboard/sentiment`.
* **Fixtures:** `MOCK_SENTIMENT_EXTRACTION` and `MOCK_SENTIMENT_SUMMARY` in `src/__fixtures__/golden-tenant.ts`.
* **`hasApiKey()` note:** Accepts provider names (`'openai'`, `'perplexity'`, `'anthropic'`, `'google'`), NOT model keys. The extraction service checks `hasApiKey('openai')`.

## 49. Citation Source Intelligence — What AI Reads About You (Sprint 82)

Identifies which web pages and sources AI engines cite when describing the business.

* **Two data paths:** (1) Structured `cited_sources` JSONB from Google/Perplexity (Sprint 74), (2) AI-extracted `source_mentions` from OpenAI/Copilot via `gpt-4o-mini`.
* **Only engines without structured citations get AI extraction** — saves tokens. `extractSOVSourceMentions()` filters by checking `citedSources` is null or empty.
* **Pipeline position:** Separate step after sentiment extraction (Sprint 81) in both Inngest cron and inline fallback. SOV + sentiment data safe even if source extraction fails.
* **Analysis:** `analyzeSourceIntelligence()` is a pure function in `lib/services/source-intelligence.service.ts` — categorizes sources (first_party/review_site/directory/competitor/news/social/blog/other), deduplicates by normalized URL, ranks by citation count, generates alerts.
* **Alerts:** `competitor_content` (high), `missing_first_party` when <10% (medium), over-reliance on single source >50% (medium).
* **Different from Citation Gap (§34.1):** Gap = which platforms you're listed on (market-level, aggregate). Source Intelligence = which specific pages AI reads about YOU (org-level, per-evaluation).
* **Schema:** `SourceMentionExtractionSchema` in `lib/ai/schemas.ts` — sources array (name, type, inferredUrl, context, isCompetitorContent), sourcingQuality enum.
* **Model key:** `source-extract` → OpenAI gpt-4o-mini. Uses `hasApiKey('openai')` (not the model key name).
* **DB column:** `sov_evaluations.source_mentions JSONB` — migration `20260226000011`.
* **Data layer:** `lib/data/source-intelligence.ts` — `fetchSourceIntelligence()` (30-day default, parallel queries for evaluations + location).
* **Dashboard:** `app/dashboard/source-intelligence/page.tsx` — alerts, top sources table, category breakdown bars, per-engine breakdown, empty state.
* **Sidebar:** "AI Sources" nav item with `BookOpen` icon, path `/dashboard/source-intelligence`.
* **Fixtures:** `MOCK_SOURCE_MENTION_EXTRACTION` and `MOCK_SOURCE_INTELLIGENCE_INPUT` in `src/__fixtures__/golden-tenant.ts`.

## 50. 📅 Proactive Content Calendar (Sprint 83)

The Content Calendar aggregates 5 signal sources into time-bucketed content recommendations.

* **Pure service:** `lib/services/content-calendar.service.ts` — `generateContentCalendar()` takes `CalendarInput`, returns `ContentCalendarResult`.
* **5 signal sources:** occasions (trigger window), SOV gaps (null rank), page freshness (30+ days), competitor gaps (pending actions), hallucination corrections (open status).
* **Urgency scoring:** 0-100 per recommendation. Occasions use days-until-peak (closer = higher). SOV uses gap ratio. Freshness uses age. Competitors use gap magnitude. Hallucinations use severity.
* **Time buckets:** this_week (≤7 days), next_week (8-14), two_weeks (15-21), later (22+).
* **Deduplication:** By recommendation key. Existing draft trigger_ids filtered out to avoid duplicate suggestions.
* **No AI calls.** All recommendations are deterministic from existing data.
* **No new tables.** Calendar is computed at page load from existing signal tables.
* **No plan gating.** Available to all tiers.
* **Different from OccasionTimeline (§36.1):** OccasionTimeline is an occasion-only horizontal scroller on the Content Drafts page. Content Calendar is a full-page view aggregating ALL 5 signal types with urgency scoring.
* **Data layer:** `lib/data/content-calendar.ts` — `fetchContentCalendar()` runs 11 parallel Supabase queries (locations, local_occasions, sov_evaluations, target_queries, page_audits, magic_menus, crawler_hits ×2, competitor_intercepts, ai_hallucinations, content_drafts).
* **Dashboard:** `app/dashboard/content-calendar/page.tsx` — Server Component with signal summary strip, time-bucketed sections, recommendation cards (action badge, urgency bar, CTAs), empty state.
* **Sidebar:** "Content Calendar" nav item with `CalendarDays` icon, path `/dashboard/content-calendar`.
* **Fixtures:** `MOCK_CALENDAR_INPUT` in `src/__fixtures__/golden-tenant.ts` — mixed signals (1 occasion, 2 SOV gaps, 1 stale page, 1 stale menu, 1 competitor gap, 1 hallucination).

## 47. Agent Readiness Score — AAO (Sprint 84)

Evaluates whether AI agents can transact with the business. 6 capabilities, weighted scoring (total = 100):

* **Structured Hours** (15 pts): OpeningHoursSpecification schema or `hours_data` populated.
* **Menu Schema** (15 pts): Menu JSON-LD or published Magic Menu.
* **ReserveAction Schema** (25 pts): ReserveAction in markup or booking URL detected.
* **OrderAction Schema** (25 pts): OrderAction in markup or ordering URL detected.
* **Accessible CTAs** (10 pts): Inferred from `entity_clarity_score` in page audits.
* **CAPTCHA-Free Flows** (10 pts): Always partial in V1 (requires live crawl for real detection).

Statuses: active (full pts), partial (50% pts), missing (0 pts). Levels: agent_ready >= 70, partially_ready >= 40, not_ready < 40.

* **Schema generators:** `lib/schema-generator/action-schema.ts` — pure functions (§39). `generateReserveActionSchema()` + `generateOrderActionSchema()`.
* **No external API calls in V1.** Computed from existing tables.
* **No plan gating.** Available to all tiers.
* **Pure service:** `lib/services/agent-readiness.service.ts` — `computeAgentReadiness()` takes `AgentReadinessInput`, returns `AgentReadinessResult`.
* **Data layer:** `lib/data/agent-readiness.ts` — `fetchAgentReadiness()` runs 3 parallel Supabase queries (locations, magic_menus, page_audits).
* **Dashboard:** `app/dashboard/agent-readiness/page.tsx` — Server Component with score ring, top priority card, capability checklist.
* **Sidebar:** "Agent Readiness" nav item with `BotMessageSquare` icon, path `/dashboard/agent-readiness`.
* **Fixtures:** `MOCK_AGENT_READINESS_INPUT` in `src/__fixtures__/golden-tenant.ts` — hours + menu active, actions missing, score=40, partially_ready.

## 48. Revenue Impact Calculator (Sprint 85)

Converts visibility gaps into estimated dollar amounts. Three revenue streams:

* **SOV Gap Revenue:** `CATEGORY_SEARCH_VOLUME[category] x AI_RECOMMENDATION_CTR x gapRatio x avgCustomerValue`. Categories: discovery=90, comparison=60, occasion=45, near_me=120, custom=30.
* **Hallucination Revenue:** `SEVERITY_IMPACT[severity] x avgCustomerValue`. Severities: critical=8, high=5, medium=2, low=1.
* **Competitor Revenue:** `monthlyCovers x competitorAdvantage x AI_INFLUENCE_RATE x avgCustomerValue`. AI_INFLUENCE_RATE=0.05, AI_RECOMMENDATION_CTR=0.08.

* **Migration:** `20260226000012_revenue_config.sql` adds `avg_customer_value` (numeric, default 45.00) and `monthly_covers` (integer, default 800) to `locations`.
* **Constants are estimates, not guarantees.** UI must use "estimated", "approximately", "projected" language.
* **Revenue config:** User-customizable via `locations.avg_customer_value` + `locations.monthly_covers`. Falls back to `DEFAULT_REVENUE_CONFIG` when null.
* **No plan gating.** Dollar amounts drive Trial -> Paid conversion.
* **Pure service:** `lib/services/revenue-impact.service.ts` — `computeRevenueImpact()` takes `RevenueImpactInput`, returns `RevenueImpactResult`.
* **Data layer:** `lib/data/revenue-impact.ts` — `fetchRevenueImpact()` runs 5 parallel Supabase queries (locations, target_queries, sov_evaluations x2, ai_hallucinations).
* **Dashboard:** `app/dashboard/revenue-impact/page.tsx` — Server Component with hero dollar amount, line item cards, config form.
* **Sidebar:** "Revenue Impact" nav item with `DollarSign` icon, path `/dashboard/revenue-impact`.
* **Fixtures:** `MOCK_REVENUE_IMPACT_INPUT` in `src/__fixtures__/golden-tenant.ts` — 3 SOV gaps, 2 hallucinations, competitor advantage.

## 49. SOV Gap → Content Brief Generator (Sprint 86)

Generates AEO-optimized content briefs for SOV gap queries.

* **Two-layer design:**
  - **Layer 1 (pure):** `buildBriefStructure()` — slug, title tag, H1, schema recommendations, llms.txt entry. No AI, no I/O.
  - **Layer 2 (AI):** `generateBriefContent()` — `generateObject` with `gpt-4o-mini` + `ContentBriefSchema`. Produces answer capsule, outline sections, FAQ questions. System prompt includes business ground truth from `locations` table.
* **Model key:** `content-brief` → gpt-4o-mini (§19.3).
* **Schema:** `ContentBriefSchema` in `lib/ai/schemas.ts`. Required fields: answerCapsule, outlineSections (3-6), faqQuestions (3-5), metaDescription.
* **Server action:** `generateContentBrief(queryId)` — user-initiated (§5). Checks for duplicate drafts. Saves to `content_drafts` with `trigger_type='prompt_missing'`, `trigger_id=query.id`.
* **Fallback:** When no API key, generates structure-only brief with placeholder content. Draft still saved.
* **Ground truth only:** AI prompt includes ONLY facts from `locations` record. Never fabricates prices, menu items, hours.
* **Content Calendar integration:** Sprint 83 SOV gap recommendations already link to this generator.
* **Fixtures:** `MOCK_BRIEF_STRUCTURE_INPUT` + `MOCK_CONTENT_BRIEF` in `src/__fixtures__/golden-tenant.ts`.

## 50. AI Visibility Cluster Map (Sprint 87)

Scatter plot visualization showing where a business sits in each AI engine's recommendation space, overlaid with hallucination fog zones from the Fear Engine.

* **Axes:** X = Brand Authority (citation frequency, 0-100), Y = Fact Accuracy (truth score, 0-100), Bubble size = Share of Voice (0-1).
* **Pure service:** `lib/services/cluster-map.service.ts` — `buildClusterMap()`, `calculateBrandAuthority()`, `extractCompetitorPoints()`, `buildHallucinationZones()`, `filterByEngine()`, `detectAvailableEngines()`. No I/O, no AI calls.
* **Engine normalization:** `ENGINE_MAP` maps both `sov_evaluations.engine` (varchar: `perplexity`, `openai`, `google`) and `ai_hallucinations.model_provider` (enum: `openai-gpt4o`, `perplexity-sonar`, `google-gemini`) to `EngineFilter` union type.
* **Hallucination fog:** Each open hallucination creates a translucent red zone. `SEVERITY_PENALTY` offsets Y-axis (critical: -25, high: -15, medium: -8, low: -3). `SEVERITY_RADIUS` controls fog size (critical: 40, high: 30, medium: 20, low: 12).
* **Competitor points:** Extracted from `mentioned_competitors` JSONB in `sov_evaluations`. Assumed `factAccuracy=80` (no hallucination data for competitors).
* **Data fetcher:** `lib/data/cluster-map.ts` — 4 parallel queries: `locations`, `sov_evaluations` (30-day), `ai_hallucinations` (open), `visibility_analytics` (latest). RLS-scoped.
* **No new tables, no new migrations.** All data from existing tables.
* **Engine toggle:** Client-side filter that re-fetches data via `getClusterMapData(engineFilter)` server action with `useTransition`.
* **Chart:** Recharts `ScatterChart` with custom dot renderer (star for self, circle for competitors), SVG fog overlay with Gaussian blur, quadrant reference lines at 50/50.
* **Fixtures:** `MOCK_CLUSTER_INPUT`, `MOCK_EVALUATIONS`, `MOCK_HALLUCINATIONS` in `src/__fixtures__/cluster-map-fixtures.ts`.

## 51. Cookie-Pointer Pattern — OAuth Data Handoff (Sprint 89)

When passing data between an OAuth callback and a downstream picker page, NEVER store the raw payload in a cookie. Browsers silently drop cookies over 4KB.

* **Pattern:** Write the full payload to a `pending_*` table with a short TTL (`expires_at = NOW() + 10 minutes`). Store ONLY the UUID pointer in an `httpOnly` cookie.
* **Example:** `pending_gbp_imports` stores the raw GBP locations array. The `gbp_import_id` cookie holds just the UUID.
* **Validation:** The picker page must verify `org_id` matches the authenticated user AND `expires_at > now()` before rendering.
* **Cleanup:** After successful import, DELETE the `pending_*` row and the cookie.
* **Pure mapper pattern:** `lib/services/gbp-mapper.ts` — all GBP-to-LocalVector field mapping is in pure functions (no I/O, no Supabase). Tested independently, called from both callback (auto-import) and server action (picker import).

## 41. GBP Data Mapping — Centralized in `lib/gbp/gbp-data-mapper.ts` (Sprint 89)

All Google Business Profile API response transformation for re-sync/import is centralized in `lib/gbp/gbp-data-mapper.ts`. The initial OAuth import mapper remains at `lib/services/gbp-mapper.ts`.

* **Rule:** Never inline GBP field transformation in API routes or actions. Always call `mapGBPToLocation()`.
* **Adding new fields:** Add to `GBPLocation` interface in `lib/types/gbp.ts`, add mapping in `mapGBPToLocation()`, add test in `gbp-data-mapper.test.ts`.
* **Adding amenities:** Append to `KNOWN_AMENITY_ATTRIBUTES` record. New entries automatically appear in import output.
* **Token refresh:** All token expiry checks and refreshes use `lib/services/gbp-token-refresh.ts`. Never inline OAuth token refresh calls.
* **isTokenExpired():** 5-minute buffer before actual expiry. Use before any GBP API call.

---

## 42. Zero-Skip Test Policy (Sprint 92)

The test suite must always run with zero skips. `vi.skip`, `it.skip`, and `describe.skip` are prohibited in committed code.

* **Permitted:** `it.todo('description — Sprint N will implement')` for genuinely future work
* **Not permitted:** `it.skip(...)` as a workaround for a broken test or missing infrastructure
* **Integration tests:** Live in `src/__tests__/integration/` and are excluded from default `npx vitest run`. Run via `npm run test:integration` (requires local Supabase).
* **CI enforcer:** The CI workflow runs `tsc --noEmit` → `vitest run` (unit only). Both must pass.

## 43. Sentry Integration (Sprint 26A, verified Sprint 92)

Sentry is integrated via `@sentry/nextjs`. Configuration files: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`.

* **Rule:** `enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN` — Sentry only fires when the DSN is set (disabled in test/CI where DSN is empty)
* **Error boundaries:** Dashboard has `app/dashboard/error.tsx` that calls `Sentry.captureException()`
* **Source maps:** Uploaded to Sentry via `SENTRY_AUTH_TOKEN` during production builds only
* **next.config.ts:** Wrapped with `withSentryConfig()` — do not remove this wrapper

## 44. Publish Pipeline — External Write Confirmation + Non-Blocking DB (Sprint 94)

All actions that write to external platforms (WordPress, GBP) follow two rules:

* **Confirmation required:** Irreversible external writes (publish, post) must have an explicit UI confirmation step before firing. Disable the confirm button immediately on click.
* **Non-blocking DB update:** After a successful external publish, the DB update (published_at, published_url, status) is non-blocking. A failed DB update is logged but does NOT cause the action to return `ok:false` — the content IS published externally.
* **GBP Posts API:** Uses `mybusiness.googleapis.com/v4/` — NOT the same as the Business Information API (`mybusinessbusinessinformation.googleapis.com/v1/`) used for Sprint 89 data import.
* **GBP content:** Strip HTML tags before sending to GBP summary. Auto-truncate at sentence boundary, 1500 chars max.
* **WordPress auth:** Basic auth with `base64(username:applicationPassword)`. Trim external whitespace from Application Password.

## 45. Export Routes — Node.js Runtime Required (Sprint 95)

Export routes at `app/api/exports/` must have `export const runtime = 'nodejs'`.

* **Rule:** Never `export const runtime = 'edge'` in any export route.
* **Download trigger:** `window.location.href = '/api/exports/...'` — NOT `fetch()`.
  Direct navigation is required for `Content-Disposition: attachment` to trigger the download dialog.
* **CSV:** Always use `escapeCSVValue()` + `sanitizeCSVField()` from `lib/exports/csv-builder.ts`.

## 46. React-PDF Rules (Sprint 95)

`@react-pdf/renderer` is used for PDF generation. Server-side only.

* **Never import** `@react-pdf/renderer` in `'use client'` components.
* **Only use** React-PDF primitives: `Document`, `Page`, `View`, `Text`, `Image`, `Link`.
* **All styles** must be in `StyleSheet.create()` — no inline dynamic style objects.
* **No HTML** inside PDF templates (`<div>`, `<p>`, `<table>` are invalid).
* **Never** `<Image src={null}>` — use a styled `<View>` placeholder instead.

## 47. Plan Gate UI — Always Use `<PlanGate>` (Sprint 96)

All plan-gated UI in the dashboard uses `components/plan-gate/PlanGate.tsx`. Never implement ad-hoc blur or upgrade cards inline in page components.

**Rules:**
- `<PlanGate requiredPlan="..." currentPlan={plan} feature="...">` wraps only the value-bearing content block — never the entire page, never the page header.
- Data MUST still be fetched for gated users. `<PlanGate>` receives real populated children. The blur teaser only works because Starter users see their actual data blurred.
- Plan satisfaction logic lives exclusively in `planSatisfies()` from `lib/plan-enforcer.ts`. Never compare plan strings inline (e.g. `plan !== 'growth'`).
- Tailwind blur class is always the literal `"blur-sm"`. Never construct blur class dynamically (violates §12).
- `pointer-events-none` and `select-none` must accompany `blur-sm` on gated content — prevents keyboard traversal into aria-hidden content.
- `data-testid="plan-gate-upgrade-cta"` must be present on the upgrade button for Playwright tests.
- The upgrade CTA is an `<a href>` tag — not a `<button onClick>`. Upgrade navigation is always a full page transition, not a client-side handler.
- `source-intelligence` requires `agency` plan. All other gated dashboard pages require `growth`. Do not relax these thresholds without a product decision and MEMORY.md entry.

---

## §50. Dynamic llms.txt + Citation Cron — Architecture Rules (Sprint 97)

### llms.txt
- `generateLLMsTxt()` in `lib/llms-txt/llms-txt-generator.ts` is the ONLY place that constructs org-level llms.txt content. Never construct llms.txt strings inline in route handlers.
- Data loading is in `loadLLMsTxtData()` (`lib/llms-txt/llms-txt-data-loader.ts`) — never inline DB queries in the route handler.
- The public `/llms.txt` route ALWAYS returns something (never 404). Fall back to the platform-level static content if org slug is not found.
- `regenerateLLMsTxt()` server action checks plan gate before touching the DB. Growth+ only.
- llms.txt cache: `s-maxage=21600`. After manual regeneration, set `no-cache` to force revalidation.
- Multi-location llms.txt (serving per-location files) is deferred to Sprint 100+. V1 always uses primary location.
- The per-menu llms.txt at `/m/[slug]/llms.txt` is separate and serves magic menu data. The org-level `/llms.txt?org=slug` serves ground truth data.

### Citation Cron
- The citation cron in `app/api/cron/citation/route.ts` is **tenant-derived**: it reads each org's real category+city/state from the locations table.
- `normalizeCategoryLabel()` in `lib/citation/citation-query-builder.ts` cleans raw category strings for query construction.
- Citation data is **market-level intelligence** (shared across orgs in the same category+metro), stored in `citation_source_intelligence` with unique key `(business_category, city, state, platform, model_provider)`.
- The cron MUST be error-isolated: one org/tuple failure must not abort others. Use try/catch per-tuple.
- Citation cron skips Starter/Trial plan orgs. Check with `planSatisfies(org.plan, 'growth')`.
- Perplexity is called via `runCitationSample()` from `lib/services/citation-engine.service.ts`.
- `KNOWN_CITATION_PLATFORMS` in `lib/citation/citation-source-parser.ts` is the extended registry for domain-to-platform mapping.
- Duplicate category+metro tuples across orgs are deduplicated — each unique tuple is processed once.

---

## §51. Multi-User Role System — Architecture Rules (Sprint 98)

### Role Hierarchy
- Canonical hierarchy: `viewer=0, member=0, admin=1, owner=2`. The `member` role is a legacy alias for `viewer` — they share level 0.
- Role comparison MUST use `roleSatisfies(currentRole, requiredRole)` from `lib/auth/org-roles.ts`. Never compare role strings inline (e.g., `role === 'admin'`).
- `ROLE_PERMISSIONS` in `lib/auth/org-roles.ts` is the single source of truth for permission→minimum-role mapping. Add new permissions there — never inline.
- Non-members (null role from `getOrgRole()`) always fail role checks, even for viewer-level permissions. `assertOrgRole()` has an explicit null guard for this.

### Invitation Flow
- Token-based: `pending_invitations.token` is a 32-byte hex string generated by Postgres (`encode(gen_random_bytes(32), 'hex')`). Tokens are UNIQUE and indexed.
- `UNIQUE(org_id, email)` on `pending_invitations` — one active invitation per email per org. Re-inviting after revoke/expiry deletes the old row and creates a fresh one (new token).
- Email delivery failure rolls back the invitation row — no ghost invites in the DB.
- Invite acceptance uses `createServiceRoleClient()` to bypass RLS — the invitee is not yet an org member when accepting.
- Email match check is case-insensitive: `invite.email.toLowerCase() === sessionEmail.toLowerCase()`.

### Two-UUID System
- `auth.uid()` (from Supabase Auth) ≠ `public.users.id`. The mapping is `public.users.auth_provider_id = auth.uid()`.
- All foreign keys in `memberships` and `pending_invitations` reference `public.users.id`, NOT `auth.users.id`.
- `resolvePublicUserId(authUid)` in `app/actions/invitations.ts` performs this mapping. Always resolve before writing to `invited_by` or `user_id`.

### RLS
- `pending_invitations` has org-scoped RLS using `current_user_org_id()` — SELECT, INSERT, UPDATE only for the user's own org.
- DELETE policy is intentionally omitted on `pending_invitations` — revocation is a status update, not a row delete (except for re-invite cleanup which uses service role or relies on the INSERT policy after delete).
- `memberships` table has NO RLS policies by design — it's queried internally by the `current_user_org_id()` SECURITY DEFINER function.

### Plan Gate
- Adding members beyond the owner requires `agency` plan. Check with `planSatisfies(ctx.plan, 'agency')` in the `sendInvitation` action.
- Team management UI wraps the invite form in `<PlanGate requiredPlan="agency">`.

### UI
- Team management page: `/dashboard/settings/team`. Viewers see the member list (read-only). Admin+ sees the invite form and action buttons.
- Invite acceptance page: `/invite/[token]` (public route group). 6 states: invalid, pending_login, pending_accept, wrong_account, success, error.
- Invite email template: `emails/InvitationEmail.tsx`. Dark theme matching existing design system.

**Rules:**
- Never skip `resolvePublicUserId()` when writing `invited_by` or `user_id` to `memberships` or `pending_invitations`.
- Owner role cannot be assigned via `updateMemberRole()` — ownership transfer is a separate (future) action.
- Owner cannot be removed via `removeMember()` — must transfer ownership first.
- `sendInvitation` only allows inviting with roles `admin` or `viewer` — never `owner`.
- All invitation server actions derive `orgId` from `getSafeAuthContext()` — never from client input (AI_RULES §18).

---

## §53. Multi-Location Management — Active Context Rules (Sprint 100)

### Active Location Resolution
- `resolveActiveLocation()` in `lib/location/active-location.ts` is the ONLY place that resolves the active location. Never read the `lv_selected_location` cookie directly in page components.
- Resolution order: cookie → primary → oldest → null. All stages filter `is_archived = false`.
- `getActiveLocationId()` is the convenience wrapper — returns just the location ID string or null.
- Dashboard layout (`app/dashboard/layout.tsx`) calls `resolveActiveLocation()` once and passes results to LocationSwitcher + child pages.

### Location Cookie
- Cookie name: `lv_selected_location`. Constant exported from `lib/location/active-location.ts`.
- MUST be set via `switchActiveLocation()` server action — never via `document.cookie` on the client.
- Cookie options: `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `maxAge: 365 days`, `secure` in production.
- When archiving a location, if it matches the current cookie value, the cookie MUST be cleared.
- When switching orgs, the location cookie MUST be cleared (locations belong to orgs).

### Data Isolation
- Every data-fetching function that queries tenant-scoped tables MUST accept an optional `locationId?: string | null` parameter.
- Pattern: `if (locationId) query = query.eq('location_id', locationId)` — null means org-wide (backwards compatible).
- Data layers with location isolation: `dashboard.ts`, `crawler-analytics.ts`, `ai-responses.ts`, `freshness-alerts.ts`, `schema-generator.ts`.
- Page components resolve active location via `getActiveLocationId()` and pass it to their data layer.

### Location CRUD
- All location actions live in `app/actions/locations.ts`. Five actions: `addLocation`, `updateLocation`, `archiveLocation`, `setPrimaryLocation`, `switchActiveLocation`.
- Role requirements: `addLocation`/`updateLocation`/`archiveLocation` = admin+. `setPrimaryLocation` = owner only. `switchActiveLocation` = any role.
- Plan limit: Agency = 10 locations max. All other plans = 1 location. Enforced in `addLocation` via `lib/plan-enforcer.ts`.
- `is_primary` uniqueness enforced by partial unique index `idx_locations_one_primary_per_org ON locations(org_id) WHERE is_primary = true AND is_archived = false`.
- Cannot archive: primary location, only active location, already-archived location.
- Auto-primary: first location added to an org is automatically set as primary.

### OrgSwitcher
- `getActiveOrgId()` in `lib/auth/active-org.ts` resolves active org from `lv_active_org` cookie → validate against memberships → fallback to first.
- `switchActiveOrg()` in `app/actions/switch-org.ts` validates membership, sets org cookie, and clears location cookie.
- `OrgSwitcher` component only renders when user belongs to 2+ organizations.

### Location Management Page
- Location management lives at `/dashboard/settings/locations` (not `/dashboard/locations`).
- Old `/dashboard/locations` redirects to the new path.
- Location cards show: business name, display name, city/state, primary badge, edit/archive/set-primary actions.
- Plan gate: multi-location add requires Agency plan. Single-location management is available to all plans.

**Rules:**
- Never use `document.cookie` to set `lv_selected_location` or `lv_active_org` — always use server actions.
- Never query data without passing `locationId` when the active location is resolved. Omitting it silently returns org-wide data.
- `display_name` is optional and distinct from `business_name`. Display in UI: `display_name ?? business_name`.
- Location schemas: `AddLocationSchema` (create with display_name/timezone) and `UpdateLocationSchema` (partial) in `lib/schemas/locations.ts`.

---

## §54. Badges + Occasion Alerts — Architecture Rules (Sprint 101)

### Sidebar badges
- `lib/badges/badge-counts.ts` is the ONLY place sidebar badge counts are computed.
  Never inline badge count queries in Sidebar.tsx or layout components.
- `getSidebarBadgeCounts()` returns 0 on any error — never throws.
  Sidebar must always render, with or without badges.
- `markSectionSeen()` is called at the top of the Server Component for each
  badged section page (content-drafts, share-of-voice). Fire-and-forget safe.
- Badge counts use `sidebar_badge_state.last_seen_at` as the "seen" watermark.
  Items older than last_seen_at do not count toward the badge.
- `formatBadgeCount()` is the ONLY place the "99+" cap logic lives.
  Never implement the cap inline.

### Occasion alerts
- `lib/occasions/occasion-feed.ts` is the ONLY place occasion alert queries live.
  Never query `local_occasions` directly in page components for alerts.
- `getOccasionAlerts()` returns [] on any error — never throws.
  Dashboard must always load even if occasion query fails.
- Snooze uses far-future date (year 9999) for permanent dismiss — not a
  separate boolean column. Filter is always `snoozed_until > now()`.
- `occasion_snoozes` is per-user, not per-org. One user snoozed != all users snoozed.
- Occasion urgency threshold: `daysUntil <= 3` = urgent. Hardcoded in V1.
- OccasionAlertFeed shows maximum 3 cards. Never more.
- Optimistic UI on dismiss/snooze: card removes immediately client-side.
  Server action failure restores the card via router.refresh().

---

## §55. Schema Type Alignment — `database.types.ts` is the TypeScript Authority (FIX-1)

After any migration that adds tables or columns, the following three files must be updated together:

1. `lib/supabase/database.types.ts` — Regenerate with `npx supabase gen types typescript`
2. `supabase/prod_schema.sql` — Regenerate with `npx supabase db dump`
3. Any code using `(supabase as any)` workarounds for the new tables — remove casts

**Rule:** Never ship a migration without immediately regenerating these two files.
**Rule:** Never use `(supabase as any)` as a permanent fix — it is a temporary workaround only.
**Rule:** `npx tsc --noEmit` must return 0 errors before any commit.
**Enforcement:** `src/__tests__/unit/database-types-completeness.test.ts` will fail if `(supabase as any)` casts are reintroduced for Sprint 99-101 tables.

---

## §56. Security Maintenance Rules (FIX-2)

**npm audit:** Run `npm audit` before every production deployment. Any HIGH or CRITICAL vulnerability blocks deployment.
**RLS completeness:** Every new table with an `org_id` column MUST have ENABLE ROW LEVEL SECURITY and at minimum a SELECT policy using `current_user_org_id()`. Tables without `org_id` (global lookup tables) document their public-read intent with a comment.
**MCP security:** The `/api/mcp/[transport]` endpoint serves org-scoped tools. The `@modelcontextprotocol/sdk` package must be at the latest patched version at all times. Cross-client data leaks at the transport layer bypass all org isolation.

---

## §57. Apple Business Connect Sync (PLACEHOLDER — Sprint 102, NOT YET EXECUTED)

> **Status:** Awaiting Apple Business Connect API approval. Do not implement until API access is confirmed.
> **Gate condition:** Apple Business Connect API credentials approved and accessible.

Sprint 102 will sync business profile data from Apple Business Connect (ABC) into LocalVector's `locations` table via a new `abc_connections` table and `/api/cron/abc-sync` route.

**Pre-sprint requirements:**
- Submit Apple Business Connect API access request at https://developer.apple.com/business-connect/
- Confirm API response schema before designing the data mapper
- Follow the GBP data mapper pattern from `lib/gbp/gbp-data-mapper.ts` for the ABC mapper

**Provisional rule:** All Apple Business Connect data transformation must be centralized in `lib/abc/abc-data-mapper.ts` — never inline in route handlers.

---

## §58. Bing Places Sync (PLACEHOLDER — Sprint 103, NOT YET EXECUTED)

> **Status:** Awaiting Bing Places Partner API approval. Do not implement until API access is confirmed.
> **Gate condition:** Bing Places Partner API credentials approved and accessible.

Sprint 103 will sync business data from Bing Places for Business into LocalVector via a new `bing_connections` table and `/api/cron/bing-sync` route.

**Pre-sprint requirements:**
- Apply for Bing Places Partner API at https://bingplaces.com
- Confirm Bing Places API authentication method (OAuth vs API key)
- Follow the same OAuth + cron pattern established by GBP (Sprints 57B, 89, 90)

**Provisional rule:** All Bing Places data transformation must be centralized in `lib/bing/bing-data-mapper.ts`.

---

## §59. Dynamic FAQ Auto-Generation (PLACEHOLDER — Sprint 104, NOT YET EXECUTED)

> **Status:** No external dependencies. Can execute immediately.
> **Gate condition:** None — ready to run.

Sprint 104 will auto-generate FAQ schema markup (`FAQPage` JSON-LD) from location data, GBP Q&A, and AI analysis. Output injected into the location's public page and AEO schema layer.

**Pre-sprint requirements:**
- Read `lib/schema-generator/` (Sprint 70/84) before designing FAQ generation — reuse the schema builder pattern
- FAQ content generated via AI SDK — use `lib/ai/providers.ts` pattern

**Provisional rules:**
- FAQ generation must be idempotent — running twice produces the same output for the same input data.
- Generated FAQ items stored in `locations.faq_data` (jsonb) — not hard-coded in schema templates.
- Maximum 10 FAQ items per location — truncate, do not error, if AI returns more.

---

## §60. Review Response Engine (PLACEHOLDER — Sprint 105, NOT YET EXECUTED)

> **Status:** Requires active Agency customers with live review data before meaningful testing.
> **Gate condition:** At least 3 Agency-tier customers actively using LocalVector with GBP reviews flowing in.

Sprint 105 will generate AI-drafted responses to Google Business Profile reviews, surfaced in a new "Reviews" dashboard section. Responses are drafts only — the business owner approves before publishing.

**Provisional rules:**
- Review responses are ALWAYS drafts — never auto-publish without explicit user approval.
- Response generation must respect the kill-switch pattern for cost control.
- Store draft responses in a new `review_responses` table — never mutate the source review data.

---

## §61. RAG Chatbot Widget (PLACEHOLDER — Sprint 106, NOT YET EXECUTED)

> **Status:** Requires 80%+ complete menu/product data for at least one location.
> **Gate condition:** Golden tenant has complete menu data in `magic_menus` table.

Sprint 106 will embed a RAG-powered chatbot widget on the public-facing location page (`/m/[slug]`). The chatbot answers customer questions using the location's menu, hours, amenities, and FAQ data as its knowledge base.

**Provisional rules:**
- The chatbot widget is a `'use client'` component with a floating button — lazy load with dynamic import, must not block LCP.
- RAG retrieval is server-side only — never expose raw menu data or embedding vectors to the client.
- Widget must degrade gracefully when AI is unavailable — show a static "Contact us" fallback.

---

## §62. Competitor Prompt Hijacking (PLACEHOLDER — Sprint 107, NOT YET EXECUTED)

> **Status:** Requires 4–8 weeks of SOV baseline data.
> **Gate condition:** `/api/cron/sov` has been running in production for at least 4 weeks (confirmed by `cron_run_log` entries).

Sprint 107 will analyze SOV data to identify competitor prompts where a business could outrank current AI citations, and generate targeted content briefs.

**Provisional rules:**
- Competitor analysis uses only data already stored in `sov_evaluations` — never triggers new live AI queries for this feature.
- Content briefs stored in a new `content_briefs` table — not in the SOV snapshot records.

---

## §63. Per-Engine AI Playbooks (PLACEHOLDER — Sprint 108, NOT YET EXECUTED)

> **Status:** Requires 8 weeks of multi-engine SOV data (Perplexity, GPT-4o, Gemini, Copilot).
> **Gate condition:** `/api/cron/sov` has been running for at least 8 weeks with all 4 engines active.

Sprint 108 will generate per-AI-engine optimization playbooks — specific guidance on how to optimize content for each engine's citation patterns.

**Provisional rules:**
- Playbooks are per-engine AND per-business-category — a hookah lounge playbook differs from a dentist playbook.
- Playbook generation must be re-runnable — new data updates playbooks, not creates duplicates.

---

## §64. Intent Discovery Engine (PLACEHOLDER — Sprint 109, NOT YET EXECUTED)

> **Status:** Requires 8 weeks of Perplexity query history data.
> **Gate condition:** Perplexity SOV engine has been running for at least 8 weeks with `raw_query` data stored.

Sprint 109 will mine Perplexity's query data to discover the actual natural-language questions users ask when finding local businesses — creating an "intent map" that drives content strategy.

**Provisional rules:**
- Intent discovery runs as a monthly batch job — not per request.
- Query clustering uses a deterministic algorithm (not pure LLM) to ensure reproducible intent groups.
- Intent maps stored in a new `intent_clusters` table — never overwrite raw query data.

---

## §65. Cron Registration Completeness (FIX-3)

Every cron route handler at `app/api/cron/*/route.ts` MUST be registered in `vercel.json`. Adding a cron handler without registering it produces no error — the handler simply never fires. `src/__tests__/unit/vercel-cron-config.test.ts` enforces this automatically.

**Checklist when adding a new cron:**
1. Create `app/api/cron/<name>/route.ts`
2. Add `CRON_SECRET` authorization guard (returns 401 without correct header)
3. Add `STOP_<NAME>_CRON` kill switch (returns early with `{ skipped: true }`)
4. Register in `vercel.json` with appropriate schedule
5. Document `CRON_SECRET` and `STOP_<NAME>_CRON` in `.env.local.example`
6. Add the path to `vercel-cron-config.test.ts`

---

## §66. Named vs Default Exports — Plan Gate Components (FIX-3)

All components in `components/plan-gate/` use **named exports**. Always import with `{ PlanGate }`, `{ PlanBlur }`, etc. Never use default imports for plan-gate components. `src/__tests__/unit/plan-gate-imports.test.ts` enforces this automatically.

---

## §67. Environment Variable Documentation (FIX-4)

Every environment variable referenced as `process.env.VAR_NAME` in `app/` or `lib/` MUST be documented in `.env.local.example` with a comment explaining its purpose and where to obtain the value.

**Enforcement:** `src/__tests__/unit/env-completeness.test.ts` scans all production source files and fails if any `process.env.X` reference is missing from `.env.local.example`.

**Rule:** Never add a new env var reference to production code without simultaneously adding it to `.env.local.example`.

---

## §68. Rate Limiting for AI Endpoints (FIX-4)

All endpoints that trigger AI model calls (OpenAI, Anthropic, Google Gemini) MUST implement Upstash rate limiting using the pattern from `app/api/chat/route.ts`.

**Pattern:**
- Authenticated endpoints: key = `{prefix}:{orgId}` (org-level, not user-level)
- Public endpoints: key = `{prefix}:{ip}` (IP-based, with fallback)
- Default limit: 20 requests/hour/org for AI chat; custom limits for batch operations
- Fail-open: if Redis is unavailable, allow the request through and log the error
- Response: 429 with `retry_after`, `error` body, and `X-RateLimit-*` headers

**Never initialize the Redis client inside a request handler** — always module-level.

---

## §69. E2E Test Coverage Requirements (FIX-5)

Every sprint that ships user-facing features must include E2E tests before the sprint is considered complete.

**Required coverage per sprint:**
- At minimum 1 happy-path test for each new user-visible flow
- At minimum 1 error/edge-case test per new API endpoint
- At minimum 1 regression test for any feature fixed in a prior sprint

**Selector rules (enforced):**
- All E2E selectors use `data-testid` attributes — no CSS class selectors, no text selectors as primary selectors
- `data-testid` attributes are added alongside component code — not retroactively

**Mocking rules:**
- All Supabase `/rest/v1/` calls are mocked in E2E via `page.route()` when not using real DB
- All external API calls (Stripe, GBP, Anthropic) are mocked in E2E via `page.route()`
- `page.waitForTimeout()` is forbidden — use event-driven waits only

**Sprint E2E gaps:** Sprints 98–101 have E2E coverage as of FIX-5. Sprints 102+ must ship with E2E on day one.

## §70. Sentry Error Instrumentation (Sprint A)

Every `catch` block in `app/` and `lib/` MUST capture the error variable and call `Sentry.captureException`.

**Pattern:**
```typescript
import * as Sentry from '@sentry/nextjs';

try {
  // ...
} catch (err) {
  Sentry.captureException(err, { tags: { file: 'filename.ts', sprint: 'A' } });
  // existing fallback logic
}
```

**Rules:**
- No bare `} catch {` blocks — always capture `(err)`
- `Sentry.captureException(err, { tags: { file, sprint } })` is the first line inside every catch
- Existing fallback logic (return null, continue, console.warn) is preserved after the Sentry call
- Regression guard: `grep -rn "} catch {" app/ lib/ --include="*.ts" --include="*.tsx"` must return 0 results

## §71. Plan Display Name Single Source of Truth (Sprint A)

All plan tier display names MUST use `lib/plan-display-names.ts`.

**Mapping:**
- `trial` → `The Audit`
- `starter` → `Starter`
- `growth` → `AI Shield`
- `agency` → `Brand Fortress`
- `null/undefined` → `Free`

**Rules:**
- Never inline plan name logic (e.g., `capitalize(plan)` or `plan + ' Plan'`)
- Import `getPlanDisplayName` from `@/lib/plan-display-names`
- The billing page, sidebar, and any future plan display must use this helper

## §72. Sample Data Mode (Sprint B)

New orgs with `realityScore === null` and `created_at` < 14 days ago see sample data on the dashboard.

**Architecture:**
- `lib/sample-data/sample-dashboard-data.ts` — SSOT for all sample data shapes
- `lib/sample-data/use-sample-mode.ts` — `isSampleMode(realityScore, orgCreatedAt)` pure function
- `components/ui/SampleDataBadge.tsx` — amber pill overlay on sample-data cards
- `components/ui/SampleModeBanner.tsx` — dismissible banner (sessionStorage)

**Rules:**
- Sample data shapes MUST exactly match real data types from `lib/data/dashboard.ts`
- `isSampleMode()` is called ONCE at the top of the server component — never re-derive in child components
- The `SampleDataBadge` uses `absolute` positioning — wrapping `<div>` MUST have `relative`
- Sample mode auto-disables when `realityScore !== null` (real scan completed) or org is > 14 days old
- `orgCreatedAt` is fetched alongside `orgPlan` in `fetchDashboardData()`

## §73. InfoTooltip System (Sprint B)

All dashboard metric cards must have `InfoTooltip` components explaining what the metric is, how it's calculated, and what action to take.

**Architecture:**
- `components/ui/InfoTooltip.tsx` — Radix Popover-based `?` icon, hover + click
- `lib/tooltip-content.tsx` — SSOT for all tooltip text (TooltipBody JSX)

**Rules:**
- Tooltip text lives in `lib/tooltip-content.tsx` — never inline in card components
- `data-testid="info-tooltip-trigger"` on the button, `data-testid="info-tooltip-content"` on popover
- InfoTooltip must not interfere with MetricCard `href` links — uses `e.stopPropagation()`
- Do NOT add InfoTooltip to chart axes, legend items, or Recharts data points

## §74. Settings Expansion (Sprint B)

Settings page has 7 sections: Account, Security, Organization, AI Monitoring, Notifications, Webhooks, Danger Zone.

**New DB columns (migration `20260304000001`):**
- `organizations.monitored_ai_models` — `text[]` default `{openai,perplexity,gemini,copilot}`
- `organizations.score_drop_threshold` — `integer` default `10`
- `organizations.webhook_url` — `text` (agency plan only, server-side enforced)

**Rules:**
- Settings save pattern: `useTransition()` + Server Actions (match existing pattern)
- Webhook URL is server-side gated to agency plan in `updateAdvancedPrefs()`
- Plan display name uses `getPlanDisplayName()` from `lib/plan-display-names.ts` (§71)
- Restart Tour clears `localStorage.removeItem('lv_tour_completed')` and reloads

## §75. Plan Feature Comparison Table (Sprint B)

Billing page includes a full feature comparison matrix below the tier cards.

**Architecture:**
- `lib/plan-feature-matrix.ts` — static `FeatureRow[]` derived from `lib/plan-enforcer.ts`
- `app/dashboard/billing/_components/PlanComparisonTable.tsx` — table component

**Rules:**
- Feature matrix MUST stay in sync with `lib/plan-enforcer.ts` gating functions
- Each `FeatureRow.value` is `boolean | string` — never `undefined` or `null`
- Current plan column is highlighted with `bg-electric-indigo/5` + "Your Plan" badge
- `data-testid="plan-comparison-table"` on the table wrapper

## §76. Honest Listings State — Platform Sync Types (Sprint C)

The integrations page MUST distinguish between platforms with real API sync and platforms that only support manual tracking.

**Architecture:**
- `lib/integrations/platform-config.ts` — SSOT for platform sync types
- Three sync types: `real_oauth` (google), `manual_url` (yelp, tripadvisor), `coming_soon` (apple, bing, facebook)
- `PlatformRow.tsx` renders 3 distinct UI states based on sync type

**Rules:**
- NEVER fake a sync operation for non-Google platforms (no `setTimeout` mock syncs)
- `syncPlatform()` returns error for non-google platforms — no silent no-op
- `toggleIntegration()` only allows google platform
- Coming Soon platforms show eta badge, grayed out, no inputs
- Manual URL platforms show "Manual" badge + "Manage on {name}" external link
- `data-testid` attributes: `platform-row-{platform}`, `coming-soon-badge`, `manual-badge`, `manage-external-link`, `listings-info-banner`
- Migration `20260305000001` clears false 'connected' statuses for non-google/non-wordpress platforms

## §77. Weekly Digest Scan-Data Guard (Sprint C)

`fetchDigestForOrg()` MUST return null for orgs with no scan data. Prevents sending empty digest emails to new users.

**Guard logic:**
- After primary location check, count `sov_evaluations` rows for the org
- If count === 0: return null (no scan data yet — SOV cron hasn't run)
- `sov_evaluations` is the most reliable indicator — created by SOV cron on first successful scan

**Rules:**
- Guard runs BEFORE parallel data queries (fail-fast, saves DB calls)
- Cron route logs skipped count via `Sentry.captureMessage()` at `info` level
- Test mock for `sov_evaluations` must handle two calls: first for count guard, second for SOV wins data

## §78. Stripe Per-Seat Cost Fetch (Sprint C)

`monthlyCostPerSeat` in seat management MUST be fetched from Stripe, not hardcoded as null.

**Architecture:**
- `lib/stripe/get-monthly-cost-per-seat.ts` — `getMonthlyCostPerSeat(stripePriceId)` returns dollars or null
- Price ID comes from `SEAT_PLANS[plan]?.stripePriceId` (env var `STRIPE_PRICE_ID_AGENCY_SEAT`)
- Lazy Stripe client (same pattern as `seat-manager.ts`)

**Rules:**
- Null input → null output (no Stripe call)
- Missing `STRIPE_SECRET_KEY` → null (graceful fallback, no crash)
- Annual prices converted to monthly equivalent (`Math.round((unit_amount / 12) / 100)`)
- Metered/variable pricing (no `unit_amount`) → null
- All errors captured via Sentry, function returns null (never throws)
- `SeatManagementCard` shows "Contact us for custom seat pricing" when null

## §79. Content Draft Origin Tag (Sprint C)

Occasion-triggered content drafts MUST display "Occasion Engine" badge with CalendarDays icon.

**Rules:**
- Badge label: "Occasion Engine" (not just "Occasion")
- Badge color: violet (`bg-violet-400/10 text-violet-400 ring-violet-400/20`)
- Icon: `CalendarDays` from lucide-react
- `data-testid="draft-origin-tag"` on occasion badges, `data-testid="trigger-badge"` on other trigger types
- No "View in Calendar" deep link (Calendar page doesn't support `?occasion=` params — deferred)

## §80. Sprint C Test Coverage (Sprint C)

**New unit tests (63 tests, 5 files):**
- `cron-logger.test.ts` — 16 tests (logCronStart, logCronComplete, logCronFailed)
- `sov-seed.test.ts` — 23 tests (seedSOVQueries, tier generation, dedup, occasion tags)
- `weekly-digest-guard.test.ts` — 8 tests (scan-data guard, early null returns)
- `get-monthly-cost-per-seat.test.ts` — 11 tests (Stripe mock, cents→dollars, annual→monthly)
- `content-draft-origin.test.ts` — 5 tests (badge label, color, testid)

**New E2E tests (26 tests, 2 files):**
- `24-listings-honest-state.spec.ts` — 8 tests (info banner, Manual/Coming Soon badges, no fake sync)
- `25-sprint-c-pages.spec.ts` — 18 tests (6 dashboard pages: source-intelligence, sentiment, agent-readiness, system-health, cluster-map, revenue-impact)

**Regression fix:** `weekly-digest-data.test.ts` updated — mock now tracks `sov_evaluations` calls with index (first=count guard, second=SOV wins data)

## §81. Admin Dashboard Auth Guard (Sprint D)

All `/admin/*` routes are protected by `ADMIN_EMAILS` env var in `app/admin/layout.tsx`.

**Rules:**
- `ADMIN_EMAILS` is a comma-separated list of emails, case-insensitive, whitespace-trimmed
- Non-authenticated users → redirect to `/login`
- Authenticated but non-admin users → redirect to `/dashboard`
- Empty or unset `ADMIN_EMAILS` → all users redirected (admin panel locked)
- Admin pages use `createServiceRoleClient()` to bypass RLS for cross-org queries
- Admin nav: Customers | API Usage | Cron Health | Revenue | ← Dashboard
- `/admin` root redirects to `/admin/customers`
- `ADMIN_EMAILS` must be documented in `.env.local.example` (enforced by `env-completeness.test.ts`)

## §82. Credit/Usage System (Sprint D)

API credit system gates LLM-calling server actions with per-org monthly limits.

**Rules:**
- Table: `api_credits` (one active row per org, unique on `org_id`)
- Plan limits: trial=25, starter=100, growth=500, agency=2000 (in `lib/credits/credit-limits.ts`)
- Auto-initialize: first `checkCredit()` creates the row using the org's current plan
- Auto-reset: when `reset_date` has passed, credits_used resets to 0 and reset_date advances to next month 1st
- **Fail-open:** DB errors in credit service allow the operation (don't block users). Errors logged to Sentry.
- **Consume-after-success:** Credits consumed AFTER successful LLM call, not before. If LLM fails, no credit consumed.
- Credit-gated actions (6): `simulateAIParsing`, `uploadMenuFile`, `uploadPosExport`, `runSovEvaluation`, `generateContentBrief`, `runCompetitorIntercept`
- **NOT credit-gated** (no LLM): `reauditPage`, `generateCorrection`, `addCompetitor`
- Return `{ error: 'credit_limit_reached' }` when credits exhausted
- Credits meter in TopBar: green (<80%), amber (80-99%), red (100%) progress bar
- Atomic increment via `increment_credits_used(p_org_id)` RPC function (SECURITY DEFINER)

## §83. Revenue Config Defaults (Sprint D)

Default revenue config values are restaurant-industry-appropriate.

**Rules:**
- `DEFAULT_REVENUE_CONFIG` in `lib/services/revenue-impact.service.ts`
- `avgCustomerValue`: 55 (not 45 — reflects hookah lounge + fusion food check average)
- `monthlyCovers`: 1800 (not 800 — 60 covers/night × 30 days for full-service restaurant)
- Fixture: `CHARCOAL_N_CHILL_REVENUE_CONFIG` in `src/__fixtures__/golden-tenant.ts` matches defaults

## §84. Positioning Banner (Sprint D)

One-time dismissible banner explaining LocalVector vs traditional SEO tools.

**Rules:**
- Component: `components/ui/PositioningBanner.tsx` (Client Component)
- localStorage key: `lv_positioning_banner_dismissed` (permanent dismiss)
- Shows when: org < 30 days old AND not in sample mode
- Never shows simultaneously with SampleModeBanner
- Dismiss button: `data-testid="positioning-banner-dismiss"`
- Banner: `data-testid="positioning-banner"`
- Links to `/dashboard/ai-responses` ("See what AI says about you")

## §85. Industry Configuration SSOT (Sprint E)

Multi-vertical support — LocalVector adapts UI, schema, and SOV seeds based on org industry.

**Rules:**
- SSOT: `lib/industries/industry-config.ts` — `INDUSTRY_CONFIG` record, `getIndustryConfig()` helper
- Active verticals: `restaurant` (default), `medical_dental`. Placeholders: `legal`, `real_estate`
- `getIndustryConfig(null)` → restaurant config (safe fallback for existing orgs)
- Column: `organizations.industry` (text, default `'restaurant'`). Migration: `20260307000001`
- Sidebar: Magic Menu item uses `industryConfig.magicMenuIcon` + `industryConfig.magicMenuLabel` dynamically
- `data-testid` on nav items uses `displayLabel` (not `item.label`) — so medical orgs get `nav-magic-services`
- Never inline industry checks — always use `getIndustryConfig()`

## §86. Medical/Dental Schema Types (Sprint E)

Schema.org types for medical/dental practices.

**Rules:**
- File: `lib/schema-generator/medical-types.ts` — `generateMedicalSchema()`, `buildHoursSpecification()`
- Returns `Dentist` @type when specialty contains 'dent', `Physician` otherwise
- Registered in `lib/schema-generator/index.ts` re-exports
- `inferSchemaOrgType()` in `local-business-schema.ts` now handles medical categories (dentist, physician, doctor, medical, clinic)
- Golden tenant: `ALPHARETTA_FAMILY_DENTAL` in `src/__fixtures__/golden-tenant.ts`

## §87. Medical/Dental SOV Seed Templates (Sprint E)

SOV seed generation extended with medical/dental query templates.

**Rules:**
- `seedSOVQueries()` accepts optional `industryId` parameter (backward-compatible — defaults to restaurant)
- Medical path: `medicalDiscoveryQueries()`, `medicalNearMeQueries()`, `medicalSpecificQueries()`
- `isMedicalCategory()` detects medical categories from location `categories` array
- Medical seeds include insurance, emergency, accepting-patients queries
- Restaurant path unchanged — `isHospitalityCategory()` + `occasionQueries()` only for hospitality

## §88. GuidedTour Expanded Steps (Sprint E)

Tour expanded from 5 to 8 steps.

**Rules:**
- `TOUR_STEPS` array (exported, testable) — 8 steps targeting sidebar nav `data-testid` attributes
- Steps 6-8: Share of Voice, Citations, Revenue Impact
- Step 3 now targets `nav-magic-menu` (was `nav-menu`, changed due to dynamic label)
- Tour library: custom (no react-joyride). Do not add dependencies.
- Restart Tour button in Settings (Sprint B) — already shipped, do NOT re-implement

## §89. FirstVisitTooltip (Sprint E)

One-time informational banner on first visit to jargon-heavy pages.

**Rules:**
- Component: `components/ui/FirstVisitTooltip.tsx` (Client Component)
- localStorage key: `lv_visited_pages` (JSON array of page keys, permanent)
- Exports: `FirstVisitTooltip`, `hasVisited()`, `markVisited()`
- Wired into 5 pages: entity-health, agent-readiness, cluster-map, ai-sentiment, bot-activity
- `data-testid`: `first-visit-tooltip-{pageKey}`, `first-visit-dismiss-{pageKey}`
- Shows exactly once per page per device — after dismiss, never shown again

## §90. AI Answer Preview (Sprint F, N2)

On-demand query preview that shows how ChatGPT, Perplexity, and Gemini respond to any question about the business.

**Rules:**
- Model keys: `preview-chatgpt` (gpt-4o-mini), `preview-perplexity` (sonar), `preview-gemini` (gemini-2.0-flash) in `lib/ai/providers.ts`
- Query functions: `lib/ai-preview/model-queries.ts` — `queryOpenAI()`, `queryPerplexity()`, `queryGemini()`. Returns `{ status, content }`. Uses `hasApiKey()` guard.
- API route: `app/api/ai-preview/route.ts` — POST, SSE streaming, auth via `getSafeAuthContext()`, credit-gated (1 credit per composite run)
- Widget: `app/dashboard/ai-responses/_components/AIAnswerPreviewWidget.tsx` — Client Component, 3 model cards
- Query validation: 3–200 characters
- `data-testid`: `preview-query-input`, `preview-run-button`, `preview-card-chatgpt`, `preview-card-perplexity`, `preview-card-gemini`

## §91. Correction Follow-Up Cron (Sprint F, N3)

Daily cron that re-checks hallucinations in 'verifying' status after 14 days to determine if they were actually fixed.

**Rules:**
- Cron route: `app/api/cron/correction-follow-up/route.ts` — daily at 10:00 UTC
- Kill switch: `STOP_CORRECTION_FOLLOWUP_CRON`
- Service: `lib/services/correction-verifier.service.ts` — `checkCorrectionStatus()`, `extractKeyPhrases()`
- Queries `ai_hallucinations` where `correction_status = 'verifying'`, `follow_up_checked_at IS NULL`, `verifying_since < 14 days ago`
- Status transitions: `verifying` → `fixed` (hallucination gone) or `recurring` (still present)
- New columns on `ai_hallucinations`: `correction_query`, `verifying_since`, `follow_up_checked_at`, `follow_up_result`
- Detection strategy: substring match on key phrases (phone numbers, times, addresses, dollar amounts)
- Max 50 alerts per cron run. On query failure → conservative (stillHallucinating=true)
- `verifyHallucinationFix()` in `hallucinations/actions.ts` now sets `verifying_since` + `correction_query`
- CorrectionPanel shows follow-up status banner (verifying/fixed/recurring)

## §92. Benchmark Comparison (Sprint F, N4)

Weekly cron that aggregates city+industry Reality Score benchmarks, displayed on dashboard.

**Rules:**
- Cron route: `app/api/cron/benchmarks/route.ts` — weekly Sunday at 08:00 UTC
- Kill switch: `STOP_BENCHMARK_CRON`
- RPC: `compute_benchmarks()` SQL function — aggregates from organizations + locations + visibility_scores
- Table: `benchmarks` (city, industry, org_count, avg_score, min_score, max_score, computed_at). UNIQUE(city, industry). RLS: authenticated SELECT.
- Data layer: `lib/data/benchmarks.ts` — `fetchBenchmark(supabase, orgId, locationId?)`
- Card: `app/dashboard/_components/BenchmarkComparisonCard.tsx` — Server Component
- Display threshold: 10 orgs minimum (`MIN_DISPLAY_THRESHOLD`)
- Two states: "Collecting" (progress bar) and "Ready" (score vs avg, percentile label, range bar)
- `data-testid`: `benchmark-comparison-card`, `benchmark-collecting-state`, `benchmark-ready-state`, `benchmark-no-score-state`
- Migration: `20260308000001_sprint_f_engagement.sql`

## §93. Issue Descriptions (Sprint G)

Plain-English translation layer that converts `HallucinationRow` records and technical findings into consequence-first sentences for business owners.

**Rules:**
- SSOT: `lib/issue-descriptions.ts`
- Exports: `IssueDescription`, `IssueSeverity`, `describeAlert()`, `describeTechnicalFinding()`, `getModelName()`, `mapSeverity()`
- Severity mapping: DB `critical`/`high` → UI `critical`; DB `medium` → `warning`; DB `low` → `info`
- Model name mapping via `MODEL_NAMES` record: `openai-gpt4o` → `ChatGPT`, `perplexity-sonar` → `Perplexity`, `google-gemini` → `Gemini`, `anthropic-claude` → `Claude`, `microsoft-copilot` → `Microsoft Copilot`
- `describeAlert()` switches on `alert.category` (DB values: `hours`, `address`, `phone`, `menu`, `status`, `amenity`) to generate headlines like "ChatGPT is telling customers the wrong hours"
- `describeTechnicalFinding()` handles `bot_blind_spot`, `content_thin`, `schema_missing` types
- Category badges: `AI search`, `Site health`, `Listings`, `Content`
- Fix CTAs: `Fix with AI` (credit-consuming), `How to fix →` (documentation), `View details →` (navigation)

## §94. Dashboard Stat Panels (Sprint G)

Four stat panels replacing the old QuickStats row of MetricCards on the main dashboard.

**Rules:**
- All panels in `app/dashboard/_components/panels/`
- `AIVisibilityPanel.tsx` — Score gauge (SVG circle r=40) + weekly delta + benchmark text. Props: `score`, `previousScore`, `benchmark`, `orgCity`. `data-testid="ai-visibility-panel"`, `"ai-visibility-score"`, `"ai-visibility-delta"`, `"ai-visibility-benchmark"`
- `WrongFactsPanel.tsx` — Big number, crimson when > 0, emerald when 0. Entire panel is `<Link href="/dashboard/hallucinations">`. Props: `alertCount`, `previousCount`. `data-testid="wrong-facts-panel"`, `"wrong-facts-count"`, `"wrong-facts-clear"`, `"wrong-facts-delta"`
- `AIBotAccessPanel.tsx` — Top 4 bots sorted by urgency (blind_spot → low → active). Status colors: active=emerald, low=amber, blind_spot=crimson. Links to `/dashboard/crawler-analytics`. Props: `bots: BotActivity[]`. `data-testid="ai-bot-access-panel"`, `"ai-bot-row"`, `"ai-bot-access-empty"`
- `LastScanPanel.tsx` — Relative time from `formatRelativeTime()` + next scan from `nextSundayLabel()`. Warning badge when > 14 days. Props: `lastScanAt: string | null`. `data-testid="last-scan-panel"`, `"last-scan-time"`, `"next-scan-time"`, `"last-scan-warning"`
- Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- Sample data: `SAMPLE_WRONG_FACTS_COUNT`, `SAMPLE_BOT_DATA` in `lib/sample-data/sample-dashboard-data.ts`

## §95. Top Issues Panel (Sprint G)

Prioritized plain-English issue list combining hallucination alerts and technical findings.

**Rules:**
- Component: `app/dashboard/_components/TopIssuesPanel.tsx`
- Props: `alerts: HallucinationRow[]`, `crawlerSummary: CrawlerSummary | null`, `sampleMode: boolean`
- Merges alerts (via `describeAlert()`) + technical findings (via `deriveTechnicalFindings()` + `describeTechnicalFinding()`)
- Sorted by severity: critical → warning → info. Max 5 rows displayed.
- Each row: severity dot indicator, headline, category badge, CTA button (Fix with AI / How to fix)
- `deriveTechnicalFindings()` extracts blind_spot bots from CrawlerSummary → up to 2 findings
- Sample mode: shows hardcoded `SAMPLE_ISSUES` when `sampleMode=true`, ignores `alerts` prop
- Empty state: green checkmark + "No issues found" text
- `data-testid`: `"top-issues-panel"`, `"top-issue-row-{index}"`, `"top-issue-fix-{index}"`, `"top-issue-how-{index}"`, `"top-issues-view-all"`, `"top-issues-empty"`

## §96. Dashboard Layout Changes (Sprint G)

Dashboard redesigned from data dump to action surface. Charts moved to detail pages.

**Rules:**
- **Removed from dashboard:** `SOVTrendChart` (already on `/dashboard/share-of-voice`), `HallucinationsByModel` (moved to `/dashboard/hallucinations`), `CompetitorComparison`, QuickStats row (4 MetricCards), `AIHealthScoreCard`, `RealityScoreCard`
- **Added to dashboard:** 4 stat panels (§94) + TopIssuesPanel (§95)
- **Layout order:** Header → Banners → OccasionAlertFeed → 4 Stat Panels grid → TopIssuesPanel → RevenueLeakCard → AlertFeed (only if hasOpenAlerts) → BenchmarkComparisonCard → BotActivityCard → ProofTimelineCard → EntityHealthCard → GBPImportCard → ContentFreshnessCard → CronHealthCard → Revenue charts
- **HallucinationsByModel on hallucinations page:** Added to `app/dashboard/hallucinations/page.tsx` before the flagged hallucinations section. Uses `aggregateByModel()` from `lib/utils/dashboard-aggregators.ts`. Renders only when `hallucinations.length > 0`.
- Header subtitle changed from "AI lies" to "wrong facts"
- No new DB tables, crons, or API routes. Pure front-end work.

## §97. Hallucination Triage Queue (Sprint H)

Hallucinations page (`/dashboard/hallucinations`) replaced the flat Flagged Hallucinations table with a three-column Kanban triage view.

**Rules:**
- **Swimlane partitioning:** "Fix Now" = `correction_status === 'open'` (sorted by severity: critical → high → medium → low). "In Progress" = `correction_status === 'verifying'`. "Resolved" = `fixed | dismissed | recurring` (capped at 10).
- **AlertCard always uses `describeAlert()` from `lib/issue-descriptions.ts`.** No hardcoded alert copy in AlertCard. AI_RULES §93 still applies.
- **DismissAlertButton** reuses existing `updateHallucinationStatus()` server action from `app/dashboard/actions.ts`. No new server actions created.
- **Status→action mapping:** open → "Fix with AI" + "Dismiss". verifying → follow-up status banner. fixed → green "Fixed" text. recurring → "Try again →" link.
- **HallucinationsPageHeader** shows verdict: 0 open → green "No wrong facts". >0 → red count + "Fix these..."
- No new DB tables, migrations, crons, or API routes. Pure front-end.

## §98. SOV Verdict Panel (Sprint H)

Share of Voice page (`/dashboard/share-of-voice`) now leads with a verdict panel before the SOV Score Ring and trend chart.

**Rules:**
- **SOVVerdictPanel** renders above all existing content. Shows big SOV % + week-over-week delta + top competitor mention count.
- **Competitor aggregation:** Counts `mentioned_competitors` across all `sov_evaluations`. Most-mentioned competitor shown with query count context.
- **No competitor SOV %** — the DB has mention counts, not per-competitor SOV. Panel shows mention frequency, not percentage gap.
- **No data state:** data-testid="sov-verdict-no-data" when `shareOfVoice` is null (pre-first scan).
- No new DB tables, migrations, crons, or API routes. Pure front-end.

## §99. Citation Summary Panel (Sprint H)

Citations page (`/dashboard/citations`) now leads with a summary panel inside the existing PlanGate.

**Rules:**
- **CitationsSummaryPanel** shows total platforms, covered count (listed), gap count (not listed), gap score.
- **Health derivation based on listing coverage:** "Listed" = business has a listing on that platform. "Not Listed" = platform AI cites but business has no listing.
- **No `has_wrong_info` / `is_claimed` concept** — the `citation_source_intelligence` table is market-level data, not per-org source accuracy. Health is purely listing coverage.
- **Verdict:** 0 gaps → green "citation coverage is strong". >0 gaps → red count + advice.
- No new DB tables, migrations, crons, or API routes. Pure front-end.

## §100. Compete Win/Loss Verdict (Sprint H)

Competitor Intercept page (`/dashboard/compete`) now shows a win/loss verdict panel between competitor management and intercept results.

**Rules:**
- **CompeteVerdictPanel** shows win count (green) and loss count (amber) derived from `competitor_intercepts.winner` matching `businessName`.
- **Win = intercept where `winner === businessName`**. Loss = intercept where `winner !== null && winner !== businessName`.
- **Renders nothing** when `totalIntercepts === 0` — existing empty state handles this case.
- **All-wins state:** "leading across the board" message in green.
- No new DB tables, migrations, crons, or API routes. Pure front-end.

## §101. Revenue Industry Defaults (Sprint I)

Revenue Impact page uses industry-smart defaults so an estimate is visible on first load. `getIndustryRevenueDefaults(industryId)` maps org industry to `{ avgCustomerValue, monthlyCovers }`.

**Rules:**
- **SSOT:** `lib/revenue-impact/industry-revenue-defaults.ts`. Matches `RevenueConfig` from `revenue-impact.service.ts`.
- **Fallback chain:** location-specific config → industry defaults → global `DEFAULT_REVENUE_CONFIG`.
- **Smart-defaults disclosure:** When using industry defaults, show blue banner: "Estimated using typical [industry] figures."
- **`RevenueEstimatePanel`** renders above the config form with estimate, interpretation, and fix-alerts CTA.
- Never present industry defaults as verified data for a specific business.

## §102. Sentiment Interpretation Panel (Sprint I)

AI Sentiment page leads with `SentimentInterpretationPanel` showing plain-English verdicts per engine.

**Rules:**
- **Score thresholds:** > 0.3 = positive, -0.3 to 0.3 = mixed, < -0.3 = negative (problem).
- **Engines sorted worst-first** (ascending by `averageScore`).
- **Worst-engine callout:** Amber banner shown only when worst engine is below -0.3, with CTA to fix alerts.
- **"Needs attention" badge** on engines with score < -0.3.
- Panel renders nothing when `evaluationCount === 0` or `byEngine` is empty.
- Reuses existing `SentimentSummary` type — no new data fetches.

## §103. Source Health Signals (Sprint I)

Source Intelligence page leads with `SourceHealthSummaryPanel` showing source health grid and verdicts.

**Rules:**
- **Health derivation:** `deriveSourceHealth(category, isCompetitorAlert)` — first_party (green), competitor (red), review_site (blue), directory (amber), other (gray).
- **No accuracy data in DB** — health is derived from source category and `isCompetitorAlert` flag.
- **First-party rate thresholds:** >= 20% green, 10-20% amber, < 10% red.
- **`SourceHealthBadge`** added to each row in the top sources table.
- Plan gated: Agency only (existing gate preserved).

## §104. Bot Fix Instructions (Sprint I)

Bot Activity page adds expandable fix instructions to blind-spot and low-activity bot rows.

**Rules:**
- **SSOT:** `lib/bot-activity/bot-knowledge.ts`. All 10 tracked AI bots must have entries.
- **`BotFixInstructions`** is a Client Component (needs `useState` for expand/collapse).
- Shows: bot identity, business impact, exact `robots.txt` snippet with copy button, official docs link.
- **Never claim** a robots.txt change will "definitely" fix a block — always say "should allow".
- Shows on blind_spot rows (always) and low-activity rows (in BotRow).

---
> **End of System Instructions**