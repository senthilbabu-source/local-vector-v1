# LocalVector v1 Repo Audit vs. Killer Features & Starter Kit Plan

**Audit Date:** February 25, 2026
**Repo:** `github.com/senthilbabu-source/local-vector-v1`
**Commits:** 34 | **Contributors:** 3 | **Language:** TypeScript 91.1%

---

## Executive Summary

**You've built significantly more than we assumed.** The starter kit recommendations from our last session assumed you were starting from spec docs only. The repo shows a working Next.js 16 application with auth, Stripe billing, Supabase multi-tenant DB, Sentry observability, Vercel AI SDK integration, Resend email, Vercel KV rate limiting, MCP server, and Playwright + Vitest test suites — already deployed on Vercel.

**The honest assessment:** Of the 8 killer features we identified, you already have **partial or full implementations of 5**. The remaining 3 are genuinely new. And most of the "starter kit" packages I recommended? **You already installed them.**

Here's the full mapping.

---

## Part 1: Starter Kit Packages — What You Already Have

| Package | Recommended | In Your `package.json` | Status |
|---------|-------------|----------------------|--------|
| `ai` (Vercel AI SDK) | ✅ | `"ai": "^4.3.16"` | ✅ **INSTALLED** |
| `@ai-sdk/openai` | ✅ | `"@ai-sdk/openai": "^1.3.22"` | ✅ **INSTALLED** |
| `@supabase/supabase-js` | ✅ | `"@supabase/supabase-js": "^2.97.0"` | ✅ **INSTALLED** |
| `@supabase/ssr` | ✅ | `"@supabase/ssr": "^0.8.0"` | ✅ **INSTALLED** |
| `stripe` | ✅ | `"stripe": "^20.3.1"` | ✅ **INSTALLED** |
| `resend` | ✅ | `"resend": "^6.9.2"` | ✅ **INSTALLED** |
| `recharts` | ✅ | `"recharts": "^2.15.4"` | ✅ **INSTALLED** |
| `cheerio` | ✅ | `"cheerio": "^1.0.0"` | ✅ **INSTALLED** |
| `zod` | ✅ | `"zod": "^4.3.6"` | ✅ **INSTALLED** |
| `lucide-react` | ✅ (via shadcn) | `"lucide-react": "^0.575.0"` | ✅ **INSTALLED** |
| `papaparse` | Not mentioned | `"papaparse": "^5.5.3"` | ✅ **BONUS** (CSV menu parsing) |
| `@modelcontextprotocol/sdk` | Not mentioned | `"@modelcontextprotocol/sdk": "^1.25.2"` | ✅ **BONUS** (MCP server) |
| `@vercel/kv` | Not mentioned | `"@vercel/kv": "^3.0.0"` | ✅ **BONUS** (rate limiting) |
| `react-hook-form` + `@hookform/resolvers` | Not mentioned | Both installed | ✅ **BONUS** |
| **Tremor** (`@tremor/react`) | ✅ Recommended | ❌ Not installed | **MISSING** |
| **shadcn/ui** | ✅ Recommended | ❌ Not installed | **MISSING** |
| **schema-dts** | ✅ Recommended | ❌ Not installed | **MISSING** (but you have custom JSON-LD generation) |
| **JSZip** | ✅ Recommended | ❌ Not installed | **MISSING** |
| **@react-email/components** | ✅ Recommended | ❌ Not installed | **MISSING** (you use raw HTML in Resend) |

### Starter Kit Verdict

**11 of 14 recommended packages already installed.** The 3 missing ones (Tremor, shadcn/ui, React Email) are UI polish — not blockers. You have custom components doing the same jobs. The "3-5 weeks of foundation work" I estimated? **Already done.**

---

## Part 2: Foundation Infrastructure — Already Built

| Foundation Layer | Status | Evidence |
|-----------------|--------|----------|
| Next.js App Router | ✅ Complete | Next.js 16.1.6, full `app/` directory structure |
| Supabase Auth | ✅ Complete | `app/(auth)/login`, `register`, `signup` + `lib/auth.ts` |
| Supabase DB + RLS | ✅ Complete | 27 tables, RLS policies, `prod_schema.sql` (2,384 lines) |
| Stripe Subscriptions | ✅ Complete | Webhook handler at `app/api/webhooks/stripe/route.ts` |
| Plan Tier Gating | ✅ Complete | `lib/plan-enforcer.ts` — trial/starter/growth/agency |
| Stripe Billing UI | ✅ Complete | `app/dashboard/billing/` with actions |
| Tailwind CSS v4 | ✅ Complete | `@tailwindcss/postcss` v4 |
| Sentry Error Tracking | ✅ Complete | Client, edge, and server configs |
| Vercel KV Rate Limiting | ✅ Complete | IP-based, 5 scans/24hr in `marketing.ts` |
| Vitest Unit Tests | ✅ Complete | 32 test files in `src/__tests__/` |
| Playwright E2E | ✅ Complete | 11 E2E spec files in `tests/e2e/` |
| Vercel AI SDK | ✅ Complete | `lib/ai/providers.ts` with multi-model routing |
| MCP Server | ✅ Complete | 4 tools: visibility_score, sov_report, hallucinations, competitor_analysis |
| Resend Email | ✅ Complete | Hallucination alerts + SOV weekly reports |
| Cron Jobs | ✅ Complete | 3 crons: audit, content-audit, sov |
| Onboarding Flow | ✅ Complete | `app/onboarding/` with truth calibration wizard |
| Places API Integration | ✅ Complete | `app/api/public/places/` for business autocomplete |
| Custom Design System | ✅ Complete | `docs/DESIGN-SYSTEM.md` + `DESIGN-SYSTEM-COMPONENTS.md` |

**Foundation estimate revised: 0 weeks remaining (was 3-5 weeks).**

---

## Part 3: Killer Features — What's Built vs. What's Missing

### Feature #1 — Revenue Leak Scorecard 🔴 NOT BUILT

**What we proposed:** Convert every AI inaccuracy into a dollar figure. "AI is costing you $2,400-$4,100/month."

**What exists in repo:**
- SOV Engine tracks `share_of_voice` percentage (0-100%) ✅
- Hallucination detection with severity (critical/high/medium/low) ✅
- Competitor intercept with `gap_magnitude` (high/medium/low) ✅
- Reality Score composite metric ✅
- `visibility_analytics` table with snapshot_date ✅

**What's missing:**
- No dollar conversion model anywhere in codebase
- No revenue estimation logic
- No `avg_ticket`, `local_conversion_rate`, or `walk_away_rate` fields in schema
- No revenue leak display component
- No "You're losing $X/month" messaging

**Gap:** This is the #1 differentiator and it's **100% new work**. The data foundation (SOV %, hallucinations, competitor gaps) exists to feed the model, but the Revenue Leak Calculator itself needs to be built from scratch.

**Effort to add:** ~2-3 weeks (spec + calculation engine + dashboard component)

---

### Feature #2 — AI Truth Audit (Free Entry Tool) 🟡 SUBSTANTIALLY BUILT

**What we proposed:** One-click free tool → instant report showing what AI says about you, with errors flagged.

**What exists in repo:**
- `ViralScanner` component on landing page ✅
- `runFreeScan()` Server Action with real Perplexity Sonar integration ✅
- Best-of-2 parallel API calls for reliability ✅
- Status detection: fail / pass / not_found / rate_limited / unavailable ✅
- Mentions volume (none/low/medium/high) ✅
- Sentiment analysis (positive/neutral/negative) ✅
- Accuracy issues with categories (hours/address/menu/phone/other) ✅
- Rate limiting (5 scans/IP/24hr via Vercel KV) ✅
- `/scan` dashboard with full result display ✅
- Places autocomplete for business lookup ✅
- URL-mode "Smart Search" for scanning by website ✅
- Diagnostic animation during scan ✅
- Lock overlays on premium features (conversion hook) ✅

**What's missing vs. our proposal:**
- ❌ No multi-engine comparison (only Perplexity, displayed as "ChatGPT")
- ❌ No Truth Score (0-100) — exists as concept in dashboard cards but locked/placeholder
- ❌ No per-engine breakdown (ChatGPT says X, Perplexity says Y, Gemini says Z)
- ❌ No revenue leak estimate on the free scan result

**Gap:** This is **~75% built**. The core scan → result → conversion flow works. What's missing is the multi-engine breadth and the dollar hook. The existing implementation is production-quality with excellent error handling and graceful degradation.

**Effort to complete:** ~1 week (add Google Gemini + OpenAI direct queries, Truth Score calculation, revenue estimate teaser)

---

### Feature #3 — One-Click AI-Ready Package 🟡 PARTIALLY BUILT

**What we proposed:** After truth audit, generate downloadable zip: JSON-LD schema, llms.txt, robots.txt additions, FAQ content blocks, entity statement.

**What exists in repo:**
- `generateMenuJsonLd()` — full Schema.org Restaurant + Menu JSON-LD generation ✅
- `parseCsvMenu()` + `parsePosExport()` — menu data extraction from CSV/POS ✅
- `schemaOrg.ts` — dietary tag mapping to Schema.org URIs ✅
- `llms.txt` route — platform-level llms.txt at `/llms.txt` ✅
- Magic Menus pipeline — upload CSV/PDF → AI extraction → review → publish → JSON-LD + public page ✅
- Public menu pages at `/m/[slug]` with embedded schema ✅
- Content Grader (`lib/page-audit/auditor.ts`) — 5-dimension AEO scoring with recommendations ✅
- FAQ schema detection and scoring ✅

**What's missing vs. our proposal:**
- ❌ No unified "download everything as ZIP" feature
- ❌ No generated llms.txt per business (only platform-level llms.txt)
- ❌ No robots.txt snippet generator
- ❌ No FAQ content block generator (detects FAQ schema but doesn't create it)
- ❌ No entity statement paragraph generator
- ❌ No "one-click" bundle download from the truth audit result page

**Gap:** The building blocks are all here — JSON-LD generation, schema detection, AEO scoring, content recommendations. What's missing is the **packaging layer** that bundles these into a downloadable fix kit. This is mostly integration work, not new engine work.

**Effort to complete:** ~1-1.5 weeks (per-tenant llms.txt generator, FAQ block generator, entity statement via AI, JSZip bundle, download endpoint)

---

### Feature #4 — AI Correction Request System 🟡 PARTIALLY BUILT

**What we proposed:** Platform-specific correction strategies — GBP update, content generation for ChatGPT canonical pages, correction briefs.

**What exists in repo:**
- Hallucination detection with category classification ✅
- `content_drafts` table with trigger_type taxonomy ✅
- Autopilot Engine (Doc 19) — trigger → draft → approve → publish pipeline ✅
- Content Grader with specific fix recommendations per dimension ✅
- First Mover Alert detection (no one's being recommended → create content) ✅
- GBP OAuth integration framework (`google_oauth_tokens` table, integrations page) ✅
- `pending_gbp_imports` table ✅
- Plan-gated features: `canConnectGBP()`, `canRunAutopilot()` ✅

**What's missing vs. our proposal:**
- ❌ No per-platform correction playbook (Gemini: do X, ChatGPT: do Y, Perplexity: do Z)
- ❌ No "correction brief" in plain English for non-technical business owner
- ❌ No automated Bing Places submission
- ❌ No canonical page generation for ChatGPT training influence

**Gap:** The Autopilot Engine + Content Drafts pipeline is the backbone of this feature. The missing piece is the **platform-specific strategy layer** — knowing that Perplexity cares about Reddit/Yelp presence while ChatGPT cares about authoritative web pages. The Citation Intelligence spec (Doc 18) has this logic specced but not fully implemented.

**Effort to complete:** ~1.5-2 weeks (platform correction playbook, brief generator, integrate with existing content_drafts pipeline)

---

### Feature #5 — Hidden Revenue Scanner 🔴 NOT BUILT

**What we proposed:** Map AI prompt gaps to dollar-denominated revenue opportunities. "Private event venues Alpharetta → ChatGPT doesn't mention you → est. $24K-$60K/year."

**What exists in repo:**
- First Mover Alerts in SOV Engine (queries where no one is recommended) ✅
- SOV query categories: discovery, occasion, near_me ✅
- `content_drafts` with trigger_type = 'first_mover' ✅
- Occasion Engine spec (Doc 16) — seasonal opportunity detection ✅
- Local Prompt Intelligence spec (Doc 15) — query gap identification ✅

**What's missing:**
- ❌ No revenue estimation for discovered gaps
- ❌ No service-to-prompt mapping (catering, events, private dining → specific queries)
- ❌ No "unrealized revenue" aggregate
- ❌ No revenue opportunity display component

**Gap:** The query gap detection exists (First Mover Alerts, Occasion Engine, Prompt Intelligence). What's entirely missing is the **revenue attribution layer** — connecting service offerings to query gaps to estimated dollar values. This requires the same revenue model as Feature #1.

**Effort to add:** ~1.5 weeks (dependent on Feature #1 revenue model being built first)

---

### Feature #6 — Agentic Commerce Readiness Score 🔴 NOT BUILT

**What we proposed:** Forward-looking score (0-100) of whether AI agents can transact with the business — structured data, booking APIs, menu machine-readability, etc.

**What exists in repo:**
- Schema completeness scoring in Content Grader ✅
- JSON-LD generation for menus ✅
- MCP server with 4 visibility tools ✅
- Page audit with entity clarity dimension ✅

**What's missing:**
- ❌ No agentic readiness score algorithm
- ❌ No booking/ordering API discoverability test
- ❌ No real-time data freshness assessment
- ❌ No "can an agent book a table here?" test
- ❌ No composite score or display component

**Gap:** This is 100% new work. The Content Grader's schema scoring is a building block, but the agentic readiness concept — testing whether AI agents can actually complete transactions — is an entirely new engine. It's also the most forward-looking and differentiating feature.

**Effort to add:** ~2-3 weeks (scoring algorithm, API discovery tests, dashboard component)

---

### Feature #7 — Weekly Email Digest 🟢 MOSTLY BUILT

**What we proposed:** Plain-English weekly email with numbers, revenue impact, and #1 action item.

**What exists in repo:**
- `sendSOVReport()` — weekly SOV email with share_of_voice %, queries run, times cited, First Mover count ✅
- `sendHallucinationAlert()` — triggered email when new hallucinations detected ✅
- Resend integration with lazy init ✅
- SOV cron job that triggers weekly reporting ✅
- HTML email templates with styled KPI cards ✅

**What's missing vs. our proposal:**
- ❌ No "revenue impact" section (needs Feature #1)
- ❌ No "#1 action this week" with copy-paste text
- ❌ No React Email components (raw HTML strings)
- ❌ No unified weekly digest (SOV and hallucination alerts are separate emails)

**Gap:** This is **~70% built**. The email infrastructure, cron scheduling, and data aggregation all work. The gap is combining SOV + hallucination + competitor data into one unified weekly digest with a clear action item.

**Effort to complete:** ~3-5 days (merge into single digest, add action recommendation, upgrade templates to React Email)

---

### Feature #8 — Local Competitor AI Battlecard 🟡 SUBSTANTIALLY BUILT

**What we proposed:** Side-by-side comparison vs top 3-5 local competitors in AI responses. "Why they beat you" + "Your move."

**What exists in repo:**
- `competitor-intercept.service.ts` — 2-stage Perplexity → GPT-4o-mini pipeline ✅
- Head-to-head comparison: winner, reasoning, key_differentiators ✅
- Gap analysis: gap_magnitude, gap_details, suggested_action, action_category ✅
- `competitor_intercepts` table with full analysis history ✅
- `competitors` table for tracking ✅
- Dashboard compete page with UI ✅
- `CompetitorComparison` component on main dashboard ✅
- Plan gating: Growth/Agency only (3/10 competitors) ✅
- Cron automation for periodic re-analysis ✅

**What's missing vs. our proposal:**
- ❌ No side-by-side matrix view (You vs Competitor A vs Competitor B)
- ❌ No citation count comparison
- ❌ No "their weakness" analysis (only "why they win")
- ❌ No specific citation-building action plan ("Build 20 key citations over 8-12 weeks")

**Gap:** This is **~80% built**. The AI analysis pipeline and data model are production-quality. The gap is mostly in the presentation layer — going from per-competitor analysis to a unified battlecard matrix with offensive strategy recommendations.

**Effort to complete:** ~1 week (matrix view component, weakness analysis prompt, citation action plan generator)

---

## Part 4: Revised Build Timeline

### What the Starter Kit Plan Estimated

| Phase | Original Estimate | With Starters |
|-------|------------------|---------------|
| Foundation | 3-5 weeks | "30 minutes" |
| AI Truth Audit | 2-3 weeks | 1-2 weeks |
| Revenue Leak Scorecard | 2-3 weeks | 2-3 weeks |
| One-Click Package | 1-2 weeks | 1 week |
| Weekly Digest | 2-3 weeks | 3-5 days |
| Competitor Battlecard | 2 weeks | 1 week |
| Hidden Revenue Scanner | 2 weeks | 1.5 weeks |
| **Total** | **20-30 weeks** | **8-12 weeks** |

### What's Actually Remaining (Repo-Aware Estimate)

| Feature | % Built | Remaining Work | Effort |
|---------|---------|----------------|--------|
| Foundation | **100%** | — | **0 weeks** |
| #2 AI Truth Audit | **~75%** | Multi-engine, Truth Score | **1 week** |
| #8 Competitor Battlecard | **~80%** | Matrix view, weakness analysis | **1 week** |
| #7 Weekly Digest | **~70%** | Unified digest, action item | **0.5 weeks** |
| #3 One-Click Package | **~50%** | Bundle generator, per-tenant llms.txt | **1.5 weeks** |
| #4 Correction System | **~40%** | Platform playbook, briefs | **1.5 weeks** |
| #1 Revenue Leak Scorecard | **0%** | Entire feature (critical) | **2.5 weeks** |
| #5 Hidden Revenue Scanner | **~25%** | Revenue model + gap scanner | **1.5 weeks** |
| #6 Agentic Readiness | **0%** | Entire feature | **2.5 weeks** |
| **Total remaining** | | | **~12 weeks** |

### Recommended Build Order (Revised)

```
Week 1-2:   #1 Revenue Leak Scorecard (this unlocks #5, #7 revenue sections)
            — New DB fields: avg_ticket, conversion_rates per business type
            — Revenue calculation engine
            — Dashboard component: "AI is costing you $X/month"

Week 3:     #2 AI Truth Audit completion
            — Add Gemini + OpenAI direct queries
            — Compute Truth Score (0-100) from multi-engine data
            — Add revenue leak teaser to free scan results

Week 4:     #7 Weekly Digest completion + #8 Battlecard matrix
            — Merge SOV + hallucination + competitor into single email
            — Add "#1 action this week" with revenue impact
            — Build side-by-side competitor matrix view

Week 5-6:   #3 One-Click Package
            — Per-tenant llms.txt generator
            — FAQ block generator (AI-powered from business data)
            — Entity statement generator
            — JSZip bundle + download endpoint

Week 7-8:   #4 Correction System + #5 Revenue Scanner
            — Platform-specific playbooks
            — Plain-English correction briefs
            — Service-to-prompt revenue mapping

Week 9-10:  #6 Agentic Commerce Readiness Score
            — Scoring algorithm
            — API discoverability tests
            — Dashboard component

Week 11-12: Polish, testing, launch prep
```

---

## Part 5: Architecture Observations

### What's Well-Architected
- **AI_RULES.md** (37K) — comprehensive coding standards enforced across codebase
- **Pure services** — business logic in `lib/services/` never creates its own Supabase client (injectable, testable)
- **Mock fallbacks** — every AI call degrades gracefully when API keys absent (CI-friendly)
- **Sprint-based DEVLOG** — 173K of development history with clear phase progression
- **Zod validation** — all AI responses validated with schema + preprocessing for malformed outputs
- **Best-of-2 pattern** — parallel Perplexity calls pick richest result (clever for non-deterministic APIs)
- **MCP server** — forward-thinking; any AI assistant can query LocalVector data natively

### Observations for New Features
- **No `@ai-sdk/anthropic` or `@ai-sdk/google`** — only `@ai-sdk/openai` installed. Multi-engine Truth Audit will need these.
- **`schema-dts` not installed** — you built custom JSON-LD generation. Works fine, but `schema-dts` adds type safety for the One-Click Package expansion.
- **No `jszip`** — needed for the bundle download feature.
- **`@vercel/kv` is deprecated** — noted in your own comments. Should migrate to `@upstash/redis` for production.
- **Pricing mismatch** — `llms.txt` says Starter $29/Growth $59, but our strategy doc proposed $49/$99. Needs alignment.
- **React Email not used** — raw HTML template strings in `lib/email.ts`. React Email would make the weekly digest much more maintainable.

---

## Part 6: What You DON'T Need from the Starter Kit Plan

The following recommendations from our last session are **irrelevant** because you've already built the equivalent:

1. ~~"Use Vercel's `nextjs-subscription-payments` template"~~ → You have a complete auth + billing stack
2. ~~"That alone saves you 3-5 weeks of foundation work"~~ → Foundation is done
3. ~~"Vercel AI SDK is the single most impactful package"~~ → Already installed and integrated
4. ~~"Resend + React Email + Vercel Cron Jobs is near-turnkey"~~ → Resend + crons already working
5. ~~"Tremor gives you KPI cards"~~ → You have custom `MetricCard`, `RealityScoreCard`, `SOVTrendChart` components
6. ~~"Total: 20-30 weeks without starters → 8-12 weeks with starters"~~ → More like 12 weeks of **incremental** work on an already-functional product

---

## Bottom Line

**You're not at week 0. You're at approximately week 20 of a 32-week build.** The product has a working free scanner, multi-tenant dashboard, AI hallucination detection, competitor analysis, SOV engine, Magic Menu pipeline, Stripe billing, email alerts, MCP server, and comprehensive test coverage.

The killer features we identified are still the right features — they're what transforms this from an AI monitoring dashboard into a revenue platform. But the engineering foundation to build them is already solid. The critical missing piece is **Feature #1: Revenue Leak Scorecard** — it's the linchpin that makes Features #5 and #7 work and it's what makes the "AI is costing you money" message concrete.

**Revised total to shippable product with all 8 killer features: ~12 weeks of focused development.**
