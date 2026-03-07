// ---------------------------------------------------------------------------
// Wave 9: Polish & Export Features — S47–S52
// Tests pure functions from all sprints.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';

// S48: Notification Feed
import {
  formatTimeAgo,
  getNotificationIcon,
  getNotificationColor,
  countUnread,
  type Notification,
} from '@/lib/services/notification-feed';

// S49: Report Exporter
import {
  buildExportableReport,
  exportReportAsText,
  exportReportAsCSV,
  type ExportableReport,
} from '@/lib/services/report-exporter';

// S50: AI Menu Suggestions
import {
  buildMenuSuggestionPrompt,
  validateSuggestions,
  type MenuContext,
} from '@/lib/menu-intelligence/ai-menu-suggestions';

// S41 re-imports for S47 test support
import {
  getScoreColor,
  formatScoreDelta,
  type WeeklyReportCard,
} from '@/lib/services/weekly-report-card';

// ═══════════════════════════════════════════════════════════════════════════
// S47: Weekly Report Card Email Template
// Tests pure helpers used by the email template (from weekly-report-card.ts)
// ═══════════════════════════════════════════════════════════════════════════

describe('S47: Report card email helpers', () => {
  it('getScoreColor maps to correct colors for email badge', () => {
    expect(getScoreColor(90)).toBe('green');
    expect(getScoreColor(55)).toBe('amber');
    expect(getScoreColor(10)).toBe('red');
    expect(getScoreColor(null)).toBe('gray');
  });

  it('formatScoreDelta formats positive, negative, zero, and null', () => {
    expect(formatScoreDelta(7)).toBe('+7');
    expect(formatScoreDelta(-4)).toBe('-4');
    expect(formatScoreDelta(0)).toBe('0');
    expect(formatScoreDelta(null)).toBe('N/A');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// S48: Notification Feed
// ═══════════════════════════════════════════════════════════════════════════

describe('S48: formatTimeAgo', () => {
  it('returns "just now" for < 1 minute', () => {
    const now = new Date().toISOString();
    expect(formatTimeAgo(now)).toBe('just now');
  });

  it('returns minutes for < 1 hour', () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60_000).toISOString();
    expect(formatTimeAgo(thirtyMinAgo)).toBe('30m ago');
  });

  it('returns hours for < 1 day', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
    expect(formatTimeAgo(threeHoursAgo)).toBe('3h ago');
  });

  it('returns days for < 1 week', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString();
    expect(formatTimeAgo(twoDaysAgo)).toBe('2d ago');
  });

  it('returns weeks for >= 7 days', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60_000).toISOString();
    expect(formatTimeAgo(twoWeeksAgo)).toBe('2w ago');
  });
});

describe('S48: getNotificationIcon', () => {
  it('maps all 5 types to icon names', () => {
    expect(getNotificationIcon('error_detected')).toBe('AlertTriangle');
    expect(getNotificationIcon('error_fixed')).toBe('CheckCircle2');
    expect(getNotificationIcon('competitor_change')).toBe('TrendingUp');
    expect(getNotificationIcon('score_change')).toBe('BarChart3');
    expect(getNotificationIcon('win')).toBe('Star');
  });
});

describe('S48: getNotificationColor', () => {
  it('returns correct CSS class for each type', () => {
    expect(getNotificationColor('error_detected')).toBe('text-red-400');
    expect(getNotificationColor('error_fixed')).toBe('text-emerald-400');
    expect(getNotificationColor('competitor_change')).toBe('text-amber-400');
    expect(getNotificationColor('score_change')).toBe('text-violet-400');
    expect(getNotificationColor('win')).toBe('text-emerald-400');
  });
});

describe('S48: countUnread', () => {
  it('counts notifications where read is false', () => {
    const notifications: Notification[] = [
      { id: '1', type: 'win', title: 'W', description: '', href: '/', timestamp: new Date().toISOString(), read: false },
      { id: '2', type: 'win', title: 'W', description: '', href: '/', timestamp: new Date().toISOString(), read: true },
      { id: '3', type: 'error_detected', title: 'E', description: '', href: '/', timestamp: new Date().toISOString(), read: false },
    ];
    expect(countUnread(notifications)).toBe(2);
  });

  it('returns 0 for empty array', () => {
    expect(countUnread([])).toBe(0);
  });

  it('returns 0 when all are read', () => {
    const notifications: Notification[] = [
      { id: '1', type: 'win', title: 'W', description: '', href: '/', timestamp: new Date().toISOString(), read: true },
    ];
    expect(countUnread(notifications)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// S49: Report Exporter
// ═══════════════════════════════════════════════════════════════════════════

const MOCK_CARD: WeeklyReportCard = {
  score: 72,
  scoreDelta: 5,
  topWin: 'Fixed hours on ChatGPT',
  topIssue: 'Wrong phone on Perplexity',
  competitorHighlight: "Joe's BBQ mentioned 12 times",
  nextAction: 'Fix open AI errors',
  errorsFixed: 2,
  newErrors: 1,
  sovPercent: 34,
};

describe('S49: buildExportableReport', () => {
  it('creates report with correct title and sections', () => {
    const report = buildExportableReport(MOCK_CARD, 'Test Restaurant');
    expect(report.title).toBe('AI Health Report — Test Restaurant');
    expect(report.sections.length).toBeGreaterThanOrEqual(3);
    expect(report.sections[0].heading).toBe('AI Health Summary');
    expect(report.sections[1].heading).toBe('Error Tracking');
  });

  it('includes AI Health Score row with value', () => {
    const report = buildExportableReport(MOCK_CARD, 'Test');
    const scoreRow = report.sections[0].rows.find(r => r.label === 'AI Health Score');
    expect(scoreRow?.value).toBe('72');
  });

  it('includes SOV when present', () => {
    const report = buildExportableReport(MOCK_CARD, 'Test');
    const sovRow = report.sections[0].rows.find(r => r.label === 'AI Mentions (SOV)');
    expect(sovRow?.value).toBe('34%');
  });

  it('handles null score gracefully', () => {
    const nullCard = { ...MOCK_CARD, score: null };
    const report = buildExportableReport(nullCard, 'Test');
    const scoreRow = report.sections[0].rows.find(r => r.label === 'AI Health Score');
    expect(scoreRow?.value).toBe('N/A');
  });

  it('includes additional metrics when provided', () => {
    const report = buildExportableReport(MOCK_CARD, 'Test', { napScore: 85, consistencyScore: 90 });
    const extraSection = report.sections.find(s => s.heading === 'Additional Metrics');
    expect(extraSection).toBeDefined();
    expect(extraSection!.rows.find(r => r.label === 'NAP Health Score')?.value).toBe('85/100');
  });

  it('skips additional metrics section when all null', () => {
    const report = buildExportableReport(MOCK_CARD, 'Test', { napScore: null });
    const extraSection = report.sections.find(s => s.heading === 'Additional Metrics');
    expect(extraSection).toBeUndefined();
  });
});

describe('S49: exportReportAsText', () => {
  it('produces text with title, sections, and rows', () => {
    const report = buildExportableReport(MOCK_CARD, 'Charcoal N Chill');
    const text = exportReportAsText(report);
    expect(text).toContain('AI Health Report — Charcoal N Chill');
    expect(text).toContain('--- AI Health Summary ---');
    expect(text).toContain('AI Health Score: 72');
    expect(text).toContain('Powered by LocalVector.ai');
  });
});

describe('S49: exportReportAsCSV', () => {
  it('produces CSV with header row', () => {
    const report = buildExportableReport(MOCK_CARD, 'Test');
    const csv = exportReportAsCSV(report);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Section,Metric,Value');
  });

  it('includes score data in CSV rows', () => {
    const report = buildExportableReport(MOCK_CARD, 'Test');
    const csv = exportReportAsCSV(report);
    expect(csv).toContain('AI Health Summary,AI Health Score,72');
  });

  it('escapes commas in values', () => {
    const report: ExportableReport = {
      title: 'Test',
      generatedAt: new Date().toISOString(),
      sections: [{
        heading: 'Test',
        rows: [{ label: 'Note', value: 'hello, world' }],
      }],
    };
    const csv = exportReportAsCSV(report);
    expect(csv).toContain('"hello, world"');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// S50: AI Menu Suggestions
// ═══════════════════════════════════════════════════════════════════════════

const MOCK_CONTEXT: MenuContext = {
  businessName: 'Test BBQ',
  industry: 'restaurant',
  itemCount: 50,
  itemsWithDescription: 30,
  itemsWithPrice: 45,
  itemsWithDietary: 10,
  topMentionedItems: ['Brisket', 'Pulled Pork'],
};

describe('S50: buildMenuSuggestionPrompt', () => {
  it('includes business name and item count', () => {
    const prompt = buildMenuSuggestionPrompt(MOCK_CONTEXT);
    expect(prompt).toContain('Test BBQ');
    expect(prompt).toContain('50 items');
  });

  it('calculates description completion rate', () => {
    const prompt = buildMenuSuggestionPrompt(MOCK_CONTEXT);
    expect(prompt).toContain('Descriptions: 60% complete');
  });

  it('calculates price rate', () => {
    const prompt = buildMenuSuggestionPrompt(MOCK_CONTEXT);
    expect(prompt).toContain('Prices: 90% listed');
  });

  it('includes top mentioned items', () => {
    const prompt = buildMenuSuggestionPrompt(MOCK_CONTEXT);
    expect(prompt).toContain('Brisket, Pulled Pork');
  });

  it('handles no mention data', () => {
    const ctx = { ...MOCK_CONTEXT, topMentionedItems: [] };
    const prompt = buildMenuSuggestionPrompt(ctx);
    expect(prompt).toContain('No AI mention data available');
  });

  it('handles zero items without NaN', () => {
    const ctx = { ...MOCK_CONTEXT, itemCount: 0 };
    const prompt = buildMenuSuggestionPrompt(ctx);
    expect(prompt).toContain('Descriptions: 0% complete');
    expect(prompt).toContain('Prices: 0% listed');
  });
});

describe('S50: validateSuggestions', () => {
  it('passes valid suggestions through', () => {
    const raw = [
      { title: 'Add descriptions', description: 'Detail your items', impact: 'high', category: 'description' },
      { title: 'Add prices', description: 'List all prices', impact: 'medium', category: 'price' },
    ];
    const result = validateSuggestions(raw);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Add descriptions');
  });

  it('filters out entries with missing title', () => {
    const raw = [
      { title: '', description: 'X', impact: 'high', category: 'description' },
      { title: 'Valid', description: 'X', impact: 'high', category: 'description' },
    ];
    expect(validateSuggestions(raw)).toHaveLength(1);
  });

  it('filters out entries with invalid impact', () => {
    const raw = [
      { title: 'T', description: 'D', impact: 'critical', category: 'description' },
    ];
    expect(validateSuggestions(raw)).toHaveLength(0);
  });

  it('filters out entries with invalid category', () => {
    const raw = [
      { title: 'T', description: 'D', impact: 'high', category: 'unknown' },
    ];
    expect(validateSuggestions(raw)).toHaveLength(0);
  });

  it('truncates long titles to 120 chars', () => {
    const raw = [
      { title: 'A'.repeat(200), description: 'D', impact: 'high', category: 'description' },
    ];
    const result = validateSuggestions(raw);
    expect(result[0].title).toHaveLength(120);
  });

  it('truncates long descriptions to 300 chars', () => {
    const raw = [
      { title: 'T', description: 'D'.repeat(500), impact: 'high', category: 'description' },
    ];
    const result = validateSuggestions(raw);
    expect(result[0].description).toHaveLength(300);
  });

  it('limits to 5 suggestions max', () => {
    const raw = Array.from({ length: 10 }, (_, i) => ({
      title: `Suggestion ${i}`,
      description: 'D',
      impact: 'high',
      category: 'description',
    }));
    expect(validateSuggestions(raw)).toHaveLength(5);
  });

  it('handles non-object entries gracefully', () => {
    const raw = [null, undefined, 42, 'string', { title: 'Valid', description: 'D', impact: 'high', category: 'price' }];
    expect(validateSuggestions(raw as unknown[])).toHaveLength(1);
  });
});
