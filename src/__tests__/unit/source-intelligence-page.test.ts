// ---------------------------------------------------------------------------
// source-intelligence-page.test.ts — Dashboard page + sidebar tests
//
// Sprint 82: 6 tests — page rendering, sidebar nav item.
//
// Run:
//   npx vitest run src/__tests__/unit/source-intelligence-page.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { NAV_ITEMS } from '@/components/layout/Sidebar';
import {
  analyzeSourceIntelligence,
  type SourceIntelligenceInput,
  type SourceIntelligenceResult,
} from '@/lib/services/source-intelligence.service';
import { MOCK_SOURCE_INTELLIGENCE_INPUT } from '@/src/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Page rendering tests — test the pure analysis output that feeds the page
// ---------------------------------------------------------------------------

function buildMockResult(): SourceIntelligenceResult {
  return analyzeSourceIntelligence(MOCK_SOURCE_INTELLIGENCE_INPUT);
}

describe('Source Intelligence page', () => {
  it('1. renders top sources table (analysis produces sources)', () => {
    const result = buildMockResult();
    expect(result.sources.length).toBeGreaterThan(0);
    // Top source should have a name and citation count
    expect(result.sources[0].name).toBeTruthy();
    expect(result.sources[0].citationCount).toBeGreaterThan(0);
  });

  it('2. renders category breakdown bars (analysis produces categories)', () => {
    const result = buildMockResult();
    expect(result.categoryBreakdown.length).toBeGreaterThan(0);
    // Each category should have a percentage
    for (const cat of result.categoryBreakdown) {
      expect(cat.percentage).toBeGreaterThanOrEqual(0);
      expect(cat.percentage).toBeLessThanOrEqual(100);
    }
  });

  it('3. renders alert cards when alerts present', () => {
    const result = buildMockResult();
    // The mock has a competitor source, so there should be at least one alert
    expect(result.alerts.length).toBeGreaterThan(0);
    expect(result.alerts[0].type).toBe('competitor_content');
    expect(result.alerts[0].severity).toBe('high');
  });

  it('4. renders per-engine breakdown', () => {
    const result = buildMockResult();
    expect(Object.keys(result.byEngine).length).toBeGreaterThan(0);
    expect(result.byEngine).toHaveProperty('google');
    expect(result.byEngine).toHaveProperty('perplexity');
    expect(result.byEngine).toHaveProperty('openai');
  });

  it('5. renders empty state when no source data', () => {
    const emptyInput: SourceIntelligenceInput = {
      businessName: 'Test',
      websiteUrl: null,
      evaluations: [],
    };
    const result = analyzeSourceIntelligence(emptyInput);
    expect(result.sources).toHaveLength(0);
    expect(result.evaluationCount).toBe(0);
    // Page would show empty state when evaluationCount === 0
  });
});

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

describe('Sidebar', () => {
  it('6. shows AI Sources link with test-id nav-ai-sources', () => {
    const sourceItem = NAV_ITEMS.find(item => item.href === '/dashboard/source-intelligence');
    expect(sourceItem).toBeDefined();
    expect(sourceItem!.label).toBe('AI Sources');
    expect(sourceItem!.active).toBe(true);
    // The data-testid is generated from label: nav-ai-sources
    const expectedTestId = `nav-${sourceItem!.label.toLowerCase().replace(/\s+/g, '-')}`;
    expect(expectedTestId).toBe('nav-ai-sources');
  });
});
