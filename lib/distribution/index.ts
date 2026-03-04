// ---------------------------------------------------------------------------
// lib/distribution/index.ts — Sprint 1
// Barrel export for the distribution engine module.
// ---------------------------------------------------------------------------

export type {
  DistributionResult,
  EngineResult,
  DistributionEngine,
  DistributionContext,
} from './distribution-types';
export type { DistributionEngineConfig } from './distribution-engines-config';
export { DISTRIBUTION_ENGINES, getEngineLastActivity } from './distribution-engines-config';
export { computeMenuHash } from './content-hasher';
export { distributeMenu } from './distribution-orchestrator';
export { indexNowEngine } from './engines/indexnow-engine';
export { gbpEngine } from './engines/gbp-engine';
export { appleBcEngine } from './engines/apple-bc-engine';
export { verifyMenuPropagation, getDistributionHealthStats } from './verification-service';
export type {
  CrawlDetectionResult,
  CitationMatchResult,
  VerificationResult,
  DistributionHealthStats,
} from './verification-service';
