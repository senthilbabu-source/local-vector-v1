// ---------------------------------------------------------------------------
// Sprint 6: Perplexity Pages Detector — unit tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

import {
  isPerplexityPage,
  detectPerplexityPages,
} from '@/lib/services/perplexity-pages-detector.service';

// ── Helper: mock Supabase ─────────────────────────────────────────────────

function createMockSupabase(overrides?: {
  evaluations?: unknown[];
  evalError?: { message: string } | null;
  queries?: unknown[];
  upsertError?: { message: string } | null;
}) {
  const upsertFn = vi.fn().mockResolvedValue({
    error: overrides?.upsertError ?? null,
  });

  return {
    from: vi.fn((table: string) => {
      if (table === 'sov_evaluations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: overrides?.evaluations ?? [],
                    error: overrides?.evalError ?? null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'target_queries') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: overrides?.queries ?? [],
            }),
          }),
        };
      }
      if (table === 'perplexity_pages_detections') {
        return {
          upsert: upsertFn,
        };
      }
      return {};
    }),
    _upsertFn: upsertFn,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Sprint 6 — Perplexity Pages Detector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isPerplexityPage', () => {
    it('returns true for https://perplexity.ai/page/hookah-bars-atlanta', () => {
      expect(isPerplexityPage('https://perplexity.ai/page/hookah-bars-atlanta')).toBe(true);
    });

    it('returns true for https://www.perplexity.ai/page/foo', () => {
      expect(isPerplexityPage('https://www.perplexity.ai/page/foo')).toBe(true);
    });

    it('returns false for https://perplexity.ai/search/foo', () => {
      expect(isPerplexityPage('https://perplexity.ai/search/foo')).toBe(false);
    });

    it('returns false for https://yelp.com/biz/foo', () => {
      expect(isPerplexityPage('https://yelp.com/biz/foo')).toBe(false);
    });
  });

  describe('detectPerplexityPages', () => {
    it('returns new_detections: 0 when no cited_sources', async () => {
      const supabase = createMockSupabase({
        evaluations: [
          { id: 'eval-1', engine: 'perplexity', query_id: 'q-1', cited_sources: null, source_mentions: null },
        ],
        queries: [{ id: 'q-1', query_text: 'best bbq' }],
      });

      const result = await detectPerplexityPages(supabase as never, 'org-1', 'loc-1');
      expect(result.new_detections).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('returns new_detections: 1 when one perplexity page URL found', async () => {
      const supabase = createMockSupabase({
        evaluations: [
          {
            id: 'eval-1',
            engine: 'perplexity',
            query_id: 'q-1',
            cited_sources: [
              { url: 'https://perplexity.ai/page/best-bbq-atlanta', title: 'Best BBQ' },
              { url: 'https://yelp.com/biz/some-place', title: 'Yelp' },
            ],
            source_mentions: null,
          },
        ],
        queries: [{ id: 'q-1', query_text: 'best bbq atlanta' }],
      });

      const result = await detectPerplexityPages(supabase as never, 'org-1', 'loc-1');
      expect(result.new_detections).toBe(1);
    });

    it('upserts with ON CONFLICT updating last_seen_at', async () => {
      const supabase = createMockSupabase({
        evaluations: [
          {
            id: 'eval-1',
            engine: 'perplexity',
            query_id: 'q-1',
            cited_sources: [
              { url: 'https://perplexity.ai/page/best-bbq', title: 'BBQ Page' },
            ],
            source_mentions: null,
          },
        ],
        queries: [{ id: 'q-1', query_text: 'best bbq' }],
      });

      await detectPerplexityPages(supabase as never, 'org-1', 'loc-1');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const upsertFn = (supabase as any)._upsertFn;
      expect(upsertFn).toHaveBeenCalled();
      const upsertCall = upsertFn.mock.calls[0];
      expect(upsertCall[1]).toEqual({ onConflict: 'org_id,page_url' });
    });

    it('ignores non-perplexity URLs in cited_sources', async () => {
      const supabase = createMockSupabase({
        evaluations: [
          {
            id: 'eval-1',
            engine: 'perplexity',
            query_id: 'q-1',
            cited_sources: [
              { url: 'https://yelp.com/biz/foo', title: 'Yelp' },
              { url: 'https://google.com/maps/place/bar', title: 'Google' },
            ],
            source_mentions: null,
          },
        ],
        queries: [{ id: 'q-1', query_text: 'best bbq' }],
      });

      const result = await detectPerplexityPages(supabase as never, 'org-1', 'loc-1');
      expect(result.new_detections).toBe(0);
    });

    it('never throws — returns errors array on DB failure', async () => {
      const supabase = createMockSupabase({
        evalError: { message: 'DB connection failed' },
      });

      const result = await detectPerplexityPages(supabase as never, 'org-1', 'loc-1');
      // Should not throw
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('DB connection failed');
    });
  });
});
