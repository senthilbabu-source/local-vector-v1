// ---------------------------------------------------------------------------
// sidebar-nav-items.test.ts — Sprint 68: Validate AI Assistant in sidebar
//
// Tests that the NAV_ITEMS array in Sidebar.tsx includes the AI Assistant
// entry with the correct href, active state, and position.
//
// Run: npx vitest run src/__tests__/unit/sidebar-nav-items.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { NAV_ITEMS } from '@/components/layout/Sidebar';

describe('Sidebar NAV_ITEMS', () => {
  const aiAssistant = NAV_ITEMS.find((item) => item.label === 'AI Assistant');

  it('includes AI Assistant entry', () => {
    expect(aiAssistant).toBeDefined();
  });

  it('AI Assistant href is /dashboard/ai-assistant', () => {
    expect(aiAssistant?.href).toBe('/dashboard/ai-assistant');
  });

  it('AI Assistant has active=true', () => {
    expect(aiAssistant?.active).toBe(true);
  });

  it('AI Assistant is positioned before Settings', () => {
    const aiIndex = NAV_ITEMS.findIndex((item) => item.label === 'AI Assistant');
    const settingsIndex = NAV_ITEMS.findIndex((item) => item.label === 'Settings');
    expect(aiIndex).toBeGreaterThan(-1);
    expect(settingsIndex).toBeGreaterThan(-1);
    expect(aiIndex).toBeLessThan(settingsIndex);
  });

  it('AI Assistant is positioned after Page Audits', () => {
    const aiIndex = NAV_ITEMS.findIndex((item) => item.label === 'AI Assistant');
    const pageAuditsIndex = NAV_ITEMS.findIndex((item) => item.label === 'Page Audits');
    expect(pageAuditsIndex).toBeGreaterThan(-1);
    expect(aiIndex).toBeGreaterThan(pageAuditsIndex);
  });
});
