/**
 * Sprint 105 — NAP Health Score calculator unit tests.
 * Target: lib/nap-sync/nap-health-score.ts
 * Pure function — zero mocks needed.
 */

import { describe, it, expect } from 'vitest';
import { calculateNAPHealthScore } from '@/lib/nap-sync/nap-health-score';
import type { PlatformDiscrepancy, AdapterResult } from '@/lib/nap-sync/types';

function makeDiscrepancy(
  overrides: Partial<PlatformDiscrepancy>,
): PlatformDiscrepancy {
  return {
    platform: 'yelp',
    location_id: 'loc-1',
    org_id: 'org-1',
    status: 'match',
    discrepant_fields: [],
    severity: 'none',
    auto_correctable: false,
    detected_at: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeAdapterResult(platform: string, status: string): AdapterResult {
  if (status === 'ok') {
    return { status: 'ok', platform: platform as AdapterResult extends { platform: infer P } ? P : never, data: {}, fetched_at: '2026-03-01T00:00:00.000Z' } as AdapterResult;
  }
  if (status === 'unconfigured') {
    return { status: 'unconfigured', platform, reason: 'test' } as AdapterResult;
  }
  if (status === 'api_error') {
    return { status: 'api_error', platform, message: 'test' } as AdapterResult;
  }
  return { status: 'not_found', platform } as AdapterResult;
}

describe('calculateNAPHealthScore', () => {
  it('returns score 100 when all platforms match', () => {
    const discrepancies = [
      makeDiscrepancy({ platform: 'google', status: 'match' }),
      makeDiscrepancy({ platform: 'yelp', status: 'match' }),
    ];
    const adapters = [makeAdapterResult('google', 'ok'), makeAdapterResult('yelp', 'ok')];
    const result = calculateNAPHealthScore(discrepancies, adapters);
    expect(result.score).toBe(100);
  });

  it('deducts 25 per critical field (phone wrong on Yelp)', () => {
    const discrepancies = [
      makeDiscrepancy({
        platform: 'yelp',
        status: 'discrepancy',
        severity: 'critical',
        discrepant_fields: [{ field: 'phone', ground_truth_value: 'a', platform_value: 'b' }],
      }),
    ];
    const adapters = [makeAdapterResult('yelp', 'ok')];
    const result = calculateNAPHealthScore(discrepancies, adapters);
    expect(result.score).toBe(75);
  });

  it('deducts 15 per high field (name wrong)', () => {
    const discrepancies = [
      makeDiscrepancy({
        status: 'discrepancy',
        severity: 'high',
        discrepant_fields: [{ field: 'name', ground_truth_value: 'a', platform_value: 'b' }],
      }),
    ];
    const adapters = [makeAdapterResult('yelp', 'ok')];
    const result = calculateNAPHealthScore(discrepancies, adapters);
    expect(result.score).toBe(85);
  });

  it('deducts 8 per medium field', () => {
    const discrepancies = [
      makeDiscrepancy({
        status: 'discrepancy',
        severity: 'medium',
        discrepant_fields: [{ field: 'hours', ground_truth_value: '{}', platform_value: '{}' }],
      }),
    ];
    const adapters = [makeAdapterResult('yelp', 'ok')];
    const result = calculateNAPHealthScore(discrepancies, adapters);
    expect(result.score).toBe(92);
  });

  it('deducts 3 per low field', () => {
    const discrepancies = [
      makeDiscrepancy({
        status: 'discrepancy',
        severity: 'low',
        discrepant_fields: [{ field: 'website', ground_truth_value: 'a', platform_value: 'b' }],
      }),
    ];
    const adapters = [makeAdapterResult('yelp', 'ok')];
    const result = calculateNAPHealthScore(discrepancies, adapters);
    expect(result.score).toBe(97);
  });

  it('deducts 5 per unconfigured platform', () => {
    const discrepancies = [
      makeDiscrepancy({ platform: 'apple_maps', status: 'unconfigured' }),
    ];
    const adapters = [makeAdapterResult('apple_maps', 'unconfigured')];
    const result = calculateNAPHealthScore(discrepancies, adapters);
    expect(result.score).toBe(95);
  });

  it('deducts 2 per api_error platform', () => {
    const discrepancies = [
      makeDiscrepancy({ platform: 'bing', status: 'api_error' }),
    ];
    const adapters = [makeAdapterResult('bing', 'api_error')];
    const result = calculateNAPHealthScore(discrepancies, adapters);
    expect(result.score).toBe(98);
  });

  it('score is capped at 0 minimum (never negative)', () => {
    const discrepancies = [
      makeDiscrepancy({
        status: 'discrepancy',
        severity: 'critical',
        discrepant_fields: [
          { field: 'phone', ground_truth_value: 'a', platform_value: 'b' },
          { field: 'address', ground_truth_value: 'a', platform_value: 'b' },
        ],
      }),
      makeDiscrepancy({
        platform: 'bing',
        status: 'discrepancy',
        severity: 'critical',
        discrepant_fields: [
          { field: 'phone', ground_truth_value: 'a', platform_value: 'b' },
          { field: 'address', ground_truth_value: 'a', platform_value: 'b' },
        ],
      }),
      makeDiscrepancy({
        platform: 'apple_maps',
        status: 'discrepancy',
        severity: 'critical',
        discrepant_fields: [
          { field: 'phone', ground_truth_value: 'a', platform_value: 'b' },
        ],
      }),
    ];
    const adapters = [
      makeAdapterResult('yelp', 'ok'),
      makeAdapterResult('bing', 'ok'),
      makeAdapterResult('apple_maps', 'ok'),
    ];
    const result = calculateNAPHealthScore(discrepancies, adapters);
    expect(result.score).toBe(0);
  });

  it('score is capped at 100 maximum', () => {
    const result = calculateNAPHealthScore([], []);
    expect(result.score).toBe(100);
  });

  it("100 score → grade 'A'", () => {
    const result = calculateNAPHealthScore([], []);
    expect(result.grade).toBe('A');
  });

  it("85 score → grade 'B'", () => {
    const discrepancies = [
      makeDiscrepancy({
        status: 'discrepancy',
        discrepant_fields: [{ field: 'name', ground_truth_value: 'a', platform_value: 'b' }],
      }),
    ];
    const adapters = [makeAdapterResult('yelp', 'ok')];
    const result = calculateNAPHealthScore(discrepancies, adapters);
    expect(result.grade).toBe('B');
  });

  it("65 score → grade 'C' (golden tenant scenario)", () => {
    // phone wrong (-25) + unconfigured (-5) + not_found (0) + api_error (-2) = -32 → 68
    // Simulating the golden tenant scenario with enough deductions to get ~65
    const discrepancies = [
      makeDiscrepancy({ platform: 'google', status: 'match' }),
      makeDiscrepancy({
        platform: 'yelp',
        status: 'discrepancy',
        severity: 'critical',
        discrepant_fields: [{ field: 'phone', ground_truth_value: 'a', platform_value: 'b' }],
      }),
      makeDiscrepancy({ platform: 'apple_maps', status: 'unconfigured' }),
      makeDiscrepancy({
        platform: 'bing',
        status: 'discrepancy',
        severity: 'low',
        discrepant_fields: [{ field: 'website', ground_truth_value: 'a', platform_value: 'b' }],
      }),
    ];
    const adapters = [
      makeAdapterResult('google', 'ok'),
      makeAdapterResult('yelp', 'ok'),
      makeAdapterResult('apple_maps', 'unconfigured'),
      makeAdapterResult('bing', 'ok'),
    ];
    const result = calculateNAPHealthScore(discrepancies, adapters);
    // -25 (phone) -5 (unconfigured) -3 (website) = -33 → 67
    expect(result.score).toBe(67);
    expect(result.grade).toBe('C');
  });

  it("50 score → grade 'D'", () => {
    const discrepancies = [
      makeDiscrepancy({
        status: 'discrepancy',
        discrepant_fields: [
          { field: 'phone', ground_truth_value: 'a', platform_value: 'b' },
          { field: 'address', ground_truth_value: 'a', platform_value: 'b' },
        ],
      }),
    ];
    const adapters = [makeAdapterResult('yelp', 'ok')];
    const result = calculateNAPHealthScore(discrepancies, adapters);
    expect(result.score).toBe(50);
    expect(result.grade).toBe('D');
  });

  it("30 score → grade 'F'", () => {
    const discrepancies = [
      makeDiscrepancy({
        status: 'discrepancy',
        discrepant_fields: [
          { field: 'phone', ground_truth_value: 'a', platform_value: 'b' },
          { field: 'address', ground_truth_value: 'a', platform_value: 'b' },
          { field: 'name', ground_truth_value: 'a', platform_value: 'b' },
        ],
      }),
    ];
    const adapters = [makeAdapterResult('yelp', 'ok')];
    const result = calculateNAPHealthScore(discrepancies, adapters);
    // -25 -25 -15 = -65 → 35
    expect(result.score).toBe(35);
    expect(result.grade).toBe('F');
  });

  it('platforms_checked reflects actual adapter results count', () => {
    const adapters = [
      makeAdapterResult('google', 'ok'),
      makeAdapterResult('yelp', 'ok'),
      makeAdapterResult('bing', 'ok'),
    ];
    const result = calculateNAPHealthScore([], adapters);
    expect(result.platforms_checked).toBe(3);
  });

  it("platforms_matched is accurate (only 'match' status counts)", () => {
    const discrepancies = [
      makeDiscrepancy({ platform: 'google', status: 'match' }),
      makeDiscrepancy({ platform: 'yelp', status: 'discrepancy', discrepant_fields: [{ field: 'phone', ground_truth_value: 'a', platform_value: 'b' }] }),
    ];
    const adapters = [makeAdapterResult('google', 'ok'), makeAdapterResult('yelp', 'ok')];
    const result = calculateNAPHealthScore(discrepancies, adapters);
    expect(result.platforms_matched).toBe(1);
  });

  it("critical_discrepancies counts severity === 'critical' items", () => {
    const discrepancies = [
      makeDiscrepancy({ status: 'discrepancy', severity: 'critical', discrepant_fields: [{ field: 'phone', ground_truth_value: 'a', platform_value: 'b' }] }),
      makeDiscrepancy({ platform: 'bing', status: 'discrepancy', severity: 'low', discrepant_fields: [{ field: 'website', ground_truth_value: 'a', platform_value: 'b' }] }),
    ];
    const adapters = [makeAdapterResult('yelp', 'ok'), makeAdapterResult('bing', 'ok')];
    const result = calculateNAPHealthScore(discrepancies, adapters);
    expect(result.critical_discrepancies).toBe(1);
  });
});
