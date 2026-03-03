// ---------------------------------------------------------------------------
// lib/playbooks/playbook-types.ts — Playbook Types (Sprint 134)
// ---------------------------------------------------------------------------

export type SignalStatus = 'present' | 'missing' | 'partial';

export interface LocationSignalInput {
  hasRestaurantSchema: boolean;
  hasMenuSchema: boolean;
  hasReserveActionSchema: boolean;
  gbpVerified: boolean;
  gbpCompleteness: number; // 0–100 from Sprint 124 data health
  reviewCount: number;
  avgRating: number | null;
  lastReviewDate: string | null; // ISO date
  websiteUrl: string | null;
  hasWikidataEntry: boolean;
  hasBingPlacesEntry: boolean;
  canonicalUrlConsistent: boolean;
  menuItemCount: number;
}

export interface SignalDefinition {
  id: string;
  label: string;
  description: string;
  checkFn: (locationData: LocationSignalInput) => SignalStatus;
  fixGuide: string;
  estimatedImpact: 'high' | 'medium' | 'low';
  linkedLocalVectorFeature?: string;
}

export interface PlaybookAction {
  signalId: string;
  label: string;
  priority: 'high' | 'medium' | 'low';
  status: SignalStatus;
  description: string;
  fixGuide: string;
  estimatedImpact: 'high' | 'medium' | 'low';
  linkedLocalVectorFeature?: string;
}

export interface Playbook {
  engine: string; // 'perplexity_sonar'
  engineDisplayName: string; // 'Perplexity'
  clientCitationRate: number; // 0–1
  topCompetitorRate: number;
  gapPercent: number; // (topCompetitorRate - clientCitationRate) * 100
  actions: PlaybookAction[];
  insufficientData: boolean;
  generatedAt: string; // ISO timestamp
}
