// ---------------------------------------------------------------------------
// lib/sandbox/types.ts — AI Answer Simulation Sandbox shared types
//
// Sprint 110: Capstone feature. All sandbox modules import from here.
// ---------------------------------------------------------------------------

/**
 * The three simulation modes available in the Sandbox.
 */
export type SimulationMode =
  | 'ingestion'     // Can AI extract the correct facts from this content?
  | 'query'         // How would AI answer our tracked queries given this content?
  | 'gap_analysis'; // Where will AI hallucinate because content doesn't answer?

/**
 * The input to a simulation run.
 */
export interface SimulationInput {
  location_id: string;
  org_id: string;
  content_text: string;
  content_source: ContentSource;
  draft_id?: string;
  modes: SimulationMode[];
}

export type ContentSource =
  | 'freeform'
  | 'draft'
  | 'llms_txt'
  | 'published_faq'
  | 'published_homepage';

/**
 * Ground Truth assembled from the locations table for sandbox comparison.
 * Extends NAP GroundTruth with categories, amenities, and description.
 */
export interface SandboxGroundTruth {
  location_id: string;
  org_id: string;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  website: string | null;
  category: string | null;
  hours: string | null;            // Formatted hours string for comparison
  hours_data: Record<string, { open: string; close: string } | 'closed'> | null;
  description: string | null;
  amenities: string[];             // Flat list of amenity names
}

/**
 * The full result of a simulation run.
 */
export interface SimulationRun {
  id: string;
  location_id: string;
  org_id: string;
  content_source: ContentSource;
  draft_id: string | null;
  content_text: string;
  content_word_count: number;
  modes_run: SimulationMode[];

  ingestion_result: IngestionResult | null;
  query_results: QuerySimulationResult[];
  gap_analysis: GapAnalysisResult | null;

  simulation_score: number;
  ingestion_accuracy: number;
  query_coverage_rate: number;
  hallucination_risk: HallucinationRisk;

  run_at: string;
  claude_model: string;
  input_tokens_used: number;
  output_tokens_used: number;
  status: 'completed' | 'partial' | 'failed';
  errors: string[];
}

/**
 * Result of the Content Ingestion Test.
 */
export interface IngestionResult {
  extracted_facts: ExtractedFact[];
  accuracy_score: number;
  facts_correct: number;
  facts_incorrect: number;
  facts_missing: number;
  critical_errors: IngestionError[];
  warnings: IngestionError[];
}

/**
 * A single fact extracted by the AI from the content.
 */
export interface ExtractedFact {
  field: GroundTruthField;
  extracted_value: string;
  ground_truth_value: string;
  match_status: 'exact' | 'partial' | 'wrong' | 'missing';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * The Ground Truth fields we extract and compare.
 */
export type GroundTruthField =
  | 'name'
  | 'phone'
  | 'address'
  | 'city'
  | 'state'
  | 'zip'
  | 'website'
  | 'category'
  | 'hours'
  | 'description'
  | 'amenities';

/**
 * An ingestion error or warning.
 */
export interface IngestionError {
  field: GroundTruthField;
  severity: 'critical' | 'warning';
  extracted: string;
  expected: string;
  message: string;
}

/**
 * Result of simulating a single query against the content.
 */
export interface QuerySimulationResult {
  query_id: string;
  query_text: string;
  query_category: string;
  simulated_answer: string;
  answer_quality: AnswerQuality;
  cites_business: boolean;
  facts_present: GroundTruthField[];
  facts_hallucinated: string[];
  word_count: number;
  ground_truth_alignment: number;
}

export type AnswerQuality =
  | 'complete'
  | 'partial'
  | 'wrong'
  | 'no_answer';

/**
 * Full gap analysis result.
 */
export interface GapAnalysisResult {
  total_queries_tested: number;
  queries_with_no_answer: number;
  queries_with_partial_answer: number;
  queries_with_complete_answer: number;
  gap_clusters: GapCluster[];
  highest_risk_queries: string[];
  recommended_additions: ContentAddition[];
}

export interface GapCluster {
  category: string;
  total_queries: number;
  answered_queries: number;
  unanswered_queries: number;
  gap_severity: 'critical' | 'high' | 'medium' | 'low';
  example_unanswered: string;
}

export interface ContentAddition {
  priority: 1 | 2 | 3;
  field: GroundTruthField | 'general';
  suggestion: string;
  closes_queries: string[];
}

export type HallucinationRisk =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export interface SimulationHistoryEntry {
  id: string;
  content_source: ContentSource;
  draft_id: string | null;
  simulation_score: number;
  hallucination_risk: HallucinationRisk;
  query_coverage_rate: number;
  run_at: string;
}

/**
 * Cost guard constants.
 */
export const SANDBOX_LIMITS = {
  MAX_CONTENT_WORDS: 1500,
  MAX_QUERIES_PER_RUN: 10,
  MAX_RUNS_PER_DAY_PER_ORG: 20,
  MAX_CONTENT_CHARS_STORED: 5000,
  CLAUDE_MODEL: 'claude-sonnet-4-20250514',
} as const;
