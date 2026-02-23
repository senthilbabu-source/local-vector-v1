# LocalVector.ai — Gold Standard Documentation Suite

## The AI Reality Engine for Local Business Visibility
### Version: 2.3 | Date: February 16, 2026

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
| **05** | API Contract & Route Specification | Engineering (Frontend ↔ Backend) | Every endpoint, request/response shape, auth flow, rate limiting. |
| **06** | Frontend & UX Specification | Engineering, Design | Dashboard layout, component hierarchy, user flows, UI states. |
| **07** | Go-to-Market & Growth Playbook | Founder, Marketing | Viral wedge strategy, pricing tiers, acquisition channels, agency sales. |
| **08** | Landing Page & AEO Content Strategy | Marketing, Engineering | Copy, JSON-LD schema for the marketing site, "Glass Box" architecture. |
| **09** | Phased Build Plan & Execution Roadmap | Engineering, Project Management | 16-week sprint plan with acceptance criteria per phase. |
| **10** | Operational Playbook & Risk Register | Founder, Engineering | Cost controls, churn prevention, API budget management, known risks. |
| **11** | Testing & Quality Strategy | Engineering | Test infrastructure, unit/integration/E2E test specs, CI/CD pipeline, agentic TDD workflow. |

---

## How to Use This Suite

### For Phase 0 Build (Start Here)
1. Read **01** for strategic context (know *why* you're building what).
2. Open **03** and run the SQL initialization script in Supabase.
3. Follow **09** Phase 0 checklist line by line.
4. Reference **02** for middleware and auth patterns as you scaffold.

### For Coding Agents
Each document is structured to be pasted as context into a coding agent session:
- **03** → "Here is the database schema. **CRITICAL:** Ensure `propagation_events` and `llms_txt_content` columns are added."
- **04** → "Here are the prompt specs. Build the Edge Function for the Fear Engine."
- **05** → "Here is the API contract. Build these Next.js API routes."
- **06** → "Here is the UX spec. Build these React components."
- **11** → "Here is the testing strategy. **CRITICAL:** Implement the `drift-detection` integration test to validate the 'AI Insurance' logic."

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
┌────────────▼────────────┐
│    Next.js Middleware    │  ← Tenant Resolution + Subdomain Routing
└────────────┬────────────┘
│
┌────────────▼────────────┐
│     Supabase Auth       │  ← JWT + RLS
└────────────┬────────────┘
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
│  ┌──────────┐                     │
│  │ AEO Data │                     │
│  └──────────┘                     │
└─────────────────┬─────────────────┘
│
┌────────────▼────────────┐
│   Cron Job Scheduler    │  ← Cost Control Layer
│   (Edge Functions)      │
└─────┬──────────┬───────┘
│          │
┌──────▼──┐  ┌───▼──────┐
│ LLM APIs│  │ Google   │
│ OpenAI  │  │ Places   │
│ Pplxty  │  │ API      │
└─────────┘  └──────────┘
```

---

## Tech Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 15 (App Router) | SSR dashboard + public menu pages |
| Styling | Tailwind CSS + shadcn/ui | Rapid, consistent UI |
| Language | TypeScript (strict) | Type safety across stack |
| Database | Supabase (PostgreSQL) | Multi-tenant data with RLS |
| Auth | Supabase Auth | Email/Password + Google OAuth |
| Storage | Supabase Storage | PDF menu uploads |
| Edge Functions | Supabase Edge Functions (Deno) | Cron jobs for audits |
| Hosting | Vercel | Edge deployment, wildcard subdomains |
| AI (OCR) | OpenAI GPT-4o Vision | Menu PDF → structured JSON |
| AI (Audit) | Perplexity Sonar API | Live hallucination detection |
| AI (Analysis) | OpenAI GPT-4o-mini | Competitor intercept reasoning |
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
