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
app/api/cron/          — Automated pipelines (sov, audit, content-audit, weekly-digest)
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
app/onboarding/connect/       — GBP OAuth interstitial + location picker (Sprint 89)
lib/schema-generator/        — Pure JSON-LD generators: FAQ, Hours, LocalBusiness, ReserveAction, OrderAction (Sprint 70/84)
lib/ai/                — AI provider config, schemas, actions
lib/services/          — Pure business logic services
lib/autopilot/         — Content draft generation and publish pipeline
lib/page-audit/        — HTML parser + AEO auditor
lib/tools/             — AI chat tool definitions
lib/auth/              — Role enforcement (org-roles.ts: roleSatisfies, assertOrgRole, ROLE_PERMISSIONS)
lib/mcp/               — MCP server tool registrations
lib/supabase/database.types.ts — Full Database type (33 tables, 9 enums, Relationships)
supabase/migrations/   — Applied SQL migrations (35, timestamp-ordered)
supabase/prod_schema.sql — Full production schema dump
docs/                  — 50 spec documents (authoritative for planned features)
src/__tests__/         — Unit + integration tests
tests/e2e/             — Playwright E2E tests (18 specs)
```

## Database Tables (Key Ones)

| Table | Purpose |
|-------|---------|
| `organizations` | Tenant root — has `plan_tier`, `plan_status`, notification prefs (`notify_hallucination_alerts`, `notify_weekly_digest`, `notify_sov_alerts`) |
| `locations` | Business locations per org. Revenue config: `avg_customer_value` (numeric, default 45), `monthly_covers` (integer, default 800) |
| `target_queries` | SOV query library per location. Columns: `query_category` (discovery/comparison/occasion/near_me/custom), `occasion_tag`, `intent_modifier`, `is_active` (soft-disable toggle). UNIQUE on `(location_id, query_text)`. |
| `sov_evaluations` | Per-query SOV results (engine, rank, competitors, `sentiment_data` JSONB, `source_mentions` JSONB) |
| `visibility_analytics` | Aggregated SOV scores per snapshot date |
| `ai_hallucinations` | Detected hallucinations with severity + status tracking |
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

## Tier Completion Status

| Tier | Sprints | Status | Gate |
|------|---------|--------|------|
| Tier 1 | 1–30 | Complete | — |
| Tier 2 | 31–70 | Complete | — |
| Tier 3 | 71–101 | Complete | — |
| Production Fixes | FIX-1 – FIX-3 | Complete | — |
| Tier 4 | 102–106 | Gated | Sprint 102: Apple BC API approval. Sprint 103: Bing Places API approval. Sprint 104–106: no external gate. |
| Tier 5 | 107–109 | Gated | 4–8 weeks of SOV baseline data required. SOV cron registered 2026-02-27. Sprint 107 earliest: 2026-03-27. |

### Next Sprint Ready to Execute: Sprint 104 — Dynamic FAQ Auto-Generation
No external dependencies. Can begin immediately. See AI_RULES §59.

### Sprints Pending External Approval:
- Sprint 102 (Apple Business Connect): Submit API request at https://developer.apple.com/business-connect/
- Sprint 103 (Bing Places): Submit API request at https://bingplaces.com

### Sprints Pending Data Accumulation:
- Sprint 107 (Competitor Prompt Hijacking): Needs 4+ weeks SOV data. Earliest: 2026-03-27.
- Sprint 108 (Per-Engine Playbooks): Needs 8+ weeks SOV data. Earliest: 2026-04-24.
- Sprint 109 (Intent Discovery): Needs 8+ weeks Perplexity query data. Earliest: 2026-04-24.

## Build History

See `DEVLOG.md` (project root) and `docs/DEVLOG.md` for the complete sprint-by-sprint build log. Current sprint: 101 (+ FIX-1, FIX-2, FIX-3).
