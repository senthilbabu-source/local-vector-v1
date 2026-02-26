// ---------------------------------------------------------------------------
// lib/schema-generator/hours-schema.ts — OpeningHoursSpecification JSON-LD
//
// Sprint 70: Generates OpeningHoursSpecification structured data from
// location hours_data.
//
// PURE FUNCTION — no DB, no fetch, no side effects.
//
// Edge cases (AI_RULES §10):
//   1. "closed" string literal → OMIT (Schema.org has no closed concept)
//   2. Missing day key → OMIT (hours unknown ≠ closed)
//   3. Cross-midnight closes → valid as-is (Schema.org handles it)
//   4. hours_data is null → return null
// ---------------------------------------------------------------------------

import type { DayOfWeek, DayHours } from '@/lib/types/ground-truth';
import type { SchemaLocationInput, GeneratedSchema } from './types';

// ---------------------------------------------------------------------------
// Schema.org day URL mapping
// ---------------------------------------------------------------------------

const DAY_MAP: Record<DayOfWeek, string> = {
  monday: 'https://schema.org/Monday',
  tuesday: 'https://schema.org/Tuesday',
  wednesday: 'https://schema.org/Wednesday',
  thursday: 'https://schema.org/Thursday',
  friday: 'https://schema.org/Friday',
  saturday: 'https://schema.org/Saturday',
  sunday: 'https://schema.org/Sunday',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates OpeningHoursSpecification JSON-LD from location hours_data.
 *
 * @returns null if hours_data is null or empty (no hours to encode)
 */
export function generateOpeningHoursSchema(
  location: SchemaLocationInput,
): GeneratedSchema | null {
  if (!location.hours_data) return null;

  const specs: object[] = [];

  for (const [day, value] of Object.entries(location.hours_data) as [DayOfWeek, DayHours | 'closed'][]) {
    if (value === 'closed') continue;
    if (!value || typeof value !== 'object') continue;

    specs.push({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: DAY_MAP[day],
      opens: value.open,
      closes: value.close,
    });
  }

  if (specs.length === 0) return null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: location.business_name,
    openingHoursSpecification: specs,
  };

  return {
    schemaType: 'OpeningHoursSpecification',
    jsonLd,
    jsonLdString: JSON.stringify(jsonLd, null, 2),
    description: `Opening hours for ${specs.length} days encoded in Schema.org format`,
    estimatedImpact:
      'Est. +10% — Correct hours schema is the #1 defense against "permanently closed" hallucinations',
    missingReason: 'No OpeningHoursSpecification structured data found',
  };
}
