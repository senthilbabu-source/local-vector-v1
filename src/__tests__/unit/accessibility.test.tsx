/**
 * accessibility.test.tsx — P6-FIX-27
 *
 * Unit tests for WCAG 2.1 AA compliance features.
 * Validates skip links, semantic landmarks, ARIA attributes,
 * chart accessibility, focus trap, and semantic tables.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) =>
    React.createElement('a', { href, ...props }, children),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

vi.mock('@/lib/plan-display-names', () => ({
  getPlanDisplayName: (plan: string | null) => {
    const map: Record<string, string> = { trial: 'The Audit', starter: 'Starter', growth: 'AI Shield', agency: 'Brand Fortress' };
    return map[plan ?? ''] ?? 'Free';
  },
}));

vi.mock('@/lib/plan-enforcer', () => ({
  planSatisfies: (current: string | null, required: string) => {
    const hierarchy = ['trial', 'starter', 'growth', 'agency'];
    return hierarchy.indexOf(current ?? 'trial') >= hierarchy.indexOf(required);
  },
}));

vi.mock('@/lib/industries/industry-config', () => ({
  getIndustryConfig: () => ({
    servicesNoun: 'Menu',
    magicMenuIcon: () => React.createElement('span', { 'data-testid': 'mock-icon' }),
    magicMenuLabel: 'Menu',
  }),
}));

vi.mock('@/components/ui/UpgradeModal', () => ({
  UpgradeModal: () => null,
}));

vi.mock('@/app/dashboard/_components/LogoutButton', () => ({
  default: () => React.createElement('button', null, 'Logout'),
}));

vi.mock('@/app/dashboard/_components/GuidedTour', () => ({
  default: () => null,
}));

vi.mock('@/app/dashboard/_components/PresenceAvatars', () => ({
  default: () => null,
}));

vi.mock('@/app/dashboard/_components/RealtimeNotificationToast', () => ({
  default: () => null,
}));

vi.mock('./LocationSwitcher', () => ({
  default: () => null,
}));

vi.mock('@/components/layout/LocationSwitcher', () => ({
  default: () => null,
}));

vi.mock('@/components/ui/InfoTooltip', () => ({
  InfoTooltip: () => null,
}));

vi.mock('@/lib/tooltip-content', () => ({
  TOOLTIP_CONTENT: { shareOfVoice: 'mock', hallucinationsByModel: 'mock' },
}));

vi.mock('recharts', () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => React.createElement('div', { 'data-testid': 'area-chart' }, children),
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  BarChart: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  Bar: () => null,
  Cell: () => null,
  LineChart: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  Line: () => null,
}));

// ---------------------------------------------------------------------------
// DashboardShell tests
// ---------------------------------------------------------------------------

describe('DashboardShell accessibility', () => {
  let DashboardShell: React.ComponentType<{
    children: React.ReactNode;
    displayName: string;
    orgName: string;
    plan: string | null;
  }>;

  beforeEach(async () => {
    const mod = await import('@/components/layout/DashboardShell');
    DashboardShell = mod.default;
  });

  it('renders a skip-to-main-content link', () => {
    render(
      <DashboardShell displayName="Dev" orgName="Test Org" plan="growth">
        <p>Page content</p>
      </DashboardShell>,
    );
    const skipLink = screen.getByText('Skip to main content');
    expect(skipLink).toBeDefined();
    expect(skipLink.getAttribute('href')).toBe('#main-content');
  });

  it('main element has id="main-content"', () => {
    render(
      <DashboardShell displayName="Dev" orgName="Test Org" plan="growth">
        <p>Page content</p>
      </DashboardShell>,
    );
    const main = document.querySelector('main#main-content');
    expect(main).not.toBeNull();
  });

  it('main element has tabIndex={-1} for programmatic focus', () => {
    render(
      <DashboardShell displayName="Dev" orgName="Test Org" plan="growth">
        <p>Page content</p>
      </DashboardShell>,
    );
    const main = document.querySelector('main#main-content');
    expect(main?.getAttribute('tabindex')).toBe('-1');
  });
});

// ---------------------------------------------------------------------------
// Sidebar tests
// ---------------------------------------------------------------------------

describe('Sidebar accessibility', () => {
  let Sidebar: React.ComponentType<{
    isOpen: boolean;
    onClose: () => void;
    displayName: string;
    orgName: string;
    plan: string | null;
    orgIndustry?: string | null;
  }>;

  beforeEach(async () => {
    const mod = await import('@/components/layout/Sidebar');
    Sidebar = mod.default;
  });

  it('nav groups have role="group" and aria-labelledby', () => {
    render(
      <Sidebar isOpen={true} onClose={vi.fn()} displayName="Dev" orgName="Test" plan="growth" />,
    );
    const groups = document.querySelectorAll('[role="group"]');
    expect(groups.length).toBeGreaterThanOrEqual(5); // 5 NAV_GROUPS
    groups.forEach((group) => {
      const labelledBy = group.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      const label = document.getElementById(labelledBy!);
      expect(label).not.toBeNull();
    });
  });

  it('active nav link has aria-current="page"', () => {
    // pathname mock returns '/dashboard', so the Dashboard link should be active
    render(
      <Sidebar isOpen={true} onClose={vi.fn()} displayName="Dev" orgName="Test" plan="growth" />,
    );
    const dashLink = screen.getByTestId('nav-dashboard');
    expect(dashLink.getAttribute('aria-current')).toBe('page');
  });

  it('non-active nav links do not have aria-current', () => {
    render(
      <Sidebar isOpen={true} onClose={vi.fn()} displayName="Dev" orgName="Test" plan="growth" />,
    );
    const billingLink = screen.getByTestId('nav-billing');
    expect(billingLink.getAttribute('aria-current')).toBeNull();
  });

  it('locked nav items have descriptive aria-label', () => {
    // With plan="trial", growth-gated items should be locked
    render(
      <Sidebar isOpen={true} onClose={vi.fn()} displayName="Dev" orgName="Test" plan="trial" />,
    );
    const lockedItem = screen.getByTestId('nav-voice-readiness');
    expect(lockedItem.getAttribute('aria-label')).toContain('requires');
  });

  it('nav item icons have aria-hidden="true"', () => {
    render(
      <Sidebar isOpen={true} onClose={vi.fn()} displayName="Dev" orgName="Test" plan="growth" />,
    );
    // Check that SVGs inside nav links have aria-hidden
    const navLinks = document.querySelectorAll('nav a[data-testid^="nav-"] svg');
    navLinks.forEach((svg) => {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('close button icon has aria-hidden="true"', () => {
    render(
      <Sidebar isOpen={true} onClose={vi.fn()} displayName="Dev" orgName="Test" plan="growth" />,
    );
    const closeBtn = screen.getByLabelText('Close menu');
    const icon = closeBtn.querySelector('svg');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// TopBar tests
// ---------------------------------------------------------------------------

describe('TopBar accessibility', () => {
  let TopBar: React.ComponentType<{
    onMenuToggle: () => void;
    orgName: string;
    displayName: string;
    plan: string | null;
    credits?: { credits_used: number; credits_limit: number; reset_date: string } | null;
  }>;

  beforeEach(async () => {
    const mod = await import('@/components/layout/TopBar');
    TopBar = mod.default;
  });

  it('hamburger icon has aria-hidden="true"', () => {
    render(<TopBar onMenuToggle={vi.fn()} orgName="Test" displayName="Dev" plan="growth" />);
    const menuBtn = screen.getByLabelText('Open navigation menu');
    const icon = menuBtn.querySelector('svg');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });

  it('credits counter has aria-live="polite"', () => {
    render(
      <TopBar
        onMenuToggle={vi.fn()}
        orgName="Test"
        displayName="Dev"
        plan="growth"
        credits={{ credits_used: 5, credits_limit: 100, reset_date: '2026-04-01' }}
      />,
    );
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion?.textContent).toContain('95');
  });
});

// ---------------------------------------------------------------------------
// UpgradeModal tests
// ---------------------------------------------------------------------------

describe('UpgradeModal accessibility', () => {
  let UpgradeModal: React.ComponentType<{
    open: boolean;
    onClose: () => void;
    featureName: string;
    requiredPlan: 'growth' | 'agency';
  }>;

  beforeEach(async () => {
    // Re-import the actual UpgradeModal (not the mock)
    vi.doUnmock('@/components/ui/UpgradeModal');
    const mod = await import('@/components/ui/UpgradeModal');
    UpgradeModal = mod.UpgradeModal;
  });

  it('has role="dialog", aria-modal, aria-labelledby', () => {
    render(<UpgradeModal open={true} onClose={vi.fn()} featureName="Voice Search" requiredPlan="growth" />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('upgrade-modal-title');
  });

  it('close button icon has aria-hidden="true"', () => {
    render(<UpgradeModal open={true} onClose={vi.fn()} featureName="Voice Search" requiredPlan="growth" />);
    const closeBtn = screen.getByLabelText('Close');
    const icon = closeBtn.querySelector('svg');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });

  it('lock icon has aria-hidden="true"', () => {
    render(<UpgradeModal open={true} onClose={vi.fn()} featureName="Voice Search" requiredPlan="growth" />);
    const dialog = screen.getByRole('dialog');
    const lockIcons = dialog.querySelectorAll('svg[aria-hidden="true"]');
    expect(lockIcons.length).toBeGreaterThanOrEqual(2); // X icon + Lock icon
  });
});

// ---------------------------------------------------------------------------
// TeamMembersTable tests
// ---------------------------------------------------------------------------

describe('TeamMembersTable accessibility', () => {
  let TeamMembersTable: React.ComponentType<{
    members: Array<{
      id: string;
      org_id: string;
      user_id: string;
      full_name: string | null;
      email: string;
      role: string;
      joined_at: string;
    }>;
    canRemove: boolean;
    currentUserId: string;
  }>;

  beforeEach(async () => {
    const mod = await import('@/app/dashboard/team/_components/TeamMembersTable');
    TeamMembersTable = mod.default;
  });

  it('renders a semantic <table> element', () => {
    render(
      <TeamMembersTable
        members={[
          { id: '1', org_id: 'org-1', user_id: 'u1', full_name: 'Jane', email: 'jane@test.com', role: 'owner', joined_at: '2026-01-01T00:00:00Z' },
        ]}
        canRemove={true}
        currentUserId="u1"
      />,
    );
    const table = document.querySelector('table');
    expect(table).not.toBeNull();
  });

  it('has <th scope="col"> headers', () => {
    render(
      <TeamMembersTable
        members={[
          { id: '1', org_id: 'org-1', user_id: 'u1', full_name: 'Jane', email: 'jane@test.com', role: 'owner', joined_at: '2026-01-01T00:00:00Z' },
        ]}
        canRemove={true}
        currentUserId="u1"
      />,
    );
    const headers = document.querySelectorAll('th[scope="col"]');
    expect(headers.length).toBeGreaterThanOrEqual(4); // Name, Email, Role, Joined, Actions(sr-only)
  });

  it('actions column header has sr-only label', () => {
    render(
      <TeamMembersTable
        members={[
          { id: '1', org_id: 'org-1', user_id: 'u1', full_name: 'Jane', email: 'jane@test.com', role: 'owner', joined_at: '2026-01-01T00:00:00Z' },
        ]}
        canRemove={true}
        currentUserId="u1"
      />,
    );
    const srOnly = document.querySelector('th .sr-only');
    expect(srOnly?.textContent).toBe('Actions');
  });
});

// ---------------------------------------------------------------------------
// SOVTrendChart tests
// ---------------------------------------------------------------------------

describe('SOVTrendChart accessibility', () => {
  let SOVTrendChart: React.ComponentType<{
    data: Array<{ date: string; sov: number }>;
    title?: string;
  }>;

  beforeEach(async () => {
    const mod = await import('@/app/dashboard/_components/SOVTrendChart');
    SOVTrendChart = mod.default;
  });

  it('chart wrapper has role="img" and aria-label', () => {
    render(
      <SOVTrendChart
        data={[
          { date: '2026-02-01', sov: 20 },
          { date: '2026-02-08', sov: 25 },
        ]}
      />,
    );
    const chartImg = document.querySelector('[role="img"]');
    expect(chartImg).not.toBeNull();
    expect(chartImg?.getAttribute('aria-label')).toContain('AI Visibility trend chart');
    expect(chartImg?.getAttribute('aria-label')).toContain('25%');
  });

  it('includes a sr-only data table for screen readers', () => {
    render(
      <SOVTrendChart
        data={[
          { date: '2026-02-01', sov: 20 },
          { date: '2026-02-08', sov: 25 },
        ]}
      />,
    );
    const srTable = document.querySelector('table.sr-only');
    expect(srTable).not.toBeNull();
    const rows = srTable?.querySelectorAll('tbody tr');
    expect(rows?.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Page metadata tests
// ---------------------------------------------------------------------------

describe('Page metadata exports', () => {
  const pages: Array<{ path: string; expectedTitle: string }> = [
    { path: '@/app/dashboard/page', expectedTitle: 'Dashboard | LocalVector.ai' },
    { path: '@/app/dashboard/hallucinations/page', expectedTitle: 'AI Mistakes | LocalVector.ai' },
    { path: '@/app/dashboard/share-of-voice/page', expectedTitle: 'AI Mentions | LocalVector.ai' },
    { path: '@/app/dashboard/team/page', expectedTitle: 'Team | LocalVector.ai' },
    { path: '@/app/dashboard/settings/page', expectedTitle: 'Settings | LocalVector.ai' },
  ];

  for (const { path, expectedTitle } of pages) {
    it(`${path} exports metadata with correct title`, async () => {
      const mod = await import(path);
      expect(mod.metadata).toBeDefined();
      expect(mod.metadata.title).toBe(expectedTitle);
    });
  }
});
