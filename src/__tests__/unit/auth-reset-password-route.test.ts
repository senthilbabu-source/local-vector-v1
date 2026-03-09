/**
 * Unit Tests — POST /api/auth/reset-password (§321)
 *
 * M2: Global session invalidation after password change
 * M3: Server-side rate limiting on password reset
 *
 * Run:
 *   npx vitest run src/__tests__/unit/auth-reset-password-route.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as resetPassword } from '@/app/api/auth/reset-password/route';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockUpdateUser = vi.fn();
const mockSignOut = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      updateUser: mockUpdateUser,
      signOut: mockSignOut,
    },
  })),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'origin': 'http://localhost:3000' },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => vi.clearAllMocks());

  // §321-M1: CSRF
  it('returns 403 when Origin header is missing', async () => {
    const req = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'SecureP@ss9' }),
    });
    const res = await resetPassword(req);
    expect(res.status).toBe(403);
  });

  it('returns 403 when Origin is a foreign domain', async () => {
    const req = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'origin': 'https://evil.com' },
      body: JSON.stringify({ password: 'SecureP@ss9' }),
    });
    const res = await resetPassword(req);
    expect(res.status).toBe(403);
  });

  // Server-side password policy
  it('returns 400 for passwords shorter than 8 characters', async () => {
    const res = await resetPassword(makeRequest({ password: 'Short1!' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('8 characters');
  });

  it('returns 400 for common/blocklisted passwords', async () => {
    const res = await resetPassword(makeRequest({ password: 'password123' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('too common');
  });

  it('returns 400 for weak passwords', async () => {
    const res = await resetPassword(makeRequest({ password: 'abcdefgh' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('too weak');
  });

  it('returns 400 for passwords exceeding 72 bytes', async () => {
    const longPassword = 'Aa1!' + 'x'.repeat(69);
    const res = await resetPassword(makeRequest({ password: longPassword }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('72 bytes');
  });

  // Happy path
  it('returns 200 and calls updateUser + global signOut on valid password', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });

    const res = await resetPassword(makeRequest({ password: 'SecureP@ss9' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('Password updated');

    // §321-M2: Must call updateUser then signOut globally
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'SecureP@ss9' });
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'global' });
  });

  it('returns 400 with generic message when supabase updateUser fails', async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: 'Session expired' } });

    const res = await resetPassword(makeRequest({ password: 'SecureP@ss9' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    // §322: Must NOT leak internal error message — generic response only
    expect(body.error).toBe('Password update failed. Please try again.');
    expect(body.error).not.toContain('Session expired');
    // signOut should NOT be called when updateUser fails
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  // §321-M2: signOut failure is non-fatal
  it('returns 200 even when global signOut fails (non-fatal)', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    mockSignOut.mockRejectedValue(new Error('signOut network error'));

    const res = await resetPassword(makeRequest({ password: 'SecureP@ss9' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('Password updated');
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'origin': 'http://localhost:3000' },
      body: 'not json',
    });
    const res = await resetPassword(req);
    expect(res.status).toBe(400);
  });
});
