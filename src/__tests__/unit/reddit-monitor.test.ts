// ---------------------------------------------------------------------------
// src/__tests__/unit/reddit-monitor.test.ts
//
// Sprint 4: Reddit Brand Monitoring — 10 tests.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock setup ────────────────────────────────────────────────────────────

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

import {
  getRedditAccessToken,
  searchRedditMentions,
  monitorRedditMentions,
  classifySentiment,
} from '@/lib/services/reddit-monitor.service';

const originalFetch = globalThis.fetch;

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Reddit Monitor Service', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    delete process.env.REDDIT_CLIENT_ID;
    delete process.env.REDDIT_CLIENT_SECRET;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('getRedditAccessToken', () => {
    it('returns token from Reddit OAuth endpoint', async () => {
      process.env.REDDIT_CLIENT_ID = 'test-client-id';
      process.env.REDDIT_CLIENT_SECRET = 'test-client-secret';

      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'reddit-token-123' }),
      } as Response);

      const token = await getRedditAccessToken();

      expect(token).toBe('reddit-token-123');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://www.reddit.com/api/v1/access_token',
        expect.objectContaining({
          method: 'POST',
          body: 'grant_type=client_credentials',
        }),
      );
    });

    it('throws when REDDIT_CLIENT_ID is not set', async () => {
      await expect(getRedditAccessToken()).rejects.toThrow(
        'REDDIT_CLIENT_ID or REDDIT_CLIENT_SECRET not configured',
      );
    });
  });

  describe('searchRedditMentions', () => {
    it('fetches posts with correct User-Agent header', async () => {
      vi.mocked(globalThis.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: { children: [] } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: { children: [] } }),
        } as Response);

      await searchRedditMentions('token-123', 'Test Business');

      const [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
      expect((options as RequestInit).headers).toEqual(
        expect.objectContaining({
          'User-Agent': 'LocalVector-Monitor/1.0 (by /u/localvector_bot)',
        }),
      );
    });

    it('fetches comments in a second call', async () => {
      vi.mocked(globalThis.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: { children: [] } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                children: [
                  {
                    data: {
                      name: 't1_abc123',
                      subreddit: 'food',
                      body: 'Great place',
                      author: 'user1',
                      permalink: '/r/food/comments/abc/comment/abc123',
                      score: 5,
                      created_utc: 1709294400,
                    },
                  },
                ],
              },
            }),
        } as Response);

      const results = await searchRedditMentions('token-123', 'Test Business');

      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      const secondUrl = vi.mocked(globalThis.fetch).mock.calls[1][0];
      expect(secondUrl).toContain('type=comment');
      expect(results.some((r) => r.post_type === 'comment')).toBe(true);
    });
  });

  describe('monitorRedditMentions', () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockSupabase = {
      from: vi.fn().mockReturnValue({ upsert: mockUpsert }),
    } as unknown as Parameters<typeof monitorRedditMentions>[0];

    it('returns { new_mentions: 0 } when no API keys', async () => {
      const result = await monitorRedditMentions(
        mockSupabase,
        'loc-1',
        'org-1',
        'Test Business',
      );

      expect(result.new_mentions).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('never throws — returns errors array on failure', async () => {
      process.env.REDDIT_CLIENT_ID = 'test-id';
      process.env.REDDIT_CLIENT_SECRET = 'test-secret';

      vi.mocked(globalThis.fetch).mockRejectedValue(new Error('Network error'));

      const result = await monitorRedditMentions(
        mockSupabase,
        'loc-1',
        'org-1',
        'Test Business',
      );

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('classifySentiment', () => {
    it('detects "never again" as negative', () => {
      expect(classifySentiment('I will never again go there')).toBe('negative');
    });

    it('detects "amazing" as positive', () => {
      expect(classifySentiment('The food was amazing!')).toBe('positive');
    });

    it('classifies neutral text as neutral', () => {
      expect(classifySentiment('I went to the restaurant yesterday')).toBe(
        'neutral',
      );
    });
  });
});
