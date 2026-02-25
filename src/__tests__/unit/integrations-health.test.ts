// @vitest-environment node
/**
 * Listings Health Utilities — Unit Tests (Sprint 42 §4d)
 *
 * Covers:
 *   - getListingHealth: all 4 states (disconnected, missing_url, stale, healthy)
 *   - healthBadge: correct labels and literal classes
 *   - Edge cases: null last_sync_at, exactly 7 days, null integration
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { getListingHealth, healthBadge, type ListingHealth } from '@/app/dashboard/integrations/_utils/health';

// ---------------------------------------------------------------------------
// getListingHealth
// ---------------------------------------------------------------------------

describe('getListingHealth', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns disconnected when integration is null', () => {
    expect(getListingHealth(null)).toBe('disconnected');
  });

  it('returns disconnected when status is not connected', () => {
    expect(
      getListingHealth({
        status: 'error',
        listing_url: 'https://example.com',
        last_sync_at: new Date().toISOString(),
      }),
    ).toBe('disconnected');
  });

  it('returns missing_url when connected but no listing URL', () => {
    expect(
      getListingHealth({
        status: 'connected',
        listing_url: null,
        last_sync_at: new Date().toISOString(),
      }),
    ).toBe('missing_url');
  });

  it('returns stale when last sync is more than 7 days ago', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 86_400_000).toISOString();
    expect(
      getListingHealth({
        status: 'connected',
        listing_url: 'https://example.com',
        last_sync_at: eightDaysAgo,
      }),
    ).toBe('stale');
  });

  it('returns healthy when connected with URL and recent sync', () => {
    const oneDayAgo = new Date(Date.now() - 1 * 86_400_000).toISOString();
    expect(
      getListingHealth({
        status: 'connected',
        listing_url: 'https://example.com',
        last_sync_at: oneDayAgo,
      }),
    ).toBe('healthy');
  });

  it('returns healthy when connected with URL and null last_sync_at', () => {
    expect(
      getListingHealth({
        status: 'connected',
        listing_url: 'https://example.com',
        last_sync_at: null,
      }),
    ).toBe('healthy');
  });

  it('returns healthy when exactly 7 days (not stale)', () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    expect(
      getListingHealth({
        status: 'connected',
        listing_url: 'https://example.com',
        last_sync_at: sevenDaysAgo,
      }),
    ).toBe('healthy');
  });

  it('returns stale when just over 7 days', () => {
    const justOver7Days = new Date(Date.now() - 7.01 * 86_400_000).toISOString();
    expect(
      getListingHealth({
        status: 'connected',
        listing_url: 'https://example.com',
        last_sync_at: justOver7Days,
      }),
    ).toBe('stale');
  });
});

// ---------------------------------------------------------------------------
// healthBadge
// ---------------------------------------------------------------------------

describe('healthBadge', () => {
  const cases: [ListingHealth, string, string][] = [
    ['healthy', 'Healthy', 'text-emerald-400'],
    ['stale', 'Stale sync', 'text-amber-400'],
    ['missing_url', 'Missing URL', 'text-amber-400'],
    ['disconnected', 'Not connected', 'text-slate-400'],
  ];

  it.each(cases)('returns correct label and classes for %s', (health, label, colorClass) => {
    const result = healthBadge(health);
    expect(result.label).toBe(label);
    expect(result.classes).toContain(colorClass);
  });
});
