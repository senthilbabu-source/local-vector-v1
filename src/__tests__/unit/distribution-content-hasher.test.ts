// @vitest-environment node
/**
 * Distribution Content Hasher — Unit Tests (Sprint 1: Distribution Engine)
 *
 * Verifies computeMenuHash() produces deterministic SHA-256 hashes:
 * - Same items in any order → same hash
 * - Strips volatile fields (confidence, image_url)
 * - Stable output for empty arrays
 */

import { describe, it, expect } from 'vitest';
import { computeMenuHash } from '@/lib/distribution/content-hasher';
import type { MenuExtractedItem } from '@/lib/types/menu';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ITEM_A: MenuExtractedItem = {
  id: 'item-a',
  name: 'Chicken 65',
  description: 'Spicy fried chicken',
  price: '14.99',
  category: 'Appetizers',
  confidence: 0.95,
  image_url: 'https://example.com/chicken.jpg',
};

const ITEM_B: MenuExtractedItem = {
  id: 'item-b',
  name: 'Lamb Biryani',
  description: 'Aromatic rice with lamb',
  price: '18.99',
  category: 'Mains',
  confidence: 0.88,
};

const ITEM_C: MenuExtractedItem = {
  id: 'item-c',
  name: 'Mango Lassi',
  price: '5.99',
  category: 'Beverages',
  confidence: 0.92,
  price_note: 'Large: $7.99',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeMenuHash', () => {
  it('returns sha256-{64hex} format string', () => {
    const hash = computeMenuHash([ITEM_A]);
    expect(hash).toMatch(/^sha256-[a-f0-9]{64}$/);
  });

  it('produces same hash for items in different order (sort by id)', () => {
    const hashAB = computeMenuHash([ITEM_A, ITEM_B]);
    const hashBA = computeMenuHash([ITEM_B, ITEM_A]);
    expect(hashAB).toBe(hashBA);
  });

  it('strips confidence field — same items with different confidence produce same hash', () => {
    const highConf = { ...ITEM_A, confidence: 0.99 };
    const lowConf = { ...ITEM_A, confidence: 0.50 };
    expect(computeMenuHash([highConf])).toBe(computeMenuHash([lowConf]));
  });

  it('strips image_url field — same items with different image_url produce same hash', () => {
    const withImage = { ...ITEM_A, image_url: 'https://example.com/v1.jpg' };
    const diffImage = { ...ITEM_A, image_url: 'https://example.com/v2.jpg' };
    const noImage = { ...ITEM_A };
    delete (noImage as Record<string, unknown>).image_url;
    expect(computeMenuHash([withImage])).toBe(computeMenuHash([diffImage]));
    expect(computeMenuHash([withImage])).toBe(computeMenuHash([noImage]));
  });

  it('returns stable hash for empty items array', () => {
    const hash1 = computeMenuHash([]);
    const hash2 = computeMenuHash([]);
    expect(hash1).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(hash1).toBe(hash2);
  });

  it('handles items with undefined optional fields', () => {
    const minimal: MenuExtractedItem = {
      id: 'min-1',
      name: 'Plain Rice',
      category: 'Sides',
      confidence: 0.80,
    };
    const hash = computeMenuHash([minimal]);
    expect(hash).toMatch(/^sha256-[a-f0-9]{64}$/);
  });

  it('different items produce different hashes', () => {
    const hashA = computeMenuHash([ITEM_A]);
    const hashB = computeMenuHash([ITEM_B]);
    expect(hashA).not.toBe(hashB);
  });

  it('includes price_note in hash computation', () => {
    const withNote = { ...ITEM_C };
    const withoutNote = { ...ITEM_C, price_note: undefined };
    expect(computeMenuHash([withNote])).not.toBe(computeMenuHash([withoutNote]));
  });
});
