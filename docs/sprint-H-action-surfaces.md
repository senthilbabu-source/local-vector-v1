# Sprint H — Action Surfaces: Alerts Triage, SOV Verdict, Citation Health & Compete Win/Loss

> **Claude Code Prompt — Bulletproof Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`
> **Prerequisites:** Sprints A–G must be fully merged and all tests passing. Sprint H is front-end only — no new DB tables, no new crons, no new API routes. All data already exists.

---

## 🎯 Objective

Sprint G redesigned the main dashboard from a data display into an action surface. Sprint H applies that same transformation to the four pages users visit most immediately after the dashboard. Each of these pages currently answers a user's real question by burying it inside a chart or table they have to decode themselves. Sprint H flips the model: the answer comes first, the data comes second.

**The four pages and the transformation:**

1. **Alerts → Triage Queue** — Currently: a flat table sorted by date. Users open it and don't know where to start. After Sprint H: three swimlanes ("Fix Now," "In Progress," "Resolved"). Every card headline uses `lib/issue-descriptions.ts` from Sprint G — plain English, not a DB status string. Every card has one obvious next action. The leftmost column demands attention; the others are passive.

2. **Share of Voice → Verdict-First** — Currently: a trend chart with no interpretation. Users watch it go up and down and feel nothing because they don't know if the number is good or bad. After Sprint H: a verdict panel leads the page — "You're mentioned in 34% of AI searches — 12 points below your nearest competitor" — followed by the specific queries they're losing, then the chart as supporting evidence.

3. **Citations → Citation Health** — Currently: a list of source URLs with domain names and scores. Users have no idea which sources are helping vs. hurting them. After Sprint H: every source has a health status (Healthy / Has Wrong Info / Unclaimed / Not Listed). Wrong info is described in plain English. Each unhealthy source has a direct action.

4. **Compete → Win/Loss Verdict** — Currently: side-by-side score numbers with no verdict. Users see "62 vs. 74" and have to infer what that means. After Sprint H: an explicit verdict leads — "Ahead of 2 competitors, behind 1" — losing matchups explain why the competitor is winning, and each has a "Close the gap →" CTA.

**Estimated total implementation time:** 22–28 hours. Alerts is the heaviest (8–10 hours) because the Kanban swimlane is a new structural pattern for this codebase. SOV, Citations, and Compete are 4–6 hours each — they're verdict-panel additions to existing pages, not full rebuilds.

**No new database tables, no migrations, no new cron jobs, no new API routes.** This sprint is entirely front-end.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

Before writing any code, read every file listed. These are the most-visited pages in the product — surprises are expensive.

```
Read docs/AI_RULES.md                         — Rules 42–59 from Sprints A–G now in effect
Read CLAUDE.md                                — Full Sprint A–G implementation inventory
Read MEMORY.md                                — All architecture decisions through Sprint G

--- Sprint G artifacts to REUSE ---
Read lib/issue-descriptions.ts                — describeAlert(), describeTechnicalFinding(), getModelName()
                                                AlertCard MUST import from here — no new alert copy elsewhere
Read components/ui/InfoTooltip.tsx            — Sprint B: reuse on all four pages
Read components/ui/SampleDataBadge.tsx        — Sprint B: reuse where sample data applies
Read lib/sample-data/sample-dashboard-data.ts — Sprint B+G: existing sample data

--- Sprint F artifacts to REUSE ---
Read app/dashboard/_components/CorrectionPanel.tsx
                                              — Sprint F: follow-up status notice (verifying/resolved/still_hallucinating)
                                                Reuse the follow-up UI inside AlertCard for verifying alerts

--- Alerts page ---
Read app/dashboard/alerts/page.tsx            — COMPLETE FILE. Current fetches, current layout, current alert shape
Read app/dashboard/alerts/                    — ls; read every component file currently in this directory
Read supabase/prod_schema.sql                 — hallucination_alerts table: ALL columns, exact status enum values,
                                                severity column (may not exist — derive from issue-descriptions.ts if absent)
Read lib/supabase/database.types.ts           — TypeScript type for hallucination_alerts row

--- Share of Voice page ---
Read app/dashboard/share-of-voice/page.tsx    — COMPLETE FILE. Current fetches, current layout
Read app/dashboard/share-of-voice/            — ls; read every component (SOVTrendChart is here post Sprint G)
Read app/dashboard/share-of-voice/actions.ts  — Server actions: how SOV data is fetched/updated
Read supabase/prod_schema.sql                 — sov_entries table: columns, what per-query data exists,
                                                what competitor data exists — determines verdict panel depth

--- Citations page ---
Read app/dashboard/citations/page.tsx         — COMPLETE FILE. Current fetches, current layout
Read app/dashboard/citations/                 — ls; read every component
Read supabase/prod_schema.sql                 — citations or citation_sources table: columns, accuracy flags,
                                                has_wrong_info boolean, is_claimed field — determines health derivation

--- Compete page ---
Read app/dashboard/compete/page.tsx           — COMPLETE FILE. Current fetches, current layout
Read app/dashboard/compete/                   — ls; read every component including AddCompetitorForm
Read supabase/prod_schema.sql                 — competitor_comparisons or competitors table: columns,
                                                per-category breakdown if any — determines advantage text
Read src/__fixtures__/golden-tenant.ts        — Sample competitor data shapes
```

**Specifically understand before writing code:**

- **`hallucination_alerts` exact status enum values.** The triage swimlane partitions alerts by status. You must use the actual values from `prod_schema.sql`. Common possibilities: `open / verifying / resolved / still_hallucinating / dismissed`. If `dismissed` exists, decide: treat it like resolved (add to Resolved swimlane) or add a fourth "Dismissed" swimlane. Document the decision in DEVLOG.

- **Alert severity column.** The "Fix Now" swimlane should show critical alerts before warning alerts. If `severity` exists as a column in `hallucination_alerts`, use it. If not, derive severity from `describeAlert(alert).severity` — Sprint G's `lib/issue-descriptions.ts` already maps `alert_type → IssueSeverity`. Use that result for sort order and badge color.

- **SOV data granularity.** Before writing the verdict panel, understand what SOV data is available. Run:
  ```bash
  grep -A 30 "CREATE TABLE.*sov_entries\|sov_entries" supabase/prod_schema.sql
  ```
  The minimum needed for the verdict: current SOV %, previous period SOV %, competitors' SOV %. The losing-queries section additionally needs per-query breakdown. If per-query data doesn't exist, omit the losing-queries section entirely — never fabricate data.

- **Citations health fields.** Run:
  ```bash
  grep -A 30 "CREATE TABLE.*citation" supabase/prod_schema.sql
  ```
  The `CitationHealthBadge` derivation depends entirely on what columns exist. If `has_wrong_info` boolean exists → use it. If only `accuracy_score` (numeric) exists → use thresholds. If only a URL exists → health is `unknown` for all. Adapt the `deriveCitationHealth()` function to what's actually in the DB.

- **Compete category breakdown.** If `competitor_comparisons` has only a composite score, `deriveAdvantageText()` will return null for every card — that's acceptable. The Win/Loss badge and score comparison are the primary UI; the advantage text is additive detail. Never invent category data.

- **`date-fns` availability.** `AlertCard` needs relative time ("3 days ago"). Run `cat package.json | grep date-fns`. If not installed, write a small inline helper — do not add a new package dependency.

---

## 🏗️ Architecture — What to Build

---

### Page 1: Alerts → Triage Queue

**The user's real question:** "What do I need to fix and in what order?"

**Current experience:** A table with status columns. Users must read, decode, and self-prioritize.

**After Sprint H:** Three swimlanes. "Fix Now" is the only column that demands action. The answer to "where do I start" is spatial, not cognitive.

#### Step 1: `AlertCard` — `app/dashboard/alerts/_components/AlertCard.tsx`

Used in all three swimlanes. Adapts its CTA based on the alert's status.

```tsx
'use client';

import { describeAlert, getModelName } from '@/lib/issue-descriptions';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
// Import formatDistanceToNow from 'date-fns' if available,
// otherwise use the inline helper at the bottom of this file

/**
 * AlertCard — renders one hallucination alert as a triage card.
 *
 * CRITICAL: headline comes from describeAlert() — lib/issue-descriptions.ts (Sprint G).
 * Never write alert copy directly in this file.
 *
 * AI_RULES §61: AlertCard always uses describeAlert(). No exceptions.
 */

// Adjust these to match the actual status enum values in prod_schema.sql:
type AlertStatus = 'open' | 'verifying' | 'resolved' | 'still_hallucinating';

interface AlertCardProps {
  alert: HallucinationAlertRow;   // Use the actual type from database.types.ts
}

const SEVERITY_STYLES = {
  critical: {
    badge:  'bg-red-100 text-red-700 ring-1 ring-red-200',
    border: 'border-l-4 border-l-red-400',
    label:  'Critical',
  },
  warning: {
    badge:  'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
    border: 'border-l-4 border-l-amber-400',
    label:  'Warning',
  },
  info: {
    badge:  'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
    border: 'border-l-4 border-l-blue-400',
    label:  'Info',
  },
} as const;

export function AlertCard({ alert }: AlertCardProps) {
  // Sprint G: all copy comes from here — no hardcoded strings
  const description = describeAlert({
    alert_type:     alert.alert_type,
    category:       alert.category,
    model:          alert.model,
    detected_value: alert.detected_value,
    expected_value: alert.expected_value,
    description:    alert.description,
  });

  // Use DB severity column if it exists; otherwise fall back to issue-descriptions severity
  const severityKey = (alert.severity as keyof typeof SEVERITY_STYLES) ?? description.severity;
  const styles = SEVERITY_STYLES[severityKey] ?? SEVERITY_STYLES.info;

  // Status — read from the actual column name in database.types.ts
  const status = alert.status as AlertStatus;

  return (
    <div
      className={cn('rounded-lg border border-border bg-card p-4', styles.border)}
      data-testid={`alert-card-${alert.id}`}
    >
      {/* Header row: severity badge + model name + relative time */}
      <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', styles.badge)}>
            {styles.label}
          </span>
          <span className="text-xs text-muted-foreground">{getModelName(alert.model)}</span>
        </div>
        {alert.created_at && (
          <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">
            {timeAgo(alert.created_at)}
          </span>
        )}
      </div>

      {/* Plain-English headline — from describeAlert() */}
      <p className="text-sm font-medium text-foreground leading-snug">
        {description.headline}
      </p>
      {description.subtext && (
        <p className="mt-1 text-xs text-muted-foreground">{description.subtext}</p>
      )}

      {/* Sprint F: follow-up status for verifying alerts */}
      {status === 'verifying' && alert.verifying_since && (
        <div className="mt-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs text-blue-800">
          {alert.follow_up_result === 'resolved' && (
            <span className="text-emerald-700 font-medium">
              ✓ Verified — AI models no longer show this incorrect information
            </span>
          )}
          {alert.follow_up_result === 'still_hallucinating' && (
            <span className="text-amber-700">
              Still showing incorrect info after correction — consider resubmitting
            </span>
          )}
          {alert.follow_up_result === null && (
            <span>
              ⏳ Verification in progress — will recheck in ~{daysUntilFollowUp(alert.verifying_since)} days
            </span>
          )}
        </div>
      )}

      {/* Actions — one per status */}
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        {status === 'open' && (
          <>
            <Link
              href={`/dashboard/alerts/${alert.id}`}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              data-testid={`alert-fix-${alert.id}`}
            >
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Fix with AI
            </Link>
            <DismissAlertButton alertId={alert.id} />
          </>
        )}
        {status === 'resolved' && (
          <span className="text-xs font-medium text-emerald-600">
            ✓ Fixed — AI models no longer show this incorrect information
          </span>
        )}
        {status === 'still_hallucinating' && (
          <Link
            href={`/dashboard/alerts/${alert.id}`}
            className="text-xs text-primary underline hover:text-primary/80"
          >
            Try again →
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysUntilFollowUp(verifyingSince: string): number {
  const daysSince = Math.floor(
    (Date.now() - new Date(verifyingSince).getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.max(0, 14 - daysSince);
}

function timeAgo(dateStr: string): string {
  // Use formatDistanceToNow from date-fns if installed:
  // return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  //
  // Fallback if date-fns not available:
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
```

**`DismissAlertButton`** — find the existing dismiss server action in `alerts/page.tsx` or its actions file. Wire the button to it. Do not create a new server action if one already exists.

#### Step 2: `TriageSwimlane` — `app/dashboard/alerts/_components/TriageSwimlane.tsx`

```tsx
interface TriageSwimlaneProps {
  title: string;
  count: number;
  alerts: HallucinationAlertRow[];
  emptyMessage: string;
  'data-testid': string;
}

export function TriageSwimlane({
  title, count, alerts, emptyMessage, 'data-testid': testId,
}: TriageSwimlaneProps) {
  return (
    <div className="flex flex-col gap-3" data-testid={testId}>
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
          {count}
        </span>
      </div>

      {alerts.length === 0 ? (
        <div
          className="rounded-lg border border-dashed border-border p-4 text-center"
          data-testid={`${testId}-empty`}
        >
          <p className="text-xs text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
}
```

#### Step 3: `AlertsPageHeader` — `app/dashboard/alerts/_components/AlertsPageHeader.tsx`

```tsx
interface AlertsPageHeaderProps {
  openCount: number;
  resolvedCount: number;
}

export function AlertsPageHeader({ openCount, resolvedCount }: AlertsPageHeaderProps) {
  return (
    <div>
      <h1 className="text-lg font-semibold text-foreground">AI Hallucination Alerts</h1>
      {openCount === 0 ? (
        <p className="mt-1 text-sm text-emerald-600 font-medium" data-testid="alerts-verdict-clean">
          ✓ No wrong facts detected — AI models are describing your business correctly.
          {resolvedCount > 0 && (
            <span className="ml-1 text-muted-foreground font-normal">
              {resolvedCount} issue{resolvedCount !== 1 ? 's' : ''} previously fixed.
            </span>
          )}
        </p>
      ) : (
        <p className="mt-1 text-sm text-foreground" data-testid="alerts-verdict-issues">
          <span className="font-semibold text-red-600">
            {openCount} wrong fact{openCount !== 1 ? 's' : ''}
          </span>
          {' '}detected across AI models.{' '}
          <span className="text-muted-foreground">
            Fix these to stop customers receiving incorrect information.
          </span>
        </p>
      )}
    </div>
  );
}
```

#### Step 4: Redesign `app/dashboard/alerts/page.tsx`

Read the full existing file before modifying. Retain all existing data fetches — extend them rather than replace them.

```typescript
// Add ordering to the existing fetch (adapt to actual column names):
const { data: allAlerts } = await supabase
  .from('hallucination_alerts')
  .select('*')
  .eq('org_id', orgId)
  .order('created_at', { ascending: false });

// Partition into swimlanes — adjust status values to match prod_schema.sql
const fixNowAlerts     = (allAlerts ?? []).filter(a => a.status === 'open');
const inProgressAlerts = (allAlerts ?? []).filter(a => a.status === 'verifying');
const resolvedAlerts   = (allAlerts ?? []).filter(
  a => a.status === 'resolved' || a.status === 'still_hallucinating'
).slice(0, 10);  // cap at 10 — oldest resolved history belongs on a dedicated history page
```

```tsx
// New page layout — replaces the existing table layout:
<div className="space-y-6 p-6">
  <AlertsPageHeader
    openCount={fixNowAlerts.length}
    resolvedCount={resolvedAlerts.length}
  />

  <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" data-testid="triage-grid">
    <TriageSwimlane
      title="Fix Now"
      count={fixNowAlerts.length}
      alerts={fixNowAlerts}
      emptyMessage="✓ No open issues — you're all clear"
      data-testid="swimlane-fix-now"
    />
    <TriageSwimlane
      title="In Progress"
      count={inProgressAlerts.length}
      alerts={inProgressAlerts}
      emptyMessage="Corrections you submit appear here while being verified"
      data-testid="swimlane-in-progress"
    />
    <TriageSwimlane
      title="Resolved"
      count={resolvedAlerts.length}
      alerts={resolvedAlerts}
      emptyMessage="Fixed issues will appear here"
      data-testid="swimlane-resolved"
    />
  </div>
</div>
```

---

### Page 2: Share of Voice → Verdict-First

**The user's real question:** "Am I winning or losing in AI search vs. my competitors?"

**Current experience:** A trend chart. No verdict. Users watch a line go up and down and feel nothing.

**After Sprint H:** Verdict panel first. Chart second. The chart is supporting evidence, not the main event.

#### Step 1: Understand the SOV data available

```bash
grep -A 30 "sov_entries\|share_of_voice" supabase/prod_schema.sql
grep "sov\|share_of_voice" app/dashboard/share-of-voice/page.tsx | head -20
```

The verdict panel has two tiers:
- **Tier 1 (always shown):** Overall SOV % + delta + nearest competitor gap
- **Tier 2 (shown when data exists):** Per-query breakdown — "the queries where you're losing"

If per-query data doesn't exist in `sov_entries`, skip Tier 2. Document this in DEVLOG.

In `share-of-voice/page.tsx`, add these fetches alongside the existing ones:

```typescript
// Current-period and previous-period SOV — adapt column names to match schema
const { data: sovCurrent } = await supabase
  .from('sov_entries')
  .select('mention_pct, total_queries, week_start')
  .eq('org_id', orgId)
  .is('competitor_name', null)            // org's own rows, not competitor rows
  .order('week_start', { ascending: false })
  .limit(2);                               // current + previous week

const currentPct  = sovCurrent?.[0]?.mention_pct ?? null;
const previousPct = sovCurrent?.[1]?.mention_pct ?? null;

// Competitor SOV — adapt to actual schema
const { data: competitorSov } = await supabase
  .from('sov_entries')
  .select('competitor_name, mention_pct')
  .eq('org_id', orgId)
  .not('competitor_name', 'is', null)
  .order('mention_pct', { ascending: false })
  .limit(1);                               // nearest (highest) competitor

const nearestCompetitor = competitorSov?.[0]
  ? { name: competitorSov[0].competitor_name, pct: competitorSov[0].mention_pct }
  : null;

// Per-query breakdown — only if this column exists in sov_entries
// If it doesn't exist, set losingQueries = [] and skip Tier 2 in the verdict panel
const { data: queryBreakdown } = await supabase
  .from('sov_entries')
  .select('query, org_pct, top_competitor_name')   // adapt column names
  .eq('org_id', orgId)
  .not('query', 'is', null)
  .order('org_pct', { ascending: true })           // lowest SOV first = losing queries
  .limit(4);

const losingQueries = (queryBreakdown ?? []).filter(q => q.org_pct < 50);
```

#### Step 2: `SOVVerdictPanel` — `app/dashboard/share-of-voice/_components/SOVVerdictPanel.tsx`

```tsx
interface SOVVerdictPanelProps {
  currentPct: number | null;
  previousPct: number | null;
  nearestCompetitor: { name: string; pct: number } | null;
  losingQueries: { query: string; orgPct: number; topCompetitor: string | null }[];
  orgName: string;
}

export function SOVVerdictPanel({
  currentPct,
  previousPct,
  nearestCompetitor,
  losingQueries,
  orgName,
}: SOVVerdictPanelProps) {
  if (currentPct === null) {
    return (
      <div className="rounded-lg border border-border bg-card p-5" data-testid="sov-verdict-no-data">
        <p className="text-sm text-muted-foreground">
          Share of Voice data is collecting. Check back after Sunday's scan.
        </p>
      </div>
    );
  }

  const delta = previousPct !== null ? currentPct - previousPct : null;
  const isWinning = nearestCompetitor ? currentPct >= nearestCompetitor.pct : true;
  const gap = nearestCompetitor ? Math.abs(currentPct - nearestCompetitor.pct) : null;

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4" data-testid="sov-verdict-panel">

      {/* Primary verdict: score + delta */}
      <div>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold tabular-nums text-foreground">
            {currentPct.toFixed(0)}%
          </span>
          {delta !== null && (
            <span className={cn(
              'text-sm font-medium',
              delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-500' : 'text-muted-foreground',
            )}>
              {delta > 0 ? `+${delta.toFixed(0)}` : delta.toFixed(0)} pts this week
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          of AI searches mention <span className="font-medium text-foreground">{orgName}</span>
        </p>
      </div>

      {/* Competitor context */}
      {nearestCompetitor && (
        <div
          className={cn(
            'rounded-md border px-4 py-3 text-sm',
            isWinning
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800',
          )}
          data-testid="sov-competitor-verdict"
        >
          {isWinning ? (
            <>
              You're ahead of{' '}
              <span className="font-semibold">{nearestCompetitor.name}</span>
              {gap !== null && ` by ${gap.toFixed(0)} points`}.
            </>
          ) : (
            <>
              <span className="font-semibold">{nearestCompetitor.name}</span>
              {' '}is ahead of you by{' '}
              <span className="font-semibold">{gap?.toFixed(0)} points</span>.
              {gap !== null && gap > 10 && (
                <span className="block mt-1 text-xs opacity-80">
                  A gap this wide typically closes by fixing hallucination alerts and adding more citations.
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* Losing queries — Tier 2, only when data exists */}
      {losingQueries.length > 0 && (
        <div data-testid="sov-losing-queries">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Queries where you're losing
          </p>
          <div className="space-y-2">
            {losingQueries.map((q, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 text-sm"
                data-testid={`sov-losing-query-${i}`}
              >
                <span className="truncate text-foreground">"{q.query}"</span>
                <span className="shrink-0 tabular-nums text-sm font-medium text-red-500">
                  {q.orgPct.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Fix hallucination alerts and add citations for these topics to improve your ranking.
          </p>
        </div>
      )}
    </div>
  );
}
```

#### Step 3: Modify `app/dashboard/share-of-voice/page.tsx` layout

Add `<SOVVerdictPanel />` above `<SOVTrendChart />`. The chart stays — it just moves to second position.

```tsx
<div className="space-y-6 p-6">
  <div>
    <h1 className="text-lg font-semibold text-foreground">Share of Voice</h1>
    <p className="mt-0.5 text-sm text-muted-foreground">
      How often AI models mention your business when customers search for businesses like yours.
    </p>
  </div>

  {/* Verdict panel — BEFORE the chart */}
  <SOVVerdictPanel
    currentPct={currentPct}
    previousPct={previousPct}
    nearestCompetitor={nearestCompetitor}
    losingQueries={losingQueries}
    orgName={org?.name ?? 'your business'}
  />

  {/* SOVTrendChart — now supporting evidence, not the primary focus */}
  <div>
    <div className="mb-3 flex items-center gap-2">
      <h2 className="text-sm font-semibold text-foreground">Weekly Trend</h2>
      <InfoTooltip content={{
        title: 'Share of Voice Trend',
        what: 'How your AI mention rate has changed week-over-week across all tracked queries.',
        how: 'The same queries are used every week so changes reflect real AI behavior shifts, not query changes.',
        action: 'An upward trend means your corrections and new citations are working.',
      }} />
    </div>
    <SOVTrendChart data={sovTrendData} />
  </div>

  {/* Retain any existing competitor breakdown table below */}
</div>
```

---

### Page 3: Citations → Citation Health

**The user's real question:** "Which sources are helping me vs. hurting me — and what do I do about each?"

**Current experience:** A flat list of domain names and scores. No health context. No actions.

**After Sprint H:** Sources grouped by health status. Wrong info at the top with specific wrong facts described in plain English. Each unhealthy source has a direct action.

#### Step 1: `CitationHealthBadge` — `app/dashboard/citations/_components/CitationHealthBadge.tsx`

```tsx
export type CitationHealth = 'healthy' | 'wrong_info' | 'unclaimed' | 'missing' | 'unknown';

const HEALTH_CONFIG: Record<CitationHealth, { label: string; className: string; icon: string }> = {
  healthy:    { label: 'Healthy',         className: 'bg-emerald-100 text-emerald-700 ring-emerald-200', icon: '✓' },
  wrong_info: { label: 'Has Wrong Info',  className: 'bg-red-100 text-red-700 ring-red-200',             icon: '✗' },
  unclaimed:  { label: 'Unclaimed',       className: 'bg-amber-100 text-amber-700 ring-amber-200',       icon: '!' },
  missing:    { label: 'Not Listed',      className: 'bg-slate-100 text-slate-600 ring-slate-200',       icon: '−' },
  unknown:    { label: 'Not Yet Checked', className: 'bg-slate-100 text-slate-500 ring-slate-200',       icon: '?' },
};

export function CitationHealthBadge({ health }: { health: CitationHealth }) {
  const { label, className, icon } = HEALTH_CONFIG[health];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1', className)}>
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}
```

#### Step 2: `CitationSourceRow` — `app/dashboard/citations/_components/CitationSourceRow.tsx`

```tsx
interface CitationSourceRowProps {
  source: CitationSourceRow;   // Use actual TypeScript type from database.types.ts
  health: CitationHealth;
}

export function CitationSourceRow({ source, health }: CitationSourceRowProps) {
  // Plain-English wrong info description — only for wrong_info health
  const wrongInfoText =
    source.detected_value && source.expected_value
      ? `Shows "${source.detected_value}" — should be "${source.expected_value}"`
      : source.has_wrong_info
      ? 'Contains incorrect information about your business'
      : null;

  // One action per unhealthy status
  const action: { label: string; href: string; external?: boolean } | null =
    health === 'wrong_info' ? { label: 'Fix this →', href: '/dashboard/alerts' }
    : health === 'unclaimed' ? { label: 'Claim listing →', href: source.claim_url ?? source.url ?? '#', external: true }
    : health === 'missing'   ? { label: 'Add listing →',  href: source.url ?? '#', external: true }
    : null;

  return (
    <div
      className="flex items-start justify-between gap-4 border-b border-border/50 py-3 last:border-0"
      data-testid={`citation-row-${source.id}`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {/* Favicon */}
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
              href={source.url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-sm font-medium text-foreground hover:underline"
            >
              {source.domain ?? source.url}
            </a>
            <CitationHealthBadge health={health} />
          </div>
          {wrongInfoText && (
            <p className="mt-0.5 text-xs text-red-600">{wrongInfoText}</p>
          )}
          {health === 'healthy' && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Accurate information — this source is helping your AI visibility
            </p>
          )}
          {health === 'unclaimed' && (
            <p className="mt-0.5 text-xs text-amber-700">
              Claiming this listing gives you control over what AI models learn from it
            </p>
          )}
          {health === 'missing' && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Adding a listing here increases the number of sources AI uses to learn about you
            </p>
          )}
        </div>
      </div>

      {action && (
        <a
          href={action.href}
          target={action.external ? '_blank' : undefined}
          rel={action.external ? 'noopener noreferrer' : undefined}
          className="shrink-0 whitespace-nowrap text-xs text-primary underline hover:text-primary/80"
          data-testid={`citation-action-${source.id}`}
        >
          {action.label}
        </a>
      )}
    </div>
  );
}
```

#### Step 3: `CitationsSummaryPanel` — `app/dashboard/citations/_components/CitationsSummaryPanel.tsx`

```tsx
interface CitationsSummaryPanelProps {
  total: number;
  healthy: number;
  wrongInfo: number;
  unclaimed: number;
}

export function CitationsSummaryPanel({ total, healthy, wrongInfo, unclaimed }: CitationsSummaryPanelProps) {
  const problems = wrongInfo + unclaimed;

  return (
    <div className="rounded-lg border border-border bg-card p-5" data-testid="citations-summary-panel">
      {/* Total count + tooltip */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-2xl font-bold tabular-nums">{total}</span>
        <span className="text-sm text-muted-foreground">citation sources</span>
        <InfoTooltip content={{
          title: 'What are citations?',
          what: 'Citations are websites that mention your business. AI models use them to learn about you.',
          how: 'More accurate citations = higher AI visibility. Wrong citations = AI hallucinations.',
          action: 'Fix wrong info first. Then claim unclaimed listings to expand your reach.',
        }} />
      </div>

      {/* Three-count health grid */}
      <div className="grid grid-cols-3 gap-3 text-center mb-4">
        <div className="rounded-md bg-emerald-50 px-3 py-2" data-testid="citations-count-healthy">
          <p className="text-lg font-bold text-emerald-700">{healthy}</p>
          <p className="text-[10px] text-emerald-600">Healthy</p>
        </div>
        <div
          className={cn('rounded-md px-3 py-2', wrongInfo > 0 ? 'bg-red-50' : 'bg-muted')}
          data-testid="citations-count-wrong"
        >
          <p className={cn('text-lg font-bold', wrongInfo > 0 ? 'text-red-600' : 'text-muted-foreground')}>
            {wrongInfo}
          </p>
          <p className={cn('text-[10px]', wrongInfo > 0 ? 'text-red-500' : 'text-muted-foreground')}>
            Has Wrong Info
          </p>
        </div>
        <div
          className={cn('rounded-md px-3 py-2', unclaimed > 0 ? 'bg-amber-50' : 'bg-muted')}
          data-testid="citations-count-unclaimed"
        >
          <p className={cn('text-lg font-bold', unclaimed > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
            {unclaimed}
          </p>
          <p className={cn('text-[10px]', unclaimed > 0 ? 'text-amber-500' : 'text-muted-foreground')}>
            Unclaimed
          </p>
        </div>
      </div>

      {/* Plain-English verdict */}
      {problems === 0 ? (
        <p className="text-sm font-medium text-emerald-600">
          ✓ All citation sources look healthy — AI models are getting accurate information about you.
        </p>
      ) : (
        <p className="text-sm text-foreground">
          {wrongInfo > 0 && (
            <span className="font-semibold text-red-600">
              {wrongInfo} source{wrongInfo !== 1 ? 's' : ''} contain wrong information
            </span>
          )}
          {wrongInfo > 0 && unclaimed > 0 && <span className="text-muted-foreground"> and </span>}
          {unclaimed > 0 && (
            <span className="font-semibold text-amber-700">
              {unclaimed} unclaimed listing{unclaimed !== 1 ? 's' : ''}
            </span>
          )}
          <span className="text-muted-foreground">
            {' '}— fix these to improve how AI models describe your business.
          </span>
        </p>
      )}
    </div>
  );
}
```

#### Step 4: `deriveCitationHealth()` — inline function in `citations/page.tsx`

**Read `prod_schema.sql` before writing this function.** Adapt the conditions to the actual column names.

```typescript
// In citations/page.tsx server component:
function deriveCitationHealth(citation: CitationSourceRow): CitationHealth {
  // Adapt these conditions to actual columns in prod_schema.sql:
  if (citation.has_wrong_info === true) return 'wrong_info';
  if (citation.is_claimed === false)    return 'unclaimed';
  if (citation.status === 'missing')   return 'missing';
  // Accuracy score threshold — adjust if column name or scale differs:
  if (typeof citation.accuracy_score === 'number' && citation.accuracy_score >= 0.8) return 'healthy';
  return 'unknown';
}
```

#### Step 5: Redesign `app/dashboard/citations/page.tsx` layout

```tsx
// Partition by health after fetching:
const wrongInfoCitations = citations.filter(c => deriveCitationHealth(c) === 'wrong_info');
const unclaimedCitations = citations.filter(c => deriveCitationHealth(c) === 'unclaimed');
const healthyCitations   = citations.filter(c => deriveCitationHealth(c) === 'healthy');
const otherCitations     = citations.filter(c => !['wrong_info','unclaimed','healthy'].includes(deriveCitationHealth(c)));

// New layout:
<div className="space-y-6 p-6">
  <div>
    <h1 className="text-lg font-semibold text-foreground">Citations</h1>
    <p className="mt-0.5 text-sm text-muted-foreground">
      The websites that teach AI models about your business.
    </p>
  </div>

  <CitationsSummaryPanel
    total={citations.length}
    healthy={healthyCitations.length}
    wrongInfo={wrongInfoCitations.length}
    unclaimed={unclaimedCitations.length}
  />

  {/* Wrong info first — most urgent */}
  {wrongInfoCitations.length > 0 && (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-red-600">
        ✗ Has Wrong Info — Fix These First ({wrongInfoCitations.length})
      </h2>
      <div className="divide-y divide-border/50 rounded-lg border border-red-200 bg-card">
        {wrongInfoCitations.map(c => (
          <CitationSourceRow key={c.id} source={c} health="wrong_info" />
        ))}
      </div>
    </section>
  )}

  {/* Unclaimed second */}
  {unclaimedCitations.length > 0 && (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-amber-600">
        ! Unclaimed ({unclaimedCitations.length})
      </h2>
      <div className="divide-y divide-border/50 rounded-lg border border-amber-200 bg-card">
        {unclaimedCitations.map(c => (
          <CitationSourceRow key={c.id} source={c} health="unclaimed" />
        ))}
      </div>
    </section>
  )}

  {/* Healthy last — reassurance */}
  {healthyCitations.length > 0 && (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-emerald-600">
        ✓ Healthy ({healthyCitations.length})
      </h2>
      <div className="divide-y divide-border/50 rounded-lg border border-emerald-200 bg-card">
        {healthyCitations.map(c => (
          <CitationSourceRow key={c.id} source={c} health="healthy" />
        ))}
      </div>
    </section>
  )}
</div>
```

---

### Page 4: Compete → Win/Loss Verdict

**The user's real question:** "Am I winning or losing against my competitors — and why?"

**Current experience:** Side-by-side scores. No verdict. No explanation. No next step.

**After Sprint H:** Explicit Win/Loss verdict leads. Losing matchups have an explanation and a CTA. Winning matchups get a green badge. The scoreboard is still there — it just comes with a verdict now.

#### Step 1: `CompeteVerdictPanel` — `app/dashboard/compete/_components/CompeteVerdictPanel.tsx`

```tsx
interface CompeteVerdictPanelProps {
  winCount: number;
  lossCount: number;
  totalCompetitors: number;
}

export function CompeteVerdictPanel({ winCount, lossCount, totalCompetitors }: CompeteVerdictPanelProps) {
  if (totalCompetitors === 0) {
    return (
      <div
        className="rounded-lg border border-dashed border-border p-5"
        data-testid="compete-no-competitors"
      >
        <p className="text-sm text-muted-foreground">
          No competitors added yet.{' '}
          <span className="font-medium text-foreground">Add a competitor below</span>
          {' '}to see how you compare in AI search results.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5" data-testid="compete-verdict-panel">
      <p className="text-sm text-foreground">
        {winCount > 0 && (
          <span className="font-semibold text-emerald-600">
            Ahead of {winCount} competitor{winCount !== 1 ? 's' : ''}
          </span>
        )}
        {winCount > 0 && lossCount > 0 && (
          <span className="text-muted-foreground"> · </span>
        )}
        {lossCount > 0 && (
          <span className="font-semibold text-amber-600">
            Behind {lossCount} competitor{lossCount !== 1 ? 's' : ''}
          </span>
        )}
        {lossCount > 0 && (
          <span className="ml-2 text-muted-foreground text-xs">
            — fix your hallucination alerts and add more citations to close the gap
          </span>
        )}
        {winCount === totalCompetitors && (
          <span className="ml-2 text-emerald-600">— you're leading across the board</span>
        )}
      </p>
    </div>
  );
}
```

#### Step 2: `CompetitorCard` — `app/dashboard/compete/_components/CompetitorCard.tsx`

```tsx
interface CompetitorCardProps {
  competitor: CompetitorComparisonRow;  // Use actual TypeScript type
  orgScore: number;
  orgName: string;
}

export function CompetitorCard({ competitor, orgScore, orgName }: CompetitorCardProps) {
  const gap = orgScore - competitor.score;
  const isWinning = gap >= 0;
  const gapAbs = Math.abs(gap);

  // Build advantage explanation from available columns — adapt to actual schema
  const advantageText = buildAdvantageText(competitor, isWinning);

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-5',
        isWinning ? 'border-emerald-200' : 'border-amber-200',
      )}
      data-testid={`competitor-card-${competitor.id}`}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="truncate text-sm font-semibold text-foreground">{competitor.name}</h3>
        <span className={cn(
          'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold',
          isWinning ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
        )}>
          {isWinning ? `+${gapAbs}` : `−${gapAbs}`}
        </span>
      </div>

      {/* Score comparison */}
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="text-center">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">You</p>
          <p className={cn('text-2xl font-bold tabular-nums', isWinning ? 'text-emerald-600' : 'text-foreground')}>
            {orgScore}
          </p>
        </div>
        <span className="text-sm text-muted-foreground">vs.</span>
        <div className="text-center">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate max-w-[80px]">
            {competitor.name}
          </p>
          <p className={cn('text-2xl font-bold tabular-nums', !isWinning ? 'text-amber-600' : 'text-muted-foreground')}>
            {competitor.score}
          </p>
        </div>
      </div>

      {/* Advantage text — only when data supports it */}
      {advantageText && (
        <p className="mb-3 text-xs text-muted-foreground">{advantageText}</p>
      )}

      {/* CTA — losing matchups only */}
      {!isWinning && (
        <Link
          href="/dashboard/alerts"
          className="text-xs text-primary underline hover:text-primary/80"
          data-testid={`compete-close-gap-${competitor.id}`}
        >
          Close the gap →
        </Link>
      )}
    </div>
  );
}

function buildAdvantageText(competitor: CompetitorComparisonRow, orgIsWinning: boolean): string | null {
  // Build from available columns in prod_schema.sql — adapt to actual fields.
  // If no per-category breakdown exists, return null — the score comparison is enough.
  const parts: string[] = [];

  // Example column checks — adapt to actual schema:
  if (typeof competitor.citation_count !== 'undefined' && typeof competitor.org_citation_count !== 'undefined') {
    const diff = competitor.citation_count - competitor.org_citation_count;
    if (Math.abs(diff) >= 3) {
      parts.push(diff > 0
        ? `${diff}× more citations`
        : `you have ${Math.abs(diff)}× more citations`
      );
    }
  }

  if (competitor.hallucination_count === 0 && !orgIsWinning) {
    parts.push('no AI hallucinations detected for them');
  }

  if (parts.length === 0) return null;
  return (orgIsWinning ? 'Your advantage: ' : 'Their advantage: ') + parts.join(', ') + '.';
}
```

#### Step 3: Redesign `app/dashboard/compete/page.tsx` layout

Read the existing file completely before modifying. The `AddCompetitorForm` stays exactly where it is — only the surrounding layout changes.

```typescript
// Partition after existing fetches:
const orgScore       = scores?.realityScore ?? 0;
const winningMatchups = (comparisons ?? []).filter(c => orgScore >= c.score);
const losingMatchups  = (comparisons ?? []).filter(c => orgScore  < c.score);
```

```tsx
<div className="space-y-6 p-6">
  <div className="flex items-start justify-between gap-4">
    <div>
      <h1 className="text-lg font-semibold text-foreground">Competitive Analysis</h1>
      <p className="mt-0.5 text-sm text-muted-foreground">
        How AI models compare your business to local competitors.
      </p>
    </div>
    {/* Keep existing AddCompetitorForm / Add Competitor button exactly as-is */}
  </div>

  {/* Verdict — first thing after the header */}
  <CompeteVerdictPanel
    winCount={winningMatchups.length}
    lossCount={losingMatchups.length}
    totalCompetitors={(comparisons ?? []).length}
  />

  {/* Losing matchups — shown first, most urgent */}
  {losingMatchups.length > 0 && (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-amber-600">
        Falling Behind ({losingMatchups.length})
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {losingMatchups.map(c => (
          <CompetitorCard key={c.id} competitor={c} orgScore={orgScore} orgName={org.name} />
        ))}
      </div>
    </section>
  )}

  {/* Winning matchups */}
  {winningMatchups.length > 0 && (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-emerald-600">
        Ahead ({winningMatchups.length})
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {winningMatchups.map(c => (
          <CompetitorCard key={c.id} competitor={c} orgScore={orgScore} orgName={org.name} />
        ))}
      </div>
    </section>
  )}

  {/* Keep AddCompetitorForm in its current position below the cards */}
</div>
```

---

## 🧪 Testing

### Test File 1: `src/__tests__/unit/alert-card.test.tsx` — 14 tests

```
describe('AlertCard')
  Headline:
  1.  headline comes from describeAlert() — rendered text is NOT a raw alert_type string like "wrong_hours"
  2.  model displayed via getModelName() — NOT raw identifier like "gpt-4o"

  Severity:
  3.  critical severity: red badge labeled "Critical"
  4.  warning severity: amber badge labeled "Warning"
  5.  critical applies border-l-red-400 CSS class
  6.  warning applies border-l-amber-400 CSS class

  Actions by status:
  7.  status=open: "Fix with AI" button present
  8.  status=open: "Dismiss" button present
  9.  Fix with AI links to /dashboard/alerts/{alert.id}
  10. status=verifying: "Verification in progress" text visible (no Fix button)
  11. status=resolved: "✓ Fixed" text visible (no Fix button)
  12. status=still_hallucinating: "Try again →" link visible

  Meta:
  13. created_at renders as relative time string
  14. data-testid="alert-card-{id}" on root element
```

### Test File 2: `src/__tests__/unit/triage-swimlane.test.tsx` — 5 tests

```
describe('TriageSwimlane')
  1.  renders title and count badge
  2.  renders one AlertCard per item in alerts array
  3.  renders empty state when alerts array is empty
  4.  empty state message matches emptyMessage prop
  5.  data-testid from prop applied to root; "{testId}-empty" on empty state
```

### Test File 3: `src/__tests__/unit/sov-verdict-panel.test.tsx` — 10 tests

```
describe('SOVVerdictPanel')
  1.  renders currentPct as large number when not null
  2.  positive delta shown in emerald (currentPct > previousPct)
  3.  negative delta shown in red (currentPct < previousPct)
  4.  no delta shown when previousPct is null
  5.  "ahead of" text + emerald styling when org >= competitor
  6.  "ahead of you" text + amber styling when org < competitor
  7.  data-testid="sov-competitor-verdict" on competitor section
  8.  losing queries list renders when losingQueries.length > 0
  9.  losing queries list hidden when losingQueries is empty
  10. data-testid="sov-verdict-no-data" rendered when currentPct is null
```

### Test File 4: `src/__tests__/unit/citations-components.test.tsx` — 18 tests

```
describe('CitationHealthBadge')
  1.  health='healthy' → label "Healthy", emerald styling
  2.  health='wrong_info' → label "Has Wrong Info", red styling
  3.  health='unclaimed' → label "Unclaimed", amber styling
  4.  health='missing' → label "Not Listed"
  5.  health='unknown' → label "Not Yet Checked"

describe('CitationSourceRow')
  6.  renders domain or URL as a link
  7.  renders CitationHealthBadge
  8.  wrong_info + detected_value + expected_value → wrongInfoText rendered in red
  9.  wrong_info health → "Fix this →" action link
  10. unclaimed health → "Claim listing →" action link
  11. missing health → "Add listing →" action link
  12. healthy health → no action link
  13. data-testid="citation-row-{id}" on root

describe('CitationsSummaryPanel')
  14. renders total citation count
  15. data-testid="citations-count-healthy" shows healthy count
  16. data-testid="citations-count-wrong" shows wrongInfo count
  17. data-testid="citations-count-unclaimed" shows unclaimed count
  18. zero problems → "✓ All healthy" text visible
```

### Test File 5: `src/__tests__/unit/compete-components.test.tsx` — 15 tests

```
describe('CompeteVerdictPanel')
  1.  winCount=2, lossCount=1 → both counts visible
  2.  winCount=0 → no "Ahead of" text
  3.  lossCount=0 → no "Behind" text
  4.  totalCompetitors=0 → compete-no-competitors state, no verdict text
  5.  data-testid="compete-verdict-panel" when competitors exist

describe('CompetitorCard')
  6.  renders competitor name
  7.  renders org score and competitor score
  8.  orgScore > competitor.score → "+N" badge in emerald
  9.  orgScore < competitor.score → "−N" badge in amber
  10. winning card: emerald border, no "Close the gap" link
  11. losing card: amber border, "Close the gap →" link visible
  12. "Close the gap →" links to /dashboard/alerts
  13. data-testid="competitor-card-{id}" on root
  14. data-testid="compete-close-gap-{id}" on CTA link when losing
  15. advantageText renders when buildAdvantageText returns non-null
```

### E2E Test File: `src/__tests__/e2e/sprint-h-smoke.spec.ts` — 22 tests

```
describe('Sprint H — Action Surfaces E2E')

  Alerts triage:
  1.  /dashboard/alerts: data-testid="triage-grid" present
  2.  swimlane-fix-now, swimlane-in-progress, swimlane-resolved all present
  3.  alerts-verdict-clean shown when zero open alerts
  4.  alerts-verdict-issues shown when open alerts exist
  5.  AlertCard headline is plain English (not a raw DB enum value)
  6.  "Fix with AI" button appears in Fix Now swimlane on an open alert

  Share of Voice:
  7.  /dashboard/share-of-voice: sov-verdict-panel renders above SOVTrendChart
  8.  SOVVerdictPanel appears before chart in DOM order
  9.  Verdict shows a % number or no-data state — never blank
  10. Losing queries section renders when query data available

  Citations:
  11. /dashboard/citations: citations-summary-panel present
  12. Health counts visible (healthy, wrong, unclaimed)
  13. Wrong info section appears before healthy section in DOM
  14. "Fix this →" link present for a wrong_info citation
  15. "Claim listing →" link present for an unclaimed citation

  Compete:
  16. /dashboard/compete: compete-verdict-panel OR compete-no-competitors present
  17. Win/Loss counts visible when competitors exist
  18. Losing matchups section before winning matchups in DOM
  19. CompetitorCard present for each competitor
  20. "Close the gap →" link present on a losing CompetitorCard
  21. No-competitors empty state when zero competitors

  Accessibility:
  22. All InfoTooltip triggers on SOV and Citations pages are keyboard-focusable
```

### Run commands

```bash
npx vitest run src/__tests__/unit/alert-card.test.tsx
npx vitest run src/__tests__/unit/triage-swimlane.test.tsx
npx vitest run src/__tests__/unit/sov-verdict-panel.test.tsx
npx vitest run src/__tests__/unit/citations-components.test.tsx
npx vitest run src/__tests__/unit/compete-components.test.tsx
npx vitest run                                                   # ALL tests Sprints A–H — 0 regressions
npx playwright test src/__tests__/e2e/sprint-h-smoke.spec.ts
npx tsc --noEmit                                                 # 0 new type errors
```

---

## 📂 Files to Create / Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `app/dashboard/alerts/_components/AlertCard.tsx` | **CREATE** | Triage card — headline from describeAlert() |
| 2 | `app/dashboard/alerts/_components/TriageSwimlane.tsx` | **CREATE** | Swimlane wrapper |
| 3 | `app/dashboard/alerts/_components/AlertsPageHeader.tsx` | **CREATE** | Verdict header (clean / N issues) |
| 4 | `app/dashboard/alerts/page.tsx` | **MODIFY** | Replace table layout with triage grid |
| 5 | `app/dashboard/share-of-voice/_components/SOVVerdictPanel.tsx` | **CREATE** | % + delta + competitor gap + losing queries |
| 6 | `app/dashboard/share-of-voice/page.tsx` | **MODIFY** | Insert verdict panel above chart |
| 7 | `app/dashboard/citations/_components/CitationHealthBadge.tsx` | **CREATE** | Health status badge (5 states) |
| 8 | `app/dashboard/citations/_components/CitationSourceRow.tsx` | **CREATE** | Row with health, wrong info text, action |
| 9 | `app/dashboard/citations/_components/CitationsSummaryPanel.tsx` | **CREATE** | Verdict + health count grid |
| 10 | `app/dashboard/citations/page.tsx` | **MODIFY** | Group by health, add summary panel |
| 11 | `app/dashboard/compete/_components/CompetitorCard.tsx` | **CREATE** | Win/loss badge + advantage text + CTA |
| 12 | `app/dashboard/compete/_components/CompeteVerdictPanel.tsx` | **CREATE** | Win/Loss count verdict |
| 13 | `app/dashboard/compete/page.tsx` | **MODIFY** | Add verdict, split losing/winning sections |
| 14 | `src/__tests__/unit/alert-card.test.tsx` | **CREATE** | 14 tests |
| 15 | `src/__tests__/unit/triage-swimlane.test.tsx` | **CREATE** | 5 tests |
| 16 | `src/__tests__/unit/sov-verdict-panel.test.tsx` | **CREATE** | 10 tests |
| 17 | `src/__tests__/unit/citations-components.test.tsx` | **CREATE** | 18 tests |
| 18 | `src/__tests__/unit/compete-components.test.tsx` | **CREATE** | 15 tests |
| 19 | `src/__tests__/e2e/sprint-h-smoke.spec.ts` | **CREATE** | 22 tests |

**No migrations. No API routes. No cron jobs.**

---

## 🧠 Edge Cases to Handle

1. **`date-fns` availability.** Run `cat package.json | grep date-fns`. If absent, use the inline `timeAgo()` helper in `AlertCard` — do not install a new package.

2. **Alert severity column absent.** If `hallucination_alerts` has no `severity` column in `prod_schema.sql`, fall back to `describeAlert(alert).severity`. Sprint G already maps `alert_type → IssueSeverity`. Use it. Never crash because the column is absent.

3. **`verifying_since` null on pre-Sprint-F alerts.** Sprint F added this column. Alerts that moved to `verifying` before Sprint F will have `null`. In `daysUntilFollowUp()`, return 14 when null. Never show a negative number.

4. **SOV per-query data may not exist.** If `sov_entries` has no `query` column, `losingQueries` will be an empty array and the Tier 2 losing-queries section simply doesn't render. This is correct behavior — do not show a section with no data.

5. **Citations health fields variable.** `deriveCitationHealth()` must be adapted to the actual columns in `prod_schema.sql`. Document which columns were used in the DEVLOG. If only a URL exists (no accuracy flags), all citations will be `unknown` health — show the unknown state gracefully.

6. **Compete `orgScore` source.** `CompetitorCard` needs the org's own Reality Score. Read how `compete/page.tsx` currently fetches the org score — reuse that value. Do not add a duplicate fetch.

7. **`AddCompetitorForm` must not be moved.** It exists in the Compete page today. Sprint H only adds `CompeteVerdictPanel` above the cards and restructures the card section below. The form's position relative to the rest of the page is preserved. Read the current `compete/page.tsx` carefully to understand where the form currently sits before modifying the layout.

8. **`still_hallucinating` in the Resolved swimlane.** These alerts belong in Resolved (the follow-up cycle is complete) with a "Try again →" CTA, not in Fix Now. The correction was submitted — there is no pending user action for a `still_hallucinating` alert until the user explicitly clicks "Try again."

9. **Large resolved lists.** Resolved swimlane is capped at 10 with `.slice(0, 10)`. This is intentional. Do not add pagination to the triage view this sprint.

10. **Competitor cards in a 1-column narrow layout.** The compete page uses `grid-cols-1 sm:grid-cols-2`. On mobile, cards stack vertically. The Win/Loss badge in the card header must remain readable at any width — use `shrink-0` on the badge to prevent text wrapping.

---

## 🚫 What NOT to Do

1. **DO NOT write alert copy in `AlertCard`.** Every headline comes from `lib/issue-descriptions.ts`. `AlertCard` calls `describeAlert()` — no exceptions (AI_RULES §58, §61).
2. **DO NOT remove `AddCompetitorForm`** or move it from its current position in `compete/page.tsx`.
3. **DO NOT fabricate SOV per-query data, citation health flags, or competitor advantage categories** if they don't exist in the DB. Show what's available; omit what isn't.
4. **DO NOT re-sort alerts within a swimlane** beyond severity-then-date. The sort communicates priority — changing it breaks the triage mental model.
5. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12).
6. **DO NOT modify `middleware.ts`** (AI_RULES §6).
7. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).
8. **DO NOT touch the `SOVTrendChart` component.** Sprint G moved it to this page. Sprint H inserts the verdict panel above it. The chart itself is unchanged.
9. **DO NOT show a blank page section** when data for a subsection is empty. Every empty state has an explanation: "No losing queries detected," "No unclaimed citations found," "No competitors added yet."
10. **DO NOT add pagination** to the Resolved swimlane or to any section this sprint. Cap at 10 / "View all →" links are acceptable; full pagination belongs in a later sprint.

---

## ✅ Definition of Done

**Alerts:**
- [ ] Three swimlanes render (Fix Now / In Progress / Resolved)
- [ ] Each swimlane shows correct count badge
- [ ] `AlertCard` uses `describeAlert()` — zero raw DB strings visible to users
- [ ] `AlertCard` uses `getModelName()` — zero raw model identifiers visible
- [ ] Severity badge: red=Critical, amber=Warning
- [ ] Status-appropriate CTAs: Fix with AI (open), follow-up notice (verifying), resolved text (resolved), Try again (still_hallucinating)
- [ ] `data-testid` present: `triage-grid`, `swimlane-fix-now`, `swimlane-in-progress`, `swimlane-resolved`
- [ ] `alerts-verdict-clean` / `alerts-verdict-issues` header renders correctly

**Share of Voice:**
- [ ] `SOVVerdictPanel` renders before `SOVTrendChart` in the DOM
- [ ] Verdict shows %, delta, competitor gap
- [ ] Losing queries section shows when data exists; hidden when empty
- [ ] No-data state when `currentPct` is null
- [ ] `InfoTooltip` on weekly trend chart heading

**Citations:**
- [ ] `CitationsSummaryPanel` renders with 3-count grid
- [ ] Citations partitioned: wrong_info section → unclaimed section → healthy section
- [ ] `CitationHealthBadge` correct label + color for all 5 health states
- [ ] "Fix this →", "Claim listing →", "Add listing →" CTAs on correct health states
- [ ] `deriveCitationHealth()` logic documented in DEVLOG (which columns used)
- [ ] Empty sections hidden (not rendered with 0 items)

**Compete:**
- [ ] `CompeteVerdictPanel` renders Win/Loss counts when competitors exist
- [ ] No-competitors empty state when 0 competitors
- [ ] Losing matchups section above winning matchups section
- [ ] Win/Loss badge: emerald (+N ahead), amber (−N behind)
- [ ] "Close the gap →" on losing cards; absent on winning cards
- [ ] `AddCompetitorForm` position unchanged

**Tests:**
- [ ] `alert-card.test.tsx` — **14 tests passing**
- [ ] `triage-swimlane.test.tsx` — **5 tests passing**
- [ ] `sov-verdict-panel.test.tsx` — **10 tests passing**
- [ ] `citations-components.test.tsx` — **18 tests passing**
- [ ] `compete-components.test.tsx` — **15 tests passing**
- [ ] `npx vitest run` — ALL Sprints A–H passing, zero regressions
- [ ] `sprint-h-smoke.spec.ts` — **22 E2E tests passing**
- [ ] `npx tsc --noEmit` — 0 new type errors

---

## 📓 DEVLOG Entry

```markdown
## [DATE] — Sprint H: Action Surfaces (Completed)

**Alerts:**
- Status enum values found: [list actual values from prod_schema.sql]
- Severity column exists: [yes — column name / no — derived from issue-descriptions.ts]
- dismissed status handling: [added to Resolved swimlane / fourth swimlane / not present]
- date-fns available: [yes / no — used inline timeAgo() helper]

**SOV:**
- Per-query breakdown available: [yes — column names / no — Tier 2 section omitted]
- Competitor SOV column: [name]
- Delta source: [previous row / computed]

**Citations:**
- deriveCitationHealth() reads: [list actual columns — has_wrong_info, is_claimed, accuracy_score, status, etc.]
- Health distribution in golden tenant: healthy=[N], wrong_info=[N], unclaimed=[N]

**Compete:**
- Advantage text columns available: [list / none — score comparison only]
- orgScore source: [column/table]
- AddCompetitorForm position: unchanged

**Tests:** 62 Vitest + 22 Playwright
**Cumulative (A–H):** [N] Vitest + [N] Playwright
```

---

## 🔮 AI_RULES Update

```markdown
## 60. 🎯 Verdict-First Page Pattern (Sprint H)

Every detail page answering a better/worse or win/lose question leads with a verdict panel.

* Verdict panel = first element after the page heading. Charts and tables follow as evidence.
* Verdict formula: [subject] + [status] + [consequence or gap].
  "Ahead of 2 competitors, behind 1."
  "34% of AI searches mention you — 12 points below your nearest competitor."
* Never invent data for a verdict. If data doesn't exist, show a collecting/empty state.
* Jargon ban (AI_RULES §58) applies: no "SOV metric", no raw DB enum values, no "hallucination_detected".

## 61. 🗂️ Triage Queue Pattern — Alerts Page (Sprint H)

* Status mapping (adjust to actual DB values):
  Fix Now = 'open' | In Progress = 'verifying' | Resolved = 'resolved' + 'still_hallucinating'
* AlertCard ALWAYS uses describeAlert() from lib/issue-descriptions.ts. No inline copy.
* Resolved swimlane cap: 10 alerts maximum. Link "View all →" when needed.
* still_hallucinating goes in Resolved (cycle complete) with "Try again →" — not in Fix Now.
```

---

## 📚 Git Commit

```bash
git add -A
git commit -m "Sprint H: Action Surfaces — Alerts Triage, SOV Verdict, Citation Health, Compete Win/Loss

Alerts:
- AlertCard: headlines from describeAlert() (Sprint G); getModelName() for model display
- TriageSwimlane: Fix Now / In Progress / Resolved; count badges; empty states
- AlertsPageHeader: clean state (0 open) vs. N-issues state
- alerts/page.tsx: triage-grid replaces flat table; status partitioning

Share of Voice:
- SOVVerdictPanel: current %, delta, competitor gap, losing queries (when data available)
- share-of-voice/page.tsx: verdict panel added before SOVTrendChart

Citations:
- CitationHealthBadge: 5 health states (healthy/wrong_info/unclaimed/missing/unknown)
- CitationSourceRow: health badge + plain-English wrong info text + direct actions
- CitationsSummaryPanel: verdict + 3-count health grid
- citations/page.tsx: grouped wrong_info→unclaimed→healthy; summary panel leads

Compete:
- CompeteVerdictPanel: Win/Loss counts; no-competitors empty state
- CompetitorCard: win/loss badge; advantage text when available; Close the gap CTA
- compete/page.tsx: verdict leads; losing matchups before winning; AddCompetitorForm unchanged

Tests: 62 Vitest + 22 Playwright; 0 regressions Sprints A–H
AI_RULES: 60 (verdict-first pattern), 61 (triage queue pattern)

Raw DB values retired from UI: status enums, alert_type strings, model identifiers."

git push origin main
```

---

## 🏁 Sprint Outcome

After Sprint H, four pages answer their user's real question in under 3 seconds:

**Alerts** — "3 wrong facts need fixing" is spatially obvious: the Fix Now column is leftmost and has the only action buttons. Users don't read status columns anymore — they look left.

**Share of Voice** — "34% — 12 points below Lips Hookah Lounge" is the first thing on the page. The chart is still there for users who want to see the trend. But users who just want to know if they're winning get the answer immediately.

**Citations** — "4 sources have wrong information — fix these first" sits at the top. The wrong-info sources are listed first, each with the specific wrong fact described in plain English and a direct link to fix it. Users don't need to understand domain authority scores anymore.

**Compete** — "Ahead of 2, behind 1" is the first sentence on the page. The losing matchup explains why (where data allows). One CTA per losing competitor: close the gap.

**Next — Sprint I:** Revenue Impact (pre-fill the smart defaults so a number appears immediately), AI Sentiment (interpretation summary above the charts), Source Intelligence (health indicators per source), Bot Activity (how-to-fix instructions per blocked bot).
