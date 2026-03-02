// ---------------------------------------------------------------------------
// lib/vaio/types.ts — VAIO Engine shared types
//
// Sprint 109: Voice & Conversational AI Optimization
// ---------------------------------------------------------------------------

// ── Voice Query Types ──────────────────────────────────────────────────────

export type VoiceQueryCategory =
  | 'discovery'       // "What's a good hookah lounge near Alpharetta?"
  | 'action'          // "Where can I make a reservation for hookah tonight?"
  | 'comparison'      // "Is Charcoal N Chill better than Cloud 9 for private events?"
  | 'information';    // "What time does Charcoal N Chill close on Fridays?"

export interface VoiceContentScore {
  overall_score: number;          // 0–100 composite
  avg_sentence_words: number;
  direct_answer_score: number;    // 0–30
  local_specificity_score: number; // 0–25
  action_language_score: number;   // 0–25
  spoken_length_score: number;     // 0–20
  issues: VoiceContentIssue[];
}

export interface VoiceContentIssue {
  type: VoiceIssueType;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  fix: string;
}

export type VoiceIssueType =
  | 'too_long'
  | 'no_direct_answer'
  | 'contains_markdown'
  | 'contains_urls'
  | 'long_sentences'
  | 'no_local_mention'
  | 'passive_voice_heavy'
  | 'no_business_name';

export interface VoiceQuery {
  id: string;
  location_id: string;
  org_id: string;
  query_text: string;
  query_category: VoiceQueryCategory;
  query_mode: 'voice';
  is_active: boolean;
  citation_rate: number | null;
  last_run_at: string | null;
  is_system_seeded: boolean;
}

export interface SpokenAnswerPreview {
  content: string;
  word_count: number;
  estimated_spoken_seconds: number;
  is_voice_ready: boolean;
  cleaned_content: string;
  issues: VoiceContentIssue[];
  reading_grade_level: number;
}

export interface LlmsTxtContent {
  standard: string;
  full: string;
  generated_at: string;
  version: number;
}

export interface LlmsPageUrl {
  page_type: 'homepage' | 'menu' | 'events' | 'faq' | 'about' | 'contact' | 'blog';
  url: string;
  description: string;
}

export interface AICrawlerAuditResult {
  website_url: string;
  robots_txt_found: boolean;
  robots_txt_url: string;
  crawlers: AICrawlerStatus[];
  overall_health: 'healthy' | 'partial' | 'blocked' | 'unknown';
  blocked_count: number;
  allowed_count: number;
  missing_count: number;
  last_checked_at: string;
}

export interface AICrawlerStatus {
  name: string;
  user_agent: string;
  status: 'allowed' | 'blocked' | 'not_specified';
  used_by: string;
  impact: 'high' | 'medium' | 'low';
}

export interface VoiceGap {
  category: VoiceQueryCategory;
  queries: string[];
  weeks_at_zero: number;
  suggested_content_type: 'faq_page' | 'gbp_post';
  suggested_query_answer: string;
}

export interface VAIOProfile {
  location_id: string;
  org_id: string;
  voice_readiness_score: number;
  llms_txt_status: 'generated' | 'not_generated' | 'stale';
  llms_txt_generated_at: string | null;
  crawler_health: AICrawlerAuditResult | null;
  voice_queries_tracked: number;
  voice_citation_rate: number;
  voice_gaps: VoiceGap[];
  top_voice_score_issues: VoiceContentIssue[];
  last_run_at: string | null;
}

export interface VAIORunResult {
  location_id: string;
  org_id: string;
  voice_readiness_score: number;
  voice_queries_seeded: number;
  voice_gaps_found: number;
  autopilot_drafts_triggered: number;
  llms_txt_generated: boolean;
  crawler_health: 'healthy' | 'partial' | 'blocked' | 'unknown';
  errors: string[];
  run_at: string;
}

export const VOICE_SCORE_WEIGHTS = {
  llms_txt:         25,
  crawler_access:   25,
  voice_citation:   30,
  content_quality:  20,
} as const;

// ── Voice Query Template ───────────────────────────────────────────────────

export interface VoiceQueryTemplate {
  template: string;
  category: VoiceQueryCategory;
  priority: 1 | 2 | 3;
  intent: 'find' | 'reserve' | 'compare' | 'confirm';
}

// ── Ground Truth (re-export) ───────────────────────────────────────────────

export interface GroundTruthForVAIO {
  location_id: string;
  org_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  website: string | null;
  categories: string[];
  amenities: Record<string, boolean | undefined>;
  hours: Record<string, { open: string; close: string } | null> | null;
  description?: string;
}
