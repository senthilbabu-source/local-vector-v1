// ---------------------------------------------------------------------------
// lib/sandbox/content-ingestion-analyzer.ts — Content Ingestion Test
//
// Sprint 110: Extracts facts from content using Claude API, diffs against GT.
// Pure helper functions are exported for testability.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { generateText } from 'ai';
import { getModel, hasApiKey } from '@/lib/ai/providers';
import type {
  SandboxGroundTruth,
  GroundTruthField,
  IngestionResult,
  ExtractedFact,
  IngestionError,
} from './types';

/**
 * Field weights for accuracy score computation. Sums to 100.
 */
export const FIELD_WEIGHTS: Record<GroundTruthField, number> = {
  name: 20,
  phone: 15,
  address: 15,
  city: 10,
  category: 10,
  hours: 15,
  website: 5,
  state: 5,
  zip: 0,
  description: 5,
  amenities: 0,
};

export const CRITICAL_FIELDS: GroundTruthField[] = ['name', 'phone', 'address', 'city', 'hours'];

/**
 * Analyzes content by extracting facts via Claude and comparing against GT.
 */
export async function analyzeContentIngestion(
  contentText: string,
  groundTruth: SandboxGroundTruth,
): Promise<{ result: IngestionResult; tokensUsed: { input: number; output: number } }> {
  // Short-circuit: too little content
  const wordCount = contentText.trim().split(/\s+/).length;
  if (wordCount < 20) {
    return {
      result: buildEmptyIngestionResult(groundTruth),
      tokensUsed: { input: 0, output: 0 },
    };
  }

  if (!hasApiKey('anthropic')) {
    return {
      result: buildEmptyIngestionResult(groundTruth),
      tokensUsed: { input: 0, output: 0 },
    };
  }

  const systemPrompt = buildExtractionSystemPrompt();
  const userPrompt = buildExtractionUserPrompt(contentText);

  const { text: responseText, usage } = await generateText({
    model: getModel('sandbox-simulation'),
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 500,
    temperature: 0,
  });

  const tokensUsed = {
    input: usage?.promptTokens ?? 0,
    output: usage?.completionTokens ?? 0,
  };

  // Parse the extracted JSON
  let extracted: Record<string, string | null>;
  try {
    extracted = JSON.parse(responseText);
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'sandbox-ingestion-parse', sprint: '110' } });
    return {
      result: buildEmptyIngestionResult(groundTruth),
      tokensUsed,
    };
  }

  // Diff each extracted field against GT
  return {
    result: buildIngestionResult(extracted, groundTruth),
    tokensUsed,
  };
}

/**
 * Builds the fact extraction system prompt.
 */
export function buildExtractionSystemPrompt(): string {
  return `You are a fact extraction engine. Given a business's content, extract specific business facts. Respond ONLY with a JSON object. Never invent facts not present in the content. If a fact is not present, return null for that field.

Return this exact JSON shape:
{
  "name": "Business name or null",
  "phone": "Phone number or null",
  "address": "Street address or null",
  "city": "City or null",
  "state": "State or null",
  "zip": "ZIP code or null",
  "website": "Website URL or null",
  "category": "Primary business category or null",
  "hours": "Operating hours summary or null",
  "description": "One-line business description or null",
  "amenities": "Comma-separated list of amenities/features or null"
}`;
}

/**
 * Builds the fact extraction user prompt.
 */
export function buildExtractionUserPrompt(contentText: string): string {
  return `Extract business facts from this content:\n\n${contentText}`;
}

/**
 * Compares an extracted fact value against the Ground Truth value.
 */
export function compareFactValue(
  extracted: string | null,
  groundTruthVal: string | null,
  field: GroundTruthField,
): 'exact' | 'partial' | 'wrong' | 'missing' {
  // Treat "N/A", "not found", empty as null
  const cleanExtracted = cleanNullValue(extracted);
  if (!cleanExtracted) return 'missing';
  if (!groundTruthVal) return 'partial'; // GT is empty but AI found something — can't verify

  const normExtracted = normalizeForComparison(cleanExtracted, field);
  const normGT = normalizeForComparison(groundTruthVal, field);

  if (normExtracted === normGT) return 'exact';
  if (normExtracted.includes(normGT) || normGT.includes(normExtracted)) return 'partial';
  return 'wrong';
}

/**
 * Normalizes a string for comparison.
 */
export function normalizeForComparison(value: string, field: GroundTruthField): string {
  let normalized = value.toLowerCase().trim();

  if (field === 'phone') {
    normalized = normalized.replace(/\D/g, '');
  } else if (field === 'address') {
    normalized = normalized
      .replace(/\bst\.?\b/gi, 'street')
      .replace(/\brd\.?\b/gi, 'road')
      .replace(/\bdr\.?\b/gi, 'drive')
      .replace(/\bave\.?\b/gi, 'avenue')
      .replace(/[.,#]/g, '')
      .replace(/\s+/g, ' ');
  }

  return normalized;
}

function cleanNullValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === '' || trimmed === 'null' || trimmed === 'n/a' || trimmed === 'not found' || trimmed === 'not provided' || trimmed === 'unknown') {
    return null;
  }
  return value.trim();
}

function buildEmptyIngestionResult(groundTruth: SandboxGroundTruth): IngestionResult {
  const missingFields: GroundTruthField[] = [];
  if (groundTruth.name) missingFields.push('name');
  if (groundTruth.phone) missingFields.push('phone');
  if (groundTruth.address) missingFields.push('address');
  if (groundTruth.city) missingFields.push('city');
  if (groundTruth.hours) missingFields.push('hours');

  return {
    extracted_facts: [],
    accuracy_score: 0,
    facts_correct: 0,
    facts_incorrect: 0,
    facts_missing: missingFields.length,
    critical_errors: [],
    warnings: [],
  };
}

function buildIngestionResult(
  extracted: Record<string, string | null>,
  groundTruth: SandboxGroundTruth,
): IngestionResult {
  const gtMap: Record<string, string | null> = {
    name: groundTruth.name,
    phone: groundTruth.phone,
    address: groundTruth.address,
    city: groundTruth.city,
    state: groundTruth.state,
    zip: groundTruth.zip,
    website: groundTruth.website,
    category: groundTruth.category,
    hours: groundTruth.hours,
    description: groundTruth.description,
  };

  const facts: ExtractedFact[] = [];
  const errors: IngestionError[] = [];
  const warnings: IngestionError[] = [];
  let totalWeightedScore = 0;

  const fields: GroundTruthField[] = ['name', 'phone', 'address', 'city', 'state', 'zip', 'website', 'category', 'hours', 'description'];

  for (const field of fields) {
    const extractedVal = extracted[field] ?? null;
    const gtVal = gtMap[field] ?? null;
    const match = compareFactValue(extractedVal, gtVal, field);

    const matchPoints = match === 'exact' ? 1.0 : match === 'partial' ? 0.5 : 0;
    totalWeightedScore += FIELD_WEIGHTS[field] * matchPoints;

    facts.push({
      field,
      extracted_value: extractedVal ?? '',
      ground_truth_value: gtVal ?? '',
      match_status: match,
      confidence: match === 'exact' ? 'high' : match === 'partial' ? 'medium' : 'low',
    });

    if (match === 'wrong') {
      const isCritical = CRITICAL_FIELDS.includes(field);
      const err: IngestionError = {
        field,
        severity: isCritical ? 'critical' : 'warning',
        extracted: extractedVal ?? '',
        expected: gtVal ?? '',
        message: `${field} mismatch: got "${extractedVal}", expected "${gtVal}"`,
      };
      if (isCritical) errors.push(err);
      else warnings.push(err);
    } else if (match === 'missing' && gtVal) {
      warnings.push({
        field,
        severity: 'warning',
        extracted: '',
        expected: gtVal,
        message: `${field} not found in content`,
      });
    }
  }

  return {
    extracted_facts: facts,
    accuracy_score: Math.round(totalWeightedScore),
    facts_correct: facts.filter(f => f.match_status === 'exact').length,
    facts_incorrect: facts.filter(f => f.match_status === 'wrong').length,
    facts_missing: facts.filter(f => f.match_status === 'missing' && f.ground_truth_value).length,
    critical_errors: errors,
    warnings,
  };
}
