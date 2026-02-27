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

Pure mapping functions — NO I/O, NO Supabase client. Copy the implementation from RFC §4.1 and §4.2 exactly:

```typescript
// ---------------------------------------------------------------------------
// lib/services/gbp-mapper.ts — GBP → LocalVector Data Mapper
//
// Pure functions: no I/O, no Supabase, no auth.
// Spec: RFC_GBP_ONBOARDING_V2_REPLACEMENT.md §4.1, §4.2
// ---------------------------------------------------------------------------

import type { GBPLocation } from '@/lib/types/gbp';
import type { HoursData, DayOfWeek } from '@/lib/types/ground-truth';
```

Implement two exported functions:

1. **`mapGBPLocationToRow(gbpLocation, isPrimary)`** — Returns a `MappedLocation` object with all fields needed for a `locations` INSERT. See RFC §4.1 for the complete implementation.

2. **`mapGBPHours(regularHours)`** — Converts GBP `regularHours` periods to our `HoursData` format. See RFC §4.2 for the complete implementation. Key rules:
   - All 7 days initialized to `'closed'`
   - Only days present in `periods` are opened
   - Time format: `HH:MM` (24h, zero-padded)
   - Returns `null` if `regularHours` is undefined or has no periods

### 2B — Slug Generation

The mapper calls `toUniqueSlug(gbpLocation.title)`. Check if this utility exists:

```bash
grep -rn "toUniqueSlug\|slugify" lib/utils/ --include="*.ts"
```

If it doesn't exist, create a simple slug utility:

```typescript
// lib/utils/slug.ts
export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}
```

Use this in the mapper. The slug doesn't need to be globally unique — it's scoped to the org via RLS.

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

Implement the `importGBPLocation()` action per RFC §4.4:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getSafeAuthContext } from '@/lib/auth';
import { createServiceRoleClient, createClient } from '@/lib/supabase/server';
import { mapGBPLocationToRow } from '@/lib/services/gbp-mapper';
import { seedSOVQueries } from '@/lib/services/sov-seed';
import type { GBPLocation } from '@/lib/types/gbp';
import type { Json } from '@/lib/supabase/database.types';
import { z } from 'zod';

type ActionResult = { success: true } | { success: false; error: string };
```

The action must:
1. Authenticate via `getSafeAuthContext()`
2. Read `gbp_import_id` cookie → fetch from `pending_gbp_imports` → validate `org_id` + `expires_at`
3. Parse selected location index from input
4. Extract the `GBPLocation` from `locations_data[index]`
5. Call `mapGBPLocationToRow(gbpLocation, isPrimary)`
6. INSERT into `locations` table
7. UPSERT `location_integrations` row (platform='google', status='connected')
8. Seed SOV queries via `seedSOVQueries()`
9. Delete the `pending_gbp_imports` row (cleanup)
10. Delete the `gbp_import_id` cookie
11. `revalidatePath('/dashboard')` + `revalidatePath('/onboarding')`

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

### 6B — `app/api/auth/register/route.ts` — Redirect Change

Change the post-registration redirect from `/onboarding` to `/onboarding/connect`:

```typescript
// BEFORE:
return NextResponse.redirect(`${appUrl}/onboarding`);

// AFTER:
return NextResponse.redirect(`${appUrl}/onboarding/connect`);
```

**⚠️ EDGE CASE:** If `GOOGLE_CLIENT_ID` is not configured, the connect page should detect this and redirect straight to `/onboarding`. Check this in the connect page's server component:

```typescript
const gbpConfigured = !!process.env.GOOGLE_CLIENT_ID;
if (!gbpConfigured) redirect('/onboarding');
```

---

## Phase 7: Tests (Write FIRST — AI_RULES §4)

### 7A — `src/__tests__/unit/gbp-mapper.test.ts` (NEW)

Pure function tests — no mocks needed for the mapper itself.

**Test cases (minimum 15):**

```
describe('mapGBPHours')
  1.  ✅ maps standard 7-day schedule correctly
  2.  ✅ returns null when regularHours is undefined
  3.  ✅ returns null when periods array is empty
  4.  ✅ handles missing minutes (defaults to 00)
  5.  ✅ formats hours as zero-padded HH:MM
  6.  ✅ marks days without periods as "closed"
  7.  ✅ handles midnight crossover (closeTime hours=0 or hours=1)
  8.  ✅ ignores unknown day names gracefully

describe('mapGBPLocationToRow')
  9.  ✅ maps all address fields correctly
  10. ✅ joins multiple addressLines with ", "
  11. ✅ handles missing storefrontAddress (all address fields null)
  12. ✅ sets amenities to null (GBP doesn't expose them)
  13. ✅ maps google_place_id from metadata.placeId
  14. ✅ maps google_location_name from location.name
  15. ✅ passes isPrimary through unchanged
  16. ✅ handles missing optional fields (phone, website, metadata)
  17. ✅ generates a valid slug from title
```

### 7B — `src/__tests__/unit/gbp-import-action.test.ts` (NEW)

Mock-heavy tests for the `importGBPLocation()` server action.

**Test cases (minimum 8):**

```
describe('importGBPLocation')
  1.  ✅ inserts location with mapped hours_data from GBP
  2.  ✅ creates location_integrations row with platform='google'
  3.  ✅ sets is_primary=true when no existing primary location
  4.  ✅ sets is_primary=false when primary location already exists
  5.  ✅ calls seedSOVQueries with the new location
  6.  ✅ rejects unauthorized requests
  7.  ✅ rejects expired pending_gbp_imports (expires_at < now)
  8.  ✅ rejects when org_id doesn't match authenticated user
  9.  ✅ deletes pending_gbp_imports row after successful import
```

### 7C — `src/__tests__/unit/gbp-callback-locations.test.ts` (NEW)

Tests for the callback rewrite. Mock all external HTTP calls.

**Test cases (minimum 7):**

```
describe('GET /api/auth/google/callback — location flow')
  1.  ✅ auto-imports when exactly 1 GBP location → redirect to /dashboard
  2.  ✅ writes to pending_gbp_imports when 2+ locations → redirect to /onboarding/connect/select
  3.  ✅ sets gbp_import_id cookie for multi-location flow
  4.  ✅ redirects to /onboarding?source=gbp_no_accounts when 0 accounts
  5.  ✅ redirects to /onboarding?source=gbp_no_locations when 0 locations
  6.  ✅ redirects to /onboarding?source=gbp_failed on GBP API error
  7.  ✅ stores tokens in google_oauth_tokens before fetching locations
```

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
- `app/api/auth/register/route.ts` — **MODIFIED.** Post-registration redirect to /onboarding/connect.

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
- [ ] All 3 test files created and passing (30+ tests total)
- [ ] `npx vitest run` — ALL tests passing
- [ ] `npx tsc --noEmit` — zero type errors
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
| `app/api/auth/register/route.ts` | MODIFY | Redirect → /onboarding/connect |
| `src/__tests__/unit/gbp-mapper.test.ts` | CREATE | Mapper unit tests |
| `src/__tests__/unit/gbp-import-action.test.ts` | CREATE | Import action tests |
| `src/__tests__/unit/gbp-callback-locations.test.ts` | CREATE | Callback routing tests |
| `DEVLOG.md` | MODIFY | Sprint 89 entry |
| `docs/DEVLOG.md` | MODIFY | Sprint 89 entry |
| `docs/CLAUDE.md` | MODIFY | Directory entry, engine table, sprint count |
| `docs/09-BUILD-PLAN.md` | MODIFY | Phase 8 checkboxes |
| `docs/AI_RULES.md` | MODIFY (if applicable) | Cookie-pointer pattern |

**Total new files:** 10 (2 lib + 4 pages/components + 1 action + 3 test files)
**Total modified files:** 9 (+ DEVLOG × 2)
**Estimated scope:** Large (OAuth rewrite + new pages + server action + mapper service + 30+ tests)
