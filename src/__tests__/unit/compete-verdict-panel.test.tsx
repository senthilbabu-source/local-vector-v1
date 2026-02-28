// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// src/__tests__/unit/compete-verdict-panel.test.tsx — Sprint H: CompeteVerdictPanel tests
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CompeteVerdictPanel from '@/app/dashboard/compete/_components/CompeteVerdictPanel';

describe('CompeteVerdictPanel', () => {
  it('renders nothing when totalIntercepts is 0', () => {
    const { container } = render(
      <CompeteVerdictPanel winCount={0} lossCount={0} totalIntercepts={0} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows winning count in green when wins > 0', () => {
    render(
      <CompeteVerdictPanel winCount={3} lossCount={1} totalIntercepts={4} />,
    );
    const panel = screen.getByTestId('compete-verdict-panel');
    expect(panel.textContent).toContain('Winning 3 matchups');
    expect(panel.innerHTML).toContain('signal-green');
  });

  it('shows losing count in amber when losses > 0', () => {
    render(
      <CompeteVerdictPanel winCount={1} lossCount={2} totalIntercepts={3} />,
    );
    const panel = screen.getByTestId('compete-verdict-panel');
    expect(panel.textContent).toContain('Losing 2 matchups');
    expect(panel.innerHTML).toContain('alert-amber');
  });

  it('shows gap-closing advice when losing', () => {
    render(
      <CompeteVerdictPanel winCount={1} lossCount={2} totalIntercepts={3} />,
    );
    expect(screen.getByText(/fix your hallucination alerts/)).toBeDefined();
  });

  it('shows leading message when all wins', () => {
    render(
      <CompeteVerdictPanel winCount={3} lossCount={0} totalIntercepts={3} />,
    );
    expect(screen.getByText(/leading across the board/)).toBeDefined();
  });

  it('uses singular "matchup" when count is 1', () => {
    render(
      <CompeteVerdictPanel winCount={1} lossCount={0} totalIntercepts={1} />,
    );
    const panel = screen.getByTestId('compete-verdict-panel');
    expect(panel.textContent).toContain('Winning 1 matchup');
    expect(panel.textContent).not.toContain('matchups');
  });

  it('data-testid="compete-verdict-panel" on root', () => {
    render(
      <CompeteVerdictPanel winCount={2} lossCount={1} totalIntercepts={3} />,
    );
    expect(screen.getByTestId('compete-verdict-panel')).toBeDefined();
  });

  it('shows separator dot between wins and losses', () => {
    render(
      <CompeteVerdictPanel winCount={2} lossCount={1} totalIntercepts={3} />,
    );
    const panel = screen.getByTestId('compete-verdict-panel');
    expect(panel.textContent).toContain('·');
  });
});
