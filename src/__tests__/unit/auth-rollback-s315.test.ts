/**
 * Unit Tests — §315 Registration Rollback Hardening
 *
 * Tests the hardened rollback mechanism in the register route:
 * - Rollback failure logging (Sentry orphaned auth user alerts)
 * - Double-rollback guard
 * - Trigger propagation retry logic
 * - Error code responses (ROLLED_BACK, ROLLBACK_FAILED)
 *
 * Run:
 *   npx vitest run src/__tests__/unit/auth-rollback-s315.test.ts
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

const mockCaptureException = vi.fn();
const mockCaptureMessage = vi.fn();

vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRegisterRequest(overrides?: Partial<Record<string, string>>): Request {
  return new Request('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'origin': 'http://localhost:3000' },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'SecureP@ss9',
      full_name: 'Test User',
      business_name: 'Test Biz',
      ...overrides,
    }),
  });
}

/** Sets up createUser to succeed and return the given auth ID. */
function setupCreateUserSuccess(authId = 'auth-user-uuid') {
  mockAdminCreateUser.mockResolvedValue({
    data: { user: { id: authId } },
    error: null,
  });
}

/** Creates a builder that always returns the given result from .single(). */
function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    update: vi.fn().mockReturnThis(),
  };
}

// ---------------------------------------------------------------------------
// §315: Rollback Failure Handling
// ---------------------------------------------------------------------------

describe('§315: Rollback failure logging', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logs orphaned auth user to Sentry when deleteUser throws', async () => {
    setupCreateUserSuccess('orphaned-auth-id');
    mockAdminDeleteUser.mockRejectedValue(new Error('Supabase admin API down'));

    // All users lookups fail → triggers rollback
    mockFrom.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'Row not found' } }),
    );

    const res = await register(makeRegisterRequest());
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.code).toBe('ROLLBACK_FAILED');
    expect(body.error).toContain('contact support');

    // Verify Sentry captureException was called with the rollback error
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({ issue: 'orphaned_auth_user' }),
        extra: expect.objectContaining({ authUserId: 'orphaned-auth-id' }),
      }),
    );

    // Verify Sentry captureMessage was called with fatal level
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      expect.stringContaining('ORPHANED AUTH USER: orphaned-auth-id'),
      expect.objectContaining({ level: 'fatal' }),
    );
  });

  it('returns ROLLED_BACK code when deleteUser succeeds', async () => {
    setupCreateUserSuccess();
    mockAdminDeleteUser.mockResolvedValue({ error: null });

    // All users lookups fail → triggers rollback
    mockFrom.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'Row not found' } }),
    );

    const res = await register(makeRegisterRequest());
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.code).toBe('ROLLED_BACK');
    expect(body.error).toContain('rolled back');
    expect(mockCaptureException).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tags: expect.objectContaining({ issue: 'orphaned_auth_user' }) }),
    );
  });

  it('includes email in Sentry extra when rollback fails', async () => {
    setupCreateUserSuccess();
    mockAdminDeleteUser.mockRejectedValue(new Error('Network timeout'));

    mockFrom.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'Row not found' } }),
    );

    await register(makeRegisterRequest({ email: 'victim@company.com' }));

    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        extra: expect.objectContaining({ email: 'victim@company.com' }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// §315: Double-Rollback Guard
// ---------------------------------------------------------------------------

describe('§315: Double-rollback guard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('only calls deleteUser once even if rollback path is reached after initial rollback', async () => {
    setupCreateUserSuccess();
    mockAdminDeleteUser.mockResolvedValue({ error: null });

    // Users lookup fails on all retries
    mockFrom.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'Row not found' } }),
    );

    const res = await register(makeRegisterRequest());
    expect(res.status).toBe(500);

    // deleteUser should only be called once (guard prevents double-call)
    expect(mockAdminDeleteUser).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// §315: Trigger Propagation Retry
// ---------------------------------------------------------------------------

describe('§315: Trigger propagation retry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('succeeds on second attempt when public.users row appears after retry', async () => {
    setupCreateUserSuccess();

    // First call: users lookup fails
    // Second call: users lookup succeeds (trigger propagated)
    // Third call: membership lookup succeeds
    // Fourth call: org update succeeds
    mockFrom
      .mockReturnValueOnce(
        makeQueryBuilder({ data: null, error: { message: 'Row not found' } }),
      )
      .mockReturnValueOnce(
        makeQueryBuilder({ data: { id: 'pub-uuid' }, error: null }),
      )
      .mockReturnValueOnce(
        makeQueryBuilder({ data: { org_id: 'org-uuid' }, error: null }),
      )
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

    const res = await register(makeRegisterRequest());
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.org_id).toBe('org-uuid');
    expect(mockAdminDeleteUser).not.toHaveBeenCalled();
  });

  it('succeeds on third attempt when public.users row appears on last retry', async () => {
    setupCreateUserSuccess();

    // First two calls: users lookup fails
    // Third call: users lookup succeeds
    // Fourth call: membership lookup succeeds
    // Fifth call: org update succeeds
    mockFrom
      .mockReturnValueOnce(
        makeQueryBuilder({ data: null, error: { message: 'Row not found' } }),
      )
      .mockReturnValueOnce(
        makeQueryBuilder({ data: null, error: { message: 'Row not found' } }),
      )
      .mockReturnValueOnce(
        makeQueryBuilder({ data: { id: 'pub-uuid' }, error: null }),
      )
      .mockReturnValueOnce(
        makeQueryBuilder({ data: { org_id: 'org-uuid' }, error: null }),
      )
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

    const res = await register(makeRegisterRequest());
    expect(res.status).toBe(201);
    expect(mockAdminDeleteUser).not.toHaveBeenCalled();
  });

  it('rolls back after all retry attempts exhausted for public.users', async () => {
    setupCreateUserSuccess();
    mockAdminDeleteUser.mockResolvedValue({ error: null });

    // All 3 attempts fail (initial + 2 retries)
    mockFrom.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'Row not found' } }),
    );

    const res = await register(makeRegisterRequest());
    expect(res.status).toBe(500);
    expect(mockAdminDeleteUser).toHaveBeenCalledOnce();
  });

  it('succeeds on second attempt when membership row appears after retry', async () => {
    setupCreateUserSuccess();

    // Users lookup: succeeds immediately
    // Membership attempt 1: fails
    // Membership attempt 2: succeeds
    // Org update: succeeds
    mockFrom
      .mockReturnValueOnce(
        makeQueryBuilder({ data: { id: 'pub-uuid' }, error: null }),
      )
      .mockReturnValueOnce(
        makeQueryBuilder({ data: null, error: { message: 'No membership' } }),
      )
      .mockReturnValueOnce(
        makeQueryBuilder({ data: { org_id: 'org-uuid' }, error: null }),
      )
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

    const res = await register(makeRegisterRequest());
    expect(res.status).toBe(201);
    expect(mockAdminDeleteUser).not.toHaveBeenCalled();
  });

  it('rolls back after all retry attempts exhausted for membership', async () => {
    setupCreateUserSuccess();
    mockAdminDeleteUser.mockResolvedValue({ error: null });

    // Users lookup: succeeds immediately
    mockFrom.mockReturnValueOnce(
      makeQueryBuilder({ data: { id: 'pub-uuid' }, error: null }),
    );
    // All membership lookups fail
    mockFrom.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'No membership' } }),
    );

    const res = await register(makeRegisterRequest());
    expect(res.status).toBe(500);
    expect(mockAdminDeleteUser).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// §315: Sentry Logging on Trigger Failure
// ---------------------------------------------------------------------------

describe('§315: Sentry logging on trigger lookup failure', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logs to Sentry when public.users lookup fails after all retries', async () => {
    setupCreateUserSuccess('sentry-test-auth-id');
    mockAdminDeleteUser.mockResolvedValue({ error: null });

    mockFrom.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'Row not found' } }),
    );

    await register(makeRegisterRequest());

    expect(mockCaptureMessage).toHaveBeenCalledWith(
      expect.stringContaining('public.users row not found'),
      expect.objectContaining({
        level: 'error',
        tags: expect.objectContaining({ sprint: '315' }),
      }),
    );
  });

  it('logs to Sentry when membership lookup fails after all retries', async () => {
    setupCreateUserSuccess();
    mockAdminDeleteUser.mockResolvedValue({ error: null });

    // Users lookup succeeds
    mockFrom.mockReturnValueOnce(
      makeQueryBuilder({ data: { id: 'pub-uuid' }, error: null }),
    );
    // All membership lookups fail
    mockFrom.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'No membership' } }),
    );

    await register(makeRegisterRequest());

    expect(mockCaptureMessage).toHaveBeenCalledWith(
      expect.stringContaining('memberships row not found'),
      expect.objectContaining({
        level: 'error',
        tags: expect.objectContaining({ sprint: '315' }),
      }),
    );
  });

  it('logs to Sentry when org name update fails', async () => {
    setupCreateUserSuccess('update-fail-auth-id');
    mockAdminDeleteUser.mockResolvedValue({ error: null });

    // Users + membership succeed
    mockFrom
      .mockReturnValueOnce(
        makeQueryBuilder({ data: { id: 'pub-uuid' }, error: null }),
      )
      .mockReturnValueOnce(
        makeQueryBuilder({ data: { org_id: 'org-uuid' }, error: null }),
      )
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'Constraint violation' } }),
      });

    const res = await register(makeRegisterRequest());
    expect(res.status).toBe(500);

    // captureException should be called for the update error
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Constraint violation' }),
      expect.objectContaining({
        extra: expect.objectContaining({
          authUserId: 'update-fail-auth-id',
          orgId: 'org-uuid',
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// §315: Happy Path (no retries needed)
// ---------------------------------------------------------------------------

describe('§315: Happy path (no retries)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 201 without any retry when triggers propagate immediately', async () => {
    setupCreateUserSuccess('fast-auth-id');

    mockFrom
      .mockReturnValueOnce(
        makeQueryBuilder({ data: { id: 'pub-uuid' }, error: null }),
      )
      .mockReturnValueOnce(
        makeQueryBuilder({ data: { org_id: 'org-uuid' }, error: null }),
      )
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

    const res = await register(makeRegisterRequest());
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.user_id).toBe('fast-auth-id');
    expect(body.org_id).toBe('org-uuid');
    expect(body.email_verification_required).toBe(true);

    // No retries means mockFrom should be called exactly 3 times
    // (users lookup, membership lookup, org update)
    expect(mockFrom).toHaveBeenCalledTimes(3);
    expect(mockAdminDeleteUser).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// §315: Rollback on org name update failure
// ---------------------------------------------------------------------------

describe('§315: Rollback on org update failure', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rolls back when org name update fails', async () => {
    setupCreateUserSuccess();
    mockAdminDeleteUser.mockResolvedValue({ error: null });

    mockFrom
      .mockReturnValueOnce(
        makeQueryBuilder({ data: { id: 'pub-uuid' }, error: null }),
      )
      .mockReturnValueOnce(
        makeQueryBuilder({ data: { org_id: 'org-uuid' }, error: null }),
      )
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } }),
      });

    const res = await register(makeRegisterRequest());
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.code).toBe('ROLLED_BACK');
    expect(mockAdminDeleteUser).toHaveBeenCalledOnce();
  });

  it('returns ROLLBACK_FAILED when both update and deleteUser fail', async () => {
    setupCreateUserSuccess();
    mockAdminDeleteUser.mockRejectedValue(new Error('Delete also failed'));

    mockFrom
      .mockReturnValueOnce(
        makeQueryBuilder({ data: { id: 'pub-uuid' }, error: null }),
      )
      .mockReturnValueOnce(
        makeQueryBuilder({ data: { org_id: 'org-uuid' }, error: null }),
      )
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } }),
      });

    const res = await register(makeRegisterRequest());
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.code).toBe('ROLLBACK_FAILED');
    expect(body.error).toContain('contact support');
  });
});
