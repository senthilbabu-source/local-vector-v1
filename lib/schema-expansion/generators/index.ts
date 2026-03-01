// ---------------------------------------------------------------------------
// lib/schema-expansion/generators/index.ts — Generator Registry
//
// Sprint 106: Barrel export + PageType → Generator lookup map.
// ---------------------------------------------------------------------------

import type { PageType } from '../types';
import { SchemaGenerator } from './types';
import { LocalBusinessGenerator } from './local-business.generator';
import { FAQPageGenerator } from './faq-page.generator';
import { EventGenerator } from './event.generator';
import { BlogPostingGenerator } from './blog-posting.generator';
import { ServiceGenerator } from './service.generator';

export { SchemaGenerator } from './types';
export { LocalBusinessGenerator } from './local-business.generator';
export { FAQPageGenerator } from './faq-page.generator';
export { EventGenerator } from './event.generator';
export { BlogPostingGenerator } from './blog-posting.generator';
export { ServiceGenerator } from './service.generator';

// ---------------------------------------------------------------------------
// Generator Registry
// ---------------------------------------------------------------------------

const generators: SchemaGenerator[] = [
  new LocalBusinessGenerator(),
  new FAQPageGenerator(),
  new EventGenerator(),
  new BlogPostingGenerator(),
  new ServiceGenerator(),
];

/**
 * Look up the appropriate generator for a page type.
 * Returns null for 'menu' (Magic Engine) and 'other' (no schema generated).
 */
export function getGeneratorForPageType(pageType: PageType): SchemaGenerator | null {
  // Skip menu pages (Magic Engine handles these)
  if (pageType === 'menu') return null;

  // For 'other', use LocalBusiness as fallback (generic structured data)
  if (pageType === 'other') return generators[0]; // LocalBusinessGenerator

  return generators.find((g) => g.supportsPageType.includes(pageType)) ?? null;
}
