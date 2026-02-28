// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('@/components/ui/InfoTooltip', () => ({
  InfoTooltip: ({ content }: { content: string }) => (
    <button data-testid="info-tooltip-trigger" aria-label={content}>i</button>
  ),
}));

import WrongFactsPanel from '@/app/dashboard/_components/panels/WrongFactsPanel';

describe('WrongFactsPanel', () => {
  it('renders alertCount as a large number', () => {
    render(<WrongFactsPanel alertCount={5} previousCount={null} />);
    expect(screen.getByTestId('wrong-facts-count').textContent).toBe('5');
  });

  it('when alertCount === 0: shows green color and "No wrong facts detected" text', () => {
    render(<WrongFactsPanel alertCount={0} previousCount={null} />);
    const count = screen.getByTestId('wrong-facts-count');
    expect(count.className).toContain('emerald');
    expect(screen.getByTestId('wrong-facts-clear').textContent).toContain('No wrong facts detected');
  });

  it('when alertCount > 0: shows red/crimson color', () => {
    render(<WrongFactsPanel alertCount={3} previousCount={null} />);
    const count = screen.getByTestId('wrong-facts-count');
    expect(count.className).toContain('crimson');
  });

  it('entire panel is a link to /dashboard/hallucinations', () => {
    render(<WrongFactsPanel alertCount={2} previousCount={null} />);
    const link = screen.getByTestId('wrong-facts-panel');
    expect(link.getAttribute('href')).toBe('/dashboard/hallucinations');
  });

  it('renders InfoTooltip trigger', () => {
    render(<WrongFactsPanel alertCount={0} previousCount={null} />);
    expect(screen.getByTestId('info-tooltip-trigger')).toBeDefined();
  });
});
