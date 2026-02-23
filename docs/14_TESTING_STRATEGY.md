# LocalVector.ai — Testing Strategy

> **Source:** This document is derived from `DEVLOG.md`, the `src/__tests__/` directory,
> and the `tests/e2e/` directory as of Phase 3.1 (Deferred Items: Autocomplete + Cron).
> All test counts are from the live `vitest run` and `playwright test` outputs.

---

## Overview

LocalVector.ai uses a two-layer test stack:

| Layer | Runner | Command | Result (Phase 3) |
|-------|--------|---------|------------------|
| Unit + Integration | Vitest | `npx vitest run` | 260 passing, 7 skipped, 1 failing suite (pre-existing) |
| E2E Functional | Playwright | `npx playwright test` | 25 passing, 0 failing |

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
| `src/__tests__/unit/cron-audit.test.ts` | GET /api/cron/audit | 12 | 0 | Phase 9+21+3.1: Cron audit route + email alerts + competitor intercept loop |
| `src/__tests__/unit/generateMenuJsonLd.test.ts` | Restaurant structure, Menu sections, MenuItem, suitableForDiet, subjectOf | 30 | 0 | Phase 15: Menu JSON-LD generation |
| `src/__tests__/unit/parseCsvMenu.test.ts` | parseLocalVectorCsv, getLocalVectorCsvTemplate | 20 | 0 | Phase 14.5: CSV upload parsing |
| `src/__tests__/unit/reality-score.test.ts` | deriveRealityScore | 8 | 0 | Phase 21: `deriveRealityScore()` pure formula |
| `src/__tests__/unit/hallucination-classifier.test.ts` | demo fallback, with API key | 8 | 0 | Phase 21: `auditLocation()` — demo + OpenAI path |
| `src/__tests__/unit/plan-enforcer.test.ts` | canRunDailyAudit, canRunSovEvaluation, canRunCompetitorIntercept, maxLocations, maxCompetitors | 16 | 0 | Phase 21 + pre-Phase 3: Plan-tier gate helpers (maxCompetitors added) |
| `src/__tests__/unit/share-of-voice-actions.test.ts` | addTargetQuery, runSovEvaluation | 16 | 0 | Phase 21: SOV Server Actions (mocked Supabase + fetch) |
| `src/__tests__/unit/verify-hallucination.test.ts` | verifyHallucinationFix | 8 | 0 | Phase 21: `verifyHallucinationFix()` Server Action |
| `src/__tests__/unit/rate-limit.test.ts` | runFreeScan — rate limiting | 6 | 0 | Phase 22: IP-based rate limit via Vercel KV — under limit, at limit, over limit, TTL, KV absent, KV throws |
| `src/__tests__/unit/competitor-actions.test.ts` | addCompetitor (7), deleteCompetitor (3), runCompetitorIntercept (8), markInterceptActionComplete (4) | 22 | 0 | Phase 3: Competitor Intercept Server Actions — auth, plan gate, Zod, 2-stage LLM mock, org_id scope, gap_analysis JSONB |
| `src/__tests__/unit/places-search.test.ts` | GET /api/v1/places/search | 6 | 0 | Phase 3.1: Google Places proxy — 401 guard, short-query guard, absent-key guard, 5-suggestion proxy, non-200 fallback, network-error fallback |
| `src/__tests__/unit/competitor-intercept-service.test.ts` | runInterceptForCompetitor | 8 | 0 | Phase 3.1: 2-stage Perplexity → GPT-4o-mini service — URL/model checks, mock-path fallbacks, gap_analysis shape, INSERT error propagation |
| `src/__tests__/integration/rls-isolation.test.ts` | *(pre-existing failure)* | — | 7 | RLS cross-tenant isolation — requires live DB; fails in CI without `supabase db reset` |

**Total (active suites):** 15+22+16+32+15+12+30+20+8+8+16+16+8+6+22+6+8 = **260 passing** across 17 suites (plus 7 skipped in rls-isolation)
*(Phase 22 correction: `generateMenuJsonLd.test.ts` count updated 21→30, `parseCsvMenu.test.ts` updated 17→20 — stale counts in Phase 21 docs; actual Vitest output was always 217 basis for new total. Pre-Phase 3: `plan-enforcer.test.ts` updated 12→16 after adding `maxCompetitors` tests. Phase 3: `competitor-actions.test.ts` +22. Phase 3.1: `cron-audit.test.ts` 9→12, `places-search.test.ts` +6, `competitor-intercept-service.test.ts` +8.)*

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

### Pre-existing failure: `rls-isolation.test.ts`

This integration suite requires a live Supabase local stack with the full auth trigger chain
(`on_auth_user_created` → `on_user_created`). It fails in environments where `supabase db reset`
has not been run with a "Database error creating new user" error — this is a test infrastructure
prerequisite, not an application bug. The 7 `skip`s are deliberate skips within this suite for
tests that require a second tenant to be provisioned.

**This failure is pre-existing and does not block E2E or unit/integration CI.**

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
| `tests/e2e/01-viral-wedge.spec.ts` | 3 | None (public) | Scan form → hallucination card → CTA `/login` → social proof badge → case study text |
| `tests/e2e/02-onboarding-guard.spec.ts` | 1 | `incomplete@` | Guard fires on `/dashboard/magic-menus` → redirect `/onboarding` → wizard → `/dashboard` |
| `tests/e2e/03-dashboard-fear-first.spec.ts` | 5 | `e2e-tester@` | AlertFeed leads, Reality Score=87, hamburger opens sidebar, Listings nav, page title |
| `tests/e2e/04-magic-menu-pipeline.spec.ts` | 1 | `upload@` | UploadState → Simulate AI Parsing → triage summary → certify → publish → LinkInjectionModal |
| `tests/e2e/05-public-honeypot.spec.ts` | 4 | None (public) | Page renders, Restaurant + Menu JSON-LD valid, `llms.txt` 200+structure, `ai-config.json` 200+GEO fields |
| `tests/e2e/viral-wedge.spec.ts` *(legacy)* | 3 | None (public) | Legacy spec — kept for regression; racy "Scanning AI Models" assertion removed |
| `tests/e2e/hybrid-upload.spec.ts` | 4 | `upload@` | CSV Gold Standard upload path; `beforeAll` admin reset guarantees UploadState |
| `tests/e2e/03-dashboard-fear-first.spec.ts` | 5 | `e2e-tester@` | See above |

**Total: 25 tests, 25 passing, 0 failing**

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
Both `01-viral-wedge.spec.ts` and the legacy `viral-wedge.spec.ts` omit this assertion and
wait directly for the result card with a 10s timeout.

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

> **Last updated:** Phase 3.1 Deferred Items (2026-02-23) — 25/25 E2E + 260 unit/integration passing.
