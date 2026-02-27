// ---------------------------------------------------------------------------
// sidebar-system-health.test.ts — Sprint 76: Validate System Health in sidebar
//
// Tests that the NAV_ITEMS array in Sidebar.tsx includes the System Health
// entry with the correct href, active state, and position.
//
// Run: npx vitest run src/__tests__/unit/sidebar-system-health.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { NAV_ITEMS } from '@/components/layout/Sidebar';

describe('Sidebar NAV_ITEMS — System Health', () => {
  it('NAV_ITEMS includes System Health entry', () => {
    const systemHealth = NAV_ITEMS.find((item) => item.label === 'System Health');
    expect(systemHealth).toBeDefined();
  });

  it('System Health has correct href /dashboard/system-health', () => {
    const systemHealth = NAV_ITEMS.find((item) => item.label === 'System Health');
    expect(systemHealth?.href).toBe('/dashboard/system-health');
  });

  it('System Health has active=true', () => {
    const systemHealth = NAV_ITEMS.find((item) => item.label === 'System Health');
    expect(systemHealth?.active).toBe(true);
  });

  it('System Health is positioned before Settings', () => {
    const healthIndex = NAV_ITEMS.findIndex((item) => item.label === 'System Health');
    const settingsIndex = NAV_ITEMS.findIndex((item) => item.label === 'Settings');
    expect(healthIndex).toBeGreaterThan(-1);
    expect(settingsIndex).toBeGreaterThan(-1);
    expect(healthIndex).toBeLessThan(settingsIndex);
  });
});
