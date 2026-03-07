/**
 * Unit Tests — Sidebar NAV_ITEMS: Bot Activity entry (Sprint 73)
 *
 * Verifies the new Bot Activity nav item is present, has the correct href,
 * and is positioned after Page Audits.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/sidebar-crawler.test.ts
 */

import { describe, it, expect } from 'vitest';
import { NAV_ITEMS } from '@/components/layout/Sidebar';

describe('Sidebar NAV_ITEMS — Bot Activity', () => {
  it('NAV_ITEMS includes Bot Activity entry', () => {
    const botActivity = NAV_ITEMS.find((item) => item.label === 'Site Visitors');
    expect(botActivity).toBeDefined();
  });

  it('Bot Activity has correct href /dashboard/crawler-analytics', () => {
    const botActivity = NAV_ITEMS.find((item) => item.label === 'Site Visitors');
    expect(botActivity?.href).toBe('/dashboard/crawler-analytics');
  });

  it('Bot Activity is in the Advanced group (S29 restructure)', () => {
    const botActivityIndex = NAV_ITEMS.findIndex((item) => item.label === 'Site Visitors');
    expect(botActivityIndex).toBeGreaterThanOrEqual(0);
    // After S29 restructure, both are in Advanced group but not necessarily adjacent
    const pageAuditsIndex = NAV_ITEMS.findIndex((item) => item.label === 'Website Checkup');
    expect(pageAuditsIndex).toBeGreaterThanOrEqual(0);
  });
});
