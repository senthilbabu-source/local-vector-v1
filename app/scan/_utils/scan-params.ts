// ---------------------------------------------------------------------------
// scan-params.ts — Pure TS utilities for /scan result dashboard (Sprint 34)
//
// Encodes/decodes ScanResult into URL search params.
//
// Sprint 34: replaced the Sprint 33 KPI lookup table (deriveKpiScores) with
// real scan fields (mentions, sentiment, accuracyIssues) returned directly
// by Perplexity. URL schema gains three new optional params:
//   mentions  — 'none'|'low'|'medium'|'high'
//   sentiment — 'positive'|'neutral'|'negative'
//   issues    — pipe-separated accuracy issue strings (URL-encoded)
//
// Backwards-compat: Sprint 33 URLs that lack mentions/sentiment params
// gracefully default to 'low' / 'neutral' — never return 'invalid'.
//
// AI_RULES §24: real categoricals from scan shown free; locked numericals
// are honest about requiring continuous monitoring (no derived fake numbers).
// ---------------------------------------------------------------------------

import type { ScanResult } from '@/app/actions/marketing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScanDisplayData =
  | {
      status:         'fail';
      businessName:   string;
      engine:         string;
      severity:       'critical' | 'high' | 'medium';
      claimText:      string;
      expectedTruth:  string;
      /** Real AI-presence fields from Perplexity audit (Sprint 34) */
      mentions:       'none' | 'low' | 'medium' | 'high';
      sentiment:      'positive' | 'neutral' | 'negative';
      accuracyIssues: string[];
    }
  | {
      status:         'pass';
      businessName:   string;
      engine:         string;
      /** Real AI-presence fields from Perplexity audit (Sprint 34) */
      mentions:       'none' | 'low' | 'medium' | 'high';
      sentiment:      'positive' | 'neutral' | 'negative';
      accuracyIssues: string[];
    }
  | { status: 'not_found'; businessName: string; engine: string }
  | { status: 'invalid' };

// ---------------------------------------------------------------------------
// Validation constants (module-private)
// ---------------------------------------------------------------------------

const VALID_MENTIONS   = ['none', 'low', 'medium', 'high'] as const;
const VALID_SENTIMENTS = ['positive', 'neutral', 'negative'] as const;

// ---------------------------------------------------------------------------
// parseScanParams — decode URL search params → ScanDisplayData
// ---------------------------------------------------------------------------

export function parseScanParams(params: Record<string, string>): ScanDisplayData {
  const status = params['status'];

  if (status === 'fail') {
    const engine        = params['engine']   ?? '';
    const severity      = params['severity'] as 'critical' | 'high' | 'medium' | undefined;
    const claimText     = params['claim']    ?? '';
    const expectedTruth = params['truth']    ?? '';
    const businessName  = params['biz']      ?? '';

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

    // Graceful defaults for Sprint 33 URLs that lack these params
    const mentionsParam = params['mentions'] ?? '';
    const mentions: 'none' | 'low' | 'medium' | 'high' =
      (VALID_MENTIONS as readonly string[]).includes(mentionsParam)
        ? (mentionsParam as 'none' | 'low' | 'medium' | 'high')
        : 'low';

    const sentimentParam = params['sentiment'] ?? '';
    const sentiment: 'positive' | 'neutral' | 'negative' =
      (VALID_SENTIMENTS as readonly string[]).includes(sentimentParam)
        ? (sentimentParam as 'positive' | 'neutral' | 'negative')
        : 'neutral';

    const accuracyIssues = params['issues']
      ? params['issues'].split('|').filter(Boolean).slice(0, 3).map(s => decodeURIComponent(s))
      : [];

    return { status: 'fail', businessName, engine, severity, claimText, expectedTruth, mentions, sentiment, accuracyIssues };
  }

  if (status === 'pass') {
    const businessName = params['biz']    ?? '';
    const engine       = params['engine'] ?? '';
    if (!businessName || !engine) return { status: 'invalid' };

    // Graceful defaults for Sprint 33 URLs that lack these params
    const mentionsParam = params['mentions'] ?? '';
    const mentions: 'none' | 'low' | 'medium' | 'high' =
      (VALID_MENTIONS as readonly string[]).includes(mentionsParam)
        ? (mentionsParam as 'none' | 'low' | 'medium' | 'high')
        : 'low';

    const sentimentParam = params['sentiment'] ?? '';
    const sentiment: 'positive' | 'neutral' | 'negative' =
      (VALID_SENTIMENTS as readonly string[]).includes(sentimentParam)
        ? (sentimentParam as 'positive' | 'neutral' | 'negative')
        : 'neutral';

    const accuracyIssues = params['issues']
      ? params['issues'].split('|').filter(Boolean).slice(0, 3).map(s => decodeURIComponent(s))
      : [];

    return { status: 'pass', businessName, engine, mentions, sentiment, accuracyIssues };
  }

  if (status === 'not_found') {
    const businessName = params['biz']    ?? '';
    const engine       = params['engine'] ?? '';
    if (!businessName || !engine) return { status: 'invalid' };
    return { status: 'not_found', businessName, engine };
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
    p.set('mentions', result.mentions_volume);
    p.set('sentiment', result.sentiment);
    if (result.accuracy_issues.length > 0) {
      p.set('issues', result.accuracy_issues.map(s => encodeURIComponent(s)).join('|'));
    }
  } else if (result.status === 'pass') {
    p.set('biz',      result.business_name || nameInput);
    p.set('engine',   result.engine);
    p.set('mentions', result.mentions_volume);
    p.set('sentiment', result.sentiment);
    if (result.accuracy_issues.length > 0) {
      p.set('issues', result.accuracy_issues.map(s => encodeURIComponent(s)).join('|'));
    }
  } else if (result.status === 'not_found') {
    p.set('biz',    result.business_name || nameInput);
    p.set('engine', result.engine);
  }

  return p;
}
