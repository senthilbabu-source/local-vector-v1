// @vitest-environment node
/**
 * Distribution Publish Flow — Integration Tests (Sprint 1: Distribution Engine)
 *
 * Verifies that approveAndPublish() correctly calls distributeMenu()
 * and that failures don't block the publish return.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('approveAndPublish → distributeMenu integration', () => {
  const mockDistributeMenu = vi.fn().mockResolvedValue({
    status: 'distributed',
    engineResults: [{ engine: 'indexnow', status: 'success' }],
    contentHash: 'sha256-abc',
    distributedAt: '2026-03-04T00:00:00.000Z',
  });

  function setupMocks(slugValue: string | null = 'charcoal-n-chill') {
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }));
    vi.doMock('@/lib/auth', () => ({
      getSafeAuthContext: vi.fn().mockResolvedValue({ orgId: 'org-1', userId: 'u-1' }),
    }));
    vi.doMock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
    vi.doMock('@/lib/distribution', () => ({ distributeMenu: mockDistributeMenu }));
    vi.doMock('@/lib/credits/credit-service', () => ({
      checkCredit: vi.fn().mockResolvedValue({ ok: true }),
      consumeCredit: vi.fn(),
    }));
    vi.doMock('@/lib/utils/slug', () => ({ toUniqueSlug: vi.fn((n: string) => n) }));
    vi.doMock('@/lib/schemas/magic-menus', () => ({
      CreateMagicMenuSchema: { safeParse: vi.fn() },
    }));
    vi.doMock('ai', () => ({ generateObject: vi.fn() }));
    vi.doMock('@/lib/ai/providers', () => ({
      getModel: vi.fn(),
      hasApiKey: vi.fn().mockReturnValue(false),
    }));
    vi.doMock('@/lib/ai/schemas', () => ({
      MenuOCRSchema: {},
      zodSchema: vi.fn(),
    }));
    vi.doMock('@/lib/utils/parseCsvMenu', () => ({ parseLocalVectorCsv: vi.fn() }));
    vi.doMock('@/lib/utils/parsePosExport', () => ({ parsePosExportWithGPT4o: vi.fn() }));

    const mockSingle = vi.fn().mockResolvedValue({
      data: { public_slug: slugValue, propagation_events: [] },
      error: null,
    });
    const mockSelectEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockSelectEq });
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn().mockResolvedValue({
        from: vi.fn().mockReturnValue({
          select: mockSelect,
          update: mockUpdate,
        }),
      }),
    }));
  }

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    mockDistributeMenu.mockClear();
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.localvector.ai';
  });

  it('calls distributeMenu with correct menuId and orgId', async () => {
    setupMocks();
    const { approveAndPublish } = await import('@/app/dashboard/magic-menus/actions');
    await approveAndPublish('menu-42');

    expect(mockDistributeMenu).toHaveBeenCalledWith(
      expect.anything(), // supabase client
      'menu-42',
      'org-1',
    );
  });

  it('does not call distributeMenu when public_slug is null', async () => {
    setupMocks(null);
    const { approveAndPublish } = await import('@/app/dashboard/magic-menus/actions');
    await approveAndPublish('menu-42');

    expect(mockDistributeMenu).not.toHaveBeenCalled();
  });

  it('distributeMenu failure does not block publish return', async () => {
    mockDistributeMenu.mockRejectedValue(new Error('Distribution crashed'));
    setupMocks();
    const { approveAndPublish } = await import('@/app/dashboard/magic-menus/actions');
    const result = await approveAndPublish('menu-42');

    // Publish still succeeds even though distribution failed
    expect(result).toEqual({ success: true, publicSlug: 'charcoal-n-chill' });
  });

  it('passes the supabase client as first argument', async () => {
    setupMocks();
    const { approveAndPublish } = await import('@/app/dashboard/magic-menus/actions');
    await approveAndPublish('menu-42');

    // First arg should be an object with a .from() method (supabase client)
    const firstArg = mockDistributeMenu.mock.calls[0]?.[0];
    expect(firstArg).toBeDefined();
    expect(typeof firstArg.from).toBe('function');
  });
});
