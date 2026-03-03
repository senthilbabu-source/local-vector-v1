// ---------------------------------------------------------------------------
// src/__tests__/unit/p3-fix-14/credits-service-enhanced.test.ts — P3-FIX-14
//
// Tests for consumeCreditWithLog, getCreditHistory, getCreditBalance.
// Existing checkCredit/consumeCredit are already tested in Sprint D tests.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase service role client
// ---------------------------------------------------------------------------

const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
let mockCreditData: Record<string, any> | null = null;
let mockHistoryData: Array<Record<string, any>> = [];

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => ({
    from: vi.fn((table: string) => {
      const chain: Record<string, any> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockReturnValue(chain);
      chain.single = vi.fn().mockResolvedValue({
        data: table === 'api_credits' ? mockCreditData : null,
        error: mockCreditData ? null : { message: 'not found' },
      });
      chain.insert = mockInsert;
      return chain;
    }),
    rpc: mockRpc,
  }),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// Import after mocks
import {
  consumeCreditWithLog,
  getCreditHistory,
  getCreditBalance,
  type CreditOperation,
} from '@/lib/credits/credit-service';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockCreditData = {
    credits_used: 5,
    credits_limit: 100,
    reset_date: '2026-04-01T00:00:00.000Z',
  };
  mockHistoryData = [];
});

// ---------------------------------------------------------------------------
// consumeCreditWithLog
// ---------------------------------------------------------------------------

describe('consumeCreditWithLog', () => {
  it('calls increment_credits_used RPC', async () => {
    await consumeCreditWithLog('org-1', 'sov_evaluation');
    expect(mockRpc).toHaveBeenCalledWith('increment_credits_used', { p_org_id: 'org-1' });
  });

  it('inserts a row into credit_usage_log', async () => {
    await consumeCreditWithLog('org-1', 'ai_preview', 'ref-123');
    expect(mockInsert).toHaveBeenCalledWith({
      org_id: 'org-1',
      operation: 'ai_preview',
      credits_used: 1,
      credits_before: 5,
      credits_after: 6,
      reference_id: 'ref-123',
    });
  });

  it('logs with null reference_id when not provided', async () => {
    await consumeCreditWithLog('org-1', 'magic_menu');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        reference_id: null,
        operation: 'magic_menu',
      }),
    );
  });

  it('does not throw on error (fail-open)', async () => {
    mockRpc.mockRejectedValueOnce(new Error('RPC failed'));
    await expect(consumeCreditWithLog('org-1', 'generic')).resolves.not.toThrow();
  });

  it('logs correct credits_before and credits_after', async () => {
    mockCreditData = { credits_used: 42, credits_limit: 500, reset_date: '2026-04-01T00:00:00.000Z' };
    await consumeCreditWithLog('org-1', 'content_brief');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        credits_before: 42,
        credits_after: 43,
      }),
    );
  });

  it('skips log insert when credits data is missing', async () => {
    mockCreditData = null;
    await consumeCreditWithLog('org-1', 'generic');
    // RPC still called (increment attempted)
    expect(mockRpc).toHaveBeenCalled();
    // But insert is NOT called (no before data to log)
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getCreditBalance
// ---------------------------------------------------------------------------

describe('getCreditBalance', () => {
  it('returns used, limit, remaining fields', async () => {
    mockCreditData = { credits_used: 15, credits_limit: 100, reset_date: '2026-04-01T00:00:00.000Z' };
    const balance = await getCreditBalance('org-1');
    expect(balance).toEqual({
      used: 15,
      limit: 100,
      remaining: 85,
      resetDate: '2026-04-01T00:00:00.000Z',
    });
  });

  it('returns null when no credits row exists', async () => {
    mockCreditData = null;
    const balance = await getCreditBalance('org-1');
    expect(balance).toBeNull();
  });

  it('remaining = limit - used', async () => {
    mockCreditData = { credits_used: 99, credits_limit: 100, reset_date: '2026-04-01T00:00:00.000Z' };
    const balance = await getCreditBalance('org-1');
    expect(balance?.remaining).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getCreditHistory — basic test (integration is better tested at route level)
// ---------------------------------------------------------------------------

describe('getCreditHistory', () => {
  it('returns empty array on error', async () => {
    // getCreditHistory uses createServiceRoleClient which returns our mock.
    // The mock's from('credit_usage_log') chain will return { data: null }
    // which maps to empty array.
    const history = await getCreditHistory('org-1');
    expect(Array.isArray(history)).toBe(true);
  });

  it('does not throw on error (returns empty)', async () => {
    await expect(getCreditHistory('org-1')).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// CreditOperation type coverage
// ---------------------------------------------------------------------------

describe('CreditOperation types', () => {
  const operations: CreditOperation[] = [
    'sov_evaluation',
    'content_brief',
    'competitor_intercept',
    'magic_menu',
    'ai_preview',
    'manual_scan',
    'generic',
  ];

  it.each(operations)('accepts %s as a valid operation', async (op) => {
    await expect(consumeCreditWithLog('org-1', op)).resolves.not.toThrow();
  });
});
