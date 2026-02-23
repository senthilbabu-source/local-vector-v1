// ---------------------------------------------------------------------------
// scan-params.test.ts — Unit tests for /scan URL param utilities (Sprint 33)
//
// Tests app/scan/_utils/scan-params.ts:
//   • parseScanParams — decodes URL search params to ScanDisplayData
//   • deriveKpiScores — derives estimated KPI scores from scan result
//
// Tests app/scan/_utils/sparkline.ts:
//   • buildSparklinePath — returns valid SVG polyline points string
//
// Run:
//   npx vitest run src/__tests__/unit/scan-params.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  parseScanParams,
  deriveKpiScores,
  type ScanDisplayData,
} from '@/app/scan/_utils/scan-params';
import { buildSparklinePath } from '@/app/scan/_utils/sparkline';

// ---------------------------------------------------------------------------
// parseScanParams
// ---------------------------------------------------------------------------

describe('parseScanParams', () => {
  it('decodes valid fail params to ScanDisplayData', () => {
    const params = {
      status:   'fail',
      biz:      'Charcoal N Chill',
      engine:   'ChatGPT',
      severity: 'critical',
      claim:    'Permanently Closed',
      truth:    'Open',
    };
    const result = parseScanParams(params);
    expect(result.status).toBe('fail');
    if (result.status === 'fail') {
      expect(result.businessName).toBe('Charcoal N Chill');
      expect(result.engine).toBe('ChatGPT');
      expect(result.severity).toBe('critical');
      expect(result.claimText).toBe('Permanently Closed');
      expect(result.expectedTruth).toBe('Open');
    }
  });

  it('decodes valid pass params to ScanDisplayData', () => {
    const params = { status: 'pass', biz: 'Test Cafe', engine: 'ChatGPT' };
    const result = parseScanParams(params);
    expect(result.status).toBe('pass');
    if (result.status === 'pass') {
      expect(result.businessName).toBe('Test Cafe');
      expect(result.engine).toBe('ChatGPT');
    }
  });

  it('decodes valid not_found params to ScanDisplayData', () => {
    const params = { status: 'not_found', biz: 'Unknown Bistro', engine: 'ChatGPT' };
    const result = parseScanParams(params);
    expect(result.status).toBe('not_found');
    if (result.status === 'not_found') {
      expect(result.businessName).toBe('Unknown Bistro');
    }
  });

  it('returns invalid when status field is missing', () => {
    const result = parseScanParams({ biz: 'Some Biz', engine: 'ChatGPT' });
    expect(result.status).toBe('invalid');
  });

  it('returns invalid when fail params are missing required fields', () => {
    // Missing claim and truth
    const result = parseScanParams({ status: 'fail', biz: 'Some Biz', engine: 'ChatGPT', severity: 'high' });
    expect(result.status).toBe('invalid');
  });
});

// ---------------------------------------------------------------------------
// deriveKpiScores
// ---------------------------------------------------------------------------

describe('deriveKpiScores', () => {
  it('fail + critical → avs 18, mentions Low', () => {
    const data: ScanDisplayData = {
      status: 'fail', businessName: 'Test', engine: 'ChatGPT',
      severity: 'critical', claimText: 'Permanently Closed', expectedTruth: 'Open',
    };
    const scores = deriveKpiScores(data);
    expect(scores.avs).toBe(18);
    expect(scores.mentions).toBe('Low');
  });

  it('fail + high → avs 34', () => {
    const data: ScanDisplayData = {
      status: 'fail', businessName: 'Test', engine: 'ChatGPT',
      severity: 'high', claimText: 'Closed', expectedTruth: 'Open',
    };
    const scores = deriveKpiScores(data);
    expect(scores.avs).toBe(34);
  });

  it('pass → avs 79, mentions High', () => {
    const data: ScanDisplayData = { status: 'pass', businessName: 'Test', engine: 'ChatGPT' };
    const scores = deriveKpiScores(data);
    expect(scores.avs).toBe(79);
    expect(scores.mentions).toBe('High');
  });

  it('not_found → avs 11, mentions None', () => {
    const data: ScanDisplayData = { status: 'not_found', businessName: 'Test', engine: 'ChatGPT' };
    const scores = deriveKpiScores(data);
    expect(scores.avs).toBe(11);
    expect(scores.mentions).toBe('None');
  });
});

// ---------------------------------------------------------------------------
// buildSparklinePath
// ---------------------------------------------------------------------------

describe('buildSparklinePath', () => {
  it('returns a non-empty string for all three trend directions', () => {
    for (const trend of ['up', 'flat', 'down'] as const) {
      const path = buildSparklinePath(trend, 64, 24);
      expect(typeof path).toBe('string');
      expect(path.length).toBeGreaterThan(0);
      // Should contain coordinate pairs like "0,20 10,15 ..."
      expect(path).toMatch(/^\d+,\d+/);
    }
  });
});
