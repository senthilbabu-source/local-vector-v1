// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// email-capture-form.test.tsx — Unit tests for EmailCaptureForm component
//
// Sprint P2-7b: 10 tests covering idle render, submit flow, success state,
// and error state.
//
// Run:
//   npx vitest run src/__tests__/unit/email-capture-form.test.tsx
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EmailCaptureForm from '@/app/scan/_components/EmailCaptureForm';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCapture = vi.fn();
vi.mock('@/app/actions/marketing', () => ({
  captureLeadEmail: (...args: unknown[]) => mockCapture(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_PROPS = {
  businessName: 'Charcoal N Chill',
  scanStatus:   'fail' as const,
};

// ---------------------------------------------------------------------------
// Tests — idle state render
// ---------------------------------------------------------------------------

describe('EmailCaptureForm — idle state', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the form with data-testid="email-capture-form"', () => {
    render(<EmailCaptureForm {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('email-capture-form')).toBeDefined();
  });

  it('renders email input with data-testid="email-input"', () => {
    render(<EmailCaptureForm {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('email-input')).toBeDefined();
  });

  it('renders submit button with data-testid="email-submit"', () => {
    render(<EmailCaptureForm {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('email-submit')).toBeDefined();
  });

  it('submit button is disabled when email is empty', () => {
    render(<EmailCaptureForm {...DEFAULT_PROPS} />);
    const btn = screen.getByTestId('email-submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('submit button enables after typing email', () => {
    render(<EmailCaptureForm {...DEFAULT_PROPS} />);
    const input = screen.getByTestId('email-input');
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    const btn = screen.getByTestId('email-submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('hidden fields carry businessName and scanStatus', () => {
    const { container } = render(<EmailCaptureForm {...DEFAULT_PROPS} />);
    const businessInput = container.querySelector('input[name="businessName"]') as HTMLInputElement;
    const statusInput   = container.querySelector('input[name="scanStatus"]')   as HTMLInputElement;
    expect(businessInput.value).toBe('Charcoal N Chill');
    expect(statusInput.value).toBe('fail');
  });
});

// ---------------------------------------------------------------------------
// Tests — success state
// ---------------------------------------------------------------------------

describe('EmailCaptureForm — success state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCapture.mockResolvedValue({ ok: true });
  });

  it('shows data-testid="email-capture-success" after successful submit', async () => {
    render(<EmailCaptureForm {...DEFAULT_PROPS} />);
    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'owner@grill.com' },
    });
    fireEvent.submit(screen.getByTestId('email-capture-form'));
    await waitFor(() => {
      expect(screen.getByTestId('email-capture-success')).toBeDefined();
    });
  });

  it('success state contains link to /signup', async () => {
    render(<EmailCaptureForm {...DEFAULT_PROPS} />);
    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'owner@grill.com' },
    });
    fireEvent.submit(screen.getByTestId('email-capture-form'));
    await waitFor(() => {
      const link = screen.getByTestId('email-capture-success').querySelector('a');
      expect(link?.getAttribute('href')).toBe('/signup');
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — error state
// ---------------------------------------------------------------------------

describe('EmailCaptureForm — error state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCapture.mockResolvedValue({ ok: false });
  });

  it('shows data-testid="email-error" after failed submit', async () => {
    render(<EmailCaptureForm {...DEFAULT_PROPS} />);
    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'owner@grill.com' },
    });
    fireEvent.submit(screen.getByTestId('email-capture-form'));
    await waitFor(() => {
      expect(screen.getByTestId('email-error')).toBeDefined();
    });
  });

  it('error element has role="alert"', async () => {
    render(<EmailCaptureForm {...DEFAULT_PROPS} />);
    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'owner@grill.com' },
    });
    fireEvent.submit(screen.getByTestId('email-capture-form'));
    await waitFor(() => {
      const err = screen.getByTestId('email-error');
      expect(err.getAttribute('role')).toBe('alert');
    });
  });
});
