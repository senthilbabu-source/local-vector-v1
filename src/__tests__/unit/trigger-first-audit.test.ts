// ---------------------------------------------------------------------------
// trigger-first-audit.test.ts — Unit tests for triggerFirstAudit action
//
// Sprint 91: 5 tests — mocks auth + processOrgAudit.
//
// Run:
//   npx vitest run src/__tests__/unit/trigger-first-audit.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetSafeAuthContext = vi.fn();
const mockProcessOrgAudit = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({}),
  createServiceRoleClient: () => ({}),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/services/sov-seed', () => ({
  seedSOVQueries: vi.fn().mockResolvedValue({ seeded: 0 }),
}));

vi.mock('@/lib/inngest/functions/audit-cron', () => ({
  processOrgAudit: (...args: unknown[]) => mockProcessOrgAudit(...args),
}));

import { triggerFirstAudit } from '@/app/onboarding/actions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH_CTX = {
  userId: 'u1',
  email: 'test@test.com',
  fullName: null,
  orgId: 'org-1',
  orgName: 'Test Org',
  role: 'owner' as const,
  plan: 'trial',
  onboarding_completed: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('triggerFirstAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { success: false } when user is not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const result = await triggerFirstAudit();
    expect(result.success).toBe(false);
  });

  it('calls processOrgAudit with the correct org info', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    mockProcessOrgAudit.mockResolvedValue({
      success: true,
      hallucinationsInserted: 2,
      auditId: 'audit-123',
    });

    await triggerFirstAudit();
    expect(mockProcessOrgAudit).toHaveBeenCalledWith({
      id: 'org-1',
      name: 'Test Org',
    });
  });

  it('returns { success: true, auditId } on success', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    mockProcessOrgAudit.mockResolvedValue({
      success: true,
      hallucinationsInserted: 2,
      auditId: 'audit-123',
    });

    const result = await triggerFirstAudit();
    expect(result).toEqual({ success: true, auditId: 'audit-123' });
  });

  it('returns { success: false, error } when processOrgAudit throws — does NOT throw', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    mockProcessOrgAudit.mockRejectedValue(new Error('AI API unavailable'));

    const result = await triggerFirstAudit();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('AI API unavailable');
    }
  });

  it('failure is non-blocking — function returns normally without throwing', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    mockProcessOrgAudit.mockRejectedValue(new Error('timeout'));

    // Should NOT throw
    await expect(triggerFirstAudit()).resolves.toBeDefined();
  });
});
