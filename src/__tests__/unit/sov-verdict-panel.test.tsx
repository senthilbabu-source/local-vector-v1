// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// src/__tests__/unit/sov-verdict-panel.test.tsx — Sprint H: SOVVerdictPanel tests
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SOVVerdictPanel from '@/app/dashboard/share-of-voice/_components/SOVVerdictPanel';

describe('SOVVerdictPanel', () => {
  it('renders currentPct as large number when not null', () => {
    render(
      <SOVVerdictPanel
        currentPct={34}
        previousPct={null}
        topCompetitor={null}
        totalQueries={10}
      />,
    );
    expect(screen.getByText('34%')).toBeDefined();
  });

  it('positive delta shown in green (signal-green class)', () => {
    const { container } = render(
      <SOVVerdictPanel
        currentPct={40}
        previousPct={28}
        topCompetitor={null}
        totalQueries={10}
      />,
    );
    const delta = screen.getByTestId('sov-verdict-delta');
    expect(delta.textContent).toContain('+12');
    expect(delta.className).toContain('text-signal-green');
  });

  it('negative delta shown in red (alert-crimson class)', () => {
    render(
      <SOVVerdictPanel
        currentPct={20}
        previousPct={35}
        topCompetitor={null}
        totalQueries={10}
      />,
    );
    const delta = screen.getByTestId('sov-verdict-delta');
    expect(delta.textContent).toContain('-15');
    expect(delta.className).toContain('text-alert-crimson');
  });

  it('no delta shown when previousPct is null', () => {
    render(
      <SOVVerdictPanel
        currentPct={34}
        previousPct={null}
        topCompetitor={null}
        totalQueries={10}
      />,
    );
    expect(screen.queryByTestId('sov-verdict-delta')).toBeNull();
  });

  it('competitor context shown when topCompetitor is provided', () => {
    render(
      <SOVVerdictPanel
        currentPct={34}
        previousPct={null}
        topCompetitor={{ name: 'Cloud 9 Lounge', mentionCount: 3 }}
        totalQueries={10}
      />,
    );
    expect(screen.getByTestId('sov-competitor-verdict')).toBeDefined();
    expect(screen.getByText('Cloud 9 Lounge')).toBeDefined();
  });

  it('competitor context uses green styling when mentions <= half of queries', () => {
    const { container } = render(
      <SOVVerdictPanel
        currentPct={50}
        previousPct={null}
        topCompetitor={{ name: 'Rival', mentionCount: 3 }}
        totalQueries={10}
      />,
    );
    const verdict = screen.getByTestId('sov-competitor-verdict');
    expect(verdict.className).toContain('signal-green');
  });

  it('competitor context uses amber styling when mentions > half of queries', () => {
    render(
      <SOVVerdictPanel
        currentPct={30}
        previousPct={null}
        topCompetitor={{ name: 'Rival', mentionCount: 7 }}
        totalQueries={10}
      />,
    );
    const verdict = screen.getByTestId('sov-competitor-verdict');
    expect(verdict.className).toContain('alert-amber');
  });

  it('data-testid="sov-competitor-verdict" on competitor section', () => {
    render(
      <SOVVerdictPanel
        currentPct={34}
        previousPct={null}
        topCompetitor={{ name: 'Rival', mentionCount: 5 }}
        totalQueries={10}
      />,
    );
    expect(screen.getByTestId('sov-competitor-verdict')).toBeDefined();
  });

  it('competitor section hidden when topCompetitor is null', () => {
    render(
      <SOVVerdictPanel
        currentPct={34}
        previousPct={null}
        topCompetitor={null}
        totalQueries={10}
      />,
    );
    expect(screen.queryByTestId('sov-competitor-verdict')).toBeNull();
  });

  it('data-testid="sov-verdict-no-data" rendered when currentPct is null', () => {
    render(
      <SOVVerdictPanel
        currentPct={null}
        previousPct={null}
        topCompetitor={null}
        totalQueries={0}
      />,
    );
    expect(screen.getByTestId('sov-verdict-no-data')).toBeDefined();
  });

  it('verdict panel hidden when currentPct is null', () => {
    render(
      <SOVVerdictPanel
        currentPct={null}
        previousPct={null}
        topCompetitor={null}
        totalQueries={0}
      />,
    );
    expect(screen.queryByTestId('sov-verdict-panel')).toBeNull();
  });
});
