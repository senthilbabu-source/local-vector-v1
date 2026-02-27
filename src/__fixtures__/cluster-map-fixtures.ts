// ---------------------------------------------------------------------------
// src/__fixtures__/cluster-map-fixtures.ts — Cluster Map Test Fixtures
//
// Sprint 87: Canonical fixtures for the AI Visibility Cluster Map feature.
// All test suites (service, data, action) import from here.
// ---------------------------------------------------------------------------

import type { ClusterMapInput, EngineFilter } from '@/lib/services/cluster-map.service';

// ── Canonical test UUIDs (hex-only, AI_RULES §7) ──────────────────────

export const CLUSTER_MAP_UUIDS = {
  query1: 'a3eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
  query2: 'a3eebc99-9c0b-4ef8-bb6d-6bb9bd380a02',
  query3: 'a3eebc99-9c0b-4ef8-bb6d-6bb9bd380a03',
  query4: 'a3eebc99-9c0b-4ef8-bb6d-6bb9bd380a04',
  query5: 'a3eebc99-9c0b-4ef8-bb6d-6bb9bd380a05',
  hallucination1: 'a3eebc99-9c0b-4ef8-bb6d-6bb9bd380b01',
  hallucination2: 'a3eebc99-9c0b-4ef8-bb6d-6bb9bd380b02',
  hallucination3: 'a3eebc99-9c0b-4ef8-bb6d-6bb9bd380b03',
} as const;

// ── Evaluation fixtures ────────────────────────────────────────────────

/** 10 evaluations across 5 queries x 2 engines (Perplexity + OpenAI) */
export const MOCK_EVALUATIONS: ClusterMapInput['evaluations'] = [
  // Query 1: "best hookah bar Alpharetta" — both engines cite us
  {
    engine: 'perplexity',
    queryId: CLUSTER_MAP_UUIDS.query1,
    queryCategory: 'discovery',
    rankPosition: 1,
    mentionedCompetitors: ['Cloud 9 Lounge', 'Sahara Hookah Lounge'],
  },
  {
    engine: 'openai',
    queryId: CLUSTER_MAP_UUIDS.query1,
    queryCategory: 'discovery',
    rankPosition: 2,
    mentionedCompetitors: ['Cloud 9 Lounge', 'The Hookah Spot', 'Sahara Hookah Lounge'],
  },
  // Query 2: "Indian restaurant Alpharetta" — only Perplexity cites us
  {
    engine: 'perplexity',
    queryId: CLUSTER_MAP_UUIDS.query2,
    queryCategory: 'discovery',
    rankPosition: 3,
    mentionedCompetitors: ['Bollywood Grill', 'Tabla Indian Restaurant'],
  },
  {
    engine: 'openai',
    queryId: CLUSTER_MAP_UUIDS.query2,
    queryCategory: 'discovery',
    rankPosition: null, // NOT cited by ChatGPT
    mentionedCompetitors: ['Bollywood Grill', 'Tabla Indian Restaurant', 'Curry Corner'],
  },
  // Query 3: "date night restaurant Alpharetta" — both cite us
  {
    engine: 'perplexity',
    queryId: CLUSTER_MAP_UUIDS.query3,
    queryCategory: 'occasion',
    rankPosition: 2,
    mentionedCompetitors: ['Cloud 9 Lounge', 'The Capital Grille'],
  },
  {
    engine: 'openai',
    queryId: CLUSTER_MAP_UUIDS.query3,
    queryCategory: 'occasion',
    rankPosition: 1,
    mentionedCompetitors: ['Cloud 9 Lounge'],
  },
  // Query 4: "late night food Alpharetta" — only ChatGPT cites us
  {
    engine: 'perplexity',
    queryId: CLUSTER_MAP_UUIDS.query4,
    queryCategory: 'near_me',
    rankPosition: null,
    mentionedCompetitors: ['Waffle House', 'IHOP'],
  },
  {
    engine: 'openai',
    queryId: CLUSTER_MAP_UUIDS.query4,
    queryCategory: 'near_me',
    rankPosition: 2,
    mentionedCompetitors: ['Waffle House'],
  },
  // Query 5: "hookah lounge near me" — both cite us
  {
    engine: 'perplexity',
    queryId: CLUSTER_MAP_UUIDS.query5,
    queryCategory: 'near_me',
    rankPosition: 1,
    mentionedCompetitors: ['Cloud 9 Lounge', 'The Hookah Spot'],
  },
  {
    engine: 'openai',
    queryId: CLUSTER_MAP_UUIDS.query5,
    queryCategory: 'near_me',
    rankPosition: 1,
    mentionedCompetitors: ['Cloud 9 Lounge', 'Sahara Hookah Lounge'],
  },
];

// ── Hallucination fixtures ─────────────────────────────────────────────

export const MOCK_HALLUCINATIONS: ClusterMapInput['hallucinations'] = [
  {
    id: CLUSTER_MAP_UUIDS.hallucination1,
    claimText: 'Charcoal N Chill is closed on Tuesdays',
    severity: 'critical',
    modelProvider: 'openai-gpt4o',
    category: 'hours_check',
  },
  {
    id: CLUSTER_MAP_UUIDS.hallucination2,
    claimText: 'Charcoal N Chill does not have outdoor seating',
    severity: 'high',
    modelProvider: 'google-gemini',
    category: 'amenity_check',
  },
  {
    id: CLUSTER_MAP_UUIDS.hallucination3,
    claimText: 'Charcoal N Chill serves only vegetarian food',
    severity: 'medium',
    modelProvider: 'perplexity-sonar',
    category: 'menu_check',
  },
];

// ── Complete input fixture ─────────────────────────────────────────────

export const MOCK_CLUSTER_INPUT: ClusterMapInput = {
  businessName: 'Charcoal N Chill',
  evaluations: MOCK_EVALUATIONS,
  hallucinations: MOCK_HALLUCINATIONS,
  truthScore: 72,
  sovScore: 0.45,
  engineFilter: 'all',
};

// ── Expected results for test assertions ───────────────────────────────

/**
 * Pre-computed expected values for MOCK_CLUSTER_INPUT with engineFilter='all':
 *
 * Self Brand Authority:
 *   Cited evaluations: Q1(perp+oai), Q2(perp only), Q3(perp+oai), Q4(oai only), Q5(perp+oai)
 *   Total: self cited in 8 out of 10 evaluations = 80/100 brand authority
 *
 * Self Fact Accuracy: truthScore = 72
 * Self SOV: 0.45
 *
 * Competitors extracted (unique across all mentioned_competitors):
 *   'Cloud 9 Lounge' — appears in 6 evaluations out of 10 -> authority 60
 *   'Sahara Hookah Lounge' — appears in 3 evaluations -> authority 30
 *   'The Hookah Spot' — appears in 2 evaluations -> authority 20
 *   'Bollywood Grill' — appears in 2 evaluations -> authority 20
 *   'Tabla Indian Restaurant' — appears in 2 evaluations -> authority 20
 *   'Curry Corner' — appears in 1 evaluation -> authority 10
 *   'The Capital Grille' — appears in 1 evaluation -> authority 10
 *   'Waffle House' — appears in 2 evaluations -> authority 20
 *   'IHOP' — appears in 1 evaluation -> authority 10
 *
 * Hallucination zones (all engines):
 *   Zone 1: critical, engine=openai, radius=40, cy=72-25=47
 *   Zone 2: high, engine=google, radius=30, cy=72-15=57
 *   Zone 3: medium, engine=perplexity, radius=20, cy=72-8=64
 */
export const EXPECTED_ALL_ENGINES = {
  selfBrandAuthority: 80,
  selfFactAccuracy: 72,
  selfSov: 0.45,
  totalCompetitors: 9,
  totalQueries: 10,
  hallucinationCount: 3,
  hallucinationZones: [
    { severity: 'critical' as const, engine: 'openai', radius: 40, cy: 47 },
    { severity: 'high' as const, engine: 'google', radius: 30, cy: 57 },
    { severity: 'medium' as const, engine: 'perplexity', radius: 20, cy: 64 },
  ],
};

/**
 * Expected for engineFilter='perplexity' — only Perplexity evaluations:
 *   Evaluations: Q1, Q2, Q3, Q4, Q5 (perplexity only = 5 total)
 *   Self cited: Q1(yes), Q2(yes), Q3(yes), Q4(no), Q5(yes) = 4/5 = 80
 *   Competitors: only from perplexity rows
 *   Hallucinations: only perplexity-sonar = Zone 3 only
 */
export const EXPECTED_PERPLEXITY_ONLY = {
  selfBrandAuthority: 80,
  selfFactAccuracy: 72,
  totalQueries: 5,
  hallucinationCount: 1,
};

/**
 * Expected for engineFilter='openai' — only OpenAI evaluations:
 *   Evaluations: Q1, Q2, Q3, Q4, Q5 (openai only = 5 total)
 *   Self cited: Q1(yes), Q2(no), Q3(yes), Q4(yes), Q5(yes) = 4/5 = 80
 *   Hallucinations: only openai-gpt4o = Zone 1 only
 */
export const EXPECTED_OPENAI_ONLY = {
  selfBrandAuthority: 80,
  selfFactAccuracy: 72,
  totalQueries: 5,
  hallucinationCount: 1,
};
