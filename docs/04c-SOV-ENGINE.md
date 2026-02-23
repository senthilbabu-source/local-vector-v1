# 04c — Share-of-Answer (SOV) Engine Specification
### Version: 1.0 | Date: February 23, 2026
### Companion to: 04-INTELLIGENCE-ENGINE.md (v2.4)

---

## ⚠️ Architectural Authority Notice

This document is the **authoritative spec** for the SOV Engine and all `sov_target_queries` table interactions.

- **Parent doc (04) is authoritative for:** Reality Score formula, engine architecture principles, cross-engine interfaces, cost budgets.
- **This doc (04c) is authoritative for:** SOV query taxonomy, cron job logic, share_of_voice calculation, prompt library management, SOV API endpoints, First Mover Alert pipeline.
- **Conflict resolution:** If this doc and Doc 04 contradict each other on SOV specifics, this doc wins. Flag the discrepancy and update Doc 04.

---

## 1. Why This Engine Exists

**The broken state (as of Phase 3 / v2.5):**

The `visibility_analytics` table has a `share_of_voice` column. The `visibility_scores` table has a `visibility_score` column. The Reality Score formula in Doc 04 Section 6 weights Visibility at 40%.

**None of these are populated by real data.** The `RealityScoreCard` component currently hardcodes `visibility = 98`. This means every tenant's Reality Score is significantly inflated, and the most meaningful product signal — "how often does AI mention your business?" — is completely dark.

The SOV Engine fixes this. It is the single system that:
1. Maintains a library of local-intent AI queries per location
2. Runs those queries on a weekly cron
3. Parses which businesses appear in AI answers
4. Writes real numbers to `visibility_analytics`
5. Unblocks the Reality Score Visibility component

**Business impact:** Once live, tenants will see their actual SOV score — likely 0–15% for most new users. This transforms the product from "dashboard that shows you're fine" to "dashboard that shows the real problem." That gap is the product's core value proposition.

---

## 2. The `sov_target_queries` Table

**Migration file:** `supabase/migrations/20260223000001_sov_engine.sql`

```sql
CREATE TABLE IF NOT EXISTS public.sov_target_queries (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id     UUID          NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,

  query_text      TEXT          NOT NULL,
  query_category  VARCHAR(50)   NOT NULL
    CHECK (query_category IN ('discovery', 'comparison', 'occasion', 'near_me', 'custom')),

  occasion_tag    VARCHAR(50)   NULL,
  intent_modifier VARCHAR(50)   NULL,

  is_system_generated  BOOLEAN  NOT NULL DEFAULT TRUE,
  is_active            BOOLEAN  NOT NULL DEFAULT TRUE,

  last_run_at          TIMESTAMPTZ  NULL,
  last_sov_result      FLOAT        NULL,
  last_cited           BOOLEAN      NULL,
  run_count            INTEGER      NOT NULL DEFAULT 0,

  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE(location_id, query_text)
);

CREATE INDEX IF NOT EXISTS idx_sov_queries_org
  ON public.sov_target_queries(org_id);

CREATE INDEX IF NOT EXISTS idx_sov_queries_location_active
  ON public.sov_target_queries(location_id, is_active)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_sov_queries_last_run
  ON public.sov_target_queries(last_run_at ASC NULLS FIRST);

CREATE TRIGGER set_updated_at_sov_target_queries
  BEFORE UPDATE ON public.sov_target_queries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.sov_target_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON public.sov_target_queries
  FOR SELECT USING (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_insert" ON public.sov_target_queries
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_update" ON public.sov_target_queries
  FOR UPDATE USING (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_delete" ON public.sov_target_queries
  FOR DELETE USING (org_id = public.current_user_org_id());
```

---

## 3. Query Taxonomy — The Prompt Library

Every location gets a seed set of system-generated queries at onboarding. Queries are structured by four orthogonal dimensions: **Base Intent**, **Geo Modifier**, **Occasion Tag**, and **Intent Modifier**.

### 3.1 System-Generated Query Templates

The `seedSOVQueries(locationId)` function generates queries from these templates at location setup, substituting `{category}`, `{city}`, `{state}` from the `locations` row.

**Tier 1 — Discovery (always generated, 4 queries):**
```
"best {category} in {city} {state}"
"top {category} near {city}"
"best {category} {city}"
"{category} recommendations {city} {state}"
```

**Tier 2 — Near Me (always generated, 3 queries):**
```
"{category} near me {city}"
"best {category} near me"
"{category} open now {city}"
```

**Tier 3 — Occasion (hospitality/restaurant categories only, 5 queries):**
```
"best place for date night {city}"
"birthday dinner {city}"
"bachelorette party venue {city}"
"girls night out {city}"
"romantic restaurant {city}"
```

**Tier 4 — Comparison (1 query per competitor, max 3):**
```
"best {category} in {city}: {myBusiness} vs {competitorName}"
```

**Total system-generated queries per location:** 12–15 depending on category and competitor count.

### 3.2 Custom Query Rules (Plan-Gated)

| Plan | Custom Query Limit |
|------|--------------------|
| Starter | 0 (system queries only) |
| Growth | +5 custom queries |
| Agency | +25 custom queries per location |

---

## 4. The SOV Cron Job

**Edge Function:** `supabase/functions/run-sov-cron/index.ts`
**Schedule:** Weekly, Sunday at 2 AM EST
**Trigger:** Vercel Cron → `POST /api/cron/sov` → calls Edge Function

### 4.1 Execution Logic

```typescript
async function runSOVCron() {
  const supabase = createServiceRoleClient();

  if (Deno.env.get('STOP_SOV_CRON') === 'true') {
    console.log('SOV Cron halted by kill switch.');
    return;
  }

  const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();

  const { data: queries } = await supabase
    .from('sov_target_queries')
    .select(`
      id, query_text, query_category, location_id, org_id,
      locations ( business_name, city, state ),
      organizations ( plan_status, plan )
    `)
    .eq('is_active', true)
    .or(`last_run_at.is.null,last_run_at.lt.${sixDaysAgo}`)
    .eq('organizations.plan_status', 'active')
    .limit(200);

  if (!queries?.length) return;

  const byOrg = groupBy(queries, q => q.org_id);

  for (const [orgId, orgQueries] of Object.entries(byOrg)) {
    const plan = orgQueries[0].organizations.plan;
    const queryCap = plan === 'starter' ? 15 : plan === 'growth' ? 30 : 100;
    const batch = orgQueries.slice(0, queryCap);
    const results: SOVQueryResult[] = [];

    for (const query of batch) {
      const result = await runSOVQuery(query);
      results.push(result);
      await sleep(500); // Rate limit Perplexity
    }

    await writeSOVResults(orgId, results, supabase);
  }
}
```

### 4.2 The SOV Prompt

```
Prompt to Perplexity Sonar:
"Answer this question a local person might ask: '{queryText}'

List ALL businesses you would recommend or mention in your answer.

Return ONLY a valid JSON object:
{
  "businesses": ["Business Name 1", "Business Name 2", "Business Name 3"],
  "cited_url": "https://yelp.com/... or null if no single authoritative source"
}

Include every business mentioned. Do not summarize. Be exhaustive."
```

### 4.3 Writing SOV Results to `visibility_analytics`

```typescript
async function writeSOVResults(
  orgId: string,
  results: SOVQueryResult[],
  supabase: SupabaseClient
) {
  const today = new Date().toISOString().split('T')[0];

  // Update per-query last_run state
  for (const result of results) {
    await supabase
      .from('sov_target_queries')
      .update({
        last_run_at: new Date().toISOString(),
        last_sov_result: result.ourBusinessCited ? 100 : 0,
        last_cited: result.ourBusinessCited,
      })
      .eq('id', result.queryId);
  }

  // Aggregate SOV: what % of queries cited our business?
  const citedCount = results.filter(r => r.ourBusinessCited).length;
  const shareOfVoice = results.length > 0 ? (citedCount / results.length) * 100 : 0;

  // Citation rate: of queries where we appeared, what % had a citation URL?
  const citedResults = results.filter(r => r.ourBusinessCited);
  const citationRate = citedResults.length > 0
    ? (citedResults.filter(r => r.citationUrl).length / citedResults.length) * 100
    : 0;

  await supabase
    .from('visibility_analytics')
    .upsert({
      org_id: orgId,
      location_id: results[0]?.locationId,
      share_of_voice: Math.round(shareOfVoice * 10) / 10,
      citation_rate: Math.round(citationRate * 10) / 10,
      snapshot_date: today,
    }, { onConflict: 'org_id,location_id,snapshot_date' });

  await checkFirstMoverAlerts(orgId, results, supabase);
}
```

---

## 5. Reality Score Visibility Component — Full Specification

This section **replaces** the hardcoded `98` placeholder in the current `RealityScoreCard` component.

### 5.1 Visibility Score Calculation

```typescript
// lib/scores/visibility.ts

async function calculateVisibilityScore(
  orgId: string,
  locationId: string,
  supabase: SupabaseClient
): Promise<number | null> {

  const { data: analytics } = await supabase
    .from('visibility_analytics')
    .select('share_of_voice, citation_rate')
    .eq('org_id', orgId)
    .eq('location_id', locationId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single();

  // No SOV data yet — return null so UI shows "Calculating..." not a fake number
  if (!analytics) return null;

  // Visibility = weighted average of SOV and citation rate
  return Math.round(
    (analytics.share_of_voice * 0.6 + analytics.citation_rate * 0.4) * 10
  ) / 10;
}
```

### 5.2 "Calculating" UI State

When `visibilityScore === null` (new tenant, cron hasn't run yet):

- Reality Score ring shows `--` with label "Calculating..."
- Tooltip: "Your AI Visibility score is being calculated. Check back Monday."
- Visibility card shows skeleton with copy: "We're running your first AI visibility scan. Results appear after Sunday's weekly scan."

**🤖 Agent Rule:** Never render a hardcoded fallback number. Always handle `null` from `calculateVisibilityScore()` by rendering the calculating state.

---

## 6. First Mover Alert Pipeline

Detects AI queries where NO local business is cited — an uncontested opportunity for the tenant to create content and own that prompt before competitors do.

### 6.1 Detection Logic

A "First Mover Opportunity" is a query where:
1. Our business was NOT cited
2. No other local business was cited either (AI answered generically)
3. The query category is `discovery`, `occasion`, or `near_me`

```typescript
async function checkFirstMoverAlerts(
  orgId: string,
  results: SOVQueryResult[],
  supabase: SupabaseClient
) {
  const opportunities = results.filter(r =>
    !r.ourBusinessCited &&
    r.businessesFound.length === 0 &&
    ['discovery', 'occasion', 'near_me'].includes(r.queryCategory)
  );

  if (opportunities.length === 0) return;

  for (const opp of opportunities) {
    await supabase.from('sov_first_mover_alerts').upsert({
      org_id: orgId,
      location_id: opp.locationId,
      query_id: opp.queryId,
      query_text: opp.queryText,
      detected_at: new Date().toISOString(),
      status: 'new',
    }, { onConflict: 'org_id,query_id' });
  }
}
```

### 6.2 `sov_first_mover_alerts` Table

```sql
-- Also in migration 20260223000001_sov_engine.sql

CREATE TABLE IF NOT EXISTS public.sov_first_mover_alerts (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID         NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id  UUID         REFERENCES public.locations(id),
  query_id     UUID         REFERENCES public.sov_target_queries(id) ON DELETE CASCADE,
  query_text   TEXT         NOT NULL,
  detected_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  status       VARCHAR(20)  NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'actioned', 'dismissed')),
  actioned_at  TIMESTAMPTZ  NULL,

  UNIQUE(org_id, query_id)
);

ALTER TABLE public.sov_first_mover_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON public.sov_first_mover_alerts
  FOR SELECT USING (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_update" ON public.sov_first_mover_alerts
  FOR UPDATE USING (org_id = public.current_user_org_id());
```

---

## 7. Weekly SOV Report Email

Triggered after the cron completes. Sent via Resend. Only sent if `share_of_voice` changed ≥ 2 points OR a new First Mover Alert exists.

**Subject:** `Your AI Visibility Report — Week of {date}`

**Body sections:**
1. **Your Score:** SOV % this week vs. last week with delta arrow.
2. **Where You Were Cited:** Queries where our business appeared.
3. **Where You're Missing:** Top 3 queries where competitors appeared but we didn't.
4. **First Mover Opportunity (conditional):** "AI isn't recommending anyone for '{query_text}'. Be first." → CTA: "Create Content Now"

---

## 8. API Endpoints

Full request/response specs are in Doc 05 Section 7.1. Summary:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sov/queries` | List active queries for current org/location |
| `POST` | `/api/sov/queries` | Add custom query (Growth+ only) |
| `DELETE` | `/api/sov/queries/:id` | Deactivate a query |
| `GET` | `/api/sov/report` | Latest SOV results + trend data |
| `GET` | `/api/sov/alerts` | First Mover Alerts (status: 'new') |
| `POST` | `/api/sov/alerts/:id/dismiss` | Mark alert dismissed |
| `POST` | `/api/cron/sov` | Internal Vercel Cron trigger (service role only) |

---

## 9. Cost Budget

| Item | Per Location Per Week | Annual Per Tenant |
|------|----------------------|--------------------|
| 15 Perplexity queries (Starter) | $0.075 | ~$3.90 |
| 30 Perplexity queries (Growth) | $0.15 | ~$7.80 |
| Weekly email (conditional) | $0.001 | ~$0.05 |

**Margin impact:** < $0.50/month/tenant. Negligible.

---

## 10. TypeScript Interfaces

```typescript
// src/lib/types/sov.ts

export type QueryCategory = 'discovery' | 'comparison' | 'occasion' | 'near_me' | 'custom';

export interface SOVTargetQuery {
  id: string;
  orgId: string;
  locationId: string;
  queryText: string;
  queryCategory: QueryCategory;
  occasionTag: string | null;
  intentModifier: string | null;
  isSystemGenerated: boolean;
  isActive: boolean;
  lastRunAt: string | null;
  lastSovResult: number | null;    // 0–100
  lastCited: boolean | null;
  runCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SOVReport {
  orgId: string;
  locationId: string;
  snapshotDate: string;
  shareOfVoice: number;            // 0–100
  citationRate: number;            // 0–100
  queriesRun: number;
  queriesCited: number;
  topCitedQuery: string | null;
  firstMoverAlerts: SOVFirstMoverAlert[];
  weekOverWeekDelta: number | null;
}

export interface SOVFirstMoverAlert {
  id: string;
  queryId: string;
  queryText: string;
  detectedAt: string;
  status: 'new' | 'actioned' | 'dismissed';
}
```

---

## 11. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-23 | Initial release. `sov_target_queries` table, weekly cron, Reality Score Visibility fix (replaces hardcoded 98), First Mover Alert pipeline, TypeScript interfaces, cost budget. |
