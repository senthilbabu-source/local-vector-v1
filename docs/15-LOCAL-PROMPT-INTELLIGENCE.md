# 15 — Local Prompt Intelligence
## The AI Query Library: Discovery, Gap Detection, and Competitive Prompt Monitoring
### Version: 1.0 | Date: February 23, 2026
### Companion to: 04c-SOV-ENGINE.md, 04-INTELLIGENCE-ENGINE.md

---

## ⚠️ Architectural Authority Notice

- **Doc 04c (SOV Engine) is authoritative for:** `sov_target_queries` table DDL, weekly cron execution, `writeSOVResults()`, First Mover Alert pipeline, SOV-to-Visibility score mapping.
- **This doc (15) is authoritative for:** Prompt taxonomy (all query categories and templates), gap detection algorithm, competitive prompt monitoring rules, custom query management UX, query performance analytics, and the "Prompt Gap Report" email.
- **Conflict resolution:** If this doc and Doc 04c contradict each other on query taxonomy or gap logic, this doc wins. Flag and update Doc 04c.

---

## 1. Why Prompt Intelligence Is a Standalone Engine

The SOV Engine (Doc 04c) answers: *"Is our business cited when AI runs these queries?"*

The Prompt Intelligence layer answers: *"Are we tracking the right queries in the first place — and what queries are we missing entirely?"*

These are different problems. The SOV cron is a measurement loop. Prompt Intelligence is a strategic layer on top of it — ensuring the query library covers every angle a customer might use when discovering the business via AI, and surfacing when that library has gaps.

**The gap categories:**
1. **Untracked query gap** — A high-value query type exists for the category+city but isn't in the tenant's library yet (system failed to seed it, or the category evolved)
2. **Competitor-discovered gap** — A competitor is being cited for queries we've never thought to track
3. **Occasion gap** — Peak seasonal queries (Valentine's, etc.) aren't in the library before the occasion fires
4. **Zero-citation cluster** — A group of related queries all returning 0 citations for our business, suggesting a content gap, not a tracking gap

---

## 2. Query Taxonomy (Complete Reference)

All `sov_target_queries` rows belong to one of five categories. This is the authoritative taxonomy — all seeding logic, UI labels, and cron group assignments reference these category names exactly.

### 2.1 Category: `discovery`

Intent: "Find me a [business type] in [location]." The broadest, highest-traffic query class. These are the queries that produce AI Overview results and Perplexity citations.

**System templates (substitution: `{category}`, `{city}`, `{state}`):**

| Priority | Template | Example |
|----------|----------|---------|
| 1 | `best {category} in {city} {state}` | "best hookah lounge in Alpharetta GA" |
| 2 | `top {category} in {city}` | "top hookah lounge in Alpharetta" |
| 3 | `{category} {city} {state}` | "hookah lounge Alpharetta GA" |
| 4 | `best {category} {city}` | "best hookah lounge Alpharetta" |

**Seeding rule:** All 4 templates generated for every location. No plan gating — these are the baseline queries every tenant needs.

### 2.2 Category: `near_me`

Intent: "I'm nearby right now, find me something open." High-intent, time-sensitive. AI models often rely on GBP operational status for these.

**System templates:**

| Priority | Template | Example |
|----------|----------|---------|
| 1 | `{category} open now {city}` | "hookah lounge open now Alpharetta" |
| 2 | `{category} open late {city}` | "hookah lounge open late Alpharetta" |
| 3 | `{category} near {city}` | "hookah lounge near Alpharetta" |

**Seeding rule:** All 3 templates generated. `near_me` queries correlate most strongly with the `operational_status` and `hours_data` fields on the `locations` table — a misconfigured hours field will cause 0-citation results on these queries even if the business is well-known.

### 2.3 Category: `occasion`

Intent: "I'm planning [specific event], where should we go?" High-value because the user has high purchase intent and is actively choosing a venue. AI answers for occasion queries tend to be more narrative and cite fewer sources — which makes First Mover opportunities more common.

**System templates (hospitality-specific, only seeded for relevant categories):**

| Priority | Template | Occasion Tag | Example |
|----------|----------|--------------|---------|
| 1 | `best place for date night {city}` | `date_night` | "best place for date night Alpharetta" |
| 2 | `birthday dinner {city}` | `birthday` | "birthday dinner Alpharetta" |
| 3 | `bachelorette party venue {city} {state}` | `bachelorette` | "bachelorette party venue Alpharetta GA" |
| 4 | `graduation dinner {city}` | `graduation` | "graduation dinner Alpharetta" |
| 5 | `anniversary restaurant {city}` | `anniversary` | "anniversary restaurant Alpharetta" |

**Seeding rule:** Seeded only for locations whose `categories` array includes at least one of: `restaurant`, `bar`, `lounge`, `hookah`, `event venue`, `nightclub`. The Occasion Engine (Doc 16) manages seasonal timing; these queries run in the standard weekly SOV cron regardless of season.

### 2.4 Category: `comparison`

Intent: "Is [Business A] better than [Business B]?" or "Who is the best [X] in [city]?" These queries directly reveal competitive positioning and are the highest-signal data for the Greed Engine.

**System templates (generated per competitor, max 3 competitors per Growth plan):**

| Template | Example |
|----------|---------|
| `{my_business} vs {competitor} {city}` | "Charcoal N Chill vs Cloud 9 Lounge Alpharetta" |
| `is {my_business} good {city}` | "is Charcoal N Chill good Alpharetta" |
| `{my_business} or {competitor}` | "Charcoal N Chill or Cloud 9 Lounge" |

**Seeding rule:** Comparison queries are only generated when at least 1 competitor is added in the Greed Engine. They are re-seeded automatically when a new competitor is added (`addCompetitor` Server Action). Max 1 query per competitor pair.

### 2.5 Category: `custom`

Intent: Anything the tenant identifies that isn't covered by system templates. Plan-gated.

**Plan limits:**
- Starter: 0 custom queries
- Growth: 5 custom queries
- Agency: 25 custom queries per location

**Validation rules (enforced at `POST /api/sov/queries`):**
- Max 200 characters
- Must not duplicate an existing active query for the location
- No `{placeholder}` substitution variables allowed (user enters final text)
- Must be a realistic AI search query (no URLs, no "@" handles)

---

## 3. Gap Detection Algorithm

Runs as a sub-step after each weekly SOV cron completes. Compares the current query library against a reference library of known high-value query patterns for the tenant's category+city.

### 3.1 Reference Library

The reference library is the superset of all query templates in Section 2, instantiated for the tenant's `category` + `city` + `state`. It also includes queries discovered via the Competitor-Discovery method (Section 3.2).

```typescript
// lib/prompt-intelligence/gap-detector.ts

interface QueryGap {
  gapType: 'untracked' | 'competitor_discovered' | 'zero_citation_cluster';
  queryText: string;
  queryCategory: QueryCategory;
  estimatedImpact: 'high' | 'medium' | 'low';
  suggestedAction: string;
}

async function detectQueryGaps(locationId: string): Promise<QueryGap[]> {
  const [activeQueries, referenceQueries, competitorIntercepts] = await Promise.all([
    getActiveQueriesForLocation(locationId),
    buildReferenceLibrary(locationId),
    getRecentCompetitorIntercepts(locationId),
  ]);

  const gaps: QueryGap[] = [];

  // Gap type 1: Untracked — in reference library but not in active queries
  for (const refQuery of referenceQueries) {
    const isTracked = activeQueries.some(q => q.queryText === refQuery.queryText);
    if (!isTracked) {
      gaps.push({
        gapType: 'untracked',
        queryText: refQuery.queryText,
        queryCategory: refQuery.queryCategory,
        estimatedImpact: refQuery.priority <= 2 ? 'high' : 'medium',
        suggestedAction: `Add "${refQuery.queryText}" to your tracking library.`,
      });
    }
  }

  // Gap type 2: Competitor-discovered — competitor is cited for queries we don't track
  for (const intercept of competitorIntercepts) {
    const queryTracked = activeQueries.some(q => q.queryText === intercept.queryAsked);
    if (!queryTracked && intercept.winner !== 'our_business') {
      gaps.push({
        gapType: 'competitor_discovered',
        queryText: intercept.queryAsked,
        queryCategory: 'comparison',
        estimatedImpact: 'high',
        suggestedAction: `${intercept.competitorName} is winning this query. Track it to measure your progress.`,
      });
    }
  }

  // Gap type 3: Zero-citation cluster — 3+ related queries all returning 0
  const zeroCitationQueries = activeQueries.filter(q => q.lastCited === false && q.runCount >= 2);
  if (zeroCitationQueries.length >= 3) {
    const cluster = zeroCitationQueries.slice(0, 5);
    gaps.push({
      gapType: 'zero_citation_cluster',
      queryText: cluster.map(q => q.queryText).join(', '),
      queryCategory: cluster[0].queryCategory,
      estimatedImpact: 'high',
      suggestedAction: 'Multiple tracked queries are returning zero citations. This suggests a content gap, not a tracking gap — consider creating a page that directly answers these queries.',
    });
  }

  return gaps.slice(0, 10); // Cap at 10 gaps per run — prevent alert fatigue
}
```

### 3.2 Competitor-Discovery Method

When the Greed Engine runs an intercept and the AI mentions a query we aren't tracking, the intercept result contains the `queryAsked` field. The gap detector scans these intercepts for queries not in the active library. This creates a feedback loop:

```
Greed Engine detects: "Cloud 9 wins 'best late night hookah Alpharetta'"
↓
Gap detector sees: "best late night hookah Alpharetta" not in sov_target_queries
↓
Gap Report surfaces: "Competitor-discovered gap: add this query to track your progress"
↓
User adds query (Growth+) → next SOV cron picks it up → Visibility score reflects it
```

### 3.3 Gap Scoring

Gaps are ranked by `estimatedImpact` which is determined by:

| Signal | High Impact | Medium Impact | Low Impact |
|--------|-------------|---------------|------------|
| Query category | `discovery` (broadest reach) | `near_me`, `occasion` | `comparison`, `custom` |
| Competitor discovered | Yes | — | No |
| Priority rank in template | ≤ 2 | 3–4 | 5+ |
| Zero-citation cluster size | ≥ 5 queries | 3–4 queries | — |

---

## 4. Prompt Gap Report (Weekly Email)

Sent alongside the SOV Report email (Doc 04c Section 7) when `gaps.length > 0`. Only sent if gaps are **new** since the last report (prevents repeat noise on the same gap).

**Subject:** `You're missing 3 AI queries this week — {business_name}`

**Body sections:**
1. **Your coverage this week** — `X of Y reference queries tracked`
2. **Gaps found** — list of top 3 gaps with `suggestedAction` copy
3. **Quick add** — For Growth+ users: deep link to `/visibility` with the gap pre-filled in the Add Query form
4. **Zero-citation cluster call-out** (conditional) — "These 4 queries all returned 0 results for you. This is a content problem, not a tracking problem. [Create content →]"

**Implementation note:** Prompt Gap Report is part of the same Resend email send as the SOV Report. They arrive in one email — not two separate messages.

---

## 5. Query Performance Analytics

The `/visibility` page (Doc 06 Section 8) surfaces query-level performance. These are the computed fields the UI needs from the `sov_target_queries` table.

### 5.1 Per-Query Metrics

| Metric | Source | Display |
|--------|--------|---------|
| Cited / Not Cited | `last_cited` | ✅ / ❌ icon |
| SOV Score | `last_sov_result` | 0–100 badge |
| Run Count | `run_count` | "Run X times" tooltip |
| Last Run | `last_run_at` | "3 days ago" relative time |
| Category | `query_category` | Color-coded pill |

### 5.2 Aggregate Metrics (from `visibility_analytics`)

| Metric | Formula | Display |
|--------|---------|---------|
| Overall SOV | `share_of_voice` | Ring chart, 0–100% |
| Citation Rate | `citation_rate` | Secondary metric below ring |
| Week-over-week delta | Current vs previous `snapshot_date` | ▲/▼ arrow with Δ value |
| Queries cited | `(queries cited / queries run) × 100` | "3 of 13 queries" |

### 5.3 Category Breakdown (Growth+ only)

A secondary breakdown showing SOV by query category. Surfaces which category has the biggest gap.

```
Discovery:   ████████░░░░  67% cited (4/6)
Near Me:     ███░░░░░░░░░  33% cited (1/3)
Occasion:    ░░░░░░░░░░░░   0% cited (0/3)  ← content gap signal
Comparison:  ██░░░░░░░░░░  33% cited (1/3)
```

Implemented as a simple bar chart using the existing Recharts library. Data computed client-side from the `GET /api/sov/queries` response — no new endpoint needed.

---

## 6. Custom Query Management UX

**Detailed spec for the Add Custom Query flow** (summarized in Doc 06 Section 8.4 — this section is authoritative).

### 6.1 Add Query Form Behavior

Triggered by "+" button in the Query Library table. Growth+ only — Starter sees `<PlanGate featureId="sov_custom_queries" />`.

```
Step 1 — Input
  Query text field (max 200 chars, live character count)
  Category dropdown (discovery | near_me | occasion | comparison | custom)
  Occasion tag field (appears only when category = 'occasion')
  
  Live duplicate check: as user types, debounced GET /api/sov/queries?q=... 
  shows "Already tracking this query" inline warning without form submission.

Step 2 — Validation feedback (on submit)
  409 Conflict → "Already tracking this query"
  422 Limit reached → PlanGate modal
  201 Created → query row animates into table with "New" badge for 5 seconds

Step 3 — Quota display
  Always visible below the form: "X of Y custom queries used (Plan)"
```

### 6.2 Deactivate / Delete Query

- System queries: can be **deactivated** (toggle `is_active = false`) but not deleted. A deactivated system query stops running in the cron but remains in the table so re-activation is possible.
- Custom queries: can be **deleted** (`DELETE /api/sov/queries/:id` sets `is_active = false`). Hard deletes are not performed — keeps run history intact for analytics.

**Deactivate confirmation modal copy:**
> "Deactivating this query stops tracking it. Your historical data is kept. You can re-activate it any time."

---

## 7. Integration Points

| System | Integration |
|--------|-------------|
| SOV Cron (Doc 04c) | Queries this engine's library as input. Writes `last_run_at`, `last_sov_result`, `last_cited` back. |
| Greed Engine (Doc 04) | `queryAsked` from intercepts feeds the competitor-discovery gap detection (Section 3.2). |
| Occasion Engine (Doc 16) | Occasion queries are seeded by Doc 16's `local_occasions` taxonomy and surfaced in this library under `category: 'occasion'` |
| Content Grader (Doc 17) | Zero-citation clusters detected here → content gap signal → triggers Content Grader recommendation to create a new page |
| Autopilot Engine (Doc 19) | `zero_citation_cluster` gaps feed Autopilot trigger type `prompt_missing` → auto-generates content draft |
| Visibility Dashboard (Doc 06 §8) | Query library table and category breakdown charts rendered from this engine's data |

---

## 8. API Endpoints

All endpoints defined in Doc 05 Section 12. This section provides implementation notes only.

### 8.1 `GET /api/sov/queries`

**Implementation note:** Response should include computed `gapCount` field (number of gaps detected for this location from the last gap detection run). This powers the "Gaps found" badge on the Visibility dashboard without requiring a separate API call.

### 8.2 `POST /api/sov/queries`

**Implementation note:** After successful insert, trigger `detectQueryGaps(locationId)` asynchronously (non-blocking). This refreshes the gap report so the UI reflects the reduced gap count immediately on the next page load.

### 8.3 Gap Report Endpoint (NEW — not in Doc 05)

`GET /api/sov/gaps` — returns the latest gap analysis for the org.

**Response:**
```json
{
  "gaps": [
    {
      "gapType": "untracked",
      "queryText": "hookah bar open late Alpharetta GA",
      "queryCategory": "near_me",
      "estimatedImpact": "high",
      "suggestedAction": "Add this query to your tracking library."
    }
  ],
  "totalGaps": 3,
  "lastAnalyzedAt": "2026-02-23T02:30:00Z"
}
```

**🤖 Agent Rule:** Add `GET /api/sov/gaps` to Doc 05 Section 12 when implementing Phase 5. This was identified after Doc 05 was finalized.

---

## 9. TypeScript Interfaces

```typescript
// src/lib/types/prompt-intelligence.ts

export type GapType = 'untracked' | 'competitor_discovered' | 'zero_citation_cluster';
export type GapImpact = 'high' | 'medium' | 'low';

export interface QueryGap {
  gapType: GapType;
  queryText: string;
  queryCategory: QueryCategory;  // from src/lib/types/sov.ts
  estimatedImpact: GapImpact;
  suggestedAction: string;
}

export interface PromptGapReport {
  locationId: string;
  orgId: string;
  totalActiveQueries: number;
  totalReferenceQueries: number;
  coveragePercent: number;           // (active / reference) * 100
  gaps: QueryGap[];
  categoryBreakdown: Record<QueryCategory, {
    citedCount: number;
    totalCount: number;
    citationRate: number;
  }>;
  generatedAt: string;
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-23 | Initial spec. Complete query taxonomy (all 5 categories + all system templates). Gap detection algorithm with 3 gap types. Prompt Gap Report email spec. Query performance analytics. Custom query management UX. Integration point map. TypeScript interfaces. |
