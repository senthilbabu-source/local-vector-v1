// ---------------------------------------------------------------------------
// scan-params.test.ts — Unit tests for /scan URL param utilities (Sprint 34)
//
// Tests app/scan/_utils/scan-params.ts:
//   • parseScanParams  — decodes URL search params to ScanDisplayData
//   • buildScanParams  — encodes ScanResult to URLSearchParams
//
// Tests app/scan/_utils/sparkline.ts:
//   • buildSparklinePath — returns valid SVG polyline points string
//
// Sprint 34: replaced deriveKpiScores tests (function removed) with real-field
// tests for mentions, sentiment, accuracyIssues.
//
// Run:
//   npx vitest run src/__tests__/unit/scan-params.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  parseScanParams,
  buildScanParams,
  type ScanDisplayData,
} from '@/app/scan/_utils/scan-params';
import type { ScanResult } from '@/app/actions/marketing';
import { buildSparklinePath } from '@/app/scan/_utils/sparkline';

// ---------------------------------------------------------------------------
// parseScanParams — existing tests
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

  // ── Sprint 34: real field decoding ──────────────────────────────────────

  it('decodes pass with mentions=high&sentiment=positive to ScanDisplayData', () => {
    const params = {
      status:    'pass',
      biz:       'Charcoal N Chill',
      engine:    'ChatGPT',
      mentions:  'high',
      sentiment: 'positive',
    };
    const result = parseScanParams(params);
    expect(result.status).toBe('pass');
    if (result.status === 'pass') {
      expect(result.mentions).toBe('high');
      expect(result.sentiment).toBe('positive');
      expect(result.accuracyIssues).toEqual([]);
    }
  });

  it('decodes fail with mentions=low&sentiment=negative to ScanDisplayData', () => {
    const params = {
      status:    'fail',
      biz:       'Test Cafe',
      engine:    'ChatGPT',
      severity:  'critical',
      claim:     'Permanently Closed',
      truth:     'Open',
      mentions:  'low',
      sentiment: 'negative',
    };
    const result = parseScanParams(params);
    expect(result.status).toBe('fail');
    if (result.status === 'fail') {
      expect(result.mentions).toBe('low');
      expect(result.sentiment).toBe('negative');
    }
  });

  it('applies graceful defaults when mentions and sentiment params are absent (Sprint 33 URL backwards-compat)', () => {
    // Sprint 33 URL — no mentions or sentiment params
    const params = { status: 'pass', biz: 'Old Cafe', engine: 'ChatGPT' };
    const result = parseScanParams(params);
    expect(result.status).toBe('pass');
    if (result.status === 'pass') {
      expect(result.mentions).toBe('low');     // default
      expect(result.sentiment).toBe('neutral'); // default
      expect(result.accuracyIssues).toEqual([]);
    }
  });

  it('decodes pipe-separated issues param to accuracyIssues array', () => {
    const issue1 = encodeURIComponent('AI reports Monday hours as closed');
    const issue2 = encodeURIComponent('AI shows wrong address');
    const params = {
      status:    'pass',
      biz:       'Test Biz',
      engine:    'ChatGPT',
      issues:    `${issue1}|${issue2}`,
    };
    const result = parseScanParams(params);
    expect(result.status).toBe('pass');
    if (result.status === 'pass') {
      expect(result.accuracyIssues).toEqual([
        'AI reports Monday hours as closed',
        'AI shows wrong address',
      ]);
    }
  });
});

// ---------------------------------------------------------------------------
// buildScanParams — Sprint 34: encodes mentions and sentiment
// ---------------------------------------------------------------------------

describe('buildScanParams', () => {
  it('encodes mentions and sentiment params for pass result', () => {
    const passResult: ScanResult = {
      status:          'pass',
      engine:          'ChatGPT',
      business_name:   'Test Cafe',
      mentions_volume: 'high',
      sentiment:       'positive',
      accuracy_issues: [],
    };
    const params = buildScanParams(passResult, 'Test Cafe');
    expect(params.get('mentions')).toBe('high');
    expect(params.get('sentiment')).toBe('positive');
    expect(params.get('status')).toBe('pass');
    expect(params.get('biz')).toBe('Test Cafe');
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
