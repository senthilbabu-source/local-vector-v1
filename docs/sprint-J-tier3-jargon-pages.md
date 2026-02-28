# Sprint J — Jargon Retirement: Entity Health, Agent Readiness & Cluster Map

> **Claude Code Prompt — Bulletproof Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`
> **Prerequisites:** Sprints A–I must be fully merged and all tests passing. Sprint J is front-end only — no new DB tables, no new cron jobs, no new API routes. All data exists.

---

## 🎯 Objective

Sprints G–I converted 8 detail pages from data displays into action surfaces. Sprint J completes the transformation with the three remaining Tier 3 pages — Entity Health, Agent Readiness, and Cluster Map. These pages have a fundamentally different problem from the pages in Sprints H and I: they don't just lack interpretation, they speak in a language users don't understand.

A restaurant owner opening Entity Health sees a score labeled "Entity Health: 68" with sub-scores for "Knowledge Graph Consistency" and "Ontological Coverage." They close the tab. They will never open it again. The Sprint E `FirstVisitTooltip` adds a one-time explanatory banner that appears on first visit — that's a good first step, but it only explains what the page is. It doesn't tell the user what's wrong or what to do. Sprint J goes the rest of the way.

**The three pages and the specific transformation:**

1. **Entity Health → "Does AI Know Your Business Correctly?"** — Currently: a score (0–100) with sub-scores using terms like "Knowledge Graph Consistency," "Ontological Coverage," and "Entity Disambiguation." After Sprint J: those terms are retired from the user-facing UI entirely. In their place: plain-English sub-scores ("Hours consistent across AI models," "Name and address match everywhere") with color-coded pass/fail indicators. A top-level verdict answers the question: "AI models have a solid understanding of who you are" or "AI models are confused about your business in [N] areas — here's what to fix." Each failing sub-score has an action.

2. **Agent Readiness → "Can AI Take Action for Your Customers?"** — Currently: a technical checklist of requirements like "Structured Data Present," "JSON-LD Valid," and "Action Schema Configured." After Sprint J: the checklist items are rewritten as customer scenarios — "Can AI answer 'Are you open right now?'" (✓), "Can AI tell customers how to get there?" (✓), "Can AI book a reservation for a customer?" (✗ — needs action). Each failing scenario explains what it means for the business and links to the specific fix. The page leads with a verdict: "AI can handle N of M customer questions automatically."

3. **Cluster Map → "Where Does AI Place You in Local Search?"** — Currently: a visualization (likely a force-directed graph or scatter plot) showing the business as a dot among other business dots, labeled with terms like "Cluster Centrality" and "Semantic Proximity." After Sprint J: the map gets a plain-English interpretation panel above it. "AI search puts you in the 'hookah lounge and nightlife' category for Alpharetta. You're in the middle of your cluster — not the top result, but visible. Your nearest high-ranked competitor is Lips Hookah Lounge — they're at the cluster center." The visualization remains as supporting evidence; the interpretation is the primary content.

**Why these three are the hardest:** Entity Health, Agent Readiness, and Cluster Map all deal with AI infrastructure concepts — knowledge graphs, schema.org structured data, semantic embeddings — that are invisible to business owners and irrelevant to their day-to-day concerns. The challenge isn't just writing plain English; it's finding the *customer consequence* of each technical concept and leading with that. "Knowledge Graph Consistency: 72%" means nothing. "ChatGPT sometimes describes your business as a different type of restaurant — this confuses customers who are looking specifically for hookah lounges" means everything.

**The Sprint E `FirstVisitTooltip` is already deployed on all three pages.** Sprint J does not add or modify those tooltips. It restructures the page content that comes after the tooltip is dismissed.

**Estimated total implementation time:** 18–24 hours. Entity Health (8–10 hours) is the heaviest because the sub-score translation layer requires the most careful mapping of technical → customer-consequence language. Agent Readiness (5–7 hours) is a checklist rewrite plus scenario descriptions. Cluster Map (5–7 hours) is an interpretation panel above an existing visualization.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                                   — Rules 42–63 from Sprints A–I now in effect
Read CLAUDE.md                                          — Full Sprint A–I implementation inventory
Read MEMORY.md                                          — All architecture decisions through Sprint I

--- Sprint E artifacts already in effect ---
Read components/ui/FirstVisitTooltip.tsx               — Already on all three pages. Do NOT move or modify it.
Read lib/industries/industry-config.ts                  — INDUSTRY_CONFIG, getIndustryConfig() — reuse for
                                                          industry-specific scenario wording in Agent Readiness

--- Sprint G artifacts to REUSE ---
Read lib/issue-descriptions.ts                          — getModelName() — reuse in Entity Health model breakdowns
Read components/ui/InfoTooltip.tsx                      — Sprint B: reuse on all three pages

--- Entity Health page ---
Read app/dashboard/entity-health/page.tsx               — COMPLETE FILE. Current fetches, current layout,
                                                          current score/sub-score data shape
Read app/dashboard/entity-health/                       — ls; read every component in the directory
Read supabase/prod_schema.sql                           — entity_health or entity_scores table:
                                                          ALL columns; exact sub-score field names;
                                                          what the score range is (0–100? 0–1?)
Read lib/supabase/database.types.ts                     — TypeScript types for entity health rows

--- Agent Readiness page ---
Read app/dashboard/agent-readiness/page.tsx             — COMPLETE FILE. Current fetches, current layout,
                                                          current checklist item data shape
Read app/dashboard/agent-readiness/                     — ls; read every component
Read supabase/prod_schema.sql                           — agent_readiness or readiness_checks table:
                                                          ALL columns; what check names exist; pass/fail column;
                                                          what check_type values are used
Read lib/supabase/database.types.ts                     — TypeScript types for agent readiness rows

--- Cluster Map page ---
Read app/dashboard/cluster-map/page.tsx                 — COMPLETE FILE. Current fetches, current layout,
                                                          current visualization library and data shape
Read app/dashboard/cluster-map/                         — ls; read every component; understand the
                                                          visualization (force graph? recharts? D3? custom?)
Read supabase/prod_schema.sql                           — cluster_map, sov_clusters, or semantic_clusters table:
                                                          cluster_name, cluster_members, org_position columns;
                                                          centrality or rank column if exists
Read src/__fixtures__/golden-tenant.ts                  — Sample cluster data shapes
```

**Specifically understand before writing any code:**

- **Entity Health sub-score field names:** Run:
  ```bash
  grep -A 40 "CREATE TABLE.*entity_health\|entity_scores" supabase/prod_schema.sql
  ```
  The translation layer in `lib/entity-health/sub-score-descriptions.ts` must use the exact column names from the DB. Common possibilities: `knowledge_graph_consistency`, `ontological_coverage`, `entity_disambiguation`, `name_accuracy`, `address_accuracy`, `hours_accuracy`, `category_accuracy`. Map whatever exists to plain-English customer-consequence descriptions.

- **Agent Readiness check names:** Run:
  ```bash
  grep -A 30 "CREATE TABLE.*agent_readiness\|readiness_checks" supabase/prod_schema.sql
  ```
  Then check what check names exist in seed data:
  ```bash
  grep -i "agent_readiness\|readiness" supabase/seed.sql | head -20
  ```
  The scenario descriptions in `lib/agent-readiness/scenario-descriptions.ts` map check names → customer scenarios. You must use the exact check names that exist in the DB.

- **Cluster Map visualization library:** Run:
  ```bash
  cat app/dashboard/cluster-map/page.tsx | head -30
  grep "import" app/dashboard/cluster-map/page.tsx
  ```
  Is the map a D3 force graph? A Recharts ScatterChart? A custom SVG? A third-party library? Read the existing visualization code completely before designing the interpretation panel — the panel must not interfere with the visualization's layout or data flow.

- **Cluster Map data shape:** The interpretation panel needs: (1) the business's cluster name, (2) the business's position (central/edge), (3) who else is in the cluster, and (4) the highest-ranked member of the cluster (to say "Your highest-ranked cluster competitor is X"). Read `prod_schema.sql` to understand what's actually available. If cluster_name doesn't exist, the interpretation panel may only be able to say "You're in a cluster with [N] other businesses."

- **FirstVisitTooltip is already in place on all three pages (Sprint E).** Before modifying any page file, locate and preserve the `<FirstVisitTooltip />` component. Sprint J's new content comes *after* it in the JSX, not before or instead of it. Do not remove or modify the tooltip.

---

## 🏗️ Architecture — What to Build

---

### Page 1: Entity Health → "Does AI Know Your Business Correctly?"

**The user's real question:** "Do AI models have the right information about who my business is?"

**Current experience:** A score labeled "Entity Health: 68" with sub-scores using terms like "Knowledge Graph Consistency," "Ontological Coverage," "Entity Disambiguation." Users have no idea what any of these mean. The FirstVisitTooltip from Sprint E explains the page exists — but doesn't tell them what's wrong.

**After Sprint J:** Every sub-score is translated into a plain-English statement about a specific thing AI models either understand correctly or get wrong about the business. The verdict leads: "AI models have a solid understanding of your business" or "AI models are confused about your business in 3 areas." Each failing area has an explanation and a CTA.

#### Step 1: `lib/entity-health/sub-score-descriptions.ts`

The translation layer. Maps DB sub-score field names → plain-English customer-consequence descriptions.

**Read `prod_schema.sql` first.** The `SubScoreKey` type and every entry in `SUB_SCORE_DESCRIPTIONS` must use the exact column names found in the entity health table.

```typescript
/**
 * lib/entity-health/sub-score-descriptions.ts
 *
 * Maps entity health sub-score DB field names to plain-English descriptions
 * for business owners.
 *
 * AI_RULES §64: Entity health jargon ban — these terms NEVER appear in UI text:
 * "knowledge graph", "ontological", "entity disambiguation", "semantic",
 * "embedding", "NLP", "NER", "entity resolution", "canonical form".
 *
 * Replacement vocabulary:
 * "knowledge graph" → "what AI models know about you"
 * "entity" → "your business" or "you" (never "entity")
 * "ontological coverage" → "how AI categorizes you"
 * "disambiguation" → "telling your business apart from others with similar names"
 *
 * AI_RULES §60: Each sub-score that fails MUST have an action — either a link
 * to the relevant fix page or a plain-English instruction.
 */

// Adjust SubScoreKey to match exact column names from prod_schema.sql:
export type SubScoreKey =
  | 'knowledge_graph_consistency'   // or actual column name
  | 'ontological_coverage'          // or actual column name
  | 'entity_disambiguation'         // or actual column name
  | 'name_accuracy'
  | 'address_accuracy'
  | 'hours_accuracy'
  | 'category_accuracy'
  | 'phone_accuracy'
  | 'website_accuracy';
  // Add/remove to match actual DB columns

export interface SubScoreDescription {
  /** Short label shown in the card header (≤ 5 words, jargon-free) */
  label: string;
  /** One-sentence explanation of what this measures */
  whatItMeans: string;
  /** What a PASSING score means for the business */
  whenGood: string;
  /** What a FAILING score means for the business (the customer consequence) */
  whenBad: string;
  /** Where to send the user to fix it */
  fixHref: string;
  /** CTA label */
  fixLabel: string;
}

export const SUB_SCORE_DESCRIPTIONS: Record<SubScoreKey, SubScoreDescription> = {
  knowledge_graph_consistency: {
    label: 'Consistent across AI models',
    whatItMeans: 'Whether different AI models agree on the basic facts about your business — name, type, location, hours.',
    whenGood: 'All major AI models have the same understanding of your business — customers get consistent information no matter which AI they ask.',
    whenBad: 'AI models contradict each other about your business. One says you close at 10pm, another says midnight. This confuses customers and erodes trust.',
    fixHref: '/dashboard/alerts',
    fixLabel: 'Fix inconsistencies →',
  },

  ontological_coverage: {
    label: 'Correctly categorized',
    whatItMeans: 'Whether AI models correctly identify what type of business you are — hookah lounge, restaurant, nightclub — and include you in the right search categories.',
    whenGood: 'AI models accurately classify your business. Customers searching for your business type find you.',
    whenBad: 'AI models misclassify your business. Customers searching for "hookah lounge" may not be shown your business because AI thinks you\'re a restaurant or bar.',
    fixHref: '/dashboard/entity-health',
    fixLabel: 'View details →',
  },

  entity_disambiguation: {
    label: 'Distinguishable from similar businesses',
    whatItMeans: 'Whether AI models can tell your business apart from others with similar names or in similar locations.',
    whenGood: 'AI models know your business is distinct. Customers who ask about you specifically get information about you — not a different business with a similar name.',
    whenBad: 'AI models sometimes confuse your business with another one. Customers asking about you may get information about the wrong business.',
    fixHref: '/dashboard/citations',
    fixLabel: 'Add more citations →',
  },

  name_accuracy: {
    label: 'Business name correct',
    whatItMeans: 'Whether AI models use your correct business name.',
    whenGood: 'AI models use your correct business name consistently.',
    whenBad: 'AI models use an old or incorrect version of your business name — customers may not recognize it as your business.',
    fixHref: '/dashboard/alerts',
    fixLabel: 'Fix name issues →',
  },

  address_accuracy: {
    label: 'Address and location correct',
    whatItMeans: 'Whether AI models know your correct address and can give accurate directions.',
    whenGood: 'AI models know where you are. Customers get correct directions.',
    whenBad: 'AI models have your address wrong. Customers following AI directions may end up at the wrong location.',
    fixHref: '/dashboard/alerts',
    fixLabel: 'Fix address →',
  },

  hours_accuracy: {
    label: 'Hours correct across AI',
    whatItMeans: 'Whether AI models know your correct opening and closing hours.',
    whenGood: 'AI models tell customers your correct hours. Fewer customers showing up at the wrong time.',
    whenBad: 'AI models give customers the wrong hours. Customers show up when you\'re closed — or don\'t show up because AI told them you\'re closed when you\'re open.',
    fixHref: '/dashboard/alerts',
    fixLabel: 'Fix hours →',
  },

  category_accuracy: {
    label: 'In the right search categories',
    whatItMeans: 'Whether AI models include your business in the right search categories when customers look for businesses like yours.',
    whenGood: 'AI models include your business in relevant local searches.',
    whenBad: 'Your business may not appear when customers search for businesses in your category.',
    fixHref: '/dashboard/citations',
    fixLabel: 'Improve categorization →',
  },

  phone_accuracy: {
    label: 'Phone number correct',
    whatItMeans: 'Whether AI models have your correct phone number.',
    whenGood: 'Customers who ask AI for your phone number get the right number.',
    whenBad: 'Customers who ask AI for your phone number may get an old or incorrect number.',
    fixHref: '/dashboard/alerts',
    fixLabel: 'Fix phone →',
  },

  website_accuracy: {
    label: 'Website listed correctly',
    whatItMeans: 'Whether AI models have your correct website URL.',
    whenGood: 'AI models send customers to your correct website.',
    whenBad: 'AI models may send customers to an outdated or incorrect website URL.',
    fixHref: '/dashboard/alerts',
    fixLabel: 'Fix website →',
  },
};

// Helper: derive pass/fail from a numeric score
// Adjust thresholds based on the actual score scale in prod_schema.sql
export function isSubScorePassing(score: number | null, maxScore: number = 100): boolean {
  if (score === null) return false;
  // Normalize to 0–100 if scores are 0–1:
  const normalized = maxScore === 1 ? score * 100 : score;
  return normalized >= 70;
}
```

**Add/remove/rename entries to match the exact sub-score columns in `prod_schema.sql`.** If a column exists in the DB but isn't in this list, add it. If an entry in this list doesn't match any DB column, remove it. Do not leave mismatched keys.

#### Step 2: `EntityHealthSubScoreCard` — `app/dashboard/entity-health/_components/EntityHealthSubScoreCard.tsx`

```tsx
import { isSubScorePassing, SUB_SCORE_DESCRIPTIONS, type SubScoreKey } from '@/lib/entity-health/sub-score-descriptions';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import Link from 'next/link';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EntityHealthSubScoreCardProps {
  subScoreKey: SubScoreKey;
  score: number | null;
  maxScore?: number;   // Defaults to 100; use 1 if scores are 0–1
}

export function EntityHealthSubScoreCard({
  subScoreKey,
  score,
  maxScore = 100,
}: EntityHealthSubScoreCardProps) {
  const desc = SUB_SCORE_DESCRIPTIONS[subScoreKey];
  if (!desc) return null;

  const isPassing = score !== null && isSubScorePassing(score, maxScore);
  const isNull    = score === null;

  // Normalize to 0–100 for display
  const displayScore = score === null
    ? null
    : maxScore === 1
    ? Math.round(score * 100)
    : Math.round(score);

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4',
        isPassing
          ? 'border-emerald-200'
          : isNull
          ? 'border-border'
          : 'border-red-200',
      )}
      data-testid={`entity-subscore-${subScoreKey}`}
    >
      {/* Header row */}
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {isNull ? (
            <AlertCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : isPassing ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0 text-red-500" />
          )}
          <span
            className={cn(
              'text-sm font-medium',
              isPassing ? 'text-emerald-700' : isNull ? 'text-muted-foreground' : 'text-red-700',
            )}
          >
            {desc.label}
          </span>
          <InfoTooltip content={{
            title: desc.label,
            what: desc.whatItMeans,
            how: '',   // not needed for sub-scores
            action: isPassing ? desc.whenGood : desc.whenBad,
          }} />
        </div>
        {displayScore !== null && (
          <span
            className={cn(
              'shrink-0 tabular-nums text-xs font-semibold',
              isPassing ? 'text-emerald-600' : 'text-red-600',
            )}
            data-testid={`entity-subscore-score-${subScoreKey}`}
          >
            {displayScore}/100
          </span>
        )}
      </div>

      {/* Customer-consequence text */}
      <p className={cn('text-xs', isPassing ? 'text-emerald-700/80' : 'text-red-700/80')}>
        {isNull
          ? 'Not yet analyzed — will appear after your next scan.'
          : isPassing
          ? desc.whenGood
          : desc.whenBad}
      </p>

      {/* Fix CTA — only for failing sub-scores */}
      {!isPassing && !isNull && (
        <Link
          href={desc.fixHref}
          className="mt-2 block text-xs text-primary underline hover:text-primary/80"
          data-testid={`entity-subscore-fix-${subScoreKey}`}
        >
          {desc.fixLabel}
        </Link>
      )}
    </div>
  );
}
```

#### Step 3: `EntityHealthVerdictPanel` — `app/dashboard/entity-health/_components/EntityHealthVerdictPanel.tsx`

```tsx
interface EntityHealthVerdictPanelProps {
  overallScore: number | null;    // 0–100
  passingCount: number;
  failingCount: number;
  totalChecked: number;
}

export function EntityHealthVerdictPanel({
  overallScore,
  passingCount,
  failingCount,
  totalChecked,
}: EntityHealthVerdictPanelProps) {
  if (overallScore === null) {
    return (
      <div className="rounded-lg border border-border bg-card p-5" data-testid="entity-health-no-data">
        <p className="text-sm text-muted-foreground">
          Entity Health analysis is in progress. Check back after your next scan.
        </p>
      </div>
    );
  }

  const isStrong  = overallScore >= 80;
  const isMixed   = overallScore >= 55 && overallScore < 80;
  const isWeak    = overallScore < 55;

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-5 space-y-3',
        isStrong ? 'border-emerald-200' : isMixed ? 'border-amber-200' : 'border-red-200',
      )}
      data-testid="entity-health-verdict-panel"
    >
      {/* Score + overall verdict */}
      <div className="flex items-baseline gap-3">
        <span
          className={cn(
            'text-3xl font-bold tabular-nums',
            isStrong ? 'text-emerald-600' : isMixed ? 'text-amber-600' : 'text-red-600',
          )}
          data-testid="entity-health-overall-score"
        >
          {overallScore}
        </span>
        <span className="text-sm text-muted-foreground">/ 100</span>
        <InfoTooltip content={{
          title: 'Entity Health Score',
          what: 'How well AI models understand and accurately represent your business across all knowledge sources.',
          how: 'Combines sub-scores for name accuracy, location, hours, categorization, and consistency across AI models.',
          action: 'Fix the failing areas below to improve your score and reduce AI hallucinations.',
        }} />
      </div>

      {/* Plain-English verdict sentence */}
      <div
        className={cn(
          'rounded-md border px-4 py-3 text-sm',
          isStrong
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : isMixed
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-red-50 border-red-200 text-red-800',
        )}
        data-testid="entity-health-verdict-text"
      >
        {isStrong && (
          <>
            AI models have a solid understanding of your business.
            {passingCount === totalChecked
              ? ' All areas are passing — keep your information up to date to maintain this.'
              : ` ${passingCount} of ${totalChecked} areas are passing.`}
          </>
        )}
        {isMixed && (
          <>
            AI models mostly understand your business, but there{' '}
            {failingCount === 1 ? 'is' : 'are'}{' '}
            <span className="font-semibold">{failingCount} area{failingCount !== 1 ? 's' : ''}</span>
            {' '}where they get things wrong.
            {failingCount > 0 && ' Fix the items below to stop customers getting incorrect information.'}
          </>
        )}
        {isWeak && (
          <>
            AI models are confused about your business in{' '}
            <span className="font-semibold">{failingCount} area{failingCount !== 1 ? 's' : ''}</span>.
            {' '}This is likely causing hallucinations — AI models telling customers incorrect things.
            {' '}Fix the items below, starting with the ones marked in red.
          </>
        )}
      </div>

      {/* Pass/fail summary */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="text-emerald-600 font-medium">✓ {passingCount} passing</span>
        {failingCount > 0 && (
          <span className="text-red-600 font-medium">✗ {failingCount} failing</span>
        )}
      </div>
    </div>
  );
}
```

#### Step 4: Redesign `app/dashboard/entity-health/page.tsx`

Read the current file completely before modifying. Retain all data fetches. Add translation layer.

```typescript
// In the server component, after fetching entity health data:

// Determine which sub-score keys are present in the actual data
// (only include keys that exist in prod_schema.sql):
const subScoreKeys = Object.keys(SUB_SCORE_DESCRIPTIONS).filter(
  key => key in (entityHealthData ?? {})
) as SubScoreKey[];

// Compute pass/fail counts
const subScores = subScoreKeys.map(key => ({
  key,
  score: entityHealthData?.[key] ?? null,
  passing: entityHealthData?.[key] !== null
    ? isSubScorePassing(entityHealthData[key], /* maxScore */)
    : false,
}));

const passingCount = subScores.filter(s => s.passing).length;
const failingCount = subScores.filter(s => !s.passing && s.score !== null).length;
```

```tsx
// New page layout:
<div className="space-y-6 p-6">
  <div>
    <h1 className="text-lg font-semibold text-foreground">
      Does AI Know Your Business Correctly?
    </h1>
    <p className="mt-0.5 text-sm text-muted-foreground">
      How accurately AI models represent your business when customers ask about you.
    </p>
  </div>

  {/* FirstVisitTooltip from Sprint E — PRESERVED, NOT MODIFIED */}
  {/* It renders above the verdict panel on first visit, then disappears */}

  {/* Verdict panel — before sub-score grid */}
  <EntityHealthVerdictPanel
    overallScore={entityHealthData?.overall_score ?? null}
    passingCount={passingCount}
    failingCount={failingCount}
    totalChecked={subScores.filter(s => s.score !== null).length}
  />

  {/* Sub-score grid — failing first */}
  <div className="space-y-4">
    {/* Failing sub-scores */}
    {subScores.filter(s => !s.passing && s.score !== null).length > 0 && (
      <div>
        <h2 className="mb-3 text-sm font-semibold text-red-600">
          Needs Attention ({subScores.filter(s => !s.passing && s.score !== null).length})
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {subScores
            .filter(s => !s.passing && s.score !== null)
            .map(({ key, score }) => (
              <EntityHealthSubScoreCard
                key={key}
                subScoreKey={key}
                score={score}
              />
            ))}
        </div>
      </div>
    )}

    {/* Passing sub-scores */}
    {subScores.filter(s => s.passing).length > 0 && (
      <div>
        <h2 className="mb-3 text-sm font-semibold text-emerald-600">
          Passing ({subScores.filter(s => s.passing).length})
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {subScores
            .filter(s => s.passing)
            .map(({ key, score }) => (
              <EntityHealthSubScoreCard
                key={key}
                subScoreKey={key}
                score={score}
              />
            ))}
        </div>
      </div>
    )}
  </div>
</div>
```

---

### Page 2: Agent Readiness → "Can AI Take Action for Your Customers?"

**The user's real question:** "Can AI assistants answer customer questions or take actions on my behalf?"

**Current experience:** A checklist with technical items like "JSON-LD Valid," "Structured Data Present," "Action Schema Configured," "Reservation Schema Valid." Business owners don't know what JSON-LD is or why it matters.

**After Sprint J:** The checklist is rewritten as customer interaction scenarios — things a real customer would ask or do. "Can AI tell a customer your current hours?" ✓. "Can AI book a reservation for a customer?" ✗. Each failing scenario explains the business impact and links to the fix.

#### Step 1: `lib/agent-readiness/scenario-descriptions.ts`

Maps check names from the DB → customer-interaction scenario descriptions.

**Read `prod_schema.sql` and `seed.sql` first to get exact check names.**

```typescript
/**
 * lib/agent-readiness/scenario-descriptions.ts
 *
 * Maps agent readiness check DB names to customer-scenario descriptions.
 * Every check is expressed as a customer interaction, not a technical requirement.
 *
 * AI_RULES §65: Agent Readiness jargon ban —
 * These terms NEVER appear in UI text: "JSON-LD", "schema.org", "structured data",
 * "action schema", "reservation schema", "microdata", "RDF", "ontology", "agentic".
 *
 * Replacement vocabulary:
 * "JSON-LD valid" → "AI can read your business information"
 * "structured data" → "your business information is formatted for AI"
 * "action schema" → "AI can take actions for customers"
 * "reservation schema" → "AI can book reservations"
 */

import { getIndustryConfig } from '@/lib/industries/industry-config';

// Adjust CheckKey to exact check names from prod_schema.sql / seed.sql:
export type CheckKey =
  | 'json_ld_present'
  | 'json_ld_valid'
  | 'hours_schema_valid'
  | 'reservation_schema_valid'
  | 'menu_schema_valid'
  | 'location_schema_valid'
  | 'contact_schema_valid'
  | 'review_schema_valid'
  | 'llms_txt_present'
  | 'llms_txt_valid'
  | 'robots_allows_ai'
  | 'sitemap_present';
  // Add/remove to match actual check names in the DB

export interface ScenarioDescription {
  /** Short plain-English scenario label (the question AI can answer) */
  scenario: string;
  /** Who benefits and how */
  benefit: string;
  /** What happens when the check fails — the customer consequence */
  whenFailing: string;
  /** Where to fix it */
  fixHref: string;
  /** CTA label */
  fixLabel: string;
  /** Whether to show this check. Can be industry-conditional */
  showFor?: 'all' | 'restaurant' | 'medical_dental';
}

export const SCENARIO_DESCRIPTIONS: Record<CheckKey, ScenarioDescription> = {
  json_ld_present: {
    scenario: 'AI can find your basic business information',
    benefit: 'AI assistants can answer basic questions about your business — name, location, hours, phone.',
    whenFailing: 'Your website doesn\'t have machine-readable business information. AI models have to guess from page text — which leads to errors.',
    fixHref: '/dashboard/agent-readiness',
    fixLabel: 'Learn how to fix →',
    showFor: 'all',
  },

  json_ld_valid: {
    scenario: 'Your business information is correctly formatted for AI',
    benefit: 'AI models can read your business information reliably and accurately.',
    whenFailing: 'Your business information is present but has formatting errors. AI models may read it incorrectly, causing hallucinations.',
    fixHref: '/dashboard/agent-readiness',
    fixLabel: 'View validation errors →',
    showFor: 'all',
  },

  hours_schema_valid: {
    scenario: 'AI can answer "Are you open right now?"',
    benefit: 'Customers who ask AI assistants about your hours get accurate, real-time answers.',
    whenFailing: 'AI models don\'t have your correct hours in a format they can reliably read. Customers may get wrong information about whether you\'re open.',
    fixHref: '/dashboard/alerts',
    fixLabel: 'Fix hours data →',
    showFor: 'all',
  },

  reservation_schema_valid: {
    scenario: 'AI can book a reservation for a customer',
    benefit: 'AI agents (ChatGPT, Gemini) can book a table or appointment at your business directly on behalf of the customer.',
    whenFailing: 'AI agents can\'t book reservations for customers. Customers have to exit the AI and book separately — many don\'t.',
    fixHref: '/dashboard/agent-readiness',
    fixLabel: 'Enable AI reservations →',
    showFor: 'restaurant',
  },

  menu_schema_valid: {
    scenario: 'AI can show customers your menu',
    benefit: 'AI assistants can show customers your current menu and prices when they ask.',
    whenFailing: 'AI models don\'t have an up-to-date version of your menu. Customers asking "what\'s on the menu?" get outdated or incorrect answers.',
    fixHref: '/dashboard/magic-menus',
    fixLabel: 'Update your menu →',
    showFor: 'restaurant',
  },

  location_schema_valid: {
    scenario: 'AI can give accurate directions to your business',
    benefit: 'Customers who ask AI for directions get accurate, working directions to your location.',
    whenFailing: 'AI models may give customers incorrect directions — wrong address, wrong intersection, or outdated location.',
    fixHref: '/dashboard/alerts',
    fixLabel: 'Fix location data →',
    showFor: 'all',
  },

  contact_schema_valid: {
    scenario: 'AI can give customers your correct phone number',
    benefit: 'Customers who ask AI for your contact information get the right phone number and email.',
    whenFailing: 'AI models may give customers an old or incorrect phone number.',
    fixHref: '/dashboard/alerts',
    fixLabel: 'Fix contact data →',
    showFor: 'all',
  },

  review_schema_valid: {
    scenario: 'AI can show customers your rating and reviews',
    benefit: 'AI assistants can tell customers about your ratings and share positive reviews when asked.',
    whenFailing: 'AI models may show outdated, incorrect, or missing review data to customers.',
    fixHref: '/dashboard/citations',
    fixLabel: 'Improve review citations →',
    showFor: 'all',
  },

  llms_txt_present: {
    scenario: 'You have a guide for AI models on your website',
    benefit: 'Your website has a special file (llms.txt) that tells AI assistants what they need to know about your business, directly and accurately.',
    whenFailing: 'Your website doesn\'t have a guide for AI models. They have to piece together your business information from your regular web pages, which is less accurate.',
    fixHref: '/dashboard/agent-readiness',
    fixLabel: 'Create llms.txt →',
    showFor: 'all',
  },

  llms_txt_valid: {
    scenario: 'Your AI guide is correctly formatted',
    benefit: 'AI models can read your llms.txt guide without errors.',
    whenFailing: 'Your llms.txt file has formatting errors that may cause AI models to skip or misread it.',
    fixHref: '/dashboard/agent-readiness',
    fixLabel: 'Fix llms.txt errors →',
    showFor: 'all',
  },

  robots_allows_ai: {
    scenario: 'AI crawlers are allowed to learn from your website',
    benefit: 'AI crawlers (GPTBot, ClaudeBot, PerplexityBot) can read your website to learn accurate information about your business.',
    whenFailing: 'Your website is blocking AI crawlers. AI models can\'t read your site directly and rely on potentially outdated third-party data instead.',
    fixHref: '/dashboard/bot-activity',
    fixLabel: 'Unblock AI crawlers →',
    showFor: 'all',
  },

  sitemap_present: {
    scenario: 'AI can find all your important pages',
    benefit: 'AI models can discover all the relevant pages on your website — menu, location, services, hours — not just the homepage.',
    whenFailing: 'Without a sitemap, AI crawlers may only read your homepage and miss your menu, location page, and other important content.',
    fixHref: '/dashboard/agent-readiness',
    fixLabel: 'Add a sitemap →',
    showFor: 'all',
  },
};

/**
 * Filter scenarios for the current org's industry.
 * Restaurant scenarios (reservation, menu) are hidden for non-restaurant orgs.
 */
export function getScenariosForIndustry(industryId: string | null): CheckKey[] {
  const isRestaurant = !industryId || industryId === 'restaurant' || industryId.includes('restaurant') || industryId.includes('hookah') || industryId.includes('bar');
  return (Object.keys(SCENARIO_DESCRIPTIONS) as CheckKey[]).filter(key => {
    const { showFor } = SCENARIO_DESCRIPTIONS[key];
    if (!showFor || showFor === 'all') return true;
    if (showFor === 'restaurant') return isRestaurant;
    if (showFor === 'medical_dental') return !isRestaurant;
    return true;
  });
}
```

#### Step 2: `AgentReadinessScenarioCard` — `app/dashboard/agent-readiness/_components/AgentReadinessScenarioCard.tsx`

```tsx
import { SCENARIO_DESCRIPTIONS, type CheckKey } from '@/lib/agent-readiness/scenario-descriptions';
import { CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface AgentReadinessScenarioCardProps {
  checkKey: CheckKey;
  passing: boolean | null;  // null = not yet checked
}

export function AgentReadinessScenarioCard({ checkKey, passing }: AgentReadinessScenarioCardProps) {
  const desc = SCENARIO_DESCRIPTIONS[checkKey];
  if (!desc) return null;

  const isNull = passing === null;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border bg-card p-4',
        passing === true
          ? 'border-emerald-200'
          : passing === false
          ? 'border-red-200'
          : 'border-border',
      )}
      data-testid={`scenario-card-${checkKey}`}
    >
      {/* Status icon */}
      <div className="mt-0.5 shrink-0">
        {isNull ? (
          <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
        ) : passing ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-sm font-medium',
            passing === true ? 'text-emerald-700' : passing === false ? 'text-red-700' : 'text-muted-foreground',
          )}
        >
          {desc.scenario}
        </p>
        <p className={cn('mt-0.5 text-xs', passing === false ? 'text-red-600/80' : 'text-muted-foreground')}>
          {isNull
            ? 'Not yet checked'
            : passing
            ? desc.benefit
            : desc.whenFailing}
        </p>
        {passing === false && (
          <Link
            href={desc.fixHref}
            className="mt-1.5 block text-xs text-primary underline hover:text-primary/80"
            data-testid={`scenario-fix-${checkKey}`}
          >
            {desc.fixLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
```

#### Step 3: `AgentReadinessVerdictPanel` — `app/dashboard/agent-readiness/_components/AgentReadinessVerdictPanel.tsx`

```tsx
interface AgentReadinessVerdictPanelProps {
  passingCount: number;
  totalChecked: number;
  overallScore: number | null;   // If the DB has a composite score
}

export function AgentReadinessVerdictPanel({
  passingCount,
  totalChecked,
  overallScore,
}: AgentReadinessVerdictPanelProps) {
  if (totalChecked === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-5" data-testid="agent-readiness-no-data">
        <p className="text-sm text-muted-foreground">
          Agent readiness analysis is in progress. Check back after your next scan.
        </p>
      </div>
    );
  }

  const pct = totalChecked > 0 ? Math.round((passingCount / totalChecked) * 100) : 0;
  const failingCount = totalChecked - passingCount;
  const isReady   = pct >= 80;
  const isMostly  = pct >= 50 && pct < 80;
  const isNotReady = pct < 50;

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-5 space-y-3',
        isReady ? 'border-emerald-200' : isMostly ? 'border-amber-200' : 'border-red-200',
      )}
      data-testid="agent-readiness-verdict-panel"
    >
      {/* Headline score */}
      <div className="flex items-baseline gap-3">
        <span
          className={cn(
            'text-3xl font-bold tabular-nums',
            isReady ? 'text-emerald-600' : isMostly ? 'text-amber-600' : 'text-red-600',
          )}
          data-testid="agent-readiness-passing-count"
        >
          {passingCount}/{totalChecked}
        </span>
        <span className="text-sm text-muted-foreground">customer questions AI can answer</span>
        <InfoTooltip content={{
          title: 'Agent Readiness',
          what: 'How many common customer questions AI assistants can answer correctly about your business — hours, location, reservations, menu, and more.',
          how: 'Each check represents a real customer interaction. A passing check means AI can handle that interaction accurately. A failing check means AI may give incorrect answers.',
          action: 'Fix the failing checks below to unlock more AI-powered customer interactions.',
        }} />
      </div>

      {/* Verdict */}
      <div
        className={cn(
          'rounded-md border px-4 py-3 text-sm',
          isReady
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : isMostly
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-red-50 border-red-200 text-red-800',
        )}
        data-testid="agent-readiness-verdict-text"
      >
        {isReady && (
          <>
            AI assistants can handle most customer questions about your business automatically.
            {failingCount > 0 && ` Fix the ${failingCount} remaining item${failingCount !== 1 ? 's' : ''} to reach full readiness.`}
          </>
        )}
        {isMostly && (
          <>
            AI assistants can answer {passingCount} of {totalChecked} common customer questions.
            {' '}There are {failingCount} gap{failingCount !== 1 ? 's' : ''} — customers asking about those topics may get wrong or incomplete answers.
          </>
        )}
        {isNotReady && (
          <>
            AI assistants can only answer {passingCount} of {totalChecked} customer questions reliably.
            {' '}This is hurting customer experience — people asking AI about your business are frequently getting incomplete or incorrect answers.
          </>
        )}
      </div>
    </div>
  );
}
```

#### Step 4: Redesign `app/dashboard/agent-readiness/page.tsx`

```typescript
// In server component, after fetching readiness checks:
const industryId = org?.industry ?? null;
const relevantCheckKeys = getScenariosForIndustry(industryId);

// Map DB rows to check results — adapt to actual column names:
const checkResults = relevantCheckKeys.map(key => ({
  key,
  passing: readinessData?.find(r => r.check_name === key)?.passing ?? null,
}));

const passingCount = checkResults.filter(c => c.passing === true).length;
const totalChecked = checkResults.filter(c => c.passing !== null).length;
```

```tsx
// New layout:
<div className="space-y-6 p-6">
  <div>
    <h1 className="text-lg font-semibold text-foreground">Agent Readiness</h1>
    <p className="mt-0.5 text-sm text-muted-foreground">
      Which customer questions AI assistants can answer or actions they can take for your business.
    </p>
  </div>

  {/* FirstVisitTooltip from Sprint E — PRESERVED, NOT MODIFIED */}

  <AgentReadinessVerdictPanel
    passingCount={passingCount}
    totalChecked={totalChecked}
    overallScore={readinessData?.overall_score ?? null}
  />

  {/* Failing scenarios first */}
  {checkResults.filter(c => c.passing === false).length > 0 && (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-red-600">
        Gaps to Fix ({checkResults.filter(c => c.passing === false).length})
      </h2>
      <div className="space-y-3">
        {checkResults
          .filter(c => c.passing === false)
          .map(({ key, passing }) => (
            <AgentReadinessScenarioCard key={key} checkKey={key} passing={passing} />
          ))}
      </div>
    </div>
  )}

  {/* Passing scenarios */}
  {checkResults.filter(c => c.passing === true).length > 0 && (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-emerald-600">
        Ready ({checkResults.filter(c => c.passing === true).length})
      </h2>
      <div className="space-y-3">
        {checkResults
          .filter(c => c.passing === true)
          .map(({ key, passing }) => (
            <AgentReadinessScenarioCard key={key} checkKey={key} passing={passing} />
          ))}
      </div>
    </div>
  )}
</div>
```

---

### Page 3: Cluster Map → "Where Does AI Place You in Local Search?"

**The user's real question:** "When customers search for businesses like mine, does AI include me — and how prominently?"

**Current experience:** A visualization showing the business as a dot among other dots. Labels like "Cluster Centrality: 0.43" and "Semantic Proximity." Users see dots with no interpretation.

**After Sprint J:** A plain-English interpretation panel leads the page. "AI search puts you in the 'hookah lounge and nightlife' category for Alpharetta. You're in the middle of your cluster — visible, but not the top result. Your nearest high-ranked competitor is Lips Hookah Lounge — they're closer to the cluster center." The visualization remains as supporting evidence; the interpretation is the primary content.

#### Step 1: Understand the Cluster Map data shape

```bash
grep -A 30 "CREATE TABLE.*cluster\|sov_cluster\|semantic_cluster" supabase/prod_schema.sql
cat app/dashboard/cluster-map/page.tsx | head -60   # What data does it fetch?
```

The interpretation panel adapts to what data exists. Minimum needed:
- **Cluster name** (e.g., "hookah lounge and nightlife") — for "AI puts you in the X category"
- **Cluster members** — other businesses in the cluster (for "your cluster competitors are X, Y, Z")
- **The org's position/centrality** — whether it's at the cluster center or edge

If only the visualization data (coordinates/nodes) exists but no human-readable cluster name, the panel uses a simpler interpretation: "AI groups you with [N] other businesses in your category."

#### Step 2: `ClusterMapInterpretationPanel` — `app/dashboard/cluster-map/_components/ClusterMapInterpretationPanel.tsx`

```tsx
/**
 * ClusterMapInterpretationPanel
 *
 * Plain-English interpretation of the cluster map data.
 * Answers: "Where does AI place me in local search?"
 *
 * AI_RULES §66: Cluster Map jargon ban —
 * These terms NEVER appear in UI text:
 * "semantic", "embedding", "cluster centrality", "vector distance",
 * "cosine similarity", "latent space", "NLP cluster", "topic model".
 *
 * Replacement vocabulary:
 * "cluster" → "group" or "category"
 * "cluster centrality" → "how prominently AI includes you"
 * "semantic proximity" → "how similar you are to the top competitor"
 * "cluster center" → "the top spot in your group"
 */

interface ClusterMember {
  name: string;
  isOrg: boolean;        // True if this is the current org's business
  centrality?: number;   // Higher = more central/prominent; adjust to actual scale
}

interface ClusterMapInterpretationPanelProps {
  clusterName: string | null;         // e.g., "hookah lounge and nightlife"
  clusterMembers: ClusterMember[];    // All businesses in the cluster
  orgCentrality: number | null;       // 0–1 scale: 1 = cluster center, 0 = edge
  topCompetitorName: string | null;   // Highest-centrality non-org member
  hasData: boolean;
}

export function ClusterMapInterpretationPanel({
  clusterName,
  clusterMembers,
  orgCentrality,
  topCompetitorName,
  hasData,
}: ClusterMapInterpretationPanelProps) {
  if (!hasData || clusterMembers.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-5" data-testid="cluster-no-data">
        <p className="text-sm text-muted-foreground">
          Cluster analysis is in progress. Check back after your next scan.
        </p>
      </div>
    );
  }

  // Position interpretation — adapt thresholds to actual centrality scale
  const isCenter = orgCentrality !== null && orgCentrality >= 0.7;
  const isMid    = orgCentrality !== null && orgCentrality >= 0.4 && orgCentrality < 0.7;
  const isEdge   = orgCentrality !== null && orgCentrality < 0.4;

  const competitorCount = clusterMembers.filter(m => !m.isOrg).length;

  return (
    <div
      className="rounded-lg border border-border bg-card p-5 space-y-4"
      data-testid="cluster-interpretation-panel"
    >
      {/* Where AI puts the business */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-sm font-semibold text-foreground">
            Where AI places your business
          </h2>
          <InfoTooltip content={{
            title: 'AI Search Clusters',
            what: 'AI models group local businesses into categories when answering customer searches. Your cluster is the category AI puts you in — it determines which customer searches find you.',
            how: 'LocalVector analyzes patterns in how AI models group businesses when answering local search queries. The visualization shows your position within your category group.',
            action: 'To appear more prominently, fix hallucination alerts and add more accurate citations — this moves you toward the center of your cluster.',
          }} />
        </div>

        <div
          className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800"
          data-testid="cluster-category-statement"
        >
          AI search puts your business in the{' '}
          <span className="font-semibold">
            {clusterName ?? 'local business'} category
          </span>{' '}
          {competitorCount > 0 && (
            <>
              — alongside{' '}
              <span className="font-semibold">{competitorCount} other</span>
              {' '}local {competitorCount === 1 ? 'business' : 'businesses'}.
            </>
          )}
        </div>
      </div>

      {/* Position within the cluster */}
      {orgCentrality !== null && (
        <div data-testid="cluster-position-statement">
          <p className="text-sm font-medium text-foreground mb-1">Your position in this group</p>
          <div
            className={cn(
              'rounded-md border px-4 py-3 text-sm',
              isCenter
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : isMid
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-red-50 border-red-200 text-red-800',
            )}
          >
            {isCenter && (
              <>
                You're near the top of your group — AI prominently includes your business when customers
                search for businesses in your category.
              </>
            )}
            {isMid && (
              <>
                You're in the middle of your group — AI mentions you in this category, but other
                businesses in the group rank higher.
                {topCompetitorName && (
                  <span className="block mt-1">
                    <span className="font-semibold">{topCompetitorName}</span> currently ranks higher
                    in this group. Fix your hallucination alerts to close the gap.
                  </span>
                )}
              </>
            )}
            {isEdge && (
              <>
                You're near the edge of this group — AI sometimes includes your business in this
                category, but you rank lower than most other businesses here.
                {topCompetitorName && (
                  <span className="block mt-1">
                    <span className="font-semibold">{topCompetitorName}</span> is much more visible
                    in this group. Focus on fixing your hallucination alerts and adding more citations
                    to move toward the center.
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Other businesses in the cluster */}
      {competitorCount > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Other businesses in your category group
          </p>
          <div className="space-y-1" data-testid="cluster-members-list">
            {clusterMembers
              .filter(m => !m.isOrg)
              .slice(0, 5)
              .map((member, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-muted-foreground">{member.name}</span>
                  {member.centrality !== undefined && (
                    <span className={cn(
                      'shrink-0 text-xs',
                      member.centrality > (orgCentrality ?? 0)
                        ? 'text-amber-600 font-medium'
                        : 'text-muted-foreground',
                    )}>
                      {member.centrality > (orgCentrality ?? 0) ? 'Ranks higher' : 'Ranks lower'}
                    </span>
                  )}
                </div>
              ))}
            {competitorCount > 5 && (
              <p className="text-xs text-muted-foreground">
                +{competitorCount - 5} more businesses in this group
              </p>
            )}
          </div>
        </div>
      )}

      {/* What to do */}
      <div className="rounded-md bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
        To move higher in your category group: fix hallucination alerts, add accurate citations,
        and ensure AI crawlers can read your website.{' '}
        <Link href="/dashboard/alerts" className="text-primary underline hover:text-primary/80">
          View open alerts →
        </Link>
      </div>
    </div>
  );
}
```

#### Step 3: Redesign `app/dashboard/cluster-map/page.tsx`

Read the current file completely before modifying. The visualization component stays — the interpretation panel goes above it.

```typescript
// In the server component, extract the interpretation data from existing cluster data:
// Adapt field names to prod_schema.sql:

const orgNode = clusterData?.nodes?.find(n => n.is_org === true);
const competitorNodes = clusterData?.nodes?.filter(n => !n.is_org) ?? [];

const orgCentrality = orgNode?.centrality ?? null;

// Find top competitor (highest centrality, not the org):
const topCompetitor = [...competitorNodes]
  .sort((a, b) => (b.centrality ?? 0) - (a.centrality ?? 0))[0] ?? null;

const clusterMembers: ClusterMember[] = clusterData?.nodes?.map(n => ({
  name: n.name ?? n.business_name ?? 'Unknown business',
  isOrg: n.is_org === true,
  centrality: n.centrality,
})) ?? [];
```

```tsx
// New layout:
<div className="space-y-6 p-6">
  <div>
    <h1 className="text-lg font-semibold text-foreground">Cluster Map</h1>
    <p className="mt-0.5 text-sm text-muted-foreground">
      Where AI search places your business among local competitors.
    </p>
  </div>

  {/* FirstVisitTooltip from Sprint E — PRESERVED, NOT MODIFIED */}

  {/* Interpretation panel — before visualization */}
  <ClusterMapInterpretationPanel
    clusterName={clusterData?.cluster_name ?? null}
    clusterMembers={clusterMembers}
    orgCentrality={orgCentrality}
    topCompetitorName={topCompetitor?.name ?? null}
    hasData={clusterData !== null && clusterMembers.length > 0}
  />

  {/* Existing visualization — now supporting evidence */}
  <div>
    <div className="mb-3 flex items-center gap-2">
      <h2 className="text-sm font-semibold text-foreground">Visual Map</h2>
      <InfoTooltip content={{
        title: 'Reading the map',
        what: 'Each dot is a business. Your business is highlighted. Dots closer to the center of the cluster are more prominently featured in AI search results for this category.',
        how: 'Position is determined by how often AI models mention each business together with the others in this group.',
        action: 'To move your dot toward the center: fix hallucination alerts and add more citations.',
      }} />
    </div>
    {/* Existing cluster map visualization component — unchanged */}
    <ClusterMapVisualization data={clusterData} />
  </div>
</div>
```

**Do not modify the existing visualization component.** Only insert `ClusterMapInterpretationPanel` above it and the `InfoTooltip` on the "Visual Map" heading.

---

## 🧪 Testing

### Test File 1: `src/__tests__/unit/entity-health-components.test.tsx` — 20 tests

```
describe('sub-score-descriptions.ts')
  1.  SUB_SCORE_DESCRIPTIONS contains at least 5 entries
  2.  Every entry has: label, whatItMeans, whenGood, whenBad, fixHref, fixLabel
  3.  isSubScorePassing(75, 100) returns true
  4.  isSubScorePassing(65, 100) returns false (threshold is 70)
  5.  isSubScorePassing(null) returns false
  6.  isSubScorePassing(0.75, 1) returns true (0–1 scale support)
  7.  No entry's label, whenGood, or whenBad contains banned jargon:
      "knowledge graph", "ontological", "entity disambiguation", "semantic", "NLP"

describe('EntityHealthSubScoreCard')
  8.  passing score: renders CheckCircle2 icon (or equivalent green icon)
  9.  failing score: renders XCircle icon (or equivalent red icon)
  10. null score: renders neutral state, "Not yet analyzed" text
  11. passing: whenGood text is shown
  12. failing: whenBad text is shown
  13. failing: fix CTA link renders with fixLabel text
  14. passing: no fix CTA link
  15. data-testid="entity-subscore-{key}" on root element
  16. data-testid="entity-subscore-score-{key}" on score display
  17. data-testid="entity-subscore-fix-{key}" on fix link when failing

describe('EntityHealthVerdictPanel')
  18. overallScore >= 80: emerald styling on verdict text
  19. overallScore 55–79: amber styling on verdict text
  20. overallScore < 55: red styling on verdict text
  21. null score: data-testid="entity-health-no-data" visible
  22. data-testid="entity-health-verdict-panel" on root when score is not null
  23. data-testid="entity-health-verdict-text" on verdict sentence
  24. data-testid="entity-health-overall-score" on score number
```

**Target: 24 tests** (extend beyond the initial 20 — correctness over count)

### Test File 2: `src/__tests__/unit/agent-readiness-components.test.tsx` — 20 tests

```
describe('scenario-descriptions.ts')
  1.  SCENARIO_DESCRIPTIONS contains at least 8 entries
  2.  Every entry has: scenario, benefit, whenFailing, fixHref, fixLabel
  3.  No entry's scenario, benefit, or whenFailing contains banned jargon:
      "JSON-LD", "schema.org", "structured data", "microdata", "agentic", "RDF", "ontology"
  4.  getScenariosForIndustry('restaurant') includes 'reservation_schema_valid'
  5.  getScenariosForIndustry('dental') excludes 'reservation_schema_valid'
  6.  getScenariosForIndustry(null) returns restaurant defaults (includes reservation)

describe('AgentReadinessScenarioCard')
  7.  passing=true: CheckCircle2 icon visible
  8.  passing=false: XCircle icon visible
  9.  passing=null: neutral icon visible (empty circle)
  10. passing=true: benefit text rendered
  11. passing=false: whenFailing text rendered
  12. passing=false: fix link rendered with fixLabel
  13. passing=true: no fix link
  14. data-testid="scenario-card-{key}" on root

describe('AgentReadinessVerdictPanel')
  15. passingCount=8, totalChecked=10: renders "8/10" in verdict
  16. pct >= 80: emerald verdict styling
  17. pct 50–79: amber verdict styling
  18. pct < 50: red verdict styling
  19. totalChecked=0: data-testid="agent-readiness-no-data"
  20. data-testid="agent-readiness-verdict-panel" when data exists
  21. data-testid="agent-readiness-passing-count" on the count display
  22. data-testid="agent-readiness-verdict-text" on verdict sentence
```

**Target: 22 tests**

### Test File 3: `src/__tests__/unit/cluster-map-components.test.tsx` — 15 tests

```
describe('ClusterMapInterpretationPanel')
  1.  hasData=false: data-testid="cluster-no-data" visible
  2.  clusterName provided: "X category" text in category statement
  3.  clusterName=null: "local business category" fallback text
  4.  data-testid="cluster-category-statement" present when hasData=true
  5.  orgCentrality >= 0.7: emerald styling on position statement ("near the top")
  6.  orgCentrality 0.4–0.69: amber styling ("in the middle")
  7.  orgCentrality < 0.4: red styling ("near the edge")
  8.  orgCentrality=null: position statement section not rendered
  9.  topCompetitorName shown in amber/red position statement
  10. data-testid="cluster-position-statement" present when orgCentrality is not null
  11. cluster members list renders up to 5 non-org members
  12. "+N more" text shown when competitorCount > 5
  13. data-testid="cluster-members-list" present
  14. data-testid="cluster-interpretation-panel" on root when hasData=true
  15. No jargon in rendered text: "semantic", "embedding", "centrality" (as user-visible label), "cosine"
```

**Target: 15 tests**

### E2E Test File: `src/__tests__/e2e/sprint-j-smoke.spec.ts` — 20 tests

```
describe('Sprint J — Tier 3 Jargon Retirement E2E')

  Entity Health:
  1.  /dashboard/entity-health: entity-health-verdict-panel OR entity-health-no-data present
  2.  entity-health-overall-score element visible when data exists
  3.  entity-health-verdict-text is plain English (no jargon terms)
  4.  At least one entity-subscore-{key} card visible
  5.  Failing sub-score cards show a fix link
  6.  Sub-score card text does not contain: "ontological", "knowledge graph", "disambiguation"
  7.  FirstVisitTooltip still present (data-testid="first-visit-tooltip-entity-health")

  Agent Readiness:
  8.  /dashboard/agent-readiness: agent-readiness-verdict-panel OR agent-readiness-no-data present
  9.  agent-readiness-passing-count element visible when data exists
  10. agent-readiness-verdict-text is plain English (no jargon)
  11. At least one scenario-card-{key} visible
  12. Failing scenario cards show a fix link
  13. Scenario text does not contain: "JSON-LD", "schema.org", "structured data", "agentic"
  14. FirstVisitTooltip still present (data-testid="first-visit-tooltip-agent-readiness")

  Cluster Map:
  15. /dashboard/cluster-map: cluster-interpretation-panel OR cluster-no-data present
  16. cluster-category-statement visible when data exists
  17. cluster-position-statement visible when orgCentrality is not null
  18. Interpretation panel text does not contain: "semantic", "embedding", "cluster centrality"
  19. Existing visualization component still renders below interpretation panel
  20. FirstVisitTooltip still present (data-testid="first-visit-tooltip-cluster-map")
```

### Run commands

```bash
npx vitest run src/__tests__/unit/entity-health-components.test.tsx
npx vitest run src/__tests__/unit/agent-readiness-components.test.tsx
npx vitest run src/__tests__/unit/cluster-map-components.test.tsx
npx vitest run                                                          # ALL Sprints A–J — 0 regressions
npx playwright test src/__tests__/e2e/sprint-j-smoke.spec.ts
npx tsc --noEmit                                                        # 0 new type errors
```

---

## 📂 Files to Create / Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/entity-health/sub-score-descriptions.ts` | **CREATE** | Translation layer; `SUB_SCORE_DESCRIPTIONS`; `isSubScorePassing()` |
| 2 | `app/dashboard/entity-health/_components/EntityHealthSubScoreCard.tsx` | **CREATE** | Sub-score card with plain-English consequence text |
| 3 | `app/dashboard/entity-health/_components/EntityHealthVerdictPanel.tsx` | **CREATE** | Overall score + verdict sentence |
| 4 | `app/dashboard/entity-health/page.tsx` | **MODIFY** | Add verdict panel; sub-score grid (failing first); retain FirstVisitTooltip |
| 5 | `lib/agent-readiness/scenario-descriptions.ts` | **CREATE** | Scenario translation layer; `SCENARIO_DESCRIPTIONS`; `getScenariosForIndustry()` |
| 6 | `app/dashboard/agent-readiness/_components/AgentReadinessScenarioCard.tsx` | **CREATE** | Scenario card with customer interaction framing |
| 7 | `app/dashboard/agent-readiness/_components/AgentReadinessVerdictPanel.tsx` | **CREATE** | N/M passing + verdict sentence |
| 8 | `app/dashboard/agent-readiness/page.tsx` | **MODIFY** | Add verdict panel; scenario list (failing first); retain FirstVisitTooltip |
| 9 | `app/dashboard/cluster-map/_components/ClusterMapInterpretationPanel.tsx` | **CREATE** | Category statement + position + competitor list |
| 10 | `app/dashboard/cluster-map/page.tsx` | **MODIFY** | Add interpretation panel above visualization; add InfoTooltip to chart heading; retain FirstVisitTooltip |
| 11 | `src/__tests__/unit/entity-health-components.test.tsx` | **CREATE** | 24 tests |
| 12 | `src/__tests__/unit/agent-readiness-components.test.tsx` | **CREATE** | 22 tests |
| 13 | `src/__tests__/unit/cluster-map-components.test.tsx` | **CREATE** | 15 tests |
| 14 | `src/__tests__/e2e/sprint-j-smoke.spec.ts` | **CREATE** | 20 E2E tests |

**No migrations. No API routes. No cron jobs.**

---

## 🧠 Edge Cases to Handle

1. **Sub-score keys that don't exist in `prod_schema.sql`.** `SUB_SCORE_DESCRIPTIONS` must only contain keys that map to actual DB columns. After reading `prod_schema.sql`, remove any entries from the template that don't have corresponding columns. Do not add entries for columns that don't exist. Log a comment in the file for any keys that were present in the template but omitted: `// 'ontological_coverage' omitted — column not present in prod schema`.

2. **Score scale is 0–1, not 0–100.** The template uses 0–100 but the DB might store scores as decimals (0.68 instead of 68). The `maxScore` parameter on `EntityHealthSubScoreCard` handles this — pass `maxScore={1}` when fetching scores in the 0–1 range. Verify the scale from `prod_schema.sql` before implementing.

3. **Agent readiness check names differ from template.** The `CheckKey` type uses assumed check names. After reading `prod_schema.sql` and `seed.sql`, update every key in `SCENARIO_DESCRIPTIONS` to match the actual check names. Any DB check that has no description in the template should be omitted from the UI (don't crash for unknown check keys).

4. **`getScenariosForIndustry()` for industry IDs not explicitly listed.** If `org.industry` is `'hookah_lounge'` (not `'restaurant'`), it should still receive restaurant scenarios including `reservation_schema_valid`. The function uses a broad includes check — test it against the actual industry IDs in the DB. Adjust the `isRestaurant` heuristic to cover all F&B industry IDs.

5. **Cluster Map visualization may be a client component.** If the visualization uses D3, Three.js, or a library that requires client-side rendering, it will be a `'use client'` component. Adding `ClusterMapInterpretationPanel` above it in the server component page is fine — the interpretation panel is a server component. Do not convert the page to client-side just to accommodate the visualization.

6. **Cluster Map may not have `cluster_name`.** If the DB only has coordinates/nodes but no human-readable cluster name, `clusterName` will be null. The `ClusterMapInterpretationPanel` handles this — it says "the local business category" as a fallback. This is acceptable; document in DEVLOG.

7. **Cluster `centrality` may not exist.** If the DB has cluster nodes but no centrality score, `orgCentrality` will be null and the position statement won't render. The panel still shows the category statement and competitor list. This is acceptable.

8. **`FirstVisitTooltip` persistence.** Sprint E built `FirstVisitTooltip` with `lv_visited_pages` localStorage key. Before touching any of the three pages, locate and verify the `<FirstVisitTooltip />` component in the current JSX. The new content (verdict panels, sub-score grids, scenario cards, interpretation panels) goes inside the same `<div>` as the FirstVisitTooltip, after it — not before it, not replacing it.

9. **Entity Health page may show a radar/spider chart.** Some entity health implementations use a radar chart to show sub-scores visually. If it exists, keep it. Sprint J adds the `EntityHealthVerdictPanel` and `EntityHealthSubScoreCard` grid — the radar chart (if present) moves below the new content as supporting evidence, using the same pattern as SOV (Sprint H) and Sentiment (Sprint I).

10. **Agent Readiness and `llms_txt_*` checks.** The `llms_txt_present` and `llms_txt_valid` checks are relatively new concepts. If they don't appear in `seed.sql` or existing DB data, they won't appear in the rendered list (because `checkResults` is derived from actual DB rows). The `SCENARIO_DESCRIPTIONS` template includes them; the rendered list only shows what's in the DB.

11. **`AgentReadinessVerdictPanel` "N/M" format.** The verdict headline says "7/10 customer questions AI can answer" — but if `totalChecked` includes null-result checks, the denominator may be inflated. Use `totalChecked = checkResults.filter(c => c.passing !== null).length` (not the total number of keys in `relevantCheckKeys`) so the fraction reflects only completed checks.

12. **Cluster map members list ordering.** The template sorts by centrality descending within the competitor list. If centrality doesn't exist, sort alphabetically or by whatever ordering the DB provides. Never render the list in an arbitrary/undefined order — always sort deterministically.

---

## 🚫 What NOT to Do

1. **DO NOT show jargon in any user-visible text on any of the three pages.** The E2E tests explicitly check for banned terms. AI_RULES §64 (Entity Health), §65 (Agent Readiness), and §66 (Cluster Map) codify this. Banned terms: "knowledge graph," "ontological," "entity disambiguation," "semantic," "embedding," "JSON-LD," "schema.org," "structured data," "agentic," "RDF," "microdata," "cluster centrality," "cosine similarity," "NLP," "NER."
2. **DO NOT remove or modify the `<FirstVisitTooltip />` from any page.** It was built in Sprint E and is part of the designed information architecture. It explains "what is this page?"; Sprint J explains "what's wrong and what do I do?" These are complementary — both must remain.
3. **DO NOT modify the existing visualization component on the Cluster Map page.** Only add `ClusterMapInterpretationPanel` above it and an `InfoTooltip` on the "Visual Map" heading. The visualization itself is unchanged.
4. **DO NOT add sub-score keys to `SUB_SCORE_DESCRIPTIONS` that don't correspond to actual DB columns.** The server component will try to access `entityHealthData?.[key]` — if the key doesn't exist, it returns undefined, which is fine. But a missing translation entry for a key that exists in the DB will cause a missing card. Match descriptions to actual DB columns.
5. **DO NOT use the word "entity" to describe the business to users.** This is the central jargon to retire. Say "your business," "you," "how AI knows you" — never "your entity."
6. **DO NOT use the word "agent" in the Agent Readiness verdict or scenario descriptions** unless it refers to a specific AI product ("AI agent," "AI assistant"). The preferred phrasing is "AI assistants" or "AI search." The page is called "Agent Readiness" in the nav — that's acceptable — but the descriptions avoid it.
7. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12).
8. **DO NOT modify `middleware.ts`** (AI_RULES §6).
9. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).
10. **DO NOT fake passing status.** If `checkResults` from the DB shows a failing check, it must show as failing in the UI. Do not apply optimistic rendering or assume things are passing until data confirms it.

---

## ✅ Definition of Done

**Entity Health:**
- [ ] `lib/entity-health/sub-score-descriptions.ts` created; `SUB_SCORE_DESCRIPTIONS` keys match actual DB columns
- [ ] `EntityHealthVerdictPanel` renders overall score + color-coded verdict sentence
- [ ] `EntityHealthSubScoreCard` renders plain-English label, `whenGood`/`whenBad` text, fix CTA
- [ ] Failing sub-scores appear before passing in the grid
- [ ] Zero banned jargon terms visible in any user-facing text
- [ ] `FirstVisitTooltip` remains in place, unmodified
- [ ] `entity-health-no-data` state renders when score is null

**Agent Readiness:**
- [ ] `lib/agent-readiness/scenario-descriptions.ts` created; keys match actual DB check names
- [ ] `getScenariosForIndustry()` filters restaurant-specific checks correctly
- [ ] `AgentReadinessVerdictPanel` renders N/M count + color-coded verdict
- [ ] `AgentReadinessScenarioCard` renders scenario (plain English), benefit/consequence text, fix CTA
- [ ] Failing scenarios before passing in the list
- [ ] Zero banned jargon in user-facing text
- [ ] `FirstVisitTooltip` remains in place, unmodified

**Cluster Map:**
- [ ] `ClusterMapInterpretationPanel` renders before visualization
- [ ] Category statement: "AI puts you in the X category" (or fallback when no cluster name)
- [ ] Position statement renders with correct color when `orgCentrality` is not null
- [ ] Competitor list shows up to 5 non-org members, "+N more" when there are more
- [ ] InfoTooltip on "Visual Map" heading
- [ ] Zero banned jargon in user-facing text
- [ ] Existing visualization unchanged
- [ ] `FirstVisitTooltip` remains in place, unmodified

**Tests:**
- [ ] `entity-health-components.test.tsx` — **24 tests passing**
- [ ] `agent-readiness-components.test.tsx` — **22 tests passing**
- [ ] `cluster-map-components.test.tsx` — **15 tests passing**
- [ ] `npx vitest run` — ALL Sprints A–J passing, zero regressions
- [ ] `sprint-j-smoke.spec.ts` — **20 E2E tests passing**
- [ ] `npx tsc --noEmit` — 0 new type errors

---

## 📓 DEVLOG Entry

```markdown
## [DATE] — Sprint J: Jargon Retirement — Entity Health, Agent Readiness, Cluster Map (Completed)

**Entity Health:**
- Sub-score columns found in prod_schema.sql: [list actual columns]
- Columns in template not present in DB (omitted): [list any]
- Score scale: [0–100 / 0–1 — maxScore passed to card]
- Radar/spider chart present: [yes — moved below new content / no]

**Agent Readiness:**
- Check name column: [actual column name in readiness_checks table]
- Check names found in DB: [list]
- Checks in template not present in DB (not rendered): [list any]
- Industry filter: getScenariosForIndustry() tested with [list industry IDs in DB]

**Cluster Map:**
- cluster_name column exists: [yes / no — fallback text used]
- centrality column exists: [yes / no — position statement omitted if no]
- Visualization library: [D3 / Recharts / custom SVG / other]
- Cluster members source: [column/table]

**FirstVisitTooltip:**
- Preserved on all 3 pages: yes
- pageKey values: entity-health, agent-readiness, cluster-map (unchanged from Sprint E)

**Tests:** 61 Vitest + 20 Playwright; 0 regressions Sprints A–J
**Cumulative (A–J):** [N] Vitest + [N] Playwright
```

---

## 🔮 AI_RULES Update

```markdown
## 64. 🧠 Entity Health Jargon Ban (Sprint J)

These terms NEVER appear in user-visible text on the Entity Health page:
"knowledge graph", "ontological", "ontology", "entity disambiguation", "entity resolution",
"semantic", "NLP", "NER", "embedding", "canonical form", "RDF", "entity".

The word "entity" in particular should never be used to describe the business to users.
Replacement: "your business", "you", "how AI understands you".

Sub-score descriptions must always show the *customer consequence* of failing:
BAD: "Knowledge Graph Consistency: 68/100"
GOOD: "AI models sometimes contradict each other about your hours — customers get different answers from different AIs."

## 65. 🤖 Agent Readiness Jargon Ban (Sprint J)

These terms NEVER appear in user-visible text on the Agent Readiness page:
"JSON-LD", "schema.org", "structured data", "microdata", "action schema",
"reservation schema", "agentic", "RDF", "ontology".

Replacement vocabulary:
- "structured data" → "business information formatted for AI"
- "JSON-LD valid" → "AI can read your business information correctly"
- "action schema" → "AI can take actions for customers"
- Scenario framing: write every check as a customer question ("Can AI answer 'Are you open?'"), not a technical requirement.

## 66. 🗺️ Cluster Map Jargon Ban (Sprint J)

These terms NEVER appear in user-visible text on the Cluster Map page:
"semantic", "embedding", "cluster centrality", "vector distance", "cosine similarity",
"latent space", "NLP cluster", "topic model", "node", "edge".

Replacement vocabulary:
- "cluster" (when used alone, jargon-like) → "category group" or "your group"
- "cluster centrality" → "how prominently AI includes you in this group"
- "semantic proximity" → "how similar your position is to the top competitor"
- Interpretation always leads with the business consequence, not the metric.

## 67. 🛡️ FirstVisitTooltip — Preserve Across All Sprints (Sprint J)

The FirstVisitTooltip built in Sprint E (components/ui/FirstVisitTooltip.tsx) is NEVER
modified, moved, or removed by subsequent sprints. It serves the "what is this page?"
function; action surface panels serve the "what's wrong and what do I do?" function.
Both must coexist.

pageKey values (lv_visited_pages array):
- entity-health, agent-readiness, cluster-map, ai-sentiment, bot-activity (Sprint E)
- Do not add new pageKeys without also adding an entry to the lv_visited_pages spec.
```

---

## 📚 Git Commit

```bash
git add -A
git commit -m "Sprint J: Jargon Retirement — Entity Health, Agent Readiness, Cluster Map

Entity Health:
- lib/entity-health/sub-score-descriptions.ts: SUB_SCORE_DESCRIPTIONS ([N] keys), isSubScorePassing()
- EntityHealthSubScoreCard: plain-English labels + customer-consequence text + fix CTAs
- EntityHealthVerdictPanel: overall score + emerald/amber/red verdict sentence + pass/fail counts
- entity-health/page.tsx: verdict panel + failing-first sub-score grid; FirstVisitTooltip preserved

Agent Readiness:
- lib/agent-readiness/scenario-descriptions.ts: SCENARIO_DESCRIPTIONS ([N] checks), getScenariosForIndustry()
- AgentReadinessScenarioCard: customer-interaction framing ('Can AI answer X?') + fix CTAs
- AgentReadinessVerdictPanel: N/M passing count + verdict sentence
- agent-readiness/page.tsx: verdict panel + failing-first scenario list; FirstVisitTooltip preserved

Cluster Map:
- ClusterMapInterpretationPanel: category statement + position verdict + competitor list + action CTA
- cluster-map/page.tsx: interpretation panel above visualization + InfoTooltip on chart; FirstVisitTooltip preserved

Tests: 61 Vitest + 20 Playwright; 0 regressions Sprints A–J
AI_RULES: 64 (entity health jargon ban), 65 (agent readiness jargon ban),
           66 (cluster map jargon ban), 67 (FirstVisitTooltip preservation)

Jargon retired: 'knowledge graph', 'ontological', 'entity disambiguation', 'semantic',
'JSON-LD', 'schema.org', 'structured data', 'cluster centrality', 'embedding', 'NLP'.
These words no longer appear in any user-visible text in the product."

git push origin main
```

---

## 🏁 Sprint Outcome

After Sprint J, the complete action-surface transformation across Sprints G–J is done. Every dashboard page now answers the user's real question in the first 3 seconds.

**Entity Health** — "AI models are confused about your business in 3 areas." Users see plain English: "AI models sometimes contradict each other about your hours" — not "Knowledge Graph Consistency: 68/100." Each failing area has a direct fix link. No jargon anywhere.

**Agent Readiness** — "AI assistants can handle 7 of 10 customer questions about your business automatically." Users see real customer interactions: "Can AI book a reservation for a customer?" (✗ — Fix this →). Not "Reservation Schema: Invalid." The score is meaningful because it describes something the user cares about.

**Cluster Map** — "AI search puts your business in the hookah lounge and nightlife category for Alpharetta. You're in the middle of your group — not the top result, but visible." Users no longer look at a scatter plot of dots with no interpretation. The visualization is still there — it just has context now.

**The full picture — Sprints G through J:**

| Sprint | Pages | Problem Solved |
|--------|-------|----------------|
| G | Main dashboard | Replaced data wall with action dispatch surface |
| H | Alerts, SOV, Citations, Compete | Turned 4 data displays into verdict-first action surfaces |
| I | Revenue Impact, Sentiment, Source Intelligence, Bot Activity | Added interpretation layers and smart defaults |
| J | Entity Health, Agent Readiness, Cluster Map | Retired jargon entirely; replaced with customer-consequence language |

Every page in the product now explains itself. The 20-minute onboarding call is optional.

**What's next:** The three highest-impact items still outstanding from the February 2026 analysis are C1 (42 bare `catch {}` blocks — Sentry is configured but unused), H4 (sidebar navigation grouping — 22 items in one scrollable list), and C2 (Listings sync is a mock for 5 of 6 platforms). These are infrastructure and trust fixes rather than UX redesign — a good Sprint K.
