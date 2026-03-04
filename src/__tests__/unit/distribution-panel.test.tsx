// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// DIST-3: Distribution Panel — Unit Tests
//
// Tests cover: engine config (3), panel rendering (7), up-to-date state (3),
// distribute action (3), crawler activity (3), URL section (1) = 20 tests.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDistributeMenuNow = vi.fn();
const mockFetchDistributionStatus = vi.fn();

vi.mock('@/app/dashboard/magic-menus/actions', () => ({
  distributeMenuNow: (...args: unknown[]) => mockDistributeMenuNow(...args),
  fetchDistributionStatus: (...args: unknown[]) => mockFetchDistributionStatus(...args),
}));

vi.mock('@/lib/admin/format-relative-date', () => ({
  formatRelativeDate: (date: string | null | undefined) => {
    if (!date) return '—';
    return '2 hours ago'; // Deterministic for testing
  },
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

import type { PropagationEvent } from '@/lib/types/menu';
import type { BotActivity } from '@/lib/data/crawler-analytics';
import {
  DISTRIBUTION_ENGINES,
  getEngineLastActivity,
} from '@/lib/distribution/distribution-engines-config';

const MOCK_MENU_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const MOCK_PUBLIC_SLUG = 'charcoal-n-chill-menu';
const MOCK_CONTENT_HASH = 'sha256-abc123def456abc123def456abc123def456abc123def456abc123def456abcd';
const MOCK_DIFFERENT_HASH = 'sha256-zzz999zzz999zzz999zzz999zzz999zzz999zzz999zzz999zzz999zzz999zzzz';

const MOCK_EVENTS: PropagationEvent[] = [
  { event: 'published', date: '2026-03-01T00:00:00Z' },
  { event: 'indexnow_pinged', date: '2026-03-02T10:00:00Z' },
  { event: 'gbp_menu_pushed', date: '2026-03-02T10:01:00Z' },
];

const MOCK_CRAWLER_HITS: BotActivity[] = [
  { botType: 'gptbot', label: 'GPTBot', engine: 'ChatGPT', description: 'OpenAI training crawler', visitCount: 5, lastVisitAt: '2026-03-04T12:15:00Z', status: 'active' },
  { botType: 'perplexitybot', label: 'PerplexityBot', engine: 'Perplexity', description: 'Perplexity search crawler', visitCount: 2, lastVisitAt: '2026-03-03T08:00:00Z', status: 'low' },
  { botType: 'google-extended', label: 'Google-Extended', engine: 'Gemini', description: 'Gemini AI training', visitCount: 3, lastVisitAt: '2026-03-04T10:00:00Z', status: 'active' },
];

const DEFAULT_STATUS_RESPONSE = {
  success: true as const,
  contentHash: MOCK_CONTENT_HASH,
  computedHash: MOCK_DIFFERENT_HASH,
  lastDistributedAt: '2026-03-04T14:15:00Z',
  propagationEvents: MOCK_EVENTS,
  recentCrawlerHits: MOCK_CRAWLER_HITS,
};

// Lazy-import DistributionPanel (must be after mocks)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let DistributionPanel: any;

beforeEach(async () => {
  vi.clearAllMocks();
  mockFetchDistributionStatus.mockResolvedValue(DEFAULT_STATUS_RESPONSE);
  mockDistributeMenuNow.mockResolvedValue({
    success: true,
    result: {
      status: 'distributed',
      engineResults: [
        { engine: 'indexnow', status: 'success' },
        { engine: 'gbp', status: 'success' },
        { engine: 'apple_bc', status: 'skipped', message: 'Not yet implemented' },
      ],
      contentHash: MOCK_DIFFERENT_HASH,
      distributedAt: '2026-03-04T14:30:00Z',
    },
  });
  const mod = await import('@/app/dashboard/magic-menus/_components/DistributionPanel');
  DistributionPanel = mod.default;
});

function renderPanel(overrides: Record<string, unknown> = {}) {
  const props = {
    menuId: MOCK_MENU_ID,
    publicSlug: MOCK_PUBLIC_SLUG,
    contentHash: MOCK_CONTENT_HASH,
    lastDistributedAt: '2026-03-04T14:15:00Z',
    propagationEvents: MOCK_EVENTS,
    ...overrides,
  };
  return render(<DistributionPanel {...props} />);
}

// ===========================================================================
// 1. Config tests (3)
// ===========================================================================

describe('DISTRIBUTION_ENGINES config', () => {
  it('has exactly 6 engine entries', () => {
    expect(DISTRIBUTION_ENGINES).toHaveLength(6);
  });

  it('all active engines have a propagationEvent', () => {
    const activeEngines = DISTRIBUTION_ENGINES.filter((e) => e.type === 'active');
    expect(activeEngines.length).toBeGreaterThan(0);
    for (const engine of activeEngines) {
      expect(engine.propagationEvent).not.toBeNull();
    }
  });

  it('all passive engines have null propagationEvent', () => {
    const passiveEngines = DISTRIBUTION_ENGINES.filter((e) => e.type === 'passive');
    expect(passiveEngines.length).toBeGreaterThan(0);
    for (const engine of passiveEngines) {
      expect(engine.propagationEvent).toBeNull();
    }
  });
});

// ===========================================================================
// 2. getEngineLastActivity helper (2)
// ===========================================================================

describe('getEngineLastActivity', () => {
  it('returns most recent matching event timestamp', () => {
    const gbpEngine = DISTRIBUTION_ENGINES.find((e) => e.id === 'gbp')!;
    const events: PropagationEvent[] = [
      { event: 'gbp_menu_pushed', date: '2026-03-01T10:00:00Z' },
      { event: 'gbp_menu_pushed', date: '2026-03-02T10:00:00Z' },
    ];
    expect(getEngineLastActivity(gbpEngine, events)).toBe('2026-03-02T10:00:00Z');
  });

  it('returns null for passive engines', () => {
    const chatgptEngine = DISTRIBUTION_ENGINES.find((e) => e.id === 'chatgpt')!;
    expect(getEngineLastActivity(chatgptEngine, MOCK_EVENTS)).toBeNull();
  });
});

// ===========================================================================
// 3. Panel render tests (7)
// ===========================================================================

describe('DistributionPanel rendering', () => {
  it('renders all 6 engine rows', async () => {
    renderPanel();
    await waitFor(() => {
      for (const engine of DISTRIBUTION_ENGINES) {
        expect(screen.getByTestId(`engine-row-${engine.id}`)).toBeDefined();
      }
    });
  });

  it('renders "Pushed" badge for GBP when gbp_menu_pushed event exists', async () => {
    renderPanel();
    await waitFor(() => {
      const gbpStatus = screen.getByTestId('engine-status-gbp');
      expect(gbpStatus.textContent).toBe('Pushed');
    });
  });

  it('renders "Pending" badge for Apple BC when no apple_bc_synced event', async () => {
    renderPanel();
    await waitFor(() => {
      const appleStatus = screen.getByTestId('engine-status-apple_bc');
      expect(appleStatus.textContent).toBe('Pending');
    });
  });

  it('renders "Visited" badge for ChatGPT when GPTBot crawler hit exists', async () => {
    renderPanel();
    await waitFor(() => {
      const chatgptStatus = screen.getByTestId('engine-status-chatgpt');
      expect(chatgptStatus.textContent).toBe('Visited');
    });
  });

  it('renders "Awaiting crawl" for Perplexity when no matching crawler hit', async () => {
    mockFetchDistributionStatus.mockResolvedValue({
      ...DEFAULT_STATUS_RESPONSE,
      recentCrawlerHits: [], // No crawler hits
    });
    renderPanel();
    await waitFor(() => {
      const perplexityStatus = screen.getByTestId('engine-status-perplexity');
      expect(perplexityStatus.textContent).toBe('Awaiting crawl');
    });
  });

  it('renders last distributed timestamp', async () => {
    renderPanel();
    await waitFor(() => {
      const header = screen.getByTestId('distribution-status-header');
      expect(header.textContent).toContain('Last distributed:');
    });
  });

  it('renders "Not yet distributed" when lastDistributedAt is null', async () => {
    mockFetchDistributionStatus.mockResolvedValue({
      ...DEFAULT_STATUS_RESPONSE,
      lastDistributedAt: null,
    });
    renderPanel({ lastDistributedAt: null });
    await waitFor(() => {
      const header = screen.getByTestId('distribution-status-header');
      expect(header.textContent).toContain('Not yet distributed');
    });
  });
});

// ===========================================================================
// 4. Up-to-date state tests (3)
// ===========================================================================

describe('DistributionPanel up-to-date state', () => {
  it('shows "Up to date" when content hash matches computed hash', async () => {
    mockFetchDistributionStatus.mockResolvedValue({
      ...DEFAULT_STATUS_RESPONSE,
      contentHash: MOCK_CONTENT_HASH,
      computedHash: MOCK_CONTENT_HASH, // Same hash
    });
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId('up-to-date-label')).toBeDefined();
      expect(screen.queryByTestId('distribute-button')).toBeNull();
    });
  });

  it('shows "Distribute Now" button when hash differs', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId('distribute-button')).toBeDefined();
      expect(screen.queryByTestId('up-to-date-label')).toBeNull();
    });
  });

  it('button is enabled when no content hash exists (first distribution)', async () => {
    mockFetchDistributionStatus.mockResolvedValue({
      ...DEFAULT_STATUS_RESPONSE,
      contentHash: null,
      computedHash: MOCK_CONTENT_HASH,
    });
    renderPanel({ contentHash: null });
    await waitFor(() => {
      const button = screen.getByTestId('distribute-button');
      expect(button).toBeDefined();
      expect((button as HTMLButtonElement).disabled).toBe(false);
    });
  });
});

// ===========================================================================
// 5. Distribute action tests (3)
// ===========================================================================

describe('DistributionPanel distribute action', () => {
  it('clicking Distribute Now calls distributeMenuNow with menuId', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId('distribute-button')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('distribute-button'));
    await waitFor(() => {
      expect(mockDistributeMenuNow).toHaveBeenCalledWith(MOCK_MENU_ID);
    });
  });

  it('shows "Distributing…" during distribution', async () => {
    // Make distributeMenuNow hang
    mockDistributeMenuNow.mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId('distribute-button')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('distribute-button'));
    await waitFor(() => {
      const button = screen.getByTestId('distribute-button');
      expect(button.textContent).toContain('Distributing');
      expect((button as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it('refreshes status after successful distribution', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId('distribute-button')).toBeDefined();
    });
    // First call on mount, second after distribute
    expect(mockFetchDistributionStatus).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('distribute-button'));
    await waitFor(() => {
      // Called again after distribute completes
      expect(mockFetchDistributionStatus).toHaveBeenCalledTimes(2);
    });
  });
});

// ===========================================================================
// 6. Crawler activity tests (3)
// ===========================================================================

describe('DistributionPanel crawler activity', () => {
  it('renders recent crawler hits with relative times', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId('crawler-hit-gptbot')).toBeDefined();
      expect(screen.getByTestId('crawler-hit-gptbot').textContent).toContain('GPTBot');
      expect(screen.getByTestId('crawler-hit-gptbot').textContent).toContain('visited');
    });
  });

  it('shows "No AI bot visits" when no crawler hits', async () => {
    mockFetchDistributionStatus.mockResolvedValue({
      ...DEFAULT_STATUS_RESPONSE,
      recentCrawlerHits: [],
    });
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId('no-crawler-hits')).toBeDefined();
      expect(screen.getByTestId('no-crawler-hits').textContent).toContain('No AI bot visits');
    });
  });

  it('limits display to top 5 most recent hits', async () => {
    const manyHits: BotActivity[] = Array.from({ length: 8 }, (_, i) => ({
      botType: `bot-${i}`,
      label: `Bot ${i}`,
      engine: `Engine ${i}`,
      description: `Description ${i}`,
      visitCount: i + 1,
      lastVisitAt: `2026-03-0${Math.min(i + 1, 4)}T12:00:00Z`,
      status: 'active' as const,
    }));
    mockFetchDistributionStatus.mockResolvedValue({
      ...DEFAULT_STATUS_RESPONSE,
      recentCrawlerHits: manyHits,
    });
    renderPanel();
    await waitFor(() => {
      const section = screen.getByTestId('crawler-activity-section');
      const items = section.querySelectorAll('li');
      expect(items.length).toBe(5);
    });
  });
});

// ===========================================================================
// 7. URL section test (1)
// ===========================================================================

describe('DistributionPanel URL section', () => {
  it('renders public menu URL and copy button', async () => {
    renderPanel();
    await waitFor(() => {
      const urlSection = screen.getByTestId('distribution-url');
      expect(urlSection.textContent).toContain(`/m/${MOCK_PUBLIC_SLUG}`);
      expect(screen.getByTestId('copy-url-button')).toBeDefined();
    });
  });
});
