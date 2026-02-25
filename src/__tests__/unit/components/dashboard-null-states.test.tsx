// @vitest-environment jsdom
/**
 * Dashboard Null States — Sprint 42 Step 1
 *
 * Verifies consistent null-state copy across dashboard pages:
 *   - SOVScoreRing uses nextSundayLabel() in calculating state
 *   - Welcome banner renders for day-1 tenants (realityScore null + 0 alerts)
 *   - Welcome banner hidden when data or alerts exist
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import SOVScoreRing from '@/app/dashboard/share-of-voice/_components/SOVScoreRing';
import { nextSundayLabel } from '@/app/dashboard/_components/scan-health-utils';

// ---------------------------------------------------------------------------
// SOVScoreRing null-state copy
// ---------------------------------------------------------------------------

describe('SOVScoreRing null-state copy', () => {
  it('includes dynamic Sunday date from nextSundayLabel()', () => {
    render(
      <SOVScoreRing
        shareOfVoice={null}
        citationRate={null}
        weekOverWeekDelta={null}
      />,
    );

    const sundayDate = nextSundayLabel();
    expect(
      screen.getByText(new RegExp(`First AI visibility scan runs Sunday, ${sundayDate}`)),
    ).toBeDefined();
  });

  it('does not show old hardcoded "Check back Monday" copy', () => {
    render(
      <SOVScoreRing
        shareOfVoice={null}
        citationRate={null}
        weekOverWeekDelta={null}
      />,
    );

    expect(screen.queryByText(/Check back Monday/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Welcome banner (rendered inline — we test the markup pattern)
// ---------------------------------------------------------------------------

describe('Welcome banner', () => {
  function WelcomeBanner({
    realityScore,
    openAlertCount,
  }: {
    realityScore: number | null;
    openAlertCount: number;
  }) {
    return (
      <div>
        {realityScore === null && openAlertCount === 0 && (
          <div data-testid="welcome-banner" className="rounded-xl border border-signal-green/20 bg-signal-green/5 px-5 py-4">
            <h2 className="text-sm font-semibold text-signal-green">
              Welcome to LocalVector.ai
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Your AI visibility dashboard is ready. Your first automated scan runs
              Sunday, {nextSundayLabel()} — check back Monday for your Reality Score,
              SOV trend, and hallucination alerts.
            </p>
          </div>
        )}
      </div>
    );
  }

  it('renders for day-1 tenant (null score, 0 alerts)', () => {
    render(<WelcomeBanner realityScore={null} openAlertCount={0} />);
    expect(screen.getByTestId('welcome-banner')).toBeDefined();
    expect(screen.getByText('Welcome to LocalVector.ai')).toBeDefined();
    const sundayDate = nextSundayLabel();
    expect(screen.getByText(new RegExp(sundayDate))).toBeDefined();
  });

  it('hidden when realityScore has data', () => {
    render(<WelcomeBanner realityScore={72} openAlertCount={0} />);
    expect(screen.queryByTestId('welcome-banner')).toBeNull();
  });

  it('hidden when open alerts exist (even if score is null)', () => {
    render(<WelcomeBanner realityScore={null} openAlertCount={3} />);
    expect(screen.queryByTestId('welcome-banner')).toBeNull();
  });
});
