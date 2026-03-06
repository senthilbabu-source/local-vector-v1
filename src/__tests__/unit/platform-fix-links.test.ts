// ---------------------------------------------------------------------------
// platform-fix-links.test.ts — S21 (AI_RULES §221)
//
// Unit tests for PLATFORM_FIX_LINKS + getPlatformFixLink().
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  PLATFORM_FIX_LINKS,
  getPlatformFixLink,
} from '@/lib/entity-health/platform-fix-links';

describe('getPlatformFixLink', () => {
  it('google_business_profile returns non-null', () => {
    expect(getPlatformFixLink('google_business_profile')).not.toBeNull();
  });

  it('yelp returns non-null', () => {
    expect(getPlatformFixLink('yelp')).not.toBeNull();
  });

  it('tripadvisor returns non-null', () => {
    expect(getPlatformFixLink('tripadvisor')).not.toBeNull();
  });

  it('apple_maps returns non-null', () => {
    expect(getPlatformFixLink('apple_maps')).not.toBeNull();
  });

  it('bing_places returns non-null', () => {
    expect(getPlatformFixLink('bing_places')).not.toBeNull();
  });

  it('wikidata returns non-null', () => {
    expect(getPlatformFixLink('wikidata')).not.toBeNull();
  });

  it('google_knowledge_panel returns non-null', () => {
    expect(getPlatformFixLink('google_knowledge_panel')).not.toBeNull();
  });

  it('unknown platform returns null (no crash)', () => {
    expect(getPlatformFixLink('unknown_platform')).toBeNull();
  });

  it('empty string returns null', () => {
    expect(getPlatformFixLink('')).toBeNull();
  });
});

describe('PLATFORM_FIX_LINKS data integrity', () => {
  it('all platforms have url starting with https://', () => {
    for (const [, link] of Object.entries(PLATFORM_FIX_LINKS)) {
      expect(link.url).toMatch(/^https:\/\//);
    }
  });

  it('all platforms have non-empty label', () => {
    for (const [, link] of Object.entries(PLATFORM_FIX_LINKS)) {
      expect(link.label.length).toBeGreaterThan(0);
    }
  });

  it('covers all 7 expected platforms', () => {
    expect(Object.keys(PLATFORM_FIX_LINKS)).toHaveLength(7);
  });
});
