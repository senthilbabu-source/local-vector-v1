# LocalVector.ai — Testing Strategy

> **Source:** This document is derived from `DEVLOG.md`, the `src/__tests__/` directory,
> and the `tests/e2e/` directory. Last updated: Sprint 67 (2026-02-26).
> All test counts are from the live `vitest run` and `playwright test` outputs.

---

## Overview

LocalVector.ai uses a two-layer test stack:

| Layer | Runner | Command | Result (current) |
|-------|--------|---------|------------------|
| Unit + Integration | Vitest | `npx vitest run` | **781 passing**, 7 skipped (after `supabase db reset`) |
| E2E Functional | Playwright | `npx playwright test` | 47 passing, 0 failing |

Tests MUST NOT call live external APIs (AI_RULES §4):
- All AI calls are intercepted by MSW (`src/mocks/handlers.ts`) — activated via `instrumentation.ts`
  when `NEXT_PUBLIC_API_MOCKING=enabled`.
- Stripe is cleared (`STRIPE_SECRET_KEY=`) so billing tests always hit the demo branch.
- Playwright runs the dev server with both flags set (see `playwright.config.ts` `webServer.command`).

---

## Unit & Integration Tests (Vitest)

### Test environment

- **Runner:** Vitest (v2, jsdom environment for component tests)
- **Fixtures:** `src/__fixtures__/golden-tenant.ts` — Charcoal N Chill canonical data used across all suites
- **Mocking:** MSW v2 handlers in `src/mocks/handlers.ts`
- **Config:** `vitest.config.ts` at project root

### Suite inventory

| File | Describe blocks | Tests | Skipped | Subject |
|------|----------------|-------|---------|---------|
| `src/__tests__/unit/auth-routes.test.ts` | POST /api/auth/register, POST /api/auth/login, POST /api/auth/logout | 15 | 0 | Phase 0–1: Auth API routes (register, login, logout) |
| `src/__tests__/unit/components/layout/DashboardShell.test.tsx` | DashboardShell, Sidebar — active route highlighting, TopBar | 22 | 0 | Phase 11: Deep Night shell components |
| `src/__tests__/unit/app/dashboard/layout.test.ts` | Auth Guard, Onboarding Guard (5 cases), Render Props | 16 | 0 | Phase 12: Dashboard layout guard logic |
| `src/__tests__/unit/components/onboarding/TruthCalibrationForm.test.tsx` | Step 1: Business Name, Step 2: Amenities, Step 3: Hours, Submit | 32 | 0 | Phase 12: Truth Calibration 3-step wizard |
| `src/__tests__/integration/onboarding-actions.test.ts` | Auth/authz, Zod validation, DB update, closed-day encoding, error handling | 15 | 0 | Phase 12: `saveGroundTruth()` Server Action |
| `src/__tests__/unit/cron-audit.test.ts` | GET /api/cron/audit | 15 | 0 | Phase 9+21+3.1+Sprint 49: Cron audit route + email alerts + intercept loop (3 tests added Phase 3.1); Sprint 49: +3 (kill switch, Inngest dispatch, Inngest fallback) |
| `src/__tests__/unit/places-search.test.ts` | GET /api/v1/places/search | 6 | 0 | Phase 3.1: Google Places proxy — 401 guard, short-query guard, absent-key guard, 5-suggestion proxy, non-200 fallback, network-error fallback |
| `src/__tests__/unit/competitor-intercept-service.test.ts` | competitor-intercept service | 8 | 0 | Phase 3.1: 2-stage Perplexity→GPT-4o-mini service — Perplexity URL, GPT-4o-mini URL + model, mock paths (no key / rejects), gap_analysis shape, INSERT error propagation |
| `src/__tests__/unit/generateMenuJsonLd.test.ts` | Restaurant structure, Menu sections, MenuItem, suitableForDiet, subjectOf | 30 | 0 | Phase 15: Menu JSON-LD generation |
| `src/__tests__/unit/parseCsvMenu.test.ts` | parseLocalVectorCsv, getLocalVectorCsvTemplate | 20 | 0 | Phase 14.5: CSV upload parsing |
| `src/__tests__/unit/reality-score.test.ts` | deriveRealityScore | 10 | 0 | Sprint 24A: `deriveRealityScore()` — null visibilityScore path (2 tests added) |
| `src/__tests__/unit/hallucination-classifier.test.ts` | demo fallback, with API key | 8 | 0 | Phase 21: `auditLocation()` — demo + OpenAI path |
| `src/__tests__/unit/plan-enforcer.test.ts` | canRunDailyAudit, canRunSovEvaluation, canRunCompetitorIntercept, maxLocations, maxCompetitors, canRunAutopilot, canRunPageAudit, canRunOccasionEngine, canConnectGBP | 32 | 0 | Phase 21 + pre-Phase 3 + Group F: Plan-tier gate helpers — all 9 exported functions (canRunAutopilot, canRunPageAudit, canRunOccasionEngine, canConnectGBP added Group F) |
| `src/__tests__/unit/share-of-voice-actions.test.ts` | addTargetQuery, runSovEvaluation | 16 | 0 | Phase 21: SOV Server Actions (mocked Supabase + fetch) |
| `src/__tests__/unit/verify-hallucination.test.ts` | verifyHallucinationFix | 8 | 0 | Phase 21: `verifyHallucinationFix()` Server Action |
| `src/__tests__/unit/rate-limit.test.ts` | runFreeScan — rate limiting | 6 | 0 | Phase 22: IP-based rate limit via Vercel KV — under limit, at limit, over limit, TTL, KV absent, KV throws |
| `src/__tests__/unit/competitor-actions.test.ts` | addCompetitor (7), deleteCompetitor (3), runCompetitorIntercept (8), markInterceptActionComplete (4) | 22 | 0 | Phase 3: Competitor Intercept Server Actions — auth, plan gate, Zod, 2-stage LLM mock, org_id scope, gap_analysis JSONB |
| `src/__tests__/unit/settings-actions.test.ts` | updateDisplayName, changePassword | 10 | 0 | Sprint 24B: Settings Server Actions — auth gate, Zod, DB success/error, revalidatePath |
| `src/__tests__/unit/listings-actions.test.ts` | savePlatformUrl | 6 | 0 | Sprint 27A: `savePlatformUrl()` — auth gate, Zod URL validation, DB upsert, revalidatePath |
| `src/__tests__/unit/free-scan-pass.test.ts` | runFreeScan — is_closed branching + unavailable + is_unknown + address + real fields | 17 | 0 | Sprint 28B+29+31+34+35: `runFreeScan()` — `is_closed=true` → `fail`, `is_closed=false` → `pass`, `no_api_key` → `unavailable`, HTTP error → `unavailable`, markdown JSON, text-detection, severity, address in prompt, `is_unknown=true` → `not_found`, regression guard, network failure → `unavailable`; Sprint 34: `mentions_volume` propagation, `sentiment` propagation, `accuracy_issues` propagation, Zod default for missing `mentions_volume`; Sprint 35: `accuracy_issue_categories` propagation, Zod default for missing `accuracy_issue_categories` |
| `src/__tests__/unit/public-places-search.test.ts` | GET /api/public/places/search | 8 | 0 | Sprint 29: Public Places autocomplete — valid query, short query (no Google call), missing API key, Google non-200, network error, 429 when over rate limit, KV absent bypasses, KV throws is absorbed |
| `src/__tests__/unit/scan-health-utils.test.ts` | formatRelativeTime, nextSundayLabel | 7 | 0 | Sprint 30: Pure timestamp utilities for AI Scan Health card — all relative time branches + next Sunday future-date assertion |
| `src/__tests__/unit/scan-params.test.ts` | parseScanParams, buildScanParams, buildSparklinePath | 14 | 0 | Sprint 33+34+35: `/scan` dashboard URL param encoding/decoding + sparkline; Sprint 34: removed `deriveKpiScores` (−4 tests), added real-field tests (+5: `mentions`, `sentiment`, `accuracyIssues`, graceful defaults, `buildScanParams` encoding); Sprint 35: +3 `issue_cats` tests (decode `hours\|address`, missing → `[]`, encode `address` in `buildScanParams`) |
| `src/__tests__/unit/sov-engine-service.test.ts` | SOV query execution, result aggregation, first mover category filtering | 11 | 0 | Surgery 2 + Bug Fix (query_category) + Sprint 48: SOV service — Perplexity mock, share_of_voice calculation, visibility_analytics upsert, First Mover Alert detection (category-filtered: discovery/occasion/near_me only), custom/comparison excluded, competitors-found exclusion. Sprint 48: `createDraft` mocked at module level. |
| `src/__tests__/unit/cron-sov.test.ts` | GET /api/cron/sov | 23 | 0 | Surgery 2 + Bug Fix (query_category) + Sprint 45 + Sprint 47 + Sprint 48 + Sprint 49: SOV cron route — CRON_SECRET auth guard (401), kill switch, empty batch, per-query execution, writeSOVResults call, email report, per-query error resilience, org-level failure, queries_cited tracking, query_category passthrough, occasion scheduler integration, occasion failure resilience; Sprint 47: +3 (prompt intelligence sub-step); Sprint 48: +5 (autopilot sub-steps); Sprint 49: +2 (Inngest dispatch, Inngest fallback to inline) |
| `src/__tests__/unit/prompt-intelligence-service.test.ts` | buildReferenceLibrary, detectQueryGaps, computeCategoryBreakdown | 16 | 0 | Sprint 47: Prompt Intelligence service — reference library builder (system queries, category breakdown), gap detection (untracked queries, competitor-discovered, zero-citation clusters), category breakdown computation |
| `src/__tests__/unit/occasion-engine-service.test.ts` | getDaysUntilPeak, checkOccasionAlerts, generateOccasionDraft, runOccasionScheduler | 19 | 0 | Sprint 45: Occasion Engine service — getDaysUntilPeak (fixed dates, next-year rollover, evergreen, exact-date), checkOccasionAlerts (empty/window/category-relevance/Redis-dedup/Redis-degradation/SOV-citation), generateOccasionDraft (all-conditions-met/daysUntilPeak-skip/cited-skip/idempotency/real-AI), runOccasionScheduler (empty/growth-drafts/starter-no-drafts) |
| `src/__tests__/unit/content-crawler.test.ts` | HTML parsing, Schema.org extraction | 8 | 0 | Surgery 3: Content crawler — heading extraction (H1–H6), meta tag parsing, Schema.org JSON-LD extraction, body text extraction, malformed HTML handling, empty page handling |
| `src/__tests__/unit/page-auditor.test.ts` | AEO scoring dimensions, weighted aggregation | 7 | 0 | Surgery 3: Page auditor — answer-first structure score, schema completeness score, keyword density score, FAQ presence detection, weighted formula aggregation, missing schema penalty, edge cases (empty content, no headings) |
| `src/__tests__/unit/mcp-tools.test.ts` | MCP tool registration, schema validation, resolution | 9 | 0 | Surgery 5: MCP tools — 4 tools registered, tool name validation, Zod v3 input schema validation, business name → orgId resolution (case-insensitive), response shape per tool, error handling (org not found) |
| `src/__tests__/unit/visibility-tools.test.ts` | makeVisibilityTools, tool definitions, return types | 5 | 0 | Surgery 6: Visibility tools for chat — `makeVisibilityTools(orgId)` returns 4 tools, Zod v4 schemas, `type` field in return for UI card mapping, Supabase query chain mock |
| `src/__tests__/unit/components/dashboard-null-states.test.tsx` | SOVScoreRing null state, welcome banner | 4 | 0 | Sprint 42: Dashboard null state copy verification |
| `src/__tests__/unit/components/content-drafts/ContentDraftCard.test.tsx` | Trigger badges, AEO thresholds, approve/reject | 10 | 0 | Sprint 42: Content Drafts card component |
| `src/__tests__/unit/content-drafts-actions.test.ts` | approveDraft, rejectDraft, createManualDraft, archiveDraft, editDraft, publishDraft, auth, plan gate | 23 | 0 | Sprint 42 + Sprint 48: Content Drafts Server Actions — approve, reject (fixed: returns to draft), manual create, auth gate, plan gate; Sprint 48: +13 (archiveDraft success/auth/DB, editDraft auth/blocks-approved/blocks-published, publishDraft auth/plan-gate/blocks-unapproved/blocks-human_approved-false) |
| `src/__tests__/unit/components/sov/SovCard-plan-gate.test.tsx` | Run button gating by plan tier, delete button | 6 | 0 | Sprint 42: SOV query editor plan-gating |
| `src/__tests__/unit/integrations-health.test.ts` | getListingHealth, healthBadge, edge cases | 8 | 0 | Sprint 42: Listings health utilities |
| `src/__tests__/unit/schema-types.test.ts` | toJsonLdScript typed wrapper | 1 | 0 | Package install: schema-dts typed helpers |
| `src/__tests__/unit/zip-bundle.test.ts` | createZipBundle with files, empty list | 2 | 0 | Package install: JSZip bundle generator |
| `src/__tests__/unit/ai-providers.test.ts` | Provider exports, truth-audit keys, getModel, hasApiKey | 5 | 0 | AI SDK install: Anthropic + Google provider integration |
| `src/__tests__/unit/tremor-charts.test.ts` | Module export verification: AreaChart, BarChart, DonutChart, CategoryBar, BarList + barrel | 6 | 0 | Tremor Raw chart components copy-paste |
| `src/__tests__/unit/revenue-leak-service.test.ts` | calculateHallucinationCost, calculateSOVGapCost, calculateCompetitorStealCost, calculateRevenueLeak | 17 | 0 | Sprint 43: Revenue Leak pure function service — severity multipliers, open-only filter, SOV gap thresholds, competitor steal, integration sums, golden tenant scenario |
| `src/__tests__/unit/revenue-leak-action.test.ts` | saveRevenueConfig | 6 | 0 | Sprint 43: Revenue Config Server Action — auth gate, Zod validation, no-location error, upsert success, DB error |
| `src/__tests__/unit/truth-audit-service.test.ts` | ENGINE_WEIGHTS, calculateWeightedScore, hasConsensus, calculateTruthScore, buildTruthAuditResult | 23 | 0 | Sprint 44: Truth Audit pure function service — weighted average (4 engines), consensus detection (≥80), bonus/penalty, clamping, golden tenant (score=84), partial data re-normalization |
| `src/__tests__/unit/multi-engine-action.test.ts` | runMultiEngineEvaluation | 6 | 0 | Sprint 44: Multi-engine Server Action — auth gate, Zod UUID, location not found, 4-engine parallel insert, all-fail error, partial-success |
| `src/__tests__/unit/citation-engine-service.test.ts` | extractPlatform, runCitationQuery, runCitationSample, writeCitationResults, calculateCitationGapScore, constants | 42 | 0 | Sprint 46: Citation Intelligence service — platform extraction (14 domains), citation query (mock/real/unparseable), sample orchestration (counting/no-key/resilience), DB upsert (frequency calc/errors), gap score (8 coverage scenarios), constants validation |
| `src/__tests__/unit/cron-citation.test.ts` | GET /api/cron/citation | 13 | 0 | Sprint 46: Citation cron route — CRON_SECRET auth guard (401), kill switch, service-role client, 180-combination processing, writeCitationResults count, summary accumulation (categories/metros/queries/platforms), per-combination error resilience, argument passthrough, zero-queries skip |
| `src/__tests__/unit/autopilot-score-content.test.ts` | scoreContentHeuristic dimensions, edge cases | 10 | 0 | Sprint 48: AEO scoring heuristic — high score for answer-first+keywords, low for generic, 0 for empty, null city, CTA bonus, title bonus, word count scaling, combined perfect score, missing categories |
| `src/__tests__/unit/autopilot-create-draft.test.ts` | determineContentType, buildContextBlock, generateDraftBrief, archiveExpiredOccasionDrafts | 17 | 0 | Sprint 48: Autopilot draft creation — content type mapping (6 trigger types), PENDING_DRAFT_CAP constant, context block builder (5 trigger types), mock brief generation (3: fallback/FAQ/business-name), occasion draft archival (2: empty/null-triggers) |
| `src/__tests__/unit/autopilot-publish.test.ts` | publishAsDownload, publishToGBP, publishToWordPress, truncateAtSentence | 19 | 0 | Sprint 48: Autopilot publish pipeline — download (6: HTML/JSON-LD/FAQPage/base64/meta/escaping), GBP (6: truncation/sentence-boundary/word-fallback/passthrough/refresh/missing-token), WordPress (4: REST-API/WP-blocks/auth-failure/draft-status), truncation (3: boundary/fallback/under-limit) |
| `src/__tests__/unit/autopilot-post-publish.test.ts` | schedulePostPublishRecheck, getPendingRechecks, completeRecheck | 13 | 0 | Sprint 48: Post-publish measurement — Redis scheduling (3: key-format/TTL/SET-add), pending scan (2: multiple-tasks/empty), graceful degradation (3: schedule/scan/cleanup), completion (2: key-delete/SET-remove) |
| `src/__tests__/unit/inngest-sov-cron.test.ts` | processOrgSOV | 11 | 0 | Sprint 49: Inngest SOV fan-out — query execution, cited counting, per-query resilience, all-fail `success: false`, email payload + failure absorbed, occasion engine called + failure absorbed, prompt intelligence called + failure absorbed, first mover tracking |
| `src/__tests__/unit/inngest-audit-cron.test.ts` | processOrgAudit, processOrgIntercepts | 9 | 0 | Sprint 49: Inngest Audit fan-out — processOrgAudit (5: zero hallucinations, insert+email, skip no location, email failure, throws on audit failure); processOrgIntercepts (4: no competitors, per-competitor calls, error absorption, no location) |
| `src/__tests__/unit/inngest-content-audit-cron.test.ts` | processLocationAudit | 6 | 0 | Sprint 49: Inngest Content Audit fan-out — plan cap (growth=9), starter homepage-only, score collection, page failure handling, continuation after failure, upsert shape |
| `src/__tests__/unit/stripe-webhook.test.ts` | POST /api/webhooks/stripe — signature verification, checkout.session.completed, subscription.updated, subscription.deleted | 18 | 0 | Sprint 67: Stripe webhook route handler — signature verification (4: missing secret, missing header, invalid sig, unhandled event), checkout.session.completed (8: plan mapping pro→growth/enterprise→agency, default growth, orgId precedence, fallback, stripe IDs, skip no org, DB error), subscription.updated (4: active/past_due/incomplete status mapping, skip no customer), subscription.deleted (2: downgrade to trial, skip no customer) |
| `src/__tests__/unit/email-service.test.ts` | sendHallucinationAlert, sendSOVReport, sendWeeklyDigest | 14 | 0 | Sprint 67: Email service (Resend) — sendHallucinationAlert (6: no-op missing key, send with correct params, singular/plural subject, dashboard URL in body, error propagation), sendSOVReport (5: no-op, send fields, First Mover include/omit, from address), sendWeeklyDigest (3: no-op, react: property, from address) |
| `src/__tests__/integration/rls-isolation.test.ts` | RLS cross-tenant isolation | 7 | 0 | RLS isolation — requires live DB (`supabase db reset`); all 7 pass after reset |

**Total (active suites):** **781 passing** across 56 suites (includes 7 rls-isolation tests now passing after `supabase db reset`)

*(Sprint 67: `stripe-webhook.test.ts` +18 (new), `email-service.test.ts` +14 (new). Sprint 67 total: +32 tests from 2 new suites. Sprint 49: `inngest-sov-cron.test.ts` +11 (new), `inngest-audit-cron.test.ts` +9 (new), `inngest-content-audit-cron.test.ts` +6 (new), `cron-sov.test.ts` 21→23 (+2), `cron-audit.test.ts` 12→15 (+3). Sprint 49 total: +31 tests from 3 new suites + 5 added to 2 existing suites. Sprint 48: `autopilot-score-content.test.ts` +10 (new), `autopilot-create-draft.test.ts` +17 (new), `autopilot-publish.test.ts` +19 (new), `autopilot-post-publish.test.ts` +13 (new), `content-drafts-actions.test.ts` 10→23 (+13), `cron-sov.test.ts` 16→21 (+5). Sprint 48 total: +77 tests from 4 new suites + 18 added to 2 existing suites. Sprint 47: `prompt-intelligence-service.test.ts` +16 (new), `cron-sov.test.ts` 13→16 (+3). Sprint 47 total: +19 tests from 1 new suite + 3 added to existing suite. Sprint 46: `citation-engine-service.test.ts` +42 (new), `cron-citation.test.ts` +13 (new). Sprint 46 total: +55 tests from 2 new suites. Sprint 45: `occasion-engine-service.test.ts` +19 (new), `cron-sov.test.ts` 11→13 (+2). Sprint 45 total: +21 tests from 1 new suite + 2 added to existing suite. Bug Fix (query_category): `sov-engine-service.test.ts` 9→11 (+2), `cron-sov.test.ts` 10→11 (+1). Net: +3 tests. Sprint 44: `truth-audit-service.test.ts` +23 (new), `multi-engine-action.test.ts` +6 (new), `rls-isolation.test.ts` 0→7 (previously skipped, now passing). Sprint 44 total: +36 tests from 2 new suites + 7 unblocked. Sprint 43: `revenue-leak-service.test.ts` +17 (new), `revenue-leak-action.test.ts` +6 (new). Sprint 43 total: +23 tests from 2 new suites. AI SDK provider install: `ai-providers.test.ts` +5. Package install: `schema-types.test.ts` +1, `zip-bundle.test.ts` +2. Sprint 42: `dashboard-null-states.test.tsx` +4, `ContentDraftCard.test.tsx` +10, `content-drafts-actions.test.ts` +10, `SovCard-plan-gate.test.tsx` +6, `integrations-health.test.ts` +8, `share-of-voice-actions.test.ts` +4 (deleteTargetQuery). Sprint 42 total: +46 tests from 5 new suites + 4 added to existing suite. Package+SDK installs: +8 from 3 new suites.)*

*(Sprint 35: `free-scan-pass.test.ts` 15→17 (+2: `accuracy_issue_categories` propagation + Zod default), `scan-params.test.ts` 11→14 (+3: `issue_cats` decode, missing → `[]`, encode). Sprint 34: `free-scan-pass.test.ts` 11→15 (+4 real-field propagation tests), `scan-params.test.ts` 10→11 (−4 deriveKpiScores, +5 real-field tests). Sprint 33: `scan-params.test.ts` +10 (new). Sprint 31: `free-scan-pass.test.ts` 10→11. Sprint 30: `scan-health-utils.test.ts` +7 (new). Sprint 29: `public-places-search.test.ts` +8 (new); `free-scan-pass.test.ts` 7→10. Sprint 28B: `free-scan-pass.test.ts` +7. Sprint 24A: `reality-score.test.ts` 8→10. Sprint 24B: `settings-actions.test.ts` +10. Sprint 27A: `listings-actions.test.ts` +6. Phase 22 correction: `generateMenuJsonLd.test.ts` 21→30, `parseCsvMenu.test.ts` 17→20. Pre-Phase 3: `plan-enforcer.test.ts` 12→16. Phase 3: `competitor-actions.test.ts` +22. Phase 3.1: `cron-audit.test.ts` 9→12; `places-search.test.ts` +6; `competitor-intercept-service.test.ts` +8. Group F: `plan-enforcer.test.ts` 16→32.)*

### Key validation subjects

**`onboarding-actions.test.ts` — Zod v4 + `hours_data` closed-day encoding**
This suite explicitly tests the `saveGroundTruth()` Server Action's handling of the `"closed"` literal
encoding (Doc 03 §15.1, AI_RULES §10). It verifies:
- `z.literal('closed')` is accepted for a closed day.
- `z.object({ open, close })` is accepted for an open day.
- A missing day key is not treated as closed.
- `parsed.error.issues[0]?.message` (Zod v4 API) is used for error extraction — never `.errors[0]`.

**`layout.test.ts` — Onboarding Guard (5 cases)**
Tests the 5 distinct conditions that determine whether `app/dashboard/layout.tsx` redirects to `/onboarding`:
- `hours_data=null` + `amenities=null` → redirect.
- `hours_data` populated → no redirect.
- `amenities` populated → no redirect.
- No primary location found → redirect.
- Auth missing → redirect to `/login` (separate Auth Guard path).

**`DashboardShell.test.tsx` — Deep Night visual identity**
Validates Tailwind literal class names applied by Sidebar, TopBar, and DashboardShell
(e.g., `bg-midnight-slate`, `bg-surface-dark/80`, `border-electric-indigo`).
All class assertions use exact literal strings — no dynamic class generation.

### `rls-isolation.test.ts` — DB prerequisite

This integration suite requires a live Supabase local stack with the full auth trigger chain
(`on_auth_user_created` → `on_user_created`). It fails in environments where `supabase db reset`
has not been run with a "Database error creating new user" error — this is a test infrastructure
prerequisite, not an application bug. The 7 `skip`s are deliberate skips within this suite for
tests that require a second tenant to be provisioned.

**After `npx supabase db reset` all 7 previously-skipped tests pass (488 total). In CI without a**
**running Supabase, 7 tests are skipped and the suite shows 487 passing — this does not block CI.**

---

## Mock Patterns

### Existing Mock Patterns

| Mock Target | Pattern | Used By |
|-------------|---------|---------|
| Perplexity Sonar | MSW `rest.post('https://api.perplexity.ai/...')` | Hallucination classifier, SOV actions, free scan |
| OpenAI GPT-4o | MSW `rest.post('https://api.openai.com/...')` | Menu OCR, competitor intercept |
| Stripe | Empty `STRIPE_SECRET_KEY` → demo branch | Billing tests |
| Google Places | MSW `rest.get('https://maps.googleapis.com/...')` | Places search tests |
| Supabase Auth | `vi.mock('@supabase/ssr')` | Auth route tests, server action tests |
| Upstash Redis | `vi.mock('@/lib/redis')` with `mockRedis` shared object | Rate limit tests, free scan, places search |

### New Mock Patterns (2026-02-24 Surgical Integration)

| Mock Target | Pattern | Used By |
|-------------|---------|---------|
| Vercel AI SDK `generateText()` | `vi.mock('ai', ...)` returning `{ text: '...' }` | SOV service, content crawler, page auditor, multi-engine action tests |
| Anthropic Messages API | MSW `http.post('https://api.anthropic.com/v1/messages')` | Truth Audit multi-engine tests |
| Google Gemini generateContent | MSW `http.post('https://generativelanguage.googleapis.com/...')` | Truth Audit multi-engine tests |
| Vercel AI SDK `tool()` | `vi.mock('ai', ...)` returning tool descriptor | Visibility tools tests |
| Supabase query chain `.select().eq().order().limit()` | `mockReturnThis()` chain + final `.eq()` resolving Promise | MCP tools, visibility tools tests |
| Perplexity custom provider | `vi.mock('@ai-sdk/openai', ...)` mocking `createOpenAI()` | SOV service tests |
| MCP `createMcpHandler()` | `vi.mock('mcp-handler', ...)` | MCP tools tests |

### New Mock Patterns (Sprint 48 Autopilot Engine)

| Mock Target | Pattern | Used By |
|-------------|---------|---------|
| Autopilot `createDraft()` | `vi.mock('@/lib/autopilot/create-draft', ...)` returning `null` | SOV engine service, cron-sov tests |
| Autopilot `archiveExpiredOccasionDrafts()` | `vi.mock('@/lib/autopilot/create-draft', ...)` returning `0` | cron-sov tests |
| Autopilot post-publish | `vi.mock('@/lib/autopilot/post-publish', ...)` returning `[]` / `undefined` | cron-sov tests |
| Autopilot publishers | `vi.mock('@/lib/autopilot/publish-download')`, `publish-gbp`, `publish-wordpress` | content-drafts-actions tests |
| Redis (autopilot) | `vi.mock('@/lib/redis')` with `getRedis()` returning mock SET/GET/DEL | autopilot-post-publish tests |
| AI `generateText()` (autopilot) | `vi.mock('ai', ...)` + `vi.mock('@/lib/ai/providers', ...)` | autopilot-create-draft tests |

### New Mock Patterns (Sprint 49 Inngest Job Queue)

| Mock Target | Pattern | Used By |
|-------------|---------|---------|
| Inngest client `send()` | `const mockInngestSend = vi.fn().mockRejectedValue(...)` + `vi.mock('@/lib/inngest/client', () => ({ inngest: { send: (...args) => mockInngestSend(...args) } }))` | cron-sov, cron-audit tests (default: throw → forces inline fallback; `mockResolvedValueOnce` for dispatch test) |
| `sleep()` (rate limit) | `vi.mock('@/lib/services/sov-engine.service', () => ({ sleep: vi.fn().mockResolvedValue(undefined) }))` | inngest-content-audit-cron tests (prevents real 1s delay per page) |

### New Mock Patterns (Sprint 67 Stripe Webhook + Email)

| Mock Target | Pattern | Used By |
|-------------|---------|---------|
| Stripe constructor | `vi.mock('stripe', () => ({ default: class MockStripe { webhooks = { constructEvent: mockFn } } }))` — class mock avoids arrow-function-not-a-constructor error with `new Stripe()` | stripe-webhook tests |
| Resend constructor | `vi.mock('resend', () => ({ Resend: class MockResend { emails = { send: mockSend } } }))` — same class mock pattern for `new Resend()` | email-service tests |
| WeeklyDigest component | `vi.mock('@/emails/WeeklyDigest', () => ({ default: () => 'mock-element' }))` — inline to avoid Vitest hoisting TDZ | email-service tests |

---

## E2E Functional Tests (Playwright)

### Test environment

- **Runner:** Playwright (Chromium only — cross-browser is a separate concern)
- **Config:** `playwright.config.ts` (project root)
- **Workers:** `workers: 1` — all spec files run serially to prevent intra-run race conditions
  on the shared `upload@localvector.ai` test user
- **Web server:** `NEXT_PUBLIC_API_MOCKING=enabled STRIPE_SECRET_KEY= npm run dev`
  (MSW active, Stripe demo mode)
- **Global setup:** `tests/e2e/global.setup.ts` — provisions test users via Supabase Admin API,
  resets DB state, saves 4 auth sessions to `.playwright/*.json`
- **Base URL:** `http://localhost:3000`
- **Timeout:** 30s per test (accommodates 2-second `setTimeout` in `runFreeScan`)
- **Prerequisites:** `npx supabase db reset` before each full run to restore seed state

### Test user accounts

| User | Credentials | Purpose |
|------|-------------|---------|
| `dev@localvector.ai` | `Password123!` | Golden tenant (Charcoal N Chill, full data) |
| `incomplete@localvector.ai` | `Password123!` | Onboarding guard trigger (NULL hours_data + amenities) |
| `upload@localvector.ai` | `Password123!` | Magic menu pipeline (complete location, no magic_menus) |
| `e2e-tester@localvector.ai` | provisioned by `global.setup.ts` | Fear First dashboard tests |

### Spec inventory

| Spec file | Tests | Auth | Coverage |
|-----------|-------|------|----------|
| `tests/e2e/01-viral-wedge.spec.ts` | 6 | None (public) | Scanner form → /scan redirect, eyebrow badge, $12k case study, AEO endpoints, autocomplete flow |
| `tests/e2e/02-onboarding-guard.spec.ts` | 1 | `incomplete@` | Guard fires on `/dashboard/magic-menus` → redirect `/onboarding` → wizard → `/dashboard` |
| `tests/e2e/03-dashboard-fear-first.spec.ts` | 5 | `e2e-tester@` | AlertFeed leads, Reality Score em-dash (no scan data), hamburger sidebar, Listings nav, Fix CTA |
| `tests/e2e/04-magic-menu-pipeline.spec.ts` | 1 | `upload@` | UploadState → Simulate AI Parsing → triage summary → certify → publish → LinkInjectionModal |
| `tests/e2e/05-public-honeypot.spec.ts` | 4 | None (public) | Page renders, Restaurant + Menu JSON-LD valid, `llms.txt` 200+structure, `ai-config.json` 200+GEO fields |
| `tests/e2e/06-share-of-voice.spec.ts` | 4 | `dev@` | Header, SOV score ring, quick stats, sidebar nav |
| `tests/e2e/07-listings.spec.ts` | 4 | `dev@` | Header, location card + platform rows, summary strip, sidebar nav |
| `tests/e2e/08-content-drafts.spec.ts` | 3 | `dev@` | Header + summary strip, filter tabs (All/Drafts/Approved/Published/Archived), sidebar nav |
| `tests/e2e/hybrid-upload.spec.ts` | 2 | `upload@` | Upload tabs visible, CSV upload → ReviewState |
| `tests/e2e/auth.spec.ts` | 3 | None (public) | Login layout, error on invalid creds, signup form fields |
| `tests/e2e/09-revenue-leak.spec.ts` | 5 | `dev@` | RevenueLeakCard render + dollar range, breakdown chips, Configure link nav, settings pre-fill, form submit |
| `tests/e2e/10-truth-audit.spec.ts` | 6 | `dev@` | Page title "AI Truth Audit", TruthScoreCard render + 4 engines, EngineComparisonGrid 4 labels, EvaluationCard 4 engine rows, seed scores (95/65/90/88), Run Audit buttons ≥4 |
| `tests/e2e/billing.spec.ts` | 2 | `dev@` | Three tiers with Growth highlighted (signal-green), upgrade demo mode |
| `tests/e2e/onboarding.spec.ts` | 1 | `incomplete@` | Redirect to /onboarding + 3-step wizard completion |

**Total: 47 tests, 47 passing, 0 failing** (Sprint 44, 2026-02-25)

### Key engineering decisions

**`workers: 1` — serial spec execution**
`04-magic-menu-pipeline.spec.ts` and `hybrid-upload.spec.ts` both write/read the `upload@` user's
`magic_menus` record. With parallel workers, `hybrid-upload`'s `beforeAll` reset could fire while
`04` was still executing, deleting the in-progress menu and causing `approveAndPublish()` to fail.
Serial execution (alphabetical order) guarantees `04` completes before `hybrid-upload` begins.

**Omitting exact tier counts in `04-magic-menu-pipeline.spec.ts`**
`simulateAIParsing()` calls real OpenAI `gpt-4o` when `OPENAI_API_KEY` is set. GPT-4o is
non-deterministic: it may score all items ≥0.85 (all Auto-Approved, zero Needs Review).
The spec asserts the always-present Triage Summary row labels (`Auto-approved`, `Needs review`,
`Must edit`) and checks that `Must Edit` tier never renders for the clear `SAMPLE_MENU_TEXT`.
This makes the test pass both with real GPT-4o and the deterministic mock fallback.

**`level: 1` heading scope in `05-public-honeypot.spec.ts`**
The public menu page emits both an `<h1>` (business name) and an `<h2>` inside the Menu JSON-LD
schema section with the same text. Without `level: 1`, Playwright's strict mode throws a multiple-
match violation. Adding `level: 1` scopes the assertion to the page's primary heading only.

**Skipping racy `isPending` assertions**
The `runFreeScan()` Server Action has a 2-second `setTimeout`, but on a warm dev server with MSW
the response can arrive before Playwright polls for the "Scanning AI Models…" loading text.
`01-viral-wedge.spec.ts` omits this assertion and waits directly for the /scan page heading
with a 10s timeout. The legacy `viral-wedge.spec.ts` was deleted (superseded by `01-viral-wedge`).

---

## Running the Tests

```bash
# Unit + integration (Vitest)
npx vitest run

# E2E (Playwright) — prerequisites:
# 1. Local Supabase must be running
npx supabase start

# 2. Reset DB to restore seed state (required before first run per session)
npx supabase db reset

# 3. Run all E2E tests (Playwright starts the dev server automatically)
npx playwright test

# Run a single spec
npx playwright test tests/e2e/01-viral-wedge.spec.ts

# Open Playwright UI
npx playwright test --ui
```

---

## Phase 5–8 Test Coverage (SOV Engine + Content Pipeline)

> **Added 2026-02-23** — Test specs for Phase 5 (SOV Engine), Phase 6 (Autopilot HITL), Phase 7 (Citation Intelligence + Content Grader), Phase 8 (GBP OAuth). These test files do not yet exist — they are the **required spec** for implementers building these phases.
>
> **Note (2026-02-24):** Some of these planned specs have been partially fulfilled by the Surgical Integration test suites above (e.g., `sov-cron.test.ts`, `page-auditor.test.ts`). The specs below remain as the full target — surgical suites cover the service/cron layer; the specs below additionally require HITL workflow, citation gap scoring, and GBP mapping tests.

### Unit Tests (Vitest)

| Test File | What It Covers | Spec Reference | Status |
|-----------|----------------|---------------|--------|
| `src/__tests__/unit/sov-cron.test.ts` | SOV cron query execution, `writeSOVResults()`, queryCap per plan | Doc 04c §4 | ✅ Partially covered (8 tests in surgical suite) |
| `src/__tests__/unit/visibility-score.test.ts` | `calculateVisibilityScore()` — including null state (no cron run yet), never returns 0 | Doc 04c §5 | Planned |
| `src/__tests__/unit/content-draft-workflow.test.ts` | `createDraft()` idempotency, HITL state machine, draft queue cap (max 5 pending) | Doc 19 §3–§4 | ✅ Fulfilled by Sprint 48: `autopilot-create-draft.test.ts` (17 tests), `autopilot-publish.test.ts` (19 tests), `autopilot-post-publish.test.ts` (13 tests), `content-drafts-actions.test.ts` (23 tests) |
| `src/__tests__/unit/page-auditor.test.ts` | 5-dimension scoring, `extractVisibleText()`, `extractJsonLd()`, FAQ schema detection | Doc 17 §2–§3 | ✅ Partially covered (7 tests in surgical suite) |
| `src/__tests__/unit/citation-gap-scorer.test.ts` | `calculateCitationGapScore()`, threshold (>= 0.30), `topGap` computation | Doc 18 §3 | Planned |
| `src/__tests__/unit/gbp-data-mapper.test.ts` | GBP hours → `HoursData` mapping, attribute → amenities mapping, timezone gap handling | Doc 09 Phase 8 | Planned |

### E2E Tests (Playwright)

| Test File | What It Covers | Spec Reference | Status |
|-----------|----------------|---------------|--------|
| `tests/e2e/content-draft-review.spec.ts` | Full HITL flow: draft list → review → edit → approve → publish (download target) | Doc 06 §9 | Planned |
| `tests/e2e/gbp-onboarding.spec.ts` | GBP OAuth connect → location picker → import → dashboard (no manual wizard) | Doc 09 Phase 8 | Planned |

### Critical Test Rules for Phase 5–8

1. **SOV cron tests** must mock Perplexity Sonar via MSW. Never call live Perplexity API in tests.
2. **Visibility score null state:** `calculateVisibilityScore()` must return `null` (not `0`) when `visibility_analytics` has no row for the org. Test this explicitly.
3. **HITL guarantee:** `POST /api/content-drafts/:id/publish` test must verify the server returns `403` when `human_approved: false` — even if called directly with a valid session token.
4. **GBP OAuth tokens:** Tests use fixture token data. Never write real OAuth tokens to the test database.

---

> **Last updated:** Sprint 67 (2026-02-26) — 47/47 E2E + 781 unit/integration passing. Sprint 67: +32 tests from 2 new suites (`stripe-webhook` +18, `email-service` +14). Sprint 49: +31 from 3 new suites + 5 added. Sprint 48: +77 from 4 new suites + 18 added. Sprint 47: +19 new. Sprint 46: +55 new. Sprint 45: +21. Sprint 44: +36. Sprint 43: +23. Sprint 42: +46 unit + 10 E2E. Sprint 36: +49 from Surgical Integration day.
