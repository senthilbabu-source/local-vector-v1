# Sprint 82 — Citation Source Intelligence ("What AI Reads About You")

> **Claude Code Prompt — First-Pass Ready**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`

---

## 🎯 Objective

Build **Citation Source Intelligence** — identify which specific web pages, review sites, articles, and social posts each AI engine uses as sources when generating answers about the business.

**The killer insight:** "ChatGPT's answer about your restaurant is based on a 2-year-old Yelp review that mentions 'slow service.' Perplexity is citing your competitor's blog post comparing themselves favorably to you."

**Why it matters:** AI engines don't make up their answers from nothing — they synthesize from specific sources. If you know WHICH sources they read, you can influence WHAT they say. This is the source-level control layer.

**Architecture:** Two data paths converge into a unified source analysis:
1. **Structured citations:** `sov_evaluations.cited_sources` JSONB (Sprint 74) — Google Search Grounding returns actual URLs. Perplexity also returns citation URLs in its API responses.
2. **Extracted source mentions:** For engines that don't return structured citations (OpenAI, Copilot), use `gpt-4o-mini` to extract source references mentioned in `raw_response` text (e.g., "according to Yelp reviews," "based on TripAdvisor").

Both paths feed into a pure analysis service that categorizes sources, detects alerts (competitor content appearing as a source for YOUR queries), and identifies first-party vs. third-party citation patterns.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                          — All engineering rules (§19.3, §34.1, §4)
Read CLAUDE.md                                 — Project context + architecture
Read supabase/prod_schema.sql                  — sov_evaluations (cited_sources, raw_response), citation_source_intelligence
Read lib/supabase/database.types.ts            — Full Database type (§38)
Read lib/ai/providers.ts                       — Model key registry (§19.3)
Read lib/ai/schemas.ts                         — Zod schema + zodSchema() pattern
Read lib/services/sov-engine.service.ts        — SOVQueryResult.citedSources
Read app/dashboard/citations/                  — Citation Gap page (§34.1) — related but different
Read app/dashboard/ai-responses/               — "AI Says" page — cited_sources display
Read src/__fixtures__/golden-tenant.ts          — Golden Tenant fixtures (§4)
```

---

## 🏗️ Architecture — What to Build

### Data Flow

```
sov_evaluations (per-org, per-query, per-engine)
    │
    ├── cited_sources JSONB (Sprint 74)  ──  Google: actual URLs
    │                                        Perplexity: actual URLs (if available)
    │
    └── raw_response TEXT  ──────────────── OpenAI/Copilot: extract source mentions
                                             via gpt-4o-mini generateObject
    │
    ▼
extractSourceMentions(rawResponse, businessName)  ← AI extraction
    │
    ▼
analyzeSourceIntelligence(input)                  ← Pure function
    │
    ├── Categorize sources: first_party | review_site | directory | competitor | news | social | other
    ├── Detect alerts: competitor content cited for YOUR queries
    ├── Rank sources by citation frequency across engines
    ├── Identify first-party coverage gaps
    │
    ▼
Dashboard page: /dashboard/source-intelligence
    ├── Source frequency table (which URLs get cited most)
    ├── Per-engine source breakdown
    ├── Source category breakdown (review sites vs directories vs first-party)
    ├── 🔴 Alerts (competitor content, outdated sources)
    └── Recommendations ("Create authoritative first-party content to outrank")
```

---

### Component 1: Source Mention Extraction Schema — `lib/ai/schemas.ts`

For engines that don't return structured `cited_sources` (OpenAI, Copilot), extract source references from the raw response text.

```typescript
/**
 * Sprint 82 — Source mention extraction from AI raw response text.
 * Used with generateObject() to identify sources referenced in AI answers
 * that don't provide structured citation URLs.
 */
export const SourceMentionExtractionSchema = z.object({
  /** Sources mentioned or referenced in the response */
  sources: z.array(z.object({
    /** Name of the source (e.g., "Yelp", "TripAdvisor", "Google Maps", "their website") */
    name: z.string(),
    /** Type of source */
    type: z.enum(['review_site', 'directory', 'news', 'blog', 'social_media', 'official_website', 'other']),
    /** Inferred URL if identifiable, null otherwise */
    inferredUrl: z.string().nullable(),
    /** Brief context of what was cited (e.g., "4.5 star rating", "slow service mentioned") */
    context: z.string(),
    /** Whether this seems to reference a competitor's content rather than the target business */
    isCompetitorContent: z.boolean(),
  })),
  /** Overall assessment of how well-sourced the response is */
  sourcingQuality: z.enum(['well_sourced', 'moderately_sourced', 'poorly_sourced', 'unsourced']),
});

export type SourceMentionExtraction = z.infer<typeof SourceMentionExtractionSchema>;
```

---

### Component 2: New Model Key — `lib/ai/providers.ts`

```typescript
// Sprint 82 — Source mention extraction (cheap, structured output)
'source-extract': openai('gpt-4o-mini'),
```

Reuses `gpt-4o-mini` — same as `sentiment-extract` (Sprint 81). Source extraction is lightweight classification. Uses existing `OPENAI_API_KEY`.

---

### Component 3: Source Intelligence Service — `lib/services/source-intelligence.service.ts`

Two parts: (A) AI extraction for unstructured responses, (B) pure analysis functions.

#### Part A: Source Mention Extractor

```typescript
import { generateObject } from 'ai';
import { getModel, hasApiKey } from '@/lib/ai/providers';
import { SourceMentionExtractionSchema, zodSchema, type SourceMentionExtraction } from '@/lib/ai/schemas';

/**
 * Extract source mentions from an AI response that doesn't have structured citations.
 * Used for OpenAI and Copilot engines.
 * Returns null if extraction fails or isn't needed.
 */
export async function extractSourceMentions(
  rawResponse: string | null,
  businessName: string,
): Promise<SourceMentionExtraction | null> {
  if (!rawResponse || rawResponse.trim().length === 0) return null;
  if (!hasApiKey('source-extract')) return null;

  try {
    const { object } = await generateObject({
      model: getModel('source-extract'),
      schema: zodSchema(SourceMentionExtractionSchema),
      system: `You analyze AI-generated responses about local businesses to identify what information sources the AI appears to be drawing from. Look for:
- Explicit source references ("according to Yelp", "based on Google reviews")
- Implicit source signals (star ratings suggest review sites, specific details suggest directory listings)
- Competitor content being used as a source for queries about the target business
Be conservative — only extract sources you're confident are being referenced.`,
      prompt: `Identify the information sources referenced in this AI response about "${businessName}":\n\n${rawResponse}`,
    });
    return object;
  } catch (err) {
    console.error('[source-intelligence] Extraction failed:', err);
    return null;
  }
}
```

#### Part B: Pure Analysis Functions

```typescript
// ── Types ─────────────────────────────────────────────

export type SourceCategory = 'first_party' | 'review_site' | 'directory' | 'competitor' | 'news' | 'social' | 'blog' | 'other';

export interface NormalizedSource {
  /** Display name (e.g., "Yelp", "Google Business Profile", "charcoalnchill.com") */
  name: string;
  /** Actual URL if available, null otherwise */
  url: string | null;
  /** Categorized source type */
  category: SourceCategory;
  /** Which engines cited this source */
  engines: string[];
  /** Number of times cited across all evaluations */
  citationCount: number;
  /** Context snippets from extractions */
  contexts: string[];
  /** Is this competitor content appearing for the business's queries? */
  isCompetitorAlert: boolean;
}

export interface SourceAlert {
  type: 'competitor_content' | 'outdated_source' | 'negative_source' | 'missing_first_party';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  source: NormalizedSource | null;
  recommendation: string;
}

export interface SourceIntelligenceResult {
  /** All sources, deduplicated and ranked by citation frequency */
  sources: NormalizedSource[];
  /** Per-engine source breakdown */
  byEngine: Record<string, NormalizedSource[]>;
  /** Source category distribution */
  categoryBreakdown: Array<{ category: SourceCategory; count: number; percentage: number }>;
  /** First-party citation rate (what % of citations reference the business's own content) */
  firstPartyRate: number;
  /** Alerts requiring attention */
  alerts: SourceAlert[];
  /** Total evaluations analyzed */
  evaluationCount: number;
}

export interface SourceIntelligenceInput {
  businessName: string;
  websiteUrl: string | null;
  /** Evaluations with both structured and extracted sources */
  evaluations: Array<{
    engine: string;
    citedSources: Array<{ url: string; title: string }> | null;
    extractedMentions: SourceMentionExtraction | null;
    queryText: string;
  }>;
}

// ── Pure computation ──────────────────────────────────

/**
 * Analyze source intelligence from all evaluation data.
 * Pure function — no I/O, no side effects.
 */
export function analyzeSourceIntelligence(input: SourceIntelligenceInput): SourceIntelligenceResult {
  const sourceMap = new Map<string, NormalizedSource>();

  // Process structured citations (Google, Perplexity)
  for (const evaluation of input.evaluations) {
    if (evaluation.citedSources) {
      for (const source of evaluation.citedSources) {
        const key = normalizeSourceKey(source.url);
        const existing = sourceMap.get(key);
        if (existing) {
          existing.citationCount++;
          if (!existing.engines.includes(evaluation.engine)) {
            existing.engines.push(evaluation.engine);
          }
        } else {
          sourceMap.set(key, {
            name: source.title || extractDomainName(source.url),
            url: source.url,
            category: categorizeUrl(source.url, input.businessName, input.websiteUrl),
            engines: [evaluation.engine],
            citationCount: 1,
            contexts: [],
            isCompetitorAlert: false,
          });
        }
      }
    }

    // Process extracted mentions (OpenAI, Copilot)
    if (evaluation.extractedMentions) {
      for (const mention of evaluation.extractedMentions.sources) {
        const key = mention.inferredUrl
          ? normalizeSourceKey(mention.inferredUrl)
          : `mention:${mention.name.toLowerCase()}`;
        const existing = sourceMap.get(key);
        if (existing) {
          existing.citationCount++;
          if (!existing.engines.includes(evaluation.engine)) {
            existing.engines.push(evaluation.engine);
          }
          if (mention.context && !existing.contexts.includes(mention.context)) {
            existing.contexts.push(mention.context);
          }
          if (mention.isCompetitorContent) existing.isCompetitorAlert = true;
        } else {
          sourceMap.set(key, {
            name: mention.name,
            url: mention.inferredUrl,
            category: mapMentionTypeToCategory(mention.type, mention.isCompetitorContent),
            engines: [evaluation.engine],
            citationCount: 1,
            contexts: mention.context ? [mention.context] : [],
            isCompetitorAlert: mention.isCompetitorContent,
          });
        }
      }
    }
  }

  // Sort by citation count descending
  const sources = [...sourceMap.values()].sort((a, b) => b.citationCount - a.citationCount);

  // Per-engine breakdown
  const byEngine: Record<string, NormalizedSource[]> = {};
  for (const source of sources) {
    for (const engine of source.engines) {
      (byEngine[engine] ??= []).push(source);
    }
  }

  // Category breakdown
  const categoryCounts = new Map<SourceCategory, number>();
  for (const source of sources) {
    categoryCounts.set(source.category, (categoryCounts.get(source.category) ?? 0) + source.citationCount);
  }
  const totalCitations = sources.reduce((sum, s) => sum + s.citationCount, 0);
  const categoryBreakdown = [...categoryCounts.entries()]
    .map(([category, count]) => ({
      category,
      count,
      percentage: totalCitations > 0 ? Math.round((count / totalCitations) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // First-party rate
  const firstPartyCitations = sources
    .filter(s => s.category === 'first_party')
    .reduce((sum, s) => sum + s.citationCount, 0);
  const firstPartyRate = totalCitations > 0
    ? Math.round((firstPartyCitations / totalCitations) * 100)
    : 0;

  // Generate alerts
  const alerts = generateAlerts(sources, firstPartyRate, input);

  return {
    sources,
    byEngine,
    categoryBreakdown,
    firstPartyRate,
    alerts,
    evaluationCount: input.evaluations.length,
  };
}

// ── Helpers ───────────────────────────────────────────

/** Normalize URL to a deduplication key */
function normalizeSourceKey(url: string): string {
  try {
    const u = new URL(url);
    // Remove trailing slashes, www prefix, query params for dedup
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/** Extract readable domain name from URL */
function extractDomainName(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    // Map common domains to friendly names
    const domainMap: Record<string, string> = {
      'yelp.com': 'Yelp',
      'tripadvisor.com': 'TripAdvisor',
      'google.com': 'Google',
      'maps.google.com': 'Google Maps',
      'facebook.com': 'Facebook',
      'instagram.com': 'Instagram',
      'twitter.com': 'Twitter/X',
      'x.com': 'Twitter/X',
      'bingplaces.com': 'Bing Places',
    };
    for (const [domain, name] of Object.entries(domainMap)) {
      if (hostname.includes(domain)) return name;
    }
    return hostname;
  } catch {
    return url;
  }
}

/** Categorize a URL into a source category */
function categorizeUrl(
  url: string,
  businessName: string,
  websiteUrl: string | null,
): SourceCategory {
  const hostname = (() => {
    try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); }
    catch { return ''; }
  })();

  // First-party: business's own website
  if (websiteUrl) {
    try {
      const bizHost = new URL(websiteUrl).hostname.toLowerCase().replace(/^www\./, '');
      if (hostname === bizHost) return 'first_party';
    } catch { /* ignore */ }
  }

  // Review sites
  const reviewSites = ['yelp.com', 'tripadvisor.com', 'trustpilot.com', 'glassdoor.com'];
  if (reviewSites.some(s => hostname.includes(s))) return 'review_site';

  // Directories
  const directories = ['google.com/maps', 'maps.google.com', 'bingplaces.com', 'mapsconnect.apple.com', 'yellowpages.com', 'foursquare.com'];
  if (directories.some(s => url.toLowerCase().includes(s))) return 'directory';

  // Social
  const social = ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com'];
  if (social.some(s => hostname.includes(s))) return 'social';

  // News/blogs (heuristic)
  const news = ['eater.com', 'timeout.com', 'thrillist.com', 'infatuation.com', 'patch.com'];
  if (news.some(s => hostname.includes(s))) return 'news';

  return 'other';
}

/** Map extracted mention type to source category */
function mapMentionTypeToCategory(
  mentionType: string,
  isCompetitor: boolean,
): SourceCategory {
  if (isCompetitor) return 'competitor';
  switch (mentionType) {
    case 'review_site': return 'review_site';
    case 'directory': return 'directory';
    case 'news': return 'news';
    case 'blog': return 'blog';
    case 'social_media': return 'social';
    case 'official_website': return 'first_party';
    default: return 'other';
  }
}

/** Generate actionable alerts from source analysis */
function generateAlerts(
  sources: NormalizedSource[],
  firstPartyRate: number,
  input: SourceIntelligenceInput,
): SourceAlert[] {
  const alerts: SourceAlert[] = [];

  // Alert: competitor content appearing as a source
  const competitorSources = sources.filter(s => s.isCompetitorAlert);
  for (const cs of competitorSources) {
    alerts.push({
      type: 'competitor_content',
      severity: 'high',
      title: `Competitor content cited for your queries`,
      description: `"${cs.name}" appears as a source when AI answers questions about ${input.businessName}. This means a competitor's content is influencing how AI describes you.`,
      source: cs,
      recommendation: 'Create authoritative first-party content to outrank this competitor source. Publish a blog post or FAQ page that directly addresses the queries where this source appears.',
    });
  }

  // Alert: low first-party citation rate
  if (firstPartyRate < 10 && sources.length > 0) {
    alerts.push({
      type: 'missing_first_party',
      severity: 'medium',
      title: 'AI rarely cites your own website',
      description: `Only ${firstPartyRate}% of AI citations reference your website. AI engines are forming opinions about ${input.businessName} from third-party sources you don't control.`,
      source: null,
      recommendation: 'Improve your website\'s AI readability: add structured FAQ content, update your llms.txt, and ensure your homepage clearly states your business name, address, hours, and specialties.',
    });
  }

  // Alert: heavy reliance on a single third-party source
  if (sources.length > 0) {
    const totalCitations = sources.reduce((sum, s) => sum + s.citationCount, 0);
    const topSource = sources[0];
    if (topSource && topSource.category !== 'first_party') {
      const topSourceShare = totalCitations > 0 ? topSource.citationCount / totalCitations : 0;
      if (topSourceShare > 0.5) {
        alerts.push({
          type: 'negative_source',
          severity: 'medium',
          title: `AI over-relies on ${topSource.name}`,
          description: `${Math.round(topSourceShare * 100)}% of AI citations come from ${topSource.name}. If that listing becomes outdated or inaccurate, it directly impacts how AI describes ${input.businessName}.`,
          source: topSource,
          recommendation: `Diversify your online presence. Ensure your information is accurate on ${topSource.name}, and build presence on other platforms so AI has multiple authoritative sources.`,
        });
      }
    }
  }

  return alerts;
}
```

---

### Component 4: Source Extraction Integration into SOV Pipeline

#### 4A. Pipeline function — `lib/services/sov-engine.service.ts`

Add alongside the existing `extractSOVSentiment()` from Sprint 81:

```typescript
import { extractSourceMentions, type SourceMentionExtraction } from '@/lib/services/source-intelligence.service';

/**
 * Run source mention extraction on SOV results that don't have structured citations.
 * Call AFTER writeSOVResults(). Only runs for engines without cited_sources.
 */
export async function extractSOVSourceMentions(
  results: Array<{ evaluationId: string; rawResponse: string | null; engine: string; citedSources?: unknown }>,
  businessName: string,
): Promise<Map<string, SourceMentionExtraction | null>> {
  const entries = await Promise.allSettled(
    results
      .filter(r => !r.citedSources || (Array.isArray(r.citedSources) && r.citedSources.length === 0))
      .map(async (r) => {
        const mentions = await extractSourceMentions(r.rawResponse, businessName);
        return [r.evaluationId, mentions] as const;
      }),
  );

  const map = new Map<string, SourceMentionExtraction | null>();
  for (const entry of entries) {
    if (entry.status === 'fulfilled') {
      map.set(entry.value[0], entry.value[1]);
    }
  }
  return map;
}

/**
 * Write extracted source mentions to sov_evaluations.
 * Stores in a new `source_mentions` JSONB column.
 */
export async function writeSourceMentions(
  supabase: SupabaseClient<Database>,
  mentionsMap: Map<string, SourceMentionExtraction | null>,
): Promise<void> {
  for (const [evaluationId, mentions] of mentionsMap) {
    if (mentions === null) continue;
    await supabase
      .from('sov_evaluations')
      .update({ source_mentions: mentions as unknown as Json })
      .eq('id', evaluationId)
      .then(({ error }) => {
        if (error) console.error(`[source-intelligence] Write failed for ${evaluationId}:`, error);
      });
  }
}
```

#### 4B. Inngest SOV Cron — `lib/inngest/functions/sov-cron.ts`

Add a source extraction step after the sentiment step (Sprint 81). This is a separate Inngest step:

```typescript
// After sentiment step (Sprint 81):
await step.run(`source-mentions-${org.id}`, async () => {
  const supabase = createServiceRoleClient();
  const mentionsMap = await extractSOVSourceMentions(evaluationResults, businessName);
  await writeSourceMentions(supabase, mentionsMap);
});
```

Also update the inline fallback in `app/api/cron/sov/route.ts`.

**IMPORTANT:** Source extraction only runs for engines WITHOUT `cited_sources` (OpenAI, Copilot). Google and Perplexity already have structured citations, so no AI call is wasted on them.

---

### Component 5: Migration — `supabase/migrations/20260226000011_source_mentions.sql`

```sql
-- Sprint 82: Add source_mentions to sov_evaluations
-- Stores extracted source references for engines that don't return structured citations.
ALTER TABLE public.sov_evaluations
  ADD COLUMN IF NOT EXISTS source_mentions JSONB;

COMMENT ON COLUMN public.sov_evaluations.source_mentions IS
  'Extracted source references from raw_response for engines without cited_sources (OpenAI, Copilot). Uses SourceMentionExtractionSchema.';
```

Update `database.types.ts`: Add `source_mentions: Json | null` to `sov_evaluations` Row/Insert/Update.

---

### Component 6: Data Fetcher — `lib/data/source-intelligence.ts`

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  analyzeSourceIntelligence,
  type SourceIntelligenceInput,
  type SourceIntelligenceResult,
  type SourceMentionExtraction,
} from '@/lib/services/source-intelligence.service';

/**
 * Fetch source intelligence data for the dashboard.
 */
export async function fetchSourceIntelligence(
  supabase: SupabaseClient<Database>,
  orgId: string,
  locationId: string,
  options?: { dayRange?: number },
): Promise<SourceIntelligenceResult> {
  const dayRange = options?.dayRange ?? 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - dayRange);

  // Fetch evaluations with their sources and query text
  const [evalsResult, locationResult] = await Promise.all([
    supabase
      .from('sov_evaluations')
      .select(`
        engine,
        cited_sources,
        source_mentions,
        raw_response,
        target_queries!inner ( query_text )
      `)
      .eq('org_id', orgId)
      .eq('location_id', locationId)
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: false }),

    supabase
      .from('locations')
      .select('business_name, website_url')
      .eq('id', locationId)
      .eq('org_id', orgId)
      .single(),
  ]);

  const location = locationResult.data;
  const evaluations = evalsResult.data ?? [];

  const input: SourceIntelligenceInput = {
    businessName: location?.business_name ?? 'Unknown',
    websiteUrl: location?.website_url ?? null,
    evaluations: evaluations.map((e: any) => ({
      engine: e.engine,
      citedSources: e.cited_sources as Array<{ url: string; title: string }> | null,
      extractedMentions: e.source_mentions as SourceMentionExtraction | null,
      queryText: e.target_queries?.query_text ?? '',
    })),
  };

  return analyzeSourceIntelligence(input);
}
```

---

### Component 7: Dashboard Page — `app/dashboard/source-intelligence/page.tsx`

Server Component.

```
Page Layout:
┌─────────────────────────────────────────────────────┐
│ What AI Reads About You                             │
│ The sources AI engines cite when describing         │
│ your business                                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ┌─── 🔴 Alerts ─────────────────────────────────┐  │
│ │ ⚠️ Competitor content cited for your queries   │  │
│ │   "Cloud 9 Lounge Blog" appears as a source    │  │
│ │   [Create outranking content →]                │  │
│ │                                                │  │
│ │ ℹ️ AI rarely cites your own website (5%)       │  │
│ │   [Improve AI readability →]                   │  │
│ └────────────────────────────────────────────────┘  │
│                                                     │
│ ┌─── Top Sources ────────────────────────────────┐  │
│ │ #  Source             Engines    Times Cited    │  │
│ │ 1. Yelp              🟢🔵🟡🟣   12            │  │
│ │ 2. Google Maps        🟢🔵       8             │  │
│ │ 3. TripAdvisor        🟡🟣       5             │  │
│ │ 4. charcoalnchill.com 🟢         3             │  │
│ │ 5. Local food blog    🔵         2             │  │
│ └────────────────────────────────────────────────┘  │
│                                                     │
│ ┌─── Source Categories ──────────────────────────┐  │
│ │ Review Sites    ████████████████  48%          │  │
│ │ Directories     ██████████       30%           │  │
│ │ First Party     ███              10%           │  │
│ │ News/Blogs      ██                7%           │  │
│ │ Other           █                 5%           │  │
│ └────────────────────────────────────────────────┘  │
│                                                     │
│ ┌─── Per-Engine Breakdown ───────────────────────┐  │
│ │ Perplexity:  Yelp, charcoalnchill.com, ...     │  │
│ │ ChatGPT:     Yelp, Google Maps, Competitor Blog│  │
│ │ Google:      Yelp, Google Business Profile     │  │
│ │ Copilot:     Yelp, Bing Places                 │  │
│ └────────────────────────────────────────────────┘  │
│                                                     │
│ No source data yet? Source intelligence is built    │
│ from your SOV evaluations. Run your weekly SOV      │
│ queries to start tracking what AI reads.            │
└─────────────────────────────────────────────────────┘
```

**Sub-Components:**

**`SourceAlertCards`** — Alert cards at the top, sorted by severity (high first). Red border for `competitor_content`, amber for others. Each has a recommendation CTA.

**`TopSourcesTable`** — Table of sources ranked by citation count. Columns: rank, source name (linked if URL available), engine dots (colored per engine), citation count. Limit to top 10.

**`CategoryBreakdownBars`** — Horizontal bar chart showing source type distribution. Color coded per category. Show percentage labels.

**`EngineSourceBreakdown`** — Per-engine collapsible sections showing which sources each engine uses. Engine labels from `ENGINE_LABELS` mapping.

**Engine color dots mapping:**
```typescript
const ENGINE_COLORS: Record<string, string> = {
  perplexity: 'bg-blue-500',   // 🔵
  openai: 'bg-green-500',       // 🟢
  google: 'bg-yellow-500',      // 🟡
  copilot: 'bg-purple-500',     // 🟣
};
```

**Empty state:** "No source data yet. Source intelligence is built from your SOV evaluations. Once you have SOV results, you'll see exactly which websites AI engines use to form opinions about your business."

---

### Component 8: Error Boundary + Sidebar

`app/dashboard/source-intelligence/error.tsx` — Standard error boundary.

Sidebar entry:
```typescript
{
  label: 'AI Sources',
  href: '/dashboard/source-intelligence',
  icon: BookOpen,  // or Globe, ExternalLink — pick from lucide-react
  testId: 'nav-source-intelligence',
}
```

---

### Component 9: Golden Tenant Fixtures — `src/__fixtures__/golden-tenant.ts`

```typescript
import type { SourceMentionExtraction } from '@/lib/ai/schemas';

/**
 * Sprint 82 — Canonical source mention extraction for OpenAI (no structured citations).
 */
export const MOCK_SOURCE_MENTION_EXTRACTION: SourceMentionExtraction = {
  sources: [
    {
      name: 'Yelp',
      type: 'review_site',
      inferredUrl: 'https://www.yelp.com/biz/charcoal-n-chill-alpharetta',
      context: '4.5 star rating with emphasis on atmosphere',
      isCompetitorContent: false,
    },
    {
      name: 'Google Maps',
      type: 'directory',
      inferredUrl: 'https://maps.google.com/charcoal-n-chill',
      context: 'Business hours and location information',
      isCompetitorContent: false,
    },
    {
      name: 'Cloud 9 Lounge Blog',
      type: 'blog',
      inferredUrl: null,
      context: 'Competitor comparison mentioning hookah selection',
      isCompetitorContent: true,
    },
  ],
  sourcingQuality: 'well_sourced',
};

/**
 * Sprint 82 — Canonical SourceIntelligenceInput for full analysis.
 */
export const MOCK_SOURCE_INTELLIGENCE_INPUT: import('@/lib/services/source-intelligence.service').SourceIntelligenceInput = {
  businessName: 'Charcoal N Chill',
  websiteUrl: 'https://charcoalnchill.com',
  evaluations: [
    {
      engine: 'google',
      citedSources: [
        { url: 'https://www.yelp.com/biz/charcoal-n-chill-alpharetta', title: 'Charcoal N Chill - Yelp' },
        { url: 'https://charcoalnchill.com', title: 'Charcoal N Chill' },
      ],
      extractedMentions: null,
      queryText: 'best hookah bar Alpharetta',
    },
    {
      engine: 'perplexity',
      citedSources: [
        { url: 'https://www.yelp.com/biz/charcoal-n-chill-alpharetta', title: 'Yelp' },
        { url: 'https://www.tripadvisor.com/Restaurant-charcoal-n-chill', title: 'TripAdvisor' },
      ],
      extractedMentions: null,
      queryText: 'best hookah bar Alpharetta',
    },
    {
      engine: 'openai',
      citedSources: null,
      extractedMentions: MOCK_SOURCE_MENTION_EXTRACTION,
      queryText: 'best hookah bar Alpharetta',
    },
  ],
};
```

---

### Component 10: Seed Data — `supabase/seed.sql`

Update existing SOV seed rows to include `source_mentions` for non-Google engines:

```sql
-- Sprint 82: Add source_mentions to OpenAI seed evaluation
UPDATE public.sov_evaluations
SET source_mentions = '{
  "sources": [
    {"name": "Yelp", "type": "review_site", "inferredUrl": "https://www.yelp.com/biz/charcoal-n-chill-alpharetta", "context": "4.5 star rating", "isCompetitorContent": false},
    {"name": "Google Maps", "type": "directory", "inferredUrl": null, "context": "Business listing", "isCompetitorContent": false}
  ],
  "sourcingQuality": "well_sourced"
}'::jsonb
WHERE engine = 'openai'
  AND org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/source-intelligence-service.test.ts`

**Target: `lib/services/source-intelligence.service.ts`**

```
describe('extractSourceMentions')
  1.  returns null for null rawResponse
  2.  returns null for empty rawResponse
  3.  returns null when hasApiKey returns false
  4.  calls generateObject with source-extract model key
  5.  returns SourceMentionExtraction on happy path
  6.  returns null when generateObject throws

describe('analyzeSourceIntelligence')
  Source normalization:
  7.  deduplicates sources by normalized URL
  8.  merges engines for same source across evaluations
  9.  handles both structured citations and extracted mentions
  10. normalizes URLs (removes www, trailing slash)

  Source categorization:
  11. categorizes business website as first_party
  12. categorizes yelp.com as review_site
  13. categorizes google.com/maps as directory
  14. categorizes facebook.com as social
  15. categorizes competitor mentions as competitor
  16. defaults unknown URLs to other

  Ranking:
  17. sorts sources by citationCount descending
  18. computes correct citationCount across evaluations

  Category breakdown:
  19. computes percentage per category
  20. sorts categories by count descending

  First-party rate:
  21. computes first_party rate as percentage of total citations
  22. returns 0 when no sources exist

  Per-engine breakdown:
  23. groups sources by engine
  24. includes source in all engines that cited it

describe('generateAlerts')
  25. generates competitor_content alert when isCompetitorAlert is true
  26. generates missing_first_party alert when firstPartyRate < 10%
  27. generates negative_source alert when single source > 50% of citations
  28. no alerts when everything is healthy
  29. sorts alerts by severity (high first)

describe('helper functions')
  30. normalizeSourceKey removes www and trailing slash
  31. extractDomainName maps known domains to friendly names
  32. extractDomainName returns hostname for unknown domains
  33. categorizeUrl identifies first-party by matching websiteUrl

describe('MOCK_SOURCE_INTELLIGENCE_INPUT integration')
  34. produces valid SourceIntelligenceResult from mock input
  35. mock has competitor alert for Cloud 9 Lounge Blog
```

**35 tests total. Extraction tests mock AI; analysis tests are pure functions — no mocks needed.**

### Test File 2: `src/__tests__/unit/source-intelligence-data.test.ts`

**Target: `lib/data/source-intelligence.ts`**

```
describe('fetchSourceIntelligence')
  1.  queries sov_evaluations filtered by org_id and location_id
  2.  joins with target_queries for query_text
  3.  defaults to 30-day range
  4.  respects custom dayRange option
  5.  fetches location business_name and website_url
  6.  handles empty evaluations
  7.  returns SourceIntelligenceResult on happy path
```

**7 tests total.**

### Test File 3: `src/__tests__/unit/source-intelligence-pipeline.test.ts`

**Target: `extractSOVSourceMentions()` + `writeSourceMentions()`**

```
describe('extractSOVSourceMentions')
  1.  only extracts for results without cited_sources
  2.  skips results that already have cited_sources
  3.  handles individual extraction failures gracefully
  4.  returns Map of evaluationId → SourceMentionExtraction

describe('writeSourceMentions')
  5.  updates sov_evaluations.source_mentions for each entry
  6.  skips null entries
  7.  logs errors but doesn't throw
```

**7 tests total.**

### Test File 4: `src/__tests__/unit/source-intelligence-page.test.ts`

**Target: Dashboard page + sidebar**

```
describe('Source Intelligence page')
  1.  renders top sources table
  2.  renders category breakdown bars
  3.  renders alert cards when alerts present
  4.  renders per-engine breakdown
  5.  renders empty state when no source data

describe('Sidebar')
  6.  shows AI Sources link with test-id nav-source-intelligence
```

**6 tests total.**

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `supabase/migrations/20260226000011_source_mentions.sql` | **CREATE** | Add `source_mentions` JSONB to `sov_evaluations` |
| 2 | `lib/supabase/database.types.ts` | **MODIFY** | Add `source_mentions: Json \| null` to sov_evaluations |
| 3 | `lib/ai/schemas.ts` | **MODIFY** | Add `SourceMentionExtractionSchema` + type export |
| 4 | `lib/ai/providers.ts` | **MODIFY** | Add `source-extract` model key (gpt-4o-mini) |
| 5 | `lib/services/source-intelligence.service.ts` | **CREATE** | Extraction + pure analysis + alerts (~450 lines) |
| 6 | `lib/services/sov-engine.service.ts` | **MODIFY** | Add `extractSOVSourceMentions()`, `writeSourceMentions()` |
| 7 | `lib/inngest/functions/sov-cron.ts` | **MODIFY** | Add source extraction step after sentiment step |
| 8 | `app/api/cron/sov/route.ts` | **MODIFY** | Add source extraction to inline fallback |
| 9 | `lib/data/source-intelligence.ts` | **CREATE** | `fetchSourceIntelligence()` |
| 10 | `app/dashboard/source-intelligence/page.tsx` | **CREATE** | Dashboard page — alerts, table, categories, engine breakdown |
| 11 | `app/dashboard/source-intelligence/error.tsx` | **CREATE** | Error boundary |
| 12 | `app/dashboard/_components/` | **MODIFY** | Sidebar — add AI Sources link |
| 13 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | Add MOCK_SOURCE_MENTION_EXTRACTION, MOCK_SOURCE_INTELLIGENCE_INPUT |
| 14 | `supabase/seed.sql` | **MODIFY** | Add source_mentions to OpenAI seed evaluation |
| 15 | `src/__tests__/unit/source-intelligence-service.test.ts` | **CREATE** | 35 tests |
| 16 | `src/__tests__/unit/source-intelligence-data.test.ts` | **CREATE** | 7 tests |
| 17 | `src/__tests__/unit/source-intelligence-pipeline.test.ts` | **CREATE** | 7 tests |
| 18 | `src/__tests__/unit/source-intelligence-page.test.ts` | **CREATE** | 6 tests |

**Expected test count: 55 new tests across 4 files.**

---

## 🚫 What NOT to Do

1. **DO NOT call AI extraction for engines that already have structured citations.** Google and Perplexity return `cited_sources` — use those directly. Only run `extractSourceMentions()` for OpenAI and Copilot.
2. **DO NOT confuse this with the Citation Gap Dashboard (Sprint 58, §34.1).** Citation Gap shows which PLATFORMS you're listed on (aggregate market data, not org-scoped). Source Intelligence shows which specific PAGES AI reads about YOU (org-scoped, per-evaluation).
3. **DO NOT create a new table.** `source_mentions` is a JSONB column on existing `sov_evaluations`.
4. **DO NOT block SOV writes on source extraction.** Separate Inngest step, runs after sentiment extraction. SOV + sentiment data safe even if source extraction fails.
5. **DO NOT use raw `fetch()` for AI calls** (§19.3). Use `generateObject` via `getModel('source-extract')`.
6. **DO NOT forget `zodSchema()` wrapper** on the Zod schema.
7. **DO NOT hardcode domain categorization that could change.** Use the helper functions with clear domain lists.
8. **DO NOT use `as any` on Supabase clients** (§38.2).
9. **DO NOT add plan gating.** Source intelligence enriches SOV data for all tiers.

---

## ✅ Definition of Done (AI_RULES §13.5)

- [ ] Migration adds `source_mentions JSONB` to `sov_evaluations`
- [ ] `database.types.ts` updated with `source_mentions` field
- [ ] `SourceMentionExtractionSchema` in `lib/ai/schemas.ts`
- [ ] `source-extract` model key in providers (gpt-4o-mini)
- [ ] `extractSourceMentions()` service with AI extraction
- [ ] `analyzeSourceIntelligence()` pure function — categorization, dedup, alerts
- [ ] `extractSOVSourceMentions()` + `writeSourceMentions()` pipeline functions
- [ ] Inngest SOV cron has source extraction step (after sentiment)
- [ ] Inline fallback includes source extraction
- [ ] `fetchSourceIntelligence()` data fetcher
- [ ] Dashboard at `/dashboard/source-intelligence` with alerts, sources table, categories, engine breakdown
- [ ] Sidebar with "AI Sources" link (test-id: `nav-source-intelligence`)
- [ ] Golden Tenant fixtures: MOCK_SOURCE_MENTION_EXTRACTION, MOCK_SOURCE_INTELLIGENCE_INPUT
- [ ] Seed data updated with source_mentions for OpenAI evaluation
- [ ] 55 tests passing across 4 files
- [ ] `npx vitest run` — ALL tests passing, no regressions
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] DEVLOG.md entry written

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| `sov_evaluations.cited_sources` | Sprint 74 | Google + Perplexity structured citation URLs |
| `sov_evaluations.raw_response` | Sprint 41+ | Text to extract source mentions from |
| Sentiment extraction pattern | Sprint 81 | Post-SOV Inngest step pattern, `gpt-4o-mini` usage |
| Multi-model SOV pipeline | Sprint 61 (§36.2) | Per-engine evaluation data |
| Citation Gap Dashboard | Sprint 58 (§34.1) | Related but different — aggregate platform coverage |
| `locations.website_url` | Schema | First-party URL matching for categorization |

---

## 🧠 Edge Cases

1. **No SOV evaluations:** Empty state on dashboard. No extraction runs.
2. **All engines have structured citations:** No AI extraction needed — `extractSOVSourceMentions` filters these out. Pure analysis only.
3. **No structured citations AND extraction fails:** Source falls back to `raw_response` analysis only; if that also fails, the evaluation has zero source data. Not counted.
4. **Business website URL not set:** `first_party` categorization still works via URL matching with `null` — just means nothing matches as first-party. The `missing_first_party` alert triggers at <10%.
5. **Same URL cited by 4 engines:** Deduplicated to one entry with `engines: ['perplexity', 'openai', 'google', 'copilot']` and `citationCount: 4`.
6. **Competitor blog with no URL:** Extracted mentions may have `inferredUrl: null`. Still tracked by name. Dedup key becomes `mention:<name>`.

---

## 🔮 AI_RULES Updates

Update §19.3 model key registry:
```
| `source-extract` | OpenAI gpt-4o-mini | `generateObject` | Source mention extraction from SOV raw_response. Uses `SourceMentionExtractionSchema`. Only for engines without structured citations. |
```

Add new rule:
```markdown
## 45. 🔍 Citation Source Intelligence (Sprint 82)

Identifies which web pages and sources AI engines cite when describing the business.

* **Two data paths:** (1) Structured `cited_sources` JSONB from Google/Perplexity (Sprint 74), (2) AI-extracted `source_mentions` from OpenAI/Copilot via `gpt-4o-mini`.
* **Only engines without structured citations get AI extraction** — saves tokens.
* **Pipeline position:** Separate Inngest step after sentiment extraction (Sprint 81). SOV + sentiment data safe even if source extraction fails.
* **Analysis:** `analyzeSourceIntelligence()` is a pure function — categorizes, deduplicates, ranks, generates alerts.
* **Alerts:** competitor_content (high), missing_first_party (medium), over-reliance on single source (medium).
* **Different from Citation Gap (§34.1):** Gap = which platforms you're listed on (market-level). Source Intelligence = which pages AI reads about YOU (org-level).
```
