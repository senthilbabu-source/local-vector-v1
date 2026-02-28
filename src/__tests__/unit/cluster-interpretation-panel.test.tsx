// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// src/__tests__/unit/cluster-interpretation-panel.test.tsx — Sprint J
// Tests for ClusterInterpretationPanel component
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClusterInterpretationPanel } from '@/app/dashboard/cluster-map/_components/ClusterInterpretationPanel';
import type { ClusterMapResult, ClusterMapPoint } from '@/lib/services/cluster-map.service';

// Mock InfoTooltip
vi.mock('@/components/ui/InfoTooltip', () => ({
  InfoTooltip: ({ content }: { content: string }) => (
    <span data-testid="info-tooltip">{content}</span>
  ),
}));

function makeSelfPoint(overrides: Partial<ClusterMapPoint> = {}): ClusterMapPoint {
  return {
    id: 'self',
    name: 'Charcoal N Chill',
    brandAuthority: 80,
    factAccuracy: 72,
    sov: 0.45,
    type: 'self',
    citationCount: 8,
    totalQueries: 10,
    ...overrides,
  };
}

function makeCompetitor(name: string, authority: number): ClusterMapPoint {
  return {
    id: `competitor-${name.toLowerCase().replace(/\s/g, '-')}`,
    name,
    brandAuthority: authority,
    factAccuracy: 80,
    sov: authority / 100,
    type: 'competitor',
    citationCount: Math.round(authority / 10),
    totalQueries: 10,
  };
}

function makeResult(overrides: Partial<ClusterMapResult> = {}): ClusterMapResult {
  const self = makeSelfPoint();
  const comp1 = makeCompetitor('Lips Hookah Lounge', 90);
  const comp2 = makeCompetitor('Cloud Nine Hookah', 60);

  return {
    points: [self, comp1, comp2],
    hallucinationZones: [],
    selfPoint: self,
    availableEngines: ['all', 'openai', 'perplexity'],
    activeFilter: 'all',
    stats: {
      totalCompetitors: 2,
      totalQueries: 10,
      hallucinationCount: 0,
      dominantEngine: 'openai',
    },
    ...overrides,
  };
}

describe('ClusterInterpretationPanel', () => {
  it('renders interpretation panel container', () => {
    render(<ClusterInterpretationPanel data={makeResult()} />);
    expect(screen.getByTestId('cluster-interpretation-panel')).toBeDefined();
  });

  it('shows no-data message when selfPoint is null', () => {
    render(<ClusterInterpretationPanel data={makeResult({ selfPoint: null })} />);
    expect(screen.getByTestId('cluster-interpretation-panel').textContent).toContain(
      'No data',
    );
  });

  // Position interpretation
  it('shows mention rate stat', () => {
    render(<ClusterInterpretationPanel data={makeResult()} />);
    expect(screen.getByTestId('cluster-stat-mentions')).toBeDefined();
    expect(screen.getByTestId('cluster-stat-mentions').textContent).toContain('80%');
  });

  it('shows accuracy stat', () => {
    render(<ClusterInterpretationPanel data={makeResult()} />);
    expect(screen.getByTestId('cluster-stat-accuracy')).toBeDefined();
    expect(screen.getByTestId('cluster-stat-accuracy').textContent).toContain('72%');
  });

  it('shows competitor count stat', () => {
    render(<ClusterInterpretationPanel data={makeResult()} />);
    expect(screen.getByTestId('cluster-stat-competitors')).toBeDefined();
    expect(screen.getByTestId('cluster-stat-competitors').textContent).toContain('2');
  });

  // Top competitor callout
  it('shows top competitor name', () => {
    render(<ClusterInterpretationPanel data={makeResult()} />);
    expect(screen.getByTestId('cluster-top-competitor')).toBeDefined();
    expect(screen.getByTestId('cluster-top-competitor').textContent).toContain(
      'Lips Hookah Lounge',
    );
  });

  it('shows top competitor mention rate comparison', () => {
    render(<ClusterInterpretationPanel data={makeResult()} />);
    // Lips is at 90%, self at 80% → "10% more often than you"
    expect(screen.getByTestId('cluster-top-competitor').textContent).toContain(
      '10% more often than you',
    );
  });

  it('shows "you\'re mentioned more" when self has higher authority', () => {
    const self = makeSelfPoint({ brandAuthority: 90 });
    const comp = makeCompetitor('Weak Competitor', 50);
    render(<ClusterInterpretationPanel data={makeResult({
      points: [self, comp],
      selfPoint: self,
      stats: { totalCompetitors: 1, totalQueries: 10, hallucinationCount: 0, dominantEngine: 'openai' },
    })} />);
    expect(screen.getByTestId('cluster-top-competitor').textContent).toContain(
      'you\'re mentioned',
    );
  });

  // Verdict text varies by position
  it('high mention + high accuracy shows positive verdict', () => {
    const self = makeSelfPoint({ brandAuthority: 80, factAccuracy: 80 });
    render(<ClusterInterpretationPanel data={makeResult({ selfPoint: self, points: [self] })} />);
    expect(screen.getByTestId('cluster-interpretation-verdict').textContent).toContain(
      'frequently',
    );
    expect(screen.getByTestId('cluster-interpretation-verdict').textContent).toContain(
      'mostly accurate',
    );
  });

  it('high mention + low accuracy shows danger warning', () => {
    const self = makeSelfPoint({ brandAuthority: 60, factAccuracy: 40 });
    render(<ClusterInterpretationPanel data={makeResult({
      selfPoint: self,
      points: [self],
      stats: { totalCompetitors: 0, totalQueries: 10, hallucinationCount: 3, dominantEngine: 'openai' },
    })} />);
    expect(screen.getByTestId('cluster-interpretation-verdict').textContent).toContain(
      'wrong',
    );
  });

  it('low mention + high accuracy shows invisible warning', () => {
    const self = makeSelfPoint({ brandAuthority: 20, factAccuracy: 85 });
    render(<ClusterInterpretationPanel data={makeResult({
      selfPoint: self,
      points: [self],
      stats: { totalCompetitors: 0, totalQueries: 10, hallucinationCount: 0, dominantEngine: null },
    })} />);
    expect(screen.getByTestId('cluster-interpretation-verdict').textContent).toContain(
      'only mentions you in 20%',
    );
  });

  // No jargon
  it('interpretation text contains no banned jargon', () => {
    const banned = [
      'semantic', 'embedding', 'cluster centrality', 'vector distance',
      'cosine similarity', 'latent space', 'brand authority', 'fact accuracy',
    ];

    render(<ClusterInterpretationPanel data={makeResult()} />);
    const text = screen.getByTestId('cluster-interpretation-panel').textContent!.toLowerCase();
    for (const word of banned) {
      expect(text).not.toContain(word.toLowerCase());
    }
  });

  it('hides top competitor when no competitors exist', () => {
    const self = makeSelfPoint();
    render(<ClusterInterpretationPanel data={makeResult({
      points: [self],
      selfPoint: self,
      stats: { totalCompetitors: 0, totalQueries: 10, hallucinationCount: 0, dominantEngine: null },
    })} />);
    expect(screen.queryByTestId('cluster-top-competitor')).toBeNull();
  });
});
