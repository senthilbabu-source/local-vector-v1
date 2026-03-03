// ---------------------------------------------------------------------------
// lib/agent-seo/index.ts — Barrel export
//
// Sprint 126: Agent-SEO Action Readiness Audit
// ---------------------------------------------------------------------------

export type {
  AuditStatus,
  ActionCapabilityId,
  ActionCapability,
  ActionAuditLevel,
  ActionAuditResult,
  DetectedSchemas,
} from './agent-seo-types';

export {
  fetchAndParseActionSchemas,
  parseActionSchemasFromHtml,
  inspectSchemaForActions,
} from './action-schema-detector';

export {
  computeAgentSEOScore,
} from './agent-seo-scorer';
