// ---------------------------------------------------------------------------
// src/__tests__/unit/tripadvisor-review-fetcher.test.ts
//
// Sprint 4: TripAdvisor review fetcher — 9 tests.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock setup ────────────────────────────────────────────────────────────

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

import * as Sentry from '@sentry/nextjs';
import { fetchTripAdvisorReviews } from '@/lib/review-engine/fetchers/tripadvisor-review-fetcher';

const mockMaybeSingle = vi.fn();
const mockEq2 = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockEq1 = vi.fn(() => ({ eq: mockEq2 }));
const mockSelect = vi.fn(() => ({ eq: mockEq1 }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

const mockSupabase = { from: mockFrom } as unknown as Parameters<typeof fetchTripAdvisorReviews>[0];

const originalFetch = globalThis.fetch;

// ── Helpers ───────────────────────────────────────────────────────────────

const TA_REVIEW = {
  id: 123456,
  url: 'https://www.tripadvisor.com/ShowUserReviews-g123-d456-r123456',
  text: 'Great hookah place!',
  rating: 5,
  published_date: '2026-03-01T12:00:00Z',
  user: { username: 'TripUser42' },
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe('fetchTripAdvisorReviews', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    mockMaybeSingle.mockReset();
    vi.mocked(Sentry.captureException).mockReset();
    vi.mocked(Sentry.captureMessage).mockReset();
    delete process.env.TRIPADVISOR_API_KEY;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns empty when TRIPADVISOR_API_KEY is not set', async () => {
    const result = await fetchTripAdvisorReviews(mockSupabase, 'loc-1', 'org-1');
    expect(result).toEqual({ reviews: [], total_count: 0 });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns empty when no listing_platform_ids row for tripadvisor', async () => {
    process.env.TRIPADVISOR_API_KEY = 'ta-test-key';
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await fetchTripAdvisorReviews(mockSupabase, 'loc-1', 'org-1');
    expect(result).toEqual({ reviews: [], total_count: 0 });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns mapped Review[] with platform tripadvisor on success', async () => {
    process.env.TRIPADVISOR_API_KEY = 'ta-test-key';
    mockMaybeSingle.mockResolvedValue({
      data: { platform_id: '8647078' },
      error: null,
    });
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [TA_REVIEW] }),
    } as Response);

    const result = await fetchTripAdvisorReviews(mockSupabase, 'loc-1', 'org-1');

    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0].platform).toBe('tripadvisor');
    expect(result.reviews[0].location_id).toBe('loc-1');
    expect(result.reviews[0].org_id).toBe('org-1');
  });

  it('maps rating, text, published_date, user.username correctly', async () => {
    process.env.TRIPADVISOR_API_KEY = 'ta-test-key';
    mockMaybeSingle.mockResolvedValue({
      data: { platform_id: '8647078' },
      error: null,
    });
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [TA_REVIEW] }),
    } as Response);

    const result = await fetchTripAdvisorReviews(mockSupabase, 'loc-1', 'org-1');
    const review = result.reviews[0];

    expect(review.rating).toBe(5);
    expect(review.text).toBe('Great hookah place!');
    expect(review.published_at).toBe('2026-03-01T12:00:00Z');
    expect(review.reviewer_name).toBe('TripUser42');
    expect(review.id).toBe('123456');
  });

  it('returns empty on 404 response (business not found)', async () => {
    process.env.TRIPADVISOR_API_KEY = 'ta-test-key';
    mockMaybeSingle.mockResolvedValue({
      data: { platform_id: '999999' },
      error: null,
    });
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not Found'),
    } as Response);

    const result = await fetchTripAdvisorReviews(mockSupabase, 'loc-1', 'org-1');
    expect(result).toEqual({ reviews: [], total_count: 0 });
  });

  it('returns empty on non-OK response (API error)', async () => {
    process.env.TRIPADVISOR_API_KEY = 'ta-test-key';
    mockMaybeSingle.mockResolvedValue({
      data: { platform_id: '8647078' },
      error: null,
    });
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    } as Response);

    const result = await fetchTripAdvisorReviews(mockSupabase, 'loc-1', 'org-1');
    expect(result).toEqual({ reviews: [], total_count: 0 });
  });

  it('reviewer_photo_url is undefined (TA does not return avatars)', async () => {
    process.env.TRIPADVISOR_API_KEY = 'ta-test-key';
    mockMaybeSingle.mockResolvedValue({
      data: { platform_id: '8647078' },
      error: null,
    });
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [TA_REVIEW] }),
    } as Response);

    const result = await fetchTripAdvisorReviews(mockSupabase, 'loc-1', 'org-1');
    expect(result.reviews[0].reviewer_photo_url).toBeUndefined();
  });

  it('passes API key as ?key= query param, not in Authorization header', async () => {
    process.env.TRIPADVISOR_API_KEY = 'ta-test-key';
    mockMaybeSingle.mockResolvedValue({
      data: { platform_id: '8647078' },
      error: null,
    });
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    } as Response);

    await fetchTripAdvisorReviews(mockSupabase, 'loc-1', 'org-1');

    const [url, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toContain('?key=ta-test-key');
    // No Authorization header — fetch called with just URL, no options
    expect(options).toBeUndefined();
  });

  it('captures Sentry exception on unexpected error', async () => {
    process.env.TRIPADVISOR_API_KEY = 'ta-test-key';
    mockMaybeSingle.mockResolvedValue({
      data: { platform_id: '8647078' },
      error: null,
    });
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('Network failure'));

    const result = await fetchTripAdvisorReviews(mockSupabase, 'loc-1', 'org-1');

    expect(result).toEqual({ reviews: [], total_count: 0 });
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: { component: 'tripadvisor-review-fetcher', sprint: '4' },
      }),
    );
  });
});
