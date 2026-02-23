// ---------------------------------------------------------------------------
// scan-params.ts — Pure TS utilities for /scan result dashboard (Sprint 33)
//
// Encodes/decodes ScanResult into URL search params, and derives estimated
// KPI scores from the real scan result.
//
// AI_RULES §24: KPI scores are derived from the REAL Perplexity scan result
// (status + severity). They are labeled "Estimated" in the UI — never
// presented as live monitored data.
// ---------------------------------------------------------------------------

import type { ScanResult } from '@/app/actions/marketing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KpiScores = {
  avs:      number;                              // 0–100 AI Visibility Score
  sentiment: number;                             // 0–100 Sentiment Index
  citation: number;                              // 0–100 Citation Integrity
  mentions: 'None' | 'Low' | 'Medium' | 'High'; // Qualitative AI mention volume
};

export type ScanDisplayData =
  | {
      status:       'fail';
      businessName: string;
      engine:       string;
      severity:     'critical' | 'high' | 'medium';
      claimText:    string;
      expectedTruth: string;
    }
  | { status: 'pass';      businessName: string; engine: string }
  | { status: 'not_found'; businessName: string; engine: string }
  | { status: 'invalid' };

// ---------------------------------------------------------------------------
// parseScanParams — decode URL search params → ScanDisplayData
// ---------------------------------------------------------------------------

export function parseScanParams(params: Record<string, string>): ScanDisplayData {
  const status = params['status'];

  if (status === 'fail') {
    const engine       = params['engine']   ?? '';
    const severity     = params['severity'] as 'critical' | 'high' | 'medium' | undefined;
    const claimText    = params['claim']    ?? '';
    const expectedTruth = params['truth']   ?? '';
    const businessName = params['biz']      ?? '';

    if (
      !businessName ||
      !engine ||
      !claimText ||
      !expectedTruth ||
      !severity ||
      !['critical', 'high', 'medium'].includes(severity)
    ) {
      return { status: 'invalid' };
    }

    return { status: 'fail', businessName, engine, severity, claimText, expectedTruth };
  }

  if (status === 'pass' || status === 'not_found') {
    const businessName = params['biz']    ?? '';
    const engine       = params['engine'] ?? '';
    if (!businessName || !engine) return { status: 'invalid' };
    return { status, businessName, engine };
  }

  return { status: 'invalid' };
}

// ---------------------------------------------------------------------------
// buildScanParams — encode ScanResult → URLSearchParams (for router.push)
// ---------------------------------------------------------------------------

export function buildScanParams(result: ScanResult, nameInput: string): URLSearchParams {
  const p = new URLSearchParams();
  p.set('status', result.status);

  if (result.status === 'fail') {
    p.set('biz',      result.business_name || nameInput);
    p.set('engine',   result.engine);
    p.set('severity', result.severity);
    p.set('claim',    result.claim_text);
    p.set('truth',    result.expected_truth);
  } else if (result.status === 'pass' || result.status === 'not_found') {
    p.set('biz',    result.business_name || nameInput);
    p.set('engine', result.engine);
  }

  return p;
}

// ---------------------------------------------------------------------------
// deriveKpiScores — produce estimated KPI numbers from scan result
//
// Derivation table (AI_RULES §24: driven by real scan data, labeled Estimated):
//   fail + critical → avs: 18, sentiment: 12, citation: 22, mentions: 'Low'
//   fail + high     → avs: 34, sentiment: 28, citation: 38, mentions: 'Low'
//   fail + medium   → avs: 48, sentiment: 41, citation: 51, mentions: 'Medium'
//   pass            → avs: 79, sentiment: 74, citation: 82, mentions: 'High'
//   not_found       → avs: 11, sentiment:  8, citation:  9, mentions: 'None'
// ---------------------------------------------------------------------------

export function deriveKpiScores(data: ScanDisplayData): KpiScores {
  if (data.status === 'fail') {
    if (data.severity === 'critical') {
      return { avs: 18, sentiment: 12, citation: 22, mentions: 'Low' };
    }
    if (data.severity === 'high') {
      return { avs: 34, sentiment: 28, citation: 38, mentions: 'Low' };
    }
    // medium
    return { avs: 48, sentiment: 41, citation: 51, mentions: 'Medium' };
  }
  if (data.status === 'pass') {
    return { avs: 79, sentiment: 74, citation: 82, mentions: 'High' };
  }
  if (data.status === 'not_found') {
    return { avs: 11, sentiment: 8, citation: 9, mentions: 'None' };
  }
  // invalid — should not reach here in normal flow
  return { avs: 0, sentiment: 0, citation: 0, mentions: 'None' };
}
