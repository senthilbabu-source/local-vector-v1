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
    const botActivity = NAV_ITEMS.find((item) => item.label === 'Bot Activity');
    expect(botActivity).toBeDefined();
  });

  it('Bot Activity has correct href /dashboard/crawler-analytics', () => {
    const botActivity = NAV_ITEMS.find((item) => item.label === 'Bot Activity');
    expect(botActivity?.href).toBe('/dashboard/crawler-analytics');
  });

  it('Bot Activity is positioned after Page Audits', () => {
    const pageAuditsIndex = NAV_ITEMS.findIndex((item) => item.label === 'Page Audits');
    const botActivityIndex = NAV_ITEMS.findIndex((item) => item.label === 'Bot Activity');
    expect(pageAuditsIndex).toBeGreaterThanOrEqual(0);
    expect(botActivityIndex).toBeGreaterThanOrEqual(0);
    expect(botActivityIndex).toBe(pageAuditsIndex + 1);
  });
});
