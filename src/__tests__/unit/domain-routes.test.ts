/**
 * Domain Routes Tests — Sprint 114
 *
 * 21 tests covering:
 * - GET  /api/whitelabel/domain          (3 tests)
 * - POST /api/whitelabel/domain          (8 tests)
 * - DELETE /api/whitelabel/domain        (4 tests)
 * - POST /api/whitelabel/domain/verify   (6 tests)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks — hoisted before module imports
// ---------------------------------------------------------------------------

const {
  mockGetSafeAuthContext,
  mockRoleSatisfies,
  mockCanManageTeamSeats,
  mockGetDomainConfig,
  mockUpsertCustomDomain,
  mockRemoveCustomDomain,
  mockUpdateVerificationStatus,
  mockVerifyCustomDomain,
  mockInvalidateDomainCache,
  mockCaptureException,
} = vi.hoisted(() => ({
  mockGetSafeAuthContext: vi.fn(),
  mockRoleSatisfies: vi.fn(),
  mockCanManageTeamSeats: vi.fn(),
  mockGetDomainConfig: vi.fn(),
  mockUpsertCustomDomain: vi.fn(),
  mockRemoveCustomDomain: vi.fn(),
  mockUpdateVerificationStatus: vi.fn(),
  mockVerifyCustomDomain: vi.fn(),
  mockInvalidateDomainCache: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(() => ({ from: vi.fn() })),
}));

vi.mock('@/lib/auth/org-roles', () => ({
  roleSatisfies: (...args: unknown[]) => mockRoleSatisfies(...args),
}));

vi.mock('@/lib/plan-enforcer', () => ({
  canManageTeamSeats: (...args: unknown[]) => mockCanManageTeamSeats(...args),
}));

vi.mock('@/lib/whitelabel/domain-service', () => ({
  getDomainConfig: (...args: unknown[]) => mockGetDomainConfig(...args),
  upsertCustomDomain: (...args: unknown[]) => mockUpsertCustomDomain(...args),
  removeCustomDomain: (...args: unknown[]) => mockRemoveCustomDomain(...args),
  updateVerificationStatus: (...args: unknown[]) => mockUpdateVerificationStatus(...args),
  DomainError: class extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.name = 'DomainError';
      this.code = code;
    }
  },
}));

vi.mock('@/lib/whitelabel/dns-verifier', () => ({
  verifyCustomDomain: (...args: unknown[]) => mockVerifyCustomDomain(...args),
}));

vi.mock('@/lib/whitelabel/domain-resolver', () => ({
  invalidateDomainCache: (...args: unknown[]) => mockInvalidateDomainCache(...args),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

// Import routes after mocks
import { GET, POST, DELETE } from '@/app/api/whitelabel/domain/route';
import { POST as VERIFY_POST } from '@/app/api/whitelabel/domain/verify/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockAuthCtx(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'auth-uid-001',
    email: 'test-owner@charcoalnchill.com',
    fullName: 'Test Owner',
    orgId: 'org-001',
    orgName: 'Charcoal N Chill',
    role: 'owner',
    plan: 'agency',
    onboarding_completed: true,
    ...overrides,
  };
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/whitelabel/domain', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const MOCK_DOMAIN_ROW = {
  id: 'dom-001',
  org_id: 'org-001',
  domain_type: 'custom' as const,
  domain_value: 'app.example.com',
  verification_token: 'localvector-verify=abc123',
  verification_status: 'unverified' as const,
  verified_at: null,
  last_checked_at: null,
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
};

const MOCK_DOMAIN_CONFIG = {
  effective_domain: 'charcoal-n-chill.localvector.ai',
  subdomain: 'charcoal-n-chill',
  custom_domain: MOCK_DOMAIN_ROW,
  subdomain_domain: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: owner + Agency (happy path)
  mockRoleSatisfies.mockImplementation((current: string | null, required: string) => {
    const hierarchy: Record<string, number> = { viewer: 0, member: 0, analyst: 0, admin: 1, owner: 2 };
    return (hierarchy[current ?? ''] ?? 0) >= (hierarchy[required] ?? 0);
  });
  mockCanManageTeamSeats.mockReturnValue(true);
});

// =============================================================================
// GET /api/whitelabel/domain
// =============================================================================

describe('GET /api/whitelabel/domain', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);

    const response = await GET();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('unauthenticated');
  });

  it('returns { domain_config: null, upgrade_required: true } for non-Agency plan', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx({ plan: 'growth' }));
    mockCanManageTeamSeats.mockReturnValue(false);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.domain_config).toBeNull();
    expect(body.upgrade_required).toBe(true);
  });

  it('returns DomainConfig for Agency plan member', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx());
    mockGetDomainConfig.mockResolvedValue(MOCK_DOMAIN_CONFIG);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.domain_config).toEqual(MOCK_DOMAIN_CONFIG);
    expect(body.upgrade_required).toBe(false);
  });
});

// =============================================================================
// POST /api/whitelabel/domain
// =============================================================================

describe('POST /api/whitelabel/domain', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);

    const response = await POST(makePostRequest({ custom_domain: 'app.example.com' }));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('unauthenticated');
  });

  it("returns 403 'plan_upgrade_required' for non-Agency plan", async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx({ plan: 'growth' }));
    mockCanManageTeamSeats.mockReturnValue(false);

    const response = await POST(makePostRequest({ custom_domain: 'app.example.com' }));
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('plan_upgrade_required');
  });

  it("returns 403 'not_owner' for admin/analyst/viewer", async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx({ role: 'admin' }));

    const response = await POST(makePostRequest({ custom_domain: 'app.example.com' }));
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('not_owner');
  });

  it("returns 400 'invalid_domain_format' for bad domain", async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx());
    // Import DomainError from the mocked module to throw the right type
    const { DomainError } = await import('@/lib/whitelabel/domain-service');
    mockUpsertCustomDomain.mockRejectedValue(new DomainError('invalid_domain_format'));

    const response = await POST(makePostRequest({ custom_domain: 'not a valid domain!' }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('invalid_domain_format');
  });

  it("returns 400 'localvector_domain_not_allowed' for *.localvector.ai domain", async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx());

    const response = await POST(makePostRequest({ custom_domain: 'myapp.localvector.ai' }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('localvector_domain_not_allowed');
  });

  it("returns 409 'domain_taken' when domain is verified by another org", async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx());
    const { DomainError } = await import('@/lib/whitelabel/domain-service');
    mockUpsertCustomDomain.mockRejectedValue(new DomainError('domain_taken'));

    const response = await POST(makePostRequest({ custom_domain: 'taken.example.com' }));
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe('domain_taken');
  });

  it('returns { ok: true, domain, dns_instructions } on success', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx());
    mockUpsertCustomDomain.mockResolvedValue(MOCK_DOMAIN_ROW);

    const response = await POST(makePostRequest({ custom_domain: 'app.example.com' }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.domain).toEqual(MOCK_DOMAIN_ROW);
    expect(body.dns_instructions).toBeDefined();
  });

  it('dns_instructions contains cname_record and txt_record', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx());
    mockUpsertCustomDomain.mockResolvedValue(MOCK_DOMAIN_ROW);

    const response = await POST(makePostRequest({ custom_domain: 'app.example.com' }));
    const body = await response.json();
    const dns = body.dns_instructions;

    expect(dns.cname_record).toEqual({
      type: 'CNAME',
      name: 'app.example.com',
      value: 'proxy.localvector.ai',
    });
    expect(dns.txt_record).toEqual({
      type: 'TXT',
      name: 'app.example.com',
      value: MOCK_DOMAIN_ROW.verification_token,
    });
  });
});

// =============================================================================
// DELETE /api/whitelabel/domain
// =============================================================================

describe('DELETE /api/whitelabel/domain', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);

    const response = await DELETE();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('unauthenticated');
  });

  it('returns 403 for non-owner', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx({ role: 'admin' }));

    const response = await DELETE();
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('not_owner');
  });

  it('returns { ok: true } on success', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx());
    mockGetDomainConfig.mockResolvedValue(MOCK_DOMAIN_CONFIG);
    mockRemoveCustomDomain.mockResolvedValue({ success: true });
    mockInvalidateDomainCache.mockResolvedValue(undefined);

    const response = await DELETE();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  it('invalidates Redis cache for removed domain', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx());
    mockGetDomainConfig.mockResolvedValue(MOCK_DOMAIN_CONFIG);
    mockRemoveCustomDomain.mockResolvedValue({ success: true });
    mockInvalidateDomainCache.mockResolvedValue(undefined);

    await DELETE();

    expect(mockInvalidateDomainCache).toHaveBeenCalledWith('app.example.com');
  });
});

// =============================================================================
// POST /api/whitelabel/domain/verify
// =============================================================================

describe('POST /api/whitelabel/domain/verify', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);

    const response = await VERIFY_POST();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('unauthenticated');
  });

  it("returns 404 'no_custom_domain' when no custom domain configured", async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx());
    mockGetDomainConfig.mockResolvedValue({
      effective_domain: 'charcoal-n-chill.localvector.ai',
      subdomain: 'charcoal-n-chill',
      custom_domain: null,
      subdomain_domain: null,
    });

    const response = await VERIFY_POST();
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('no_custom_domain');
  });

  it('returns DomainVerificationResult with verified=true on DNS match', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx());
    mockGetDomainConfig.mockResolvedValue(MOCK_DOMAIN_CONFIG);
    mockUpdateVerificationStatus.mockResolvedValue(null);

    const verifiedResult = {
      verified: true,
      status: 'verified',
      checked_at: '2026-03-01T12:00:00Z',
      error: null,
    };
    mockVerifyCustomDomain.mockResolvedValue(verifiedResult);
    mockInvalidateDomainCache.mockResolvedValue(undefined);

    const response = await VERIFY_POST();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.verified).toBe(true);
    expect(body.status).toBe('verified');
    expect(body.error).toBeNull();
  });

  it('returns DomainVerificationResult with verified=false on no DNS match', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx());
    mockGetDomainConfig.mockResolvedValue(MOCK_DOMAIN_CONFIG);
    mockUpdateVerificationStatus.mockResolvedValue(null);

    const failedResult = {
      verified: false,
      status: 'failed',
      checked_at: '2026-03-01T12:00:00Z',
      error: 'TXT record not found',
    };
    mockVerifyCustomDomain.mockResolvedValue(failedResult);

    const response = await VERIFY_POST();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.verified).toBe(false);
    expect(body.status).toBe('failed');
    expect(body.error).toBe('TXT record not found');
  });

  it("sets status='pending' in DB before DNS check", async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx());
    mockGetDomainConfig.mockResolvedValue(MOCK_DOMAIN_CONFIG);
    mockUpdateVerificationStatus.mockResolvedValue(null);

    const verifiedResult = {
      verified: true,
      status: 'verified',
      checked_at: '2026-03-01T12:00:00Z',
      error: null,
    };
    mockVerifyCustomDomain.mockResolvedValue(verifiedResult);
    mockInvalidateDomainCache.mockResolvedValue(undefined);

    await VERIFY_POST();

    // First call to updateVerificationStatus should set status='pending'
    expect(mockUpdateVerificationStatus).toHaveBeenCalledTimes(2);
    const firstCall = mockUpdateVerificationStatus.mock.calls[0];
    expect(firstCall[2]).toMatchObject({
      verified: false,
      status: 'pending',
      error: null,
    });
  });

  it('invalidates Redis cache when domain becomes verified', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx());
    mockGetDomainConfig.mockResolvedValue(MOCK_DOMAIN_CONFIG);
    mockUpdateVerificationStatus.mockResolvedValue(null);

    const verifiedResult = {
      verified: true,
      status: 'verified',
      checked_at: '2026-03-01T12:00:00Z',
      error: null,
    };
    mockVerifyCustomDomain.mockResolvedValue(verifiedResult);
    mockInvalidateDomainCache.mockResolvedValue(undefined);

    await VERIFY_POST();

    expect(mockInvalidateDomainCache).toHaveBeenCalledWith('app.example.com');
  });
});
