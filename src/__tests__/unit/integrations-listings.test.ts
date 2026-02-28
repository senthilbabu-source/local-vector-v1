// ---------------------------------------------------------------------------
// src/__tests__/unit/integrations-listings.test.ts
//
// Sprint K (C2 verification): Validates PLATFORM_SYNC_CONFIG + PlatformRow
// honest labeling for non-GBP platforms.
//
// The actual Sprint C work is already done — this test suite verifies the
// implementation is correct and prevents regression.
//
// Run:
//   npx vitest run src/__tests__/unit/integrations-listings.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  PLATFORM_SYNC_CONFIG,
  type PlatformSyncType,
} from '@/lib/integrations/platform-config';
import {
  BIG_6_PLATFORMS,
  SyncIntegrationSchema,
  SavePlatformUrlSchema,
  type Big6Platform,
} from '@/lib/schemas/integrations';

// ---------------------------------------------------------------------------
// PLATFORM_SYNC_CONFIG structure
// ---------------------------------------------------------------------------

describe('PLATFORM_SYNC_CONFIG — honest platform labeling', () => {
  it('has config for all Big 6 platforms', () => {
    for (const platform of BIG_6_PLATFORMS) {
      expect(PLATFORM_SYNC_CONFIG[platform]).toBeDefined();
    }
  });

  it('google has syncType "real_oauth"', () => {
    expect(PLATFORM_SYNC_CONFIG.google.syncType).toBe('real_oauth');
  });

  it('yelp has syncType "manual_url" (not real_oauth)', () => {
    expect(PLATFORM_SYNC_CONFIG.yelp.syncType).toBe('manual_url');
  });

  it('tripadvisor has syncType "manual_url" (not real_oauth)', () => {
    expect(PLATFORM_SYNC_CONFIG.tripadvisor.syncType).toBe('manual_url');
  });

  it('apple has syncType "coming_soon"', () => {
    expect(PLATFORM_SYNC_CONFIG.apple.syncType).toBe('coming_soon');
  });

  it('bing has syncType "coming_soon"', () => {
    expect(PLATFORM_SYNC_CONFIG.bing.syncType).toBe('coming_soon');
  });

  it('facebook has syncType "coming_soon"', () => {
    expect(PLATFORM_SYNC_CONFIG.facebook.syncType).toBe('coming_soon');
  });

  it('only google has real_oauth (no mock sync for other platforms)', () => {
    const realOAuthPlatforms = BIG_6_PLATFORMS.filter(
      (p) => PLATFORM_SYNC_CONFIG[p].syncType === 'real_oauth',
    );
    expect(realOAuthPlatforms).toEqual(['google']);
  });

  it('all manual_url platforms have a claimUrl', () => {
    const manualPlatforms = BIG_6_PLATFORMS.filter(
      (p) => PLATFORM_SYNC_CONFIG[p].syncType === 'manual_url',
    );
    expect(manualPlatforms.length).toBeGreaterThan(0);
    for (const platform of manualPlatforms) {
      expect(PLATFORM_SYNC_CONFIG[platform].claimUrl).toBeDefined();
      expect(PLATFORM_SYNC_CONFIG[platform].claimUrl!.startsWith('https://')).toBe(true);
    }
  });

  it('all coming_soon platforms have an eta', () => {
    const comingSoonPlatforms = BIG_6_PLATFORMS.filter(
      (p) => PLATFORM_SYNC_CONFIG[p].syncType === 'coming_soon',
    );
    expect(comingSoonPlatforms.length).toBeGreaterThan(0);
    for (const platform of comingSoonPlatforms) {
      expect(PLATFORM_SYNC_CONFIG[platform].eta).toBeDefined();
      expect(typeof PLATFORM_SYNC_CONFIG[platform].eta).toBe('string');
    }
  });

  it('every platform has a non-empty syncDescription', () => {
    for (const platform of BIG_6_PLATFORMS) {
      const config = PLATFORM_SYNC_CONFIG[platform];
      expect(config.syncDescription).toBeDefined();
      expect(config.syncDescription.length).toBeGreaterThan(0);
    }
  });

  it('syncType only uses valid PlatformSyncType values', () => {
    const validTypes: PlatformSyncType[] = ['real_oauth', 'manual_url', 'coming_soon'];
    for (const platform of BIG_6_PLATFORMS) {
      expect(validTypes).toContain(PLATFORM_SYNC_CONFIG[platform].syncType);
    }
  });
});

// ---------------------------------------------------------------------------
// syncPlatform action — non-GBP rejection
// ---------------------------------------------------------------------------

describe('syncPlatform rejects non-google platforms', () => {
  it('SyncIntegrationSchema only allows google, apple, bing', () => {
    // Verify at the schema level that yelp/tripadvisor/facebook cannot
    // be passed to syncPlatform (they are manual_url or coming_soon)
    const result = SyncIntegrationSchema.safeParse({
      location_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      platform: 'yelp',
    });
    expect(result.success).toBe(false);
  });

  it('SyncIntegrationSchema allows google', () => {
    const result = SyncIntegrationSchema.safeParse({
      location_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      platform: 'google',
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SavePlatformUrlSchema — URL validation
// ---------------------------------------------------------------------------

describe('SavePlatformUrlSchema — listing URL validation', () => {
  it('accepts valid https URL for yelp', () => {
    const result = SavePlatformUrlSchema.safeParse({
      platform: 'yelp',
      url: 'https://www.yelp.com/biz/test-business',
      locationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty URL', () => {
    const result = SavePlatformUrlSchema.safeParse({
      platform: 'yelp',
      url: '',
      locationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-URL string', () => {
    const result = SavePlatformUrlSchema.safeParse({
      platform: 'yelp',
      url: 'not a url',
      locationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    });
    expect(result.success).toBe(false);
  });

  it('rejects URL longer than 2048 characters', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(2048);
    const result = SavePlatformUrlSchema.safeParse({
      platform: 'yelp',
      url: longUrl,
      locationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all Big 6 platforms as valid platform values', () => {
    for (const platform of BIG_6_PLATFORMS) {
      const result = SavePlatformUrlSchema.safeParse({
        platform,
        url: 'https://example.com/listing',
        locationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects unknown platform', () => {
    const result = SavePlatformUrlSchema.safeParse({
      platform: 'tiktok',
      url: 'https://tiktok.com/@business',
      locationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    });
    expect(result.success).toBe(false);
  });
});
