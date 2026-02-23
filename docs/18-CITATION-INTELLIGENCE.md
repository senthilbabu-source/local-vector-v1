# 18 — Citation Intelligence
## Platform Coverage Mapping, Citation Gap Scoring, and Review Signal Amplification
### Version: 1.0 | Date: February 23, 2026
### Companion to: 05-API-CONTRACT.md §15, 06-FRONTEND-UX-SPEC.md §11, 03-DATABASE-SCHEMA.md §15.16

---

## ⚠️ Architectural Authority Notice

- **Doc 06 Section 6 (Listings Page) is authoritative for:** The existing directory listing UI, NAP consistency score, the `directory_listings` table, and the "Big 6" read-only monitoring scope.
- **This doc (18) is authoritative for:** Citation intelligence methodology (which platforms AI *actually* cites in answers, as opposed to which platforms *exist*), the `citation_source_intelligence` table, gap scoring, the Citation Gap Finder UI tab, and review signal strategy.
- **Critical distinction:** A business can be *listed* on TripAdvisor and still have a citation gap — if AI doesn't cite TripAdvisor for their category, the listing doesn't help. This engine measures actual AI citation behavior, not listing presence.

---

## 1. The Core Insight

Most local SEO tools measure where you're listed. Citation Intelligence measures where **AI actually looks** when answering queries about your category.

These are different. Perplexity cites Yelp 87% of the time for hookah lounge queries in Atlanta. It cites TripAdvisor 62% of the time. It rarely cites the business's own website. If a tenant is perfectly listed on Bing but not on Yelp, they're invisible in AI answers — regardless of how many other directories they're on.

The `citation_source_intelligence` table is aggregate market data, not tenant-specific. It answers: *"For queries about [category] in [city], which platforms appear in AI answers, and how often?"* This data is collected via the Citation Intelligence Cron and is shared across all tenants in the same category+city.

---

## 2. Citation Intelligence Cron

### 2.1 How It Works

The cron runs monthly (first Sunday, 3 AM EST — before SOV cron at 2 AM). It systematically samples AI answers for each tracked category+city combination and records which domains appear in cited sources.

```typescript
// supabase/functions/run-citation-cron/index.ts

const TRACKED_CATEGORIES = [
  'hookah lounge', 'restaurant', 'bar', 'lounge', 'event venue',
  'nightclub', 'coffee shop', 'cocktail bar', 'sports bar',
];

const TRACKED_METROS = [
  // Top 20 US metros by restaurant density
  'Atlanta GA', 'Dallas TX', 'Houston TX', 'Chicago IL', 'Miami FL',
  'Los Angeles CA', 'New York NY', 'Phoenix AZ', 'Las Vegas NV', 'Denver CO',
  'Nashville TN', 'Austin TX', 'Seattle WA', 'Boston MA', 'Philadelphia PA',
  'San Francisco CA', 'Orlando FL', 'San Diego CA', 'Portland OR', 'Charlotte NC',
];

async function runCitationCron() {
  for (const category of TRACKED_CATEGORIES) {
    for (const metro of TRACKED_METROS) {
      const [city, state] = metro.split(' ');

      // Run 5 sample discovery queries per category+metro
      const sampleQueries = [
        `best ${category} in ${city} ${state}`,
        `top ${category} ${city}`,
        `${category} ${city} ${state} recommendations`,
        `where to find ${category} in ${city}`,
        `${category} near ${city}`,
      ];

      const citationsByPlatform: Record<string, number> = {};
      let successfulQueries = 0;

      for (const query of sampleQueries) {
        try {
          const result = await runPerplexitySOVQuery(query);
          for (const url of result.citedUrls) {
            const platform = extractPlatform(url);
            if (platform) {
              citationsByPlatform[platform] = (citationsByPlatform[platform] ?? 0) + 1;
            }
          }
          successfulQueries++;
          await sleep(500);  // rate limiting
        } catch { continue; }
      }

      // Write results for each platform found
      for (const [platform, citationCount] of Object.entries(citationsByPlatform)) {
        const frequency = citationCount / successfulQueries;
        await upsertCitationIntelligence({
          businessCategory: category,
          city, state, platform,
          citationFrequency: frequency,
          sampleSize: successfulQueries,
          modelProvider: 'perplexity-sonar',
          measuredAt: new Date().toISOString(),
        });
      }
    }
  }
}
```

### 2.2 Platform Extraction

```typescript
function extractPlatform(url: string): string | null {
  const PLATFORM_MAP: Record<string, string> = {
    'yelp.com': 'yelp',
    'tripadvisor.com': 'tripadvisor',
    'google.com/maps': 'google',
    'maps.google.com': 'google',
    'facebook.com': 'facebook',
    'instagram.com': 'instagram',
    'reddit.com': 'reddit',
    'nextdoor.com': 'nextdoor',
    'foursquare.com': 'foursquare',
    'opentable.com': 'opentable',
    'resy.com': 'resy',
    'thrillist.com': 'thrillist',
    'timeout.com': 'timeout',
    'eater.com': 'eater',
    'zagat.com': 'zagat',
  };

  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    for (const [pattern, platform] of Object.entries(PLATFORM_MAP)) {
      if (hostname.includes(pattern) || url.includes(pattern)) return platform;
    }
    // If not in map but is a recognizable domain, return the hostname (extensible)
    return hostname.split('.')[0];
  } catch {
    return null;
  }
}
```

### 2.3 Cost

Monthly citation cron: 9 categories × 20 metros × 5 queries = **900 Perplexity Sonar queries/month**

At $0.005/query = **$4.50/month** (fixed infrastructure cost, not per-tenant). This is the `~$5/mo` line in the Doc 10 cost table.

---

## 3. Citation Gap Score

### 3.1 What It Measures

The Citation Gap Score (0–100) answers: *"Of all the platforms AI cites for my category in my city, what fraction am I listed on?"*

Score of 100 means the tenant is listed on every platform AI uses. Score of 0 means they're listed on none of them (or no data exists).

### 3.2 Calculation

```typescript
function calculateCitationGapScore(
  platforms: CitationSourceIntelligence[],
  tenantListings: DirectoryListing[]
): CitationGapSummary {
  // Only count platforms where AI cites them meaningfully (>= 30% frequency)
  const relevantPlatforms = platforms.filter(p => p.citationFrequency >= 0.30);

  const coveredPlatforms = relevantPlatforms.filter(platform => {
    return tenantListings.some(listing =>
      listing.directory.toLowerCase() === platform.platform.toLowerCase() &&
      listing.syncStatus !== 'not_found' &&
      listing.syncStatus !== 'not_claimed'
    );
  });

  const gapScore = relevantPlatforms.length === 0
    ? 100  // No data yet — optimistic default
    : Math.round((coveredPlatforms.length / relevantPlatforms.length) * 100);

  // Find biggest uncovered gap
  const topGap = relevantPlatforms
    .filter(p => !coveredPlatforms.includes(p))
    .sort((a, b) => b.citationFrequency - a.citationFrequency)[0];

  return {
    gapScore,
    platformsCovered: coveredPlatforms.length,
    platformsThatMatter: relevantPlatforms.length,
    topGap: topGap ? {
      platform: topGap.platform,
      citationFrequency: topGap.citationFrequency,
      action: `Claim your ${capitalize(topGap.platform)} listing to appear in ${Math.round(topGap.citationFrequency * 100)}% more AI answers`,
    } : null,
  };
}
```

### 3.3 Gap Score in the Reality Score

The `citation_gap_score` is surfaced in the DataHealth component of the Reality Score (Doc 04 Section 6). It replaces the current placeholder for listing sync % once Doc 18 is implemented.

**Updated DataHealth formula (Phase 7+):**
```
DataHealth = (NAP Consistency × 0.40) + (Citation Gap Score × 0.35) + (Link Injected × 0.25)
```

**🤖 Agent Rule:** Update `calculateDataHealthScore()` in Phase 7 to incorporate `citation_gap_score`. The existing `nap_consistency_score` calculation is unchanged — it measures directory listing accuracy, not AI citation frequency. Both metrics matter for different reasons.

---

## 4. Platform Priority Tiers

Based on initial citation data collection across hospitality categories in US metros, platforms sort into three priority tiers:

### Tier 1 — Almost Always Cited (>70% frequency)
| Platform | Avg Citation Frequency | Action Priority |
|----------|----------------------|----------------|
| Google (Maps/GBP) | ~94% | **Critical** — GBP must be claimed and verified |
| Yelp | ~87% | **High** — Most-cited review platform for AI |

### Tier 2 — Frequently Cited (30–70%)
| Platform | Avg Citation Frequency | Notes |
|----------|----------------------|-------|
| TripAdvisor | ~62% | Especially for food/nightlife categories |
| Facebook | ~48% | Pages with active reviews |
| OpenTable | ~41% | For full-service restaurants with reservation data |
| Resy | ~35% | Growing; high-end dining |

### Tier 3 — Contextually Cited (<30%)
| Platform | Notes |
|----------|-------|
| Reddit | r/[city] subreddits are increasingly cited by Perplexity for "best of" queries |
| Nextdoor | Growing local discovery source; cited by AI for hyper-local queries |
| Foursquare | Declining but still indexed |
| Thrillist / Timeout / Eater | Editorial citations — harder to influence directly |
| Instagram | Cited when the business has a high follower account; requires active posting |

**Strategic implication:** For most restaurant/bar/lounge categories, a tenant who is well-listed on Google + Yelp + TripAdvisor covers the vast majority of AI-cited platforms. The Citation Gap Finder's primary job is identifying the Tier 1 and 2 gaps — not chasing Tier 3.

---

## 5. Review Signal Strategy

Citation probability on Yelp, TripAdvisor, and Google correlates strongly with review volume and recency — not just listing presence. The Citation Intelligence layer includes a review signal analysis to surface actionable patterns.

### 5.1 Review Volume Benchmarking

The citation cron also records the approximate review counts for the top-cited businesses in each category+metro sample. This creates a benchmark: *"Businesses cited in AI answers for hookah lounges in Alpharetta have an average of X Yelp reviews."*

```typescript
// Added to citation cron output
interface CitationBenchmark {
  businessCategory: string;
  city: string;
  state: string;
  platform: string;
  medianReviewCount: number;    // Of businesses that were cited
  minReviewCountForCitation: number;  // Lowest review count still cited
  measuredAt: string;
}
```

This benchmark is stored in `citation_source_intelligence` via an additional `review_benchmark` JSONB column (not in the original DDL — add in Phase 7 migration).

### 5.2 Review Gap Alert

When `tenant.yelp_review_count < citation_benchmark.minReviewCountForCitation` for their category+metro:
- Surface a "Review Gap" alert in the Citation Gap Finder tab
- Copy: *"Businesses cited by AI for '[category]' in [city] typically have at least X Yelp reviews. You have Y. Increasing reviews improves citation probability."*

**Implementation note:** Review counts are not fetched in real-time (no Yelp API integration). This is estimated from the citation sample (businesses that appear in Perplexity citations have visible review counts on their Yelp pages). Manual update acceptable in Phase 7; automated scraping is out of scope.

### 5.3 Review Keyword Intelligence

AI citation probability also correlates with the presence of specific keywords in reviews. When Perplexity answers "best late night hookah in Alpharetta," it reads and summarizes review text — businesses mentioned in reviews as "best late night" are cited more often.

The Greed Engine (Doc 04 Section 3.2) already captures `winning_factor` which often identifies review keyword patterns. The Citation Intelligence layer uses this data to surface:

*"Cloud 9 Lounge has 15 reviews mentioning 'late night.' You have 2. Ask happy customers to mention [specific phrase] in their reviews."*

This data flows from `competitor_intercepts.gap_details` → displayed in Citation Gap Finder as a "Review Keyword Gap." No new data collection required — it reuses existing Greed Engine output.

---

## 6. Reddit & Nextdoor Monitoring

Reddit and Nextdoor are growing as AI citation sources, especially for Perplexity's "community knowledge" synthesis. These platforms are difficult to control but important to monitor.

### 6.1 What to Monitor

- **Reddit:** `r/{city}` subreddit posts mentioning the business name (positive or negative). Posts with high upvotes are more likely to be cited by AI.
- **Nextdoor:** Public business recommendations in the tenant's neighborhood.

### 6.2 Implementation Approach (Phase 8+)

Reddit has a public API (no auth required for read-only access to public subreddits). Nextdoor does not. Monitoring approach:

**Reddit:**
```typescript
// Lightweight Reddit monitoring — runs weekly alongside SOV cron
async function checkRedditMentions(businessName: string, city: string) {
  const subreddit = `r/${city.toLowerCase().replace(/\s+/g, '')}`;
  const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(businessName)}&restrict_sr=true&sr=${subreddit}&sort=top&limit=10`;
  const results = await fetch(searchUrl, { headers: { 'User-Agent': 'LocalVector/1.0' } });
  // Parse and store mentions with upvote_count and post_url
}
```

**Nextdoor:** Not feasible via API. Surface as a manual action item: *"Nextdoor recommendations are cited by AI in [city]. Encourage happy customers to recommend you on Nextdoor."*

---

## 7. Citation Gap Finder UI (Reference)

Full UI spec in Doc 06 Section 11. This section covers the data-to-UI mapping.

### 7.1 Platform Frequency Bar Visual

The frequency bar in the `CitationPlatformMap` component maps `citationFrequency` (0.0–1.0) to a bar width:

```typescript
// Bar width = frequency * 100% (using CSS width style)
// Color:
// >= 0.80: emerald (--success)
// 0.50-0.79: amber (#F59E0B)
// < 0.50: slate (--muted)

function getBarColor(frequency: number): string {
  if (frequency >= 0.80) return 'bg-emerald-500';
  if (frequency >= 0.50) return 'bg-amber-500';
  return 'bg-slate-400';
}
```

### 7.2 "You're Listed" Check

`org_listed` is derived at query time by joining `citation_source_intelligence` against the tenant's `directory_listings` table:

```sql
SELECT 
  csi.*,
  dl.id IS NOT NULL AS org_listed,
  dl.listing_url AS org_listing_url,
  dl.sync_status
FROM citation_source_intelligence csi
LEFT JOIN directory_listings dl ON (
  dl.org_id = $orgId
  AND LOWER(dl.directory) = csi.platform
  AND dl.sync_status NOT IN ('not_found', 'not_claimed')
)
WHERE csi.business_category = $category
  AND csi.city = $city
  AND csi.state = $state
  AND csi.model_provider = $modelProvider
ORDER BY csi.citation_frequency DESC;
```

---

## 8. Integration Points

| System | Integration |
|--------|-------------|
| Listings Page (Doc 06 §6) | Citation Gap Finder appears as second tab on the Listings page. `CitationGapBadge` appears on `ListingRow` for platforms with `gap: true`. |
| Reality Score (Doc 04 §6) | `citation_gap_score` feeds DataHealth component (Phase 7+ formula update). |
| Greed Engine (Doc 04 §3) | `winning_factor` from intercepts feeds Review Keyword Gap alerts (Section 5.3). |
| Autopilot Engine (Doc 19) | Citation gaps do not currently trigger auto-drafts (citation gaps need listing creation, not content creation). Future: may trigger a "Claim your listing" task card. |
| SOV Cron (Doc 04c) | Citation Intelligence cron runs monthly; SOV cron runs weekly. Separate Edge Functions. |

---

## 9. TypeScript Interfaces

Full `CitationSourceIntelligence` interface in Doc 03 Section 15.16. This section adds analysis-specific types.

```typescript
// src/lib/types/citations.ts (additions)

export interface CitationBenchmark {
  businessCategory: string;
  city: string;
  state: string;
  platform: string;
  medianReviewCount: number;
  minReviewCountForCitation: number;
  measuredAt: string;
}

export interface ReviewKeywordGap {
  platform: string;
  competitorName: string;
  keyword: string;
  competitorMentionCount: number;
  tenantMentionCount: number;
  suggestedReviewAsk: string;  // "Ask customers to mention '[keyword]' in their Yelp review"
}

export interface CitationMonitorResult {
  businessName: string;
  city: string;
  platform: 'reddit' | 'nextdoor';
  mentionCount: number;
  topMention: {
    url: string;
    snippet: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    upvotes: number;
  } | null;
  checkedAt: string;
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-23 | Initial spec. Citation intelligence cron (900 Perplexity queries/month at fixed $4.50 cost). Platform extraction logic. Citation gap score calculation. DataHealth formula update (Phase 7). Platform priority tiers (Tier 1–3). Review signal strategy: volume benchmarking, keyword gap from Greed Engine intercepts. Reddit monitoring implementation. Citation Gap Finder data-to-UI mapping. TypeScript interfaces. |
