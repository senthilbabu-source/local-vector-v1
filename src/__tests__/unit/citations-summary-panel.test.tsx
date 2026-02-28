// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// src/__tests__/unit/citations-summary-panel.test.tsx — Sprint H: CitationsSummaryPanel tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CitationsSummaryPanel from '@/app/dashboard/citations/_components/CitationsSummaryPanel';

// Mock InfoTooltip (Radix popover doesn't render well in jsdom)
vi.mock('@/components/ui/InfoTooltip', () => ({
  InfoTooltip: ({ content }: { content: string }) => (
    <span data-testid="info-tooltip-trigger" title={typeof content === 'string' ? content : ''}>?</span>
  ),
}));

describe('CitationsSummaryPanel', () => {
  it('renders total platforms count', () => {
    render(
      <CitationsSummaryPanel
        totalPlatforms={8}
        coveredCount={5}
        gapCount={3}
        gapScore={62}
      />,
    );
    expect(screen.getByText('8')).toBeDefined();
    expect(screen.getByText('platforms AI cites')).toBeDefined();
  });

  it('renders covered count in green', () => {
    render(
      <CitationsSummaryPanel
        totalPlatforms={8}
        coveredCount={5}
        gapCount={3}
        gapScore={62}
      />,
    );
    const covered = screen.getByTestId('citations-count-covered');
    expect(covered.textContent).toContain('5');
    expect(covered.textContent).toContain('Listed');
  });

  it('renders gap count with crimson styling when > 0', () => {
    render(
      <CitationsSummaryPanel
        totalPlatforms={8}
        coveredCount={5}
        gapCount={3}
        gapScore={62}
      />,
    );
    const gaps = screen.getByTestId('citations-count-gaps');
    expect(gaps.textContent).toContain('3');
    expect(gaps.innerHTML).toContain('alert-crimson');
  });

  it('renders gap score', () => {
    render(
      <CitationsSummaryPanel
        totalPlatforms={8}
        coveredCount={5}
        gapCount={3}
        gapScore={62}
      />,
    );
    const gapScore = screen.getByTestId('citations-gap-score');
    expect(gapScore.textContent).toContain('62');
  });

  it('shows healthy verdict when gapCount is 0', () => {
    render(
      <CitationsSummaryPanel
        totalPlatforms={5}
        coveredCount={5}
        gapCount={0}
        gapScore={100}
      />,
    );
    expect(screen.getByTestId('citations-verdict-healthy')).toBeDefined();
  });

  it('shows gaps verdict when gapCount > 0', () => {
    render(
      <CitationsSummaryPanel
        totalPlatforms={8}
        coveredCount={5}
        gapCount={3}
        gapScore={62}
      />,
    );
    expect(screen.getByTestId('citations-verdict-gaps')).toBeDefined();
  });

  it('gap verdict includes count of missing platforms', () => {
    render(
      <CitationsSummaryPanel
        totalPlatforms={8}
        coveredCount={5}
        gapCount={3}
        gapScore={62}
      />,
    );
    expect(screen.getByText(/3 platforms where you're not listed/)).toBeDefined();
  });

  it('data-testid="citations-summary-panel" on root', () => {
    render(
      <CitationsSummaryPanel
        totalPlatforms={5}
        coveredCount={5}
        gapCount={0}
        gapScore={100}
      />,
    );
    expect(screen.getByTestId('citations-summary-panel')).toBeDefined();
  });
});
