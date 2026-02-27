# Sprint 89 — GBP Data Import: Full Data Mapping Pipeline

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`

---

## 🎯 Objective

Complete the **Google Business Profile (GBP) data import pipeline** — the single biggest new-user friction point in LocalVector V1. OAuth connect works (Sprint 57B), but after connecting, **zero data flows into the system**. This sprint wires the import:

1. **Data mapper** — transforms raw GBP API response into LocalVector's `locations` schema
2. **Import API route** — authenticated endpoint that fetches + maps + upserts GBP data
3. **Timezone resolver** — converts GBP `regularHours` (UTC offsets) to IANA tz strings
4. **Onboarding interstitial** — prompts connected users to trigger import during onboarding
5. **Import progress UI** — shows real-time import status, success confirmation, and data preview

**Why this matters:** A restaurant owner clicks "Connect Google Business Profile", it succeeds — and then nothing happens. Their dashboard is empty. They churn. This sprint closes the loop: connect → import → populated dashboard in < 60 seconds.

**Gap being closed:** Feature #53 in the Comprehensive Gap Analysis — GBP Data Import (currently 30% → targeting 100%).

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

Before writing ANY code, read these files in order. Do not skip any.

```
Read docs/AI_RULES.md                                 — All engineering rules (currently 39+)
Read CLAUDE.md                                        — Project context, architecture, patterns
Read MEMORY.md                                        — Key decisions and constraints
Read supabase/prod_schema.sql                         — Canonical schema
  § Find: locations table (hours_data, operational_status, amenities columns)
  § Find: gbp_connections table (access_token, refresh_token, gbp_location_id)
  § Find: onboarding_state table (if exists) OR onboarding step tracking in orgs
Read lib/supabase/database.types.ts                   — TypeScript DB types
Read src/__fixtures__/golden-tenant.ts                — Golden Tenant fixtures (org_id: a0eebc99)
Read app/api/auth/google-business/callback/route.ts   — Existing GBP OAuth callback (Sprint 57B)
Read app/api/auth/google-business/route.ts            — Existing GBP OAuth initiation
Read lib/supabase/server.ts                           — createClient() vs createServiceRoleClient()
Read app/dashboard/settings/page.tsx                  — GBP connect/disconnect UI (already built)
Read app/onboarding/page.tsx                          — Current onboarding page/wizard
Read lib/plan-enforcer.ts                             — Plan gating (GBP import is gated to Growth+)
Read components/layout/Sidebar.tsx                    — NAV_ITEMS for reference
Read app/dashboard/page.tsx                           — Dashboard page to add import status card
```

**Specifically understand before writing code:**
- How `gbp_connections` stores tokens (`access_token`, `refresh_token`, `gbp_location_id`, `expires_at`)
- The `locations` table column types: `hours_data jsonb`, `operational_status text`, `amenities jsonb`
- Existing RLS policies on `gbp_connections` and `locations`
- The onboarding flow's current steps and where the GBP interstitial fits
- Whether `getSafeAuthContext()` or middleware handles auth in route handlers

---

## 🏗️ Architecture — What to Build

### Component 1: GBP Data Mapper — `lib/gbp/gbp-data-mapper.ts`

**Pure function.** No I/O, no side effects. Takes a raw GBP API `Location` object and returns a partial `LocationUpdate` ready for upserting into the `locations` table.

```typescript
/**
 * GBP Data Mapper — pure transformation layer.
 * Converts raw Google Business Profile API responses into LocalVector's schema.
 * 
 * GBP API Reference:
 * - regularHours: { periods: [{ openDay, openTime, closeDay, closeTime }] }
 * - openInfo: { status: 'OPEN' | 'CLOSED_PERMANENTLY' | 'CLOSED_TEMPORARILY' }
 * - attributes: [{ attributeId, values }]
 * - address: { addressLines, locality, administrativeArea, postalCode, regionCode }
 * - phoneNumbers: { primaryPhone }
 * - websiteUri
 * - title (business name)
 * - categories: { primaryCategory: { displayName } }
 */

export interface GBPLocation {
  name: string;                     // "locations/12345678"
  title?: string;                   // Business name
  phoneNumbers?: {
    primaryPhone?: string;
  };
  websiteUri?: string;
  address?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    regionCode?: string;
  };
  regularHours?: {
    periods: GBPHoursPeriod[];
  };
  openInfo?: {
    status?: 'OPEN' | 'CLOSED_PERMANENTLY' | 'CLOSED_TEMPORARILY';
  };
  attributes?: GBPAttribute[];
  categories?: {
    primaryCategory?: { displayName?: string };
    additionalCategories?: { displayName?: string }[];
  };
}

export interface GBPHoursPeriod {
  openDay: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  openTime: { hours: number; minutes: number };
  closeDay: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  closeTime: { hours: number; minutes: number };
}

export interface GBPAttribute {
  attributeId: string;   // e.g. "has_wifi", "has_outdoor_seating", "has_parking"
  values: (string | boolean | number)[];
}

export interface MappedLocationData {
  /** Business name from GBP */
  name?: string;
  /** Normalized phone */
  phone?: string;
  /** Website URL */
  website?: string;
  /** Street address */
  address?: string;
  /** City */
  city?: string;
  /** State */
  state?: string;
  /** Zip */
  zip?: string;
  /**
   * hours_data format (LocalVector canonical):
   * { monday: { open: "09:00", close: "22:00", closed: false }, ... }
   * Days with no period → { closed: true }
   */
  hours_data?: Record<string, { open: string; close: string; closed: boolean }>;
  /**
   * operational_status: 'open' | 'closed_permanently' | 'closed_temporarily' | null
   */
  operational_status?: string | null;
  /**
   * amenities: { wifi: true, outdoor_seating: true, parking: false, ... }
   * Only include attributes with truthy boolean values.
   */
  amenities?: Record<string, boolean>;
  /** Primary category from GBP */
  primary_category?: string;
}

/**
 * Maps a raw GBP API Location object to LocalVector's location schema.
 * Pure function — no side effects.
 * Partial: only sets fields that exist in the GBP response.
 * Never overwrites with null if the GBP field is absent.
 */
export function mapGBPToLocation(gbpLocation: GBPLocation): MappedLocationData { ... }

/**
 * Maps GBP regularHours periods to LocalVector hours_data format.
 * GBP uses day-of-week strings; LocalVector uses lowercase day keys.
 * Multi-day spans (e.g., open Mon–Fri) are expanded to individual days.
 * Missing days default to { closed: true }.
 */
export function mapHours(periods: GBPHoursPeriod[]): Record<string, { open: string; close: string; closed: boolean }> { ... }

/**
 * Maps GBP openInfo.status to LocalVector operational_status.
 * 'OPEN' → 'open'
 * 'CLOSED_PERMANENTLY' → 'closed_permanently'
 * 'CLOSED_TEMPORARILY' → 'closed_temporarily'
 * undefined/null → null
 */
export function mapOperationalStatus(status: string | undefined): string | null { ... }

/**
 * Maps GBP attributes array to LocalVector amenities record.
 * Only includes known amenity attributeIds (see KNOWN_AMENITY_ATTRIBUTES).
 * Only includes attributes with a truthy boolean value.
 */
export function mapAmenities(attributes: GBPAttribute[]): Record<string, boolean> { ... }

/**
 * Formats time from GBP's { hours, minutes } to "HH:MM" string.
 * Pads single-digit hours/minutes with leading zero.
 */
export function formatTime(time: { hours: number; minutes: number }): string { ... }

/**
 * Known GBP attribute IDs mapped to LocalVector amenity keys.
 * Extend as new GBP attributes are discovered.
 */
export const KNOWN_AMENITY_ATTRIBUTES: Record<string, string> = {
  'has_wifi':                   'wifi',
  'wi_fi':                      'wifi',
  'has_outdoor_seating':        'outdoor_seating',
  'outdoor_seating':            'outdoor_seating',
  'has_parking':                'parking',
  'parking':                    'parking',
  'has_valet_parking':          'valet_parking',
  'serves_alcohol':             'alcohol',
  'has_bar':                    'bar',
  'has_live_music':             'live_music',
  'has_happy_hour':             'happy_hour',
  'accepts_reservations':       'reservations',
  'has_takeout':                'takeout',
  'has_delivery':               'delivery',
  'has_dine_in':                'dine_in',
  'wheelchair_accessible_entrance': 'wheelchair_accessible',
};

/**
 * Day name normalization: GBP 'MONDAY' → LocalVector 'monday'
 */
export const GBP_DAY_MAP: Record<GBPHoursPeriod['openDay'], string> = {
  MONDAY:    'monday',
  TUESDAY:   'tuesday',
  WEDNESDAY: 'wednesday',
  THURSDAY:  'thursday',
  FRIDAY:    'friday',
  SATURDAY:  'saturday',
  SUNDAY:    'sunday',
};
```

**Implementation rules for `mapHours()`:**
- All 7 days must always be present in the output (default `{ closed: true }` if not in GBP periods)
- GBP period `closeTime: { hours: 0, minutes: 0 }` on the next day = midnight close → store as `"00:00"` with `closeDay`
- A period with `openDay !== closeDay` spans overnight → treat as: openDay closes at "00:00", closeDay opens at "00:00" and closes at actual closeTime. If unsure, fall back to raw string and document.
- Time format: `"09:00"`, `"22:30"`, `"00:00"` (24-hour, zero-padded)

---

### Component 2: GBP Import API Route — `app/api/gbp/import/route.ts`

**Authenticated POST endpoint.** Called by the frontend when user triggers import. Uses `createClient()` (user session) for auth + `createServiceRoleClient()` for the upsert.

```typescript
/**
 * POST /api/gbp/import
 * 
 * Fetches the authenticated user's GBP location data via stored tokens,
 * maps it through gbp-data-mapper.ts, and upserts into the locations table.
 * 
 * Flow:
 * 1. Verify user session (getSafeAuthContext or getUser)
 * 2. Fetch gbp_connections row for org_id
 * 3. Check token expiry — if expired, attempt refresh (or return 401 with "token_expired" code)
 * 4. Call GBP API: GET https://mybusinessbusinessinformation.googleapis.com/v1/{name}?readMask=...
 * 5. Map response via mapGBPToLocation()
 * 6. Upsert mapped data into locations for this org (update, not insert — location already exists from onboarding)
 * 7. Return { ok: true, mapped: MappedLocationData, location_id: string }
 * 
 * Error codes returned in JSON:
 * - "not_connected"  — no gbp_connections row for this org
 * - "token_expired"  — access token expired, refresh failed
 * - "gbp_api_error"  — GBP API returned non-200
 * - "no_location"    — org has no location row to update
 * - "upsert_failed"  — Supabase error on update
 */
export async function POST(request: Request) { ... }
```

**GBP API call specifics:**
```typescript
const GBP_READ_MASK = [
  'name',
  'title',
  'phoneNumbers',
  'websiteUri',
  'storefrontAddress',
  'regularHours',
  'openInfo',
  'attributes',
  'categories',
].join(',');

const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${gbpConnection.gbp_location_id}?readMask=${GBP_READ_MASK}`;
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${gbpConnection.access_token}` },
});
```

**Token refresh logic:**
```typescript
if (isTokenExpired(gbpConnection.expires_at)) {
  const refreshed = await refreshGBPToken(gbpConnection.refresh_token);
  if (!refreshed.ok) {
    return NextResponse.json({ error: 'token_expired' }, { status: 401 });
  }
  // Update gbp_connections with new token before proceeding
}
```

**Upsert pattern (update existing location, don't insert):**
```typescript
// Get existing location for org
const { data: location } = await supabaseServiceRole
  .from('locations')
  .select('id')
  .eq('org_id', orgId)
  .order('created_at', { ascending: true })
  .limit(1)
  .single();

if (!location) {
  return NextResponse.json({ error: 'no_location' }, { status: 404 });
}

const { error } = await supabaseServiceRole
  .from('locations')
  .update({
    ...mapped,
    gbp_synced_at: new Date().toISOString(),
  })
  .eq('id', location.id);
```

**Add `gbp_synced_at` column:** See migration Component 7.

---

### Component 3: GBP Token Refresh Utility — `lib/gbp/gbp-token-refresh.ts`

**Utility for refreshing expired GBP OAuth tokens.** Shared between the import route and the future cron (Sprint 90).

```typescript
/**
 * Refreshes a GBP OAuth access token using the refresh token.
 * Updates gbp_connections in the DB with new tokens.
 * Returns { ok: true, access_token, expires_at } on success.
 * Returns { ok: false, error } on failure.
 * 
 * Uses GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from env.
 */
export async function refreshGBPToken(
  supabase: ReturnType<typeof createServiceRoleClient>,
  orgId: string,
  refreshToken: string,
): Promise<{ ok: true; access_token: string; expires_at: string } | { ok: false; error: string }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    return { ok: false, error: err.error_description ?? 'refresh_failed' };
  }

  const data = await response.json();
  const expires_at = new Date(Date.now() + data.expires_in * 1000).toISOString();

  // Update DB
  await supabase
    .from('gbp_connections')
    .update({ access_token: data.access_token, expires_at })
    .eq('org_id', orgId);

  return { ok: true, access_token: data.access_token, expires_at };
}

/**
 * Returns true if the token expires within the next 5 minutes.
 */
export function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  const BUFFER_MS = 5 * 60 * 1000;
  return new Date(expiresAt).getTime() - BUFFER_MS < Date.now();
}
```

---

### Component 4: GBP Import Client Action — `app/actions/gbp-import.ts`

**Server Action** that the onboarding wizard and settings page both call to trigger the import.

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import type { MappedLocationData } from '@/lib/gbp/gbp-data-mapper';

export interface GBPImportResult {
  ok: boolean;
  mapped?: MappedLocationData;
  location_id?: string;
  error?: string;
  error_code?: 'not_connected' | 'token_expired' | 'gbp_api_error' | 'no_location' | 'upsert_failed';
}

/**
 * Server Action — triggers GBP data import for the current user's org.
 * Calls POST /api/gbp/import internally via fetch.
 * Can be called from onboarding wizard or settings page.
 */
export async function triggerGBPImport(): Promise<GBPImportResult> { ... }
```

---

### Component 5: Onboarding GBP Interstitial — Update `app/onboarding/page.tsx`

Read the current onboarding page carefully before modifying. Add a GBP import step/interstitial that:

1. **Appears after** the GBP Connect step (or after Step 1 if GBP is already connected)
2. **Checks** if the org has a `gbp_connections` row with valid tokens
3. **If connected:** Shows "Import from Google Business Profile" CTA — one big button
4. **If not connected:** Shows "Skip for now — enter manually" link and continues to manual wizard
5. **On import success:** Shows a confirmation card with imported data preview (name, hours, phone) → auto-advances to next step
6. **On import failure:** Shows error message with specific guidance based on `error_code`, falls back to manual entry

**UI spec for the GBP interstitial step:**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│  🚀 Your Google Business Profile is connected!                   │
│                                                                   │
│  We can import your business info automatically.                 │
│  Hours, phone, address, and amenities — in one click.            │
│                                                                   │
│  ┌─────────────────────────────────────────────────────┐         │
│  │     ✨ Import from Google Business Profile           │         │
│  │        (takes < 5 seconds)                           │         │
│  └─────────────────────────────────────────────────────┘         │
│                                                                   │
│  Or  → Enter my info manually                                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

[After successful import:]
┌─────────────────────────────────────────────────────────────────┐
│  ✅ Imported Successfully!                                        │
│                                                                   │
│  📍 Charcoal N Chill                                             │
│  📞 (470) 555-0123                                               │
│  🕐 Mon–Thu 5pm–12am, Fri–Sat 5pm–2am, Sun Closed              │
│  ✨ WiFi · Outdoor Seating · Full Bar                            │
│                                                                   │
│  [Continue to Dashboard →]                                       │
│                                                                   │
│  Need to make changes? You can edit anytime in Settings.         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation rules:**
- `'use client'` component — uses `useState` for import status: `'idle' | 'importing' | 'success' | 'error'`
- Call `triggerGBPImport()` server action on button click
- Show a spinner during `'importing'` state
- Auto-advance to next onboarding step 2 seconds after successful import
- All error states show human-readable messages (no raw error codes visible to user)
- Check GBP connection status server-side at page load, pass as prop

---

### Component 6: Import Progress Card — `app/dashboard/_components/GBPImportCard.tsx`

**Compact card** for the main dashboard, visible to Growth+ plan users who have GBP connected but haven't imported yet (or whose import is stale > 30 days).

```
┌─────────────────────────────────────────────────────┐
│  📊 Google Business Profile                          │
│                                                      │
│  Connected · Last synced 3 days ago                  │
│  [Sync Now →]                                        │
│                                                      │
│  OR (if never synced):                               │
│                                                      │
│  Connected · Never synced                            │
│  [Import Your Business Data →]                       │
└─────────────────────────────────────────────────────┘
```

- Show only to users with `gbp_connections` row and Growth+ plan
- Plan-gate behind `checkPlan('growth')` from `lib/plan-enforcer.ts`
- Import button triggers `triggerGBPImport()` with inline loading state
- On success, show toast and refresh dashboard data

---

### Component 7: Migration — `supabase/migrations/YYYYMMDDHHMMSS_locations_gbp_sync.sql`

**Use the current timestamp for the migration filename** (format: `YYYYMMDDHHmmss`). Read `supabase/migrations/` to find the correct next timestamp pattern.

```sql
-- Sprint 89: Add gbp_synced_at to locations for tracking last GBP import
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS gbp_synced_at timestamptz;

-- Index for dashboard queries: "show locations synced > 30 days ago"
CREATE INDEX IF NOT EXISTS idx_locations_gbp_synced_at
  ON public.locations (org_id, gbp_synced_at)
  WHERE gbp_synced_at IS NOT NULL;

COMMENT ON COLUMN public.locations.gbp_synced_at IS 
  'Timestamp of last successful GBP data import. NULL = never synced. Sprint 89.';
```

**Update `prod_schema.sql`:** Add `gbp_synced_at timestamptz` to the `locations` CREATE TABLE definition.

**Update `database.types.ts`:** Add `gbp_synced_at: string | null` to `locations` Row/Insert/Update types.

---

### Component 8: Seed Data — `supabase/seed.sql`

Add a seed row to represent a GBP-synced state for Charcoal N Chill (the golden tenant):

```sql
-- ══════════════════════════════════════════════════════════════
-- Sprint 89: Update golden tenant location with GBP-mapped data
-- ══════════════════════════════════════════════════════════════
-- Updates the existing Charcoal N Chill location with realistic
-- hours_data, operational_status, amenities, and gbp_synced_at.

UPDATE public.locations
SET
  hours_data = '{
    "monday":    {"open": "17:00", "close": "00:00", "closed": false},
    "tuesday":   {"open": "17:00", "close": "00:00", "closed": false},
    "wednesday": {"open": "17:00", "close": "00:00", "closed": false},
    "thursday":  {"open": "17:00", "close": "00:00", "closed": false},
    "friday":    {"open": "17:00", "close": "02:00", "closed": false},
    "saturday":  {"open": "17:00", "close": "02:00", "closed": false},
    "sunday":    {"open": "00:00", "close": "00:00", "closed": true}
  }'::jsonb,
  operational_status = 'open',
  amenities = '{
    "wifi": true,
    "outdoor_seating": true,
    "alcohol": true,
    "bar": true,
    "live_music": true,
    "reservations": true,
    "dine_in": true
  }'::jsonb,
  gbp_synced_at = NOW() - INTERVAL '3 days'
WHERE org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
```

---

### Component 9: Golden Tenant Fixtures — `src/__fixtures__/golden-tenant.ts`

Add the following exports to the golden tenant file:

```typescript
/**
 * Sprint 89 — Mock raw GBP API Location response for Charcoal N Chill.
 * Matches the GBPLocation interface in lib/gbp/gbp-data-mapper.ts.
 */
export const MOCK_GBP_LOCATION = {
  name: 'locations/123456789',
  title: 'Charcoal N Chill',
  phoneNumbers: { primaryPhone: '+14705550123' },
  websiteUri: 'https://charcoalnchill.com',
  address: {
    addressLines: ['11950 Jones Bridge Rd', 'Suite 103'],
    locality: 'Alpharetta',
    administrativeArea: 'GA',
    postalCode: '30005',
    regionCode: 'US',
  },
  regularHours: {
    periods: [
      { openDay: 'MONDAY',    openTime: { hours: 17, minutes: 0 }, closeDay: 'TUESDAY',   closeTime: { hours: 0, minutes: 0 } },
      { openDay: 'TUESDAY',   openTime: { hours: 17, minutes: 0 }, closeDay: 'WEDNESDAY', closeTime: { hours: 0, minutes: 0 } },
      { openDay: 'WEDNESDAY', openTime: { hours: 17, minutes: 0 }, closeDay: 'THURSDAY',  closeTime: { hours: 0, minutes: 0 } },
      { openDay: 'THURSDAY',  openTime: { hours: 17, minutes: 0 }, closeDay: 'FRIDAY',    closeTime: { hours: 0, minutes: 0 } },
      { openDay: 'FRIDAY',    openTime: { hours: 17, minutes: 0 }, closeDay: 'SATURDAY',  closeTime: { hours: 2, minutes: 0 } },
      { openDay: 'SATURDAY',  openTime: { hours: 17, minutes: 0 }, closeDay: 'SUNDAY',    closeTime: { hours: 2, minutes: 0 } },
    ],
  },
  openInfo: { status: 'OPEN' },
  attributes: [
    { attributeId: 'has_wifi',             values: [true] },
    { attributeId: 'has_outdoor_seating',  values: [true] },
    { attributeId: 'serves_alcohol',       values: [true] },
    { attributeId: 'has_live_music',       values: [true] },
    { attributeId: 'accepts_reservations', values: [true] },
    { attributeId: 'has_dine_in',          values: [true] },
  ],
  categories: {
    primaryCategory: { displayName: 'Hookah Bar' },
  },
} as const;

/**
 * Sprint 89 — Expected MappedLocationData output for MOCK_GBP_LOCATION.
 * This is the canonical expected output for mapper tests.
 */
export const MOCK_GBP_MAPPED: import('@/lib/gbp/gbp-data-mapper').MappedLocationData = {
  name: 'Charcoal N Chill',
  phone: '+14705550123',
  website: 'https://charcoalnchill.com',
  address: '11950 Jones Bridge Rd, Suite 103',
  city: 'Alpharetta',
  state: 'GA',
  zip: '30005',
  operational_status: 'open',
  hours_data: {
    monday:    { open: '17:00', close: '00:00', closed: false },
    tuesday:   { open: '17:00', close: '00:00', closed: false },
    wednesday: { open: '17:00', close: '00:00', closed: false },
    thursday:  { open: '17:00', close: '00:00', closed: false },
    friday:    { open: '17:00', close: '02:00', closed: false },
    saturday:  { open: '17:00', close: '02:00', closed: false },
    sunday:    { open: '00:00', close: '00:00', closed: true  },
  },
  amenities: {
    wifi: true,
    outdoor_seating: true,
    alcohol: true,
    live_music: true,
    reservations: true,
    dine_in: true,
  },
  primary_category: 'Hookah Bar',
};
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/gbp-data-mapper.test.ts`

**Target: `lib/gbp/gbp-data-mapper.ts`**
**Pure functions — zero mocks needed.**

```
describe('mapGBPToLocation')
  1.  maps business name from title
  2.  maps primary phone number
  3.  maps website URI
  4.  maps full address (addressLines joined, locality, state, zip)
  5.  maps operational_status 'OPEN' → 'open'
  6.  maps operational_status 'CLOSED_PERMANENTLY' → 'closed_permanently'
  7.  maps operational_status 'CLOSED_TEMPORARILY' → 'closed_temporarily'
  8.  maps operational_status undefined → null
  9.  maps known amenity attributes to boolean amenities record
  10. ignores unknown/unrecognized attribute IDs
  11. maps primary category displayName
  12. handles missing optional fields gracefully (no undefined in output)
  13. maps full MOCK_GBP_LOCATION → matches MOCK_GBP_MAPPED exactly

describe('mapHours')
  14. returns all 7 days in output (even if only some in GBP periods)
  15. maps MONDAY openTime {hours:17, minutes:0} → open: "17:00"
  16. maps closeTime {hours:0, minutes:0} → close: "00:00" (midnight close)
  17. days absent from periods default to { closed: true }
  18. Sunday-closed scenario: no SUNDAY period → { closed: true }
  19. maps full Charcoal N Chill hours to MOCK_GBP_MAPPED.hours_data
  20. formats single-digit hours with leading zero ("09:00" not "9:00")
  21. formats minutes with leading zero ("09:05" not "9:5")

describe('mapOperationalStatus')
  22. 'OPEN' → 'open'
  23. 'CLOSED_PERMANENTLY' → 'closed_permanently'
  24. 'CLOSED_TEMPORARILY' → 'closed_temporarily'
  25. undefined → null
  26. null → null
  27. unknown string → null

describe('mapAmenities')
  28. 'has_wifi' with [true] → { wifi: true }
  29. 'has_wifi' with [false] → does NOT include wifi (omit falsy)
  30. 'has_outdoor_seating' maps correctly
  31. 'serves_alcohol' maps correctly
  32. unknown attributeId is ignored
  33. empty attributes array → empty object {}
  34. maps all 6 Charcoal N Chill attributes correctly

describe('formatTime')
  35. {hours:9, minutes:0} → "09:00"
  36. {hours:17, minutes:30} → "17:30"
  37. {hours:0, minutes:0} → "00:00"
  38. {hours:23, minutes:59} → "23:59"
  39. {hours:9, minutes:5} → "09:05"
```

**39 tests total. Zero mocks — pure function.**

---

### Test File 2: `src/__tests__/unit/gbp-import-route.test.ts`

**Target: `app/api/gbp/import/route.ts`**

```
describe('POST /api/gbp/import')
  1.  returns 401 when user is not authenticated
  2.  returns 404 with error_code "not_connected" when no gbp_connections row
  3.  returns 401 with error_code "token_expired" when token expired + refresh fails
  4.  refreshes expired token before GBP API call when refresh succeeds
  5.  calls GBP API with correct Authorization header and readMask
  6.  returns 502 with error_code "gbp_api_error" when GBP API returns non-200
  7.  returns 404 with error_code "no_location" when org has no locations row
  8.  calls mapGBPToLocation with GBP API response
  9.  upserts mapped data into locations table
  10. includes gbp_synced_at timestamp in the upsert
  11. returns { ok: true, mapped, location_id } on success
  12. returns 500 with error_code "upsert_failed" when Supabase update fails
```

**12 tests total.**

**Mock requirements:**
```typescript
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));
vi.mock('@/lib/gbp/gbp-data-mapper', () => ({
  mapGBPToLocation: vi.fn().mockReturnValue(MOCK_GBP_MAPPED),
}));
vi.mock('@/lib/gbp/gbp-token-refresh', () => ({
  isTokenExpired: vi.fn().mockReturnValue(false),
  refreshGBPToken: vi.fn(),
}));

// Mock global fetch for GBP API call
global.fetch = vi.fn();
```

Build mock Supabase clients using chained builder pattern. Auth client returns mock user session. Service role client handles:
- `.from('gbp_connections').select().eq('org_id').single()` → mock GBP connection
- `.from('locations').select('id').eq('org_id').order().limit().single()` → mock location
- `.from('locations').update(...).eq('id')` → success or error

---

### Test File 3: `src/__tests__/unit/gbp-token-refresh.test.ts`

**Target: `lib/gbp/gbp-token-refresh.ts`**

```
describe('isTokenExpired')
  1.  returns true when expiresAt is null
  2.  returns true when expiresAt is in the past
  3.  returns true when token expires within 5 minutes
  4.  returns false when token expires in > 5 minutes
  5.  returns false when token expires exactly 10 minutes from now

describe('refreshGBPToken')
  6.  calls Google OAuth token endpoint with correct params
  7.  returns { ok: false } when Google returns 400 (invalid_grant)
  8.  returns { ok: true, access_token, expires_at } on success
  9.  updates gbp_connections with new token in DB on success
  10. expires_at is calculated from expires_in response field
```

**10 tests total.**

**Mock requirements:**
```typescript
global.fetch = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(),
}));
// Set env vars
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
```

---

### Test File 4 (Playwright E2E): `src/__tests__/e2e/gbp-import-flow.spec.ts`

**Target: Full onboarding GBP import flow + settings page import**

**Setup requirements:**
- Use existing Playwright config (check `playwright.config.ts`)
- Use `page.route()` to intercept and mock external GBP API calls — NEVER call real Google APIs in tests
- Seed the database with golden tenant data before each test (or use test fixtures)
- Test against local dev server (`baseURL` from playwright config)

```typescript
import { test, expect } from '@playwright/test';

// Mock the internal GBP import API to return success without hitting real GBP
const mockImportSuccess = async (page: Page) => {
  await page.route('**/api/gbp/import', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        location_id: 'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        mapped: MOCK_GBP_MAPPED,
      }),
    });
  });
};

describe('GBP Import — Onboarding Flow', () => {
  test('shows GBP interstitial when GBP is connected', async ({ page }) => {
    // Setup: log in as golden tenant user, mock GBP connected state
    // Navigate to onboarding
    // Assert: GBP interstitial step is visible
    // Assert: "Import from Google Business Profile" button exists
  });

  test('imports successfully and shows confirmation card', async ({ page }) => {
    // Setup: mock /api/gbp/import to return success + MOCK_GBP_MAPPED
    // Click import button
    // Assert: spinner shows during import
    // Assert: confirmation card appears with business name "Charcoal N Chill"
    // Assert: hours summary is displayed
    // Assert: "Continue to Dashboard" button appears
  });

  test('shows error message when import fails with token_expired', async ({ page }) => {
    // Setup: mock /api/gbp/import to return 401 with error_code "token_expired"
    // Click import button
    // Assert: error message mentions reconnecting GBP
    // Assert: "Enter manually" fallback link is visible
  });

  test('shows error message when import fails with gbp_api_error', async ({ page }) => {
    // Setup: mock /api/gbp/import to return 502 with error_code "gbp_api_error"
    // Click import button
    // Assert: generic error message appears
    // Assert: "Enter manually" fallback link is visible
  });

  test('skipping GBP import proceeds to manual onboarding', async ({ page }) => {
    // Click "Enter my info manually"
    // Assert: manual wizard form appears (hours fields or business info form)
  });
});

describe('GBP Import — Dashboard Settings Card', () => {
  test('GBPImportCard shows "Sync Now" when previously synced', async ({ page }) => {
    // Navigate to /dashboard
    // Assert: GBPImportCard is visible (if Growth+ plan)
    // Assert: "Last synced X days ago" text appears
    // Assert: "Sync Now" button exists
  });

  test('GBPImportCard shows "Import" CTA when never synced', async ({ page }) => {
    // Setup: golden tenant with gbp_synced_at = null
    // Navigate to /dashboard
    // Assert: "Import Your Business Data" button visible
  });

  test('GBPImportCard not visible to Starter plan users', async ({ page }) => {
    // Setup: Starter plan user with GBP connected
    // Navigate to /dashboard
    // Assert: GBPImportCard is NOT in the DOM (plan gated)
  });
});
```

**Total Playwright tests: 8**

**Critical Playwright rules:**
- Always mock `/api/gbp/import` with `page.route()` — never allow real GBP API calls
- Use `page.waitForSelector()` with explicit timeouts for async UI states (importing spinner, success card)
- Auth: use existing Playwright auth helpers from the project (check `src/__tests__/e2e/helpers/` or `playwright.config.ts` for `storageState`)
- If auth helpers don't exist, create a minimal `src/__tests__/e2e/helpers/auth.ts` with a `loginAsGoldenTenant()` helper
- Never use `page.waitForTimeout()` — use `page.waitForSelector()` or `page.waitForResponse()` instead
- All selectors use `data-testid` attributes (add `data-testid="gbp-import-btn"`, `data-testid="gbp-import-success"`, etc. to the onboarding component)
- If running in CI without a real DB, use `page.route()` to mock Supabase API calls too

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/gbp/gbp-data-mapper.ts` | **CREATE** | Pure GBP → LocationData mapper |
| 2 | `lib/gbp/gbp-token-refresh.ts` | **CREATE** | Token expiry check + refresh utility |
| 3 | `app/api/gbp/import/route.ts` | **CREATE** | Authenticated import endpoint |
| 4 | `app/actions/gbp-import.ts` | **CREATE** | Server Action wrapper |
| 5 | `app/onboarding/page.tsx` | **MODIFY** | Add GBP interstitial step |
| 6 | `app/dashboard/_components/GBPImportCard.tsx` | **CREATE** | Dashboard card |
| 7 | `app/dashboard/page.tsx` | **MODIFY** | Add GBPImportCard to Growth+ users |
| 8 | `supabase/migrations/[timestamp]_locations_gbp_sync.sql` | **CREATE** | Add gbp_synced_at |
| 9 | `supabase/prod_schema.sql` | **MODIFY** | Add gbp_synced_at to locations |
| 10 | `lib/supabase/database.types.ts` | **MODIFY** | Add gbp_synced_at to locations types |
| 11 | `supabase/seed.sql` | **MODIFY** | Update golden tenant with GBP data |
| 12 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | Add MOCK_GBP_LOCATION + MOCK_GBP_MAPPED |
| 13 | `src/__tests__/unit/gbp-data-mapper.test.ts` | **CREATE** | 39 unit tests — pure mapper |
| 14 | `src/__tests__/unit/gbp-import-route.test.ts` | **CREATE** | 12 unit tests — import route |
| 15 | `src/__tests__/unit/gbp-token-refresh.test.ts` | **CREATE** | 10 unit tests — token refresh |
| 16 | `src/__tests__/e2e/gbp-import-flow.spec.ts` | **CREATE** | 8 Playwright e2e tests |

---

## 🚫 What NOT to Do

1. **DO NOT call the real GBP API in any test** — all GBP API calls are mocked via `global.fetch` (Vitest) or `page.route()` (Playwright).
2. **DO NOT store raw GBP JSON in the database** — always map through `mapGBPToLocation()` before upserting.
3. **DO NOT use `createServiceRoleClient()` inside the Server Action** — use it only in the API route and the token refresh utility.
4. **DO NOT overwrite existing `hours_data` with null** if GBP returns no `regularHours` — skip the field entirely.
5. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2) — use `as unknown as SupabaseClient<Database>`.
6. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12) — use literal class strings for status colors.
7. **DO NOT create a new `locations` row** — only UPDATE the existing one. Orgs always have exactly one location after onboarding.
8. **DO NOT add `'use client'` to the API route or Server Action** — these are server-only.
9. **DO NOT plan-gate the onboarding interstitial** — if they're in onboarding, they need to see the GBP option regardless of plan. Plan-gate only the dashboard card (Growth+).
10. **DO NOT use `page.waitForTimeout()` in Playwright tests** — use event-driven waits only.
11. **DO NOT edit `middleware.ts`** (AI_RULES §6) — all middleware logic lives in `proxy.ts`.
12. **DO NOT use dynamic `import()` inside Server Actions** — keep imports static at file top.

---

## ✅ Definition of Done (AI_RULES §13.5)

- [ ] `lib/gbp/gbp-data-mapper.ts` — Pure mapper, all 5 exports implemented, handles all edge cases
- [ ] `lib/gbp/gbp-token-refresh.ts` — `isTokenExpired()` and `refreshGBPToken()` implemented
- [ ] `app/api/gbp/import/route.ts` — Auth, token refresh, GBP fetch, map, upsert, all error codes
- [ ] `app/actions/gbp-import.ts` — Server Action wrapper calling import route
- [ ] `app/onboarding/page.tsx` — GBP interstitial step: idle, importing, success, error states, manual fallback
- [ ] `app/dashboard/_components/GBPImportCard.tsx` — Plan-gated (Growth+), sync CTA, inline loading
- [ ] `app/dashboard/page.tsx` — GBPImportCard added to appropriate section
- [ ] Migration `[timestamp]_locations_gbp_sync.sql` — `gbp_synced_at` column + index
- [ ] `prod_schema.sql` updated with `gbp_synced_at`
- [ ] `database.types.ts` updated with `gbp_synced_at: string | null`
- [ ] `seed.sql` updated with Charcoal N Chill hours/amenities/status
- [ ] `golden-tenant.ts` exports `MOCK_GBP_LOCATION` and `MOCK_GBP_MAPPED`
- [ ] `data-testid` attributes added to all interactive elements in onboarding interstitial and GBPImportCard
- [ ] `npx vitest run src/__tests__/unit/gbp-data-mapper.test.ts` — **39 tests passing**
- [ ] `npx vitest run src/__tests__/unit/gbp-import-route.test.ts` — **12 tests passing**
- [ ] `npx vitest run src/__tests__/unit/gbp-token-refresh.test.ts` — **10 tests passing**
- [ ] `npx vitest run` — ALL tests passing, zero regressions
- [ ] `npx playwright test src/__tests__/e2e/gbp-import-flow.spec.ts` — **8 tests passing**
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] DEVLOG.md entry written (see format below)

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## 2026-02-28 — Sprint 89: GBP Data Import — Full Mapping Pipeline (Completed)

**Goal:** Complete the GBP data import pipeline. OAuth was connected (Sprint 57B) but no data flowed into the system. This sprint closes the loop: connect → fetch → map → upsert → populated dashboard.

**Scope:**
- `lib/gbp/gbp-data-mapper.ts` — **NEW.** Pure GBP → LocationData mapper. Exports: `mapGBPToLocation()`, `mapHours()`, `mapOperationalStatus()`, `mapAmenities()`, `formatTime()`, `KNOWN_AMENITY_ATTRIBUTES`, `GBP_DAY_MAP`. Handles all 7 days, midnight closes, unknown attributes.
- `lib/gbp/gbp-token-refresh.ts` — **NEW.** Token utility. `isTokenExpired()` (5-min buffer), `refreshGBPToken()` (OAuth token endpoint + DB update).
- `app/api/gbp/import/route.ts` — **NEW.** Authenticated POST endpoint. Auth → token check → GBP fetch (readMask) → map → upsert with gbp_synced_at. Error codes: not_connected, token_expired, gbp_api_error, no_location, upsert_failed.
- `app/actions/gbp-import.ts` — **NEW.** Server Action wrapper for triggerGBPImport().
- `app/onboarding/page.tsx` — **MODIFIED.** GBP interstitial step added. States: idle, importing (spinner), success (data preview card), error (error_code-specific message + manual fallback). data-testid attributes on all interactive elements.
- `app/dashboard/_components/GBPImportCard.tsx` — **NEW.** Growth+ plan gated. Shows last sync time or "never synced" CTA. Inline loading on Sync Now.
- `app/dashboard/page.tsx` — **MODIFIED.** GBPImportCard added to dashboard for Growth+ users.
- `supabase/migrations/[timestamp]_locations_gbp_sync.sql` — **NEW.** Adds gbp_synced_at timestamptz + index.
- `supabase/prod_schema.sql` — **MODIFIED.** Added gbp_synced_at to locations.
- `lib/supabase/database.types.ts` — **MODIFIED.** Added gbp_synced_at to locations Row/Insert/Update.
- `supabase/seed.sql` — **MODIFIED.** Updated Charcoal N Chill location with realistic hours_data, operational_status, amenities, gbp_synced_at.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added MOCK_GBP_LOCATION and MOCK_GBP_MAPPED.

**Tests added:**
- `src/__tests__/unit/gbp-data-mapper.test.ts` — **39 Vitest tests.** Pure function tests: mapGBPToLocation (13), mapHours (8), mapOperationalStatus (6), mapAmenities (7), formatTime (5).
- `src/__tests__/unit/gbp-import-route.test.ts` — **12 Vitest tests.** Auth guard, error codes, GBP fetch mock, upsert, token refresh.
- `src/__tests__/unit/gbp-token-refresh.test.ts` — **10 Vitest tests.** isTokenExpired (5), refreshGBPToken (5).
- `src/__tests__/e2e/gbp-import-flow.spec.ts` — **8 Playwright tests.** Onboarding interstitial (5), dashboard card (3). All GBP API calls mocked via page.route().

**Run commands:**
```bash
npx vitest run src/__tests__/unit/gbp-data-mapper.test.ts     # 39 tests
npx vitest run src/__tests__/unit/gbp-import-route.test.ts    # 12 tests
npx vitest run src/__tests__/unit/gbp-token-refresh.test.ts   # 10 tests
npx vitest run                                                  # All unit tests — no regressions
npx playwright test src/__tests__/e2e/gbp-import-flow.spec.ts # 8 e2e tests
npx tsc --noEmit                                                # 0 new type errors
```
```

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| GBP OAuth connect/disconnect | Sprint 57B | `gbp_connections` table with tokens, connect UI in settings |
| `locations` table with `hours_data`, `operational_status`, `amenities` | Phase 0–2 | Schema columns being populated by this sprint |
| `lib/plan-enforcer.ts` | Sprint 3 | Plan gating for Growth+ dashboard card |
| Onboarding page (current state) | Phase 4 | Wizard being modified — read carefully before touching |
| `createServiceRoleClient()` pattern | Sprint 18 | Required for INSERT/UPDATE bypassing RLS |
| Golden tenant fixtures | All sprints | Canonical test data — do not break existing exports |

---

## 🧠 Edge Cases to Handle

1. **GBP returns no `regularHours`:** `mapHours()` receives empty/undefined → all 7 days default to `{ closed: true }`. Do NOT write this to DB if field is absent in GBP response — skip the `hours_data` field in the update.
2. **GBP returns no `openInfo`:** `mapOperationalStatus()` receives undefined → returns `null`. Do NOT overwrite existing `operational_status` — only update if GBP provides it.
3. **Overnight hours spanning midnight:** e.g., openDay=FRIDAY closeDay=SATURDAY closeTime={hours:2}. Store as `friday: { open:"17:00", close:"02:00", closed:false }` with a comment noting the next-day close.
4. **Attribute values that are non-boolean:** Some GBP attributes have string enum values. `mapAmenities()` must only include attributes where `values[0] === true` (strict boolean).
5. **Token refresh race condition:** Two concurrent requests could both detect expiry and try to refresh. Accept this — the second refresh may fail gracefully. Do not over-engineer a mutex here.
6. **Org with multiple locations (Agency tier):** The import route must update the PRIMARY location (first created, `order('created_at', ascending: true)`). Multi-location import is Sprint 100.
7. **GBP API returns 403 (insufficient permissions):** The readMask might request fields the token doesn't have scope for. Return `gbp_api_error` with the specific GBP error message in the API response body so the user can re-authorize with correct scopes.
8. **User disconnects GBP mid-import:** The API route will return `not_connected`. The UI should handle this gracefully and show a reconnect prompt.
9. **Empty `addressLines`:** Some GBP locations omit `addressLines`. Fall back gracefully — address field becomes undefined, not a crash.

---

## 🔮 AI_RULES Update (Add to `AI_RULES.md`)

```markdown
## 41. 🗺️ GBP Data Mapping — Centralized in `lib/gbp/gbp-data-mapper.ts` (Sprint 89)

All Google Business Profile API response transformation is centralized in `lib/gbp/gbp-data-mapper.ts`. This is the single source of truth for GBP field mapping.

* **Rule:** Never inline GBP field transformation in API routes or actions. Always call `mapGBPToLocation()`.
* **Adding new fields:** Add to `GBPLocation` interface, add mapping in `mapGBPToLocation()`, add test in `gbp-data-mapper.test.ts`.
* **Adding amenities:** Append to `KNOWN_AMENITY_ATTRIBUTES` record. New entries automatically appear in import output.
* **Token refresh:** All token expiry checks and refreshes use `lib/gbp/gbp-token-refresh.ts`. Never inline OAuth token refresh calls.
```

---

## 📚 Document Sync + Git Commit (Run After All Tests Pass)

After all Vitest and Playwright tests pass and `npx tsc --noEmit` shows 0 errors, perform the following documentation sync and commit.

### Step 1: Update `/docs` files

**`docs/roadmap.md`** — Update Feature #53 (GBP Data Import) status from `🟡 30%` to `✅ 100%`. Add Sprint 89 completion note.

**`docs/09-BUILD-PLAN.md`** — Add Sprint 89 to the completed sprints list. Check off all Sprint 89 checkboxes if a checklist exists.

**`docs/MULTI-USER_AGENCY_WHITE_LABEL.md`** — No changes needed unless multi-location import scope changed.

**`docs/LocalVector-Master-Intelligence-Platform-Strategy.md`** — If this document tracks GBP pipeline status, update accordingly.

### Step 2: Update `DEVLOG.md`

Paste the DEVLOG entry from the **📓 DEVLOG Entry Format** section above. Replace `[timestamp]` with the actual migration filename used. Replace all `N` placeholders with verified test counts from running `grep -cE "^\s*(it|test)\("` on each test file (AI_RULES §13.3). Add actual Playwright test counts after running the suite.

### Step 3: Update `CLAUDE.md`

Add to the implementation inventory:
```markdown
### Sprint 89 — GBP Data Import (2026-02-28)
- `lib/gbp/gbp-data-mapper.ts` — Pure GBP → LocationData mapper
- `lib/gbp/gbp-token-refresh.ts` — Token expiry + refresh utility
- `app/api/gbp/import/route.ts` — Authenticated import endpoint
- `app/actions/gbp-import.ts` — Server Action trigger
- `app/onboarding/page.tsx` — GBP interstitial step (idle/importing/success/error)
- `app/dashboard/_components/GBPImportCard.tsx` — Growth+ dashboard card
- Migration: adds gbp_synced_at to locations
- Tests: 61 Vitest + 8 Playwright
```

### Step 4: Update `MEMORY.md`

Add a decision record:
```markdown
## Decision: GBP Import Architecture (Sprint 89 — 2026-02-28)
- Import uses a dedicated API route (`/api/gbp/import`) called by a Server Action, not inline in the onboarding wizard
- Token refresh happens inside the import route before the GBP API call
- Upsert pattern: UPDATE existing location row (never INSERT — orgs have exactly one location)
- Plan gating: onboarding interstitial = ungated; dashboard card = Growth+ only
- Primary location selection: first created (`order('created_at', ascending: true)`)
- Multi-location import deferred to Sprint 100
```

### Step 5: Update `AI_RULES.md`

Append Rule 41 from the **🔮 AI_RULES Update** section above.

### Step 6: Verify all files are in sync

Run this mental checklist before committing:
- [ ] `DEVLOG.md` has Sprint 89 entry with actual test counts (not "N")
- [ ] `CLAUDE.md` has Sprint 89 in implementation inventory
- [ ] `MEMORY.md` has GBP architecture decision
- [ ] `AI_RULES.md` has Rule 41
- [ ] `docs/roadmap.md` shows GBP Data Import as ✅ 100%
- [ ] `docs/09-BUILD-PLAN.md` has Sprint 89 checked

### Step 7: Git commit (recommended method)

```bash
# Stage all changes including untracked files
git add -A

# Verify staged files before committing
git status

# Commit with descriptive message
git commit -m "Sprint 89: GBP Data Import — Full mapping pipeline

- lib/gbp/gbp-data-mapper.ts: pure mapper (regularHours, openInfo, attributes, address)
- lib/gbp/gbp-token-refresh.ts: token expiry check + OAuth refresh
- app/api/gbp/import/route.ts: authenticated import endpoint (5 error codes)
- app/actions/gbp-import.ts: Server Action trigger
- app/onboarding: GBP interstitial (idle/importing/success/error states)
- app/dashboard: GBPImportCard (Growth+ plan gated)
- migration: adds gbp_synced_at to locations
- seed: Charcoal N Chill with realistic hours/amenities/status
- tests: 61 Vitest passing + 8 Playwright passing
- docs: roadmap Feature #53 → 100%, DEVLOG, CLAUDE.md, MEMORY.md, AI_RULES updated

Closes Gap #53. GBP connect → import → populated dashboard in < 60 seconds.
Unblocks Sprint 91 (Onboarding Wizard Completion)."

# Push to remote
git push origin main
```

**If the project uses a different branch strategy** (feature branches, PR workflow), substitute `main` with your branch name and open a PR accordingly. Do not force-push to main.

---

## 🏁 Sprint Outcome

After Sprint 89 completes:
- **GBP Data Import: 30% → 100%** (Gap #53 closed)
- New users who connect GBP during onboarding reach a populated dashboard with correct hours, phone, operational status, and amenities in < 60 seconds
- Charcoal N Chill (golden tenant) has realistic hours and amenities in seed data for all downstream test suites
- Token refresh utility is reused by Sprint 90 (GBP Token Refresh Cron) — no re-implementation needed
- 61 Vitest + 8 Playwright tests protect the pipeline against regression
