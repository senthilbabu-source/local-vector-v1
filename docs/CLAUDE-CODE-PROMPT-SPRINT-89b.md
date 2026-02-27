# Claude Code Prompt — Sprint 89: GBP Data Mapping + Import Flow

## ⚠️ READ BEFORE ANYTHING ELSE

Read these files in order BEFORE writing any code:
1. `docs/AI_RULES.md` — all rules. Critical for this sprint:
   - §1 (schema source of truth = `prod_schema.sql`)
   - §3 (RLS, `getSafeAuthContext()`, belt-and-suspenders `.eq('org_id', orgId)`)
   - §4 (tests first, golden tenant fixtures, mocking)
   - §5 (no API calls on page load)
   - §6 (Next.js 16 App Router, Tailwind v4, shadcn)
   - §12 (Tailwind literal classes — no dynamic concatenation)
   - §13 (DEVLOG format, verified test counts)
   - §18 (`createClient()` for pages, `createServiceRoleClient()` for service-role)
   - §20 (never hardcode placeholder metrics — propagate null)
   - §25 (`'use server'` files — all exports must be async)
   - §38 (database.types.ts, no `as any` on Supabase)
2. `docs/RFC_GBP_ONBOARDING_V2_REPLACEMENT.md` — **THE AUTHORITATIVE SPEC.** Read Sections 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 5.1–5.5. This sprint implements Phases 21a + 21b from Section 6.
3. `docs/DESIGN-SYSTEM.md` — color tokens, Deep Night aesthetic
4. `supabase/prod_schema.sql` — `locations`, `google_oauth_tokens`, `pending_gbp_imports`, `location_integrations` tables
5. `lib/supabase/database.types.ts` — Current types for all tables above
6. `app/api/auth/google/callback/route.ts` — **READ THE ENTIRE FILE.** This is the current callback (Sprint 57B). It stores tokens and redirects to `/dashboard/integrations`. Sprint 89 REPLACES this with the RFC §3.3 version that fetches locations + stores them in `pending_gbp_imports` + redirects to picker.
7. `app/api/auth/google/route.ts` — Current authorize route. Stays mostly unchanged.
8. `app/onboarding/page.tsx` — Current onboarding page. Will be modified to accept `?source=` query param for GBP fallback toasts.
9. `app/onboarding/_components/TruthCalibrationForm.tsx` — **DO NOT MODIFY.** The manual wizard stays as-is.
10. `app/onboarding/actions.ts` — `saveGroundTruth()` server action. Read to understand the SOV seeding hook at line 130.
11. `app/dashboard/layout.tsx` — OnboardingGuard. Read lines 64–76 to understand the redirect condition: `!hours_data && !amenities`.
12. `lib/types/ground-truth.ts` — `HoursData`, `DayOfWeek`, `DayHours`, `Amenities` types. The mapper MUST import these.
13. `src/__fixtures__/golden-tenant.ts` — golden tenant data

---

## What This Sprint Does

Sprint 89 has **4 deliverables** that transform the GBP "connect" button from a token-only operation into a full data import pipeline:

### Problem 1 (🔴 LAUNCH BLOCKER): GBP Connect Imports Nothing

**Current state:** The GBP OAuth flow (Sprint 57B) stores tokens in `google_oauth_tokens` and redirects to `/dashboard/integrations?gbp_connected=true`. The connect button works. But **zero business data is imported** — no hours, no address, no phone, no location. The user still hits the manual onboarding wizard.

**The disconnect:** The Integrations page says "Connected ✓" with a green badge. But the dashboard still shows empty data because `locations.hours_data` is null. The OnboardingGuard fires and redirects new users back to `/onboarding` — making the GBP connect appear broken.

**Fix:** Rewrite the callback to also fetch GBP locations, map them via `gbp-mapper.ts` (RFC §4.1–4.2), and either auto-import (1 location) or present a picker (2+ locations).

### Problem 2: No GBP Types or Mapper Service

**Current state:** `lib/types/gbp.ts` does not exist. The RFC defines `GBPAccount` and `GBPLocation` interfaces (§3.4) and a complete mapper (§4.1–4.2) — none of which are implemented.

**Fix:** Create `lib/types/gbp.ts` and `lib/services/gbp-mapper.ts` with `mapGBPLocationToRow()` and `mapGBPHours()`. These are pure functions — no I/O, no Supabase, fully testable.

### Problem 3: No Onboarding Connect Interstitial

**Current state:** After registration, users go directly to `/onboarding` (the manual wizard). There is no option to connect GBP first, which would auto-populate hours and address and skip the wizard entirely.

**Fix:** Create `/onboarding/connect/page.tsx` — a simple interstitial with "Connect Google Business Profile" and "Fill in manually →". For users with 2+ GBP locations, create `/onboarding/connect/select/page.tsx` — a location picker that reads from `pending_gbp_imports`.

### Problem 4: No `importGBPLocation()` Server Action

**Current state:** There is no server action to take a GBP location object and write it to the `locations` table with properly mapped hours.

**Fix:** Create `app/onboarding/connect/actions.ts` with `importGBPLocation()` per RFC §4.4. Uses `mapGBPLocationToRow()`, enforces `is_primary` rule, creates `location_integrations` row, seeds SOV queries.

---

## Architecture Overview

```
Sprint 89 — GBP Data Mapping + Import Flow
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TYPES (GBP API shapes):
├── lib/types/gbp.ts                          — NEW: GBPAccount, GBPLocation interfaces

SERVICES (Pure mapping — no I/O):
├── lib/services/gbp-mapper.ts                — NEW: mapGBPLocationToRow(), mapGBPHours()

CALLBACK REWRITE (Token + Location fetch):
├── app/api/auth/google/callback/route.ts     — REWRITE: add location fetch, pending_gbp_imports, auto-import

ONBOARDING CONNECT (New pages):
├── app/onboarding/connect/page.tsx           — NEW: Interstitial ("Connect GBP" vs "Manual")
├── app/onboarding/connect/select/page.tsx    — NEW: Location picker (2+ locations)
├── app/onboarding/connect/actions.ts         — NEW: importGBPLocation() server action
├── app/onboarding/connect/_components/
│   ├── GBPLocationCard.tsx                   — NEW: Card showing GBP location details
│   └── ConnectGBPButton.tsx                  — NEW: Google-branded OAuth button

EXISTING FILE UPDATES:
├── app/onboarding/page.tsx                   — MODIFY: Read ?source= param, show fallback toast
├── app/api/auth/register/route.ts            — MODIFY: Redirect to /onboarding/connect (not /onboarding)

TESTS:
├── src/__tests__/unit/gbp-mapper.test.ts            — NEW: mapGBPLocationToRow + mapGBPHours
├── src/__tests__/unit/gbp-import-action.test.ts     — NEW: importGBPLocation server action
├── src/__tests__/unit/gbp-callback-locations.test.ts — NEW: Callback location fetch + routing
```

---

## Phase 1: Create GBP Types

### 1A — `lib/types/gbp.ts`

Create the GBP API response types exactly as specified in RFC §3.4:

```typescript
// ---------------------------------------------------------------------------
// lib/types/gbp.ts — Google Business Profile API Response Types
//
// Source: RFC_GBP_ONBOARDING_V2_REPLACEMENT.md §3.4
// Reference: https://developers.google.com/my-business/reference/businessinformation/rest
// ---------------------------------------------------------------------------

export interface GBPAccount {
  name:        string;   // "accounts/1234567890"
  accountName: string;   // "My Business Name"
  type:        string;   // "PERSONAL" | "LOCATION_GROUP" | "USER_GROUP"
}

export interface GBPLocation {
  name:  string;         // "accounts/.../locations/987654321"
  title: string;         // Business display name

  storefrontAddress?: {
    addressLines?:       string[];   // ["123 Main St", "Suite 100"]
    locality?:           string;     // City
    administrativeArea?: string;     // State code ("GA")
    postalCode?:         string;
    regionCode?:         string;     // Country ("US")
  };

  regularHours?: {
    periods: Array<{
      openDay:   string;  // "MONDAY" | "TUESDAY" | ...
      openTime:  { hours: number; minutes?: number };
      closeDay:  string;
      closeTime: { hours: number; minutes?: number };
    }>;
  };

  primaryPhone?: string;    // "(470) 546-4866"
  websiteUri?:  string;     // "https://charcoalnchill.com"
  metadata?: {
    placeId:      string;   // Google Maps place_id
    mapsUri?:     string;
    newReviewUri?: string;
  };
}
```

### ⚠️ EVERY FIELD IS OPTIONAL

GBP API returns wildly inconsistent data. A location might have `storefrontAddress` but no `regularHours`. Another might have `regularHours` but no `storefrontAddress`. The mapper MUST handle all combinations of null/undefined.

---

## Phase 2: Create GBP Mapper Service

### 2A — `lib/services/gbp-mapper.ts`

Pure mapping functions — NO I/O, NO Supabase client. The exact exports and types MUST match what the tests import:

```typescript
// ---------------------------------------------------------------------------
// lib/services/gbp-mapper.ts — GBP → LocalVector Data Mapper
//
// Pure functions: no I/O, no Supabase, no auth.
// Spec: RFC_GBP_ONBOARDING_V2_REPLACEMENT.md §4.1, §4.2
// ---------------------------------------------------------------------------

import type { GBPLocation } from '@/lib/types/gbp';
import type { HoursData, DayOfWeek } from '@/lib/types/ground-truth';
import { toUniqueSlug } from '@/lib/utils/slug';

// ── Return type for mapGBPLocationToRow ────────────────────────────────────
// Tests check every field on this interface. DO NOT omit any.

export interface MappedLocation {
  name:                  string;
  slug:                  string;
  business_name:         string;
  address_line1:         string | null;
  city:                  string | null;
  state:                 string | null;
  zip:                   string | null;
  country:               string;
  phone:                 string | null;
  website_url:           string | null;
  google_place_id:       string | null;
  google_location_name:  string;
  hours_data:            HoursData | null;
  amenities:             null;   // GBP does not expose amenities — always null per RFC §4.3
  is_primary:            boolean;
}

// ── Day mapping constants ──────────────────────────────────────────────────

const GBP_DAY_MAP: Record<string, DayOfWeek> = {
  MONDAY:    'monday',
  TUESDAY:   'tuesday',
  WEDNESDAY: 'wednesday',
  THURSDAY:  'thursday',
  FRIDAY:    'friday',
  SATURDAY:  'saturday',
  SUNDAY:    'sunday',
};

const ALL_DAYS: DayOfWeek[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

function formatTime(t: { hours: number; minutes?: number }): string {
  const hh = String(t.hours).padStart(2, '0');
  const mm = String(t.minutes ?? 0).padStart(2, '0');
  return `${hh}:${mm}`;
}

// ── Exported functions ─────────────────────────────────────────────────────

/**
 * Maps GBP regularHours to our HoursData format (Doc 03 §15.1).
 *
 * Returns null if regularHours is undefined or has no periods.
 * Days not listed in periods are set to "closed".
 * Time format: "HH:MM" (24h, zero-padded, business local time).
 */
export function mapGBPHours(
  regularHours: GBPLocation['regularHours'] | undefined
): HoursData | null {
  if (!regularHours?.periods?.length) return null;

  const result: HoursData = Object.fromEntries(
    ALL_DAYS.map((day) => [day, 'closed'])
  ) as HoursData;

  for (const period of regularHours.periods) {
    const day = GBP_DAY_MAP[period.openDay];
    if (!day) continue; // Unknown day name — skip silently

    result[day] = {
      open:  formatTime(period.openTime),
      close: formatTime(period.closeTime),
    };
  }

  return result;
}

/**
 * Maps a GBP Location API response to a LocalVector locations row.
 *
 * @param gbpLocation - Raw GBP API response object
 * @param isPrimary - Whether this should be the org's primary location
 * @returns MappedLocation ready for Supabase INSERT (add org_id at call site)
 */
export function mapGBPLocationToRow(
  gbpLocation: GBPLocation,
  isPrimary: boolean
): MappedLocation {
  const address = gbpLocation.storefrontAddress;
  const addressLine1 = address?.addressLines?.join(', ') ?? null;

  return {
    name:                 gbpLocation.title,
    slug:                 toUniqueSlug(gbpLocation.title),
    business_name:        gbpLocation.title,
    address_line1:        addressLine1,
    city:                 address?.locality ?? null,
    state:                address?.administrativeArea ?? null,
    zip:                  address?.postalCode ?? null,
    country:              address?.regionCode ?? 'US',
    phone:                gbpLocation.primaryPhone ?? null,
    website_url:          gbpLocation.websiteUri ?? null,
    google_place_id:      gbpLocation.metadata?.placeId ?? null,
    google_location_name: gbpLocation.name,
    hours_data:           mapGBPHours(gbpLocation.regularHours),
    amenities:            null,
    is_primary:           isPrimary,
  };
}
```

**⚠️ CRITICAL CONTRACT:** The tests import `{ mapGBPHours, mapGBPLocationToRow }` from this module and check every field on `MappedLocation`. The field names MUST match the test assertions exactly:
- `result.hours_data` (not `hoursData`)
- `result.address_line1` (not `addressLine1`)
- `result.google_place_id` (not `googlePlaceId`)
- `result.website_url` (not `websiteUrl`)
- `result.is_primary` (not `isPrimary`)

These use snake_case because they map directly to Supabase column names.

### 2B — Slug Generation

The slug utility already exists at `lib/utils/slug.ts` with both `toSlug()` and `toUniqueSlug()`. DO NOT create a new one. The mapper imports `toUniqueSlug` from there.

Verify:
```bash
cat lib/utils/slug.ts
# Should show: export function toSlug(...) and export function toUniqueSlug(...)
```

---

## Phase 3: Rewrite the OAuth Callback

### 3A — `app/api/auth/google/callback/route.ts` — REWRITE

The current callback (Sprint 57B) stores tokens and redirects to integrations. The new callback follows RFC §3.3 exactly:

**Current flow (Sprint 57B):**
1. Validate CSRF state ✅ (keep)
2. Exchange code for tokens ✅ (keep)
3. Fetch GBP account name ✅ (keep)
4. Store tokens → `google_oauth_tokens` ✅ (keep)
5. Redirect to `/dashboard/integrations?gbp_connected=true` ❌ (CHANGE)

**New flow (Sprint 89):**
1. Validate CSRF state (keep)
2. Exchange code for tokens (keep)
3. Fetch GBP accounts (keep)
4. **NEW: Fetch locations for the account** → `GET /v1/{accountName}/locations?readMask=...`
5. Store tokens → `google_oauth_tokens` (keep)
6. **NEW: Auto-import** if exactly 1 location → call `importSingleLocation()` → redirect to `/dashboard`
7. **NEW: Multi-location** → write to `pending_gbp_imports` → set `gbp_import_id` cookie → redirect to `/onboarding/connect/select`
8. **NEW: Fallback** on any error → redirect to `/onboarding?source=gbp_failed`

### ⚠️ CRITICAL IMPLEMENTATION DETAILS

1. **Read RFC §3.3 carefully** — the callback code is provided in full. Follow it closely.

2. **GBP Locations API URL:**
   ```
   https://mybusinessbusinessinformation.googleapis.com/v1/{accountName}/locations
     ?readMask=name,title,storefrontAddress,regularHours,primaryPhone,websiteUri,metadata
   ```

3. **`pending_gbp_imports` table** already exists (RFC §2.3, migration `20260224000002_gbp_integration.sql`). Schema:
   - `id` UUID (auto)
   - `org_id` UUID (FK)
   - `locations_data` JSONB (the raw GBP locations array)
   - `account_name` VARCHAR
   - `has_more` BOOLEAN
   - `expires_at` TIMESTAMPTZ (10 minutes from now)

4. **Cookie strategy:** Store ONLY the `pending_gbp_imports.id` UUID in the cookie — NOT the raw locations JSON. Browsers silently drop cookies over 4KB.

5. **Auto-import helper:** When there's exactly 1 location, skip the picker. Create an inline `importSingleLocation()` function in the callback:

```typescript
async function importSingleLocation(orgId: string, gbpLocation: GBPLocation) {
  const supabase = createServiceRoleClient();

  // Check is_primary rule (same as RFC §4.4)
  const { count } = await supabase
    .from('locations')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('is_primary', true);
  const isPrimary = (count ?? 0) === 0;

  const mapped = mapGBPLocationToRow(gbpLocation, isPrimary);

  const { data: location, error } = await supabase
    .from('locations')
    .insert({ ...mapped, org_id: orgId })
    .select('id')
    .single();

  if (error || !location) {
    throw new Error(`Location insert failed: ${error?.message}`);
  }

  // Create location_integrations row
  await supabase.from('location_integrations').upsert({
    org_id:       orgId,
    location_id:  location.id,
    platform:     'google',
    status:       'connected',
    external_id:  gbpLocation.name,
    last_sync_at: new Date().toISOString(),
  }, { onConflict: 'location_id,platform' });

  // Seed SOV queries for the new location
  const { seedSOVQueries } = await import('@/lib/services/sov-seed');
  const locationForSeed = {
    id: location.id,
    org_id: orgId,
    business_name: mapped.business_name,
    city: mapped.city,
    state: mapped.state,
    categories: null,
  };
  await seedSOVQueries(locationForSeed, [], supabase);
}
```

6. **Dual redirect support:** The callback must support being called from both:
   - `/dashboard/integrations` (existing users reconnecting) → redirect back to integrations on success
   - `/onboarding/connect` (new users during onboarding) → redirect to dashboard on success

   Use a cookie `gbp_oauth_source` set by the authorize route to track where the user came from:
   - `source=onboarding` → auto-import redirects to `/dashboard`
   - `source=integrations` → auto-import redirects to `/dashboard/integrations?gbp_connected=true`

### 3B — Update `app/api/auth/google/route.ts`

Add `gbp_oauth_source` cookie to track the origin:

```typescript
// Determine source from Referer header or query param
const source = request.nextUrl.searchParams.get('source') ?? 'integrations';
cookieStore.set('gbp_oauth_source', source, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 600,
  path: '/',
});
```

---

## Phase 4: Create Onboarding Connect Interstitial

### 4A — `app/onboarding/connect/page.tsx`

Server Component. Simple interstitial with two options:

1. **"Connect Google Business Profile"** — large CTA button → `/api/auth/google?source=onboarding`
2. **"I'll fill in manually →"** — text link → `/onboarding`

**Design:** Match the Deep Night aesthetic of `TruthCalibrationForm.tsx`:
- Dark card: `bg-card-dark/60 border border-white/10 rounded-2xl`
- Google button: white background, Google "G" logo, dark text (follow Google branding guidelines)
- Headline: "Connect Your Google Business Profile" (not Doc 06 §7 — that's the manual wizard headline)
- Subtext: "Import your hours, address, and contact info automatically. Takes 10 seconds."

**Auth guard:** Redirect to `/login` if unauthenticated. Check if primary location already has `hours_data` → skip to `/dashboard`.

### 4B — `app/onboarding/connect/select/page.tsx`

Server Component for multi-location picker (2+ GBP locations).

1. Read `gbp_import_id` cookie
2. Fetch matching `pending_gbp_imports` row via `createServiceRoleClient()`
3. Validate: `expires_at > now()` AND `org_id === ctx.orgId`
4. If invalid/expired: redirect to `/onboarding/connect`
5. Parse `locations_data` as `GBPLocation[]`
6. Render a list of `GBPLocationCard` components
7. Each card has a "Select This Location" button → calls `importGBPLocation()` action

**Design:**
- Headline: "Which location would you like to manage?"
- Cards show: business name, address, phone, hours summary (e.g., "Open 7 days" or "Open Mon–Sat")
- "Skip — fill in manually →" link at bottom

### 4C — `app/onboarding/connect/_components/GBPLocationCard.tsx`

Client Component. Displays a single GBP location with:
- Business name (title)
- Address (formatted from `storefrontAddress`)
- Phone
- Hours summary (count of open days)
- "Select" button with loading state

### 4D — `app/onboarding/connect/_components/ConnectGBPButton.tsx`

Client Component. Google-branded OAuth button:
- White background, Google "G" SVG, "Sign in with Google" text
- Links to `/api/auth/google?source=onboarding`
- Follows [Google Sign-In branding](https://developers.google.com/identity/branding-guidelines)

---

## Phase 5: Create `importGBPLocation()` Server Action

### 5A — `app/onboarding/connect/actions.ts`

Implement the `importGBPLocation()` action per RFC §4.4. **The exact exported function signature MUST match what the tests import:**

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getSafeAuthContext } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { mapGBPLocationToRow } from '@/lib/services/gbp-mapper';
import { seedSOVQueries } from '@/lib/services/sov-seed';
import type { GBPLocation } from '@/lib/types/gbp';
import { z } from 'zod';

type ActionResult = { success: true } | { success: false; error: string };

const InputSchema = z.object({
  locationIndex: z.number().int().min(0),
});

/**
 * importGBPLocation — Server Action
 *
 * Called from the /onboarding/connect/select picker page.
 * Reads the gbp_import_id cookie → fetches pending_gbp_imports row →
 * maps the selected GBP location → inserts into locations table.
 *
 * @param input - { locationIndex: number } — index into locations_data array
 * @returns ActionResult
 */
export async function importGBPLocation(
  input: { locationIndex: number }
): Promise<ActionResult> {
  // 1. Auth
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  // 2. Validate input
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };
  const { locationIndex } = parsed.data;

  // 3. Read cookie
  const cookieStore = await cookies();
  const importId = cookieStore.get('gbp_import_id')?.value;
  if (!importId) return { success: false, error: 'No pending import found' };

  // 4. Fetch pending import
  const supabase = createServiceRoleClient();
  const { data: pending, error: pendingError } = await supabase
    .from('pending_gbp_imports')
    .select('*')
    .eq('id', importId)
    .eq('org_id', ctx.orgId)
    .single();

  if (pendingError || !pending) return { success: false, error: 'Import not found' };

  // 5. Validate org_id match
  if (pending.org_id !== ctx.orgId) return { success: false, error: 'Unauthorized — org mismatch' };

  // 6. Validate not expired
  if (new Date(pending.expires_at) < new Date()) {
    return { success: false, error: 'Import link expired. Please reconnect Google.' };
  }

  // 7. Extract location by index
  const locations = pending.locations_data as unknown as GBPLocation[];
  if (locationIndex < 0 || locationIndex >= locations.length) {
    return { success: false, error: `Invalid location index: ${locationIndex}` };
  }
  const gbpLocation = locations[locationIndex];

  // 8. Check is_primary (same logic as createLocation)
  const { count } = await supabase
    .from('locations')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', ctx.orgId)
    .eq('is_primary', true);
  const isPrimary = (count ?? 0) === 0;

  // 9. Map GBP → LocalVector
  const mapped = mapGBPLocationToRow(gbpLocation, isPrimary);

  // 10. Insert location
  const { data: location, error: insertError } = await supabase
    .from('locations')
    .insert({ ...mapped, org_id: ctx.orgId })
    .select('id')
    .single();

  if (insertError || !location) {
    return { success: false, error: insertError?.message ?? 'Location insert failed' };
  }

  // 11. Create location_integrations row
  await supabase.from('location_integrations').upsert({
    org_id:       ctx.orgId,
    location_id:  location.id,
    platform:     'google',
    status:       'connected',
    external_id:  gbpLocation.name,
    last_sync_at: new Date().toISOString(),
  }, { onConflict: 'location_id,platform' });

  // 12. Seed SOV queries
  await seedSOVQueries(
    {
      id: location.id,
      org_id: ctx.orgId,
      business_name: mapped.business_name,
      city: mapped.city,
      state: mapped.state,
      categories: null,
    },
    [],
    supabase,
  );

  // 13. Cleanup: delete pending import + cookie
  await supabase.from('pending_gbp_imports').delete().eq('id', importId);
  cookieStore.delete('gbp_import_id');

  // 14. Revalidate
  revalidatePath('/dashboard');
  revalidatePath('/onboarding');

  return { success: true };
}
```

**⚠️ CRITICAL:** The function signature `export async function importGBPLocation(input: { locationIndex: number }): Promise<ActionResult>` MUST match exactly — the unit tests import and call it as `importGBPLocation({ locationIndex: 0 })`.

---

## Phase 6: Update Existing Files

### 6A — `app/onboarding/page.tsx` — Fallback Toast

Add `?source=` query param handling. Show a toast when the GBP flow fails:

```typescript
const searchParams = /* read from page props */;
const source = searchParams?.source;

// Render toast based on source
const toastMessages: Record<string, string> = {
  gbp_failed: 'Google connection failed. Let's fill in your info manually.',
  gbp_denied: 'Google connection was cancelled. No worries — fill in manually below.',
  gbp_no_accounts: 'No Google Business Profile found for this account. Fill in manually.',
  gbp_no_locations: 'No business locations found in your Google account. Fill in manually.',
};
```

Show the toast at the top of the page with an amber/warning style. The existing `TruthCalibrationForm` renders below unchanged.

### 6B — `app/(auth)/register/page.tsx` — Post-Registration Redirect Change (CLIENT-SIDE)

**⚠️ IMPORTANT:** The post-registration redirect is CLIENT-SIDE in the register page component, NOT in the API route. The register API route (`app/api/auth/register/route.ts`) returns a 201 JSON response — it does NOT redirect. The client-side `onSubmit()` handler does `router.push('/dashboard')` after successful registration + login.

Change the post-registration `router.push` from `/dashboard` to `/onboarding/connect`:

```typescript
// In app/(auth)/register/page.tsx, inside onSubmit():

// BEFORE (line ~103):
router.push('/dashboard');

// AFTER:
router.push('/onboarding/connect');
```

Also update the Google OAuth `redirectTo` on line ~64:

```typescript
// BEFORE:
redirectTo: `${window.location.origin}/dashboard`,

// AFTER:
redirectTo: `${window.location.origin}/onboarding/connect`,
```

**⚠️ EDGE CASE:** If `GOOGLE_CLIENT_ID` is not configured, the connect page's server component should detect this and redirect straight to `/onboarding`:

```typescript
const gbpConfigured = !!process.env.GOOGLE_CLIENT_ID;
if (!gbpConfigured) redirect('/onboarding');
```

### 6C — `app/(auth)/login/page.tsx` — Optional Redirect Update

For EXISTING users who log in and still have `hours_data=null`, the OnboardingGuard in `app/dashboard/layout.tsx` already handles the redirect to `/onboarding`. No change needed here. But if you want new users from Google OAuth to also land on the connect page, update:

```typescript
// In app/(auth)/login/page.tsx, Google OAuth redirectTo (line ~24):
// LEAVE AS `/dashboard` — the OnboardingGuard handles the redirect to /onboarding
// which is correct for existing users. Only new user registration goes to /onboarding/connect.
```

---

## Phase 7: Tests (Write FIRST — AI_RULES §4)

### 7A — GBP Fixtures — Add to `src/__fixtures__/golden-tenant.ts`

Add these fixtures at the end of the file:

```typescript
// ---------------------------------------------------------------------------
// Sprint 89 — GBP API Fixtures for Charcoal N Chill
// ---------------------------------------------------------------------------

import type { GBPAccount, GBPLocation } from '@/lib/types/gbp';

/**
 * Sprint 89 — Canonical GBP location fixture for Charcoal N Chill.
 * Mirrors the real GBP API response for the golden tenant.
 * Used by all GBP mapper, callback, and import action tests.
 */
export const MOCK_GBP_LOCATION: GBPLocation = {
  name: 'accounts/123456789/locations/987654321',
  title: 'Charcoal N Chill',
  storefrontAddress: {
    addressLines: ['11950 Jones Bridge Road', 'Ste 103'],
    locality: 'Alpharetta',
    administrativeArea: 'GA',
    postalCode: '30005',
    regionCode: 'US',
  },
  regularHours: {
    periods: [
      { openDay: 'TUESDAY',   openTime: { hours: 17, minutes: 0 }, closeDay: 'TUESDAY',   closeTime: { hours: 1, minutes: 0 } },
      { openDay: 'WEDNESDAY', openTime: { hours: 17, minutes: 0 }, closeDay: 'WEDNESDAY', closeTime: { hours: 1, minutes: 0 } },
      { openDay: 'THURSDAY',  openTime: { hours: 17, minutes: 0 }, closeDay: 'THURSDAY',  closeTime: { hours: 1, minutes: 0 } },
      { openDay: 'FRIDAY',    openTime: { hours: 17, minutes: 0 }, closeDay: 'FRIDAY',    closeTime: { hours: 2, minutes: 0 } },
      { openDay: 'SATURDAY',  openTime: { hours: 17, minutes: 0 }, closeDay: 'SATURDAY',  closeTime: { hours: 2, minutes: 0 } },
      { openDay: 'SUNDAY',    openTime: { hours: 17, minutes: 0 }, closeDay: 'SUNDAY',    closeTime: { hours: 1, minutes: 0 } },
    ],
  },
  primaryPhone: '(470) 546-4866',
  websiteUri: 'https://charcoalnchill.com',
  metadata: {
    placeId: 'ChIJi8-1ywdO9YgR9s5j-y0_1lI',
    mapsUri: 'https://maps.google.com/?cid=12345',
    newReviewUri: 'https://search.google.com/local/writereview?placeid=ChIJi8-1ywdO9YgR9s5j-y0_1lI',
  },
};

/**
 * Sprint 89 — GBP location with minimal data (no hours, no phone, no website).
 * Tests the mapper's null-handling paths.
 */
export const MOCK_GBP_LOCATION_MINIMAL: GBPLocation = {
  name: 'accounts/123456789/locations/111111111',
  title: 'Ghost Kitchen XYZ',
  storefrontAddress: {
    addressLines: ['456 Elm Street'],
    locality: 'Roswell',
    administrativeArea: 'GA',
    postalCode: '30075',
    regionCode: 'US',
  },
};

/**
 * Sprint 89 — GBP location with NO storefrontAddress (virtual business).
 */
export const MOCK_GBP_LOCATION_NO_ADDRESS: GBPLocation = {
  name: 'accounts/123456789/locations/222222222',
  title: 'Virtual Catering Co',
  primaryPhone: '(555) 000-1234',
  websiteUri: 'https://virtualcatering.example.com',
};

/**
 * Sprint 89 — GBP account fixture.
 */
export const MOCK_GBP_ACCOUNT: GBPAccount = {
  name: 'accounts/123456789',
  accountName: 'Aruna Surendera Babu',
  type: 'PERSONAL',
};

/**
 * Sprint 89 — Second GBP location for multi-location picker tests.
 */
export const MOCK_GBP_LOCATION_SECOND: GBPLocation = {
  name: 'accounts/123456789/locations/333333333',
  title: 'Charcoal N Chill - Downtown',
  storefrontAddress: {
    addressLines: ['200 Peachtree St NW'],
    locality: 'Atlanta',
    administrativeArea: 'GA',
    postalCode: '30303',
    regionCode: 'US',
  },
  regularHours: {
    periods: [
      { openDay: 'MONDAY',    openTime: { hours: 11, minutes: 30 }, closeDay: 'MONDAY',    closeTime: { hours: 22, minutes: 0 } },
      { openDay: 'TUESDAY',   openTime: { hours: 11, minutes: 30 }, closeDay: 'TUESDAY',   closeTime: { hours: 22, minutes: 0 } },
      { openDay: 'WEDNESDAY', openTime: { hours: 11, minutes: 30 }, closeDay: 'WEDNESDAY', closeTime: { hours: 22, minutes: 0 } },
      { openDay: 'THURSDAY',  openTime: { hours: 11, minutes: 30 }, closeDay: 'THURSDAY',  closeTime: { hours: 23, minutes: 0 } },
      { openDay: 'FRIDAY',    openTime: { hours: 11, minutes: 30 }, closeDay: 'FRIDAY',    closeTime: { hours: 0,  minutes: 0 } },
      { openDay: 'SATURDAY',  openTime: { hours: 10, minutes: 0 },  closeDay: 'SATURDAY',  closeTime: { hours: 0,  minutes: 0 } },
      { openDay: 'SUNDAY',    openTime: { hours: 10, minutes: 0 },  closeDay: 'SUNDAY',    closeTime: { hours: 21, minutes: 0 } },
    ],
  },
  primaryPhone: '(404) 555-9876',
  websiteUri: 'https://charcoalnchill.com/downtown',
  metadata: {
    placeId: 'ChIJtest_downtown_123',
  },
};
```

---

### 7B — `src/__tests__/unit/gbp-mapper.test.ts` (NEW — 22 tests)

```typescript
// ---------------------------------------------------------------------------
// gbp-mapper.test.ts — Unit tests for GBP → LocalVector data mapper
//
// Sprint 89: Pure function tests. No mocks needed — the mapper has no I/O.
// These test all edge cases in mapGBPHours() and mapGBPLocationToRow().
//
// Run:
//   npx vitest run src/__tests__/unit/gbp-mapper.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { mapGBPHours, mapGBPLocationToRow } from '@/lib/services/gbp-mapper';
import type { GBPLocation } from '@/lib/types/gbp';
import type { HoursData } from '@/lib/types/ground-truth';
import {
  MOCK_GBP_LOCATION,
  MOCK_GBP_LOCATION_MINIMAL,
  MOCK_GBP_LOCATION_NO_ADDRESS,
  MOCK_GBP_LOCATION_SECOND,
} from '@/__fixtures__/golden-tenant';

// ═══════════════════════════════════════════════════════════════════════════
// mapGBPHours — 9 tests
// ═══════════════════════════════════════════════════════════════════════════

describe('mapGBPHours', () => {
  it('should map standard 6-day schedule correctly (Monday closed)', () => {
    const result = mapGBPHours(MOCK_GBP_LOCATION.regularHours);
    expect(result).not.toBeNull();
    const hours = result as HoursData;
    expect(hours.monday).toBe('closed');
    expect(hours.tuesday).toEqual({ open: '17:00', close: '01:00' });
    expect(hours.wednesday).toEqual({ open: '17:00', close: '01:00' });
    expect(hours.thursday).toEqual({ open: '17:00', close: '01:00' });
    expect(hours.friday).toEqual({ open: '17:00', close: '02:00' });
    expect(hours.saturday).toEqual({ open: '17:00', close: '02:00' });
    expect(hours.sunday).toEqual({ open: '17:00', close: '01:00' });
  });

  it('should return null when regularHours is undefined', () => {
    expect(mapGBPHours(undefined)).toBeNull();
  });

  it('should return null when periods array is empty', () => {
    expect(mapGBPHours({ periods: [] })).toBeNull();
  });

  it('should handle missing minutes (defaults to 00)', () => {
    const result = mapGBPHours({
      periods: [
        { openDay: 'MONDAY', openTime: { hours: 9 }, closeDay: 'MONDAY', closeTime: { hours: 17 } },
      ],
    });
    expect(result).not.toBeNull();
    expect((result as HoursData).monday).toEqual({ open: '09:00', close: '17:00' });
  });

  it('should format hours as zero-padded HH:MM', () => {
    const result = mapGBPHours({
      periods: [
        { openDay: 'TUESDAY', openTime: { hours: 8, minutes: 5 }, closeDay: 'TUESDAY', closeTime: { hours: 0, minutes: 0 } },
      ],
    });
    expect(result).not.toBeNull();
    expect((result as HoursData).tuesday).toEqual({ open: '08:05', close: '00:00' });
  });

  it('should mark days without periods as "closed"', () => {
    const result = mapGBPHours({
      periods: [
        { openDay: 'WEDNESDAY', openTime: { hours: 10 }, closeDay: 'WEDNESDAY', closeTime: { hours: 18 } },
      ],
    });
    const hours = result as HoursData;
    expect(hours.monday).toBe('closed');
    expect(hours.tuesday).toBe('closed');
    expect(hours.wednesday).toEqual({ open: '10:00', close: '18:00' });
    expect(hours.thursday).toBe('closed');
    expect(hours.friday).toBe('closed');
    expect(hours.saturday).toBe('closed');
    expect(hours.sunday).toBe('closed');
  });

  it('should handle midnight crossover times (close hours 0 or 1)', () => {
    const result = mapGBPHours({
      periods: [
        { openDay: 'FRIDAY', openTime: { hours: 20, minutes: 0 }, closeDay: 'SATURDAY', closeTime: { hours: 3, minutes: 0 } },
      ],
    });
    expect((result as HoursData).friday).toEqual({ open: '20:00', close: '03:00' });
  });

  it('should ignore unknown day names gracefully', () => {
    const result = mapGBPHours({
      periods: [
        { openDay: 'MOONDAY', openTime: { hours: 10 }, closeDay: 'MOONDAY', closeTime: { hours: 18 } },
        { openDay: 'MONDAY', openTime: { hours: 9 }, closeDay: 'MONDAY', closeTime: { hours: 17 } },
      ],
    });
    expect(result).not.toBeNull();
    expect((result as HoursData).monday).toEqual({ open: '09:00', close: '17:00' });
  });

  it('should map all 7 days from MOCK_GBP_LOCATION_SECOND', () => {
    const result = mapGBPHours(MOCK_GBP_LOCATION_SECOND.regularHours);
    expect(result).not.toBeNull();
    const hours = result as HoursData;
    expect(hours.monday).toEqual({ open: '11:30', close: '22:00' });
    expect(hours.friday).toEqual({ open: '11:30', close: '00:00' });
    expect(hours.saturday).toEqual({ open: '10:00', close: '00:00' });
    expect(hours.sunday).toEqual({ open: '10:00', close: '21:00' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// mapGBPLocationToRow — 13 tests
// ═══════════════════════════════════════════════════════════════════════════

describe('mapGBPLocationToRow', () => {
  it('should map all address fields correctly from full GBP location', () => {
    const result = mapGBPLocationToRow(MOCK_GBP_LOCATION, true);
    expect(result.business_name).toBe('Charcoal N Chill');
    expect(result.address_line1).toBe('11950 Jones Bridge Road, Ste 103');
    expect(result.city).toBe('Alpharetta');
    expect(result.state).toBe('GA');
    expect(result.zip).toBe('30005');
    expect(result.country).toBe('US');
  });

  it('should join multiple addressLines with ", "', () => {
    const result = mapGBPLocationToRow(MOCK_GBP_LOCATION, false);
    expect(result.address_line1).toBe('11950 Jones Bridge Road, Ste 103');
  });

  it('should handle single addressLine (no join needed)', () => {
    const result = mapGBPLocationToRow(MOCK_GBP_LOCATION_SECOND, false);
    expect(result.address_line1).toBe('200 Peachtree St NW');
  });

  it('should handle missing storefrontAddress (all address fields null)', () => {
    const result = mapGBPLocationToRow(MOCK_GBP_LOCATION_NO_ADDRESS, false);
    expect(result.address_line1).toBeNull();
    expect(result.city).toBeNull();
    expect(result.state).toBeNull();
    expect(result.zip).toBeNull();
    expect(result.country).toBe('US');
  });

  it('should set amenities to null (GBP does not expose them per RFC §4.3)', () => {
    const result = mapGBPLocationToRow(MOCK_GBP_LOCATION, true);
    expect(result.amenities).toBeNull();
  });

  it('should map google_place_id from metadata.placeId', () => {
    const result = mapGBPLocationToRow(MOCK_GBP_LOCATION, true);
    expect(result.google_place_id).toBe('ChIJi8-1ywdO9YgR9s5j-y0_1lI');
  });

  it('should map google_location_name from location.name (full resource path)', () => {
    const result = mapGBPLocationToRow(MOCK_GBP_LOCATION, true);
    expect(result.google_location_name).toBe('accounts/123456789/locations/987654321');
  });

  it('should pass isPrimary=true through unchanged', () => {
    expect(mapGBPLocationToRow(MOCK_GBP_LOCATION, true).is_primary).toBe(true);
  });

  it('should pass isPrimary=false through unchanged', () => {
    expect(mapGBPLocationToRow(MOCK_GBP_LOCATION, false).is_primary).toBe(false);
  });

  it('should handle missing optional fields (phone, website, metadata)', () => {
    const result = mapGBPLocationToRow(MOCK_GBP_LOCATION_MINIMAL, true);
    expect(result.phone).toBeNull();
    expect(result.website_url).toBeNull();
    expect(result.google_place_id).toBeNull();
    expect(result.hours_data).toBeNull();
    expect(result.business_name).toBe('Ghost Kitchen XYZ');
  });

  it('should generate a valid slug from title (lowercase, no spaces)', () => {
    const result = mapGBPLocationToRow(MOCK_GBP_LOCATION, true);
    expect(result.slug).toMatch(/^charcoal-n-chill/);
    expect(result.slug).not.toContain(' ');
  });

  it('should produce correct hours_data for full GBP location', () => {
    const result = mapGBPLocationToRow(MOCK_GBP_LOCATION, true);
    expect(result.hours_data).not.toBeNull();
    const hours = result.hours_data as HoursData;
    expect(hours.monday).toBe('closed');
    expect(hours.tuesday).toEqual({ open: '17:00', close: '01:00' });
    expect(hours.friday).toEqual({ open: '17:00', close: '02:00' });
  });

  it('should use title for both name and business_name', () => {
    const result = mapGBPLocationToRow(MOCK_GBP_LOCATION, true);
    expect(result.name).toBe('Charcoal N Chill');
    expect(result.business_name).toBe('Charcoal N Chill');
  });
});
```

**Expected: 22 tests, ALL PASS.** No mocking required — pure functions.

---

### 7C — `src/__tests__/unit/gbp-import-action.test.ts` (NEW — 13 tests)

```typescript
// ---------------------------------------------------------------------------
// gbp-import-action.test.ts — Unit tests for importGBPLocation Server Action
//
// Sprint 89: Tests the server action that reads from pending_gbp_imports,
// maps the GBP location, and writes to the locations table.
//
// Mock strategy: vi.mock all server dependencies (supabase, auth, cache,
// cookies, sov-seed). Factory creates chainable Supabase mock per table.
//
// Run:
//   npx vitest run src/__tests__/unit/gbp-import-action.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoist vi.mock declarations ────────────────────────────────────────────

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ getSafeAuthContext: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: 'import-uuid-001' }),
    delete: vi.fn(),
  }),
}));
vi.mock('@/lib/services/sov-seed', () => ({
  seedSOVQueries: vi.fn().mockResolvedValue({ seeded: 10 }),
}));

// ── Import subjects ───────────────────────────────────────────────────────

import { importGBPLocation } from '@/app/onboarding/connect/actions';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { seedSOVQueries } from '@/lib/services/sov-seed';
import { revalidatePath } from 'next/cache';
import { MOCK_GBP_LOCATION } from '@/__fixtures__/golden-tenant';

// ── Shared fixtures ───────────────────────────────────────────────────────

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const LOCATION_ID = 'loc-new-001';
const IMPORT_ROW_ID = 'import-uuid-001';
const MOCK_AUTH = { orgId: ORG_ID, userId: 'user-001' };

const VALID_PENDING_IMPORT = {
  id: IMPORT_ROW_ID,
  org_id: ORG_ID,
  locations_data: [MOCK_GBP_LOCATION],
  account_name: 'accounts/123456789',
  expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
};

// ── Supabase mock factory ─────────────────────────────────────────────────

function createMockServiceRole({
  pendingResult = { data: VALID_PENDING_IMPORT, error: null },
  primaryCount = 0,
  insertResult = { data: { id: LOCATION_ID }, error: null },
  upsertResult = { data: null, error: null },
  deleteResult = { data: null, error: null },
} = {}) {
  // pending_gbp_imports.select().eq().eq().single()
  const pendingSingle = vi.fn().mockResolvedValue(pendingResult);
  const pendingEq2 = vi.fn().mockReturnValue({ single: pendingSingle });
  const pendingEq1 = vi.fn().mockReturnValue({ eq: pendingEq2 });
  const pendingSelect = vi.fn().mockReturnValue({ eq: pendingEq1 });
  const deleteEq = vi.fn().mockResolvedValue(deleteResult);
  const pendingDelete = vi.fn().mockReturnValue({ eq: deleteEq });

  // locations.select for is_primary count
  const countResult = vi.fn().mockResolvedValue({ count: primaryCount, error: null });
  const countEq2 = vi.fn().mockReturnValue(countResult);
  const countEq1 = vi.fn().mockReturnValue({ eq: countEq2 });
  const locCountSelect = vi.fn().mockReturnValue({ eq: countEq1 });

  // locations.insert().select().single()
  const insertSingle = vi.fn().mockResolvedValue(insertResult);
  const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
  const locInsert = vi.fn().mockReturnValue({ select: insertSelect });

  // location_integrations.upsert()
  const intUpsert = vi.fn().mockResolvedValue(upsertResult);

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'pending_gbp_imports') return { select: pendingSelect, delete: pendingDelete };
    if (table === 'locations') return { select: locCountSelect, insert: locInsert };
    if (table === 'location_integrations') return { upsert: intUpsert };
    return {};
  });

  vi.mocked(createServiceRoleClient).mockReturnValue({ from } as never);
  return { from, locInsert, intUpsert, pendingDelete, deleteEq };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('importGBPLocation', () => {
  beforeEach(() => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(MOCK_AUTH as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should insert location with mapped hours_data from GBP', async () => {
    const { locInsert } = createMockServiceRole();
    const result = await importGBPLocation({ locationIndex: 0 });
    expect(result.success).toBe(true);
    expect(locInsert).toHaveBeenCalledOnce();
    const arg = locInsert.mock.calls[0][0];
    expect(arg.business_name).toBe('Charcoal N Chill');
    expect(arg.hours_data).not.toBeNull();
    expect(arg.hours_data.monday).toBe('closed');
    expect(arg.hours_data.tuesday).toEqual({ open: '17:00', close: '01:00' });
    expect(arg.org_id).toBe(ORG_ID);
  });

  it('should create location_integrations row with platform="google"', async () => {
    const { intUpsert } = createMockServiceRole();
    await importGBPLocation({ locationIndex: 0 });
    expect(intUpsert).toHaveBeenCalledOnce();
    const arg = intUpsert.mock.calls[0][0];
    expect(arg.platform).toBe('google');
    expect(arg.status).toBe('connected');
    expect(arg.external_id).toBe('accounts/123456789/locations/987654321');
  });

  it('should set is_primary=true when no existing primary location', async () => {
    const { locInsert } = createMockServiceRole({ primaryCount: 0 });
    await importGBPLocation({ locationIndex: 0 });
    expect(locInsert.mock.calls[0][0].is_primary).toBe(true);
  });

  it('should set is_primary=false when primary location already exists', async () => {
    const { locInsert } = createMockServiceRole({ primaryCount: 1 });
    await importGBPLocation({ locationIndex: 0 });
    expect(locInsert.mock.calls[0][0].is_primary).toBe(false);
  });

  it('should call seedSOVQueries with the new location', async () => {
    createMockServiceRole();
    await importGBPLocation({ locationIndex: 0 });
    expect(seedSOVQueries).toHaveBeenCalledOnce();
    const seedArgs = vi.mocked(seedSOVQueries).mock.calls[0];
    expect(seedArgs[0].id).toBe(LOCATION_ID);
    expect(seedArgs[0].org_id).toBe(ORG_ID);
    expect(seedArgs[0].business_name).toBe('Charcoal N Chill');
    expect(seedArgs[0].city).toBe('Alpharetta');
  });

  it('should reject unauthorized requests (null context)', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValueOnce(null);
    const result = await importGBPLocation({ locationIndex: 0 });
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('should reject expired pending_gbp_imports', async () => {
    createMockServiceRole({
      pendingResult: {
        data: { ...VALID_PENDING_IMPORT, expires_at: new Date(Date.now() - 60000).toISOString() },
        error: null,
      },
    });
    const result = await importGBPLocation({ locationIndex: 0 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/expired/i);
  });

  it('should reject when org_id does not match authenticated user', async () => {
    createMockServiceRole({
      pendingResult: { data: { ...VALID_PENDING_IMPORT, org_id: 'different-org' }, error: null },
    });
    const result = await importGBPLocation({ locationIndex: 0 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/unauthorized/i);
  });

  it('should delete pending_gbp_imports row after successful import', async () => {
    const { pendingDelete, deleteEq } = createMockServiceRole();
    await importGBPLocation({ locationIndex: 0 });
    expect(pendingDelete).toHaveBeenCalled();
    expect(deleteEq).toHaveBeenCalledWith('id', IMPORT_ROW_ID);
  });

  it('should set amenities to null (GBP intentional gap)', async () => {
    const { locInsert } = createMockServiceRole();
    await importGBPLocation({ locationIndex: 0 });
    expect(locInsert.mock.calls[0][0].amenities).toBeNull();
  });

  it('should revalidate dashboard path', async () => {
    createMockServiceRole();
    await importGBPLocation({ locationIndex: 0 });
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/dashboard');
  });

  it('should return error when location insert fails', async () => {
    createMockServiceRole({ insertResult: { data: null, error: { message: 'Duplicate slug' } } });
    const result = await importGBPLocation({ locationIndex: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject invalid locationIndex (out of bounds)', async () => {
    createMockServiceRole();
    const result = await importGBPLocation({ locationIndex: 99 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/index/i);
  });
});
```

**Expected: 13 tests, ALL PASS.**

---

### 7D — `src/__tests__/unit/gbp-callback-locations.test.ts` (NEW — 9 tests)

```typescript
// ---------------------------------------------------------------------------
// gbp-callback-locations.test.ts — Unit tests for GBP OAuth callback rewrite
//
// Sprint 89: Tests the callback's new location-fetching + routing logic.
// Uses MSW to mock all Google API calls. NextRequest for route handler input.
//
// Run:
//   npx vitest run src/__tests__/unit/gbp-callback-locations.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { http, HttpResponse } from 'msw';
import { server } from '@/__helpers__/setup';
import {
  MOCK_GBP_ACCOUNT,
  MOCK_GBP_LOCATION,
  MOCK_GBP_LOCATION_SECOND,
} from '@/__fixtures__/golden-tenant';

// ── Hoist vi.mock declarations ────────────────────────────────────────────

const mockCookieStore: Record<string, string> = {
  google_oauth_state: 'test-state-123',
  google_oauth_org: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  gbp_oauth_source: 'onboarding',
};

vi.mock('@/lib/supabase/server', () => ({ createServiceRoleClient: vi.fn() }));
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn((name: string) => mockCookieStore[name] ? { value: mockCookieStore[name] } : undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));
// Mock sov-seed so auto-import doesn't fail on seeding
vi.mock('@/lib/services/sov-seed', () => ({
  seedSOVQueries: vi.fn().mockResolvedValue({ seeded: 10 }),
}));

// ── Import subjects ───────────────────────────────────────────────────────

import { GET } from '@/app/api/auth/google/callback/route';
import { createServiceRoleClient } from '@/lib/supabase/server';

// ── Shared fixtures ───────────────────────────────────────────────────────

const APP_URL = 'http://localhost:3000';

function makeCallbackRequest(overrides: Record<string, string> = {}): NextRequest {
  const params = new URLSearchParams({
    code: 'test-auth-code',
    state: 'test-state-123',
    ...overrides,
  });
  return new NextRequest(`${APP_URL}/api/auth/google/callback?${params.toString()}`);
}

function setupGoogleAPIs({
  tokenOk = true,
  accounts = [MOCK_GBP_ACCOUNT],
  locations = [MOCK_GBP_LOCATION] as unknown[],
  nextPageToken,
}: {
  tokenOk?: boolean;
  accounts?: unknown[];
  locations?: unknown[];
  nextPageToken?: string;
} = {}) {
  server.use(
    http.post('https://oauth2.googleapis.com/token', () => {
      if (!tokenOk) return HttpResponse.json({ error: 'invalid_grant' }, { status: 400 });
      return HttpResponse.json({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      });
    }),
    http.get('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', () =>
      HttpResponse.json({ accounts })
    ),
    http.get('https://mybusinessbusinessinformation.googleapis.com/v1/accounts/*/locations', () =>
      HttpResponse.json({ locations, ...(nextPageToken ? { nextPageToken } : {}) })
    ),
    http.get('https://www.googleapis.com/oauth2/v2/userinfo', () =>
      HttpResponse.json({ email: 'aruna@charcoalnchill.com' })
    ),
  );
}

function createMockServiceRoleClient() {
  const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockInsertSingle = vi.fn().mockResolvedValue({ data: { id: 'pending-import-id-001' }, error: null });
  const mockInsertSelect = vi.fn().mockReturnValue({ single: mockInsertSingle });
  const mockInsert = vi.fn().mockReturnValue({ select: mockInsertSelect });

  // locations for auto-import
  const countResult = vi.fn().mockResolvedValue({ count: 0, error: null });
  const countEq2 = vi.fn().mockReturnValue(countResult);
  const countEq1 = vi.fn().mockReturnValue({ eq: countEq2 });
  const locSelect = vi.fn().mockReturnValue({ eq: countEq1 });
  const locInsertSingle = vi.fn().mockResolvedValue({ data: { id: 'new-loc-id' }, error: null });
  const locInsertSelect = vi.fn().mockReturnValue({ single: locInsertSingle });
  const locInsert = vi.fn().mockReturnValue({ select: locInsertSelect });

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'google_oauth_tokens') return { upsert: mockUpsert };
    if (table === 'pending_gbp_imports') return { insert: mockInsert };
    if (table === 'locations') return { select: locSelect, insert: locInsert };
    if (table === 'location_integrations') return { upsert: mockUpsert };
    return {};
  });
  vi.mocked(createServiceRoleClient).mockReturnValue({ from } as never);
  return { from, mockUpsert, mockInsert, locInsert };
}

// ── Environment ───────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.NEXT_PUBLIC_APP_URL = APP_URL;
});

afterEach(() => {
  vi.clearAllMocks();
  server.resetHandlers();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/auth/google/callback — location flow', () => {
  it('should auto-import when exactly 1 GBP location → redirect contains /dashboard', async () => {
    setupGoogleAPIs({ locations: [MOCK_GBP_LOCATION] });
    const { locInsert } = createMockServiceRoleClient();
    const response = await GET(makeCallbackRequest());
    expect(response.status).toBe(307);
    const loc = response.headers.get('location') ?? '';
    expect(loc).toContain('/dashboard');
    expect(loc).not.toContain('/onboarding/connect/select');
    expect(locInsert).toHaveBeenCalled();
  });

  it('should write to pending_gbp_imports when 2+ locations → redirect to picker', async () => {
    setupGoogleAPIs({ locations: [MOCK_GBP_LOCATION, MOCK_GBP_LOCATION_SECOND] });
    const { mockInsert, locInsert } = createMockServiceRoleClient();
    const response = await GET(makeCallbackRequest());
    const loc = response.headers.get('location') ?? '';
    expect(loc).toContain('/onboarding/connect/select');
    expect(mockInsert).toHaveBeenCalled();
    expect(locInsert).not.toHaveBeenCalled();
  });

  it('should store tokens in google_oauth_tokens before routing', async () => {
    setupGoogleAPIs({ locations: [MOCK_GBP_LOCATION] });
    const { mockUpsert } = createMockServiceRoleClient();
    await GET(makeCallbackRequest());
    expect(mockUpsert).toHaveBeenCalled();
    const call = mockUpsert.mock.calls[0][0];
    expect(call.access_token).toBe('mock-access-token');
    expect(call.org_id).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
  });

  it('should redirect with source=gbp_no_accounts when 0 accounts', async () => {
    setupGoogleAPIs({ accounts: [] });
    createMockServiceRoleClient();
    const response = await GET(makeCallbackRequest());
    const loc = response.headers.get('location') ?? '';
    expect(loc).toContain('source=gbp_no_accounts');
  });

  it('should redirect with source=gbp_no_locations when 0 locations', async () => {
    setupGoogleAPIs({ locations: [] });
    createMockServiceRoleClient();
    const response = await GET(makeCallbackRequest());
    const loc = response.headers.get('location') ?? '';
    expect(loc).toContain('source=gbp_no_locations');
  });

  it('should redirect with source=gbp_failed on token exchange failure', async () => {
    setupGoogleAPIs({ tokenOk: false });
    createMockServiceRoleClient();
    const response = await GET(makeCallbackRequest());
    const loc = response.headers.get('location') ?? '';
    expect(loc).toMatch(/gbp_failed|gbp_error/);
  });

  it('should redirect with gbp_denied when user denies OAuth', async () => {
    const request = new NextRequest(
      `${APP_URL}/api/auth/google/callback?error=access_denied`
    );
    const response = await GET(request);
    const loc = response.headers.get('location') ?? '';
    expect(loc).toMatch(/gbp_denied|access_denied/);
  });

  it('should redirect with error on CSRF state mismatch', async () => {
    const request = new NextRequest(
      `${APP_URL}/api/auth/google/callback?code=test&state=wrong-state-value`
    );
    const response = await GET(request);
    expect(response.status).toBe(307);
    const loc = response.headers.get('location') ?? '';
    expect(loc).toMatch(/gbp_error|gbp_failed|csrf/);
  });

  it('should set has_more=true when nextPageToken is present', async () => {
    setupGoogleAPIs({
      locations: [MOCK_GBP_LOCATION, MOCK_GBP_LOCATION_SECOND],
      nextPageToken: 'page2token',
    });
    const { mockInsert } = createMockServiceRoleClient();
    await GET(makeCallbackRequest());
    expect(mockInsert).toHaveBeenCalled();
    const arg = mockInsert.mock.calls[0][0];
    expect(arg.has_more).toBe(true);
  });
});
```

**Expected: 9 tests, ALL PASS.**

---

### 7E — `tests/e2e/15-gbp-onboarding-connect.spec.ts` (NEW — Playwright E2E)

This E2E test validates the non-OAuth parts of the connect flow (the interstitial page renders, the manual fallback link works, toast messages display). It does NOT test the actual Google OAuth redirect (requires live credentials).

```typescript
// ---------------------------------------------------------------------------
// 15-gbp-onboarding-connect.spec.ts — GBP Onboarding Connect Interstitial
//
// Sprint 89: Tests the /onboarding/connect page and fallback paths.
// Does NOT test actual Google OAuth (requires live credentials).
// Tests the interstitial UI, manual fallback link, and toast messages.
//
// Uses the incomplete@ user who has hours_data=NULL and amenities=NULL.
//
// Run:
//   npx playwright test tests/e2e/15-gbp-onboarding-connect.spec.ts
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const INCOMPLETE_USER_STATE = path.join(
  __dirname,
  '../../.playwright/incomplete-user.json'
);
test.use({ storageState: INCOMPLETE_USER_STATE });

test.describe('15 — GBP Onboarding Connect Interstitial', () => {

  test('shows connect page with GBP button and manual fallback link', async ({ page }) => {
    await page.goto('/onboarding/connect');

    // Headline should be visible
    await expect(
      page.getByText(/Connect.*Google Business Profile/i)
    ).toBeVisible({ timeout: 5_000 });

    // Google connect button should be present
    await expect(
      page.getByRole('link', { name: /Sign in with Google|Connect Google/i })
        .or(page.getByRole('button', { name: /Sign in with Google|Connect Google/i }))
    ).toBeVisible();

    // Manual fallback link should be present
    await expect(
      page.getByRole('link', { name: /fill in manually|manually/i })
        .or(page.getByText(/manually/i))
    ).toBeVisible();
  });

  test('manual link navigates to /onboarding (original wizard)', async ({ page }) => {
    await page.goto('/onboarding/connect');

    // Click the manual fallback link
    const manualLink = page.getByRole('link', { name: /fill in manually|manually/i })
      .or(page.getByText(/manually/i).locator('a'));
    await manualLink.first().click();

    // Should land on the original onboarding wizard
    await page.waitForURL('**/onboarding', { timeout: 10_000 });
    expect(page.url()).toContain('/onboarding');
    expect(page.url()).not.toContain('/connect');

    // The manual wizard headline should be visible
    await expect(
      page.getByText(/Teach AI the Truth/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  test('displays fallback toast when redirected with ?source=gbp_failed', async ({ page }) => {
    await page.goto('/onboarding?source=gbp_failed');

    // Toast or banner with failure message should be visible
    await expect(
      page.getByText(/Google connection failed|failed.*manually/i)
    ).toBeVisible({ timeout: 5_000 });

    // The manual wizard form should still be rendered below the toast
    await expect(
      page.getByText(/Teach AI the Truth/i)
    ).toBeVisible();
  });

  test('displays fallback toast when redirected with ?source=gbp_denied', async ({ page }) => {
    await page.goto('/onboarding?source=gbp_denied');

    await expect(
      page.getByText(/cancelled|denied|No worries/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  test('displays fallback toast when redirected with ?source=gbp_no_accounts', async ({ page }) => {
    await page.goto('/onboarding?source=gbp_no_accounts');

    await expect(
      page.getByText(/No Google Business Profile|not found/i)
    ).toBeVisible({ timeout: 5_000 });
  });
});
```

**Expected: 5 tests, ALL PASS.** These test the non-OAuth UI paths only. Actual OAuth flow tested via unit tests (7D) with MSW mocks.

---

### 7F — Test Verification Commands (Run in Order)

```bash
# 1. Individual Vitest test files
npx vitest run src/__tests__/unit/gbp-mapper.test.ts              # Expected: 22 tests PASS
npx vitest run src/__tests__/unit/gbp-import-action.test.ts        # Expected: 13 tests PASS
npx vitest run src/__tests__/unit/gbp-callback-locations.test.ts   # Expected: 9 tests PASS

# 2. TypeScript compilation (zero errors required)
npx tsc --noEmit

# 3. Full Vitest regression (existing 1748 + 44 new = 1792 expected)
npx vitest run

# 4. Playwright E2E (requires dev server running + supabase db reset)
npx playwright test tests/e2e/15-gbp-onboarding-connect.spec.ts   # Expected: 5 tests PASS

# 5. Full Playwright suite (ensure no regressions in existing 18 specs)
npx playwright test

# 6. Count new test cases added by Sprint 89
echo "New Sprint 89 Vitest it() blocks:"
grep -cE "^\s+it\(" \
  src/__tests__/unit/gbp-mapper.test.ts \
  src/__tests__/unit/gbp-import-action.test.ts \
  src/__tests__/unit/gbp-callback-locations.test.ts | \
  awk -F: '{sum += $2} END {print sum}'
# Expected output: 44

echo "New Sprint 89 Playwright test() blocks:"
grep -cE "^\s+test\(" tests/e2e/15-gbp-onboarding-connect.spec.ts
# Expected output: 5
```

**Total new tests: 44 Vitest + 5 Playwright = 49 new tests.**

---

## Phase 8: Documentation & Sync

### 8A — `DEVLOG.md` (root) AND `docs/DEVLOG.md`

Add Sprint 89 entry to BOTH files. Standard format per AI_RULES §13:

```markdown
## 2026-02-28 — Sprint 89: GBP Data Mapping + Import Flow (Completed)

**Goal:** Transform the GBP "connect" button from a token-only operation into a full data import pipeline. New users who connect GBP now have hours and address auto-populated, skipping the manual wizard.

**Scope:**
- `lib/types/gbp.ts` — **NEW.** GBPAccount, GBPLocation interfaces per RFC §3.4.
- `lib/services/gbp-mapper.ts` — **NEW.** mapGBPLocationToRow() and mapGBPHours() — pure functions, no I/O.
- `app/api/auth/google/callback/route.ts` — **REWRITE.** Now fetches GBP locations, auto-imports single location, writes multi-location to pending_gbp_imports, redirects to picker.
- `app/api/auth/google/route.ts` — **MODIFIED.** Added gbp_oauth_source cookie.
- `app/onboarding/connect/page.tsx` — **NEW.** GBP connect interstitial.
- `app/onboarding/connect/select/page.tsx` — **NEW.** Multi-location picker.
- `app/onboarding/connect/actions.ts` — **NEW.** importGBPLocation() server action.
- `app/onboarding/connect/_components/GBPLocationCard.tsx` — **NEW.** Location card.
- `app/onboarding/connect/_components/ConnectGBPButton.tsx` — **NEW.** Google-branded button.
- `app/onboarding/page.tsx` — **MODIFIED.** ?source= fallback toast.
- `app/(auth)/register/page.tsx` — **MODIFIED.** Post-registration redirect to /onboarding/connect (client-side router.push).

**Tests added:**
- `src/__tests__/unit/gbp-mapper.test.ts` — {N} tests.
- `src/__tests__/unit/gbp-import-action.test.ts` — {N} tests.
- `src/__tests__/unit/gbp-callback-locations.test.ts` — {N} tests.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/gbp-mapper.test.ts
npx vitest run src/__tests__/unit/gbp-import-action.test.ts
npx vitest run src/__tests__/unit/gbp-callback-locations.test.ts
npx vitest run   # ALL tests passing
```
```

Replace `{N}` with actual verified test counts via `grep -cE "✓|✅|✅.*test|it\(" <file>`.

### 8B — `docs/CLAUDE.md`

1. **Key Directories:** Add these entries:
   ```
   app/onboarding/connect/       — GBP OAuth interstitial + location picker (Sprint 89)
   ```

2. **Key Engines:** Add to the table:
   ```
   | GBP Mapper | `docs/RFC_GBP_ONBOARDING_V2_REPLACEMENT.md` | Maps GBP API responses to LocalVector location rows |
   ```

3. **Build History:** Update sprint count to 89.

### 8C — `docs/AI_RULES.md`

If the GBP callback introduces a new pattern worth documenting, add a rule. Potential candidates:
- **Cookie-pointer pattern:** "When passing data between OAuth callback and picker pages, store only a UUID pointer in the cookie. Write the full payload to a `pending_*` table with a short TTL (`expires_at`). This prevents silent cookie drops on payloads > 4KB."

### 8D — `docs/09-BUILD-PLAN.md`

Update Phase 8 checkboxes:

```markdown
- [x] **GBP Data Mapping** (Sprint 89)
  - [x] Map GBP `regularHours` → `locations.hours_data` (HoursData type, 24h format)
  - [ ] Map GBP `openInfo.status` → `locations.operational_status` *(deferred — not in readMask)*
  - [x] Map GBP attributes → `locations.amenities` set to null (intentional gap per RFC §4.3)
  - [ ] Timezone gap fix (add `timezone` column) *(deferred to Sprint 90)*
```

### 8E — `MEMORY.md`

If this file exists, update it with Sprint 89 completion status. If it doesn't exist, skip.

### 8F — Git Commit & Push

After ALL changes are complete, tests pass, and docs are synced:

```bash
# Stage everything including untracked files
cd /home/claude/local-vector-v1
git add -A

# Commit with conventional commit format
git commit -m "feat(sprint-89): GBP data mapping + import flow

- Add lib/types/gbp.ts (GBPAccount, GBPLocation)
- Add lib/services/gbp-mapper.ts (mapGBPLocationToRow, mapGBPHours)
- Rewrite OAuth callback to fetch + import GBP locations
- Add /onboarding/connect interstitial + location picker
- Add importGBPLocation() server action
- Add fallback toasts on onboarding page
- Change post-registration redirect to /onboarding/connect
- Add 30+ unit tests for mapper, action, callback

Closes: Sprint 89 (GBP Data Mapping)
Spec: docs/RFC_GBP_ONBOARDING_V2_REPLACEMENT.md §3.3-4.4"

# Push to remote
git push origin main
```

---

## Definition of Done Checklist

- [ ] `lib/types/gbp.ts` created with `GBPAccount` and `GBPLocation` interfaces
- [ ] `lib/services/gbp-mapper.ts` created with `mapGBPLocationToRow()` and `mapGBPHours()`
- [ ] Mapper handles all nullable GBP fields gracefully (no crashes on partial data)
- [ ] `mapGBPHours()` returns proper `HoursData` format (HH:MM, all 7 days, "closed" for missing)
- [ ] `mapGBPHours()` returns `null` for missing/empty `regularHours`
- [ ] Mapper sets `amenities: null` (intentional gap per RFC §4.3)
- [ ] OAuth callback fetches GBP locations via Business Information API
- [ ] Auto-imports when exactly 1 GBP location (no picker)
- [ ] Writes to `pending_gbp_imports` when 2+ locations
- [ ] Cookie contains ONLY the UUID (not raw JSON)
- [ ] `/onboarding/connect` page renders with "Connect GBP" and "Manual" options
- [ ] `/onboarding/connect/select` page reads cookie → fetches pending import → renders picker
- [ ] Picker validates `expires_at` and `org_id` before rendering
- [ ] `importGBPLocation()` enforces `is_primary` rule (same as `createLocation`)
- [ ] `importGBPLocation()` seeds SOV queries for the new location
- [ ] `importGBPLocation()` creates `location_integrations` row
- [ ] `importGBPLocation()` cleans up `pending_gbp_imports` row + cookie
- [ ] Onboarding page shows fallback toast for `?source=gbp_failed|gbp_denied|gbp_no_accounts|gbp_no_locations`
- [ ] Post-registration redirect goes to `/onboarding/connect` (not `/onboarding`)
- [ ] Connect page falls through to `/onboarding` when `GOOGLE_CLIENT_ID` not configured
- [ ] All 3 Vitest test files created and passing (44 tests total: 22 + 13 + 9)
- [ ] Playwright E2E spec created and passing (5 tests in `15-gbp-onboarding-connect.spec.ts`)
- [ ] `npx vitest run` — ALL tests passing (1792+ total = 1748 existing + 44 new)
- [ ] `npx tsc --noEmit` — zero type errors
- [ ] `npx playwright test tests/e2e/15-gbp-onboarding-connect.spec.ts` — 5 tests passing
- [ ] DEVLOG entries added to BOTH `DEVLOG.md` and `docs/DEVLOG.md`
- [ ] `docs/CLAUDE.md` updated (directory entry, engine table, sprint count)
- [ ] `docs/09-BUILD-PLAN.md` Phase 8 checkboxes updated
- [ ] `docs/AI_RULES.md` updated if new pattern discovered
- [ ] No `as any` on Supabase clients
- [ ] No hardcoded scores or placeholders (AI_RULES §20)
- [ ] Git commit and push with all untracked files included

---

## What NOT to Do

1. **DO NOT** modify `app/onboarding/_components/TruthCalibrationForm.tsx`. The manual wizard stays as-is. GBP import is an alternative path, not a replacement.
2. **DO NOT** modify `app/onboarding/actions.ts` (`saveGroundTruth`). The existing server action for manual onboarding stays untouched.
3. **DO NOT** implement token encryption. The RFC mentions `encryptToken()` but the current callback (Sprint 57B) stores tokens in plain text. Keep this consistent for now — token encryption is a production hardening task (Phase 21d).
4. **DO NOT** try to map GBP `attributes` to `amenities`. GBP attribute IDs are unstable across locales and categories. Set `amenities: null` per RFC §4.3.
5. **DO NOT** add a `timezone` column to `locations` in this sprint. That's a Phase 21d hardening task for the Fear Engine audit prompt accuracy.
6. **DO NOT** implement the GBP token refresh cron. That's Sprint 90.
7. **DO NOT** implement GBP change polling (detect when GBP hours change). That's Phase 21d.
8. **DO NOT** modify the `OnboardingGuard` in `app/dashboard/layout.tsx`. The guard condition (`!hours_data && !amenities`) already works correctly — when GBP import provides `hours_data`, the guard clears.
9. **DO NOT** add new npm packages.
10. **DO NOT** modify E2E tests in this sprint. Note any needed E2E updates in the DEVLOG.

---

## File Change Summary

| File | Action | What Changes |
|------|--------|-------------|
| `lib/types/gbp.ts` | CREATE | GBPAccount, GBPLocation interfaces |
| `lib/services/gbp-mapper.ts` | CREATE | mapGBPLocationToRow(), mapGBPHours() |
| `lib/utils/slug.ts` | CREATE (if needed) | toSlug() utility |
| `app/api/auth/google/callback/route.ts` | REWRITE | Add location fetch, pending_gbp_imports, auto-import, routing |
| `app/api/auth/google/route.ts` | MODIFY | Add gbp_oauth_source cookie |
| `app/onboarding/connect/page.tsx` | CREATE | GBP connect interstitial |
| `app/onboarding/connect/select/page.tsx` | CREATE | Multi-location picker |
| `app/onboarding/connect/actions.ts` | CREATE | importGBPLocation() server action |
| `app/onboarding/connect/_components/GBPLocationCard.tsx` | CREATE | Location card component |
| `app/onboarding/connect/_components/ConnectGBPButton.tsx` | CREATE | Google-branded OAuth button |
| `app/onboarding/page.tsx` | MODIFY | ?source= fallback toast |
| `app/(auth)/register/page.tsx` | MODIFY | Redirect → /onboarding/connect (router.push + OAuth redirectTo) |
| `src/__tests__/unit/gbp-mapper.test.ts` | CREATE | Mapper unit tests |
| `src/__tests__/unit/gbp-import-action.test.ts` | CREATE | Import action tests |
| `src/__tests__/unit/gbp-callback-locations.test.ts` | CREATE | Callback routing tests |
| `tests/e2e/15-gbp-onboarding-connect.spec.ts` | CREATE | E2E: connect interstitial UI + fallback toasts |
| `DEVLOG.md` | MODIFY | Sprint 89 entry |
| `docs/DEVLOG.md` | MODIFY | Sprint 89 entry |
| `docs/CLAUDE.md` | MODIFY | Directory entry, engine table, sprint count |
| `docs/09-BUILD-PLAN.md` | MODIFY | Phase 8 checkboxes |
| `docs/AI_RULES.md` | MODIFY (if applicable) | Cookie-pointer pattern |

**Total new files:** 11 (2 lib + 4 pages/components + 1 action + 3 test files + 1 E2E spec)
**Total modified files:** 9 (+ DEVLOG × 2)
**Estimated scope:** Large (OAuth rewrite + new pages + server action + mapper service + 49 tests)
