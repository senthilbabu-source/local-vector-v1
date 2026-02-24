// ---------------------------------------------------------------------------
// html-parser.test.ts — Unit tests for lib/page-audit/html-parser
//
// Pure unit tests — no mocks needed, just HTML string → parsed output.
//
// Run:
//   npx vitest run src/__tests__/unit/html-parser.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { parsePage } from '@/lib/page-audit/html-parser';

describe('parsePage', () => {
  it('extracts visible text stripping nav, footer, scripts', () => {
    const html = `
      <html>
        <head><title>Test Page</title></head>
        <body>
          <nav><a href="/">Home</a><a href="/menu">Menu</a></nav>
          <main><p>Charcoal N Chill is Alpharetta's premier hookah lounge.</p></main>
          <footer><p>Copyright 2024</p></footer>
          <script>var x = 1;</script>
        </body>
      </html>
    `;

    const result = parsePage(html);

    expect(result.visibleText).toContain('Charcoal N Chill');
    expect(result.visibleText).toContain('hookah lounge');
    // Nav and footer should be stripped
    expect(result.visibleText).not.toContain('Copyright 2024');
  });

  it('extracts title, h1, and meta description', () => {
    const html = `
      <html>
        <head>
          <title>Charcoal N Chill — Hookah &amp; Dining</title>
          <meta name="description" content="Premium hookah and Indo-American fusion in Alpharetta GA">
        </head>
        <body><h1>Welcome to Charcoal N Chill</h1><p>Content here</p></body>
      </html>
    `;

    const result = parsePage(html);

    expect(result.title).toBe('Charcoal N Chill — Hookah & Dining');
    expect(result.h1).toBe('Welcome to Charcoal N Chill');
    expect(result.metaDescription).toBe('Premium hookah and Indo-American fusion in Alpharetta GA');
  });

  it('extracts JSON-LD blocks from script tags', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Restaurant",
              "name": "Charcoal N Chill",
              "address": { "@type": "PostalAddress", "addressLocality": "Alpharetta" }
            }
          </script>
        </head>
        <body><p>Content</p></body>
      </html>
    `;

    const result = parsePage(html);

    expect(result.jsonLdBlocks).toHaveLength(1);
    expect(result.jsonLdBlocks[0]['@type']).toBe('Restaurant');
    expect(result.jsonLdBlocks[0]['name']).toBe('Charcoal N Chill');
  });

  it('handles @graph pattern in JSON-LD', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@graph": [
                { "@type": "Restaurant", "name": "Charcoal N Chill" },
                { "@type": "FAQPage", "mainEntity": [] }
              ]
            }
          </script>
        </head>
        <body><p>Content</p></body>
      </html>
    `;

    const result = parsePage(html);

    // Should have the wrapper + 2 @graph items
    expect(result.jsonLdBlocks.length).toBeGreaterThanOrEqual(2);
    const types = result.jsonLdBlocks.map((b) => b['@type']);
    expect(types).toContain('Restaurant');
    expect(types).toContain('FAQPage');
  });

  it('silently skips malformed JSON-LD', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">{ this is not valid json }</script>
          <script type="application/ld+json">{"@type": "Restaurant", "name": "Valid"}</script>
        </head>
        <body><p>Content</p></body>
      </html>
    `;

    const result = parsePage(html);

    expect(result.jsonLdBlocks).toHaveLength(1);
    expect(result.jsonLdBlocks[0]['name']).toBe('Valid');
  });

  it('extracts openingText as first 150 words', () => {
    const words = Array.from({ length: 200 }, (_, i) => `word${i}`);
    const html = `<html><body><p>${words.join(' ')}</p></body></html>`;

    const result = parsePage(html);

    const openingWords = result.openingText.split(/\s+/);
    expect(openingWords.length).toBeLessThanOrEqual(150);
    expect(result.openingText).toContain('word0');
    expect(result.openingText).toContain('word149');
  });

  it('handles empty/minimal HTML gracefully', () => {
    const html = '<html><body></body></html>';
    const result = parsePage(html);

    expect(result.visibleText).toBe('');
    expect(result.openingText).toBe('');
    expect(result.jsonLdBlocks).toEqual([]);
    expect(result.title).toBe('');
    expect(result.h1).toBe('');
  });

  it('removes elements with aria-hidden="true"', () => {
    const html = `
      <html><body>
        <div aria-hidden="true">Screen reader hidden content</div>
        <main><p>Visible content here</p></main>
      </body></html>
    `;

    const result = parsePage(html);

    expect(result.visibleText).not.toContain('Screen reader hidden');
    expect(result.visibleText).toContain('Visible content here');
  });
});
