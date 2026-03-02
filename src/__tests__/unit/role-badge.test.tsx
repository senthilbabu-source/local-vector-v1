/**
 * RoleBadge Component Tests — Sprint 111
 *
 * 5 tests covering all 4 role colors + capitalized text.
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RoleBadge from '@/app/dashboard/team/_components/RoleBadge';

describe('RoleBadge component', () => {
  it('renders owner with indigo class', () => {
    render(<RoleBadge role="owner" data-testid="badge" />);
    const badge = screen.getByTestId('badge');
    expect(badge.className).toContain('bg-indigo-500/15');
    expect(badge.className).toContain('text-indigo-300');
  });

  it('renders admin with blue class', () => {
    render(<RoleBadge role="admin" data-testid="badge" />);
    const badge = screen.getByTestId('badge');
    expect(badge.className).toContain('bg-blue-500/15');
    expect(badge.className).toContain('text-blue-300');
  });

  it('renders analyst with green class', () => {
    render(<RoleBadge role="analyst" data-testid="badge" />);
    const badge = screen.getByTestId('badge');
    expect(badge.className).toContain('bg-green-500/15');
    expect(badge.className).toContain('text-green-300');
  });

  it('renders viewer with slate class', () => {
    render(<RoleBadge role="viewer" data-testid="badge" />);
    const badge = screen.getByTestId('badge');
    expect(badge.className).toContain('bg-slate-500/15');
    expect(badge.className).toContain('text-slate-300');
  });

  it('renders role text capitalized', () => {
    render(<RoleBadge role="admin" data-testid="badge" />);
    const badge = screen.getByTestId('badge');
    expect(badge.textContent).toBe('Admin');
  });
});
