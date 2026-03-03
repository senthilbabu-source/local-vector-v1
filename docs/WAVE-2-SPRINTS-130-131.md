# LocalVector — Wave 2 Sprint Prompts
## Sprints 130 · 131 — API Approval Required

> **Claude Code Prompt — First-Pass Ready**
> Paste each sprint section separately into VS Code Claude Code (`Cmd+L` / `Ctrl+L`).
> **Always upload alongside:** `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`

---

## ⏳ Wave 2 Prerequisites — Submit API Registrations NOW

Do NOT wait until Wave 1 is done. Submit both registrations today and build Wave 1 in parallel.

| Registration | URL | Env Var | Typical Wait |
|---|---|---|---|
| Apple Business Connect | https://businessconnect.apple.com | `APPLE_BC_CLIENT_ID`, `APPLE_BC_CLIENT_SECRET`, `APPLE_BC_PRIVATE_KEY` | 2–4 weeks |
| Bing Places Partner API | https://bingplaces.com → Partner API | `BING_PLACES_API_KEY` | 1–3 weeks |

**What to write in the Apple BC registration:**
> "We operate a multi-tenant SaaS platform (LocalVector.ai) that helps local businesses maintain accurate listing data across AI search engines. We need API access to push ground-truth business data (name, address, hours, categories) to Apple Business Connect on behalf of our customers. We manage up to 10 locations per customer organization."

**What to write in the Bing Places registration:**
> "LocalVector.ai is a business intelligence SaaS. We need Bing Places Partner API access to synchronize verified business data for our Agency-tier customers."

---

---

# Sprint 130 — Apple Business Connect Sync

> **Claude Code Prompt — First-Pass Ready**
> **START THIS SPRINT ONLY AFTER:** `APPLE_BC_CLIENT_ID`, `APPLE_BC_CLIENT_SECRET`, and `APPLE_BC_PRIVATE_KEY` (ES256 private key) are in `.env.local`.
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`

---

## 🎯 Objective

Build a one-way nightly sync pipeline that pushes LocalVector's verified ground-truth location data to Apple Business Connect (ABC), making it available to Siri, Apple Maps, and Spotlight search.

**The correction flywheel:**
```
Owner corrects hallucination in LocalVector Truth Calibration
  ↓
Ground truth updated in locations table
  ↓
Nightly cron: computeLocationDiff() detects changed fields
  ↓
apple-bc-client.updateLocation() pushes changed fields only
  ↓
Apple Maps / Siri reflects correction within 24–48 hours
```

**The user sees (settings/connections):**
```
🍎 Apple Business Connect
──────────────────────────────
📍 Charcoal N Chill — Alpharetta
   Status: Connected ✅
   Last synced: 2h ago
   Fields updated: name, hours
   [Sync Now]  [Disconnect]

📍 Second Location
   Status: Unclaimed ⚠️
   [Start Claim Process →]
```

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                               — All rules, especially §4 §5 §13 §17 §124–§126 (NAP sync)
Read CLAUDE.md                                      — Architecture, services-are-pure rule
Read lib/nap-sync/nap-sync-service.ts               — COMPLETE FILE. Sync orchestrator pattern to mirror
Read lib/nap-sync/adapters/gbp-adapter.ts           — COMPLETE FILE. Adapter pattern for platform clients
Read lib/nap-sync/types.ts                          — GroundTruth type, AdapterResult interface
Read supabase/prod_schema.sql                       — locations, location_integrations, organizations tables
Read lib/supabase/database.types.ts                 — Full Database type
Read lib/plan-enforcer.ts                           — Agency-only pattern: planSatisfies('agency')
Read lib/auth/org-roles.ts                          — roleSatisfies(), assertOrgRole() patterns
Read app/api/cron/nap-sync/route.ts                 — Cron route pattern with CRON_SECRET auth
Read app/dashboard/settings/page.tsx                — Settings page structure to extend
Read vercel.json                                    — Current crons (19 after Wave 1); add 1 more
Read src/__fixtures__/golden-tenant.ts              — GOLDEN_TENANT structure (§4)
```

---

## 🏗️ Architecture — What to Build

```
lib/apple-bc/
  ├── apple-bc-client.ts      — ES256 JWT auth, token cache, getLocation/updateLocation/claimLocation
  ├── apple-bc-mapper.ts      — locations row → ABC format, category taxonomy translation
  ├── apple-bc-diff.ts        — computeLocationDiff() → changed fields only
  └── apple-bc-types.ts       — TypeScript interfaces for ABC API responses

supabase/migrations/[ts]_apple_bc.sql
  ├── apple_bc_connections     — per-location ABC connection state + claim status
  └── apple_bc_sync_log        — nightly sync audit log

app/api/cron/apple-bc-sync/route.ts   — Nightly 3:30 AM UTC cron
app/dashboard/settings/connections/   — Connection management UI (new page)
app/actions/apple-bc.ts               — connectAppleBC, disconnectAppleBC, manualSync
```

**Agency-only gate:** All ABC sync functionality requires `planSatisfies(plan, 'agency')`. Show upgrade prompt for Growth and below.

---

## 📐 Component Specs

### Component 1: Migration — `supabase/migrations/[timestamp]_apple_bc.sql`

Use timestamp `20260310000001` (after Wave 1 migrations).

```sql
-- Sprint 130: Apple Business Connect sync infrastructure.

CREATE TABLE IF NOT EXISTS public.apple_bc_connections (
  id                uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  org_id            uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id       uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  apple_location_id text,
  claim_status      text NOT NULL DEFAULT 'unclaimed'
                      CHECK (claim_status IN ('unclaimed', 'pending', 'claimed', 'error')),
  last_synced_at    timestamptz,
  sync_status       text CHECK (sync_status IN ('ok', 'error', 'pending', 'no_changes')),
  sync_error        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id)
);

CREATE TABLE IF NOT EXISTS public.apple_bc_sync_log (
  id               uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id      uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  synced_at        timestamptz NOT NULL DEFAULT now(),
  fields_updated   text[] DEFAULT '{}',
  status           text NOT NULL CHECK (status IN ('success', 'error', 'no_changes', 'skipped')),
  error_message    text,
  apple_response   jsonb
);

-- RLS: org member read, service role write
ALTER TABLE public.apple_bc_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation_select" ON public.apple_bc_connections
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "service_role_all" ON public.apple_bc_connections
  FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.apple_bc_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation_select" ON public.apple_bc_sync_log
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "service_role_all" ON public.apple_bc_sync_log
  FOR ALL USING (auth.role() = 'service_role');

-- Trigger: update updated_at on apple_bc_connections
CREATE TRIGGER set_apple_bc_connections_updated_at
  BEFORE UPDATE ON public.apple_bc_connections
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
```

---

### Component 2: `lib/apple-bc/apple-bc-types.ts` — NEW

```typescript
// Apple Business Connect API response types.
// Minimal — only fields LocalVector writes/reads.

export interface ABCLocation {
  locationId: string;           // Apple's internal ID
  displayName: string;
  address: ABCAddress;
  telephone?: string;           // Must be E.164: +14045551234
  regularHours?: ABCHours[];
  categories?: string[];        // Apple category IDs
  status?: 'OPEN' | 'CLOSED_PERMANENTLY' | 'CLOSED_TEMPORARILY';
  websiteUrl?: string;
}

export interface ABCAddress {
  addressLine1: string;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  country: string;  // ISO 3166-1 alpha-2, e.g. "US"
}

export interface ABCHours {
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  openTime?: string;   // "HH:MM" 24-hour
  closeTime?: string;  // "HH:MM" 24-hour
  isClosed?: boolean;
}

export interface ABCSyncResult {
  locationId: string;
  appleLocationId: string | null;
  fieldsUpdated: string[];
  status: 'success' | 'error' | 'no_changes' | 'skipped';
  errorMessage?: string;
}

// Apple category taxonomy — top 20 mapped to LocalVector categories
export const APPLE_CATEGORY_MAP: Record<string, string> = {
  'Restaurant': 'RESTAURANT',
  'FoodEstablishment': 'RESTAURANT',
  'BarOrPub': 'BAR',
  'NightClub': 'NIGHTCLUB',
  'Cafe': 'COFFEE_SHOP',
  'Physician': 'MEDICAL_OFFICE',
  'Dentist': 'DENTIST',
  'MedicalClinic': 'MEDICAL_CLINIC',
  'LegalService': 'LAWYER',
  'Attorney': 'LAWYER',
  'RealEstateAgent': 'REAL_ESTATE',
  'HairSalon': 'HAIR_SALON',
  'GymOrFitnessCenter': 'GYM',
  'Hotel': 'HOTEL',
  'RetailStore': 'SHOPPING',
  'AutoRepair': 'AUTO_REPAIR',
  'Bakery': 'BAKERY',
  'PetStore': 'PET_STORE',
  'LodgingBusiness': 'LODGING',
  'Store': 'SHOPPING',
};
```

---

### Component 3: `lib/apple-bc/apple-bc-mapper.ts` — NEW

```typescript
// lib/apple-bc/apple-bc-mapper.ts — Sprint 130
// Maps LocalVector locations row → Apple BC format.
// PURE FUNCTIONS — no I/O.

import type { ABCLocation, ABCHours } from './apple-bc-types';
import { APPLE_CATEGORY_MAP } from './apple-bc-types';

/**
 * Format a phone number to E.164 format.
 * Input: any format. Output: +1XXXXXXXXXX or original if cannot convert.
 */
export function toE164(phone: string | null): string | undefined {
  if (!phone) return undefined;
  // Strip everything except digits and leading +
  const digits = phone.replace(/[^\d+]/g, '');
  // US numbers: 10 digits → +1XXXXXXXXXX
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  // Already E.164
  if (/^\+\d{10,15}$/.test(digits)) return digits;
  // 11 digits starting with 1 → +1XXXXXXXXXX
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  return undefined; // Cannot convert — omit field
}

/**
 * Convert LocalVector hours_data JSONB to ABC regularHours array.
 */
export function toABCHours(
  hours_data: Record<string, { open?: string; close?: string; closed?: boolean } | null> | null,
): ABCHours[] {
  if (!hours_data) return [];

  const dayMap: Record<string, ABCHours['dayOfWeek']> = {
    monday: 'MONDAY', tuesday: 'TUESDAY', wednesday: 'WEDNESDAY',
    thursday: 'THURSDAY', friday: 'FRIDAY', saturday: 'SATURDAY', sunday: 'SUNDAY',
  };

  const result: ABCHours[] = [];
  for (const [day, hours] of Object.entries(hours_data)) {
    const abcDay = dayMap[day.toLowerCase()];
    if (!abcDay) continue;

    if (!hours || hours.closed) {
      result.push({ dayOfWeek: abcDay, isClosed: true });
    } else if (hours.open && hours.close) {
      result.push({ dayOfWeek: abcDay, openTime: hours.open, closeTime: hours.close });
    }
  }

  return result;
}

/**
 * Map LocalVector categories JSONB array to Apple BC category IDs.
 * Returns up to 3 Apple category IDs.
 */
export function toABCCategories(categories: unknown[] | null): string[] {
  if (!Array.isArray(categories) || categories.length === 0) return [];

  return categories
    .map(cat => APPLE_CATEGORY_MAP[String(cat)] ?? null)
    .filter((c): c is string => c !== null)
    .slice(0, 3);
}

/**
 * Map LocalVector operational_status to ABC status.
 */
export function toABCStatus(
  operational_status: string | null,
): 'OPEN' | 'CLOSED_PERMANENTLY' | 'CLOSED_TEMPORARILY' {
  switch (operational_status?.toUpperCase()) {
    case 'CLOSED_PERMANENTLY': return 'CLOSED_PERMANENTLY';
    case 'CLOSED_TEMPORARILY': return 'CLOSED_TEMPORARILY';
    default: return 'OPEN';
  }
}

/**
 * Build an ABCLocation from a LocalVector locations row.
 * Only includes non-null fields (partial update safety).
 */
export function buildABCLocation(loc: {
  name: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  website_url: string | null;
  hours_data: unknown;
  categories: unknown;
  operational_status: string | null;
}): Partial<ABCLocation> {
  const result: Partial<ABCLocation> = {};

  result.displayName = loc.name;

  if (loc.address_line1 && loc.city && loc.state) {
    result.address = {
      addressLine1: loc.address_line1,
      city: loc.city,
      stateOrProvince: loc.state,
      postalCode: loc.zip ?? '',
      country: 'US',
    };
  }

  const phone = toE164(loc.phone);
  if (phone) result.telephone = phone;

  if (loc.website_url) result.websiteUrl = loc.website_url;

  const hours = toABCHours(loc.hours_data as Record<string, { open?: string; close?: string; closed?: boolean } | null>);
  if (hours.length > 0) result.regularHours = hours;

  const cats = toABCCategories(loc.categories as unknown[]);
  if (cats.length > 0) result.categories = cats;

  result.status = toABCStatus(loc.operational_status);

  return result;
}
```

---

### Component 4: `lib/apple-bc/apple-bc-diff.ts` — NEW

```typescript
// lib/apple-bc/apple-bc-diff.ts — Sprint 130
// Computes field-level diff between LocalVector ground truth and Apple BC data.
// Returns only changed fields to prevent overwriting Apple's editorial data.
// PURE FUNCTION.

import type { ABCLocation } from './apple-bc-types';

export interface LocationDiff {
  hasChanges: boolean;
  changedFields: string[];
  updates: Partial<ABCLocation>;
}

/**
 * Compare LocalVector-mapped location with current Apple BC data.
 * Returns only the fields that differ.
 *
 * CRITICAL: Never send unchanged fields. Apple BC may have editorial
 * enrichments (photos, attributes) that we don't want to overwrite.
 */
export function computeLocationDiff(
  localVersion: Partial<ABCLocation>,
  appleVersion: Partial<ABCLocation> | null,
): LocationDiff {
  if (!appleVersion) {
    // Location not yet in ABC — full create
    return {
      hasChanges: true,
      changedFields: Object.keys(localVersion),
      updates: localVersion,
    };
  }

  const changedFields: string[] = [];
  const updates: Partial<ABCLocation> = {};

  // displayName
  if (localVersion.displayName && localVersion.displayName !== appleVersion.displayName) {
    changedFields.push('displayName');
    updates.displayName = localVersion.displayName;
  }

  // telephone
  if (localVersion.telephone && localVersion.telephone !== appleVersion.telephone) {
    changedFields.push('telephone');
    updates.telephone = localVersion.telephone;
  }

  // websiteUrl
  if (localVersion.websiteUrl && localVersion.websiteUrl !== appleVersion.websiteUrl) {
    changedFields.push('websiteUrl');
    updates.websiteUrl = localVersion.websiteUrl;
  }

  // status
  if (localVersion.status && localVersion.status !== appleVersion.status) {
    changedFields.push('status');
    updates.status = localVersion.status;
  }

  // address (compare as JSON string — deep comparison)
  if (localVersion.address) {
    const localAddr = JSON.stringify(localVersion.address);
    const appleAddr = JSON.stringify(appleVersion.address ?? {});
    if (localAddr !== appleAddr) {
      changedFields.push('address');
      updates.address = localVersion.address;
    }
  }

  // regularHours (compare as JSON string)
  if (localVersion.regularHours && localVersion.regularHours.length > 0) {
    const localHours = JSON.stringify(localVersion.regularHours);
    const appleHours = JSON.stringify(appleVersion.regularHours ?? []);
    if (localHours !== appleHours) {
      changedFields.push('regularHours');
      updates.regularHours = localVersion.regularHours;
    }
  }

  return {
    hasChanges: changedFields.length > 0,
    changedFields,
    updates,
  };
}
```

---

### Component 5: `lib/apple-bc/apple-bc-client.ts` — NEW

```typescript
// lib/apple-bc/apple-bc-client.ts — Sprint 130
//
// Thin API client for Apple Business Connect REST API.
// Authentication: ES256 JWT client credentials flow.
//
// SECURITY RULES (AI_RULES §162):
// - NEVER log the private key (APPLE_BC_PRIVATE_KEY env var)
// - NEVER log access tokens
// - Log only: location_id, status codes, field names
// - Token cache in module-level variable (1hr expiry)

import * as Sentry from '@sentry/nextjs';
import type { ABCLocation, ABCSyncResult } from './apple-bc-types';
import { buildABCLocation } from './apple-bc-mapper';
import { computeLocationDiff } from './apple-bc-diff';

const ABC_BASE_URL = 'https://api.businessconnect.apple.com/v1';

// Module-level token cache (resets on cold start, which is fine — just re-auths)
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Generate and cache an Apple BC access token.
 * Uses ES256 JWT assertion (client_credentials grant).
 */
async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken; // Still valid with 1-min buffer
  }

  const clientId = process.env.APPLE_BC_CLIENT_ID;
  const privateKey = process.env.APPLE_BC_PRIVATE_KEY;

  if (!clientId || !privateKey) {
    throw new Error('APPLE_BC_CLIENT_ID or APPLE_BC_PRIVATE_KEY not configured');
  }

  // Import jose for ES256 JWT signing (npm install jose)
  const { SignJWT, importPKCS8 } = await import('jose');

  const key = await importPKCS8(privateKey, 'ES256');
  const jwt = await new SignJWT({ sub: clientId })
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuer(clientId)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);

  const response = await fetch(`${ABC_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: jwt,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`ABC auth failed: ${response.status}`);
  }

  const data = await response.json() as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000);

  return cachedToken;
}

async function abcFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${ABC_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    signal: options.signal ?? AbortSignal.timeout(15_000),
  });
}

/** Search for an existing Apple BC listing by name + city. */
export async function searchABCLocation(
  name: string,
  city: string,
): Promise<ABCLocation | null> {
  try {
    const params = new URLSearchParams({ q: `${name} ${city}`, limit: '5' });
    const res = await abcFetch(`/locations?${params}`);
    if (!res.ok) return null;

    const data = await res.json() as { locations?: ABCLocation[] };
    if (!data.locations || data.locations.length === 0) return null;

    // Return first result (rank by name similarity in the cron)
    return data.locations[0] ?? null;
  } catch (err) {
    Sentry.captureException(err, { tags: { client: 'apple-bc', action: 'search' } });
    return null;
  }
}

/** Get a location by Apple location ID. */
export async function getABCLocation(appleLocationId: string): Promise<ABCLocation | null> {
  try {
    const res = await abcFetch(`/locations/${appleLocationId}`);
    if (!res.ok) return null;
    return res.json() as Promise<ABCLocation>;
  } catch (err) {
    Sentry.captureException(err, { tags: { client: 'apple-bc', action: 'get' } });
    return null;
  }
}

/** Update a location — partial fields only. Returns updated location. */
export async function updateABCLocation(
  appleLocationId: string,
  fields: Partial<ABCLocation>,
): Promise<boolean> {
  try {
    const res = await abcFetch(`/locations/${appleLocationId}`, {
      method: 'PATCH',
      body: JSON.stringify(fields),
    });
    return res.ok;
  } catch (err) {
    Sentry.captureException(err, { tags: { client: 'apple-bc', action: 'update' } });
    return false;
  }
}

/** Permanently close a location (separate endpoint from update). */
export async function closeABCLocation(appleLocationId: string): Promise<boolean> {
  try {
    const res = await abcFetch(`/locations/${appleLocationId}/close`, { method: 'POST' });
    return res.ok;
  } catch (err) {
    Sentry.captureException(err, { tags: { client: 'apple-bc', action: 'close' } });
    return false;
  }
}

/**
 * Full sync for one location: fetch current Apple data, diff, update if changed.
 * This is the main function called by the cron.
 */
export async function syncOneLocation(
  locationRow: Parameters<typeof buildABCLocation>[0],
  appleLocationId: string,
): Promise<ABCSyncResult> {
  // Handle permanent close separately
  if (locationRow.operational_status?.toUpperCase() === 'CLOSED_PERMANENTLY') {
    const closed = await closeABCLocation(appleLocationId);
    return {
      locationId: locationRow.name,
      appleLocationId,
      fieldsUpdated: closed ? ['operational_status'] : [],
      status: closed ? 'success' : 'error',
      errorMessage: closed ? undefined : 'closeLocation API call failed',
    };
  }

  const currentApple = await getABCLocation(appleLocationId);
  const localMapped = buildABCLocation(locationRow);
  const diff = computeLocationDiff(localMapped, currentApple);

  if (!diff.hasChanges) {
    return { locationId: locationRow.name, appleLocationId, fieldsUpdated: [], status: 'no_changes' };
  }

  const updated = await updateABCLocation(appleLocationId, diff.updates);

  return {
    locationId: locationRow.name,
    appleLocationId,
    fieldsUpdated: diff.changedFields,
    status: updated ? 'success' : 'error',
    errorMessage: updated ? undefined : 'PATCH request failed',
  };
}
```

---

### Component 6: `app/api/cron/apple-bc-sync/route.ts` — NEW

```typescript
// Schedule: "30 3 * * *" (3:30 AM UTC nightly — after FAQ cron at 3 AM)
// Kill switch: APPLE_BC_CRON_DISABLED=true
// Agency-only: skip orgs without agency plan

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: Request) {
  if (process.env.APPLE_BC_CRON_DISABLED === 'true') {
    return NextResponse.json({ skipped: true, reason: 'kill switch' });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createServiceRoleClient();

  // Fetch all active apple_bc_connections for claimed locations (Agency orgs only)
  const { data: connections } = await supabase
    .from('apple_bc_connections')
    .select(`
      id, location_id, apple_location_id, org_id,
      locations!inner(name, address_line1, city, state, zip, phone, website_url, hours_data, categories, operational_status),
      organizations!inner(plan_tier)
    `)
    .eq('claim_status', 'claimed')
    .not('apple_location_id', 'is', null);

  let synced = 0, failed = 0, skipped = 0;

  for (const conn of connections ?? []) {
    // Agency plan check
    if (!planSatisfies((conn.organizations as { plan_tier: string }).plan_tier, 'agency')) {
      skipped++;
      continue;
    }

    try {
      const result = await syncOneLocation(
        conn.locations as Parameters<typeof buildABCLocation>[0],
        conn.apple_location_id!,
      );

      // Update connection row
      await supabase
        .from('apple_bc_connections')
        .update({
          last_synced_at: new Date().toISOString(),
          sync_status: result.status,
          sync_error: result.errorMessage ?? null,
        })
        .eq('id', conn.id);

      // Write sync log
      await supabase.from('apple_bc_sync_log').insert({
        org_id: conn.org_id,
        location_id: conn.location_id,
        fields_updated: result.fieldsUpdated,
        status: result.status,
        error_message: result.errorMessage ?? null,
      });

      result.status === 'error' ? failed++ : synced++;
    } catch (err) {
      failed++;
      Sentry.captureException(err, { tags: { cron: 'apple-bc-sync', locationId: conn.location_id } });
    }
  }

  return NextResponse.json({ synced, failed, skipped, total: (connections ?? []).length });
}
```

Add to `vercel.json`:
```json
{ "path": "/api/cron/apple-bc-sync", "schedule": "30 3 * * *" }
```

---

### Component 7: `app/actions/apple-bc.ts` — NEW (server actions)

```typescript
'use server';
// connectAppleBC(locationId, appleLocationId) — owner links ABC location ID
// disconnectAppleBC(locationId) — owner unlinks, deletes connection row
// manualSync(locationId) — owner-only, calls syncOneLocation() on-demand
// All actions: assertOrgRole('owner') + Agency plan check
```

---

### Component 8: `app/dashboard/settings/connections/page.tsx` — NEW

```typescript
// Server component. Shows all platform connections for the org.
// Reads apple_bc_connections + bing_places_connections (Sprint 131).
// Per location: connection status badge, last synced, manual sync button.
// Unclaimed locations: "Start Claim Process" link + instructions.
// Plan gate: Growth orgs see "Upgrade to Brand Fortress" CTA.
// data-testid="connections-page", "apple-bc-section", "location-connection-[id]"
```

---

### Component 9: `src/__tests__/unit/apple-bc.test.ts` — NEW (target: 34 tests)

```typescript
describe('toE164', () => {
  it('converts 10-digit US number to E.164')
  it('converts 11-digit US number starting with 1 to E.164')
  it('passes through already-E.164 number unchanged')
  it('strips dashes, spaces, parens before converting')
  it('returns undefined for null input')
  it('returns undefined for unconvertible number (<10 digits)')
})

describe('toABCHours', () => {
  it('converts open/close hours to ABC format')
  it('marks closed days with isClosed=true')
  it('returns empty array for null hours_data')
  it('handles lowercase day names')
  it('ignores unrecognized day keys')
  it('omits days with neither hours nor closed flag')
})

describe('toABCCategories', () => {
  it('maps Restaurant category to RESTAURANT')
  it('maps NightClub to NIGHTCLUB')
  it('maps MedicalClinic to MEDICAL_CLINIC')
  it('returns empty array for null categories')
  it('returns empty array for unmapped category')
  it('caps at 3 categories')
})

describe('toABCStatus', () => {
  it('returns OPEN for OPERATIONAL status')
  it('returns CLOSED_PERMANENTLY for closed_permanently')
  it('returns CLOSED_TEMPORARILY for closed_temporarily')
  it('returns OPEN for null status')
})

describe('buildABCLocation', () => {
  it('includes all fields for complete location')
  it('omits telephone when phone is null')
  it('omits address when city is null')
  it('omits websiteUrl when null')
  it('omits regularHours when hours_data is null')
})

describe('computeLocationDiff', () => {
  it('returns full location when appleVersion is null (create case)')
  it('returns hasChanges=false when all fields match')
  it('returns changed displayName only')
  it('returns changed telephone only')
  it('returns changed address only')
  it('returns changed hours only')
  it('does NOT include unchanged fields in updates')
  it('handles CLOSED_PERMANENTLY status change')
})

describe('apple-bc-sync cron', () => {
  it('returns 401 without CRON_SECRET')
  it('returns skipped when kill switch active')
  it('skips non-Agency orgs')
  it('skips unclaimed connections')
  it('writes sync_log entry after each location')
})
```

---

## 🚫 What NOT to Do

1. **DO NOT log `APPLE_BC_PRIVATE_KEY` or access tokens** — Sentry is for errors only; never pass token/key values as extra context.
2. **DO NOT send unchanged fields to ABC** — `computeLocationDiff()` must gate every PATCH call. Apple BC may overwrite editorial data.
3. **DO NOT auto-claim locations** — the claim flow requires Apple's manual verification. UI guides owners through it; never attempt `claimLocation()` without explicit owner action.
4. **DO NOT call ABC API for non-Agency orgs** — `planSatisfies(plan, 'agency')` is required before every API call.
5. **DO NOT use `jose` as a peer import** — run `npm install jose` and import from `'jose'`. It supports ES256 JWT signing.
6. **DO NOT use `CLOSED_PERMANENTLY` with `updateLocation()`** — use the separate `closeLocation()` endpoint.
7. **DO NOT create a separate settings page per platform** — `/settings/connections` is the hub for all platforms.

---

## ✅ Definition of Done

- [ ] Migration: `apple_bc_connections` + `apple_bc_sync_log` tables with RLS
- [ ] `apple-bc-types.ts` — interfaces + `APPLE_CATEGORY_MAP` (20 categories)
- [ ] `apple-bc-mapper.ts` — `toE164`, `toABCHours`, `toABCCategories`, `buildABCLocation`
- [ ] `apple-bc-diff.ts` — `computeLocationDiff` pure function
- [ ] `apple-bc-client.ts` — ES256 JWT auth, token cache, CRUD methods
- [ ] Nightly cron `app/api/cron/apple-bc-sync/route.ts` — Agency-only, skip unclaimed
- [ ] `vercel.json` updated (now 20 crons)
- [ ] `app/actions/apple-bc.ts` — connect/disconnect/manualSync with role checks
- [ ] `app/dashboard/settings/connections/page.tsx` — per-location status UI
- [ ] 34 tests passing
- [ ] `npx vitest run` — ALL tests passing, 0 regressions
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] DEVLOG.md entry written

---

## 🔮 AI_RULES Addition

```markdown
## §162. Apple Business Connect Sync (Sprint 130)

Sync pipeline in `lib/apple-bc/`. Agency plan required for all operations.

* **NEVER log the private key or access tokens.** Log only location_id and status codes.
* **Partial update ONLY.** `computeLocationDiff()` gates every PATCH — never send unchanged fields.
* **Token cache:** Module-level, 1hr expiry with 60s buffer. Token refresh is automatic.
* **Claim flow is manual.** Never auto-claim. UI walks owner through Apple's verification.
* **`CLOSED_PERMANENTLY`** uses `closeABCLocation()` endpoint, not `updateABCLocation()`.
* **Agency-only gate:** `planSatisfies(plan, 'agency')` before every API call in cron and actions.
* **Category map:** `APPLE_CATEGORY_MAP` in `apple-bc-types.ts` — 20 categories. Unmapped categories omitted.
* **Migration:** `20260310000001_apple_bc.sql`. Tables: `apple_bc_connections`, `apple_bc_sync_log`.
* **Tests:** 34 Vitest.
```

---
---

# Sprint 131 — Bing Places Sync + Sync Orchestrator

> **Claude Code Prompt — First-Pass Ready**
> **START THIS SPRINT ONLY AFTER:** `BING_PLACES_API_KEY` is in `.env.local`.
> **BUILD AFTER:** Sprint 130 (Apple BC Sync) — reuses connection UI and sync-orchestrator pattern.
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`

---

## 🎯 Objective

Build the Bing Places sync pipeline (targeting Bing search, Microsoft Copilot, Edge local results) and the shared `sync-orchestrator.ts` that calls all connected platforms when a business owner updates their info.

**The key outcome:** After Sprint 131, a single edit in the Business Info Editor automatically queues sync to Google (existing GBP), Apple Maps (Sprint 130), and Bing/Copilot simultaneously.

```
Owner edits hours in Business Info Editor
  ↓
updateLocation() server action fires
  ↓
syncLocationToAll(locationId) — sync-orchestrator
  ├── Apple BC: syncOneLocation() [if claimed]
  └── Bing: syncOneBingLocation() [if connected]
```

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                               — All rules, especially §162 (Apple BC — Sprint 130)
Read CLAUDE.md                                      — Architecture
Read lib/apple-bc/                                  — COMPLETE DIRECTORY. Bing mirrors this exactly.
Read lib/apple-bc/apple-bc-mapper.ts                — COMPLETE FILE. Reuse E.164, category patterns
Read lib/apple-bc/apple-bc-diff.ts                  — COMPLETE FILE. Same diff logic for Bing
Read app/actions/apple-bc.ts                        — COMPLETE FILE. Same action pattern for Bing
Read app/dashboard/settings/connections/page.tsx    — COMPLETE FILE. Extend for Bing
Read app/dashboard/settings/business-info/          — ls + read actions.ts. Where sync-orchestrator is called FROM
Read supabase/prod_schema.sql                       — organizations, locations, location_integrations
Read lib/supabase/database.types.ts                 — Full Database type
Read lib/plan-enforcer.ts                           — planSatisfies() pattern
Read vercel.json                                    — Current 20 crons after Sprint 130; add 1 more
Read src/__fixtures__/golden-tenant.ts              — GOLDEN_TENANT structure (§4)
```

---

## 🏗️ Architecture — What to Build

```
lib/bing-places/
  ├── bing-places-types.ts     — BingLocation, BingHours, BING_CATEGORY_MAP
  ├── bing-places-mapper.ts    — locations row → Bing format (reuse E.164, category patterns)
  ├── bing-places-diff.ts      — same diff logic as apple-bc-diff (reuse computeLocationDiff)
  └── bing-places-client.ts    — API key auth, searchBusiness, getLocation, updateLocation

lib/sync/
  └── sync-orchestrator.ts     — syncLocationToAll(locationId) — master trigger

supabase/migrations/[ts]_bing_places.sql
  ├── bing_places_connections
  └── bing_places_sync_log

app/api/cron/bing-sync/route.ts  — Nightly 4:00 AM UTC cron
app/actions/bing-places.ts        — connect/disconnect/manualSync
app/dashboard/settings/connections/page.tsx — MODIFY to show Bing alongside Apple BC
```

---

## 📐 Component Specs

### Component 1: Migration — `supabase/migrations/[timestamp]_bing_places.sql`

Timestamp: `20260310000002`.

```sql
-- Sprint 131: Bing Places sync infrastructure.
-- Mirrors apple_bc_connections exactly.

CREATE TABLE IF NOT EXISTS public.bing_places_connections (
  id               uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id      uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  bing_listing_id  text,
  claim_status     text NOT NULL DEFAULT 'unclaimed'
                     CHECK (claim_status IN ('unclaimed', 'pending', 'claimed', 'error', 'conflict')),
  last_synced_at   timestamptz,
  sync_status      text CHECK (sync_status IN ('ok', 'error', 'pending', 'no_changes')),
  sync_error       text,
  conflict_note    text,   -- "Multiple listings found — manual review required"
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id)
);

CREATE TABLE IF NOT EXISTS public.bing_places_sync_log (
  id               uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id      uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  synced_at        timestamptz NOT NULL DEFAULT now(),
  fields_updated   text[] DEFAULT '{}',
  status           text NOT NULL CHECK (status IN ('success', 'error', 'no_changes', 'skipped')),
  error_message    text
);

-- RLS: mirror apple_bc tables
ALTER TABLE public.bing_places_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation_select" ON public.bing_places_connections
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "service_role_all" ON public.bing_places_connections
  FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.bing_places_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation_select" ON public.bing_places_sync_log
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "service_role_all" ON public.bing_places_sync_log
  FOR ALL USING (auth.role() = 'service_role');
```

---

### Component 2: `lib/bing-places/bing-places-types.ts` — NEW

```typescript
// Bing's schema is simpler than Apple's — closer to Google format.
export interface BingLocation {
  listingId?: string;
  businessName: string;
  address: BingAddress;
  phone?: string;           // E.164 format (same as Apple)
  website?: string;
  hours?: BingHours[];
  categories?: string[];    // Bing category IDs (Google-compatible for most)
  status?: 'OPEN' | 'CLOSED' | 'TEMPORARILY_CLOSED';
}

export interface BingAddress {
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface BingHours {
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  openTime?: string;   // "HH:MM" 24-hour
  closeTime?: string;
  isClosed?: boolean;
}

// Bing uses Google-compatible category IDs for most types
// (can reuse toABCCategories logic with different map values)
export const BING_CATEGORY_MAP: Record<string, string> = {
  'Restaurant': 'gcid:restaurant',
  'FoodEstablishment': 'gcid:restaurant',
  'BarOrPub': 'gcid:bar',
  'NightClub': 'gcid:night_club',
  'Cafe': 'gcid:cafe',
  'Physician': 'gcid:doctor',
  'Dentist': 'gcid:dentist',
  'MedicalClinic': 'gcid:medical_clinic',
  'LegalService': 'gcid:lawyer',
  'HairSalon': 'gcid:hair_salon',
  'GymOrFitnessCenter': 'gcid:gym',
  'Hotel': 'gcid:lodging',
  'RetailStore': 'gcid:store',
  'AutoRepair': 'gcid:car_repair',
  'Bakery': 'gcid:bakery',
};
```

---

### Component 3: `lib/bing-places/bing-places-mapper.ts` — NEW

```typescript
// Mirrors apple-bc-mapper.ts but for Bing's schema.
// REUSE toE164() from apple-bc-mapper (import directly).
// Bing hours: day name capitalized (not UPPERCASE like Apple).
// Bing address: streetAddress (not addressLine1).

import { toE164 } from '@/lib/apple-bc/apple-bc-mapper';  // reuse
import { BING_CATEGORY_MAP } from './bing-places-types';

export function toBingHours(hours_data: Record<string, unknown> | null): BingHours[]
export function toBingCategories(categories: unknown[] | null): string[]
export function buildBingLocation(loc: LocationRow): Partial<BingLocation>

// toBingHours: same logic as toABCHours but dayOfWeek is "Monday" not "MONDAY"
// toBingCategories: same cap-at-3 logic but uses BING_CATEGORY_MAP
```

---

### Component 4: `lib/bing-places/bing-places-client.ts` — NEW

```typescript
// Bing Places API: much simpler auth than Apple BC.
// Authentication: API key in Authorization header.
// Authorization: BingPlaces-ApiKey ${BING_PLACES_API_KEY}

const BING_BASE_URL = 'https://api.bingplaces.com/v1';

async function bingFetch(path: string, options: RequestInit = {}): Promise<Response>
  // Adds Authorization: BingPlaces-ApiKey header
  // AbortSignal.timeout(15_000)
  // Rate limit: 100 req/day (log warning at 80)

export async function searchBingBusiness(name: string, city: string): Promise<BingLocation[]>
  // May return multiple matches — caller must rank and choose
  // Return ALL matches (not just first) so cron can detect conflicts

export async function getBingLocation(listingId: string): Promise<BingLocation | null>
export async function updateBingLocation(listingId: string, fields: Partial<BingLocation>): Promise<boolean>
export async function closeBingLocation(listingId: string): Promise<boolean>

export async function syncOneBingLocation(
  locationRow: LocationRow,
  bingListingId: string,
): Promise<BingSyncResult>
  // Same pattern as syncOneLocation in apple-bc-client.ts
  // Uses computeLocationDiff (can reuse from apple-bc-diff if types align)
```

**Critical Bing edge case — conflict detection:**
```typescript
// When searchBingBusiness() returns >1 result for same name+city:
// → Set claim_status = 'conflict'
// → Set conflict_note = "Multiple listings found — manual review required"
// → DO NOT auto-select — show warning in UI
```

---

### Component 5: `lib/sync/sync-orchestrator.ts` — NEW (critical)

```typescript
// lib/sync/sync-orchestrator.ts — Sprint 131
//
// Triggers all connected platform syncs for a location when business info changes.
// Called from Business Info Editor after successful location update.
//
// CRITICAL RULES (AI_RULES §163):
// - syncLocationToAll() is the ONLY entry point for multi-platform sync
// - Never call apple-bc-client or bing-places-client directly from action files
// - Partial failure isolation: Apple failure does NOT block Bing
// - All errors are logged to Sentry independently

import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { syncOneLocation } from '@/lib/apple-bc/apple-bc-client';
import { syncOneBingLocation } from '@/lib/bing-places/bing-places-client';

export interface OrchestratorResult {
  locationId: string;
  platforms: Record<string, { status: string; fieldsUpdated?: string[]; error?: string }>;
}

/**
 * Sync a location to all connected platforms.
 * Fire-and-forget friendly — never throws.
 * Logs failures to Sentry without blocking the caller.
 */
export async function syncLocationToAll(
  locationId: string,
  supabase: SupabaseClient,
): Promise<OrchestratorResult> {
  const result: OrchestratorResult = { locationId, platforms: {} };

  // Fetch location data once
  const { data: location } = await supabase
    .from('locations')
    .select('name,address_line1,city,state,zip,phone,website_url,hours_data,categories,operational_status')
    .eq('id', locationId)
    .maybeSingle();

  if (!location) {
    return { ...result, platforms: { error: { status: 'location_not_found' } } };
  }

  // Apple BC
  try {
    const { data: abcConn } = await supabase
      .from('apple_bc_connections')
      .select('apple_location_id')
      .eq('location_id', locationId)
      .eq('claim_status', 'claimed')
      .maybeSingle();

    if (abcConn?.apple_location_id) {
      const abcResult = await syncOneLocation(location, abcConn.apple_location_id);
      result.platforms.apple_bc = { status: abcResult.status, fieldsUpdated: abcResult.fieldsUpdated };
    } else {
      result.platforms.apple_bc = { status: 'not_connected' };
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { orchestrator: 'apple_bc', locationId } });
    result.platforms.apple_bc = { status: 'error', error: err instanceof Error ? err.message : 'unknown' };
    // Continue to Bing regardless
  }

  // Bing Places
  try {
    const { data: bingConn } = await supabase
      .from('bing_places_connections')
      .select('bing_listing_id')
      .eq('location_id', locationId)
      .eq('claim_status', 'claimed')
      .maybeSingle();

    if (bingConn?.bing_listing_id) {
      const bingResult = await syncOneBingLocation(location, bingConn.bing_listing_id);
      result.platforms.bing = { status: bingResult.status, fieldsUpdated: bingResult.fieldsUpdated };
    } else {
      result.platforms.bing = { status: 'not_connected' };
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { orchestrator: 'bing', locationId } });
    result.platforms.bing = { status: 'error', error: err instanceof Error ? err.message : 'unknown' };
  }

  return result;
}
```

**Wire into Business Info Editor:**
In `app/dashboard/settings/business-info/actions.ts` (or wherever `updateLocation()` lives), add after successful DB write:
```typescript
// Sprint 131: Fire-and-forget sync to connected platforms
void syncLocationToAll(locationId, supabase);
```

---

### Component 6: `app/api/cron/bing-sync/route.ts` — NEW

```typescript
// Schedule: "0 4 * * *" (4:00 AM UTC nightly — 30 min after Apple BC at 3:30)
// Kill switch: BING_SYNC_CRON_DISABLED=true
// Same pattern as apple-bc-sync cron — Agency-only, skip unclaimed

// Rate limit awareness: log warning when daily_request_count > 80
// (Bing basic tier: 100 req/day)
```

Add to `vercel.json`:
```json
{ "path": "/api/cron/bing-sync", "schedule": "0 4 * * *" }
```

---

### Component 7: `src/__tests__/unit/bing-places.test.ts` — NEW (target: 22 tests)

```typescript
describe('toBingHours', () => {
  it('converts hours with capitalized day names (not UPPERCASE)')
  it('marks closed days with isClosed=true')
  it('returns empty array for null hours_data')
})

describe('toBingCategories', () => {
  it('maps Restaurant to gcid:restaurant')
  it('returns empty array for unmapped category')
  it('caps at 3 categories')
})

describe('buildBingLocation', () => {
  it('includes all fields for complete location')
  it('uses toE164 from apple-bc-mapper for phone')
  it('uses streetAddress key (not addressLine1)')
})

describe('sync-orchestrator', () => {
  it('calls both Apple BC and Bing when both connected')
  it('continues Bing sync when Apple BC throws')
  it('continues Apple BC sync when Bing throws')
  it('returns not_connected for unclaimed Apple BC connection')
  it('returns not_connected for unclaimed Bing connection')
  it('returns location_not_found when location row missing')
  it('logs Sentry independently per platform error')
  it('never throws — always returns OrchestratorResult')
})

describe('bing-sync cron', () => {
  it('returns 401 without CRON_SECRET')
  it('returns skipped when kill switch active')
  it('skips non-Agency orgs')
  it('skips locations without claimed connection')
  it('logs conflict warning when bing search returns multiple matches')
})

describe('Business Info Editor integration', () => {
  it('calls syncLocationToAll after successful location update')
  it('does not fail the update when syncLocationToAll throws')
})
```

---

## 🚫 What NOT to Do

1. **DO NOT call `syncOneLocation` or `syncOneBingLocation` directly from action files** — always use `syncLocationToAll()` from sync-orchestrator.
2. **DO NOT auto-select when Bing returns multiple matches** — set `claim_status = 'conflict'` and surface to the owner.
3. **DO NOT block the Business Info Editor save** on sync result — `syncLocationToAll()` is fire-and-forget (`void`).
4. **DO NOT share a token cache between Apple BC and Bing** — they use completely different auth (JWT vs API key).
5. **DO NOT re-create the connections settings page** — Sprint 130 created it. Extend with a Bing section.

---

## ✅ Definition of Done

- [ ] Migration: `bing_places_connections` + `bing_places_sync_log` with RLS
- [ ] `bing-places-types.ts` — interfaces + `BING_CATEGORY_MAP`
- [ ] `bing-places-mapper.ts` — reuses `toE164`, builds `BingLocation`
- [ ] `bing-places-client.ts` — API key auth, conflict detection, sync logic
- [ ] `sync-orchestrator.ts` — `syncLocationToAll()` with independent failure isolation
- [ ] Business Info Editor wired to call `syncLocationToAll()` fire-and-forget
- [ ] Nightly cron `bing-sync` route + `vercel.json` updated (21 crons)
- [ ] `app/actions/bing-places.ts` — connect/disconnect/manualSync
- [ ] Settings connections page extended with Bing section
- [ ] 22 tests passing
- [ ] `npx vitest run` — ALL tests passing, 0 regressions
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] DEVLOG.md entry written

---

## 🔮 AI_RULES Addition

```markdown
## §163. Bing Places Sync + Sync Orchestrator (Sprint 131)

* **`syncLocationToAll()` in `lib/sync/sync-orchestrator.ts` is the ONLY place** multi-platform sync is triggered. Never call apple-bc-client or bing-places-client directly from action files.
* **Partial failure isolation:** Apple BC failure never blocks Bing sync, and vice versa. Each platform's error is caught independently and logged to Sentry with its own tag.
* **Conflict detection:** When `searchBingBusiness()` returns >1 result, set `claim_status='conflict'`. Never auto-select.
* **Fire-and-forget from Business Info Editor:** `void syncLocationToAll(...)`. Never await it in a user-facing action.
* **Auth:** Bing uses `Authorization: BingPlaces-ApiKey ${BING_PLACES_API_KEY}`. No JWT. No token cache needed.
* **Category map:** `BING_CATEGORY_MAP` uses Google-compatible `gcid:` prefixed IDs.
* **Migration:** `20260310000002_bing_places.sql`. Tables: `bing_places_connections`, `bing_places_sync_log`.
* **Tests:** 22 Vitest.
```

---

## Wave 2 Execution Summary

| Sprint | Task | Blocker | Expected Start |
|--------|------|---------|----------------|
| **130** | Apple Business Connect Sync | `APPLE_BC_CLIENT_ID` + private key received | ~3–4 weeks after submission |
| **131** | Bing Places Sync + Orchestrator | `BING_PLACES_API_KEY` received + Sprint 130 done | ~2–3 weeks after submission |

**While waiting for approvals:** Build Waves 1 and 3. The registrations and code builds run in parallel.
