// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// page-audit-card.test.tsx — Sprint 71: PageAuditCard component tests
//
// Tests the updated PageAuditCard with nullable dimension scores,
// expandable accordion, and filtered recommendations per dimension.
//
// Run:
//   npx vitest run src/__tests__/unit/page-audit-card.test.tsx
// ---------------------------------------------------------------------------

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { PageAuditRecommendation } from '@/lib/page-audit/auditor';

// ── Mock server actions ──────────────────────────────────────────────────
vi.mock('@/app/dashboard/page-audits/actions', () => ({
  reauditPage: vi.fn(),
}));

vi.mock('@/app/dashboard/page-audits/schema-actions', () => ({
  generateSchemaFixes: vi.fn(),
}));

// Mock SchemaFixPanel to avoid complex rendering
vi.mock('@/app/dashboard/page-audits/_components/SchemaFixPanel', () => ({
  default: () => React.createElement('div', { 'data-testid': 'schema-panel' }, 'Schema Panel'),
}));

import PageAuditCard from '@/app/dashboard/page-audits/_components/PageAuditCard';

// ── Test data ────────────────────────────────────────────────────────────

const RECOMMENDATIONS: PageAuditRecommendation[] = [
  {
    issue: 'Opening text is navigation/hero copy',
    fix: 'Start with the answer.',
    impactPoints: 35,
    dimensionKey: 'answerFirst',
  },
  {
    issue: 'Missing required JSON-LD schema',
    fix: 'Add LocalBusiness schema.',
    impactPoints: 25,
    dimensionKey: 'schemaCompleteness',
    schemaType: 'LocalBusiness',
  },
  {
    issue: 'No FAQPage schema found',
    fix: 'Add FAQPage schema.',
    impactPoints: 20,
    dimensionKey: 'faqSchema',
    schemaType: 'FAQPage',
  },
];

const DEFAULT_PROPS = {
  pageUrl: 'https://charcoalnchill.com',
  pageType: 'homepage',
  overallScore: 66,
  answerFirstScore: 65 as number | null,
  schemaCompletenessScore: 55 as number | null,
  faqSchemaPresent: false,
  faqSchemaScore: 0 as number | null,
  keywordDensityScore: 78 as number | null,
  entityClarityScore: 62 as number | null,
  recommendations: RECOMMENDATIONS,
  lastAuditedAt: '2026-02-26T09:00:00.000Z',
  onReaudit: vi.fn().mockResolvedValue({ success: true }),
  onGenerateSchema: vi.fn().mockResolvedValue({ success: true, schemas: [] }),
};

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests: Dimension display ─────────────────────────────────────────────

describe('PageAuditCard — dimension display', () => {
  it('renders all 5 dimension bars with labels', () => {
    render(<PageAuditCard {...DEFAULT_PROPS} />);

    expect(screen.getByText('Answer-First Structure')).toBeDefined();
    expect(screen.getByText('Schema Completeness')).toBeDefined();
    expect(screen.getByText(/FAQ Schema/)).toBeDefined();
    expect(screen.getByText('Keyword Density')).toBeDefined();
    expect(screen.getByText('Entity Clarity')).toBeDefined();
  });

  it('renders real faqSchemaScore (not hardcoded 0)', () => {
    render(<PageAuditCard {...DEFAULT_PROPS} faqSchemaScore={75} />);

    // Score 75 should appear as text
    const scoreTexts = screen.getAllByText('75');
    expect(scoreTexts.length).toBeGreaterThan(0);
  });

  it('renders real entityClarityScore (not hardcoded 0)', () => {
    render(<PageAuditCard {...DEFAULT_PROPS} entityClarityScore={62} />);

    const scoreTexts = screen.getAllByText('62');
    expect(scoreTexts.length).toBeGreaterThan(0);
  });

  it('renders "\u2014" when score is null (pending state)', () => {
    render(
      <PageAuditCard
        {...DEFAULT_PROPS}
        faqSchemaScore={null}
        entityClarityScore={null}
      />,
    );

    // Should render em-dash for pending scores
    const dashes = screen.getAllByText('\u2014');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('renders score with correct text for green score >= 80', () => {
    render(<PageAuditCard {...DEFAULT_PROPS} keywordDensityScore={85} />);

    const scoreTexts = screen.getAllByText('85');
    expect(scoreTexts.length).toBeGreaterThan(0);
  });

  it('renders score with correct text for amber score 50-79', () => {
    render(<PageAuditCard {...DEFAULT_PROPS} answerFirstScore={65} />);

    const scoreTexts = screen.getAllByText('65');
    expect(scoreTexts.length).toBeGreaterThan(0);
  });

  it('renders score with correct text for red score < 50', () => {
    render(<PageAuditCard {...DEFAULT_PROPS} answerFirstScore={30} />);

    const scoreTexts = screen.getAllByText('30');
    expect(scoreTexts.length).toBeGreaterThan(0);
  });
});

// ── Tests: Expandable dimensions ─────────────────────────────────────────

describe('PageAuditCard — expandable dimensions', () => {
  it('clicking a dimension bar expands its detail section', () => {
    render(<PageAuditCard {...DEFAULT_PROPS} />);

    const answerFirstBtn = screen.getByText('Answer-First Structure').closest('button');
    expect(answerFirstBtn).toBeDefined();

    fireEvent.click(answerFirstBtn!);

    // After expanding, should show the dimension explanation
    expect(screen.getByText(/Measures whether your page leads with the answer/)).toBeDefined();
  });

  it('only one dimension is expanded at a time (accordion)', () => {
    render(<PageAuditCard {...DEFAULT_PROPS} />);

    // Expand Answer-First
    fireEvent.click(screen.getByText('Answer-First Structure').closest('button')!);
    expect(screen.getByText(/Measures whether your page leads with the answer/)).toBeDefined();

    // Expand Schema Completeness — should collapse Answer-First
    fireEvent.click(screen.getByText('Schema Completeness').closest('button')!);
    expect(screen.getByText(/Measures JSON-LD structured data/)).toBeDefined();
    expect(screen.queryByText(/Measures whether your page leads with the answer/)).toBeNull();
  });

  it('expanded dimension shows filtered recommendations', () => {
    render(<PageAuditCard {...DEFAULT_PROPS} />);

    // Expand FAQ Schema dimension
    fireEvent.click(screen.getByText(/FAQ Schema/).closest('button')!);

    // Should show the FAQ recommendation
    expect(screen.getByText('No FAQPage schema found')).toBeDefined();
    expect(screen.getByText('+20 pts')).toBeDefined();
  });

  it('"Generate" button appears when schemaType is present', () => {
    render(<PageAuditCard {...DEFAULT_PROPS} />);

    // Expand Schema Completeness dimension (has schemaType: 'LocalBusiness')
    fireEvent.click(screen.getByText('Schema Completeness').closest('button')!);

    // Should show generate button
    const generateBtn = screen.getByText(/Generate LocalBusiness/);
    expect(generateBtn).toBeDefined();
  });
});
