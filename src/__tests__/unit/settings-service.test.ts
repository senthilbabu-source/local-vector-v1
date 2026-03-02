/**
 * Settings Service Tests — Sprint 121
 *
 * 12 tests covering:
 * - updateOrgSettings (validation + DB update, 6 tests)
 * - shouldScanOrg (frequency-based scan gating, 6 tests)
 */

import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { updateOrgSettings, shouldScanOrg } from '@/lib/settings/settings-service';
import type { OrgSettings } from '@/lib/settings/types';
import { MOCK_ORG_SETTINGS } from '@/__fixtures__/golden-tenant';

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

const TEST_ORG_ID = MOCK_ORG_SETTINGS.org_id;

const BASE_SETTINGS: OrgSettings = { ...MOCK_ORG_SETTINGS };

/** Helper: returns a date string N days ago from now */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ===========================================================================
// updateOrgSettings
// ===========================================================================

describe('updateOrgSettings', () => {
  it('rejects invalid scan_frequency values', async () => {
    const supabase = createMockSupabase();
    await expect(
      updateOrgSettings(supabase, TEST_ORG_ID, {
        scan_frequency: 'daily' as never,
      }),
    ).rejects.toThrow('invalid_scan_frequency');
  });

  it('rejects threshold < 1', async () => {
    const supabase = createMockSupabase();
    await expect(
      updateOrgSettings(supabase, TEST_ORG_ID, {
        notify_sov_drop_threshold: 0,
      }),
    ).rejects.toThrow('invalid_threshold');
  });

  it('rejects threshold > 20', async () => {
    const supabase = createMockSupabase();
    await expect(
      updateOrgSettings(supabase, TEST_ORG_ID, {
        notify_sov_drop_threshold: 21,
      }),
    ).rejects.toThrow('invalid_threshold');
  });

  it('rejects webhook not starting with https://hooks.slack.com/', async () => {
    const supabase = createMockSupabase();
    await expect(
      updateOrgSettings(supabase, TEST_ORG_ID, {
        notify_slack_webhook_url: 'https://evil.com/hook',
      }),
    ).rejects.toThrow('invalid_webhook_url');
  });

  it('accepts null webhook URL', async () => {
    const updatedRow: OrgSettings = {
      ...BASE_SETTINGS,
      notify_slack_webhook_url: null,
      updated_at: new Date().toISOString(),
    };

    const chain = buildChainMock({ data: updatedRow, error: null });
    const supabase = createMockSupabase(chain);

    const result = await updateOrgSettings(supabase, TEST_ORG_ID, {
      notify_slack_webhook_url: null,
    });

    expect(result).toEqual(updatedRow);
    expect(supabase.from).toHaveBeenCalledWith('org_settings');
  });

  it('returns updated OrgSettings on success', async () => {
    const updatedRow: OrgSettings = {
      ...BASE_SETTINGS,
      scan_frequency: 'monthly',
      notify_sov_drop_threshold: 10,
      notify_slack_webhook_url: 'https://hooks.slack.com/services/T00/B00/xxx',
      updated_at: new Date().toISOString(),
    };

    const chain = buildChainMock({ data: updatedRow, error: null });
    const supabase = createMockSupabase(chain);

    const result = await updateOrgSettings(supabase, TEST_ORG_ID, {
      scan_frequency: 'monthly',
      notify_sov_drop_threshold: 10,
      notify_slack_webhook_url: 'https://hooks.slack.com/services/T00/B00/xxx',
    });

    expect(result).toEqual(updatedRow);
    expect(supabase.from).toHaveBeenCalledWith('org_settings');
    expect(chain.update).toHaveBeenCalled();
  });
});

// ===========================================================================
// shouldScanOrg
// ===========================================================================

describe('shouldScanOrg', () => {
  it('returns true for new org with no sov_evaluations', async () => {
    const chain = buildChainMock({ data: null, error: null });
    const supabase = createMockSupabase(chain);

    const result = await shouldScanOrg(supabase, TEST_ORG_ID, BASE_SETTINGS);

    expect(result).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('sov_evaluations');
  });

  it('weekly: returns true when last scan > 7 days ago', async () => {
    const chain = buildChainMock({
      data: { created_at: daysAgo(8) },
      error: null,
    });
    const supabase = createMockSupabase(chain);

    const settings: OrgSettings = { ...BASE_SETTINGS, scan_frequency: 'weekly' };
    const result = await shouldScanOrg(supabase, TEST_ORG_ID, settings);

    expect(result).toBe(true);
  });

  it('weekly: returns false when last scan < 7 days ago', async () => {
    const chain = buildChainMock({
      data: { created_at: daysAgo(3) },
      error: null,
    });
    const supabase = createMockSupabase(chain);

    const settings: OrgSettings = { ...BASE_SETTINGS, scan_frequency: 'weekly' };
    const result = await shouldScanOrg(supabase, TEST_ORG_ID, settings);

    expect(result).toBe(false);
  });

  it('bi-weekly: returns false when last scan < 14 days ago', async () => {
    const chain = buildChainMock({
      data: { created_at: daysAgo(10) },
      error: null,
    });
    const supabase = createMockSupabase(chain);

    const settings: OrgSettings = { ...BASE_SETTINGS, scan_frequency: 'bi-weekly' };
    const result = await shouldScanOrg(supabase, TEST_ORG_ID, settings);

    expect(result).toBe(false);
  });

  it('monthly: returns false when last scan < 28 days ago', async () => {
    const chain = buildChainMock({
      data: { created_at: daysAgo(20) },
      error: null,
    });
    const supabase = createMockSupabase(chain);

    const settings: OrgSettings = { ...BASE_SETTINGS, scan_frequency: 'monthly' };
    const result = await shouldScanOrg(supabase, TEST_ORG_ID, settings);

    expect(result).toBe(false);
  });

  it('monthly: returns true when last scan > 28 days ago', async () => {
    const chain = buildChainMock({
      data: { created_at: daysAgo(30) },
      error: null,
    });
    const supabase = createMockSupabase(chain);

    const settings: OrgSettings = { ...BASE_SETTINGS, scan_frequency: 'monthly' };
    const result = await shouldScanOrg(supabase, TEST_ORG_ID, settings);

    expect(result).toBe(true);
  });
});
