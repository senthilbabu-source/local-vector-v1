// ---------------------------------------------------------------------------
// freshness-alert-service.test.ts — Sprint 76: Pure service tests
//
// Tests detectFreshnessDecay() and formatFreshnessMessage() which analyze
// consecutive visibility_analytics snapshots for citation rate declines.
//
// Run: npx vitest run src/__tests__/unit/freshness-alert-service.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  detectFreshnessDecay,
  formatFreshnessMessage,
  type VisibilitySnapshot,
} from '@/lib/services/freshness-alert.service';
import { MOCK_FRESHNESS_SNAPSHOTS } from '@/__fixtures__/golden-tenant';

describe('detectFreshnessDecay', () => {
  it('returns insufficient_data with empty array', () => {
    const result = detectFreshnessDecay([]);
    expect(result.trend).toBe('insufficient_data');
    expect(result.alerts).toHaveLength(0);
    expect(result.currentCitationRate).toBeNull();
  });

  it('returns insufficient_data with single snapshot', () => {
    const result = detectFreshnessDecay([MOCK_FRESHNESS_SNAPSHOTS[0]]);
    expect(result.trend).toBe('insufficient_data');
    expect(result.currentCitationRate).toBe(0.45);
  });

  it('returns stable when citation_rate is flat', () => {
    const snapshots: VisibilitySnapshot[] = [
      { snapshot_date: '2026-02-12', citation_rate: 0.45, share_of_voice: 0.50 },
      { snapshot_date: '2026-02-19', citation_rate: 0.44, share_of_voice: 0.50 },
      { snapshot_date: '2026-02-26', citation_rate: 0.45, share_of_voice: 0.50 },
    ];
    const result = detectFreshnessDecay(snapshots);
    expect(result.trend).toBe('stable');
    expect(result.alerts).toHaveLength(0);
  });

  it('returns improving when citation_rate is increasing', () => {
    const snapshots: VisibilitySnapshot[] = [
      { snapshot_date: '2026-02-12', citation_rate: 0.30, share_of_voice: 0.40 },
      { snapshot_date: '2026-02-19', citation_rate: 0.35, share_of_voice: 0.45 },
      { snapshot_date: '2026-02-26', citation_rate: 0.45, share_of_voice: 0.50 },
    ];
    const result = detectFreshnessDecay(snapshots);
    expect(result.trend).toBe('improving');
    expect(result.alerts).toHaveLength(0);
  });

  it('detects >20% relative drop as warning', () => {
    const result = detectFreshnessDecay(MOCK_FRESHNESS_SNAPSHOTS);
    expect(result.trend).toBe('declining');
    // Drop from 0.42 to 0.30 = 28.6%
    const alert = result.alerts.find((a) => a.previousRate === 0.42);
    expect(alert).toBeDefined();
    expect(alert!.severity).toBe('warning');
    expect(alert!.dropPercentage).toBeGreaterThan(20);
    expect(alert!.dropPercentage).toBeLessThanOrEqual(40);
  });

  it('detects >40% relative drop as critical', () => {
    const snapshots: VisibilitySnapshot[] = [
      { snapshot_date: '2026-02-12', citation_rate: 0.50, share_of_voice: 0.50 },
      { snapshot_date: '2026-02-26', citation_rate: 0.25, share_of_voice: 0.30 },
    ];
    const result = detectFreshnessDecay(snapshots);
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].severity).toBe('critical');
    expect(result.alerts[0].dropPercentage).toBe(50);
  });

  it('creates alert with correct dates and rates', () => {
    const result = detectFreshnessDecay(MOCK_FRESHNESS_SNAPSHOTS);
    const alert = result.alerts.find((a) => a.previousRate === 0.42);
    expect(alert).toBeDefined();
    expect(alert!.currentRate).toBe(0.30);
    expect(alert!.previousDate).toBe('2026-02-19');
    expect(alert!.currentDate).toBe('2026-02-26');
  });

  it('ignores null citation_rate snapshots', () => {
    const snapshots: VisibilitySnapshot[] = [
      { snapshot_date: '2026-02-12', citation_rate: 0.45, share_of_voice: 0.50 },
      { snapshot_date: '2026-02-19', citation_rate: null, share_of_voice: 0.45 },
      { snapshot_date: '2026-02-26', citation_rate: 0.44, share_of_voice: 0.40 },
    ];
    const result = detectFreshnessDecay(snapshots);
    expect(result.trend).toBe('stable');
    expect(result.alerts).toHaveLength(0);
  });

  it('handles exactly 2 snapshots (minimum for comparison)', () => {
    const snapshots: VisibilitySnapshot[] = [
      { snapshot_date: '2026-02-19', citation_rate: 0.50, share_of_voice: 0.50 },
      { snapshot_date: '2026-02-26', citation_rate: 0.35, share_of_voice: 0.40 },
    ];
    const result = detectFreshnessDecay(snapshots);
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].dropPercentage).toBe(30);
    expect(result.trend).toBe('declining');
  });

  it('produces multiple alerts for consecutive drops', () => {
    const snapshots: VisibilitySnapshot[] = [
      { snapshot_date: '2026-02-05', citation_rate: 0.60, share_of_voice: 0.60 },
      { snapshot_date: '2026-02-12', citation_rate: 0.40, share_of_voice: 0.50 },
      { snapshot_date: '2026-02-19', citation_rate: 0.20, share_of_voice: 0.40 },
    ];
    const result = detectFreshnessDecay(snapshots);
    expect(result.alerts).toHaveLength(2);
  });

  it('skips comparison when previous rate is zero', () => {
    const snapshots: VisibilitySnapshot[] = [
      { snapshot_date: '2026-02-12', citation_rate: 0, share_of_voice: 0.50 },
      { snapshot_date: '2026-02-19', citation_rate: 0.10, share_of_voice: 0.50 },
    ];
    const result = detectFreshnessDecay(snapshots);
    expect(result.alerts).toHaveLength(0);
  });

  it('sets currentCitationRate from the last valid snapshot', () => {
    const result = detectFreshnessDecay(MOCK_FRESHNESS_SNAPSHOTS);
    expect(result.currentCitationRate).toBe(0.30);
  });

  it('returns insufficient_data when all citation_rates are null', () => {
    const snapshots: VisibilitySnapshot[] = [
      { snapshot_date: '2026-02-12', citation_rate: null, share_of_voice: 0.50 },
      { snapshot_date: '2026-02-19', citation_rate: null, share_of_voice: 0.45 },
    ];
    const result = detectFreshnessDecay(snapshots);
    expect(result.trend).toBe('insufficient_data');
  });
});

describe('formatFreshnessMessage', () => {
  it('produces human-readable message', () => {
    const message = formatFreshnessMessage({
      dropPercentage: 28.6,
      previousRate: 0.42,
      currentRate: 0.30,
      previousDate: '2026-02-19',
      currentDate: '2026-02-26',
      severity: 'warning',
    });
    expect(message).toContain('28.6%');
    expect(message).toContain('42%');
    expect(message).toContain('30%');
    expect(message).toContain('Feb');
  });
});
