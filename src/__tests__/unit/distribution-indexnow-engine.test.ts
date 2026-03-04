// @vitest-environment node
/**
 * Distribution IndexNow Engine — Unit Tests (Sprint 1: Distribution Engine)
 *
 * Verifies the IndexNow engine adapter:
 * - Wraps pingIndexNow() correctly
 * - Skips when INDEXNOW_API_KEY is missing
 * - Never throws
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DistributionContext } from '@/lib/distribution/distribution-types';

const CTX: DistributionContext = {
  menuId: 'menu-1',
  orgId: 'org-1',
  publicSlug: 'charcoal-n-chill',
  appUrl: 'https://app.localvector.ai',
  items: [{ id: 'i1', name: 'Test Item', category: 'Mains', confidence: 0.9 }],
  supabase: {} as any,
};

describe('indexNowEngine', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env.INDEXNOW_API_KEY = 'test-key-123';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns success when pingIndexNow returns true', async () => {
    vi.doMock('@/lib/indexnow', () => ({
      pingIndexNow: vi.fn().mockResolvedValue(true),
    }));
    const { indexNowEngine } = await import('@/lib/distribution/engines/indexnow-engine');
    const result = await indexNowEngine.distribute(CTX);
    expect(result).toEqual({ engine: 'indexnow', status: 'success' });
  });

  it('returns error when pingIndexNow returns false', async () => {
    vi.doMock('@/lib/indexnow', () => ({
      pingIndexNow: vi.fn().mockResolvedValue(false),
    }));
    const { indexNowEngine } = await import('@/lib/distribution/engines/indexnow-engine');
    const result = await indexNowEngine.distribute(CTX);
    expect(result.engine).toBe('indexnow');
    expect(result.status).toBe('error');
  });

  it('returns skipped when INDEXNOW_API_KEY is not set', async () => {
    delete process.env.INDEXNOW_API_KEY;
    vi.doMock('@/lib/indexnow', () => ({
      pingIndexNow: vi.fn(),
    }));
    const { indexNowEngine } = await import('@/lib/distribution/engines/indexnow-engine');
    const result = await indexNowEngine.distribute(CTX);
    expect(result).toEqual({
      engine: 'indexnow',
      status: 'skipped',
      message: 'INDEXNOW_API_KEY not configured',
    });
  });

  it('constructs correct menu URL from context', async () => {
    const mockPing = vi.fn().mockResolvedValue(true);
    vi.doMock('@/lib/indexnow', () => ({ pingIndexNow: mockPing }));
    const { indexNowEngine } = await import('@/lib/distribution/engines/indexnow-engine');
    await indexNowEngine.distribute(CTX);
    expect(mockPing).toHaveBeenCalledWith([
      'https://app.localvector.ai/m/charcoal-n-chill',
    ]);
  });

  it('never throws — returns error result on exception', async () => {
    vi.doMock('@/lib/indexnow', () => ({
      pingIndexNow: vi.fn().mockRejectedValue(new Error('Network fail')),
    }));
    const { indexNowEngine } = await import('@/lib/distribution/engines/indexnow-engine');
    const result = await indexNowEngine.distribute(CTX);
    expect(result.engine).toBe('indexnow');
    expect(result.status).toBe('error');
    expect(result.message).toBe('Network fail');
  });
});
