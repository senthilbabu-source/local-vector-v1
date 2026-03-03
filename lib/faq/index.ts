// lib/faq/index.ts — Barrel export (Sprint 128)
export { generateFAQs, applyExclusions, makeHash } from './faq-generator';
export type { FAQPair, FAQGeneratorInput } from './faq-generator';

export { toFAQPageJsonLd, stripHtml, truncateAnswer } from './faq-schema-builder';
