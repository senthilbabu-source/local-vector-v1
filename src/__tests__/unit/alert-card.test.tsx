// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// src/__tests__/unit/alert-card.test.tsx — Sprint H: AlertCard unit tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AlertCard from '@/app/dashboard/hallucinations/_components/AlertCard';
import type { HallucinationRow } from '@/lib/data/dashboard';

// Mock next/link to render plain <a>
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock the server action used by DismissAlertButton
vi.mock('@/app/dashboard/actions', () => ({
  updateHallucinationStatus: vi.fn(),
}));

function makeAlert(overrides: Partial<HallucinationRow> = {}): HallucinationRow {
  return {
    id: 'alert-1',
    severity: 'high',
    category: 'hours',
    model_provider: 'openai-gpt4o',
    claim_text: 'Open until 2 AM',
    expected_truth: 'Open until midnight',
    correction_status: 'open',
    first_detected_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    last_seen_at: new Date().toISOString(),
    occurrence_count: 2,
    follow_up_result: null,
    ...overrides,
  };
}

describe('AlertCard', () => {
  // Headline tests
  it('headline comes from describeAlert() — not a raw alert_type string', () => {
    render(<AlertCard alert={makeAlert()} />);
    // describeAlert for hours+openai-gpt4o produces "ChatGPT says ..." not "hours"
    expect(screen.getByText(/ChatGPT says/)).toBeDefined();
    expect(screen.queryByText('hours')).toBeNull();
  });

  it('model displayed via getModelName() — not raw identifier', () => {
    render(<AlertCard alert={makeAlert({ model_provider: 'perplexity-sonar' })} />);
    expect(screen.getByText('Perplexity')).toBeDefined();
    expect(screen.queryByText('perplexity-sonar')).toBeNull();
  });

  // Severity tests
  it('critical/high severity shows Critical badge', () => {
    render(<AlertCard alert={makeAlert({ severity: 'critical' })} />);
    expect(screen.getByText('Critical')).toBeDefined();
  });

  it('medium severity shows Warning badge', () => {
    render(<AlertCard alert={makeAlert({ severity: 'medium' })} />);
    expect(screen.getByText('Warning')).toBeDefined();
  });

  it('critical severity applies crimson border class', () => {
    const { container } = render(<AlertCard alert={makeAlert({ severity: 'critical' })} />);
    const card = container.querySelector('[data-testid="alert-card-alert-1"]');
    expect(card?.className).toContain('border-l-alert-crimson');
  });

  it('medium severity applies amber border class', () => {
    const { container } = render(<AlertCard alert={makeAlert({ severity: 'medium' })} />);
    const card = container.querySelector('[data-testid="alert-card-alert-1"]');
    expect(card?.className).toContain('border-l-alert-amber');
  });

  // Actions by status
  it('status=open shows Fix with AI button', () => {
    render(<AlertCard alert={makeAlert({ correction_status: 'open' })} />);
    expect(screen.getByText('Fix with AI')).toBeDefined();
  });

  it('status=open shows Dismiss button', () => {
    render(<AlertCard alert={makeAlert({ correction_status: 'open' })} />);
    expect(screen.getByText('Dismiss')).toBeDefined();
  });

  it('Fix with AI links to /dashboard/hallucinations', () => {
    render(<AlertCard alert={makeAlert({ correction_status: 'open' })} />);
    const link = screen.getByTestId('alert-fix-alert-1');
    expect(link.getAttribute('href')).toBe('/dashboard/hallucinations');
  });

  it('status=verifying shows verification text (no Fix button)', () => {
    render(
      <AlertCard
        alert={makeAlert({
          correction_status: 'verifying',
          follow_up_result: null,
        })}
      />,
    );
    expect(screen.getByText(/Verification in progress/)).toBeDefined();
    expect(screen.queryByText('Fix with AI')).toBeNull();
  });

  it('status=fixed shows Fixed text (no Fix button)', () => {
    render(<AlertCard alert={makeAlert({ correction_status: 'fixed' })} />);
    expect(screen.getByText(/Fixed/)).toBeDefined();
    expect(screen.queryByText('Fix with AI')).toBeNull();
  });

  it('status=recurring shows Try again link', () => {
    render(<AlertCard alert={makeAlert({ correction_status: 'recurring' })} />);
    expect(screen.getByText('Try again →')).toBeDefined();
  });

  // Meta
  it('created_at renders as relative time string', () => {
    render(
      <AlertCard
        alert={makeAlert({
          first_detected_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
        })}
      />,
    );
    expect(screen.getByText('3 days ago')).toBeDefined();
  });

  it('data-testid="alert-card-{id}" on root element', () => {
    render(<AlertCard alert={makeAlert({ id: 'xyz-123' })} />);
    expect(screen.getByTestId('alert-card-xyz-123')).toBeDefined();
  });
});
