// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// src/__tests__/unit/source-health-summary.test.tsx
// Sprint I: SourceHealthSummaryPanel + SourceHealthBadge tests
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SourceHealthSummaryPanel } from '@/app/dashboard/source-intelligence/_components/SourceHealthSummaryPanel';
import {
  SourceHealthBadge,
  deriveSourceHealth,
} from '@/app/dashboard/source-intelligence/_components/SourceHealthBadge';
import type {
  SourceIntelligenceResult,
  NormalizedSource,
  SourceAlert,
  SourceCategory,
} from '@/lib/services/source-intelligence.service';

function makeSource(overrides: Partial<NormalizedSource> = {}): NormalizedSource {
  return {
    name: 'example.com',
    url: 'https://example.com',
    category: 'other' as SourceCategory,
    engines: ['openai'],
    citationCount: 5,
    contexts: [],
    isCompetitorAlert: false,
    ...overrides,
  };
}

function makeResult(overrides: Partial<SourceIntelligenceResult> = {}): SourceIntelligenceResult {
  return {
    sources: [
      makeSource({ category: 'first_party' as SourceCategory, name: 'mysite.com' }),
      makeSource({ category: 'review_site' as SourceCategory, name: 'yelp.com' }),
      makeSource({ category: 'competitor' as SourceCategory, name: 'rival.com', isCompetitorAlert: true }),
    ],
    byEngine: {},
    categoryBreakdown: [
      { category: 'first_party' as SourceCategory, count: 1, percentage: 33 },
      { category: 'review_site' as SourceCategory, count: 1, percentage: 33 },
      { category: 'competitor' as SourceCategory, count: 1, percentage: 33 },
    ],
    firstPartyRate: 15,
    alerts: [],
    evaluationCount: 10,
    ...overrides,
  };
}

// ── SourceHealthBadge ──────────────────────────────────────────────────────

describe('deriveSourceHealth', () => {
  it('returns first_party for first_party category', () => {
    expect(deriveSourceHealth('first_party' as SourceCategory, false)).toBe('first_party');
  });

  it('returns competitor for competitor category', () => {
    expect(deriveSourceHealth('competitor' as SourceCategory, false)).toBe('competitor');
  });

  it('returns competitor when isCompetitorAlert is true regardless of category', () => {
    expect(deriveSourceHealth('other' as SourceCategory, true)).toBe('competitor');
  });

  it('returns review_site for review_site category', () => {
    expect(deriveSourceHealth('review_site' as SourceCategory, false)).toBe('review_site');
  });

  it('returns directory for directory category', () => {
    expect(deriveSourceHealth('directory' as SourceCategory, false)).toBe('directory');
  });

  it('returns other for unknown categories', () => {
    expect(deriveSourceHealth('blog' as SourceCategory, false)).toBe('other');
    expect(deriveSourceHealth('news' as SourceCategory, false)).toBe('other');
  });
});

describe('SourceHealthBadge', () => {
  it('renders first_party badge with correct text', () => {
    render(<SourceHealthBadge health="first_party" />);
    expect(screen.getByText('Your site')).toBeDefined();
  });

  it('renders competitor badge with correct text', () => {
    render(<SourceHealthBadge health="competitor" />);
    expect(screen.getByText('Competitor')).toBeDefined();
  });

  it('renders review_site badge with correct text', () => {
    render(<SourceHealthBadge health="review_site" />);
    expect(screen.getByText('Review site')).toBeDefined();
  });

  it('has data-testid with health type', () => {
    render(<SourceHealthBadge health="directory" />);
    expect(screen.getByTestId('source-health-badge-directory')).toBeDefined();
  });
});

// ── SourceHealthSummaryPanel ───────────────────────────────────────────────

describe('SourceHealthSummaryPanel', () => {
  it('renders the summary panel', () => {
    render(<SourceHealthSummaryPanel result={makeResult()} />);
    expect(screen.getByTestId('source-health-summary')).toBeDefined();
  });

  it('shows total source count in heading', () => {
    render(<SourceHealthSummaryPanel result={makeResult()} />);
    expect(screen.getByText(/3 sources teaching AI/)).toBeDefined();
  });

  it('shows first-party count in grid', () => {
    render(<SourceHealthSummaryPanel result={makeResult()} />);
    const fpCard = screen.getByTestId('source-count-first-party');
    expect(fpCard.textContent).toContain('1');
  });

  it('shows competitor count in grid', () => {
    render(<SourceHealthSummaryPanel result={makeResult()} />);
    const compCard = screen.getByTestId('source-count-competitor');
    expect(compCard.textContent).toContain('1');
  });

  it('shows first-party rate', () => {
    render(<SourceHealthSummaryPanel result={makeResult({ firstPartyRate: 25 })} />);
    expect(screen.getByText('25%')).toBeDefined();
  });

  it('shows clean verdict when no alerts and good first-party rate', () => {
    render(
      <SourceHealthSummaryPanel
        result={makeResult({ alerts: [], firstPartyRate: 25 })}
      />,
    );
    expect(screen.getByTestId('source-verdict-clean')).toBeDefined();
  });

  it('shows urgent verdict when high-severity alerts exist', () => {
    render(
      <SourceHealthSummaryPanel
        result={makeResult({
          alerts: [
            {
              type: 'competitor_content',
              severity: 'high',
              title: 'Competitor content',
              description: 'Test',
              source: null,
              recommendation: 'Fix it',
            },
          ],
        })}
      />,
    );
    expect(screen.getByTestId('source-verdict-urgent')).toBeDefined();
  });

  it('shows minor verdict when only medium alerts exist', () => {
    render(
      <SourceHealthSummaryPanel
        result={makeResult({
          alerts: [
            {
              type: 'missing_first_party',
              severity: 'medium',
              title: 'Low FP',
              description: 'Test',
              source: null,
              recommendation: 'Fix it',
            },
          ],
        })}
      />,
    );
    expect(screen.getByTestId('source-verdict-minor')).toBeDefined();
  });

  it('shows low first-party verdict when rate is low and no alerts', () => {
    render(
      <SourceHealthSummaryPanel
        result={makeResult({ alerts: [], firstPartyRate: 5 })}
      />,
    );
    expect(screen.getByTestId('source-verdict-low-fp')).toBeDefined();
  });
});
