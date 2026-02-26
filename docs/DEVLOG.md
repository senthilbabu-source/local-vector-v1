# LocalVector.ai — Development Log

> Reverse-chronological. Newest entries at top. See AI_RULES §13 for format.

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

---
> **End of Development Log**
