// ---------------------------------------------------------------------------
// Admin Write Operations — Unit Tests (Sprint §204)
//
// Tests admin guard, 5 server actions, and audit logging.
// ~42 test cases covering auth, validation, DB operations, error handling.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted() ensures variables exist before vi.mock() factories run
// ---------------------------------------------------------------------------

const {
  mockGetUser,
  mockFrom,
  mockRpc,
  mockServiceFrom,
  mockServiceRpc,
  mockCookieGet,
  mockCookieSet,
  mockCookieDelete,
  mockRevalidatePath,
  mockFetch,
  mockStripeSubscriptionCancel,
  mockStripeSubscriptionUpdate,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockServiceFrom: vi.fn(),
  mockServiceRpc: vi.fn(),
  mockCookieGet: vi.fn(),
  mockCookieSet: vi.fn(),
  mockCookieDelete: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockFetch: vi.fn(),
  mockStripeSubscriptionCancel: vi.fn(),
  mockStripeSubscriptionUpdate: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  })),
  createServiceRoleClient: vi.fn().mockImplementation(() => ({
    from: mockServiceFrom,
    rpc: mockServiceRpc,
  })),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockImplementation(async () => ({
    get: mockCookieGet,
    set: mockCookieSet,
    delete: mockCookieDelete,
  })),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      subscriptions: {
        cancel: mockStripeSubscriptionCancel,
        update: mockStripeSubscriptionUpdate,
      },
    };
  }),
}));

// Must import AFTER mocks are declared
import { assertAdmin, logAdminAction } from '@/lib/admin/admin-guard';
import {
  adminOverridePlan,
  adminCancelSubscription,
  adminForceCronRun,
  adminStartImpersonation,
  adminStopImpersonation,
  adminGrantCredits,
} from '@/lib/admin/admin-actions';
import { isKnownCron } from '@/lib/admin/known-crons';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_EMAIL = 'admin@localvector.ai';
const NON_ADMIN_EMAIL = 'user@example.com';
const ADMIN_AUTH_UID = 'auth-uid-admin-123';
const ADMIN_PUBLIC_ID = 'pub-uid-admin-456';
const TARGET_ORG_ID = 'org-target-789';

function mockAdminUser() {
  process.env.ADMIN_EMAILS = ADMIN_EMAIL;
  mockGetUser.mockResolvedValue({
    data: { user: { id: ADMIN_AUTH_UID, email: ADMIN_EMAIL } },
  });
  // Resolve public user id
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: ADMIN_PUBLIC_ID },
        }),
      }),
    }),
  });
}

function mockNonAdminUser() {
  process.env.ADMIN_EMAILS = ADMIN_EMAIL;
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'auth-uid-user', email: NON_ADMIN_EMAIL } },
  });
}

function mockUnauthenticated() {
  mockGetUser.mockResolvedValue({ data: { user: null } });
}

function mockServiceChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of [
    'select', 'insert', 'update', 'delete', 'eq', 'neq',
    'single', 'maybeSingle', 'order', 'limit',
  ]) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  // Apply overrides
  for (const [key, value] of Object.entries(overrides)) {
    chain[key] = vi.fn().mockResolvedValue(value);
  }
  return chain;
}

// ---------------------------------------------------------------------------
// beforeEach
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_EMAILS = ADMIN_EMAIL;
  process.env.CRON_SECRET = 'test-cron-secret';
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  mockCookieGet.mockReturnValue(undefined);
  // @ts-expect-error -- global fetch mock
  global.fetch = mockFetch;
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. assertAdmin
// ═══════════════════════════════════════════════════════════════════════════

describe('assertAdmin', () => {
  it('returns admin context for valid admin email', async () => {
    mockAdminUser();
    const ctx = await assertAdmin();
    expect(ctx.email).toBe(ADMIN_EMAIL);
    expect(ctx.authUserId).toBe(ADMIN_AUTH_UID);
    expect(ctx.publicUserId).toBe(ADMIN_PUBLIC_ID);
  });

  it('throws for non-admin email', async () => {
    mockNonAdminUser();
    await expect(assertAdmin()).rejects.toThrow('Forbidden: not an admin');
  });

  it('throws for unauthenticated user', async () => {
    mockUnauthenticated();
    await expect(assertAdmin()).rejects.toThrow('Unauthorized');
  });

  it('handles case-insensitive email match', async () => {
    process.env.ADMIN_EMAILS = 'Admin@LocalVector.AI';
    mockGetUser.mockResolvedValue({
      data: { user: { id: ADMIN_AUTH_UID, email: 'admin@localvector.ai' } },
    });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: ADMIN_PUBLIC_ID },
          }),
        }),
      }),
    });
    const ctx = await assertAdmin();
    expect(ctx.email).toBe('admin@localvector.ai');
  });

  it('handles whitespace-trimmed email match', async () => {
    process.env.ADMIN_EMAILS = `  ${ADMIN_EMAIL}  , other@test.com  `;
    mockGetUser.mockResolvedValue({
      data: { user: { id: ADMIN_AUTH_UID, email: ADMIN_EMAIL } },
    });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: ADMIN_PUBLIC_ID },
          }),
        }),
      }),
    });
    const ctx = await assertAdmin();
    expect(ctx.email).toBe(ADMIN_EMAIL);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. logAdminAction
// ═══════════════════════════════════════════════════════════════════════════

describe('logAdminAction', () => {
  it('inserts into admin_audit_log', async () => {
    const insertFn = vi.fn().mockResolvedValue({ error: null });
    mockServiceFrom.mockReturnValue({ insert: insertFn });

    await logAdminAction(ADMIN_EMAIL, 'test_action', TARGET_ORG_ID, { foo: 'bar' });

    expect(mockServiceFrom).toHaveBeenCalledWith('admin_audit_log');
    expect(insertFn).toHaveBeenCalledWith({
      admin_email: ADMIN_EMAIL,
      action: 'test_action',
      target_org_id: TARGET_ORG_ID,
      details: { foo: 'bar' },
    });
  });

  it('handles DB error without throwing', async () => {
    mockServiceFrom.mockReturnValue({
      insert: vi.fn().mockRejectedValue(new Error('DB connection failed')),
    });

    // Should not throw
    await logAdminAction(ADMIN_EMAIL, 'test_action', null);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. adminOverridePlan
// ═══════════════════════════════════════════════════════════════════════════

describe('adminOverridePlan', () => {
  it('changes plan to growth and updates org + credits', async () => {
    mockAdminUser();

    // Mock service calls for: org lookup, org update, credits lookup, credits update, audit log
    let callIndex = 0;
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'organizations' && callIndex === 0) {
        callIndex++;
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { plan: 'trial' } }),
            }),
          }),
        };
      }
      if (table === 'organizations') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'api_credits' && callIndex <= 2) {
        callIndex++;
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'credits-1' } }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'admin_audit_log') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return mockServiceChain();
    });

    const result = await adminOverridePlan(TARGET_ORG_ID, 'growth', 'Customer request');
    expect(result.success).toBe(true);
    expect(mockRevalidatePath).toHaveBeenCalled();
  });

  it('rejects invalid plan tier', async () => {
    mockAdminUser();

    const result = await adminOverridePlan(TARGET_ORG_ID, 'invalid_plan', 'test');
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('Invalid plan');
  });

  it('rejects unauthorized (non-admin)', async () => {
    mockNonAdminUser();

    const result = await adminOverridePlan(TARGET_ORG_ID, 'growth', 'test');
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('Forbidden');
  });

  it('returns error when org not found', async () => {
    mockAdminUser();
    mockServiceFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });

    const result = await adminOverridePlan(TARGET_ORG_ID, 'growth', 'test');
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe('Organization not found');
  });

  it('handles DB update error gracefully', async () => {
    mockAdminUser();
    let callIndex = 0;
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'organizations' && callIndex === 0) {
        callIndex++;
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { plan: 'trial' } }),
            }),
          }),
        };
      }
      if (table === 'organizations') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: { message: 'DB write failed' } }),
          }),
        };
      }
      return mockServiceChain();
    });

    const result = await adminOverridePlan(TARGET_ORG_ID, 'growth', 'test');
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe('DB write failed');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. adminCancelSubscription
// ═══════════════════════════════════════════════════════════════════════════

describe('adminCancelSubscription', () => {
  it('cancels immediately via Stripe API when subscription exists', async () => {
    mockAdminUser();
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  stripe_subscription_id: 'sub_123',
                  plan: 'growth',
                  name: 'Test Org',
                },
              }),
            }),
          }),
        };
      }
      if (table === 'admin_audit_log') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return mockServiceChain();
    });
    mockStripeSubscriptionCancel.mockResolvedValue({});

    const result = await adminCancelSubscription(TARGET_ORG_ID, true);
    expect(result.success).toBe(true);
    expect(mockStripeSubscriptionCancel).toHaveBeenCalledWith('sub_123');
  });

  it('cancels at period end via Stripe API', async () => {
    mockAdminUser();
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  stripe_subscription_id: 'sub_123',
                  plan: 'growth',
                  name: 'Test Org',
                },
              }),
            }),
          }),
        };
      }
      if (table === 'admin_audit_log') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return mockServiceChain();
    });
    mockStripeSubscriptionUpdate.mockResolvedValue({});

    const result = await adminCancelSubscription(TARGET_ORG_ID, false);
    expect(result.success).toBe(true);
    expect(mockStripeSubscriptionUpdate).toHaveBeenCalledWith('sub_123', {
      cancel_at_period_end: true,
    });
  });

  it('falls back to DB update when no Stripe subscription', async () => {
    mockAdminUser();
    const updateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  stripe_subscription_id: null,
                  plan: 'trial',
                  name: 'Test Org',
                },
              }),
            }),
          }),
          update: updateFn,
        };
      }
      if (table === 'admin_audit_log') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return mockServiceChain();
    });

    const result = await adminCancelSubscription(TARGET_ORG_ID, true);
    expect(result.success).toBe(true);
    expect(mockStripeSubscriptionCancel).not.toHaveBeenCalled();
  });

  it('rejects unauthorized', async () => {
    mockNonAdminUser();
    const result = await adminCancelSubscription(TARGET_ORG_ID, true);
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('Forbidden');
  });

  it('returns error when org not found', async () => {
    mockAdminUser();
    mockServiceFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });

    const result = await adminCancelSubscription(TARGET_ORG_ID, true);
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe('Organization not found');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. adminForceCronRun
// ═══════════════════════════════════════════════════════════════════════════

describe('adminForceCronRun', () => {
  it('calls cron endpoint with CRON_SECRET and returns success', async () => {
    mockAdminUser();
    mockServiceFrom.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ ok: true, queries_run: 5 }),
    });

    const result = await adminForceCronRun('sov');
    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/cron/sov',
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-cron-secret' },
      }),
    );
  });

  it('rejects unknown cron name', async () => {
    mockAdminUser();
    const result = await adminForceCronRun('nonexistent-cron');
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('Unknown cron');
  });

  it('handles cron endpoint error', async () => {
    mockAdminUser();
    mockServiceFrom.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: vi.fn().mockResolvedValue({ error: 'Database error' }),
    });

    const result = await adminForceCronRun('audit');
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('500');
  });

  it('rejects when CRON_SECRET is missing', async () => {
    mockAdminUser();
    delete process.env.CRON_SECRET;

    const result = await adminForceCronRun('sov');
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('CRON_SECRET');
  });

  it('rejects unauthorized', async () => {
    mockNonAdminUser();
    const result = await adminForceCronRun('sov');
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('Forbidden');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. adminStartImpersonation
// ═══════════════════════════════════════════════════════════════════════════

describe('adminStartImpersonation', () => {
  it('creates membership and sets cookies', async () => {
    mockAdminUser();
    mockCookieGet.mockReturnValue(undefined); // No active impersonation

    const insertFn = vi.fn().mockResolvedValue({ error: null });
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: TARGET_ORG_ID, name: 'Target Org' },
              }),
            }),
          }),
        };
      }
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              }),
              neq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { org_id: 'admin-own-org' },
                    }),
                  }),
                }),
              }),
            }),
          }),
          insert: insertFn,
        };
      }
      if (table === 'admin_audit_log') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return mockServiceChain();
    });

    const result = await adminStartImpersonation(TARGET_ORG_ID);
    expect(result.success).toBe(true);
    expect((result as { redirectTo: string }).redirectTo).toBe('/dashboard');
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: ADMIN_PUBLIC_ID,
        org_id: TARGET_ORG_ID,
        role: 'viewer',
      }),
    );
    expect(mockCookieSet).toHaveBeenCalledWith(
      'lv_admin_impersonating',
      TARGET_ORG_ID,
      expect.any(Object),
    );
  });

  it('rejects if already impersonating', async () => {
    mockAdminUser();
    mockCookieGet.mockImplementation((name: string) => {
      if (name === 'lv_admin_impersonating') return { value: 'some-org-id' };
      return undefined;
    });

    const result = await adminStartImpersonation(TARGET_ORG_ID);
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('Already impersonating');
  });

  it('rejects unauthorized', async () => {
    mockNonAdminUser();
    const result = await adminStartImpersonation(TARGET_ORG_ID);
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('Forbidden');
  });

  it('handles existing membership (skips creation)', async () => {
    mockAdminUser();
    mockCookieGet.mockReturnValue(undefined);

    const insertFn = vi.fn();
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: TARGET_ORG_ID, name: 'Target Org' },
              }),
            }),
          }),
        };
      }
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                // Existing membership found
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'existing-membership' },
                }),
              }),
              neq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { org_id: 'admin-own-org' },
                    }),
                  }),
                }),
              }),
            }),
          }),
          insert: insertFn,
        };
      }
      if (table === 'admin_audit_log') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return mockServiceChain();
    });

    const result = await adminStartImpersonation(TARGET_ORG_ID);
    expect(result.success).toBe(true);
    // insert should NOT have been called since membership exists
    expect(insertFn).not.toHaveBeenCalled();
  });

  it('returns error when target org not found', async () => {
    mockAdminUser();
    mockCookieGet.mockReturnValue(undefined);
    mockServiceFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });

    const result = await adminStartImpersonation(TARGET_ORG_ID);
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe('Target organization not found');
  });

  it('logs impersonation to admin_audit_log', async () => {
    mockAdminUser();
    mockCookieGet.mockReturnValue(undefined);

    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: TARGET_ORG_ID, name: 'Target Org' },
              }),
            }),
          }),
        };
      }
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              }),
              neq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                  }),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'admin_audit_log') {
        return { insert: auditInsert };
      }
      return mockServiceChain();
    });

    await adminStartImpersonation(TARGET_ORG_ID);
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        admin_email: ADMIN_EMAIL,
        action: 'impersonate',
        target_org_id: TARGET_ORG_ID,
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. adminStopImpersonation
// ═══════════════════════════════════════════════════════════════════════════

describe('adminStopImpersonation', () => {
  it('deletes membership and clears cookies', async () => {
    mockAdminUser();
    mockCookieGet.mockImplementation((name: string) => {
      if (name === 'lv_admin_impersonating') return { value: TARGET_ORG_ID };
      if (name === 'lv_admin_original_org') return { value: 'admin-own-org' };
      return undefined;
    });

    const deleteFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'memberships') {
        return { delete: deleteFn };
      }
      if (table === 'admin_audit_log') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return mockServiceChain();
    });

    const result = await adminStopImpersonation();
    expect(result.success).toBe(true);
    expect((result as { redirectTo: string }).redirectTo).toBe('/admin/customers');
    expect(mockCookieDelete).toHaveBeenCalledWith('lv_admin_impersonating');
    expect(mockCookieDelete).toHaveBeenCalledWith('lv_admin_original_org');
  });

  it('restores admin original org cookie', async () => {
    mockAdminUser();
    mockCookieGet.mockImplementation((name: string) => {
      if (name === 'lv_admin_impersonating') return { value: TARGET_ORG_ID };
      if (name === 'lv_admin_original_org') return { value: 'admin-own-org' };
      return undefined;
    });

    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'memberships') {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'admin_audit_log') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return mockServiceChain();
    });

    await adminStopImpersonation();
    expect(mockCookieSet).toHaveBeenCalledWith(
      'lv_active_org',
      'admin-own-org',
      expect.any(Object),
    );
  });

  it('handles missing impersonation cookie', async () => {
    mockAdminUser();
    mockCookieGet.mockReturnValue(undefined);

    const result = await adminStopImpersonation();
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('No active impersonation');
  });

  it('logs stop_impersonation to admin_audit_log', async () => {
    mockAdminUser();
    mockCookieGet.mockImplementation((name: string) => {
      if (name === 'lv_admin_impersonating') return { value: TARGET_ORG_ID };
      return undefined;
    });

    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'memberships') {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'admin_audit_log') {
        return { insert: auditInsert };
      }
      return mockServiceChain();
    });

    await adminStopImpersonation();
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'stop_impersonation',
        target_org_id: TARGET_ORG_ID,
      }),
    );
  });

  it('rejects unauthorized', async () => {
    mockNonAdminUser();
    const result = await adminStopImpersonation();
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('Forbidden');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. adminGrantCredits
// ═══════════════════════════════════════════════════════════════════════════

describe('adminGrantCredits', () => {
  it('increases credit limit for existing credits row', async () => {
    mockAdminUser();

    const updateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const creditLogInsert = vi.fn().mockResolvedValue({ error: null });

    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: TARGET_ORG_ID, name: 'Test Org', plan: 'growth' },
              }),
            }),
          }),
        };
      }
      if (table === 'api_credits') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { credits_used: 50, credits_limit: 500 },
              }),
            }),
          }),
          update: updateFn,
        };
      }
      if (table === 'credit_usage_log') {
        return { insert: creditLogInsert };
      }
      if (table === 'admin_audit_log') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return mockServiceChain();
    });

    const result = await adminGrantCredits(TARGET_ORG_ID, 100);
    expect(result.success).toBe(true);
    expect(updateFn).toHaveBeenCalledWith({ credits_limit: 600 });
    expect(creditLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: TARGET_ORG_ID,
        operation: 'admin_grant',
        credits_before: 500,
        credits_after: 600,
      }),
    );
  });

  it('rejects negative amount', async () => {
    mockAdminUser();
    const result = await adminGrantCredits(TARGET_ORG_ID, -10);
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('positive integer');
  });

  it('rejects zero amount', async () => {
    mockAdminUser();
    const result = await adminGrantCredits(TARGET_ORG_ID, 0);
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('positive integer');
  });

  it('rejects amount exceeding maximum', async () => {
    mockAdminUser();
    const result = await adminGrantCredits(TARGET_ORG_ID, 20000);
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('maximum');
  });

  it('rejects unauthorized', async () => {
    mockNonAdminUser();
    const result = await adminGrantCredits(TARGET_ORG_ID, 100);
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('Forbidden');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. isKnownCron
// ═══════════════════════════════════════════════════════════════════════════

describe('isKnownCron', () => {
  it('returns true for valid cron names', () => {
    expect(isKnownCron('sov')).toBe(true);
    expect(isKnownCron('audit')).toBe(true);
    expect(isKnownCron('weekly-digest')).toBe(true);
    expect(isKnownCron('hijack-detection')).toBe(true);
  });

  it('returns false for invalid cron names', () => {
    expect(isKnownCron('nonexistent')).toBe(false);
    expect(isKnownCron('')).toBe(false);
    expect(isKnownCron('SOV')).toBe(false); // case-sensitive
  });
});
