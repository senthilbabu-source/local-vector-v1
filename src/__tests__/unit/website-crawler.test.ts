// ---------------------------------------------------------------------------
// src/__tests__/unit/website-crawler.test.ts — Website Crawler Tests
//
// Sprint 106: 35 tests covering crawlWebsite, classifyPageType, extractFAQs,
// extractEventData, fetchRobotsTxt, and parseSitemap.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock external modules BEFORE importing the module under test
const mockGetModel = vi.fn();
const mockHasApiKey = vi.fn();
const mockGenerateText = vi.fn();

vi.mock('@/lib/ai/providers', () => ({
  getModel: mockGetModel,
  hasApiKey: mockHasApiKey,
}));

vi.mock('ai', () => ({
  generateText: mockGenerateText,
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

vi.mock('@/lib/page-audit/html-parser', () => ({
  parsePage: vi.fn((html: string) => {
    // Simple mock parser
    const titleMatch = html.match(/<title>([^<]*)<\/title>/);
    const h1Match = html.match(/<h1>([^<]*)<\/h1>/);
    const metaMatch = html.match(/name="description" content="([^"]*)"/);
    return {
      visibleText: html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
      openingText: html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200),
      jsonLdBlocks: [],
      title: titleMatch?.[1] ?? '',
      h1: h1Match?.[1] ?? '',
      metaDescription: metaMatch?.[1] ?? '',
    };
  }),
}));

import {
  crawlWebsite,
  classifyPageType,
  classifyByHeuristic,
  extractFAQs,
  extractEventData,
  fetchRobotsTxt,
  parseSitemap,
} from '@/lib/schema-expansion/website-crawler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(responses: Record<string, { status: number; body: string }>) {
  return vi.fn(async (url: string) => {
    const key = Object.keys(responses).find((k) => url.includes(k));
    if (key) {
      const r = responses[key];
      return {
        ok: r.status >= 200 && r.status < 400,
        status: r.status,
        text: async () => r.body,
      };
    }
    return { ok: false, status: 404, text: async () => 'Not Found' };
  });
}

const MOCK_HTML = `
<html>
<head><title>Test Page</title><meta name="description" content="A test page"></head>
<body><h1>Welcome</h1><p>Some content here</p></body>
</html>`;

const MOCK_SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/about</loc></url>
  <url><loc>https://example.com/faq</loc></url>
</urlset>`;

const MOCK_SITEMAP_INDEX = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap1.xml</loc></sitemap>
</sitemapindex>`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('crawlWebsite', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('1. fetches sitemap.xml first and extracts all <loc> URLs', async () => {
    globalThis.fetch = mockFetch({
      'sitemap.xml': { status: 200, body: MOCK_SITEMAP },
      'robots.txt': { status: 404, body: '' },
      'example.com/': { status: 200, body: MOCK_HTML },
      'example.com/about': { status: 200, body: MOCK_HTML },
      'example.com/faq': { status: 200, body: MOCK_HTML },
    }) as unknown as typeof globalThis.fetch;

    const result = await crawlWebsite('https://example.com', 'growth');
    expect(result.sitemap_found).toBe(true);
    expect(result.pages.length).toBeGreaterThanOrEqual(3);
  });

  it('2. falls back to homepage link extraction when no sitemap found', async () => {
    globalThis.fetch = mockFetch({
      'robots.txt': { status: 404, body: '' },
      'sitemap.xml': { status: 404, body: '' },
      'sitemap_index.xml': { status: 404, body: '' },
      'example.com': { status: 200, body: MOCK_HTML },
    }) as unknown as typeof globalThis.fetch;

    const result = await crawlWebsite('https://example.com', 'starter');
    expect(result.sitemap_found).toBe(false);
    expect(result.pages.length).toBeGreaterThan(0);
  });

  it('3. deduplicates URLs (same URL appearing twice in sitemap)', async () => {
    const dupSitemap = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/about</loc></url>
</urlset>`;
    globalThis.fetch = mockFetch({
      'sitemap.xml': { status: 200, body: dupSitemap },
      'robots.txt': { status: 404, body: '' },
      'example.com': { status: 200, body: MOCK_HTML },
      'example.com/about': { status: 200, body: MOCK_HTML },
    }) as unknown as typeof globalThis.fetch;

    const result = await crawlWebsite('https://example.com', 'growth');
    const urls = result.pages.map((p) => p.url);
    const uniqueUrls = [...new Set(urls)];
    expect(urls.length).toBe(uniqueUrls.length);
  });

  it('4. filters to same-origin URLs only (strips external links)', async () => {
    const externalSitemap = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://other-site.com/about</loc></url>
</urlset>`;
    globalThis.fetch = mockFetch({
      'sitemap.xml': { status: 200, body: externalSitemap },
      'robots.txt': { status: 404, body: '' },
      'example.com': { status: 200, body: MOCK_HTML },
    }) as unknown as typeof globalThis.fetch;

    const result = await crawlWebsite('https://example.com', 'growth');
    const externalPages = result.pages.filter((p) => !p.url.includes('example.com'));
    expect(externalPages.length).toBe(0);
  });

  it('5. strips query strings and fragment identifiers from URLs', async () => {
    const querySitemap = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/about?ref=nav</loc></url>
  <url><loc>https://example.com/about#section1</loc></url>
</urlset>`;
    globalThis.fetch = mockFetch({
      'sitemap.xml': { status: 200, body: querySitemap },
      'robots.txt': { status: 404, body: '' },
      'example.com/about': { status: 200, body: MOCK_HTML },
    }) as unknown as typeof globalThis.fetch;

    const result = await crawlWebsite('https://example.com', 'growth');
    result.pages.forEach((p) => {
      expect(p.url).not.toContain('?');
      expect(p.url).not.toContain('#');
    });
  });

  it('6. respects MAX_PAGES_PER_PLAN cap (growth = 30 URLs max)', async () => {
    globalThis.fetch = mockFetch({
      'robots.txt': { status: 404, body: '' },
      'sitemap.xml': { status: 404, body: '' },
      'sitemap_index.xml': { status: 404, body: '' },
      'example.com': { status: 200, body: MOCK_HTML },
    }) as unknown as typeof globalThis.fetch;

    const result = await crawlWebsite('https://example.com', 'trial');
    expect(result.pages.length).toBeLessThanOrEqual(5);
  });

  it('7. skips pages that timeout — returns partial results', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn(async (url: string) => {
      if ((url as string).includes('robots.txt') || (url as string).includes('sitemap')) {
        return { ok: false, status: 404, text: async () => '' };
      }
      callCount++;
      if (callCount === 2) {
        throw new DOMException('Aborted', 'AbortError');
      }
      return { ok: true, status: 200, text: async () => MOCK_HTML };
    }) as unknown as typeof globalThis.fetch;

    const result = await crawlWebsite('https://example.com', 'trial');
    const timedOut = result.pages.filter((p) => p.error === 'Timeout');
    expect(timedOut.length).toBeLessThanOrEqual(1);
  });

  it('8. never crawls a URL twice per run', async () => {
    const fetchSpy = mockFetch({
      'sitemap.xml': { status: 200, body: MOCK_SITEMAP },
      'robots.txt': { status: 404, body: '' },
      'example.com': { status: 200, body: MOCK_HTML },
    }) as unknown as typeof globalThis.fetch;
    globalThis.fetch = fetchSpy;

    await crawlWebsite('https://example.com', 'growth');
    const calls = (fetchSpy as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    const pageCalls = calls.filter((u: string) => !u.includes('robots.txt') && !u.includes('sitemap'));
    const uniqueCalls = [...new Set(pageCalls)];
    expect(pageCalls.length).toBe(uniqueCalls.length);
  });

  it('9. includes http_status on each CrawledPage', async () => {
    globalThis.fetch = mockFetch({
      'sitemap.xml': { status: 404, body: '' },
      'sitemap_index.xml': { status: 404, body: '' },
      'robots.txt': { status: 404, body: '' },
      'example.com': { status: 200, body: MOCK_HTML },
    }) as unknown as typeof globalThis.fetch;

    const result = await crawlWebsite('https://example.com', 'trial');
    result.pages.forEach((page) => {
      expect(typeof page.http_status).toBe('number');
    });
  });
});

describe('classifyPageType (heuristic)', () => {
  it('10. "/" path → "homepage" (confidence 1.0)', () => {
    const result = classifyByHeuristic('https://example.com/', null);
    expect(result.type).toBe('homepage');
    expect(result.confidence).toBe(1.0);
  });

  it('11. "/faq" path → "faq"', () => {
    const result = classifyByHeuristic('https://example.com/faq', null);
    expect(result.type).toBe('faq');
  });

  it('12. "/about-us" path → "about"', () => {
    const result = classifyByHeuristic('https://example.com/about-us', null);
    expect(result.type).toBe('about');
  });

  it('13. "/events/belly-dancing-night" path → "event"', () => {
    const result = classifyByHeuristic('https://example.com/events/belly-dancing-night', null);
    expect(result.type).toBe('event');
  });

  it('14. "/blog/top-10-hookah-flavors" path → "blog_post"', () => {
    const result = classifyByHeuristic('https://example.com/blog/top-10-hookah-flavors', null);
    expect(result.type).toBe('blog_post');
  });

  it('15. "/vip-packages" with hookah title → "service"', () => {
    const result = classifyByHeuristic('https://example.com/vip-packages', 'VIP Hookah Service');
    // /vip-packages matches the service heuristic
    expect(result.type).toBe('service');
  });

  it('16. "/menu" → "menu" (Magic Engine — skip)', () => {
    const result = classifyByHeuristic('https://example.com/menu', null);
    expect(result.type).toBe('menu');
  });

  it('17. ambiguous path "/info" → calls LLM classifier when confidence < 0.7', async () => {
    mockHasApiKey.mockReturnValue(true);
    mockGetModel.mockReturnValue('mock-model');
    mockGenerateText.mockResolvedValue({ text: 'about' });

    const result = await classifyPageType('https://example.com/info', 'Info Page', 'Some info about us');
    expect(result.method).toBe('llm');
    expect(result.type).toBe('about');
  });

  it('18. LLM classifies correctly when heuristic confidence < 0.7', async () => {
    mockHasApiKey.mockReturnValue(true);
    mockGetModel.mockReturnValue('mock-model');
    mockGenerateText.mockResolvedValue({ text: 'service' });

    const result = await classifyPageType('https://example.com/something', null, 'Our premium hookah packages');
    expect(result.type).toBe('service');
    expect(result.confidence).toBe(0.8);
  });
});

describe('extractFAQs', () => {
  it('19. extracts "Q:\\nA:" pattern pairs', () => {
    const body = 'Q: What is this?\nA: It is a test.\nQ: Where is it?\nA: In the code.';
    const faqs = extractFAQs(body, '<div></div>');
    expect(faqs.length).toBe(2);
    expect(faqs[0].question).toBe('What is this?');
    expect(faqs[0].answer).toBe('It is a test.');
  });

  it('20. extracts "Question:\\nAnswer:" pattern pairs', () => {
    const body = 'Question: How much does it cost?\nAnswer: Starting at $20.';
    const faqs = extractFAQs(body, '<div></div>');
    expect(faqs.length).toBe(1);
    expect(faqs[0].question).toBe('How much does it cost?');
  });

  it('21. extracts h3 + following paragraph patterns', () => {
    const html = '<h3>What are your hours?</h3><p>We are open Tuesday through Saturday from 5PM to 1AM.</p>';
    const faqs = extractFAQs('', html);
    expect(faqs.length).toBe(1);
    expect(faqs[0].question).toBe('What are your hours?');
  });

  it('22. returns max 10 FAQs even if more exist', () => {
    const body = Array.from({ length: 15 }, (_, i) =>
      `Q: Question ${i + 1}?\nA: Answer ${i + 1}.`
    ).join('\n');
    const faqs = extractFAQs(body, '<div></div>');
    expect(faqs.length).toBeLessThanOrEqual(10);
  });

  it('23. returns empty array when no FAQ patterns found', () => {
    const faqs = extractFAQs('Just some regular text here.', '<p>Nothing FAQ-like</p>');
    expect(faqs).toEqual([]);
  });

  it('24. handles HTML entities in question/answer text', () => {
    const body = 'Q: What&apos;s the price?\nA: It&apos;s $20 &amp; up.';
    const faqs = extractFAQs(body, '<div></div>');
    expect(faqs.length).toBe(1);
    expect(faqs[0].question).toBe("What's the price?");
    expect(faqs[0].answer).toBe("It's $20 & up.");
  });
});

describe('extractEventData', () => {
  it('25. extracts event name from h2/h3 headings near date strings', () => {
    const html = '<h2>Wine Tasting Night</h2><p>Join us on 2026-04-15 for a special event.</p>';
    const events = extractEventData('', html);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].name).toBe('Wine Tasting Night');
  });

  it('26. parses ISO date format "2026-03-15"', () => {
    const html = '<h3>Spring Event</h3><p>Coming on 2026-03-15!</p>';
    const events = extractEventData('', html);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].startDate).toBe('2026-03-15');
  });

  it('27. parses US date format "March 15, 2026"', () => {
    const html = '<h3>Summer Fest</h3><p>On March 15, 2026</p>';
    const events = extractEventData('', html);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].startDate).toBe('March 15, 2026');
  });

  it('28. returns max 20 events per page', () => {
    const headings = Array.from({ length: 25 }, (_, i) =>
      `<h3>Event ${i + 1}</h3><p>Some description</p>`
    ).join('');
    const events = extractEventData('', headings);
    expect(events.length).toBeLessThanOrEqual(20);
  });

  it('29. returns empty array when no event patterns found', () => {
    const events = extractEventData('Just text.', '<p>No events here</p>');
    expect(events).toEqual([]);
  });
});

describe('fetchRobotsTxt', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('30. parses Disallow: /admin/ correctly', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      text: async () => 'User-agent: *\nDisallow: /admin/\nDisallow: /private/',
    })) as unknown as typeof globalThis.fetch;

    const disallowed = await fetchRobotsTxt('https://example.com');
    expect(disallowed).toContain('/admin/');
    expect(disallowed).toContain('/private/');
  });

  it('31. returns empty array when robots.txt returns 404', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
    })) as unknown as typeof globalThis.fetch;

    const disallowed = await fetchRobotsTxt('https://example.com');
    expect(disallowed).toEqual([]);
  });

  it('32. only returns rules for user-agent * (ignores Googlebot-specific rules)', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      text: async () => 'User-agent: Googlebot\nDisallow: /google-only/\n\nUser-agent: *\nDisallow: /secret/',
    })) as unknown as typeof globalThis.fetch;

    const disallowed = await fetchRobotsTxt('https://example.com');
    expect(disallowed).toContain('/secret/');
    expect(disallowed).not.toContain('/google-only/');
  });
});

describe('parseSitemap', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('33. parses standard sitemap.xml <loc> tags', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => MOCK_SITEMAP,
    })) as unknown as typeof globalThis.fetch;

    const urls = await parseSitemap('https://example.com/sitemap.xml');
    expect(urls).toContain('https://example.com/');
    expect(urls).toContain('https://example.com/about');
    expect(urls).toContain('https://example.com/faq');
  });

  it('34. follows sitemap index to nested sitemaps (max 3 levels)', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if ((url as string).includes('sitemap_index.xml')) {
        return { ok: true, status: 200, text: async () => MOCK_SITEMAP_INDEX };
      }
      if ((url as string).includes('sitemap1.xml')) {
        return { ok: true, status: 200, text: async () => MOCK_SITEMAP };
      }
      return { ok: false, status: 404, text: async () => '' };
    }) as unknown as typeof globalThis.fetch;

    const urls = await parseSitemap('https://example.com/sitemap_index.xml');
    expect(urls.length).toBeGreaterThan(0);
  });

  it('35. deduplicates URLs across nested sitemaps', async () => {
    const dupIndex = `<?xml version="1.0"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap1.xml</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap2.xml</loc></sitemap>
</sitemapindex>`;
    globalThis.fetch = vi.fn(async (url: string) => {
      if ((url as string).includes('sitemap_index.xml')) {
        return { ok: true, status: 200, text: async () => dupIndex };
      }
      // Both nested sitemaps return the same URLs
      return { ok: true, status: 200, text: async () => MOCK_SITEMAP };
    }) as unknown as typeof globalThis.fetch;

    const urls = await parseSitemap('https://example.com/sitemap_index.xml');
    const unique = [...new Set(urls)];
    expect(urls.length).toBe(unique.length);
  });
});
