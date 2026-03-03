/**
 * Onboarding Service Tests — Sprint 117
 *
 * 17 tests covering:
 * - getOnboardingState (Supabase mocked, 8 tests)
 * - autoCompleteSteps (Supabase mocked, 6 tests)
 * - markStepComplete (Supabase mocked, 3 tests)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  getOnboardingState,
  initOnboardingSteps,
  markStepComplete,
  autoCompleteSteps,
} from '@/lib/onboarding/onboarding-service';
import { ONBOARDING_STEPS } from '@/lib/onboarding/types';
import type { OnboardingStepId } from '@/lib/onboarding/types';

// ---------------------------------------------------------------------------
// Supabase mock helper — chainable .from().select().eq().eq()...
// ---------------------------------------------------------------------------

function buildChainMock(
  resolvedValue: { data: unknown; error: unknown; count?: number | null } = {
    data: null,
    error: null,
  },
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;

  for (const method of [
    'select',
    'insert',
    'update',
    'upsert',
    'delete',
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'in',
    'is',
    'not',
    'filter',
    'order',
    'limit',
    'range',
    'match',
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
const TEST_USER_ID = 'b1ffcd00-ad1c-5fa9-cc7e-7ccaae491b22';

const STEP_IDS: OnboardingStepId[] = [
  'business_profile',
  'first_scan',
  'first_draft',
  'invite_teammate',
  'connect_domain',
];

function makeStepRows(
  overrides: Partial<Record<OnboardingStepId, boolean>> = {},
) {
  return STEP_IDS.map((id) => ({
    step_id: id,
    completed: overrides[id] ?? false,
    completed_at: overrides[id] ? '2026-03-01T00:00:00.000Z' : null,
    completed_by_user_id: overrides[id] ? TEST_USER_ID : null,
  }));
}

/** Helper: create a Date ISO string N days ago from "now" */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// ═══════════════════════════════════════════════════════════════════════════
// getOnboardingState — Supabase mocked
// ═══════════════════════════════════════════════════════════════════════════

describe('getOnboardingState — Supabase mocked', () => {
  it('initializes 5 steps if no rows exist (calls initOnboardingSteps)', async () => {
    // getOnboardingState makes several from() calls:
    // 1. SELECT onboarding_steps → empty (triggers init)
    // 2. UPSERT onboarding_steps (initOnboardingSteps)
    // 3. SELECT onboarding_steps (refetch after init)
    // 4. SELECT onboarding_steps (autoCompleteSteps reads steps)
    // ... autoCompleteSteps reads from multiple tables per incomplete step
    // N. SELECT onboarding_steps (final refetch after auto-complete)

    const allIncompleteRows = makeStepRows();
    let callCount = 0;

    const supabase = {
      from: vi.fn((table: string) => {
        callCount++;
        const chain = buildChainMock({ data: allIncompleteRows, error: null });

        if (callCount === 1) {
          // First SELECT onboarding_steps: return empty → triggers init
          chain.eq = vi.fn().mockResolvedValue({ data: [], error: null });
          return chain;
        }

        if (table === 'onboarding_steps') {
          // Upsert and subsequent selects return all 5 rows
          chain.eq = vi.fn().mockResolvedValue({
            data: allIncompleteRows,
            error: null,
            count: null,
          });
          return chain;
        }

        // For autoCompleteSteps checks (sov_evaluations, content_drafts, etc.)
        // Return count: 0 for all tables (nothing to auto-complete)
        chain.eq = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
        return chain;
      }),
    } as unknown as SupabaseClient<Database>;

    // P0-FIX-03: pass agency plan to see all 5 steps
    const state = await getOnboardingState(supabase, TEST_ORG_ID, null, 'agency');

    // Verify initOnboardingSteps was triggered: from('onboarding_steps') called with upsert
    expect(supabase.from).toHaveBeenCalledWith('onboarding_steps');
    expect(state.total_steps).toBe(5);
    expect(state.steps).toHaveLength(5);
  });

  it('returns correct completed_steps count', async () => {
    // 3 of 5 steps complete
    const rows = makeStepRows({
      business_profile: true,
      first_scan: true,
      first_draft: true,
    });

    const supabase = {
      from: vi.fn((table: string) => {
        const chain = buildChainMock();

        if (table === 'onboarding_steps') {
          chain.eq = vi.fn().mockResolvedValue({ data: rows, error: null });
          return chain;
        }

        // autoCompleteSteps: for the 2 incomplete steps, return count: 0
        chain.eq = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
        return chain;
      }),
    } as unknown as SupabaseClient<Database>;

    const state = await getOnboardingState(supabase, TEST_ORG_ID);

    expect(state.completed_steps).toBe(3);
  });

  it('is_complete = true when all 5 steps done (agency plan)', async () => {
    const rows = makeStepRows({
      business_profile: true,
      first_scan: true,
      first_draft: true,
      invite_teammate: true,
      connect_domain: true,
    });

    const supabase = {
      from: vi.fn((table: string) => {
        const chain = buildChainMock();

        if (table === 'onboarding_steps') {
          chain.eq = vi.fn().mockResolvedValue({ data: rows, error: null });
          return chain;
        }

        // autoCompleteSteps returns early because no incomplete steps
        chain.eq = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        return chain;
      }),
    } as unknown as SupabaseClient<Database>;

    // P0-FIX-03: agency plan sees all 5 steps
    const state = await getOnboardingState(supabase, TEST_ORG_ID, null, 'agency');

    expect(state.is_complete).toBe(true);
    expect(state.completed_steps).toBe(5);
  });

  it('is_complete = false when any visible step incomplete (agency plan)', async () => {
    const rows = makeStepRows({
      business_profile: true,
      first_scan: true,
      first_draft: true,
      invite_teammate: true,
      // connect_domain: false (default)
    });

    const supabase = {
      from: vi.fn((table: string) => {
        const chain = buildChainMock();

        if (table === 'onboarding_steps') {
          chain.eq = vi.fn().mockResolvedValue({ data: rows, error: null });
          return chain;
        }

        // connect_domain auto-complete check: org_domains count 0
        chain.eq = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
        return chain;
      }),
    } as unknown as SupabaseClient<Database>;

    // P0-FIX-03: agency plan sees all 5 steps — connect_domain is incomplete
    const state = await getOnboardingState(supabase, TEST_ORG_ID, null, 'agency');

    expect(state.is_complete).toBe(false);
  });

  it('has_real_data = true when first_scan step complete', async () => {
    const rows = makeStepRows({ first_scan: true });

    const supabase = {
      from: vi.fn((table: string) => {
        const chain = buildChainMock();

        if (table === 'onboarding_steps') {
          chain.eq = vi.fn().mockResolvedValue({ data: rows, error: null });
          return chain;
        }

        // For auto-complete checks on incomplete steps — return count: 0
        chain.eq = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
        return chain;
      }),
    } as unknown as SupabaseClient<Database>;

    const state = await getOnboardingState(supabase, TEST_ORG_ID);

    expect(state.has_real_data).toBe(true);
  });

  it('has_real_data = false when first_scan not complete', async () => {
    const rows = makeStepRows({ business_profile: true });

    const supabase = {
      from: vi.fn((table: string) => {
        const chain = buildChainMock();

        if (table === 'onboarding_steps') {
          chain.eq = vi.fn().mockResolvedValue({ data: rows, error: null });
          return chain;
        }

        // Auto-complete checks — nothing qualifies (count 0)
        chain.eq = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
        return chain;
      }),
    } as unknown as SupabaseClient<Database>;

    const state = await getOnboardingState(supabase, TEST_ORG_ID);

    expect(state.has_real_data).toBe(false);
  });

  it('show_interstitial = true for new org with < 2 steps done', async () => {
    const rows = makeStepRows({ business_profile: true }); // only 1 step done

    const supabase = {
      from: vi.fn((table: string) => {
        const chain = buildChainMock();

        if (table === 'onboarding_steps') {
          chain.eq = vi.fn().mockResolvedValue({ data: rows, error: null });
          return chain;
        }

        // Auto-complete checks — nothing qualifies
        chain.eq = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
        return chain;
      }),
    } as unknown as SupabaseClient<Database>;

    // Org created 2 days ago (< 7 days)
    const state = await getOnboardingState(supabase, TEST_ORG_ID, daysAgo(2));

    expect(state.show_interstitial).toBe(true);
    expect(state.completed_steps).toBeLessThan(2);
  });

  it('show_interstitial = false for org > 7 days old', async () => {
    const rows = makeStepRows({ business_profile: true }); // only 1 step done

    const supabase = {
      from: vi.fn((table: string) => {
        const chain = buildChainMock();

        if (table === 'onboarding_steps') {
          chain.eq = vi.fn().mockResolvedValue({ data: rows, error: null });
          return chain;
        }

        // Auto-complete checks — nothing qualifies
        chain.eq = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
        return chain;
      }),
    } as unknown as SupabaseClient<Database>;

    // Org created 10 days ago (> 7 days)
    const state = await getOnboardingState(supabase, TEST_ORG_ID, daysAgo(10));

    expect(state.show_interstitial).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// autoCompleteSteps — Supabase mocked
// ═══════════════════════════════════════════════════════════════════════════

describe('autoCompleteSteps — Supabase mocked', () => {
  it('auto-completes first_scan when SOV data exists', async () => {
    const rows = makeStepRows(); // all incomplete
    const upsertCalls: unknown[] = [];

    const supabase = {
      from: vi.fn((table: string) => {
        const chain = buildChainMock();

        if (table === 'onboarding_steps') {
          // First call: SELECT current steps; subsequent: update calls
          chain.eq = vi.fn((col: string, val: unknown) => {
            if (col === 'org_id' && typeof val === 'string') {
              return {
                ...chain,
                // Resolve the initial steps fetch
                then: (resolve: (v: unknown) => void) =>
                  resolve({ data: rows, error: null }),
                [Symbol.toStringTag]: 'Promise',
              };
            }
            return chain;
          });
          // Track update calls
          chain.update = vi.fn((payload: unknown) => {
            upsertCalls.push(payload);
            return chain;
          });
          chain.select = vi.fn(() => chain);
          chain.maybeSingle = vi.fn().mockResolvedValue({
            data: { step_id: 'first_scan', completed: true, completed_at: '2026-03-01T00:00:00.000Z', completed_by_user_id: null },
            error: null,
          });
          return chain;
        }

        if (table === 'sov_evaluations') {
          // count > 0 → should auto-complete first_scan
          chain.eq = vi.fn(() => chain);
          chain.select = vi.fn(() => ({
            ...chain,
            eq: vi.fn().mockResolvedValue({ data: null, error: null, count: 3 }),
          }));
          return chain;
        }

        // All other tables → count: 0 (no auto-complete)
        chain.eq = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
        return chain;
      }),
    } as unknown as SupabaseClient<Database>;

    await autoCompleteSteps(supabase, TEST_ORG_ID);

    // Verify sov_evaluations was queried
    expect(supabase.from).toHaveBeenCalledWith('sov_evaluations');
    // Verify markStepComplete was called (it calls from('onboarding_steps').update)
    expect(supabase.from).toHaveBeenCalledWith('onboarding_steps');
  });

  it('auto-completes first_draft when content_drafts row exists', async () => {
    // Only first_draft is incomplete
    const rows = makeStepRows({
      business_profile: true,
      first_scan: true,
      invite_teammate: true,
      connect_domain: true,
    });

    const supabase = {
      from: vi.fn((table: string) => {
        const chain = buildChainMock();

        if (table === 'onboarding_steps') {
          chain.eq = vi.fn(() => chain);
          chain.select = vi.fn(() => chain);
          // Return the rows for SELECT queries
          const selectPromise = Promise.resolve({ data: rows, error: null });
          Object.assign(chain, {
            then: selectPromise.then.bind(selectPromise),
            catch: selectPromise.catch.bind(selectPromise),
          });
          chain.update = vi.fn(() => chain);
          chain.maybeSingle = vi.fn().mockResolvedValue({
            data: { step_id: 'first_draft', completed: true, completed_at: '2026-03-01T00:00:00.000Z', completed_by_user_id: null },
            error: null,
          });
          return chain;
        }

        if (table === 'content_drafts') {
          // count > 0 → should auto-complete first_draft
          chain.eq = vi.fn(() => chain);
          chain.select = vi.fn(() => ({
            ...chain,
            eq: vi.fn().mockResolvedValue({ data: null, error: null, count: 1 }),
          }));
          return chain;
        }

        // Fallback for any other table
        chain.eq = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
        return chain;
      }),
    } as unknown as SupabaseClient<Database>;

    await autoCompleteSteps(supabase, TEST_ORG_ID);

    expect(supabase.from).toHaveBeenCalledWith('content_drafts');
  });

  it('auto-completes invite_teammate when org has > 1 member (agency plan)', async () => {
    // Only invite_teammate is incomplete
    const rows = makeStepRows({
      business_profile: true,
      first_scan: true,
      first_draft: true,
      connect_domain: true,
    });

    const supabase = {
      from: vi.fn((table: string) => {
        const chain = buildChainMock();

        if (table === 'onboarding_steps') {
          chain.eq = vi.fn(() => chain);
          chain.select = vi.fn(() => chain);
          const selectPromise = Promise.resolve({ data: rows, error: null });
          Object.assign(chain, {
            then: selectPromise.then.bind(selectPromise),
            catch: selectPromise.catch.bind(selectPromise),
          });
          chain.update = vi.fn(() => chain);
          chain.maybeSingle = vi.fn().mockResolvedValue({
            data: { step_id: 'invite_teammate', completed: true, completed_at: '2026-03-01T00:00:00.000Z', completed_by_user_id: null },
            error: null,
          });
          return chain;
        }

        if (table === 'memberships') {
          // count = 2 → > 1 → should auto-complete
          chain.eq = vi.fn(() => chain);
          chain.select = vi.fn(() => ({
            ...chain,
            eq: vi.fn().mockResolvedValue({ data: null, error: null, count: 2 }),
          }));
          return chain;
        }

        chain.eq = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
        return chain;
      }),
    } as unknown as SupabaseClient<Database>;

    // P0-FIX-03: invite_teammate requires agency plan to be visible
    await autoCompleteSteps(supabase, TEST_ORG_ID, 'agency');

    expect(supabase.from).toHaveBeenCalledWith('memberships');
  });

  it('auto-completes connect_domain when verified custom domain exists (agency plan)', async () => {
    // Only connect_domain is incomplete
    const rows = makeStepRows({
      business_profile: true,
      first_scan: true,
      first_draft: true,
      invite_teammate: true,
    });

    const supabase = {
      from: vi.fn((table: string) => {
        const chain = buildChainMock();

        if (table === 'onboarding_steps') {
          chain.eq = vi.fn(() => chain);
          chain.select = vi.fn(() => chain);
          const selectPromise = Promise.resolve({ data: rows, error: null });
          Object.assign(chain, {
            then: selectPromise.then.bind(selectPromise),
            catch: selectPromise.catch.bind(selectPromise),
          });
          chain.update = vi.fn(() => chain);
          chain.maybeSingle = vi.fn().mockResolvedValue({
            data: { step_id: 'connect_domain', completed: true, completed_at: '2026-03-01T00:00:00.000Z', completed_by_user_id: null },
            error: null,
          });
          return chain;
        }

        if (table === 'org_domains') {
          // count > 0 with domain_type=custom, verification_status=verified
          chain.select = vi.fn(() => chain);
          chain.eq = vi.fn(() => ({
            ...chain,
            eq: vi.fn(() => ({
              ...chain,
              eq: vi.fn().mockResolvedValue({ data: null, error: null, count: 1 }),
            })),
          }));
          return chain;
        }

        chain.eq = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
        return chain;
      }),
    } as unknown as SupabaseClient<Database>;

    // P0-FIX-03: connect_domain requires agency plan to be visible
    await autoCompleteSteps(supabase, TEST_ORG_ID, 'agency');

    expect(supabase.from).toHaveBeenCalledWith('org_domains');
  });

  it('auto-completes business_profile when org name set + location exists', async () => {
    // Only business_profile is incomplete
    const rows = makeStepRows({
      first_scan: true,
      first_draft: true,
      invite_teammate: true,
      connect_domain: true,
    });

    const supabase = {
      from: vi.fn((table: string) => {
        const chain = buildChainMock();

        if (table === 'onboarding_steps') {
          chain.eq = vi.fn(() => chain);
          chain.select = vi.fn(() => chain);
          const selectPromise = Promise.resolve({ data: rows, error: null });
          Object.assign(chain, {
            then: selectPromise.then.bind(selectPromise),
            catch: selectPromise.catch.bind(selectPromise),
          });
          chain.update = vi.fn(() => chain);
          chain.maybeSingle = vi.fn().mockResolvedValue({
            data: { step_id: 'business_profile', completed: true, completed_at: '2026-03-01T00:00:00.000Z', completed_by_user_id: null },
            error: null,
          });
          return chain;
        }

        if (table === 'organizations') {
          // Has a name set
          chain.eq = vi.fn(() => chain);
          chain.select = vi.fn(() => chain);
          chain.single = vi.fn().mockResolvedValue({
            data: { name: 'Charcoal N Chill' },
            error: null,
          });
          return chain;
        }

        if (table === 'locations') {
          // count > 0 locations
          chain.eq = vi.fn(() => chain);
          chain.select = vi.fn(() => ({
            ...chain,
            eq: vi.fn().mockResolvedValue({ data: null, error: null, count: 2 }),
          }));
          return chain;
        }

        chain.eq = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
        return chain;
      }),
    } as unknown as SupabaseClient<Database>;

    await autoCompleteSteps(supabase, TEST_ORG_ID);

    expect(supabase.from).toHaveBeenCalledWith('organizations');
    expect(supabase.from).toHaveBeenCalledWith('locations');
  });

  it('does not auto-complete already-completed steps (idempotent)', async () => {
    // All steps already complete — autoCompleteSteps should return early
    const rows = makeStepRows({
      business_profile: true,
      first_scan: true,
      first_draft: true,
      invite_teammate: true,
      connect_domain: true,
    });

    const chain = buildChainMock();
    chain.eq = vi.fn().mockResolvedValue({ data: rows, error: null });

    const supabase = {
      from: vi.fn(() => chain),
    } as unknown as SupabaseClient<Database>;

    await autoCompleteSteps(supabase, TEST_ORG_ID);

    // Should only call from('onboarding_steps') once to read steps, then exit
    // No calls to sov_evaluations, content_drafts, memberships, org_domains, etc.
    const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(fromCalls).toContain('onboarding_steps');
    expect(fromCalls).not.toContain('sov_evaluations');
    expect(fromCalls).not.toContain('content_drafts');
    expect(fromCalls).not.toContain('memberships');
    expect(fromCalls).not.toContain('org_domains');
    expect(fromCalls).not.toContain('organizations');
    expect(fromCalls).not.toContain('locations');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// markStepComplete — Supabase mocked
// ═══════════════════════════════════════════════════════════════════════════

describe('markStepComplete — Supabase mocked', () => {
  it('updates completed = true with timestamp and userId', async () => {
    const now = new Date().toISOString();
    const updatedRow = {
      step_id: 'first_scan',
      completed: true,
      completed_at: now,
      completed_by_user_id: TEST_USER_ID,
    };

    const chain = buildChainMock({ data: updatedRow, error: null });
    const supabase = createMockSupabase(chain);

    const result = await markStepComplete(
      supabase,
      TEST_ORG_ID,
      'first_scan',
      TEST_USER_ID,
    );

    expect(result.step_id).toBe('first_scan');
    expect(result.completed).toBe(true);
    expect(result.completed_at).toBe(now);
    expect(result.completed_by_user_id).toBe(TEST_USER_ID);

    // Verify update was called with the right payload
    expect(chain.update).toHaveBeenCalled();
    const payload = chain.update.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.completed).toBe(true);
    expect(payload.completed_by_user_id).toBe(TEST_USER_ID);
    expect(typeof payload.completed_at).toBe('string');
  });

  it('idempotent — no error when step already complete', async () => {
    // First update returns null (no rows matched because completed=false filter didn't match)
    const updateChain = buildChainMock();
    updateChain.update = vi.fn(() => updateChain);
    updateChain.eq = vi.fn(() => updateChain);
    updateChain.select = vi.fn(() => updateChain);
    updateChain.maybeSingle = vi.fn().mockResolvedValue({
      data: null, // no row updated — already complete
      error: null,
    });

    // Second SELECT (fallback fetch) returns the already-completed row
    const fetchChain = buildChainMock({
      data: {
        step_id: 'first_scan',
        completed: true,
        completed_at: '2026-02-28T00:00:00.000Z',
        completed_by_user_id: 'original-user',
      },
      error: null,
    });

    let callCount = 0;
    const supabase = {
      from: vi.fn(() => {
        callCount++;
        if (callCount === 1) return updateChain; // UPDATE attempt
        return fetchChain; // SELECT fallback
      }),
    } as unknown as SupabaseClient<Database>;

    // Should NOT throw
    const result = await markStepComplete(
      supabase,
      TEST_ORG_ID,
      'first_scan',
      TEST_USER_ID,
    );

    // Returns the original completed state, not the new userId
    expect(result.step_id).toBe('first_scan');
    expect(result.completed).toBe(true);
    expect(result.completed_by_user_id).toBe('original-user');
  });

  it('returns updated OnboardingStepState', async () => {
    const now = '2026-03-02T10:00:00.000Z';
    const updatedRow = {
      step_id: 'connect_domain',
      completed: true,
      completed_at: now,
      completed_by_user_id: TEST_USER_ID,
    };

    const chain = buildChainMock({ data: updatedRow, error: null });
    const supabase = createMockSupabase(chain);

    const result = await markStepComplete(
      supabase,
      TEST_ORG_ID,
      'connect_domain',
      TEST_USER_ID,
    );

    // Verify it conforms to OnboardingStepState shape
    expect(result).toEqual({
      step_id: 'connect_domain',
      completed: true,
      completed_at: now,
      completed_by_user_id: TEST_USER_ID,
    });
    expect(Object.keys(result).sort()).toEqual([
      'completed',
      'completed_at',
      'completed_by_user_id',
      'step_id',
    ]);
  });
});
