// ---------------------------------------------------------------------------
// lib/schema-generator/index.ts — Re-exports for Schema Fix Generator
// Sprint E: Added medical schema types
// ---------------------------------------------------------------------------

export { generateFAQPageSchema } from './faq-schema';
export { generateOpeningHoursSchema } from './hours-schema';
export { generateLocalBusinessSchema } from './local-business-schema';
export { generateMedicalSchema, buildHoursSpecification } from './medical-types';
export type {
  PhysicianSchema,
  DentistSchema,
  MedicalClinicSchema,
  MedicalSchemaInput,
} from './medical-types';
export type {
  SchemaType,
  GeneratedSchema,
  SchemaLocationInput,
  SchemaQueryInput,
  SchemaIntegrationInput,
} from './types';
