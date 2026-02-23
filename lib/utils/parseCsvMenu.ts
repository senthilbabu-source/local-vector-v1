// ---------------------------------------------------------------------------
// parseCsvMenu.ts — Path 1: LocalVector AEO-Ready CSV parser
//
// SOURCE OF TRUTH: Doc 04b §4
//
// Parses the 6-column LocalVector Gold Standard CSV template into canonical
// MenuExtractedData. Uses PapaParse (already installed: papaparse@^5.5.3).
//
// Confidence is ALWAYS 1.0 — owner-supplied data is canonical ground truth.
//
// Column schema (case-insensitive, spaces normalised to underscores):
//   Category    → item.category
//   Item_Name   → item.name      (required; rows without a name are skipped)
//   Description → item.description
//   Price       → item.price
//   Dietary_Tags→ stored as pipe-separated string on item; mapDietaryTagsToSchemaUris
//                 converts to Schema.org URIs at JSON-LD generation time.
//   Image_URL   → item.image_url (validated — invalid URLs stripped, no crash)
//
// Validation:
//   - Max 500 rows (enforced after header skip)
//   - Returns { data: MenuExtractedData } on success
//   - Returns { error: string } on validation failure
// ---------------------------------------------------------------------------

import Papa from 'papaparse';
import type { MenuExtractedData, MenuExtractedItem } from '@/lib/types/menu';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ParseCsvResult =
  | { data: MenuExtractedData }
  | { error: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalises a CSV header so lookups are case-insensitive and
 * tolerant of spaces vs underscores (e.g. "Item Name" → "item_name").
 */
function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/\s+/g, '_').trim();
}

/** Returns true for a well-formed HTTPS URL. */
function isValidHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// parseLocalVectorCsv
// ---------------------------------------------------------------------------

/**
 * Parses a LocalVector AEO-Ready CSV string into `MenuExtractedData`.
 *
 * All items are assigned `confidence = 1.0` — owner-supplied data is treated
 * as ground truth and auto-approved by the Confidence Triage UI.
 *
 * @param csvText - Raw CSV string from `await file.text()`.
 */
export function parseLocalVectorCsv(csvText: string): ParseCsvResult {
  // ── Parse with PapaParse ─────────────────────────────────────────────────
  const result = Papa.parse<Record<string, string>>(csvText, {
    header:           true,
    skipEmptyLines:   true,
    transformHeader:  normaliseHeader,
    // PapaParse trims values by default (transform: (v) => v.trim())
    transform:        (v: string) => v.trim(),
  });

  // Hard parse errors (e.g., completely malformed file)
  if (result.errors.length > 0 && result.data.length === 0) {
    return { error: 'Could not parse CSV. Please check the file format and try again.' };
  }

  const rows = result.data;

  // ── Row limit ───────────────────────────────────────────────────────────
  if (rows.length > 500) {
    return { error: 'CSV exceeds the 500-item limit. Split into multiple files and re-upload.' };
  }

  if (rows.length === 0) {
    return { error: 'The uploaded CSV appears to be empty. Add at least one item row.' };
  }

  // ── Map rows → MenuExtractedItem ─────────────────────────────────────────
  const items: MenuExtractedItem[] = [];
  const warnings: string[] = [];

  rows.forEach((row, idx) => {
    const name = row['item_name'] ?? '';
    if (!name) {
      // Skip blank-name rows silently (common in templates with empty trailer rows)
      return;
    }

    const imageRaw = row['image_url'] ?? '';
    const image_url =
      imageRaw && isValidHttpsUrl(imageRaw) ? imageRaw : undefined;

    if (imageRaw && !image_url) {
      warnings.push(`Row ${idx + 2}: Image_URL "${imageRaw}" is not a valid HTTPS URL and was ignored.`);
    }

    items.push({
      id:          `csv-lv-${Date.now()}-${idx}`,
      name,
      description: row['description'] || undefined,
      price:       row['price']       || undefined,
      category:    row['category']    || 'Uncategorised',
      // Owner-supplied CSV → canonical ground truth → always auto-approved
      confidence:  1.0,
      image_url,
      // Store raw Dietary_Tags for downstream JSON-LD mapping.
      // The schemaOrg.parsePipeSeparatedTags() function converts this at
      // JSON-LD generation time; we don't store the Schema.org URIs here.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(row['dietary_tags'] && { dietary_tags: row['dietary_tags'] } as any),
    });
  });

  if (items.length === 0) {
    return {
      error: 'No valid items found. Ensure the "Item_Name" column is populated for at least one row.',
    };
  }

  return {
    data: {
      items,
      extracted_at: new Date().toISOString(),
      // source_url is undefined for CSV imports — no external URL
    },
  };
}

// ---------------------------------------------------------------------------
// CSV template generator
// ---------------------------------------------------------------------------

/**
 * Returns the LocalVector Gold Standard CSV template as a plain string.
 * Used by the download template button in the upload UI.
 *
 * Includes a header row and sample rows from the Charcoal N Chill golden tenant.
 */
export function getLocalVectorCsvTemplate(): string {
  return [
    'Category,Item_Name,Description,Price,Dietary_Tags,Image_URL',
    'BBQ Plates,Brisket Plate,"Slow-smoked beef brisket, two sides, cornbread",$22.00,Gluten-Free,',
    'BBQ Plates,Pulled Pork Sandwich,House-smoked pulled pork on brioche with pickles,$14.00,,',
    'Sides,Mac & Cheese,Creamy four-cheese blend baked to order,$8.00,Vegetarian,',
    'Drinks,Sweet Tea,,$4.00,,',
  ].join('\r\n');
}
