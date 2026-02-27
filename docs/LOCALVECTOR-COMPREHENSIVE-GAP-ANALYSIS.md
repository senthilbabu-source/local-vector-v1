# LocalVector V1 — Comprehensive Gap Analysis & Sprint Plan
### Date: February 28, 2026 | Post-Sprint 88

---

## Methodology

Cross-referenced **7 source documents** against **316 code files**, **29 migrations**, **150 tests**, and **27 dashboard pages**:

1. `docs/roadmap.md` — Product & Monetization Roadmap (20 features across 4 tiers)
2. `docs/09-BUILD-PLAN.md` — Phased Build Plan (Phases 0–8 + Sprints 59–66)
3. `docs/LocalVector-Master-Intelligence-Platform-Strategy.md` — Master Strategy (Sprints 68–85)
4. `docs/MULTI-USER_AGENCY_WHITE_LABEL.md` — Agency architecture spec
5. `docs/RFC_GBP_ONBOARDING_V2_REPLACEMENT.md` — GBP OAuth spec
6. `docs/19-AUTOPILOT-ENGINE.md` — Publish pipeline spec
7. `docs/CLAUDE.md` — Current implementation inventory

---

## SECTION A: COMPLETE INVENTORY (88 Features Tracked)

### ✅ FULLY IMPLEMENTED (100%) — 52 Features

| # | Feature | Source | Sprint |
|---|---------|--------|--------|
| 1 | Multi-tenant foundation (Supabase + RLS + orgs) | Phase 0 | 0 |
| 2 | Auth flow (email/password + Google OAuth) | Phase 0 | 0, 60B |
| 3 | Stripe billing (checkout + webhooks + portal) | Phase 0 | 0, 56B |
| 4 | Testing infrastructure (Vitest + Playwright + MSW) | Phase 0 | 0 |
| 5 | Fear Engine — hallucination detection (Perplexity + OpenAI + Gemini + Anthropic) | Phase 1, Tier 1 #1 | 1 |
| 6 | Cron job — scheduled audits (daily/weekly) | Phase 1 | 1 |
| 7 | Viral free tool (`/scan`) | Phase 1 | 1, 33, 34 |
| 8 | Risk Dashboard (private hallucination feed) | Phase 1 | 1 |
| 9 | Alert emails (Resend + React Email) | Phase 1 | 1 |
| 10 | Magic Menu — OCR pipeline (GPT-4o Vision) | Phase 2, Tier 1 #3 | 2, 59A |
| 11 | Magic Menu — review + publish interface | Phase 2 | 2 |
| 12 | Public edge layer (`/m/[slug]` with JSON-LD) | Phase 2 (LLM Honeypot) | 2 |
| 13 | Greed Engine — competitor intercept analysis | Phase 3 | 3 |
| 14 | Competitor CRUD + Google Places autocomplete | Phase 3 | 3 |
| 15 | Plan gating (`lib/plan-enforcer.ts`) | Phase 3 | 3 |
| 16 | Listings page (Big 6 directories) | Phase 4 | 27A |
| 17 | Settings page (org name, notifications, danger zone) | Phase 4 | 24B, 62E |
| 18 | Marketing site (homepage, pricing, privacy, terms) | Phase 4 | 25A–C |
| 19 | `llms.txt` + `ai-config.json` AEO endpoints | Phase 4 | 25C |
| 20 | SOV Engine — cron (Perplexity + OpenAI + Google + Copilot) | Phase 5, Tier 1 #4 | 61B, 74, 79 |
| 21 | SOV query seeding at onboarding | Phase 5 | sov-seed.ts |
| 22 | SOV Dashboard (`/share-of-voice`) | Phase 5 | SOV page |
| 23 | SOV query CRUD + on-demand eval | Phase 5 | actions.ts |
| 24 | Reality Score (live from visibility_analytics) | Phase 5 | dashboard |
| 25 | First Mover Alerts (via content_drafts) | Phase 5 | 48 |
| 26 | SOV `is_active` + UNIQUE constraint | Phase 5 cleanup | 88 |
| 27 | Content Draft Review UI (list + detail + HITL) | Phase 6 | 42, 48 |
| 28 | Content draft publish pipeline (download target) | Phase 6 | 48 |
| 29 | Occasion calendar UI | Phase 6 | 61A |
| 30 | Citation Gap Dashboard (`/citations`) | Phase 7 | 58A |
| 31 | Page Audit Dashboard (5 dimensions + recs) | Phase 7 | 58B, 71 |
| 32 | GBP OAuth connect/disconnect flow | Phase 8 | 57B |
| 33 | WordPress credential management | Phase 8 | 61C |
| 34 | AI Says Response Library (`/ai-responses`) | Strategy 4A | 69 |
| 35 | Schema Fix Generator (FAQ + Hours + LocalBusiness JSON-LD) | Strategy 3A | 70 |
| 36 | AI Health Score composite | Strategy 4B | 72 |
| 37 | Crawler Analytics (`/crawler-analytics`) | Strategy 4D | 73 |
| 38 | Google AI Overview monitoring (Gemini + search grounding) | Strategy Sprint 74 | 74 |
| 39 | Hallucination → Correction Content Generator | Strategy 3B | 75 |
| 40 | Before/After Proof Timeline (`/proof-timeline`) | Strategy 4E | 76 |
| 41 | Content Freshness Decay Alerts | Strategy (freshness) | 76 |
| 42 | Weekly AI Snapshot Email (Resend + Inngest) | Strategy 4F | 78 |
| 43 | Copilot/Bing monitoring (via GPT-4o simulation) | Strategy Sprint 79 | 79 |
| 44 | Entity Knowledge Graph Health (`/entity-health`) | Strategy 5B | 80 |
| 45 | AI Sentiment Tracker (`/sentiment`) | Strategy 5C | 81 |
| 46 | Citation Source Intelligence (`/source-intelligence`) | Strategy 5D | 82 |
| 47 | Proactive Content Calendar (`/content-calendar`) | Strategy 5E | 83 |
| 48 | Agent Readiness Score / AAO (`/agent-readiness`) | Strategy 5A | 84 |
| 49 | Revenue Impact Calculator (`/revenue-impact`) | Strategy Sprint 85 | 85 |
| 50 | SOV Gap → Content Brief Generator | Strategy 3C | 86 |
| 51 | AI Visibility Cluster Map (`/cluster-map`) | Strategy (new) | 87 |
| 52 | System Health / Cron Dashboard (`/system-health`) | Strategy | 76 |

---

### 🟡 PARTIALLY IMPLEMENTED — 16 Features

| # | Feature | Source | % Done | What's Built | What's Missing |
|---|---------|--------|--------|--------------|----------------|
| 53 | **GBP Data Import** | Phase 8, RFC | **30%** | OAuth connect/disconnect, token storage, callback route, RLS | Data mapping (regularHours → hours_data, openInfo → operational_status, attributes → amenities), timezone resolution, onboarding interstitial, import progress UI |
| 54 | **WordPress Publish** | Phase 8, Doc 19 | **70%** | Credential management (connect/test/disconnect), `publish-wordpress.ts` file exists, wired into `publishDraft()` action | Not verified end-to-end. Build plan checkboxes are unchecked. Need integration test with actual WP REST API call. |
| 55 | **GBP Post Publish** | Phase 8, Doc 19 | **70%** | `publish-gbp.ts` file exists, wired into `publishDraft()` action, GBP OAuth tokens stored | Not verified end-to-end. Needs real GBP API testing. Token refresh cron not built. |
| 56 | **Onboarding Wizard** | Phase 4, Doc 06 §7 | **50%** | Onboarding page + TruthCalibrationForm (hours + amenities), SOV seeding wired in | Step 1–5 flow not complete per doc spec. No auto-run first audit. No GBP import interstitial. No progress indicator. |
| 57 | **Multi-Location (Agency)** | Phase 4 | **40%** | LocationSwitcher dropdown, cookie-based selection, plan-gated "Add Location" | No add/edit location form. No location-scoped data isolation verification. No agency switching between orgs. |
| 58 | **Content Draft Sidebar Badge** | Phase 6 | **80%** | Sidebar link exists, draft list + detail working | Amber badge count on sidebar not implemented. Empty state CTA to `/compete` not built. |
| 59 | **Occasion Alert Feed** | Phase 6 | **50%** | `local_occasions` table seeded (32), OccasionTimeline in content-drafts, occasion scheduling in SOV cron | `OccasionAlertCard` on dashboard home not built. "Remind Later" snooze not built. Occasion badge on sidebar not built. |
| 60 | **Citation Intelligence Cron** | Phase 7 | **40%** | `citation_source_intelligence` table exists, Citation dashboard UI complete, `app/api/cron/citation/route.ts` exists | Cron route shell exists but hardcoded `TRACKED_CATEGORIES` and `TRACKED_METROS` instead of tenant-derived. Not running against real data for categories × metros. |
| 61 | **Dynamic LLM-Bait FAQs** | Roadmap #12 | **60%** | FAQ schema generator exists (`lib/schema-generator/faq-schema.ts`), generates from page audit data | Auto-injection into Honeypot page not built. Not auto-generating from menu/business data. Manual trigger only via page audit schema actions. |
| 62 | **Smart llms.txt** | Strategy 3F | **30%** | Static `llms.txt` route exists (Sprint 25C) | Not auto-generated from business data. Not auto-updated. Not hallucination-correcting. Static marketing copy only. |
| 63 | **Competitor Counter-Strategy** | Strategy 3D | **40%** | Greed Engine competitor intercepts exist with `suggested_action`. Content brief generator creates briefs from SOV gaps. | No dedicated counter-strategy generator. No "competitor content alert" when competitor engineers content for your queries. |
| 64 | **Citation Gap → Directory Optimization** | Strategy 3E | **50%** | Citation gap score + platform bar visualization. Entity health shows claiming guides per platform. | No automated "claim your listing" deep link workflow. No one-click claiming. Not integrated between citation dashboard and entity health. |
| 65 | **Phase 5 Build Plan Checkboxes** | Phase 5 | **95%** | All code built. Sprint 88 added UNIQUE + is_active. | `docs/09-BUILD-PLAN.md` Phase 5 checkboxes not yet updated (Sprint 88 should do this). |
| 66 | **Starter Plan Blur Teasers** | Phase 7 | **30%** | Plan gate exists on server actions (Growth+). Some pages show upgrade card. | `blur-sm` + `<PlanGate>` overlay pattern (show real data blurred) not consistently applied across citations, page-audits, content-drafts. |
| 67 | **Test Suite Green** | Launch Readiness | **70%** | 132 unit tests, 18 E2E specs. CI pipeline configured. | Some integration tests skip without live Supabase Docker. Full suite not verified green in CI. `auth-flow.test.ts`, `stripe-webhook.test.ts`, `rls-isolation.test.ts` need attention. |
| 68 | **Multi-Model Competitive Shadow Testing** | Roadmap Tier 2 #7 | **60%** | SOV engine runs 4 models (Perplexity, OpenAI, Google, Copilot). Competitor intercepts run head-to-head. | No dedicated "shadow test" simulating targeted prompts to see competitive positioning per engine. No side-by-side engine comparison view. |

---

### ❌ NOT IMPLEMENTED (0%) — 20 Features

| # | Feature | Source | Priority | Effort | Why It Matters |
|---|---------|--------|----------|--------|----------------|
| 69 | **Apple Business Connect Sync** | Roadmap Phase 8, Tier 1 #2 | 🔴 HIGH | L | Missing from "single source of truth" positioning. Siri recommendations depend on it. |
| 70 | **Bing Places Sync** | Roadmap Phase 8, Tier 1 #2 | 🔴 HIGH | M | Copilot/Bing coverage without data sync is monitoring-only. |
| 71 | **GBP Token Refresh Cron** | Phase 8 | 🔴 HIGH | S | OAuth tokens expire in 60 days. Without refresh cron, all GBP integrations silently break. |
| 72 | **Google Places Detail Refresh Cron** | Launch Readiness, Doc 10 §4 | 🔴 HIGH | S | Google ToS requires refreshing cached place data every 30 days. Legal compliance issue. |
| 73 | **CSV Export (Hallucination History)** | Phase 4 | 🟠 MED | S | Agency clients need exportable data. Basic SaaS table-stakes. |
| 74 | **PDF Audit Report (White-Label)** | Phase 4 | 🟠 MED | M | Agency tier justification. White-label branding for client reports. |
| 75 | **Multi-User Agency Workflows** | MULTI-USER doc | 🟠 MED | XL | Team invitations, seat billing, role permissions, ownership transfer. Blocks Agency tier sales. |
| 76 | **Business Info Editor (Settings)** | Phase 4 | 🟠 MED | M | Users can only edit hours/amenities during onboarding. No way to update ground truth post-onboarding without re-onboarding. |
| 77 | **Truth-Grounded RAG Chatbot Widget** | Roadmap #11 | 🟡 LOW | L | Embeddable customer-facing widget. High differentiation but needs ground truth completeness first. |
| 78 | **Entity-Optimized Review Responses** | Roadmap #13 | 🟡 LOW | M | AI-drafted replies to Google/Yelp reviews with entity keyword injection. |
| 79 | **E-E-A-T Signal Amplification** | Roadmap Tier 3 #13 | 🟡 LOW | M | Surfacing expertise/authority gaps. No code references. |
| 80 | **Original Data Amplification** | Roadmap Tier 3 #14 | 🟡 LOW | M | Publishing proprietary datasets for first-citation probability. |
| 81 | **Vertical Knowledge Graph Builder** | Roadmap Tier 3 #15 | 🟡 LOW | L | Industry-specific entity structuring. Entity health is a partial start. |
| 82 | **Voice/Conversational AI Optimization (VAIO)** | Roadmap Tier 3 #16 | 🟡 LOW | L | Zero-click voice query optimization (Siri, Alexa, Google Assistant). |
| 83 | **AI Answer Simulation Sandbox** | Roadmap Tier 3 #17 | 🟡 LOW | L | Pre-flight QA tool for staged content changes. |
| 84 | **llms.txt Optimization Clinic** | Roadmap Tier 3 #18 | 🟡 LOW | S | Automated validation + crawlability scoring for llms.txt. |
| 85 | **Predictive Citation Probability Engine** | Roadmap Tier 4 #20 | ⚪ FUTURE | XL | ML-trained prediction of citation gains. Requires training data. |
| 86 | **Conversational Intent Discovery** | Roadmap Tier 2 #11 | 🟡 LOW | M | Long-tail query mapping for content gaps. Prompt Intelligence is a partial start. |
| 87 | **Platform-Specific Optimization Playbooks** | Roadmap Tier 2 #8 | 🟡 LOW | M | Per-engine (SGE vs Perplexity vs ChatGPT) optimization recommendations. |
| 88 | **Competitive Prompt Hijacking Alerts** | Roadmap Tier 2 #10 | 🟡 LOW | M | Detecting when competitors engineer content to intercept your brand queries. |

---

## SECTION B: SCORE SUMMARY

| Category | Count | % of Total |
|----------|-------|-----------|
| ✅ Fully Implemented (100%) | 52 | 59% |
| 🟡 Partially Implemented | 16 | 18% |
| ❌ Not Implemented | 20 | 23% |
| **TOTAL TRACKED** | **88** | **100%** |

**Weighted completion (partial at face value):** ~71%

---

## SECTION C: PRIORITIZED SPRINT PLAN

### Tier 1: Launch Blockers (Sprints 89–92)

These must be done before going live with paying customers.

| Sprint | Feature | Fills Gap # | Effort | Rationale |
|--------|---------|-------------|--------|-----------|
| **89** | **GBP Data Mapping + Import Flow** | #53 | M | The GBP connect button exists but imports nothing. Map `regularHours` → `hours_data`, `openInfo.status` → `operational_status`, `attributes` → `amenities`. Build import progress UI. Add GBP interstitial to onboarding. This is the biggest friction-reducer for new user signup. |
| **90** | **GBP Token Refresh Cron + Google Places Refresh Cron** | #71, #72 | S | Two small crons: (1) refresh GBP OAuth tokens before 60-day expiry, (2) refresh Google Places cached details every 30 days for ToS compliance. Both are ticking legal/reliability time bombs. |
| **91** | **Onboarding Wizard Completion** | #56 | M | Wire GBP import (Sprint 89) into Step 1. Build Step 1–5 flow per Doc 06 §7. Auto-run first audit during onboarding so dashboard isn't empty on first visit. Add progress indicator. |
| **92** | **Launch Readiness Sweep** | #67 + Launch Checklist | M | Verify Charcoal N Chill fully onboarded with real data. Verify 5+ hallucinations detected. Verify Magic Menu crawled. Verify Stripe end-to-end. Verify email alerts. Verify Sentry configured. Get full test suite green in CI. Fix skipped integration tests. |

### Tier 2: Revenue-Critical (Sprints 93–97)

Features that directly drive upgrades, retention, and Agency tier sales.

| Sprint | Feature | Fills Gap # | Effort | Rationale |
|--------|---------|-------------|--------|-----------|
| **93** | **Business Info Editor (Post-Onboarding)** | #76 | M | Users need to update hours/amenities/categories without re-onboarding. This is the #1 support request for any local business SaaS. Add a "Business Info" tab in Settings with the same TruthCalibrationForm used in onboarding. |
| **94** | **Publish Pipeline Verification (WordPress + GBP Post)** | #54, #55 | S | Both publishers exist as code but have never been verified end-to-end. Write integration tests with mocked WP REST API and GBP API. Fix any gaps. This closes the detect → draft → publish loop. |
| **95** | **CSV Export + PDF Audit Report** | #73, #74 | M | Agency table-stakes. CSV export for hallucination history. PDF audit report with white-label branding (org name, logo placeholder). Use React-PDF or Puppeteer for PDF generation. |
| **96** | **Plan Gate Polish (Blur Teasers)** | #66 | S | Apply consistent `blur-sm` + `<PlanGate>` overlay pattern across citations, page-audits, content-drafts, sentiment, source-intelligence. Shows Starter users what they're missing → drives upgrades. |
| **97** | **Citation Cron + Dynamic llms.txt** | #60, #62 | M | Make citation cron tenant-derived (not hardcoded). Build dynamic `llms.txt` generated from business data (hours, menu, amenities, corrections) instead of static marketing copy. Auto-update on data change. |

### Tier 3: Agency & Scale (Sprints 98–101)

Features that unlock the Agency tier and multi-user workflows.

| Sprint | Feature | Fills Gap # | Effort | Rationale |
|--------|---------|-------------|--------|-----------|
| **98** | **Multi-User Foundation (Invitations + Roles)** | #75 (part 1) | L | `pending_invitations` table, email invite flow, join existing org, role assignment (Owner/Admin/Viewer). This is the single biggest blocker for Agency tier sales. |
| **99** | **Seat-Based Billing + Agency Permissions** | #75 (part 2) | L | Stripe seat quantity management, proration logic, downgrade lockouts. Granular per-location permissions for Agency users. |
| **100** | **Multi-Location Management** | #57 | M | Add/edit location form for Agency tier. Location-scoped data isolation verification. Agency user can manage 10 locations with separate dashboards. |
| **101** | **Occasion Alert Feed + Sidebar Badges** | #58, #59 | S | Wire occasion alerts to dashboard home. Add amber badge count to Content Drafts and Visibility sidebar items. "Remind Later" snooze. Small polish sprint that improves daily active engagement. |

### Tier 4: Sync & Distribution (Sprints 102–104)

Platform sync features that make LocalVector the "single source of truth."

| Sprint | Feature | Fills Gap # | Effort | Rationale |
|--------|---------|-------------|--------|-----------|
| **102** | **Apple Business Connect Sync** | #69 | L | Register for Apple Business Connect API. Map location data → Apple format. Build claim/sync flow in integrations page. Required for Siri recommendations. |
| **103** | **Bing Places Sync** | #70 | M | Register for Bing Places API. Map location data → Bing format. Build claim/sync flow. Completes the Big 3 search platform sync (Google + Apple + Bing). |
| **104** | **Dynamic FAQ Auto-Generation + Injection** | #61 | M | Auto-generate FAQ content from menu items, hours patterns, amenity data. Auto-inject FAQPage JSON-LD into Magic Menu public pages. Currently manual-only via page audit. |

### Tier 5: Differentiation (Sprints 105–109)

Premium features for competitive moat.

| Sprint | Feature | Fills Gap # | Effort | Rationale |
|--------|---------|-------------|--------|-----------|
| **105** | **Entity-Optimized Review Responses** | #78 | M | AI-drafted replies to Google/Yelp reviews with entity keywords. High perceived value for restaurant owners who hate writing review responses. |
| **106** | **Truth-Grounded RAG Chatbot Widget** | #77 | L | Embeddable widget connected to Magic Menu database. Zero-hallucination customer service. Major differentiation but only valuable once ground truth is comprehensive. |
| **107** | **Competitive Prompt Hijacking Alerts** | #88 | M | Detect when competitor content appears in AI responses for your brand queries. Source Intelligence is a partial start — needs dedicated alerting. |
| **108** | **Platform-Specific Playbooks** | #87 | M | Per-engine optimization recommendations (Google SGE weights structured data differently from Perplexity). Leverage existing multi-engine SOV data. |
| **109** | **Conversational Intent Discovery** | #86 | M | Map long-tail conversational prompts to content gaps. Extend Prompt Intelligence with AI-powered query expansion. |

### Tier 6: Horizon (Sprints 110+)

Enterprise future-proofing features. Build only after core is stable and revenue is flowing.

| Sprint | Feature | Fills Gap # | Effort |
|--------|---------|-------------|--------|
| 110 | Voice/Conversational AI Optimization (VAIO) | #82 | L |
| 111 | E-E-A-T Signal Amplification | #79 | M |
| 112 | AI Answer Simulation Sandbox | #83 | L |
| 113 | Original Data Amplification Module | #80 | M |
| 114 | llms.txt Optimization Clinic | #84 | S |
| 115 | Vertical Knowledge Graph Builder | #81 | L |
| 116 | Predictive Citation Probability Engine (ML) | #85 | XL |

---

## SECTION D: EFFORT KEY & TIMELINE ESTIMATES

| Code | Meaning | Solo-Dev Time |
|------|---------|---------------|
| S | Small | 2–4 hours |
| M | Medium | 4–8 hours |
| L | Large | 1–2 days |
| XL | Extra Large | 3–5 days |

**Tier 1 (Launch Blockers):** ~3 days → Target: Sprint 89–92
**Tier 2 (Revenue-Critical):** ~3 days → Target: Sprint 93–97
**Tier 3 (Agency & Scale):** ~4 days → Target: Sprint 98–101
**Tier 4 (Sync & Distribution):** ~3 days → Target: Sprint 102–104
**Tier 5 (Differentiation):** ~5 days → Target: Sprint 105–109
**Tier 6 (Horizon):** Ongoing → Sprint 110+

**Total to launch-ready (Tiers 1–2):** ~6 days of focused sprint work.

---

## SECTION E: TOP 5 CRITICAL ACTIONS (Do These First)

1. **GBP Data Mapping (Sprint 89)** — The GBP button connects but imports nothing. This is the single biggest new-user friction point.

2. **Token + Places Refresh Crons (Sprint 90)** — GBP tokens expire in 60 days, Google Places data must refresh every 30 days. Both are ticking time bombs that will silently break existing features.

3. **Onboarding Wizard (Sprint 91)** — First impressions matter. New users should reach a populated dashboard in < 60 seconds with GBP import or < 3 minutes with manual wizard.

4. **Launch Readiness Sweep (Sprint 92)** — Golden tenant verification, test suite green, Sentry configured, Stripe verified. The last mile before accepting paid subscriptions.

5. **Business Info Editor (Sprint 93)** — Without post-onboarding editing, users who get their hours wrong during onboarding are stuck with hallucinations they can't fix.
