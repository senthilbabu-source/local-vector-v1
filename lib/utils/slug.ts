/**
 * Converts any string into a URL-safe lowercase slug.
 *
 * Examples:
 *   "Charcoal N Chill"  → "charcoal-n-chill"
 *   "Cloud 9 Lounge!!"  → "cloud-9-lounge"
 *   "  Spaces  "        → "spaces"
 */
export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Returns a slug guaranteed to be unique by appending a compact timestamp
 * suffix. Use when inserting a new row that requires a unique slug column.
 *
 * Example: "charcoal-n-chill-1m3kx9"
 */
export function toUniqueSlug(value: string): string {
  return `${toSlug(value)}-${Date.now().toString(36)}`;
}
