// ---------------------------------------------------------------------------
// cron-logger.test.ts — Unit tests for cron health logging service
//
// Sprint C (M1): Tests logCronStart, logCronComplete, logCronFailed.
// Mocks createServiceRoleClient() — no real DB calls.
//
// Run:
//   npx vitest run src/__tests__/unit/cron-logger.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoist mocks ───────────────────────────────────────────────────────────

const mockFrom = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(() => ({ from: mockFrom })),
}));

// ── Import subjects ───────────────────────────────────────────────────────

import { logCronStart, logCronComplete, logCronFailed } from '@/lib/services/cron-logger';
import type { CronLogHandle } from '@/lib/services/cron-logger';

// ── Helpers ────────────────────────────────────────────────────────────────

const TEST_LOG_ID = 'log-uuid-001';

function mockInsertSuccess() {
  const mockSingle = vi.fn().mockResolvedValue({
    data: { id: TEST_LOG_ID },
    error: null,
  });
  const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
  const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
  mockFrom.mockReturnValue({ insert: mockInsert });
  return { mockInsert, mockSelect, mockSingle };
}

function mockInsertError() {
  const mockSingle = vi.fn().mockResolvedValue({
    data: null,
    error: { message: 'DB insert failed' },
  });
  const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
  const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
  mockFrom.mockReturnValue({ insert: mockInsert });
  return { mockInsert };
}

function mockUpdateSuccess() {
  const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ update: mockUpdate });
  return { mockUpdate, mockEq };
}

function mockUpdateError() {
  const mockEq = vi.fn().mockRejectedValue(new Error('DB update failed'));
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ update: mockUpdate });
  return { mockUpdate };
}

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('logCronStart', () => {
  it('inserts a row into cron_run_log with status="running"', async () => {
    const { mockInsert } = mockInsertSuccess();
    await logCronStart('weekly-digest');
    expect(mockFrom).toHaveBeenCalledWith('cron_run_log');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ cron_name: 'weekly-digest', status: 'running' }),
    );
  });

  it('returns the inserted row id as logId', async () => {
    mockInsertSuccess();
    const handle = await logCronStart('sov-cron');
    expect(handle.logId).toBe(TEST_LOG_ID);
  });

  it('returns a startedAt timestamp', async () => {
    mockInsertSuccess();
    const before = Date.now();
    const handle = await logCronStart('sov-cron');
    expect(handle.startedAt).toBeGreaterThanOrEqual(before);
    expect(handle.startedAt).toBeLessThanOrEqual(Date.now());
  });

  it('preserves cron name exactly as passed (case-sensitive)', async () => {
    const { mockInsert } = mockInsertSuccess();
    await logCronStart('Content-Audit-CRON');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ cron_name: 'Content-Audit-CRON' }),
    );
  });

  it('returns null logId when DB insert fails', async () => {
    mockInsertError();
    const handle = await logCronStart('weekly-digest');
    expect(handle.logId).toBeNull();
  });

  it('does not throw when insert throws', async () => {
    mockFrom.mockImplementation(() => { throw new Error('unexpected'); });
    const handle = await logCronStart('weekly-digest');
    expect(handle.logId).toBeNull();
    expect(handle.startedAt).toBeGreaterThan(0);
  });
});

describe('logCronComplete', () => {
  it('updates cron_run_log row to status="success"', async () => {
    const { mockUpdate, mockEq } = mockUpdateSuccess();
    const handle: CronLogHandle = { logId: TEST_LOG_ID, startedAt: Date.now() - 500 };
    await logCronComplete(handle, { sent: 5, skipped: 2 });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success' }),
    );
    expect(mockEq).toHaveBeenCalledWith('id', TEST_LOG_ID);
  });

  it('computes duration_ms from startedAt', async () => {
    const { mockUpdate } = mockUpdateSuccess();
    const handle: CronLogHandle = { logId: TEST_LOG_ID, startedAt: Date.now() - 1000 };
    await logCronComplete(handle, {});
    const updateArg = mockUpdate.mock.calls[0][0];
    expect(updateArg.duration_ms).toBeGreaterThanOrEqual(900);
  });

  it('includes summary data in update', async () => {
    const { mockUpdate } = mockUpdateSuccess();
    const handle: CronLogHandle = { logId: TEST_LOG_ID, startedAt: Date.now() };
    await logCronComplete(handle, { orgs_processed: 42 });
    const updateArg = mockUpdate.mock.calls[0][0];
    expect(updateArg.summary).toEqual({ orgs_processed: 42 });
  });

  it('is a no-op when logId is null', async () => {
    const handle: CronLogHandle = { logId: null, startedAt: Date.now() };
    await logCronComplete(handle, {});
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('does not throw when DB update fails', async () => {
    mockUpdateError();
    const handle: CronLogHandle = { logId: TEST_LOG_ID, startedAt: Date.now() };
    await expect(logCronComplete(handle, {})).resolves.toBeUndefined();
  });
});

describe('logCronFailed', () => {
  it('updates cron_run_log row to status="failed"', async () => {
    const { mockUpdate, mockEq } = mockUpdateSuccess();
    const handle: CronLogHandle = { logId: TEST_LOG_ID, startedAt: Date.now() - 200 };
    await logCronFailed(handle, 'Something broke');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', error_message: 'Something broke' }),
    );
    expect(mockEq).toHaveBeenCalledWith('id', TEST_LOG_ID);
  });

  it('stores error message string', async () => {
    const { mockUpdate } = mockUpdateSuccess();
    const handle: CronLogHandle = { logId: TEST_LOG_ID, startedAt: Date.now() };
    await logCronFailed(handle, 'Timeout after 30s');
    expect(mockUpdate.mock.calls[0][0].error_message).toBe('Timeout after 30s');
  });

  it('sets completed_at timestamp', async () => {
    const { mockUpdate } = mockUpdateSuccess();
    const handle: CronLogHandle = { logId: TEST_LOG_ID, startedAt: Date.now() };
    await logCronFailed(handle, 'error');
    expect(mockUpdate.mock.calls[0][0].completed_at).toBeDefined();
  });

  it('is a no-op when logId is null', async () => {
    const handle: CronLogHandle = { logId: null, startedAt: Date.now() };
    await logCronFailed(handle, 'error');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('does not throw when DB update fails', async () => {
    mockUpdateError();
    const handle: CronLogHandle = { logId: TEST_LOG_ID, startedAt: Date.now() };
    await expect(logCronFailed(handle, 'error')).resolves.toBeUndefined();
  });
});
