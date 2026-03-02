// ---------------------------------------------------------------------------
// lib/types/autopilot.ts — Autopilot Engine Types
//
// TypeScript interfaces for the Autopilot Engine publish pipeline.
// Spec: docs/19-AUTOPILOT-ENGINE.md §10
// ---------------------------------------------------------------------------

import type { PageAuditRecommendation } from '@/lib/page-audit/auditor';

// ── Enum-like string unions (match prod_schema.sql CHECK constraints) ────────

export type DraftTriggerType =
  | 'competitor_gap'
  | 'occasion'
  | 'prompt_missing'
  | 'first_mover'
  | 'manual'
  | 'review_gap'
  | 'schema_gap'
  | 'voice_gap';

export type DraftContentType =
  | 'faq_page'
  | 'occasion_page'
  | 'blog_post'
  | 'landing_page'
  | 'gbp_post';

export type DraftStatus =
  | 'draft'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'archived';

export type PublishTarget = 'download' | 'gbp_post' | 'wordpress';

// ── Draft Creation ───────────────────────────────────────────────────────────

export interface DraftTrigger {
  triggerType: DraftTriggerType;
  triggerId: string | null;
  orgId: string;
  locationId: string;
  context: DraftContext;
}

export interface DraftContext {
  targetQuery?: string;
  competitorName?: string;
  winningFactor?: string;
  occasionName?: string;
  daysUntilPeak?: number;
  zeroCitationQueries?: string[];
  consecutiveZeroWeeks?: number;
  pageRecommendations?: PageAuditRecommendation[];
  additionalContext?: string;
  contentType?: DraftContentType; // for manual drafts where user picks
  // Sprint 86: review_gap
  topNegativeKeywords?: string[];
  negativeReviewCount?: number;
  unansweredNegativeCount?: number;
  // Sprint 86: schema_gap
  schemaHealthScore?: number;
  missingPageTypes?: string[];
  topMissingImpact?: string;
  // Sprint 109: voice_gap
  voiceQueryCategory?: string;
  zeroCitationVoiceQueries?: string[];
  voiceConsecutiveZeroWeeks?: number;
}

// ── Database Row Shape ───────────────────────────────────────────────────────

export interface ContentDraftRow {
  id: string;
  org_id: string;
  location_id: string | null;
  trigger_type: string;
  trigger_id: string | null;
  draft_title: string;
  draft_content: string;
  target_prompt: string | null;
  content_type: string;
  aeo_score: number | null;
  status: string;
  human_approved: boolean;
  published_url: string | null;
  published_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  target_keywords: string[];
  rejection_reason: string | null;
  generation_notes: string | null;
}

// ── Sprint 86: Autopilot Run Result ────────────────────────────────────────────

export interface AutopilotRunResult {
  orgId: string;
  locationId: string;
  draftsCreated: number;
  draftsSkippedDedup: number;
  draftsSkippedLimit: number;
  errors: string[];
  runAt: string;
}

// ── Publish ──────────────────────────────────────────────────────────────────

export interface PublishResult {
  publishedUrl: string | null;
  status: DraftStatus;
  downloadPayload?: string; // base64 HTML for download target
}

// ── Post-Publish Measurement ─────────────────────────────────────────────────

export interface PostPublishMeasurementTask {
  taskType: 'sov_recheck' | 'page_reaudit';
  targetDate: string; // ISO date string
  payload: {
    draftId: string;
    locationId: string;
    targetQuery?: string;
    pageUrl?: string;
    baselineScore?: number;
  };
}

// ── Location Context (extended from page-audit/auditor.ts LocationContext) ────

export interface AutopilotLocationContext {
  business_name: string;
  city: string | null;
  state: string | null;
  categories: string[] | null;
  amenities: Record<string, boolean | undefined> | null;
  phone: string | null;
  website_url: string | null;
  address_line1: string | null;
  google_location_name: string | null;
}
