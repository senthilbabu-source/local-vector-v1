# LocalVector.ai — Gold Standard Documentation Suite

## The AI Reality Engine for Local Business Visibility
### Version: 2.8 | Date: February 24, 2026

---

## Purpose of This Suite

This documentation suite is the **single source of truth** for LocalVector.ai. It serves two audiences:

1. **The Build Team** — Every document is written to be handed directly to a coding agent (Claude Code, Cursor, Copilot). Schemas are copy-pasteable SQL. Logic is described in TypeScript interfaces. Prompts are production-ready.
2. **The Customer** — Documents 01, 06, and 08 can be adapted for sales collateral, pitch decks, and onboarding guides.

---

## Document Index

| Doc | Title | Audience | Purpose |
|-----|-------|----------|---------|
| **01** | Market Positioning & Strategy | Founder, Sales, Investors | Why this exists. The Fear/Greed/Magic framework. Competitive moat. |
| **02** | Multi-Tenant Architecture | Engineering | Infrastructure blueprint. Supabase RLS, Next.js middleware, subdomain routing. |
| **03** | Database Schema & Migrations | Engineering | Complete SQL DDL. Every table, enum, index, RLS policy. Copy-paste into Supabase. |
| **04** | Intelligence Engine Specification | Engineering, AI/ML | Prompt engineering for Fear, Greed, and Magic engines. Ground Truth logic. |
| **04b** | Magic Menu: Bulk Upload & Web Audit | Engineering | Hybrid CSV upload (LocalVector AEO template + GPT-4o POS mapper), Schema.org RestrictedDiet JSON-LD generation, IndexNow active pinging, and post-publish Perplexity Sonar price-hallucination audits. |
| **04c** | SOV Engine Specification | Engineering | Share-of-Answer query library, weekly cron, Reality Score Visibility fix (replaces hardcoded 98), First Mover Alert pipeline. Companion to Doc 04. |
| **05** | API Contract & Route Specification | Engineering (Frontend ↔ Backend) | Every endpoint, request/response shape, auth flow, rate limiting. |
| **06** | Frontend & UX Specification | Engineering, Design | Dashboard layout, component hierarchy, user flows, UI states. |
| **07** | Go-to-Market & Growth Playbook | Founder, Marketing | Viral wedge strategy, pricing tiers, acquisition channels, agency sales. |
| **08** | Landing Page & AEO Content Strategy | Marketing, Engineering | Copy, JSON-LD schema for the marketing site, "Glass Box" architecture. |
| **09** | Phased Build Plan & Execution Roadmap | Engineering, Project Management | 16-week sprint plan with acceptance criteria per phase. |
| **10** | Operational Playbook & Risk Register | Founder, Engineering | Cost controls, churn prevention, API budget management, known risks. |
| **11** | Testing & Quality Strategy | Engineering | Test infrastructure, unit/integration/E2E test specs, CI/CD pipeline, agentic TDD workflow. |
| **13** | V1 Core Loop: Five-Stage User Journey | Engineering, Product | End-to-end flow a restaurant owner experiences from first contact to AI-corrected visibility. Each stage maps to exactly one product phase. |
| **14** | Testing Strategy (Live) | Engineering | Live test suite inventory — suite-by-suite breakdown, test counts, MSW mock map, Playwright E2E specs. Updated after each phase. **Supersedes the static counts in Doc 11.** |
| **15** | Local Prompt Intelligence | Engineering | Local AI prompt taxonomy, gap detection algorithm, weekly prompt gap alerts, custom query management UI. |
| **16** | Occasion Engine | Engineering | 30+ hospitality occasion taxonomy, seasonal trigger scheduler, occasion→content pipeline. |
| **17** | Content Grader | Engineering | Site-wide AEO scoring (homepage, about, FAQ, events), FAQ auto-generator, answer-first rewriter, inline fix delivery. |
| **18** | Citation Intelligence | Engineering | Citation source mapping methodology, platform gap scoring, review automation, Reddit/Nextdoor monitor. |
| **19** | Autopilot Engine | Engineering | Full closed-loop content pipeline: trigger taxonomy, draft generation, approval workflow, WordPress/GBP publish integration, citation measurement post-publish. |

---

## How to Use This Suite

### For Phase 0 Build (Start Here)
1. Read **01** for strategic context (know *why* you're building what).
2. Open **03** and run the SQL initialization script in Supabase.
3. Follow **09** Phase 0 checklist line by line.
4. Reference **02** for middleware and auth patterns as you scaffold.

### For Coding Agents
Each document is structured to be pasted as context into a coding agent session:
- **03** → "Here is the database schema. **CRITICAL:** Ensure `propagation_events` and `llms_txt_content` columns are added. TypeScript interfaces in Section 15."
- **04** → "Here are the prompt specs. Build the cron Route Handler for the Fear Engine (`app/api/cron/audit/route.ts`)."
- **04c** → "Here is the SOV Engine spec. Build `run-sov-cron` and fix the hardcoded Visibility component."
- **05** → "Here is the API contract. Build these Next.js API routes."
- **06** → "Here is the UX spec. Build these React components."
- **11** → "Here is the testing strategy. **CRITICAL:** Implement the `drift-detection` integration test to validate the 'AI Insurance' logic."
- **15** → "Here is the Prompt Intelligence spec. Build the gap detection algorithm and `GET /api/sov/gaps` endpoint. The query taxonomy in this doc is authoritative for all template seeding."
- **16** → "Here is the Occasion Engine spec. Seed `local_occasions` table using `supabase/seeds/occasions_seed.sql`. Wire the occasion scheduler as a sub-step of the SOV cron."
- **17** → "Here is the Content Grader spec. Build `lib/page-audit/auditor.ts` and the FAQ auto-generator. Scoring dimensions and weights in Section 2 are authoritative."
- **18** → "Here is the Citation Intelligence spec. Build `run-citation-cron` as a Next.js Route Handler at `app/api/cron/citation/route.ts`. Note: `citationFrequency` is float 0.0–1.0 — multiply by 100 at display layer only."
- **19** → "Here is the Autopilot Engine spec. Build `createDraft()` and the publish pipeline. **CRITICAL:** Server-side HITL validation — `POST /publish` must check `human_approved === true` AND `status === 'approved'` before any publish action."
- **MCP Tools** → "Here are the MCP tool definitions at `lib/mcp/tools.ts`. Tools use Zod v3 (`zod/v3`) — do NOT change to `zod`. See §24 in `.cursorrules`."
- **AI Assistant** → "Chat endpoint at `app/api/chat/route.ts`. Tools at `lib/tools/visibility-tools.ts`. UI at `app/dashboard/ai-assistant/_components/Chat.tsx`. Uses AI SDK v4 `streamText()`. See §25 in `.cursorrules`."

**Document authority rules for coding agents:**
- When Doc 04 and Doc 04c conflict on SOV specifics → **Doc 04c wins**
- When Doc 04 and Doc 04b conflict on menu specifics → **Doc 04b wins**
- Parent docs (04) are authoritative for architecture principles and cross-engine interfaces
- Companion docs (04b, 04c) are authoritative for their specific feature's implementation details

### For Sales & Customers
- **01** (Sections 1-5) → Pitch deck content
- **07** (Section 3) → Pricing page copy
- **08** → Marketing site implementation guide

---

## Key Terminology

| Term | Definition |
|------|-----------|
| **AEO** | Answer Engine Optimization — optimizing to be cited by ChatGPT, Perplexity, Gemini. |
| **GEO** | Generative Engine Optimization — structuring data (Schema, JSON-LD) so LLMs can parse it. |
| **Answer-First** | Content structure (inverted pyramid) optimized for AI Overviews. Conclusion first, details second. |
| **llms.txt** | The standard text file located at `/llms.txt` that gives AI agents a concise, markdown-formatted summary of the business entity. |
| **Share of Voice** | AEO metric: The percentage of AI answers for a specific query (e.g., "best hookah") that cite this business. |
| **Citation Rate** | The percentage of AI responses that include a clickable reference link to the business. |
| **Fear Engine** | Hallucination detection module — finds when AI says wrong things about a business. |
| **Greed Engine** | Competitor intercept module — analyzes why competitors win AI recommendations. |
| **Magic Engine** | Menu-to-Schema pipeline — converts PDF menus into AI-readable JSON-LD. |
| **Ground Truth** | The verified, correct business data (hours, amenities, status) stored in our DB. |
| **Golden Tenant** | Charcoal N Chill — the first tenant, used for all testing and dogfooding. |
| **Big 6** | Google, Yelp, Apple Maps, Facebook, TripAdvisor, Bing Places. |
| **Red Alert** | A critical hallucination (e.g., AI says business is "Closed" when it's open). |
| **Magic Menu** | The public, AI-readable menu page hosted at `menu.localvector.ai/{slug}`. |
| **Reality Score** | Composite metric: (Visibility × 0.4) + (Accuracy × 0.4) + (DataHealth × 0.2). |
| **Link Injection** | The critical user action of pasting the Magic Menu URL into Google Business Profile & Yelp to force AI indexing. |
| **Truth Calibration** | The onboarding step where users explicitly confirm amenities to prevent false positives. |
| **SOV Engine** | Share-of-Answer Engine — runs weekly AI queries and measures how often the business is cited. Populates the Visibility component of the Reality Score. |
| **First Mover Alert** | An SOV alert fired when no local business is cited for a tracked AI query — uncontested opportunity. |
| **Content Draft** | An AI-generated content brief created by the Autopilot Engine. Requires human approval before publishing. |
| **Occasion Module** | Feature that monitors seasonal events (Valentine's Day, Bachelorette, etc.) and alerts tenants to create occasion-targeted content before competitors. |
| **Citation Gap** | A platform that AI frequently cites for a business category+city where the tenant has no listing. |
| **Page Audit** | Site-wide AEO content scoring — grades homepage, about, FAQ, and event pages for answer-first structure, schema completeness, and keyword density. |
| **HITL** | Human-in-the-Loop — the mandatory human approval checkpoint in the Autopilot pipeline. No content publishes without it. |
| **MCP** | Model Context Protocol — an open standard for exposing application data as AI-callable tools. LocalVector's MCP server lets AI clients (Claude, ChatGPT plugins) query visibility scores, SOV reports, hallucinations, and competitor analysis directly. |
| **AI SDK** | Vercel AI SDK v4 — the unified interface used for all LLM calls (OpenAI, Perplexity). Provides `generateText()`, `streamText()`, and structured tool definitions. Replaces raw `fetch()` calls. |
| **Generative UI** | Pattern where AI tool results render as typed UI components (cards, charts, lists) instead of plain text. Implemented in the AI Assistant at `/dashboard/ai-assistant`. |

---

## Architecture at a Glance

```
┌─────────────────────┐    ┌──────────────────────────┐
│   app.localvector.ai │    │  menu.localvector.ai     │
│   (Dashboard)        │    │  (Public Magic Layer)    │
└──────────┬──────────┘    └────────────┬─────────────┘
           │                            │
           └──────────┬─────────────────┘
                      │
           ┌──────────▼────────────┐
           │    Next.js Middleware  │  ← Tenant Resolution + Subdomain Routing
           └──────────┬────────────┘
                      │
           ┌──────────▼────────────┐
           │     Supabase Auth     │  ← JWT + RLS
           └──────────┬────────────┘
                      │
    ┌─────────────────▼─────────────────┐
    │       PostgreSQL (Supabase)       │
    │  ┌──────────┐  ┌───────────────┐  │
    │  │ Core     │  │ Intelligence  │  │
    │  │ (Orgs)   │  │ (Audits)      │  │
    │  └──────────┘  └───────────────┘  │
    │  ┌──────────┐  ┌───────────────┐  │
    │  │ Listings │  │ Magic Menus   │  │
    │  └──────────┘  └───────────────┘  │
    │  ┌──────────┐  ┌───────────────┐  │
    │  │ AEO Data │  │ Content       │  │
    │  │ (SOV)    │  │ Pipeline      │  │
    │  └──────────┘  └───────────────┘  │
    └─────────────────┬─────────────────┘
                      │
           ┌──────────▼────────────┐
           │   Cron Job Scheduler  │  ← Cost Control Layer
           │   Audit · SOV · Cite  │
           │   (Route Handlers)    │
           └─────┬──────────┬──────┘
                 │          │
          ┌──────▼──┐  ┌───▼──────┐
          │ LLM APIs│  │ Google   │
          │ OpenAI  │  │ Places   │
          │ Pplxty  │  │ API      │
          └─────────┘  └──────────┘

    ┌───────────────┐  ┌───────────────┐
    │ MCP Server    │  │ AI Assistant  │
    │ /api/mcp/*    │  │ /api/chat     │
    │ (Streamable)  │  │ (Streaming)   │
    └───────────────┘  └───────────────┘
```

---

## Tech Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 16 (App Router) | SSR dashboard + public menu pages |
| Styling | Tailwind CSS + shadcn/ui | Rapid, consistent UI |
| Language | TypeScript (strict) | Type safety across stack |
| Database | Supabase (PostgreSQL) | Multi-tenant data with RLS |
| Auth | Supabase Auth | Email/Password + Google OAuth |
| Storage | Supabase Storage | PDF menu uploads |
| Cron Jobs | Next.js Route Handlers (`app/api/cron/*/route.ts`) | Scheduled audits, SOV runs, citation scans |
| Hosting | Vercel | Edge deployment, wildcard subdomains |
| AI (OCR) | OpenAI GPT-4o Vision | Menu PDF → structured JSON |
| AI (Audit) | Perplexity Sonar API | Live hallucination detection |
| AI (Analysis) | OpenAI GPT-4o-mini | Competitor intercept reasoning |
| AI SDK | Vercel AI SDK v4 (`ai`, `@ai-sdk/openai`) | Unified LLM interface for all AI calls |
| Charts | recharts | Dashboard data visualization |
| MCP | `mcp-handler` + `@modelcontextprotocol/sdk` | Model Context Protocol server for AI tool access |
| Payments | Stripe | Subscriptions + usage metering |
| Email | Resend | Transactional alerts ("Red Alert" emails) |
| Rate Limiting | Vercel KV | Per-org API throttling |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Feb 16, 2026 | Initial "Fear, Greed, Magic" framework. 10-doc suite. |
| 2.0 | Feb 16, 2026 | Consolidated from iterative planning sessions. Added: RLS policies, Visibility Score, API rate limiting. |
| 2.1 | Feb 16, 2026 | **"Outcome Architecture" Patch:** Added Link Injection, Truth Calibration, and Propagation Tracking. |
| 2.2 | Feb 16, 2026 | **AEO/GEO Upgrade:** Added `llms.txt` generation, Answer-First logic, Share of Voice metrics, and Golden Tenant real-world address patch. |
| 2.3 | Feb 16, 2026 | **Build-Ready Patch:** Added `crawler_hits` table + RLS to schema. Added Section 5.4 Drift Detection integration test. Added `PlanGate` component spec (Doc 06 §9.1). Added `ai-config.json` schema definition (Doc 08 §10). Uncommented Golden Tenant seed data. Fixed Section 15 TypeScript interfaces. |
| 2.4 | Feb 22, 2026 | **Phase 19 Spec:** Added Doc 04b v3.0 — Hybrid Upload (LocalVector CSV + GPT-4o POS Mapper), Schema.org RestrictedDiet enumeration mapping, IndexNow active pinging, Web Audit Workflow. Applied code patches: `lib/types/menu.ts` (`image_url`, `indexnow_pinged`), `actions.ts` (`MenuExtractedItemSchema`). |
| 2.5 | Feb 23, 2026 | **Phase 3 Ship:** Competitor Intercept / Greed Engine fully implemented. 4 Server Actions (`addCompetitor`, `deleteCompetitor`, `runCompetitorIntercept`, `markInterceptActionComplete`), 4 client components (`CompetitorChip`, `AddCompetitorForm`, `RunAnalysisButton`, `InterceptCard`), compete page with UpgradeGate plan gate. 22 new Vitest tests (243 total). `docs/05` §5 architectural deviation note added. `AI_RULES` §19.1 section ref corrected (§15.5 → §15.7). |
| 2.6 | Feb 23, 2026 | **Documentation Expansion — SOV Engine + Content Pipeline:** Added Doc 04c (SOV Engine Spec). Added companion docs 15–19 (all v1.0, shipped). Updated Doc 03 with TypeScript interfaces 15.12–15.17 for all new tables. Updated Doc 04 v2.4 (Section 3.4 Content Draft trigger, Section 6 Visibility fix). Updated Doc 05 v2.4 (Sections 12–15: SOV, Content Drafts, Page Audits, Citation Gap endpoints). Updated Doc 06 v2.4 (Sections 8–11: new feature UX, renumbered §12–14). Updated Doc 09 v2.4 (Phases 5–8). Updated Doc 10 v2.4 (Risks 12–14, updated cost tables). Added 3 migration files: `20260223000001_sov_engine.sql`, `20260223000002_content_pipeline.sql`, `20260223000003_gbp_integration.sql`. |
| 2.7 | Feb 23, 2026 | **Remediation Patch — Architecture Accuracy:** Next.js 15 → 16 throughout. "Supabase Edge Functions (Deno)" → "Next.js Route Handlers (`app/api/cron/*/route.ts`)" in Tech Stack table and architecture diagram. "For Coding Agents" section updated to reference Route Handlers not Edge Functions. Added Doc 13 (V1 Core Loop) and Doc 14 (Testing Strategy Live) to document index table. |
| 2.8 | Feb 24, 2026 | **Surgical Integration — 6 Vercel Template Upgrades:** (1) AI SDK v4 swap replacing raw fetch() across all AI services (`ai@^4.3`, `@ai-sdk/openai@^1.3`). (2) SOV Engine cron (`/api/cron/sov`) with seed, email report, First Mover Alerts. (3) Content Crawler + Page Auditor (`/api/cron/content-audit`). (4) Dashboard charts via `recharts@^2.15.3`: SOVTrendChart, MetricCard, HallucinationsByModel, CompetitorComparison. (5) MCP Server (`/api/mcp/[transport]`) exposing 4 AI-callable tools via Streamable HTTP transport; uses `zod/v3` compat layer for MCP SDK. (6) Generative UI chat assistant (`/dashboard/ai-assistant`) with streaming responses + rich tool-result cards (ScoreCard, TrendList, AlertList, CompetitorList). Added `.cursorrules` §20–§27. Added Doc 05 §16 (new route specs). Added Doc 06 §15–16 (charts + AI assistant UX). Updated Doc 14 with 6 new test suites. 31 new files, ~3,462 lines added, 402 tests passing. |
