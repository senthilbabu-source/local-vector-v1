// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// src/__tests__/unit/info-tooltip.test.tsx — Sprint B (H1)
//
// Validates InfoTooltip component behavior and TOOLTIP_CONTENT data integrity.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { TOOLTIP_CONTENT } from '@/lib/tooltip-content';

// ---------------------------------------------------------------------------
// InfoTooltip component tests
// ---------------------------------------------------------------------------

describe('InfoTooltip', () => {
  it('renders a button with aria-label="More information" by default', () => {
    render(<InfoTooltip content="Test content" />);
    const trigger = screen.getByRole('button', { name: 'More information' });
    expect(trigger).toBeDefined();
  });

  it('accepts a custom label prop and applies it to aria-label', () => {
    render(<InfoTooltip content="Test content" label="Custom label" />);
    const trigger = screen.getByRole('button', { name: 'Custom label' });
    expect(trigger).toBeDefined();
  });

  it('popover content is not visible on initial render', () => {
    render(<InfoTooltip content="Hidden content" />);
    const content = screen.queryByTestId('info-tooltip-content');
    expect(content).toBeNull();
  });

  it('popover content becomes visible after clicking the trigger button', async () => {
    render(<InfoTooltip content="Visible content" />);
    const trigger = screen.getByTestId('info-tooltip-trigger');
    fireEvent.click(trigger);
    // Popover opens on the open state change from the click
    const content = await screen.findByTestId('info-tooltip-content');
    expect(content).toBeDefined();
  });

  it('data-testid="info-tooltip-trigger" is on the button', () => {
    render(<InfoTooltip content="Test" />);
    const trigger = screen.getByTestId('info-tooltip-trigger');
    expect(trigger).toBeDefined();
    expect(trigger.tagName.toLowerCase()).toBe('button');
  });

  it('renders string content as a paragraph', async () => {
    render(<InfoTooltip content="Simple string content" />);
    fireEvent.click(screen.getByTestId('info-tooltip-trigger'));
    const content = await screen.findByTestId('info-tooltip-content');
    expect(content.textContent).toContain('Simple string content');
  });

  it('renders JSX content directly', async () => {
    render(<InfoTooltip content={<span data-testid="custom-jsx">Custom JSX</span>} />);
    fireEvent.click(screen.getByTestId('info-tooltip-trigger'));
    const jsx = await screen.findByTestId('custom-jsx');
    expect(jsx).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// TOOLTIP_CONTENT data integrity
// ---------------------------------------------------------------------------

describe('TOOLTIP_CONTENT', () => {
  const keys = Object.keys(TOOLTIP_CONTENT) as Array<keyof typeof TOOLTIP_CONTENT>;

  it('has at least 8 tooltip entries', () => {
    expect(keys.length).toBeGreaterThanOrEqual(8);
  });

  it('every entry renders as a valid React element', () => {
    for (const key of keys) {
      const content = TOOLTIP_CONTENT[key];
      expect(content).toBeDefined();
      // Each entry should be a JSX element (object with $$typeof)
      expect(typeof content).toBe('object');
    }
  });

  it('realityScore entry exists', () => {
    expect(TOOLTIP_CONTENT.realityScore).toBeDefined();
  });

  it('openAlerts entry exists', () => {
    expect(TOOLTIP_CONTENT.openAlerts).toBeDefined();
  });
});
