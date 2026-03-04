// @vitest-environment node
/**
 * IndexNow Integration — Unit Tests (Sprint 129)
 *
 * Verifies that pingIndexNow() is called fire-and-forget from:
 * 1. content-drafts publishDraft (WordPress + GBP targets)
 * 2. magic-menus approveAndPublish
 *
 * Also validates the core pingIndexNow() behavior:
 * - Returns false when INDEXNOW_API_KEY is missing
 * - Sentry captures exceptions on failure
 * - Never blocks the calling flow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// § 1 — pingIndexNow core behavior
// ---------------------------------------------------------------------------

describe('pingIndexNow', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.INDEXNOW_API_KEY = 'test-key-123';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('returns false when INDEXNOW_API_KEY is missing', async () => {
    delete process.env.INDEXNOW_API_KEY;
    const { pingIndexNow } = await import('@/lib/indexnow');
    const result = await pingIndexNow(['https://example.com/page']);
    expect(result).toBe(false);
  });

  it('returns false when urls array is empty', async () => {
    const { pingIndexNow } = await import('@/lib/indexnow');
    const result = await pingIndexNow([]);
    expect(result).toBe(false);
  });

  it('returns true on 200 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 200 });
    const { pingIndexNow } = await import('@/lib/indexnow');
    const result = await pingIndexNow(['https://example.com/page']);
    expect(result).toBe(true);
  });

  it('returns true on 202 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 202 });
    const { pingIndexNow } = await import('@/lib/indexnow');
    const result = await pingIndexNow(['https://example.com/page']);
    expect(result).toBe(true);
  });

  it('returns false on non-200/202 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 429 });
    const { pingIndexNow } = await import('@/lib/indexnow');
    const result = await pingIndexNow(['https://example.com/page']);
    expect(result).toBe(false);
  });

  it('calls Sentry.captureException on network error', async () => {
    const mockCapture = vi.fn();
    vi.doMock('@sentry/nextjs', () => ({ captureException: mockCapture }));
    global.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

    const { pingIndexNow } = await import('@/lib/indexnow');
    const result = await pingIndexNow(['https://example.com/page']);

    expect(result).toBe(false);
    expect(mockCapture).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: expect.objectContaining({ component: 'indexnow' }) }),
    );
  });

  it('sends correct payload to IndexNow endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ status: 200 });
    global.fetch = mockFetch;

    const { pingIndexNow } = await import('@/lib/indexnow');
    await pingIndexNow(['https://example.com/p1', 'https://example.com/p2']);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.indexnow.org/IndexNow',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"urlList":["https://example.com/p1","https://example.com/p2"]'),
      }),
    );
  });

  it('uses custom host when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ status: 200 });
    global.fetch = mockFetch;

    const { pingIndexNow } = await import('@/lib/indexnow');
    await pingIndexNow(['https://example.com/page'], 'custom.example.com');

    const body = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
    expect(body.host).toBe('custom.example.com');
  });
});

// ---------------------------------------------------------------------------
// § 2 — approveAndPublish calls distributeMenu (magic-menus)
// ---------------------------------------------------------------------------

describe('approveAndPublish → distributeMenu', () => {
  const mockDistributeMenu = vi.fn().mockResolvedValue({
    status: 'distributed',
    engineResults: [{ engine: 'indexnow', status: 'success' }],
    contentHash: 'sha256-abc',
    distributedAt: '2026-03-04T00:00:00.000Z',
  });

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();

    process.env.NEXT_PUBLIC_APP_URL = 'https://app.localvector.ai';

    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }));
    vi.doMock('@/lib/auth', () => ({
      getSafeAuthContext: vi.fn().mockResolvedValue({ orgId: 'org-1', userId: 'u-1' }),
    }));
    vi.doMock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
    vi.doMock('@/lib/distribution', () => ({ distributeMenu: mockDistributeMenu }));

    const mockSingle = vi.fn().mockResolvedValue({
      data: { public_slug: 'charcoal-n-chill', propagation_events: [] },
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
  });

  it('calls distributeMenu after successful publish', async () => {
    const mod = await import('@/app/dashboard/magic-menus/actions');
    await mod.approveAndPublish('menu-1');

    expect(mockDistributeMenu).toHaveBeenCalledWith(
      expect.anything(), // supabase client
      'menu-1',
      'org-1',
    );
  });

  it('does not call distributeMenu when public_slug is null', async () => {
    vi.resetModules();

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
      data: { public_slug: null, propagation_events: [] },
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

    mockDistributeMenu.mockClear();
    const { approveAndPublish } = await import('@/app/dashboard/magic-menus/actions');
    await approveAndPublish('menu-1');

    expect(mockDistributeMenu).not.toHaveBeenCalled();
  });
});
