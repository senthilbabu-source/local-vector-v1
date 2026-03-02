// ---------------------------------------------------------------------------
// vaio-voice-gap-detector.test.ts — Voice gap detection unit tests
//
// Sprint 109: VAIO — ~10 tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  detectVoiceGaps,
  buildSuggestedAnswer,
} from '@/lib/vaio/voice-gap-detector';
import type { GroundTruthForVAIO } from '@/lib/vaio/types';

// Mock createDraft so gap detector doesn't actually create drafts in tests
vi.mock('@/lib/autopilot/create-draft', () => ({
  createDraft: vi.fn().mockResolvedValue({ id: 'draft-001' }),
}));

const MOCK_GT: GroundTruthForVAIO = {
  location_id: 'loc-001',
  org_id: 'org-001',
  name: 'Charcoal N Chill',
  address: '11950 Jones Bridge Road',
  city: 'Alpharetta',
  state: 'GA',
  zip: '30005',
  phone: '(678) 555-0199',
  website: 'https://charcoalnchill.com',
  categories: ['hookah lounge'],
  amenities: {
    has_outdoor_seating: true,
    has_hookah: true,
    has_live_music: true,
  },
  hours: {
    monday: { open: '16:00', close: '00:00' },
    friday: { open: '14:00', close: '02:00' },
  },
};

function buildMockSupabase(queries: Array<{
  id: string;
  query_text: string;
  query_category: string;
  citation_rate: number | null;
  last_run_at: string | null;
}>): SupabaseClient<Database> {
  const mockEq3 = vi.fn().mockResolvedValue({ data: queries, error: null });
  const mockEq2 = vi.fn().mockReturnValue({ eq: mockEq3 });
  const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
  return { from: mockFrom } as unknown as SupabaseClient<Database>;
}

describe('detectVoiceGaps', () => {
  const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();

  it('detects a gap when 3+ zero-citation queries exist in a category for 14+ days', async () => {
    const queries = [
      { id: 'q1', query_text: 'Q1', query_category: 'action', citation_rate: 0, last_run_at: threeWeeksAgo },
      { id: 'q2', query_text: 'Q2', query_category: 'action', citation_rate: 0, last_run_at: threeWeeksAgo },
      { id: 'q3', query_text: 'Q3', query_category: 'action', citation_rate: 0, last_run_at: threeWeeksAgo },
    ];
    const supabase = buildMockSupabase(queries);
    const gaps = await detectVoiceGaps(supabase, MOCK_GT, 'loc-001', 'org-001');

    expect(gaps).toHaveLength(1);
    expect(gaps[0].category).toBe('action');
    expect(gaps[0].queries).toHaveLength(3);
    expect(gaps[0].weeks_at_zero).toBeGreaterThanOrEqual(2);
  });

  it('does not detect gap when fewer than 3 zero-citation queries', async () => {
    const queries = [
      { id: 'q1', query_text: 'Q1', query_category: 'action', citation_rate: 0, last_run_at: threeWeeksAgo },
      { id: 'q2', query_text: 'Q2', query_category: 'action', citation_rate: 0, last_run_at: threeWeeksAgo },
    ];
    const supabase = buildMockSupabase(queries);
    const gaps = await detectVoiceGaps(supabase, MOCK_GT, 'loc-001', 'org-001');
    expect(gaps).toHaveLength(0);
  });

  it('does not detect gap when zero-citation queries are too recent (< 14 days)', async () => {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const queries = [
      { id: 'q1', query_text: 'Q1', query_category: 'action', citation_rate: 0, last_run_at: oneWeekAgo },
      { id: 'q2', query_text: 'Q2', query_category: 'action', citation_rate: 0, last_run_at: oneWeekAgo },
      { id: 'q3', query_text: 'Q3', query_category: 'action', citation_rate: 0, last_run_at: oneWeekAgo },
    ];
    const supabase = buildMockSupabase(queries);
    const gaps = await detectVoiceGaps(supabase, MOCK_GT, 'loc-001', 'org-001');
    expect(gaps).toHaveLength(0);
  });

  it('ignores queries with positive citation rate', async () => {
    const queries = [
      { id: 'q1', query_text: 'Q1', query_category: 'action', citation_rate: 0.5, last_run_at: threeWeeksAgo },
      { id: 'q2', query_text: 'Q2', query_category: 'action', citation_rate: 0, last_run_at: threeWeeksAgo },
      { id: 'q3', query_text: 'Q3', query_category: 'action', citation_rate: 0, last_run_at: threeWeeksAgo },
      { id: 'q4', query_text: 'Q4', query_category: 'action', citation_rate: 0.3, last_run_at: threeWeeksAgo },
    ];
    const supabase = buildMockSupabase(queries);
    const gaps = await detectVoiceGaps(supabase, MOCK_GT, 'loc-001', 'org-001');
    // Only 2 zero-citation queries in action, less than threshold of 3
    expect(gaps).toHaveLength(0);
  });

  it('ignores queries without last_run_at (never evaluated)', async () => {
    const queries = [
      { id: 'q1', query_text: 'Q1', query_category: 'action', citation_rate: 0, last_run_at: null },
      { id: 'q2', query_text: 'Q2', query_category: 'action', citation_rate: 0, last_run_at: null },
      { id: 'q3', query_text: 'Q3', query_category: 'action', citation_rate: 0, last_run_at: null },
    ];
    const supabase = buildMockSupabase(queries);
    const gaps = await detectVoiceGaps(supabase, MOCK_GT, 'loc-001', 'org-001');
    expect(gaps).toHaveLength(0);
  });

  it('detects gaps in multiple categories independently', async () => {
    const queries = [
      { id: 'q1', query_text: 'Q1', query_category: 'action', citation_rate: 0, last_run_at: threeWeeksAgo },
      { id: 'q2', query_text: 'Q2', query_category: 'action', citation_rate: 0, last_run_at: threeWeeksAgo },
      { id: 'q3', query_text: 'Q3', query_category: 'action', citation_rate: 0, last_run_at: threeWeeksAgo },
      { id: 'q4', query_text: 'Q4', query_category: 'discovery', citation_rate: 0, last_run_at: threeWeeksAgo },
      { id: 'q5', query_text: 'Q5', query_category: 'discovery', citation_rate: 0, last_run_at: threeWeeksAgo },
      { id: 'q6', query_text: 'Q6', query_category: 'discovery', citation_rate: 0, last_run_at: threeWeeksAgo },
    ];
    const supabase = buildMockSupabase(queries);
    const gaps = await detectVoiceGaps(supabase, MOCK_GT, 'loc-001', 'org-001');
    expect(gaps).toHaveLength(2);
    const categories = gaps.map((g) => g.category);
    expect(categories).toContain('action');
    expect(categories).toContain('discovery');
  });

  it('returns empty for no queries', async () => {
    const supabase = buildMockSupabase([]);
    const gaps = await detectVoiceGaps(supabase, MOCK_GT, 'loc-001', 'org-001');
    expect(gaps).toHaveLength(0);
  });

  it('sets suggested_content_type to faq_page for information gaps', async () => {
    const queries = [
      { id: 'q1', query_text: 'Q1', query_category: 'information', citation_rate: 0, last_run_at: threeWeeksAgo },
      { id: 'q2', query_text: 'Q2', query_category: 'information', citation_rate: 0, last_run_at: threeWeeksAgo },
      { id: 'q3', query_text: 'Q3', query_category: 'information', citation_rate: 0, last_run_at: threeWeeksAgo },
    ];
    const supabase = buildMockSupabase(queries);
    const gaps = await detectVoiceGaps(supabase, MOCK_GT, 'loc-001', 'org-001');
    expect(gaps[0].suggested_content_type).toBe('faq_page');
  });
});

describe('buildSuggestedAnswer', () => {
  it('builds information answer with hours', () => {
    const answer = buildSuggestedAnswer('information', MOCK_GT);
    expect(answer).toContain('Charcoal N Chill');
    expect(answer).toContain('Alpharetta');
    expect(answer).toContain('open');
  });

  it('builds action answer with address and contact info', () => {
    const answer = buildSuggestedAnswer('action', MOCK_GT);
    expect(answer).toContain('11950 Jones Bridge Road');
    expect(answer).toContain('Alpharetta');
    expect(answer).toContain('(678) 555-0199');
  });

  it('builds discovery answer with amenities', () => {
    const answer = buildSuggestedAnswer('discovery', MOCK_GT);
    expect(answer).toContain('hookah lounge');
    expect(answer).toContain('Alpharetta');
  });

  it('builds comparison answer with review keywords when provided', () => {
    const answer = buildSuggestedAnswer('comparison', MOCK_GT, ['great atmosphere', 'friendly staff']);
    expect(answer).toContain('great atmosphere');
    expect(answer).toContain('friendly staff');
  });

  it('builds comparison answer without review keywords', () => {
    const answer = buildSuggestedAnswer('comparison', MOCK_GT);
    expect(answer).toContain('popular');
    expect(answer).toContain('Alpharetta');
  });
});
