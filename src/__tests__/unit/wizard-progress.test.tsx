// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// wizard-progress.test.tsx — Unit tests for WizardProgress component
//
// Sprint 91: 10 tests — pure UI component, no mocks needed.
//
// Run:
//   npx vitest run src/__tests__/unit/wizard-progress.test.tsx
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WizardProgress from '@/app/onboarding/_components/WizardProgress';
import type { WizardStep } from '@/app/onboarding/_components/WizardProgress';

describe('WizardProgress', () => {
  it('renders 5 step indicators', () => {
    render(<WizardProgress currentStep={1} completedSteps={[]} />);
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByTestId(`step-indicator-${i}`)).toBeDefined();
    }
  });

  it('current step dot has active/highlighted style class', () => {
    render(<WizardProgress currentStep={2} completedSteps={[1]} />);
    const dot = screen.getByTestId('step-indicator-2');
    expect(dot.className).toContain('bg-signal-green');
    expect(dot.className).toContain('text-deep-navy');
  });

  it('completed steps have filled/success style class', () => {
    render(<WizardProgress currentStep={3} completedSteps={[1, 2]} />);
    const dot = screen.getByTestId('step-indicator-1');
    expect(dot.className).toContain('text-signal-green');
  });

  it('future steps have inactive/gray style class', () => {
    render(<WizardProgress currentStep={1} completedSteps={[]} />);
    const dot = screen.getByTestId('step-indicator-3');
    expect(dot.className).toContain('bg-slate-800');
    expect(dot.className).toContain('text-slate-500');
  });

  it('renders correct label for each step', () => {
    render(<WizardProgress currentStep={1} completedSteps={[]} />);
    expect(screen.getByText('Business')).toBeDefined();
    expect(screen.getByText('Hours')).toBeDefined();
    expect(screen.getByText('Competitors')).toBeDefined();
    expect(screen.getByText('Queries')).toBeDefined();
    expect(screen.getByText('Launch')).toBeDefined();
  });

  it('has aria-label="Onboarding progress"', () => {
    render(<WizardProgress currentStep={1} completedSteps={[]} />);
    const wrapper = screen.getByTestId('wizard-progress');
    expect(wrapper.getAttribute('aria-label')).toBe('Onboarding progress');
  });

  it('has role="progressbar" with correct aria-valuenow', () => {
    render(<WizardProgress currentStep={3} completedSteps={[1, 2]} />);
    const wrapper = screen.getByTestId('wizard-progress');
    expect(wrapper.getAttribute('role')).toBe('progressbar');
    expect(wrapper.getAttribute('aria-valuenow')).toBe('3');
  });

  it('data-testid="wizard-progress" present on wrapper', () => {
    render(<WizardProgress currentStep={1} completedSteps={[]} />);
    expect(screen.getByTestId('wizard-progress')).toBeDefined();
  });

  it('data-testid="step-indicator-1" through "step-indicator-5" all present', () => {
    render(<WizardProgress currentStep={1} completedSteps={[]} />);
    const steps: WizardStep[] = [1, 2, 3, 4, 5];
    for (const step of steps) {
      expect(screen.getByTestId(`step-indicator-${step}`)).toBeDefined();
    }
  });

  it('shows "Step 1 of 5" accessible text', () => {
    render(<WizardProgress currentStep={1} completedSteps={[]} />);
    expect(screen.getByText('Step 1 of 5')).toBeDefined();
  });
});
