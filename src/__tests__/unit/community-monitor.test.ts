// ---------------------------------------------------------------------------
// Sprint 6: Community Monitor Service — unit tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ai module
vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// Mock providers
vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn().mockReturnValue('mock-model'),
  hasApiKey: vi.fn().mockReturnValue(true),
}));

import {
  parseMentionsFromResponse,
  classifyMentionSentiment,
  monitorCommunityPlatforms,
} from '@/lib/services/community-monitor.service';
import { generateText } from 'ai';
import { hasApiKey } from '@/lib/ai/providers';

// ── Helper: mock Supabase ─────────────────────────────────────────────────

function createMockSupabase(overrides?: {
  selectData?: unknown[];
  upsertError?: { message: string } | null;
}) {
  const limitFn = vi.fn().mockResolvedValue({
    data: overrides?.selectData ?? [],
  });
  const gteFn = vi.fn().mockReturnValue({ limit: limitFn });
  const eq2Fn = vi.fn().mockReturnValue({ gte: gteFn });
  const eq1Fn = vi.fn().mockReturnValue({ eq: eq2Fn });
  const selectFn = vi.fn().mockReturnValue({ eq: eq1Fn });
  const upsertFn = vi.fn().mockResolvedValue({
    error: overrides?.upsertError ?? null,
  });

  return {
    from: vi.fn().mockReturnValue({
      select: selectFn,
      upsert: upsertFn,
    }),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Sprint 6 — Community Monitor Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseMentionsFromResponse', () => {
    it('returns empty array for NO_MENTIONS_FOUND', () => {
      expect(parseMentionsFromResponse('NO_MENTIONS_FOUND')).toEqual([]);
    });

    it('parses one mention correctly', () => {
      const text = `MENTION: Great BBQ place on Main Street
AUTHOR: John D.
DATE: March 2026
URL: https://nextdoor.com/post/123`;

      const result = parseMentionsFromResponse(text);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        content: 'Great BBQ place on Main Street',
        author: 'John D.',
        date: 'March 2026',
        url: 'https://nextdoor.com/post/123',
      });
    });

    it('parses multiple mentions from multi-block response', () => {
      const text = `MENTION: First mention content
AUTHOR: Alice
DATE: 2 weeks ago
URL: None

MENTION: Second mention content
AUTHOR: Bob
DATE: Unknown
URL: https://quora.com/answer/456`;

      const result = parseMentionsFromResponse(text);
      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('First mention content');
      expect(result[0].url).toBeNull(); // "None" becomes null
      expect(result[1].content).toBe('Second mention content');
      expect(result[1].url).toBe('https://quora.com/answer/456');
    });

    it('returns empty array for empty string', () => {
      expect(parseMentionsFromResponse('')).toEqual([]);
    });
  });

  describe('classifyMentionSentiment', () => {
    it('returns negative for text containing "never again"', () => {
      expect(classifyMentionSentiment('I would never again go there')).toBe('negative');
    });

    it('returns positive for text containing "amazing"', () => {
      expect(classifyMentionSentiment('The food was amazing and fresh')).toBe('positive');
    });

    it('returns neutral for generic text', () => {
      expect(classifyMentionSentiment('Went to the restaurant on Tuesday')).toBe('neutral');
    });
  });

  describe('monitorCommunityPlatforms', () => {
    it('returns zeros when PERPLEXITY_API_KEY is not set', async () => {
      vi.mocked(hasApiKey).mockReturnValue(false);

      const supabase = createMockSupabase();
      const result = await monitorCommunityPlatforms(
        supabase as never,
        'loc-1',
        'org-1',
        'Test Biz',
        'Atlanta',
        'GA',
      );

      expect(result).toEqual({
        nextdoor_mentions: 0,
        quora_mentions: 0,
        errors: [],
      });
      expect(generateText).not.toHaveBeenCalled();
    });

    it('skips a platform when recency gate blocks it', async () => {
      vi.mocked(hasApiKey).mockReturnValue(true);

      // Return a recent row for both platforms → both should be skipped
      const supabase = createMockSupabase({
        selectData: [{ id: 'existing' }],
      });

      const result = await monitorCommunityPlatforms(
        supabase as never,
        'loc-1',
        'org-1',
        'Test Biz',
        'Atlanta',
        'GA',
      );

      expect(result.nextdoor_mentions).toBe(0);
      expect(result.quora_mentions).toBe(0);
      expect(generateText).not.toHaveBeenCalled();
    });

    it('calls generateText twice when both platforms need scanning', async () => {
      vi.mocked(hasApiKey).mockReturnValue(true);
      vi.mocked(generateText).mockResolvedValue({
        text: 'NO_MENTIONS_FOUND',
      } as never);

      const supabase = createMockSupabase({ selectData: [] });

      await monitorCommunityPlatforms(
        supabase as never,
        'loc-1',
        'org-1',
        'Test Biz',
        'Atlanta',
        'GA',
      );

      expect(generateText).toHaveBeenCalledTimes(2);
    });

    it('upserts with ON CONFLICT DO NOTHING (ignoreDuplicates)', async () => {
      vi.mocked(hasApiKey).mockReturnValue(true);
      vi.mocked(generateText).mockResolvedValue({
        text: `MENTION: Great spot
AUTHOR: Jane
DATE: Today
URL: None`,
      } as never);

      const upsertFn = vi.fn().mockResolvedValue({ error: null });
      const supabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [] }),
                }),
              }),
            }),
          }),
          upsert: upsertFn,
        }),
      };

      await monitorCommunityPlatforms(
        supabase as never,
        'loc-1',
        'org-1',
        'Test Biz',
        'Atlanta',
        'GA',
      );

      // Should have called upsert with ignoreDuplicates: true
      expect(upsertFn).toHaveBeenCalled();
      const upsertCall = upsertFn.mock.calls[0];
      expect(upsertCall[1]).toEqual({
        onConflict: 'org_id,mention_key',
        ignoreDuplicates: true,
      });
    });

    it('returns errors in errors array instead of throwing', async () => {
      vi.mocked(hasApiKey).mockReturnValue(true);
      vi.mocked(generateText).mockRejectedValue(new Error('API_FAILURE'));

      const supabase = createMockSupabase({ selectData: [] });

      const result = await monitorCommunityPlatforms(
        supabase as never,
        'loc-1',
        'org-1',
        'Test Biz',
        'Atlanta',
        'GA',
      );

      // Should not throw — errors captured in array
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('API_FAILURE');
    });
  });
});
