// ---------------------------------------------------------------------------
// lib/exports/pdf-assembler.ts — Pure data assembler for PDF audit report
//
// Sprint 95 — PDF Audit Report (Gap #74).
// Pure functions — no I/O, no side effects, zero mocks needed in tests.
// ---------------------------------------------------------------------------

import type { Database } from '@/lib/supabase/database.types';

type OrgRow = Database['public']['Tables']['organizations']['Row'];
type LocationRow = Database['public']['Tables']['locations']['Row'];
type HallucinationRow =
  Database['public']['Tables']['ai_hallucinations']['Row'];

export type SOVRow = {
  engine: string;
  rank_position: number | null;
  query_text: string;
};

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface AuditReportData {
  org: {
    name: string;
    city: string | null;
    state: string | null;
    logoUrl: string | null;
  };
  period: { start: string; end: string; generatedAt: string };
  summary: {
    realityScore: number;
    totalAudits: number;
    hallucinationCount: number;
    hallucinationRate: number; // 0–100
    byRisk: { high: number; medium: number; low: number };
    modelCount: number;
  };
  modelBreakdown: ModelRow[];
  topHallucinations: HallucinationDetail[]; // max 5, high risk first
  sovRows: SOVSummaryRow[]; // max 10 queries
  recommendations: string[]; // 3–5
}

export interface ModelRow {
  model: string; // Display name
  audits: number;
  hallucinations: number;
  accuracy: number; // 0–100
}

export interface HallucinationDetail {
  date: string; // 'February 25, 2026'
  model: string;
  question: string;
  aiResponse: string; // Truncated to 300 chars
  correction: string | null;
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | null;
}

export interface SOVSummaryRow {
  query: string;
  results: Record<string, 'cited' | 'not_cited'>; // keyed by display name
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'openai-gpt4o': 'ChatGPT (OpenAI)',
  'perplexity-sonar': 'Perplexity',
  'google-gemini': 'Google Gemini',
  'anthropic-claude': 'Claude (Anthropic)',
  'microsoft-copilot': 'Microsoft Copilot',
  'openai-gpt4o-mini': 'ChatGPT Mini (OpenAI)',
};

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ---------------------------------------------------------------------------
// Assembler
// ---------------------------------------------------------------------------

export function assembleAuditReportData(
  org: OrgRow,
  location: LocationRow | null,
  hallucinations: HallucinationRow[],
  sovData: SOVRow[],
  realityScore: number,
): AuditReportData {
  const now = new Date();
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Summary counts
  const totalAudits = hallucinations.length;
  const hallucinationRows = hallucinations.filter(
    (h) =>
      h.correction_status === 'open' ||
      h.correction_status === 'recurring' ||
      h.correction_status === 'verifying',
  );
  const hallucinationCount = hallucinationRows.length;
  const hallucinationRate =
    totalAudits > 0
      ? Math.round((hallucinationCount / totalAudits) * 100)
      : 0;

  const byRisk = {
    high:
      hallucinationRows.filter(
        (h) => h.severity === 'high' || h.severity === 'critical',
      ).length,
    medium: hallucinationRows.filter((h) => h.severity === 'medium').length,
    low: hallucinationRows.filter((h) => h.severity === 'low').length,
  };

  // Model breakdown
  const modelMap = new Map<
    string,
    { audits: number; hallucinations: number }
  >();
  for (const h of hallucinations) {
    const key = h.model_provider;
    const entry = modelMap.get(key) ?? { audits: 0, hallucinations: 0 };
    entry.audits++;
    if (
      h.correction_status === 'open' ||
      h.correction_status === 'recurring' ||
      h.correction_status === 'verifying'
    ) {
      entry.hallucinations++;
    }
    modelMap.set(key, entry);
  }

  const modelBreakdown: ModelRow[] = Array.from(modelMap.entries()).map(
    ([key, val]) => ({
      model: MODEL_DISPLAY_NAMES[key] ?? key,
      audits: val.audits,
      hallucinations: val.hallucinations,
      accuracy:
        val.audits > 0
          ? Math.round((1 - val.hallucinations / val.audits) * 100)
          : 100,
    }),
  );

  // Top hallucinations — high risk first, then by date descending, max 5
  const openHallucinations = hallucinationRows
    .sort((a, b) => {
      const sevDiff =
        (SEVERITY_ORDER[a.severity ?? ''] ?? 9) -
        (SEVERITY_ORDER[b.severity ?? ''] ?? 9);
      if (sevDiff !== 0) return sevDiff;
      return (
        new Date(b.detected_at ?? b.created_at ?? 0).getTime() -
        new Date(a.detected_at ?? a.created_at ?? 0).getTime()
      );
    })
    .slice(0, 5);

  const topHallucinations: HallucinationDetail[] = openHallucinations.map(
    (h) => ({
      date: new Date(h.detected_at ?? h.created_at ?? now).toLocaleDateString(
        'en-US',
        { month: 'long', day: 'numeric', year: 'numeric' },
      ),
      model: MODEL_DISPLAY_NAMES[h.model_provider] ?? h.model_provider,
      question: h.claim_text,
      aiResponse: h.claim_text.length > 300
        ? h.claim_text.slice(0, 300)
        : h.claim_text,
      correction: h.expected_truth,
      riskLevel: h.severity as HallucinationDetail['riskLevel'],
    }),
  );

  // SOV summary — group by query, max 10
  const sovMap = new Map<string, Record<string, 'cited' | 'not_cited'>>();
  const allEngines = new Set<string>();

  for (const row of sovData) {
    const displayEngine = MODEL_DISPLAY_NAMES[row.engine] ?? row.engine;
    allEngines.add(displayEngine);

    const existing = sovMap.get(row.query_text) ?? {};
    existing[displayEngine] =
      row.rank_position !== null ? 'cited' : 'not_cited';
    sovMap.set(row.query_text, existing);
  }

  // Fill in engines not present for each query
  const sovRows: SOVSummaryRow[] = Array.from(sovMap.entries())
    .slice(0, 10)
    .map(([query, results]) => {
      for (const engine of allEngines) {
        if (!(engine in results)) {
          results[engine] = 'not_cited';
        }
      }
      return { query, results };
    });

  const data: AuditReportData = {
    org: {
      name: org.name,
      city: location?.city ?? null,
      state: location?.state ?? null,
      logoUrl: null, // orgs table has no logo_url column
    },
    period: {
      start: ninetyDaysAgo.toISOString(),
      end: now.toISOString(),
      generatedAt: now.toISOString(),
    },
    summary: {
      realityScore: Math.max(0, Math.min(100, realityScore)),
      totalAudits,
      hallucinationCount,
      hallucinationRate,
      byRisk,
      modelCount: modelMap.size,
    },
    modelBreakdown,
    topHallucinations,
    sovRows,
    recommendations: [], // populated below
  };

  data.recommendations = generateRecommendations(data);
  return data;
}

// ---------------------------------------------------------------------------
// Recommendation generator — data-driven, 3–5 recommendations
// ---------------------------------------------------------------------------

export function generateRecommendations(data: AuditReportData): string[] {
  const recs: string[] = [];

  // Reality Score below 70
  if (data.summary.realityScore < 70) {
    recs.push(
      `Your Reality Score is ${data.summary.realityScore}/100. Address the ${data.summary.byRisk.high} high-risk hallucinations to improve accuracy.`,
    );
  }

  // High risk hallucinations present
  if (data.summary.byRisk.high > 0 && data.summary.realityScore >= 70) {
    recs.push(
      `You have ${data.summary.byRisk.high} high-risk ${data.summary.byRisk.high === 1 ? 'hallucination' : 'hallucinations'}. Prioritize correcting ${data.summary.byRisk.high === 1 ? 'it' : 'them'} to maintain your Reality Score.`,
    );
  }

  // Perplexity SOV citation rate = 0
  const perplexitySOV = data.sovRows.filter(
    (r) => r.results['Perplexity'] === 'cited',
  );
  if (
    data.sovRows.length > 0 &&
    perplexitySOV.length === 0
  ) {
    recs.push(
      'Perplexity has not cited your business for any tracked queries. Allow PerplexityBot in your robots.txt and ensure your menu schema is published.',
    );
  }

  // Model with high hallucination rate
  for (const model of data.modelBreakdown) {
    if (model.accuracy < 80 && model.audits >= 5) {
      recs.push(
        `${model.model} has a ${model.accuracy}% accuracy rate. Review your structured data to ensure it matches your ground truth for this engine.`,
      );
      break; // one model-specific rec is enough
    }
  }

  // Medium risk hallucinations
  if (data.summary.byRisk.medium > 5) {
    recs.push(
      `${data.summary.byRisk.medium} medium-risk hallucinations detected. While not critical, addressing these will improve overall AI accuracy.`,
    );
  }

  // Generic proactive monitoring — always available
  if (recs.length < 3) {
    recs.push(
      'Keep your business hours, menu, and amenities up to date to maintain high AI accuracy across all engines.',
    );
  }
  if (recs.length < 3) {
    recs.push(
      'Schedule weekly reviews of your AI visibility dashboard to catch new hallucinations early.',
    );
  }
  if (recs.length < 3) {
    recs.push(
      'Publish structured data (FAQ schema, LocalBusiness schema) to help AI engines represent your business accurately.',
    );
  }

  return recs.slice(0, 5);
}
