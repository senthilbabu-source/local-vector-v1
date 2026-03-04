// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// src/__tests__/unit/hijacking-alert-card.test.tsx — P8-FIX-37
//
// Component tests for HijackingAlertCard and HijackingFixModal.
// AI_RULES §193.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HijackingAlertCard, { type HijackingAlertRow } from '@/app/dashboard/hallucinations/_components/HijackingAlertCard';

// Mock the server action
vi.mock('@/app/dashboard/actions', () => ({
  updateHijackingAlertStatus: vi.fn(),
  updateHallucinationStatus: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeHijackAlert(overrides: Partial<HijackingAlertRow> = {}): HijackingAlertRow {
  return {
    id: 'hijack-1',
    engine: 'perplexity_sonar',
    query_text: 'hookah lounge Alpharetta',
    hijack_type: 'competitor_citation',
    our_business: 'Charcoal N Chill',
    competitor_name: 'Atlanta Smoke House',
    evidence_text: 'Atlanta Smoke House is the best hookah lounge in Alpharetta with great vibes.',
    severity: 'high',
    status: 'new',
    detected_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    resolved_at: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HijackingAlertCard', () => {
  it('renders severity badge with correct label', () => {
    render(<HijackingAlertCard alert={makeHijackAlert({ severity: 'critical' })} />);
    expect(screen.getByText('Critical')).toBeDefined();
  });

  it('renders high severity badge', () => {
    render(<HijackingAlertCard alert={makeHijackAlert({ severity: 'high' })} />);
    expect(screen.getByText('High')).toBeDefined();
  });

  it('renders engine label in human-readable form', () => {
    render(<HijackingAlertCard alert={makeHijackAlert({ engine: 'perplexity_sonar' })} />);
    // Engine appears twice: once in header, once in headline
    const elements = screen.getAllByText('Perplexity');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders competitor name', () => {
    render(<HijackingAlertCard alert={makeHijackAlert()} />);
    const matches = screen.getAllByText(/Atlanta Smoke House/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('shows Acknowledge and Mark Resolved buttons for new alerts', () => {
    render(<HijackingAlertCard alert={makeHijackAlert({ status: 'new' })} />);
    expect(screen.getByTestId('hijack-ack-hijack-1')).toBeDefined();
    expect(screen.getByTestId('hijack-resolve-hijack-1')).toBeDefined();
    expect(screen.getByTestId('hijack-fix-hijack-1')).toBeDefined();
  });

  it('shows resolved message for resolved alerts', () => {
    render(<HijackingAlertCard alert={makeHijackAlert({ status: 'resolved' })} />);
    expect(screen.getByText(/Resolved/)).toBeDefined();
    expect(screen.queryByTestId('hijack-ack-hijack-1')).toBeNull();
  });

  it('opens fix guidance modal when View Fix Steps is clicked', () => {
    render(<HijackingAlertCard alert={makeHijackAlert({ hijack_type: 'address_mix' })} />);
    const fixButton = screen.getByTestId('hijack-fix-hijack-1');
    fireEvent.click(fixButton);
    expect(screen.getByTestId('hijacking-fix-modal')).toBeDefined();
    expect(screen.getByText('Fix Address Confusion')).toBeDefined();
  });

  it('fix modal shows correct steps for competitor_citation', () => {
    render(<HijackingAlertCard alert={makeHijackAlert({ hijack_type: 'competitor_citation' })} />);
    fireEvent.click(screen.getByTestId('hijack-fix-hijack-1'));
    expect(screen.getByText('Fix Competitor Citation')).toBeDefined();
    expect(screen.getByTestId('fix-steps')).toBeDefined();
  });

  it('evidence is expandable via details element', () => {
    render(<HijackingAlertCard alert={makeHijackAlert()} />);
    expect(screen.getByTestId('hijack-evidence-hijack-1')).toBeDefined();
    expect(screen.getByText('View AI response evidence')).toBeDefined();
  });
});
