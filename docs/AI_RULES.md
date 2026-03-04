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

## §57. Apple Business Connect Sync (PLACEHOLDER — NOT YET EXECUTED)

> **Status:** Awaiting Apple Business Connect API approval. Do not implement until API access is confirmed.
> **Gate condition:** Apple Business Connect API credentials approved and accessible.
> **Note:** Originally planned as Sprint 102, but that sprint number was used for Database Types Sync + Sidebar Nav Completeness. Apple BC sync will be assigned a future sprint number when API approval is received.

A future sprint will sync business profile data from Apple Business Connect (ABC) into LocalVector's `locations` table via a new `abc_connections` table and `/api/cron/abc-sync` route.

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

## §59. Content Grader Completion — AI FAQ + On-Demand Audit (Sprint 104, COMPLETED 2026-03-01)

> **Status:** Complete. Doc 17 audit gap #7 closed (0% → 100%).

Sprint 104 closed 3 Content Grader gaps: AI-powered FAQ generator, on-demand URL submission, multi-page seed data.

**Rules:**
- **AI FAQ generator** lives in `lib/page-audit/faq-generator.ts` — separate from the static FAQ generator in `lib/schema-generator/faq-schema.ts`. Do not merge them.
- **Model key** `'faq-generation'` in `lib/ai/providers.ts` (GPT-4o-mini). Always use `getModel('faq-generation')` — never hardcode the model.
- **Static fallback:** When `hasApiKey('openai')` is false or AI call fails, `generateAiFaqSet()` returns 5 generic Q&A pairs from `LocationContext` data. Never throw from the generator.
- **AI FAQ is user-triggered only** (§5). Called via `generateSchemaFixes()` in `schema-actions.ts` when `faqSchemaPresent === false`. Never on page load.
- **Schema deduplication:** `schema-actions.ts` deduplicates by `schemaType` — AI FAQ (prepended) wins over static FAQ. Both return `schemaType: 'FAQPage'`.
- **`addPageAudit(rawUrl)`** in `actions.ts` is the on-demand audit entry point. Plan-gated (Growth/Agency via `canRunPageAudit`). Rate-limited (5 min per org+URL, shared Map with `reauditPage`).
- **URL normalization:** Always prepend `https://` if missing, strip trailing slashes. Normalize before rate-limit check and DB upsert (`onConflict: 'org_id,page_url'`).
- **Page type inference:** `inferPageType()` replicated locally in `actions.ts` — do not import from the cron route. Matches `/menu`, `/about`, `/faq|/questions`, `/event`, root → `homepage`, else `other`.
- **`AddPageAuditForm`** is a client component — uses `useTransition`, no `<form>` tags, `data-testid` on wrapper/input/button.
- **Seed data:** 3 page audit rows for golden tenant: homepage (66), about (58, faq missing), faq (89, faq present). All use `ON CONFLICT DO UPDATE`.

---

## §60. NAP Sync Engine (Sprint 105 — COMPLETED)

> **Status:** COMPLETED. Sprint 105 was repurposed from Review Response Engine to NAP Sync Engine.
> Original Review Response Engine deferred to a future sprint (requires active Agency customers with live review data).

Sprint 105 built the cross-platform listing accuracy layer. See §124–§126 for full architecture, DB tables, and health score algorithm rules.

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

## §105. Entity Health Jargon Ban (Sprint J)

Entity Health page title: "Does AI Know Your Business?" — never "Entity Knowledge Graph Health".

**Rules:**
- **Banned terms in UI text:** "knowledge graph", "ontological", "entity disambiguation", "semantic", "embedding", "NLP", "NER", "entity resolution", "canonical form", "entity" (when referring to the business).
- **Replacement vocabulary:** "knowledge graph" → "what AI models know about you"; "entity" → "your business"; "entity health" → "how accurately AI knows your business".
- **Platform descriptions SSOT:** `lib/entity-health/platform-descriptions.ts`. Maps `EntityPlatform` keys to `PlatformDescription` with customer-consequence text for each status (confirmed/missing/incomplete/unchecked).
- **Verdict panel:** `EntityHealthVerdictPanel` shows confirmed/total count + plain-English verdict. Three tiers: strong (green), at_risk (amber), critical (red), unknown (gray).
- **Failing-first layout:** Needs-attention platforms above confirmed platforms (not mixed).
- **FirstVisitTooltip preserved** — Sprint E tooltip is NOT modified by Sprint J.

## §106. Agent Readiness Jargon Ban (Sprint J)

Agent Readiness page title: "Can AI Take Action for Your Customers?" — never "AI Agent Readiness".

**Rules:**
- **Banned terms in UI text:** "JSON-LD", "schema.org", "structured data", "action schema", "reservation schema", "microdata", "RDF", "ontology", "agentic", "OpeningHoursSpecification", "ReserveAction", "OrderAction".
- **Replacement vocabulary:** "JSON-LD valid" → "AI can read your business information"; "structured data" → "your business information is formatted for AI"; "ReserveAction schema" → "AI can book a reservation"; "OrderAction schema" → "AI can place an order".
- **Scenario descriptions SSOT:** `lib/agent-readiness/scenario-descriptions.ts`. Maps 6 `CapabilityId` values to `ScenarioDescription` with customer-interaction question + consequence text.
- **Verdict panel:** `AgentReadinessVerdictPanel` shows score ring + active/total count + plain-English verdict.
- **Scenario cards:** `AgentReadinessScenarioCard` shows customer question (e.g., "Can AI answer 'Are you open right now?'") instead of technical name ("Structured Hours").
- **Top Priority card relabeled** "Biggest Opportunity" (was "Top Priority: [technical name]").
- **Gaps-first layout:** Failing capabilities above ready capabilities.
- Note: `fixGuide` text in the service layer still uses technical terms — Sprint J only rewrites user-facing labels and consequence text.

## §107. Cluster Map Jargon Ban (Sprint J)

Cluster Map page title: "Where Does AI Place You?" — never "AI Visibility Cluster Map".

**Rules:**
- **Banned terms in UI text:** "semantic", "embedding", "cluster centrality", "vector distance", "cosine similarity", "latent space", "brand authority", "fact accuracy" (as axis labels).
- **Replacement vocabulary:** "brand authority" → "how often AI mentions you" / "AI mention rate"; "fact accuracy" → "information accuracy"; "hallucination fog" → "wrong information zones"; "cluster" → "group" or "category".
- **Interpretation panel:** `ClusterInterpretationPanel` above chart. Shows position verdict, 3 stat explainers (mention rate, accuracy, competitors), and top competitor callout with relative comparison.
- **Chart axis labels:** X = "How Often AI Mentions You", Y = "Information Accuracy".
- **Quadrant labels:** "Often Mentioned / Accurate Info", "Rarely Mentioned / Accurate Info", "Invisible", "Wrong Info Spreading".
- **Legend:** "Wrong Information Zones" (was "Hallucination Fog"). "AI visibility share" (was "Share of Voice").
- **Hallucination zones heading:** "N Incorrect Fact(s) AI Is Sharing" (was "N Hallucination Zone(s) Detected").
- **Stat cards:** "Wrong Facts" (was "Hallucinations"), "AI Queries" (was "Queries").
- No new DB tables, migrations, crons, or API routes. Pure front-end.

## §108. Sentry Sweep Completeness (Sprint K)

Zero bare `} catch {` blocks allowed in `app/` and `lib/` directories (excluding test files). Every catch must capture the error parameter and call `Sentry.captureException(err)`.

**Rules:**
- Import pattern: `import * as Sentry from '@sentry/nextjs'`.
- Tags: `{ file: 'RelativePath.tsx', component: 'FunctionName', sprint: 'K' }`.
- Regression guard: `src/__tests__/unit/sentry-sweep-verification.test.ts` (2 grep-based tests).
- Sprint A wired 68 catches. Sprint K fixed the final 4 (BotFixInstructions, AIAnswerPreviewWidget ×2, ai-preview route).

## §109. Listings Honesty Verification (Sprint K)

The `PLATFORM_SYNC_CONFIG` in `lib/integrations/platform-config.ts` is the SSOT for platform sync types. Only `google` has `real_oauth`. Non-GBP platforms must never show fake "Synced" or "Connected" states.

**Rules:**
- `manual_url` platforms (yelp, tripadvisor): show "Manual" badge, URL input, claim link. No sync button.
- `coming_soon` platforms (apple, bing, facebook): show "Coming Soon" badge. No controls.
- `real_oauth` platforms (google only): full toggle, sync button, URL input.
- Regression guard: `src/__tests__/unit/integrations-listings.test.ts` (20 tests).

## §110. Listings Verification Pattern (Sprint L)

Verification routes compare platform API data against local org data. Yelp is the first platform verified; Bing deferred to Sprint M.

**Rules:**
- Auth: `getSafeAuthContext()` — org_id derived server-side (never client).
- Table: `location_integrations` — per-location per-platform via `(location_id, platform)` unique key.
- Columns: `verification_result` JSONB (cached full result), `verified_at` (rate limit), `has_discrepancy` (boolean flag).
- Rate limit: 24 hours per `(location_id, platform)` — check `verified_at` before API call.
- Pure utility: `detectDiscrepancies()` in `lib/integrations/detect-discrepancies.ts` — no I/O.
- Name comparison: fuzzy (alphanumeric-only, substring inclusion). Phone: last 10 digits. Address: first 2 words.
- Env var: `YELP_API_KEY` must be in `.env.local.example`. Route returns 503 when missing.
- Regression guard: `src/__tests__/unit/listing-verification.test.tsx` (16 tests).

## §111. Sample Data Coverage Audit (Sprint L)

Sprint B's sample data infrastructure is complete and is the SSOT. No duplicate components.

**Rules:**
- The 4 stat panels (AIVisibilityPanel, WrongFactsPanel, AIBotAccessPanel, LastScanPanel) + TopIssuesPanel receive sample data via `lib/sample-data/sample-dashboard-data.ts`.
- Secondary cards (BotActivity, ProofTimeline, EntityHealth, CronHealth, ContentFreshness) show built-in empty states — NOT sample data. This is intentional.
- Plan-gated cards (Revenue charts) are invisible to trial/starter users — NOT sample-populated.
- Component names: `SampleModeBanner` (not `SampleDataBanner`), `SampleDataBadge` (not `SampleDataOverlay`). Do not create duplicates.
- Regression guard: `src/__tests__/unit/sample-data-mode.test.ts` (18 tests) + `src/__tests__/unit/sample-data-components.test.tsx` (6 component tests, jsdom).

## §112. Plan Feature Matrix Derivation (Sprint M)

The `PLAN_FEATURE_MATRIX` in `lib/plan-feature-matrix.ts` is derived from `plan-enforcer.ts` gating functions, never hardcoded. If `plan-enforcer.ts` changes, the billing comparison table updates automatically.

**Rules:**
- Every feature row calls a gating function from `plan-enforcer.ts` for each plan tier.
- Universal features (Reality Score, monitoring) use inline `() => true`.
- Numeric limits (competitors, locations, seats) use `numericGate()` — returns `false` for 0, string for > 0.
- `gate()` helper wraps all gating calls in try/catch — returns `false` on error (never crashes billing page).
- `buildFeatureMatrix()` exported for testing; `PLAN_FEATURE_MATRIX` is the backward-compatible static export.
- Regression guard: `src/__tests__/unit/plan-feature-matrix.test.ts` (19 tests).

## §113. Bing Verification Pattern (Sprint M)

Bing Places verification follows the Sprint L Yelp pattern with platform-specific differences.

**Rules:**
- Auth: query parameter (`key=BING_MAPS_KEY`), not Bearer header.
- Search: name + city query (Bing does not support phone-based lookup).
- Response: `resourceSets[0].resources[]` — use optional chaining throughout.
- Match: `findBestBingMatch()` — fuzzy name match. Falls back to `resources[0]` when no name match found (logs Sentry breadcrumb).
- Discrepancies: reuse `detectDiscrepancies()` from `lib/integrations/detect-discrepancies.ts`.
- Table: `location_integrations` — same as Yelp, `platform: 'bing'`, upsert on `(location_id, platform)`.
- Platform config: `syncType: 'manual_url'`, `verifiable: true`, `claimUrl: 'https://www.bingplaces.com'`.
- Platform label: `PLATFORM_LABELS` map in `integrations/page.tsx` — `bing: 'Bing Places'`.
- Env var: `BING_MAPS_KEY` in `.env.local.example`. Route returns 503 when missing.
- Regression guard: `src/__tests__/unit/bing-verification.test.ts` (14 tests).

## §114. Positioning Banner Copy (Sprint M)

The `PositioningBanner` at `components/ui/PositioningBanner.tsx` explains AI visibility vs. traditional SEO measurement. Updated in Sprint M from generic branding to specific factual comparison.

**Rules:**
- Copy must be factual — no competitive tool names (no "unlike Yext"), no superlatives, no fear tactics.
- Must reference "Reality Score" and "AI models" explicitly.
- Must explain the distinction: search rankings vs. what AI models say about the business.
- localStorage key: `lv_positioning_banner_dismissed` (permanent dismiss).
- Shown for orgs < 30 days old AND not in sample mode (`isNewOrg && !sampleMode`).
- One banner at a time: suppressed when `SampleModeBanner` is active.
- Regression guard: `src/__tests__/unit/positioning-banner.test.tsx` (13 tests).

## §115. Settings Expansion — Claude Model & Scan Day (Sprint N)

Settings form supports 5 AI models (added Claude/Anthropic). Scan day preference allows users to pick which day the weekly SOV cron runs.

**Rules:**
- `AI_MODELS` in `SettingsForm.tsx` must have 5 entries: openai, perplexity, gemini, copilot, claude.
- `VALID_AI_MODELS` in `actions.ts` must match the 5 model IDs.
- `scan_day_of_week` column: integer 0–6, CHECK constraint, default 0 (Sunday).
- Competitor shortcut section: shows count + link to `/dashboard/compete`.
- Migration: `20260310000001_sprint_n_settings.sql`.
- Regression guard: `src/__tests__/unit/sprint-n-settings.test.ts` (15 tests).

## §116. Notification Toggles — Score Drop & New Competitor (Sprint N)

Two new boolean columns on organizations: `notify_score_drop_alert` (default true), `notify_new_competitor` (default false).

**Rules:**
- Both must be in `NotificationPrefsSchema` in `actions.ts`.
- Both must have Toggle components in SettingsForm Section 5 with test IDs.
- `notify_score_drop_alert` works alongside `score_drop_threshold` (Sprint B).

## §117. AI Preview Token Streaming (Sprint N)

Upgraded AI Answer Preview from batch (one event per model) to true token-by-token streaming using Vercel AI SDK's `streamText()`.

**Rules:**
- `streamOpenAI()`, `streamPerplexity()`, `streamGemini()` in `lib/ai-preview/model-queries.ts` return `AsyncGenerator<StreamChunk>`.
- Original batch functions (`queryOpenAI` etc.) preserved — used by correction verifier.
- SSE event format: `{ model, chunk, done: false }` per token, `{ model, chunk: '', done: true }` on finish.
- Widget accumulates chunks incrementally; shows blinking cursor during streaming.
- Widget supports abort via `AbortController` (Stop button).
- Regression guard: `src/__tests__/unit/sprint-n-preview-streaming.test.ts` (6 tests).

## §118. Correction Follow-Up Email Notification (Sprint N)

Added `sendCorrectionFollowUpAlert()` to `lib/email.ts`. Wired into correction follow-up cron.

**Rules:**
- Payload: `{ to, businessName, claimText, result: 'fixed' | 'recurring', dashboardUrl }`.
- "fixed" → green success email. "recurring" → amber warning email.
- Only sent when org has `notify_hallucination_alerts` enabled.
- Wrapped in `.catch()` in cron — email failure never blocks status update.
- Cron summary includes `emailsSent` count.
- No-ops when `RESEND_API_KEY` is absent.
- Regression guard: `src/__tests__/unit/sprint-n-correction-email.test.ts` (3 tests).

## §119. Revenue Config Defaults Alignment (Sprint O)

OLD system (`revenue-leak.service.ts`) `DEFAULT_CONFIG.avg_ticket` updated from $45 to $55 to match NEW system and industry defaults.

**Rules:**
- Both revenue systems must use aligned defaults: OLD `avg_ticket` = NEW `avgCustomerValue` = $55.
- `RevenueConfigForm` inputs must have `placeholder` attributes showing example values.
- Help text: "Default values are based on typical restaurant revenue patterns."
- Industry defaults SSOT: `lib/revenue-impact/industry-revenue-defaults.ts` (Sprint I).
- Regression guard: `src/__tests__/unit/sprint-o-revenue-defaults.test.ts` (11 tests).

## §120. Content Flow Clarity — DraftSourceTag (Sprint O)

Calendar-originated drafts show "Generated from calendar · {occasion name}" via `DraftSourceTag`.

**Rules:**
- `content_drafts.trigger_type='occasion'` + `trigger_id` link drafts to `local_occasions`.
- No migration needed — `trigger_type` and `trigger_id` columns exist from original schema.
- `DraftSourceTag` renders only when `trigger_type === 'occasion'` AND occasion name is resolved.
- Occasion name lookup: `fetchOccasionNames()` in content-drafts page queries `local_occasions`.
- Manual drafts (`trigger_type='manual'`) never show the source tag.
- Calendar breadcrumb: shown on content-drafts when `?from=calendar` query param present.
- Breadcrumb occasion name: decoded via `decodeURIComponent()`, limited to 100 chars.
- Regression guard: `src/__tests__/unit/sprint-o-content-flow.test.tsx` (8 tests).

## §121. Benchmark Staleness Check (Sprint O)

`fetchBenchmark()` now rejects benchmarks older than 14 days.

**Rules:**
- `MAX_BENCHMARK_AGE_DAYS = 14` in `lib/data/benchmarks.ts`.
- If `computed_at` > 14 days ago, `fetchBenchmark()` returns `null` (card doesn't render).
- `BenchmarkComparisonCard` hidden in sample data mode (`!sampleMode` guard in dashboard page).
- Benchmark feature was fully built in Sprint F (N4). Sprint O adds staleness + sample mode guard.
- Regression guard: `src/__tests__/unit/sprint-o-benchmark.test.ts` (9 tests).

## §122. Seed SQL Validation Rules (FIX-7)

All hand-crafted UUIDs in `supabase/seed.sql` must be valid hex (0-9, a-f only). `ON CONFLICT` is only valid on `INSERT`, never on `UPDATE`.

**Rules:**
- **UUID hex enforcement (§7 strengthened):** Before adding seed rows, verify every UUID character is hex. Prefixes `g`–`z` are invalid and crash `npx supabase db reset`.
- **No ON CONFLICT on UPDATE:** `ON CONFLICT (col) DO NOTHING` is PostgreSQL INSERT-only syntax. UPDATE statements use `WHERE` clauses for idempotency.
- **Supabase error serialization:** Supabase `PostgrestError` objects log as `{}` with `console.error(error)`. Always use `JSON.stringify(error, null, 2)` for diagnostic logging.
- **Regression guard:** Run `npx supabase db reset` after any seed.sql change — it must complete without errors.

## §123. GBP OAuth Callback Logging (FIX-8)

The GBP OAuth callback must log both success and failure responses from the My Business Account Management API.

**Rules:**
- **Always log non-200 responses:** When `accountsRes.ok` is false, log `accountsRes.status` and full error body text. Silent failures make debugging impossible.
- **Log successful responses:** Log `accountsData` JSON on success for debugging account discovery issues.
- **GBP API quota:** Google My Business APIs default to 0 quota. Must apply for Basic API Access via https://support.google.com/business/contact/api_default before any calls succeed. 429 with `quota_limit_value: "0"` = not yet allowlisted.
- **Google Cloud project:** OAuth client + GBP APIs must be in the same project. Test users must be added to OAuth consent screen Audience for Testing mode.

## §124. NAP Sync Engine — Architecture (Sprint 105)

The NAP Sync Engine is LocalVector's cross-platform listing accuracy layer. It fetches live NAP (Name, Address, Phone) data from Google Business Profile, Yelp, Apple Maps, and Bing, compares it against the Ground Truth in the `locations` table, detects discrepancies, and pushes auto-corrections to GBP.

**Rules:**
- **Adapter pattern:** Each platform has a dedicated adapter in `lib/nap-sync/adapters/`. All adapters extend `NAPAdapter` base class and implement `fetchNAP()`. Adapters must NEVER throw — always return `AdapterResult` with status `'unconfigured'` or `'api_error'`.
- **Pure functions:** `detectDiscrepancies()`, `calculateNAPHealthScore()`, and `buildGBPPatchBody()` are pure functions with zero I/O. Test them without mocks.
- **Auto-correction scope:** Only GBP supports write API. Only `title`, `phoneNumbers`, `storefrontAddress`, `websiteUri` are auto-patchable. NEVER auto-patch `regularHours` or `openInfo.status` — flag for manual review.
- **Plan gate:** NAP Sync is Growth+ only. Use `canRunNAPSync()` from `lib/plan-enforcer.ts`.
- **Cron:** Weekly Monday 3 AM UTC. Kill switch: `STOP_NAP_SYNC_CRON`. Auth: `CRON_SECRET` Bearer header.

## §125. NAP Sync Database Tables (Sprint 105)

Three new tables and two new columns support the NAP Sync Engine.

**Tables:**
- `listing_platform_ids` — Maps locations to their platform-specific IDs (GBP location name, Yelp business ID, etc). UNIQUE on `(location_id, platform)`.
- `listing_snapshots` — Raw NAP data captured from each platform per sync run. Historical record.
- `nap_discrepancies` — Structured discrepancy records with severity, auto_correctable flag, and fix instructions.

**New columns on `locations`:**
- `nap_health_score` integer (0–100, NULL = never checked)
- `nap_last_checked_at` timestamptz

**RLS:** All three tables use org-scoped RLS via `memberships` join. Service role has full access for cron context.

## §126. NAP Health Score Algorithm (Sprint 105)

Base score: 100. Deductions (cumulative, floor 0):
- Critical field (phone/address): -25 per field
- High field (name/operational_status): -15 per field
- Medium field (hours): -8 per field
- Low field (website): -3 per field
- Unconfigured platform: -5
- API error platform: -2

Grade: A (90+), B (75-89), C (60-74), D (40-59), F (0-39).

## §127. Schema Expansion Engine — Architecture (Sprint 106)

The Schema Expansion Engine crawls a client's website, classifies pages by type, generates JSON-LD for 7 page types (homepage, about, FAQ, event, blog_post, service, other), hosts embeddable snippets, and pings IndexNow after every publish.

**Rules:**
- **Generator pattern:** Each page type has a dedicated generator in `lib/schema-expansion/generators/`. All extend `SchemaGenerator` abstract base class and implement `generate()`. Generators must NEVER throw — always return `GeneratedSchema` with validation errors in `missing_fields`.
- **Menu skip:** Generator registry returns null for `'menu'` page type. Magic Engine handles menus. Never generate schema for menu pages.
- **Human-in-the-loop:** AI-generated FAQs (LLM fallback) get `pending_review` status with `confidence: 0.7`. Only a human approve action publishes them. Auto-publish only for directly extracted content.
- **Content hashing:** SHA-256 hash of `json_ld` stored in `content_hash` column. Used for drift detection by the monthly cron.
- **IndexNow:** `lib/indexnow.ts` pings IndexNow after every publish. Fire-and-forget — never blocks the response. Returns false if `INDEXNOW_API_KEY` not set.
- **Plan gate:** Schema Expansion is Growth+ only. Use `canRunSchemaExpansion()` from `lib/plan-enforcer.ts`.
- **Cron:** Monthly 1st-of-month 4 AM UTC. Kill switch: `STOP_SCHEMA_DRIFT_CRON`. Auth: `CRON_SECRET` Bearer header.
- **Regression guard:** `src/__tests__/unit/website-crawler.test.ts` (35 tests), `src/__tests__/unit/schema-generators.test.ts` (47 tests), `src/__tests__/unit/schema-expansion-service.test.ts` (20 tests).

## §128. Schema Expansion Database Table (Sprint 106)

One new table and three new columns support the Schema Expansion Engine.

**Table: `page_schemas`**
- PK: `id` uuid. FK: `location_id` → locations(id) CASCADE, `org_id` → organizations(id) CASCADE.
- `page_url` text NOT NULL, `page_type` text CHECK (homepage/about/faq/event/blog_post/service/other).
- `schema_types` text[], `json_ld` jsonb, `embed_snippet` text, `public_url` text, `content_hash` text.
- `status` text CHECK (draft/pending_review/published/failed/stale). `human_approved` boolean.
- `confidence` numeric(3,2) CHECK 0-1. `missing_fields` text[], `validation_errors` text[].
- UNIQUE constraint on `(location_id, page_url)` — upsert pattern.

**New columns on `locations`:**
- `schema_health_score` integer (0–100, NULL = never checked)
- `schema_last_run_at` timestamptz
- `website_slug` text UNIQUE (used for public schema URLs)

**RLS:** Org members SELECT + UPDATE (for approve). Service role ALL for cron context.

## §129. Schema Health Score Algorithm (Sprint 106)

Base score: 100. Deductions (cumulative, floor 0, cap 100):
- Missing homepage: -30 (critical)
- Missing FAQ: -25
- Missing about: -15
- Missing event (only if events exist on site): -10
- Missing blog (only if blog pages exist): -10
- Missing service (only if service pages exist): -10
- Per pending_review page: -5
- Bonus: +5 if homepage published with sameAs links (LocalBusiness/Restaurant/BarOrPub schema type)

Golden tenant (seed data): homepage published + FAQ pending_review + events failed = score 55.

---

## §130. Review Intelligence Engine Architecture (Sprint 107)

Sprint 107 adds a Review Intelligence Engine: fetch reviews from Google and Yelp, run rule-based sentiment analysis, generate AI response drafts, and push approved replies to GBP.

**Plan gate:** `canRunReviewEngine(plan)` — Growth+ only. Starter/trial see upgrade prompt.

**HITL gate:** Negative reviews (rating ≤ 2) ALWAYS require human approval before publishing. The response generator sets `response_status = 'pending_approval'` for these instead of `'draft_ready'`.

**Module structure:** All code in `lib/review-engine/`:
- `types.ts` — shared types (Review, ReviewSentiment, BrandVoiceProfile, ReviewResponseDraft, ReviewSyncResult)
- `sentiment-analyzer.ts` — pure functions, no LLM, no I/O (analyzeSentiment, extractKeywords, classifyTopic, batchAnalyzeSentiment)
- `brand-voice-profiler.ts` — derives brand voice from location data + page schemas (deriveOrUpdateBrandVoice, getDefaultBrandVoice, inferHighlightKeywords)
- `response-generator.ts` — GPT-4o-mini via Vercel AI SDK generateText() (generateResponseDraft, buildResponseSystemPrompt, buildResponseUserMessage, validateResponseDraft)
- `fetchers/gbp-review-fetcher.ts` — GBP Reviews API v4, paginated (max 200/run), reuses token refresh from Sprint 89
- `fetchers/yelp-review-fetcher.ts` — Yelp Fusion Reviews API (max 3/request, hard API limit)
- `review-sync-service.ts` — orchestrator (fetch → analyze → upsert → draft)
- `gbp-reply-pusher.ts` — PUT /{reviewName}/reply to publish approved responses
- `index.ts` — barrel export

**Yelp limitation:** Yelp has NO reply API. Yelp reviews show "Copy to Clipboard" + "Open Yelp Business" link. Only Google reviews can be auto-published.

---

## §131. Review Intelligence Database Tables (Sprint 107)

Two new tables and column additions support the Review Intelligence Engine.

**Table: `brand_voice_profiles`**
- PK: `id` uuid. FK: `location_id` → locations(id) CASCADE, `org_id` → organizations(id) CASCADE.
- `tone` text CHECK (warm/professional/casual/playful) DEFAULT 'warm'.
- `formality` text CHECK (formal/semi-formal/casual) DEFAULT 'semi-formal'.
- `use_emojis` boolean DEFAULT false. `sign_off` text. `owner_name` text.
- `highlight_keywords` text[]. `avoid_phrases` text[]. `custom_instructions` text.
- `derived_from` text CHECK (website_copy/manual/hybrid) DEFAULT 'website_copy'.
- UNIQUE constraint on `location_id` — upsert pattern.

**Table: `reviews`**
- PK: `id` uuid. FK: `location_id` → locations(id) CASCADE, `org_id` → organizations(id) CASCADE.
- `platform_review_id` text, `platform` text CHECK (google/yelp).
- `reviewer_name` text, `rating` integer CHECK (1–5), `text` text, `published_at` timestamptz.
- `sentiment_label` text CHECK (positive/neutral/negative), `sentiment_score` numeric(3,2), `keywords` text[], `topics` jsonb.
- `response_draft` text, `response_status` text CHECK (pending_draft/draft_ready/pending_approval/approved/published/skipped).
- UNIQUE constraint on `(platform_review_id, platform, location_id)` — upsert pattern.

**New columns on `locations`:**
- `review_health_score` integer (0–100, NULL = never synced)
- `reviews_last_synced_at` timestamptz
- `total_review_count` integer DEFAULT 0
- `avg_rating` numeric(2,1) CHECK (1.0–5.0)

**New column on `google_oauth_tokens`:**
- `account_id` text (GBP Account ID for Reviews API path, populated on first fetch)

**RLS:** Org members SELECT + UPDATE on reviews, ALL on brand_voice_profiles. Service role ALL for cron.

---

## §132. Review Sentiment Analyzer Rules (Sprint 107)

Sentiment analysis is rule-based — no LLM, no external API.

**Rating bands:** high (4–5★), mid (3★), low (1–2★).
**Base label:** high → positive, mid → neutral, low → negative.
**Score:** Normalized -1 to 1 from rating + text modifier.

**Text modifiers (override rating):**
- 4★ + ≥3 strong negative keywords → override label to neutral.
- 3★ + majority positive keywords → override label to positive.

**Known keyword lists:** `KNOWN_POSITIVE_KEYWORDS` and `KNOWN_NEGATIVE_KEYWORDS` in `sentiment-analyzer.ts`, categorized by topic (service/food/atmosphere/value/hookah/events/staff/cleanliness).

**Topic classification:** `classifyTopic(keyword)` maps extracted keywords to categories. Unrecognized → 'other'.

**Limits:** `extractKeywords()` returns max 5 keywords. `inferHighlightKeywords()` returns max 8.

---

## §133. Response Generation Limits (Sprint 107)

Monthly draft generation limits per plan tier (via `RESPONSE_GENERATION_LIMITS`):
- trial: 5, starter: 25, growth: 100, agency: 500.

Response validation (`validateResponseDraft`):
- Word count: 20–200 words.
- Must not contain forbidden phrases from brand voice `avoid_phrases`.
- Fallback: `generateTemplateResponse()` when LLM call fails.

Cron: `review-sync` runs Sunday 1 AM UTC. Kill switch: `STOP_REVIEW_SYNC_CRON` env var.

---

## §134. Autopilot Engine — Trigger Detection + Orchestration (Sprint 86)

Sprint 86 extends the content brief generator (§49) with automated trigger detection, an orchestration service, a weekly cron, and a dashboard panel.

**Trigger detectors** (`lib/autopilot/triggers/`):
- `competitor-gap-trigger.ts` — `competitor_intercepts` with `gap_magnitude='high'`, last 14 days. Priority 1.
- `prompt-missing-trigger.ts` — `target_queries` + `sov_evaluations` with zero citations, grouped by `query_category`. Min cluster size = 2. Priority 2.
- `review-gap-trigger.ts` — `reviews` with `sentiment_label='negative'`, last 90 days. Requires 3+ reviews sharing a keyword. At most 1 trigger per location. Priority 3.
- `schema-gap-trigger.ts` — `locations.schema_health_score < 60`. Checks `page_schemas` for missing required types (homepage, faq, about). Priority 4.

**Content type mapping** (`create-draft.ts`): `review_gap → blog_post`, `schema_gap → faq_page`.

**Draft deduplicator** (`lib/autopilot/draft-deduplicator.ts`):
- Per-type cooldowns: competitor_gap 14d, prompt_missing 30d, review_gap 60d, schema_gap 30d.
- Three dedup rules: exact trigger_id match, same target query within cooldown, same type+location within cooldown (review_gap/schema_gap only).
- Fail-open: on DB error, all triggers pass through.

**Draft limits** (`lib/autopilot/draft-limits.ts`): trial=2, starter=5, growth=20, agency=100 drafts/month.

**Orchestrator** (`lib/autopilot/autopilot-service.ts`):
- `runAutopilotForLocation()`: check limits → Promise.allSettled 4 detectors → sort by priority → dedup → create drafts → update location tracking.
- `runAutopilotForAllOrgs()`: fetch Growth+ orgs → iterate locations sequentially.

**Cron** (`app/api/cron/autopilot/route.ts`): Wednesday 2 AM UTC. Kill switch: `STOP_AUTOPILOT_CRON`. Registered in `vercel.json`.

**API routes**:
- `POST /api/autopilot/run` — on-demand scan, Growth+ plan gated.
- `GET /api/autopilot/status` — draft counts + monthly usage + last run.

**Dashboard panel** (`app/dashboard/_components/panels/ContentDraftsPanel.tsx`): pending count, approved count, monthly usage bar. Growth+ only. Links to `/dashboard/content-drafts`.

**Migration**: `20260314000001_autopilot_triggers.sql` — adds `target_keywords`, `rejection_reason`, `generation_notes` to `content_drafts`; `autopilot_last_run_at`, `drafts_pending_count` to `locations`; creates `post_publish_audits` table.

---
> **End of System Instructions**
## §135. Semantic Authority Mapping Engine — Architecture (Sprint 108)

Sprint 108 builds a Semantic Authority Mapping Engine that measures, tracks, and improves a business's standing as a recognized, authoritative entity in the AI knowledge ecosystem.

**Pipeline** (`lib/authority/authority-service.ts`):
1. Fetch Ground Truth from `locations` table
2. Detect citation sources via Perplexity Sonar (`lib/authority/citation-source-detector.ts`) — 5 queries per location
3. Count active platforms + existing sameAs URLs
4. Compute citation velocity vs. previous month
5. Score entity authority (0–100) from 5 dimensions
6. Detect sameAs gaps against 9 high-value platforms
7. Generate prioritized recommendations (max 5)
8. Persist: upsert citations, profile, snapshot; update `locations.authority_score`

**Tier classification** (`classifySourceTier`):
- Tier 1: `.gov`, `.edu`, known news patterns (nytimes, wsj, etc.), brand website
- Tier 2: Major platforms — `KNOWN_TIER2_DOMAINS` (yelp, tripadvisor, google, reddit, eater, wikipedia, foursquare, opentable, doordash, grubhub, ubereats)
- Tier 3: Everything else (blogs, aggregators)

**sameAs gap detection** (`lib/authority/sameas-enricher.ts`):
- 9 `HIGH_VALUE_SAMEAS_PLATFORMS`: wikidata, wikipedia, yelp, tripadvisor, google_maps, apple_maps, facebook, foursquare, opentable
- Compares existing sameAs in homepage schema + listing_platform_ids vs. ideal set
- Wikidata API check (free, no key, 5s timeout)
- Platform-specific instructions for each gap

**Plan gate:** `canRunSemanticAuthority()` — Growth+ only.
**Model key:** `'authority-citation': perplexity('sonar')` in `lib/ai/providers.ts`.
**Cron:** `app/api/cron/authority-mapping/route.ts` — 1st of month, 5 AM UTC. Kill switch: `STOP_AUTHORITY_CRON`.
**Dashboard:** `AuthorityPanel` client component in `app/dashboard/_components/`. `data-testid` attributes: `authority-panel`, `authority-score`, `authority-run-button`, `authority-last-run`, `authority-tier-breakdown`, `authority-velocity`, `authority-sameas-gaps`, `authority-recommendations`.

---

## §136. Semantic Authority Database Tables (Sprint 108)

Migration: `20260315000001_semantic_authority.sql`.

**`entity_authority_citations`** — individual citation sources detected per location per month:
- PK: `id` (uuid). Unique: `(location_id, url, run_month)`.
- Columns: `location_id`, `org_id`, `url`, `domain`, `tier` (tier1/tier2/tier3/unknown), `source_type`, `snippet`, `sentiment` (positive/neutral/negative), `is_sameas_candidate`, `detected_at`, `run_month`.
- RLS: org member read, service_role full access.

**`entity_authority_profiles`** — latest authority profile per location:
- PK: `id` (uuid). Unique: `(location_id)`.
- Columns: `location_id`, `org_id`, `entity_authority_score` (0–100), 5 dimension scores (`tier1_citation_score`, `tier2_coverage_score`, `platform_breadth_score`, `sameas_score`, `velocity_score`), tier counts, `sameas_gaps` (jsonb), `sameas_count`, `citation_velocity`, `velocity_label`, `recommendations` (jsonb), `snapshot_at`, `last_run_at`.
- RLS: org member read, service_role full access.

**`entity_authority_snapshots`** — monthly snapshots for velocity tracking:
- PK: `id` (uuid). Unique: `(location_id, snapshot_month)`.
- Columns: `location_id`, `org_id`, `entity_authority_score`, `tier1_count`, `tier2_count`, `tier3_count`, `total_citations`, `sameas_count`, `snapshot_month` (text YYYY-MM).
- RLS: org member read, service_role full access.

**`locations` columns added:** `authority_score` (integer 0–100), `authority_last_run_at` (timestamptz).

---

## §137. Entity Authority Score — 5 Dimensions (Sprint 108)

Composite score 0–100, computed in `lib/authority/entity-authority-scorer.ts`:

| Dimension | Max | Formula |
|-----------|-----|---------|
| Tier 1 Citations | 30 | `min(tier1Count * 10, 30)` |
| Tier 2 Coverage | 25 | `min(tier2Count * 5, 25)` |
| Platform Breadth | 20 | `min(platformCount * 4, 20)` |
| sameAs Links | 15 | `min(sameAsCount * 3, 15)` |
| Velocity | 10 | `velocity > 0 ? min(velocity, 10) : max(velocity / 2, 0)` |

**Velocity** (`computeCitationVelocity`): `(currentTotal - previousTotal) / previousTotal × 100`. Returns `null` on first run.

**Velocity labels** (`getVelocityLabel`): `null → 'unknown'`, `> 5% → 'growing'`, `< -5% → 'declining'`, else `'stable'`.

**Grade** (`getAuthorityGrade`): A (80+), B (60+), C (40+), D (20+), F (<20).

**Decay alert** (`shouldAlertDecay`): `velocity < -20%` triggers Sentry warning.

**Recommendations** (`lib/authority/authority-recommendations.ts`):
- Priority 1: No Tier 1 citations (est. +22 pts), velocity decay < -20% (est. +10 pts)
- Priority 2: High-impact sameAs gaps (+5–8 pts), low platform breadth < 12 (+5 pts)
- Priority 3: Low Tier 2 count < 3 (+3 pts), low sameAs score < 9 (+5 pts)
- Sorted: priority ASC, then estimated_score_gain DESC. Capped at 5.

---

## §138. VAIO Engine — Architecture (Sprint 109)

**VAIO** (Voice & Conversational AI Optimization) adds voice search optimization to LocalVector.ai. Voice queries are conversational, action-oriented, and hyper-local — structurally different from typed search.

**Core library:** `lib/vaio/` (9 files):
- `types.ts` — All shared types: VoiceQuery, VoiceContentScore, VoiceGap, VAIOProfile, VAIORunResult, VOICE_SCORE_WEIGHTS
- `voice-content-scorer.ts` — Pure scoring: 4 dimensions (direct_answer 0-30, local_specificity 0-25, action_language 0-25, spoken_length 0-20)
- `spoken-answer-previewer.ts` — TTS simulation: cleanForVoice (6-step pipeline), estimateSpokenSeconds (150 WPM)
- `voice-query-library.ts` — 24 templates across 4 categories (discovery, action, comparison, information). seedVoiceQueriesForLocation uses ON CONFLICT DO NOTHING
- `llms-txt-generator.ts` — Ground Truth-based llms.txt: standard (~300-500 words) + full (~800-1200 words). formatHoursForVoice groups consecutive same-hours days
- `ai-crawler-auditor.ts` — 10 KNOWN_AI_CRAWLERS, robots.txt parsing, never throws. generateRobotsTxtFix for blocked bots
- `voice-gap-detector.ts` — 3+ zero-citation queries in a category for 14+ days triggers gap. triggerVoiceGapDrafts only for action/discovery gaps
- `vaio-service.ts` — 12-step orchestrator. computeVoiceReadinessScore (weighted formula). runVAIOForAllLocations for cron (Growth+ filter, 1s sleep between locations)
- `index.ts` — barrel export

**API routes:** 5 routes under `app/api/vaio/` (run, status, llms-txt, preview) + `app/api/cron/vaio/` (monthly 1st 6 AM UTC)
**Dashboard:** VAIOPanel (client component), /dashboard/vaio full page, Sidebar "Voice Readiness" (Mic icon) in AI Visibility group
**Plan gate:** `canRunVAIO()` in `lib/plan-enforcer.ts` — Growth+ only
**Autopilot integration:** `voice_gap` trigger type in `lib/types/autopilot.ts`, maps to `faq_page` content type in `lib/autopilot/create-draft.ts`
**Cron:** `vercel.json` entry 15, schedule `0 6 1 * *`, kill switch `STOP_VAIO_CRON`
**Migration:** `supabase/migrations/20260316000001_vaio.sql`

---

## §139. VAIO Database — vaio_profiles Table (Sprint 109)

**`vaio_profiles`** — one row per location, upserted on each VAIO run:
- PK: `id` (uuid). Unique: `location_id`.
- Columns: `location_id`, `org_id`, `voice_readiness_score` (int 0-100), `llms_txt_standard` (text), `llms_txt_full` (text), `llms_txt_generated_at` (timestamptz), `llms_txt_status` CHECK ('generated','stale','not_generated'), `crawler_audit` (jsonb), `voice_queries_tracked` (int), `voice_citation_rate` (float), `voice_gaps` (jsonb), `top_content_issues` (jsonb), `last_run_at` (timestamptz).
- RLS: org member read, service_role full access.

**`target_queries` columns added:** `query_mode` (varchar 'typed'/'voice', default 'typed'), `citation_rate` (double), `last_run_at` (timestamptz), `is_system_seeded` (boolean, default false).
**`target_queries_category_check`** updated to include `action`, `information` alongside existing values.
**`locations` columns added:** `voice_readiness_score` (integer 0-100), `vaio_last_run_at` (timestamptz).
**`content_drafts_trigger_type_check`** updated to include `voice_gap`.

---

## §140. Voice Readiness Score — 4 Dimensions (Sprint 109)

Composite score 0–100, computed in `lib/vaio/vaio-service.ts` via `computeVoiceReadinessScore()`:

| Dimension | Max | Formula |
|-----------|-----|---------|
| llms.txt | 25 | generated=25, stale=12, not_generated=0 |
| Crawler Access | 25 | healthy=25, partial=12, unknown=10, blocked=0 |
| Voice Citation | 30 | `round(avgCitationRate × 30)` |
| Content Quality | 20 | `round((avgContentScore / 100) × 20)` |

**Voice Content Score** (`scoreVoiceContent`): 4 sub-dimensions:
- `direct_answer_score` (0-30): First sentence contains business name/city = 30, starts with "We" = 15, filler opening = 0
- `local_specificity_score` (0-25): Name+city in first 50 words = 25, one of them = 15, elsewhere = 5, missing = 0
- `action_language_score` (0-25): 3+ action verbs = 25, 1-2 = 15, 0 = 0
- `spoken_length_score` (0-20): 50-200 words = 20, 201-300 = 10, <30 = 5, >300 = 0

**Voice Gap Detection** (`detectVoiceGaps`): Category has 3+ voice queries with zero citation rate, oldest run ≥ 14 days ago, data not older than 60 days.

**Known AI Crawlers** (`KNOWN_AI_CRAWLERS`): GPTBot, PerplexityBot, Google-Extended, ClaudeBot, anthropic-ai, ChatGPT-User, OAI-SearchBot, Applebot-Extended, Amazonbot, Bytespider.

---

## §141. AI Answer Simulation Sandbox — Architecture (Sprint 110)

The Sandbox is the capstone feature — the only **prospective** tool in LocalVector. It tests content *before* publication by simulating how AI models would interpret and cite it.

**Three Simulation Modes:**
1. **Content Ingestion Test** — Can AI extract correct business facts from this content?
2. **Query Response Simulation** — How would AI answer tracked queries given this content?
3. **Hallucination Gap Analysis** — Where will AI hallucinate because content doesn't answer?

**Module Layout:**
- `lib/sandbox/types.ts` — All shared types + SANDBOX_LIMITS const
- `lib/sandbox/ground-truth-diffuser.ts` — Pure text↔GT comparison (no API, no DB)
- `lib/sandbox/hallucination-gap-scorer.ts` — Pure scoring/gap analysis (no API, no DB)
- `lib/sandbox/content-ingestion-analyzer.ts` — Claude extraction + GT diff (uses Vercel AI SDK)
- `lib/sandbox/query-simulation-engine.ts` — Claude query simulation + answer evaluation
- `lib/sandbox/simulation-orchestrator.ts` — Coordinates all modes, DB persistence
- `lib/sandbox/index.ts` — Barrel export

**Key Rules:**
- Ground Truth lives on `locations` table columns (NOT a separate table)
- Target queries come from `target_queries` table (NOT `sov_target_queries`)
- Uses Vercel AI SDK (`generateText` from `ai`), model key `'sandbox-simulation'`
- API routes: `app/api/sandbox/{run,status,draft/[draftId]}`
- Dashboard: `SandboxPanel.tsx` + `SimulationResultsModal.tsx`
- Plan gate: `canRunSandbox()` — Growth/Agency only

---

## §142. Sandbox Database — simulation_runs Table (Sprint 110)

```sql
simulation_runs (
  id uuid PK, location_id uuid FK, org_id uuid FK,
  content_source text CHECK ('freeform','draft','llms_txt','published_faq','published_homepage'),
  draft_id uuid FK nullable, content_text text, content_word_count int,
  modes_run text[], ingestion_result jsonb, query_results jsonb, gap_analysis jsonb,
  simulation_score int 0-100, ingestion_accuracy int 0-100,
  query_coverage_rate numeric(4,3), hallucination_risk text CHECK ('low','medium','high','critical'),
  claude_model text, input_tokens_used int, output_tokens_used int,
  status text CHECK ('completed','partial','failed'), errors text[], run_at timestamptz
)
```

**Locations columns added:** `last_simulation_score` (int 0-100), `simulation_last_run_at` (timestamptz).

**RLS:** SELECT via memberships lookup, ALL for service_role.

---

## §143. Simulation Score Formula (Sprint 110)

Composite score 0-100, computed in `lib/sandbox/hallucination-gap-scorer.ts` via `computeSimulationScore()`:

| Component | Weight | Input |
|-----------|--------|-------|
| Ingestion Accuracy | 40% | `ingestionAccuracy / 100 × 40` |
| Query Coverage | 40% | `queryCoverageRate × 40` |
| Risk Penalty | 20% | low=20, medium=12, high=6, critical=0 |

**Hallucination Risk Thresholds** (`computeHallucinationRisk`):
- `no_answer_rate < 0.20` → low
- `0.20 ≤ rate < 0.40` → medium
- `0.40 ≤ rate < 0.60` → high
- `rate ≥ 0.60` → critical

**Ingestion Accuracy** — weighted field comparison. FIELD_WEIGHTS sum to 100:
name=20, phone=15, address=15, city=10, category=10, hours=15, website=5, state=5, description=5, zip=0, amenities=0.

---

## §144. Sandbox Rate Limits & Cost Guards (Sprint 110)

| Limit | Value | Enforcement |
|-------|-------|-------------|
| MAX_CONTENT_WORDS | 1500 | Content truncated before API call |
| MAX_QUERIES_PER_RUN | 10 | Query selection capped |
| MAX_RUNS_PER_DAY_PER_ORG | 20 | Checked via `checkDailyRateLimit()` |
| MAX_CONTENT_CHARS_STORED | 5000 | Content truncated before DB write |
| CLAUDE_MODEL | claude-sonnet-4-20250514 | Fixed model for consistent cost |

API calls: sequential with 200ms delay between queries. Short-circuit: content < 20 words skips Claude call. No API key → graceful fallback (no error).

---

## §145. Org Membership Foundation (Sprint 111)

Multi-user org membership enhanced via `lib/membership/`.

* **Existing table:** `memberships` (Sprint 98). No new table created.
* **Five roles in enum:** `owner | admin | member | analyst | viewer`. `member` is legacy (treated as viewer). `analyst` added Sprint 111.
* **SEAT_LIMITS:** trial=1, starter=1, growth=1, agency=10. Multi-seat = Agency only.
* **`seat_count` column** on organizations: trigger-maintained count (distinct from `seat_limit` which is Stripe-managed).
* **`current_user_org_id()`** remains unchanged — already queries `memberships`.
* **Service module:** `lib/membership/membership-service.ts` — getOrgMembers(), getCallerMembership(), getMemberById(), removeMember(), canAddMemberCheck().
* **API routes:** `GET /api/team/members` (list), `DELETE /api/team/members/[memberId]` (remove). Supplement existing server actions in `app/actions/invitations.ts`.
* **Team page:** `/dashboard/team` (top-level). Agency: full table + seat progress bar. Non-Agency: upgrade prompt.
* **`canAddMember()`** in plan-enforcer.ts is the pure function for seat limits. Always call before invite flow.
* **Adding a new role:** Update MemberRole union in types.ts, ROLE_PERMISSIONS, ROLE_ORDER, ROLE_HIERARCHY in org-roles.ts, RoleBadge ROLE_COLORS, and DB enum migration.

---

## §146. Team Invitations (Sprint 112)

Token-based invitation flow via `lib/invitations/`.

* **Existing table:** `pending_invitations` (already in prod_schema.sql). No migration needed.
* **Token security:** `crypto.getRandomValues()` for 32-byte tokens. Token never in API responses — only in invite email URL.
* **Soft-expire pattern:** `softExpireInvitations()` called at top of reads/validates. No separate cron.
* **Service module:** `lib/invitations/invitation-service.ts` — generateSecureToken(), sendInvitation(), getOrgInvitations(), revokeInvitation(), validateToken(), acceptInvitation().
* **Email:** `sendInvitationEmail()` in `lib/email.ts` uses existing `InvitationEmail.tsx` React Email template via Resend.
* **API routes (authenticated):** `POST/GET /api/team/invitations` (send/list), `DELETE /api/team/invitations/[invitationId]` (revoke). Agency + owner/admin gated.
* **API routes (public):** `GET/POST /api/invitations/accept/[token]` (validate/accept). Token IS the auth mechanism. Uses `createServiceRoleClient()`.
* **Accept flow — new user:** Creates auth user via `admin.createUser()`, polls for trigger, cleans up auto-created org/membership, enrolls in invited org.
* **Accept flow — existing user:** Looks up by email, enrolls in invited org (skip if already member).
* **Role assignment:** Admin, Analyst, or Viewer at invite time. Never Owner.
* **Guards:** Email normalization, seat limit check, already-a-member check, pending-invite dedup, unique constraint race condition handling.
* **UI:** InviteMemberModal (email + role selector), PendingInvitationsTable (with revoke), AcceptInviteForm (new user signup), JoinOrgPrompt (existing user).
* **Public page:** `/invitations/accept/[token]` — standalone (no dashboard chrome). 4 states: loading, invalid, new user form, existing user prompt.

---

## §147. Seat-Based Billing + Audit Log (Sprint 113)

Stripe seat metering + append-only activity log via `lib/billing/`.

* **New table:** `activity_log` — append-only audit trail. 7 event types: `member_invited`, `member_accepted`, `member_removed`, `invite_revoked`, `role_changed`, `seat_sync`, `plan_changed`. INSERT-only RLS for service_role, SELECT for org members. No UPDATE or DELETE policies.
* **New org columns:** `stripe_subscription_item_id` (text, lazy-populated from Stripe on first sync), `seat_overage_flagged` (boolean, advisory only — never blocks access).
* **Fire-and-forget pattern:** `void syncSeatsToStripe(...)` and `void logActivity(...)` — billing/logging failures NEVER block membership operations. Both functions catch all errors internally.
* **`syncSeatsToStripe()`** in `seat-billing-service.ts`: NEVER throws. Lazy-populates `stripe_subscription_item_id` if null. Uses `proration_behavior: 'create_prorations'`. Flags overage if seat_count > max_seats.
* **`syncSeatsFromStripe()`** in `seat-billing-service.ts`: Called by webhook handler. Updates `seat_count` in DB when Stripe quantity changes.
* **`getSeatState()`** in `seat-billing-service.ts`: Returns `SeatState` with in_sync check (compares DB seat_count vs Stripe quantity), monthly cost calculation (first seat free: `max(0, count - 1) × SEAT_PRICE_CENTS[tier]`).
* **Activity log service:** `logActivity()` core INSERT (NEVER throws), `getActivityLog()` paginated (max 50/page), 5 convenience wrappers.
* **API routes:** `GET /api/billing/seats` (any org member), `POST /api/billing/seats/sync` (owner + Agency), `GET /api/team/activity` (admin+, paginated).
* **Webhook integration:** `handleSubscriptionUpdated` in `app/api/webhooks/stripe/route.ts` now calls `syncSeatsFromStripe` after plan_status update.
* **Invitation wiring:** `sendInvitation` → `logInviteSent`, `acceptInvitation` → `logInviteAccepted` + `syncSeatsToStripe`, `revokeInvitation` → `logInviteRevoked`.
* **Membership wiring:** `removeMember` → `logMemberRemoved` + `syncSeatsToStripe` (with decremented seat count).
* **UI:** `SeatUsageCard` (seat count + progress bar + cost breakdown + sync status + force sync button + overage banner), `ActivityLogTable` (paginated with event labels + sync badges).
* **SEAT_PRICE_CENTS:** agency=1500 (i.e., $15/seat/mo), all others=0.
* **Migration:** `20260315000001_activity_log.sql`.

---

## §148. White-Label Domain Routing (Sprint 114)

Per-org custom domain + subdomain infrastructure via `lib/whitelabel/`.

* **Edge-only resolver:** `domain-resolver.ts` runs in Vercel Edge Runtime (proxy.ts). NO Node.js built-ins (no `dns`, no `fs`). Uses `@supabase/ssr` for DB and `lib/redis.ts` for cache. All lookups use `fetch()` or Supabase queries.
* **Redis cache:** hostname → OrgContext cached with 5 min TTL. Cache prefix: `domain_ctx:`. On Redis error: fall through to DB silently. Invalidate cache on: domain save, domain delete, verification success.
* **DNS verification:** Cloudflare DNS-over-HTTPS (`cloudflare-dns.com/dns-query`). TXT record match with quote stripping. 5-second AbortController timeout. `verifyCustomDomain()` NEVER throws.
* **Middleware headers:** proxy.ts sets `x-org-id`, `x-org-name`, `x-org-plan`, `x-resolved-hostname`, `x-is-custom-domain` on domain match. Wrapped in try/catch — never blocks requests.
* **OrgContext from headers:** `getOrgContextFromHeaders()` in server components reads x-org-* headers. Returns null for direct access.
* **Resolution order:** (1) Redis cache → (2) verified custom domain match (org_domains) → (3) subdomain slug match (organizations.slug) → (4) null.
* **`org_domains` table:** UNIQUE(org_id, domain_type). Two domain types: 'subdomain' (auto-verified) and 'custom' (requires DNS TXT verification). `idx_org_domains_value_verified` powers O(1) hot-path lookup.
* **Validation guards in `upsertCustomDomain()`:** (1) HOSTNAME_REGEX format check, (2) block *.localvector.ai, (3) conflict check against verified domains on other orgs.
* **Subdomains auto-verified:** We control *.localvector.ai DNS. Subdomain rows get `verification_status='verified'` on creation.
* **Custom domains require DNS proof:** Org adds TXT record `localvector-verify={token}`, then clicks Verify. The verify endpoint sets status='pending', runs DoH check, updates result.
* **API routes:** `GET/POST/DELETE /api/whitelabel/domain` (owner + Agency), `POST /api/whitelabel/domain/verify` (owner + Agency).
* **Plan gate:** Agency-only feature. `canManageTeamSeats()` reused as plan gate.
* **Migration:** `20260318000002_org_domains.sql`.

---

## §149. White-Label Theming + Emails (Sprint 115)

Per-org brand configuration with CSS custom property injection, themed emails, branded login page.

* **`org_themes` table:** One row per org (UNIQUE org_id). Colors validated as hex `^#[0-9a-fA-F]{6}$`. `text_on_primary` auto-computed via WCAG luminance formula, never accepted from client. RLS: members read, owner insert/update, service role full access.
* **Supabase Storage bucket:** `org-logos` — public read, org owner upload/delete. 2MB max. Allowed MIME: png, jpeg, webp, svg+xml. Path pattern: `{org_id}/logo.{ext}`.
* **Theme service:** `lib/whitelabel/theme-service.ts` — `getOrgTheme()`, `getOrgThemeOrDefault()` (never null), `upsertOrgTheme()` (validates + computes text_on_primary), `updateLogoUrl()`, `removeLogo()`. All pure — caller passes Supabase client.
* **Theme utilities:** `lib/whitelabel/theme-utils.ts` — `validateHexColor()`, `sanitizeHexColor()`, `computeTextOnPrimary()` (WCAG 2.1), `buildThemeCssProps()`, `cssPropsToObject()`, `buildLogoStoragePath()`, `isValidFontFamily()`. Zero API calls.
* **CSS custom properties:** `--brand-primary`, `--brand-accent`, `--brand-text-on-primary`, `--brand-font-family`. Injected into `<html>` via `app/layout.tsx` when OrgContext present. Only via subdomain/custom domain — direct access uses LocalVector defaults.
* **Google Fonts only:** 10 whitelisted font families in `GOOGLE_FONT_FAMILIES`. No custom font file uploads. `buildGoogleFontUrl()` returns null for Inter (already loaded).
* **NO arbitrary CSS injection** — only validated hex colors and whitelisted fonts. XSS prevention requirement.
* **Email theme wrapper:** `lib/whitelabel/email-theme-wrapper.ts` — `buildThemedEmailWrapper()` pure function wrapping email body with org logo, colors, powered-by footer.
* **`InvitationEmail.tsx` updated:** Optional `theme` prop for logo, primary_color, text_on_primary, show_powered_by. Falls back to LocalVector defaults when null.
* **Branded login page:** `/login/[slug]` — resolves org by slug, applies theme, shows email+password only (no registration, invite-only). Redirects to `/login` if slug not found.
* **Theme editor:** `/dashboard/settings/theme` — Agency plan gate, two-column layout with live preview. Color picker + hex input synced. Font dropdown. Logo upload. Powered-by toggle saves immediately.
* **Dashboard footer:** `DashboardFooter.tsx` server component — reads OrgContext, shows/hides "Powered by LocalVector" based on `show_powered_by`.
* **Plan gate:** `canCustomizeTheme()` — Agency only. Non-Agency users see upgrade prompt.
* **API routes:** `GET/POST /api/whitelabel/theme` (owner + Agency for POST), `POST/DELETE /api/whitelabel/theme/logo` (owner + Agency).
* **Migration:** `20260319000001_org_themes.sql`.
* **Tests:** 27 theme-utils + 11 email-wrapper + 16 theme-service + 22 theme-routes = 76 Vitest + 9 Playwright.

---

## §150. Supabase Realtime in `lib/realtime/` + `hooks/` (Sprint 116)

* **One channel per org per tab:** `acquireOrgChannel()` / `releaseOrgChannel()`
  from `channel-manager.ts`. Never call `supabase.channel()` directly in hooks.
* **Three channel features:**
  - Presence: `usePresence()` — who is online
  - Broadcast: `useRealtimeNotifications()` — server → client notifications
  - Postgres Changes: `useDraftLock()` — live lock state
* **`notifyOrg()` never throws.** `void notifyOrg(...)` in all call sites.
  Never await in a response path.
* **Draft locks are advisory.** Never block edits or saves on `hasConflict`.
  `useDraftLock()` failures are silent warnings.
* **`deduplicatePresenceUsers()` excludes self.** Export this for testing.
* **`useAutoRefresh` pattern:** `localvector:refresh` CustomEvent with
  `detail.keys`. Dashboard sections listen independently. Decoupled.
* **Client-only hooks:** `usePresence`, `useDraftLock`, `useRealtimeNotifications`,
  `useAutoRefresh` must only appear in `'use client'` components.
* **Migration:** `20260315000002_draft_locks.sql`.
* **Tests:** 8 realtime-types + 8 notify-org + 10 use-presence + 10 use-draft-lock + 10 use-realtime-notifications + 5 use-auto-refresh = 51 Vitest + 9 Playwright.

---

## §151. Retention & Onboarding + Weekly Digest Email (Sprint 117)

* **Onboarding steps table:** `onboarding_steps` (org_id, step_id CHECK, completed, completed_at, completed_by_user_id, UNIQUE(org_id, step_id)). RLS via `current_user_org_id()`. 5 steps: `business_profile`, `first_scan`, `first_draft`, `invite_teammate`, `connect_domain`.
* **Email preferences table:** `email_preferences` (user_id FK auth.users, org_id, digest_unsubscribed, unsubscribe_token DEFAULT random hex, UNIQUE(user_id, org_id), token UNIQUE). user_id references `auth.users(id)` NOT `public.users.id`.
* **Onboarding service:** `lib/onboarding/onboarding-service.ts` — `getOnboardingState()` lazy-inits rows, runs `autoCompleteSteps()`, computes `is_complete`, `show_interstitial` (< 2 steps AND org < 7 days), `has_real_data` (first_scan complete).
* **Auto-complete logic:** Checks real DB state: `first_scan` → sov_evaluations exists, `first_draft` → content_drafts exists, `invite_teammate` → memberships > 1, `connect_domain` → org_domains verified custom, `business_profile` → name + locations > 0.
* **Sample data:** `lib/onboarding/sample-data.ts` — `SAMPLE_SOV_DATA`, `SAMPLE_CITATION_EXAMPLES`, `SAMPLE_MISSING_QUERIES`, `SAMPLE_CONTENT_DRAFT`, `SAMPLE_FIRST_MOVER_ALERT`. Sentinel `_is_sample: true`. `isSampleData()` checker.
* **Digest service:** `lib/digest/digest-service.ts` — `buildWeeklyDigestPayload()` assembles org branding, SOV trend (0-1 float × 100), citations, missed queries, first mover alert, unsubscribe token. `getDigestRecipients()` excludes unsubscribed via `auth_provider_id` mapping.
* **Send gate:** `lib/digest/send-gate.ts` — `shouldSendDigest()` pure OR predicate: `is_first_digest || |delta| >= 2 || has_first_mover_alert`. `isFirstDigest()` checks `organizations.digest_last_sent_at IS NULL`.
* **Enhanced email template:** `emails/WeeklyDigest.tsx` rewritten. Sub-components: `DigestHeader`, `SovScoreBlock`, `CitationList`, `MissedQueryList`, `FirstMoverAlert`. `formatWeekOf()` exported. Dark theme. Unsubscribe footer.
* **Email integration:** `lib/email.ts` — old `sendWeeklyDigest()` deprecated (no-op). New `sendEnhancedDigest()` checks send gate, renders template, returns `DigestSendResult`. Updates `digest_last_sent_at` on success.
* **SOV cron wiring:** `app/api/cron/sov/route.ts` — after existing sendWeeklyDigest, adds multi-recipient loop: `getDigestRecipients()` → `buildWeeklyDigestPayload()` per recipient → fire-and-forget `sendEnhancedDigest()`.
* **Unsubscribe:** `GET /api/email/unsubscribe?token=` — public, validates 64 hex char token, sets `digest_unsubscribed=true`, redirects to `/unsubscribe`. One-click, no auth required.
* **Dashboard onboarding:** `OnboardingChecklist` (polls /api/onboarding/state, progress bar, dismiss via localStorage `lv_onboarding_dismissed`), `OnboardingInterstitial` (createPortal modal, dismiss via `lv_interstitial_dismissed`), `SampleDataBanner` (amber), `SampleDashboard` (sample data sections).
* **Dashboard page:** Early return when `!has_real_data` renders sample data + onboarding. Real data path includes checklist (self-hides when complete).
* **Migration:** `20260320000001_onboarding_digest.sql`.
* **Tests:** 17 onboarding-service + 20 digest-service + 16 digest-email + 13 onboarding-routes = 66 Vitest.

---

## §152. Conversion & Reliability Infrastructure (Sprint 118)

* **Rate limiting:** `lib/rate-limit/` (types, rate-limiter, index). Redis sliding window via `@upstash/redis` pipeline (ZREMRANGEBYSCORE + ZADD + ZCARD + EXPIRE). Fail-open on Redis errors (AI_RULES §17 pattern). 5 tiers: anonymous 20/min, trial 60, starter 120, growth 300, agency 600. Tiered by `x-org-plan` header (set by proxy). Key format: `{prefix}:{identifier}`.
* **Rate limit headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` on every API response. 429 JSON body: `{ error: 'rate_limited', retry_after, limit }`.
* **Middleware integration:** `proxy.ts` — `/api/` routes hit rate limiter before auth guard. Bypass prefixes: `/api/webhooks/`, `/api/cron/`, `/api/email/`, `/api/revalidate`. Identifier: `org:{org_id}` if headers present, else `ip:{x-forwarded-for}`. Matcher updated to include API routes (removed `api|` from exclusion).
* **Slack alerts:** `lib/alerts/` (slack, index). `sendSlackAlert(payload)` — POST to `SLACK_WEBHOOK_URL`, 5s AbortController timeout, never throws. `buildSOVDropAlert()` and `buildFirstMoverAlert()` are pure payload builders. `SOV_DROP_THRESHOLD` from env (default 5).
* **SOV cron wiring:** `app/api/cron/sov/route.ts` — fire-and-forget `sendSlackAlert(buildSOVDropAlert(...))` when `sovDelta <= -SOV_DROP_THRESHOLD`. Inside `if (ownerEmail)` block where `sovDelta` and `visRows` are in scope.
* **ISR caching:** `app/m/[slug]/page.tsx` — `unstable_cache` with tag `menu-{slug}`, revalidate 3600s. `generateStaticParams()` pre-renders all org slugs. `dynamicParams = true`.
* **Revalidation endpoint:** `POST /api/revalidate` — secret-authenticated (`REVALIDATE_SECRET`), accepts `{ slug }` or `{ org_id }` (resolves slug from organizations table). Calls `revalidateTag(\`menu-{slug}\`, { expire: 0 })`. Returns `{ ok, revalidated, timestamp }`.
* **Sentry client config:** `sentry.client.config.ts` — browser-side init, `enabled: production`, 10% traces, localhost filter. Completes Sentry instrumentation (server + edge + client + global-error + next.config wrapper).
* **Env vars:** `SLACK_WEBHOOK_URL`, `SLACK_SOV_DROP_THRESHOLD` (default 5), `REVALIDATE_SECRET`. All documented in `.env.local.example`.
* **Tests:** 19 rate-limiter + 15 slack-alerts + 7 revalidate-route + 13 middleware-rate-limit = 54 Vitest. 5 Playwright E2E (infrastructure.spec.ts).

---

## §153. pgvector Semantic Search + Embedding Pipeline (Sprint 119)

* **Extension & columns:** `extensions.vector` enabled. 5 tables get `embedding extensions.vector(1536)`: `menu_items`, `ai_hallucinations`, `target_queries`, `content_drafts`, `locations`. Migrations `20260321000001`–`20260321000004`.
* **HNSW indexes:** All 5 columns have partial HNSW index (`WHERE embedding IS NOT NULL`, `m=16`, `ef_construction=64`, `vector_cosine_ops`). Distance: `1 - (a <=> b)`, clamped via `LEAST(1.0, ...)`.
* **RPC match functions:** 4 SECURITY DEFINER functions with `SET search_path = public`: `match_menu_items` (threshold 0.65, joins menu_categories for category name), `match_hallucinations` (threshold 0.92, filters by org_id + correction_status IN open/verifying/recurring), `match_target_queries` (threshold 0.80, filters by location_id), `match_content_drafts` (threshold 0.85, filters by org_id). All GRANTed to anon/authenticated/service_role.
* **Embedding model:** `text-embedding-3-small` (1536 dimensions) via Vercel AI SDK `embed()`/`embedMany()`. Model exported as `embeddingModel` from `lib/ai/providers.ts` — kept separate from MODELS registry to preserve `LanguageModelV1` union type. Constants: `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`.
* **Embedding service:** `lib/services/embedding-service.ts` — `prepareTextForTable()` (pure, handles jsonb categories for locations), `generateEmbedding()`, `generateEmbeddingsBatch()` (max 20), `backfillTable()`, `saveEmbeddingForRow()`, `generateAndSaveEmbedding()` (never throws — fire-and-forget safe). pgvector columns accept `JSON.stringify(embedding)` via Supabase.
* **Hallucination dedup:** `lib/services/hallucination-dedup.ts` — `isDuplicateHallucination()` with threshold 0.92. Returns `{ isDuplicate: true, existingId, similarity }` or `{ isDuplicate: false }`. Fail-open on all errors.
* **Draft dedup:** `lib/services/draft-dedup.ts` — `findSimilarDrafts()` with threshold 0.85, `hasSimilarDraft()` convenience wrapper. Fail-open.
* **Inline embeddings (fire-and-forget):** `void generateAndSaveEmbedding(supabase, table, row)` wired into: `createMenuItem()` (magic-menus actions), `createManualDraft()` (content-drafts actions), audit cron (new hallucinations). Never awaited in response path.
* **Audit cron dedup:** `app/api/cron/audit/route.ts` — before inserting hallucinations, each claim checked via `isDuplicateHallucination()`. Only unique claims inserted. Insert chain now uses `.select('id, claim_text')` to get rows for embedding generation.
* **Embed-backfill cron:** `app/api/cron/embed-backfill/route.ts` — nightly 3 AM UTC, processes all 5 tables sequentially (menu_items, ai_hallucinations, target_queries, content_drafts, locations), batchSize=20. 16th cron registered in `vercel.json`.
* **Public menu search:** `GET /api/public/menu/search` — no auth, validates slug/q/limit, looks up menu by `public_slug`, calls `match_menu_items` RPC. `Cache-Control: public, max-age=60, stale-while-revalidate=300`.
* **Similar queries API:** `POST /api/sov/similar-queries` — authenticated via `getSafeAuthContext()`, calls `match_target_queries` RPC with threshold 0.80.
* **MenuSearch component:** `app/m/[slug]/_components/MenuSearch.tsx` — client component, 5 states (idle/loading/results/empty/error), renders conditionally when `totalItems > 0` on public menu page.
* **SimilarQueriesWidget:** `app/dashboard/share-of-voice/_components/SimilarQueriesWidget.tsx` — client component, fetches on queryId change, skeleton loading, filters out source query.
* **Database types:** 4 RPC function signatures added to `database.types.ts` Functions section. `embedding: number[] | null` added to Row/Insert/Update for all 5 tables.
* **Tests:** 22 embedding-service + 8 hallucination-dedup + 6 draft-dedup + 10 menu-search-route + 6 embed-backfill-cron = 52 Vitest. 6 Playwright E2E (sprint-119-pgvector.spec.ts).

---

## §154. AI Preview Streaming — SSE Architecture (Sprint 120)

* **SSE over POST (NOT EventSource):** `EventSource` is GET-only. All streaming endpoints use `POST` with `Content-Type: text/event-stream`. Client consumes via `fetch()` + `response.body.getReader()`.
* **SSE format:** `data: {JSON}\n\n` per chunk. Types: `text` (content token), `error` (error info), `done` (completion + total_tokens), `metadata` (optional). Library: `lib/streaming/` (types, sse-utils, index).
* **Server pattern (App Router):** `createSSEResponse(asyncGenerator)` wraps an `AsyncGenerator<SSEChunk>` in `new Response(new ReadableStream({...}), { headers: SSE_HEADERS })`. Headers include `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no` (nginx proxy buffer disable). AbortError from client disconnect is caught silently.
* **Vercel AI SDK streaming:** Use `streamText()` from `ai` package with `getModel('streaming-preview')` or `getModel('streaming-sov-simulate')`. Consume `result.textStream` async iterable. Model: `claude-3-5-haiku-20241022` for speed + cost. `maxDuration = 30`.
* **Client hook:** `useStreamingResponse(url, options?)` returns `{ state, start, cancel, reset }`. State: `{ status, text, error, total_tokens }`. Status lifecycle: `idle → connecting → streaming → complete|error|cancelled`.
* **SSE line buffering:** Chunks from `getReader()` don't align with `\n\n` boundaries. Buffer via `split('\n\n')` and keep `lines.pop()` (last partial line) for next iteration. `parseSSELine()` strips `data: ` prefix and JSON-parses.
* **State flush throttling:** Don't `setState` on every token — causes React render jank. Buffer text in `useRef`, flush to state every 50ms via `setInterval`. Clear interval on done/error/cancel/unmount.
* **AbortController cancellation:** `cancel()` calls `abortController.abort()`. Server catches `AbortError` (stream cancelled mid-response) — treat as non-error. Client catches `AbortError` → sets `status: 'cancelled'`.
* **StreamingTextDisplay:** 6 visual states: idle (placeholder text), connecting (animated dots), streaming (text + blinking cursor via CSS `step-end` animation), complete (text only), error (text + red "(Error)"), cancelled (text + grey "(Cancelled)"). `data-testid="streaming-text-display"`, `streaming-cursor`, `streaming-placeholder`.
* **Content preview route:** `POST /api/content/preview-stream` — requires `target_prompt` (max 500 chars), optional `current_content` + `tone`. System prompt: "write restaurant/hospitality marketing content". Auth via `getSafeAuthContext()`.
* **SOV simulate route:** `POST /api/sov/simulate-stream` — requires `query_text` (max 300 chars), optional `location_city`. **Neutral system prompt** (does NOT mention org name) — measures organic AI visibility. Org mention detection is client-side post-completion: `text.toLowerCase().includes(orgName.toLowerCase())`.
* **Panel integration:** `StreamingPreviewPanel` in DraftEditor (visible when `isEditable && targetPrompt`), `StreamingSimulatePanel` in SovCard QueryRow. Both use `useStreamingResponse` hook.
* **Tests:** 12 sse-utils + 16 streaming-routes + 15 use-streaming-response + 8 streaming-text-display = 51 Vitest. 8 Playwright E2E.

---

## §155. Correction Follow-up + Settings Expansion (Sprint 121)

Corrections in `lib/corrections/`, settings in `lib/settings/`.

* **`generateCorrectionBrief()` never throws.** Always void fire-and-forget. On any error: `Sentry.captureException` + `console.warn`, return. Uses `getModel('streaming-preview')` (Haiku) for cost.
* **API keys: SHA-256 hash only stored.** `raw_key` returned ONCE via `CreateApiKeyResult`, never in `OrgApiKey` type. `listApiKeys()` uses explicit column SELECT — `key_hash` never included. Prefix `lv_live_` + `randomBytes(32).toString('hex')`.
* **`shouldScanOrg()` gates the SOV cron.** weekly=7d, bi-weekly=14d, monthly=28d (from `SCAN_FREQUENCY_DAYS`). New orgs with no `sov_evaluations` always scan regardless of frequency setting.
* **Danger Zone: service role + owner only.** Auth check (`roleSatisfies('owner')`) runs first, then `createServiceRoleClient()` for destructive DELETE. Two actions: delete scan data (confirmation='DELETE'), delete org (confirmation=org.slug). Both require 5-second countdown + exact text match in UI.
* **Correction rescan: LIMIT 20 per cron run.** 3-way result via heuristic on AI response: `cleared` (contains 'not accurate'/'false'/'incorrect'/'not true'/'no longer'), `persists` (contains 'yes'/'accurate'/'true'/'correct'), `inconclusive` (else). Cron at daily 4 AM UTC.
* **Settings validation (server-side):** `scan_frequency` must be in enum, `notify_sov_drop_threshold` 1-20, Slack webhook must start with `https://hooks.slack.com/` or be null. Throws `invalid_*` errors caught by route as 400.
* **`correction_status` enum extended:** Added `'corrected'` value. Corrected hallucinations show in "In Progress" triage swimlane. `CorrectionStatus` type in `app/dashboard/actions.ts` updated.
* **`correction_follow_ups` table:** UNIQUE on hallucination_id. RLS: org read + service role full access. `rescan_due_at` defaults to NOW() + 14 days. Partial index on (rescan_due_at, rescan_status) WHERE pending.
* **`org_settings` table:** UNIQUE on org_id. Backfilled for existing orgs on migration. RLS: org read + admin/owner update + service role full. Default: weekly scan, threshold 5, email digest on, in-app on.
* **`org_api_keys` table:** Agency plan only. UNIQUE(org_id, key_hash). Partial index on org_id WHERE active. Soft-delete via `is_active=false` (not hard DELETE).
* **Migration:** `20260321000002_corrections_settings.sql`. 17th cron in vercel.json.
* **Tests:** 16 correction-service + 12 settings-service + 10 api-key-service + 14 correction-settings-routes = 52 Vitest.

---

## §156. Benchmark Comparisons (Sprint 122)

Percentile-based benchmark system in `lib/services/benchmark-service.ts`.

* **MIN_BENCHMARK_SAMPLE_SIZE=5.** Never compute or expose benchmarks for <5 orgs.
* **benchmark_snapshots stores ONLY aggregates.** Never org_ids or individual scores. Open authenticated-read RLS is intentional — anonymous aggregates with no org linkage.
* **Benchmark cron `"0 6 * * 0"`** runs 4 hours AFTER SOV cron `"0 7 * * 0"`. POST `/api/cron/benchmarks`. Runs both Sprint F city-avg benchmarks and Sprint 122 percentile snapshots.
* **Source score: `visibility_analytics.share_of_voice`** with `snapshot_date`. NOT `sov_evaluations` (which has no score column).
* **computePercentileRank is strict less-than.** Display: `Math.max(1, 100 − rank)`. `percentile_rank=0` → "bottom tier". `percentile_rank=100` → "top 1%". Never "top 0%" or "top 100%".
* **getOrgBenchmark() reads org_benchmark_cache only.** Never recomputes on the fly.
* **Exclude trial/free plan orgs from benchmark pool.** Paid plans only: 'starter', 'growth', 'agency'.
* **Missing data returns 200 `{ insufficient_data: true }`, never 404.**
* **getOrgBenchmarkHistory orders ASC (oldest first).** Trend direction depends on this.
* **"Most recent Sunday":** Walk back from today until `getDay() === 0`. Never use `date-fns startOf('week')` (returns Monday).
* **Application-side grouping, not SQL.** `runBenchmarkComputation` groups by `(category_key, location_key)` in TypeScript — not SQL GROUP BY. Raw per-org scores needed for `computePercentileRank`.
* **UPSERT on re-run is safe.** `UNIQUE (category_key, location_key, week_of)` + `UNIQUE (org_id, week_of)` with `ON CONFLICT DO UPDATE`.
* **Membership check in GET `/api/benchmarks/[orgId]`.** 403 if user is not a member of requested org.
* **Location category:** `locations.categories` (jsonb array), primary = `[0]`. Location city: `locations.city`.
* **Components:** `BenchmarkCard` (client, fetches `/api/benchmarks/{orgId}`), `BenchmarkPercentileBar` (pure display, 5 color tiers), `BenchmarkTrendChart` (recharts LineChart, trend: last > first → green).
* **Migration:** `20260322000001_benchmark_snapshots.sql`. Tables: `benchmark_snapshots`, `org_benchmark_cache`.
* **Tests:** 20 benchmark-service + 10 benchmark-route + 9 benchmark-cron + 10 benchmark-components = 49 Vitest. 5 Playwright E2E.

---

## §157. Multi-Model SOV Expansion (Sprint 123)

Multi-model SOV in `lib/services/multi-model-sov.ts`, config in `lib/config/sov-models.ts`, citation normalizer in `lib/services/sov-model-normalizer.ts`.

* **Purely additive to existing SOV.** `sov_evaluations` write path and `runSOVQuery()` untouched. `sov_model_results` is a separate table. If multi-model fails, main SOV results are already written.
* **Sequential model calls, never parallel.** `runMultiModelQuery()` loops through enabled models one-by-one with `sleep(config.call_delay_ms)` between each. Prevents rate-limit cascades.
* **Plan-tier model enablement.** `PLAN_SOV_MODELS`: trial=[] (none), starter=['perplexity-sonar'], growth=['perplexity-sonar','gpt-4o-mini'], agency=['perplexity-sonar','gpt-4o-mini','gemini-flash']. Use `getEnabledModels(planTier)`.
* **`detectCitation()` is a pure function.** No DB access, no side effects. Three confidence levels: 'high' (verbatim case-insensitive match), 'medium' (normalized match after &/N→and, punctuation strip), 'low' (no match). `ai_response_excerpt` truncated to 1000 chars.
* **Normalize handles "N" ↔ "&" ↔ "and".** `normalize()` replaces `&` → `and`, standalone `\bN\b` → `and`, strips all non-alphanumeric (except spaces). Prevents false negatives for business names like "Charcoal N Chill".
* **`runMultiModelQuery()` never throws.** Per-model errors caught individually — `ai_response_excerpt` set to `[error: message]`, `cited=false`, `confidence='low'`. Returns aggregate result with `cited_by_any`, `cited_by_all`, `consensus_citation_count`.
* **Upsert on UNIQUE(org_id, query_id, model_provider, week_of).** Safe for re-runs. `onConflict` clause updates all mutable columns.
* **Fire-and-forget from SOV cron.** `void runMultiModelQuery(...)` in a loop after main SOV write + notifyOrg. Main cron latency unaffected. Errors contained.
* **CHECK constraints on model_provider.** Values: 'perplexity-sonar', 'gpt-4o-mini', 'gemini-flash'. CHECK on confidence: 'high', 'medium', 'low'.
* **Model breakdown API defaults to latest week.** GET `/api/sov/model-breakdown/[queryId]` — if no `?week_of`, queries most recent week_of for that query. Returns `models[]` with `display_name` from `SOV_MODEL_CONFIGS` and `summary` with `cited_by_count`, `total_models_run`, `all_models_agree`.
* **Model scores API aggregates across all queries.** GET `/api/sov/model-scores` — groups by model_provider, computes `sov_percent = Math.round((cited/total) * 1000) / 10` (one decimal).
* **ModelBreakdownPanel: disclosure toggle pattern.** Collapsed by default ("Which AI mentions you?"). Fetches on first open only. 4 states: loading (skeleton), no data ("Run a scan"), error, populated. data-testid: `model-breakdown-toggle`, `model-breakdown-panel`, `model-breakdown-summary`.
* **ModelCitationBadge: 3 visual states.** cited+high → green "Mentioned Nx", cited+medium → amber "Possibly mentioned", not cited → gray "Not mentioned". data-testid: `model-badge-{provider}`.
* **Provider keys:** `sov-query-gpt` → openai('gpt-4o-mini'), `sov-query-gemini` → google('gemini-2.0-flash'). Existing `sov-query-copilot` → perplexity('sonar') reused.
* **RLS:** org member read (via memberships join), service role write. Same pattern as sov_evaluations.
* **Migration:** `20260322000002_sov_model_results.sql`. FK to organizations, locations, target_queries.
* **Tests:** 14 sov-model-normalizer + 14 multi-model-sov + 10 model-breakdown-route + 8 model-breakdown-component = 46 Vitest. 5 Playwright E2E.

---

## §158. IndexNow — Autopilot + Magic Menu Integration (Sprint 129)

`pingIndexNow()` is ALWAYS fire-and-forget. Never await it in a user-facing flow. Never let IndexNow failure block publish, approve, or any write operation. Only call after confirmed successful DB write.

* **Two new call sites.** Content-drafts `publishDraft()` pings IndexNow after successful GBP or WordPress publish (with `result.publishedUrl`). Magic-menus `approveAndPublish()` pings with `/m/[slug]` URL after successful publish.
* **Fire-and-forget pattern.** `pingIndexNow([url]).catch(err => Sentry.captureException(err, { tags: { component: 'indexnow', sprint: '129' } }))` — no `await`, catch-and-log only.
* **No ping when URL absent.** GBP/WordPress publish guards on `result.publishedUrl` truthy. Magic-menus guards on `current.public_slug` truthy (already inside the slug revalidation block).
* **INDEXNOW_API_KEY documented.** `.env.local.example` line 154. Returns false silently when missing.
* **Tests:** 10 Vitest (8 core pingIndexNow behavior + 2 approveAndPublish integration). 0 regressions.

---

## §159. Reality Score DataHealth v2 (Sprint 124)

DataHealth scoring in `lib/services/data-health.service.ts`. `computeDataHealth()` is the ONLY place DataHealth is calculated. Never inline the formula. Cron refreshes nightly; dashboard reads from `data_health_score` cache during day.

* **5 dimensions, 100 total points.** Core Identity (30pts: name/address/phone/website), Hours (20pts: all 7 days), Amenities (20pts: >50% set), Category/Description (15pts: category + desc≥50chars), Menu/Services (15pts: published magic menu).
* **GBP import fairness.** When `gbp_synced_at` is set (GBP-imported), amenities null is expected — full 20pts awarded. Uses existing column as proxy, no new `gbp_import_source` column needed.
* **`computeDataHealthFromData()` is pure.** No DB access, no side effects. Used for testing. `computeDataHealth()` wraps it with Supabase queries.
* **`deriveRealityScore()` updated.** New signature: `(openAlertCount, visibilityScore, dataHealthScore?, simulationScore?)`. Priority: real dataHealthScore > simulationScore blend > 100 fallback.
* **Cached on locations table.** `data_health_score INTEGER` column. Populated by nightly cron, read by dashboard.
* **Cron:** `data-health-refresh` daily 5 AM UTC. Kill switch: `STOP_DATA_HEALTH_CRON`. Registered in vercel.json (18→19 total crons after Sprint 128).
* **Migration:** `20260322000003_data_health_score.sql`.
* **Tests:** 38 Vitest (6 coreIdentity + 6 hours + 7 amenities + 5 categoryDesc + 2 menuServices + 7 composite + 4 deriveRealityScore + 2 cron registration). 0 regressions.

---

## §160. Dynamic FAQ Auto-Generation (Sprint 128)

FAQ generation in `lib/faq/faq-generator.ts`, schema in `lib/faq/faq-schema-builder.ts`. Server actions in `app/actions/faq.ts`.

* **`generateFAQs()` is the ONLY place** FAQ pairs are created. Pure function — no AI calls, no I/O. Generates from ground truth (hours, location, menu items, amenities, operational status, medical templates).
* **Content hash exclusions:** SHA-256 of question string stored in `locations.faq_excluded_hashes` (JSONB array). `applyExclusions()` filters by hash. Never use index-based or topic-string exclusion.
* **FAQPair type:** `{id, question, answer, contentHash, source}`. Source is one of: hours, location, menu, amenity, operational, medical.
* **Cap:** Generate max 15 pairs; inject max 10 in FAQPage schema (`toFAQPageJsonLd()`).
* **Medical rule:** When `isMedicalCategory()=true`, use `MEDICAL_FAQ_TEMPLATES` for medical-specific FAQs (§161). Skip food/amenity generators.
* **No HTML in answers:** `stripHtml()` mandatory before schema injection. `truncateAnswer()` caps at 300 chars.
* **FAQ cache on `locations` table.** `faq_cache` (JSONB array of FAQPair), `faq_updated_at` (timestamptz), `faq_excluded_hashes` (JSONB array of SHA-256 strings). Migration `20260322000004_faq_cache.sql`.
* **Cache pattern:** Nightly cron populates `locations.faq_cache`. `/m/[slug]` reads from cache via locations join; never generates on-request.
* **Server actions:** `excludeFAQPair()`, `unhideFAQPair()`, `regenerateFAQs()`, `getFAQPreview()` in `app/actions/faq.ts`. All require auth + org ownership.
* **Barrel export.** `lib/faq/index.ts` exports generateFAQs, applyExclusions, makeHash, toFAQPageJsonLd, stripHtml, truncateAnswer + types.
* **Cron:** `faq-regeneration` daily 3 AM UTC. Kill switch: `STOP_FAQ_CRON`. Registered in vercel.json (19 total crons).
* **Tests:** 54 Vitest (6 hours + 3 location + 2 operational + 3 menu + 3 amenity + 4 medical + 6 general + 4 exclusions + 5 jsonLd + 3 stripHtml + 2 truncateAnswer + 3 makeHash + 1 cron registration + 3 migration + 3 schema + 3 db types). 0 regressions.

---

## §161. Medical/Dental Scaffolding v2 (Sprint 127)

Medical/dental vertical extensions in `lib/schema-generator/medical-procedure-types.ts`, `lib/services/medical-faq-templates.ts`, `lib/services/medical-copy-guard.ts`.

* **`isMedicalCategory()` is the single gate** for all medical-specific behavior. All medical paths check it.
* **`buildAvailableServices(specialtyTags)`** in `medical-procedure-types.ts`. Builds `availableService` array for MedicalClinic/Physician/Dentist schema. 8 dental categories, 7 medical categories. Cap at 20 services. Dedup by name. Auto-detects dental vs medical catalog from tag names.
* **HIPAA copy rule:** All AI-generated copy for medical orgs MUST pass `checkMedicalCopy()` in `medical-copy-guard.ts`. Forbidden: diagnose, treat, cure, guarantee, painless, 100% success, best doctor in, risk-free, miracle. Disclaimer required for: treatment, procedure, diagnosis, medication, surgery, therapy.
* **FAQ templates:** 15 templates in `MEDICAL_FAQ_TEMPLATES`. `getApplicableTemplates()` filters to fields that are non-null and non-empty. `renderFAQTemplate()` substitutes {businessName}, {city}, {phone}, {insuranceList}, {hoursString}, {specialty} with fallbacks.
* **New location columns:** `accepting_new_patients` (BOOLEAN NULL), `telehealth_available` (BOOLEAN NULL), `insurance_types` (JSONB DEFAULT '[]'), `specialty_tags` (TEXT[] DEFAULT '{}'). Medical/dental only — nullable for non-medical orgs.
* **Migration:** `20260322000005_medical_fields.sql`.
* **Never modify Sprint E files.** `medical-types.ts`, `industry-config.ts`, `sov-seed.ts` are complete. Only add new files.
* **Tests:** 48 Vitest (8 buildAvailableServices + 2 catalogs + 7 getApplicableTemplates + 5 renderFAQTemplate + 11 checkMedicalCopy + 3 templates + 4 migration + 4 schema + 4 db types). 0 regressions.

---

## §162. Apple Business Connect Sync (Sprint 130)

Sync pipeline in `lib/apple-bc/`. Agency plan required for all operations.

* **NEVER log the private key or access tokens.** Log only location_id and status codes.
* **Partial update ONLY.** `computeLocationDiff()` gates every PATCH — never send unchanged fields.
* **Token cache:** Module-level, 1hr expiry with 60s buffer. Token refresh is automatic.
* **Claim flow is manual.** Never auto-claim. UI walks owner through Apple's verification.
* **`CLOSED_PERMANENTLY`** uses `closeABCLocation()` endpoint, not `updateABCLocation()`.
* **Agency-only gate:** `planSatisfies(plan, 'agency')` before every API call in cron and actions.
* **Category map:** `APPLE_CATEGORY_MAP` in `apple-bc-types.ts` — 20 categories. Unmapped categories omitted.
* **Migration:** `20260310000001_apple_bc.sql`. Tables: `apple_bc_connections`, `apple_bc_sync_log`.
* **Tests:** 43 Vitest (6 toE164 + 6 toABCHours + 6 toABCCategories + 4 toABCStatus + 5 buildABCLocation + 8 computeLocationDiff + 5 cron + 1 category map + 2 vercel.json).

---

## §163. Bing Places Sync + Sync Orchestrator (Sprint 131)

* **`syncLocationToAll()` in `lib/sync/sync-orchestrator.ts` is the ONLY place** multi-platform sync is triggered. Never call apple-bc-client or bing-places-client directly from action files.
* **Partial failure isolation:** Apple BC failure never blocks Bing sync, and vice versa. Each platform's error is caught independently and logged to Sentry with its own tag.
* **Conflict detection:** When `searchBingBusiness()` returns >1 result, set `claim_status='conflict'`. Never auto-select.
* **Fire-and-forget from Business Info Editor:** `void syncLocationToAll(...)`. Never await it in a user-facing action.
* **Auth:** Bing uses `Authorization: BingPlaces-ApiKey ${BING_PLACES_API_KEY}`. No JWT. No token cache needed.
* **Category map:** `BING_CATEGORY_MAP` uses Google-compatible `gcid:` prefixed IDs.
* **Migration:** `20260310000002_bing_places.sql`. Tables: `bing_places_connections`, `bing_places_sync_log`.
* **Tests:** 26 Vitest (3 toBingHours + 3 toBingCategories + 3 buildBingLocation + 8 sync-orchestrator + 5 bing-sync cron + 2 Business Info Editor integration + 2 vercel.json).

---

## §164. Entity-Optimized Review Responses (Sprint 132)

Entity weaving in `lib/reviews/entity-weaver.ts`, orchestration in `lib/reviews/review-responder.ts`.

* **`generateEntityOptimizedResponse()` is the ONLY entry point** for review response generation after Sprint 132. Never call bare `generateResponseDraft()` from new code.
* **2-3 entity terms MAXIMUM.** `selectEntityTerms()` always caps at 3. Never override.
* **Term slots:** Slot 1 = businessName, Slot 2 = city, Slot 3 = context-aware (matched reviewer keyword > amenity > category label > first signature item).
* **`BANNED_PHRASES` list** in `app/dashboard/reviews/actions.ts` checked before every save. Retry once on match. If second attempt also contains banned phrase, save with `entityOptimized=false`.
* **Human approval required** — `response_status = 'approved'` must be set before publish.
* **Graceful fallback:** Entity selection failure falls back to non-entity response via `generateResponseDraft()`. Never block review sync.
* **Dashboard:** `app/dashboard/reviews/page.tsx` groups by status (Needs Response, Approved, Published). Entity-Optimized badge shown for Growth+ plans.
* **Tests:** 30 Vitest (7 slot selection + 4 extractKeyAmenities + 4 extractTopMenuItems + 4 entity orchestrator + 4 system prompt + 4 banned phrases + 3 integration).

---

## §165. Agent-SEO Action Readiness Audit (Sprint 126)

Detection in `lib/agent-seo/action-schema-detector.ts`, scoring in `lib/agent-seo/agent-seo-scorer.ts`.

* **Spec-first rule:** `docs/21-AGENT-SEO.md` MUST exist before any code is written.
* **Standard User-Agent only** — never masquerade as a bot. `LocalVector/1.0` UA string.
* **READ-ONLY** — never submit forms, never execute JS, never follow >1 redirect.
* **Jargon-free UI** (§102): "ReserveAction" → "Reservation Booking". Never show "JSON-LD" in UI.
* **Cache pattern:** `locations.agent_seo_cache` JSONB populated weekly by cron. Never audit on page request.
* **Checks both** live website HTML AND `magic_menus.json_ld_schema` for LocalVector-generated action schemas.
* **5 capabilities:** reserve_action (25pts), order_action (25pts), booking_cta (20pts), booking_crawlable (20pts), appointment_action (10pts). Total 100.
* **Scoring levels:** agent_action_ready >= 80, partially_actionable >= 40, not_actionable < 40.
* **booking_crawlable special rules:** skipped (10pts neutral) when no booking URL detected; partial (10pts) for login-gated; fail (0pts) for HTTP.
* **Cron:** `app/api/cron/agent-seo-audit/route.ts` — Monday 8 AM UTC. Kill switch: `AGENT_SEO_CRON_DISABLED`.
* **Migration:** `20260303000004_agent_seo.sql`. Adds 2 columns to locations table.
* **Tests:** 31 Vitest (9 parseActionSchemasFromHtml + 4 booking URL safety + 15 computeAgentSEOScore + 1 fetchAndParseActionSchemas + 2 inspectSchemaForActions).

---

## §166. Truth-Grounded RAG Chatbot Widget (Sprint 133)

Embeddable chatbot in `lib/rag/`, widget UI at `app/widget/[slug]/`, settings at `app/dashboard/settings/widget/`.

* **ZERO hallucinations.** System prompt enforces "ONLY use provided context". If answer isn't in context → "I don't have that information. Please call {phone}."
* **80-word limit** on all responses. Keep concise.
* **RAG readiness gate:** `checkRAGReadiness()` in `rag-readiness-check.ts`. 4 dimensions: menu(40), amenities(20), hours(25), status(15). Ready ≥ 80. Widget cannot be enabled below threshold.
* **Correct menu join:** `menu_items → menu_categories!inner → magic_menus!inner(location_id, is_published)`. `menu_items` has NO `location_id` column.
* **No question logging.** Widget chat does NOT persist user questions. Privacy by design.
* **Rate limiting:** 20 requests/hr per IP + 200/day per location. Uses `checkRateLimit()` from `lib/rate-limit/rate-limiter.ts`.
* **Public route:** `app/api/widget/chat/route.ts` uses `createServiceRoleClient()` — no auth required. CORS headers required.
* **Embed script:** `app/api/widget/[slug]/embed/route.ts` — GET returns JS injecting iframe. Cache-Control 1hr.
* **Plan gate:** `canEmbedWidget(plan)` → growth + agency only.
* **Model:** `rag-chatbot` key in `lib/ai/providers.ts` → `anthropic('claude-3-5-haiku-20241022')`.
* **Migration:** `20260427000001_widget_settings.sql`. Adds `widget_enabled`, `widget_settings` to locations.
* **Tests:** 32 Vitest (8 readiness + 5 formatHours + 9 prompt + 3 answer + 7 context).

---

## §167. Per-Engine Optimization Playbooks (Sprint 134)

Engine signal library in `lib/playbooks/engine-signal-library.ts`, generation in `lib/playbooks/playbook-engine.ts`.

* **Agency-only.** `canViewPlaybooks(plan)` gate on page and cron.
* **Data gate:** `MIN_QUERIES_FOR_PLAYBOOK = 20`. Returns `insufficientData=true` when fewer queries exist for an engine.
* **4 engines:** `perplexity_sonar`, `openai_gpt4o_mini`, `gemini_flash`, `copilot`. Keys use underscores to match `sov_model_results.model_provider` CHECK constraint.
* **Pure signal functions:** Every `checkFn` in `ENGINE_SIGNAL_LIBRARIES` is pure — takes `LocationSignalInput`, returns `'present' | 'partial' | 'missing'`. No side effects.
* **Action priority:** Actions sorted: missing first (high), then partial (medium), then present (low).
* **Cache pattern:** `locations.playbook_cache` JSONB populated weekly by cron. `playbook_generated_at` TIMESTAMPTZ.
* **Cron:** `app/api/cron/playbook-generation/route.ts` — Monday 9 AM UTC. Kill switch: `PLAYBOOK_CRON_DISABLED`.
* **Migration:** `20260427000002_playbook_cache.sql`. Adds 2 columns to locations.
* **Tests:** 28 Vitest (14 signals + 6 generatePlaybook + 3 engine structure + 5 cron/registration).

---

## §168. Conversational Intent Discovery (Sprint 135)

Prompt expansion in `lib/intent/prompt-expander.ts`, gap detection in `lib/intent/intent-discoverer.ts`.

* **Agency-only.** `canRunIntentDiscovery(plan)` gate on page and cron.
* **Prompt expansion:** Claude generates 50 realistic prompts via `expandPrompts()`. Capped at `MAX_SAMPLE_SIZE = 50`. Deduplication via first-6-words clustering.
* **Citation reuse:** `detectCitation()` from `lib/services/sov-model-normalizer.ts` reused for client/competitor citation detection.
* **Opportunity scoring:** `scoreOpportunity()` — 50 base (not cited) + 30 competitor scaling + 20 theme bonus (occasion/comparison). Pure function.
* **Theme classification:** 7 themes: menu, hours, reviews, location, comparison, occasion, general. Regex keyword matching via `classifyPromptTheme()`.
* **Rate limiting:** 2-second delay between Perplexity API calls in `discoverIntents()`.
* **Perplexity data gate:** Cron requires ≥ 200 rows in `sov_model_results` for `perplexity_sonar` before running.
* **Generate Brief CTA:** Creates content_drafts with `trigger_type = 'intent_gap'`. CHECK constraint updated.
* **Cron:** `app/api/cron/intent-discovery/route.ts` — Thursday 10 AM UTC. Kill switch: `INTENT_CRON_DISABLED`. maxDuration=300.
* **Migration:** `20260427000003_intent_discoveries.sql`. New table + content_drafts CHECK update.
* **Tests:** 30 Vitest (8 classify + 6 score + 4 dedup + 4 expand + 3 discover + 5 cron/registration).

---

## §169. Dashboard Simplification — Plain English Labels (2026-03-03)

Copy-only refactor replacing all technical/analyst jargon with plain English for restaurant owners. Zero logic changes.

* **Sidebar testId decoupling:** NAV_ITEMS now has a stable `testId` field. Sidebar renders `data-testid={`nav-${item.testId}`}` instead of deriving from label. Tests must assert on `item.testId`, NOT compute from label.
* **Label SSOT:** All user-facing labels are in their respective component files. No centralized label map — each component owns its display strings.
* **Tooltip SSOT:** `lib/tooltip-content.tsx` — all 10 entries rewritten to plain English.
* **Sample data SSOT:** `lib/sample-data/sample-dashboard-data.ts` — component labels updated.
* **Plan feature matrix:** `lib/plan-feature-matrix.ts` — feature labels updated (derived from `plan-enforcer.ts`).
* **NAV_GROUPS:** 5 groups: Overview, How AI Sees You, Content, Insights, Admin. Dynamic industry suffix uses `group.label === 'Content'` (was `'Content & Menu'`).
* **Key label mappings** (for test maintenance):
  - "Share of Voice" → "AI Mentions" (sidebar) / "How Often AI Recommends You" (page title)
  - "Hallucination" → "AI Mistakes" (panels) / "Things AI Gets Wrong" (page title)
  - "Citation Intelligence" → "Platforms" (sidebar) / "Who's Talking About You" (page title)
  - "Page Audits" → "Website Checkup"
  - "Revenue Impact" → "Lost Sales" (sidebar) / "What This Costs You" (page title)
  - "Reality Score" → "AI Health Score"
  - "AEO Score" → "Score: {N}"
  - "Content Drafts" → "Posts" (sidebar) / "Posts Ready for Review" (page title)
* **Phase 2 — page-level content mappings** (internal labels, cron names, descriptions):
  - Cron labels: "SOV Engine" → "AI Mention Scan", "Schema Drift Check" → "Website Data Check", "Benchmark Aggregation" → "Local Comparison Update"
  - "Engine Comparison" → "Accuracy by AI App", "Weight:" → "Impact:"
  - "Consensus" badge → "All Agree"
  - "AEO Readiness Score" → "Page Readiness Score", "Generate Schema Fix" → "Generate Code Fix"
  - "Run SOV evaluation" → "Check AI Mentions"
  - "Run VAIO Scan" → "Run Voice Check"
  - "Entity-Optimized" → "AI-Enhanced"
  - "Citation Gap Score" → "Platform Coverage Score"
  - "llms.txt" (UI heading) → "AI Business Profile"
  - "first-party citation rate" → "How often AI cites your website"

---

## §170. Stripe Webhook Plan Tier Sync (P0-FIX-01, 2026-03-03)

When a subscription changes via Stripe portal, the webhook MUST sync `organizations.plan` — not just `plan_status`.

* **Price ID resolver:** `lib/stripe/plan-tier-resolver.ts` — `resolvePlanTierFromPriceId(priceId)` maps env vars (`STRIPE_PRICE_ID_STARTER`, `STRIPE_PRICE_ID_GROWTH`, `STRIPE_PRICE_ID_AGENCY_SEAT`) to `PlanTier`. Returns `null` for unknown IDs.
* **Webhook sync rules** (`app/api/webhooks/stripe/route.ts`):
  - `subscription.updated` + active/trialing + resolved tier → set `plan = resolvedTier`
  - `subscription.updated` + canceled/unpaid → set `plan = 'trial'`
  - `subscription.deleted` → set `plan = 'trial'`, `plan_status = 'canceled'`, `seat_limit = 1`
  - `invoice.payment_failed` → set `plan_status = 'past_due'` only (do NOT downgrade plan tier)
* **TopBar display:** Always use `getPlanDisplayName(plan)` from `lib/plan-display-names.ts`. Never display raw enum values. The `capitalize` CSS class is not used on the plan badge.
* **DB column:** `organizations.plan` (enum: `trial|starter|growth|agency`). There is NO `profiles` table — all plan data lives on `organizations`.

---

## §171. Onboarding Link Fix (P0-FIX-02, 2026-03-03)

* **Correct URL:** `business_profile` step `action_url` is `/dashboard/settings/business-info` (not `/dashboard/settings/profile`).
* **Legacy redirect:** `app/dashboard/settings/profile/page.tsx` redirects to `/dashboard/settings/business-info` to catch bookmarks/cached URLs.
* When adding new onboarding steps, always verify the `action_url` resolves to an existing route.

---

## §172. Plan-Gated Onboarding Steps (P0-FIX-03, 2026-03-03)

Onboarding steps are filtered by the org's plan tier. Not all steps are shown to all plans.

* **`OnboardingStep.requiredPlan?: PlanTier`** — if set, the step is only visible when `planSatisfies(orgPlan, requiredPlan)` returns true.
* **Current gating:** `invite_teammate` and `connect_domain` require `'agency'`. The 3 core steps (`business_profile`, `first_scan`, `first_draft`) have no `requiredPlan` and are visible to all plans.
* **`getVisibleSteps(plan: PlanTier)`** — exported from `lib/onboarding/types.ts`. Returns filtered array of steps visible for the given plan.
* **Service layer:** `getOnboardingState()` and `autoCompleteSteps()` accept optional `orgPlan?: PlanTier` (defaults to `'trial'`). `total_steps`, `completed_steps`, and `is_complete` are computed from visible steps only.
* **`visible_step_ids: OnboardingStepId[]`** — included in `OnboardingState` response so clients know which steps are relevant.
* **Component:** `OnboardingChecklist.tsx` iterates `state.steps` (pre-filtered by service), not `ONBOARDING_STEPS` directly.

---

## §173. P0 Sprint Prompt Adaptation Pattern (2026-03-03)

The P0 sprint prompts assumed a `profiles` table with user-level plan data. The real codebase uses `organizations.plan` (enum: `trial|starter|growth|agency`). Key mapping differences:

| Sprint prompt assumes | Real codebase |
|---|---|
| `profiles` table | `organizations` table |
| `profiles.plan_tier` column | `organizations.plan` column |
| `'free'` plan tier | `'trial'` plan tier |
| `'ai_shield'` plan tier | `'growth'` (display name "AI Shield" via `getPlanDisplayName`) |
| User-level plan data | Org-level plan data |

When executing future sprint prompts (P1, P2), always adapt to the real architecture:
1. Replace `profiles` references with `organizations`
2. Replace `plan_tier` with `plan`
3. Replace `'free'` with `'trial'`, `'ai_shield'` with `'growth'`
4. Plan display names are UI-only (`lib/plan-display-names.ts`) — DB stores enum values

---

## §174. Plan Consistency Audit (P1-FIX-08, 2026-03-03)

All inline plan string comparisons in feature-gating code must use `lib/plan-enforcer.ts` helper functions. Never compare `plan === 'agency'` or `plan === 'trial' || plan === 'starter'` directly.

**New functions added to `lib/plan-enforcer.ts`:**
* `canViewRevenueLeak(plan: PlanTier): boolean` — returns `true` for growth/agency
* `canConfigureWebhook(plan: PlanTier): boolean` — returns `true` for agency only
* `canManageApiKeys(plan: PlanTier): boolean` — returns `true` for agency only

**Files modified:**
* `RevenueLeakCard.tsx` — `!canViewRevenueLeak(plan)` replaces `plan === 'trial' || plan === 'starter'`
* `settings/actions.ts` — `canConfigureWebhook()` replaces `ctx.plan === 'agency'`
* `settings/_components/SettingsForm.tsx` — `canConfigureWebhook()` replaces `plan === 'agency'`
* `settings/page.tsx` — `canManageApiKeys()` replaces `ctx.plan === 'agency'`

**Intentionally NOT changed (valid inline comparisons):**
* `app/dashboard/billing/` — billing page legitimately compares plan tiers for UI routing/pricing
* `app/admin/` — admin-only pages, not customer-facing feature gating
* `app/dashboard/billing/_components/SeatUsageCard.tsx` — `state.plan_tier` is a billing API field name
* `app/dashboard/settings/locations/page.tsx` — UI copy variation, not feature gating

---

## §175. Sidebar Plan Gating (P1-FIX-06, 2026-03-03)

Sidebar navigation items can be locked by plan tier. Locked items show a Lock icon and open an UpgradeModal instead of navigating.

**NAV_ITEMS `minPlan` field:**
* Optional `minPlan?: 'growth' | 'agency'` on any NAV_ITEMS entry
* Agency-only (`minPlan: 'agency'`): team, domain, playbooks, intent-discovery, system-health
* Growth+ (`minPlan: 'growth'`): chat-widget, voice-readiness, agent-readiness
* Items without `minPlan` are visible to all plans (trial, starter, growth, agency)

**Locked item rendering:**
* Locked items render as `<button>` (not `<Link>`) with dimmed text + Lock icon
* `data-testid="nav-{item.testId}"` is preserved on locked items (same as unlocked)
* Clicking a locked item sets `lockedItem` state → opens `UpgradeModal`

**`UpgradeModal` (`components/ui/UpgradeModal.tsx`):**
* Custom modal (follows InviteMemberModal pattern, no shadcn Dialog)
* Props: `open`, `onClose`, `featureName`, `requiredPlan: 'growth' | 'agency'`
* Close: Escape key, backdrop click, X button
* Uses `getPlanDisplayName()` for plan tier display name
* CTA links to `/dashboard/billing`
* `data-testid="upgrade-modal"`

---

## §176. Settings Navigation Audit + Upgrade Redirect Banner (P1-FIX-07, 2026-03-03)

When a non-qualifying user is redirected from a locked sidebar item to `/dashboard?upgrade=X`, a dismissible banner explains the situation.

**`UpgradeRedirectBanner` (`app/dashboard/_components/UpgradeRedirectBanner.tsx`):**
* Client component, reads `upgradeKey` prop
* Maps 6 upgrade keys to feature name + required plan display name:
  * `team` → Team Management / Brand Fortress
  * `domain` → Custom Domain / Brand Fortress
  * `playbooks` → Improvement Plans / Brand Fortress
  * `widget` → Website Chat / AI Shield
  * `intent` → Missing Questions / Brand Fortress
  * `voice` → Voice Search / AI Shield
* Renders `UpgradePlanPrompt` component (existing)
* Dismissible via X button
* Returns `null` for unknown upgrade keys

**Dashboard integration:**
* `app/dashboard/page.tsx` accepts `searchParams: Promise<{ upgrade?: string }>` (Next.js 16 async searchParams)
* Renders `UpgradeRedirectBanner` after header when `upgrade` param is present

---

## §177. Manual SOV Scan Trigger (P1-FIX-05, 2026-03-03)

Growth/Agency users can trigger a full-org AI visibility scan on demand. Trial/Starter users see an upgrade prompt.

**Database migration (`supabase/migrations/20260428000001_manual_scan_status.sql`):**
* `organizations.last_manual_scan_triggered_at` — timestamptz, nullable
* `organizations.manual_scan_status` — text, CHECK (pending/running/complete/failed/NULL)
* Status lifecycle: `NULL → pending (API route) → running (Inngest) → complete/failed → NULL`

**Inngest function (`lib/inngest/functions/manual-sov-trigger.ts`):**
* Function ID: `manual-sov-trigger`, retries: 1, event: `'manual/sov.triggered'`
* 4 steps: `fetch-org-queries` → `mark-running` → `run-sov` (calls `processOrgSOV()` from sov-cron.ts) → `mark-complete`
* Plan-based query caps: starter=15, growth=30, agency=100
* Uses `createServiceRoleClient()` per step (no session in Inngest context)
* Registered in `app/api/inngest/route.ts`

**API route (`app/api/sov/trigger-manual/route.ts`):**
* POST: auth → plan gate (`planSatisfies(plan, 'growth')` → 403) → in-progress check (409) → rate limit 1/hr/org via Redis (`checkRateLimit` → 429) → set pending → dispatch Inngest → 200
* GET: auth → return `{ status, last_triggered_at }` from organizations row
* Rate limit config: `{ max_requests: 1, window_seconds: 3600, key_prefix: 'manual-sov' }`

**UI component (`app/dashboard/_components/ManualScanTrigger.tsx`):**
* Client component, props: `{ plan: string | null }`
* Trial/Starter: renders `UpgradePlanPrompt` for "Manual AI Scan"
* Growth/Agency: "Check AI Mentions Now" card with button
* Polls `GET /api/sov/trigger-manual` every 5s while pending/running
* Button states: idle → triggering (spinner) → pending/running (animate-spin) → complete (CheckCircle) → error
* Error states: cooldown (429), already running (409), network error
* `data-testid="manual-scan-trigger"`, `data-testid="manual-scan-btn"`, `data-testid="manual-scan-error"`

---

## §178. Sample→Real Data Transition + Credit Audit Trail (P3-FIX-13 to P3-FIX-16, 2026-03-03)

**Unified data mode resolver (`lib/data/scan-data-resolver.ts`):**
* Three modes: `'sample'` (org < 14 days, no sov_evaluations), `'real'` (has sov_evaluations), `'empty'` (> 14 days, no data)
* `getNextSundayUTC(from?)` — next Sunday midnight UTC for scan scheduling
* `resolveDataMode({ supabase, orgId })` — parallel fetch org + first/last sov_evaluations, returns `DataResolverResult`
* `isFirstScanRecent` — true when first scan completed < 24h ago and only one scan exists

**Scan complete banner (`components/dashboard/ScanCompleteBanner.tsx`):**
* Client component, `isFirstScanRecent` prop. Auto-dismiss 8s. localStorage `lv_scan_complete_banner_shown` one-shot
* `data-testid="scan-complete-banner"`, `data-testid="scan-complete-banner-dismiss"`

**Credit usage audit trail:**
* Migration `20260303100001_credit_usage_log.sql` — `credit_usage_log` append-only table. RLS via memberships
* `CreditOperation` type: `sov_evaluation | content_brief | competitor_intercept | magic_menu | ai_preview | manual_scan | generic`
* `consumeCreditWithLog(orgId, operation, referenceId?)` — RPC increment + audit log insert. Fail-open
* `getCreditBalance(orgId)` → `{ used, limit, remaining, resetDate }` or null
* `getCreditHistory(orgId, limit?)` → paginated history entries

**Billing page enhancements:**
* `getSubscriptionDetails()` — Stripe subscription period end + cancel status. Demo mode fallback
* `getCreditsSummary()` — balance + recent 10 history entries

**Tests:** 80 across 4 files (p3-fix-13: 24, p3-fix-14: 18, p3-fix-15: 20, p3-fix-16: 18)

---

## §179. Transactional Email — Scan Complete Notification (P5-FIX-21, 2026-03-03)

**Email function (`lib/email.ts`):**
* `ScanCompletePayload` type: to, businessName, shareOfVoice, queriesRun, queriesCited, isFirstScan, dashboardUrl
* `sendScanCompleteEmail(payload)` — first-scan subject ("Your first AI visibility scan is complete") vs repeat ("Weekly scan complete"). Citation rate calculated. Onboarding guidance for first scan only
* No-ops when `RESEND_API_KEY` absent. From: `LocalVector <alerts@localvector.ai>`

**SOV cron wiring (`lib/inngest/functions/sov-cron.ts`):**
* After weekly digest email, queries `sov_evaluations` count to detect first scan
* Fire-and-forget `sendScanCompleteEmail()` with `.catch()` error logging
* `isFirstScan = evalCount <= results.length` (only this batch's results exist)

**Tests:** 15 (scan-complete-email.test.ts — no-op, subjects, recipients, citation rate, first-scan guidance)

---

## §180. API Rate Limiting — Systematic Route Coverage (P5-FIX-22, 2026-03-03)

**Route-specific rate limit config (`lib/rate-limit/types.ts` → `ROUTE_RATE_LIMITS`):**
* Auth: `auth_login` (5/min/IP), `auth_register` (3/min/IP), `auth_oauth` (10/min/IP)
* Destructive: `danger_delete_org` (1/hr/org), `danger_delete_data` (1/hr/org)
* AI operations: `ai_preview` (20/hr/org), `content_stream` (30/hr/org), `review_generate` (20/day/org), `schema_run` (5/day/org), `vaio_run` (2/day/org), `nap_sync` (5/day/org)
* Team/billing: `team_mutate` (20/min/org), `billing_sync` (5/min/org)
* Public: `public_search` (20/min/IP), `public_menu` (30/min/IP)
* All configs have unique `key_prefix` and positive limits. Auth limits are stricter than plan-based middleware limits

**Routes wired:**
* `app/api/auth/login/route.ts` — IP-based brute force protection. 429 with rate limit headers
* `app/api/auth/register/route.ts` — IP-based signup spam protection. 429 with rate limit headers
* `app/api/settings/danger/delete-org/route.ts` — org-based destructive op limit (after auth check)
* `app/api/settings/danger/delete-scan-data/route.ts` — org-based destructive op limit (after auth check)

**Layered approach:** Route-specific limits supplement the existing plan-based middleware limits in `proxy.ts`. `RATE_LIMIT_BYPASS_PREFIXES` (webhooks, crons, email, revalidate) remain unchanged.

**Tests:** 19 (rate-limit-coverage.test.ts — config validation, plan hierarchy, bypass rules, checkRateLimit, getRateLimitHeaders)

---

## §181. Error Boundaries + Performance (P5-FIX-23 + P5-FIX-24, 2026-03-03)

**Error boundaries added:**
* `app/(auth)/error.tsx` — auth pages. Sentry capture + login link + try again
* `app/admin/error.tsx` — admin panel. Sentry capture + try again
* `app/onboarding/error.tsx` — onboarding. "Your progress has been saved" + dashboard link
* `app/invitations/error.tsx` — invitation acceptance. "Link may have expired" + sign in link
* All follow dashboard/error.tsx pattern: `'use client'`, `Sentry.captureException(error)`, AlertTriangle icon, error.digest display, reset button

**Not-found pages:**
* `app/not-found.tsx` — global 404. Home + dashboard links
* `app/dashboard/not-found.tsx` — dashboard 404. "Back to dashboard" link

**Dashboard loading skeleton:**
* `app/dashboard/loading.tsx` — CSS-only animate-pulse. Header + 4 metric cards + chart skeleton. `data-testid="dashboard-loading"`

**Performance optimizations (`next.config.ts`):**
* `experimental.optimizePackageImports`: lucide-react, 5 radix-ui packages, recharts, date-fns — tree-shakes barrel exports
* `compress: true`, `reactStrictMode: true`, `poweredByHeader: false`

**Core Web Vitals (`instrumentation-client.ts`):**
* `Sentry.browserTracingIntegration()` captures LCP, INP, CLS automatically via Sentry
* Existing 10% `tracesSampleRate` applies to CWV collection

**Tests:** 46 (error-boundaries.test.ts: 29, performance-config.test.ts: 17)

---

## §182. P3-P5 Cross-Sprint Regression Fixes (2026-03-03)

**Root cause:** Three cross-sprint interactions broke existing tests after the P3-P5 block commit:

**Fix 1 — sentry-config.test.ts (4 tests):**
* P5-FIX-24 added `Sentry.browserTracingIntegration()` to `instrumentation-client.ts`
* Test mock for `@sentry/nextjs` did not include `browserTracingIntegration` → module-level call threw
* **Fix:** Added `browserTracingIntegration: vi.fn().mockReturnValue({ name: 'BrowserTracing' })` to mock

**Fix 2 — sentry-sweep-verification.test.ts (1 test):**
* P3-FIX-15 introduced bare `} catch {` in `app/dashboard/billing/actions.ts:228` (`getSubscriptionDetails` Stripe fallback)
* Sentry sweep regression test detects bare catches (Sprint A §70 enforcement)
* **Fix:** `} catch (err) { Sentry.captureException(err, { tags: { component: 'getSubscriptionDetails', sprint: 'P3-FIX-15' } }) }` + added `import * as Sentry from '@sentry/nextjs'`

**Fix 3 — inngest-sov-cron.test.ts (10 tests):**
* P5-FIX-21 added `sendScanCompleteEmail()` import to `lib/inngest/functions/sov-cron.ts`
* Test mock for `@/lib/email` only had `sendSOVReport` + `sendWeeklyDigest` → `sendScanCompleteEmail` was `undefined` → TypeError at call site
* **Fix:** Added `sendScanCompleteEmail: vi.fn().mockResolvedValue(undefined)` to email mock

**Enforcement:** These regressions are prevented by existing tests — no new regression guards needed. The sentry-sweep test itself caught Fix 2.

**Tests:** 0 new tests. 15 existing tests unblocked (4 + 1 + 10). Total suite: 369 files, 5,578 tests, 0 failures.

---

## §183. P6-FIX-25 — Security Headers + CSP + Scanner Blocking + RLS Gap Fill (2026-03-03)

**Content Security Policy (CSP):**
- `lib/security/csp.ts` — `buildCSP()` returns CSP directive string. 11 directives: default-src self, script-src self+stripe, style-src self+fonts, img-src self+data+blob+supabase, connect-src self+supabase+sentry+stripe, frame-src stripe, object-src none, base-uri self, form-action self, frame-ancestors self, upgrade-insecure-requests.
- `getCSPHeaderName()` returns `Content-Security-Policy` in production, `Content-Security-Policy-Report-Only` in development.
- CSP never includes `unsafe-eval` or `unsafe-inline`.

**Security Headers:**
- `next.config.ts` `headers()` function — 7 headers on all routes `/(.*)`
- X-DNS-Prefetch-Control: on
- Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=()
- Content-Security-Policy (via `buildCSP()`)

**Scanner UA Blocking:**
- `lib/security/scanner-guard.ts` — `isScannerUA(ua)` pure function. 12 blocked patterns: sqlmap, nikto, nessus, nmap, masscan, nuclei, dirbuster, gobuster, wfuzz, acunetix, burpsuite, openvas.
- Integrated at top of `handleProxy()` in `proxy.ts` — returns 403 before any auth/rate-limit processing.
- Null/empty UA passes through (don't block legitimate clients).

**RLS Gap Fill:**
- Migration `20260304100001_rls_gap_fill.sql` — Enables RLS + 4 policies (select/insert/update/delete) on 10 tables:
  `entity_authority_citations`, `entity_authority_profiles`, `entity_authority_snapshots`, `intent_discoveries`, `listing_platform_ids`, `listing_snapshots`, `nap_discrepancies`, `page_schemas`, `post_publish_audits`, `vaio_profiles`.
- All use standard `org_id = public.current_user_org_id()` pattern.
- Skipped: `local_occasions` (intentionally global), `directories` (global lookup).

**Tests:** 76 Vitest — security-csp.test.ts (19), security-scanner-guard.test.ts (22), security-rls-audit.test.ts (35).

---

## §184. P7-FIX-30 — Structured Logging + Request Tracing (2026-03-03)

**Structured Logger:**
- `lib/logger.ts` — Lightweight structured logger (no pino dependency — avoids bundle bloat).
- Production: `JSON.stringify` output (Vercel log drain compatible).
- Dev: human-readable format `[LEVEL] message { context }`.
- Interface: `log.info(msg, ctx)`, `log.warn(msg, ctx)`, `log.error(msg, ctx, err?)`.
- Context type: `{ requestId?, orgId?, userId?, route?, sprint?, duration_ms?, [key: string]: unknown }`.
- `redactSensitiveFields(obj)` — strips values for: password, token, secret, authorization, stripe_customer_id, stripe_subscription_id, cookie, api_key, apiKey. Replaces with `'[REDACTED]'`.
- Error serialization: `log.error()` extracts `message`, `stack`, `code` from Error objects.

**Request Tracing:**
- `proxy.ts` — Generates `x-request-id` header via `crypto.randomUUID()` if not already present.
- Attaches `x-request-id` to response headers on all requests.
- Existing `x-request-id` from upstream is preserved (not overwritten).

**Tests:** 19 Vitest — logger.test.ts (19).

---

## §185. P7-FIX-31 — CI/CD Pipeline Enhancement (2026-03-03)

**GitHub Actions Enhancement:**
- `.github/workflows/test.yml` — Enhanced pipeline: TypeScript → Lint → Vitest → Build.
- Added `npx next lint` step between typecheck and test.
- Added `npm run build` step after tests (catches SSR/RSC build errors).
- Build step has `SENTRY_AUTH_TOKEN: ''` to prevent Sentry source map upload in CI.
- Job name: "TypeScript + Lint + Vitest + Build".

**Vercel Config Validation:**
- `src/__tests__/unit/vercel-config-valid.test.ts` — 6 tests: valid JSON, crons array, no duplicate schedules, paths start with /api/cron/, all paths have route.ts files, valid cron schedule format.

**Tests:** 6 Vitest — vercel-config-valid.test.ts (6).

---

## §186. P6-FIX-26 — GDPR Compliance (2026-03-03)

**Data Export API:**
- `app/api/settings/data-export/route.ts` — GET, auth required, owner-only via `roleSatisfies(role, 'owner')`.
- Rate limited: `ROUTE_RATE_LIMITS.data_export` (1 request/day/org, key_prefix: `rl:gdpr:export`).
- Queries 9 org-scoped tables in parallel: organizations, locations, target_queries, sov_evaluations, ai_hallucinations, content_drafts, page_audits, competitors, entity_checks.
- Returns JSON file attachment via `Content-Disposition: attachment; filename="localvector-data-export-{date}.json"`.
- Structure: `{ exportVersion: '1.0', exportedAt, organization, locations, targetQueries, sovEvaluations, hallucinations, contentDrafts, pageAudits, competitors, entityChecks }`.
- **Redaction:** `stripe_customer_id` and `stripe_subscription_id` replaced with `'[REDACTED]'`.

**7-Day Deletion Grace Period:**
- Migration `20260304100002_gdpr_deletion.sql` — Adds `deletion_requested_at timestamptz` and `deletion_reason text` to `organizations`.
- `app/api/settings/danger/delete-org/route.ts` — Changed from immediate CASCADE to grace period. Sets `deletion_requested_at = now()`, `plan_status = 'pending_deletion'`. Cancels Stripe immediately. Returns `{ ok: true, deletion_date, message }`.
- `app/api/cron/data-cleanup/route.ts` — Daily cron (2 AM UTC). CRON_SECRET protected. Kill switch: `STOP_DATA_CLEANUP_CRON`. Finds orgs where `deletion_requested_at < now() - 7 days`. Cancels Stripe subscription, then hard-deletes org (CASCADE). Sentry logging per deletion.
- 25th cron registered in `vercel.json`.

**Cookie Consent Banner:**
- `components/ui/CookieConsentBanner.tsx` — Client component. localStorage-backed (`lv_cookie_consent`). Minimal: "We use essential cookies only." + Privacy Policy link + "Got it" button. role="dialog", aria-label="Cookie consent". Fixed bottom, z-50.
- Added to `app/layout.tsx` before `</body>`.

**Tests:** 20 Vitest — data-export-route.test.ts (6), data-cleanup-cron.test.ts (6), cookie-consent-banner.test.tsx (8).

---

## §187. P6-FIX-28 — Mobile Responsiveness (2026-03-03)

**Table Responsiveness:**
- `TeamMembersTable.tsx`, `PendingInvitationsTable.tsx` — `overflow-hidden` → `overflow-x-auto` for horizontal scroll on mobile.
- `ActivityLogTable.tsx`, `PlanComparisonTable.tsx` — already had `overflow-x-auto` (verified).
- Column hiding: `hidden sm:block` on "Joined" column (TeamMembersTable), "Invited By"/"Expires" columns (PendingInvitationsTable).

**Modal Responsiveness:**
- `InviteMemberModal.tsx`, `ListingFixModal.tsx`, `SimulationResultsModal.tsx`, `DangerZoneSettings.tsx` — `p-4` added to modal backdrop div (ensures mobile viewport safety margins).
- `UpgradeModal.tsx` — already had `mx-4` (verified).

**Grid Responsiveness:**
- `app/dashboard/page.tsx` — stat panel grid already uses `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` (verified).
- `AddLocationModal.tsx` — city/state/zip grid changed from `grid-cols-5` to `grid-cols-1 sm:grid-cols-5`.

**Layout:**
- `Sidebar.tsx` — uses `-translate-x-full` / `lg:translate-x-0` pattern (slide in/out).
- `TopBar.tsx` — hamburger button with `lg:hidden`.
- `DashboardShell.tsx` — main content area has `p-4 sm:p-6` responsive padding.

**Tests:** 16 Vitest — mobile-responsive.test.ts (16).

---

## §188. Real Menu Ground Truth + price_note Schema Enhancement (2026-03-03)

**Context:** Charcoal N Chill seed data had 4 fictional BBQ items (Smoked Brisket, Half Chicken, Truffle Mac & Cheese, Collard Greens). The actual restaurant is an Indo-fusion hookah lounge & grill with ~153 menu items. All ground truth systems (hallucination detection, RAG, entity weaver, llms.txt, data health) were comparing AI claims against fake data.

### Part A: Seed Data — Real Menu (4 → 153 items, 2 → 17 categories)

**Categories (17):** Appetizers (22), Grill (4), Entrées (8), Desserts (2), Beverages (6), Mocktails (3), Cocktails (10), Mixed Shots (5), IPA (3), Domestic Beer (4), Imported Beer (10), Chill Sips (10), Easy Sips (10), Boss Sips (10), Curated Hookah (6), Build Your Own Hookah (1), VVIP Bottle Service (39).

**Tiered pricing via `price_note`:**
- Spirits (Chill/Easy/Boss Sips): `price` = single pour, `price_note` = "Double: $X"
- Curated Hookah: `price` = $40.00, `price_note` = "Refill: $20"
- Build Your Own Cloud: `price` = $25.00, `price_note` = "Refill: $15"

**Dietary tags:** Vegetarian (paneer items, spring rolls, fries, corn, naan), Vegan (crispy corn, peanut masala), Non-Alcoholic (mocktails).

**UUID patterns:** Categories use `dXeebc99-9c0b-4ef8-bb6d-6bb9bd380a11` (X=0-f + d00). Items use `e000bc99-9c0b-4ef8-bb6d-6bb9bd38XXXX` (XXXX=0001-0099, overflow e001bc99 prefix).

**File:** `supabase/seed.sql` — §4 (categories), §5 (menu_items), §6 (magic_menus extracted_data).

### Part B: Schema — price_note in OCR Pipeline

The DB `menu_items.price_note` column existed but was not exposed in the extraction pipeline.

**Files modified:**
1. `lib/types/menu.ts` — Added `price_note?: string` to `MenuExtractedItem`
2. `lib/ai/schemas.ts` — Added `price_note: z.string().optional()` to `MenuOCRItemSchema`
3. `lib/utils/parseCsvMenu.ts` — Added `Price_Note` column support in parser + updated CSV template to 7 columns with real CNC items
4. `app/dashboard/magic-menus/actions.ts` — Added `price_note` to local Zod schema, OCR mapping, mock data, GPT-4o prompt

**CSV Gold Standard template (7 columns):** `Category,Item_Name,Description,Price,Price_Note,Dietary_Tags,Image_URL`

### Part C: Test & Fixture Updates

**Updated files:**
- `src/__fixtures__/golden-tenant.ts` — `MOCK_MENU_SEARCH_RESULTS` now uses real items (Chicken 65, Lamb Chops)
- `tests/e2e/05-public-honeypot.spec.ts` — Updated assertions: Appetizers/Grill categories, Chicken 65/Lamb Chops items
- `tests/e2e/hybrid-upload.spec.ts` — Updated assertions for real CNC items
- `src/__tests__/unit/menu-search-route.test.ts` — Updated mock result assertion
- `src/__tests__/unit/parseCsvMenu.test.ts` — Added 2 new tests (Price_Note parsing + blank Price_Note), updated template test (6→7 columns)
- `tests/fixtures/sample-gold-menu.csv` — Rewritten with real CNC items and Price_Note column
- `src/mocks/handlers.ts` — Updated MSW mock menu data to real items

**Tests:** 2 new Vitest (parseCsvMenu.test.ts). Total: 378 files, 5,717 tests, 0 failures.

---

## §189. Migration Ordering + Seed Hotfix for `db reset` (2026-03-03)

**Problem:** `supabase db reset` was broken by 5 pre-existing issues accumulated across sprints. The menu ground truth update (§188) exposed these because it required a fresh `db reset` to load the new seed data.

### Migration Fixes

1. **Duplicate timestamps (3 pairs):** Supabase uses the numeric prefix as PK in `schema_migrations`. Three pairs collided:
   - `20260310000001` — apple_bc + sprint_n_settings → sprint_n renamed to `20260310000003`
   - `20260315000001` — activity_log + semantic_authority → semantic_authority renamed to `20260315000003`
   - `20260321000002` — add_embedding_columns + corrections_settings → corrections renamed to `20260321000005`

2. **RLS gap fill ordered too early:** `20260304100001_rls_gap_fill.sql` referenced 10 tables (entity_authority_citations, vaio_profiles, intent_discoveries, etc.) created in later migrations. Moved to `20260428100001`.

3. **Wrong trigger function:** apple_bc + bing_places called `public.set_updated_at()` but the actual function is `public.update_updated_at_column()` (defined in initial_schema).

4. **Onboarding backfill FK violation:** `20260320000001_onboarding_digest.sql` backfill INSERT tried `email_preferences` with `user_id` from memberships, but `auth.users` doesn't exist yet on fresh reset. Fixed with `JOIN auth.users u ON u.id = m.user_id` to produce 0 rows gracefully.

### Seed Fixes

5. **VAIO column names:** `voice_query_stats`, `gaps`, `issues` → `voice_queries_tracked`, `voice_citation_rate`, `voice_gaps`, `top_content_issues` (matching actual migration schema).

6. **Missing variables:** Section 19 DO block used `v_user_id` and `v_public_user_id` without declaring them. Added `v_user_id` (public.users.id for memberships FK) and `v_auth_user_id` (auth.users.id for activity_log/onboarding FK).

7. **Golden tenant fixture:** `has_outdoor_seating: true → false` (CNC has no patio). Updated in 5 locations in golden-tenant.ts + llms-txt-generator.test.ts.

### Key Lesson
**After `db reset`, delete `.next/` to clear `unstable_cache`.** The public menu page (`/m/[slug]`) uses `unstable_cache` with 1-hour TTL. A stale cached "not found" result persists across `db reset` because the cache lives in `.next/cache`, not in the DB.

---

## §190. Business Ground Truth Relevance Filter (2026-03-03)

**Problem:** Dashboard showed irrelevant recommendations — "brunch" queries for a dinner-only restaurant, "outdoor seating" for a business without a patio. Revenue calculator, digest emails, and sample data all included queries the business couldn't serve.

### Architecture — `lib/relevance/`

Pure-function relevance engine. Zero DB calls in the scoring path.

**Types** (`lib/relevance/types.ts`):
- `BusinessGroundTruth` — `hoursData`, `amenities`, `categories`, `operationalStatus`
- `QueryInput` — `queryText`, `queryCategory`, `occasionTag`
- `QueryRelevanceResult` — `verdict` (`relevant` | `not_applicable` | `aspirational`), `reason`, `confidence`

**Scoring** (`lib/relevance/query-relevance-filter.ts`):
- `scoreQueryRelevance(query, groundTruth)` — 6 rules in priority order:
  1. Comparison/custom queries → always relevant
  2. Closed businesses → everything not_applicable
  3. Time-of-day check (morning queries vs dinner-only hours)
  4. Amenity match (outdoor seating, parking, wifi, etc.)
  5. Service check (delivery, takeout, catering, etc.)
  6. Default → relevant (fail-open)
- `scoreQueriesBatch(queries, groundTruth)` — batch scoring
- `filterRelevantQueries(queries, groundTruth)` — returns only relevant + aspirational

**Ground Truth Fetcher** (`lib/relevance/get-ground-truth.ts`):
- `fetchLocationGroundTruth(supabase, locationId, orgId)` — single location
- `fetchPrimaryGroundTruth(supabase, orgId)` — primary location for org-level surfaces

### Wiring — 8 surfaces filtered

1. **Query seeding** (`lib/services/sov-seed.ts`) — filters `not_applicable` before INSERT. `LocationForSeed` extended with `hours_data`, `amenities`. All 4 call sites updated.
2. **SOV page** (`app/dashboard/share-of-voice/page.tsx`) — server-side relevance computation. Passes `relevanceMap` to `SovCard`.
3. **Gap labels** (`SovCard.tsx`) — "Not applicable" (slate) / "Aspirational" (amber) labels on each query row.
4. **Action suppression** (`SovCard.tsx`) — "Generate Brief" button hidden for `not_applicable` queries.
5. **Revenue calculator** (`lib/data/revenue-impact.ts`) — 6th parallel query fetches ground truth. Only relevant gaps count toward lost revenue.
6. **Digest emails** (`lib/digest/digest-service.ts`) — missed queries filtered through relevance before email.
7. **Chat assistant** (`lib/tools/visibility-tools.ts`) — new `getBusinessContext` tool (5th tool). System prompt instructs never suggesting actions that conflict with business capabilities.
8. **Sample data** (`lib/onboarding/sample-data.ts`) — replaced 4 irrelevant queries (outdoor seating, brunch, family friendly, catering) with universally applicable ones (date night, birthday dinner, great atmosphere, new restaurant).

### Profile nudge
SOV page shows "Complete your profile" banner when `hours_data` or `amenities` are null. `data-testid="ground-truth-nudge"`.

### Test impact
- 12 new tests in `sov-seed.test.ts` (ground truth filtering scenarios)
- 3 existing test files updated: `FirstMoverCard.test.tsx` (+useRouter mock), `revenue-impact-data.test.ts` (6th parallel query), `visibility-tools.test.ts` (4→5 tools)
- Zero regressions. 5745 tests passing, 376 files.

---
