// ---------------------------------------------------------------------------
// GET /api/public/places/search?q=<query>
//
// Public (unauthenticated) proxy to the Google Places Text Search API.
// Keeps GOOGLE_PLACES_API_KEY server-side — never exposed to the browser.
//
// Used by ViralScanner on the public marketing landing page (/).
// Dashboard users continue to use the authenticated /api/v1/places/search.
//
// Security (AI_RULES §22: public endpoint pattern):
//   • No auth required — intentionally public.
//   • IP-based rate limiting: 20 searches / IP / hour via Vercel KV.
//   • Rate limit exceeded → HTTP 429 { error: '...' }.
//   • KV absent (dev / CI) → rate limit bypassed silently.
//   • KV failure → try/catch absorbs; scan continues (AI_RULES §17).
//
// Resilience:
//   • Missing GOOGLE_PLACES_API_KEY → { suggestions: [] }
//   • Google non-200 or network error  → { suggestions: [] }
//   • Query shorter than 3 chars       → { suggestions: [] }
//
// Response:
//   { suggestions: Array<{ name: string; address: string }> }  (max 5)
// ---------------------------------------------------------------------------

import { headers } from 'next/headers';
import { getRedis } from '@/lib/redis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Rate limiting — 20 searches per IP per hour
// ---------------------------------------------------------------------------

const RATE_LIMIT_MAX    = 20;
const RATE_LIMIT_WINDOW = 3600; // seconds (1 hour)

async function checkRateLimit(
  ip: string
): Promise<{ allowed: boolean }> {
  if (!process.env.KV_REST_API_URL) return { allowed: true };

  try {
    const key   = `ratelimit:places:${ip}`;
    const count = await getRedis().incr(key);
    if (count === 1) await getRedis().expire(key, RATE_LIMIT_WINDOW);
    return { allowed: count <= RATE_LIMIT_MAX };
  } catch {
    // KV unreachable — allow the search (AI_RULES §17)
    return { allowed: true };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const empty = () => Response.json({ suggestions: [] });

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(request: Request): Promise<Response> {
  // ── 1. IP rate limiting ────────────────────────────────────────────────
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { allowed } = await checkRateLimit(ip);

  if (!allowed) {
    return Response.json(
      { error: 'Too many searches. Try again later.' },
      { status: 429 }
    );
  }

  // ── 2. Query validation ────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';

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
      console.warn(`[public-places-search] Google Places returned ${res.status}`);
      return empty();
    }

    const data = (await res.json()) as GooglePlacesResponse;
    const suggestions: PlacesSuggestion[] = (data.results ?? [])
      .slice(0, 5)
      .map((r) => ({
        name:    r.name,
        address: r.formatted_address,
      }));

    return Response.json({ suggestions });
  } catch (err) {
    console.error('[public-places-search] Fetch error:', err);
    return empty();
  }
}
