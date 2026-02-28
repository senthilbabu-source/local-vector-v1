# Sprint B — First Impressions: Sample Data Mode, Tooltip System, Settings Expansion & Plan Comparison

> **Claude Code Prompt — Bulletproof Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`
> **Prerequisite:** Sprint A must be fully merged and all its tests passing before starting Sprint B.

---

## 🎯 Objective

Four medium-effort fixes targeting the highest-churn moments in the LocalVector customer journey. Every fix targets a specific failure point identified in the February 2026 code analysis:

1. **C4 — Sample Data Mode** — A paying customer who signs up on a Monday sees 15+ blank dashboard cards for up to 6 days. This is the #1 churn risk in the product. Sample data mode shows a realistic populated dashboard with a "SAMPLE DATA" watermark until the first real scan completes.
2. **H1 — InfoTooltip System** — Nothing in the dashboard explains the metrics to users. A restaurant owner sees "Reality Score: 62" and has no idea what it means. An `InfoTooltip` component wired into 10 priority cards transforms the dashboard from opaque to self-explanatory.
3. **H2 — Settings Page Expansion** — The Settings page is missing 8+ controls that users need: AI model selection, custom query templates, webhook URL for alerts, score drop threshold, "Restart Tour" trigger, and more.
4. **M3 — In-App Plan Feature Comparison** — The billing page shows prices but not what you get. A Growth plan user can't see what Agency adds. The plan-enforcer already has the feature matrix — render it as a comparison table to drive upgrade conversion.

**Why this sprint second:** Sprint A restored observability (Sentry) and trust (plan names). Sprint B converts that trust into retention. A user who understands what they're seeing, can configure the product to their needs, and doesn't face a blank dashboard on day 1 is a user who stays past the trial period.

**Estimated total implementation time:** 20–30 hours. This is a medium-complexity sprint — approach methodically, one component at a time.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

Before writing ANY code, read these files in order. Do not skip any.

```
Read docs/AI_RULES.md                                                 — All engineering rules
Read CLAUDE.md                                                        — Project context, architecture, patterns
Read MEMORY.md                                                        — Key decisions and constraints
Read supabase/prod_schema.sql                                         — Canonical schema (understand ALL tables)
Read lib/supabase/database.types.ts                                   — TypeScript DB types
Read src/__fixtures__/golden-tenant.ts                                — Golden tenant data shapes (your sample data source)
Read supabase/seed.sql                                                 — 40+ seeded rows; understand data shapes for all tables
Read app/dashboard/page.tsx                                           — Lines 152–165: the current empty-state message; full dashboard layout
Read app/dashboard/_components/MetricCard.tsx                         — Current props (after Sprint A href changes)
Read app/dashboard/_components/AIHealthScoreCard.tsx                  — Component bars: Visibility, Accuracy, Structure, Freshness
Read app/dashboard/_components/RealityScoreCard.tsx                   — Current score card props and render
Read app/dashboard/_components/SOVTrendChart.tsx                      — Chart structure, data shape expected
Read app/dashboard/_components/HallucinationsByModel.tsx              — Chart structure, data shape
Read app/dashboard/_components/CompetitorComparison.tsx               — (if exists) competitor chart
Read app/dashboard/_components/ProofTimelineCard.tsx                  — (if exists) proof timeline card
Read app/dashboard/_components/EntityHealthCard.tsx                   — (if exists) entity health card
Read app/dashboard/settings/_components/SettingsForm.tsx              — ALL current settings sections
Read app/dashboard/settings/page.tsx                                  — Settings page server component
Read lib/plan-enforcer.ts                                             — ALL gating functions (source of truth for M3 feature matrix)
Read app/dashboard/billing/page.tsx                                   — Current billing page (after Sprint A plan name changes)
Read app/dashboard/_components/GuidedTour.tsx                         — Current tour steps (5 steps) and localStorage key
Read lib/plan-display-names.ts                                        — Sprint A artifact: plan display names (use getPlanDisplayName())
Read components/ui/tooltip.tsx                                        — Existing shadcn tooltip (if present — do NOT duplicate)
Read components/ui/popover.tsx                                        — Existing shadcn popover (if present — may be used for InfoTooltip)
```

**Specifically understand before writing code:**
- **Dashboard empty state trigger:** exactly what conditions cause the 6-day blank (line 152–165 in `dashboard/page.tsx`) — likely `scores.realityScore === null`.
- **Seed data shape:** what columns and value ranges exist in `seed.sql` for `locations`, `ai_scores`, `sov_entries`, `hallucination_alerts`, `competitor_comparisons`. Your sample data must match these exact shapes.
- **`plan-enforcer.ts` gating functions:** list all 17 (or however many exist). You will render these as the feature comparison table in M3. Read each one — understand the feature name, which plans it's gated to.
- **Existing shadcn UI components:** check for `Tooltip`, `Popover`, `HoverCard` in `components/ui/`. Use whatever already exists rather than installing new dependencies. If none exist, you may use `@radix-ui/react-tooltip` (check `package.json` first).
- **Settings form architecture:** Is it a single React form component with sections? A multi-tab layout? A set of server actions for each section? Understanding the save pattern before adding new sections is critical.
- **`onboarding_state` tracking:** does the DB have a column on `orgs` or a separate `onboarding_state` table that tracks whether a user has completed their first real scan? This is how sample data mode knows when to stop showing sample data.

---

## 🏗️ Architecture — What to Build

---

### Component 1: Sample Data Mode — `lib/sample-data/sample-dashboard-data.ts` + Dashboard Integration

**The problem in precise terms:** `app/dashboard/page.tsx` lines 152–165 render a single line of text when `scores.realityScore === null`. The AIHealthScoreCard, SOVTrendChart, HallucinationsByModel, CompetitorComparison, ProofTimelineCard, and EntityHealthCard all receive null or empty data and render either nothing or skeletons with no content.

**The solution:** When the org has no real scan data, substitute realistic sample data in the same shape as real data. Overlay a `SAMPLE DATA` badge on each card that uses substituted data. Auto-dismiss when a real scan completes.

#### Step 1: Create `lib/sample-data/sample-dashboard-data.ts`

This file is the single source of truth for all sample data. It is a pure TypeScript file — no imports from Supabase, no I/O.

```typescript
/**
 * Sample Dashboard Data — Sprint B
 *
 * Realistic mock data displayed to new users before their first automated scan.
 * Data shapes must EXACTLY match the real data types fetched in app/dashboard/page.tsx.
 * Modeled after Charcoal N Chill (the golden tenant) — a hookah lounge and fusion
 * restaurant in Alpharetta, GA.
 *
 * IMPORTANT: Before modifying any export, verify the shape matches the corresponding
 * type in lib/supabase/database.types.ts and the actual fetch call in dashboard/page.tsx.
 * A shape mismatch will cause TypeScript errors or silent runtime failures.
 */

/**
 * How to determine the correct data shape:
 * 1. Find the fetch call in dashboard/page.tsx (e.g., the call that fetches `scores`)
 * 2. Look at the SELECT columns
 * 3. Match that exact shape here — same field names, same nullable/non-nullable pattern
 */

// ─── Reality & AI Health Scores ───────────────────────────────────────────────

export const SAMPLE_SCORES = {
  realityScore: 61,
  aiVisibility: 47,
  accuracyScore: 68,
  structureScore: 72,
  freshnessScore: 55,
  // Add any additional score fields that the real fetch returns
} as const;

// ─── AI Health Score Card Breakdown ───────────────────────────────────────────

export const SAMPLE_AI_HEALTH = {
  overall: 61,
  components: {
    visibility: { score: 47, label: 'Visibility', description: 'How often AI mentions your business' },
    accuracy:   { score: 68, label: 'Accuracy',   description: 'How correctly AI describes your business' },
    structure:  { score: 72, label: 'Structure',   description: 'Schema and structured data completeness' },
    freshness:  { score: 55, label: 'Freshness',   description: 'How current your information is across AI models' },
  },
  topRecommendation: {
    label: 'Fix 2 open hallucination alerts',
    actionLabel: 'View Alerts',
    actionHref: '/dashboard/alerts',
  },
} as const;

// ─── SOV Trend Chart ──────────────────────────────────────────────────────────

/** Matches the shape of sov_entries rows or the aggregated trend data the chart expects. */
export const SAMPLE_SOV_TREND = [
  { week: '2026-01-05', sov_percent: 34, rank: 4 },
  { week: '2026-01-12', sov_percent: 38, rank: 3 },
  { week: '2026-01-19', sov_percent: 41, rank: 3 },
  { week: '2026-01-26', sov_percent: 39, rank: 3 },
  { week: '2026-02-02', sov_percent: 44, rank: 2 },
  { week: '2026-02-09', sov_percent: 47, rank: 2 },
  { week: '2026-02-16', sov_percent: 45, rank: 2 },
  { week: '2026-02-23', sov_percent: 47, rank: 2 },
];

// ─── Hallucinations by Model ──────────────────────────────────────────────────

/** Matches the shape the HallucinationsByModel chart expects. */
export const SAMPLE_HALLUCINATIONS_BY_MODEL = [
  { model: 'ChatGPT',   open: 2, resolved: 5 },
  { model: 'Perplexity', open: 1, resolved: 3 },
  { model: 'Gemini',    open: 1, resolved: 2 },
  { model: 'Copilot',   open: 0, resolved: 1 },
];

// ─── Open Alerts Count ────────────────────────────────────────────────────────

export const SAMPLE_OPEN_ALERTS = [
  {
    id: 'sample-alert-1',
    type: 'hallucination',
    severity: 'high',
    model: 'ChatGPT',
    description: 'ChatGPT listed incorrect hours — showing 11am open instead of 5pm',
    created_at: '2026-02-20T10:00:00Z',
  },
  {
    id: 'sample-alert-2',
    type: 'hallucination',
    severity: 'medium',
    model: 'Gemini',
    description: 'Gemini shows outdated phone number for your location',
    created_at: '2026-02-22T14:00:00Z',
  },
];

// ─── Competitor Comparison ────────────────────────────────────────────────────

/** Matches the shape CompetitorComparison chart expects. */
export const SAMPLE_COMPETITOR_COMPARISON = [
  { name: 'Your Business',   realityScore: 61, aiVisibility: 47 },
  { name: 'Competitor A',    realityScore: 58, aiVisibility: 43 },
  { name: 'Competitor B',    realityScore: 71, aiVisibility: 55 },
  { name: 'Industry Avg',    realityScore: 54, aiVisibility: 39 },
];

// ─── MetricCard values ────────────────────────────────────────────────────────

export const SAMPLE_METRIC_CARDS = {
  openAlerts:       2,
  interceptCount:   7,
  citationsFound:   14,
  weeklyMentions:   31,
};
```

**CRITICAL shape verification step:** Before saving this file, look at every `SELECT` in `app/dashboard/page.tsx`. Every field name in `SAMPLE_SCORES`, `SAMPLE_SOV_TREND`, etc. must exactly match what the real fetch returns. If a field name in the real data is `sov_percentage` (not `sov_percent`), use `sov_percentage` in the sample data too. If it's `accuracy_score` (snake_case) not `accuracyScore`, adjust accordingly. TypeScript strict mode will catch most mismatches — fix all type errors before proceeding.

#### Step 2: Create `lib/sample-data/use-sample-mode.ts`

A single hook that determines whether sample mode is active for the current org.

```typescript
'use client';

/**
 * Returns true if the org has no real scan data yet and should display sample data.
 * Criteria: realityScore is null AND the org was created less than 14 days ago.
 * After 14 days, assume the scan ran (or failed) and stop showing sample data.
 *
 * @param realityScore - the org's current realityScore from the DB
 * @param orgCreatedAt - ISO timestamp of when the org was created
 */
export function isSampleMode(
  realityScore: number | null,
  orgCreatedAt: string | null,
): boolean {
  if (realityScore !== null) return false;           // Real data exists — not sample mode
  if (!orgCreatedAt) return false;                   // Can't determine — fail safe (show nothing)
  const ageMs = Date.now() - new Date(orgCreatedAt).getTime();
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;
  return ageMs < fourteenDays;                       // Sample mode for up to 14 days
}
```

#### Step 3: Create `components/ui/SampleDataBadge.tsx`

A reusable badge/overlay component placed on any card that is showing sample data.

```tsx
/**
 * SampleDataBadge — overlays a "SAMPLE DATA" indicator on dashboard cards.
 *
 * Usage:
 *   <div className="relative">
 *     <YourCard />
 *     {isSample && <SampleDataBadge />}
 *   </div>
 *
 * The badge is a small pill in the top-right corner of the card.
 * It does NOT block interaction with the card underneath.
 */
export function SampleDataBadge() {
  return (
    <div
      className="absolute top-2 right-2 z-10 pointer-events-none"
      aria-label="This card is showing sample data"
      data-testid="sample-data-badge"
    >
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200 select-none">
        <span aria-hidden="true">◈</span>
        Sample Data
      </span>
    </div>
  );
}
```

#### Step 4: Create `components/ui/SampleModeBanner.tsx`

A dismissible banner shown once at the top of the dashboard in sample mode. Does not repeat after dismiss.

```tsx
/**
 * SampleModeBanner — shown at the top of the dashboard when in sample mode.
 * Explains what sample data is. Dismissible (stores dismiss state in sessionStorage).
 * Auto-hides when isSample becomes false (real scan completed).
 */
export function SampleModeBanner({ nextScanDate }: { nextScanDate: string }) {
  // Use sessionStorage (not localStorage) — should reappear on next login
  const [dismissed, setDismissed] = useState(() =>
    typeof window !== 'undefined'
      ? sessionStorage.getItem('lv_sample_banner_dismissed') === 'true'
      : false
  );

  if (dismissed) return null;

  return (
    <div
      className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
      data-testid="sample-mode-banner"
      role="status"
    >
      <span className="mt-0.5 text-amber-500" aria-hidden="true">◈</span>
      <div className="flex-1 text-sm text-amber-800">
        <p className="font-medium">You're looking at sample data.</p>
        <p className="mt-0.5 text-amber-700">
          Your first automated scan runs on <strong>{nextScanDate}</strong>. These cards will populate
          with your real AI visibility data after that scan completes. Everything shown here reflects
          typical results for a local business in your category.
        </p>
      </div>
      <button
        onClick={() => {
          sessionStorage.setItem('lv_sample_banner_dismissed', 'true');
          setDismissed(true);
        }}
        className="ml-2 mt-0.5 rounded text-amber-500 hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
        aria-label="Dismiss sample data notice"
        data-testid="sample-banner-dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
```

Import `X` from `'lucide-react'`. Import `useState` from `'react'`. Add `'use client'` at the top.

#### Step 5: Integrate into `app/dashboard/page.tsx`

This is the most surgical step. Read the file carefully before modifying.

**Find the empty state block** (lines 152–165 approximately):
```typescript
// CURRENT (remove this entire block):
if (scores.realityScore === null && openAlerts.length === 0) {
  return (
    <p>Your first automated scan runs Sunday, ...</p>
  );
}
```

**Replace with sample data integration:**

```typescript
// At the top of the page component (after existing data fetches):
const sampleMode = isSampleMode(scores?.realityScore ?? null, org?.created_at ?? null);

// Derive the data to actually display — real data takes priority:
const displayScores           = sampleMode ? SAMPLE_SCORES          : scores;
const displayAIHealth         = sampleMode ? SAMPLE_AI_HEALTH        : aiHealth;
const displaySOVTrend         = sampleMode ? SAMPLE_SOV_TREND        : sovTrend;
const displayHallucinationData = sampleMode ? SAMPLE_HALLUCINATIONS_BY_MODEL : hallucinationData;
const displayCompetitors      = sampleMode ? SAMPLE_COMPETITOR_COMPARISON   : competitors;
const displayOpenAlerts       = sampleMode ? SAMPLE_OPEN_ALERTS      : openAlerts;
const displayMetrics          = sampleMode ? SAMPLE_METRIC_CARDS     : {
  openAlerts: openAlerts.length,
  interceptCount,
  citationsFound,
  weeklyMentions,
};

// Remove the early return that shows the empty state text.
// The dashboard now always renders — with real or sample data.
```

**In the JSX, wrap each card that shows sample data:**

```tsx
// Pattern for every card that uses substituted data:
<div className="relative">
  <MetricCard
    label="Open Alerts"
    value={displayMetrics.openAlerts}
    href="/dashboard/alerts"
  />
  {sampleMode && <SampleDataBadge />}
</div>
```

Apply this `relative` wrapper + conditional `<SampleDataBadge />` to every card that receives substituted data: the 4 MetricCards, AIHealthScoreCard, RealityScoreCard, SOVTrendChart, HallucinationsByModel, CompetitorComparison, ProofTimelineCard, EntityHealthCard.

**Add the banner at the top of the dashboard JSX (inside the page's return, before the card grid):**

```tsx
{sampleMode && (
  <SampleModeBanner nextScanDate={getNextSundayLabel()} />
)}
```

Create a small helper:
```typescript
function getNextSundayLabel(): string {
  const now = new Date();
  const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + daysUntilSunday);
  return nextSunday.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
```

**Rules:**
- `isSampleMode()` is called once, at the top of the server component. Do not re-derive it in child components.
- If the dashboard page is a Server Component, move `isSampleMode()` call server-side — it's a pure function and can run on the server. Pass `sampleMode: boolean` as a prop to any client components that need to know.
- `SampleDataBadge` uses `absolute` positioning — every wrapping `<div>` must have `relative` for positioning to work.
- Do NOT show the `SampleModeBanner` if `sampleMode === false`. The banner should never appear to users with real data.
- The "next scan date" in the banner should be the next Sunday after today (the real cron schedule). Use `getNextSundayLabel()` above.

---

### Component 2: InfoTooltip System — `components/ui/InfoTooltip.tsx` + Card Integration

**The problem:** A restaurant owner sees "Reality Score: 62" and has zero context. There are no tooltips, no "what is this?" affordances, and the GuidedTour covers only 5 of 22 pages without explaining metric derivation.

#### Step 1: Check existing UI primitives

Before writing any code, run:
```bash
ls components/ui/ | grep -iE "tooltip|popover|hover"
cat package.json | grep -E "radix|tooltip|popover"
```

If `components/ui/tooltip.tsx` already exists (shadcn), use it as the base. If `components/ui/popover.tsx` exists, use it. Do NOT install a new package if a usable primitive already exists.

#### Step 2: Create `components/ui/InfoTooltip.tsx`

A `?` icon that opens an informational popover on hover (desktop) or click (touch/keyboard). Accessible. Composable into any card header.

```tsx
'use client';

/**
 * InfoTooltip — a composable "?" info icon with a popover.
 *
 * Usage in a card header:
 *   <div className="flex items-center gap-1.5">
 *     <h3 className="text-sm font-medium">Reality Score</h3>
 *     <InfoTooltip content={TOOLTIP_CONTENT.realityScore} />
 *   </div>
 *
 * The popover opens on hover (mouse) and on click/Enter (keyboard/touch).
 * It does not interfere with card click-through to detail pages.
 */

interface InfoTooltipProps {
  /** The tooltip content. Can be a string or JSX. */
  content: React.ReactNode;
  /** Screen-reader label for the trigger button. Default: "More information" */
  label?: string;
  /** Popover alignment relative to the trigger. Default: "start" */
  align?: 'start' | 'center' | 'end';
}

export function InfoTooltip({ content, label = 'More information', align = 'start' }: InfoTooltipProps) {
  // Implementation: use existing Radix Tooltip or Popover from components/ui/
  // If using Tooltip: works on hover; add onClick for touch devices
  // If using Popover: works on click; add onMouseEnter/Leave for hover
  //
  // Prefer Popover if touch users are a meaningful segment (mobile dashboard users).
  // Prefer Tooltip if the content is very brief (1–2 lines).
  // For this use case (multi-line metric explanations), use Popover.
}
```

**Popover content anatomy:**

```tsx
// Inside the Popover content, render this structure:
<div className="max-w-xs space-y-2 p-1" data-testid="info-tooltip-content">
  {typeof content === 'string' ? (
    <p className="text-sm text-foreground">{content}</p>
  ) : (
    content  // JSX content with structure
  )}
</div>
```

**The trigger button:**

```tsx
<button
  type="button"
  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
  aria-label={label}
  data-testid="info-tooltip-trigger"
>
  <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
</button>
```

Import `HelpCircle` from `'lucide-react'`.

#### Step 3: Create `lib/tooltip-content.ts`

All tooltip text in one place. This prevents inline copy that drifts across components.

```typescript
/**
 * Tooltip content definitions for all dashboard metric cards.
 * Import specific entries where needed rather than the whole object.
 * All content reviewed for accuracy — do not change without verifying
 * the underlying calculation logic in the relevant service file.
 */

import type { ReactNode } from 'react';

interface TooltipDef {
  title: string;
  what: string;
  how: string;
  action: string;
}

function tooltipJSX({ title, what, how, action }: TooltipDef): ReactNode {
  // This returns a JSX element — it must be imported from a .tsx file
  // Move this function to lib/tooltip-content.tsx if needed for JSX support
}

export const TOOLTIP_CONTENT = {

  realityScore: {
    title: 'Reality Score',
    what: 'A 0–100 measure of how accurately AI models represent your business right now.',
    how: 'Weighted average: Visibility (40%) + Accuracy (40%) + Data Health (20%).',
    action: 'Fix open hallucination alerts to improve your Accuracy score.',
  },

  aiVisibility: {
    title: 'AI Visibility',
    what: 'How often your business appears in AI-generated answers to local search queries.',
    how: 'Percent of monitored queries where at least one AI model mentions your business by name.',
    action: 'Add more structured data and citation sources to increase mentions.',
  },

  openAlerts: {
    title: 'Open Alerts',
    what: 'Confirmed hallucinations — cases where an AI model said something factually wrong about your business.',
    how: 'Each alert is a distinct wrong fact (wrong hours, wrong phone, wrong location) verified across multiple query runs.',
    action: 'Generate a correction brief and distribute the correct info to citation sources.',
  },

  interceptCount: {
    title: 'Intercept Analyses',
    what: 'The number of times we\'ve analyzed what AI models say about searches for businesses like yours.',
    how: 'Each "intercept" is one AI model responding to one of your monitored query templates.',
    action: 'More intercepts = more data. Upgrade your query list in Settings to increase coverage.',
  },

  shareOfVoice: {
    title: 'Share of Voice',
    what: 'Your business\'s percentage of AI mentions compared to all businesses in your category and area.',
    how: 'Count of queries where AI mentioned you ÷ total monitored queries × 100.',
    action: 'Outperform competitors by fixing hallucinations and adding fresh citation sources.',
  },

  hallucinationsByModel: {
    title: 'Hallucinations by Model',
    what: 'Which AI models are generating incorrect information about your business.',
    how: 'Each bar shows open (unresolved) vs. resolved hallucinations per AI model.',
    action: 'Models with the most open hallucinations are your highest-priority correction targets.',
  },

  // AIHealthScoreCard sub-component tooltips:
  visibilityComponent: {
    title: 'Visibility',
    what: 'How often AI includes your business in relevant local search results.',
    how: '40% of your overall Reality Score.',
    action: 'Build more online citations and mentions to increase visibility.',
  },

  accuracyComponent: {
    title: 'Accuracy',
    what: 'How correctly AI models describe your business facts (hours, address, phone, services).',
    how: '40% of your overall Reality Score. Reduced by each open hallucination.',
    action: 'Resolve open hallucination alerts to directly improve this score.',
  },

  structureComponent: {
    title: 'Structure',
    what: 'How complete your business\'s schema markup and structured data is.',
    how: '10% of your overall Reality Score. Improved by running Magic Menu schema generation.',
    action: 'Generate and publish your business schema via the Magic Menu.',
  },

  freshnessComponent: {
    title: 'Freshness',
    what: 'How recently AI models have updated their knowledge about your business.',
    how: '10% of your overall Reality Score. Higher when AI has seen recent mentions of your business.',
    action: 'Publish fresh content regularly and update your Google Business Profile.',
  },

} as const;

export type TooltipKey = keyof typeof TOOLTIP_CONTENT;
```

**Note:** If JSX rendering inside `tooltipJSX()` causes issues in a `.ts` file, rename to `lib/tooltip-content.tsx` and adjust imports accordingly.

#### Step 4: Wire `InfoTooltip` into 10 Priority Cards

Apply in this order. Each card requires:
1. Adding `<InfoTooltip content={...} />` next to the metric label in the card header
2. Wrapping the label and tooltip in `<div className="flex items-center gap-1.5">...</div>`

**Priority card list:**

| Card | Component File | Tooltip Key | Placement |
|------|----------------|-------------|-----------|
| Open Alerts MetricCard | `dashboard/page.tsx` (inline) | `TOOLTIP_CONTENT.openAlerts` | After label text |
| AI Visibility MetricCard | `dashboard/page.tsx` (inline) | `TOOLTIP_CONTENT.aiVisibility` | After label text |
| Reality Score MetricCard | `dashboard/page.tsx` (inline) | `TOOLTIP_CONTENT.realityScore` | After label text |
| Intercept Count MetricCard | `dashboard/page.tsx` (inline) | `TOOLTIP_CONTENT.interceptCount` | After label text |
| `RealityScoreCard` | `_components/RealityScoreCard.tsx` | `TOOLTIP_CONTENT.realityScore` | Card title area |
| `AIHealthScoreCard` | `_components/AIHealthScoreCard.tsx` | `TOOLTIP_CONTENT.realityScore` (overall) | Card title area |
| AIHealth — Visibility bar | `_components/AIHealthScoreCard.tsx` | `TOOLTIP_CONTENT.visibilityComponent` | Next to "Visibility" label |
| AIHealth — Accuracy bar | `_components/AIHealthScoreCard.tsx` | `TOOLTIP_CONTENT.accuracyComponent` | Next to "Accuracy" label |
| `SOVTrendChart` | `_components/SOVTrendChart.tsx` | `TOOLTIP_CONTENT.shareOfVoice` | Card title area |
| `HallucinationsByModel` | `_components/HallucinationsByModel.tsx` | `TOOLTIP_CONTENT.hallucinationsByModel` | Card title area |

**Rules:**
- The `InfoTooltip` must not interfere with the MetricCard `href` link from Sprint A. The tooltip trigger button is a `<button>` with `e.stopPropagation()` if needed inside a `<Link>`.
- Add `data-testid="info-tooltip-trigger"` to the `?` button in every instance.
- Add `data-testid="info-tooltip-content"` to the popover content wrapper.
- Do NOT add InfoTooltip to chart axes, legend items, or Recharts data points — those have their own hover behavior.
- The Structure and Freshness component bars in AIHealthScoreCard: add tooltips only if they are separately labeled bars in the component. If they are computed into the overall score without individual display, skip them.

---

### Component 3: Settings Page Expansion — `app/dashboard/settings/_components/SettingsForm.tsx`

**The problem:** Settings has 5 sections covering basics. 8+ needed controls are absent, forcing users to hunt for features buried in other pages or simply not know they exist.

Read the current `SettingsForm.tsx` completely before making any changes. Understand the save pattern (server action? form submission? optimistic updates?). Match it exactly for new sections.

#### New Section A: AI Models to Track

Add a new settings section "AI Monitoring" with checkboxes for which AI models are included in audits.

```typescript
// New DB column needed: orgs.monitored_ai_models (text[] or jsonb)
// Check prod_schema.sql — if this column doesn't exist, create a migration.
// Migration file: supabase/migrations/[timestamp]_orgs_ai_model_preferences.sql
```

**Migration (only if column doesn't exist):**
```sql
-- Sprint B: Add AI model preferences to orgs
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS monitored_ai_models text[] DEFAULT ARRAY['openai','perplexity','gemini','copilot']::text[];

COMMENT ON COLUMN public.orgs.monitored_ai_models IS
  'AI models included in SOV and hallucination scans. Sprint B.';
```

**Settings section UI:**

```tsx
// Section: AI Monitoring
<SettingsSection title="AI Monitoring" description="Choose which AI models LocalVector tracks for your business.">
  {AI_MODELS.map((model) => (
    <div key={model.id} className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-foreground">{model.label}</p>
        <p className="text-xs text-muted-foreground">{model.description}</p>
      </div>
      <Switch
        checked={monitoredModels.includes(model.id)}
        onCheckedChange={(checked) => toggleModel(model.id, checked)}
        aria-label={`Track ${model.label}`}
        data-testid={`model-toggle-${model.id}`}
      />
    </div>
  ))}
</SettingsSection>

// AI_MODELS constant:
const AI_MODELS = [
  { id: 'openai',      label: 'ChatGPT (OpenAI)',    description: 'GPT-4o and o1 responses' },
  { id: 'perplexity',  label: 'Perplexity',          description: 'Real-time web-grounded answers' },
  { id: 'gemini',      label: 'Google Gemini',       description: 'Gemini 1.5 Pro responses' },
  { id: 'copilot',     label: 'Microsoft Copilot',   description: 'Copilot and Bing AI responses' },
] as const;
```

#### New Section B: Score Drop Threshold Alert

Add to the existing Notifications section (do not create a new section — extend it).

```tsx
// Add below existing notification toggles:
<div className="flex items-center justify-between py-2 border-t border-border/50 mt-2 pt-4">
  <div className="flex-1">
    <p className="text-sm font-medium text-foreground">Reality Score Drop Alert</p>
    <p className="text-xs text-muted-foreground">
      Send an alert if your Reality Score drops by this many points between weekly scans.
    </p>
  </div>
  <div className="flex items-center gap-2">
    <select
      value={scoreDropThreshold}
      onChange={(e) => setScoreDropThreshold(Number(e.target.value))}
      className="rounded-md border border-input bg-background px-2 py-1 text-sm"
      data-testid="score-drop-threshold"
    >
      <option value={0}>Disabled</option>
      <option value={5}>5 points</option>
      <option value={10}>10 points</option>
      <option value={15}>15 points</option>
      <option value={20}>20 points</option>
    </select>
  </div>
</div>
```

**DB column:** `orgs.score_drop_threshold integer DEFAULT 10`. Add to migration file (same file as monitored_ai_models if creating a new one, or a separate migration if that column already exists).

#### New Section C: Webhook URL for Alerts (Agency plan only)

```tsx
// Plan-gate this section: show only to agency plan users
// Use plan-enforcer checkPlan('agency') server-side, pass as prop
<SettingsSection
  title="Webhooks"
  description="Send alert notifications to an external URL (Slack, Zapier, n8n)."
  planBadge={!isAgency ? 'Agency' : undefined}   // shows upgrade prompt if not agency
>
  {isAgency ? (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground" htmlFor="webhook-url">
        Alert Webhook URL
      </label>
      <input
        id="webhook-url"
        type="url"
        placeholder="https://hooks.slack.com/services/..."
        value={webhookUrl}
        onChange={(e) => setWebhookUrl(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        data-testid="webhook-url-input"
      />
      <p className="text-xs text-muted-foreground">
        POST requests are sent when a hallucination is detected or your Reality Score drops.
      </p>
    </div>
  ) : (
    <UpgradePlanPrompt feature="Webhooks" requiredPlan="Brand Fortress" />
  )}
</SettingsSection>
```

**DB column:** `orgs.webhook_url text`. Add to migration.

#### New Section D: Restart Guided Tour

Add a single button to the Account section:

```tsx
// Inside the Account section, at the bottom:
<div className="flex items-center justify-between py-2 border-t border-border/50 mt-4 pt-4">
  <div>
    <p className="text-sm font-medium text-foreground">Product Tour</p>
    <p className="text-xs text-muted-foreground">Re-run the guided tour of LocalVector's key features.</p>
  </div>
  <button
    type="button"
    onClick={handleRestartTour}
    className="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted"
    data-testid="restart-tour-btn"
  >
    Restart Tour
  </button>
</div>
```

**`handleRestartTour` implementation:**
```typescript
function handleRestartTour() {
  localStorage.removeItem('lv_tour_completed');  // Use the exact key from GuidedTour.tsx
  window.location.reload();                       // GuidedTour auto-starts on page load when key is absent
}
```

**Verify the localStorage key name** by reading `GuidedTour.tsx` before implementing. Use the exact key.

#### Settings Save Pattern

Read the existing save pattern in `SettingsForm.tsx` before implementing saves for new fields. Match it exactly:
- If it uses server actions: create or extend the existing settings server action.
- If it uses `fetch('/api/settings', { method: 'PATCH' })`: extend the existing API route.
- If it uses Supabase direct client: maintain that pattern.

**Do not introduce a new save pattern** that differs from what already exists.

#### `UpgradePlanPrompt` component

If this component doesn't already exist, create a minimal version:

```tsx
// components/ui/UpgradePlanPrompt.tsx
export function UpgradePlanPrompt({ feature, requiredPlan }: { feature: string; requiredPlan: string }) {
  return (
    <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm">
      <p className="text-foreground">
        <span className="font-medium">{feature}</span> is available on the{' '}
        <span className="font-medium text-primary">{requiredPlan}</span> plan.
      </p>
      <Link href="/dashboard/billing" className="mt-1 inline-block text-xs text-primary hover:underline">
        View upgrade options →
      </Link>
    </div>
  );
}
```

---

### Component 4: Plan Feature Comparison Table — `app/dashboard/billing/page.tsx`

**The problem:** The billing page shows plan prices but no feature matrix. A Growth plan user can't see what they'd gain from upgrading to Agency. The `lib/plan-enforcer.ts` file already has the full feature matrix encoded in ~17 gating functions — extract and render it.

#### Step 1: Extract the feature matrix from `lib/plan-enforcer.ts`

Read every gating function in `plan-enforcer.ts`. Build a static data structure that maps features to which plans include them. Do not call the gating functions at runtime — read them statically and hardcode the matrix. This is safer (no runtime dependency on plan-enforcer internals) and more maintainable.

**Create `lib/plan-feature-matrix.ts`:**

```typescript
/**
 * Plan Feature Matrix — Sprint B
 *
 * Derived from lib/plan-enforcer.ts. Each row is a feature.
 * Each plan column is true if that plan includes the feature, false if not.
 *
 * IMPORTANT: If plan-enforcer.ts changes (new gates, changed tiers),
 * update this file to match. These two files must stay in sync.
 * AI_RULES §44 governs this.
 *
 * Plans: trial | starter | growth | agency
 * Display names: The Audit | Starter | AI Shield | Brand Fortress
 */

export interface FeatureRow {
  /** Feature display name */
  label: string;
  /** Optional category for grouping rows */
  category: 'Core' | 'AI Monitoring' | 'Competitive' | 'Content' | 'Integrations' | 'Support';
  /** Whether each plan includes this feature */
  trial:   boolean | string;   // string = e.g., "5/mo" for partial access
  starter: boolean | string;
  growth:  boolean | string;
  agency:  boolean | string;
}

export const PLAN_FEATURE_MATRIX: FeatureRow[] = [
  // ── Core ──────────────────────────────────────────────────────────────────
  { category: 'Core',         label: 'Reality Score',              trial: true,    starter: true,    growth: true,    agency: true    },
  { category: 'Core',         label: 'Automated weekly scan',      trial: false,   starter: true,    growth: true,    agency: true    },
  { category: 'Core',         label: 'Hallucination alerts',       trial: '3 max', starter: true,    growth: true,    agency: true    },
  { category: 'Core',         label: 'Correction briefs',          trial: false,   starter: '5/mo',  growth: true,    agency: true    },
  { category: 'Core',         label: 'Weekly digest email',        trial: false,   starter: true,    growth: true,    agency: true    },

  // ── AI Monitoring ──────────────────────────────────────────────────────────
  { category: 'AI Monitoring', label: 'ChatGPT monitoring',        trial: true,    starter: true,    growth: true,    agency: true    },
  { category: 'AI Monitoring', label: 'Perplexity monitoring',     trial: false,   starter: true,    growth: true,    agency: true    },
  { category: 'AI Monitoring', label: 'Gemini monitoring',         trial: false,   starter: true,    growth: true,    agency: true    },
  { category: 'AI Monitoring', label: 'Copilot monitoring',        trial: false,   starter: false,   growth: true,    agency: true    },
  { category: 'AI Monitoring', label: 'Share of Voice tracking',   trial: false,   starter: false,   growth: true,    agency: true    },
  { category: 'AI Monitoring', label: 'Custom query templates',    trial: false,   starter: false,   growth: '10',    agency: 'Unlimited' },

  // ── Competitive ────────────────────────────────────────────────────────────
  { category: 'Competitive',  label: 'Competitor tracking',        trial: false,   starter: '3 max', growth: '10 max', agency: 'Unlimited' },
  { category: 'Competitive',  label: 'Competitor comparison chart',trial: false,   starter: false,   growth: true,    agency: true    },
  { category: 'Competitive',  label: 'Cluster map analysis',       trial: false,   starter: false,   growth: true,    agency: true    },

  // ── Content ────────────────────────────────────────────────────────────────
  { category: 'Content',      label: 'Magic Menu schema gen',      trial: false,   starter: true,    growth: true,    agency: true    },
  { category: 'Content',      label: 'Content Calendar',           trial: false,   starter: false,   growth: true,    agency: true    },
  { category: 'Content',      label: 'Content drafts',             trial: false,   starter: false,   growth: true,    agency: true    },

  // ── Integrations ──────────────────────────────────────────────────────────
  { category: 'Integrations', label: 'Google Business Profile sync', trial: false, starter: true,   growth: true,    agency: true    },
  { category: 'Integrations', label: 'Webhook alerts (Slack/Zapier)',trial: false, starter: false,  growth: false,   agency: true    },
  { category: 'Integrations', label: 'Multiple locations',         trial: false,   starter: false,   growth: false,   agency: true    },

  // ── Support ────────────────────────────────────────────────────────────────
  { category: 'Support',      label: 'Email support',              trial: false,   starter: true,    growth: true,    agency: true    },
  { category: 'Support',      label: 'Priority support',           trial: false,   starter: false,   growth: true,    agency: true    },
  { category: 'Support',      label: 'Dedicated account manager',  trial: false,   starter: false,   growth: false,   agency: true    },
];
```

**CRITICAL:** Before saving this matrix, cross-reference every row against `lib/plan-enforcer.ts`. Each `true/false/string` value must match the actual gating logic. If a feature doesn't appear in plan-enforcer, mark it accordingly. Accuracy matters here — this is what users see when deciding to upgrade.

#### Step 2: Create `app/dashboard/billing/_components/PlanComparisonTable.tsx`

```tsx
'use client';

/**
 * PlanComparisonTable — renders the full feature matrix on the billing page.
 * Shows all plans. Highlights the user's current plan column.
 * Shows an upgrade CTA for plans above the user's current plan.
 */

interface PlanComparisonTableProps {
  currentPlan: 'trial' | 'starter' | 'growth' | 'agency';
}

const PLAN_ORDER = ['trial', 'starter', 'growth', 'agency'] as const;
const PLAN_LABELS: Record<string, string> = {
  trial:   'The Audit',
  starter: 'Starter',
  growth:  'AI Shield',
  agency:  'Brand Fortress',
};
const PLAN_PRICES: Record<string, string> = {
  trial:   'Free',
  starter: '$29/mo',
  growth:  '$59/mo',
  agency:  'Custom',
};

export function PlanComparisonTable({ currentPlan }: PlanComparisonTableProps) {
  const categories = [...new Set(PLAN_FEATURE_MATRIX.map((f) => f.category))];

  return (
    <div className="mt-8 overflow-x-auto rounded-lg border border-border" data-testid="plan-comparison-table">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-48">
              Feature
            </th>
            {PLAN_ORDER.map((plan) => (
              <th
                key={plan}
                className={cn(
                  'px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider',
                  plan === currentPlan
                    ? 'bg-primary/5 text-primary'
                    : 'text-muted-foreground'
                )}
                data-testid={`plan-column-${plan}`}
              >
                <div>{PLAN_LABELS[plan]}</div>
                <div className="text-[10px] font-normal normal-case tracking-normal mt-0.5">
                  {PLAN_PRICES[plan]}
                </div>
                {plan === currentPlan && (
                  <div className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                    Your Plan
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <Fragment key={category}>
              {/* Category header row */}
              <tr className="border-b border-border bg-muted/30">
                <td colSpan={5} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {category}
                </td>
              </tr>
              {/* Feature rows in this category */}
              {PLAN_FEATURE_MATRIX.filter((f) => f.category === category).map((feature) => (
                <tr key={feature.label} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 text-foreground">{feature.label}</td>
                  {PLAN_ORDER.map((plan) => {
                    const value = feature[plan];
                    return (
                      <td
                        key={plan}
                        className={cn(
                          'px-4 py-2.5 text-center',
                          plan === currentPlan ? 'bg-primary/5' : ''
                        )}
                      >
                        {value === true  && <Check className="mx-auto h-4 w-4 text-emerald-500" aria-label="Included" />}
                        {value === false && <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" aria-label="Not included" />}
                        {typeof value === 'string' && (
                          <span className="text-xs font-medium text-foreground">{value}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Import `Check`, `Minus` from `'lucide-react'`. Import `Fragment` from `'react'`. Import `cn` from `'@/lib/utils'` (or wherever the project's `cn` utility lives).

#### Step 3: Wire into `app/dashboard/billing/page.tsx`

After the existing plan cards / pricing section, add:

```tsx
<section className="mt-12">
  <h2 className="text-lg font-semibold text-foreground">Compare Plans</h2>
  <p className="mt-1 text-sm text-muted-foreground">
    See exactly what's included at each tier.
  </p>
  <PlanComparisonTable currentPlan={currentPlan} />
</section>
```

Pass `currentPlan` from the server component (already fetched from the org record).

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/sample-data-mode.test.ts`

**Validates sample data logic — pure function tests.**

```
describe('isSampleMode()')
  1.  returns false when realityScore is not null (real data exists)
  2.  returns false when realityScore is 0 (0 is a valid real score, not null)
  3.  returns true when realityScore is null and org is 1 day old
  4.  returns true when realityScore is null and org is 13 days old
  5.  returns false when realityScore is null but org is 15 days old (past 14-day window)
  6.  returns false when realityScore is null but orgCreatedAt is null
  7.  returns false when realityScore is null but orgCreatedAt is invalid ISO string

describe('SAMPLE_SCORES shape')
  8.  SAMPLE_SCORES.realityScore is a number between 0 and 100
  9.  SAMPLE_SOV_TREND is an array with at least 4 entries
  10. SAMPLE_SOV_TREND entries have 'week' (string) and 'sov_percent' (number) fields
  11. SAMPLE_HALLUCINATIONS_BY_MODEL has entries for at least 3 models
  12. SAMPLE_OPEN_ALERTS is a non-empty array

describe('getNextSundayLabel()')
  13. returns a non-empty string
  14. returns a date in the future (not today or in the past)
  15. the returned date falls on a Sunday
```

**Total Vitest tests: 15**

### Test File 2: `src/__tests__/unit/info-tooltip.test.tsx`

**Validates InfoTooltip component behavior.**

```
describe('InfoTooltip')
  1.  renders a button with aria-label="More information" by default
  2.  accepts a custom label prop and applies it to aria-label
  3.  popover content is not visible on initial render
  4.  popover content becomes visible after clicking the trigger button
  5.  popover content is hidden again after pressing Escape
  6.  data-testid="info-tooltip-trigger" is on the button
  7.  data-testid="info-tooltip-content" is on the popover content when open

describe('TOOLTIP_CONTENT')
  8.  every key in TOOLTIP_CONTENT has a non-empty 'what' property
  9.  every key in TOOLTIP_CONTENT has a non-empty 'action' property
  10. realityScore entry mentions 'Reality Score'
  11. openAlerts entry mentions 'hallucination'
```

**Total Vitest tests: 11**

### Test File 3: `src/__tests__/unit/plan-feature-matrix.test.ts`

**Validates the feature matrix data integrity.**

```
describe('PLAN_FEATURE_MATRIX')
  1.  has at least 15 feature rows
  2.  every row has a non-empty 'label'
  3.  every row has a valid 'category' value
  4.  every row has 'trial', 'starter', 'growth', 'agency' keys
  5.  agency plan has at least as many features as growth plan (agency is never a downgrade)
  6.  growth plan has at least as many features as starter plan
  7.  starter plan has at least as many features as trial plan
  8.  no feature label appears more than once (no duplicates)
  9.  webhook alerts feature is agency-only (trial=false, starter=false, growth=false, agency=true)
  10. multiple locations feature is agency-only

describe('PlanComparisonTable')
  11. renders the current plan column with "Your Plan" badge
  12. renders Check icon for included features
  13. renders Minus icon for excluded features
  14. renders string values (e.g., "5/mo") for partial features
  15. all plan columns are present (trial, starter, growth, agency)
```

**Total Vitest tests: 15**

### Test File 4: `src/__tests__/unit/settings-expansion.test.ts`

**Validates new settings fields.**

```
describe('AI Model toggles')
  1.  renders a toggle for each of the 4 AI models
  2.  each toggle has data-testid="model-toggle-{model.id}"
  3.  toggling a model calls the save action with updated model list
  4.  disabling the last model is prevented (at least 1 model must remain)

describe('Score drop threshold')
  5.  renders a select with options: Disabled, 5, 10, 15, 20
  6.  default selected value is 10 (from org default)
  7.  changing the select calls the save action with the new threshold

describe('Webhook URL (agency plan)')
  8.  webhook URL input is visible to agency plan users
  9.  webhook URL input is NOT rendered for non-agency plan users
  10. UpgradePlanPrompt is shown to non-agency users in the Webhooks section

describe('Restart Tour button')
  11. Restart Tour button is visible in the Account section
  12. clicking Restart Tour removes localStorage key 'lv_tour_completed'
  13. clicking Restart Tour triggers a page reload

describe('isSampleMode in dashboard context')
  14. SampleDataBadge renders with data-testid="sample-data-badge"
  15. SampleModeBanner renders with data-testid="sample-mode-banner"
  16. clicking dismiss button hides the banner and writes to sessionStorage
  17. SampleModeBanner does NOT render when isSample is false
```

**Total Vitest tests: 17**

### E2E Test File: `src/__tests__/e2e/sprint-b-smoke.spec.ts`

```
describe('Sprint B — E2E Smoke Tests')

  Sample Data Mode:
  1.  new user dashboard (realityScore=null, org<14 days): sample-mode-banner is visible
  2.  new user dashboard: at least 4 sample-data-badge elements are visible on the page
  3.  new user dashboard: clicking dismiss on the banner hides it
  4.  existing user dashboard (realityScore > 0): sample-mode-banner is NOT present
  5.  existing user dashboard: no sample-data-badge elements are visible

  InfoTooltip:
  6.  clicking the ? button on the Reality Score MetricCard opens a tooltip popover
  7.  the popover content contains the text "Reality Score"
  8.  pressing Escape closes the tooltip popover
  9.  the ? button on the SOVTrendChart opens a tooltip with "Share of Voice" content

  Settings:
  10. the AI Monitoring section is visible on the Settings page
  11. model-toggle-openai toggle is checked by default
  12. unchecking a model toggle and saving shows a success toast
  13. the Restart Tour button is visible on the Settings page
  14. the score-drop-threshold select is visible with options

  Billing:
  15. plan-comparison-table is visible on the billing page
  16. the user's current plan column has the "Your Plan" badge
  17. agency-only features show a Minus icon in the starter plan column
```

**Total Playwright tests: 17**

**Critical Playwright rules:**
- For sample data mode tests, mock the dashboard API/Supabase calls to return `realityScore: null` and a new `created_at` timestamp — never rely on real DB state for this test
- Use `page.route()` to intercept Supabase requests
- Use `data-testid` attributes for all assertions (no class-name selectors)
- For the "existing user" tests, mock `realityScore: 72` and `created_at` 30 days ago
- Use existing Playwright auth helpers for logged-in tests

**Run commands:**

```bash
npx vitest run src/__tests__/unit/sample-data-mode.test.ts      # 15 tests
npx vitest run src/__tests__/unit/info-tooltip.test.tsx         # 11 tests
npx vitest run src/__tests__/unit/plan-feature-matrix.test.ts   # 15 tests
npx vitest run src/__tests__/unit/settings-expansion.test.ts    # 17 tests
npx vitest run                                                   # All unit tests — no regressions
npx playwright test src/__tests__/e2e/sprint-b-smoke.spec.ts    # 17 e2e tests
npx tsc --noEmit                                                 # 0 new type errors
```

---

## 📂 Files to Create / Modify

| # | File | Action | Component |
|---|------|--------|-----------|
| 1 | `lib/sample-data/sample-dashboard-data.ts` | **CREATE** | C4 — Sample data constants |
| 2 | `lib/sample-data/use-sample-mode.ts` | **CREATE** | C4 — `isSampleMode()` pure function |
| 3 | `components/ui/SampleDataBadge.tsx` | **CREATE** | C4 — Card overlay badge |
| 4 | `components/ui/SampleModeBanner.tsx` | **CREATE** | C4 — Dashboard banner |
| 5 | `app/dashboard/page.tsx` | **MODIFY** | C4 — Sample data integration; remove empty state |
| 6 | `components/ui/InfoTooltip.tsx` | **CREATE** | H1 — Shared tooltip component |
| 7 | `lib/tooltip-content.tsx` | **CREATE** | H1 — All tooltip copy in one place |
| 8 | `app/dashboard/_components/MetricCard.tsx` | **MODIFY** | H1 — `tooltip` prop + InfoTooltip |
| 9 | `app/dashboard/_components/RealityScoreCard.tsx` | **MODIFY** | H1 — InfoTooltip in header |
| 10 | `app/dashboard/_components/AIHealthScoreCard.tsx` | **MODIFY** | H1 — InfoTooltip on overall + 4 component bars |
| 11 | `app/dashboard/_components/SOVTrendChart.tsx` | **MODIFY** | H1 — InfoTooltip in header |
| 12 | `app/dashboard/_components/HallucinationsByModel.tsx` | **MODIFY** | H1 — InfoTooltip in header |
| 13 | `app/dashboard/settings/_components/SettingsForm.tsx` | **MODIFY** | H2 — AI models, score threshold, webhook, restart tour |
| 14 | `app/dashboard/settings/page.tsx` | **MODIFY** | H2 — Pass plan/model data to SettingsForm |
| 15 | `supabase/migrations/[timestamp]_orgs_settings_expansion.sql` | **CREATE** | H2 — New org columns |
| 16 | `supabase/prod_schema.sql` | **MODIFY** | H2 — Add new columns to orgs table |
| 17 | `lib/supabase/database.types.ts` | **MODIFY** | H2 — New orgs columns in types |
| 18 | `lib/plan-feature-matrix.ts` | **CREATE** | M3 — Feature matrix data |
| 19 | `app/dashboard/billing/_components/PlanComparisonTable.tsx` | **CREATE** | M3 — Comparison table component |
| 20 | `app/dashboard/billing/page.tsx` | **MODIFY** | M3 — Add comparison table below pricing |
| 21 | `components/ui/UpgradePlanPrompt.tsx` | **CREATE** | H2 — Reusable upgrade prompt (if not exists) |
| 22 | `src/__tests__/unit/sample-data-mode.test.ts` | **CREATE** | Tests (15) |
| 23 | `src/__tests__/unit/info-tooltip.test.tsx` | **CREATE** | Tests (11) |
| 24 | `src/__tests__/unit/plan-feature-matrix.test.ts` | **CREATE** | Tests (15) |
| 25 | `src/__tests__/unit/settings-expansion.test.ts` | **CREATE** | Tests (17) |
| 26 | `src/__tests__/e2e/sprint-b-smoke.spec.ts` | **CREATE** | E2E tests (17) |

---

## 🧠 Edge Cases to Handle

1. **`realityScore === 0` is NOT sample mode.** A score of 0 is a valid real scan result (terrible score, but real). Only `realityScore === null` triggers sample mode. The `isSampleMode()` function must use strict null check.

2. **Sample data shape drift:** If the real dashboard fetch shape changes in a future sprint, `SAMPLE_SCORES` and related constants will become stale. Document this risk in a JSDoc comment on each constant: `@see app/dashboard/page.tsx — keep in sync with the dashboard fetch shape`. The TypeScript compiler will catch most mismatches if types are correctly applied.

3. **First scan completes mid-session:** If a user is viewing the sample data dashboard and the real scan completes (e.g., a Sunday cron runs while they're logged in), the `isSampleMode()` check won't re-evaluate unless the page is refreshed. This is acceptable — the banner says "check back Monday." Do not implement real-time sample mode exit. A full page refresh will show real data.

4. **InfoTooltip inside a `<Link>` (MetricCard):** The `<Link>` wraps the entire MetricCard from Sprint A. The `?` button inside the Link must call `e.stopPropagation()` on click to prevent navigating to the detail page when the user clicks the tooltip trigger. Add `onClick={(e) => e.stopPropagation()}` to the InfoTooltip button.

5. **InfoTooltip on mobile / touch devices:** The popover must open on click (touch tap) as well as hover. If using a Radix Tooltip (hover-only), wrap it in an additional Popover for touch support, or use a Popover exclusively. A Popover (click-triggered) is simpler and works on all devices — prefer it.

6. **Keyboard accessibility for InfoTooltip:** The trigger button must be reachable by Tab. Pressing Enter or Space must open the popover. Pressing Escape must close it. These behaviors come built-in with Radix Popover — do not implement custom keyboard handlers.

7. **AI model toggle: minimum 1 model required.** A user cannot uncheck all 4 AI models — at least 1 must remain checked. Add client-side validation: if the user tries to uncheck the last active model, show a toast `"At least one AI model must be monitored."` and revert the toggle.

8. **Webhook URL validation:** Before saving, validate that the webhook URL is a valid HTTPS URL. Do not accept HTTP (insecure), `localhost`, or non-URL strings. Use `new URL(webhookUrl)` in a try/catch and check `url.protocol === 'https:'`. Show an inline validation error if invalid.

9. **Plan feature matrix accuracy:** The matrix is a static snapshot. If `plan-enforcer.ts` is updated in a future sprint (new features added, gate changed), this matrix must also be updated. Add a comment at the top of `lib/plan-feature-matrix.ts`: `// Last verified against plan-enforcer.ts: Sprint B (2026-[DATE])`.

10. **`PlanComparisonTable` on small screens:** The table has 5 columns and can overflow on mobile. The wrapping `div` has `overflow-x-auto` for horizontal scroll. Verify on a 375px viewport. Do not collapse to a different layout — horizontal scroll is sufficient for this use case.

11. **Settings save race condition:** If a user rapidly toggles multiple AI models, each toggle may fire a save. Debounce the save action by 500ms, or batch the toggles with a "Save" button. Read the existing settings save pattern first — match whatever debounce/batch approach already exists.

12. **`SampleModeBanner` and `sessionStorage` during SSR:** `sessionStorage` is not available during server-side rendering. The `dismissed` state initialization uses `typeof window !== 'undefined'` guard — this is correct. Do not access `sessionStorage` outside of this guard.

---

## 🚫 What NOT to Do

1. **DO NOT show sample data to users with real scan data.** `isSampleMode()` must return `false` immediately when `realityScore !== null`. Never substitute sample data for real data.
2. **DO NOT hard-code the "14-day window" in multiple places.** Define it as a constant `const SAMPLE_MODE_WINDOW_DAYS = 14` in `use-sample-mode.ts` and reference it in tests.
3. **DO NOT install new npm packages for InfoTooltip** without first checking `package.json` and `components/ui/`. If `@radix-ui/react-popover` is already in the project, use it. Only install a new package if nothing usable exists.
4. **DO NOT put tooltip content inline in component files.** All tooltip copy lives in `lib/tooltip-content.tsx`. Import from there.
5. **DO NOT change `lib/plan-enforcer.ts`** — only read it. The plan enforcer is the source of truth for gating logic. `lib/plan-feature-matrix.ts` is a read-only derived presentation artifact.
6. **DO NOT add the `PlanComparisonTable` inside the existing plan pricing cards** — place it below them as a separate section. The pricing cards are for purchase decisions; the table is reference material.
7. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).
8. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12) — use literal class strings everywhere.
9. **DO NOT modify `middleware.ts`** (AI_RULES §6).
10. **DO NOT store webhook URLs unencrypted if the project has a column encryption pattern** — check `MEMORY.md` and `AI_RULES.md` for any encryption conventions before adding `webhook_url text` to the schema.
11. **DO NOT make sample data obviously fake with placeholder names** like "Restaurant XYZ" or "Sample Business." The golden tenant data (Charcoal N Chill) is the benchmark — keep data realistic and restaurant-appropriate.
12. **DO NOT add the `SampleDataBadge` to cards that always have real data** (e.g., the notification count, a static plan chip). Only add it to cards that receive substituted data from `SAMPLE_*` constants.

---

## ✅ Definition of Done (AI_RULES §13.5)

**Sample Data Mode:**
- [ ] `lib/sample-data/sample-dashboard-data.ts` created — all shapes verified against real dashboard fetch types
- [ ] `lib/sample-data/use-sample-mode.ts` created with `isSampleMode()` — 14-day window, strict null check
- [ ] `components/ui/SampleDataBadge.tsx` created with `data-testid="sample-data-badge"`
- [ ] `components/ui/SampleModeBanner.tsx` created with dismiss + sessionStorage + `data-testid="sample-mode-banner"`
- [ ] `app/dashboard/page.tsx` — empty state text (lines 152–165) removed; sample data substitution active; all 6+ cards wrapped with `relative` + conditional `<SampleDataBadge />`
- [ ] Verified: existing users (realityScore > 0) see zero sample data badges and no banner
- [ ] Verified: new users (realityScore = null, org < 14 days) see banner + badges on all relevant cards

**InfoTooltip System:**
- [ ] `components/ui/InfoTooltip.tsx` created — opens on click, closes on Escape, keyboard accessible
- [ ] `lib/tooltip-content.tsx` created — all 11 tooltip entries populated with accurate content
- [ ] `InfoTooltip` wired into all 10 priority cards (4 MetricCards + RealityScore + AIHealth overall + 2 AIHealth bars + SOV + Hallucinations)
- [ ] `e.stopPropagation()` on InfoTooltip trigger inside MetricCard Link wrapper (Sprint A)
- [ ] All tooltip triggers have `data-testid="info-tooltip-trigger"`
- [ ] All tooltip content panels have `data-testid="info-tooltip-content"`

**Settings Expansion:**
- [ ] Migration `[timestamp]_orgs_settings_expansion.sql` created — `monitored_ai_models`, `score_drop_threshold`, `webhook_url`
- [ ] `prod_schema.sql` and `database.types.ts` updated
- [ ] AI Monitoring section with 4 model toggles, each with `data-testid="model-toggle-{id}"`
- [ ] Min-1-model validation: last active model cannot be unchecked
- [ ] Score drop threshold select — options 0/5/10/15/20, default 10
- [ ] Webhook URL input — agency plan only; non-agency sees `UpgradePlanPrompt`
- [ ] Webhook URL validates HTTPS before save
- [ ] Restart Tour button clears `lv_tour_completed` from localStorage and reloads
- [ ] Save pattern matches existing settings save pattern exactly

**Plan Feature Comparison:**
- [ ] `lib/plan-feature-matrix.ts` created — all rows verified against `plan-enforcer.ts`
- [ ] `app/dashboard/billing/_components/PlanComparisonTable.tsx` created with correct icons and "Your Plan" badge
- [ ] Table added to `billing/page.tsx` below existing pricing cards
- [ ] `data-testid="plan-comparison-table"` on table wrapper
- [ ] Table is horizontally scrollable on mobile viewports

**Tests:**
- [ ] `npx vitest run src/__tests__/unit/sample-data-mode.test.ts` — **15 tests passing**
- [ ] `npx vitest run src/__tests__/unit/info-tooltip.test.tsx` — **11 tests passing**
- [ ] `npx vitest run src/__tests__/unit/plan-feature-matrix.test.ts` — **15 tests passing**
- [ ] `npx vitest run src/__tests__/unit/settings-expansion.test.ts` — **17 tests passing**
- [ ] `npx vitest run` — ALL existing tests passing, zero regressions
- [ ] `npx playwright test src/__tests__/e2e/sprint-b-smoke.spec.ts` — **17 tests passing**
- [ ] `npx tsc --noEmit` — 0 new type errors

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## [DATE] — Sprint B: First Impressions — Sample Data Mode, Tooltips, Settings & Plan Comparison (Completed)

**Goal:** Four medium-effort fixes targeting the highest-churn moments in the customer journey. New users see a populated dashboard instead of a blank one. Metrics are self-explanatory. Settings surface what users need. Billing shows what upgrades unlock.

**Scope:**
- `lib/sample-data/sample-dashboard-data.ts` — **NEW.** Realistic sample data for all 6+ dashboard cards. Modeled on Charcoal N Chill data shape.
- `lib/sample-data/use-sample-mode.ts` — **NEW.** `isSampleMode()` — returns true when realityScore is null and org is <14 days old.
- `components/ui/SampleDataBadge.tsx` — **NEW.** "◈ Sample Data" pill badge for card overlays.
- `components/ui/SampleModeBanner.tsx` — **NEW.** Dismissible top-of-dashboard banner explaining sample mode. Uses sessionStorage for dismiss state.
- `app/dashboard/page.tsx` — **MODIFIED.** Removed empty state text (was: "Your first scan runs Sunday…"). Sample data substitution active for 6+ cards. SampleModeBanner added. `isSampleMode()` called server-side.
- `components/ui/InfoTooltip.tsx` — **NEW.** ? icon with Radix Popover. Opens on click/hover, closes on Escape. Keyboard accessible.
- `lib/tooltip-content.tsx` — **NEW.** Single source of truth for all 11 metric tooltip copy entries.
- MetricCard, RealityScoreCard, AIHealthScoreCard, SOVTrendChart, HallucinationsByModel — **MODIFIED.** InfoTooltip wired into each. e.stopPropagation() on trigger inside Sprint A Link wrapper.
- `app/dashboard/settings/_components/SettingsForm.tsx` — **MODIFIED.** AI Monitoring section (4 model toggles), Score Drop Threshold select, Webhook URL input (agency only), Restart Tour button.
- `app/dashboard/settings/page.tsx` — **MODIFIED.** Passes plan + monitored models + score threshold + webhook URL to SettingsForm.
- `supabase/migrations/[timestamp]_orgs_settings_expansion.sql` — **NEW.** Adds monitored_ai_models, score_drop_threshold, webhook_url to orgs.
- `prod_schema.sql`, `database.types.ts` — **MODIFIED.** New orgs columns added.
- `lib/plan-feature-matrix.ts` — **NEW.** [N]-row feature matrix verified against plan-enforcer.ts.
- `app/dashboard/billing/_components/PlanComparisonTable.tsx` — **NEW.** Full comparison table. Highlights current plan column.
- `app/dashboard/billing/page.tsx` — **MODIFIED.** PlanComparisonTable added below pricing section.
- `components/ui/UpgradePlanPrompt.tsx` — **[NEW/already existed].** Reusable upgrade prompt for plan-gated settings.

**Tests added:**
- `src/__tests__/unit/sample-data-mode.test.ts` — N Vitest tests
- `src/__tests__/unit/info-tooltip.test.tsx` — N Vitest tests
- `src/__tests__/unit/plan-feature-matrix.test.ts` — N Vitest tests
- `src/__tests__/unit/settings-expansion.test.ts` — N Vitest tests
- `src/__tests__/e2e/sprint-b-smoke.spec.ts` — N Playwright tests

**Total tests added: [N] Vitest + [N] Playwright**

**Before/After:**
- Before: new users saw blank dashboard for up to 6 days. After: populated dashboard with SAMPLE DATA badges + dismissible banner.
- Before: "Reality Score: 62" with no explanation. After: ? icon opens a popover with what/how/action for every metric.
- Before: Settings had 5 sections, missing 8+ controls. After: AI model tracking, score threshold, webhook URL, restart tour all surfaced.
- Before: billing page showed prices only. After: full feature comparison table with checkmarks and "Your Plan" badge.
```

---

## 🔮 AI_RULES Update (Add to `AI_RULES.md`)

```markdown
## 44. 📊 Plan Feature Matrix — Keep In Sync With plan-enforcer.ts (Sprint B)

`lib/plan-feature-matrix.ts` is the presentation layer for plan features. It must stay in sync with `lib/plan-enforcer.ts`.

* **Rule:** When adding or changing a plan gate in `plan-enforcer.ts`, update `PLAN_FEATURE_MATRIX` in `lib/plan-feature-matrix.ts` in the same PR.
* **Verification comment:** Update the `// Last verified: [date]` comment at the top of `plan-feature-matrix.ts` with each sync.
* **Never call plan-enforcer functions at runtime for display purposes** — the matrix is a static snapshot for the UI only.

## 45. 🎭 Sample Data Mode — Shape Integrity (Sprint B)

All constants in `lib/sample-data/sample-dashboard-data.ts` must match the actual dashboard fetch shapes.

* **Rule:** When dashboard fetch shapes change, update `sample-dashboard-data.ts` in the same PR.
* **Verification:** TypeScript strict mode catches most mismatches — fix all type errors before merging.
* **Trigger condition:** `isSampleMode()` returns true ONLY when `realityScore === null` AND org is less than 14 days old. Never substitute sample data for real data.

## 46. 💬 Tooltip Copy — Single Source of Truth (Sprint B)

All user-facing metric explanations live in `lib/tooltip-content.tsx`.

* **Rule:** Never inline tooltip copy in component files. Always import from `lib/tooltip-content.tsx`.
* **Adding new metrics:** Add a new entry to `TOOLTIP_CONTENT` with `title`, `what`, `how`, and `action` fields.
```

---

## 📚 Document Sync + Git Commit (Run After All Tests Pass)

### Step 1: Update `CLAUDE.md`

```markdown
### Sprint B — First Impressions (2026-[DATE])
- `lib/sample-data/` — sample-dashboard-data.ts + use-sample-mode.ts (isSampleMode, 14-day window)
- `components/ui/SampleDataBadge.tsx` + `SampleModeBanner.tsx` — sample mode UI layer
- `components/ui/InfoTooltip.tsx` — ? icon + Radix Popover; wired into 10 dashboard cards
- `lib/tooltip-content.tsx` — single source of truth for all metric tooltip copy
- `lib/plan-feature-matrix.ts` — [N]-row feature matrix verified against plan-enforcer.ts
- `app/dashboard/billing/_components/PlanComparisonTable.tsx` — plan comparison table
- Settings: AI model toggles, score threshold, webhook URL (agency), restart tour button
- Migration: adds monitored_ai_models, score_drop_threshold, webhook_url to orgs
- Tests: [N] Vitest + [N] Playwright
```

### Step 2: Update `MEMORY.md`

```markdown
## Decision: Sample Data Mode Architecture (Sprint B — 2026-[DATE])
- isSampleMode() is a pure function: realityScore===null AND org<14 days old
- Sample data lives in lib/sample-data/sample-dashboard-data.ts — shape must match real fetch types
- Badges use absolute positioning inside relative wrappers — not a full-page overlay
- Banner uses sessionStorage (not localStorage) — reappears on next login session
- No real-time exit from sample mode — requires page refresh after real scan completes

## Decision: InfoTooltip Implementation (Sprint B — 2026-[DATE])
- Uses Radix Popover (click-triggered) for cross-device compatibility (hover + touch)
- All tooltip copy centralized in lib/tooltip-content.tsx
- InfoTooltip trigger uses e.stopPropagation() inside MetricCard Link wrapper (Sprint A)
- 10 cards wired: 4 MetricCards + RealityScore + AIHealth (overall + 2 bars) + SOV + Hallucinations
```

### Step 3: Update `AI_RULES.md`

Append Rules 44, 45, and 46 from the **🔮 AI_RULES Update** section above.

### Step 4: Git Commit

```bash
git add -A
git status

git commit -m "Sprint B: First Impressions — Sample Data Mode, Tooltips, Settings & Plan Comparison

- lib/sample-data/: isSampleMode() + SAMPLE_* constants for 6+ dashboard cards
- SampleDataBadge + SampleModeBanner: new users see a populated dashboard, not a blank one
- dashboard/page.tsx: empty state removed; sample data substitution active
- components/ui/InfoTooltip.tsx: ? icon + Radix Popover on all 10 priority cards
- lib/tooltip-content.tsx: what/how/action copy for all metric tooltips
- settings: AI model toggles (4 models), score threshold, webhook URL, restart tour
- migration: monitored_ai_models + score_drop_threshold + webhook_url on orgs
- lib/plan-feature-matrix.ts: [N]-row matrix verified against plan-enforcer.ts
- PlanComparisonTable: full feature comparison on billing page with 'Your Plan' highlight
- tests: [N] Vitest + [N] Playwright passing, 0 regressions

Fixes: C4 (blank dashboard), H1 (tooltip system), H2 (settings), M3 (plan comparison)
Unblocks: Sprint C (listings wiring + test hardening)"

git push origin main
```

---

## 🏁 Sprint Outcome

After Sprint B completes:
- **Trial-to-paid conversion risk eliminated:** New users see a real-looking, populated dashboard from minute one — not a 6-day wait with a blank screen and a promise.
- **Dashboard is self-explanatory:** Any restaurant owner can hover on any metric and understand what it means, how it's calculated, and what action to take. The product no longer requires a sales call to explain.
- **Settings are complete for core workflows:** Users can configure which AI models to track, set alert thresholds, wire a webhook, and restart the tour without hunting through other pages.
- **Billing drives upgrades:** Users can see exactly what they're missing on their current plan. "Webhook alerts," "multiple locations," and "unlimited competitors" all have checkmarks on Agency — the upgrade decision is self-serve.
- **Foundation for Sprint C:** With Sentry live (Sprint A) and the sample data layer in place (Sprint B), Sprint C's riskier work (real API wiring, test coverage expansion) has a stable observability and UX foundation to build on.
