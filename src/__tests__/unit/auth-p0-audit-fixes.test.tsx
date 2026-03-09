/**
 * Unit Tests — P0/P1 Auth Security Audit Fixes
 *
 * C1: Reset password enforces full password policy (blocklist, strength, bcrypt max)
 * M1: CSRF Origin validation blocks cross-origin requests
 * M2+M3: Server-side reset-password route with rate limiting + session invalidation
 *
 * Run:
 *   npx vitest run src/__tests__/unit/auth-p0-audit-fixes.test.tsx
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// C1: Reset password — client-side password policy enforcement
// ---------------------------------------------------------------------------

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

import ResetPasswordPage from '@/app/(auth)/reset-password/page';

describe('C1: Reset password — full password policy', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    // Mock fetch for tests that pass client-side validation
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: 'Password updated' }),
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('rejects passwords shorter than 8 characters', async () => {
    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'Ab1cdef' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Ab1cdef' } });
    fireEvent.submit(screen.getByRole('button', { name: /reset password/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('at least 8 characters');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('rejects common/blocklisted passwords', async () => {
    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } });
    fireEvent.submit(screen.getByRole('button', { name: /reset password/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('too common');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('rejects weak passwords (strength < 2)', async () => {
    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'abcdefgh' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'abcdefgh' } });
    fireEvent.submit(screen.getByRole('button', { name: /reset password/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('too weak');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('rejects passwords exceeding 72 bytes (bcrypt limit)', async () => {
    render(<ResetPasswordPage />);

    const longPassword = 'Aa1!' + 'x'.repeat(69);
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: longPassword } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: longPassword } });
    fireEvent.submit(screen.getByRole('button', { name: /reset password/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('72 bytes');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords', async () => {
    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'SecureP@ss9' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'DifferentP@ss1' } });
    fireEvent.submit(screen.getByRole('button', { name: /reset password/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('do not match');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('calls server route on valid password and redirects to login', async () => {
    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'SecureP@ss9' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'SecureP@ss9' } });
    fireEvent.submit(screen.getByRole('button', { name: /reset password/i }));

    await vi.waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/reset-password', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ password: 'SecureP@ss9' }),
      }));
    });

    await vi.waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('shows server error when reset-password route returns error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Too many password reset attempts.' }),
    });

    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'SecureP@ss9' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'SecureP@ss9' } });
    fireEvent.submit(screen.getByRole('button', { name: /reset password/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Too many password reset attempts');
  });
});

// ---------------------------------------------------------------------------
// M1: CSRF Origin validation (pure function tests)
// ---------------------------------------------------------------------------

import { validateOrigin } from '@/lib/auth/csrf';

describe('M1: CSRF Origin validation', () => {
  it('allows requests from http://localhost:3000', () => {
    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(validateOrigin(req)).toBeNull();
  });

  it('allows requests from https://localvector.ai', () => {
    const req = new Request('https://localvector.ai/api/auth/login', {
      method: 'POST',
      headers: { origin: 'https://localvector.ai' },
    });
    expect(validateOrigin(req)).toBeNull();
  });

  it('allows requests from https://app.localvector.ai', () => {
    const req = new Request('https://app.localvector.ai/api/auth/login', {
      method: 'POST',
      headers: { origin: 'https://app.localvector.ai' },
    });
    expect(validateOrigin(req)).toBeNull();
  });

  it('rejects requests from unknown origins', () => {
    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { origin: 'https://evil.com' },
    });
    expect(validateOrigin(req)).toContain('not allowed');
  });

  it('rejects requests with no Origin or Referer header', () => {
    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
    });
    expect(validateOrigin(req)).toContain('Missing Origin');
  });

  it('falls back to Referer header when Origin is absent', () => {
    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { referer: 'http://localhost:3000/login' },
    });
    expect(validateOrigin(req)).toBeNull();
  });

  it('rejects malicious Referer from unknown domain', () => {
    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { referer: 'https://phishing.com/login' },
    });
    expect(validateOrigin(req)).toContain('not allowed');
  });
});
