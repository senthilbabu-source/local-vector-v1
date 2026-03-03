// ---------------------------------------------------------------------------
// lib/agent-seo/action-schema-detector.ts — Action Schema Detection
//
// Sprint 126: READ-ONLY audit. Standard User-Agent. Parses JSON-LD action schemas.
// AI_RULES §165: Never masquerade as bot. Never submit forms. Never follow >1 redirect.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import type { DetectedSchemas } from './agent-seo-types';

const STANDARD_UA = 'Mozilla/5.0 (compatible; LocalVector/1.0; +https://localvector.ai/about)';
const LOGIN_PATTERNS = /\/(login|signin|sign-in|auth|account\/login)/i;

const BOOKING_CTA_PATTERNS = /\b(book|reserve|make\s+a?\s*reservation|schedule|appointment|order\s+online|order\s+now|place\s+order)\b/i;

/**
 * Fetch a URL and parse it for action schemas.
 * Returns null on any error (non-HTTPS, timeout, non-200, etc.).
 */
export async function fetchAndParseActionSchemas(url: string): Promise<DetectedSchemas | null> {
  // Non-HTTPS → skip entirely
  if (!url.startsWith('https://')) {
    return null;
  }

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': STANDARD_UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    return parseActionSchemasFromHtml(html, url);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'action-schema-detector', sprint: '126' },
      extra: { url },
    });
    return null;
  }
}

/**
 * PURE function — parse HTML string for action schemas and booking CTAs.
 * Exported for testing.
 */
export function parseActionSchemasFromHtml(html: string, baseUrl: string): DetectedSchemas {
  const result: DetectedSchemas = {
    hasReserveAction: false,
    hasOrderAction: false,
    hasAppointmentAction: false,
    hasBookingCTA: false,
    bookingUrlIsHttps: false,
    bookingUrlNeedsLogin: false,
  };

  // 1. Extract all JSON-LD blocks
  const jsonLdBlocks = extractJsonLdBlocks(html);

  for (const block of jsonLdBlocks) {
    try {
      const schema = JSON.parse(block);
      inspectSchemaForActions(schema, result);
    } catch (_err) {
      // Skip malformed JSON-LD silently
    }
  }

  // 2. Check for booking CTAs in anchors and buttons
  result.hasBookingCTA = detectBookingCTA(html);

  // 3. Determine booking URL safety
  const bookingUrl = result.reserveActionUrl ?? result.orderActionUrl;
  if (bookingUrl) {
    try {
      const url = new URL(bookingUrl, baseUrl);
      result.bookingUrlIsHttps = url.protocol === 'https:';
      result.bookingUrlNeedsLogin = LOGIN_PATTERNS.test(url.pathname);
    } catch (_err) {
      // Invalid URL — leave defaults
    }
  }

  return result;
}

/**
 * Extract JSON-LD script block contents from HTML.
 */
function extractJsonLdBlocks(html: string): string[] {
  const blocks: string[] = [];
  const regex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    if (match[1]?.trim()) {
      blocks.push(match[1].trim());
    }
  }

  return blocks;
}

/**
 * Recursively inspect a schema object for action types.
 */
export function inspectSchemaForActions(
  schema: unknown,
  result: DetectedSchemas,
): void {
  if (!schema || typeof schema !== 'object') return;

  // Handle arrays (e.g., @graph)
  if (Array.isArray(schema)) {
    for (const item of schema) {
      inspectSchemaForActions(item, result);
    }
    return;
  }

  const obj = schema as Record<string, unknown>;

  // Check @type for action types
  const type = obj['@type'];
  const types = Array.isArray(type) ? type : type ? [type] : [];

  for (const t of types) {
    if (t === 'ReserveAction') {
      result.hasReserveAction = true;
      result.reserveActionUrl = extractTargetUrl(obj);
    }
    if (t === 'OrderAction') {
      result.hasOrderAction = true;
      result.orderActionUrl = extractTargetUrl(obj);
    }
    if (t === 'MedicalAppointment' || t === 'BuyAction') {
      result.hasAppointmentAction = true;
    }
  }

  // Check potentialAction array
  if (Array.isArray(obj.potentialAction)) {
    for (const action of obj.potentialAction) {
      inspectSchemaForActions(action, result);
    }
  }

  // Recurse into @graph
  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) {
      inspectSchemaForActions(item, result);
    }
  }
}

/**
 * Extract target URL from an action object.
 */
function extractTargetUrl(action: Record<string, unknown>): string | undefined {
  const target = action.target;
  if (typeof target === 'string') return target;
  if (target && typeof target === 'object') {
    const t = target as Record<string, unknown>;
    if (typeof t.urlTemplate === 'string') return t.urlTemplate;
    if (typeof t.url === 'string') return t.url;
  }
  return undefined;
}

/**
 * Detect booking CTAs in anchor/button text and aria-labels.
 */
function detectBookingCTA(html: string): boolean {
  // Check anchor text and aria-labels
  const anchorRegex = /<a[^>]*>([^<]*)<\/a>/gi;
  const ariaRegex = /aria-label\s*=\s*["']([^"']*)["']/gi;
  const buttonRegex = /<button[^>]*>([^<]*)<\/button>/gi;

  let match: RegExpExecArray | null;

  while ((match = anchorRegex.exec(html)) !== null) {
    if (BOOKING_CTA_PATTERNS.test(match[1])) return true;
  }

  while ((match = ariaRegex.exec(html)) !== null) {
    if (BOOKING_CTA_PATTERNS.test(match[1])) return true;
  }

  while ((match = buttonRegex.exec(html)) !== null) {
    if (BOOKING_CTA_PATTERNS.test(match[1])) return true;
  }

  return false;
}
