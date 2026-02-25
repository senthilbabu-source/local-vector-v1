# LocalVector.ai — Development Log

> Reverse-chronological. Newest entries at top. See AI_RULES §13 for format.

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

## Current Test Counts (2026-02-24)

| Suite | Count | Command |
|-------|-------|---------|
| Vitest unit/integration | 481 passing, 7 skipped | `npx vitest run` |
| Playwright E2E | 36 passing (12 spec files) | `npx playwright test --project=chromium` |

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
| `08-content-drafts.spec.ts` | 3 | Header + summary strip, filter tabs, sidebar nav |
| `auth.spec.ts` | 3 | Login layout, error on invalid creds, signup form fields |
| `billing.spec.ts` | 2 | Three tiers with Growth highlighted, upgrade demo mode |
| `hybrid-upload.spec.ts` | 2 | Upload tabs visible, CSV upload → ReviewState |
| `onboarding.spec.ts` | 1 | Redirect to /onboarding + 3-step wizard completion |

---
> **End of Development Log**
