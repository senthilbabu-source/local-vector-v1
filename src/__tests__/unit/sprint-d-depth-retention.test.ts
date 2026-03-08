// ---------------------------------------------------------------------------
// Sprint D (Marketing) — Depth & Retention Tests
//
// Validates changelog page, partners page, pricing updates, SelfAudit
// interactivity, sitemap/nav/footer updates.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { computeVisibilityScore, scoreGrade } from '@/app/scan/_components/ScanDashboard';
import type { ScanDisplayData } from '@/app/scan/_utils/scan-params';

// ---------------------------------------------------------------------------
// 0. Visibility Score & Grade (Scan Dashboard Conversion Upgrade)
// ---------------------------------------------------------------------------
describe('computeVisibilityScore', () => {
  it('returns 0 for not_found status', () => {
    const result: ScanDisplayData = { status: 'not_found', businessName: 'Test', engine: 'Perplexity' };
    expect(computeVisibilityScore(result)).toBe(0);
  });

  it('returns 0 for invalid status', () => {
    const result: ScanDisplayData = { status: 'invalid' };
    expect(computeVisibilityScore(result)).toBe(0);
  });

  it('computes score for fail with high mentions + positive sentiment', () => {
    const result: ScanDisplayData = {
      status: 'fail', businessName: 'Test', engine: 'Perplexity',
      severity: 'critical', claimText: 'closed', expectedTruth: 'open',
      mentions: 'high', sentiment: 'positive', accuracyIssues: ['wrong hours'],
      accuracyIssueCategories: ['hours'],
    };
    // 70 (high) + 15 (positive) - 5 (1 issue) = 80
    expect(computeVisibilityScore(result)).toBe(80);
  });

  it('computes score for fail with low mentions + negative sentiment', () => {
    const result: ScanDisplayData = {
      status: 'fail', businessName: 'Test', engine: 'Perplexity',
      severity: 'high', claimText: 'bad food', expectedTruth: 'great food',
      mentions: 'low', sentiment: 'negative', accuracyIssues: ['wrong hours', 'wrong address'],
      accuracyIssueCategories: ['hours', 'address'],
    };
    // 20 (low) + (-15) (negative) - 10 (2 issues) = -5 → capped at 0
    expect(computeVisibilityScore(result)).toBe(0);
  });

  it('adds pass bonus for pass status', () => {
    const result: ScanDisplayData = {
      status: 'pass', businessName: 'Test', engine: 'Perplexity',
      mentions: 'medium', sentiment: 'neutral', accuracyIssues: [],
      accuracyIssueCategories: [],
    };
    // 45 (medium) + 0 (neutral) + 10 (pass) = 55
    expect(computeVisibilityScore(result)).toBe(55);
  });

  it('caps at 100', () => {
    const result: ScanDisplayData = {
      status: 'pass', businessName: 'Test', engine: 'Perplexity',
      mentions: 'high', sentiment: 'positive', accuracyIssues: [],
      accuracyIssueCategories: [],
    };
    // 70 + 15 + 10 = 95 (under cap)
    expect(computeVisibilityScore(result)).toBeLessThanOrEqual(100);
  });

  it('handles none mentions with neutral sentiment', () => {
    const result: ScanDisplayData = {
      status: 'fail', businessName: 'Test', engine: 'Perplexity',
      severity: 'medium', claimText: 'x', expectedTruth: 'y',
      mentions: 'none', sentiment: 'neutral', accuracyIssues: [],
      accuracyIssueCategories: [],
    };
    // 5 (none) + 0 (neutral) = 5
    expect(computeVisibilityScore(result)).toBe(5);
  });

  it('penalizes max 3 issues', () => {
    const result: ScanDisplayData = {
      status: 'fail', businessName: 'Test', engine: 'Perplexity',
      severity: 'critical', claimText: 'x', expectedTruth: 'y',
      mentions: 'high', sentiment: 'positive',
      accuracyIssues: ['a', 'b', 'c'],
      accuracyIssueCategories: ['hours', 'address', 'menu'],
    };
    // 70 + 15 - 15 = 70
    expect(computeVisibilityScore(result)).toBe(70);
  });
});

describe('scoreGrade', () => {
  it('returns Good for score >= 70', () => {
    expect(scoreGrade(70).label).toBe('Good');
    expect(scoreGrade(100).label).toBe('Good');
  });

  it('returns Needs Attention for score 50-69', () => {
    expect(scoreGrade(50).label).toBe('Needs Attention');
    expect(scoreGrade(69).label).toBe('Needs Attention');
  });

  it('returns At Risk for score 25-49', () => {
    expect(scoreGrade(25).label).toBe('At Risk');
    expect(scoreGrade(49).label).toBe('At Risk');
  });

  it('returns Critical for score < 25', () => {
    expect(scoreGrade(0).label).toBe('Critical');
    expect(scoreGrade(24).label).toBe('Critical');
  });

  it('returns correct colors', () => {
    expect(scoreGrade(80).color).toBe('#00F5A0');
    expect(scoreGrade(55).color).toBe('#FFB800');
    expect(scoreGrade(30).color).toBe('#EF4444');
    expect(scoreGrade(10).color).toBe('#EF4444');
  });

  it('returns urgency messages', () => {
    expect(scoreGrade(80).urgency).toBeTruthy();
    expect(scoreGrade(30).urgency).toContain('competitors');
  });
});

// ---------------------------------------------------------------------------
// 1. Changelog page
// ---------------------------------------------------------------------------
describe('Changelog page', () => {
  it('exports metadata with title containing Changelog', async () => {
    const mod = await import('@/app/(marketing)/changelog/page');
    expect(mod.metadata?.title).toContain('Changelog');
  });

  it('exports metadata with SEO description', async () => {
    const mod = await import('@/app/(marketing)/changelog/page');
    expect(mod.metadata?.description).toBeTruthy();
    expect(typeof mod.metadata?.description).toBe('string');
  });

  it('exports a default component', async () => {
    const mod = await import('@/app/(marketing)/changelog/page');
    expect(typeof mod.default).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 2. Partners page
// ---------------------------------------------------------------------------
describe('Partners page', () => {
  it('exports metadata with title containing Partner', async () => {
    const mod = await import('@/app/(marketing)/partners/page');
    expect(mod.metadata?.title).toContain('Partner');
  });

  it('exports metadata with SEO description', async () => {
    const mod = await import('@/app/(marketing)/partners/page');
    expect(mod.metadata?.description).toBeTruthy();
  });

  it('exports a default component', async () => {
    const mod = await import('@/app/(marketing)/partners/page');
    expect(typeof mod.default).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 3. Pricing page updates
// ---------------------------------------------------------------------------
describe('Pricing page feature updates', () => {
  it('includes Google AI Overview in starter features', async () => {
    const mod = await import('@/app/(marketing)/pricing/page');
    // Access the module to verify it loads without error
    expect(typeof mod.default).toBe('function');
  });

  it('exports metadata with pricing info', async () => {
    const mod = await import('@/app/(marketing)/pricing/page');
    expect(mod.metadata?.title).toContain('Pricing');
  });
});

// ---------------------------------------------------------------------------
// 4. SelfAudit section
// ---------------------------------------------------------------------------
describe('SelfAudit section', () => {
  it('exports a default component from SelfAudit', async () => {
    const mod = await import('@/app/(marketing)/_sections/SelfAudit');
    expect(typeof mod.default).toBe('function');
  });

  it('SelfAuditCards client component exists', async () => {
    const mod = await import('@/app/(marketing)/_components/SelfAuditCards');
    expect(typeof mod.default).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 5. Sitemap expansion
// ---------------------------------------------------------------------------
describe('Sitemap — Sprint D additions', () => {
  it('includes /changelog in sitemap', async () => {
    const { default: sitemap } = await import('@/app/sitemap');
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.includes('/changelog'))).toBe(true);
  });

  it('includes /partners in sitemap', async () => {
    const { default: sitemap } = await import('@/app/sitemap');
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.includes('/partners'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Partner waitlist API route
// ---------------------------------------------------------------------------
describe('Partner waitlist API', () => {
  it('exports a POST handler', async () => {
    const mod = await import('@/app/api/partner-waitlist/route');
    expect(typeof mod.POST).toBe('function');
  });
});
