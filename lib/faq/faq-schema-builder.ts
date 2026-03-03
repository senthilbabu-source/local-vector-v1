// ---------------------------------------------------------------------------
// lib/faq/faq-schema-builder.ts — Sprint 128: FAQ Schema Builder
//
// Serializes FAQPair[] to FAQPage JSON-LD string.
// Caps at 10 pairs. Strips HTML. Validates answer length.
// PURE FUNCTION — no I/O.
// AI_RULES §160
// ---------------------------------------------------------------------------

import type { FAQPair } from './faq-generator';

const MAX_INJECTION_PAIRS = 10;
const MAX_ANSWER_CHARS = 300;

export function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

export function truncateAnswer(answer: string): string {
  const clean = stripHtml(answer);
  return clean.length > MAX_ANSWER_CHARS
    ? clean.slice(0, MAX_ANSWER_CHARS - 3) + '...'
    : clean;
}

/**
 * Build a FAQPage JSON-LD string from FAQ pairs.
 * Caps at 10 pairs. Strips HTML. Truncates answers to 300 chars.
 */
export function toFAQPageJsonLd(pairs: FAQPair[]): string {
  const capped = pairs.slice(0, MAX_INJECTION_PAIRS);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: capped.map((pair) => ({
      '@type': 'Question',
      name: stripHtml(pair.question),
      acceptedAnswer: {
        '@type': 'Answer',
        text: truncateAnswer(pair.answer),
      },
    })),
  };

  return JSON.stringify(schema);
}
