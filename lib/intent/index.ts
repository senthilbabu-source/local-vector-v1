// ---------------------------------------------------------------------------
// lib/intent/index.ts — Intent Discovery Barrel Export (Sprint 135)
// ---------------------------------------------------------------------------

export { expandPrompts, deduplicatePrompts } from './prompt-expander';
export {
  classifyPromptTheme,
  scoreOpportunity,
  discoverIntents,
} from './intent-discoverer';
export type {
  IntentTheme,
  IntentGap,
  IntentDiscovery,
} from './intent-types';
