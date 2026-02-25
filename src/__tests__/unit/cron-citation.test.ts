// ---------------------------------------------------------------------------
// cron-citation.test.ts — Unit tests for GET /api/cron/citation
//
// Strategy (mirrors cron-sov.test.ts):
//   • The citation engine service is mocked completely — no real Perplexity
//     calls, no MSW needed.
//   • The Supabase service-role client is mocked.
//   • Per-category+metro resilience is tested.
//
// Run:
//   npx vitest run src/__tests__/unit/cron-citation.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mock the citation engine service ─────────────────────────────────────
// Constants are re-exported as-is; functions are mocked.
vi.mock('@/lib/services/citation-engine.service', () => ({
  TRACKED_CATEGORIES: [
    'hookah lounge', 'restaurant', 'bar', 'lounge', 'event venue',
    'nightclub', 'coffee shop', 'cocktail bar', 'sports bar',
  ],
  TRACKED_METROS: [
    { city: 'Atlanta', state: 'GA' },
    { city: 'Dallas', state: 'TX' },
    { city: 'Houston', state: 'TX' },
    { city: 'Chicago', state: 'IL' },
    { city: 'Miami', state: 'FL' },
    { city: 'Los Angeles', state: 'CA' },
    { city: 'New York', state: 'NY' },
    { city: 'Phoenix', state: 'AZ' },
    { city: 'Las Vegas', state: 'NV' },
    { city: 'Denver', state: 'CO' },
    { city: 'Nashville', state: 'TN' },
    { city: 'Austin', state: 'TX' },
    { city: 'Seattle', state: 'WA' },
    { city: 'Boston', state: 'MA' },
    { city: 'Philadelphia', state: 'PA' },
    { city: 'San Francisco', state: 'CA' },
    { city: 'Orlando', state: 'FL' },
    { city: 'San Diego', state: 'CA' },
    { city: 'Portland', state: 'OR' },
    { city: 'Charlotte', state: 'NC' },
  ],
  runCitationSample: vi.fn().mockResolvedValue({
    platformCounts: { yelp: 4, tripadvisor: 2, google: 5 },
    successfulQueries: 5,
    sampleQuery: 'best hookah lounge in Atlanta GA',
  }),
  writeCitationResults: vi.fn().mockResolvedValue(3),
  sleep: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock the Supabase service-role client ────────────────────────────────
vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn().mockReturnValue({
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  }),
}));

// ── Import handler and mocks after vi.mock declarations ──────────────────
import { GET } from '@/app/api/cron/citation/route';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  runCitationSample,
  writeCitationResults,
  TRACKED_CATEGORIES,
  TRACKED_METROS,
} from '@/lib/services/citation-engine.service';

// ── Constants ────────────────────────────────────────────────────────────

const CRON_SECRET = 'test-cron-secret-citation';
const TOTAL_COMBINATIONS = TRACKED_CATEGORIES.length * TRACKED_METROS.length; // 9 × 20 = 180

// ── Helpers ──────────────────────────────────────────────────────────────

function makeRequest(secret?: string): NextRequest {
  const headers = new Headers();
  if (secret) headers.set('Authorization', `Bearer ${secret}`);
  return new NextRequest('http://localhost:3000/api/cron/citation', { headers });
}

// ── Setup / Teardown ─────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CRON_SECRET', CRON_SECRET);
  vi.stubEnv('PERPLEXITY_API_KEY', 'test-key');
  delete process.env.STOP_CITATION_CRON;

  // Re-set default mock implementations (cleared by vi.clearAllMocks)
  vi.mocked(runCitationSample).mockResolvedValue({
    platformCounts: { yelp: 4, tripadvisor: 2, google: 5 },
    successfulQueries: 5,
    sampleQuery: 'best hookah lounge in Atlanta GA',
  });
  vi.mocked(writeCitationResults).mockResolvedValue(3);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('GET /api/cron/citation', () => {
  it('returns 401 when no Authorization header is present', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when Authorization header has wrong secret', async () => {
    const res = await GET(makeRequest('wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with halted flag when STOP_CITATION_CRON is set', async () => {
    vi.stubEnv('STOP_CITATION_CRON', 'true');
    const res = await GET(makeRequest(CRON_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.halted).toBe(true);
  });

  it('calls createServiceRoleClient for database access', async () => {
    await GET(makeRequest(CRON_SECRET));
    expect(vi.mocked(createServiceRoleClient)).toHaveBeenCalled();
  });

  it('processes all category+metro combinations', async () => {
    const res = await GET(makeRequest(CRON_SECRET));
    expect(res.status).toBe(200);

    expect(vi.mocked(runCitationSample)).toHaveBeenCalledTimes(TOTAL_COMBINATIONS);
  });

  it('calls writeCitationResults for each category+metro with results', async () => {
    await GET(makeRequest(CRON_SECRET));

    expect(vi.mocked(writeCitationResults)).toHaveBeenCalledTimes(TOTAL_COMBINATIONS);
  });

  it('returns summary with correct categories and metros count', async () => {
    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.categories_processed).toBe(TRACKED_CATEGORIES.length);
    expect(body.metros_processed).toBe(TRACKED_METROS.length);
  });

  it('accumulates queries_run across all combinations', async () => {
    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();

    // 9 categories × 20 metros × 5 successful queries each = 900
    expect(body.queries_run).toBe(TOTAL_COMBINATIONS * 5);
  });

  it('accumulates platforms_found across all combinations', async () => {
    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();

    // Each combination writes 3 platforms (mocked return value)
    expect(body.platforms_found).toBe(TOTAL_COMBINATIONS * 3);
  });

  it('continues when a single category+metro combination throws', async () => {
    // First call throws, rest succeed
    vi.mocked(runCitationSample).mockRejectedValueOnce(
      new Error('Perplexity rate limit'),
    );

    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.errors).toBe(1);

    // Total - 1 failed = rest succeeded
    expect(vi.mocked(writeCitationResults)).toHaveBeenCalledTimes(TOTAL_COMBINATIONS - 1);
  });

  it('passes correct arguments to runCitationSample', async () => {
    await GET(makeRequest(CRON_SECRET));

    // Verify first call has correct category and metro
    expect(vi.mocked(runCitationSample)).toHaveBeenCalledWith(
      'hookah lounge',
      'Atlanta',
      'GA',
    );
  });

  it('passes supabase client to writeCitationResults', async () => {
    await GET(makeRequest(CRON_SECRET));

    expect(vi.mocked(writeCitationResults)).toHaveBeenCalledWith(
      expect.any(String), // category
      expect.any(String), // city
      expect.any(String), // state
      expect.any(Object), // platformCounts
      expect.any(Number), // successfulQueries
      expect.any(String), // sampleQuery
      expect.anything(),  // supabase client
    );
  });

  it('skips writeCitationResults when successfulQueries is 0', async () => {
    vi.mocked(runCitationSample).mockResolvedValue({
      platformCounts: {},
      successfulQueries: 0,
      sampleQuery: null,
    });

    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(vi.mocked(writeCitationResults)).not.toHaveBeenCalled();
  });
});
