# 16 — Occasion Engine
## Seasonal Opportunity Detection, Occasion Content Pipeline, and Temporal Scheduling
### Version: 1.0 | Date: February 23, 2026
### Companion to: 04-INTELLIGENCE-ENGINE.md, 15-LOCAL-PROMPT-INTELLIGENCE.md, 19-AUTOPILOT-ENGINE.md

---

## 1. Why Occasions Are a Separate Engine

Occasion-based discovery is structurally different from evergreen AEO queries:

- **Seasonal spikes:** AI recommendation patterns shift dramatically around Valentine's Day, New Year's Eve, and similar occasions. A business that doesn't exist in AI answers for "romantic dinner Alpharetta" 30 days before Valentine's Day is invisible at the highest-intent moment.
- **Lead time requirement:** Content needs to be published and indexed before the occasion — typically 3–4 weeks ahead. A cron that checks the occasion calendar proactively fires alerts, not reactively after the window passes.
- **Competition clears predictably:** Competitors who haven't built occasion-specific content are reliably uncontested at occasion query peaks. This makes occasions the highest-concentration First Mover opportunity pool in the product.

The Occasion Engine is the temporal layer: it knows *when* to alert, *what* queries to monitor, and *what content* to suggest.

---

## 2. Occasion Taxonomy (Complete Reference)

All 30 occasions are stored in the `local_occasions` reference table (seeded in `occasions_seed.sql`). This is the authoritative list.

### 2.1 Tier 1 — Hospitality Core (Highest ROI, all relevant categories)

| Occasion | Annual Date | Trigger Days Before | Peak Query Patterns |
|----------|------------|---------------------|---------------------|
| Valentine's Day | Feb 14 | 28 | "romantic dinner", "date night", "Valentine's dinner", "couples {category}" |
| New Year's Eve | Dec 31 | 42 | "NYE dinner", "New Year's Eve plans", "NYE party venue", "{category} New Year's" |
| Mother's Day | 2nd Sun May | 28 | "Mother's Day brunch", "Mother's Day dinner", "where to take mom" |
| Father's Day | 3rd Sun Jun | 21 | "Father's Day dinner", "Father's Day {category}" |
| Thanksgiving Eve | Day before Thanksgiving | 21 | "Thanksgiving Eve bar", "Wednesday before Thanksgiving plans" |
| Christmas Eve | Dec 24 | 21 | "Christmas Eve dinner", "holiday dinner {city}" |
| New Year's Day | Jan 1 | 14 | "New Year's Day brunch", "hangover brunch {city}" |

### 2.2 Tier 2 — Celebration Milestones (High intent, lower frequency)

| Occasion | Trigger Days Before | Peak Query Patterns |
|----------|---------------------|---------------------|
| Bachelorette Party | 60 (seasonal: Apr–Aug peak) | "bachelorette party venue", "bachelorette {category}", "girls night out {city}" |
| Birthday Dinner | Evergreen (no date) | "birthday dinner {city}", "birthday {category}", "birthday party venue" |
| Anniversary Dinner | Evergreen | "anniversary restaurant", "romantic anniversary dinner", "special occasion {category}" |
| Graduation Dinner | May–Jun peak | "graduation dinner {city}", "graduation celebration {category}" |
| Baby Shower Brunch | Evergreen | "baby shower venue {city}", "baby shower brunch {city}" |
| Engagement Celebration | Evergreen | "engagement party venue", "where to celebrate engagement" |
| Promotion Dinner | Evergreen | "celebration dinner {city}", "fancy dinner to celebrate" |

### 2.3 Tier 3 — Cultural & Ethnic Occasions (High relevance for multicultural venues)

| Occasion | Annual Date | Trigger Days Before | Notes |
|----------|------------|---------------------|-------|
| Diwali | Oct–Nov (lunar) | 21 | High relevance for Indian restaurants, fusion lounges |
| Eid al-Fitr | Lunar calendar | 28 | High relevance for halal establishments |
| Holi | March (lunar) | 14 | Themed events opportunity |
| Lunar New Year | Jan–Feb (lunar) | 28 | High relevance for Asian-fusion venues |
| Nowruz | Mar 20 | 14 | Persian New Year; relevant in metro areas with Iranian communities |
| Black History Month | February | 14 | Themed event content opportunity |
| St. Patrick's Day | Mar 17 | 21 | Bars, pubs, Irish-adjacent venues |
| Cinco de Mayo | May 5 | 21 | Relevant for Latin-fusion and bar categories |

### 2.4 Tier 4 — Seasonal & Recurring (Contextual, lower conversion rate)

| Occasion | Period | Trigger | Peak Query Patterns |
|----------|--------|---------|---------------------|
| Summer Date Night | Jun–Aug | Jun 1 | "outdoor dining", "patio {category}", "summer date night {city}" |
| Autumn Vibes | Sep–Nov | Sep 1 | "cozy restaurant fall", "fall date night {city}" |
| Holiday Party Season | Nov–Dec | Nov 1 | "holiday party venue", "corporate holiday dinner {city}" |
| Super Bowl Sunday | Feb (1st Sun) | 14 | "Super Bowl watch party venue", "game day {category}" |
| Game Day (weekly) | Sep–Jan | N/A — evergreen in season | "watch game {city}", "{category} with TVs" |
| Restaurant Week | Variable by city | 14 before local RW | "restaurant week {city}", "best restaurant week deals {city}" |
| Dry January | January | Jan 1 | "mocktail bar {city}", "non-alcoholic drinks {city}" |
| Ramadan Iftar | Lunar calendar | 21 | "iftar dinner {city}", "halal iftar" |

### 2.5 Occasion-Category Relevance Matrix

Not every occasion applies to every business. The seeder uses `relevant_categories` from the `local_occasions` table to filter which tenants receive each occasion alert.

| Occasion | Restaurant | Bar/Lounge | Hookah | Event Venue | Coffee |
|----------|-----------|------------|--------|-------------|--------|
| Valentine's Day | ✅ | ✅ | ✅ | ✅ | ⚠️ partial |
| Bachelorette | ⚠️ partial | ✅ | ✅ | ✅ | ❌ |
| Birthday Dinner | ✅ | ✅ | ✅ | ✅ | ❌ |
| Diwali | ✅ Indian | ✅ | ✅ | ✅ | ❌ |
| Super Bowl | ❌ | ✅ | ✅ | ✅ | ❌ |
| Dry January | ❌ | ✅ | ⚠️ | ❌ | ✅ |

---

## 3. The Occasion Scheduler

### 3.1 How It Works

The Occasion Scheduler is a lightweight sub-process that runs inside the existing weekly SOV cron (Sunday 2 AM EST). It does not require a separate cron job.

```typescript
// lib/occasion-engine/scheduler.ts

interface OccasionAlert {
  occasionId: string;
  occasionName: string;
  occasionType: OccasionType;
  daysUntilPeak: number;
  peakQueryPatterns: OccasionQueryPattern[];
  relevantQueries: SOVTargetQuery[];  // queries from sov_target_queries matching this occasion
  citedForAnyQuery: boolean;          // true if any occasion query returned a citation last SOV run
  competitorWinning: boolean;         // true if Greed Engine has intercept data for these queries
  competitorName: string | null;
}

async function checkOccasionAlerts(orgId: string, locationId: string): Promise<OccasionAlert[]> {
  const today = new Date();
  const activeAlerts: OccasionAlert[] = [];

  const occasions = await getActiveOccasions();  // from local_occasions where is_active = true

  for (const occasion of occasions) {
    const daysUntilPeak = getDaysUntilPeak(occasion, today);

    // Only fire if within the trigger window and not past peak
    if (daysUntilPeak < 0 || daysUntilPeak > occasion.triggerDaysBefore) continue;

    // Check if business category is relevant for this occasion
    const locationCategories = await getLocationCategories(locationId);
    const isRelevant = occasion.relevantCategories.some(c =>
      locationCategories.some(lc => lc.toLowerCase().includes(c.toLowerCase()))
    );
    if (!isRelevant) continue;

    // Check SOV data: is business cited for any occasion queries?
    const occasionQueries = await getOccasionQueriesForLocation(locationId, occasion.id);
    const citedForAny = occasionQueries.some(q => q.lastCited === true);

    // Check Greed Engine: is competitor winning?
    const competitorIntercept = await getLatestInterceptForOccasion(orgId, occasion.peakQueryPatterns);

    activeAlerts.push({
      occasionId: occasion.id,
      occasionName: occasion.name,
      occasionType: occasion.occasionType,
      daysUntilPeak,
      peakQueryPatterns: occasion.peakQueryPatterns,
      relevantQueries: occasionQueries,
      citedForAnyQuery: citedForAny,
      competitorWinning: !!competitorIntercept,
      competitorName: competitorIntercept?.competitorName ?? null,
    });
  }

  return activeAlerts;
}
```

### 3.2 `getDaysUntilPeak()` Logic

```typescript
function getDaysUntilPeak(occasion: LocalOccasion, today: Date): number {
  if (!occasion.annualDate) {
    // Floating occasions (Bachelorette season, Lunar New Year, etc.)
    // Use a pre-computed next_peak_date from the local_occasions.annual_date heuristic
    return computeFloatingOccasionDays(occasion, today);
  }

  const [month, day] = occasion.annualDate.split('-').map(Number);
  const thisYear = new Date(today.getFullYear(), month - 1, day);
  const nextYear = new Date(today.getFullYear() + 1, month - 1, day);

  const daysToThisYear = Math.ceil((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const daysToNextYear = Math.ceil((nextYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Use this year's date if we're not past it yet, otherwise use next year's
  return daysToThisYear >= 0 ? daysToThisYear : daysToNextYear;
}
```

### 3.3 Alert Deduplication

An occasion alert is not re-fired to the same org+occasion pair more than once per 7-day window. Store fired alerts in a lightweight Vercel KV key: `occasion_alert:{org_id}:{occasion_id}:{week_number}`. TTL: 8 days.

This prevents the same "Valentine's Day is in 28 days" alert appearing in 4 consecutive weekly emails.

---

## 4. Occasion Content Pipeline

When an occasion alert fires, the Occasion Engine optionally triggers the Autopilot Engine (Doc 19) to generate a content draft. The draft type is `occasion_page`.

### 4.1 Trigger Conditions for Auto-Draft

Auto-draft is triggered when **all** of the following are true:
1. `daysUntilPeak <= 21` (within 3-week window — enough time to publish and get indexed)
2. `citedForAnyQuery === false` (business not yet cited for this occasion)
3. No existing `content_drafts` row with `trigger_type = 'occasion'` and `trigger_id = occasion.id` and `status IN ('draft', 'approved', 'published')` — idempotency check
4. Org plan is Growth+ (Starter receives alert but no auto-draft)

### 4.2 Occasion Draft Brief Prompt

```typescript
const occasionDraftPrompt = `
You are an AEO content strategist. Generate a content brief for a ${contentType} page
targeting AI search queries about ${occasion.name}.

Business: ${businessName}
Location: ${city}, ${state}
Category: ${primaryCategory}
Occasion: ${occasion.name} (${daysUntilPeak} days away)
Target queries: ${occasion.peakQueryPatterns.map(p => p.query).join(', ')}

${competitorWinning ? `Competitive context: ${competitorName} is currently winning these queries.` : ''}

Generate JSON only:
{
  "title": "page title targeting the occasion queries",
  "content": "300-word Answer-First page content. Start with a direct answer to the most common query. Include: why this venue is ideal for ${occasion.name}, specific details (atmosphere, menu items, booking), and a clear CTA. Mention ${city} naturally 2-3 times.",
  "estimated_aeo_score": 70-90,
  "target_keywords": ["array", "of", "5-8", "target", "phrases"]
}
`;
```

### 4.3 Occasion Page Content Structure

All occasion pages follow the same Answer-First structure:

```
H1: [Business Name] — The Perfect [City] Venue for [Occasion]

Opening paragraph (Answer-First):
"[Business Name] is [City]'s premier [category] for [occasion]. 
[1-sentence value prop]. [Booking CTA or key differentiator]."

Section: Why [Business Name] for [Occasion]
- 3 bullet points: atmosphere, menu/offering, logistics (parking, reservations)

Section: [Occasion]-Specific Offerings
- Seasonal menu items or packages
- Special occasion services (bottle service, reserved seating, DJ, etc.)

Section: How to Book / Plan Your [Occasion]
- Reservation instructions
- Contact info
- Hours during occasion period

FAQPage schema (JSON-LD):
- "Does [business] offer [occasion] reservations?"
- "What is the atmosphere like at [business] for [occasion]?"
- "What should I wear to [business] for [occasion]?"
```

---

## 5. Occasion Alert Feed (UI Reference)

Full UX spec in Doc 06 Section 10. This section covers the data model only.

### 5.1 Alert Display Priority

When multiple occasion alerts are active simultaneously (e.g., Valentine's AND Bachelorette season), prioritize by:
1. `daysUntilPeak` ascending (most urgent first)
2. `competitorWinning` descending (contested opportunities above uncontested)
3. Occasion tier (Tier 1 above Tier 2 above Tier 3)

Maximum 3 occasion alerts displayed simultaneously on Dashboard home. Remaining visible on `/visibility` Occasion tab.

### 5.2 Alert State Machine

```
new → actioned (user clicked "Create Content" → Autopilot draft created)
new → dismissed (user clicked "Remind Later" → stored in localStorage, 7-day snooze)
new → auto_expired (occasion peak date passed, system marks expired)
actioned → content_published (linked content_draft reaches status 'published')
```

---

## 6. Occasion Seeds (`occasions_seed.sql`)

The `local_occasions` reference table must be seeded before the Occasion Engine runs. The seed file is separate from migration files — it can be re-run safely (`INSERT ... ON CONFLICT (name) DO NOTHING`).

**File:** `supabase/seeds/occasions_seed.sql`

**Priority seeding (Phase 6 minimum — 20 occasions):**
Valentine's Day, New Year's Eve, Mother's Day, Father's Day, Bachelorette Party, Birthday Dinner, Anniversary Dinner, Graduation Dinner, Christmas Eve, Thanksgiving Eve, New Year's Day, Diwali, St. Patrick's Day, Cinco de Mayo, Eid al-Fitr, Lunar New Year, Baby Shower Brunch, Engagement Celebration, Super Bowl Sunday, Holiday Party Season.

**Full seed (Phase 7+ — all 30 occasions):** Complete taxonomy from Section 2.

```sql
-- Sample seed row
INSERT INTO public.local_occasions (name, occasion_type, trigger_days_before, annual_date, peak_query_patterns, relevant_categories)
VALUES (
  'Valentine''s Day',
  'holiday',
  28,
  '02-14',
  '[
    {"query": "romantic dinner {city}", "category": "occasion"},
    {"query": "best place for date night {city}", "category": "occasion"},
    {"query": "Valentine''s dinner {city}", "category": "occasion"},
    {"query": "couples {category} {city}", "category": "occasion"}
  ]'::jsonb,
  '["restaurant", "bar", "lounge", "hookah", "event venue"]'::jsonb
) ON CONFLICT (name) DO NOTHING;
```

---

## 7. Integration Points

| System | Integration |
|--------|-------------|
| SOV Cron (Doc 04c) | Occasion scheduler runs as sub-step after SOV results are written |
| Prompt Intelligence (Doc 15) | Occasion queries from `local_occasions.peak_query_patterns` are seeded into `sov_target_queries` with `query_category = 'occasion'` and `occasion_tag` set |
| Greed Engine (Doc 04 §3) | Intercept results for occasion queries feed `competitorWinning` field in occasion alerts |
| Autopilot Engine (Doc 19) | Occasion alerts with auto-draft conditions trigger `createOccasionDraft()` in Autopilot |
| Dashboard (Doc 06 §10) | Occasion Alert Feed rendered from this engine's alert output |

---

## 8. TypeScript Interfaces

Full interfaces defined in Doc 03 Section 15.15. This section shows the scheduler-specific types not covered there.

```typescript
// src/lib/types/occasions.ts (additions)

export interface OccasionAlert {
  occasionId: string;
  occasionName: string;
  occasionType: OccasionType;
  daysUntilPeak: number;
  peakQueryPatterns: OccasionQueryPattern[];
  relevantQueries: SOVTargetQuery[];
  citedForAnyQuery: boolean;
  competitorWinning: boolean;
  competitorName: string | null;
  autoDraftTriggered: boolean;
  autoDraftId: string | null;     // content_drafts.id if draft was created
}

export interface OccasionSchedulerResult {
  orgId: string;
  locationId: string;
  alertsGenerated: OccasionAlert[];
  alertsFired: number;
  alertsSkipped: number;    // deduped by KV check
  runAt: string;
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-23 | Initial spec. 30-occasion taxonomy across 4 tiers. Occasion scheduler (runs inside SOV cron). `getDaysUntilPeak()` implementation. Alert deduplication via Vercel KV. Auto-draft trigger conditions. Occasion page content structure (Answer-First template). Alert state machine. Seed file spec. Integration points. TypeScript interfaces. |
