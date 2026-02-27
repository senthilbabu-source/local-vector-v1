# Sprint 80 — Entity Knowledge Graph Health Monitor

> **Claude Code Prompt — First-Pass Ready**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`

---

## 🎯 Objective

Build the **Entity Knowledge Graph Health Monitor** — a dashboard page showing whether the business exists as a recognized "entity" across the knowledge platforms that AI models actually use: Google Knowledge Panel, Google Business Profile, Yelp, TripAdvisor, Apple Maps Connect, Bing Places, and Wikidata.

**Why it's a BIG WOW:** Most restaurant owners don't know that AI models don't just read websites — they build knowledge graphs. If your restaurant isn't an "entity" in these graphs, AI has to *guess* about you based on web scraping. **Entities get cited. Non-entities get hallucinated about.** This is the connection between entity presence and the Fear Engine (hallucination detection).

**V1 approach:** For V1, entity presence is tracked **semi-manually** — the dashboard checks what data is already in LocalVector (Google Place ID, location_integrations rows) and provides a self-assessment checklist for platforms we can't automatically verify. Future sprints can add API-based auto-verification (Google Knowledge Graph API, Yelp Fusion API, etc.). This keeps the sprint achievable at L-effort while delivering the wow factor.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                          — All engineering rules
Read CLAUDE.md                                 — Project context + architecture
Read supabase/prod_schema.sql                  — Canonical schema (§1) — locations, location_integrations
Read lib/supabase/database.types.ts            — TypeScript DB types (§38)
Read src/__fixtures__/golden-tenant.ts          — Golden Tenant fixtures (§4)
Read lib/data/dashboard.ts                     — Dashboard data layer pattern
Read lib/services/ai-health-score.service.ts   — Health Score computation (reference)
Read app/dashboard/page.tsx                    — Main dashboard layout
Read app/dashboard/_components/                — Existing dashboard cards
Read components/layout/Sidebar.tsx             — NAV_ITEMS for sidebar entry
```

---

## 🏗️ Architecture — What to Build

### The Core Concept: Entity Platform Registry

Seven platforms tracked, each with a verification method:

| Platform | Verification Source | How Checked in V1 |
|----------|--------------------|--------------------|
| Google Knowledge Panel | `locations.google_place_id` + existence check | Auto: has `google_place_id` |
| Google Business Profile | `location_integrations` where platform='google' | Auto: integration row exists with status='connected' |
| Yelp | `location_integrations` where platform='yelp' OR `entity_checks.yelp` | Semi-auto: user confirms claim status |
| TripAdvisor | `entity_checks.tripadvisor` | Manual: user confirms via checklist |
| Apple Maps Connect | `entity_checks.apple_maps` | Manual: user confirms via checklist |
| Bing Places | `entity_checks.bing_places` | Manual: user confirms via checklist |
| Wikidata | `entity_checks.wikidata` | Manual: advanced — most businesses won't have this |

---

### Component 1: Migration — `supabase/migrations/20260228000001_entity_checks.sql`

New table to track per-location entity presence across platforms.

```sql
-- Sprint 80: Entity Knowledge Graph Health Monitor
-- Tracks entity presence across AI knowledge graph platforms.

CREATE TABLE IF NOT EXISTS public.entity_checks (
  id UUID DEFAULT extensions.uuid_generate_v4() NOT NULL,
  org_id UUID NOT NULL,
  location_id UUID NOT NULL,

  -- Per-platform status
  -- 'confirmed' = user/auto-verified present
  -- 'missing' = confirmed absent
  -- 'unchecked' = not yet verified
  -- 'incomplete' = present but missing data (e.g. Bing Places without hours)
  google_knowledge_panel VARCHAR(20) DEFAULT 'unchecked' NOT NULL,
  google_business_profile VARCHAR(20) DEFAULT 'unchecked' NOT NULL,
  yelp VARCHAR(20) DEFAULT 'unchecked' NOT NULL,
  tripadvisor VARCHAR(20) DEFAULT 'unchecked' NOT NULL,
  apple_maps VARCHAR(20) DEFAULT 'unchecked' NOT NULL,
  bing_places VARCHAR(20) DEFAULT 'unchecked' NOT NULL,
  wikidata VARCHAR(20) DEFAULT 'unchecked' NOT NULL,

  -- Optional metadata per platform (URLs, external IDs, notes)
  platform_metadata JSONB DEFAULT '{}'::jsonb NOT NULL,

  -- Aggregate score: N of 7 platforms confirmed
  entity_score INTEGER DEFAULT 0 NOT NULL,

  -- Timestamps
  last_checked_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT entity_checks_pkey PRIMARY KEY (id),
  CONSTRAINT entity_checks_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT entity_checks_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE,
  CONSTRAINT entity_checks_org_location_unique UNIQUE (org_id, location_id),

  -- Status validation
  CONSTRAINT entity_checks_gkp_status CHECK (google_knowledge_panel IN ('confirmed', 'missing', 'unchecked', 'incomplete')),
  CONSTRAINT entity_checks_gbp_status CHECK (google_business_profile IN ('confirmed', 'missing', 'unchecked', 'incomplete')),
  CONSTRAINT entity_checks_yelp_status CHECK (yelp IN ('confirmed', 'missing', 'unchecked', 'incomplete')),
  CONSTRAINT entity_checks_tripadvisor_status CHECK (tripadvisor IN ('confirmed', 'missing', 'unchecked', 'incomplete')),
  CONSTRAINT entity_checks_apple_status CHECK (apple_maps IN ('confirmed', 'missing', 'unchecked', 'incomplete')),
  CONSTRAINT entity_checks_bing_status CHECK (bing_places IN ('confirmed', 'missing', 'unchecked', 'incomplete')),
  CONSTRAINT entity_checks_wikidata_status CHECK (wikidata IN ('confirmed', 'missing', 'unchecked', 'incomplete'))
);

-- RLS policies
ALTER TABLE public.entity_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON public.entity_checks
  FOR SELECT USING (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_insert" ON public.entity_checks
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_update" ON public.entity_checks
  FOR UPDATE USING (org_id = public.current_user_org_id());

-- Indexes
CREATE INDEX idx_entity_checks_org ON public.entity_checks USING btree (org_id);

-- Trigger
CREATE TRIGGER set_updated_at_entity_checks
  BEFORE UPDATE ON public.entity_checks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

**Update `prod_schema.sql`** with the new table definition.
**Update `lib/supabase/database.types.ts`** — add `entity_checks` table type.

---

### Component 2: Entity Health Service — `lib/services/entity-health.service.ts`

**Pure functions** for computing entity health status and recommendations. No I/O.

```typescript
// ── Platform Registry ──────────────────────────────────

export type EntityPlatform =
  | 'google_knowledge_panel'
  | 'google_business_profile'
  | 'yelp'
  | 'tripadvisor'
  | 'apple_maps'
  | 'bing_places'
  | 'wikidata';

export type EntityStatus = 'confirmed' | 'missing' | 'unchecked' | 'incomplete';

export interface PlatformInfo {
  key: EntityPlatform;
  label: string;
  description: string;
  /** Why this platform matters for AI visibility */
  aiImpact: string;
  /** Step-by-step guide to claim/verify on this platform */
  claimGuide: string[];
  /** External URL to claim the listing */
  claimUrl: string;
  /** Can we auto-detect from existing LocalVector data? */
  autoDetectable: boolean;
  /** Priority for AI citation: higher = more important */
  priority: number;
}

export const ENTITY_PLATFORM_REGISTRY: PlatformInfo[] = [
  {
    key: 'google_knowledge_panel',
    label: 'Google Knowledge Panel',
    description: 'A prominent info box in Google Search results that confirms your business as a recognized entity.',
    aiImpact: 'Google-based AI models (Gemini, Google AI Overviews) heavily rely on Knowledge Graph entities for factual grounding.',
    claimGuide: [
      'Search for your business name on Google',
      'If a Knowledge Panel appears on the right side, click "Claim this business"',
      'Follow the verification steps (usually email or phone)',
      'If no panel exists, ensure your Google Business Profile is complete and verified',
    ],
    claimUrl: 'https://www.google.com/search',
    autoDetectable: true,
    priority: 10,
  },
  {
    key: 'google_business_profile',
    label: 'Google Business Profile',
    description: 'Your verified GBP listing is the primary data source for Google\'s AI products.',
    aiImpact: 'The #1 data source for Google AI Overviews. A verified, complete GBP is the single highest-impact action for AI visibility.',
    claimGuide: [
      'Go to business.google.com',
      'Search for your business or add it',
      'Complete all fields: hours, categories, photos, services, attributes',
      'Verify via postcard, phone, or email',
      'Post updates weekly to signal freshness',
    ],
    claimUrl: 'https://business.google.com',
    autoDetectable: true,
    priority: 10,
  },
  {
    key: 'yelp',
    label: 'Yelp',
    description: 'Yelp\'s entity database is a primary citation source for ChatGPT and Copilot.',
    aiImpact: 'ChatGPT and Microsoft Copilot frequently cite Yelp reviews and ratings. An unclaimed Yelp page means AI engines cite unverified information about you.',
    claimGuide: [
      'Go to biz.yelp.com',
      'Search for your business',
      'Click "Claim this business" (or "Add your business" if not found)',
      'Verify ownership via phone or email',
      'Complete your profile: hours, photos, categories, response to reviews',
    ],
    claimUrl: 'https://biz.yelp.com',
    autoDetectable: false,
    priority: 9,
  },
  {
    key: 'tripadvisor',
    label: 'TripAdvisor',
    description: 'TripAdvisor is used by Perplexity and Copilot for restaurant recommendations.',
    aiImpact: 'Perplexity and Copilot cite TripAdvisor for restaurant rankings. Missing means AI can\'t verify your quality via TripAdvisor reviews.',
    claimGuide: [
      'Go to tripadvisor.com/owners',
      'Search for your business',
      'Click "Claim your listing" (or add it if not found)',
      'Verify via phone or credit card',
      'Complete profile: photos, hours, menu, management responses',
    ],
    claimUrl: 'https://www.tripadvisor.com/owners',
    autoDetectable: false,
    priority: 7,
  },
  {
    key: 'apple_maps',
    label: 'Apple Maps Connect',
    description: 'Apple Maps data powers Siri and Apple Intelligence recommendations.',
    aiImpact: 'Siri and Apple Intelligence use Apple Maps for local business queries. An unclaimed listing means Siri won\'t recommend you.',
    claimGuide: [
      'Go to mapsconnect.apple.com',
      'Sign in with your Apple ID',
      'Search for your business or add it',
      'Verify ownership (phone call)',
      'Complete all fields: hours, categories, photos, payment methods',
    ],
    claimUrl: 'https://mapsconnect.apple.com',
    autoDetectable: false,
    priority: 8,
  },
  {
    key: 'bing_places',
    label: 'Bing Places for Business',
    description: 'Bing Places is the primary data source for Microsoft Copilot.',
    aiImpact: 'Microsoft Copilot grounds its responses on Bing\'s index. An incomplete or missing Bing Places listing means Copilot guesses about your business.',
    claimGuide: [
      'Go to bingplaces.com',
      'Sign in with a Microsoft account',
      'Import from Google Business Profile (fastest) or add manually',
      'Verify via phone, email, or postal mail',
      'Ensure hours, categories, and photos are complete',
    ],
    claimUrl: 'https://www.bingplaces.com',
    autoDetectable: false,
    priority: 8,
  },
  {
    key: 'wikidata',
    label: 'Wikidata',
    description: 'Wikidata is the structured knowledge base used by many AI models for entity resolution.',
    aiImpact: 'Advanced AEO step. Wikidata entities are used by AI models for disambiguation. Most local restaurants won\'t have this — but notable establishments can benefit.',
    claimGuide: [
      'Go to wikidata.org',
      'Search for your business (it likely doesn\'t exist yet)',
      'Create a new item with property "instance of" → "restaurant"',
      'Add properties: official website, location, coordinates, inception date',
      'Link to your Wikipedia article if one exists',
      'Note: Wikidata entries must be notable — requires media coverage or Wikipedia article',
    ],
    claimUrl: 'https://www.wikidata.org',
    autoDetectable: false,
    priority: 3,
  },
];

// ── Health Computation ─────────────────────────────────

export interface EntityHealthResult {
  /** Per-platform status with metadata */
  platforms: Array<{
    info: PlatformInfo;
    status: EntityStatus;
    metadata?: Record<string, unknown>;
  }>;

  /** Aggregate: confirmed count out of total (excluding wikidata from denominator) */
  confirmedCount: number;
  totalPlatforms: number;  // 6 (wikidata excluded from health calculation)

  /** Overall entity health */
  score: number;           // 0-100
  rating: 'strong' | 'at_risk' | 'critical' | 'unknown';

  /** Fix recommendations sorted by priority */
  recommendations: Array<{
    platform: EntityPlatform;
    label: string;
    action: string;
    priority: number;
    claimUrl: string;
  }>;
}

export interface EntityCheckRow {
  google_knowledge_panel: string;
  google_business_profile: string;
  yelp: string;
  tripadvisor: string;
  apple_maps: string;
  bing_places: string;
  wikidata: string;
  platform_metadata: Record<string, unknown>;
}

/**
 * Pure function — computes entity health from the entity_checks row.
 * No I/O, no side effects.
 */
export function computeEntityHealth(check: EntityCheckRow): EntityHealthResult {
  const platformStatuses = ENTITY_PLATFORM_REGISTRY.map(info => ({
    info,
    status: check[info.key] as EntityStatus,
    metadata: (check.platform_metadata as Record<string, Record<string, unknown>>)?.[info.key],
  }));

  // Score: count confirmed out of 6 core platforms (exclude wikidata — it's advanced/optional)
  const corePlatforms = platformStatuses.filter(p => p.info.key !== 'wikidata');
  const confirmedCount = corePlatforms.filter(p => p.status === 'confirmed').length;
  const totalPlatforms = corePlatforms.length; // 6

  // Score: percentage of core platforms confirmed
  const score = totalPlatforms > 0 ? Math.round((confirmedCount / totalPlatforms) * 100) : 0;

  // Rating
  const rating: EntityHealthResult['rating'] =
    confirmedCount === 0 && corePlatforms.every(p => p.status === 'unchecked') ? 'unknown'
    : confirmedCount >= 5 ? 'strong'
    : confirmedCount >= 3 ? 'at_risk'
    : 'critical';

  // Recommendations: missing + incomplete + unchecked platforms, sorted by priority desc
  const recommendations = platformStatuses
    .filter(p => p.status !== 'confirmed')
    .sort((a, b) => b.info.priority - a.info.priority)
    .map(p => ({
      platform: p.info.key,
      label: p.info.label,
      action: p.status === 'missing'
        ? `Claim your ${p.info.label} listing`
        : p.status === 'incomplete'
        ? `Complete your ${p.info.label} listing (missing data)`
        : `Check your ${p.info.label} presence`,
      priority: p.info.priority,
      claimUrl: p.info.claimUrl,
    }));

  return {
    platforms: platformStatuses,
    confirmedCount,
    totalPlatforms,
    score,
    rating,
    recommendations,
  };
}
```

---

### Component 3: Auto-Detection Service — `lib/services/entity-auto-detect.ts`

Checks existing LocalVector data to automatically set statuses for auto-detectable platforms.

```typescript
/**
 * Auto-detect entity presence from existing LocalVector data.
 * Returns partial entity_checks updates for auto-detectable platforms.
 * Pure function — caller passes data in.
 */
export function autoDetectEntityPresence(
  location: {
    google_place_id: string | null;
    gbp_integration_id: string | null;
  },
  integrations: Array<{
    platform: string;
    status: string;
    external_id: string | null;
  }>
): Partial<Record<string, string>> {
  const updates: Record<string, string> = {};

  // Google Knowledge Panel: if google_place_id exists, entity is in Google's graph
  if (location.google_place_id) {
    updates.google_knowledge_panel = 'confirmed';
  }

  // Google Business Profile: if integration exists and is connected
  const gbpIntegration = integrations.find(
    i => i.platform === 'google' && i.status === 'connected'
  );
  if (gbpIntegration || location.gbp_integration_id) {
    updates.google_business_profile = 'confirmed';
  }

  // Yelp: if integration exists
  const yelpIntegration = integrations.find(
    i => i.platform === 'yelp' && i.status === 'connected'
  );
  if (yelpIntegration) {
    updates.yelp = 'confirmed';
  }

  return updates;
}
```

---

### Component 4: Data Fetcher — `lib/data/entity-health.ts`

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  computeEntityHealth,
  type EntityHealthResult,
  type EntityCheckRow,
} from '@/lib/services/entity-health.service';
import { autoDetectEntityPresence } from '@/lib/services/entity-auto-detect';

/**
 * Fetch or initialize entity health for a location.
 * If no entity_checks row exists, creates one with auto-detected values.
 */
export async function fetchEntityHealth(
  supabase: SupabaseClient<Database>,
  orgId: string,
  locationId: string
): Promise<EntityHealthResult> {
  // 1. Try to fetch existing entity_checks row
  let { data: check } = await supabase
    .from('entity_checks')
    .select('*')
    .eq('org_id', orgId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!check) {
    // 2. Auto-detect from existing data
    const [locationResult, integrationsResult] = await Promise.all([
      supabase
        .from('locations')
        .select('google_place_id, gbp_integration_id')
        .eq('id', locationId)
        .eq('org_id', orgId)
        .single(),
      supabase
        .from('location_integrations')
        .select('platform, status, external_id')
        .eq('org_id', orgId)
        .eq('location_id', locationId),
    ]);

    const autoDetected = autoDetectEntityPresence(
      locationResult.data ?? { google_place_id: null, gbp_integration_id: null },
      integrationsResult.data ?? []
    );

    // 3. Create entity_checks row with auto-detected values
    const insertData = {
      org_id: orgId,
      location_id: locationId,
      ...autoDetected,
    };

    const { data: newCheck } = await supabase
      .from('entity_checks')
      .insert(insertData)
      .select('*')
      .single();

    // Recompute entity_score
    if (newCheck) {
      const health = computeEntityHealth(newCheck as unknown as EntityCheckRow);
      await supabase
        .from('entity_checks')
        .update({ entity_score: health.score })
        .eq('id', newCheck.id);

      return health;
    }

    // Fallback: return all-unchecked
    return computeEntityHealth({
      google_knowledge_panel: 'unchecked',
      google_business_profile: 'unchecked',
      yelp: 'unchecked',
      tripadvisor: 'unchecked',
      apple_maps: 'unchecked',
      bing_places: 'unchecked',
      wikidata: 'unchecked',
      platform_metadata: {},
    });
  }

  return computeEntityHealth(check as unknown as EntityCheckRow);
}
```

---

### Component 5: Server Action — `app/dashboard/actions/entity-health.ts`

```typescript
'use server';

import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchEntityHealth } from '@/lib/data/entity-health';
import { computeEntityHealth } from '@/lib/services/entity-health.service';
import type { EntityHealthResult, EntityPlatform, EntityStatus } from '@/lib/services/entity-health.service';
import { z } from 'zod/v4';

/**
 * Server Action: Get entity health for primary location.
 */
export async function getEntityHealth(): Promise<
  { success: true; data: EntityHealthResult } |
  { success: false; error: string }
> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const supabase = await createClient();

  const { data: location } = await supabase
    .from('locations')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('is_primary', true)
    .maybeSingle();

  if (!location) return { success: false, error: 'No primary location' };

  const result = await fetchEntityHealth(supabase, ctx.orgId, location.id);
  return { success: true, data: result };
}

const UpdateEntitySchema = z.object({
  platform: z.enum([
    'google_knowledge_panel', 'google_business_profile',
    'yelp', 'tripadvisor', 'apple_maps', 'bing_places', 'wikidata',
  ]),
  status: z.enum(['confirmed', 'missing', 'unchecked', 'incomplete']),
});

/**
 * Server Action: Update a single platform's entity status.
 * User-initiated via the checklist UI.
 */
export async function updateEntityStatus(formData: FormData): Promise<
  { success: true; data: EntityHealthResult } |
  { success: false; error: string }
> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const parsed = UpdateEntitySchema.safeParse({
    platform: formData.get('platform'),
    status: formData.get('status'),
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();

  const { data: location } = await supabase
    .from('locations')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('is_primary', true)
    .maybeSingle();

  if (!location) return { success: false, error: 'No primary location' };

  // Upsert: update the specific platform column
  const { data: existing } = await supabase
    .from('entity_checks')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('location_id', location.id)
    .maybeSingle();

  const updatePayload = {
    [parsed.data.platform]: parsed.data.status,
    last_checked_at: new Date().toISOString(),
  };

  if (existing) {
    await supabase
      .from('entity_checks')
      .update(updatePayload)
      .eq('id', existing.id);
  } else {
    await supabase
      .from('entity_checks')
      .insert({
        org_id: ctx.orgId,
        location_id: location.id,
        ...updatePayload,
      });
  }

  // Recompute and return
  const result = await fetchEntityHealth(supabase, ctx.orgId, location.id);

  // Update entity_score
  const { data: row } = await supabase
    .from('entity_checks')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('location_id', location.id)
    .maybeSingle();

  if (row) {
    await supabase
      .from('entity_checks')
      .update({ entity_score: result.score })
      .eq('id', row.id);
  }

  return { success: true, data: result };
}
```

---

### Component 6: Dashboard Page — `app/dashboard/entity-health/page.tsx`

**New dashboard page — Server Component.**

**Sidebar entry:** Add to `NAV_ITEMS` in `components/layout/Sidebar.tsx`:
- Label: `"Entity Health"`
- Icon: `Globe` from `lucide-react`
- Href: `/dashboard/entity-health`
- Position: after "Proof Timeline"

#### Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  🏢 Entity Knowledge Graph Health                                │
│                                                                   │
│  ┌───────────────────────────────────────┐                       │
│  │  Entity Score: 50% · At Risk          │                       │
│  │  3 of 6 platforms confirmed           │                       │
│  │  ██████████░░░░░░░░░░                 │                       │
│  └───────────────────────────────────────┘                       │
│                                                                   │
│  ── Platform Checklist ──────────────────────────────────────── │
│                                                                   │
│  ✅ Google Knowledge Panel     [Confirmed]                       │
│     Auto-detected from your Google Place ID                      │
│                                                                   │
│  ✅ Google Business Profile    [Confirmed]                       │
│     Connected via LocalVector integration                        │
│                                                                   │
│  ✅ Yelp                       [Confirmed ▼]                     │
│     Claimed and verified                                         │
│                                                                   │
│  ❌ TripAdvisor                [Not Checked ▼]                   │
│     AI models can't verify you via TripAdvisor                   │
│     📋 How to claim: tripadvisor.com/owners → ...                │
│     [Claim Listing →]                                             │
│                                                                   │
│  ❌ Apple Maps Connect         [Missing ▼]                       │
│     Siri won't recommend you                                     │
│     📋 How to claim: mapsconnect.apple.com → ...                 │
│     [Claim Listing →]                                             │
│                                                                   │
│  ⚠️ Bing Places               [Incomplete ▼]                    │
│     Found but missing hours data                                 │
│     📋 How to fix: bingplaces.com → ...                           │
│     [Update Listing →]                                            │
│                                                                   │
│  ◻️ Wikidata                   [Not Checked ▼]                   │
│     Advanced AEO step (optional)                                 │
│                                                                   │
│  ── Top Recommendations ─────────────────────────────────────── │
│                                                                   │
│  1. Claim TripAdvisor listing (priority: HIGH)                   │
│  2. Complete Bing Places listing (priority: HIGH)                │
│  3. Claim Apple Maps Connect (priority: HIGH)                    │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation details:**

- **Dropdown per platform:** Each non-auto-detected platform has a status dropdown: Confirmed / Missing / Incomplete / Not Checked. Changing the dropdown calls `updateEntityStatus()` server action.
- **Auto-detected platforms** show "[Confirmed]" with "(auto-detected)" label and no dropdown — the user can't override auto-detection.
- **Status icons:** ✅ confirmed, ❌ missing, ⚠️ incomplete, ◻️ unchecked. Use literal Tailwind classes for colors: `text-green-400`, `text-red-400`, `text-amber-400`, `text-slate-400`.
- **Claim guide:** Expands when a platform is missing/incomplete. Shows the `claimGuide` steps from the registry + external link.
- **Score bar:** Visual progress bar showing N/6 core platforms confirmed.
- **Rating badge:** Strong (green), At Risk (amber), Critical (red), Unknown (slate).
- **No plan gating.** Entity Health is available to ALL tiers.

**Error boundary:** Create `app/dashboard/entity-health/error.tsx`.

---

### Component 7: Dashboard Summary Card — `app/dashboard/_components/EntityHealthCard.tsx`

Compact card on main dashboard.

```
┌─────────────────────────────────────────┐
│  🏢 Entity Health: 50% · At Risk        │
│  3/6 platforms verified                  │
│  2 high-priority fixes available         │
│  [View Entity Health →]                  │
└─────────────────────────────────────────┘
```

Add to `app/dashboard/page.tsx`.

---

### Component 8: Seed Data — `supabase/seed.sql`

```sql
-- Sprint 80: Entity Checks seed row for Charcoal N Chill
INSERT INTO public.entity_checks
  (id, org_id, location_id, google_knowledge_panel, google_business_profile, yelp, tripadvisor, apple_maps, bing_places, wikidata, entity_score, platform_metadata) VALUES
  ('g0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'confirmed', 'confirmed', 'confirmed',
   'missing', 'missing', 'incomplete', 'unchecked',
   50,
   '{"google_knowledge_panel": {"place_id": "ChIJtest123"}, "bing_places": {"note": "Missing hours"}}'::jsonb);
```

Register UUID `g0eebc99-...` in the reference card.

---

### Component 9: Golden Tenant Fixture — `src/__fixtures__/golden-tenant.ts`

```typescript
/**
 * Sprint 80 — Canonical EntityCheckRow fixture for Charcoal N Chill.
 * 3/6 confirmed: Google KP, GBP, Yelp. TripAdvisor and Apple Maps missing. Bing incomplete.
 */
export const MOCK_ENTITY_CHECK: import('@/lib/services/entity-health.service').EntityCheckRow = {
  google_knowledge_panel: 'confirmed',
  google_business_profile: 'confirmed',
  yelp: 'confirmed',
  tripadvisor: 'missing',
  apple_maps: 'missing',
  bing_places: 'incomplete',
  wikidata: 'unchecked',
  platform_metadata: {
    google_knowledge_panel: { place_id: 'ChIJtest123' },
    bing_places: { note: 'Missing hours' },
  },
};
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/entity-health-service.test.ts`

**Target: `lib/services/entity-health.service.ts`**

```
describe('computeEntityHealth')
  Score computation:
  1.  scores 100 when all 6 core platforms confirmed
  2.  scores 50 when 3 of 6 confirmed
  3.  scores 0 when none confirmed
  4.  excludes wikidata from score denominator
  5.  wikidata='confirmed' does not increase score above 6-platform cap

  Rating:
  6.  returns 'strong' when 5+ platforms confirmed
  7.  returns 'at_risk' when 3-4 platforms confirmed
  8.  returns 'critical' when 0-2 platforms confirmed
  9.  returns 'unknown' when all platforms are 'unchecked'

  Platforms:
  10. returns all 7 platforms in result
  11. maps each platform to its registry info
  12. includes status from check row
  13. includes metadata from platform_metadata JSONB

  Recommendations:
  14. recommends missing platforms with claim guide
  15. recommends incomplete platforms with fix action
  16. recommends unchecked platforms with check action
  17. does not recommend confirmed platforms
  18. sorts recommendations by priority descending
  19. includes claimUrl in each recommendation

  Edge cases:
  20. uses MOCK_ENTITY_CHECK and produces score=50, rating='at_risk'
  21. handles all 'confirmed' (no recommendations)
  22. handles all 'missing' (6 recommendations)
  23. handles 'incomplete' status correctly (different action text than 'missing')

describe('ENTITY_PLATFORM_REGISTRY')
  24. has exactly 7 platforms
  25. each platform has non-empty label, description, aiImpact, claimGuide, claimUrl
  26. google_knowledge_panel and google_business_profile are autoDetectable
  27. yelp through wikidata are not autoDetectable
```

**27 tests total. No mocks — pure functions.**

### Test File 2: `src/__tests__/unit/entity-auto-detect.test.ts`

**Target: `lib/services/entity-auto-detect.ts`**

```
describe('autoDetectEntityPresence')
  1. sets google_knowledge_panel='confirmed' when google_place_id exists
  2. does not set google_knowledge_panel when google_place_id is null
  3. sets google_business_profile='confirmed' when GBP integration is connected
  4. sets google_business_profile='confirmed' when gbp_integration_id exists
  5. sets yelp='confirmed' when yelp integration is connected
  6. does not set yelp when no yelp integration exists
  7. returns empty object when no data matches
  8. handles empty integrations array
```

**8 tests total. No mocks — pure function.**

### Test File 3: `src/__tests__/unit/entity-health-data.test.ts`

**Target: `lib/data/entity-health.ts`**

```
describe('fetchEntityHealth')
  1. returns existing entity_checks row if present
  2. creates new row with auto-detected values when none exists
  3. auto-detects Google platforms from locations + integrations
  4. scopes all queries by org_id (§18)
  5. returns all-unchecked when no data and no integrations
  6. calls computeEntityHealth with check row
```

**6 tests total.**

### Test File 4: `src/__tests__/unit/entity-health-action.test.ts`

**Target: `app/dashboard/actions/entity-health.ts`**

```
describe('getEntityHealth')
  1. returns Unauthorized when no session
  2. returns error when no primary location
  3. returns EntityHealthResult on happy path

describe('updateEntityStatus')
  4. returns Unauthorized when no session
  5. validates platform name with Zod
  6. validates status value with Zod
  7. updates the correct platform column
  8. creates entity_checks row if none exists
  9. recalculates entity_score after update
  10. returns updated EntityHealthResult
```

**10 tests total.**

### Test File 5: `src/__tests__/unit/sidebar-entity.test.ts`

**Target: `components/layout/Sidebar.tsx`**

```
describe('Sidebar NAV_ITEMS — Entity Health')
  1. NAV_ITEMS includes Entity Health entry
  2. Entity Health has correct href /dashboard/entity-health
  3. Entity Health is positioned after Proof Timeline
```

**3 tests total.**

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `supabase/migrations/20260228000001_entity_checks.sql` | **CREATE** | New table with RLS |
| 2 | `lib/services/entity-health.service.ts` | **CREATE** | Pure functions: registry, computeEntityHealth |
| 3 | `lib/services/entity-auto-detect.ts` | **CREATE** | Auto-detection from existing data |
| 4 | `lib/data/entity-health.ts` | **CREATE** | Data fetcher with lazy initialization |
| 5 | `app/dashboard/actions/entity-health.ts` | **CREATE** | Server Actions: getEntityHealth, updateEntityStatus |
| 6 | `app/dashboard/entity-health/page.tsx` | **CREATE** | Full dashboard page (Server Component) |
| 7 | `app/dashboard/entity-health/error.tsx` | **CREATE** | Error boundary |
| 8 | `app/dashboard/_components/EntityHealthCard.tsx` | **CREATE** | Summary card for main dashboard |
| 9 | `app/dashboard/page.tsx` | **MODIFY** | Add EntityHealthCard |
| 10 | `components/layout/Sidebar.tsx` | **MODIFY** | Add Entity Health to NAV_ITEMS |
| 11 | `supabase/prod_schema.sql` | **MODIFY** | Add entity_checks table |
| 12 | `lib/supabase/database.types.ts` | **MODIFY** | Add entity_checks type |
| 13 | `supabase/seed.sql` | **MODIFY** | Add entity_checks seed row |
| 14 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | Add MOCK_ENTITY_CHECK |
| 15 | `src/__tests__/unit/entity-health-service.test.ts` | **CREATE** | 27 tests |
| 16 | `src/__tests__/unit/entity-auto-detect.test.ts` | **CREATE** | 8 tests |
| 17 | `src/__tests__/unit/entity-health-data.test.ts` | **CREATE** | 6 tests |
| 18 | `src/__tests__/unit/entity-health-action.test.ts` | **CREATE** | 10 tests |
| 19 | `src/__tests__/unit/sidebar-entity.test.ts` | **CREATE** | 3 tests |

**Expected test count: 54 new tests across 5 files.**

---

## 🚫 What NOT to Do

1. **DO NOT call external APIs (Google Knowledge Graph, Yelp Fusion, etc.) in V1.** This sprint uses auto-detection from existing data + user self-assessment. API-based auto-verification is a future sprint.
2. **DO NOT trigger auto-detection on every page load.** Auto-detection runs on first visit (lazy initialization) and when the user explicitly refreshes. After that, the user manages via the checklist.
3. **DO NOT count Wikidata in the core health score.** It's an advanced step most restaurants won't have. 6 core platforms, Wikidata is bonus.
4. **DO NOT use AI/LLM for entity detection.** All logic is deterministic.
5. **DO NOT plan-gate entity health.** Available to ALL tiers — it's a discovery and retention feature.
6. **DO NOT use `as any` on Supabase clients** (§38.2).
7. **DO NOT create files under `supabase/functions/`** (§6).
8. **DO NOT use dynamic Tailwind classes** for status colors (§12).
9. **DO NOT make the entity_checks table without RLS** — follow standard org isolation pattern.

---

## ✅ Definition of Done (AI_RULES §13.5)

- [ ] `entity_checks` table created with RLS, 7 platform columns, metadata JSONB, score
- [ ] `lib/services/entity-health.service.ts` — registry + computeEntityHealth pure function
- [ ] `lib/services/entity-auto-detect.ts` — auto-detection from existing data
- [ ] `lib/data/entity-health.ts` — fetcher with lazy initialization
- [ ] Server Actions: getEntityHealth + updateEntityStatus with Zod validation
- [ ] Dashboard page with checklist UI, status dropdowns, claim guides, score bar
- [ ] EntityHealthCard on main dashboard
- [ ] Sidebar "Entity Health" nav entry
- [ ] `prod_schema.sql` + `database.types.ts` updated
- [ ] Seed + golden-tenant fixtures
- [ ] 54 tests passing across 5 files
- [ ] `npx vitest run` — ALL tests passing
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] DEVLOG.md entry written

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## 2026-02-28 — Sprint 80: Entity Knowledge Graph Health Monitor (Completed)

**Goal:** Build a dashboard showing entity presence across 7 knowledge graph platforms AI models use (Google KP, GBP, Yelp, TripAdvisor, Apple Maps, Bing Places, Wikidata). Auto-detects from existing data, user self-assesses the rest. Entities get cited, non-entities get hallucinated about.

**Scope:**
- `supabase/migrations/20260228000001_entity_checks.sql` — **NEW.** `entity_checks` table: 7 platform status columns (varchar CHECK: confirmed/missing/unchecked/incomplete), `platform_metadata` JSONB, `entity_score` integer, org_id + location_id unique constraint. Full RLS with org isolation policies. Updated trigger.
- `lib/services/entity-health.service.ts` — **NEW.** Pure service (~300 lines). `ENTITY_PLATFORM_REGISTRY` (7 platforms with labels, AI impact descriptions, claim guides, external URLs, priorities). `computeEntityHealth()` — computes score (N/6 core, excludes Wikidata), rating (strong/at_risk/critical/unknown), sorted recommendations with claim URLs.
- `lib/services/entity-auto-detect.ts` — **NEW.** `autoDetectEntityPresence()` — checks `google_place_id`, `gbp_integration_id`, and `location_integrations` to auto-set Google KP, GBP, and Yelp statuses.
- `lib/data/entity-health.ts` — **NEW.** `fetchEntityHealth()` — lazy-initializes entity_checks row on first access, runs auto-detection, persists, and computes health.
- `app/dashboard/actions/entity-health.ts` — **NEW.** Two Server Actions: `getEntityHealth()` and `updateEntityStatus(formData)` with Zod validation. Recalculates entity_score on each update.
- `app/dashboard/entity-health/page.tsx` — **NEW.** Server Component. Score bar, 7-platform checklist with status dropdowns (auto-detected platforms locked), expandable claim guides, recommendation list.
- `app/dashboard/entity-health/error.tsx` — **NEW.** Error boundary.
- `app/dashboard/_components/EntityHealthCard.tsx` — **NEW.** Summary card for main dashboard.
- Sidebar, seed, golden-tenant, prod_schema, database.types all updated.

**Tests added:**
- `src/__tests__/unit/entity-health-service.test.ts` — **N tests.** Score, rating, recommendations, registry validation.
- `src/__tests__/unit/entity-auto-detect.test.ts` — **N tests.** Auto-detection from place_id + integrations.
- `src/__tests__/unit/entity-health-data.test.ts` — **N tests.** Lazy init, auto-detect, fallback.
- `src/__tests__/unit/entity-health-action.test.ts` — **N tests.** Auth, Zod, upsert, score recalc.
- `src/__tests__/unit/sidebar-entity.test.ts` — **N tests.** NAV_ITEMS entry.

**Note:** Replace N with actual test counts verified via `grep -cE "^\s*(it|test)\("` (AI_RULES §13.3).
```

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| `locations.google_place_id` | Initial schema | Auto-detect Google KP |
| `location_integrations` table | Initial schema | Auto-detect GBP/Yelp connected status |
| RLS pattern + `current_user_org_id()` | All sprints | Org isolation for new table |
| `update_updated_at_column()` trigger | Initial schema | Auto-update timestamps |
| Dashboard card pattern | Sprint 72+ | Card + page layout conventions |
| Sidebar NAV_ITEMS | Sprint 73+ | Testable nav array |

---

## 🧠 Edge Cases to Handle

1. **No entity_checks row exists yet:** `fetchEntityHealth` lazily creates one with auto-detected values. User sees a partially filled checklist on first visit.
2. **User overrides auto-detection:** Auto-detected platforms show as locked (no dropdown). If the auto-detection is wrong (e.g., Google Place ID exists but KP doesn't actually show), the user can contact support. V2 can add an "override auto-detection" option.
3. **All platforms unchecked:** Rating = `'unknown'`. Score = 0. Message: "Complete the checklist to assess your entity presence."
4. **Business truly has no entity presence:** All `'missing'`. Rating = `'critical'`. All 7 recommendations shown sorted by priority.
5. **Wikidata confirmed but nothing else:** Score is still 0/6 (Wikidata excluded). This is by design — Wikidata without core platforms is a vanity metric.
6. **Platform metadata with extra fields:** `platform_metadata` is freeform JSONB. Future sprints can store external IDs, review counts, etc.

---

## 🔮 AI_RULES Update

```markdown
## 43. 🏢 Entity Knowledge Graph — Semi-Manual + Auto-Detect Pattern (Sprint 80)

The Entity Knowledge Graph Health Monitor tracks business presence across 7 AI knowledge graph platforms.

* **Table:** `entity_checks` — one row per org+location, 7 platform columns (confirmed/missing/unchecked/incomplete), `platform_metadata` JSONB, `entity_score` integer.
* **Auto-detection:** Google KP (from `google_place_id`), GBP (from `location_integrations`), Yelp (from integrations). All others are user self-assessed via the checklist UI.
* **Score:** N/6 core platforms confirmed (Wikidata excluded — it's advanced/optional).
* **Rating thresholds:** ≥5 = strong, 3-4 = at_risk, 0-2 = critical, all unchecked = unknown.
* **Registry:** `ENTITY_PLATFORM_REGISTRY` in `lib/services/entity-health.service.ts` is the canonical list of platforms with claim guides and AI impact descriptions.
* **Lazy initialization:** `entity_checks` row is created on first page visit via `fetchEntityHealth()`.
```
