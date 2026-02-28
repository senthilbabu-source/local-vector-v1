// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// src/__tests__/unit/entity-health-verdict-panel.test.tsx — Sprint J
// Tests for EntityHealthVerdictPanel component
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EntityHealthVerdictPanel } from '@/app/dashboard/entity-health/_components/EntityHealthVerdictPanel';
import type { EntityHealthResult } from '@/lib/services/entity-health.service';

// Mock InfoTooltip
vi.mock('@/components/ui/InfoTooltip', () => ({
  InfoTooltip: ({ content }: { content: string }) => (
    <span data-testid="info-tooltip">{content}</span>
  ),
}));

function makeResult(overrides: Partial<EntityHealthResult> = {}): EntityHealthResult {
  return {
    platforms: [],
    confirmedCount: 4,
    totalPlatforms: 6,
    score: 67,
    rating: 'at_risk',
    recommendations: [],
    ...overrides,
  };
}

describe('EntityHealthVerdictPanel', () => {
  it('renders verdict panel container', () => {
    render(<EntityHealthVerdictPanel result={makeResult()} />);
    expect(screen.getByTestId('entity-health-verdict-panel')).toBeDefined();
  });

  it('shows confirmed count out of total', () => {
    render(<EntityHealthVerdictPanel result={makeResult({ confirmedCount: 5, totalPlatforms: 6 })} />);
    expect(screen.getByTestId('entity-health-overall-score').textContent).toBe('5/6');
  });

  // Strong rating
  it('strong rating shows positive verdict', () => {
    render(<EntityHealthVerdictPanel result={makeResult({
      confirmedCount: 5,
      totalPlatforms: 6,
      score: 83,
      rating: 'strong',
    })} />);
    expect(screen.getByTestId('entity-health-verdict-text').textContent).toContain(
      'verified information',
    );
  });

  it('strong rating with all confirmed shows all-confirmed text', () => {
    render(<EntityHealthVerdictPanel result={makeResult({
      confirmedCount: 6,
      totalPlatforms: 6,
      score: 100,
      rating: 'strong',
    })} />);
    expect(screen.getByTestId('entity-health-verdict-text').textContent).toContain(
      'All core platforms',
    );
  });

  // At risk rating
  it('at_risk rating shows needs-attention verdict', () => {
    render(<EntityHealthVerdictPanel result={makeResult({
      confirmedCount: 3,
      totalPlatforms: 6,
      score: 50,
      rating: 'at_risk',
    })} />);
    const verdict = screen.getByTestId('entity-health-verdict-text').textContent!;
    expect(verdict).toContain('3 sources');
    expect(verdict).toContain('missing or unclaimed');
  });

  // Critical rating
  it('critical rating shows urgent verdict', () => {
    render(<EntityHealthVerdictPanel result={makeResult({
      confirmedCount: 1,
      totalPlatforms: 6,
      score: 17,
      rating: 'critical',
    })} />);
    const verdict = screen.getByTestId('entity-health-verdict-text').textContent!;
    expect(verdict).toContain('don\'t have verified information');
    expect(verdict).toContain('incorrect or incomplete');
  });

  // Unknown rating
  it('unknown rating shows checklist prompt', () => {
    render(<EntityHealthVerdictPanel result={makeResult({
      confirmedCount: 0,
      totalPlatforms: 6,
      score: 0,
      rating: 'unknown',
    })} />);
    expect(screen.getByTestId('entity-health-verdict-panel').textContent).toContain(
      'haven\'t checked',
    );
  });

  // No jargon in verdicts
  it('verdict text contains no banned jargon', () => {
    const banned = ['knowledge graph', 'entity', 'ontological', 'semantic'];
    const ratings: EntityHealthResult['rating'][] = ['strong', 'at_risk', 'critical', 'unknown'];

    for (const rating of ratings) {
      const { unmount } = render(
        <EntityHealthVerdictPanel result={makeResult({ rating, confirmedCount: 3 })} />,
      );
      const text = screen.getByTestId('entity-health-verdict-panel').textContent!.toLowerCase();
      for (const word of banned) {
        expect(text).not.toContain(word);
      }
      unmount();
    }
  });

  it('shows score percentage in summary', () => {
    render(<EntityHealthVerdictPanel result={makeResult({ score: 67 })} />);
    expect(screen.getByTestId('entity-health-verdict-panel').textContent).toContain('67%');
  });

  it('shows needs-action count when platforms missing', () => {
    render(<EntityHealthVerdictPanel result={makeResult({ confirmedCount: 4, totalPlatforms: 6 })} />);
    expect(screen.getByTestId('entity-health-verdict-panel').textContent).toContain('2 need');
  });
});
