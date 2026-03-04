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
export { computeMenuHash } from './content-hasher';
export { distributeMenu } from './distribution-orchestrator';
export { indexNowEngine } from './engines/indexnow-engine';
export { gbpEngine } from './engines/gbp-engine';
export { appleBcEngine } from './engines/apple-bc-engine';
