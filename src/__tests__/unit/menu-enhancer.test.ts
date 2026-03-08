// ---------------------------------------------------------------------------
// Unit tests for lib/menu-intelligence/menu-enhancer.ts
// Tests pure functions only — no LLM calls.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  buildEnhanceSystemPrompt,
  buildEnhanceUserPrompt,
  validateEnhancements,
  applyEnhancementsToItems,
  acceptEnhancements,
  dismissEnhancements,
} from '@/lib/menu-intelligence/menu-enhancer';
import type { MenuExtractedItem } from '@/lib/types/menu';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ITEMS: MenuExtractedItem[] = [
  { id: '1', name: 'Chicken Tenders', price: '$13.95', category: 'Appetizers', confidence: 0.70 },
  { id: '2', name: 'Veg Spring Rolls', price: '$9.95', category: 'Appetizers', confidence: 0.70, description: 'Crispy rolls' },
  { id: '3', name: 'Butter Chiken', price: '$16.95', category: 'Entrees', confidence: 0.68 },
  { id: '4', name: 'Lamb Chops', price: '$24.95', category: 'Grill', confidence: 0.88, description: 'Grilled to perfection' },
];

const VALID_IDS = new Set(ITEMS.map((i) => i.id));

// ---------------------------------------------------------------------------
// buildEnhanceSystemPrompt
// ---------------------------------------------------------------------------

describe('buildEnhanceSystemPrompt', () => {
  it('returns a non-empty string with key instructions', () => {
    const prompt = buildEnhanceSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(prompt).toContain('description');
    expect(prompt).toContain('typo');
    expect(prompt).toContain('NAME CORRECTION');
  });
});

// ---------------------------------------------------------------------------
// buildEnhanceUserPrompt
// ---------------------------------------------------------------------------

describe('buildEnhanceUserPrompt', () => {
  it('includes all item names and IDs', () => {
    const prompt = buildEnhanceUserPrompt(ITEMS);
    expect(prompt).toContain('ID: 1');
    expect(prompt).toContain('Chicken Tenders');
    expect(prompt).toContain('Butter Chiken');
    expect(prompt).toContain('4 menu items');
  });

  it('shows existing description when present', () => {
    const prompt = buildEnhanceUserPrompt(ITEMS);
    expect(prompt).toContain('Current description: Crispy rolls');
  });

  it('shows (none) for items without description', () => {
    const prompt = buildEnhanceUserPrompt(ITEMS);
    expect(prompt).toContain('Current description: (none)');
  });

  it('includes price and category', () => {
    const prompt = buildEnhanceUserPrompt(ITEMS);
    expect(prompt).toContain('Price: $13.95');
    expect(prompt).toContain('Category: Appetizers');
  });

  it('includes price_note when present', () => {
    const items: MenuExtractedItem[] = [
      { id: '10', name: 'Hookah', price: '$40', price_note: 'Refill: $20', category: 'Specials', confidence: 0.80 },
    ];
    const prompt = buildEnhanceUserPrompt(items);
    expect(prompt).toContain('Price note: Refill: $20');
  });
});

// ---------------------------------------------------------------------------
// validateEnhancements
// ---------------------------------------------------------------------------

describe('validateEnhancements', () => {
  it('accepts valid enhancements with matching item_ids', () => {
    const raw = [
      { item_id: '1', ai_description: 'Crispy golden chicken tenders', ai_name_correction: null },
      { item_id: '3', ai_description: 'Rich creamy butter chicken', ai_name_correction: 'Butter Chicken' },
    ];
    const result = validateEnhancements(raw, VALID_IDS);
    expect(result).toHaveLength(2);
    expect(result[0].item_id).toBe('1');
    expect(result[1].ai_name_correction).toBe('Butter Chicken');
  });

  it('rejects entries with unknown item_ids', () => {
    const raw = [
      { item_id: 'unknown', ai_description: 'Some description', ai_name_correction: null },
    ];
    const result = validateEnhancements(raw, VALID_IDS);
    expect(result).toHaveLength(0);
  });

  it('rejects entries without ai_description', () => {
    const raw = [
      { item_id: '1', ai_description: '', ai_name_correction: null },
    ];
    const result = validateEnhancements(raw, VALID_IDS);
    expect(result).toHaveLength(0);
  });

  it('truncates long descriptions to 200 chars', () => {
    const raw = [
      { item_id: '1', ai_description: 'A'.repeat(300), ai_name_correction: null },
    ];
    const result = validateEnhancements(raw, VALID_IDS);
    expect(result[0].ai_description).toHaveLength(200);
  });

  it('treats empty string name_correction as null', () => {
    const raw = [
      { item_id: '1', ai_description: 'Good', ai_name_correction: '' },
    ];
    const result = validateEnhancements(raw, VALID_IDS);
    expect(result[0].ai_name_correction).toBeNull();
  });

  it('filters out non-object entries', () => {
    const raw = [null, 'string', 42, undefined];
    const result = validateEnhancements(raw as unknown[], VALID_IDS);
    expect(result).toHaveLength(0);
  });

  it('handles missing fields gracefully', () => {
    const raw = [{ item_id: '1' }, { ai_description: 'test' }];
    const result = validateEnhancements(raw, VALID_IDS);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// applyEnhancementsToItems
// ---------------------------------------------------------------------------

describe('applyEnhancementsToItems', () => {
  it('applies ai_description and ai_name_correction to matched items', () => {
    const enhancements = [
      { item_id: '1', ai_description: 'Golden crispy tenders', ai_name_correction: null },
      { item_id: '3', ai_description: 'Creamy butter chicken curry', ai_name_correction: 'Butter Chicken' },
    ];
    const result = applyEnhancementsToItems(ITEMS, enhancements);

    expect(result[0].ai_description).toBe('Golden crispy tenders');
    expect(result[0].ai_name_correction).toBeUndefined(); // null → undefined
    expect(result[2].ai_description).toBe('Creamy butter chicken curry');
    expect(result[2].ai_name_correction).toBe('Butter Chicken');
  });

  it('does not mutate original items', () => {
    const enhancements = [
      { item_id: '1', ai_description: 'New desc', ai_name_correction: null },
    ];
    const result = applyEnhancementsToItems(ITEMS, enhancements);
    expect(ITEMS[0].ai_description).toBeUndefined();
    expect(result[0].ai_description).toBe('New desc');
  });

  it('leaves unmatched items unchanged', () => {
    const enhancements = [
      { item_id: '1', ai_description: 'New desc', ai_name_correction: null },
    ];
    const result = applyEnhancementsToItems(ITEMS, enhancements);
    expect(result[1]).toBe(ITEMS[1]); // same reference — untouched
    expect(result[3]).toBe(ITEMS[3]);
  });
});

// ---------------------------------------------------------------------------
// acceptEnhancements
// ---------------------------------------------------------------------------

describe('acceptEnhancements', () => {
  const itemsWithSuggestions: MenuExtractedItem[] = [
    { id: '1', name: 'Chicken Tenders', category: 'Appetizers', confidence: 0.70, ai_description: 'Golden crispy tenders' },
    { id: '3', name: 'Butter Chiken', category: 'Entrees', confidence: 0.68, ai_description: 'Rich creamy curry', ai_name_correction: 'Butter Chicken' },
    { id: '4', name: 'Lamb Chops', category: 'Grill', confidence: 0.88, description: 'Grilled to perfection' },
  ];

  it('replaces description with ai_description and marks as enhanced', () => {
    const result = acceptEnhancements(itemsWithSuggestions, new Set(['1']));
    expect(result[0].description).toBe('Golden crispy tenders');
    expect(result[0].ai_enhanced).toBe(true);
  });

  it('replaces name with ai_name_correction when present', () => {
    const result = acceptEnhancements(itemsWithSuggestions, new Set(['3']));
    expect(result[1].name).toBe('Butter Chicken');
    expect(result[1].description).toBe('Rich creamy curry');
    expect(result[1].ai_enhanced).toBe(true);
  });

  it('does not modify unselected items', () => {
    const result = acceptEnhancements(itemsWithSuggestions, new Set(['1']));
    expect(result[2]).toBe(itemsWithSuggestions[2]);
  });

  it('does not mutate originals', () => {
    acceptEnhancements(itemsWithSuggestions, new Set(['1']));
    expect(itemsWithSuggestions[0].description).toBeUndefined();
    expect(itemsWithSuggestions[0].ai_enhanced).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// dismissEnhancements
// ---------------------------------------------------------------------------

describe('dismissEnhancements', () => {
  const itemsWithSuggestions: MenuExtractedItem[] = [
    { id: '1', name: 'Chicken Tenders', category: 'Appetizers', confidence: 0.70, ai_description: 'Golden crispy tenders' },
    { id: '2', name: 'Spring Rolls', category: 'Appetizers', confidence: 0.70, ai_description: 'Fresh veggie rolls', ai_name_correction: 'Veg Spring Rolls' },
  ];

  it('removes ai_description and ai_name_correction', () => {
    const result = dismissEnhancements(itemsWithSuggestions, new Set(['1']));
    expect(result[0].ai_description).toBeUndefined();
    expect(result[0].ai_name_correction).toBeUndefined();
    expect(result[0].name).toBe('Chicken Tenders');
  });

  it('removes both fields when item has both', () => {
    const result = dismissEnhancements(itemsWithSuggestions, new Set(['2']));
    expect(result[1].ai_description).toBeUndefined();
    expect(result[1].ai_name_correction).toBeUndefined();
  });

  it('does not modify unselected items', () => {
    const result = dismissEnhancements(itemsWithSuggestions, new Set(['1']));
    expect(result[1]).toBe(itemsWithSuggestions[1]);
  });

  it('does not mutate originals', () => {
    dismissEnhancements(itemsWithSuggestions, new Set(['1']));
    expect(itemsWithSuggestions[0].ai_description).toBe('Golden crispy tenders');
  });
});
