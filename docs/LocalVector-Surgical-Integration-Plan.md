# LocalVector — Surgical Integration Plan
## Vercel/Next.js Template Components → Existing Codebase

> **Date:** February 24, 2026
> **Codebase Stats:** 28,033 lines TypeScript | 32 dashboard components | 22 test files | 10 Supabase migrations | 8 API routes
> **Stack:** Next.js 16, Supabase (PostgreSQL + Auth), Stripe, Resend, Vercel KV, Sentry, Tailwind CSS
> **Current Phase:** MVP scaffolding complete through Phase 3 (Compete/Greed Engine). SOV Engine spec'd but not implemented.

---

## Current Codebase Architecture Assessment

### ✅ What You Already Have (Don't Touch)
- **Auth + Multi-tenant RLS** — Supabase Auth with org-scoped RLS policies on every table. Working.
- **Stripe billing** — Webhook handler, plan enforcer, tier gating. Working.
- **Fear Engine** — `ai-audit.service.ts` → OpenAI GPT-4o hallucination detection. Working.
- **Greed Engine** — `competitor-intercept.service.ts` → 2-stage Perplexity + GPT-4o-mini pipeline. Working.
- **Magic Menu** — PDF upload → JSON-LD Schema.org → public `/m/[slug]` route. Working.
- **Dashboard shell** — Layout, sidebar, nav, alert feed, reality score card, quick stats. Working.
- **Cron infrastructure** — `app/api/cron/audit/route.ts` with CRON_SECRET auth, service-role client, per-org error isolation. Pattern established.
- **Email pipeline** — Resend integration for hallucination alerts. Working.
- **Database schema** — 10 migrations, comprehensive `prod_schema.sql`. Mature.
- **Test suite** — 22 Vitest unit/integration tests + Playwright E2E. MSW mocks. CI-ready.

### ❌ What's Missing (Where Templates Help)
1. **SOV Engine runtime** — Spec'd in `04c-SOV-ENGINE.md` but `app/api/cron/sov/route.ts` doesn't exist yet
2. **Multi-model AI querying** — Currently raw `fetch()` to OpenAI/Perplexity APIs. No unified provider abstraction
3. **Vector embeddings / semantic search** — No embedding pipeline for content similarity analysis
4. **Content analysis pipeline** — Docs 15-19 are spec'd (Content Grader, Citation Intelligence, Autopilot) but unbuilt
5. **Web crawler** — No site crawling capability for client content indexing or competitor analysis
6. **Dashboard data visualization** — Using basic QuickStat cards. No charts, trends, or time-series visualizations

---

## The 6 Surgical Integrations

### SURGERY 1: Vercel AI SDK 6 → Replace Raw `fetch()` Calls
**Impact: HIGH | Effort: 3-5 days | Risk: LOW**

**What it replaces:** Your `ai-audit.service.ts` (lines 157-184) and `competitor-intercept.service.ts` both use raw `fetch()` to OpenAI/Perplexity APIs with manual JSON parsing and no streaming.

**What you get:**
- Unified provider API — switch between OpenAI, Anthropic, Google, Perplexity with one line
- `generateText()` + `Output.object()` with Zod schemas — enforces your SOV/hallucination response shapes at the SDK level (you already use Zod v4)
- `ToolLoopAgent` for multi-step SOV analysis (query → parse → score → store)
- Built-in rate limiting, retries, and error handling
- OpenTelemetry integration pairs with your existing Sentry setup

**Files to modify:**
```
npm install ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google

lib/services/ai-audit.service.ts        → Replace fetch() with generateText() + Output.object()
lib/services/competitor-intercept.service.ts → Replace fetch() with generateText()
lib/schemas/sov.ts                       → Add Zod schemas for SOV AI response shapes
```

**Code pattern (replaces lines 157-184 of ai-audit.service.ts):**
```typescript
import { generateText, Output } from 'ai';
import { z } from 'zod';

const HallucinationSchema = z.object({
  hallucinations: z.array(z.object({
    model_provider: z.enum(['openai-gpt4o', 'perplexity-sonar', 'google-gemini', 'anthropic-claude', 'microsoft-copilot']),
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    category: z.enum(['status', 'hours', 'amenity', 'menu', 'address', 'phone']),
    claim_text: z.string(),
    expected_truth: z.string(),
  }))
});

export async function auditLocation(location: LocationAuditInput): Promise<DetectedHallucination[]> {
  const { output } = await generateText({
    model: 'openai/gpt-4o',
    output: Output.object({ schema: HallucinationSchema }),
    system: SYSTEM_PROMPT,
    prompt: buildAuditPrompt(location),
  });
  return output?.hallucinations ?? [];
}
```

**Why this is surgery, not a rewrite:** Your service interfaces stay identical. Callers (`cron/audit/route.ts`, server actions) don't change. You're just swapping the HTTP plumbing inside the service layer.

---

### SURGERY 2: Morphic's Multi-Model SOV Pattern → Build `app/api/cron/sov/route.ts`
**Impact: CRITICAL | Effort: 5-7 days | Risk: MEDIUM**

**What it enables:** The single biggest gap — your SOV Engine. Doc `04c-SOV-ENGINE.md` is a complete spec. Morphic's architecture shows how to query multiple AI models and parse structured responses.

**What to extract from Morphic:**
- Multi-model query dispatcher (OpenAI, Perplexity, Anthropic, Google — not just Perplexity as spec'd)
- Response parsing pipeline with citation extraction
- Rate limiting between API calls (Morphic uses Firecrawl; you'll use Vercel AI SDK)

**New files to create:**
```
app/api/cron/sov/route.ts              → Weekly cron (follows your existing cron/audit pattern)
lib/services/sov-engine.service.ts     → Core SOV logic (extracted from Morphic pattern)
lib/services/sov-query-runner.ts       → Single query execution against multiple models
lib/services/sov-seed.ts              → seedSOVQueries() from Doc 04c §3.1
```

**Architecture (follows your existing cron pattern exactly):**
```typescript
// app/api/cron/sov/route.ts — mirrors cron/audit/route.ts structure
export async function GET(request: NextRequest) {
  // 1. Auth guard (same CRON_SECRET pattern)
  // 2. Service-role client
  // 3. Fetch active queries from sov_target_queries (Doc 04c §4.1)
  // 4. For each org batch:
  //    - Run queries via AI SDK generateText() against Perplexity
  //    - Parse business mentions via Zod-validated structured output
  //    - Write to visibility_analytics (Doc 04c §4.3)
  //    - Check First Mover Alerts (Doc 04c §6.1)
  // 5. Return summary JSON
}
```

**Why Morphic helps but you don't fork it:** Morphic is a full app with its own auth, DB, and UI. You only need its query → parse → score pattern, adapted to write into your existing `visibility_analytics` and `sov_target_queries` tables.

---

### SURGERY 3: Pinecone/Upstash Crawler Pattern → Content Indexing Pipeline
**Impact: HIGH | Effort: 5-7 days | Risk: MEDIUM**

**What it enables:** Docs 17 (Content Grader) and 18 (Citation Intelligence) both require crawling client websites to analyze content quality and find citation gaps.

**What to extract from the Pinecone Vercel AI Starter:**
- The Scrapy-based crawler architecture (Python) OR a simpler JS-based approach using Cheerio
- The chunk → embed → store pipeline
- The retrieval pattern for similarity search

**Recommended approach (JS-native, avoids Python dependency):**
```
npm install cheerio

lib/services/crawler.service.ts         → Crawl client website, extract text + schema.org
lib/services/content-grader.service.ts  → Score content per Doc 17 dimensions
app/api/cron/content-audit/route.ts     → Weekly crawl + grade pipeline
```

**Why Upstash Vector over Pinecone:** Serverless, pay-per-query pricing. Better fit for your early-stage cost model (Doc 10 cost tables). No always-on infrastructure. Same API pattern.

**Alternative:** Skip vector embeddings for MVP. The Content Grader (Doc 17) can work with pure text analysis (checking for answer-first structure, schema.org presence, FAQ completeness) without needing embeddings. Add vector search in Phase 2 when you need semantic similarity for citation matching.

---

### SURGERY 4: shadcn/ui Dashboard Components → Upgrade Data Visualization
**Impact: MEDIUM | Effort: 2-3 days | Risk: LOW**

**What it replaces:** Your current `QuickStat` is a basic card with a label and number. Your `RealityScoreCard` has no trend visualization. Your SOV page (`share-of-voice/page.tsx`) renders `SovCard` components but lacks charts.

**What to extract from Studio Admin Dashboard:**
- Recharts-based line/area charts for SOV trend over time
- Data table component with sorting/filtering for query results
- Metric cards with sparklines and delta indicators

**Package additions:**
```
npm install recharts @tanstack/react-table
```

**Components to add (not replace):**
```
app/dashboard/_components/TrendChart.tsx        → Recharts area chart for SOV over time
app/dashboard/_components/MetricCard.tsx         → Enhanced QuickStat with sparkline + delta
app/dashboard/_components/DataTable.tsx          → Sortable table for hallucinations, queries
app/dashboard/share-of-voice/_components/SovTrendChart.tsx  → Weekly SOV line chart
```

**Why this is additive:** Your existing dashboard layout and data fetching patterns are solid. You're just adding richer visualization components that consume the same data.

---

### SURGERY 5: MCP Server Template → Expose LocalVector as an AI Tool
**Impact: HIGH (differentiator) | Effort: 3-4 days | Risk: LOW**

**What it enables:** Any MCP-compatible AI assistant (Claude, ChatGPT with plugins, Cursor, etc.) can query a client's AI visibility data natively. This is a moat — competitors don't have this.

**What to extract from Vercel MCP Template:**
- The `mcp-handler` package setup
- Route handler pattern at `app/api/mcp/route.ts`
- Tool definition structure

**New files:**
```
npm install mcp-handler

app/api/mcp/[transport]/route.ts   → MCP server endpoint
lib/mcp/tools.ts                   → Tool definitions:
  - get_visibility_score(business_name)
  - get_sov_report(business_name, date_range)
  - get_hallucinations(business_name, status)
  - get_competitor_analysis(business_name)
```

**Why this is quick:** The MCP template is literally a drop-in route handler. Your existing Supabase queries become MCP tools with minimal wrapping. Auth via MCP's built-in auth flow maps to your existing org-scoped access.

---

### SURGERY 6: Generative UI Pattern → Interactive AI Audit Chat
**Impact: MEDIUM | Effort: 4-5 days | Risk: MEDIUM**

**What it enables:** Roadmap item #11 ("Truth-Grounded RAG Chatbot") and #17 ("AI Answer Simulation Sandbox"). A chat interface where clients can ask "How visible is my business for [query]?" and get a rendered SOV card, trend chart, or comparison table — not just text.

**What to extract from Vercel Generative UI Template:**
- The `useChat` hook pattern for streaming responses
- Tool call → React component rendering pipeline
- The pattern where AI tool results render as custom widgets instead of text

**New files:**
```
app/dashboard/ai-assistant/page.tsx              → Chat page
app/dashboard/ai-assistant/_components/Chat.tsx  → useChat + tool rendering
app/api/chat/route.ts                           → AI SDK streamText with tool definitions
lib/tools/visibility-tools.ts                    → Tools that query your Supabase data
```

**Why this is Phase 2:** This is impressive but not MVP-critical. The SOV Engine (Surgery 2) and AI SDK swap (Surgery 1) must come first because the chat tools depend on having real data to query.

---

## Implementation Priority & Timeline

```
Week 1:  SURGERY 1 (AI SDK swap)     — Foundation for everything else
Week 1:  SURGERY 4 (shadcn charts)   — Quick visual upgrade, parallel work
Week 2-3: SURGERY 2 (SOV Engine)     — The critical missing feature
Week 3:  SURGERY 3 (Crawler)         — Content Grader enablement
Week 4:  SURGERY 5 (MCP Server)      — Differentiator, quick win
Week 5+: SURGERY 6 (Generative UI)   — Premium feature, post-MVP
```

---

## What NOT to Integrate

| Template | Reason to Skip |
|----------|----------------|
| **SaaS Starter Kit** | You already have auth + Stripe + plan enforcer. Integrating would mean rewriting your working auth flow. |
| **Once UI / Magic Portfolio** | Design system swap at this stage would be a full UI rewrite. Stick with Tailwind + your existing component patterns. |
| **Azure AI RAG Chatbot** | Vendor lock-in to Azure. Your Supabase + Vercel stack is cleaner. |
| **Supabase AI Chatbot (full)** | You'd inherit their opinionated auth/DB patterns which conflict with your existing RLS setup. |
| **Full Morphic fork** | Morphic is a standalone product. You need its query pattern, not its app shell. |

---

## Dependency Changes Summary

```json
// New production dependencies
"ai": "^6.x",                    // Vercel AI SDK core
"@ai-sdk/openai": "^1.x",       // OpenAI provider
"@ai-sdk/anthropic": "^1.x",    // Anthropic provider (multi-model SOV)
"recharts": "^2.x",             // Dashboard charts
"@tanstack/react-table": "^8.x", // Data tables
"mcp-handler": "^0.x",          // MCP server (Surgery 5)
"cheerio": "^1.x",              // HTML parsing for crawler (Surgery 3)

// Already have (no changes needed)
"zod": "^4.3.6",                // ✅ Already installed
"@supabase/supabase-js": "^2.x", // ✅ Already installed
"stripe": "^20.x",               // ✅ Already installed
"resend": "^6.x",                // ✅ Already installed
"@vercel/kv": "^3.x",            // ✅ Already installed
```

---

## Files Changed vs. Files Created

| Surgery | Files Modified | Files Created | Lines Changed (est.) |
|---------|---------------|---------------|---------------------|
| 1. AI SDK | 2 | 0 | ~150 |
| 2. SOV Engine | 1 (dashboard/page.tsx) | 4 | ~600 |
| 3. Crawler | 0 | 3 | ~400 |
| 4. Charts | 2 (dashboard pages) | 4 | ~500 |
| 5. MCP | 0 | 3 | ~250 |
| 6. Gen UI | 0 | 4 | ~500 |
| **Total** | **5 modified** | **18 created** | **~2,400 lines** |

Your existing 28,033 lines stay intact. You're adding ~8.5% new code with only 5 files touched.

---

*This plan treats your codebase as the host and templates as organ donors — we take exactly what's needed and leave the rest on the table.*
