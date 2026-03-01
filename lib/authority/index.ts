// ---------------------------------------------------------------------------
// lib/authority/index.ts — Barrel export for Semantic Authority Mapping
//
// Sprint 108
// ---------------------------------------------------------------------------

export type {
  AuthorityTier,
  CitationSourceType,
  CitationSource,
  AuthorityDimensions,
  EntityAuthorityProfile,
  SameAsGap,
  AuthorityRecommendation,
  AuthoritySnapshot,
  AuthorityMappingResult,
  AuthorityStatusResponse,
} from './types';

export {
  classifySourceTier,
  isSameAsCandidate,
  detectCitationSources,
  extractDomain,
  buildCitationQueries,
  KNOWN_TIER2_DOMAINS,
  KNOWN_TIER1_PATTERNS,
} from './citation-source-detector';

export {
  computeAuthorityScore,
  getVelocityLabel,
  getAuthorityGrade,
  countActivePlatforms,
  countSameAsUrls,
} from './entity-authority-scorer';

export {
  detectSameAsGaps,
  fetchExistingSameAs,
  checkWikidataEntity,
  generateSameAsInstructions,
  HIGH_VALUE_SAMEAS_PLATFORMS,
} from './sameas-enricher';

export {
  saveAuthoritySnapshot,
  computeCitationVelocity,
  shouldAlertDecay,
  getAuthorityHistory,
} from './citation-velocity-monitor';

export {
  generateRecommendations,
  buildTier1CitationRecommendation,
  buildVelocityDecayRecommendation,
} from './authority-recommendations';

export {
  runAuthorityMapping,
  runAuthorityMappingForAllLocations,
} from './authority-service';
