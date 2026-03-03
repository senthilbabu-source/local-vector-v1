// @vitest-environment jsdom

/**
 * TopBar Plan Badge Tests — P0-FIX-01
 *
 * 5 tests verifying the plan badge uses getPlanDisplayName()
 * to show marketing names instead of raw DB enum values.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock next/navigation (TopBar doesn't use it but it's often in scope)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/dashboard',
}));

import TopBar from '@/components/layout/TopBar';

const defaultProps = {
  onMenuToggle: vi.fn(),
  orgName: 'Test Org',
  displayName: 'Test User',
};

describe('TopBar plan badge', () => {
  it('renders "AI Shield" for plan="growth"', () => {
    render(<TopBar {...defaultProps} plan="growth" />);
    expect(screen.getByText('AI Shield')).toBeDefined();
  });

  it('renders "Brand Fortress" for plan="agency"', () => {
    render(<TopBar {...defaultProps} plan="agency" />);
    expect(screen.getByText('Brand Fortress')).toBeDefined();
  });

  it('renders "The Audit" for plan="trial"', () => {
    render(<TopBar {...defaultProps} plan="trial" />);
    expect(screen.getByText('The Audit')).toBeDefined();
  });

  it('renders "Starter" for plan="starter"', () => {
    render(<TopBar {...defaultProps} plan="starter" />);
    expect(screen.getByText('Starter')).toBeDefined();
  });

  it('does not render plan badge when plan is null', () => {
    render(<TopBar {...defaultProps} plan={null} />);
    // None of the plan display names should appear
    expect(screen.queryByText('The Audit')).toBeNull();
    expect(screen.queryByText('Starter')).toBeNull();
    expect(screen.queryByText('AI Shield')).toBeNull();
    expect(screen.queryByText('Brand Fortress')).toBeNull();
  });
});
