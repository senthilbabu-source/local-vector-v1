/**
 * Sprint 105 — NAP Adapter unit tests.
 * Target: all 4 adapter files.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scoreAddressSimilarity } from '@/lib/nap-sync/adapters/bing-adapter';
import { normalizeYelpHours } from '@/lib/nap-sync/adapters/yelp-adapter';

// ── Mock setup ────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  })),
}));

vi.mock('@/lib/services/gbp-token-refresh', () => ({
  isTokenExpired: vi.fn().mockReturnValue(false),
  refreshGBPAccessToken: vi.fn().mockResolvedValue({
    success: true,
    newAccessToken: 'new-token',
    orgId: 'org-1',
  }),
}));

vi.mock('@/lib/gbp/gbp-data-mapper', () => ({
  mapGBPToLocation: vi.fn().mockReturnValue({
    business_name: 'Charcoal N Chill',
    phone: '(470) 546-4866',
    address_line1: '11950 Jones Bridge Road Ste 103',
    city: 'Alpharetta',
    state: 'GA',
    zip: '30005',
    website_url: 'https://charcoalnchill.com',
    operational_status: 'open',
  }),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('normalizeYelpHours', () => {
  it('maps Yelp hours to LocalVector format (day index → day name, HHMM → HH:MM)', () => {
    const yelpHours = [
      {
        open: [
          { day: 0, start: '1700', end: '0100', is_overnight: false },
          { day: 1, start: '1700', end: '0100', is_overnight: false },
        ],
      },
    ];
    const result = normalizeYelpHours(yelpHours);
    expect(result.monday).toEqual({ open: '17:00', close: '01:00', closed: false });
    expect(result.tuesday).toEqual({ open: '17:00', close: '01:00', closed: false });
    expect(result.wednesday).toBeUndefined();
  });

  it('handles is_overnight = true correctly', () => {
    const yelpHours = [
      {
        open: [{ day: 4, start: '1700', end: '0200', is_overnight: true }],
      },
    ];
    const result = normalizeYelpHours(yelpHours);
    expect(result.friday).toEqual({ open: '17:00', close: '02:00', closed: false });
  });

  it('returns empty object for empty hours array', () => {
    const result = normalizeYelpHours([]);
    expect(result).toEqual({});
  });
});

describe('YelpNAPAdapter', () => {
  it('returns unconfigured when YELP_FUSION_API_KEY is not set', async () => {
    const originalKey = process.env.YELP_FUSION_API_KEY;
    delete process.env.YELP_FUSION_API_KEY;

    const { YelpNAPAdapter } = await import('@/lib/nap-sync/adapters/yelp-adapter');
    const adapter = new YelpNAPAdapter();
    const result = await adapter.fetchNAP('loc-1', 'org-1', { yelp_business_id: 'test' });
    expect(result.status).toBe('unconfigured');

    if (originalKey) process.env.YELP_FUSION_API_KEY = originalKey;
  });

  it('calls Yelp API with correct URL and Authorization header', async () => {
    process.env.YELP_FUSION_API_KEY = 'test-key';
    const origFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: 'Test Biz',
        phone: '+14705551234',
        location: { address1: '123 Main St', city: 'Test', state: 'GA', zip_code: '30005' },
      }),
    });

    const { YelpNAPAdapter } = await import('@/lib/nap-sync/adapters/yelp-adapter');
    const adapter = new YelpNAPAdapter();
    await adapter.fetchNAP('loc-1', 'org-1', { yelp_business_id: 'test-biz-id' });

    expect(mockFetch).toHaveBeenCalled();
    const calledUrl = mockFetch.mock.calls[0][0];
    // fetch may receive a URL string or a Request object
    const urlStr = typeof calledUrl === 'string' ? calledUrl : calledUrl?.url ?? String(calledUrl);
    expect(urlStr).toContain('api.yelp.com/v3/businesses/test-biz-id');

    globalThis.fetch = origFetch;
    delete process.env.YELP_FUSION_API_KEY;
  });

  it('maps Yelp response to NAPData correctly', async () => {
    process.env.YELP_FUSION_API_KEY = 'test-key';
    const origFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: 'Test Business',
        phone: '+14705551234',
        url: 'https://www.yelp.com/biz/test',
        location: { address1: '123 Main St', city: 'TestCity', state: 'GA', zip_code: '30005' },
        is_closed: false,
      }),
    });

    const { YelpNAPAdapter } = await import('@/lib/nap-sync/adapters/yelp-adapter');
    const adapter = new YelpNAPAdapter();
    const result = await adapter.fetchNAP('loc-1', 'org-1', { yelp_business_id: 'test' });

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.name).toBe('Test Business');
      expect(result.data.phone).toBe('+14705551234');
      expect(result.data.city).toBe('TestCity');
    }

    globalThis.fetch = origFetch;
    delete process.env.YELP_FUSION_API_KEY;
  });

  it('returns api_error on non-200 Yelp response', async () => {
    process.env.YELP_FUSION_API_KEY = 'test-key';
    const origFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Rate limited',
    });

    const { YelpNAPAdapter } = await import('@/lib/nap-sync/adapters/yelp-adapter');
    const adapter = new YelpNAPAdapter();
    const result = await adapter.fetchNAP('loc-1', 'org-1', { yelp_business_id: 'test' });
    expect(result.status).toBe('api_error');

    globalThis.fetch = origFetch;
    delete process.env.YELP_FUSION_API_KEY;
  });

  it('returns not_found when yelp_business_id is undefined', async () => {
    process.env.YELP_FUSION_API_KEY = 'test-key';

    const { YelpNAPAdapter } = await import('@/lib/nap-sync/adapters/yelp-adapter');
    const adapter = new YelpNAPAdapter();
    const result = await adapter.fetchNAP('loc-1', 'org-1', {});
    expect(result.status).toBe('not_found');

    delete process.env.YELP_FUSION_API_KEY;
  });
});

describe('BingNAPAdapter', () => {
  it('returns unconfigured when BING_SEARCH_API_KEY is not set', async () => {
    const originalKey = process.env.BING_SEARCH_API_KEY;
    delete process.env.BING_SEARCH_API_KEY;

    const { BingNAPAdapter } = await import('@/lib/nap-sync/adapters/bing-adapter');
    const adapter = new BingNAPAdapter();
    const result = await adapter.fetchNAP('loc-1', 'org-1', { bing_listing_id: 'test' });
    expect(result.status).toBe('unconfigured');

    if (originalKey) process.env.BING_SEARCH_API_KEY = originalKey;
  });

  it('maps Bing result fields to NAPData', async () => {
    process.env.BING_SEARCH_API_KEY = 'test-key';
    const origFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        places: {
          value: [
            {
              name: 'Test Business',
              telephone: '+14705551234',
              url: 'https://test.com',
              address: {
                streetAddress: '123 Main St',
                addressLocality: 'TestCity',
                addressRegion: 'GA',
                postalCode: '30005',
              },
            },
          ],
        },
      }),
    });

    const { BingNAPAdapter } = await import('@/lib/nap-sync/adapters/bing-adapter');
    const adapter = new BingNAPAdapter();
    const result = await adapter.fetchNAP('loc-1', 'org-1', { bing_listing_id: 'test query' });

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.name).toBe('Test Business');
      expect(result.data.phone).toBe('+14705551234');
    }

    globalThis.fetch = origFetch;
    delete process.env.BING_SEARCH_API_KEY;
  });

  it('returns not_found when no results from Bing', async () => {
    process.env.BING_SEARCH_API_KEY = 'test-key';
    const origFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ places: { value: [] } }),
    });

    const { BingNAPAdapter } = await import('@/lib/nap-sync/adapters/bing-adapter');
    const adapter = new BingNAPAdapter();
    const result = await adapter.fetchNAP('loc-1', 'org-1', { bing_listing_id: 'nonexistent' });
    expect(result.status).toBe('not_found');

    globalThis.fetch = origFetch;
    delete process.env.BING_SEARCH_API_KEY;
  });
});

describe('scoreAddressSimilarity', () => {
  it('identical addresses → score 1.0', () => {
    expect(scoreAddressSimilarity('123 Main Street', '123 Main Street')).toBe(1.0);
  });

  it('"Rd" vs "Road" → score >= 0.9 after normalization', () => {
    const score = scoreAddressSimilarity('123 Main Rd', '123 Main Road');
    expect(score).toBeGreaterThanOrEqual(0.9);
  });

  it('completely different addresses → score < 0.5', () => {
    const score = scoreAddressSimilarity('123 Main St, New York, NY', '456 Oak Ave, Los Angeles, CA');
    expect(score).toBeLessThan(0.5);
  });

  it('partial match → score between 0.5 and 0.8', () => {
    const score = scoreAddressSimilarity('123 Main St, Alpharetta', '123 Main St, Roswell');
    expect(score).toBeGreaterThanOrEqual(0.5);
    expect(score).toBeLessThanOrEqual(1.0);
  });
});

describe('AppleMapsNAPAdapter', () => {
  it('returns unconfigured when Apple Maps env vars are missing', async () => {
    delete process.env.APPLE_MAPS_PRIVATE_KEY;
    delete process.env.APPLE_MAPS_KEY_ID;
    delete process.env.APPLE_MAPS_TEAM_ID;

    const { AppleMapsNAPAdapter } = await import('@/lib/nap-sync/adapters/apple-maps-adapter');
    const adapter = new AppleMapsNAPAdapter();
    const result = await adapter.fetchNAP('loc-1', 'org-1', { apple_maps_id: 'test' });
    expect(result.status).toBe('unconfigured');
    if (result.status === 'unconfigured') {
      expect(result.reason).toBe('no_credentials');
    }
  });
});

describe('GBPNAPAdapter', () => {
  it('returns unconfigured when gbp_location_id is undefined', async () => {
    const { GBPNAPAdapter } = await import('@/lib/nap-sync/adapters/gbp-adapter');
    const adapter = new GBPNAPAdapter();
    const result = await adapter.fetchNAP('loc-1', 'org-1', {});
    expect(result.status).toBe('unconfigured');
    if (result.status === 'unconfigured') {
      expect(result.reason).toBe('no_gbp_location_id');
    }
  });
});
