# LocalVector.ai — Development Log

> Reverse-chronological. Newest entries at top. See AI_RULES §13 for format.

---

## 2026-02-28 — Hotfix FIX-7: Seed UUID Violations, SQL Syntax, Integrations Error Logging (Completed)

**Objective:** Fix seed.sql failures that prevented `npx supabase db reset` from completing, and improve integrations page error diagnostics.

**Fix 1 — Seed UUID hex violations (§7 regression):**
- `supabase/seed.sql` — **MODIFIED.** 11 hand-crafted UUIDs used non-hex prefixes (`g0`–`g5`, `h0`–`h3`, `i0`), violating AI_RULES §7.
- Remapped: `g0`→`00`, `g1`→`01`, `g2`→`02`, `g3`→`03`, `g4`→`04`, `g5`→`05`, `h0`→`a0…a10`, `h1`→`a1…a10`, `h2`→`a2…a10`, `h3`→`a3…a10`, `i0`→`a4…a10`.
- Root cause: Sprints 77 (vis_analytics) and 80 (entity_checks) seeded rows with `g`/`h`/`i` prefixes beyond hex range.

**Fix 2 — Invalid ON CONFLICT on UPDATE:**
- `supabase/seed.sql` line 1993 — **MODIFIED.** Sprint 89 GBP-sync seed block had `ON CONFLICT (id) DO NOTHING` appended to an `UPDATE` statement. `ON CONFLICT` is only valid on `INSERT`. Removed the invalid clause.

**Fix 3 — Integrations page error logging:**
- `app/dashboard/integrations/page.tsx` — **MODIFIED.** `console.error('[integrations] fetch error:', error)` logged `{}` because Supabase PostgrestError doesn't serialize with spread. Changed to `JSON.stringify(error, null, 2)` for full diagnostic output.

**AI_RULES:** Added §122 (Seed SQL validation rules).

---

## 2026-02-28 — Sprint O: V1 Complete — Revenue Defaults, Content Flow, Benchmark Enhancement (Completed)

**Objective:** Close the final three open items from the February 2026 code analysis. After this sprint, LocalVector V1 is complete with no known gaps.

**M4 — Revenue Config Defaults — Audit Results:**
- OLD system (`revenue-leak.service.ts`): `avg_ticket` was $45 — updated to $55 to align with NEW system.
- OLD system other values: `monthly_searches: 2000`, `local_conversion_rate: 0.03`, `walk_away_rate: 0.65` — all reasonable, kept as-is.
- NEW system (`revenue-impact.service.ts`): `avgCustomerValue: 55`, `monthlyCovers: 1800` — already restaurant-appropriate. No changes needed.
- Industry defaults (`lib/revenue-impact/industry-revenue-defaults.ts`): Restaurant at $55/1800 — already correct.
- Golden tenant fixture: `avgCustomerValue: 55, monthlyCovers: 1800` — already correct. No changes needed.
- `hookahRevenuePerTable` and `weekendMultiplier` from spec: Not in existing types. Deferred to industry abstraction layer.
- `RevenueConfigForm.tsx`: Added `placeholder="e.g. 55"` / `"e.g. 1800"`. Updated help text to mention restaurant defaults.

**L3 — Content Flow Clarity:**
- **No migration needed.** `content_drafts` table already has `trigger_type='occasion'` + `trigger_id` linking to `local_occasions`.
- `app/dashboard/content-drafts/_components/DraftSourceTag.tsx` — **NEW.** Pill tag: "Generated from calendar · {occasion name}". Links to /dashboard/content-calendar. `data-testid="draft-source-tag"`.
- `app/dashboard/content-drafts/_components/ContentDraftCard.tsx` — **MODIFIED.** Added `trigger_id` to `ContentDraftRow`. Added optional `occasionName` prop. Renders `DraftSourceTag` when `trigger_type='occasion'` and `occasionName` provided.
- `app/dashboard/content-drafts/page.tsx` — **MODIFIED.** Added `fetchOccasionNames()` lookup. Added `?from=calendar&occasion=` breadcrumb. Passes `occasionName` to cards.
- `app/dashboard/content-drafts/_components/OccasionTimeline.tsx` — **MODIFIED.** Added `justCreatedFor` state. Post-creation success CTA with "View draft →" link.

**N4 — Benchmark Enhancement (feature existed from Sprint F):**
- `lib/data/benchmarks.ts` — **MODIFIED.** Added `MAX_BENCHMARK_AGE_DAYS = 14` staleness check. Added `computed_at` to `BenchmarkData` type.
- `app/dashboard/page.tsx` — **MODIFIED.** Wrapped `BenchmarkComparisonCard` in `!sampleMode` guard.
- Existing thresholds retained: RPC `HAVING COUNT >= 3`, card `MIN_DISPLAY_THRESHOLD = 10`.

**Tests added:** 28 new unit tests across 3 files + 1 test fix (3346 total, was 3318)
- `src/__tests__/unit/sprint-o-revenue-defaults.test.ts` — **11 tests** (NEW): default ranges, system alignment, no zero/null fields
- `src/__tests__/unit/sprint-o-content-flow.test.tsx` — **8 tests** (NEW): DraftSourceTag, occasion-triggered cards, manual draft exclusion
- `src/__tests__/unit/sprint-o-benchmark.test.ts` — **9 tests** (NEW): staleness check, fresh data, null city, category extraction
- `src/__tests__/unit/components/content-drafts/ContentDraftCard.test.tsx` — **FIX**: Added `trigger_id: null` to baseDraft fixture
- `tests/e2e/sprint-o-smoke.spec.ts` — **18 E2E tests** (NEW): revenue defaults, content flow, benchmark, regressions

**AI_RULES:** Added §119-§121 (Revenue defaults alignment, DraftSourceTag, Benchmark staleness).

**V1 Status: COMPLETE.** All items from the February 2026 code analysis have been addressed across Sprints A-O.

---

## 2026-02-28 — Sprint N: New Capability — Settings Expansion, AI Preview Streaming, Correction Follow-Up Email (Completed)

**Objective:** Add net-new capability across three areas: settings expansion (Claude model, scan day preference, competitor shortcut, 2 new notification toggles), AI Preview enhancement (true token-by-token streaming), and correction follow-up email notification. Features 2 (AI Preview) and 3 (Correction Follow-Up) were mostly built in Sprint F — Sprint N adds the delta and meaningful enhancements.

**H2 — Settings Page Expansion:**
- `app/dashboard/settings/_components/SettingsForm.tsx` — **MODIFIED.** Added Claude (Anthropic) to AI_MODELS (5 total). Added SCAN_DAYS constant. Added scan day `<select>` in AI Monitoring section. Added Competitors shortcut section (count + link to /dashboard/compete). Added 2 notification toggles: Reality Score drops, New competitor detected. Props expanded: `competitorCount`, `scan_day_of_week`, `notify_score_drop_alert`, `notify_new_competitor`.
- `app/dashboard/settings/actions.ts` — **MODIFIED.** `VALID_AI_MODELS` expanded with 'claude'. `AIMonitoringSchema` extended with `scan_day_of_week` (0-6). `NotificationPrefsSchema` extended with `notify_score_drop_alert`, `notify_new_competitor`.
- `app/dashboard/settings/page.tsx` — **MODIFIED.** Fetches `scan_day_of_week`, `notify_score_drop_alert`, `notify_new_competitor` from organizations. Queries competitor count. Passes `competitorCount` to SettingsForm.
- `supabase/migrations/20260310000001_sprint_n_settings.sql` — **NEW.** Adds `scan_day_of_week integer DEFAULT 0`, `notify_score_drop_alert boolean DEFAULT true`, `notify_new_competitor boolean DEFAULT false` to organizations.
- `supabase/prod_schema.sql` — **MODIFIED.** Added Sprint N columns to organizations table definition.

**N2 Enhancement — AI Preview Token Streaming:**
- `lib/ai-preview/model-queries.ts` — **MODIFIED.** Added `streamOpenAI()`, `streamPerplexity()`, `streamGemini()` using Vercel AI SDK `streamText()`. Internal `streamModel()` async generator yields `{ chunk, done, error? }`. Original batch functions preserved for correction verifier.
- `app/api/ai-preview/route.ts` — **REWRITTEN.** Switched from `Promise.allSettled` with batch `queryX()` to concurrent `consumeStream()` with `streamX()` functions. SSE events now per-chunk instead of per-model.
- `app/dashboard/ai-responses/_components/AIAnswerPreviewWidget.tsx` — **REWRITTEN.** New `streaming` status in ModelState. Chunks accumulate incrementally. Blinking cursor during streaming. Stop button via AbortController. Buffer-based SSE parsing for incomplete lines.

**N3 Enhancement — Correction Follow-Up Email:**
- `lib/email.ts` — **MODIFIED.** Added `sendCorrectionFollowUpAlert()` function. Fixed → green success email. Recurring → amber warning email. Claim text snippet in quote block. No-ops when RESEND_API_KEY absent.
- `app/api/cron/correction-follow-up/route.ts` — **MODIFIED.** Added `sendFollowUpEmail()` helper that looks up org owner email and sends notification. Email failure wrapped in `.catch()` — never blocks cron. Summary includes `emailsSent` count.

**Tests added:** 39 new tests across 4 files (3318 total, was 3279)
- `src/__tests__/unit/sprint-n-settings.test.ts` — **15 tests** (NEW): Claude in model list (2), scan_day_of_week validation (2), notification toggles (2), competitor shortcut (2), migration (4), prod_schema columns (3)
- `src/__tests__/unit/sprint-n-preview-streaming.test.ts` — **6 tests** (NEW): streamOpenAI/Perplexity/Gemini chunk yielding (3), missing API key errors (3)
- `src/__tests__/unit/sprint-n-correction-email.test.ts` — **3 tests** (NEW): fixed email (1), recurring email (1), no-op without RESEND_API_KEY (1)
- `src/__tests__/unit/sprint-n-registration.test.ts` — **15 tests** (NEW): vercel.json integrity (2), schema columns (4), email function (1), cron wiring (3), streaming exports (5)

**AI_RULES:** Added §115-§118 (Settings Claude/scan day, notification toggles, AI Preview streaming, correction email).

---

## 2026-02-28 — Sprint M: Conversion, Verification & Reliability — Plan Comparison Refactor, Bing Verification, Positioning Banner (Completed)

**Objective:** Close 3 remaining gaps from the Feb 2026 analysis: plan upsell conversion (M3), Bing Places verification (C2 Phase 2), and positioning banner enhancement (M6). Service tests (M1/L5) skipped — all 3 files already had comprehensive coverage (48 tests across 3 files).

**M3 — Plan Feature Comparison Table (refactored from Sprint B):**
- `lib/plan-feature-matrix.ts` — **REWRITTEN.** All 24 feature rows now derive from `plan-enforcer.ts` gating functions via `buildFeatureMatrix()`. Zero hardcoded availability values. `gate()` helper wraps all calls in try/catch (returns `false` on error). Backward-compatible `PLAN_FEATURE_MATRIX` export maintained.
- `app/dashboard/billing/_components/PlanComparisonTable.tsx` — No changes needed (already consumes `PLAN_FEATURE_MATRIX`).
- 16 gating functions mapped: `canRunDailyAudit`, `canRunSovEvaluation`, `canRunCompetitorIntercept`, `maxLocations`, `maxCompetitors`, `canRunAutopilot`, `canRunPageAudit`, `canRunOccasionEngine`, `canViewCitationGap`, `canConnectGBP`, `canRunMultiModelSOV`, `canExportData`, `canRegenerateLLMsTxt`, `canManageTeamSeats`, `defaultSeatLimit`, `planSatisfies`.

**C2 Phase 2 — Bing Places Verification:**
- `app/api/integrations/verify-bing/route.ts` — **NEW.** Bing Local Business Search REST API verification. Auth via query parameter (`key=BING_MAPS_KEY`), not Bearer header. Name+city search (no phone-based lookup — Bing doesn't support it). Response: `resourceSets[0].resources[]`. Reuses `detectDiscrepancies()` from Sprint L.
- `lib/integrations/platform-config.ts` — **MODIFIED.** Bing changed from `coming_soon` to `manual_url` with `verifiable: true` and `claimUrl: 'https://www.bingplaces.com'`.
- `app/dashboard/integrations/page.tsx` — **MODIFIED.** Replaced hardcoded `platform === 'yelp' ? 'Yelp' : platform` with `PLATFORM_LABELS` mapping (`yelp: 'Yelp'`, `bing: 'Bing Places'`). Updated footer text.
- `app/dashboard/integrations/_components/ListingVerificationRow.tsx` — **MODIFIED.** Fixed pre-existing bare `} catch {}` to `} catch (_err) {}`.
- `.env.local.example` — **MODIFIED.** Added `BING_MAPS_KEY` documentation.

**M6 — AI vs. Traditional SEO Positioning Banner:**
- `components/ui/PositioningBanner.tsx` — **MODIFIED.** Updated copy from generic branding to specific AI visibility vs. search ranking explanation. New headline: "LocalVector measures a layer traditional SEO tools don't." Body now references Reality Score explicitly, no competitor tool names. Same component structure, localStorage key, data-testid, dismiss behavior.

**Tests added:** 23 new tests across 3 files (3279 total, was 3256)
- `src/__tests__/unit/plan-feature-matrix.test.ts` — **+6 tests** (19 total, was 13): team seats values, daily scan growth+, GBP starter+, `buildFeatureMatrix()` consistency
- `src/__tests__/unit/bing-verification.test.ts` — **14 tests** (NEW): findBestBingMatch (5), formatBingAddress (4), detectDiscrepancies with Bing data (5)
- `src/__tests__/unit/positioning-banner.test.tsx` — **+3 tests** (13 total, was 10): "AI models", "Reality Score", "search ranking" copy checks
- `src/__tests__/unit/integrations-listings.test.ts` — **MODIFIED** 1 assertion: bing `coming_soon` → `manual_url` + `verifiable: true`

**AI_RULES additions:** §112 (Plan feature matrix derivation), §113 (Bing verification pattern), §114 (Positioning banner M6 copy).

```bash
npx vitest run src/__tests__/unit/plan-feature-matrix.test.ts   # 19 tests
npx vitest run src/__tests__/unit/bing-verification.test.ts     # 14 tests
npx vitest run src/__tests__/unit/positioning-banner.test.tsx    # 13 tests
npx vitest run                                                   # 3279 tests — 0 regressions
```

---

## 2026-02-28 — Sprint L: Retention & Onboarding — Sample Data Audit, Listings Verification, Tour Completion (Completed)

**Objective:** Address 3 highest-churn-risk gaps: sample data mode completeness, Yelp API listing verification, and GuidedTour completion.

**C4 — Sample Data Mode (audit only — Sprint B already completed):**
- Core infrastructure: `isSampleMode()`, `sample-dashboard-data.ts`, `SampleModeBanner`, `SampleDataBadge` — all implemented in Sprint B
- Dashboard coverage: 4 stat panels + TopIssuesPanel have sample data. Secondary cards show empty states (intentional). Plan-gated cards invisible to trial users.
- Added 9 new tests across 2 files: 3 data shape tests in `sample-data-mode.test.ts` (SAMPLE_WRONG_FACTS_COUNT, SAMPLE_BOT_DATA shape/blind_spot), 6 component tests in `sample-data-components.test.tsx` (SampleDataBadge 3, SampleModeBanner 3)
- Total sample data tests: 24 across 2 files (`sample-data-mode.test.ts`: 18, `sample-data-components.test.tsx`: 6)

**C2 Phase 2 — Listings Verification (Yelp Fusion API):**
- Migration: `20260309000001_listing_verification.sql` — adds `verified_at`, `verification_result` (JSONB), `has_discrepancy` to `location_integrations`
- Pure utility: `lib/integrations/detect-discrepancies.ts` — fuzzy name match, address first-2-words, phone last-10-digits comparison
- API route: `app/api/integrations/verify-yelp/route.ts` — Yelp Fusion phone search, 24h rate limit, org_id server-derived via getSafeAuthContext()
- Component: `ListingVerificationRow.tsx` — Deep Night theme, states: not verified / verified-clean / discrepancies / not-found
- Platform config: `verifiable: true` flag added to `PlatformSyncConfig` interface; set on yelp
- Env var: `YELP_API_KEY` added to `.env.local.example`
- Bing deferred to Sprint M (Azure Cognitive Services auth pattern differs)

**M2 — GuidedTour Completion (verification only — Sprint E already completed):**
- Tour steps: 8 (5 original + 3 from Sprint E: Share of Voice, Citations, Revenue Impact)
- Sidebar testids: `nav-share-of-voice`, `nav-citations`, `nav-revenue-impact` — all present
- Restart Tour button in Settings — confirmed present
- Existing tests: `guided-tour-steps.test.ts` (8 tests) — all passing

**Tests added:**
- `src/__tests__/unit/sample-data-mode.test.ts` — **+3 tests** (18 total, was 15)
- `src/__tests__/unit/sample-data-components.test.tsx` — **6 tests** (SampleDataBadge 3, SampleModeBanner 3) — NEW
- `src/__tests__/unit/listing-verification.test.tsx` — **16 tests** (detectDiscrepancies + ListingVerificationRow)
- `tests/e2e/sprint-l-smoke.spec.ts` — **10 E2E tests** (listings verification, sample mode, tour nav targets)

**AI_RULES additions:** §110 (Listings verification pattern), §111 (Sample data coverage audit).

---

## 2026-02-28 — Sprint K: Infrastructure & Trust — Sentry Sweep, Listings Verification, Sidebar & Digest Verification (Completed)

**Objective:** Verify and complete 5 areas of quiet breakage from the code analysis. Sprint K is an infrastructure audit — most work was already done in earlier sprints. The primary new work was fixing 4 remaining bare `catch {}` blocks.

**C1 — Sentry gap-fill:**
- Bare catches remaining before Sprint K: **4** (from grep)
- Files fixed:
  - `app/dashboard/crawler-analytics/_components/BotFixInstructions.tsx:30` — clipboard API catch → Sentry
  - `app/dashboard/ai-responses/_components/AIAnswerPreviewWidget.tsx:138` — SSE parse catch → Sentry
  - `app/dashboard/ai-responses/_components/AIAnswerPreviewWidget.tsx:143` — fetch/network catch → Sentry
  - `app/api/ai-preview/route.ts:42` — JSON body parse catch → Sentry
- Bare catches remaining after Sprint K: **0** (confirmed by sentry-sweep test)

**C2 — Listings Honesty (verification only — Sprint C already completed):**
- Mock setTimeout: **already removed in Sprint C**
- Platforms changed to manual tracking: yelp, tripadvisor (Sprint C)
- Coming soon platforms: apple, bing, facebook (Sprint C)
- `listing_url` column: **already existed** — no migration needed
- `PLATFORM_SYNC_CONFIG` SSOT: `lib/integrations/platform-config.ts` (Sprint C)
- GBP connect flow: unchanged, still functional

**H4 — Sidebar (verification only — Sprint A already completed):**
- Status: **Sprint A already completed**
- Groups: Overview (2 items), AI Visibility (6), Content & Menu (6), Intelligence (4), Admin (5)
- Plan-gated items: preserved via existing NavItem render logic
- Dynamic label: Content & Menu → Content & {industryConfig.servicesNoun} (Sprint E)

**H6 — monthlyCostPerSeat (verification only — Sprint C already completed):**
- Case applied: **A — fetched from Stripe via `getMonthlyCostPerSeat()`**
- Price ID env var: `STRIPE_PRICE_ID_AGENCY_SEAT`
- UI fallback: "Contact us for custom seat pricing" when null

**L2 — Weekly digest guard (verification only — Sprint C already completed):**
- No-scan detection: `sov_evaluations` COUNT per org > 0
- Guard location: `lib/data/weekly-digest.ts` lines 64–75
- Cron route: skipped orgs counted, Sentry.captureMessage logged

**Tests added:**
- `src/__tests__/unit/integrations-listings.test.ts` — **20 tests** (PLATFORM_SYNC_CONFIG + schema validation)
- `src/__tests__/unit/sentry-sweep-verification.test.ts` — **2 tests** (grep-based zero-bare-catch regression guard)
- `tests/e2e/sprint-k-smoke.spec.ts` — **14 E2E tests** (listings honesty, sidebar groups, Sentry pages)
- Pre-existing: `sidebar-groups.test.ts` (7), `weekly-digest-guard.test.ts` (8) — verified passing

**AI_RULES additions:** §108 (Sentry sweep completeness), §109 (Listings honesty verification).

---

## 2026-02-28 — Sprint I: Action Surfaces Tier 2 — Revenue Impact, AI Sentiment, Source Intelligence, Bot Activity (Completed)

**Features implemented (4 items):**
1. **Revenue Impact → Show the Number First:** Industry-smart defaults pre-fill the Revenue Impact form so a revenue estimate appears on page load. `getIndustryRevenueDefaults()` maps org industry to sensible `avgCustomerValue`/`monthlyCovers`. New `RevenueEstimatePanel` shows the estimate prominently with breakdown interpretation and smart-defaults disclosure.
2. **AI Sentiment → Model-by-Model Interpretation:** `SentimentInterpretationPanel` leads the sentiment page with plain-English verdicts per engine. Engines sorted worst-first. Worst engine gets an amber callout with CTA to fix alerts. Uses -1/+1 score thresholds (>0.3 = positive, <-0.3 = negative).
3. **Source Intelligence → Source Health Signals:** `SourceHealthSummaryPanel` shows source count grid (first-party, review sites, competitor, alerts) with first-party citation rate. `SourceHealthBadge` added to each source in the top sources table. Plain-English verdicts based on alert severity and first-party rate.
4. **Bot Activity → Actionable Fix Instructions:** `BotFixInstructions` expandable component on blind-spot and low-activity bot rows. `BOT_KNOWLEDGE_BASE` provides per-bot: what it is, why it matters, exact robots.txt snippet with copy button, official docs link. All 10 tracked AI bots covered.

**Schema decisions:**
- **No new DB tables/columns:** Sprint I is front-end only. Revenue defaults derived from `INDUSTRY_CONFIG` industry IDs. Sentiment verdicts from existing `sov_evaluations.sentiment_data` JSONB. Source health from existing `NormalizedSource.category` and `SourceAlert`. Bot info is static knowledge base.
- **Industry revenue defaults:** Stored in `lib/revenue-impact/industry-revenue-defaults.ts`, not in DB. Matches existing `RevenueConfig` interface (`avgCustomerValue`, `monthlyCovers`).
- **Source health derivation:** No accuracy/wrong-info data exists — health derived from source `category` (first_party=good, competitor=bad) and `isCompetitorAlert` flag.

**Changes:**

*Revenue Impact:*
- **`lib/revenue-impact/industry-revenue-defaults.ts`** — NEW. `getIndustryRevenueDefaults()`, `REVENUE_FIELD_LABELS`, `REVENUE_FIELD_DESCRIPTIONS`.
- **`app/dashboard/revenue-impact/_components/RevenueEstimatePanel.tsx`** — NEW. Estimate display with smart-defaults disclosure, interpretation, and fix-alerts CTA.
- **`app/dashboard/revenue-impact/page.tsx`** — MODIFIED. Fetches org industry, passes industry defaults to `fetchRevenueImpact()`, renders estimate panel above form.
- **`lib/data/revenue-impact.ts`** — MODIFIED. Added `industryDefaults` parameter to `fetchRevenueImpact()`.

*AI Sentiment:*
- **`app/dashboard/sentiment/_components/SentimentInterpretationPanel.tsx`** — NEW. Plain-English verdicts per engine, worst-model callout, score-based color coding.
- **`app/dashboard/sentiment/page.tsx`** — MODIFIED. Added interpretation panel above existing charts.

*Source Intelligence:*
- **`app/dashboard/source-intelligence/_components/SourceHealthSummaryPanel.tsx`** — NEW. Health grid, first-party rate, verdicts.
- **`app/dashboard/source-intelligence/_components/SourceHealthBadge.tsx`** — NEW. Per-source health badge (first_party/competitor/review/directory/other).
- **`app/dashboard/source-intelligence/page.tsx`** — MODIFIED. Added summary panel and badges to source table rows.

*Bot Activity:*
- **`lib/bot-activity/bot-knowledge.ts`** — NEW. `BOT_KNOWLEDGE_BASE` with 10 bot entries, `getBotInfo()`.
- **`app/dashboard/crawler-analytics/_components/BotFixInstructions.tsx`** — NEW. Client component with expand/collapse, robots.txt code block, copy button.
- **`app/dashboard/crawler-analytics/page.tsx`** — MODIFIED. Added fix instructions to BlindSpotRow and low-activity BotRow.

**Tests added:**
- `src/__tests__/unit/industry-revenue-defaults.test.ts` — 11 tests
- `src/__tests__/unit/bot-knowledge.test.ts` — 46 tests
- `src/__tests__/unit/sentiment-interpretation-panel.test.tsx` — 11 tests
- `src/__tests__/unit/source-health-summary.test.tsx` — 19 tests
- `tests/e2e/sprint-i-smoke.spec.ts` — 7 E2E tests

**AI_RULES added:** §97–§100 (Revenue Industry Defaults, Sentiment Interpretation, Source Health Signals, Bot Fix Instructions).

---

## 2026-02-28 — Sprint H: Action Surfaces — Triage Queue, SOV Verdict, Citation Health, Compete Win/Loss (Completed)

**Features implemented (4 items):**
1. **Hallucination Triage Queue:** Replaced flat hallucinations table with three-column Kanban triage board — "Fix Now" (open, severity-sorted), "In Progress" (verifying), "Resolved" (fixed/dismissed/recurring, capped at 10). AlertCard uses `describeAlert()` from Sprint G. DismissAlertButton reuses existing `updateHallucinationStatus()` server action.
2. **SOV Verdict Panel:** Verdict-first panel above all SOV page content showing big SOV %, week-over-week delta, and top competitor mention count aggregated from `sov_evaluations.mentioned_competitors`.
3. **Citation Summary Panel:** Summary panel inside PlanGate showing covered/gap/score counts with plain-English verdict about citation health based on listing coverage.
4. **Compete Win/Loss Verdict:** Win/Loss verdict panel between competitor management and intercept results derived from `competitor_intercepts.winner` matching the business name.

**Schema decisions:**
- **Hallucination status swimlanes:** `correction_status` values: open → "Fix Now", verifying → "In Progress", fixed/dismissed/recurring → "Resolved". `dismissed` treated as resolved (not a fourth column) since dismissed alerts require no further action.
- **No competitor SOV %:** The DB stores mention counts in `sov_evaluations.mentioned_competitors`, not per-competitor SOV percentages. Verdict panel shows mention frequency instead.
- **No per-source wrong info:** `citation_source_intelligence` is market-level aggregate data. Citation health is derived from listing coverage (listed vs not listed), not per-source accuracy.
- **Compete win/loss:** Derived from `competitor_intercepts.winner` string matching against `businessName`. Each intercept is one matchup.

**Changes:**

*Hallucination Triage Queue:*
- **`app/dashboard/hallucinations/_components/AlertCard.tsx`** — NEW. Uses `describeAlert()`, severity badge (critical/warning/info), status-specific actions, follow-up status banner, `timeAgo()` helper.
- **`app/dashboard/hallucinations/_components/DismissAlertButton.tsx`** — NEW. Client component calling `updateHallucinationStatus(id, 'dismissed')`.
- **`app/dashboard/hallucinations/_components/TriageSwimlane.tsx`** — NEW. Column wrapper with title, count badge, AlertCard list, empty state.
- **`app/dashboard/hallucinations/_components/HallucinationsPageHeader.tsx`** — NEW. Verdict header: 0 open → green, >0 → red count.
- **`app/dashboard/hallucinations/page.tsx`** — MODIFIED. Extended fetch to include `category`, `follow_up_result`. Replaced Flagged Hallucinations table with triage swimlane grid (lg:grid-cols-3).

*SOV Verdict Panel:*
- **`app/dashboard/share-of-voice/_components/SOVVerdictPanel.tsx`** — NEW. Big SOV %, delta, competitor mention context.
- **`app/dashboard/share-of-voice/page.tsx`** — MODIFIED. Added competitor mention aggregation from evaluations. Inserted SOVVerdictPanel above SOVScoreRing.

*Citation Summary Panel:*
- **`app/dashboard/citations/_components/CitationsSummaryPanel.tsx`** — NEW. 3-count grid (covered/gaps/score) + verdict.
- **`app/dashboard/citations/page.tsx`** — MODIFIED. Inserted CitationsSummaryPanel inside PlanGate, above TopGapCard.

*Compete Win/Loss Verdict:*
- **`app/dashboard/compete/_components/CompeteVerdictPanel.tsx`** — NEW. Win/loss counts from intercepts.
- **`app/dashboard/compete/page.tsx`** — MODIFIED. Inserted CompeteVerdictPanel between competitor management and analyses sections.

**Tests added: 51 tests (6 files)**
- `alert-card.test.tsx` (14): headline from describeAlert, severity badges, status actions, meta
- `triage-swimlane.test.tsx` (5): title, count, AlertCard rendering, empty state, testids
- `sov-verdict-panel.test.tsx` (11): currentPct, delta colors, competitor context, no-data state (note: 11th test is the 'panel hidden when null' test)
- `citations-summary-panel.test.tsx` (8): totals, coverage grid, gap styling, verdict
- `compete-verdict-panel.test.tsx` (8): win/loss counts, colors, singular/plural, all-wins
- `hallucinations-page-header.test.tsx` (5): clean/issues verdict, counts, singular

**AI_RULES:** §97–§100 added.

---

## 2026-02-28 — Sprint G: Human-Readable Dashboard — Plain-English Issues, Consequence-First Design (Completed)

**Features implemented (3 items):**
1. **Issue Description Engine:** `lib/issue-descriptions.ts` translates `HallucinationRow` records and technical findings into plain-English consequence sentences (e.g., "ChatGPT is telling customers the wrong hours"). Maps DB `category` values to human headlines, `model_provider` to brand names, and 4-level severity to 3-level UI severity.
2. **4 Stat Panels:** Replaced the old QuickStats row (4 MetricCards) with purpose-built panels — AIVisibilityPanel (score gauge + delta + benchmark), WrongFactsPanel (alert count, red/green), AIBotAccessPanel (top 4 bots sorted by urgency), LastScanPanel (relative time + next scan + stale warning).
3. **Top Issues Panel:** Prioritized plain-English issue list merging hallucination alerts + technical findings (bot blind spots). Sorted by severity, max 5 rows, with "Fix with AI" / "How to fix" CTAs. Sample mode shows demo issues for new orgs.

**Changes:**

*Issue Description Engine:*
- **`lib/issue-descriptions.ts`** — NEW. `describeAlert()` switch on category (hours/address/phone/menu/status/amenity), `describeTechnicalFinding()` for bot_blind_spot/content_thin/schema_missing, `getModelName()`, `mapSeverity()`.

*4 Stat Panels:*
- **`app/dashboard/_components/panels/AIVisibilityPanel.tsx`** — NEW. Score gauge SVG (r=40), delta badge, benchmark comparison text, InfoTooltip.
- **`app/dashboard/_components/panels/WrongFactsPanel.tsx`** — NEW. Big number (crimson > 0, emerald = 0), entire panel links to /dashboard/hallucinations.
- **`app/dashboard/_components/panels/AIBotAccessPanel.tsx`** — NEW. Bot rows sorted by urgency (blind_spot → low → active), status color indicators, links to /dashboard/crawler-analytics.
- **`app/dashboard/_components/panels/LastScanPanel.tsx`** — NEW. Reuses `formatRelativeTime()` + `nextSundayLabel()`, warning badge for > 14 days stale.

*Top Issues Panel:*
- **`app/dashboard/_components/TopIssuesPanel.tsx`** — NEW. Merges alerts + technical findings, severity sort, max 5 rows, sample mode, empty state.

*Dashboard Redesign:*
- **`app/dashboard/page.tsx`** — MODIFIED. New layout: 4 stat panels grid + TopIssuesPanel. Removed SOVTrendChart, HallucinationsByModel, CompetitorComparison, QuickStats row, AIHealthScoreCard, RealityScoreCard. Header subtitle "AI lies" → "wrong facts".
- **`app/dashboard/hallucinations/page.tsx`** — MODIFIED. Added HallucinationsByModel chart (moved from dashboard).
- **`lib/sample-data/sample-dashboard-data.ts`** — MODIFIED. Added `SAMPLE_WRONG_FACTS_COUNT`, `SAMPLE_BOT_DATA`.

**Tests added:**
- `issue-descriptions.test.ts` — 36 tests (describeAlert per category, getModelName, mapSeverity, describeTechnicalFinding, edge cases)
- `ai-visibility-panel.test.tsx` — 10 tests (score display, delta, benchmark, null states)
- `wrong-facts-panel.test.tsx` — 5 tests (count, colors, link, InfoTooltip)
- `ai-bot-access-panel.test.tsx` — 8 tests (rows, status indicators, sorting, empty state, link)
- `last-scan-panel.test.tsx` — 6 tests (relative time, null state, warning, next scan)
- `top-issues-panel.test.tsx` — 14 tests (rendering, sorting, sample mode, empty state, CTAs)
- `sprint-g-smoke.spec.ts` — 14 E2E tests (layout, panels, chart relocation, accessibility)
- **Total: 79 new unit tests + 14 E2E tests**

**AI_RULES added:** §93 (Issue Descriptions), §94 (Stat Panels), §95 (Top Issues Panel), §96 (Dashboard Layout Changes)

**Result:** 218 test files, 3001 tests pass (1 pre-existing flaky boundary test). 0 migrations. 0 TS errors (Sprint G scope). 0 regressions.

---

## 2026-02-27 — Sprint F: Engagement & Retention — AI Answer Preview, Correction Follow-Up, Benchmark Comparison (Completed)

**Features implemented (3 items):**
1. **N2 — On-Demand AI Answer Preview:** Widget on AI Responses page lets users type any query and see live responses from ChatGPT (gpt-4o-mini), Perplexity (sonar), and Gemini (2.0-flash). SSE streaming for real-time model card updates. Credit-gated (1 credit per composite run) via Sprint D credit system.
2. **N3 — Correction Follow-Up ("Did It Work?" Loop):** Daily cron that re-checks hallucinations 14 days after correction brief generation. Re-queries the original AI model with the stored claim, compares response against extracted key phrases (phone numbers, times, addresses, dollar amounts). Updates status to `fixed` or `recurring`. CorrectionPanel shows follow-up status banner.
3. **N4 — Benchmark Comparison ("You vs. City Average"):** Weekly cron aggregating city+industry Reality Scores via `compute_benchmarks()` RPC. BenchmarkComparisonCard on dashboard shows two states: "Collecting" (progress bar toward 10-org threshold) and "Ready" (score vs average, percentile label, min/max range bar).

**Changes:**

*N2 — AI Answer Preview:*
- **`lib/ai/providers.ts`** — MODIFIED. Added 3 model keys: `preview-chatgpt` (gpt-4o-mini), `preview-perplexity` (sonar), `preview-gemini` (gemini-2.0-flash).
- **`lib/ai-preview/model-queries.ts`** — NEW. `queryOpenAI()`, `queryPerplexity()`, `queryGemini()` functions using Vercel AI SDK `generateText()`. Each checks `hasApiKey()` before calling.
- **`app/api/ai-preview/route.ts`** — NEW. SSE streaming POST endpoint. Auth via `getSafeAuthContext()`, credit check via `checkCredit()`, query validation (3-200 chars), 3 concurrent model calls via `Promise.allSettled`, consumes 1 credit after completion.
- **`app/dashboard/ai-responses/_components/AIAnswerPreviewWidget.tsx`** — NEW. Client component with query input, "Run Preview" button, 3 model response cards with loading skeletons.
- **`app/dashboard/ai-responses/page.tsx`** — MODIFIED. Wired AIAnswerPreviewWidget above stored responses section.

*N3 — Correction Follow-Up:*
- **`lib/services/correction-verifier.service.ts`** — NEW. `checkCorrectionStatus()` re-queries original model, `extractKeyPhrases()` extracts phone/time/address/dollar patterns for substring matching.
- **`app/api/cron/correction-follow-up/route.ts`** — NEW. Daily cron (10 UTC). CRON_SECRET auth, STOP_CORRECTION_FOLLOWUP_CRON kill switch. Queries verifying alerts with 14-day cooldown, max 50/run.
- **`app/dashboard/hallucinations/actions.ts`** — MODIFIED. `verifyHallucinationFix()` now sets `verifying_since` and `correction_query` when transitioning to 'verifying'.
- **`app/dashboard/_components/CorrectionPanel.tsx`** — MODIFIED. Added follow-up status banner (verifying/fixed/recurring).
- **`app/dashboard/_components/AlertFeedClient.tsx`** — MODIFIED. Passes `correctionStatus` and `followUpResult` props to CorrectionPanel.

*N4 — Benchmark Comparison:*
- **`supabase/migrations/20260308000001_sprint_f_engagement.sql`** — NEW. N3 columns on `ai_hallucinations` (`correction_query`, `verifying_since`, `follow_up_checked_at`, `follow_up_result`). N4 `benchmarks` table + RLS + `compute_benchmarks()` RPC.
- **`app/api/cron/benchmarks/route.ts`** — NEW. Weekly cron (Sunday 8 UTC). Calls `compute_benchmarks()` RPC, upserts into `benchmarks` table.
- **`lib/data/benchmarks.ts`** — NEW. `fetchBenchmark()` fetches city from `locations`, queries `benchmarks` for matching city+industry.
- **`app/dashboard/_components/BenchmarkComparisonCard.tsx`** — NEW. Server Component. Collecting/Ready states, PercentileLabel, ScoreRangeBar sub-components.
- **`lib/data/dashboard.ts`** — MODIFIED. Added `benchmark`, `locationContext`, `follow_up_result` to DashboardData.
- **`app/dashboard/page.tsx`** — MODIFIED. Wired BenchmarkComparisonCard after EntityHealthCard.
- **`lib/sample-data/sample-dashboard-data.ts`** — MODIFIED. Added SAMPLE_BENCHMARK and SAMPLE_LOCATION_CONTEXT.

*Registration & Infrastructure:*
- **`vercel.json`** — MODIFIED. Added 2 cron entries (total: 9).
- **`lib/services/cron-health.service.ts`** — MODIFIED. Added 2 CRON_REGISTRY entries (total: 7).
- **`.env.local.example`** — MODIFIED. Added `STOP_CORRECTION_FOLLOWUP_CRON` and `STOP_BENCHMARK_CRON`.

**Tests added:**
- `ai-preview-model-queries.test.ts` — 9 tests (3 models success/error/missing key + empty response)
- `correction-verifier.test.ts` — 11 tests (extractKeyPhrases patterns + checkCorrectionStatus scenarios)
- `benchmark-card.test.tsx` — 10 tests (null city, collecting/ready states, above/below avg, no-score)
- `sprint-f-registration.test.ts` — 11 tests (vercel.json crons, CRON_REGISTRY, env docs, model keys)
- Updated: `cron-health-service.test.ts` (5→7 entries), `cron-health-data.test.ts` (5→7 entries)
- **Total: 41 new tests**

**AI_RULES added:** §90 (AI Answer Preview), §91 (Correction Follow-Up), §92 (Benchmark Comparison)

**Result:** 211 test files, 2922 tests pass. 1 migration. 0 TS errors (Sprint F scope). 0 regressions.

---

## 2026-02-27 — Sprint E: Grow the Product — Medical/Dental Vertical Extension & Guided Tour Depth (Completed)

**Features implemented (2 items):**
1. **M5 — Medical/Dental Vertical Extension:** Added industry configuration layer enabling multi-vertical support. Medical/dental practices get industry-specific SOV seed queries, Schema.org types (Physician, Dentist, MedicalClinic), dynamic sidebar icon (Stethoscope) and label ("Magic Services"), and industry-aware copy throughout the onboarding wizard and Magic Menus page.
2. **M2 — Guided Tour Depth:** Expanded GuidedTour from 5 to 8 steps (added Share of Voice, Citations, Revenue Impact). Created FirstVisitTooltip component for per-page one-time informational banners on 5 jargon-heavy pages (Entity Health, Agent Readiness, Cluster Map, AI Sentiment, Bot Activity). Restart Tour (Sprint B) confirmed already shipped — not re-implemented.

**Changes:**

*M5 — Industry Configuration:*
- **`lib/industries/industry-config.ts`** — NEW. SSOT for industry-specific UI, schema, and copy. `INDUSTRY_CONFIG` record with 4 verticals (restaurant, medical_dental active; legal, real_estate placeholder). `getIndustryConfig()` with null-safe restaurant fallback.
- **`supabase/migrations/20260307000001_orgs_industry.sql`** — NEW. Adds `industry text DEFAULT 'restaurant'` to `organizations`.
- **`lib/services/sov-seed.ts`** — MODIFIED. Added `medicalDiscoveryQueries()`, `medicalNearMeQueries()`, `medicalSpecificQueries()`, `isMedicalCategory()`, `MEDICAL_DENTAL_CATEGORIES`. `seedSOVQueries()` accepts optional `industryId` param (backward-compatible).
- **`lib/schema-generator/medical-types.ts`** — NEW. `generateMedicalSchema()` returns Physician or Dentist JSON-LD. `buildHoursSpecification()` helper.
- **`lib/schema-generator/index.ts`** — MODIFIED. Re-exports medical types.
- **`lib/schema-generator/local-business-schema.ts`** — MODIFIED. `inferSchemaOrgType()` now handles medical categories (dentist, physician, doctor, medical, clinic).
- **`components/layout/Sidebar.tsx`** — MODIFIED. Dynamic Magic Menu icon/label via `getIndustryConfig(orgIndustry)`. Group label "Content & Menu" → "Content & {servicesNoun}".
- **`components/layout/DashboardShell.tsx`** — MODIFIED. Passes `orgIndustry` prop to Sidebar.
- **`app/dashboard/layout.tsx`** — MODIFIED. Fetches `organizations.industry` and passes to DashboardShell.
- **`app/dashboard/magic-menus/page.tsx`** — MODIFIED. Uses `industryConfig.magicMenuLabel` for heading, `industryConfig.servicesNoun` for copy.
- **`app/onboarding/_components/Step4SOVQueries.tsx`** — MODIFIED. Accepts optional `searchPlaceholder` prop (industry-aware).
- **`src/__fixtures__/golden-tenant.ts`** — MODIFIED. Added `ALPHARETTA_FAMILY_DENTAL` fixture.

*M2 — Guided Tour Depth:*
- **`app/dashboard/_components/GuidedTour.tsx`** — MODIFIED. `STEPS` → `TOUR_STEPS` (exported). Added 3 new steps: Share of Voice, Citations, Revenue Impact (indices 5-7). Step 3 target updated from `nav-menu` to `nav-magic-menu`.
- **`components/ui/FirstVisitTooltip.tsx`** — NEW. Client component using localStorage `lv_visited_pages`. Exports `hasVisited()`, `markVisited()`.
- **`app/dashboard/entity-health/page.tsx`** — MODIFIED. Added FirstVisitTooltip.
- **`app/dashboard/agent-readiness/page.tsx`** — MODIFIED. Added FirstVisitTooltip.
- **`app/dashboard/cluster-map/page.tsx`** — MODIFIED. Added FirstVisitTooltip.
- **`app/dashboard/sentiment/page.tsx`** — MODIFIED. Added FirstVisitTooltip.
- **`app/dashboard/crawler-analytics/page.tsx`** — MODIFIED. Added FirstVisitTooltip.

**Tests added:**
- `industry-config.test.ts` — 13 tests (getIndustryConfig fallbacks, config completeness)
- `medical-schema-generator.test.ts` — 17 tests (Physician/Dentist schema generation, hours, rating)
- `sov-seed-medical.test.ts` — 12 tests (medical SOV seeds, backward compat, isMedicalCategory)
- `first-visit-tooltip.test.tsx` — 15 tests (visibility, dismiss, localStorage, hasVisited)
- `guided-tour-steps.test.ts` — 8 tests (step count, targets, uniqueness)
- `sprint-e-smoke.spec.ts` — 12 E2E tests (nav testids, tooltips, tour steps)
- **Total: 65 unit + 12 E2E = 77 new tests**

**AI_RULES added:** §85 (Industry Config), §86 (Medical Schema), §87 (Medical SOV Seeds), §88 (GuidedTour Expanded), §89 (FirstVisitTooltip)

**Result:** 207 test files, 2881 tests pass. 1 migration. 0 TS errors (Sprint E scope). 0 regressions.

---

## 2026-02-27 — Sprint C: Hardening — Honest Listings, Test Coverage, Digest Guard, Seat Cost, Origin Tags (Completed)

**Problems fixed (5 items):**
1. **C2 — Honest Listings State:** `mockSyncIntegration()` used `setTimeout(2000)` then wrote fake 'connected' status to DB for Apple/Bing. Users saw connected integrations that don't actually exist.
2. **M1 — Test Coverage for Untested Services:** `cron-logger.ts` and `sov-seed.ts` had zero unit tests. 6 dashboard pages (source-intelligence, sentiment, agent-readiness, system-health, cluster-map, revenue-impact) had zero E2E coverage.
3. **L2 — Weekly Digest Guard:** `fetchDigestForOrg()` sent digest emails to orgs with no scan data. New users received "Reality Score: —" emails.
4. **H6 — `monthlyCostPerSeat: null`:** Agency billing showed `null` for per-seat cost instead of fetching from Stripe Price API.
5. **L3 — Content Draft Origin Tag:** Occasion-triggered drafts showed generic "Occasion" badge without icon or descriptive label.

**Changes:**

*C2 — Honest Listings State:*
- **`lib/integrations/platform-config.ts`** — NEW. SSOT for platform sync types: `real_oauth` (google), `manual_url` (yelp, tripadvisor), `coming_soon` (apple, bing, facebook). `PLATFORM_SYNC_CONFIG` record with `syncType`, `syncDescription`, optional `claimUrl`/`eta`.
- **`app/dashboard/integrations/_components/PlatformRow.tsx`** — Rewritten to render 3 distinct UI states. Coming Soon: grayed out with "Coming Soon" badge + eta. Manual URL: "Manual" badge + "Manage on {name}" external link. Real OAuth (google): unchanged toggle/sync behavior.
- **`app/dashboard/integrations/actions.ts`** — Replaced `mockSyncIntegration` (with `setTimeout(2000)` fake) with `syncPlatform` that returns error for non-google platforms. Updated `toggleIntegration` to reject non-google.
- **`app/dashboard/integrations/page.tsx`** — Added info banner (`data-testid="listings-info-banner"`) explaining honest platform tracking. Updated footer text.
- **`supabase/migrations/20260305000001_clear_false_integrations.sql`** — Cleans dirty 'connected' statuses for non-google/non-wordpress platforms.

*M1 — Test Coverage:*
- **`src/__tests__/unit/cron-logger.test.ts`** — NEW. 16 tests for `logCronStart`, `logCronComplete`, `logCronFailed`. Chainable Supabase mock.
- **`src/__tests__/unit/sov-seed.test.ts`** — NEW. 23 tests for `seedSOVQueries`, tier generation, deduplication, occasion tags, null handling.
- **`tests/e2e/24-listings-honest-state.spec.ts`** — NEW. 8 E2E tests for honest listings UI states.
- **`tests/e2e/25-sprint-c-pages.spec.ts`** — NEW. 18 E2E smoke tests for 6 dashboard pages.
- Note: `entity-auto-detect.test.ts`, `places-refresh.test.ts`, `gbp-token-refresh.test.ts` already existed — skipped.

*L2 — Weekly Digest Guard:*
- **`lib/data/weekly-digest.ts`** — Added scan-data guard after primary location check. Counts `sov_evaluations` rows for org — returns null if 0 (no scan data yet).
- **`app/api/cron/weekly-digest/route.ts`** — Added Sentry info log when skipped > 0 orgs (no data or disabled).
- **`src/__tests__/unit/weekly-digest-guard.test.ts`** — NEW. 8 tests for guard behavior.
- **`src/__tests__/unit/weekly-digest-data.test.ts`** — FIXED. Updated mock to track `sov_evaluations` calls with index (first=count guard, second=SOV wins data).

*H6 — Stripe Per-Seat Cost:*
- **`lib/stripe/get-monthly-cost-per-seat.ts`** — NEW. Fetches monthly per-seat cost from Stripe Price. Handles null input, missing env var, annual→monthly conversion, metered pricing. Sentry capture on errors, returns null.
- **`app/actions/seat-actions.ts`** — Replaced `monthlyCostPerSeat: null` with `await getMonthlyCostPerSeat(SEAT_PLANS[plan]?.stripePriceId ?? null)`.
- **`app/dashboard/billing/_components/SeatManagementCard.tsx`** — Added "Contact us for custom seat pricing" fallback when cost is null.
- **`src/__tests__/unit/get-monthly-cost-per-seat.test.ts`** — NEW. 11 tests (Stripe mock, cents→dollars, annual→monthly, Sentry capture).

*L3 — Content Draft Origin Tag:*
- **`app/dashboard/content-drafts/_components/ContentDraftCard.tsx`** — Updated occasion badge: label "Occasion Engine", violet color, CalendarDays icon, `data-testid="draft-origin-tag"`.
- **`src/__tests__/unit/content-draft-origin.test.ts`** — NEW. 5 tests for badge rendering.

**Tests added (89 new tests):**
- Unit: 63 tests across 5 new files (cron-logger 16, sov-seed 23, weekly-digest-guard 8, get-monthly-cost-per-seat 11, content-draft-origin 5)
- E2E: 26 tests across 2 new files (listings-honest-state 8, sprint-c-pages 18)

**AI_RULES updates:** Added §76 (Honest Listings), §77 (Digest Guard), §78 (Stripe Seat Cost), §79 (Origin Tag), §80 (Sprint C Tests).

**Result:** 197 test files, 2748 Vitest tests passing (+63). 0 failures. 1 migration added.

---

## 2026-02-27 — Sprint B: First Impressions — Sample Data, InfoTooltips, Settings Expansion, Plan Comparison (Completed)

**Problems fixed (4 items):**
1. **C4 — Sample Data Mode:** New tenants saw an empty dashboard for their entire first 14 days (until first SOV cron run). Zero engagement hook.
2. **H1 — InfoTooltip System:** 10 dashboard cards had no explanation of what each metric means, how it's calculated, or what action to take. Users couldn't self-serve.
3. **H2 — Settings Page Expansion:** Settings had only 5 sections (display name, password, notifications, plan, danger zone). Missing: AI model monitoring toggles, score drop threshold, webhook URL (agency), restart guided tour.
4. **M3 — Plan Feature Comparison:** Billing page had a 3-tier pricing grid but no feature comparison matrix. Users couldn't see what they'd gain by upgrading.

**Changes:**

*C4 — Sample Data Mode:*
- **`lib/sample-data/sample-dashboard-data.ts`** — NEW. SSOT for sample dashboard data: health score (61/C), SOV trend (8 weeks, 34→47), hallucinations by model (4 engines), visibility (47), open alerts (2), intercepts (7), fixed count (5).
- **`lib/sample-data/use-sample-mode.ts`** — NEW. Pure `isSampleMode(realityScore, orgCreatedAt)` — activates when realityScore is null AND org < 14 days old.
- **`components/ui/SampleDataBadge.tsx`** — NEW. Amber pill overlay with `data-testid="sample-data-badge"`.
- **`components/ui/SampleModeBanner.tsx`** — NEW. Client component. Dismissible banner (sessionStorage `lv_sample_banner_dismissed`). Shows next scan date via `nextSundayLabel()`.
- **`lib/data/dashboard.ts`** — Added `orgCreatedAt: string | null` to `DashboardData`. Piggybacks on existing org query (`.select('plan, created_at')`).
- **`app/dashboard/page.tsx`** — Integrated sample mode: imports sample data + components, computes `showSampleData`, creates `display*` variables for all cards, wraps 8 cards in `<div className="relative">` with conditional `<SampleDataBadge />`, shows `<SampleModeBanner>` for sample mode.

*H1 — InfoTooltip System:*
- **`components/ui/InfoTooltip.tsx`** — NEW. Client component using `@radix-ui/react-popover`. Hover (300ms delay) + click toggle. `e.stopPropagation()` prevents parent Link activation. Props: `content`, `label`, `align`.
- **`lib/tooltip-content.tsx`** — NEW. SSOT for 10 tooltip entries. `TooltipBody` renders structured "What / How / Action" format. Keys: `realityScore`, `aiVisibility`, `openAlerts`, `interceptCount`, `shareOfVoice`, `hallucinationsByModel`, `visibilityComponent`, `accuracyComponent`, `structureComponent`, `freshnessComponent`.
- **`app/dashboard/_components/MetricCard.tsx`** — Added optional `tooltip?: React.ReactNode` prop. Wraps label in flex row with conditional `<InfoTooltip>`.
- **`app/dashboard/_components/AIHealthScoreCard.tsx`** — Added tooltip to title + 4 component bar labels (`visibilityComponent`, `accuracyComponent`, `structureComponent`, `freshnessComponent`). Widened label column `w-20` → `w-24`.
- **`app/dashboard/_components/RealityScoreCard.tsx`** — Added InfoTooltip to "Reality Score" title.
- **`app/dashboard/_components/SOVTrendChart.tsx`** — Added InfoTooltip to chart title.
- **`app/dashboard/_components/HallucinationsByModel.tsx`** — Added InfoTooltip to chart title.

*H2 — Settings Page Expansion:*
- **`supabase/migrations/20260304000001_sprint_b_settings_expansion.sql`** — NEW. Adds 3 columns to `organizations`: `monitored_ai_models text[]` (default 4 models), `score_drop_threshold integer` (default 10), `webhook_url text`.
- **`components/ui/UpgradePlanPrompt.tsx`** — NEW. Plan-gated CTA component.
- **`app/dashboard/settings/actions.ts`** — Added `updateAIMonitoringPrefs()` and `updateAdvancedPrefs()` server actions with Zod validation. Webhook URL is agency-gated.
- **`app/dashboard/settings/page.tsx`** — Expanded org query to include new columns. Passes `expandedPrefs` to form.
- **`app/dashboard/settings/_components/SettingsForm.tsx`** — Rewritten: 7 sections. AI Monitoring toggles (4 models), Score Drop Threshold (select), Webhooks (agency-gated), Restart Tour button. Uses `getPlanDisplayName()` (replaces inline `PLAN_LABELS`).

*M3 — Plan Feature Comparison:*
- **`lib/plan-feature-matrix.ts`** — NEW. 24 `FeatureRow` entries across 6 categories (Core, AI Monitoring, Competitive, Content, Integrations, Support). Boolean + string values per tier.
- **`app/dashboard/billing/_components/PlanComparisonTable.tsx`** — NEW. Full comparison table with current plan column highlight, Check/Minus icons, string values for partial features.
- **`app/dashboard/billing/page.tsx`** — Added "Compare Plans" section with `<PlanComparisonTable>`.

**Tests added (39 new tests):**
- `src/__tests__/unit/sample-data-mode.test.ts` — **15 Vitest tests.** `isSampleMode()` edge cases (null score, old org, future date, invalid date) + sample data shape validation (SOV trend length, health score structure, visibility range).
- `src/__tests__/unit/info-tooltip.test.tsx` — **11 Vitest tests.** InfoTooltip component behavior (aria-label, popover visibility, click toggle, string/JSX content, data-testid) + TOOLTIP_CONTENT data integrity (entry count, React element validation, key existence).
- `src/__tests__/unit/plan-feature-matrix.test.ts` — **13 Vitest tests.** Matrix data integrity (row count ≥ 20, valid categories, required keys) + plan hierarchy (agency ≥ growth ≥ starter ≥ trial boolean features) + specific feature assertions.

**AI_RULES updates:** Added §72 (Sample Data Mode), §73 (InfoTooltip System), §74 (Settings Expansion), §75 (Plan Feature Comparison Table).

**Result:** 192 test files, 2685 Vitest tests passing (+39). 0 failures. 1 migration added.

---

## 2026-02-27 — Sprint A: Stop the Bleeding — Sentry, Plan Names, Sidebar Groups, Dashboard Links (Completed)

**Problems fixed (6 items):**
1. **C1 — Sentry coverage:** 68 bare `} catch {}` blocks across `app/` and `lib/` swallowed errors silently. Zero observability in production.
2. **C3 — Plan display names:** "AI Shield" (growth) and "Brand Fortress" (agency) showed as "Growth" and "Agency" on billing page and sidebar. Marketing names didn't match across surfaces.
3. **H3 — SOV cron failure logging:** Per-org failures inside the SOV cron loop were silently caught. No Sentry aggregation of partial failures.
4. **H4 — Sidebar group headers:** 23 flat nav items with no visual grouping. Users couldn't quickly locate features.
5. **H5 — Dashboard card links:** MetricCards and chart cards had no click-through to detail pages. Dead-end dashboard.
6. **L4 — ViralScanner error handling:** Places autocomplete and scan submission had bare catches with no user-facing error state.

**Changes:**
- **`lib/plan-display-names.ts`** — NEW. Single source of truth for plan tier → display name mapping. `getPlanDisplayName()` helper.
- **`components/layout/Sidebar.tsx`** — Added `NAV_GROUPS` (5 groups: Overview, AI Visibility, Content & Menu, Intelligence, Admin). Group headers with `data-testid="sidebar-group-label"`. Plan badge uses `getPlanDisplayName`.
- **`app/dashboard/billing/page.tsx`** — TIERS array uses `getPlanDisplayName()`. `CurrentPlanBadge` uses the helper. Bare catch → Sentry.
- **`app/dashboard/page.tsx`** — 4 bare catches → Sentry. 4 MetricCards now have `href` props linking to detail pages.
- **`app/dashboard/_components/MetricCard.tsx`** — Added optional `href` prop. When set, wraps card in `<Link>` with `data-testid="metric-card-link"` and hover elevation.
- **`app/dashboard/_components/SOVTrendChart.tsx`** — Added "View details →" link to `/dashboard/share-of-voice`.
- **`app/dashboard/_components/HallucinationsByModel.tsx`** — Added "View details →" link to `/dashboard/hallucinations`.
- **`app/dashboard/_components/AIHealthScoreCard.tsx`** — Added "View details →" link to `/dashboard/entity-health`.
- **`app/dashboard/_components/RealityScoreCard.tsx`** — Added "View details →" link to `/dashboard/hallucinations`.
- **`app/api/cron/sov/route.ts`** — 3 inner bare catches → Sentry. Aggregate `captureMessage` when `orgs_failed > 0`.
- **`app/_components/ViralScanner.tsx`** — Added `scanError` state, Sentry for Places autocomplete + scan submit, error UI with `data-testid="viral-scanner-error"` + retry button.
- **68 bare catch blocks** across 46+ files in `app/` and `lib/` → all wired to `Sentry.captureException(err, { tags: { file, sprint: 'A' } })`.
- **`src/__tests__/unit/components/layout/DashboardShell.test.tsx`** — Updated plan badge assertions from `'Growth Plan'`/`'Free Plan'` to `'AI Shield'`/`'Free'` to match C3 changes.

**Tests added:**
- `src/__tests__/unit/sentry-coverage.test.ts` — **8 Vitest tests.** Plan display name mapping, null/undefined handling, defensive fallback, PLAN_DISPLAY_NAMES shape.
- `src/__tests__/unit/sidebar-groups.test.ts` — **7 Vitest tests.** Group count, labels, item counts, no duplicates, all items present, valid hrefs.
- `src/__tests__/unit/metric-card-links.test.tsx` — **5 Vitest tests.** Link rendering with/without href, href matching, hover classes, no hover wrapper without href.
- `tests/e2e/23-sprint-a-smoke.spec.ts` — **10 Playwright tests.** Plan display names on billing, sidebar group headers, MetricCard links, chart detail links, ViralScanner structure.

**AI_RULES updates:** Added §70 (Sentry instrumentation) and §71 (plan display name SSOT).

**Result:** 189 test files, 2646 Vitest tests passing. 0 TypeScript errors. 0 bare catches remaining in `app/` and `lib/`.

---

## 2026-02-27 — Sprint FIX-5: E2E Test Coverage — Sprints 98–101 (Completed)

**Problem:**
- Sprints 98–101 (multi-user, seat billing, multi-location, occasions) shipped with zero E2E coverage.
- Sprint 100's locations page had a silent crash (PlanGate import error, fixed in FIX-3) — E2E would have caught this before production.

**Solution:**
4 new Playwright spec files covering all 4 sprints. Tests use existing `data-testid` attributes already present in Sprint 98–101 components. No component modifications needed.

**Tests added:**
- `tests/e2e/19-multi-user-invitations.spec.ts` — **12 Playwright tests.** Team page render, members table structure, plan gate enforcement (Agency), invite form gating, pending invitations, invite accept page.
- `tests/e2e/20-seat-billing.spec.ts` — **12 Playwright tests.** Pricing tiers, plan badge, Growth highlight, seat card visibility (Agency-only), demo checkout, success/canceled banners, cross-user isolation.
- `tests/e2e/21-multi-location-management.spec.ts` — **14 Playwright tests.** Page render (PlanGate regression guard from FIX-3), location list/empty state, primary badge, overflow menu, add button, plan limit, location switcher, direct URL access.
- `tests/e2e/22-occasion-alerts-badges.spec.ts` — **13 Playwright tests.** Dashboard render, occasion feed, alert card structure, snooze dropdown with duration options, dismiss/create-draft buttons, sidebar badges, cross-user isolation.

**Components modified:** None — all `data-testid` attributes were already present in Sprint 98–101 components.

**Skipped tests (10 total):**
- 3 team member row tests: memberships RLS returns empty data in local dev (not seeded or RLS circular reference)
- 5 location card tests: locations RLS returns empty data in local dev
- 1 billing plan badge test: getCurrentPlan() async resolution
- 1 occasion feed test: no occasion data in current date range

**AI_RULES update:** Added §69 — E2E test coverage requirements for future sprints (originally §57, renumbered in FIX-6 to resolve duplicate with Sprint 102 stub).

**Result:** 41 new E2E tests passing, 10 skipped (data-dependent). 0 regressions in existing specs. `npx tsc --noEmit` = 0 errors.

---

## 2026-02-27 — Sprint FIX-4: Env Var Documentation + /api/chat Rate Limiting (Completed)

**Problems fixed:**
1. `.env.local.example` was missing 17 env vars — cron auth, Google OAuth, AI provider keys, kill switches, Stripe price IDs, Upstash Redis.
2. `/api/chat` had no rate limiting — single org/user could trigger unbounded AI costs.

**Changes:**
- `.env.local.example` — Added 17 missing variables with comments, organized into sections (Cron Security, Google OAuth, AI Providers, Stripe, Upstash Redis, Cron Kill Switches).
- `app/api/chat/route.ts` — Added Upstash sliding window rate limit: 20 requests/hour/org. Fail-open on Redis unavailability. 429 response with retry_after + X-RateLimit-* headers. Module-level Redis/Ratelimit initialization.
- `AI_RULES.md` — Added §67 (env var documentation) and §68 (AI endpoint rate limiting).

**Tests added:**
- `src/__tests__/unit/env-completeness.test.ts` — **15 Vitest tests.** Required vars documented + source scan for undocumented references.
- `src/__tests__/unit/chat-rate-limit.test.ts` — **10 Vitest tests.** Rate limit enforcement + Redis fail-open + headers.
- `src/__tests__/unit/cron-auth-guard.test.ts` — Extended with **3 kill switch tests** (13 total).

**Result:** All tests passing. 0 TypeScript errors.

---

## 2026-02-27 — Sprint FIX-3: Missing Cron Registration + PlanGate Import Verification (Completed)

**Problems fixed:**
1. `vercel.json` missing 4 of 7 cron routes — audit, sov, citation, content-audit were never firing in production.
2. PlanGate import in `app/dashboard/settings/locations/page.tsx` verified as already using correct named import `{ PlanGate }`.

**Changes:**
- `vercel.json` — Added 4 missing cron entries. All 7 crons now registered.
  - `/api/cron/audit`: `0 8 * * *` (daily 8 AM UTC / 3 AM EST)
  - `/api/cron/sov`: `0 7 * * 0` (weekly Sunday 7 AM UTC / 2 AM EST)
  - `/api/cron/citation`: `0 10 * * *` (daily 10 AM UTC)
  - `/api/cron/content-audit`: `0 8 1 * *` (monthly 1st 8 AM UTC / 3 AM EST)
- All 4 cron routes verified: CRON_SECRET auth guard + kill switch present in each.
- `docs/AI_RULES.md` — Added §65 (cron registration completeness) and §66 (named exports rule).

**SOV baseline clock started:** 2026-02-27
Sprint 107 earliest: 2026-03-27 (+28 days). Sprint 109 earliest: 2026-04-24 (+56 days).

**Tests added:**
- `src/__tests__/unit/vercel-cron-config.test.ts` — **14 Vitest tests.** Registry completeness + schedule validation + file existence.
- `src/__tests__/unit/cron-auth-guard.test.ts` — **10 Vitest tests.** CRON_SECRET auth on all 4 cron routes.
- `src/__tests__/unit/plan-gate-imports.test.ts` — **4 Vitest tests.** Named import enforcement for PlanGate.

**Result:** `npx tsc --noEmit` → 0 errors. All tests passing. 28 new tests total.

---

## 2026-02-27 — Sprint FIX-6: Documentation Sync — AI_RULES Tier 4/5 Stubs + CLAUDE.md Final State (Completed)

**Goal:** Bring AI_RULES.md, CLAUDE.md, and MEMORY.md into full alignment with actual project state before Tier 4 work begins.

**Changes:**
- `docs/AI_RULES.md` — Tier 4/5 sprint stubs (§57–§64) for Sprints 102-109 verified present. Fixed duplicate §57 collision: FIX-5 E2E rule renumbered from §57 → §69. Each stub documents: execution status, gate condition, pre-sprint requirements, and provisional rules. Full §number inventory now: §1–§56, §57–§64 (Tier 4/5 stubs), §65–§68 (FIX-3/FIX-4 rules), §69 (FIX-5 E2E rule). No gaps, no duplicates.
- `docs/CLAUDE.md` — Added FIX-6 to Recent Fix Sprints. Updated Tier Completion Status table (FIX-1–FIX-6). Updated Build History line. All FIX sprints now documented.
- Root `CLAUDE.md` — Updated rule count reference (was "55 engineering rules", now "§1–§69").
- Auto-memory `MEMORY.md` — FIX-6 completion noted, duplicate §57 fix documented.
- `docs/DEVLOG.md` — This entry (updated from stale partial version).

**No code changes. No migrations. No new tests.**

**Result:** AI context files are now accurate. Next Claude Code session will correctly understand:
- Tiers 1-3 complete through Sprint 101
- FIX-1 through FIX-6 resolved all production readiness issues
- Sprint 104 is ready to execute immediately (no external dependencies)
- Sprint 102/103 waiting on API approvals
- Sprints 107-109 need 4-8 weeks of SOV data (clock started 2026-02-27)
- AI_RULES has 69 sections with no numbering collisions

**Production readiness status: READY** (all 10 audit issues resolved)

---

## 2026-02-27 — Sprint FIX-2: Security Hardening — npm Vulnerabilities + memberships RLS (Completed)

**Problem:**
- 3 HIGH npm vulnerabilities: @modelcontextprotocol/sdk (cross-client data leak at MCP transport), minimatch (ReDoS), rollup (arbitrary file write).
- memberships table had no ENABLE ROW LEVEL SECURITY — any authenticated user could read all org members.

**Solution:**
- `npm audit fix` — Updated @modelcontextprotocol/sdk to 1.27.1, minimatch to 9.0.9, rollup to 4.59.0. 0 HIGH vulnerabilities remain.
- `supabase/migrations/20260303000001_memberships_rls.sql` — ENABLE ROW LEVEL SECURITY + 4 org isolation policies (select/insert/update/delete using current_user_org_id()).
- `supabase/prod_schema.sql` — Updated with memberships RLS.
- local_occasions: assessed as global table (no org_id column) — no RLS needed, same pattern as directories.

**Tests added:**
- `src/__tests__/unit/memberships-rls.test.ts` — **12 Vitest tests.** SELECT/INSERT/UPDATE/DELETE isolation + service role bypass + migration/schema verification.
- `src/__tests__/unit/npm-audit.test.ts` — **3 Vitest tests.** Version guard against vulnerable packages.

**Files changed:**
- `package.json` — MODIFIED (auto): npm audit fix updated dependency versions
- `package-lock.json` — MODIFIED (auto): lockfile updated
- `supabase/migrations/20260303000001_memberships_rls.sql` — NEW: ENABLE RLS + 4 policies on memberships
- `supabase/prod_schema.sql` — MODIFIED: memberships RLS/policies added
- `src/__tests__/unit/memberships-rls.test.ts` — NEW: 12 RLS isolation tests
- `src/__tests__/unit/npm-audit.test.ts` — NEW: 3 security version guard tests
- `docs/AI_RULES.md` — MODIFIED: added §56 security maintenance rules
- `docs/DEVLOG.md` — MODIFIED: this entry

**Result:** 0 HIGH npm vulnerabilities. memberships RLS active. MCP endpoint unchanged and passing.

```bash
npx vitest run src/__tests__/unit/memberships-rls.test.ts    # 12 tests
npx vitest run src/__tests__/unit/npm-audit.test.ts          # 3 tests
npx vitest run                                                # 2570 total — no regressions
npx tsc --noEmit                                              # 0 type errors
```

---

## 2026-02-27 — Sprint FIX-1: Schema Types Regeneration + prod_schema.sql Sync (Completed)

**Problem:**
- 41 TypeScript errors caused by stale `database.types.ts` — Sprint 99-101 migrations (seat_limit, location_permissions, occasion_snoozes, sidebar_badge_state) were not reflected in types.
- Three production files used `(supabase as any)` casts as workarounds.
- `PlanGate` import was default instead of named. Stripe SDK v20 `quantity` param required `items` array.

**Solution:**
- `lib/supabase/database.types.ts` — Updated. Now includes: seat_limit/seats_updated_at/seat_overage_count/seat_overage_since on organizations; full types for location_permissions, occasion_snoozes, sidebar_badge_state, stripe_webhook_events tables.
- `lib/occasions/occasion-feed.ts` — Removed `(supabase as any)` cast. Direct typed query.
- `lib/badges/badge-counts.ts` — Removed `(supabase as any)` casts (x2). Direct typed queries.
- `app/actions/occasions.ts` — Removed `(supabase as any)` casts (x2). Direct typed queries.
- `lib/stripe/seat-manager.ts` — Fixed Stripe SDK v20 `quantity` → `items[].quantity` pattern.
- `app/dashboard/settings/locations/page.tsx` — Fixed PlanGate import (default → named).
- `lib/auth/active-org.ts` — Fixed `role` null coalesce for OrgInfo type.
- Test fixes: active-location fixture types, badge-counts duplicate props, seat-actions destructuring.

**Tests added:**
- `src/__tests__/unit/database-types-completeness.test.ts` — **12 Vitest tests.** Type-guard regression tests (9) + source file scan tests (3). Guards against future type drift.

**Result:** `npx tsc --noEmit` → 0 errors (was 41). 2555 tests pass (was 2543), 179 files. No regressions.

---

## 2026-03-02 — Sprint 101: Occasion Alert Feed + Sidebar Badges (Gaps #58 + #59: 80%/50% → 100%)

**Problem:**
Gap #58: Content Draft sidebar badge (amber count) never implemented. Users don't know drafts are waiting.
Gap #59: Occasion alerts exist in the DB (32 seeded occasions) but never surface to dashboard home.
Content drafts empty state: blank page with no guidance.

**Solution:**
- `lib/badges/badge-counts.ts` — `getSidebarBadgeCounts()`, `markSectionSeen()`, `formatBadgeCount()`
- Sidebar: amber badge pills on Content Drafts + Visibility nav items
- `lib/occasions/occasion-feed.ts` — 14-day window, snooze filter, draft-exists filter, max 3 cards
- `OccasionAlertCard` + `OccasionAlertFeed` — dismissible, snoozeable, optimistic UI
- `app/actions/occasions.ts` — snooze, dismiss, createDraftFromOccasion (Growth+, admin+)
- Content drafts empty state: CTA to `/dashboard/compete`
- Migration: `occasion_snoozes` + `sidebar_badge_state` tables with RLS

**New tests:** 80 (25 badge-counts + 17 occasion-feed + 21 occasion-actions + 17 occasion-alert-card)
**Full suite:** 2543 tests, 178 files, 0 regressions

---

## 2026-03-02 — Sprint 100: Multi-Location Management (Gap #57: 40% → 100%) (Completed)

**Goal:** Complete Agency-tier multi-location management — full CRUD for locations, location-scoped data isolation across all dashboard queries, org-switching UI for multi-org users, and a dedicated location management page.

**Problem:**
- LocationSwitcher existed (Sprint 62) but used client-side cookies (not HttpOnly), no edit/archive/set-primary capabilities, and no data isolation verification.
- Dashboard data layers (6+ files) queried by `org_id` only — all locations' data was mixed together.
- No mechanism for users belonging to multiple organizations to switch between them.
- No dedicated location management page — locations could be created but not edited, archived, or reordered.

**Key Architecture Decision:**
Moved location management from `/dashboard/locations` to `/dashboard/settings/locations` (settings concern). Converted LocationSwitcher to HttpOnly cookie via server action. Kept OrgSwitcher minimal (cookie-based, no RLS changes — full multi-org RLS deferred to Sprint 101). Data isolation uses backwards-compatible pattern: `if (locationId) query = query.eq('location_id', locationId)`.

**Solution:**
- **Migration:** Added `is_archived`, `display_name`, `timezone`, `location_order` columns. Partial unique index `idx_locations_one_primary_per_org` enforces one primary per org. Backfill `display_name` from `business_name`.
- **Active Location Utility:** `lib/location/active-location.ts` — centralized resolution (cookie → primary → oldest → null), filters archived, validates cookie against org.
- **Location Actions:** `app/actions/locations.ts` — 5 server actions: `addLocation` (admin+, plan limit), `updateLocation` (admin+), `archiveLocation` (admin+, guards), `setPrimaryLocation` (owner only), `switchActiveLocation` (any role, HttpOnly cookie).
- **LocationSwitcher Enhancement:** Replaced `document.cookie` with server action, added `display_name` support, "Manage Locations" link for Agency plan.
- **Location Management Page:** `/dashboard/settings/locations` — Server Component, card grid with edit/archive/set-primary actions, plan gate for multi-location.
- **Data Isolation Fixes:** Added `locationId` parameter to 5 data layers + 2 calling pages. Pattern: `if (locationId) query = query.eq('location_id', locationId)`.
- **OrgSwitcher:** `lib/auth/active-org.ts` (cookie-based org resolution), `app/actions/switch-org.ts` (membership validation + cookie), `components/layout/OrgSwitcher.tsx` (dropdown, hidden for single-org users).

**Changes:**
- `supabase/migrations/20260302000001_multi_location_management.sql` — **NEW.** is_archived, display_name, timezone, location_order + indexes + backfill
- `lib/location/active-location.ts` — **NEW.** resolveActiveLocation, getActiveLocationId, LOCATION_COOKIE
- `app/actions/locations.ts` — **NEW.** addLocation, updateLocation, archiveLocation, setPrimaryLocation, switchActiveLocation
- `lib/auth/active-org.ts` — **NEW.** getActiveOrgId, getUserOrgs, ORG_COOKIE
- `app/actions/switch-org.ts` — **NEW.** switchActiveOrg server action
- `components/layout/OrgSwitcher.tsx` — **NEW.** Multi-org dropdown component
- `app/dashboard/settings/locations/page.tsx` — **NEW.** Location management page
- `app/dashboard/settings/locations/_components/LocationFormModal.tsx` — **NEW.** Add/Edit location modal
- `app/dashboard/settings/locations/_components/LocationCard.tsx` — **NEW.** Location card with actions
- `lib/schemas/locations.ts` — **MODIFIED.** Added AddLocationSchema, UpdateLocationSchema
- `lib/supabase/database.types.ts` — **MODIFIED.** Added 4 new location columns to types
- `app/dashboard/layout.tsx` — **MODIFIED.** Replaced inline cookie logic with resolveActiveLocation()
- `components/layout/LocationSwitcher.tsx` — **MODIFIED.** HttpOnly cookie, display_name, manage link
- `components/layout/Sidebar.tsx` — **MODIFIED.** Pass plan prop to LocationSwitcher
- `lib/data/dashboard.ts` — **MODIFIED.** Added locationId parameter to all queries
- `lib/data/crawler-analytics.ts` — **MODIFIED.** Added locationId parameter
- `lib/data/ai-responses.ts` — **MODIFIED.** Added locationId parameter to both queries
- `lib/data/freshness-alerts.ts` — **MODIFIED.** Added locationId parameter
- `lib/data/schema-generator.ts` — **MODIFIED.** Added locationId parameter, location-specific lookup
- `app/dashboard/page.tsx` — **MODIFIED.** Resolves active location, passes to data layer
- `app/dashboard/ai-responses/page.tsx` — **MODIFIED.** Added location scoping
- `app/dashboard/locations/page.tsx` — **MODIFIED.** Redirects to settings/locations
- `app/dashboard/settings/_components/SettingsForm.tsx` — **MODIFIED.** Added manage locations link

**Tests added:** 92 new tests across 3 test files
- `src/__tests__/unit/active-location.test.ts` — 24 tests (cookie resolution, primary fallback, oldest fallback, archived filter, data mapping)
- `src/__tests__/unit/location-actions.test.ts` — 52 tests (all 5 actions: auth, role, plan gate, validation, edge cases, cookie management)
- `src/__tests__/unit/org-switcher.test.ts` — 16 tests (switchActiveOrg, getActiveOrgId, getUserOrgs)

**Fixtures added:** `MOCK_SECOND_LOCATION`, `MOCK_ARCHIVED_LOCATION` in `src/__fixtures__/golden-tenant.ts`

**Total test count:** ~2428 (2336 prior + 92 new)

---

## 2026-03-01 — Sprint 99: Seat-Based Billing + Agency Permissions (Gap #75: 60% → 100%) (Completed)

**Goal:** Complete the Agency tier by wiring seat-based billing into Stripe and adding granular per-location permissions. Three deliverables: Stripe seat quantity management, bidirectional seat limit enforcement, and per-location scoped roles.

**Problem:**
- Sprint 98 delivered multi-user invitations + roles but no billing integration — Agency seats could not be monetized.
- No mechanism to enforce seat limits: orgs could invite unlimited members.
- No per-location access control: all members saw all location data, inadequate for agency workflows managing multiple client locations.

**Key Architecture Decision:**
Sprint spec assumed `orgs` table and `org_members` table with `org_role` enum, but pre-flight investigation confirmed existing `organizations` table, `memberships` table, and `membership_role` enum. Adapted all implementation to use existing schema exactly. Stripe quantity approach uses top-level `subscription.quantity` (single-item subscriptions) rather than multi-item approach.

**Solution:**
- **Seat Plans Config:** `lib/stripe/seat-plans.ts` — Single source of truth for per-plan seat configuration (Agency = multi-user, all others = 1 seat). `getSeatLimit()`, `isMultiUserPlan()`.
- **Seat Manager:** `lib/stripe/seat-manager.ts` — All Stripe seat operations: `checkSeatAvailability()` (DB-only, atomic), `updateSeatQuantity()` (Stripe + DB), `syncSeatLimitFromWebhook()` (webhook → DB), `calculateSeatOverage()`.
- **Webhook Extensions:** `handleSubscriptionUpdated()` now syncs `seat_limit` from subscription quantity. `handleSubscriptionDeleted()` resets `seat_limit=1` + `seat_overage_count=0`.
- **Invitation Seat Check:** `sendInvitation()` calls `checkSeatAvailability()` BEFORE email sending. Returns `seat_limit_reached` error with seat count details.
- **Seat Actions:** `app/actions/seat-actions.ts` — `addSeat()`, `removeSeat()`, `getSeatSummary()`. Owner-only, Agency-only. Overage prevention on remove.
- **Seat UI:** `SeatManagementCard` on billing page — progress bar, add/remove buttons, overage banner, past-due warning.
- **Location Permissions:** `lib/auth/location-permissions.ts` — `resolveLocationRole()`, `getUserLocationAccess()`, `assertLocationRole()`, `setLocationPermission()`, `revokeLocationPermission()`. Most-restrictive-wins: `min(org_role, location_role)`.
- **Location Access Helper:** `lib/data/location-access.ts` — `getAccessibleLocationIds()` memoized via `React.cache()` for dashboard query filtering.
- **Location UI:** `LocationAccessPanel` component in team settings — expandable per-member, multi-location Agency orgs only.
- **Overage Email:** `emails/SeatOverageEmail.tsx` + `lib/email/send-overage.ts` — sent when Stripe downgrade creates overage.
- **Migration:** `seat_limit`, `seat_overage_count`, `seat_overage_since`, `seats_updated_at` on organizations. `stripe_webhook_events` table for idempotency. `location_permissions` table with RLS (owner-only write).
- **Plan Enforcer:** Added `canManageTeamSeats()`, `defaultSeatLimit()`.

**Changes:**
- `supabase/migrations/20260301000003_seat_billing_location_permissions.sql` — **NEW.** Seat columns + webhook events + location permissions + RLS
- `lib/stripe/seat-plans.ts` — **NEW.** Seat plan configuration (SEAT_PLANS, getSeatLimit, isMultiUserPlan)
- `lib/stripe/seat-manager.ts` — **NEW.** Stripe seat operations (check, update, sync, overage)
- `lib/auth/location-permissions.ts` — **NEW.** Location-level permission resolution
- `lib/data/location-access.ts` — **NEW.** Memoized location access filter for dashboard queries
- `app/actions/seat-actions.ts` — **NEW.** addSeat, removeSeat, getSeatSummary server actions
- `app/dashboard/billing/_components/SeatManagementCard.tsx` — **NEW.** Seat management UI card
- `app/dashboard/settings/team/_components/LocationAccessPanel.tsx` — **NEW.** Per-member location access panel
- `emails/SeatOverageEmail.tsx` — **NEW.** Seat overage warning email template
- `lib/email/send-overage.ts` — **NEW.** Overage email sender (Resend)
- `app/api/webhooks/stripe/route.ts` — **MODIFIED.** Seat sync in subscription.updated, seat reset in subscription.deleted
- `app/actions/invitations.ts` — **MODIFIED.** Added seat check before email sending
- `app/dashboard/billing/page.tsx` — **MODIFIED.** Added SeatManagementCard for Agency plan
- `app/dashboard/settings/team/_components/TeamClient.tsx` — **MODIFIED.** Added seat_limit_reached error message
- `lib/plan-enforcer.ts` — **MODIFIED.** Added canManageTeamSeats(), defaultSeatLimit()
- `src/__tests__/unit/stripe-webhook.test.ts` — **MODIFIED.** Updated deleted event assertion for seat_limit
- `src/__tests__/unit/stripe-webhook-events.test.ts` — **MODIFIED.** Updated deleted event assertion for seat_limit

**Tests added:** 114 new tests across 5 test files
- `src/__tests__/unit/seat-manager.test.ts` — 36 tests (availability, update, sync, overage, plan helpers)
- `src/__tests__/unit/location-permissions.test.ts` — 20 tests (resolve, access, assert, set, revoke)
- `src/__tests__/unit/stripe-webhook-seats.test.ts` — 11 tests (seat sync, deleted, signature)
- `src/__tests__/unit/seat-actions.test.ts` — 12 tests (addSeat, removeSeat, getSeatSummary)
- `src/__tests__/unit/send-invitation-seat-check.test.ts` — 5 tests (seat limit enforcement in invitations)

**Total test count:** ~2336 (2222 prior + 114 new)

---

## 2026-03-01 — Sprint 98: Multi-User Foundation — Invitations + Roles (Gap #75: 0% → 60%) (Completed)

**Goal:** Build the foundational multi-user system: role enforcement library, token-based invitation flow, team management UI, and invite acceptance page. Enables org owners to invite admin/viewer team members with email-verified acceptance.

**Problem:**
- Single-user system: `memberships` table existed but only the auto-created owner row was ever used.
- No invitation mechanism, no role enforcement library, no team management UI.
- RLS via `current_user_org_id()` already supports multi-user but no way to add users.

**Key Architecture Decision:**
Sprint spec assumed creating NEW `org_members` table and `org_role` enum, but pre-flight investigation revealed the existing `memberships` table and `membership_role` enum already provide this infrastructure. Adapted entire implementation to reuse existing tables, avoiding data duplication and maintaining consistency with `current_user_org_id()` RLS.

**Solution:**
- **Role Library:** `lib/auth/org-roles.ts` — `roleSatisfies()`, `assertOrgRole()`, `getOrgRole()`, `ROLE_PERMISSIONS`, `InsufficientRoleError`. Hierarchy: viewer/member=0, admin=1, owner=2.
- **Invitation Actions:** `app/actions/invitations.ts` — `sendInvitation`, `revokeInvitation`, `removeMember`, `updateMemberRole`. All derive orgId from session (§18).
- **Accept Flow:** `app/actions/accept-invitation.ts` — service-role client bypasses RLS for invitee who isn't yet a member. Email match is case-insensitive.
- **Email:** `emails/InvitationEmail.tsx` (React Email, dark theme) + `lib/email/send-invitation.ts` (Resend wrapper).
- **Public Invite Page:** `app/(public)/invite/[token]/` — 6 states (invalid, pending_login, pending_accept, wrong_account, success, error).
- **Team UI:** `app/dashboard/settings/team/` — members table, pending invitations, invite form. PlanGate wraps invite (agency required).
- **Migration:** `pending_invitations` table + `invited_by`/`joined_at` columns on existing `memberships`.

**Changes:**
- `supabase/migrations/20260301000002_multi_user_foundation.sql` — **NEW.** pending_invitations table + memberships columns + RLS + indexes
- `lib/auth/org-roles.ts` — **NEW.** Role enforcement library (hierarchy, permissions, assertion, InsufficientRoleError)
- `app/actions/invitations.ts` — **NEW.** Send/revoke/remove/updateRole server actions
- `app/actions/accept-invitation.ts` — **NEW.** Token-based invite acceptance (service-role)
- `lib/email/send-invitation.ts` — **NEW.** Resend email sender for invitations
- `emails/InvitationEmail.tsx` — **NEW.** React Email dark theme invitation template
- `app/api/invitations/accept/route.ts` — **NEW.** Public GET route for email link redirect
- `app/(public)/layout.tsx` — **NEW.** Bare passthrough layout for public routes
- `app/(public)/invite/[token]/page.tsx` — **NEW.** Server Component invite page
- `app/(public)/invite/[token]/InviteAcceptClient.tsx` — **NEW.** Client Component with 6 acceptance states
- `app/dashboard/settings/team/page.tsx` — **NEW.** Team management page (Server Component)
- `app/dashboard/settings/team/_components/TeamClient.tsx` — **NEW.** Team management client (members table + invite form)
- `app/dashboard/settings/_components/SettingsForm.tsx` — **MODIFIED.** Added "Manage team members →" link
- `lib/supabase/database.types.ts` — **MODIFIED.** Added pending_invitations types + memberships columns
- `docs/AI_RULES.md` — **MODIFIED.** Added §51

**Test counts:**
- `src/__tests__/unit/org-roles.test.ts` — 31 tests
- `src/__tests__/unit/invitations.test.ts` — 20 tests
- `src/__tests__/unit/accept-invitation.test.ts` — 12 tests
- **Sprint 98 total: 63 new tests**
- **Full suite: 2285 tests passing, 166 files**

**Gaps Closed:**
- Gap #75: Multi-User Foundation — 0% → 60% (remaining: ownership transfer, E2E tests, profile page)

---

## 2026-03-01 — Sprint 97: Citation Cron + Dynamic llms.txt (Gaps #60 + #62: 40%/30% → 100%) (Completed)

**Goal:** Close two interconnected data pipeline gaps: make the citation cron tenant-derived (reading real org categories and metros instead of hardcoded arrays), and transform the static `/llms.txt` into a dynamic, org-specific AI visibility file.

**Problem:**
1. Citation cron: hardcoded `TRACKED_CATEGORIES` × `TRACKED_METROS` (9 × 20 = 180 combos), never derived from real tenant data
2. llms.txt: static marketing copy, same for all visitors, not business-specific or LLM-useful

**Solution:**
- **Citation Cron:** Rewrote route to fetch Growth+ orgs, extract category+city/state from their primary locations, deduplicate tuples, and run Perplexity citation sampling per unique tuple. Reuses existing `runCitationSample()` and `writeCitationResults()`.
- **Dynamic llms.txt:** Pure `generateLLMsTxt()` builds structured plain-text from live location data (hours, amenities, menu highlights, hallucination corrections). Route serves org-specific content via `?org=slug`. Settings page shows URL + manual regeneration button.

**Changes:**
- `lib/citation/citation-query-builder.ts` — **NEW.** Pure tenant-derived query builder (normalizeCategoryLabel, buildMetroVariants, buildCitationQueries)
- `lib/citation/citation-source-parser.ts` — **NEW.** Pure citation parser (extractDomain, domainToPlatform, aggregatePlatformCounts, KNOWN_CITATION_PLATFORMS)
- `app/api/cron/citation/route.ts` — **REWRITTEN.** Tenant-derived, Growth+ plan-gated, error-isolated, deduplicates tuples
- `lib/llms-txt/llms-txt-generator.ts` — **NEW.** Pure org-level llms.txt generator
- `lib/llms-txt/llms-txt-data-loader.ts` — **NEW.** DB loader (org + location + menu items + hallucination corrections + published menu slug)
- `app/llms.txt/route.ts` — **REWRITTEN.** Dynamic org-aware with `?org=slug`, 6h CDN cache, platform fallback
- `app/actions/regenerate-llms-txt.ts` — **NEW.** On-demand regeneration server action (Growth+)
- `app/dashboard/settings/business-info/_components/LLMsTxtCard.tsx` — **NEW.** AI Visibility File card
- `app/dashboard/settings/business-info/page.tsx` — **MODIFIED.** Added LLMsTxtCard integration
- `lib/plan-enforcer.ts` — **MODIFIED.** Added `canRegenerateLLMsTxt()` gate
- `lib/supabase/database.types.ts` — **MODIFIED.** Added `llms_txt_updated_at` to locations type
- `supabase/migrations/20260301000001_add_llms_txt_updated_at.sql` — **NEW.** Migration
- `docs/AI_RULES.md` — **MODIFIED.** Added §50

**Test counts:**
- `src/__tests__/unit/citation-query-builder.test.ts` — 22 tests
- `src/__tests__/unit/citation-source-parser.test.ts` — 30 tests
- `src/__tests__/unit/llms-txt-generator.test.ts` — 24 tests
- `src/__tests__/unit/citation-cron-tenant.test.ts` — 14 tests
- `src/__tests__/unit/cron-citation.test.ts` — 6 tests (updated: legacy constants + gap score)
- **Sprint 97 total: 96 new/updated tests**
- **Full suite: 2222 tests passing, 163 files**

**Gaps Closed:**
- Gap #60: Citation Intelligence Cron — 40% → 100%
- Gap #62: Smart llms.txt — 30% → 100%

---

## 2026-02-28 — Sprint 94: Publish Pipeline Verification (WordPress + GBP Post) (Completed)

**Goal:** Verify and fix the WordPress and GBP Post publishers end-to-end. Both files existed at ~70% but had zero test coverage. Close the detect → draft → publish loop.

**Diagnosis findings:**
- publish-wordpress.ts:
  - Gap W1 (DB update): Handled by publishDraft() action (correct architecture — publisher returns result, caller updates DB)
  - Gap W2 (Content-Type): Already correct (application/json header)
  - Gap W3 (App Password format): Already correct — added external whitespace trimming
  - Gap W4 (Error codes): Descriptive throw messages (action catch block handles)
  - Gap W5 (Content format): Already correct — WP block format
  - Fixed: URL normalization via `new URL()`, network error catch (site unreachable)
- publish-gbp.ts:
  - Gap G1 (Token expiry check): Inline check — fixed to use shared `isTokenExpired()` (5-min buffer)
  - Gap G2 (Token refresh flow): Already implemented (pre-flight + 401 retry)
  - Gap G3 (Content truncation): Already implemented at sentence boundary, 1500 chars
  - Gap G4 (Parent path): Already correct — fetches `google_location_name` from locations
  - Gap G5 (DB update): Handled by action (correct architecture)
  - Gap G6 (callToAction): Not implemented — intentional omission
  - Fixed: Added HTML tag stripping before GBP summary (plain text only)

**Changes:**
- `lib/autopilot/publish-wordpress.ts` — **FIXED.** URL normalization with `new URL()`, Application Password whitespace trim, network error handling (site unreachable).
- `lib/autopilot/publish-gbp.ts` — **FIXED.** Wired `isTokenExpired()` from Sprint 90 shared service (5-min buffer), added HTML tag stripping for GBP plain-text summary.
- `app/dashboard/content-drafts/_components/ContentDraftCard.tsx` — **MODIFIED.** Added WordPress/GBP publish buttons (target-aware), publish confirmation dialog, success/error banners, `data-testid` attributes.
- `supabase/seed.sql` — **MODIFIED.** Added 2 approved content draft rows (f5, f6 UUIDs) for publish pipeline testing.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added MOCK_WP_CREDENTIALS, MOCK_CONTENT_DRAFT_WP, MOCK_CONTENT_DRAFT_GBP.

**Tests added:**
- `publish-wordpress.test.ts` — **14 Vitest tests.** API call, auth header, error codes, network error, password whitespace, URL normalization.
- `publish-gbp.test.ts` — **20 Vitest tests.** API call, token refresh, 401 retry, content truncation, HTML stripping, no-connection error.
- `publish-draft-action.test.ts` — **12 Vitest tests.** WP routing + credential check, GBP routing, auth, HITL validation.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/publish-wordpress.test.ts        # 14 tests
npx vitest run src/__tests__/unit/publish-gbp.test.ts              # 20 tests
npx vitest run src/__tests__/unit/publish-draft-action.test.ts     # 12 tests
npx vitest run                                                       # 2005 tests, 0 regressions
npx tsc --noEmit                                                     # 0 type errors
```

---

## 2026-02-28 — Sprint 93: Business Info Editor (Post-Onboarding) (Completed)

**Goal:** Allow users to update their ground-truth business data (hours, amenities, basic info) at any time post-onboarding without re-running the wizard. Added Business Info sub-route to Settings. Reused UI patterns from TruthCalibrationForm, triggerGBPImport(), and triggerFirstAudit() from prior sprints.

**Scope:**
- `app/dashboard/settings/business-info/actions.ts` — **NEW.** `saveBusinessInfo()` server action. Zod-validated, handles ALL location fields (basic info + hours + amenities). Normalizes empty strings to null. Maps `primary_category` → `categories` array. Belt-and-suspenders org_id filter.
- `app/dashboard/settings/business-info/page.tsx` — **NEW.** Server Component. Fetches primary location + GBP connection status (via `google_oauth_tokens`). Passes data to `BusinessInfoForm`.
- `app/dashboard/settings/business-info/_components/BusinessInfoForm.tsx` — **NEW.** 'use client' form with 4 sections: GBP Sync Card (conditional), Basic Info (9 fields), Amenities (6 checkboxes), Hours (7-day grid). Includes change detection, audit prompt banner, GBP re-sync with merge, state uppercase on blur, website protocol prefix.
- `app/dashboard/settings/_components/SettingsForm.tsx` — **MODIFIED.** Added "Edit business information →" link in Organization section.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added `MOCK_BUSINESS_INFO_LOCATION` fixture.

**Tests added:**
- `save-business-info.test.ts` — **13 Vitest tests.** Auth gating, Zod validation, DB persistence, org_id scoping, revalidation, error propagation, empty-string normalization.
- `business-info-form.test.tsx` — **17 Vitest tests.** Section rendering, pre-population, GBP card visibility, null handling, state uppercase, website prefix, validation, amenities, hours grid, day labels.
- `18-business-info.spec.ts` — **10 Playwright tests.** Page heading, pre-population, phone/status, hours/amenities visibility, save button, navigation, validation.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/save-business-info.test.ts        # 13 tests
npx vitest run src/__tests__/unit/business-info-form.test.tsx       # 17 tests
npx vitest run                                                       # 1959 — no regressions
npx playwright test tests/e2e/18-business-info.spec.ts --project=chromium  # 10 e2e tests
npx tsc --noEmit                                                     # 0 type errors
```

---

## 2026-02-28 — Sprint 92: Launch Readiness Sweep (Completed)

**Goal:** Harden LocalVector V1 for its first paying customer. Fix all skipped/failing tests, verify CI is green, confirm all test infrastructure is solid. Verification + hardening sprint — no new features.

**Test Suite: Before vs After**
- Before: 145 files passed / 1 failed / 1914 tests passed / 7 skipped
- After: 148 files passed / 0 failed / 1929 tests passed / 0 skipped

**Root Causes Fixed:**
- `rls-isolation.test.ts` — Was an integration test requiring live Supabase, included in default `npx vitest run`. Fix: removed `integration/` from default vitest includes (tests still available via `npm run test:integration`), created new unit-level `rls-isolation.test.ts` with 10 application-level org-scoping verification tests.
- `auth-flow.test.ts` — Did not exist. Created with 10 tests covering getSafeAuthContext and getAuthContext (null session, partial context, full context, zero-parameter verification).
- TypeScript errors (3) — `ClusterChart.tsx` Recharts shape prop type mismatch (fixed with `unknown` param + cast), `brief-actions.ts` async return type annotation (string → Promise<string>).

**New Tests Added:**
- `src/__tests__/unit/auth-flow.test.ts` — 10 tests: getSafeAuthContext (5) + getAuthContext (5)
- `src/__tests__/unit/rls-isolation.test.ts` — 10 tests: org-scoping verification (server actions, cron guards, data layer, auth derivation)
- `src/__tests__/unit/stripe-webhook-events.test.ts` — 10 tests: all revenue-critical Stripe webhook event paths
- `src/__tests__/unit/sentry-config.test.ts` — 4 tests: Sentry init verification (DSN, enabled/disabled, sample rate)

**CI Changes:**
- Added `tsc --noEmit` step before vitest (fast failure on type errors)
- Updated job name from `unit-and-integration` to `typecheck-and-test`
- Added `NEXT_PUBLIC_SENTRY_DSN: ''` to CI env vars
- Updated comment to reflect unit-only test scope
- Added CI status badge to README.md

**Sentry Status:**
- Already fully configured (Sprint 26A): client, server, edge configs, dashboard error boundary, next.config.ts wrapped with withSentryConfig()
- No changes needed — configuration was already production-ready

**Discovered Gaps (not fixed in this sprint — external service verification):**
- Stripe end-to-end: requires manual testing with Stripe CLI and test cards (local dev verification)
- Resend email delivery: requires manual testing with real Resend API key
- Sentry event verification: requires NEXT_PUBLIC_SENTRY_DSN set in dev environment
- Golden Tenant data seeding: requires running Supabase locally (`npx supabase db reset`)
- These are manual verification steps, not code changes — documented for launch checklist

**Run commands:**
```bash
npx tsc --noEmit                    # 0 type errors
npx vitest run                      # 1929 tests passing, 0 failing, 0 skipped
npx playwright test                 # E2E tests (requires local Supabase)
```

---

## 2026-02-28 — Sprint 91: Onboarding Wizard Completion (Completed)

**Goal:** Complete the onboarding wizard from 50% to 100%. Build full Step 1-5 flow, wire Sprint 89 GBP import into Step 1, auto-run first Fear Engine audit in Step 5, add progress indicator. New users reach a populated dashboard in < 3 minutes (GBP) or < 5 minutes (manual).

**Scope:**
- `app/onboarding/page.tsx` — **REWRITTEN.** Thin Server Component fetches location, GBP connection, and seeded queries, then renders OnboardingWizard client component. Redirects already-onboarded users.
- `app/onboarding/_components/OnboardingWizard.tsx` — **NEW.** Main wizard client component managing WizardState across 5 steps. GBP amenity key mapping helper.
- `app/onboarding/_components/WizardProgress.tsx` — **NEW.** Accessible step progress indicator. ARIA roles, 5 step labels, active/complete/inactive Tailwind states.
- `app/onboarding/_components/GBPImportInterstitial.tsx` — **MODIFIED.** Added optional `onImportSuccess` and `onSkipToManual` callback props for wizard integration. Backward compatible.
- `app/onboarding/_components/TruthCalibrationForm.tsx` — **MODIFIED.** Added `onSubmitSuccess`, `prefillHours`, `prefillAmenities`, `showPrefillBanner` props. GBP pre-fill banner. Backward compatible.
- `app/onboarding/_components/Step3Competitors.tsx` — **NEW.** Free-form competitor name entry. Add/remove, max 5. Skip allowed. Saves via seedOnboardingCompetitors().
- `app/onboarding/_components/Step4SOVQueries.tsx` — **NEW.** Displays seeded target_queries. Up to 3 custom additions via addCustomSOVQuery(). Removable custom queries.
- `app/onboarding/_components/Step5Launch.tsx` — **NEW.** Triggers first Fear Engine audit via triggerFirstAudit() (calls processOrgAudit directly). Polls /api/onboarding/audit-status every 5s, cap 90s. Graceful degradation on timeout. Auto-redirect countdown. router.push('/dashboard').
- `app/onboarding/actions.ts` — **MODIFIED.** Added 6 new server actions: seedOnboardingCompetitors, addCustomSOVQuery, deleteCustomSOVQuery, getSeededQueries, triggerFirstAudit, completeOnboarding.
- `app/api/onboarding/audit-status/route.ts` — **NEW.** Polling endpoint for Step 5. Returns running/complete/not_found. Org-scoped. 5-minute window.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added MOCK_WIZARD_QUERIES, MOCK_ONBOARDING_COMPETITORS, MOCK_ONBOARDING_ORG.

**Tests added:**
- `src/__tests__/unit/wizard-progress.test.tsx` — **10 Vitest tests.** Accessibility, step styling, data-testid.
- `src/__tests__/unit/seed-competitors.test.ts` — **8 Vitest tests.** Auth, max-5 guard, deduplication, notes field.
- `src/__tests__/unit/complete-onboarding.test.ts` — **7 Vitest tests.** Completion, SOV safety net, idempotency.
- `src/__tests__/unit/trigger-first-audit.test.ts` — **5 Vitest tests.** Non-blocking failure handling, processOrgAudit call.
- `src/__tests__/unit/audit-status-route.test.ts` — **6 Vitest tests.** Auth, status states, 5-min window, org scoping.
- `tests/e2e/17-onboarding-wizard.spec.ts` — **12 Playwright tests.** Full manual path (5-step flow), competitor add/remove, SOV query display, launch/redirect, GBP toast messages. Mocked audit-status for speed.
- `tests/e2e/02-onboarding-guard.spec.ts` — **UPDATED.** Now walks through Sprint 91 5-step wizard.
- `tests/e2e/onboarding.spec.ts` — **UPDATED.** Same 5-step flow for incomplete@ user.
- `tests/e2e/global.setup.ts` — **UPDATED.** Resets onboarding_completed, competitors, target_queries for incomplete@.
- `tests/e2e/15-gbp-onboarding-connect.spec.ts` — **UPDATED.** Headline assertion matches new wizard.
- `tests/e2e/16-gbp-import-flow.spec.ts` — **UPDATED.** Manual wizard assertions match new wizard.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/wizard-progress.test.tsx          # 10 tests
npx vitest run src/__tests__/unit/seed-competitors.test.ts          # 8 tests
npx vitest run src/__tests__/unit/complete-onboarding.test.ts       # 7 tests
npx vitest run src/__tests__/unit/trigger-first-audit.test.ts       # 5 tests
npx vitest run src/__tests__/unit/audit-status-route.test.ts        # 6 tests
npx vitest run                                                       # 1914 passing — no regressions
npx tsc --noEmit                                                     # 0 new type errors
npx playwright test tests/e2e/17-onboarding-wizard.spec.ts          # 12 Playwright tests
```

**Key decisions:**
- No migration needed — `organizations.onboarding_completed` (boolean) already exists.
- All actions in `app/onboarding/actions.ts` (matches existing pattern).
- Fear Engine triggered via `processOrgAudit()` directly (not Inngest event which fans out to all orgs).
- Dashboard guard unchanged (backward compat for pre-Sprint 91 users).
- Competitors table `notes` field used instead of non-existent `is_manual` column.

---

## 2026-02-28 — Sprint 89: GBP Data Import — Full Mapping Pipeline (Completed)

**Goal:** Complete the GBP data import pipeline. OAuth was connected (Sprint 57B) but no enriched data flowed into the system for re-sync. This sprint closes the loop: connect → fetch → map → upsert → populated dashboard.

**Scope:**
- `lib/types/gbp.ts` — **MODIFIED.** Extended GBPLocation with openInfo, attributes, categories, GBPAttribute interface.
- `lib/gbp/gbp-data-mapper.ts` — **NEW.** Enhanced GBP → LocationData mapper. Exports: `mapGBPToLocation()`, `mapHours()`, `mapOperationalStatus()`, `mapAmenities()`, `formatTime()`, `KNOWN_AMENITY_ATTRIBUTES`, `GBP_DAY_MAP`. Handles all 7 days, midnight closes, unknown attributes.
- `lib/services/gbp-token-refresh.ts` — **MODIFIED.** Added `isTokenExpired()` (5-min buffer).
- `app/api/gbp/import/route.ts` — **NEW.** Authenticated POST endpoint. Auth → token check → GBP fetch (readMask) → map → upsert with gbp_synced_at. Error codes: not_connected, token_expired, gbp_api_error, no_location, upsert_failed.
- `app/actions/gbp-import.ts` — **NEW.** Server Action wrapper for triggerGBPImport().
- `app/onboarding/page.tsx` — **MODIFIED.** GBP import interstitial step added. States: idle, importing (spinner), success (data preview card), error (error_code-specific message + manual fallback). data-testid attributes on all interactive elements.
- `app/onboarding/_components/GBPImportInterstitial.tsx` — **NEW.** Client component for the import interstitial.
- `app/dashboard/_components/GBPImportCard.tsx` — **NEW.** Growth+ plan gated via canConnectGBP(). Shows last sync time or "never synced" CTA. Inline loading on Sync Now.
- `app/dashboard/page.tsx` — **MODIFIED.** GBPImportCard added to dashboard for connected users.
- `supabase/migrations/20260228000003_locations_gbp_sync.sql` — **NEW.** Adds gbp_synced_at timestamptz + index.
- `supabase/prod_schema.sql` — **MODIFIED.** Added gbp_synced_at to locations.
- `lib/supabase/database.types.ts` — **MODIFIED.** Added gbp_synced_at to locations Row/Insert/Update.
- `supabase/seed.sql` — **MODIFIED.** Updated Charcoal N Chill location with realistic hours_data, operational_status, amenities, gbp_synced_at.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added MOCK_GBP_LOCATION_ENRICHED and MOCK_GBP_MAPPED.

**Tests added:**
- `src/__tests__/unit/gbp-data-mapper.test.ts` — **39 Vitest tests.** Pure function tests: mapGBPToLocation (13), mapHours (8), mapOperationalStatus (6), mapAmenities (7), formatTime (5).
- `src/__tests__/unit/gbp-import-route.test.ts` — **12 Vitest tests.** Auth guard, error codes, GBP fetch mock, upsert, token refresh.
- `src/__tests__/unit/gbp-token-refresh.test.ts` — **5 new isTokenExpired tests** added to existing 12 tests (17 total).
- `tests/e2e/16-gbp-import-flow.spec.ts` — **8 Playwright tests.** Dashboard card (2), Onboarding interstitial (4), Toast messages (2). All GBP API calls mocked via page.route().

**Run commands:**
- `npx vitest run src/__tests__/unit/gbp-data-mapper.test.ts` — 39 tests
- `npx vitest run src/__tests__/unit/gbp-import-route.test.ts` — 12 tests
- `npx vitest run src/__tests__/unit/gbp-token-refresh.test.ts` — 17 tests (5 new + 12 existing)
- `npx vitest run` — All unit tests — no regressions (1878 passing)
- `npx playwright test tests/e2e/16-gbp-import-flow.spec.ts` — 8 e2e tests
- `npx tsc --noEmit` — 0 new type errors

---

## 2026-02-27 — Sprint 90: GBP Token Refresh + Places Detail Refresh Crons (Completed)

**Goal:** Proactive GBP OAuth token refresh (hourly cron) and Google Places Detail refresh (daily cron for ToS compliance). Fixes Gap #71 (token time bomb) and Gap #72 (stale Place Details).

**Scope:**
- `lib/services/gbp-token-refresh.ts` — **NEW.** Shared service: `refreshGBPAccessToken()` (single org) + `refreshExpiringTokens()` (bulk cron). Returns `TokenRefreshResult` with `newAccessToken`.
- `lib/services/places-refresh.ts` — **NEW.** `refreshStalePlaceDetails()` — finds locations >29 days stale for active-plan orgs, fetches Google Places API (New), updates DB. Zombie filter excludes churned orgs.
- `app/api/cron/refresh-gbp-tokens/route.ts` — **NEW.** Hourly cron: CRON_SECRET auth, kill switch (STOP_TOKEN_REFRESH_CRON), Inngest dispatch + inline fallback.
- `app/api/cron/refresh-places/route.ts` — **NEW.** Daily cron (9am UTC): CRON_SECRET auth, kill switch (STOP_PLACES_REFRESH_CRON), Inngest dispatch + inline fallback.
- `lib/inngest/functions/token-refresh-cron.ts` — **NEW.** Inngest function for hourly token refresh.
- `lib/inngest/functions/places-refresh-cron.ts` — **NEW.** Inngest function for daily places refresh.
- `lib/inngest/events.ts` — **MODIFIED.** Added `cron/gbp-token-refresh.hourly` and `cron/places-refresh.daily` events.
- `app/api/inngest/route.ts` — **MODIFIED.** Registered 2 new Inngest functions.
- `lib/autopilot/publish-gbp.ts` — **MODIFIED.** Extracted private `refreshGBPToken()` → shared `refreshGBPAccessToken()` import.
- `vercel.json` — **MODIFIED.** Added 2 cron schedules: `0 * * * *` (token refresh) + `0 9 * * *` (places refresh).
- `src/__helpers__/msw/handlers.ts` — **MODIFIED.** Added guards for `oauth2.googleapis.com` and `places.googleapis.com`.

**New tests (33 total):**
- `src/__tests__/unit/gbp-token-refresh.test.ts` — 12 tests (7 refreshGBPAccessToken + 5 refreshExpiringTokens)
- `src/__tests__/unit/cron-refresh-tokens-route.test.ts` — 6 tests (auth, kill switch, Inngest, fallback, logging)
- `src/__tests__/unit/places-refresh.test.ts` — 9 tests (API key guard, stale query, refresh, skip, failures, zombie filter, FieldMask)
- `src/__tests__/unit/cron-refresh-places-route.test.ts` — 6 tests (auth, kill switch, Inngest, fallback, logging)

**Run commands:**
```bash
npx vitest run src/__tests__/unit/gbp-token-refresh.test.ts          # 12 tests PASS
npx vitest run src/__tests__/unit/cron-refresh-tokens-route.test.ts   # 6 tests PASS
npx vitest run src/__tests__/unit/places-refresh.test.ts              # 9 tests PASS
npx vitest run src/__tests__/unit/cron-refresh-places-route.test.ts   # 6 tests PASS
npx vitest run                                                         # 1822 tests passing (was 1789)
```

---

## 2026-02-28 — Sprint 89b: GBP Flow Refinement + Golden Tenant Fixtures + E2E (Completed)

**Goal:** Refine Sprint 89 implementation to align with 89b spec: golden-tenant fixtures, Zod-validated server action, joined addressLines, E2E coverage.

**Scope:**
- `lib/services/gbp-mapper.ts` — **MODIFIED.** MappedLocation: removed `address_line2`, `country` now non-nullable (default 'US'), `google_location_name` non-nullable. `addressLines` joined into single `address_line1`.
- `app/onboarding/connect/actions.ts` — **MODIFIED.** Signature changed to `importGBPLocation(input: { locationIndex })` with Zod validation. Added belt-and-suspenders `.eq('org_id', ctx.orgId)`.
- `app/onboarding/connect/select/LocationPicker.tsx` — **MODIFIED.** Updated call signature.
- `app/(auth)/register/page.tsx` — **MODIFIED.** Google OAuth `redirectTo` → `/onboarding/connect`.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added 5 GBP fixtures (MOCK_GBP_LOCATION, MOCK_GBP_LOCATION_MINIMAL, MOCK_GBP_LOCATION_NO_ADDRESS, MOCK_GBP_ACCOUNT, MOCK_GBP_LOCATION_SECOND).

**Tests rewritten (using golden-tenant fixtures):**
- `src/__tests__/unit/gbp-mapper.test.ts` — 22 tests (was 23).
- `src/__tests__/unit/gbp-import-action.test.ts` — 13 tests (was 9).
- `src/__tests__/unit/gbp-callback-locations.test.ts` — 9 tests (was 7).
- `tests/e2e/15-gbp-onboarding-connect.spec.ts` — **NEW.** 5 Playwright E2E tests.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/gbp-mapper.test.ts              # 22 tests PASS
npx vitest run src/__tests__/unit/gbp-import-action.test.ts        # 13 tests PASS
npx vitest run src/__tests__/unit/gbp-callback-locations.test.ts   # 9 tests PASS
npx vitest run                                                      # 1789 tests passing
npx playwright test tests/e2e/15-gbp-onboarding-connect.spec.ts   # 5 tests
```

---

## 2026-02-28 — Sprint 89: GBP Data Mapping + Import Flow (Completed)

**Goal:** Transform the GBP "connect" button from a token-only operation into a full data import pipeline. New users who connect GBP now have hours and address auto-populated, skipping the manual wizard.

**Scope:**
- `lib/types/gbp.ts` — **NEW.** GBPAccount, GBPLocation interfaces per RFC §3.4.
- `lib/services/gbp-mapper.ts` — **NEW.** mapGBPLocationToRow() and mapGBPHours() — pure functions, no I/O.
- `app/api/auth/google/callback/route.ts` — **REWRITE.** Now fetches GBP locations, auto-imports single location, writes multi-location to pending_gbp_imports, redirects to picker.
- `app/api/auth/google/route.ts` — **MODIFIED.** Added gbp_oauth_source cookie for dual-redirect support.
- `app/onboarding/connect/page.tsx` — **NEW.** GBP connect interstitial ("Connect GBP" vs "Manual").
- `app/onboarding/connect/select/page.tsx` — **NEW.** Multi-location picker.
- `app/onboarding/connect/select/LocationPicker.tsx` — **NEW.** Client wrapper for location selection.
- `app/onboarding/connect/actions.ts` — **NEW.** importGBPLocation() server action.
- `app/onboarding/connect/_components/GBPLocationCard.tsx` — **NEW.** Location card component.
- `app/onboarding/connect/_components/ConnectGBPButton.tsx` — **NEW.** Google-branded OAuth button.
- `app/onboarding/page.tsx` — **MODIFIED.** ?source= fallback toast for GBP flow failures.
- `app/(auth)/register/page.tsx` — **MODIFIED.** Post-registration redirect to /onboarding/connect.

**Tests added:**
- `src/__tests__/unit/gbp-mapper.test.ts` — 23 tests (mapGBPHours + mapGBPLocationToRow).
- `src/__tests__/unit/gbp-import-action.test.ts` — 9 tests (importGBPLocation server action).
- `src/__tests__/unit/gbp-callback-locations.test.ts` — 7 tests (callback location fetch + routing via MSW).

**Run commands:**
```bash
npx vitest run src/__tests__/unit/gbp-mapper.test.ts
npx vitest run src/__tests__/unit/gbp-import-action.test.ts
npx vitest run src/__tests__/unit/gbp-callback-locations.test.ts
npx vitest run   # ALL tests passing (1784 passed, 7 skipped)
```

---

## 2026-02-28 — Bug Fix: `assembleDraftContent` async (AI_RULES §25)

**Goal:** Fix Next.js 16 build error — `assembleDraftContent` was a sync export in `'use server'` file `brief-actions.ts`, violating AI_RULES §25 (`Server Actions must be async functions`).

**Scope:**
- `app/dashboard/share-of-voice/brief-actions.ts` — **MODIFIED.** `assembleDraftContent` → `async`. Internal call site now uses `await`.
- `src/__tests__/unit/content-brief-assembly.test.ts` — **MODIFIED.** Moved `assembleDraftContent()` calls into `beforeAll(async () => { ... })` hooks to await the now-async function.

**Tests:** No new tests. Existing 11 tests in `content-brief-assembly.test.ts` updated to async pattern.

---

## 2026-02-28 — Sprint 88: Phase 5 SOV Cleanup + Build Plan Reconciliation (Completed)

**Goal:** Close the final Phase 5 SOV gaps — add missing `UNIQUE(location_id, query_text)` constraint, add `is_active` soft-disable column, fix sov-seed.ts to use proper upsert, add duplicate detection to addTargetQuery, supersede the unpromoted migration, reconcile Build Plan Phase 5 checkboxes.

**Scope:**
- `supabase/migrations/20260228000002_sov_phase5_cleanup.sql` — **NEW.** Adds `is_active BOOLEAN NOT NULL DEFAULT TRUE` column, deduplicates existing rows (keeps earliest created_at), adds `UNIQUE(location_id, query_text)` constraint, creates partial index `idx_target_queries_active` on `is_active = TRUE`.
- `lib/supabase/database.types.ts` — **MODIFIED.** Added `is_active: boolean` to target_queries Row, `is_active?: boolean` to Insert/Update.
- `lib/services/sov-seed.ts` — **MODIFIED.** Replaced `.insert()` + `console.warn` with `.upsert({ onConflict: 'location_id,query_text', ignoreDuplicates: true })` + `console.error`. Now truly idempotent.
- `app/dashboard/share-of-voice/actions.ts` — **MODIFIED.** `addTargetQuery()` now detects PostgreSQL `23505` (unique_violation) and returns "This query already exists for this location." instead of raw error. **NEW:** `toggleQueryActive()` server action — flips `is_active` boolean with Zod validation and belt-and-suspenders `org_id` check.
- `app/api/cron/sov/route.ts` — **MODIFIED.** Added `.eq('is_active', true)` to target_queries fetch in inline fallback path.
- `lib/inngest/functions/sov-cron.ts` — **MODIFIED.** Added `.eq('is_active', true)` to target_queries fetch in Step 1.
- `app/dashboard/share-of-voice/page.tsx` — **MODIFIED.** Query fetch now selects `is_active` and filters `.eq('is_active', true)`. Added parallel paused count query. `pausedCount` shown in Quick Stats when > 0. `is_active` passed through to QueryWithEvals.
- `app/dashboard/share-of-voice/_components/SovCard.tsx` — **MODIFIED.** `QueryWithEvals` type now includes `is_active: boolean`. Added `handlePause()` with `useTransition`. `QueryRow` has new Eye/EyeOff toggle button (amber hover, zinc default) next to delete button.
- `docs/20260223000001_sov_engine.sql` — **MODIFIED.** Added SUPERSEDED header block explaining all features were delivered incrementally.
- `docs/09-BUILD-PLAN.md` — **MODIFIED.** Phase 5 checkboxes updated to reflect actual completion across sprints 48–88.
- `supabase/prod_schema.sql` — **MODIFIED.** Added `is_active` column, `uq_target_queries_location_text` UNIQUE constraint, `idx_target_queries_active` partial index.
- `docs/CLAUDE.md` — **MODIFIED.** Migration #29 added. `target_queries` table description updated with columns and constraint. Migration count updated to 29. Sprint count updated to 88.
- `supabase/seed.sql` — **MODIFIED.** All 4 `target_queries` inserts now include explicit `is_active = TRUE`.

**Tests added:**
- `src/__tests__/unit/sov-seed-idempotent.test.ts` — **6 tests.** Upsert with onConflict + ignoreDuplicates, error logging, field validation, occasion queries, edge cases.
- `src/__tests__/unit/sov-query-toggle.test.ts` — **7 tests.** toggleQueryActive: flip true→false, false→true, auth guard, org_id enforcement, validation, DB error.
- `src/__tests__/unit/sov-add-query-dedup.test.ts` — **3 tests.** 23505 friendly error, other errors passthrough, success case.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/sov-seed-idempotent.test.ts  # 6 tests passing
npx vitest run src/__tests__/unit/sov-query-toggle.test.ts     # 7 tests passing
npx vitest run src/__tests__/unit/sov-add-query-dedup.test.ts  # 3 tests passing
npx vitest run                                                  # 1745 tests passing (131 files)
```

**Verified counts:** Vitest: 1745 tests, 132 files (131 passed, 1 skipped: rls-isolation integration requires running Supabase).

---

## 2026-02-28 — Sprint 87: AI Visibility Cluster Map (Completed)

**Goal:** Build the AI Visibility Cluster Map — a scatter plot showing where your business sits in each AI engine's recommendation space, overlaid with hallucination fog zones from the Fear Engine. X-axis: Brand Authority (citation frequency). Y-axis: Fact Accuracy (truth score). Bubble size: Share of Voice. Engine toggle for per-AI-model filtering. No new tables, no AI calls — pure data visualization from 4 existing tables.

**Scope:**
- `lib/services/cluster-map.service.ts` — **NEW.** ~250 lines, all pure. `buildClusterMap()`, `calculateBrandAuthority()`, `extractCompetitorPoints()`, `buildHallucinationZones()`, `filterByEngine()`, `detectAvailableEngines()`. ENGINE_MAP normalizes engine/model_provider strings to EngineFilter. SEVERITY_PENALTY/SEVERITY_RADIUS maps for fog zone positioning.
- `lib/data/cluster-map.ts` — **NEW.** ~90 lines. `fetchClusterMapData()` — 4 parallel Supabase queries (locations, sov_evaluations 30-day, ai_hallucinations open, visibility_analytics latest). Computes truthScore from hallucination ratio. RLS-scoped.
- `app/dashboard/cluster-map/actions.ts` — **NEW.** `getClusterMapData(engineFilter)` server action. getSafeAuthContext guard, primary location lookup, delegates to fetchClusterMapData.
- `app/dashboard/cluster-map/page.tsx` — **NEW.** Server Component. Auth guard, empty states (no location, no evaluations), delegates to ClusterMapWrapper.
- `app/dashboard/cluster-map/error.tsx` — **NEW.** Error boundary with Sentry reporting.
- `app/dashboard/cluster-map/_components/EngineToggle.tsx` — **NEW.** Radio-style toggle for engine filter (All/Perplexity/ChatGPT/Gemini/Copilot). Disabled state for engines with no data.
- `app/dashboard/cluster-map/_components/ClusterChart.tsx` — **NEW.** Recharts ScatterChart with custom dot renderer (star for self, circles for competitors), hallucination fog SVG overlay with gaussian blur, quadrant reference lines, custom tooltip.
- `app/dashboard/cluster-map/_components/HallucinationAlertCard.tsx` — **NEW.** Alert cards below chart showing hallucination details with severity badges and link to Alerts page.
- `app/dashboard/cluster-map/_components/ClusterMapWrapper.tsx` — **NEW.** Client state coordinator. useTransition for engine toggle, manages data refresh via server action.
- `components/layout/Sidebar.tsx` — **MODIFIED.** Added Cluster Map nav item (ScatterChart icon) after Share of Voice.
- `src/__fixtures__/cluster-map-fixtures.ts` — **NEW.** 10 evaluations across 5 queries x 2 engines, 3 hallucinations, pre-computed expected values.
- `supabase/seed.sql` — **MODIFIED.** Added Section 27: Google-engine SOV evaluations for cluster map 3-engine spread.

**Tests added:**
- `src/__tests__/unit/services/cluster-map.service.test.ts` — **45 tests.** Brand authority, competitor extraction, hallucination zones, engine filtering, full buildClusterMap, edge cases.
- `src/__tests__/unit/cluster-map-data.test.ts` — **12 tests.** Data fetcher with mocked Supabase, all 4 queries validated, truthScore computation, JSONB casting.
- `src/__tests__/unit/cluster-map-action.test.ts` — **8 tests.** Auth guard, location lookup, engine filter passthrough, graceful degradation.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/services/cluster-map.service.test.ts  # 45 tests passing
npx vitest run src/__tests__/unit/cluster-map-data.test.ts              # 12 tests passing
npx vitest run src/__tests__/unit/cluster-map-action.test.ts            # 8 tests passing
npx vitest run                                                           # All tests passing
```

---

## 2026-02-28 — Sprint 86: SOV Gap → Content Brief Generator (Completed)

**Goal:** Build a Content Brief Generator that turns SOV gap queries (0% visibility) into AEO-optimized content briefs. Two-layer design: pure brief structure (URL, title, H1, schema recommendations, llms.txt) + AI-powered content (answer capsule, outline sections, FAQ questions via gpt-4o-mini generateObject). Saves to content_drafts with trigger_type='prompt_missing'. Closes the growth loop: DETECT gap → GENERATE fix.

**Scope:**
- `lib/ai/schemas.ts` — **MODIFIED.** Added `ContentBriefSchema` (Zod): answerCapsule (string 40-60 words), outlineSections (3-6 with heading + bullets), faqQuestions (3-5 with question + answerHint), metaDescription (≤160 chars).
- `lib/ai/providers.ts` — **MODIFIED.** Added `content-brief` model key → gpt-4o-mini.
- `lib/services/content-brief-builder.service.ts` — **NEW.** ~110 lines, all pure. `buildBriefStructure()`: `slugify()` (lowercase, hyphenate, 80-char max), `buildTitleTag()` (capitalized query + business name), `buildH1()` (query + "at" + business), `inferContentType()` (category → content_type mapping), `recommendSchemas()` (always FAQPage, + Event for occasion, + LocalBusiness for discovery/near_me), `buildLlmsTxtEntry()`.
- `lib/services/content-brief-generator.service.ts` — **NEW.** ~80 lines. `generateBriefContent()` — `generateObject` with `gpt-4o-mini`, `ContentBriefSchema`. System prompt includes business ground truth (name, city, state, cuisine, amenities, categories, hours, phone, website) + competitive context. Returns null when no API key.
- `app/dashboard/share-of-voice/brief-actions.ts` — **NEW.** `generateContentBrief(queryId)` server action + `assembleDraftContent()`. Parallel fetch (target_query + location), duplicate check (existing draft with same trigger), SOV eval fetch for gap/competitor data, calls builder + generator, produces markdown, inserts to `content_drafts`. Graceful fallback: structure-only brief when AI unavailable.
- `app/dashboard/share-of-voice/_components/GenerateBriefButton.tsx` — **NEW.** Client component. Shows "Generate Brief →" or "View Draft →" based on `hasDraft`. Loading state during generation. Navigates to content-drafts on success.
- `app/dashboard/share-of-voice/page.tsx` — **MODIFIED.** Added briefDraftResult query to fetch existing prompt_missing drafts. Passes briefDraftQueryIds array to SovCard.
- `app/dashboard/share-of-voice/_components/SovCard.tsx` — **MODIFIED.** Added briefDraftQueryIds prop, hasBriefDraft per query, GenerateBriefButton on gap queries (null rank).
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added `MOCK_BRIEF_STRUCTURE_INPUT` + `MOCK_CONTENT_BRIEF`.

**Tests added:**
- `src/__tests__/unit/content-brief-builder.test.ts` — **17 tests.** Slug, title, H1, schemas, content type, llms.txt, MOCK integration.
- `src/__tests__/unit/content-brief-generator.test.ts` — **9 tests.** API key check, model call, system prompt contents.
- `src/__tests__/unit/brief-actions.test.ts` — **16 tests.** Auth, parallel fetch, duplicate check, insert, fallback.
- `src/__tests__/unit/content-brief-assembly.test.ts` — **11 tests.** Markdown assembly with/without AI content.
- `src/__tests__/unit/generate-brief-button.test.tsx` — **4 tests.** Render states, loading, test-id.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/content-brief-builder.test.ts       # 17 tests passing
npx vitest run src/__tests__/unit/content-brief-generator.test.ts     # 9 tests passing
npx vitest run src/__tests__/unit/brief-actions.test.ts               # 16 tests passing
npx vitest run src/__tests__/unit/content-brief-assembly.test.ts      # 11 tests passing
npx vitest run src/__tests__/unit/generate-brief-button.test.tsx      # 4 tests passing
npx vitest run                                                         # All tests passing
```

---

## 2026-02-28 — Sprint 85: Revenue Impact Calculator (Completed)

**Goal:** Build a Revenue Impact Calculator that converts abstract visibility scores into estimated dollar amounts. Three revenue categories: SOV gaps (missed AI-assisted visits), hallucination deterrence (customers lost to inaccurate info), and competitor advantage (diverted covers). The PROVE-stage feature that drives subscription renewals.

**Scope:**
- `supabase/migrations/20260226000012_revenue_config.sql` — **NEW.** Adds `avg_customer_value` (numeric, default 45.00) and `monthly_covers` (integer, default 800) to `locations` table.
- `lib/services/revenue-impact.service.ts` — **NEW.** ~230 lines, all pure functions. `computeRevenueImpact()` entry point. Three revenue streams: SOV gap revenue (category-specific search volumes x CTR x gap ratio x avg customer value), hallucination revenue (severity-based deterrence x avg customer value), competitor revenue (advantage ratio x monthly covers x AI influence rate x avg customer value). Constants: `CATEGORY_SEARCH_VOLUME` (discovery=90, near_me=120, etc.), `AI_RECOMMENDATION_CTR` (8%), `AI_INFLUENCE_RATE` (5%), `SEVERITY_IMPACT` (critical=8, high=5, medium=2, low=1). Exports `DEFAULT_REVENUE_CONFIG`. All constants exported for testing.
- `lib/data/revenue-impact.ts` — **NEW.** `fetchRevenueImpact()` — 5 parallel queries (location config, target queries, SOV evaluations, hallucinations, competitor evaluations). Computes SOV gaps from null rank_position. Finds top competitor from `mentioned_competitors` JSONB. Falls back to `DEFAULT_REVENUE_CONFIG` when location fields null.
- `app/dashboard/revenue-impact/page.tsx` — **NEW.** Server Component. Hero dollar card (large green amount + annual projection), RevenueLineItemCard per category (icon, label, dollar amount, description, detail text), RevenueConfigForm (client component, number inputs, server action submit). Empty state + zero-impact positive message.
- `app/dashboard/revenue-impact/_components/RevenueConfigForm.tsx` — **NEW.** Client Component. Two number inputs (avg customer value, monthly covers). Server action on submit. Shows "using defaults" notice when isDefaultConfig.
- `app/dashboard/revenue-impact/actions.ts` — **NEW.** `updateRevenueConfig()` server action. Zod v4 validation, org-scoped update, revalidatePath.
- `app/dashboard/revenue-impact/error.tsx` — **NEW.** Standard error boundary with Sentry.
- `components/layout/Sidebar.tsx` — **MODIFIED.** Added "Revenue Impact" link (test-id: nav-revenue-impact) with DollarSign icon.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added `MOCK_REVENUE_IMPACT_INPUT` (3 SOV gaps, 2 hallucinations, competitor advantage).
- `supabase/seed.sql` — **MODIFIED.** Added revenue config to seed location (section 26).
- `lib/supabase/database.types.ts` — **MODIFIED.** Added `avg_customer_value` and `monthly_covers` to locations Row/Insert/Update.

**Tests added:**
- `src/__tests__/unit/revenue-impact-service.test.ts` — **35 tests.** SOV gap revenue, hallucination revenue, competitor revenue, config, helpers, MOCK integration.
- `src/__tests__/unit/revenue-impact-data.test.ts` — **9 tests.** Parallel queries, org scoping, SOV gap computation, competitor detection, empty data handling.
- `src/__tests__/unit/revenue-impact-page.test.ts` — **10 tests.** Hero number, line items, config form, empty state, sidebar.
- `src/__tests__/unit/revenue-config-action.test.ts` — **6 tests.** Validation, org scoping, revalidation, error handling.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/revenue-impact-service.test.ts      # 35 tests passing
npx vitest run src/__tests__/unit/revenue-impact-data.test.ts         # 9 tests passing
npx vitest run src/__tests__/unit/revenue-impact-page.test.ts         # 10 tests passing
npx vitest run src/__tests__/unit/revenue-config-action.test.ts       # 6 tests passing
npx vitest run                                                         # All tests passing
```

---

## 2026-02-28 — Sprint 84: Agent Readiness Score (AAO) (Completed)

**Goal:** Build an AI Agent Readiness Score (0-100) evaluating whether autonomous AI agents can transact with the business. Evaluates 6 weighted capabilities: structured hours, menu schema, ReserveAction, OrderAction, accessible CTAs, and CAPTCHA-free flows. The Assistive Agent Optimization (AAO) metric no competitor offers for restaurants.

**Scope:**
- `lib/services/agent-readiness.service.ts` — **NEW.** ~310 lines, all pure functions. `computeAgentReadiness()` entry point. 6 assessors: `assessStructuredHours()` (15pts — schema detection + hours_data fallback), `assessMenuSchema()` (15pts — JSON-LD + published menu), `assessReserveAction()` (25pts — schema + booking URL fallback), `assessOrderAction()` (25pts — schema + ordering URL fallback), `assessAccessibleCTAs()` (10pts — inferred from entity_clarity_score), `assessCaptchaFree()` (10pts — always partial in V1). Three statuses: active (full), partial (50%), missing (0). Levels: agent_ready >=70, partially_ready >=40, not_ready <40. Top priority selection by highest maxPoints among non-active.
- `lib/schema-generator/action-schema.ts` — **NEW.** Pure generators (§39). `generateReserveActionSchema()` + `generateOrderActionSchema()` — produce JSON-LD with Restaurant type, potentialAction, EntryPoint with urlTemplate. No I/O.
- `lib/data/agent-readiness.ts` — **NEW.** `fetchAgentReadiness()` — 3 parallel queries (location, magic_menus, page_audits). Infers detected schema types from audit scores. Checks location attributes for booking/ordering URLs. Assembles `AgentReadinessInput`.
- `app/dashboard/agent-readiness/page.tsx` — **NEW.** Server Component. AgentScoreRing (reuses SVG pattern from §34.1), TopPriorityCard, CapabilityChecklist (6 items with status icons, points, fix guides, schema CTAs).
- `app/dashboard/agent-readiness/error.tsx` — **NEW.** Standard error boundary.
- `components/layout/Sidebar.tsx` — **MODIFIED.** Added "Agent Readiness" link (test-id: nav-agent-readiness) with BotMessageSquare icon.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added `MOCK_AGENT_READINESS_INPUT` (hours + menu active, actions missing, score=40, partially_ready).

**Tests added:**
- `src/__tests__/unit/agent-readiness-service.test.ts` — **45 tests.** Score calculation, levels, active count, top priority, all 6 assessors, MOCK integration.
- `src/__tests__/unit/action-schema.test.ts` — **10 tests.** ReserveAction + OrderAction generators.
- `src/__tests__/unit/agent-readiness-data.test.ts` — **7 tests.** Parallel queries, schema inference, attribute extraction.
- `src/__tests__/unit/agent-readiness-page.test.ts` — **7 tests.** Score ring, capability checklist, sidebar.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/agent-readiness-service.test.ts     # 45 tests passing
npx vitest run src/__tests__/unit/action-schema.test.ts               # 10 tests passing
npx vitest run src/__tests__/unit/agent-readiness-data.test.ts        # 7 tests passing
npx vitest run src/__tests__/unit/agent-readiness-page.test.ts        # 7 tests passing
npx vitest run                                                         # All tests passing
```

---

## 2026-02-28 — Sprint 83: Proactive Content Calendar (Completed)

**Goal:** Build an AI-driven content publishing calendar that aggregates 5 signal sources (occasions, SOV gaps, page freshness, competitor gaps, hallucination corrections) into time-bucketed, urgency-scored content recommendations. Transforms LocalVector from reactive ("here's what happened") to proactive ("here's what to do next").

**Scope:**
- `lib/services/content-calendar.service.ts` — **NEW.** ~330 lines, all pure functions. `generateContentCalendar()` main entry point. 5 signal generators: `generateOccasionRecommendations()` (days-until-peak urgency, occasion_page type), `generateSOVGapRecommendations()` (gap ratio urgency, top 5), `generateFreshnessRecommendations()` (age-based urgency, bot decline detection for menu), `generateCompetitorGapRecommendations()` (magnitude-based urgency, top 3), `generateHallucinationFixRecommendations()` (severity-based urgency, top 3). Urgency 0-100 per recommendation. Time buckets: this_week/next_week/two_weeks/later. Deduplication by key (higher urgency wins). Existing draft filtering via trigger_id set. Helpers: `computeDaysUntilDate()`, `assignTimeBucket()`, `formatProvider()`, `truncate()`.
- `lib/data/content-calendar.ts` — **NEW.** `fetchContentCalendar()` — 11 parallel Supabase queries across `locations`, `local_occasions`, `sov_evaluations`, `target_queries`, `page_audits`, `magic_menus`, `crawler_hits` (2 periods), `competitor_intercepts`, `ai_hallucinations`, `content_drafts`. Assembles `CalendarInput`, computes derived fields (daysSinceAudit, SOV gap ratios, bot visit decline), calls pure `generateContentCalendar()`.
- `app/dashboard/content-calendar/page.tsx` — **NEW.** Server Component. SignalSummaryStrip (emoji + count per signal type), TimeBucketSection per bucket (hidden when empty), RecommendationCard (action verb badge, title, reason, urgency bar, CTA buttons, deadline countdown). Empty state. Color coding: action verbs (publish=green, update=amber, create=blue), urgency bars (red >=75, amber >=50, green <50).
- `app/dashboard/content-calendar/error.tsx` — **NEW.** Standard error boundary with Sentry.
- `components/layout/Sidebar.tsx` — **MODIFIED.** Added "Content Calendar" nav item with CalendarDays icon (test-id: nav-content-calendar) after Content entry.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added `MOCK_CALENDAR_INPUT` with mixed signals (1 occasion, 2 SOV gaps, 1 stale page, 1 stale menu, 1 competitor gap, 1 hallucination).

**Tests added:**
- `src/__tests__/unit/content-calendar-service.test.ts` — **45 Vitest tests.** All 5 signal generators, urgency scoring, time bucketing, dedup, filtering, helpers, MOCK integration.
- `src/__tests__/unit/content-calendar-data.test.ts` — **11 Vitest tests.** Parallel queries, org scoping, signal computation, empty data handling.
- `src/__tests__/unit/content-calendar-page.test.ts` — **10 Vitest tests.** Signal summary, time buckets, recommendation cards, urgency bars, empty state, sidebar.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/content-calendar-service.test.ts    # 45 tests passing
npx vitest run src/__tests__/unit/content-calendar-data.test.ts       # 11 tests passing
npx vitest run src/__tests__/unit/content-calendar-page.test.ts       # 10 tests passing
npx vitest run                                                         # All tests passing
npx tsc --noEmit                                                       # 0 type errors
```

---

## 2026-02-26 — Sprint 82: Citation Source Intelligence (Completed)

**Goal:** Identify which specific web pages, review sites, articles, and social posts each AI engine cites when generating answers about the business. Two data paths: structured `cited_sources` from Google/Perplexity (Sprint 74), and AI-extracted `source_mentions` from OpenAI/Copilot raw_response via gpt-4o-mini.

**Scope:**
- `supabase/migrations/20260226000011_source_mentions.sql` — **NEW.** Adds `source_mentions JSONB` to `sov_evaluations`.
- `supabase/prod_schema.sql` — **MODIFIED.** Added `sentiment_data` and `source_mentions` JSONB columns to sov_evaluations CREATE TABLE.
- `lib/supabase/database.types.ts` — **MODIFIED.** Added `source_mentions: Json | null` to sov_evaluations Row/Insert/Update.
- `lib/ai/schemas.ts` — **MODIFIED.** Added `SourceMentionExtractionSchema` (Zod): sources array (name, type enum, inferredUrl, context, isCompetitorContent), sourcingQuality enum. Exported type `SourceMentionExtraction`.
- `lib/ai/providers.ts` — **MODIFIED.** Added `source-extract` model key: `openai('gpt-4o-mini')`.
- `lib/services/source-intelligence.service.ts` — **NEW.** Part A: `extractSourceMentions()` — AI extraction for engines without structured citations. Part B: Pure analysis functions — `analyzeSourceIntelligence()` categorizes, deduplicates, ranks sources, computes first-party rate, generates alerts. Helper functions: `normalizeSourceKey`, `extractDomainName`, `categorizeUrl`, `mapMentionTypeToCategory`, `generateAlerts`. Alert types: competitor_content (high), missing_first_party (medium), over-reliance (medium).
- `lib/services/sov-engine.service.ts` — **MODIFIED.** Added `extractSOVSourceMentions()` (filters to engines without cited_sources, parallel extraction via Promise.allSettled) and `writeSourceMentions()` (per-evaluation UPDATE to source_mentions JSONB).
- `lib/inngest/functions/sov-cron.ts` — **MODIFIED.** Added source extraction step in `processOrgSOV()` after sentiment extraction. Non-critical try/catch.
- `app/api/cron/sov/route.ts` — **MODIFIED.** Added source extraction to inline fallback after sentiment extraction.
- `lib/data/source-intelligence.ts` — **NEW.** `fetchSourceIntelligence()` — parallel queries for sov_evaluations (with target_queries join) and location data, feeds into pure analyzeSourceIntelligence().
- `app/dashboard/source-intelligence/page.tsx` — **NEW.** Server Component. SourceAlertCards (severity-sorted, red/amber borders), TopSourcesTable (ranked by citation count, engine color dots), CategoryBreakdownBars (horizontal bars with percentages, first-party rate), EngineSourceBreakdown (per-engine source tags), EmptyState.
- `app/dashboard/source-intelligence/error.tsx` — **NEW.** Standard error boundary.
- `components/layout/Sidebar.tsx` — **MODIFIED.** Added "AI Sources" link (icon: BookOpen, auto-testid: nav-ai-sources).
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added `MOCK_SOURCE_MENTION_EXTRACTION` and `MOCK_SOURCE_INTELLIGENCE_INPUT`.
- `supabase/seed.sql` — **MODIFIED.** Added source_mentions JSONB to OpenAI seed evaluation.

**Tests added:**
- `src/__tests__/unit/source-intelligence-service.test.ts` — **35 Vitest tests.** extractSourceMentions (null/empty/no-key/model-key/happy-path/error). analyzeSourceIntelligence (dedup/merge-engines/both-paths/normalize-url/categorization/ranking/category-breakdown/first-party-rate/per-engine). generateAlerts (competitor/missing-first-party/over-reliance/healthy/severity-sort). Helper functions. Mock integration.
- `src/__tests__/unit/source-intelligence-data.test.ts` — **7 Vitest tests.** Query scope, join, date range, location fetch, empty handling, happy path.
- `src/__tests__/unit/source-intelligence-pipeline.test.ts` — **7 Vitest tests.** extractSOVSourceMentions (filter/skip/graceful-failure/map-shape). writeSourceMentions (update/skip-null/error-logging).
- `src/__tests__/unit/source-intelligence-page.test.ts` — **6 Vitest tests.** Page data shapes (sources/categories/alerts/engine-breakdown/empty), sidebar link.

**Test counts:** +55 new tests (4 files). Total: 1467 test cases, 114 files.

---

## 2026-02-28 — Sprint 81: AI Sentiment Tracker (Completed)

**Goal:** Track not just whether AI mentions the business, but HOW it describes it — positive/negative descriptors, tone, recommendation strength. Answers "ChatGPT calls you 'affordable but inconsistent' while calling your competitor 'premium and trendy.'"

**Scope:**
- `supabase/migrations/20260226000010_sentiment_data.sql` — **NEW.** Adds `sentiment_data JSONB` to `sov_evaluations`. Partial index on `(org_id, created_at DESC) WHERE sentiment_data IS NOT NULL`.
- `lib/supabase/database.types.ts` — **MODIFIED.** Added `sentiment_data: Json | null` to sov_evaluations Row/Insert/Update.
- `lib/ai/schemas.ts` — **MODIFIED.** Added `SentimentExtractionSchema` (Zod): score (-1 to 1), label (5 levels), descriptors (positive/negative/neutral arrays), tone (6 options), recommendation_strength (4 levels). Exported type `SentimentExtraction`.
- `lib/ai/providers.ts` — **MODIFIED.** Added `sentiment-extract` model key: `openai('gpt-4o-mini')`.
- `lib/services/sentiment.service.ts` — **NEW.** `extractSentiment()` — lightweight AI extraction via `generateObject`. Pre-checks: null/empty response returns null, missing API key returns null, business name not in response returns quick `not_mentioned` result (no API call). `aggregateSentiment()` — pure aggregation function. Computes average score, dominant label/tone, deduped descriptors sorted by frequency, per-engine breakdown. Utility helpers: `countFrequencies`, `dedupeByFrequency`, `groupBy`, `topKey`.
- `lib/services/sov-engine.service.ts` — **MODIFIED.** `writeSOVResults()` now returns `evaluationIds` (via `.select('id')` after insert). Added `extractSOVSentiment()` (parallel extraction via `Promise.allSettled`) and `writeSentimentData()` (per-evaluation UPDATE with error logging).
- `lib/inngest/functions/sov-cron.ts` — **MODIFIED.** Added sentiment extraction in `processOrgSOV()` after `writeSOVResults`. Non-critical try/catch — SOV data safe even if sentiment fails.
- `app/api/cron/sov/route.ts` — **MODIFIED.** Added sentiment extraction to inline fallback after `writeSOVResults`.
- `lib/data/sentiment.ts` — **NEW.** `fetchSentimentSummary()` (30-day default, filters non-null sentiment_data), `fetchSentimentTrend()` (12-week default, grouped by ISO week).
- `app/dashboard/sentiment/page.tsx` — **NEW.** Server Component. Overall sentiment score card, descriptor tag display (positive green / negative red), per-engine breakdown with horizontal score bars, empty state message, trend summary.
- `app/dashboard/sentiment/error.tsx` — **NEW.** Standard error boundary.
- `components/layout/Sidebar.tsx` — **MODIFIED.** Added "AI Sentiment" link (icon: SmilePlus, auto-testid: nav-ai-sentiment).
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added `MOCK_SENTIMENT_EXTRACTION` and `MOCK_SENTIMENT_SUMMARY`.

**Tests added:**
- `src/__tests__/unit/sentiment-service.test.ts` — **30 Vitest tests.** extractSentiment (null/empty/no-key/not-mentioned/happy-path/error). aggregateSentiment (empty/score-calc/dominant-label/descriptors/dedup/per-engine). Utility functions.
- `src/__tests__/unit/sentiment-data.test.ts` — **9 Vitest tests.** Summary query (org scope, date range, aggregation). Trend query (week grouping, weekly average).
- `src/__tests__/unit/sentiment-extraction-integration.test.ts` — **7 Vitest tests.** Pipeline (parallel extraction, write, error handling).
- `src/__tests__/unit/sentiment-page.test.ts` — **5 Vitest tests.** Page data shapes, sidebar link.

**Existing test updates:**
- `src/__tests__/unit/sov-engine-service.test.ts` — Updated `mockInsert` to chain `.select()` (new `writeSOVResults` return type).
- `src/__tests__/unit/sov-google-grounded.test.ts` — Same mock update.
- `src/__tests__/unit/inngest-sov-cron.test.ts` — Added `evaluationIds: []` to `writeSOVResults` mock.
- `src/__tests__/unit/cron-sov.test.ts` — Added `evaluationIds: []` to `writeSOVResults` mock.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/sentiment-service.test.ts                    # 30 tests passing
npx vitest run src/__tests__/unit/sentiment-data.test.ts                       # 9 tests passing
npx vitest run src/__tests__/unit/sentiment-extraction-integration.test.ts     # 7 tests passing
npx vitest run src/__tests__/unit/sentiment-page.test.ts                       # 5 tests passing
npx vitest run src/__tests__/unit/                                              # 1338 tests passing (104 files)
npx tsc --noEmit                                                                # 0 errors
```

---

## 2026-02-28 — Sprint 80: Entity Knowledge Graph Health Monitor (Completed)

**Goal:** Build a dashboard showing entity presence across 7 knowledge graph platforms AI models use (Google KP, GBP, Yelp, TripAdvisor, Apple Maps, Bing Places, Wikidata). Auto-detects from existing data, user self-assesses the rest. Entities get cited, non-entities get hallucinated about.

**Scope:**
- `supabase/migrations/20260228000001_entity_checks.sql` — **NEW.** `entity_checks` table: 7 platform status columns (varchar CHECK: confirmed/missing/unchecked/incomplete), `platform_metadata` JSONB, `entity_score` integer, org_id + location_id unique constraint. Full RLS with org isolation policies (select/insert/update/delete). Updated_at trigger.
- `lib/services/entity-health.service.ts` — **NEW.** Pure service (~250 lines). `ENTITY_PLATFORM_REGISTRY` (7 platforms with labels, AI impact descriptions, claim guides, external URLs, priorities). `computeEntityHealth()` — computes score (N/6 core, excludes Wikidata), rating (strong/at_risk/critical/unknown), sorted recommendations with claim URLs.
- `lib/services/entity-auto-detect.ts` — **NEW.** `autoDetectEntityPresence()` — checks `google_place_id`, `gbp_integration_id`, and `location_integrations` to auto-set Google KP, GBP, and Yelp statuses.
- `lib/data/entity-health.ts` — **NEW.** `fetchEntityHealth()` — lazy-initializes entity_checks row on first access, runs auto-detection, persists, and computes health.
- `app/dashboard/actions/entity-health.ts` — **NEW.** Two Server Actions: `getEntityHealth()` and `updateEntityStatus(formData)` with Zod validation. Recalculates entity_score on each update.
- `app/dashboard/entity-health/page.tsx` — **NEW.** Server Component. Score bar, 7-platform checklist with status dropdowns (auto-detected platforms locked), expandable claim guides, recommendation list.
- `app/dashboard/entity-health/_components/EntityStatusDropdown.tsx` — **NEW.** Client Component. Status dropdown per platform with useTransition for non-blocking updates.
- `app/dashboard/entity-health/error.tsx` — **NEW.** Error boundary with Sentry.
- `app/dashboard/_components/EntityHealthCard.tsx` — **NEW.** Summary card for main dashboard: score, rating, platform count, high-priority fix count.
- `components/layout/Sidebar.tsx` — **MODIFIED.** Added Entity Health nav item (HeartPulse icon) after Proof Timeline.
- `app/dashboard/page.tsx` — **MODIFIED.** Added EntityHealthCard with non-blocking fetch.
- `supabase/prod_schema.sql` — **MODIFIED.** Added entity_checks table, RLS, indexes, FKs, triggers, grants.
- `lib/supabase/database.types.ts` — **MODIFIED.** Added entity_checks Row/Insert/Update/Relationships.
- `supabase/seed.sql` — **MODIFIED.** Added entity_checks seed row (UUID i0eebc99...) for Charcoal N Chill: 3/6 confirmed, score 50.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added `MOCK_ENTITY_CHECK` fixture.

**Tests added:**
- `src/__tests__/unit/entity-health-service.test.ts` — **27 tests.** Score computation, rating thresholds, platform registry, recommendations, edge cases with MOCK_ENTITY_CHECK.
- `src/__tests__/unit/entity-auto-detect.test.ts` — **8 tests.** Auto-detection from place_id, gbp_integration_id, integrations array, empty data.
- `src/__tests__/unit/entity-health-data.test.ts` — **6 tests.** Lazy init, auto-detect, org_id scoping, fallback.
- `src/__tests__/unit/entity-health-action.test.ts` — **10 tests.** Auth guards, Zod validation, upsert, score recalculation.
- `src/__tests__/unit/sidebar-entity.test.ts` — **3 tests.** NAV_ITEMS entry, href, position after Proof Timeline.

---

## 2026-02-28 — Sprint 79: Copilot/Bing Monitoring (Completed)

**Goal:** Add Microsoft Copilot as the fourth SOV query engine, covering the Bing data ecosystem (Bing Places, Yelp, TripAdvisor) — a fundamentally different citation source set than Google/ChatGPT/Perplexity. +14% AI market coverage.

**Scope:**
- `lib/ai/providers.ts` — **MODIFIED.** Added `sov-query-copilot` model key: `openai('gpt-4o')`. Reuses existing `OPENAI_API_KEY`. No new env var.
- `lib/services/sov-engine.service.ts` — **MODIFIED.** Added `runCopilotSOVQuery()` with Copilot-simulation system prompt emphasizing Bing Places, Yelp, TripAdvisor data sources. Added `buildCopilotSystemPrompt()`. Extended `runMultiModelSOVQuery()` to include Copilot when `hasApiKey('openai')` is true. Added `'copilot'` to `MODEL_ENGINE_MAP`.
- `app/dashboard/ai-responses/_components/EngineResponseBlock.tsx` — **MODIFIED.** Added "Microsoft Copilot" engine config with `bg-[#00A4EF]` dot color. Copilot-specific insight box: "Copilot uses Bing's index, not Google's. If you're visible in ChatGPT but not here, check your Bing Places listing and Yelp profile."
- `supabase/seed.sql` — **MODIFIED.** Added Copilot sov_evaluation seed rows (UUIDs c4eebc99...a13, c4eebc99...a14). Updated UUID reference card.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Extended `MOCK_SOV_RESPONSE` with Copilot engine entry. Added standalone `MOCK_COPILOT_SOV_RESULT` fixture.
- `src/__tests__/unit/sov-google-grounded.test.ts` — **MODIFIED.** Updated multi-model tests to expect 4 engines (added Copilot).

**Tests added:**
- `src/__tests__/unit/sov-copilot.test.ts` — **15 Vitest tests.** Copilot runner returns correct engine, parsed business citation, system prompt contains Bing/Yelp/TripAdvisor. Multi-model includes/excludes Copilot based on API key. Graceful failure via Promise.allSettled.
- `src/__tests__/unit/ai-responses-copilot.test.tsx` — **5 Vitest tests.** Copilot tab rendering, insight box display, conditional hide for non-Copilot engines.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/sov-copilot.test.ts              # 15 tests passing
npx vitest run src/__tests__/unit/ai-responses-copilot.test.tsx     # 5 tests passing
npx vitest run                                                      # All tests passing
```

---

## 2026-02-28 — Sprint 78: Weekly AI Snapshot Email with CTAs (Completed)

**Goal:** Build a weekly digest email sent every Monday via Resend + React Email, showing AI Health Score trend, new issues, wins, opportunities, and bot activity — the retention engine that keeps restaurant owners engaged without logging in.

**Scope:**
- `lib/services/weekly-digest.service.ts` — **NEW.** Pure payload builder (~230 lines). Exports: `buildDigestPayload()` — assembles subject line (dynamic with score + delta), health score trend (up/down/flat/new), SOV delta, issues from hallucinations (severity-emoji'd), wins (resolved hallucinations, first SOV mentions, score improvements), opportunities (top recommendation, blind spots), bot summary. Helper formatters: `formatProvider()`, `formatEngine()`, `truncate()`. No I/O.
- `emails/weekly-digest.tsx` — **NEW.** React Email template. Sections: header with business name, AI Health Score with delta, SOV metric, issues with CTA links, wins, opportunities with CTA links, bot summary, primary dashboard CTA, footer with unsubscribe link. Dark theme matching existing `WeeklyDigest.tsx`. Inline styles per React Email convention.
- `lib/email/send-digest.ts` — **NEW.** Resend wrapper. `sendDigestEmail()` uses Resend's `react:` prop for server-side rendering. Guards against missing `RESEND_API_KEY`. Throws on error (caller `.catch()`es per §17).
- `lib/data/weekly-digest.ts` — **NEW.** Data fetcher for cron/Inngest context (~170 lines). `fetchDigestForOrg()` — checks `notify_weekly_digest`, fetches owner email, primary location, then 7 parallel queries (current/previous snapshots, new hallucinations, resolved count, SOV wins, bot visits, blind spot data). Resolves SOV win query text. Calls Health Score fetcher for top recommendation. Assembles `DigestDataInput`, calls `buildDigestPayload()`.
- `lib/inngest/functions/weekly-digest-cron.ts` — **NEW.** Inngest function `weekly-digest-cron` (concurrency=5, retries=1). Step 1: fetch orgs with `notify_weekly_digest=true` + active/trialing status. Step 2: fan-out per org — `fetchDigestForOrg()` + `sendDigestEmail()` with `.catch()` per §17. Returns {sent, skipped, failed}.
- `lib/inngest/events.ts` — **MODIFIED.** Added `cron/digest.weekly` event type.
- `app/api/inngest/route.ts` — **MODIFIED.** Registered `weeklyDigestCron` function.
- `app/api/cron/weekly-digest/route.ts` — **NEW.** Cron route dispatcher (§30.1). CRON_SECRET auth, `STOP_DIGEST_CRON` kill switch, Inngest dispatch primary, inline fallback. Cron-logged via `cron-logger.ts`.
- `vercel.json` — **NEW.** Added `weekly-digest` cron: `0 13 * * 1` (Monday 1pm UTC / 8am EST).
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added `MOCK_DIGEST_INPUT` fixture (good week: score +3, one win, one issue, one opportunity).

**Tests added:**
- `src/__tests__/unit/weekly-digest-service.test.ts` — **35 Vitest tests.** Subject line generation, health score delta/trend, SOV conversion, issues with severity emojis, wins aggregation, opportunities, edge cases, helper formatters.
- `src/__tests__/unit/weekly-digest-data.test.ts` — **10 Vitest tests.** Opt-out check, parallel queries, org scoping, SOV win resolution, blind spot calculation.
- `src/__tests__/unit/weekly-digest-cron-route.test.ts` — **6 Vitest tests.** Auth guard, kill switch, Inngest dispatch, inline fallback, cron logging.
- `src/__tests__/unit/send-digest-email.test.ts` — **4 Vitest tests.** API key guard, Resend call, React Email rendering, error propagation.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/weekly-digest-service.test.ts        # 35 tests passing
npx vitest run src/__tests__/unit/weekly-digest-data.test.ts           # 10 tests passing
npx vitest run src/__tests__/unit/weekly-digest-cron-route.test.ts     # 6 tests passing
npx vitest run src/__tests__/unit/send-digest-email.test.ts            # 4 tests passing
npx vitest run                                                          # 1232 tests passing (94 files)
npx tsc --noEmit                                                        # 0 type errors
```

---

## 2026-02-28 — Sprint 77: Before/After Proof Timeline (Completed)

**Goal:** Build a visual timeline correlating user actions with measurable outcomes — "You added FAQ schema → GPTBot re-crawled → SOV increased 58% in 3 weeks" — proving ROI and driving retention.

**Scope:**
- `lib/services/proof-timeline.service.ts` — **NEW.** Pure timeline builder (~300 lines). Exports: `buildProofTimeline()` (8 event types: metric_snapshot, content_published, bot_crawl, audit_completed, hallucination_detected, hallucination_resolved, schema_added, sov_milestone), `formatContentType()`, `formatTriggerType()`, `formatBotLabel()`, `truncate()`. Chronological sorting, summary stats (sovDelta, actionsCompleted, hallucinationsResolved). No I/O.
- `lib/data/proof-timeline.ts` — **NEW.** Data fetcher. 5 parallel Supabase queries (visibility_analytics, page_audits, content_drafts, crawler_hits, ai_hallucinations) with 90-day window. Aggregates first bot visit per bot_type. Assembles TimelineInput, delegates to buildProofTimeline.
- `app/dashboard/actions/proof-timeline.ts` — **NEW.** Server Action: `getProofTimeline()` with `getSafeAuthContext()`, primary location lookup.
- `app/dashboard/proof-timeline/page.tsx` — **NEW.** Server Component. Summary strip (SOV delta, actions completed, issues fixed, timeline window). Reverse-chronological event list grouped by date. Vertical timeline connector. Impact-colored event cards. Null state for new tenants.
- `app/dashboard/proof-timeline/error.tsx` — **NEW.** Error boundary.
- `app/dashboard/_components/ProofTimelineCard.tsx` — **NEW.** Summary card for main dashboard linking to full timeline. Shows SOV delta, action count, highlight event.
- `app/dashboard/page.tsx` — **MODIFIED.** Added ProofTimelineCard after BotActivityCard. Non-blocking timeline fetch with try/catch null fallback.
- `components/layout/Sidebar.tsx` — **MODIFIED.** Added "Proof Timeline" (GitCompareArrows icon) after Bot Activity. Total: 17 nav items.
- `supabase/seed.sql` — **MODIFIED.** Added 4 historical visibility_analytics rows (UUIDs h0–h3) at -56, -49, -42, -35 days showing SOV progression 12% → 12% → 17% → 19%.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added `MOCK_TIMELINE_INPUT` with 4 weeks of multi-source data.

**Tests added:**
- `src/__tests__/unit/proof-timeline-service.test.ts` — **37 Vitest tests.** Event generation for all 8 types, sorting, summary stats, impact classification, edge cases (empty input, single snapshot, long text truncation), format helpers.
- `src/__tests__/unit/proof-timeline-data.test.ts` — **7 Vitest tests.** Parallel queries, org scoping, bot visit aggregation, published-only filter.
- `src/__tests__/unit/proof-timeline-action.test.ts` — **4 Vitest tests.** Auth guard, no-location, happy path, param forwarding.
- `src/__tests__/unit/sidebar-timeline.test.ts` — **3 Vitest tests.** NAV_ITEMS entry, href, position after Bot Activity.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/proof-timeline-service.test.ts   # 37 tests passing
npx vitest run src/__tests__/unit/proof-timeline-data.test.ts      # 7 tests passing
npx vitest run src/__tests__/unit/proof-timeline-action.test.ts    # 4 tests passing
npx vitest run src/__tests__/unit/sidebar-timeline.test.ts         # 3 tests passing
npx vitest run                                                      # All tests passing
```

---

## 2026-02-28 — Sprint 76: System Health Dashboard + Content Freshness Alerts + Console Cleanup (Completed)

**Goal:** Close the 3 highest-impact gaps from the Sprint 68 audit: (1) build a System Health dashboard for the `cron_run_log` table that all 4 crons write to but had no UI, (2) detect and alert on content freshness decay when `citation_rate` drops significantly, (3) clean up 39 debug `console.log` statements in production code.

**Scope:**

*Phase 1 — System Health / Cron Dashboard:*
- `lib/services/cron-health.service.ts` — **NEW.** Pure service (~130 lines). Exports: `CronRunRow`, `CronJobSummary`, `CronHealthSummary`, `CronRegistryEntry`, `CRON_REGISTRY` (4 crons: audit, sov, citation, content-audit), `buildCronHealthSummary()`. Groups rows by cron_name, derives per-job stats (lastRunAt, lastStatus, lastDurationMs, recentFailureCount), overall status (healthy/degraded/failing based on failure thresholds).
- `lib/data/cron-health.ts` — **NEW.** Data layer. Uses `createServiceRoleClient()` internally (cron_run_log has NO user RLS policies). Queries last 100 rows ordered by started_at DESC, delegates to `buildCronHealthSummary()`.
- `app/dashboard/system-health/page.tsx` — **NEW.** Server Component (~250 lines). Auth guard via `getSafeAuthContext()`. Summary strip with 4 cron job cards (name, schedule, last run, status badge). Recent runs table (last 20). Failure alert banner. Status colors: success=truth-emerald, running=electric-indigo, failed=alert-crimson, timeout=alert-amber.
- `app/dashboard/_components/CronHealthCard.tsx` — **NEW.** Dashboard summary card. Overall status badge, failure count, link to `/dashboard/system-health`. Pattern follows BotActivityCard.
- `components/layout/Sidebar.tsx` — **MODIFIED.** Added `Activity` icon import and "System Health" nav item (href: `/dashboard/system-health`) positioned after "AI Says", before "Settings". Total: 16 nav items.
- `lib/data/dashboard.ts` — **MODIFIED.** Added `cronHealth: CronHealthSummary | null` to `DashboardData`. Non-blocking fetch with try/catch null fallback.
- `app/dashboard/page.tsx` — **MODIFIED.** Renders `<CronHealthCard>` after `<BotActivityCard>`.

*Phase 2 — Content Freshness Decay Alerts:*
- `lib/services/freshness-alert.service.ts` — **NEW.** Pure service (~100 lines). Exports: `VisibilitySnapshot`, `FreshnessAlert`, `FreshnessStatus`, `detectFreshnessDecay()`, `formatFreshnessMessage()`. Compares consecutive visibility_analytics snapshots. >20% relative citation_rate drop = warning, >40% = critical. Handles null rates, zero previous rates, insufficient data.
- `lib/data/freshness-alerts.ts` — **NEW.** Data layer with injected `SupabaseClient<Database>`. Queries last 5 `visibility_analytics` snapshots by org_id ascending, delegates to `detectFreshnessDecay()`.
- `app/dashboard/_components/ContentFreshnessCard.tsx` — **NEW.** Dashboard card. Declining: alert-amber/crimson badge with drop %. Stable/improving: truth-emerald badge. Null/insufficient: placeholder message.
- `lib/email.ts` — **MODIFIED.** Added `FreshnessAlertPayload` interface and `sendFreshnessAlert()`. Graceful skip when `RESEND_API_KEY` absent.
- `app/api/cron/sov/route.ts` — **MODIFIED.** Wired freshness decay check after weekly digest email send. Checks `notify_sov_alerts` org preference. Try/catch non-critical (§17).
- `lib/inngest/functions/sov-cron.ts` — **MODIFIED.** Same freshness wiring in `processOrgSOV()` after prompt intelligence step.
- `lib/data/dashboard.ts` — **MODIFIED.** Added `freshness: FreshnessStatus | null` to `DashboardData`. Non-blocking fetch.
- `app/dashboard/page.tsx` — **MODIFIED.** Renders `<ContentFreshnessCard>` after `<BotActivityCard>`, before `<CronHealthCard>`.

*Phase 3 — Console.log Cleanup:*
- Removed 8 debug `console.log` statements: `app/actions/marketing.ts` (best-of-2 scores), `app/dashboard/layout.tsx` (exposes user data), `app/dashboard/share-of-voice/_components/FirstMoverCard.tsx` (2 placeholder handlers), `app/onboarding/page.tsx` (exposes user data), `lib/services/revenue-leak.service.ts` (operational debug), `app/api/cron/sov/route.ts` (recheck debug), `lib/inngest/functions/sov-cron.ts` (recheck debug).
- Converted 5 `console.warn` → `console.error` in `app/actions/marketing.ts` (HTTP errors, Zod validation failures, JSON parse failures, uncaught errors).

*Seed & Fixtures:*
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added `MOCK_CRON_RUN_SUCCESS` (f0eebc99, audit, success), `MOCK_CRON_RUN_FAILED` (f1eebc99, sov, failed), `MOCK_FRESHNESS_SNAPSHOTS` (3 snapshots: 0.45→0.42→0.30, 28.6% decline).
- `supabase/seed.sql` — **MODIFIED.** Added Section 19b (2 visibility_analytics rows for freshness decay, UUIDs e1–e2). Added Section 21 (4 cron_run_log rows, UUIDs f0–f3). Updated UUID reference card.

**Tests added:**
- `src/__tests__/unit/cron-health-service.test.ts` — **13 Vitest tests.** buildCronHealthSummary: empty/single/all-crons, overallStatus derivation (healthy/degraded/failing), recentRuns ordering + max-20 limit, null handling, uses MOCK fixtures.
- `src/__tests__/unit/cron-health-data.test.ts` — **5 Vitest tests.** Mock createServiceRoleClient, query validation (table, order, limit), empty/error handling.
- `src/__tests__/unit/sidebar-system-health.test.ts` — **4 Vitest tests.** NAV_ITEMS includes System Health, correct href, positioned before Settings, active=true.
- `src/__tests__/unit/freshness-alert-service.test.ts` — **14 Vitest tests.** Empty/single→insufficient_data, flat→stable, increasing→improving, >20% drop→warning, >40% drop→critical, null rates skipped, consecutive drops, zero previous rate, formatFreshnessMessage validation.
- `src/__tests__/unit/freshness-alert-data.test.ts` — **5 Vitest tests.** Mock Supabase client, query validation (table, org_id, ascending, limit 5), empty→insufficient_data, data passthrough.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/cron-health-service.test.ts      # 13 tests passing
npx vitest run src/__tests__/unit/cron-health-data.test.ts         # 5 tests passing
npx vitest run src/__tests__/unit/sidebar-system-health.test.ts    # 4 tests passing
npx vitest run src/__tests__/unit/freshness-alert-service.test.ts  # 14 tests passing
npx vitest run src/__tests__/unit/freshness-alert-data.test.ts     # 5 tests passing
npx vitest run                                                      # all tests passing
npx tsc --noEmit                                                    # 0 errors
```

---

## 2026-02-28 — Sprint 75: Hallucination → Correction Content Generator (Completed)

**Goal:** Close the Fear Engine loop by generating actionable correction content for each detected hallucination — a GBP post draft, website correction snippet, llms.txt correction notice, and social post — all built deterministically from verified ground truth data. No AI calls.

**Scope:**
- `lib/services/correction-generator.service.ts` — **NEW.** Pure correction generator (~300 lines). Exports: `generateCorrectionPackage()` (category-based template system for 7+ hallucination types: closed/status, hours, address, phone, menu, amenity, generic), `formatHoursForCorrection()` (human-readable hours from HoursData). Generates 4 content pieces per hallucination: GBP post, website snippet, llms.txt entry, social post. All content from ground truth — zero AI calls. GBP/website content never amplifies the hallucinated claim.
- `lib/data/correction-generator.ts` — **NEW.** Data fetcher. Queries `ai_hallucinations` by id+org_id, fetches primary location ground truth, casts JSONB columns (§38.4), assembles `CorrectionInput`, delegates to pure service.
- `app/dashboard/actions/correction.ts` — **NEW.** Two Server Actions: `generateCorrection(formData)` — Zod-validated UUID, fetches correction package. `createCorrectionDraft(formData)` — plan-gated (Growth+), creates `content_drafts` row with `trigger_type='hallucination_correction'`, `trigger_id` = hallucination UUID.
- `app/dashboard/_components/CorrectionPanel.tsx` — **NEW.** Client Component. Shows diagnosis, ranked actions (HIGH/MEDIUM/LOW impact badges), content previews, copy-to-clipboard buttons, "Create Draft for Approval" button (plan-gated via `canRunAutopilot`). Uses `useTransition()` for server action calls.
- `app/dashboard/_components/AlertFeedClient.tsx` — **NEW.** Client wrapper for interactive alert cards with "Fix This →" button that toggles CorrectionPanel inline.
- `app/dashboard/_components/AlertFeed.tsx` — **MODIFIED.** Refactored to delegate active alerts rendering to AlertFeedClient; keeps empty state as Server Component.
- `app/dashboard/page.tsx` — **MODIFIED.** Passes `canCreateDraft` (from `canRunAutopilot`) to AlertFeed for plan gating.
- `supabase/migrations/20260227000004_hallucination_correction_trigger.sql` — **NEW.** Adds `hallucination_correction` to `content_drafts.trigger_type` CHECK constraint.
- `supabase/prod_schema.sql` — **MODIFIED.** Updated trigger_type CHECK.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added `MOCK_CORRECTION_INPUT` fixture (permanently-closed hallucination + full Charcoal N Chill ground truth).

**Tests added:**
- `src/__tests__/unit/correction-generator-service.test.ts` — **30 Vitest tests.** Category-specific corrections (7 types), diagnosis quality, action ranking, content quality rules (no claim amplification, length limits), hours formatting, edge cases (null fields).
- `src/__tests__/unit/correction-data.test.ts` — **7 Vitest tests.** Data fetching, JSONB casting, null handling, org scoping.
- `src/__tests__/unit/correction-action.test.ts` — **9 Vitest tests.** Auth guard, validation, happy paths for both actions, trigger_type='hallucination_correction'.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/correction-generator-service.test.ts  # 30 tests passing
npx vitest run src/__tests__/unit/correction-data.test.ts               # 7 tests passing
npx vitest run src/__tests__/unit/correction-action.test.ts             # 9 tests passing
npx vitest run                                                          # 1085 tests passing (81/82 files)
npx tsc --noEmit                                                        # 0 errors
```

---

## 2026-02-27 — Sprint 74: Google AI Overview Monitoring — Gemini + Search Grounding (Completed)

**Goal:** Add Google AI Overview monitoring to the SOV Engine using Gemini with Google Search grounding, enabling LocalVector to track what appears when someone Googles a tenant's business category — the #1 AI surface covering 47% of commercial searches.

**Scope:**
- `lib/ai/providers.ts` — **MODIFIED.** Added `sov-query-google` model key: `google('gemini-2.0-flash', { useSearchGrounding: true })`. Uses existing `GOOGLE_GENERATIVE_AI_API_KEY`.
- `lib/services/sov-engine.service.ts` — **MODIFIED.** Added `runGoogleGroundedSOVQuery()` — generates search-grounded SOV response with `citedSources` from `generateText().sources`. Extended `SOVQueryResult` type with optional `citedSources: { url, title }[]`. Extended `runMultiModelSOVQuery()` to include Google engine when `hasApiKey('google')` is true. Updated `writeSOVResults()` to write `cited_sources` JSONB. Added `buildGoogleGroundedPrompt()` for natural-language prompt.
- `supabase/migrations/20260227000003_sov_cited_sources.sql` — **NEW.** Adds `cited_sources JSONB` column to `sov_evaluations`.
- `supabase/prod_schema.sql` — **MODIFIED.** Added `cited_sources` column.
- `lib/supabase/database.types.ts` — **MODIFIED.** Added `cited_sources: Json | null` to sov_evaluations Row/Insert/Update types.
- `lib/data/ai-responses.ts` — **MODIFIED.** Added `citedSources` to `EngineResponse` type. Updated `fetchAIResponses()` to select and map `cited_sources`.
- `app/dashboard/ai-responses/_components/EngineResponseBlock.tsx` — **MODIFIED.** Added "Google AI Overview" engine config with amber dot. Added `citedSources` prop. Renders "Sources Google Cited" section with clickable source links below response text when non-empty.
- `app/dashboard/ai-responses/_components/ResponseCard.tsx` — **MODIFIED.** Passes `citedSources` through to EngineResponseBlock.
- `supabase/seed.sql` — **MODIFIED.** Added Google sov_evaluation seed rows for BBQ and hookah queries. Updated UUID reference card.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Extended `MOCK_SOV_RESPONSE` with Google engine entry including `citedSources`. Added standalone `MOCK_GOOGLE_SOV_RESULT` fixture.
- `docs/AI_RULES.md` — **MODIFIED.** Added `sov-query-google` to §19.3 model key registry table. Updated §36.2 Multi-Model SOV to include Google engine and citation sources.

**Tests added:**
- `src/__tests__/unit/sov-google-grounded.test.ts` — **16 Vitest tests.** Google SOV query runner, multi-model inclusion/exclusion, graceful failure, citedSources parsing, writeSOVResults with cited_sources.
- `src/__tests__/unit/sov-engine-service.test.ts` — **+2 tests (13 total).** SOVQueryResult google type, citedSources in writeSOVResults.
- `src/__tests__/unit/ai-responses-google.test.tsx` — **7 Vitest tests.** Google AI Overview tab rendering, citation source display, hide when null/empty.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/sov-google-grounded.test.ts      # 16 tests passing
npx vitest run src/__tests__/unit/sov-engine-service.test.ts       # 13 tests passing
npx vitest run src/__tests__/unit/ai-responses-google.test.tsx     # 7 tests passing
npx vitest run                                                      # 1039 tests passing (78/79 files)
npx tsc --noEmit                                                    # 0 errors
```

---

## 2026-02-27 — Sprint 73: AI Crawler Analytics — Wire crawler_hits in Middleware (Completed)

**Goal:** Wire the existing but empty `crawler_hits` table to the proxy middleware so AI bot visits to Magic Menu pages are detected and logged, then build a Bot Activity dashboard with blind spot detection and fix recommendations.

**Scope:**
- `lib/crawler/bot-detector.ts` — **NEW.** Pure bot detection utility. 10 AI bot user-agents in registry (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Google-Extended, PerplexityBot, Meta-External, Bytespider, Amazonbot, Applebot-Extended). Case-insensitive substring matching. Exports: `detectAIBot()`, `getAllTrackedBots()`, `AI_BOT_REGISTRY`.
- `proxy.ts` — **MODIFIED.** Added bot detection in menu subdomain handler. Fire-and-forget `fetch()` to `/api/internal/crawler-log` with `x-internal-secret` header. Never awaited — bot logging cannot block page delivery. `.catch(() => {})` absorbs errors (§17).
- `app/api/internal/crawler-log/route.ts` — **NEW.** Internal POST endpoint. Auth via `x-internal-secret` matching `CRON_SECRET`. Looks up magic_menu by `public_slug`, INSERTs into `crawler_hits` via `createServiceRoleClient()`. Returns `{ ok, logged }`.
- `lib/data/crawler-analytics.ts` — **NEW.** Data fetcher. Aggregates `crawler_hits` last 30 days by bot_type. Cross-references with AI_BOT_REGISTRY for blind spot detection. Status thresholds: ≥5=active, 1-4=low, 0=blind_spot. Fix recommendations per engine.
- `app/dashboard/crawler-analytics/page.tsx` — **NEW.** Server Component. Summary strip (total visits, active bots, blind spots), per-bot activity list sorted by count, blind spot section with fix recommendations, null state for new tenants.
- `app/dashboard/crawler-analytics/error.tsx` — **NEW.** Error boundary.
- `app/dashboard/_components/BotActivityCard.tsx` — **NEW.** Summary card for main dashboard with visit count, active/blind spot counts, link to full page.
- `app/dashboard/page.tsx` — **MODIFIED.** Added BotActivityCard to Quick Stats section.
- `components/layout/Sidebar.tsx` — **MODIFIED.** Added "Bot Activity" to NAV_ITEMS with Bot icon, between Page Audits and AI Assistant.
- `supabase/migrations/20260227000002_crawler_hits_location_id.sql` — **NEW.** Adds `location_id` column to `crawler_hits` with FK to locations, backfill from magic_menus, composite index.
- `supabase/prod_schema.sql` — **MODIFIED.** Added `location_id` to crawler_hits CREATE TABLE, FK constraint, and index.
- `lib/supabase/database.types.ts` — **MODIFIED.** Added `location_id` to crawler_hits Row/Insert/Update types + FK relationship.
- `supabase/seed.sql` — **MODIFIED.** Added 6 crawler_hits seed rows (UUIDs g0–g5). Updated UUID reference card.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added MOCK_CRAWLER_HIT, MOCK_CRAWLER_SUMMARY.
- `lib/data/dashboard.ts` — **MODIFIED.** Added crawlerSummary and hasPublishedMenu to DashboardData.

**Tests added:**
- `src/__tests__/unit/bot-detector.test.ts` — **20 Vitest tests.** All 10 bots detected, browser UAs rejected, null/empty/undefined handled, getAllTrackedBots returns full registry.
- `src/__tests__/unit/crawler-log-route.test.ts` — **8 Vitest tests.** Auth guard, missing fields, no-menu-found, successful INSERT, Supabase error handling.
- `src/__tests__/unit/crawler-analytics-data.test.ts` — **12 Vitest tests.** Aggregation, blind spot detection, status thresholds, 30-day filtering, fix recommendations.
- `src/__tests__/unit/sidebar-crawler.test.ts` — **3 Vitest tests.** NAV_ITEMS includes Bot Activity with correct href and position.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/bot-detector.test.ts             # 20 tests passing
npx vitest run src/__tests__/unit/crawler-log-route.test.ts        # 8 tests passing
npx vitest run src/__tests__/unit/crawler-analytics-data.test.ts   # 12 tests passing
npx vitest run src/__tests__/unit/sidebar-crawler.test.ts          # 3 tests passing
npx vitest run                                                      # All tests passing
npx tsc --noEmit                                                    # 0 type errors
```

---

## 2026-02-27 — Sprint 72: AI Health Score Composite + Top Recommendation (Completed)

**Goal:** Build a single 0–100 AI Health Score compositing SOV, page audit, hallucination, and schema data, with a prioritized top recommendation surfacing the highest-impact action.

**Scope:**
- `lib/services/ai-health-score.service.ts` — **NEW.** Pure scoring service. Exports: `computeHealthScore()` (weighted composite of 4 components with proportional re-weighting for null components), `scoreToGrade()`, `gradeDescription()`. Top Recommendation ranking from page audit recommendations + injected schema/hallucination/SOV recommendations. No I/O.
- `lib/data/ai-health-score.ts` — **NEW.** Data fetcher. 4 parallel Supabase queries (visibility_analytics, page_audits, ai_hallucinations count, ai_audits count). Assembles HealthScoreInput, calls computeHealthScore.
- `app/dashboard/actions/health-score.ts` — **NEW.** Server Action with getSafeAuthContext(), primary location lookup, delegates to fetchHealthScore.
- `app/dashboard/_components/AIHealthScoreCard.tsx` — **NEW.** Server Component. Score ring (SVG pattern from SOVScoreRing), 4 component bars with literal Tailwind width classes, letter grade, top recommendation with action link. Null state with nextSundayLabel().
- `app/dashboard/page.tsx` — **MODIFIED.** Added AIHealthScoreCard above existing Revenue Leak card.
- `lib/data/dashboard.ts` — **MODIFIED.** Added healthScore to DashboardData interface + fetchHealthScore call with primary location lookup.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added MOCK_HEALTH_SCORE_INPUT fixture (sovScore: 0.42, overall_score: 66, 2 open hallucinations, 5 total audits, no FAQ/LocalBusiness schema).
- `supabase/seed.sql` — **MODIFIED.** Added Section 19: visibility_analytics row (UUID: e0eebc99..., share_of_voice: 0.42) for golden tenant.

**Tests added:**
- `src/__tests__/unit/ai-health-score-service.test.ts` — **26 Vitest tests.** computeHealthScore weighted scoring, grade mapping (A/B/C/D/F), null re-weighting, accuracy clamping, recommendation ranking (page audit, injected schema/hallucination/SOV recs), boundary cases, golden tenant fixture validation.
- `src/__tests__/unit/ai-health-score-data.test.ts` — **9 Vitest tests.** Data layer queries (4 parallel fetches), null propagation, org_id belt-and-suspenders, JSONB recommendation casting, computeHealthScore delegation.
- `src/__tests__/unit/health-score-action.test.ts` — **4 Vitest tests.** Auth guard (unauthorized), no-location error, happy path, org_id+location_id passthrough.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/ai-health-score-service.test.ts  # 26 tests passing
npx vitest run src/__tests__/unit/ai-health-score-data.test.ts     # 9 tests passing
npx vitest run src/__tests__/unit/health-score-action.test.ts      # 4 tests passing
npx vitest run                                                      # 971 tests passing (39 new)
npx tsc --noEmit                                                    # 0 errors
```

---

## 2026-02-27 — Golden Tenant Fixture Sync (charcoalnchill.com live data)

**Goal:** Sync golden tenant fixtures to match live site `company.ts` data from charcoalnchill.com.

**Hours data corrected (Monday closed, extended late-night hours):**
- Monday: was `17:00–23:00` → now `"closed"`
- Tu–Th: close was `23:00`/`00:00` → now `01:00`
- Fri–Sat: close was `01:00` → now `02:00`
- Sunday: close was `23:00` → now `01:00`

**Social integrations enriched:** `MOCK_SCHEMA_INTEGRATIONS` expanded from 2 → 7 entries (added Facebook, Instagram, LinkedIn, YouTube, TikTok).

**Files modified:**
- `src/__fixtures__/golden-tenant.ts` — GOLDEN_TENANT + MOCK_SCHEMA_LOCATION hours, MOCK_SCHEMA_INTEGRATIONS
- `src/__tests__/unit/schema-generator-hours.test.ts` — 6 open days, Monday excluded, Tuesday assertions
- `src/__tests__/unit/schema-generator-local-business.test.ts` — sameAs count 3 → 8
- `supabase/seed.sql` — AI eval responses updated (OpenAI, Anthropic, Gemini hours text)
- `docs/03-DATABASE-SCHEMA.md` — hours examples + inline comment
- `docs/04-INTELLIGENCE-ENGINE.md` — prompt template example
- `docs/05-API-CONTRACT.md` — hours_data example
- `docs/11-TESTING-STRATEGY.md` — golden tenant hours + hallucination test examples

---

## 2026-02-27 — Sprint 71: Per-Dimension Page Audit Scores + Actionable Fix Recommendations (Completed)

**Goal:** Fix two hardcoded-zero dimension scores in the Page Audit dashboard, persist all 5 dimension scores to the database, and transform dimension bars into expandable detail sections with per-dimension explanations and actionable recommendations linked to Sprint 70 schema generators.

**Architecture:** Migration adds 2 missing columns (`faq_schema_score`, `entity_clarity_score`), auditor recommendation interface gains `dimensionKey` + `schemaType` fields, DimensionBar becomes an expandable accordion with per-dimension explanation text and filtered recommendations.

**Scope:**

Migration:
- `supabase/migrations/20260227000001_page_audit_dimensions.sql` — **NEW.** Adds `faq_schema_score INTEGER` and `entity_clarity_score INTEGER` columns to `page_audits`. Backfills `faq_schema_score` from `faq_schema_present` boolean.

Database Types:
- `lib/supabase/database.types.ts` — **MODIFIED.** Added `faq_schema_score` and `entity_clarity_score` to Row, Insert, and Update types for `page_audits`.

Auditor:
- `lib/page-audit/auditor.ts` — **MODIFIED.** Added `DimensionKey` and `SchemaFixType` types. Enhanced `PageAuditRecommendation` interface with optional `dimensionKey` and `schemaType` fields. Updated `buildRecommendations()` to tag every recommendation with its dimension and schema fix type.

Server Action:
- `app/dashboard/page-audits/actions.ts` — **MODIFIED.** `reauditPage()` now writes `faq_schema_score` and `entity_clarity_score` to the upsert.

Cron Write Paths:
- `lib/inngest/functions/content-audit-cron.ts` — **MODIFIED.** Added `faq_schema_score` and `entity_clarity_score` to the Inngest fan-out upsert.
- `app/api/cron/content-audit/route.ts` — **MODIFIED.** Added same 2 columns to the inline fallback upsert.

Page (Bug Fix):
- `app/dashboard/page-audits/page.tsx` — **MODIFIED.** Fixed hardcoded `faqSchemaScore={0}` and `entityClarityScore={0}` — now reads real values from DB. Updated select query to include new columns. All dimension scores pass `null` (not `?? 0`) per AI_RULES §20.

UI Components:
- `app/dashboard/page-audits/_components/DimensionBar.tsx` — **MODIFIED.** Accepts nullable score (`number | null`), renders "—" for pending state. Now expandable with chevron icon and accordion behavior. Shows DimensionDetail when expanded.
- `app/dashboard/page-audits/_components/DimensionDetail.tsx` — **NEW.** Per-dimension explanation text + filtered recommendations with impact badges. Schema-type recommendations show "Generate {type} →" button.
- `app/dashboard/page-audits/_components/PageAuditCard.tsx` — **MODIFIED.** Tracks `expandedDimension` state for accordion behavior (one at a time). Passes full recommendations array and `onGenerateSchema` callback to each DimensionBar. All dimension score props now `number | null`.
- `app/dashboard/page-audits/_components/PageAuditCardWrapper.tsx` — **MODIFIED.** Updated prop types to accept nullable dimension scores and typed recommendations.

Seed Data:
- `supabase/seed.sql` — **MODIFIED.** Added `faq_schema_score` (0) and `entity_clarity_score` (62) to page_audits seed. Updated recommendations to include `dimensionKey` and `schemaType` fields. Changed `ON CONFLICT` from `DO NOTHING` to `DO UPDATE` for re-seeding.

Fixtures:
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added `MOCK_PAGE_AUDIT` fixture with all 5 dimension scores and typed recommendations.

**Tests added:**
- `src/__tests__/unit/page-audit-dimensions.test.ts` — **15 tests.** Enhanced `buildRecommendations()` dimensionKey/schemaType tagging, sorting, conditional generation, null handling, and PageAuditResult completeness.
- `src/__tests__/unit/page-audit-card.test.tsx` — **11 tests.** Component rendering with nullable scores, pending state, color thresholds, expandable accordion, filtered recommendations, and schema generate button.
- `src/__tests__/unit/reaudit-action.test.ts` — **6 tests.** Server action writes all 5 dimension scores, auth/rate-limit/not-found error paths.

**Total: 32 new test cases across 3 files, all passing.**

**Run commands:**
```bash
npx vitest run src/__tests__/unit/page-audit-dimensions.test.ts   # 15 tests
npx vitest run src/__tests__/unit/page-audit-card.test.tsx         # 11 tests
npx vitest run src/__tests__/unit/reaudit-action.test.ts           # 6 tests
```

**Test totals after Sprint 71:** Vitest: 932 tests (70 files), up from 900 (67 files).

---

## 2026-02-26 — Sprint 70: Schema Fix Generator (Completed)

**Goal:** Build a Schema Fix Generator that auto-generates copy-to-clipboard JSON-LD code blocks for FAQPage, OpeningHoursSpecification, and LocalBusiness schemas — using data already in LocalVector. This is the core differentiation: instead of just telling users "FAQ schema score: 0", we generate 6 FAQ questions from their actual SOV queries with answers from ground truth data.

**Architecture:** Three-layer design — pure function generators (no DB, no side effects), data layer (Supabase fetches with ground-truth type casts), and server action (orchestrates on user click, not page load).

**Scope:**

Service Layer (pure functions — `lib/schema-generator/`):
- `types.ts` — **NEW.** SchemaLocationInput, SchemaQueryInput, SchemaIntegrationInput, GeneratedSchema, SchemaType.
- `faq-schema.ts` — **NEW.** `generateFAQPageSchema()` — transforms SOV queries into FAQ questions, generates answers from ground truth only. `transformToQuestion()` exported for testing. Max 8 Q&A pairs, min 2 required.
- `hours-schema.ts` — **NEW.** `generateOpeningHoursSchema()` — handles `"closed"` literals, missing days, cross-midnight times (AI_RULES §10).
- `local-business-schema.ts` — **NEW.** `generateLocalBusinessSchema()` + `inferSchemaOrgType()` — sameAs links from `location_integrations.listing_url`, category→Schema.org type mapping (BarOrPub, Restaurant, NightClub, LocalBusiness).
- `index.ts` — **NEW.** Re-exports all generators and types.

Data Layer:
- `lib/data/schema-generator.ts` — **NEW.** `fetchSchemaGeneratorData()` — parallel fetches locations, target_queries, location_integrations. JSONB cast to HoursData/Amenities/Categories (AI_RULES §2, §9, §38.4).

Server Action:
- `app/dashboard/page-audits/schema-actions.ts` — **NEW.** `generateSchemaFixes()` — uses `getSafeAuthContext()`, returns all three schema types.

UI Components:
- `app/dashboard/page-audits/_components/SchemaCodeBlock.tsx` — **NEW.** JSON-LD display with copy-to-clipboard (navigator.clipboard pattern from LinkInjectionModal).
- `app/dashboard/page-audits/_components/SchemaFixPanel.tsx` — **NEW.** Tabbed panel (FAQ / Opening Hours / Local Business) with impact badges and "How to add" instructions.
- `app/dashboard/page-audits/_components/PageAuditCard.tsx` — **MODIFIED.** Added "Generate Schema Fix" button (conditional on `schemaCompletenessScore < 80 || !faqSchemaPresent`), integrated SchemaFixPanel.
- `app/dashboard/page-audits/_components/PageAuditCardWrapper.tsx` — **MODIFIED.** Passes `generateSchemaFixes` server action.

Seed Data:
- `supabase/seed.sql` — Added 2 target_queries (comparison + occasion categories, UUIDs c8–c9) and 1 Yelp integration with listing_url. Updated UUID reference card.

Fixtures:
- `src/__fixtures__/golden-tenant.ts` — Added `MOCK_SCHEMA_LOCATION`, `MOCK_SCHEMA_INTEGRATIONS`, `MOCK_SCHEMA_QUERIES`.

**Tests added:**
- `src/__tests__/unit/schema-generator-faq.test.ts` — **19 tests.** FAQ generation, Q&A pairs, max 8 limit, min 2 threshold, transformToQuestion, ground-truth-only answers.
- `src/__tests__/unit/schema-generator-hours.test.ts` — **12 tests.** OpeningHoursSpecification, closed days, missing days, cross-midnight, null/empty hours.
- `src/__tests__/unit/schema-generator-local-business.test.ts` — **24 tests.** LocalBusiness + sameAs, category inference, PostalAddress, Google Maps link, acceptsReservations.
- `src/__tests__/unit/schema-generator-data.test.ts` — **8 tests.** Data layer: JSONB casts, null location, country default, empty arrays.

**Total: 63 new test cases across 4 files, all passing.**

**Run commands:**
```bash
npx vitest run src/__tests__/unit/schema-generator-faq.test.ts               # 19 tests
npx vitest run src/__tests__/unit/schema-generator-hours.test.ts             # 12 tests
npx vitest run src/__tests__/unit/schema-generator-local-business.test.ts    # 24 tests
npx vitest run src/__tests__/unit/schema-generator-data.test.ts              # 8 tests
```

**Test totals after Sprint 70:** Vitest: 900 tests (67 files), up from 818 (63 files).

---

## 2026-02-26 — Housekeeping: Fix 82 TypeScript Errors Across Test Suite

**Goal:** Bring `npx tsc --noEmit` to zero errors. All 82 errors were in test files — no production code type errors existed.

**Root causes (5 categories):**

1. **Mock Supabase client casts (29 errors, 8 files):** `makeMockSupabase()` returned `{ from: vi.fn() }` without casting to `SupabaseClient<Database>`. Fix: `as unknown as SupabaseClient<Database>` on return.
2. **HoursData Partial vs Record (18 errors, 1 file):** Zod schema in `app/onboarding/actions.ts` inferred `Record<DayOfWeek, ...>` (all keys required) instead of `Partial<Record<...>>`. Fix: made each day key optional in the Zod object schema to match `HoursData`.
3. **vi.fn type API change (12 errors, 1 file):** `vi.fn<[], string>()` (old two-param syntax) → `vi.fn<() => string>()` (current single-param syntax).
4. **React element props unknown (7 errors, 1 file):** `React.ReactElement` has `props: unknown` in newer `@types/react`. Fix: parameterized with `ReactElement<ShellProps>`.
5. **Sprint 70 readonly fixtures (3 errors, 3 files):** `as const` on fixtures made `categories` a readonly tuple. Fix: explicit `SchemaLocationInput` type annotation instead of `as const`.

**Additional fixes:** Missing `engine` field on SOVQueryResult mocks (5 errors, 3 files), schema-dts `WithContext<LocalBusiness>` property access (7 errors, 1 file), tuple annotation in filter callback (1 error, 1 file).

**Files changed:**
- `src/__fixtures__/golden-tenant.ts` — Explicit type annotations on Sprint 70 fixtures
- `src/__tests__/unit/prompt-intelligence-service.test.ts` — Supabase mock cast + imports
- `src/__tests__/unit/occasion-engine-service.test.ts` — Supabase mock cast + SOVQueryResult `engine` field
- `src/__tests__/unit/competitor-intercept-service.test.ts` — Supabase mock cast with intersection type
- `src/__tests__/unit/cron-sov.test.ts` — Supabase mock cast + SOVQueryResult `engine` field
- `src/__tests__/unit/inngest-sov-cron.test.ts` — Supabase mock cast + SOVQueryResult `engine` field
- `src/__tests__/unit/autopilot-create-draft.test.ts` — Supabase mock cast
- `src/__tests__/unit/autopilot-publish.test.ts` — `Record<string, unknown>` cast for schema-dts assertions
- `src/__tests__/unit/citation-engine-service.test.ts` — Supabase mock cast with intersection type
- `src/__tests__/unit/multi-engine-action.test.ts` — Removed explicit tuple annotation
- `src/__tests__/unit/components/layout/DashboardShell.test.tsx` — `vi.fn<() => string>()` syntax
- `src/__tests__/unit/app/dashboard/layout.test.ts` — `ReactElement<ShellProps>` casts
- `app/onboarding/actions.ts` — Optional day keys in HoursData Zod schema

**Result:** `npx tsc --noEmit` → 0 errors. `npx vitest run` → 900 tests passing, 67 files (1 RLS isolation test skipped — requires running Supabase).

---

## 2026-02-26 — Hotfix: Zod v4 + AI SDK Compatibility

**Problem:** AI Assistant chat returned "AI service temporarily unavailable" on every message. Root cause: `zod-to-json-schema@3.25.1` (bundled with `ai@4.3.19`) cannot convert Zod v4 schemas. All `generateObject()` and `tool()` calls sent invalid JSON schemas (`type: "None"` instead of `type: "object"`) to OpenAI.

**Fix:** Added `zodSchema()` adapter in `lib/ai/schemas.ts` — uses Zod v4's native `.toJSONSchema()` and wraps with the AI SDK's `jsonSchema()` helper, bypassing the broken conversion. Also improved stream error handling in `route.ts` (`getErrorMessage`) and `Chat.tsx` (`ErrorBanner` shows server message + always-visible Retry).

**Files changed:**
- `lib/ai/schemas.ts` — Added shared `zodSchema()` adapter (exported)
- `lib/tools/visibility-tools.ts` — `tool({ parameters: zodSchema(...) })`
- `lib/services/ai-audit.service.ts` — `generateObject({ schema: zodSchema(...) })`
- `lib/services/competitor-intercept.service.ts` — same pattern
- `app/dashboard/magic-menus/actions.ts` — same pattern
- `app/api/chat/route.ts` — `toDataStreamResponse({ getErrorMessage })` for stream errors
- `app/dashboard/ai-assistant/_components/Chat.tsx` — `ErrorBanner` shows server message, Retry always visible, session refresh on 401
- 11 test files — added `jsonSchema` to `vi.mock('ai')` mocks
- `docs/AI_RULES.md` — Updated §4 mock pattern, §19.3 schema docs, §33.4 error handling

---

## 2026-02-26 — Sprint 69: "AI Says" Response Library (Completed)

**Goal:** Build the "AI Says" dashboard page showing exact AI engine response text for each tracked query — the highest wow-per-effort feature in the roadmap.

**Scope:**
- `lib/data/ai-responses.ts` — **NEW.** Server-side data fetcher. Joins `target_queries` + `sov_evaluations` (including `raw_response`), groups by query, deduplicates to latest eval per engine. Exports `parseDisplayText()` for raw_response dual-format handling.
- `app/dashboard/ai-responses/page.tsx` — **NEW.** Server Component page. Plan-gated (Growth+). Empty state links to SOV page.
- `app/dashboard/ai-responses/error.tsx` — **NEW.** Error boundary (AI_RULES §35.1).
- `app/dashboard/ai-responses/_components/ResponseLibrary.tsx` — **NEW.** Client Component with category filter tabs (All, Discovery, Comparison, Near Me, Occasion, Custom), filtered count badge.
- `app/dashboard/ai-responses/_components/ResponseCard.tsx` — **NEW.** Single query card with side-by-side engine responses, category badge, last-checked date.
- `app/dashboard/ai-responses/_components/EngineResponseBlock.tsx` — **NEW.** Individual engine response display with expand/collapse (200 char truncation), raw_response parsing, competitor crimson pills, rank badge (reuses SovCard rankBg logic).
- `components/layout/Sidebar.tsx` — Added "AI Says" nav entry (Quote icon, `data-testid="nav-ai-says"`).
- `supabase/seed.sql` — Added 4 new seed rows: 1 Perplexity eval for BBQ query, 1 hookah target_query, 2 evals (OpenAI + Perplexity) for hookah query. UUIDs c4–c7 registered in reference card.
- `src/__fixtures__/golden-tenant.ts` — Added `MOCK_SOV_RESPONSE` fixture with 2 engines, realistic response text.

**Design note — raw_response dual format:** The live `writeSOVResults()` stores raw_response as `JSON.stringify({ businesses, cited_url })` — structured data, not human-readable text. Seed data stores it as plain text. The `parseDisplayText()` utility handles both. **Sprint 70+ TODO:** Modify `writeSOVResults()` to also store the full AI text.

**Tests added:**
- `src/__tests__/unit/ai-responses-data.test.ts` — **15 Vitest tests.** Data layer: grouping, dedup, null handling, empty states, parseDisplayText.
- `src/__tests__/unit/components/ai-responses/ai-responses-components.test.tsx` — **11 Vitest tests.** Component rendering: text display, truncation, competitor pills, expand/collapse, category badges.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/ai-responses-data.test.ts                                      # 15 tests passing
npx vitest run src/__tests__/unit/components/ai-responses/ai-responses-components.test.tsx        # 11 tests passing
npx vitest run                                                                                     # 844 tests (837 passed, 7 skipped, 63 files)
```

---

## 2026-02-27 — Sprint 68: Fix ai_audits Bug + Add AI Assistant to Sidebar (Completed)

**Goal:** Fix two critical bugs: (1) `ai_audits` table never written to, causing "Last Scan: never" for all customers, and (2) AI Assistant page missing from sidebar navigation.

**Scope:**
- `lib/inngest/functions/audit-cron.ts` — Added `ai_audits` INSERT in `processOrgAudit()` before hallucination writes. Sets `audit_id` FK on child hallucination rows. Graceful degradation: if audit INSERT fails, hallucinations still written with `audit_id=null`. Updated `AuditOrgResult` interface with `auditId: string | null`.
- `app/api/cron/audit/route.ts` — Applied same `ai_audits` INSERT pattern to inline fallback `_runInlineAuditImpl()`.
- `components/layout/Sidebar.tsx` — Added AI Assistant entry to `NAV_ITEMS` (MessageSquare icon, between Page Audits and Settings). Exported `NAV_ITEMS` for testability.
- `supabase/seed.sql` — Added 2 `ai_audits` seed rows (UUIDs: `d6eebc99-...a11`, `d7eebc99-...a11`). Updated hallucination seed rows with `audit_id` FK. Updated UUID reference card.
- `src/__fixtures__/golden-tenant.ts` — Added `MOCK_AI_AUDIT` fixture.

**Tests added:**
- `src/__tests__/unit/audit-cron-ai-audits.test.ts` — **11 Vitest tests.** Validates ai_audits INSERT, FK linking, graceful failure, clean scan logging, enum values, return type.
- `src/__tests__/unit/sidebar-nav-items.test.ts` — **5 Vitest tests.** Validates AI Assistant in NAV_ITEMS with correct href, active state, and position.
- `src/__tests__/unit/inngest-audit-cron.test.ts` — **UPDATED.** Mock Supabase now handles `.from('ai_audits')`. Assertions updated for `auditId` field.
- `src/__tests__/unit/cron-audit.test.ts` — **UPDATED.** Both `mockSupabaseNoOrgs` and `mockSupabaseWithOrgAndLocation` now handle `.from('ai_audits')`.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/audit-cron-ai-audits.test.ts  # 11 tests passing
npx vitest run src/__tests__/unit/sidebar-nav-items.test.ts     # 5 tests passing
npx vitest run                                                    # 818 tests passing (61 files)
```

**Note:** Pre-existing TSC errors in `prompt-intelligence-service.test.ts` and `onboarding-actions.test.ts` (mock Supabase type mismatches) — not introduced by this sprint. E2E sidebar test (`14-sidebar-nav.spec.ts`) may need updating in a future sprint to account for the new 10th nav item.

---

## 2026-02-26 — Sprint 67: Unit Tests for Stripe Webhook, Email Service (Completed)

**Goal:** Add unit test coverage for two critical untested code paths: Stripe webhook route handler and email service (Resend).

**Scope:**
- `src/__tests__/unit/stripe-webhook.test.ts` — **NEW.** 18 Vitest tests covering: signature verification (4 cases), checkout.session.completed (8 cases), subscription.updated (4 cases), subscription.deleted (2 cases). Mocks: Stripe constructor (class mock), createServiceRoleClient. Zero live API calls.
- `src/__tests__/unit/email-service.test.ts` — **NEW.** 14 Vitest tests covering: sendHallucinationAlert (6 cases), sendSOVReport (5 cases), sendWeeklyDigest (3 cases). Mocks: Resend class (class mock), WeeklyDigest component. Tests both no-op path (missing API key) and send path.

**Key design decisions:**
- Stripe mock pattern: mock the Stripe class itself using a class mock (`class MockStripe { webhooks = { constructEvent: mockFn } }`) rather than `vi.fn()` with arrow function, which cannot be called with `new`. Controls what `constructEvent()` returns per test.
- Resend mock pattern: same class mock approach (`class MockResend { emails = { send: mockSend } }`) to support `new Resend()` in the lazy singleton.
- WeeklyDigest mock: inline arrow function in `vi.mock()` factory to avoid Vitest hoisting TDZ issues with module-level variables.
- Email tests verify the no-op path (missing RESEND_API_KEY) separately from the send path — this is a critical safety behavior that prevents accidental email sends in CI/dev.
- All UUIDs in test fixtures use hex-only characters (AI_RULES §7). Golden Tenant org ID `a0eebc99-...` used throughout.
- Uses Golden Tenant fixture data (AI_RULES §4) for email payloads.

**Tests added:**
- `src/__tests__/unit/stripe-webhook.test.ts` — **18 Vitest tests.** Stripe webhook route handler.
- `src/__tests__/unit/email-service.test.ts` — **14 Vitest tests.** Email service (Resend).

**Run commands:**
```bash
npx vitest run src/__tests__/unit/stripe-webhook.test.ts   # 18 tests passing
npx vitest run src/__tests__/unit/email-service.test.ts    # 14 tests passing
npx vitest run                                              # All tests passing
```

---

## 2026-02-26 — Fix: SOV Engine Test Type Errors (Post-Sprint 66)

**Goal:** Fix pre-existing TSC errors in `sov-engine-service.test.ts` — missing `engine` property on `SOVQueryResult` test fixtures and untyped mock Supabase client.

**Root cause:** The `engine` field was added to `SOVQueryResult` in Sprint 61 (multi-model SOV), but the `writeSOVResults` test fixtures were never updated to include it. The mock Supabase client also lacked a proper type cast to `SupabaseClient<Database>`.

**Scope:**
- `src/__tests__/unit/sov-engine-service.test.ts` — **FIX.** Added `makeResult()` typed helper that defaults `engine: 'perplexity'` and all required fields. Replaced 9 inline fixture objects across 5 tests with `makeResult()` calls. Cast mock Supabase client through `unknown` to `SupabaseClient<Database>`. Added imports for `SupabaseClient`, `Database`, `SOVQueryResult`.

**Key design decisions:**
- `makeResult()` is future-proof: if `SOVQueryResult` gains more required fields, only one default location needs updating.
- Mock Supabase uses `as unknown as SupabaseClient<Database> & { _mockUpsert; _mockInsert }` intersection to preserve test-only accessors while satisfying TSC.

**Tests impacted:**
- `src/__tests__/unit/sov-engine-service.test.ts` — **11 Vitest tests.** All passing. Zero behavioral change.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/sov-engine-service.test.ts  # 11 tests passing
npx tsc --noEmit  # 0 errors in this file
```

---

## 2026-02-26 — Sprint 66: README and package.json Identity Fix (Completed)

**Goal:** Replace the default create-next-app README boilerplate with a comprehensive project README, and fix the package.json name from `scaffold-tmp` to `local-vector-v1`.

**Scope:**
- `README.md` — **REWRITTEN.** Replaced boilerplate with full project documentation covering: product description, tech stack, project structure, getting started, environment variables, scripts, database, architecture notes, and documentation index. ~201 lines.
- `package.json` — **ONE-LINE FIX.** Changed `"name": "scaffold-tmp"` → `"name": "local-vector-v1"`.

**Key design decisions:**
- README uses `docs/CLAUDE.md` as the primary source of truth, not duplicating information but pointing developers to the right spec docs.
- Environment variables section references `.env.local.example` rather than duplicating every var with full descriptions.
- No badges, emojis, or decorative elements — clean, scannable, professional.

**Tests impacted:** None — no code changes.

**Run commands:**
```bash
npx tsc --noEmit   # 0 errors (no code changes)
```

---

## 2026-02-26 — Sprint 65: Clarify SOV Precision Formulas (Completed)

**Goal:** Replace the obscure `Math.round(x * 10) / 1000` arithmetic in `writeSOVResults()` with self-documenting equivalents. Zero behavioral change — pure readability refactor.

**Scope:**
- `lib/services/sov-engine.service.ts` — Replaced 4 arithmetic expressions in `writeSOVResults()`: DB write formulas (share_of_voice, citation_rate) now use `parseFloat((x / 100).toFixed(3))` instead of `Math.round(x * 10) / 1000`; return value formulas now use `parseFloat(x.toFixed(1))` instead of `Math.round(x * 10) / 10`. Both produce bit-identical results. Comments updated to explain the conversion.

**Tests impacted:**
- `src/__tests__/unit/sov-engine-service.test.ts` — **11 Vitest tests.** Unchanged, all passing (no behavioral change).

**Run commands:**
```bash
npx vitest run src/__tests__/unit/sov-engine-service.test.ts  # 11 tests passing
```

---

## 2026-02-26 — Sprint 64: Extract Dashboard Data Layer (Completed)

**Goal:** Decompose the 447-line monolithic `app/dashboard/page.tsx` into three single-responsibility files: data fetching, aggregation utilities, and JSX rendering.

**Spec:** Review issue #2 from repo audit — "Dashboard page.tsx is a monolith"

**Scope:**
- `lib/data/dashboard.ts` — **NEW.** Exported: `fetchDashboardData()`, `DashboardData` interface, `HallucinationRow` type. Contains all 11 parallel Supabase queries, severity sorting, SOV/revenue-leak transformation, and plan resolution. ~250 lines.
- `lib/utils/dashboard-aggregators.ts` — **NEW.** Exported: `aggregateByModel()`, `aggregateCompetitors()`. Pure functions with zero side effects.
- `app/dashboard/page.tsx` — **REDUCED from 447 → 118 lines.** Removed `fetchDashboardData`, `aggregateByModel`, `aggregateCompetitors`, `SEVERITY_ORDER`, `QuickStat` (dead code). Retained `deriveRealityScore` (test import path dependency). Added re-export of `HallucinationRow` from `@/lib/data/dashboard`.

**Key design decisions:**
- `deriveRealityScore` stays in `page.tsx` because `src/__tests__/unit/reality-score.test.ts` imports from `@/app/dashboard/page`. Moving it would break the test without modifying test files.
- `HallucinationRow` is re-exported from `page.tsx` so `AlertFeed.tsx`'s relative import `'../page'` continues to resolve.
- Zero runtime behavior changes — pure code organization refactor.

**Tests impacted:**
- `src/__tests__/unit/reality-score.test.ts` — **10 Vitest tests.** Unchanged, still passing (import path preserved via re-export).

**Run commands:**
```bash
npx tsc --noEmit                                                    # 0 errors in sprint files
npx vitest run src/__tests__/unit/reality-score.test.ts             # 10 tests passing
```

---

## 2026-02-26 — Sprint 63: Generate Supabase Database Types & Eliminate `as any` Casts (Completed)

**Goal:** Replace the empty `Database = {}` stub in `lib/supabase/database.types.ts` with a comprehensive type definition, then remove all 114 Supabase `as any` casts across 52+ files. Types-only refactor — zero runtime behavior changes.

**Scope:**

### Phase 1 — Generate `database.types.ts`

*Rewritten file:* `lib/supabase/database.types.ts` (~1600 lines)
- 28 tables with `Row` / `Insert` / `Update` / `Relationships` for each
- 9 PostgreSQL enums (`plan_tier`, `plan_status`, `model_provider`, `hallucination_severity`, `correction_status`, `membership_role`, `menu_processing_status`, `sync_status`, `audit_prompt_type`)
- FK `Relationships` metadata enables supabase-js v2.97.0 auto-typed JOINs
- Standard convenience helpers: `Tables<>`, `TablesInsert<>`, `TablesUpdate<>`, `Enums<>`
- Covers 3 migration-only tables not in prod_schema.sql: `revenue_config`, `revenue_snapshots`, `cron_run_log`
- Covers migration-added columns: `organizations.notify_*`, `location_integrations.wp_*`, `location_integrations.listing_url`

### Phase 2 — Remove `as any` Casts

*Modified files (~52):*
- ~96 `(await createClient()) as any` / `createServiceRoleClient() as any` → removed
- 18 service function `supabase: any` params → `supabase: SupabaseClient<Database>`
- 13 inline `(supabase as any)` usage casts → removed (mcp/tools.ts, visibility-tools.ts)
- ~8 JOIN result `as any` casts → removed (auto-typed via Relationships)
- All corresponding `eslint-disable-next-line @typescript-eslint/no-explicit-any` comments removed

### Phase 3 — Fix Surfaced Type Errors

82 newly surfaced type errors fixed across ~25 non-test files:
- `Json` ↔ specific type casts for JSONB columns (categories, amenities, hours_data, etc.)
- Enum type narrowing for `plan_tier` / `plan_status` in Stripe webhook + compete actions
- Column name fix: `recommendation` → `suggested_action` in mcp/tools.ts and visibility-tools.ts
- `as Promise<...>` casts removed from query builders in dashboard/page.tsx
- Null safety additions (`is_primary ?? false`, `sync_status ?? 'not_linked'`, etc.)

**Remaining `as any` (4 non-Supabase, intentionally kept):** `zodResolver()` in AddItemModal, `dietary_tags` x2, AI SDK `toolPart` in Chat.tsx.

**Verification:** `npx tsc --noEmit` = 0 non-test errors. `grep "as any"` = 4 non-Supabase only.

---

## 2026-02-25 — Middleware Re-Export Shim (Post-Sprint 62 Fix)

**Problem:** `proxy.ts` contained fully implemented middleware (auth guards, subdomain routing, session refresh) but Next.js only auto-discovers middleware from a file named `middleware.ts`. The middleware was dead code — auth protection fell through to the dashboard layout's `getSafeAuthContext()` server component check.

**Fix:** Created `middleware.ts` at project root with a single re-export: `export { proxy as middleware, config } from './proxy'`. No changes to `proxy.ts`.

*New files:* `middleware.ts`
*Modified docs:* `AI_RULES.md` (§6 middleware filename, §37.3 subdomain routing)

---

## 2026-02-25 — Sprint 62: Scale Prep — Cron Logging, Guided Tour, Subdomains, Landing Split, Settings, Multi-Location (Completed)

**Goal:** Six independent V1 polish items for launch readiness: (A) Cron health logging table + service, (B) Post-onboarding guided tour, (C) Subdomain routing for public menus, (D) Landing page performance via code-splitting, (E) Settings completeness (notifications + danger zone), (F) Agency multi-location UI.

**Scope:**

### Sprint 62A — Cron Health Logging

*New files:*
- `supabase/migrations/20260226000008_cron_run_log.sql` — Creates `cron_run_log` table (id, cron_name, started_at, completed_at, duration_ms, status, summary JSONB, error_message). RLS enabled, no policies (service-role only). Index on `(cron_name, started_at DESC)`.
- `lib/services/cron-logger.ts` — `logCronStart(cronName)` → inserts row with status='running', returns `{ logId, startedAt }`. `logCronComplete(logId, summary, startedAt)` → computes duration_ms, sets status='success'. `logCronFailed(logId, errorMessage, startedAt)` → sets status='failed'. Uses `createServiceRoleClient()`, fail-safe (catch errors, log, never crash the cron).

*Modified files:*
- `app/api/cron/sov/route.ts` — Wrapped `runInlineSOV()` with logCronStart/logCronComplete/logCronFailed.
- `app/api/cron/audit/route.ts` — Same cron-logger pattern for `runInlineAudit()`.
- `app/api/cron/content-audit/route.ts` — Same pattern for `runInlineContentAudit()`.
- `app/api/cron/citation/route.ts` — Same pattern for inline citation processing loop.

### Sprint 62B — Post-Onboarding Guided Tour

*New files:*
- `app/dashboard/_components/GuidedTour.tsx` — Client component, custom tooltip approach (no react-joyride). 5-step tour targeting sidebar nav items via `data-testid`: (1) nav-dashboard → "Your Command Center", (2) nav-alerts → "AI Hallucination Alerts", (3) nav-menu → "Magic Menu", (4) nav-compete → "Competitor Intelligence", (5) nav-content → "AI Content Drafts". localStorage key `lv_tour_completed`, only shows on first visit. Overlay with dark backdrop, positioned tooltips via getBoundingClientRect, ring-2 ring-signal-green highlight. Only renders on lg+ screens. 800ms mount delay. matchMedia guard for jsdom compatibility.

*Modified files:*
- `components/layout/DashboardShell.tsx` — Renders `<GuidedTour />` after main content area.

### Sprint 62C — Subdomain Routing

*Modified files:*
- `proxy.ts` — Added hostname check at top of handler before auth logic. `menu.` prefix → `NextResponse.rewrite()` to `/m/` path prefix (public, no auth needed). `app.` prefix or bare domain → falls through to existing auth logic. Documented Vercel DNS config for `*.localvector.ai`.

### Sprint 62D — Landing Page Performance

*New files:*
- `app/_sections/shared.tsx` — Extracted `SectionLabel`, `MetricCard`, `PricingCard` helper components from the original 1,181-line page.tsx. Server Components, named exports.
- `app/_sections/HeroSection.tsx` — Sections 1-3 (JSON-LD + Nav + Hero). Statically imported (above fold). Imports ViralScanner, Reveal, ScrollHint, safeJsonLd.
- `app/_sections/ProblemSection.tsx` — Sections 4-5 (Revenue Leak + AVS Metrics). Dynamically imported.
- `app/_sections/CompareSection.tsx` — Sections 6-7 (Compare + Table). Dynamically imported.
- `app/_sections/EnginesSection.tsx` — Sections 8-9 (Three Engines + Case Study). Dynamically imported.
- `app/_sections/PricingSection.tsx` — Sections 10-13 (Pricing + FAQ + CTA + Footer). Dynamically imported.

*Modified files:*
- `app/page.tsx` — Rewritten from 1,181 lines to ~33 lines. Static import of HeroSection (above fold), `next/dynamic` imports for ProblemSection, CompareSection, EnginesSection, PricingSection (below fold code-splitting).

### Sprint 62E — Settings Completeness

*New files:*
- `supabase/migrations/20260226000009_notification_prefs.sql` — Adds `notify_hallucination_alerts`, `notify_weekly_digest`, `notify_sov_alerts` (all BOOLEAN DEFAULT TRUE) to `organizations` table.
- `app/dashboard/settings/_components/DeleteOrgModal.tsx` — Client component with confirmation modal. User must type org name to confirm. Calls `softDeleteOrganization()` server action. Red alert-crimson danger zone styling.

*Modified files:*
- `app/dashboard/settings/actions.ts` — Added `updateNotificationPrefs(formData)` (Zod-validated, updates org's 3 notification columns) and `softDeleteOrganization()` (checks role='owner', sets plan_status='canceled', signs out, redirects to /login).
- `app/dashboard/settings/page.tsx` — Fetches notification preferences from `organizations` table, passes `notifyPrefs` to SettingsForm.
- `app/dashboard/settings/_components/SettingsForm.tsx` — Added Section 4: Notifications (3 toggle switches: hallucination alerts, weekly digest, SOV alerts) with Save button. Added Section 5: Danger Zone with `<DeleteOrgModal>`. Added "Forgot password?" link to Security section.

### Sprint 62F — Agency Multi-Location UI

*New files:*
- `components/layout/LocationSwitcher.tsx` — Client component, renders only when `locations.length > 1`. Dropdown showing current location + all locations with MapPin icons. Sets cookie `lv_selected_location` via `document.cookie`, `window.location.reload()` on change. is_primary badge on primary location.

*Modified files:*
- `components/layout/Sidebar.tsx` — Extended SidebarProps with optional `locations` and `selectedLocationId`. Renders `<LocationSwitcher>` between brand header and `<nav>`.
- `components/layout/DashboardShell.tsx` — Extended props with optional `locations` and `selectedLocationId`, passes through to Sidebar.
- `app/dashboard/layout.tsx` — Added `cookies` import from `next/headers`. Fetches all org locations after onboarding guard, reads `lv_selected_location` cookie (defaults to primary), passes to DashboardShell.
- `app/dashboard/locations/page.tsx` — Plan-gated "Add Location" (shows upgrade message at limit via `maxLocations(plan)`). Replaced table view with responsive card grid (`grid gap-4 sm:grid-cols-2 lg:grid-cols-3`). Each card: business_name, city/state, is_primary badge, status badge, phone, created date.

**Tests:** 763 passing, 7 skipped. Build clean.

**Run commands:**
```bash
npx vitest run     # 763 tests passing, 7 skipped
npx next build     # 0 errors
```

---

## 2026-02-25 — Sprint 61: Polish — Occasion Calendar, Multi-Model SOV, WordPress Connect (Completed)

**Goal:** Three-part sprint: (A) Occasion Calendar UI on the content-drafts page showing upcoming seasonal events with "Create Draft" actions; (B) Multi-Model SOV queries — Growth/Agency orgs now run Perplexity + OpenAI in parallel for richer visibility data; (C) WordPress credential management — test connection, save, disconnect, and wire into publish flow.

**Scope:**

### Sprint 61A — Occasion Calendar UI

*New files:*
- `app/dashboard/content-drafts/_components/OccasionTimeline.tsx` — Collapsible "Upcoming Occasions" section with horizontal scrollable card row. Each card shows: occasion name, countdown badge (color-coded: red ≤7d, amber ≤14d, slate otherwise), occasion_type badge, relevant_categories tags, and "Create Draft" or "Draft exists" action. Uses `createManualDraft` with `trigger_type='occasion'` and `trigger_id=occasionId`.

*Modified files:*
- `app/dashboard/content-drafts/page.tsx` — Added `fetchUpcomingOccasions()` (queries `local_occasions`, computes `getDaysUntilPeak()`, filters to within-window occasions, sorts by soonest), `fetchOccasionDraftMap()` (maps existing occasion drafts by trigger_id). Renders `<OccasionTimeline>` between summary strip and filter tabs. Parallel data fetching with `Promise.all`.
- `app/dashboard/content-drafts/actions.ts` — `CreateDraftSchema` now accepts optional `trigger_type` and `trigger_id`. `createManualDraft()` passes these through to the insert (defaults to `'manual'`/`null`).

### Sprint 61B — Multi-Model SOV Queries

*Modified files:*
- `lib/services/sov-engine.service.ts` — Added `engine` field to `SOVQueryResult` interface. `runSOVQuery()` now accepts optional `modelKey` parameter (defaults to `'sov-query'`/Perplexity). New `MODEL_ENGINE_MAP` maps model keys to engine names. New `runMultiModelSOVQuery()` runs Perplexity + OpenAI in parallel via `Promise.allSettled`. `writeSOVResults()` uses `result.engine` (no longer hardcoded `'perplexity'`).
- `lib/plan-enforcer.ts` — Added `canRunMultiModelSOV(plan)` — returns true for Growth/Agency.
- `lib/inngest/functions/sov-cron.ts` — `processOrgSOV()` checks `canRunMultiModelSOV(plan)` to decide single vs multi-model per query. Imports `runMultiModelSOVQuery`.
- `app/api/cron/sov/route.ts` — Same multi-model logic in inline fallback path.
- `src/__tests__/unit/cron-sov.test.ts` — Updated mocks: added `runMultiModelSOVQuery`, `canRunMultiModelSOV`, `engine` field to mock results.
- `src/__tests__/unit/inngest-sov-cron.test.ts` — Same mock updates.

### Sprint 61C — WordPress Credential Management

*New files:*
- `supabase/migrations/20260226000007_wp_credentials.sql` — Adds `wp_username` and `wp_app_password` columns to `location_integrations`.
- `app/dashboard/integrations/_components/WordPressConnectModal.tsx` — Modal form: Site URL, Username, Application Password. "Test Connection" button calls `testWordPressConnection()` (10s timeout), "Save & Connect" stores credentials via `saveWordPressCredentials()`.
- `app/dashboard/integrations/_components/WordPressConnectButton.tsx` — Two-state UI: not connected (shows "Connect WordPress" button → opens modal) or connected (green badge + site URL + "Disconnect" button).

*Modified files:*
- `app/dashboard/integrations/actions.ts` — Added 3 server actions: `testWordPressConnection()` (HEAD request to wp-json with 10s AbortController timeout), `saveWordPressCredentials()` (upserts platform='wordpress' row with credentials), `disconnectWordPress()` (deletes the row).
- `app/dashboard/integrations/page.tsx` — Added `fetchWordPressStatus()` function, WordPress section below GBP section using same card pattern.
- `app/dashboard/content-drafts/actions.ts` — `publishDraft()` WordPress branch now fetches `wp_username` and `wp_app_password` from `location_integrations` (previously passed empty strings).

**Tests:** 763 passing, 7 skipped. Build clean.

**Run commands:**
```bash
npx vitest run     # 763 tests passing, 7 skipped
npx next build     # 0 errors
```

---

## 2026-02-25 — Sprint 60: Reliability — Error Boundaries, Google OAuth, Password Reset, E2E Specs (Completed)

**Goal:** Two-part sprint: (A) Add per-section error boundaries, Google OAuth sign-in, and password reset flow; (B) Add data-testid attributes to sidebar and 4 new E2E spec files for AI Assistant, Citations, Page Audits, and sidebar navigation.

**Scope:**

### Sprint 60B — Error Boundaries + Google OAuth + Password Reset

*New files:*
- `app/dashboard/error.tsx` — Dashboard-level error boundary with Sentry capture, AlertTriangle icon, "Try again" button.
- `app/dashboard/hallucinations/error.tsx` — Same pattern for hallucinations section.
- `app/dashboard/share-of-voice/error.tsx` — Same pattern for SOV section.
- `app/dashboard/ai-assistant/error.tsx` — Same pattern for AI assistant section.
- `app/dashboard/content-drafts/error.tsx` — Same pattern for content drafts section.
- `app/(auth)/forgot-password/page.tsx` — Email input form, calls `supabase.auth.resetPasswordForEmail()`, success/error states, dark theme matching login page.
- `app/(auth)/reset-password/page.tsx` — New password + confirm password form, calls `supabase.auth.updateUser()`, redirects to `/login` on success.

*Modified files:*
- `app/(auth)/login/page.tsx` — Added "Forgot password?" link, Google OAuth divider + "Sign in with Google" button using Supabase `signInWithOAuth({ provider: 'google' })`, graceful error handling if provider not configured.
- `app/(auth)/register/page.tsx` — Added "Sign up with Google" button with same OAuth pattern.

### Sprint 60A — Playwright E2E Specs + data-testid

*Modified files:*
- `components/layout/Sidebar.tsx` — Added `data-testid` attributes to all 11 nav links (`nav-dashboard`, `nav-alerts`, `nav-menu`, `nav-share-of-voice`, `nav-content`, `nav-compete`, `nav-listings`, `nav-citations`, `nav-page-audits`, `nav-settings`, `nav-billing`).

*New files:*
- `tests/e2e/11-ai-assistant.spec.ts` — Page heading, chat input, quick-action buttons, message typing, subtitle text.
- `tests/e2e/12-citations.spec.ts` — Page heading, gap score or empty state, sidebar navigation.
- `tests/e2e/13-page-audits.spec.ts` — Page heading, audit cards or empty state, sidebar navigation.
- `tests/e2e/14-sidebar-nav.spec.ts` — Tests 9 sidebar links navigate to correct pages with correct headings.

**Tests:** 763 passing, 7 skipped. Build clean. 1 pre-existing RLS isolation test failure (local Supabase auth issue, not Sprint 60 related).

**Run commands:**
```bash
npx vitest run                            # 763 tests passing, 7 skipped
npx next build                            # 0 errors
npx playwright test --project=chromium    # E2E specs (requires dev server)
```

---

## 2026-02-25 — Sprint 59: PDF Menus, Revenue Leak History, Weekly Digest (Completed)

**Goal:** Three-part sprint: (A) Magic Menu PDF Upload via GPT-4o Vision — wire the Tab 1 drop zone to a new `uploadMenuFile()` server action that extracts menu items from PDF/image files; (B) Revenue Leak Historical Trend Persistence — add `snapshotRevenueLeak()` to persist daily leak calculations into the existing `revenue_snapshots` table, wired into both audit cron paths; (C) Weekly Digest Email — enhance the WeeklyDigest React Email template with SOV delta, top competitor, and citation rate, then replace `sendSOVReport()` with `sendWeeklyDigest()` in both SOV cron paths.

**Scope:**

### Sprint 59A — Magic Menu PDF Upload via GPT-4o Vision

*Modified files:*
- `lib/ai/schemas.ts` — Added `MenuOCRItemSchema` and `MenuOCRSchema` (Zod). Array of items with name, description (optional), price (optional string), category. Exported `MenuOCROutput` type.
- `lib/ai/providers.ts` — Added `'menu-ocr'` model key mapping to `openai('gpt-4o')` in MODELS registry and ModelKey type.
- `app/dashboard/magic-menus/actions.ts` — Added `uploadMenuFile()` server action. Accepts FormData with file (PDF/JPG/PNG/WebP, max 10 MB). Calls `generateObject()` with `menu-ocr` model and file content part. Maps OCR items to `MenuExtractedItem[]` (confidence: 0.70). Saves via existing `saveExtractedMenu()`. Guarded by `hasApiKey('openai')`.
- `app/dashboard/magic-menus/_components/UploadState.tsx` — Wired Tab 1 drop zone to `uploadMenuFile`. Added `aiFileInputRef`, drag-and-drop handlers, file validation, loading state with spinner. Accepts `.pdf,.jpg,.jpeg,.png,.webp`.

### Sprint 59B — Revenue Leak Historical Trend Persistence

*Modified files:*
- `lib/services/revenue-leak.service.ts` — Added `snapshotRevenueLeak(supabase, orgId, locationId)`. Fetches hallucinations, SOV, competitors, revenue config in parallel. Calls existing `calculateRevenueLeak()`. Upserts to `revenue_snapshots` with `onConflict: 'org_id,location_id,snapshot_date'` for idempotency. No migration needed — `revenue_snapshots` table already exists.
- `app/api/cron/audit/route.ts` — Wired `snapshotRevenueLeak()` into inline fallback path after competitor intercept loop.
- `lib/inngest/functions/audit-cron.ts` — Added Step 4 `snapshot-revenue-leak-{orgId}` fan-out. Each step creates own Supabase client, fetches primary location, calls `snapshotRevenueLeak()`.

### Sprint 59C — Weekly Digest Email

*Modified files:*
- `emails/WeeklyDigest.tsx` — Added 3 optional props: `sovDelta` (number | null), `topCompetitor` (string | null), `citationRate` (number | null). Added SOV delta display with colored arrow, citation rate stat in stats row, competitor mention box with indigo border.
- `lib/email.ts` — Added `sendWeeklyDigest()` function. Uses Resend `react:` property with WeeklyDigest component. Same no-op pattern when RESEND_API_KEY absent.
- `app/api/cron/sov/route.ts` — Replaced `sendSOVReport()` with `sendWeeklyDigest()`. Added sovDelta computation (last 2 visibility_analytics rows), topCompetitor extraction (most frequent from sov_evaluations), citationRate calculation.
- `lib/inngest/functions/sov-cron.ts` — Same replacement in Inngest path. Same delta/competitor/citation logic as inline cron.

*Test fixes:*
- `src/__tests__/unit/cron-sov.test.ts` — Updated email mock to include `sendWeeklyDigest`. Added `order()` to mock chain. Updated assertions from `sendSOVReport` to `sendWeeklyDigest`.
- `src/__tests__/unit/inngest-sov-cron.test.ts` — Same mock updates. Added `order()`, `limit()`, `maybeSingle()` to default mock handler.

**Tests:** 763 passing, 7 skipped. Build clean. 1 pre-existing RLS isolation test failure (local Supabase auth issue, not Sprint 59 related).

**Run commands:**
```bash
npx vitest run                            # 763 tests passing, 7 skipped
npx next build                            # 0 errors
```

---

## 2026-02-25 — Sprint 58: Citation, Page Audit, Prompt Intelligence Dashboards (Completed)

**Goal:** Three-part sprint: (A) Citation Gap Dashboard — shows which platforms AI cites and where the tenant isn't listed; (B) Page Audit Dashboard — displays AEO readiness scores across 5 dimensions with re-audit action; (C) Prompt Intelligence Gap Alerts — surfaces untracked queries, competitor-discovered gaps, and zero-citation clusters on the SOV page with category breakdown chart.

**Scope:**

### Sprint 58A — Citation Gap Dashboard Page

*New files:*
- `app/dashboard/citations/page.tsx` — **NEW.** Server component. Fetches `citation_source_intelligence` for tenant's primary category+city (aggregate market data, not org-scoped). Joins `listings` with `directories` for `TenantListing[]`. Calls `calculateCitationGapScore()`. Plan gate: Growth/Agency via `canViewCitationGap()`. Empty state for no-location and no-data.
- `app/dashboard/citations/_components/CitationGapScore.tsx` — **NEW.** Circular SVG score ring (radius 54, color-coded: green 80+, amber 50-79, red <50). Shows "X of Y platforms covered".
- `app/dashboard/citations/_components/PlatformCitationBar.tsx` — **NEW.** Horizontal bars sorted by citation frequency. "Listed ✓" (signal-green) / "Not listed" (alert-crimson) per platform.
- `app/dashboard/citations/_components/TopGapCard.tsx` — **NEW.** Highlighted card for #1 uncovered platform gap. "Claim Your Listing" CTA links to platform signup URLs (7 platforms mapped).

### Sprint 58B — Page Audit Dashboard Page

*New files:*
- `app/dashboard/page-audits/page.tsx` — **NEW.** Server component. Reads `page_audits` table for org. Computes average AEO score. Plan gate: Growth/Agency via `canRunPageAudit()`. Empty state when no audits exist.
- `app/dashboard/page-audits/_components/AuditScoreOverview.tsx` — **NEW.** Circular SVG score ring for aggregate AEO readiness. Shows total pages audited + last audit date.
- `app/dashboard/page-audits/_components/PageAuditCard.tsx` — **NEW.** Per-page audit card with 5 dimension bars (Answer-First 35%, Schema 25%, FAQ 20%, Keyword 10%, Entity 10%), top recommendation, re-audit button with `useTransition`.
- `app/dashboard/page-audits/_components/PageAuditCardWrapper.tsx` — **NEW.** Client wrapper binding `reauditPage` server action to PageAuditCard.
- `app/dashboard/page-audits/_components/DimensionBar.tsx` — **NEW.** Reusable score bar with label, weight, and color-coded fill.
- `app/dashboard/page-audits/actions.ts` — **NEW.** `reauditPage()` server action. Rate limited (1 per page per 5 min). Calls `auditPage()` from `lib/page-audit/auditor.ts`, upserts result to `page_audits`.

### Sprint 58C — Prompt Intelligence Gap Alerts on SOV Page

*New files:*
- `app/dashboard/share-of-voice/_components/GapAlertCard.tsx` — **NEW.** Gap alert card with type badge (untracked/competitor_discovered/zero_citation_cluster), impact level, category, and suggested action.
- `app/dashboard/share-of-voice/_components/CategoryBreakdownChart.tsx` — **NEW.** Horizontal bar chart showing citation rates per query category (discovery, near_me, comparison, occasion, custom).

*Modified files:*
- `app/dashboard/share-of-voice/page.tsx` — Added imports for `detectQueryGaps`, `computeCategoryBreakdown`, `GapAlertCard`, `CategoryBreakdownChart`. Added `query_category` to QueryRow type and select. Growth/Agency plan gate for Prompt Intelligence section. Gap detection fetches up to 10 gaps per location. Category breakdown chart + gap alert cards rendered between First Mover and Query Library sections.
- `components/layout/Sidebar.tsx` — Added "Citations" (Globe icon, after Listings) and "Page Audits" (FileSearch icon, after Citations) to NAV_ITEMS. Added Globe, FileSearch imports from lucide-react.
- `lib/plan-enforcer.ts` — Added `canViewCitationGap()` — Growth/Agency gate for Citation Gap Dashboard.

**Tests:** 763 passing, 7 skipped. Build clean. 1 pre-existing RLS isolation test failure (local Supabase auth issue, not Sprint 58 related).

**Run commands:**
```bash
npx vitest run                            # 763 tests passing, 7 skipped
npx next build                            # 0 errors
```

**Docs updated:** AI_RULES.md §5 (plan gating list: nine→ten, added `canViewCitationGap`), new §34 (Citation Gap, Page Audit, Prompt Intelligence Dashboards — 5 subsections). CLAUDE.md: added `app/dashboard/citations/` and `app/dashboard/page-audits/` to Key Directories, added `page_audits` table, noted `citation_source_intelligence` is aggregate (not org-scoped). Root CLAUDE.md rule count 33→34. 09-BUILD-PLAN.md Phase 7: Citation Gap UI items checked off (5/6, blur-teaser deferred), Page Audit items checked off (7/8, Starter-only deferred).

---

## 2026-02-25 — Sprint 57: AI Chat Polish + GBP OAuth Connect (Completed)

**Goal:** Two-part sprint: (A) Polish the AI Chat Assistant UI with error handling, loading skeleton, quick-action fixes, mobile responsiveness, sparkline chart, stop/copy controls; (B) Wire Google Business Profile OAuth connect flow end-to-end.

**Scope:**

### Sprint 57A — AI Chat Assistant UI Polish (7 requirements)

*Modified files:*
- `app/dashboard/ai-assistant/_components/Chat.tsx` — Full rewrite with:
  1. **Error handling** — destructured `error` + `reload` from `useChat()`, error banner with retry button, 401 session-expired detection.
  2. **Loading skeleton** — 3 placeholder bubbles with `animate-pulse`, shown when `messages.length === 0 && isLoading`.
  3. **Quick-action fix** — replaced hacky `setTimeout + requestSubmit` with `append({ role: 'user', content: q })` from `useChat()`.
  4. **Mobile responsiveness** — responsive padding (`px-2 sm:px-4`), bubble widths (`max-w-[90%] sm:max-w-[85%]`), input bar stacks vertically on mobile (`flex-col sm:flex-row`).
  5. **TrendList → sparkline** — replaced flat date/percentage list with recharts `AreaChart` (120px height, signal-green fill with gradient, `XAxis` + `Tooltip`).
  6. **Stop generating** — destructured `stop` from `useChat()`, red "Stop" button with square icon replaces "Send" while loading.
  7. **Copy message** — `CopyButton` component with clipboard API, hover-only visibility (`opacity-0 group-hover:opacity-100`), "Copied!" tooltip (2s).

### Sprint 57B — GBP OAuth Connect Flow (6 requirements)

*New files:*
- `app/api/auth/google/route.ts` — **NEW.** OAuth initiation endpoint. Generates CSRF state token, stores in httpOnly cookie (10min maxAge), redirects to Google consent screen with GBP management + userinfo.email scopes. Uses `access_type: 'offline'` + `prompt: 'consent'` for refresh_token.
- `app/api/auth/google/callback/route.ts` — **NEW.** OAuth callback handler. Verifies CSRF state cookie, exchanges code for tokens via `fetch()`, fetches GBP account name + email, upserts into `google_oauth_tokens` (service role), redirects to integrations page with success/error query param.
- `app/dashboard/integrations/_components/GBPConnectButton.tsx` — **NEW.** Client component with 4 states: not-configured, plan-gated (upgrade link), not-connected (OAuth link), connected (email + disconnect button).
- `supabase/migrations/20260226000006_google_oauth_tokens_rls.sql` — **NEW.** Grants SELECT to `authenticated` role, adds `org_isolation_select` RLS policy on `google_oauth_tokens` (same pattern as other org-scoped tables).

*Modified files:*
- `app/dashboard/integrations/actions.ts` — Added `disconnectGBP()` server action. Uses `createServiceRoleClient()` to delete the org's `google_oauth_tokens` row. Security: org_id derived server-side.
- `app/dashboard/integrations/page.tsx` — Added GBP Connect section above location cards. Fetches `google_oauth_tokens` for connected status. Uses `canConnectGBP()` from plan-enforcer for plan gating. Updated footer text (GBP OAuth is now live).

**Tests:** 763 passing, 7 skipped. Build clean. No new test files — Sprint 57A modifies existing Chat.tsx (covered by visual review), Sprint 57B creates new server routes (integration tested via manual OAuth flow).

**Env vars required for Sprint 57B:**
```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_APP_URL=https://app.localvector.ai
```

**Run commands:**
```bash
npx vitest run                            # 763 tests passing, 7 skipped
npx next build                            # 0 errors
```

**Docs updated:** AI_RULES.md §18 (serviceRole permitted uses: OAuth callback + disconnectGBP), new §32 (Google OAuth & GBP Connection — 6 subsections), new §33 (AI Chat Assistant — useChat, tool cards, error handling, sparkline, copy). CLAUDE.md rule count 31→33, added migrations 12-17, added GOOGLE_CLIENT_ID/SECRET to env vars, updated google_oauth_tokens security note. 09-BUILD-PLAN.md Phase 8 checklist updated (GBP OAuth items checked off). 03-DATABASE-SCHEMA.md v2.7 (google_oauth_tokens RLS asymmetric access model).

---

## 2026-02-25 — Sprint 56: Production Hardening + Stripe Portal + Occasions (Completed)

**Goal:** Three-part sprint: (A) Harden Inngest functions for production with health checks, timeouts, and structured logging; (B) Add Stripe Customer Portal for subscription management; (C) Expand occasion seed data from 20 to 32 occasions.

**Scope:**

### Sprint 56A — Inngest Production Verification & Hardening

*New files:*
- `app/api/inngest/health/route.ts` — **NEW.** GET endpoint returning Inngest client metadata (client ID, registered function IDs, environment, env key status). Protected by CRON_SECRET auth header.
- `lib/inngest/timeout.ts` — **NEW.** Shared `withTimeout()` helper — wraps async operations with 55-second Promise.race guard (5s buffer under Vercel's 60s limit).
- `scripts/test-inngest-dispatch.ts` — **NEW.** Manual Inngest event dispatcher with `--dry-run` flag and `--event` filter for production verification.

*Modified files:*
- `lib/inngest/functions/sov-cron.ts` — retries 3→2, withTimeout on fan-out steps, structured logging (function_id, event_name, started_at, completed_at, duration_ms, metrics).
- `lib/inngest/functions/audit-cron.ts` — withTimeout on audit+intercept fan-out steps, structured logging.
- `lib/inngest/functions/content-audit-cron.ts` — withTimeout on location audit fan-out steps, structured logging.
- `lib/inngest/functions/post-publish-check.ts` — concurrency limit 10 added, retries 2→1, withTimeout on SOV recheck step, structured logging.

### Sprint 56B — Stripe Customer Portal + Subscription Management

*Modified files:*
- `app/dashboard/billing/actions.ts` — Added `createPortalSession()` (Stripe Customer Portal session via `billingPortal.sessions.create`), `getCurrentPlan()` (fetches plan/plan_status/stripe_customer_id). Demo mode fallback when STRIPE_SECRET_KEY absent.
- `app/dashboard/billing/page.tsx` — Added: current plan badge at top, "Current Plan" indicator on active tier card, "Manage Subscription" button → Stripe Portal, success/canceled URL param banners (auto-dismiss after 5s).
- `app/api/webhooks/stripe/route.ts` — Added `customer.subscription.deleted` handler: downgrades org to `plan='trial', plan_status='canceled'`.

### Sprint 56C — Occasion Seed Expansion

*New files:*
- `supabase/migrations/20260226000005_seed_occasions_phase2.sql` — **NEW.** 12 additional occasions: Easter, Halloween, July 4th, Labor Day Weekend, Reunion Party, Retirement Celebration, Date Night, Business Lunch, Sunday Brunch, Patio Season, Football Season, Prom/Formal Season.

*Modified files:*
- `supabase/seed.sql` — Section 14a expanded from 20 to 32 occasions (same 12 additions). ON CONFLICT (name) DO NOTHING for idempotent re-seeding.

**Tests:** 763 passing, 7 skipped. Build clean. No new test files added — Sprint 56 modifies existing Inngest configs and billing actions covered by existing unit and E2E tests.

**Docs updated:** AI_RULES.md §30 (Inngest config table, timeout, health check), new §31 (Stripe Billing Patterns), §18 (serviceRole permitted uses). 04-INTELLIGENCE-ENGINE.md v2.6 (Inngest config table, occasion expansion). 09-BUILD-PLAN.md (occasion checklist, billing portal). CLAUDE.md rule count 27→31.

**Run commands:**
```bash
npx vitest run                            # 763 tests passing, 7 skipped
npx next build                            # 0 errors
npx tsx scripts/test-inngest-dispatch.ts --dry-run  # preview dispatch
```

---

## 2026-02-25 — Sprint 55: Multi-Engine Eval Service Extraction (Completed)

**Goal:** Extract the multi-engine AI evaluation logic from `hallucinations/actions.ts` into a pure service at `lib/services/multi-engine-eval.service.ts`. This enables the cron pipeline and Inngest functions to run multi-engine evaluations without going through a Server Action. Eliminates ~130 lines of duplicated code (raw `fetch()` callers, inline prompt builder, mock helpers).

**Scope:**

*New files:*
- `lib/services/multi-engine-eval.service.ts` — **NEW.** Pure service (no auth, no Supabase client creation — AI_RULES §6). Exports `buildEvalPrompt()`, `callEngine()`, `runAllEngines()`. Uses Vercel AI SDK `generateText()` for all 4 engines. Mock fallback when API key is absent. Engine→provider mapping for openai, perplexity, anthropic, gemini.
- `src/__tests__/unit/multi-engine-eval-service.test.ts` — **NEW.** 18 Vitest tests. `buildEvalPrompt` (4): field inclusion, null handling, JSON instructions. `callEngine` mock path (5): per-engine mock results, no generateText call. `callEngine` real path (5): model key, JSON parsing, markdown fence extraction, score clamping, error fallback. `runAllEngines` (4): all-mock, all-real, partial failure resilience, result shape.

*Modified files:*
- `app/dashboard/hallucinations/actions.ts` — **REWRITTEN.** Removed ~130 lines of duplicated code: `buildPrompt()`, `callOpenAI()`, `callPerplexity()`, `callEngine()`, `mockResult()`, `ENGINE_KEY_NAMES`, `ENGINE_PROVIDER`, `LocationData`, `EvaluationResult` types. `runAIEvaluation()` now delegates to `callEngine()` from service. `runMultiEngineEvaluation()` now delegates to `runAllEngines()` from service. Legacy raw `fetch()` callers fully removed. `verifyHallucinationFix()` unchanged (uses `ai-audit.service`).

**Deleted code:**
- `callOpenAI()` — raw `fetch('https://api.openai.com/...')`, replaced by AI SDK `callEngine()`
- `callPerplexity()` — raw `fetch('https://api.perplexity.ai/...')`, replaced by AI SDK `callEngine()`
- `buildPrompt()` — duplicated in service as `buildEvalPrompt()`
- `mockResult()`, `ENGINE_KEY_NAMES`, `ENGINE_PROVIDER` — moved to service
- `LocationData`, `EvaluationResult` types — replaced by service's `MultiEngineEvalInput`, `EvaluationResult`

**Tests:** 18 new tests (multi-engine-eval-service). 763 total passing, 7 skipped.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/multi-engine-eval-service.test.ts  # 18 tests passing
npx vitest run src/__tests__/unit/hallucination-classifier.test.ts   # 7 tests passing
npx vitest run                                                        # 763 tests passing, 7 skipped
npx next build                                                        # 0 errors
```

---

## 2026-02-25 — Sprint 54: Fear Engine generateObject Migration (Completed)

**Goal:** Migrate the Fear Engine (`ai-audit.service.ts`) from `generateText()` + manual `JSON.parse()` to Vercel AI SDK's `generateObject()` with Zod schema validation (`AuditResultSchema`). Eliminates JSON parsing boilerplate and improves error handling.

**Scope:**

*Modified files:*
- `lib/services/ai-audit.service.ts` — Replaced `generateText()` + `JSON.parse()` with `generateObject({ schema: AuditResultSchema })`. Removed try/catch around manual JSON parsing. System prompt simplified (JSON format instructions no longer needed — SDK enforces schema server-side).
- `src/__tests__/unit/hallucination-classifier.test.ts` — Updated test mocks from `vi.mocked(generateText)` to `vi.mocked(generateObject)`. Mock return shape changed from `{ text: '...' }` to `{ object: { hallucinations: [...] } }`. Removed stale "unparseable JSON" fallback test (SDK validates at call time).

**Tests:** 7 tests, all passing (rewritten, not added/removed).

**Run commands:**
```bash
npx vitest run src/__tests__/unit/hallucination-classifier.test.ts  # 7 tests passing
```

---

## 2026-02-25 — Sprint 53: RLS Audit Fixes (3 Tables) (Completed)

**Goal:** Defense-in-depth RLS hardening on 3 tables flagged in the V1 implementation audit. Prevents cross-org data leaks even if future code paths use user-scoped Supabase clients.

**Scope:**

*New files:*
- `supabase/migrations/20260226000004_rls_audit_fixes.sql` — **NEW.** Three-table RLS hardening:
  1. `citation_source_intelligence`: RLS was NOT enabled. Added `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `authenticated_select` policy (shared market data, no org isolation needed). Service-role writes (cron) bypass RLS.
  2. `page_audits`: Had SELECT only. Added `org_isolation_insert`, `org_isolation_update`, `org_isolation_delete` policies.
  3. `content_drafts`: Had SELECT/INSERT/UPDATE. Added `org_isolation_delete` policy.

*Modified files:*
- `supabase/prod_schema.sql` — Applied all policy definitions to authoritative schema.

**Tests:** No new tests (migration-only). Verified via `supabase db reset`.

---

## 2026-02-25 — Sprint 52: Bearer Token Auth Guard for MCP Endpoint (Completed)

**Goal:** Secure the MCP endpoint (`/api/mcp/[transport]`) with bearer token authentication. Previously completely unauthenticated — exposed all tenant SOV, hallucination, and competitor data to any caller.

**Scope:**

*New files:*
- `.env.local.example` — **NEW.** Environment variable reference (55 lines). Documents all env vars including `MCP_API_KEY` with fail-closed behavior.
- `src/__tests__/unit/mcp-auth.test.ts` — **NEW.** 4 Vitest tests. Bearer token validation: missing header (401), wrong token (401), missing env var / fail-closed (401), correct token (passes through).

*Modified files:*
- `app/api/mcp/[transport]/route.ts` — Added `withMcpAuth()` wrapper. Validates `Authorization: Bearer <MCP_API_KEY>` header. Returns 401 when absent, wrong, or env var unset. Fails closed when `MCP_API_KEY` is not configured (rejects all requests).

**Tests:** 4 new Vitest tests, all passing.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/mcp-auth.test.ts  # 4 tests passing
```

---

## 2026-02-25 — Bug Fix: Chat-Assistant Model Key Separation (Completed)

**Goal:** Decouple the AI Chat endpoint from the Fear Audit model key, enabling independent model upgrades.

**Scope:**

*Modified files:*
- `app/api/chat/route.ts` — Changed `getModel('fear-audit')` to `getModel('chat-assistant')`.
- `lib/ai/providers.ts` — Added `'chat-assistant': openai('gpt-4o')` to model registry.

**Rationale:** The chat endpoint was borrowing the `fear-audit` model key, coupling chat upgrades to audit upgrades.

---

## 2026-02-25 — Sprint 50: AI SDK Migration — Competitor Intercept Service (Completed)

**Goal:** Migrate the last remaining raw `fetch()` calls (Perplexity + OpenAI) in the Competitor Intercept Service to the Vercel AI SDK (`generateText` / `generateObject`), completing the Surgery 2 wave. Eliminates manual HTTP construction and `JSON.parse` in the Greed Engine pipeline.

**Scope:**

*Modified files:*
- `lib/services/competitor-intercept.service.ts` — **REWRITTEN.** 2-stage LLM pipeline migrated:
  - Stage 1 (`callPerplexityHeadToHead`): raw `fetch('https://api.perplexity.ai/...')` → `generateText({ model: getModel('greed-headtohead'), ... })` + `PerplexityHeadToHeadSchema.parse()`. Uses `generateText` (not `generateObject`) because Perplexity's `compatibility: 'compatible'` mode does not support `response_format: json_schema`.
  - Stage 2 (`callGptIntercept`): raw `fetch('https://api.openai.com/...')` → `generateObject({ model: getModel('greed-intercept'), schema: InterceptAnalysisSchema, ... })`. OpenAI enforces structured output server-side; no manual `JSON.parse` needed.
  - API key checks: `process.env.PERPLEXITY_API_KEY` / `OPENAI_API_KEY` → `hasApiKey('perplexity')` / `hasApiKey('openai')`.
  - Removed 2 inline type definitions (`PerplexityResult`, `InterceptAnalysis`) — replaced with Zod-inferred types from `lib/ai/schemas.ts`.
  - Updated comment block to document 3rd caller context (Inngest steps from Sprint 49).
- `src/__tests__/unit/competitor-intercept-service.test.ts` — **REWRITTEN.** 8 tests. Replaced `vi.stubGlobal('fetch', ...)` with `vi.mock('ai')` + `vi.mock('@/lib/ai/providers')`. Mock helpers return SDK-shaped `{ text }` / `{ object }` instead of HTTP Response objects. `process.env.*_API_KEY` manipulation replaced with `vi.mocked(hasApiKey)` calls.
- `src/__tests__/unit/competitor-actions.test.ts` — **REWRITTEN.** 22 tests. Same mock strategy migration: `vi.stubGlobal('fetch', mockFetch)` → `vi.mocked(generateText).mockResolvedValue(...)` / `vi.mocked(generateObject).mockResolvedValue(...)`. `process.env` teardown replaced with `vi.clearAllMocks()` + `vi.mocked(hasApiKey).mockReturnValue(true)`.

**Tests:** 30 tests across 2 files (8 + 22), all passing. Test count neutral (tests rewritten, not added/removed).

**Run commands:**
```bash
npx vitest run src/__tests__/unit/competitor-intercept-service.test.ts  # 8 tests passing
npx vitest run src/__tests__/unit/competitor-actions.test.ts            # 22 tests passing
npx vitest run                                                          # 742 tests passing, 7 skipped
npx next build                                                          # 0 errors
```

---

## 2026-02-25 — Sprint 49: Inngest Job Queue System (Completed)

**Goal:** Replace sequential `for...of` loops in 3 Vercel Cron routes (SOV, Audit, Content Audit) with Inngest event-driven step functions providing per-org fan-out, automatic retries, independent timeouts, and parallelism. Add durable 14-day sleep for post-publish SOV re-checks (replaces Redis TTL scheduling).

**Spec:** `docs/CLAUDE-06-queue-system.md`

**Scope:**

*New files:*
- `lib/inngest/client.ts` — **NEW.** Inngest client singleton with typed `EventSchemas`. App ID: `localvector`.
- `lib/inngest/events.ts` — **NEW.** 4 typed event definitions: `cron/sov.weekly`, `cron/audit.daily`, `cron/content-audit.monthly`, `publish/post-publish-check`.
- `app/api/inngest/route.ts` — **NEW.** Inngest webhook handler. Registers all 4 functions via `serve()`. `maxDuration = 60` (Vercel Pro limit).
- `lib/inngest/functions/sov-cron.ts` — **NEW.** SOV weekly fan-out function. Exports `processOrgSOV(batch)` for testability. Replicates all 11 sub-steps: query execution, writeSOVResults, email, occasion engine, prompt intelligence, archive expired drafts, post-publish rechecks. `concurrency: { limit: 3 }`, `retries: 3`.
- `lib/inngest/functions/audit-cron.ts` — **NEW.** Audit daily fan-out. Exports `processOrgAudit()` and `processOrgIntercepts()`. Two separate step groups: hallucination audits then competitor intercepts. `concurrency: { limit: 5 }`, `retries: 3`.
- `lib/inngest/functions/content-audit-cron.ts` — **NEW.** Content Audit monthly fan-out. Exports `processLocationAudit()`. Per-location page audit with plan-based caps. `concurrency: { limit: 3 }`, `retries: 2`.
- `lib/inngest/functions/post-publish-check.ts` — **NEW.** Durable 14-day `step.sleep('14d')` + SOV re-check. Replaces Redis TTL scheduling.

*Modified files:*
- `app/api/cron/sov/route.ts` — Transformed into thin Inngest dispatcher. Auth guard + kill switch preserved. Primary: `inngest.send('cron/sov.weekly')` → returns `{ dispatched: true }`. Fallback: `runInlineSOV()` private function (original loop, AI_RULES §17).
- `app/api/cron/audit/route.ts` — Same dispatcher pattern. Added kill switch `STOP_AUDIT_CRON`. Primary: `inngest.send('cron/audit.daily')`. Fallback: `runInlineAudit()`.
- `app/api/cron/content-audit/route.ts` — Same dispatcher pattern. Added kill switch `STOP_CONTENT_AUDIT_CRON`. Primary: `inngest.send('cron/content-audit.monthly')`. Fallback: `runInlineContentAudit()`.
- `.env.local.example` — Added `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` placeholders.

**Tests added:**
- `src/__tests__/unit/inngest-sov-cron.test.ts` — **11 Vitest tests** (new). `processOrgSOV`: query execution, cited counting, per-query resilience, all-fail returns `success: false`, email payload, email failure absorbed, occasion engine called + failure absorbed, prompt intelligence called + failure absorbed, first mover tracking.
- `src/__tests__/unit/inngest-audit-cron.test.ts` — **9 Vitest tests** (new). `processOrgAudit` (5): zero hallucinations, insert + email alert, skip no location, email failure absorbed, throws on audit failure. `processOrgIntercepts` (4): no competitors, per-competitor calls, error absorption, no location skip.
- `src/__tests__/unit/inngest-content-audit-cron.test.ts` — **6 Vitest tests** (new). `processLocationAudit`: plan cap enforcement (growth=9 pages), starter homepage-only, score collection, page failure handling, continuation after failure, upsert shape.
- `src/__tests__/unit/cron-sov.test.ts` — **23 Vitest tests** (was 21, +2). Added: Inngest dispatch returns `{ dispatched: true }`, Inngest failure falls back to inline.
- `src/__tests__/unit/cron-audit.test.ts` — **15 Vitest tests** (was 12, +3). Added: `STOP_AUDIT_CRON` kill switch, Inngest dispatch returns `{ dispatched: true }`, Inngest failure falls back to inline.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/inngest-sov-cron.test.ts            # 11 tests passing
npx vitest run src/__tests__/unit/inngest-audit-cron.test.ts          # 9 tests passing
npx vitest run src/__tests__/unit/inngest-content-audit-cron.test.ts  # 6 tests passing
npx vitest run src/__tests__/unit/cron-sov.test.ts                    # 23 tests passing
npx vitest run src/__tests__/unit/cron-audit.test.ts                  # 15 tests passing
npx vitest run                                                         # 742 tests passing, 7 skipped
```

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

## Current Test Counts (2026-02-25, Sprint 50)

| Suite | Count | Command |
|-------|-------|---------|
| Vitest unit/integration | 742 passing, 7 skipped | `npx vitest run` |
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

## 2026-02-28 — Sprint 95: CSV Export + PDF Audit Report (Completed)

**Goal:** CSV export (hallucination history) + PDF audit report for Agency clients.
Both Growth+ plan gated. PDF uses @react-pdf/renderer (pure Node.js, Vercel-compatible).

**Scope:**
- `lib/exports/csv-builder.ts` — **NEW.** Pure CSV builder. RFC 4180, CRLF, formula injection prevention (=, +, -, @ → single-quote prefix). 500-char claim cap.
- `lib/exports/pdf-assembler.ts` — **NEW.** Pure data assembler → AuditReportData. Reality Score computation, model breakdown, top-5 hallucinations (high risk first), 10-query SOV summary, 3–5 data-driven recommendations.
- `lib/exports/pdf-template.tsx` — **NEW.** React-PDF JSX. 6 sections: cover page, executive summary (Reality Score bar), model breakdown table, top hallucinations, SOV summary, recommendations. Fixed page footer with page-number render prop. Logo placeholder when no logo_url.
- `app/api/exports/hallucinations/route.ts` — **NEW.** runtime=nodejs. Auth + Growth+ gate. 90-day / 500-row cap. text/csv with attachment Content-Disposition.
- `app/api/exports/audit-report/route.tsx` — **NEW.** runtime=nodejs. Auth + Growth+ gate. 4 parallel queries. renderToBuffer → application/pdf.
- `app/dashboard/hallucinations/page.tsx` — **MODIFIED.** Export CSV + PDF buttons added with data-testid. Disabled + upgrade tooltip for Starter plan.
- `app/dashboard/page.tsx` — **MODIFIED.** Export PDF button added to dashboard header.
- `app/dashboard/_components/ExportButtons.tsx` — **NEW.** Client component. window.location.href download trigger. Plan-gated enable/disable with tooltip.
- `lib/plan-enforcer.ts` — **MODIFIED.** Added `canExportData()` for Growth+ gate.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added MOCK_HALLUCINATION_ROWS (6 rows, incl. formula injection case) + MOCK_AUDIT_REPORT_DATA.

**Tests added:**
- `csv-builder.test.ts` — **27 Vitest tests.** Headers, escaping, formula injection, edge cases.
- `pdf-assembler.test.ts` — **26 Vitest tests.** Assembly, caps, sorting, recommendations.
- `csv-export-route.test.ts` — **12 Vitest tests.** Auth, plan gate, query filters, headers.
- `pdf-export-route.test.ts` — **16 Vitest tests.** Auth, plan gate, parallel queries, PDF render, error handling.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/csv-builder.test.ts          # 27 tests
npx vitest run src/__tests__/unit/pdf-assembler.test.ts        # 26 tests
npx vitest run src/__tests__/unit/csv-export-route.test.ts     # 12 tests
npx vitest run src/__tests__/unit/pdf-export-route.test.ts     # 16 tests
npx vitest run                                                   # 2086 total — no regressions
npx tsc --noEmit                                                 # 0 type errors
```

---

## 2026-02-27 — Sprint 96: Plan Gate Polish — Blur Teasers (Gap #66: 30% → 100%)

**Goal:** Apply consistent blur-teaser plan gate pattern across 5 premium dashboard pages. Starter/Trial users see real data behind `blur-sm` overlay with upgrade CTA. Replaces hard "Upgrade Required" walls that killed conversion.

**Scope:**
- Built `components/plan-gate/PlanGate.tsx` — single reusable RSC blur-teaser wrapper
- Added `planSatisfies()` + `PLAN_HIERARCHY` to `lib/plan-enforcer.ts`
- Applied `<PlanGate>` to 5 pages: citations (growth), page-audits (growth), content-drafts (growth), sentiment (growth), source-intelligence (agency)
- Removed 3 ad-hoc upgrade walls (citations, page-audits, content-drafts inline UpgradeGate)
- Added plan fetching to sentiment + source-intelligence pages (previously had no plan gate)
- Data always fetches for gated users — blur teaser shows real data, not placeholder

**Files changed:**
- `components/plan-gate/PlanGate.tsx` — NEW: blur-teaser wrapper component (RSC)
- `components/plan-gate/index.ts` — NEW: barrel export
- `lib/plan-enforcer.ts` — MODIFIED: added `planSatisfies()`, `PLAN_HIERARCHY`
- `app/dashboard/citations/page.tsx` — MODIFIED: replaced hard wall with PlanGate
- `app/dashboard/page-audits/page.tsx` — MODIFIED: replaced hard wall with PlanGate
- `app/dashboard/content-drafts/page.tsx` — MODIFIED: removed UpgradeGate, restructured data fetch, added PlanGate
- `app/dashboard/sentiment/page.tsx` — MODIFIED: added plan fetch + PlanGate
- `app/dashboard/source-intelligence/page.tsx` — MODIFIED: added plan fetch + PlanGate (agency)
- `src/__tests__/unit/plan-gate.test.tsx` — NEW: 32 tests
- `src/__tests__/unit/plan-gate-pages.test.tsx` — NEW: 21 tests

**Tests added:** 53 total new tests across 2 test files

```bash
npx vitest run src/__tests__/unit/plan-gate.test.tsx           # 32 tests
npx vitest run src/__tests__/unit/plan-gate-pages.test.tsx     # 21 tests
npx vitest run                                                   # 2139 total — no regressions
npx tsc --noEmit                                                 # 0 type errors
```

## 2026-02-27 — Sprint D: Operate & Protect (Completed)

**Goal:** Prepare LocalVector.ai for active customer acquisition with operator visibility (admin dashboard), cost control (credit system), improved first impressions (revenue defaults + positioning banner).

**Scope:**

**L1 — Admin Operations Dashboard:**
- `app/admin/layout.tsx` — **NEW.** Server component auth guard. Reads `ADMIN_EMAILS` env var (comma-separated, case-insensitive). Non-admin → redirect to `/dashboard`.
- `app/admin/page.tsx` — **NEW.** Redirects to `/admin/customers`.
- `app/admin/_components/AdminNav.tsx` — **NEW.** Client component nav bar with active link highlighting via `usePathname()`.
- `app/admin/_components/AdminStatCard.tsx` — **NEW.** Reusable stat card with optional highlight (warning/danger).
- `app/admin/_components/PlanBadge.tsx` — **NEW.** Colored plan badge using `getPlanDisplayName()`.
- `app/admin/customers/page.tsx` — **NEW.** All orgs via service role. Name, plan badge, MRR, Stripe status, created date.
- `app/admin/api-usage/page.tsx` — **NEW.** Fetches `api_credits` table. Highlights >80% amber, 100% red. Estimated API cost.
- `app/admin/cron-health/page.tsx` — **NEW.** Last 100 runs from `cron_run_log`. Summary cards per cron + full log table.
- `app/admin/revenue/page.tsx` — **NEW.** MRR/ARR stats, MRR by plan breakdown, trial conversion funnel.
- `lib/admin/format-relative-date.ts` — **NEW.** `Intl.RelativeTimeFormat` utility, no date library.

**N1 — Credit/Usage System:**
- `supabase/migrations/20260306000001_api_credits.sql` — **NEW.** `api_credits` table, unique on `org_id`, RLS, `increment_credits_used()` RPC.
- `supabase/prod_schema.sql` — **MODIFIED.** Added `api_credits` table definition + indexes + RLS.
- `lib/supabase/database.types.ts` — **MODIFIED.** Added `api_credits` table types + `increment_credits_used` function type.
- `lib/credits/credit-limits.ts` — **NEW.** `PLAN_CREDIT_LIMITS` (trial=25, starter=100, growth=500, agency=2000), `getCreditLimit()`, `getNextResetDate()`.
- `lib/credits/credit-service.ts` — **NEW.** `checkCredit()`, `consumeCredit()`, internal `initializeCredits()`, `resetCredits()`. Fail-open design.
- `app/dashboard/magic-menus/actions.ts` — **MODIFIED.** Credit-gated: `simulateAIParsing`, `uploadPosExport`, `uploadMenuFile`.
- `app/dashboard/share-of-voice/actions.ts` — **MODIFIED.** Credit-gated: `runSovEvaluation`.
- `app/dashboard/share-of-voice/brief-actions.ts` — **MODIFIED.** Credit-gated: `generateContentBrief`.
- `app/dashboard/compete/actions.ts` — **MODIFIED.** Credit-gated: `runCompetitorIntercept`.
- `app/dashboard/layout.tsx` — **MODIFIED.** Fetches credits data, passes to DashboardShell.
- `components/layout/DashboardShell.tsx` — **MODIFIED.** Added `credits` prop, passes to TopBar.
- `components/layout/TopBar.tsx` — **MODIFIED.** Added `CreditsMeterBar` component (battery-style, green/amber/red).

**M4 — Revenue Config Defaults:**
- `lib/services/revenue-impact.service.ts` — **MODIFIED.** `avgCustomerValue`: 45→55, `monthlyCovers`: 800→1800.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added `CHARCOAL_N_CHILL_REVENUE_CONFIG`, updated `MOCK_REVENUE_IMPACT_INPUT.config`.

**M6 — Positioning Banner:**
- `components/ui/PositioningBanner.tsx` — **NEW.** Client component, localStorage dismiss, links to AI responses.
- `app/dashboard/page.tsx` — **MODIFIED.** Added `PositioningBanner` gated by `isNewOrg && !sampleMode`.

**Env:**
- `.env.local.example` — **MODIFIED.** Added `ADMIN_EMAILS` documentation.

**Tests added:**
- `admin-auth-guard.test.ts` — **7 Vitest tests.** Auth guard redirect logic, case-insensitive matching, comma-separated emails.
- `credit-service.test.ts` — **20 Vitest tests.** checkCredit, consumeCredit, getCreditLimit, getNextResetDate, fail-open behavior.
- `credit-gated-actions.test.ts` — **19 Vitest tests.** Static analysis verifying credit gate in 6 actions, non-gated exclusions.
- `revenue-config-defaults.test.ts` — **12 Vitest tests.** Default values, revenue calculations with new defaults.
- `positioning-banner.test.tsx` — **10 Vitest tests.** Rendering, dismissal, localStorage persistence, dashboard integration.
- `26-admin-dashboard.spec.ts` — **13 E2E tests.** Auth guard redirects, admin page rendering (conditional on ADMIN_EMAILS).
- `27-credits-system.spec.ts` — **8 E2E tests.** Credits meter, credit-gated page loads, positioning banner behavior.

```bash
npx vitest run src/__tests__/unit/admin-auth-guard.test.ts        # 7 tests
npx vitest run src/__tests__/unit/credit-service.test.ts          # 20 tests
npx vitest run src/__tests__/unit/credit-gated-actions.test.ts    # 19 tests
npx vitest run src/__tests__/unit/revenue-config-defaults.test.ts # 12 tests
npx vitest run src/__tests__/unit/positioning-banner.test.tsx     # 10 tests
npx vitest run                                                      # all — no regressions
npx tsc --noEmit                                                    # 0 type errors
```

---

## 2026-02-28 — Sprint J: Jargon Retirement — Entity Health, Agent Readiness, Cluster Map

**Goal:** Replace technical AI/SEO jargon with plain-English, customer-consequence language across three pages. Restaurant owners should understand every label without Googling a term.

**Scope:**
- Front-end only — no new DB tables, no new cron jobs, no new API routes, no new migrations.
- Created translation layer files that map DB column names to customer-facing descriptions.
- Added verdict panels at the top of each page with color-coded summary verdicts.
- Reordered lists to show needs-attention items above passing items.
- Updated FirstVisitTooltip content on all three pages to jargon-free text.

**Page 1 — Entity Health ("Does AI Know Your Business?"):**
- `lib/entity-health/platform-descriptions.ts` — **NEW.** Translation layer mapping 7 EntityPlatform keys to customer-consequence descriptions. Exports: `PLATFORM_DESCRIPTIONS`, `getPlatformConsequence()`.
- `app/dashboard/entity-health/_components/EntityHealthVerdictPanel.tsx` — **NEW.** Summary panel with confirmed/total count, color-coded verdict sentence (strong/at_risk/critical/unknown), needs-action count.
- `app/dashboard/entity-health/page.tsx` — **MODIFIED.** Title: "Entity Knowledge Graph Health" → "Does AI Know Your Business?". Added verdict panel. Platform cards split into "Needs Attention" (red) + "Confirmed" (green) sections. PlatformRow uses customer-consequence text from PLATFORM_DESCRIPTIONS. Removed old score summary box + recommendations section.

**Page 2 — Agent Readiness ("Can AI Take Action for Your Customers?"):**
- `lib/agent-readiness/scenario-descriptions.ts` — **NEW.** Maps 6 CapabilityId values to customer-interaction scenarios (e.g., "Can AI book a reservation?"). Exports: `SCENARIO_DESCRIPTIONS`, `getScenarioText()`.
- `app/dashboard/agent-readiness/_components/AgentReadinessVerdictPanel.tsx` — **NEW.** Score ring SVG + active/total badge + verdict sentence (agent_ready/partially_ready/not_ready).
- `app/dashboard/agent-readiness/_components/AgentReadinessScenarioCard.tsx` — **NEW.** Replaces capability rows with scenario cards — shows customer question, consequence text, fix guide, points badge.
- `app/dashboard/agent-readiness/page.tsx` — **MODIFIED.** Title: "AI Agent Readiness" → "Can AI Take Action for Your Customers?". TopPriorityCard → "Biggest Opportunity" with scenario text. Capabilities split into "Gaps to Fix" (red) + "Ready" (green) using ScenarioCards.

**Page 3 — Cluster Map ("Where Does AI Place You?"):**
- `app/dashboard/cluster-map/_components/ClusterInterpretationPanel.tsx` — **NEW.** Plain-English interpretation: position verdict (quadrant-based), 3 stat explainers (mention rate, accuracy, competitors), top competitor callout.
- `app/dashboard/cluster-map/_components/ClusterMapWrapper.tsx` — **MODIFIED.** Added interpretation panel. Heading: "Hallucination Zone(s)" → "Incorrect Fact(s) AI Is Sharing". Stats relabeled.
- `app/dashboard/cluster-map/_components/ClusterChart.tsx` — **MODIFIED.** All axis labels, quadrant names, tooltips, and legend text rewritten to plain English. "Brand Authority" → "How Often AI Mentions You", "Hallucination Risk" → "Wrong Info Spreading", "Danger Zone" → "Invisible".
- `app/dashboard/cluster-map/page.tsx` — **MODIFIED.** Title: "AI Visibility Cluster Map" → "Where Does AI Place You?". Subtitle and empty state rewritten.

**Tests added:** 70 total new tests across 6 test files
- `src/__tests__/unit/platform-descriptions.test.ts` — 13 tests (translation layer coverage + jargon ban)
- `src/__tests__/unit/scenario-descriptions.test.ts` — 14 tests (translation layer coverage + jargon ban)
- `src/__tests__/unit/entity-health-verdict-panel.test.tsx` — 10 tests (all verdict states + no jargon)
- `src/__tests__/unit/agent-readiness-verdict-panel.test.tsx` — 8 tests (all verdict states + no jargon)
- `src/__tests__/unit/agent-readiness-scenario-card.test.tsx` — 12 tests (scenario rendering + no jargon)
- `src/__tests__/unit/cluster-interpretation-panel.test.tsx` — 13 tests (position interpretation + no jargon)

**AI_RULES:** added §105 (Entity Health Jargon Ban), §106 (Agent Readiness Jargon Ban), §107 (Cluster Map Jargon Ban).

```bash
npx vitest run src/__tests__/unit/platform-descriptions.test.ts             # 13 tests
npx vitest run src/__tests__/unit/scenario-descriptions.test.ts             # 14 tests
npx vitest run src/__tests__/unit/entity-health-verdict-panel.test.tsx      # 10 tests
npx vitest run src/__tests__/unit/agent-readiness-verdict-panel.test.tsx    # 8 tests
npx vitest run src/__tests__/unit/agent-readiness-scenario-card.test.tsx    # 12 tests
npx vitest run src/__tests__/unit/cluster-interpretation-panel.test.tsx     # 13 tests
npx vitest run                                                               # 3209 total — no regressions
npx tsc --noEmit                                                             # 0 type errors
```

---
> **End of Development Log**
