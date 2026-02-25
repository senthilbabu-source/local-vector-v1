// ---------------------------------------------------------------------------
// lib/autopilot/publish-download.ts — HTML Download Publisher
//
// Generates a self-contained HTML file with embedded JSON-LD for download.
// Uses toJsonLdScript() from lib/schema/types.ts for typed Schema.org output.
//
// Spec: docs/19-AUTOPILOT-ENGINE.md §5.1
// ---------------------------------------------------------------------------

import {
  toJsonLdScript,
  type WithContext,
  type FAQPage,
  type LocalBusiness,
} from '@/lib/schema/types';
import type { ContentDraftRow, AutopilotLocationContext, PublishResult } from '@/lib/types/autopilot';

// ---------------------------------------------------------------------------
// JSON-LD Builders
// ---------------------------------------------------------------------------

/**
 * Builds a typed LocalBusiness JSON-LD object from location data.
 */
export function buildLocalBusinessSchema(
  location: AutopilotLocationContext,
): WithContext<LocalBusiness> {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: location.business_name,
    ...(location.address_line1 && {
      address: {
        '@type': 'PostalAddress',
        streetAddress: location.address_line1,
        ...(location.city && { addressLocality: location.city }),
        ...(location.state && { addressRegion: location.state }),
      },
    }),
    ...(location.phone && { telephone: location.phone }),
    ...(location.website_url && { url: location.website_url }),
  } as WithContext<LocalBusiness>;
}

/**
 * Extracts Q&A pairs from draft content and builds FAQPage schema.
 * Looks for "Q: ..." / "A: ..." patterns.
 * Returns null if no Q&A pairs found.
 */
export function buildFaqSchemaFromContent(
  draftContent: string,
): WithContext<FAQPage> | null {
  const qaPattern = /Q:\s*(.+?)[\n\r]+A:\s*(.+?)(?=\n\n|Q:|$)/g;
  const pairs: Array<{ question: string; answer: string }> = [];

  let match;
  while ((match = qaPattern.exec(draftContent)) !== null) {
    const question = match[1]?.trim();
    const answer = match[2]?.trim();
    if (question && answer) {
      pairs.push({ question, answer });
    }
  }

  if (pairs.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pairs.map((pair) => ({
      '@type': 'Question',
      name: pair.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: pair.answer,
      },
    })),
  } as WithContext<FAQPage>;
}

// ---------------------------------------------------------------------------
// HTML Template
// ---------------------------------------------------------------------------

function contentToHtmlParagraphs(content: string): string {
  return content
    .split(/\n\n+/)
    .map((paragraph) => {
      const trimmed = paragraph.trim();
      if (!trimmed) return '';

      // Q: lines become bold
      if (trimmed.startsWith('Q:')) {
        return `<p><strong>${escapeHtml(trimmed)}</strong></p>`;
      }
      return `<p>${escapeHtml(trimmed)}</p>`;
    })
    .filter(Boolean)
    .join('\n  ');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

/**
 * Generates a downloadable HTML file with JSON-LD schema pre-injected.
 * Returns base64-encoded HTML string in the downloadPayload field.
 */
export async function publishAsDownload(
  draft: ContentDraftRow,
  location: AutopilotLocationContext,
): Promise<PublishResult> {
  // Build JSON-LD
  const localBusinessSchema = buildLocalBusinessSchema(location);
  const localBusinessScript = toJsonLdScript(localBusinessSchema);

  let faqScript = '';
  if (draft.content_type === 'faq_page') {
    const faqSchema = buildFaqSchemaFromContent(draft.draft_content);
    if (faqSchema) {
      faqScript = '\n  ' + toJsonLdScript(faqSchema);
    }
  }

  // Meta description (first 160 chars of content)
  const metaDescription = draft.draft_content
    .replace(/[\n\r]+/g, ' ')
    .slice(0, 160)
    .trim();

  // Build HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(draft.draft_title)}</title>
  <meta name="description" content="${escapeHtml(metaDescription)}">
  ${localBusinessScript}${faqScript}
</head>
<body>
  <h1>${escapeHtml(draft.draft_title)}</h1>
  ${contentToHtmlParagraphs(draft.draft_content)}
</body>
</html>`;

  // Encode as base64
  const downloadPayload = Buffer.from(html, 'utf-8').toString('base64');

  return {
    publishedUrl: null,
    status: 'published',
    downloadPayload,
  };
}
