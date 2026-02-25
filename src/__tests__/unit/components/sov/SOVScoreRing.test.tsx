// @vitest-environment jsdom
/**
 * SOVScoreRing — Component Tests (Doc 06 §8.2)
 *
 * Covers:
 *   - Renders calculating state when shareOfVoice is null
 *   - Renders percentage and ring when data provided
 *   - Shows green ring for >= 40%, amber 20-39%, crimson < 20%
 *   - Shows delta arrow (green up, red down)
 *   - Shows citation rate metric
 *
 * Project rules honoured:
 *   TAILWIND LITERALS — class assertions use exact literal strings
 *   ZERO LIVE APIS    — pure component, no external calls
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import SOVScoreRing from '@/app/dashboard/share-of-voice/_components/SOVScoreRing';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SOVScoreRing', () => {
  it('renders calculating state when shareOfVoice is null', () => {
    render(
      <SOVScoreRing
        shareOfVoice={null}
        citationRate={null}
        weekOverWeekDelta={null}
      />,
    );

    expect(screen.getByTestId('sov-score-ring')).toBeDefined();
    expect(screen.getByText(/first AI visibility scan runs Sunday/i)).toBeDefined();
    // No percentage should be rendered
    expect(screen.queryByTestId('sov-percentage')).toBeNull();
  });

  it('renders percentage when data is provided', () => {
    render(
      <SOVScoreRing
        shareOfVoice={45.5}
        citationRate={30}
        weekOverWeekDelta={0.05}
      />,
    );

    expect(screen.getByTestId('sov-percentage')).toBeDefined();
    expect(screen.getByTestId('sov-percentage').textContent).toBe('46%');
  });

  it('shows green color for SOV >= 40%', () => {
    render(
      <SOVScoreRing
        shareOfVoice={55}
        citationRate={null}
        weekOverWeekDelta={null}
      />,
    );

    const pctEl = screen.getByTestId('sov-percentage');
    expect(pctEl.className).toContain('text-signal-green');
  });

  it('shows amber color for SOV 20-39%', () => {
    render(
      <SOVScoreRing
        shareOfVoice={25}
        citationRate={null}
        weekOverWeekDelta={null}
      />,
    );

    const pctEl = screen.getByTestId('sov-percentage');
    expect(pctEl.className).toContain('text-amber-400');
  });

  it('shows crimson color for SOV < 20%', () => {
    render(
      <SOVScoreRing
        shareOfVoice={10}
        citationRate={null}
        weekOverWeekDelta={null}
      />,
    );

    const pctEl = screen.getByTestId('sov-percentage');
    expect(pctEl.className).toContain('text-alert-crimson');
  });

  it('shows upward green delta arrow for positive change', () => {
    render(
      <SOVScoreRing
        shareOfVoice={50}
        citationRate={null}
        weekOverWeekDelta={0.05}
      />,
    );

    const deltaEl = screen.getByTestId('sov-delta');
    expect(deltaEl.textContent).toContain('\u25B2'); // ▲
    expect(deltaEl.textContent).toContain('5%');
    // Second span is the colored value (first is the label)
    const valueSpan = deltaEl.querySelectorAll('span')[1]!;
    expect(valueSpan.className).toContain('text-signal-green');
  });

  it('shows downward red delta arrow for negative change', () => {
    render(
      <SOVScoreRing
        shareOfVoice={50}
        citationRate={null}
        weekOverWeekDelta={-0.03}
      />,
    );

    const deltaEl = screen.getByTestId('sov-delta');
    expect(deltaEl.textContent).toContain('\u25BC'); // ▼
    expect(deltaEl.textContent).toContain('3%');
    const valueSpan = deltaEl.querySelectorAll('span')[1]!;
    expect(valueSpan.className).toContain('text-alert-crimson');
  });

  it('hides delta section when weekOverWeekDelta is null', () => {
    render(
      <SOVScoreRing
        shareOfVoice={50}
        citationRate={25}
        weekOverWeekDelta={null}
      />,
    );

    expect(screen.queryByTestId('sov-delta')).toBeNull();
  });

  it('shows citation rate when provided', () => {
    render(
      <SOVScoreRing
        shareOfVoice={50}
        citationRate={75}
        weekOverWeekDelta={null}
      />,
    );

    expect(screen.getByText('Citation Rate')).toBeDefined();
    expect(screen.getByText('75%')).toBeDefined();
  });

  it('shows dash for citation rate when null', () => {
    render(
      <SOVScoreRing
        shareOfVoice={50}
        citationRate={null}
        weekOverWeekDelta={null}
      />,
    );

    expect(screen.getByText('Citation Rate')).toBeDefined();
    // The em-dash is rendered for null citation
    const citationContainer = screen.getByText('Citation Rate').parentElement!;
    expect(citationContainer.textContent).toContain('—');
  });
});
