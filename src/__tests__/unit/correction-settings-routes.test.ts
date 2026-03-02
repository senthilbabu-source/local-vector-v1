/**
 * correction-settings-routes.test.ts — Sprint 121
 *
 * 14 tests covering:
 * - POST /api/hallucinations/[id]/correct (5 tests)
 * - PUT /api/settings (4 tests)
 * - DELETE /api/settings/danger/delete-scan-data (4 tests)
 * - POST /api/settings/api-keys (1 test)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks — declared before vi.mock calls
// ---------------------------------------------------------------------------

const mockGetSafeAuthContext = vi.fn();
const mockRoleSatisfies = vi.fn();
const mockMarkHallucinationCorrected = vi.fn();
const mockUpdateOrgSettings = vi.fn();
const mockGenerateApiKey = vi.fn();
const mockListApiKeys = vi.fn();
const mockCreateClient = vi.fn();
const mockCreateServiceRoleClient = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
}));

vi.mock('@/lib/auth/org-roles', () => ({
  roleSatisfies: (...args: unknown[]) => mockRoleSatisfies(...args),
}));

vi.mock('@/lib/corrections', () => ({
  markHallucinationCorrected: (...args: unknown[]) =>
    mockMarkHallucinationCorrected(...args),
}));

vi.mock('@/lib/settings', () => ({
  updateOrgSettings: (...args: unknown[]) => mockUpdateOrgSettings(...args),
  generateApiKey: (...args: unknown[]) => mockGenerateApiKey(...args),
  listApiKeys: (...args: unknown[]) => mockListApiKeys(...args),
  getOrCreateOrgSettings: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
  createServiceRoleClient: () => mockCreateServiceRoleClient(),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Route handler imports (after mocks)
// ---------------------------------------------------------------------------

import { POST as correctHallucination } from '@/app/api/hallucinations/[id]/correct/route';
import { PUT as updateSettings } from '@/app/api/settings/route';
import { DELETE as deleteScanData } from '@/app/api/settings/danger/delete-scan-data/route';
import { POST as createApiKey } from '@/app/api/settings/api-keys/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authCtx(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'auth-uid-001',
    email: 'admin@localvector.ai',
    orgId: 'org-001',
    role: 'owner',
    plan: 'agency',
    onboarding_completed: true,
    ...overrides,
  };
}

function createRequest(
  url: string,
  method: string,
  body?: unknown,
): NextRequest {
  const init: Record<string, unknown> = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return new NextRequest(url, init as never);
}

function mockSupabaseClient() {
  const deleteChain = {
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const client = {
    from: vi.fn().mockReturnValue(deleteChain),
  };
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();

  // Default: real role hierarchy
  mockRoleSatisfies.mockImplementation(
    (current: string | null, required: string) => {
      const hierarchy: Record<string, number> = {
        viewer: 0,
        member: 0,
        analyst: 0,
        admin: 1,
        owner: 2,
      };
      return (hierarchy[current ?? ''] ?? 0) >= (hierarchy[required] ?? 0);
    },
  );

  // Default: createClient returns a minimal supabase mock
  mockCreateClient.mockResolvedValue({ from: vi.fn() });
});

// ==========================================================================
// POST /api/hallucinations/[id]/correct
// ==========================================================================

describe('POST /api/hallucinations/[id]/correct', () => {
  const hallId = 'hall-abc-123';
  const url = `http://localhost/api/hallucinations/${hallId}/correct`;
  const routeParams = { params: Promise.resolve({ id: hallId }) };

  it('returns 401 when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);

    const req = createRequest(url, 'POST', {});
    const res = await correctHallucination(req, routeParams);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 for member role (roleSatisfies returns false for admin)', async () => {
    mockGetSafeAuthContext.mockResolvedValue(authCtx({ role: 'member' }));
    // member < admin → roleSatisfies('member', 'admin') returns false

    const req = createRequest(url, 'POST', {});
    const res = await correctHallucination(req, routeParams);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('insufficient_role');
  });

  it('returns 400 hallucination_not_found when service throws', async () => {
    mockGetSafeAuthContext.mockResolvedValue(authCtx({ role: 'admin' }));
    mockMarkHallucinationCorrected.mockRejectedValue(
      new Error('hallucination_not_found'),
    );

    const req = createRequest(url, 'POST', {});
    const res = await correctHallucination(req, routeParams);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('hallucination_not_found');
  });

  it('returns 400 already_corrected when service throws', async () => {
    mockGetSafeAuthContext.mockResolvedValue(authCtx({ role: 'owner' }));
    mockMarkHallucinationCorrected.mockRejectedValue(
      new Error('already_corrected'),
    );

    const req = createRequest(url, 'POST', {});
    const res = await correctHallucination(req, routeParams);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('already_corrected');
  });

  it('returns { ok: true, follow_up_id, brief_generating: true } on success', async () => {
    mockGetSafeAuthContext.mockResolvedValue(authCtx({ role: 'admin' }));
    mockMarkHallucinationCorrected.mockResolvedValue({
      follow_up: {
        id: 'fu-001',
        hallucination_id: hallId,
        org_id: 'org-001',
        correction_brief_id: 'brief-001',
        rescan_due_at: '2026-03-09T00:00:00Z',
        rescan_completed_at: null,
        rescan_status: 'pending',
        rescan_ai_response: null,
        created_at: '2026-03-02T00:00:00Z',
        updated_at: '2026-03-02T00:00:00Z',
      },
      brief_id: 'brief-001',
    });

    const req = createRequest(url, 'POST', { notes: 'Fixed schema markup' });
    const res = await correctHallucination(req, routeParams);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.follow_up_id).toBe('fu-001');
    expect(body.brief_generating).toBe(true);
  });
});

// ==========================================================================
// PUT /api/settings
// ==========================================================================

describe('PUT /api/settings', () => {
  const url = 'http://localhost/api/settings';

  it('returns 403 for member role', async () => {
    mockGetSafeAuthContext.mockResolvedValue(authCtx({ role: 'member' }));

    const req = createRequest(url, 'PUT', {
      scan_frequency: 'weekly',
    });
    const res = await updateSettings(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('insufficient_role');
  });

  it('returns 400 for invalid scan_frequency', async () => {
    mockGetSafeAuthContext.mockResolvedValue(authCtx({ role: 'admin' }));
    mockUpdateOrgSettings.mockRejectedValue(
      new Error('invalid_scan_frequency'),
    );

    const req = createRequest(url, 'PUT', {
      scan_frequency: 'daily',
    });
    const res = await updateSettings(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_scan_frequency');
  });

  it('returns 400 for invalid webhook URL', async () => {
    mockGetSafeAuthContext.mockResolvedValue(authCtx({ role: 'owner' }));
    mockUpdateOrgSettings.mockRejectedValue(new Error('invalid_webhook_url'));

    const req = createRequest(url, 'PUT', {
      notify_slack_webhook_url: 'not-a-url',
    });
    const res = await updateSettings(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_webhook_url');
  });

  it('returns updated OrgSettings on success', async () => {
    mockGetSafeAuthContext.mockResolvedValue(authCtx({ role: 'admin' }));

    const updatedSettings = {
      id: 'settings-001',
      org_id: 'org-001',
      notify_email_digest: true,
      notify_slack_webhook_url: 'https://hooks.slack.com/services/xxx',
      notify_in_app: true,
      notify_sov_drop_threshold: 10,
      scan_frequency: 'bi-weekly',
      created_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-03-02T00:00:00Z',
    };
    mockUpdateOrgSettings.mockResolvedValue(updatedSettings);

    const req = createRequest(url, 'PUT', {
      scan_frequency: 'bi-weekly',
      notify_email_digest: true,
    });
    const res = await updateSettings(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('settings-001');
    expect(body.org_id).toBe('org-001');
    expect(body.scan_frequency).toBe('bi-weekly');
    expect(body.notify_email_digest).toBe(true);
    expect(body.notify_slack_webhook_url).toBe(
      'https://hooks.slack.com/services/xxx',
    );
  });
});

// ==========================================================================
// DELETE /api/settings/danger/delete-scan-data
// ==========================================================================

describe('DELETE /api/settings/danger/delete-scan-data', () => {
  const url = 'http://localhost/api/settings/danger/delete-scan-data';

  it('returns 400 when confirmation is missing', async () => {
    mockGetSafeAuthContext.mockResolvedValue(authCtx({ role: 'owner' }));

    const req = createRequest(url, 'DELETE', {});
    const res = await deleteScanData(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('confirmation_required');
  });

  it('returns 400 when confirmation != DELETE', async () => {
    mockGetSafeAuthContext.mockResolvedValue(authCtx({ role: 'owner' }));

    const req = createRequest(url, 'DELETE', { confirmation: 'CONFIRM' });
    const res = await deleteScanData(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('wrong_confirmation');
  });

  it('returns 403 for admin role (owner only)', async () => {
    mockGetSafeAuthContext.mockResolvedValue(authCtx({ role: 'admin' }));
    // admin < owner → roleSatisfies('admin', 'owner') returns false

    const req = createRequest(url, 'DELETE', { confirmation: 'DELETE' });
    const res = await deleteScanData(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('owner_required');
  });

  it('deletes scan data and returns ok', async () => {
    mockGetSafeAuthContext.mockResolvedValue(authCtx({ role: 'owner' }));

    const deleteChain = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const client = { from: vi.fn().mockReturnValue(deleteChain) };
    mockCreateServiceRoleClient.mockReturnValue(client);

    const req = createRequest(url, 'DELETE', { confirmation: 'DELETE' });
    const res = await deleteScanData(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.deleted_at).toBeDefined();

    // Should delete from 3 tables in order
    expect(client.from).toHaveBeenCalledWith('correction_follow_ups');
    expect(client.from).toHaveBeenCalledWith('ai_hallucinations');
    expect(client.from).toHaveBeenCalledWith('sov_evaluations');
  });
});

// ==========================================================================
// POST /api/settings/api-keys
// ==========================================================================

describe('POST /api/settings/api-keys', () => {
  const url = 'http://localhost/api/settings/api-keys';

  it('returns raw_key present in response', async () => {
    mockGetSafeAuthContext.mockResolvedValue(authCtx({ role: 'owner' }));

    const fakeResult = {
      api_key: {
        id: 'key-001',
        org_id: 'org-001',
        name: 'Production Key',
        key_prefix: 'lv_abc',
        created_by: 'auth-uid-001',
        last_used_at: null,
        expires_at: null,
        is_active: true,
        created_at: '2026-03-02T00:00:00Z',
      },
      raw_key: 'lv_abc_sk_test_longkeyvalue',
    };
    mockGenerateApiKey.mockResolvedValue(fakeResult);

    const req = createRequest(url, 'POST', { name: 'Production Key' });
    const res = await createApiKey(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.raw_key).toBe('lv_abc_sk_test_longkeyvalue');
    expect(body.api_key.id).toBe('key-001');
    expect(body.api_key.name).toBe('Production Key');
    expect(body.warning).toBe(
      'Copy this key now. It will not be shown again.',
    );
  });
});
