# 09 — Phased Build Plan & Execution Roadmap

## Execution Roadmap
### Version: 2.5 | Date: February 26, 2026

> **Phase 22 Reconciliation (2026-02-23):** Phases 0–2 checkboxes audited against DEVLOG
> entries (Phases 0–21). Items confirmed complete are ticked `[x]`. Genuinely incomplete
> items are left `[ ]` with a `(Phase 23)` note. See DEVLOG Phase 22 for the full audit log.

---

## Build Philosophy

- **Solo-dev optimized:** Each phase delivers a shippable, testable increment.
- **Golden Tenant first:** Every feature is built and tested against Charcoal N Chill before generalizing.
- **Vertical slice:** Each phase goes from database → API → UI → deployment. No half-built layers.

---

## Phase 0: The Multi-Tenant Foundation (Weeks 1–2)

**Goal:** A secure, empty vessel that can handle users, orgs, and payments.
**Deliverable:** `app.localvector.ai` showing a "Hello World" authenticated dashboard.

### Checklist

- [x] **Supabase Setup**
  - [ ] Create Supabase project `localvector-prod` *(infrastructure — not verifiable from code)*
  - [x] Run Doc 03 SQL initialization script (`supabase/prod_schema.sql`)
  - [x] **Schema Patch v2.1:** Verify `ai_hallucinations` and `magic_menus` tables include the `propagation_events` JSONB column (Doc 03).
  - [x] Verify all tables, enums, indexes, RLS policies created
  - [x] Verify `locations.place_details_refreshed_at` column exists (Google ToS compliance — see Doc 10, Section 4)
  - [x] Seed Big 6 directories (`supabase/seed.sql`)
  - [x] Seed Golden Tenant (Charcoal N Chill) (`src/__fixtures__/golden-tenant.ts` + `supabase/seed.sql`)
    - **🤖 Agent Rule:** Seed data for `hours_data`, `amenities`, and `extracted_data` MUST use the Zod schemas defined in Doc 03, Section 9. Do NOT invent ad-hoc JSON shapes.
- [x] **Next.js Scaffold**
  - [x] `npx create-next-app@latest` with App Router + TypeScript + Tailwind
  - [x] Install shadcn/ui components
  - [x] Implement `middleware.ts` for subdomain routing (Doc 02, Section 3)
        *(Renamed to `proxy.ts` for Next.js 16 convention — see DEVLOG Phase 0 bug fix)*
  - [x] Implement `lib/auth.ts` (getAuthContext helper)
  - [x] Implement `GET /api/v1/auth/context` route (Doc 05, Section 1.1) — used by Onboarding Guard
  - [x] Create app shell: sidebar, top bar, layout
- [x] **Auth Flow**
  - [x] Configure Supabase Auth (Email/Password + Google OAuth)
  - [x] Build `/signup`, `/login`, `/forgot-password`, `/reset-password` pages *(Sprint 60B: forgot-password + reset-password added)*
  - [x] Verify PostgreSQL trigger creates org + membership on signup
  - [x] Test: New user signs up → org created → membership created → dashboard loads
- [x] **Stripe Setup**
  - [x] Create Stripe test products (Starter, Growth, Agency)
  - [x] Implement checkout session creation (`POST /billing/checkout`)
  - [x] Implement webhook handler (`POST /webhooks/stripe`) — `app/api/webhooks/stripe/route.ts`
  - [x] Test: User upgrades → org plan updates → features unlock
- [ ] **Vercel Configuration** *(infrastructure — not verifiable from code)*
  - [ ] Connect GitHub repo to Vercel
  - [x] Add all environment variables (Doc 02, Section 7)
  - [ ] Configure custom domains: `app.localvector.ai`, `*.localvector.ai`
  - [ ] Verify SSL provisioning
- [x] **Testing Infrastructure (Doc 11)**
  - [x] Install Vitest, Playwright, MSW, Faker.js
  - [x] Initialize Supabase CLI local dev (`npx supabase init`)
  - [x] Verify `npx supabase start` runs migrations and seeds correctly
  - [x] Create `.env.test` with local Supabase URLs (Doc 02, Section 7)
  - [x] Create `__fixtures__/golden-tenant.ts` (Charcoal N Chill test data)
  - [x] Create `__fixtures__/mock-perplexity-responses.ts`
  - [x] Create `__helpers__/supabase-test-client.ts` (anon + service role)
  - [x] Set up GitHub Actions CI pipeline (`.github/workflows/test.yml`)
  - [ ] Write and pass: `rls-isolation.test.ts` (Doc 11, Section 5.1)
        *(Written — `src/__tests__/integration/rls-isolation.test.ts` — skips in CI: requires live Supabase Docker. Infrastructure prerequisite, not a code bug. Phase 23: evaluate Supabase Docker in CI.)*
  - [ ] Write and pass: `auth-flow.test.ts` (Doc 11, Section 5.2) *(Phase 23)*
  - [ ] Write and pass: `stripe-webhook.test.ts` (Doc 11, Section 5.3) *(Phase 23)*
- [x] **Critical Logic: Idempotent Signup Strategy**
  - [x] **Agent Rule:** The `handle_new_user` PostgreSQL trigger pre-creates the `organizations` and `memberships` records.
  - [x] **Implementation:** Onboarding code MUST perform a `PATCH/UPDATE` on the existing organization record using the `org_id` from the auth session. Do NOT attempt to `INSERT` a new organization.
- [x] **API Mocking Strategy**
  - [x] Configure MSW (Mock Service Worker) to intercept all Perplexity and OpenAI calls.
  - [x] Ensure `.env.test` contains dummy values (e.g., `sk-test-mock`) to prevent accidental API spend during agentic development.

### Acceptance Criteria
- [x] New user can sign up, land on dashboard, see their org name
- [x] If DB trigger is delayed, dashboard shows "Setting up your workspace..." and recovers within 10 seconds (Onboarding Guard — see Doc 06)
- [x] RLS prevents User A from seeing User B's data
- [x] Stripe checkout redirects and updates plan in database
- [x] `menu.localvector.ai/test` returns 404 (not 500)
- [ ] `npx vitest run src/__tests__/integration/rls-isolation.test.ts` — **ALL PASS**
      *(Written — skips in CI without live Supabase Docker. Phase 23.)*
- [ ] `npx vitest run src/__tests__/integration/auth-flow.test.ts` — **ALL PASS** *(Phase 23)*
- [ ] `npx vitest run src/__tests__/integration/stripe-webhook.test.ts` — **ALL PASS** *(Phase 23)*
- [x] GitHub Actions CI pipeline runs green on push to `main`

---

## Phase 1: The "Fear" Engine (Weeks 3–6) — MVP LAUNCH

**Goal:** Ship the Hallucination Checker (viral free tool + private dashboard).
**Deliverable:** `localvector.ai/check` (Public) + Risk Dashboard (Private).

### ⚡ Minimum Shippable (if behind schedule, ship ONLY these)
1. The free `/check` page with one Perplexity call → Pass/Fail result
2. Signup flow → dashboard showing hallucination results
3. One scheduled cron running for Golden Tenant

**What can slip to Phase 1.5:** Email alerts (show in-app only), on-demand re-checks (rely on cron), Reality Score card (show raw hallucination list instead).

### Checklist

- [x] **Intelligence Backend**
  - [x] Build Perplexity Sonar API adapter (`lib/perplexity.ts`)
  - [x] Build Ground Truth constructor from `locations` table
  - [x] Implement Status Check prompt (Doc 04, Section 2.2A)
  - [x] Implement Amenity Check prompt (Doc 04, Section 2.2C)
  - [x] Implement Hours Check prompt (Doc 04, Section 2.2B)
  - [x] **Truth Calibration Logic:** Ensure `Amenity Check` skips `null` values (unknowns) instead of flagging them (Doc 04 v2.1 update).
  - [x] Build hallucination classification logic (Doc 04, Section 2.3)
  - [x] Wire results to `ai_audits` and `ai_hallucinations` tables
- [x] **Cron Job (Scheduled Audits)**
  - [x] Create cron Route Handler `run-audits` (`app/api/cron/audit/route.ts`)
  - [x] Configure Vercel Cron trigger (daily at 3 AM EST)
  - [x] Implement plan-aware frequency (weekly for Starter, daily for Growth)
  - [x] Implement usage metering (increment counter, enforce limit)
- [x] **The Viral Free Tool (Public)**
  - [x] Build `/check` page: Business Name + City input form
  - [x] Backend: Google Places API lookup for Ground Truth (NOT the `locations` table — business is not a tenant. See Doc 05, Section 9)
  - [x] Backend: Single Perplexity check
  - [x] Frontend: Render Pass/Fail report card
  - [x] Implement rate limiting: 5 per IP per day (Vercel KV) *(Phase 22 — `checkRateLimit()` in `app/actions/marketing.ts`)*
  - [x] CTA: "Fix this Alert" → redirect to signup
  - [x] Google Places autocomplete — debounced dropdown, manual city fallback, `not_found` state *(Sprint 29)*
  - [x] Honest `unavailable` state — no fabricated fail results when API is unconfigured *(Sprint 31)*
  - [x] Smart Search — dual-mode input: Business Name OR Website URL (auto-detected via regex) *(Sprint 33)*
  - [x] Diagnostic processing screen — CSS animated overlay with cycling messages during scan *(Sprint 33)*
  - [x] Public `/scan` result dashboard — alert banner + real AI-presence fields (mentions, sentiment) + locked numerical scores + locked competitive bars + locked fixes + CTA *(Sprint 33, refined Sprint 34)*
- [x] **Risk Dashboard (Private)**

  > **Architectural note (Phase 22):** The hallucination endpoints below were implemented
  > as Next.js Server Actions rather than REST Route Handlers. Server Actions are idiomatic
  > for App Router internal mutations and provide RLS-scoped auth automatically via
  > `getSafeAuthContext()`. REST endpoints are deferred to Phase 4+ when external API
  > consumers require them.

  - [x] `GET /api/v1/hallucinations` → covered by `fetchHallucinations()` Server Action (`app/dashboard/hallucinations/actions.ts`)
  - [x] `POST /api/v1/hallucinations/:id/verify` → covered by `verifyHallucinationFix()` Server Action (Phase 21)
  - [x] `PATCH /api/v1/hallucinations/:id/dismiss` → covered by `dismissHallucination()` Server Action
  - [x] Build AlertFeed component (Doc 06, Section 3)
  - [x] Build RealityScoreCard component
  - [x] `GET /api/v1/dashboard/stats` → covered by direct Supabase queries in `app/dashboard/page.tsx`
- [x] **Alert Emails**
  - [x] Integrate Resend API
  - [x] Build "New Risk Detected" email template
  - [x] Wire cron job to send email when new hallucinations found

### Acceptance Criteria
- [x] A non-logged-in user can run a free check and see a real result in < 15 seconds
- [x] A logged-in user sees their active hallucinations on the dashboard
- [x] "Verify Fix" triggers a re-check and updates the status
- [x] Cron runs successfully for Charcoal N Chill (Golden Tenant)
- [x] Email alert arrives when a new hallucination is detected
- [x] `npx vitest run src/__tests__/unit/hallucination-classifier.test.ts` — **ALL PASS**
- [x] `npx vitest run src/__tests__/unit/reality-score.test.ts` — **ALL PASS**
- [x] `npx vitest run src/__tests__/unit/plan-enforcer.test.ts` — **ALL PASS**
- [x] `npx playwright test tests/e2e/01-viral-wedge.spec.ts` — **ALL PASS**
      *(Build plan named this `free-hallucination-check.spec.ts` — actual file is `tests/e2e/01-viral-wedge.spec.ts`)*

---

## Phase 2: The "Magic" Engine (Weeks 7–10) — RETENTION

**Goal:** Give users the tool to FIX the hallucinations found in Phase 1.
**Deliverable:** `menu.localvector.ai/{slug}` (Public Magic Menu pages).

### ⚡ Minimum Shippable (if behind schedule, ship ONLY these)
1. Manual menu entry form (category → item → price) that generates JSON-LD. Uses `POST /magic-menu/manual` + `PUT /magic-menu/:id` (Doc 05, Section 4).
2. Public `menu.localvector.ai/{slug}` page with valid schema
3. Propagation Timeline component on the dashboard

**What can slip to Phase 2.5:** OCR/PDF upload pipeline (manual entry still delivers the core value — AI-readable schema), split-screen review UI, crawler analytics.

### Checklist

- [x] **Menu Digitizer (OCR Pipeline)**
  - [x] Build file uploader (PDF/Image → Supabase Storage)
  - [x] Build OpenAI GPT-4o Vision integration
  - [x] Implement Digitizer prompt (Doc 04, Section 4.2)
  - [x] Store extracted JSON in `magic_menus.extracted_data`
  - [x] Store individual items in `menu_items` table
- [x] **Review Interface**
  - [x] Build split-screen: original PDF preview ↔ extracted items
  - [x] **🤖 Agent Rule:** Use a `useReducer` hook or `zustand` store for the menu state machine (`idle → uploading → processing → review_ready → editing → certifying → publishing → published`). Do NOT use multiple `useState` calls. See Doc 06.
  - [x] Make prices/descriptions editable inline
  - [x] Implement "I certify this is correct" checkbox
  - [x] Build JSON-LD schema generator (Doc 04, Section 4.3)
  - [x] **Link Injection Modal:** Build the "Copy & Inject" modal with Google Business Profile deep link (Doc 06 v2.1 update). Wire to `POST /track-injection`.
- [x] **Public Edge Layer**
  - [ ] Configure `menu.localvector.ai` DNS in Vercel *(infrastructure — not verifiable from code)*
  - [x] Build `/m/[slug]` page (SSR with edge caching) — `app/m/[slug]/page.tsx`
  - [x] Render clean HTML menu for humans
  - [x] Inject JSON-LD `<script>` in `<head>` for AI
  - [x] Set `rel="canonical"` to restaurant's main website
  - [x] Configure `robots.txt` and bot-friendly headers
  - [x] Implement Vercel Edge Cache (24h TTL) — `export const revalidate = 86400` *(Phase 22)*
- [x] **Dashboard Integration**
  - [x] Build Menu page with upload/review/publish states (Doc 06, Section 4)
  - [x] Show public URL with copy button
  - [ ] Show page view counter and crawler stats *(Phase 23 — analytics not yet instrumented)*

### Acceptance Criteria
- [x] Upload a Charcoal N Chill PDF menu → AI extracts items with >90% accuracy
- [x] User can edit a misread price, certify, and publish
- [x] `menu.localvector.ai/charcoal-n-chill` renders with valid JSON-LD
- [x] Page loads in < 200ms (edge cached) *(ISR `revalidate = 86400` added Phase 22)*
- [ ] Google's Rich Results Test validates the schema *(manual verification — not automated)*
- [x] `npx vitest run src/__tests__/unit/generateMenuJsonLd.test.ts` — **ALL PASS**
      *(Build plan named this `json-ld-generator.test.ts` — actual file is `generateMenuJsonLd.test.ts`)*
- [x] `npx playwright test tests/e2e/04-magic-menu-pipeline.spec.ts` — **ALL PASS**
      *(Build plan named this `magic-menu-pipeline.test.ts` as a Vitest integration test — actual implementation is a Playwright E2E spec)*
- [ ] `npx vitest run src/__tests__/unit/llms-txt-generator.test.ts` — **ALL PASS** *(Phase 23)*

---

## Phase 3: The "Greed" Engine (Weeks 11–14) — GROWTH UPSELL

**Goal:** Build features that justify the $59/mo Growth tier.
**Deliverable:** Competitor Intercept module.

### ⚡ Minimum Shippable (if behind schedule, ship ONLY these)
1. Add 3 competitors by name (no autocomplete needed — text input is fine)
2. One Perplexity head-to-head check per competitor showing who AI recommends
3. "Upgrade to Growth" gate on the Compete page for Starter users

**What can slip to Phase 3.5:** Detailed intercept analysis with GPT-4o-mini, actionable task generation, Google Places autocomplete, cron-based competitor monitoring.

### Checklist

- [x] **Competitor Management**
  - [x] Build competitor CRUD (add/edit/delete, max 3 for Growth) — `addCompetitor`, `deleteCompetitor` Server Actions; `CompetitorChip` + `AddCompetitorForm` UI
  - [x] Google Places autocomplete for competitor lookup *(shipped Phase 3.1)*
- [x] **Intercept Logic**
  - [x] Create `__fixtures__/mock-greed-analysis.ts` with sample GPT-4o-mini intercept response — added `MOCK_COMPETITOR` + `MOCK_INTERCEPT` to `golden-tenant.ts`; `MOCK_INTERCEPT_ANALYSIS` to `handlers.ts` per AI_RULES §19.4
  - [x] Implement Head-to-Head prompt (Doc 04, Section 3.1) — Perplexity Sonar stage in `runCompetitorIntercept`
  - [x] Implement Intercept Analysis with GPT-4o-mini (Doc 04, Section 3.2) — GPT-4o-mini stage; MSW handler discriminates by `body.model` per AI_RULES §19.3
  - [x] Store results in `competitor_intercepts` table — INSERT in `runCompetitorIntercept`; `gap_analysis` typed as `GapAnalysis` JSONB
  - [x] Generate action tasks (Doc 04, Section 3.3) — `suggested_action` field; `markInterceptActionComplete` action
- [x] **Dashboard**
  - [x] Build Compete page (Doc 06, Section 5) — `app/dashboard/compete/page.tsx`
  - [x] Build InterceptCard and ActionTask components — `InterceptCard.tsx` + `RunAnalysisButton.tsx`
  - [x] Implement plan gating (Growth+ only) — `canRunCompetitorIntercept(plan)` check in page + actions
  - [x] Build "Upgrade to unlock" overlay for Starter users — inline `UpgradeGate` in page.tsx
- [x] **Cron Integration**
  - [x] Add competitor checks to daily audit cron (Growth plan only) *(shipped Phase 3.1)*

### Acceptance Criteria
- [x] User can add 3 competitors and see intercept results (real-time on-demand, not 24h batch)
- [x] Each intercept includes a specific, actionable task (`suggested_action` + Mark Complete / Dismiss)
- [x] Starter users see a locked "Upgrade" overlay on the Compete page
- [x] Growth users see competitor data; Starter users do not
- [x] `npx vitest run src/__tests__/unit/plan-enforcer.test.ts` — **ALL PASS** (feature gating 100%)
- [x] `npx vitest run src/__tests__/unit/competitor-actions.test.ts` — **22/22 PASS**
- [x] `npx vitest run` — **260 passing** after Phase 3.1 (Places autocomplete + cron intercepts); **267 passing** after Group A schema remediation (RLS integration test now passing with properly-initialized DB)

---

## Phase 4: Listings & Polish (Weeks 15–16)

**Goal:** Fill in the remaining features and polish for public launch.
**Deliverable:** Complete dashboard with Big 6 listings, onboarding wizard, and reports.

### Checklist

- [x] **Listings Management** *(Sprint 27A — partial)*
  - [x] **🤖 Agent Rule:** Do NOT implement any OAuth integration or write-back API for external directories. All `/listings` endpoints update internal records only. See Doc 05, Section 6 scope declaration.
  - [x] Build Listings page — Big 6 table, Deep Night theme, NAP Coverage badge (Sprint 27A)
  - [x] Manual listing URL input per directory — on-blur `savePlatformUrl()` Server Action (Sprint 27A)
  - [ ] Basic link health check (404 detection) *(Phase 8b)*
  - [ ] NAP consistency score calculation *(Phase 8b)*
- [ ] **Onboarding Wizard**
  - [ ] Build Step 1–5 flow (Doc 06, Section 7)
  - [ ] Auto-run first audit during onboarding
- [x] **Settings & Account** *(Sprint 24B — partial)*
  - [x] Account settings: display name edit, password change (Sprint 24B)
  - [x] Organization name edit; plan tier read-only chip + billing link (Sprint 24B)
  - [ ] Business info editor — hours, amenities, categories *(post-launch)*
  - [x] Billing portal — Stripe Checkout for Starter/Growth; Agency mailto CTA (Sprint 25A). Customer Portal + plan state display + subscription.deleted handler (Sprint 56B)
  - [ ] Location management — add/edit for Agency tier *(post-launch)*
- [ ] **Reports & Export**
  - [ ] CSV export of hallucination history
  - [ ] PDF audit report (white-label for Agency tier)
- [x] **Marketing Site** *(Sprint 25A–C)*
  - [x] Build `localvector.ai` homepage (Doc 08) — hero, features, pricing nav, legal footer
  - [x] Implement SoftwareApplication JSON-LD schema (Sprint 25C)
  - [x] Build `/pricing` page (Sprint 25A)
  - [x] Build `/privacy` and `/terms` legal pages (Sprint 25B)
  - [x] `llms.txt` + `ai-config.json` AEO endpoints (Sprint 25C)
  - [ ] `/about`, `/what-is/*` pages *(post-launch)*

### Acceptance Criteria
- [ ] New user completes onboarding in < 3 minutes
- [ ] All 7 directories show on the Listings page
- [ ] Agency user can switch between organizations
- [ ] Marketing site passes Google Rich Results Test
- [ ] `npx playwright test` (full E2E suite) — **ALL PASS**
- [ ] `npx vitest run` (full unit + integration suite) — **ALL PASS**

---

## Phase 5: SOV Engine & Reality Score Completion (Weeks 17–19)

**Goal:** Replace the hardcoded Visibility component (currently `98`) with real share-of-answer data. Make the Reality Score mean something.
**Deliverable:** `/visibility` dashboard page live. SOV cron running. First Mover Alert feed active.
**Spec:** Doc 04c — SOV Engine Specification

### ⚡ Minimum Shippable
1. SOV cron runs weekly, writes to `visibility_analytics`
2. Reality Score Visibility component reads real data (not hardcoded 98)
3. Query library seeded for all active locations at onboarding

**What can slip:** Custom query UI (Growth feature), First Mover Alert email, 8-week trend chart (show current week only first).

### Checklist

- [x] **Database Migration**
  - [x] ⚠️ **NOTE (Sprint 88 reconciliation, 2026-02-28):** `docs/20260223000001_sov_engine.sql` has been formally SUPERSEDED. It planned `sov_target_queries` + `sov_first_mover_alerts` as replacement tables, but all intended features were delivered incrementally into the existing `target_queries` + `content_drafts` tables across sprints 48–88. The migration file is preserved for historical reference with a SUPERSEDED header. No table rename is needed.
  - [x] `target_queries` has `query_category`, `occasion_tag`, `intent_modifier` (Sprint 65, migration `20260226000001`)
  - [x] `UNIQUE(location_id, query_text)` constraint (Sprint 88, migration `20260228000002`)
  - [x] `is_active` column for soft-disable toggle (Sprint 88, migration `20260228000002`)
  - ~~Migrate to `sov_target_queries`~~ — **SUPERSEDED.** Table stays as `target_queries`. See Sprint 88.
  - ~~Create `sov_first_mover_alerts`~~ — **SUPERSEDED.** First Mover alerts use `content_drafts.trigger_type = 'first_mover'`. See Sprint 48.

- [x] **Query Seeding**
  - [x] `seedSOVQueries(location)` in `lib/services/sov-seed.ts` — 4 query categories (discovery, near_me, occasion, comparison)
  - [x] Wired into onboarding completion (`app/onboarding/actions.ts` line 130)
  - [x] Golden Tenant seeded with system-generated queries (`supabase/seed.sql`)

- [x] **SOV Cron**
  - [x] `app/api/cron/sov/route.ts` — Route Handler with Inngest dispatch + inline fallback
  - [x] `runSOVQuery()` with Perplexity Sonar + OpenAI multi-model (Sprint 61B)
  - [x] `writeSOVResults()` — upserts to `visibility_analytics`
  - [x] `STOP_SOV_CRON` kill switch
  - [x] Vercel Cron trigger configured in `vercel.json`
  - [x] `CRON_SECRET` auth guard

- [x] **Reality Score Fix**
  - [x] Visibility reads live `visibility_analytics.share_of_voice` x 100 (`lib/data/dashboard.ts` line 199)
  - [x] Hardcoded `98` removed — `RealityScoreCard` accepts `visibility: number | null`
  - [x] `state: 'calculating'` UI — shows "First AI visibility scan runs Sunday, {date}" when null
  - [x] Score formula: `realityScore = visibility * 0.4 + accuracy * 0.4 + dataHealth * 0.2`

- [x] **First Mover Alert Pipeline**
  - [x] First Mover alerts created via `content_drafts` with `trigger_type = 'first_mover'` (Sprint 48)
  - [x] `FirstMoverCard` component (`app/dashboard/share-of-voice/_components/FirstMoverCard.tsx`)
  - ~~`sov_first_mover_alerts` table~~ — **SUPERSEDED** (uses `content_drafts`)
  - ~~`GET /api/sov/alerts` endpoint~~ — **SUPERSEDED** (server component reads `content_drafts` directly)
  - [ ] Wire alert count to sidebar badge — deferred (not blocking)

- [x] **SOV Dashboard (`/share-of-voice`)**
  - [x] `/dashboard/share-of-voice/page.tsx` — full page with score ring, trend chart, query table, first mover cards, gap alerts, category breakdown
  - [x] `SOVScoreRing` with calculating state
  - [x] `SovCard` (query table with eval results + pause/resume toggle)
  - [x] `addTargetQuery`, `deleteTargetQuery`, `runSovEvaluation`, `toggleQueryActive` server actions
  - [x] "Share of Voice" in sidebar

- [x] **Content Draft Trigger**
  - [x] `createDraft()` called for first_mover alerts and prompt_missing gaps (Sprint 48)
  - [x] `content_drafts` table created (`20260224000001_content_pipeline.sql`)

### Acceptance Criteria
- [x] SOV cron runs against Charcoal N Chill and writes to `visibility_analytics`
- [x] Reality Score Visibility component shows real number (not 98)
- [x] New tenant sees "Calculating..." state — not `0` or `98`
- [x] First Mover Alerts appear in `/share-of-voice` when no local business is cited
- [x] `npx vitest run src/__tests__/unit/cron-sov.test.ts` — **ALL PASS**
- [x] `npx vitest run src/__tests__/unit/share-of-voice-actions.test.ts` — **ALL PASS**

---

## Phase 6: Content Draft Review UI (Autopilot — HITL Layer)

**Goal:** Surface AI-generated content drafts (created by Phase 5 Greed Engine trigger) in a review UI. Give users the ability to approve, edit, and publish content without a coding agent.
**Deliverable:** `/content-drafts` page. Approve → Download flow working. Growth plan CTA.
**Spec:** Doc 05 Section 13, Doc 06 Section 9

### ⚡ Minimum Shippable
1. Draft list view showing pending drafts
2. Draft detail view with inline editor
3. Approve → Download as HTML (no WordPress integration yet)
4. Reject → back to draft status

**What can slip:** WordPress publish integration, GBP post publish, AEO score live recalculation while typing.

### Checklist

- [x] **Content Draft Endpoints** — ✅ Sprint 48: Implemented as Server Actions (not REST endpoints) per Next.js App Router pattern
  - [x] `GET /api/content-drafts` — ✅ Sprint 42: List page with RLS-scoped query + status filter
  - [x] `GET /api/content-drafts/:id` — ✅ Sprint 48: Detail view `[id]/page.tsx` with full content + trigger context panel
  - [x] `PATCH /api/content-drafts/:id` — ✅ Sprint 48: `editDraft()` server action (validates status, recalculates AEO)
  - [x] `POST /api/content-drafts/:id/approve` — ✅ Sprint 42: `approveDraft()` server action
  - [x] `POST /api/content-drafts/:id/reject` — ✅ Sprint 48: `rejectDraft()` fixed to return to `draft` status
  - [x] `POST /api/content-drafts/:id/publish` — ✅ Sprint 48: `publishDraft()` — 3 targets (download, gbp_post, wordpress)
  - [x] **🤖 Agent Rule:** `POST /publish` validates `human_approved: true` AND `status: 'approved'` server-side. — ✅ Sprint 48: NON-NEGOTIABLE HITL in `publishDraft()`, returns 403 if either fails

- [x] **Content Draft UI** — ✅ Sprint 42 (list) + Sprint 48 (detail + publish)
  - [x] Build `/dashboard/content-drafts/page.tsx` — ✅ Sprint 42: list view with filter tabs + summary strip
  - [x] Build `/dashboard/content-drafts/[id]/page.tsx` — ✅ Sprint 48: detail/review view with context panel
  - [x] Build `ContentDraftCard` component — ✅ Sprint 42 (badges, AEO) + Sprint 48 (Link to detail, Publish/Archive buttons)
  - [x] Build `ContentDraftEditor` — ✅ Sprint 48: `DraftEditor.tsx` with live AEO score recalculation
  - [x] Implement Approve → publish target selector modal — ✅ Sprint 48: `PublishDropdown.tsx` with factual disclaimer modal
  - [x] Implement Reject modal — ✅ Sprint 42: Reject button (returns to draft status, no modal needed per simplified flow)
  - [ ] Add "Content Drafts" to sidebar with amber badge count (Growth+ only) — ⏳ Sidebar link exists, badge count not yet added
  - [ ] Empty state CTA linking to `/compete` (Doc 06 Section 9.4) — ⏳ Not yet implemented

- [ ] **Occasion Alert Feed (Phase 6 lite)**
  - [ ] Build `OccasionAlertCard` component (Doc 06 Section 10.2)
  - [x] Seed `local_occasions` reference table (32 occasions — Sprint 56C expansion)
  - [ ] Wire upcoming occasion alerts to Dashboard home (below Active Alerts — Doc 06 Section 10.1)
  - [ ] "Remind Later" snooze via `localStorage` (no server call needed)
  - [ ] Add occasion badge to Visibility sidebar item

### Acceptance Criteria
- [x] Greed Engine `gap_magnitude = 'high'` intercept creates a `content_drafts` row automatically — ✅ Sprint 48: `sov-engine.service.ts` now calls `createDraft()` for first_mover alerts; `cron/sov/route.ts` calls `createDraft()` for prompt_missing gaps
- [x] Draft appears in `/content-drafts` list with pending status — ✅ Sprint 42 (list view) + Sprint 48 (AI-generated content)
- [x] User can edit draft, approve it, and download as HTML file — ✅ Sprint 48: `editDraft()` server action, detail view with `DraftEditor`, `publishDraft()` with download target, `PublishDropdown` component
- [x] Rejected draft returns to `draft` status with rejection note visible — ✅ Sprint 48: Fixed `rejectDraft()` to set `{ status: 'draft', human_approved: false }` (was incorrectly `status: 'rejected'`)
- [ ] Starter users see `<PlanGate featureId="content_drafts" />` overlay — ⏳ Plan gate exists on `publishDraft()` server action (Growth+); UI-level `<PlanGate>` overlay not yet added to list page
- [x] `npx vitest run src/__tests__/unit/content-draft-workflow.test.ts` — ✅ Fulfilled by Sprint 48: `autopilot-create-draft.test.ts` (17), `autopilot-publish.test.ts` (19), `autopilot-post-publish.test.ts` (13), `content-drafts-actions.test.ts` (23) — 72 tests total
- [ ] `npx playwright test tests/e2e/content-draft-review.spec.ts` — ⏳ Full HITL E2E spec not yet written (requires seed data with approved draft); basic `08-content-drafts.spec.ts` passes (3 tests)

---

## Phase 7: Citation Intelligence & Page Audits (Content Grader)

**Goal:** Answer "which platforms does AI actually cite for my category?" and "is my website AEO-ready?" Site-wide content grading replaces menu-only readability scores.
**Deliverable:** AI Citation Map tab on Listings page. Page Audit in `/visibility`. Growth CTA for both.
**Spec:** Doc 05 Sections 14–15, Doc 06 Sections 8 & 11

### ⚡ Minimum Shippable
1. Citation Intelligence cron writes to `citation_source_intelligence` for 5 major hospitality categories × top 10 metros
2. Citation Gap Finder tab on Listings page (Growth+ gated)
3. Manual page audit for homepage (all plans)

**What can slip:** Monthly page audit cron (offer on-demand first), Reddit/Nextdoor monitoring, citation gap score integrated into Reality Score DataHealth component.

### Checklist

- [ ] **Citation Intelligence Cron**
  - [ ] Build `app/api/cron/citation/route.ts` — Next.js Route Handler
  - [ ] For each category × metro combination: run 5 sample SOV queries, record which platforms are cited
  - [ ] Write results to `citation_source_intelligence` table (upsert on `category, city, state, platform, model_provider`)
  - [ ] Seed initial data for: hookah lounge, restaurant, bar, event venue, lounge — across top 20 US metros
  - [ ] Schedule: monthly (first Sunday of month, 3 AM EST)

- [ ] **Citation Gap Endpoints**
  - [ ] `GET /api/citations/platform-map` (joins `citation_source_intelligence` + tenant `listings`) — Doc 05 Section 15
  - [ ] `GET /api/citations/gap-score` (single 0–100 gap score)

- [x] **Citation Gap UI** *(Sprint 58A — standalone dashboard at `/dashboard/citations`)*
  - [x] Build `CitationGapScore` — SVG circular score ring (Sprint 58A)
  - [x] Build `PlatformCitationBar` — frequency bar visualization sorted by citation_frequency (Sprint 58A)
  - [x] Build `TopGapCard` — highlighted #1 gap card with "Claim Your Listing" CTA (Sprint 58A)
  - [x] Build `/dashboard/citations/page.tsx` — server component with plan gate (`canViewCitationGap`, Growth+) (Sprint 58A)
  - [x] Add "Citations" nav item to Sidebar (Globe icon) (Sprint 58A)
  - [ ] Starter plan blur-teaser (render real data with `blur-sm` + `<PlanGate>` overlay — Doc 06 Section 11.5) *(deferred — currently shows upgrade card instead)*

- [x] **Page Audit (Site-Wide Content Grader)** *(Sprint 58B — standalone dashboard at `/dashboard/page-audits`)*
  - [x] Build `lib/page-audit/auditor.ts` — fetches URL, scores AEO readiness across 5 dimensions *(already existed pre-Sprint 58)*
  - [x] Build `AuditScoreOverview` — aggregate AEO score ring (Sprint 58B)
  - [x] Build `PageAuditCard` + `DimensionBar` — per-page card with 5 dimension bars + re-audit button (Sprint 58B)
  - [x] Build `reauditPage()` server action — rate-limited re-audit (5 min per page) (Sprint 58B)
  - [x] Build `/dashboard/page-audits/page.tsx` — server component with plan gate (`canRunPageAudit`, Growth+) (Sprint 58B)
  - [x] Add "Page Audits" nav item to Sidebar (FileSearch icon) (Sprint 58B)
  - [ ] Starter plan: homepage audit only. Growth+: full site. *(deferred — currently shows upgrade card for Starter/Trial)*
  - [x] **🤖 Agent Rule:** Page auditor fetches URLs via `fetch()` with a `User-Agent: LocalVector-AuditBot/1.0` header. Never attempt to bypass auth walls. `422` if page returns non-200.

### Acceptance Criteria
- [ ] `citation_source_intelligence` has data for hookah lounge + Alpharetta (Golden Tenant test)
- [ ] Listings page AI Citation Map shows TripAdvisor gap for Charcoal N Chill (not listed)
- [ ] `POST /api/pages/audits/run` on `charcoalnchill.com` returns scored recommendations
- [ ] Growth users see citation map; Starter users see blur teaser
- [ ] `npx vitest run src/__tests__/unit/page-auditor.test.ts` — **ALL PASS**
- [ ] `npx vitest run src/__tests__/unit/citation-gap-scorer.test.ts` — **ALL PASS**

---

## Phase 8: GBP OAuth Onboarding & Autopilot Publish

**Goal:** Remove friction from onboarding (GBP import replaces manual wizard for most users) and close the content pipeline loop (approve → publish to WordPress).
**Deliverable:** GBP OAuth onboarding live. WordPress publish integration live. Fully closed detect → diagnose → draft → approve → publish → measure loop.
**Spec:** RFC_GBP_ONBOARDING_V2_REPLACEMENT.md, Doc 19 Autopilot Engine (planned)

### ⚡ Minimum Shippable
1. GBP OAuth button on onboarding interstitial (`/onboarding/connect`)
2. Successful import sets `hours_data` + `amenities` from GBP — bypasses manual wizard
3. WordPress publish target for content drafts

**What can slip:** GBP token refresh cron (tokens last 60 days; Phase 8.5), Autopilot occasion page auto-generation (requires Doc 16 Occasion Engine spec).

### Checklist

- [x] **Database Migration**
  - [x] ~~Run `supabase/migrations/20260223000003_gbp_integration.sql`~~ → promoted as `20260224000002_gbp_integration.sql` (Group A, 2026-02-23). `google_oauth_tokens`, `pending_gbp_imports` tables + `locations.google_location_name`, `locations.gbp_integration_id` columns now in schema.
  - [x] Verify `google_oauth_tokens` and `pending_gbp_imports` tables created — confirmed in 27-table schema post-db-reset
  - [x] Verify `locations.google_location_name` and `locations.gbp_integration_id` columns added — confirmed in prod_schema.sql
  - [x] **🤖 Agent Rule (updated Sprint 57B):** `google_oauth_tokens` has RLS enabled. `org_isolation_select` grants SELECT to `authenticated`. INSERT/UPDATE/DELETE service-role only. Migration: `20260226000006_google_oauth_tokens_rls.sql`.

- [x] **GBP OAuth Pipeline** *(Sprint 57B — core connect/disconnect flow)*
  - [ ] Register Google Cloud OAuth 2.0 client — scopes: `https://www.googleapis.com/auth/business.manage` *(env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)*
  - [x] Build `app/api/auth/google/route.ts` — CSRF state cookie, redirect to Google consent (Sprint 57B)
  - [x] Build `app/api/auth/google/callback/route.ts` — code exchange, token storage, GBP account + email fetch (Sprint 57B)
  - [x] Build `app/onboarding/connect/page.tsx` — interstitial with "Connect GBP" + "Do it manually" escape (Sprint 89)
  - [x] Build `app/onboarding/connect/select/page.tsx` — location picker (reads `pending_gbp_imports`) (Sprint 89)
  - [x] Build `disconnectGBP()` server action in `app/dashboard/integrations/actions.ts` (Sprint 57B)
  - [x] Build `importGBPLocation()` server action (Sprint 89)
  - [x] Update `app/(auth)/register/page.tsx` redirect: `/dashboard` → `/onboarding/connect` (Sprint 89)
  - [x] Build `GBPConnectButton.tsx` — 4-state UI: not-configured / plan-gated / connect / connected+disconnect (Sprint 57B)
  - [x] Update `app/dashboard/integrations/page.tsx` — GBP Connect section with plan gating via `canConnectGBP()` (Sprint 57B)
  - [x] **🤖 Agent Rule:** `pending_gbp_imports` rows expire after 10 minutes (`expires_at`). Location picker page validates expiry before rendering — redirect to `/onboarding/connect` if expired. (Sprint 89)

- [x] **GBP Data Mapping** (Sprint 89)
  - [x] Map GBP `regularHours` → `locations.hours_data` (HoursData type, 24h format)
  - [ ] Map GBP `openInfo.status` → `locations.operational_status` *(deferred — not in readMask)*
  - [x] Map GBP attributes → `locations.amenities` set to null (intentional gap per RFC §4.3)
  - [ ] **⚠️ Timezone gap (RFC Rev 2 §4.2):** GBP hours have no explicit timezone. *(deferred to Sprint 90)*

- [x] **WordPress Publish Integration** *(Sprint 94 — verified + fixed)*
  - [x] Build `lib/autopilot/publish-wordpress.ts` — WordPress REST API client (Basic auth, Application Password)
  - [x] WordPress connection settings at `/settings` (site URL + application password in `location_integrations`)
  - [x] Wire `publishDraft()` server action with `publish_target: 'wordpress'`
  - [x] On publish: create WordPress draft page, store `published_url` in `content_drafts`
  - [x] Publish confirmation dialog (irreversible external write guard)
  - [x] 14 unit tests (`publish-wordpress.test.ts`)

- [x] **GBP Post Publish Integration** *(Sprint 94 — verified + fixed)*
  - [x] Build `lib/autopilot/publish-gbp.ts` — posts content as GBP Local Post using stored OAuth token
  - [x] Wire `publishDraft()` server action with `publish_target: 'gbp_post'`
  - [x] Token refresh via `isTokenExpired()` + `refreshGBPAccessToken()` from Sprint 90
  - [x] HTML tag stripping + 1500-char sentence-boundary truncation
  - [x] 20 unit tests (`publish-gbp.test.ts`)

### Acceptance Criteria
- [ ] New user signing up via Google can import GBP data and reach dashboard in < 30 seconds
- [ ] GBP import sets `hours_data` and `amenities` — Onboarding Guard clears without manual wizard
- [ ] Fallback: user who skips/fails GBP import lands on existing manual wizard unchanged
- [ ] WordPress publish creates a WP page and stores URL in `content_drafts.published_url`
- [ ] `npx vitest run src/__tests__/unit/gbp-data-mapper.test.ts` — **ALL PASS**
- [ ] `npx playwright test tests/e2e/gbp-onboarding.spec.ts` — **ALL PASS**

---

## Sprint 59 — Cross-Phase Feature Completion (2026-02-25)

These features span multiple phases but were completed together in Sprint 59.

### 59A — Magic Menu PDF Upload via GPT-4o Vision (Phase 2)

- [x] Add `MenuOCRSchema` to `lib/ai/schemas.ts` — Zod schema for GPT-4o Vision extraction
- [x] Add `'menu-ocr'` model key to `lib/ai/providers.ts` — maps to `openai('gpt-4o')`
- [x] Add `uploadMenuFile()` server action to `app/dashboard/magic-menus/actions.ts` — accepts PDF/JPG/PNG/WebP (max 10 MB), calls `generateObject()` with file content part
- [x] Wire UploadState.tsx Tab 1 drop zone to `uploadMenuFile` — drag-and-drop + file select, loading state, error display

### 59B — Revenue Leak Historical Trend Persistence (new)

- [x] Add `snapshotRevenueLeak()` to `lib/services/revenue-leak.service.ts` — idempotent upsert to `revenue_snapshots` with `onConflict: 'org_id,location_id,snapshot_date'`
- [x] Wire into `app/api/cron/audit/route.ts` inline fallback path
- [x] Wire into `lib/inngest/functions/audit-cron.ts` as Step 4 fan-out (`snapshot-revenue-leak-{orgId}`)
- [x] Tables already existed: `revenue_config`, `revenue_snapshots` (migration `20260225000001_revenue_leak.sql`)

### 59C — Weekly Digest Email (Phase 5 SOV cron)

- [x] Enhance `emails/WeeklyDigest.tsx` — added `sovDelta`, `topCompetitor`, `citationRate` props + sections
- [x] Add `sendWeeklyDigest()` to `lib/email.ts` — Resend `react:` property with React Email component
- [x] Replace `sendSOVReport()` with `sendWeeklyDigest()` in `app/api/cron/sov/route.ts`
- [x] Replace `sendSOVReport()` with `sendWeeklyDigest()` in `lib/inngest/functions/sov-cron.ts`

---

## Sprint 60 — Reliability: Error Boundaries, Auth Gaps, E2E Specs (2026-02-25)

### 60B — Error Boundaries + Google OAuth + Password Reset

- [x] Create `error.tsx` files for 5 dashboard sections (dashboard, hallucinations, share-of-voice, ai-assistant, content-drafts) — Sentry capture + AlertTriangle icon + "Try again" button
- [x] Add "Sign in with Google" button to `/login` — Supabase `signInWithOAuth({ provider: 'google' })`
- [x] Add "Sign up with Google" button to `/register` — same OAuth call
- [x] Add "Forgot password?" link to login page
- [x] Build `app/(auth)/forgot-password/page.tsx` — `resetPasswordForEmail()` + success/error states
- [x] Build `app/(auth)/reset-password/page.tsx` — `updateUser({ password })` + redirect to `/login`

### 60A — Playwright E2E Specs + data-testid

- [x] Add `data-testid` attributes to all 13 sidebar nav links in `components/layout/Sidebar.tsx` (count updated: +AI Assistant Sprint 68, +AI Says Sprint 69)
- [x] Create `tests/e2e/11-ai-assistant.spec.ts` — chat UI, quick-action buttons, input
- [x] Create `tests/e2e/12-citations.spec.ts` — heading, gap score or empty state, sidebar nav
- [x] Create `tests/e2e/13-page-audits.spec.ts` — heading, audit cards or empty state, sidebar nav
- [x] Create `tests/e2e/14-sidebar-nav.spec.ts` — 11 sidebar links navigate to correct pages (count updated Sprint 69)
- [x] Sprint 69: Add "AI Says" nav item (Quote icon), create `app/dashboard/ai-responses/` page + error boundary + components + data layer

---

## Sprint 61 — Polish: Occasion Calendar, Multi-Model SOV, WordPress Connect (2026-02-25)

### 61A — Occasion Calendar UI

- [x] Add `fetchUpcomingOccasions()` to `app/dashboard/content-drafts/page.tsx` — queries `local_occasions`, computes `daysUntilPeak`, filters to trigger window, sorts ascending
- [x] Add `fetchOccasionDraftMap(orgId)` — maps occasion `trigger_id` to existing draft IDs
- [x] Create `OccasionTimeline.tsx` client component — collapsible horizontal scrollable cards with countdown badges, type pills, "Create Draft" / "Draft exists" actions
- [x] Update `CreateDraftSchema` in `actions.ts` — accept optional `trigger_type` and `trigger_id` fields

### 61B — Multi-Model SOV Queries (Perplexity + OpenAI)

- [x] Add `engine` field to `SOVQueryResult` interface and `MODEL_ENGINE_MAP` to `lib/services/sov-engine.service.ts`
- [x] Add `modelKey` parameter to `runSOVQuery()` — defaults to `'sov-query'` (Perplexity)
- [x] Add `runMultiModelSOVQuery()` — `Promise.allSettled` with both Perplexity and OpenAI
- [x] Update `writeSOVResults()` — use `result.engine` instead of hardcoded `'perplexity'`
- [x] Add `canRunMultiModelSOV()` to `lib/plan-enforcer.ts` (Growth+)
- [x] Update `lib/inngest/functions/sov-cron.ts` — multi-model for Growth/Agency orgs
- [x] Update `app/api/cron/sov/route.ts` — same multi-model logic in inline fallback

### 61C — WordPress Credential Management

- [x] Create migration `20260226000007_wp_credentials.sql` — add `wp_username`, `wp_app_password` columns to `location_integrations`
- [x] Add `testWordPressConnection()`, `saveWordPressCredentials()`, `disconnectWordPress()` server actions to `app/dashboard/integrations/actions.ts`
- [x] Create `WordPressConnectModal.tsx` — form + "Test Connection" → "Save & Connect" flow
- [x] Create `WordPressConnectButton.tsx` — not-connected / connected states (follows GBP pattern)
- [x] Add WordPress section to `app/dashboard/integrations/page.tsx`
- [x] Wire `wp_username`/`wp_app_password` into `publishDraft()` WordPress branch in `content-drafts/actions.ts`

---

## Sprint 62 — Scale Prep: Cron Logging, Guided Tour, Subdomains, Landing Split, Settings, Multi-Location (2026-02-25)

### 62A — Cron Health Logging

- [x] Create migration `20260226000008_cron_run_log.sql` — `cron_run_log` table (UUID PK, cron_name, timestamps, duration_ms, status enum, summary JSONB, error_message), RLS enabled (no policies), index on `(cron_name, started_at DESC)`
- [x] Create `lib/services/cron-logger.ts` — `logCronStart()`, `logCronComplete()`, `logCronFailed()` with fail-safe error handling
- [x] Wire cron-logger into `app/api/cron/sov/route.ts`
- [x] Wire cron-logger into `app/api/cron/audit/route.ts`
- [x] Wire cron-logger into `app/api/cron/content-audit/route.ts`
- [x] Wire cron-logger into `app/api/cron/citation/route.ts`

### 62B — Post-Onboarding Guided Tour

- [x] Create `app/dashboard/_components/GuidedTour.tsx` — 5-step custom tooltip tour targeting sidebar `data-testid` attributes, localStorage `lv_tour_completed`, overlay + highlight ring, lg+ only
- [x] Render `<GuidedTour />` in `components/layout/DashboardShell.tsx`

### 62C — Subdomain Routing

- [x] Add hostname check to `proxy.ts` — `menu.*` rewrites to `/m/` path prefix, other hostnames fall through to existing auth logic

### 62D — Landing Page Performance

- [x] Extract `SectionLabel`, `MetricCard`, `PricingCard` into `app/_sections/shared.tsx`
- [x] Create `app/_sections/HeroSection.tsx` (static import, above fold)
- [x] Create `app/_sections/ProblemSection.tsx` (dynamic import)
- [x] Create `app/_sections/CompareSection.tsx` (dynamic import)
- [x] Create `app/_sections/EnginesSection.tsx` (dynamic import)
- [x] Create `app/_sections/PricingSection.tsx` (dynamic import)
- [x] Rewrite `app/page.tsx` from 1,181 lines to ~33 lines with `next/dynamic` code-splitting

### 62E — Settings Completeness

- [x] Create migration `20260226000009_notification_prefs.sql` — 3 boolean columns on `organizations`
- [x] Create `DeleteOrgModal.tsx` — type-to-confirm danger zone modal
- [x] Add `updateNotificationPrefs()` and `softDeleteOrganization()` server actions to `settings/actions.ts`
- [x] Fetch notification prefs in `settings/page.tsx`, pass to SettingsForm
- [x] Add Notifications section (3 toggles) and Danger Zone section to `SettingsForm.tsx`

### 62F — Agency Multi-Location UI

- [x] Create `components/layout/LocationSwitcher.tsx` — dropdown with cookie-based selection
- [x] Extend `Sidebar.tsx` with `locations` and `selectedLocationId` props, render LocationSwitcher
- [x] Thread locations through `DashboardShell.tsx` to Sidebar
- [x] Fetch all locations + read cookie in `app/dashboard/layout.tsx`, pass to DashboardShell
- [x] Rewrite `locations/page.tsx` — responsive card grid with plan-gated "Add Location"

---

## Sprint 63 — Generate Supabase Database Types & Eliminate `as any` Casts (2026-02-26)

### 63A — Generate `database.types.ts`

- [x] Replace empty `Database = {}` stub with full type definition (~1600 lines)
- [x] Cover all 28 tables with `Row` / `Insert` / `Update` / `Relationships`
- [x] Define 9 PostgreSQL enums
- [x] Include FK `Relationships` metadata for auto-typed JOINs (supabase-js v2.97.0)
- [x] Add 3 migration-only tables: `revenue_config`, `revenue_snapshots`, `cron_run_log`
- [x] Include migration-added columns on `organizations` and `location_integrations`

### 63B — Remove `as any` Casts

- [x] Remove ~96 `createClient() as any` / `createServiceRoleClient() as any` assignment casts
- [x] Type 18 service function `supabase: any` params as `SupabaseClient<Database>`
- [x] Remove 13 inline `(supabase as any)` usage casts in mcp/tools.ts and visibility-tools.ts
- [x] Remove ~8 JOIN result `as any` casts (auto-typed via Relationships)
- [x] Clean up all corresponding `eslint-disable-next-line` comments

### 63C — Fix Surfaced Type Errors

- [x] Fix `Json` ↔ specific type mismatches for JSONB columns across ~25 files
- [x] Fix enum narrowing for `plan_tier` / `plan_status` in Stripe webhook + compete actions
- [x] Fix column name `recommendation` → `suggested_action` in mcp/tools.ts + visibility-tools.ts
- [x] Remove `as Promise<...>` casts from query builders in dashboard/page.tsx
- [x] Add null safety for `is_primary`, `sync_status`, visibility analytics rows
- [x] Verify: `npx tsc --noEmit` = 0 non-test errors, only 4 non-Supabase `as any` remain

---

## Sprint 64 — Extract Dashboard Data Layer (2026-02-26)

- [x] Create `lib/data/dashboard.ts` — extract `fetchDashboardData()`, `DashboardData` interface, `HallucinationRow` type (~250 lines)
- [x] Create `lib/utils/dashboard-aggregators.ts` — extract `aggregateByModel()`, `aggregateCompetitors()` as pure functions
- [x] Reduce `app/dashboard/page.tsx` from 447 → 118 lines
- [x] Preserve `deriveRealityScore` in `page.tsx` (test import path dependency)
- [x] Re-export `HallucinationRow` from `page.tsx` for `AlertFeed.tsx` compatibility
- [x] Verify: `npx vitest run src/__tests__/unit/reality-score.test.ts` — 10 tests passing

---

## Sprint 65 — Clarify SOV Precision Formulas (2026-02-26)

- [x] Replace `Math.round(x * 10) / 1000` with `parseFloat((x / 100).toFixed(3))` in `writeSOVResults()` DB write formulas
- [x] Replace `Math.round(x * 10) / 10` with `parseFloat(x.toFixed(1))` in return value formulas
- [x] Zero behavioral change — bit-identical results, comments updated
- [x] Verify: `npx vitest run src/__tests__/unit/sov-engine-service.test.ts` — 11 tests passing

---

## Sprint 66 — README and package.json Identity Fix (2026-02-26)

- [x] Change `package.json` name from `scaffold-tmp` to `local-vector-v1`
- [x] Replace create-next-app README boilerplate with comprehensive project README (~201 lines)
- [x] README covers: product description, tech stack, project structure, getting started, env vars, scripts, database, architecture notes, documentation index
- [x] No code changes — docs only

---

## Sprint 96 — Plan Gate Polish: Blur Teasers (2026-02-27)

- [x] `components/plan-gate/PlanGate.tsx` — reusable blur-teaser plan gate wrapper (RSC)
- [x] `lib/plan-enforcer.ts` — added `planSatisfies()` + `PLAN_HIERARCHY` exports
- [x] Citations page wrapped in `<PlanGate requiredPlan="growth">` (replaced hard wall)
- [x] Page Audits page wrapped in `<PlanGate requiredPlan="growth">` (replaced hard wall)
- [x] Content Drafts page wrapped in `<PlanGate requiredPlan="growth">` (replaced UpgradeGate, restructured data fetch)
- [x] Sentiment page wrapped in `<PlanGate requiredPlan="growth">` (added plan fetch)
- [x] Source Intelligence page wrapped in `<PlanGate requiredPlan="agency">` (added plan fetch)
- [x] 32 unit tests (planSatisfies + PlanGate component)
- [x] 21 page integration tests (plan gate thresholds per page)
- [x] Full suite: 2139 tests, 0 regressions, 0 type errors
- [x] AI_RULES §47 added

---

## Technical Dependencies by Phase

| Phase | Core Dependency | Est. Cost (Dev Mode) | Risk |
|-------|----------------|---------------------|------|
| 0 | Supabase, Stripe, Vercel | $65/mo | Low |
| 1 | Perplexity API, Resend | +$50/mo | **Medium** (rate limits) |
| 2 | OpenAI GPT-4o Vision | Pay-per-use (~$1/menu) | Medium (OCR accuracy) |
| 3 | GPT-4o-mini | Minimal (~$0.01/analysis) | Low |
| 4 | — | — | Low |
| 5 | Perplexity Sonar (SOV queries) | +$4/mo/100 tenants | Low |
| 6 | GPT-4o-mini (Content Draft gen) | +$2/mo/100 tenants | Low |
| 7 | Firecrawl / Playwright (Page Audit) | +$5/mo at scale | Medium |
| 8 | WordPress REST API (Publish integration) | None (tenant-provided creds) | Medium |

---

## Launch Readiness Checklist

- [ ] Charcoal N Chill fully onboarded as Golden Tenant with real data
- [ ] At least 5 hallucinations detected and displayed correctly
- [ ] Magic Menu published and crawled by at least 1 AI bot
- [ ] Stripe payments work end-to-end (including webhook)
- [ ] Email alerts firing correctly
- [ ] Error monitoring configured (Vercel Analytics + Sentry)
- [ ] Privacy Policy and Terms of Service published
- [ ] Marketing site live with hallucination checker embedded
- [ ] **Full test suite green on CI** (`unit` + `integration` + `e2e`)
- [ ] **No critical or high severity test failures open**
- [ ] Google Places detail refresh cron deployed (30-day cycle for ToS compliance — see Doc 10, Section 4)
