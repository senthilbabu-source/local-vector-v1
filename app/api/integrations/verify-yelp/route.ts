// ---------------------------------------------------------------------------
// app/api/integrations/verify-yelp/route.ts — Sprint L (C2 Phase 2)
//
// POST endpoint that looks up a business on Yelp by phone number and compares
// the result against the org's verified location data.
//
// Auth: getSafeAuthContext() — org_id derived server-side (AI_RULES §4).
// Rate limit: 1 call per (location_id, 'yelp') per 24 hours.
// External: Yelp Fusion API v3 (read-only).
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { detectDiscrepancies, type VerificationResult } from '@/lib/integrations/detect-discrepancies';
import * as Sentry from '@sentry/nextjs';

const YELP_API_BASE = 'https://api.yelp.com/v3';
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
      tags: { route: 'verify-yelp', action: 'parse-body', sprint: 'L' },
    });
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const locationId = body.locationId?.trim() ?? '';
  if (!locationId) {
    return NextResponse.json({ error: 'locationId is required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    // ── Fetch location data (phone, address, business name) ──────────────
    const { data: location, error: locError } = await supabase
      .from('locations')
      .select('id, business_name, address_line1, city, state, zip, phone')
      .eq('id', locationId)
      .eq('org_id', ctx.orgId)
      .single();

    if (locError || !location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    if (!location.phone) {
      return NextResponse.json(
        { error: 'No phone number configured for this location' },
        { status: 400 },
      );
    }

    // ── Rate-limit check: was this verified in the last 24 hours? ────────
    const { data: existingRow } = await supabase
      .from('location_integrations')
      .select('verified_at, verification_result')
      .eq('location_id', locationId)
      .eq('platform', 'yelp')
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

    // ── Yelp API key check ────────────────────────────────────────────────
    const yelpApiKey = process.env.YELP_API_KEY;
    if (!yelpApiKey) {
      Sentry.captureException(new Error('YELP_API_KEY not configured'), {
        tags: { component: 'verify-yelp', sprint: 'L' },
      });
      return NextResponse.json({ error: 'Yelp API not configured' }, { status: 503 });
    }

    // ── Normalize phone to E.164 format for Yelp ─────────────────────────
    const digits = location.phone.replace(/\D/g, '');
    const e164Phone = digits.startsWith('1') ? `+${digits}` : `+1${digits}`;

    // ── Call Yelp Fusion API ──────────────────────────────────────────────
    const yelpResponse = await fetch(
      `${YELP_API_BASE}/businesses/search/phone?phone=${encodeURIComponent(e164Phone)}`,
      {
        headers: {
          Authorization: `Bearer ${yelpApiKey}`,
          Accept: 'application/json',
        },
      },
    );

    if (!yelpResponse.ok) {
      const errorBody = await yelpResponse.text();
      Sentry.captureException(new Error(`Yelp API error: ${yelpResponse.status}`), {
        tags: { component: 'verify-yelp', sprint: 'L' },
        extra: { status: yelpResponse.status, body: errorBody },
      });
      return NextResponse.json({ error: 'Yelp API request failed' }, { status: 502 });
    }

    const yelpData = await yelpResponse.json();
    const business = yelpData.businesses?.[0];

    if (!business) {
      // No match found on Yelp
      const result: VerificationResult = {
        found: false,
        discrepancies: [],
        verifiedAt: new Date().toISOString(),
      };

      await upsertVerification(supabase, ctx.orgId, locationId, result);
      return NextResponse.json({ cached: false, result });
    }

    // ── Compare Yelp data against local location data ────────────────────
    const yelpAddress = formatYelpAddress(business.location);
    const discrepancies = detectDiscrepancies(
      {
        name: business.name,
        address: yelpAddress,
        phone: business.phone ?? '',
      },
      location,
    );

    const result: VerificationResult = {
      found: true,
      platformName: business.name,
      platformAddress: yelpAddress,
      platformPhone: business.phone ?? undefined,
      platformUrl: business.url ?? undefined,
      platformRating: business.rating ?? undefined,
      platformReviewCount: business.review_count ?? undefined,
      discrepancies,
      verifiedAt: new Date().toISOString(),
    };

    await upsertVerification(supabase, ctx.orgId, locationId, result);
    return NextResponse.json({ cached: false, result });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'verify-yelp', sprint: 'L' },
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatYelpAddress(loc: {
  address1?: string;
  city?: string;
  state?: string;
  zip_code?: string;
}): string {
  return [loc.address1, loc.city, loc.state, loc.zip_code].filter(Boolean).join(', ');
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
      platform: 'yelp',
      verified_at: result.verifiedAt,
      verification_result: result as unknown as Record<string, unknown>,
      has_discrepancy: result.discrepancies.length > 0,
    },
    { onConflict: 'location_id,platform' },
  );
}
