# CLAUDE.md — LocalVector V1 Project Context

## Project Overview

LocalVector is an AEO/GEO SaaS platform that helps local businesses monitor and improve their visibility in AI-generated answers (ChatGPT, Perplexity, Gemini, etc.). Built with Next.js 16 (App Router), TypeScript, Supabase/PostgreSQL, and the Vercel AI SDK.

## Tech Stack

- **Framework:** Next.js 16, React 19, TypeScript
- **Database:** Supabase (PostgreSQL) with RLS via `current_user_org_id()`
- **AI:** Vercel AI SDK (`ai` package) with OpenAI, Perplexity, Anthropic, Google providers — configured in `lib/ai/providers.ts`
- **Billing:** Stripe webhooks → `organizations.plan_tier` enum (`trial | starter | growth | agency`)
- **Email:** Resend + React Email (`emails/`)
- **Cache:** Upstash Redis (`lib/redis.ts`) — optional, all callers must degrade gracefully
- **Testing:** Vitest (unit/integration in `src/__tests__/`), Playwright (E2E in `tests/e2e/`)
- **Monitoring:** Sentry (client, server, edge configs)

## Architecture Rules

- **Database is the source of truth.** `supabase/prod_schema.sql` is the canonical schema. All migrations in `supabase/migrations/` are applied in timestamp order.
- **Services are pure.** Files in `lib/services/` never create their own Supabase client — callers pass one in. This lets the same service work with RLS-scoped clients (user actions) and service-role clients (cron routes).
- **Plan gating lives in `lib/plan-enforcer.ts`.** Always check feature availability before rendering premium UI or executing paid-tier operations.
- **AI providers are centralized.** Never call AI APIs directly — use `getModel(key)` from `lib/ai/providers.ts`. Mock fallbacks activate when API keys are absent.
- **RLS pattern:** Every tenant-scoped table has `org_isolation_select/insert/update/delete` policies using `org_id = public.current_user_org_id()`.
- **Cron routes** live in `app/api/cron/` and require `Authorization: Bearer <CRON_SECRET>` header. Each has a kill switch env var.

## Key Directories

```
app/api/cron/          — Automated pipelines (sov, audit, content-audit)
app/dashboard/         — Authenticated dashboard pages
lib/ai/                — AI provider config, schemas, actions
lib/services/          — Pure business logic services
lib/page-audit/        — HTML parser + AEO auditor
lib/tools/             — AI chat tool definitions
lib/mcp/               — MCP server tool registrations
supabase/migrations/   — Applied SQL migrations (timestamp-ordered)
supabase/prod_schema.sql — Full production schema dump
docs/                  — Spec documents (authoritative for planned features)
src/__tests__/         — Unit + integration tests
tests/e2e/             — Playwright E2E tests
```

## Database Tables (Key Ones)

| Table | Purpose |
|-------|---------|
| `organizations` | Tenant root — has `plan_tier`, `plan_status` |
| `locations` | Business locations per org |
| `target_queries` | SOV query library per location |
| `sov_evaluations` | Per-query SOV results (engine, rank, competitors) |
| `visibility_analytics` | Aggregated SOV scores per snapshot date |
| `ai_hallucinations` | Detected hallucinations with severity + status tracking |
| `content_drafts` | AI-generated content awaiting human approval |
| `competitor_intercepts` | Head-to-head competitor analysis results |
| `local_occasions` | Seasonal event reference table |
| `citation_source_intelligence` | Which platforms AI actually cites per category |

## Current Migrations (Applied)

1. `20260218000000_initial_schema.sql` — Core tables + RLS
2. `20260220000001_create_menu_categories.sql`
3. `20260221000001_public_menu_reads.sql`
4. `20260221000002_create_integrations.sql`
5. `20260221000003_create_ai_evaluations.sql`
6. `20260221000004_create_sov_tracking.sql` — Creates `target_queries` and `sov_evaluations`
7. `20260223000001_add_gpt4o_mini_model_provider.sql`
8. `20260224000001_content_pipeline.sql` — `content_drafts`, `page_audits`, `local_occasions`, `citation_source_intelligence`
9. `20260224000002_gbp_integration.sql`
10. `20260224000003_listing_url_column.sql`
11. `20260225000001_revenue_leak.sql` — `revenue_config`, `revenue_snapshots`

## Testing Commands

```bash
npm test                    # Run all Vitest tests
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:coverage       # With coverage report
npx playwright test         # E2E tests
```

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY, PERPLEXITY_API_KEY, ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY
CRON_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
```

---

## ~~CRITICAL BUG~~ RESOLVED: `query_category` Column Added to `target_queries`

> **Status: FIXED** (2026-02-25) — Migration `20260226000001_add_query_category.sql` applied.
> Columns added: `query_category VARCHAR(50) NOT NULL DEFAULT 'discovery'`, `occasion_tag`, `intent_modifier`.
> Tests: `cron-sov.test.ts` (11 passing), `sov-engine-service.test.ts` (11 passing).
> First Mover Alerts now fire correctly for discovery/occasion/near_me queries.

### The Problem (original)

The SOV engine service (`lib/services/sov-engine.service.ts`) defines `SOVQueryInput` with a `query_category` field and uses it in two critical places:

**1. Interface definition (line ~30):**
```typescript
export interface SOVQueryInput {
  id: string;
  query_text: string;
  query_category: string;  // ← Referenced but column doesn't exist in DB
  location_id: string;
  org_id: string;
  // ...
}
```

**2. First Mover Alert filtering (inside `writeSOVResults()`):**
```typescript
const firstMoverOpps = results.filter(
  (r) =>
    !r.ourBusinessCited &&
    r.businessesFound.length === 0 &&
    ['discovery', 'occasion', 'near_me'].includes(r.queryCategory),
);
```

**3. SOV cron route (`app/api/cron/sov/route.ts`) queries `target_queries` but the SELECT doesn't include `query_category` because it doesn't exist:**
```typescript
const { data: queries } = await supabase
  .from('target_queries')
  .select(`id, query_text, location_id, org_id, locations(...), organizations(...)`)
```

### Root Cause

The spec document `docs/20260223000001_sov_engine.sql` defines an enriched `sov_target_queries` table with:
- `query_category VARCHAR(50) NOT NULL CHECK (query_category IN ('discovery', 'comparison', 'occasion', 'near_me', 'custom'))`
- `occasion_tag VARCHAR(50) NULL`
- `intent_modifier VARCHAR(50) NULL`
- `is_system_generated BOOLEAN NOT NULL DEFAULT TRUE`

This planned migration was **never applied**. The actual `target_queries` table (created in migration `20260221000004`) only has: `id, org_id, location_id, query_text, created_at`.

### Impact

- `query_category` is always `undefined` at runtime
- First Mover Alerts **never match** because `undefined` is not in `['discovery', 'occasion', 'near_me']`
- `content_drafts` rows with `trigger_type='first_mover'` are never created
- The SOV cron runs without errors but silently skips the most valuable feature

### Fix Required

**Files that need changes:**

1. **New migration file** `supabase/migrations/20260226000001_add_query_category.sql`:
   - `ALTER TABLE public.target_queries ADD COLUMN query_category VARCHAR(50) NOT NULL DEFAULT 'discovery'`
   - Add CHECK constraint: `IN ('discovery', 'comparison', 'occasion', 'near_me', 'custom')`
   - Optionally add `occasion_tag VARCHAR(50) NULL` and `intent_modifier VARCHAR(50) NULL`
   - Backfill existing rows with `'discovery'` (safe default)
   - Add RLS policies if not inherited from existing table policies

2. **`app/api/cron/sov/route.ts`** — Update the SELECT to include `query_category`:
   ```typescript
   .select(`id, query_text, query_category, location_id, org_id, locations(...), organizations(...)`)
   ```

3. **`lib/services/sov-engine.service.ts`** — Already correct (references `query_category`), just needs the DB column to exist

4. **`lib/services/sov-seed.ts`** — Check if the seeding logic sets `query_category` when creating target queries for new locations

5. **Update `supabase/prod_schema.sql`** — Regenerate or manually add the column to keep the schema dump in sync

6. **Update/add tests:**
   - `src/__tests__/unit/cron-sov.test.ts` — Verify `query_category` flows through
   - `src/__tests__/unit/sov-engine-service.test.ts` — Test First Mover filtering with category values

### Validation

After applying the fix:
- `npm run test:unit` should pass (especially `cron-sov.test.ts` and `sov-engine-service.test.ts`)
- The SOV cron should produce `content_drafts` rows with `trigger_type='first_mover'` when a query has no business cited and no competitors found
- Run locally: `curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/sov` and check `summary.first_mover_alerts > 0`

### Reference Documents

- `docs/04c-SOV-ENGINE.md` — SOV Engine spec (§4 for cron, §6.1 for First Mover Alerts)
- `docs/15-LOCAL-PROMPT-INTELLIGENCE.md` — Query taxonomy (§2 for all 5 categories)
- `docs/20260223000001_sov_engine.sql` — Planned enriched schema (never migrated)
- `docs/AI_RULES.md` — Project-wide coding conventions
