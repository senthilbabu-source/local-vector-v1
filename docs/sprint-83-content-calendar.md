# Sprint 83 — Proactive Content Calendar

> **Claude Code Prompt — First-Pass Ready**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`

---

## 🎯 Objective

Build the **Proactive Content Calendar** — an AI-driven publishing schedule that tells restaurant owners WHEN to publish WHAT content. Instead of reacting to problems, this feature proactively recommends content actions based on signals from every engine in the platform.

**Why it's wow:** Transforms LocalVector from a rearview mirror ("here's what happened") into a windshield ("here's what to do next"). Every recommendation is backed by real data — not generic SEO tips.

**The user sees:**
```
📅 AI-Recommended Publishing Calendar
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This Week:
  📝 Publish: "Valentine's Day Hookah Experience"
     (Occasion Engine: Valentine's queries peak in 4 days)
     [View content brief →] [Generate draft →]

Next Week:
  📝 Update: Menu page (last updated 45 days ago)
     (Freshness signal declining — GPTBot visits dropped 30%)
     [See recommended changes →]

In 2 Weeks:
  📝 Create: "Private Events at Charcoal N Chill"
     (SOV Gap: 0% for "private event venue Alpharetta")
     [View content brief →]
```

**Architecture:** Pure aggregation service that pulls signals from 5 existing data sources, scores urgency, and generates time-bucketed content recommendations. No new tables, no AI calls — all deterministic from existing data.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                          — All engineering rules (§4, §20, §36.1)
Read CLAUDE.md                                 — Project context + architecture
Read supabase/prod_schema.sql                  — All source tables (below)
Read lib/supabase/database.types.ts            — Full Database type (§38)
Read src/__fixtures__/golden-tenant.ts          — Golden Tenant fixtures (§4)
Read app/dashboard/content-drafts/             — Content Drafts page + OccasionTimeline (§36.1)
Read app/dashboard/_components/                — Sidebar pattern
```

**Signal source tables to understand:**
```
Read local_occasions table                     — Upcoming occasions with trigger_days_before
Read sov_evaluations table                     — SOV rank per query per engine (gaps = rank null)
Read target_queries table                      — Monitored queries per org
Read page_audits table                         — Page freshness via last_audited_at
Read crawler_hits table                        — Bot visit frequency (freshness decay signal)
Read magic_menus table                         — Menu freshness via updated_at
Read competitor_intercepts table               — Competitor gaps via gap_analysis + suggested_action
Read ai_hallucinations table                   — Open hallucinations needing correction content
Read content_drafts table                      — Existing drafts (to avoid duplicate recommendations)
```

---

## 🏗️ Architecture — What to Build

### Signal Sources (5 independent data feeds)

```
Signal 1: OCCASIONS                    Signal 2: SOV GAPS
local_occasions                        sov_evaluations + target_queries
  │ upcoming within trigger window       │ queries where rank_position IS NULL
  │ → "Publish occasion content"         │ → "Create content for this query"
  │                                      │
Signal 3: FRESHNESS DECAY             Signal 4: COMPETITOR GAPS
page_audits.last_audited_at           competitor_intercepts
crawler_hits (bot visit frequency)      │ gaps where action_status = 'pending'
magic_menus.updated_at                  │ → "Address competitive weakness"
  │ pages not updated in 30+ days        │
  │ → "Update this page"                 │
  │                                      │
Signal 5: HALLUCINATION CORRECTIONS
ai_hallucinations
  │ correction_status = 'open'
  │ → "Create correction content"
  │
  ▼
┌─────────────────────────────────────────┐
│  Content Calendar Service (pure)        │
│  generateContentCalendar(input)         │
│                                         │
│  1. Generate recommendations from each  │
│     signal source                       │
│  2. Score urgency (0-100)              │
│  3. Assign time bucket                  │
│  4. Deduplicate                         │
│  5. Sort by urgency within bucket      │
│  6. Filter out existing drafts          │
└─────────────────────────────────────────┘
  │
  ▼
Dashboard: /dashboard/content-calendar
  ├── This Week (7 days)
  ├── Next Week (8-14 days)
  ├── In 2 Weeks (15-21 days)
  └── Later (22+ days)
```

---

### Component 1: Content Calendar Service — `lib/services/content-calendar.service.ts`

Pure functions only. No I/O, no AI calls.

```typescript
// ── Types ─────────────────────────────────────────────

export type RecommendationType =
  | 'occasion'          // Upcoming occasion → publish occasion-specific content
  | 'sov_gap'           // Zero/low SOV → create content targeting that query
  | 'freshness_update'  // Stale page → update existing content
  | 'competitor_gap'    // Competitor winning → address competitive weakness
  | 'hallucination_fix' // Open hallucination → create correction content
  ;

export type TimeBucket = 'this_week' | 'next_week' | 'two_weeks' | 'later';

export type ActionVerb = 'publish' | 'update' | 'create';

export interface ContentRecommendation {
  /** Unique key for deduplication */
  key: string;
  /** What to do */
  action: ActionVerb;
  /** Recommended title / topic */
  title: string;
  /** Human-readable reason backed by data */
  reason: string;
  /** Which signal generated this */
  type: RecommendationType;
  /** Urgency score 0-100 (higher = more urgent) */
  urgency: number;
  /** When to do it */
  timeBucket: TimeBucket;
  /** Days until this becomes critical (null = no deadline) */
  daysUntilDeadline: number | null;
  /** Suggested content_type for the draft */
  suggestedContentType: string;
  /** CTA links */
  ctas: Array<{
    label: string;
    href: string;
  }>;
  /** Source data reference for traceability */
  sourceId: string | null;
}

export interface ContentCalendarResult {
  /** Recommendations grouped by time bucket */
  thisWeek: ContentRecommendation[];
  nextWeek: ContentRecommendation[];
  twoWeeks: ContentRecommendation[];
  later: ContentRecommendation[];
  /** Total recommendation count */
  totalCount: number;
  /** Signal source summary */
  signalSummary: {
    occasionCount: number;
    sovGapCount: number;
    freshnessCount: number;
    competitorGapCount: number;
    hallucinationFixCount: number;
  };
}

// ── Input types ───────────────────────────────────────

export interface CalendarInput {
  businessName: string;
  locationId: string;

  /** Signal 1: Upcoming occasions within trigger window */
  occasions: Array<{
    id: string;
    name: string;
    occasionType: string;
    annualDate: string | null;
    triggerDaysBefore: number;
    peakQueryPatterns: string[];
  }>;

  /** Signal 2: SOV gap queries (rank_position IS NULL across all engines) */
  sovGaps: Array<{
    queryId: string;
    queryText: string;
    queryCategory: string;
    /** How many engines returned null rank for this query */
    missingEngineCount: number;
    /** Total engines that ran this query */
    totalEngineCount: number;
  }>;

  /** Signal 3: Stale pages (not audited/updated recently) */
  stalePages: Array<{
    pageUrl: string;
    pageType: string;
    lastAuditedAt: string;
    overallScore: number | null;
    daysSinceAudit: number;
  }>;

  /** Signal 3b: Stale menu */
  staleMenu: {
    menuId: string;
    lastUpdatedAt: string;
    daysSinceUpdate: number;
    recentBotVisitCount: number;
    previousBotVisitCount: number;
  } | null;

  /** Signal 4: Pending competitor gap actions */
  competitorGaps: Array<{
    id: string;
    competitorName: string;
    queryAsked: string;
    winningFactor: string | null;
    suggestedAction: string | null;
    gapMagnitude: string | null;
  }>;

  /** Signal 5: Open hallucinations needing correction content */
  openHallucinations: Array<{
    id: string;
    claimText: string;
    severity: string;
    modelProvider: string;
  }>;

  /** Existing drafts (to filter out already-addressed recommendations) */
  existingDraftTriggerIds: Set<string>;
}

// ── Pure computation ──────────────────────────────────

/**
 * Generate the proactive content calendar from all signal sources.
 * Pure function — no I/O, no side effects.
 */
export function generateContentCalendar(input: CalendarInput): ContentCalendarResult {
  const recommendations: ContentRecommendation[] = [];

  // Signal 1: Occasions
  recommendations.push(...generateOccasionRecommendations(input));

  // Signal 2: SOV Gaps
  recommendations.push(...generateSOVGapRecommendations(input));

  // Signal 3: Freshness Decay
  recommendations.push(...generateFreshnessRecommendations(input));

  // Signal 4: Competitor Gaps
  recommendations.push(...generateCompetitorGapRecommendations(input));

  // Signal 5: Hallucination Corrections
  recommendations.push(...generateHallucinationFixRecommendations(input));

  // Filter out recommendations for which drafts already exist
  const filtered = recommendations.filter(
    r => !r.sourceId || !input.existingDraftTriggerIds.has(r.sourceId)
  );

  // Deduplicate by key
  const deduped = deduplicateByKey(filtered);

  // Sort each bucket by urgency descending
  const buckets = groupByTimeBucket(deduped);

  return {
    thisWeek: buckets.this_week,
    nextWeek: buckets.next_week,
    twoWeeks: buckets.two_weeks,
    later: buckets.later,
    totalCount: deduped.length,
    signalSummary: {
      occasionCount: deduped.filter(r => r.type === 'occasion').length,
      sovGapCount: deduped.filter(r => r.type === 'sov_gap').length,
      freshnessCount: deduped.filter(r => r.type === 'freshness_update').length,
      competitorGapCount: deduped.filter(r => r.type === 'competitor_gap').length,
      hallucinationFixCount: deduped.filter(r => r.type === 'hallucination_fix').length,
    },
  };
}

// ── Signal generators ─────────────────────────────────

function generateOccasionRecommendations(input: CalendarInput): ContentRecommendation[] {
  const today = new Date();
  return input.occasions.map(occasion => {
    const daysUntilPeak = occasion.annualDate
      ? computeDaysUntilDate(occasion.annualDate, today)
      : null;

    // Urgency: closer = more urgent. Max 95 for imminent occasions.
    const urgency = daysUntilPeak !== null
      ? Math.max(0, Math.min(95, 100 - daysUntilPeak * 2))
      : 50;

    const timeBucket = assignTimeBucket(daysUntilPeak ?? 14);

    return {
      key: `occasion:${occasion.id}`,
      action: 'publish' as const,
      title: `${occasion.name} content for ${input.businessName}`,
      reason: daysUntilPeak !== null
        ? `Occasion Engine: ${occasion.name} queries peak in ${daysUntilPeak} days`
        : `Upcoming ${occasion.occasionType}: ${occasion.name}`,
      type: 'occasion' as const,
      urgency,
      timeBucket,
      daysUntilDeadline: daysUntilPeak,
      suggestedContentType: 'occasion_page',
      ctas: [
        { label: 'Create Draft →', href: `/dashboard/content-drafts?trigger_type=occasion&trigger_id=${occasion.id}` },
      ],
      sourceId: occasion.id,
    };
  });
}

function generateSOVGapRecommendations(input: CalendarInput): ContentRecommendation[] {
  return input.sovGaps
    .sort((a, b) => b.missingEngineCount - a.missingEngineCount)
    .slice(0, 5) // Top 5 worst SOV gaps
    .map(gap => {
      // Urgency: more missing engines = more urgent
      const gapRatio = gap.totalEngineCount > 0
        ? gap.missingEngineCount / gap.totalEngineCount
        : 1;
      const urgency = Math.round(gapRatio * 80); // Max 80 for SOV gaps

      return {
        key: `sov_gap:${gap.queryId}`,
        action: 'create' as const,
        title: `Content targeting "${gap.queryText}"`,
        reason: `SOV Gap: Not ranked by ${gap.missingEngineCount} of ${gap.totalEngineCount} AI engines for "${gap.queryText}"`,
        type: 'sov_gap' as const,
        urgency,
        timeBucket: 'next_week' as const, // SOV gaps are important but not urgent
        daysUntilDeadline: null,
        suggestedContentType: gap.queryCategory === 'occasion' ? 'occasion_page' : 'blog_post',
        ctas: [
          { label: 'View Content Brief →', href: `/dashboard/content-drafts?trigger_type=prompt_missing&query=${encodeURIComponent(gap.queryText)}` },
        ],
        sourceId: gap.queryId,
      };
    });
}

function generateFreshnessRecommendations(input: CalendarInput): ContentRecommendation[] {
  const recs: ContentRecommendation[] = [];

  // Stale pages (not audited in 30+ days)
  for (const page of input.stalePages) {
    if (page.daysSinceAudit < 30) continue; // Only flag stale pages

    const urgency = Math.min(85, 40 + page.daysSinceAudit); // More stale = more urgent, cap at 85

    recs.push({
      key: `freshness:${page.pageUrl}`,
      action: 'update' as const,
      title: `Update ${page.pageType} page`,
      reason: `Last audited ${page.daysSinceAudit} days ago${page.overallScore !== null ? ` (score: ${page.overallScore}/100)` : ''}`,
      type: 'freshness_update' as const,
      urgency,
      timeBucket: page.daysSinceAudit > 60 ? 'this_week' as const : 'next_week' as const,
      daysUntilDeadline: null,
      suggestedContentType: page.pageType === 'faq' ? 'faq_page' : 'landing_page',
      ctas: [
        { label: 'Re-Audit Page →', href: '/dashboard/page-audits' },
      ],
      sourceId: null,
    });
  }

  // Stale menu with declining bot visits
  if (input.staleMenu && input.staleMenu.daysSinceUpdate > 30) {
    const botDecline = input.staleMenu.previousBotVisitCount > 0
      ? Math.round(
          ((input.staleMenu.previousBotVisitCount - input.staleMenu.recentBotVisitCount) /
            input.staleMenu.previousBotVisitCount) * 100
        )
      : 0;

    const urgency = Math.min(90, 50 + input.staleMenu.daysSinceUpdate);

    recs.push({
      key: `freshness:menu`,
      action: 'update' as const,
      title: 'Update menu page',
      reason: `Menu last updated ${input.staleMenu.daysSinceUpdate} days ago${botDecline > 0 ? ` — AI bot visits dropped ${botDecline}%` : ''}`,
      type: 'freshness_update' as const,
      urgency,
      timeBucket: input.staleMenu.daysSinceUpdate > 45 ? 'this_week' as const : 'next_week' as const,
      daysUntilDeadline: null,
      suggestedContentType: 'landing_page',
      ctas: [
        { label: 'Update Menu →', href: '/dashboard/menus' },
      ],
      sourceId: input.staleMenu.menuId,
    });
  }

  return recs;
}

function generateCompetitorGapRecommendations(input: CalendarInput): ContentRecommendation[] {
  return input.competitorGaps
    .slice(0, 3) // Top 3 competitor gaps
    .map(gap => {
      const urgency = gap.gapMagnitude === 'large' ? 70
        : gap.gapMagnitude === 'medium' ? 55
        : 40;

      return {
        key: `competitor:${gap.id}`,
        action: 'create' as const,
        title: gap.suggestedAction
          ? truncate(gap.suggestedAction, 80)
          : `Address competitive gap vs ${gap.competitorName}`,
        reason: `${gap.competitorName} winning on "${truncate(gap.queryAsked ?? '', 50)}"${gap.winningFactor ? ` — factor: ${gap.winningFactor}` : ''}`,
        type: 'competitor_gap' as const,
        urgency,
        timeBucket: 'two_weeks' as const,
        daysUntilDeadline: null,
        suggestedContentType: 'blog_post',
        ctas: [
          { label: 'View Gap Analysis →', href: '/dashboard/competitors' },
        ],
        sourceId: gap.id,
      };
    });
}

function generateHallucinationFixRecommendations(input: CalendarInput): ContentRecommendation[] {
  return input.openHallucinations
    .slice(0, 3) // Top 3 open hallucinations
    .map(h => {
      const urgency = h.severity === 'critical' ? 90
        : h.severity === 'high' ? 75
        : 55;

      return {
        key: `hallucination:${h.id}`,
        action: 'create' as const,
        title: `Correction content: "${truncate(h.claimText, 60)}"`,
        reason: `${formatProvider(h.modelProvider)} is spreading this inaccuracy — publish correction content`,
        type: 'hallucination_fix' as const,
        urgency,
        timeBucket: urgency >= 75 ? 'this_week' as const : 'next_week' as const,
        daysUntilDeadline: null,
        suggestedContentType: 'blog_post',
        ctas: [
          { label: 'Generate Correction →', href: `/dashboard/hallucinations` },
        ],
        sourceId: h.id,
      };
    });
}

// ── Helpers ───────────────────────────────────────────

function computeDaysUntilDate(annualDate: string, today: Date): number {
  // annualDate format: "MM-DD" (e.g., "02-14" for Valentine's)
  const [month, day] = annualDate.split('-').map(Number);
  const thisYear = today.getFullYear();

  let target = new Date(thisYear, month - 1, day);
  // If date has passed this year, use next year
  if (target < today) {
    target = new Date(thisYear + 1, month - 1, day);
  }

  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function assignTimeBucket(daysOut: number): TimeBucket {
  if (daysOut <= 7) return 'this_week';
  if (daysOut <= 14) return 'next_week';
  if (daysOut <= 21) return 'two_weeks';
  return 'later';
}

function deduplicateByKey(recs: ContentRecommendation[]): ContentRecommendation[] {
  const seen = new Map<string, ContentRecommendation>();
  for (const r of recs) {
    const existing = seen.get(r.key);
    if (!existing || r.urgency > existing.urgency) {
      seen.set(r.key, r);
    }
  }
  return [...seen.values()];
}

function groupByTimeBucket(
  recs: ContentRecommendation[]
): Record<TimeBucket, ContentRecommendation[]> {
  const buckets: Record<TimeBucket, ContentRecommendation[]> = {
    this_week: [],
    next_week: [],
    two_weeks: [],
    later: [],
  };
  for (const r of recs) {
    buckets[r.timeBucket].push(r);
  }
  // Sort each bucket by urgency descending
  for (const bucket of Object.values(buckets)) {
    bucket.sort((a, b) => b.urgency - a.urgency);
  }
  return buckets;
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}

function formatProvider(provider: string): string {
  const map: Record<string, string> = {
    'openai-gpt4o': 'GPT-4o',
    'openai-gpt4o-mini': 'GPT-4o mini',
    'perplexity-sonar': 'Perplexity',
    'google-gemini': 'Gemini',
    'anthropic-claude': 'Claude',
  };
  return map[provider] ?? provider;
}
```

**~450 lines. All pure functions. Zero I/O.**

---

### Component 2: Data Fetcher — `lib/data/content-calendar.ts`

Fetches all 5 signal sources in parallel, assembles `CalendarInput`, calls `generateContentCalendar()`.

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  generateContentCalendar,
  type CalendarInput,
  type ContentCalendarResult,
} from '@/lib/services/content-calendar.service';

/**
 * Fetch all signal data and generate the content calendar.
 * Uses RLS-scoped client (§18).
 */
export async function fetchContentCalendar(
  supabase: SupabaseClient<Database>,
  orgId: string,
  locationId: string,
): Promise<ContentCalendarResult> {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // 9 parallel queries — one per signal source
  const [
    locationResult,
    occasionsResult,
    sovEvalsResult,
    targetQueriesResult,
    pageAuditsResult,
    menuResult,
    recentCrawlerResult,
    previousCrawlerResult,
    competitorGapsResult,
    hallucinationsResult,
    existingDraftsResult,
  ] = await Promise.all([
    // Location for business name
    supabase
      .from('locations')
      .select('business_name')
      .eq('id', locationId)
      .eq('org_id', orgId)
      .single(),

    // Signal 1: Upcoming occasions within trigger window
    supabase
      .from('local_occasions')
      .select('id, name, occasion_type, annual_date, trigger_days_before, peak_query_patterns')
      .eq('is_active', true),

    // Signal 2: SOV evaluations (recent) for gap detection
    supabase
      .from('sov_evaluations')
      .select('query_id, engine, rank_position')
      .eq('org_id', orgId)
      .eq('location_id', locationId)
      .gte('created_at', thirtyDaysAgo.toISOString()),

    // Signal 2b: Target queries for this org
    supabase
      .from('target_queries')
      .select('id, query_text, query_category')
      .eq('org_id', orgId)
      .eq('location_id', locationId),

    // Signal 3: Page audits (freshness)
    supabase
      .from('page_audits')
      .select('page_url, page_type, last_audited_at, overall_score')
      .eq('org_id', orgId),

    // Signal 3b: Latest menu
    supabase
      .from('magic_menus')
      .select('id, updated_at')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Signal 3c: Recent bot visits (last 14 days)
    supabase
      .from('crawler_hits')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('crawled_at', new Date(today.getTime() - 14 * 86400000).toISOString()),

    // Signal 3d: Previous period bot visits (15-28 days ago)
    supabase
      .from('crawler_hits')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('crawled_at', new Date(today.getTime() - 28 * 86400000).toISOString())
      .lt('crawled_at', new Date(today.getTime() - 14 * 86400000).toISOString()),

    // Signal 4: Competitor gaps (pending actions)
    supabase
      .from('competitor_intercepts')
      .select('id, competitor_name, query_asked, winning_factor, suggested_action, gap_magnitude')
      .eq('org_id', orgId)
      .eq('action_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10),

    // Signal 5: Open hallucinations
    supabase
      .from('ai_hallucinations')
      .select('id, claim_text, severity, model_provider')
      .eq('org_id', orgId)
      .eq('correction_status', 'open')
      .order('detected_at', { ascending: false })
      .limit(10),

    // Existing drafts (to avoid duplicate recommendations)
    supabase
      .from('content_drafts')
      .select('trigger_id')
      .eq('org_id', orgId)
      .not('trigger_id', 'is', null)
      .in('status', ['draft', 'approved']),
  ]);

  // ── Assemble occasions within trigger window ──
  const occasions = (occasionsResult.data ?? []).filter(o => {
    if (!o.annual_date) return false;
    const daysUntil = computeDaysUntilDate(o.annual_date, today);
    return daysUntil >= 0 && daysUntil <= o.trigger_days_before;
  }).map(o => ({
    id: o.id,
    name: o.name,
    occasionType: o.occasion_type,
    annualDate: o.annual_date,
    triggerDaysBefore: o.trigger_days_before,
    peakQueryPatterns: (o.peak_query_patterns as string[]) ?? [],
  }));

  // ── Compute SOV gaps ──
  const targetQueries = targetQueriesResult.data ?? [];
  const sovEvals = sovEvalsResult.data ?? [];

  // Group SOV evaluations by query_id
  const evalsByQuery = new Map<string, typeof sovEvals>();
  for (const e of sovEvals) {
    const arr = evalsByQuery.get(e.query_id) ?? [];
    arr.push(e);
    evalsByQuery.set(e.query_id, arr);
  }

  const sovGaps = targetQueries
    .map(q => {
      const evals = evalsByQuery.get(q.id) ?? [];
      const totalEngines = new Set(evals.map(e => e.engine)).size;
      const missingEngines = evals.filter(e => e.rank_position === null).length;
      return {
        queryId: q.id,
        queryText: q.query_text,
        queryCategory: q.query_category,
        missingEngineCount: totalEngines > 0 ? missingEngines : 0,
        totalEngineCount: totalEngines,
      };
    })
    .filter(g => g.missingEngineCount > 0);

  // ── Stale pages ──
  const stalePages = (pageAuditsResult.data ?? []).map(p => ({
    pageUrl: p.page_url,
    pageType: p.page_type,
    lastAuditedAt: p.last_audited_at,
    overallScore: p.overall_score,
    daysSinceAudit: Math.floor(
      (today.getTime() - new Date(p.last_audited_at).getTime()) / 86400000
    ),
  }));

  // ── Stale menu ──
  const menu = menuResult.data;
  const staleMenu = menu ? {
    menuId: menu.id,
    lastUpdatedAt: menu.updated_at!,
    daysSinceUpdate: Math.floor(
      (today.getTime() - new Date(menu.updated_at!).getTime()) / 86400000
    ),
    recentBotVisitCount: recentCrawlerResult.count ?? 0,
    previousBotVisitCount: previousCrawlerResult.count ?? 0,
  } : null;

  // ── Existing draft trigger IDs ──
  const existingDraftTriggerIds = new Set(
    (existingDraftsResult.data ?? [])
      .map(d => d.trigger_id)
      .filter((id): id is string => id !== null)
  );

  const input: CalendarInput = {
    businessName: locationResult.data?.business_name ?? 'Your Business',
    locationId,
    occasions,
    sovGaps,
    stalePages,
    staleMenu,
    competitorGaps: (competitorGapsResult.data ?? []).map(g => ({
      id: g.id,
      competitorName: g.competitor_name,
      queryAsked: g.query_asked ?? '',
      winningFactor: g.winning_factor,
      suggestedAction: g.suggested_action,
      gapMagnitude: g.gap_magnitude,
    })),
    openHallucinations: (hallucinationsResult.data ?? []).map(h => ({
      id: h.id,
      claimText: h.claim_text,
      severity: h.severity ?? 'high',
      modelProvider: h.model_provider,
    })),
    existingDraftTriggerIds,
  };

  return generateContentCalendar(input);
}

function computeDaysUntilDate(annualDate: string, today: Date): number {
  const [month, day] = annualDate.split('-').map(Number);
  const thisYear = today.getFullYear();
  let target = new Date(thisYear, month - 1, day);
  if (target < today) target = new Date(thisYear + 1, month - 1, day);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
```

---

### Component 3: Dashboard Page — `app/dashboard/content-calendar/page.tsx`

Server Component.

```
Page Layout:
┌──────────────────────────────────────────────────────┐
│ 📅 Content Calendar                                  │
│ AI-recommended publishing schedule based on your     │
│ data signals                                         │
├──────────────────────────────────────────────────────┤
│                                                      │
│ ┌─── Signal Summary ─────────────────────────────┐   │
│ │ 🎉 2 Occasions  📉 3 SOV Gaps  🔄 1 Stale Page│   │
│ │ ⚔️ 1 Competitor Gap  🔴 1 Hallucination Fix    │   │
│ └────────────────────────────────────────────────┘   │
│                                                      │
│ ── This Week ──────────────────────────────────────  │
│                                                      │
│ ┌ 📝 Publish: "Valentine's Day Hookah Experience" ┐  │
│ │    🎉 Occasion Engine: Valentine's queries peak  │  │
│ │       in 4 days                                   │  │
│ │    Urgency: ████████████████████░  92             │  │
│ │    [Create Draft →]                               │  │
│ └───────────────────────────────────────────────────┘  │
│                                                      │
│ ┌ 📝 Create: Correction content for "closes at 10…"┐  │
│ │    🔴 GPT-4o is spreading this inaccuracy         │  │
│ │    Urgency: ██████████████████░░░  75             │  │
│ │    [Generate Correction →]                        │  │
│ └───────────────────────────────────────────────────┘  │
│                                                      │
│ ── Next Week ──────────────────────────────────────  │
│                                                      │
│ ┌ 📝 Update: Menu page ──────────────────────────┐  │
│ │    🔄 Menu last updated 45 days ago — AI bot     │  │
│ │       visits dropped 30%                          │  │
│ │    Urgency: ██████████████░░░░░░░  65            │  │
│ │    [Update Menu →]                                │  │
│ └───────────────────────────────────────────────────┘  │
│                                                      │
│ ── In 2 Weeks ─────────────────────────────────────  │
│ ...                                                  │
│                                                      │
│ ── Later ──────────────────────────────────────────  │
│ ...                                                  │
│                                                      │
│ Empty state: "No content recommendations right now.  │
│ LocalVector will suggest content based on occasions,  │
│ SOV gaps, page freshness, and competitor activity."   │
└──────────────────────────────────────────────────────┘
```

**Sub-Components:**

**`SignalSummaryStrip`** — Horizontal row of signal counts. Each signal type with its emoji and count. Only shows signals with count > 0.

**`TimeBucketSection`** — Heading for each time bucket ("This Week", "Next Week", etc.). Only renders if bucket has recommendations. Contains list of `RecommendationCard`s.

**`RecommendationCard`** — Card per recommendation. Shows:
- Action verb badge (Publish / Update / Create) with type-specific color
- Title
- Reason (with signal emoji)
- Urgency bar (horizontal bar 0-100, color-coded: red ≥75, amber ≥50, green <50)
- CTA buttons
- `daysUntilDeadline` countdown badge if applicable

**Color coding for action verbs:**
```typescript
const ACTION_COLORS: Record<string, string> = {
  publish: 'bg-green-100 text-green-800',
  update: 'bg-amber-100 text-amber-800',
  create: 'bg-blue-100 text-blue-800',
};
```

**Color coding for recommendation types (signal emoji):**
```typescript
const TYPE_EMOJI: Record<string, string> = {
  occasion: '🎉',
  sov_gap: '📉',
  freshness_update: '🔄',
  competitor_gap: '⚔️',
  hallucination_fix: '🔴',
};
```

**Empty state:** "No content recommendations right now. LocalVector will generate recommendations when it detects upcoming occasions, SOV gaps, stale pages, competitor opportunities, or hallucinations that need correction. Run your first SOV queries and page audits to unlock data-driven recommendations."

---

### Component 4: Error Boundary + Sidebar

`app/dashboard/content-calendar/error.tsx` — Standard error boundary.

Sidebar entry:
```typescript
{
  label: 'Content Calendar',
  href: '/dashboard/content-calendar',
  icon: CalendarDays,  // from lucide-react
  testId: 'nav-content-calendar',
}
```

Place under the PRESCRIBE section of the sidebar, alongside Content Drafts.

---

### Component 5: Golden Tenant Fixtures — `src/__fixtures__/golden-tenant.ts`

```typescript
import type { CalendarInput } from '@/lib/services/content-calendar.service';

/**
 * Sprint 83 — Canonical CalendarInput for Charcoal N Chill.
 * Mixed signals: 1 occasion, 2 SOV gaps, 1 stale page, 1 competitor gap, 1 hallucination.
 */
export const MOCK_CALENDAR_INPUT: CalendarInput = {
  businessName: 'Charcoal N Chill',
  locationId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  occasions: [
    {
      id: 'occ-valentines',
      name: "Valentine's Day",
      occasionType: 'holiday',
      annualDate: '02-14',
      triggerDaysBefore: 28,
      peakQueryPatterns: ['valentines hookah', 'romantic dinner Alpharetta'],
    },
  ],
  sovGaps: [
    {
      queryId: 'q-private-events',
      queryText: 'private event venue Alpharetta',
      queryCategory: 'discovery',
      missingEngineCount: 3,
      totalEngineCount: 3,
    },
    {
      queryId: 'q-late-night',
      queryText: 'late night hookah near me',
      queryCategory: 'near_me',
      missingEngineCount: 2,
      totalEngineCount: 3,
    },
  ],
  stalePages: [
    {
      pageUrl: 'https://charcoalnchill.com/about',
      pageType: 'about',
      lastAuditedAt: '2026-01-01T00:00:00Z',
      overallScore: 62,
      daysSinceAudit: 56,
    },
  ],
  staleMenu: {
    menuId: 'menu-001',
    lastUpdatedAt: '2026-01-10T00:00:00Z',
    daysSinceUpdate: 47,
    recentBotVisitCount: 5,
    previousBotVisitCount: 12,
  },
  competitorGaps: [
    {
      id: 'ci-001',
      competitorName: 'Cloud 9 Lounge',
      queryAsked: 'best hookah lounge Alpharetta',
      winningFactor: 'wider hookah selection',
      suggestedAction: 'Create content highlighting your unique Indo-American fusion hookah menu',
      gapMagnitude: 'medium',
    },
  ],
  openHallucinations: [
    {
      id: 'hal-001',
      claimText: 'Charcoal N Chill closes at 10pm',
      severity: 'high',
      modelProvider: 'openai-gpt4o',
    },
  ],
  existingDraftTriggerIds: new Set(),
};
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/content-calendar-service.test.ts`

**Target: `lib/services/content-calendar.service.ts`**

```
describe('generateContentCalendar')
  Empty input:
  1.  returns empty buckets for empty input
  2.  returns totalCount 0 for empty input
  3.  returns all-zero signalSummary for empty input

  Occasion recommendations:
  4.  generates recommendation for upcoming occasion
  5.  computes urgency based on days until peak (closer = higher)
  6.  assigns this_week bucket for occasions within 7 days
  7.  assigns next_week bucket for occasions 8-14 days out
  8.  sets suggestedContentType to occasion_page
  9.  includes occasion id as sourceId
  10. includes CTA with trigger_type=occasion

  SOV gap recommendations:
  11. generates recommendations for queries with null rank
  12. sorts by missingEngineCount (worst gaps first)
  13. limits to top 5 SOV gaps
  14. computes urgency from gap ratio (missing / total engines)
  15. defaults SOV gaps to next_week bucket
  16. maps occasion category queries to occasion_page content type

  Freshness recommendations:
  17. generates recommendation for pages older than 30 days
  18. does NOT generate recommendation for pages younger than 30 days
  19. assigns this_week for pages older than 60 days
  20. assigns next_week for pages 30-60 days old
  21. includes daysSinceAudit in reason text
  22. includes overallScore in reason text when available

  Menu freshness:
  23. generates menu update recommendation when stale (30+ days)
  24. includes bot visit decline percentage in reason
  25. skips menu recommendation when not stale

  Competitor gap recommendations:
  26. generates recommendation from pending competitor actions
  27. limits to top 3 competitor gaps
  28. maps gapMagnitude to urgency (large=70, medium=55, small=40)
  29. assigns two_weeks bucket

  Hallucination fix recommendations:
  30. generates recommendation for open hallucinations
  31. limits to top 3 hallucinations
  32. critical severity gets urgency 90
  33. high severity gets urgency 75
  34. assigns this_week for critical/high urgency

  Deduplication:
  35. deduplicates by key, keeping higher urgency
  36. filters out recommendations with existing draft trigger_ids

  Sorting:
  37. sorts within each bucket by urgency descending

  Signal summary:
  38. counts recommendations per signal type correctly

  Integration:
  39. produces valid result from MOCK_CALENDAR_INPUT
  40. MOCK_CALENDAR_INPUT generates recommendations in multiple buckets

describe('helper functions')
  41. computeDaysUntilDate handles same-year future date
  42. computeDaysUntilDate rolls to next year for past date
  43. assignTimeBucket maps days correctly to buckets
  44. truncate shortens long text with ellipsis
  45. truncate preserves short text unchanged
```

**45 tests total. All pure functions — no mocks needed.**

### Test File 2: `src/__tests__/unit/content-calendar-data.test.ts`

**Target: `lib/data/content-calendar.ts`**

```
describe('fetchContentCalendar')
  1.  runs parallel queries for all signal sources
  2.  scopes queries by org_id (§18)
  3.  filters occasions to within trigger window
  4.  computes SOV gaps from evaluations (null rank_position)
  5.  computes daysSinceAudit for page freshness
  6.  computes menu staleness and bot visit decline
  7.  fetches pending competitor gaps (action_status=pending)
  8.  fetches open hallucinations (correction_status=open)
  9.  collects existing draft trigger_ids for dedup
  10. returns ContentCalendarResult on happy path
  11. handles empty data for all signal sources
```

**11 tests total.**

### Test File 3: `src/__tests__/unit/content-calendar-page.test.ts`

**Target: Dashboard page + sidebar**

```
describe('Content Calendar page')
  1.  renders signal summary strip
  2.  renders This Week section with recommendations
  3.  renders Next Week section
  4.  renders recommendation cards with action badge
  5.  renders urgency bar with color coding
  6.  renders CTA buttons
  7.  renders deadline countdown badge when daysUntilDeadline present
  8.  renders empty state when no recommendations
  9.  hides empty time bucket sections

describe('Sidebar')
  10. shows Content Calendar link with test-id nav-content-calendar
```

**10 tests total.**

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/services/content-calendar.service.ts` | **CREATE** | Pure calendar generation — 5 signal generators, urgency scoring, bucketing (~450 lines) |
| 2 | `lib/data/content-calendar.ts` | **CREATE** | Data fetcher — 11 parallel queries, assembles CalendarInput |
| 3 | `app/dashboard/content-calendar/page.tsx` | **CREATE** | Dashboard page — signal summary, time buckets, recommendation cards |
| 4 | `app/dashboard/content-calendar/error.tsx` | **CREATE** | Error boundary |
| 5 | `app/dashboard/_components/` | **MODIFY** | Sidebar — add Content Calendar link |
| 6 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | Add MOCK_CALENDAR_INPUT |
| 7 | `src/__tests__/unit/content-calendar-service.test.ts` | **CREATE** | 45 tests — pure functions |
| 8 | `src/__tests__/unit/content-calendar-data.test.ts` | **CREATE** | 11 tests — data layer |
| 9 | `src/__tests__/unit/content-calendar-page.test.ts` | **CREATE** | 10 tests — page + sidebar |

**Expected test count: 66 new tests across 3 files.**

---

## 🚫 What NOT to Do

1. **DO NOT use AI/LLM to generate recommendations.** All calendar content is deterministic from existing data. The 5 signal generators use pure functions with hardcoded urgency scoring — no hallucination risk.
2. **DO NOT create a new table.** Calendar recommendations are computed at page load from existing signal tables. They're ephemeral views, not persisted.
3. **DO NOT duplicate the OccasionTimeline component (§36.1).** The Content Drafts page has `OccasionTimeline` for occasion-triggered drafts. This Content Calendar is different — it aggregates ALL 5 signal types into a unified time-bucketed view. Reference the occasion data pattern but build a new page.
4. **DO NOT add plan gating.** Content Calendar is available to all tiers. Even Trial users benefit from seeing "here's what you should do" — it drives activation.
5. **DO NOT trigger any side effects on page load** (§5). No AI calls, no writes, no cron jobs. Pure read + compute.
6. **DO NOT hardcode business-specific data** (§20). All recommendations use data from the org's own tables.
7. **DO NOT use `as any` on Supabase clients** (§38.2).
8. **DO NOT modify existing pages.** This is a new standalone page at `/dashboard/content-calendar`.

---

## ✅ Definition of Done (AI_RULES §13.5)

- [ ] `generateContentCalendar()` pure function with all 5 signal generators
- [ ] Urgency scoring (0-100) per recommendation type
- [ ] Time bucketing (this_week / next_week / two_weeks / later)
- [ ] Deduplication by key + existing draft filtering
- [ ] `fetchContentCalendar()` with 11 parallel queries
- [ ] Dashboard page at `/dashboard/content-calendar` with signal summary, time buckets, recommendation cards
- [ ] Empty state for no recommendations
- [ ] Sidebar entry "Content Calendar" (test-id: `nav-content-calendar`)
- [ ] Golden Tenant: MOCK_CALENDAR_INPUT with mixed signals
- [ ] 66 tests passing across 3 files
- [ ] `npx vitest run` — ALL tests passing, no regressions
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] DEVLOG.md entry written

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## 2026-02-28 — Sprint 83: Proactive Content Calendar (Completed)

**Goal:** Build an AI-driven content publishing calendar that aggregates 5 signal sources (occasions, SOV gaps, page freshness, competitor gaps, hallucination corrections) into time-bucketed, urgency-scored content recommendations. Transforms LocalVector from reactive ("here's what happened") to proactive ("here's what to do next").

**Scope:**
- `lib/services/content-calendar.service.ts` — **NEW.** ~450 lines, all pure functions. `generateContentCalendar()` main entry point. 5 signal generators: `generateOccasionRecommendations()` (days-until-peak urgency, occasion_page type), `generateSOVGapRecommendations()` (gap ratio urgency, top 5), `generateFreshnessRecommendations()` (age-based urgency, bot decline detection for menu), `generateCompetitorGapRecommendations()` (magnitude-based urgency, top 3), `generateHallucinationFixRecommendations()` (severity-based urgency, top 3). Urgency 0-100 per recommendation. Time buckets: this_week/next_week/two_weeks/later. Deduplication by key (higher urgency wins). Existing draft filtering via trigger_id set. Helper: `computeDaysUntilDate()`, `assignTimeBucket()`, `formatProvider()`, `truncate()`.
- `lib/data/content-calendar.ts` — **NEW.** `fetchContentCalendar()` — 11 parallel Supabase queries across `local_occasions`, `sov_evaluations`, `target_queries`, `page_audits`, `magic_menus`, `crawler_hits` (2 periods), `competitor_intercepts`, `ai_hallucinations`, `content_drafts`. Assembles `CalendarInput`, computes derived fields (daysSinceAudit, SOV gap ratios, bot visit decline), calls pure `generateContentCalendar()`.
- `app/dashboard/content-calendar/page.tsx` — **NEW.** Server Component. SignalSummaryStrip (emoji + count per signal type), TimeBucketSection per bucket (hidden when empty), RecommendationCard (action verb badge, title, reason, urgency bar, CTA buttons, deadline countdown). Empty state. Color coding: action verbs (publish=green, update=amber, create=blue), urgency bars (red ≥75, amber ≥50, green <50).
- `app/dashboard/content-calendar/error.tsx` — **NEW.** Standard error boundary.
- `app/dashboard/_components/` — **MODIFIED.** Sidebar: added "Content Calendar" link (test-id: nav-content-calendar) under PRESCRIBE section.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added `MOCK_CALENDAR_INPUT` with mixed signals (1 occasion, 2 SOV gaps, 1 stale page, 1 stale menu, 1 competitor gap, 1 hallucination).

**Tests added:**
- `src/__tests__/unit/content-calendar-service.test.ts` — **N Vitest tests.** All 5 signal generators, urgency scoring, time bucketing, dedup, filtering, helpers, MOCK integration.
- `src/__tests__/unit/content-calendar-data.test.ts` — **N Vitest tests.** Parallel queries, org scoping, signal computation, empty data handling.
- `src/__tests__/unit/content-calendar-page.test.ts` — **N Vitest tests.** Signal summary, time buckets, recommendation cards, urgency bars, empty state, sidebar.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/content-calendar-service.test.ts    # N tests passing
npx vitest run src/__tests__/unit/content-calendar-data.test.ts       # N tests passing
npx vitest run src/__tests__/unit/content-calendar-page.test.ts       # N tests passing
npx vitest run                                                         # All tests passing
```

**Note:** Replace N with actual test counts verified via `grep -cE "^\s*(it|test)\("` (AI_RULES §13.3).
```

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| `local_occasions` table | Sprint 61 (§36.1) | Occasion data with trigger windows |
| `sov_evaluations` per-engine | Sprint 41+ | Rank data for SOV gap detection |
| `target_queries` per-org | Sprint 41+ | Monitored queries to check gaps against |
| `page_audits` freshness | Sprint 58 (§34.2) | Page freshness via last_audited_at |
| `crawler_hits` bot visits | Sprint 73 | Bot activity for freshness decay signal |
| `magic_menus` freshness | Sprint 66 | Menu freshness via updated_at |
| `competitor_intercepts` gaps | Sprint 50+ | Pending competitor gap actions |
| `ai_hallucinations` lifecycle | Sprint 68+ | Open hallucinations for correction recs |
| `content_drafts` trigger_id | Sprint 61 (§36.1) | Existing drafts to filter duplicates |
| OccasionTimeline pattern | Sprint 61 (§36.1) | Reference for occasion data handling |

---

## 🧠 Edge Cases

1. **No signals at all:** Empty state. All buckets empty, signalSummary all zeros, totalCount 0.
2. **Brand new org (no SOV data, no audits):** Occasions still show (global table). Other signals empty. Calendar still useful with just occasion recommendations.
3. **All SOV queries ranked:** sovGaps is empty. No SOV gap recommendations. Other signals still fire.
4. **Page audited yesterday:** daysSinceAudit < 30, not flagged as stale. Only 30+ days triggers freshness recommendation.
5. **Menu updated today:** staleMenu = null or daysSinceUpdate < 30. No menu freshness recommendation.
6. **Existing draft for an occasion:** `existingDraftTriggerIds` contains the occasion ID. Recommendation filtered out — no duplicate suggestion.
7. **Occasion date just passed:** `computeDaysUntilDate` rolls to next year. If within trigger window, shows as "later" bucket. If > trigger window, not included.
8. **Multiple hallucinations with same claim:** Each has a unique ID, so each gets its own recommendation. The limit (top 3) prevents overload.
9. **Zero engines ran for a query:** `totalEngineCount = 0`, `missingEngineCount = 0`. Not counted as a gap.

---

## 🔮 AI_RULES Updates

Add new rule:

```markdown
## 46. 📅 Proactive Content Calendar (Sprint 83)

The Content Calendar aggregates 5 signal sources into time-bucketed content recommendations.

* **Pure service:** `lib/services/content-calendar.service.ts` — `generateContentCalendar()` takes `CalendarInput`, returns `ContentCalendarResult`.
* **5 signal sources:** occasions (trigger window), SOV gaps (null rank), page freshness (30+ days), competitor gaps (pending actions), hallucination corrections (open status).
* **Urgency scoring:** 0-100 per recommendation. Occasions use days-until-peak (closer = higher). SOV uses gap ratio. Freshness uses age. Competitors use gap magnitude. Hallucinations use severity.
* **Time buckets:** this_week (≤7 days), next_week (8-14), two_weeks (15-21), later (22+).
* **Deduplication:** By recommendation key. Existing draft trigger_ids filtered out to avoid duplicate suggestions.
* **No AI calls.** All recommendations are deterministic from existing data.
* **No new tables.** Calendar is computed at page load from existing signal tables.
* **No plan gating.** Available to all tiers.
* **Different from OccasionTimeline (§36.1):** OccasionTimeline is an occasion-only horizontal scroller on the Content Drafts page. Content Calendar is a full-page view aggregating ALL 5 signal types with urgency scoring.
```
