# Sprint O — V1 Complete: Revenue Defaults, Content Flow Clarity & Benchmark Comparison

> **Claude Code Prompt — Bulletproof Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`
> **Prerequisites:** Sprints A–N must be fully merged and all tests passing.
> **This is the final sprint of the original February 2026 analysis. After Sprint O, LocalVector V1 is complete.**

---

## 🎯 Objective

Sprint O closes the last three open items from the February 2026 code analysis. They are the smallest items in the backlog — none would justify a sprint on their own — but together they complete a V1 product that a paying customer can use without hitting a rough edge anywhere.

**The three items:**

1. **M4 — Restaurant-Specific Revenue Config Defaults:** The Revenue Impact page asks users to enter their average check size, covers per night, and other financial parameters. The `DEFAULT_CONFIG` in `revenue-leak.service.ts` presumably uses generic values (likely zero or placeholder numbers) that mean a restaurant owner opens this page and sees nonsense before they configure it. For a hookah lounge / restaurant, there are realistic defaults that make the form immediately useful on first open: average check size $55, 60 covers per night, 1.4x weekend multiplier, $45 hookah revenue per table. This sprint audits the existing defaults and replaces generic or zero values with restaurant-industry-appropriate ones. It also updates the golden-tenant fixture to ensure the sample data in Sprint L's sample data mode reflects realistic revenue numbers.

2. **L3 — Content Calendar ↔ Content Drafts Flow Clarity:** Two sidebar items — Content Calendar and Content Drafts — deal with content creation. From the code they're separate pages: the calendar is occasion-driven (upcoming holidays, cultural moments, local events) and the drafts page is where AI-generated content lives for editing and publishing. But a user who clicks "Generate content" in the calendar, then navigates to Content Drafts, has no visual cue that the draft they're looking at came from a calendar occasion. This sprint adds a "Generated from calendar · [occasion name]" tag to drafts that originated from the Occasion Engine, a clear "View in drafts →" CTA on the calendar after generation, and a breadcrumb on the drafts page for occasion-originated content.

3. **N4 — Benchmark Comparison ("You vs. Your City"):** Once LocalVector has multiple customers in the same metro, each customer can see how their Reality Score compares to local peers. "Your Reality Score: 62 · Alpharetta restaurant average: 51 · You're in the top 35% of local businesses." This is a retention tool — above-average customers feel validated; below-average customers feel motivated. The feature requires an anonymized aggregate query over the `organizations` table scoped to same city and industry. The computed benchmark is stored in a `benchmarks` table (simple schema: city, industry, avg_score, computed_at) and refreshed weekly via a lightweight cron or piggyback on the existing SOV cron. This sprint builds the benchmark table, the weekly computation job, and a `BenchmarkCard` component on the main dashboard.

**Why these three together:** They're the last three items. M4 is an audit + data fix. L3 is two small UI changes and one link. N4 is the only one with real architecture — a new table, a weekly computation, and a new dashboard card. Together they take 10–14 hours, which is a half-sprint. After this sprint, the product has no known gaps from the original analysis.

**Estimated total implementation time:** 10–14 hours. M4 audit (2–3 hours): read both files, identify all default values, replace with restaurant-appropriate numbers, update golden-tenant fixture, write tests. L3 (2–3 hours): source tag on drafts, CTA on calendar after generation, breadcrumb component. N4 (6–8 hours): migration, computation query, cron job or piggyback, BenchmarkCard component with privacy handling.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                                   — Rules 42–76 from Sprints A–N now in effect
Read CLAUDE.md                                          — Full Sprint A–N implementation inventory
Read MEMORY.md                                          — All architecture decisions through Sprint N

--- M4: Revenue Config Defaults ---
Read lib/services/revenue-leak.service.ts               — COMPLETE FILE. Find DEFAULT_CONFIG or
                                                          equivalent constant. What fields exist?
                                                          What are their current values? Are they
                                                          zero, null, or generic placeholders?
Read app/dashboard/revenue-impact/_components/          — ls; read RevenueConfigForm.tsx completely.
  RevenueConfigForm.tsx                                   What fields does the form show? Which
                                                          have default values wired from the service?
                                                          What is the TypeScript type for config?
Read src/__fixtures__/golden-tenant.ts                  — What revenue config values does the golden
                                                          tenant currently have? Are they realistic
                                                          for a hookah lounge? Sprint D added revenue
                                                          config — verify those values are sensible.
Read lib/supabase/database.types.ts                     — Revenue config type (if stored in DB
                                                          vs. hardcoded in the service).
Read app/dashboard/revenue-impact/page.tsx              — How does the page load the config?
                                                          Does it read from org_settings, a dedicated
                                                          revenue_configs table, or the service defaults?

--- L3: Content Flow Clarity ---
Read app/dashboard/content-calendar/                    — COMPLETE directory. How does content
                                                          generation work? What action/function
                                                          creates drafts from calendar occasions?
                                                          What data is passed to the draft?
Read app/dashboard/content-drafts/                      — COMPLETE directory. How are drafts
                                                          rendered? What is the draft data shape?
                                                          Does any draft currently have metadata
                                                          linking it to an occasion?
Read supabase/prod_schema.sql                           — content_drafts table: exact columns.
                                                          Does a source_occasion_id or
                                                          source_occasion_name column exist?
                                                          If not, a migration is needed.
Read lib/services/occasion-engine/                      — ls; read the Occasion Engine service.
                                                          Understand what data it generates and
                                                          what it writes to the DB when creating drafts.

--- N4: Benchmark Comparison ---
Read supabase/prod_schema.sql                           — orgs/organizations table: what columns
                                                          exist? city/metro, industry, plan?
                                                          Does a benchmarks table already exist?
                                                          Does org_scores or reality_scores have
                                                          a column to aggregate?
Read app/dashboard/page.tsx                             — Sprint L: SampleDataBanner, dashboard
                                                          card layout. BenchmarkCard is added here.
                                                          Where does it fit in the card grid?
Read app/api/cron/                                      — ls. Understand the existing cron routes.
                                                          The benchmark computation either piggybacks
                                                          on an existing cron (e.g., SOV cron which
                                                          runs weekly) or runs as its own daily/weekly
                                                          cron. Read the SOV cron's schedule to decide.
Read lib/supabase/database.types.ts                     — Types for orgs and scores tables.
                                                          The aggregate query needs to access
                                                          both to compute avg Reality Score per city.
```

**Specifically understand before writing any code:**

- **M4 — What "generic" means in context.** The DEFAULT_CONFIG may use zero values (`avgCheckSize: 0`), clearly wrong placeholders (`avgCheckSize: 25`), or may already have reasonable values from a previous developer's work. The task is to *audit* first. If the current defaults are already within range for a restaurant ($40–$80 check size, 40–100 covers), document that in DEVLOG and skip the change. Only update values that are genuinely wrong or unhelpful for a restaurant owner's first experience with the form.

- **L3 — Where draft metadata lives.** The key question is: when the Occasion Engine creates a content draft, does it write any metadata linking the draft back to its source occasion? Read the Occasion Engine service and the content_drafts table schema. If a `source_occasion_id` or `generated_from` column already exists (perhaps unused), use it. If not, a one-column migration is the smallest correct fix. Do not store the full occasion object in the draft — just the occasion name as a string and optionally an ID.

- **N4 — Privacy requirement for benchmarks.** The benchmark query aggregates Reality Scores across multiple customer orgs. This raises a privacy concern: if there are only 2 restaurants in Alpharetta, showing "your average is X" effectively reveals the other restaurant's score. The benchmark must only be shown when the aggregate pool has **5 or more orgs** in the same city + industry combination. Fewer than 5 = show nothing (no BenchmarkCard). This is a hard rule — do not round or fuzz the number and show it anyway.

- **N4 — Benchmark freshness.** The benchmark value is computed weekly (or on the same schedule as the Reality Score scan). It is stored in a `benchmarks` table with a `computed_at` timestamp. The BenchmarkCard shows both the benchmark value and the date it was computed ("as of March 1"). Do not show a benchmark older than 14 days — show nothing instead. This prevents stale data from misleading users.

- **N4 — Industry column on orgs.** The benchmark must be scoped to the same city AND same industry (restaurant orgs vs. medical orgs vs. retail orgs). Verify that the `orgs` table has an `industry` column or equivalent. If not, the benchmark can fall back to city-only (all local businesses, any industry) — document this fallback in DEVLOG.

---

## 🏗️ Architecture — What to Build

---

### Feature 1: Restaurant-Specific Revenue Config Defaults — M4

**The user's first experience with the Revenue Impact page:** They click "Revenue Impact" in the sidebar. The form shows. Without realistic defaults, they see fields pre-filled with zeros or placeholder text, which communicates "this product doesn't know anything about my business yet." With realistic defaults, they see a form that already looks right for a restaurant — they might only need to adjust one or two numbers before hitting "Calculate."

#### Step 1: Audit `lib/services/revenue-leak.service.ts`

Read the entire file. Find `DEFAULT_CONFIG` or equivalent. Document the current values in DEVLOG. Then apply these restaurant-appropriate defaults where current values are zero, null, or clearly generic:

```typescript
/**
 * Restaurant-specific default revenue configuration.
 * These values represent realistic baselines for a mid-market
 * full-service restaurant or lounge in a suburban US market.
 *
 * Source: National Restaurant Association 2024 data + hookah lounge
 * industry benchmarks. These are DEFAULTS — users configure their
 * own values via the RevenueConfigForm.
 *
 * AI_RULES §77: Revenue config defaults must be restaurant-appropriate,
 * not zero or generic placeholders. When the industry abstraction layer
 * ships (Sprints P–R), this becomes industry-specific via config.
 */
export const RESTAURANT_REVENUE_DEFAULTS = {
  // Average total check per table/cover (food + drinks + hookah for lounges)
  avgCheckSize: 55,               // USD — mid-range for full-service restaurant/lounge

  // Estimated covers (customers served) per night across all seatings
  coversPerNight: 60,

  // Weekend uplift multiplier (Fri/Sat typically 30–50% higher revenue)
  weekendMultiplier: 1.4,

  // For hookah lounges: additional revenue per table per session beyond food/drinks
  // Set to 0 for non-hookah restaurants
  hookahRevenuePerTable: 45,      // USD

  // Operating nights per week (5 = Mon–Fri, 7 = every day)
  operatingDaysPerWeek: 7,

  // Estimated conversion rate from AI mention to customer visit
  // (industry estimate: 15–25% of AI-referred customers convert)
  aiConversionRate: 0.20,

  // Average number of AI mentions that could reference this business per month
  // (conservative estimate for a local restaurant)
  estimatedMonthlyAiMentions: 500,
} as const;
```

**Implementation:**

1. Compare each field in `RESTAURANT_REVENUE_DEFAULTS` against the current `DEFAULT_CONFIG` in `revenue-leak.service.ts`.
2. For fields where the current value is 0, null, undefined, or clearly wrong (e.g., `avgCheckSize: 0`), replace with the value from `RESTAURANT_REVENUE_DEFAULTS`.
3. For fields where the current value is already reasonable, keep it and document in DEVLOG.
4. Do not rename or restructure the existing `DEFAULT_CONFIG` object — keep the same field names. Only update the values.
5. If the TypeScript type for revenue config doesn't include `hookahRevenuePerTable` or `weekendMultiplier`, add them to the type before using them as defaults. Read the type definition first.

#### Step 2: Update `src/__fixtures__/golden-tenant.ts`

The golden-tenant fixture is used in Sprint L's sample data mode to populate the Revenue Impact card. Verify that the revenue config values in the fixture match realistic numbers:

```typescript
// In golden-tenant.ts, find the revenue config object and verify:
// avgCheckSize should be in range $45–$75
// coversPerNight should be in range 40–80
// weekendMultiplier should be 1.3–1.5
// If any are 0, null, or clearly wrong — update them.
```

#### Step 3: Update `RevenueConfigForm.tsx` placeholder text

The form inputs' `placeholder` attributes should reflect the defaults so users know what reasonable values look like even before the form pre-fills:

```tsx
// In RevenueConfigForm.tsx, update placeholder attributes:
<input
  name="avgCheckSize"
  type="number"
  placeholder="e.g. 55"          // Was: "" or "0" or generic
  defaultValue={config?.avgCheckSize ?? RESTAURANT_REVENUE_DEFAULTS.avgCheckSize}
  // ...
/>
<input
  name="coversPerNight"
  type="number"
  placeholder="e.g. 60"
  defaultValue={config?.coversPerNight ?? RESTAURANT_REVENUE_DEFAULTS.coversPerNight}
  // ...
/>
```

Add a small help text note below the form: "Default values are based on typical restaurant revenue patterns. Adjust to match your actual numbers."

---

### Feature 2: Content Calendar ↔ Content Drafts Flow Clarity — L3

**The user's confusion:** They generate content from the calendar for "Cinco de Mayo themed cocktail night." They navigate to Content Drafts. They see a draft. Which occasion was it for? The draft looks like any other draft — no label, no link back.

**After Sprint O:** Every draft that came from the Occasion Engine has a "Generated from calendar · Cinco de Mayo" tag. The calendar page shows a "View draft →" link after generation. The drafts page breadcrumb for calendar-originated content reads "Content Calendar → [occasion name]."

#### Step 1: Migration (if needed)

```sql
-- supabase/migrations/[timestamp]_add_draft_source.sql
-- Only add if not already present. Read prod_schema.sql first.

ALTER TABLE public.content_drafts
  ADD COLUMN IF NOT EXISTS source_type       text,      -- 'calendar' | 'manual' | null
  ADD COLUMN IF NOT EXISTS source_occasion   text,      -- Occasion name, e.g. "Cinco de Mayo"
  ADD COLUMN IF NOT EXISTS source_occasion_id uuid;     -- FK to occasions table if one exists

COMMENT ON COLUMN public.content_drafts.source_type IS
  'Origin of this draft: calendar (Occasion Engine), manual, or null for legacy drafts.';
COMMENT ON COLUMN public.content_drafts.source_occasion IS
  'Human-readable name of the calendar occasion this draft was generated from.';
```

#### Step 2: Update Occasion Engine draft creation

When the Occasion Engine generates a draft from a calendar occasion, write the source metadata:

```typescript
// In the server action or service that creates drafts from the calendar:
// (Read app/dashboard/content-calendar/ and lib/services/occasion-engine/ to find this)

await supabase.from('content_drafts').insert({
  org_id,
  content: generatedContent,
  status: 'draft',
  // Add source metadata:
  source_type: 'calendar',
  source_occasion: occasion.name,          // The occasion display name
  source_occasion_id: occasion.id ?? null, // FK if occasions table exists
  created_at: new Date().toISOString(),
});
```

#### Step 3: `DraftSourceTag` — `app/dashboard/content-drafts/_components/DraftSourceTag.tsx`

```tsx
/**
 * DraftSourceTag
 *
 * Small pill tag shown on drafts that were generated from the Content Calendar.
 * Shown at the top of each DraftCard that has source_type='calendar'.
 */

import { CalendarDays } from 'lucide-react';
import Link from 'next/link';

interface DraftSourceTagProps {
  sourceOccasion: string;
}

export function DraftSourceTag({ sourceOccasion }: DraftSourceTagProps) {
  return (
    <Link
      href="/dashboard/content-calendar"
      className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 border border-violet-200 px-2.5 py-0.5 text-[11px] font-medium text-violet-700 hover:bg-violet-100 transition-colors w-fit"
      data-testid="draft-source-tag"
    >
      <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
      Generated from calendar · {sourceOccasion}
    </Link>
  );
}
```

Add this tag inside each `DraftCard` (or equivalent) when `draft.source_type === 'calendar'`. Read the drafts page component to find the exact card component and where to place it — typically just below the draft title, above the content preview.

#### Step 4: Calendar page post-generation CTA

After a draft is successfully generated from the calendar, show a confirmation that includes a link to the draft:

```tsx
// In the calendar's generation success state (after the server action returns):
// Find where the success message is currently displayed and add the link:

<div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3" data-testid="calendar-generation-success">
  <p className="text-sm text-emerald-800">
    Draft created for <span className="font-semibold">{occasionName}</span>
  </p>
  <a
    href="/dashboard/content-drafts"
    className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-900 underline"
    data-testid="view-draft-link"
  >
    View draft →
  </a>
</div>
```

**Read the current generation success state in the calendar page before adding this.** It may already show a success message — add the link to the existing state rather than creating a second success indicator.

#### Step 5: Content Drafts page breadcrumb for occasion-originated drafts

If the user navigates directly from the calendar to the drafts page (via the "View draft →" link), surface a subtle breadcrumb at the top of the page:

```tsx
// In app/dashboard/content-drafts/page.tsx:
// When navigating from the calendar (detect via URL param ?from=calendar&occasion=...):
// Render a breadcrumb:

{fromCalendar && (
  <nav className="mb-4 flex items-center gap-2 text-sm text-muted-foreground" aria-label="Breadcrumb" data-testid="calendar-breadcrumb">
    <a href="/dashboard/content-calendar" className="hover:text-foreground transition-colors">
      Content Calendar
    </a>
    <span aria-hidden="true">›</span>
    <span className="text-foreground">{occasionName ?? 'Generated draft'}</span>
  </nav>
)}
```

**This requires the calendar's "View draft →" link to pass query params:** `/dashboard/content-drafts?from=calendar&occasion=Cinco+de+Mayo`. Read the Next.js routing pattern the codebase uses for query params before implementing.

---

### Feature 3: Benchmark Comparison — N4

**The user's real question:** "How do I compare to other local businesses?"

**Current experience:** No comparison exists. The Reality Score is a 0–100 number with no external reference point. A score of 62 could be great or terrible depending on the market — the user has no way to know.

**After Sprint O:** A `BenchmarkCard` on the main dashboard shows: "Your Reality Score (62) is above the Alpharetta restaurant average (51). You're in the top 35% of local businesses tracked by LocalVector." Only shown when the aggregate pool has 5+ orgs. Never shown with stale data (> 14 days old).

#### Step 1: Migration — `benchmarks` table

```sql
-- supabase/migrations/[timestamp]_add_benchmarks.sql

CREATE TABLE IF NOT EXISTS public.benchmarks (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  city          text NOT NULL,
  industry      text NOT NULL DEFAULT 'restaurant',
  org_count     integer NOT NULL,        -- Number of orgs in this pool
  avg_score     numeric(5, 2) NOT NULL,  -- Average Reality Score (0–100)
  p25_score     numeric(5, 2),           -- 25th percentile (optional, for richer display)
  p75_score     numeric(5, 2),           -- 75th percentile
  computed_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city, industry)                -- One benchmark per city+industry
);

CREATE INDEX IF NOT EXISTS benchmarks_city_industry_idx ON public.benchmarks (city, industry);

COMMENT ON TABLE public.benchmarks IS
  'Anonymized weekly aggregate scores per city + industry. Only computed when pool >= 5 orgs. Never show raw org data — only aggregates.';
COMMENT ON COLUMN public.benchmarks.org_count IS
  'Number of orgs in this benchmark pool. Must be >= 5 to be meaningful.';
```

#### Step 2: `lib/services/benchmark.service.ts` — Computation service

```typescript
/**
 * lib/services/benchmark.service.ts
 *
 * Computes and stores anonymized city-level benchmark scores.
 *
 * PRIVACY RULE (AI_RULES §78):
 * - Never compute a benchmark with fewer than 5 orgs in the pool.
 * - Never expose individual org scores — only aggregates.
 * - Never store org IDs in the benchmarks table.
 * - Benchmarks are city + industry aggregates only.
 *
 * Called by the benchmark cron or SOV cron weekly.
 */

import { createClient } from '@/lib/supabase/server';
import * as Sentry from '@sentry/nextjs';

const MIN_POOL_SIZE = 5;

export async function computeBenchmarks(): Promise<{ computed: number; skipped: number }> {
  const supabase = createClient();

  // Group orgs by city + industry, compute avg reality score
  // Read prod_schema.sql to confirm: orgs table has 'city' and 'industry' columns,
  // and reality_score (or equivalent) is accessible via a join or separate table.
  //
  // Adjust the query below to match actual column and table names:
  const { data: groups, error } = await supabase.rpc('compute_city_benchmarks');
  // If an RPC doesn't exist, use a direct query:
  // const { data: groups } = await supabase
  //   .from('orgs')
  //   .select('city, industry, score:reality_score.avg(), count:id.count()')
  //   .not('reality_score', 'is', null)
  //   .group(['city', 'industry']);
  // (Supabase doesn't support .group() natively — use rpc or raw SQL via .rpc)

  if (error) {
    Sentry.captureException(error, { tags: { service: 'benchmark' } });
    return { computed: 0, skipped: 0 };
  }

  let computed = 0;
  let skipped = 0;

  for (const group of groups ?? []) {
    if (group.count < MIN_POOL_SIZE) {
      skipped++;
      continue;   // Privacy: skip pools smaller than 5
    }

    const { error: upsertErr } = await supabase
      .from('benchmarks')
      .upsert({
        city: group.city,
        industry: group.industry ?? 'restaurant',
        org_count: group.count,
        avg_score: parseFloat(group.avg_score.toFixed(2)),
        computed_at: new Date().toISOString(),
      }, { onConflict: 'city,industry' });

    if (upsertErr) {
      Sentry.captureException(upsertErr, { tags: { service: 'benchmark', city: group.city } });
    } else {
      computed++;
    }
  }

  return { computed, skipped };
}

/**
 * Fetch the benchmark for a specific org.
 * Returns null if:
 *   - No benchmark exists for org's city + industry
 *   - Benchmark pool < 5 orgs
 *   - Benchmark is older than 14 days
 */
export async function getBenchmarkForOrg(
  orgId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<{ avgScore: number; orgCount: number; computedAt: string } | null> {
  // Get org's city and industry
  const { data: org } = await supabase
    .from('orgs')
    .select('city, industry')
    .eq('id', orgId)
    .single();

  if (!org?.city) return null;

  const { data: benchmark } = await supabase
    .from('benchmarks')
    .select('avg_score, org_count, computed_at')
    .eq('city', org.city)
    .eq('industry', org.industry ?? 'restaurant')
    .single();

  if (!benchmark) return null;

  // Staleness check: don't show benchmarks older than 14 days
  const ageMs = Date.now() - new Date(benchmark.computed_at).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays > 14) return null;

  // Privacy check: pool must have >= 5 orgs
  if (benchmark.org_count < MIN_POOL_SIZE) return null;

  return {
    avgScore: benchmark.avg_score,
    orgCount: benchmark.org_count,
    computedAt: benchmark.computed_at,
  };
}
```

**The aggregate query needs to be implemented as a Supabase RPC (Postgres function) or raw SQL.** Supabase's JS client doesn't support `GROUP BY` natively. Read the existing codebase for examples of how other aggregate queries are handled — if `.rpc()` is used elsewhere, follow that pattern. If direct SQL via a DB function is needed, create the function in the migration file.

**Add the Postgres function to the migration:**

```sql
-- Add to the benchmarks migration file:

CREATE OR REPLACE FUNCTION compute_city_benchmarks()
RETURNS TABLE (
  city        text,
  industry    text,
  count       bigint,
  avg_score   numeric
) LANGUAGE sql STABLE AS $$
  SELECT
    o.city,
    COALESCE(o.industry, 'restaurant') AS industry,
    COUNT(o.id) AS count,
    AVG(s.reality_score)::numeric AS avg_score
  FROM public.orgs o
  -- Join to wherever reality_score is stored — adjust table/column names:
  JOIN public.org_scores s ON s.org_id = o.id   -- Verify table name in prod_schema.sql
  WHERE
    o.city IS NOT NULL
    AND s.reality_score IS NOT NULL
    AND s.computed_at >= NOW() - INTERVAL '30 days'  -- Only use recent scores
  GROUP BY o.city, COALESCE(o.industry, 'restaurant')
$$;
```

**Read `prod_schema.sql` before writing this function.** Adjust table names (`org_scores`, `reality_score` column, FK column) to match the actual schema.

#### Step 3: `app/api/cron/benchmarks/route.ts` — weekly computation cron

```typescript
/**
 * GET /api/cron/benchmarks
 *
 * Runs weekly (Sunday night, before scores are refreshed Monday).
 * Computes anonymized city-level benchmark scores for all city+industry pools
 * with >= 5 orgs.
 *
 * Schedule: "0 2 * * 0" — 2am UTC Sunday (before SOV scan)
 */

import { createClient } from '@/lib/supabase/server';
import { computeBenchmarks } from '@/lib/services/benchmark.service';
import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await computeBenchmarks();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: 'benchmarks' } });
    return NextResponse.json({ error: 'Benchmark computation failed' }, { status: 500 });
  }
}
```

Register in `vercel.json`:
```json
{
  "path": "/api/cron/benchmarks",
  "schedule": "0 2 * * 0"
}
```

#### Step 4: `BenchmarkCard` — `app/dashboard/_components/BenchmarkCard.tsx`

```tsx
/**
 * BenchmarkCard
 *
 * Shows the org's Reality Score vs. the local average.
 * Only rendered when a valid, fresh benchmark exists (>= 5 orgs, <= 14 days old).
 * When no benchmark is available, renders nothing — never shows a skeleton or
 * "no data" state that makes users wonder why the card is empty.
 *
 * AI_RULES §78: Never show individual competitor scores in benchmarks.
 * Only aggregate data (average, percentile range, org count).
 * Never show a benchmark with fewer than 5 orgs in the pool.
 */

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BenchmarkCardProps {
  orgScore: number;                         // The org's current Reality Score
  benchmark: {
    avgScore: number;
    orgCount: number;
    computedAt: string;
  };
  city: string;
}

export function BenchmarkCard({ orgScore, benchmark, city }: BenchmarkCardProps) {
  const diff = orgScore - benchmark.avgScore;
  const percentile = estimatePercentile(orgScore, benchmark.avgScore);

  const trend = diff > 5 ? 'above' : diff < -5 ? 'below' : 'average';

  const TrendIcon = trend === 'above' ? TrendingUp : trend === 'below' ? TrendingDown : Minus;
  const trendColor = trend === 'above' ? 'text-emerald-600' : trend === 'below' ? 'text-red-500' : 'text-muted-foreground';
  const trendBg = trend === 'above' ? 'border-emerald-200 bg-emerald-50' : trend === 'below' ? 'border-red-200 bg-red-50' : 'border-border bg-muted/20';

  const computedDate = new Date(benchmark.computedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div
      className={cn('rounded-xl border p-5 space-y-3', trendBg)}
      data-testid="benchmark-card"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Local Comparison</h3>
        <TrendIcon className={cn('h-4 w-4', trendColor)} aria-hidden="true" />
      </div>

      {/* Score comparison */}
      <div className="flex items-end gap-6">
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Your score</p>
          <p className={cn('text-3xl font-bold', trendColor)} data-testid="benchmark-org-score">
            {orgScore}
          </p>
        </div>
        <div className="pb-1">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
            {city} avg
          </p>
          <p className="text-xl font-semibold text-muted-foreground" data-testid="benchmark-avg-score">
            {benchmark.avgScore.toFixed(0)}
          </p>
        </div>
      </div>

      {/* Verdict sentence */}
      <p className="text-sm text-foreground leading-relaxed" data-testid="benchmark-verdict">
        {trend === 'above' && (
          <>Your AI visibility is <span className="font-semibold text-emerald-700">above average</span> for {city} restaurants.</>
        )}
        {trend === 'below' && (
          <>Your AI visibility is <span className="font-semibold text-red-600">below average</span> for {city} restaurants — improving your score would close this gap.</>
        )}
        {trend === 'average' && (
          <>Your AI visibility is <span className="font-semibold">on par</span> with the {city} restaurant average.</>
        )}
      </p>

      {/* Footer */}
      <p className="text-[10px] text-muted-foreground">
        Based on {benchmark.orgCount} local businesses · Updated {computedDate}
      </p>
    </div>
  );
}

/**
 * Rough percentile estimate from score vs average.
 * This assumes a normal distribution (not always true but good enough for display).
 * Returns an integer 1–99.
 */
function estimatePercentile(score: number, avg: number): number {
  // Simple linear estimate: ±15 points from avg ≈ ±1 standard deviation
  const stdDev = 15;
  const z = (score - avg) / stdDev;
  // Approximate normal CDF: 50% at z=0, ~84% at z=1, ~16% at z=-1
  const percentile = Math.round(50 + z * 34);
  return Math.max(1, Math.min(99, percentile));
}
```

#### Step 5: Wire `BenchmarkCard` into `app/dashboard/page.tsx`

```typescript
// In the server component, load benchmark data alongside other dashboard data:
const benchmark = await getBenchmarkForOrg(org.id, supabase);
```

```tsx
{/* Add BenchmarkCard only when benchmark data is available and org has a real score */}
{benchmark && scores?.realityScore != null && !isSampleMode && (
  <BenchmarkCard
    orgScore={scores.realityScore}
    benchmark={benchmark}
    city={org.city ?? 'your city'}
  />
)}
```

**Placement:** After the `AIHealthScoreCard` and before the `SOVTrendChart`. It's a contextual card — most meaningful near the Reality Score display.

**Not shown in sample mode** — the benchmark is real aggregate data and should not appear alongside sample scores. The `!isSampleMode` guard prevents the two from coexisting.

---

## 🧪 Testing

### Test File 1: `src/__tests__/unit/revenue-defaults.test.ts` — 8 tests

```
describe('RESTAURANT_REVENUE_DEFAULTS')
  1.  avgCheckSize is between $40 and $80 (restaurant-appropriate range)
  2.  coversPerNight is between 40 and 120
  3.  weekendMultiplier is between 1.2 and 1.8
  4.  operatingDaysPerWeek is between 5 and 7
  5.  aiConversionRate is between 0.10 and 0.35 (10–35%)
  6.  No field is 0, null, or undefined
  7.  hookahRevenuePerTable is between $30 and $80 (hookah lounge appropriate)
  8.  estimatedMonthlyAiMentions is > 0

describe('RevenueConfigForm default values')
  9.  Form renders with avgCheckSize defaultValue matching RESTAURANT_REVENUE_DEFAULTS
  10. Form renders with coversPerNight defaultValue matching RESTAURANT_REVENUE_DEFAULTS
  11. Help text note present below form about defaults being typical values
```

**Target: 11 tests**

### Test File 2: `src/__tests__/unit/content-flow-clarity.test.tsx` — 10 tests

```
describe('DraftSourceTag')
  1.  Renders when source_type='calendar'
  2.  Displays occasion name: "Generated from calendar · {occasionName}"
  3.  data-testid="draft-source-tag" present
  4.  Links to /dashboard/content-calendar
  5.  NOT rendered when source_type is null or 'manual'

describe('Calendar page post-generation CTA')
  6.  data-testid="calendar-generation-success" visible after successful generation
  7.  data-testid="view-draft-link" links to /dashboard/content-drafts

describe('Content Drafts breadcrumb')
  8.  When ?from=calendar query param present: data-testid="calendar-breadcrumb" visible
  9.  Breadcrumb shows "Content Calendar" link and occasion name
  10. When no from=calendar param: breadcrumb NOT shown
```

### Test File 3: `src/__tests__/unit/benchmark.test.ts` — 14 tests

```
describe('getBenchmarkForOrg()')
  1.  Returns null when no benchmark exists for org's city
  2.  Returns null when benchmark org_count < 5 (privacy rule)
  3.  Returns null when benchmark computed_at > 14 days ago
  4.  Returns benchmark data when pool >= 5 orgs and data is fresh
  5.  Returns null when org has no city set

describe('computeBenchmarks()')
  6.  Skips city groups with < 5 orgs (returns skipped count > 0)
  7.  Upserts benchmark for city groups with >= 5 orgs
  8.  Sentry called when Supabase upsert fails
  9.  Returns { computed: N, skipped: M } with correct counts

describe('BenchmarkCard')
  10. data-testid="benchmark-card" present
  11. benchmark-org-score shows org's score
  12. benchmark-avg-score shows city average
  13. Trend 'above' (diff > 5): emerald styling + TrendingUp icon
  14. Trend 'below' (diff < -5): red styling + TrendingDown icon
  15. Trend 'average' (diff within ±5): neutral styling + Minus icon
  16. Footer shows org_count and formatted computedAt date
  17. BenchmarkCard NOT rendered when isSampleMode=true (dashboard test)
```

**Target: 17 tests**

### E2E Test File: `src/__tests__/e2e/sprint-o-smoke.spec.ts` — 16 tests

```
describe('Sprint O — V1 Complete E2E')

  Revenue Defaults (M4):
  1.  /dashboard/revenue-impact: form pre-filled with non-zero avgCheckSize
  2.  avgCheckSize default is between 40 and 80 (not 0, not null)
  3.  coversPerNight default is between 40 and 120
  4.  Help text note present: "Default values are based on typical restaurant revenue patterns"

  Content Flow Clarity (L3):
  5.  Generate content from calendar → data-testid="calendar-generation-success" appears
  6.  data-testid="view-draft-link" present after generation
  7.  Click view-draft-link → navigates to /dashboard/content-drafts?from=calendar
  8.  On content-drafts: data-testid="calendar-breadcrumb" visible
  9.  Calendar-originated draft has data-testid="draft-source-tag" showing occasion name
  10. Manually created draft does NOT have draft-source-tag

  Benchmark Comparison (N4):
  11. Dashboard: BenchmarkCard visible when benchmark pool >= 5 (seed data scenario)
  12. BenchmarkCard shows two numbers: org score and city average
  13. Verdict text present ("above average" / "below average" / "on par")
  14. Footer shows org count and computed date
  15. BenchmarkCard NOT visible in sample data mode (isSampleMode=true)
  16. /api/cron/benchmarks without CRON_SECRET → 401

  Regression:
  17. All Sprint A–N features still working (spot check: alerts, SOV, billing comparison table,
      Yelp verification, AI preview, correction panel status update)
  18. npx vitest run passes with 0 failures (CI gate)
```

**Target: 18 E2E tests**

### Run commands

```bash
npx vitest run src/__tests__/unit/revenue-defaults.test.ts
npx vitest run src/__tests__/unit/content-flow-clarity.test.tsx
npx vitest run src/__tests__/unit/benchmark.test.ts
npx vitest run                                                      # ALL Sprints A–O — 0 regressions
npx playwright test src/__tests__/e2e/sprint-o-smoke.spec.ts
npx tsc --noEmit                                                    # 0 new type errors
```

---

## 📂 Files to Create / Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/services/revenue-leak.service.ts` | **MODIFY** | Replace generic defaults with `RESTAURANT_REVENUE_DEFAULTS`; export the const |
| 2 | `app/dashboard/revenue-impact/_components/RevenueConfigForm.tsx` | **MODIFY** | Update placeholder text; wire defaults; add help text note |
| 3 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | Verify/update revenue config values to match realistic restaurant numbers |
| 4 | `supabase/migrations/[ts]_add_draft_source.sql` | **CREATE (if needed)** | `source_type`, `source_occasion`, `source_occasion_id` on content_drafts |
| 5 | `app/dashboard/content-drafts/_components/DraftSourceTag.tsx` | **CREATE** | "Generated from calendar · [occasion]" pill tag |
| 6 | `app/dashboard/content-drafts/page.tsx` (or DraftCard) | **MODIFY** | Render `DraftSourceTag` when `source_type === 'calendar'` |
| 7 | `app/dashboard/content-calendar/` (action or page) | **MODIFY** | Write `source_type='calendar'` + `source_occasion` on draft creation; add success CTA |
| 8 | `app/dashboard/content-drafts/page.tsx` | **MODIFY** | Add breadcrumb when `?from=calendar` query param present |
| 9 | `supabase/migrations/[ts]_add_benchmarks.sql` | **CREATE** | `benchmarks` table + `compute_city_benchmarks()` Postgres function |
| 10 | `lib/services/benchmark.service.ts` | **CREATE** | `computeBenchmarks()` + `getBenchmarkForOrg()` |
| 11 | `app/api/cron/benchmarks/route.ts` | **CREATE** | Weekly benchmark computation cron |
| 12 | `app/dashboard/_components/BenchmarkCard.tsx` | **CREATE** | Score comparison card; privacy guards; verdict sentence |
| 13 | `app/dashboard/page.tsx` | **MODIFY** | Load benchmark via `getBenchmarkForOrg()`; render `BenchmarkCard` |
| 14 | `vercel.json` | **MODIFY** | Add benchmarks cron schedule (`0 2 * * 0`) |
| 15 | `src/__tests__/unit/revenue-defaults.test.ts` | **CREATE** | 11 tests |
| 16 | `src/__tests__/unit/content-flow-clarity.test.tsx` | **CREATE** | 10 tests |
| 17 | `src/__tests__/unit/benchmark.test.ts` | **CREATE** | 17 tests |
| 18 | `src/__tests__/e2e/sprint-o-smoke.spec.ts` | **CREATE** | 18 E2E tests |

**New API routes:** 1 (`/api/cron/benchmarks`)
**New migrations:** 1–3 (conditional on existing schema)
**New Postgres functions:** 1 (`compute_city_benchmarks()`)

---

## 🧠 Edge Cases to Handle

1. **M4 — Current defaults may already be reasonable.** The task is an audit, not a guaranteed rewrite. If `revenue-leak.service.ts` already has `avgCheckSize: 55` or similar, document that in DEVLOG and skip the change. Only change values that are genuinely wrong or unhelpful. Don't change for the sake of changing.

2. **M4 — Revenue config type may not include `hookahRevenuePerTable`.** If the existing config type doesn't have this field, do not add it without a migration. Instead, note in DEVLOG that hookah-specific revenue can be captured in a future sprint when the medical/dental vertical ships and the revenue config type becomes industry-specific.

3. **L3 — Occasion Engine may write drafts differently than expected.** Read the Occasion Engine service carefully. The draft creation may happen in multiple places (server action, service call, background job). Ensure the `source_type` and `source_occasion` fields are written wherever drafts are created from the calendar — not just in one code path.

4. **L3 — Legacy drafts without source metadata.** All drafts created before this sprint have `source_type = null`. The `DraftSourceTag` only renders for `source_type === 'calendar'` — null drafts render normally without a tag. Do not backfill legacy drafts with source metadata — there's no reliable way to determine which old drafts came from the calendar.

5. **L3 — URL query param sanitization.** The breadcrumb uses `?from=calendar&occasion=Cinco+de+Mayo` from the URL. The `occasion` param must be sanitized before rendering — it's user-visible text in a URL. Use `decodeURIComponent()` and limit length to 100 characters. Do not render arbitrary URL parameter content without sanitization.

6. **N4 — `compute_city_benchmarks()` requires the correct table/column names.** Read `prod_schema.sql` to find: (a) the `orgs` table name, (b) the `city` column name, (c) the `industry` column (may not exist — fall back to all-industry aggregate), (d) where `reality_score` is stored (may be `org_scores.reality_score`, `reality_score_history.score`, or directly on `orgs`). The Postgres function must be adapted to the actual schema. Test the function in Supabase's SQL editor before adding it to the migration.

7. **N4 — City string normalization.** Orgs in "Alpharetta" and "Alpharetta, GA" and "alpharetta" are in the same city. The `GROUP BY city` in the benchmark query will treat these as separate cities. Apply `LOWER(TRIM(city))` normalization in the Postgres function. The BenchmarkCard should display the prettified version (from `org.city`) not the normalized SQL value.

8. **N4 — Fewer than 5 orgs at launch.** At initial deployment, LocalVector likely has fewer than 5 paying customers in any single city. The BenchmarkCard will not appear for any org — that's correct. The card only appears once there are 5+ orgs in the same city and industry. Do not show placeholder text, a "coming soon" state, or anything at all when the benchmark doesn't exist — the card simply doesn't render.

9. **N4 — BenchmarkCard and isSampleMode.** New users in sample data mode see SAMPLE_REALITY_SCORE = 62. The BenchmarkCard should NOT show alongside sample data (the benchmark is real, the score isn't). The `!isSampleMode` guard in `page.tsx` handles this — confirm it's applied correctly.

10. **N4 — Percentile display vs. privacy.** The `estimatePercentile()` function gives a rough percentile from a normal distribution assumption. This is an estimate, not a precise rank. The card does not show "you're #3 out of 7 businesses" — that would effectively reveal other businesses' scores. The card only shows "above average / below average / on par" and the aggregate average, never a rank or individual positions.

11. **N4 — Benchmark computation at scale.** The `compute_city_benchmarks()` Postgres function runs a full table scan of `orgs` and `org_scores`. At V1 scale (< 100 orgs) this is trivially fast. At 10,000+ orgs it would need an index on `city` and `industry`. The indexes created in the migration (`benchmarks_city_industry_idx`) cover the benchmark table itself — add a note in DEVLOG that the `orgs.city` and `orgs.industry` columns should also be indexed when org count exceeds 1,000.

12. **Webhook test POST on save (Sprint N TODO).** Sprint N documented a TODO: send a test POST when the webhook URL is saved. This is low priority but if time allows in Sprint O (it's a small sprint), add a simple test POST from the `updateWebhookUrl` server action: after saving, send `{ type: 'test', message: 'LocalVector webhook connected successfully' }` to the URL and show success/failure in the settings form. Document the result in DEVLOG.

---

## 🚫 What NOT to Do

1. **DO NOT change revenue config field names or types** — only update the default values. The existing API surface must remain stable.
2. **DO NOT render the BenchmarkCard with fewer than 5 orgs in the pool.** AI_RULES §78. No exceptions. No "coming soon" state. Silence is the correct response when data is insufficient.
3. **DO NOT show a stale benchmark** (older than 14 days). If `getBenchmarkForOrg()` returns null due to staleness, the card doesn't render. Don't show the old data with a "last updated" caveat — staleness is a silent null, not a visible warning.
4. **DO NOT show individual org scores in the benchmark card.** Only aggregates: average score, org count, computed date. The percentile estimate is fine; a rank ("you're #3 out of 7") is not.
5. **DO NOT render `DraftSourceTag` on manually-created drafts.** The tag is only for `source_type === 'calendar'`. Null or 'manual' source types render no tag.
6. **DO NOT sanitize URL query params after rendering.** The `occasion` breadcrumb value comes from the URL — decode and sanitize it before displaying. `decodeURIComponent()` + length limit + escape before render.
7. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12).
8. **DO NOT modify `middleware.ts`** (AI_RULES §6).
9. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).
10. **DO NOT skip the M4 audit step.** Read both files first and document what you find. Only then decide what to change.

---

## ✅ Definition of Done

**Revenue Defaults (M4):**
- [ ] Audit of `revenue-leak.service.ts` DEFAULT_CONFIG documented in DEVLOG
- [ ] All default values are non-zero, non-null, and restaurant-appropriate
- [ ] `RESTAURANT_REVENUE_DEFAULTS` exported from the service (for tests)
- [ ] `RevenueConfigForm` placeholder text updated; help note present
- [ ] golden-tenant.ts revenue values verified as realistic
- [ ] `revenue-defaults.test.ts` — 11 tests passing

**Content Flow Clarity (L3):**
- [ ] `source_type` and `source_occasion` columns on `content_drafts` (migration or existing)
- [ ] Occasion Engine draft creation writes `source_type='calendar'` and occasion name
- [ ] `DraftSourceTag` renders on calendar-originated drafts; not on manual drafts
- [ ] Calendar page shows success CTA with "View draft →" link after generation
- [ ] Content Drafts breadcrumb visible when `?from=calendar` param present
- [ ] Occasion name in breadcrumb is sanitized and length-limited
- [ ] `content-flow-clarity.test.tsx` — 10 tests passing

**Benchmark Comparison (N4):**
- [ ] `benchmarks` table created; `compute_city_benchmarks()` Postgres function exists
- [ ] `computeBenchmarks()` skips pools < 5 orgs; upserts aggregates for valid pools
- [ ] `getBenchmarkForOrg()` returns null for missing, stale (> 14 days), or small pools
- [ ] `/api/cron/benchmarks` route: auth guard, calls `computeBenchmarks()`, Sentry on error
- [ ] `BenchmarkCard` renders with org score, city avg, verdict sentence, footer
- [ ] Correct trend colors: emerald for above, red for below, neutral for average
- [ ] BenchmarkCard not rendered in sample data mode
- [ ] `vercel.json` cron registered for Sunday 2am UTC
- [ ] `benchmark.test.ts` — 17 tests passing

**All tests:**
- [ ] `npx vitest run` — ALL Sprints A–O passing, zero regressions
- [ ] `sprint-o-smoke.spec.ts` — 18 E2E tests passing
- [ ] `npx tsc --noEmit` — 0 new type errors

---

## 📓 DEVLOG Entry

```markdown
## [DATE] — Sprint O: V1 Complete — Revenue Defaults, Content Flow, Benchmark (Completed)

**Revenue Defaults (M4) — Audit Results:**
- Previous avgCheckSize: [value found]  → Updated to: [new value / unchanged]
- Previous coversPerNight: [value]       → Updated to: [new value / unchanged]
- Previous weekendMultiplier: [value]    → Updated to: [new value / unchanged]
- hookahRevenuePerTable: [existed / added / skipped — type didn't include it]
- golden-tenant.ts revenue values: [verified correct / updated]
- Fields that were already restaurant-appropriate (unchanged): [list]

**Content Flow Clarity (L3):**
- content_drafts.source_type column: [already existed / added in migration]
- Occasion Engine draft creation files modified: [list files]
- DraftSourceTag placement in DraftCard: [file:line]
- Breadcrumb URL param: ?from=calendar&occasion=[encoded name]
- Occasion name sanitization: decodeURIComponent + truncate to 100 chars

**Benchmark Comparison (N4):**
- orgs table city column name: [actual column name]
- orgs table industry column: [exists / missing — used all-industry fallback]
- reality_score location: [table and column name confirmed from prod_schema.sql]
- compute_city_benchmarks() function: [added to migration / created as separate migration]
- Current org pool size in Alpharetta+restaurant at time of sprint: [N orgs]
  → BenchmarkCard visible: [yes if N >= 5 / no — will appear when 5 orgs reached]
- Benchmark cron registered: "0 2 * * 0" (Sunday 2am UTC)
- Webhook test POST (Sprint N TODO): [implemented / deferred — time constraint]

**Tests:** N Vitest + 18 Playwright; 0 regressions Sprints A–O
**Cumulative (A–O):** [N] Vitest + [N] Playwright

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏁 LocalVector V1 is complete.
All 24 findings from the February 2026 code analysis are resolved.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Remaining reserved sprints (future scope):**
- Sprint P: Medical/Dental vertical — golden tenant fixture, SOV query templates,
  schema types (Physician/MedicalClinic), onboarding copy, dynamic sidebar icon
- Sprint Q: Medical/Dental — admin operations dashboard (L1)
- Sprint R: Medical/Dental — credit/usage system for API cost control (N1)
  and full credit metering for the new vertical's higher API usage patterns
```

---

## 🔮 AI_RULES Update

```markdown
## 77. 💰 Revenue Config Defaults — Restaurant-Appropriate (Sprint O)

lib/services/revenue-leak.service.ts DEFAULT_CONFIG must never contain
zeros, nulls, or generic placeholder values. Defaults must be realistic
for the industry the product currently serves (restaurant/lounge).

When the Medical/Dental vertical ships (Sprint P), DEFAULT_CONFIG becomes
industry-specific via the industry abstraction layer. Until then, restaurant
defaults apply for all orgs.

RESTAURANT_REVENUE_DEFAULTS exports the canonical values. Tests assert
that all defaults are within restaurant-industry-appropriate ranges.
If ranges change (e.g., new NRA data), update the tests.

## 78. 📊 Benchmarks — Privacy and Freshness Rules (Sprint O)

The benchmark feature is subject to strict privacy and staleness rules:

PRIVACY:
1. Minimum pool size is 5 orgs. Never show a benchmark with fewer than 5 orgs
   in the city + industry pool. Return null from getBenchmarkForOrg().
2. Never show individual org scores in any benchmark display — only aggregates
   (average, percentile estimate, org count).
3. Never show a rank ("you're #3 of 7") — only direction ("above average").
   A rank effectively reveals other businesses' scores.
4. Benchmark table stores NO org IDs. Only city, industry, aggregates, org_count.

FRESHNESS:
5. Never show a benchmark older than 14 days. Return null from getBenchmarkForOrg().
6. BenchmarkCard is never shown in sample data mode (isSampleMode=true).
7. When getBenchmarkForOrg() returns null for any reason, render nothing.
   No skeleton, no "coming soon", no "unavailable" message. Silence only.

COMPUTATION:
8. compute_city_benchmarks() skips pools < 5. skipped count is logged.
9. Benchmarks are recomputed weekly (Sunday 2am UTC). Between runs, the
   stored value is shown. After 14 days, nothing is shown.
```

---

## 📚 Git Commit

```bash
git add -A
git commit -m "Sprint O: V1 Complete — Revenue Defaults, Content Flow, Benchmark Comparison

Revenue Defaults (M4):
- RESTAURANT_REVENUE_DEFAULTS: avgCheckSize=$55, coversPerNight=60, weekendMultiplier=1.4,
  hookahRevenuePerTable=$45, operatingDaysPerWeek=7, aiConversionRate=0.20
- revenue-leak.service.ts DEFAULT_CONFIG: replaced generic/zero values with restaurant defaults
- RevenueConfigForm: updated placeholders; added help text note
- golden-tenant.ts: revenue config values verified/updated

Content Calendar ↔ Drafts Flow Clarity (L3):
- Migration: source_type, source_occasion, source_occasion_id on content_drafts
- Occasion Engine: writes source_type='calendar' + occasion name on draft creation
- DraftSourceTag: 'Generated from calendar · [occasion]' pill on calendar-originated drafts
- Content Calendar: success state + 'View draft →' link after generation
- Content Drafts: breadcrumb when ?from=calendar param present; URL-sanitized occasion name

Benchmark Comparison (N4):
- Migration: benchmarks table + compute_city_benchmarks() Postgres function
- benchmark.service.ts: computeBenchmarks() (min pool=5); getBenchmarkForOrg() (14-day staleness)
- /api/cron/benchmarks: weekly Sun 2am UTC; auth guard; Sentry
- BenchmarkCard: org score vs city avg; above/below/average verdict; pool count footer
- dashboard/page.tsx: BenchmarkCard after AIHealthScoreCard; hidden in sample mode
- vercel.json: benchmarks cron registered

Tests: N Vitest + 18 Playwright; 0 regressions Sprints A–O
AI_RULES: 77 (restaurant revenue defaults), 78 (benchmark privacy + freshness)

🏁 LocalVector V1 complete — all 24 February 2026 findings resolved (Sprints A–O)"

git push origin main
```

---

## 🏁 Sprint O Outcome — V1 Complete

Three small items become the final pieces of a complete product.

**Revenue Config Defaults** — A restaurant owner who opens the Revenue Impact page for the first time now sees a form pre-filled with numbers that make sense for their business. $55 average check. 60 covers per night. 1.4x weekend uplift. They adjust one or two fields, hit calculate, and immediately see an estimated $2,800/month in revenue loss from AI hallucinations. That number is what sells the product to their spouse when they explain the subscription at dinner. Generic defaults would have shown them $0 and left them confused about what to enter.

**Content Calendar ↔ Drafts Flow Clarity** — The content creation flow is now a coherent narrative rather than two disconnected pages. Generate from the calendar → the calendar confirms with a "View draft →" link → the drafts page shows "Generated from calendar · Cinco de Mayo" → editing the draft, the user always knows where it came from. The flow that was previously two isolated islands is now a path.

**Benchmark Comparison** — The Reality Score has an external reference point for the first time. "62" no longer means nothing. It means "above the Alpharetta restaurant average of 51." For users who are above average, it's validation. For users below average, it's motivation. And for every user, it's a reason to check back next week — because the benchmark updates weekly and their score might have moved relative to the market.

---

## 📌 Reserved Sprints — Medical/Dental Vertical Expansion

The following sprints are reserved for the Medical/Dental vertical expansion. These are not part of the February 2026 analysis closure — they represent the first horizontal expansion of LocalVector beyond restaurants into a new industry category.

**Sprint P — Medical/Dental: Data Layer and Onboarding**
- New golden tenant fixture: Alpharetta dental practice (e.g., "Smile Alpharetta Dental")
- Industry-specific SOV query templates in `lib/services/sov-seed.ts`
  ("best pediatric dentist near me", "dental office accepting new patients Alpharetta")
- Schema.org types: `Physician`, `MedicalClinic`, `MedicalSpecialty`, `MedicalBusiness`
  added to Magic Engine / schema generator
- Onboarding wizard: industry-detected copy ("services" not "menu", "specialty" not "cuisine")
- Dynamic sidebar icon: Stethoscope icon for medical orgs; Utensils for restaurant
- `lib/industries/` config updated with dental/medical industry constants

**Sprint Q — Medical/Dental: Admin Dashboard (L1)**
- Protected `/admin` route (ADMIN_EMAILS env var guard)
- Customer list with plan, MRR, last login, org type (restaurant vs. medical)
- API usage summary per org (Perplexity/OpenAI/Gemini calls by cron)
- Cron health: cross-org view of `cron_run_log` success/failure rates
- Revenue summary: plan MRR − API cost − infrastructure cost = margin estimate
- Stripe subscription health: trial expirations, overdue payments, recent upgrades

**Sprint R — Medical/Dental: Usage Metering (N1)**
- `api_credits` table: org_id, credits_used, credits_limit, reset_date
- Plan limits: Starter (100 manual triggers/month), Growth (500), Agency (2,000)
- Credits check middleware for expensive operations (Run Analysis, Generate Brief, Re-audit)
- Credits meter in TopBar (medical vertical launches with metering from day one)
- Auto-refill on billing date
- Medical-specific higher credit limits (practices have fewer locations but higher hallucination risk)

These sprints are scoped as future work and are NOT blockers for V1 completion. LocalVector V1 is complete after Sprint O.
