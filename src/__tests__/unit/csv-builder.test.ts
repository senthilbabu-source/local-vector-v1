// ---------------------------------------------------------------------------
// src/__tests__/unit/csv-builder.test.ts — CSV builder pure function tests
//
// Sprint 95 — CSV Export (Gap #73).
// 27 tests. Zero mocks — pure functions only.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  buildHallucinationCSV,
  sanitizeCSVField,
  escapeCSVValue,
} from '@/lib/exports/csv-builder';
import { MOCK_HALLUCINATION_ROWS } from '@/src/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// buildHallucinationCSV
// ---------------------------------------------------------------------------

describe('buildHallucinationCSV', () => {
  it('returns correct CSV header row (8 columns in exact order)', () => {
    const csv = buildHallucinationCSV([]);
    const header = csv.split('\r\n')[0] ?? csv;
    expect(header).toBe(
      'Date,AI Model,Claim,Severity,Expected Truth,Correction Status,Detected At,Occurrences',
    );
  });

  it('produces CRLF line endings (\\r\\n)', () => {
    const csv = buildHallucinationCSV(MOCK_HALLUCINATION_ROWS.slice(0, 1));
    expect(csv).toContain('\r\n');
    // Should not have bare \n without preceding \r
    const lines = csv.split('\r\n');
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it('maps correction_status=open → "Open"', () => {
    const openRow = MOCK_HALLUCINATION_ROWS.find(
      (r) => r.correction_status === 'open',
    )!;
    const csv = buildHallucinationCSV([openRow]);
    const dataLine = csv.split('\r\n')[1]!;
    expect(dataLine).toContain('Open');
  });

  it('maps correction_status=fixed → "Fixed"', () => {
    const fixedRow = MOCK_HALLUCINATION_ROWS.find(
      (r) => r.correction_status === 'fixed',
    )!;
    const csv = buildHallucinationCSV([fixedRow]);
    const dataLine = csv.split('\r\n')[1]!;
    expect(dataLine).toContain('Fixed');
  });

  it('maps severity "high" → "High"', () => {
    const row = MOCK_HALLUCINATION_ROWS.find((r) => r.severity === 'high')!;
    const csv = buildHallucinationCSV([row]);
    const dataLine = csv.split('\r\n')[1]!;
    expect(dataLine).toContain('High');
  });

  it('maps severity "medium" → "Medium"', () => {
    const row = MOCK_HALLUCINATION_ROWS.find((r) => r.severity === 'medium')!;
    const csv = buildHallucinationCSV([row]);
    const dataLine = csv.split('\r\n')[1]!;
    expect(dataLine).toContain('Medium');
  });

  it('maps severity "low" → "Low"', () => {
    const row = MOCK_HALLUCINATION_ROWS.find((r) => r.severity === 'low')!;
    const csv = buildHallucinationCSV([row]);
    const dataLine = csv.split('\r\n')[1]!;
    expect(dataLine).toContain('Low');
  });

  it('maps severity null → "N/A"', () => {
    const row = MOCK_HALLUCINATION_ROWS.find((r) => r.severity === null)!;
    const csv = buildHallucinationCSV([row]);
    const dataLine = csv.split('\r\n')[1]!;
    expect(dataLine).toContain('N/A');
  });

  it('truncates claim_text to 500 chars by default', () => {
    const longRow = {
      ...MOCK_HALLUCINATION_ROWS[0],
      claim_text: 'A'.repeat(600),
    };
    const csv = buildHallucinationCSV([longRow]);
    const dataLine = csv.split('\r\n')[1]!;
    expect(dataLine).not.toContain('A'.repeat(501));
  });

  it('respects custom maxResponseLength option', () => {
    const longRow = {
      ...MOCK_HALLUCINATION_ROWS[0],
      claim_text: 'B'.repeat(200),
    };
    const csv = buildHallucinationCSV([longRow], { maxResponseLength: 50 });
    const dataLine = csv.split('\r\n')[1]!;
    expect(dataLine).not.toContain('B'.repeat(51));
  });

  it('handles empty rows array (returns header only, no trailing CRLF)', () => {
    const csv = buildHallucinationCSV([]);
    expect(csv).not.toContain('\r\n');
    expect(csv.split(',').length).toBe(8); // 8 header columns
  });

  it('produces correct total line count for N input rows (N+1 including header)', () => {
    const csv = buildHallucinationCSV(MOCK_HALLUCINATION_ROWS);
    const lines = csv.split('\r\n');
    // header + N data lines
    expect(lines.length).toBe(MOCK_HALLUCINATION_ROWS.length + 1);
  });
});

// ---------------------------------------------------------------------------
// escapeCSVValue
// ---------------------------------------------------------------------------

describe('escapeCSVValue', () => {
  it('wraps in quotes when value contains a comma', () => {
    expect(escapeCSVValue('hello, world')).toBe('"hello, world"');
  });

  it('wraps in quotes when value contains a double quote', () => {
    expect(escapeCSVValue('say "hi"')).toBe('"say ""hi"""');
  });

  it('doubles internal double quotes: " becomes ""', () => {
    const result = escapeCSVValue('a"b');
    expect(result).toBe('"a""b"');
  });

  it('wraps in quotes when value contains a newline', () => {
    expect(escapeCSVValue('line1\nline2')).toBe('"line1\nline2"');
  });

  it('does NOT wrap plain values that contain no special chars', () => {
    expect(escapeCSVValue('hello world')).toBe('hello world');
  });

  it('returns empty string for null input', () => {
    expect(escapeCSVValue(null)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(escapeCSVValue(undefined)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// sanitizeCSVField — formula injection prevention
// ---------------------------------------------------------------------------

describe('sanitizeCSVField — formula injection prevention', () => {
  it('prefixes with single quote when value starts with "="', () => {
    expect(sanitizeCSVField('=SUM(1,2)')).toBe("'=SUM(1,2)");
  });

  it('prefixes with single quote when value starts with "+"', () => {
    expect(sanitizeCSVField('+cmd')).toBe("'+cmd");
  });

  it('prefixes with single quote when value starts with "-"', () => {
    expect(sanitizeCSVField('-danger')).toBe("'-danger");
  });

  it('prefixes with single quote when value starts with "@"', () => {
    expect(sanitizeCSVField('@inject')).toBe("'@inject");
  });

  it('does NOT prefix normal text starting with a letter', () => {
    expect(sanitizeCSVField('Hello world')).toBe('Hello world');
  });

  it('does NOT prefix normal text starting with a digit', () => {
    expect(sanitizeCSVField('123 Main St')).toBe('123 Main St');
  });

  it('injection-prefixed value is then quoted if it also contains a comma', () => {
    const result = escapeCSVValue('=SUM(1,2)');
    // sanitizeCSVField adds ' prefix → '=SUM(1,2)
    // escapeCSVValue quotes because of comma → "'=SUM(1,2)"
    expect(result).toBe("\"'=SUM(1,2)\"");
  });

  it('MOCK_HALLUCINATION_ROWS[1].claim_text ("=SUM(1,2)") is sanitized correctly', () => {
    const row = MOCK_HALLUCINATION_ROWS[1];
    const csv = buildHallucinationCSV([row]);
    const dataLine = csv.split('\r\n')[1]!;
    // The =SUM should be sanitized with ' prefix and quoted due to comma
    expect(dataLine).toContain("\"'=SUM(1,2)\"");
  });
});
