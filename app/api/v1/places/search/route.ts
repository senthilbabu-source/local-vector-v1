// ---------------------------------------------------------------------------
// GET /api/v1/places/search?q=<query>
//
// Server-side proxy to the Google Places Text Search API. Keeps
// GOOGLE_PLACES_API_KEY on the server — never exposed to the browser.
//
// Security:
//   • Requires a valid Supabase session (cookie-based) — 401 otherwise.
//   • Only authenticated dashboard users can trigger Places lookups.
//
// Resilience:
//   • Missing GOOGLE_PLACES_API_KEY → { suggestions: [] } (graceful degradation)
//   • Google non-200 or network error  → { suggestions: [] }
//   • Query shorter than 3 chars       → { suggestions: [] }
//
// Response:
//   { suggestions: Array<{ name: string; address: string }> }  (max 5)
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type PlacesSuggestion = {
  name:    string;
  address: string;
};

type GooglePlacesResult = {
  name:              string;
  formatted_address: string;
};

type GooglePlacesResponse = {
  results: GooglePlacesResult[];
  status:  string;
};

const empty = () => NextResponse.json({ suggestions: [] });

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ── 1. Auth guard ──────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. Query validation ────────────────────────────────────────────────
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';

  if (q.length < 3) {
    return empty();
  }

  // ── 3. API key guard ───────────────────────────────────────────────────
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    return empty();
  }

  // ── 4. Proxy to Google Places Text Search ─────────────────────────────
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    url.searchParams.set('query', q);
    url.searchParams.set('type', 'establishment');
    url.searchParams.set('key', apiKey);

    const res = await fetch(url.toString());

    if (!res.ok) {
      console.warn(`[places-search] Google Places returned ${res.status}`);
      return empty();
    }

    const data = (await res.json()) as GooglePlacesResponse;
    const suggestions: PlacesSuggestion[] = (data.results ?? [])
      .slice(0, 5)
      .map((r) => ({
        name:    r.name,
        address: r.formatted_address,
      }));

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error('[places-search] Fetch error:', err);
    return empty();
  }
}
