/**
 * Unit Tests — Sidebar NAV_ITEMS: Bot Activity entry (Sprint 73)
 *
 * S34: Bot Activity (Site Visitors) merged into Website Checkup (page-audits#bots).
 * The sidebar entry was removed. This test verifies the removal.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/sidebar-crawler.test.ts
 */

import { describe, it, expect } from 'vitest';
import { NAV_ITEMS } from '@/components/layout/Sidebar';

describe('Sidebar NAV_ITEMS — Bot Activity (S34: merged into Website Checkup)', () => {
  it('Site Visitors entry no longer exists in NAV_ITEMS', () => {
    const botActivity = NAV_ITEMS.find((item) => item.label === 'Site Visitors');
    expect(botActivity).toBeUndefined();
  });

  it('crawler-analytics href no longer in NAV_ITEMS', () => {
    const entry = NAV_ITEMS.find((item) => item.href === '/dashboard/crawler-analytics');
    expect(entry).toBeUndefined();
  });

  it('Website Checkup still exists and points to page-audits', () => {
    const pageAudits = NAV_ITEMS.find((item) => item.label === 'Website Checkup');
    expect(pageAudits).toBeDefined();
    expect(pageAudits?.href).toBe('/dashboard/page-audits');
  });
});
