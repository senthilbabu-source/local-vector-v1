// ---------------------------------------------------------------------------
// lib/page-audit/html-parser.ts — HTML Content Extraction
//
// Surgery 3: Extracts visible text and JSON-LD schema blocks from HTML.
// Uses cheerio for lightweight, server-side HTML parsing (no browser needed).
//
// Spec: Doc 17 §3.1 — extractVisibleText() and extractJsonLd()
// ---------------------------------------------------------------------------

import * as cheerio from 'cheerio';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedPage {
  /** Visible text content with nav, footer, scripts stripped */
  visibleText: string;
  /** First 150 words of visible text (for Answer-First scoring) */
  openingText: string;
  /** All JSON-LD blocks found in <script type="application/ld+json"> tags */
  jsonLdBlocks: Record<string, unknown>[];
  /** Page title from <title> tag */
  title: string;
  /** H1 text content */
  h1: string;
  /** Meta description */
  metaDescription: string;
}

// ---------------------------------------------------------------------------
// extractVisibleText — Strip nav, footer, scripts, get readable content
// ---------------------------------------------------------------------------

/**
 * Extract visible page text by stripping non-content elements.
 * Follows Doc 17 §3.1: "strip HTML, nav, footer, scripts"
 */
function extractVisibleText(html: string): string {
  const $ = cheerio.load(html);

  // Remove non-content elements
  $('script, style, noscript, iframe, svg, nav, footer, header').remove();
  $('[role="navigation"], [role="banner"], [role="contentinfo"]').remove();
  $('[aria-hidden="true"]').remove();

  // Get text from remaining body content
  const text = $('body').text();

  // Normalize whitespace: collapse multiple spaces/newlines into single space
  return text.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// extractJsonLd — Parse all JSON-LD schema blocks
// ---------------------------------------------------------------------------

/**
 * Extract and parse all <script type="application/ld+json"> blocks.
 * Returns valid parsed objects; silently skips malformed JSON.
 */
function extractJsonLd(html: string): Record<string, unknown>[] {
  const $ = cheerio.load(html);
  const blocks: Record<string, unknown>[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      // Handle both single objects and arrays (@graph pattern)
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object') blocks.push(item);
        }
      } else if (parsed && typeof parsed === 'object') {
        blocks.push(parsed);

        // Also unwrap @graph if present
        if (Array.isArray(parsed['@graph'])) {
          for (const item of parsed['@graph']) {
            if (item && typeof item === 'object') blocks.push(item);
          }
        }
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { file: 'html-parser.ts', sprint: 'A' } });
      // Malformed JSON-LD — skip silently, log in debug
      console.debug('[html-parser] Malformed JSON-LD block, skipping');
    }
  });

  return blocks;
}

// ---------------------------------------------------------------------------
// parsePage — Main export combining all extraction
// ---------------------------------------------------------------------------

/**
 * Parse an HTML string into structured components for AEO auditing.
 *
 * Returns visible text, opening paragraph, JSON-LD blocks, title, h1,
 * and meta description — everything needed by the scoring dimensions.
 */
export function parsePage(html: string): ParsedPage {
  const $ = cheerio.load(html);

  const visibleText = extractVisibleText(html);
  const words = visibleText.split(/\s+/);
  const openingText = words.slice(0, 150).join(' ');

  const title = $('title').text().trim();
  const h1 = $('h1').first().text().trim();
  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() ?? '';

  return {
    visibleText,
    openingText,
    jsonLdBlocks: extractJsonLd(html),
    title,
    h1,
    metaDescription,
  };
}
