// ---------------------------------------------------------------------------
// app/api/integrations/verify-bing/route.ts — Sprint M (C2 Phase 2)
//
// POST endpoint that looks up a business on Bing Places by name + location
// and compares the result against the org's verified location data.
//
// Auth: getSafeAuthContext() — org_id derived server-side (AI_RULES §4).
// Rate limit: 1 call per (location_id, 'bing') per 24 hours.
// External: Bing Local Business Search REST API (read-only).
//
// Key differences from verify-yelp:
//   • Auth via query parameter (key=), not Bearer header
//   • Name + city search, not phone-based lookup
//   • Response: resourceSets[0].resources[] instead of businesses[]
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { detectDiscrepancies, type VerificationResult } from '@/lib/integrations/detect-discrepancies';
import * as Sentry from '@sentry/nextjs';

const BING_LOCAL_SEARCH = 'https://dev.virtualearth.net/REST/v1/LocalSearch/';
const RATE_LIMIT_HOURS = 24;

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // ── Parse request body ──────────────────────────────────────────────────
  let body: { locationId?: string };
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: 'verify-bing', action: 'parse-body', sprint: 'M' },
    });
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const locationId = body.locationId?.trim() ?? '';
  if (!locationId) {
    return NextResponse.json({ error: 'locationId is required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    // ── Fetch location data (name, address, city for Bing search) ────────
    const { data: location, error: locError } = await supabase
      .from('locations')
      .select('id, business_name, address_line1, city, state, zip, phone')
      .eq('id', locationId)
      .eq('org_id', ctx.orgId)
      .single();

    if (locError || !location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    if (!location.business_name) {
      return NextResponse.json(
        { error: 'No business name configured for this location' },
        { status: 400 },
      );
    }

    // ── Rate-limit check: was this verified in the last 24 hours? ────────
    const { data: existingRow } = await supabase
      .from('location_integrations')
      .select('verified_at, verification_result')
      .eq('location_id', locationId)
      .eq('platform', 'bing')
      .maybeSingle();

    if (existingRow?.verified_at) {
      const hoursAgo =
        (Date.now() - new Date(existingRow.verified_at).getTime()) / (1000 * 60 * 60);
      if (hoursAgo < RATE_LIMIT_HOURS) {
        return NextResponse.json({
          cached: true,
          result: existingRow.verification_result as unknown as VerificationResult,
        });
      }
    }

    // ── Bing API key check ──────────────────────────────────────────────
    const bingKey = process.env.BING_MAPS_KEY;
    if (!bingKey) {
      Sentry.captureException(new Error('BING_MAPS_KEY not configured'), {
        tags: { component: 'verify-bing', sprint: 'M' },
      });
      return NextResponse.json({ error: 'Bing API not configured' }, { status: 503 });
    }

    // ── Build search URL ────────────────────────────────────────────────
    // Bing uses name + location search (not phone-based like Yelp).
    // Include city in query for better location accuracy.
    const queryParts = [location.business_name, location.city].filter(Boolean);
    const params = new URLSearchParams({
      query: queryParts.join(', '),
      key: bingKey,
      maxResults: '5',
    });

    // ── Call Bing Local Search API ───────────────────────────────────────
    const bingRes = await fetch(`${BING_LOCAL_SEARCH}?${params}`, {
      headers: { Accept: 'application/json' },
    });

    if (!bingRes.ok) {
      const errorBody = await bingRes.text();
      Sentry.captureException(new Error(`Bing API error: ${bingRes.status}`), {
        tags: { component: 'verify-bing', sprint: 'M' },
        extra: { status: bingRes.status, body: errorBody },
      });
      return NextResponse.json({ error: 'Bing API request failed' }, { status: 502 });
    }

    const bingData = await bingRes.json();
    const resources: Record<string, unknown>[] =
      bingData?.resourceSets?.[0]?.resources ?? [];

    const business = findBestBingMatch(resources, location.business_name);

    if (!business) {
      // No match found on Bing
      const result: VerificationResult = {
        found: false,
        discrepancies: [],
        verifiedAt: new Date().toISOString(),
      };

      await upsertVerification(supabase, ctx.orgId, locationId, result);
      return NextResponse.json({ cached: false, result });
    }

    // ── Compare Bing data against local location data ───────────────────
    const bingAddress = formatBingAddress(business.Address as Record<string, string> | undefined);
    const bingPhone = getString(business.PhoneNumber ?? business.phone);

    const discrepancies = detectDiscrepancies(
      {
        name: getString(business.name),
        address: bingAddress,
        phone: bingPhone,
      },
      location,
    );

    const result: VerificationResult = {
      found: true,
      platformName: getString(business.name),
      platformAddress: bingAddress || undefined,
      platformPhone: bingPhone || undefined,
      platformUrl: getString(business.Website ?? business.url) || undefined,
      discrepancies,
      verifiedAt: new Date().toISOString(),
    };

    await upsertVerification(supabase, ctx.orgId, locationId, result);
    return NextResponse.json({ cached: false, result });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'verify-bing', sprint: 'M' },
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Helpers — exported for unit testing
// ---------------------------------------------------------------------------

function getString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * Find the best matching business from Bing results by fuzzy name comparison.
 * Falls back to the first result if no name match is found.
 * Returns null for empty result arrays.
 */
export function findBestBingMatch(
  resources: Record<string, unknown>[],
  targetName: string,
): Record<string, unknown> | null {
  if (!resources.length) return null;

  const norm = (s: string) =>
    s.toLowerCase().replace(/\b(and|the|of|n|&)\b/g, '').replace(/[^a-z0-9]/g, '');

  const target = norm(targetName);

  const match = resources.find((r) => {
    const n = norm(getString(r.name));
    return n.includes(target) || target.includes(n);
  });

  if (!match) {
    Sentry.addBreadcrumb({
      category: 'verify-bing',
      message: `No name match found for "${targetName}", falling back to first result`,
      level: 'info',
    });
  }

  return match ?? resources[0];
}

/**
 * Assemble a readable address from Bing's Address object.
 * Bing returns: { addressLine, locality, adminDistrict, postalCode, countryRegion }
 */
export function formatBingAddress(addr: Record<string, string> | undefined | null): string {
  if (!addr) return '';
  return [addr.addressLine, addr.locality, addr.adminDistrict, addr.postalCode]
    .filter(Boolean)
    .join(', ');
}

async function upsertVerification(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  locationId: string,
  result: VerificationResult,
): Promise<void> {
  await supabase.from('location_integrations').upsert(
    {
      org_id: orgId,
      location_id: locationId,
      platform: 'bing',
      verified_at: result.verifiedAt,
      verification_result: result as unknown as Record<string, unknown>,
      has_discrepancy: result.discrepancies.length > 0,
    },
    { onConflict: 'location_id,platform' },
  );
}
