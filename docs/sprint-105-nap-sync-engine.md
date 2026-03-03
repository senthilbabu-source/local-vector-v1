# Sprint 105 — NAP Sync Engine: Listing Management Foundation

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`

---

## 🎯 Objective

Build the **NAP Sync Engine** — LocalVector's cross-platform listing accuracy layer. NAP stands for Name, Address, Phone. AI models (ChatGPT, Perplexity, Gemini, Siri, Google AI Overviews) pull business data from Google Business Profile, Yelp, Bing Places, and Apple Maps. If those listings are stale or wrong, AI answers about the business are wrong — and there is currently no automated way for a LocalVector customer to detect or fix this at scale.

This sprint wires the full pipeline:

1. **NAP Adapter Layer** — pluggable adapters that fetch live listing data from each platform via its API
2. **Discrepancy Detector** — compares live listing data against LocalVector's Ground Truth and produces a structured diff
3. **Platform Sync Service** — pushes corrections back to platforms that support write APIs (currently GBP); generates human-readable fix instructions for platforms without write APIs (Yelp, Apple Maps, Bing)
4. **NAP Health Score** — composite score (0–100) measuring cross-platform NAP consistency, surfaced on the dashboard
5. **Listing Health Dashboard Panel** — new dashboard section showing per-platform discrepancy cards with one-click fix CTAs or guided fix instructions
6. **Weekly Cron Job** — background Vercel cron that re-checks all active locations every 7 days and fires alerts for new discrepancies
7. **Database schema** — new tables: `listing_snapshots`, `nap_discrepancies`

**Why this matters:** LocalVector already excels at tracking *how often AI cites a business*. But the root cause of AI hallucinations about business data is upstream listing inaccuracy — wrong hours on Yelp, stale phone on Bing, outdated address on Apple Maps. This sprint closes that upstream gap. Without accurate cross-platform NAP data, every downstream engine (SOV, hallucination detection, content generation) is built on a cracked foundation.

**Gap being closed:** NAP Sync identified as critical infrastructure gap in the Sprint 105–111 roadmap. Starts at 0% → targeting 100%. Unblocks Schema Expansion (Sprint 106), Review Engine (Sprint 107), and Voice Optimization (Sprint 111).

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

Before writing ANY code, read these files in order. Do not skip any.

```
Read docs/AI_RULES.md                                  — All engineering rules (currently 41+)
Read CLAUDE.md                                         — Project context, architecture, patterns
Read MEMORY.md                                         — Key decisions and constraints
Read supabase/prod_schema.sql                          — Canonical schema
  § Find: locations table (name, address, phone, hours_data, operational_status, amenities)
  § Find: gbp_connections table (access_token, refresh_token, gbp_location_id, expires_at)
  § Find: orgs table (plan, subscription_status)
Read lib/supabase/database.types.ts                    — TypeScript DB types
Read src/__fixtures__/golden-tenant.ts                 — Golden Tenant fixtures (org_id: a0eebc99)
Read lib/gbp/gbp-data-mapper.ts                        — GBP field mapping (Sprint 89) — NAP adapter reuses types
Read lib/gbp/gbp-token-refresh.ts                      — Token refresh utility (Sprint 89) — reuse, do not re-implement
Read app/api/gbp/import/route.ts                       — GBP import route pattern (Sprint 89) — follow same auth pattern
Read lib/plan-enforcer.ts                              — Plan gating (NAP Sync is Growth+ feature)
Read lib/supabase/server.ts                            — createClient() vs createServiceRoleClient()
Read app/dashboard/page.tsx                            — Dashboard page to insert ListingHealthPanel
Read components/layout/Sidebar.tsx                     — NAV_ITEMS for reference (add "Listings" if not present)
Read app/dashboard/settings/page.tsx                   — Settings page (add platform credential management section)
Read vercel.json                                       — Existing cron config (add NAP sync cron alongside SOV cron)
```

**Specifically understand before writing code:**
- How `gbp_connections` stores tokens and how `gbp-token-refresh.ts` handles expiry — the NAP adapter reuses this
- The exact column types in `locations`: `name text`, `address text`, `phone text`, `hours_data jsonb`, `operational_status text`
- Existing RLS policies on `locations` and `gbp_connections` — the new tables must follow the same pattern
- The `createServiceRoleClient()` pattern for cron jobs (no user session in cron context)
- How the SOV cron is registered in `vercel.json` — follow the same pattern for the NAP sync cron

---

## 🏗️ Architecture — What to Build

### Platform Reality Check (Read Before Coding)

Each platform has different API capabilities. The adapter layer MUST respect these realities:

| Platform | Read API | Write API | Auth Method |
|----------|----------|-----------|-------------|
| Google Business Profile | ✅ Full (Sprint 89 already integrated) | ✅ Full (PATCH endpoint) | OAuth (existing gbp_connections) |
| Yelp | ✅ Partial (name, address, phone, hours via Fusion API) | ❌ None (Yelp Knowledge program only — not available) | API Key (env var) |
| Apple Maps | ✅ Limited (read via Maps Connect API — requires MapsConnect credentials) | ❌ None (portal only) | JWT (MapsConnect credentials) |
| Bing Places | ✅ Limited (read via Bing Local Search API — partial NAP fields only) | ❌ None (portal only) | API Key (env var) |

**Engineering rule:** Never fail silently on an unavailable platform. If credentials are missing for a platform, return `{ status: 'unconfigured' }` — do not throw. If the platform API is down, return `{ status: 'api_error', message }`. The discrepancy detector skips unconfigured/errored platforms gracefully.

---

### Component 1: NAP Adapter Interface & Platform Adapters — `lib/nap-sync/`

**Directory structure:**
```
lib/nap-sync/
  index.ts                    — barrel export
  types.ts                    — all shared types and interfaces
  adapters/
    base-adapter.ts           — abstract NAPAdapter class
    gbp-adapter.ts            — Google Business Profile adapter (reuses Sprint 89 GBP client)
    yelp-adapter.ts           — Yelp Fusion API adapter
    apple-maps-adapter.ts     — Apple Maps Connect adapter
    bing-adapter.ts           — Bing Local Search adapter
  nap-discrepancy-detector.ts — pure comparison function
  nap-health-score.ts         — composite score calculator
  nap-sync-service.ts         — orchestrator: fetch → diff → upsert to DB → push corrections
  nap-push-corrections.ts     — GBP write-back: PATCH to GBP API for auto-correctable fields
```

---

#### `lib/nap-sync/types.ts` — Shared Types

```typescript
/**
 * Canonical NAP data structure — the normalized shape all adapters must return.
 * Fields are optional: adapters return only what the platform provides.
 */
export interface NAPData {
  name?: string;
  address?: string;       // Full street address, normalized
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;         // E.164 format: +14705550123
  website?: string;
  hours?: Record<string, { open: string; close: string; closed: boolean }>; // Same as hours_data in LocalVector
  operational_status?: 'open' | 'closed_permanently' | 'closed_temporarily' | null;
}

/**
 * Platform identifiers.
 */
export type PlatformId = 'google' | 'yelp' | 'apple_maps' | 'bing';

/**
 * Result of a single adapter fetch attempt.
 */
export type AdapterResult =
  | { status: 'ok'; platform: PlatformId; data: NAPData; fetched_at: string }
  | { status: 'unconfigured'; platform: PlatformId; reason: string }
  | { status: 'api_error'; platform: PlatformId; message: string; http_status?: number }
  | { status: 'not_found'; platform: PlatformId };

/**
 * A single field-level discrepancy between Ground Truth and a platform's live data.
 */
export interface NAPField {
  field: keyof NAPData;
  ground_truth_value: string | null;
  platform_value: string | null;
}

/**
 * Full discrepancy report for a single platform.
 */
export interface PlatformDiscrepancy {
  platform: PlatformId;
  location_id: string;
  org_id: string;
  status: 'match' | 'discrepancy' | 'unconfigured' | 'api_error' | 'not_found';
  discrepant_fields: NAPField[];           // Empty if status === 'match'
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  auto_correctable: boolean;              // true only for GBP (write API available)
  detected_at: string;                   // ISO timestamp
  fix_instructions?: string;             // For non-auto-correctable platforms
}

/**
 * NAP Health Score — composite 0–100 across all platforms.
 */
export interface NAPHealthScore {
  score: number;           // 0–100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  platforms_checked: number;
  platforms_matched: number;
  critical_discrepancies: number;
  last_checked_at: string;
}

/**
 * Ground Truth — the authoritative data from LocalVector's locations table.
 */
export interface GroundTruth {
  location_id: string;
  org_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  website?: string;
  hours_data?: Record<string, { open: string; close: string; closed: boolean }>;
  operational_status?: string | null;
}

/**
 * Result of a full sync run for one location.
 */
export interface NAPSyncResult {
  location_id: string;
  org_id: string;
  health_score: NAPHealthScore;
  platform_results: AdapterResult[];
  discrepancies: PlatformDiscrepancy[];
  corrections_pushed: PlatformId[];      // Platforms where auto-correction was pushed
  corrections_failed: PlatformId[];
  run_at: string;
}
```

---

#### `lib/nap-sync/adapters/base-adapter.ts`

```typescript
/**
 * Abstract base class for all NAP platform adapters.
 * Each platform adapter extends this and implements fetchNAP().
 */
export abstract class NAPAdapter {
  abstract readonly platformId: PlatformId;

  /**
   * Fetch live NAP data for a given location from this platform.
   * Must NEVER throw — catch all errors and return AdapterResult with
   * status 'api_error' or 'unconfigured'.
   * 
   * @param locationId  — The LocalVector location UUID
   * @param orgId       — The org UUID (for credential lookup)
   * @param context     — Platform-specific identifiers (e.g. gbp_location_id, yelp_business_id)
   */
  abstract fetchNAP(
    locationId: string,
    orgId: string,
    context: PlatformContext,
  ): Promise<AdapterResult>;
}

/**
 * Platform-specific context passed to each adapter.
 * Populated from the listing_platform_ids table (Component 8).
 */
export interface PlatformContext {
  gbp_location_id?: string;     // "locations/123456789"
  yelp_business_id?: string;    // "charcoal-n-chill-alpharetta"
  apple_maps_id?: string;       // Apple Maps place ID
  bing_listing_id?: string;     // Bing Places listing ID
}
```

---

#### `lib/nap-sync/adapters/gbp-adapter.ts`

```typescript
/**
 * GBP NAP Adapter — reads live NAP data from Google Business Profile.
 * Reuses the GBP token refresh utility from Sprint 89.
 * Reuses the GBP field mapper from Sprint 89 (mapGBPToLocation).
 *
 * GBP API endpoint:
 * GET https://mybusinessbusinessinformation.googleapis.com/v1/{name}
 *   ?readMask=name,title,phoneNumbers,storefrontAddress,websiteUri,regularHours,openInfo
 *
 * Auth: Bearer token from gbp_connections.access_token (refresh if expired).
 * Returns: AdapterResult with NAPData normalized from GBP response.
 */
export class GBPNAPAdapter extends NAPAdapter {
  readonly platformId = 'google' as const;

  async fetchNAP(
    locationId: string,
    orgId: string,
    context: PlatformContext,
  ): Promise<AdapterResult> { ... }
}

/**
 * NAP_READ_MASK — fields required for NAP extraction (subset of Sprint 89 readMask).
 */
const NAP_READ_MASK = [
  'name',
  'title',
  'phoneNumbers',
  'storefrontAddress',
  'websiteUri',
  'regularHours',
  'openInfo',
].join(',');
```

**Implementation rules for GBPNAPAdapter:**
- Use `createServiceRoleClient()` to look up `gbp_connections` (cron context — no user session)
- Call `isTokenExpired()` + `refreshGBPToken()` from `lib/gbp/gbp-token-refresh.ts` — do NOT re-implement token refresh
- If `context.gbp_location_id` is undefined, return `{ status: 'unconfigured', reason: 'no_gbp_location_id' }`
- If `gbp_connections` row not found for org, return `{ status: 'unconfigured', reason: 'not_connected' }`
- Normalize response through `mapGBPToLocation()` from Sprint 89, then map `MappedLocationData` → `NAPData`
- On any fetch error, return `{ status: 'api_error', message, http_status }` — never throw

---

#### `lib/nap-sync/adapters/yelp-adapter.ts`

```typescript
/**
 * Yelp NAP Adapter — reads live NAP data via Yelp Fusion API.
 *
 * Yelp Fusion Business Details endpoint:
 * GET https://api.yelp.com/v3/businesses/{id}
 * Authorization: Bearer {YELP_FUSION_API_KEY}
 *
 * Fields returned: name, phone, location (address1, city, state, zip_code),
 *   url, hours (open periods), is_closed.
 *
 * NOTE: Yelp has NO write API for business owners — corrections for Yelp
 * are ALWAYS manual (guided fix instructions only).
 *
 * Auth: API key from process.env.YELP_FUSION_API_KEY.
 * If env var is absent, return { status: 'unconfigured', reason: 'no_api_key' }.
 */
export class YelpNAPAdapter extends NAPAdapter {
  readonly platformId = 'yelp' as const;

  async fetchNAP(
    locationId: string,
    orgId: string,
    context: PlatformContext,
  ): Promise<AdapterResult> { ... }
}
```

**Yelp hours normalization:**
Yelp returns hours in a different format than GBP:
```typescript
// Yelp format:
// { open: [{ day: 0, start: "1700", end: "0000", is_overnight: false }] }
// day: 0=Monday, 1=Tuesday, ..., 6=Sunday (ISO weekday - 1)
// start/end: "HHMM" 24-hour string

// LocalVector target format:
// { monday: { open: "17:00", close: "00:00", closed: false } }
```
Write a `normalizeYelpHours(yelpHours)` helper within this file. If `is_overnight: true`, the close time is on the next day — store the close time as given, same behavior as `mapHours()` in Sprint 89.

---

#### `lib/nap-sync/adapters/apple-maps-adapter.ts`

```typescript
/**
 * Apple Maps NAP Adapter — reads live NAP data via Maps Connect API.
 *
 * Apple Maps Connect API:
 * GET https://api.apple-mapkit.com/v1/geocode?q={address}
 * OR: Maps Connect private API (requires MapsConnect credentials — not publicly documented)
 *
 * REALITY: Apple Maps Connect does NOT have a public business data read API.
 * The only programmatic access is via Maps Connect portal (portal.maps.apple.com).
 * This adapter should:
 *   1. Check if APPLE_MAPS_PRIVATE_KEY + APPLE_MAPS_KEY_ID + APPLE_MAPS_TEAM_ID env vars exist
 *   2. If missing, return { status: 'unconfigured', reason: 'no_credentials' }
 *   3. If present, use MapKit JS Server API to attempt a place search by business name + address
 *      and return what it can resolve — do NOT fabricate data
 *   4. If search returns no confident match, return { status: 'not_found' }
 *
 * Auth: JWT signed with Apple private key (use 'jsonwebtoken' library).
 *
 * For this sprint: fully implement the JWT auth + place search. The fix
 * instructions path is always manual for Apple Maps regardless of what we find.
 */
export class AppleMapsNAPAdapter extends NAPAdapter {
  readonly platformId = 'apple_maps' as const;

  async fetchNAP(
    locationId: string,
    orgId: string,
    context: PlatformContext,
  ): Promise<AdapterResult> { ... }
}

/**
 * Generates a signed MapKit JWT for Apple Maps Server API calls.
 * Uses APPLE_MAPS_PRIVATE_KEY (PEM string), APPLE_MAPS_KEY_ID, APPLE_MAPS_TEAM_ID.
 */
async function generateAppleMapsJWT(): Promise<string> { ... }
```

---

#### `lib/nap-sync/adapters/bing-adapter.ts`

```typescript
/**
 * Bing NAP Adapter — reads NAP data via Bing Local Search API.
 *
 * Bing Local Search API:
 * GET https://api.bing.microsoft.com/v7.0/local/search?q={name}&localcategories=&mkt=en-US
 * Ocp-Apim-Subscription-Key: {BING_SEARCH_API_KEY}
 *
 * This returns business listings from Bing's index, which feeds Bing Places.
 * Fields: name, address (streetAddress, addressLocality, addressRegion, postalCode),
 *   telephone, url.
 * NOTE: hours are NOT available via Bing Local Search API.
 * NOTE: Bing Places has NO public write API — corrections are always manual.
 *
 * Auth: API key from process.env.BING_SEARCH_API_KEY.
 * If env var absent, return { status: 'unconfigured', reason: 'no_api_key' }.
 *
 * Match strategy: Search for "{businessName} {city} {state}".
 * Take the first result with an address match score > 0.8 (compare to Ground Truth).
 * If no confident match found, return { status: 'not_found' }.
 */
export class BingNAPAdapter extends NAPAdapter {
  readonly platformId = 'bing' as const;

  async fetchNAP(
    locationId: string,
    orgId: string,
    context: PlatformContext,
  ): Promise<AdapterResult> { ... }
}

/**
 * Scores address similarity between Bing result and Ground Truth (0–1).
 * Uses normalized string comparison — lowercase, strip punctuation.
 * Score >= 0.8 = confident match.
 */
export function scoreAddressSimilarity(
  bingAddress: string,
  groundTruthAddress: string,
): number { ... }
```

---

### Component 2: Discrepancy Detector — `lib/nap-sync/nap-discrepancy-detector.ts`

**Pure function.** No I/O, no side effects. Takes Ground Truth + array of AdapterResults, returns array of PlatformDiscrepancy.

```typescript
/**
 * Detects discrepancies between LocalVector Ground Truth and platform live data.
 * Pure function — no side effects.
 *
 * Severity rules:
 * - 'critical'  — phone or address wrong (direct customer contact broken)
 * - 'high'      — name wrong or operational_status wrong (trust/discovery broken)
 * - 'medium'    — hours wrong for 3+ days (conversion impact)
 * - 'low'       — website wrong, or hours off by 1 day
 * - 'none'      — all fields match
 *
 * Auto-correctable: true ONLY for platform === 'google' (GBP has write API).
 * All other platforms: auto_correctable = false, fix_instructions generated.
 *
 * Fix instructions format (for non-GBP platforms):
 * Human-readable step-by-step instructions specific to each platform.
 * Example for Yelp: "Log into biz.yelp.com → Find your listing → Edit business info → Update phone number from [platform_value] to [ground_truth_value]"
 */
export function detectDiscrepancies(
  groundTruth: GroundTruth,
  adapterResults: AdapterResult[],
): PlatformDiscrepancy[] { ... }

/**
 * Compares two NAPData objects and returns the differing fields.
 * Normalizes values before comparison (lowercase, strip whitespace, E.164 phones).
 */
export function diffNAPData(
  groundTruth: Partial<NAPData>,
  platformData: NAPData,
): NAPField[] { ... }

/**
 * Normalizes a phone number for comparison.
 * Strips all non-digit characters, then compares last 10 digits.
 * E.g. "+1 (470) 555-0123" and "4705550123" are equal.
 */
export function normalizePhone(phone: string): string { ... }

/**
 * Normalizes an address string for fuzzy comparison.
 * Lowercases, strips punctuation, expands common abbreviations:
 * "St." → "street", "Rd." → "road", "Blvd." → "boulevard", "Ave." → "avenue"
 */
export function normalizeAddress(address: string): string { ... }

/**
 * Computes severity from a list of discrepant fields.
 * See severity rules in JSDoc above.
 */
export function computeSeverity(
  discrepantFields: NAPField[],
): PlatformDiscrepancy['severity'] { ... }

/**
 * Generates human-readable fix instructions for a non-GBP platform discrepancy.
 */
export function generateFixInstructions(
  platform: PlatformId,
  discrepantFields: NAPField[],
  groundTruth: GroundTruth,
): string { ... }
```

---

### Component 3: NAP Health Score — `lib/nap-sync/nap-health-score.ts`

**Pure function.** Calculates the composite 0–100 NAP Health Score from an array of PlatformDiscrepancy.

```typescript
/**
 * Calculates the NAP Health Score from a list of platform discrepancy results.
 *
 * Scoring algorithm:
 * Base score: 100
 * Deductions per discrepancy (cumulative, capped at -100):
 *   - critical: -25 per field
 *   - high:     -15 per field
 *   - medium:   -8  per field
 *   - low:      -3  per field
 *   - unconfigured platform: -5 (we can't verify)
 *   - api_error platform: -2 (temporary, penalize lightly)
 *
 * Grade scale:
 *   90–100 → A
 *   75–89  → B
 *   60–74  → C
 *   40–59  → D
 *   0–39   → F
 */
export function calculateNAPHealthScore(
  discrepancies: PlatformDiscrepancy[],
  adapterResults: AdapterResult[],
): NAPHealthScore { ... }
```

---

### Component 4: NAP Sync Orchestrator — `lib/nap-sync/nap-sync-service.ts`

**The main orchestrator.** Calls all adapters, runs the detector, calculates score, persists to DB, triggers corrections.

```typescript
/**
 * Runs a full NAP sync for a single location.
 *
 * Flow:
 * 1. Fetch Ground Truth from locations table (by location_id)
 * 2. Fetch platform context from listing_platform_ids table
 * 3. Run all 4 adapters in parallel (Promise.allSettled — never fail due to one platform)
 * 4. Run detectDiscrepancies() with Ground Truth + adapter results
 * 5. Calculate NAPHealthScore
 * 6. Upsert listing_snapshots row (one per platform, per run)
 * 7. Upsert nap_discrepancies rows (one per platform with discrepancies)
 * 8. Update locations.nap_health_score + locations.nap_last_checked_at
 * 9. If auto_correctable discrepancies exist → call pushNAPCorrections() for GBP
 * 10. Return full NAPSyncResult
 *
 * Uses createServiceRoleClient() — this runs in cron context (no user session).
 */
export async function runNAPSync(
  supabase: ReturnType<typeof createServiceRoleClient>,
  locationId: string,
  orgId: string,
): Promise<NAPSyncResult> { ... }

/**
 * Runs NAP sync for ALL active locations across all orgs.
 * Called by the weekly cron job.
 * Processes locations sequentially (not parallel) to avoid rate limiting.
 * Logs each result to DEVLOG (DB-backed event log).
 */
export async function runNAPSyncForAllLocations(
  supabase: ReturnType<typeof createServiceRoleClient>,
): Promise<{ processed: number; errors: number }> { ... }
```

---

### Component 5: GBP Correction Push — `lib/nap-sync/nap-push-corrections.ts`

```typescript
/**
 * Pushes NAP corrections to Google Business Profile via the GBP PATCH API.
 * Only called for discrepancies where auto_correctable === true (GBP only).
 *
 * GBP Update Location endpoint:
 * PATCH https://mybusinessbusinessinformation.googleapis.com/v1/{name}
 *   ?updateMask=title,phoneNumbers,storefrontAddress,websiteUri
 * Authorization: Bearer {access_token}
 * Body: GBP Location object (only fields being updated)
 *
 * Rules:
 * - Only patch fields that are actually discrepant (use updateMask to limit scope)
 * - NEVER patch regularHours via this endpoint (hours corrections are complex — flag for manual review)
 * - NEVER patch openInfo.status (risk of accidentally marking business closed)
 * - Patchable fields for this sprint: title (name), phoneNumbers.primaryPhone,
 *   storefrontAddress, websiteUri
 * - On GBP API error: return { ok: false, error } — log but do not throw
 * - On success: update listing_snapshots.correction_pushed_at for GBP row
 *
 * @param locationId   — LocalVector location UUID
 * @param orgId        — Org UUID (for token lookup)
 * @param corrections  — Array of NAPField discrepancies to fix
 */
export async function pushNAPCorrections(
  supabase: ReturnType<typeof createServiceRoleClient>,
  locationId: string,
  orgId: string,
  corrections: NAPField[],
): Promise<{ ok: boolean; patched_fields: string[]; error?: string }> { ... }

/**
 * Builds the GBP PATCH request body and updateMask from a list of NAPField corrections.
 * Pure function.
 */
export function buildGBPPatchBody(
  corrections: NAPField[],
  groundTruth: GroundTruth,
): { body: Partial<GBPUpdatePayload>; updateMask: string } { ... }

/**
 * GBP PATCH request body type (subset of GBP Location object).
 */
export interface GBPUpdatePayload {
  title?: string;
  phoneNumbers?: { primaryPhone: string };
  storefrontAddress?: {
    addressLines: string[];
    locality: string;
    administrativeArea: string;
    postalCode: string;
    regionCode: string;
  };
  websiteUri?: string;
}
```

---

### Component 6: NAP Sync API Route — `app/api/nap-sync/run/route.ts`

**Authenticated POST endpoint.** Called by the frontend when a user manually triggers a NAP sync from the dashboard.

```typescript
/**
 * POST /api/nap-sync/run
 *
 * Triggers an on-demand NAP sync for the authenticated user's primary location.
 *
 * Flow:
 * 1. Verify user session
 * 2. Resolve org_id and location_id from session
 * 3. Plan gate: Growth+ only (return 403 with "plan_upgrade_required" for Starter)
 * 4. Call runNAPSync() from nap-sync-service.ts
 * 5. Return { ok: true, result: NAPSyncResult }
 *
 * Error codes returned in JSON:
 * - "unauthorized"           — no valid session
 * - "plan_upgrade_required"  — user is on Starter plan
 * - "no_location"            — org has no location row
 * - "sync_failed"            — runNAPSync threw an unexpected error
 */
export async function POST(request: Request) { ... }
```

---

### Component 7: NAP Sync Cron Route — `app/api/cron/nap-sync/route.ts`

```typescript
/**
 * GET /api/cron/nap-sync
 *
 * Weekly cron job. Called by Vercel Cron on the schedule in vercel.json.
 * Processes all active Growth+ locations in sequence.
 *
 * Security: validates CRON_SECRET header — same pattern as existing SOV cron.
 * Uses createServiceRoleClient() — no user session.
 *
 * Response: { processed: number, errors: number, duration_ms: number }
 */
export async function GET(request: Request) { ... }
```

**Update `vercel.json` to add the cron schedule:**
```json
{
  "crons": [
    { "path": "/api/cron/sov", "schedule": "0 2 * * 1" },
    { "path": "/api/cron/nap-sync", "schedule": "0 3 * * 1" }
  ]
}
```
Schedule: every Monday at 3:00 AM UTC (1 hour after the SOV cron to avoid DB load overlap).

---

### Component 8: Migration — `supabase/migrations/YYYYMMDDHHMMSS_nap_sync_engine.sql`

**Use the current timestamp for the filename.** Read `supabase/migrations/` to find the correct next timestamp.

```sql
-- ══════════════════════════════════════════════════════════════
-- Sprint 105: NAP Sync Engine — New Tables
-- ══════════════════════════════════════════════════════════════

-- 1. listing_platform_ids — Maps a location to its IDs on each platform
CREATE TABLE IF NOT EXISTS public.listing_platform_ids (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  org_id       uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  platform     text NOT NULL CHECK (platform IN ('google', 'yelp', 'apple_maps', 'bing')),
  platform_id  text NOT NULL,        -- The business ID on that platform
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, platform)
);

ALTER TABLE public.listing_platform_ids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listing_platform_ids: org members can read own"
  ON public.listing_platform_ids FOR SELECT
  USING (org_id = (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "listing_platform_ids: service role full access"
  ON public.listing_platform_ids
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_listing_platform_ids_location
  ON public.listing_platform_ids (location_id, platform);

COMMENT ON TABLE public.listing_platform_ids IS
  'Maps LocalVector locations to their platform-specific IDs (GBP location name, Yelp business ID, etc). Sprint 105.';

-- ──────────────────────────────────────────────────────────────

-- 2. listing_snapshots — Raw NAP data captured from each platform per sync run
CREATE TABLE IF NOT EXISTS public.listing_snapshots (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id             uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  org_id                  uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  platform                text NOT NULL CHECK (platform IN ('google', 'yelp', 'apple_maps', 'bing')),
  fetch_status            text NOT NULL CHECK (fetch_status IN ('ok', 'unconfigured', 'api_error', 'not_found')),
  raw_nap_data            jsonb,        -- NAPData as returned by adapter (null if not ok)
  fetched_at              timestamptz NOT NULL DEFAULT now(),
  correction_pushed_at    timestamptz,  -- Set when GBP auto-correction was pushed
  correction_fields       text[],       -- Fields that were auto-corrected
  UNIQUE (location_id, platform, fetched_at)  -- One snapshot per platform per run
);

ALTER TABLE public.listing_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listing_snapshots: org members can read own"
  ON public.listing_snapshots FOR SELECT
  USING (org_id = (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "listing_snapshots: service role full access"
  ON public.listing_snapshots
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_listing_snapshots_location_platform
  ON public.listing_snapshots (location_id, platform, fetched_at DESC);

COMMENT ON TABLE public.listing_snapshots IS
  'Raw NAP data snapshots from each platform per sync run. Enables historical diff tracking. Sprint 105.';

-- ──────────────────────────────────────────────────────────────

-- 3. nap_discrepancies — Structured discrepancy records per platform per sync
CREATE TABLE IF NOT EXISTS public.nap_discrepancies (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  org_id              uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  platform            text NOT NULL CHECK (platform IN ('google', 'yelp', 'apple_maps', 'bing')),
  status              text NOT NULL CHECK (status IN ('match', 'discrepancy', 'unconfigured', 'api_error', 'not_found')),
  discrepant_fields   jsonb NOT NULL DEFAULT '[]'::jsonb, -- Array of NAPField
  severity            text NOT NULL CHECK (severity IN ('none', 'low', 'medium', 'high', 'critical')) DEFAULT 'none',
  auto_correctable    boolean NOT NULL DEFAULT false,
  fix_instructions    text,
  detected_at         timestamptz NOT NULL DEFAULT now(),
  resolved_at         timestamptz,      -- Set when user manually confirms fix or auto-correction succeeds
  UNIQUE (location_id, platform, detected_at)
);

ALTER TABLE public.nap_discrepancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nap_discrepancies: org members can read own"
  ON public.nap_discrepancies FOR SELECT
  USING (org_id = (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "nap_discrepancies: service role full access"
  ON public.nap_discrepancies
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_nap_discrepancies_location
  ON public.nap_discrepancies (location_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_nap_discrepancies_unresolved
  ON public.nap_discrepancies (location_id, platform)
  WHERE resolved_at IS NULL;

COMMENT ON TABLE public.nap_discrepancies IS
  'Structured discrepancy records between Ground Truth and live platform data. Sprint 105.';

-- ──────────────────────────────────────────────────────────────

-- 4. Add NAP health columns to locations table
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS nap_health_score      integer CHECK (nap_health_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS nap_last_checked_at   timestamptz;

CREATE INDEX IF NOT EXISTS idx_locations_nap_health
  ON public.locations (org_id, nap_health_score)
  WHERE nap_health_score IS NOT NULL;

COMMENT ON COLUMN public.locations.nap_health_score IS
  'Composite 0–100 NAP accuracy score across all platforms. NULL = never checked. Sprint 105.';
COMMENT ON COLUMN public.locations.nap_last_checked_at IS
  'Timestamp of last successful NAP sync run. Sprint 105.';
```

**Update `prod_schema.sql`:** Add all 3 new tables and the 2 new columns on `locations`.

**Update `database.types.ts`:** Add types for `listing_platform_ids`, `listing_snapshots`, `nap_discrepancies`, and the new `locations` columns.

---

### Component 9: Seed Data — `supabase/seed.sql`

```sql
-- ══════════════════════════════════════════════════════════════
-- Sprint 105: NAP Sync Engine seed data for golden tenant
-- ══════════════════════════════════════════════════════════════

-- listing_platform_ids for Charcoal N Chill
-- Get location_id via: SELECT id FROM public.locations WHERE org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' LIMIT 1
DO $$
DECLARE
  v_location_id uuid;
BEGIN
  SELECT id INTO v_location_id
    FROM public.locations
   WHERE org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
   LIMIT 1;

  INSERT INTO public.listing_platform_ids (location_id, org_id, platform, platform_id)
  VALUES
    (v_location_id, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'google',     'locations/123456789'),
    (v_location_id, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'yelp',       'charcoal-n-chill-alpharetta'),
    (v_location_id, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'apple_maps', 'I143B4F08CD641C68'),
    (v_location_id, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'bing',       'YN873x123456789')
  ON CONFLICT (location_id, platform) DO NOTHING;

  -- Seed a realistic Yelp discrepancy (stale phone) for dashboard testing
  INSERT INTO public.nap_discrepancies (
    location_id, org_id, platform, status, discrepant_fields,
    severity, auto_correctable, fix_instructions, detected_at
  ) VALUES (
    v_location_id,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'yelp',
    'discrepancy',
    '[{"field":"phone","ground_truth_value":"+14705550123","platform_value":"+14705559999"}]'::jsonb,
    'critical',
    false,
    'Log into biz.yelp.com → Business Information → Phone → Update to +14705550123 → Save',
    NOW() - INTERVAL '2 days'
  )
  ON CONFLICT DO NOTHING;

  -- Seed a GBP match (no discrepancy) for dashboard testing
  INSERT INTO public.nap_discrepancies (
    location_id, org_id, platform, status, discrepant_fields, severity, auto_correctable, detected_at
  ) VALUES (
    v_location_id,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'google',
    'match',
    '[]'::jsonb,
    'none',
    true,
    NOW() - INTERVAL '2 days'
  )
  ON CONFLICT DO NOTHING;

  -- Set nap_health_score on the golden tenant location
  UPDATE public.locations
     SET nap_health_score = 65, nap_last_checked_at = NOW() - INTERVAL '2 days'
   WHERE id = v_location_id;
END $$;
```

---

### Component 10: Golden Tenant Fixtures — `src/__fixtures__/golden-tenant.ts`

```typescript
/**
 * Sprint 105 — Mock NAPData for each platform (golden tenant: Charcoal N Chill).
 * Used by unit tests for the discrepancy detector and health score calculator.
 */

/** Ground Truth — matches the locations table seed data */
export const MOCK_GROUND_TRUTH: import('@/lib/nap-sync/types').GroundTruth = {
  location_id: 'loc-golden-tenant-id',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  name: 'Charcoal N Chill',
  address: '11950 Jones Bridge Rd',
  city: 'Alpharetta',
  state: 'GA',
  zip: '30005',
  phone: '+14705550123',
  website: 'https://charcoalnchill.com',
  operational_status: 'open',
};

/** GBP adapter result — no discrepancies (all fields match ground truth) */
export const MOCK_GBP_ADAPTER_RESULT: import('@/lib/nap-sync/types').AdapterResult = {
  status: 'ok',
  platform: 'google',
  data: {
    name: 'Charcoal N Chill',
    address: '11950 Jones Bridge Rd',
    city: 'Alpharetta',
    state: 'GA',
    zip: '30005',
    phone: '+14705550123',
    website: 'https://charcoalnchill.com',
    operational_status: 'open',
  },
  fetched_at: '2026-03-01T03:00:00.000Z',
};

/** Yelp adapter result — stale phone number (discrepancy) */
export const MOCK_YELP_ADAPTER_RESULT: import('@/lib/nap-sync/types').AdapterResult = {
  status: 'ok',
  platform: 'yelp',
  data: {
    name: 'Charcoal N Chill',
    address: '11950 Jones Bridge Rd',
    city: 'Alpharetta',
    state: 'GA',
    zip: '30005',
    phone: '+14705559999',    // ← stale/wrong phone
    website: 'https://charcoalnchill.com',
  },
  fetched_at: '2026-03-01T03:00:00.000Z',
};

/** Apple Maps adapter result — unconfigured (no credentials in test env) */
export const MOCK_APPLE_MAPS_ADAPTER_RESULT: import('@/lib/nap-sync/types').AdapterResult = {
  status: 'unconfigured',
  platform: 'apple_maps',
  reason: 'no_credentials',
};

/** Bing adapter result — not found (no confident address match) */
export const MOCK_BING_ADAPTER_RESULT: import('@/lib/nap-sync/types').AdapterResult = {
  status: 'not_found',
  platform: 'bing',
};
```

---

### Component 11: Listing Health Dashboard Panel — `app/dashboard/_components/ListingHealthPanel.tsx`

**Client component.** Displays the NAP Health Score and per-platform discrepancy cards on the main dashboard.

```
┌─────────────────────────────────────────────────────────────────────┐
│  🏥 Listing Health                        NAP Score: 65/100 C       │
│  Last checked: 2 days ago   [Run Sync Now →]                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ✅ Google Business Profile          MATCH — all fields accurate     │
│                                                                       │
│  🔴 Yelp                             CRITICAL — phone number wrong   │
│     Live:   (470) 555-9999                                           │
│     Should be: (470) 555-0123                                        │
│     [View Fix Instructions →]                                        │
│                                                                       │
│  ⚠️  Apple Maps                       UNCONFIGURED — no credentials   │
│     [Connect Apple Maps →]                                           │
│                                                                       │
│  ⚠️  Bing Places                      NOT FOUND — no listing matched  │
│     [Claim Bing Listing →]                                           │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Implementation rules:**
- `'use client'` component — loads discrepancies via `useEffect` call to `GET /api/nap-sync/status`
- Plan gate: Growth+ only — render nothing (or upgrade prompt) for Starter plan
- Severity color coding: critical = red, high = orange, medium = yellow, low = blue, none = green
- "Run Sync Now" button calls `POST /api/nap-sync/run` with inline loading state
- "View Fix Instructions" opens a modal (`ListingFixModal.tsx`) with the `fix_instructions` text
- "Connect Apple Maps" links to `/dashboard/settings#platform-credentials`
- For GBP discrepancies with `auto_correctable: true`: show "Auto-Fix Available" badge + "Fix Now" button
- All interactive elements have `data-testid` attributes
- Skeleton loading state while data fetches
- Empty state: "All listings are accurate! 🎉" when no discrepancies

---

### Component 12: NAP Status API Route — `app/api/nap-sync/status/route.ts`

```typescript
/**
 * GET /api/nap-sync/status
 *
 * Returns the current NAP health state for the authenticated user's location.
 * Used by ListingHealthPanel on dashboard load.
 *
 * Response:
 * {
 *   health_score: NAPHealthScore | null,  // null = never synced
 *   discrepancies: PlatformDiscrepancy[], // most recent per platform (unresolved)
 *   last_checked_at: string | null,
 * }
 *
 * Auth: user session (createClient())
 * Plan gate: Growth+ only (return 403 for Starter)
 */
export async function GET(request: Request) { ... }
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/nap-discrepancy-detector.test.ts`

**Target: `lib/nap-sync/nap-discrepancy-detector.ts`**
**Pure functions — zero mocks needed.**

```
describe('detectDiscrepancies')
  1.  returns empty discrepant_fields when all NAP data matches ground truth
  2.  detects phone discrepancy (Yelp stale phone scenario)
  3.  detects name discrepancy (casing differences are normalized)
  4.  detects address discrepancy (abbreviation normalization: "Rd" vs "Road")
  5.  detects website discrepancy (trailing slash normalization: "https://x.com/" vs "https://x.com")
  6.  status 'unconfigured' adapter produces discrepancy with status 'unconfigured', no fields
  7.  status 'api_error' adapter produces discrepancy with status 'api_error', no fields
  8.  status 'not_found' adapter produces discrepancy with status 'not_found', no fields
  9.  GBP match has auto_correctable = true
  10. Yelp discrepancy has auto_correctable = false
  11. Apple Maps discrepancy has auto_correctable = false
  12. Bing discrepancy has auto_correctable = false
  13. MOCK_YELP_ADAPTER_RESULT produces severity 'critical' (phone wrong)
  14. processes 4 adapters in parallel, returns 4 PlatformDiscrepancy objects

describe('diffNAPData')
  15. returns empty array when all fields match
  16. returns [{ field: 'phone', ... }] when phone differs
  17. returns [{ field: 'name', ... }] when name differs
  18. returns multiple fields when multiple differ
  19. ignores fields that are undefined in platformData (don't flag missing as wrong)

describe('normalizePhone')
  20. '+1 (470) 555-0123' → '4705550123'
  21. '470-555-0123' → '4705550123'
  22. '+14705550123' → '4705550123'
  23. '(470) 555.0123' → '4705550123'
  24. '4705550123' → '4705550123'

describe('normalizeAddress')
  25. lowercases and strips punctuation
  26. 'Rd.' → 'road'
  27. 'St.' → 'street'
  28. 'Blvd.' → 'boulevard'
  29. 'Ave.' → 'avenue'
  30. ignores extra whitespace

describe('computeSeverity')
  31. phone field discrepancy → 'critical'
  32. address field discrepancy → 'critical'
  33. name field discrepancy → 'high'
  34. hours discrepancy on 3+ days → 'medium'
  35. website discrepancy only → 'low'
  36. no discrepant fields → 'none'

describe('generateFixInstructions')
  37. generates Yelp-specific instructions for phone discrepancy
  38. generates Bing-specific instructions for name discrepancy
  39. generates Apple Maps-specific instructions for address discrepancy
  40. instructions contain the ground_truth_value (what to change it TO)
  41. instructions contain the platform_value (what it currently shows)
```

**41 tests total. Zero mocks — pure functions.**

---

### Test File 2: `src/__tests__/unit/nap-health-score.test.ts`

**Target: `lib/nap-sync/nap-health-score.ts`**
**Pure function — zero mocks needed.**

```
describe('calculateNAPHealthScore')
  1.  returns score 100 when all platforms match
  2.  deducts 25 per critical field (phone wrong on Yelp = -25)
  3.  deducts 15 per high field (name wrong = -15)
  4.  deducts 8 per medium field
  5.  deducts 3 per low field
  6.  deducts 5 per unconfigured platform
  7.  deducts 2 per api_error platform
  8.  score is capped at 0 minimum (never negative)
  9.  score is capped at 100 maximum
  10. 100 score → grade 'A'
  11. 85 score → grade 'B'
  12. 65 score → grade 'C' (matches golden tenant seed scenario)
  13. 50 score → grade 'D'
  14. 30 score → grade 'F'
  15. platforms_checked reflects actual adapter results count
  16. platforms_matched is accurate (only 'ok' + 'match' status counts)
  17. critical_discrepancies counts severity === 'critical' items
```

**17 tests total. Zero mocks.**

---

### Test File 3: `src/__tests__/unit/nap-push-corrections.test.ts`

**Target: `lib/nap-sync/nap-push-corrections.ts`**

```
describe('buildGBPPatchBody')
  1.  phone correction → body has phoneNumbers.primaryPhone, updateMask includes 'phoneNumbers'
  2.  name correction → body has title, updateMask includes 'title'
  3.  address correction → body has storefrontAddress with all fields, updateMask includes 'storefrontAddress'
  4.  website correction → body has websiteUri, updateMask includes 'websiteUri'
  5.  multiple corrections → updateMask is comma-separated, body has all fields
  6.  hours field is NEVER included in patch body (hours patching blocked)
  7.  operational_status field is NEVER included in patch body

describe('pushNAPCorrections')
  8.  calls GBP PATCH endpoint with correct URL (gbp_location_id in path)
  9.  sends Authorization header with access_token
  10. sends correct updateMask query param
  11. returns { ok: true, patched_fields } on 200 response
  12. returns { ok: false, error } on GBP API error — does NOT throw
  13. updates listing_snapshots.correction_pushed_at on success
  14. skips patch if corrections array is empty — returns { ok: true, patched_fields: [] }
```

**14 tests total.**

**Mock requirements:**
```typescript
vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(),
}));
vi.mock('@/lib/gbp/gbp-token-refresh', () => ({
  isTokenExpired: vi.fn().mockReturnValue(false),
  refreshGBPToken: vi.fn(),
}));
global.fetch = vi.fn();
```

---

### Test File 4: `src/__tests__/unit/nap-adapters.test.ts`

**Target: all 4 adapter files**

```
describe('YelpNAPAdapter')
  1.  returns { status: 'unconfigured' } when YELP_FUSION_API_KEY is not set
  2.  calls Yelp API with correct URL and Authorization header
  3.  maps Yelp response to NAPData correctly (name, address, phone, website)
  4.  normalizes Yelp hours to LocalVector format (day index → day name, HHMM → HH:MM)
  5.  handles is_overnight = true correctly
  6.  returns { status: 'api_error' } on non-200 Yelp response
  7.  returns { status: 'not_found' } when context.yelp_business_id is undefined

describe('BingNAPAdapter')
  8.  returns { status: 'unconfigured' } when BING_SEARCH_API_KEY is not set
  9.  searches Bing with "{name} {city} {state}" query
  10. returns first result with address score >= 0.8
  11. returns { status: 'not_found' } when no result scores >= 0.8
  12. maps Bing result fields to NAPData (name, address, phone, website)

describe('scoreAddressSimilarity')
  13. identical addresses → score 1.0
  14. "Rd" vs "Road" → score >= 0.9 after normalization
  15. completely different addresses → score < 0.5
  16. partial match (same street, different city) → score between 0.5 and 0.8

describe('GBPNAPAdapter')
  17. returns { status: 'unconfigured' } when gbp_connections row is missing
  18. returns { status: 'unconfigured' } when context.gbp_location_id is undefined
  19. calls GBP API with NAP_READ_MASK query param
  20. maps GBP response to NAPData via mapGBPToLocation
  21. calls refreshGBPToken when token is expired

describe('AppleMapsNAPAdapter')
  22. returns { status: 'unconfigured' } when Apple Maps env vars are missing
  23. generates JWT with correct algorithm (ES256) and claims
  24. calls Maps Server API place search with business name + address
  25. returns { status: 'not_found' } when no place result matches
```

**25 tests total.**

**Mock requirements:**
```typescript
global.fetch = vi.fn();
vi.mock('@/lib/supabase/server', ...);
vi.mock('@/lib/gbp/gbp-data-mapper', ...);
vi.mock('@/lib/gbp/gbp-token-refresh', ...);
// Mock process.env per test using vi.stubEnv()
```

---

### Test File 5: `src/__tests__/unit/nap-sync-route.test.ts`

**Target: `app/api/nap-sync/run/route.ts`**

```
describe('POST /api/nap-sync/run')
  1.  returns 401 when user is not authenticated
  2.  returns 403 with error_code "plan_upgrade_required" for Starter plan user
  3.  returns 404 with error_code "no_location" when org has no location
  4.  calls runNAPSync with correct location_id and org_id
  5.  returns { ok: true, result: NAPSyncResult } on success
  6.  returns 500 with error_code "sync_failed" when runNAPSync throws
```

**6 tests total.**

---

### Test File 6: `src/__tests__/e2e/nap-sync-dashboard.spec.ts` — Playwright

```typescript
import { test, expect } from '@playwright/test';

const MOCK_DISCREPANCIES = [
  { platform: 'google', status: 'match', severity: 'none', discrepant_fields: [], auto_correctable: true, fix_instructions: null },
  { platform: 'yelp', status: 'discrepancy', severity: 'critical', discrepant_fields: [{ field: 'phone', ground_truth_value: '+14705550123', platform_value: '+14705559999' }], auto_correctable: false, fix_instructions: 'Log into biz.yelp.com...' },
  { platform: 'apple_maps', status: 'unconfigured', severity: 'none', discrepant_fields: [], auto_correctable: false, fix_instructions: null },
  { platform: 'bing', status: 'not_found', severity: 'none', discrepant_fields: [], auto_correctable: false, fix_instructions: null },
];

describe('NAP Sync — Listing Health Dashboard Panel', () => {
  test('ListingHealthPanel renders with mock discrepancy data', async ({ page }) => {
    // Mock GET /api/nap-sync/status to return MOCK_DISCREPANCIES + score 65
    // Navigate to /dashboard
    // Assert: "Listing Health" section is visible
    // Assert: "NAP Score: 65/100" and "C" grade visible
  });

  test('shows GREEN match card for Google', async ({ page }) => {
    // Assert: Google card shows "MATCH" status
    // Assert: no fix CTA on Google card
  });

  test('shows CRITICAL red card for Yelp with phone discrepancy', async ({ page }) => {
    // Assert: Yelp card shows "CRITICAL" badge (red)
    // Assert: shows wrong phone "(470) 555-9999"
    // Assert: "View Fix Instructions" button visible
  });

  test('Fix Instructions modal opens with correct content', async ({ page }) => {
    // Click "View Fix Instructions" on Yelp card
    // Assert: modal opens
    // Assert: modal contains "biz.yelp.com" text
    // Assert: modal shows the correct phone number to update to
    // Close modal
  });

  test('Run Sync Now triggers sync and updates panel', async ({ page }) => {
    // Mock POST /api/nap-sync/run to return updated discrepancies
    // Click "Run Sync Now" button
    // Assert: loading spinner shows
    // Assert: panel refreshes with new data after response
  });

  test('Starter plan sees upgrade prompt instead of panel', async ({ page }) => {
    // Mock GET /api/nap-sync/status to return 403
    // Navigate to /dashboard
    // Assert: ListingHealthPanel NOT visible (or shows upgrade prompt)
    // Assert: no NAP score displayed
  });

  test('shows unconfigured state for Apple Maps with Connect CTA', async ({ page }) => {
    // Assert: Apple Maps card shows "UNCONFIGURED" status
    // Assert: "Connect Apple Maps" link points to /dashboard/settings#platform-credentials
  });

  test('shows not-found state for Bing with Claim CTA', async ({ page }) => {
    // Assert: Bing card shows "NOT FOUND" status
    // Assert: "Claim Bing Listing" link is visible
  });

  test('empty state shows success message when all platforms match', async ({ page }) => {
    // Mock GET /api/nap-sync/status to return all 'match' discrepancies + score 100
    // Assert: "All listings are accurate! 🎉" empty state renders
  });
});
```

**Total Playwright tests: 9**

**Critical Playwright rules:**
- Always mock `/api/nap-sync/status` and `/api/nap-sync/run` with `page.route()` — never hit real platform APIs
- Use `data-testid` attributes on all interactive elements: `data-testid="listing-health-panel"`, `data-testid="nap-score"`, `data-testid="platform-card-yelp"`, `data-testid="fix-instructions-btn"`, `data-testid="fix-modal"`, `data-testid="run-sync-btn"`
- Use `page.waitForSelector()` not `page.waitForTimeout()` for async state changes
- Auth: use existing golden tenant auth helper (`loginAsGoldenTenant()`)

---

### Run Commands

```bash
npx vitest run src/__tests__/unit/nap-discrepancy-detector.test.ts    # 41 tests
npx vitest run src/__tests__/unit/nap-health-score.test.ts            # 17 tests
npx vitest run src/__tests__/unit/nap-push-corrections.test.ts        # 14 tests
npx vitest run src/__tests__/unit/nap-adapters.test.ts                # 25 tests
npx vitest run src/__tests__/unit/nap-sync-route.test.ts              # 6 tests
npx vitest run                                                          # ALL unit tests — zero regressions
npx playwright test src/__tests__/e2e/nap-sync-dashboard.spec.ts      # 9 e2e tests
npx tsc --noEmit                                                        # 0 new type errors
```

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/nap-sync/types.ts` | **CREATE** | All shared NAP types and interfaces |
| 2 | `lib/nap-sync/adapters/base-adapter.ts` | **CREATE** | Abstract NAPAdapter base class |
| 3 | `lib/nap-sync/adapters/gbp-adapter.ts` | **CREATE** | GBP read adapter (reuses Sprint 89) |
| 4 | `lib/nap-sync/adapters/yelp-adapter.ts` | **CREATE** | Yelp Fusion API adapter |
| 5 | `lib/nap-sync/adapters/apple-maps-adapter.ts` | **CREATE** | Apple Maps Connect adapter |
| 6 | `lib/nap-sync/adapters/bing-adapter.ts` | **CREATE** | Bing Local Search adapter |
| 7 | `lib/nap-sync/index.ts` | **CREATE** | Barrel export |
| 8 | `lib/nap-sync/nap-discrepancy-detector.ts` | **CREATE** | Pure diff function |
| 9 | `lib/nap-sync/nap-health-score.ts` | **CREATE** | Pure score calculator |
| 10 | `lib/nap-sync/nap-sync-service.ts` | **CREATE** | Orchestrator (fetch → diff → persist → push) |
| 11 | `lib/nap-sync/nap-push-corrections.ts` | **CREATE** | GBP auto-correction push |
| 12 | `app/api/nap-sync/run/route.ts` | **CREATE** | On-demand sync API route |
| 13 | `app/api/nap-sync/status/route.ts` | **CREATE** | Dashboard status fetch route |
| 14 | `app/api/cron/nap-sync/route.ts` | **CREATE** | Weekly cron route |
| 15 | `app/dashboard/_components/ListingHealthPanel.tsx` | **CREATE** | Dashboard NAP health panel |
| 16 | `app/dashboard/_components/ListingFixModal.tsx` | **CREATE** | Fix instructions modal |
| 17 | `app/dashboard/page.tsx` | **MODIFY** | Add ListingHealthPanel (Growth+ gated) |
| 18 | `app/dashboard/settings/page.tsx` | **MODIFY** | Add platform credential management section |
| 19 | `vercel.json` | **MODIFY** | Add NAP sync cron schedule |
| 20 | `supabase/migrations/[timestamp]_nap_sync_engine.sql` | **CREATE** | 3 new tables + 2 columns |
| 21 | `supabase/prod_schema.sql` | **MODIFY** | Add new tables + columns |
| 22 | `lib/supabase/database.types.ts` | **MODIFY** | Add types for new tables/columns |
| 23 | `supabase/seed.sql` | **MODIFY** | Seed platform IDs + discrepancies for golden tenant |
| 24 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | Add MOCK_GROUND_TRUTH + 4 adapter results |
| 25 | `src/__tests__/unit/nap-discrepancy-detector.test.ts` | **CREATE** | 41 unit tests |
| 26 | `src/__tests__/unit/nap-health-score.test.ts` | **CREATE** | 17 unit tests |
| 27 | `src/__tests__/unit/nap-push-corrections.test.ts` | **CREATE** | 14 unit tests |
| 28 | `src/__tests__/unit/nap-adapters.test.ts` | **CREATE** | 25 unit tests |
| 29 | `src/__tests__/unit/nap-sync-route.test.ts` | **CREATE** | 6 unit tests |
| 30 | `src/__tests__/e2e/nap-sync-dashboard.spec.ts` | **CREATE** | 9 Playwright e2e tests |

---

## 🚫 What NOT to Do

1. **DO NOT call real platform APIs in any test** — all HTTP calls are mocked via `global.fetch` (Vitest) or `page.route()` (Playwright).
2. **DO NOT re-implement token refresh** — import `isTokenExpired()` and `refreshGBPToken()` from `lib/gbp/gbp-token-refresh.ts` (Sprint 89). No new OAuth token logic.
3. **DO NOT patch regularHours or openInfo.status to GBP** — hours corrections are too complex for safe auto-correction in this sprint. Flag for manual review only.
4. **DO NOT fail the entire sync if one platform adapter errors** — use `Promise.allSettled()` for parallel adapter calls. One platform down = that platform gets `api_error` status, others continue.
5. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2) — use `as unknown as SupabaseClient<Database>`.
6. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12) — use literal class strings for severity colors.
7. **DO NOT use `createClient()` (user session) in the cron route** — use `createServiceRoleClient()`.
8. **DO NOT store raw API responses in the DB without normalizing** — always map through the adapter's return type (NAPData) before persisting to `listing_snapshots`.
9. **DO NOT use `page.waitForTimeout()` in Playwright tests** — use event-driven waits only.
10. **DO NOT edit `middleware.ts`** (AI_RULES §6) — all middleware logic lives in `proxy.ts`.
11. **DO NOT plan-gate the cron route** — cron processes all eligible Growth+ locations internally via the plan check in `runNAPSyncForAllLocations()`.
12. **DO NOT fabricate confidence scores for Apple Maps or Bing** — if you can't find a confident match (Bing score < 0.8, Apple Maps no result), return `not_found`, not a guessed result.
13. **DO NOT expose raw `fix_instructions` to the user without sanitization** — instructions are pre-authored strings from `generateFixInstructions()`, not user input, but still escape for XSS in the modal render.
14. **DO NOT write hours corrections for non-GBP platforms** — hours are complex, multi-field, and require human verification. Limit auto-correction to name, phone, address, and website only.

---

## ✅ Definition of Done (AI_RULES §13.5)

- [ ] `lib/nap-sync/types.ts` — All interfaces defined: NAPData, AdapterResult, PlatformDiscrepancy, NAPHealthScore, GroundTruth, NAPSyncResult
- [ ] `lib/nap-sync/adapters/` — All 4 adapters implemented: GBP, Yelp, Apple Maps, Bing
- [ ] `lib/nap-sync/nap-discrepancy-detector.ts` — `detectDiscrepancies()`, `diffNAPData()`, `normalizePhone()`, `normalizeAddress()`, `computeSeverity()`, `generateFixInstructions()` implemented
- [ ] `lib/nap-sync/nap-health-score.ts` — `calculateNAPHealthScore()` implemented with correct grade scale
- [ ] `lib/nap-sync/nap-sync-service.ts` — `runNAPSync()` and `runNAPSyncForAllLocations()` implemented
- [ ] `lib/nap-sync/nap-push-corrections.ts` — `pushNAPCorrections()` and `buildGBPPatchBody()` implemented; hours + operational_status explicitly blocked
- [ ] `app/api/nap-sync/run/route.ts` — Auth, plan gate, sync trigger, all error codes
- [ ] `app/api/nap-sync/status/route.ts` — Auth, plan gate, status fetch
- [ ] `app/api/cron/nap-sync/route.ts` — CRON_SECRET validation, sequential location processing
- [ ] `vercel.json` — NAP sync cron added at `0 3 * * 1`
- [ ] `app/dashboard/_components/ListingHealthPanel.tsx` — NAP score, per-platform cards, severity colors, run sync CTA, plan gate, skeleton loading, empty state
- [ ] `app/dashboard/_components/ListingFixModal.tsx` — Fix instructions modal renders correctly
- [ ] `app/dashboard/page.tsx` — ListingHealthPanel added (Growth+ gated)
- [ ] `app/dashboard/settings/page.tsx` — Platform credential management section (YELP_FUSION_API_KEY, Bing key, Apple Maps JWT config)
- [ ] Migration `[timestamp]_nap_sync_engine.sql` — 3 new tables + 2 columns + indexes + RLS policies + comments
- [ ] `prod_schema.sql` updated with all new tables and columns
- [ ] `database.types.ts` updated with all new types
- [ ] `seed.sql` updated with golden tenant platform IDs + seeded discrepancies + nap_health_score
- [ ] `golden-tenant.ts` exports `MOCK_GROUND_TRUTH` + 4 platform adapter result mocks
- [ ] `data-testid` attributes on all interactive elements in ListingHealthPanel and ListingFixModal
- [ ] `npx vitest run src/__tests__/unit/nap-discrepancy-detector.test.ts` — **41 tests passing**
- [ ] `npx vitest run src/__tests__/unit/nap-health-score.test.ts` — **17 tests passing**
- [ ] `npx vitest run src/__tests__/unit/nap-push-corrections.test.ts` — **14 tests passing**
- [ ] `npx vitest run src/__tests__/unit/nap-adapters.test.ts` — **25 tests passing**
- [ ] `npx vitest run src/__tests__/unit/nap-sync-route.test.ts` — **6 tests passing**
- [ ] `npx vitest run` — ALL tests passing, zero regressions
- [ ] `npx playwright test src/__tests__/e2e/nap-sync-dashboard.spec.ts` — **9 tests passing**
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] DEVLOG.md entry written (see format below)

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## 2026-03-01 — Sprint 105: NAP Sync Engine — Listing Management Foundation (Completed)

**Goal:** Build the cross-platform NAP accuracy layer. LocalVector tracks AI citation rates but had no way to detect or correct the upstream listing data that feeds AI answers. This sprint closes that gap: detect discrepancies between LocalVector Ground Truth and live listings on GBP, Yelp, Apple Maps, and Bing — auto-correct where possible (GBP), generate guided fix instructions for manual platforms.

**Scope:**
- `lib/nap-sync/types.ts` — **NEW.** All shared types: NAPData, AdapterResult, PlatformDiscrepancy, NAPHealthScore, GroundTruth, NAPSyncResult, PlatformContext.
- `lib/nap-sync/adapters/` — **NEW.** 4 platform adapters: GBPNAPAdapter (reuses Sprint 89 token refresh + mapper), YelpNAPAdapter (Fusion API + hours normalization), AppleMapsNAPAdapter (JWT auth + place search), BingNAPAdapter (Local Search API + address scoring).
- `lib/nap-sync/nap-discrepancy-detector.ts` — **NEW.** Pure comparison engine. detectDiscrepancies(), diffNAPData(), normalizePhone(), normalizeAddress(), computeSeverity(), generateFixInstructions(). Severity rules: critical (phone/address), high (name/status), medium (hours 3+ days), low (website/1 day hours).
- `lib/nap-sync/nap-health-score.ts` — **NEW.** calculateNAPHealthScore(). Deduction model: -25/critical, -15/high, -8/medium, -3/low, -5/unconfigured, -2/api_error. Grade A–F scale.
- `lib/nap-sync/nap-sync-service.ts` — **NEW.** runNAPSync() orchestrator (Promise.allSettled for parallel adapters). runNAPSyncForAllLocations() for cron context.
- `lib/nap-sync/nap-push-corrections.ts` — **NEW.** GBP PATCH via updateMask. Explicitly blocks hours + operational_status patching. buildGBPPatchBody() pure helper.
- `app/api/nap-sync/run/route.ts` — **NEW.** On-demand sync. Auth + Growth+ plan gate + 4 error codes.
- `app/api/nap-sync/status/route.ts` — **NEW.** Dashboard status endpoint. Returns latest unresolved discrepancies + health score.
- `app/api/cron/nap-sync/route.ts` — **NEW.** Weekly cron (Monday 3 AM UTC). CRON_SECRET validated. Sequential location processing.
- `vercel.json` — **MODIFIED.** Added `{ "path": "/api/cron/nap-sync", "schedule": "0 3 * * 1" }`.
- `app/dashboard/_components/ListingHealthPanel.tsx` — **NEW.** NAP score + per-platform discrepancy cards. Severity color coding. Skeleton loading. Empty state. Growth+ plan gate.
- `app/dashboard/_components/ListingFixModal.tsx` — **NEW.** Fix instructions modal for non-auto-correctable platforms.
- `app/dashboard/page.tsx` — **MODIFIED.** ListingHealthPanel added.
- `app/dashboard/settings/page.tsx` — **MODIFIED.** Platform credential management section.
- `supabase/migrations/[timestamp]_nap_sync_engine.sql` — **NEW.** 3 new tables: listing_platform_ids, listing_snapshots, nap_discrepancies. 2 new columns on locations: nap_health_score, nap_last_checked_at. RLS policies + indexes + comments.
- `supabase/prod_schema.sql` — **MODIFIED.** All new tables + columns.
- `lib/supabase/database.types.ts` — **MODIFIED.** All new table/column types.
- `supabase/seed.sql` — **MODIFIED.** Golden tenant platform IDs seeded. Realistic Yelp discrepancy (stale phone) + GBP match seeded. nap_health_score = 65.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** MOCK_GROUND_TRUTH + MOCK_GBP_ADAPTER_RESULT + MOCK_YELP_ADAPTER_RESULT + MOCK_APPLE_MAPS_ADAPTER_RESULT + MOCK_BING_ADAPTER_RESULT.

**Tests added:**
- `src/__tests__/unit/nap-discrepancy-detector.test.ts` — **41 tests** (pure function, zero mocks)
- `src/__tests__/unit/nap-health-score.test.ts` — **17 tests** (pure function, zero mocks)
- `src/__tests__/unit/nap-push-corrections.test.ts` — **14 tests** (fetch + Supabase mocked)
- `src/__tests__/unit/nap-adapters.test.ts` — **25 tests** (fetch + env mocked per test via vi.stubEnv)
- `src/__tests__/unit/nap-sync-route.test.ts` — **6 tests**
- `src/__tests__/e2e/nap-sync-dashboard.spec.ts` — **9 Playwright tests** (all platform APIs mocked via page.route())
- **Total: 103 Vitest + 9 Playwright — all passing, zero regressions**

**Key decisions:**
- Promise.allSettled for parallel adapters: one platform down cannot block others
- hours + operational_status explicitly blocked from GBP auto-patch (too risky)
- Bing match threshold: 0.8 address similarity score (empirically conservative)
- Apple Maps: honest about no public write API — always manual fix instructions
- Sequential location processing in cron (not parallel) to avoid platform rate limits
- Cron schedule: Monday 3 AM UTC (1 hour after SOV cron — stagger DB load)
```

---

## 🔮 AI_RULES Update (Add to `AI_RULES.md`)

```markdown
## 42. 🗺️ NAP Sync Engine — Centralized in `lib/nap-sync/` (Sprint 105)

All cross-platform listing data fetching, comparison, and correction is centralized in `lib/nap-sync/`.

* **Rule:** Never inline platform API calls for NAP data outside this module. Always use the appropriate adapter.
* **Adding a new platform:** Create a new adapter extending `NAPAdapter`, register it in `nap-sync-service.ts`, add its `PlatformId` to the union type in `types.ts`, add migration for the new platform enum value.
* **Adding new correctable fields:** Update `buildGBPPatchBody()`. Hours and operational_status are explicitly blocked — do not unblock without a dedicated sprint.
* **Auto-correction scope:** GBP only. No other platform has a public write API. Do not add write logic for Yelp, Apple Maps, or Bing without a new sprint.
* **Adapters must never throw** — catch all errors and return `AdapterResult` with `status: 'api_error'`.
* **Token refresh:** GBP adapter uses `lib/gbp/gbp-token-refresh.ts`. Never duplicate OAuth refresh logic.
```

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| GBP OAuth connect | Sprint 57B | `gbp_connections` table with tokens |
| GBP Data Mapper | Sprint 89 | `mapGBPToLocation()`, `MappedLocationData` types (reused by GBP adapter) |
| GBP Token Refresh | Sprint 89 | `isTokenExpired()`, `refreshGBPToken()` (reused — do NOT re-implement) |
| `lib/plan-enforcer.ts` | Sprint 3 | Plan gating for Growth+ |
| SOV cron pattern | Sprint 83+ | `vercel.json` cron structure, `CRON_SECRET` auth pattern |
| Golden tenant fixtures | All sprints | `golden-tenant.ts` is additive only — do not break existing exports |
| `createServiceRoleClient()` pattern | Sprint 18 | Required for cron context (no user session) |

---

## 🧠 Edge Cases to Handle

1. **All 4 platforms unconfigured:** `runNAPSync()` still completes. Score = 80 (4 × -5). Return result with all `unconfigured` statuses. Never throw.
2. **GBP token expired and refresh fails:** GBP adapter returns `{ status: 'api_error', message: 'token_expired' }`. Discrepancy record shows `api_error`. Do not block the other adapters.
3. **Yelp business ID not in `listing_platform_ids`:** Yelp adapter receives `context.yelp_business_id = undefined` → returns `{ status: 'unconfigured', reason: 'no_yelp_id' }`. UX: show "Connect Yelp" CTA with link to Yelp Business Manager.
4. **Bing returns multiple results with similar names:** Take only the first result with `scoreAddressSimilarity >= 0.8`. If multiple results tie, take the first. Never merge results from multiple Bing listings.
5. **GBP PATCH returns 409 (location has pending edit):** GBP sometimes rejects updates when the location has a pending edit in GBP dashboard. Return `{ ok: false, error: 'gbp_pending_edit' }` — surface this error in the UI with message "This location has a pending edit on Google. Approve or reject it in your GBP dashboard before syncing."
6. **Phone normalization across formats:** `normalizePhone()` must handle: `+1 (470) 555-0123`, `(470) 555-0123`, `470-555-0123`, `4705550123`, `470.555.0123`. All should normalize to `4705550123` for comparison.
7. **Multi-location orgs (Agency tier):** `runNAPSync()` takes an explicit `location_id` — agency accounts can sync each location independently. `runNAPSyncForAllLocations()` loops through all locations. Multi-location dashboard UI is deferred to Sprint 110.
8. **Apple Maps JWT expiry:** MapKit JWTs are short-lived (max 30 minutes). Generate a fresh JWT per sync run — do not cache JWTs.
9. **Cron timeout:** Vercel cron has a 60-second timeout (Hobby) or 300-second timeout (Pro). If processing all locations would exceed this, batch in groups of 10 per run and track progress via a `cron_run_state` column or Vercel KV. Log which locations were skipped.
10. **User manually fixes a discrepancy (Yelp) and clicks "Mark as Fixed":** Add a `POST /api/nap-sync/resolve` route that sets `nap_discrepancies.resolved_at = now()` for a given discrepancy. Do NOT auto-resolve — require explicit user confirmation.

---

## 📚 Document Sync + Git Commit (Run After All Tests Pass)

After all Vitest and Playwright tests pass and `npx tsc --noEmit` shows 0 errors, perform the following documentation sync and commit.

### Step 1: Update `/docs` files

**`docs/roadmap.md`** — Add Sprint 105 (NAP Sync Engine) as ✅ 100%. Mark NAP Sync gap as closed.

**`docs/09-BUILD-PLAN.md`** — Add Sprint 105 to completed sprints list. Check off all Sprint 105 checkboxes.

**`docs/04-INTELLIGENCE-ENGINE-SPEC.md`** — Add Sprint 105 note: "NAP Sync Engine added at `lib/nap-sync/`. Feeds Ground Truth accuracy upstream of Fear Engine hallucination detection."

### Step 2: Update `DEVLOG.md`

Paste the DEVLOG entry from the **📓 DEVLOG Entry Format** section above. Replace `[timestamp]` with the actual migration filename. Replace all test counts with verified actual counts from `grep -cE "^\s*(it|test)\("` on each test file (AI_RULES §13.3).

### Step 3: Update `CLAUDE.md`

Add to implementation inventory:
```markdown
### Sprint 105 — NAP Sync Engine (2026-03-01)
- `lib/nap-sync/` — 4 platform adapters (GBP, Yelp, Apple Maps, Bing), discrepancy detector, health score, sync orchestrator, GBP correction push
- `app/api/nap-sync/` — run route, status route, cron route
- `app/dashboard/_components/ListingHealthPanel.tsx` — NAP health dashboard panel
- `app/dashboard/_components/ListingFixModal.tsx` — Fix instructions modal
- DB: listing_platform_ids, listing_snapshots, nap_discrepancies tables; nap_health_score + nap_last_checked_at on locations
- Tests: 103 Vitest + 9 Playwright
```

### Step 4: Update `MEMORY.md`

```markdown
## Decision: NAP Sync Architecture (Sprint 105 — 2026-03-01)
- Pluggable adapter pattern: each platform is an independent NAPAdapter subclass
- Promise.allSettled for parallel adapter execution — one failure never blocks others
- Auto-correction scope: GBP PATCH only (name, phone, address, website). Hours + operational_status explicitly blocked.
- Bing match confidence threshold: 0.8 address similarity
- Apple Maps: read-only (place search only) — always manual fix instructions
- Cron schedule: Monday 3 AM UTC (staggers 1hr after SOV cron)
- Multi-location cron support: runNAPSyncForAllLocations() loops all locations sequentially
- Manual resolve required for non-auto-correctable discrepancies (user clicks "Mark as Fixed")
```

### Step 5: Update `AI_RULES.md`

Append Rule 42 from the **🔮 AI_RULES Update** section above.

### Step 6: Verify all files are in sync

- [ ] `DEVLOG.md` has Sprint 105 entry with actual test counts (not placeholder "N")
- [ ] `CLAUDE.md` has Sprint 105 in implementation inventory
- [ ] `MEMORY.md` has NAP Sync architecture decision
- [ ] `AI_RULES.md` has Rule 42
- [ ] `docs/roadmap.md` shows NAP Sync as ✅ 100%
- [ ] `docs/09-BUILD-PLAN.md` has Sprint 105 checked off
- [ ] `docs/04-INTELLIGENCE-ENGINE-SPEC.md` updated with NAP Sync note

### Step 7: Git Commit

```bash
git add -A
git status
git commit -m "Sprint 105: NAP Sync Engine — Listing Management Foundation

- lib/nap-sync/: 4 platform adapters (GBP, Yelp, Apple Maps, Bing)
- lib/nap-sync/nap-discrepancy-detector.ts: pure diff, normalize, severity, fix instructions
- lib/nap-sync/nap-health-score.ts: 0–100 composite score, A–F grade
- lib/nap-sync/nap-sync-service.ts: orchestrator, parallel adapters (Promise.allSettled), cron runner
- lib/nap-sync/nap-push-corrections.ts: GBP PATCH (name/phone/address/website only; hours blocked)
- app/api/nap-sync/: run route, status route, cron route (CRON_SECRET gated)
- vercel.json: NAP sync cron Monday 3 AM UTC
- ListingHealthPanel: NAP score, per-platform cards, severity colors, fix modal, plan gate
- migration: listing_platform_ids, listing_snapshots, nap_discrepancies + nap_health_score on locations
- seed: golden tenant platform IDs + Yelp phone discrepancy + GBP match + nap_health_score=65
- tests: 103 Vitest passing + 9 Playwright passing — zero regressions
- docs: roadmap NAP Sync → 100%, DEVLOG, CLAUDE.md, MEMORY.md, AI_RULES Rule 42

Closes NAP Sync gap. Unblocks Sprint 106 (Schema Expansion) and Sprint 107 (Review Engine).
Establishes pluggable adapter pattern for future platform integrations."

git push origin main
```

---

## 🏁 Sprint Outcome

After Sprint 105 completes:

- **NAP Sync Engine: 0% → 100%** — Cross-platform listing accuracy gap closed
- LocalVector customers can see — for the first time — exactly which platforms have stale or wrong business data, with a single NAP Health Score summarizing their exposure
- GBP discrepancies (name, phone, address, website) are auto-corrected with one click
- Yelp, Apple Maps, and Bing discrepancies generate step-by-step human fix instructions directly in the dashboard
- Weekly cron ensures no listing data goes stale without the customer being alerted
- 103 Vitest + 9 Playwright tests protect all adapters, the detector, the score calculator, and the dashboard UI against regression
- Reuse of `lib/gbp/gbp-token-refresh.ts` and `mapGBPToLocation()` from Sprint 89 means zero duplicated GBP auth or mapping logic
- Sprint 106 (Schema Expansion) and Sprint 107 (Review Engine) are now unblocked — both depend on accurate NAP data being in the system
