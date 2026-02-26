# LocalVector.ai — Comprehensive Codebase Audit Report

**Date:** February 26, 2026
**Repo:** local-vector-v1 (post Sprint 67)
**Scope:** Five-dimension audit (A–E) as requested

---

## Sprint 63–67 Verification (All Clear ✅)

Before the new audit, I confirmed all prior sprint work landed correctly:

| Sprint | Goal | Status |
|--------|------|--------|
| 63 — Database Types | `database.types.ts` expanded from stub to 1,817 lines. `as any` casts reduced from 118 → 4 (all non-Supabase: zodResolver, dietary_tags, toolPart). | ✅ Done |
| 64 — Dashboard Extract | `page.tsx` slimmed from 447 → 118 lines. `lib/data/dashboard.ts` (252 lines) and `lib/utils/dashboard-aggregators.ts` (34 lines) created. | ✅ Done |
| 65 — SOV Precision | Formula clarifications landed in `sov-engine.service.ts`. | ✅ Done |
| 66 — README + package.json | `package.json` name = `local-vector-v1`. README has 0 `create-next-app` references. | ✅ Done |
| 67 — Critical Path Tests | `stripe-webhook.test.ts` (402 lines) and `email-service.test.ts` (226 lines) created. | ✅ Done |
| Middleware | `middleware.ts` re-exports from `proxy.ts`. | ✅ Done |

---

## A — Fresh Codebase Issues

### 🔴 CRITICAL: `ai_audits` Table Is Never Written To

The `ai_audits` table exists in the schema (with columns like `audit_date`, `overall_score`, `summary`) but **no code anywhere inserts into it**. The audit cron (`audit-cron.ts`) writes to `ai_hallucinations` directly and skips `ai_audits` entirely.

**Impact:** The main dashboard reads `ai_audits` for "Last Scan" date (`lib/data/dashboard.ts` line 123). This query always returns `null`, meaning the "Last Scan" indicator is permanently broken for all customers.

**Fix options:** Either (a) the audit cron should INSERT an `ai_audits` row per run as a scan log, or (b) replace the dashboard query with `MAX(detected_at)` from `ai_hallucinations`.

### 🟡 39 `console.log` Statements in Production Code

Scattered across cron routes, onboarding, billing actions, and components. These should either be `console.error`/`console.warn` for operational logs or removed entirely. Logging to `console.log` in serverless functions pollutes Vercel logs with noise.

Notable offenders: `layout.tsx` (onboarding guard debug), `FirstMoverCard.tsx` (click handlers), `billing/actions.ts` (demo mode).

### 🟡 4 Remaining `as any` Casts (Non-Supabase)

- `Chat.tsx:394` — `part as any` for tool results (should type the AI SDK tool part)
- `AddItemModal.tsx:76` — `zodResolver(…) as any` (known react-hook-form/zod compat issue)
- `generateMenuJsonLd.ts:79` — `(item as any).dietary_tags` (DB type mismatch)
- `parseCsvMenu.ts:129` — spread cast (CSV parsing edge case)

### 🟡 8 `: any` Types in Chat.tsx Component Props

The AI assistant's tool result components (`ScoreCard`, `TrendSparkline`, `AlertList`, `CompetitorList`, `ToolResult`) all accept `data: any`. These should be typed against the tool result schemas defined in `lib/tools/visibility-tools.ts`.

### 🟡 `buildReferenceLibrary()` — Dead Export

`prompt-intelligence.service.ts` exports `buildReferenceLibrary()` but it's never imported anywhere in the codebase. Either wire it into the SOV cron or remove it.

### 🟢 Billing Page Unhandled Promise

`billing/page.tsx:331` has `.then(setPlanInfo)` without a `.catch()`. If the Stripe portal call fails, the error is swallowed silently.

### 🟢 Hardcoded Business References (Existing Issue #8)

14 files still contain "Charcoal N Chill" references in placeholders, comments, demo data, and service logic. The citation engine has hardcoded `TRACKED_CATEGORIES` (hookah lounge, restaurant, bar...) and `TRACKED_METROS`. These need to become tenant-derived for true multi-customer SaaS.

---

## B — Potential New Features / Enhancements

Based on the roadmap docs, Gemini brainstorm, and cross-reference analysis, these are the highest-impact items not yet built:

### Near-Term (High ROI, buildable on current architecture)

1. **Cron Dashboard / System Health Page** — The `cron_run_log` table is written to by all 4 crons but has NO dashboard UI. Add an admin/settings panel showing last run times, success/failure status, and hallucination counts per run. Low effort, high operational value.

2. **Content Freshness Alerts** (Roadmap #6) — Track when AI models drop citations due to stale data. You already have `visibility_analytics.citation_rate` trending over time. Add an alert when citation_rate drops >20% between snapshots.

3. **AI Answer Simulation Sandbox** (Roadmap #17) — Pre-flight QA: fire synthetic queries against staged content changes to preview AI answers before publishing. Uses existing `multi-engine-eval.service.ts` infrastructure.

4. **Occasion Calendar Dashboard** — `local_occasions` are generated but only surfaced as a subordinate list on the Content Drafts page. A dedicated calendar view showing upcoming occasions with their peak dates and draft status would be more actionable.

### Medium-Term (New engines needed)

5. **Entity & Knowledge Graph Audit** (Gemini §2A) — Scan Wikidata, DBpedia, Yelp, Google Knowledge Panel for brand entity presence. New engine, but high differentiation.

6. **Voice/Conversational AI Optimization** (Roadmap #16) — Optimize for Siri, Alexa, Google Assistant zero-click voice queries. Requires testing with voice-specific prompt structures.

---

## C — Everything Still Unwired

### Orphaned Schema Tables (In DB, No Code References)

| Table | Columns | Status |
|-------|---------|--------|
| `business_info` | org_id, business_name, address, phone, website_url, hours_data, amenities | **0 code references.** Appears to be a pre-`locations` table that was superseded. Dead schema. |
| `directories` | name, display_name, base_url, is_priority, feeds_ai_models | **0 code references.** Was intended for Listings intelligence (which directories feed AI models). Never wired. |
| `pending_gbp_imports` | org_id, locations_data, account_name, has_more, expires_at | **0 code references.** GBP OAuth import staging table. Phase 8 planned but not built. |
| `visibility_scores` | visibility_score, accuracy_score, data_health_score, reality_score, score_delta | **0 code references.** Appears to be an older scoring table superseded by `visibility_analytics`. Dead schema. |
| `crawler_hits` | org_id, menu_id, bot_type, user_agent, crawled_at | **0 `.from()` calls.** Schema + types exist but nothing reads or writes. Was intended to track AI bot crawls on Magic Menu pages. |

### Uncomputed Columns

| Table.Column | Status |
|--------------|--------|
| `visibility_analytics.sentiment_gap` | Column exists, **never written to** by any engine. Zero code references outside schema/types. |
| `ai_audits.*` (entire table) | **Never written to.** See Critical finding above. |

### Engine Outputs Not Surfaced in Dashboard

| Engine | Writes To | Dashboard Display | Gap |
|--------|-----------|-------------------|-----|
| **Fear Engine** (ai-audit) | `ai_hallucinations` | ✅ Hallucinations page + main dashboard alerts | None — well wired |
| **SOV Engine** | `sov_evaluations`, `visibility_analytics` | ✅ SOV page + main dashboard trend | None |
| **Greed Engine** (competitor-intercept) | `competitor_intercepts` | ✅ Compete page + main dashboard count | None |
| **Citation Engine** | `citation_source_intelligence` | ✅ Citations page | None |
| **Occasion Engine** | `local_occasions`, `content_drafts` | ⚠️ Only shown as sub-list on Content Drafts page | **No dedicated Occasion view** |
| **Truth Audit** | Computed in-memory | ✅ Hallucinations page (Truth Score composite) | None |
| **Page Auditor** | `page_audits` | ✅ Page Audits page | None |
| **Revenue Leak** | `revenue_snapshots`, `revenue_config` | ✅ Main dashboard Revenue Leak card | None |
| **Prompt Intelligence** | Reads `sov_evaluations` + `target_queries` | ✅ SOV page (gaps, category breakdown) | `buildReferenceLibrary()` never called |
| **Cron Logger** | `cron_run_log` | ❌ **Not surfaced anywhere** | **No system health UI** |
| **Autopilot** (create-draft, publish, score) | `content_drafts` | ✅ Content Drafts page | GBP publish requires OAuth (Phase 8) |
| **Crawler Tracking** | `crawler_hits` (schema only) | ❌ **Not implemented** | Middleware needs to record bot hits |

### Sidebar Navigation vs Available Features

The sidebar has 10 items. All pages are functional. Missing sidebar entries that could exist:

- **System Health** — `cron_run_log` data (admin only)
- **Occasions** — dedicated view instead of nested in Content Drafts
- **AI Assistant** — exists at `/dashboard/ai-assistant` but **NOT in the sidebar navigation** (users can only reach it by URL)

---

## D — What Data Each Engine Collects vs. What's Displayed

### Complete Data Flow Map

```
CRON TRIGGERS (vercel.json)
├── /api/cron/audit (daily 3AM) → Inngest fan-out
│   ├── Fear Engine → ai_hallucinations (claim, severity, category, model, truth)
│   ├── Greed Engine → competitor_intercepts (winner, gap, action, magnitude)
│   └── Revenue Leak → revenue_snapshots (monthly_leak, opportunity)
│
├── /api/cron/sov (daily 4AM) → Inngest fan-out
│   ├── SOV Engine → sov_evaluations (rank, competitors, raw_response)
│   ├── SOV Engine → visibility_analytics (share_of_voice, citation_rate)
│   ├── Prompt Intelligence → detects query gaps (computed, not stored)
│   ├── Occasion Engine → local_occasions + content_drafts (auto-generated)
│   └── First Mover → content_drafts (auto-generated for unclaimed queries)
│
├── /api/cron/citation (weekly) → inline
│   └── Citation Engine → citation_source_intelligence (platform, frequency, tier)
│
└── /api/cron/content-audit (monthly) → Inngest fan-out
    └── Page Auditor → page_audits (AEO scores × 5 dimensions)
```

### What's Collected but NOT Displayed

| Data Point | Collected? | Displayed? | Notes |
|------------|-----------|------------|-------|
| SOV per-query raw AI response | ✅ `sov_evaluations.raw_response` | ❌ Not shown | Raw response text stored but never rendered. Could show "what the AI actually said." |
| Competitor mentioned_competitors (per query) | ✅ `sov_evaluations.mentioned_competitors` | ⚠️ Partially (Compete page shows intercepts, not per-query mentions) | Individual query-level competitor mentions aren't aggregated into a "who appears most" leaderboard. |
| Citation query prompts used | ✅ `citation_source_intelligence.prompt_used` | ❌ Not shown | Users can't see what prompts were tested. |
| Page audit per-dimension scores | ✅ `page_audits` (5 scores) | ⚠️ Only `overall_score` shown | Individual dimension scores (answer_first, schema_completeness, faq_schema, keyword_density, entity_clarity) exist but the Page Audits page only shows the composite. |
| Competitor `action_status` tracking | ✅ `competitor_intercepts.action_status` | ⚠️ Shown but no workflow | Field is displayed but there's no UI to mark actions as "completed" or track progress. |
| `sentiment_gap` | ❌ Column exists, never computed | ❌ | Dead column in `visibility_analytics`. |
| Crawler bot hits | ❌ Schema exists, no code | ❌ | `crawler_hits` table ready but no middleware logging. |
| AI audit scan history | ❌ `ai_audits` never written | ❌ | Dashboard shows "Last Scan: never" for everyone. |

---

## E — AIO/AEO/GEO Engines to Add

Ranked by **paying user value** (what makes a restaurant owner renew their subscription):

### Tier 1: High-Impact, Buildable Now

#### 1. 🏆 Entity Salience Monitor (NEW ENGINE)
**What:** Scan how strongly the brand exists as a recognized "entity" across knowledge graphs (Wikidata, Google Knowledge Panel, Yelp, TripAdvisor, Apple Maps).
**Why users pay:** Most restaurant owners have NO idea they don't exist as an "entity" in AI knowledge bases. This is the #1 reason AI hallucinates about them. Showing them "You're invisible in 3/5 knowledge graphs" is a powerful fear trigger.
**Implementation:** New service that queries public APIs/structured data endpoints. Store results in a new `entity_presence` table. Surface as a "Knowledge Graph Health" card on the dashboard.
**Difficulty:** Medium (API integration, no AI calls needed for basic version)

#### 2. 🏆 AI Answer Replay Engine (Enhancement to SOV)
**What:** Instead of just checking "were you mentioned?", store and display the FULL AI-generated answer for each query. Show users exactly what ChatGPT/Perplexity says when someone asks "best hookah lounge near Alpharetta."
**Why users pay:** Seeing the exact words AI uses about their business (or their competitor) is viscerally motivating. It makes the abstract "AI visibility" concept concrete and shareable.
**Implementation:** You already store `sov_evaluations.raw_response`. Just build a UI to display it. Add a "Response Library" or "AI Says" page.
**Difficulty:** Low (UI only, data already collected)

#### 3. 🏆 Content Freshness Decay Detector (Enhancement to Citation Engine)
**What:** Track citation_rate trend over time. Alert when citations drop, indicating AI models have deprioritized the business due to stale content.
**Why users pay:** Creates urgency to keep content fresh. Directly ties to the Autopilot publish workflow — "your citations dropped 30%, here's a content refresh draft."
**Implementation:** Compare last 3 `visibility_analytics` snapshots. Trigger email + in-app alert on >20% decline.
**Difficulty:** Low (analytics on existing data)

#### 4. Voice Query Optimization Scanner
**What:** Test how voice assistants (Siri, Alexa, Google Assistant) answer queries about the business. Voice queries return ONE answer — if it's not you, you're invisible.
**Why users pay:** Voice search is growing fast for "near me" queries. Being the single voice answer is worth more than being #3 in a text list.
**Implementation:** New engine using text-to-speech-style prompts (short, conversational queries) against existing AI providers. Store results alongside SOV evaluations with `engine: 'voice-*'` tag.
**Difficulty:** Medium (new query templates, same infrastructure)

### Tier 2: Differentiation Features

#### 5. Review Response Generator (Roadmap #13)
**What:** AI-drafted replies to Google/Yelp reviews that silently reinforce entity keywords and correct misinformation.
**Why users pay:** Saves time AND improves AI visibility in one action. Reviews are a major signal for AI knowledge graphs.
**Implementation:** New service that takes review text + location data, generates SEO-optimized response. Requires Google OAuth (Phase 8) for direct posting.
**Difficulty:** Medium-High (needs Google OAuth)

#### 6. Schema.org Completeness Grader (Enhancement to Page Auditor)
**What:** Deep audit of JSON-LD on the business website. Check for `Restaurant`, `Menu`, `MenuItem`, `FAQPage`, `LocalBusiness`, `Event`, `Review`, `AggregateRating`, `OpeningHoursSpecification` — and grade completeness with specific fix instructions.
**Why users pay:** Schema markup directly influences AI citation probability. Showing "you're missing 4 schema types that your competitor has" drives action.
**Implementation:** Extend existing page auditor's `schemaCompletenessScore` dimension into a dedicated deep view.
**Difficulty:** Low (extends existing engine)

#### 7. Competitive Prompt Hijacking Alerts (Roadmap #10)
**What:** Detect when a competitor has optimized content to intercept prompts that SHOULD surface your business.
**Why users pay:** "Your competitor is stealing your AI traffic" is an extremely compelling alert.
**Implementation:** Extend Greed Engine to run targeted queries where you SHOULD appear but don't, and identify which competitor does. You partially have this with First Mover alerts but it doesn't track competitor takeover.
**Difficulty:** Medium (new analysis layer on existing intercept data)

### Tier 3: Future Premium (Agency/Enterprise)

#### 8. Agentic Commerce Readiness Score (Roadmap #19)
**What:** Can an AI booking agent (OpenAI Operator, Google Jarvis) successfully complete a transaction on your website?
**Why users pay:** Forward-looking "are you ready for the AI agent era?" — premium positioning.

#### 9. Predictive Citation Probability (Roadmap #20)
**What:** ML model that predicts which specific content changes will produce citation gains.
**Why users pay:** "We predict that adding FAQ schema will increase your citations by 23%."

#### 10. Multi-Location Rollup Dashboard (Agency tier)
**What:** Aggregate SOV, hallucinations, and revenue leak across all locations for agency clients managing 10+ restaurants.
**Why users pay:** Agency clients managing multiple locations need portfolio-level views.

---

## Summary: Recommended Sprint 68 Priorities

Based on this audit, the highest-impact Sprint 68 candidates are:

| Priority | Item | Type | Effort |
|----------|------|------|--------|
| **P0** | Fix `ai_audits` never-written bug (Last Scan always null) | Bug fix | Small |
| **P0** | Add AI Assistant to sidebar navigation | Bug fix | Tiny |
| **P1** | Build "AI Says" / Response Library UI (raw_response display) | New page | Medium |
| **P1** | Build System Health / Cron Dashboard page | New page | Medium |
| **P1** | Surface page audit per-dimension scores | Enhancement | Small |
| **P2** | Clean up 39 console.logs | Hygiene | Small |
| **P2** | Remove 5 orphaned schema tables | Hygiene | Small |
| **P2** | Build Entity Salience Monitor (new engine) | New engine | Large |
| **P3** | Wire crawler_hits middleware logging | New feature | Medium |
| **P3** | Content Freshness Decay alerts | Enhancement | Small |
