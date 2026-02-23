// ---------------------------------------------------------------------------
// places-search.test.ts — Unit tests for GET /api/v1/places/search
//
// Strategy:
//   • Supabase client is mocked to control session state.
//   • global fetch is stubbed to control Google Places API responses.
//   • All 6 tests are pure unit tests — no network calls.
//
// Run:
//   npx vitest run src/__tests__/unit/places-search.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mock Supabase before any imports ──────────────────────────────────────
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// ── Import handler and mocks after vi.mock ────────────────────────────────
import { GET } from '@/app/api/v1/places/search/route';
import { createClient } from '@/lib/supabase/server';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeRequest(q?: string): NextRequest {
  const url = q
    ? `http://localhost/api/v1/places/search?q=${encodeURIComponent(q)}`
    : 'http://localhost/api/v1/places/search';
  return new NextRequest(url);
}

/** Mock Supabase to return an authenticated user. */
function mockAuthUser() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(createClient as any).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-uuid-001', email: 'dev@localvector.ai' } },
        error: null,
      }),
    },
  });
}

/** Mock Supabase to return no session. */
function mockNoAuth() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(createClient as any).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      }),
    },
  });
}

/** Build a minimal Google Places Text Search JSON response. */
function googleResponse(results: Array<{ name: string; formatted_address: string }>) {
  return {
    results,
    status: 'OK',
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/v1/places/search', () => {
  beforeEach(() => {
    mockAuthUser();
    process.env.GOOGLE_PLACES_API_KEY = 'test-places-api-key';
  });

  afterEach(() => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    vi.restoreAllMocks();
  });

  // ── Auth guard ────────────────────────────────────────────────────────

  it('returns 401 when no Supabase session', async () => {
    mockNoAuth();
    const res = await GET(makeRequest('Cloud 9 Lounge'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  // ── Query guards ──────────────────────────────────────────────────────

  it('returns empty suggestions when query is shorter than 3 characters', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await GET(makeRequest('Cl'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestions).toEqual([]);
    // Google Places must NOT be called for short queries
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // ── API key guard ─────────────────────────────────────────────────────

  it('returns empty suggestions when GOOGLE_PLACES_API_KEY is absent', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await GET(makeRequest('Cloud 9 Lounge'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestions).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // ── Success path ──────────────────────────────────────────────────────

  it('proxies to Google and returns up to 5 formatted suggestions', async () => {
    const rawResults = [
      { name: 'Cloud 9 Lounge',  formatted_address: '123 Main St, Alpharetta, GA 30005, USA' },
      { name: 'Cloud 9 Bar',     formatted_address: '456 Oak Ave, Atlanta, GA 30301, USA' },
      { name: 'Skybar Lounge',   formatted_address: '789 Peach Rd, Marietta, GA 30060, USA' },
      { name: 'Nine Clouds',     formatted_address: '101 Elm Blvd, Roswell, GA 30075, USA' },
      { name: 'Cloud Terrace',   formatted_address: '202 Pine St, Cumming, GA 30041, USA' },
      { name: 'Extra Result',    formatted_address: '303 Cedar Ln, Canton, GA 30114, USA' }, // 6th — must be dropped
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(googleResponse(rawResults)), { status: 200 })
    );

    const res = await GET(makeRequest('Cloud 9'));
    expect(res.status).toBe(200);
    const body = await res.json();

    // Only first 5 results returned
    expect(body.suggestions).toHaveLength(5);
    expect(body.suggestions[0]).toEqual({
      name:    'Cloud 9 Lounge',
      address: '123 Main St, Alpharetta, GA 30005, USA',
    });
    expect(body.suggestions[4].name).toBe('Cloud Terrace');
  });

  // ── Error handling ────────────────────────────────────────────────────

  it('returns empty suggestions when Google responds with non-200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Service Unavailable', { status: 503 })
    );

    const res = await GET(makeRequest('Cloud 9'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestions).toEqual([]);
  });

  it('returns empty suggestions when fetch throws a network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network failure'));

    const res = await GET(makeRequest('Cloud 9'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestions).toEqual([]);
  });
});
