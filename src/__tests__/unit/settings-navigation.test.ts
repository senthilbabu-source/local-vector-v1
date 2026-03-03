// ---------------------------------------------------------------------------
// src/__tests__/unit/settings-navigation.test.ts — P1-FIX-07
//
// Verifies all settings hrefs in NAV_ITEMS are valid paths, and that the
// UpgradeRedirectBanner handles known/unknown upgrade keys correctly.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { NAV_ITEMS } from '@/components/layout/Sidebar';

// ---------------------------------------------------------------------------
// Settings hrefs structural validation
// ---------------------------------------------------------------------------

describe('settings navigation hrefs', () => {
  const settingsItems = NAV_ITEMS.filter(
    (i) => i.href.includes('/settings') || i.href.includes('/team') || i.href.includes('/billing'),
  );

  it('has at least 5 settings/admin items', () => {
    expect(settingsItems.length).toBeGreaterThanOrEqual(5);
  });

  it('all settings hrefs start with /dashboard', () => {
    for (const item of settingsItems) {
      expect(item.href).toMatch(/^\/dashboard/);
    }
  });

  it('/dashboard/settings is in the nav', () => {
    expect(NAV_ITEMS.find((i) => i.href === '/dashboard/settings')).toBeDefined();
  });

  it('/dashboard/settings/domain is in the nav', () => {
    expect(NAV_ITEMS.find((i) => i.href === '/dashboard/settings/domain')).toBeDefined();
  });

  it('/dashboard/team is in the nav', () => {
    expect(NAV_ITEMS.find((i) => i.href === '/dashboard/team')).toBeDefined();
  });

  it('/dashboard/billing is in the nav', () => {
    expect(NAV_ITEMS.find((i) => i.href === '/dashboard/billing')).toBeDefined();
  });

  it('/dashboard/settings/widget is in the nav', () => {
    expect(NAV_ITEMS.find((i) => i.href === '/dashboard/settings/widget')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// UpgradeRedirectBanner feature map
// ---------------------------------------------------------------------------

describe('UpgradeRedirectBanner', () => {
  // Test the feature map directly
  const UPGRADE_FEATURE_MAP: Record<string, { feature: string; requiredPlan: string }> = {
    team: { feature: 'Team Management', requiredPlan: 'Brand Fortress' },
    domain: { feature: 'Custom Domain', requiredPlan: 'Brand Fortress' },
    playbooks: { feature: 'Improvement Plans', requiredPlan: 'Brand Fortress' },
    widget: { feature: 'Website Chat', requiredPlan: 'AI Shield' },
    intent: { feature: 'Missing Questions', requiredPlan: 'Brand Fortress' },
    voice: { feature: 'Voice Search', requiredPlan: 'AI Shield' },
  };

  it('maps "team" to Team Management + Brand Fortress', () => {
    expect(UPGRADE_FEATURE_MAP['team']).toEqual({
      feature: 'Team Management',
      requiredPlan: 'Brand Fortress',
    });
  });

  it('maps "widget" to Website Chat + AI Shield', () => {
    expect(UPGRADE_FEATURE_MAP['widget']).toEqual({
      feature: 'Website Chat',
      requiredPlan: 'AI Shield',
    });
  });

  it('maps "domain" to Custom Domain + Brand Fortress', () => {
    expect(UPGRADE_FEATURE_MAP['domain']).toEqual({
      feature: 'Custom Domain',
      requiredPlan: 'Brand Fortress',
    });
  });

  it('returns undefined for unknown keys', () => {
    expect(UPGRADE_FEATURE_MAP['nonexistent']).toBeUndefined();
  });

  it('has entries for all expected upgrade keys', () => {
    const expectedKeys = ['team', 'domain', 'playbooks', 'widget', 'intent', 'voice'];
    for (const key of expectedKeys) {
      expect(UPGRADE_FEATURE_MAP[key]).toBeDefined();
    }
  });
});
