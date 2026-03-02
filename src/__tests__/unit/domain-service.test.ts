/**
 * Domain Service Tests — Sprint 114
 *
 * 22 tests covering:
 * - generateOrgSlug (pure function, 6 tests)
 * - getDomainConfig (Supabase mocked, 5 tests)
 * - upsertCustomDomain (Supabase mocked, 6 tests)
 * - removeCustomDomain (Supabase mocked, 2 tests)
 * - updateVerificationStatus (Supabase mocked, 3 tests)
 */

import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  generateOrgSlug,
  getDomainConfig,
  upsertCustomDomain,
  removeCustomDomain,
  updateVerificationStatus,
  DomainError,
} from '@/lib/whitelabel/domain-service';
import type { OrgDomain, DomainVerificationResult } from '@/lib/whitelabel/types';
import { SUBDOMAIN_BASE } from '@/lib/whitelabel/types';

// ---------------------------------------------------------------------------
// Supabase mock helper
// ---------------------------------------------------------------------------

function buildChainMock(resolvedValue: { data: unknown; error: unknown } = { data: null, error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;

  for (const method of [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'not',
    'filter', 'order', 'limit', 'range', 'match',
  ]) {
    chain[method] = vi.fn(self);
  }
  chain.single = vi.fn().mockResolvedValue(resolvedValue);
  chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  return chain;
}

function createMockSupabase(chainOverride?: ReturnType<typeof buildChainMock>) {
  const chain = chainOverride ?? buildChainMock();
  return {
    from: vi.fn(() => chain),
  } as unknown as SupabaseClient<Database>;
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function makeDomainRow(overrides: Partial<OrgDomain> = {}): OrgDomain {
  return {
    id: 'dom-001',
    org_id: TEST_ORG_ID,
    domain_type: 'custom',
    domain_value: 'my-restaurant.com',
    verification_token: 'localvector-verify=abc123',
    verification_status: 'unverified',
    verified_at: null,
    last_checked_at: null,
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// generateOrgSlug — pure
// ═══════════════════════════════════════════════════════════════════════════

describe('generateOrgSlug — pure', () => {
  it("'Charcoal N Chill' → 'charcoal-n-chill'", () => {
    expect(generateOrgSlug('Charcoal N Chill')).toBe('charcoal-n-chill');
  });

  it("\"Aruna's Cafe & Bar\" → 'arunas-cafe-bar' (special chars stripped)", () => {
    expect(generateOrgSlug("Aruna's Café & Bar")).toBe('arunas-caf-bar');
  });

  it("'My   Business' (multiple spaces) → 'my-business'", () => {
    expect(generateOrgSlug('My   Business')).toBe('my-business');
  });

  it("'A'.repeat(70) → truncated to 63 chars", () => {
    const result = generateOrgSlug('A'.repeat(70));
    expect(result.length).toBeLessThanOrEqual(63);
    expect(result).toBe('a'.repeat(63));
  });

  it('leading/trailing hyphens stripped', () => {
    expect(generateOrgSlug(' --My Brand-- ')).toBe('my-brand');
  });

  it("existing hyphens preserved: 'my-brand-co' → 'my-brand-co'", () => {
    expect(generateOrgSlug('my-brand-co')).toBe('my-brand-co');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getDomainConfig — Supabase mocked
// ═══════════════════════════════════════════════════════════════════════════

describe('getDomainConfig — Supabase mocked', () => {
  it('returns subdomain and custom domain rows when both exist', async () => {
    const subdomainRow = makeDomainRow({
      id: 'dom-sub',
      domain_type: 'subdomain',
      domain_value: `charcoal-n-chill.${SUBDOMAIN_BASE}`,
      verification_status: 'verified',
    });
    const customRow = makeDomainRow({
      id: 'dom-cust',
      domain_type: 'custom',
      domain_value: 'my-restaurant.com',
      verification_status: 'verified',
      verified_at: '2026-03-01T12:00:00.000Z',
    });

    // Call 1: organizations.select('slug') → single()
    const orgChain = buildChainMock({ data: { slug: 'charcoal-n-chill' }, error: null });
    // Call 2: org_domains.select('*').eq('org_id', ...) → resolves as array
    const domainChain = buildChainMock();
    domainChain.eq = vi.fn().mockResolvedValue({ data: [subdomainRow, customRow], error: null });

    let callCount = 0;
    const supabase = {
      from: vi.fn(() => {
        callCount++;
        if (callCount === 1) return orgChain;   // organizations
        return domainChain;                       // org_domains
      }),
    } as unknown as SupabaseClient<Database>;

    const config = await getDomainConfig(supabase, TEST_ORG_ID);

    expect(config.subdomain).toBe('charcoal-n-chill');
    expect(config.subdomain_domain).not.toBeNull();
    expect(config.custom_domain).not.toBeNull();
    expect(config.custom_domain!.domain_value).toBe('my-restaurant.com');
  });

  it('effective_domain = custom domain when custom is verified', async () => {
    const customRow = makeDomainRow({
      domain_type: 'custom',
      domain_value: 'verified-restaurant.com',
      verification_status: 'verified',
      verified_at: '2026-03-01T12:00:00.000Z',
    });

    const orgChain = buildChainMock({ data: { slug: 'my-org' }, error: null });
    const domainChain = buildChainMock();
    domainChain.eq = vi.fn().mockResolvedValue({ data: [customRow], error: null });

    let callCount = 0;
    const supabase = {
      from: vi.fn(() => {
        callCount++;
        if (callCount === 1) return orgChain;
        return domainChain;
      }),
    } as unknown as SupabaseClient<Database>;

    const config = await getDomainConfig(supabase, TEST_ORG_ID);

    expect(config.effective_domain).toBe('verified-restaurant.com');
  });

  it('effective_domain = subdomain when custom is unverified', async () => {
    const customRow = makeDomainRow({
      domain_type: 'custom',
      domain_value: 'pending-restaurant.com',
      verification_status: 'unverified',
    });

    const orgChain = buildChainMock({ data: { slug: 'my-org' }, error: null });
    const domainChain = buildChainMock();
    domainChain.eq = vi.fn().mockResolvedValue({ data: [customRow], error: null });

    let callCount = 0;
    const supabase = {
      from: vi.fn(() => {
        callCount++;
        if (callCount === 1) return orgChain;
        return domainChain;
      }),
    } as unknown as SupabaseClient<Database>;

    const config = await getDomainConfig(supabase, TEST_ORG_ID);

    expect(config.effective_domain).toBe(`my-org.${SUBDOMAIN_BASE}`);
  });

  it('effective_domain = subdomain when custom domain is null', async () => {
    const orgChain = buildChainMock({ data: { slug: 'solo-org' }, error: null });
    const domainChain = buildChainMock();
    domainChain.eq = vi.fn().mockResolvedValue({ data: [], error: null });

    let callCount = 0;
    const supabase = {
      from: vi.fn(() => {
        callCount++;
        if (callCount === 1) return orgChain;
        return domainChain;
      }),
    } as unknown as SupabaseClient<Database>;

    const config = await getDomainConfig(supabase, TEST_ORG_ID);

    expect(config.effective_domain).toBe(`solo-org.${SUBDOMAIN_BASE}`);
    expect(config.custom_domain).toBeNull();
  });

  it('returns null custom_domain when only subdomain row exists', async () => {
    const subdomainRow = makeDomainRow({
      domain_type: 'subdomain',
      domain_value: `only-sub.${SUBDOMAIN_BASE}`,
      verification_status: 'verified',
    });

    const orgChain = buildChainMock({ data: { slug: 'only-sub' }, error: null });
    const domainChain = buildChainMock();
    domainChain.eq = vi.fn().mockResolvedValue({ data: [subdomainRow], error: null });

    let callCount = 0;
    const supabase = {
      from: vi.fn(() => {
        callCount++;
        if (callCount === 1) return orgChain;
        return domainChain;
      }),
    } as unknown as SupabaseClient<Database>;

    const config = await getDomainConfig(supabase, TEST_ORG_ID);

    expect(config.subdomain_domain).not.toBeNull();
    expect(config.custom_domain).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// upsertCustomDomain — Supabase mocked
// ═══════════════════════════════════════════════════════════════════════════

describe('upsertCustomDomain — Supabase mocked', () => {
  it("throws 'invalid_domain_format' for 'notadomain'", async () => {
    const supabase = createMockSupabase();

    await expect(
      upsertCustomDomain(supabase, TEST_ORG_ID, 'notadomain'),
    ).rejects.toThrow(DomainError);

    try {
      await upsertCustomDomain(supabase, TEST_ORG_ID, 'notadomain');
    } catch (err) {
      expect((err as DomainError).code).toBe('invalid_domain_format');
    }
  });

  it("throws 'invalid_domain_format' for 'https://example.com'", async () => {
    const supabase = createMockSupabase();

    await expect(
      upsertCustomDomain(supabase, TEST_ORG_ID, 'https://example.com'),
    ).rejects.toThrow(DomainError);

    try {
      await upsertCustomDomain(supabase, TEST_ORG_ID, 'https://example.com');
    } catch (err) {
      expect((err as DomainError).code).toBe('invalid_domain_format');
    }
  });

  it("throws 'invalid_domain_format' for 'example.com/path'", async () => {
    const supabase = createMockSupabase();

    await expect(
      upsertCustomDomain(supabase, TEST_ORG_ID, 'example.com/path'),
    ).rejects.toThrow(DomainError);

    try {
      await upsertCustomDomain(supabase, TEST_ORG_ID, 'example.com/path');
    } catch (err) {
      expect((err as DomainError).code).toBe('invalid_domain_format');
    }
  });

  it("throws 'domain_taken' when domain verified by another org", async () => {
    // First call: org_domains.select() conflict check → returns a row owned by different org
    const conflictChain = buildChainMock();
    conflictChain.eq = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [{ org_id: 'other-org-id', verification_status: 'verified' }],
        error: null,
      }),
    });

    const supabase = {
      from: vi.fn(() => conflictChain),
    } as unknown as SupabaseClient<Database>;

    await expect(
      upsertCustomDomain(supabase, TEST_ORG_ID, 'taken-domain.com'),
    ).rejects.toThrow(DomainError);

    try {
      await upsertCustomDomain(supabase, TEST_ORG_ID, 'taken-domain.com');
    } catch (err) {
      expect((err as DomainError).code).toBe('domain_taken');
    }
  });

  it("resets verification_status to 'unverified' on domain change", async () => {
    const upsertedRow = makeDomainRow({
      domain_value: 'new-domain.com',
      verification_status: 'unverified',
      verified_at: null,
    });

    // Call 1: conflict check → no conflicts
    const conflictChain = buildChainMock();
    conflictChain.eq = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    // Call 2: upsert → returns the row
    const upsertChain = buildChainMock({ data: upsertedRow, error: null });

    let callCount = 0;
    const supabase = {
      from: vi.fn(() => {
        callCount++;
        if (callCount === 1) return conflictChain;  // conflict check
        return upsertChain;                           // upsert
      }),
    } as unknown as SupabaseClient<Database>;

    const result = await upsertCustomDomain(supabase, TEST_ORG_ID, 'new-domain.com');

    expect(result.verification_status).toBe('unverified');
    expect(result.verified_at).toBeNull();
  });

  it('returns OrgDomain on success', async () => {
    const upsertedRow = makeDomainRow({
      domain_value: 'success-domain.com',
      verification_status: 'unverified',
    });

    // Conflict check → no conflicts
    const conflictChain = buildChainMock();
    conflictChain.eq = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    // Upsert → returns the row
    const upsertChain = buildChainMock({ data: upsertedRow, error: null });

    let callCount = 0;
    const supabase = {
      from: vi.fn(() => {
        callCount++;
        if (callCount === 1) return conflictChain;
        return upsertChain;
      }),
    } as unknown as SupabaseClient<Database>;

    const result = await upsertCustomDomain(supabase, TEST_ORG_ID, 'success-domain.com');

    expect(result.domain_value).toBe('success-domain.com');
    expect(result.org_id).toBe(TEST_ORG_ID);
    expect(result.domain_type).toBe('custom');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// removeCustomDomain — Supabase mocked
// ═══════════════════════════════════════════════════════════════════════════

describe('removeCustomDomain — Supabase mocked', () => {
  it('calls DELETE on org_domains for custom type', async () => {
    const mockEqDomainType = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockEqOrgId = vi.fn().mockReturnValue({ eq: mockEqDomainType });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEqOrgId });

    const supabase = {
      from: vi.fn().mockReturnValue({ delete: mockDelete }),
    } as unknown as SupabaseClient<Database>;

    const result = await removeCustomDomain(supabase, TEST_ORG_ID);

    expect(result).toEqual({ success: true });
    expect(supabase.from).toHaveBeenCalledWith('org_domains');
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEqOrgId).toHaveBeenCalledWith('org_id', TEST_ORG_ID);
    expect(mockEqDomainType).toHaveBeenCalledWith('domain_type', 'custom');
  });

  it('returns { success: true } when no custom domain exists (idempotent)', async () => {
    // Delete returns no data, no error — idempotent
    const mockEqDomainType = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockEqOrgId = vi.fn().mockReturnValue({ eq: mockEqDomainType });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEqOrgId });

    const supabase = {
      from: vi.fn().mockReturnValue({ delete: mockDelete }),
    } as unknown as SupabaseClient<Database>;

    const result = await removeCustomDomain(supabase, 'nonexistent-org');

    expect(result).toEqual({ success: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// updateVerificationStatus — Supabase mocked
// ═══════════════════════════════════════════════════════════════════════════

describe('updateVerificationStatus — Supabase mocked', () => {
  it('sets verified_at when result.verified = true', async () => {
    const verifiedRow = makeDomainRow({
      verification_status: 'verified',
      verified_at: '2026-03-01T12:00:00.000Z',
      last_checked_at: '2026-03-01T12:00:00.000Z',
    });

    const chain = buildChainMock({ data: verifiedRow, error: null });
    const supabase = createMockSupabase(chain);

    const result: DomainVerificationResult = {
      verified: true,
      status: 'verified',
      checked_at: '2026-03-01T12:00:00.000Z',
      error: null,
    };

    const updated = await updateVerificationStatus(supabase, TEST_ORG_ID, result);

    expect(updated).not.toBeNull();
    expect(updated!.verification_status).toBe('verified');
    expect(updated!.verified_at).not.toBeNull();

    // Verify the update call included the correct payload
    expect(chain.update).toHaveBeenCalled();
    const updatePayload = chain.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updatePayload.verification_status).toBe('verified');
    expect(updatePayload.verified_at).toBeTruthy();
  });

  it('sets verified_at = NULL when result.verified = false', async () => {
    const failedRow = makeDomainRow({
      verification_status: 'failed',
      verified_at: null,
      last_checked_at: '2026-03-01T12:00:00.000Z',
    });

    const chain = buildChainMock({ data: failedRow, error: null });
    const supabase = createMockSupabase(chain);

    const result: DomainVerificationResult = {
      verified: false,
      status: 'failed',
      checked_at: '2026-03-01T12:00:00.000Z',
      error: 'CNAME not found',
    };

    const updated = await updateVerificationStatus(supabase, TEST_ORG_ID, result);

    expect(updated).not.toBeNull();
    expect(updated!.verified_at).toBeNull();

    // Verify the update call set verified_at to null
    const updatePayload = chain.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updatePayload.verified_at).toBeNull();
  });

  it('always updates last_checked_at', async () => {
    const pendingRow = makeDomainRow({
      verification_status: 'pending',
      last_checked_at: '2026-03-01T12:00:00.000Z',
    });

    const chain = buildChainMock({ data: pendingRow, error: null });
    const supabase = createMockSupabase(chain);

    const result: DomainVerificationResult = {
      verified: false,
      status: 'pending',
      checked_at: '2026-03-01T12:00:00.000Z',
      error: null,
    };

    await updateVerificationStatus(supabase, TEST_ORG_ID, result);

    // Verify that last_checked_at and updated_at are always set
    const updatePayload = chain.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updatePayload.last_checked_at).toBeTruthy();
    expect(updatePayload.updated_at).toBeTruthy();
    // Both should be ISO date strings
    expect(typeof updatePayload.last_checked_at).toBe('string');
    expect(typeof updatePayload.updated_at).toBe('string');
  });
});
