# LocalVector.ai — Development Log

> Reverse-chronological. Newest entries at top. See AI_RULES §13 for format.

---

## 2026-02-25 — Bug Fix: Missing RLS Policies on `competitor_intercepts` (Completed)

**Goal:** Fix "new row violates row-level security policy for table competitor_intercepts" error when running competitor analysis from the dashboard.

**Root cause:** The `competitor_intercepts` table had RLS enabled but only an `org_isolation_select` policy. INSERT (from `runCompetitorIntercept`), UPDATE (from `markInterceptActionComplete`), and DELETE were all silently blocked by RLS.

**Scope:**
- `supabase/migrations/20260226000003_competitor_intercepts_rls_policies.sql` — **NEW.** Adds `org_isolation_insert`, `org_isolation_update`, `org_isolation_delete` policies matching the standard tenant-isolation pattern.
- `supabase/prod_schema.sql` — Added the same 3 policies to the authoritative schema file.

**Verification:** `supabase db reset` succeeds. All 4 policies confirmed via `pg_policies` query. "Run Analysis" now inserts into `competitor_intercepts` without RLS error.

---

## 2026-02-25 — Sprint 48: Autopilot Engine — Full Publish Pipeline (Completed)

**Goal:** Build the Autopilot Engine — the ACT layer that closes the DETECT → DIAGNOSE → ACT → MEASURE loop. Converts detected gaps (first mover, competitor gap, occasion, prompt missing, manual) into AI-generated drafts via GPT-4o-mini, routes them through a strict HITL approval workflow, and publishes to 3 targets (Download HTML, GBP Post, WordPress). Post-publish SOV re-check at 14 days.

**Spec:** `docs/19-AUTOPILOT-ENGINE.md`

**Scope:**

*New files:*
- `lib/types/autopilot.ts` — **NEW.** TypeScript interfaces: `DraftTriggerType`, `DraftContentType`, `DraftStatus`, `PublishTarget`, `DraftTrigger`, `DraftContext`, `ContentDraftRow`, `PublishResult`, `PostPublishMeasurementTask`, `AutopilotLocationContext`.
- `lib/autopilot/score-content.ts` — **NEW.** Pure heuristic AEO scorer (0–100). 5 dimensions: answer-first (35pt), content depth (25pt), keyword coverage (20pt), CTA signals (10pt), title quality (10pt). No API calls.
- `lib/autopilot/generate-brief.ts` — **NEW.** GPT-4o-mini brief generator using Vercel AI SDK `generateText()` + `getModel('greed-intercept')`. `buildContextBlock()` switches on 5 trigger types. Mock fallback with `[MOCK]`-prefixed deterministic output when `!hasApiKey('openai')`. Parses via `AutopilotDraftSchema.safeParse()`.
- `lib/autopilot/create-draft.ts` — **NEW.** Master draft creator — single entry point for all triggers. `createDraft(trigger, supabase)` → `ContentDraftRow | null`. Steps: idempotency SELECT → pending cap (5) → load location → determine content type → generate brief → score → INSERT. Catches unique violation `23505` for DB-level idempotency backup. Exports `archiveExpiredOccasionDrafts()` with 7-day grace period. `PENDING_DRAFT_CAP = 5`.
- `lib/autopilot/publish-download.ts` — **NEW.** HTML download publisher. `publishAsDownload()` returns base64 HTML with embedded JSON-LD (LocalBusiness + FAQPage). `buildLocalBusinessSchema()`, `buildFaqSchemaFromContent()` extract Q:/A: pairs.
- `lib/autopilot/publish-gbp.ts` — **NEW.** GBP Post publisher. `publishToGBP()` with OAuth token refresh + 401 retry. `truncateAtSentence()` at `GBP_MAX_CHARS = 1500`. Token fetched via service-role client (no RLS).
- `lib/autopilot/publish-wordpress.ts` — **NEW.** WordPress REST API publisher. `publishToWordPress()` creates WP draft via `wp/v2/pages`. `contentToWPBlocks()` wraps in `<!-- wp:paragraph -->` blocks. Basic auth via Application Password.
- `lib/autopilot/post-publish.ts` — **NEW.** Redis-based SOV re-check scheduling. `schedulePostPublishRecheck()`, `getPendingRechecks()`, `completeRecheck()`. Redis SET `sov_recheck:pending` + individual keys with 15-day TTL. Graceful degradation per AI_RULES §17.
- `supabase/migrations/20260226000002_autopilot_trigger_idempotency.sql` — **NEW.** Drops non-unique `idx_content_drafts_trigger`, creates `UNIQUE INDEX idx_content_drafts_trigger_unique ON content_drafts (trigger_type, trigger_id) WHERE trigger_id IS NOT NULL`.
- `app/dashboard/content-drafts/[id]/page.tsx` — **NEW.** Server component draft detail view. Async params, `getSafeAuthContext()`, RLS fetch, `notFound()`. Breadcrumb, header with badges/AEO/dates, two-column layout (editor left, context panel right).
- `app/dashboard/content-drafts/[id]/_components/DraftEditor.tsx` — **NEW.** Client component. Editable title/content when `status === 'draft'`, read-only otherwise. Live AEO score recalculation via `scoreContentHeuristic`. Save/Approve/Reject/Archive buttons.
- `app/dashboard/content-drafts/[id]/_components/PublishDropdown.tsx` — **NEW.** Client component. 3 publish targets (Download HTML, GBP Post, WordPress). Factual disclaimer modal. Browser download trigger for HTML target.

*Modified files:*
- `lib/ai/schemas.ts` — Added `AutopilotDraftSchema` + `AutopilotDraftOutput` type (shape: `{ title, content, estimated_aeo_score, target_keywords }`).
- `app/dashboard/content-drafts/actions.ts` — **Fixed `rejectDraft()`**: `{ status: 'rejected' }` → `{ status: 'draft', human_approved: false }` per Doc 19 §4.2. Added `archiveDraft()`, `editDraft()` (blocks approved/published, recalculates AEO on content change), `publishDraft()` (NON-NEGOTIABLE HITL: `human_approved === true && status === 'approved'`, plan gating, dispatches to target publisher, schedules post-publish recheck).
- `app/dashboard/content-drafts/_components/ContentDraftCard.tsx` — Title wrapped in `<Link>` to detail view. Added Publish button (signal-green) for approved drafts. Added Archive button for non-published states.
- `app/dashboard/content-drafts/_components/DraftFilterTabs.tsx` — Replaced "Rejected" tab with "Archived" (reject now returns to draft status, not a terminal state).
- `lib/services/sov-engine.service.ts` — Replaced bare-bones `content_drafts.upsert()` for first_mover alerts with `createDraft()` call (AI-generated content instead of placeholder text).
- `app/api/cron/sov/route.ts` — Replaced bare-bones `prompt_missing` upsert with `createDraft()`. Added sub-step 10: `archiveExpiredOccasionDrafts()`. Added sub-step 11: post-publish SOV re-checks via `getPendingRechecks()` + `completeRecheck()`.
- `src/__tests__/unit/sov-engine-service.test.ts` — Added `vi.mock('@/lib/autopilot/create-draft')` to prevent chained Supabase calls in tests.
- `tests/e2e/08-content-drafts.spec.ts` — Updated filter tab assertion: "Rejected" → "Archived".

**Tests added:**
- `src/__tests__/unit/autopilot-score-content.test.ts` — **10 Vitest tests** (new). High score for answer-first+keywords, low for generic, 0 for empty, null city, CTA bonus, title bonus, word count scaling, combined perfect score, missing categories.
- `src/__tests__/unit/autopilot-create-draft.test.ts` — **17 Vitest tests** (new). `determineContentType` (6 trigger mappings), `PENDING_DRAFT_CAP` constant, `buildContextBlock` (5 trigger types), `generateDraftBrief` (3: mock fallback, FAQ content, business name inclusion), `archiveExpiredOccasionDrafts` (2: empty + null trigger_ids).
- `src/__tests__/unit/autopilot-publish.test.ts` — **19 Vitest tests** (new). Download: valid HTML, JSON-LD LocalBusiness, FAQPage extraction, base64 encoding, meta description, escaping. GBP: truncation at 1500, sentence boundary, word boundary fallback, under-limit passthrough, token refresh, missing token error. WordPress: REST API call, WP block format, auth failure, draft status.
- `src/__tests__/unit/autopilot-post-publish.test.ts` — **13 Vitest tests** (new). Redis scheduling, key format, TTL, pending scan, graceful degradation (schedule/scan/cleanup), completion cleanup, empty pending list, multiple tasks.
- `src/__tests__/unit/content-drafts-actions.test.ts` — **23 Vitest tests** (was 10, +13). Updated `rejectDraft` test. Added `archiveDraft` (3), `editDraft` (3: auth, blocks approved, blocks published), `publishDraft` (4: auth, plan gate, blocks unapproved, blocks when `human_approved=false`).
- `src/__tests__/unit/cron-sov.test.ts` — **21 Vitest tests** (was 16 after Sprint 47, +5). Added `archiveExpiredOccasionDrafts` (2: called, crash-safe), `getPendingRechecks` (2: called, crash-safe), SOV recheck + completeRecheck integration.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/autopilot-score-content.test.ts  # 10 tests passing
npx vitest run src/__tests__/unit/autopilot-create-draft.test.ts   # 17 tests passing
npx vitest run src/__tests__/unit/autopilot-publish.test.ts        # 19 tests passing
npx vitest run src/__tests__/unit/autopilot-post-publish.test.ts   # 13 tests passing
npx vitest run src/__tests__/unit/content-drafts-actions.test.ts   # 23 tests passing
npx vitest run src/__tests__/unit/cron-sov.test.ts                 # 21 tests passing
npx vitest run                                                      # 711 tests passing, 7 skipped
npx playwright test --project=chromium tests/e2e/08-content-drafts.spec.ts  # 3 tests passing
```

---

## 2026-02-25 — Sprint 47: Prompt Intelligence Service (Completed)

**Goal:** Build the Prompt Intelligence Service — a strategic layer on top of the SOV Engine that detects 3 types of gaps in a tenant's query library (untracked, competitor-discovered, zero-citation clusters) and surfaces actionable gaps via API and cron-driven content drafts.

**Spec:** `docs/15-LOCAL-PROMPT-INTELLIGENCE.md`

**Scope:**
- `lib/types/prompt-intelligence.ts` — **NEW.** TypeScript interfaces: `QueryGap`, `ReferenceQuery`, `CategoryBreakdown`, `PromptGapReport`, enums `GapType`, `GapImpact`, `QueryCategory`.
- `lib/services/prompt-intelligence.service.ts` — **NEW.** Pure service. Exports: `buildReferenceLibrary()`, `detectQueryGaps()` (3 algorithms), `computeCategoryBreakdown()`.
- `app/api/v1/sov/gaps/route.ts` — **NEW.** `GET /api/v1/sov/gaps?location_id=uuid` — auth-gated gap report endpoint.
- `app/api/cron/sov/route.ts` — Added Prompt Intelligence sub-step (§9) after Occasion Engine. Auto-creates `prompt_missing` content drafts for zero-citation clusters (Growth+ only). Added `gaps_detected` to summary.
- `lib/services/sov-seed.ts` — Exported template functions for reuse by reference library builder.
- `docs/05-API-CONTRACT.md` — Added `GET /sov/gaps` endpoint. Version bumped to 2.6.

**Tests added:**
- `src/__tests__/unit/prompt-intelligence-service.test.ts` — **16 Vitest tests** (new).
- `src/__tests__/unit/cron-sov.test.ts` — **16 Vitest tests** (was 13, +3 new).

**Run commands:**
```bash
npx vitest run src/__tests__/unit/prompt-intelligence-service.test.ts  # 16 tests passing
npx vitest run src/__tests__/unit/cron-sov.test.ts                     # 16 tests passing
npx vitest run                                                          # 637 tests passing, 7 skipped
```

---

## 2026-02-25 — Sprint 46: Citation Intelligence Cron (Completed)

**Goal:** Build the Citation Intelligence cron — a monthly infrastructure-level pipeline that measures which platforms AI actually cites when answering discovery queries for a business category+city. Shared aggregate data, not tenant-specific. Cost: ~900 Perplexity Sonar queries/month = ~$4.50 fixed.

**Spec:** `docs/18-CITATION-INTELLIGENCE.md`

**Scope:**
- `lib/types/citations.ts` — **NEW.** TypeScript interfaces: `CitationSourceIntelligence`, `PlatformCitationCounts`, `CitationQueryResult`, `CitationGapSummary`, `TenantListing`, `CitationCronSummary`.
- `lib/services/citation-engine.service.ts` — **NEW.** Pure service (~290 lines). Exports: `TRACKED_CATEGORIES` (9), `TRACKED_METROS` (20), `extractPlatform()` (15 known platforms + hostname fallback), `buildCitationPrompt()`, `generateSampleQueries()` (5 per category+metro), `runCitationQuery()` (Perplexity Sonar via `getModel('sov-query')`), `runCitationSample()` (orchestrates 5 queries + platform counting + 500ms rate limit), `writeCitationResults()` (upsert into `citation_source_intelligence` using UNIQUE constraint), `calculateCitationGapScore()` (pure function: cross-references citation data vs tenant listings, 30% relevance threshold, returns 0–100 gap score + top uncovered gap).
- `lib/ai/schemas.ts` — Added `CitationCronResultSchema` (Zod: recommendations array with business + source_url).
- `app/api/cron/citation/route.ts` — **NEW.** Monthly cron route (`GET /api/cron/citation`). CRON_SECRET auth guard, `STOP_CITATION_CRON` kill switch, service-role client, per-category+metro try/catch resilience. Processes 9×20=180 combinations, returns summary JSON.

**Key design decisions:**
- Reuses `'sov-query'` model key (Perplexity Sonar) — no new provider entry.
- Separate cron from SOV (Doc 18 §8): monthly schedule vs SOV's weekly.
- No RLS on `citation_source_intelligence` — aggregate market data, service-role only.
- No plan gating — infrastructure-level, all tenants benefit.
- `extractPlatform()` handles `google.com/maps` and `maps.google.com` path-based matching before hostname fallback.
- `calculateCitationGapScore()` excludes `not_linked` sync_status (matching actual DB enum; spec's `not_found`/`not_claimed` don't exist in the `sync_status` enum).

**Tests added:**
- `src/__tests__/unit/citation-engine-service.test.ts` — **42 Vitest tests** (new). extractPlatform (14: null, empty, malformed, 10 known platforms, unknown domain, www stripping), generateSampleQueries (2: count, content), buildCitationPrompt (2: query text, JSON format), runCitationQuery (3: no API key, valid response, unparseable), runCitationSample (3: platform counting, no API key, per-query resilience), writeCitationResults (4: zero queries, frequency calculation, platform count, upsert errors), calculateCitationGapScore (8: no data, full coverage, no coverage, partial, threshold filtering, not_linked exclusion, case-insensitive matching, mismatch included, topGap action text), constants (3: category count, metro count, metro format).
- `src/__tests__/unit/cron-citation.test.ts` — **13 Vitest tests** (new). Auth guard (2: missing header, wrong secret), kill switch, createServiceRoleClient call, all combinations processed (180), writeCitationResults call count, summary counts (categories/metros/queries/platforms), per-combination error resilience, argument passthrough, supabase client passthrough, zero-queries skip.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/citation-engine-service.test.ts  # 42 tests passing
npx vitest run src/__tests__/unit/cron-citation.test.ts            # 13 tests passing
npx vitest run                                                      # 618 tests passing, 7 skipped
```

---

## 2026-02-25 — Sprint 45: Occasion Engine (Completed)

**Goal:** Build the Occasion Engine — a temporal layer that detects upcoming seasonal events (Valentine's Day, NYE, Mother's Day, etc.) and proactively creates content drafts so businesses can be AI-visible before peak dates. Runs as a sub-step inside the existing weekly SOV cron.

**Spec:** `docs/16-OCCASION-ENGINE.md`

**Scope:**
- `lib/types/occasions.ts` — **NEW.** TypeScript interfaces: `LocalOccasionRow`, `OccasionAlert`, `OccasionSchedulerResult`, `OccasionQueryPattern`.
- `lib/services/occasion-engine.service.ts` — **NEW.** Pure service (~250 lines). Exports `getDaysUntilPeak()` (fixed MM-DD dates + evergreen null), `checkOccasionAlerts()` (window + category relevance + Redis dedup + SOV citation check), `generateOccasionDraft()` (21-day window + idempotency + GPT-4o-mini via `getModel('greed-intercept')`), `runOccasionScheduler()` (top-level orchestrator called from SOV cron).
- `lib/ai/schemas.ts` — Added `OccasionDraftSchema` (Zod: title, content, estimated_aeo_score, target_keywords).
- `app/api/cron/sov/route.ts` — Added occasion engine sub-step (§8) after `writeSOVResults()` inside per-org try/catch. Added `categories` to locations SELECT. Added `occasion_drafts` to summary JSON. Non-critical: failures never abort the SOV cron.
- `supabase/seed.sql` — Expanded `local_occasions` from 3 to 20 seeds across 4 tiers: Hospitality Core (7), Celebration Milestones (6), Cultural & Ethnic (5), Seasonal (2). All with `peak_query_patterns` and `relevant_categories`. `ON CONFLICT (name) DO NOTHING` for idempotency.

**Key design decisions:**
- Reuses `'greed-intercept'` model key (GPT-4o-mini) — no new provider entry.
- Redis dedup key: `occasion_alert:{orgId}:{occasionId}:{weekNumber}`, 8-day TTL. Wrapped in try/catch per AI_RULES §17.
- Draft idempotency via SELECT-before-INSERT (no unique constraint on content_drafts trigger columns).
- Plan gating: `canRunOccasionEngine(plan)` — Growth/Agency only (already existed in `lib/plan-enforcer.ts`).

**Tests added:**
- `src/__tests__/unit/occasion-engine-service.test.ts` — **19 Vitest tests** (new). getDaysUntilPeak (fixed/evergreen/exact-date), checkOccasionAlerts (empty/window/category/dedup/Redis-degradation/citation), generateOccasionDraft (conditions/idempotency/mock/real-AI), runOccasionScheduler (empty/growth/starter).
- `src/__tests__/unit/cron-sov.test.ts` — **13 Vitest tests** (was 11). Two new: occasion scheduler called after writeSOVResults, occasion failure doesn't crash cron.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/occasion-engine-service.test.ts  # 19 tests passing
npx vitest run src/__tests__/unit/cron-sov.test.ts                 # 13 tests passing
npx vitest run                                                      # 563 tests passing
```

---

## 2026-02-25 — Bug Fix: query_category Column Missing from target_queries (Completed)

**Goal:** Fix critical silent bug where `query_category` column was missing from `target_queries` table, causing First Mover Alerts to never fire (the SOV engine's `writeSOVResults()` filters on `['discovery', 'occasion', 'near_me']` but `queryCategory` was always `undefined`).

**Root cause:** The spec migration (`docs/20260223000001_sov_engine.sql`) defining an enriched `sov_target_queries` table was never applied. The live `target_queries` (migration `20260221000004`) only had `id, org_id, location_id, query_text, created_at`.

**Scope:**
- `supabase/migrations/20260226000001_add_query_category.sql` — **NEW.** Adds `query_category VARCHAR(50) NOT NULL DEFAULT 'discovery'`, `occasion_tag VARCHAR(50) NULL`, `intent_modifier VARCHAR(50) NULL`. CHECK constraint: `IN ('discovery', 'comparison', 'occasion', 'near_me', 'custom')`. Index on `query_category`. Backfills existing rows with `'discovery'`.
- `app/api/cron/sov/route.ts` — Added `query_category` to the SELECT statement so it flows through to `runSOVQuery()`.
- `lib/services/sov-seed.ts` — Rewrote query generation to track `query_category` per tier: discovery, near_me, occasion (with `occasion_tag`), comparison. Insert rows now include `query_category`.
- `app/dashboard/share-of-voice/actions.ts` — `addTargetQuery()` now sets `query_category: 'custom'` for user-created queries.
- `supabase/prod_schema.sql` — Updated `target_queries` CREATE TABLE with new columns, CHECK constraint, and index.
- `supabase/seed.sql` — Added `query_category: 'discovery'` to golden tenant target_query INSERT.

**Tests added/updated:**
- `src/__tests__/unit/cron-sov.test.ts` — **11 Vitest tests** (was 10). Added `query_category` to `MOCK_QUERY`. New test: verifies `query_category` passes through to `runSOVQuery`.
- `src/__tests__/unit/sov-engine-service.test.ts` — **11 Vitest tests** (was 9). Two new tests: `custom`/`comparison` categories excluded from first mover; competitors found prevents first mover flag.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/cron-sov.test.ts              # 11 tests passing
npx vitest run src/__tests__/unit/sov-engine-service.test.ts     # 11 tests passing
```

---

## 2026-02-25 — Sprint 44: AI Truth Audit — Multi-Engine (Completed)

**Goal:** Transform the single-engine hallucination monitor into a multi-engine truth verification system with 4 AI engines (OpenAI, Perplexity, Anthropic, Gemini). Composite Truth Score (0–100) with consensus detection.

**Scope:**
- `lib/schemas/evaluations.ts` — Extended `EVALUATION_ENGINES` from `['openai', 'perplexity']` to `['openai', 'perplexity', 'anthropic', 'gemini']`. Added `RunMultiAuditSchema` (location_id only).
- `lib/services/truth-audit.service.ts` — **NEW.** Pure function service (AI_RULES §6). Exports `ENGINE_WEIGHTS` (openai=0.30, perplexity=0.30, gemini=0.20, anthropic=0.20), `calculateWeightedScore`, `hasConsensus`, `calculateTruthScore`, `buildTruthAuditResult`. Formula: weighted average + consensus bonus (+5 if all ≥80) − closed-hallucination penalty (−15). Clamped [0,100].
- `app/dashboard/hallucinations/actions.ts` — Added `callEngine()` unified Vercel AI SDK helper using `getModel('truth-audit-{engine}')`. Added `runMultiEngineEvaluation()` Server Action running all 4 engines via `Promise.allSettled`. Extended `mockResult()` for all 4 engines. Kept existing `callOpenAI()`/`callPerplexity()` for backwards compatibility.
- `app/dashboard/hallucinations/_components/TruthScoreCard.tsx` — **NEW.** SVG semicircle gauge (0–100), consensus badge, engine count. Color-coded: ≥90 green, ≥70 amber, ≥50 orange, <50 crimson.
- `app/dashboard/hallucinations/_components/EngineComparisonGrid.tsx` — **NEW.** 4-column grid: engine badge, score, weight percentage per engine.
- `app/dashboard/hallucinations/_components/EvaluationCard.tsx` — Extended `ENGINE_CONFIG` and Props to support 4 engines (anthropic=amber, gemini=sky). Added 2 new `EngineRow` renders.
- `app/dashboard/hallucinations/page.tsx` — Renamed heading to "AI Truth Audit". Added Truth Score computation from latest evaluations + `buildTruthAuditResult()`. Placed `TruthScoreCard` + `EngineComparisonGrid` above audit cards.
- `supabase/seed.sql` — 2 new eval rows: anthropic (f2eebc99, score=90), gemini (f3eebc99, score=88). Golden tenant Truth Score = 84 (no consensus since perplexity=65 < 80).
- `src/mocks/handlers.ts` — **NEW handlers:** `anthropicHandler` (POST `api.anthropic.com/v1/messages`), `googleGeminiHandler` (POST `generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`).

**Tests added:**
- `src/__tests__/unit/truth-audit-service.test.ts` — **23 Vitest tests.** ENGINE_WEIGHTS sum, calculateWeightedScore (empty, golden, 2-engine, 1-engine, consensus), hasConsensus (empty, single, golden, all≥80, boundary), calculateTruthScore (golden=84, consensus=95, penalty=69, consensus+penalty=80, clamp-0, clamp-100, empty), buildTruthAuditResult (golden, partial, penalty, empty).
- `src/__tests__/unit/multi-engine-action.test.ts` — **6 Vitest tests.** `runMultiEngineEvaluation()`: auth gate, invalid UUID, location not found, success + 4 inserts + revalidatePath, all-fail error, partial-success.
- `tests/e2e/10-truth-audit.spec.ts` — **6 Playwright tests.** Page title, TruthScoreCard render + 4 engines, EngineComparisonGrid 4 labels, EvaluationCard 4 engine rows, seed scores (95/65/90/88), Run Audit buttons ≥4.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/truth-audit-service.test.ts    # 23 tests passing
npx vitest run src/__tests__/unit/multi-engine-action.test.ts    # 6 tests passing
npx vitest run                                                     # 546 passing
npx next build                                                     # 0 errors
npx playwright test --project=chromium                             # 47 passing
```

**Verification:** 546 Vitest passing (510 baseline + 29 new), 0 skipped. Build clean. E2E: 47 specs (41 existing + 6 new).

---

## 2026-02-24 — Sprint 43: Revenue Leak Scorecard (Completed)

**Goal:** Convert AI inaccuracies into a dollar-denominated Revenue Leak Scorecard on the dashboard — 3-component model (Hallucination Cost + SOV Gap Cost + Competitor Steal Cost) with configurable business inputs.

**Scope:**
- `supabase/migrations/20260225000001_revenue_leak.sql` — **NEW.** DB migration: `revenue_config` (per-org business inputs) + `revenue_snapshots` (weekly leak history) tables with RLS policies, triggers, and grants.
- `supabase/seed.sql` — Added Section 15: revenue_config seed data (Charcoal N Chill: avg_ticket=$47.50, monthly_searches=2400, conversion=3.2%, walk_away=65%) + 3 revenue_snapshots (2-week trend).
- `lib/services/revenue-leak.service.ts` — **NEW.** Pure function service with zero side effects (AI_RULES §6). Exports `calculateHallucinationCost`, `calculateSOVGapCost`, `calculateCompetitorStealCost`, `calculateRevenueLeak`. Severity multipliers: critical=2.0, high=1.0, medium=0.3, low=0.1.
- `app/dashboard/_components/RevenueLeakCard.tsx` — **NEW.** Hero card: dollar range in alert-crimson, trend delta, 3 breakdown chips, plan-gating (trial/starter see Lock overlay), Configure Revenue Inputs link.
- `app/dashboard/_components/LeakBreakdownChart.tsx` — **NEW.** Tremor BarChart: Inaccuracies / SOV Gap / Competitor Steal with Low/High estimates.
- `app/dashboard/_components/LeakTrendChart.tsx` — **NEW.** Tremor AreaChart: weekly leak trend, green if trending down, pink if trending up.
- `app/dashboard/page.tsx` — Added revenue data fetching (revenue_config, revenue_snapshots, org plan), live leak computation via `calculateRevenueLeak()`, placed RevenueLeakCard above AlertFeed and charts below Quick Stats.
- `app/dashboard/settings/revenue/page.tsx` — **NEW.** Revenue Config settings page, fetches existing config from DB.
- `app/dashboard/settings/revenue/actions.ts` — **NEW.** `saveRevenueConfig()` Server Action with Zod validation, %-to-decimal conversion, upsert on `org_id,location_id`.
- `app/dashboard/settings/revenue/_components/RevenueConfigForm.tsx` — **NEW.** Client form: avg_ticket, monthly_searches, conversion rate (%), walk-away rate (%).

**Tests added:**
- `src/__tests__/unit/revenue-leak-service.test.ts` — **17 Vitest tests.** All 4 exported functions: empty arrays, single/mixed severities, open-only filter, low=60%×high, SOV gap thresholds, competitor steal losses, integration sums, golden tenant scenario, low≤high invariant.
- `src/__tests__/unit/revenue-leak-action.test.ts` — **6 Vitest tests.** `saveRevenueConfig()`: auth gate, avg_ticket validation, conversion rate cap, no-location error, success + revalidatePath, DB error propagation.
- `tests/e2e/09-revenue-leak.spec.ts` — **5 Playwright tests.** Dashboard card render + dollar range, 3 breakdown chips, Configure link navigation, settings page pre-fill, form submit + persistence.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/revenue-leak-service.test.ts   # 17 tests passing
npx vitest run src/__tests__/unit/revenue-leak-action.test.ts    # 6 tests passing
npx vitest run                                                     # 510 passing, 7 skipped
npx next build                                                     # 0 errors
```

**Verification:** 510 Vitest passing (487 baseline + 23 new), 7 skipped. Build clean. E2E: 41 specs (36 existing + 5 new).

---

## 2026-02-24 — Copy Tremor Raw Chart Components (Completed)

**Goal:** Copy 5 Tremor Raw chart components from tremor.so for dashboard visualizations. Copy-paste only — NOT the `@tremor/react` npm package.

**Scope:**
- `components/tremor/AreaChart.tsx` — **NEW.** ~620 lines. SOV trend, revenue leak timeline.
- `components/tremor/BarChart.tsx` — **NEW.** ~600 lines. Competitor gap bars, query magnitude.
- `components/tremor/DonutChart.tsx` — **NEW.** ~310 lines. Share of voice breakdown.
- `components/tremor/CategoryBar.tsx` — **NEW.** ~230 lines. Segmented score visualization.
- `components/tremor/BarList.tsx` — **NEW.** ~155 lines. Ranked horizontal bars.
- `components/tremor/Tooltip.tsx` — **NEW.** ~90 lines. Radix-based tooltip (CategoryBar marker dependency).
- `components/tremor/index.ts` — **NEW.** Barrel export for all 5 chart components.

**All components import from existing foundation:** `@/lib/chartUtils`, `@/lib/useOnWindowResize`, `@/lib/utils` (cx). Source: Tremor Raw (Apache 2.0).

**Tests added:**
- `src/__tests__/unit/tremor-charts.test.ts` — **6 Vitest tests.** Module export verification for all 5 components + barrel re-export.

**Verification:** 487 Vitest passing (481 + 6 new), 36 Playwright E2E passing. `npx next build` clean.

---

## 2026-02-24 — Tremor Raw Foundation (Copy-Paste Utilities, No Chart Components Yet) (Completed)

**Goal:** Install the Tremor Raw foundation layer — utility files and npm deps that Tremor chart components need. **NOT** the `@tremor/react` npm package (incompatible with Tailwind v4). No actual chart components copied yet.

**Scope:**
- `package.json` — Added `@remixicon/react@^4.9.0` (chart legend pagination icons), `tailwind-variants@^3.2.2` (Tremor UI `tv()` variant utility).
- `lib/utils.ts` — Added `cx()` export (identical to `cn()`, Tremor convention), `focusInput`, `focusRing`, `hasErrorInput` utility arrays. Existing `cn()` unchanged.
- `lib/chartUtils.ts` — **NEW.** Chart color mapping (9 colors, indigo-first to match brand), `constructCategoryColors`, `getColorClassName`, `getYAxisDomain`, `hasOnlyOneValueForKey`.
- `lib/useOnWindowResize.ts` — **NEW.** Responsive resize hook for chart tooltip repositioning.
- `components/tremor/` — **NEW.** Empty directory for future chart components (separate from `components/ui/` shadcn territory).

**Color remapping:** Tremor default `blue-500` → `indigo-500` (matches electric-indigo brand). Focus states use `electric-indigo`, error states use `alert-crimson`.

**Verification:** 481 Vitest passing, 36 Playwright E2E passing. `npx next build` clean. shadcn `cn` import in `components/ui/button.tsx` still resolves.

---

## 2026-02-24 — Manual shadcn/ui Installation with Tailwind v4 Safe Merge (Completed)

**Goal:** Install shadcn/ui component library manually (never `npx shadcn@latest init` — it overwrites `globals.css`). Surgically merge CSS variables into existing Deep Night design system.

**Scope:**
- `package.json` — Added `class-variance-authority@^0.7.1`, `clsx@^2.1.1`, `tailwind-merge@^3.5.0`, `tw-animate-css@^1.4.0`, `radix-ui@^1.4.3` (auto-installed by shadcn CLI).
- `lib/utils.ts` — **NEW.** `cn()` helper (clsx + tailwind-merge). Coexists with `lib/utils/` directory (no barrel export conflict).
- `components.json` — **NEW.** shadcn/ui config (new-york style, rsc: true, lucide icons, `@/components/ui` alias).
- `components/ui/button.tsx` — **NEW.** shadcn Button component (validates full CLI pipeline).
- `app/globals.css` — Added `@import "tw-animate-css"`, 38 `--color-*` shadcn tokens in `@theme inline` (mapped to `:root` CSS vars), 4 `--radius-*` tokens. `:root` expanded with full shadcn variable set mapped to Deep Night palette (signal-green → primary, electric-indigo → accent, alert-crimson → destructive, surface-dark → card).
- `.npmrc` — **NEW.** `legacy-peer-deps=true` (required for Zod v4 peer dep conflicts in shadcn CLI installs).

**Design system integrity:** All 8 existing color tokens, 11 keyframes, 6 `.lv-*` utility classes, body styles, and responsive media query preserved unchanged.

**Verification:** 481 Vitest passing, 36 Playwright E2E passing. `npx next build` clean. `npx shadcn@latest add button --yes` succeeds.

---

## 2026-02-24 — Refactor: Migrate @vercel/kv → @upstash/redis (Completed)

**Goal:** Replace deprecated `@vercel/kv` with direct `@upstash/redis` dependency. Zero breaking changes — existing Vercel env vars (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) continue to work via fallback.

**Scope:**
- `lib/redis.ts` — **NEW.** Centralized lazy Redis client with `getRedis()`. Reads `UPSTASH_REDIS_REST_URL` (preferred) or `KV_REST_API_URL` (Vercel legacy fallback).
- `app/actions/marketing.ts` — Replaced `import { kv } from '@vercel/kv'` with `import { getRedis } from '@/lib/redis'`. Updated 3 `kv.` calls to `getRedis().` (incr, expire, ttl).
- `app/api/public/places/search/route.ts` — Same pattern: import swap + 2 `kv.` → `getRedis().` calls (incr, expire).
- `src/__tests__/unit/rate-limit.test.ts` — Mock updated from `vi.mock('@vercel/kv')` to `vi.mock('@/lib/redis')` with `mockRedis` shared object.
- `src/__tests__/unit/free-scan-pass.test.ts` — Same mock pattern swap.
- `src/__tests__/unit/public-places-search.test.ts` — Same mock pattern swap + all `kv.` assertion references → `mockRedis.`.
- `package.json` — Removed `@vercel/kv`, added `@upstash/redis@^1.36.2`.

**Verification:** 481 Vitest passing, 36 Playwright E2E passing. `npx next build` clean. Zero stale `@vercel/kv` imports in source.

---

## 2026-02-24 — AI SDK Provider Install: @ai-sdk/anthropic + @ai-sdk/google (Completed)

**Goal:** Install Anthropic and Google AI SDK providers for multi-engine Truth Audit (Feature #2). No changes to existing AI service logic.

**Scope:**
- `package.json` — Added `@ai-sdk/anthropic@^1.2.12` and `@ai-sdk/google@^1.2.22` (v1.x for LanguageModelV1 compatibility with `ai@4.3.x`).
- `lib/ai/providers.ts` — Added `createAnthropic` and `createGoogleGenerativeAI` imports. New `anthropic` and `google` provider instances. 4 new model registry entries (`truth-audit-anthropic`, `truth-audit-gemini`, `truth-audit-openai`, `truth-audit-perplexity`). Expanded `hasApiKey()` to support `'anthropic'` and `'google'` providers.

**Key decision:** `@ai-sdk/anthropic@3.x` and `@ai-sdk/google@3.x` use `@ai-sdk/provider@3.x` (LanguageModelV3), which is incompatible with existing `ai@4.3.x` (expects LanguageModelV1). Downgraded to v1.x releases which use `@ai-sdk/provider@1.x`.

**Tests added:**
- `src/__tests__/unit/ai-providers.test.ts` — **5 Vitest tests.** Provider exports, truth-audit model keys, getModel resolution, unknown key throw, hasApiKey boolean returns.

**Verification:** 481 Vitest passing (476 + 5 new), 36 Playwright E2E passing. `npx next build` clean.

---

## 2026-02-24 — Package Install: schema-dts, jszip, @react-email/components (Completed)

**Goal:** Install three zero-risk packages for upcoming killer features. No changes to existing code.

**Scope:**
- `package.json` — Added `schema-dts` (typed Schema.org JSON-LD, Feature #3), `jszip` (ZIP bundle downloads, Feature #3), `@react-email/components` (React email templates, Feature #7), `@types/jszip` (devDep).
- `lib/schema/types.ts` — **NEW.** Schema.org typed re-exports + `toJsonLdScript<T extends Thing>()` helper.
- `lib/utils/zipBundle.ts` — **NEW.** `createZipBundle()` ZIP generator wrapping JSZip.
- `emails/WeeklyDigest.tsx` — **NEW.** Weekly digest React Email template scaffold (SOV stats, first mover alerts, CTA).

**Tests added:**
- `src/__tests__/unit/schema-types.test.ts` — **1 Vitest test.** Validates `toJsonLdScript` wraps typed Schema.org objects in `<script>` tags.
- `src/__tests__/unit/zip-bundle.test.ts` — **2 Vitest tests.** ZIP creation with files and empty file list.

**Verification:** 476 Vitest passing (473 + 3 new), 36 Playwright E2E passing. `npx next build` clean.

---

## 2026-02-24 — Docs Sync: Eliminate Stale/Missing Documentation (Completed)

**Goal:** Audit all docs for conflicts, stale counts, and missing information after Sprint 42 + E2E fixes.

**Scope:**
- `docs/DEVLOG.md` — **CREATED.** Never existed in git despite being referenced by CLAUDE.md and AI_RULES §13. Built from full git history (Phases 1-9 through Sprint 42), includes current test counts and E2E spec inventory table.
- `docs/AI_RULES.md` — Added Rule §29: Playwright E2E Spec Patterns (locator hygiene, API-result-agnostic assertions, auth session files, test count verification). All 28 existing rules verified as current — no conflicts.
- `docs/DESIGN-SYSTEM.md` — Added Tailwind v4 design tokens section (midnight-slate, surface-dark, electric-indigo, signal-green, alert-crimson, truth-emerald, alert-amber) with usage contexts. Legacy `T.` object preserved for marketing pages.
- `docs/CHECKPOINT_1.md` — Updated test counts (336→473 Vitest, added 36 E2E), feature list expanded to include Surgeries 1-6 and Sprints 35-42. "Not built" list trimmed from 8 to 2 items.
- `app/pricing/page.tsx` — Fixed wrong comment: "electric-indigo" → "signal-green" (matches actual `border-signal-green` implementation).
- `docs/DESIGN-SYSTEM-COMPONENTS.md` — Verified current, no changes needed.
- `docs/14_TESTING_STRATEGY.md` — Removed deleted `viral-wedge.spec.ts` from E2E spec table. Updated table to 12 spec files / 36 tests. Fixed stale "racy isPending" note referencing the deleted file.

---

## 2026-02-24 — E2E Fix: Repair 7 Pre-existing Failures (Completed)

**Goal:** Fix all 7 pre-existing E2E test failures that predated Sprint 42.

**Scope:**
- `tests/e2e/01-viral-wedge.spec.ts` — Rewrote for Sprint 33 redirect-to-/scan flow. Added `.first()` for duplicated scanner form (hero + CTA). Button text → "Run Free AI Audit". API-result-agnostic heading assertion (real Perplexity returns pass or fail).
- `tests/e2e/viral-wedge.spec.ts` — **DELETED**. Outdated pre-Sprint-29 spec superseded by `01-viral-wedge.spec.ts`.
- `tests/e2e/03-dashboard-fear-first.spec.ts` — Reality Score now shows `—` (em-dash) when no visibility scan data exists. Changed assertion from `87` to `—`.
- `tests/e2e/billing.spec.ts` — Growth card highlight changed from `border-electric-indigo` to `border-signal-green`. Tier name locators use `getByRole('heading')` to avoid footer text matches.

**Verification:** 36/36 Playwright E2E tests passing. 473 Vitest tests passing.

---

## 2026-02-24 — Sprint 42: Dashboard Polish & Content Drafts UI (Completed)

**Goal:** Close 5 dashboard gaps — null states, Content Drafts UI, SOV query editor, listings health, E2E coverage.

**Scope:**

*Gap #5 — Null States:*
- `app/dashboard/page.tsx` — Welcome banner for day-1 tenants (no visibility data).
- `app/dashboard/share-of-voice/_components/SOVScoreRing.tsx` — Standardized null-state copy with `nextSundayLabel()`.
- `app/dashboard/share-of-voice/page.tsx` — "Last Scan" null state: "Runs Sunday, {date}".

*Gap #1 — Content Drafts UI:*
- `components/layout/Sidebar.tsx` — Added "Content" nav item with `FileText` icon.
- `app/dashboard/content-drafts/page.tsx` — **NEW.** Server Component. Plan-gated (Growth+). Summary strip, filter tabs, draft cards.
- `app/dashboard/content-drafts/actions.ts` — **NEW.** Server Actions: `approveDraft`, `rejectDraft`, `createManualDraft`.
- `app/dashboard/content-drafts/_components/ContentDraftCard.tsx` — **NEW.** Client Component. Trigger badges, AEO score, status, approve/reject.
- `app/dashboard/content-drafts/_components/DraftFilterTabs.tsx` — **NEW.** URL search param filter tabs.

*Gap #2 — SOV Query Editor:*
- `app/dashboard/share-of-voice/actions.ts` — Added `deleteTargetQuery` action.
- `app/dashboard/share-of-voice/_components/SovCard.tsx` — Delete button + plan-gated run button (Growth+ only).
- `app/dashboard/share-of-voice/page.tsx` — Passes `plan` prop to SovCard.

*Gap #3 — Listings Health:*
- `app/dashboard/integrations/_utils/health.ts` — **NEW.** `getListingHealth()`, `healthBadge()` utilities.
- `app/dashboard/integrations/_components/PlatformRow.tsx` — Health badges on each platform row.
- `app/dashboard/integrations/page.tsx` — Health summary stats in page header.

*Gap #4 — E2E Coverage:*
- `tests/e2e/06-share-of-voice.spec.ts` — **NEW.** 4 tests: header, score ring, quick stats, sidebar nav.
- `tests/e2e/07-listings.spec.ts` — **NEW.** 4 tests: header, location card, summary strip, sidebar nav.
- `tests/e2e/08-content-drafts.spec.ts` — **NEW.** 3 tests: header + summary strip, filter tabs, sidebar nav.

*Unit tests:*
- `src/__tests__/unit/components/dashboard-null-states.test.tsx` — SOVScoreRing + welcome banner null state assertions.
- `src/__tests__/unit/components/content-drafts/ContentDraftCard.test.tsx` — Trigger badges, AEO thresholds, approve/reject.
- `src/__tests__/unit/content-drafts-actions.test.ts` — Approve, reject, create, auth failure, plan gating.
- `src/__tests__/unit/share-of-voice-actions.test.ts` — Added deleteTargetQuery tests.
- `src/__tests__/unit/components/sov/SovCard-plan-gate.test.tsx` — Run button gating by plan tier.
- `src/__tests__/unit/integrations-health.test.ts` — All 4 health states, edge cases.

**Verification:** 473 Vitest passing, 36 Playwright E2E passing. `npx next build` clean.

---

## 2026-02-23 — Surgeries 4-6, Sprint 40 Design System, Sprint 41 SOV Enhancement (Completed)

**Goal:** Complete surgical integrations (Citations, Occasions, Autopilot), apply dark design system across dashboard, enhance SOV page.

**Scope:**
- Surgery 4: Citation Intelligence cron + dashboard integration.
- Surgery 5: Occasion Engine seasonal scheduler.
- Surgery 6: Autopilot content draft pipeline.
- Sprint 40: Dark design system applied to all dashboard pages (midnight-slate/surface-dark backgrounds, electric-indigo accents).
- Sprint 41: SOV page enhancements — score ring, trend chart, first mover cards, query seeding.

---

## 2026-02-23 — Surgery 3: Content Crawler + Page Auditor (Completed)

**Goal:** Build content crawling and AEO page auditing infrastructure.

**Scope:**
- `app/api/cron/content-audit/route.ts` — Content audit cron route handler.
- Content Grader integration with AEO scoring pipeline.

---

## 2026-02-23 — Surgery 2: Build SOV Engine Cron (Completed)

**Goal:** Implement weekly Share of Voice evaluation cron.

**Scope:**
- `app/api/cron/sov/route.ts` — SOV evaluation cron route handler.
- Queries `target_queries` table, runs AI evaluations, writes to `sov_evaluations`.

---

## 2026-02-23 — Surgery 1: Replace raw fetch() with Vercel AI SDK (Completed)

**Goal:** Swap all raw `fetch()` calls to OpenAI/Perplexity with Vercel AI SDK.

**Scope:**
- All AI service files migrated from raw `fetch()` to `generateText()` / `generateObject()`.
- Consistent error handling and token tracking.

---

## 2026-02-23 — Sprints 37-40: Landing Page Rebuild, Scan Polish, Build Hardening, Design System (Completed)

**Goal:** Rebuild marketing landing page, polish /scan results, harden build, apply dark design system.

**Scope:**
- Sprint 37: Landing page rebuild with new hero, case study, social proof sections.
- Sprint 38: /scan results page polish — competitive landscape, detected issues.
- Sprint 39: Build hardening — TypeScript strict, unused imports, dead code removal.
- Sprint 40: Deep Night design system applied to all dashboard pages.
- SVG logo mark replaced LV text badges across all nav/brand locations.

---

## 2026-02-22 — Sprint 35: Accuracy Issues Full Display + Issue Categories (Completed)

**Goal:** Display granular accuracy issues with parallel array categories on /scan page.

**Scope:**
- Parallel array pattern: `accuracy_issues[]` + `accuracy_issue_categories[]` (AI_RULES §28).
- /scan page renders categorized issues (hours, address, menu, phone, other).

---

## 2026-02-22 — Sprint 34: Real AI Audit Data, Honest Free/Locked Split (Completed)

**Goal:** Replace derived KPI lookup tables with real Perplexity categorical data. Rename "Hallucination Scanner" → "AI Audit".

**Scope:**
- Free tier shows real categorical fields: `mentions_volume`, `sentiment` (with "Live" badge).
- Locked tier shows `██/100` with "Sign up to unlock" for AI Visibility Score and Citation Integrity.
- Removed `deriveKpiScores` lookup table (AI_RULES §26).
- "Hallucination Scanner" renamed to "AI Audit" across all user-facing copy.

---

## 2026-02-22 — Sprint 33: Smart Search, Diagnostic Screen, Public /scan Dashboard (Completed)

**Goal:** ViralScanner on landing page redirects to /scan dashboard with result params.

**Scope:**
- `app/scan/page.tsx` — **NEW.** Public /scan dashboard with pass/fail/unavailable states.
- ViralScanner form submits → redirects to `/scan?status=pass|fail|unavailable&...` with URL params.
- Inline result cards only for `unavailable` / `rate_limited` states.

---

## 2026-02-22 — Sprint 32: US vs Them Table, Brand Positioning (Completed)

**Goal:** Add competitive positioning section to landing page.

---

## 2026-02-22 — Sprints 30 + 31: Dashboard Honesty + ViralScanner Integrity (Completed)

**Goal:** Eliminate fake timestamps, hardcoded status lists, and fabricated scan results.

**Scope:**
- AI_RULES §23 (no fake timestamps), §24 (no fabricated scan results) codified.
- `scan-health-utils.ts` — `nextSundayLabel()`, `formatRelativeTime()` utilities.
- ViralScanner: `unavailable` result state for missing API key / API errors.

---

## 2026-02-22 — Sprint 29: Robust ViralScanner Autocomplete (Completed)

**Goal:** Google Places autocomplete for business name input on landing page.

**Scope:**
- `app/api/public/places/search/route.ts` — Public Places autocomplete endpoint.
- AI_RULES §22 (public endpoint pattern) codified.
- IP-based rate limiting via Vercel KV.

---

## 2026-02-22 — Sprint 28B: Fix is_closed Boolean Bug (Completed)

**Goal:** `runFreeScan()` was ignoring `is_closed` boolean from Perplexity, always returning `fail`.

**Scope:**
- AI_RULES §21 (always use every parsed field) codified.
- Both branches tested: `is_closed=true` → fail, `is_closed=false` → pass.

---

## 2026-02-22 — Sprint 28: High-Converting Landing Page (Completed)

**Goal:** Build the Deep Navy / Signal Green / Alert Amber landing page.

---

## 2026-02-21 — Sprints 24A-27A: V1 Launch Blockers (Completed)

**Goal:** Clear all V1 launch blockers. 295 tests passing.

**Scope:**
- Sprint 24A: Null state standardization (AI_RULES §20).
- Sprint 25A: Pricing page (Starter/Growth/Agency tiers).
- Sprint 25C: AEO infrastructure (`/llms.txt`, `/ai-config.json`).
- Sprint 26: Stripe checkout + webhooks.
- Sprint 27A: Sentry monitoring integration.

---

## 2026-02-21 — Phase 3.1: Google Places Autocomplete + Cron Competitor Intercepts (Completed)

**Goal:** Add Places autocomplete to competitor add flow, schedule competitor intercept cron.

---

## 2026-02-21 — Phase 3: Competitor Intercept (Greed Engine) — 243 Tests (Completed)

**Goal:** Build Greed Engine competitor analysis with gap detection.

**Scope:**
- `lib/services/competitor-intercept.service.ts` — GPT-4o-mini analysis.
- AI_RULES §19 (JSONB types, plan limits, MSW discrimination) codified.

---

## 2026-02-20 — Phase 20: Sync AI_RULES, Backfill DEVLOG, Core Loop + Testing Docs (Completed)

**Goal:** Documentation sync after Phase 19 E2E milestone.

---

## 2026-02-20 — Phase 19: E2E Test Suite — 182 Tests (157 Vitest + 25 Playwright) (Completed)

**Goal:** Full Playwright E2E coverage for all user flows.

**Scope:**
- 12 E2E spec files covering auth, onboarding, dashboard, magic menus, honeypot, billing.
- `workers: 1` serialization in `playwright.config.ts`.
- `tests/e2e/global.setup.ts` — Provisions e2e-tester@, resets incomplete@ + upload@.

---

## 2026-02-20 — Phase 18: Monetization + E2E Regression Fix (Completed)

**Goal:** Billing page, Stripe integration scaffold, fix E2E regressions.

---

## 2026-02-19 — Phases 1-9: Foundation Build (Completed)

**Goal:** Complete foundational build from auth through AI monitoring.

**Scope:**
- Phase 0-1: Next.js scaffold + Auth API with MSW guards.
- Phase 2-3: Auth UI, middleware (`proxy.ts`), RLS-scoped dashboard.
- Phase 4: Server Actions, Zod validation, working RLS.
- Phase 5-6: Magic Menus CRUD, nested menu editor.
- Phase 7: LLM Honeypot with public RLS and JSON-LD.
- Phase 8: Integrations scaffolding (Big 6 platforms).
- Phase 9: AI Hallucination Monitor with Perplexity Sonar.

---

## Current Test Counts (2026-02-25)

| Suite | Count | Command |
|-------|-------|---------|
| Vitest unit/integration | 711 passing, 7 skipped | `npx vitest run` |
| Playwright E2E | 47 passing (14 spec files) | `npx playwright test --project=chromium` |

### E2E Spec Inventory

| File | Tests | Coverage |
|------|-------|----------|
| `01-viral-wedge.spec.ts` | 6 | Public scanner form, /scan redirect, eyebrow badge, $12k case study, /llms.txt, /ai-config.json, autocomplete |
| `02-onboarding-guard.spec.ts` | 1 | Guard fires, wizard completes, redirects to /dashboard |
| `03-dashboard-fear-first.spec.ts` | 5 | Alert feed, Reality Score, Quick Stats, mobile hamburger, sidebar nav, Fix CTA |
| `04-magic-menu-pipeline.spec.ts` | 1 | Full pipeline: Simulate AI Parsing → triage → publish → LinkInjectionModal |
| `05-public-honeypot.spec.ts` | 4 | Business name, menu items, JSON-LD blocks, /llms.txt, /ai-config.json |
| `06-share-of-voice.spec.ts` | 4 | Header, score ring, quick stats, sidebar nav |
| `07-listings.spec.ts` | 4 | Header, location card + platforms, summary strip, sidebar nav |
| `08-content-drafts.spec.ts` | 3 | Header + summary strip, filter tabs (All/Drafts/Approved/Published/Archived), sidebar nav |
| `09-revenue-leak.spec.ts` | 5 | RevenueLeakCard render + dollar range, 3 breakdown chips, Configure link nav, settings pre-fill, form submit |
| `10-truth-audit.spec.ts` | 6 | Page title "AI Truth Audit", TruthScoreCard + 4 engines, EngineComparisonGrid, EvaluationCard rows, seed scores, Run Audit buttons |
| `auth.spec.ts` | 3 | Login layout, error on invalid creds, signup form fields |
| `billing.spec.ts` | 2 | Three tiers with Growth highlighted, upgrade demo mode |
| `hybrid-upload.spec.ts` | 2 | Upload tabs visible, CSV upload → ReviewState |
| `onboarding.spec.ts` | 1 | Redirect to /onboarding + 3-step wizard completion |

---
> **End of Development Log**
