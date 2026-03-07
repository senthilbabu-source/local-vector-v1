// ---------------------------------------------------------------------------
// Wave 14: Persistence & Polish Tests (S74–S77)
//
// Tests cover:
//   S74: Digest preferences — validation + shouldSendDigest logic (8)
//   S75: Export report enrichment — buildExportableReport with real data (5)
//   S76: AITalkingAboutSection + demand-analyzer integration (4)
//   S77: Integration verifications (3)
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';

// ── S74: Digest Preferences ─────────────────────────────────────────────────

import {
  validateFrequency,
  validateSections,
  shouldSendDigest,
  getFrequencyLabel,
  getSectionLabel,
  DEFAULT_DIGEST_PREFERENCES,
} from '@/lib/services/digest-preferences';

describe('S74: Digest Preferences Persistence', () => {
  it('validateFrequency accepts valid frequencies', () => {
    expect(validateFrequency('weekly')).toBe('weekly');
    expect(validateFrequency('biweekly')).toBe('biweekly');
    expect(validateFrequency('monthly')).toBe('monthly');
  });

  it('validateFrequency defaults to weekly for invalid input', () => {
    expect(validateFrequency('daily')).toBe('weekly');
    expect(validateFrequency(null)).toBe('weekly');
    expect(validateFrequency(42)).toBe('weekly');
  });

  it('validateSections filters out invalid sections', () => {
    const result = validateSections(['score', 'invalid', 'wins']);
    expect(result).toEqual(['score', 'wins']);
  });

  it('validateSections defaults to score-only for empty array', () => {
    expect(validateSections([])).toEqual(['score']);
    expect(validateSections('not-array')).toEqual(DEFAULT_DIGEST_PREFERENCES.sections);
  });

  it('shouldSendDigest returns true for weekly frequency always', () => {
    const lastWeek = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    expect(shouldSendDigest('weekly', lastWeek)).toBe(true);
  });

  it('shouldSendDigest returns false for biweekly if only 7 days passed', () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(shouldSendDigest('biweekly', sevenDaysAgo)).toBe(false);
  });

  it('shouldSendDigest returns true for biweekly after 14 days', () => {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    expect(shouldSendDigest('biweekly', fifteenDaysAgo)).toBe(true);
  });

  it('shouldSendDigest returns true when never sent before', () => {
    expect(shouldSendDigest('monthly', null)).toBe(true);
  });
});

// ── S75: Export Report Enrichment ────────────────────────────────────────────

import { buildExportableReport } from '@/lib/services/report-exporter';

describe('S75: Export Report Enrichment', () => {
  it('includes topWin when provided', () => {
    const report = buildExportableReport({
      score: 75,
      scoreDelta: 3,
      topWin: 'Fixed wrong hours on ChatGPT',
      topIssue: null,
      competitorHighlight: null,
      nextAction: null,
      errorsFixed: 1,
      newErrors: 0,
      sovPercent: 40,
    }, 'Test Business');
    const insightsSection = report.sections.find(s => s.heading === 'Key Insights');
    expect(insightsSection).toBeDefined();
    expect(insightsSection!.rows.find(r => r.label === 'Top Win')?.value).toBe('Fixed wrong hours on ChatGPT');
  });

  it('includes competitorHighlight when provided', () => {
    const report = buildExportableReport({
      score: 60,
      scoreDelta: -2,
      topWin: null,
      topIssue: null,
      competitorHighlight: 'Rival BBQ mentions up 50%',
      nextAction: null,
      errorsFixed: 0,
      newErrors: 0,
      sovPercent: 30,
    }, 'Test Business');
    const insightsSection = report.sections.find(s => s.heading === 'Key Insights');
    expect(insightsSection!.rows.find(r => r.label === 'Competitor')?.value).toBe('Rival BBQ mentions up 50%');
  });

  it('includes nextAction when provided', () => {
    const report = buildExportableReport({
      score: 50,
      scoreDelta: null,
      topWin: null,
      topIssue: null,
      competitorHighlight: null,
      nextAction: 'Fix open AI errors on the dashboard',
      errorsFixed: 0,
      newErrors: 3,
      sovPercent: 15,
    }, 'Test Business');
    const insightsSection = report.sections.find(s => s.heading === 'Key Insights');
    expect(insightsSection!.rows.find(r => r.label === 'Recommended Action')?.value).toBe('Fix open AI errors on the dashboard');
  });

  it('omits Key Insights section when all fields are null', () => {
    const report = buildExportableReport({
      score: 80,
      scoreDelta: 5,
      topWin: null,
      topIssue: null,
      competitorHighlight: null,
      nextAction: null,
      errorsFixed: 0,
      newErrors: 0,
      sovPercent: 60,
    }, 'Test Business');
    expect(report.sections.find(s => s.heading === 'Key Insights')).toBeUndefined();
  });

  it('includes all 4 insight fields when all provided', () => {
    const report = buildExportableReport({
      score: 70,
      scoreDelta: 2,
      topWin: 'Win',
      topIssue: 'Issue',
      competitorHighlight: 'Comp',
      nextAction: 'Action',
      errorsFixed: 1,
      newErrors: 1,
      sovPercent: 45,
    }, 'Test Business');
    const insightsSection = report.sections.find(s => s.heading === 'Key Insights');
    expect(insightsSection!.rows).toHaveLength(4);
  });
});

// ── S76: AITalkingAboutSection + Demand Analyzer ────────────────────────────

import { countItemMentions } from '@/lib/menu-intelligence/demand-analyzer';

describe('S76: Menu Demand Analyzer Integration', () => {
  it('countItemMentions finds case-insensitive matches', () => {
    expect(countItemMentions('brisket', ['Try the Brisket at this place'])).toBe(1);
  });

  it('countItemMentions skips items shorter than 3 chars', () => {
    expect(countItemMentions('bb', ['bb sauce and bb ribs'])).toBe(0);
  });

  it('countItemMentions counts multiple occurrences', () => {
    expect(countItemMentions('ribs', ['ribs and more ribs, best ribs in town'])).toBe(3);
  });

  it('AITalkingAboutSection component is importable', async () => {
    const mod = await import('@/app/dashboard/magic-menus/_components/AITalkingAboutSection');
    expect(mod.default).toBeDefined();
  });
});

// ── S77: Integration Verifications ──────────────────────────────────────────

describe('S77: Integration Verifications', () => {
  it('DigestPreferencesForm component is importable', async () => {
    const mod = await import('@/app/dashboard/settings/_components/DigestPreferencesForm');
    expect(mod.default).toBeDefined();
  });

  it('getFrequencyLabel returns human labels', () => {
    expect(getFrequencyLabel('weekly')).toBe('Every week');
    expect(getFrequencyLabel('biweekly')).toBe('Every 2 weeks');
    expect(getFrequencyLabel('monthly')).toBe('Every month');
  });

  it('getSectionLabel returns human labels', () => {
    expect(getSectionLabel('score')).toBe('AI Health Score');
    expect(getSectionLabel('errors')).toBe('AI Errors & Fixes');
    expect(getSectionLabel('recommendations')).toBe('Recommendations');
  });
});
