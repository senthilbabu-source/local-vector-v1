// @vitest-environment node
/**
 * Distribution GBP Food Menus — Unit Tests (Sprint 2: GBP Food Menus Push)
 *
 * Tests for:
 * - gbp-menu-mapper: category grouping, price parsing, missing fields, empty menu
 * - gbp-menu-client: MSW-style mock for GBP API, token refresh on 401, network failure, Sentry
 * - gbp-engine: adapter registration, skip when no GBP integration, success/error paths
 *
 * 25 tests total.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MenuExtractedItem } from '@/lib/types/menu';
import type { DistributionContext } from '@/lib/distribution/distribution-types';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ITEMS: MenuExtractedItem[] = [
  { id: 'i1', name: 'Chicken 65', price: '$14.99', category: 'Appetizers', confidence: 0.95, description: 'Spicy fried chicken' },
  { id: 'i2', name: 'Lamb Biryani', price: '$18.99', category: 'Mains', confidence: 0.88 },
  { id: 'i3', name: 'Garlic Naan', price: '$3.50', category: 'Appetizers', confidence: 0.92 },
  { id: 'i4', name: 'Mango Lassi', price: '$5.00', category: 'Beverages', confidence: 0.9 },
  { id: 'i5', name: 'Chef Special', category: 'Mains', confidence: 0.7 }, // no price, no description
];

// ============================================================================
// Part 1: gbp-menu-mapper (10 tests)
// ============================================================================

describe('gbp-menu-mapper', () => {
  describe('parsePriceToMoney', () => {
    it('parses "$12.50" → units=12, nanos=500000000', async () => {
      const { parsePriceToMoney } = await import('@/lib/gbp/gbp-menu-mapper');
      const result = parsePriceToMoney('$12.50');
      expect(result).toEqual({ currencyCode: 'USD', units: '12', nanos: 500000000 });
    });

    it('parses "$8" → units=8, nanos=0', async () => {
      const { parsePriceToMoney } = await import('@/lib/gbp/gbp-menu-mapper');
      const result = parsePriceToMoney('$8');
      expect(result).toEqual({ currencyCode: 'USD', units: '8', nanos: 0 });
    });

    it('parses "14.99" without dollar sign', async () => {
      const { parsePriceToMoney } = await import('@/lib/gbp/gbp-menu-mapper');
      const result = parsePriceToMoney('14.99');
      expect(result).toEqual({ currencyCode: 'USD', units: '14', nanos: 990000000 });
    });

    it('parses "$1,200.75" with comma', async () => {
      const { parsePriceToMoney } = await import('@/lib/gbp/gbp-menu-mapper');
      const result = parsePriceToMoney('$1,200.75');
      expect(result).toEqual({ currencyCode: 'USD', units: '1200', nanos: 750000000 });
    });

    it('returns undefined for undefined/empty price', async () => {
      const { parsePriceToMoney } = await import('@/lib/gbp/gbp-menu-mapper');
      expect(parsePriceToMoney(undefined)).toBeUndefined();
      expect(parsePriceToMoney('')).toBeUndefined();
    });

    it('returns undefined for non-numeric price', async () => {
      const { parsePriceToMoney } = await import('@/lib/gbp/gbp-menu-mapper');
      expect(parsePriceToMoney('Market Price')).toBeUndefined();
    });

    it('supports custom currency code', async () => {
      const { parsePriceToMoney } = await import('@/lib/gbp/gbp-menu-mapper');
      const result = parsePriceToMoney('€10.00', 'EUR');
      expect(result?.currencyCode).toBe('EUR');
    });
  });

  describe('mapMenuToGBPFoodMenu', () => {
    it('groups items by category into sections', async () => {
      const { mapMenuToGBPFoodMenu } = await import('@/lib/gbp/gbp-menu-mapper');
      const result = mapMenuToGBPFoodMenu(ITEMS);
      const sections = result.menus[0].sections;

      expect(sections).toHaveLength(3); // Appetizers, Beverages, Mains (alphabetical)
      expect(sections[0].name).toBe('Appetizers');
      expect(sections[0].items).toHaveLength(2); // Chicken 65 + Garlic Naan
      expect(sections[1].name).toBe('Beverages');
      expect(sections[2].name).toBe('Mains');
    });

    it('maps price strings to GBPMoneyAmount', async () => {
      const { mapMenuToGBPFoodMenu } = await import('@/lib/gbp/gbp-menu-mapper');
      const result = mapMenuToGBPFoodMenu(ITEMS);
      const appetizers = result.menus[0].sections[0];
      const chicken = appetizers.items.find((i) => i.name === 'Chicken 65');
      expect(chicken?.price).toEqual({ currencyCode: 'USD', units: '14', nanos: 990000000 });
    });

    it('includes description when present, omits when missing', async () => {
      const { mapMenuToGBPFoodMenu } = await import('@/lib/gbp/gbp-menu-mapper');
      const result = mapMenuToGBPFoodMenu(ITEMS);
      const appetizers = result.menus[0].sections[0];
      const chicken = appetizers.items.find((i) => i.name === 'Chicken 65');
      expect(chicken?.description).toBe('Spicy fried chicken');

      const mains = result.menus[0].sections[2];
      const chefSpecial = mains.items.find((i) => i.name === 'Chef Special');
      expect(chefSpecial?.description).toBeUndefined();
    });

    it('omits price field when item has no price', async () => {
      const { mapMenuToGBPFoodMenu } = await import('@/lib/gbp/gbp-menu-mapper');
      const result = mapMenuToGBPFoodMenu(ITEMS);
      const mains = result.menus[0].sections[2];
      const chefSpecial = mains.items.find((i) => i.name === 'Chef Special');
      expect(chefSpecial?.price).toBeUndefined();
    });

    it('returns empty sections array for empty items list', async () => {
      const { mapMenuToGBPFoodMenu } = await import('@/lib/gbp/gbp-menu-mapper');
      const result = mapMenuToGBPFoodMenu([]);
      expect(result.menus[0].menuName).toBe('Full Menu');
      expect(result.menus[0].sections).toEqual([]);
    });
  });
});

// ============================================================================
// Part 2: gbp-menu-client (8 tests)
// ============================================================================

describe('gbp-menu-client', () => {
  const mockFetch = vi.fn();
  const ORG_ID = 'org-test-123';
  const LOCATION_GBP_ID = 'accounts/123/locations/456';
  const MENU = { menus: [{ menuName: 'Full Menu', sections: [] }] };

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
  });

  function setupMocks(tokenRow: Record<string, unknown> | null = null, tokenError: unknown = null) {
    const mockSingle = vi.fn().mockResolvedValue({ data: tokenRow, error: tokenError });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

    vi.doMock('@/lib/supabase/server', () => ({
      createServiceRoleClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ select: mockSelect }),
      }),
    }));

    vi.doMock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
  }

  function setupTokenRefreshMock(success = true) {
    vi.doMock('@/lib/services/gbp-token-refresh', () => ({
      isTokenExpired: vi.fn().mockReturnValue(false),
      refreshGBPAccessToken: vi.fn().mockResolvedValue(
        success
          ? { orgId: ORG_ID, success: true, newAccessToken: 'refreshed-token' }
          : { orgId: ORG_ID, success: false, error: 'Refresh failed' },
      ),
    }));
  }

  it('returns error when org has no GBP token', async () => {
    setupMocks(null, { message: 'not found' });
    setupTokenRefreshMock();
    const { pushMenuToGBP } = await import('@/lib/gbp/gbp-menu-client');
    const result = await pushMenuToGBP(ORG_ID, LOCATION_GBP_ID, MENU);
    expect(result.success).toBe(false);
    expect(result.error).toContain('GBP not connected');
  });

  it('calls PATCH foodMenus with correct URL and auth header', async () => {
    setupMocks({
      access_token: 'valid-token',
      refresh_token: 'refresh-tok',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });
    setupTokenRefreshMock();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const { pushMenuToGBP } = await import('@/lib/gbp/gbp-menu-client');
    await pushMenuToGBP(ORG_ID, LOCATION_GBP_ID, MENU);

    expect(mockFetch).toHaveBeenCalledWith(
      `https://mybusiness.googleapis.com/v4/${LOCATION_GBP_ID}/foodMenus`,
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          Authorization: 'Bearer valid-token',
        }),
      }),
    );
  });

  it('returns success on 200 response', async () => {
    setupMocks({
      access_token: 'valid-token',
      refresh_token: 'refresh-tok',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });
    setupTokenRefreshMock();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const { pushMenuToGBP } = await import('@/lib/gbp/gbp-menu-client');
    const result = await pushMenuToGBP(ORG_ID, LOCATION_GBP_ID, MENU);
    expect(result.success).toBe(true);
  });

  it('refreshes token on 401 and retries', async () => {
    setupMocks({
      access_token: 'expired-token',
      refresh_token: 'refresh-tok',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });
    vi.doMock('@/lib/services/gbp-token-refresh', () => ({
      isTokenExpired: vi.fn().mockReturnValue(false),
      refreshGBPAccessToken: vi.fn().mockResolvedValue({
        orgId: ORG_ID,
        success: true,
        newAccessToken: 'refreshed-token',
      }),
    }));

    // First call: 401; second call (retry): 200
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const { pushMenuToGBP } = await import('@/lib/gbp/gbp-menu-client');
    const result = await pushMenuToGBP(ORG_ID, LOCATION_GBP_ID, MENU);
    expect(result.success).toBe(true);

    // At least 2 PATCH calls: first → 401, retry → 200
    expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);

    // Last call should use refreshed token
    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    expect(lastCall[1].headers.Authorization).toBe('Bearer refreshed-token');
  });

  it('returns error when 401 retry refresh fails', async () => {
    setupMocks({
      access_token: 'expired-token',
      refresh_token: 'refresh-tok',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });
    vi.doMock('@/lib/services/gbp-token-refresh', () => ({
      isTokenExpired: vi.fn().mockReturnValue(false),
      refreshGBPAccessToken: vi.fn().mockResolvedValue({
        orgId: ORG_ID,
        success: false,
        error: 'Refresh failed',
      }),
    }));

    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    const { pushMenuToGBP } = await import('@/lib/gbp/gbp-menu-client');
    const result = await pushMenuToGBP(ORG_ID, LOCATION_GBP_ID, MENU);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Refresh failed');
  });

  it('returns error with status on non-200/401 response', async () => {
    setupMocks({
      access_token: 'valid-token',
      refresh_token: 'refresh-tok',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });
    setupTokenRefreshMock();
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Internal Server Error'),
    });

    const { pushMenuToGBP } = await import('@/lib/gbp/gbp-menu-client');
    const result = await pushMenuToGBP(ORG_ID, LOCATION_GBP_ID, MENU);
    expect(result.success).toBe(false);
    expect(result.error).toContain('500');
  });

  it('catches network errors and reports to Sentry', async () => {
    setupMocks({
      access_token: 'valid-token',
      refresh_token: 'refresh-tok',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });
    setupTokenRefreshMock();
    mockFetch.mockRejectedValue(new Error('Network failure'));

    const Sentry = await import('@sentry/nextjs');
    const { pushMenuToGBP } = await import('@/lib/gbp/gbp-menu-client');
    const result = await pushMenuToGBP(ORG_ID, LOCATION_GBP_ID, MENU);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network failure');
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it('refreshes expired token before making API call', async () => {
    setupMocks({
      access_token: 'expired-token',
      refresh_token: 'refresh-tok',
      expires_at: new Date(Date.now() - 1000).toISOString(), // expired
    });
    vi.doMock('@/lib/services/gbp-token-refresh', () => ({
      isTokenExpired: vi.fn().mockReturnValue(true), // token is expired
      refreshGBPAccessToken: vi.fn().mockResolvedValue({
        orgId: ORG_ID,
        success: true,
        newAccessToken: 'fresh-token',
      }),
    }));
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const { pushMenuToGBP } = await import('@/lib/gbp/gbp-menu-client');
    await pushMenuToGBP(ORG_ID, LOCATION_GBP_ID, MENU);

    // The PATCH call should use the refreshed token
    const patchCalls = mockFetch.mock.calls.filter(
      (c: any[]) => c[1]?.method === 'PATCH',
    );
    expect(patchCalls.length).toBeGreaterThanOrEqual(1);
    expect(patchCalls[0][1].headers.Authorization).toBe('Bearer fresh-token');
  });
});

// ============================================================================
// Part 3: gbp-engine adapter (7 tests)
// ============================================================================

describe('gbp-engine adapter', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  function buildCtx(overrides: Partial<DistributionContext> = {}): DistributionContext {
    const mockSingle = vi.fn();
    const mockLimit = vi.fn().mockReturnValue({ single: mockSingle });
    const mockNot = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle, not: mockNot });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

    return {
      menuId: 'menu-1',
      orgId: 'org-1',
      publicSlug: 'charcoal-n-chill',
      appUrl: 'https://app.localvector.ai',
      items: ITEMS,
      supabase: {
        from: vi.fn().mockReturnValue({ select: mockSelect }),
      } as any,
      ...overrides,
    };
  }

  it('has name "gbp"', async () => {
    vi.doMock('@/lib/gbp/gbp-menu-mapper', () => ({ mapMenuToGBPFoodMenu: vi.fn() }));
    vi.doMock('@/lib/gbp/gbp-menu-client', () => ({ pushMenuToGBP: vi.fn() }));
    vi.doMock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
    const { gbpEngine } = await import('@/lib/distribution/engines/gbp-engine');
    expect(gbpEngine.name).toBe('gbp');
  });

  it('skips when org has no google_oauth_tokens row', async () => {
    vi.doMock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
    vi.doMock('@/lib/gbp/gbp-menu-mapper', () => ({ mapMenuToGBPFoodMenu: vi.fn() }));
    vi.doMock('@/lib/gbp/gbp-menu-client', () => ({ pushMenuToGBP: vi.fn() }));

    // Build ctx where token lookup returns null
    const mockTokenSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockTokenEq = vi.fn().mockReturnValue({ single: mockTokenSingle });
    const mockTokenSelect = vi.fn().mockReturnValue({ eq: mockTokenEq });

    const ctx = buildCtx({
      supabase: {
        from: vi.fn().mockReturnValue({ select: mockTokenSelect }),
      } as any,
    });

    const { gbpEngine } = await import('@/lib/distribution/engines/gbp-engine');
    const result = await gbpEngine.distribute(ctx);
    expect(result.status).toBe('skipped');
    expect(result.message).toContain('No GBP integration');
  });

  it('skips when location has no google_location_name', async () => {
    vi.doMock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
    vi.doMock('@/lib/gbp/gbp-menu-mapper', () => ({ mapMenuToGBPFoodMenu: vi.fn() }));
    vi.doMock('@/lib/gbp/gbp-menu-client', () => ({ pushMenuToGBP: vi.fn() }));

    // Token exists, but location has no google_location_name
    let callCount = 0;
    const ctx = buildCtx({
      supabase: {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'google_oauth_tokens') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: 'tok-1' }, error: null }),
                }),
              }),
            };
          }
          // locations table — no google_location_name
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          };
        }),
      } as any,
    });

    const { gbpEngine } = await import('@/lib/distribution/engines/gbp-engine');
    const result = await gbpEngine.distribute(ctx);
    expect(result.status).toBe('skipped');
  });

  it('returns success when push succeeds', async () => {
    vi.doMock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
    vi.doMock('@/lib/gbp/gbp-menu-mapper', () => ({
      mapMenuToGBPFoodMenu: vi.fn().mockReturnValue({ menus: [] }),
    }));
    vi.doMock('@/lib/gbp/gbp-menu-client', () => ({
      pushMenuToGBP: vi.fn().mockResolvedValue({ success: true }),
    }));

    const ctx = buildCtx({
      supabase: {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'google_oauth_tokens') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: 'tok-1' }, error: null }),
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { google_location_name: 'accounts/1/locations/2' },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }),
      } as any,
    });

    const { gbpEngine } = await import('@/lib/distribution/engines/gbp-engine');
    const result = await gbpEngine.distribute(ctx);
    expect(result.status).toBe('success');
    expect(result.engine).toBe('gbp');
  });

  it('returns error when push fails', async () => {
    vi.doMock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
    vi.doMock('@/lib/gbp/gbp-menu-mapper', () => ({
      mapMenuToGBPFoodMenu: vi.fn().mockReturnValue({ menus: [] }),
    }));
    vi.doMock('@/lib/gbp/gbp-menu-client', () => ({
      pushMenuToGBP: vi.fn().mockResolvedValue({ success: false, error: 'API quota exceeded' }),
    }));

    const ctx = buildCtx({
      supabase: {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'google_oauth_tokens') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: 'tok-1' }, error: null }),
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { google_location_name: 'accounts/1/locations/2' },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }),
      } as any,
    });

    const { gbpEngine } = await import('@/lib/distribution/engines/gbp-engine');
    const result = await gbpEngine.distribute(ctx);
    expect(result.status).toBe('error');
    expect(result.message).toContain('API quota exceeded');
  });

  it('never throws — catches and returns error result', async () => {
    vi.doMock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
    vi.doMock('@/lib/gbp/gbp-menu-mapper', () => ({
      mapMenuToGBPFoodMenu: vi.fn().mockImplementation(() => {
        throw new Error('Mapper exploded');
      }),
    }));
    vi.doMock('@/lib/gbp/gbp-menu-client', () => ({ pushMenuToGBP: vi.fn() }));

    const ctx = buildCtx({
      supabase: {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'google_oauth_tokens') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: 'tok-1' }, error: null }),
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { google_location_name: 'accounts/1/locations/2' },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }),
      } as any,
    });

    const { gbpEngine } = await import('@/lib/distribution/engines/gbp-engine');
    const result = await gbpEngine.distribute(ctx);
    expect(result.status).toBe('error');
    expect(result.message).toBe('Mapper exploded');
  });

  it('reports caught errors to Sentry', async () => {
    vi.doMock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
    vi.doMock('@/lib/gbp/gbp-menu-mapper', () => ({
      mapMenuToGBPFoodMenu: vi.fn().mockImplementation(() => {
        throw new Error('Unexpected');
      }),
    }));
    vi.doMock('@/lib/gbp/gbp-menu-client', () => ({ pushMenuToGBP: vi.fn() }));

    const ctx = buildCtx({
      supabase: {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'google_oauth_tokens') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: 'tok-1' }, error: null }),
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { google_location_name: 'accounts/1/locations/2' },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }),
      } as any,
    });

    const Sentry = await import('@sentry/nextjs');
    const { gbpEngine } = await import('@/lib/distribution/engines/gbp-engine');
    await gbpEngine.distribute(ctx);

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({ component: 'gbp-engine' }),
      }),
    );
  });
});
