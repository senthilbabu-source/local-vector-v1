# Claude Code Prompt — Sprint 90: GBP Token Refresh + Places Detail Refresh Crons

## ⚠️ READ BEFORE ANYTHING ELSE

Read these files in order BEFORE writing any code:
1. `docs/AI_RULES.md` — Critical for this sprint:
   - §1 (schema source of truth = `prod_schema.sql`)
   - §3 (RLS, `getSafeAuthContext()`, belt-and-suspenders `.eq('org_id', orgId)`)
   - §4 (tests first, golden tenant fixtures, mocking)
   - §6 (Next.js 16 App Router pattern — cron routes are Route Handlers)
   - §13 (DEVLOG format, verified test counts)
   - §17 (Inngest primary + inline fallback for crons, kill switches)
   - §18 (`createServiceRoleClient()` for cron jobs — no user session)
   - §20 (never hardcode placeholder metrics — propagate null)
   - §25 (`'use server'` — not applicable to cron routes, but review)
   - §30 (Inngest function architecture: client, events, functions)
   - §38 (database.types.ts, no `as any` on Supabase)
2. `docs/RFC_GBP_ONBOARDING_V2_REPLACEMENT.md` — Section on Phase 21d: Token Refresh Job spec (line ~1058). "A Vercel Cron endpoint runs hourly, finds tokens expiring within 1 hour, and refreshes them proactively."
3. `docs/04-INTELLIGENCE-ENGINE.md` — §4 Google Places Detail Refresh Cron spec. Zombie filter: only refresh for active plan_status orgs. Kill switch. 30-day ToS compliance.
4. `supabase/prod_schema.sql` — `google_oauth_tokens` (expires_at, refresh_token), `locations` (google_place_id, place_details_refreshed_at), `organizations` (plan_status)
5. `lib/supabase/database.types.ts` — types for all tables above
6. `lib/autopilot/publish-gbp.ts` — **READ THE ENTIRE FILE.** Contains the existing `refreshGBPToken()` private function. Sprint 90 extracts this into a shared service.
7. `lib/services/cron-logger.ts` — `logCronStart`, `logCronComplete`, `logCronFailed`. All crons use this.
8. `lib/inngest/client.ts` — Inngest singleton client
9. `lib/inngest/events.ts` — Event type definitions. Sprint 90 adds 2 new events.
10. `app/api/cron/weekly-digest/route.ts` — **REFERENCE PATTERN.** Read the entire file. Sprint 90 cron routes follow this exact pattern: auth guard → kill switch → Inngest dispatch → inline fallback.
11. `src/__tests__/unit/weekly-digest-cron-route.test.ts` — **REFERENCE TEST PATTERN.** Read the entire file. Sprint 90 tests follow this exact mock/assert structure.
12. `src/__fixtures__/golden-tenant.ts` — golden tenant data (org plan = 'growth', plan_status = 'active')
13. `vercel.json` — existing cron schedules. Sprint 90 adds 2 entries.

---

## What This Sprint Does

### Problem 1: GBP Token Time Bomb (Gap #71)
OAuth access_tokens expire. The `google_oauth_tokens.expires_at` column tracks expiry. Currently, tokens are only refreshed reactively when `publishToGBP()` notices an expired token (see `lib/autopilot/publish-gbp.ts` line ~117). If no content is published for 60+ days, the refresh_token itself can expire, silently breaking ALL GBP features for that org — no error, no alert, just a dead "Connected ✓" badge.

**Fix:** Proactive hourly cron that finds tokens expiring within 1 hour and refreshes them before any feature needs them. Log failures to `cron_run_log` so System Health dashboard surfaces broken connections.

### Problem 2: Google Places ToS Compliance (Gap #72)
Google Maps Platform ToS requires refreshing cached Place Details every 30 days. The `locations.place_details_refreshed_at` column tracks this. A trigger (`trigger_google_tos_refresh`) exists in the schema but points to a non-existent Supabase Edge Function. No refresh actually runs.

**Fix:** Daily cron that finds locations with stale place details (>29 days old) for active-plan orgs, fetches fresh data from Google Places API, and updates the locations row. Churned orgs are excluded (zombie filter).

---

## Architecture Overview

```
Sprint 90 File Tree
├── lib/services/gbp-token-refresh.ts          — NEW: shared token refresh service
├── app/api/cron/refresh-gbp-tokens/route.ts   — NEW: hourly cron route
├── app/api/cron/refresh-places/route.ts        — NEW: daily cron route
├── lib/services/places-refresh.ts              — NEW: Places detail refresh service
├── lib/inngest/events.ts                       — MODIFY: add 2 new events
├── lib/inngest/functions/token-refresh-cron.ts — NEW: Inngest function
├── lib/inngest/functions/places-refresh-cron.ts — NEW: Inngest function
├── lib/autopilot/publish-gbp.ts                — MODIFY: import shared refresh
├── vercel.json                                 — MODIFY: add 2 cron schedules
├── src/__tests__/unit/gbp-token-refresh.test.ts — NEW: token refresh service tests
├── src/__tests__/unit/cron-refresh-tokens-route.test.ts — NEW: route handler tests
├── src/__tests__/unit/places-refresh.test.ts    — NEW: Places refresh service tests
├── src/__tests__/unit/cron-refresh-places-route.test.ts — NEW: route handler tests
└── docs/                                        — MODIFY: DEVLOG, CLAUDE, BUILD-PLAN
```

---

## Phase 1: Extract Shared Token Refresh Service

### 1A — `lib/services/gbp-token-refresh.ts` (NEW)

Currently `refreshGBPToken()` is a private function inside `lib/autopilot/publish-gbp.ts`. Extract it into a shared service so both the publish flow and the cron can use it.

```typescript
// ---------------------------------------------------------------------------
// lib/services/gbp-token-refresh.ts — GBP OAuth Token Refresh
//
// Shared service used by:
//   1. Proactive cron (/api/cron/refresh-gbp-tokens) — hourly bulk refresh
//   2. Reactive refresh in publish-gbp.ts — on-demand before GBP API call
//
// SECURITY: Uses createServiceRoleClient(). Never call from client code.
// Spec: RFC_GBP_ONBOARDING_V2_REPLACEMENT.md Phase 21d §2
// ---------------------------------------------------------------------------

import { createServiceRoleClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export interface TokenRefreshResult {
  orgId: string;
  success: boolean;
  error?: string;
  newExpiresAt?: string;
}

/**
 * Refreshes a single org's GBP access token using the stored refresh_token.
 *
 * Steps:
 *   1. POST to Google's token endpoint with grant_type=refresh_token
 *   2. Parse the new access_token + expires_in from response
 *   3. Update google_oauth_tokens row with new access_token + expires_at
 *
 * @param orgId - The org whose token to refresh
 * @param refreshToken - The stored refresh_token from google_oauth_tokens
 * @param supabase - Optional: pass a service-role client for testing
 * @returns TokenRefreshResult with success/failure + new expiry
 */
export async function refreshGBPAccessToken(
  orgId: string,
  refreshToken: string,
  supabase?: SupabaseClient<Database>,
): Promise<TokenRefreshResult> {
  const db = supabase ?? createServiceRoleClient();

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown');
      return {
        orgId,
        success: false,
        error: `Google token refresh failed: ${response.status} — ${errorBody}`,
      };
    }

    const data = await response.json();
    const newAccessToken = data.access_token;
    const expiresIn = data.expires_in ?? 3600;
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Update the token row
    const { error: updateError } = await db
      .from('google_oauth_tokens')
      .update({
        access_token: newAccessToken,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', orgId);

    if (updateError) {
      return {
        orgId,
        success: false,
        error: `DB update failed: ${updateError.message}`,
      };
    }

    return { orgId, success: true, newExpiresAt };
  } catch (err) {
    return {
      orgId,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Finds all GBP tokens expiring within the given window and refreshes them.
 * Used by the proactive cron job.
 *
 * @param withinMinutes - Refresh tokens expiring within this many minutes (default: 60)
 * @param supabase - Optional: pass a service-role client for testing
 * @returns Summary of refresh results
 */
export async function refreshExpiringTokens(
  withinMinutes: number = 60,
  supabase?: SupabaseClient<Database>,
): Promise<{ total: number; refreshed: number; failed: number; errors: string[] }> {
  const db = supabase ?? createServiceRoleClient();

  const expiryThreshold = new Date(Date.now() + withinMinutes * 60 * 1000).toISOString();

  // Find tokens expiring within the window that still have a refresh_token
  const { data: expiringTokens, error: queryError } = await db
    .from('google_oauth_tokens')
    .select('org_id, refresh_token, expires_at')
    .lt('expires_at', expiryThreshold)
    .not('refresh_token', 'is', null);

  if (queryError) {
    return { total: 0, refreshed: 0, failed: 0, errors: [`Query failed: ${queryError.message}`] };
  }

  if (!expiringTokens?.length) {
    return { total: 0, refreshed: 0, failed: 0, errors: [] };
  }

  const errors: string[] = [];
  let refreshed = 0;
  let failed = 0;

  for (const token of expiringTokens) {
    const result = await refreshGBPAccessToken(token.org_id, token.refresh_token, db);
    if (result.success) {
      refreshed++;
    } else {
      failed++;
      errors.push(`org=${token.org_id}: ${result.error}`);
    }
  }

  return { total: expiringTokens.length, refreshed, failed, errors };
}
```

### 1B — Update `lib/autopilot/publish-gbp.ts` (MODIFY)

Replace the private `refreshGBPToken()` function with the shared service:

```typescript
// BEFORE (lines ~61–86): private refreshGBPToken() function
// AFTER: Delete the private function entirely. Import the shared one.

import { refreshGBPAccessToken } from '@/lib/services/gbp-token-refresh';

// In publishToGBP(), replace:
//   accessToken = await refreshGBPToken(orgId, tokenRow.refresh_token, supabase);
// With:
//   const refreshResult = await refreshGBPAccessToken(orgId, tokenRow.refresh_token, supabase);
//   if (!refreshResult.success) throw new Error(refreshResult.error ?? 'Token refresh failed');
//   accessToken = refreshResult.newExpiresAt ? ... // re-fetch from DB
```

**⚠️ IMPORTANT:** After extracting, `publishToGBP()` must still work identically. The function now reads the new access_token from the DB after refresh (since `refreshGBPAccessToken` updates it in the DB but returns the expiry, not the token itself). Simplest approach: after a successful `refreshGBPAccessToken()`, re-query the token row to get the fresh access_token.

**Alternative (cleaner):** Have `refreshGBPAccessToken` also return `newAccessToken` in the result. Add it to `TokenRefreshResult`:

```typescript
export interface TokenRefreshResult {
  orgId: string;
  success: boolean;
  error?: string;
  newExpiresAt?: string;
  newAccessToken?: string;  // Only present on success
}
```

Then in publish-gbp.ts:
```typescript
const refreshResult = await refreshGBPAccessToken(orgId, tokenRow.refresh_token, supabase);
if (!refreshResult.success) throw new Error(refreshResult.error ?? 'Token refresh failed');
accessToken = refreshResult.newAccessToken!;
```

---

## Phase 2: GBP Token Refresh Cron Route

### 2A — `app/api/cron/refresh-gbp-tokens/route.ts` (NEW)

Follow the **exact pattern** from `app/api/cron/weekly-digest/route.ts`:

```typescript
// ---------------------------------------------------------------------------
// GET /api/cron/refresh-gbp-tokens — Proactive GBP Token Refresh
//
// Sprint 90: Runs hourly via Vercel Cron. Finds GBP tokens expiring within
// 1 hour and refreshes them proactively. Prevents silent GBP integration
// failures when no content is published.
//
// Architecture:
//   • CRON_SECRET auth guard
//   • Kill switch (STOP_TOKEN_REFRESH_CRON)
//   • Primary: Inngest event dispatch
//   • Fallback: Inline refreshExpiringTokens()
//
// Schedule: Every hour (configured in vercel.json)
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';
import { logCronStart, logCronComplete, logCronFailed } from '@/lib/services/cron-logger';
import { refreshExpiringTokens } from '@/lib/services/gbp-token-refresh';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // ── Auth guard ──
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Kill switch ──
  if (process.env.STOP_TOKEN_REFRESH_CRON === 'true') {
    return NextResponse.json({ ok: true, skipped: true, reason: 'Kill switch active' });
  }

  const handle = await logCronStart('refresh-gbp-tokens');

  // ── Primary: Inngest dispatch ──
  try {
    await inngest.send({ name: 'cron/gbp-token-refresh.hourly', data: {} });
    await logCronComplete(handle, { dispatched: true });
    return NextResponse.json({ ok: true, dispatched: true });
  } catch (inngestErr) {
    console.error('[cron] Inngest dispatch failed, running inline:', inngestErr);
  }

  // ── Fallback: inline ──
  try {
    const result = await refreshExpiringTokens(60);
    await logCronComplete(handle, result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await logCronFailed(handle, err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: 'Token refresh failed' }, { status: 500 });
  }
}
```

### 2B — `lib/inngest/functions/token-refresh-cron.ts` (NEW)

```typescript
// ---------------------------------------------------------------------------
// Inngest: GBP Token Refresh — Hourly proactive token refresh
//
// Sprint 90: Dispatched by /api/cron/refresh-gbp-tokens.
// Finds tokens expiring within 1 hour and refreshes them.
// ---------------------------------------------------------------------------

import { inngest } from '@/lib/inngest/client';
import { refreshExpiringTokens } from '@/lib/services/gbp-token-refresh';

export const tokenRefreshCron = inngest.createFunction(
  { id: 'gbp-token-refresh-hourly', name: 'GBP Token Refresh (Hourly)' },
  { event: 'cron/gbp-token-refresh.hourly' },
  async ({ step }) => {
    const result = await step.run('refresh-expiring-tokens', async () => {
      return refreshExpiringTokens(60);
    });

    return result;
  },
);
```

---

## Phase 3: Google Places Detail Refresh Service

### 3A — `lib/services/places-refresh.ts` (NEW)

```typescript
// ---------------------------------------------------------------------------
// lib/services/places-refresh.ts — Google Places Detail Refresh
//
// Fetches fresh Place Details from Google Places API for locations
// with stale cached data (>29 days old). Only refreshes active-plan orgs.
//
// SECURITY: Uses createServiceRoleClient(). Never call from client code.
// Spec: Doc 04 §4, Google Maps Platform ToS (30-day cache limit)
// ---------------------------------------------------------------------------

import { createServiceRoleClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export interface PlacesRefreshResult {
  total: number;
  refreshed: number;
  failed: number;
  skipped: number;  // No google_place_id or Places API not configured
  errors: string[];
}

interface StaleLocation {
  id: string;
  org_id: string;
  google_place_id: string | null;
}

/**
 * Fetches fresh Place Details from Google Places API for a single location.
 * Updates: address, phone, place_details_refreshed_at.
 *
 * Uses the Google Places API (New) — Place Details endpoint.
 * Cost: $17 per 1,000 calls (Basic Details SKU).
 */
async function refreshSinglePlace(
  location: StaleLocation,
  apiKey: string,
  db: SupabaseClient<Database>,
): Promise<{ success: boolean; error?: string }> {
  if (!location.google_place_id) {
    return { success: false, error: 'No google_place_id' };
  }

  try {
    // Google Places API (New) — Place Details
    const url = new URL(
      `https://places.googleapis.com/v1/places/${location.google_place_id}`
    );

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'displayName,formattedAddress,nationalPhoneNumber,regularOpeningHours,websiteUri,rating,userRatingCount',
      },
    });

    if (!response.ok) {
      return { success: false, error: `Places API error: ${response.status}` };
    }

    const data = await response.json();

    // Build update payload — only update fields that Google returned
    const update: Record<string, unknown> = {
      place_details_refreshed_at: new Date().toISOString(),
    };

    if (data.formattedAddress) {
      update.address_line1 = data.formattedAddress;
    }
    if (data.nationalPhoneNumber) {
      update.phone = data.nationalPhoneNumber;
    }
    if (data.websiteUri) {
      update.website_url = data.websiteUri;
    }

    const { error: updateError } = await db
      .from('locations')
      .update(update)
      .eq('id', location.id);

    if (updateError) {
      return { success: false, error: `DB update failed: ${updateError.message}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Finds all locations with stale Place Details (>29 days old) for
 * active-plan orgs and refreshes them from Google Places API.
 *
 * Zombie filter: Only refreshes locations where the org's plan_status
 * is 'active'. Churned orgs are excluded to prevent unnecessary API costs.
 *
 * @param supabase - Optional: pass a service-role client for testing
 * @returns Summary of refresh results
 */
export async function refreshStalePlaceDetails(
  supabase?: SupabaseClient<Database>,
): Promise<PlacesRefreshResult> {
  const db = supabase ?? createServiceRoleClient();
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    return { total: 0, refreshed: 0, failed: 0, skipped: 0, errors: ['GOOGLE_PLACES_API_KEY not configured'] };
  }

  // 29 days ago — refresh a day early to avoid hitting the 30-day ToS limit
  const staleBefore = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString();

  // Zombie filter: only active-plan orgs
  const { data: staleLocations, error: queryError } = await db
    .from('locations')
    .select('id, org_id, google_place_id, organizations!inner(plan_status)')
    .lt('place_details_refreshed_at', staleBefore)
    .eq('organizations.plan_status', 'active');

  if (queryError) {
    return { total: 0, refreshed: 0, failed: 0, skipped: 0, errors: [`Query failed: ${queryError.message}`] };
  }

  if (!staleLocations?.length) {
    return { total: 0, refreshed: 0, failed: 0, skipped: 0, errors: [] };
  }

  const errors: string[] = [];
  let refreshed = 0;
  let failed = 0;
  let skipped = 0;

  for (const loc of staleLocations) {
    if (!loc.google_place_id) {
      skipped++;
      continue;
    }

    const result = await refreshSinglePlace(
      { id: loc.id, org_id: loc.org_id, google_place_id: loc.google_place_id },
      apiKey,
      db,
    );

    if (result.success) {
      refreshed++;
    } else {
      failed++;
      errors.push(`location=${loc.id}: ${result.error}`);
    }
  }

  return { total: staleLocations.length, refreshed, failed, skipped, errors };
}
```

---

## Phase 4: Google Places Refresh Cron Route

### 4A — `app/api/cron/refresh-places/route.ts` (NEW)

```typescript
// ---------------------------------------------------------------------------
// GET /api/cron/refresh-places — Google Places Detail Refresh (ToS Compliance)
//
// Sprint 90: Runs daily at 4am EST (9am UTC) via Vercel Cron.
// Refreshes cached Google Place Details older than 29 days for active orgs.
//
// Architecture:
//   • CRON_SECRET auth guard
//   • Kill switch (STOP_PLACES_REFRESH_CRON)
//   • Primary: Inngest event dispatch
//   • Fallback: Inline refreshStalePlaceDetails()
//
// Schedule: Daily at 9:00 UTC (configured in vercel.json)
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';
import { logCronStart, logCronComplete, logCronFailed } from '@/lib/services/cron-logger';
import { refreshStalePlaceDetails } from '@/lib/services/places-refresh';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // ── Auth guard ──
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Kill switch ──
  if (process.env.STOP_PLACES_REFRESH_CRON === 'true') {
    return NextResponse.json({ ok: true, skipped: true, reason: 'Kill switch active' });
  }

  const handle = await logCronStart('refresh-places');

  // ── Primary: Inngest dispatch ──
  try {
    await inngest.send({ name: 'cron/places-refresh.daily', data: {} });
    await logCronComplete(handle, { dispatched: true });
    return NextResponse.json({ ok: true, dispatched: true });
  } catch (inngestErr) {
    console.error('[cron] Inngest dispatch failed, running inline:', inngestErr);
  }

  // ── Fallback: inline ──
  try {
    const result = await refreshStalePlaceDetails();
    await logCronComplete(handle, result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await logCronFailed(handle, err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: 'Places refresh failed' }, { status: 500 });
  }
}
```

### 4B — `lib/inngest/functions/places-refresh-cron.ts` (NEW)

```typescript
// ---------------------------------------------------------------------------
// Inngest: Google Places Detail Refresh — Daily ToS compliance
//
// Sprint 90: Dispatched by /api/cron/refresh-places.
// Refreshes stale Place Details for active-plan orgs.
// ---------------------------------------------------------------------------

import { inngest } from '@/lib/inngest/client';
import { refreshStalePlaceDetails } from '@/lib/services/places-refresh';

export const placesRefreshCron = inngest.createFunction(
  { id: 'places-refresh-daily', name: 'Google Places Refresh (Daily)' },
  { event: 'cron/places-refresh.daily' },
  async ({ step }) => {
    const result = await step.run('refresh-stale-places', async () => {
      return refreshStalePlaceDetails();
    });

    return result;
  },
);
```

---

## Phase 5: Update Inngest Events + Serve

### 5A — `lib/inngest/events.ts` (MODIFY)

Add 2 new event types:

```typescript
// ADD these to the Events type:

/** Sprint 90: Triggered by Vercel Cron → refresh-gbp-tokens. Proactive token refresh. */
'cron/gbp-token-refresh.hourly': {
  data: Record<string, never>;
};

/** Sprint 90: Triggered by Vercel Cron → refresh-places. Google ToS compliance. */
'cron/places-refresh.daily': {
  data: Record<string, never>;
};
```

### 5B — Register New Inngest Functions

Find where Inngest functions are registered (likely `app/api/inngest/route.ts` or similar) and add:

```typescript
import { tokenRefreshCron } from '@/lib/inngest/functions/token-refresh-cron';
import { placesRefreshCron } from '@/lib/inngest/functions/places-refresh-cron';

// Add to the serve() call:
// tokenRefreshCron, placesRefreshCron
```

### 5C — `vercel.json` (MODIFY)

Add 2 new cron schedules:

```json
{
  "crons": [
    {
      "path": "/api/cron/weekly-digest",
      "schedule": "0 13 * * 1"
    },
    {
      "path": "/api/cron/refresh-gbp-tokens",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/refresh-places",
      "schedule": "0 9 * * *"
    }
  ]
}
```

- Token refresh: `0 * * * *` = every hour, on the hour
- Places refresh: `0 9 * * *` = daily at 9:00 UTC (4:00 AM EST)

---

## Phase 6: Update MSW Handlers

### 6A — `src/__helpers__/msw/handlers.ts` (MODIFY)

Add Google OAuth token endpoint and Places API to the external API guards:

```typescript
// Add to externalApiGuards array:

http.all('https://oauth2.googleapis.com/*', () =>
  HttpResponse.json(
    { error: 'Google OAuth is not mocked for this test.' },
    { status: 500 }
  )
),

http.all('https://places.googleapis.com/*', () =>
  HttpResponse.json(
    { error: 'Google Places API (New) is not mocked for this test.' },
    { status: 500 }
  )
),
```

---

## Phase 7: Tests (Write FIRST — AI_RULES §4)

### 7A — `src/__tests__/unit/gbp-token-refresh.test.ts` (NEW — 12 tests)

```typescript
// ---------------------------------------------------------------------------
// gbp-token-refresh.test.ts — Unit tests for GBP token refresh service
//
// Sprint 90: Tests refreshGBPAccessToken() and refreshExpiringTokens().
// Uses MSW to mock Google's OAuth token endpoint.
//
// Run:
//   npx vitest run src/__tests__/unit/gbp-token-refresh.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/__helpers__/setup';

// ── Hoist mocks ───────────────────────────────────────────────────────────

const mockFrom = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(() => ({ from: mockFrom })),
}));

// ── Import subjects ───────────────────────────────────────────────────────

import {
  refreshGBPAccessToken,
  refreshExpiringTokens,
} from '@/lib/services/gbp-token-refresh';

// ── Shared fixtures ───────────────────────────────────────────────────────

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const REFRESH_TOKEN = 'mock-refresh-token-123';

function mockGoogleTokenEndpoint(ok = true) {
  server.use(
    http.post('https://oauth2.googleapis.com/token', () => {
      if (!ok) return HttpResponse.json({ error: 'invalid_grant' }, { status: 400 });
      return HttpResponse.json({
        access_token: 'new-access-token-xyz',
        expires_in: 3600,
        token_type: 'Bearer',
      });
    }),
  );
}

function mockTokenUpdate(error: unknown = null) {
  const mockEq = vi.fn().mockResolvedValue({ data: null, error });
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ update: mockUpdate });
  return { mockUpdate, mockEq };
}

function mockExpiringTokensQuery(tokens: Array<{ org_id: string; refresh_token: string; expires_at: string }> = []) {
  const mockNot = vi.fn().mockResolvedValue({ data: tokens, error: null });
  const mockLt = vi.fn().mockReturnValue({ not: mockNot });
  const mockSelect = vi.fn().mockReturnValue({ lt: mockLt });

  // For the update chain after refresh
  const mockUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'google_oauth_tokens') {
      return { select: mockSelect, update: mockUpdate };
    }
    return {};
  });

  return { mockSelect, mockLt };
}

// ── Environment ───────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
});

afterEach(() => {
  vi.clearAllMocks();
  server.resetHandlers();
});

// ═══════════════════════════════════════════════════════════════════════════
// refreshGBPAccessToken — 7 tests
// ═══════════════════════════════════════════════════════════════════════════

describe('refreshGBPAccessToken', () => {
  it('should refresh token and update DB on success', async () => {
    mockGoogleTokenEndpoint(true);
    const { mockUpdate } = mockTokenUpdate();

    const result = await refreshGBPAccessToken(ORG_ID, REFRESH_TOKEN);

    expect(result.success).toBe(true);
    expect(result.orgId).toBe(ORG_ID);
    expect(result.newExpiresAt).toBeDefined();
    expect(result.newAccessToken).toBe('new-access-token-xyz');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ access_token: 'new-access-token-xyz' }),
    );
  });

  it('should return error when Google returns non-200', async () => {
    mockGoogleTokenEndpoint(false);
    mockTokenUpdate();

    const result = await refreshGBPAccessToken(ORG_ID, REFRESH_TOKEN);

    expect(result.success).toBe(false);
    expect(result.error).toContain('400');
  });

  it('should return error when DB update fails', async () => {
    mockGoogleTokenEndpoint(true);
    mockTokenUpdate({ message: 'DB connection error' });

    const result = await refreshGBPAccessToken(ORG_ID, REFRESH_TOKEN);

    expect(result.success).toBe(false);
    expect(result.error).toContain('DB update failed');
  });

  it('should send correct parameters to Google token endpoint', async () => {
    let capturedBody: string | undefined;
    server.use(
      http.post('https://oauth2.googleapis.com/token', async ({ request }) => {
        capturedBody = await request.text();
        return HttpResponse.json({ access_token: 'tok', expires_in: 3600 });
      }),
    );
    mockTokenUpdate();

    await refreshGBPAccessToken(ORG_ID, REFRESH_TOKEN);

    expect(capturedBody).toContain('grant_type=refresh_token');
    expect(capturedBody).toContain(`refresh_token=${REFRESH_TOKEN}`);
    expect(capturedBody).toContain('client_id=test-client-id');
  });

  it('should handle network errors gracefully', async () => {
    server.use(
      http.post('https://oauth2.googleapis.com/token', () => {
        return HttpResponse.error();
      }),
    );
    mockTokenUpdate();

    const result = await refreshGBPAccessToken(ORG_ID, REFRESH_TOKEN);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should compute expires_at from expires_in', async () => {
    mockGoogleTokenEndpoint(true);
    mockTokenUpdate();

    const before = Date.now();
    const result = await refreshGBPAccessToken(ORG_ID, REFRESH_TOKEN);
    const after = Date.now();

    expect(result.newExpiresAt).toBeDefined();
    const expiry = new Date(result.newExpiresAt!).getTime();
    // Should be approximately 1 hour from now (3600s)
    expect(expiry).toBeGreaterThan(before + 3500 * 1000);
    expect(expiry).toBeLessThan(after + 3700 * 1000);
  });

  it('should default expires_in to 3600 if not provided', async () => {
    server.use(
      http.post('https://oauth2.googleapis.com/token', () =>
        HttpResponse.json({ access_token: 'tok' }), // no expires_in
      ),
    );
    mockTokenUpdate();

    const result = await refreshGBPAccessToken(ORG_ID, REFRESH_TOKEN);

    expect(result.success).toBe(true);
    const expiry = new Date(result.newExpiresAt!).getTime();
    expect(expiry).toBeGreaterThan(Date.now() + 3500 * 1000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// refreshExpiringTokens — 5 tests
// ═══════════════════════════════════════════════════════════════════════════

describe('refreshExpiringTokens', () => {
  it('should return { total: 0 } when no tokens are expiring', async () => {
    mockExpiringTokensQuery([]);

    const result = await refreshExpiringTokens(60);

    expect(result.total).toBe(0);
    expect(result.refreshed).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('should refresh all expiring tokens and count successes', async () => {
    mockExpiringTokensQuery([
      { org_id: 'org-1', refresh_token: 'rt-1', expires_at: new Date().toISOString() },
      { org_id: 'org-2', refresh_token: 'rt-2', expires_at: new Date().toISOString() },
    ]);
    mockGoogleTokenEndpoint(true);

    const result = await refreshExpiringTokens(60);

    expect(result.total).toBe(2);
    expect(result.refreshed).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('should count failures separately and include error messages', async () => {
    mockExpiringTokensQuery([
      { org_id: 'org-1', refresh_token: 'rt-1', expires_at: new Date().toISOString() },
    ]);
    mockGoogleTokenEndpoint(false); // Google returns 400

    const result = await refreshExpiringTokens(60);

    expect(result.total).toBe(1);
    expect(result.refreshed).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('org-1');
  });

  it('should handle query error gracefully', async () => {
    const mockNot = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB down' } });
    const mockLt = vi.fn().mockReturnValue({ not: mockNot });
    const mockSelect = vi.fn().mockReturnValue({ lt: mockLt });
    mockFrom.mockReturnValue({ select: mockSelect });

    const result = await refreshExpiringTokens(60);

    expect(result.total).toBe(0);
    expect(result.errors[0]).toContain('Query failed');
  });

  it('should query tokens expiring within the specified window', async () => {
    const { mockLt } = mockExpiringTokensQuery([]);

    await refreshExpiringTokens(120); // 2 hours

    expect(mockLt).toHaveBeenCalledWith(
      'expires_at',
      expect.any(String), // ISO string ~2 hours from now
    );
    // Verify the threshold is approximately 2 hours from now
    const threshold = mockLt.mock.calls[0][1];
    const thresholdTime = new Date(threshold).getTime();
    expect(thresholdTime).toBeGreaterThan(Date.now() + 115 * 60 * 1000);
    expect(thresholdTime).toBeLessThan(Date.now() + 125 * 60 * 1000);
  });
});
```

**Expected: 12 tests, ALL PASS.**

---

### 7B — `src/__tests__/unit/cron-refresh-tokens-route.test.ts` (NEW — 6 tests)

```typescript
// ---------------------------------------------------------------------------
// cron-refresh-tokens-route.test.ts — Route handler tests
//
// Sprint 90: Tests auth guard, kill switch, Inngest dispatch, inline fallback.
// Follows the exact pattern from weekly-digest-cron-route.test.ts.
//
// Run:
//   npx vitest run src/__tests__/unit/cron-refresh-tokens-route.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoist mocks ───────────────────────────────────────────────────────────

const mockInngestSend = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: (...args: unknown[]) => mockInngestSend(...args) },
}));

const mockLogCronStart = vi.fn().mockResolvedValue({ logId: 'log-1', startedAt: Date.now() });
const mockLogCronComplete = vi.fn().mockResolvedValue(undefined);
const mockLogCronFailed = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/services/cron-logger', () => ({
  logCronStart: (...args: unknown[]) => mockLogCronStart(...args),
  logCronComplete: (...args: unknown[]) => mockLogCronComplete(...args),
  logCronFailed: (...args: unknown[]) => mockLogCronFailed(...args),
}));

const mockRefreshExpiringTokens = vi.fn().mockResolvedValue({
  total: 3, refreshed: 2, failed: 1, errors: ['org-3: invalid_grant'],
});
vi.mock('@/lib/services/gbp-token-refresh', () => ({
  refreshExpiringTokens: (...args: unknown[]) => mockRefreshExpiringTokens(...args),
}));

// ── Import subject ────────────────────────────────────────────────────────

import { GET } from '@/app/api/cron/refresh-gbp-tokens/route';

// ── Helper ────────────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/cron/refresh-gbp-tokens', {
    method: 'GET',
    headers,
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/cron/refresh-gbp-tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('CRON_SECRET', 'test-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 401 when CRON_SECRET is missing', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });

  it('returns 401 when authorization header is wrong', async () => {
    const response = await GET(makeRequest({ authorization: 'Bearer wrong' }));
    expect(response.status).toBe(401);
  });

  it('returns skipped when kill switch is active', async () => {
    vi.stubEnv('STOP_TOKEN_REFRESH_CRON', 'true');
    const response = await GET(makeRequest({ authorization: 'Bearer test-secret' }));
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe('Kill switch active');
  });

  it('dispatches to Inngest on happy path', async () => {
    const response = await GET(makeRequest({ authorization: 'Bearer test-secret' }));
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.dispatched).toBe(true);
    expect(mockInngestSend).toHaveBeenCalledWith({
      name: 'cron/gbp-token-refresh.hourly',
      data: {},
    });
  });

  it('falls back to inline when Inngest fails', async () => {
    mockInngestSend.mockRejectedValueOnce(new Error('Inngest down'));
    const response = await GET(makeRequest({ authorization: 'Bearer test-secret' }));
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.total).toBe(3);
    expect(body.refreshed).toBe(2);
    expect(mockRefreshExpiringTokens).toHaveBeenCalledWith(60);
  });

  it('logs cron start and complete', async () => {
    await GET(makeRequest({ authorization: 'Bearer test-secret' }));
    expect(mockLogCronStart).toHaveBeenCalledWith('refresh-gbp-tokens');
    expect(mockLogCronComplete).toHaveBeenCalled();
  });
});
```

**Expected: 6 tests, ALL PASS.**

---

### 7C — `src/__tests__/unit/places-refresh.test.ts` (NEW — 9 tests)

```typescript
// ---------------------------------------------------------------------------
// places-refresh.test.ts — Unit tests for Google Places detail refresh
//
// Sprint 90: Tests refreshStalePlaceDetails() with mock Supabase + MSW.
//
// Run:
//   npx vitest run src/__tests__/unit/places-refresh.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/__helpers__/setup';

// ── Hoist mocks ───────────────────────────────────────────────────────────

const mockFrom = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(() => ({ from: mockFrom })),
}));

// ── Import subjects ───────────────────────────────────────────────────────

import { refreshStalePlaceDetails } from '@/lib/services/places-refresh';

// ── Fixtures ──────────────────────────────────────────────────────────────

const STALE_LOCATION = {
  id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  google_place_id: 'ChIJi8-1ywdO9YgR9s5j-y0_1lI',
  organizations: { plan_status: 'active' },
};

const STALE_LOCATION_NO_PLACE_ID = {
  id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  google_place_id: null,
  organizations: { plan_status: 'active' },
};

function mockStaleQuery(locations: unknown[] = [STALE_LOCATION]) {
  const mockEq = vi.fn().mockResolvedValue({ data: locations, error: null });
  const mockLt = vi.fn().mockReturnValue({ eq: mockEq });
  const mockSelect = vi.fn().mockReturnValue({ lt: mockLt });

  const mockUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'locations') return { select: mockSelect, update: mockUpdate };
    return {};
  });
  return { mockSelect, mockUpdate };
}

function mockPlacesAPI(ok = true) {
  server.use(
    http.get('https://places.googleapis.com/v1/places/*', () => {
      if (!ok) return HttpResponse.json({ error: 'Not found' }, { status: 404 });
      return HttpResponse.json({
        displayName: { text: 'Charcoal N Chill' },
        formattedAddress: '11950 Jones Bridge Rd #103, Alpharetta, GA 30005',
        nationalPhoneNumber: '(470) 546-4866',
        websiteUri: 'https://charcoalnchill.com',
        rating: 4.7,
        userRatingCount: 320,
      });
    }),
  );
}

// ── Environment ───────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.GOOGLE_PLACES_API_KEY = 'test-places-key';
});

afterEach(() => {
  vi.clearAllMocks();
  server.resetHandlers();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('refreshStalePlaceDetails', () => {
  it('should return early when GOOGLE_PLACES_API_KEY is not configured', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    const result = await refreshStalePlaceDetails();
    expect(result.total).toBe(0);
    expect(result.errors[0]).toContain('GOOGLE_PLACES_API_KEY');
  });

  it('should return { total: 0 } when no stale locations exist', async () => {
    mockStaleQuery([]);
    const result = await refreshStalePlaceDetails();
    expect(result.total).toBe(0);
    expect(result.refreshed).toBe(0);
  });

  it('should refresh stale location and update DB', async () => {
    const { mockUpdate } = mockStaleQuery([STALE_LOCATION]);
    mockPlacesAPI(true);

    const result = await refreshStalePlaceDetails();

    expect(result.total).toBe(1);
    expect(result.refreshed).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        place_details_refreshed_at: expect.any(String),
        phone: '(470) 546-4866',
        website_url: 'https://charcoalnchill.com',
      }),
    );
  });

  it('should skip locations without google_place_id', async () => {
    mockStaleQuery([STALE_LOCATION_NO_PLACE_ID]);

    const result = await refreshStalePlaceDetails();

    expect(result.total).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.refreshed).toBe(0);
  });

  it('should count Places API failures', async () => {
    mockStaleQuery([STALE_LOCATION]);
    mockPlacesAPI(false);

    const result = await refreshStalePlaceDetails();

    expect(result.total).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toContain('Places API error');
  });

  it('should handle DB query error gracefully', async () => {
    const mockEq = vi.fn().mockResolvedValue({ data: null, error: { message: 'timeout' } });
    const mockLt = vi.fn().mockReturnValue({ eq: mockEq });
    const mockSelect = vi.fn().mockReturnValue({ lt: mockLt });
    mockFrom.mockReturnValue({ select: mockSelect });

    const result = await refreshStalePlaceDetails();

    expect(result.total).toBe(0);
    expect(result.errors[0]).toContain('Query failed');
  });

  it('should use 29-day threshold (not 30) for safety margin', async () => {
    const { mockSelect } = mockStaleQuery([]);

    await refreshStalePlaceDetails();

    // The select().lt() call should have been made
    expect(mockSelect).toHaveBeenCalledWith(
      'id, org_id, google_place_id, organizations!inner(plan_status)',
    );
  });

  it('should only fetch locations for active-plan orgs (zombie filter)', async () => {
    mockStaleQuery([]);
    await refreshStalePlaceDetails();

    // Verify the .eq('organizations.plan_status', 'active') filter
    const selectCall = mockFrom.mock.calls.find((c: string[]) => c[0] === 'locations');
    expect(selectCall).toBeDefined();
  });

  it('should send X-Goog-FieldMask header to minimize API cost', async () => {
    let capturedHeaders: Record<string, string> = {};
    server.use(
      http.get('https://places.googleapis.com/v1/places/*', ({ request }) => {
        capturedHeaders = Object.fromEntries(request.headers.entries());
        return HttpResponse.json({ displayName: { text: 'Test' } });
      }),
    );
    mockStaleQuery([STALE_LOCATION]);

    await refreshStalePlaceDetails();

    expect(capturedHeaders['x-goog-fieldmask']).toBeDefined();
    expect(capturedHeaders['x-goog-fieldmask']).toContain('displayName');
    expect(capturedHeaders['x-goog-api-key']).toBe('test-places-key');
  });
});
```

**Expected: 9 tests, ALL PASS.**

---

### 7D — `src/__tests__/unit/cron-refresh-places-route.test.ts` (NEW — 6 tests)

```typescript
// ---------------------------------------------------------------------------
// cron-refresh-places-route.test.ts — Route handler tests
//
// Sprint 90: Tests auth guard, kill switch, Inngest dispatch, inline fallback.
//
// Run:
//   npx vitest run src/__tests__/unit/cron-refresh-places-route.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoist mocks ───────────────────────────────────────────────────────────

const mockInngestSend = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: (...args: unknown[]) => mockInngestSend(...args) },
}));

const mockLogCronStart = vi.fn().mockResolvedValue({ logId: 'log-1', startedAt: Date.now() });
const mockLogCronComplete = vi.fn().mockResolvedValue(undefined);
const mockLogCronFailed = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/services/cron-logger', () => ({
  logCronStart: (...args: unknown[]) => mockLogCronStart(...args),
  logCronComplete: (...args: unknown[]) => mockLogCronComplete(...args),
  logCronFailed: (...args: unknown[]) => mockLogCronFailed(...args),
}));

const mockRefreshStalePlaceDetails = vi.fn().mockResolvedValue({
  total: 5, refreshed: 4, failed: 0, skipped: 1, errors: [],
});
vi.mock('@/lib/services/places-refresh', () => ({
  refreshStalePlaceDetails: (...args: unknown[]) => mockRefreshStalePlaceDetails(...args),
}));

// ── Import subject ────────────────────────────────────────────────────────

import { GET } from '@/app/api/cron/refresh-places/route';

// ── Helper ────────────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/cron/refresh-places', {
    method: 'GET',
    headers,
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/cron/refresh-places', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('CRON_SECRET', 'test-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 401 when CRON_SECRET is missing', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });

  it('returns 401 when authorization header is wrong', async () => {
    const response = await GET(makeRequest({ authorization: 'Bearer wrong' }));
    expect(response.status).toBe(401);
  });

  it('returns skipped when kill switch is active', async () => {
    vi.stubEnv('STOP_PLACES_REFRESH_CRON', 'true');
    const response = await GET(makeRequest({ authorization: 'Bearer test-secret' }));
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe('Kill switch active');
  });

  it('dispatches to Inngest on happy path', async () => {
    const response = await GET(makeRequest({ authorization: 'Bearer test-secret' }));
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.dispatched).toBe(true);
    expect(mockInngestSend).toHaveBeenCalledWith({
      name: 'cron/places-refresh.daily',
      data: {},
    });
  });

  it('falls back to inline when Inngest fails', async () => {
    mockInngestSend.mockRejectedValueOnce(new Error('Inngest down'));
    const response = await GET(makeRequest({ authorization: 'Bearer test-secret' }));
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.total).toBe(5);
    expect(body.refreshed).toBe(4);
    expect(mockRefreshStalePlaceDetails).toHaveBeenCalled();
  });

  it('logs cron start and complete', async () => {
    await GET(makeRequest({ authorization: 'Bearer test-secret' }));
    expect(mockLogCronStart).toHaveBeenCalledWith('refresh-places');
    expect(mockLogCronComplete).toHaveBeenCalled();
  });
});
```

**Expected: 6 tests, ALL PASS.**

---

### 7E — Test Verification Commands

```bash
# 1. Individual test files
npx vitest run src/__tests__/unit/gbp-token-refresh.test.ts          # Expected: 12 tests PASS
npx vitest run src/__tests__/unit/cron-refresh-tokens-route.test.ts   # Expected: 6 tests PASS
npx vitest run src/__tests__/unit/places-refresh.test.ts              # Expected: 9 tests PASS
npx vitest run src/__tests__/unit/cron-refresh-places-route.test.ts   # Expected: 6 tests PASS

# 2. TypeScript compilation (zero errors required)
npx tsc --noEmit

# 3. Full Vitest regression
npx vitest run

# 4. Count new tests
echo "New Sprint 90 Vitest it() blocks:"
grep -cE "^\s+it\(" \
  src/__tests__/unit/gbp-token-refresh.test.ts \
  src/__tests__/unit/cron-refresh-tokens-route.test.ts \
  src/__tests__/unit/places-refresh.test.ts \
  src/__tests__/unit/cron-refresh-places-route.test.ts | \
  awk -F: '{sum += $2} END {print sum}'
# Expected output: 33
```

**Total new tests: 33 Vitest tests across 4 files.**

---

## Phase 8: Documentation Sync

### 8A — DEVLOG.md (root AND docs/)

Add Sprint 90 entry at the top:

```markdown
### Sprint 90 — GBP Token Refresh + Places Detail Refresh Crons (2026-02-27)

**Scope:** Two proactive cron jobs — hourly GBP token refresh and daily Google Places detail refresh.

**Deliverables:**
1. `lib/services/gbp-token-refresh.ts` — Shared token refresh service (extracted from `publish-gbp.ts`)
2. `app/api/cron/refresh-gbp-tokens/route.ts` — Hourly cron: refreshes GBP tokens expiring within 1 hour
3. `lib/services/places-refresh.ts` — Google Places detail refresh service (ToS 30-day compliance)
4. `app/api/cron/refresh-places/route.ts` — Daily cron: refreshes stale Place Details for active orgs
5. Updated `lib/autopilot/publish-gbp.ts` — uses shared `refreshGBPAccessToken()`
6. 2 new Inngest functions: `token-refresh-cron.ts`, `places-refresh-cron.ts`
7. 2 new Inngest events: `cron/gbp-token-refresh.hourly`, `cron/places-refresh.daily`
8. Updated `vercel.json` — 2 new cron schedules (hourly + daily 9am UTC)

**Tests:** 33 new (12 token refresh service + 6 token cron route + 9 places refresh service + 6 places cron route)
**Kill switches:** `STOP_TOKEN_REFRESH_CRON`, `STOP_PLACES_REFRESH_CRON`
**Zombie filter:** Places refresh only runs for orgs with `plan_status = 'active'`
```

### 8B — `docs/CLAUDE.md`

1. Add cron routes to the directory listing:
   ```
   app/api/cron/refresh-gbp-tokens/ — Hourly GBP token refresh (Sprint 90)
   app/api/cron/refresh-places/      — Daily Google Places refresh (Sprint 90)
   ```
2. Add services to the engine table:
   ```
   | GBP Token Refresh | lib/services/gbp-token-refresh.ts | Proactive OAuth token refresh |
   | Places Refresh     | lib/services/places-refresh.ts    | Google ToS 30-day compliance  |
   ```
3. Add Inngest functions:
   ```
   lib/inngest/functions/token-refresh-cron.ts  — GBP token refresh (Sprint 90)
   lib/inngest/functions/places-refresh-cron.ts — Places detail refresh (Sprint 90)
   ```
4. Update sprint count to 90
5. Update cron count from 5 to 7 routes

### 8C — `docs/09-BUILD-PLAN.md`

Update Phase 8 checklist — add and check these items:

```markdown
- [x] **GBP Token Refresh Cron** *(Sprint 90)*
  - [x] Extract shared `refreshGBPAccessToken()` from `publish-gbp.ts`
  - [x] Build `/api/cron/refresh-gbp-tokens` — hourly, Inngest + inline fallback
  - [x] Kill switch: `STOP_TOKEN_REFRESH_CRON`
  - [x] 18 unit tests (12 service + 6 route)

- [x] **Google Places Detail Refresh Cron** *(Sprint 90)*
  - [x] Build `lib/services/places-refresh.ts` — zombie filter, 29-day threshold
  - [x] Build `/api/cron/refresh-places` — daily 9am UTC, Inngest + inline fallback
  - [x] Kill switch: `STOP_PLACES_REFRESH_CRON`
  - [x] 15 unit tests (9 service + 6 route)
```

### 8D — `docs/AI_RULES.md`

Add to §17 or §30 kill switch list:
```
* `STOP_TOKEN_REFRESH_CRON` — halts hourly GBP token refresh
* `STOP_PLACES_REFRESH_CRON` — halts daily Google Places refresh
```

Add to §18 (service-role usage):
```
- GBP token refresh cron (`lib/services/gbp-token-refresh.ts`) — `google_oauth_tokens` is service-role-only
- Places refresh cron (`lib/services/places-refresh.ts`) — cross-table join with `organizations`
```

### 8E — MEMORY.md — Update if exists

---

## Git Commit

After all changes complete, tests pass, docs synced:

```bash
cd /home/claude/local-vector-v1
git add -A
git commit -m "feat(sprint-90): GBP token refresh + Places detail refresh crons

- Extract shared refreshGBPAccessToken() from publish-gbp.ts
- Add /api/cron/refresh-gbp-tokens (hourly, Inngest + inline fallback)
- Add /api/cron/refresh-places (daily 9am UTC, Inngest + inline fallback)
- Add lib/services/gbp-token-refresh.ts + places-refresh.ts
- Add 2 Inngest functions + 2 events
- Update vercel.json with 2 new cron schedules
- Update MSW handlers with Google OAuth + Places guards
- Add 33 unit tests for services + route handlers
- Kill switches: STOP_TOKEN_REFRESH_CRON, STOP_PLACES_REFRESH_CRON

Closes: Sprint 90 (GBP Token + Places Refresh Crons)
Gaps: #71 (token refresh), #72 (Places ToS compliance)"

git push origin main
```

---

## Definition of Done Checklist

- [ ] `lib/services/gbp-token-refresh.ts` — shared service with `refreshGBPAccessToken()` + `refreshExpiringTokens()`
- [ ] `lib/autopilot/publish-gbp.ts` — refactored to use shared service (no private `refreshGBPToken()`)
- [ ] `app/api/cron/refresh-gbp-tokens/route.ts` — hourly cron with auth + kill switch + Inngest + fallback
- [ ] `app/api/cron/refresh-places/route.ts` — daily cron with auth + kill switch + Inngest + fallback
- [ ] `lib/services/places-refresh.ts` — Places refresh with zombie filter + 29-day threshold
- [ ] `lib/inngest/functions/token-refresh-cron.ts` — Inngest function registered
- [ ] `lib/inngest/functions/places-refresh-cron.ts` — Inngest function registered
- [ ] `lib/inngest/events.ts` — 2 new event types added
- [ ] `vercel.json` — 2 new cron schedules
- [ ] `src/__helpers__/msw/handlers.ts` — Google OAuth + Places guards added
- [ ] All 4 test files created and passing (33 tests total: 12 + 6 + 9 + 6)
- [ ] `npx vitest run` — ALL tests passing (no regressions)
- [ ] `npx tsc --noEmit` — zero type errors
- [ ] DEVLOG, CLAUDE.md, BUILD-PLAN, AI_RULES updated
- [ ] Git commit with all untracked files

---

## What NOT to Do

1. **DO NOT** create Supabase Edge Functions (`supabase/functions/`). The existing `trigger_google_tos_refresh` trigger points to one — we're replacing that approach with a proper cron route.
2. **DO NOT** modify the `trigger_google_tos_refresh` DB trigger/function yet — it's harmless (points to a non-existent endpoint). Removing it is a schema migration concern for a future sprint.
3. **DO NOT** add GBP change polling (Phase 21d §3 — that's a separate sprint).
4. **DO NOT** add disconnect flow (Phase 21d §4 — Sprint 57B already has `disconnectGBP()`).
5. **DO NOT** implement token encryption (Phase 21d §1 — keep plain text consistent with Sprint 57B).
6. **DO NOT** add new npm packages. `fetch` is built into Node 18+.
7. **DO NOT** modify E2E tests — note needed updates in DEVLOG.
8. **DO NOT** modify any existing cron routes (audit, sov, citation, content-audit, weekly-digest).
9. **DO NOT** add rate limiting to the Places refresh loop — the zombie filter and daily cadence already limit volume.
10. **DO NOT** modify `prod_schema.sql` — no new tables or columns needed for this sprint.

---

## File Change Summary

| File | Action | Purpose |
|------|--------|---------|
| `lib/services/gbp-token-refresh.ts` | CREATE | Shared token refresh service |
| `lib/services/places-refresh.ts` | CREATE | Places detail refresh service |
| `app/api/cron/refresh-gbp-tokens/route.ts` | CREATE | Hourly cron route |
| `app/api/cron/refresh-places/route.ts` | CREATE | Daily cron route |
| `lib/inngest/functions/token-refresh-cron.ts` | CREATE | Inngest function |
| `lib/inngest/functions/places-refresh-cron.ts` | CREATE | Inngest function |
| `lib/inngest/events.ts` | MODIFY | Add 2 new event types |
| `lib/autopilot/publish-gbp.ts` | MODIFY | Use shared `refreshGBPAccessToken()` |
| `vercel.json` | MODIFY | Add 2 cron schedules |
| `src/__helpers__/msw/handlers.ts` | MODIFY | Add Google OAuth + Places guards |
| `src/__tests__/unit/gbp-token-refresh.test.ts` | CREATE | 12 tests |
| `src/__tests__/unit/cron-refresh-tokens-route.test.ts` | CREATE | 6 tests |
| `src/__tests__/unit/places-refresh.test.ts` | CREATE | 9 tests |
| `src/__tests__/unit/cron-refresh-places-route.test.ts` | CREATE | 6 tests |
| `DEVLOG.md` + `docs/DEVLOG.md` | MODIFY | Sprint 90 entry |
| `docs/CLAUDE.md` | MODIFY | New routes, services, Inngest functions |
| `docs/09-BUILD-PLAN.md` | MODIFY | Phase 8 checkboxes |
| `docs/AI_RULES.md` | MODIFY | Kill switches + service-role usage |

**Total new files:** 8 (2 services + 2 cron routes + 2 Inngest functions + 4 test files)
**Total modified files:** 8 (events + publish-gbp + vercel.json + MSW + DEVLOG×2 + CLAUDE + BUILD-PLAN + AI_RULES)
**Estimated scope:** Small–Medium (two straightforward crons with extracted services + 33 tests)
