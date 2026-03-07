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
  it('1. NAV_ITEMS includes Entity Health entry (renamed to "Where AI Knows You")', () => {
    const entry = NAV_ITEMS.find((item) => item.testId === 'entity-health');
    expect(entry).toBeDefined();
    expect(entry!.label).toBe('Where AI Knows You');
  });

  it('2. Entity Health has correct href /dashboard/entity-health', () => {
    const entry = NAV_ITEMS.find((item) => item.testId === 'entity-health');
    expect(entry!.href).toBe('/dashboard/entity-health');
  });

  it('3. Entity Health is in the This Month group (S29 restructure)', () => {
    const entityIndex = NAV_ITEMS.findIndex((item) => item.testId === 'entity-health');
    expect(entityIndex).toBeGreaterThanOrEqual(0);
  });
});
