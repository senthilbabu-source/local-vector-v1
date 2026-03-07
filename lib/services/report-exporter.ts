// ---------------------------------------------------------------------------
// lib/services/report-exporter.ts — S49: Export AI Health Report as CSV/Text
//
// Pure functions for generating exportable report content.
// No AI calls — deterministic formatting from existing data.
// ---------------------------------------------------------------------------

import type { WeeklyReportCard } from './weekly-report-card';
import { formatScoreDelta, getScoreColor } from './weekly-report-card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportSection {
  heading: string;
  rows: Array<{ label: string; value: string }>;
}

export interface ExportableReport {
  title: string;
  generatedAt: string;
  sections: ReportSection[];
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Builds an exportable report from a report card + supplementary data.
 */
export function buildExportableReport(
  card: WeeklyReportCard,
  businessName: string,
  additionalMetrics?: {
    napScore?: number | null;
    totalQueries?: number | null;
    consistencyScore?: number | null;
  },
): ExportableReport {
  const now = new Date();
  const sections: ReportSection[] = [];

  // Score section
  const scoreRows: Array<{ label: string; value: string }> = [
    { label: 'AI Health Score', value: card.score !== null ? `${card.score}` : 'N/A' },
    { label: 'Score Change', value: formatScoreDelta(card.scoreDelta) },
    { label: 'Score Grade', value: getScoreColor(card.score).toUpperCase() },
  ];
  if (card.sovPercent !== null) {
    scoreRows.push({ label: 'AI Mentions (SOV)', value: `${Math.round(card.sovPercent)}%` });
  }
  sections.push({ heading: 'AI Health Summary', rows: scoreRows });

  // Errors section
  const errorRows: Array<{ label: string; value: string }> = [
    { label: 'Errors Fixed This Week', value: `${card.errorsFixed}` },
    { label: 'New Errors This Week', value: `${card.newErrors}` },
  ];
  sections.push({ heading: 'Error Tracking', rows: errorRows });

  // Insights section
  const insightRows: Array<{ label: string; value: string }> = [];
  if (card.topWin) insightRows.push({ label: 'Top Win', value: card.topWin });
  if (card.topIssue) insightRows.push({ label: 'Top Issue', value: card.topIssue });
  if (card.competitorHighlight) insightRows.push({ label: 'Competitor', value: card.competitorHighlight });
  if (card.nextAction) insightRows.push({ label: 'Recommended Action', value: card.nextAction });
  if (insightRows.length > 0) {
    sections.push({ heading: 'Key Insights', rows: insightRows });
  }

  // Additional metrics
  if (additionalMetrics) {
    const extraRows: Array<{ label: string; value: string }> = [];
    if (additionalMetrics.napScore !== null && additionalMetrics.napScore !== undefined) {
      extraRows.push({ label: 'NAP Health Score', value: `${additionalMetrics.napScore}/100` });
    }
    if (additionalMetrics.totalQueries !== null && additionalMetrics.totalQueries !== undefined) {
      extraRows.push({ label: 'Tracked Queries', value: `${additionalMetrics.totalQueries}` });
    }
    if (additionalMetrics.consistencyScore !== null && additionalMetrics.consistencyScore !== undefined) {
      extraRows.push({ label: 'Consistency Score', value: `${additionalMetrics.consistencyScore}/100` });
    }
    if (extraRows.length > 0) {
      sections.push({ heading: 'Additional Metrics', rows: extraRows });
    }
  }

  return {
    title: `AI Health Report — ${businessName}`,
    generatedAt: now.toISOString(),
    sections,
  };
}

/**
 * Converts an ExportableReport to plain text.
 */
export function exportReportAsText(report: ExportableReport): string {
  const lines: string[] = [];
  lines.push(report.title);
  lines.push(`Generated: ${new Date(report.generatedAt).toLocaleDateString()}`);
  lines.push('');

  for (const section of report.sections) {
    lines.push(`--- ${section.heading} ---`);
    for (const row of section.rows) {
      lines.push(`  ${row.label}: ${row.value}`);
    }
    lines.push('');
  }

  lines.push('Powered by LocalVector.ai');
  return lines.join('\n');
}

/**
 * Converts an ExportableReport to CSV.
 */
export function exportReportAsCSV(report: ExportableReport): string {
  const rows: string[] = [];
  rows.push('Section,Metric,Value');

  for (const section of report.sections) {
    for (const row of section.rows) {
      const escapedValue = row.value.includes(',') ? `"${row.value}"` : row.value;
      rows.push(`${section.heading},${row.label},${escapedValue}`);
    }
  }

  return rows.join('\n');
}
