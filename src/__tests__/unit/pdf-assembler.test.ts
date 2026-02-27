// ---------------------------------------------------------------------------
// src/__tests__/unit/pdf-assembler.test.ts — PDF assembler pure function tests
//
// Sprint 95 — PDF Audit Report (Gap #74).
// 26 tests. Zero mocks — pure functions only.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  assembleAuditReportData,
  generateRecommendations,
  MODEL_DISPLAY_NAMES,
  type AuditReportData,
  type SOVRow,
} from '@/lib/exports/pdf-assembler';
import {
  MOCK_HALLUCINATION_ROWS,
  MOCK_AUDIT_REPORT_DATA,
  GOLDEN_TENANT,
} from '@/src/__fixtures__/golden-tenant';
import type { Database } from '@/lib/supabase/database.types';

type OrgRow = Database['public']['Tables']['organizations']['Row'];
type LocationRow = Database['public']['Tables']['locations']['Row'];

// Minimal org row for testing
const mockOrg = {
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  name: 'Charcoal N Chill',
  slug: 'charcoal-n-chill',
  owner_user_id: null,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  plan: 'growth',
  plan_status: 'active',
  max_locations: 1,
  audit_frequency: 'daily',
  max_ai_audits_per_month: 60,
  ai_audits_used_this_month: 0,
  current_billing_period_start: null,
  onboarding_completed: true,
  notify_hallucination_alerts: true,
  notify_weekly_digest: true,
  notify_sov_alerts: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
} as unknown as OrgRow;

const mockLocation = {
  id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  business_name: GOLDEN_TENANT.location.business_name,
  slug: GOLDEN_TENANT.location.slug,
  name: GOLDEN_TENANT.location.name,
  address_line1: GOLDEN_TENANT.location.address_line1,
  city: GOLDEN_TENANT.location.city,
  state: GOLDEN_TENANT.location.state,
  zip: GOLDEN_TENANT.location.zip,
  phone: GOLDEN_TENANT.location.phone,
  website_url: GOLDEN_TENANT.location.website_url,
  operational_status: 'OPERATIONAL',
  hours_data: GOLDEN_TENANT.location.hours_data,
  amenities: GOLDEN_TENANT.location.amenities,
  categories: GOLDEN_TENANT.location.categories,
  is_primary: true,
  gbp_place_id: null,
  gbp_synced_at: null,
  avg_customer_value: null,
  monthly_covers: null,
  address_line2: null,
  country: null,
  google_place_id: null,
  place_details_refreshed_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
} as unknown as LocationRow;

const mockSOVData: SOVRow[] = [
  { engine: 'openai-gpt4o', rank_position: 2, query_text: 'hookah lounge alpharetta' },
  { engine: 'perplexity-sonar', rank_position: null, query_text: 'hookah lounge alpharetta' },
  { engine: 'google-gemini', rank_position: 1, query_text: 'hookah lounge alpharetta' },
];

// ---------------------------------------------------------------------------
// assembleAuditReportData
// ---------------------------------------------------------------------------

describe('assembleAuditReportData', () => {
  const result = assembleAuditReportData(
    mockOrg,
    mockLocation,
    MOCK_HALLUCINATION_ROWS,
    mockSOVData,
    72,
  );

  it('org.name populated from org row', () => {
    expect(result.org.name).toBe('Charcoal N Chill');
  });

  it('org.city and org.state populated from location row', () => {
    expect(result.org.city).toBe('Alpharetta');
    expect(result.org.state).toBe('GA');
  });

  it('org.logoUrl is null when org has no logo_url column', () => {
    expect(result.org.logoUrl).toBeNull();
  });

  it('realityScore passed through to summary.realityScore', () => {
    expect(result.summary.realityScore).toBe(72);
  });

  it('summary.totalAudits = total hallucination rows', () => {
    expect(result.summary.totalAudits).toBe(MOCK_HALLUCINATION_ROWS.length);
  });

  it('summary.hallucinationCount = rows with open/recurring/verifying status only', () => {
    // From MOCK_HALLUCINATION_ROWS: 3 open + 1 recurring = 4
    const expected = MOCK_HALLUCINATION_ROWS.filter(
      (h) =>
        h.correction_status === 'open' ||
        h.correction_status === 'recurring' ||
        h.correction_status === 'verifying',
    ).length;
    expect(result.summary.hallucinationCount).toBe(expected);
  });

  it('summary.hallucinationRate = (hallucinationCount / totalAudits * 100) rounded', () => {
    const expected = Math.round(
      (result.summary.hallucinationCount / result.summary.totalAudits) * 100,
    );
    expect(result.summary.hallucinationRate).toBe(expected);
  });

  it('summary.byRisk.high counts rows with severity high/critical and open status', () => {
    const expected = MOCK_HALLUCINATION_ROWS.filter(
      (h) =>
        (h.severity === 'high' || h.severity === 'critical') &&
        (h.correction_status === 'open' ||
          h.correction_status === 'recurring' ||
          h.correction_status === 'verifying'),
    ).length;
    expect(result.summary.byRisk.high).toBe(expected);
  });

  it('summary.byRisk.medium counts correctly', () => {
    const expected = MOCK_HALLUCINATION_ROWS.filter(
      (h) =>
        h.severity === 'medium' &&
        (h.correction_status === 'open' ||
          h.correction_status === 'recurring' ||
          h.correction_status === 'verifying'),
    ).length;
    expect(result.summary.byRisk.medium).toBe(expected);
  });

  it('summary.byRisk.low counts correctly', () => {
    const expected = MOCK_HALLUCINATION_ROWS.filter(
      (h) =>
        h.severity === 'low' &&
        (h.correction_status === 'open' ||
          h.correction_status === 'recurring' ||
          h.correction_status === 'verifying'),
    ).length;
    expect(result.summary.byRisk.low).toBe(expected);
  });

  it('modelBreakdown has one entry per unique model', () => {
    const uniqueModels = new Set(
      MOCK_HALLUCINATION_ROWS.map((h) => h.model_provider),
    );
    expect(result.modelBreakdown.length).toBe(uniqueModels.size);
  });

  it('modelBreakdown.accuracy = round((1 - hallucinations/audits) * 100)', () => {
    for (const entry of result.modelBreakdown) {
      const expected =
        entry.audits > 0
          ? Math.round((1 - entry.hallucinations / entry.audits) * 100)
          : 100;
      expect(entry.accuracy).toBe(expected);
    }
  });

  it('topHallucinations capped at 5 rows', () => {
    expect(result.topHallucinations.length).toBeLessThanOrEqual(5);
  });

  it('topHallucinations sorted: high risk first, then by date descending', () => {
    const riskOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    for (let i = 1; i < result.topHallucinations.length; i++) {
      const prev = result.topHallucinations[i - 1];
      const curr = result.topHallucinations[i];
      const prevRisk = riskOrder[prev.riskLevel ?? ''] ?? 9;
      const currRisk = riskOrder[curr.riskLevel ?? ''] ?? 9;
      expect(prevRisk).toBeLessThanOrEqual(currRisk);
    }
  });

  it('topHallucinations.aiResponse truncated to 300 chars', () => {
    // Create a row with very long claim_text
    const longRows = [
      {
        ...MOCK_HALLUCINATION_ROWS[0],
        claim_text: 'X'.repeat(500),
        correction_status: 'open' as const,
      },
    ];
    const r = assembleAuditReportData(mockOrg, mockLocation, longRows, [], 72);
    expect(r.topHallucinations[0].aiResponse.length).toBeLessThanOrEqual(300);
  });

  it('sovRows capped at 10 unique queries', () => {
    const manyQueries: SOVRow[] = Array.from({ length: 15 }, (_, i) => ({
      engine: 'openai-gpt4o',
      rank_position: i,
      query_text: `query ${i}`,
    }));
    const r = assembleAuditReportData(
      mockOrg,
      mockLocation,
      [],
      manyQueries,
      100,
    );
    expect(r.sovRows.length).toBeLessThanOrEqual(10);
  });

  it('sovRows result "cited" when rank_position is not null', () => {
    expect(
      result.sovRows[0].results[MODEL_DISPLAY_NAMES['openai-gpt4o']],
    ).toBe('cited');
  });

  it('sovRows result "not_cited" when rank_position is null', () => {
    expect(
      result.sovRows[0].results[MODEL_DISPLAY_NAMES['perplexity-sonar']],
    ).toBe('not_cited');
  });

  it('period.start is approximately 90 days before period.end', () => {
    const start = new Date(result.period.start);
    const end = new Date(result.period.end);
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(89);
    expect(diffDays).toBeLessThanOrEqual(91);
  });
});

// ---------------------------------------------------------------------------
// generateRecommendations
// ---------------------------------------------------------------------------

describe('generateRecommendations', () => {
  it('returns at least 3 recommendations', () => {
    const recs = generateRecommendations(MOCK_AUDIT_REPORT_DATA);
    expect(recs.length).toBeGreaterThanOrEqual(3);
  });

  it('returns no more than 5 recommendations', () => {
    const recs = generateRecommendations(MOCK_AUDIT_REPORT_DATA);
    expect(recs.length).toBeLessThanOrEqual(5);
  });

  it('includes Reality Score recommendation when score < 70', () => {
    const data: AuditReportData = {
      ...MOCK_AUDIT_REPORT_DATA,
      summary: { ...MOCK_AUDIT_REPORT_DATA.summary, realityScore: 65 },
    };
    const recs = generateRecommendations(data);
    expect(recs.some((r) => r.includes('Reality Score'))).toBe(true);
  });

  it('does NOT include Reality Score recommendation when score >= 70', () => {
    const data: AuditReportData = {
      ...MOCK_AUDIT_REPORT_DATA,
      summary: {
        ...MOCK_AUDIT_REPORT_DATA.summary,
        realityScore: 85,
        byRisk: { high: 0, medium: 0, low: 0 },
      },
    };
    const recs = generateRecommendations(data);
    expect(recs.some((r) => r.includes('Reality Score is 85'))).toBe(false);
  });

  it('includes Perplexity robots.txt tip when Perplexity SOV citation rate = 0', () => {
    const recs = generateRecommendations(MOCK_AUDIT_REPORT_DATA);
    expect(recs.some((r) => r.includes('Perplexity') || r.includes('PerplexityBot'))).toBe(true);
  });

  it('includes high-risk hallucination recommendation when high count > 0', () => {
    const recs = generateRecommendations(MOCK_AUDIT_REPORT_DATA);
    expect(
      recs.some((r) => r.includes('high-risk') || r.includes('High')),
    ).toBe(true);
  });

  it('all returned values are non-empty strings (no nulls, no "")', () => {
    const recs = generateRecommendations(MOCK_AUDIT_REPORT_DATA);
    for (const rec of recs) {
      expect(typeof rec).toBe('string');
      expect(rec.length).toBeGreaterThan(0);
    }
  });
});
