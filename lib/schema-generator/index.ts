// ---------------------------------------------------------------------------
// lib/schema-generator/index.ts — Re-exports for Schema Fix Generator
// ---------------------------------------------------------------------------

export { generateFAQPageSchema } from './faq-schema';
export { generateOpeningHoursSchema } from './hours-schema';
export { generateLocalBusinessSchema } from './local-business-schema';
export type {
  SchemaType,
  GeneratedSchema,
  SchemaLocationInput,
  SchemaQueryInput,
  SchemaIntegrationInput,
} from './types';
