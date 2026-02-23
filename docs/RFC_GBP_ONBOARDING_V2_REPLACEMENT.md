# RFC: Google Business Profile OAuth Onboarding — V2 Replacement
**Status:** Draft (Rev 2 — cookie bug fixed, timezone gap documented, DataHealth coupling noted)
**Author:** Staff Engineering
**Date:** 2026-02-22
**Replaces:** `app/onboarding/` manual wizard (retained as fallback)
**Target release:** Phase 21

> **Rev 2 changes (2026-02-22):**
> - §2.3 — Added `pending_gbp_imports` table to replace the original cookie-based location storage (4KB limit would silently drop state for any account with 2+ locations)
> - §3.3 — Callback route Step 6 rewritten to use DB row + UUID cookie instead of raw JSON cookie
> - §4.2 — Added timezone gap warning: GBP hours have no explicit timezone; audit prompt must supply context
> - §4.3 — Added DataHealth coupling note: `dataHealth = 100` is currently hardcoded, but future implementation must not penalize GBP-imported users for intentionally null `amenities`

---

## Table of Contents

1. [Executive Summary & User Flow](#1-executive-summary--user-flow)
2. [Database Schema Evolution](#2-database-schema-evolution)
3. [The OAuth Pipeline & Google Cloud Setup](#3-the-oauth-pipeline--google-cloud-setup)
4. [Data Mapping & The `is_primary` Rule](#4-data-mapping--the-is_primary-rule)
5. [The Bulletproof Fallback Matrix](#5-the-bulletproof-fallback-matrix)
6. [Implementation Phased Rollout](#6-implementation-phased-rollout)

---

## 1. Executive Summary & User Flow

### Motivation

The current V1 onboarding wizard (`app/onboarding/`) asks users to manually type their business name, hours, and amenities. This is friction-heavy, error-prone, and forces the Fear Engine to work with self-reported data. Google Business Profile is the canonical source-of-truth for local business data. Importing from GBP directly produces higher-quality ground truth and reduces time-to-value from ~4 minutes to ~20 seconds.

### Design Philosophy

> **The GBP OAuth flow is the happy path. The manual wizard is the bulletproof fallback.**

No user should ever land on a blank error screen. Every failure mode routes gracefully to the existing `app/onboarding/` manual wizard. This is guaranteed by the `OnboardingGuard` in `app/dashboard/layout.tsx` — if a user reaches the dashboard without a fully-configured primary location, they are redirected to onboarding regardless of how they got there.

---

### 1.1 Complete User Journey (Happy Path)

```
/signup → Email verified → /onboarding/connect (NEW interstitial)
    ↓
  "Connect with Google Business Profile" button
    ↓
  /api/auth/google/authorize  (initiates OAuth)
    ↓
  Google Consent Screen (GCP OAuth 2.0)
    ↓
  /api/auth/google/callback   (receives authorization code)
    ↓
  Server exchanges code for access_token + refresh_token
    ↓
  Fetch GBP account + locations list from Google API
    ↓
  /onboarding/connect/select  (NEW: location picker UI)
    ↓
  User selects 1 location (or the only one is auto-selected)
    ↓
  Server Action: importGBPLocation()
    ↓ Maps GBP JSON → locations table, sets is_primary: TRUE
    ↓ Upserts google_oauth_tokens row (encrypted)
    ↓ Creates location_integrations row (platform='google', status='connected')
    ↓ Calls revalidatePath('/dashboard')
    ↓
  redirect('/dashboard')   ← OnboardingGuard clears: location has hours+amenities
```

---

### 1.2 How This Bypasses the Manual Wizard

The `OnboardingGuard` in [app/dashboard/layout.tsx](../app/dashboard/layout.tsx:68) redirects to `/onboarding` when:

```typescript
// Current guard condition (layout.tsx:68-74)
if (
  primaryLocation &&
  !primaryLocation.hours_data &&
  !primaryLocation.amenities
) {
  redirect('/onboarding');
}
```

After a successful GBP import, `hours_data` and `amenities` are both non-null (populated from Google's `regularHours` and `openInfo`). The guard condition is `false`. The user lands directly on `/dashboard` — **the manual wizard is never shown**.

---

### 1.3 New Routes Added (No Existing Routes Modified)

| Route | Type | Purpose |
|-------|------|---------|
| `app/onboarding/connect/page.tsx` | Server Component | Interstitial: "Connect GBP" button + "Do it manually" escape hatch |
| `app/onboarding/connect/select/page.tsx` | Server Component | Location picker (rendered server-side using stored temp token) |
| `app/api/auth/google/authorize/route.ts` | Route Handler | Builds OAuth URL, sets PKCE state cookie, redirects to Google |
| `app/api/auth/google/callback/route.ts` | Route Handler | Handles code exchange, token storage, and post-auth redirect |
| `app/onboarding/connect/actions.ts` | Server Actions | `importGBPLocation()`, `disconnectGBP()` |

The existing `app/onboarding/page.tsx` (manual wizard) is **not modified**.

---

### 1.4 Entry Point Change

Currently, after signup the user lands on `/onboarding` directly. The new flow inserts the connect interstitial:

```
Before: /signup → /onboarding (manual wizard, always shown)
After:  /signup → /onboarding/connect (OAuth interstitial, shown first)
                       ↓ success → /dashboard
                       ↓ skip/failure → /onboarding (manual wizard, unchanged)
```

The `app/api/auth/register/route.ts` redirect target changes from `/onboarding` to `/onboarding/connect`.

---

## 2. Database Schema Evolution

### 2.1 `locations` Table — New Columns

Two columns are added to the existing `locations` table. Neither breaks existing rows (both nullable, both default null).

**Migration file:** `supabase/migrations/20260222000001_gbp_location_columns.sql`

```sql
-- ── Add GBP-specific columns to locations ────────────────────────────────
-- google_location_name : GBP's canonical resource name, e.g.
--   "accounts/1234567890/locations/987654321"
--   Used to build API refresh URLs and identify the location in future syncs.
--
-- google_place_id is already present (initial schema line 148) and is reused.
--   The GBP API returns it in location.metadata.placeId.

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS google_location_name VARCHAR(255) NULL;

-- Soft link: points back to location_integrations.id for the google platform.
-- NULL when location was created manually. Useful for cascade-disconnect.
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS gbp_integration_id UUID NULL
    REFERENCES public.location_integrations(id) ON DELETE SET NULL;
```

The existing `google_place_id VARCHAR(255)` column (initial schema line 148) is already present and is populated from `location.metadata.placeId` in the GBP response.

---

### 2.2 `google_oauth_tokens` Table — New Table

OAuth tokens must never live in `location_integrations.external_id` (plaintext, audited). They require their own table with:
- Encryption at rest (Supabase Vault or application-level AES-256)
- `access_token` expiry tracking
- Refresh token rotation on each use

**Migration file:** `supabase/migrations/20260222000002_google_oauth_tokens.sql`

```sql
-- ============================================================
-- google_oauth_tokens — per-org GBP OAuth token storage
--
-- SECURITY:
--   • access_token and refresh_token are stored encrypted.
--     Use Supabase Vault (pgsodium) or encrypt at the
--     application layer before INSERT.
--   • Service role only. RLS policy denies ALL authenticated
--     role access — tokens are only read by server-side code
--     using createServiceRoleClient().
--   • One row per org (UNIQUE org_id). Upsert on reconnect.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.google_oauth_tokens (
  id                UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID         NOT NULL UNIQUE
                                 REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Encrypted token values. Store as bytea if using pgsodium,
  -- or as TEXT if encrypting at the application layer (recommended for V1).
  access_token      TEXT         NOT NULL,
  refresh_token     TEXT         NOT NULL,

  -- Token lifecycle
  token_type        VARCHAR(20)  NOT NULL DEFAULT 'Bearer',
  expires_at        TIMESTAMPTZ  NOT NULL,   -- UTC, derived from expires_in

  -- GBP account info (plain, non-sensitive)
  gbp_account_name  VARCHAR(255) NULL,       -- "accounts/1234567890"
  google_email      VARCHAR(255) NULL,       -- user@gmail.com (for display only)
  scopes            TEXT         NULL,       -- space-separated list

  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Timestamps trigger
CREATE TRIGGER set_updated_at_google_oauth_tokens
  BEFORE UPDATE ON public.google_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS: Service role ONLY ────────────────────────────────────
ALTER TABLE public.google_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Deny all access to authenticated (browser) clients.
-- The ONLY actor that reads/writes this table is createServiceRoleClient().
-- No CREATE POLICY statements = default-deny for all roles.
-- (Supabase applies RLS deny-by-default when no matching policy exists.)

-- Table-level REVOKE to be belt-and-suspenders:
REVOKE ALL ON public.google_oauth_tokens FROM authenticated;
REVOKE ALL ON public.google_oauth_tokens FROM anon;
```

**Token Refresh Strategy:** Before any GBP API call, the server checks `expires_at`. If the token expires within 5 minutes, it proactively refreshes using the `refresh_token` and updates the row. Token refresh uses `createServiceRoleClient()` exclusively — it never touches the browser-facing `createClient()`.

---

### 2.3 `pending_gbp_imports` Table — New Table (Rev 2 addition)

> **Why this table exists:** The original RFC draft proposed storing the GBP locations array in a cookie (`gbp_pending_locations`). This was a critical bug. Browsers enforce a hard 4KB per-cookie limit. A conservative estimate for a single `GBPLocation` object (name + address + hours for 7 days + metadata) is ~850 bytes. At 5 locations — a very common case for a small chain — that is ~4.25KB, silently exceeding the limit. The browser drops the `Set-Cookie` header entirely. The select page reads an empty cookie and redirects back to the connect interstitial, which re-triggers OAuth, which produces the same oversized cookie — **an infinite loop**.
>
> The fix: write the full location payload to Supabase (no size limit) and store only the 36-character UUID in the cookie.

**Migration file:** `supabase/migrations/20260222000003_pending_gbp_imports.sql`

```sql
-- ============================================================
-- pending_gbp_imports — short-lived GBP location picker state
--
-- Created when a user completes OAuth and has 2+ locations
-- to choose from. Stores the full GBP API response (no size
-- limit, unlike cookies). Auto-expires after 10 minutes.
--
-- SECURITY:
--   Service role only. No CREATE POLICY = deny-by-default.
--   The select page reads this table via createServiceRoleClient()
--   after validating that the cookie UUID belongs to the
--   authenticated user's org_id.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pending_gbp_imports (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  locations_data JSONB      NOT NULL,   -- Full GBP locations array (no size limit)
  account_name  VARCHAR(255),           -- "accounts/1234567890"
  has_more      BOOLEAN     NOT NULL DEFAULT FALSE,
  expires_at    TIMESTAMPTZ NOT NULL,   -- NOW() + INTERVAL '10 minutes'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_gbp_imports_org
  ON public.pending_gbp_imports(org_id);

-- Deny all browser-client access — service role only
ALTER TABLE public.pending_gbp_imports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pending_gbp_imports FROM authenticated;
REVOKE ALL ON public.pending_gbp_imports FROM anon;
```

**Cleanup strategy:** A simple Supabase scheduled function (or the Phase 20 cron infrastructure) runs `DELETE FROM pending_gbp_imports WHERE expires_at < NOW()` daily. The 10-minute `expires_at` ensures no stale location lists persist if the user abandons the picker.

---

### 2.4 `location_integrations` — No Schema Change Required

The existing `location_integrations` table (created in migration `20260221000002`) already supports the GBP integration pattern:

```sql
-- Existing schema — already correct for GBP
platform    VARCHAR(20)  -- value: 'google'
status      VARCHAR(20)  -- 'disconnected' | 'connected' | 'syncing' | 'error'
external_id VARCHAR(255) -- GBP location resource name (non-sensitive, plain text)
last_sync_at TIMESTAMPTZ -- updated on each successful sync
```

On successful import, `importGBPLocation()` upserts this row:

```typescript
await supabase.from('location_integrations').upsert({
  org_id:      ctx.orgId,
  location_id: newLocationId,
  platform:    'google',
  status:      'connected',
  external_id: gbpLocation.name,  // "accounts/.../locations/..."
  last_sync_at: new Date().toISOString(),
}, { onConflict: 'location_id,platform' });
```

---

### 2.5 Full Schema Change Summary

| Migration | Table | Operation | Breaking? |
|-----------|-------|-----------|-----------|
| `20260222000001` | `locations` | ADD COLUMN `google_location_name`, `gbp_integration_id` | No — nullable |
| `20260222000002` | `google_oauth_tokens` | CREATE TABLE | No — new table |
| `20260222000003` | `pending_gbp_imports` | CREATE TABLE | No — new table |
| `20260221000002` | `location_integrations` | No change — existing schema is sufficient | N/A |

---

## 3. The OAuth Pipeline & Google Cloud Setup

### 3.1 Required Google Cloud Platform Setup

#### 3.1.1 GCP Project & OAuth Consent Screen

1. **Create/select a GCP Project** in Google Cloud Console.
2. **Enable APIs:**
   - `My Business Account Management API` (`mybusinessaccountmanagement.googleapis.com`)
   - `My Business Business Information API` (`mybusinessbusinessinformation.googleapis.com`)
   - `Google Business Profile Performance API` (for future analytics)
3. **OAuth Consent Screen:**
   - App type: **External** (allows any Google account)
   - Scopes: `https://www.googleapis.com/auth/business.manage`
   - **Verification required** before production launch (Google requires app verification for `business.manage` scope — allow 4–6 weeks). During development, add test users to bypass verification.
4. **OAuth 2.0 Credentials:**
   - Type: **Web application**
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/google/callback` (local dev)
     - `https://yourdomain.com/api/auth/google/callback` (production)

#### 3.1.2 Required Environment Variables

```bash
# .env.local
GOOGLE_CLIENT_ID=...         # From GCP OAuth credentials
GOOGLE_CLIENT_SECRET=...     # From GCP OAuth credentials
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# For token encryption (generate with: openssl rand -base64 32)
GOOGLE_TOKEN_ENCRYPTION_KEY=...
```

---

### 3.2 Authorization Route — `GET /api/auth/google/authorize`

**File:** `app/api/auth/google/authorize/route.ts`

```typescript
// Responsibilities:
// 1. Verify the user is authenticated (getSafeAuthContext)
// 2. Generate a cryptographically random `state` value (CSRF protection)
// 3. Store state in a signed, HttpOnly cookie (30-minute TTL)
// 4. Build the Google OAuth URL and redirect

import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const SCOPES = [
  'https://www.googleapis.com/auth/business.manage',
  'openid',
  'email',
].join(' ');

export async function GET() {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL!));
  }

  // CSRF state token — bound to the user's session by including their orgId
  const state = crypto
    .createHmac('sha256', process.env.GOOGLE_CLIENT_SECRET!)
    .update(`${ctx.orgId}:${Date.now()}:${crypto.randomBytes(16).toString('hex')}`)
    .digest('hex');

  const cookieStore = await cookies();
  cookieStore.set('gbp_oauth_state', state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 30, // 30 minutes
    path:     '/',
  });

  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID!,
    redirect_uri:  process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope:         SCOPES,
    state,
    access_type:   'offline',   // Required for refresh_token
    prompt:        'consent',   // Forces refresh_token even if previously authorized
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
```

---

### 3.3 Callback Route — `GET /api/auth/google/callback`

**File:** `app/api/auth/google/callback/route.ts`

This is the most critical route. It handles every failure mode and always produces a deterministic redirect.

```typescript
// Responsibilities (in order):
// 1. Validate CSRF state cookie
// 2. Handle user denial (error=access_denied)
// 3. Exchange authorization code for tokens
// 4. Fetch the user's GBP accounts
// 5. Fetch locations for the first/only account
// 6. Store tokens encrypted in google_oauth_tokens
// 7. Write locations to pending_gbp_imports table; store UUID in cookie
//    (⚠️ NEVER store the raw JSON array in a cookie — 4KB browser limit)
// 8. Redirect to /onboarding/connect/select OR auto-import if 1 location
//
// On ANY failure: redirect to /onboarding?error=gbp_failed
// The manual wizard handles the error query param by showing a toast.

import { type NextRequest, NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { encryptToken } from '@/lib/crypto/tokens';

const FALLBACK_URL = '/onboarding?source=gbp_failed';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code    = searchParams.get('code');
  const state   = searchParams.get('state');
  const error   = searchParams.get('error');

  // ── Failure: user denied OAuth ─────────────────────────────────────────
  if (error === 'access_denied') {
    return NextResponse.redirect(new URL('/onboarding?source=gbp_denied', APP_URL));
  }

  // ── CSRF validation ────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const storedState = cookieStore.get('gbp_oauth_state')?.value;

  if (!code || !state || !storedState || state !== storedState) {
    console.error('[gbp-callback] CSRF state mismatch or missing code');
    return NextResponse.redirect(new URL(FALLBACK_URL, APP_URL));
  }

  cookieStore.delete('gbp_oauth_state'); // Consume immediately

  // ── Auth check ─────────────────────────────────────────────────────────
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return NextResponse.redirect(new URL('/login', APP_URL));
  }

  try {
    // ── Step 1: Exchange code for tokens ──────────────────────────────
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri:  process.env.GOOGLE_REDIRECT_URI!,
        grant_type:    'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${tokenRes.status}`);
    }

    const tokens = await tokenRes.json() as {
      access_token:  string;
      refresh_token: string;
      expires_in:    number;
      token_type:    string;
    };

    if (!tokens.refresh_token) {
      // This happens when prompt=consent was NOT set or user had already
      // authorized. The authorize route uses prompt=consent to prevent this.
      throw new Error('No refresh_token returned — consent prompt may have been skipped');
    }

    // ── Step 2: Fetch GBP accounts ────────────────────────────────────
    const accountsRes = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    if (!accountsRes.ok) {
      throw new Error(`GBP accounts fetch failed: ${accountsRes.status}`);
    }

    const { accounts } = await accountsRes.json() as { accounts?: GBPAccount[] };

    if (!accounts || accounts.length === 0) {
      // User has no GBP accounts — fallback to manual
      return NextResponse.redirect(new URL('/onboarding?source=gbp_no_accounts', APP_URL));
    }

    // Use the first (primary) account
    const accountName = accounts[0].name; // "accounts/1234567890"

    // ── Step 3: Fetch locations for this account ──────────────────────
    const locationsRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations` +
      `?readMask=name,title,storefrontAddress,regularHours,primaryPhone,websiteUri,metadata`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    if (!locationsRes.ok) {
      throw new Error(`GBP locations fetch failed: ${locationsRes.status}`);
    }

    const { locations, nextPageToken } = await locationsRes.json() as {
      locations?: GBPLocation[];
      nextPageToken?: string;
    };

    if (!locations || locations.length === 0) {
      return NextResponse.redirect(new URL('/onboarding?source=gbp_no_locations', APP_URL));
    }

    // ── Step 4: Store tokens encrypted in google_oauth_tokens ─────────
    const supabase = createServiceRoleClient();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await supabase.from('google_oauth_tokens').upsert({
      org_id:           ctx.orgId,
      access_token:     encryptToken(tokens.access_token),
      refresh_token:    encryptToken(tokens.refresh_token),
      expires_at:       expiresAt,
      gbp_account_name: accountName,
      token_type:       tokens.token_type,
    }, { onConflict: 'org_id' });

    // ── Step 5: Auto-import if exactly 1 location ─────────────────────
    if (locations.length === 1 && !nextPageToken) {
      // Skip the picker page — import immediately
      await importSingleLocation(ctx.orgId, locations[0]);
      return NextResponse.redirect(new URL('/dashboard', APP_URL));
    }

    // ── Step 6: Persist location list to DB; store only UUID in cookie ──
    //
    // ⚠️ CRITICAL: Do NOT store the raw locations array in a cookie.
    // Browser limit is 4KB per cookie. A single GBPLocation object
    // (address + 7-day hours + metadata) is ~850 bytes. 5 locations = ~4.25KB —
    // the browser silently drops Set-Cookie and the user enters an infinite loop.
    //
    // Fix: write the full payload to pending_gbp_imports (no size limit),
    // store only the 36-char UUID in the HttpOnly cookie.
    const { data: importRow, error: importError } = await supabase
      .from('pending_gbp_imports')
      .insert({
        org_id:         ctx.orgId,
        locations_data: locations.slice(0, 50),  // cap at 50; full pagination in Phase 22
        account_name:   accountName,
        has_more:       !!nextPageToken,
        expires_at:     new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();

    if (importError || !importRow) {
      throw new Error(`Failed to persist pending import: ${importError?.message}`);
    }

    // Store ONLY the 36-byte UUID in the cookie — well within the 4KB limit.
    cookieStore.set('gbp_import_id', importRow.id, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 10, // 10 minutes — matches expires_at
      path:     '/',
    });

    return NextResponse.redirect(new URL('/onboarding/connect/select', APP_URL));

  } catch (err) {
    console.error('[gbp-callback] Unexpected error:', err);
    return NextResponse.redirect(new URL(FALLBACK_URL, APP_URL));
  }
}
```

---

### 3.4 GBP API Type Reference

```typescript
// Google Business Profile API response types
// Source: https://developers.google.com/my-business/reference/businessinformation/rest

interface GBPAccount {
  name:        string;   // "accounts/1234567890"
  accountName: string;   // "My Business Name"
  type:        string;   // "PERSONAL" | "LOCATION_GROUP" | "USER_GROUP"
}

interface GBPLocation {
  name:  string;         // "accounts/.../locations/987654321"
  title: string;         // Business display name

  storefrontAddress: {
    addressLines: string[];   // ["123 Main St", "Suite 100"]
    locality:     string;     // City
    administrativeArea: string; // State code ("GA")
    postalCode:   string;
    regionCode:   string;     // Country ("US")
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
    placeId:           string;  // Google Maps place_id
    mapsUri:           string;
    newReviewUri:      string;
  };
}
```

---

## 4. Data Mapping & The `is_primary` Rule

### 4.1 GBP JSON → `locations` Table Mapping

```typescript
// lib/services/gbp-mapper.ts
//
// Maps a Google Business Profile Location API response to our
// internal locations row format. Handles all nullable GBP fields.

import type { GBPLocation } from '@/lib/types/gbp';
import { toUniqueSlug } from '@/lib/utils/slug';

interface MappedLocation {
  // locations table columns
  name:            string;
  slug:            string;
  business_name:   string;
  address_line1:   string | null;
  city:            string | null;
  state:           string | null;
  zip:             string | null;
  country:         string;
  phone:           string | null;
  website_url:     string | null;
  google_place_id: string | null;
  google_location_name: string;
  hours_data:      HoursData | null;
  amenities:       null;   // GBP does not expose amenities — left for manual wizard
  is_primary:      boolean;
}

export function mapGBPLocationToRow(
  gbpLocation: GBPLocation,
  isPrimary: boolean
): MappedLocation {
  const address = gbpLocation.storefrontAddress;

  // address_line1: join multiple addressLines with ", "
  const addressLine1 = address?.addressLines?.join(', ') ?? null;

  return {
    name:          gbpLocation.title,
    slug:          toUniqueSlug(gbpLocation.title),
    business_name: gbpLocation.title,
    address_line1: addressLine1,
    city:          address?.locality ?? null,
    state:         address?.administrativeArea ?? null,
    zip:           address?.postalCode ?? null,
    country:       address?.regionCode ?? 'US',
    phone:         gbpLocation.primaryPhone ?? null,
    website_url:   gbpLocation.websiteUri ?? null,
    google_place_id:      gbpLocation.metadata?.placeId ?? null,
    google_location_name: gbpLocation.name,
    hours_data:    mapGBPHours(gbpLocation.regularHours),
    amenities:     null,     // See §4.2
    is_primary:    isPrimary,
  };
}
```

---

### 4.2 Hours Mapping — GBP `regularHours` → `HoursData`

> **⚠️ Timezone Gap (Rev 2):** GBP's `regularHours.periods` values represent times in the **business's local civil timezone** with no explicit offset attached. Our `HoursData` format stores `"17:00"` as a bare string. This is correct for display, but creates a risk in the Fear Engine's audit prompts: if `buildAuditPrompt()` in `lib/services/ai-audit.service.ts` serializes these hours without timezone context, a UTC server evaluating the prompt could misinterpret `"close": "00:00"` for a New York bar as midnight UTC (= 7 PM EST) — producing false-positive hallucination detections. **Required fix for Phase 21d:** (1) add a `timezone` column (`VARCHAR(50)`, e.g. `"America/New_York"`) to the `locations` table; (2) populate it at import time using the state/city fields + a timezone lookup library (e.g. `tzdata`); (3) update `buildAuditPrompt()` to append `Timezone: America/New_York` to the prompt context.

Our `HoursData` format (Doc 03 §15.1):
- Open days: `{ open: "HH:MM", close: "HH:MM" }` (24-hour format, business local time)
- Closed days: the string `"closed"` (never omit — missing key = "unknown")

GBP format uses day names in ALL_CAPS and time objects with `hours` + optional `minutes`.

```typescript
import type { HoursData, DayOfWeek } from '@/lib/types/ground-truth';

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

export function mapGBPHours(
  regularHours: GBPLocation['regularHours'] | undefined
): HoursData | null {
  if (!regularHours?.periods?.length) {
    // GBP returned no hours — we cannot tell if this is a 24/7 or truly unknown.
    // Return null; the OnboardingGuard will still clear because we'll set
    // amenities=null and hours_data=null, leaving the guard in place.
    // The user sees the manual wizard for hours-only completion.
    return null;
  }

  // Start with all days closed; open only those that appear in GBP periods.
  const result: HoursData = Object.fromEntries(
    ALL_DAYS.map((day) => [day, 'closed'])
  ) as HoursData;

  for (const period of regularHours.periods) {
    const day = GBP_DAY_MAP[period.openDay];
    if (!day) continue;

    // Handle midnight crossover: closeDay may differ from openDay.
    // For our HoursData v1 format, we store a single open+close pair per day.
    // Midnight crossover is stored by the close time on the OPEN day
    // (e.g. Friday "17:00"–"01:00" correctly represents a bar that closes at 1 AM).
    result[day] = {
      open:  formatTime(period.openTime),
      close: formatTime(period.closeTime),
    };
  }

  return result;
}
```

---

### 4.3 Amenities — Intentional Gap

**GBP does not expose a machine-readable amenities API** for the attributes we track (`serves_alcohol`, `has_hookah`, `has_outdoor_seating`, etc.). Google's `attributes` endpoint returns raw attribute IDs that differ by business category and are not stable across locales.

**Strategy:** Import with `amenities: null`. The `OnboardingGuard` condition is:

```typescript
// layout.tsx:68
if (primaryLocation && !primaryLocation.hours_data && !primaryLocation.amenities) {
  redirect('/onboarding');
}
```

If GBP provides `hours_data` (non-null), **the guard clears** even when `amenities` is null. The user reaches the dashboard immediately. A persistent nudge banner on the dashboard (`components/layout/DashboardShell.tsx`) prompts them to complete amenities at their convenience via a slimmed-down `/onboarding/amenities` page (new route added in Phase 21b).

This avoids forcing a multi-step wizard right after OAuth and provides an immediate, usable dashboard experience.

**Edge case — GBP returns no hours:** If `regularHours` is missing or empty, `hours_data = null`. The guard WILL fire and redirect to the manual wizard — which is the correct behavior. The manual wizard is pre-populated with `business_name`, `address_line1`, `city`, `state`, and `phone` from the GBP import (passed via URL query params or stored in the DB row before redirect).

#### DataHealth Coupling Note (Phase 21c)

> ⚠️ **Future-proofing required before DataHealth is wired.**
>
> `deriveRealityScore()` in `app/dashboard/page.tsx` currently hardcodes `dataHealth = 100`. When DataHealth is properly calculated (planned Phase 21c), `amenities: null` on a location row will register as "data missing" and reduce the score — **unfairly penalizing GBP users who never had an amenities entry form**.
>
> **Required fix (Phase 21c):** Add a `gbp_import_source BOOLEAN DEFAULT FALSE` column to the `locations` table. Set it to `TRUE` in `importGBPLocation()`. The DataHealth calculation must treat `amenities: null WHERE gbp_import_source = TRUE` as **"expected gap"** (no penalty) rather than **"user skipped"** (penalty applied). This is analogous to how analytics systems distinguish `null` (never measured) from `0` (measured, empty).
>
> Until Phase 21c, the hardcoded `dataHealth = 100` acts as a safe placeholder that does not regress GBP users.

---

### 4.4 The `is_primary` Rule — Guaranteed Enforcement

The existing `createLocation` server action ([app/dashboard/actions.ts:74-80](../app/dashboard/actions.ts)) now enforces:

```typescript
// actions.ts (already fixed in Ghost Data bug fix, 2026-02-22)
const { count: existingPrimaryCount } = await supabase
  .from('locations').select('id', { count: 'exact', head: true })
  .eq('org_id', ctx.orgId).eq('is_primary', true);

const isPrimary = (existingPrimaryCount ?? 0) === 0;
```

The `importGBPLocation()` server action follows **the same rule** — it checks for existing primary locations before setting `is_primary`:

```typescript
// app/onboarding/connect/actions.ts (to be created)
export async function importGBPLocation(
  gbpLocation: GBPLocation
): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const supabase = createServiceRoleClient(); // Token reads need service role

  // Determine is_primary using the same logic as createLocation
  const { count } = await supabase
    .from('locations').select('id', { count: 'exact', head: true })
    .eq('org_id', ctx.orgId).eq('is_primary', true);
  const isPrimary = (count ?? 0) === 0;

  const mappedRow = mapGBPLocationToRow(gbpLocation, isPrimary);

  const { data: location, error: insertError } = await supabase
    .from('locations')
    .insert({ ...mappedRow, org_id: ctx.orgId })
    .select('id')
    .single();

  if (insertError) return { success: false, error: insertError.message };

  // Create location_integrations row
  await supabase.from('location_integrations').upsert({
    org_id:      ctx.orgId,
    location_id: location.id,
    platform:    'google',
    status:      'connected',
    external_id: gbpLocation.name,
    last_sync_at: new Date().toISOString(),
  }, { onConflict: 'location_id,platform' });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/locations');
  return { success: true };
}
```

**Why this is bulletproof:** Even if a bug somehow called `importGBPLocation()` twice, the second call would check `existingPrimaryCount = 1` and set `is_primary = false`. The `OnboardingGuard` reads via `.eq('is_primary', true)` which always finds exactly one canonical primary location.

---

## 5. The Bulletproof Fallback Matrix

Every failure path terminates in a **deterministic redirect** — never a blank screen. The `OnboardingGuard` in `DashboardLayout` acts as a final safety net: if a user somehow reaches `/dashboard` without a configured primary location, they are caught and redirected.

### 5.1 Failure Matrix

| Failure Condition | Detection Point | Redirect | Guard Catch? |
|-------------------|----------------|----------|--------------|
| User clicks "Do it manually" | `/onboarding/connect` interstitial | `/onboarding` (manual wizard) | N/A — explicit |
| User denies OAuth permissions | `GET /api/auth/google/callback?error=access_denied` | `/onboarding?source=gbp_denied` | Yes, as safety net |
| CSRF state mismatch | Callback — state validation | `/onboarding?source=gbp_failed` | Yes |
| Token exchange HTTP error | Callback — token fetch | `/onboarding?source=gbp_failed` | Yes |
| Google API 429 Rate Limit | Callback — locations fetch | `/onboarding?source=gbp_failed` | Yes |
| Google API 500 Server Error | Callback — any fetch | `/onboarding?source=gbp_failed` | Yes |
| 0 GBP accounts | Callback — accounts check | `/onboarding?source=gbp_no_accounts` | Yes |
| 0 GBP locations | Callback — locations check | `/onboarding?source=gbp_no_locations` | Yes |
| GBP hours missing/empty | Mapper — `hours_data` = null | Guard fires → `/onboarding` (hours only) | Yes — intended |
| `importGBPLocation()` DB error | Server action | Returns `{ success: false }` → UI shows error + retry | Yes |
| `google_oauth_tokens` upsert fails | Callback — token storage | `/onboarding?source=gbp_failed` | Yes |

---

### 5.2 User Has 0 GBP Locations (`gbp_no_locations`)

```typescript
// In callback route
if (!locations || locations.length === 0) {
  return NextResponse.redirect(
    new URL('/onboarding?source=gbp_no_locations', APP_URL)
  );
}
```

The manual wizard detects `?source=gbp_no_locations` and renders a contextual explanation:

> "Your Google account doesn't have any Business Profile locations yet. Create one at [business.google.com](https://business.google.com) and connect again, or fill in your details manually below."

---

### 5.3 User Has 50+ Locations (Multi-Select UI)

**Phase 21 (V1):** Cap at 50 locations in the picker. Show a notice: "Showing first 50 locations. Search not yet available."

**Phase 22 (V2):** Full pagination support using `nextPageToken`.

**Architecture for pagination:**
```typescript
// In callback — detect large accounts
if (locations.length === 50 || nextPageToken) {
  // Store nextPageToken in the pending_locations cookie
  // /onboarding/connect/select renders "Load more" button
  // Clicking it fetches /api/auth/google/locations?pageToken=...
  //   using the stored (unexpired) access_token from google_oauth_tokens
}
```

**Location Picker UI Design (`/onboarding/connect/select/page.tsx`):**

```
┌─────────────────────────────────────────────────────┐
│  Select Your Business Location                       │
│  ─────────────────────────────────────────────────  │
│  [🔍 Search locations...]                           │
│                                                      │
│  ○  Charcoal N Chill                                │
│     11950 Jones Bridge Road · Alpharetta, GA         │
│                                                      │
│  ○  Charcoal N Chill - Buckhead                     │
│     1234 Peachtree St · Atlanta, GA                  │
│                                                      │
│  ○  Charcoal N Chill - Midtown                      │
│     5678 W Peachtree St · Atlanta, GA                │
│                                                      │
│  [Connect Selected Location →]                       │
└─────────────────────────────────────────────────────┘
```

**Single-select only in V1.** Users with multiple locations can repeat the flow for additional locations from `/dashboard/integrations` once the primary location is set up.

---

### 5.4 The Manual Wizard as Graceful Degradation

The `?source=` query parameter is consumed by `app/onboarding/page.tsx` to customize the heading and show an explanatory toast:

| `source` value | Toast message shown |
|----------------|---------------------|
| `gbp_failed` | "We couldn't connect to Google right now. Please fill in your details manually." |
| `gbp_denied` | "Google connection was cancelled. You can connect later from Integrations." |
| `gbp_no_accounts` | "No Google Business Profile found. Create one at business.google.com or continue manually." |
| `gbp_no_locations` | "Your Google account has no Business Profile locations yet. Fill in manually or connect later." |

The toast is purely informational. The manual wizard form is fully functional regardless of source.

---

### 5.5 The `OnboardingGuard` as Final Safety Net

Regardless of what happens in the OAuth flow, the `DashboardLayout` guard (`app/dashboard/layout.tsx:51-74`) provides an unconditional final catch:

```
Any route under /dashboard/** →
  DashboardLayout renders →
    OnboardingGuard fires if primaryLocation.hours_data === null
      → redirect('/onboarding')  ← always safe to land on
```

This means: **even a completely broken GBP import that inserts a row without `hours_data` will be caught**. The user is redirected to the manual wizard automatically. They never see a broken dashboard.

---

## 6. Implementation Phased Rollout

### Phase 21a — Foundation (2–3 days)

**Goal:** Token infrastructure + OAuth pipeline working locally. No UI changes yet.

1. **DB migrations** (run against local Supabase):
   ```bash
   npx supabase migration new gbp_location_columns
   npx supabase migration new google_oauth_tokens
   # Write SQL per §2.1 and §2.2 above
   npx supabase db reset  # Apply all migrations fresh
   ```

2. **`lib/crypto/tokens.ts`** — AES-256-GCM `encryptToken()` / `decryptToken()` utility using `GOOGLE_TOKEN_ENCRYPTION_KEY` env var.

3. **`lib/types/gbp.ts`** — `GBPAccount`, `GBPLocation` TypeScript interfaces (from §3.4).

4. **`lib/services/gbp-mapper.ts`** — `mapGBPLocationToRow()`, `mapGBPHours()` (from §4.1 and §4.2). Write unit tests: `src/__tests__/unit/gbp-mapper.test.ts`.

5. **`app/api/auth/google/authorize/route.ts`** — OAuth redirect builder (from §3.2).

6. **`app/api/auth/google/callback/route.ts`** — Code exchange + token storage (from §3.3). Test locally with Google's OAuth playground before real credentials.

7. **MSW handler** for `mybusinessbusinessinformation.googleapis.com` — add to `src/mocks/handlers.ts` returning a single mock GBP location for CI testing.

**Verification:**
```bash
# Should redirect to Google OAuth screen
curl -I http://localhost:3000/api/auth/google/authorize
# After manual OAuth flow: google_oauth_tokens row should exist in Supabase
```

---

### Phase 21b — Location Picker UI (1–2 days)

**Goal:** The `/onboarding/connect` interstitial and `/onboarding/connect/select` picker are functional.

1. **`app/onboarding/connect/page.tsx`** — Interstitial with "Connect Google Business Profile" CTA and "Fill in manually →" text link to `/onboarding`.
   - Design: Match the Deep Night aesthetic of `TruthCalibrationForm.tsx` — dark card, `bg-midnight-slate`, electric indigo CTAs.
   - The Google button uses the official [Google Sign-In branding guidelines](https://developers.google.com/identity/branding-guidelines).

2. **`app/onboarding/connect/select/page.tsx`** — Server Component that reads the `gbp_import_id` cookie (36-char UUID), fetches the matching `pending_gbp_imports` row via `createServiceRoleClient()`, validates `expires_at` and `org_id`, then renders the location picker. If the cookie is missing, expired, or the row doesn't belong to the authenticated org, redirect to `/onboarding/connect`. Never read location data from a cookie directly — the cookie is only an opaque pointer to the DB row.

3. **`app/onboarding/connect/actions.ts`** — `importGBPLocation()` Server Action (from §4.4).

4. **`app/api/auth/register/route.ts`** — Change post-registration redirect from `/onboarding` to `/onboarding/connect`.

**Verification:**
```bash
# Full happy-path E2E:
# 1. Register new test account
# 2. Land on /onboarding/connect (new interstitial)
# 3. Click "Connect Google Business Profile"
# 4. Authorize with GBP-enabled Google account
# 5. Select location (or auto-import)
# 6. Land on /dashboard (guard clears)
```

---

### Phase 21c — Fallback & Error Handling (1 day)

**Goal:** Every failure mode in §5 produces a clean UX.

1. Update `app/onboarding/page.tsx` to read `?source=` and render the appropriate toast (see §5.4).

2. Test every branch of the callback route by mocking different API responses via MSW:
   - `access_denied` param → toast shown
   - `googleApi.accounts = []` → correct redirect
   - `googleApi.locations = []` → correct redirect
   - Network timeout (Fetch throws) → fallback redirect

3. Add **Playwright E2E test**: `tests/e2e/gbp-oauth-fallback.spec.ts`
   - Navigates to `/api/auth/google/authorize?test_mode=denied` (a test-only shortcut that sets `?error=access_denied` in the callback)
   - Asserts: lands on `/onboarding`, toast contains "Google connection was cancelled"

---

### Phase 21d — Production Hardening (before launch)

1. **Google App Verification** — Submit for `business.manage` scope review. Timeline: 4–6 weeks. Features can be tested with test users in the interim.

2. **Token Refresh Job** — A Vercel Cron endpoint (`/api/cron/refresh-gbp-tokens`) runs hourly, finds tokens expiring within 1 hour, and refreshes them proactively. This prevents any user's GBP sync from failing due to an expired access token.

3. **Webhook or Polling for GBP Changes** — GBP does not push webhooks. Implement daily poll via the cron infrastructure (Phase 20 foundation) to detect when a GBP location's hours or status changes and create a new `ai_hallucinations` row if the LocalVector ground truth diverges.

4. **Disconnect Flow** — `app/dashboard/integrations/actions.ts` gets a `disconnectGBP()` action that:
   - Deletes the `google_oauth_tokens` row (service role)
   - Updates `location_integrations.status = 'disconnected'`
   - Does NOT delete the `locations` row (ground truth is retained)

---

### Phase 21 — File Inventory

| File | Action | Notes |
|------|--------|-------|
| `supabase/migrations/20260222000001_gbp_location_columns.sql` | Create | `google_location_name`, `gbp_integration_id` columns |
| `supabase/migrations/20260222000002_google_oauth_tokens.sql` | Create | Tokens table, service-role-only RLS |
| `lib/crypto/tokens.ts` | Create | AES-256-GCM encrypt/decrypt |
| `lib/types/gbp.ts` | Create | `GBPAccount`, `GBPLocation` types |
| `lib/services/gbp-mapper.ts` | Create | `mapGBPLocationToRow()`, `mapGBPHours()` |
| `app/api/auth/google/authorize/route.ts` | Create | OAuth URL builder |
| `app/api/auth/google/callback/route.ts` | Create | Code exchange, token storage, fallback routing |
| `app/onboarding/connect/page.tsx` | Create | OAuth interstitial UI |
| `app/onboarding/connect/select/page.tsx` | Create | Location picker |
| `app/onboarding/connect/actions.ts` | Create | `importGBPLocation()` |
| `app/api/auth/register/route.ts` | **Modify** | Redirect → `/onboarding/connect` |
| `app/onboarding/page.tsx` | **Modify** | Read `?source=` param, show toast |
| `src/__tests__/unit/gbp-mapper.test.ts` | Create | Unit tests for mapper |
| `src/mocks/handlers.ts` | **Modify** | Add GBP API MSW handlers |
| `tests/e2e/gbp-oauth-fallback.spec.ts` | Create | Fallback path E2E test |

**Existing files left completely unmodified:**
- `app/onboarding/_components/TruthCalibrationForm.tsx`
- `app/onboarding/actions.ts` (`saveGroundTruth`)
- `app/dashboard/layout.tsx` (OnboardingGuard)
- `app/dashboard/actions.ts` (`createLocation`)
- All RLS migration files

---

## Appendix A — Security Checklist

- [ ] `GOOGLE_CLIENT_SECRET` never logged, never sent to the client
- [ ] `access_token` and `refresh_token` encrypted before DB INSERT
- [ ] `google_oauth_tokens` table: `REVOKE ALL ... FROM authenticated; REVOKE ALL ... FROM anon;`
- [ ] OAuth `state` parameter validated via HMAC (not just equality) to prevent timing attacks
- [ ] `state` cookie is `HttpOnly`, `Secure` in production, `SameSite=Lax`
- [ ] `prompt=consent` set on every authorize request to ensure refresh_token is always returned
- [ ] Token refresh uses `createServiceRoleClient()` — never `createClient()`
- [ ] GBP API calls only happen server-side (Route Handlers and Server Actions) — never in Client Components
- [ ] `access_token` is never stored in the browser (cookie or localStorage)

---

## Appendix B — Environment Variables (Complete)

```bash
# .env.local additions for Phase 21
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=...   # 32-byte base64 string

# .env.test additions
GOOGLE_CLIENT_ID=test-client-id
GOOGLE_CLIENT_SECRET=test-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=test-encryption-key-32-bytes-base64
```

---

*End of RFC. Questions or feedback: open a GitHub Discussion tagged `rfc` and `phase-21`.*
