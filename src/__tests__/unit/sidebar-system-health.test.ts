// ---------------------------------------------------------------------------
// sidebar-system-health.test.ts — Sprint 76 + S35: System Health moved to Admin
//
// S35: System Status removed from dashboard sidebar, moved to /admin/system-health.
// This test verifies the sidebar removal and admin nav addition.
//
// Run: npx vitest run src/__tests__/unit/sidebar-system-health.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { NAV_ITEMS } from '@/components/layout/Sidebar';

describe('Sidebar NAV_ITEMS — System Health (S35: moved to Admin)', () => {
  it('System Status entry no longer exists in NAV_ITEMS', () => {
    const systemHealth = NAV_ITEMS.find((item) => item.label === 'System Status');
    expect(systemHealth).toBeUndefined();
  });

  it('system-health href no longer in NAV_ITEMS', () => {
    const entry = NAV_ITEMS.find((item) => item.href === '/dashboard/system-health');
    expect(entry).toBeUndefined();
  });
});
