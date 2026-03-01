// ---------------------------------------------------------------------------
// lib/nap-sync/nap-health-score.ts — NAP Health Score calculator
//
// Sprint 105: Pure function. Calculates composite 0–100 score.
// ---------------------------------------------------------------------------

import type { PlatformDiscrepancy, AdapterResult, NAPHealthScore } from './types';

/**
 * Calculates the NAP Health Score from platform discrepancy results.
 *
 * Scoring algorithm:
 * Base score: 100
 * Deductions per discrepancy (cumulative, capped at -100):
 *   - critical: -25 per field
 *   - high:     -15 per field
 *   - medium:   -8  per field
 *   - low:      -3  per field
 *   - unconfigured platform: -5
 *   - api_error platform: -2
 *
 * Grade scale:
 *   90–100 → A
 *   75–89  → B
 *   60–74  → C
 *   40–59  → D
 *   0–39   → F
 */
export function calculateNAPHealthScore(
  discrepancies: PlatformDiscrepancy[],
  adapterResults: AdapterResult[],
): NAPHealthScore {
  let deductions = 0;

  // Deductions from discrepancies (field-level)
  for (const d of discrepancies) {
    if (d.status === 'unconfigured') {
      deductions += 5;
    } else if (d.status === 'api_error') {
      deductions += 2;
    } else if (d.status === 'discrepancy') {
      for (const field of d.discrepant_fields) {
        const fieldSeverity = getFieldSeverity(field.field as string);
        switch (fieldSeverity) {
          case 'critical':
            deductions += 25;
            break;
          case 'high':
            deductions += 15;
            break;
          case 'medium':
            deductions += 8;
            break;
          case 'low':
            deductions += 3;
            break;
        }
      }
    }
    // 'match' and 'not_found' have no deduction
  }

  const score = Math.max(0, Math.min(100, 100 - deductions));

  const grade = scoreToGrade(score);

  const platformsChecked = adapterResults.length;
  const platformsMatched = discrepancies.filter((d) => d.status === 'match').length;
  const criticalDiscrepancies = discrepancies.filter(
    (d) => d.severity === 'critical',
  ).length;

  return {
    score,
    grade,
    platforms_checked: platformsChecked,
    platforms_matched: platformsMatched,
    critical_discrepancies: criticalDiscrepancies,
    last_checked_at: new Date().toISOString(),
  };
}

function getFieldSeverity(
  fieldName: string,
): 'critical' | 'high' | 'medium' | 'low' {
  switch (fieldName) {
    case 'phone':
    case 'address':
      return 'critical';
    case 'name':
    case 'operational_status':
      return 'high';
    case 'hours':
      return 'medium';
    case 'website':
    default:
      return 'low';
  }
}

function scoreToGrade(score: number): NAPHealthScore['grade'] {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}
