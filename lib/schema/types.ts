// ---------------------------------------------------------------------------
// lib/schema/types.ts — Schema.org Type Helpers via schema-dts
//
// Provides typed Schema.org interfaces for the One-Click AI-Ready Package
// generator (Killer Feature #3). Uses schema-dts for compile-time safety
// when generating JSON-LD output.
//
// Existing code (lib/utils/generateMenuJsonLd.ts) returns untyped `object`.
// New package generation code should use these typed builders instead.
// Do NOT refactor generateMenuJsonLd.ts — it works and is tested.
//
// AI_RULES §2: Types derived from Schema.org vocabulary via schema-dts.
// ---------------------------------------------------------------------------

import type {
  Restaurant,
  FAQPage,
  LocalBusiness,
  WithContext,
  MenuSection,
  MenuItem,
  Event,
  Thing,
} from 'schema-dts';

// Re-export for convenience across the codebase
export type {
  Restaurant,
  FAQPage,
  LocalBusiness,
  WithContext,
  MenuSection,
  MenuItem,
  Event,
  Thing,
};

/**
 * Typed wrapper for generating a JSON-LD script tag string.
 * Use in new AI-Ready Package features. Existing menu JSON-LD
 * generation in lib/utils/generateMenuJsonLd.ts is unaffected.
 */
export function toJsonLdScript<T extends Thing>(data: WithContext<T>): string {
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
}
