// ---------------------------------------------------------------------------
// wave5-s30-ai-response-teaser.test.tsx — S30 (§233)
//
// Component tests for AIResponseTeaser (jsdom).
// Run: npx vitest run src/__tests__/unit/wave5-s30-ai-response-teaser.test.tsx
// ---------------------------------------------------------------------------

// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AIResponseTeaser from '@/app/dashboard/_components/AIResponseTeaser';
import type { AIResponseSnippet } from '@/lib/services/ai-response-summary';

// Mock next/link as a plain anchor
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const freshResponse: AIResponseSnippet = {
  snippet: 'Charcoal N Chill is a popular BBQ restaurant in Alpharetta known for brisket.',
  engine: 'perplexity-sonar',
  timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
};

const staleResponse: AIResponseSnippet = {
  snippet: 'This restaurant serves great food.',
  engine: 'gpt-4o-mini',
  timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
};

describe('S30 — AIResponseTeaser', () => {
  it('renders snippet text', () => {
    render(<AIResponseTeaser response={freshResponse} />);
    expect(screen.getByText(/Charcoal N Chill/)).toBeTruthy();
  });

  it('links to /dashboard/ai-responses', () => {
    render(<AIResponseTeaser response={freshResponse} />);
    const link = screen.getByTestId('ai-response-teaser');
    expect(link.getAttribute('href')).toBe('/dashboard/ai-responses');
  });

  it('shows engine name badge', () => {
    render(<AIResponseTeaser response={freshResponse} />);
    expect(screen.getByText('perplexity-sonar')).toBeTruthy();
  });

  it('shows time ago for fresh response', () => {
    render(<AIResponseTeaser response={freshResponse} />);
    expect(screen.getByText('2 days ago')).toBeTruthy();
  });

  it('renders nothing when response is null', () => {
    const { container } = render(<AIResponseTeaser response={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing in sample mode', () => {
    const { container } = render(<AIResponseTeaser response={freshResponse} sampleMode />);
    expect(container.innerHTML).toBe('');
  });

  it('shows stale warning when > 7 days', () => {
    render(<AIResponseTeaser response={staleResponse} />);
    expect(screen.getByTestId('stale-warning')).toBeTruthy();
  });

  it('does not show stale warning for fresh response', () => {
    render(<AIResponseTeaser response={freshResponse} />);
    expect(screen.queryByTestId('stale-warning')).toBeNull();
  });
});
