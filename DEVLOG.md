# LocalVector.ai — Development Log

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
## 2026-02-25 — Sprint 47: Prompt Intelligence Service (Completed)

**Goal:** Build the Prompt Intelligence Service — a strategic layer on top of the SOV Engine that detects 3 types of gaps in a tenant's query library (untracked, competitor-discovered, zero-citation clusters) and surfaces actionable gaps in the dashboard and email reports.

**Spec:** `docs/15-LOCAL-PROMPT-INTELLIGENCE.md`

**Scope:**
- `lib/types/prompt-intelligence.ts` — **NEW.** TypeScript interfaces: `QueryGap`, `ReferenceQuery`, `CategoryBreakdown`, `PromptGapReport`, enums `GapType`, `GapImpact`, `QueryCategory`.
- `lib/services/prompt-intelligence.service.ts` — **NEW.** Pure service (~200 lines). Exports: `buildReferenceLibrary()` (generates reference query set from `sov-seed.ts` templates for location's category+city+state+competitors), `detectQueryGaps()` (3 gap detection algorithms: untracked reference queries, competitor-discovered queries from `competitor_intercepts`, zero-citation clusters from `sov_evaluations`), `computeCategoryBreakdown()` (pure function: groups queries by category, computes citation rate per category from latest evaluations).
- `app/api/v1/sov/gaps/route.ts` — **NEW.** `GET /api/v1/sov/gaps?location_id=uuid`. Auth-gated via `getSafeAuthContext()`, org isolation verified. Returns gap list with `gapType`, `queryText`, `queryCategory`, `estimatedImpact`, `suggestedAction`.
- `app/api/cron/sov/route.ts` — Added Prompt Intelligence sub-step (§9) after Occasion Engine. Calls `detectQueryGaps()` per-org, auto-creates `prompt_missing` content drafts for `zero_citation_cluster` gaps (Growth+ only via `canRunAutopilot`). Added `gaps_detected` to cron summary JSON. Non-critical: failures never abort the SOV cron.
- `lib/services/sov-seed.ts` — Exported template functions (`discoveryQueries`, `nearMeQueries`, `occasionQueries`, `comparisonQueries`, `isHospitalityCategory`, `HOSPITALITY_CATEGORIES`, `CompetitorForSeed`) for reuse by the reference library builder. No logic changes.
- `docs/05-API-CONTRACT.md` — Added `GET /sov/gaps` endpoint (§12). Version bumped to 2.6.

**Key design decisions:**
- Pure service pattern — `prompt-intelligence.service.ts` never creates its own Supabase client (caller passes one).
- No AI calls — gap detection is pure data comparison (reference library vs active queries vs intercept data vs evaluation results).
- Reuses `sov-seed.ts` template functions (exported, not duplicated) for reference library generation.
- Gap cap: max 10 per run to prevent alert fatigue (Doc 15 §3.1).
- Zero-citation cluster threshold: 3+ queries with 2+ evaluations each, all null `rank_position`.
- `canRunAutopilot(plan)` gates auto-creation of `prompt_missing` content drafts (Growth+ only).

**Tests added:**
- `src/__tests__/unit/prompt-intelligence-service.test.ts` — **16 Vitest tests** (new). buildReferenceLibrary (4: hospitality full tiers, non-hospitality skips occasion, not-found empty, max 3 competitors). detectQueryGaps (8: untracked gaps, high-impact scoring, competitor-discovered, already-tracked filter, zero-citation cluster, fewer-than-3 no cluster, under-2-evals excluded, gap cap at 10, competitor dedup). computeCategoryBreakdown (3: citation rate per category, latest evaluation used, empty inputs).
- `src/__tests__/unit/cron-sov.test.ts` — **16 Vitest tests** (was 13). Three new: `detectQueryGaps` called after `writeSOVResults`, `gaps_detected` in summary response, prompt intelligence failure doesn't crash cron.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/prompt-intelligence-service.test.ts  # 16 tests passing
npx vitest run src/__tests__/unit/cron-sov.test.ts                     # 16 tests passing
npx vitest run                                                          # 637 tests passing, 7 skipped
```

---
## 2026-02-24 — Sprint 42: Dashboard Polish & Content Drafts UI

**Goal:** Close 5 remaining gaps across the dashboard: null states, content drafts UI, SOV query editor, listings health, and E2E test coverage. Fine-tuning sprint — no schema migrations.

### Step 1: Dashboard Null States & UX Clarity
- **SOVScoreRing** (`SOVScoreRing.tsx`): Replaced hardcoded "Check back Monday" with dynamic `nextSundayLabel()` from `scan-health-utils.ts` for consistent null-state copy across all pages.
- **SOV page** (`share-of-voice/page.tsx`): "Last Scan" null state now shows "Runs Sunday, {date}" instead of "No scans yet".
- **Main dashboard** (`dashboard/page.tsx`): Added welcome banner for day-1 tenants (realityScore null + 0 alerts) with dynamic Sunday date.
- **Tests:** 5 new tests (`dashboard-null-states.test.tsx`) — SOV copy, welcome banner visibility/hiding.

### Step 2: Content Drafts UI (New Feature)
- **Sidebar** (`Sidebar.tsx`): Added "Content" nav item with FileText icon between Share of Voice and Compete.
- **Server Actions** (`content-drafts/actions.ts`): `approveDraft`, `rejectDraft`, `createManualDraft` — auth + Zod validation + RLS + plan gating via `canRunAutopilot()`.
- **Page** (`content-drafts/page.tsx`): Server Component with summary strip (pending/approved/total), filter tabs, draft cards, UpgradeGate for trial/starter.
- **ContentDraftCard** (`_components/ContentDraftCard.tsx`): Client Component with trigger badges (first_mover=amber, competitor_gap=crimson, occasion=blue, manual=slate), AEO score, status badges, approve/reject buttons with `useTransition()`.
- **DraftFilterTabs** (`_components/DraftFilterTabs.tsx`): Client Component using URL search params for status filtering.
- **Tests:** 15 component tests + 13 action tests covering all badge colors, AEO thresholds, plan gating, Zod validation.

### Step 3: SOV Query Editor Enhancements
- **Delete action** (`share-of-voice/actions.ts`): Added `deleteTargetQuery()` with Zod UUID validation and RLS-scoped delete.
- **SovCard** (`SovCard.tsx`): Added trash icon delete button with `window.confirm()`, `useTransition()` pending state. Added plan prop to gate "Run" button — disabled for trial/starter with tooltip "Upgrade to Growth".
- **SOV page** (`share-of-voice/page.tsx`): Fetches org plan from `organizations` table and passes to SovCard.
- **Tests:** 4 new deleteTargetQuery tests added to existing `share-of-voice-actions.test.ts`.

### Step 4: Listings Health Indicators
- **Health utilities** (`integrations/_utils/health.ts`): `getListingHealth()` returns disconnected/missing_url/stale/healthy. `healthBadge()` returns literal Tailwind classes.
- **PlatformRow** (`PlatformRow.tsx`): Added health badge (shown only for stale/missing_url states — healthy and disconnected are already communicated by the status chip).
- **Integrations page** (`integrations/page.tsx`): Added health summary cards (Healthy count, Needs Attention count) to the summary strip.
- **Tests:** 12 tests covering all health states, edge cases (7-day boundary), badge classes.

### Step 5: E2E Test Coverage
- **`06-share-of-voice.spec.ts`**: 4 tests — page structure, SOV ring, Quick Stats, sidebar nav.
- **`07-listings.spec.ts`**: 4 tests — header, summary strip, platform rows (all 6), sidebar nav.
- **`08-content-drafts.spec.ts`**: 3 tests — UpgradeGate for trial, sidebar nav, billing link.

### Files Modified

| # | File | Change |
|---|------|--------|
| 1 | `app/dashboard/page.tsx` | Welcome banner for day-1 tenants |
| 2 | `app/dashboard/share-of-voice/_components/SOVScoreRing.tsx` | Dynamic `nextSundayLabel()` null copy |
| 3 | `app/dashboard/share-of-voice/page.tsx` | Plan fetch, "Last Scan" copy fix |
| 4 | `app/dashboard/share-of-voice/actions.ts` | `deleteTargetQuery` action |
| 5 | `app/dashboard/share-of-voice/_components/SovCard.tsx` | Delete button, plan-gated run |
| 6 | `components/layout/Sidebar.tsx` | "Content" nav item |
| 7 | `app/dashboard/content-drafts/page.tsx` | NEW: Content Drafts page |
| 8 | `app/dashboard/content-drafts/actions.ts` | NEW: Server Actions |
| 9 | `app/dashboard/content-drafts/_components/ContentDraftCard.tsx` | NEW: Draft card |
| 10 | `app/dashboard/content-drafts/_components/DraftFilterTabs.tsx` | NEW: Filter tabs |
| 11 | `app/dashboard/integrations/_utils/health.ts` | NEW: Health utils |
| 12 | `app/dashboard/integrations/_components/PlatformRow.tsx` | Health badge |
| 13 | `app/dashboard/integrations/page.tsx` | Health summary stats |
| 14 | `src/__tests__/unit/components/dashboard-null-states.test.tsx` | NEW: 5 tests |
| 15 | `src/__tests__/unit/components/sov/SOVScoreRing.test.tsx` | Updated null copy assertion |
| 16 | `src/__tests__/unit/components/content-drafts/ContentDraftCard.test.tsx` | NEW: 15 tests |
| 17 | `src/__tests__/unit/content-drafts-actions.test.ts` | NEW: 13 tests |
| 18 | `src/__tests__/unit/share-of-voice-actions.test.ts` | +4 delete tests |
| 19 | `src/__tests__/unit/integrations-health.test.ts` | NEW: 12 tests |
| 20 | `tests/e2e/06-share-of-voice.spec.ts` | NEW: 4 E2E tests |
| 21 | `tests/e2e/07-listings.spec.ts` | NEW: 4 E2E tests |
| 22 | `tests/e2e/08-content-drafts.spec.ts` | NEW: 3 E2E tests |

**Build:** Clean (`next build`, 0 type errors)
**Tests:** 473 passing (+49 from Sprint 41 baseline 424), 1 pre-existing failure (rls-isolation, requires live Supabase)

---
## 2026-02-24 — Sprint 41: SOV Visibility Page Enhancement + Seeding

**Goal:** Enhance the Share of Voice page to match Doc 06 §8 spec, wire SOV query seeding into onboarding, and fix a silent cron failure. Design + data wiring sprint — no schema migrations.

### Bug Fix: SOV Cron Silent Failure
**File:** `lib/services/sov-engine.service.ts`
**Bug:** `writeSOVResults()` tried to `.update({ updated_at })` on `target_queries`, but the table has no `updated_at` column — silently failing every cron run.
**Fix:** Removed the dead write entirely. `sov_evaluations.created_at` already timestamps each run.

### Wire seedSOVQueries into Onboarding
**File:** `app/onboarding/actions.ts`
**What changed:** After `saveGroundTruth()` successfully updates a location, we now call `seedSOVQueries()` to generate 12-15 system-default SOV queries (Doc 04c §3.1). Previously `seedSOVQueries` was defined but never called — new tenants got zero queries seeded.
**Pattern:** Best-effort try/catch — seeding failure doesn't break onboarding. Full location fetch (city, state, categories) → `seedSOVQueries(location, [], supabase)`.

### New Components
1. **`SOVScoreRing`** (`app/dashboard/share-of-voice/_components/SOVScoreRing.tsx`)
   - Server Component showing aggregate SOV percentage as a circular ring
   - Color thresholds: green >= 40%, amber 20-39%, crimson < 20%
   - Citation rate metric + week-over-week delta arrow
   - Null state: "Your first AI visibility scan runs Sunday. Check back Monday."
   - Ring pattern adapted from `RealityScoreCard`'s `ScoreGauge`

2. **`FirstMoverCard`** (`app/dashboard/share-of-voice/_components/FirstMoverCard.tsx`)
   - Client Component for First Mover opportunity alerts
   - Data source: `content_drafts` with `trigger_type = 'first_mover'`
   - Rocket icon, quoted query text, date, Create Content + Dismiss buttons

### Enhanced Share of Voice Page
**File:** `app/dashboard/share-of-voice/page.tsx`
**Layout (4 sections):**
1. SOVScoreRing + Quick Stats (queries tracked, locations, last scan, first mover count)
2. SOVTrendChart (reused from dashboard, last 12 weeks)
3. First Mover Opportunities (from `content_drafts`)
4. Query Library (existing per-location SovCards)

**Data sources added:** `visibility_analytics` (org-scoped, last 12 snapshots), `content_drafts` (trigger_type = 'first_mover', status = 'draft').
**SOV math:** `share_of_voice` stored as 0.0-1.0 float; page multiplies by 100 for display.

### Bug Fix: Integrations Page PostgREST Ambiguous Join
**File:** `app/dashboard/integrations/page.tsx`
**Bug:** `[integrations] fetch error: {}` — the embedded resource query `location_integrations(...)` failed silently because PostgREST found two FKs between `locations` and `location_integrations`:
1. `location_integrations.location_id → locations.id` (the one we want)
2. `locations.gbp_integration_id → location_integrations.id` (reverse direction)

**Fix:** Added explicit FK hint `!location_integrations_location_id_fkey` to the `.select()` string, telling PostgREST which FK to use for the join.

### Schema Sync: prod_schema.sql
**File:** `supabase/prod_schema.sql`
**What:** Added `listing_url TEXT` column to `location_integrations` CREATE TABLE. The column was already added via migration `20260224000003_listing_url_column.sql` but the schema dump was stale and missing it.

### Files Modified

| # | File | Change |
|---|------|--------|
| 1 | `lib/services/sov-engine.service.ts` | Bug fix: remove dead `updated_at` write |
| 2 | `app/onboarding/actions.ts` | Wire `seedSOVQueries()` after ground truth save |
| 3 | `app/dashboard/share-of-voice/_components/SOVScoreRing.tsx` | NEW: Aggregate score ring |
| 4 | `app/dashboard/share-of-voice/_components/FirstMoverCard.tsx` | NEW: First Mover card |
| 5 | `app/dashboard/share-of-voice/page.tsx` | Enhanced: 4-section layout |
| 6 | `src/__tests__/unit/components/sov/SOVScoreRing.test.tsx` | NEW: 10 tests |
| 7 | `src/__tests__/unit/components/sov/FirstMoverCard.test.tsx` | NEW: 8 tests |
| 8 | `src/__tests__/integration/onboarding-actions.test.ts` | Enhanced: +4 seeding tests |
| 9 | `app/dashboard/integrations/page.tsx` | Bug fix: FK hint for ambiguous PostgREST join |
| 10 | `supabase/prod_schema.sql` | Schema sync: add `listing_url` to `location_integrations` |

**Build:** Clean (`next build`, 0 type errors)
**Tests:** 424 passing (+22 from baseline 402), 1 pre-existing failure (rls-isolation, requires live Supabase)

---
## 2026-02-24 — Surgical Integration: 6 Vercel/Next.js Template Upgrades

**Context:** Research identified 6 high-value Vercel template patterns missing from the LocalVector codebase. Rather than rebuilding, we surgically integrated each into the existing Next.js 16 + Supabase architecture. All 6 completed in a single session. Build clean, 402 tests passing, zero regressions.

---

### Surgery 1: AI SDK Swap (Vercel AI SDK v4)
**Template source:** `ai-chatbot` / `ai-sdk-preview-tool-use`
**What changed:** Replaced raw `fetch()` calls to OpenAI/Perplexity with Vercel AI SDK `generateText()` wrapper.
**Files modified (6):**
- `lib/services/ai-audit.service.ts` — `generateText()` with openai provider
- `lib/services/competitor-intercept.service.ts` — `generateText()` with openai provider
- `lib/services/sov.service.ts` — `generateText()` with Perplexity custom provider
- `lib/services/content-audit.service.ts` — `generateText()` with openai provider
- `lib/services/page-auditor.service.ts` — `generateText()` with openai provider
- `app/api/cron/audit/route.ts` — minor import adjustment

**Dependencies added:** `ai@^4.3`, `@ai-sdk/openai@^1.3`
**Tests:** 355 passing (6 modified, 0 new)
**Why:** Unified LLM interface, streaming support, structured output parsing, provider abstraction. Eliminates 4 separate `fetch()` → JSON.parse() patterns.

---

### Surgery 2: SOV Engine Cron
**Template source:** `cron-job` pattern
**What changed:** Built the weekly Share-of-Voice cron job that populates `visibility_analytics` with real data, replacing the hardcoded `visibility = 98`.
**Files created (6):**
- `lib/services/sov.service.ts` (~200 lines) — SOV query runner + result writer
- `app/api/cron/sov/route.ts` (~80 lines) — Cron endpoint with CRON_SECRET auth
- `lib/services/sov-seed.service.ts` (~120 lines) — Seed SOV queries per location
- `lib/services/sov-email.service.ts` (~100 lines) — Weekly SOV report email
- `src/__tests__/unit/sov-service.test.ts` — 12 tests
- `src/__tests__/unit/sov-cron.test.ts` — 8 tests

**Route:** `GET /api/cron/sov` (Vercel Cron, Sunday 2AM EST)
**Tests:** 374 passing (+19 new, +1 pre-existing RLS test failure)
**Spec ref:** Doc 04c (SOV Engine Specification)

---

### Surgery 3: Content Crawler + Page Auditor
**Template source:** Content analysis patterns
**What changed:** Built HTML content parser and page AEO auditor for scoring tenant websites.
**Files created (6):**
- `lib/services/content-crawler.service.ts` (~180 lines) — HTML parser, heading/schema extraction
- `lib/services/page-auditor.service.ts` (~200 lines) — AEO scoring (answer-first, schema, keyword density)
- `app/api/cron/content-audit/route.ts` (~80 lines) — Content audit cron endpoint
- `src/__tests__/unit/content-crawler.test.ts` — 8 tests
- `src/__tests__/unit/page-auditor.test.ts` — 7 tests

**Route:** `GET /api/cron/content-audit`
**Tests:** 389 passing (+15 new)
**Spec ref:** Doc 17 (Content Grader)

---

### Surgery 4: Dashboard Charts (recharts)
**Template source:** `admin-dashboard` chart patterns
**What changed:** Added 4 data visualization components to the main dashboard.
**Files created (5):**
- `app/dashboard/_components/SOVTrendChart.tsx` — Line chart (SOV % over time)
- `app/dashboard/_components/MetricCard.tsx` — Stat card with delta indicator
- `app/dashboard/_components/HallucinationsByModel.tsx` — Bar chart (hallucinations by AI model)
- `app/dashboard/_components/CompetitorComparison.tsx` — Bar chart (our SOV vs competitors)
- `app/dashboard/page.tsx` — Enhanced with chart grid layout

**Dependencies added:** `recharts@^2.15.3`
**React 19 note:** recharts defaultProps warning logged but non-breaking. React 19 compatible.
**Tests:** 389 passing (no new tests — UI components)

---

### Surgery 5: MCP Server (Model Context Protocol)
**Template source:** `mcp-server` Vercel template
**What changed:** Exposed LocalVector data as AI-callable tools via MCP protocol.
**Files created (3):**
- `lib/mcp/tools.ts` (~268 lines) — 4 MCP tools: `get_visibility_score`, `get_sov_report`, `get_hallucinations`, `get_competitor_analysis`. Uses Zod v3 compat layer (`zod/v3`) because MCP SDK requires Zod v3 while project uses Zod v4.
- `app/api/mcp/[transport]/route.ts` (~42 lines) — Streamable HTTP transport endpoint
- `src/__tests__/unit/mcp-tools.test.ts` (~134 lines) — 9 tests

**Dependencies added:** `mcp-handler@^1.0.7`, `@modelcontextprotocol/sdk@^1.25.2`
**Route:** `/api/mcp/[transport]` (GET, POST, DELETE)
**MCP client config:**
```json
{ "mcpServers": { "localvector": { "url": "https://app.localvector.ai/api/mcp/mcp" } } }
```
**Tests:** 397 passing (+8 new)
**Zod compatibility note:** MCP SDK requires Zod v3. Project uses Zod v4 which exports a v3 compat layer at `zod/v3`. All MCP tool schemas import from `zod/v3`; all other code continues using `zod` (v4).

---

### Surgery 6: Generative UI Chat Assistant
**Template source:** `ai-chatbot` + Generative UI patterns
**What changed:** Built AI assistant dashboard page with streaming chat and rich tool-result UI cards.
**Files created (5):**
- `lib/tools/visibility-tools.ts` (~186 lines) — AI SDK tool definitions for chat context. `makeVisibilityTools(orgId)` returns 4 tools with Zod schemas.
- `app/api/chat/route.ts` (~58 lines) — Streaming chat endpoint. Auth guard → org-scoped tools → `streamText()` with GPT-4o.
- `app/dashboard/ai-assistant/_components/Chat.tsx` (~318 lines) — Client component with `useChat()`. Tool result cards: ScoreCard, TrendList, AlertList, CompetitorList. Dark theme, starter prompts, auto-scroll.
- `app/dashboard/ai-assistant/page.tsx` (~26 lines) — Server component page wrapper with auth guard.
- `src/__tests__/unit/visibility-tools.test.ts` (~120 lines) — 5 tests

**Routes:** `POST /api/chat`, `/dashboard/ai-assistant`
**AI SDK v4 type note:** `ToolInvocationUIPart` changed in AI SDK v4 — `part.state` no longer exists. Use `'result' in part` for runtime check. Cast to `any` for `toolName` access.
**Tests:** 402 passing (+5 new)

---

### Summary

| Surgery | What | Files | Lines | Tests |
|---------|------|-------|-------|-------|
| 1 | AI SDK Swap | 6 modified | ~150 | 355 |
| 2 | SOV Engine Cron | 6 new | ~880 | 374 |
| 3 | Content Crawler | 6 new | ~780 | 389 |
| 4 | Dashboard Charts | 5 new | ~500 | 389 |
| 5 | MCP Server | 3 new | ~444 | 397 |
| 6 | Generative UI | 5 new | ~708 | 402 |
| **Total** | | **5 modified + 31 new** | **~3,462** | **402** |

**New dependencies:** `ai`, `@ai-sdk/openai`, `@ai-sdk/react`, `recharts`, `mcp-handler`, `@modelcontextprotocol/sdk`

**New routes:**
- `GET /api/cron/sov` — Weekly SOV scan
- `GET /api/cron/content-audit` — Content audit scan
- `GET|POST|DELETE /api/mcp/[transport]` — MCP server
- `POST /api/chat` — AI assistant streaming
- `/dashboard/ai-assistant` — Chat UI page

**Build status:** Clean (Next.js 16.1.6 Turbopack). TypeScript strict mode passing.
**Test status:** 402 passing, 1 pre-existing failure (`rls-isolation.test.ts` — requires live Supabase).

---

### Known Issues / Follow-ups
1. **recharts React 19 warning:** `defaultProps` deprecation warning at runtime. Non-blocking. Will resolve when recharts ships React 19 native support.
2. **MCP Zod v3/v4 split:** If upgrading Zod in the future, verify `zod/v3` compat layer still works for MCP SDK.
3. **AI SDK v4 types:** `ToolInvocationUIPart` type is narrower than expected. Chat.tsx uses `as any` cast. Monitor for SDK updates that expose `toolName` properly.
4. **SOV cron needs Vercel Cron config:** Add to `vercel.json`:
   ```json
   { "crons": [{ "path": "/api/cron/sov", "schedule": "0 7 * * 0" }] }
   ```
5. **Content audit cron needs Vercel Cron config:** Similar to above.

## 2026-02-24 — Sprint 40: Design System Skinning — All Pages

**Goal:** Skin every page in the application to match the design system established in Sprint 37 (landing) and Sprint 39 (scan results). Design elements only — no business logic, data flow, or form validation changes.

### Strategy: Two high-leverage global changes first

**Token remap (`globals.css`)** — Updated `@theme` color tokens so every existing Tailwind class automatically picks up design system colors:
- `--color-midnight-slate`: `#0f111a` → `#050A15` (navy)
- `--color-surface-dark`: `#1a1d27` → `#0A1628` (navyLight)
- `--background`: `#0f111a` → `#050A15`
- `--foreground`: `#cbd5e1` → `#F1F5F9`
- Font variables: `--font-geist-sans` → `--font-outfit`, `--font-geist-mono` → `--font-jetbrains-mono`

**Root layout font swap (`layout.tsx`)** — Replaced Geist + Geist_Mono with Outfit + JetBrains_Mono in the root layout, making design system fonts available to every page. Removed duplicate font loading from `app/page.tsx` and `app/scan/page.tsx`.

### Auth pages (login + register)
Full dark theme conversion — right panel `bg-slate-50` → `bg-surface-dark`, card `bg-white` → dark card with `border-white/5`, inputs with dark backgrounds, submit button `bg-indigo-600` → `lv-btn-green`, all link colors indigo → signal-green, SVG logo matching design system branding.

### Public pages (pricing, privacy, terms)
- Pricing: `electric-indigo` → `signal-green` for all accent colors (borders, backgrounds, text, shadows), `font-mono` on price numbers, highlighted tier CTA with `text-deep-navy`
- Privacy + Terms: `text-electric-indigo` → `text-signal-green` on all links

### Onboarding
- Page + TruthCalibrationForm: All `electric-indigo` → `signal-green` variants (bg, border, ring, accent, text), `truth-emerald` → `signal-green`, buttons get `text-deep-navy`

### Dashboard shell (Sidebar + TopBar)
- Active nav: `bg-electric-indigo/15 text-electric-indigo` → `bg-signal-green/15 text-signal-green`
- Plan badges + user button: same indigo → green swap

### Dashboard pages — accent swaps (already dark)
13 files updated with `electric-indigo` → `signal-green` accent swaps:
- Main dashboard, compete, magic-menus, billing, integrations pages
- RealityScoreCard, AlertFeed, LogoutButton (`hover:bg-slate-800` → `hover:bg-white/5`)
- SettingsForm, InterceptCard, AddCompetitorForm, RunAnalysisButton, PlatformRow
- All `bg-signal-green` buttons use `text-deep-navy` for contrast

### Dashboard pages — light-to-dark conversions
7 files converted from `bg-white`/`bg-slate-50` light theme to dark:
- `hallucinations/page.tsx` — tables, headers, severity badges, hover states
- `locations/page.tsx` — tables, status badges, primary badge
- `share-of-voice/page.tsx` — headers, empty state
- `magic-menus/[id]/page.tsx` — full page: status badges, breadcrumbs, category cards, tables
- `EvaluationCard.tsx` — engine badges, score colors, Run Audit button, error states
- `StatusDropdown.tsx` — select element dark styling
- `SovCard.tsx` — engine badges, rank badges, Run button, query forms, competitor chips

### Test updates
Updated 5 test assertions in `DashboardShell.test.tsx` and `TruthCalibrationForm.test.tsx` to expect `signal-green` instead of `electric-indigo` class tokens.

### Files modified
| # | File | Type of Change |
|---|------|---------------|
| 1 | `app/globals.css` | Token remap (colors + font vars) |
| 2 | `app/layout.tsx` | Font swap (Geist → Outfit + JetBrains Mono) |
| 3 | `app/page.tsx` | Remove duplicate font loading |
| 4 | `app/scan/page.tsx` | Remove duplicate font loading |
| 5 | `app/(auth)/login/page.tsx` | Full dark theme conversion |
| 6 | `app/(auth)/register/page.tsx` | Full dark theme conversion |
| 7 | `app/pricing/page.tsx` | Accent swap + font-mono |
| 8 | `app/privacy/page.tsx` | Accent swap |
| 9 | `app/terms/page.tsx` | Accent swap |
| 10 | `app/onboarding/page.tsx` | Accent swap |
| 11 | `app/onboarding/_components/TruthCalibrationForm.tsx` | Accent swap |
| 12 | `components/layout/Sidebar.tsx` | Accent swap |
| 13 | `components/layout/TopBar.tsx` | Accent swap |
| 14 | `app/dashboard/page.tsx` | Accent swap |
| 15 | `app/dashboard/hallucinations/page.tsx` | Light → dark |
| 16 | `app/dashboard/hallucinations/_components/EvaluationCard.tsx` | Light → dark |
| 17 | `app/dashboard/hallucinations/_components/StatusDropdown.tsx` | Light → dark |
| 18 | `app/dashboard/locations/page.tsx` | Light → dark |
| 19 | `app/dashboard/share-of-voice/page.tsx` | Light → dark |
| 20 | `app/dashboard/share-of-voice/_components/SovCard.tsx` | Light → dark |
| 21 | `app/dashboard/magic-menus/page.tsx` | Accent swap |
| 22 | `app/dashboard/magic-menus/[id]/page.tsx` | Light → dark |
| 23 | `app/dashboard/billing/page.tsx` | Accent swap |
| 24 | `app/dashboard/compete/page.tsx` | Accent swap |
| 25 | `app/dashboard/compete/_components/InterceptCard.tsx` | Accent swap |
| 26 | `app/dashboard/compete/_components/AddCompetitorForm.tsx` | Accent swap |
| 27 | `app/dashboard/compete/_components/RunAnalysisButton.tsx` | Accent swap |
| 28 | `app/dashboard/integrations/page.tsx` | Accent swap |
| 29 | `app/dashboard/integrations/_components/PlatformRow.tsx` | Accent swap |
| 30 | `app/dashboard/settings/_components/SettingsForm.tsx` | Accent swap |
| 31 | `app/dashboard/_components/RealityScoreCard.tsx` | Accent swap |
| 32 | `app/dashboard/_components/AlertFeed.tsx` | Accent swap |
| 33 | `app/dashboard/_components/LogoutButton.tsx` | Hover fix |
| 34 | `src/__tests__/unit/components/layout/DashboardShell.test.tsx` | Test assertions update |
| 35 | `src/__tests__/unit/components/onboarding/TruthCalibrationForm.test.tsx` | Test assertion update |
| 36 | `DEVLOG.md` | This entry |

### Verification
- `npx next build` — clean (0 type errors, 0 compilation errors)
- `npx vitest run` — 355 passed, 7 skipped (1 pre-existing RLS test failure requiring Supabase)

---

## 2026-02-24 — Sprint 39: Scan Results Page Polish

**Goal:** Restyle the `/scan` results page (free AI audit landing) to match the Sprint 37 landing page design language — design system classes, alternating section backgrounds, Reveal animations, and JetBrains Mono for data elements.

### What changed

**Font loading** — Added Outfit + JetBrains Mono via `next/font/google` to `app/scan/page.tsx`, matching the landing page pattern with CSS variables `--font-outfit` / `--font-jetbrains-mono`.

**Full ScanDashboard restyle** — Rewrote `app/scan/_components/ScanDashboard.tsx` (~700 lines) from ad-hoc Tailwind to design system vocabulary:

- **Outer structure:** Single `<div>` → multiple `<section>` elements with alternating navy `#050A15` / navyLight `#0A1628` backgrounds, each containing `<div className="lv-section">` (max-width 1120px)
- **Nav strip:** Matches landing page — sticky, backdrop-blur, `lv-btn-outline` for "Run Another Scan"
- **Alert banner:** `.lv-card` with accent `borderLeft`, `lv-scan` sweep animation, `lv-ping` PulseDot, JetBrains Mono severity badge. Added `<h1>AI Audit: {businessName}</h1>` page heading with `SectionLabel` eyebrow
- **KPI section:** `lv-grid2` layout with "From Your Scan" (live) and "Unlock Full Scores" (locked) rows. Cards use `.lv-card` + colored borderLeft + JetBrains Mono stat values
- **Locked score cards:** SVG lock icon (no emoji), `Bar pct={0}` behind overlay, blur effect
- **Competitive landscape:** `Bar` component for competitor fills, SVG lock in gradient overlay, "Sample data" micro-copy
- **Detected issues:** `.lv-card` + accent borderLeft by category (hours=amber, address=indigo, menu=green), "Detected via" sub-card pattern, `LockPill` overlay for locked items
- **CTA section:** Gradient background + floating glow orb (`lv-float 6s`), single `lv-btn-green`, JetBrains Mono micro-copy

**Design system compliance:** All sections wrapped in staggered `<Reveal>` components. No animation libraries. One accent per card. `#F1F5F9` for white text (not #FFF). JetBrains Mono for data elements only.

### New sub-components (local to ScanDashboard)
- `SectionLabel` — eyebrow text with colored accent dot
- `LockOverlay` — blurred gradient overlay with SVG lock icon + CTA
- `LockPill` — compact inline lock badge for individual locked items
- `FallbackIssueCard` — extracted no-issues state card

### Files modified
| File | Change |
|------|--------|
| `app/scan/page.tsx` | Added Outfit + JetBrains Mono font loading |
| `app/scan/_components/ScanDashboard.tsx` | Full visual restyle (~700 lines) |
| `DEVLOG.md` | This entry |

### Verification
- `npx next build` — clean (0 type errors, 0 compilation errors)
- `npx vitest run` — 355 passed, 7 skipped

---

## 2026-02-24 — Sprint 38: Build Hardening & E2E Selector Fixes

**Goal:** Fix all pre-existing build errors and update E2E tests broken by Sprint 37 landing page text changes.

### Build fixes (pre-existing type errors on main)
- `app/dashboard/compete/page.tsx` — added null guard for `ctx.orgId` (`string | null` → redirect if null)
- `app/dashboard/magic-menus/[id]/_components/AddItemModal.tsx` — `z.coerce.number()` + `zodResolver` type mismatch → cast resolver
- `app/onboarding/_components/TruthCalibrationForm.tsx` — `keyof Amenities` → `keyof AmenitiesState` for Pick'd type
- `lib/schemas/evaluations.ts`, `lib/schemas/integrations.ts`, `lib/schemas/sov.ts` — Zod v4 migration: `errorMap` → `message`
- `lib/schemas/menu-items.ts` — Zod v4 migration: `invalid_type_error` → `message`
- `lib/email.ts` — lazy-init Resend client to prevent build-time crash when `RESEND_API_KEY` is absent
- `app/page.tsx` — `as const` type narrowing: added `isZero: false` to all items; spread `features` array for readonly→mutable

### E2E test selector updates (Sprint 37 text changes)
- `tests/e2e/viral-wedge.spec.ts` — hero heading, eyebrow badge, case study title selectors
- `tests/e2e/01-viral-wedge.spec.ts` — same 3 selectors updated

### Comparison table mobile responsiveness
- `app/page.tsx` — wrapped comparison grid in `overflow-x-auto` container with `min-width: 540px` inner wrapper

### Verification
- `npx next build` — clean (0 type errors, 0 compilation errors)
- `npx vitest run` — 355 passed, 7 skipped (RLS integration test requires running Supabase)

---

## 2026-02-24 — Sprint 37: Landing Page Content & Layout Refresh

**Goal:** Update landing page text content, section layout, and visual structure to match
the refined reference design (`docs/localvector-landing.jsx`).

### What changed

**New copy throughout** — Hero headline rewrote from "Is AI Hallucinating..." to
"Every hour, ChatGPT answers 11,000 questions about local restaurants. Yours included."
Amber eyebrow badge, narrative subheadline, ViralScanner wrapped in card container.

**Practice What We Preach** — Replaced CompareRow checkmark/X format with animated
`Bar` progress components. LocalVector.ai scores (97/100/0) vs "Average Local Business"
(Unknown/Unknown/Unknown with gray bars). New `Bar.tsx` client component.

**Three Engines** — Renamed from "Three Stages. Zero Hallucinations." to "Detect the lies.
Steal the spotlight. Force the truth." Cards now use Fear Engine (crimson), Greed Engine
(amber), Magic Engine (green) naming with "What you see" sub-cards per the reference.

**Comparison Table** — Expanded from 4 to 6 feature rows with reference copy. Swapped
from `<table>` to CSS grid. Added self-honest row: "Pushes to 48 directories nobody
visits" (us: ✗, them: ✓).

**Case Study** — Rewrote from structured CaseRow/ResultCard to narrative storytelling with
before/after comparison cards. "The $12,000 Steakhouse That Didn't Exist" with green
highlight box "The fix took 24 hours."

**Pricing** — Updated copy: "Cheaper than one lost table." headline, reference feature
lists, `.lv-btn-green`/`.lv-btn-outline` CTA styles. Added "14-day free trial" note.

**FAQ** — Added "built by a restaurant owner who also runs a lounge in Alpharetta, GA."

**Nav** — "Sign In" replaced with "How It Works" anchor (#how). CTA changed to
"Free AI Audit →" with `animation: none`.

**Footer** — Brand left, links right layout. Added "© 2026 LocalVector.ai".

### Preserved (no changes)
- ViralScanner component (hero + final CTA)
- AVS Dashboard section (kept, restyled)
- JSON-LD schema
- All CSS keyframes in globals.css
- Design system compliance (DESIGN-SYSTEM.md)

### Files modified
| File | Change |
|------|--------|
| `app/page.tsx` | Full content + layout rewrite (all 13 sections) |
| `app/_components/Bar.tsx` | New — animated progress bar (scroll-reveal) |
| `DEVLOG.md` | This entry |

### Removed sub-components (no longer needed)
- `CompareRow` — replaced by Bar-based layout
- `CaseRow` — replaced by narrative paragraphs
- `ResultCard` — replaced by before/after cards
- `TrustPill` — replaced by JetBrains Mono micro-copy

### Verification
- `npx next build` — compiles successfully (pre-existing type error in `compete/page.tsx` unrelated)
- Visual: all 13 sections render with correct content and animations

---

## 2026-02-23 — Sprint 36d: Best-of-2 Parallel Scan Strategy

**Goal:** Eliminate non-deterministic scan results caused by Perplexity Sonar's live
search + LLM combination. Same business can return `not_found` on one call and
`pass` with high mentions on the next.

### Architecture

Refactored `runFreeScan()` in `app/actions/marketing.ts`:

1. **`_singlePerplexityCall()`** — Extracted single API call + response parsing into a
   pure helper function. Accepts `{ businessName, city, address, url, apiKey }`, returns
   `ScanResult`. All Sprint 36c hardening (preprocessor, extractJson, AbortController,
   text-detection) preserved inside the helper.

2. **`_scoreScanResult()`** — Ranks results for comparison. Scoring:
   - `pass`/`fail` with data: **100 + mentions_volume rank** (0–3)
   - `not_found`: **10**
   - `unavailable`/`rate_limited`: **0**
   - Among equal statuses, higher `mentions_volume` wins.

3. **`runFreeScan()`** — Now fires 2 parallel calls via `Promise.allSettled`, scores
   both results, and returns the richer one. Rate limiting + API key check happen once
   before the parallel calls.

### Trade-offs
- **Cost:** ~2x Perplexity API usage per scan
- **Latency:** No change — both calls run concurrently within the same 15s window
- **Consistency:** Dramatically improved — the richer of 2 non-deterministic results wins

### Tests
- `src/__tests__/unit/free-scan-pass.test.ts`: **31 tests, 31 passing** (+4 new)
  - "picks pass over not_found" — first call returns `not_found`, second returns `pass` → `pass` wins
  - "picks fail over unavailable" — first call returns `fail`, second errors → `fail` wins
  - "prefers higher mentions_volume" — both calls return `pass` but with different richness → richer wins
  - "returns unavailable only when both calls fail" — both error → `unavailable`
- `src/__tests__/unit/rate-limit.test.ts`: **6 tests, 6 passing** (no regression)

---

## 2026-02-23 — Sprint 36c: Bulletproof Scan Pipeline — 5 Edge Case Fixes

**Goal:** Eliminate all remaining "Scan Unavailable" edge cases in `runFreeScan()` where
Perplexity returns usable data but the parser can't handle it.

### Fixes (all in `app/actions/marketing.ts`)

1. **`preprocessScanResponse()`** — Normalizes near-valid JSON before Zod: trims whitespace
   from key names (Perplexity bug: `" accuracy_issue_categories"` → `"accuracy_issue_categories"`),
   coerces string booleans (`"true"` → `true`), and lowercases enum fields (`"Critical"` →
   `"critical"`). Prevents silent `safeParse` failures.

2. **Empty response guard** — `choices: []` or empty `content` now returns `not_found`
   instead of falling through to `unavailable`.

3. **AbortController (15s timeout)** — Caps Perplexity fetch at 15 seconds so users get
   a clean "Scan Unavailable" instead of staring at the animation for 30s+.

4. **`extractJson()` balanced-brace parser** — Replaces greedy `/{[\s\S]*}/` regex.
   Handles self-correcting LLM responses with multiple JSON objects by picking the last
   complete `{...}` block.

5. **"Open" business text-detection** — New keyword fallback (`"is open"`, `"currently
   operating"`, `"still open"`, `"actively operating"`) returns `pass` with conservative
   defaults when JSON parse fails but natural language confirms the business is open.

6. **Zod truncate instead of reject** — `accuracy_issues` strings capped at 120 chars via
   `.transform(s => s.slice(0, 120))` instead of `.max(120)`. Arrays sliced to 3 items via
   `.transform(arr => arr.slice(0, 3))` instead of `.max(3)`. Verbose Perplexity responses
   no longer blow up the entire parse.

7. **Zod issue logging** — When `safeParse` fails but `JSON.parse` succeeded, Zod issues
   are now logged in dev mode. Catches the next "Charcoal N Chill"-type surprise faster.

8. **Pre-parse JSON repair** — Perplexity has three variants of a key malformation bug:
   v1: `" accuracy_issue_categories"` (space in key, valid JSON — handled by key trim);
   v2: `," "accuracy_issue_categories"` (space splits key — breaks JSON.parse);
   v3: `,""accuracy_issue_categories"` (doubled quote, no space — breaks JSON.parse).
   Regex `/,"\s*"(?=[a-z_])/gi → ,"`  repairs v2+v3 before `JSON.parse`. Lookahead
   ensures valid JSON like `,"":value` (empty-string key) is not affected.

### AI_RULES compliance
- §24: Never fabricate — `unavailable` still returned when no data is extractable
- §21: All parsed boolean branches preserved
- §17: Side-effect resilience — `clearTimeout` always runs after fetch completes
- §28: Parallel array pattern — `accuracy_issue_categories` lowercased in preprocessor

### Tests
- `src/__tests__/unit/free-scan-pass.test.ts`: **27 tests, 27 passing** (+9 new)
- `src/__tests__/unit/rate-limit.test.ts`: **6 tests, 6 passing** (no regression)
- Run: `npx vitest run src/__tests__/unit/free-scan-pass.test.ts`

---

## 2026-02-23 — Sprint 36b: Resilient JSON Extraction for Free Scan

**Goal:** Fix "Scan Unavailable" errors for businesses like Charcoal N Chill (charcoalnchill.com)
where Perplexity wraps valid JSON in natural-language prose instead of returning pure JSON.

**Root cause:** `runFreeScan()` only stripped markdown fences (```` ```json ````) but couldn't
extract a JSON object embedded in explanatory text. The response parsed as invalid JSON and fell
through all fallbacks to `{ status: 'unavailable', reason: 'api_error' }`.

### Changes

- **`app/actions/marketing.ts`** — Added `/{[\s\S]*}/` regex extraction between fence-stripping
  and `JSON.parse()`. Same pattern already used in `competitor-intercept.service.ts:96` and
  `hallucinations/actions.ts:166`. Added dev-only `console.warn` on parse failure for diagnostics.
- **`src/__tests__/unit/free-scan-pass.test.ts`** — New test: prose-wrapped JSON scenario
  ("charcoalnchill case"). Suite now at **18 tests, 18 passing**.

### AI_RULES compliance
- §24: Never fabricate results — still returns `unavailable` when no JSON extractable at all
- §17: KV/rate-limit resilience unchanged

---

## 2026-02-23 — Sprint 36: Landing Page Selective Upgrade (Design System Alignment)

**Goal:** Upgrade the existing landing page (`app/page.tsx`) with richer interactions and missing
sections from the design prototype (`docs/localvector-landing.jsx`), following DESIGN-SYSTEM.md
conventions. Adds scroll-reveal animations, animated counters, FAQ accordion, and landing-scoped
Outfit + JetBrains Mono fonts — while preserving all existing content and structure.

### New CSS (globals.css)
- 5 new `lv-` keyframes: `lv-scan`, `lv-float`, `lv-shimmer`, `lv-ping`, `lv-glow`
- 6 utility classes: `.lv-card`, `.lv-btn-green`, `.lv-btn-outline`, `.lv-section`, `.lv-grid2`, `.lv-grid3`
- Responsive breakpoint at 840px for grid collapse

### New Client Components (app/_components/)
- `use-reveal.ts` — shared IntersectionObserver hook (fires once at threshold)
- `Reveal.tsx` — scroll-triggered fade-in wrapper (threshold 0.12, translateY 36→0, 0.7s)
- `Counter.tsx` — animated number counter (threshold 0.3, counts to `end` over 1.8s)
- `FaqAccordion.tsx` — FAQ item with open/close accordion + lighter scroll-reveal + `aria-expanded`
- `ScrollHint.tsx` — decorative scroll indicator at bottom of hero (CSS-only `lv-float`)

### Landing Page Updates (app/page.tsx)
- **Font scoping:** Outfit + JetBrains Mono loaded via `next/font/google` at module scope,
  applied to wrapper `<div>` with CSS variables. Dashboard keeps Geist fonts.
- **Hero enhancements:** Model strip (ChatGPT/Perplexity/Gemini/Claude/Copilot chips with
  `lv-shimmer` staggered animation) + `<ScrollHint />` at bottom of hero
- **NEW section: "The Invisible Revenue Leak"** — 3 stat cards with `<Counter>` ($1,600/month,
  68%, 0 alerts), `lv-card` styling, colored left borders, `lv-scan` accent sweeps
- **NEW section: FAQ** — 5 `<FaqAccordion>` items with staggered delays (80ms increments)
- **NEW section: Final CTA** — radial floating glow background, headline, reused `<ViralScanner />`
- **Scroll-reveal:** All existing sections wrapped in `<Reveal>` with staggered delays
- **MetricCard cleanup:** Removed redundant `fade-up` animation and `delay` prop (replaced by `<Reveal>`)

### Section order (final)
1. JSON-LD → 2. Nav → 3. Hero (+model strip, +scroll hint) → 4. Invisible Revenue Leak [NEW] →
5. AVS Metrics → 6. Practice What We Preach → 7. Us vs Them → 8. How It Works →
9. Case Study → 10. Pricing → 11. FAQ [NEW] → 12. Final CTA [NEW] → 13. Footer

### Constraints
- No animation libraries — CSS keyframes + IntersectionObserver only
- All new keyframes use `lv-` prefix in `globals.css`
- JetBrains Mono for data elements only; Outfit for prose/headings/buttons
- Page remains a Server Component; client components are imported islands
- Literal CSS class strings throughout (AI_RULES §12)

---

## 2026-02-23 — Sprint 35: Accuracy Issues Full Display + Issue Categories

**Goal:** Surface all `accuracy_issues` from Perplexity as real Detected Issues items (items 1–3
in Section 4 of ScanDashboard), with a category badge per issue. Previously, items 2–3 were
generic locked copy even when Perplexity returned specific inaccuracies. Sprint 35 fixes this:
item 1 (unlocked) = first accuracy issue; items 2–3 (locked/blurred) = next real issues or
generic fallback when fewer than 2/3 issues exist. Each issue now carries a category badge
(`Hours | Address | Menu | Phone | Other`) from the new `accuracy_issue_categories` parallel array.

**AI_RULES compliance:**
- §24: Items 2–3 now show *real* locked findings — more compelling AND honest (no fabrication)
- §26: Same free/locked split — first item free, rest require signup
- §12: All Tailwind class strings are literals (ternary-only `categoryColor()` / `categoryLabel()`)
- §21: All new parsed fields (`accuracy_issue_categories`) branched on in every return path

### Part 1 — Perplexity Schema Expansion (`app/actions/marketing.ts`)
- Added `accuracy_issue_categories` to `PerplexityScanSchema` (parallel array, max 3, `default([])`)
- Updated system prompt: `accuracy_issue_categories` instruction (parallel to `accuracy_issues`)
- Updated `Schema:` comment in system prompt
- `ScanResult` union: `fail` and `pass` get `accuracy_issue_categories: Array<IssueCategory>`
- All return branches updated: `pass`, `fail`, text-detection fallback, `_demoFallbackForTesting`

### Part 2 — URL Params + Data Flow (`app/scan/_utils/scan-params.ts`)
- Exported `IssueCategory` type: `'hours' | 'address' | 'menu' | 'phone' | 'other'`
- `ScanDisplayData`: `fail` and `pass` get `accuracyIssueCategories: IssueCategory[]`
- Added `VALID_CATEGORIES` constant for decoding validation
- `parseScanParams`: decodes `issue_cats` pipe-separated param; missing → `[]` (backwards-compat)
- `buildScanParams`: encodes `issue_cats` when non-empty
- Added `getAccuracyIssueCategories()` helper function (parallel to `getAccuracyIssues()`)

### Part 3 — ScanDashboard Redesign (`app/scan/_components/ScanDashboard.tsx`)
- Imported `IssueCategory` and `getAccuracyIssueCategories` from `scan-params`
- Added `categoryLabel()` and `categoryColor()` helper functions (AI_RULES §12: ternary literals)
- New `AccuracyIssueItem` sub-component: category badge + issue text; handles locked/unlocked states
- Section 4 refactored:
  - When `accuracyIssues.length > 0`: Item 1 = `AccuracyIssueItem` (unlocked); items 2–3 = `AccuracyIssueItem` (locked) if present, else `LockedFixItem` (generic fallback)
  - When `accuracyIssues.length === 0`: existing fail/pass/not_found rendering (no regression)

### Part 4 — MSW Mock (`src/mocks/handlers.ts`)
- Added `accuracy_issue_categories: []` to Perplexity mock (parallel to `accuracy_issues: []`)

### Tests
| Suite | Before | After |
|-------|--------|-------|
| `scan-params.test.ts` | 11 | **14** (+3: decode `issue_cats`, missing → `[]`, encode in `buildScanParams`) |
| `free-scan-pass.test.ts` | 15 | **17** (updated `toEqual` + 2 new: categories propagation + Zod default) |
| **Vitest total** | **336** | **341** |

**Verification:** 341 passing, 7 skipped · 0 new TypeScript errors

---

## 2026-02-23 — Sprint 34: Real AI Audit Data — Honest Free Tier + Locked Scores + "AI Audit" Renaming

**Goal:** Replace Sprint 33's 5-row KPI lookup table (identical scores for every "pass" scan) with
real fields from Perplexity. Introduce an honest free/locked split. Rename to "AI Audit" (broader
than "Hallucination Scan" — covers AEO, GEO, SOV roadmap).

**Core problem solved:** Every "pass" result showed 79/74/82 — identical numbers erode trust faster
than no numbers at all. Real categorical fields from the same Perplexity call are more honest and
differentiated.

### Part 1 — Perplexity Schema Expansion (`app/actions/marketing.ts`)
- Added 3 new fields to `PerplexityScanSchema`: `mentions_volume`, `sentiment`, `accuracy_issues`
- Zod `.default()` on all new fields — backwards-compat when Perplexity response lacks them
- Updated system prompt: "AI-presence auditor" with definitions for all 3 new fields
- `ScanResult` union expanded: `fail` and `pass` variants get `mentions_volume`, `sentiment`, `accuracy_issues`
- `not_found` branch: no new fields (no AI coverage by definition)
- Text-detection fallback: hard-codes `mentions_volume: 'low', sentiment: 'negative', accuracy_issues: []`
- `_demoFallbackForTesting` updated with new fields

### Part 2 — URL Params + Data Flow (`app/scan/_utils/scan-params.ts`)
- Removed `KpiScores` type and `deriveKpiScores` function (replaced by real fields)
- `ScanDisplayData`: `fail` and `pass` get `mentions`, `sentiment`, `accuracyIssues`
- `parseScanParams`: decodes new params with graceful defaults for Sprint 33 backwards-compat
- `buildScanParams`: encodes `mentions`, `sentiment`, `issues` (pipe-separated array)

### Part 3 — ScanDashboard Redesign (`app/scan/_components/ScanDashboard.tsx`)
- **Row 1 "FROM YOUR SCAN"**: AI Mentions card + AI Sentiment card (real, "Live" badge)
- **Row 2 "UNLOCK FULL SCORES"**: AVS `██/100` + Citation Integrity `██/100` (lock overlay)
- Competitor section: My Brand = colored bar (no score); competitors = "Top Competitor 1/2/3", no scores
- `accuracyIssues[0]` shown in pass result's Detected Issues item 1 if non-empty
- Removed `deriveKpiScores` and `buildSparklinePath` imports
- Helper functions: `mentionsColor()`, `mentionsDotColor()`, `mentionsDescription()`, `sentimentColor()`, `sentimentIcon()`, `sentimentDescription()`

### Part 4 — ViralScanner (`app/_components/ViralScanner.tsx`)
- New 6 scan messages (LLM Interrogation Engine → ChatGPT-4o → Perplexity & Gemini → RAG Sources → AVS → Report)
- Interval: 650ms → **800ms**
- Form title: "Free AI Hallucination Scan" → **"Free AI Audit"**
- Submit button: "Scan for Hallucinations →" → **"Run Free AI Audit →"**

### Part 5 — MSW Mock (`src/mocks/handlers.ts`)
- Added `mentions_volume: 'low'`, `sentiment: 'negative'`, `accuracy_issues: []` to Perplexity mock

### Tests
| Suite | Before | After |
|-------|--------|-------|
| `scan-params.test.ts` | 10 | **11** (−4 deriveKpiScores + 5 real-field tests + kept buildSparklinePath) |
| `free-scan-pass.test.ts` | 11 | **15** (+4 new field propagation tests) |
| **Vitest total** | **331** | **336** |

**Verification:** 336 passing, 7 skipped · 0 new TypeScript errors

---

## 2026-02-23 — Sprint 33: Audit Flow — Smart Search + Diagnostic Screen + Public Scan Dashboard

**Goal:** Turn the free ViralScanner into a full value-creation journey that ends on a public
`/scan` result dashboard, gating the "fixes" behind signup to drive conversions.

**Three parts delivered:**

### Part 1 — Smart Search (URL Mode)
Added dual-mode input to `ViralScanner.tsx`:
- Auto-detects URL input via `looksLikeUrl()` regex (`http://`, `domain.com` patterns)
- URL mode: suppresses Places autocomplete, shows "🔗 Scanning as website URL" hint
- Passes `url` field to `runFreeScan()` which injects it as context into the Perplexity prompt

### Part 2 — Diagnostic Processing Screen
Replaced the plain spinner with a high-tech animated overlay during the `scanning` phase:
- Signal-green pulsing dot + "Running AI Audit" header
- 4s progress bar using existing `fill-bar` CSS keyframe (no Framer Motion)
- 6 cycling messages every 650ms with `fade-up` re-animation via `key={msgIndex}` re-mount trick

### Part 3 — Public `/scan` Result Dashboard
New pages and utilities:

| File | Action |
|------|--------|
| `app/scan/page.tsx` | **CREATED** — async Server Component; awaits `searchParams` (Next.js 16); parses URL params |
| `app/scan/_components/ScanDashboard.tsx` | **CREATED** — `'use client'`; 5-section dashboard (nav, alert, KPIs, competitive, CTA) |
| `app/scan/_utils/scan-params.ts` | **CREATED** — pure TS: `parseScanParams`, `buildScanParams`, `deriveKpiScores` |
| `app/scan/_utils/sparkline.ts` | **CREATED** — pure TS: SVG polyline path generator for mini sparklines |
| `app/_components/ViralScanner.tsx` | **EDITED** — URL mode, diagnostic overlay, `router.push` redirect for actionable results |
| `app/actions/marketing.ts` | **EDITED** — reads `url` field from FormData; includes in Perplexity prompt |
| `src/__tests__/unit/scan-params.test.ts` | **CREATED** — 10 unit tests |
| `docs/Audit_Flow_Architecture.md` | **CREATED** — full architecture reference |
| `docs/Brand_Strategy.md` | **EDITED** — Sprint 33 added to section map + free scan flow |

**Redirect logic (AI_RULES §24 compliant):**
- `fail` / `pass` / `not_found` → `router.push('/scan?params')` → ScanDashboard
- `unavailable` / `rate_limited` → stay inline (not actionable audit results)
- `invalid` params → simple fallback ("Run a free scan" link)

**KPI honesty (AI_RULES §24 / §20):**
All four KPI cards carry an "Estimated" badge. Scores are derived from the real Perplexity
scan result (status + severity) using a fixed derivation table — not invented. They accurately
reflect urgency without fabricating data.

**TS errors fixed:** Two `phase === 'scanning'` checks that were dead code after early return
(narrowing issue); one `result.status !== 'invalid'` check after narrowing in ScanDashboard.

**Tests:** 331 passing, 7 skipped (+10 new from `scan-params.test.ts`). Pre-existing
`rls-isolation.test.ts` failure (requires live DB) unaffected.

```bash
npx vitest run src/__tests__/unit/scan-params.test.ts   # 10 passing
npx vitest run                                           # 331 passing, 7 skipped
npx tsc --noEmit --skipLibCheck                          # 0 new errors (Sprint 33 clean)
```

---

## 2026-02-23 — Sprint 32: Landing Page Content Gaps (Items 1, 2, 6)

**Goal:** Add three missing content items identified in landing page audit against brand spec.

| # | Gap | File | Change |
|---|-----|------|--------|
| 1 | US VS THEM comparison table absent | `app/page.tsx` | **ADDED** new section between Engine and Social Proof — "Why Static Listings Aren't Enough" with 4 feature rows (Hallucination Detection, AI Sentiment Steering, Real-time RAG Updates, Localized GEO) comparing LocalVector ✓ vs Enterprise Listing Tools ✗ |
| 2 | Hero sub-headline missing brand positioning | `app/page.tsx` | **UPDATED** — replaced "We detect the lies and force the truth." with "LocalVector.ai is the world's first AI Defense Layer that detects misinformation and forces the truth." |
| 6 | Footer missing tagline phrase | `app/page.tsx` | **UPDATED** — appended "Built for the Generative Age." to footer brand line |

**Intentional non-changes (deferred):**
- Hero headline — current "Is AI Hallucinating Your Business Out of Existence?" kept (stronger than spec's version)
- "Citation Accuracy" name kept (spec says "Citation Dominance" — no user instruction to rename)
- Pricing tiers kept as 4-tier ($0/$29/$59/Custom) — intentional product decision from Sprint 25

**Docs updated:** `docs/08-LANDING-PAGE-AEO.md`, `docs/Brand_Strategy.md` (created)

**Tests:** No test impact — pure UI content changes.

---

## 2026-02-23 — Bug Fix: `_demoFallbackForTesting` must be async in `'use server'` file

**Goal:** Fix Next.js 16 build error — all exports in a `'use server'` file must be async.

**Root cause:** `app/actions/marketing.ts` has `'use server'` at the top. Next.js 16 enforces that every exported function in a `'use server'` file is an async Server Action. `_demoFallbackForTesting` was exported as a sync function, causing:
```
Server Actions must be async functions.
```

| File | Action |
|------|--------|
| `app/actions/marketing.ts` | **EDITED** — Changed `export function _demoFallbackForTesting(...)` → `export async function _demoFallbackForTesting(...): Promise<ScanResult>`. One-line fix; no logic change. |
| `AI_RULES.md` | **EDITED** — Added §25: `'use server'` file constraint — all exported functions must be async. |

**New AI rule captured:** AI_RULES §25 — every export in a `'use server'` file must be `async`. Sync helpers in Server Action files must either be unexported (module-private) or moved to a separate non-`'use server'` module.

**Tests:** 321 passing (no count change — `_demoFallbackForTesting` is `@internal`; no test imports it directly yet).

**Run:**
```bash
npx vitest run   # 321 passing, 7 skipped
```

---

## 2026-02-23 — Sprint 31: ViralScanner Integrity — Honest Unavailable State

**Goal:** Stop fabricating "AI Hallucination Detected" results when the Perplexity API is unavailable, broken, or unconfigured.

**Scope:**

| File | Action |
|------|--------|
| `app/actions/marketing.ts` | **EDITED** — Added `{ status: 'unavailable'; reason: 'no_api_key' \| 'api_error' }` variant to `ScanResult` type. Renamed `demoFallback()` → `_demoFallbackForTesting()` (exported, `@internal` marked, never called from production paths). Replaced all 4 `demoFallback()` auto-call sites: no API key → `{ status: 'unavailable', reason: 'no_api_key' }`; non-OK HTTP → `{ status: 'unavailable', reason: 'api_error' }`; no keyword match after JSON parse fail → `{ status: 'unavailable', reason: 'api_error' }`; outer catch → `{ status: 'unavailable', reason: 'api_error' }`. Updated header comment to reflect AI_RULES §24. |
| `app/_components/ViralScanner.tsx` | **EDITED** — Added `unavailable` result card (`data-testid="unavailable-card"`) between rate-limited and not-found cards. Amber border (`border-yellow-500/40`), "Scan Unavailable" heading, contextual message (no-key vs api-error), "Try again →" button via `handleReset`. Updated Phase state machine doc comment. |
| `src/__tests__/unit/free-scan-pass.test.ts` | **EDITED** — Replaced 2 demo-fallback tests (tests 3 & 4) with `unavailable` assertions. Added test 11: network failure (fetch throws) → `{ status: 'unavailable', reason: 'api_error' }`. Net: 10 → 11 tests. |
| `src/__tests__/unit/rate-limit.test.ts` | **EDITED** — Updated 4 assertions that expected `status: 'fail'` (demo fallback path) to `not.toBe('rate_limited')` — these tests verify rate limiting behavior, not scan outcome; with AI_RULES §24, the no-key path now returns `'unavailable'`. Count unchanged: 6 tests. |

**Architecture decision:** `demoFallback()` renamed and marked `@internal` rather than deleted — still available for tests that want to exercise the fail-path UI directly. Production code paths never reach it automatically.

**Side effect fixed:** `rate-limit.test.ts` assertions updated from `expect(result.status).toBe('fail')` to `expect(result.status).not.toBe('rate_limited')` — precisely captures what those tests actually verify (rate limiting passthrough), not the scan outcome.

**Tests updated:**
- `src/__tests__/unit/free-scan-pass.test.ts` — **11 Vitest tests** (was 10). Tests 3 & 4 replaced; test 11 added.
- `src/__tests__/unit/rate-limit.test.ts` — **6 Vitest tests** (count unchanged; assertions updated).

**Tests:** 320 → 321 passing (7 skipped).

**Run:**
```bash
npx vitest run src/__tests__/unit/free-scan-pass.test.ts   # 11 passing
npx vitest run src/__tests__/unit/rate-limit.test.ts       # 6 passing
npx vitest run                                              # 321 passing, 7 skipped
npx tsc --noEmit --skipLibCheck                             # 0 new errors (ViralScanner TS2367 pre-existing from Sprint 29)
```

---

## 2026-02-23 — Sprint 30: Dashboard Honesty — Replace Fake Crawl Health + Fix Timestamp

**Goal:** Remove all hardcoded/fabricated data from the Reality Score Card before showing the product to paying customers.

**Scope:**

| File | Action |
|------|--------|
| `app/dashboard/_components/scan-health-utils.ts` | **CREATED** — Pure TS module (no React). `formatRelativeTime(isoDate)` → "just now" \| "Xh ago" \| "yesterday" \| "X days ago" \| "Jan 15". `nextSundayLabel()` → next Sunday as "Mar 2" (always future, `skip = day === 0 ? 7 : 7 − day`). Co-located with the component so it can be imported in both the component and unit tests without a jsdom environment (AI_RULES §4). |
| `app/dashboard/page.tsx` | **EDITED** — Added 5th parallel query to `fetchDashboardData()`: `ai_audits.audit_date` scoped by `org_id` (`.eq('org_id', orgId)` — `ai_audits` is not auto-scoped by RLS). Destructured as `lastAuditResult`; extracted `lastAuditAt: string | null`. Passed `lastAuditAt` to both `<RealityScoreCard>` usages (alert and clean-board branches). |
| `app/dashboard/_components/RealityScoreCard.tsx` | **EDITED** — Added `lastAuditAt: string | null` prop. Replaced hardcoded `"Updated just now"` with `{lastAuditAt ? \`Updated ${formatRelativeTime(lastAuditAt)}\` : 'No scans yet'}`. Updated null subline to use concrete next-Sunday date via `nextSundayLabel()`. Replaced fake hardcoded Crawl Health bot list (GPTBot / Perplexity / Google with static fake times) with a real "AI Scan Health" section: green dot + "Last scan: Xh ago" when `lastAuditAt` exists; gray dot + "First scan runs Sunday, Mar 2" when absent. |
| `src/__tests__/unit/scan-health-utils.test.ts` | **CREATED** — 7 Vitest tests covering all `formatRelativeTime` branches and `nextSundayLabel` future-date assertion. |
| `AI_RULES.md` | **EDITED** — Added §23: Never Show Fake Timestamps or Hardcoded Status Lists. Added §24: Never Return Fabricated Scan Results (Sprint 31 prep). |

**Architecture decision:** Timestamp utilities extracted to `scan-health-utils.ts` (pure TS, no React imports) following AI_RULES §4 — avoids jsdom requirement in unit tests. `ai_audits` requires explicit `org_id` filter (not RLS-auto-scoped). Adding the 5th parallel query to the existing `Promise.all` block has no latency penalty.

**Tests added:**
- `src/__tests__/unit/scan-health-utils.test.ts` — **7 Vitest tests.** `formatRelativeTime`: < 1h → "just now", ≥1h < 24h → "Xh ago", 1 day → "yesterday", 2–6 days → "X days ago", ≥7 days → short date. `nextSundayLabel`: "Mon DD" format, always 1–7 days in the future.

**Tests:** 313 → 320 passing (7 skipped). *(+7 from `scan-health-utils.test.ts`, not +6 as planned — one extra `it` block for the nextSundayLabel format assertion.)*

**Run:**
```bash
npx vitest run src/__tests__/unit/scan-health-utils.test.ts   # 7 passing
npx vitest run                                                 # 320 passing, 7 skipped
```

---

## 2026-02-23 — Sprint 29: Robust ViralScanner Business Autocomplete

**Scope:** Replaced the raw free-text ViralScanner (Business Name + City inputs) with a state-machine-driven autocomplete backed by a new public Google Places endpoint. Users now select a verified business from a debounced dropdown, which passes the canonical address to Perplexity for a more accurate hallucination check. Added `not_found` scan result state for businesses with no AI coverage, and `is_unknown` Zod field to the Perplexity schema.

| File | Action |
|------|--------|
| `app/api/public/places/search/route.ts` | **CREATED** — Public GET endpoint, no auth. 20 searches/IP/hour via Vercel KV (bypass when `KV_REST_API_URL` absent). Proxies Google Places `textsearch/json`, maps results to `{ name, address }[]`, returns max 5 suggestions. 429 JSON on rate exceeded. Any error → `{ suggestions: [] }` (safe). |
| `app/_components/ViralScanner.tsx` | **REWRITTEN** — State machine (`idle | selected | manual | scanning | result`). Debounced autocomplete (300ms, 3-char min) calling `/api/public/places/search`. `onMouseDown` on dropdown items (not `onClick`) — prevents blur race. `readOnly` name input when `selected`. "Use different" and "Enter manually →" links. Appends `address` (from selection) or `city` (manual) to `FormData`. Added `not_found` result card (slate border, magnifying-glass icon, "Start Free Monitoring → /signup"). |
| `app/actions/marketing.ts` | **EDITED** — Added `not_found` variant to `ScanResult` type. Added `is_unknown: z.boolean().default(false)` to `PerplexityScanSchema`. Extracts `address` from `FormData`. Refined Perplexity user message: uses `located at "${address}"` when address present. Added `is_unknown` branch before `is_closed` check (AI_RULES §21). Updated system prompt: instructs `is_unknown=true` when no AI coverage found. |
| `src/mocks/handlers.ts` | **EDITED** — Added `publicPlacesSearchHandler` for `*/api/public/places/search`. Returns deterministic `Charcoal N Chill` suggestion for q≥3 chars, empty array for shorter. Exported in `handlers` array. |
| `src/__tests__/unit/public-places-search.test.ts` | **CREATED** — 8 Vitest tests: valid query returns `{ name, address }`, short query returns empty without Google call, missing API key returns empty, Google non-200 returns empty, fetch throws returns empty, count>20 returns 429, KV absent bypasses rate limit, `kv.incr()` throws is absorbed gracefully. |
| `src/__tests__/unit/free-scan-pass.test.ts` | **EDITED** — Extended from 7 to 10 tests. Added: (8) address in formData → Perplexity user message contains `located at "..."`, (9) `is_unknown=true` → `{ status: 'not_found' }`, (10) regression — `is_unknown=false` + `is_closed=false` → `status: 'pass'`. |
| `tests/e2e/01-viral-wedge.spec.ts` | **EDITED** — Updated primary scan test to use new autocomplete flow (type 'Charcoal N Chill' → select from MSW dropdown → submit). Added new test: type 'Charcoal' → `places-suggestions` visible → select → address shown → submit → `hallucination-card` visible (6 tests total). |
| `AI_RULES.md` | **EDITED** — Added §22: Public API Endpoint Pattern (namespace `app/api/public/`, mandatory IP rate limiting, 429 JSON on exceeded, safe empty responses, MSW registration required, no auth guard). |

**Architecture decision:** `/api/v1/places/search` is hard auth-gated (401 for anon) — cannot be reused from the public landing page. New `/api/public/places/search` with IP rate limiting (20/hr) is the public-safe alternative. Public endpoints live under `app/api/public/` to be visually distinct from `app/api/v1/`.

**Tests added:**
- `src/__tests__/unit/public-places-search.test.ts` — **8 Vitest tests**
- `src/__tests__/unit/free-scan-pass.test.ts` — **+3 tests** (7 → 10)
- `tests/e2e/01-viral-wedge.spec.ts` — **+1 Playwright test** (5 → 6)

**Tests:** 302 → 313 passing (7 skipped).

**Run:**
```bash
npx vitest run src/__tests__/unit/public-places-search.test.ts   # 8 passing
npx vitest run src/__tests__/unit/free-scan-pass.test.ts         # 10 passing
npx vitest run                                                    # 313 passing, 7 skipped
npx playwright test tests/e2e/01-viral-wedge.spec.ts             # 6 passing
```

---

## 2026-02-23 — Sprint 28B: Fix is_closed Logic Bug in runFreeScan()

**Scope:** `runFreeScan()` (the public hallucination scanner) was ignoring the `is_closed` boolean returned by the Perplexity Sonar API and always returning `status: 'fail'` — showing a red "AI Hallucination Detected" alert even when the business was correctly described. Fixed by branching on `is_closed` to return `status: 'pass'` when no hallucination exists. New AI_RULES §21 added.

| File | Action |
|------|--------|
| `app/actions/marketing.ts` | **EDITED** — Added `status: 'pass'` variant to `ScanResult` type. In the JSON parse path, branched on `parsed.data.is_closed`: `false` → `{ status: 'pass', engine, business_name }`; `true` → existing `{ status: 'fail', ... }` (unchanged). `demoFallback()` intentionally stays `fail` — the demo always shows the hallucination scenario for marketing impact. |
| `app/_components/ViralScanner.tsx` | **EDITED** — Added `status === 'pass'` pass card (`data-testid="no-hallucination-card"`): green border (`border-truth-emerald`), checkmark icon, "No AI Hallucinations Found" heading, business name block, context note, "Start Free Monitoring → /signup" CTA. |
| `src/__tests__/unit/free-scan-pass.test.ts` | **CREATED** — 7 unit tests covering both branches: `is_closed=true` → `fail` (correct fields), `is_closed=false` → `pass` (engine + business_name), demo fallback when no API key, non-OK HTTP → fallback, markdown-fenced JSON cleaned correctly, text-detection fires for "permanently closed" keyword, severity propagated from API. |
| `tests/e2e/01-viral-wedge.spec.ts` | **EDITED** — Updated Sprint 28 heading check (`Is ChatGPT Telling Your Customers` → `Is AI Hallucinating Your Business`). Updated social proof test (removed stale `98/100` → `Live AI Hallucination Detection` badge). Updated case study test (`$1,600/month` → `$12,000 Steakhouse Hallucination`). |
| `tests/e2e/viral-wedge.spec.ts` | **EDITED** — Same heading + social proof + case study assertion updates. |
| `AI_RULES.md` | **EDITED** — Added §21: "Always Use Every Parsed Field" — documents the `is_closed` pattern, requires unit tests to cover both branches of any parsed boolean. |

**Root cause:** `PerplexityScanSchema` includes `is_closed: z.boolean()` but the `safeParse` result path returned a hardcoded `status: 'fail'` without reading it. Classic "parse but don't use" bug (AI_RULES §21).

**Preserved behaviour:** `demoFallback()` continues to return `status: 'fail'` with "Permanently Closed" — intentional for the landing page demo experience when no API key is configured.

**Tests added:**
- `src/__tests__/unit/free-scan-pass.test.ts` — **7 Vitest tests.** Both `is_closed` branches, demo fallback, non-OK HTTP, markdown-fenced JSON, text-detection keyword, severity propagation.

**Tests:** 295 → 302 passing (7 skipped).

**Run:**
```bash
npx vitest run src/__tests__/unit/free-scan-pass.test.ts   # 7 passing
npx vitest run                                              # 302 passing, 7 skipped
```

---

## 2026-02-23 — Sprint 28: High-Converting Landing Page

**Scope:** Replaced the placeholder landing page with a definitive high-converting marketing page for LocalVector.ai. Deep Navy (`#050A15`) / Signal Green (`#00F5A0`) / Alert Amber (`#FFB800`) colour palette. 9 sections with CSS keyframe animations (no JS deps). All sub-components co-located in `app/page.tsx`.

| File | Action |
|------|--------|
| `app/globals.css` | **EDITED** — Added 3 new colour tokens to `@theme inline`: `deep-navy` (#050A15), `signal-green` (#00F5A0), `alert-amber` (#FFB800). Added 5 CSS keyframes: `fill-bar` (animated progress bars via `--bar-w` custom property), `fade-up` (section entrance), `pulse-glow-green` (hero CTA glow), `shield-beat` (compare section shield heartbeat), `ping-dot` (live-alert eyebrow badge). |
| `app/page.tsx` | **REWRITTEN** — Full 9-section landing page. Co-located sub-components: `TrustPill`, `SectionLabel`, `MetricCard`, `CompareRow`, `EngineCard`, `CaseRow`, `ResultCard`, `PricingCard`. Sections: JSON-LD, Nav, Hero (radial green glow, pulsing eyebrow badge, ViralScanner embed), AVS Dashboard (animated progress bars: AI Visibility Score / Sentiment Index / Citation Accuracy), Compare ("Practice What We Preach" side-by-side), Engine (3-column how-it-works: Detect → Correct → Distribute), Case Study ("$12,000 Steakhouse Hallucination"), Pricing (Free / Starter $29 / AI Shield $59 / Brand Fortress Custom), Footer (legal links). |

**Design tokens used:**
- `bg-deep-navy` / `text-deep-navy` — background and button text
- `bg-signal-green` / `text-signal-green` / `border-signal-green` — primary CTA, accents
- `text-alert-amber` — alert/warning highlights (case study callouts, problem badges)

**Animations (CSS keyframes, no JS library required):**
- `fill-bar`: Target width set via `style={{ '--bar-w': '98%' } as React.CSSProperties}` — each `MetricCard` has its own target
- `fade-up`: Staggered entrance with `animation-delay` (`0ms`, `100ms`, `200ms`)
- `pulse-glow-green`: Continuous glow on Nav + Hero CTA buttons
- `shield-beat`: Shield icon pulse in the "Practice What We Preach" compare section
- `ping-dot`: Pulsing dot inside eyebrow live-alert badges

**Pricing alignment:** Marketing names ("AI Shield", "Brand Fortress") match the design spec; prices ($29/$59/Custom) match the DB `plan_tier` enum (`starter`/`growth`/`agency`) from Sprint 25A. CTAs link to `/signup`, not direct Stripe checkout.

**Tests:** 295 passing (no regressions; page is a Server Component with no new server-side logic).

**Run:**
```bash
npx tsc --noEmit --skipLibCheck   # 0 errors
npx vitest run                     # 295 passing, 7 skipped
```

---

## 2026-02-23 — Sprint 27A: Listings Big 6 Table + Manual URL Input

**Scope:** Expanded the Listings page from 3 to 6 NAP platforms (Big 6). Users can now enter listing URLs for each platform on-blur — immediately actionable without waiting for Phase 8b OAuth. Deep Night theme applied. NAP Coverage badge per location card.

| File | Action |
|------|--------|
| `supabase/migrations/20260224000003_listing_url_column.sql` | **CREATED** — `ALTER TABLE location_integrations ADD COLUMN IF NOT EXISTS listing_url TEXT`. |
| `lib/schemas/integrations.ts` | **EDITED** — Added `BIG_6_PLATFORMS` const (`google`, `yelp`, `apple`, `facebook`, `tripadvisor`, `bing`); `Big6Platform` type; `SavePlatformUrlSchema` (Zod URL + max 2048 + uuid). Existing `INTEGRATION_PLATFORMS` untouched (backward compat). |
| `app/dashboard/integrations/actions.ts` | **EDITED** — Added `savePlatformUrl(platform, url, locationId): Promise<ActionResult>`. Auth gate → Zod → upsert `location_integrations` with `listing_url` → `revalidatePath`. |
| `app/dashboard/integrations/page.tsx` | **REWRITTEN** — Big 6 platforms (all shown regardless of DB rows). Deep Night theme (`bg-surface-dark`, `bg-midnight-slate`, `ring-white/5`). NAP Coverage badge per location: `connected/6 Platforms — X% Coverage` with emerald/amber/neutral colour coding. DB query now selects `listing_url`. |
| `app/dashboard/integrations/_components/PlatformRow.tsx` | **REWRITTEN** — Platform config expanded to all Big 6 (yelp, facebook, tripadvisor added). `listingUrl: string | null` prop. Editable URL input (controlled, saved on blur via `savePlatformUrl`). "Saved" confirmation chip (3 s auto-dismiss). Deep Night theme. Toggle/sync preserved for `google`, `apple`, `bing`. |
| `src/__tests__/unit/listings-actions.test.ts` | **CREATED** — 6 tests: auth gate, Zod rejects non-URL, Zod accepts valid URL, DB upsert success, DB error propagation, `revalidatePath` called on success. |
| `supabase/seed.sql` | **EDITED** — Added `listing_url = 'https://g.page/charcoal-n-chill-alpharetta'` to the existing Google integration INSERT. |

**Tests added:**
- `src/__tests__/unit/listings-actions.test.ts` — **6 Vitest tests.** Validates `savePlatformUrl()`: auth gate, Zod URL rejects non-URL, Zod URL accepts valid URL, DB upsert success (verifies `org_id`/`platform`/`listing_url` args), DB error propagation, `revalidatePath` called on success.

**Tests:** 289 → 295 passing (7 skipped; 1 pre-existing DB integration failure unaffected).

**Run:**
```bash
npx vitest run src/__tests__/unit/listings-actions.test.ts   # 6 passing
npx vitest run                                                # 295 passing, 7 skipped
```

---

## 2026-02-23 — Sprint 26A: Sentry Error Monitoring Integration

**Scope:** Wired Sentry into the Next.js App Router for production error visibility. Silent no-op when DSN is absent (local dev / CI).

| File | Action |
|------|--------|
| `sentry.client.config.ts` | **CREATED** — Browser Sentry init. 10% tracesSampleRate, 10%/100% replay sampling. `enabled: !!NEXT_PUBLIC_SENTRY_DSN` guard prevents noise in local dev. |
| `sentry.server.config.ts` | **CREATED** — Node.js Sentry init. 10% tracesSampleRate. Same DSN guard. |
| `sentry.edge.config.ts` | **CREATED** — Edge runtime Sentry init for middleware / Edge routes. |
| `next.config.ts` | **EDITED** — Wrapped with `withSentryConfig()`. `silent: true`, org/project from env, `authToken` from env (no build failure if absent). |
| `app/global-error.tsx` | **CREATED** — Next.js App Router global error boundary. `Sentry.captureException(error)` in `useEffect`. Deep Night fallback UI with "Try again" button. |
| `.env.local.example` | **EDITED** — Added Sentry env vars: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`. |

**Tests:** 289 passing (no regressions).

---

## 2026-02-23 — Sprint 25C: Marketing AEO Infrastructure

**Scope:** Added AI-discovery endpoints and JSON-LD schema to the landing page for maximum AI crawler discoverability.

| File | Action |
|------|--------|
| `app/llms.txt/route.ts` | **CREATED** — Returns Doc 08 §4 `llms.txt` content as `text/plain; charset=utf-8` with 24h cache. Describes LocalVector's value props, pricing tiers, and contact. |
| `app/ai-config.json/route.ts` | **CREATED** — Returns Doc 08 §10 GEO Standard JSON as `application/json` with 24h cache. Entity = LocalVector.ai platform; includes data_sources and policies. |
| `app/m/[slug]/page.tsx` | **EDITED** — Added `export` to `safeJsonLd()` helper (was private). |
| `app/page.tsx` | **EDITED** — Imports `safeJsonLd` and injects `SoftwareApplication` JSON-LD schema (Doc 08 §9) via `<script type="application/ld+json">`. |
| `tests/e2e/01-viral-wedge.spec.ts` | **EXTENDED** — 2 new AEO assertions: `GET /llms.txt` returns 200 + `text/plain`; `GET /ai-config.json` returns 200 + `application/json` with `entity` key. Net: 5 tests (3 + 2). |

**Tests added:**
- `tests/e2e/01-viral-wedge.spec.ts` — **+2 Playwright tests** (3 → 5 total). Validates AEO routes are reachable and return correct content-type + payload shape.

**Tests:** 289 passing (E2E tests verified at runtime against dev server).

**Run:**
```bash
npx playwright test tests/e2e/01-viral-wedge.spec.ts   # 5 passing
```

---

## 2026-02-23 — Sprint 25B: Privacy Policy + Terms of Service

**Scope:** Created legal pages and added a footer to the landing page.

| File | Action |
|------|--------|
| `app/privacy/page.tsx` | **CREATED** — Static Server Component. 10 sections covering all required SaaS disclosures. Third parties named explicitly: Supabase, Stripe, OpenAI, Perplexity, Resend. Legal review note at top. |
| `app/terms/page.tsx` | **CREATED** — Static Server Component. 12 sections including acceptable use, payment/refunds (no refunds on partial months), IP ownership, Delaware governing law. Legal review note at top. |
| `app/page.tsx` | **EDITED** — Added `<footer>` with "Privacy Policy · Terms of Service · hello@localvector.ai" links. |

**Tests:** 289 passing (no regressions).

---

## 2026-02-23 — Sprint 25A: Pricing Page + Billing Discrepancy Fix

**Scope:** Created the public `/pricing` marketing page and corrected the billing page tiers to match the `plan_tier` DB enum (`starter|growth|agency`) and Doc 08 §6 pricing ($29/$59/Custom).

| File | Action |
|------|--------|
| `app/pricing/page.tsx` | **CREATED** — Public Server Component. Three tiers: Starter ($29), Growth ($59, highlighted + "Most Popular"), Agency (Custom). CTA buttons link to `/signup` or `mailto:hello@localvector.ai`. Footer: "No contracts. Cancel anytime." |
| `app/dashboard/billing/page.tsx` | **REWRITTEN** — Tiers renamed from Free Scanner/Pro AI Defense/Enterprise API → Starter/Growth/Agency. Prices: $0→$29, $99→$59, Custom stays. Plan type updated `'pro' \| 'enterprise'` → `'starter' \| 'growth'`. Agency uses `<a href="mailto:">` instead of disabled button. |
| `app/dashboard/billing/actions.ts` | **EDITED** — `createCheckoutSession(plan)` type updated `'pro' \| 'enterprise'` → `'starter' \| 'growth'`. Env vars updated: `STRIPE_PRICE_ID_PRO` → `STRIPE_PRICE_ID_STARTER`, `STRIPE_PRICE_ID_ENTERPRISE` → `STRIPE_PRICE_ID_GROWTH`. Demo mode behavior preserved (zero-regression contract). |
| `app/page.tsx` | **EDITED** — Added "Pricing" link to top navigation next to "Sign In". |
| `tests/e2e/billing.spec.ts` | **UPDATED** — Tier name assertions updated: "Free Scanner" → "Starter", "Pro AI Defense" → "Growth", "Enterprise API" → "Agency". "Upgrade" button click still works (Growth tier CTA is "Upgrade"). |

**Tests added:**
- `tests/e2e/billing.spec.ts` — **0 new tests; existing assertions updated** to match renamed plan tiers (starter/growth/agency).

**Tests:** 289 passing (7 skipped; no regressions).

**Run:**
```bash
npx playwright test tests/e2e/billing.spec.ts   # all passing
```

---

## 2026-02-23 — Sprint 24B: Settings Page (Account, Security, Organization)

**Scope:** Built the full Settings self-service page with 3 form sections and 2 Server Actions.

| File | Action |
|------|--------|
| `app/dashboard/settings/page.tsx` | **CREATED** — Server Component; calls `getSafeAuthContext()`, redirects to `/login` if not auth'd, pre-fills `SettingsForm` with `displayName`, `email`, `orgName`, `plan`. |
| `app/dashboard/settings/_components/SettingsForm.tsx` | **CREATED** — `'use client'` 3-section form (Account, Security, Organization). `useTransition` for non-blocking Server Action calls. Password form resets on success via `useRef`. Inline green/red status messages. |
| `app/dashboard/settings/actions.ts` | **CREATED** — Two Server Actions: `updateDisplayName` (Zod min 2 / max 80, updates `public.users.full_name`, `revalidatePath('/dashboard')`); `changePassword` (Zod min 8 + confirm match, calls `supabase.auth.updateUser()`). Both auth-gated via `getSafeAuthContext()`. |
| `components/layout/Sidebar.tsx` | Settings nav item already enabled in Sprint 24A (`href: '/dashboard/settings'`, `active: true`). |
| `src/__tests__/unit/settings-actions.test.ts` | **CREATED** — 10 tests: `updateDisplayName` (auth gate, min-length, max-length, DB success + revalidatePath, DB error); `changePassword` (auth gate, min 8, confirm mismatch, auth error, success + no revalidatePath). |

**Tests:** 279 → 289 passing (7 skipped; 1 pre-existing DB integration failure unaffected).

**Run:**
```bash
npx vitest run src/__tests__/unit/settings-actions.test.ts   # 10 passing
npx vitest run                                                # 289 passing, 7 skipped
```

---

## 2026-02-23 — Sprint 24A: Reality Score — Remove Hardcoded Visibility

**Scope:** Replaced the hardcoded `visibility=98` with a live query from `visibility_analytics.share_of_voice`. When no SOV snapshot exists (Phase 5 cron has not yet run), the Reality Score shows `—` with a "pending" state — never fabricating a metric.

| File | Action |
|------|--------|
| `app/dashboard/page.tsx` | **EDITED** — `fetchDashboardData()` now accepts `orgId: string` and runs a 4th parallel query on `visibility_analytics`. `deriveRealityScore(openAlertCount, visibilityScore: number \| null)` updated: returns `realityScore: null` and `visibility: null` when no snapshot exists. `DashboardPage` passes `ctx.orgId ?? ''`; `QuickStat` "AI Visibility Score" renders `—` when null. |
| `app/dashboard/_components/RealityScoreCard.tsx` | **EDITED** — Props updated to `realityScore: number \| null`, `visibility: number \| null`. `ScoreGauge` shows `—` gauge when null. `ComponentBar` shows "Pending" with neutral-gray bar when null. Subline shows "First AI visibility scan runs Sunday at 2 AM. Check back Monday." when realityScore is null. |
| `components/layout/Sidebar.tsx` | **EDITED** — Removed hardcoded `98/100` footer score widget. Added `plan: string | null` prop. Added `planLabel()` helper. Footer now shows plan tier badge (e.g., "Growth Plan"). Settings nav item enabled: `active: true`, `href: '/dashboard/settings'`. |
| `components/layout/DashboardShell.tsx` | **EDITED** — Added `plan={plan}` to `<Sidebar>` render (was already in `<TopBar>`). |
| `src/__tests__/unit/reality-score.test.ts` | **REWRITTEN** — 8 tests updated (canonical `visibilityScore=60`, recalculated expected values). 2 new tests: `realityScore is null when visibilityScore is null`; `accuracy and dataHealth still compute correctly when visibilityScore is null`. Net: 10 tests. |
| `src/__tests__/unit/components/layout/DashboardShell.test.tsx` | **UPDATED** — All `<Sidebar>` renders updated to pass `plan` prop. Replaced "displays AI Visibility Score badge (98/100)" with two new tests: "displays plan tier badge" and "displays Free Plan badge when plan is null". Net: +1 test (11 → 12 in Sidebar describe block). |

**Tests:** 277 → 279 passing (7 skipped; 1 pre-existing DB integration failure unaffected).

**Run:**
```bash
npx vitest run src/__tests__/unit/reality-score.test.ts   # 10 passing
npx vitest run                                             # 279 passing, 7 skipped
```

---

## 2026-02-23 — Group F: Plan-Enforcer Test Expansion

**Scope:** Added 16 new unit tests to `plan-enforcer.test.ts` covering the 4 functions added in Group B. No code changes — tests only.

| File | Action |
|------|--------|
| `src/__tests__/unit/plan-enforcer.test.ts` | **EXTENDED** — 16 → 32 tests. Added 4 new describe blocks: `canRunAutopilot` (4 tests), `canRunPageAudit` (4 tests), `canRunOccasionEngine` (4 tests), `canConnectGBP` (4 tests — Starter+ differs from Growth+ pattern). Import updated to include all 9 exported functions. Header comment: "Tests all 5 exported gating functions" → "Tests all 9 exported gating functions". |
| `docs/14_TESTING_STRATEGY.md` | **UPDATED** — Suite inventory row for `plan-enforcer.test.ts`: 16 → 32 tests, all 9 describe blocks listed. Total calculation updated: 260 → 276 (+ rls-isolation = 283 with DB running). Footer updated. |

**Tests:** 267 → 276 passing (+ 7 rls-isolation = 283 with DB running). All 17 active suites pass.

**Run:**
```bash
npx vitest run src/__tests__/unit/plan-enforcer.test.ts   # 32 passing
npx vitest run                                             # 276 passing, 7 skipped (283 with supabase running)
```

---

## 2026-02-23 — Groups C/D/E: Documentation Sync (Doc 00, 02, 09)

**Scope:** Corrected all stale architecture and version references across three core docs. No code changes.

| File | Changes |
|------|---------|
| `docs/00-INDEX.md` (v2.7) | Next.js 15→16 in Tech Stack table. "Supabase Edge Functions" → "Next.js Route Handlers" in Tech Stack + architecture diagram. "Build Edge Function" → "Build Route Handler" in two "For Coding Agents" bullets. Added Doc 13 (V1 Core Loop) and Doc 14 (Testing Strategy Live) to document index table. |
| `docs/02-MULTI-TENANT-ARCHITECTURE.md` (v2.4) | Stack header: Next.js 15→16, removed "Edge Functions" from Supabase stack items. Architecture diagram `(Edge Functions)` → `(Route Handlers)`. Code comment `// middleware.ts` → `// proxy.ts`. Deployment architecture block: Next.js 15→16, "Vercel Cron → Supabase Edge Functions" → "Vercel Cron → Next.js Route Handlers", removed Supabase "Edge Functions (Deno)" line. Cost table note updated. Checklist item: "Fear Engine Edge Function" → "cron Route Handler". |
| `docs/09-BUILD-PLAN.md` | Phase 2 cron label fixed. Phase 3.1 deferred checkboxes ticked `[x]` (Places autocomplete + competitor cron). Test count updated: `243 passing` → `260` (Phase 3.1) → `267` (Group A). Phase 5 database migration block: NOTE added that `sov_engine.sql` was NOT promoted (table name conflict with live code; Phase 5 build task documented). SOV cron path: `supabase/functions/run-sov-cron/index.ts` → `app/api/cron/sov/route.ts`. Content pipeline migration item ticked `[x]` with new path `20260224000001_content_pipeline.sql`. Phase 7 citation cron: `supabase/functions/run-citation-cron/index.ts` → `app/api/cron/citation/route.ts`. Phase 8 GBP migration items ticked `[x]` with new path `20260224000002_gbp_integration.sql`. |

---

## 2026-02-23 — Group B: AI_RULES.md Alignment

**Scope:** Fixed two blocker-level inaccuracies in §6 and four gaps in §5 + §19.3. No code changes except `lib/plan-enforcer.ts` (4 new gate functions for Phase 2 features).

| File | Action |
|------|--------|
| `AI_RULES.md §6` | **FIXED** — "Next.js 15" → "Next.js 16". "Supabase Edge Functions (Deno) for all cron jobs" → "Next.js Route Handlers (`app/api/cron/*/route.ts`)". Added explicit "Do NOT create files under `supabase/functions/`" prohibition. |
| `AI_RULES.md §5` | **EXTENDED** — Plan-enforcer function list: 5 → 9. Added `canRunAutopilot`, `canRunPageAudit`, `canRunOccasionEngine`, `canConnectGBP` with tier gates. |
| `AI_RULES.md §19.3` | **EXTENDED** — Secondary MSW discriminator rule added: when two features share `gpt-4o-mini`, each must prefix its system message with a unique `[TAG]`. Documents the retrofit requirement and nested handler pattern. Current system message inventory added. |
| `lib/plan-enforcer.ts` | **EXTENDED** — 4 new exported functions: `canRunAutopilot` (Growth+), `canRunPageAudit` (Growth+), `canRunOccasionEngine` (Growth+), `canConnectGBP` (Starter+). |

**Tests:** 260 passing + 7 skipped (RLS integration test skipped — Supabase auth service not running after aborted container restart; not a code regression). Zero regressions from Group B changes.

---

## 2026-02-23 — Group A: Schema Infrastructure Remediation

**Scope:** Promoted Phase 2 SQL migrations from `/docs/` to `/supabase/migrations/`, regenerated `prod_schema.sql`, and extended `seed.sql` with Phase 2 table data. Resolved a table-name conflict that would have blocked future migrations.

| File | Action |
|------|--------|
| `supabase/migrations/20260224000001_content_pipeline.sql` | **CREATED** — Promotes `docs/20260223000002_content_pipeline.sql`. Creates `content_drafts`, `page_audits`, `local_occasions`, `citation_source_intelligence`. Fixed stale header dependency note (no hard FK to `sov_target_queries` — `trigger_id` is `UUID NULL`). |
| `supabase/migrations/20260224000002_gbp_integration.sql` | **CREATED** — Promotes `docs/20260223000003_gbp_integration.sql`. Adds nullable `google_location_name` + `gbp_integration_id` columns to `locations`. Creates `google_oauth_tokens` (deny-by-default RLS) and `pending_gbp_imports` (10-min expiry). Fixed duplicate REVOKE statements. |
| `supabase/prod_schema.sql` | **REGENERATED** — Full `supabase db dump` after applying all migrations. 17 tables → 27 tables. Now includes all migration-added tables. |
| `supabase/seed.sql` | **EXTENDED** — Section 14 added: 3 `local_occasions` rows (Valentine's Day, New Year's Eve, Birthday), 1 `content_drafts` row, 1 `page_audits` row, 4 `citation_source_intelligence` rows. UUID reference card updated with 7 new IDs. |

**Deferred (A1):** `docs/20260223000001_sov_engine.sql` was NOT promoted. It creates `sov_target_queries` + `sov_first_mover_alerts`, which are the Phase 5 target table names. All live SOV code uses `target_queries` + `sov_evaluations` (from migration 20260221000004). Promoting this would create orphaned parallel tables. Remains in `/docs/` as the Phase 5 refactor spec.

**Tests:** 260 → 267 passing (7 previously-skipped RLS integration tests now run against the properly-initialized DB). 18 suites, 0 failures.

**Run:**
```bash
npx supabase db reset    # applies all 9 migrations + seed cleanly
npx vitest run           # 267 passing, 0 skipped, 0 failures
```

---

## 2026-02-23 — Phase 3.1: Deferred Items — Google Places Autocomplete + Cron Competitor Intercepts

**Scope:** Two items deferred at Phase 3 completion are now fully shipped.

| File | Action |
|------|--------|
| `app/api/v1/places/search/route.ts` | **CREATED** — Server-side proxy to Google Places Text Search API; auth-guarded; graceful degradation when key absent. |
| `app/dashboard/compete/_components/AddCompetitorForm.tsx` | **REWRITTEN** — Controlled inputs with 300ms debounce autocomplete; `selectedPlace` guard; "Change" button; falls back to free text when no API key. |
| `src/__tests__/unit/places-search.test.ts` | **CREATED** — 6 tests: 401 guard, short-query guard, absent-key guard, 5-suggestion proxy, non-200 fallback, network-error fallback. |
| `lib/services/competitor-intercept.service.ts` | **CREATED** — Shared service: 2-stage Perplexity → GPT-4o-mini pipeline extracted from `actions.ts`. Accepts any Supabase client (RLS or service-role). |
| `app/dashboard/compete/actions.ts` | **REFACTORED** — `runCompetitorIntercept` delegates to service; `addCompetitor`, `deleteCompetitor`, `markInterceptActionComplete` untouched. |
| `app/api/cron/audit/route.ts` | **EDITED** — Second `for...of` loop added after hallucination loop. Per-org: fetches location + competitors; per-competitor: calls `runInterceptForCompetitor`; absorbs per-competitor errors. Added `intercepts_inserted` to summary JSON. |
| `src/__tests__/unit/competitor-intercept-service.test.ts` | **CREATED** — 8 tests: Perplexity URL, GPT-4o-mini URL + model, mock paths (no key / rejects), gap_analysis shape, INSERT error propagation. |
| `src/__tests__/unit/cron-audit.test.ts` | **EDITED** — Added `runInterceptForCompetitor` mock; extended `mockSupabaseWithOrgAndLocation` to handle `competitors` table; 3 new tests for intercept loop (calls/count/error absorption). |

**Tests:** 243 → 260 passing (+17 net, across 3 suites). Zero regressions.

**Run:**
```bash
npx vitest run src/__tests__/unit/places-search.test.ts
npx vitest run src/__tests__/unit/competitor-intercept-service.test.ts
npx vitest run src/__tests__/unit/cron-audit.test.ts
npx vitest run   # full suite: 260 passing, 7 skipped, 1 pre-existing failure
```

---

## 2026-02-23 — Bug Fix: `model_provider` enum missing `openai-gpt4o-mini`

**Problem:** `npx supabase db reset` failed with `SQLSTATE 22P02: invalid input value for enum model_provider: "openai-gpt4o-mini"`. The initial schema migration created `model_provider` with only 5 values; Phase 3 inserts `'openai-gpt4o-mini'` into `competitor_intercepts`.

**Scope:**

| File | Change |
|------|--------|
| `supabase/migrations/20260223000001_add_gpt4o_mini_model_provider.sql` | **CREATED** — `ALTER TYPE model_provider ADD VALUE IF NOT EXISTS 'openai-gpt4o-mini';` |
| `supabase/prod_schema.sql` | Updated canonical `model_provider` enum to include `'openai-gpt4o-mini'`. |
| `docs/03-DATABASE-SCHEMA.md` | Updated `model_provider` enum definition to include `'openai-gpt4o-mini'`. |

**Verified:** `npx supabase db reset` runs clean.

---

## 2026-02-23 — Bug Fix: Golden Tenant seed defaults to `trial` plan

**Problem:** After `db reset`, `dev@localvector.ai` landed on the `UpgradeGate` for `/dashboard/compete` because the `organizations` row defaulted to `plan = 'trial'`.

**Scope:**

| File | Change |
|------|--------|
| `supabase/seed.sql` | Added `UPDATE public.organizations SET plan = 'growth' WHERE id = 'a0eebc99-...'` after the membership INSERT. Section renamed "3. ORG MEMBERSHIP + PLAN". |

**Test credentials:** `dev@localvector.ai` / `Password123!` — Growth plan after `db reset`.

---

## 2026-02-23 — Phase 3: Competitor Intercept / Greed Engine (Complete)

**Goal:** Build the full Competitor Intercept feature — two-stage LLM pipeline (Perplexity Sonar → GPT-4o-mini), CRUD management UI, intercept result cards with actionable tasks, and Growth-plan gating.

**Scope:**

| File | Change |
|------|--------|
| `app/dashboard/compete/actions.ts` | **CREATED** — 4 Server Actions: `addCompetitor`, `deleteCompetitor`, `runCompetitorIntercept` (2-stage LLM), `markInterceptActionComplete`. Inline Zod schemas. Mock fallback with 3s delay when API keys absent. `GapAnalysis` JSONB typed per AI_RULES §19.1. `maxCompetitors()` called per AI_RULES §19.2. |
| `app/dashboard/compete/_components/AddCompetitorForm.tsx` | **CREATED** — `'use client'` form; `useTransition`; renders `null` when at plan limit; `data-testid="add-competitor-form"`. |
| `app/dashboard/compete/_components/CompetitorChip.tsx` | **CREATED** — `'use client'` pill with inline confirm-before-delete pattern; `data-testid="competitor-chip"`. |
| `app/dashboard/compete/_components/RunAnalysisButton.tsx` | **CREATED** — `'use client'` button calling `runCompetitorIntercept`; "Analyzing…" spinner; `data-testid="run-analysis-btn"`. |
| `app/dashboard/compete/_components/InterceptCard.tsx` | **CREATED** — `'use client'` card: query, winner badge, winner_reason, winning_factor, gap bar, gap_magnitude chip, suggested_action, Mark Complete / Dismiss buttons; imports `GapAnalysis`; `data-testid="intercept-card"`. |
| `app/dashboard/compete/page.tsx` | **CREATED** — Async Server Component; `getSafeAuthContext()` + redirect; `canRunCompetitorIntercept(plan)` gate → inline `UpgradeGate`; `Promise.all()` for competitors + intercepts + primary location; full competitor management + intercept results layout. |
| `components/layout/Sidebar.tsx` | Activated Compete nav entry: `active: false` → `active: true`. |
| `app/dashboard/page.tsx` | Added `interceptsThisMonth` Quick Stat (count of `competitor_intercepts` from the 1st of the current month). Grid expanded to 4 columns on sm+. |
| `src/__tests__/unit/competitor-actions.test.ts` | **CREATED** — 22 Vitest tests. Groups: `addCompetitor` (7), `deleteCompetitor` (3), `runCompetitorIntercept` (8), `markInterceptActionComplete` (4). Explicit chain mocks for `.eq().eq()` chaining (avoids `mockReturnThis()` context bug). |

**Tests added:**
- `src/__tests__/unit/competitor-actions.test.ts` — **22 tests**. All passing (243 total, 7 skipped, 1 pre-existing integration failure).

**Run command:**
```bash
npx vitest run src/__tests__/unit/competitor-actions.test.ts   # 22 tests passing
grep -cE "^\s*(it|test)\(" src/__tests__/unit/competitor-actions.test.ts  # 22
npx vitest run   # 243 passing, 7 skipped, 1 failing suite (pre-existing rls-isolation)
```

---

## 2026-02-23 — Pre-Phase 3 Groundwork: Competitor Intercept Foundations (Complete)

**Goal:** Lay every foundational element — types, helpers, fixtures, seed data, sidebar routing, MSW handlers, and AI_RULES — required for a robust Phase 3 (Competitor Intercept) sprint with zero ad-hoc decisions.

**Scope:**

| File | Change |
|------|--------|
| `lib/types/ground-truth.ts` | Added `GapAnalysis` interface (§15.5) for `competitor_intercepts.gap_analysis` JSONB column. Single source of truth per AI_RULES §9. |
| `lib/plan-enforcer.ts` | Added `maxCompetitors(plan)` helper — trial=0, starter=0, growth=3, agency=10. Prevents inline limit checks per AI_RULES §5. |
| `src/__tests__/unit/plan-enforcer.test.ts` | Added 4 tests for `maxCompetitors` (trial, starter, growth, agency). Updated header comment "all 4 exported" → "all 5 exported". |
| `src/__fixtures__/golden-tenant.ts` | Added `MOCK_COMPETITOR` and `MOCK_INTERCEPT` canonical fixtures with stable UUIDs matching seed.sql §13. All Phase 3 tests must import from here (AI_RULES §4). |
| `supabase/seed.sql` | Added Section 13: competitor + intercept seed data. Cloud 9 Lounge competitor record (UUID `a1eebc99-...`) and head-to-head intercept result (UUID `a2eebc99-...`, `gap_magnitude='high'`, `gap_analysis` as JSONB). |
| `components/layout/Sidebar.tsx` | Renamed `/dashboard/share-of-voice` nav label "Compete" → "Share of Voice". Added new disabled entry `{ href: '/dashboard/compete', label: 'Compete', icon: Swords, active: false }` for Phase 3 route. Added `Swords` to lucide-react imports. |
| `src/mocks/handlers.ts` | Updated OpenAI handler to discriminate by `body.model`: `gpt-4o` → Magic Menu OCR (Phase 18); `gpt-4o-mini` → Competitor Intercept Analysis (Phase 3). Added `MOCK_INTERCEPT_ANALYSIS` fixture. Updated file header comment per AI_RULES §19.3. |
| `AI_RULES.md` | Added §19 (Competitor Intercept rules): §19.1 `GapAnalysis` import requirement, §19.2 `maxCompetitors()` mandate, §19.3 MSW model discrimination pattern, §19.4 fixture canonical data. Updated §5 to list 5 exported plan-enforcer functions. |
| `docs/14_TESTING_STRATEGY.md` | Updated `plan-enforcer.test.ts` row 12→16 tests. Updated totals 217→221. Updated header source note. |

**Tests added:**
- `src/__tests__/unit/plan-enforcer.test.ts` — **+4 tests** (`maxCompetitors`: trial=0, starter=0, growth=3, agency=10). Total: 16 tests in this suite.

**Run command:**
```bash
npx vitest run src/__tests__/unit/plan-enforcer.test.ts   # 16 tests passing
grep -cE "^\s*(it|test)\(" src/__tests__/unit/plan-enforcer.test.ts  # 16
npx vitest run   # 221 passing, 7 skipped, 1 failing suite (pre-existing rls-isolation)
```

---

## 2026-02-23 — Phase 22: Launch Readiness — Rate Limiting + Build Plan Reconciliation (Complete)

**Goal:** Close the one unbounded-cost gap deferred from Phase 21 (`runFreeScan` rate limiting), satisfy the Phase 2 edge-cache acceptance criterion, and reconcile 176 stale build-plan checkboxes that were never ticked despite the work being done.

**Scope:**

| File | Change |
|------|--------|
| `app/actions/marketing.ts` | Extended `ScanResult` to a discriminated union (`status: 'fail' \| 'rate_limited'`). Added `checkRateLimit()` — 5 scans/IP/24 h via Vercel KV; bypassed when `KV_REST_API_URL` absent; wrapped in `try/catch` per AI_RULES §17. |
| `app/_components/ViralScanner.tsx` | Added `rate_limited` branch before `fail` card render. Property access now guarded by `result?.status === 'fail'` discriminant — fixes TypeScript errors introduced by union type. |
| `app/m/[slug]/page.tsx` | Added `export const revalidate = 86400` (Next.js ISR, 24h). Satisfies Phase 2 acceptance criterion "< 200ms edge cached". |
| `.env.test` | Added `KV_REST_API_URL=` and `KV_REST_API_TOKEN=` (intentionally empty → rate limiting bypassed in dev/CI). |
| `docs/09-BUILD-PLAN.md` | Full Phase 0–2 reconciliation: ~130 items ticked `[x]`, architectural deviation note added (Server Actions vs REST Route Handlers), E2E spec references corrected (`free-hallucination-check.spec.ts` → `tests/e2e/01-viral-wedge.spec.ts`; `json-ld-generator.test.ts` → `generateMenuJsonLd.test.ts`; `magic-menu-pipeline.test.ts` → `tests/e2e/04-magic-menu-pipeline.spec.ts`). |
| `docs/14_TESTING_STRATEGY.md` | Added `rate-limit.test.ts` row (6 tests). Corrected two stale counts: `generateMenuJsonLd.test.ts` 21→30, `parseCsvMenu.test.ts` 17→20. Updated total 211→217 across 14 suites. |
| `AI_RULES.md` | No new rules — rate limiting pattern is already covered by §17 (Side-Effect Resilience). |

**Tests added:**
- `src/__tests__/unit/rate-limit.test.ts` — **6 Vitest tests.** Validates `checkRateLimit()` behavior via `runFreeScan`: under limit (count=1), at limit (count=5), over limit (count=6), `retryAfterSeconds` sourced from KV `ttl()`, bypass when `KV_REST_API_URL` absent, resilience when `kv.incr()` throws.

**Run command:**
```bash
npx vitest run src/__tests__/unit/rate-limit.test.ts   # 6 tests passing
grep -cE "^\s*(it|test)\(" src/__tests__/unit/rate-limit.test.ts  # 6
npx vitest run   # 217 passing, 7 skipped, 1 failing suite (pre-existing rls-isolation)
```

**Build plan checkboxes ticked in this phase:**
- Phase 0: All Supabase setup, Next.js scaffold, Auth Flow, Stripe Setup, Testing Infrastructure confirmed complete
- Phase 1: Full Intelligence Backend, Cron Job, Viral Free Tool (incl. rate limiting), Risk Dashboard (Server Actions), Alert Emails
- Phase 2: Full Menu Digitizer, Review Interface, Public Edge Layer (incl. ISR), Dashboard Integration
- Genuinely incomplete items left unchecked with `(Phase 23)` notes: `auth-flow.test.ts`, `stripe-webhook.test.ts`, page view counter analytics, `llms-txt-generator.test.ts`, Vercel/DNS infrastructure items

---

## 2026-02-23 — Phase 21: Tier 1 Gap Closure Sprint (Complete)

**Goal:** Close 7 concrete gaps blocking "Tier 1 Painkiller" acceptance criteria identified by cross-referencing `docs/09-BUILD-PLAN.md` and `docs/roadmap.md`. No application regression — all existing tests continue to pass.

**Gaps closed:**

| # | Gap | Fix |
|---|-----|-----|
| 1 | Systemic Zod v4 bug (9 instances, 6 files) | Replace `.errors[0]?.message` → `.issues[0]?.message` (AI_RULES §8) |
| 2 | Missing Phase 1 acceptance-criteria tests | Created `reality-score.test.ts`, `hallucination-classifier.test.ts`, `plan-enforcer.test.ts` |
| 3 | Zero SOV coverage | Created `share-of-voice-actions.test.ts` (16 tests) |
| 4 | No email alerts after hallucination detection | Installed `resend`, created `lib/email.ts`, wired into cron audit route |
| 5 | No `verifyHallucinationFix()` Server Action | Added to `app/dashboard/hallucinations/actions.ts` + 8 tests |
| 6 | No GitHub Actions CI pipeline | Created `.github/workflows/test.yml` |
| 7 | Phase 18 DEVLOG entry still "In Progress" | Updated to Completed (see below) |

**Zod v4 files fixed:**

| File | Instances |
|------|-----------|
| `app/dashboard/actions.ts` | 1 |
| `app/dashboard/share-of-voice/actions.ts` | 2 |
| `app/dashboard/integrations/actions.ts` | 2 |
| `app/dashboard/hallucinations/actions.ts` | 1 |
| `app/dashboard/magic-menus/actions.ts` | 1 |
| `app/dashboard/magic-menus/[id]/actions.ts` | 2 |

**New files created:**

| File | Purpose |
|------|---------|
| `lib/plan-enforcer.ts` | Pure plan-tier gate helpers (`canRunDailyAudit`, `canRunSovEvaluation`, `canRunCompetitorIntercept`, `maxLocations`) |
| `lib/email.ts` | `sendHallucinationAlert()` via Resend; no-ops gracefully when `RESEND_API_KEY` absent |
| `lib/schemas/evaluations.ts` | `VerifyHallucinationSchema` + `VerifyHallucinationInput` type added |
| `.github/workflows/test.yml` | CI: Vitest unit+integration on push/PR to main |

**Tests added (verified via `grep -cE "^\s*(it|test)\("`):**

| File | Tests | Subject |
|------|-------|---------|
| `src/__tests__/unit/reality-score.test.ts` | 8 | `deriveRealityScore()` formula — pure function, no mocks |
| `src/__tests__/unit/hallucination-classifier.test.ts` | 8 | `auditLocation()` — demo fallback + OpenAI path |
| `src/__tests__/unit/plan-enforcer.test.ts` | 12 | `canRunDailyAudit`, `canRunSovEvaluation`, `canRunCompetitorIntercept`, `maxLocations` |
| `src/__tests__/unit/share-of-voice-actions.test.ts` | 16 | `addTargetQuery` + `runSovEvaluation` (mocked Supabase + fetch) |
| `src/__tests__/unit/verify-hallucination.test.ts` | 8 | `verifyHallucinationFix()` — auth, cooldown, audit, status update |
| `src/__tests__/unit/cron-audit.test.ts` | +2 (→9) | Email alert path + email failure resilience |

**Full suite result:** `211 passing, 7 skipped` (pre-existing `rls-isolation.test.ts` skips — require live Supabase). 0 new failures.

**AI_RULES.md additions (§§14–18) — engineering constraints discovered this phase:**

| Section | Rule |
|---------|------|
| §14 | Zod v4 enum error format — always `.toMatch(/keyword/i)` in tests, never `.toContain('a or b')` |
| §15 | `is_primary` Ghost Data prevention — `createLocation()` must set `is_primary: true` when no primary exists |
| §16 | `revalidatePath` must target the consuming layout (`/dashboard`), not just the sub-route |
| §17 | Side-effect resilience — email/webhooks/analytics must be wrapped in `.catch()` |
| §18 | `createClient()` vs `createServiceRoleClient()` role selection + belt-and-suspenders `.eq('org_id')` on SELECTs |

Also updated: §3 (two auth helper distinction), §4 (Server Action mock patterns), §5 (`lib/plan-enforcer.ts` reference), §13.5 (added `docs/14_TESTING_STRATEGY.md` and `docs/09-BUILD-PLAN.md` to Definition of Done).

---

## 2026-02-23 — Phase 20: Documentation Sync Sprint (Complete)

**Goal:** Eliminate documentation drift accumulated across Phases 12–19 by synchronizing
`AI_RULES.md` and the `/docs` directory with the engineering realities captured in `DEVLOG.md`
and the completed test suites. No application code modified.

**Changes made:**

| File | Change |
|------|--------|
| `AI_RULES.md` | Added §§7–13: UUID hex constraint, Zod v4 `issues` syntax, ground-truth types, `hours_data` closed-day encoding, RLS Shadowban pattern, Tailwind literal classes, DEVLOG living record rule (§13 — Definition of Done checklist, test count verification, entry format) |
| `supabase/seed.sql` | Audited — all UUIDs confirmed valid hex (0-9, a-f); `hours_data` encoding verified correct. No changes required. |
| `docs/13_CORE_LOOP_V1.md` | **Created.** Documents the 5-stage V1 user journey (Acquire → Calibrate → Monitor → Fix → Distribute) with exact component/file references and E2E coverage links for each stage. |
| `docs/14_TESTING_STRATEGY.md` | **Created.** Documents the two-layer test stack (Vitest 157 passing + Playwright 25 passing), full suite inventory with test counts, key engineering decisions, and the `npx supabase db reset` prerequisite. Corrected test counts (verified via `grep -cE`): `layout.test.ts` 15→16, `TruthCalibrationForm.test.tsx` 26→32, `onboarding-actions.test.ts` 16→15, `cron-audit.test.ts` 10→7. |
| `DEVLOG.md` | Added Phase 12.5 entry (85 unit tests for Phase 11+12 debt). Added "Tests added" subsections to Phase 9 (cron-audit: 7 tests) and Phase 11 (DashboardShell: cross-reference). Fixed `auth-routes.test.ts` count 13→15. Marked "Testing Debt" Lessons Learned bullet as ✅ Cleared. |

**New AI_RULES sections (§§7–12) — sources:**

| Rule | Source in DEVLOG |
|------|-----------------|
| §7 UUID hex constraint | "Lessons Learned / Edge Cases" — Phase 10 UUID bug (`g0`/`g1` prefix crash) |
| §8 Zod v4 `issues` syntax | `app/onboarding/actions.ts` uses `.issues[0]`; multiple other files have the old `.errors[0]` pattern that this rule corrects |
| §9 Ground truth types | "Lessons Learned" — "Doc 03 §15 Types Rule (Phase 12 retrospective)" |
| §10 `hours_data` closed-day encoding | "Lessons Learned" — "`hours_data` closed-day encoding (Phase 12 retrospective)" |
| §11 RLS Shadowban | Phase 4 — "🔴 The RLS Shadowban (Most Critical Learning from Phase 4)" |
| §12 Tailwind literal classes | `DashboardShell.test.tsx` class assertions + Phase 11 Deep Night design tokens |

---

## 2026-02-22 — Bug Fix: "Ghost Data" — New User's Location Disappears After Navigation

**Symptoms reported:**
1. New user signs up → bypasses onboarding guard → adds a location → location briefly appears.
2. After navigating away and back, the location "disappears" (unusable for magic-menus).
3. Magic-menus page shows "No location found" even though the location IS in the DB.

**Root cause: `createLocation` never set `is_primary = TRUE`.**

The DB schema defaults `is_primary` to `FALSE`. Every query that matters in the product filters by `.eq('is_primary', true)`:
- `DashboardLayout` OnboardingGuard — finds `null` → guard never fires → user bypasses onboarding
- `app/dashboard/magic-menus/page.tsx` → finds `null` → "No location found"
- `app/onboarding/page.tsx` → finds `null` → redirects back to dashboard

Result: the location existed in `locations` table (visible on the Locations list page), but was invisible to every other feature. Users perceived this as the location "disappearing."

**Secondary bug: `fetchLocations()` had no `org_id` filter.**

The function relied entirely on RLS. Because two SELECT policies are OR'd by PostgreSQL (`org_isolation_select` + `public_published_location`), any org that has published a magic_menu has its location exposed to all authenticated users. A new user might see Charcoal N Chill's location in their list.

**Fixes applied:**

| File | Change |
|------|--------|
| `app/dashboard/actions.ts` | `createLocation`: check if org has an existing primary location; if not, set `is_primary: true`. Also revalidates `/dashboard` (not just `/dashboard/locations`) so the OnboardingGuard fires on the next RSC render. |
| `app/dashboard/locations/page.tsx` | `fetchLocations(orgId)` now accepts and applies an explicit `.eq('org_id', orgId)` filter — belt-and-suspenders alongside RLS. |
| `app/dashboard/layout.tsx` | Added comment explaining why the 0-location case intentionally does NOT redirect: doing so causes an infinite loop because `/dashboard/locations` is inside this layout. The `createLocation` fix makes the guard fire naturally after the first location is added. |

**Intended user flow after fix:**
1. New user signs up → 0 locations → guard doesn't fire → sees dashboard + Locations empty state.
2. User clicks "Add Location" → `createLocation` inserts with `is_primary: TRUE`.
3. `revalidatePath('/dashboard')` fires → RSC re-render → OnboardingGuard finds primary location with null data → **redirects to `/onboarding`**.
4. User completes onboarding form → `saveGroundTruth` updates `hours_data` + `amenities`.
5. Guard no longer fires. Dashboard is fully operational.

---

## 2026-02-22 — Phase 19: E2E Test Hardening Sprint (Complete)

**Goal:** Pay down Phases 12–16 testing debt with a definitive Playwright E2E Functional Test Suite. No app code modified — only test infrastructure and the five new spec files.

**Test suite: 25 tests across 10 spec files — 25/25 passing in ~28s**

| Spec | Tests | Coverage |
|------|-------|----------|
| `01-viral-wedge.spec.ts` | 3 | Public scanner → hallucination card → CTA → /login |
| `02-onboarding-guard.spec.ts` | 1 | Auth guard fires, wizard completes, /dashboard redirect |
| `03-dashboard-fear-first.spec.ts` | 5 | AlertFeed leads, Reality Score=87, hamburger, Listings nav |
| `04-magic-menu-pipeline.spec.ts` | 1 | Simulate AI Parsing → triage → certify → publish → modal |
| `05-public-honeypot.spec.ts` | 4 | JSON-LD, llms.txt, ai-config.json |

**Infrastructure delivered:**

| File | Purpose |
|------|---------|
| `tests/e2e/global.setup.ts` | Admin API provisioning: e2e-tester@ (delete+recreate), reset incomplete@ location, reset upload@ magic menu. Saves 4 auth sessions. |
| `playwright.config.ts` | Updated: serial workers (workers:1) to prevent intra-run race on shared upload@ user; MSW + Stripe-clear web server command. |
| `tests/e2e/hybrid-upload.spec.ts` | Added beforeAll reset hook so CSV upload path always starts from UploadState regardless of run order. |
| `tests/e2e/viral-wedge.spec.ts` | Removed racy "Scanning AI Models" isPending assertion. |

**Key engineering decisions:**
- `workers: 1` serializes spec files to prevent the intra-run race where `hybrid-upload.spec.ts` (beforeAll reset) and `04-magic-menu-pipeline.spec.ts` (create+publish) share the upload@ user
- Tier count assertions in `04-magic-menu-pipeline.spec.ts` omit exact item counts because real OpenAI (when key is set) returns different confidence values than the deterministic mock fallback
- `05-public-honeypot.spec.ts` scopes business name heading to `level: 1` to avoid strict mode violation against the Menu schema `<h2>`

---

## 2026-02-22 — Phase 20: Automated Web Audit Engine (In Progress)

**Goal:** A background cron job that scans every paying org's primary location for AI hallucinations and persists findings to `ai_hallucinations`. No user interaction required — fires on a Vercel Cron schedule.

**Architecture (separation of concerns):**

| Layer | File | Responsibility |
|-------|------|----------------|
| Route Handler | `app/api/cron/audit/route.ts` | Auth guard → fetch paying orgs → loop → insert results |
| AI Service | `src/services/ai-audit.service.ts` | Build prompt → call OpenAI → parse & return `DetectedHallucination[]` |

**Security:** Route requires `Authorization: Bearer <CRON_SECRET>`. Uses `createServiceRoleClient()` (service role key, RLS bypassed) — mandatory because there is no user session in a background job. The user-scoped `createClient()` would silently return empty data through RLS.

**Resilience:** Each org is wrapped in an individual `try/catch` inside a `for...of` loop. One org's OpenAI failure does not abort the run — `summary.failed` increments and the loop continues.

**Plan gating:** Only orgs with `plan IN ('growth', 'agency') AND plan_status = 'active'` are processed. Trial and Starter orgs are excluded.

**Demo mode:** When `OPENAI_API_KEY` is absent (local dev, CI), `auditLocation()` returns a single placeholder hallucination so the full insert pipeline can be exercised without a real API key.

**Required env vars:**
```
# .env.local (add)
CRON_SECRET=<generate a random 32-char secret>

# .env.test (add)
CRON_SECRET=test-cron-secret-abc
```
(`OPENAI_API_KEY` is already present from Phase 18 AI wiring.)

**Vercel Cron config** (`vercel.json` — add when deploying):
```json
{
  "crons": [{ "path": "/api/cron/audit", "schedule": "0 6 * * *" }]
}
```

---

## 2026-02-22 — All Playwright E2E Tests Passing ✓

All tests in the suite are now green. Final two fixes were strict mode violations in `tests/e2e/hybrid-upload.spec.ts`:

- `getByText('Auto-Approved')` resolved to 2 elements: the section heading `<p>Auto-Approved — 2 items</p>` and a legend badge `<span>Auto-approved</span>`. Fixed by narrowing to `getByText(/Auto-Approved —/i)`.
- `getByText('Must Edit')` resolved to 2 elements: the section heading and an always-visible legend `<span>Must edit</span>`. Fixed by narrowing to `getByText(/Must Edit —/i)`.

**Pattern:** When a ReviewState UI has both section headings and static legend badges sharing similar text, always target the heading via the ` — N items` suffix (e.g. `/Auto-Approved —/i`) rather than the bare label string.

---

## 2026-02-22 — Bug Fix: `magic-menus` page shows "No location found" for valid users

**Symptom:** `upload@localvector.ai` navigated to `/dashboard/magic-menus` without being redirected by the Onboarding Guard (correct), but the page rendered the empty state: _"No location found. Add a location first before creating your Magic Menu."_ The upload tabs never appeared.

**Investigation path:**
1. Confirmed seed data is correct — location row exists with `org_id = c0eebc99-...`, `is_primary = TRUE`, non-null `hours_data`/`amenities`.
2. Confirmed the full auth chain resolves: `auth.users` → `public.users` (via `auth_provider_id`) → `memberships` → org `c0eebc99-...`.
3. Confirmed `current_user_org_id()` returns the right org when run under the upload user's JWT claims.
4. Noticed the dashboard layout query (which correctly passed the Onboarding Guard) uses `.eq('org_id', ctx.orgId)` as an explicit filter **in addition to** RLS. The magic-menus page query did **not**.

**Root cause:** PostgreSQL evaluates multiple RLS policies for the same table/operation with OR logic. Two SELECT policies are active on `public.locations`:
- `org_isolation_select`: `USING (org_id = current_user_org_id())` — the upload user's location ✓
- `public_published_location` (added by migration `20260221000001`): `USING (EXISTS (SELECT 1 FROM magic_menus WHERE location_id = locations.id AND is_published = TRUE))` — Charcoal N Chill's location, because the golden tenant has a published magic menu ✓

Both policies passed for different locations. The query `.eq('is_primary', true)` returned **2 rows** (one per org). Supabase's `.maybeSingle()` returns `{ data: null }` when >1 rows match — and the page treated `null` data as "no location found."

The dashboard `layout.tsx` never surfaced this because it adds `.eq('org_id', ctx.orgId)` explicitly, narrowing to exactly 1 row. The magic-menus `page.tsx` was the only location query relying on RLS alone.

**Fix:** `app/dashboard/magic-menus/page.tsx` — added `orgId` parameter to `fetchWorkspaceData()` and `.eq('org_id', orgId)` to the locations query. `orgId` is sourced from `ctx.orgId` (already resolved by `getSafeAuthContext()` in the page). Matches the belt-and-suspenders pattern used by `layout.tsx`.

**Rule going forward:** Any query on a table that has both a tenant-isolation policy AND a public/published policy must include an explicit `.eq('org_id', orgId)` filter alongside RLS. Relying on RLS alone is unsafe when multiple policies can return rows from different orgs.

---

## 2026-02-22 — Phase 18: Monetization — Stripe Checkout & Webhooks (Complete)

**Goal:** Wire the billing UI's "Upgrade" buttons to real Stripe Checkout Sessions and handle `checkout.session.completed` / `customer.subscription.updated` webhooks to upgrade the org's `plan` tier in Supabase.

**Key schema facts (from `prod_schema.sql`):**
- Stripe billing fields live on `organizations` (not `locations`): `stripe_customer_id`, `stripe_subscription_id`, `plan plan_tier`, `plan_status plan_status`. **No ALTER TABLE needed.**
- `plan_tier` enum = `'trial' | 'starter' | 'growth' | 'agency'`. UI plan names (`'pro'`, `'enterprise'`) map as: `pro → growth`, `enterprise → agency`.
- `plan_status` enum = `'trialing' | 'active' | 'past_due' | 'canceled' | 'paused'`.

**Required env vars (add to `.env.local` / Vercel dashboard):**
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_PRICE_ID_ENTERPRISE=price_...
NEXT_PUBLIC_APP_URL=https://app.localvector.ai
```

---

## 2026-02-22 — Phase 14.5: Hybrid Menu Upload & AEO Schema Generation (Complete)

**Goal:** Build the three-tab hybrid upload pipeline specified in Doc 04b. Zero regression on existing Confidence Triage UI and Playwright E2E tests.

**Scope:**
- `lib/utils/schemaOrg.ts` — `DIETARY_TAG_MAP` + `mapDietaryTagsToSchemaUris()`: free-text dietary tags → Schema.org `RestrictedDiet` URIs.
- `lib/utils/generateMenuJsonLd.ts` — `generateMenuJsonLd()`: `MenuExtractedData` + location info → Schema.org `Menu`/`MenuItem` JSON-LD object with `image` and `suitableForDiet`.
- `lib/utils/parseCsvMenu.ts` — `parseLocalVectorCsv()`: PapaParse parser for the 6-column LocalVector AEO template; all items `confidence = 1.0`.
- `lib/utils/parsePosExport.ts` — `parsePosExportWithGPT4o()`: sends raw POS CSV to `gpt-4o` (`json_object` mode); mirrors Phase 18 structure; returns `null` on any failure.
- `app/dashboard/magic-menus/actions.ts` — `uploadLocalVectorCsv(formData)` + `uploadPosExport(formData)` Server Actions; both return `MenuWorkspaceData` via same upsert pattern as `simulateAIParsing`.
- `app/dashboard/magic-menus/_components/UploadState.tsx` — upgraded to 3-tab UI (`ai | csv | pos`); Tab 1 unchanged and MSW-tested; Tabs 2 and 3 call new Server Actions and feed into identical `onParseComplete` callback.

**Zero-Regression Directives:**
- `ReviewState.tsx`, `MenuWorkspace.tsx`, and all Playwright tests untouched.
- MSW `openAiHandler` already intercepts POS Export GPT-4o calls during E2E — no new MSW handler needed.
- All CSV/POS errors surface as `{ success: false, error }` — no 500s.

**Tests added (Phase 14.5 sprint):**
- `src/__tests__/unit/parseCsvMenu.test.ts` — 20 Vitest unit tests: all CSV branches, Image_URL validation, header normalisation, row limit, confidence = 1.0, template generator round-trip.
- `src/__tests__/unit/generateMenuJsonLd.test.ts` — 30 Vitest unit tests: Restaurant/MenuSection/MenuItem structure, dietary tag mapping (string + array paths), deduplication, unmapped tag drops, price normalisation, subjectOf AI agent link.
- `tests/fixtures/sample-gold-menu.csv` — 2-item Gold Standard CSV fixture (Brisket Plate + Mac & Cheese).
- `tests/e2e/hybrid-upload.spec.ts` — Playwright E2E: logs in as `upload@localvector.ai`, asserts 3 tabs visible, uploads fixture CSV, asserts ReviewState transition + "Auto-Approved" items.
- `supabase/seed.sql §12` — added `upload@localvector.ai` (complete location, no magic menu) as E2E test user.

**Run commands:**
```bash
# Unit tests (50 tests, ~300ms)
npx vitest run src/__tests__/unit/parseCsvMenu.test.ts src/__tests__/unit/generateMenuJsonLd.test.ts

# E2E test (requires local Supabase + dev server)
npx supabase db reset && npx playwright test tests/e2e/hybrid-upload.spec.ts
```

---

## 2026-02-22 — Phase 17: Auth & Billing UI (Complete)

**Goal:** Implement the split-screen login page with Fear/Greed marketing copy, a `/signup` alias for the register form, a three-tier billing page with mock Stripe checkout, and Playwright E2E tests locking down all new flows.

**Scope:**
- `app/(auth)/layout.tsx` — Converted to bare passthrough; each auth page owns its layout/centering.
- `app/(auth)/login/page.tsx` — Full-screen split-screen: left panel (`bg-midnight-slate`) with Fear/Greed marketing copy; right panel with the login form. Error banner uses `alert-crimson` design token (was `red-*` Tailwind). Left panel is `hidden lg:flex` for mobile.
- `app/(auth)/register/page.tsx` — Added outer centering wrapper (`flex min-h-screen items-center justify-center bg-slate-50`).
- `app/(auth)/signup/page.tsx` — New route; re-exports `RegisterPage` so `/signup` and `/register` are identical.
- `proxy.ts` — Added `/signup` to `AUTH_PREFIXES` so authenticated users are redirected to dashboard.
- `components/layout/Sidebar.tsx` — Billing nav item activated (`active: true`, `href: '/dashboard/billing'`).
- `app/dashboard/billing/actions.ts` — `createCheckoutSession(plan)` Server Action. Returns `{ url: null, demo: true }` when `STRIPE_SECRET_KEY` is absent; real Stripe integration wired in future phase.
- `app/dashboard/billing/page.tsx` — Three-tier pricing page (Free Scanner / Pro AI Defense / Enterprise API). Pro tier uses `border-2 border-electric-indigo` highlight. Upgrade button calls the Server Action and swaps to a "Demo mode" banner in local dev.
- `tests/global-setup.ts` — Refactored to save two sessions: `incomplete-user.json` (onboarding test) + `upload-user.json` (billing + upload tests). Extracted shared `loginAndSave()` helper.

**Tests added (Phase 17 Addendum):**
- `tests/e2e/auth.spec.ts` — 3 Playwright tests: split-screen + Fear/Greed copy visible on `/login`; invalid credentials → `alert-crimson` error; `/signup` form renders all 4 fields.
- `tests/e2e/billing.spec.ts` — 2 Playwright tests (uses `upload-user.json`): three tiers visible + `border-electric-indigo` on Pro card; Upgrade button → "Demo mode" banner.

**Design decisions:**
- `incomplete@localvector.ai` triggers the onboarding guard for all `/dashboard/*`, so billing tests use `upload@localvector.ai` (complete location, no magic menu). Billing should architecturally be accessible pre-onboarding; exempting it from the guard is a future hardening task.
- `/signup` is a re-export, not a redirect, to avoid an extra HTTP round-trip on the marketing CTA path.

**Run commands:**
```bash
# Reset DB (seeds both test users), then run all E2E tests
npx supabase db reset && npx playwright test tests/e2e/auth.spec.ts tests/e2e/billing.spec.ts

# Run auth tests only
npx playwright test tests/e2e/auth.spec.ts

# Run billing tests only
npx playwright test tests/e2e/billing.spec.ts
```

---

## 2026-02-22 — Phase 18: Waking up the AI (Complete)

Replace mock delays with real LLM integrations:
- **Fear Engine** (`app/actions/marketing.ts`): `runFreeScan` calls Perplexity `sonar` model. Requests strict JSON output via system prompt. Falls back to demo result when `PERPLEXITY_API_KEY` is absent.
- **Magic Engine** (`app/dashboard/magic-menus/actions.ts`): `simulateAIParsing` calls OpenAI `gpt-4o` with `response_format: { type: "json_object" }`. Validates response with Zod against `MenuExtractedData` schema. Falls back to hardcoded Charcoal N Chill mock when `OPENAI_API_KEY` is absent.
- **MSW contract preserved**: `playwright.config.ts` now starts the dev server with `NEXT_PUBLIC_API_MOCKING=enabled` so MSW intercepts both AI API URLs during E2E runs. Perplexity handler updated to return JSON content for clean server-action parsing.

---
## Lessons Learned / Edge Cases

- **PostgreSQL UUID Syntax Constraints (Phase 10):** When generating mock UUIDs for `seed.sql` files, never increment the starting character beyond `f`. UUIDs are strictly hexadecimal (0-9, a-f). Generating a mock UUID that begins with `g` (e.g., `g0eebc99...`) will cause a fatal `invalid input syntax for type uuid` error during `npx supabase db reset`. Always stick to valid hex characters (e.g., `a`, `b`, `c`, `d`, `e`, `f`) when manually creating dummy UUIDs.

- **Testing Debt (Phases 11–12) — ✅ Cleared in Phase 12.5:** AI_RULES §4 requires test files to be created *before* feature code ("Red-Green-Refactor"). Phases 11 and 12 skipped this step. Tests for the Deep Night shell (Sidebar, TopBar, DashboardShell), the onboarding wizard (TruthCalibrationForm), the saveGroundTruth Server Action, and the dashboard onboarding guard were written retroactively in Phase 12.5. See Phase 12.5 for the full test inventory (85 tests: 22 + 16 + 32 + 15). All tests use the Charcoal N Chill golden-tenant fixture and MSW handlers — no live API calls.

- **Doc 03 §15 Types Rule (Phase 12 retrospective):** The canonical JSONB interfaces live in `lib/types/ground-truth.ts`. Every file that touches `hours_data`, `amenities`, `categories`, or `attributes` on the `locations` table MUST import from there. Ad-hoc inline type definitions are a spec violation (AI_RULES §2).

- **`hours_data` closed-day encoding (Phase 12 retrospective):** A missing day key in `hours_data` means "hours unknown", NOT "closed". Use the string literal `"closed"` to explicitly mark a day as closed. The Zod schema in `app/onboarding/actions.ts` accepts `z.literal('closed') | z.object({ open, close })`.

---
## 2026-02-22 — Phase 19: Test Hardening Sprint (Completed)

**Goal:** Pay off testing debt accumulated in Phases 12–16. Sync `docs/03-DATABASE-SCHEMA.md` to match reality (ai_hallucinations schema + MenuExtractedData shape). Wire up Playwright E2E infrastructure with MSW (Mock Service Worker) for forward-looking Phase 18 AI call interception. Write two passing E2E tests: (1) the Viral Wedge public scanner flow, and (2) the Onboarding Guard full round-trip (login → guard redirect → form fill → dashboard).

**Scope:**

- `docs/03-DATABASE-SCHEMA.md` — Update §15.5 (`MenuExtractedData`) to match `lib/types/menu.ts`. Add §15.11 with `AiHallucination` TypeScript interface, confirming `model_provider` (not `engine`), `correction_status` (not `is_resolved`), all enum values lowercase, and tracking fields (`occurrence_count`, `first_detected_at`, `last_seen_at`).

- `playwright.config.ts` — Playwright configuration: `testDir: ./tests/e2e`, `timeout: 30s` (accommodates 2s mock delay in `runFreeScan`), `globalSetup` for auth state, `webServer` with `reuseExistingServer`.

- `src/mocks/handlers.ts` + `src/mocks/node.ts` — MSW v2 Node.js server with forward-looking handlers for Phase 18: OpenAI completions (returns `MenuExtractedData` JSON) and Perplexity completions (returns hallucination payload matching updated schema).

- `instrumentation.ts` — Next.js instrumentation hook that activates MSW only when `NEXT_PUBLIC_API_MOCKING=enabled` and `NEXT_RUNTIME=nodejs`.

- `supabase/seed.sql` §11 — Second test user `incomplete@localvector.ai / Password123!` with a fresh org + primary location that has `hours_data=NULL` and `amenities=NULL`, triggering the dashboard Onboarding Guard.

- `tests/global-setup.ts` — Playwright global setup: logs in as `incomplete@localvector.ai` via the real login form, saves browser storage state to `.playwright/incomplete-user.json`.

- `tests/e2e/viral-wedge.spec.ts` — E2E Test 1: visits `/`, fills scanner form, asserts "Scanning AI Models…" pending state, waits for red alert card, asserts CTA → `/login`.

- `tests/e2e/onboarding.spec.ts` — E2E Test 2: loads pre-authenticated state, navigates to `/dashboard/magic-menus`, asserts redirect to `/onboarding`, fills 3-step wizard (including Sunday "closed"), submits, asserts redirect to `/dashboard`.

---
## 2026-02-22 — Phase 16: Landing Page & Viral Wedge (Completed)

**Goal:** Replace the Next.js boilerplate `app/page.tsx` (which just redirected to `/dashboard`) with the full public marketing landing page defined in Docs 07 §2 and 08 §§1-3. Build the free "Hallucination Checker" (`ViralScanner`) widget that mocks a critical ChatGPT hallucination result and funnels visitors to `/login`.

**Scope:**

- `app/actions/marketing.ts` — New Server Action `runFreeScan(formData)`. Extracts `businessName` and `city`, simulates a 2-second delay (no real API calls per AI_RULES §5), returns a hardcoded `FAIL` result (`engine: 'ChatGPT'`, `severity: 'critical'`, `claim_text: 'Permanently Closed'`).

- `app/_components/ViralScanner.tsx` — New `'use client'` component. Two-input form (Business Name + City) with `useTransition` for pending state. When pending: spinner + "Scanning AI Models…". On result: animated red alert card with `border-alert-crimson`, hallucination details, and a full-width CTA linking to `/login`.

- `app/page.tsx` — Full rewrite as a Server Component. Top nav with "LocalVector" brand + "Sign In" link. Hero section with Doc 08 §2 headline/subhead + embedded `<ViralScanner />` + social proof badge ("AI Visibility Score: 98/100"). Tangible Results section with Charcoal N Chill $1,600/month case study (exact copy from Doc 08 §3) and three metric cards.

---
## 2026-02-22 — Phase 15: Public Edge Layer & AI Honeypot (Completed)

**Goal:** Build the three public-facing AI-readable endpoints that AI crawlers consume when a user injects their Magic Menu link into Google. Upgrade the existing Phase 7 public menu page to the "Deep Night" visual identity, inject `openingHoursSpecification` into the Restaurant JSON-LD, and add two new Route Handlers: `llms.txt` (Markdown for LLMs) and `ai-config.json` (GEO Standard entity config).

**Scope:**

- `app/m/[slug]/page.tsx` — Rewritten: expands the Supabase query to include `hours_data`, `amenities`, and `location_id`; adds `openingHoursSpecification` to the Restaurant JSON-LD (built from `hours_data` — handles `"closed"` string per Doc 03 §15.1); restyled from light theme to Deep Night (`bg-midnight-slate`, `bg-surface-dark`, `text-slate-300`); adds Operating Hours and Amenities sections to the HTML; adds footer links to the two new AI endpoints. Imports `HoursData`, `DayHours`, `Amenities` from `lib/types/ground-truth.ts` — no inline type invention.

- `app/m/[slug]/llms.txt/route.ts` — Route Handler returning `text/plain`. Builds a structured Markdown document (llms.txt standard) with: business name, address, hours (formatted 12h, "Closed" for closed days, "Hours not specified" for missing keys), amenities, and a full menu item list grouped by category with names, prices, and descriptions. Used by Perplexity, ChatGPT, and other LLM agents as ground truth.

- `app/m/[slug]/ai-config.json/route.ts` — Route Handler returning `application/json`. Emits the GEO Standard config (Doc 08 §10) with `entity` (name, type, location_id, sha256 address_hash), `data_sources` (all URLs derived from `request.url` for correct hostname in dev + prod), `policies`, and `last_updated`. SHA-256 of address computed with Node.js `crypto.createHash`.

---
## 2026-02-22 — Phase 14: Magic Menu UX Refactor (Completed)

**Goal:** Upgrade the basic Magic Menu list view to the "Smart Review" workspace defined in Doc 06 §4. The new UI guides users through a three-stage flow: Upload → AI Review → Published, with a Link Injection modal to distribute the menu URL to Google Business Profile and other AI-indexed platforms.

**Scope:**

- `lib/types/menu.ts` — Canonical JSONB types for `magic_menus` table columns (Doc 03 §15.5 Agent Rule): `MenuExtractedItem` (id, name, description?, price?, category, confidence 0–1), `MenuExtractedData` (items[], extracted_at, source_url?), `PropagationEvent`, `MenuWorkspaceData`.

- `app/dashboard/magic-menus/actions.ts` — Three new Server Actions appended: `simulateAIParsing(locationId)` — creates menu record if absent, populates mock `extracted_data` for Charcoal N Chill, advances status to `review_ready`, returns updated `MenuWorkspaceData`; `approveAndPublish(menuId)` — marks `human_verified = true`, `processing_status = 'published'`, `is_published = true`, appends `{ event: 'published', date }` to `propagation_events`, revalidates public Honeypot page; `trackLinkInjection(menuId)` — appends `{ event: 'link_injected', date }` to `propagation_events` (gated by existing `tenant_link_injection_update` RLS policy from prod_schema.sql).

- `app/dashboard/magic-menus/page.tsx` — Rewritten as a focused Server Component. Fetches primary location + its latest `magic_menu` record. Passes data to `MenuWorkspace`. Existing `[id]` deep-edit route and its components (`AddMenuModal`, `PublishToggle`) are untouched.

- `app/dashboard/magic-menus/_components/MenuWorkspace.tsx` — `'use client'`. Manages `view: 'upload' | 'review' | 'published'` and live `menuData`. Renders appropriate sub-component. Auto-opens `LinkInjectionModal` on first publish.

- `app/dashboard/magic-menus/_components/UploadState.tsx` — Drag-and-drop visual zone + "Simulate AI Parsing" button. 2-second loading state, calls `simulateAIParsing`, transitions to `review` via callback.

- `app/dashboard/magic-menus/_components/ReviewState.tsx` — Confidence Triage: ≥0.85 = ✅ auto-approved (collapsed, emerald); 0.60–0.84 = ⚠️ needs review (expanded, amber); <0.60 = ❌ must edit (expanded, crimson, blocks publish). "I certify this menu is accurate" checkbox + "Publish to AI" button disabled until no ❌ items + checkbox checked.

- `app/dashboard/magic-menus/_components/LinkInjectionModal.tsx` — Modal with public URL display (`/m/{slug}`), Copy Link button, "Open Google Business Profile" external link, and "I pasted this link" CTA that calls `trackLinkInjection(menuId)` and shows a success state.

---
## 2026-02-22 — Phase 13: Reality Score Dashboard (Completed)

**Goal:** Replace the placeholder dashboard page with the full "Fear First" Reality Score Dashboard defined in Doc 06 §3. The screen leads with open hallucination alerts (Red Alert Feed) when any exist, followed by the composite Reality Score Card (Visibility + Accuracy + Data Health), and a Quick Stats row.

**Scope:**

- `app/dashboard/page.tsx` — Server Component. Queries `ai_hallucinations` for open alerts and fixed count in parallel. Derives Reality Score components server-side. Passes data to `RealityScoreCard` and `AlertFeed`. Orders sections "Fear First" (alerts precede score card when open alerts exist).

- `app/dashboard/_components/RealityScoreCard.tsx` — Server Component. Displays composite Reality Score (formula: Visibility×0.4 + Accuracy×0.4 + DataHealth×0.2). Visibility hardcoded 98, Accuracy derived from open alert count, Data Health hardcoded 100 (passed onboarding guard). Color-codes scores: truth-emerald ≥80, amber 60–79, alert-crimson <60.

- `app/dashboard/_components/AlertFeed.tsx` — Server Component. Lists open hallucinations with pulsing `alert-crimson` left border. Shows severity badge, friendly engine name, claim_text, expected_truth, time since detected. "Fix with Magic Menu" CTA links to `/dashboard/magic-menus`. Empty state: "All clear! No AI lies detected." green banner.

- `supabase/seed.sql` Section 10 — Two open hallucinations (CRITICAL/openai-gpt4o + HIGH/perplexity-sonar) plus one fixed (MEDIUM/google-gemini) for the Charcoal N Chill golden tenant.

---
## 2026-02-22 — Phase 12.5: Unit Test Debt Clearance — Phases 11 & 12 (Completed)

**Goal:** Clear the testing debt explicitly flagged in the Lessons Learned section. Phases 11 and
12 shipped feature code before writing tests, violating AI_RULES §4 ("Red-Green-Refactor"). This
sprint writes all missing unit and integration tests for Phase 11 shell components and Phase 12
onboarding components/actions. Every test uses the Charcoal N Chill golden-tenant fixture and MSW
handlers — no live API calls.

**Tests added:**

- `src/__tests__/unit/components/layout/DashboardShell.test.tsx` — **22 Vitest tests** (Phase 11 debt). Covers the Deep Night shell: `DashboardShell` renders `Sidebar` + `TopBar` + `children`; `Sidebar` active route highlighting via `usePathname()`; `TopBar` hamburger fires `onMenuToggle`. Asserts literal Tailwind tokens (`bg-midnight-slate`, `bg-surface-dark/80`, `border-electric-indigo`) — validates AI_RULES §12 (no dynamic class concatenation).

- `src/__tests__/unit/app/dashboard/layout.test.ts` — **16 Vitest tests** (Phase 12 debt). Covers the Dashboard Layout guard: Auth Guard (no session → redirect `/login`); Onboarding Guard — 5 cases: `hours_data=null & amenities=null` → redirect, `hours_data` populated → pass, `amenities` populated → pass, no primary location → redirect, auth missing → redirect; Render Props (`displayName`, `orgName` passed correctly to `DashboardShell`).

- `src/__tests__/unit/components/onboarding/TruthCalibrationForm.test.tsx` — **32 Vitest tests** (Phase 12 debt). Covers the 3-step onboarding wizard: Step 1 (Business Name text input + prefill); Step 2 (amenity toggle state — Outdoor Seating, Serves Alcohol, Takes Reservations); Step 3 (hours grid — Closed toggle produces `"closed"` literal, time inputs produce `{ open, close }` object per AI_RULES §10); Submit path (calls `saveGroundTruth`, navigates on success, shows error on failure).

- `src/__tests__/integration/onboarding-actions.test.ts` — **15 Vitest tests** (Phase 12 debt). Integration coverage for `saveGroundTruth()` Server Action: authentication & authorisation (unauthenticated → error, missing `orgId` → error); Zod v4 validation — uses `parsed.error.issues[0]` (AI_RULES §8); valid `"closed"` literal accepted; valid `{ open, close }` object accepted; invalid shape rejected; DB update writes correct JSONB to `locations`; Supabase error propagated cleanly.

**Vitest run (these 4 files):**
```bash
npx vitest run \
  src/__tests__/unit/components/layout/DashboardShell.test.tsx \
  src/__tests__/unit/app/dashboard/layout.test.ts \
  src/__tests__/unit/components/onboarding/TruthCalibrationForm.test.tsx \
  src/__tests__/integration/onboarding-actions.test.ts
# Expected: 85 tests passing (22 + 16 + 32 + 15)
```

---
## 2026-02-22 — Phase 12: Onboarding Guard & Truth Calibration Wizard (Completed)

**Goal:** Enforce ground-truth collection before the dashboard is accessible. A multi-step wizard (Business Name → Amenities → Hours) collects the "Truth Calibration" data that powers the Fear Engine's hallucination comparisons. The dashboard layout acts as a gate: if `hours_data` AND `amenities` are both null on the primary location, the user is redirected to `/onboarding`.

**Scope (planned):**

- `app/onboarding/actions.ts` — `saveGroundTruth` Server Action. Validates input via Zod, derives `org_id` from `getSafeAuthContext()`, updates the `locations` table (`business_name`, `hours_data` JSONB, `amenities` JSONB). Returns `{ success: true }` — client handles `router.push('/dashboard')`.

- `app/onboarding/page.tsx` — Standalone Server Component (no DashboardShell, no sidebar). Fetches the org's primary location. Passes `locationId` + prefilled data to `TruthCalibrationForm`. Centered `midnight-slate` full-page layout with `electric-indigo` accent.

- `app/onboarding/_components/TruthCalibrationForm.tsx` — `'use client'`. 3-step form with `useTransition` on submit. Step 1: Business Name (text input). Step 2: Amenity toggles (Outdoor Seating, Serves Alcohol, Takes Reservations). Step 3: Hours (7-day grid — each day has a "Closed" toggle or `<input type="time">` for open/close). Submit calls `saveGroundTruth` and navigates to `/dashboard` on success.

- `app/dashboard/layout.tsx` — Onboarding guard added: after auth check, fetches primary location. If `!hours_data && !amenities` → `redirect('/onboarding')`. Runs before shell rendering. Safe for the seeded dev session (prod_schema.sql seed already has full hours + amenities for Charcoal N Chill).

---
## 2026-02-21 — Phase 11: "Deep Night" Visual Identity & Application Shell (Completed)

**Goal:** Transition the functional prototype to the "Deep Night & Neon Insight" design system defined in Doc 06. Replace the current light-themed shell with a dark `midnight-slate` base, a new persistent `Sidebar` and sticky `TopBar`, and responsive mobile layout (hamburger menu at 375px). The shell uses the Server Component → Client Component "shell pattern" to preserve the async `getSafeAuthContext()` call in `layout.tsx` while holding sidebar toggle state in a `DashboardShell` client wrapper.

**Scope (planned):**

- `app/globals.css` — Tailwind v4 `@theme` block extended with Deep Night palette tokens: `midnight-slate` (#0f111a), `surface-dark` (#1a1d27), `electric-indigo` (#6366f1), `alert-crimson` (#ef4444), `truth-emerald` (#10b981). Font aliases for Geist Sans + Mono. Body forced to dark baseline (`background: #0f111a; color: #cbd5e1`).

- `components/layout/Sidebar.tsx` — `'use client'`. Nav items (Dashboard, Alerts, Menu, Compete, Listings, Settings, Billing) with `lucide-react` icons and `usePathname()` active highlighting. Slide-in mobile overlay (`translate-x-full` → `translate-x-0`), always visible on `lg:`. AI Visibility Score (98/100) pinned to footer. Logout button via existing `LogoutButton` component.

- `components/layout/TopBar.tsx` — `'use client'`. Glassmorphism bar (`bg-surface-dark/80 backdrop-blur-md`). LocalVector logo badge + text. Org name display (center). Help + User icons (right). Mobile hamburger (`Menu` from lucide) that fires `onMenuToggle`.

- `components/layout/DashboardShell.tsx` — `'use client'`. Holds `sidebarOpen` boolean state. Renders mobile backdrop overlay, `Sidebar`, `TopBar`, and `<main>` content slot. Accepts `displayName`, `orgName`, `plan` as server-derived props; passes `children` as the RSC slot.

- `app/dashboard/layout.tsx` — Stripped to a minimal Server Component: fetches auth context, assembles display strings, renders `<DashboardShell>` with children. No client-only APIs.

**Tests added (Phase 12.5 retroactive sprint):**
- `src/__tests__/unit/components/layout/DashboardShell.test.tsx` — 22 Vitest tests. See Phase 12.5 for full description.

---
## 2026-02-21 — Phase 10: AI Share of Voice (SOV) Dashboard (Completed)

**Goal:** Build a Share of Voice dashboard that tracks how often AI engines (OpenAI, Perplexity) mention the user's business vs. competitors when asked relevant local search queries. Users define target queries per location, run on-demand SOV evaluations, and see rank position + competitor mentions over time.

**Scope:**

- `supabase/migrations/20260221000004_create_sov_tracking.sql` — Creates `target_queries` (`id`, `org_id`, `location_id`, `query_text` VARCHAR(500), `created_at`) and `sov_evaluations` (`id`, `org_id`, `location_id`, `query_id` FK → target_queries ON DELETE CASCADE, `engine` VARCHAR(20), `rank_position` INTEGER NULL, `mentioned_competitors` JSONB default `[]`, `raw_response` TEXT, `created_at`). All four RLS policies on both tables. Applied via `npx supabase db reset`.

- `supabase/seed.sql` — Section 9 appended: 1 `target_queries` row ("Best BBQ in Alpharetta"), 1 `sov_evaluations` row (OpenAI, rank 2, competitors `["Dreamland BBQ", "Pappadeaux"]`). Fixed UUIDs `c0eebc99-...` (target_query) and `c1eebc99-...` (sov_evaluation). Note: initial attempt used `g0`/`g1` prefixes which are invalid hex — corrected before `db reset` per the UUID hex constraint lesson documented above.

- `lib/schemas/sov.ts` — `AddQuerySchema` (location_id UUID, query_text string 3–500 chars) + `RunSovSchema` (query_id UUID, engine enum). Shared between Server Actions and Client Components.

- `app/dashboard/share-of-voice/actions.ts` — `addTargetQuery` + `runSovEvaluation` Server Actions. Both derive `org_id` from `getSafeAuthContext()`. `runSovEvaluation` checks for API key; if absent → 3-second mock fallback (rank 1, empty competitors). Real path parses LLM JSON response for `rank_position` (null if not mentioned) and `mentioned_competitors` array.

- `app/dashboard/share-of-voice/page.tsx` — Server Component. `Promise.all` fetches: locations, target_queries (newest-first), latest sov_evaluations per query+engine. Renders one `SovCard` per location.

- `app/dashboard/share-of-voice/_components/SovCard.tsx` — `'use client'`. "Add Query" inline form + `useTransition` "Run" buttons per query. Rank display: #1 = emerald, #2–3 = yellow, #4+ = red, null = "Not mentioned". Competitor list shown below each evaluation row.

- `app/dashboard/layout.tsx` — "Share of Voice" nav link added.

---
## 2026-02-21 — Phase 9: AI Hallucination Monitor (Completed)

**Goal:** Build the `ai_evaluations` table and a full Hallucinations Monitor dashboard. A "Run New Audit" button triggers a Server Action that calls the OpenAI API (with a graceful 3-second mock fallback when the API key is absent), stores the result in `ai_evaluations`, and revalidates the page. The UI shows per-location accuracy scores (color-coded), a list of detected hallucinations, and historical evaluation cards with `useTransition` loading states.

**Scope:**

- `supabase/migrations/20260221000003_create_ai_evaluations.sql` — Creates `ai_evaluations` (`id`, `org_id`, `location_id` with `ON DELETE CASCADE`, `engine` VARCHAR(20), `prompt_used` TEXT, `response_text` TEXT, `accuracy_score` INTEGER 0–100 CHECK, `hallucinations_detected` JSONB default `[]`, `created_at`). Three indexes: org, location, and `(location_id, created_at DESC)` for the "latest eval per location" query. All four RLS policies gated on `org_id = current_user_org_id()`. Applied via `npx supabase db reset`.

- `supabase/seed.sql` — Section 8 appended: two evaluation rows for the Charcoal N Chill location — OpenAI at 95/100 with no hallucinations (3 hours ago), Perplexity at 65/100 with two realistic mock hallucinations (1 hour ago). Fixed UUIDs `f0eebc99-...` and `f1eebc99-...`. Also patched: added `CREATE EXTENSION IF NOT EXISTS pgcrypto` and the full `instance_id + confirmation_token + recovery_token` fields to the `auth.users` insert so GoTrue recognises the dev user for login.

- `lib/schemas/evaluations.ts` — `EVALUATION_ENGINES = ['openai', 'perplexity']` const tuple. `RunEvaluationSchema` (location_id UUID, engine enum). `EvaluationEngine` type. Shared between Server Action and Client Component.

- `app/dashboard/hallucinations/actions.ts` — `runAIEvaluation` Server Action. Derives `org_id` from `getSafeAuthContext()`. Fetches location ground-truth data (RLS-scoped) to build a structured audit prompt. Checks `OPENAI_API_KEY` / `PERPLEXITY_API_KEY`: if missing → `await setTimeout(3000)` + deterministic mock result (accuracy 80, two descriptive mock strings); if present → real API call to OpenAI (`gpt-4o`, `response_format: json_object`) or Perplexity (`sonar`); if API call throws → gracefully falls back to mock. Inserts result into `ai_evaluations` with server-derived `org_id`. Calls `revalidatePath('/dashboard/hallucinations')`.

- `app/dashboard/hallucinations/_components/EvaluationCard.tsx` — `'use client'`. One shared `useTransition` + `pendingEngine` state to track which of the two engine buttons is in-flight. Both buttons disabled while any transition is pending (prevents race conditions). "Analyzing…" spinner replaces button text during the 3-second wait. Accuracy score color coding: ≥90 emerald, ≥70 yellow, ≥50 orange, <50 red. Hallucinations rendered as a bulleted list with red `!` badges. Green checkmark displayed when score exists and hallucinations array is empty. Inline error state shown below the card on Server Action failure.

- `app/dashboard/hallucinations/page.tsx` — Full rewrite. Two sections: **"Live Accuracy Audits"** (new `EvaluationCard` per location, latest eval per engine resolved via `find()` on newest-first results) above **"Flagged Hallucinations"** (existing Phase 4 `ai_hallucinations` table, preserved intact). All three queries (`locations`, `ai_evaluations`, `ai_hallucinations`) run in parallel via `Promise.all`. Removed stray `console.log` debug statement from the original Phase 4 page. Fixed null-check ordering (`if (!ctx)` now precedes `ctx.orgId` access).

- `app/dashboard/layout.tsx` — No change needed; "AI Hallucinations" nav link already pointed to `/dashboard/hallucinations` with `active: true` from Phase 4.

**RLS / Security pattern followed:**
- `org_id` derived exclusively from `getSafeAuthContext()` in the Server Action — never accepted from the client
- `org_isolation_insert` RLS policy on `ai_evaluations` provides a second enforcement layer
- Location ground-truth fetched via `createClient()` (cookie-based, RLS-scoped) — org can only read its own location data

**Graceful degradation pattern:**
- Missing API key → 3-second mock delay → accuracy 80 + descriptive mock hallucination strings
- API call throws (network error, rate limit, etc.) → same 3-second mock fallback, no UI crash
- Real results drop in automatically once `OPENAI_API_KEY` / `PERPLEXITY_API_KEY` are added to `.env.local`

**⚠️ Seed Fix — `auth.users` login failure (resolved):**
Direct inserts into `auth.users` require `instance_id = '00000000-0000-0000-0000-000000000000'` and empty-string token fields (`confirmation_token`, `email_change`, `email_change_token_new`, `recovery_token`) for GoTrue to recognise the user at the `/api/auth/login` endpoint. Also added `CREATE EXTENSION IF NOT EXISTS pgcrypto` to guard against environments where it isn't auto-activated. Both fixes applied to `supabase/seed.sql`; re-run `npx supabase db reset` to pick up the changes.

**⚠️ Hydration Fix — `toLocaleString()` server/client mismatch (resolved):**
`formatTime()` in `EvaluationCard.tsx` uses `toLocaleString('en-US', ...)`. Node.js (server) and the browser bundle different ICU data, causing the date connector to differ (`Feb 21, 9:19 PM` vs `Feb 21 at 9:19 PM`). Fixed by adding `suppressHydrationWarning` to the `<p>` element containing the "Last run" timestamp — the standard React pattern for elements where server/client output legitimately diverges due to locale or time.

**Tests added:**
- `src/__tests__/unit/cron-audit.test.ts` — **7 Vitest tests** (Phase 9 original). Covers `GET /api/cron/audit`: returns 401 when `Authorization` header is absent; returns 401 when Bearer token is incorrect; returns 401 when `CRON_SECRET` env var is not configured; returns 200 with zero-count summary when no paying orgs exist; does not call `auditLocation` when no orgs are returned; calls `auditLocation` and inserts hallucinations for a paying org; increments failed count and continues when `auditLocation` throws. Uses MSW handlers — no live API calls. *(+2 email alert tests added in Phase 21 → **9 tests total**)*

---
## 2026-02-21 — Phase 8: API Sync Engine — Scaffolding & UI (Completed)

**Goal:** Build the `location_integrations` table and a full Integrations dashboard so users can connect/disconnect Google Business Profile, Apple Business Connect, and Bing Places. Sync logic is mocked with a 2 s delay; real API keys drop in Phase 8b.

**Scope:**

- `supabase/migrations/20260221000002_create_integrations.sql` — Creates `location_integrations` (`id`, `org_id`, `location_id`, `platform`, `status`, `last_sync_at`, `external_id`, `created_at`). Unique constraint on `(location_id, platform)`. All four RLS policies gated on `org_id = current_user_org_id()`. Applied via `npx supabase db reset`.

- `lib/schemas/integrations.ts` — `INTEGRATION_PLATFORMS` const tuple. `ToggleIntegrationSchema` (location_id UUID, platform enum, connect boolean). `SyncIntegrationSchema` (location_id UUID, platform enum). Shared between Server Actions and Client Components.

- `app/dashboard/integrations/actions.ts` — `toggleIntegration`: upserts row with `status = 'connected'` on `connect = true` (idempotent via `onConflict: 'location_id,platform'`); deletes row on `connect = false`. `mockSyncIntegration`: sets `status = 'syncing'`, awaits 2000 ms, sets `status = 'connected'` + `last_sync_at = NOW()`. Both derive `org_id` from `getSafeAuthContext()` and call `revalidatePath('/dashboard/integrations')`.

- `app/dashboard/integrations/_components/PlatformRow.tsx` — `'use client'`. One `useTransition` per row (toggle and sync share pending state to prevent races). Platform badge, name, description, formatted `last_sync_at`, status badge, "Sync Now" button with animated spinner, `role="switch"` toggle. Inline error display from Server Action failures.

- `app/dashboard/integrations/page.tsx` — Server Component. Fetches `locations` joined with `location_integrations`. Summary strip. Empty state with "Add a Location" CTA. One card per location, three `PlatformRow` children (google, apple, bing) each receiving the matching `IntegrationData | null`.

- `app/dashboard/layout.tsx` — "Integrations" nav item added (link icon, `active: true`, `/dashboard/integrations`), between Magic Menus and Competitors.

**RLS / Security pattern followed:**
- `org_id` derived exclusively from `getSafeAuthContext()` in both Server Actions
- Upsert passes `org_id: ctx.orgId`; both INSERT and UPDATE RLS policies verify it
- `revalidatePath('/dashboard/integrations')` called after every successful mutation

---
## 2026-02-21 — Phase 7: The "LLM Honeypot" (Completed)

**Goal:** Render published Magic Menu data as a public, crawler-optimised Next.js page at `/m/[slug]` with semantic HTML and `application/ld+json` Schema.org injection.

**Scope:**

- `supabase/migrations/20260221000001_public_menu_reads.sql` — Grants `SELECT` to the `anon` role on `magic_menus`, `locations`, `menu_categories`, and `menu_items`. Creates `public_published_location` and `public_published_categories` RLS policies using the `EXISTS` pattern (not `IN`) to avoid cross-table recursion. Replaces the initial schema's `IN`-based `public_menu_items` policy with an `EXISTS`-based equivalent. All operations idempotent via `DO $$` guards. Migration applied via `npx supabase db reset`.

- `app/m/[slug]/page.tsx` — Public Server Component (no auth). Data fetching wrapped in React `cache()` so `generateMetadata` and the page component share a single DB round-trip per request. Calls `notFound()` when the slug is absent or `is_published = false`. Renders two `<script type="application/ld+json">` blocks (Restaurant + Menu schemas). `safeJsonLd()` helper applies `JSON.stringify()` then Unicode-escapes `<` and `>` to prevent `</script>` injection from description strings. `generateMetadata` sets `<title>` and `<meta name="description">` dynamically. Page body uses strict semantic HTML: `<article>`, `<header>`, `<address>`, `<section aria-labelledby>`, `<h1>`–`<h4>`, `<ul>`/`<li>`. Empty-state handling for menus with no categories and categories with no items.

- `app/dashboard/magic-menus/[id]/actions.ts` — Added private `revalidatePublicPage()` helper: fetches `public_slug` + `is_published`, calls `revalidatePath('/m/[slug]', 'page')` only when the menu is published. Wired into `createMenuCategory` and `createMenuItem` after their dashboard revalidation calls.

- `app/dashboard/magic-menus/actions.ts` — `toggleMenuStatus` SELECT widened to include `public_slug`. After a successful update, calls `revalidatePath('/m/[slug]', 'page')` in both directions: publishing refreshes the cache; unpublishing purges stale content.

**JSON-LD schemas emitted (abbreviated):**
- `Restaurant` schema with `name`, `address` (PostalAddress), `telephone`, `url`, `hasMenu: { @id: "#menu" }`
- `Menu` schema with `@id: "#menu"`, `hasMenuSection[]` → `MenuSection` → `hasMenuItem[]` → `MenuItem` with optional `description` and `offers` (Offer with `price` + `priceCurrency`)

**Security / architectural constraints followed:**
- Public page uses `createClient()` (anon-role); no `getSafeAuthContext()` needed on the read path
- Dashboard mutations continue to derive `org_id` exclusively from `getSafeAuthContext()` server-side
- No Client Components on the public page — pure Server Component

---
## 2026-02-20 — Phase 6: Magic Menu Editor (Completed)

**Scope:**
- `supabase/migrations/20260220000001_create_menu_categories.sql` — Migration: creates proper relational `menu_categories` table, drops flat `category VARCHAR` column from `menu_items`, adds `category_id UUID FK`, adds all missing RLS INSERT/UPDATE policies for `menu_categories`, `menu_items`, `magic_menus`, and `ai_hallucinations` (idempotent patches). User ran `npx supabase db reset` successfully.
- `lib/schemas/menu-items.ts` — `CreateCategorySchema` (name, menu_id) + `CreateMenuItemSchema` (name, description?, price, category_id, menu_id) shared between Server Actions and Client forms
- `app/dashboard/magic-menus/[id]/actions.ts` — `createMenuCategory` + `createMenuItem` Server Actions; org_id always from `getSafeAuthContext()`; revalidates `/dashboard/magic-menus/[id]`
- `app/dashboard/magic-menus/[id]/_components/AddCategoryModal.tsx` — react-hook-form modal for adding a category to a menu
- `app/dashboard/magic-menus/[id]/_components/AddItemModal.tsx` — react-hook-form modal: name, category select (pre-selected from row context), price, description; submit disabled when no categories exist
- `app/dashboard/magic-menus/[id]/page.tsx` — Dynamic Server Component (Next.js 16 async params); fetches menu header (joined with locations) + categories (nested with menu_items via Supabase relational select); renders breadcrumb, menu header card with status badge + PublishToggle, category cards each with items table and per-category AddItemModal, global AddCategoryModal; `notFound()` if RLS filters the menu out
- `app/dashboard/magic-menus/page.tsx` — Edit link column added to menus table; each row navigates to `/dashboard/magic-menus/${menu.id}`

**RLS / Security pattern followed:**
- `org_id` derived exclusively from `getSafeAuthContext()` inside every Server Action — never from the client payload
- `revalidatePath()` called after every successful mutation
- `createClient()` (cookie-based SSR client) used throughout — Service Role Key never used in Server Actions
- Client forms: `"use client"` + react-hook-form + zodResolver; submit disabled while `isSubmitting`

---
## 2026-02-20 — Phase 6: Magic Menu Editor (started — pending schema decision)

**Status:** Pre-implementation schema audit surfaced two schema gaps that must be resolved before code is written. See schema findings section below. Implementation is paused pending decision on approach.

**⚠️ Schema Finding 1 — No `menu_categories` Table Exists:**
`prod_schema.sql` has no `menu_categories` table. Categories are a flat `category VARCHAR(100)` column on `menu_items`. There is no `category_id` foreign key anywhere in the schema. The Phase 6 plan assumes a separate categories table — this assumption is incorrect.

**⚠️ Schema Finding 2 — No INSERT or UPDATE RLS Policy on `menu_items`:**
`menu_items` has `org_isolation_select` and `org_isolation_delete` policies only. There is no INSERT or UPDATE policy for authenticated users. Any `createMenuItem` Server Action will hit the RLS Shadowban (silent 0-row insert) until this patch is applied:
```sql
CREATE POLICY "org_isolation_insert" ON public.menu_items
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "org_isolation_update" ON public.menu_items
  FOR UPDATE USING (org_id = public.current_user_org_id());
```

---
## 2026-02-20 — Phase 5: Magic Menu System (Completed)

**Context:** Phase 4 (Locations + Hallucinations CRUD) is complete and verified. Beginning Phase 5: the Magic Menu creation and management UI.

**Scope:**
- `lib/schemas/magic-menus.ts` — Zod schema shared between Server Action and Client form
- `app/dashboard/magic-menus/actions.ts` — `createMagicMenu` + `toggleMenuStatus` Server Actions
- `app/dashboard/magic-menus/page.tsx` — Server Component; fetches menus joined with `locations`
- `app/dashboard/magic-menus/_components/AddMenuModal.tsx` — react-hook-form creation modal
- `app/dashboard/magic-menus/_components/PublishToggle.tsx` — `useTransition` publish/unpublish toggle
- `app/dashboard/layout.tsx` — Magic Menus nav link activated

**⚠️ Required Schema Patch — RLS INSERT Policy Missing on `magic_menus`:**
`prod_schema.sql` currently has no INSERT policy for authenticated users on `magic_menus`. The `createMagicMenu` action will receive a silent RLS rejection (zero rows inserted, no error thrown) until this is applied:
```sql
CREATE POLICY "org_isolation_insert" ON public.magic_menus
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
```
Apply in Supabase Studio → SQL Editor, or add to `supabase/migrations/`. The identical gap exists for `ai_hallucinations` (documented in Phase 0).

**⚠️ Schema Gap — No `name` Column on `magic_menus`:**
The table has no `name` column. The user-supplied name is stored as `public_slug` (via `toUniqueSlug(name)`). The UI uses the linked location name as the primary display label. A future migration should add `name VARCHAR(255)` for cleaner labeling.

**Architectural Decisions (Phase 5)**

* **Zero Client Trust:** Both `createMagicMenu` and `toggleMenuStatus` call `getSafeAuthContext()` to derive `org_id` server-side. Passing `org_id` from the client or omitting it causes RLS to silently reject the row (the "RLS Shadowban" pattern documented in Phase 4).
* **`toggleMenuStatus` is a read-then-write:** The action fetches the current `is_published` state from the DB before toggling, so the server is always the source of truth. This prevents stale client state from causing incorrect toggles.
* **Parallel data fetching:** `fetchPageData()` uses `Promise.all` to fetch menus and locations in parallel, minimising SSR render latency.
* **Supabase relational select:** The page uses `.select('... locations(name, business_name, city, state)')` to join `magic_menus` ↔ `locations` in a single query, avoiding N+1 fetches.

---
## 2026-02-20 — Phase 4: Entity Management & CRUD Views (Completed)

**Scope:** Server Actions for mutations + live CRUD views for Locations and AI Hallucinations.

**Files Added / Changed**

| File | Purpose |
|------|---------|
| `lib/schemas/locations.ts` | Zod schema `CreateLocationSchema` — shared between Server Action (server-side validation) and `AddLocationModal` (client-side `react-hook-form` validation) |
| `app/dashboard/actions.ts` | `createLocation` and `updateHallucinationStatus` Server Actions |
| `app/dashboard/locations/page.tsx` | Server Component — fetches and renders all org locations via RLS-scoped client |
| `app/dashboard/locations/_components/AddLocationModal.tsx` | Client Component — modal form using `react-hook-form` + `zodResolver`; calls `createLocation` Server Action |
| `app/dashboard/hallucinations/page.tsx` | Server Component — fetches all `ai_hallucinations`, renders severity-coded badges |
| `app/dashboard/hallucinations/_components/StatusDropdown.tsx` | Client Component — `<select>` with `useTransition`; calls `updateHallucinationStatus` Server Action |
| `app/dashboard/layout.tsx` | Nav links for `/dashboard/hallucinations` and `/dashboard/locations` now active (Phase 4 routes wired up) |

**Architectural Decisions & Critical Learnings**

**🔴 The RLS Shadowban (Most Critical Learning from Phase 4)**
PostgreSQL RLS fails **silently**. When a policy rejects a write, it does not throw an error — it returns zero affected rows. This manifests in two dangerous ways:

1. **Client-supplied `org_id`:** If the client sends any `org_id` (malicious or mistaken), and it doesn't match `current_user_org_id()`, the INSERT/UPDATE silently affects 0 rows. The UI shows nothing.
2. **Missing `org_id`:** If `org_id` is null, the policy `WITH CHECK (org_id = current_user_org_id())` evaluates to `NULL = UUID` → `false`. Row is silently rejected.

**The mandatory fix for every Server Action that mutates tenant data:**
```typescript
// ALWAYS derive org_id server-side — never accept it from the client
const ctx = await getSafeAuthContext();
if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };
// Use ctx.orgId in the insert payload
await supabase.from('table').insert({ org_id: ctx.orgId, ... });
```
This ensures the application-level `org_id` and the RLS policy always agree, and inserted rows are immediately visible.

* **Defense in Depth:** Even with `getSafeAuthContext()` guarding the entry point, the cookie-based `createClient()` client means RLS policies fire as a second layer.
* **`revalidatePath` on every mutation:** Purges the Next.js RSC payload cache so the page re-fetches fresh data on next navigation without a hard refresh.
* **Schema co-location:** Zod schemas in `lib/schemas/` are importable by both `"use server"` actions and `"use client"` forms without bundling issues.
* **Status dropdown uses `useTransition`, not a full form:** Single-field updates don't need react-hook-form overhead — `useTransition` provides the pending state to disable the control during flight.
* **Slug uniqueness:** `toUniqueSlug()` (timestamp suffix) satisfies `UNIQUE(org_id, slug)` without an extra round-trip.

---
## 2026-02-18 — Phase 3: Core Dashboard Data & RLS Integration (Completed)

**Architectural Fix: User Identity Resolution (`lib/auth.ts`)**
* **The Bug:** The previous `getSafeAuthContext()` was querying `memberships.user_id = auth.uid()`. However, `memberships.user_id` is a foreign key to `public.users.id` (a newly generated UUID), NOT the Supabase Auth ID. This caused silent query failures where `orgId` and `plan` were returning null.
* **The Fix:** Created a new `resolvePublicUser()` helper that queries `public.users` where `auth_provider_id = auth.uid()`, retrieves the correct `public.users.id` and `full_name`, and uses *that* ID for the `memberships` join. 

**Feature Implementation: Dashboard Layout & RLS Metrics**
* **Sidebar (`app/dashboard/layout.tsx`):** Now dynamically displays the real `fullName` and `orgName` fetched securely via the resolved user context.
* **Stat Cards (`app/dashboard/page.tsx`):** Replaced static placeholders with live database counts for `ai_hallucinations`, `magic_menus`, and `locations`.
* **Performance & Security:** Utilized `select('*', { count: 'exact', head: true })` for all metrics. This ensures PostgreSQL's Row-Level Security (RLS) automatically filters the counts to the logged-in user's tenant without transmitting actual row data over the wire.
* **Graceful UI:** Implemented a conditional zero-state that displays an onboarding prompt only if all three metric counts return `0`.

**Testing & Environment Fixes**
* Resolved an integration test failure (`Database error creating new user`) caused by orphaned test users by running `npx supabase db reset`. All 22/22 Vitest tests are now passing.
* Manually verified frontend RLS enforcement: successfully injected a row via local Supabase Studio using a test user's `org_id` and observed the Next.js dashboard securely increment the count from 0 to 1 upon refresh.

## 2026-02-18 — Phase 3: Core Dashboard Data & RLS Integration (started)

**Context:** Phase 2 (Auth UI & Middleware) complete and manually tested. Beginning Phase 3: replacing all static placeholders in the dashboard with real RLS-scoped data from the local Supabase instance.

**Scope:**
- `lib/auth.ts` — bug-fixed and extended: both `getAuthContext()` and `getSafeAuthContext()` previously queried `memberships.user_id = auth.uid()` which is wrong — `memberships.user_id` references `public.users.id`, a different UUID. Fixed by adding a preceding `public.users` lookup via `auth_provider_id = auth.uid()`, then using the resolved `public.users.id` for the membership join. Also added `fullName: string | null` to `SafeAuthContext`.
- `app/dashboard/layout.tsx` — sidebar now shows the real `full_name` and `email` from the auth context instead of the email-prefix fallback.
- `app/dashboard/page.tsx` — "Welcome back" uses the user's actual first name; stat cards now show live counts from `ai_hallucinations`, `magic_menus`, and `locations` fetched via `createClient()` (user-session, RLS-scoped — not service role).

**Architectural decisions:**
- Count queries use `supabase.select('*', { count: 'exact', head: true })` — Postgres returns only the `count` header with no row data, keeping payloads tiny.
- All three counts are fetched in parallel via `Promise.all` to minimise page render latency.
- Graceful fallback: if a count query errors or returns null (e.g. newly registered user with no data yet), the displayed value falls back to `0` rather than crashing.
- The `full_name` field in `SafeAuthContext` is nullable so the Onboarding Guard polling shape (org-pending state) is not affected.

**Bug discovered:** `getSafeAuthContext()` / `getAuthContext()` had a latent ID mismatch introduced in Phase 1 that was invisible to unit tests (which mock the Supabase client) but would have broken the dashboard for every real login. Fixed in this phase before it caused user-facing issues.

---

## 2026-02-18 — Phase 2: Frontend Auth UI & Middleware (started)

**Context:** Phase 1 (Auth API endpoints) is complete and all unit tests pass. Beginning Phase 2: Next.js Middleware, Auth UI pages, and Dashboard shell.

**Scope:**
- `middleware.ts` — route protection using `supabase.auth.getUser()` (never `getSession()`); secured cookies forwarded to `NextResponse`
- `lib/supabase/middleware.ts` — dedicated middleware Supabase client (reads from `NextRequest` cookies, writes to both request and response so refreshed tokens reach the browser)
- `app/(auth)/login/page.tsx` + `app/(auth)/register/page.tsx` — client-side forms using `react-hook-form` + `@hookform/resolvers/zod`; submit via `fetch()` to our `/api/auth/*` endpoints (never calling Supabase SDK directly from the browser)
- `app/dashboard/layout.tsx` + `page.tsx` — authenticated shell with sidebar, header, and logout button; `LogoutButton` calls `POST /api/auth/logout` then hard-refreshes to `/login`
- `app/page.tsx` updated to redirect to `/dashboard` (middleware handles the onward redirect to `/login` for unauthenticated users)

**Architectural decisions:**
- Auth pages live under `app/(auth)/` route group (no URL segment) so `/login` and `/register` share a centered card layout without affecting `/dashboard` or future marketing pages
- Middleware operates on all non-static routes; the matcher explicitly excludes `_next/`, `api/`, and asset extensions to avoid intercepting health-check or API traffic
- Dashboard data is fetched via `getSafeAuthContext()` in Server Components; the `LogoutButton` is a separate `"use client"` island to avoid forcing the entire layout into a client bundle

---

## 2026-02-18 — Phase 0: Test Environment Debugging & Fixes

**Context:** After running `npx supabase start` and `npx supabase db reset`, the local stack started but the integration tests were failing with networking and JWT errors. Two specific fixes were required.

### Fix 1 — Docker "Ghost Port" Networking Issue

**Symptom:** `supabase start` would report all containers healthy but API calls to `http://localhost:54321` hung or returned connection refused. The Supabase Studio UI also failed to load.

**Root cause:** Stale Docker containers and dangling bridge networks from previous runs were occupying the required ports and conflicting with the new containers. Additionally, the `config.toml` had the analytics service enabled, which adds a dependency on an extra container that can fail silently and block startup.

**Fix:**
```bash
# Kill and remove all existing containers
docker rm -f $(docker ps -aq)

# Prune orphaned networks
docker network prune -f

# Then restart cleanly
npx supabase start
```

And in `supabase/config.toml`, disable analytics to remove the extra dependency:
```toml
[analytics]
enabled = false
```

### Fix 2 — "invalid JWT: token contains an invalid number of segments"

**Symptom:** After starting Supabase, copying the keys from the `supabase start` output into `.env.test` and running the tests, every Supabase client call threw `invalid JWT: token contains an invalid number of segments`.

**Root cause:** The `supabase start` terminal output truncates long JWT tokens with `...` for display purposes. Copying those truncated values into `.env.test` produced malformed tokens that the Supabase client rejected.

**Fix:** Use `npx supabase status -o env` to get the full, untruncated token values in shell-exportable format:
```bash
npx supabase status -o env
# Outputs:
# SUPABASE_URL=http://localhost:54321
# SUPABASE_ANON_KEY=eyJ...full token...
# SUPABASE_SERVICE_ROLE_KEY=eyJ...full token...
```

Copy `SUPABASE_ANON_KEY` → `SUPABASE_LOCAL_ANON_KEY` in `.env.test`.  
Copy `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_LOCAL_SERVICE_ROLE_KEY` in `.env.test`.

The variable names in `.env.test` must exactly match the `process.env.*` references in `src/__helpers__/supabase-test-client.ts` (`SUPABASE_LOCAL_ANON_KEY` and `SUPABASE_LOCAL_SERVICE_ROLE_KEY`).

---

## 2026-02-18 — Phase 0: Next.js Shell + Supabase Auth Bootstrap

**Build Plan ref:** Doc 09, Phase 0 — "Next.js Scaffold" checklist items

### Files Created

| File | Purpose |
|------|---------|
| `package.json` | Next.js 15 scaffold (App Router, TypeScript, Tailwind CSS) |
| `lib/supabase/database.types.ts` | Stub type file; replace with `supabase gen types typescript` output once project is linked |
| `lib/supabase/client.ts` | `createBrowserClient` wrapper for use in Client Components |
| `lib/supabase/server.ts` | `createServerClient` wrapper for Server Components / Route Handlers; also exports `createServiceRoleClient()` for webhook/cron contexts (bypasses RLS) |
| `lib/auth.ts` | Two-variant auth helper (see decisions below) |
| `app/api/v1/auth/context/route.ts` | `GET /api/v1/auth/context` session-bootstrap endpoint (Doc 05 §1.1) |
| `.env.local.example` | Full environment variable manifest (Doc 02 §7) |

### Architectural Decisions

**Two-variant auth helper (`lib/auth.ts`)**
Per the Agent Rule in Doc 02 §4, `getAuthContext()` and `getSafeAuthContext()` are kept as separate exported functions rather than a single function with an options flag.

- `getAuthContext()` — throws on missing session or missing org. Used by all protected API routes where an unauthenticated call is a hard error.
- `getSafeAuthContext()` — never throws; returns `orgId: null` when the `handle_new_user` DB trigger has not yet fired. Used exclusively by `GET /api/v1/auth/context` and the dashboard page loader to support the Onboarding Guard polling pattern (Doc 06 §3).

**`any` casts in Supabase queries**
The `Database` type in `lib/supabase/database.types.ts` is an empty stub until `supabase gen types` is run. To avoid `never`-typed query results blocking compilation, the two join queries in `lib/auth.ts` cast the client to `any` and re-assert the return type explicitly. These casts are annotated with `// eslint-disable-next-line` and will be removed automatically once the generated types replace the stub.

**`createServiceRoleClient` placement**
Exported from `lib/supabase/server.ts` rather than a separate file to keep server-only utilities co-located. It must never be imported from a Client Component — this is enforced by the `'server-only'` boundary implicit in Next.js App Router (server files cannot be bundled into client chunks).

**No `middleware.ts` yet**
Subdomain routing middleware (Doc 02 §3) is intentionally deferred. The `GET /api/v1/auth/context` route works correctly on `localhost` without it; middleware is only required once `app.localvector.ai` and `menu.localvector.ai` domains are configured in Vercel.

---

## 2026-02-18 — Phase 0: Testing Infrastructure

**Build Plan ref:** Doc 09, Phase 0 — "Testing Infrastructure" checklist items  
**Doc ref:** Doc 11, Sections 2–5

### Packages Installed (dev)

| Package | Version | Purpose |
|---------|---------|---------|
| `vitest` | 4.0.18 | Test runner (unit + integration) |
| `@vitest/coverage-v8` | latest | Coverage reports via V8 |
| `msw` | 2.12.10 | Mock Service Worker — intercepts external API calls |
| `@faker-js/faker` | latest | Realistic test data generation |
| `dotenv` | latest | Loads `.env.test` in test setup |

### Files Created

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Vitest configuration with custom path alias strategy |
| `.env.test` | Test environment variables (local Supabase URLs, mock API keys) |
| `src/__fixtures__/golden-tenant.ts` | Charcoal N Chill canonical test data + RIVAL_TENANT |
| `src/__fixtures__/mock-perplexity-responses.ts` | Canned Perplexity API response envelopes for MSW |
| `src/__helpers__/setup.ts` | Global test setup: loads `.env.test`, starts MSW node server |
| `src/__helpers__/supabase-test-client.ts` | `createTestClient`, `createServiceClient`, `seedTenant`, `cleanupTenants` |
| `src/__tests__/integration/rls-isolation.test.ts` | RLS isolation test suite (7 test cases — Doc 11 §5.1) |

### Architectural Decisions

**Path alias strategy (`vitest.config.ts`)**  
The project has no `src/` directory for production code (Next.js files live at root: `lib/`, `app/`). Tests live under `src/`. Vite's alias array is ordered most-specific-first:

```
@/__helpers__ → src/__helpers__   (test utilities)
@/__fixtures__ → src/__fixtures__ (test fixtures)
@/__tests__   → src/__tests__    (cross-test imports)
@/            → ./               (fallback: project root for lib/, app/)
```

This allows test files to import `@/lib/auth` (resolves to `./lib/auth`) and `@/__helpers__/supabase-test-client` (resolves to `./src/__helpers__/supabase-test-client`) using the same `@` prefix, consistent with both `tsconfig.json` and Doc 11's test file imports.

**`seedTenant` resilience pattern**  
`seedTenant` in `supabase-test-client.ts` does not assume the `handle_new_user` PostgreSQL trigger has fired. It checks for an existing membership row first, and if absent (trigger timing in CI, or trigger not yet configured), creates org + membership manually via service role. This prevents flaky tests caused by trigger latency.

**Known schema gap — `ai_hallucinations` INSERT policy**  
`prod_schema.sql` currently has no INSERT policy for regular users on `ai_hallucinations`. The `beforeAll` seed in `rls-isolation.test.ts` uses `tenantA.client` (user-scoped) to insert, per the spec in Doc 11 §5.1. Until the following policy is added to the schema, that seed will fail with an RLS violation:

```sql
CREATE POLICY "org_isolation_insert" ON public.ai_hallucinations
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
```

This is left as a deliberate red test — it surfaces the missing policy when `npx supabase db reset` is run and the test suite is executed. The same gap exists for `magic_menus`. Adding these INSERT policies is a Phase 0 schema task.

---

## 2026-02-18 — Phase 0: Auth API Routes

**Build Plan ref:** Doc 09, Phase 0 — "Auth Flow" checklist items

### Packages Added
`zod` (runtime) — request body validation for all API routes.

### Files Created

| File | Purpose |
|------|---------|
| `lib/schemas/auth.ts` | Zod schemas: `RegisterSchema`, `LoginSchema` and inferred input types |
| `lib/utils/slug.ts` | `toSlug()` / `toUniqueSlug()` — URL-safe slug generator used by register route |
| `app/api/auth/register/route.ts` | `POST /api/auth/register` |
| `app/api/auth/login/route.ts` | `POST /api/auth/login` |
| `app/api/auth/logout/route.ts` | `POST /api/auth/logout` |
| `src/__tests__/unit/auth-routes.test.ts` | 15 unit tests — all passing |

### Architectural Decisions

**Register route follows the idempotent signup pattern (Doc 09)**
Rather than creating the org directly, `POST /api/auth/register` calls `auth.admin.createUser()` with `user_metadata: { full_name }`, which fires the trigger chain:
- `on_auth_user_created` → inserts `public.users` with `full_name` from metadata
- `on_user_created` → inserts `organizations` (name = `"<full_name>'s Venue"`) + `memberships`

The route then `PATCH`es the org name to the user-supplied `business_name`. This matches the build plan's Agent Rule: "Onboarding code MUST perform a PATCH/UPDATE on the existing organization record."

**Register returns 201, not a session**
Registration deliberately does not return a session. The client is instructed to call `POST /api/auth/login` immediately after. This keeps the two operations decoupled — a session failure during registration doesn't mask a successful account creation.

**Login uses SSR cookie client**
`POST /api/auth/login` calls `createClient()` (the SSR server client) so Supabase writes the session into HTTP-only cookies automatically. The response body also returns `access_token` and `refresh_token` for API clients that can't use cookies.

**Logout is idempotent**
`POST /api/auth/logout` always returns 200 regardless of whether a session was active. Errors from `signOut` are intentionally swallowed — the goal is always a clean state.

**Unit test mock strategy**
Route handlers are tested by mocking `@/lib/supabase/server` at the module level with `vi.mock()`. Each Supabase `.from()` call is chained via a `mockReturnValueOnce` sequence, preserving call order for the register route's multi-step DB sequence. No live DB or network needed.

**Atomicity / orphan-cleanup (added)**
The register route wraps all post-auth-creation steps in a `rollback()` helper that calls `auth.admin.deleteUser(authUserId)` before returning any 500. This prevents orphaned Supabase Auth users when the trigger chain or org-name PATCH fails. Two dedicated rollback test cases verify the cleanup fires for both the `public.users` lookup failure and the `memberships` lookup failure. The mock service client now includes `mockAdminDeleteUser` alongside `mockAdminCreateUser`.

**MSW handler registry (`src/__helpers__/msw/handlers.ts`)**
Three named handler groups, imported by `setup.ts` via `setupServer(...handlers)`:

| Group | Behaviour |
|-------|-----------|
| `supabaseHandlers` | `passthrough()` for all `localhost:54321/*` — integration tests hit the real local DB |
| `authApiHandlers` | `passthrough()` for our own `/api/auth/*` routes — safe for future E2E tests |
| `externalApiGuards` | Returns 500 with an instructive error for Perplexity, OpenAI, Google Places, and Resend — prevents accidental paid API calls in any test |

Override per-test with `server.use(http.post(...))` and rely on `afterEach → resetHandlers()` to restore defaults. The `onUnhandledRequest: 'warn'` setting in `setup.ts` is retained so unexpected requests surface as warnings rather than hard failures while the handler registry is still growing.
