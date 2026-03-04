// @vitest-environment node
/**
 * Distribution Orchestrator — Unit Tests (Sprint 1: Distribution Engine)
 *
 * Verifies distributeMenu():
 * - Content hash comparison (skip vs distribute)
 * - Engine adapter dispatch
 * - Propagation event recording
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MenuExtractedItem } from '@/lib/types/menu';
import type { DistributionEngine, EngineResult } from '@/lib/distribution/distribution-types';
import { computeMenuHash } from '@/lib/distribution/content-hasher';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const MENU_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const ORG_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

const ITEMS: MenuExtractedItem[] = [
  { id: 'i1', name: 'Chicken 65', price: '14.99', category: 'Appetizers', confidence: 0.95 },
  { id: 'i2', name: 'Lamb Biryani', price: '18.99', category: 'Mains', confidence: 0.88 },
];

const EXTRACTED_DATA = { items: ITEMS, extracted_at: '2026-03-04T00:00:00Z' };

/** Compute expected hash to compare against */
function getExpectedHash(): string {
  return computeMenuHash(ITEMS);
}

/** Create a mock engine that returns a given result */
function mockEngine(name: string, result: Partial<EngineResult> = {}): DistributionEngine {
  return {
    name,
    distribute: vi.fn().mockResolvedValue({
      engine: name,
      status: 'success',
      ...result,
    }),
  };
}

/** Build a mock Supabase client */
function buildMockSupabase(menuRow: Record<string, unknown> | null, fetchError: unknown = null) {
  const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });
  const mockSingle = vi.fn().mockResolvedValue({ data: menuRow, error: fetchError });
  const mockSelectEq = vi.fn().mockReturnValue({ single: mockSingle });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockSelectEq });

  return {
    client: {
      from: vi.fn().mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
      }),
    },
    mockUpdate,
    mockUpdateEq,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('distributeMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.localvector.ai';
  });

  it('returns no_changes when content_hash matches stored hash', async () => {
    const { distributeMenu } = await import('@/lib/distribution/distribution-orchestrator');
    const expectedHash = getExpectedHash();
    const { client } = buildMockSupabase({
      extracted_data: EXTRACTED_DATA,
      content_hash: expectedHash,
      public_slug: 'charcoal-n-chill',
      propagation_events: [],
    });

    const result = await distributeMenu(client as any, MENU_ID, ORG_ID);
    expect(result.status).toBe('no_changes');
    expect(result.contentHash).toBe(expectedHash);
    expect(result.engineResults).toEqual([]);
  });

  it('distributes when hash differs from stored hash', async () => {
    const { distributeMenu } = await import('@/lib/distribution/distribution-orchestrator');
    const engine = mockEngine('test_engine');
    const { client } = buildMockSupabase({
      extracted_data: EXTRACTED_DATA,
      content_hash: 'sha256-old-hash-that-does-not-match',
      public_slug: 'charcoal-n-chill',
      propagation_events: [],
    });

    const result = await distributeMenu(client as any, MENU_ID, ORG_ID, [engine]);
    expect(result.status).toBe('distributed');
    expect(result.engineResults).toHaveLength(1);
    expect(result.engineResults[0].status).toBe('success');
    expect(result.contentHash).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(result.distributedAt).toBeTruthy();
  });

  it('distributes when no stored hash exists (first distribution)', async () => {
    const { distributeMenu } = await import('@/lib/distribution/distribution-orchestrator');
    const engine = mockEngine('test_engine');
    const { client } = buildMockSupabase({
      extracted_data: EXTRACTED_DATA,
      content_hash: null,
      public_slug: 'charcoal-n-chill',
      propagation_events: [],
    });

    const result = await distributeMenu(client as any, MENU_ID, ORG_ID, [engine]);
    expect(result.status).toBe('distributed');
  });

  it('returns error when menu not found', async () => {
    const { distributeMenu } = await import('@/lib/distribution/distribution-orchestrator');
    const { client } = buildMockSupabase(null, { message: 'not found' });

    const result = await distributeMenu(client as any, MENU_ID, ORG_ID);
    expect(result.status).toBe('error');
  });

  it('returns error when extracted_data is null', async () => {
    const { distributeMenu } = await import('@/lib/distribution/distribution-orchestrator');
    const { client } = buildMockSupabase({
      extracted_data: null,
      content_hash: null,
      public_slug: 'charcoal-n-chill',
      propagation_events: [],
    });

    const result = await distributeMenu(client as any, MENU_ID, ORG_ID);
    expect(result.status).toBe('error');
  });

  it('returns error when public_slug is null', async () => {
    const { distributeMenu } = await import('@/lib/distribution/distribution-orchestrator');
    const { client } = buildMockSupabase({
      extracted_data: EXTRACTED_DATA,
      content_hash: null,
      public_slug: null,
      propagation_events: [],
    });

    const result = await distributeMenu(client as any, MENU_ID, ORG_ID);
    expect(result.status).toBe('error');
  });

  it('records indexnow_pinged event on successful IndexNow', async () => {
    const { distributeMenu } = await import('@/lib/distribution/distribution-orchestrator');
    const engine = mockEngine('indexnow');
    const { client, mockUpdate, mockUpdateEq } = buildMockSupabase({
      extracted_data: EXTRACTED_DATA,
      content_hash: null,
      public_slug: 'charcoal-n-chill',
      propagation_events: [{ event: 'published', date: '2026-03-04T00:00:00Z' }],
    });

    await distributeMenu(client as any, MENU_ID, ORG_ID, [engine]);

    // Verify the update call includes indexnow_pinged event
    expect(mockUpdate).toHaveBeenCalled();
    const updateArg = mockUpdate.mock.calls[0][0];
    const events = updateArg.propagation_events;
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: 'published' }),
        expect.objectContaining({ event: 'indexnow_pinged' }),
      ]),
    );
  });

  it('handles partial engine failure — successful engines still recorded', async () => {
    const { distributeMenu } = await import('@/lib/distribution/distribution-orchestrator');
    const successEngine = mockEngine('indexnow');
    const failEngine = mockEngine('gbp', { status: 'error', message: 'API down' });
    const { client, mockUpdate } = buildMockSupabase({
      extracted_data: EXTRACTED_DATA,
      content_hash: null,
      public_slug: 'charcoal-n-chill',
      propagation_events: [],
    });

    const result = await distributeMenu(client as any, MENU_ID, ORG_ID, [
      successEngine,
      failEngine,
    ]);

    expect(result.status).toBe('distributed');
    expect(result.engineResults).toHaveLength(2);

    // Only successful engine's event should be recorded
    const updateArg = mockUpdate.mock.calls[0][0];
    const events = updateArg.propagation_events;
    expect(events).toHaveLength(1); // only indexnow_pinged
    expect(events[0].event).toBe('indexnow_pinged');
  });

  it('updates content_hash and last_distributed_at in DB', async () => {
    const { distributeMenu } = await import('@/lib/distribution/distribution-orchestrator');
    const engine = mockEngine('indexnow');
    const { client, mockUpdate } = buildMockSupabase({
      extracted_data: EXTRACTED_DATA,
      content_hash: null,
      public_slug: 'charcoal-n-chill',
      propagation_events: [],
    });

    await distributeMenu(client as any, MENU_ID, ORG_ID, [engine]);

    const updateArg = mockUpdate.mock.calls[0][0];
    expect(updateArg.content_hash).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(updateArg.last_distributed_at).toBeTruthy();
  });

  it('catches thrown errors and reports to Sentry', async () => {
    const Sentry = await import('@sentry/nextjs');
    const { distributeMenu } = await import('@/lib/distribution/distribution-orchestrator');

    // Client that throws on .from()
    const brokenClient = {
      from: vi.fn().mockImplementation(() => {
        throw new Error('DB connection lost');
      }),
    };

    const result = await distributeMenu(brokenClient as any, MENU_ID, ORG_ID);
    expect(result.status).toBe('error');
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({ component: 'distribution-orchestrator' }),
      }),
    );
  });
});
