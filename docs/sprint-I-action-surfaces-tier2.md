# Sprint I — Action Surfaces Tier 2: Revenue Impact, AI Sentiment, Source Intelligence & Bot Activity

> **Claude Code Prompt — Bulletproof Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`
> **Prerequisites:** Sprints A–H must be fully merged and all tests passing. Sprint I is front-end only — no new DB tables, no new crons, no new API routes. All data exists.

---

## 🎯 Objective

Sprint I completes the action-surface transformation of the four Tier 2 detail pages. These pages have a different character than the Tier 1 pages in Sprint H: three of them (Revenue Impact, AI Sentiment, Source Intelligence) are primarily about interpretation — they have the data but don't tell users what it means. The fourth (Bot Activity) has the data and explains the problem but stops short of telling users what to do about it.

**The four pages and the specific gap each one has:**

1. **Revenue Impact → Show the Number First** — Currently: a configuration form sits blank. Users open the page, see empty input fields, and must fill them in before seeing any output. This reverses the correct UX order — the user should see a compelling number first, then refine it. After Sprint I: industry-smart defaults pre-fill the form so a revenue estimate appears the moment the page loads. The form becomes a refinement tool, not a prerequisite.

2. **AI Sentiment → Model-by-Model Interpretation** — Currently: bar or pie charts showing positive/negative/neutral percentages with no explanation of what they mean. Users see "Perplexity: 38% positive" and don't know if that's good, bad, or what to do about it. After Sprint I: a plain-English interpretation panel leads the page — "Gemini describes you well. Perplexity is a problem — it's negative about you 62% of the time, mostly about your hours and location." Each model gets a one-sentence verdict, and the chart becomes supporting evidence.

3. **Source Intelligence → Source Health Signals** — Currently: a ranked list of domains (e.g., "yelp.com — Score: 82") with no indication of whether each source is teaching AI models correct or incorrect information about the business. After Sprint I: each source has a health signal (teaching correct info / teaching wrong info / low authority / high authority), and the page leads with a summary of the overall source quality landscape.

4. **Bot Activity → Actionable Fix Instructions** — Currently: a crawl log showing which bots visited, how many times, and whether they were blocked — but no instructions for what to do about a blocked bot. After Sprint I: every blocked bot row has an expandable "How to fix" section showing the exact `robots.txt` edit needed to unblock it, plus a plain-English explanation of what that bot is and why unblocking it matters.

**Why these four now:** These are the pages users land on when they're trying to understand *why* their score is what it is. Revenue Impact explains the business case for caring. AI Sentiment explains which models are the problem. Source Intelligence explains which data sources are feeding AI the wrong information. Bot Activity explains why AI models might be flying blind about the business. Getting these pages right closes the "I understand my situation and know what to do" gap that drives month-2 churn.

**Estimated total implementation time:** 18–24 hours. Revenue Impact is the most nuanced (6–8 hours) because the smart defaults require understanding the industry config from Sprint E. AI Sentiment and Source Intelligence are 4–5 hours each (verdict panel + existing chart/list). Bot Activity is 4–5 hours (expandable fix instructions + copy for each major bot).

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                              — Rules 42–61 from Sprints A–H now in effect
Read CLAUDE.md                                     — Full Sprint A–H implementation inventory
Read MEMORY.md                                     — All architecture decisions through Sprint H

--- Sprint G+H artifacts to REUSE ---
Read lib/issue-descriptions.ts                     — describeAlert(), getModelName() — do NOT reduplicate
Read components/ui/InfoTooltip.tsx                 — Sprint B: reuse on all four pages
Read lib/industries/industry-config.ts             — Sprint E: INDUSTRY_CONFIG, getIndustryConfig()
                                                     Revenue defaults are keyed per industry

--- Revenue Impact page ---
Read app/dashboard/revenue-impact/page.tsx         — COMPLETE FILE. Current layout, current fetches
Read app/dashboard/revenue-impact/                 — ls; read every component and action file
Read app/dashboard/revenue-impact/_components/RevenueConfigForm.tsx
                                                   — COMPLETE FILE. Current DEFAULT_CONFIG, input fields,
                                                     form submission pattern, how results are computed
Read lib/services/revenue-leak.service.ts          — COMPLETE FILE. computeRevenueLeak(),
                                                     how estimate is derived from config values
Read src/__fixtures__/golden-tenant.ts             — Golden tenant industry type, check size range,
                                                     covers/tables, weekend multiplier data
Read supabase/prod_schema.sql                      — orgs table: industry, city, avg_check_size,
                                                     covers_per_night (or equivalent) — columns that
                                                     can pre-populate the form

--- AI Sentiment page ---
Read app/dashboard/sentiment/page.tsx              — COMPLETE FILE. Current fetches, current layout
Read app/dashboard/sentiment/                      — ls; read every component (chart components, etc.)
Read supabase/prod_schema.sql                      — sentiment_results or ai_sentiment table:
                                                     model column, positive/negative/neutral counts or
                                                     percentages, period/week column
Read src/__fixtures__/golden-tenant.ts             — Sentiment sample data shapes

--- Source Intelligence page ---
Read app/dashboard/source-intelligence/page.tsx    — COMPLETE FILE. Current fetches, current layout
Read app/dashboard/source-intelligence/            — ls; read every component
Read supabase/prod_schema.sql                      — ai_sources or source_intelligence table:
                                                     domain, authority_score, accuracy_flag,
                                                     mention_count, has_wrong_info columns

--- Bot Activity page ---
Read app/dashboard/bot-activity/page.tsx           — COMPLETE FILE. Current fetches, current layout
Read app/dashboard/bot-activity/                   — ls; read every component
Read supabase/prod_schema.sql                      — bot_activity or crawler_logs table:
                                                     bot_name, status (allowed/blocked), visit_count,
                                                     last_seen columns
```

**Specifically understand before writing any code:**

- **`RevenueConfigForm` DEFAULT_CONFIG:** Read the actual field names, types, and current default values in `RevenueConfigForm.tsx` before building smart defaults. The smart defaults must use the same field names — you're pre-populating the existing form, not replacing it.

- **`revenue-leak.service.ts` computation:** Understand exactly how monthly revenue loss is estimated from the config values before adding an interpretation panel. The panel must describe the computation honestly, not invent a formula.

- **`industry-config.ts` from Sprint E:** This file contains per-industry configuration including schema types, display names, and potentially revenue-relevant data. Read it to determine if it already has check size or covers-per-night data you can pull into the smart defaults.

- **Sentiment data shape:** Before writing the interpretation panel, run:
  ```bash
  grep -A 20 "CREATE TABLE.*sentiment\|sentiment_results\|ai_sentiment" supabase/prod_schema.sql
  ```
  The interpretation depends on whether you have: (a) per-model positive/negative/neutral counts, (b) a composite sentiment score, or (c) tagged text records. The panel adapts to the actual shape.

- **Source Intelligence data shape:** Run:
  ```bash
  grep -A 20 "CREATE TABLE.*source\|ai_source\|source_intelligence" supabase/prod_schema.sql
  ```
  Determine whether each source record has: accuracy data (cross-referenced with hallucination_alerts), authority score, or just a URL and mention count. The health signal derivation depends on this.

- **Bot names in the crawl log:** Run:
  ```bash
  grep -A 20 "CREATE TABLE.*bot_activity\|crawler_logs" supabase/prod_schema.sql
  ```
  Then check what actual bot names appear in seed.sql. The "How to fix" copy is bot-specific — GPTBot, ClaudeBot, PerplexityBot, Googlebot, Bingbot each have different user agent strings and different business cases for unblocking them.

---

## 🏗️ Architecture — What to Build

---

### Page 1: Revenue Impact → Show the Number First

**The user's real question:** "How much money am I losing because AI models describe my business incorrectly?"

**Current experience:** A blank configuration form. Users must enter their average check size, covers per night, and weekend multiplier before they see anything. Most users don't — they close the tab.

**After Sprint I:** The page loads with industry-smart defaults already filled in. A revenue estimate is visible the instant the page opens. The form becomes a tool for refining the estimate, not a prerequisite for seeing it.

#### Step 1: `getIndustryRevenueDefaults()` — `lib/revenue-impact/industry-revenue-defaults.ts`

This function maps industry type to sensible revenue defaults. It reads from `INDUSTRY_CONFIG` (Sprint E) and supplements with revenue-specific assumptions.

```typescript
/**
 * lib/revenue-impact/industry-revenue-defaults.ts
 *
 * Industry-specific default values for the Revenue Impact configuration form.
 * These are realistic starting points — not precise figures. Users refine them.
 *
 * AI_RULES §62: Revenue defaults must be labeled as estimates in the UI.
 * Never present industry defaults as verified data for a specific business.
 */

import { getIndustryConfig } from '@/lib/industries/industry-config';

// Match the exact field names in RevenueConfigForm.tsx DEFAULT_CONFIG:
// Read that file first — adapt these keys to match.
export interface RevenueDefaults {
  avgCheckSize: number;          // Average spend per customer visit ($)
  coversPerNight: number;        // Average customers served per day
  weekendMultiplier: number;     // Weekend revenue premium (1.0 = no premium)
  operatingDaysPerMonth: number; // Days open per month
  // Add any additional fields that exist in RevenueConfigForm's DEFAULT_CONFIG
}

const INDUSTRY_DEFAULTS: Record<string, RevenueDefaults> = {
  // Restaurant / Food & Beverage
  restaurant: {
    avgCheckSize: 42,
    coversPerNight: 60,
    weekendMultiplier: 1.35,
    operatingDaysPerMonth: 26,
  },
  // Hookah Lounge / Bar / Nightlife
  hookah_lounge: {
    avgCheckSize: 55,
    coversPerNight: 45,
    weekendMultiplier: 1.5,
    operatingDaysPerMonth: 24,
  },
  bar: {
    avgCheckSize: 38,
    coversPerNight: 70,
    weekendMultiplier: 1.6,
    operatingDaysPerMonth: 26,
  },
  // Medical / Dental (Sprint E vertical)
  dental: {
    avgCheckSize: 285,
    coversPerNight: 12,        // patients per day
    weekendMultiplier: 1.0,    // no weekend premium for medical
    operatingDaysPerMonth: 20,
  },
  medical: {
    avgCheckSize: 195,
    coversPerNight: 18,
    weekendMultiplier: 1.0,
    operatingDaysPerMonth: 21,
  },
  // Retail
  retail: {
    avgCheckSize: 68,
    coversPerNight: 40,
    weekendMultiplier: 1.3,
    operatingDaysPerMonth: 27,
  },
  // Salon / Spa / Beauty
  salon: {
    avgCheckSize: 95,
    coversPerNight: 14,
    weekendMultiplier: 1.25,
    operatingDaysPerMonth: 25,
  },
  // Fitness / Gym
  fitness: {
    avgCheckSize: 35,
    coversPerNight: 55,
    weekendMultiplier: 1.1,
    operatingDaysPerMonth: 28,
  },
  // Generic fallback for unmapped industries
  default: {
    avgCheckSize: 65,
    coversPerNight: 30,
    weekendMultiplier: 1.2,
    operatingDaysPerMonth: 25,
  },
};

export function getIndustryRevenueDefaults(industryId: string | null | undefined): RevenueDefaults {
  if (!industryId) return INDUSTRY_DEFAULTS.default;

  const normalized = industryId.toLowerCase().replace(/[\s-]/g, '_');

  // Direct match
  if (INDUSTRY_DEFAULTS[normalized]) return INDUSTRY_DEFAULTS[normalized];

  // Partial match — e.g., "fine_dining_restaurant" → "restaurant"
  for (const [key, defaults] of Object.entries(INDUSTRY_DEFAULTS)) {
    if (normalized.includes(key) || key.includes(normalized)) return defaults;
  }

  return INDUSTRY_DEFAULTS.default;
}

// ── Display-friendly labels for each field ──────────────────────────────────
// Used by the "How we estimated this" tooltip and inline form labels.
export const REVENUE_FIELD_LABELS: Record<keyof RevenueDefaults, string> = {
  avgCheckSize:          'Average spend per visit ($)',
  coversPerNight:        'Customers served per day',
  weekendMultiplier:     'Weekend revenue multiplier',
  operatingDaysPerMonth: 'Operating days per month',
};

export const REVENUE_FIELD_DESCRIPTIONS: Record<keyof RevenueDefaults, string> = {
  avgCheckSize:          'Average amount each customer spends per visit, including food, drinks, and gratuity.',
  coversPerNight:        'Average number of customers or tables served on a typical day.',
  weekendMultiplier:     'Friday–Saturday revenue as a multiple of weekday revenue. 1.4 means weekends earn 40% more.',
  operatingDaysPerMonth: 'Days you are open per month. 26 = closed Mondays; 28 = open every day.',
};
```

**After reading `RevenueConfigForm.tsx`:** Align the `RevenueDefaults` interface fields with the exact field names in the existing `DEFAULT_CONFIG`. They must match — you're replacing the static defaults, not adding new fields.

#### Step 2: `RevenueEstimatePanel` — `app/dashboard/revenue-impact/_components/RevenueEstimatePanel.tsx`

The verdict panel that shows the estimate prominently, before the form.

```tsx
/**
 * RevenueEstimatePanel
 *
 * Shows the computed monthly revenue loss estimate prominently.
 * Appears above the configuration form — the number is the hook.
 * The form below lets users refine it.
 *
 * AI_RULES §62: Always label as "estimate" — never "you are losing exactly..."
 */

interface RevenueEstimatePanelProps {
  monthlyLossEstimate: number | null;   // Computed by revenue-leak.service.ts
  lossRangeMin: number | null;          // Lower bound (± 20%)
  lossRangeMax: number | null;          // Upper bound (± 20%)
  realityScore: number | null;          // Current Reality Score — drives the estimate
  usingSmartDefaults: boolean;          // True when using industry defaults, not user config
  industryName: string | null;          // For the "typical [restaurant]" label
}

export function RevenueEstimatePanel({
  monthlyLossEstimate,
  lossRangeMin,
  lossRangeMax,
  realityScore,
  usingSmartDefaults,
  industryName,
}: RevenueEstimatePanelProps) {
  if (monthlyLossEstimate === null || realityScore === null) {
    return (
      <div
        className="rounded-lg border border-border bg-card p-5"
        data-testid="revenue-no-data"
      >
        <p className="text-sm text-muted-foreground">
          Revenue impact data will appear after your first Reality Score scan.
        </p>
      </div>
    );
  }

  const formattedLoss = monthlyLossEstimate.toLocaleString('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  });
  const formattedMin = lossRangeMin?.toLocaleString('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  });
  const formattedMax = lossRangeMax?.toLocaleString('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  });

  return (
    <div
      className="rounded-lg border border-border bg-card p-5 space-y-3"
      data-testid="revenue-estimate-panel"
    >
      {/* Smart-defaults disclosure — prominent when using industry estimates */}
      {usingSmartDefaults && (
        <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2">
          <p className="text-xs text-blue-800">
            <span className="font-semibold">Estimated using typical {industryName ?? 'business'} figures.</span>
            {' '}Update the numbers below with your actual revenue data for a more accurate estimate.
          </p>
        </div>
      )}

      {/* The primary number */}
      <div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <span
            className="text-3xl font-bold tabular-nums text-red-600"
            data-testid="revenue-monthly-loss"
          >
            {formattedLoss}
          </span>
          <span className="text-sm text-muted-foreground">estimated monthly revenue loss</span>
          <InfoTooltip content={{
            title: 'How this is estimated',
            what: 'Monthly revenue loss from customers who received incorrect information about your business from AI models and chose a competitor instead.',
            how: `Based on your Reality Score of ${realityScore}/100, typical conversion rates, and the business figures below. A score of 100 means zero estimated loss.`,
            action: 'Fix hallucination alerts to improve your Reality Score and reduce this number.',
          }} />
        </div>
        {lossRangeMin && lossRangeMax && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Likely range: {formattedMin} – {formattedMax} per month
          </p>
        )}
      </div>

      {/* What drives this */}
      <div className="rounded-md bg-muted/50 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Your Reality Score is{' '}
          <span className={cn(
            'font-semibold',
            realityScore >= 75 ? 'text-emerald-600' : realityScore >= 50 ? 'text-amber-600' : 'text-red-600',
          )}>
            {realityScore}/100
          </span>
          .{' '}
          {realityScore >= 90 ? (
            'At this score, AI models are describing your business very accurately — estimated revenue loss is minimal.'
          ) : realityScore >= 70 ? (
            'At this score, AI models describe you mostly correctly, but there are a few gaps losing you customers.'
          ) : realityScore >= 50 ? (
            'At this score, AI models have meaningful errors about your business that are actively redirecting customers to competitors.'
          ) : (
            'At this score, AI models frequently show incorrect information — this is likely costing you significant walk-in revenue.'
          )}
        </p>
      </div>

      {/* Fastest way to fix */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          Fix your hallucination alerts to improve your score and reduce this estimate.
        </p>
        <Link
          href="/dashboard/alerts"
          className="shrink-0 text-xs text-primary underline hover:text-primary/80 whitespace-nowrap"
          data-testid="revenue-fix-alerts-link"
        >
          Fix alerts →
        </Link>
      </div>
    </div>
  );
}
```

#### Step 3: Update smart defaults into the Revenue Impact page

In `app/dashboard/revenue-impact/page.tsx`, load org industry and pre-populate the form:

```typescript
// In the server component, alongside existing fetches:
const industryId = org?.industry ?? null;
const smartDefaults = getIndustryRevenueDefaults(industryId);

// Check if the user has ever saved custom config (has a saved_config row):
const { data: savedConfig } = await supabase
  .from('revenue_configs')         // Adjust table name to match prod_schema.sql
  .select('*')
  .eq('org_id', orgId)
  .maybeSingle();

const usingSmartDefaults = savedConfig === null;

// The defaults passed to the form: user's saved config, or smart defaults
const formDefaults = savedConfig ?? smartDefaults;

// Compute initial estimate using the defaults (not null):
const initialEstimate = computeRevenueLeak({        // From revenue-leak.service.ts
  ...formDefaults,
  realityScore: scores?.realityScore ?? 50,         // Use 50 as a safe default if no score yet
});
```

```tsx
// New page layout:
<div className="space-y-6 p-6">
  <div>
    <h1 className="text-lg font-semibold text-foreground">Revenue Impact</h1>
    <p className="mt-0.5 text-sm text-muted-foreground">
      Estimated monthly revenue loss from customers who received incorrect information about your business.
    </p>
  </div>

  {/* Estimate panel — first, before the form */}
  <RevenueEstimatePanel
    monthlyLossEstimate={initialEstimate?.monthlyLoss ?? null}
    lossRangeMin={initialEstimate?.rangeLow ?? null}
    lossRangeMax={initialEstimate?.rangeHigh ?? null}
    realityScore={scores?.realityScore ?? null}
    usingSmartDefaults={usingSmartDefaults}
    industryName={getIndustryConfig(industryId)?.displayName ?? null}
  />

  {/* Existing RevenueConfigForm — now a refinement tool, not a prerequisite */}
  <div>
    <h2 className="mb-3 text-sm font-semibold text-foreground">
      Refine your estimate
      <InfoTooltip content={{
        title: 'Why refine?',
        what: 'The estimate above uses typical figures for your industry. Entering your actual numbers gives you a more accurate revenue impact figure.',
        how: 'These values affect the calculation — average spend has the most impact.',
        action: 'Update at least "Average spend per visit" for a meaningful improvement in accuracy.',
      }} />
    </h2>
    <RevenueConfigForm
      defaultValues={formDefaults}
      realityScore={scores?.realityScore ?? null}
    />
  </div>
</div>
```

**Pass `defaultValues` as a prop to `RevenueConfigForm`.** Read the existing component first — if it already accepts default values as props, use that mechanism. If it manages its own state with a hardcoded `DEFAULT_CONFIG`, add a `defaultValues` prop that overrides it.

---

### Page 2: AI Sentiment → Model-by-Model Interpretation

**The user's real question:** "What do AI models actually think of my business — and which model is a problem?"

**Current experience:** Pie or bar charts showing percentages (positive: 71%, negative: 18%, neutral: 11%) per model. No verdict. Users see the chart and don't know if 71% positive is good, which model is dragging them down, or what to do.

**After Sprint I:** A plain-English interpretation panel leads the page. Each AI model gets a one-sentence verdict. The lowest-scoring model is flagged with an explanation and a CTA.

#### Step 1: Understand the sentiment data shape

```bash
grep -A 25 "CREATE TABLE.*sentiment\|sentiment_results\|ai_sentiment" supabase/prod_schema.sql
```

The interpretation panel adapts to what's available:
- **Per-model breakdown** (positive_count, negative_count, neutral_count per model per period): Full interpretation with model-specific verdicts
- **Composite score only** (single sentiment_score per org per period): Simplified interpretation without per-model breakdown
- **Tagged text records** (each AI response tagged positive/negative/neutral): Compute aggregates from records

Read the actual schema and adapt the component accordingly.

#### Step 2: `SentimentInterpretationPanel` — `app/dashboard/sentiment/_components/SentimentInterpretationPanel.tsx`

```tsx
/**
 * SentimentInterpretationPanel
 *
 * Plain-English interpretation of AI sentiment data.
 * Written for a business owner, not a data analyst.
 *
 * Design pattern: worst model called out first (most actionable).
 * Best model acknowledged (positive reinforcement).
 * Overall verdict in one sentence.
 */

// Adjust these types to match the actual DB columns from prod_schema.sql:
interface ModelSentiment {
  model: string;                    // e.g., 'chatgpt', 'perplexity', 'gemini'
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  totalCount: number;
}

interface SentimentInterpretationPanelProps {
  modelBreakdowns: ModelSentiment[];   // Per-model sentiment; may be empty if data doesn't exist
  overallPositivePct: number | null;   // Overall positive % across all models
  hasData: boolean;
}

export function SentimentInterpretationPanel({
  modelBreakdowns,
  overallPositivePct,
  hasData,
}: SentimentInterpretationPanelProps) {
  if (!hasData || overallPositivePct === null) {
    return (
      <div
        className="rounded-lg border border-border bg-card p-5"
        data-testid="sentiment-no-data"
      >
        <p className="text-sm text-muted-foreground">
          Sentiment data will appear after your first AI scan. Check back after Sunday.
        </p>
      </div>
    );
  }

  // Compute per-model positive %
  const modelPcts = modelBreakdowns.map(m => ({
    ...m,
    positivePct: m.totalCount > 0 ? (m.positiveCount / m.totalCount) * 100 : null,
    negativePct: m.totalCount > 0 ? (m.negativeCount / m.totalCount) * 100 : null,
  }));

  // Sort: worst model first (lowest positive %)
  const sorted = [...modelPcts].sort((a, b) =>
    (a.positivePct ?? 100) - (b.positivePct ?? 100)
  );

  const worstModel  = sorted[0];
  const bestModel   = sorted[sorted.length - 1];
  const isPositive  = overallPositivePct >= 70;
  const isMixed     = overallPositivePct >= 50 && overallPositivePct < 70;
  const isNegative  = overallPositivePct < 50;

  return (
    <div
      className="rounded-lg border border-border bg-card p-5 space-y-4"
      data-testid="sentiment-interpretation-panel"
    >
      {/* Overall verdict */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-sm font-semibold text-foreground">What AI models say about you</h2>
          <InfoTooltip content={{
            title: 'AI Sentiment',
            what: 'How positively or negatively AI models describe your business when customers ask about it.',
            how: 'LocalVector analyzes the language AI models use in their responses about your business — not just whether they mention you, but how they describe you.',
            action: 'Fix hallucination alerts involving wrong hours, location, or prices — these are the biggest drivers of negative sentiment.',
          }} />
        </div>
        <div
          className={cn(
            'rounded-md border px-4 py-3 text-sm',
            isPositive
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : isMixed
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-red-50 border-red-200 text-red-800',
          )}
          data-testid="sentiment-overall-verdict"
        >
          {isPositive && (
            <>
              AI models describe your business positively{' '}
              <span className="font-semibold">{overallPositivePct.toFixed(0)}%</span> of the time.
              {overallPositivePct >= 85 && ' This is excellent — your business information is well-represented.'}
            </>
          )}
          {isMixed && (
            <>
              AI models describe your business positively{' '}
              <span className="font-semibold">{overallPositivePct.toFixed(0)}%</span> of the time — there's room to improve.
            </>
          )}
          {isNegative && (
            <>
              Only{' '}
              <span className="font-semibold">{overallPositivePct.toFixed(0)}%</span> of AI responses about your business are positive.
              {' '}This is hurting how potential customers perceive you before they visit.
            </>
          )}
        </div>
      </div>

      {/* Per-model breakdown — only when data exists */}
      {modelPcts.length > 0 && (
        <div className="space-y-2" data-testid="sentiment-model-breakdown">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            By AI model
          </p>

          {modelPcts.map(m => {
            const pct = m.positivePct;
            const isModelGood    = pct !== null && pct >= 70;
            const isModelProblem = pct !== null && pct < 50;

            return (
              <div
                key={m.model}
                className="flex items-center justify-between gap-4"
                data-testid={`sentiment-model-row-${m.model}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      'text-sm font-medium',
                      isModelProblem ? 'text-red-600' : isModelGood ? 'text-emerald-600' : 'text-foreground',
                    )}
                  >
                    {getModelName(m.model)}
                  </span>
                  {isModelProblem && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                      Needs attention
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {pct !== null && (
                    <span
                      className={cn(
                        'tabular-nums text-sm font-semibold',
                        isModelProblem ? 'text-red-600' : isModelGood ? 'text-emerald-600' : 'text-foreground',
                      )}
                    >
                      {pct.toFixed(0)}% positive
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Worst model call-out — actionable */}
      {worstModel?.positivePct !== null && worstModel.positivePct < 70 && (
        <div
          className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800"
          data-testid="sentiment-worst-model-callout"
        >
          <span className="font-semibold">{getModelName(worstModel.model)}</span>
          {' '}describes you negatively{' '}
          <span className="font-semibold">
            {worstModel.negativePct !== null ? `${worstModel.negativePct.toFixed(0)}%` : 'often'}
          </span>
          {' '}of the time. This is usually caused by hallucination alerts — wrong hours, wrong location, or wrong prices
          that make the business sound unreliable.{' '}
          <Link
            href="/dashboard/alerts"
            className="underline hover:text-amber-900"
            data-testid="sentiment-fix-alerts-link"
          >
            Fix these alerts →
          </Link>
        </div>
      )}
    </div>
  );
}
```

#### Step 3: Modify `app/dashboard/sentiment/page.tsx`

Add the interpretation panel above the existing charts. Read the current page file first to understand how sentiment data is fetched — reuse those fetches.

```typescript
// Adapt these to actual column names from prod_schema.sql:
const modelBreakdowns: ModelSentiment[] = (sentimentData ?? [])
  .map(row => ({
    model:         row.model,
    positiveCount: row.positive_count ?? 0,
    negativeCount: row.negative_count ?? 0,
    neutralCount:  row.neutral_count ?? 0,
    totalCount:    (row.positive_count ?? 0) + (row.negative_count ?? 0) + (row.neutral_count ?? 0),
  }));

const overallPositivePct = modelBreakdowns.length > 0
  ? (modelBreakdowns.reduce((sum, m) => sum + m.positiveCount, 0) /
     modelBreakdowns.reduce((sum, m) => sum + m.totalCount, 0)) * 100
  : null;
```

```tsx
// New layout:
<div className="space-y-6 p-6">
  <div>
    <h1 className="text-lg font-semibold text-foreground">AI Sentiment</h1>
    <p className="mt-0.5 text-sm text-muted-foreground">
      How AI models describe your business when customers ask about it.
    </p>
  </div>

  {/* Interpretation panel — before charts */}
  <SentimentInterpretationPanel
    modelBreakdowns={modelBreakdowns}
    overallPositivePct={overallPositivePct}
    hasData={sentimentData !== null && sentimentData.length > 0}
  />

  {/* Existing sentiment charts — now supporting evidence */}
  {/* Keep all existing chart components exactly as-is — just move them below */}
  <div>
    <h2 className="mb-3 text-sm font-semibold text-foreground">
      Sentiment Over Time
      <InfoTooltip content={{
        title: 'Sentiment Trend',
        what: 'How the positive/negative/neutral balance of AI responses has changed week over week.',
        how: 'A shift to more positive after fixing a hallucination alert confirms the correction worked.',
        action: 'Look for dips — they often correspond to new hallucinations appearing.',
      }} />
    </h2>
    {/* Existing chart component */}
  </div>
</div>
```

---

### Page 3: Source Intelligence → Source Health Signals

**The user's real question:** "Which websites are feeding AI models correct vs. incorrect information about my business?"

**Current experience:** A ranked list of domains with authority scores. Users see "yelp.com — 82" and don't know what 82 means, whether Yelp is helping or hurting them, or what to do about it.

**After Sprint I:** Each source has a health signal — whether it's teaching AI models correct or incorrect information. Sources with wrong information are called out plainly. The page leads with a summary of the overall source health landscape.

#### Step 1: `SourceHealthBadge` — `app/dashboard/source-intelligence/_components/SourceHealthBadge.tsx`

Similar to `CitationHealthBadge` from Sprint H but specific to source intelligence context:

```tsx
export type SourceHealth =
  | 'authoritative_correct'   // High authority, accurate info — great
  | 'authoritative_wrong'     // High authority, wrong info — dangerous
  | 'low_authority_correct'   // Low authority, accurate — harmless
  | 'low_authority_wrong'     // Low authority, wrong info — concerning
  | 'no_data';                // Can't determine accuracy

const SOURCE_HEALTH_CONFIG: Record<SourceHealth, {
  label: string;
  sublabel: string;
  className: string;
  icon: string;
}> = {
  authoritative_correct: {
    label: 'High influence, accurate',
    sublabel: 'This source is helping you — AI models trust it',
    className: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    icon: '✓',
  },
  authoritative_wrong: {
    label: 'High influence, wrong info',
    sublabel: 'This source is hurting you — AI models trust it but it has errors',
    className: 'bg-red-100 text-red-700 ring-red-200',
    icon: '✗',
  },
  low_authority_correct: {
    label: 'Low influence, accurate',
    sublabel: 'Accurate, but AI models rarely rely on it',
    className: 'bg-slate-100 text-slate-600 ring-slate-200',
    icon: '·',
  },
  low_authority_wrong: {
    label: 'Low influence, wrong info',
    sublabel: 'Wrong info, but low AI trust — less urgent',
    className: 'bg-amber-100 text-amber-700 ring-amber-200',
    icon: '!',
  },
  no_data: {
    label: 'Not yet analyzed',
    sublabel: 'Accuracy of this source hasn\'t been checked yet',
    className: 'bg-slate-100 text-slate-500 ring-slate-200',
    icon: '?',
  },
};

export function SourceHealthBadge({ health }: { health: SourceHealth }) {
  const { label, className, icon } = SOURCE_HEALTH_CONFIG[health];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1', className)}>
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}

// Export for use in tooltips and sublabels
export { SOURCE_HEALTH_CONFIG };
```

#### Step 2: `deriveSourceHealth()` — inline function in `source-intelligence/page.tsx`

**Read `prod_schema.sql` before writing this.** The logic adapts to available columns:

```typescript
// Adapt to actual column names in the source/ai_sources table:
function deriveSourceHealth(source: SourceRow): SourceHealth {
  const authorityScore = source.authority_score ?? source.domain_authority ?? null;
  const hasWrongInfo   = source.has_wrong_info ?? source.accuracy_flag === 'wrong' ?? false;
  const isHighAuth     = authorityScore !== null && authorityScore >= 60;   // Adjust threshold

  if (authorityScore === null && !source.has_wrong_info) return 'no_data';
  if (isHighAuth && hasWrongInfo)  return 'authoritative_wrong';
  if (isHighAuth && !hasWrongInfo) return 'authoritative_correct';
  if (!isHighAuth && hasWrongInfo) return 'low_authority_wrong';
  if (!isHighAuth && !hasWrongInfo) return 'low_authority_correct';
  return 'no_data';
}
```

If the `source_intelligence` table has no accuracy data (only domain + authority score): derive health from authority score only, using `authoritative_correct` for high-authority and `low_authority_correct` for low — no `_wrong` variants. Document in DEVLOG.

#### Step 3: `SourceIntelligenceSummaryPanel` — `app/dashboard/source-intelligence/_components/SourceIntelligenceSummaryPanel.tsx`

```tsx
interface SourceIntelligenceSummaryPanelProps {
  totalSources: number;
  authoritativeCorrect: number;
  authoritativeWrong: number;
  lowAuthorityWrong: number;
}

export function SourceIntelligenceSummaryPanel({
  totalSources,
  authoritativeCorrect,
  authoritativeWrong,
  lowAuthorityWrong,
}: SourceIntelligenceSummaryPanelProps) {
  const urgentProblems = authoritativeWrong;   // High-authority wrong = most urgent
  const totalProblems  = authoritativeWrong + lowAuthorityWrong;

  return (
    <div
      className="rounded-lg border border-border bg-card p-5 space-y-4"
      data-testid="source-intelligence-summary"
    >
      {/* Heading + tooltip */}
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          {totalSources} sources teaching AI about your business
        </h2>
        <InfoTooltip content={{
          title: 'What are sources?',
          what: 'These are websites that AI models read to learn about your business. High-authority sources (Yelp, Google, TripAdvisor) have the most influence over what AI says.',
          how: 'LocalVector cross-references what each source says with your verified business information.',
          action: 'Fix high-authority sources with wrong info first — they have the biggest impact on AI responses.',
        }} />
      </div>

      {/* Health grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-center" data-testid="source-count-good">
          <p className="text-lg font-bold text-emerald-700">{authoritativeCorrect}</p>
          <p className="text-[10px] text-emerald-600 leading-tight">High authority,<br />accurate</p>
        </div>
        <div
          className={cn('rounded-md px-3 py-2 text-center', authoritativeWrong > 0 ? 'bg-red-50' : 'bg-muted')}
          data-testid="source-count-auth-wrong"
        >
          <p className={cn('text-lg font-bold', authoritativeWrong > 0 ? 'text-red-600' : 'text-muted-foreground')}>
            {authoritativeWrong}
          </p>
          <p className={cn('text-[10px] leading-tight', authoritativeWrong > 0 ? 'text-red-500' : 'text-muted-foreground')}>
            High authority,<br />wrong info
          </p>
        </div>
        <div
          className={cn('rounded-md px-3 py-2 text-center', lowAuthorityWrong > 0 ? 'bg-amber-50' : 'bg-muted')}
          data-testid="source-count-low-wrong"
        >
          <p className={cn('text-lg font-bold', lowAuthorityWrong > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
            {lowAuthorityWrong}
          </p>
          <p className={cn('text-[10px] leading-tight', lowAuthorityWrong > 0 ? 'text-amber-500' : 'text-muted-foreground')}>
            Low authority,<br />wrong info
          </p>
        </div>
        <div className="rounded-md bg-muted px-3 py-2 text-center" data-testid="source-count-rest">
          <p className="text-lg font-bold text-muted-foreground">
            {totalSources - authoritativeCorrect - authoritativeWrong - lowAuthorityWrong}
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight">Low authority,<br />accurate</p>
        </div>
      </div>

      {/* Plain-English verdict */}
      {urgentProblems > 0 ? (
        <div
          className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800"
          data-testid="source-verdict-urgent"
        >
          <span className="font-semibold">{urgentProblems} high-authority source{urgentProblems !== 1 ? 's' : ''}</span>
          {' '}contain wrong information about your business. Because AI models trust these sources heavily,
          fixing them will have the biggest impact on your Reality Score and AI responses.
        </div>
      ) : totalProblems > 0 ? (
        <p className="text-sm text-amber-700" data-testid="source-verdict-minor">
          {totalProblems} source{totalProblems !== 1 ? 's' : ''} contain wrong info, but they have low influence on AI responses.
          Fix high-priority hallucination alerts first, then return to correct these.
        </p>
      ) : authoritativeCorrect > 0 ? (
        <p className="text-sm text-emerald-600 font-medium" data-testid="source-verdict-clean">
          ✓ Your authoritative sources contain accurate information — AI models are learning the right things about you.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="source-verdict-nodata">
          Source health analysis is in progress. Check back after your next scan.
        </p>
      )}
    </div>
  );
}
```

#### Step 4: Redesign `app/dashboard/source-intelligence/page.tsx`

Add the summary panel, derive health per source, and add `SourceHealthBadge` to each source row.

```tsx
// Partition sources by health after fetching:
const sourceWithHealth = (sources ?? []).map(s => ({
  ...s,
  health: deriveSourceHealth(s),
}));

// Sort: authoritative_wrong first (most urgent), then authoritative_correct, then rest
const HEALTH_ORDER: Record<SourceHealth, number> = {
  authoritative_wrong:   0,
  low_authority_wrong:   1,
  authoritative_correct: 2,
  low_authority_correct: 3,
  no_data:               4,
};
const sortedSources = [...sourceWithHealth].sort(
  (a, b) => HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health]
);

// Layout:
<div className="space-y-6 p-6">
  <div>
    <h1 className="text-lg font-semibold text-foreground">Source Intelligence</h1>
    <p className="mt-0.5 text-sm text-muted-foreground">
      The websites AI models use to learn about your business — and whether they're teaching them correctly.
    </p>
  </div>

  <SourceIntelligenceSummaryPanel
    totalSources={sortedSources.length}
    authoritativeCorrect={sortedSources.filter(s => s.health === 'authoritative_correct').length}
    authoritativeWrong={sortedSources.filter(s => s.health === 'authoritative_wrong').length}
    lowAuthorityWrong={sortedSources.filter(s => s.health === 'low_authority_wrong').length}
  />

  {/* Source list with health badges */}
  <div className="rounded-lg border border-border bg-card divide-y divide-border/50">
    {sortedSources.map(source => (
      <SourceRow key={source.id} source={source} />
    ))}
    {sortedSources.length === 0 && (
      <div className="p-5 text-center text-sm text-muted-foreground">
        No sources found yet. They appear after the first site crawl.
      </div>
    )}
  </div>
</div>
```

**`SourceRow`** — create `app/dashboard/source-intelligence/_components/SourceRow.tsx`:

```tsx
export function SourceRow({ source }: { source: SourceWithHealth }) {
  const healthConfig = SOURCE_HEALTH_CONFIG[source.health];

  return (
    <div
      className="flex items-start justify-between gap-4 px-4 py-3"
      data-testid={`source-row-${source.id}`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <img
          src={`https://www.google.com/s2/favicons?domain=${source.domain ?? ''}&sz=20`}
          alt=""
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0 rounded object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={source.url ?? `https://${source.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-sm font-medium text-foreground hover:underline"
            >
              {source.domain}
            </a>
            <SourceHealthBadge health={source.health} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{healthConfig.sublabel}</p>
          {/* Authority score — if available */}
          {source.authority_score !== null && source.authority_score !== undefined && (
            <p className="mt-0.5 text-[10px] text-muted-foreground/60">
              Authority: {source.authority_score}/100
            </p>
          )}
        </div>
      </div>
      {/* Action for problematic sources */}
      {(source.health === 'authoritative_wrong' || source.health === 'low_authority_wrong') && (
        <Link
          href="/dashboard/alerts"
          className="shrink-0 text-xs text-primary underline hover:text-primary/80 whitespace-nowrap"
          data-testid={`source-action-${source.id}`}
        >
          View alerts →
        </Link>
      )}
    </div>
  );
}
```

---

### Page 4: Bot Activity → How-to-Fix Per Blocked Bot

**The user's real question:** "Which AI crawlers are blocked from my site — and how do I fix it?"

**Current experience:** A crawl log showing bot names, visit counts, and blocked/allowed status. No instructions for how to fix a blocked bot.

**After Sprint I:** Every blocked bot row has an expandable "How to fix" section showing: (1) the exact `robots.txt` change needed, (2) a plain-English explanation of what this bot is, and (3) why unblocking it matters for the business.

#### Step 1: `BOT_KNOWLEDGE_BASE` — `lib/bot-activity/bot-knowledge.ts`

The copy for each major AI crawler:

```typescript
/**
 * lib/bot-activity/bot-knowledge.ts
 *
 * Human-readable information about AI crawlers and how to unblock them.
 * Used by the BotActivityFixInstructions component.
 *
 * AI_RULES §63: Never claim a robots.txt change will "definitely" fix a block.
 * Always say "should allow" — robots.txt is advisory, not enforced by all bots.
 */

export interface BotInfo {
  displayName: string;          // Human-readable name
  owner: string;                // Which AI product it feeds
  whyItMatters: string;         // Business consequence of blocking it
  userAgent: string;            // The User-agent string to use in robots.txt
  robotsTxtAllow: string;       // The exact robots.txt block to add
  officialDocs?: string;        // Link to official documentation
}

export const BOT_KNOWLEDGE_BASE: Record<string, BotInfo> = {
  // GPTBot — OpenAI / ChatGPT
  GPTBot: {
    displayName: 'GPTBot',
    owner: 'ChatGPT (OpenAI)',
    whyItMatters: 'GPTBot trains ChatGPT. When blocked, ChatGPT relies on older, potentially inaccurate third-party data about your business instead of reading your website directly.',
    userAgent: 'GPTBot',
    robotsTxtAllow: `User-agent: GPTBot
Allow: /`,
    officialDocs: 'https://platform.openai.com/docs/gptbot',
  },

  // ClaudeBot — Anthropic / Claude
  ClaudeBot: {
    displayName: 'ClaudeBot',
    owner: 'Claude (Anthropic)',
    whyItMatters: 'ClaudeBot feeds Claude AI. Blocking it means Claude has less accurate information about your business and may describe it incorrectly to customers who ask.',
    userAgent: 'ClaudeBot',
    robotsTxtAllow: `User-agent: ClaudeBot
Allow: /`,
    officialDocs: 'https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawl',
  },

  // PerplexityBot — Perplexity AI
  PerplexityBot: {
    displayName: 'PerplexityBot',
    owner: 'Perplexity AI',
    whyItMatters: 'PerplexityBot powers Perplexity\'s real-time search. It\'s one of the fastest-growing AI search engines. Blocking it means your business information in Perplexity is outdated.',
    userAgent: 'PerplexityBot',
    robotsTxtAllow: `User-agent: PerplexityBot
Allow: /`,
    officialDocs: 'https://docs.perplexity.ai/guides/bots',
  },

  // Google-Extended — Gemini / Google AI
  'Google-Extended': {
    displayName: 'Google-Extended',
    owner: 'Gemini (Google AI)',
    whyItMatters: 'Google-Extended feeds Gemini, Google\'s AI assistant. If blocked, Gemini uses older Google index data instead of your current website content.',
    userAgent: 'Google-Extended',
    robotsTxtAllow: `User-agent: Google-Extended
Allow: /`,
    officialDocs: 'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers#google-extended',
  },

  // Googlebot — Google Search (bonus: important for general visibility)
  Googlebot: {
    displayName: 'Googlebot',
    owner: 'Google Search',
    whyItMatters: 'Googlebot indexes your site for Google Search and Google AI. Blocking it harms both traditional search rankings and AI visibility.',
    userAgent: 'Googlebot',
    robotsTxtAllow: `User-agent: Googlebot
Allow: /`,
    officialDocs: 'https://developers.google.com/search/docs/crawling-indexing/googlebot',
  },

  // Bingbot — Bing / Microsoft Copilot
  Bingbot: {
    displayName: 'Bingbot',
    owner: 'Bing / Microsoft Copilot',
    whyItMatters: 'Bingbot powers both Bing search results and Microsoft Copilot\'s AI responses. Blocking it means your business is invisible to Copilot users.',
    userAgent: 'Bingbot',
    robotsTxtAllow: `User-agent: Bingbot
Allow: /`,
    officialDocs: 'https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0',
  },

  // Generic fallback for unknown bots
  _unknown: {
    displayName: 'This crawler',
    owner: 'an AI service',
    whyItMatters: 'AI crawlers read your website to learn about your business. Blocking them means they rely on older or less accurate data sources.',
    userAgent: 'REPLACE_WITH_BOT_USER_AGENT',
    robotsTxtAllow: `User-agent: REPLACE_WITH_BOT_USER_AGENT
Allow: /`,
  },
};

export function getBotInfo(botName: string): BotInfo {
  // Direct match
  if (BOT_KNOWLEDGE_BASE[botName]) return BOT_KNOWLEDGE_BASE[botName];

  // Case-insensitive partial match
  const normalized = botName.toLowerCase();
  for (const [key, info] of Object.entries(BOT_KNOWLEDGE_BASE)) {
    if (key === '_unknown') continue;
    if (normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized)) {
      return info;
    }
  }

  // Return unknown fallback with bot name substituted
  return {
    ...BOT_KNOWLEDGE_BASE._unknown,
    displayName: botName,
    robotsTxtAllow: `User-agent: ${botName}\nAllow: /`,
  };
}
```

#### Step 2: `BotFixInstructions` — `app/dashboard/bot-activity/_components/BotFixInstructions.tsx`

Expandable "How to fix" panel for each blocked bot:

```tsx
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { getBotInfo } from '@/lib/bot-activity/bot-knowledge';

interface BotFixInstructionsProps {
  botName: string;
}

export function BotFixInstructions({ botName }: BotFixInstructionsProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const info = getBotInfo(botName);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(info.robotsTxtAllow);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available — silently fail
    }
  }

  return (
    <div className="mt-2" data-testid={`bot-fix-${botName}`}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1 text-xs text-primary underline hover:text-primary/80"
        aria-expanded={open}
        data-testid={`bot-fix-toggle-${botName}`}
      >
        {open ? (
          <>How to fix <ChevronUp className="h-3 w-3" /></>
        ) : (
          <>How to fix <ChevronDown className="h-3 w-3" /></>
        )}
      </button>

      {open && (
        <div
          className="mt-2 rounded-md border border-border bg-muted/50 p-4 space-y-3 text-xs"
          data-testid={`bot-fix-panel-${botName}`}
        >
          {/* Why it matters */}
          <p className="text-muted-foreground">{info.whyItMatters}</p>

          {/* Step-by-step */}
          <div className="space-y-2">
            <p className="font-semibold text-foreground">To unblock {info.displayName}:</p>
            <ol className="space-y-1 list-decimal list-inside text-muted-foreground">
              <li>Open your website's <code className="bg-muted px-1 rounded text-[11px]">robots.txt</code> file (usually at <code className="bg-muted px-1 rounded text-[11px]">yourdomain.com/robots.txt</code>)</li>
              <li>Add these lines — or remove any rule that blocks {info.displayName}:</li>
            </ol>

            {/* Code block with copy button */}
            <div className="relative rounded-md bg-background border border-border p-3">
              <pre className="font-mono text-[11px] text-foreground whitespace-pre-wrap">
                {info.robotsTxtAllow}
              </pre>
              <button
                type="button"
                onClick={handleCopy}
                className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Copy to clipboard"
                data-testid={`bot-fix-copy-${botName}`}
              >
                {copied
                  ? <Check className="h-3.5 w-3.5 text-emerald-600" />
                  : <Copy className="h-3.5 w-3.5" />
                }
              </button>
            </div>

            <ol className="space-y-1 list-decimal list-inside text-muted-foreground" start={3}>
              <li>Save the file and redeploy your website</li>
              <li>{info.displayName} will discover the change within 1–7 days and begin crawling</li>
            </ol>
          </div>

          {/* Important note */}
          <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-blue-800">
            <span className="font-medium">Note:</span>{' '}
            If your site uses a platform like Wix, Squarespace, or WordPress.com, you may not be able to
            edit <code className="bg-blue-100 px-1 rounded text-[11px]">robots.txt</code> directly.
            Check your platform's settings for "Search engine visibility" or "Crawler settings."
          </div>

          {/* Official docs link */}
          {info.officialDocs && (
            <a
              href={info.officialDocs}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-primary underline hover:text-primary/80"
            >
              Official documentation for {info.displayName} →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
```

#### Step 3: `BotActivitySummaryPanel` — `app/dashboard/bot-activity/_components/BotActivitySummaryPanel.tsx`

```tsx
interface BotActivitySummaryPanelProps {
  totalBots: number;
  blockedCount: number;
  allowedCount: number;
  blockedBotNames: string[];   // Names of the blocked bots (for the plain-English verdict)
}

export function BotActivitySummaryPanel({
  totalBots,
  blockedCount,
  allowedCount,
  blockedBotNames,
}: BotActivitySummaryPanelProps) {
  return (
    <div
      className="rounded-lg border border-border bg-card p-5 space-y-3"
      data-testid="bot-activity-summary"
    >
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          AI Crawler Access
        </h2>
        <InfoTooltip content={{
          title: 'AI Crawlers',
          what: 'AI crawlers visit your website to learn about your business. The information they gather shapes what AI models say when customers ask about you.',
          how: 'LocalVector monitors which crawlers can reach your site and flags any that are blocked by your robots.txt.',
          action: 'Unblock AI crawlers to give them direct access to your accurate business information.',
        }} />
      </div>

      {/* Status grid */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className={cn('rounded-md px-4 py-3 text-center', blockedCount > 0 ? 'bg-red-50' : 'bg-muted')}
          data-testid="bot-blocked-count"
        >
          <p className={cn('text-2xl font-bold tabular-nums', blockedCount > 0 ? 'text-red-600' : 'text-muted-foreground')}>
            {blockedCount}
          </p>
          <p className={cn('text-xs font-medium', blockedCount > 0 ? 'text-red-500' : 'text-muted-foreground')}>
            Blocked
          </p>
        </div>
        <div className="rounded-md bg-emerald-50 px-4 py-3 text-center" data-testid="bot-allowed-count">
          <p className="text-2xl font-bold tabular-nums text-emerald-700">{allowedCount}</p>
          <p className="text-xs font-medium text-emerald-600">Allowed</p>
        </div>
      </div>

      {/* Verdict */}
      {blockedCount === 0 ? (
        <p className="text-sm font-medium text-emerald-600" data-testid="bot-verdict-clean">
          ✓ All AI crawlers can access your site — they're reading your latest information directly.
        </p>
      ) : (
        <div
          className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800"
          data-testid="bot-verdict-blocked"
        >
          <span className="font-semibold">
            {blockedBotNames.map(n => getBotInfo(n).displayName).join(', ')}
          </span>
          {blockedCount === 1 ? ' is' : ' are'} blocked from your website.
          {' '}These AI {blockedCount === 1 ? 'model relies' : 'models rely'} on older, less accurate
          third-party data about your business instead of reading your site directly.
          {' '}Use the "How to fix" guides below to unblock {blockedCount === 1 ? 'it' : 'them'}.
        </div>
      )}
    </div>
  );
}
```

#### Step 4: Redesign `app/dashboard/bot-activity/page.tsx`

Read the current file fully before modifying. Retain all existing data fetches. Add summary panel and fix instructions.

```typescript
// Partition bots by status — adapt to actual column names:
const blockedBots  = (bots ?? []).filter(b => b.status === 'blocked' || b.allowed === false);
const allowedBots  = (bots ?? []).filter(b => b.status === 'allowed' || b.allowed === true);
// Sort: blocked first, then by visit count descending
const sortedBots   = [...blockedBots, ...allowedBots]
  .sort((a, b) => (b.visit_count ?? 0) - (a.visit_count ?? 0));
```

```tsx
<div className="space-y-6 p-6">
  <div>
    <h1 className="text-lg font-semibold text-foreground">Bot Activity</h1>
    <p className="mt-0.5 text-sm text-muted-foreground">
      Which AI crawlers are visiting your site — and whether they can read your information.
    </p>
  </div>

  {/* Summary panel */}
  <BotActivitySummaryPanel
    totalBots={sortedBots.length}
    blockedCount={blockedBots.length}
    allowedCount={allowedBots.length}
    blockedBotNames={blockedBots.map(b => b.bot_name)}
  />

  {/* Bot list */}
  <div className="rounded-lg border border-border bg-card divide-y divide-border/50">
    {sortedBots.map(bot => (
      <BotRow key={bot.id ?? bot.bot_name} bot={bot} />
    ))}
    {sortedBots.length === 0 && (
      <div className="p-5 text-center text-sm text-muted-foreground">
        No bot activity recorded yet. Data appears after the first scan.
      </div>
    )}
  </div>
</div>
```

**`BotRow`** — create `app/dashboard/bot-activity/_components/BotRow.tsx`:

```tsx
export function BotRow({ bot }: { bot: BotActivityRow }) {
  const isBlocked = bot.status === 'blocked' || bot.allowed === false;
  const info = getBotInfo(bot.bot_name);

  return (
    <div
      className="px-4 py-3"
      data-testid={`bot-row-${bot.bot_name}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {/* Status dot */}
          <div className={cn(
            'mt-1.5 h-2 w-2 shrink-0 rounded-full',
            isBlocked ? 'bg-red-500' : 'bg-emerald-500',
          )} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">{info.displayName}</span>
              <span className="text-xs text-muted-foreground">({info.owner})</span>
            </div>
            <p className={cn('text-xs mt-0.5', isBlocked ? 'text-red-600 font-medium' : 'text-emerald-600')}>
              {isBlocked ? 'Blocked — cannot read your website' : 'Allowed — reading your site normally'}
            </p>
            {/* How to fix — expandable, only for blocked bots */}
            {isBlocked && <BotFixInstructions botName={bot.bot_name} />}
          </div>
        </div>

        {/* Visit count */}
        {bot.visit_count !== undefined && bot.visit_count !== null && (
          <div className="shrink-0 text-right">
            <p className="text-sm tabular-nums font-medium text-foreground">
              {bot.visit_count.toLocaleString()}
            </p>
            <p className="text-[10px] text-muted-foreground">visits</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 🧪 Testing

### Test File 1: `src/__tests__/unit/revenue-estimate-panel.test.tsx` — 12 tests

```
describe('RevenueEstimatePanel')
  1.  renders monthlyLossEstimate formatted as currency (e.g., "$3,200")
  2.  renders the loss range when lossRangeMin and lossRangeMax are provided
  3.  no-data state renders data-testid="revenue-no-data" when monthlyLossEstimate is null
  4.  no-data state renders data-testid="revenue-no-data" when realityScore is null
  5.  smart-defaults disclosure banner visible when usingSmartDefaults=true
  6.  smart-defaults banner hidden when usingSmartDefaults=false
  7.  Reality Score >= 90: renders "very accurately" text
  8.  Reality Score 70–89: renders "mostly correctly" text
  9.  Reality Score 50–69: renders "meaningful errors" text
  10. Reality Score < 50: renders "frequently" text
  11. "Fix alerts →" link present, links to /dashboard/alerts
  12. data-testid="revenue-monthly-loss" on the primary number element

describe('getIndustryRevenueDefaults()')
  13. 'restaurant' returns avgCheckSize around $40-50
  14. 'dental' returns coversPerNight (patients) <= 20
  15. 'hookah_lounge' returns weekendMultiplier >= 1.4
  16. null/undefined input returns the default fallback
  17. unknown industry string returns the default fallback
  18. partial match: 'fine_dining_restaurant' matches 'restaurant' family
```

**Target: 18 tests**

### Test File 2: `src/__tests__/unit/sentiment-interpretation-panel.test.tsx` — 12 tests

```
describe('SentimentInterpretationPanel')
  1.  no-data state: data-testid="sentiment-no-data" when hasData=false
  2.  overall verdict: emerald styling when overallPositivePct >= 70
  3.  overall verdict: amber styling when overallPositivePct 50–69
  4.  overall verdict: red styling when overallPositivePct < 50
  5.  data-testid="sentiment-overall-verdict" on verdict element
  6.  model breakdown: one row per model in modelBreakdowns array
  7.  model with positivePct < 50: "Needs attention" badge visible
  8.  model with positivePct >= 70: no "Needs attention" badge
  9.  worst-model callout: data-testid="sentiment-worst-model-callout" when worst model < 70%
  10. worst-model callout hidden when all models >= 70%
  11. "Fix these alerts →" link in worst-model callout links to /dashboard/alerts
  12. model name rendered via getModelName() — NOT raw model identifier string
```

**Target: 12 tests**

### Test File 3: `src/__tests__/unit/source-intelligence-components.test.tsx` — 16 tests

```
describe('SourceHealthBadge')
  1.  health='authoritative_correct': label "High influence, accurate", emerald styling
  2.  health='authoritative_wrong': label "High influence, wrong info", red styling
  3.  health='low_authority_wrong': label "Low influence, wrong info", amber styling
  4.  health='no_data': label "Not yet analyzed", slate styling

describe('SourceIntelligenceSummaryPanel')
  5.  renders total sources count
  6.  data-testid="source-count-good" shows authoritativeCorrect count
  7.  data-testid="source-count-auth-wrong" shows authoritativeWrong count
  8.  data-testid="source-count-low-wrong" shows lowAuthorityWrong count
  9.  authoritativeWrong > 0: data-testid="source-verdict-urgent" visible with red styling
  10. authoritativeWrong=0, lowAuthorityWrong > 0: data-testid="source-verdict-minor" visible
  11. 0 problems, authoritativeCorrect > 0: data-testid="source-verdict-clean" visible
  12. all zeros: data-testid="source-verdict-nodata" visible

describe('deriveSourceHealth()')
  13. high authority + has_wrong_info=true → 'authoritative_wrong'
  14. high authority + has_wrong_info=false → 'authoritative_correct'
  15. low authority + has_wrong_info=true → 'low_authority_wrong'
  16. no authority_score and no wrong_info → 'no_data'
```

**Target: 16 tests**

### Test File 4: `src/__tests__/unit/bot-activity-components.test.tsx` — 18 tests

```
describe('getBotInfo()')
  1.  'GPTBot' → displayName='GPTBot', owner contains 'ChatGPT'
  2.  'ClaudeBot' → owner contains 'Anthropic'
  3.  'PerplexityBot' → owner contains 'Perplexity'
  4.  'Google-Extended' → owner contains 'Gemini'
  5.  unknown bot name → returns _unknown fallback with botName substituted in robotsTxtAllow
  6.  case-insensitive partial match: 'gptbot' matches GPTBot entry

describe('BotFixInstructions')
  7.  collapsed by default: fix panel NOT visible
  8.  click "How to fix" → panel becomes visible (data-testid="bot-fix-panel-{botName}")
  9.  click again → panel collapses
  10. robots.txt code block rendered in expanded state
  11. copy button renders in expanded state (data-testid="bot-fix-copy-{botName}")
  12. "How to fix" toggle has aria-expanded=false when collapsed
  13. "How to fix" toggle has aria-expanded=true when expanded

describe('BotActivitySummaryPanel')
  14. renders blocked count in data-testid="bot-blocked-count"
  15. renders allowed count in data-testid="bot-allowed-count"
  16. blockedCount=0: data-testid="bot-verdict-clean" visible, emerald text
  17. blockedCount > 0: data-testid="bot-verdict-blocked" visible, red styling
  18. verdict text includes the display names of blocked bots (via getBotInfo())

describe('BotRow')
  19. blocked bot: red status dot, "Blocked" text visible
  20. allowed bot: green status dot, "Allowed" text visible
  21. blocked bot: BotFixInstructions rendered
  22. allowed bot: BotFixInstructions NOT rendered
```

**Target: 22 tests** (split if needed — consider `describe('BotRow')` as a fifth file)

### E2E Test File: `src/__tests__/e2e/sprint-i-smoke.spec.ts` — 20 tests

```
describe('Sprint I — Tier 2 Action Surfaces E2E')

  Revenue Impact:
  1.  /dashboard/revenue-impact: revenue-estimate-panel renders before the form
  2.  A dollar amount is visible immediately on page load (smart defaults applied)
  3.  Smart-defaults disclosure banner visible for org with no saved config
  4.  "Fix alerts →" link navigates to /dashboard/alerts
  5.  RevenueConfigForm inputs are pre-filled (not blank)

  AI Sentiment:
  6.  /dashboard/sentiment: sentiment-interpretation-panel renders before charts
  7.  sentiment-overall-verdict element is visible
  8.  Model breakdown rows visible when sentiment data exists (per model)
  9.  Worst-model callout visible when a model has < 70% positive
  10. "Fix these alerts →" link in callout navigates to /dashboard/alerts

  Source Intelligence:
  11. /dashboard/source-intelligence: source-intelligence-summary renders
  12. Health count grid shows 4 count boxes
  13. Source rows render with SourceHealthBadge
  14. High-authority wrong source has "View alerts →" link
  15. Sources sorted: authoritative_wrong first in the list

  Bot Activity:
  16. /dashboard/bot-activity: bot-activity-summary renders
  17. bot-blocked-count and bot-allowed-count visible
  18. Blocked bot row: "How to fix" toggle button present
  19. Click "How to fix" → fix panel expands with robots.txt code
  20. bot-verdict-clean visible when no blocked bots
```

### Run commands

```bash
npx vitest run src/__tests__/unit/revenue-estimate-panel.test.tsx
npx vitest run src/__tests__/unit/sentiment-interpretation-panel.test.tsx
npx vitest run src/__tests__/unit/source-intelligence-components.test.tsx
npx vitest run src/__tests__/unit/bot-activity-components.test.tsx
npx vitest run                                                             # ALL Sprints A–I — 0 regressions
npx playwright test src/__tests__/e2e/sprint-i-smoke.spec.ts
npx tsc --noEmit                                                           # 0 new type errors
```

---

## 📂 Files to Create / Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/revenue-impact/industry-revenue-defaults.ts` | **CREATE** | Smart defaults per industry; `getIndustryRevenueDefaults()` |
| 2 | `app/dashboard/revenue-impact/_components/RevenueEstimatePanel.tsx` | **CREATE** | Dollar estimate + smart-defaults banner |
| 3 | `app/dashboard/revenue-impact/_components/RevenueConfigForm.tsx` | **MODIFY** | Accept `defaultValues` prop |
| 4 | `app/dashboard/revenue-impact/page.tsx` | **MODIFY** | Load smart defaults; render estimate panel first |
| 5 | `app/dashboard/sentiment/_components/SentimentInterpretationPanel.tsx` | **CREATE** | Per-model verdict + worst-model callout |
| 6 | `app/dashboard/sentiment/page.tsx` | **MODIFY** | Insert interpretation panel before charts |
| 7 | `app/dashboard/source-intelligence/_components/SourceHealthBadge.tsx` | **CREATE** | 5-state health badge + SOURCE_HEALTH_CONFIG |
| 8 | `app/dashboard/source-intelligence/_components/SourceIntelligenceSummaryPanel.tsx` | **CREATE** | 4-count grid + plain-English verdict |
| 9 | `app/dashboard/source-intelligence/_components/SourceRow.tsx` | **CREATE** | Row with badge + action link |
| 10 | `app/dashboard/source-intelligence/page.tsx` | **MODIFY** | Add summary panel; sort sources; render SourceRow |
| 11 | `lib/bot-activity/bot-knowledge.ts` | **CREATE** | `BOT_KNOWLEDGE_BASE`; `getBotInfo()` |
| 12 | `app/dashboard/bot-activity/_components/BotFixInstructions.tsx` | **CREATE** | Expandable robots.txt instructions |
| 13 | `app/dashboard/bot-activity/_components/BotActivitySummaryPanel.tsx` | **CREATE** | Blocked/allowed counts + verdict |
| 14 | `app/dashboard/bot-activity/_components/BotRow.tsx` | **CREATE** | Bot row with status + BotFixInstructions |
| 15 | `app/dashboard/bot-activity/page.tsx` | **MODIFY** | Add summary panel; sort blocked first; use BotRow |
| 16 | `src/__tests__/unit/revenue-estimate-panel.test.tsx` | **CREATE** | 18 tests |
| 17 | `src/__tests__/unit/sentiment-interpretation-panel.test.tsx` | **CREATE** | 12 tests |
| 18 | `src/__tests__/unit/source-intelligence-components.test.tsx` | **CREATE** | 16 tests |
| 19 | `src/__tests__/unit/bot-activity-components.test.tsx` | **CREATE** | 22 tests |
| 20 | `src/__tests__/e2e/sprint-i-smoke.spec.ts` | **CREATE** | 20 E2E tests |

**No migrations. No API routes. No crons.**

---

## 🧠 Edge Cases to Handle

1. **`RevenueConfigForm` state management pattern.** The form may manage its own state with a hardcoded `DEFAULT_CONFIG` object and no `defaultValues` prop. If so, add a `defaultValues?: Partial<RevenueConfig>` prop and merge it with the hardcoded defaults: `const values = { ...DEFAULT_CONFIG, ...defaultValues }`. This is a conservative approach that won't break existing behavior.

2. **Revenue estimate when `realityScore` is null.** New users have no score yet. The `RevenueEstimatePanel` must handle `realityScore === null` gracefully — show the "no-data" state rather than a $0 estimate, which would be misleading. Do not compute an estimate from a null score.

3. **`computeRevenueLeak()` signature.** Read `revenue-leak.service.ts` carefully before calling it in `page.tsx`. The function may return a different shape than `{ monthlyLoss, rangeLow, rangeHigh }`. Adapt the call to match the actual return type.

4. **Sentiment data may be a composite score, not per-model.** If the `sentiment_results` table has only a single sentiment score per org (no per-model breakdown), `modelBreakdowns` will be empty. `SentimentInterpretationPanel` handles this gracefully — it renders only the overall verdict and omits the per-model breakdown section. The `hasData` check prevents showing a broken panel.

5. **Source intelligence accuracy cross-referencing.** If `source_intelligence` doesn't have `has_wrong_info` per row, you can cross-reference with `hallucination_alerts`: a source is `authoritative_wrong` if it's referenced in an open hallucination alert. This is a join query — read `prod_schema.sql` to see if `hallucination_alerts` has a `source_domain` column. If cross-referencing requires a complex query, fall back to authority score only and document in DEVLOG.

6. **`navigator.clipboard` unavailable in some contexts.** `BotFixInstructions` uses the Clipboard API for the copy button. This API may be unavailable in insecure contexts or some browsers. The `try/catch` in `handleCopy` already handles this silently. The copy button should degrade gracefully (show the code block without a working copy button) rather than throwing an error.

7. **Unknown bot names in `BOT_KNOWLEDGE_BASE`.** The log may contain bot names not in the knowledge base (custom crawlers, scrapers, monitoring tools). `getBotInfo()` returns the `_unknown` fallback with the bot name substituted into the `robots.txt` template. The resulting `robotsTxtAllow` string may not be correct for that bot — add a warning in the fix instructions: "Replace `REPLACE_WITH_BOT_USER_AGENT` with the bot's actual User-agent string."

8. **`usingSmartDefaults` when a config exists but is all zeros.** A saved config with all-zero values (e.g., someone accidentally submitted the form with blanks) should be treated as no config and fall back to smart defaults. Add a simple heuristic: `usingSmartDefaults = savedConfig === null || (savedConfig.avgCheckSize === 0 && savedConfig.coversPerNight === 0)`.

9. **Revenue Impact page may already have a results display.** The existing `RevenueConfigForm` may already show an estimated loss inline after form submission (a React state-driven update, not a server roundtrip). If it does: the `RevenueEstimatePanel` at the top shows the pre-computed default estimate; the inline form result shows the updated estimate after the user submits custom values. These should be consistent. Read the existing form component carefully before deciding whether to wire them together or keep them independent.

10. **`getIndustryConfig()` may not exist with that exact name.** Read `lib/industries/industry-config.ts` (Sprint E) to verify the exact function name and what it returns. If it exports `INDUSTRY_CONFIG` as a map but not a getter function, read the config directly: `const industryConfig = INDUSTRY_CONFIG[industryId ?? '']`.

11. **Bot activity `bot_name` casing.** Bot names in the crawl log may be stored in different cases (`gptbot` vs `GPTBot` vs `GPT-Bot`). `getBotInfo()` already does case-insensitive matching. Verify the actual casing in `seed.sql` before testing.

12. **Source Intelligence page may already have complex filtering.** Read the existing `source-intelligence/page.tsx` fully before modifying the sort order. If it has existing filter controls (by date range, by authority tier), the new health-based sort should be the default but shouldn't remove existing filters.

---

## 🚫 What NOT to Do

1. **DO NOT show a revenue estimate derived from a null Reality Score.** If the score is null, show the no-data state. A $0 estimate would imply the business has no revenue impact, which is wrong.
2. **DO NOT hardcode revenue defaults in `RevenueConfigForm`.** All defaults come from `getIndustryRevenueDefaults()` via the `defaultValues` prop. The form's internal `DEFAULT_CONFIG` is overridden by props.
3. **DO NOT claim the revenue estimate is exact.** The `RevenueEstimatePanel` must label the number as an estimate throughout — in the panel heading, in the tooltip, in the "Refine" section label. AI_RULES §62 applies.
4. **DO NOT invent per-model sentiment data if only a composite score exists.** If the DB has only one sentiment score per org (no model breakdown), render the overall verdict only. The `modelBreakdowns` array will be empty; the component handles this correctly.
5. **DO NOT assign `authoritative_wrong` health to a source unless the DB confirms it has wrong info.** Don't infer wrong info from low authority score — a low-authority source may be perfectly accurate. Use only the data available (explicit `has_wrong_info` flag, or cross-reference with hallucination_alerts if that join is clean).
6. **DO NOT show `BotFixInstructions` for allowed bots.** Only blocked bots need fix instructions. Allowed bots get a "Allowed — reading your site normally" status line with no expandable panel.
7. **DO NOT make the `BotFixInstructions` copy button throw** when the Clipboard API is unavailable. The `try/catch` in `handleCopy` handles this — the button silently fails. Do not show an error to the user for a clipboard failure.
8. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12).
9. **DO NOT modify `middleware.ts`** (AI_RULES §6).
10. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).
11. **DO NOT move the `RevenueConfigForm` or change its layout** beyond passing it new default values. The form is the refinement tool; the `RevenueEstimatePanel` above it is the hook. Both exist on the page.
12. **DO NOT add new sentiment chart components.** The existing charts stay exactly as-is. Sprint I only adds `SentimentInterpretationPanel` above them.

---

## ✅ Definition of Done

**Revenue Impact:**
- [ ] `lib/revenue-impact/industry-revenue-defaults.ts` created with at least 6 industry entries + fallback
- [ ] `getIndustryRevenueDefaults()` returns defaults for `restaurant`, `dental`, `hookah_lounge`, and fallback
- [ ] `RevenueEstimatePanel` renders dollar amount before the form on page load
- [ ] Smart-defaults disclosure banner visible for orgs with no saved config
- [ ] `RevenueConfigForm` accepts `defaultValues` prop and pre-fills correctly
- [ ] `revenue-no-data` state shown when score is null
- [ ] `revenue-monthly-loss` data-testid present
- [ ] "Fix alerts →" link present

**AI Sentiment:**
- [ ] `SentimentInterpretationPanel` renders above existing charts
- [ ] Overall verdict rendered with correct color (emerald ≥ 70%, amber 50–69%, red < 50%)
- [ ] Per-model breakdown renders when model-level data exists
- [ ] "Needs attention" badge on models with < 50% positive
- [ ] Worst-model callout renders when a model is below 70%
- [ ] `getModelName()` used — no raw model identifiers shown to users
- [ ] `sentiment-no-data` state shown when `hasData=false`

**Source Intelligence:**
- [ ] `SourceIntelligenceSummaryPanel` renders before source list
- [ ] 4-count health grid present with correct testids
- [ ] `authoritative_wrong` verdict text shown when count > 0
- [ ] Sources sorted: `authoritative_wrong` first in list
- [ ] `SourceHealthBadge` on every source row
- [ ] "View alerts →" action link on wrong-info sources
- [ ] `deriveSourceHealth()` logic documented in DEVLOG

**Bot Activity:**
- [ ] `BotActivitySummaryPanel` renders before bot list
- [ ] Blocked/allowed counts correct
- [ ] `bot-verdict-clean` / `bot-verdict-blocked` renders correctly
- [ ] `BotFixInstructions` renders for every blocked bot row
- [ ] `BotFixInstructions` NOT rendered for allowed bot rows
- [ ] Expand/collapse works on "How to fix" toggle
- [ ] Copy button present in expanded state
- [ ] `BOT_KNOWLEDGE_BASE` covers: GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Googlebot, Bingbot + `_unknown` fallback

**Tests:**
- [ ] `revenue-estimate-panel.test.tsx` — **18 tests passing**
- [ ] `sentiment-interpretation-panel.test.tsx` — **12 tests passing**
- [ ] `source-intelligence-components.test.tsx` — **16 tests passing**
- [ ] `bot-activity-components.test.tsx` — **22 tests passing**
- [ ] `npx vitest run` — ALL Sprints A–I passing, zero regressions
- [ ] `sprint-i-smoke.spec.ts` — **20 E2E tests passing**
- [ ] `npx tsc --noEmit` — 0 new type errors

---

## 📓 DEVLOG Entry

```markdown
## [DATE] — Sprint I: Tier 2 Action Surfaces (Completed)

**Revenue Impact:**
- Industry defaults: [list industries covered]
- getIndustryConfig() export name from industry-config.ts: [actual name]
- RevenueConfigForm defaultValues prop: [added prop / already had prop]
- computeRevenueLeak() return shape: [document actual fields]
- usingSmartDefaults logic: [null config / zero-value guard applied]

**AI Sentiment:**
- Sentiment table name: [actual table from prod_schema.sql]
- Data shape: [per-model breakdown with pos/neg/neutral counts / composite score only]
- Model breakdown available: [yes / no — overall verdict only]
- getModelName() reused from lib/issue-descriptions.ts: yes

**Source Intelligence:**
- Source table name: [actual table]
- deriveSourceHealth() reads: [list actual columns used]
- has_wrong_info source: [explicit column / cross-referenced with hallucination_alerts / not available — authority score only]
- Authority score threshold for "high authority": [value used, e.g., 60]

**Bot Activity:**
- Bot table name: [actual table]
- bot_name casing in DB: [e.g., 'GPTBot' / 'gptbot' — getBotInfo() handles both via case-insensitive match]
- Bots found in seed data: [list]
- BotFixInstructions uses Clipboard API: yes (try/catch for unavailable)

**Tests:** 68 Vitest + 20 Playwright
**Cumulative (A–I):** [N] Vitest + [N] Playwright
```

---

## 🔮 AI_RULES Update

```markdown
## 62. 💰 Revenue Estimates — Always Label as Estimates (Sprint I)

Revenue Impact page shows estimated revenue loss, never a precise figure.

* ALWAYS include the word "estimate" or "estimated" near the dollar amount.
* Tooltip must explain how the estimate is derived.
* Smart defaults must be labeled ("Using typical [industry] figures — refine below").
* Never compute or display a revenue estimate from a null Reality Score.
* Acceptable: "estimated $3,200/month loss". Unacceptable: "you are losing $3,200/month".
* The range (rangeLow – rangeHigh) must be shown when available to communicate uncertainty.

## 63. 🤖 Bot Knowledge Base — Single Source of Truth (Sprint I)

lib/bot-activity/bot-knowledge.ts is the single source of truth for all AI crawler information.

* getBotInfo(botName) must be used wherever bot display names or fix instructions are shown.
* Never hardcode bot display names or robots.txt snippets in component files.
* The _unknown fallback must always produce a valid (if generic) robots.txt snippet.
* BotFixInstructions is a client component — clipboard access requires 'use client'.
* Fix instructions are advisory: "should allow" not "will allow" — robots.txt is advisory for most crawlers.
```

---

## 📚 Git Commit

```bash
git add -A
git commit -m "Sprint I: Tier 2 Action Surfaces — Revenue, Sentiment, Source Intelligence, Bot Activity

Revenue Impact:
- lib/revenue-impact/industry-revenue-defaults.ts: getIndustryRevenueDefaults() with [N] industry entries
- RevenueEstimatePanel: dollar estimate + range + smart-defaults banner + Reality Score context
- RevenueConfigForm: defaultValues prop; pre-filled from org industry on page load
- revenue-impact/page.tsx: estimate panel renders before form

AI Sentiment:
- SentimentInterpretationPanel: overall verdict (emerald/amber/red) + per-model %; worst-model callout
- sentiment/page.tsx: interpretation panel added above existing charts

Source Intelligence:
- SourceHealthBadge: 5 health states (authoritative_correct/wrong, low_authority_correct/wrong, no_data)
- SourceIntelligenceSummaryPanel: 4-count health grid + plain-English verdict
- SourceRow: health badge + sublabel + action link for problem sources
- source-intelligence/page.tsx: summary panel + health-sorted source list

Bot Activity:
- lib/bot-activity/bot-knowledge.ts: BOT_KNOWLEDGE_BASE (6 bots + _unknown), getBotInfo()
- BotFixInstructions: expandable how-to-fix with robots.txt code block + copy button
- BotActivitySummaryPanel: blocked/allowed counts + verdict naming blocked bots
- BotRow: status dot + BotFixInstructions for blocked; clean status for allowed
- bot-activity/page.tsx: summary panel + blocked-first sort + BotRow

Tests: 68 Vitest + 20 Playwright; 0 regressions Sprints A–I
AI_RULES: 62 (revenue estimates always labeled), 63 (bot knowledge base single source of truth)"

git push origin main
```

---

## 🏁 Sprint Outcome

After Sprint I, the Tier 2 pages answer their user's real question before anything else:

**Revenue Impact** — "$3,200/month estimated loss" is the first thing on the page, not a blank form. The form is still there for users who want to refine the estimate with their actual numbers — but the hook lands immediately, before any user input is required.

**AI Sentiment** — "Gemini describes you well. Perplexity is your problem — it's negative about you 62% of the time." Users know which model to care about and why, in the first 5 seconds. The charts are still there for users who want the trend data.

**Source Intelligence** — "2 high-authority sources contain wrong information about your business. Because AI models trust these sources heavily, fixing them will have the biggest impact." Users know which sources matter and why, without needing to understand domain authority scores.

**Bot Activity** — "ClaudeBot and GPTBot are blocked from your website. Use the guides below to unblock them." Every blocked bot has an expandable "How to fix" section with the exact `robots.txt` edit needed, a copy button, and official documentation links. Users don't need to Google "how to unblock GPTBot" anymore.

**The pattern across Sprints G–I:** Every page now answers the user's real question in the first 3 seconds. Data is supporting evidence, not the primary content. The product explains itself.

**Next — Sprint J:** Entity Health, Agent Readiness, and Cluster Map — the three remaining Tier 3 pages that still speak in jargon. The Sprint E `FirstVisitTooltip` system helps here, but these pages need deeper restructuring: jargon replacement, guided-action flows, and plain-English explanations of what "entity health" actually means for a restaurant owner.
