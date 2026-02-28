// ---------------------------------------------------------------------------
// src/__tests__/unit/platform-descriptions.test.ts — Sprint J
// Tests for entity health platform description translation layer
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  PLATFORM_DESCRIPTIONS,
  getPlatformConsequence,
  type PlatformDescription,
} from '@/lib/entity-health/platform-descriptions';
import type { EntityPlatform } from '@/lib/services/entity-health.service';

const ALL_PLATFORMS: EntityPlatform[] = [
  'google_knowledge_panel',
  'google_business_profile',
  'yelp',
  'tripadvisor',
  'apple_maps',
  'bing_places',
  'wikidata',
];

const ALL_STATUSES: Array<'confirmed' | 'missing' | 'incomplete' | 'unchecked'> = [
  'confirmed',
  'missing',
  'incomplete',
  'unchecked',
];

describe('PLATFORM_DESCRIPTIONS', () => {
  it('has an entry for every EntityPlatform', () => {
    for (const platform of ALL_PLATFORMS) {
      expect(PLATFORM_DESCRIPTIONS[platform]).toBeDefined();
    }
  });

  it('every entry has all required fields', () => {
    for (const platform of ALL_PLATFORMS) {
      const desc = PLATFORM_DESCRIPTIONS[platform];
      expect(desc.label).toBeTruthy();
      expect(desc.whenConfirmed).toBeTruthy();
      expect(desc.whenMissing).toBeTruthy();
      expect(desc.whenIncomplete).toBeTruthy();
      expect(desc.whenUnchecked).toBeTruthy();
    }
  });

  it('no description contains banned jargon', () => {
    const banned = [
      'knowledge graph',
      'ontological',
      'entity disambiguation',
      'semantic',
      'embedding',
      'NLP',
      'NER',
      'entity resolution',
      'canonical form',
    ];

    for (const platform of ALL_PLATFORMS) {
      const desc = PLATFORM_DESCRIPTIONS[platform];
      const allText = [
        desc.label,
        desc.whenConfirmed,
        desc.whenMissing,
        desc.whenIncomplete,
        desc.whenUnchecked,
      ].join(' ');

      for (const word of banned) {
        expect(allText.toLowerCase()).not.toContain(word.toLowerCase());
      }
    }
  });

  it('google_knowledge_panel label is jargon-free', () => {
    expect(PLATFORM_DESCRIPTIONS.google_knowledge_panel.label).toBe(
      'Google recognizes your business',
    );
  });

  it('google_business_profile mentions AI impact', () => {
    const desc = PLATFORM_DESCRIPTIONS.google_business_profile;
    expect(desc.whenMissing).toContain('highest-impact');
  });

  it('yelp mentions ChatGPT', () => {
    const desc = PLATFORM_DESCRIPTIONS.yelp;
    expect(desc.whenConfirmed).toContain('ChatGPT');
  });

  it('apple_maps mentions Siri', () => {
    const desc = PLATFORM_DESCRIPTIONS.apple_maps;
    expect(desc.whenConfirmed).toContain('Siri');
  });

  it('bing_places mentions Copilot', () => {
    const desc = PLATFORM_DESCRIPTIONS.bing_places;
    expect(desc.whenConfirmed).toContain('Copilot');
  });

  it('wikidata marks itself as optional', () => {
    const desc = PLATFORM_DESCRIPTIONS.wikidata;
    expect(desc.whenMissing).toContain('optional');
  });
});

describe('getPlatformConsequence', () => {
  it('returns correct text for each platform+status combination', () => {
    for (const platform of ALL_PLATFORMS) {
      for (const status of ALL_STATUSES) {
        const result = getPlatformConsequence(platform, status);
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
      }
    }
  });

  it('returns confirmed text for confirmed status', () => {
    const result = getPlatformConsequence('google_business_profile', 'confirmed');
    expect(result).toContain('verified');
  });

  it('returns missing text for missing status', () => {
    const result = getPlatformConsequence('yelp', 'missing');
    expect(result).toContain('unclaimed');
  });

  it('returns empty string for unknown platform', () => {
    const result = getPlatformConsequence('nonexistent' as EntityPlatform, 'confirmed');
    expect(result).toBe('');
  });
});
