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

## Local Development & Seeding
* Every time a new database table or major feature is created, you MUST update `supabase/seed.sql` to insert realistic mock data for that feature. Local development relies on `npx supabase db reset`, so the seed file must always represent the complete, current state of the app's test data.

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
    * Use the helper `current_user_org_id()` in SQL or `getAuthContext()` in Next.js API routes.
* **Auth Provider:** The `public.users` table links to Supabase Auth via `auth_provider_id` (UUID), NOT `id`.

## 4. 🧪 Testing Strategy ("Red-Green-Refactor")
* **Tests are the Spec:** When writing features, create the test file **FIRST** based on the requirements in Docs 04, 05, or 06.
* **Golden Tenant:** All tests must use the **Charcoal N Chill** fixture data defined in `src/__fixtures__/golden-tenant.ts`.
* **Mocking:** NEVER hit real external APIs (Perplexity, OpenAI, Stripe) in tests. Use MSW (Mock Service Worker) handlers.

## 5. 💰 Cost & Performance Guardrails
* **No API Calls on Load:** NEVER trigger an LLM API call (OpenAI/Perplexity) directly from a frontend page load. All AI operations must be:
    1.  Scheduled (Cron jobs)
    2.  User-initiated (Button click)
    3.  Cached (Served from Supabase DB).
* **Plan Gating:** Always check feature availability using the `PlanGate` component logic before rendering premium features (Competitor Intercept, Daily Audits).

## 6. 📂 Architecture & Stack
* **Framework:** Next.js 15 (App Router). Use Server Components by default.
* **Styling:** Tailwind CSS + shadcn/ui.
* **Routing:**
    * `app.localvector.ai` → Dashboard (Authenticated)
    * `menu.localvector.ai` → Public Magic Menus (Edge Cached, No Auth).
* **Edge Functions:** Use Supabase Edge Functions (Deno) for all cron jobs and long-running AI operations (e.g., `run-audits`, `refresh-google-data`).

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
- [ ] `docs/` updated if architecture, the core loop, or test strategy changed

---
> **End of System Instructions**