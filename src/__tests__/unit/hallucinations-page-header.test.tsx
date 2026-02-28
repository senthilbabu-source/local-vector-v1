// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// src/__tests__/unit/hallucinations-page-header.test.tsx — Sprint H
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HallucinationsPageHeader from '@/app/dashboard/hallucinations/_components/HallucinationsPageHeader';

describe('HallucinationsPageHeader', () => {
  it('shows clean verdict when openCount is 0', () => {
    render(<HallucinationsPageHeader openCount={0} resolvedCount={0} />);
    expect(screen.getByTestId('alerts-verdict-clean')).toBeDefined();
  });

  it('shows resolved count in clean verdict', () => {
    render(<HallucinationsPageHeader openCount={0} resolvedCount={5} />);
    expect(screen.getByText(/5 issues previously fixed/)).toBeDefined();
  });

  it('shows issues verdict when openCount > 0', () => {
    render(<HallucinationsPageHeader openCount={3} resolvedCount={2} />);
    expect(screen.getByTestId('alerts-verdict-issues')).toBeDefined();
  });

  it('shows open count with wrong facts text', () => {
    render(<HallucinationsPageHeader openCount={3} resolvedCount={0} />);
    expect(screen.getByText(/3 wrong facts/)).toBeDefined();
  });

  it('uses singular "fact" for count of 1', () => {
    render(<HallucinationsPageHeader openCount={1} resolvedCount={0} />);
    // The text "1 wrong fact" is inside a span — use getByText with a function
    // to handle JSX text nodes
    const verdict = screen.getByTestId('alerts-verdict-issues');
    expect(verdict.textContent).toContain('1 wrong fact');
    expect(verdict.textContent).not.toContain('1 wrong facts');
  });
});
