// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// src/__tests__/unit/ai-talking-about.test.tsx
//
// Component tests for AITalkingAboutSection on the main Magic Menu page.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AITalkingAboutSection from '@/app/dashboard/magic-menus/_components/AITalkingAboutSection';
import type { AITalkingItem } from '@/app/dashboard/magic-menus/_components/AITalkingAboutSection';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ITEMS: AITalkingItem[] = [
  { item_id: '1', item_name: 'Chicken 65 (wet)', mention_count: 12, category_name: 'Appetizers' },
  { item_id: '2', item_name: 'Lamb Chops', mention_count: 7, category_name: 'Grill' },
  { item_id: '3', item_name: 'Wings', mention_count: 5, category_name: 'Appetizers' },
  { item_id: '4', item_name: 'Butter Chicken Masala', mention_count: 3, category_name: 'Entrees' },
  { item_id: '5', item_name: 'Truffle Cloud Fries', mention_count: 2, category_name: 'Appetizers' },
  { item_id: '6', item_name: 'Naan', mention_count: 1, category_name: 'Entrees' },
  { item_id: '7', item_name: 'Coke', mention_count: 0, category_name: 'Beverages' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AITalkingAboutSection', () => {
  it('renders top 5 items sorted by mention_count DESC', () => {
    render(<AITalkingAboutSection items={ITEMS} />);
    const cards = screen.getAllByTestId('ai-talking-item');
    expect(cards).toHaveLength(5);
    // First card should be highest mentions
    expect(cards[0].textContent).toContain('Chicken 65 (wet)');
    expect(cards[0].textContent).toContain('12');
    // Last card should be 5th highest
    expect(cards[4].textContent).toContain('Truffle Cloud Fries');
  });

  it('shows section heading and time range', () => {
    render(<AITalkingAboutSection items={ITEMS} />);
    expect(screen.getByText('What AI Is Talking About')).toBeDefined();
    expect(screen.getByText('Last 90 days')).toBeDefined();
  });

  it('shows category names', () => {
    render(<AITalkingAboutSection items={ITEMS} />);
    // "Appetizers" appears multiple times, just check at least one
    expect(screen.getAllByText('Appetizers').length).toBeGreaterThan(0);
    expect(screen.getByText('Grill')).toBeDefined();
  });

  it('shows "Trending" label for items with >= 10 mentions', () => {
    render(<AITalkingAboutSection items={ITEMS} />);
    expect(screen.getByText('Trending')).toBeDefined();
  });

  it('shows "Popular" label for items with >= 5 mentions', () => {
    render(<AITalkingAboutSection items={ITEMS} />);
    expect(screen.getAllByText('Popular')).toHaveLength(2); // Lamb Chops (7) + Wings (5)
  });

  it('shows "Mentioned" label for items with < 5 mentions', () => {
    render(<AITalkingAboutSection items={ITEMS} />);
    expect(screen.getAllByText('Mentioned')).toHaveLength(2); // Butter Chicken (3) + Truffle Fries (2)
  });

  it('returns null when no items have mentions', () => {
    const zeroItems: AITalkingItem[] = [
      { item_id: '1', item_name: 'Naan', mention_count: 0, category_name: 'Entrees' },
    ];
    const { container } = render(<AITalkingAboutSection items={zeroItems} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when items array is empty', () => {
    const { container } = render(<AITalkingAboutSection items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('handles items without category_name', () => {
    const noCat: AITalkingItem[] = [
      { item_id: '1', item_name: 'Mystery Dish', mention_count: 5, category_name: null },
    ];
    render(<AITalkingAboutSection items={noCat} />);
    expect(screen.getByText('Mystery Dish')).toBeDefined();
    // Should not render a category subtitle — only the item name + mention info
    const card = screen.getByTestId('ai-talking-item');
    // The category_name slot uses text-xs text-slate-500 — should not exist
    const categoryEl = card.querySelector('p.text-slate-500');
    expect(categoryEl).toBeNull();
  });

  it('filters out zero-mention items before slicing top 5', () => {
    const mixed: AITalkingItem[] = [
      { item_id: '1', item_name: 'A', mention_count: 10, category_name: null },
      { item_id: '2', item_name: 'B', mention_count: 0, category_name: null },
      { item_id: '3', item_name: 'C', mention_count: 8, category_name: null },
    ];
    render(<AITalkingAboutSection items={mixed} />);
    const cards = screen.getAllByTestId('ai-talking-item');
    expect(cards).toHaveLength(2);
  });

  it('renders data-testid on the section container', () => {
    render(<AITalkingAboutSection items={ITEMS} />);
    expect(screen.getByTestId('ai-talking-about-section')).toBeDefined();
  });
});
