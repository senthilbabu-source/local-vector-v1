// ---------------------------------------------------------------------------
// lib/exports/csv-builder.ts — Pure CSV builders for hallucination + draft exports
//
// Sprint 95 — CSV Export (Gap #73).
// Sprint §205 — Content Drafts CSV Export.
// RFC 4180 compliant (CRLF line endings). Formula injection prevention.
// Pure functions — no I/O, no side effects, zero mocks needed in tests.
// ---------------------------------------------------------------------------

import type { Database } from '@/lib/supabase/database.types';

export type HallucinationAuditRow =
  Database['public']['Tables']['ai_hallucinations']['Row'];

// ---------------------------------------------------------------------------
// CSV sanitization — prevents formula injection in Excel / Google Sheets
// ---------------------------------------------------------------------------

/**
 * Prefix dangerous first characters with a single quote to prevent
 * formula injection when the CSV is opened in a spreadsheet.
 */
export function sanitizeCSVField(value: string): string {
  const dangerous = ['=', '+', '-', '@', '\t', '\r'];
  if (dangerous.some((char) => value.startsWith(char))) {
    return `'${value}`;
  }
  return value;
}

/**
 * RFC 4180 — escape a CSV value. Wraps in double quotes when needed,
 * doubles internal double quotes. Returns '' for null/undefined.
 */
export function escapeCSVValue(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const sanitized = sanitizeCSVField(String(value));
  if (
    sanitized.includes(',') ||
    sanitized.includes('"') ||
    sanitized.includes('\n')
  ) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

// ---------------------------------------------------------------------------
// Label helpers
// ---------------------------------------------------------------------------

function riskLevelLabel(level: string | null): string {
  if (!level) return 'N/A';
  const map: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };
  return map[level] ?? level;
}

const MODEL_LABELS: Record<string, string> = {
  'openai-gpt4o': 'OpenAI GPT-4o',
  'perplexity-sonar': 'Perplexity Sonar',
  'google-gemini': 'Google Gemini',
  'anthropic-claude': 'Anthropic Claude',
  'microsoft-copilot': 'Microsoft Copilot',
  'openai-gpt4o-mini': 'OpenAI GPT-4o Mini',
};

function modelLabel(provider: string): string {
  return MODEL_LABELS[provider] ?? provider;
}

// Map correction_status → CSV-friendly labels
function statusLabel(status: string | null): string {
  if (!status) return '-';
  const map: Record<string, string> = {
    open: 'Open',
    verifying: 'Verifying',
    fixed: 'Fixed',
    dismissed: 'Dismissed',
    recurring: 'Recurring',
  };
  return map[status] ?? status;
}

// ---------------------------------------------------------------------------
// CSV builder
// ---------------------------------------------------------------------------

const CSV_HEADERS = [
  'Date',
  'AI Model',
  'Claim',
  'Severity',
  'Expected Truth',
  'Correction Status',
  'Detected At',
  'Occurrences',
];

/**
 * Build a CSV string from hallucination audit rows.
 * RFC 4180 compliant with CRLF line endings.
 */
export function buildHallucinationCSV(
  rows: HallucinationAuditRow[],
  options?: { maxResponseLength?: number },
): string {
  const maxLen = options?.maxResponseLength ?? 500;

  const headerLine = CSV_HEADERS.join(',');

  if (rows.length === 0) {
    return headerLine;
  }

  const dataLines = rows.map((row) => {
    const claimText = row.claim_text
      ? row.claim_text.length > maxLen
        ? row.claim_text.slice(0, maxLen)
        : row.claim_text
      : '';

    return [
      escapeCSVValue(row.created_at),
      escapeCSVValue(modelLabel(row.model_provider)),
      escapeCSVValue(claimText),
      escapeCSVValue(riskLevelLabel(row.severity)),
      escapeCSVValue(
        row.expected_truth
          ? row.expected_truth.length > maxLen
            ? row.expected_truth.slice(0, maxLen)
            : row.expected_truth
          : null,
      ),
      escapeCSVValue(statusLabel(row.correction_status)),
      escapeCSVValue(row.detected_at),
      escapeCSVValue(String(row.occurrence_count ?? 1)),
    ].join(',');
  });

  return headerLine + '\r\n' + dataLines.join('\r\n');
}

// ---------------------------------------------------------------------------
// Content Drafts CSV export (§205)
// ---------------------------------------------------------------------------

export interface ContentDraftExportRow {
  id: string;
  draft_title: string;
  draft_content: string;
  status: string;
  content_type: string;
  trigger_type: string;
  aeo_score: number | null;
  target_prompt: string | null;
  created_at: string;
}

const DRAFT_CSV_HEADERS = [
  'Title',
  'Content',
  'Status',
  'Type',
  'Trigger',
  'AEO Score',
  'Target Prompt',
  'Created',
];

const DRAFT_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  approved: 'Approved',
  published: 'Published',
  rejected: 'Rejected',
  archived: 'Archived',
};

const DRAFT_TYPE_LABELS: Record<string, string> = {
  faq_page: 'FAQ Page',
  occasion_page: 'Occasion Page',
  blog_post: 'Blog Post',
  landing_page: 'Landing Page',
  gbp_post: 'GBP Post',
};

const DRAFT_TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manual',
  occasion: 'Occasion',
  first_mover: 'First Mover',
  prompt_missing: 'Prompt Gap',
  competitor_gap: 'Competitor Gap',
  review_gap: 'Review Gap',
  schema_gap: 'Schema Gap',
  hallucination_correction: 'Hallucination Fix',
};

/**
 * Build a CSV string from content draft rows.
 * RFC 4180 compliant with CRLF line endings.
 * draft_content is truncated at maxContentLength (default 500) to prevent
 * runaway file sizes.
 */
export function buildContentDraftsCSV(
  rows: ContentDraftExportRow[],
  options?: { maxContentLength?: number },
): string {
  const maxLen = options?.maxContentLength ?? 500;
  const headerLine = DRAFT_CSV_HEADERS.join(',');

  if (rows.length === 0) {
    return headerLine;
  }

  const dataLines = rows.map((row) => {
    const content = row.draft_content.length > maxLen
      ? row.draft_content.slice(0, maxLen)
      : row.draft_content;

    return [
      escapeCSVValue(row.draft_title),
      escapeCSVValue(content),
      escapeCSVValue(DRAFT_STATUS_LABELS[row.status] ?? row.status),
      escapeCSVValue(DRAFT_TYPE_LABELS[row.content_type] ?? row.content_type),
      escapeCSVValue(DRAFT_TRIGGER_LABELS[row.trigger_type] ?? row.trigger_type),
      escapeCSVValue(row.aeo_score !== null ? String(row.aeo_score) : 'N/A'),
      escapeCSVValue(row.target_prompt),
      escapeCSVValue(row.created_at),
    ].join(',');
  });

  return headerLine + '\r\n' + dataLines.join('\r\n');
}
