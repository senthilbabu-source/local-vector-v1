// @vitest-environment jsdom
/**
 * DashboardShell / Sidebar / TopBar — Component Tests
 *
 * Covers:
 *   • DashboardShell renders dynamic displayName + orgName from mocked props
 *   • Mobile hamburger menu toggles sidebarOpen state (translate-x classes)
 *   • Active route highlighting in Sidebar via mocked usePathname()
 *   • TopBar hamburger fires onMenuToggle callback
 *
 * Project rules honoured:
 *   TAILWIND LITERALS — class assertions use exact literal strings
 *   ZERO LIVE APIS    — no external calls (MSW guards them in setup.ts)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before vi.mock() calls so the factory
// closures can reference them. vi.hoisted() runs at the same time as vi.mock().
// ---------------------------------------------------------------------------

const mockUsePathname = vi.hoisted(() => vi.fn<[], string>(() => '/dashboard'));

// ---------------------------------------------------------------------------
// Module mocks (hoisted automatically by Vitest)
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

// next/link — render a plain <a>, forwarding className so active-state tests
// can assert on the Tailwind classes Sidebar applies to the Link element.
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => React.createElement('a', { href, onClick, className }, children),
}));

// LogoutButton — Sidebar dependency; not under test here
vi.mock('@/app/dashboard/_components/LogoutButton', () => ({
  default: () =>
    React.createElement('button', { 'data-testid': 'logout-btn' }, 'Sign out'),
}));

// ---------------------------------------------------------------------------
// Import components AFTER mocks (vitest hoisting ensures mocks are ready)
// ---------------------------------------------------------------------------

import DashboardShell from '@/components/layout/DashboardShell';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const DEFAULT_PROPS = {
  displayName: 'Jane Doe',
  orgName: 'Charcoal N Chill',
  plan: 'growth' as string | null,
};

// ---------------------------------------------------------------------------
// DashboardShell tests
// ---------------------------------------------------------------------------

describe('DashboardShell', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/dashboard');
  });

  it('renders the displayName passed as prop (visible in sidebar footer)', () => {
    render(
      <DashboardShell {...DEFAULT_PROPS}>
        <p>page content</p>
      </DashboardShell>,
    );
    // Sidebar renders displayName in its footer user-info <p>
    expect(screen.getByText('Jane Doe')).toBeDefined();
  });

  it('renders orgName in sidebar header (org subtitle)', () => {
    render(
      <DashboardShell {...DEFAULT_PROPS}>
        <p>page content</p>
      </DashboardShell>,
    );
    // orgName appears in at least one element (sidebar brand + topbar breadcrumb)
    const matches = screen.getAllByText('Charcoal N Chill');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('renders children inside the main content area', () => {
    render(
      <DashboardShell {...DEFAULT_PROPS}>
        <p data-testid="child-content">Dashboard page</p>
      </DashboardShell>,
    );
    expect(screen.getByTestId('child-content')).toBeDefined();
  });

  it('sidebar aside starts with -translate-x-full (closed on mobile)', () => {
    const { container } = render(
      <DashboardShell {...DEFAULT_PROPS}>
        <span />
      </DashboardShell>,
    );
    const aside = container.querySelector('aside');
    expect(aside?.className).toContain('-translate-x-full');
  });

  it('clicking the hamburger opens the sidebar (removes -translate-x-full)', () => {
    const { container } = render(
      <DashboardShell {...DEFAULT_PROPS}>
        <span />
      </DashboardShell>,
    );
    const hamburger = screen.getByRole('button', {
      name: /open navigation menu/i,
    });
    fireEvent.click(hamburger);

    const aside = container.querySelector('aside');
    // sidebarOpen=true → Sidebar receives isOpen=true → translate-x-0, not -translate-x-full
    expect(aside?.className).not.toContain('-translate-x-full');
    expect(aside?.className).toContain('translate-x-0');
  });

  it('clicking the hamburger twice closes the sidebar again', () => {
    const { container } = render(
      <DashboardShell {...DEFAULT_PROPS}>
        <span />
      </DashboardShell>,
    );
    const hamburger = screen.getByRole('button', {
      name: /open navigation menu/i,
    });
    fireEvent.click(hamburger); // open
    fireEvent.click(hamburger); // close

    const aside = container.querySelector('aside');
    expect(aside?.className).toContain('-translate-x-full');
  });

  it('mobile overlay backdrop appears when sidebar is open', () => {
    const { container } = render(
      <DashboardShell {...DEFAULT_PROPS}>
        <span />
      </DashboardShell>,
    );

    // Before click — no overlay div with bg-black/60
    const overlayBefore = Array.from(container.querySelectorAll('div')).find(
      (el) => el.className.includes('bg-black/60'),
    );
    expect(overlayBefore).toBeUndefined();

    fireEvent.click(
      screen.getByRole('button', { name: /open navigation menu/i }),
    );

    // After click — overlay appears
    const overlayAfter = Array.from(container.querySelectorAll('div')).find(
      (el) => el.className.includes('bg-black/60'),
    );
    expect(overlayAfter).toBeDefined();
  });

  it('clicking the overlay backdrop closes the sidebar', () => {
    const { container } = render(
      <DashboardShell {...DEFAULT_PROPS}>
        <span />
      </DashboardShell>,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /open navigation menu/i }),
    );

    const overlay = Array.from(container.querySelectorAll('div')).find((el) =>
      el.className.includes('bg-black/60'),
    ) as HTMLElement;
    fireEvent.click(overlay);

    const aside = container.querySelector('aside');
    expect(aside?.className).toContain('-translate-x-full');
  });
});

// ---------------------------------------------------------------------------
// Sidebar — active route highlighting tests
// ---------------------------------------------------------------------------

describe('Sidebar — active route highlighting', () => {
  it('highlights Dashboard link when pathname is /dashboard (exact match)', () => {
    mockUsePathname.mockReturnValue('/dashboard');
    const { container } = render(
      <Sidebar
        isOpen={false}
        onClose={vi.fn()}
        displayName="Jane Doe"
        orgName="Charcoal N Chill"
      />,
    );
    const dashboardLink = container.querySelector('a[href="/dashboard"]');
    // Active state: bg-electric-indigo/15 + text-electric-indigo
    expect(dashboardLink?.className).toContain('bg-electric-indigo/15');
    expect(dashboardLink?.className).toContain('text-electric-indigo');
  });

  it('does NOT highlight Dashboard link on /dashboard/magic-menus (exact:true)', () => {
    mockUsePathname.mockReturnValue('/dashboard/magic-menus');
    const { container } = render(
      <Sidebar
        isOpen={false}
        onClose={vi.fn()}
        displayName="Jane"
        orgName="Org"
      />,
    );
    const dashboardLink = container.querySelector('a[href="/dashboard"]');
    // Dashboard nav uses exact:true — sub-route must NOT activate it
    expect(dashboardLink?.className).not.toContain('bg-electric-indigo/15');
  });

  it('highlights Menu link on /dashboard/magic-menus (startsWith match)', () => {
    mockUsePathname.mockReturnValue('/dashboard/magic-menus');
    const { container } = render(
      <Sidebar
        isOpen={false}
        onClose={vi.fn()}
        displayName="Jane"
        orgName="Org"
      />,
    );
    const menuLink = container.querySelector('a[href="/dashboard/magic-menus"]');
    expect(menuLink?.className).toContain('bg-electric-indigo/15');
  });

  it('highlights Menu link on a nested sub-route /dashboard/magic-menus/abc', () => {
    mockUsePathname.mockReturnValue('/dashboard/magic-menus/abc123');
    const { container } = render(
      <Sidebar
        isOpen={false}
        onClose={vi.fn()}
        displayName="Jane"
        orgName="Org"
      />,
    );
    const menuLink = container.querySelector('a[href="/dashboard/magic-menus"]');
    expect(menuLink?.className).toContain('bg-electric-indigo/15');
  });

  it('displays displayName in sidebar footer user-info', () => {
    mockUsePathname.mockReturnValue('/dashboard');
    render(
      <Sidebar
        isOpen={false}
        onClose={vi.fn()}
        displayName="Jane Doe"
        orgName="My Org"
      />,
    );
    expect(screen.getByText('Jane Doe')).toBeDefined();
  });

  it('displays AI Visibility Score badge (98/100)', () => {
    mockUsePathname.mockReturnValue('/dashboard');
    render(
      <Sidebar
        isOpen={false}
        onClose={vi.fn()}
        displayName="Jane"
        orgName="Org"
      />,
    );
    expect(screen.getByText('98/100')).toBeDefined();
  });

  it('renders with translate-x-0 class when isOpen=true', () => {
    mockUsePathname.mockReturnValue('/dashboard');
    const { container } = render(
      <Sidebar
        isOpen={true}
        onClose={vi.fn()}
        displayName="Jane"
        orgName="Org"
      />,
    );
    const aside = container.querySelector('aside');
    expect(aside?.className).toContain('translate-x-0');
    expect(aside?.className).not.toContain('-translate-x-full');
  });

  it('renders with -translate-x-full class when isOpen=false', () => {
    mockUsePathname.mockReturnValue('/dashboard');
    const { container } = render(
      <Sidebar
        isOpen={false}
        onClose={vi.fn()}
        displayName="Jane"
        orgName="Org"
      />,
    );
    const aside = container.querySelector('aside');
    expect(aside?.className).toContain('-translate-x-full');
  });
});

// ---------------------------------------------------------------------------
// TopBar tests
// ---------------------------------------------------------------------------

describe('TopBar', () => {
  it('calls onMenuToggle when hamburger button is clicked', () => {
    const onMenuToggle = vi.fn();
    render(
      <TopBar
        onMenuToggle={onMenuToggle}
        orgName="Charcoal N Chill"
        displayName="Jane Doe"
        plan="growth"
      />,
    );
    const hamburger = screen.getByRole('button', {
      name: /open navigation menu/i,
    });
    fireEvent.click(hamburger);
    expect(onMenuToggle).toHaveBeenCalledTimes(1);
  });

  it('does not call onMenuToggle until clicked', () => {
    const onMenuToggle = vi.fn();
    render(
      <TopBar
        onMenuToggle={onMenuToggle}
        orgName="Org"
        displayName="Jane"
        plan={null}
      />,
    );
    expect(onMenuToggle).not.toHaveBeenCalled();
  });

  it('renders orgName as mobile breadcrumb text', () => {
    render(
      <TopBar
        onMenuToggle={vi.fn()}
        orgName="Charcoal N Chill"
        displayName="Jane"
        plan={null}
      />,
    );
    // orgName renders in both mobile breadcrumb and desktop center
    const matches = screen.getAllByText('Charcoal N Chill');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders plan badge when plan is provided', () => {
    render(
      <TopBar
        onMenuToggle={vi.fn()}
        orgName="Org"
        displayName="Jane"
        plan="growth"
      />,
    );
    expect(screen.getByText('growth')).toBeDefined();
  });

  it('does not render plan badge when plan is null', () => {
    render(
      <TopBar
        onMenuToggle={vi.fn()}
        orgName="Org"
        displayName="Jane"
        plan={null}
      />,
    );
    expect(screen.queryByText('growth')).toBeNull();
  });

  it('plan badge has electric-indigo styling when plan is present', () => {
    render(
      <TopBar
        onMenuToggle={vi.fn()}
        orgName="Org"
        displayName="Jane"
        plan="growth"
      />,
    );
    const badge = screen.getByText('growth');
    // TAILWIND LITERALS — exact class token per project rule 5
    expect(badge.className).toContain('text-electric-indigo');
  });
});
