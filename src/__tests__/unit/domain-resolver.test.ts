// ---------------------------------------------------------------------------
// domain-resolver.test.ts — Unit tests for Sprint 114 domain resolver
//
// Tests lib/whitelabel/domain-resolver.ts:
//   extractSubdomain (pure) — 6 tests
//   resolveOrgFromHostname (Supabase + Redis mocked) — 8 tests
//
// Mocks: @/lib/redis (getRedis), Supabase chained query builder.
//
// Run:
//   npx vitest run src/__tests__/unit/domain-resolver.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { extractSubdomain, resolveOrgFromHostname } from '@/lib/whitelabel/domain-resolver';

// ── Hoist Redis mock before module evaluation (AI_RULES §4) ──────────────

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
};
vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(() => mockRedis),
}));

// ── Supabase chain mock helper ───────────────────────────────────────────

function buildChainMock(
  resolvedValue: { data: unknown; error: unknown } = { data: null, error: null },
) {
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

// ── Fixtures ─────────────────────────────────────────────────────────────

const MOCK_ORG_CONTEXT = {
  org_id: '11111111-1111-1111-1111-111111111111',
  org_name: 'Charcoal N Chill',
  plan_tier: 'growth',
  resolved_hostname: 'charcoal-n-chill.localvector.ai',
  is_custom_domain: false,
};

const MOCK_CUSTOM_ORG_CONTEXT = {
  org_id: '22222222-2222-2222-2222-222222222222',
  org_name: 'Fancy Restaurant',
  plan_tier: 'agency',
  resolved_hostname: 'order.fancyrestaurant.com',
  is_custom_domain: true,
};

// ═════════════════════════════════════════════════════════════════════════
// PURE FUNCTION TESTS — extractSubdomain
// ═════════════════════════════════════════════════════════════════════════

describe('extractSubdomain — pure', () => {
  it('extracts slug from charcoal-n-chill.localvector.ai', () => {
    expect(extractSubdomain('charcoal-n-chill.localvector.ai')).toBe('charcoal-n-chill');
  });

  it('returns null for bare localvector.ai (no subdomain)', () => {
    expect(extractSubdomain('localvector.ai')).toBeNull();
  });

  it('returns null for localhost', () => {
    expect(extractSubdomain('localhost')).toBeNull();
  });

  it('returns null for 127.0.0.1', () => {
    expect(extractSubdomain('127.0.0.1')).toBeNull();
  });

  it('returns null for non-localvector.ai domain', () => {
    expect(extractSubdomain('app.theirbrand.com')).toBeNull();
  });

  it('strips port before extracting subdomain', () => {
    expect(extractSubdomain('app.localvector.ai:3000')).toBe('app');
  });
});

// ═════════════════════════════════════════════════════════════════════════
// INTEGRATION-STYLE TESTS — resolveOrgFromHostname (Supabase + Redis)
// ═════════════════════════════════════════════════════════════════════════

describe('resolveOrgFromHostname — Supabase + Redis mocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
  });

  it('returns cached OrgContext on cache hit (no DB call)', async () => {
    // Redis returns a cached JSON string
    mockRedis.get.mockResolvedValue(JSON.stringify(MOCK_ORG_CONTEXT));

    const supabase = createMockSupabase();
    const result = await resolveOrgFromHostname(
      'charcoal-n-chill.localvector.ai',
      supabase,
    );

    expect(result).toEqual(MOCK_ORG_CONTEXT);
    // No DB query should have been made
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('queries DB on cache miss and caches result', async () => {
    // Redis returns null/undefined → cache miss
    mockRedis.get.mockResolvedValue(null);

    // org_domains lookup returns no custom domain
    const customDomainChain = buildChainMock({ data: null, error: null });
    // organizations slug lookup returns an org
    const orgChain = buildChainMock({
      data: {
        id: MOCK_ORG_CONTEXT.org_id,
        name: MOCK_ORG_CONTEXT.org_name,
        plan: 'growth',
      },
      error: null,
    });

    let callCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        callCount++;
        if (table === 'org_domains') return customDomainChain;
        return orgChain;
      }),
    } as unknown as SupabaseClient<Database>;

    const result = await resolveOrgFromHostname(
      'charcoal-n-chill.localvector.ai',
      supabase,
    );

    expect(result).toEqual(MOCK_ORG_CONTEXT);
    // DB was queried
    expect(supabase.from).toHaveBeenCalled();
    // Result was cached in Redis
    expect(mockRedis.set).toHaveBeenCalledWith(
      'domain_ctx:charcoal-n-chill.localvector.ai',
      JSON.stringify(MOCK_ORG_CONTEXT),
      { ex: 300 },
    );
  });

  it('returns OrgContext with is_custom_domain=true for verified custom domain', async () => {
    mockRedis.get.mockResolvedValue(null);

    // org_domains lookup finds a verified custom domain
    const customDomainChain = buildChainMock({
      data: { org_id: MOCK_CUSTOM_ORG_CONTEXT.org_id },
      error: null,
    });
    // organizations lookup returns the org details
    const orgChain = buildChainMock({
      data: {
        id: MOCK_CUSTOM_ORG_CONTEXT.org_id,
        name: MOCK_CUSTOM_ORG_CONTEXT.org_name,
        plan: 'agency',
      },
      error: null,
    });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'org_domains') return customDomainChain;
        return orgChain;
      }),
    } as unknown as SupabaseClient<Database>;

    const result = await resolveOrgFromHostname(
      'order.fancyrestaurant.com',
      supabase,
    );

    expect(result).toEqual(MOCK_CUSTOM_ORG_CONTEXT);
    expect(result?.is_custom_domain).toBe(true);
  });

  it('returns OrgContext with is_custom_domain=false for subdomain match', async () => {
    mockRedis.get.mockResolvedValue(null);

    // org_domains lookup finds no custom domain
    const customDomainChain = buildChainMock({ data: null, error: null });
    // organizations slug lookup returns the org
    const orgChain = buildChainMock({
      data: {
        id: MOCK_ORG_CONTEXT.org_id,
        name: MOCK_ORG_CONTEXT.org_name,
        plan: 'growth',
      },
      error: null,
    });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'org_domains') return customDomainChain;
        return orgChain;
      }),
    } as unknown as SupabaseClient<Database>;

    const result = await resolveOrgFromHostname(
      'charcoal-n-chill.localvector.ai',
      supabase,
    );

    expect(result).not.toBeNull();
    expect(result?.is_custom_domain).toBe(false);
  });

  it('returns null for direct access hostname (app.localvector.ai)', async () => {
    const supabase = createMockSupabase();
    const result = await resolveOrgFromHostname('app.localvector.ai', supabase);

    expect(result).toBeNull();
    // Should short-circuit — no Redis or DB calls
    expect(mockRedis.get).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns null for localhost', async () => {
    const supabase = createMockSupabase();
    const result = await resolveOrgFromHostname('localhost', supabase);

    expect(result).toBeNull();
    expect(mockRedis.get).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('falls through to DB on Redis error (no crash)', async () => {
    // Redis get throws — should gracefully fall through to DB
    mockRedis.get.mockRejectedValue(new Error('Redis connection refused'));

    // org_domains lookup finds no custom domain
    const customDomainChain = buildChainMock({ data: null, error: null });
    // organizations slug lookup returns the org
    const orgChain = buildChainMock({
      data: {
        id: MOCK_ORG_CONTEXT.org_id,
        name: MOCK_ORG_CONTEXT.org_name,
        plan: 'growth',
      },
      error: null,
    });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'org_domains') return customDomainChain;
        return orgChain;
      }),
    } as unknown as SupabaseClient<Database>;

    const result = await resolveOrgFromHostname(
      'charcoal-n-chill.localvector.ai',
      supabase,
    );

    // Should still resolve from DB despite Redis failure
    expect(result).toEqual(MOCK_ORG_CONTEXT);
    expect(supabase.from).toHaveBeenCalled();
  });

  it('handles DB returning no rows (returns null gracefully)', async () => {
    mockRedis.get.mockResolvedValue(null);

    // org_domains lookup finds no custom domain
    const customDomainChain = buildChainMock({ data: null, error: null });
    // organizations slug lookup also returns no match
    const orgChain = buildChainMock({ data: null, error: null });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'org_domains') return customDomainChain;
        return orgChain;
      }),
    } as unknown as SupabaseClient<Database>;

    const result = await resolveOrgFromHostname(
      'nonexistent-slug.localvector.ai',
      supabase,
    );

    expect(result).toBeNull();
    // Should cache the miss to avoid repeated DB lookups
    expect(mockRedis.set).toHaveBeenCalledWith(
      'domain_ctx:nonexistent-slug.localvector.ai',
      JSON.stringify(null),
      { ex: 300 },
    );
  });
});
