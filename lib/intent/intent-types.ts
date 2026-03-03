// ---------------------------------------------------------------------------
// lib/intent/intent-types.ts — Intent Discovery Types (Sprint 135)
// ---------------------------------------------------------------------------

export type IntentTheme =
  | 'hours'
  | 'events'
  | 'offerings'
  | 'comparison'
  | 'occasion'
  | 'location'
  | 'other';

export interface IntentGap {
  prompt: string;
  theme: IntentTheme;
  clientCited: boolean;
  competitorsCited: string[];
  opportunityScore: number; // 0–100
}

export interface IntentDiscovery {
  runId: string;
  totalPromptsRun: number;
  gaps: IntentGap[]; // prompts where client NOT cited
  covered: IntentGap[]; // prompts where client WAS cited
  diminishingReturns: boolean; // true if < 5 new gaps found
  costEstimate: string; // e.g., "50 Perplexity API calls"
}
