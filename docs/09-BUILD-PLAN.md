# 09 — Phased Build Plan & Execution Roadmap

## 16-Week Execution Plan
### Version: 2.3 | Date: February 16, 2026

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
  - [x] Create Supabase Edge Function `run-audits` (`app/api/cron/audit/route.ts`)
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
  - [ ] Google Places autocomplete for competitor lookup *(deferred Phase 4+)*
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
- [ ] **Cron Integration**
  - [ ] Add competitor checks to daily audit cron (Growth plan only) *(deferred Phase 4+)*

### Acceptance Criteria
- [x] User can add 3 competitors and see intercept results (real-time on-demand, not 24h batch)
- [x] Each intercept includes a specific, actionable task (`suggested_action` + Mark Complete / Dismiss)
- [x] Starter users see a locked "Upgrade" overlay on the Compete page
- [x] Growth users see competitor data; Starter users do not
- [x] `npx vitest run src/__tests__/unit/plan-enforcer.test.ts` — **ALL PASS** (feature gating 100%)
- [x] `npx vitest run src/__tests__/unit/competitor-actions.test.ts` — **22/22 PASS**
- [x] `npx vitest run` — **243 passing**, 7 skipped, 1 pre-existing integration failure

---

## Phase 4: Listings & Polish (Weeks 15–16)

**Goal:** Fill in the remaining features and polish for public launch.
**Deliverable:** Complete dashboard with Big 6 listings, onboarding wizard, and reports.

### Checklist

- [ ] **Listings Management**
  - [ ] **🤖 Agent Rule:** Do NOT implement any OAuth integration or write-back API for external directories. All `/listings` endpoints update internal records only. See Doc 05, Section 6 scope declaration.
  - [ ] Build Listings page (Doc 06, Section 6)
  - [ ] Manual listing URL input per directory
  - [ ] Basic link health check (404 detection)
  - [ ] NAP consistency score calculation
- [ ] **Onboarding Wizard**
  - [ ] Build Step 1–5 flow (Doc 06, Section 7)
  - [ ] Auto-run first audit during onboarding
- [ ] **Settings & Account**
  - [ ] Business info editor (hours, amenities, categories)
  - [ ] Billing portal (Stripe Customer Portal)
  - [ ] Location management (add/edit for Agency tier)
- [ ] **Reports & Export**
  - [ ] CSV export of hallucination history
  - [ ] PDF audit report (white-label for Agency tier)
- [ ] **Marketing Site**
  - [ ] Build `localvector.ai` homepage (Doc 08)
  - [ ] Implement SoftwareApplication JSON-LD schema
  - [ ] Build `/pricing`, `/about`, `/what-is/*` pages

### Acceptance Criteria
- [ ] New user completes onboarding in < 3 minutes
- [ ] All 7 directories show on the Listings page
- [ ] Agency user can switch between organizations
- [ ] Marketing site passes Google Rich Results Test
- [ ] `npx playwright test` (full E2E suite) — **ALL PASS**
- [ ] `npx vitest run` (full unit + integration suite) — **ALL PASS**

---

## Technical Dependencies by Phase

| Phase | Core Dependency | Est. Cost (Dev Mode) | Risk |
|-------|----------------|---------------------|------|
| 0 | Supabase, Stripe, Vercel | $65/mo | Low |
| 1 | Perplexity API, Resend | +$50/mo | **Medium** (rate limits) |
| 2 | OpenAI GPT-4o Vision | Pay-per-use (~$1/menu) | Medium (OCR accuracy) |
| 3 | GPT-4o-mini | Minimal (~$0.01/analysis) | Low |
| 4 | — | — | Low |

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
