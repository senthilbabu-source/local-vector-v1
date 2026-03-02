// ---------------------------------------------------------------------------
// lib/sandbox/ground-truth-diffuser.ts — Pure text vs Ground Truth comparison
//
// Sprint 110: Compares any text against Ground Truth facts.
// NO API calls, NO DB calls — fully deterministic string matching.
// ---------------------------------------------------------------------------

import type { SandboxGroundTruth, GroundTruthField } from './types';

export interface Discrepancy {
  field: GroundTruthField;
  ground_truth_value: string;
  text_value: string;
  severity: 'critical' | 'warning';
}

export interface DiffResult {
  alignment_score: number;
  discrepancies: Discrepancy[];
  supported_facts: GroundTruthField[];
  not_mentioned_facts: GroundTruthField[];
  contradicted_facts: GroundTruthField[];
}

const CRITICAL_FIELDS: GroundTruthField[] = ['name', 'phone', 'address', 'city', 'hours'];

/**
 * Compares text against all Ground Truth fields.
 * Returns alignment score (0–100), discrepancies, and fact status.
 */
export function diffTextAgainstGroundTruth(
  text: string,
  groundTruth: SandboxGroundTruth,
): DiffResult {
  const supported: GroundTruthField[] = [];
  const notMentioned: GroundTruthField[] = [];
  const contradicted: GroundTruthField[] = [];
  const discrepancies: Discrepancy[] = [];

  const fieldsToCheck: Array<{ field: GroundTruthField; value: string | null }> = [
    { field: 'name', value: groundTruth.name },
    { field: 'phone', value: groundTruth.phone },
    { field: 'address', value: groundTruth.address },
    { field: 'city', value: groundTruth.city },
    { field: 'state', value: groundTruth.state },
    { field: 'zip', value: groundTruth.zip },
    { field: 'website', value: groundTruth.website },
    { field: 'category', value: groundTruth.category },
    { field: 'hours', value: groundTruth.hours },
    { field: 'description', value: groundTruth.description },
  ];

  for (const { field, value } of fieldsToCheck) {
    if (!value) {
      // GT has no value for this field — skip
      continue;
    }

    const present = groundTruthValuePresentInText(value, text, field);
    if (present) {
      supported.push(field);
      continue;
    }

    const contradiction = findContradictingValue(value, text, field);
    if (contradiction) {
      contradicted.push(field);
      discrepancies.push({
        field,
        ground_truth_value: value,
        text_value: contradiction,
        severity: CRITICAL_FIELDS.includes(field) ? 'critical' : 'warning',
      });
    } else {
      notMentioned.push(field);
    }
  }

  // Check amenities as a group
  if (groundTruth.amenities.length > 0) {
    const textLower = text.toLowerCase();
    const mentionedAmenities = groundTruth.amenities.filter(a => textLower.includes(a.toLowerCase()));
    if (mentionedAmenities.length > 0) {
      supported.push('amenities');
    } else {
      notMentioned.push('amenities');
    }
  }

  // alignment_score: supported ×2, not_mentioned ×1, contradicted ×0
  const totalFacts = supported.length + notMentioned.length + contradicted.length;
  if (totalFacts === 0) {
    return { alignment_score: 0, discrepancies, supported_facts: supported, not_mentioned_facts: notMentioned, contradicted_facts: contradicted };
  }

  const score = Math.round(
    ((supported.length * 2 + notMentioned.length * 1) / (totalFacts * 2)) * 100,
  );

  return {
    alignment_score: score,
    discrepancies,
    supported_facts: supported,
    not_mentioned_facts: notMentioned,
    contradicted_facts: contradicted,
  };
}

/**
 * Checks if a Ground Truth value appears in text.
 */
export function groundTruthValuePresentInText(
  groundTruthValue: string,
  text: string,
  field: GroundTruthField,
): boolean {
  if (!groundTruthValue || !text) return false;

  if (field === 'phone') {
    const gtDigits = normalizePhone(groundTruthValue);
    const textPhones = extractPhonePatterns(text);
    return textPhones.some(p => p === gtDigits);
  }

  const normalizedGT = groundTruthValue.toLowerCase().trim();
  const normalizedText = text.toLowerCase();

  if (field === 'address') {
    const cleaned = normalizeAddress(normalizedGT);
    const textCleaned = normalizeAddress(normalizedText);
    return textCleaned.includes(cleaned);
  }

  return normalizedText.includes(normalizedGT);
}

/**
 * Checks if text contains a value that contradicts the Ground Truth.
 */
export function findContradictingValue(
  groundTruthValue: string,
  text: string,
  field: GroundTruthField,
): string | null {
  if (!groundTruthValue || !text) return null;

  if (field === 'phone') {
    const gtDigits = normalizePhone(groundTruthValue);
    const textPhones = extractPhonePatterns(text);
    // If there are phone numbers in text but none match GT, it's a contradiction
    const nonMatching = textPhones.filter(p => p !== gtDigits && p.length >= 10);
    return nonMatching.length > 0 ? nonMatching[0] : null;
  }

  // For other fields, we don't do contradiction detection beyond "not present"
  // (string matching can't reliably detect contradictions for free-text fields)
  return null;
}

/**
 * Normalizes a phone number to digits only.
 * "(470) 546-4866" → "4705464866"
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Extracts phone-like patterns from text.
 * Returns all found phone numbers (normalized to digits).
 */
export function extractPhonePatterns(text: string): string[] {
  // Match common phone formats: (xxx) xxx-xxxx, xxx-xxx-xxxx, xxx.xxx.xxxx, +1xxxxxxxxxx
  const phoneRegex = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
  const matches = text.match(phoneRegex) || [];
  return matches.map(normalizePhone).filter(p => p.length >= 10);
}

/**
 * Normalizes an address for comparison.
 * Expands abbreviations, lowercases, trims.
 */
function normalizeAddress(addr: string): string {
  return addr
    .replace(/\bst\b/gi, 'street')
    .replace(/\brd\b/gi, 'road')
    .replace(/\bdr\b/gi, 'drive')
    .replace(/\bave\b/gi, 'avenue')
    .replace(/\bblvd\b/gi, 'boulevard')
    .replace(/\bln\b/gi, 'lane')
    .replace(/\bct\b/gi, 'court')
    .replace(/\bpkwy\b/gi, 'parkway')
    .replace(/\bbr\b/gi, 'bridge')
    .replace(/[.,#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
