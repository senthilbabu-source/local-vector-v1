# CLAUDE.md — LocalVector V1 Project Context

## Project Overview

LocalVector is an AEO/GEO SaaS platform that helps local businesses monitor and improve their visibility in AI-generated answers (ChatGPT, Perplexity, Gemini, etc.). Built with Next.js 16 (App Router), TypeScript, Supabase/PostgreSQL, and the Vercel AI SDK.

## Tech Stack

- **Framework:** Next.js 16, React 19, TypeScript
- **Database:** Supabase (PostgreSQL) with RLS via `current_user_org_id()`
- **AI:** Vercel AI SDK (`ai` package) with OpenAI, Perplexity, Anthropic, Google providers — configured in `lib/ai/providers.ts`
- **Billing:** Stripe webhooks → `organizations.plan_tier` enum (`trial | starter | growth | agency`)
- **Email:** Resend + React Email (`emails/`)
- **Cache:** Upstash Redis (`lib/redis.ts`) — optional, all callers must degrade gracefully
- **Testing:** Vitest (unit/integration in `src/__tests__/`), Playwright (E2E in `tests/e2e/`)
- **Monitoring:** Sentry (client, server, edge configs)

## Architecture Rules

- **Database is the source of truth.** `supabase/prod_schema.sql` is the canonical schema. All migrations in `supabase/migrations/` are applied in timestamp order.
- **Services are pure.** Files in `lib/services/` never create their own Supabase client — callers pass one in. This lets the same service work with RLS-scoped clients (user actions) and service-role clients (cron routes).
- **Plan gating lives in `lib/plan-enforcer.ts`.** Always check feature availability before rendering premium UI or executing paid-tier operations.
- **AI providers are centralized.** Never call AI APIs directly — use `getModel(key)` from `lib/ai/providers.ts`. Mock fallbacks activate when API keys are absent.
- **RLS pattern:** Every tenant-scoped table has `org_isolation_select/insert/update/delete` policies using `org_id = public.current_user_org_id()`.
- **Cron routes** live in `app/api/cron/` and require `Authorization: Bearer <CRON_SECRET>` header. Each has a kill switch env var.

## Key Directories

```
app/api/cron/          — Automated pipelines (sov, audit, content-audit)
app/dashboard/         — Authenticated dashboard pages
lib/ai/                — AI provider config, schemas, actions
lib/services/          — Pure business logic services
lib/page-audit/        — HTML parser + AEO auditor
lib/tools/             — AI chat tool definitions
lib/mcp/               — MCP server tool registrations
supabase/migrations/   — Applied SQL migrations (timestamp-ordered)
supabase/prod_schema.sql — Full production schema dump
docs/                  — Spec documents (authoritative for planned features)
src/__tests__/         — Unit + integration tests
tests/e2e/             — Playwright E2E tests
```

## Database Tables (Key Ones)

| Table | Purpose |
|-------|---------:|
| `organizations` | Tenant root — has `plan_tier`, `plan_status` |
| `locations` | Business locations per org |
| `target_queries` | SOV query library per location |
| `sov_evaluations` | Per-query SOV results (engine, rank, competitors) |
| `visibility_analytics` | Aggregated SOV scores per snapshot date |
| `ai_hallucinations` | Detected hallucinations with severity + status tracking |
| `content_drafts` | AI-generated content awaiting human approval |
| `competitor_intercepts` | Head-to-head competitor analysis results |
| `local_occasions` | Seasonal event reference table |
| `citation_source_intelligence` | Which platforms AI actually cites per category |

## Current Migrations (Applied)

1. `20260218000000_initial_schema.sql` — Core tables + RLS
2. `20260220000001_create_menu_categories.sql`
3. `20260221000001_public_menu_reads.sql`
4. `20260221000002_create_integrations.sql`
5. `20260221000003_create_ai_evaluations.sql`
6. `20260221000004_create_sov_tracking.sql` — Creates `target_queries` and `sov_evaluations`
7. `20260223000001_add_gpt4o_mini_model_provider.sql`
8. `20260224000001_content_pipeline.sql` — `content_drafts`, `page_audits`, `local_occasions`, `citation_source_intelligence`
9. `20260224000002_gbp_integration.sql`
10. `20260224000003_listing_url_column.sql`
11. `20260225000001_revenue_leak.sql` — `revenue_config`, `revenue_snapshots`

## Testing Commands

```bash
npm test                    # Run all Vitest tests
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:coverage       # With coverage report
npx playwright test         # E2E tests
```

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY, PERPLEXITY_API_KEY, ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY
CRON_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
```

---

## CURRENT TASK: Build a Robust Job Queue System

### The Problem

Every async pipeline in LocalVector currently runs as a sequential `for...of` loop inside a Vercel Cron route. There are **3 crons**, each with the same fragile pattern:

**1. SOV Cron** (`app/api/cron/sov/route.ts`) — Weekly, Sunday 2 AM
- Fetches all active orgs' `target_queries` (up to 500)
- Loops per-org, then per-query with `await sleep(500)` between Perplexity API calls
- After all queries: `writeSOVResults()` → upserts `visibility_analytics` + `sov_evaluations` + First Mover drafts
- Then sends email report via Resend
- **Worst case: Agency tier (100 queries) × 500ms sleep + ~1s API latency = 150s per org. 10 agency orgs = 25 minutes.**

**2. AI Audit Cron** (`app/api/cron/audit/route.ts`) — Daily (Growth+)
- Loop 1: Per-org → fetch location → `auditLocation()` (GPT-4o) → insert `ai_hallucinations` → send email
- Loop 2: Per-org → per-competitor → `runInterceptForCompetitor()` (Perplexity → GPT-4o-mini 2-stage pipeline)
- Each competitor intercept has a 3-second mock fallback delay when keys are absent
- **Worst case: 10 orgs × 3 competitors × (Perplexity call + GPT-4o-mini call) + audit calls = many minutes**

**3. Content Audit Cron** (`app/api/cron/content-audit/route.ts`) — Monthly, 1st of month 3 AM
- Per-location → generates up to 50 page URLs (Agency) → `auditPage()` per URL with 1s sleep between fetches
- **Worst case: 10 agency locations × 50 pages × 1s = 500s = 8+ minutes**

### Current Failure Modes (Why This Matters NOW)

**1. Vercel Function Timeout.** Cron routes have no `maxDuration` set (defaults to 10s on Hobby, 60s on Pro). The SOV cron with even 15 queries × 500ms sleep = 7.5s + API latency will routinely hit the Hobby timeout. On Pro (60s), 2-3 orgs with Growth plans would max it out. There's no pagination, no chunking, no way to resume.

**2. One failure kills downstream orgs.** The per-org `try/catch` catches errors for individual orgs, but if Perplexity returns a 429 rate limit for org 3 of 10, the entire batch for org 3 is lost. There's no retry — that org waits until next week's cron for another chance. The code does NOT retry individual query failures.

**3. No visibility into failures.** Failed queries log to `console.error` and increment `summary.failed`, but there's no persistent record. After the Vercel function terminates, the failure data is gone unless someone checks Vercel logs within the retention window. No alerting on failure rate.

**4. No idempotency on partial completion.** If the SOV cron processes orgs 1-5 then times out, orgs 6-10 get nothing. If the cron fires again (manual retry), orgs 1-5 get duplicate `sov_evaluations` rows because there's no "already processed this week" check.

**5. Sequential execution wastes time.** The `sleep(500)` between queries is for Perplexity rate limiting, but the entire pipeline is single-threaded. There's no parallelism across orgs — org 2 waits while org 1's queries run. Competitor intercepts run after ALL hallucination audits, even though they're independent.

**6. Growing sub-step complexity.** The SOV cron is about to absorb Occasion Engine, Prompt Intelligence, and Autopilot Engine as sub-steps. Each adds more work per org. Without a queue, the cron becomes a monolithic god function that's impossible to debug when it fails halfway through.

### What Already Exists

**Infrastructure:**
- `lib/redis.ts` — Upstash Redis client (lazy-initialized, env-var configured). AI_RULES §17 says all Redis ops must degrade gracefully.
- Sentry integration (client + server) — can capture errors but currently no cron-specific instrumentation
- Resend email (`lib/email.ts`) — for notifications

**Cron Route Pattern (all 3 crons follow this):**
```
1. Auth: CRON_SECRET header check
2. Kill switch: STOP_*_CRON env var check  
3. Service-role Supabase client (bypasses RLS)
4. Fetch all eligible orgs/queries in one query
5. Sequential for...of loop with per-org try/catch
6. Per-item sleep() for rate limiting
7. Aggregate results and return JSON summary
```

**Services (already decoupled — good):**
- `lib/services/sov-engine.service.ts` — `runSOVQuery(query)` and `writeSOVResults(orgId, results, supabase)` are pure functions. They don't know about crons or loops.
- `lib/services/ai-audit.service.ts` — `auditLocation(location)` is pure
- `lib/services/competitor-intercept.service.ts` — `runInterceptForCompetitor(params, supabase)` is pure
- `lib/page-audit/auditor.ts` — `auditPage(url, pageType, context)` is pure

**Key Insight:** The services are already pure and stateless. The problem is entirely in the cron routes' orchestration layer. A queue system wraps around the existing services — it doesn't replace them.

### Solution: Inngest

**Why Inngest over alternatives:**

| Option | Verdict |
|--------|---------|
| BullMQ | Requires a persistent Redis connection (not Upstash REST). Would need a separate Redis instance. Too much infra for a SaaS with <100 tenants. |
| pg-boss | Uses PostgreSQL for job storage. Requires a persistent connection or polling. Good for self-hosted, but Supabase doesn't support persistent workers. |
| Temporal | Enterprise-grade workflow engine. Massive overkill. Requires dedicated infrastructure. |
| Quirrel | Vercel-native, but discontinued/unmaintained since 2023. |
| Trigger.dev | Good option but requires its own cloud or self-hosted instance. |
| **Inngest** | **Runs on Vercel as a single API route. No infrastructure to manage. Event-driven with automatic retries, fan-out, and step functions. Free tier covers 25K events/month — more than enough for <100 tenants. Has a dev server for local testing. TypeScript-native.** |

Inngest is the right tool because it solves every failure mode without adding infrastructure:
- **Timeout:** Each step runs as a separate Vercel function invocation (each gets its own 60s timeout)
- **Retry:** Built-in per-step retry with exponential backoff
- **Fan-out:** Process all orgs in parallel with `step.run()` per org
- **Idempotency:** Step IDs are idempotent — re-running a function skips completed steps
- **Visibility:** Inngest dashboard shows every event, step, and failure with full payloads
- **Rate limiting:** Built-in `step.sleep()` and `concurrency` controls for API rate limits

### What Needs to Be Built

#### Phase 1: Inngest Setup

**1a. Install Inngest**

```bash
npm install inngest
```

**1b. Create Inngest client** — `lib/inngest/client.ts`

```typescript
import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'localvector',
  // In production, events are sent to Inngest Cloud.
  // In dev, the Inngest dev server runs locally.
});
```

**1c. Create Inngest API route** — `app/api/inngest/route.ts`

This is the single webhook endpoint Inngest calls to execute functions:

```typescript
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { sovCronFunction } from '@/lib/inngest/functions/sov-cron';
import { auditCronFunction } from '@/lib/inngest/functions/audit-cron';
import { contentAuditCronFunction } from '@/lib/inngest/functions/content-audit-cron';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    sovCronFunction,
    auditCronFunction,
    contentAuditCronFunction,
  ],
});

export const maxDuration = 60; // Vercel Pro: 60s per step invocation
```

**1d. Define event types** — `lib/inngest/events.ts`

```typescript
export type Events = {
  'cron/sov.weekly': {
    data: Record<string, never>; // no payload — fetches its own data
  };
  'cron/audit.daily': {
    data: Record<string, never>;
  };
  'cron/content-audit.monthly': {
    data: Record<string, never>;
  };
  'sov/org.process': {
    data: {
      orgId: string;
      plan: string;
      queries: Array<{
        id: string;
        query_text: string;
        location_id: string;
        business_name: string;
        city: string;
        state: string;
      }>;
    };
  };
  'audit/org.process': {
    data: {
      orgId: string;
      orgName: string;
      locationId: string;
    };
  };
  'content-audit/location.process': {
    data: {
      orgId: string;
      locationId: string;
      websiteUrl: string;
      plan: string;
      businessContext: {
        business_name: string;
        city: string;
        state: string;
        categories: string[];
        amenities: string[] | null;
      };
    };
  };
  'publish/post-publish-check': {
    data: {
      draftId: string;
      locationId: string;
      targetQuery: string;
      publishedAt: string;
    };
  };
};
```

#### Phase 2: SOV Cron → Inngest Function (Most Critical)

**2a. SOV fan-out function** — `lib/inngest/functions/sov-cron.ts`

This replaces the monolithic `app/api/cron/sov/route.ts` loop:

```typescript
import { inngest } from '../client';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  runSOVQuery,
  writeSOVResults,
  type SOVQueryInput,
  type SOVQueryResult,
} from '@/lib/services/sov-engine.service';
import { sendSOVReport } from '@/lib/email';

export const sovCronFunction = inngest.createFunction(
  {
    id: 'sov-weekly-cron',
    // Concurrency: max 3 orgs processing simultaneously
    // (limits Perplexity API load)
    concurrency: { limit: 3 },
    // If the entire function fails, retry up to 3 times
    retries: 3,
  },
  { cron: 'TZ=America/New_York 0 2 * * 0' }, // Sunday 2 AM EST
  async ({ step }) => {
    // Step 1: Fetch all eligible queries (one DB call, idempotent)
    const orgBatches = await step.run('fetch-eligible-queries', async () => {
      const supabase = createServiceRoleClient() as any;
      
      const { data: queries, error } = await supabase
        .from('target_queries')
        .select(`
          id, query_text, location_id, org_id,
          locations ( business_name, city, state ),
          organizations ( plan_status, plan )
        `)
        .eq('organizations.plan_status', 'active')
        .limit(500);

      if (error) throw new Error(`DB error: ${error.message}`);
      if (!queries?.length) return [];

      // Group by org and apply plan caps
      const byOrg: Record<string, any[]> = {};
      for (const q of queries) {
        if (!q.locations || q.organizations?.plan_status !== 'active') continue;
        const key = q.org_id;
        if (!byOrg[key]) byOrg[key] = [];
        byOrg[key].push(q);
      }

      return Object.entries(byOrg).map(([orgId, orgQueries]) => {
        const plan = orgQueries[0]?.organizations?.plan ?? 'starter';
        const cap = plan === 'agency' ? 100 : plan === 'growth' ? 30 : 15;
        return {
          orgId,
          plan,
          queries: orgQueries.slice(0, cap).map((q: any) => ({
            id: q.id,
            query_text: q.query_text,
            location_id: q.location_id,
            business_name: q.locations?.business_name,
            city: q.locations?.city,
            state: q.locations?.state,
          })),
        };
      });
    });

    if (!orgBatches.length) return { orgs_processed: 0 };

    // Step 2: Fan out — one step per org (each gets its own timeout + retry)
    const results = await Promise.all(
      orgBatches.map((batch) =>
        step.run(`sov-org-${batch.orgId}`, async () => {
          return await processOrgSOV(batch);
        })
      )
    );

    // Step 3: Aggregate summary
    const summary = {
      orgs_processed: results.filter(r => r.success).length,
      orgs_failed: results.filter(r => !r.success).length,
      total_queries: results.reduce((sum, r) => sum + r.queriesRun, 0),
      total_cited: results.reduce((sum, r) => sum + r.queriesCited, 0),
      total_first_movers: results.reduce((sum, r) => sum + r.firstMoverAlerts, 0),
    };

    return summary;
  }
);
```

**2b. Per-org SOV processor** — helper function in the same file

```typescript
async function processOrgSOV(batch: {
  orgId: string;
  plan: string;
  queries: Array<{
    id: string;
    query_text: string;
    location_id: string;
    business_name: string;
    city: string;
    state: string;
  }>;
}): Promise<{
  success: boolean;
  queriesRun: number;
  queriesCited: number;
  firstMoverAlerts: number;
}> {
  const supabase = createServiceRoleClient() as any;
  const results: SOVQueryResult[] = [];
  let queriesCited = 0;

  // Process queries with rate limiting (sequential within an org)
  for (const query of batch.queries) {
    try {
      const result = await runSOVQuery(query as SOVQueryInput);
      results.push(result);
      if (result.ourBusinessCited) queriesCited++;
    } catch (err) {
      console.error(`[sov] Query "${query.query_text}" failed:`, err);
      // Individual query failure doesn't kill the org — continue
    }
    // Rate limit: 500ms between Perplexity calls
    await new Promise(r => setTimeout(r, 500));
  }

  if (results.length === 0) {
    return { success: false, queriesRun: 0, queriesCited: 0, firstMoverAlerts: 0 };
  }

  // Write results (same pure service function)
  const { firstMoverCount } = await writeSOVResults(batch.orgId, results, supabase);

  // Send email report (fire-and-forget, don't fail the step)
  try {
    const { data: membershipRow } = await supabase
      .from('memberships')
      .select('users(email)')
      .eq('org_id', batch.orgId)
      .eq('role', 'owner')
      .limit(1)
      .maybeSingle();

    const ownerEmail = (membershipRow?.users as { email: string } | null)?.email;
    if (ownerEmail) {
      await sendSOVReport({
        to: ownerEmail,
        businessName: batch.queries[0]?.business_name ?? 'Your Business',
        shareOfVoice: Math.round((queriesCited / results.length) * 100),
        queriesRun: results.length,
        queriesCited,
        firstMoverCount,
        dashboardUrl: 'https://app.localvector.ai/dashboard/share-of-voice',
      });
    }
  } catch (emailErr) {
    console.error(`[sov] Email failed for org ${batch.orgId}:`, emailErr);
  }

  return {
    success: true,
    queriesRun: results.length,
    queriesCited,
    firstMoverAlerts: firstMoverCount,
  };
}
```

**What changes vs. the current cron:**
- Each org runs as a separate Inngest step → own timeout, own retry
- Orgs process in parallel (up to 3 concurrent via `concurrency.limit`)
- If org 3 fails, Inngest retries just org 3 — orgs 1-2 results are already committed
- The entire flow is visible in the Inngest dashboard
- No more Vercel function timeout risk (each step is ≤60s)

#### Phase 3: AI Audit Cron → Inngest Function

**3a. Audit fan-out function** — `lib/inngest/functions/audit-cron.ts`

Same pattern. Two phases that currently run sequentially can now fan out:

```
Phase A: Hallucination audit (per-org, parallel)
Phase B: Competitor intercepts (per-org × per-competitor, parallel)
```

Key changes:
- Phase A and Phase B fan out independently (no longer sequential)
- Each `auditLocation()` call is its own step → retries on GPT-4o failure
- Each `runInterceptForCompetitor()` is its own step → retries on Perplexity/GPT-4o-mini failure
- Concurrency limit of 5 (to respect OpenAI rate limits)

```typescript
export const auditCronFunction = inngest.createFunction(
  {
    id: 'audit-daily-cron',
    concurrency: { limit: 5 },
    retries: 3,
  },
  { cron: 'TZ=America/New_York 0 3 * * *' }, // Daily 3 AM EST
  async ({ step }) => {
    // Step 1: Fetch orgs
    const orgs = await step.run('fetch-audit-orgs', async () => {
      const supabase = createServiceRoleClient() as any;
      const { data } = await supabase
        .from('organizations')
        .select('id, name')
        .in('plan', ['growth', 'agency'])
        .eq('plan_status', 'active');
      return data ?? [];
    });

    if (!orgs.length) return { orgs_found: 0 };

    // Step 2: Fan out hallucination audits (one step per org)
    const auditResults = await Promise.all(
      orgs.map(org =>
        step.run(`audit-org-${org.id}`, () => processOrgAudit(org))
      )
    );

    // Step 3: Fan out competitor intercepts (one step per org)
    const interceptResults = await Promise.all(
      orgs.map(org =>
        step.run(`intercept-org-${org.id}`, () => processOrgIntercepts(org))
      )
    );

    return {
      audits: auditResults.filter(r => r.success).length,
      intercepts: interceptResults.reduce((sum, r) => sum + r.count, 0),
    };
  }
);
```

#### Phase 4: Content Audit Cron → Inngest Function

**4a. Content audit fan-out** — `lib/inngest/functions/content-audit-cron.ts`

The content audit is the most timeout-prone (50 pages × 1s each = 50s per location). With Inngest:

- Each location is a separate step (own timeout)
- Pages within a location are processed sequentially (1s rate limit for polite crawling)
- But locations process in parallel (up to 3 concurrent to avoid hammering the same site)

#### Phase 5: Slim Down Existing Cron Routes

**CRITICAL: Don't delete the existing cron routes.** They become thin dispatchers:

**`app/api/cron/sov/route.ts`** — transforms from 150-line orchestrator to 15-line event sender:

```typescript
export async function GET(request: NextRequest) {
  // Auth guard (unchanged)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Kill switch (unchanged)
  if (process.env.STOP_SOV_CRON === 'true') {
    return NextResponse.json({ ok: true, halted: true });
  }

  // Dispatch to Inngest (replaces the entire for...of loop)
  await inngest.send({ name: 'cron/sov.weekly', data: {} });

  return NextResponse.json({ ok: true, dispatched: true });
}
```

Same pattern for audit and content-audit crons.

**Why keep the cron routes at all?**
- Vercel Cron still calls them on schedule — they're the trigger
- CRON_SECRET auth guard stays in place (Inngest functions don't need separate auth — they're invoked internally)
- Kill switches still work
- Backward compatible — if Inngest is down, you can temporarily revert to the old loop

#### Phase 6: Post-Publish Measurement via Inngest

The Autopilot Engine (Task 5) needs to schedule a SOV re-check 14 days after publishing a draft. Currently spec'd as a Redis key with TTL. With Inngest, this is cleaner:

```typescript
export const postPublishCheckFunction = inngest.createFunction(
  { id: 'post-publish-sov-check' },
  { event: 'publish/post-publish-check' },
  async ({ event, step }) => {
    // Wait 14 days (Inngest handles this natively — no Redis TTL)
    await step.sleep('wait-14-days', '14d');

    // Run the SOV query
    const result = await step.run('recheck-sov', async () => {
      const supabase = createServiceRoleClient() as any;
      // ... run SOV query for event.data.targetQuery
      // ... compare with pre-publish state
      // ... send celebration/waiting email
    });

    return result;
  }
);
```

This replaces the Redis-based scheduling in `lib/autopilot/post-publish.ts`. Inngest's `step.sleep('14d')` is durable — it survives deploys, restarts, and infrastructure changes.

#### Phase 7: Future Sub-Steps as Separate Inngest Functions

When the Occasion Engine, Prompt Intelligence, and Citation Intelligence crons are built, they each become their own Inngest function rather than sub-steps jammed into the SOV cron:

- `occasion/check.weekly` — triggered after SOV completes (via `inngest.send()` at end of SOV function)
- `prompt-intelligence/detect.weekly` — triggered after SOV completes
- `citation/sample.monthly` — its own cron schedule

This prevents the SOV cron from becoming a monolithic god function.

### Files to Create

| File | Purpose |
|------|---------|
| `lib/inngest/client.ts` | Inngest client instance (`id: 'localvector'`) |
| `lib/inngest/events.ts` | TypeScript event type definitions for all queue events |
| `lib/inngest/functions/sov-cron.ts` | SOV weekly fan-out function (replaces the for...of loop) |
| `lib/inngest/functions/audit-cron.ts` | AI Audit daily fan-out (hallucinations + intercepts) |
| `lib/inngest/functions/content-audit-cron.ts` | Content Audit monthly fan-out (per-location pages) |
| `lib/inngest/functions/post-publish-check.ts` | Durable 14-day sleep → SOV re-check after publish |
| `app/api/inngest/route.ts` | Inngest webhook handler (serves all functions) |
| `src/__tests__/unit/inngest-sov-cron.test.ts` | Unit tests for SOV fan-out logic |
| `src/__tests__/unit/inngest-audit-cron.test.ts` | Unit tests for audit fan-out logic |
| `src/__tests__/unit/inngest-content-audit-cron.test.ts` | Unit tests for content audit fan-out |

### Files to Modify

| File | Change |
|------|--------|
| `package.json` | Add `inngest` dependency |
| `app/api/cron/sov/route.ts` | **Slim down** from 150-line orchestrator to 15-line Inngest event dispatcher. Keep auth guard + kill switch. Add `import { inngest } from '@/lib/inngest/client'` and replace the for...of loop with `inngest.send({ name: 'cron/sov.weekly' })`. |
| `app/api/cron/audit/route.ts` | Same slim-down pattern — dispatch `cron/audit.daily` event |
| `app/api/cron/content-audit/route.ts` | Same slim-down pattern — dispatch `cron/content-audit.monthly` event |
| `src/__tests__/unit/cron-sov.test.ts` | Update to test the slim dispatcher (verify it sends Inngest event). Existing orchestration tests move to `inngest-sov-cron.test.ts`. |
| `src/__tests__/unit/cron-audit.test.ts` | Same — test slim dispatcher |
| `.env.example` | Add `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` |

### Migration Strategy (Zero-Downtime)

This is a high-risk refactor — every automated pipeline is affected. Here's the safe rollout:

**Step 1: Ship Inngest alongside existing crons (dual-write period)**

Both systems run simultaneously. The existing cron routes continue executing their for...of loops AND dispatch an Inngest event. The Inngest functions run but their results are logged, not written to the DB. This validates that Inngest produces the same results as the direct loop.

```typescript
// In the slim cron route during dual-write:
// 1. Run existing loop (production path)
const summary = await runExistingLoop(supabase, validQueries);
// 2. Also dispatch to Inngest (shadow path — logs only)
await inngest.send({ name: 'cron/sov.weekly', data: {} });
return NextResponse.json(summary);
```

**Step 2: Compare results**

After 2-3 cron cycles, compare Inngest dashboard results with the existing cron's JSON summaries. Verify:
- Same number of orgs processed
- Same number of queries run
- Same SOV scores written
- Same First Mover drafts created

**Step 3: Flip to Inngest-primary**

Remove the existing loop from the cron route. The cron route becomes a thin dispatcher. Inngest functions write to the DB.

**Step 4: Clean up**

Remove the dual-write code and the old orchestration logic from the cron routes.

### Architecture Constraints

**1. Services stay pure.** The Inngest functions call the exact same service functions (`runSOVQuery`, `writeSOVResults`, `auditLocation`, `runInterceptForCompetitor`, `auditPage`). No service code changes.

**2. Service-role client per step.** Each `step.run()` creates its own `createServiceRoleClient()` — Supabase clients can't be serialized across step boundaries.

**3. Concurrency limits respect API rate limits:**
- SOV: `concurrency.limit: 3` (Perplexity allows ~10 req/s, 3 orgs × 2 req/s each = safe)
- Audit: `concurrency.limit: 5` (OpenAI allows ~60 req/min on pay-as-you-go)
- Content Audit: `concurrency.limit: 3` (polite crawling — don't hammer tenant websites)

**4. Step IDs must be deterministic and unique.** `sov-org-${orgId}` ensures re-running the function skips already-completed orgs (Inngest idempotency).

**5. AI_RULES §17 still applies.** If Inngest is unavailable (e.g., network issue), the cron route should fall back to the existing loop. Add a try/catch around `inngest.send()`:

```typescript
try {
  await inngest.send({ name: 'cron/sov.weekly', data: {} });
  return NextResponse.json({ ok: true, dispatched: true });
} catch (inngestErr) {
  console.error('[cron-sov] Inngest dispatch failed, running inline:', inngestErr);
  // Fall back to existing loop
  return await runExistingLoop(request);
}
```

**6. No new database tables.** Inngest manages its own state. No migration needed.

**7. Inngest dev server for local testing.** Add `npx inngest-cli dev` to the dev workflow. The dev server provides a local dashboard at `http://localhost:8288` for inspecting events and step execution.

### Safety & Reliability

**1. Retry policy per function:**
- SOV: 3 retries with exponential backoff (default). Individual query failures within a step don't trigger function-level retry — they're caught by the per-query try/catch.
- Audit: 3 retries. GPT-4o timeouts are the most common failure.
- Content Audit: 2 retries. Page fetch failures are expected (404s, timeouts).

**2. Dead letter behavior.** After all retries are exhausted, Inngest marks the function as failed. Set up an Inngest failure handler to send a Slack/email alert:

```typescript
inngest.createFunction(
  { id: 'alert-on-failure' },
  { event: 'inngest/function.failed' },
  async ({ event }) => {
    // Send alert to ops team
    await sendOpsAlert(`Inngest function ${event.data.function_id} failed after all retries`);
  }
);
```

**3. Idempotency guarantees:**
- `sov_evaluations.insert()` — creates new row each run (OK, we want history)
- `visibility_analytics.upsert()` — `onConflict: 'org_id,location_id,snapshot_date'` prevents duplicates (safe to retry)
- `content_drafts.upsert()` — `onConflict: 'trigger_type,trigger_id'` with `ignoreDuplicates: true` (safe to retry)
- `ai_hallucinations.insert()` — creates new rows (could create duplicates on retry). Consider adding a `run_id` column to deduplicate.
- `page_audits.upsert()` — `onConflict: 'org_id,page_url'` prevents duplicates (safe to retry)

**4. ai_hallucinations duplicate risk.** This is the one table where retries could create duplicates. Two options:
- Option A: Add a `cron_run_id` column and check before inserting (requires migration)
- Option B: Accept that duplicates are possible but harmless (the dashboard shows latest hallucinations, duplicates don't affect the count materially)
- **Recommendation: Option B for now.** Add a note in the code. Address with Option A if it becomes a problem.

**5. Cost.** Inngest free tier: 25,000 events/month. With 100 tenants:
- SOV: 100 orgs × 4 weeks × ~32 events per org (fetch + org-step + write + email) ≈ 12,800 events
- Audit: 100 orgs × 30 days × ~5 events ≈ 15,000 events
- Content Audit: 100 orgs × 1/month × ~12 events ≈ 1,200 events
- Total: ~29,000/month → slightly over free tier. Growth plan ($50/month for 100K events) covers it. Start on free tier.

### Validation

After building:

1. **Local dev:** Start Inngest dev server (`npx inngest-cli dev`). Trigger SOV cron via curl. Verify events appear in Inngest dashboard at `http://localhost:8288`. Verify step execution shows per-org fan-out.

2. **Dual-write test:** Deploy with both paths active. After one SOV cron cycle, compare:
   - `visibility_analytics` rows from direct loop vs. Inngest
   - `sov_evaluations` count matches
   - First Mover `content_drafts` matches

3. **Timeout test:** Create a mock org with 60+ queries. Verify the Inngest function completes (would have timed out with the old cron).

4. **Retry test:** Mock `runSOVQuery` to fail for one org. Verify Inngest retries that step. Verify other orgs complete successfully.

5. **Kill switch:** Set `STOP_SOV_CRON=true`. Verify cron route returns `halted: true` and does NOT dispatch to Inngest.

6. **Inngest fallback:** Mock `inngest.send()` to throw. Verify the cron route falls back to the existing loop.

7. **`npm run test:unit`** — all tests pass (existing + new Inngest tests)

8. **E2E:** Existing Playwright tests unaffected (they don't test cron routes directly)

### Build Order

1. **Install Inngest** — `npm install inngest`
2. **Create client + events** (`lib/inngest/client.ts`, `lib/inngest/events.ts`) — no side effects
3. **Create API route** (`app/api/inngest/route.ts`) — webhook handler
4. **Build SOV cron function** (`lib/inngest/functions/sov-cron.ts`) — biggest, most critical
5. **Unit test SOV function** — mock services, verify fan-out + aggregation
6. **Dual-write in SOV cron route** — both paths active, Inngest in shadow mode
7. **Local validation** — Inngest dev server, compare results
8. **Build audit cron function** + tests
9. **Build content-audit cron function** + tests
10. **Build post-publish check function** (for Autopilot Engine)
11. **Slim down cron routes** — remove old loops, Inngest-primary
12. **Add failure alerting function**
13. **Deploy + monitor** — 2-3 cycles of dual-write comparison
14. **Clean up dual-write code** — final slim cron routes

### Edge Cases & Hardening

1. **Inngest Cloud outage.** If `inngest.send()` throws (network, Inngest down), the cron route must fall back to the existing inline loop. This means the old orchestration code stays as a fallback function, not deleted. Only the default path changes.

2. **Partial step completion on deploy.** If a new deployment happens mid-function-execution, Inngest handles this via step checkpointing. Steps that already completed are not re-run. But the `createServiceRoleClient()` must be called inside each step (not shared across steps) because the Supabase client can't survive serialization.

3. **Clock skew between Vercel Cron and Inngest Cron.** If using Inngest's built-in `{ cron: '...' }` trigger (recommended) instead of Vercel Cron → Inngest dispatch, remove the Vercel Cron schedule for that route to avoid double-firing. During the transition, use Vercel Cron → dispatch pattern. After validation, switch to Inngest-native cron.

4. **Event payload size.** Inngest events have a 512KB payload limit. The SOV fetch-eligible-queries step returns data as a step result (serialized). With 500 queries × ~200 bytes each = ~100KB — well within limits. But if query count grows, consider pagination.

5. **Concurrent runs.** Inngest prevents concurrent runs of the same function by default (via `concurrency`). But if Vercel Cron fires while a previous run is still executing, the second invocation queues. Set a reasonable timeout on the overall function to prevent zombie runs.

6. **Perplexity 429 rate limits.** Currently handled by `sleep(500)` between queries. With fan-out, multiple orgs hit Perplexity simultaneously. The `concurrency.limit: 3` controls this, but add a per-step `step.sleep('rate-limit', '500ms')` if needed.

7. **Email failures.** Currently wrapped in `.catch()` — maintain this in Inngest steps. Email failures must never fail a step (losing SOV data is worse than missing a report email).

8. **Sentry integration.** Inngest has a Sentry integration plugin. Add it to capture step-level errors in Sentry with full context:
```typescript
import { Inngest } from 'inngest';
import { sentryMiddleware } from '@inngest/middleware-sentry';

export const inngest = new Inngest({
  id: 'localvector',
  middleware: [sentryMiddleware()],
});
```

### Reference Documents

- `docs/04c-SOV-ENGINE.md §4` — SOV cron architecture and rate limiting
- `docs/04-INTELLIGENCE-ENGINE.md §3` — AI Audit pipeline (Fear + Greed engines)
- `docs/17-CONTENT-GRADER.md §3` — Content Audit cron
- `docs/19-AUTOPILOT-ENGINE.md §6` — Post-publish measurement scheduling
- `docs/AI_RULES.md §17` — Redis/KV graceful degradation (applies to Inngest fallback)
- `docs/11-TESTING-STRATEGY.md` — Test patterns for background jobs
- Inngest docs: https://www.inngest.com/docs — step functions, concurrency, cron triggers
