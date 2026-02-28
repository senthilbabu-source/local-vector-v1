# Sprint E — Grow the Product: Medical/Dental Vertical Extension & Guided Tour Depth

> **Claude Code Prompt — Bulletproof Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`
> **Prerequisites:** Sprints A, B, C, and D must be fully merged and all their tests passing before starting Sprint E.

---

## 🎯 Objective

Sprint E opens the second acquisition channel and deepens onboarding for every user. Sprints A–D built a trustworthy, operator-visible, cost-controlled product for restaurant customers. Sprint E makes that same product available to a second, higher-willingness-to-pay vertical — and makes sure both restaurant and medical users understand what they're looking at when they arrive.

1. **M5 — Medical/Dental Vertical Extension** — LocalVector is deeply restaurant-specific today. "Menu," the Utensils icon, `servesCuisine` schema types, and "best hookah bar with live music" placeholders appear throughout the codebase. The report specifies this is a **data and configuration extension, not a new codebase** — the intelligence engines work identically across verticals. This sprint adds a Medical/Dental configuration layer: a new golden tenant fixture, industry-specific SOV query seeds, three schema.org types for healthcare, dynamic sidebar icon based on org industry, and a second onboarding wizard copy path. No DB migrations required.

2. **M2 — Guided Tour Depth** — The GuidedTour has 5 steps covering Dashboard, Alerts, Menu, Compete, and Content. Share of Voice (the most sophisticated feature), Revenue Impact (the monetization story), and Citations (gated — users who just upgraded don't know what to do) are not in the tour. Sprint B already shipped the "Restart Tour" button in Settings — that part of M2 is done. This sprint adds the three missing tour steps, verifies their nav target `data-testid` attributes exist, and adds per-page first-visit tooltips for the five most jargon-heavy pages (Entity Health, Agent Readiness, Cluster Map, AI Sentiment, Bot Activity).

**Why this sprint fifth:** After Sprint D's admin dashboard and credits system, you have unit economics under control and operational visibility. Sprint E's medical/dental vertical is the highest-leverage growth move available — medical practices pay $200–500/mo for practice management tools, hallucination risk is acute (wrong insurance or credentials = legal liability), and referral networks are tight. The GuidedTour work ensures that both restaurant and medical users onboard successfully once they're acquired.

**Estimated total implementation time:** 18–24 hours. M5 is the heavier component (12–15 hours) because it touches many files across the codebase. M2 is 6–8 hours — the per-page first-visit tooltips are the most time-consuming part.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

Before writing ANY code, read these files in order. Do not skip any.

```
Read docs/AI_RULES.md                                          — Rules 42–52 from Sprints A–D now in effect
Read CLAUDE.md                                                 — Sprint A–D implementation inventory
Read MEMORY.md                                                 — Architecture decisions through Sprint D
Read supabase/prod_schema.sql                                  — Find the 'industry' or 'business_type' column on orgs/locations
Read lib/supabase/database.types.ts                            — TypeScript DB types
Read src/__fixtures__/golden-tenant.ts                         — Full existing fixture (Sprint D added revenue config)

--- M5: Industry vertical foundation ---
Read lib/services/sov-seed.ts                                  — COMPLETE FILE. Current SOV seed query generation; understand function signature and output shape
Read lib/schema-generator/                                     — ls this directory; read every file; understand the schema type system
Read app/dashboard/onboarding/                                 — ls; find the wizard step files; read Step 4 specifically for the placeholder text
Read components/layout/Sidebar.tsx                             — Find the Magic Menus nav item with the Utensils icon; read how NAV_GROUPS are built
Read app/dashboard/magic-menus/page.tsx                        — How the Magic Menus page refers to 'Menu' vs 'Services'
Read app/dashboard/magic-menus/                                — All components; look for hardcoded 'menu', 'cuisine', 'food' strings
Read lib/schema-generator/types.ts   (or equivalent)          — Existing schema.org types: FoodEstablishment, Restaurant, LodgingBusiness, etc.
Read supabase/seed.sql                                         — Find all restaurant-specific strings ('hookah', 'Charcoal N Chill', 'best hookah bar')

--- M2: GuidedTour ---
Read app/dashboard/_components/GuidedTour.tsx                  — COMPLETE FILE. Step definitions, localStorage key, step targeting, tour library used
Read components/layout/Sidebar.tsx                             — Verify data-testid values on nav items: nav-share-of-voice, nav-revenue-impact, nav-citations
Read app/dashboard/share-of-voice/page.tsx                     — What does SOV page render? (For writing tour step content)
Read app/dashboard/revenue-impact/page.tsx                     — What does Revenue Impact render? (For tour step content)
Read app/dashboard/citations/page.tsx                          — What does Citations render? (For tour step content)
Read app/dashboard/entity-health/page.tsx                      — Understand entity health display (for first-visit tooltip)
Read app/dashboard/agent-readiness/page.tsx                    — Understand agent readiness display (for first-visit tooltip)
Read app/dashboard/cluster-map/page.tsx                        — Understand cluster map display (for first-visit tooltip)
Read app/dashboard/sentiment/page.tsx                          — AI Sentiment display (for first-visit tooltip)
Read app/dashboard/bot-activity/page.tsx                       — Bot Activity display (for first-visit tooltip)
Read app/dashboard/settings/_components/SettingsForm.tsx       — Sprint B: Restart Tour button. Confirm it's already there before Sprint E
```

**Specifically understand before writing code:**

- **Industry column location:** The M5 implementation depends entirely on where industry/business type is stored. Run:
  ```bash
  grep -n "industry\|business_type\|vertical\|category" supabase/prod_schema.sql | head -20
  grep -n "industry\|business_type" lib/supabase/database.types.ts | head -10
  ```
  The industry type is almost certainly on the `orgs` or `locations` table. Identify the exact column name and its type (text? enum? jsonb?) before writing any industry-conditional logic.

- **GuidedTour library:** GuidedTour.tsx uses some tour library — likely `react-joyride`, `intro.js`, or a custom implementation. Read the file to understand how steps are defined before adding new ones. The step format depends entirely on the library. Do not assume it's any specific library.

- **Sprint B already delivered "Restart Tour":** `app/dashboard/settings/_components/SettingsForm.tsx` has the "Restart Tour" button that clears `lv_tour_completed` from localStorage and reloads. Verify this is present before starting. If it's there, do NOT re-implement it. Document in the DEVLOG that M2's restart-tour component was completed in Sprint B.

- **Per-page first-visit tooltip state:** The first-visit tooltip for jargon-heavy pages should use localStorage (not sessionStorage) — it should only show once ever, not once per session. Key pattern: `lv_visited_pages` as a JSON array of visited page keys. Read existing localStorage key usage in the codebase to ensure naming consistency with `lv_tour_completed` from GuidedTour.

- **Utensils icon location in Sidebar:** Before changing the sidebar icon, understand exactly where it is. It might be:
  - A hardcoded `<Utensils />` in the NAV_GROUPS array for the Magic Menus item
  - A separate icon mapping outside the nav array
  - Part of a `NAV_ITEM` type that has an `icon` property
  After Sprint A, the sidebar uses `NAV_GROUPS` with section headers. Read the post-Sprint-A sidebar file structure carefully.

- **Schema generator extensibility:** Read `lib/schema-generator/` thoroughly. If it has a `switch (type)` or a type registry pattern, adding Medical/Dental types is a clean extension. If it's a monolithic function, you may need to refactor its organization slightly — but do not change its external interface or how it's called.

---

## 🏗️ Architecture — What to Build

---

### Fix M5: Medical/Dental Vertical Extension

**The core insight from the report:** The intelligence engines (Fear Engine, SOV Engine, Magic Engine, Greed Engine) are industry-agnostic at the computation level. What is industry-specific is: the *seed queries* used to monitor AI mentions, the *schema types* used to describe the business, the *icon and copy* used in the UI, and the *golden tenant fixture* used in tests. This sprint adds a configuration layer for the Medical/Dental vertical — the engines need no changes.

**Why Medical/Dental specifically:**
- Same local AI problem: "best pediatric dentist near me" has exactly the same hallucination risk as "best hookah bar near me"
- Higher fear: wrong insurance info, wrong credentials, wrong location for an emergency = genuine legal liability for the practice
- Higher willingness to pay: practice management tools command $200–500/mo; restaurant SaaS tops out at $59–99/mo
- Tight referral networks: one dentist in a dental co-op tells 10 others
- Schema.org well-defined: `Physician`, `MedicalClinic`, `MedicalSpecialty`, `Dentist` are all official schema.org types

#### Step 1: Define industry types — `lib/industries/industry-config.ts`

This is the single source of truth for all industry-specific configuration. It must be designed for extensibility — adding a third vertical (Legal, Real Estate, etc.) should require adding one entry to this file and nothing else.

```typescript
/**
 * Industry Configuration — Sprint E
 *
 * Single source of truth for industry-specific UI, schema, and copy.
 * Each IndustryConfig entry defines everything needed to adapt LocalVector
 * to a vertical without modifying the intelligence engines.
 *
 * To add a new vertical: add one entry to INDUSTRY_CONFIG and update
 * the golden tenant fixture and SOV seeds. No engine changes needed.
 */

import type { LucideIcon } from 'lucide-react';
import { Utensils, Stethoscope, Scale, Home, Briefcase } from 'lucide-react';

export type IndustryId = 'restaurant' | 'medical_dental' | 'legal' | 'real_estate';

export interface IndustryConfig {
  id: IndustryId;
  /** Display name for the industry (used in onboarding and admin) */
  label: string;
  /** Lucide icon component for the Magic Menus / Magic Services sidebar item */
  magicMenuIcon: LucideIcon;
  /** Sidebar nav label for the magic menu item ("Magic Menu" vs "Magic Services") */
  magicMenuLabel: string;
  /** What "menu/services" are called in this vertical */
  servicesNoun: string;           // 'Menu' | 'Services' | 'Practice Areas'
  /** What "cuisine/specialty" is called in this vertical */
  specialtyNoun: string;          // 'Cuisine' | 'Specialty' | 'Practice Type'
  /** Onboarding wizard Step 4 search example placeholder */
  onboardingSearchPlaceholder: string;
  /** Schema.org @type values this industry generates */
  schemaTypes: string[];
  /** Short description of why AI hallucinations matter for this vertical (used in onboarding) */
  hallucinationRiskDescription: string;
}

export const INDUSTRY_CONFIG: Record<IndustryId, IndustryConfig> = {

  restaurant: {
    id: 'restaurant',
    label: 'Restaurant / Food & Beverage',
    magicMenuIcon: Utensils,
    magicMenuLabel: 'Magic Menu',
    servicesNoun: 'Menu',
    specialtyNoun: 'Cuisine',
    onboardingSearchPlaceholder: 'best hookah bar with live music in Alpharetta',
    schemaTypes: ['Restaurant', 'FoodEstablishment', 'BarOrPub', 'NightClub'],
    hallucinationRiskDescription:
      'AI models showing wrong hours, wrong location, or wrong menu items cost you reservations and walk-ins.',
  },

  medical_dental: {
    id: 'medical_dental',
    label: 'Medical / Dental Practice',
    magicMenuIcon: Stethoscope,
    magicMenuLabel: 'Magic Services',
    servicesNoun: 'Services',
    specialtyNoun: 'Specialty',
    onboardingSearchPlaceholder: 'best pediatric dentist accepting new patients in Alpharetta',
    schemaTypes: ['Physician', 'Dentist', 'MedicalClinic', 'MedicalSpecialty'],
    hallucinationRiskDescription:
      'AI models showing wrong insurance networks, wrong credentials, or wrong specialties create legal risk and deter patients.',
  },

  // Placeholders for future verticals — not active in Sprint E:
  legal: {
    id: 'legal',
    label: 'Law Firm / Legal Practice',
    magicMenuIcon: Scale,
    magicMenuLabel: 'Magic Practice Areas',
    servicesNoun: 'Practice Areas',
    specialtyNoun: 'Specialty',
    onboardingSearchPlaceholder: 'best personal injury attorney in Alpharetta',
    schemaTypes: ['LegalService', 'Attorney'],
    hallucinationRiskDescription:
      'AI models citing wrong bar admissions, wrong specialties, or wrong contact info cost you qualified referrals.',
  },

  real_estate: {
    id: 'real_estate',
    label: 'Real Estate Agency',
    magicMenuIcon: Home,
    magicMenuLabel: 'Magic Listings',
    servicesNoun: 'Listings',
    specialtyNoun: 'Specialty',
    onboardingSearchPlaceholder: 'best real estate agent for luxury homes in Alpharetta',
    schemaTypes: ['RealEstateAgent', 'LocalBusiness'],
    hallucinationRiskDescription:
      'AI models showing outdated listings, wrong contact info, or wrong service areas cost you buyer and seller leads.',
  },
};

export function getIndustryConfig(industryId: string | null | undefined): IndustryConfig {
  if (!industryId) return INDUSTRY_CONFIG.restaurant; // Default fallback
  return INDUSTRY_CONFIG[industryId as IndustryId] ?? INDUSTRY_CONFIG.restaurant;
}
```

**Note:** Legal and Real Estate entries are placeholders — they are not activated in Sprint E. Their presence makes the data model future-proof without requiring any activation logic.

#### Step 2: SOV seed queries for Medical/Dental — extend `lib/services/sov-seed.ts`

Read the current `sov-seed.ts` file completely before modifying. Understand:
- How it generates seeds (template-based? LLM-generated? hardcoded templates?)
- What parameters it accepts (business name, city, category?)
- How the industry type would be passed to it

**Extend with medical/dental query templates:**

```typescript
// In sov-seed.ts — add medical/dental seed templates

const MEDICAL_DENTAL_SOV_TEMPLATES = [
  // Discovery queries — how patients find practices
  '{specialty} near me',
  'best {specialty} in {city}',
  '{specialty} accepting new patients {city}',
  'top rated {specialty} {city}',
  '{business_name} {city}',

  // Insurance-specific (high hallucination risk)
  '{specialty} that accept {insurance_type} {city}',
  'in-network {specialty} {city}',

  // Urgency queries
  'emergency {specialty} {city}',
  'same day {specialty} appointment {city}',

  // Attribute queries
  '{specialty} with {attribute} {city}',    // e.g., "dentist with sedation"
  'pediatric {specialty} {city}',
  '{specialty} for families {city}',

  // Review/quality signals
  'highly rated {specialty} {city}',
  '{specialty} {city} reviews',
];

// Template variables for medical/dental:
// {specialty} — derived from org's specialty field (e.g., "dentist", "pediatric dentist", "general practitioner")
// {city} — org's city
// {business_name} — org's name
// {insurance_type} — common insurances: "Delta Dental", "Cigna", "Aetna", "Blue Cross"
// {attribute} — specialty attributes: "sedation", "laser", "cosmetic"
```

**Generate seeds function extension:** Add an `industryId` parameter to the seed generation function. When `industryId === 'medical_dental'`, use `MEDICAL_DENTAL_SOV_TEMPLATES` instead of restaurant templates. Maintain backward compatibility — if `industryId` is not provided or is `'restaurant'`, use the existing restaurant templates unchanged.

**Critical:** Do not change the function signature in a breaking way. The existing callers (onboarding wizard, potentially the seed cron) must continue to work without modification. Add `industryId` as an optional parameter with a default of `'restaurant'`.

#### Step 3: Schema.org types for Medical/Dental — extend `lib/schema-generator/`

Read all files in `lib/schema-generator/` before modifying. Understand the existing type system — how `Restaurant`, `FoodEstablishment`, and other types are defined.

**Add `lib/schema-generator/medical-types.ts`:**

```typescript
/**
 * Schema.org types for Medical/Dental practices — Sprint E
 *
 * References:
 * - https://schema.org/Physician
 * - https://schema.org/Dentist
 * - https://schema.org/MedicalClinic
 * - https://schema.org/MedicalSpecialty
 *
 * These types are additive — they do not modify existing restaurant types.
 * Integrated via the SCHEMA_TYPE_REGISTRY in lib/schema-generator/registry.ts (or equivalent).
 */

export interface PhysicianSchema {
  '@context': 'https://schema.org';
  '@type': 'Physician';
  name: string;
  description?: string;
  url?: string;
  telephone?: string;
  address: {
    '@type': 'PostalAddress';
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: 'US';
  };
  geo?: {
    '@type': 'GeoCoordinates';
    latitude: number;
    longitude: number;
  };
  openingHoursSpecification?: OpeningHoursSpecification[];
  medicalSpecialty?: string[];         // e.g., ["Dentist", "PediatricDentist"]
  availableService?: MedicalService[];
  hasMap?: string;                     // Google Maps URL
  aggregateRating?: AggregateRating;
  priceRange?: string;                 // e.g., "$$"
  paymentAccepted?: string;            // e.g., "Cash, Credit Card, Insurance"
  currenciesAccepted?: string;
  image?: string;
}

export interface DentistSchema extends Omit<PhysicianSchema, '@type'> {
  '@type': 'Dentist';
  // Dentist has all Physician properties
}

export interface MedicalClinicSchema {
  '@context': 'https://schema.org';
  '@type': 'MedicalClinic';
  name: string;
  description?: string;
  url?: string;
  telephone?: string;
  address: PhysicianSchema['address'];
  geo?: PhysicianSchema['geo'];
  medicalSpecialty?: string[];
  availableService?: MedicalService[];
  openingHoursSpecification?: OpeningHoursSpecification[];
  hasMap?: string;
  aggregateRating?: AggregateRating;
  numberOfRooms?: number;             // Exam rooms — useful for clinic size signal
  employee?: { '@type': 'Person'; name: string; jobTitle: string }[];
}

interface MedicalService {
  '@type': 'MedicalProcedure' | 'MedicalTherapy' | 'DiagnosticProcedure';
  name: string;
  description?: string;
}

interface OpeningHoursSpecification {
  '@type': 'OpeningHoursSpecification';
  dayOfWeek: string | string[];
  opens: string;   // e.g., "09:00"
  closes: string;  // e.g., "17:00"
}

interface AggregateRating {
  '@type': 'AggregateRating';
  ratingValue: number;
  reviewCount: number;
  bestRating?: number;
  worstRating?: number;
}

/**
 * Generates a Physician or Dentist schema from org data.
 * Call this from the schema generator when org.industry === 'medical_dental'.
 */
export function generateMedicalSchema(org: {
  name: string;
  specialty?: string | null;
  phone?: string | null;
  website?: string | null;
  address: { street: string; city: string; state: string; zip: string };
  lat?: number | null;
  lng?: number | null;
  hours?: Record<string, { open: string; close: string }> | null;
  services?: string[];
  rating?: { value: number; count: number } | null;
}): PhysicianSchema | DentistSchema | MedicalClinicSchema {
  const isDentist = org.specialty?.toLowerCase().includes('dent') ?? false;

  const base = {
    '@context': 'https://schema.org' as const,
    '@type': isDentist ? ('Dentist' as const) : ('Physician' as const),
    name: org.name,
    ...(org.phone    && { telephone: org.phone }),
    ...(org.website  && { url: org.website }),
    address: {
      '@type': 'PostalAddress' as const,
      streetAddress:   org.address.street,
      addressLocality: org.address.city,
      addressRegion:   org.address.state,
      postalCode:      org.address.zip,
      addressCountry:  'US' as const,
    },
    ...(org.lat && org.lng && {
      geo: { '@type': 'GeoCoordinates' as const, latitude: org.lat, longitude: org.lng },
    }),
    ...(org.specialty && { medicalSpecialty: [org.specialty] }),
    ...(org.services?.length && {
      availableService: org.services.map((s) => ({
        '@type': 'MedicalProcedure' as const,
        name: s,
      })),
    }),
    ...(org.hours && {
      openingHoursSpecification: buildHoursSpecification(org.hours),
    }),
    ...(org.rating && {
      aggregateRating: {
        '@type': 'AggregateRating' as const,
        ratingValue: org.rating.value,
        reviewCount: org.rating.count,
        bestRating: 5,
        worstRating: 1,
      },
    }),
  };

  return base;
}

function buildHoursSpecification(
  hours: Record<string, { open: string; close: string }>,
): OpeningHoursSpecification[] {
  const DAY_MAP: Record<string, string> = {
    monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
    thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
  };
  return Object.entries(hours)
    .filter(([, h]) => h.open && h.close)
    .map(([day, h]) => ({
      '@type': 'OpeningHoursSpecification' as const,
      dayOfWeek: DAY_MAP[day.toLowerCase()] ?? day,
      opens: h.open,
      closes: h.close,
    }));
}
```

**Register medical types:** Find how existing schema types are registered in `lib/schema-generator/`. Add medical types to the same registry. The `generateSchema()` (or equivalent top-level function) should call `generateMedicalSchema()` when `org.industry === 'medical_dental'`.

#### Step 4: Dynamic sidebar icon — `components/layout/Sidebar.tsx`

Read the current Sidebar.tsx (post Sprint A: uses NAV_GROUPS). Find the Magic Menus nav item. It currently has a hardcoded `Utensils` icon and "Magic Menu" label.

**Make the icon and label dynamic based on org industry:**

The Sidebar is a Server Component (or receives props from a Server Component). The org's industry type is available server-side. Pass it down or read it directly.

**Find the Magic Menus nav item in NAV_GROUPS:**
```typescript
// CURRENT (somewhere in Sidebar.tsx):
{ href: '/dashboard/magic-menus', label: 'Magic Menu', icon: Utensils, ... }

// REPLACE WITH:
{
  href: '/dashboard/magic-menus',
  label: getIndustryConfig(org?.industry).magicMenuLabel,   // 'Magic Menu' or 'Magic Services'
  icon: getIndustryConfig(org?.industry).magicMenuIcon,     // Utensils or Stethoscope
  ...
}
```

**Pass `org.industry` into Sidebar:** If the Sidebar doesn't already receive the org, check how it currently gets data. The dashboard layout likely fetches the org and passes it as a prop. Add `industry: string | null` to whatever prop type Sidebar receives — or if `org` is already passed, just access `org.industry`.

**Default behavior:** `getIndustryConfig(null)` returns the restaurant config — so existing restaurant customers see exactly what they saw before.

#### Step 5: Onboarding wizard copy — industry-aware placeholder

Read the onboarding wizard Step 4 file. Find the hardcoded placeholder: `"best hookah bar with live music"` (or wherever it appears).

Replace with industry-aware copy:

```typescript
// In onboarding Step 4:
// Current:
placeholder="best hookah bar with live music in Alpharetta"

// Replace with:
placeholder={getIndustryConfig(selectedIndustry).onboardingSearchPlaceholder}
```

The industry selection happens in an earlier onboarding step (Step 1 or Step 2 typically has a "What type of business?" selector). Read the wizard flow to understand how `selectedIndustry` is passed through steps.

**If there is no industry selector in the onboarding wizard yet:** This is the industry selection moment. Add a simple selector to Step 1 or a new Step 0:

```tsx
// Simple industry selector (only if none exists):
<div className="space-y-3" data-testid="industry-selector">
  <p className="text-sm font-medium text-foreground">What type of business are you?</p>
  {(['restaurant', 'medical_dental'] as const).map((id) => {
    const config = INDUSTRY_CONFIG[id];
    const Icon = config.magicMenuIcon;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setSelectedIndustry(id)}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
          selectedIndustry === id
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-border bg-background hover:bg-muted'
        )}
        data-testid={`industry-option-${id}`}
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="text-sm font-medium">{config.label}</span>
      </button>
    );
  })}
</div>
```

**Persist the selection:** The chosen industry must be saved to the `orgs.industry` column when the onboarding wizard completes. If the wizard already has a completion action, add `industry: selectedIndustry` to the payload.

**If `orgs.industry` column doesn't exist yet:** Create a migration:
```sql
-- Sprint E: Add industry column to orgs
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS industry text DEFAULT 'restaurant';

COMMENT ON COLUMN public.orgs.industry IS
  'Industry vertical. Values: restaurant | medical_dental. Sprint E.';
```
Only run this migration if the column doesn't already exist. Verify against `prod_schema.sql` first.

#### Step 6: Magic Menus page copy — industry-aware labels

Read `app/dashboard/magic-menus/page.tsx` and its components. Find all occurrences of "Menu," "menu," "cuisine," and similar restaurant-specific strings.

Pass `industryConfig` (from `getIndustryConfig(org.industry)`) into the page. Replace hardcoded strings:

| Hardcoded | Dynamic replacement |
|-----------|---------------------|
| "Menu" (page title/heading) | `industryConfig.servicesNoun` |
| "Add menu item" | `"Add ${industryConfig.servicesNoun} item"` |
| "Cuisine type" | `industryConfig.specialtyNoun` |
| "servesCuisine" schema key | Only in schema output — use `generateMedicalSchema()` for medical orgs |

**Scope rule:** Only update strings that are visible to the user in the Magic Menus page UI. Do not rename DB columns, API route paths, or internal type names — those are implementation details. The URL `/dashboard/magic-menus` stays as-is; only the displayed copy changes.

#### Step 7: Add the Medical/Dental golden tenant fixture

Add to `src/__fixtures__/golden-tenant.ts`:

```typescript
// ─── Medical/Dental Golden Tenant ─────────────────────────────────────────────
// Alpharetta Family Dental — a fictional but realistic dental practice
// Used for M5 vertical extension tests

export const ALPHARETTA_FAMILY_DENTAL = {
  org: {
    id: 'fixture-org-dental-001',
    name: 'Alpharetta Family Dental',
    industry: 'medical_dental' as const,
    plan: 'growth' as const,
    created_at: '2026-01-15T00:00:00Z',
  },
  location: {
    name: 'Alpharetta Family Dental',
    specialty: 'General and Cosmetic Dentistry',
    phone: '+16785550199',
    website: 'https://alpharettafamilydental.example.com',
    address: {
      street: '1234 Windward Pkwy',
      city: 'Alpharetta',
      state: 'GA',
      zip: '30005',
    },
    lat: 34.0754,
    lng: -84.2941,
    hours: {
      monday:    { open: '08:00', close: '17:00' },
      tuesday:   { open: '08:00', close: '17:00' },
      wednesday: { open: '08:00', close: '17:00' },
      thursday:  { open: '08:00', close: '17:00' },
      friday:    { open: '08:00', close: '14:00' },
      saturday:  { open: '09:00', close: '13:00' },
      sunday:    { open: null,    close: null     },
    },
    services: [
      'Preventive Cleanings',
      'Teeth Whitening',
      'Porcelain Veneers',
      'Dental Implants',
      'Invisalign',
      'Emergency Dental Care',
    ],
    rating: { value: 4.8, count: 214 },
  },
  expectedSchema: {
    '@context': 'https://schema.org',
    '@type': 'Dentist',
    name: 'Alpharetta Family Dental',
    medicalSpecialty: ['General and Cosmetic Dentistry'],
    // ... full expected schema output used in schema generator tests
  },
  expectedSovSeeds: [
    'dentist near me',
    'best dentist in Alpharetta',
    'dentist accepting new patients Alpharetta',
    // Verify these match what generateSovSeeds('medical_dental', { city: 'Alpharetta', specialty: 'dentist' }) actually returns
  ],
} as const;
```

---

### Fix M2: Guided Tour Depth

**State at Sprint E start:**
- Tour has 5 steps: `nav-dashboard`, `nav-alerts`, `nav-menu`, `nav-compete`, `nav-content`
- "Restart Tour" button in Settings: ✅ shipped in Sprint B — **do not re-implement**
- Missing steps: Share of Voice, Revenue Impact, Citations
- Missing: per-page first-visit tooltips for jargon-heavy pages

#### Step 1: Verify nav `data-testid` attributes exist

Before writing new tour steps, confirm these testid values exist on sidebar nav items:

```bash
grep -n "nav-share-of-voice\|nav-revenue-impact\|nav-citations\|nav-entity-health\|nav-agent-readiness" components/layout/Sidebar.tsx
```

If any are missing, add them to the corresponding nav items in `Sidebar.tsx`:
```tsx
// Example — add data-testid to the Share of Voice nav item:
<Link href="/dashboard/share-of-voice" data-testid="nav-share-of-voice" ...>
  Share of Voice
</Link>
```

Only add the `data-testid` attributes that are missing. Do not modify the structure of nav items that already have them.

#### Step 2: Add 3 new steps to `GuidedTour.tsx`

Read the existing tour step definitions completely. Match the exact structure used by the tour library. Add three new steps after the existing 5, in this order: Share of Voice → Citations → Revenue Impact.

```typescript
// New steps to add — adjust the format to match the existing step definitions exactly:

const NEW_TOUR_STEPS = [
  {
    // Step 6: Share of Voice
    target: '[data-testid="nav-share-of-voice"]',   // OR the selector format the library uses
    content: {
      title: 'Share of Voice',
      body:
        'Track how often AI models mention your business vs. your competitors when customers search for businesses like yours. This is the metric traditional SEO tools can\'t see.',
    },
    placement: 'right',  // or however the library specifies placement
    // ... match all other fields from existing steps
  },
  {
    // Step 7: Citations
    target: '[data-testid="nav-citations"]',
    content: {
      title: 'Citations',
      body:
        'Citations are the web mentions that teach AI models about your business. More high-quality citations = higher AI visibility score. This page shows which citation sources are helping and which are missing.',
    },
    placement: 'right',
  },
  {
    // Step 8: Revenue Impact
    target: '[data-testid="nav-revenue-impact"]',
    content: {
      title: 'Revenue Impact',
      body:
        'See the estimated monthly revenue you\'re losing because AI models are giving customers wrong information. Enter your average check size and covers per night — LocalVector calculates the rest.',
    },
    placement: 'right',
  },
];
```

**Placement note:** If the tour navigates to pages as part of the step (some tour libraries do this), confirm whether clicking a nav item during the tour triggers navigation. If it does, the step may need to navigate first, then highlight. Read the existing step logic for this.

#### Step 3: Create `components/ui/FirstVisitTooltip.tsx`

A component that shows a dismissible informational banner the first time a user visits a specific page. Uses localStorage to track visited pages — shows exactly once, never again.

```tsx
'use client';

/**
 * FirstVisitTooltip — shows a one-time informational banner on the first visit to a page.
 * Uses localStorage key 'lv_visited_pages' (JSON array of page keys).
 * Once dismissed, never shown again on that device.
 *
 * Usage:
 *   <FirstVisitTooltip pageKey="entity-health" title="Entity Health" content="..." />
 */

import { useState, useEffect } from 'react';
import { X, Info } from 'lucide-react';

interface FirstVisitTooltipProps {
  /** Unique key for this page — added to lv_visited_pages on dismiss */
  pageKey: string;
  /** Bold heading of the tooltip */
  title: string;
  /** Explanation of what this page does */
  content: string;
  /** Optional "Learn more" link */
  learnMoreHref?: string;
}

const STORAGE_KEY = 'lv_visited_pages';

function hasVisited(pageKey: string): boolean {
  if (typeof window === 'undefined') return true;  // SSR: don't show
  try {
    const visited: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return visited.includes(pageKey);
  } catch {
    return false;
  }
}

function markVisited(pageKey: string): void {
  try {
    const visited: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!visited.includes(pageKey)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...visited, pageKey]));
    }
  } catch {
    // Non-critical — ignore storage errors
  }
}

export function FirstVisitTooltip({ pageKey, title, content, learnMoreHref }: FirstVisitTooltipProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only run client-side, after hydration
    setVisible(!hasVisited(pageKey));
  }, [pageKey]);

  if (!visible) return null;

  function handleDismiss() {
    markVisited(pageKey);
    setVisible(false);
  }

  return (
    <div
      className="mb-6 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3"
      role="status"
      aria-live="polite"
      data-testid={`first-visit-tooltip-${pageKey}`}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
      <div className="flex-1 text-sm text-blue-800">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-blue-700">{content}</p>
        {learnMoreHref && (
          <a
            href={learnMoreHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-xs text-blue-600 underline hover:text-blue-800"
          >
            Learn more →
          </a>
        )}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="ml-2 mt-0.5 rounded text-blue-500 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
        aria-label="Dismiss this tip"
        data-testid={`first-visit-dismiss-${pageKey}`}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
```

#### Step 4: Wire `FirstVisitTooltip` into 5 jargon-heavy pages

Add `<FirstVisitTooltip />` at the top of the page content (inside the main layout, below the page heading) for each of these pages:

| Page | Route | `pageKey` | `title` | `content` |
|------|-------|-----------|---------|-----------|
| Entity Health | `/dashboard/entity-health` | `entity-health` | `What is Entity Health?` | `AI models build a "knowledge graph" of named entities. Your Entity Health score measures how well-structured and consistent your business's entity data is across all AI knowledge sources. Higher entity health = more accurate AI mentions.` |
| Agent Readiness | `/dashboard/agent-readiness` | `agent-readiness` | `What is Agent Readiness?` | `As AI "agents" book reservations and answer customer questions autonomously, your business needs to be structured in a way agents can understand and act on. Agent Readiness measures how ready your data is for the agentic AI era.` |
| Cluster Map | `/dashboard/cluster-map` | `cluster-map` | `What is the Cluster Map?` | `AI models group businesses into semantic "clusters" when answering search queries. This map shows which cluster your business is in, who else is in your cluster, and how to move into higher-visibility clusters.` |
| AI Sentiment | `/dashboard/sentiment` | `ai-sentiment` | `What is AI Sentiment?` | `Beyond whether AI mentions you, this page tracks how AI describes you. Positive sentiment ("popular," "highly rated") boosts conversion. Negative or neutral sentiment can be corrected by updating your citation sources and business description.` |
| Bot Activity | `/dashboard/bot-activity` | `bot-activity` | `What is Bot Activity?` | `AI crawlers visit your website to learn about your business. This page tracks which AI bots (GPTBot, ClaudeBot, PerplexityBot) have crawled your site and when — giving you visibility into how AI models are gathering data about you.` |

**Implementation pattern for each page:**

```tsx
// In app/dashboard/entity-health/page.tsx (server component):
// Add at the top of the returned JSX, before existing page content:
import { FirstVisitTooltip } from '@/components/ui/FirstVisitTooltip';

// In the page JSX:
<FirstVisitTooltip
  pageKey="entity-health"
  title="What is Entity Health?"
  content="AI models build a 'knowledge graph' of named entities..."
/>
```

Since `FirstVisitTooltip` is a `'use client'` component, importing it into a Server Component page will create a client boundary at the tooltip level only — the rest of the page remains a Server Component. This is correct Next.js architecture.

---

## 🧪 Testing

### Test File 1: `src/__tests__/unit/industry-config.test.ts`

```
describe('INDUSTRY_CONFIG')
  1.  getIndustryConfig('restaurant') returns the restaurant config
  2.  getIndustryConfig('medical_dental') returns the medical/dental config
  3.  getIndustryConfig(null) returns the restaurant config (default fallback)
  4.  getIndustryConfig(undefined) returns the restaurant config (default fallback)
  5.  getIndustryConfig('unknown_industry') returns the restaurant config (unknown fallback)
  6.  restaurant config has magicMenuLabel === 'Magic Menu'
  7.  medical_dental config has magicMenuLabel === 'Magic Services'
  8.  medical_dental config has magicMenuIcon !== Utensils
  9.  all INDUSTRY_CONFIG entries have non-empty onboardingSearchPlaceholder
  10. all INDUSTRY_CONFIG entries have at least one schemaType
  11. all INDUSTRY_CONFIG entries have non-empty hallucinationRiskDescription
  12. restaurant config schemaTypes includes 'Restaurant'
  13. medical_dental config schemaTypes includes 'Physician' and 'Dentist'
```

**Target: 13 tests**

### Test File 2: `src/__tests__/unit/medical-schema-generator.test.ts`

```
describe('generateMedicalSchema()')
  1.  returns '@type': 'Dentist' when specialty contains 'dent'
  2.  returns '@type': 'Physician' when specialty does not contain 'dent'
  3.  includes name from org input
  4.  includes telephone when phone is provided
  5.  omits telephone when phone is null
  6.  includes address with all required PostalAddress fields
  7.  includes geo when lat and lng are provided
  8.  omits geo when lat or lng is null
  9.  includes medicalSpecialty array when specialty is provided
  10. maps services array to availableService with '@type': 'MedicalProcedure'
  11. includes openingHoursSpecification from hours object
  12. omits Sunday when sunday hours are null
  13. includes aggregateRating when rating is provided
  14. omits aggregateRating when rating is null
  15. buildHoursSpecification maps day names correctly (monday → 'Monday')
  16. output validates against the PhysicianSchema or DentistSchema TypeScript type
```

**Target: 16 tests**

### Test File 3: `src/__tests__/unit/sov-seed-medical.test.ts`

```
describe('Medical/Dental SOV seed generation')
  1.  generateSovSeeds('medical_dental', opts) returns an array
  2.  result is non-empty (at least 5 seeds)
  3.  seeds are unique (no duplicates)
  4.  all seeds are non-empty strings
  5.  at least one seed contains the city name
  6.  at least one seed contains a dental/medical term ('dentist', 'doctor', or the provided specialty)
  7.  seeds do NOT contain restaurant-specific terms ('menu', 'cuisine', 'restaurant', 'food')
  8.  generateSovSeeds('restaurant', opts) still returns restaurant-appropriate seeds (no regression)
  9.  generateSovSeeds(undefined, opts) returns restaurant seeds (backward compatibility)
  10. generateSovSeeds('medical_dental', opts) with specialty 'orthodontist' includes specialty in at least one seed
```

**Target: 10 tests**

### Test File 4: `src/__tests__/unit/first-visit-tooltip.test.tsx`

```
describe('FirstVisitTooltip')
  1.  does NOT render on first mount when lv_visited_pages already contains the pageKey
  2.  DOES render on first mount when lv_visited_pages is empty
  3.  DOES render when pageKey is not in the visited array
  4.  renders with correct data-testid="first-visit-tooltip-{pageKey}"
  5.  dismiss button has data-testid="first-visit-dismiss-{pageKey}"
  6.  clicking dismiss adds pageKey to lv_visited_pages in localStorage
  7.  clicking dismiss hides the tooltip (visible === false)
  8.  after dismiss, a second render of the component does NOT show it
  9.  renders title and content text correctly
  10. renders "Learn more →" link when learnMoreHref is provided
  11. does NOT render "Learn more →" when learnMoreHref is omitted
  12. hasVisited() returns false when localStorage key doesn't exist
  13. hasVisited() returns false when key exists but array doesn't include pageKey
  14. hasVisited() returns true when array includes pageKey
  15. hasVisited() returns false (doesn't throw) when localStorage contains invalid JSON
```

**Target: 15 tests**

### Test File 5: `src/__tests__/unit/guided-tour-steps.test.ts`

```
describe('GuidedTour step count and targets')
  1.  tour has at least 8 steps (5 original + 3 new)
  2.  step 6 targets the Share of Voice nav element
  3.  step 7 targets the Citations nav element
  4.  step 8 targets the Revenue Impact nav element
  5.  no step targets an element that doesn't have a corresponding data-testid in Sidebar.tsx
  6.  all steps have non-empty content/title
  7.  step targets do not duplicate existing step 1–5 targets
  8.  the tour steps array is exported (or accessible) for testing — not buried in component state
```

**Target: 8 tests**

### E2E Test File: `src/__tests__/e2e/sprint-e-smoke.spec.ts`

```
describe('Sprint E — E2E Smoke Tests')

  Industry config:
  1.  restaurant org: Sidebar shows "Magic Menu" label with Utensils-style icon
  2.  medical org: Sidebar shows "Magic Services" label (mock org.industry='medical_dental')
  3.  onboarding wizard: industry selector shows Restaurant and Medical/Dental options
  4.  selecting Medical/Dental: Step 4 placeholder changes to dental-appropriate copy

  Schema generation:
  5.  magic-menus page for medical org: page heading uses "Services" not "Menu"

  GuidedTour:
  6.  nav-share-of-voice data-testid exists on the sidebar Share of Voice nav item
  7.  nav-citations data-testid exists on the sidebar Citations nav item
  8.  nav-revenue-impact data-testid exists on the sidebar Revenue Impact nav item
  9.  tour shows at least 8 steps when triggered (count the step indicators)

  FirstVisitTooltip:
  10. first-visit-tooltip-entity-health is visible on first visit to entity-health page
  11. first-visit-tooltip-entity-health is NOT visible on second visit (localStorage persists)
  12. first-visit-tooltip-agent-readiness is visible on first visit to agent-readiness page
  13. clicking dismiss on entity-health tooltip hides it
  14. first-visit-tooltip-cluster-map is visible on first visit to cluster-map page
  15. first-visit-tooltip-ai-sentiment is visible on first visit to sentiment page
  16. first-visit-tooltip-bot-activity is visible on first visit to bot-activity page
```

**Total Playwright: 16 tests**

### Run commands:

```bash
npx vitest run src/__tests__/unit/industry-config.test.ts
npx vitest run src/__tests__/unit/medical-schema-generator.test.ts
npx vitest run src/__tests__/unit/sov-seed-medical.test.ts
npx vitest run src/__tests__/unit/first-visit-tooltip.test.tsx
npx vitest run src/__tests__/unit/guided-tour-steps.test.ts
npx vitest run                                                       # All units — 0 regressions
npx playwright test src/__tests__/e2e/sprint-e-smoke.spec.ts
npx tsc --noEmit                                                     # 0 new type errors
```

---

## 📂 Files to Create / Modify

| # | File | Action | Fix |
|---|------|--------|-----|
| 1 | `lib/industries/industry-config.ts` | **CREATE** | M5 — Industry config single source of truth |
| 2 | `lib/services/sov-seed.ts` | **MODIFY** | M5 — Add medical/dental seed templates + industryId param |
| 3 | `lib/schema-generator/medical-types.ts` | **CREATE** | M5 — Physician, Dentist, MedicalClinic schema types |
| 4 | `lib/schema-generator/index.ts` (or equivalent) | **MODIFY** | M5 — Register medical types in schema generator |
| 5 | `components/layout/Sidebar.tsx` | **MODIFY** | M5 + M2 — Dynamic icon/label; add missing nav data-testid attrs |
| 6 | `app/dashboard/magic-menus/page.tsx` | **MODIFY** | M5 — Industry-aware "Menu" → "Services" copy |
| 7 | `app/dashboard/magic-menus/_components/` (all) | **MODIFY** | M5 — Industry-aware strings |
| 8 | `app/dashboard/onboarding/` (Step 4 or equivalent) | **MODIFY** | M5 — Industry-aware placeholder; industry selector if missing |
| 9 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | M5 — Add ALPHARETTA_FAMILY_DENTAL fixture |
| 10 | `supabase/migrations/[ts]_orgs_industry.sql` | **CREATE IF NEEDED** | M5 — `orgs.industry` column |
| 11 | `supabase/prod_schema.sql` | **MODIFY IF NEEDED** | M5 — New industry column |
| 12 | `lib/supabase/database.types.ts` | **MODIFY IF NEEDED** | M5 — New column type |
| 13 | `app/dashboard/_components/GuidedTour.tsx` | **MODIFY** | M2 — Add 3 new steps (SOV, Citations, Revenue Impact) |
| 14 | `components/ui/FirstVisitTooltip.tsx` | **CREATE** | M2 — One-time dismissible page tooltip |
| 15 | `app/dashboard/entity-health/page.tsx` | **MODIFY** | M2 — Add FirstVisitTooltip |
| 16 | `app/dashboard/agent-readiness/page.tsx` | **MODIFY** | M2 — Add FirstVisitTooltip |
| 17 | `app/dashboard/cluster-map/page.tsx` | **MODIFY** | M2 — Add FirstVisitTooltip |
| 18 | `app/dashboard/sentiment/page.tsx` | **MODIFY** | M2 — Add FirstVisitTooltip |
| 19 | `app/dashboard/bot-activity/page.tsx` | **MODIFY** | M2 — Add FirstVisitTooltip |
| 20 | `src/__tests__/unit/industry-config.test.ts` | **CREATE** | Tests — 13 |
| 21 | `src/__tests__/unit/medical-schema-generator.test.ts` | **CREATE** | Tests — 16 |
| 22 | `src/__tests__/unit/sov-seed-medical.test.ts` | **CREATE** | Tests — 10 |
| 23 | `src/__tests__/unit/first-visit-tooltip.test.tsx` | **CREATE** | Tests — 15 |
| 24 | `src/__tests__/unit/guided-tour-steps.test.ts` | **CREATE** | Tests — 8 |
| 25 | `src/__tests__/e2e/sprint-e-smoke.spec.ts` | **CREATE** | E2E — 16 |

---

## 🧠 Edge Cases to Handle

1. **`orgs.industry` column may already exist.** Some earlier sprint or migration might have added it. Check `prod_schema.sql` with `grep -n "industry" supabase/prod_schema.sql` before writing the migration. If it exists, skip the migration and document in the DEVLOG.

2. **Existing restaurant orgs will have `industry = null` after the migration.** `getIndustryConfig(null)` returns the restaurant config — so existing orgs default to restaurant behavior with no action required. Do NOT run a backfill migration that sets all existing orgs to `'restaurant'` — the default handles this implicitly, and a migration touching all org rows carries unnecessary risk.

3. **Sidebar is (likely) a Server Component.** Reading `org.industry` from the DB and passing it into the NAV_GROUPS array is straightforward in a Server Component. If parts of the Sidebar are `'use client'`, you may need to pass `industryConfig` as a prop from the server parent. Do not fetch the org twice — reuse what's already fetched in the layout.

4. **`getIndustryConfig` is imported in the Sidebar which bundles client-side.** The `INDUSTRY_CONFIG` object imports Lucide icons. Icon components are client-safe, but confirm that the icons (`Stethoscope`, `Scale`, `Home`) are included in the installed version of `lucide-react`. Run `cat node_modules/lucide-react/dist/cjs/index.js | grep -c "Stethoscope"` to verify. If an icon doesn't exist in the installed version, pick a different one from the existing icon set.

5. **SOV seed backward compatibility.** The existing `sov-seed.ts` is called from the onboarding wizard, possibly from the SOV cron, and from tests. Adding `industryId` as an **optional parameter with a default** (`industryId: IndustryId = 'restaurant'`) ensures all existing callers continue to work without modification. Verify every call site after the change with `grep -rn "generateSovSeeds\|seedSovQueries\|createSovSeed" app/ lib/` — whatever the function is actually named.

6. **Tour library step format.** The three new tour steps must exactly match the format of the existing five. If the library uses `{ target, content: { title, body } }`, use that format. If it uses `{ selector, title, content }`, use that. If it uses a React component render prop, use that. Do not assume any specific format — read the existing steps.

7. **Tour navigation during steps.** Some tour libraries automatically click the target element after highlighting it. If clicking `[data-testid="nav-share-of-voice"]` in the tour navigates to the SOV page and the tour expects to continue highlighting elements on the dashboard, the tour will break. Read how existing steps handle navigation between pages — the new steps must follow the same pattern.

8. **`FirstVisitTooltip` hydration flash.** The component initializes `visible` to `false` on the server (SSR), then sets it to `true` on the client after `useEffect` runs — only if the page hasn't been visited. This means there's a brief flash where the tooltip is invisible before appearing. This is intentional and correct — it prevents a server/client hydration mismatch. Do not try to initialize `visible` to `true` on the server.

9. **localStorage not available in test environment.** Vitest runs in jsdom, which has localStorage. But mock it explicitly in tests to control state: `vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(...)`. Do not rely on test isolation cleaning localStorage between tests — it may not.

10. **Magic Menus page on a medical org but admin views a restaurant org.** The admin dashboard (Sprint D) can view any org's data. If the admin is a restaurant owner viewing a medical org's profile, the Magic Menus label should reflect the medical org's config, not the admin's own config. Pass the viewed org's `industry` — not the currently authenticated user's org.

11. **First-visit tooltips and the GuidedTour.** Both are first-visit experiences. They must not conflict. The GuidedTour runs on the dashboard (tour triggered by localStorage `lv_tour_completed` absence). First-visit tooltips run on specific inner pages. If a user is in the middle of the GuidedTour and clicks through to the Entity Health page, both the tour highlight and the first-visit tooltip may appear simultaneously. This is acceptable — they cover different information. Do not add logic to suppress one when the other is active.

12. **ALPHARETTA_FAMILY_DENTAL fixture Sunday hours.** The Sunday entry has `{ open: null, close: null }`. The `buildHoursSpecification` function must filter out null hours. The test for "omits Sunday when sunday hours are null" must verify this explicitly — a schema with a Sunday entry showing `"opens": null` would be invalid schema.org.

---

## 🚫 What NOT to Do

1. **DO NOT change the URL paths** for any dashboard page. `/dashboard/magic-menus` stays `/dashboard/magic-menus` for restaurant AND medical orgs. Only the displayed copy changes, not the routes.
2. **DO NOT modify the intelligence engine logic** (Fear Engine, SOV Engine, Greed Engine, Magic Engine). This sprint adds configuration — the engines run identically for all verticals.
3. **DO NOT add medical/dental UI to pages that don't need industry-specific copy.** Only Magic Menus page, the onboarding wizard, and the Sidebar icon/label need industry awareness. The Reality Score, SOV chart, Hallucinations chart, and other dashboard cards are industry-agnostic.
4. **DO NOT activate the legal or real_estate config entries** in Sprint E. They exist as placeholders in `INDUSTRY_CONFIG` for future extensibility. The onboarding wizard should only show `restaurant` and `medical_dental` as selectable options.
5. **DO NOT re-implement the "Restart Tour" button.** Sprint B shipped it. If it's not in the settings page, investigate why before re-implementing — the issue may be a merge conflict, not a missing implementation.
6. **DO NOT use `localStorage` in Server Components.** `FirstVisitTooltip` is `'use client'` precisely because it reads localStorage. Never attempt to read localStorage in a Next.js Server Component.
7. **DO NOT add `data-testid` to every element in Sidebar.tsx** — only to the nav items that are targeted by the tour or by E2E tests. Blanket testid additions create noise.
8. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).
9. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12).
10. **DO NOT modify `middleware.ts`** (AI_RULES §6).
11. **DO NOT hardcode "Alpharetta" in `generateSovSeeds`** — city must be a parameter. The fixture uses Alpharetta because that's the golden tenant's location. The function must work for any city.
12. **DO NOT import `ALPHARETTA_FAMILY_DENTAL` from `golden-tenant.ts` in production code.** Fixtures are test-only. Production code that needs to know the org name reads it from the DB.

---

## ✅ Definition of Done (AI_RULES §13.5)

**M5 — Industry Vertical:**
- [ ] `lib/industries/industry-config.ts` created — 4 entries (restaurant, medical_dental, legal placeholder, real_estate placeholder)
- [ ] `getIndustryConfig(null)` returns restaurant config; `getIndustryConfig('medical_dental')` returns medical config
- [ ] `lib/schema-generator/medical-types.ts` created — `PhysicianSchema`, `DentistSchema`, `MedicalClinicSchema`, `generateMedicalSchema()`
- [ ] Schema generator registry updated — medical types reachable when `org.industry === 'medical_dental'`
- [ ] `lib/services/sov-seed.ts` extended — `industryId` optional param; medical seed templates added; restaurant seeds unchanged
- [ ] `Sidebar.tsx` — Magic Menus nav item uses `getIndustryConfig(org.industry).magicMenuLabel` and `.magicMenuIcon`
- [ ] Sidebar restaurant orgs: "Magic Menu" + Utensils icon (unchanged behavior)
- [ ] Sidebar medical orgs: "Magic Services" + Stethoscope (or equivalent) icon
- [ ] `app/dashboard/magic-menus/page.tsx` — "Menu" → `industryConfig.servicesNoun` for medical orgs
- [ ] Onboarding Step 4 placeholder uses `getIndustryConfig(selectedIndustry).onboardingSearchPlaceholder`
- [ ] Industry selector in onboarding (new or verified existing) shows restaurant + medical_dental options
- [ ] `orgs.industry` column exists (new migration or confirmed existing)
- [ ] `src/__fixtures__/golden-tenant.ts` — `ALPHARETTA_FAMILY_DENTAL` fixture added
- [ ] `grep -rn "best hookah bar with live music" app/` — returns 0 results (replaced by dynamic placeholder)

**M2 — Guided Tour:**
- [ ] Verified: "Restart Tour" button exists in Settings (Sprint B artifact) — not re-implemented
- [ ] `data-testid="nav-share-of-voice"` exists on SOV sidebar nav item
- [ ] `data-testid="nav-citations"` exists on Citations sidebar nav item
- [ ] `data-testid="nav-revenue-impact"` exists on Revenue Impact sidebar nav item
- [ ] `GuidedTour.tsx` has at least 8 steps (5 original + 3 new)
- [ ] Step 6 targets Share of Voice; Step 7 targets Citations; Step 8 targets Revenue Impact
- [ ] `components/ui/FirstVisitTooltip.tsx` created — localStorage tracking, dismiss, hydration-safe
- [ ] `FirstVisitTooltip` wired into all 5 pages: entity-health, agent-readiness, cluster-map, sentiment, bot-activity
- [ ] All 5 tooltips have correct `data-testid="first-visit-tooltip-{pageKey}"` and `data-testid="first-visit-dismiss-{pageKey}"`
- [ ] Second visit to any of the 5 pages does NOT show the tooltip

**Tests:**
- [ ] `industry-config.test.ts` — **13 tests passing**
- [ ] `medical-schema-generator.test.ts` — **16 tests passing**
- [ ] `sov-seed-medical.test.ts` — **10 tests passing**
- [ ] `first-visit-tooltip.test.tsx` — **15 tests passing**
- [ ] `guided-tour-steps.test.ts` — **8 tests passing**
- [ ] `npx vitest run` — ALL tests passing, zero regressions across Sprints A–E
- [ ] `sprint-e-smoke.spec.ts` — **16 E2E tests passing**
- [ ] `npx tsc --noEmit` — 0 new type errors

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## [DATE] — Sprint E: Grow the Product — Medical/Dental Vertical & Tour Depth (Completed)

**Goal:** Open the medical/dental acquisition channel and deepen onboarding for all users.

**Scope:**
- `lib/industries/industry-config.ts` — **NEW.** 4 industry entries (restaurant, medical_dental, + legal/real_estate placeholders). `getIndustryConfig()` with restaurant fallback.
- `lib/schema-generator/medical-types.ts` — **NEW.** PhysicianSchema, DentistSchema, MedicalClinicSchema types. `generateMedicalSchema()` with specialty → Dentist detection.
- `lib/services/sov-seed.ts` — **MODIFIED.** Added `industryId` optional param. Medical seed templates: [list the template count]. Restaurant seeds unchanged.
- `components/layout/Sidebar.tsx` — **MODIFIED.** Magic Menus nav item now uses `getIndustryConfig(org.industry).magicMenuLabel` and `.magicMenuIcon`. Added data-testid on nav-share-of-voice, nav-citations, nav-revenue-impact [if missing].
- `app/dashboard/magic-menus/page.tsx` + components — **MODIFIED.** Industry-aware "Menu" → servicesNoun copy.
- Onboarding wizard — **MODIFIED.** Step 4 placeholder is dynamic. Industry selector [added / verified existing].
- `orgs.industry` column — [NEW MIGRATION CREATED / ALREADY EXISTED — confirmed via prod_schema.sql].
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** ALPHARETTA_FAMILY_DENTAL fixture added (dental practice, Alpharetta GA, Growth plan, 6 services, Mon–Sat hours).
- `app/dashboard/_components/GuidedTour.tsx` — **MODIFIED.** 3 new steps: Share of Voice (step 6), Citations (step 7), Revenue Impact (step 8). Total: 8 steps.
- Note: M2 "Restart Tour" button was shipped in Sprint B — verified present in SettingsForm.tsx, not re-implemented.
- `components/ui/FirstVisitTooltip.tsx` — **NEW.** lv_visited_pages localStorage tracking, dismiss, hydration-safe useEffect pattern.
- entity-health, agent-readiness, cluster-map, sentiment, bot-activity pages — **MODIFIED.** FirstVisitTooltip added with appropriate copy.
- `grep "best hookah bar with live music" app/` = 0 results.

**Tests added:**
- `industry-config.test.ts` — 13 tests
- `medical-schema-generator.test.ts` — 16 tests
- `sov-seed-medical.test.ts` — 10 tests
- `first-visit-tooltip.test.tsx` — 15 tests
- `guided-tour-steps.test.ts` — 8 tests
- `sprint-e-smoke.spec.ts` — 16 E2E tests
- Total Sprint E: 62 Vitest + 16 Playwright

**Cumulative totals (Sprints A–E):**
- Vitest: [N] total
- Playwright: [N] total

**Before/After:**
- Before: LocalVector was restaurant-only. After: medical_dental vertical active; Stethoscope icon in sidebar for medical orgs; "Magic Services" label; dental-specific SOV seeds; full schema.org Dentist/Physician output.
- Before: GuidedTour had 5 steps. After: 8 steps. SOV, Citations, Revenue Impact now explained.
- Before: Entity Health, Agent Readiness, Cluster Map, AI Sentiment, Bot Activity had no onboarding copy. After: one-time first-visit tooltip on each.
- Before: Onboarding Step 4 hardcoded "best hookah bar with live music." After: industry-aware placeholder.
```

---

## 🔮 AI_RULES Update (Add to `AI_RULES.md`)

```markdown
## 53. 🏥 Industry Config — Single Source of Truth (Sprint E)

`lib/industries/industry-config.ts` is the single source of truth for all industry-specific configuration.

* **Rule:** To add a new vertical, add one entry to `INDUSTRY_CONFIG` — never add industry-specific logic directly to components or services.
* **`getIndustryConfig()` fallback:** Always returns `restaurant` config for null/undefined/unknown industry values. Never return undefined.
* **Active verticals in Sprint E:** `restaurant` and `medical_dental` only. `legal` and `real_estate` are placeholders — do not add UI for them until they are officially launched.
* **Never hardcode industry strings** (e.g., `if (industry === 'medical_dental')`) in components. Always call `getIndustryConfig(org.industry)` and use the returned config object.

## 54. 📅 First-Visit Tooltips — localStorage Pattern (Sprint E)

`components/ui/FirstVisitTooltip.tsx` tracks page visits in `localStorage` under key `lv_visited_pages`.

* **Key format:** `lv_visited_pages` = JSON array of `pageKey` strings (e.g., `["entity-health","cluster-map"]`).
* **Naming convention:** `pageKey` values use kebab-case matching the route segment (e.g., `entity-health` for `/dashboard/entity-health`).
* **Never read localStorage in Server Components.** FirstVisitTooltip is `'use client'` — always. Its `visible` state initializes to `false` on SSR and updates via `useEffect`.
* **Consistent localStorage key family:** `lv_tour_completed` (GuidedTour), `lv_sample_banner_dismissed` (Sprint B), `lv_visited_pages` (Sprint E). Never add new `lv_` keys without documenting them in MEMORY.md.
```

---

## 📚 Document Sync + Git Commit

### Step 1: Update `MEMORY.md`

```markdown
## localStorage Key Registry (updated Sprint E)
All `lv_` prefixed localStorage keys in the codebase:
- `lv_tour_completed` — GuidedTour (Sprint B "Restart Tour" + Sprint E tour steps)
- `lv_sample_banner_dismissed` — SampleModeBanner (Sprint B)
- `lv_visited_pages` — FirstVisitTooltip JSON array (Sprint E)

## Decision: Industry Abstraction Architecture (Sprint E — 2026-[DATE])
- INDUSTRY_CONFIG in lib/industries/industry-config.ts is the single source of truth
- Intelligence engines are industry-agnostic — only data/config/copy layer is industry-aware
- getIndustryConfig(null) falls back to 'restaurant' — no backfill migration needed for existing orgs
- Active verticals: restaurant, medical_dental; Placeholders only: legal, real_estate
- orgs.industry column: [new column added / already existed]
```

### Step 2: Update `CLAUDE.md`

```markdown
### Sprint E — Grow the Product (2026-[DATE])
- `lib/industries/industry-config.ts` — INDUSTRY_CONFIG: restaurant + medical_dental (active) + legal/real_estate (placeholders)
- `lib/schema-generator/medical-types.ts` — Physician, Dentist, MedicalClinic schema.org types
- `lib/services/sov-seed.ts` — medical/dental seed templates added; industryId optional param
- Sidebar: dynamic Magic Menu/Services label and icon based on org.industry
- Onboarding: industry selector; dynamic placeholder; industry saved to orgs.industry
- GuidedTour: 8 steps (was 5) — added SOV (6), Citations (7), Revenue Impact (8)
- `components/ui/FirstVisitTooltip.tsx` — lv_visited_pages localStorage; wired to 5 pages
- golden-tenant.ts: ALPHARETTA_FAMILY_DENTAL dental practice fixture
- AI_RULES: 53 (industry config SOT), 54 (first-visit localStorage pattern)
- Tests: 62 Vitest + 16 Playwright
```

### Step 3: Git Commit

```bash
git add -A
git commit -m "Sprint E: Grow the Product — Medical/Dental Vertical & Tour Depth

- lib/industries/industry-config.ts: INDUSTRY_CONFIG (restaurant + medical_dental active)
- lib/schema-generator/medical-types.ts: Physician, Dentist, MedicalClinic schema types
- sov-seed.ts: medical seed templates added (industryId optional param, restaurant default preserved)
- Sidebar: dynamic icon + label via getIndustryConfig(org.industry); 3 new nav data-testid attrs
- magic-menus page: industry-aware copy (Menu → Services for medical orgs)
- Onboarding: industry selector (restaurant/medical_dental); industry-aware Step 4 placeholder
- orgs.industry column: [new migration / confirmed existing]
- golden-tenant.ts: ALPHARETTA_FAMILY_DENTAL fixture (dental, Alpharetta, Growth plan)
- GuidedTour: 8 steps (was 5); new: SOV, Citations, Revenue Impact
- M2 Restart Tour: confirmed already shipped in Sprint B (SettingsForm.tsx)
- components/ui/FirstVisitTooltip.tsx: lv_visited_pages localStorage; hydration-safe
- 5 jargon-heavy pages: FirstVisitTooltip added (entity-health, agent-readiness, cluster-map, sentiment, bot-activity)
- grep 'best hookah bar with live music' app/ = 0 results
- tests: 62 Vitest + 16 Playwright; 0 regressions across Sprints A–E
- AI_RULES: 53 (industry config SOT), 54 (first-visit localStorage pattern)

Fixes: M5 (medical/dental vertical), M2 (tour depth)
Unblocks: Sprint F (N2 on-demand AI preview, N3 correction follow-up, N4 benchmarks)"

git push origin main
```

---

## 🏁 Sprint Outcome

After Sprint E completes:

**LocalVector serves two verticals:**
- Restaurant/Food & Beverage: unchanged behavior — Utensils icon, "Magic Menu," cuisine-focused SOV seeds, `Restaurant` schema.org type
- Medical/Dental: Stethoscope icon, "Magic Services," patient-discovery SOV seeds (insurance-aware, emergency queries), `Dentist`/`Physician` schema.org type — ready to onboard a dental practice in Alpharetta and show them real value in 24 hours

**Onboarding is complete for all users:**
- Tour now covers the 3 most important unexplained features (SOV: most sophisticated; Citations: how to improve score; Revenue Impact: why it costs them money)
- The 5 most jargon-heavy pages (Entity Health, Agent Readiness, Cluster Map, AI Sentiment, Bot Activity) explain themselves on first visit
- No user should need a sales call to understand what LocalVector does or how to use it

**What Sprint F will deliver (N2, N3, N4):**
- N2: On-demand AI Answer Preview — type a query, see what 3 AI models say about your business right now
- N3: "Did It Work?" follow-up — automated verification scan 2 weeks after a correction brief is generated
- N4: Benchmark comparison — "Your Reality Score vs. Alpharetta restaurants average" (requires 10+ customers in same metro to be meaningful; build the data collection now, display when threshold is reached)
