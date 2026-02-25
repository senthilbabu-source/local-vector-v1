import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Redis
// ---------------------------------------------------------------------------

const mockRedis = {
  set: vi.fn().mockResolvedValue('OK'),
  sadd: vi.fn().mockResolvedValue(1),
  smembers: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue(null),
  del: vi.fn().mockResolvedValue(1),
  srem: vi.fn().mockResolvedValue(1),
};

vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(() => mockRedis),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  schedulePostPublishRecheck,
  getPendingRechecks,
  completeRecheck,
  RECHECK_KEY_PREFIX,
  RECHECK_SET_KEY,
  RECHECK_TTL,
  RECHECK_DELAY_DAYS,
} from '@/lib/autopilot/post-publish';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('schedulePostPublishRecheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores task in Redis with correct TTL', async () => {
    await schedulePostPublishRecheck('draft-001', 'loc-001', 'best pizza austin');

    expect(mockRedis.set).toHaveBeenCalledWith(
      `${RECHECK_KEY_PREFIX}draft-001`,
      expect.stringContaining('"draftId":"draft-001"'),
      { ex: RECHECK_TTL },
    );
    expect(mockRedis.sadd).toHaveBeenCalledWith(RECHECK_SET_KEY, 'draft-001');
  });

  it('skips scheduling when targetQuery is empty', async () => {
    await schedulePostPublishRecheck('draft-001', 'loc-001', '');

    expect(mockRedis.set).not.toHaveBeenCalled();
    expect(mockRedis.sadd).not.toHaveBeenCalled();
  });

  it('degrades gracefully when Redis unavailable', async () => {
    const { getRedis } = await import('@/lib/redis');
    vi.mocked(getRedis).mockImplementationOnce(() => {
      throw new Error('Redis connection refused');
    });

    // Should not throw
    await expect(
      schedulePostPublishRecheck('draft-001', 'loc-001', 'test query'),
    ).resolves.not.toThrow();
  });

  it('sets target date 14 days in the future', async () => {
    await schedulePostPublishRecheck('draft-001', 'loc-001', 'test query');

    const setCall = mockRedis.set.mock.calls[0];
    const taskJson = JSON.parse(setCall[1]);
    const targetDate = new Date(taskJson.targetDate);
    const now = new Date();

    // Target should be ~14 days from now (allow 1 minute tolerance)
    const diffDays = (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(RECHECK_DELAY_DAYS, 0);
  });
});

describe('getPendingRechecks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when no tasks pending', async () => {
    mockRedis.smembers.mockResolvedValueOnce([]);
    const result = await getPendingRechecks();
    expect(result).toEqual([]);
  });

  it('returns tasks past their target date', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
    mockRedis.smembers.mockResolvedValueOnce(['draft-001']);
    mockRedis.get.mockResolvedValueOnce(
      JSON.stringify({
        taskType: 'sov_recheck',
        targetDate: pastDate,
        payload: { draftId: 'draft-001', locationId: 'loc-001', targetQuery: 'test' },
      }),
    );

    const result = await getPendingRechecks();
    expect(result).toHaveLength(1);
    expect(result[0].payload.draftId).toBe('draft-001');
  });

  it('filters out tasks not yet due', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 7).toISOString(); // 7 days from now
    mockRedis.smembers.mockResolvedValueOnce(['draft-001']);
    mockRedis.get.mockResolvedValueOnce(
      JSON.stringify({
        taskType: 'sov_recheck',
        targetDate: futureDate,
        payload: { draftId: 'draft-001', locationId: 'loc-001', targetQuery: 'test' },
      }),
    );

    const result = await getPendingRechecks();
    expect(result).toHaveLength(0);
  });

  it('cleans up expired keys from the set', async () => {
    mockRedis.smembers.mockResolvedValueOnce(['draft-expired']);
    mockRedis.get.mockResolvedValueOnce(null); // Key expired

    await getPendingRechecks();
    expect(mockRedis.srem).toHaveBeenCalledWith(RECHECK_SET_KEY, 'draft-expired');
  });

  it('degrades gracefully when Redis unavailable', async () => {
    const { getRedis } = await import('@/lib/redis');
    vi.mocked(getRedis).mockImplementationOnce(() => {
      throw new Error('Redis connection refused');
    });

    const result = await getPendingRechecks();
    expect(result).toEqual([]);
  });
});

describe('completeRecheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes task from Redis key and set', async () => {
    await completeRecheck('draft-001');

    expect(mockRedis.del).toHaveBeenCalledWith(`${RECHECK_KEY_PREFIX}draft-001`);
    expect(mockRedis.srem).toHaveBeenCalledWith(RECHECK_SET_KEY, 'draft-001');
  });

  it('degrades gracefully when Redis unavailable', async () => {
    const { getRedis } = await import('@/lib/redis');
    vi.mocked(getRedis).mockImplementationOnce(() => {
      throw new Error('Redis connection refused');
    });

    await expect(completeRecheck('draft-001')).resolves.not.toThrow();
  });
});

describe('constants', () => {
  it('RECHECK_DELAY_DAYS is 14', () => {
    expect(RECHECK_DELAY_DAYS).toBe(14);
  });

  it('RECHECK_TTL is 15 days in seconds', () => {
    expect(RECHECK_TTL).toBe(15 * 86400);
  });
});
