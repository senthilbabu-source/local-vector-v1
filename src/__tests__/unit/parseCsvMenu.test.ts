// ---------------------------------------------------------------------------
// parseCsvMenu.test.ts — Unit tests for Path 1: LocalVector Gold Standard CSV
//
// Tests for parseLocalVectorCsv() and getLocalVectorCsvTemplate().
// Vitest environment: node (no DOM required — PapaParse runs in Node).
//
// Run: npx vitest run src/__tests__/unit/parseCsvMenu.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { parseLocalVectorCsv, getLocalVectorCsvTemplate } from '@/lib/utils/parseCsvMenu';

// Canonical 6-column header row — used across most test cases
const HEADERS = 'Category,Item_Name,Description,Price,Dietary_Tags,Image_URL';

// ---------------------------------------------------------------------------
// parseLocalVectorCsv
// ---------------------------------------------------------------------------

describe('parseLocalVectorCsv', () => {

  // ── Happy paths ───────────────────────────────────────────────────────────

  it('parses a valid 2-item CSV with all columns populated', () => {
    const csv = [
      HEADERS,
      'BBQ Plates,Brisket Plate,"Slow-smoked brisket, two sides",$22.00,Gluten-Free,https://example.com/brisket.jpg',
      'Sides,Mac & Cheese,Creamy cheese mac,$8.00,Vegetarian,',
    ].join('\n');

    const result = parseLocalVectorCsv(csv);

    expect('data' in result).toBe(true);
    if (!('data' in result)) return;

    const { items, extracted_at } = result.data;
    expect(items).toHaveLength(2);

    // First item — all fields present
    const brisket = items[0];
    expect(brisket.name).toBe('Brisket Plate');
    expect(brisket.category).toBe('BBQ Plates');
    expect(brisket.price).toBe('$22.00');
    expect(brisket.description).toBe('Slow-smoked brisket, two sides');
    expect(brisket.image_url).toBe('https://example.com/brisket.jpg');
    expect(brisket.confidence).toBe(1);
    expect(brisket.id).toMatch(/^csv-lv-\d+-0$/);

    // Second item — no Image_URL
    const mac = items[1];
    expect(mac.name).toBe('Mac & Cheese');
    expect(mac.category).toBe('Sides');
    expect(mac.image_url).toBeUndefined();
    expect(mac.id).toMatch(/^csv-lv-\d+-1$/);

    // extracted_at is a valid ISO-8601 timestamp
    expect(typeof extracted_at).toBe('string');
    expect(new Date(extracted_at).toISOString()).toBe(extracted_at);

    // source_url is omitted for CSV imports
    expect(result.data.source_url).toBeUndefined();
  });

  it('assigns confidence = 1.0 to every item (owner-supplied is ground truth)', () => {
    const csv = [HEADERS, 'Drinks,Sweet Tea,,$4.00,,'].join('\n');

    const result = parseLocalVectorCsv(csv);
    if (!('data' in result)) throw new Error('Expected data');

    expect(result.data.items[0].confidence).toBe(1);
  });

  it('defaults category to "Uncategorised" when the Category column is blank', () => {
    const csv = [HEADERS, ',Sweet Tea,,$4.00,,'].join('\n');

    const result = parseLocalVectorCsv(csv);
    if (!('data' in result)) throw new Error('Expected data');

    expect(result.data.items[0].category).toBe('Uncategorised');
  });

  it('stores description as undefined when the column is blank', () => {
    const csv = [HEADERS, 'Drinks,Sweet Tea,,$4.00,,'].join('\n');

    const result = parseLocalVectorCsv(csv);
    if (!('data' in result)) throw new Error('Expected data');

    expect(result.data.items[0].description).toBeUndefined();
  });

  it('stores price as undefined when the Price column is blank', () => {
    const csv = [HEADERS, 'Drinks,Water,,,,' ].join('\n');

    const result = parseLocalVectorCsv(csv);
    if (!('data' in result)) throw new Error('Expected data');

    expect(result.data.items[0].price).toBeUndefined();
  });

  // ── Image_URL validation ──────────────────────────────────────────────────

  it('accepts a valid HTTPS Image_URL', () => {
    const csv = [
      HEADERS,
      'Drinks,Lemonade,,$3.00,,https://cdn.example.com/lemon.jpg',
    ].join('\n');

    const result = parseLocalVectorCsv(csv);
    if (!('data' in result)) throw new Error('Expected data');

    expect(result.data.items[0].image_url).toBe('https://cdn.example.com/lemon.jpg');
  });

  it('strips an invalid (non-URL) Image_URL without crashing', () => {
    const csv = [HEADERS, 'Drinks,Lemonade,,$3.00,,not-a-url'].join('\n');

    const result = parseLocalVectorCsv(csv);
    if (!('data' in result)) throw new Error('Expected data');

    expect(result.data.items[0].image_url).toBeUndefined();
  });

  it('strips an HTTP (non-HTTPS) Image_URL — only HTTPS is accepted', () => {
    const csv = [
      HEADERS,
      'Drinks,Lemonade,,$3.00,,http://example.com/lemon.jpg',
    ].join('\n');

    const result = parseLocalVectorCsv(csv);
    if (!('data' in result)) throw new Error('Expected data');

    expect(result.data.items[0].image_url).toBeUndefined();
  });

  // ── Row filtering ─────────────────────────────────────────────────────────

  it('skips rows with a blank Item_Name silently', () => {
    const csv = [
      HEADERS,
      ',,,,,',          // completely blank — no name
      'Drinks,Tea,,$3.00,,',
    ].join('\n');

    const result = parseLocalVectorCsv(csv);
    if (!('data' in result)) throw new Error('Expected data');

    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0].name).toBe('Tea');
  });

  // ── Header normalisation ──────────────────────────────────────────────────

  it('handles UPPERCASE header names', () => {
    const csv = [
      'CATEGORY,ITEM_NAME,DESCRIPTION,PRICE,DIETARY_TAGS,IMAGE_URL',
      'Drinks,Sweet Tea,,$4.00,,',
    ].join('\n');

    const result = parseLocalVectorCsv(csv);
    if (!('data' in result)) throw new Error('Expected data');

    expect(result.data.items[0].name).toBe('Sweet Tea');
  });

  it('handles header names with spaces instead of underscores', () => {
    const csv = [
      'Category,Item Name,Description,Price,Dietary Tags,Image URL',
      'Drinks,Sweet Tea,,$4.00,,',
    ].join('\n');

    const result = parseLocalVectorCsv(csv);
    if (!('data' in result)) throw new Error('Expected data');

    expect(result.data.items[0].name).toBe('Sweet Tea');
  });

  // ── Error cases ───────────────────────────────────────────────────────────

  it('returns an error for an empty string input (parse error branch)', () => {
    // PapaParse reports errors on a completely empty string (no header, no rows).
    // This hits the hard-parse-error guard: result.errors.length > 0 && data.length === 0
    const result = parseLocalVectorCsv('');

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toMatch(/Could not parse CSV/i);
    }
  });

  it('returns an error for a header-only CSV (empty rows branch)', () => {
    // A valid header row with no data rows → rows.length === 0 → "empty" error
    const result = parseLocalVectorCsv(HEADERS);

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toMatch(/empty/i);
    }
  });

  it('returns an error when all rows have a blank Item_Name', () => {
    const csv = [HEADERS, ',,,,,'].join('\n');

    const result = parseLocalVectorCsv(csv);

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toMatch(/item.?name/i);
    }
  });

  it('returns an error when the CSV exceeds 500 rows', () => {
    const rows = [HEADERS];
    for (let i = 0; i < 501; i++) {
      rows.push(`Drinks,Item ${i},,$3.00,,`);
    }

    const result = parseLocalVectorCsv(rows.join('\n'));

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toMatch(/500/);
    }
  });

  it('accepts exactly 500 rows without error', () => {
    const rows = [HEADERS];
    for (let i = 0; i < 500; i++) {
      rows.push(`Drinks,Item ${i},,$3.00,,`);
    }

    const result = parseLocalVectorCsv(rows.join('\n'));

    expect('data' in result).toBe(true);
    if ('data' in result) {
      expect(result.data.items).toHaveLength(500);
    }
  });
});

// ---------------------------------------------------------------------------
// getLocalVectorCsvTemplate
// ---------------------------------------------------------------------------

describe('getLocalVectorCsvTemplate', () => {
  it('returns a string containing all 6 required column headers', () => {
    const template = getLocalVectorCsvTemplate();

    expect(typeof template).toBe('string');
    expect(template).toContain('Category');
    expect(template).toContain('Item_Name');
    expect(template).toContain('Description');
    expect(template).toContain('Price');
    expect(template).toContain('Dietary_Tags');
    expect(template).toContain('Image_URL');
  });

  it('includes at least one sample data row (not just a header)', () => {
    const template = getLocalVectorCsvTemplate();
    const lines = template.split(/\r?\n/).filter((l) => l.trim());

    expect(lines.length).toBeGreaterThan(1);
  });

  it('is a parseable CSV that produces items with confidence = 1.0', () => {
    const template = getLocalVectorCsvTemplate();
    const result = parseLocalVectorCsv(template);

    if (!('data' in result)) throw new Error('Template CSV must be parseable');

    result.data.items.forEach((item) => {
      expect(item.confidence).toBe(1);
    });
  });

  it('produces at least one item with a non-blank name', () => {
    const template = getLocalVectorCsvTemplate();
    const result = parseLocalVectorCsv(template);

    if (!('data' in result)) throw new Error('Template CSV must be parseable');
    expect(result.data.items.length).toBeGreaterThan(0);
  });
});
