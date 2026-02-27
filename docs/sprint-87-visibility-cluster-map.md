# Sprint 87 — AI Visibility Cluster Map (Scatter Plot + Hallucination Overlay)

> **Claude Code Prompt — First-Pass Ready**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`

---

## 🎯 Objective

Build the **AI Visibility Cluster Map** — the centerpiece visual of LocalVector's AEO platform. Instead of traditional "Position 1–10" leaderboards, this is a **scatter plot** that shows WHERE your business sits in each AI engine's recommendation space, overlaid with **hallucination fog zones** from the Fear Engine.

**The user sees:**
```
🗺️ AI Visibility Cluster Map
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Engine Toggle: ● All Engines  ○ Perplexity  ○ ChatGPT  ○ Gemini  ○ Copilot]

         ┌──────────────────────────────────────────────┐
   100   │                    ★ You                      │
         │              ◉ Competitor A                   │
    A    │     🔴 HALLUCINATION FOG                      │
    c    │     (ChatGPT thinks you're closed Tuesdays)   │
    c  50│─────────────────────────────────────────────── │
    u    │                          ◉ Competitor C       │
    r    │     ◉ Competitor B                            │
    a    │                                               │
    c    │                                               │
    y  0 │───────────────────────────────────────────────│
         └──────────────────────────────────────────────┘
         0              Brand Authority              100

Bubble Size = Share of Voice (larger = more recommended)

⚠️ 2 Hallucination Zones Detected
   🔴 "Closed on Tuesdays" — ChatGPT (Critical)
   🔴 "No outdoor seating" — Gemini (High)
```

**Why this is the WOW feature:**
1. **Executive Summary Speed** — Restaurant owner sees at a glance: "I'm top-right (good), but there are two red zones pulling me down"
2. **Competitive Conquesting** — Visible gaps where no competitor is positioned
3. **Engine Toggle** — "I'm Center Stage in Perplexity but Off-Map in Gemini"
4. **Hallucination Fog** — Red overlay zones from Fear Engine tied to specific false claims

**Architecture:** Pure service aggregates data from 4 existing tables (sov_evaluations, ai_hallucinations, competitor_intercepts, visibility_analytics). No new tables. No new migrations. No AI calls — all existing data. Recharts ScatterChart with custom dot renderer for bubble sizing and hallucination overlay rectangles.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                          — All engineering rules (§4, §6, §12, §17, §18, §20, §38)
Read CLAUDE.md                                 — Project context + architecture
Read supabase/prod_schema.sql                  — sov_evaluations, ai_hallucinations,
                                                 competitor_intercepts, visibility_analytics,
                                                 target_queries
Read lib/supabase/database.types.ts            — Full Database type (§38)
Read src/__fixtures__/golden-tenant.ts          — Golden Tenant fixtures (§4)
Read lib/services/truth-audit.service.ts        — Truth Score calculation (accuracy data)
Read lib/services/ai-health-score.service.ts    — Health score composite (reference pattern)
Read lib/services/revenue-impact.service.ts     — Revenue impact (reference for pure service pattern)
Read lib/data/sentiment.ts                      — Data fetcher pattern (reference)
Read lib/data/revenue-impact.ts                 — Data fetcher pattern (reference)
Read lib/chartUtils.ts                          — Tremor chart color utilities
Read components/tremor/                         — Existing Tremor chart components
Read app/dashboard/revenue-impact/page.tsx      — Dashboard page pattern (reference)
Read app/dashboard/sentiment/page.tsx           — Dashboard page pattern with engine breakdown
Read docs/DESIGN-SYSTEM.md                      — Color tokens and styling rules
```

---

## 🏗️ Architecture — What to Build

### The Scatter Plot Model

Each point on the scatter plot represents a business (yours or a competitor) positioned by two axes:

```
X-Axis: Brand Authority (0–100)
  = Citation frequency across AI engines
  = How often the business appears in AI recommendations
  Formula: (queries_where_cited / total_queries_evaluated) × 100

Y-Axis: Fact Accuracy (0–100)
  = Truth score (inverse of hallucination rate)
  = For YOUR business: use truth audit score from truth-audit.service.ts
  = For competitors: assume 80 (no hallucination data for them)

Bubble Size: Share of Voice (0–1.0 float)
  = From visibility_analytics.share_of_voice
  = Competitors: derive from sov_evaluations.mentioned_competitors frequency
  = Rendered as bubble radius: Math.max(8, sovScore × 50)

Bubble Color:
  = Your business: signal-green (#00F5A0)
  = Competitors: electric-indigo (#6366f1) at 60% opacity
  = Hallucination fog zones: alert-crimson (#ef4444) at 15% opacity
```

### Hallucination Fog Overlay

Each open hallucination creates a translucent red zone on the scatter plot:

```
Fog Zone = {
  // Position: centered on YOUR business point, offset by severity
  cx: yourBrandAuthority,
  cy: yourAccuracy - severityPenalty,
  // Size: proportional to severity
  radius: severity === 'critical' ? 40 : severity === 'high' ? 30 : 20,
  // Data
  claimText: hallucination.claim_text,
  engine: hallucination.model_provider,
  severity: hallucination.severity,
}

Severity penalty on Y-axis (accuracy):
  critical: -25 points
  high:     -15 points
  medium:   -8 points
  low:      -3 points
```

### Engine Toggle Filter

The toggle switches between:
- **All Engines** — Aggregated view (average across all engines)
- **Perplexity** — Filter sov_evaluations where engine='perplexity'
- **ChatGPT** — Filter where engine='openai'
- **Gemini** — Filter where engine='google'
- **Copilot** — Filter where engine='microsoft-copilot' (if data exists, else disabled)

When toggled, both the scatter positions AND hallucination zones update. A business might be "top-right" in Perplexity but "bottom-left" in Gemini.

---

## 📦 Component 1: Pure Service — `lib/services/cluster-map.service.ts`

**Pure functions. No I/O. No Supabase client creation. (AI_RULES §6)**

```typescript
// ---------------------------------------------------------------------------
// lib/services/cluster-map.service.ts — AI Visibility Cluster Map
//
// Sprint 87: Pure functions that transform existing engine data into scatter
// plot coordinates. No new tables, no AI calls, no side effects.
//
// X-Axis: Brand Authority (citation frequency, 0-100)
// Y-Axis: Fact Accuracy (truth score, 0-100)
// Bubble: Share of Voice (0-1)
// Overlay: Hallucination fog zones from Fear Engine
// ---------------------------------------------------------------------------
```

### Input Types

```typescript
export type EngineFilter = 'all' | 'perplexity' | 'openai' | 'google' | 'copilot';

export interface ClusterMapInput {
  /** Your business name (for matching in sov_evaluations) */
  businessName: string;

  /** SOV evaluations — raw per-query, per-engine results */
  evaluations: Array<{
    engine: string;
    queryId: string;
    queryCategory: string;
    rankPosition: number | null;  // null = not cited
    mentionedCompetitors: string[];
  }>;

  /** Open hallucinations from Fear Engine */
  hallucinations: Array<{
    id: string;
    claimText: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    modelProvider: string;
    category: string | null;
  }>;

  /** Latest truth score (from truth-audit.service.ts) */
  truthScore: number | null;

  /** Latest SOV (from visibility_analytics) */
  sovScore: number | null;

  /** Engine filter */
  engineFilter: EngineFilter;
}
```

### Output Types

```typescript
export interface ClusterMapPoint {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** X-axis: Brand Authority (0-100) */
  brandAuthority: number;
  /** Y-axis: Fact Accuracy (0-100) */
  factAccuracy: number;
  /** Bubble size: Share of Voice (0-1) */
  sov: number;
  /** Point type */
  type: 'self' | 'competitor';
  /** Number of queries where this business was cited */
  citationCount: number;
  /** Total queries evaluated */
  totalQueries: number;
}

export interface HallucinationZone {
  /** Hallucination ID */
  id: string;
  /** Center X (matches your brandAuthority) */
  cx: number;
  /** Center Y (your accuracy minus severity penalty) */
  cy: number;
  /** Radius of the fog zone */
  radius: number;
  /** What the AI falsely claims */
  claimText: string;
  /** Which engine */
  engine: string;
  /** Severity level */
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface ClusterMapResult {
  /** All plot points (self + competitors) */
  points: ClusterMapPoint[];
  /** Hallucination fog overlay zones */
  hallucinationZones: HallucinationZone[];
  /** Your business point (convenience ref, also in points[]) */
  selfPoint: ClusterMapPoint | null;
  /** Available engines (ones that have data) */
  availableEngines: EngineFilter[];
  /** Active engine filter */
  activeFilter: EngineFilter;
  /** Summary stats */
  stats: {
    totalCompetitors: number;
    totalQueries: number;
    hallucinationCount: number;
    dominantEngine: string | null;
  };
}
```

### Core Functions

```typescript
/**
 * ENGINE_MAP — normalize engine strings from sov_evaluations to EngineFilter
 * sov_evaluations.engine is varchar(20): 'perplexity', 'openai', 'google'
 * ai_hallucinations.model_provider is enum: 'openai-gpt4o', 'perplexity-sonar', etc.
 */
const ENGINE_MAP: Record<string, EngineFilter> = {
  perplexity: 'perplexity',
  openai: 'openai',
  google: 'google',
  'microsoft-copilot': 'copilot',
  // model_provider enum values
  'openai-gpt4o': 'openai',
  'openai-gpt4o-mini': 'openai',
  'perplexity-sonar': 'perplexity',
  'google-gemini': 'google',
  'anthropic-claude': 'copilot', // fallback bucket
  'microsoft-copilot': 'copilot',
};

const SEVERITY_PENALTY: Record<string, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
};

const SEVERITY_RADIUS: Record<string, number> = {
  critical: 40,
  high: 30,
  medium: 20,
  low: 12,
};

/**
 * Build the cluster map from pre-fetched data.
 * Pure function — no I/O.
 */
export function buildClusterMap(input: ClusterMapInput): ClusterMapResult { ... }

/**
 * Calculate Brand Authority (0–100) for a business.
 * = (queries where cited / total queries) × 100
 */
export function calculateBrandAuthority(
  businessName: string,
  evaluations: ClusterMapInput['evaluations'],
): { authority: number; citedCount: number; totalQueries: number } { ... }

/**
 * Extract unique competitors from evaluations and compute their
 * brand authority scores.
 */
export function extractCompetitorPoints(
  evaluations: ClusterMapInput['evaluations'],
  engineFilter: EngineFilter,
): ClusterMapPoint[] { ... }

/**
 * Build hallucination fog zones from open hallucinations.
 * Each zone is centered on the business's scatter position.
 */
export function buildHallucinationZones(
  hallucinations: ClusterMapInput['hallucinations'],
  selfPoint: ClusterMapPoint,
  engineFilter: EngineFilter,
): HallucinationZone[] { ... }

/**
 * Filter evaluations by engine. 'all' returns everything.
 */
export function filterByEngine<T extends { engine: string }>(
  items: T[],
  filter: EngineFilter,
): T[] { ... }

/**
 * Detect which engines have data.
 */
export function detectAvailableEngines(
  evaluations: ClusterMapInput['evaluations'],
): EngineFilter[] { ... }
```

### Implementation Logic for `buildClusterMap`:

```
1. Filter evaluations by engineFilter (if not 'all')
2. Calculate self brand authority from filtered evaluations
3. Self factAccuracy = truthScore ?? 50 (default if no audit)
4. Self SOV = sovScore ?? 0
5. Build selfPoint
6. Extract competitor points from mentioned_competitors
   - For each unique competitor name:
     a. Count queries where they appear in mentioned_competitors
     b. brandAuthority = (cited_count / total_queries) × 100
     c. factAccuracy = 80 (assumed — we don't track competitor hallucinations)
     d. sov = cited_count / total_queries (rough approximation)
7. Build hallucination zones from open hallucinations
   - Filter by engine if engineFilter !== 'all'
   - Map model_provider to engine using ENGINE_MAP
8. Detect available engines
9. Compute summary stats
10. Return ClusterMapResult
```

---

## 📦 Component 2: Data Fetcher — `lib/data/cluster-map.ts`

**Follows the existing data fetcher pattern (see `lib/data/sentiment.ts`, `lib/data/revenue-impact.ts`).**

```typescript
// ---------------------------------------------------------------------------
// lib/data/cluster-map.ts — Cluster Map Data Fetchers
//
// Sprint 87: Fetches data from 4 existing tables and transforms via
// the pure cluster-map.service.ts. No new tables needed.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  buildClusterMap,
  type ClusterMapResult,
  type EngineFilter,
} from '@/lib/services/cluster-map.service';
import { calculateTruthScore, type EngineScore } from '@/lib/services/truth-audit.service';

/**
 * Fetch all data needed for the Cluster Map and transform it.
 *
 * Queries:
 * 1. sov_evaluations (last 30 days) — for brand authority + competitor extraction
 * 2. ai_hallucinations (open only) — for hallucination fog overlay
 * 3. visibility_analytics (latest) — for self SOV score
 * 4. locations (primary) — for business_name
 *
 * All queries are RLS-scoped via the passed-in Supabase client.
 */
export async function fetchClusterMapData(
  supabase: SupabaseClient<Database>,
  orgId: string,
  locationId: string,
  engineFilter: EngineFilter = 'all',
): Promise<ClusterMapResult> {
  // 1. Fetch business name from location
  const { data: location } = await supabase
    .from('locations')
    .select('business_name')
    .eq('id', locationId)
    .single();

  const businessName = location?.business_name ?? 'My Business';

  // 2. Fetch SOV evaluations (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: evaluations } = await supabase
    .from('sov_evaluations')
    .select('engine, query_id, rank_position, mentioned_competitors')
    .eq('org_id', orgId)
    .eq('location_id', locationId)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  // 3. Fetch open hallucinations
  const { data: hallucinations } = await supabase
    .from('ai_hallucinations')
    .select('id, claim_text, severity, model_provider, category')
    .eq('org_id', orgId)
    .eq('correction_status', 'open');

  // 4. Fetch latest visibility analytics for SOV
  const { data: latestVA } = await supabase
    .from('visibility_analytics')
    .select('share_of_voice')
    .eq('org_id', orgId)
    .eq('location_id', locationId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  // 5. Compute truth score from hallucination data
  // Use the same engine score approach as truth-audit.service.ts
  // but simplified: we just need the aggregate score
  const totalAudits = (evaluations ?? []).length;
  const openHallucinations = (hallucinations ?? []).length;
  const truthScore = totalAudits > 0
    ? Math.max(0, Math.min(100, 100 - (openHallucinations / Math.max(totalAudits, 1)) * 100))
    : null;

  // 6. Build the cluster map
  return buildClusterMap({
    businessName,
    evaluations: (evaluations ?? []).map(e => ({
      engine: e.engine,
      queryId: e.query_id,
      queryCategory: '', // not needed for authority calc
      rankPosition: e.rank_position,
      mentionedCompetitors: (e.mentioned_competitors as string[]) ?? [],
    })),
    hallucinations: (hallucinations ?? []).map(h => ({
      id: h.id,
      claimText: h.claim_text,
      severity: h.severity as 'critical' | 'high' | 'medium' | 'low',
      modelProvider: h.model_provider,
      category: h.category,
    })),
    truthScore,
    sovScore: latestVA?.share_of_voice ?? null,
    engineFilter,
  });
}
```

---

## 📦 Component 3: Server Action — `app/dashboard/cluster-map/actions.ts`

```typescript
// ---------------------------------------------------------------------------
// app/dashboard/cluster-map/actions.ts — Cluster Map Server Actions
//
// Sprint 87: Server action for engine filter toggle (client-side state change
// triggers server re-fetch with new filter).
// ---------------------------------------------------------------------------

'use server';

import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchClusterMapData } from '@/lib/data/cluster-map';
import type { EngineFilter, ClusterMapResult } from '@/lib/services/cluster-map.service';

export async function getClusterMapData(
  engineFilter: EngineFilter = 'all',
): Promise<{ success: true; data: ClusterMapResult } | { success: false; error: string }> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const supabase = await createClient();

  // Get primary location
  const { data: location } = await supabase
    .from('locations')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('is_primary', true)
    .maybeSingle();

  if (!location) return { success: false, error: 'No primary location found' };

  const data = await fetchClusterMapData(supabase, ctx.orgId, location.id, engineFilter);
  return { success: true, data };
}
```

---

## 📦 Component 4: Dashboard Page — `app/dashboard/cluster-map/page.tsx`

**Server Component (default). Follows the pattern in `app/dashboard/revenue-impact/page.tsx`.**

```typescript
// ---------------------------------------------------------------------------
// app/dashboard/cluster-map/page.tsx — AI Visibility Cluster Map Page
//
// Sprint 87: Server component that fetches cluster map data and renders
// the scatter plot with hallucination overlay.
// ---------------------------------------------------------------------------
```

### Page Structure:

```
1. Auth guard (getSafeAuthContext → redirect if null)
2. Fetch primary location
3. Fetch cluster map data (default: 'all' engines)
4. Render:
   a. Page header with title + subtitle
   b. Engine Toggle bar (client component)
   c. ScatterChart (client component — Recharts)
   d. Hallucination Alert Cards (below chart)
   e. Stats summary row
```

### Empty States:

```
- No location → "No primary location found. Complete onboarding to get started."
- No evaluations → "Run your first AI scan to populate the Cluster Map."
  CTA: "Start AI Scan →" linking to /dashboard/share-of-voice
- Has evaluations but no competitors → Show self point only with message
  "Only your business is plotted. Competitors will appear after more AI scans."
```

---

## 📦 Component 5: Client Components

### `app/dashboard/cluster-map/_components/EngineToggle.tsx`

```typescript
// Client component: radio-button-style toggle for engine filter.
// Uses `useTransition` + server action to re-fetch data on toggle.
'use client';

// Props:
// - availableEngines: EngineFilter[]
// - activeFilter: EngineFilter
// - onFilterChange: (filter: EngineFilter) => void

// Render: Horizontal button group with radio-style selection
// Disabled state for engines with no data
// Loading state during transition
```

Engine display names:
```typescript
const ENGINE_LABELS: Record<EngineFilter, string> = {
  all: 'All Engines',
  perplexity: 'Perplexity',
  openai: 'ChatGPT',
  google: 'Gemini',
  copilot: 'Copilot',
};

const ENGINE_COLORS: Record<EngineFilter, string> = {
  all: 'text-white',
  perplexity: 'text-cyan-400',
  openai: 'text-emerald-400',
  google: 'text-amber-400',
  copilot: 'text-violet-400',
};
```

### `app/dashboard/cluster-map/_components/ClusterChart.tsx`

```typescript
// Client component: Recharts ScatterChart with custom rendering.
'use client';

// Uses:
// - recharts: ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
//             Tooltip, ResponsiveContainer, Cell, ReferenceLine, ZAxis
// - Custom dot renderer for bubble sizing
// - Custom tooltip for hover details
// - Hallucination fog rendered as SVG circles with blur filter

// Props:
// - points: ClusterMapPoint[]
// - hallucinationZones: HallucinationZone[]
// - selfPoint: ClusterMapPoint | null
```

**Critical Recharts Implementation Details:**

```tsx
// ZAxis controls bubble size (uses sov field)
<ZAxis dataKey="sov" range={[100, 2000]} />

// Custom shape for self point (star) vs competitors (circle)
const renderDot = (props: any) => {
  const { cx, cy, payload } = props;
  const radius = Math.max(8, (payload.sov ?? 0) * 50);

  if (payload.type === 'self') {
    return (
      <g>
        {/* Glow effect */}
        <circle cx={cx} cy={cy} r={radius + 4} fill="#00F5A0" opacity={0.2} />
        {/* Main dot */}
        <circle cx={cx} cy={cy} r={radius} fill="#00F5A0" stroke="#050A15" strokeWidth={2} />
        {/* Star icon indicator — use text for simplicity */}
        <text x={cx} y={cy + 4} textAnchor="middle" fill="#050A15" fontSize={12} fontWeight="bold">★</text>
      </g>
    );
  }

  return (
    <circle cx={cx} cy={cy} r={Math.max(6, radius * 0.7)}
            fill="#6366f1" fillOpacity={0.6}
            stroke="#6366f1" strokeWidth={1} />
  );
};

// Hallucination fog overlay — render as background SVG
// Uses <defs> filter for gaussian blur
const renderFogZones = (zones: HallucinationZone[]) => (
  <defs>
    <filter id="fog-blur">
      <feGaussianBlur stdDeviation="8" />
    </filter>
  </defs>
  // Then for each zone:
  <circle cx={...} cy={...} r={zone.radius} fill="#ef4444" fillOpacity={0.12} filter="url(#fog-blur)" />
);
```

**Quadrant Reference Lines:**

```tsx
// Draw reference lines at 50/50 to create 4 quadrants
<ReferenceLine x={50} stroke="#334155" strokeDasharray="4 4" />
<ReferenceLine y={50} stroke="#334155" strokeDasharray="4 4" />

// Quadrant labels (positioned via custom SVG text)
// Top-Right: "High Authority, High Accuracy" (green zone)
// Top-Left: "Low Authority, High Accuracy" (opportunity zone)
// Bottom-Right: "High Authority, Low Accuracy" (hallucination risk)
// Bottom-Left: "Low Authority, Low Accuracy" (danger zone)
```

### `app/dashboard/cluster-map/_components/HallucinationAlertCard.tsx`

```typescript
// Client component: Card below the chart showing hallucination details
// One card per hallucination zone

// Props:
// - zone: HallucinationZone
// - index: number

// Render:
// - Red left border (border-l-4 border-alert-crimson)
// - Severity badge (Critical/High/Medium/Low)
// - Claim text
// - Engine name
// - Link to /dashboard/hallucinations for remediation
```

### `app/dashboard/cluster-map/_components/ClusterMapWrapper.tsx`

```typescript
// Client component: Wrapper that manages engine toggle state
// and coordinates between EngineToggle and ClusterChart.
'use client';

// Uses useState for engineFilter, useTransition for loading state
// Calls getClusterMapData server action on toggle change
// Passes data down to ClusterChart and HallucinationAlertCard

// Props (from server component):
// - initialData: ClusterMapResult
```

---

## 📦 Component 6: Navigation Integration

### Add to sidebar navigation — `components/layout/DashboardSidebar.tsx`

Add new nav item in the existing sidebar:

```typescript
{
  label: 'Cluster Map',
  href: '/dashboard/cluster-map',
  icon: ScatterChart, // from lucide-react (or Map icon)
}
```

**Placement:** After "Share of Voice" and before "Compete" in the nav hierarchy. This is a visibility visualization tool, so it belongs in the "Understand" section of the dashboard.

---

## 🧪 Testing Strategy

### Test File Structure

```
src/__tests__/unit/services/cluster-map.service.test.ts    — Pure service tests
src/__tests__/unit/data/cluster-map.test.ts                — Data fetcher tests (mocked Supabase)
src/__tests__/integration/cluster-map-action.test.ts       — Server action tests
```

---

## 🧪 Test Data — Golden Tenant Fixtures

Add to `src/__fixtures__/golden-tenant.ts` (or import from a new fixture file):

```typescript
// src/__fixtures__/cluster-map-fixtures.ts

import type { ClusterMapInput, EngineFilter } from '@/lib/services/cluster-map.service';

// ── Canonical test UUIDs (hex-only, AI_RULES §7) ──────────────────────

export const CLUSTER_MAP_UUIDS = {
  query1: 'a3eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
  query2: 'a3eebc99-9c0b-4ef8-bb6d-6bb9bd380a02',
  query3: 'a3eebc99-9c0b-4ef8-bb6d-6bb9bd380a03',
  query4: 'a3eebc99-9c0b-4ef8-bb6d-6bb9bd380a04',
  query5: 'a3eebc99-9c0b-4ef8-bb6d-6bb9bd380a05',
  hallucination1: 'a3eebc99-9c0b-4ef8-bb6d-6bb9bd380b01',
  hallucination2: 'a3eebc99-9c0b-4ef8-bb6d-6bb9bd380b02',
  hallucination3: 'a3eebc99-9c0b-4ef8-bb6d-6bb9bd380b03',
} as const;

// ── Evaluation fixtures ────────────────────────────────────────────────

/** 10 evaluations across 5 queries × 2 engines (Perplexity + OpenAI) */
export const MOCK_EVALUATIONS: ClusterMapInput['evaluations'] = [
  // Query 1: "best hookah bar Alpharetta" — both engines cite us
  {
    engine: 'perplexity',
    queryId: CLUSTER_MAP_UUIDS.query1,
    queryCategory: 'discovery',
    rankPosition: 1,
    mentionedCompetitors: ['Cloud 9 Lounge', 'Sahara Hookah Lounge'],
  },
  {
    engine: 'openai',
    queryId: CLUSTER_MAP_UUIDS.query1,
    queryCategory: 'discovery',
    rankPosition: 2,
    mentionedCompetitors: ['Cloud 9 Lounge', 'The Hookah Spot', 'Sahara Hookah Lounge'],
  },
  // Query 2: "Indian restaurant Alpharetta" — only Perplexity cites us
  {
    engine: 'perplexity',
    queryId: CLUSTER_MAP_UUIDS.query2,
    queryCategory: 'discovery',
    rankPosition: 3,
    mentionedCompetitors: ['Bollywood Grill', 'Tabla Indian Restaurant'],
  },
  {
    engine: 'openai',
    queryId: CLUSTER_MAP_UUIDS.query2,
    queryCategory: 'discovery',
    rankPosition: null, // NOT cited by ChatGPT
    mentionedCompetitors: ['Bollywood Grill', 'Tabla Indian Restaurant', 'Curry Corner'],
  },
  // Query 3: "date night restaurant Alpharetta" — both cite us
  {
    engine: 'perplexity',
    queryId: CLUSTER_MAP_UUIDS.query3,
    queryCategory: 'occasion',
    rankPosition: 2,
    mentionedCompetitors: ['Cloud 9 Lounge', 'The Capital Grille'],
  },
  {
    engine: 'openai',
    queryId: CLUSTER_MAP_UUIDS.query3,
    queryCategory: 'occasion',
    rankPosition: 1,
    mentionedCompetitors: ['Cloud 9 Lounge'],
  },
  // Query 4: "late night food Alpharetta" — only ChatGPT cites us
  {
    engine: 'perplexity',
    queryId: CLUSTER_MAP_UUIDS.query4,
    queryCategory: 'near_me',
    rankPosition: null,
    mentionedCompetitors: ['Waffle House', 'IHOP'],
  },
  {
    engine: 'openai',
    queryId: CLUSTER_MAP_UUIDS.query4,
    queryCategory: 'near_me',
    rankPosition: 2,
    mentionedCompetitors: ['Waffle House'],
  },
  // Query 5: "hookah lounge near me" — both cite us
  {
    engine: 'perplexity',
    queryId: CLUSTER_MAP_UUIDS.query5,
    queryCategory: 'near_me',
    rankPosition: 1,
    mentionedCompetitors: ['Cloud 9 Lounge', 'The Hookah Spot'],
  },
  {
    engine: 'openai',
    queryId: CLUSTER_MAP_UUIDS.query5,
    queryCategory: 'near_me',
    rankPosition: 1,
    mentionedCompetitors: ['Cloud 9 Lounge', 'Sahara Hookah Lounge'],
  },
];

// ── Hallucination fixtures ─────────────────────────────────────────────

export const MOCK_HALLUCINATIONS: ClusterMapInput['hallucinations'] = [
  {
    id: CLUSTER_MAP_UUIDS.hallucination1,
    claimText: 'Charcoal N Chill is closed on Tuesdays',
    severity: 'critical',
    modelProvider: 'openai-gpt4o',
    category: 'hours_check',
  },
  {
    id: CLUSTER_MAP_UUIDS.hallucination2,
    claimText: 'Charcoal N Chill does not have outdoor seating',
    severity: 'high',
    modelProvider: 'google-gemini',
    category: 'amenity_check',
  },
  {
    id: CLUSTER_MAP_UUIDS.hallucination3,
    claimText: 'Charcoal N Chill serves only vegetarian food',
    severity: 'medium',
    modelProvider: 'perplexity-sonar',
    category: 'menu_check',
  },
];

// ── Complete input fixture ─────────────────────────────────────────────

export const MOCK_CLUSTER_INPUT: ClusterMapInput = {
  businessName: 'Charcoal N Chill',
  evaluations: MOCK_EVALUATIONS,
  hallucinations: MOCK_HALLUCINATIONS,
  truthScore: 72,
  sovScore: 0.45,
  engineFilter: 'all',
};

// ── Expected results for test assertions ───────────────────────────────

/**
 * Pre-computed expected values for MOCK_CLUSTER_INPUT with engineFilter='all':
 *
 * Self Brand Authority:
 *   Cited queries: Q1(perp+oai), Q2(perp only), Q3(perp+oai), Q4(oai only), Q5(perp+oai)
 *   Per-engine: Perplexity cited in 4/5 queries, OpenAI cited in 4/5 queries
 *   Total: self cited in 8 out of 10 evaluations = 80/100 brand authority
 *
 * Self Fact Accuracy: truthScore = 72
 * Self SOV: 0.45
 *
 * Competitors extracted (unique across all mentioned_competitors):
 *   'Cloud 9 Lounge' — appears in 6 evaluations out of 10 → authority 60
 *   'Sahara Hookah Lounge' — appears in 3 evaluations → authority 30
 *   'The Hookah Spot' — appears in 2 evaluations → authority 20
 *   'Bollywood Grill' — appears in 2 evaluations → authority 20
 *   'Tabla Indian Restaurant' — appears in 2 evaluations → authority 20
 *   'Curry Corner' — appears in 1 evaluation → authority 10
 *   'The Capital Grille' — appears in 1 evaluation → authority 10
 *   'Waffle House' — appears in 2 evaluations → authority 20
 *   'IHOP' — appears in 1 evaluation → authority 10
 *
 * Hallucination zones (all engines):
 *   Zone 1: critical, engine=openai, radius=40, cy=72-25=47
 *   Zone 2: high, engine=google, radius=30, cy=72-15=57
 *   Zone 3: medium, engine=perplexity, radius=20, cy=72-8=64
 */
export const EXPECTED_ALL_ENGINES = {
  selfBrandAuthority: 80,
  selfFactAccuracy: 72,
  selfSov: 0.45,
  totalCompetitors: 9,
  totalQueries: 10,
  hallucinationCount: 3,
  hallucinationZones: [
    { severity: 'critical', engine: 'openai', radius: 40, cy: 47 },
    { severity: 'high', engine: 'google', radius: 30, cy: 57 },
    { severity: 'medium', engine: 'perplexity', radius: 20, cy: 64 },
  ],
};

/**
 * Expected for engineFilter='perplexity' — only Perplexity evaluations:
 *   Evaluations: Q1, Q2, Q3, Q4, Q5 (perplexity only = 5 total)
 *   Self cited: Q1(yes), Q2(yes), Q3(yes), Q4(no), Q5(yes) = 4/5 = 80
 *   Competitors: only from perplexity rows
 *   Hallucinations: only perplexity-sonar = Zone 3 only
 */
export const EXPECTED_PERPLEXITY_ONLY = {
  selfBrandAuthority: 80,
  selfFactAccuracy: 72,
  totalQueries: 5,
  hallucinationCount: 1, // only the perplexity one
};

/**
 * Expected for engineFilter='openai' — only OpenAI evaluations:
 *   Evaluations: Q1, Q2, Q3, Q4, Q5 (openai only = 5 total)
 *   Self cited: Q1(yes), Q2(no), Q3(yes), Q4(yes), Q5(yes) = 4/5 = 80
 *   Hallucinations: only openai-gpt4o = Zone 1 only
 */
export const EXPECTED_OPENAI_ONLY = {
  selfBrandAuthority: 80,
  selfFactAccuracy: 72,
  totalQueries: 5,
  hallucinationCount: 1,
};
```

---

## 🧪 Test Suite 1: Unit Tests — `src/__tests__/unit/services/cluster-map.service.test.ts`

**41 test cases organized in 8 describe blocks.**

```typescript
// ---------------------------------------------------------------------------
// src/__tests__/unit/services/cluster-map.service.test.ts
//
// Sprint 87: Unit tests for the Cluster Map pure service.
// Pure functions — no mocking needed except fixture data.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  buildClusterMap,
  calculateBrandAuthority,
  extractCompetitorPoints,
  buildHallucinationZones,
  filterByEngine,
  detectAvailableEngines,
} from '@/lib/services/cluster-map.service';
import {
  MOCK_CLUSTER_INPUT,
  MOCK_EVALUATIONS,
  MOCK_HALLUCINATIONS,
  EXPECTED_ALL_ENGINES,
  EXPECTED_PERPLEXITY_ONLY,
  EXPECTED_OPENAI_ONLY,
  CLUSTER_MAP_UUIDS,
} from '@/__fixtures__/cluster-map-fixtures';
```

### Test Cases:

```
describe('calculateBrandAuthority')
  ✅ TC-01: Returns 80 for Charcoal N Chill across all evaluations (cited 8/10)
  ✅ TC-02: Returns 100 when business is cited in every evaluation
  ✅ TC-03: Returns 0 when business is never cited (all rankPosition=null)
  ✅ TC-04: Returns 0 for empty evaluations array
  ✅ TC-05: Is case-insensitive for business name matching
  ✅ TC-06: Only counts evaluations where rankPosition is non-null

describe('extractCompetitorPoints')
  ✅ TC-07: Extracts 9 unique competitors from all evaluations
  ✅ TC-08: Cloud 9 Lounge has highest authority (appears in 6/10 = 60)
  ✅ TC-09: Single-appearance competitor has authority 10 (1/10 × 100)
  ✅ TC-10: Filters by engine — perplexity only returns perplexity competitors
  ✅ TC-11: Returns empty array for empty evaluations
  ✅ TC-12: Deduplicates competitor names (exact match)
  ✅ TC-13: All competitor points have type='competitor'
  ✅ TC-14: Competitor factAccuracy defaults to 80

describe('buildHallucinationZones')
  ✅ TC-15: Returns 3 zones for all engines
  ✅ TC-16: Critical zone has radius=40 and cy=selfAccuracy-25
  ✅ TC-17: High zone has radius=30 and cy=selfAccuracy-15
  ✅ TC-18: Medium zone has radius=20 and cy=selfAccuracy-8
  ✅ TC-19: Low zone has radius=12 and cy=selfAccuracy-3
  ✅ TC-20: Filters zones by engine — 'openai' returns only openai hallucinations
  ✅ TC-21: Filters zones by engine — 'google' returns only google hallucinations
  ✅ TC-22: cx always matches selfPoint.brandAuthority
  ✅ TC-23: Returns empty array when no hallucinations

describe('filterByEngine')
  ✅ TC-24: 'all' returns all items unchanged
  ✅ TC-25: 'perplexity' returns only perplexity evaluations (5 of 10)
  ✅ TC-26: 'openai' returns only openai evaluations (5 of 10)
  ✅ TC-27: 'google' returns empty when no google data exists
  ✅ TC-28: Maps model_provider enum values correctly (openai-gpt4o → openai)

describe('detectAvailableEngines')
  ✅ TC-29: Detects ['all', 'perplexity', 'openai'] from fixture data
  ✅ TC-30: Always includes 'all' even with single engine
  ✅ TC-31: Returns ['all'] for empty evaluations

describe('buildClusterMap — all engines')
  ✅ TC-32: selfPoint has brandAuthority=80, factAccuracy=72, sov=0.45
  ✅ TC-33: selfPoint has type='self'
  ✅ TC-34: points array contains self + 9 competitors = 10 total
  ✅ TC-35: hallucinationZones has 3 entries
  ✅ TC-36: stats.totalCompetitors = 9
  ✅ TC-37: stats.hallucinationCount = 3

describe('buildClusterMap — perplexity filter')
  ✅ TC-38: Only includes perplexity evaluations
  ✅ TC-39: Only includes perplexity hallucination zones (1 zone)
  ✅ TC-40: stats.totalQueries = 5

describe('buildClusterMap — edge cases')
  ✅ TC-41: Handles null truthScore (defaults factAccuracy to 50)
  ✅ TC-42: Handles null sovScore (defaults sov to 0)
  ✅ TC-43: Handles empty evaluations gracefully (selfPoint brandAuthority=0)
  ✅ TC-44: Handles empty hallucinations gracefully (zero zones)
  ✅ TC-45: All values clamped to 0-100 range
```

### Example Test Implementations:

```typescript
describe('calculateBrandAuthority', () => {
  it('TC-01: Returns 80 for Charcoal N Chill across all evaluations', () => {
    const result = calculateBrandAuthority('Charcoal N Chill', MOCK_EVALUATIONS);
    expect(result.authority).toBe(80);
    expect(result.citedCount).toBe(8);
    expect(result.totalQueries).toBe(10);
  });

  it('TC-03: Returns 0 when business is never cited', () => {
    const neverCited = MOCK_EVALUATIONS.map(e => ({
      ...e,
      rankPosition: null,
    }));
    const result = calculateBrandAuthority('Charcoal N Chill', neverCited);
    expect(result.authority).toBe(0);
    expect(result.citedCount).toBe(0);
  });

  it('TC-04: Returns 0 for empty evaluations array', () => {
    const result = calculateBrandAuthority('Charcoal N Chill', []);
    expect(result.authority).toBe(0);
    expect(result.totalQueries).toBe(0);
  });
});

describe('buildHallucinationZones', () => {
  const selfPoint = {
    id: 'self',
    name: 'Charcoal N Chill',
    brandAuthority: 80,
    factAccuracy: 72,
    sov: 0.45,
    type: 'self' as const,
    citationCount: 8,
    totalQueries: 10,
  };

  it('TC-16: Critical zone has radius=40 and cy=selfAccuracy-25', () => {
    const zones = buildHallucinationZones(MOCK_HALLUCINATIONS, selfPoint, 'all');
    const critical = zones.find(z => z.severity === 'critical');
    expect(critical).toBeDefined();
    expect(critical!.radius).toBe(40);
    expect(critical!.cy).toBe(47); // 72 - 25
  });

  it('TC-20: Filters zones by engine — openai returns only openai hallucinations', () => {
    const zones = buildHallucinationZones(MOCK_HALLUCINATIONS, selfPoint, 'openai');
    expect(zones).toHaveLength(1);
    expect(zones[0].engine).toBe('openai');
    expect(zones[0].severity).toBe('critical');
  });
});

describe('buildClusterMap — all engines', () => {
  it('TC-32: selfPoint has correct coordinates', () => {
    const result = buildClusterMap(MOCK_CLUSTER_INPUT);
    expect(result.selfPoint).not.toBeNull();
    expect(result.selfPoint!.brandAuthority).toBe(EXPECTED_ALL_ENGINES.selfBrandAuthority);
    expect(result.selfPoint!.factAccuracy).toBe(EXPECTED_ALL_ENGINES.selfFactAccuracy);
    expect(result.selfPoint!.sov).toBe(EXPECTED_ALL_ENGINES.selfSov);
  });

  it('TC-34: points array contains self + 9 competitors', () => {
    const result = buildClusterMap(MOCK_CLUSTER_INPUT);
    expect(result.points).toHaveLength(10); // 1 self + 9 competitors
    expect(result.points.filter(p => p.type === 'self')).toHaveLength(1);
    expect(result.points.filter(p => p.type === 'competitor')).toHaveLength(9);
  });
});

describe('buildClusterMap — edge cases', () => {
  it('TC-41: Handles null truthScore — defaults factAccuracy to 50', () => {
    const result = buildClusterMap({ ...MOCK_CLUSTER_INPUT, truthScore: null });
    expect(result.selfPoint!.factAccuracy).toBe(50);
  });

  it('TC-42: Handles null sovScore — defaults sov to 0', () => {
    const result = buildClusterMap({ ...MOCK_CLUSTER_INPUT, sovScore: null });
    expect(result.selfPoint!.sov).toBe(0);
  });

  it('TC-43: Handles empty evaluations gracefully', () => {
    const result = buildClusterMap({
      ...MOCK_CLUSTER_INPUT,
      evaluations: [],
    });
    expect(result.selfPoint!.brandAuthority).toBe(0);
    expect(result.points).toHaveLength(1); // self only
    expect(result.stats.totalCompetitors).toBe(0);
  });
});
```

---

## 🧪 Test Suite 2: Data Fetcher Tests — `src/__tests__/unit/data/cluster-map.test.ts`

**12 test cases. Mocked Supabase client (AI_RULES §4, §38.2).**

```
describe('fetchClusterMapData')
  ✅ TC-D01: Returns ClusterMapResult with correct shape
  ✅ TC-D02: Passes orgId and locationId to all Supabase queries
  ✅ TC-D03: Filters sov_evaluations to last 30 days
  ✅ TC-D04: Only fetches open hallucinations (correction_status='open')
  ✅ TC-D05: Fetches latest visibility_analytics (order by snapshot_date desc, limit 1)
  ✅ TC-D06: Passes engineFilter through to buildClusterMap
  ✅ TC-D07: Handles null/empty Supabase results gracefully
  ✅ TC-D08: Returns default businessName 'My Business' when location not found
  ✅ TC-D09: Computes truthScore from hallucination ratio
  ✅ TC-D10: truthScore is null when no evaluations exist
  ✅ TC-D11: Casts mentioned_competitors from JSONB to string[]
  ✅ TC-D12: Maps hallucination severity and model_provider correctly
```

### Supabase Mock Pattern (AI_RULES §38.2):

```typescript
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Build chainable mock
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();

// Chain setup per table...
```

---

## 🧪 Test Suite 3: Server Action Tests — `src/__tests__/integration/cluster-map-action.test.ts`

**8 test cases.**

```
describe('getClusterMapData')
  ✅ TC-A01: Returns { success: false, error: 'Unauthorized' } when no auth context
  ✅ TC-A02: Returns { success: false, error: 'No primary location found' } when no location
  ✅ TC-A03: Returns { success: true, data: ClusterMapResult } for valid request
  ✅ TC-A04: Passes engineFilter through to fetchClusterMapData
  ✅ TC-A05: Defaults engineFilter to 'all' when not provided
  ✅ TC-A06: Uses getSafeAuthContext (not getAuthContext — AI_RULES §3)
  ✅ TC-A07: Queries primary location with is_primary=true
  ✅ TC-A08: Returns success even when data is empty (graceful degradation)
```

---

## 📋 Seed Data — Add to `supabase/seed.sql`

Add this to the end of the seed file to ensure the cluster map has data for local development:

```sql
-- Sprint 87: Cluster Map seed data
-- Uses existing tables — no new tables needed
-- Adds additional sov_evaluations with varied engines and competitor mentions
-- to make the cluster map visually interesting in local dev.

-- Additional SOV evaluations for Google engine (to show 3-engine spread)
INSERT INTO public.sov_evaluations (id, org_id, location_id, query_id, engine, rank_position, mentioned_competitors, created_at)
VALUES
  -- Register UUIDs in seed.sql UUID reference card:
  -- d0eebc99-... = Sprint 87 cluster map seed data
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', /* first target_query id */, 'google', 2, '["Cloud 9 Lounge", "Sahara Hookah Lounge"]', NOW() - INTERVAL '5 days'),
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', /* second target_query id */, 'google', NULL, '["Bollywood Grill"]', NOW() - INTERVAL '5 days');

-- NOTE: The actual query_id values must match existing target_queries UUIDs in seed.sql.
-- Read the seed.sql UUID reference card before inserting.
```

**Important:** Read the existing `supabase/seed.sql` UUID reference card to find the correct `target_queries` UUIDs. Do NOT invent new ones without registering them.

---

## 📋 Implementation Order (Build Sequence)

```
Step 1: Read all pre-flight files
Step 2: Create test fixtures — src/__fixtures__/cluster-map-fixtures.ts
Step 3: Create unit test file — src/__tests__/unit/services/cluster-map.service.test.ts
Step 4: Create pure service — lib/services/cluster-map.service.ts
        Run: npm run test:unit -- --grep "cluster-map"
        Expect: All 45 unit tests GREEN
Step 5: Create data fetcher test — src/__tests__/unit/data/cluster-map.test.ts
Step 6: Create data fetcher — lib/data/cluster-map.ts
        Run: npm run test:unit -- --grep "cluster-map"
        Expect: All 57 tests GREEN (45 service + 12 data)
Step 7: Create server action test — src/__tests__/integration/cluster-map-action.test.ts
Step 8: Create server action — app/dashboard/cluster-map/actions.ts
        Run: npm test -- --grep "cluster-map"
        Expect: All 65 tests GREEN (45 + 12 + 8)
Step 9: Create client components:
        a. EngineToggle.tsx
        b. ClusterChart.tsx (Recharts ScatterChart)
        c. HallucinationAlertCard.tsx
        d. ClusterMapWrapper.tsx
Step 10: Create dashboard page — app/dashboard/cluster-map/page.tsx
Step 11: Create error boundary — app/dashboard/cluster-map/error.tsx
Step 12: Add nav item to sidebar
Step 13: Update seed.sql with cluster map data
Step 14: Full test run: npm test
         Expect: ALL existing tests still pass + 65 new tests GREEN
Step 15: Manual verification in browser at /dashboard/cluster-map
```

---

## 🚫 Anti-Patterns — DO NOT

1. **DO NOT create new database tables or migrations.** All data comes from existing tables.
2. **DO NOT make AI API calls.** This is a data visualization feature, not an analysis feature.
3. **DO NOT install new npm packages.** Recharts + Tremor are already installed.
4. **DO NOT use `@tremor/react`** — incompatible with Tailwind v4 (AI_RULES §6).
5. **DO NOT use `getAuthContext()` in server actions** — use `getSafeAuthContext()` (AI_RULES §3).
6. **DO NOT create Supabase clients in services** — they're pure functions (AI_RULES §6).
7. **DO NOT hardcode org_id or accept it from the client** — derive server-side (AI_RULES §3).
8. **DO NOT use dynamic Tailwind classes** — use literal class names (AI_RULES §12).
9. **DO NOT use Framer Motion or GSAP** — CSS only (DESIGN-SYSTEM.md Hard Rules §1).
10. **DO NOT skip the error.tsx boundary** — every dashboard page needs one.

---

## 🎨 Styling Reference — Design System Tokens

```css
/* Background */
bg-midnight-slate     /* Page background */
bg-surface-dark       /* Card/panel background */

/* Chart elements */
text-signal-green     /* Your business (self) */
text-electric-indigo  /* Competitors */
text-alert-crimson    /* Hallucination zones */
text-alert-amber      /* Warning states */
text-truth-emerald    /* High-accuracy quadrant */

/* Borders */
border-white/5        /* Card borders */
border-alert-crimson/30  /* Hallucination cards */
border-electric-indigo/30 /* Competitor info */

/* Text */
text-white            /* Primary text */
text-slate-400        /* Secondary/muted text */
text-slate-300        /* Axis labels */
```

---

## 📝 Documentation Updates

After implementation, update these files:

1. **CLAUDE.md** — Add Cluster Map to the "Key Engines (Built)" table:
   ```
   | Cluster Map | lib/services/cluster-map.service.ts + lib/data/cluster-map.ts | Scatter plot visualization: Brand Authority × Fact Accuracy × SOV bubble size. Hallucination fog overlay from Fear Engine. Engine toggle for per-AI-model view. Pure service, no AI calls, no new tables. UI at `/dashboard/cluster-map`. |
   ```

2. **docs/00-INDEX.md** — Add sprint reference

3. **DEVLOG.md** — Add sprint log entry

4. **supabase/seed.sql** — Add cluster map seed data (Step 13)

---

## ✅ Definition of Done

- [ ] `lib/services/cluster-map.service.ts` — Pure service with all exported functions
- [ ] `lib/data/cluster-map.ts` — Data fetcher with RLS-scoped queries
- [ ] `app/dashboard/cluster-map/actions.ts` — Server action with auth guard
- [ ] `app/dashboard/cluster-map/page.tsx` — Server component with empty states
- [ ] `app/dashboard/cluster-map/error.tsx` — Error boundary
- [ ] `app/dashboard/cluster-map/_components/EngineToggle.tsx` — Engine filter toggle
- [ ] `app/dashboard/cluster-map/_components/ClusterChart.tsx` — Recharts scatter plot
- [ ] `app/dashboard/cluster-map/_components/HallucinationAlertCard.tsx` — Alert cards
- [ ] `app/dashboard/cluster-map/_components/ClusterMapWrapper.tsx` — Client state coordinator
- [ ] `src/__fixtures__/cluster-map-fixtures.ts` — Test fixtures with pre-computed expected values
- [ ] `src/__tests__/unit/services/cluster-map.service.test.ts` — 45 unit tests GREEN
- [ ] `src/__tests__/unit/data/cluster-map.test.ts` — 12 data tests GREEN
- [ ] `src/__tests__/integration/cluster-map-action.test.ts` — 8 integration tests GREEN
- [ ] Sidebar navigation updated
- [ ] Seed data updated
- [ ] All pre-existing tests still pass
- [ ] `CLAUDE.md` updated with new engine entry
- [ ] `DEVLOG.md` updated with sprint log
