// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// src/__tests__/unit/metric-card-links.test.tsx
//
// Sprint A (H5): Validates MetricCard href prop behavior.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock recharts to avoid DOM/SVG issues in test environment
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => children,
  Line: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => children,
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import MetricCard from '@/app/dashboard/_components/MetricCard';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe('H5 — MetricCard href prop', () => {
  it('when href is provided, renders a link wrapping the card', () => {
    render(<MetricCard label="Open alerts" value={3} href="/dashboard/hallucinations" />);
    const link = screen.getByTestId('metric-card-link');
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe('/dashboard/hallucinations');
  });

  it('when href is not provided, does not render a link wrapper', () => {
    render(<MetricCard label="Open alerts" value={3} />);
    const links = screen.queryByTestId('metric-card-link');
    expect(links).toBeNull();
  });

  it('when href is provided, the Link href attribute matches the passed prop', () => {
    render(<MetricCard label="AI Visibility" value="42%" href="/dashboard/share-of-voice" />);
    const link = screen.getByTestId('metric-card-link');
    expect(link.getAttribute('href')).toBe('/dashboard/share-of-voice');
  });

  it('hover class is applied when href is provided', () => {
    render(<MetricCard label="Open alerts" value={3} href="/dashboard/hallucinations" />);
    const link = screen.getByTestId('metric-card-link');
    const hoverWrapper = link.firstElementChild;
    expect(hoverWrapper?.className).toContain('group-hover:shadow-md');
    expect(hoverWrapper?.className).toContain('group-hover:-translate-y-px');
  });

  it('no hover wrapper when href is absent', () => {
    const { container } = render(<MetricCard label="Open alerts" value={3} />);
    // Without href, the root element is the card div, not a link wrapper
    const rootDiv = container.firstElementChild as HTMLElement;
    expect(rootDiv?.className).toContain('rounded-xl');
    expect(rootDiv?.className).not.toContain('group-hover:shadow-md');
  });
});
