# LocalVector V1 — Repository Deep Dive Analysis

## Date: February 25, 2026
## Repository: `senthilbabu-source/local-vector-v1`

---

## Executive Summary

LocalVector is a **production-grade AEO/GEO SaaS platform** significantly more mature than the initial external analysis suggested. The codebase contains **28 database tables**, **62 RLS policies**, **11 migrations**, **4 AI provider integrations**, **3 cron pipelines**, an **MCP server**, a **streaming AI assistant**, and a **Stripe billing system**. The "vector" in the name is aspirational — **pgvector is NOT currently installed**, but the platform has rich intelligence engines that don't require embeddings.

---

## 1. What's Actually Implemented (Confirmed in Code)

### 1.1 Core Intelligence Engines

| Engine | Status | Service File | AI Model Used |
|--------|--------|--------------|---------------|
| **Fear Engine** (Hallucination Detection) | ✅ Implemented | `ai-audit.service.ts` | GPT-4o |
| **Greed Engine** (Competitor Intercept) | ✅ Implemented | `competitor-intercept.service.ts` | Perplexity Sonar → GPT-4o-mini |
| **SOV Engine** (Share of Voice) | ✅ Implemented | `sov-engine.service.ts` | Perplexity Sonar |
| **Content Grader** (Page AEO Audit) | ✅ Implemented | `page-audit/auditor.ts` | GPT-4o-mini + local HTML analysis |
| **Revenue Leak Calculator** | ✅ Implemented | `revenue-leak.service.ts` | Pure math (no AI) |

### 1.2 AI Provider Configuration (Vercel AI SDK)

Centralized in `lib/ai/providers.ts` with **10 model registrations** across 4 providers:

| Provider | Models | Use Cases |
|----------|--------|-----------|
| **OpenAI** | `gpt-4o`, `gpt-4o-mini` | Fear Engine audits, Greed Engine intercepts, Truth Audit |
| **Perplexity** | `sonar` (via OpenAI-compatible API) | SOV queries, Head-to-head comparisons, Truth Audit |
| **Anthropic** | `claude-sonnet-4-20250514` | Multi-engine Truth Audit |
| **Google** | `gemini-2.0-flash` | Multi-engine Truth Audit |

All models have graceful fallbacks — mock results when API keys are absent (local dev/CI).

### 1.3 Automated Cron Pipelines

| Cron | Route | Schedule | What It Does |
|------|-------|----------|-------------|
| **SOV Weekly** | `/api/cron/sov` | Sunday 2 AM EST | Queries Perplexity for every org's target queries, writes `visibility_analytics`, triggers First Mover Alerts, sends email reports |
| **AI Audit** | `/api/cron/audit` | Configurable | Multi-engine hallucination detection across GPT-4o, Perplexity, Claude, Gemini |
| **Content Audit** | `/api/cron/content-audit` | Configurable | Page-level AEO scoring across dimensions |

Each cron has: CRON_SECRET auth guard, kill switch, service-role Supabase client (bypasses RLS), plan-gated query caps, per-org resilience with try/catch, and rate limiting (500ms between Perplexity calls).

### 1.4 MCP Server (Model Context Protocol)

Fully implemented in `lib/mcp/tools.ts` with 4 tools exposed via `@modelcontextprotocol/sdk`:

- `get_visibility_score` — SOV %, reality score, accuracy score
- `get_sov_report` — Historical trend + query-level citations
- `get_hallucinations` — Open/fixed hallucinations by model
- `get_competitor_analysis` — Competitor intercept comparisons

Route: `/api/mcp/[transport]/route.ts` — supports multiple MCP transports.

### 1.5 AI Chat Assistant (Streaming)

`/api/chat/chat-route.ts` implements a streaming AI assistant using Vercel AI SDK's `streamText()`:

- GPT-4o with org-scoped tool calls
- 5 max tool steps per conversation
- Tools: visibility score, SOV data, hallucinations, competitor data
- Client receives text chunks + structured tool results for rich UI cards

### 1.6 Database Schema (28 Tables, 62 RLS Policies)

**Core business tables:**
- `organizations`, `users`, `memberships` (multi-tenant with role-based access)
- `locations`, `business_info` (multi-location support)
- `target_queries` (SOV query library per location)

**Intelligence tables:**
- `ai_evaluations`, `ai_audits` (Fear Engine results)
- `ai_hallucinations` (with severity, propagation tracking, occurrence counting)
- `sov_evaluations`, `visibility_analytics`, `visibility_scores`
- `competitor_intercepts`, `competitors`
- `citation_source_intelligence`
- `content_drafts`, `page_audits`, `local_occasions`
- `crawler_hits`

**Integration tables:**
- `google_oauth_tokens` (GBP OAuth — encrypted at rest)
- `location_integrations`, `listings`, `directories`
- `pending_gbp_imports`

**Menu system:**
- `magic_menus`, `menu_categories`, `menu_items`

**Revenue:**
- `revenue_config`, `revenue_snapshots` (added in latest migration)

**RLS strategy:** Every tenant-scoped table uses `org_isolation_*` policies resolving via `current_user_org_id()` — a SECURITY DEFINER function that maps `auth.uid()` → org membership. **62 total policies** cover SELECT/INSERT/UPDATE/DELETE across all tables.

### 1.7 Billing & Plan Enforcement

- **Stripe** integration via webhooks (`/api/webhooks/stripe`) handling `checkout.session.completed` and `customer.subscription.updated`
- **Plan tiers:** `trial` → `starter` → `growth` → `agency`
- **Plan enforcer** (`lib/plan-enforcer.ts`) gates 8 features:
  - Daily audits (Growth+)
  - SOV on-demand evaluation (Growth+)
  - Competitor intercept (Growth+, max 3/10 competitors)
  - Autopilot content generation (Growth+)
  - Content Grader (Growth+)
  - Occasion Engine (Growth+)
  - GBP OAuth (Starter+)
  - Multi-location (Agency only, up to 10)

### 1.8 Email System

- **Resend** for transactional email
- **React Email** templates (`emails/WeeklyDigest.tsx`)
- Two alert types: `sendHallucinationAlert()` and `sendSOVReport()`
- Graceful no-op when `RESEND_API_KEY` absent

### 1.9 Infrastructure

- **Redis/Upstash** — lazy-init client with backward-compatible env var fallback
- **Sentry** — client, server, and edge configs
- **Proxy middleware** — auth-based routing (not CORS bypass as initially speculated)
- **Cheerio** — HTML parsing for page audits
- **PapaParse** — CSV menu import
- **JSZip** — Bundle export
- **schema-dts** — JSON-LD type safety

### 1.10 Testing

**41 unit tests** covering:
- All services (SOV engine, competitor intercept, revenue leak, page auditor)
- All cron routes
- AI providers, MCP tools, visibility tools
- UI components (SOV cards, dashboard, content drafts)
- Schema types, plan enforcer, auth routes, RLS isolation

**14 E2E tests (Playwright)** covering:
- Viral wedge/free scan flow
- Onboarding guard
- Dashboard fear-first experience
- Magic menu pipeline
- Public honeypot
- Share of voice
- Listings, content drafts, revenue leak
- Auth, billing, hybrid upload

### 1.11 Dashboard Pages (13 routes)

Main dashboard, AI Assistant, Billing, Compete (competitor intercept), Content Drafts, Hallucinations, Integrations, Locations, Magic Menus (+ detail view), Settings (+ revenue sub-page), Share of Voice.

---

## 2. What's NOT Implemented (Planned in Docs Only)

### 2.1 pgvector — NOT Present

Despite the project name, **pgvector is not installed**. The production schema enables these Postgres extensions:
- `pg_net`, `pg_graphql`, `pg_stat_statements`, `pg_trgm`, `pgcrypto`, `supabase_vault`, `uuid-ossp`

No `vector` extension, no embedding columns, no similarity search functions. The "vector" in the name references the concept of AI visibility vectors, not actual vector embeddings.

### 2.2 Documented but Not Yet Coded

These engines have comprehensive spec documents (15-19+ pages each) but no corresponding service files:

| Engine | Doc | Status |
|--------|-----|--------|
| **Local Prompt Intelligence** | Doc 15 (15-LOCAL-PROMPT-INTELLIGENCE.md) | Spec complete, no service file |
| **Occasion Engine** | Doc 16 (16-OCCASION-ENGINE.md) | Spec complete, DB table created (`local_occasions`), no cron |
| **Citation Intelligence** | Doc 18 (18-CITATION-INTELLIGENCE.md) | Spec complete, DB table created (`citation_source_intelligence`), no cron |
| **Autopilot Engine** | Doc 19 (19-AUTOPILOT-ENGINE.md) | Spec complete, `content_drafts` table exists, First Mover writes work, full publish pipeline not built |

### 2.3 SOV Engine — Planned SQL Migration Not Applied

The docs contain `20260223000001_sov_engine.sql` which defines `sov_target_queries` with richer taxonomy (query_category, occasion_tag, intent_modifier, is_system_generated). The actual migration (`20260221000004_create_sov_tracking.sql`) uses the simpler `target_queries` table. The enriched schema from the spec hasn't been migrated yet.

### 2.4 Weekly Digest Email

`emails/WeeklyDigest.tsx` exists as a scaffold with React Email components but is explicitly marked: *"This is a scaffold — the full template will be built when Feature #7 development begins."*

### 2.5 README

Still the default Next.js boilerplate. No setup instructions, env var documentation, or architecture overview.

---

## 3. Useful Additions & Recommendations

### 3.1 High-Impact, Low-Effort

| Addition | Why | Effort |
|----------|-----|--------|
| **HNSW Index on Supabase (when pgvector is added)** | Dramatically faster semantic search vs IVFFlat | Low — single migration |
| **`target_queries.query_category` column** | The SOV service already references `query.query_category` but the DB column doesn't exist yet — this will break in production | Critical fix |
| **Rate limit middleware (Redis-based)** | `lib/redis.ts` exists but no rate limiting on API routes beyond cron timing | Medium |
| **Embedding pipeline for menu items** | `magic_menus` + `menu_items` tables are perfect candidates for vector embeddings to power "what should I order" AI queries | Medium |

### 3.2 Feature Completions (Specs Already Written)

| Feature | Spec Doc | What Needs Building |
|---------|----------|-------------------|
| **Occasion Engine Cron** | Doc 16 | Cron route + service that checks `local_occasions` for upcoming dates and creates `content_drafts` with `trigger_type='occasion'` |
| **Citation Intelligence Cron** | Doc 18 | Monthly cron that samples AI answers and records which citation platforms appear (populates `citation_source_intelligence`) |
| **Prompt Intelligence Service** | Doc 15 | Gap detection algorithm, query library enrichment, competitive prompt monitoring |
| **Full Autopilot Publish Pipeline** | Doc 19 | GBP post publishing, website page creation, approval → publish workflow |

### 3.3 Infrastructure Improvements

| Addition | Rationale |
|----------|-----------|
| **Supabase Realtime subscriptions** | Power live dashboard updates when SOV cron completes — currently requires page refresh |
| **Queue system (BullMQ or Inngest)** | The SOV cron processes orgs sequentially with `sleep(500)` — a proper queue would handle failures, retries, and parallelism better |
| **Webhook/alert integrations** | Plan enforcer has `canRunAutopilot()` etc. but no Slack/webhook notification when SOV drops below threshold |
| **OpenTelemetry tracing** | `providers.ts` comments mention "OpenTelemetry-ready for Sentry integration" but it's not wired up |
| **Edge caching for public pages** | `/scan` results and `/m/[slug]` menu pages could benefit from ISR or edge caching |

### 3.4 pgvector Integration Path

If/when pgvector is added, the natural embedding candidates are:

1. **`menu_items`** — Embed item names + descriptions for semantic menu search
2. **`business_info`** — Embed business descriptions for discovery matching
3. **`content_drafts`** — Embed draft content to avoid duplicate generation
4. **`ai_hallucinations.claim_text`** — Embed claims for deduplication and clustering
5. **`target_queries.query_text`** — Embed queries for semantic similarity grouping

---

## 4. File & Dependency Summary

### Key Environment Variables Required

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# AI Providers
OPENAI_API_KEY
PERPLEXITY_API_KEY
ANTHROPIC_API_KEY
GOOGLE_GENERATIVE_AI_API_KEY

# Infrastructure
CRON_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
UPSTASH_REDIS_REST_URL (or KV_REST_API_URL)
UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_TOKEN)

# Optional
STOP_SOV_CRON=true  (kill switch)
```

### Notable Dependencies

| Package | Purpose |
|---------|---------|
| `ai` (Vercel AI SDK) | Unified AI provider interface |
| `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google` | Provider adapters |
| `@modelcontextprotocol/sdk` + `mcp-handler` | MCP server |
| `@supabase/ssr` + `@supabase/supabase-js` | Database + auth |
| `@sentry/nextjs` | Error tracking |
| `stripe` | Billing |
| `resend` + `@react-email/components` | Transactional email |
| `@upstash/redis` | Caching/rate limiting |
| `cheerio` | HTML parsing for page audits |
| `recharts` + Tremor components | Dashboard visualizations |
| `schema-dts` | JSON-LD type safety |
| `zod` v4 | Runtime validation throughout |

---

## 5. Critical Bug: `query_category` Missing

The SOV engine service (`sov-engine.service.ts`) references `query.query_category` in the `SOVQueryInput` interface and uses it for First Mover Alert filtering:

```typescript
const firstMoverOpps = results.filter(
  (r) => ['discovery', 'occasion', 'near_me'].includes(r.queryCategory),
);
```

But the actual `target_queries` table in the production schema has **no `query_category` column**. The enriched schema from `docs/20260223000001_sov_engine.sql` (which adds `query_category`, `occasion_tag`, `intent_modifier`) was never migrated. This means First Mover Alerts will silently fail to match any queries in production.

**Fix:** Apply the planned migration to add `query_category` to `target_queries`, or create a new migration that adds the column and backfills existing rows.
