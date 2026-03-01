# CLAUDE.md — LocalVector V1 Project Context

## Project Overview

LocalVector is an AEO/GEO SaaS platform that helps local businesses monitor and improve their visibility in AI-generated answers (ChatGPT, Perplexity, Gemini, Copilot, etc.). Built with Next.js 16 (App Router), TypeScript, Supabase/PostgreSQL, and the Vercel AI SDK.

## Tech Stack

- **Framework:** Next.js 16, React 19, TypeScript
- **Database:** Supabase (PostgreSQL) with RLS via `current_user_org_id()`
- **AI:** Vercel AI SDK (`ai` package) with OpenAI, Perplexity, Anthropic, Google providers — configured in `lib/ai/providers.ts`
- **Billing:** Stripe webhooks → `organizations.plan_tier` enum (`trial | starter | growth | agency`)
- **Email:** Resend + React Email (`emails/`)
- **Cache:** Upstash Redis (`lib/redis.ts`) — optional, all callers must degrade gracefully
- **Testing:** Vitest (unit/integration in `src/__tests__/`), Playwright (E2E in `tests/e2e/`, 30 specs). Current: 3415 tests, 248 files.
- **Monitoring:** Sentry (client, server, edge configs) — all catch blocks instrumented (Sprint A, AI_RULES §70)

## Architecture Rules

- **Database is the source of truth.** `supabase/prod_schema.sql` is the canonical schema. All migrations in `supabase/migrations/` are applied in timestamp order.
- **Services are pure.** Files in `lib/services/` never create their own Supabase client — callers pass one in. This lets the same service work with RLS-scoped clients (user actions) and service-role clients (cron routes).
- **Plan gating lives in `lib/plan-enforcer.ts`.** Always check feature availability before rendering premium UI or executing paid-tier operations.
- **Plan display names live in `lib/plan-display-names.ts`.** Never inline plan tier display logic (e.g., `capitalize(plan)`) — always use `getPlanDisplayName()`. Maps: trial→The Audit, starter→Starter, growth→AI Shield, agency→Brand Fortress, null→Free. (AI_RULES §71)
- **AI providers are centralized.** Never call AI APIs directly — use `getModel(key)` from `lib/ai/providers.ts`. Mock fallbacks activate when API keys are absent.
- **RLS pattern:** Every tenant-scoped table has `org_isolation_select/insert/update/delete` policies using `org_id = public.current_user_org_id()`.
- **Cron routes** live in `app/api/cron/` and require `Authorization: Bearer <CRON_SECRET>` header. Each has a kill switch env var.

## Key Directories

```
app/api/cron/          — Automated pipelines (sov, audit, content-audit, weekly-digest, correction-follow-up, benchmarks)
app/(auth)/            — Auth pages (login, register, forgot-password, reset-password)
app/dashboard/         — Authenticated dashboard pages (each has error.tsx boundary)
app/dashboard/citations/     — Citation Gap Dashboard (Sprint 58A)
app/dashboard/page-audits/   — Page Audit Dashboard (Sprint 58B)
app/dashboard/ai-responses/  — AI Says Response Library (Sprint 69)
app/dashboard/crawler-analytics/ — Bot Activity Dashboard (Sprint 73)
app/dashboard/system-health/ — System Health / Cron Dashboard (Sprint 76)
app/dashboard/proof-timeline/ — Before/After Proof Timeline (Sprint 77)
app/dashboard/entity-health/ — Entity Knowledge Graph Health Monitor (Sprint 80)
app/dashboard/sentiment/     — AI Sentiment Tracker (Sprint 81)
app/dashboard/source-intelligence/ — Citation Source Intelligence (Sprint 82)
app/dashboard/content-calendar/  — Proactive Content Calendar (Sprint 83)
app/dashboard/agent-readiness/   — AI Agent Readiness Score (Sprint 84)
app/dashboard/revenue-impact/    — Revenue Impact Calculator (Sprint 85)
app/dashboard/share-of-voice/   — SOV page + Content Brief Generator (Sprint 86)
app/dashboard/cluster-map/     — AI Visibility Cluster Map (Sprint 87)
app/dashboard/settings/team/  — Team Management page (Sprint 98)
app/(public)/invite/[token]/  — Invite acceptance page (Sprint 98)
app/admin/                    — Admin dashboard: customers, API usage, cron health, revenue (Sprint D)
app/onboarding/connect/       — GBP OAuth interstitial + location picker (Sprint 89)
lib/industries/              — Industry config SSOT: getIndustryConfig(), 4 verticals (Sprint E, §85)
lib/schema-generator/        — Pure JSON-LD generators: FAQ, Hours, LocalBusiness, ReserveAction, OrderAction, Medical/Dental (Sprint 70/84/E)
lib/ai/                — AI provider config, schemas, actions
lib/services/          — Pure business logic services
lib/autopilot/         — Content draft generation and publish pipeline
lib/page-audit/        — HTML parser + AEO auditor
lib/tools/             — AI chat tool definitions
lib/auth/              — Role enforcement (org-roles.ts: roleSatisfies, assertOrgRole, ROLE_PERMISSIONS)
lib/plan-display-names.ts — Plan tier display name SSOT (Sprint A, AI_RULES §71)
lib/sample-data/          — Sample data mode: sample-dashboard-data.ts + use-sample-mode.ts (Sprint B, §72)
lib/tooltip-content.tsx   — InfoTooltip content SSOT: 10 metric tooltip entries (Sprint B, §73)
lib/plan-feature-matrix.ts — Plan feature comparison matrix: 24 rows, 6 categories (Sprint B, §75)
lib/integrations/platform-config.ts — Platform sync type SSOT: real_oauth/manual_url/coming_soon (Sprint C, §76)
lib/stripe/get-monthly-cost-per-seat.ts — Stripe per-seat cost fetch (Sprint C, §78)
lib/credits/credit-limits.ts  — Plan credit limits SSOT: trial=25, starter=100, growth=500, agency=2000 (Sprint D, §82)
lib/credits/credit-service.ts — Credit check/consume service, fail-open design (Sprint D, §82)
lib/ai-preview/model-queries.ts — AI Answer Preview: batch (queryOpenAI/Perplexity/Gemini) + streaming (streamOpenAI/Perplexity/Gemini) (Sprint F+N, §90/§117)
lib/services/correction-verifier.service.ts — Correction follow-up verifier: checkCorrectionStatus, extractKeyPhrases (Sprint F, §91)
lib/data/benchmarks.ts        — Benchmark data layer: fetchBenchmark for city+industry comparison (Sprint F, §92)
lib/entity-health/platform-descriptions.ts — Platform jargon→consequence translation layer (Sprint J, §105)
lib/agent-readiness/scenario-descriptions.ts — Capability jargon→scenario translation layer (Sprint J, §106)
lib/admin/format-relative-date.ts — Intl.RelativeTimeFormat utility for admin pages (Sprint D, §81)
lib/mcp/               — MCP server tool registrations
lib/supabase/database.types.ts — Full Database type (33 tables, 9 enums, Relationships)
supabase/migrations/   — Applied SQL migrations (42, timestamp-ordered)
supabase/prod_schema.sql — Full production schema dump
docs/                  — 50 spec documents (authoritative for planned features)
src/__tests__/         — Unit + integration tests
tests/e2e/             — Playwright E2E tests (30 specs)
app/api/ai-preview/    — AI Answer Preview SSE endpoint (Sprint F, §90)
app/dashboard/ai-responses/_components/ — AIAnswerPreviewWidget (Sprint F)
app/dashboard/_components/BenchmarkComparisonCard.tsx — City benchmark comparison (Sprint F, §92)
```

## Database Tables (Key Ones)

| Table | Purpose |
|-------|---------|
| `organizations` | Tenant root — has `plan_tier`, `plan_status`, `industry` (text, default 'restaurant' — Sprint E), notification prefs (`notify_hallucination_alerts`, `notify_weekly_digest`, `notify_sov_alerts`, `notify_score_drop_alert`, `notify_new_competitor` — Sprint B+N), AI monitoring prefs (`monitored_ai_models text[]`, `score_drop_threshold integer`, `webhook_url text`, `scan_day_of_week integer` — Sprint B+N) |
| `locations` | Business locations per org. Revenue config: `avg_customer_value` (numeric, default 55), `monthly_covers` (integer, default 1800) |
| `api_credits` | Per-org monthly API credit tracking. One active row per org (unique on `org_id`). `credits_used`, `credits_limit`, `reset_date`, `plan`. RLS: users can SELECT own org's credits via memberships join. `increment_credits_used()` RPC for atomic increment. (Sprint D) |
| `target_queries` | SOV query library per location. Columns: `query_category` (discovery/comparison/occasion/near_me/custom), `occasion_tag`, `intent_modifier`, `is_active` (soft-disable toggle). UNIQUE on `(location_id, query_text)`. |
| `sov_evaluations` | Per-query SOV results (engine, rank, competitors, `sentiment_data` JSONB, `source_mentions` JSONB) |
| `visibility_analytics` | Aggregated SOV scores per snapshot date |
| `ai_hallucinations` | Detected hallucinations with severity + status tracking. Sprint F columns: `correction_query`, `verifying_since`, `follow_up_checked_at`, `follow_up_result` |
| `benchmarks` | Pre-computed city+industry Reality Score averages. UNIQUE(city, industry). RLS: authenticated SELECT. Populated by weekly `compute_benchmarks()` RPC (Sprint F) |
| `content_drafts` | AI-generated content awaiting human approval |
| `competitor_intercepts` | Head-to-head competitor analysis results |
| `local_occasions` | Seasonal event reference table |
| `citation_source_intelligence` | Which platforms AI actually cites per category (aggregate, not org-scoped) |
| `page_audits` | AEO page audit results per org (5 dimension scores: answer_first, schema_completeness, faq_schema, keyword_density/aeo_readability, entity_clarity + recommendations with dimensionKey/schemaType) |
| `google_oauth_tokens` | GBP OAuth credentials per org (service-role writes, authenticated SELECT) |
| `location_integrations` | Platform connections per location (Big 6 + listing URLs + WordPress `wp_username`/`wp_app_password`) |
| `memberships` | Org membership per user — role (owner/admin/member/viewer), invited_by, joined_at. RLS: `memberships_org_isolation_select/insert/update/delete` via `current_user_org_id()` (added FIX-2). UNIQUE(user_id, org_id). |
| `pending_invitations` | Token-based invitation tracking — email, role, token (unique 32-byte hex), status (pending/accepted/revoked/expired), expires_at (7 days). RLS: org-scoped via `current_user_org_id()`. UNIQUE(org_id, email). |
| `cron_run_log` | Cron execution health log (cron_name, duration_ms, status, summary JSONB) — service-role only, no RLS policies |
| `crawler_hits` | AI bot visit log per magic menu page — bot_type, user_agent, crawled_at. RLS: org_isolation_select + service_role_insert. Columns: org_id, menu_id, location_id, bot_type, user_agent |
| `entity_checks` | Entity presence across 7 AI knowledge graph platforms per location. 7 status columns (confirmed/missing/unchecked/incomplete), `platform_metadata` JSONB, `entity_score` integer. Full org RLS. |

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
21. `20260227000001_page_audit_dimensions.sql` — `faq_schema_score`, `entity_clarity_score` columns on `page_audits`
22. `20260227000002_crawler_hits_location_id.sql` — `location_id` column on `crawler_hits` + backfill + composite index
23. `20260227000003_sov_cited_sources.sql` — `cited_sources JSONB` column on `sov_evaluations` for Google AI Overview citation sources
24. `20260227000004_hallucination_correction_trigger.sql` — Adds `hallucination_correction` to `content_drafts.trigger_type` CHECK constraint
25. `20260228000001_entity_checks.sql` — `entity_checks` table: 7 platform status columns, `platform_metadata` JSONB, `entity_score`, full RLS
26. `20260226000010_sentiment_data.sql` — `sentiment_data` JSONB column on `sov_evaluations` + partial index
27. `20260226000011_source_mentions.sql` — `source_mentions` JSONB column on `sov_evaluations`
28. `20260226000012_revenue_config.sql` — `avg_customer_value` (numeric) + `monthly_covers` (integer) columns on `locations`
29. `20260228000002_sov_phase5_cleanup.sql` — `is_active` column + `UNIQUE(location_id, query_text)` constraint on `target_queries`, duplicate dedup
30. `20260301000001_add_llms_txt_updated_at.sql` — `llms_txt_updated_at` column on `locations`
31. `20260301000002_multi_user_foundation.sql` — `pending_invitations` table + `invited_by`/`joined_at` columns on `memberships` + RLS + indexes
32. `20260301000003_seat_billing_location_permissions.sql` — `seat_limit`/`seat_overage_count`/`seat_overage_since` on `organizations` + `location_permissions` table
33. `20260302000001_multi_location_management.sql` — `is_archived`/`display_name`/`timezone`/`location_order` on `locations`
34. `20260302000002_occasion_snooze_sidebar_badges.sql` — `occasion_snoozes` + `sidebar_badge_state` tables
35. `20260303000001_memberships_rls.sql` — ENABLE RLS + 4 org isolation policies on `memberships` (FIX-2)
36. `20260304000001_sprint_b_settings_expansion.sql` — `monitored_ai_models text[]`, `score_drop_threshold integer`, `webhook_url text` on `organizations` (Sprint B)
37. `20260305000001_clear_false_integrations.sql` — Reset false 'connected' statuses for non-google/non-wordpress platforms to 'disconnected' (Sprint C)
38. `20260306000001_api_credits.sql` — `api_credits` table for per-org monthly credit tracking + `increment_credits_used()` RPC + RLS (Sprint D)
39. `20260307000001_orgs_industry.sql` — `industry text DEFAULT 'restaurant'` column on `organizations` for multi-vertical support (Sprint E)
40. `20260308000001_sprint_f_engagement.sql` — N3: `correction_query`, `verifying_since`, `follow_up_checked_at`, `follow_up_result` on `ai_hallucinations`. N4: `benchmarks` table + RLS + `compute_benchmarks()` RPC (Sprint F)
41. `20260309000001_listing_verification.sql` — `verified_at`, `verification_result` (JSONB), `has_discrepancy` (boolean) on `location_integrations` (Sprint L)
42. `20260310000001_sprint_n_settings.sql` — `scan_day_of_week integer`, `notify_score_drop_alert boolean`, `notify_new_competitor boolean` on `organizations` (Sprint N)

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
ADMIN_EMAILS
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
| AI Health Score | `lib/services/ai-health-score.service.ts` | Composite 0–100 score from SOV + page audit + hallucinations + schema. Pure function, no I/O. |
| Crawler Analytics | `lib/crawler/bot-detector.ts` + `lib/data/crawler-analytics.ts` | AI bot detection registry (10 bots) + visit aggregation + blind spot detection. Wired via `proxy.ts` fire-and-forget → `POST /api/internal/crawler-log`. |
| Correction Generator | `lib/services/correction-generator.service.ts` | Pure, deterministic correction content from ground truth (no AI calls). Generates GBP post, website snippet, llms.txt entry, social post per hallucination. Uses `trigger_type='hallucination_correction'` in `content_drafts`. |
| Freshness Alerts | `lib/services/freshness-alert.service.ts` + `lib/data/freshness-alerts.ts` | Detects citation_rate drops across consecutive visibility_analytics snapshots. >20% = warning, >40% = critical. Email via `sendFreshnessAlert()`. Wired into SOV cron (both Inngest + inline). |
| System Health | `lib/services/cron-health.service.ts` + `lib/data/cron-health.ts` | Dashboard for `cron_run_log` table. Pure service transforms rows → per-job stats + overall status (healthy/degraded/failing). Uses `createServiceRoleClient()` (no user RLS). UI at `/dashboard/system-health`. |
| Proof Timeline | `lib/services/proof-timeline.service.ts` + `lib/data/proof-timeline.ts` | Before/After timeline correlating user actions with outcomes. 8 event types from 5 existing tables (visibility_analytics, page_audits, content_drafts, crawler_hits, ai_hallucinations). Pure service, 90-day window. UI at `/dashboard/proof-timeline`. |
| Weekly Digest Email | `lib/services/weekly-digest.service.ts` + `lib/data/weekly-digest.ts` + `lib/email/send-digest.ts` | Weekly AI Snapshot digest via Resend + React Email. Cron → Inngest fan-out → per-org data gather → render → send. Shows Health Score trend, SOV delta, hallucination issues, wins, opportunities, bot activity. Deterministic — no AI calls. Kill switch: `STOP_DIGEST_CRON`. Template: `emails/weekly-digest.tsx`. |
| Entity Health | `lib/services/entity-health.service.ts` + `lib/services/entity-auto-detect.ts` + `lib/data/entity-health.ts` | Tracks entity presence across 7 AI knowledge graph platforms (Google KP, GBP, Yelp, TripAdvisor, Apple Maps, Bing Places, Wikidata). Auto-detects Google/GBP/Yelp from existing data; user self-assesses the rest via checklist. Score = N/6 core platforms confirmed (Wikidata excluded). Pure service, no AI calls. |
| Sentiment Tracker | `lib/services/sentiment.service.ts` + `lib/data/sentiment.ts` | Extracts per-evaluation sentiment from SOV raw responses via `generateObject` + `SentimentExtractionSchema`. Scores -1 to 1, label/tone/descriptors/recommendation_strength. Aggregates into dashboard summaries with per-engine breakdown. Integrated into SOV cron pipeline (Inngest + inline). UI at `/dashboard/sentiment`. |
| Source Intelligence | `lib/services/source-intelligence.service.ts` + `lib/data/source-intelligence.ts` | Identifies which web pages AI engines cite when describing the business. Two data paths: structured `cited_sources` (Google/Perplexity) + AI-extracted `source_mentions` (OpenAI/Copilot via gpt-4o-mini). Pure analysis: categorize, deduplicate, rank, generate alerts (competitor content, low first-party rate, over-reliance). UI at `/dashboard/source-intelligence`. |
| Content Calendar | `lib/services/content-calendar.service.ts` + `lib/data/content-calendar.ts` | Proactive content publishing calendar. Aggregates 5 signal sources (occasions, SOV gaps, page freshness, competitor gaps, hallucination corrections) into urgency-scored, time-bucketed recommendations. Pure service, no AI calls, no new tables. UI at `/dashboard/content-calendar`. |
| Agent Readiness (AAO) | `lib/services/agent-readiness.service.ts` + `lib/data/agent-readiness.ts` + `lib/schema-generator/action-schema.ts` | AI Agent Readiness Score (0-100). Evaluates 6 weighted capabilities: structured hours (15pts), menu schema (15pts), ReserveAction (25pts), OrderAction (25pts), accessible CTAs (10pts), CAPTCHA-free flows (10pts). Pure service + ReserveAction/OrderAction JSON-LD generators. No external API calls in V1. UI at `/dashboard/agent-readiness`. |
| Revenue Impact Calculator | `lib/services/revenue-impact.service.ts` + `lib/data/revenue-impact.ts` | Converts visibility gaps into estimated dollar amounts. Three revenue streams: SOV gaps (missed AI-assisted visits via category search volumes x CTR), hallucination deterrence (severity-based customer impact), competitor advantage (diverted covers). User-customizable `avg_customer_value` + `monthly_covers` on `locations`. All deterministic math, no AI calls. No plan gating — dollar amounts drive Trial conversion. UI at `/dashboard/revenue-impact`. |
| Content Brief Generator | `lib/services/content-brief-builder.service.ts` + `lib/services/content-brief-generator.service.ts` | Two-layer SOV gap → content brief pipeline. Layer 1 (pure): slug, title tag, H1, schema recommendations, llms.txt. Layer 2 (AI): `generateObject` with gpt-4o-mini + `ContentBriefSchema` for answer capsule, outline sections, FAQ questions. Triggered from SOV page via `generateContentBrief()` server action. Saves to `content_drafts` with `trigger_type='prompt_missing'`. Fallback: structure-only brief when no API key. |
| Cluster Map | `lib/services/cluster-map.service.ts` + `lib/data/cluster-map.ts` | Scatter plot visualization: Brand Authority (X) × Fact Accuracy (Y) × SOV bubble size. Hallucination fog overlay from Fear Engine (severity-scaled red zones). Engine toggle for per-AI-model view (Perplexity/ChatGPT/Gemini/Copilot). Pure service, no AI calls, no new tables — aggregates from sov_evaluations + ai_hallucinations + visibility_analytics. Recharts ScatterChart with custom dot renderer. UI at `/dashboard/cluster-map`. |
| GBP Mapper | `docs/RFC_GBP_ONBOARDING_V2_REPLACEMENT.md` | Maps GBP API responses to LocalVector location rows. Pure functions: `mapGBPLocationToRow()` + `mapGBPHours()`. Auto-import (1 loc) or cookie-pointer picker (2+ locs). Onboarding interstitial at `/onboarding/connect`. |
| Multi-User Roles | `lib/auth/org-roles.ts` | Role hierarchy (viewer/member=0, admin=1, owner=2) + `roleSatisfies()` + `assertOrgRole()` + `ROLE_PERMISSIONS` matrix. Token-based invitation flow via `pending_invitations` table. Team management at `/dashboard/settings/team`. Invite acceptance at `/invite/[token]`. Agency plan required for multi-user. |
| Admin Dashboard | `app/admin/` | Operator visibility into customers, API usage, cron health, revenue. Auth guard via `ADMIN_EMAILS` env var. Uses `createServiceRoleClient()` for cross-org queries. 4 pages + shared components. |
| Credit System | `lib/credits/credit-service.ts` + `lib/credits/credit-limits.ts` | Per-org monthly API credit limits. `checkCredit()` → LLM call → `consumeCredit()` pattern. Fail-open design. Auto-init + auto-reset. 6 credit-gated actions. Credits meter in TopBar. |
| AI Answer Preview | `lib/ai-preview/model-queries.ts` + `app/api/ai-preview/route.ts` | On-demand query preview across 3 AI models (ChatGPT, Perplexity, Gemini). True token-by-token SSE streaming via `streamText()` + async generators (Sprint N enhancement). Credit-gated (1 credit/run). Stop button with AbortController. Widget at `/dashboard/ai-responses`. |
| Correction Verifier | `lib/services/correction-verifier.service.ts` | Re-queries original AI model after 14 days to check if hallucination was corrected. Substring match on key phrases (phone, time, address, dollar). Used by daily correction-follow-up cron. Sprint N: sends `sendCorrectionFollowUpAlert()` email on fixed/recurring result. |
| Benchmark Comparison | `lib/data/benchmarks.ts` + `app/api/cron/benchmarks/route.ts` | Weekly city+industry Reality Score aggregation via `compute_benchmarks()` RPC. Dashboard card shows org vs city average when 10+ businesses exist. |

## Recent Fix Sprints

### Sprint FIX-1 — Schema Types Regeneration (2026-02-27)
- `lib/supabase/database.types.ts` — Regenerated. Sprint 99-101 tables now typed.
- `supabase/prod_schema.sql` — Verified aligned with all migrations.
- Removed `(supabase as any)` casts from occasion-feed, badge-counts, occasions actions.
- Fixed Stripe SDK v20 `quantity` → `items[].quantity` in seat-manager.
- Fixed PlanGate import (default → named), active-org role null coalesce.
- Tests: 12 Vitest (type-guard regression suite in `database-types-completeness.test.ts`)
- Result: 0 TS errors (was 41), 2555 tests pass, 179 files.

### Sprint FIX-2 — Security Hardening (2026-02-27)
- npm audit fix: `@modelcontextprotocol/sdk` 1.27.1, `minimatch` 9.0.9, `rollup` 4.59.0 — 0 HIGH vulnerabilities remaining.
- `supabase/migrations/20260303000001_memberships_rls.sql` — ENABLE RLS + 4 org isolation policies on `memberships` table.
- `supabase/prod_schema.sql` — Updated with memberships RLS.
- `local_occasions` assessed as global table (no `org_id` column) — no RLS needed.
- AI_RULES: added §56 (security maintenance rules).
- Tests: 12 Vitest (`memberships-rls.test.ts`), 3 Vitest (`npm-audit.test.ts`)
- Result: 0 HIGH npm vulns (was 3), 2570 tests pass, 181 files.

### Sprint FIX-3 — Missing Cron Registration + Baseline Clock Start (2026-02-27)
- `vercel.json` — Added 4 missing cron entries: audit (`0 8 * * *`), sov (`0 7 * * 0`), citation (`0 10 * * *`), content-audit (`0 8 1 * *`). All 7 crons now registered.
- All 4 routes verified: CRON_SECRET auth guard + kill switch already present.
- PlanGate import in locations/page.tsx verified as already correct (named import).
- AI_RULES: added §65 (cron registration completeness), §66 (named exports rule).
- Tests: 14 Vitest (`vercel-cron-config.test.ts`), 10 Vitest (`cron-auth-guard.test.ts`), 4 Vitest (`plan-gate-imports.test.ts`)
- SOV baseline clock started: 2026-02-27. Sprint 107 earliest: 2026-03-27. Sprint 109 earliest: 2026-04-24.
- Result: All crons operational, 2598 tests pass, 184 files.

### Sprint FIX-4 — Operational Hardening (2026-02-27)
- `.env.local.example` — Completed with 17 missing env vars (CRON_SECRET, GOOGLE_CLIENT_ID/SECRET, ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, UPSTASH_REDIS_REST_URL/TOKEN, 7 STOP_*_CRON kill switches, 3 STRIPE_PRICE_ID_*).
- `app/api/chat/route.ts` — Added Upstash sliding window rate limiting (20 req/hr/org). Fail-open pattern, 429 with retry headers, module-level Redis init.
- `@upstash/ratelimit` added as dependency.
- `cron-auth-guard.test.ts` — Extended with 3 kill switch tests (13 total).
- AI_RULES: added §67 (env var documentation), §68 (rate limiting for AI endpoints).
- Tests: 15 Vitest (`env-completeness.test.ts`), 10 Vitest (`chat-rate-limit.test.ts`), 3 Vitest (kill switch additions to `cron-auth-guard.test.ts`)
- Result: 0 undocumented env vars, chat rate-limited, 2626 tests pass, 186 files.

### Sprint FIX-5 — E2E Coverage for Sprints 98-101 (2026-02-27)
- 4 Playwright spec files covering Sprints 98-101 features (multi-user, billing, locations, occasions).
- `tests/e2e/19-multi-user-invitations.spec.ts` — 12 tests: team page render, members table, owner role, plan gate, invite form, invite accept.
- `tests/e2e/20-seat-billing.spec.ts` — 12 tests: pricing tiers, plan badge, seat card visibility, demo checkout, success/canceled banners.
- `tests/e2e/21-multi-location-management.spec.ts` — 14 tests: PlanGate regression guard, location cards, primary badge, overflow menu, add/edit buttons, switcher.
- `tests/e2e/22-occasion-alerts-badges.spec.ts` — 13 tests: dashboard feed, alert card structure, snooze dropdown, sidebar badges, cross-user isolation.
- Conditional `test.skip()` pattern for RLS-empty data (memberships, locations, occasions).
- AI_RULES: added §69 (E2E coverage requirements per sprint).
- Tests: 51 Playwright E2E (41 pass, 10 skip — data-dependent)
- Result: 0 new failures, 22 E2E spec files total.

### Sprint FIX-6 — Documentation Sync (2026-02-27)
- `docs/AI_RULES.md` — Fixed duplicate §57 (FIX-5 E2E rule renumbered to §69). Tier 4/5 stubs (§57–§64) for Sprints 102–109 verified: each has status, gate condition, pre-sprint requirements, and provisional rules.
- `docs/CLAUDE.md` — This update. FIX-6 added to completion inventory. Tier status table updated.
- Auto-memory MEMORY.md — FIX-6 completion noted.
- No code changes. No migrations. No new tests.

### Sprint A — Stop the Bleeding (2026-02-27)
- **C1:** Wired Sentry into all 68 bare `} catch {}` blocks across `app/` and `lib/` (46+ files). Pattern: `Sentry.captureException(err, { tags: { file, sprint: 'A' } })`.
- **C3:** Created `lib/plan-display-names.ts` — SSOT for plan tier display names. Updated billing page + sidebar.
- **H3:** SOV cron per-org failure logging — 3 inner catches + aggregate `captureMessage` on partial failure.
- **H4:** Sidebar grouped navigation — `NAV_GROUPS` (5 groups: Overview, AI Visibility, Content & Menu, Intelligence, Admin) with `data-testid="sidebar-group-label"` headers.
- **H5:** Dashboard card links — MetricCard `href` prop (4 cards) + "View details →" links on SOVTrendChart, HallucinationsByModel, AIHealthScoreCard, RealityScoreCard.
- **L4:** ViralScanner error handling — `scanError` state, error UI with retry button, Sentry for Places autocomplete + scan submit.
- AI_RULES: added §70 (Sentry instrumentation), §71 (plan display names SSOT).
- Tests: 20 Vitest (sentry-coverage 8, sidebar-groups 7, metric-card-links 5), 10 Playwright (23-sprint-a-smoke).
- Result: 189 test files, 2646 tests pass, 0 TS errors, 0 bare catches remaining.

### Sprint B — First Impressions (2026-02-27)
- **C4 — Sample Data Mode:** New tenants (< 14 days, no SOV data) see realistic sample data on dashboard instead of blank cards. `lib/sample-data/use-sample-mode.ts` (pure `isSampleMode()`), `lib/sample-data/sample-dashboard-data.ts` (typed data SSOT), `components/ui/SampleDataBadge.tsx` (amber pill overlay), `components/ui/SampleModeBanner.tsx` (dismissible sessionStorage banner). Integrated into `app/dashboard/page.tsx` with `display*` variables for all 8 cards.
- **H1 — InfoTooltip System:** `components/ui/InfoTooltip.tsx` — Radix Popover-based tooltip (hover 300ms + click, `e.stopPropagation()`). `lib/tooltip-content.tsx` — 10 tooltip entries (What/How/Action format). Wired into MetricCard (`tooltip` prop), AIHealthScoreCard (title + 4 component bars), RealityScoreCard, SOVTrendChart, HallucinationsByModel.
- **H2 — Settings Expansion:** Migration `20260304000001` adds `monitored_ai_models text[]`, `score_drop_threshold integer`, `webhook_url text` to `organizations`. 2 new server actions: `updateAIMonitoringPrefs()`, `updateAdvancedPrefs()`. SettingsForm expanded to 7 sections (AI Monitoring toggles, Score Drop Threshold, Webhooks agency-gated, Restart Tour). `components/ui/UpgradePlanPrompt.tsx` for plan-gated features.
- **M3 — Plan Feature Comparison:** `lib/plan-feature-matrix.ts` — 24 `FeatureRow` entries across 6 categories. `app/dashboard/billing/_components/PlanComparisonTable.tsx` — full comparison table with current plan column highlight. Added to billing page.
- AI_RULES: added §72 (Sample Data Mode), §73 (InfoTooltip System), §74 (Settings Expansion), §75 (Plan Feature Comparison Table).
- Tests: 39 Vitest (sample-data-mode 15, info-tooltip 11, plan-feature-matrix 13).
- Result: 192 test files, 2685 tests pass. 1 migration.

### Sprint C — Hardening (2026-02-27)
- **C2 — Honest Listings State:** Replaced `mockSyncIntegration()` (fake `setTimeout(2000)` sync) with honest platform UI. Created `lib/integrations/platform-config.ts` — SSOT for 3 sync types: `real_oauth` (google), `manual_url` (yelp/tripadvisor), `coming_soon` (apple/bing/facebook). PlatformRow.tsx renders 3 distinct states. Migration `20260305000001` clears dirty connected statuses.
- **M1 — Test Coverage:** Added unit tests for `cron-logger` (16 tests) and `sov-seed` (23 tests). E2E smoke tests for 6 untested dashboard pages (source-intelligence, sentiment, agent-readiness, system-health, cluster-map, revenue-impact). Skipped entity-auto-detect, places-refresh, gbp-token-refresh (already had tests).
- **L2 — Weekly Digest Guard:** `fetchDigestForOrg()` now checks `sov_evaluations` count — returns null for orgs with 0 evaluations (no scan data). Prevents empty "Reality Score: —" emails to new users. Cron logs skipped count via `Sentry.captureMessage()`.
- **H6 — Stripe Per-Seat Cost:** Created `lib/stripe/get-monthly-cost-per-seat.ts` — fetches monthly price from Stripe Price API. Handles null input, missing env var, annual→monthly conversion. `seat-actions.ts` now calls `getMonthlyCostPerSeat()` instead of hardcoded null. SeatManagementCard shows "Contact us for custom seat pricing" fallback.
- **L3 — Content Draft Origin Tag:** ContentDraftCard occasion badge updated: label "Occasion Engine", violet color, CalendarDays icon, `data-testid="draft-origin-tag"`.
- AI_RULES: added §76 (Honest Listings), §77 (Digest Guard), §78 (Stripe Seat Cost), §79 (Origin Tag), §80 (Sprint C Tests).
- Tests: 63 Vitest (cron-logger 16, sov-seed 23, weekly-digest-guard 8, get-monthly-cost-per-seat 11, content-draft-origin 5), 26 Playwright (24-listings-honest-state 8, 25-sprint-c-pages 18).
- Result: 197 test files, 2748 tests pass. 1 migration.

### Sprint D — Operate & Protect (2026-02-27)
- **L1 — Admin Dashboard:** 4 admin pages (Customers, API Usage, Cron Health, Revenue) at `/admin/*`. Auth guard via `ADMIN_EMAILS` env var in `app/admin/layout.tsx`. Uses `createServiceRoleClient()` to bypass RLS. Shared components: AdminNav, AdminStatCard, PlanBadge. `lib/admin/format-relative-date.ts` utility.
- **N1 — Credit/Usage System:** `api_credits` table (migration `20260306000001`). `lib/credits/credit-limits.ts` (plan limits SSOT) + `lib/credits/credit-service.ts` (checkCredit/consumeCredit, fail-open, auto-init, auto-reset). 6 credit-gated server actions: `simulateAIParsing`, `uploadMenuFile`, `uploadPosExport`, `runSovEvaluation`, `generateContentBrief`, `runCompetitorIntercept`. Credits meter in TopBar (green/amber/red battery bar). `increment_credits_used()` RPC for atomic increment.
- **M4 — Revenue Config Defaults:** `avgCustomerValue`: 45→55, `monthlyCovers`: 800→1800 (restaurant-appropriate). `CHARCOAL_N_CHILL_REVENUE_CONFIG` fixture.
- **M6 — Positioning Banner:** `components/ui/PositioningBanner.tsx` (Client Component, localStorage dismiss). Shows for orgs < 30 days, not in sample mode. Links to `/dashboard/ai-responses`.
- AI_RULES: added §81 (Admin Auth Guard), §82 (Credit System), §83 (Revenue Defaults), §84 (Positioning Banner).
- Tests: 68 Vitest (admin-auth-guard 7, credit-service 20, credit-gated-actions 19, revenue-config-defaults 12, positioning-banner 10), 21 Playwright (26-admin-dashboard 13, 27-credits-system 8).
- Result: 202 test files, 2816 tests pass. 1 migration.

### Sprint F — Engagement & Retention (2026-02-27)
- **N2 — AI Answer Preview:** On-demand query preview widget on AI Responses page. 3 model cards (ChatGPT/Perplexity/Gemini) via SSE streaming. Credit-gated (1 credit/run). Model keys: `preview-chatgpt`, `preview-perplexity`, `preview-gemini`. API route: `app/api/ai-preview/route.ts`. Widget: `AIAnswerPreviewWidget.tsx`.
- **N3 — Correction Follow-Up:** Daily cron re-checks verifying hallucinations after 14 days. `correction-verifier.service.ts` extracts key phrases (phone/time/address/dollar) and substring-matches against fresh AI response. Status transitions: verifying→fixed or verifying→recurring. CorrectionPanel shows follow-up banner.
- **N4 — Benchmark Comparison:** Weekly cron aggregates city+industry scores via `compute_benchmarks()` RPC. BenchmarkComparisonCard shows "Collecting" (progress bar) or "Ready" (score vs avg, percentile, range bar). Display threshold: 10 orgs.
- Migration: `20260308000001_sprint_f_engagement.sql` — N3 columns on `ai_hallucinations` + N4 `benchmarks` table + RPC.
- Crons: 9 total in vercel.json, 7 in CRON_REGISTRY. Kill switches: `STOP_CORRECTION_FOLLOWUP_CRON`, `STOP_BENCHMARK_CRON`.
- AI_RULES: added §90 (AI Answer Preview), §91 (Correction Follow-Up), §92 (Benchmark Comparison).
- Tests: 41 Vitest (ai-preview-model-queries 9, correction-verifier 11, benchmark-card 10, sprint-f-registration 11).
- Result: 211 test files, 2922 tests pass. 1 migration.

### Sprint E — Grow the Product: Medical/Dental Vertical Extension & Guided Tour Depth (2026-02-27)
- **M5 — Medical/Dental Vertical Extension:** Industry configuration layer enabling multi-vertical support. `lib/industries/industry-config.ts` — SSOT with 4 verticals (restaurant, medical_dental active; legal, real_estate placeholder). `getIndustryConfig()` with null-safe restaurant fallback. Medical/dental SOV seed queries in `sov-seed.ts`. Schema.org types (Physician, Dentist, MedicalClinic) in `lib/schema-generator/medical-types.ts`. Dynamic sidebar icon/label via `orgIndustry` prop chain (layout.tsx → DashboardShell → Sidebar). Industry-aware Magic Menus page copy. Golden tenant fixture (`ALPHARETTA_FAMILY_DENTAL`).
- **M2 — Guided Tour Depth:** Expanded GuidedTour from 5 to 8 steps (added Share of Voice, Citations, Revenue Impact). `TOUR_STEPS` exported for testing. Created `components/ui/FirstVisitTooltip.tsx` — one-time per-page informational tooltip using localStorage `lv_visited_pages`. Wired into 5 pages: entity-health, agent-readiness, cluster-map, sentiment, crawler-analytics.
- AI_RULES: added §85 (Industry Config), §86 (Medical Schema), §87 (Medical SOV Seeds), §88 (GuidedTour Expanded), §89 (FirstVisitTooltip).
- Tests: 65 Vitest (industry-config 13, medical-schema-generator 17, sov-seed-medical 12, first-visit-tooltip 15, guided-tour-steps 8), 12 Playwright (sprint-e-smoke).
- Result: 207 test files, 2881 tests pass. 1 migration.

### Sprint G — Human-Readable Dashboard (2026-02-28)
- Replaced data-dump dashboard with action-surface layout. Removed 6 old cards (SOVTrendChart, HallucinationsByModel, CompetitorComparison, QuickStats, AIHealthScoreCard, RealityScoreCard). Added 4 stat panels grid + TopIssuesPanel.
- `lib/issue-descriptions.ts` — plain-English translation layer. `describeAlert()` maps severity + model → human headline.
- Stat panels: AIVisibilityPanel, WrongFactsPanel, AIBotAccessPanel, LastScanPanel in `app/dashboard/_components/panels/`.
- AI_RULES: added §93 (Dashboard Redesign), §94 (Issue Descriptions), §95 (Stat Panels), §96 (Top Issues).
- Tests: 79 Vitest, 14 Playwright (sprint-g-smoke).

### Sprint H — Action Surfaces (2026-02-28)
- Hallucination Triage Queue: 3-column Kanban (Fix Now / In Progress / Resolved) replaces flat table. AlertCard uses `describeAlert()`.
- SOVVerdictPanel: big SOV %, delta, top competitor mention count above SOVScoreRing.
- CitationsSummaryPanel: covered/gaps/score counts inside PlanGate.
- CompeteVerdictPanel: win/loss derived from `competitor_intercepts.winner`.
- AI_RULES: added §97-§100.
- Tests: 51 Vitest.

### Sprint I — Jargon Retirement Tier 2 (2026-02-28)
- Revenue Impact: `RevenueEstimatePanel` with industry-smart defaults via `getIndustryRevenueDefaults()`.
- AI Sentiment: `SentimentInterpretationPanel` with per-engine verdicts, worst-model callout.
- Source Intelligence: `SourceHealthSummaryPanel` with health badges, first-party citation rate.
- Bot Activity: `BotFixInstructions` expandable with `BOT_KNOWLEDGE_BASE` (10 bots).
- AI_RULES: added §101-§104.
- Tests: 87 Vitest, 7 Playwright (sprint-i-smoke).

### Sprint J — Jargon Retirement Tier 3 (2026-02-28)
- Entity Health: `PlatformDescriptionPanel` translates 7 platform statuses to plain-English consequences.
- Agent Readiness: `ScenarioDescriptionPanel` translates 6 capabilities to real-world scenarios.
- Cluster Map: `ClusterInterpretationPanel` with position verdict + axis/quadrant/legend rewording.
- AI_RULES: added §105-§107.
- Tests: 70 Vitest.

### Sprint K — Infrastructure & Trust (2026-02-28)
- **C1 — Sentry gap-fill:** Fixed final 4 bare `} catch {` blocks (BotFixInstructions, AIAnswerPreviewWidget ×2, ai-preview route). Zero remaining.
- **C2 — Listings honesty:** Verified Sprint C implementation complete. `PLATFORM_SYNC_CONFIG` has 3 sync types, mock setTimeout removed, `savePlatformUrl` action functional.
- **H4 — Sidebar groups:** Verified Sprint A implementation complete. NAV_GROUPS with 5 groups, all 23 items distributed.
- **H6 — monthlyCostPerSeat:** Verified Sprint C implementation complete. `getMonthlyCostPerSeat()` wired, "Contact us" fallback in UI.
- **L2 — Weekly digest guard:** Verified Sprint C implementation complete. `sov_evaluations` count guard in `fetchDigestForOrg()`.
- AI_RULES: added §108 (Sentry Sweep Completeness), §109 (Listings Honesty Verification).
- Tests: 22 Vitest (integrations-listings 20, sentry-sweep-verification 2), 14 Playwright (sprint-k-smoke).
- Result: 235 test files, 3231 tests pass. No migrations.

### Sprint L — Retention & Onboarding (2026-02-28)
- **C4 — Sample Data Mode Audit:** Sprint B infrastructure confirmed complete. 4 stat panels + TopIssuesPanel have sample data. Secondary cards use built-in empty states. Added 9 new tests (data shape + component rendering).
- **C2 Phase 2 — Listings Verification (Yelp):** `detectDiscrepancies()` pure function in `lib/integrations/detect-discrepancies.ts`. Yelp Fusion phone search API route. `ListingVerificationRow.tsx` component (4 states). Migration `20260309000001` adds verification columns to `location_integrations`. Bing deferred to Sprint M.
- **M2 — GuidedTour Completion:** Verified Sprint E implementation complete. 8 tour steps, sidebar testids present, Restart Tour button in Settings.
- AI_RULES: added §110 (Listings Verification), §111 (Sample Data Audit).
- Tests: 25 Vitest (sample-data-mode +3, sample-data-components 6, listing-verification 16), 10 Playwright (sprint-l-smoke).
- Result: 237 test files, 3256 tests pass. 1 migration.

### Sprint M — Conversion & Reliability (2026-02-28)
- **M3 — Plan Feature Comparison Table (refactored):** `buildFeatureMatrix()` derives all 24 feature rows from `plan-enforcer.ts` gating functions. Zero hardcoded availability values.
- **C2 Phase 2 — Bing Places Verification:** `app/api/integrations/verify-bing/route.ts` using Bing Local Business Search REST API. Bing upgraded from `coming_soon` to `manual_url` with `verifiable: true`. Reuses `detectDiscrepancies()`.
- **M6 — Positioning Banner Copy:** Updated to factual AI visibility vs search ranking explanation, references Reality Score.
- AI_RULES: added §112 (Plan Matrix Derivation), §113 (Bing Verification), §114 (Banner Copy).
- Tests: 23 Vitest (plan-feature-matrix +6, bing-verification 14, positioning-banner +3).
- Result: 238 test files, 3279 tests pass. No migrations.

### Sprint N — New Capability: Settings Delta, Streaming Preview, Correction Email (2026-02-28)
- **H2 delta — Settings Expansion:** Claude added to AI_MODELS (5 models now). `scan_day_of_week` preference (0=Sunday..6=Saturday). 2 new notification toggles: `notify_score_drop_alert`, `notify_new_competitor`. Competitor management shortcut section with count + link to `/dashboard/compete`. Migration `20260310000001`.
- **N2 enhancement — AI Preview Token Streaming:** Replaced batch `generateText()` with `streamText()` + async generators for true token-by-token streaming. 3 new streaming functions: `streamOpenAI()`, `streamPerplexity()`, `streamGemini()`. SSE events per chunk: `{ model, chunk, done }`. Widget accumulates content incrementally with blinking cursor. Stop button via AbortController.
- **N3 enhancement — Correction Follow-Up Email:** New `sendCorrectionFollowUpAlert()` in `lib/email.ts`. "fixed" → green success email, "recurring" → amber warning. Wired into correction-follow-up cron with org notification pref check. Wrapped in `.catch()` so email failure never blocks cron.
- AI_RULES: added §115 (Settings Claude + Scan Day), §116 (Notification Toggles), §117 (AI Preview Streaming), §118 (Correction Email).
- Tests: 39 Vitest (sprint-n-settings 15, sprint-n-preview-streaming 6, sprint-n-correction-email 3, sprint-n-registration 15).
- Result: 242 test files, 3318 tests pass. 1 migration.

### Sprint O — V1 Complete: Revenue Defaults, Content Flow, Benchmark Enhancement (2026-02-28)
- **M4 — Revenue Config Defaults:** Audited both revenue systems. OLD system `avg_ticket` updated from $45 → $55 to align with NEW system. `RevenueConfigForm` placeholders and help text added. Golden tenant and industry defaults already correct.
- **L3 — Content Flow Clarity:** No migration needed — `trigger_type='occasion'` + `trigger_id` already link drafts to occasions. New `DraftSourceTag` component shows "Generated from calendar · {occasion}" on occasion-originated drafts. Post-creation success CTA with "View draft →" in OccasionTimeline. Breadcrumb on content-drafts page via `?from=calendar` param.
- **N4 — Benchmark Enhancement:** Feature fully built in Sprint F. Sprint O adds 14-day staleness check in `fetchBenchmark()` and `!sampleMode` guard on dashboard BenchmarkComparisonCard.
- AI_RULES: added §119 (Revenue Defaults Alignment), §120 (DraftSourceTag), §121 (Benchmark Staleness).
- Tests: 28 Vitest (sprint-o-revenue-defaults 11, sprint-o-content-flow 8, sprint-o-benchmark 9) + 1 test fix. 18 E2E (sprint-o-smoke).
- Result: 245 test files, 3346 tests pass. No migrations.
- **This is the final sprint. LocalVector V1 is complete.**

### Sprint 102 — Database Types Sync + Sidebar Nav Completeness (2026-03-01)
- `lib/supabase/database.types.ts` — **MODIFIED.** Added `benchmarks` table; Sprint F columns on `ai_hallucinations`; Sprint N columns on `organizations`; `compute_benchmarks` RPC.
- `lib/data/benchmarks.ts` / `app/api/cron/benchmarks/route.ts` — **MODIFIED.** Removed `as Function` casts (3 total).
- `app/api/cron/correction-follow-up/route.ts` / `app/dashboard/settings/actions.ts` — **MODIFIED.** Removed `as never` casts (4 total).
- `components/layout/Sidebar.tsx` — **MODIFIED.** Added Locations nav item pointing to `/dashboard/settings/locations`. Added to Admin NAV_GROUP.
- `tests/e2e/14-sidebar-nav.spec.ts` — **MODIFIED.** Expanded to 23 nav tests (was 9).
- `src/__tests__/unit/database-types-completeness.test.ts` — **MODIFIED.** Extended to 27 tests (was 12).
- `src/__tests__/unit/sidebar-nav-items.test.ts` — **MODIFIED.** Extended to 10 tests (was 4).
- Tests: 21 new Vitest (15 types + 6 sidebar), 14 new E2E. Total: 3366 Vitest, 23 E2E sidebar tests.

### Sprint 103 — Benchmarks Full Page + Sidebar Entry (2026-03-01)
- `app/dashboard/benchmarks/page.tsx` — **NEW.** Full-page benchmark view. 4 states: no-city, collecting, ready+score, ready+no-score. Reuses BenchmarkComparisonCard as hero. About section + How to Improve action block.
- `components/layout/Sidebar.tsx` — **MODIFIED.** Added Benchmarks (Trophy icon) to NAV_ITEMS + Intelligence NAV_GROUP.
- `supabase/seed.sql` — **MODIFIED.** Alpharetta benchmark row (org_count: 14).
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** MOCK_BENCHMARK_READY + MOCK_BENCHMARK_COLLECTING.
- `src/__tests__/unit/benchmarks-page.test.tsx` — **NEW.** 19 Vitest tests.

### Sprint 104 — Content Grader Completion (2026-03-01)
- `lib/page-audit/faq-generator.ts` — **NEW.** AI-powered FAQ auto-generator (Doc 17 §4). GPT-4o-mini. Static fallback. Returns GeneratedSchema.
- `lib/ai/providers.ts` — **MODIFIED.** Added 'faq-generation' model key.
- `app/dashboard/page-audits/schema-actions.ts` — **MODIFIED.** Wires AI FAQ when faqSchemaPresent=false. Deduplicates by schemaType.
- `app/dashboard/page-audits/actions.ts` — **MODIFIED.** addPageAudit() — on-demand audit for new URLs. Plan gate + URL normalization + rate limit + page type inference.
- `app/dashboard/page-audits/_components/AddPageAuditForm.tsx` — **NEW.** URL input client component.
- `app/dashboard/page-audits/page.tsx` — **MODIFIED.** Empty state: AddPageAuditForm. Main state: collapsible Audit New Page section.
- `supabase/seed.sql` — **MODIFIED.** About + FAQ page audit rows for golden tenant.
- Tests: `faq-generator.test.ts` (17) + `add-page-audit.test.ts` (13) — 30 new tests.
- `tests/e2e/14-sidebar-nav.spec.ts` — **MODIFIED.** 24 total nav tests.

## Tier Completion Status

| Tier | Sprints | Status | Gate |
|------|---------|--------|------|
| Tier 1 | 1–30 | Complete | — |
| Tier 2 | 31–70 | Complete | — |
| Tier 3 | 71–101 | Complete | — |
| Production Fixes | FIX-1 – FIX-6 | Complete | — |
| Sprint A | Stop the Bleeding | Complete | — |
| Sprint B | First Impressions | Complete | — |
| Sprint C | Hardening | Complete | — |
| Sprint D | Operate & Protect | Complete | — |
| Sprint E | Grow the Product | Complete | — |
| Sprint F | Engagement & Retention | Complete | — |
| Sprint G | Human-Readable Dashboard | Complete | — |
| Sprint H | Action Surfaces | Complete | — |
| Sprint I | Jargon Retirement (Revenue, Sentiment, Source Intel, Bot Activity) | Complete | — |
| Sprint J | Jargon Retirement (Entity Health, Agent Readiness, Cluster Map) | Complete | — |
| Sprint K | Infrastructure & Trust (Sentry Sweep, Listings/Sidebar/Digest Verification) | Complete | — |
| Sprint L | Retention & Onboarding (Sample Data Audit, Listings Verification, Tour Completion) | Complete | — |
| Sprint M | Conversion & Reliability (Plan Matrix Refactor, Bing Verification, Banner Copy) | Complete | — |
| Sprint N | New Capability (Settings Delta, Streaming Preview, Correction Email) | Complete | — |
| Sprint O | V1 Complete (Revenue Defaults, Content Flow, Benchmark Enhancement) | Complete | — |
| Sprint 102 | Database Types Sync + Sidebar Nav Completeness | Complete | — |
| Sprint 103 | Benchmarks Full Page + Sidebar Entry | Complete | — |
| Sprint 104 | Content Grader Completion | Complete | — |
| Tier 4 | 105–106 | Gated | Sprint 105–106: no external gate. |
| Tier 5 | 107–109 | Gated | 4–8 weeks of SOV baseline data required. SOV cron registered 2026-02-27. Sprint 107 earliest: 2026-03-27. |

### Next Sprint Ready to Execute: Sprint 105 — Apple Business Connect
Submit API request at https://developer.apple.com/business-connect/. See AI_RULES §60.

### Sprints Pending External Approval:
- Apple Business Connect Sync (originally §57): Submit API request at https://developer.apple.com/business-connect/
- Sprint 103 (Bing Places): Submit API request at https://bingplaces.com

### Sprints Pending Data Accumulation:
- Sprint 107 (Competitor Prompt Hijacking): Needs 4+ weeks SOV data. Earliest: 2026-03-27.
- Sprint 108 (Per-Engine Playbooks): Needs 8+ weeks SOV data. Earliest: 2026-04-24.
- Sprint 109 (Intent Discovery): Needs 8+ weeks Perplexity query data. Earliest: 2026-04-24.

## Build History

See `DEVLOG.md` (project root) and `docs/DEVLOG.md` for the complete sprint-by-sprint build log. Current sprint: 102 (+ FIX-1 through FIX-8 + Sprint A through Sprint O). AI_RULES: §1–§123 (123 sections). Production readiness: all audit issues resolved. **V1 complete.**
