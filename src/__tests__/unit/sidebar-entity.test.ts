// ---------------------------------------------------------------------------
// sidebar-entity.test.ts — Unit tests for Entity Health sidebar entry
//
// Sprint 80: 3 tests — verifies NAV_ITEMS includes Entity Health.
//
// Run:
//   npx vitest run src/__tests__/unit/sidebar-entity.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { NAV_ITEMS } from '@/components/layout/Sidebar';

describe('Sidebar NAV_ITEMS — Entity Health', () => {
  it('1. NAV_ITEMS includes Entity Health entry', () => {
    const entry = NAV_ITEMS.find((item) => item.label === 'Entity Health');
    expect(entry).toBeDefined();
  });

  it('2. Entity Health has correct href /dashboard/entity-health', () => {
    const entry = NAV_ITEMS.find((item) => item.label === 'Entity Health');
    expect(entry!.href).toBe('/dashboard/entity-health');
  });

  it('3. Entity Health is positioned after Proof Timeline', () => {
    const timelineIndex = NAV_ITEMS.findIndex((item) => item.label === 'Proof Timeline');
    const entityIndex = NAV_ITEMS.findIndex((item) => item.label === 'Entity Health');
    expect(timelineIndex).toBeGreaterThanOrEqual(0);
    expect(entityIndex).toBe(timelineIndex + 1);
  });
});
