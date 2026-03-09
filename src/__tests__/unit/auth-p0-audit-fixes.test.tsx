/**
 * Unit Tests — P0 Auth Security Audit Fixes
 *
 * C1: Reset password enforces full password policy (blocklist, strength, bcrypt max)
 * C3: Login unifies error responses to prevent email enumeration
 * H5: Login does not expose session tokens in response body
 *
 * Run:
 *   npx vitest run src/__tests__/unit/auth-p0-audit-fixes.test.tsx
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// C1: Reset password — full password policy enforcement
// ---------------------------------------------------------------------------

// Mock supabase client
const mockUpdateUser = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      updateUser: mockUpdateUser,
    },
  }),
}));

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
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('rejects passwords shorter than 8 characters', async () => {
    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'Ab1cdef' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Ab1cdef' } });
    fireEvent.submit(screen.getByRole('button', { name: /reset password/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('at least 8 characters');
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('rejects common/blocklisted passwords', async () => {
    render(<ResetPasswordPage />);

    // 'password123' is in the blocklist
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } });
    fireEvent.submit(screen.getByRole('button', { name: /reset password/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('too common');
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('rejects weak passwords (strength < 2)', async () => {
    render(<ResetPasswordPage />);

    // 'abcdefgh' — only lowercase, no digits/special — strength 1
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'abcdefgh' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'abcdefgh' } });
    fireEvent.submit(screen.getByRole('button', { name: /reset password/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('too weak');
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('rejects passwords exceeding 72 bytes (bcrypt limit)', async () => {
    render(<ResetPasswordPage />);

    // 73 ASCII chars = 73 bytes > 72 limit
    const longPassword = 'Aa1!' + 'x'.repeat(69);
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: longPassword } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: longPassword } });
    fireEvent.submit(screen.getByRole('button', { name: /reset password/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('72 bytes');
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords', async () => {
    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'SecureP@ss9' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'DifferentP@ss1' } });
    fireEvent.submit(screen.getByRole('button', { name: /reset password/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('do not match');
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('accepts a valid strong password and calls updateUser', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });

    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'SecureP@ss9' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'SecureP@ss9' } });
    fireEvent.submit(screen.getByRole('button', { name: /reset password/i }));

    // Should call supabase updateUser
    await vi.waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'SecureP@ss9' });
    });
  });
});
