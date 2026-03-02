// ---------------------------------------------------------------------------
// lib/sandbox/index.ts — Barrel export for AI Answer Simulation Sandbox
// Sprint 110
// ---------------------------------------------------------------------------

export * from './types';
export { analyzeContentIngestion } from './content-ingestion-analyzer';
export {
  simulateQueriesAgainstContent,
  selectQueriesForSimulation,
  evaluateSimulatedAnswer,
  detectHallucinatedFacts,
  checkFactsPresent,
} from './query-simulation-engine';
export {
  diffTextAgainstGroundTruth,
  groundTruthValuePresentInText,
  findContradictingValue,
  normalizePhone,
  extractPhonePatterns,
} from './ground-truth-diffuser';
export {
  computeHallucinationRisk,
  buildGapClusters,
  generateContentAdditions,
  computeSimulationScore,
  findHighestRiskQueries,
  buildGapAnalysis,
} from './hallucination-gap-scorer';
export {
  runSimulation,
  getSimulationHistory,
  getLatestSimulationRun,
  checkDailyRateLimit,
} from './simulation-orchestrator';
