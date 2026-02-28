// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// src/__tests__/unit/triage-swimlane.test.tsx — Sprint H: TriageSwimlane tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TriageSwimlane from '@/app/dashboard/hallucinations/_components/TriageSwimlane';
import type { HallucinationRow } from '@/lib/data/dashboard';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock server action
vi.mock('@/app/dashboard/actions', () => ({
  updateHallucinationStatus: vi.fn(),
}));

function makeAlert(id: string): HallucinationRow {
  return {
    id,
    severity: 'high',
    category: 'hours',
    model_provider: 'openai-gpt4o',
    claim_text: `Alert ${id}`,
    expected_truth: 'expected',
    correction_status: 'open',
    first_detected_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    occurrence_count: 1,
    follow_up_result: null,
  };
}

describe('TriageSwimlane', () => {
  it('renders title and count badge', () => {
    render(
      <TriageSwimlane
        title="Fix Now"
        count={3}
        alerts={[makeAlert('1'), makeAlert('2'), makeAlert('3')]}
        emptyMessage="All clear"
        data-testid="swimlane-fix-now"
      />,
    );
    expect(screen.getByText('Fix Now')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
  });

  it('renders one AlertCard per item in alerts array', () => {
    render(
      <TriageSwimlane
        title="Fix Now"
        count={2}
        alerts={[makeAlert('a'), makeAlert('b')]}
        emptyMessage="All clear"
        data-testid="swimlane-fix-now"
      />,
    );
    expect(screen.getByTestId('alert-card-a')).toBeDefined();
    expect(screen.getByTestId('alert-card-b')).toBeDefined();
  });

  it('renders empty state when alerts array is empty', () => {
    render(
      <TriageSwimlane
        title="In Progress"
        count={0}
        alerts={[]}
        emptyMessage="Nothing in progress"
        data-testid="swimlane-in-progress"
      />,
    );
    expect(screen.getByTestId('swimlane-in-progress-empty')).toBeDefined();
  });

  it('empty state message matches emptyMessage prop', () => {
    render(
      <TriageSwimlane
        title="Resolved"
        count={0}
        alerts={[]}
        emptyMessage="Fixed issues will appear here"
        data-testid="swimlane-resolved"
      />,
    );
    expect(screen.getByText('Fixed issues will appear here')).toBeDefined();
  });

  it('data-testid from prop applied to root; "{testId}-empty" on empty state', () => {
    render(
      <TriageSwimlane
        title="Resolved"
        count={0}
        alerts={[]}
        emptyMessage="empty"
        data-testid="swimlane-resolved"
      />,
    );
    expect(screen.getByTestId('swimlane-resolved')).toBeDefined();
    expect(screen.getByTestId('swimlane-resolved-empty')).toBeDefined();
  });
});
