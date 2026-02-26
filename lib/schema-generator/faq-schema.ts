// ---------------------------------------------------------------------------
// lib/schema-generator/faq-schema.ts — FAQPage JSON-LD generator
//
// Sprint 70: Generates FAQPage structured data using real SOV queries as
// questions and location ground truth as answers.
//
// PURE FUNCTION — no DB, no fetch, no side effects.
// ---------------------------------------------------------------------------

import type { SchemaLocationInput, SchemaQueryInput, GeneratedSchema } from './types';
import type { DayOfWeek, DayHours } from '@/lib/types/ground-truth';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates FAQPage JSON-LD using actual SOV queries as questions and
 * location ground truth as answers.
 *
 * @returns null if fewer than 2 queries exist (FAQ needs at least 2 Q&A pairs)
 */
export function generateFAQPageSchema(
  location: SchemaLocationInput,
  queries: SchemaQueryInput[],
): GeneratedSchema | null {
  if (queries.length < 2) return null;

  const qaPairs = queries.slice(0, 8).map((q) => ({
    question: transformToQuestion(q.query_text, location.business_name),
    answer: generateAnswerFromGroundTruth(q, location),
  }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qaPairs.map((qa) => ({
      '@type': 'Question',
      name: qa.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: qa.answer,
      },
    })),
  };

  return {
    schemaType: 'FAQPage',
    jsonLd,
    jsonLdString: JSON.stringify(jsonLd, null, 2),
    description: `FAQ schema with ${qaPairs.length} questions from your AI query library`,
    estimatedImpact:
      'Est. +15% AI citation improvement — pages with FAQ schema are 3.2x more likely to appear in AI Overviews',
    missingReason: 'No FAQPage structured data found on your website',
  };
}

// ---------------------------------------------------------------------------
// transformToQuestion — converts SOV query prompts into natural FAQ questions
// ---------------------------------------------------------------------------

export function transformToQuestion(queryText: string, businessName: string): string {
  const trimmed = queryText.trim();
  if (!trimmed) return `What is ${businessName}?`;

  // Already a question
  if (trimmed.endsWith('?')) return trimmed;

  const lower = trimmed.toLowerCase();

  // "Best X" pattern → "What is the best X?"
  if (lower.startsWith('best ')) {
    return `What is the ${trimmed.toLowerCase()}?`;
  }

  // "{business} hours" pattern → "What are the hours for {business}?"
  if (lower.includes('hours')) {
    return `What are the hours for ${businessName}?`;
  }

  // "X near Y" pattern → "What is the X near Y?"
  if (lower.includes(' near ')) {
    return `What is the ${trimmed.toLowerCase()}?`;
  }

  // Default: "What is {query}?"
  return `What is ${trimmed.toLowerCase()}?`;
}

// ---------------------------------------------------------------------------
// generateAnswerFromGroundTruth — builds answers from verified data ONLY
// ---------------------------------------------------------------------------

function generateAnswerFromGroundTruth(
  query: SchemaQueryInput,
  location: SchemaLocationInput,
): string {
  const { business_name, address_line1, city, state, zip, phone, website_url } = location;

  const fullAddress = [address_line1, city, state, zip].filter(Boolean).join(', ');
  const hoursSummary = buildHoursSummary(location);
  const amenitiesList = buildAmenitiesList(location);
  const categorySummary = location.categories?.join(', ') ?? '';

  switch (query.query_category) {
    case 'near_me':
      return buildSentences([
        fullAddress && `${business_name} is located at ${fullAddress}`,
        phone && `Phone: ${phone}`,
        website_url && `Visit us at ${website_url}`,
        hoursSummary && `Hours: ${hoursSummary}`,
      ]);

    case 'comparison':
      return buildSentences([
        categorySummary && `${business_name} specializes in ${categorySummary}`,
        amenitiesList && `Key features include ${amenitiesList}`,
        fullAddress && `Located at ${fullAddress}`,
      ]);

    case 'occasion':
      return buildSentences([
        `${business_name} is a great destination for special occasions`,
        amenitiesList && `We offer ${amenitiesList}`,
        hoursSummary && `Hours: ${hoursSummary}`,
        fullAddress && `Located at ${fullAddress}`,
      ]);

    case 'discovery':
    default:
      return buildSentences([
        categorySummary
          ? `${business_name} is a ${categorySummary.split(',')[0].trim()} located at ${fullAddress || city || 'our location'}`
          : `${business_name} is located at ${fullAddress || city || 'our location'}`,
        hoursSummary && `We're open ${hoursSummary}`,
        amenitiesList && `We offer ${amenitiesList}`,
        phone && `Call us at ${phone}`,
      ]);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const DAY_NAMES: Record<DayOfWeek, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

function buildHoursSummary(location: SchemaLocationInput): string {
  if (!location.hours_data) return '';

  const parts: string[] = [];
  const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  for (const day of days) {
    const value = location.hours_data[day];
    if (!value || value === 'closed') continue;
    if (typeof value !== 'object') continue;

    const dayVal = value as DayHours;
    parts.push(`${DAY_NAMES[day]} ${dayVal.open}–${dayVal.close}`);
  }

  return parts.length > 0 ? parts.join(', ') : '';
}

function buildAmenitiesList(location: SchemaLocationInput): string {
  if (!location.amenities) return '';

  const labels: string[] = [];
  const amenities = location.amenities;

  if (amenities.has_outdoor_seating) labels.push('outdoor seating');
  if (amenities.serves_alcohol) labels.push('full bar');
  if (amenities.has_hookah) labels.push('hookah');
  if (amenities.takes_reservations) labels.push('reservations');
  if (amenities.has_live_music) labels.push('live music');
  if (amenities.has_dj) labels.push('DJ');
  if (amenities.has_private_rooms) labels.push('private rooms');
  if (amenities.is_kid_friendly) labels.push('kid-friendly dining');

  return labels.join(', ');
}

function buildSentences(parts: (string | false | null | undefined | '')[]): string {
  return parts
    .filter((p): p is string => Boolean(p))
    .map((s) => (s.endsWith('.') ? s : `${s}.`))
    .join(' ');
}
