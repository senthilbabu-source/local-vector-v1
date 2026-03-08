// ---------------------------------------------------------------------------
// menu-inline-editor.test.ts — Unit tests for inline menu editing features
//
// Tests:
//   1. Price detection bug fix (string-based price check)
//   2. updateMenuItems server action
//   3. autoTagDietaryInfo server action
//   4. DIETARY_TAG_OPTIONS constant
//
// Run:
//   npx vitest run src/__tests__/unit/menu-inline-editor.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// 1. Pure function tests — menu-optimizer price fix
// ---------------------------------------------------------------------------

import {
  analyzeMenuCompleteness,
  generateMenuSuggestions,
  type MenuItemData,
} from '@/lib/menu-intelligence/menu-optimizer';

describe('analyzeMenuCompleteness — string price fix', () => {
  it('counts string prices correctly', () => {
    const items: MenuItemData[] = [
      { name: 'Wings', price: '$12.50' },
      { name: 'Fries', price: '$5.00' },
      { name: 'Water', price: null },
    ];
    const result = analyzeMenuCompleteness(items);
    expect(result.itemsWithPrice).toBe(2);
    expect(result.pricePercent).toBe(67);
  });

  it('treats empty string price as missing', () => {
    const items: MenuItemData[] = [
      { name: 'Wings', price: '' },
      { name: 'Fries', price: '  ' },
    ];
    const result = analyzeMenuCompleteness(items);
    expect(result.itemsWithPrice).toBe(0);
    expect(result.pricePercent).toBe(0);
  });

  it('treats undefined price as missing', () => {
    const items: MenuItemData[] = [
      { name: 'Wings' },
    ];
    const result = analyzeMenuCompleteness(items);
    expect(result.itemsWithPrice).toBe(0);
  });

  it('does NOT suggest "Add prices" when all items have string prices', () => {
    const items: MenuItemData[] = [
      { name: 'Brisket', description: 'Smoked', price: '$18', dietary_tags: ['gluten-free'] },
      { name: 'Ribs', description: 'BBQ', price: '$22', dietary_tags: ['gluten-free'] },
    ];
    const completeness = analyzeMenuCompleteness(items);
    expect(completeness.pricePercent).toBe(100);
    const suggestions = generateMenuSuggestions(completeness);
    expect(suggestions.some(s => s.category === 'price')).toBe(false);
  });

  it('suggests "Add prices" only when items genuinely have no price string', () => {
    const items: MenuItemData[] = [
      { name: 'A', price: null },
      { name: 'B', price: null },
      { name: 'C', price: '$10' },
    ];
    const completeness = analyzeMenuCompleteness(items);
    expect(completeness.pricePercent).toBe(33);
    const suggestions = generateMenuSuggestions(completeness);
    const priceSuggestion = suggestions.find(s => s.category === 'price');
    expect(priceSuggestion).toBeDefined();
    expect(priceSuggestion!.title).toContain('2');
  });

  it('handles prices without dollar sign', () => {
    const items: MenuItemData[] = [
      { name: 'Item', price: '12.50' },
    ];
    const result = analyzeMenuCompleteness(items);
    expect(result.itemsWithPrice).toBe(1);
  });

  it('counts dietary_tags correctly', () => {
    const items: MenuItemData[] = [
      { name: 'A', dietary_tags: ['vegan'] },
      { name: 'B', dietary_tags: [] },
      { name: 'C', dietary_tags: null },
      { name: 'D' },
    ];
    const result = analyzeMenuCompleteness(items);
    expect(result.itemsWithDietary).toBe(1);
    expect(result.dietaryPercent).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// 2. Server action tests — mocked Supabase + auth
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

// Build a chainable mock for supabase
function buildSupabaseMock() {
  const chain = {
    select: mockSelect,
    update: mockUpdate,
    eq: mockEq,
    single: mockSingle,
  };
  mockSelect.mockReturnValue(chain);
  mockUpdate.mockReturnValue(chain);
  mockEq.mockReturnValue(chain);
  return chain;
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockImplementation(() => buildSupabaseMock()),
  }),
}));

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: vi.fn().mockResolvedValue({ orgId: 'org-1', userId: 'user-1' }),
}));

vi.mock('@/lib/credits/credit-service', () => ({
  checkCredit: vi.fn().mockResolvedValue({ ok: true, creditsUsed: 0, creditsLimit: 100 }),
  consumeCredit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// Mock AI SDK for autoTagDietaryInfo
vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      items: [
        { name: 'Garden Salad', dietary_tags: ['vegan', 'gluten-free'] },
        { name: 'Grilled Chicken', dietary_tags: [] },
      ],
    },
  }),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn().mockReturnValue('mock-model'),
  hasApiKey: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/ai/schemas', () => ({
  zodSchema: vi.fn().mockImplementation((s: unknown) => s),
  MenuOCRSchema: {},
}));

// Import after mocks
const { updateMenuItems, autoTagDietaryInfo } = await import(
  '@/app/dashboard/magic-menus/actions'
);
const { DIETARY_TAG_OPTIONS } = await import('@/lib/constants/dietary-tags');

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_MENU_DATA = {
  id: 'menu-1',
  location_id: 'loc-1',
  processing_status: 'published' as const,
  extracted_data: {
    items: [
      { id: 'item-1', name: 'Garden Salad', price: '$12', description: 'Fresh greens', category: 'Starters', confidence: 0.95 },
      { id: 'item-2', name: 'Grilled Chicken', price: '$18', description: '', category: 'Mains', confidence: 0.9 },
      { id: 'item-3', name: 'Fries', price: null, description: null, category: 'Sides', confidence: 0.85 },
    ],
    extracted_at: '2026-03-08T00:00:00Z',
  },
  extraction_confidence: 0.9,
  is_published: true,
  public_slug: 'test-menu',
  human_verified: true,
  propagation_events: [],
  content_hash: 'abc123',
  last_distributed_at: '2026-03-08T00:00:00Z',
};

// ---------------------------------------------------------------------------
// updateMenuItems tests
// ---------------------------------------------------------------------------

describe('updateMenuItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when no updates provided', async () => {
    const result = await updateMenuItems('menu-1', []);
    expect(result).toEqual({ success: false, error: 'No updates provided' });
  });

  it('updates price for a single item', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: MOCK_MENU_DATA, error: null })
      .mockResolvedValueOnce({ data: { ...MOCK_MENU_DATA }, error: null });

    const result = await updateMenuItems('menu-1', [
      { id: 'item-3', price: '$6.50' },
    ]);
    expect(result.success).toBe(true);
  });

  it('updates dietary_tags for a single item', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: MOCK_MENU_DATA, error: null })
      .mockResolvedValueOnce({ data: { ...MOCK_MENU_DATA }, error: null });

    const result = await updateMenuItems('menu-1', [
      { id: 'item-1', dietary_tags: ['vegan', 'gluten-free'] },
    ]);
    expect(result.success).toBe(true);
  });

  it('updates description for a single item', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: MOCK_MENU_DATA, error: null })
      .mockResolvedValueOnce({ data: { ...MOCK_MENU_DATA }, error: null });

    const result = await updateMenuItems('menu-1', [
      { id: 'item-2', description: 'Juicy grilled chicken breast' },
    ]);
    expect(result.success).toBe(true);
  });

  it('handles multiple item updates at once', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: MOCK_MENU_DATA, error: null })
      .mockResolvedValueOnce({ data: { ...MOCK_MENU_DATA }, error: null });

    const result = await updateMenuItems('menu-1', [
      { id: 'item-1', dietary_tags: ['vegan'] },
      { id: 'item-2', price: '$20' },
      { id: 'item-3', price: '$6', description: 'Crispy fries' },
    ]);
    expect(result.success).toBe(true);
  });

  it('returns error when menu not found', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

    const result = await updateMenuItems('nonexistent', [{ id: 'item-1', price: '$5' }]);
    expect(result.success).toBe(false);
  });

  it('returns error when DB update fails', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: MOCK_MENU_DATA, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    const result = await updateMenuItems('menu-1', [{ id: 'item-1', price: '$5' }]);
    expect(result).toEqual({ success: false, error: 'DB error' });
  });

  it('preserves items not included in updates', async () => {
    // Use a menu with known items, update only item-1, verify returned menu still has all items
    const menuWithUpdatedItem1 = {
      ...MOCK_MENU_DATA,
      extracted_data: {
        ...MOCK_MENU_DATA.extracted_data,
        items: [
          { ...MOCK_MENU_DATA.extracted_data.items[0], price: '$15' },
          MOCK_MENU_DATA.extracted_data.items[1],
          MOCK_MENU_DATA.extracted_data.items[2],
        ],
      },
    };
    mockSingle
      .mockResolvedValueOnce({ data: MOCK_MENU_DATA, error: null })
      .mockResolvedValueOnce({ data: menuWithUpdatedItem1, error: null });

    const result = await updateMenuItems('menu-1', [{ id: 'item-1', price: '$15' }]);
    expect(result.success).toBe(true);
    if (result.success) {
      // All 3 items preserved
      expect(result.menu.extracted_data!.items).toHaveLength(3);
      // item-1 updated
      expect(result.menu.extracted_data!.items[0].price).toBe('$15');
      // item-2 unchanged
      expect(result.menu.extracted_data!.items[1].price).toBe('$18');
    }
  });
});

// ---------------------------------------------------------------------------
// autoTagDietaryInfo tests
// ---------------------------------------------------------------------------

describe('autoTagDietaryInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns dietary tag suggestions from AI', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { extracted_data: MOCK_MENU_DATA.extracted_data },
      error: null,
    });

    const result = await autoTagDietaryInfo('menu-1');
    expect(result.success).toBe(true);
    if (result.success) {
      // AI mock returns tags for Garden Salad only (Grilled Chicken has empty array)
      expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
      const saladSuggestion = result.suggestions.find(s => s.name === 'Garden Salad');
      expect(saladSuggestion).toBeDefined();
      expect(saladSuggestion!.dietary_tags).toContain('vegan');
    }
  });

  it('returns error when menu not found', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

    const result = await autoTagDietaryInfo('nonexistent');
    expect(result.success).toBe(false);
  });

  it('filters out items with empty dietary_tags', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { extracted_data: MOCK_MENU_DATA.extracted_data },
      error: null,
    });

    const result = await autoTagDietaryInfo('menu-1');
    if (result.success) {
      // Grilled Chicken has [] from AI mock, should be filtered out
      const chickenSuggestion = result.suggestions.find(s => s.name === 'Grilled Chicken');
      expect(chickenSuggestion).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// DIETARY_TAG_OPTIONS constant
// ---------------------------------------------------------------------------

describe('DIETARY_TAG_OPTIONS', () => {
  it('contains expected canonical tags', () => {
    expect(DIETARY_TAG_OPTIONS).toContain('vegan');
    expect(DIETARY_TAG_OPTIONS).toContain('vegetarian');
    expect(DIETARY_TAG_OPTIONS).toContain('gluten-free');
    expect(DIETARY_TAG_OPTIONS).toContain('halal');
    expect(DIETARY_TAG_OPTIONS).toContain('kosher');
  });

  it('has exactly 8 options', () => {
    expect(DIETARY_TAG_OPTIONS).toHaveLength(8);
  });

  it('contains no duplicates', () => {
    const unique = new Set(DIETARY_TAG_OPTIONS);
    expect(unique.size).toBe(DIETARY_TAG_OPTIONS.length);
  });
});
