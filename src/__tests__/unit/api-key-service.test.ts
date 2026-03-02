/**
 * API Key Service — Unit Tests (Sprint 121)
 *
 * 10 tests covering generateApiKey, listApiKeys, revokeApiKey.
 * AI_RULES §59: SHA-256 hash only stored, raw_key returned ONCE.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { MOCK_ORG_API_KEY } from '@/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

vi.hoisted(() => {
  // No env vars needed for this service
});

// ---------------------------------------------------------------------------
// Supabase mock helper — generateApiKey path (insert → select → single)
// ---------------------------------------------------------------------------

function createMockSupabaseForInsert(returnData: Record<string, unknown>) {
  const mockSingle = vi.fn().mockResolvedValue({ data: returnData, error: null });
  const mockSelectAfterInsert = vi.fn().mockReturnValue({ single: mockSingle });
  const mockInsert = vi.fn().mockReturnValue({ select: mockSelectAfterInsert });

  // Track the insert payload
  const insertPayloads: unknown[] = [];
  const originalInsert = mockInsert;
  const wrappedInsert = vi.fn().mockImplementation((payload: unknown) => {
    insertPayloads.push(payload);
    return originalInsert(payload);
  });

  return {
    supabase: {
      from: vi.fn().mockReturnValue({ insert: wrappedInsert }),
    } as unknown as SupabaseClient<Database>,
    mockInsert: wrappedInsert,
    mockSingle,
    mockSelectAfterInsert,
    insertPayloads,
  };
}

// ---------------------------------------------------------------------------
// Supabase mock helper — listApiKeys path (select → eq → eq)
// ---------------------------------------------------------------------------

function createMockSupabaseForList(returnData: Record<string, unknown>[] = []) {
  const mockEq2 = vi.fn().mockResolvedValue({ data: returnData, error: null });
  const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });

  return {
    supabase: {
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    } as unknown as SupabaseClient<Database>,
    mockSelect,
    mockEq1,
    mockEq2,
  };
}

// ---------------------------------------------------------------------------
// Supabase mock helper — revokeApiKey path (update → eq → eq → select → single)
// ---------------------------------------------------------------------------

function createMockSupabaseForRevoke(
  returnData: Record<string, unknown> | null,
  error: { message: string } | null = null,
) {
  const mockSingle = vi.fn().mockResolvedValue({ data: returnData, error });
  const mockSelectAfterUpdate = vi.fn().mockReturnValue({ single: mockSingle });
  const mockEq2 = vi.fn().mockReturnValue({ select: mockSelectAfterUpdate });
  const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 });

  return {
    supabase: {
      from: vi.fn().mockReturnValue({ update: mockUpdate }),
    } as unknown as SupabaseClient<Database>,
    mockUpdate,
    mockSingle,
  };
}

// ---------------------------------------------------------------------------
// Import SUT
// ---------------------------------------------------------------------------

import {
  generateApiKey,
  listApiKeys,
  revokeApiKey,
} from '@/lib/settings/api-key-service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = MOCK_ORG_API_KEY.org_id;
const USER_ID = MOCK_ORG_API_KEY.created_by;
const KEY_NAME = MOCK_ORG_API_KEY.name;

// ---------------------------------------------------------------------------
// Reset mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// generateApiKey
// ===========================================================================

describe('generateApiKey', () => {
  it('1. throws "agency_required" for non-agency plan', async () => {
    const { supabase } = createMockSupabaseForInsert({ ...MOCK_ORG_API_KEY });

    await expect(generateApiKey(supabase, ORG_ID, USER_ID, KEY_NAME, 'starter'))
      .rejects.toThrow('agency_required');

    await expect(generateApiKey(supabase, ORG_ID, USER_ID, KEY_NAME, 'growth'))
      .rejects.toThrow('agency_required');

    await expect(generateApiKey(supabase, ORG_ID, USER_ID, KEY_NAME, 'trial'))
      .rejects.toThrow('agency_required');
  });

  it('2. raw_key starts with "lv_live_"', async () => {
    const { supabase } = createMockSupabaseForInsert({ ...MOCK_ORG_API_KEY });

    const result = await generateApiKey(supabase, ORG_ID, USER_ID, KEY_NAME, 'agency');

    expect(result.raw_key).toMatch(/^lv_live_/);
  });

  it('3. raw_key body is 64 hex chars (32 bytes x 2 hex chars)', async () => {
    const { supabase } = createMockSupabaseForInsert({ ...MOCK_ORG_API_KEY });

    const result = await generateApiKey(supabase, ORG_ID, USER_ID, KEY_NAME, 'agency');

    // Strip the 'lv_live_' prefix (8 chars), remainder should be 64 hex chars
    const body = result.raw_key.slice('lv_live_'.length);
    expect(body).toHaveLength(64);
    expect(body).toMatch(/^[0-9a-f]{64}$/);
  });

  it('4. key_prefix = first 12 chars of raw_key', async () => {
    const { supabase, insertPayloads } = createMockSupabaseForInsert({ ...MOCK_ORG_API_KEY });

    const result = await generateApiKey(supabase, ORG_ID, USER_ID, KEY_NAME, 'agency');

    const expectedPrefix = result.raw_key.slice(0, 12);
    const insertedPayload = insertPayloads[0] as Record<string, unknown>;
    expect(insertedPayload.key_prefix).toBe(expectedPrefix);
  });

  it('5. key_hash is SHA-256 hex (64 chars) — verified by independent computation', async () => {
    const { supabase, insertPayloads } = createMockSupabaseForInsert({ ...MOCK_ORG_API_KEY });

    const result = await generateApiKey(supabase, ORG_ID, USER_ID, KEY_NAME, 'agency');

    const insertedPayload = insertPayloads[0] as Record<string, unknown>;
    const storedHash = insertedPayload.key_hash as string;

    // Verify it is 64 hex chars
    expect(storedHash).toHaveLength(64);
    expect(storedHash).toMatch(/^[0-9a-f]{64}$/);

    // Verify by computing SHA-256 of raw_key independently
    const expectedHash = createHash('sha256').update(result.raw_key).digest('hex');
    expect(storedHash).toBe(expectedHash);
  });

  it('6. OrgApiKey returned does NOT contain key_hash field', async () => {
    const { supabase } = createMockSupabaseForInsert({ ...MOCK_ORG_API_KEY });

    const result = await generateApiKey(supabase, ORG_ID, USER_ID, KEY_NAME, 'agency');

    expect(result.api_key).toBeDefined();
    expect(result.api_key.id).toBe(MOCK_ORG_API_KEY.id);
    // key_hash must NEVER appear on the returned OrgApiKey object
    expect('key_hash' in result.api_key).toBe(false);
  });
});

// ===========================================================================
// listApiKeys
// ===========================================================================

describe('listApiKeys', () => {
  it('7. SELECT never includes key_hash', async () => {
    const { supabase, mockSelect } = createMockSupabaseForList([{ ...MOCK_ORG_API_KEY }]);

    await listApiKeys(supabase, ORG_ID);

    // Verify the select string passed to supabase does not contain 'key_hash'
    expect(mockSelect).toHaveBeenCalledTimes(1);
    const selectString = mockSelect.mock.calls[0][0] as string;
    expect(selectString).not.toContain('key_hash');

    // Positive check: it should contain the safe columns
    expect(selectString).toContain('id');
    expect(selectString).toContain('name');
    expect(selectString).toContain('key_prefix');
    expect(selectString).toContain('is_active');
  });

  it('8. only returns is_active=true rows', async () => {
    const { supabase, mockEq2 } = createMockSupabaseForList([{ ...MOCK_ORG_API_KEY }]);

    await listApiKeys(supabase, ORG_ID);

    // The second .eq() call should filter is_active = true
    expect(mockEq2).toHaveBeenCalledWith('is_active', true);
  });
});

// ===========================================================================
// revokeApiKey
// ===========================================================================

describe('revokeApiKey', () => {
  it('9. sets is_active=false (not DELETE)', async () => {
    const KEY_ID = MOCK_ORG_API_KEY.id;
    const { supabase, mockUpdate } = createMockSupabaseForRevoke({ id: KEY_ID });

    const result = await revokeApiKey(supabase, ORG_ID, KEY_ID);

    expect(result).toEqual({ ok: true });
    // Verify it used update with is_active=false, not a delete
    expect(mockUpdate).toHaveBeenCalledWith({ is_active: false });
  });

  it('10. throws "api_key_not_found" if key not found in org', async () => {
    const { supabase } = createMockSupabaseForRevoke(
      null,
      { message: 'Row not found' },
    );

    await expect(revokeApiKey(supabase, ORG_ID, 'nonexistent-key-id'))
      .rejects.toThrow('api_key_not_found');
  });
});
