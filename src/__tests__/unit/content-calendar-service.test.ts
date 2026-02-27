// ---------------------------------------------------------------------------
// content-calendar-service.test.ts — Sprint 83: Proactive Content Calendar
//
// 45 tests covering all 5 signal generators, urgency scoring, time
// bucketing, deduplication, filtering, helpers, and MOCK integration.
//
// Run: npx vitest run src/__tests__/unit/content-calendar-service.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  generateContentCalendar,
  generateOccasionRecommendations,
  generateSOVGapRecommendations,
  generateFreshnessRecommendations,
  generateCompetitorGapRecommendations,
  generateHallucinationFixRecommendations,
  computeDaysUntilDate,
  assignTimeBucket,
  truncate,
  formatProvider,
  type CalendarInput,
} from '@/lib/services/content-calendar.service';
import { MOCK_CALENDAR_INPUT } from '@/__fixtures__/golden-tenant';

// ── Helper: minimal empty input ──────────────────────

function emptyInput(overrides: Partial<CalendarInput> = {}): CalendarInput {
  return {
    businessName: 'Test Biz',
    locationId: 'loc-1',
    occasions: [],
    sovGaps: [],
    stalePages: [],
    staleMenu: null,
    competitorGaps: [],
    openHallucinations: [],
    existingDraftTriggerIds: new Set(),
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// generateContentCalendar — Empty input
// ═════════════════════════════════════════════════════════════════════════════

describe('generateContentCalendar', () => {
  describe('Empty input', () => {
    it('1. returns empty buckets for empty input', () => {
      const result = generateContentCalendar(emptyInput());
      expect(result.thisWeek).toEqual([]);
      expect(result.nextWeek).toEqual([]);
      expect(result.twoWeeks).toEqual([]);
      expect(result.later).toEqual([]);
    });

    it('2. returns totalCount 0 for empty input', () => {
      const result = generateContentCalendar(emptyInput());
      expect(result.totalCount).toBe(0);
    });

    it('3. returns all-zero signalSummary for empty input', () => {
      const result = generateContentCalendar(emptyInput());
      expect(result.signalSummary).toEqual({
        occasionCount: 0,
        sovGapCount: 0,
        freshnessCount: 0,
        competitorGapCount: 0,
        hallucinationFixCount: 0,
      });
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Occasion recommendations
  // ═════════════════════════════════════════════════════════════════════════

  describe('Occasion recommendations', () => {
    const occasionInput = emptyInput({
      occasions: [
        {
          id: 'occ-1',
          name: 'Test Holiday',
          occasionType: 'holiday',
          annualDate: null,
          triggerDaysBefore: 14,
          peakQueryPatterns: ['test query'],
        },
      ],
    });

    it('4. generates recommendation for upcoming occasion', () => {
      const recs = generateOccasionRecommendations(occasionInput);
      expect(recs).toHaveLength(1);
      expect(recs[0]!.type).toBe('occasion');
      expect(recs[0]!.action).toBe('publish');
    });

    it('5. computes urgency based on days until peak (closer = higher)', () => {
      // With annualDate = null, defaults to urgency 50
      const recs = generateOccasionRecommendations(occasionInput);
      expect(recs[0]!.urgency).toBe(50);

      // With a near date, urgency should be higher
      const today = new Date();
      const threeDaysOut = new Date(today);
      threeDaysOut.setDate(threeDaysOut.getDate() + 3);
      const mm = String(threeDaysOut.getMonth() + 1).padStart(2, '0');
      const dd = String(threeDaysOut.getDate()).padStart(2, '0');

      const nearInput = emptyInput({
        occasions: [
          {
            id: 'occ-near',
            name: 'Near Holiday',
            occasionType: 'holiday',
            annualDate: `${mm}-${dd}`,
            triggerDaysBefore: 14,
            peakQueryPatterns: [],
          },
        ],
      });

      const nearRecs = generateOccasionRecommendations(nearInput);
      // 3 days out → urgency = 100 - 3*2 = 94, capped at 95
      expect(nearRecs[0]!.urgency).toBeGreaterThanOrEqual(90);
    });

    it('6. assigns this_week bucket for occasions within 7 days', () => {
      const today = new Date();
      const fiveDaysOut = new Date(today);
      fiveDaysOut.setDate(fiveDaysOut.getDate() + 5);
      const mm = String(fiveDaysOut.getMonth() + 1).padStart(2, '0');
      const dd = String(fiveDaysOut.getDate()).padStart(2, '0');

      const input = emptyInput({
        occasions: [
          {
            id: 'occ-soon',
            name: 'Soon Holiday',
            occasionType: 'holiday',
            annualDate: `${mm}-${dd}`,
            triggerDaysBefore: 14,
            peakQueryPatterns: [],
          },
        ],
      });
      const recs = generateOccasionRecommendations(input);
      expect(recs[0]!.timeBucket).toBe('this_week');
    });

    it('7. assigns next_week bucket for occasions 8-14 days out', () => {
      const today = new Date();
      const tenDaysOut = new Date(today);
      tenDaysOut.setDate(tenDaysOut.getDate() + 10);
      const mm = String(tenDaysOut.getMonth() + 1).padStart(2, '0');
      const dd = String(tenDaysOut.getDate()).padStart(2, '0');

      const input = emptyInput({
        occasions: [
          {
            id: 'occ-next',
            name: 'Next Week Holiday',
            occasionType: 'holiday',
            annualDate: `${mm}-${dd}`,
            triggerDaysBefore: 28,
            peakQueryPatterns: [],
          },
        ],
      });
      const recs = generateOccasionRecommendations(input);
      expect(recs[0]!.timeBucket).toBe('next_week');
    });

    it('8. sets suggestedContentType to occasion_page', () => {
      const recs = generateOccasionRecommendations(occasionInput);
      expect(recs[0]!.suggestedContentType).toBe('occasion_page');
    });

    it('9. includes occasion id as sourceId', () => {
      const recs = generateOccasionRecommendations(occasionInput);
      expect(recs[0]!.sourceId).toBe('occ-1');
    });

    it('10. includes CTA with trigger_type=occasion', () => {
      const recs = generateOccasionRecommendations(occasionInput);
      expect(recs[0]!.ctas[0]!.href).toContain('trigger_type=occasion');
      expect(recs[0]!.ctas[0]!.href).toContain('trigger_id=occ-1');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // SOV gap recommendations
  // ═════════════════════════════════════════════════════════════════════════

  describe('SOV gap recommendations', () => {
    it('11. generates recommendations for queries with null rank', () => {
      const input = emptyInput({
        sovGaps: [
          {
            queryId: 'q1',
            queryText: 'test query',
            queryCategory: 'discovery',
            missingEngineCount: 2,
            totalEngineCount: 3,
          },
        ],
      });
      const recs = generateSOVGapRecommendations(input);
      expect(recs).toHaveLength(1);
      expect(recs[0]!.type).toBe('sov_gap');
    });

    it('12. sorts by missingEngineCount (worst gaps first)', () => {
      const input = emptyInput({
        sovGaps: [
          {
            queryId: 'q1',
            queryText: 'low gap',
            queryCategory: 'discovery',
            missingEngineCount: 1,
            totalEngineCount: 3,
          },
          {
            queryId: 'q2',
            queryText: 'high gap',
            queryCategory: 'discovery',
            missingEngineCount: 3,
            totalEngineCount: 3,
          },
        ],
      });
      const recs = generateSOVGapRecommendations(input);
      expect(recs[0]!.sourceId).toBe('q2');
      expect(recs[1]!.sourceId).toBe('q1');
    });

    it('13. limits to top 5 SOV gaps', () => {
      const input = emptyInput({
        sovGaps: Array.from({ length: 8 }, (_, i) => ({
          queryId: `q${i}`,
          queryText: `query ${i}`,
          queryCategory: 'discovery',
          missingEngineCount: 2,
          totalEngineCount: 3,
        })),
      });
      const recs = generateSOVGapRecommendations(input);
      expect(recs).toHaveLength(5);
    });

    it('14. computes urgency from gap ratio (missing / total engines)', () => {
      const input = emptyInput({
        sovGaps: [
          {
            queryId: 'q1',
            queryText: 'full gap',
            queryCategory: 'discovery',
            missingEngineCount: 3,
            totalEngineCount: 3,
          },
        ],
      });
      const recs = generateSOVGapRecommendations(input);
      // 3/3 * 80 = 80
      expect(recs[0]!.urgency).toBe(80);
    });

    it('15. defaults SOV gaps to next_week bucket', () => {
      const input = emptyInput({
        sovGaps: [
          {
            queryId: 'q1',
            queryText: 'test',
            queryCategory: 'discovery',
            missingEngineCount: 2,
            totalEngineCount: 3,
          },
        ],
      });
      const recs = generateSOVGapRecommendations(input);
      expect(recs[0]!.timeBucket).toBe('next_week');
    });

    it('16. maps occasion category queries to occasion_page content type', () => {
      const input = emptyInput({
        sovGaps: [
          {
            queryId: 'q1',
            queryText: 'valentines',
            queryCategory: 'occasion',
            missingEngineCount: 2,
            totalEngineCount: 3,
          },
        ],
      });
      const recs = generateSOVGapRecommendations(input);
      expect(recs[0]!.suggestedContentType).toBe('occasion_page');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Freshness recommendations
  // ═════════════════════════════════════════════════════════════════════════

  describe('Freshness recommendations', () => {
    it('17. generates recommendation for pages older than 30 days', () => {
      const input = emptyInput({
        stalePages: [
          {
            pageUrl: 'https://example.com/about',
            pageType: 'about',
            lastAuditedAt: '2026-01-01T00:00:00Z',
            overallScore: 55,
            daysSinceAudit: 45,
          },
        ],
      });
      const recs = generateFreshnessRecommendations(input);
      expect(recs).toHaveLength(1);
      expect(recs[0]!.action).toBe('update');
    });

    it('18. does NOT generate recommendation for pages younger than 30 days', () => {
      const input = emptyInput({
        stalePages: [
          {
            pageUrl: 'https://example.com/about',
            pageType: 'about',
            lastAuditedAt: '2026-02-10T00:00:00Z',
            overallScore: 80,
            daysSinceAudit: 15,
          },
        ],
      });
      const recs = generateFreshnessRecommendations(input);
      expect(recs).toHaveLength(0);
    });

    it('19. assigns this_week for pages older than 60 days', () => {
      const input = emptyInput({
        stalePages: [
          {
            pageUrl: 'https://example.com/about',
            pageType: 'about',
            lastAuditedAt: '2025-12-01T00:00:00Z',
            overallScore: 40,
            daysSinceAudit: 65,
          },
        ],
      });
      const recs = generateFreshnessRecommendations(input);
      expect(recs[0]!.timeBucket).toBe('this_week');
    });

    it('20. assigns next_week for pages 30-60 days old', () => {
      const input = emptyInput({
        stalePages: [
          {
            pageUrl: 'https://example.com/about',
            pageType: 'about',
            lastAuditedAt: '2026-01-15T00:00:00Z',
            overallScore: 55,
            daysSinceAudit: 40,
          },
        ],
      });
      const recs = generateFreshnessRecommendations(input);
      expect(recs[0]!.timeBucket).toBe('next_week');
    });

    it('21. includes daysSinceAudit in reason text', () => {
      const input = emptyInput({
        stalePages: [
          {
            pageUrl: 'https://example.com/about',
            pageType: 'about',
            lastAuditedAt: '2026-01-01T00:00:00Z',
            overallScore: null,
            daysSinceAudit: 50,
          },
        ],
      });
      const recs = generateFreshnessRecommendations(input);
      expect(recs[0]!.reason).toContain('50 days ago');
    });

    it('22. includes overallScore in reason text when available', () => {
      const input = emptyInput({
        stalePages: [
          {
            pageUrl: 'https://example.com/about',
            pageType: 'about',
            lastAuditedAt: '2026-01-01T00:00:00Z',
            overallScore: 62,
            daysSinceAudit: 50,
          },
        ],
      });
      const recs = generateFreshnessRecommendations(input);
      expect(recs[0]!.reason).toContain('score: 62/100');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Menu freshness
  // ═════════════════════════════════════════════════════════════════════════

  describe('Menu freshness', () => {
    it('23. generates menu update recommendation when stale (30+ days)', () => {
      const input = emptyInput({
        staleMenu: {
          menuId: 'menu-1',
          lastUpdatedAt: '2026-01-01T00:00:00Z',
          daysSinceUpdate: 45,
          recentBotVisitCount: 5,
          previousBotVisitCount: 12,
        },
      });
      const recs = generateFreshnessRecommendations(input);
      expect(recs).toHaveLength(1);
      expect(recs[0]!.title).toBe('Update menu page');
    });

    it('24. includes bot visit decline percentage in reason', () => {
      const input = emptyInput({
        staleMenu: {
          menuId: 'menu-1',
          lastUpdatedAt: '2026-01-01T00:00:00Z',
          daysSinceUpdate: 45,
          recentBotVisitCount: 5,
          previousBotVisitCount: 10,
        },
      });
      const recs = generateFreshnessRecommendations(input);
      expect(recs[0]!.reason).toContain('dropped 50%');
    });

    it('25. skips menu recommendation when not stale', () => {
      const input = emptyInput({
        staleMenu: {
          menuId: 'menu-1',
          lastUpdatedAt: '2026-02-20T00:00:00Z',
          daysSinceUpdate: 5,
          recentBotVisitCount: 10,
          previousBotVisitCount: 10,
        },
      });
      const recs = generateFreshnessRecommendations(input);
      expect(recs).toHaveLength(0);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Competitor gap recommendations
  // ═════════════════════════════════════════════════════════════════════════

  describe('Competitor gap recommendations', () => {
    it('26. generates recommendation from pending competitor actions', () => {
      const input = emptyInput({
        competitorGaps: [
          {
            id: 'ci-1',
            competitorName: 'Rival',
            queryAsked: 'best lounge',
            winningFactor: 'atmosphere',
            suggestedAction: 'Improve ambiance content',
            gapMagnitude: 'medium',
          },
        ],
      });
      const recs = generateCompetitorGapRecommendations(input);
      expect(recs).toHaveLength(1);
      expect(recs[0]!.type).toBe('competitor_gap');
    });

    it('27. limits to top 3 competitor gaps', () => {
      const input = emptyInput({
        competitorGaps: Array.from({ length: 5 }, (_, i) => ({
          id: `ci-${i}`,
          competitorName: `Rival ${i}`,
          queryAsked: `query ${i}`,
          winningFactor: null,
          suggestedAction: null,
          gapMagnitude: 'medium',
        })),
      });
      const recs = generateCompetitorGapRecommendations(input);
      expect(recs).toHaveLength(3);
    });

    it('28. maps gapMagnitude to urgency (large=70, medium=55, small=40)', () => {
      const makeInput = (mag: string) =>
        emptyInput({
          competitorGaps: [
            {
              id: 'ci-1',
              competitorName: 'R',
              queryAsked: 'q',
              winningFactor: null,
              suggestedAction: null,
              gapMagnitude: mag,
            },
          ],
        });
      expect(
        generateCompetitorGapRecommendations(makeInput('large'))[0]!.urgency,
      ).toBe(70);
      expect(
        generateCompetitorGapRecommendations(makeInput('medium'))[0]!.urgency,
      ).toBe(55);
      expect(
        generateCompetitorGapRecommendations(makeInput('small'))[0]!.urgency,
      ).toBe(40);
    });

    it('29. assigns two_weeks bucket', () => {
      const input = emptyInput({
        competitorGaps: [
          {
            id: 'ci-1',
            competitorName: 'Rival',
            queryAsked: 'q',
            winningFactor: null,
            suggestedAction: null,
            gapMagnitude: 'medium',
          },
        ],
      });
      const recs = generateCompetitorGapRecommendations(input);
      expect(recs[0]!.timeBucket).toBe('two_weeks');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Hallucination fix recommendations
  // ═════════════════════════════════════════════════════════════════════════

  describe('Hallucination fix recommendations', () => {
    it('30. generates recommendation for open hallucinations', () => {
      const input = emptyInput({
        openHallucinations: [
          {
            id: 'h-1',
            claimText: 'false claim',
            severity: 'high',
            modelProvider: 'openai-gpt4o',
          },
        ],
      });
      const recs = generateHallucinationFixRecommendations(input);
      expect(recs).toHaveLength(1);
      expect(recs[0]!.type).toBe('hallucination_fix');
    });

    it('31. limits to top 3 hallucinations', () => {
      const input = emptyInput({
        openHallucinations: Array.from({ length: 5 }, (_, i) => ({
          id: `h-${i}`,
          claimText: `claim ${i}`,
          severity: 'high',
          modelProvider: 'openai-gpt4o',
        })),
      });
      const recs = generateHallucinationFixRecommendations(input);
      expect(recs).toHaveLength(3);
    });

    it('32. critical severity gets urgency 90', () => {
      const input = emptyInput({
        openHallucinations: [
          {
            id: 'h-1',
            claimText: 'critical claim',
            severity: 'critical',
            modelProvider: 'openai-gpt4o',
          },
        ],
      });
      const recs = generateHallucinationFixRecommendations(input);
      expect(recs[0]!.urgency).toBe(90);
    });

    it('33. high severity gets urgency 75', () => {
      const input = emptyInput({
        openHallucinations: [
          {
            id: 'h-1',
            claimText: 'high claim',
            severity: 'high',
            modelProvider: 'openai-gpt4o',
          },
        ],
      });
      const recs = generateHallucinationFixRecommendations(input);
      expect(recs[0]!.urgency).toBe(75);
    });

    it('34. assigns this_week for critical/high urgency', () => {
      const critInput = emptyInput({
        openHallucinations: [
          {
            id: 'h-1',
            claimText: 'critical',
            severity: 'critical',
            modelProvider: 'openai-gpt4o',
          },
        ],
      });
      const highInput = emptyInput({
        openHallucinations: [
          {
            id: 'h-2',
            claimText: 'high',
            severity: 'high',
            modelProvider: 'openai-gpt4o',
          },
        ],
      });
      expect(
        generateHallucinationFixRecommendations(critInput)[0]!.timeBucket,
      ).toBe('this_week');
      expect(
        generateHallucinationFixRecommendations(highInput)[0]!.timeBucket,
      ).toBe('this_week');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Deduplication
  // ═════════════════════════════════════════════════════════════════════════

  describe('Deduplication', () => {
    it('35. deduplicates by key, keeping higher urgency', () => {
      // Two occasions with the same id generate the same key
      const input = emptyInput({
        occasions: [
          {
            id: 'occ-dup',
            name: 'Dup A',
            occasionType: 'holiday',
            annualDate: null,
            triggerDaysBefore: 14,
            peakQueryPatterns: [],
          },
          {
            id: 'occ-dup',
            name: 'Dup B',
            occasionType: 'holiday',
            annualDate: null,
            triggerDaysBefore: 14,
            peakQueryPatterns: [],
          },
        ],
      });
      const result = generateContentCalendar(input);
      // Both have key "occasion:occ-dup", only 1 should remain
      const occasionRecs = [
        ...result.thisWeek,
        ...result.nextWeek,
        ...result.twoWeeks,
        ...result.later,
      ].filter((r) => r.type === 'occasion');
      expect(occasionRecs).toHaveLength(1);
    });

    it('36. filters out recommendations with existing draft trigger_ids', () => {
      const input = emptyInput({
        openHallucinations: [
          {
            id: 'h-1',
            claimText: 'claim',
            severity: 'high',
            modelProvider: 'openai-gpt4o',
          },
        ],
        existingDraftTriggerIds: new Set(['h-1']),
      });
      const result = generateContentCalendar(input);
      expect(result.totalCount).toBe(0);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Sorting
  // ═════════════════════════════════════════════════════════════════════════

  describe('Sorting', () => {
    it('37. sorts within each bucket by urgency descending', () => {
      const input = emptyInput({
        stalePages: [
          {
            pageUrl: 'https://example.com/a',
            pageType: 'about',
            lastAuditedAt: '2025-12-01T00:00:00Z',
            overallScore: null,
            daysSinceAudit: 70, // urgency: min(85, 40+70)=85, this_week
          },
          {
            pageUrl: 'https://example.com/b',
            pageType: 'faq',
            lastAuditedAt: '2025-12-15T00:00:00Z',
            overallScore: null,
            daysSinceAudit: 65, // urgency: min(85, 40+65)=85, this_week
          },
          {
            pageUrl: 'https://example.com/c',
            pageType: 'menu',
            lastAuditedAt: '2025-11-01T00:00:00Z',
            overallScore: null,
            daysSinceAudit: 80, // urgency: min(85, 40+80)=85, this_week
          },
        ],
        openHallucinations: [
          {
            id: 'h-crit',
            claimText: 'critical',
            severity: 'critical',
            modelProvider: 'openai-gpt4o',
          },
        ],
      });
      const result = generateContentCalendar(input);
      // Critical hallucination (urgency 90) should be first in this_week
      expect(result.thisWeek[0]!.urgency).toBe(90);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Signal summary
  // ═════════════════════════════════════════════════════════════════════════

  describe('Signal summary', () => {
    it('38. counts recommendations per signal type correctly', () => {
      const input = emptyInput({
        sovGaps: [
          {
            queryId: 'q1',
            queryText: 'q',
            queryCategory: 'discovery',
            missingEngineCount: 2,
            totalEngineCount: 3,
          },
          {
            queryId: 'q2',
            queryText: 'q2',
            queryCategory: 'discovery',
            missingEngineCount: 1,
            totalEngineCount: 3,
          },
        ],
        competitorGaps: [
          {
            id: 'ci-1',
            competitorName: 'R',
            queryAsked: 'q',
            winningFactor: null,
            suggestedAction: null,
            gapMagnitude: 'medium',
          },
        ],
      });
      const result = generateContentCalendar(input);
      expect(result.signalSummary.sovGapCount).toBe(2);
      expect(result.signalSummary.competitorGapCount).toBe(1);
      expect(result.signalSummary.occasionCount).toBe(0);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Integration with MOCK_CALENDAR_INPUT
  // ═════════════════════════════════════════════════════════════════════════

  describe('Integration', () => {
    it('39. produces valid result from MOCK_CALENDAR_INPUT', () => {
      const result = generateContentCalendar(MOCK_CALENDAR_INPUT);
      expect(result.totalCount).toBeGreaterThan(0);
      expect(result.signalSummary.occasionCount).toBeGreaterThanOrEqual(0);
      expect(result.signalSummary.sovGapCount).toBe(2);
      expect(result.signalSummary.freshnessCount).toBeGreaterThanOrEqual(1);
      expect(result.signalSummary.competitorGapCount).toBe(1);
      expect(result.signalSummary.hallucinationFixCount).toBe(1);
    });

    it('40. MOCK_CALENDAR_INPUT generates recommendations in multiple buckets', () => {
      const result = generateContentCalendar(MOCK_CALENDAR_INPUT);
      const nonEmpty = [
        result.thisWeek.length > 0,
        result.nextWeek.length > 0,
        result.twoWeeks.length > 0,
        result.later.length > 0,
      ].filter(Boolean);
      // Should have recs in at least 2 different buckets
      expect(nonEmpty.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Helper functions
// ═════════════════════════════════════════════════════════════════════════════

describe('helper functions', () => {
  it('41. computeDaysUntilDate handles same-year future date', () => {
    const today = new Date(2026, 0, 15); // Jan 15 2026
    const days = computeDaysUntilDate('03-15', today);
    expect(days).toBe(59); // Jan 15 → Mar 15 = 59 days
  });

  it('42. computeDaysUntilDate rolls to next year for past date', () => {
    const today = new Date(2026, 5, 15); // Jun 15 2026
    const days = computeDaysUntilDate('01-01', today);
    // Jan 1 2027 - Jun 15 2026 = ~200 days
    expect(days).toBeGreaterThan(190);
    expect(days).toBeLessThan(210);
  });

  it('43. assignTimeBucket maps days correctly to buckets', () => {
    expect(assignTimeBucket(1)).toBe('this_week');
    expect(assignTimeBucket(7)).toBe('this_week');
    expect(assignTimeBucket(8)).toBe('next_week');
    expect(assignTimeBucket(14)).toBe('next_week');
    expect(assignTimeBucket(15)).toBe('two_weeks');
    expect(assignTimeBucket(21)).toBe('two_weeks');
    expect(assignTimeBucket(22)).toBe('later');
    expect(assignTimeBucket(100)).toBe('later');
  });

  it('44. truncate shortens long text with ellipsis', () => {
    const long = 'A'.repeat(100);
    const result = truncate(long, 20);
    expect(result).toHaveLength(20);
    expect(result.endsWith('…')).toBe(true);
  });

  it('45. truncate preserves short text unchanged', () => {
    expect(truncate('hello', 20)).toBe('hello');
  });
});
