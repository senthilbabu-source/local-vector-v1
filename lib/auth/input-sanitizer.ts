// ---------------------------------------------------------------------------
// lib/auth/input-sanitizer.ts — Input Sanitization for Auth Forms (§314)
//
// Pure functions for sanitizing user-facing text inputs:
//   1. Strip HTML tags (prevent XSS in stored names)
//   2. Normalize whitespace (collapse multiple spaces, trim)
//   3. Block control characters
//   4. Validate reasonable character sets for names
//
// All functions are pure — no I/O, no side effects.
// ---------------------------------------------------------------------------

/**
 * Strip all HTML tags from a string.
 * Prevents stored XSS if names are ever rendered without escaping.
 */
export function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Remove ASCII control characters (0x00–0x1F, 0x7F) except common whitespace.
 * Prevents null byte injection and other control char attacks.
 */
export function stripControlChars(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Normalize whitespace: collapse multiple spaces/tabs to single space, trim.
 */
export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

/**
 * Full sanitization pipeline for name fields (full_name, business_name).
 * Applies all sanitization steps in order.
 */
export function sanitizeName(input: string): string {
  let result = input;
  result = stripHtmlTags(result);
  result = stripControlChars(result);
  result = normalizeWhitespace(result);
  return result;
}

/**
 * Check if a name contains suspicious patterns that suggest injection attempts.
 * Returns true if the name looks suspicious.
 */
export function hasSuspiciousPatterns(input: string): boolean {
  // Script injection patterns
  if (/javascript:/i.test(input)) return true;
  if (/on\w+\s*=/i.test(input)) return true;
  // SQL injection patterns
  if (/('|--|;|\bOR\b\s+\b1\b\s*=\s*\b1\b)/i.test(input)) return true;
  // Null byte
  if (input.includes('\x00')) return true;
  return false;
}
