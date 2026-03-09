/**
 * Unit Tests — §317 Registration Route CAPTCHA Gate
 *
 * Tests the Turnstile integration in the register route handler.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/auth-captcha-s317-route.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as register } from '@/app/api/auth/register/route';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

const mockAdminCreateUser = vi.fn();
const mockAdminDeleteUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: mockAdminCreateUser,
        deleteUser: mockAdminDeleteUser,
      },
    },
    from: mockFrom,
  })),
  createClient: vi.fn(async () => ({})),
}));

vi.mock('@/lib/rate-limit/rate-limiter', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 3, reset_at: 0, limit: 3 }),
  getRateLimitHeaders: vi.fn().mockReturnValue({}),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

const mockVerifyTurnstileToken = vi.fn();
const mockIsTurnstileEnabled = vi.fn();

vi.mock('@/lib/auth/turnstile', () => ({
  verifyTurnstileToken: (...args: unknown[]) => mockVerifyTurnstileToken(...args),
  isTurnstileEnabled: () => mockIsTurnstileEnabled(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRegisterRequest(
  overrides?: Record<string, unknown>,
  headers?: Record<string, string>,
): Request {
  return new Request('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'origin': 'http://localhost:3000', ...headers },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'SecureP@ss9',
      full_name: 'Test User',
      business_name: 'Test Biz',
      ...overrides,
    }),
  });
}

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    update: vi.fn().mockReturnThis(),
  };
}

function setupHappyPath() {
  mockAdminCreateUser.mockResolvedValue({
    data: { user: { id: 'auth-uuid' } },
    error: null,
  });
  mockFrom
    .mockReturnValueOnce(makeQueryBuilder({ data: { id: 'pub-uuid' }, error: null }))
    .mockReturnValueOnce(makeQueryBuilder({ data: { org_id: 'org-uuid' }, error: null }))
    .mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('§317: Registration route CAPTCHA gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips CAPTCHA check when Turnstile is not enabled', async () => {
    mockIsTurnstileEnabled.mockReturnValue(false);
    setupHappyPath();

    const res = await register(makeRegisterRequest());
    expect(res.status).toBe(201);
    expect(mockVerifyTurnstileToken).not.toHaveBeenCalled();
  });

  it('returns 403 CAPTCHA_FAILED when Turnstile token is missing and enabled', async () => {
    mockIsTurnstileEnabled.mockReturnValue(true);
    mockVerifyTurnstileToken.mockResolvedValue({
      success: false,
      error_codes: ['missing-input-response'],
    });

    const res = await register(makeRegisterRequest());
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.code).toBe('CAPTCHA_FAILED');
    expect(body.error).toContain('CAPTCHA');
  });

  it('returns 403 CAPTCHA_FAILED when Turnstile token is invalid', async () => {
    mockIsTurnstileEnabled.mockReturnValue(true);
    mockVerifyTurnstileToken.mockResolvedValue({
      success: false,
      error_codes: ['invalid-input-response'],
    });

    const res = await register(
      makeRegisterRequest({ 'cf-turnstile-response': 'bad-token' }),
    );
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.code).toBe('CAPTCHA_FAILED');
  });

  it('proceeds with registration when Turnstile token is valid', async () => {
    mockIsTurnstileEnabled.mockReturnValue(true);
    mockVerifyTurnstileToken.mockResolvedValue({
      success: true,
      error_codes: [],
    });
    setupHappyPath();

    const res = await register(
      makeRegisterRequest({ 'cf-turnstile-response': 'valid-token' }),
    );
    expect(res.status).toBe(201);
    expect(mockVerifyTurnstileToken).toHaveBeenCalledWith('valid-token', 'unknown');
  });

  it('passes IP address to verifyTurnstileToken', async () => {
    mockIsTurnstileEnabled.mockReturnValue(true);
    mockVerifyTurnstileToken.mockResolvedValue({
      success: true,
      error_codes: [],
    });
    setupHappyPath();

    const res = await register(
      makeRegisterRequest(
        { 'cf-turnstile-response': 'valid-token' },
        { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
      ),
    );
    expect(res.status).toBe(201);
    expect(mockVerifyTurnstileToken).toHaveBeenCalledWith('valid-token', '192.168.1.1');
  });

  it('CAPTCHA check happens before user creation', async () => {
    mockIsTurnstileEnabled.mockReturnValue(true);
    mockVerifyTurnstileToken.mockResolvedValue({
      success: false,
      error_codes: ['invalid-input-response'],
    });

    const res = await register(makeRegisterRequest());
    expect(res.status).toBe(403);

    // createUser should NOT have been called
    expect(mockAdminCreateUser).not.toHaveBeenCalled();
  });
});
