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

---
> **End of System Instructions**