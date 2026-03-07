// ---------------------------------------------------------------------------
// lib/ai-shopper/shopper-evaluator.ts — S25: AI Shopper Turn Evaluator
//
// Pure functions to evaluate AI responses for factual accuracy against
// ground truth. No I/O — used by shopper-runner.ts.
// ---------------------------------------------------------------------------

import type { GroundTruthContext } from './shopper-scenarios';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TurnEvaluation {
  turn: number;
  passed: boolean;
  accuracy_issues: string[];
  confidence: 'high' | 'low';
}

export interface FailureTurnResult {
  failureTurn: number | null;
  failureReason: string | null;
}

// ---------------------------------------------------------------------------
// Known wrong-fact patterns
// ---------------------------------------------------------------------------

/**
 * Evaluates a single AI response turn for factual accuracy against ground truth.
 * Checks for known wrong-fact patterns: wrong hours, "permanently closed",
 * wrong address, wrong phone.
 */
export function evaluateTurnAccuracy(
  turnNumber: number,
  response: string,
  groundTruth: GroundTruthContext,
): TurnEvaluation {
  const issues: string[] = [];
  const lower = response.toLowerCase();

  // Check for "permanently closed" — always wrong for an active business
  if (lower.includes('permanently closed') || lower.includes('temporarily closed')) {
    issues.push('AI says restaurant is closed');
  }

  // Check for wrong hours (if ground truth has hours)
  if (groundTruth.hours) {
    // Look for common wrong-hours patterns
    const hoursLower = groundTruth.hours.toLowerCase();
    // If response mentions specific times, check they don't contradict ground truth
    const timePattern = /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.))\b/gi;
    const responseTimes = response.match(timePattern) ?? [];
    for (const time of responseTimes) {
      const normalizedTime = time.replace(/\s/g, '').replace(/\./g, '').toLowerCase();
      // If ground truth doesn't contain this time, flag it
      if (!hoursLower.includes(normalizedTime)) {
        issues.push(`AI states hours "${time}" — may not match actual hours`);
        break; // One hours issue is enough
      }
    }
  }

  // Check for wrong address
  if (groundTruth.address) {
    // Look for street numbers that don't match
    const gtNumbers: string[] = groundTruth.address.match(/\b\d{2,5}\b/g) ?? [];
    const responseNumbers: string[] = response.match(/\b\d{2,5}\b/g) ?? [];
    for (const num of responseNumbers) {
      // If a street number appears in response but not in ground truth address
      if (
        gtNumbers.length > 0 &&
        !gtNumbers.includes(num) &&
        lower.includes('address') || lower.includes('located at')
      ) {
        issues.push(`AI mentions address number "${num}" — may not match actual address`);
        break;
      }
    }
  }

  // Check for wrong phone
  if (groundTruth.phone) {
    const phoneDigits = groundTruth.phone.replace(/\D/g, '');
    const responsePhones = response.match(/\b\d{3}[-.\s)]\s*\d{3}[-.\s]\d{4}\b/g) ?? [];
    for (const phone of responsePhones) {
      const digits = phone.replace(/\D/g, '');
      if (digits !== phoneDigits) {
        issues.push(`AI states phone "${phone}" — does not match actual phone`);
        break;
      }
    }
  }

  return {
    turn: turnNumber,
    passed: issues.length === 0,
    accuracy_issues: issues,
    confidence: issues.length > 0 ? 'high' : 'low',
  };
}

/**
 * Identifies the first failing turn from a series of evaluations.
 * Returns null when all turns passed.
 */
export function identifyFailureTurn(evaluations: TurnEvaluation[]): FailureTurnResult {
  for (const eval_ of evaluations) {
    if (!eval_.passed) {
      return {
        failureTurn: eval_.turn,
        failureReason: eval_.accuracy_issues[0] ?? 'Unknown accuracy issue',
      };
    }
  }
  return { failureTurn: null, failureReason: null };
}
