// ---------------------------------------------------------------------------
// src/__tests__/unit/sidebar-groups.test.ts
//
// Sprint A (H4): Validates sidebar grouping structure.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, NAV_GROUPS } from '@/components/layout/Sidebar';

describe('H4 — Sidebar NAV_GROUPS structure', () => {
  it('NAV_GROUPS is an array with 4–6 entries (reasonable group count)', () => {
    expect(Array.isArray(NAV_GROUPS)).toBe(true);
    expect(NAV_GROUPS.length).toBeGreaterThanOrEqual(4);
    expect(NAV_GROUPS.length).toBeLessThanOrEqual(6);
  });

  it('every group has a non-empty string label', () => {
    for (const group of NAV_GROUPS) {
      expect(typeof group.label).toBe('string');
      expect(group.label.length).toBeGreaterThan(0);
    }
  });

  it('every group has at least 1 item', () => {
    for (const group of NAV_GROUPS) {
      expect(group.items.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('total item count across all groups equals the NAV_ITEMS count (no items lost during grouping)', () => {
    const totalGroupedItems = NAV_GROUPS.reduce((sum, group) => sum + group.items.length, 0);
    expect(totalGroupedItems).toBe(NAV_ITEMS.length);
  });

  it('no item appears in more than one group (no duplicates)', () => {
    const allHrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    const uniqueHrefs = new Set(allHrefs);
    expect(uniqueHrefs.size).toBe(allHrefs.length);
  });

  it('every item that was in the original NAV_ITEMS flat array is present in NAV_GROUPS', () => {
    const groupedHrefs = new Set(NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)));
    for (const item of NAV_ITEMS) {
      expect(groupedHrefs.has(item.href)).toBe(true);
    }
  });

  it('every item has a valid href (starts with /dashboard or /)', () => {
    const allItems = NAV_GROUPS.flatMap((g) => g.items);
    for (const item of allItems) {
      expect(item.href.startsWith('/')).toBe(true);
    }
  });
});
