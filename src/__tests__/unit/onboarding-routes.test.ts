/**
 * Onboarding Routes Tests — Sprint 117
 *
 * 13 tests covering:
 * - GET  /api/onboarding/state           (2 tests)
 * - POST /api/onboarding/state/[step]    (4 tests)
 * - GET  /api/email/unsubscribe          (7 tests)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks — hoisted before module imports
// ---------------------------------------------------------------------------

const {
  mockGetSafeAuthContext,
  mockCreateServiceRoleClient,
  mockGetOnboardingState,
  mockMarkStepComplete,
  mockCaptureException,
  // Supabase chain mocks for unsubscribe route
  mockFrom,
  mockSelect,
  mockEq,
  mockMaybeSingle,
  mockUpdate,
} = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const mockEq = vi.fn();
  const mockSelect = vi.fn();
  const mockUpdate = vi.fn();
  const mockFrom = vi.fn();

  // Chain builder: from() → select/update → eq → eq → maybeSingle
  mockEq.mockReturnThis();
  mockSelect.mockReturnValue({ eq: mockEq, maybeSingle: mockMaybeSingle });
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate });

  return {
    mockGetSafeAuthContext: vi.fn(),
    mockCreateServiceRoleClient: vi.fn(),
    mockGetOnboardingState: vi.fn(),
    mockMarkStepComplete: vi.fn(),
    mockCaptureException: vi.fn(),
    mockFrom,
    mockSelect,
    mockEq,
    mockMaybeSingle,
    mockUpdate,
  };
});

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => mockCreateServiceRoleClient(),
}));

vi.mock('@/lib/onboarding/onboarding-service', () => ({
  getOnboardingState: (...args: unknown[]) => mockGetOnboardingState(...args),
  markStepComplete: (...args: unknown[]) => mockMarkStepComplete(...args),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

// Import routes after mocks
import { GET as GET_STATE } from '@/app/api/onboarding/state/route';
import { POST as POST_STEP } from '@/app/api/onboarding/state/[step]/route';
import { GET as GET_UNSUBSCRIBE } from '@/app/api/email/unsubscribe/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockAuthCtx(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-001',
    email: 'test@example.com',
    fullName: 'Test User',
    orgId: 'org-001',
    orgName: 'Test Org',
    role: 'member',
    plan: 'growth',
    onboarding_completed: false,
    org: { created_at: '2026-03-01T00:00:00Z' },
    ...overrides,
  };
}

const MOCK_STEP_STATE = {
  step_id: 'business_profile',
  completed: true,
  completed_at: '2026-03-01T12:00:00Z',
  completed_by_user_id: 'user-001',
};

const MOCK_ONBOARDING_STATE = {
  org_id: 'org-001',
  steps: [
    { step_id: 'business_profile', completed: true, completed_at: '2026-03-01T12:00:00Z', completed_by_user_id: 'user-001' },
    { step_id: 'first_scan', completed: false, completed_at: null, completed_by_user_id: null },
    { step_id: 'first_draft', completed: false, completed_at: null, completed_by_user_id: null },
    { step_id: 'invite_teammate', completed: false, completed_at: null, completed_by_user_id: null },
    { step_id: 'connect_domain', completed: false, completed_at: null, completed_by_user_id: null },
  ],
  total_steps: 5,
  completed_steps: 1,
  is_complete: false,
  show_interstitial: true,
  has_real_data: false,
};

/** Valid 64-char hex token */
const VALID_TOKEN = 'a'.repeat(64);

function makeUnsubscribeRequest(token?: string): NextRequest {
  const url = token
    ? `http://localhost/api/email/unsubscribe?token=${token}`
    : 'http://localhost/api/email/unsubscribe';
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();

  // Default service role client returns the chain mock
  mockCreateServiceRoleClient.mockReturnValue({ from: mockFrom });

  // Reset chain — default: no results
  mockEq.mockReturnThis();
  mockSelect.mockReturnValue({ eq: mockEq, maybeSingle: mockMaybeSingle });
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate });
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
});

// =============================================================================
// GET /api/onboarding/state
// =============================================================================

describe('GET /api/onboarding/state', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);

    const response = await GET_STATE();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('unauthenticated');
  });

  it('returns OnboardingState shape with all 5 steps', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx());
    mockGetOnboardingState.mockResolvedValue(MOCK_ONBOARDING_STATE);

    const response = await GET_STATE();
    expect(response.status).toBe(200);
    const body = await response.json();

    // Shape assertions
    expect(body.org_id).toBe('org-001');
    expect(body.steps).toHaveLength(5);
    expect(body.total_steps).toBe(5);
    expect(typeof body.completed_steps).toBe('number');
    expect(typeof body.is_complete).toBe('boolean');
    expect(typeof body.show_interstitial).toBe('boolean');
    expect(typeof body.has_real_data).toBe('boolean');

    // All 5 step IDs present
    const stepIds = body.steps.map((s: { step_id: string }) => s.step_id);
    expect(stepIds).toEqual([
      'business_profile',
      'first_scan',
      'first_draft',
      'invite_teammate',
      'connect_domain',
    ]);
  });
});

// =============================================================================
// POST /api/onboarding/state/[step]
// =============================================================================

describe('POST /api/onboarding/state/[step]', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/onboarding/state/business_profile', {
      method: 'POST',
    });
    const response = await POST_STEP(req, {
      params: Promise.resolve({ step: 'business_profile' }),
    });
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('unauthenticated');
  });

  it('returns 400 for unknown step name', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx());

    const req = new NextRequest('http://localhost/api/onboarding/state/bogus_step', {
      method: 'POST',
    });
    const response = await POST_STEP(req, {
      params: Promise.resolve({ step: 'bogus_step' }),
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('invalid_step');
  });

  it('returns { ok: true, step } on success', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx());
    mockMarkStepComplete.mockResolvedValue(MOCK_STEP_STATE);

    const req = new NextRequest('http://localhost/api/onboarding/state/business_profile', {
      method: 'POST',
    });
    const response = await POST_STEP(req, {
      params: Promise.resolve({ step: 'business_profile' }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.step).toEqual(MOCK_STEP_STATE);
  });

  it('any org member can mark a step complete (not owner-only)', async () => {
    // A regular member (not owner/admin) should succeed
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx({ role: 'member' }));
    mockMarkStepComplete.mockResolvedValue(MOCK_STEP_STATE);

    const req = new NextRequest('http://localhost/api/onboarding/state/first_scan', {
      method: 'POST',
    });
    const response = await POST_STEP(req, {
      params: Promise.resolve({ step: 'first_scan' }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);

    // Verify markStepComplete was called with the member's userId (not rejected)
    expect(mockMarkStepComplete).toHaveBeenCalledWith(
      expect.anything(), // supabase
      'org-001',
      'first_scan',
      'user-001',
    );
  });
});

// =============================================================================
// GET /api/email/unsubscribe?token={token}
// =============================================================================

describe('GET /api/email/unsubscribe?token={token}', () => {
  it('returns 400 for empty token', async () => {
    const response = await GET_UNSUBSCRIBE(makeUnsubscribeRequest());
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('invalid_token');
  });

  it('returns 400 for non-hex token', async () => {
    // 64 chars but contains non-hex chars (g, z)
    const badToken = 'g'.repeat(64);
    const response = await GET_UNSUBSCRIBE(makeUnsubscribeRequest(badToken));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('invalid_token');
  });

  it('returns 404 for unknown valid-format token', async () => {
    // maybeSingle returns no data
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await GET_UNSUBSCRIBE(makeUnsubscribeRequest(VALID_TOKEN));
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('token_not_found');
  });

  it('redirects to /unsubscribe?already=true if already unsubscribed', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'pref-001', digest_unsubscribed: true },
      error: null,
    });

    const response = await GET_UNSUBSCRIBE(makeUnsubscribeRequest(VALID_TOKEN));
    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/unsubscribe');
    expect(location).toContain('already=true');
  });

  it('sets digest_unsubscribed = true on valid token', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'pref-001', digest_unsubscribed: false },
      error: null,
    });

    await GET_UNSUBSCRIBE(makeUnsubscribeRequest(VALID_TOKEN));

    // Verify update was called on the 'email_preferences' table
    expect(mockFrom).toHaveBeenCalledWith('email_preferences');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        digest_unsubscribed: true,
      }),
    );
  });

  it('redirects to /unsubscribe?success=true on success', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'pref-001', digest_unsubscribed: false },
      error: null,
    });

    const response = await GET_UNSUBSCRIBE(makeUnsubscribeRequest(VALID_TOKEN));
    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/unsubscribe');
    expect(location).toContain('success=true');
  });

  it('no auth required (public route)', async () => {
    // getSafeAuthContext is never called — route does not import it
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'pref-001', digest_unsubscribed: false },
      error: null,
    });

    const response = await GET_UNSUBSCRIBE(makeUnsubscribeRequest(VALID_TOKEN));

    // Route succeeds without any auth mock setup
    expect(response.status).toBe(307);
    expect(mockGetSafeAuthContext).not.toHaveBeenCalled();
  });
});
