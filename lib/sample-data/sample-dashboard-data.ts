// ---------------------------------------------------------------------------
// lib/sample-data/sample-dashboard-data.ts — Sprint B (C4)
//
// Realistic mock data displayed to new users before their first automated scan.
// Data shapes EXACTLY match the real data types fetched in lib/data/dashboard.ts
// and consumed by dashboard card components.
//
// Modeled after a typical local restaurant — realistic scores, not perfect.
//
// IMPORTANT: Before modifying any export, verify the shape matches the
// corresponding type in the dashboard data layer and card component props.
// ---------------------------------------------------------------------------

import type { SOVDataPoint } from '@/app/dashboard/_components/SOVTrendChart';
import type { ModelHallucinationData } from '@/app/dashboard/_components/HallucinationsByModel';
import type { HealthScoreResult } from '@/lib/services/ai-health-score.service';

// ── Reality Score components ────────────────────────────────────────────────
// Matches the return type of deriveRealityScore() in dashboard/page.tsx
export const SAMPLE_VISIBILITY_SCORE = 47;

// ── AI Health Score ─────────────────────────────────────────────────────────
// Matches HealthScoreResult from lib/services/ai-health-score.service.ts
export const SAMPLE_HEALTH_SCORE: HealthScoreResult = {
  score: 61,
  grade: 'C',
  components: {
    visibility: { label: 'Visibility', score: 47 },
    accuracy:   { label: 'Accuracy',   score: 68 },
    structure:  { label: 'Structure',  score: 72 },
    freshness:  { label: 'Freshness',  score: 55 },
  },
  topRecommendation: {
    title: 'Fix 2 open hallucination alerts',
    estimatedImpact: 8,
    actionLabel: 'View Alerts',
    actionHref: '/dashboard/hallucinations',
  },
};

// ── SOV Trend Chart ─────────────────────────────────────────────────────────
// Matches SOVDataPoint[] ({ date: string, sov: number })
export const SAMPLE_SOV_TREND: SOVDataPoint[] = [
  { date: '2026-01-05', sov: 34 },
  { date: '2026-01-12', sov: 38 },
  { date: '2026-01-19', sov: 41 },
  { date: '2026-01-26', sov: 39 },
  { date: '2026-02-02', sov: 44 },
  { date: '2026-02-09', sov: 47 },
  { date: '2026-02-16', sov: 45 },
  { date: '2026-02-23', sov: 47 },
];

// ── Hallucinations by Model ─────────────────────────────────────────────────
// Matches ModelHallucinationData[] ({ model: string, count: number })
export const SAMPLE_HALLUCINATIONS_BY_MODEL: ModelHallucinationData[] = [
  { model: 'openai-gpt4o',      count: 3 },
  { model: 'perplexity-sonar',  count: 2 },
  { model: 'google-gemini',     count: 1 },
  { model: 'microsoft-copilot', count: 1 },
];

// ── Quick Stats Metric Values ───────────────────────────────────────────────
export const SAMPLE_FIXED_COUNT = 5;
export const SAMPLE_INTERCEPTS_THIS_MONTH = 7;
export const SAMPLE_OPEN_ALERT_COUNT = 2;
