// ---------------------------------------------------------------------------
// lib/distribution/content-hasher.ts — Sprint 1: Distribution Engine Core
//
// Pure function: deterministic content hash for menu change detection.
// PURE — no I/O, no side effects.
// ---------------------------------------------------------------------------

import { createHash } from 'crypto';
import type { MenuExtractedItem } from '@/lib/types/menu';

/**
 * Fields stripped before hashing.
 * `confidence` is volatile (changes on re-extraction without menu changes).
 * `image_url` is not relevant for content change detection.
 */
const VOLATILE_FIELDS = new Set(['confidence', 'image_url']);

/**
 * Compute a deterministic SHA-256 hash of menu items.
 *
 * Guarantees:
 * - Same items in any order produce the same hash
 * - Strips volatile fields (confidence, image_url)
 * - Returns 'sha256-{64 hex chars}' format (71 chars total)
 * - Empty items array returns a stable empty hash
 */
export function computeMenuHash(items: MenuExtractedItem[]): string {
  // 1. Strip volatile fields from each item
  const cleaned = items.map((item) => {
    const entry: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(item)) {
      if (!VOLATILE_FIELDS.has(key) && value !== undefined) {
        entry[key] = value;
      }
    }
    return entry;
  });

  // 2. Sort by id for deterministic ordering
  cleaned.sort((a, b) => String(a.id ?? '').localeCompare(String(b.id ?? '')));

  // 3. Deterministic JSON: sort keys within each item
  const canonical = JSON.stringify(
    cleaned.map((item) => {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(item).sort()) {
        sorted[key] = item[key];
      }
      return sorted;
    }),
  );

  // 4. SHA-256 hash
  const hex = createHash('sha256').update(canonical).digest('hex');
  return `sha256-${hex}`;
}
