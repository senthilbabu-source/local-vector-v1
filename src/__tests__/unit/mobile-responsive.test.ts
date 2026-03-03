/**
 * Unit Tests — Mobile Responsiveness Audit (P6-FIX-28)
 *
 * Verifies responsive CSS classes are present on key layout components:
 * - Tables have overflow-x-auto for horizontal scroll
 * - Modals have padding on backdrop for mobile viewport safety
 * - Grids use responsive breakpoints
 *
 * Run:
 *   npx vitest run src/__tests__/unit/mobile-responsive.test.ts
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function readComponent(relativePath: string): string {
  const fullPath = join(process.cwd(), relativePath);
  if (!existsSync(fullPath)) return '';
  return readFileSync(fullPath, 'utf-8');
}

describe('Mobile responsiveness — Tables (P6-FIX-28)', () => {
  it('TeamMembersTable has overflow-x-auto for horizontal scroll', () => {
    const content = readComponent('app/dashboard/team/_components/TeamMembersTable.tsx');
    expect(content).toContain('overflow-x-auto');
  });

  it('PendingInvitationsTable has overflow-x-auto for horizontal scroll', () => {
    const content = readComponent('app/dashboard/team/_components/PendingInvitationsTable.tsx');
    expect(content).toContain('overflow-x-auto');
  });

  it('ActivityLogTable has overflow-x-auto for horizontal scroll', () => {
    const content = readComponent('app/dashboard/team/_components/ActivityLogTable.tsx');
    expect(content).toContain('overflow-x-auto');
  });

  it('PlanComparisonTable has overflow-x-auto for horizontal scroll', () => {
    const content = readComponent('app/dashboard/billing/_components/PlanComparisonTable.tsx');
    expect(content).toContain('overflow-x-auto');
  });
});

describe('Mobile responsiveness — Modals (P6-FIX-28)', () => {
  it('InviteMemberModal backdrop has p-4 padding', () => {
    const content = readComponent('app/dashboard/team/_components/InviteMemberModal.tsx');
    // Modal backdrop should have p-4 for mobile viewport safety
    expect(content).toMatch(/fixed inset-0.*p-4/);
  });

  it('ListingFixModal backdrop has p-4 padding', () => {
    const content = readComponent('app/dashboard/_components/ListingFixModal.tsx');
    expect(content).toMatch(/fixed inset-0.*p-4/);
  });

  it('SimulationResultsModal backdrop has p-4 padding', () => {
    const content = readComponent('app/dashboard/_components/SimulationResultsModal.tsx');
    expect(content).toMatch(/fixed inset-0.*p-4/);
  });

  it('UpgradeModal has mx-4 for mobile margin', () => {
    const content = readComponent('components/ui/UpgradeModal.tsx');
    expect(content).toContain('mx-4');
  });

  it('DangerZone modals have p-4 padding on backdrop', () => {
    const content = readComponent('app/dashboard/settings/_components/DangerZoneSettings.tsx');
    // Both delete modals should have mobile-safe padding
    const matches = content.match(/fixed inset-0.*p-4/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Mobile responsiveness — Grids (P6-FIX-28)', () => {
  it('Dashboard stat panel grid is responsive', () => {
    const content = readComponent('app/dashboard/page.tsx');
    // Should use responsive grid: grid-cols-1 then sm:grid-cols-2 then xl:grid-cols-4
    expect(content).toContain('grid-cols-1');
    expect(content).toMatch(/sm:grid-cols-2|md:grid-cols-2/);
  });

  it('AddLocationModal city/state/zip grid is responsive', () => {
    const content = readComponent('app/dashboard/locations/_components/AddLocationModal.tsx');
    // Should have sm:grid-cols-5 (not just grid-cols-5)
    expect(content).toContain('sm:grid-cols-5');
  });

  it('TeamMembersTable hides columns on mobile', () => {
    const content = readComponent('app/dashboard/team/_components/TeamMembersTable.tsx');
    // "Joined" column hidden on mobile
    expect(content).toContain('hidden sm:block');
  });

  it('PendingInvitationsTable hides columns on mobile', () => {
    const content = readComponent('app/dashboard/team/_components/PendingInvitationsTable.tsx');
    // "Invited By" and "Expires" columns hidden on mobile
    expect(content).toContain('hidden sm:block');
  });
});

describe('Mobile responsiveness — Layout (P6-FIX-28)', () => {
  it('Sidebar is off-screen on mobile and visible on desktop', () => {
    const content = readComponent('components/layout/Sidebar.tsx');
    // Sidebar uses translate to hide on mobile, lg:translate-x-0 to show on desktop
    expect(content).toContain('-translate-x-full');
    expect(content).toContain('lg:translate-x-0');
  });

  it('TopBar has hamburger button for mobile', () => {
    const content = readComponent('components/layout/TopBar.tsx');
    expect(content).toMatch(/lg:hidden|md:hidden/);
  });

  it('Main content area has responsive padding', () => {
    const content = readComponent('components/layout/DashboardShell.tsx');
    expect(content).toMatch(/p-4\s+(sm|md):p-6/);
  });
});
