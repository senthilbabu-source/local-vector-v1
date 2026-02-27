# Sprint 85 — Revenue Impact Calculator

> **Claude Code Prompt — First-Pass Ready**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`

---

## 🎯 Objective

Build the **Revenue Impact Calculator** — turn abstract visibility scores into estimated dollar amounts. "Your AI visibility gaps are costing you an estimated $2,400/month." This is the PROVE stage — the feature that drives subscription renewals, because abstract scores don't renew subscriptions, dollar amounts do.

**The user sees:**
```
💰 Estimated Monthly Revenue Impact
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Recoverable Revenue:  $2,400/mo

Breakdown:
  📉 SOV Gaps                $1,350/mo
     You're invisible for 5 queries that drive
     an estimated 270 AI-assisted visits/month

  🔴 Hallucination Impact     $675/mo
     3 active hallucinations may deter
     ~15 potential customers/month

  ⚔️ Competitor Advantage      $375/mo
     Competitors recommended 23% more often
     across head-to-head queries

Settings: Avg customer value: $45 · Monthly covers: 800
[Edit revenue settings →]
```

**Architecture:** Migration adds revenue config fields to `locations`. Pure service computes revenue impact from SOV gaps, hallucinations, and competitor data. Dashboard page with dollar breakdown, config form, and trend over time. No AI calls — all deterministic math.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                          — All engineering rules (§4, §17, §18, §20)
Read CLAUDE.md                                 — Project context + architecture
Read supabase/prod_schema.sql                  — locations, sov_evaluations, target_queries,
                                                 ai_hallucinations, competitor_intercepts,
                                                 visibility_analytics
Read lib/supabase/database.types.ts            — Full Database type (§38)
Read src/__fixtures__/golden-tenant.ts          — Golden Tenant fixtures (§4)
Read app/dashboard/settings/                   — Settings page pattern (for revenue config form)
Read app/dashboard/proof-timeline/             — Before/After Proof Timeline (Sprint 76) — similar PROVE stage
```

---

## 🏗️ Architecture — What to Build

### Revenue Model

The calculator estimates recoverable revenue from 3 gap categories:

```
Revenue = SOV_Gap_Revenue + Hallucination_Revenue + Competitor_Revenue

SOV Gap Revenue:
  For each query where rank_position IS NULL across all engines:
    estimated_monthly_ai_searches = CATEGORY_SEARCH_VOLUME[query_category]
    missed_visits = estimated_monthly_ai_searches × CONVERSION_RATE
    revenue_per_query = missed_visits × avg_customer_value
  SOV_Gap_Revenue = sum(revenue_per_query) for all gap queries

Hallucination Revenue:
  For each open hallucination:
    deterred_customers = SEVERITY_IMPACT[severity]
    revenue_per_hallucination = deterred_customers × avg_customer_value
  Hallucination_Revenue = sum(revenue_per_hallucination)

Competitor Revenue:
  competitor_advantage = (competitor_sov - your_sov) / your_sov
  diverted_covers = monthly_covers × competitor_advantage × AI_INFLUENCE_RATE
  Competitor_Revenue = diverted_covers × avg_customer_value
```

**Constants (configurable per business, defaults for restaurants):**

```typescript
/** Estimated monthly AI-assisted searches per query category */
const CATEGORY_SEARCH_VOLUME: Record<string, number> = {
  discovery: 90,     // "best hookah bar Alpharetta"
  comparison: 60,    // "hookah bar vs lounge Alpharetta"
  occasion: 45,      // "valentine's day dinner Alpharetta"
  near_me: 120,      // "hookah near me"
  custom: 30,        // user-defined queries
};

/** Click-through rate from AI recommendation to visit */
const AI_RECOMMENDATION_CTR = 0.08; // 8% of people who see AI rec actually visit

/** Percentage of total restaurant traffic influenced by AI */
const AI_INFLUENCE_RATE = 0.05; // 5% of covers come via AI-assisted decisions

/** Customers deterred per open hallucination per month, by severity */
const SEVERITY_IMPACT: Record<string, number> = {
  critical: 8,  // "permanently closed" — strong deterrent
  high: 5,      // wrong hours, wrong cuisine type
  medium: 2,    // minor inaccuracy
  low: 1,       // trivial error
};
```

---

### Component 1: Migration — `supabase/migrations/20260226000012_revenue_config.sql`

```sql
-- Sprint 85: Revenue Impact Calculator — add revenue config fields to locations
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS avg_customer_value numeric(10,2) DEFAULT 45.00,
  ADD COLUMN IF NOT EXISTS monthly_covers integer DEFAULT 800;

COMMENT ON COLUMN public.locations.avg_customer_value
  IS 'Average revenue per customer visit. Used by Revenue Impact Calculator (Sprint 85).';
COMMENT ON COLUMN public.locations.monthly_covers
  IS 'Estimated monthly customer covers. Used by Revenue Impact Calculator (Sprint 85).';
```

**Update `database.types.ts`:** Add `avg_customer_value: number | null` and `monthly_covers: number | null` to `locations` Row/Insert/Update.

---

### Component 2: Revenue Impact Service — `lib/services/revenue-impact.service.ts`

Pure functions. No I/O.

```typescript
// ── Types ─────────────────────────────────────────────

export interface RevenueConfig {
  avgCustomerValue: number;  // dollars per visit
  monthlyCovers: number;     // total monthly customers
}

export interface RevenueImpactInput {
  config: RevenueConfig;

  /** SOV gap queries — queries where business is NOT ranked */
  sovGaps: Array<{
    queryText: string;
    queryCategory: string;
    missingEngineCount: number;
    totalEngineCount: number;
  }>;

  /** Open hallucinations */
  openHallucinations: Array<{
    claimText: string;
    severity: string;
  }>;

  /** Competitor advantage data */
  competitorData: {
    /** Your average SOV (0-1) across all queries */
    yourSov: number | null;
    /** Top competitor's average SOV (0-1) */
    topCompetitorSov: number | null;
    topCompetitorName: string | null;
  };
}

export interface RevenueLineItem {
  category: 'sov_gap' | 'hallucination' | 'competitor';
  label: string;
  description: string;
  monthlyRevenue: number;
  /** Supporting detail for tooltip/expansion */
  detail: string;
}

export interface RevenueImpactResult {
  /** Total estimated recoverable monthly revenue */
  totalMonthlyRevenue: number;
  /** Annual projection */
  totalAnnualRevenue: number;
  /** Breakdown by category */
  lineItems: RevenueLineItem[];
  /** Per-category subtotals */
  sovGapRevenue: number;
  hallucinationRevenue: number;
  competitorRevenue: number;
  /** Config used for calculation (for display) */
  config: RevenueConfig;
  /** Whether user has customized config (vs defaults) */
  isDefaultConfig: boolean;
}

// ── Constants ─────────────────────────────────────────

export const DEFAULT_REVENUE_CONFIG: RevenueConfig = {
  avgCustomerValue: 45,
  monthlyCovers: 800,
};

export const CATEGORY_SEARCH_VOLUME: Record<string, number> = {
  discovery: 90,
  comparison: 60,
  occasion: 45,
  near_me: 120,
  custom: 30,
};

export const AI_RECOMMENDATION_CTR = 0.08;
export const AI_INFLUENCE_RATE = 0.05;

export const SEVERITY_IMPACT: Record<string, number> = {
  critical: 8,
  high: 5,
  medium: 2,
  low: 1,
};

// ── Pure computation ──────────────────────────────────

/**
 * Compute revenue impact from visibility gaps.
 * Pure function — no I/O, no side effects.
 */
export function computeRevenueImpact(input: RevenueImpactInput): RevenueImpactResult {
  const lineItems: RevenueLineItem[] = [];

  // ── SOV Gap Revenue ──
  let sovGapRevenue = 0;
  const sovGapQueries = input.sovGaps;

  if (sovGapQueries.length > 0) {
    let totalMissedVisits = 0;

    for (const gap of sovGapQueries) {
      const searchVolume = CATEGORY_SEARCH_VOLUME[gap.queryCategory] ?? CATEGORY_SEARCH_VOLUME.custom;
      // Scale by gap severity: all engines missing = full impact, some = partial
      const gapRatio = gap.totalEngineCount > 0
        ? gap.missingEngineCount / gap.totalEngineCount
        : 1;
      const missedVisits = searchVolume * AI_RECOMMENDATION_CTR * gapRatio;
      totalMissedVisits += missedVisits;
    }

    sovGapRevenue = roundTo(totalMissedVisits * input.config.avgCustomerValue, 0);

    lineItems.push({
      category: 'sov_gap',
      label: 'SOV Gaps',
      description: `You're invisible for ${sovGapQueries.length} quer${sovGapQueries.length === 1 ? 'y' : 'ies'} that drive an estimated ${Math.round(totalMissedVisits)} AI-assisted visits/month`,
      monthlyRevenue: sovGapRevenue,
      detail: sovGapQueries.map(q => `"${q.queryText}" (${q.missingEngineCount}/${q.totalEngineCount} engines)`).join(', '),
    });
  }

  // ── Hallucination Revenue ──
  let hallucinationRevenue = 0;

  if (input.openHallucinations.length > 0) {
    let totalDeterred = 0;

    for (const h of input.openHallucinations) {
      const impact = SEVERITY_IMPACT[h.severity] ?? SEVERITY_IMPACT.low;
      totalDeterred += impact;
    }

    hallucinationRevenue = roundTo(totalDeterred * input.config.avgCustomerValue, 0);

    lineItems.push({
      category: 'hallucination',
      label: 'Hallucination Impact',
      description: `${input.openHallucinations.length} active hallucination${input.openHallucinations.length === 1 ? '' : 's'} may deter ~${totalDeterred} potential customers/month`,
      monthlyRevenue: hallucinationRevenue,
      detail: input.openHallucinations.map(h => `"${truncate(h.claimText, 50)}" (${h.severity})`).join(', '),
    });
  }

  // ── Competitor Revenue ──
  let competitorRevenue = 0;

  if (
    input.competitorData.yourSov !== null &&
    input.competitorData.topCompetitorSov !== null &&
    input.competitorData.topCompetitorSov > (input.competitorData.yourSov ?? 0)
  ) {
    const yourSov = input.competitorData.yourSov;
    const compSov = input.competitorData.topCompetitorSov;
    const competitorAdvantage = yourSov > 0
      ? (compSov - yourSov) / yourSov
      : compSov > 0 ? 1 : 0; // If you have 0 SOV, competitor has 100% advantage

    const divertedCovers = input.config.monthlyCovers * competitorAdvantage * AI_INFLUENCE_RATE;
    competitorRevenue = roundTo(divertedCovers * input.config.avgCustomerValue, 0);

    const advantagePercent = Math.round(competitorAdvantage * 100);

    lineItems.push({
      category: 'competitor',
      label: 'Competitor Advantage',
      description: `${input.competitorData.topCompetitorName ?? 'Top competitor'} recommended ${advantagePercent}% more often across head-to-head queries`,
      monthlyRevenue: competitorRevenue,
      detail: `Your SOV: ${(yourSov * 100).toFixed(0)}% vs ${input.competitorData.topCompetitorName ?? 'competitor'}: ${(compSov * 100).toFixed(0)}%`,
    });
  }

  const totalMonthlyRevenue = sovGapRevenue + hallucinationRevenue + competitorRevenue;

  // Determine if config is default
  const isDefaultConfig =
    input.config.avgCustomerValue === DEFAULT_REVENUE_CONFIG.avgCustomerValue &&
    input.config.monthlyCovers === DEFAULT_REVENUE_CONFIG.monthlyCovers;

  return {
    totalMonthlyRevenue,
    totalAnnualRevenue: totalMonthlyRevenue * 12,
    lineItems,
    sovGapRevenue,
    hallucinationRevenue,
    competitorRevenue,
    config: input.config,
    isDefaultConfig,
  };
}

// ── Helpers ───────────────────────────────────────────

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}
```

---

### Component 3: Data Fetcher — `lib/data/revenue-impact.ts`

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  computeRevenueImpact,
  DEFAULT_REVENUE_CONFIG,
  type RevenueImpactInput,
  type RevenueImpactResult,
} from '@/lib/services/revenue-impact.service';

/**
 * Fetch revenue impact data and compute the estimate.
 */
export async function fetchRevenueImpact(
  supabase: SupabaseClient<Database>,
  orgId: string,
  locationId: string,
): Promise<RevenueImpactResult> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    locationResult,
    targetQueriesResult,
    sovEvalsResult,
    hallucinationsResult,
    competitorEvalsResult,
  ] = await Promise.all([
    // Revenue config from location
    supabase
      .from('locations')
      .select('avg_customer_value, monthly_covers')
      .eq('id', locationId)
      .eq('org_id', orgId)
      .single(),

    // All target queries
    supabase
      .from('target_queries')
      .select('id, query_text, query_category')
      .eq('org_id', orgId)
      .eq('location_id', locationId),

    // Recent SOV evaluations for gap detection
    supabase
      .from('sov_evaluations')
      .select('query_id, engine, rank_position')
      .eq('org_id', orgId)
      .eq('location_id', locationId)
      .gte('created_at', thirtyDaysAgo.toISOString()),

    // Open hallucinations
    supabase
      .from('ai_hallucinations')
      .select('claim_text, severity')
      .eq('org_id', orgId)
      .eq('correction_status', 'open'),

    // Competitor SOV data — mentioned_competitors from recent evaluations
    supabase
      .from('sov_evaluations')
      .select('rank_position, mentioned_competitors')
      .eq('org_id', orgId)
      .eq('location_id', locationId)
      .gte('created_at', thirtyDaysAgo.toISOString()),
  ]);

  // ── Revenue config ──
  const loc = locationResult.data;
  const config = {
    avgCustomerValue: loc?.avg_customer_value ?? DEFAULT_REVENUE_CONFIG.avgCustomerValue,
    monthlyCovers: loc?.monthly_covers ?? DEFAULT_REVENUE_CONFIG.monthlyCovers,
  };

  // ── SOV gaps ──
  const queries = targetQueriesResult.data ?? [];
  const evals = sovEvalsResult.data ?? [];

  const evalsByQuery = new Map<string, typeof evals>();
  for (const e of evals) {
    const arr = evalsByQuery.get(e.query_id) ?? [];
    arr.push(e);
    evalsByQuery.set(e.query_id, arr);
  }

  const sovGaps = queries
    .map(q => {
      const qEvals = evalsByQuery.get(q.id) ?? [];
      const engines = new Set(qEvals.map(e => e.engine));
      const missingCount = qEvals.filter(e => e.rank_position === null).length;
      return {
        queryText: q.query_text,
        queryCategory: q.query_category,
        missingEngineCount: engines.size > 0 ? missingCount : 0,
        totalEngineCount: engines.size,
      };
    })
    .filter(g => g.missingEngineCount > 0);

  // ── Hallucinations ──
  const openHallucinations = (hallucinationsResult.data ?? []).map(h => ({
    claimText: h.claim_text,
    severity: h.severity ?? 'medium',
  }));

  // ── Competitor data ──
  const compEvals = competitorEvalsResult.data ?? [];

  // Calculate your SOV: % of evals where you're ranked
  const totalEvals = compEvals.length;
  const rankedEvals = compEvals.filter(e => e.rank_position !== null).length;
  const yourSov = totalEvals > 0 ? rankedEvals / totalEvals : null;

  // Find top competitor SOV from mentioned_competitors
  const competitorMentions = new Map<string, number>();
  for (const e of compEvals) {
    const competitors = (e.mentioned_competitors as Array<{ name?: string }>) ?? [];
    for (const c of competitors) {
      if (c.name) {
        competitorMentions.set(c.name, (competitorMentions.get(c.name) ?? 0) + 1);
      }
    }
  }

  let topCompetitorName: string | null = null;
  let topCompetitorSov: number | null = null;
  for (const [name, count] of competitorMentions) {
    const sov = totalEvals > 0 ? count / totalEvals : 0;
    if (topCompetitorSov === null || sov > topCompetitorSov) {
      topCompetitorSov = sov;
      topCompetitorName = name;
    }
  }

  const input: RevenueImpactInput = {
    config,
    sovGaps,
    openHallucinations,
    competitorData: {
      yourSov,
      topCompetitorSov,
      topCompetitorName,
    },
  };

  return computeRevenueImpact(input);
}
```

---

### Component 4: Revenue Config Server Action — `app/dashboard/revenue-impact/actions.ts`

Server action for updating revenue config on the location.

```typescript
'use server';

import { z } from 'zod';
import { getSafeAuthContext } from '@/lib/auth-context';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const RevenueConfigSchema = z.object({
  locationId: z.string().uuid(),
  avgCustomerValue: z.number().min(1).max(10000),
  monthlyCovers: z.number().int().min(1).max(100000),
});

export async function updateRevenueConfig(formData: FormData) {
  const ctx = await getSafeAuthContext();
  const supabase = await createClient();

  const parsed = RevenueConfigSchema.parse({
    locationId: formData.get('locationId'),
    avgCustomerValue: Number(formData.get('avgCustomerValue')),
    monthlyCovers: Number(formData.get('monthlyCovers')),
  });

  // Verify location belongs to user's org (§18)
  const { error } = await supabase
    .from('locations')
    .update({
      avg_customer_value: parsed.avgCustomerValue,
      monthly_covers: parsed.monthlyCovers,
    })
    .eq('id', parsed.locationId)
    .eq('org_id', ctx.orgId);

  if (error) throw new Error('Failed to update revenue config');

  revalidatePath('/dashboard/revenue-impact');
}
```

---

### Component 5: Dashboard Page — `app/dashboard/revenue-impact/page.tsx`

Server Component.

```
Page Layout:
┌──────────────────────────────────────────────────────┐
│ 💰 Revenue Impact Calculator                         │
│ Estimated revenue at risk from AI visibility gaps    │
├──────────────────────────────────────────────────────┤
│                                                      │
│ ┌─── Hero Number ────────────────────────────────┐   │
│ │        $2,400/mo                                │   │
│ │   Estimated Recoverable Revenue                │   │
│ │        ($28,800/year)                          │   │
│ └────────────────────────────────────────────────┘   │
│                                                      │
│ ── Breakdown ─────────────────────────────────────   │
│                                                      │
│ ┌ 📉 SOV Gaps ─────────────────── $1,350/mo ─────┐  │
│ │   You're invisible for 5 queries that drive     │  │
│ │   ~270 AI-assisted visits/month                 │  │
│ │   ▸ "hookah near me" (3/3 engines missing)     │  │
│ │   ▸ "late night lounge Alpharetta" (2/3)       │  │
│ └─────────────────────────────────────────────────┘  │
│                                                      │
│ ┌ 🔴 Hallucination Impact ────── $675/mo ────────┐  │
│ │   3 active hallucinations may deter             │  │
│ │   ~15 potential customers/month                 │  │
│ │   ▸ "closes at 10pm" (high)                    │  │
│ │   ▸ "permanently closed" (critical)            │  │
│ └─────────────────────────────────────────────────┘  │
│                                                      │
│ ┌ ⚔️ Competitor Advantage ────── $375/mo ────────┐  │
│ │   Cloud 9 Lounge recommended 23% more often     │  │
│ │   Your SOV: 19% vs Cloud 9: 24%                │  │
│ └─────────────────────────────────────────────────┘  │
│                                                      │
│ ── Revenue Settings ─────────────────────────────    │
│                                                      │
│ ┌ Avg customer value:  [$45____]                  ┐  │
│ │ Monthly covers:      [800_____]                 │  │
│ │ ⓘ Using default estimates. Customize for        │  │
│ │   more accurate projections.                    │  │
│ │ [Save Settings]                                 │  │
│ └─────────────────────────────────────────────────┘  │
│                                                      │
│ Empty state: "Not enough data yet. Revenue impact    │
│ is calculated from your SOV evaluations, hallucina-  │
│ tion tracking, and competitor analysis. Run your     │
│ first SOV queries to unlock revenue projections."    │
└──────────────────────────────────────────────────────┘
```

**Sub-Components:**

**`RevenueHeroCard`** — Large centered dollar amount. Green text. Monthly and annual figures. Pulsing animation if > $0 to draw attention.

**`RevenueLineItemCard`** — Per-category card. Category emoji + label, dollar amount on right, description text, expandable detail section showing individual queries/hallucinations. Color-coded: sov_gap=blue, hallucination=red, competitor=amber.

**`RevenueConfigForm`** — Client Component (`'use client'`). Two number inputs (avg customer value, monthly covers). Server action on submit. Shows "Using defaults" notice when `isDefaultConfig = true`. Validates inputs client-side (positive numbers, reasonable ranges).

**Category emoji:**
```typescript
const CATEGORY_EMOJI: Record<string, string> = {
  sov_gap: '📉',
  hallucination: '🔴',
  competitor: '⚔️',
};
```

**Empty state:** When `totalMonthlyRevenue === 0` AND no SOV data exists, show empty state message.

**Zero revenue state:** When data exists but all gaps are zero, show positive message: "Your AI visibility is strong! No significant revenue gaps detected."

---

### Component 6: Error Boundary + Sidebar

`app/dashboard/revenue-impact/error.tsx` — Standard error boundary.

Sidebar entry:
```typescript
{
  label: 'Revenue Impact',
  href: '/dashboard/revenue-impact',
  icon: DollarSign,  // from lucide-react
  testId: 'nav-revenue-impact',
}
```

Place under the PROVE section of the sidebar.

---

### Component 7: Golden Tenant Fixtures — `src/__fixtures__/golden-tenant.ts`

```typescript
import type { RevenueImpactInput } from '@/lib/services/revenue-impact.service';

/**
 * Sprint 85 — Canonical RevenueImpactInput for Charcoal N Chill.
 * $45 avg customer, 800 covers. 3 SOV gaps, 2 hallucinations, competitor advantage.
 */
export const MOCK_REVENUE_IMPACT_INPUT: RevenueImpactInput = {
  config: {
    avgCustomerValue: 45,
    monthlyCovers: 800,
  },
  sovGaps: [
    { queryText: 'hookah near me', queryCategory: 'near_me', missingEngineCount: 3, totalEngineCount: 3 },
    { queryText: 'private event venue Alpharetta', queryCategory: 'discovery', missingEngineCount: 3, totalEngineCount: 3 },
    { queryText: 'late night lounge Alpharetta', queryCategory: 'discovery', missingEngineCount: 2, totalEngineCount: 3 },
  ],
  openHallucinations: [
    { claimText: 'Charcoal N Chill closes at 10pm', severity: 'high' },
    { claimText: 'Charcoal N Chill is permanently closed', severity: 'critical' },
  ],
  competitorData: {
    yourSov: 0.19,
    topCompetitorSov: 0.24,
    topCompetitorName: 'Cloud 9 Lounge',
  },
};
```

---

### Component 8: Seed Data — `supabase/seed.sql`

Update the existing seed location for Charcoal N Chill to include revenue config:

```sql
-- Sprint 85: Add revenue config to seed location
UPDATE public.locations
SET avg_customer_value = 45.00,
    monthly_covers = 800
WHERE business_name = 'Charcoal N Chill';
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/revenue-impact-service.test.ts`

**Target: `lib/services/revenue-impact.service.ts`**

```
describe('computeRevenueImpact')
  Empty input:
  1.  returns 0 total for empty gaps/hallucinations/no competitor advantage
  2.  returns empty lineItems for zero impact
  3.  annualRevenue is 12x monthly

  SOV gap revenue:
  4.  computes revenue for near_me queries (120 volume × 0.08 CTR × $45)
  5.  computes revenue for discovery queries (90 volume × 0.08 CTR × $45)
  6.  computes revenue for occasion queries (45 volume)
  7.  computes revenue for comparison queries (60 volume)
  8.  falls back to custom volume for unknown category
  9.  scales by gap ratio (2/3 engines missing = 2/3 impact)
  10. sums revenue across all gap queries
  11. creates line item with correct query count
  12. description includes estimated visits

  Hallucination revenue:
  13. critical severity deters 8 customers
  14. high severity deters 5 customers
  15. medium severity deters 2 customers
  16. low severity deters 1 customer
  17. defaults to low for unknown severity
  18. sums deterred customers across all hallucinations
  19. computes revenue as deterred × avgCustomerValue
  20. creates line item with hallucination count

  Competitor revenue:
  21. computes competitor advantage ratio correctly
  22. multiplies advantage by monthlyCovers × AI_INFLUENCE_RATE × avgCustomerValue
  23. handles zero yourSov (100% competitor advantage, capped)
  24. skips competitor line item when no competitor data
  25. skips when competitor SOV <= your SOV (no advantage)
  26. includes competitor name in description

  Config:
  27. uses provided avgCustomerValue for all calculations
  28. uses provided monthlyCovers for competitor calc
  29. isDefaultConfig true when matching DEFAULT_REVENUE_CONFIG
  30. isDefaultConfig false when config differs from default

  Integration:
  31. produces expected result from MOCK_REVENUE_IMPACT_INPUT
  32. MOCK total is sum of all three categories
  33. all three line items present in MOCK result

describe('helpers')
  34. roundTo rounds to specified decimals
  35. truncate shortens long text with ellipsis
```

**35 tests total. All pure functions.**

### Test File 2: `src/__tests__/unit/revenue-impact-data.test.ts`

**Target: `lib/data/revenue-impact.ts`**

```
describe('fetchRevenueImpact')
  1.  runs 5 parallel queries
  2.  scopes all queries by org_id (§18)
  3.  falls back to DEFAULT_REVENUE_CONFIG when location fields null
  4.  computes SOV gaps from evaluations with null rank_position
  5.  fetches open hallucinations (correction_status=open)
  6.  computes your SOV from ranked/total evaluations
  7.  finds top competitor from mentioned_competitors
  8.  handles empty data gracefully (no evaluations)
  9.  returns RevenueImpactResult on happy path
```

**9 tests total.**

### Test File 3: `src/__tests__/unit/revenue-impact-page.test.ts`

**Target: Dashboard page, config form, sidebar**

```
describe('Revenue Impact page')
  1.  renders hero dollar amount
  2.  renders annual projection
  3.  renders SOV gap line item card
  4.  renders hallucination line item card
  5.  renders competitor line item card
  6.  renders revenue config form with inputs
  7.  renders "using defaults" notice when isDefaultConfig
  8.  renders empty state when no data
  9.  renders positive message when zero revenue impact

describe('Sidebar')
  10. shows Revenue Impact link with test-id nav-revenue-impact
```

**10 tests total.**

### Test File 4: `src/__tests__/unit/revenue-config-action.test.ts`

**Target: `app/dashboard/revenue-impact/actions.ts`**

```
describe('updateRevenueConfig')
  1.  updates location with new config values
  2.  validates avgCustomerValue is positive
  3.  validates monthlyCovers is positive integer
  4.  scopes update by org_id (§18)
  5.  revalidates /dashboard/revenue-impact path
  6.  throws on Supabase error
```

**6 tests total.**

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `supabase/migrations/20260226000012_revenue_config.sql` | **CREATE** | Add avg_customer_value + monthly_covers to locations |
| 2 | `lib/supabase/database.types.ts` | **MODIFY** | Add new columns to locations type |
| 3 | `lib/services/revenue-impact.service.ts` | **CREATE** | Pure revenue calculation — SOV gaps, hallucinations, competitor advantage (~250 lines) |
| 4 | `lib/data/revenue-impact.ts` | **CREATE** | Data fetcher — 5 parallel queries, SOV gap + competitor computation |
| 5 | `app/dashboard/revenue-impact/page.tsx` | **CREATE** | Dashboard — hero number, line items, config form |
| 6 | `app/dashboard/revenue-impact/actions.ts` | **CREATE** | Server action for revenue config update |
| 7 | `app/dashboard/revenue-impact/error.tsx` | **CREATE** | Error boundary |
| 8 | `app/dashboard/_components/` | **MODIFY** | Sidebar — add Revenue Impact link |
| 9 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | Add MOCK_REVENUE_IMPACT_INPUT |
| 10 | `supabase/seed.sql` | **MODIFY** | Add revenue config to seed location |
| 11 | `src/__tests__/unit/revenue-impact-service.test.ts` | **CREATE** | 35 tests — pure calculation |
| 12 | `src/__tests__/unit/revenue-impact-data.test.ts` | **CREATE** | 9 tests — data layer |
| 13 | `src/__tests__/unit/revenue-impact-page.test.ts` | **CREATE** | 10 tests — page + sidebar |
| 14 | `src/__tests__/unit/revenue-config-action.test.ts` | **CREATE** | 6 tests — server action |

**Expected test count: 60 new tests across 4 files.**

---

## 🚫 What NOT to Do

1. **DO NOT present revenue figures as guaranteed.** These are ESTIMATES. The UI must use language like "estimated", "approximately", "projected". Never claim exact lost revenue.
2. **DO NOT use AI to generate the revenue calculations.** All math is deterministic from constants and data. No hallucination risk.
3. **DO NOT create a new analytics table.** Revenue impact is computed at page load from existing signal tables. The only new columns are the config fields on `locations`.
4. **DO NOT hardcode revenue config.** Use the location's `avg_customer_value` and `monthly_covers` if set, fall back to `DEFAULT_REVENUE_CONFIG`.
5. **DO NOT add plan gating.** Revenue Impact is available to all tiers — showing dollar amounts to Trial users drives conversion ("you're losing $2,400/month, upgrade to fix it").
6. **DO NOT use `as any` on Supabase clients** (§38.2).
7. **DO NOT use `createClient()` in wrong context** — the page is a Server Component using RLS-scoped client. The server action uses `getSafeAuthContext()` (§3).
8. **DO NOT mutate data on page load** (§5). Revenue config update is a separate server action triggered by user submission.
9. **DO NOT import the service into the data layer or vice versa.** Service = pure functions. Data layer imports service, not the other way around.

---

## ✅ Definition of Done (AI_RULES §13.5)

- [ ] Migration adds `avg_customer_value` + `monthly_covers` to `locations`
- [ ] `database.types.ts` updated with new columns
- [ ] `computeRevenueImpact()` pure function with SOV gap, hallucination, and competitor revenue
- [ ] Constants exported: `CATEGORY_SEARCH_VOLUME`, `AI_RECOMMENDATION_CTR`, `AI_INFLUENCE_RATE`, `SEVERITY_IMPACT`
- [ ] `fetchRevenueImpact()` with 5 parallel queries + competitor SOV computation
- [ ] Dashboard at `/dashboard/revenue-impact` — hero number, line items, config form
- [ ] `updateRevenueConfig()` server action with Zod validation + org scoping
- [ ] Empty state + zero-impact positive message
- [ ] Sidebar entry "Revenue Impact" (test-id: `nav-revenue-impact`)
- [ ] Golden Tenant: MOCK_REVENUE_IMPACT_INPUT
- [ ] Seed data updated with revenue config
- [ ] 60 tests passing across 4 files
- [ ] `npx vitest run` — ALL tests passing, no regressions
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] DEVLOG.md entry written

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## 2026-02-28 — Sprint 85: Revenue Impact Calculator (Completed)

**Goal:** Build a Revenue Impact Calculator that converts abstract visibility scores into estimated dollar amounts. Three revenue categories: SOV gaps (missed AI-assisted visits), hallucination deterrence (customers lost to inaccurate info), and competitor advantage (diverted covers). The PROVE-stage feature that drives subscription renewals.

**Scope:**
- `supabase/migrations/20260226000012_revenue_config.sql` — **NEW.** Adds `avg_customer_value` (numeric, default 45.00) and `monthly_covers` (integer, default 800) to `locations` table.
- `lib/services/revenue-impact.service.ts` — **NEW.** ~250 lines, all pure functions. `computeRevenueImpact()` entry point. Three revenue streams: SOV gap revenue (category-specific search volumes × CTR × gap ratio × avg customer value), hallucination revenue (severity-based deterrence × avg customer value), competitor revenue (advantage ratio × monthly covers × AI influence rate × avg customer value). Constants: `CATEGORY_SEARCH_VOLUME` (discovery=90, near_me=120, etc.), `AI_RECOMMENDATION_CTR` (8%), `AI_INFLUENCE_RATE` (5%), `SEVERITY_IMPACT` (critical=8, high=5, medium=2, low=1). Exports `DEFAULT_REVENUE_CONFIG`. All constants exported for testing.
- `lib/data/revenue-impact.ts` — **NEW.** `fetchRevenueImpact()` — 5 parallel queries (location config, target queries, SOV evaluations, hallucinations, competitor evaluations). Computes SOV gaps from null rank_position. Finds top competitor from `mentioned_competitors` JSONB. Falls back to `DEFAULT_REVENUE_CONFIG` when location fields null.
- `app/dashboard/revenue-impact/page.tsx` — **NEW.** Server Component. RevenueHeroCard (large dollar amount + annual projection), RevenueLineItemCard per category (emoji, label, dollar amount, description, expandable detail), RevenueConfigForm (client component, number inputs, server action submit). Empty state + zero-impact positive message.
- `app/dashboard/revenue-impact/actions.ts` — **NEW.** `updateRevenueConfig()` server action. Zod validation, org-scoped update, revalidatePath.
- `app/dashboard/revenue-impact/error.tsx` — **NEW.** Standard error boundary.
- Sidebar — **MODIFIED.** Added "Revenue Impact" link (test-id: nav-revenue-impact).
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added `MOCK_REVENUE_IMPACT_INPUT` (3 SOV gaps, 2 hallucinations, competitor advantage).
- `supabase/seed.sql` — **MODIFIED.** Added revenue config to seed location.
- `lib/supabase/database.types.ts` — **MODIFIED.** Added `avg_customer_value` and `monthly_covers` to locations type.

**Tests added:**
- `src/__tests__/unit/revenue-impact-service.test.ts` — **N tests.** SOV gap revenue, hallucination revenue, competitor revenue, config, helpers, MOCK integration.
- `src/__tests__/unit/revenue-impact-data.test.ts` — **N tests.** Parallel queries, org scoping, SOV gap computation, competitor detection.
- `src/__tests__/unit/revenue-impact-page.test.ts` — **N tests.** Hero number, line items, config form, empty state, sidebar.
- `src/__tests__/unit/revenue-config-action.test.ts` — **N tests.** Validation, org scoping, revalidation.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/revenue-impact-service.test.ts      # N tests passing
npx vitest run src/__tests__/unit/revenue-impact-data.test.ts         # N tests passing
npx vitest run src/__tests__/unit/revenue-impact-page.test.ts         # N tests passing
npx vitest run src/__tests__/unit/revenue-config-action.test.ts       # N tests passing
npx vitest run                                                         # All tests passing
```

**Note:** Replace N with actual test counts verified via `grep -cE "^\s*(it|test)\("` (AI_RULES §13.3).
```

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| `sov_evaluations` per-engine | Sprint 41+ | Rank position + mentioned_competitors for SOV gaps + competitor data |
| `target_queries` per-org | Sprint 41+ | Query text + category for search volume mapping |
| `ai_hallucinations` lifecycle | Sprint 68+ | Open hallucinations with severity |
| `visibility_analytics` | Sprint 41 | Historical SOV for trend context |
| `locations` table | Base schema | Business data, now extended with revenue config |
| Content Calendar (Sprint 83) | Sprint 83 | SOV gap computation pattern (reuse) |
| Before/After Timeline (Sprint 76) | Sprint 76 | PROVE-stage dashboard pattern reference |

---

## 🧠 Edge Cases

1. **Brand new org (no SOV data):** All gaps are zero, competitor data is null. Revenue = $0. Empty state shown.
2. **No hallucinations:** Hallucination category doesn't appear. Only SOV gap + competitor categories.
3. **No competitor advantage (you're winning):** Competitor category doesn't appear. Positive signal.
4. **All queries ranked by all engines:** SOV gap revenue = $0. Only hallucination + competitor categories if applicable.
5. **Your SOV is 0:** Competitor advantage formula handles this — if yourSov = 0 and competitor has any SOV, advantage = 100% (capped to avoid absurd numbers since `divertedCovers` is bounded by `monthlyCovers * AI_INFLUENCE_RATE`).
6. **Revenue config not set (null):** Falls back to `DEFAULT_REVENUE_CONFIG` ($45 avg, 800 covers). `isDefaultConfig` flag tells UI to show "using estimates" notice.
7. **User sets extreme values:** Server action validates: `avgCustomerValue` 1-10000, `monthlyCovers` 1-100000. Reasonable bounds.
8. **Zero total revenue (all data exists but no gaps):** Show positive message: "Your AI visibility is strong! No significant revenue gaps detected."
9. **Only one category has revenue:** lineItems array contains only that category's item. Other categories don't appear as zero-value entries — clean UI.

---

## 🔮 AI_RULES Updates

Add new rule:

```markdown
## 48. 💰 Revenue Impact Calculator (Sprint 85)

Converts visibility gaps into estimated dollar amounts.

* **Migration:** `20260226000012_revenue_config.sql` adds `avg_customer_value` (numeric, default 45.00) and `monthly_covers` (integer, default 800) to `locations`.
* **Pure service:** `computeRevenueImpact()` — three revenue streams:
  - SOV Gap: `CATEGORY_SEARCH_VOLUME[category] × AI_RECOMMENDATION_CTR × gapRatio × avgCustomerValue`
  - Hallucination: `SEVERITY_IMPACT[severity] × avgCustomerValue`
  - Competitor: `monthlyCovers × competitorAdvantage × AI_INFLUENCE_RATE × avgCustomerValue`
* **Constants are estimates, not guarantees.** UI must use "estimated", "approximately", "projected" language.
* **Revenue config:** User-customizable `avg_customer_value` + `monthly_covers` on `locations`. Falls back to `DEFAULT_REVENUE_CONFIG` when null.
* **No plan gating.** Dollar amounts drive Trial → Paid conversion.
```
