// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// src/__tests__/unit/benchmarks-page.test.tsx — Sprint 103
//
// Tests the /dashboard/benchmarks page component covering all 4 states:
//   1. Auth guard (redirect to /login)
//   2. No-city state (onboarding nudge)
//   3. Collecting state (org_count < 10)
//   4. Ready state (org_count >= 10, with/without orgScore)
//
// Run:
//   npx vitest run src/__tests__/unit/benchmarks-page.test.tsx
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  MOCK_BENCHMARK_READY,
  MOCK_BENCHMARK_COLLECTING,
} from '@/src/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRedirect = vi.fn().mockImplementation(() => {
  throw new Error('NEXT_REDIRECT');
});

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}));

const mockGetSafeAuthContext = vi.fn();
vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: (...args: unknown[]) => mockGetSafeAuthContext(...args),
}));

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

const mockFetchBenchmark = vi.fn();
vi.mock('@/lib/data/benchmarks', () => ({
  fetchBenchmark: (...args: unknown[]) => mockFetchBenchmark(...args),
}));

const mockGetActiveLocationId = vi.fn().mockResolvedValue('loc-golden');
vi.mock('@/lib/location/active-location', () => ({
  getActiveLocationId: (...args: unknown[]) => mockGetActiveLocationId(...args),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockSupabase(options: { realityScore?: number | null }) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'visibility_scores') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data:
              options.realityScore !== undefined && options.realityScore !== null
                ? { reality_score: options.realityScore, snapshot_date: '2026-03-01' }
                : null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      };
    }),
  };
}

const MOCK_AUTH_CTX = { orgId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' };

async function renderPage() {
  const { default: BenchmarksPage } = await import(
    '@/app/dashboard/benchmarks/page'
  );
  const jsx = await BenchmarksPage();
  return render(jsx);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BenchmarksPage', () => {
  // ── Auth Guard ──────────────────────────────────────────────────────────

  describe('auth guard', () => {
    it('1. redirects to /login when getSafeAuthContext returns null', async () => {
      mockGetSafeAuthContext.mockResolvedValue(null);
      await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT');
      expect(mockRedirect).toHaveBeenCalledWith('/login');
    });

    it('2. redirects to /login when ctx.orgId is null', async () => {
      mockGetSafeAuthContext.mockResolvedValue({ orgId: null });
      await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT');
      expect(mockRedirect).toHaveBeenCalledWith('/login');
    });
  });

  // ── No-City State ──────────────────────────────────────────────────────

  describe('no-city state', () => {
    beforeEach(() => {
      mockGetSafeAuthContext.mockResolvedValue(MOCK_AUTH_CTX);
      const supabase = mockSupabase({ realityScore: null });
      mockCreateClient.mockResolvedValue(supabase);
      mockFetchBenchmark.mockResolvedValue({
        benchmark: null,
        locationContext: { city: null, industry: null },
      });
    });

    it('3. renders no-city state when locationContext.city is null', async () => {
      await renderPage();
      expect(screen.getByTestId('benchmark-no-city-state')).toBeDefined();
    });

    it('4. shows "No city set" message', async () => {
      await renderPage();
      expect(
        screen.getByText('No city set for your primary location.'),
      ).toBeDefined();
    });

    it('5. renders a link to /dashboard/settings', async () => {
      await renderPage();
      const link = screen.getByText('Go to Settings →');
      expect(link).toBeDefined();
      expect(link.closest('a')?.getAttribute('href')).toBe(
        '/dashboard/settings',
      );
    });
  });

  // ── Collecting State (org_count < 10) ──────────────────────────────────

  describe('collecting state (org_count < 10)', () => {
    beforeEach(() => {
      mockGetSafeAuthContext.mockResolvedValue(MOCK_AUTH_CTX);
      const supabase = mockSupabase({ realityScore: 45 });
      mockCreateClient.mockResolvedValue(supabase);
      mockFetchBenchmark.mockResolvedValue({
        benchmark: MOCK_BENCHMARK_COLLECTING,
        locationContext: { city: 'Alpharetta', industry: 'Restaurant' },
      });
    });

    it('6. renders BenchmarkComparisonCard with collecting benchmark', async () => {
      await renderPage();
      expect(
        screen.getByTestId('benchmark-comparison-card'),
      ).toBeDefined();
    });

    it('7. shows collecting state data-testid', async () => {
      await renderPage();
      expect(
        screen.getByTestId('benchmark-collecting-state'),
      ).toBeDefined();
    });

    it('8. does NOT render benchmark-about-section', async () => {
      await renderPage();
      expect(
        screen.queryByTestId('benchmark-about-section'),
      ).toBeNull();
    });

    it('9. does NOT render benchmark-improve-section', async () => {
      await renderPage();
      expect(
        screen.queryByTestId('benchmark-improve-section'),
      ).toBeNull();
    });
  });

  // ── Ready State (org_count >= 10, orgScore present) ────────────────────

  describe('ready state (org_count >= 10, orgScore present)', () => {
    it('10. renders BenchmarkComparisonCard with ready benchmark', async () => {
      mockGetSafeAuthContext.mockResolvedValue(MOCK_AUTH_CTX);
      const supabase = mockSupabase({ realityScore: 40 });
      mockCreateClient.mockResolvedValue(supabase);
      mockFetchBenchmark.mockResolvedValue({
        benchmark: MOCK_BENCHMARK_READY,
        locationContext: { city: 'Alpharetta', industry: 'Restaurant' },
      });

      await renderPage();
      expect(
        screen.getByTestId('benchmark-comparison-card'),
      ).toBeDefined();
    });

    it('11. shows benchmark-ready-state data-testid', async () => {
      mockGetSafeAuthContext.mockResolvedValue(MOCK_AUTH_CTX);
      const supabase = mockSupabase({ realityScore: 40 });
      mockCreateClient.mockResolvedValue(supabase);
      mockFetchBenchmark.mockResolvedValue({
        benchmark: MOCK_BENCHMARK_READY,
        locationContext: { city: 'Alpharetta', industry: 'Restaurant' },
      });

      await renderPage();
      expect(
        screen.getByTestId('benchmark-ready-state'),
      ).toBeDefined();
    });

    it('12. renders benchmark-about-section with org_count', async () => {
      mockGetSafeAuthContext.mockResolvedValue(MOCK_AUTH_CTX);
      const supabase = mockSupabase({ realityScore: 40 });
      mockCreateClient.mockResolvedValue(supabase);
      mockFetchBenchmark.mockResolvedValue({
        benchmark: MOCK_BENCHMARK_READY,
        locationContext: { city: 'Alpharetta', industry: 'Restaurant' },
      });

      await renderPage();
      const about = screen.getByTestId('benchmark-about-section');
      expect(about).toBeDefined();
      expect(about.textContent).toContain('14 businesses');
    });

    it('13. renders formatted computed_at date', async () => {
      mockGetSafeAuthContext.mockResolvedValue(MOCK_AUTH_CTX);
      const supabase = mockSupabase({ realityScore: 40 });
      mockCreateClient.mockResolvedValue(supabase);
      // Use a fixed mid-day date to avoid timezone boundary issues
      const fixedBenchmark = {
        ...MOCK_BENCHMARK_READY,
        computed_at: '2026-03-02T12:00:00.000Z',
      };
      mockFetchBenchmark.mockResolvedValue({
        benchmark: fixedBenchmark,
        locationContext: { city: 'Alpharetta', industry: 'Restaurant' },
      });

      await renderPage();
      const about = screen.getByTestId('benchmark-about-section');
      expect(about.textContent).toContain('March');
      expect(about.textContent).toContain('2026');
    });

    it('14. renders benchmark-improve-section when orgScore below avg_score', async () => {
      mockGetSafeAuthContext.mockResolvedValue(MOCK_AUTH_CTX);
      // orgScore 40 is below avg_score 51.2
      const supabase = mockSupabase({ realityScore: 40 });
      mockCreateClient.mockResolvedValue(supabase);
      mockFetchBenchmark.mockResolvedValue({
        benchmark: MOCK_BENCHMARK_READY,
        locationContext: { city: 'Alpharetta', industry: 'Restaurant' },
      });

      await renderPage();
      const improve = screen.getByTestId('benchmark-improve-section');
      expect(improve).toBeDefined();
      expect(improve.textContent).toContain('Resolve open hallucination alerts');
    });

    it('15. improve section links to /dashboard/hallucinations', async () => {
      mockGetSafeAuthContext.mockResolvedValue(MOCK_AUTH_CTX);
      const supabase = mockSupabase({ realityScore: 40 });
      mockCreateClient.mockResolvedValue(supabase);
      mockFetchBenchmark.mockResolvedValue({
        benchmark: MOCK_BENCHMARK_READY,
        locationContext: { city: 'Alpharetta', industry: 'Restaurant' },
      });

      await renderPage();
      const link = screen.getByText('View Alerts');
      expect(link.closest('a')?.getAttribute('href')).toBe(
        '/dashboard/hallucinations',
      );
    });

    it('16. renders "above average" message when orgScore > avg_score', async () => {
      mockGetSafeAuthContext.mockResolvedValue(MOCK_AUTH_CTX);
      // orgScore 70 is above avg_score 51.2
      const supabase = mockSupabase({ realityScore: 70 });
      mockCreateClient.mockResolvedValue(supabase);
      mockFetchBenchmark.mockResolvedValue({
        benchmark: MOCK_BENCHMARK_READY,
        locationContext: { city: 'Alpharetta', industry: 'Restaurant' },
      });

      await renderPage();
      const improve = screen.getByTestId('benchmark-improve-section');
      expect(improve.textContent).toContain('above average');
    });
  });

  // ── Ready State — No Org Score Yet ─────────────────────────────────────

  describe('ready state — no org score yet', () => {
    beforeEach(() => {
      mockGetSafeAuthContext.mockResolvedValue(MOCK_AUTH_CTX);
      const supabase = mockSupabase({ realityScore: null });
      mockCreateClient.mockResolvedValue(supabase);
      mockFetchBenchmark.mockResolvedValue({
        benchmark: MOCK_BENCHMARK_READY,
        locationContext: { city: 'Alpharetta', industry: 'Restaurant' },
      });
    });

    it('17. renders BenchmarkComparisonCard with ready benchmark but null orgScore', async () => {
      await renderPage();
      expect(
        screen.getByTestId('benchmark-comparison-card'),
      ).toBeDefined();
    });

    it('18. renders benchmark-no-score-state data-testid', async () => {
      await renderPage();
      expect(
        screen.getByTestId('benchmark-no-score-state'),
      ).toBeDefined();
    });

    it('19. does NOT render benchmark-improve-section when orgScore is null', async () => {
      await renderPage();
      expect(
        screen.queryByTestId('benchmark-improve-section'),
      ).toBeNull();
    });
  });
});
