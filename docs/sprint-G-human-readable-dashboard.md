# Sprint G — Human-Readable Dashboard: Plain-English Issues, Consequence-First Design

> **Claude Code Prompt — Bulletproof Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`
> **Prerequisites:** Sprints A–F must be fully merged and all tests passing. Sprint G is a pure front-end redesign — no new DB tables, no new crons, no new API routes. Every data point needed already exists.

---

## 🎯 Objective

Sprint G redesigns the main dashboard from a *data display* into an *action surface*. The current dashboard requires users to learn LocalVector's vocabulary before they can understand what they're looking at. A restaurant owner who has never heard of "Reality Score," "Entity Health," or "Share of Voice" opens the dashboard and faces a wall of gauges and charts with no clear answer to the question every new user is silently asking: **"What's wrong and what should I do right now?"**

The reference design (uploaded screenshot) shows the correct pattern: a site audit tool that leads with four plain-English stat panels, then immediately answers "what are the specific problems" in a Top Issues list where each row reads like a human wrote it — not like a database schema was exposed directly to the UI.

**This sprint delivers:**

1. **Plain-English Issue Descriptions** — `lib/issue-descriptions.ts` maps every hallucination alert type and technical finding into a consequence sentence written for a business owner, not a developer. "ChatGPT says you close at 10pm — your real hours are until 2am." Not "Status: hallucination_detected, field: hours, model: gpt-4o."

2. **Dashboard Header Redesign** — Four stat panels replace the current jumble of metric cards: AI Visibility gauge (with benchmark comparison), Wrong Facts count, AI Bot Access status, and Last Scan timing. Each panel answers a single question in under 3 seconds.

3. **Top Issues Panel** — The bottom section of the dashboard becomes a prioritized list of the top 4–5 issues the customer needs to act on today, each in plain English with a severity badge, an affected-search-count, and a clear CTA ("Fix with AI" or "How to fix →").

4. **Jargon Retirement from the Dashboard** — The current detail cards (SOV Trend chart, Hallucinations by Model chart, Competitor Comparison, Entity Health) belong on their own pages, not on the dashboard. They move off the dashboard. The dashboard becomes a summary and dispatch surface, not a data dump.

5. **Sample Data Compatibility** — Sprint B's sample data mode must work seamlessly with the new layout. The stat panels and Top Issues list must render correctly with sample data, with `SampleDataBadge` overlays on the appropriate panels.

**Why this sprint matters:** Sprints A–F made the product correct. Sprint G makes it legible. A product that's technically sound but requires a 20-minute onboarding call to understand will churn customers as fast as it acquires them. This dashboard redesign is the difference between a product that sells itself and one that needs to be explained.

**Estimated total implementation time:** 12–16 hours. This is primarily front-end work — TypeScript + React + Tailwind. The hardest part is writing the consequence sentences in `lib/issue-descriptions.ts`, not the code.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

Before writing ANY code, read every file below. The dashboard redesign touches the most-viewed page in the product — surprises here are expensive.

```
Read docs/AI_RULES.md                                          — Rules 42–57 from Sprints A–F now in effect
Read CLAUDE.md                                                 — Full implementation inventory through Sprint F
Read MEMORY.md                                                 — All architecture decisions through Sprint F

--- Dashboard current state ---
Read app/dashboard/page.tsx                                    — COMPLETE FILE. Current layout, all data fetches, all card usage, sample mode integration (Sprint B), benchmark fetch (Sprint F), positioning banner (Sprint D)
Read app/dashboard/_components/                                — ls; then read EVERY component file. Know what each card renders, what props it accepts, what data shape it expects
Read app/dashboard/_components/MetricCard.tsx                  — Sprint A: href prop added; Sprint B: SampleDataBadge integration
Read app/dashboard/_components/RealityScoreCard.tsx            — Gauge rendering; Sprint B: sample data compatibility
Read app/dashboard/_components/SOVTrendChart.tsx               — Will move OFF dashboard to sov page
Read app/dashboard/_components/HallucinationsByModel.tsx       — Will move OFF dashboard to alerts page
Read app/dashboard/_components/BenchmarkComparisonCard.tsx     — Sprint F: collecting/ready states; stays on dashboard in new design

--- Data shapes ---
Read supabase/prod_schema.sql                                  — hallucination_alerts table: ALL columns, status enum values
Read lib/supabase/database.types.ts                            — TypeScript types for all tables
Read src/__fixtures__/golden-tenant.ts                         — Sample data shapes (Sprint B+D+E artifacts)
Read lib/sample-data/sample-dashboard-data.ts                  — Sprint B: SAMPLE_SCORES, SAMPLE_HALLUCINATIONS, etc.

--- Existing patterns to reuse ---
Read components/ui/InfoTooltip.tsx                             — Sprint B: tooltip system
Read components/ui/SampleDataBadge.tsx                         — Sprint B: "◈ Sample Data" overlay
Read components/ui/SampleModeBanner.tsx                        — Sprint B: dismissible sample mode banner
Read components/ui/FirstVisitTooltip.tsx                       — Sprint E: one-time page tooltips
Read lib/sample-data/use-sample-mode.ts                        — Sprint B: isSampleMode() function
Read lib/industries/industry-config.ts                         — Sprint E: getIndustryConfig()
Read lib/credits/credit-service.ts                             — Sprint D: checkCredit() for Fix with AI CTA
Read lib/plan-enforcer.ts                                      — Understand plan gating (which features gated)
Read lib/plan-display-names.ts                                 — Sprint A: getPlanDisplayName()

--- Bot activity data (for AI Bot Access panel) ---
Read app/dashboard/bot-activity/page.tsx                       — What data the bot activity page fetches; reuse the same query
Read supabase/prod_schema.sql                                  — Find bot_activity or crawler_logs table; understand bot name + blocked status columns

--- Alerts data (for Top Issues panel) ---
Read app/dashboard/alerts/page.tsx                             — How alerts are fetched and displayed currently
Read app/dashboard/_components/CorrectionPanel.tsx             — Sprint F: follow-up status; understand the full alert data shape
```

**Specifically understand before writing code:**

- **What data is already fetched in `dashboard/page.tsx`:** The dashboard server component already fetches scores, SOV trend, hallucinations, competitor data, benchmark, and org info. The redesign should REUSE these fetches — do not add new Supabase calls for data that's already fetched. If you need hallucination alerts on the dashboard and they're not currently fetched there, add ONE additional fetch for the top 5 open alerts ordered by severity.

- **`hallucination_alerts` exact column names:** Before writing `lib/issue-descriptions.ts`, read the table schema carefully. The columns that matter: the alert type/category column (might be `alert_type`, `category`, or `finding_type`), the model column, the wrong value column, the description column, the severity column (if any), and the status column. The issue description templates depend entirely on these column names.

- **Bot access data shape:** Before building the AI Bot Access panel, find out how bot activity is tracked. Is it a `bot_activity` table? A `crawler_logs` table? Is blocking detected from `robots.txt` analysis or from actual crawl logs? Read `bot-activity/page.tsx` to understand the data shape before writing the panel.

- **Cards being moved OFF the dashboard:** `SOVTrendChart` and `HallucinationsByModel` move to their detail pages. Before removing them from `dashboard/page.tsx`, verify they don't already exist on those detail pages — if they do, simply remove the import from `dashboard/page.tsx`. If they don't, add them to the detail page first, then remove from dashboard. Never delete a component that isn't displayed anywhere.

- **Sample data for the new panels:** Sprint B's `SAMPLE_SCORES` and `SAMPLE_HALLUCINATIONS_BY_MODEL` cover the existing cards. The new AI Bot Access panel and the Top Issues panel need sample data equivalents. Add them to `lib/sample-data/sample-dashboard-data.ts`.

---

## 🏗️ Architecture — What to Build

---

### Component 1: `lib/issue-descriptions.ts` — Plain-English Issue Templates

This is the intellectual core of Sprint G. The code is simple; the copy is what matters. Every issue type must be translated from a database record into a sentence a business owner would say to their spouse over dinner.

**The translation principle:**
- ❌ Data fact: `"alert_type: wrong_hours, model: chatgpt, field: closing_time, detected_value: 10pm"`
- ✅ Consequence sentence: `"ChatGPT says you close at 10pm — your real hours are until 2am"`

**The consequence sentence formula:** `[Who is wrong] + [what they're saying wrong] + [what the truth is]`

```typescript
/**
 * lib/issue-descriptions.ts
 *
 * Converts raw hallucination alert and technical finding data into
 * plain-English consequence sentences written for business owners.
 *
 * Design rule: every sentence must answer "what does this mean for my business?"
 * not "what did the system detect?"
 *
 * AI_RULES §58: Never add an issue type here without a consequence sentence.
 * The fallback description is a last resort — it means this type needs a template.
 */

export type IssueSeverity = 'critical' | 'warning' | 'info';

export interface IssueDescription {
  /** One-line plain-English consequence sentence */
  headline: string;
  /** Optional: one additional sentence of context (not required) */
  subtext?: string;
  /** Severity level — drives badge color */
  severity: IssueSeverity;
  /** Where to go to fix this — links to detail page */
  fixHref: string;
  /** Label for the fix CTA */
  fixLabel: 'Fix with AI' | 'How to fix →' | 'View details →';
  /** True if "Fix with AI" uses a credit — shown as credit indicator */
  costsCredit: boolean;
  /** Category tag shown as a small badge (e.g., "AI search", "Site health") */
  category: 'AI search' | 'Site health' | 'Listings' | 'Content';
}

// ─── Model display names ──────────────────────────────────────────────────────
// Maps AI model identifiers to human-readable names
const MODEL_NAMES: Record<string, string> = {
  chatgpt:    'ChatGPT',
  gpt:        'ChatGPT',
  openai:     'ChatGPT',
  perplexity: 'Perplexity',
  gemini:     'Gemini',
  google:     'Gemini',
  claude:     'Claude',
  copilot:    'Microsoft Copilot',
};

export function getModelName(model: string | null | undefined): string {
  if (!model) return 'An AI model';
  const normalized = model.toLowerCase();
  for (const [key, name] of Object.entries(MODEL_NAMES)) {
    if (normalized.includes(key)) return name;
  }
  return model;
}

// ─── Alert type → description ─────────────────────────────────────────────────
// Read hallucination_alerts.alert_type (or category) column values from prod_schema.sql
// and map each value to a consequence sentence template.
// IMPORTANT: Adjust the alert_type keys below to match the ACTUAL values in your DB.

type AlertRecord = {
  alert_type?: string | null;
  category?: string | null;
  model?: string | null;
  detected_value?: string | null;    // What the AI said (wrong info)
  expected_value?: string | null;    // What the truth is
  description?: string | null;       // Fallback: raw description from DB
  query?: string | null;             // The search query that found the issue
};

export function describeAlert(alert: AlertRecord): IssueDescription {
  const modelName = getModelName(alert.model);
  // Use alert_type if it exists, else fall back to category
  const type = (alert.alert_type ?? alert.category ?? '').toLowerCase();

  // ── Wrong hours ────────────────────────────────────────────────────────────
  if (type.includes('hour') || type.includes('time') || type.includes('schedule')) {
    return {
      headline: alert.detected_value && alert.expected_value
        ? `${modelName} says you close at ${alert.detected_value} — your real hours are ${alert.expected_value}`
        : `${modelName} is showing incorrect business hours`,
      severity: 'critical',
      fixHref: '/dashboard/alerts',
      fixLabel: 'Fix with AI',
      costsCredit: true,
      category: 'AI search',
    };
  }

  // ── Wrong location / address ───────────────────────────────────────────────
  if (type.includes('location') || type.includes('address') || type.includes('directions')) {
    return {
      headline: alert.detected_value
        ? `${modelName} is sending customers to the wrong address: "${alert.detected_value}"`
        : `${modelName} is showing an incorrect location`,
      subtext: 'Customers following these directions will never arrive.',
      severity: 'critical',
      fixHref: '/dashboard/alerts',
      fixLabel: 'Fix with AI',
      costsCredit: true,
      category: 'AI search',
    };
  }

  // ── Wrong phone number ─────────────────────────────────────────────────────
  if (type.includes('phone') || type.includes('contact') || type.includes('telephone')) {
    return {
      headline: alert.detected_value
        ? `${modelName} is showing the wrong phone number: ${alert.detected_value}`
        : `${modelName} has an incorrect phone number for your business`,
      severity: 'critical',
      fixHref: '/dashboard/alerts',
      fixLabel: 'Fix with AI',
      costsCredit: true,
      category: 'AI search',
    };
  }

  // ── Wrong prices / menu items ──────────────────────────────────────────────
  if (type.includes('price') || type.includes('menu') || type.includes('service') || type.includes('cost')) {
    return {
      headline: alert.detected_value
        ? `${modelName} is quoting incorrect pricing: "${alert.detected_value}"`
        : `${modelName} has wrong pricing or menu information`,
      severity: 'warning',
      fixHref: '/dashboard/alerts',
      fixLabel: 'Fix with AI',
      costsCredit: true,
      category: 'AI search',
    };
  }

  // ── Wrong credentials / qualifications (medical vertical) ─────────────────
  if (type.includes('credential') || type.includes('license') || type.includes('specialty') || type.includes('insurance')) {
    return {
      headline: alert.detected_value
        ? `${modelName} is showing incorrect credentials: "${alert.detected_value}"`
        : `${modelName} has wrong professional credentials for your practice`,
      subtext: 'Incorrect credentials create legal and trust risk.',
      severity: 'critical',
      fixHref: '/dashboard/alerts',
      fixLabel: 'Fix with AI',
      costsCredit: true,
      category: 'AI search',
    };
  }

  // ── Missing llms.txt ──────────────────────────────────────────────────────
  if (type.includes('llms') || type.includes('llms_txt')) {
    return {
      headline: 'AI models can\'t read your official info — llms.txt is missing',
      subtext: 'Without llms.txt, AI crawlers rely on guesswork instead of your verified data.',
      severity: 'warning',
      fixHref: '/dashboard/agent-readiness',
      fixLabel: 'How to fix →',
      costsCredit: false,
      category: 'AI search',
    };
  }

  // ── Bot blocked ────────────────────────────────────────────────────────────
  if (type.includes('bot') || type.includes('blocked') || type.includes('robots') || type.includes('crawler')) {
    const botName = alert.model ? getModelName(alert.model) : 'An AI crawler';
    return {
      headline: `${botName} is blocked by your robots.txt and can't learn about your business`,
      severity: 'warning',
      fixHref: '/dashboard/bot-activity',
      fixLabel: 'How to fix →',
      costsCredit: false,
      category: 'Site health',
    };
  }

  // ── Content not optimized for AI ──────────────────────────────────────────
  if (type.includes('content') || type.includes('optimization') || type.includes('schema')) {
    return {
      headline: 'Your website content isn\'t structured for AI search — you\'re being described in generic terms',
      severity: 'info',
      fixHref: '/dashboard/magic-menus',
      fixLabel: 'How to fix →',
      costsCredit: false,
      category: 'AI search',
    };
  }

  // ── Low text-HTML ratio ───────────────────────────────────────────────────
  if (type.includes('html') || type.includes('text_ratio') || type.includes('thin')) {
    return {
      headline: 'Your website has too little readable text — AI models can\'t extract accurate information',
      severity: 'info',
      fixHref: '/dashboard/source-intelligence',
      fixLabel: 'View details →',
      costsCredit: false,
      category: 'Site health',
    };
  }

  // ── Low SOV / competitor outranking ──────────────────────────────────────
  if (type.includes('sov') || type.includes('share') || type.includes('competitor')) {
    return {
      headline: alert.detected_value
        ? `A competitor ("${alert.detected_value}") is mentioned more often than you in AI responses`
        : 'Competitors are outranking you in AI-generated recommendations',
      severity: 'warning',
      fixHref: '/dashboard/share-of-voice',
      fixLabel: 'View details →',
      costsCredit: false,
      category: 'AI search',
    };
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  // If we reach here, a new alert type was added without a template.
  // Add a template above — never ship a fallback to production customers.
  return {
    headline: alert.description ?? `${modelName} found an issue with your business information`,
    severity: 'info',
    fixHref: '/dashboard/alerts',
    fixLabel: 'View details →',
    costsCredit: false,
    category: 'AI search',
  };
}

// ─── Technical finding descriptions (non-hallucination issues) ────────────────
// Used for issues detected by the site crawler, bot-activity, or agent-readiness
// that are not hallucination_alerts rows.

export interface TechnicalFindingInput {
  type: 'llms_txt_missing' | 'bot_blocked' | 'content_thin' | 'schema_missing' | 'http_redirect';
  affectedCount?: number;
  botName?: string;
}

export function describeTechnicalFinding(finding: TechnicalFindingInput): IssueDescription {
  switch (finding.type) {
    case 'llms_txt_missing':
      return {
        headline: 'AI models can\'t read your official info — llms.txt is missing',
        subtext: `${finding.affectedCount ?? 'All'} AI crawls are using guesswork instead of your verified data.`,
        severity: 'warning',
        fixHref: '/dashboard/agent-readiness',
        fixLabel: 'How to fix →',
        costsCredit: false,
        category: 'AI search',
      };
    case 'bot_blocked':
      return {
        headline: `${finding.botName ?? 'An AI crawler'} is blocked from your website`,
        subtext: `${finding.affectedCount ? `${finding.affectedCount.toLocaleString()} crawl attempts` : 'Crawl attempts'} are being turned away.`,
        severity: 'warning',
        fixHref: '/dashboard/bot-activity',
        fixLabel: 'How to fix →',
        costsCredit: false,
        category: 'Site health',
      };
    case 'content_thin':
      return {
        headline: 'Your website pages have too little text — AI models are guessing about your business',
        severity: 'info',
        fixHref: '/dashboard/source-intelligence',
        fixLabel: 'View details →',
        costsCredit: false,
        category: 'Site health',
      };
    case 'schema_missing':
      return {
        headline: 'Your website is missing structured data that AI models use to understand your business',
        severity: 'info',
        fixHref: '/dashboard/magic-menus',
        fixLabel: 'How to fix →',
        costsCredit: false,
        category: 'AI search',
      };
    case 'http_redirect':
      return {
        headline: 'Some pages aren\'t redirecting correctly from HTTP to HTTPS — affecting how AI crawlers index your site',
        severity: 'warning',
        fixHref: '/dashboard/source-intelligence',
        fixLabel: 'How to fix →',
        costsCredit: false,
        category: 'Site health',
      };
  }
}
```

**After reading `prod_schema.sql`:** Adjust every alert type key in the `describeAlert` function to match the actual values stored in `hallucination_alerts.alert_type` (or whatever the category column is actually named). The templates above are correct in concept — the string matching patterns may need tuning to match your real data. Run:

```bash
# Discover the actual alert_type values in your DB:
grep -A 30 "hallucination_alerts" supabase/prod_schema.sql
grep -A 5 "alert_type\|category\|finding_type" supabase/seed.sql
```

---

### Component 2: Redesigned Dashboard Header — 4 Stat Panels

Replace the current top-of-dashboard metric cards with four panels that each answer one question instantly. The existing `RealityScoreCard` is the reference visual pattern — a gauge with a number in it. We're creating a consistent family of four such panels.

**Create `app/dashboard/_components/panels/AIVisibilityPanel.tsx`**

```tsx
/**
 * AIVisibilityPanel — the primary "how are we doing?" gauge
 *
 * Shows:
 * - Reality Score as a semicircle gauge (0–100)
 * - Delta from last week (+/- N points)
 * - Benchmark comparison from Sprint F ("X above Alpharetta avg")
 *
 * This replaces the current RealityScoreCard + BenchmarkComparisonCard
 * which were two separate cards. Merged here for the new layout.
 */
```

Design spec:
- Large semicircle gauge, score number centered (reuse `RealityScoreCard` gauge component if it exists as a standalone — don't duplicate the SVG)
- Below the gauge: `+4 pts this week` in emerald or `−2 pts this week` in red
- Below that: `"11 above Alpharetta avg"` from benchmark data (Sprint F), or `"Building benchmark..."` if below threshold
- `InfoTooltip` on the heading: "Your AI Visibility score (0–100) measures how accurately and prominently AI models represent your business across ChatGPT, Perplexity, and Gemini."

**Create `app/dashboard/_components/panels/WrongFactsPanel.tsx`**

```tsx
/**
 * WrongFactsPanel — "how many things are wrong right now?"
 *
 * Shows:
 * - Count of open hallucination alerts (not 'resolved' or 'verifying')
 * - Change from last week if available
 * - Color: red when > 0, green when 0
 * - Plain language: "wrong facts" not "open alerts"
 */
```

Design spec:
- Big number: `3` (or `0` in green with "✓ No wrong facts detected" subtext)
- Label: "Wrong Facts in AI Responses"
- Subtext: `"Across ChatGPT, Perplexity, and Gemini"` or `"Found this week +2"` if there's a delta
- Link: entire panel is clickable → `/dashboard/alerts`
- `InfoTooltip`: "A 'wrong fact' is when an AI model states something incorrect about your business — wrong hours, wrong address, wrong prices. Each one costs you customers."

**Create `app/dashboard/_components/panels/AIBotAccessPanel.tsx`**

```tsx
/**
 * AIBotAccessPanel — "which AI crawlers can reach your site?"
 *
 * Shows the Big 4 AI crawlers and whether each is allowed or blocked.
 * Mirrors the "Blocked from AI Search" panel in the reference screenshot.
 *
 * Data source: bot_activity table (or crawler_logs — read prod_schema.sql)
 * Fallback: if no bot data exists, show all as "Unknown"
 */
```

Design spec — a small list, not a gauge:
```
🔴 ClaudeBot      Blocked     1,238 attempts
🟢 PerplexityBot  Allowed       872 visits
🟢 GPTBot         Allowed        25 visits
🟢 Googlebot      Allowed        24 visits
```
- Each row has bot name, status badge (Allowed / Blocked in green/red), and visit count
- "Show more" link if more bots exist
- Entire panel links to `/dashboard/bot-activity`
- Blocked bots are shown at the top (most urgent first)
- `InfoTooltip`: "AI crawlers visit your website to learn about your business. If they're blocked, they rely on outdated or incorrect third-party sources instead."

**Before implementing:** Read `bot-activity/page.tsx` to understand the exact data shape. The panel must query the same source. If bot data is expensive to fetch, cache it in the dashboard page server component alongside the other fetches.

**Create `app/dashboard/_components/panels/LastScanPanel.tsx`**

```tsx
/**
 * LastScanPanel — "when did we last check? when's the next check?"
 *
 * Answers the silent user anxiety: "is this thing actually running?"
 *
 * Shows:
 * - "Last scan: Sunday, Feb 23 at 6:14am" (relative OR absolute, whichever is clearer)
 * - "Next scan: in 5 days" (computed from last_scan_at + 7 days)
 * - Scan status: Success / Partial / Failed
 */
```

Design spec:
- Icon: a clock or calendar — reassuring, not alarming
- Primary text: `"Last scan: 5 days ago"` or `"Last scan: Sunday at 6:14am"` — use whichever is under 7 days: relative. Over 7 days: absolute date (something is wrong)
- Secondary text: `"Next scan in 2 days"` — computed from `last_scan_at + 7 days`
- If `last_scan_at` is null (new user): `"First scan runs this Sunday"` — not an error state
- If last scan is > 14 days ago: show a warning badge — something may be broken
- Link to `/dashboard/system-health`
- No InfoTooltip needed — this is self-explanatory

**Data source:** Read `prod_schema.sql` for where `last_scan_at` is stored (likely `orgs.last_scan_at` or `ai_scores.created_at` or `cron_run_log` filtered to the SOV cron). Use whichever reflects the actual most recent scan completion for this org.

---

### Component 3: `TopIssuesPanel` — The Heart of the Redesign

This is the most important component in Sprint G. It replaces the current mix of chart cards with a prioritized, plain-English list of the top 4–5 things the customer should fix today.

**Create `app/dashboard/_components/TopIssuesPanel.tsx`**

```tsx
/**
 * TopIssuesPanel
 *
 * Displays up to 5 prioritized issues in plain English.
 * Each row reads like a human wrote it — not like a database schema.
 *
 * Issue sources (merged and de-duplicated):
 * 1. hallucination_alerts with status='open', ordered by severity DESC
 * 2. Technical findings: llms_txt_missing, blocked_bots, etc. (derived from bot_activity + agent_readiness data)
 *
 * Prioritization order:
 *   critical hallucinations → warning hallucinations → critical technical → warning technical → info
 *
 * Props:
 *   alerts: top 5 open hallucination_alerts rows (fetched in dashboard/page.tsx)
 *   technicalFindings: TechnicalFindingInput[] (derived from bot + agent readiness data)
 *   orgPlan: string (for determining if Fix with AI costs a credit)
 *   sampleMode: boolean (Sprint B: show sample issues when no real data)
 */

interface TopIssuesPanelProps {
  alerts: AlertRecord[];
  technicalFindings: TechnicalFindingInput[];
  orgPlan: string | null;
  sampleMode: boolean;
}
```

**Sample data for Top Issues (add to `lib/sample-data/sample-dashboard-data.ts`):**

```typescript
export const SAMPLE_TOP_ISSUES: AlertRecord[] = [
  {
    alert_type: 'wrong_hours',
    model: 'chatgpt',
    detected_value: '10pm',
    expected_value: '2am on weekends',
    description: 'ChatGPT says you close at 10pm — your real hours are until 2am on weekends',
  },
  {
    alert_type: 'llms_txt_missing',
    model: null,
    detected_value: null,
    expected_value: null,
    description: 'llms.txt is not found — AI models can\'t read your official info',
  },
  {
    alert_type: 'content_optimization',
    model: 'perplexity',
    detected_value: null,
    expected_value: null,
    description: 'Content not optimized for AI search',
  },
  {
    alert_type: 'bot_blocked',
    model: 'claude',
    detected_value: null,
    expected_value: null,
    description: 'ClaudeBot is blocked by robots.txt',
  },
];
```

**The issue row component:**

```tsx
function IssueRow({
  description,
  affectedCount,
  index,
}: {
  description: IssueDescription;
  affectedCount?: number;
  index: number;
}) {
  const severityConfig = {
    critical: { icon: '🔴', badgeClass: 'bg-red-100 text-red-700 ring-red-200' },
    warning:  { icon: '🟡', badgeClass: 'bg-amber-100 text-amber-700 ring-amber-200' },
    info:     { icon: 'ℹ️', badgeClass: 'bg-blue-100 text-blue-700 ring-blue-200' },
  };
  const { icon, badgeClass } = severityConfig[description.severity];

  return (
    <div
      className="flex items-start justify-between gap-4 border-b border-border/50 py-3 last:border-0"
      data-testid={`top-issue-row-${index}`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span className="mt-0.5 shrink-0 text-base" aria-hidden="true">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground leading-snug">
            {description.headline}
          </p>
          {description.subtext && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description.subtext}</p>
          )}
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            {/* Category badge */}
            <span className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
              badgeClass,
            )}>
              {description.category}
            </span>
            {/* Affected count */}
            {affectedCount !== undefined && (
              <span className="text-[11px] text-muted-foreground">
                {affectedCount.toLocaleString()} {affectedCount === 1 ? 'search' : 'searches'} affected
              </span>
            )}
            {/* Credit indicator */}
            {description.costsCredit && (
              <span className="text-[10px] text-muted-foreground/60">· 1 credit</span>
            )}
          </div>
        </div>
      </div>
      {/* CTA */}
      <div className="shrink-0">
        {description.fixLabel === 'Fix with AI' ? (
          <Link
            href={description.fixHref}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
            data-testid={`top-issue-fix-${index}`}
          >
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Fix with AI
          </Link>
        ) : (
          <Link
            href={description.fixHref}
            className="text-xs text-muted-foreground underline hover:text-foreground whitespace-nowrap"
            data-testid={`top-issue-how-${index}`}
          >
            {description.fixLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
```

**The full `TopIssuesPanel`:**

```tsx
export function TopIssuesPanel({ alerts, technicalFindings, orgPlan, sampleMode }: TopIssuesPanelProps) {
  // 1. Convert alerts to IssueDescription
  const alertIssues = alerts.map(alert => ({
    description: describeAlert(alert),
    affectedCount: undefined,  // TODO: wire in query volume data when available
  }));

  // 2. Convert technical findings to IssueDescription
  const technicalIssues = technicalFindings.map(finding => ({
    description: describeTechnicalFinding(finding),
    affectedCount: finding.affectedCount,
  }));

  // 3. Merge and sort: critical first, then warning, then info
  const SEVERITY_ORDER: Record<IssueSeverity, number> = { critical: 0, warning: 1, info: 2 };
  const allIssues = [...alertIssues, ...technicalIssues]
    .sort((a, b) => SEVERITY_ORDER[a.description.severity] - SEVERITY_ORDER[b.description.severity])
    .slice(0, 5);

  const displayIssues = sampleMode
    ? SAMPLE_TOP_ISSUES.map(alert => ({ description: describeAlert(alert), affectedCount: undefined }))
    : allIssues;

  return (
    <div
      className="rounded-lg border border-border bg-card p-5"
      data-testid="top-issues-panel"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Top Issues</h2>
        {displayIssues.length > 0 && (
          <Link
            href="/dashboard/alerts"
            className="text-xs text-muted-foreground hover:text-foreground underline"
            data-testid="top-issues-view-all"
          >
            View all →
          </Link>
        )}
      </div>

      {displayIssues.length === 0 ? (
        <div className="py-6 text-center" data-testid="top-issues-empty">
          <p className="text-sm font-medium text-emerald-600">✓ No issues found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            LocalVector hasn't detected any problems with how AI models describe your business.
          </p>
        </div>
      ) : (
        <div>
          {displayIssues.map(({ description, affectedCount }, index) => (
            <IssueRow
              key={index}
              description={description}
              affectedCount={affectedCount}
              index={index}
            />
          ))}
        </div>
      )}

      {sampleMode && (
        <p className="mt-3 text-[10px] text-muted-foreground/60 text-center">
          Sample issues shown — your real issues appear after the first scan
        </p>
      )}
    </div>
  );
}
```

---

### Component 4: New Dashboard Layout — `app/dashboard/page.tsx`

This is the orchestration step. The server component fetches all data and assembles the new layout.

**New data fetches to add (alongside existing fetches):**

```typescript
// 1. Top 5 open alerts (for TopIssuesPanel)
const { data: topAlerts } = await supabase
  .from('hallucination_alerts')
  .select('id, alert_type, category, model, detected_value, expected_value, description, query')
  .eq('org_id', orgId)
  .eq('status', 'open')               // Only open alerts — not verifying/resolved
  .order('severity', { ascending: true })  // critical first — adjust to match your severity column
  .limit(5);

// 2. Bot access data (for AIBotAccessPanel)
// Read bot-activity/page.tsx to understand the exact query — replicate it here
// The result should be an array of { bot_name, allowed: boolean, visit_count }
const { data: botData } = await supabase
  .from('bot_activity')               // Adjust table name to match prod_schema.sql
  .select('bot_name, status, visit_count')
  .eq('org_id', orgId)
  .order('visit_count', { ascending: false })
  .limit(6);

// 3. Last scan timestamp
// Find this in org data, ai_scores, or cron_run_log — read prod_schema.sql
// to determine the most reliable source for "when did the last scan complete for this org?"
const lastScanAt = orgData?.last_scan_at ?? scores?.created_at ?? null;
```

**New layout structure (replace the current `<main>` content):**

```tsx
<main className="space-y-6 p-6">
  {/* Sprint B: Banners at top */}
  <SampleModeBanner ... />
  <PositioningBanner ... />   {/* Sprint D */}

  {/* Sprint G: 4 stat panels — top row */}
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <div className="relative">
      <AIVisibilityPanel
        score={displayScores?.realityScore ?? null}
        previousScore={displayScores?.previousRealityScore ?? null}
        benchmark={benchmark}
        orgCity={orgMeta?.city ?? null}
      />
      {sampleMode && <SampleDataBadge />}
    </div>
    <div className="relative">
      <WrongFactsPanel
        alertCount={sampleMode ? SAMPLE_WRONG_FACTS_COUNT : (topAlerts?.length ?? 0)}
        previousCount={null}  {/* Wire in when historical data is available */}
      />
      {sampleMode && <SampleDataBadge />}
    </div>
    <div className="relative">
      <AIBotAccessPanel
        bots={sampleMode ? SAMPLE_BOT_DATA : (botData ?? [])}
      />
      {sampleMode && <SampleDataBadge />}
    </div>
    <LastScanPanel lastScanAt={lastScanAt} />
    {/* LastScanPanel never gets a SampleDataBadge — it shows real timing always */}
  </div>

  {/* Sprint G: Top Issues — full width below stat panels */}
  <TopIssuesPanel
    alerts={sampleMode ? [] : (topAlerts ?? [])}
    technicalFindings={deriveTechnicalFindings(botData, agentReadinessData)}
    orgPlan={orgData?.plan ?? null}
    sampleMode={sampleMode}
  />

  {/* Sprint F: Benchmark card — stays, but now feeds into AIVisibilityPanel above
      Keep this only if AIVisibilityPanel doesn't fully subsume it.
      If benchmark content is fully moved into AIVisibilityPanel, remove this card. */}

  {/* Sprint B: Credits meter / remaining dashboard detail cards go here IF you want
      any secondary charts. Recommendation: remove SOVTrendChart and HallucinationsByModel
      from here. They belong on their detail pages. */}
</main>
```

#### Helper function — `deriveTechnicalFindings`

Converts raw bot data and agent readiness data into `TechnicalFindingInput[]` for the `TopIssuesPanel`:

```typescript
function deriveTechnicalFindings(
  botData: BotRow[] | null,
  agentReadiness: AgentReadinessData | null,
): TechnicalFindingInput[] {
  const findings: TechnicalFindingInput[] = [];

  // Check for llms.txt missing from agent readiness data
  if (agentReadiness?.llms_txt_present === false) {
    findings.push({ type: 'llms_txt_missing', affectedCount: agentReadiness.monthly_crawl_count });
  }

  // Check for blocked bots
  const blockedBots = (botData ?? []).filter(b => b.status === 'blocked' || b.allowed === false);
  for (const bot of blockedBots.slice(0, 2)) {  // At most 2 bot-blocked findings
    findings.push({
      type: 'bot_blocked',
      botName: getModelName(bot.bot_name),
      affectedCount: bot.visit_count,
    });
  }

  return findings;
}
```

**Adjust `BotRow` and `AgentReadinessData` type shapes** to match what's actually in your DB. Read `bot-activity/page.tsx` and `agent-readiness/page.tsx` for the exact data shapes before writing this.

---

### Component 5: Moving Cards Off the Dashboard

`SOVTrendChart` and `HallucinationsByModel` must appear on their detail pages before being removed from the dashboard. Do not remove them from the dashboard and leave users with no way to see that data.

**Step 1: Verify they're already on detail pages or add them:**

```bash
grep -rn "SOVTrendChart" app/dashboard/share-of-voice/
grep -rn "HallucinationsByModel" app/dashboard/alerts/
```

If missing from detail pages → add them there first, keeping their current data fetch patterns. If already present → skip.

**Step 2: Remove from `dashboard/page.tsx`:**

- Remove `<SOVTrendChart>` import and usage
- Remove `<HallucinationsByModel>` import and usage
- Remove any data fetches that existed only to feed these charts and are no longer needed elsewhere

**What stays on the dashboard:**
- `AIVisibilityPanel` (new)
- `WrongFactsPanel` (new)
- `AIBotAccessPanel` (new)
- `LastScanPanel` (new)
- `TopIssuesPanel` (new)
- `BenchmarkComparisonCard` (Sprint F) — IF its content isn't absorbed into `AIVisibilityPanel`. If it is, remove it.

**What moves to detail pages:**
- `SOVTrendChart` → `share-of-voice/page.tsx`
- `HallucinationsByModel` → `alerts/page.tsx`

**What stays where it is (don't touch):**
- `SampleModeBanner` (Sprint B)
- `PositioningBanner` (Sprint D)
- Credits meter in `TopBar` (Sprint D)

---

### Component 6: Sample Data for New Panels

Add to `lib/sample-data/sample-dashboard-data.ts`:

```typescript
// Sample data for Sprint G panels

export const SAMPLE_WRONG_FACTS_COUNT = 3;

export const SAMPLE_BOT_DATA = [
  { bot_name: 'ClaudeBot',       status: 'blocked', visit_count: 1238 },
  { bot_name: 'PerplexityBot',   status: 'allowed', visit_count: 872  },
  { bot_name: 'GPTBot',          status: 'allowed', visit_count: 25   },
  { bot_name: 'Googlebot',       status: 'allowed', visit_count: 24   },
] as const;

// SAMPLE_TOP_ISSUES is defined in lib/issue-descriptions.ts — import from there
```

---

## 🧪 Testing

### Test File 1: `src/__tests__/unit/issue-descriptions.test.ts`

```
describe('describeAlert()')

  Wrong hours:
  1.  alert with type containing 'hour': returns severity='critical', fixLabel='Fix with AI'
  2.  headline includes model name and detected_value when both present
  3.  headline falls back gracefully when detected_value is null
  4.  costsCredit === true for wrong_hours alerts

  Wrong location:
  5.  alert type containing 'location': returns severity='critical'
  6.  headline includes detected_value when present

  Wrong phone:
  7.  alert type containing 'phone': returns severity='critical'
  8.  headline includes the wrong phone number

  llms.txt:
  9.  alert type containing 'llms': returns severity='warning', costsCredit=false
  10. fixHref links to '/dashboard/agent-readiness'

  Bot blocked:
  11. alert type containing 'bot': returns severity='warning'
  12. headline includes the model/bot name

  Fallback:
  13. unknown alert_type uses alert.description as headline
  14. fallback returns severity='info'

describe('getModelName()')
  15. 'chatgpt' → 'ChatGPT'
  16. 'gpt-4o' → 'ChatGPT' (contains 'gpt')
  17. 'perplexity' → 'Perplexity'
  18. 'gemini-1.5' → 'Gemini' (contains 'gemini')
  19. null → 'An AI model'
  20. unknown string → returned as-is

describe('describeTechnicalFinding()')
  21. 'llms_txt_missing' → severity='warning', fixHref='/dashboard/agent-readiness'
  22. 'bot_blocked' with botName → headline includes botName
  23. 'bot_blocked' with affectedCount → subtext includes the count
  24. 'content_thin' → severity='info'
  25. 'http_redirect' → severity='warning', category='Site health'
```

**Target: 25 tests**

### Test File 2: `src/__tests__/unit/top-issues-panel.test.tsx`

```
describe('TopIssuesPanel')

  With issues:
  1.  renders up to 5 issue rows
  2.  never renders more than 5 rows even when more than 5 issues passed
  3.  critical issues appear before warning issues
  4.  warning issues appear before info issues
  5.  each row has data-testid="top-issue-row-{index}"
  6.  "Fix with AI" button present for issues with fixLabel='Fix with AI'
  7.  "How to fix →" link present for issues with fixLabel='How to fix →'
  8.  "View all →" link present when displayIssues.length > 0
  9.  "View all →" links to '/dashboard/alerts'

  Empty state:
  10. data-testid="top-issues-empty" visible when no issues
  11. empty state shows "✓ No issues found" text
  12. "View all →" link hidden when no issues

  Sample mode:
  13. when sampleMode=true, shows SAMPLE_TOP_ISSUES not the passed alerts prop
  14. when sampleMode=true, renders sample disclaimer text at bottom
  15. when sampleMode=false with empty alerts, shows empty state (not sample data)
```

**Target: 15 tests**

### Test File 3: `src/__tests__/unit/ai-visibility-panel.test.tsx`

```
describe('AIVisibilityPanel')
  1.  renders score number when score is not null
  2.  renders '—' when score is null
  3.  renders positive delta in emerald color when score > previousScore
  4.  renders negative delta in red color when score < previousScore
  5.  renders no delta when previousScore is null
  6.  renders benchmark "above average" text when benchmark.org_count >= 10 and score > avg
  7.  renders benchmark "below average" text when benchmark.org_count >= 10 and score < avg
  8.  renders "Building benchmark..." when benchmark is null
  9.  renders "Building benchmark..." when benchmark.org_count < 10
  10. InfoTooltip trigger is present
```

**Target: 10 tests**

### Test File 4: `src/__tests__/unit/wrong-facts-panel.test.tsx`

```
describe('WrongFactsPanel')
  1.  renders alertCount as a large number
  2.  when alertCount === 0: shows green color and "No wrong facts detected" text
  3.  when alertCount > 0: shows red/amber color
  4.  entire panel is a link to '/dashboard/alerts'
  5.  renders InfoTooltip trigger
```

**Target: 5 tests**

### Test File 5: `src/__tests__/unit/ai-bot-access-panel.test.tsx`

```
describe('AIBotAccessPanel')
  1.  renders one row per bot in the bots array
  2.  blocked bots show red/error visual indicator
  3.  allowed bots show green visual indicator
  4.  blocked bots appear before allowed bots (sorted by blocked first)
  5.  visit_count rendered for each bot
  6.  renders "Unknown" status when bot status is ambiguous
  7.  panel links to '/dashboard/bot-activity'
  8.  renders InfoTooltip trigger
```

**Target: 8 tests**

### Test File 6: `src/__tests__/unit/last-scan-panel.test.tsx`

```
describe('LastScanPanel')
  1.  when lastScanAt is null: shows "First scan runs this Sunday"
  2.  when lastScanAt is 2 days ago: shows relative text (e.g. "2 days ago")
  3.  when lastScanAt is 10 days ago: shows absolute date (something is wrong)
  4.  when lastScanAt is > 14 days ago: shows warning badge
  5.  "Next scan in X days" computed correctly from lastScanAt + 7 days
  6.  panel links to '/dashboard/system-health'
```

**Target: 6 tests**

### E2E Test File: `src/__tests__/e2e/sprint-g-smoke.spec.ts`

```
describe('Sprint G — Dashboard Redesign E2E Smoke Tests')

  Layout:
  1.  dashboard renders 4 stat panels in the top row
  2.  top-issues-panel is visible below the stat panels
  3.  SOVTrendChart is NOT present on the dashboard page
  4.  HallucinationsByModel chart is NOT present on the dashboard page
  5.  SOVTrendChart IS present on the share-of-voice page
  6.  HallucinationsByModel IS present on the alerts page

  Sample mode (new user):
  7.  stat panels show SampleDataBadge when isSampleMode() is true
  8.  TopIssuesPanel shows sample issues text in sample mode
  9.  LastScanPanel does NOT show SampleDataBadge (always shows real timing)

  Panels (real data):
  10. AIVisibilityPanel shows a score number (or '—' for new org)
  11. WrongFactsPanel renders and links to /dashboard/alerts
  12. AIBotAccessPanel renders at least one bot row
  13. LastScanPanel shows scan timing text

  Top Issues:
  14. TopIssuesPanel renders up to 5 issue rows for an org with open alerts
  15. "Fix with AI" button links to /dashboard/alerts
  16. "View all →" link navigates to /dashboard/alerts
  17. Empty state "✓ No issues found" shown for org with 0 open alerts

  Accessibility:
  18. All InfoTooltip triggers are keyboard-focusable (Tab-reachable)
  19. WrongFactsPanel "No wrong facts detected" text is visible in accessible form
```

**Total Playwright: 19 tests**

### Run commands:

```bash
npx vitest run src/__tests__/unit/issue-descriptions.test.ts
npx vitest run src/__tests__/unit/top-issues-panel.test.tsx
npx vitest run src/__tests__/unit/ai-visibility-panel.test.tsx
npx vitest run src/__tests__/unit/wrong-facts-panel.test.tsx
npx vitest run src/__tests__/unit/ai-bot-access-panel.test.tsx
npx vitest run src/__tests__/unit/last-scan-panel.test.tsx
npx vitest run                                                 # All units — 0 regressions A–G
npx playwright test src/__tests__/e2e/sprint-g-smoke.spec.ts
npx tsc --noEmit                                               # 0 new type errors
```

---

## 📂 Files to Create / Modify

| # | File | Action | Component |
|---|------|--------|-----------|
| 1 | `lib/issue-descriptions.ts` | **CREATE** | Plain-English alert + finding templates |
| 2 | `app/dashboard/_components/panels/AIVisibilityPanel.tsx` | **CREATE** | Gauge + delta + benchmark |
| 3 | `app/dashboard/_components/panels/WrongFactsPanel.tsx` | **CREATE** | Alert count, clickable |
| 4 | `app/dashboard/_components/panels/AIBotAccessPanel.tsx` | **CREATE** | Bot access list |
| 5 | `app/dashboard/_components/panels/LastScanPanel.tsx` | **CREATE** | Scan timing |
| 6 | `app/dashboard/_components/TopIssuesPanel.tsx` | **CREATE** | Plain-English issues list |
| 7 | `lib/sample-data/sample-dashboard-data.ts` | **MODIFY** | Add SAMPLE_WRONG_FACTS_COUNT, SAMPLE_BOT_DATA |
| 8 | `app/dashboard/page.tsx` | **MODIFY** | New layout; add top alerts + bot data fetches; remove SOV/Hallucinations charts |
| 9 | `app/dashboard/share-of-voice/page.tsx` | **MODIFY** | Add SOVTrendChart if not already there |
| 10 | `app/dashboard/alerts/page.tsx` | **MODIFY** | Add HallucinationsByModel if not already there |
| 11 | `src/__tests__/unit/issue-descriptions.test.ts` | **CREATE** | 25 tests |
| 12 | `src/__tests__/unit/top-issues-panel.test.tsx` | **CREATE** | 15 tests |
| 13 | `src/__tests__/unit/ai-visibility-panel.test.tsx` | **CREATE** | 10 tests |
| 14 | `src/__tests__/unit/wrong-facts-panel.test.tsx` | **CREATE** | 5 tests |
| 15 | `src/__tests__/unit/ai-bot-access-panel.test.tsx` | **CREATE** | 8 tests |
| 16 | `src/__tests__/unit/last-scan-panel.test.tsx` | **CREATE** | 6 tests |
| 17 | `src/__tests__/e2e/sprint-g-smoke.spec.ts` | **CREATE** | 19 E2E tests |

**No database migrations. No new API routes. No new cron jobs.** Sprint G is entirely front-end.

---

## 🧠 Edge Cases to Handle

1. **Alert type values in your DB may differ from the templates.** The `describeAlert` function uses `type.includes('hour')`, `type.includes('location')`, etc. — substring matching is deliberately flexible. But if your actual `alert_type` values are numeric codes (`type: 1, 2, 3`) or snake_case categories that don't contain English words, the substring matching won't work. Read the actual values in `seed.sql` and `prod_schema.sql` and adjust the matching logic accordingly. The consequence sentences don't change — only the pattern matching does.

2. **`topAlerts` fetch ordering by severity.** The SQL `order('severity', { ascending: true })` assumes severity is stored as a string (`'critical'`, `'warning'`, `'info'`) or a number where lower = more severe. Read the actual column type in `prod_schema.sql`. If severity is stored differently (e.g., a numeric 1/2/3 or an enum), adjust the order direction.

3. **Bot data may not exist yet.** If no `bot_activity` table or equivalent exists in `prod_schema.sql`, `AIBotAccessPanel` must handle a null/empty `bots` prop gracefully. Show a helpful placeholder: "Bot activity data is collecting — check back after the first site crawl." Do not show an empty or broken panel.

4. **`deriveTechnicalFindings` depends on agent readiness data shape.** Read `app/dashboard/agent-readiness/page.tsx` carefully. The field `agentReadiness.llms_txt_present` may be named differently. Adjust to match actual field names. If agent readiness data isn't currently fetched in `dashboard/page.tsx`, add a fetch for just the fields needed (`llms_txt_present`, `monthly_crawl_count`).

5. **`SOVTrendChart` and `HallucinationsByModel` may already be on their detail pages.** Check before adding them — don't duplicate components that already exist there. The risk is creating two instances of the same chart on the same page.

6. **`previousScore` for the delta in `AIVisibilityPanel`.** If `ai_scores` doesn't have a `previous_reality_score` column (it probably doesn't), compute the delta by fetching the second most recent score row for the org. Or simply omit the delta if there's no clean source for it — showing "no change" is better than showing a wrong number. Document the decision.

7. **BenchmarkComparisonCard vs. AIVisibilityPanel.** Sprint F added `BenchmarkComparisonCard` as a standalone card. Sprint G's `AIVisibilityPanel` incorporates benchmark data inline (below the gauge). Decide: does `BenchmarkComparisonCard` stay as a separate card below the stat panels, or is it fully replaced by the inline benchmark text in `AIVisibilityPanel`? The reference screenshot suggests inline is better (no separate panel). If you move it inline, remove `BenchmarkComparisonCard` from `dashboard/page.tsx` to avoid showing the data twice.

8. **Sample mode + `TopIssuesPanel` interaction.** When `sampleMode === true`, `TopIssuesPanel` renders `SAMPLE_TOP_ISSUES`. These are `AlertRecord[]` objects — `describeAlert()` converts them to `IssueDescription` objects at render time. The sample data must have `alert_type` values that match one of the templates in `describeAlert()` — otherwise they'll all hit the fallback. Verify each sample alert type maps to a real template.

9. **`LastScanPanel` — "next scan in X days" math.** The "next scan" is computed as `lastScanAt + 7 days`. If the cron doesn't run exactly every 7 days (it might be every Sunday at a fixed time), this computation may be slightly off. Use `next Sunday after lastScanAt` for accuracy if the scan is a fixed-day-of-week cron. Document which approach is used.

10. **InfoTooltip import consistency.** All four panel components import `InfoTooltip` from `@/components/ui/InfoTooltip`. Ensure this is the Sprint B component — not a re-implementation. One import, one component, consistent behavior.

11. **Tailwind grid responsive breakpoints.** The 4-panel top row uses `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`. On a 13" laptop screen at 1280px wide, this renders as 4 columns. On a 768px tablet, 2 columns. On mobile, 1 column. Verify the layout looks correct at all three breakpoints before shipping — the panels must not overflow horizontally at any viewport.

---

## 🚫 What NOT to Do

1. **DO NOT remove `SOVTrendChart` or `HallucinationsByModel` from the dashboard without first confirming they exist on their detail pages.** Users must never lose access to data — only its location changes.
2. **DO NOT add new Supabase queries for data that's already fetched** in `dashboard/page.tsx`. Reuse existing fetches. The dashboard is already doing multiple round-trips — don't add more.
3. **DO NOT hardcode issue descriptions** in the component JSX. All plain-English text lives in `lib/issue-descriptions.ts`. Components call `describeAlert()` or `describeTechnicalFinding()` — never format their own issue text.
4. **DO NOT show real benchmark data in sample mode.** `AIVisibilityPanel` must use `null` for benchmark comparison when `sampleMode === true` — same rule as `BenchmarkComparisonCard` (AI_RULES §57).
5. **DO NOT apply `SampleDataBadge` to `LastScanPanel`.** The scan timing is always real — it shows when the cron actually ran or "first scan runs this Sunday." Showing a fake scan time would be misleading.
6. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12).
7. **DO NOT modify `middleware.ts`** (AI_RULES §6).
8. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).
9. **DO NOT add more than 5 issues to `TopIssuesPanel`.** The value of the panel is its ruthless prioritization. If everything is important, nothing is. Cap at 5, link "View all →" to the full alerts page.
10. **DO NOT use jargon in the issue headlines.** Every headline must be readable by a restaurant owner or dental practice manager with no technical background. Words to avoid: "hallucination," "entity," "crawler," "schema," "SOV," "canonicalization." Explain the consequence, not the mechanism.
11. **DO NOT show the `WrongFactsPanel` with a count of 0 as a bad state.** Zero wrong facts is a success state — it should be green and celebratory: "✓ No wrong facts detected." Not a grey zero.
12. **DO NOT add the TopIssuesPanel to any page other than the main dashboard.** It is a dispatch surface — its job is to surface the most critical issues at a glance and link to detail pages. It is not a detail view itself.

---

## ✅ Definition of Done (AI_RULES §13.5)

**`lib/issue-descriptions.ts`:**
- [ ] `describeAlert()` covers all actual `alert_type` values found in `prod_schema.sql` and `seed.sql`
- [ ] Every template produces a consequence sentence (no fallback used for known types)
- [ ] `describeTechnicalFinding()` covers 5 technical finding types
- [ ] `getModelName()` maps all model identifiers in the DB to human-readable names
- [ ] No jargon words appear in any headline ("hallucination," "entity," "SOV," "schema," "canonicalization")

**Dashboard panels:**
- [ ] `AIVisibilityPanel` — gauge renders, delta shows, benchmark text shows or "Building..." fallback
- [ ] `WrongFactsPanel` — count renders, zero state is green/celebratory, panel links to alerts
- [ ] `AIBotAccessPanel` — bot rows render, blocked bots first, handles empty/null gracefully
- [ ] `LastScanPanel` — "5 days ago" / "this Sunday" / warning when > 14 days
- [ ] All 4 panels render correctly in sample mode with SampleDataBadge (except LastScanPanel)
- [ ] 4-panel grid responsive at mobile (1 col), tablet (2 col), desktop (4 col)

**`TopIssuesPanel`:**
- [ ] Maximum 5 issues rendered
- [ ] Issues sorted: critical → warning → info
- [ ] Each row has correct `data-testid`, severity badge, category badge, and CTA
- [ ] "Fix with AI" button present for hallucination alerts (costsCredit: true)
- [ ] "How to fix →" link present for technical findings
- [ ] Empty state shows "✓ No issues found" when 0 issues
- [ ] Sample mode shows `SAMPLE_TOP_ISSUES` with sample disclaimer
- [ ] "View all →" links to `/dashboard/alerts`

**Layout:**
- [ ] `SOVTrendChart` confirmed present on `/dashboard/share-of-voice` before removal
- [ ] `HallucinationsByModel` confirmed present on `/dashboard/alerts` before removal
- [ ] Both charts removed from `dashboard/page.tsx`
- [ ] `BenchmarkComparisonCard` either removed (if subsumed by `AIVisibilityPanel`) or kept (if not) — decision documented in DEVLOG
- [ ] `SampleModeBanner` (Sprint B) still renders at top of dashboard
- [ ] `PositioningBanner` (Sprint D) still renders at top of dashboard

**Tests:**
- [ ] `issue-descriptions.test.ts` — **25 tests passing**
- [ ] `top-issues-panel.test.tsx` — **15 tests passing**
- [ ] `ai-visibility-panel.test.tsx` — **10 tests passing**
- [ ] `wrong-facts-panel.test.tsx` — **5 tests passing**
- [ ] `ai-bot-access-panel.test.tsx` — **8 tests passing**
- [ ] `last-scan-panel.test.tsx` — **6 tests passing**
- [ ] `npx vitest run` — ALL tests across Sprints A–G passing, zero regressions
- [ ] `sprint-g-smoke.spec.ts` — **19 E2E tests passing**
- [ ] `npx tsc --noEmit` — 0 new type errors

---

## 📓 DEVLOG Entry Format

```markdown
## [DATE] — Sprint G: Human-Readable Dashboard (Completed)

**Goal:** Redesign dashboard from data display to action surface. Plain-English issues, consequence-first stat panels, jargon retired from the homepage.

**Scope:**
- `lib/issue-descriptions.ts` — NEW. describeAlert() with [N] alert type templates. describeTechnicalFinding() with 5 technical types. getModelName() mapping [N] model identifiers.
- Alert type values found in DB: [list actual values from prod_schema.sql]
- `AIVisibilityPanel` — NEW. Gauge + delta (source: [document where previousScore came from]) + benchmark inline text.
- `WrongFactsPanel` — NEW. Open alert count; green zero state; links to /dashboard/alerts.
- `AIBotAccessPanel` — NEW. Bot data source: [table name from prod_schema.sql]. [N] bots rendered. Blocked-first ordering.
- `LastScanPanel` — NEW. lastScanAt source: [column/table]. "Next scan" logic: [fixed Sunday / lastScanAt + 7 days].
- `TopIssuesPanel` — NEW. Merges alert + technical findings, sorted by severity, max 5, sample mode support.
- Sample data: SAMPLE_WRONG_FACTS_COUNT=3, SAMPLE_BOT_DATA (4 bots), SAMPLE_TOP_ISSUES uses SAMPLE_TOP_ISSUES from issue-descriptions.ts.
- `dashboard/page.tsx` — MODIFIED. New 4-panel top row. TopIssuesPanel added. SOVTrendChart removed. HallucinationsByModel removed. [N] new Supabase fetches added (topAlerts, botData).
- SOVTrendChart — confirmed present / added to share-of-voice/page.tsx before removal from dashboard.
- HallucinationsByModel — confirmed present / added to alerts/page.tsx before removal from dashboard.
- BenchmarkComparisonCard — [removed (subsumed by AIVisibilityPanel) / kept as separate card — reason: ...]

**Tests added:**
- issue-descriptions.test.ts — 25 tests
- top-issues-panel.test.tsx — 15 tests
- ai-visibility-panel.test.tsx — 10 tests
- wrong-facts-panel.test.tsx — 5 tests
- ai-bot-access-panel.test.tsx — 8 tests
- last-scan-panel.test.tsx — 6 tests
- sprint-g-smoke.spec.ts — 19 E2E tests
- Sprint G total: 69 Vitest + 19 Playwright

**Cumulative totals (Sprints A–G):**
- Vitest: [N] total
- Playwright: [N] total

**Before/After:**
- Before: dashboard opened to a wall of gauges labelled "Reality Score," "AI Health Score," "Entity Health." A new user needed a 20-minute call to understand what they were looking at.
- After: dashboard opens to 4 plain-English stat panels + a Top Issues list that reads like a human wrote it. "ChatGPT says you close at 10pm — your real hours are until 2am." No jargon. No chart-reading required.
- SOVTrendChart: moved from dashboard → /dashboard/share-of-voice.
- HallucinationsByModel: moved from dashboard → /dashboard/alerts.
- Jargon words removed from dashboard headlines: hallucination, entity, SOV, schema, canonicalization.
```

---

## 🔮 AI_RULES Update (Add to `AI_RULES.md`)

```markdown
## 58. 🗣️ Issue Descriptions — Consequence-First Copy (Sprint G)

`lib/issue-descriptions.ts` is the single source of truth for all issue descriptions shown to users.

* **Rule:** Every issue type must have a consequence sentence in `describeAlert()` or `describeTechnicalFinding()`. Hitting the fallback branch is a bug — add a template for that type.
* **Jargon ban:** These words must NEVER appear in a headline shown to customers: hallucination, entity, SOV, schema, canonicalization, robots.txt (OK in subtext only), crawler (use "AI bot" instead), RPC, SERP.
* **Formula:** `[Who is wrong] + [what they're saying wrong] + [what the truth is]`
* **Severity rule:** wrong_hours / wrong_location / wrong_phone / wrong_credentials = critical. Missing llms.txt / blocked bot / wrong prices = warning. Content optimization / thin content = info.
* **Sync rule:** When new alert types are added to the DB, add a corresponding template to `describeAlert()` in the same PR. The fallback must never be the production experience.

## 59. 📊 Dashboard = Dispatch Surface, Not Data Dump (Sprint G)

The main dashboard (`app/dashboard/page.tsx`) is an action surface — not a detail view.

* **Rule:** The dashboard shows at most: 4 stat panels, 1 Top Issues panel (max 5 rows), persistent banners (sample mode, positioning). No charts. No tables. No pagination.
* **Charts belong on detail pages:** SOVTrendChart → /dashboard/share-of-voice. HallucinationsByModel → /dashboard/alerts. This separation is intentional and permanent.
* **TopIssuesPanel max:** 5 issues. Never more. Link "View all →" to the full alerts page.
* **Never remove data — only relocate it.** Before removing any card from the dashboard, verify it exists on its detail page. Data may only move, never disappear.
```

---

## 📚 Document Sync + Git Commit

### Step 1: Update `MEMORY.md`

```markdown
## Dashboard Architecture Post-Sprint G (2026-[DATE])
- Dashboard = 4 stat panels (top) + TopIssuesPanel (full width below)
- No charts on dashboard. Charts live on detail pages.
- lib/issue-descriptions.ts: single source of truth for all customer-facing issue text
- Alert type values in DB: [document actual values discovered during implementation]
- Bot data source: [table name]
- lastScanAt source: [column/table]
- BenchmarkComparisonCard: [removed / kept — and why]
- previousScore delta source: [document]

## localStorage Key Registry (updated Sprint G — no new keys added)
```

### Step 2: Git Commit

```bash
git add -A
git commit -m "Sprint G: Human-Readable Dashboard — Plain-English Issues & Consequence-First Design

- lib/issue-descriptions.ts: describeAlert() ([N] types), describeTechnicalFinding() (5 types), getModelName()
- AIVisibilityPanel: gauge + delta + benchmark inline — replaces RealityScoreCard + BenchmarkComparisonCard
- WrongFactsPanel: open alert count, green zero state, links to /dashboard/alerts
- AIBotAccessPanel: blocked-first bot list, handles null gracefully
- LastScanPanel: relative/absolute scan timing, 14-day warning, next scan computed
- TopIssuesPanel: max 5 issues, critical→warning→info, Fix with AI + How to fix CTAs
- dashboard/page.tsx: new 4-panel layout; topAlerts + botData fetches added
- SOVTrendChart moved to /dashboard/share-of-voice (confirmed present before removal)
- HallucinationsByModel moved to /dashboard/alerts (confirmed present before removal)
- sample-dashboard-data.ts: SAMPLE_WRONG_FACTS_COUNT, SAMPLE_BOT_DATA added
- tests: 69 Vitest + 19 Playwright; 0 regressions across Sprints A–G
- AI_RULES: 58 (consequence-first copy), 59 (dashboard = dispatch surface)

Jargon retired from dashboard: hallucination, entity, SOV, schema, canonicalization.
Before: wall of labelled gauges. After: 4 plain-English panels + prioritized issue list."

git push origin main
```

---

## 🏁 Sprint Outcome

After Sprint G, the dashboard answers the three questions every new user silently asks — in under 3 seconds, without any training:

**"How bad is it?"**
→ AI Visibility gauge (62%) with benchmark ("11 above Alpharetta avg") tells them at a glance

**"What specifically is wrong?"**
→ Top Issues list says it in plain English: "ChatGPT says you close at 10pm — your real hours are until 2am"

**"What do I do right now?"**
→ "Fix with AI" button takes them directly to the correction flow, one click away

The product that required a 20-minute onboarding call now explains itself. That's the difference between a product that churns at 60% and one that retains.
