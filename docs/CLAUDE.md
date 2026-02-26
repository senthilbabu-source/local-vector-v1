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
- **Testing:** Vitest (unit/integration in `src/__tests__/`), Playwright (E2E in `tests/e2e/`, 18 specs)
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
app/(auth)/            — Auth pages (login, register, forgot-password, reset-password)
app/dashboard/         — Authenticated dashboard pages (each has error.tsx boundary)
app/dashboard/citations/     — Citation Gap Dashboard (Sprint 58A)
app/dashboard/page-audits/   — Page Audit Dashboard (Sprint 58B)
app/dashboard/ai-responses/  — AI Says Response Library (Sprint 69)
lib/schema-generator/        — Pure JSON-LD generators: FAQ, Hours, LocalBusiness (Sprint 70)
lib/ai/                — AI provider config, schemas, actions
lib/services/          — Pure business logic services
lib/autopilot/         — Content draft generation and publish pipeline
lib/page-audit/        — HTML parser + AEO auditor
lib/tools/             — AI chat tool definitions
lib/mcp/               — MCP server tool registrations
lib/supabase/database.types.ts — Full Database type (28 tables, 9 enums, Relationships)
supabase/migrations/   — Applied SQL migrations (20, timestamp-ordered)
supabase/prod_schema.sql — Full production schema dump
docs/                  — 50 spec documents (authoritative for planned features)
src/__tests__/         — Unit + integration tests
tests/e2e/             — Playwright E2E tests (18 specs)
```

## Database Tables (Key Ones)

| Table | Purpose |
|-------|---------|
| `organizations` | Tenant root — has `plan_tier`, `plan_status`, notification prefs (`notify_hallucination_alerts`, `notify_weekly_digest`, `notify_sov_alerts`) |
| `locations` | Business locations per org |
| `target_queries` | SOV query library per location |
| `sov_evaluations` | Per-query SOV results (engine, rank, competitors) |
| `visibility_analytics` | Aggregated SOV scores per snapshot date |
| `ai_hallucinations` | Detected hallucinations with severity + status tracking |
| `content_drafts` | AI-generated content awaiting human approval |
| `competitor_intercepts` | Head-to-head competitor analysis results |
| `local_occasions` | Seasonal event reference table |
| `citation_source_intelligence` | Which platforms AI actually cites per category (aggregate, not org-scoped) |
| `page_audits` | AEO page audit results per org (5 dimension scores + recommendations) |
| `google_oauth_tokens` | GBP OAuth credentials per org (service-role writes, authenticated SELECT) |
| `location_integrations` | Platform connections per location (Big 6 + listing URLs + WordPress `wp_username`/`wp_app_password`) |
| `cron_run_log` | Cron execution health log (cron_name, duration_ms, status, summary JSONB) — service-role only, no RLS policies |

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
12. `20260226000001_add_query_category.sql`
13. `20260226000002_autopilot_trigger_idempotency.sql`
14. `20260226000003_competitor_intercepts_rls_policies.sql`
15. `20260226000004_rls_audit_fixes.sql`
16. `20260226000005_seed_occasions_phase2.sql` — 12 new occasions (32 total)
17. `20260226000006_google_oauth_tokens_rls.sql` — org_isolation_select for authenticated, service-role-only writes
18. `20260226000007_wp_credentials.sql` — `wp_username`, `wp_app_password` columns on `location_integrations`
19. `20260226000008_cron_run_log.sql` — `cron_run_log` table for cron health logging (service-role only)
20. `20260226000009_notification_prefs.sql` — `notify_hallucination_alerts`, `notify_weekly_digest`, `notify_sov_alerts` columns on `organizations`

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
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
```

---

## Key Engines (Built)

| Engine | Spec | Purpose |
|--------|------|---------|
| Fear Engine | `docs/04-INTELLIGENCE-ENGINE.md` | Hallucination detection across AI search |
| Greed Engine | `docs/04-INTELLIGENCE-ENGINE.md §3` | Competitor intercept analysis |
| SOV Engine | `docs/04c-SOV-ENGINE.md` | Share-of-voice tracking across AI models |
| Autopilot Engine | `docs/19-AUTOPILOT-ENGINE.md` | Content draft generation → HITL approval → publish pipeline |
| Occasion Engine | `docs/16-OCCASION-ENGINE.md` | Seasonal content opportunities |
| Prompt Intelligence | `docs/15-LOCAL-PROMPT-INTELLIGENCE.md` | Query gap detection (untracked, competitor-discovered, zero-citation) |
| Citation Intelligence | `docs/05-API-CONTRACT.md §14-15` | Platform citation tracking |
| Content Grader | `docs/17-CONTENT-GRADER.md` | AEO page audit (5 scoring dimensions) |
| Schema Fix Generator | `lib/schema-generator/` | Generate JSON-LD (FAQ, Hours, LocalBusiness) from ground truth |

## Build History

See `DEVLOG.md` (project root) and `docs/DEVLOG.md` for the complete sprint-by-sprint build log. Current sprint: 70.
