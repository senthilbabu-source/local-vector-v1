// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// src/__tests__/unit/authority-panel.test.tsx — Sprint 108: AuthorityPanel Tests
//
// 10 tests covering the AuthorityPanel client component that renders entity
// authority score, tier breakdown, velocity, sameAs gaps, and recommendations.
//
// Run:
//   npx vitest run src/__tests__/unit/authority-panel.test.tsx
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('lucide-react', () => ({
  Shield: (props: Record<string, unknown>) => <span data-testid="icon-shield" {...props} />,
  RefreshCw: (props: Record<string, unknown>) => <span data-testid="icon-refresh" {...props} />,
  TrendingUp: (props: Record<string, unknown>) => <span data-testid="icon-trending-up" {...props} />,
  TrendingDown: (props: Record<string, unknown>) => <span data-testid="icon-trending-down" {...props} />,
  Minus: (props: Record<string, unknown>) => <span data-testid="icon-minus" {...props} />,
  ExternalLink: (props: Record<string, unknown>) => <span data-testid="icon-external-link" {...props} />,
}));

import AuthorityPanel from '@/app/dashboard/_components/AuthorityPanel';
import type { AuthorityStatusResponse } from '@/lib/authority/types';

// ---------------------------------------------------------------------------
// Mock API responses
// ---------------------------------------------------------------------------

const MOCK_STATUS_WITH_PROFILE: AuthorityStatusResponse = {
  profile: {
    location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    entity_authority_score: 58,
    dimensions: {
      tier1_citation_score: 15,
      tier2_coverage_score: 18,
      platform_breadth_score: 12,
      sameas_score: 8,
      velocity_score: 5,
    },
    tier_breakdown: { tier1: 2, tier2: 4, tier3: 3, unknown: 0 },
    top_citations: [],
    sameas_gaps: [
      {
        platform: 'wikidata',
        url: '',
        tier: 'tier2',
        already_in_schema: false,
        estimated_impact: 'high',
        action_label: 'Create Wikidata entity',
        action_instructions: 'Go to wikidata.org and create a new item.',
      },
    ],
    citation_velocity: 12.5,
    velocity_label: 'growing',
    snapshot_at: '2026-03-01T00:00:00Z',
    recommendations: [
      {
        priority: 1,
        category: 'tier1_citation',
        title: 'Get featured in local news',
        description: 'Reach out to Alpharetta local news outlets for a feature story about your business which will significantly boost authority.',
        estimated_score_gain: 15,
        effort: 'medium',
        action_type: 'outreach',
      },
      {
        priority: 2,
        category: 'sameas',
        title: 'Create Wikidata entity',
        description: 'Your business lacks a Wikidata entry. Creating one establishes entity identity across the knowledge graph.',
        estimated_score_gain: 8,
        effort: 'medium',
        action_type: 'add_sameas',
      },
    ],
  },
  history: [],
  last_run_at: '2026-03-01T00:00:00Z',
};

const MOCK_STATUS_NULL_PROFILE: AuthorityStatusResponse = {
  profile: null,
  history: [],
  last_run_at: null,
};

// ---------------------------------------------------------------------------
// Tests — 10 total
// ---------------------------------------------------------------------------

describe('AuthorityPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper: mock fetch to return a specific status response
  function mockFetch(statusResponse: AuthorityStatusResponse) {
    global.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as Request).url;

      if (url.includes('/api/authority/status')) {
        return {
          ok: true,
          json: () => Promise.resolve(statusResponse),
        };
      }

      if (url.includes('/api/authority/run')) {
        return { ok: true, json: () => Promise.resolve({ ok: true }) };
      }

      return { ok: false, json: () => Promise.resolve({}) };
    });
  }

  // 1
  it('renders null when isGrowthPlan is false', () => {
    mockFetch(MOCK_STATUS_WITH_PROFILE);
    const { container } = render(<AuthorityPanel isGrowthPlan={false} />);
    expect(container.innerHTML).toBe('');
  });

  // 2
  it('shows loading skeleton initially', () => {
    mockFetch(MOCK_STATUS_WITH_PROFILE);
    render(<AuthorityPanel isGrowthPlan={true} />);

    const panel = screen.getByTestId('authority-panel');
    expect(panel).toBeDefined();
    expect(panel.querySelector('.animate-pulse')).not.toBeNull();
  });

  // 3
  it('shows empty state when API returns profile: null', async () => {
    mockFetch(MOCK_STATUS_NULL_PROFILE);
    render(<AuthorityPanel isGrowthPlan={true} />);

    await waitFor(() => {
      expect(screen.getByText(/No authority data yet/)).toBeDefined();
    });

    // The Re-map Now button should still be available via data-testid
    expect(screen.getByTestId('authority-run-button')).toBeDefined();
  });

  // 4
  it('displays authority score badge (58/100 C)', async () => {
    mockFetch(MOCK_STATUS_WITH_PROFILE);
    render(<AuthorityPanel isGrowthPlan={true} />);

    await waitFor(() => {
      const scoreBadge = screen.getByTestId('authority-score');
      expect(scoreBadge).toBeDefined();
      expect(scoreBadge.textContent).toContain('58/100');
      expect(scoreBadge.textContent).toContain('C');
    });
  });

  // 5
  it('displays tier breakdown', async () => {
    mockFetch(MOCK_STATUS_WITH_PROFILE);
    render(<AuthorityPanel isGrowthPlan={true} />);

    await waitFor(() => {
      const breakdown = screen.getByTestId('authority-tier-breakdown');
      expect(breakdown).toBeDefined();
    });

    expect(screen.getByText('Tier 1 Citations')).toBeDefined();
    expect(screen.getByText('Tier 2 Coverage')).toBeDefined();
    expect(screen.getByText('Platform Breadth')).toBeDefined();
    expect(screen.getByText('sameAs Links')).toBeDefined();
    expect(screen.getByText('Velocity')).toBeDefined();
  });

  // 6
  it('displays velocity indicator', async () => {
    mockFetch(MOCK_STATUS_WITH_PROFILE);
    render(<AuthorityPanel isGrowthPlan={true} />);

    await waitFor(() => {
      const velocity = screen.getByTestId('authority-velocity');
      expect(velocity).toBeDefined();
    });

    // velocity_label: 'growing', citation_velocity: 12.5 -> rounds to 13
    const velocity = screen.getByTestId('authority-velocity');
    expect(velocity.textContent).toContain('Citations growing');
    expect(velocity.textContent).toContain('+13%');
  });

  // 7
  it('shows sameAs gaps section', async () => {
    mockFetch(MOCK_STATUS_WITH_PROFILE);
    render(<AuthorityPanel isGrowthPlan={true} />);

    await waitFor(() => {
      const gaps = screen.getByTestId('authority-sameas-gaps');
      expect(gaps).toBeDefined();
    });

    const gapsSection = screen.getByTestId('authority-sameas-gaps');
    expect(gapsSection.textContent).toContain('sameAs Gaps (1)');
    expect(gapsSection.textContent).toContain('Create Wikidata entity');
    expect(gapsSection.textContent).toContain('Impact: high');
  });

  // 8
  it('shows recommendations section', async () => {
    mockFetch(MOCK_STATUS_WITH_PROFILE);
    render(<AuthorityPanel isGrowthPlan={true} />);

    await waitFor(() => {
      const recs = screen.getByTestId('authority-recommendations');
      expect(recs).toBeDefined();
    });

    expect(screen.getByText('Top Recommendations')).toBeDefined();
    expect(screen.getByText('Get featured in local news')).toBeDefined();
    expect(screen.getByText('+15 pts estimated')).toBeDefined();
  });

  // 9
  it('Re-map Now button calls POST /api/authority/run', async () => {
    mockFetch(MOCK_STATUS_WITH_PROFILE);
    render(<AuthorityPanel isGrowthPlan={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('authority-run-button')).toBeDefined();
    });

    const button = screen.getByTestId('authority-run-button');
    fireEvent.click(button);

    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const postCalls = calls.filter((call: unknown[]) => {
        const url = typeof call[0] === 'string' ? call[0] : (call[0] as Request).url;
        return url.includes('/api/authority/run');
      });
      expect(postCalls.length).toBe(1);
      const opts = postCalls[0][1] as RequestInit | undefined;
      expect(opts?.method).toBe('POST');
    });
  });

  // 10
  it('handles fetch error gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    render(<AuthorityPanel isGrowthPlan={true} />);

    // Should not crash; after fetch fails, loading ends and empty state shows
    await waitFor(() => {
      const panel = screen.getByTestId('authority-panel');
      expect(panel).toBeDefined();
      expect(panel.querySelector('.animate-pulse')).toBeNull();
    });

    expect(screen.getByText(/No authority data yet/)).toBeDefined();
  });
});
