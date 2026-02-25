# Claude Code Prompt #7 — Feature #1: Revenue Leak Scorecard

## ⚠️ READ BEFORE ANYTHING ELSE

Read these files in order BEFORE writing any code:
1. `docs/AI_RULES.md` — coding standards (critical: §1 schema, §3 auth, §4 testing, §5 plan gating, §6 architecture, §7 UUID hex, §8 Zod v4)
2. `docs/DESIGN-SYSTEM.md` — visual tokens and component patterns
3. `supabase/prod_schema.sql` — database source of truth
4. `src/__fixtures__/golden-tenant.ts` — test fixture data
5. `app/dashboard/page.tsx` — existing dashboard (you'll extend it)

## What This Feature Does

The Revenue Leak Scorecard converts every AI inaccuracy into a dollar figure. Instead of abstract metrics ("3 hallucinations, 42% SOV"), the user sees:

> **"AI is costing you $2,400 – $4,100/month in lost revenue"**

It's the #1 differentiator for LocalVector. It transforms a monitoring dashboard into a revenue recovery platform.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  DB Migration: revenue_config + revenue_snapshots tables │
├─────────────────────────────────────────────────────────┤
│  Service: lib/services/revenue-leak.service.ts           │
│    ├─ calculateRevenueLeak(orgId, locationId)            │
│    ├─ estimateHallucinationCost(severity, avgTicket)     │
│    └─ estimateSOVGapCost(sovPercent, marketSize)         │
├─────────────────────────────────────────────────────────┤
│  Server Action: app/dashboard/actions.ts (extend)        │
│    └─ getRevenueLeakData() — calls service, returns DTO  │
├─────────────────────────────────────────────────────────┤
│  UI Components:                                          │
│    ├─ RevenueLeakCard.tsx — main scorecard hero           │
│    ├─ LeakBreakdownChart.tsx — BarChart of leak sources   │
│    └─ LeakTrendChart.tsx — AreaChart of leak over time    │
├─────────────────────────────────────────────────────────┤
│  Tests:                                                  │
│    ├─ revenue-leak.service.test.ts — pure function tests  │
│    ├─ revenue-leak-action.test.ts — server action tests   │
│    └─ E2E: 09-revenue-leak.spec.ts — full flow           │
└─────────────────────────────────────────────────────────┘
```

---

## Phase 1: Database Migration

### 1A — Create migration file

Create `supabase/migrations/20260225000001_revenue_leak.sql`:

```sql
-- ============================================================
-- Revenue Leak Scorecard — Feature #1
-- Adds business revenue config and leak snapshot tracking.
-- ============================================================

-- ── Revenue configuration per location ──────────────────────
-- Stores the business-specific inputs needed for revenue leak
-- calculation. Populated during onboarding or settings.
CREATE TABLE IF NOT EXISTS public.revenue_config (
    id              uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    location_id     uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    
    -- Business revenue inputs
    business_type   varchar(50) NOT NULL DEFAULT 'restaurant',
    avg_ticket      numeric(10,2) NOT NULL DEFAULT 45.00,
    monthly_searches integer NOT NULL DEFAULT 2000,
    local_conversion_rate numeric(5,4) NOT NULL DEFAULT 0.0300,
    walk_away_rate  numeric(5,4) NOT NULL DEFAULT 0.6500,
    
    -- Metadata
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),
    
    UNIQUE(org_id, location_id)
);

ALTER TABLE public.revenue_config OWNER TO postgres;

-- RLS: org isolation
ALTER TABLE public.revenue_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON public.revenue_config
    FOR SELECT USING (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_insert" ON public.revenue_config
    FOR INSERT WITH CHECK (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_update" ON public.revenue_config
    FOR UPDATE USING (org_id = public.current_user_org_id());

-- ── Revenue leak snapshots ──────────────────────────────────
-- Stores calculated revenue leak per snapshot date.
-- Written by the SOV cron after each evaluation cycle.
CREATE TABLE IF NOT EXISTS public.revenue_snapshots (
    id              uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    location_id     uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    
    -- Calculated values
    leak_low        numeric(10,2) NOT NULL DEFAULT 0,
    leak_high       numeric(10,2) NOT NULL DEFAULT 0,
    
    -- Breakdown components (JSONB for flexibility)
    breakdown       jsonb NOT NULL DEFAULT '{}',
    
    -- Inputs snapshot (frozen at calculation time)
    inputs_snapshot jsonb NOT NULL DEFAULT '{}',
    
    snapshot_date   date NOT NULL,
    created_at      timestamptz DEFAULT now(),
    
    UNIQUE(org_id, location_id, snapshot_date)
);

ALTER TABLE public.revenue_snapshots OWNER TO postgres;

-- RLS: org isolation
ALTER TABLE public.revenue_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON public.revenue_snapshots
    FOR SELECT USING (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_insert" ON public.revenue_snapshots
    FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
```

### 1B — Update seed.sql

Add to `supabase/seed.sql` at the end, inside a new section comment block.

Add these UUIDs to the reference card at the top:
```
--   revenue_config : d2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   rev_snapshot_1 : d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   rev_snapshot_2 : d4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   rev_snapshot_3 : d5eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
```

Then add the seed data:
```sql
-- ── REVENUE LEAK CONFIG (Feature #1) ─────────────────────────────────────────
INSERT INTO public.revenue_config (
    id, org_id, location_id, business_type, avg_ticket,
    monthly_searches, local_conversion_rate, walk_away_rate
) VALUES (
    'd2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    (SELECT id FROM public.locations WHERE slug = 'alpharetta' LIMIT 1),
    'restaurant', 47.50, 2400, 0.0320, 0.6500
) ON CONFLICT (org_id, location_id) DO NOTHING;

-- ── REVENUE SNAPSHOTS (3 weeks of mock data) ─────────────────────────────────
INSERT INTO public.revenue_snapshots (
    id, org_id, location_id, leak_low, leak_high, breakdown, inputs_snapshot, snapshot_date
) VALUES
(
    'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    (SELECT id FROM public.locations WHERE slug = 'alpharetta' LIMIT 1),
    2100.00, 3800.00,
    '{"hallucination_cost":{"low":800,"high":1400},"sov_gap_cost":{"low":900,"high":1600},"competitor_steal_cost":{"low":400,"high":800}}',
    '{"avg_ticket":47.50,"monthly_searches":2400,"local_conversion_rate":0.032,"walk_away_rate":0.65}',
    CURRENT_DATE - INTERVAL '14 days'
),
(
    'd4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    (SELECT id FROM public.locations WHERE slug = 'alpharetta' LIMIT 1),
    2400.00, 4100.00,
    '{"hallucination_cost":{"low":900,"high":1500},"sov_gap_cost":{"low":1000,"high":1700},"competitor_steal_cost":{"low":500,"high":900}}',
    '{"avg_ticket":47.50,"monthly_searches":2400,"local_conversion_rate":0.032,"walk_away_rate":0.65}',
    CURRENT_DATE - INTERVAL '7 days'
),
(
    'd5eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    (SELECT id FROM public.locations WHERE slug = 'alpharetta' LIMIT 1),
    2600.00, 4400.00,
    '{"hallucination_cost":{"low":1000,"high":1700},"sov_gap_cost":{"low":1100,"high":1800},"competitor_steal_cost":{"low":500,"high":900}}',
    '{"avg_ticket":47.50,"monthly_searches":2400,"local_conversion_rate":0.032,"walk_away_rate":0.65}',
    CURRENT_DATE
) ON CONFLICT (org_id, location_id, snapshot_date) DO NOTHING;
```

---

## Phase 2: Revenue Leak Calculation Service

Create `lib/services/revenue-leak.service.ts`:

This is a **pure function** service with **zero side effects** (AI_RULES §6: business logic in `lib/services/` never creates its own Supabase client).

### Revenue Leak Model

The model has 3 cost components that sum to the total leak:

**1. Hallucination Cost** — Active inaccuracies drive customers away
```
For each open hallucination:
  critical: avg_ticket × 2.0 × walk_away_rate (per day, ×30 for monthly)
  high:     avg_ticket × 1.0 × walk_away_rate
  medium:   avg_ticket × 0.3 × walk_away_rate
  low:      avg_ticket × 0.1 × walk_away_rate

Range: low = sum × 0.6, high = sum × 1.0
```

**2. SOV Gap Cost** — Missing from AI recommendations
```
ideal_sov = 0.25 (top-4 position in a typical market)
sov_gap = max(0, ideal_sov - actual_sov)
missed_customers = monthly_searches × sov_gap × local_conversion_rate
cost = missed_customers × avg_ticket

Range: low = cost × 0.7, high = cost × 1.2
```

**3. Competitor Steal Cost** — Competitors mentioned instead of you
```
For each competitor intercept where you lost:
  steal_per_intercept = avg_ticket × local_conversion_rate × monthly_searches / queries_count × 0.1

Range: low = sum × 0.5, high = sum × 1.0
```

### Service Interface

```typescript
// lib/services/revenue-leak.service.ts

export interface RevenueConfig {
  avg_ticket: number;
  monthly_searches: number;
  local_conversion_rate: number;
  walk_away_rate: number;
}

export interface HallucinationInput {
  severity: 'critical' | 'high' | 'medium' | 'low';
  correction_status: string;
}

export interface CompetitorInput {
  winner: string | null;
  business_name: string;
}

export interface LeakBreakdown {
  hallucination_cost: { low: number; high: number };
  sov_gap_cost: { low: number; high: number };
  competitor_steal_cost: { low: number; high: number };
}

export interface RevenueLeak {
  leak_low: number;
  leak_high: number;
  breakdown: LeakBreakdown;
}

export const DEFAULT_CONFIG: RevenueConfig = {
  avg_ticket: 45.00,
  monthly_searches: 2000,
  local_conversion_rate: 0.03,
  walk_away_rate: 0.65,
};

export function calculateHallucinationCost(
  hallucinations: HallucinationInput[],
  config: RevenueConfig,
): { low: number; high: number } { ... }

export function calculateSOVGapCost(
  actualSOV: number, // 0.0 - 1.0
  config: RevenueConfig,
): { low: number; high: number } { ... }

export function calculateCompetitorStealCost(
  intercepts: CompetitorInput[],
  totalQueries: number,
  config: RevenueConfig,
): { low: number; high: number } { ... }

export function calculateRevenueLeak(
  hallucinations: HallucinationInput[],
  actualSOV: number,
  intercepts: CompetitorInput[],
  totalQueries: number,
  config: RevenueConfig,
): RevenueLeak { ... }
```

**CRITICAL:** Every number must be `Math.round()` to 2 decimal places before returning. Use `Math.round(x * 100) / 100` — NOT `toFixed(2)` which returns a string.

---

## Phase 3: Unit Tests for Service (Write FIRST — AI_RULES §4)

Create `src/__tests__/unit/revenue-leak-service.test.ts`:

Tests to write (every test uses data from golden-tenant.ts fixture):

```
describe('revenue-leak.service')
  describe('calculateHallucinationCost')
    ✓ returns {low:0, high:0} when hallucinations array is empty
    ✓ calculates cost for single critical hallucination
    ✓ calculates cost for mixed severities (critical + high + medium)
    ✓ only counts open hallucinations (ignores fixed/dismissed)
    ✓ low estimate is 60% of high estimate
    
  describe('calculateSOVGapCost')
    ✓ returns {low:0, high:0} when SOV >= 0.25 (ideal)
    ✓ calculates gap cost when SOV is 0.10 (below ideal)
    ✓ handles SOV of 0 (not mentioned at all)
    ✓ handles SOV of 1.0 (dominates — no gap)
    
  describe('calculateCompetitorStealCost')
    ✓ returns {low:0, high:0} when no intercepts
    ✓ returns {low:0, high:0} when business wins all intercepts
    ✓ calculates steal cost when competitors win
    ✓ handles mix of wins and losses
    
  describe('calculateRevenueLeak')
    ✓ sums all three components correctly
    ✓ returns all zeros when no issues exist
    ✓ handles golden tenant realistic scenario (2 hallucinations, 0.42 SOV, 1 lost intercept)
    ✓ leak_low <= leak_high always
```

Use `GOLDEN_TENANT` fixture for business context (avg_ticket ≈ $47.50 for a hookah lounge + fusion restaurant).

**Testing approach:** These are pure functions. No mocking needed. Import directly, pass arguments, assert outputs. Every test should have explicit expected values calculated by hand.

---

## Phase 4: Dashboard Integration

### 4A — Extend app/dashboard/page.tsx

Add a new data fetch for revenue leak data inside `fetchDashboardData()`:

```typescript
// Inside the second Promise.all (Surgery 4 block), add:
const [revenueConfigResult, revenueSnapshotsResult] = await Promise.all([
  supabase
    .from('revenue_config')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle(),
    
  supabase
    .from('revenue_snapshots')
    .select('leak_low, leak_high, breakdown, snapshot_date')
    .eq('org_id', orgId)
    .order('snapshot_date', { ascending: true })
    .limit(12),
]);
```

Compute the live leak using the service:
```typescript
import { calculateRevenueLeak, DEFAULT_CONFIG, type RevenueConfig } from '@/lib/services/revenue-leak.service';

const config: RevenueConfig = revenueConfigResult.data ?? DEFAULT_CONFIG;
const currentSOV = visRow?.share_of_voice ?? 0;
const currentLeak = calculateRevenueLeak(
  rawOpen, currentSOV, 
  interceptCompResult.data ?? [], 
  targetQueryCount,
  config,
);
```

Pass `currentLeak` and `revenueSnapshots` to the page JSX.

### 4B — Create RevenueLeakCard component

Create `app/dashboard/_components/RevenueLeakCard.tsx`:

This is the hero card. Design spec:

```
┌─────────────────────────────────────────────────┐
│  📉 Revenue Leak Scorecard          Growth+     │
│                                                  │
│  AI is costing you                               │
│  $2,400 – $4,100 / month                       │
│         ▲ $200 from last week                    │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Inaccur. │  │ SOV Gap  │  │ Compete  │      │
│  │ $900-1500│  │$1000-1700│  │ $500-900 │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│                                                  │
│  [Configure Revenue Inputs ⚙️]                   │
└─────────────────────────────────────────────────┘
```

Design tokens:
- Card: `bg-surface-dark border border-white/5 rounded-2xl`
- Dollar amount: `text-alert-crimson text-3xl font-bold tabular-nums`
- Breakdown cards: `bg-midnight-slate rounded-xl px-4 py-3`
- "Configure" link: `text-electric-indigo hover:underline text-sm`
- Plan gate: Show lock overlay for trial/starter (use existing lock pattern from scan page)

### 4C — Create LeakBreakdownChart component

Create `app/dashboard/_components/LeakBreakdownChart.tsx`:

Uses the Tremor `BarChart` from `@/components/tremor`:
```typescript
import { BarChart } from '@/components/tremor';
```

Shows 3 horizontal bars: Inaccuracies, SOV Gap, Competitor Steal — each with low/high range.

### 4D — Create LeakTrendChart component

Create `app/dashboard/_components/LeakTrendChart.tsx`:

Uses the Tremor `AreaChart` from `@/components/tremor`:
```typescript
import { AreaChart } from '@/components/tremor';
```

Shows leak_high over the last 12 weeks as an area chart with signal-green fill when trending down, alert-crimson fill when trending up.

### 4E — Place components on dashboard

Insert `RevenueLeakCard` ABOVE the current AlertFeed in the Fear First layout:
```tsx
{/* Revenue Leak Scorecard — above everything else */}
<RevenueLeakCard
  leak={currentLeak}
  previousLeak={previousSnapshot}
  config={config}
  plan={orgPlan}
/>
```

Then add the charts in a new row below Quick Stats:
```tsx
<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
  <LeakBreakdownChart breakdown={currentLeak.breakdown} />
  <LeakTrendChart snapshots={revenueSnapshots} />
</div>
```

---

## Phase 5: Revenue Config Settings Page

Create `app/dashboard/settings/revenue/page.tsx`:

A simple form where the user can configure their revenue inputs:
- Average ticket size ($)
- Monthly local searches (estimated)
- Local conversion rate (%)
- Walk-away rate (%)

Use `react-hook-form` + `@hookform/resolvers` + `zod` for validation (already installed).

Server Action for saving: `saveRevenueConfig(formData)` — validates with Zod, upserts to `revenue_config`.

**Important:** Use `getSafeAuthContext()` (not `getAuthContext()`) per AI_RULES §3.

---

## Phase 6: Tests

### 6A — Server Action test

Create `src/__tests__/unit/revenue-leak-action.test.ts`:

Mock Supabase client (AI_RULES §4 mock patterns). Test:
```
✓ returns revenue leak data for authenticated user
✓ returns default config when no revenue_config row exists
✓ returns null leak when no hallucinations or SOV data
✓ returns error when user is unauthenticated
```

### 6B — E2E test

Create `tests/e2e/09-revenue-leak.spec.ts`:

Uses the dev@ golden tenant session (global.setup.ts). Tests:
```
describe('09 — Revenue Leak Scorecard')
  ✓ scorecard displays dollar range on dashboard
  ✓ breakdown shows three cost categories
  ✓ leak trend chart renders with seed data
  ✓ configure link navigates to /dashboard/settings/revenue
  ✓ revenue settings form saves and updates scorecard
```

**E2E seed dependency:** The seed data from Phase 1B must be present. The dev@ user's golden tenant has revenue_config and 3 revenue_snapshots.

---

## Phase 7: Verification Sequence

Run in this exact order:

```bash
# 1. Verify migration syntax
cat supabase/migrations/20260225000001_revenue_leak.sql

# 2. Verify seed additions compile
grep "revenue_config\|revenue_snapshots" supabase/seed.sql

# 3. Run unit tests
npm run test -- src/__tests__/unit/revenue-leak-service.test.ts

# 4. Run action tests
npm run test -- src/__tests__/unit/revenue-leak-action.test.ts

# 5. Full test suite (must not regress)
npm run test

# 6. Build
npm run build

# 7. E2E (only if local Supabase + Playwright available)
# npx playwright test tests/e2e/09-revenue-leak.spec.ts
```

**If any unit test fails:** Fix the service or test, not both. The service functions are pure — there's only one correct answer for each input.

**If build fails:** Check that all imports resolve. Common issues:
- `@/lib/services/revenue-leak.service` must exist
- `@/components/tremor` barrel export must resolve
- New dashboard components must have `'use client'` if they use hooks

---

## Commit Strategy

Split into 2 commits:

**Commit 1:**
```
feat: add Revenue Leak calculation service + DB migration

- Created revenue_config and revenue_snapshots tables with RLS
- Implemented pure revenue-leak.service.ts with 3-component model:
  hallucination cost, SOV gap cost, competitor steal cost
- Added seed data for golden tenant (config + 3 weekly snapshots)
- All unit tests passing (XX tests)
```

**Commit 2:**
```
feat: Revenue Leak Scorecard dashboard UI + settings

- RevenueLeakCard: hero card showing dollar range with trend delta
- LeakBreakdownChart: Tremor BarChart with 3 cost categories
- LeakTrendChart: Tremor AreaChart with 12-week trend
- Revenue config settings page with Zod-validated form
- E2E test for scorecard display and settings flow
```

---

## Rules

- Read AI_RULES.md and prod_schema.sql FIRST
- Tests FIRST, then implementation (Red-Green-Refactor — AI_RULES §4)
- Use `getSafeAuthContext()` in all Server Actions (AI_RULES §3)
- Use golden tenant fixture data for all tests (AI_RULES §4)
- All new UUIDs must be hex-only (AI_RULES §7)
- Zod v4: use `.issues[0]?.message` not `.errors[0]?.message` (AI_RULES §8)
- Plan gate the scorecard: trial/starter see lock overlay, growth/agency see data
- `Math.round(x * 100) / 100` for all currency values (never `toFixed()`)
- Do NOT modify existing components unless adding new props/data
- Do NOT modify `lib/utils.ts`, `lib/chartUtils.ts`, or any Tremor component
- Do NOT import from `@tremor/react` — use `@/components/tremor`
- `npm run build` and `npm run test` must both pass before committing
- If any existing test breaks, STOP and fix the regression before continuing
