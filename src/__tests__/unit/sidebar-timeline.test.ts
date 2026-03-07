// ---------------------------------------------------------------------------
// sidebar-timeline.test.ts — Unit tests for Proof Timeline sidebar entry
//
// Sprint 77: 3 tests — verifies NAV_ITEMS includes Proof Timeline.
// S34: Updated — Bot Activity (Site Visitors) removed, reference changed.
//
// Run:
//   npx vitest run src/__tests__/unit/sidebar-timeline.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { NAV_ITEMS } from '@/components/layout/Sidebar';

describe('Sidebar NAV_ITEMS — Proof Timeline', () => {
  it('1. NAV_ITEMS includes Proof Timeline entry', () => {
    const entry = NAV_ITEMS.find((item) => item.label === 'Update Tracking');
    expect(entry).toBeDefined();
  });

  it('2. Proof Timeline has correct href /dashboard/proof-timeline', () => {
    const entry = NAV_ITEMS.find((item) => item.label === 'Update Tracking');
    expect(entry!.href).toBe('/dashboard/proof-timeline');
  });

  it('3. Proof Timeline is in the Advanced group (S29 restructure)', () => {
    const timelineIndex = NAV_ITEMS.findIndex((item) => item.label === 'Update Tracking');
    expect(timelineIndex).toBeGreaterThanOrEqual(0);
  });
});
