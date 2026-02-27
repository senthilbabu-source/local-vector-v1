// ---------------------------------------------------------------------------
// content-calendar-page.test.ts — Sprint 83: Dashboard page + sidebar tests
//
// 10 tests — validates the pure service output that feeds the page and
// the sidebar nav item configuration.
//
// Run: npx vitest run src/__tests__/unit/content-calendar-page.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { NAV_ITEMS } from '@/components/layout/Sidebar';
import {
  generateContentCalendar,
  type CalendarInput,
  type ContentCalendarResult,
} from '@/lib/services/content-calendar.service';
import { MOCK_CALENDAR_INPUT } from '@/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function buildMockResult(): ContentCalendarResult {
  return generateContentCalendar(MOCK_CALENDAR_INPUT);
}

function emptyInput(): CalendarInput {
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
  };
}

// ---------------------------------------------------------------------------
// Content Calendar page
// ---------------------------------------------------------------------------

describe('Content Calendar page', () => {
  it('1. renders signal summary strip (analysis produces signal counts)', () => {
    const result = buildMockResult();
    const { signalSummary } = result;
    const totalSignals =
      signalSummary.occasionCount +
      signalSummary.sovGapCount +
      signalSummary.freshnessCount +
      signalSummary.competitorGapCount +
      signalSummary.hallucinationFixCount;
    expect(totalSignals).toBeGreaterThan(0);
  });

  it('2. renders This Week section with recommendations', () => {
    const result = buildMockResult();
    // At least some recommendations should land in this_week
    // (stale page >60d, high-urgency hallucination, or stale menu >45d)
    const thisWeekRecs = result.thisWeek;
    expect(thisWeekRecs.length).toBeGreaterThan(0);
  });

  it('3. renders Next Week section', () => {
    const result = buildMockResult();
    // SOV gaps default to next_week
    expect(result.nextWeek.length).toBeGreaterThan(0);
  });

  it('4. renders recommendation cards with action badge', () => {
    const result = buildMockResult();
    const allRecs = [
      ...result.thisWeek,
      ...result.nextWeek,
      ...result.twoWeeks,
      ...result.later,
    ];
    for (const rec of allRecs) {
      expect(['publish', 'update', 'create']).toContain(rec.action);
    }
  });

  it('5. renders urgency bar with color coding (0-100 range)', () => {
    const result = buildMockResult();
    const allRecs = [
      ...result.thisWeek,
      ...result.nextWeek,
      ...result.twoWeeks,
      ...result.later,
    ];
    for (const rec of allRecs) {
      expect(rec.urgency).toBeGreaterThanOrEqual(0);
      expect(rec.urgency).toBeLessThanOrEqual(100);
    }
  });

  it('6. renders CTA buttons', () => {
    const result = buildMockResult();
    const allRecs = [
      ...result.thisWeek,
      ...result.nextWeek,
      ...result.twoWeeks,
      ...result.later,
    ];
    for (const rec of allRecs) {
      expect(rec.ctas.length).toBeGreaterThan(0);
      expect(rec.ctas[0]!.label).toBeTruthy();
      expect(rec.ctas[0]!.href).toBeTruthy();
    }
  });

  it('7. renders deadline countdown badge when daysUntilDeadline present', () => {
    const result = buildMockResult();
    const allRecs = [
      ...result.thisWeek,
      ...result.nextWeek,
      ...result.twoWeeks,
      ...result.later,
    ];
    // Occasion recs have daysUntilDeadline
    const withDeadline = allRecs.filter((r) => r.daysUntilDeadline !== null);
    // Depending on current date vs Valentine's Day, occasion may or may not appear
    // but the type should be valid when present
    for (const rec of withDeadline) {
      expect(typeof rec.daysUntilDeadline).toBe('number');
    }
  });

  it('8. renders empty state when no recommendations', () => {
    const result = generateContentCalendar(emptyInput());
    expect(result.totalCount).toBe(0);
    // Page would show empty state when totalCount === 0
  });

  it('9. hides empty time bucket sections', () => {
    const result = generateContentCalendar(emptyInput());
    // All buckets are empty — page should hide all TimeBucketSection components
    expect(result.thisWeek).toHaveLength(0);
    expect(result.nextWeek).toHaveLength(0);
    expect(result.twoWeeks).toHaveLength(0);
    expect(result.later).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

describe('Sidebar', () => {
  it('10. shows Content Calendar link with test-id nav-content-calendar', () => {
    const calendarItem = NAV_ITEMS.find(
      (item) => item.href === '/dashboard/content-calendar',
    );
    expect(calendarItem).toBeDefined();
    expect(calendarItem!.label).toBe('Content Calendar');
    expect(calendarItem!.active).toBe(true);
    // data-testid is generated from label: nav-content-calendar
    const expectedTestId = `nav-${calendarItem!.label.toLowerCase().replace(/\s+/g, '-')}`;
    expect(expectedTestId).toBe('nav-content-calendar');
  });
});
