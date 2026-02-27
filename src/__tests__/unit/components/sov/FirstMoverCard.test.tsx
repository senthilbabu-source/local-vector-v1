// @vitest-environment jsdom
/**
 * FirstMoverCard — Component Tests (Doc 06 §8.3)
 *
 * Covers:
 *   - Renders query text in quotes
 *   - Renders rocket icon container
 *   - Shows "AI isn't recommending anyone" copy
 *   - Shows Create Content and Dismiss buttons
 *   - Shows formatted date
 *
 * Project rules honoured:
 *   TAILWIND LITERALS — class assertions use exact literal strings
 *   ZERO LIVE APIS    — pure component, no external calls
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import FirstMoverCard from '@/app/dashboard/share-of-voice/_components/FirstMoverCard';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_PROPS = {
  id: 'draft-001',
  queryText: 'best hookah lounge in Alpharetta',
  createdAt: '2026-02-20T12:00:00Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FirstMoverCard', () => {
  it('renders query text in quotes', () => {
    render(<FirstMoverCard {...MOCK_PROPS} />);

    // The query text is wrapped in smart quotes
    expect(
      screen.getByText(/best hookah lounge in Alpharetta/),
    ).toBeDefined();
  });

  it('renders the opportunity copy', () => {
    render(<FirstMoverCard {...MOCK_PROPS} />);

    expect(
      screen.getByText(/AI isn't recommending anyone/i),
    ).toBeDefined();
  });

  it('renders the formatted date', () => {
    render(<FirstMoverCard {...MOCK_PROPS} />);

    expect(screen.getByText(/Feb 20/)).toBeDefined();
  });

  it('renders Create Content button', () => {
    render(<FirstMoverCard {...MOCK_PROPS} />);

    const btn = screen.getByRole('button', { name: /Create Content/i });
    expect(btn).toBeDefined();
    expect(btn.className).toContain('text-signal-green');
  });

  it('renders Dismiss button', () => {
    render(<FirstMoverCard {...MOCK_PROPS} />);

    const btn = screen.getByRole('button', { name: /Dismiss/i });
    expect(btn).toBeDefined();
  });

  it('Create Content button is clickable without error', () => {
    render(<FirstMoverCard {...MOCK_PROPS} />);

    // Button click should not throw (handler is a no-op placeholder)
    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: /Create Content/i }));
    }).not.toThrow();
  });

  it('renders with correct test id', () => {
    render(<FirstMoverCard {...MOCK_PROPS} />);

    expect(screen.getByTestId('first-mover-draft-001')).toBeDefined();
  });

  it('renders rocket icon container', () => {
    render(<FirstMoverCard {...MOCK_PROPS} />);

    // The rocket icon container has amber styling
    const svgContainer = screen.getByTestId('first-mover-draft-001')
      .querySelector('.bg-amber-400\\/10');
    expect(svgContainer).not.toBeNull();
  });
});
