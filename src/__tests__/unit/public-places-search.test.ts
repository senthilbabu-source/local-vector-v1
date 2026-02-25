// ---------------------------------------------------------------------------
// public-places-search.test.ts — Unit tests for GET /api/public/places/search
//
// Tests app/api/public/places/search/route.ts:
//   1. Returns suggestions array for valid query (≥3 chars)
//   2. Returns empty suggestions for query shorter than 3 chars (no Google call)
//   3. Returns empty suggestions when GOOGLE_PLACES_API_KEY absent
//   4. Returns empty suggestions when Google API returns non-200
//   5. Returns empty suggestions on network error (fetch throws)
//   6. Returns HTTP 429 { error } when IP has exceeded 20 searches/hour
//   7. Bypasses rate limit and returns suggestions when KV_REST_API_URL absent
//   8. Absorbs KV failure gracefully when kv.incr() throws
//
// Mocks: @/lib/redis, next/headers, global fetch — hoisted (AI_RULES §4).
//
// Run:
//   npx vitest run src/__tests__/unit/public-places-search.test.ts
// ---------------------------------------------------------------------------

// ── Hoist vi.mock declarations BEFORE any imports (AI_RULES §4) ───────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockRedis = {
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
};
vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(() => mockRedis),
}));
vi.mock('next/headers', () => ({ headers: vi.fn() }));

// ── Imports after mock declarations ──────────────────────────────────────

import { GET } from '@/app/api/public/places/search/route';
import { headers } from 'next/headers';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeRequest(q: string): Request {
  return new Request(`http://localhost/api/public/places/search?q=${encodeURIComponent(q)}`);
}

function mockHeaders(ip = '1.2.3.4') {
  vi.mocked(headers as ReturnType<typeof vi.fn>).mockResolvedValue({
    get: (name: string) => (name === 'x-forwarded-for' ? ip : null),
  });
}

/** Google Places API response shape */
function googlePayload(results: { name: string; formatted_address: string }[]) {
  return { results, status: 'OK' };
}

function mockGoogleOk(results: { name: string; formatted_address: string }[]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok:   true,
    json: async () => googlePayload(results),
  }));
}

function mockGoogleError(status = 500) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }));
}

// ── Setup / teardown ──────────────────────────────────────────────────────

beforeEach(() => {
  // KV absent by default — rate limit bypassed (dev/CI)
  delete process.env.KV_REST_API_URL;
  process.env.GOOGLE_PLACES_API_KEY = 'test-key-456';
  mockHeaders();
  // KV mocks: succeed by default (count = 1)
  mockRedis.incr.mockResolvedValue(1);
  mockRedis.expire.mockResolvedValue(1);
  mockRedis.ttl.mockResolvedValue(3600);
});

afterEach(() => {
  delete process.env.GOOGLE_PLACES_API_KEY;
  delete process.env.KV_REST_API_URL;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('GET /api/public/places/search', () => {

  it('returns suggestions array with name and address for valid query (≥3 chars)', async () => {
    mockGoogleOk([
      { name: 'Charcoal N Chill', formatted_address: '1234 Old Milton Pkwy, Alpharetta, GA' },
    ]);
    const res  = await GET(makeRequest('charcoal'));
    const body = await res.json() as { suggestions: { name: string; address: string }[] };
    expect(res.status).toBe(200);
    expect(body.suggestions).toHaveLength(1);
    expect(body.suggestions[0]).toEqual({
      name:    'Charcoal N Chill',
      address: '1234 Old Milton Pkwy, Alpharetta, GA',
    });
  });

  it('returns empty suggestions for query shorter than 3 chars without calling Google', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const res  = await GET(makeRequest('ab'));
    const body = await res.json() as { suggestions: unknown[] };
    expect(res.status).toBe(200);
    expect(body.suggestions).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns empty suggestions when GOOGLE_PLACES_API_KEY is absent', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const res  = await GET(makeRequest('charcoal'));
    const body = await res.json() as { suggestions: unknown[] };
    expect(res.status).toBe(200);
    expect(body.suggestions).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns empty suggestions when Google API returns non-200', async () => {
    mockGoogleError(503);
    const res  = await GET(makeRequest('charcoal'));
    const body = await res.json() as { suggestions: unknown[] };
    expect(res.status).toBe(200);
    expect(body.suggestions).toEqual([]);
  });

  it('returns empty suggestions on network error (fetch throws)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const res  = await GET(makeRequest('charcoal'));
    const body = await res.json() as { suggestions: unknown[] };
    expect(res.status).toBe(200);
    expect(body.suggestions).toEqual([]);
  });

  it('returns HTTP 429 with error message when IP has exceeded 20 searches/hour', async () => {
    process.env.KV_REST_API_URL = 'http://localhost:6379';
    mockRedis.incr.mockResolvedValue(21); // over limit
    const res  = await GET(makeRequest('charcoal'));
    const body = await res.json() as { error: string };
    expect(res.status).toBe(429);
    expect(body.error).toMatch(/too many/i);
  });

  it('bypasses rate limit and returns suggestions when KV_REST_API_URL is absent', async () => {
    delete process.env.KV_REST_API_URL;
    mockGoogleOk([{ name: 'Test Biz', formatted_address: '100 Main St, Atlanta, GA' }]);
    const res  = await GET(makeRequest('test'));
    const body = await res.json() as { suggestions: unknown[] };
    expect(res.status).toBe(200);
    expect(body.suggestions).toHaveLength(1);
    expect(mockRedis.incr).not.toHaveBeenCalled();
  });

  it('absorbs KV failure gracefully and returns suggestions when kv.incr() throws', async () => {
    process.env.KV_REST_API_URL = 'http://localhost:6379';
    mockRedis.incr.mockRejectedValue(new Error('KV down'));
    mockGoogleOk([{ name: 'Resilient Biz', formatted_address: '200 Oak Ave, Atlanta, GA' }]);
    const res  = await GET(makeRequest('resilient'));
    const body = await res.json() as { suggestions: unknown[] };
    // KV failure absorbed — search continues
    expect(res.status).toBe(200);
    expect(body.suggestions).toHaveLength(1);
  });

});
