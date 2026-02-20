# 09 — Phased Build Plan & Execution Roadmap

## 16-Week Execution Plan
### Version: 2.3 | Date: February 16, 2026

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

- [ ] **Supabase Setup**
  - [ ] Create Supabase project `localvector-prod`
  - [ ] Run Doc 03 SQL initialization script
  - [ ] **Schema Patch v2.1:** Verify `ai_hallucinations` and `magic_menus` tables include the `propagation_events` JSONB column (Doc 03).
  - [ ] Verify all tables, enums, indexes, RLS policies created
  - [ ] Verify `locations.place_details_refreshed_at` column exists (Google ToS compliance — see Doc 10, Section 4)
  - [ ] Seed Big 6 directories
  - [ ] Seed Golden Tenant (Charcoal N Chill)
    - **🤖 Agent Rule:** Seed data for `hours_data`, `amenities`, and `extracted_data` MUST use the Zod schemas defined in Doc 03, Section 9. Do NOT invent ad-hoc JSON shapes.
- [ ] **Next.js Scaffold**
  - [ ] `npx create-next-app@latest` with App Router + TypeScript + Tailwind
  - [ ] Install shadcn/ui components
  - [ ] Implement `middleware.ts` for subdomain routing (Doc 02, Section 3)
  - [ ] Implement `lib/auth.ts` (getAuthContext helper)
  - [ ] Implement `GET /api/v1/auth/context` route (Doc 05, Section 1.1) — used by Onboarding Guard
  - [ ] Create app shell: sidebar, top bar, layout
- [ ] **Auth Flow**
  - [ ] Configure Supabase Auth (Email/Password + Google OAuth)
  - [ ] Build `/signup`, `/login`, `/forgot-password` pages
  - [ ] Verify PostgreSQL trigger creates org + membership on signup
  - [ ] Test: New user signs up → org created → membership created → dashboard loads
- [ ] **Stripe Setup**
  - [ ] Create Stripe test products (Starter, Growth, Agency)
  - [ ] Implement checkout session creation (`POST /billing/checkout`)
  - [ ] Implement webhook handler (`POST /webhooks/stripe`)
  - [ ] Test: User upgrades → org plan updates → features unlock
- [ ] **Vercel Configuration**
  - [ ] Connect GitHub repo to Vercel
  - [ ] Add all environment variables (Doc 02, Section 7)
  - [ ] Configure custom domains: `app.localvector.ai`, `*.localvector.ai`
  - [ ] Verify SSL provisioning
- [ ] **Testing Infrastructure (Doc 11)**
  - [ ] Install Vitest, Playwright, MSW, Faker.js
  - [ ] Initialize Supabase CLI local dev (`npx supabase init`)
  - [ ] Verify `npx supabase start` runs migrations and seeds correctly
  - [ ] Create `.env.test` with local Supabase URLs (Doc 02, Section 7)
  - [ ] Create `__fixtures__/golden-tenant.ts` (Charcoal N Chill test data)
  - [ ] Create `__fixtures__/mock-perplexity-responses.ts`
  - [ ] Create `__helpers__/supabase-test-client.ts` (anon + service role)
  - [ ] Set up GitHub Actions CI pipeline (`.github/workflows/test.yml`)
  - [ ] Write and pass: `rls-isolation.test.ts` (Doc 11, Section 5.1)
  - [ ] Write and pass: `auth-flow.test.ts` (Doc 11, Section 5.2)
  - [ ] Write and pass: `stripe-webhook.test.ts` (Doc 11, Section 5.3)
- [ ] **Critical Logic: Idempotent Signup Strategy**
  - [ ] **Agent Rule:** The `handle_new_user` PostgreSQL trigger pre-creates the `organizations` and `memberships` records.
  - [ ] **Implementation:** Onboarding code MUST perform a `PATCH/UPDATE` on the existing organization record using the `org_id` from the auth session. Do NOT attempt to `INSERT` a new organization.
- [ ] **API Mocking Strategy**
  - [ ] Configure MSW (Mock Service Worker) to intercept all Perplexity and OpenAI calls.
  - [ ] Ensure `.env.test` contains dummy values (e.g., `sk-test-mock`) to prevent accidental API spend during agentic development.

### Acceptance Criteria
- [ ] New user can sign up, land on dashboard, see their org name
- [ ] If DB trigger is delayed, dashboard shows "Setting up your workspace..." and recovers within 10 seconds (Onboarding Guard — see Doc 06)
- [ ] RLS prevents User A from seeing User B's data
- [ ] Stripe checkout redirects and updates plan in database
- [ ] `menu.localvector.ai/test` returns 404 (not 500)
- [ ] `npx vitest run src/__tests__/integration/rls-isolation.test.ts` — **ALL PASS**
- [ ] `npx vitest run src/__tests__/integration/auth-flow.test.ts` — **ALL PASS**
- [ ] `npx vitest run src/__tests__/integration/stripe-webhook.test.ts` — **ALL PASS**
- [ ] GitHub Actions CI pipeline runs green on push to `main`

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

- [ ] **Intelligence Backend**
  - [ ] Build Perplexity Sonar API adapter (`lib/perplexity.ts`)
  - [ ] Build Ground Truth constructor from `locations` table
  - [ ] Implement Status Check prompt (Doc 04, Section 2.2A)
  - [ ] Implement Amenity Check prompt (Doc 04, Section 2.2C)
  - [ ] Implement Hours Check prompt (Doc 04, Section 2.2B)
  - [ ] **Truth Calibration Logic:** Ensure `Amenity Check` skips `null` values (unknowns) instead of flagging them (Doc 04 v2.1 update).
  - [ ] Build hallucination classification logic (Doc 04, Section 2.3)
  - [ ] Wire results to `ai_audits` and `ai_hallucinations` tables
- [ ] **Cron Job (Scheduled Audits)**
  - [ ] Create Supabase Edge Function `run-audits`
  - [ ] Configure Vercel Cron trigger (daily at 3 AM EST)
  - [ ] Implement plan-aware frequency (weekly for Starter, daily for Growth)
  - [ ] Implement usage metering (increment counter, enforce limit)
- [ ] **The Viral Free Tool (Public)**
  - [ ] Build `/check` page: Business Name + City input form
  - [ ] Backend: Google Places API lookup for Ground Truth (NOT the `locations` table — business is not a tenant. See Doc 05, Section 9)
  - [ ] Backend: Single Perplexity check
  - [ ] Frontend: Render Pass/Fail report card
  - [ ] Implement rate limiting: 1 per IP per day (Vercel KV)
  - [ ] CTA: "Fix this Alert" → redirect to signup
- [ ] **Risk Dashboard (Private)**
  - [ ] Build `GET /api/v1/hallucinations` endpoint
  - [ ] Build `POST /api/v1/hallucinations/:id/verify` endpoint
  - [ ] Build `PATCH /api/v1/hallucinations/:id/dismiss` endpoint
  - [ ] Build AlertFeed component (Doc 06, Section 3)
  - [ ] Build RealityScoreCard component
  - [ ] Build dashboard stats endpoint (`GET /api/v1/dashboard/stats`)
- [ ] **Alert Emails**
  - [ ] Integrate Resend API
  - [ ] Build "New Risk Detected" email template
  - [ ] Wire cron job to send email when new hallucinations found

### Acceptance Criteria
- [ ] A non-logged-in user can run a free check and see a real result in < 15 seconds
- [ ] A logged-in user sees their active hallucinations on the dashboard
- [ ] "Verify Fix" triggers a re-check and updates the status
- [ ] Cron runs successfully for Charcoal N Chill (Golden Tenant)
- [ ] Email alert arrives when a new hallucination is detected
- [ ] `npx vitest run src/__tests__/unit/hallucination-classifier.test.ts` — **ALL PASS**
- [ ] `npx vitest run src/__tests__/unit/reality-score.test.ts` — **ALL PASS**
- [ ] `npx vitest run src/__tests__/unit/plan-enforcer.test.ts` — **ALL PASS**
- [ ] `npx playwright test src/__tests__/e2e/free-hallucination-check.spec.ts` — **ALL PASS**

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

- [ ] **Menu Digitizer (OCR Pipeline)**
  - [ ] Build file uploader (PDF/Image → Supabase Storage)
  - [ ] Build OpenAI GPT-4o Vision integration
  - [ ] Implement Digitizer prompt (Doc 04, Section 4.2)
  - [ ] Store extracted JSON in `magic_menus.extracted_data`
  - [ ] Store individual items in `menu_items` table
- [ ] **Review Interface**
  - [ ] Build split-screen: original PDF preview ↔ extracted items
  - [ ] **🤖 Agent Rule:** Use a `useReducer` hook or `zustand` store for the menu state machine (`idle → uploading → processing → review_ready → editing → certifying → publishing → published`). Do NOT use multiple `useState` calls. See Doc 06.
  - [ ] Make prices/descriptions editable inline
  - [ ] Implement "I certify this is correct" checkbox
  - [ ] Build JSON-LD schema generator (Doc 04, Section 4.3)
  - [ ] **Link Injection Modal:** Build the "Copy & Inject" modal with Google Business Profile deep link (Doc 06 v2.1 update). Wire to `POST /track-injection`.
- [ ] **Public Edge Layer**
  - [ ] Configure `menu.localvector.ai` DNS in Vercel
  - [ ] Build `/menus/[slug]` page (SSR with edge caching)
  - [ ] Render clean HTML menu for humans
  - [ ] Inject JSON-LD `<script>` in `<head>` for AI
  - [ ] Set `rel="canonical"` to restaurant's main website
  - [ ] Configure `robots.txt` and bot-friendly headers
  - [ ] Implement Vercel Edge Cache (24h TTL, stale-while-revalidate)
- [ ] **Dashboard Integration**
  - [ ] Build Menu page with upload/review/publish states (Doc 06, Section 4)
  - [ ] Show public URL with copy button
  - [ ] Show page view counter and crawler stats

### Acceptance Criteria
- [ ] Upload a Charcoal N Chill PDF menu → AI extracts items with >90% accuracy
- [ ] User can edit a misread price, certify, and publish
- [ ] `menu.localvector.ai/charcoal-n-chill` renders with valid JSON-LD
- [ ] Page loads in < 200ms (edge cached)
- [ ] Google's Rich Results Test validates the schema
- [ ] `npx vitest run src/__tests__/unit/json-ld-generator.test.ts` — **ALL PASS**
- [ ] `npx vitest run src/__tests__/integration/magic-menu-pipeline.test.ts` — **ALL PASS**
- [ ] `npx vitest run src/__tests__/unit/llms-txt-generator.test.ts` — **ALL PASS**

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

- [ ] **Competitor Management**
  - [ ] Build competitor CRUD (add/edit/delete, max 3 for Growth)
  - [ ] Google Places autocomplete for competitor lookup
- [ ] **Intercept Logic**
  - [ ] Create `__fixtures__/mock-greed-analysis.ts` with sample GPT-4o-mini intercept response matching Doc 05, Section 5 response shape
  - [ ] Implement Head-to-Head prompt (Doc 04, Section 3.1)
  - [ ] Implement Intercept Analysis with GPT-4o-mini (Doc 04, Section 3.2)
  - [ ] Store results in `competitor_intercepts` table
  - [ ] Generate action tasks (Doc 04, Section 3.3)
- [ ] **Dashboard**
  - [ ] Build Compete page (Doc 06, Section 5)
  - [ ] Build InterceptCard and ActionTask components
  - [ ] Implement plan gating (Growth+ only)
  - [ ] Build "Upgrade to unlock" overlay for Starter users
- [ ] **Cron Integration**
  - [ ] Add competitor checks to daily audit cron (Growth plan only)

### Acceptance Criteria
- [ ] User can add 3 competitors and see intercept results within 24 hours
- [ ] Each intercept includes a specific, actionable task
- [ ] Starter users see a locked "Upgrade" overlay on the Compete page
- [ ] Growth users see competitor data; Starter users do not
- [ ] `npx vitest run src/__tests__/unit/plan-enforcer.test.ts` — **ALL PASS** (feature gating 100%)

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
