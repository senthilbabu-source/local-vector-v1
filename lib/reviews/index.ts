// ---------------------------------------------------------------------------
// lib/reviews/index.ts — Barrel export
//
// Sprint 132: Entity-Optimized Review Responses
// ---------------------------------------------------------------------------

export {
  selectEntityTerms,
  extractKeyAmenities,
  extractTopMenuItems,
} from './entity-weaver';

export type {
  EntityTermSelection,
  EntityWeaveInput,
} from './entity-weaver';

export {
  generateEntityOptimizedResponse,
} from './review-responder';

export type {
  EntityOptimizedResponseInput,
} from './review-responder';
