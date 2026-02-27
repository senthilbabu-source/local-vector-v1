# Claude Code Prompt — Sprint 70: Schema Fix Generator (FAQ + Restaurant + OpeningHours JSON-LD)

## ⚠️ READ BEFORE ANYTHING ELSE

Read these files in order BEFORE writing any code:
1. `docs/AI_RULES.md` — all 38 rules. Critical for this sprint:
   - §1 (schema source of truth = `prod_schema.sql`)
   - §2 (JSONB types from `lib/types/ground-truth.ts` — **import, never inline**)
   - §3 (RLS + `getSafeAuthContext()` + belt-and-suspenders `.eq('org_id', orgId)`)
   - §4 (tests first, golden tenant, mocking)
   - §5 (no API calls on page load — schema generation is deterministic, no LLM needed)
   - §9 (ground-truth types = single source of truth for hours_data, amenities, categories)
   - §10 (`hours_data` closed-day encoding: `"closed"` literal vs missing key)
   - §11 (RLS shadowban — derive org_id server-side)
   - §13 (DEVLOG format)
   - §18 (`createClient()` for pages, never service-role)
   - §20 (never hardcode placeholders)
   - §25 (`'use server'` files — all exports async)
   - §38 (database.types.ts, no `as any` on Supabase)
2. `docs/DESIGN-SYSTEM.md` — color tokens, card/badge patterns
3. `supabase/prod_schema.sql` — tables: `locations`, `target_queries`, `menu_items`, `magic_menus`, `menu_categories`, `page_audits`, `local_occasions`, `location_integrations`
4. `supabase/migrations/20260218000000_initial_schema.sql` — golden tenant location (lines ~662-700): has hours_data, amenities, categories, address, phone
5. `lib/types/ground-truth.ts` — `DayOfWeek`, `DayHours`, `HoursData`, `Amenities`, `Categories`, `Attributes`
6. `lib/utils/generateMenuJsonLd.ts` — **existing** Menu+Restaurant JSON-LD generator. DO NOT duplicate. Extend or complement.
7. `lib/utils/schemaOrg.ts` — `DIETARY_TAG_MAP`, `mapDietaryTagsToSchemaUris()`. Reuse.
8. `src/__fixtures__/golden-tenant.ts` — golden tenant data
9. `app/dashboard/page-audits/page.tsx` — Page Audit dashboard (displays `schema_completeness_score` and `faq_schema_present`)
10. `app/dashboard/page-audits/_components/PageAuditCard.tsx` — per-page audit card (will need "Generate Schema" button)
11. `lib/page-audit/auditor.ts` — scores `schema_completeness_score` and `faq_schema_present`

---

## What This Sprint Does

Build a **Schema Fix Generator** — a service that auto-generates copy-to-clipboard JSON-LD code blocks for schemas the business is MISSING, using data already in LocalVector.

**This is the core differentiation.** Profound tells you "FAQ schema score: 0." LocalVector tells you "FAQ schema score: 0 — here are 6 FAQ questions generated from your actual SOV queries with answers from your ground truth data. Copy this JSON-LD to your website."

### Three Schema Types to Generate

| Schema Type | Source Data in LocalVector | Why AI Cares |
|------------|---------------------------|-------------|
| **`FAQPage`** | `target_queries.query_text` + location ground truth | 3.2x more likely to appear in AI Overviews |
| **`OpeningHoursSpecification`** | `locations.hours_data` (JSONB) | Fixes the #1 hallucination category (wrong hours) |
| **`LocalBusiness` with `sameAs`** | `locations.*` + `location_integrations.listing_url` | Entity disambiguation + social proof links |

**What it does NOT do (yet):** It does NOT auto-inject schema into customer websites. It generates code blocks that users copy-paste. One-click injection is Sprint 84+ (Phase 4 — requires WordPress plugin integration).

---

## Architecture Overview

```
Sprint 70 — Schema Fix Generator
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SERVICE LAYER (Pure functions — no DB, no side effects):
├── lib/schema-generator/
│   ├── types.ts                — shared types (SchemaType, GeneratedSchema)
│   ├── faq-schema.ts           — generateFAQPageSchema()
│   ├── hours-schema.ts         — generateOpeningHoursSchema()
│   ├── local-business-schema.ts — generateLocalBusinessSchema()
│   └── index.ts                — re-exports all generators

DATA LAYER (Fetches ground truth for schema generation):
├── lib/data/schema-generator.ts — fetchSchemaGeneratorData()

SERVER ACTION (Orchestrates fetch → generate → return):
├── app/dashboard/page-audits/schema-actions.ts — generateSchemaFix()

UI COMPONENTS (Display + copy-to-clipboard):
├── app/dashboard/page-audits/_components/
│   ├── SchemaFixPanel.tsx       — Tab panel for schema types
│   ├── SchemaCodeBlock.tsx      — Syntax-highlighted JSON-LD + copy button
│   └── PageAuditCard.tsx        — MODIFY: add "Generate Schema Fix" button

TESTS:
├── src/__tests__/unit/schema-generator-faq.test.ts
├── src/__tests__/unit/schema-generator-hours.test.ts
├── src/__tests__/unit/schema-generator-local-business.test.ts
└── src/__tests__/unit/schema-generator-data.test.ts
```

---

## Phase 1: Service Layer — Pure Schema Generators

These are **pure functions** — they take typed inputs and return JSON-LD objects. No database calls, no side effects, no Supabase client. This makes them trivially testable.

### 1A — Types: `lib/schema-generator/types.ts`

```typescript
import type { HoursData, Amenities, Categories } from '@/lib/types/ground-truth';

// ---------------------------------------------------------------------------
// Input types — assembled from DB by the data layer
// ---------------------------------------------------------------------------

export interface SchemaLocationInput {
  business_name: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string;
  phone: string | null;
  website_url: string | null;
  hours_data: HoursData | null;
  amenities: Amenities | null;
  categories: Categories | null;
  google_place_id: string | null;
}

export interface SchemaIntegrationInput {
  platform: string;
  listing_url: string | null;
}

export interface SchemaQueryInput {
  query_text: string;
  query_category: string;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type SchemaType = 'FAQPage' | 'OpeningHoursSpecification' | 'LocalBusiness';

export interface GeneratedSchema {
  schemaType: SchemaType;
  jsonLd: object;            // The JSON-LD object (not stringified)
  jsonLdString: string;      // Pre-formatted JSON string for copy-to-clipboard
  description: string;       // Human-readable explanation of what this fixes
  estimatedImpact: string;   // e.g., "Est. +15% AI citation improvement"
  missingReason: string;     // Why this schema was needed
}
```

### 1B — FAQ Schema Generator: `lib/schema-generator/faq-schema.ts`

**The innovation:** FAQ answers are generated from the business's ACTUAL ground truth data, combined with REAL prompts from the SOV query library.

```typescript
import type { SchemaLocationInput, SchemaQueryInput, GeneratedSchema } from './types';

/**
 * Generates FAQPage JSON-LD using actual SOV queries as questions and
 * location ground truth as answers.
 *
 * The questions come from real prompts people ask AI engines (tracked in
 * target_queries). The answers use verified business data (hours, amenities,
 * address) — not AI-generated text.
 *
 * @returns null if fewer than 2 queries exist (FAQ needs at least 2 Q&A pairs)
 */
export function generateFAQPageSchema(
  location: SchemaLocationInput,
  queries: SchemaQueryInput[],
): GeneratedSchema | null {
  if (queries.length < 2) return null;

  // Generate Q&A pairs from real data
  const qaPairs = queries.slice(0, 8).map((q) => ({
    question: transformToQuestion(q.query_text, location.business_name),
    answer: generateAnswerFromGroundTruth(q, location),
  }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qaPairs.map((qa) => ({
      '@type': 'Question',
      name: qa.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: qa.answer,
      },
    })),
  };

  return {
    schemaType: 'FAQPage',
    jsonLd,
    jsonLdString: JSON.stringify(jsonLd, null, 2),
    description: `FAQ schema with ${qaPairs.length} questions from your AI query library`,
    estimatedImpact: 'Est. +15% AI citation improvement — pages with FAQ schema are 3.2x more likely to appear in AI Overviews',
    missingReason: 'No FAQPage structured data found on your website',
  };
}
```

**Helper: `transformToQuestion()`** — Converts SOV query prompts into natural FAQ questions:
- "Best hookah bar near Alpharetta" → "What is the best hookah bar near Alpharetta?"
- "Charcoal N Chill hours" → "What are the hours for Charcoal N Chill?"
- If the query already ends with `?`, use as-is

**Helper: `generateAnswerFromGroundTruth()`** — Builds answers using ONLY verified data:
- For `discovery` queries: "{business_name} is a {categories[0]} located at {address}. We're open {hours summary}. We offer {amenities summary}."
- For `near_me` queries: "{business_name} is located at {full address}. Phone: {phone}. Visit us at {website_url}."
- For `comparison` queries: "{business_name} specializes in {categories}. Key features include {amenities list}."
- For `occasion` queries: "{business_name} is perfect for {occasion context}. We offer {relevant amenities}."

**⚠️ CRITICAL:** Answers must ONLY use data from `SchemaLocationInput`. No AI text, no generated claims, no marketing language. Every fact in the answer must be traceable to a DB column. This is what makes LocalVector's FAQ schema trustworthy — it's ground truth, not fabrication.

### 1C — Opening Hours Schema: `lib/schema-generator/hours-schema.ts`

```typescript
import type { HoursData, DayOfWeek, DayHours } from '@/lib/types/ground-truth';
import type { SchemaLocationInput, GeneratedSchema } from './types';

const DAY_MAP: Record<DayOfWeek, string> = {
  monday: 'https://schema.org/Monday',
  tuesday: 'https://schema.org/Tuesday',
  wednesday: 'https://schema.org/Wednesday',
  thursday: 'https://schema.org/Thursday',
  friday: 'https://schema.org/Friday',
  saturday: 'https://schema.org/Saturday',
  sunday: 'https://schema.org/Sunday',
};

/**
 * Generates OpeningHoursSpecification JSON-LD from location hours_data.
 *
 * @returns null if hours_data is null or empty (no hours to encode)
 */
export function generateOpeningHoursSchema(
  location: SchemaLocationInput,
): GeneratedSchema | null {
  if (!location.hours_data) return null;

  const specs: object[] = [];

  for (const [day, value] of Object.entries(location.hours_data) as [DayOfWeek, DayHours | 'closed'][]) {
    if (value === 'closed') continue; // Closed days are omitted per Schema.org convention
    if (!value || typeof value !== 'object') continue;

    specs.push({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: DAY_MAP[day],
      opens: value.open,    // "17:00"
      closes: value.close,  // "23:00" or "01:00"
    });
  }

  if (specs.length === 0) return null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: location.business_name,
    openingHoursSpecification: specs,
  };

  return {
    schemaType: 'OpeningHoursSpecification',
    jsonLd,
    jsonLdString: JSON.stringify(jsonLd, null, 2),
    description: `Opening hours for ${specs.length} days encoded in Schema.org format`,
    estimatedImpact: 'Est. +10% — Correct hours schema is the #1 defense against "permanently closed" hallucinations',
    missingReason: 'No OpeningHoursSpecification structured data found',
  };
}
```

### ⚠️ HOURS EDGE CASES (AI_RULES §10)

1. **`"closed"` string literal:** A day value of `"closed"` means explicitly closed — OMIT from OpeningHoursSpecification (Schema.org has no "closed" concept; absence means closed).
2. **Missing day key:** A missing key means "hours unknown" — also OMIT (don't guess).
3. **Cross-midnight closes:** `"close": "01:00"` with `"open": "17:00"` is valid — it means 5pm to 1am next day. Schema.org handles this correctly.
4. **`hours_data` is null:** The entire location has no hours set → return `null` → UI shows "Add hours in Settings to generate this schema."

### 1D — LocalBusiness Schema: `lib/schema-generator/local-business-schema.ts`

```typescript
import type { SchemaLocationInput, SchemaIntegrationInput, GeneratedSchema } from './types';

/**
 * Generates LocalBusiness JSON-LD with sameAs links to directory listings.
 *
 * sameAs links (Yelp, TripAdvisor, Instagram, etc.) are critical for
 * entity disambiguation — they tell AI models "this is the same business
 * as the one on Yelp with this URL."
 */
export function generateLocalBusinessSchema(
  location: SchemaLocationInput,
  integrations: SchemaIntegrationInput[],
): GeneratedSchema {
  // Collect sameAs links from integrations with listing_url
  const sameAsLinks = integrations
    .filter((i) => i.listing_url)
    .map((i) => i.listing_url!);

  // Add website_url if present (canonical link)
  if (location.website_url && !sameAsLinks.includes(location.website_url)) {
    sameAsLinks.unshift(location.website_url);
  }

  // Map categories to Schema.org @type
  const schemaType = inferSchemaOrgType(location.categories);

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: location.business_name,
  };

  // Address
  if (location.address_line1) {
    jsonLd.address = {
      '@type': 'PostalAddress',
      streetAddress: location.address_line1,
      ...(location.city && { addressLocality: location.city }),
      ...(location.state && { addressRegion: location.state }),
      ...(location.zip && { postalCode: location.zip }),
      addressCountry: location.country,
    };
  }

  // Geo coordinates (from Google Place ID — if available)
  // NOTE: Actual lat/lng would require a Places API call.
  // For V1, we include the Google Maps link instead.
  if (location.google_place_id) {
    jsonLd.hasMap = `https://www.google.com/maps/place/?q=place_id:${location.google_place_id}`;
  }

  if (location.phone) jsonLd.telephone = location.phone;
  if (location.website_url) jsonLd.url = location.website_url;
  if (sameAsLinks.length > 0) jsonLd.sameAs = sameAsLinks;

  // Amenity-derived properties
  if (location.amenities) {
    if (location.amenities.takes_reservations) {
      jsonLd.acceptsReservations = true;
    }
    if (location.amenities.serves_alcohol) {
      jsonLd.servesCuisine = location.categories?.[0] ?? 'American';
    }
  }

  return {
    schemaType: 'LocalBusiness',
    jsonLd,
    jsonLdString: JSON.stringify(jsonLd, null, 2),
    description: `${schemaType} entity with ${sameAsLinks.length} sameAs links for AI entity disambiguation`,
    estimatedImpact: 'Est. +10% — sameAs links help AI models verify your identity across platforms',
    missingReason: 'No complete LocalBusiness structured data with sameAs links found',
  };
}

/**
 * Maps LocalVector categories to the most specific Schema.org type.
 */
function inferSchemaOrgType(categories: string[] | null): string {
  if (!categories || categories.length === 0) return 'LocalBusiness';

  const lower = categories.map((c) => c.toLowerCase());

  if (lower.some((c) => c.includes('hookah') || c.includes('lounge') || c.includes('bar'))) {
    return 'BarOrPub';
  }
  if (lower.some((c) => c.includes('restaurant') || c.includes('fusion') || c.includes('indian'))) {
    return 'Restaurant';
  }
  if (lower.some((c) => c.includes('nightlife') || c.includes('club'))) {
    return 'NightClub';
  }
  return 'LocalBusiness';
}
```

### 1E — Index: `lib/schema-generator/index.ts`

```typescript
export { generateFAQPageSchema } from './faq-schema';
export { generateOpeningHoursSchema } from './hours-schema';
export { generateLocalBusinessSchema } from './local-business-schema';
export type { SchemaType, GeneratedSchema, SchemaLocationInput, SchemaQueryInput, SchemaIntegrationInput } from './types';
```

---

## Phase 2: Data Layer — `lib/data/schema-generator.ts`

Fetches ALL data needed for schema generation in one parallel batch.

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { HoursData, Amenities, Categories } from '@/lib/types/ground-truth';
import type { SchemaLocationInput, SchemaQueryInput, SchemaIntegrationInput } from '@/lib/schema-generator/types';

export interface SchemaGeneratorData {
  location: SchemaLocationInput | null;
  queries: SchemaQueryInput[];
  integrations: SchemaIntegrationInput[];
}

export async function fetchSchemaGeneratorData(
  orgId: string,
  supabase: SupabaseClient<Database>,
): Promise<SchemaGeneratorData> {
  const [locResult, queryResult, integResult] = await Promise.all([
    supabase
      .from('locations')
      .select('business_name, address_line1, city, state, zip, country, phone, website_url, hours_data, amenities, categories, google_place_id')
      .eq('org_id', orgId)
      .eq('is_primary', true)
      .maybeSingle(),

    supabase
      .from('target_queries')
      .select('query_text, query_category')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })
      .limit(20),

    supabase
      .from('location_integrations')
      .select('platform, listing_url')
      .eq('org_id', orgId),
  ]);

  const loc = locResult.data;

  return {
    location: loc ? {
      business_name: loc.business_name,
      address_line1: loc.address_line1,
      city: loc.city,
      state: loc.state,
      zip: loc.zip,
      country: (loc as Record<string, unknown>).country as string ?? 'US',
      phone: loc.phone,
      website_url: loc.website_url,
      hours_data: loc.hours_data as HoursData | null,
      amenities: loc.amenities as Amenities | null,
      categories: loc.categories as Categories | null,
      google_place_id: loc.google_place_id,
    } : null,
    queries: (queryResult.data ?? []).map((q) => ({
      query_text: q.query_text,
      query_category: q.query_category,
    })),
    integrations: (integResult.data ?? []).map((i) => ({
      platform: i.platform,
      listing_url: i.listing_url,
    })),
  };
}
```

### ⚠️ CRITICAL: JSONB column casting

The `locations` table returns JSONB columns as `Json` type. You MUST cast them to the ground-truth types:

```typescript
hours_data: loc.hours_data as HoursData | null,      // AI_RULES §2, §9, §38.4
amenities: loc.amenities as Amenities | null,
categories: loc.categories as Categories | null,
```

**NEVER** use `as any`. Cast through the specific ground-truth type (AI_RULES §38.4).

---

## Phase 3: Server Action — `app/dashboard/page-audits/schema-actions.ts`

```typescript
'use server';

import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchSchemaGeneratorData } from '@/lib/data/schema-generator';
import {
  generateFAQPageSchema,
  generateOpeningHoursSchema,
  generateLocalBusinessSchema,
  type GeneratedSchema,
} from '@/lib/schema-generator';

export async function generateSchemaFixes(): Promise<{
  success: boolean;
  schemas: GeneratedSchema[];
  error?: string;
}> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, schemas: [], error: 'Unauthorized' };

  const supabase = await createClient();
  const data = await fetchSchemaGeneratorData(ctx.orgId, supabase);

  if (!data.location) {
    return { success: false, schemas: [], error: 'No primary location found. Complete onboarding first.' };
  }

  const schemas: GeneratedSchema[] = [];

  // 1. FAQ Page schema
  const faqSchema = generateFAQPageSchema(data.location, data.queries);
  if (faqSchema) schemas.push(faqSchema);

  // 2. Opening Hours schema
  const hoursSchema = generateOpeningHoursSchema(data.location);
  if (hoursSchema) schemas.push(hoursSchema);

  // 3. LocalBusiness + sameAs schema
  const businessSchema = generateLocalBusinessSchema(data.location, data.integrations);
  schemas.push(businessSchema); // Always generates (even with minimal data)

  return { success: true, schemas };
}
```

**Why a Server Action, not a page load?** The schema generation is triggered by user click ("Generate Schema Fix"), not on every page load. This follows AI_RULES §5 (no heavy work on load) and lets us add a loading state to the button.

---

## Phase 4: UI Components

### 4A — Modify `PageAuditCard.tsx`

Add a "Generate Schema Fix" button to each audit card. This button triggers `generateSchemaFixes()` and opens the `SchemaFixPanel`.

The button should only appear when `schema_completeness_score < 80` OR `faq_schema_present === false` — i.e., when there's actually something to fix.

### 4B — `SchemaFixPanel.tsx` (Client Component)

A slide-out panel or expandable section below the audit card showing generated schemas.

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│  Schema Fixes Generated                           ✕ Close    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [FAQPage] [Opening Hours] [LocalBusiness]    ← Tab buttons  │
│                                                              │
│  ┌─ FAQPage Schema ─────────────────────────────────────┐   │
│  │                                                       │   │
│  │  📋 FAQ schema with 6 questions from your AI query    │   │
│  │     library                                           │   │
│  │                                                       │   │
│  │  Impact: +15% AI citation improvement                 │   │
│  │  Pages with FAQ schema are 3.2x more likely to        │   │
│  │  appear in AI Overviews                               │   │
│  │                                                       │   │
│  │  ┌─ JSON-LD Code ──────────────── [📋 Copy] ────┐   │   │
│  │  │ {                                              │   │   │
│  │  │   "@context": "https://schema.org",            │   │   │
│  │  │   "@type": "FAQPage",                          │   │   │
│  │  │   "mainEntity": [                              │   │   │
│  │  │     {                                          │   │   │
│  │  │       "@type": "Question",                     │   │   │
│  │  │       "name": "What is the best hookah..."     │   │   │
│  │  │     ...                                        │   │   │
│  │  │ }                                              │   │   │
│  │  └────────────────────────────────────────────────┘   │   │
│  │                                                       │   │
│  │  How to add: Paste this JSON-LD inside a              │   │
│  │  <script type="application/ld+json"> tag on your      │   │
│  │  homepage.                                            │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4C — `SchemaCodeBlock.tsx` (Client Component)

A pre-formatted JSON-LD display with syntax highlighting and copy button.

**Features:**
- `<pre><code>` block with `whitespace-pre-wrap` and `text-xs font-mono`
- Background: `bg-[#0d1117]` (dark code block background)
- Copy button using `navigator.clipboard.writeText()`
- "Copied!" feedback for 2 seconds (same pattern as AI Assistant `CopyButton`)
- Max-height with scroll for long schemas

---

## Phase 5: Tests (Write FIRST — AI_RULES §4)

### 5A — `src/__tests__/unit/schema-generator-faq.test.ts`

**Test cases (minimum 10):**

```
describe('generateFAQPageSchema')
  1.  ✅ returns FAQPage JSON-LD with @context and @type
  2.  ✅ generates Q&A pairs from target_queries
  3.  ✅ limits to max 8 FAQ items
  4.  ✅ returns null when fewer than 2 queries provided
  5.  ✅ transforms "Best X in Y" queries into question format
  6.  ✅ uses business_name in answers
  7.  ✅ includes hours summary in discovery-type answers
  8.  ✅ includes address in near_me-type answers
  9.  ✅ includes amenities in comparison-type answers
  10. ✅ does NOT include fabricated/marketing language — only ground truth

describe('transformToQuestion')
  11. ✅ adds "What is" prefix to declarative queries
  12. ✅ passes through queries already ending in "?"
  13. ✅ handles empty string gracefully
```

### 5B — `src/__tests__/unit/schema-generator-hours.test.ts`

**Test cases (minimum 8):**

```
describe('generateOpeningHoursSchema')
  1.  ✅ returns OpeningHoursSpecification for each open day
  2.  ✅ uses Schema.org day URLs (https://schema.org/Monday, etc.)
  3.  ✅ preserves open/close times from hours_data
  4.  ✅ omits days marked as "closed" (string literal)
  5.  ✅ omits days missing from hours_data (unknown ≠ closed)
  6.  ✅ returns null when hours_data is null
  7.  ✅ returns null when hours_data is empty object
  8.  ✅ handles cross-midnight close times ("01:00") correctly
  9.  ✅ wraps specs in Restaurant type with business name
```

### 5C — `src/__tests__/unit/schema-generator-local-business.test.ts`

**Test cases (minimum 8):**

```
describe('generateLocalBusinessSchema')
  1.  ✅ returns LocalBusiness JSON-LD with @context and @type
  2.  ✅ includes full PostalAddress when address data present
  3.  ✅ includes sameAs links from integrations with listing_url
  4.  ✅ filters integrations without listing_url from sameAs
  5.  ✅ includes website_url in sameAs array
  6.  ✅ sets acceptsReservations from amenities.takes_reservations
  7.  ✅ infers BarOrPub type from hookah/lounge categories
  8.  ✅ infers Restaurant type from restaurant categories
  9.  ✅ defaults to LocalBusiness when no categories match
  10. ✅ includes Google Maps link from google_place_id

describe('inferSchemaOrgType')
  11. ✅ returns "BarOrPub" for hookah-related categories
  12. ✅ returns "Restaurant" for restaurant categories
  13. ✅ returns "LocalBusiness" for null categories
```

### 5D — `src/__tests__/unit/schema-generator-data.test.ts`

**Test cases (minimum 5):**

```
describe('fetchSchemaGeneratorData')
  1.  ✅ returns location with all fields cast to ground-truth types
  2.  ✅ returns null location when no primary location exists
  3.  ✅ returns queries from target_queries table
  4.  ✅ returns integrations from location_integrations table
  5.  ✅ casts hours_data JSONB to HoursData type
  6.  ✅ casts amenities JSONB to Amenities type
```

**Mock Supabase pattern:** Same as Sprint 68-69 — track `.from()` calls, return golden tenant data, no `as any` (AI_RULES §38.2).

---

## Phase 6: Seed Data & Fixtures

### 6A — Add `location_integrations` Seed Rows

The golden tenant needs integration rows with `listing_url` so the LocalBusiness schema has `sameAs` links to test against. Check if these already exist in seed.sql. If not, add:

```sql
INSERT INTO public.location_integrations (org_id, location_id, platform, status, listing_url)
SELECT
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'yelp',
  'connected',
  'https://www.yelp.com/biz/charcoal-n-chill-alpharetta'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND l.slug = 'alpharetta'
LIMIT 1
ON CONFLICT (location_id, platform) DO NOTHING;
```

### 6B — Add More `target_queries` Seeds

The FAQ generator needs at least 2 queries. Check existing seed — there's currently only ONE (`"Best BBQ restaurant in Alpharetta GA"`). Add at least 3 more:

```sql
-- Additional target_queries for golden tenant (Sprint 70)
INSERT INTO public.target_queries (id, org_id, location_id, query_text, query_category)
SELECT
  'c6eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', org_id, l.id, 'best hookah lounge near Alpharetta', 'near_me'
FROM public.locations l WHERE l.slug = 'alpharetta' LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- ... add 2 more with different categories
```

### 6C — Add Fixture

In `src/__fixtures__/golden-tenant.ts`:

```typescript
export const MOCK_SCHEMA_LOCATION: SchemaLocationInput = {
  business_name: 'Charcoal N Chill',
  address_line1: '11950 Jones Bridge Road Ste 103',
  city: 'Alpharetta',
  state: 'GA',
  zip: '30005',
  country: 'US',
  phone: '(470) 546-4866',
  website_url: 'https://charcoalnchill.com',
  hours_data: {
    monday: { open: '17:00', close: '23:00' },
    tuesday: { open: '17:00', close: '23:00' },
    wednesday: { open: '17:00', close: '23:00' },
    thursday: { open: '17:00', close: '00:00' },
    friday: { open: '17:00', close: '01:00' },
    saturday: { open: '17:00', close: '01:00' },
    sunday: { open: '17:00', close: '23:00' },
  },
  amenities: {
    has_outdoor_seating: true,
    serves_alcohol: true,
    has_hookah: true,
    is_kid_friendly: false,
    takes_reservations: true,
    has_live_music: true,
    has_dj: true,
    has_private_rooms: true,
  },
  categories: ['Hookah Bar', 'Indian Restaurant', 'Fusion Restaurant', 'Lounge', 'Nightlife'],
  google_place_id: 'ChIJi8-1ywdO9YgR9s5j-y0_1lI',
};
```

---

## Phase 7: Documentation

### 7A — DEVLOG.md Entry

Standard format (AI_RULES §13.2). Include all new files, test counts, run commands.

### 7B — AI_RULES.md Update

Add §39 if a new pattern is discovered. Likely candidate:

> **§39 — Schema Generator Pure Functions Must Not Access Database.**
> All functions in `lib/schema-generator/` are pure — they take typed inputs and return JSON-LD objects. They MUST NOT import Supabase clients, call `fetch()`, or perform any I/O. Data fetching is the responsibility of `lib/data/schema-generator.ts`. This separation makes generators trivially testable and reusable.

---

## Definition of Done Checklist

- [ ] `lib/schema-generator/` directory with 5 files (types, faq, hours, local-business, index)
- [ ] All generators are **pure functions** — no DB, no fetch, no side effects
- [ ] FAQ generator uses real `target_queries` as questions + ground truth as answers
- [ ] Hours generator correctly handles `"closed"`, missing days, cross-midnight (AI_RULES §10)
- [ ] LocalBusiness generator includes `sameAs` from `location_integrations.listing_url`
- [ ] `inferSchemaOrgType()` maps categories to Restaurant/BarOrPub/NightClub/LocalBusiness
- [ ] Data layer (`lib/data/schema-generator.ts`) casts JSONB to ground-truth types (AI_RULES §9, §38.4)
- [ ] Server Action uses `getSafeAuthContext()` (AI_RULES §3, §11)
- [ ] "Generate Schema Fix" button on PageAuditCard (conditional on low scores)
- [ ] SchemaFixPanel with tabs for each schema type
- [ ] SchemaCodeBlock with copy-to-clipboard
- [ ] Seed data: 4+ target_queries, 1+ location_integrations with listing_url
- [ ] Fixture: `MOCK_SCHEMA_LOCATION` in golden-tenant
- [ ] 35+ test cases across 4 test files, all passing
- [ ] `npx vitest run` — ALL tests passing
- [ ] `npx tsc --noEmit` — zero type errors
- [ ] DEVLOG entry with verified test counts
- [ ] No `as any` on Supabase or ground-truth casts
- [ ] No API calls from generators (pure functions only)
- [ ] No marketing/fabricated language in FAQ answers — ground truth only

---

## What NOT to Do

1. **DO NOT** use AI (GPT/Perplexity) to generate FAQ answers. Answers come from ground truth data ONLY.
2. **DO NOT** duplicate `generateMenuJsonLd.ts`. The Menu+Restaurant schema already exists. This sprint adds FAQPage, OpeningHours, and enhanced LocalBusiness — complementary schemas.
3. **DO NOT** modify the existing page audit scoring logic (`lib/page-audit/auditor.ts`). Sprint 71 handles per-dimension score display.
4. **DO NOT** create a new database table. Schema generation is computed on-the-fly from existing data.
5. **DO NOT** create a new migration. All data sources already exist.
6. **DO NOT** auto-inject schema into customer websites. This sprint generates copy-to-clipboard code only.
7. **DO NOT** import Supabase clients in `lib/schema-generator/*.ts`. Pure functions only.
8. **DO NOT** install any new npm packages (no JSON-LD libraries, no schema validators).
9. **DO NOT** add `console.log` statements.
10. **DO NOT** generate schema for categories/amenities/hours that are null — return `null` gracefully.

---

## File Change Summary

| File | Action | What Changes |
|------|--------|-------------|
| `lib/schema-generator/types.ts` | CREATE | Shared input/output types |
| `lib/schema-generator/faq-schema.ts` | CREATE | FAQPage JSON-LD generator |
| `lib/schema-generator/hours-schema.ts` | CREATE | OpeningHoursSpecification generator |
| `lib/schema-generator/local-business-schema.ts` | CREATE | LocalBusiness + sameAs generator |
| `lib/schema-generator/index.ts` | CREATE | Re-exports |
| `lib/data/schema-generator.ts` | CREATE | Data fetching for schema generation |
| `app/dashboard/page-audits/schema-actions.ts` | CREATE | Server Action orchestrator |
| `app/dashboard/page-audits/_components/SchemaFixPanel.tsx` | CREATE | Tabbed schema display panel |
| `app/dashboard/page-audits/_components/SchemaCodeBlock.tsx` | CREATE | JSON-LD code block + copy |
| `app/dashboard/page-audits/_components/PageAuditCard.tsx` | MODIFY | Add "Generate Schema Fix" button |
| `supabase/seed.sql` | MODIFY | Add target_queries + location_integrations seeds |
| `src/__fixtures__/golden-tenant.ts` | MODIFY | Add MOCK_SCHEMA_LOCATION |
| `src/__tests__/unit/schema-generator-faq.test.ts` | CREATE | FAQ generator tests |
| `src/__tests__/unit/schema-generator-hours.test.ts` | CREATE | Hours generator tests |
| `src/__tests__/unit/schema-generator-local-business.test.ts` | CREATE | LocalBusiness generator tests |
| `src/__tests__/unit/schema-generator-data.test.ts` | CREATE | Data layer tests |
| `DEVLOG.md` | MODIFY | Sprint 70 entry |

**Total new files:** 13 (6 service + 3 UI + 4 test)
**Total modified files:** 4
**Estimated scope:** Large (new service module, but all pure functions = highly testable)
