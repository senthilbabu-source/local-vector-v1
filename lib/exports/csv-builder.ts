// ---------------------------------------------------------------------------
// lib/exports/csv-builder.ts — Pure CSV builder for hallucination exports
//
// Sprint 95 — CSV Export (Gap #73).
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
