// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// src/__tests__/unit/first-visit-tooltip.test.tsx — Sprint E (M2)
//
// Validates FirstVisitTooltip component behavior and hasVisited / markVisited
// helper functions.
//
// Run:
//   npx vitest run src/__tests__/unit/first-visit-tooltip.test.tsx
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  FirstVisitTooltip,
  hasVisited,
  markVisited,
} from '@/components/ui/FirstVisitTooltip';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string): string | null => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Render the component inside act() so the useEffect / state settle. */
async function renderTooltip(props: {
  pageKey: string;
  title: string;
  content: string;
  learnMoreHref?: string;
}) {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(<FirstVisitTooltip {...props} />);
  });
  return result;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorageMock.clear();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
});

// ---------------------------------------------------------------------------
// FirstVisitTooltip component tests
// ---------------------------------------------------------------------------

describe('FirstVisitTooltip — visibility based on visited state', () => {
  it('does NOT render when lv_visited_pages already contains the pageKey', async () => {
    // Pre-populate localStorage so the page is already visited
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['entity-health']));

    await renderTooltip({
      pageKey: 'entity-health',
      title: 'Entity Health',
      content: 'Monitor your business entity here.',
    });

    const tooltip = screen.queryByTestId('first-visit-tooltip-entity-health');
    expect(tooltip).toBeNull();
  });

  it('DOES render when lv_visited_pages is empty', async () => {
    // localStorage returns an empty array
    localStorageMock.getItem.mockReturnValue(JSON.stringify([]));

    await renderTooltip({
      pageKey: 'share-of-voice',
      title: 'Share of Voice',
      content: 'Track AI mentions of your business.',
    });

    const tooltip = screen.queryByTestId('first-visit-tooltip-share-of-voice');
    expect(tooltip).not.toBeNull();
  });

  it('DOES render when pageKey is not in the visited array', async () => {
    // Another page has been visited, but not this one
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['other-page']));

    await renderTooltip({
      pageKey: 'citations',
      title: 'Citations',
      content: 'Web mentions that train AI models.',
    });

    const tooltip = screen.queryByTestId('first-visit-tooltip-citations');
    expect(tooltip).not.toBeNull();
  });
});

describe('FirstVisitTooltip — data-testid attributes', () => {
  it('renders with correct data-testid="first-visit-tooltip-{pageKey}"', async () => {
    localStorageMock.getItem.mockReturnValue(null);

    await renderTooltip({
      pageKey: 'revenue-impact',
      title: 'Revenue Impact',
      content: 'Estimate lost revenue from AI misinformation.',
    });

    const tooltip = screen.queryByTestId('first-visit-tooltip-revenue-impact');
    expect(tooltip).not.toBeNull();
  });

  it('dismiss button has data-testid="first-visit-dismiss-{pageKey}"', async () => {
    localStorageMock.getItem.mockReturnValue(null);

    await renderTooltip({
      pageKey: 'revenue-impact',
      title: 'Revenue Impact',
      content: 'Estimate lost revenue from AI misinformation.',
    });

    const dismissBtn = screen.queryByTestId('first-visit-dismiss-revenue-impact');
    expect(dismissBtn).not.toBeNull();
  });
});

describe('FirstVisitTooltip — dismiss behaviour', () => {
  it('clicking dismiss adds pageKey to lv_visited_pages in localStorage', async () => {
    localStorageMock.getItem.mockReturnValue(null);

    await renderTooltip({
      pageKey: 'entity-health',
      title: 'Entity Health',
      content: 'Monitor your business entity here.',
    });

    const dismissBtn = screen.getByTestId('first-visit-dismiss-entity-health');

    await act(async () => {
      fireEvent.click(dismissBtn);
    });

    // setItem must have been called with the storage key
    const setItemCalls = localStorageMock.setItem.mock.calls;
    const relevantCall = setItemCalls.find(([key]) => key === 'lv_visited_pages');
    expect(relevantCall).toBeDefined();

    // The written value must include 'entity-health'
    const written: string[] = JSON.parse(relevantCall![1] as string);
    expect(written).toContain('entity-health');
  });

  it('clicking dismiss hides the tooltip', async () => {
    localStorageMock.getItem.mockReturnValue(null);

    await renderTooltip({
      pageKey: 'entity-health',
      title: 'Entity Health',
      content: 'Monitor your business entity here.',
    });

    expect(screen.queryByTestId('first-visit-tooltip-entity-health')).not.toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId('first-visit-dismiss-entity-health'));
    });

    expect(screen.queryByTestId('first-visit-tooltip-entity-health')).toBeNull();
  });

  it('after dismiss, re-rendering does NOT show tooltip', async () => {
    // Simulate that the page is now marked visited (as dismiss would have done)
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['entity-health']));

    await renderTooltip({
      pageKey: 'entity-health',
      title: 'Entity Health',
      content: 'Monitor your business entity here.',
    });

    expect(screen.queryByTestId('first-visit-tooltip-entity-health')).toBeNull();
  });
});

describe('FirstVisitTooltip — content rendering', () => {
  it('renders title text correctly', async () => {
    localStorageMock.getItem.mockReturnValue(null);

    await renderTooltip({
      pageKey: 'share-of-voice',
      title: 'Share of Voice',
      content: 'Track AI mentions of your business.',
    });

    const title = screen.getByText('Share of Voice');
    expect(title).toBeDefined();
    expect(title.className).toContain('font-semibold');
  });

  it('renders content text correctly', async () => {
    localStorageMock.getItem.mockReturnValue(null);

    await renderTooltip({
      pageKey: 'share-of-voice',
      title: 'Share of Voice',
      content: 'Track AI mentions of your business.',
    });

    expect(screen.getByText('Track AI mentions of your business.')).toBeDefined();
  });

  it('renders "Learn more →" link when learnMoreHref is provided', async () => {
    localStorageMock.getItem.mockReturnValue(null);

    await renderTooltip({
      pageKey: 'citations',
      title: 'Citations',
      content: 'Web mentions that train AI models.',
      learnMoreHref: 'https://docs.localvector.ai/citations',
    });

    const link = screen.getByText('Learn more →');
    expect(link).toBeDefined();
    expect((link as HTMLAnchorElement).href).toBe('https://docs.localvector.ai/citations');
  });

  it('does NOT render "Learn more →" when learnMoreHref is omitted', async () => {
    localStorageMock.getItem.mockReturnValue(null);

    await renderTooltip({
      pageKey: 'citations',
      title: 'Citations',
      content: 'Web mentions that train AI models.',
    });

    expect(screen.queryByText('Learn more →')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// hasVisited() helper function tests
// ---------------------------------------------------------------------------

describe('hasVisited()', () => {
  it('returns false when localStorage key does not exist', () => {
    localStorageMock.getItem.mockReturnValue(null);
    expect(hasVisited('entity-health')).toBe(false);
  });

  it('returns true when array includes pageKey', () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['entity-health', 'citations']));
    expect(hasVisited('entity-health')).toBe(true);
  });

  it('returns false (does not throw) when localStorage contains invalid JSON', () => {
    localStorageMock.getItem.mockReturnValue('NOT_VALID_JSON{{');
    expect(() => hasVisited('entity-health')).not.toThrow();
    expect(hasVisited('entity-health')).toBe(false);
  });
});
