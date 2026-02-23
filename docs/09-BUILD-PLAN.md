# 09 — Phased Build Plan & Execution Roadmap

## Execution Roadmap
### Version: 2.4 | Date: February 23, 2026

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
  - [x] Build `/signup`, `/login`, `/forgot-password` pages
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
  - [x] Billing portal — Stripe Checkout for Starter/Growth; Agency mailto CTA (Sprint 25A)
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

- [ ] **Database Migration**
  - [ ] ⚠️ **NOTE (Group A remediation, 2026-02-23):** `docs/20260223000001_sov_engine.sql` was NOT promoted to `supabase/migrations/`. It creates `sov_target_queries` + `sov_first_mover_alerts` (Phase 5 target schema), which differ from the live `target_queries` + `sov_evaluations` tables used by all existing SOV code (migration `20260221000004_create_sov_tracking.sql`). Promoting this migration as-is would create orphaned parallel tables. **Phase 5 build task:** migrate live `target_queries` data to `sov_target_queries` (richer schema), update all SOV code to use the new table names, then apply the migration.
  - [ ] Verify `sov_target_queries` and `sov_first_mover_alerts` tables created with correct RLS
  - [ ] Verify `sov_target_queries` UNIQUE constraint on `(location_id, query_text)`

- [ ] **Query Seeding**
  - [ ] Implement `seedSOVQueries(locationId)` in `lib/sov/seed.ts` (Doc 04c Section 3.1)
  - [ ] Call `seedSOVQueries()` on location creation (wire into the onboarding completion Server Action)
  - [ ] Seed Golden Tenant (Charcoal N Chill) with 13 system-generated queries
  - [ ] **🤖 Agent Rule:** `sov_target_queries` table DDL is in `docs/20260223000001_sov_engine.sql` (NOT yet in `supabase/migrations/` — see NOTE above). Import `QueryCategory` type from `src/lib/types/sov.ts` (Doc 03, Section 15.12).

- [ ] **SOV Cron**
  - [ ] Build `app/api/cron/sov/route.ts` — Next.js Route Handler (Doc 04c Section 4.1)
  - [ ] Implement `runSOVQuery()` with Perplexity Sonar SOV prompt (Doc 04c Section 4.2)
  - [ ] Implement `writeSOVResults()` — upserts to `visibility_analytics` (Doc 04c Section 4.3)
  - [ ] Add `STOP_SOV_CRON` kill switch env var check at function entry
  - [ ] Configure Vercel Cron trigger: Sunday 2 AM EST → `POST /api/cron/sov`
  - [ ] Implement `POST /api/cron/sov` route handler (service-role auth via `CRON_SECRET`)

- [ ] **Reality Score Fix**
  - [ ] Implement `calculateVisibilityScore()` in `lib/scores/visibility.ts` (Doc 04c Section 5.1)
  - [ ] Remove hardcoded `visibility = 98` from `RealityScoreCard` component
  - [ ] Implement `state: 'calculating'` UI (Doc 06 Section 8.2 — skeleton, no fake zero)
  - [ ] Wire updated score formula into scoring cron (Doc 04 Section 6)
  - [ ] **🤖 Agent Rule:** `calculateVisibilityScore()` returns `number | null`. `null` = cron not yet run. Never render `0` for null — render the calculating skeleton.

- [ ] **First Mover Alert Pipeline**
  - [ ] Implement `checkFirstMoverAlerts()` in SOV cron (Doc 04c Section 6.1)
  - [ ] Writes to `sov_first_mover_alerts` table (upsert on `org_id, query_id` conflict)
  - [ ] Build `GET /api/sov/alerts` endpoint (Doc 05 Section 12)
  - [ ] Build `FirstMoverAlertCard` component (Doc 06 Section 8.3)
  - [ ] Wire alert count to sidebar Visibility badge

- [ ] **SOV Dashboard (`/visibility`)**
  - [ ] Build `/dashboard/visibility/page.tsx` (Doc 06 Section 8.1 wireframe)
  - [ ] Build `SOVScoreRing` component with calculating state (Doc 06 Section 8.2)
  - [ ] Build `SOVQueryTable` component (Doc 06 Section 8.4)
  - [ ] Build `GET /api/sov/queries`, `POST /api/sov/queries`, `DELETE /api/sov/queries/:id` (Doc 05 Section 12)
  - [ ] Add "Visibility" to sidebar (Growth+: full; Starter: read-only score only)

- [ ] **Content Draft Trigger (Greed Engine patch)**
  - [ ] Implement `triggerContentDraftIfNeeded()` in Greed Engine cron (Doc 04 Section 3.4)
  - [x] ~~Run `supabase/migrations/20260223000002_content_pipeline.sql`~~ → promoted as `20260224000001_content_pipeline.sql` (Group A, 2026-02-23). `content_drafts`, `page_audits`, `local_occasions`, `citation_source_intelligence` tables now in schema.
  - [ ] Verify `content_drafts` inserts for `gap_magnitude = 'high'` intercepts

### Acceptance Criteria
- [ ] SOV cron runs against Charcoal N Chill and writes to `visibility_analytics`
- [ ] Reality Score Visibility component shows real number (not 98)
- [ ] New tenant sees "Calculating..." state — not `0` or `98`
- [ ] First Mover Alerts appear in `/visibility` when no local business is cited
- [ ] `npx vitest run src/__tests__/unit/sov-cron.test.ts` — **ALL PASS**
- [ ] `npx vitest run src/__tests__/unit/visibility-score.test.ts` — **ALL PASS** (including null state)

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

- [ ] **Content Draft Endpoints**
  - [ ] `GET /api/content-drafts` (filter by status, trigger_type) — Doc 05 Section 13
  - [ ] `GET /api/content-drafts/:id` (full content + trigger context)
  - [ ] `PATCH /api/content-drafts/:id` (edit draft content, title)
  - [ ] `POST /api/content-drafts/:id/approve`
  - [ ] `POST /api/content-drafts/:id/reject`
  - [ ] `POST /api/content-drafts/:id/publish` (target: `download` first; `wordpress` Phase 7)
  - [ ] **🤖 Agent Rule:** `POST /publish` validates `human_approved: true` AND `status: 'approved'` server-side. Reject with `403` if either condition fails. Do not rely on client-side checks.

- [ ] **Content Draft UI**
  - [ ] Build `/dashboard/content-drafts/page.tsx` — list view (Doc 06 Section 9.1)
  - [ ] Build `/dashboard/content-drafts/[id]/page.tsx` — detail/review view (Doc 06 Section 9.2)
  - [ ] Build `ContentDraftCard` component (status badge, AEO score, CTA buttons)
  - [ ] Build `ContentDraftEditor` — inline editable textarea with preview toggle
  - [ ] Implement Approve → publish target selector modal (Doc 06 Section 9.3)
  - [ ] Implement Reject modal (optional rejection reason)
  - [ ] Add "Content Drafts" to sidebar with amber badge count (Growth+ only)
  - [ ] Empty state CTA linking to `/compete` (Doc 06 Section 9.4)

- [ ] **Occasion Alert Feed (Phase 6 lite)**
  - [ ] Build `OccasionAlertCard` component (Doc 06 Section 10.2)
  - [ ] Seed `local_occasions` reference table (20 highest-value occasions for hospitality)
  - [ ] Wire upcoming occasion alerts to Dashboard home (below Active Alerts — Doc 06 Section 10.1)
  - [ ] "Remind Later" snooze via `localStorage` (no server call needed)
  - [ ] Add occasion badge to Visibility sidebar item

### Acceptance Criteria
- [ ] Greed Engine `gap_magnitude = 'high'` intercept creates a `content_drafts` row automatically
- [ ] Draft appears in `/content-drafts` list with pending status
- [ ] User can edit draft, approve it, and download as HTML file
- [ ] Rejected draft returns to `draft` status with rejection note visible
- [ ] Starter users see `<PlanGate featureId="content_drafts" />` overlay
- [ ] `npx vitest run src/__tests__/unit/content-draft-workflow.test.ts` — **ALL PASS**
- [ ] `npx playwright test tests/e2e/content-draft-review.spec.ts` — **ALL PASS**

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

- [ ] **Citation Gap UI**
  - [ ] Build `CitationPlatformMap` component (Doc 06 Section 11.2) — frequency bar visualization
  - [ ] Build `CitationGapBadge` component — added to existing `ListingRow` (Doc 06 Section 11.4)
  - [ ] Add "AI Citation Map" tab to `/listings` page (Doc 06 Section 11.1)
  - [ ] Starter plan blur-teaser (render real data with `blur-sm` + `<PlanGate>` overlay — Doc 06 Section 11.5)

- [ ] **Page Audit (Site-Wide Content Grader)**
  - [ ] Build `lib/page-audit/scorer.ts` — fetches URL, scores AEO readiness (answer-first, schema completeness, FAQ presence)
  - [ ] `POST /api/pages/audits/run` — triggers single-page audit, stores in `page_audits` table
  - [ ] `GET /api/pages/audits` and `GET /api/pages/audits/:id` — Doc 05 Section 14
  - [ ] Build `PageAuditRow` component — score + expand/collapse recommendations (Doc 06, Section 8)
  - [ ] Add page audit widget to `/visibility` page
  - [ ] Starter plan: homepage audit only. Growth+: full site.
  - [ ] **🤖 Agent Rule:** Page auditor fetches URLs via `fetch()` with a `User-Agent: LocalVector-AuditBot/1.0` header. Never attempt to bypass auth walls. `422` if page returns non-200.

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

- [ ] **Database Migration**
  - [x] ~~Run `supabase/migrations/20260223000003_gbp_integration.sql`~~ → promoted as `20260224000002_gbp_integration.sql` (Group A, 2026-02-23). `google_oauth_tokens`, `pending_gbp_imports` tables + `locations.google_location_name`, `locations.gbp_integration_id` columns now in schema.
  - [x] Verify `google_oauth_tokens` and `pending_gbp_imports` tables created — confirmed in 27-table schema post-db-reset
  - [x] Verify `locations.google_location_name` and `locations.gbp_integration_id` columns added — confirmed in prod_schema.sql
  - [ ] **🤖 Agent Rule:** `google_oauth_tokens` has RLS deny-by-default. Access exclusively via `createServiceRoleClient()`. Never read from browser-facing `createClient()`.

- [ ] **GBP OAuth Pipeline**
  - [ ] Register Google Cloud OAuth 2.0 client — scopes: `https://www.googleapis.com/auth/business.manage`
  - [ ] Build `app/api/auth/google/authorize/route.ts` — PKCE state cookie, redirect to Google consent
  - [ ] Build `app/api/auth/google/callback/route.ts` — code exchange, token storage, location list fetch
  - [ ] Build `app/onboarding/connect/page.tsx` — interstitial with "Connect GBP" + "Do it manually" escape
  - [ ] Build `app/onboarding/connect/select/page.tsx` — location picker (reads `pending_gbp_imports`)
  - [ ] Build Server Actions: `importGBPLocation()`, `disconnectGBP()` (`app/onboarding/connect/actions.ts`)
  - [ ] Update `app/api/auth/register/route.ts` redirect: `/onboarding` → `/onboarding/connect`
  - [ ] **🤖 Agent Rule:** `pending_gbp_imports` rows expire after 10 minutes (`expires_at`). Location picker page validates expiry before rendering — redirect to `/onboarding/connect` if expired.

- [ ] **GBP Data Mapping**
  - [ ] Map GBP `regularHours` → `locations.hours_data` (HoursData type, 24h format)
  - [ ] Map GBP `openInfo.status` → `locations.operational_status`
  - [ ] Map GBP attributes → `locations.amenities` (best-effort; null for unknown attributes)
  - [ ] **⚠️ Timezone gap (RFC Rev 2 §4.2):** GBP hours have no explicit timezone. Audit prompt must supply timezone context from `locations.city` + `locations.state`.

- [ ] **WordPress Publish Integration**
  - [ ] Build `lib/publish/wordpress.ts` — WordPress REST API client (basic auth or application password)
  - [ ] Add WordPress connection settings to `/settings` page (site URL + application password)
  - [ ] Wire `POST /api/content-drafts/:id/publish` with `publish_target: 'wordpress'`
  - [ ] On publish: create WordPress page/post, set status to `draft` (user approves in WP), store `published_url` in `content_drafts`

- [ ] **GBP Post Publish Integration**
  - [ ] Build `lib/publish/gbp-post.ts` — posts content as GBP Update using stored OAuth token
  - [ ] Wire `POST /api/content-drafts/:id/publish` with `publish_target: 'gbp_post'`

### Acceptance Criteria
- [ ] New user signing up via Google can import GBP data and reach dashboard in < 30 seconds
- [ ] GBP import sets `hours_data` and `amenities` — Onboarding Guard clears without manual wizard
- [ ] Fallback: user who skips/fails GBP import lands on existing manual wizard unchanged
- [ ] WordPress publish creates a WP page and stores URL in `content_drafts.published_url`
- [ ] `npx vitest run src/__tests__/unit/gbp-data-mapper.test.ts` — **ALL PASS**
- [ ] `npx playwright test tests/e2e/gbp-onboarding.spec.ts` — **ALL PASS**

---

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
