// ---------------------------------------------------------------------------
// lib/schema-expansion/website-crawler.ts — Website Crawler for Schema Expansion
//
// Sprint 106: Discovers pages on a client's website, classifies each by type,
// and extracts content for schema generation.
//
// Strategy:
//   1. Fetch sitemap.xml → extract <loc> URLs
//   2. Fall back to homepage link extraction if no sitemap
//   3. Deduplicate, filter same-origin, cap by plan tier
//   4. Parse each page with cheerio (reuses lib/page-audit/html-parser)
//   5. Classify page type via heuristic + LLM fallback
//
// NEVER throws — returns partial results on error.
// ---------------------------------------------------------------------------

import * as cheerio from 'cheerio';
import * as Sentry from '@sentry/nextjs';
import { parsePage } from '@/lib/page-audit/html-parser';
import type {
  CrawledPage,
  CrawlResult,
  PageType,
  FAQ,
  EventData,
} from './types';
import { MAX_PAGES_PER_PLAN } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CRAWL_USER_AGENT = 'LocalVector-CrawlerBot/1.0 (+https://localvector.ai/bot)';
const PAGE_FETCH_TIMEOUT_MS = 10_000;
const MAX_FAQS_PER_PAGE = 10;
const MAX_EVENTS_PER_PAGE = 20;
const DELAY_BETWEEN_FETCHES_MS = 500;

const COMMON_PATHS = [
  '/about', '/about-us',
  '/faq', '/frequently-asked-questions', '/questions',
  '/events', '/event',
  '/blog',
  '/services', '/service',
  '/contact', '/contact-us',
  '/hours',
  '/reservations', '/reserve',
  '/menu',
];

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Crawl a website to discover pages for schema generation.
 * Never throws — returns partial results on error.
 */
export async function crawlWebsite(
  websiteUrl: string,
  planTier: string,
): Promise<CrawlResult> {
  const maxPages = MAX_PAGES_PER_PLAN[planTier] ?? MAX_PAGES_PER_PLAN.starter;
  let baseUrl: string;

  try {
    baseUrl = normalizeBaseUrl(websiteUrl);
  } catch (_e) {
    return { pages: [], sitemap_found: false, robots_respected: false };
  }

  // 1. Respect robots.txt
  const disallowed = await fetchRobotsTxt(baseUrl);
  const robotsRespected = true;

  // 2. Discover URLs via sitemap or link extraction
  let urls: string[] = [];
  let sitemapFound = false;

  const sitemapUrls = await parseSitemap(`${baseUrl}/sitemap.xml`);
  if (sitemapUrls.length > 0) {
    sitemapFound = true;
    urls = sitemapUrls;
  }

  if (!sitemapFound) {
    const indexUrls = await parseSitemap(`${baseUrl}/sitemap_index.xml`);
    if (indexUrls.length > 0) {
      sitemapFound = true;
      urls = indexUrls;
    }
  }

  if (!sitemapFound) {
    // Fall back: homepage + common paths
    urls = [baseUrl, ...COMMON_PATHS.map((p) => `${baseUrl}${p}`)];
  }

  // 3. Deduplicate, filter same-origin, strip query/fragment
  const origin = new URL(baseUrl).origin;
  const seen = new Set<string>();
  const cleanUrls: string[] = [];

  for (const raw of urls) {
    const clean = cleanUrl(raw, origin);
    if (!clean) continue;
    if (seen.has(clean)) continue;
    if (isDisallowed(clean, origin, disallowed)) continue;
    seen.add(clean);
    cleanUrls.push(clean);
    if (cleanUrls.length >= maxPages) break;
  }

  // 4. Crawl each page
  const pages: CrawledPage[] = [];
  for (const url of cleanUrls) {
    const page = await crawlSinglePage(url);
    pages.push(page);
    // Rate limiting between fetches
    if (cleanUrls.indexOf(url) < cleanUrls.length - 1) {
      await delay(DELAY_BETWEEN_FETCHES_MS);
    }
  }

  return { pages, sitemap_found: sitemapFound, robots_respected: robotsRespected };
}

// ---------------------------------------------------------------------------
// Page Classification
// ---------------------------------------------------------------------------

/**
 * Classify a page's type from URL path + content signals.
 * Heuristic first. Falls back to LLM if confidence < 0.7.
 */
export async function classifyPageType(
  url: string,
  title: string | null,
  bodyExcerpt: string,
): Promise<{ type: PageType; confidence: number; method: 'heuristic' | 'llm' }> {
  const heuristic = classifyByHeuristic(url, title);
  if (heuristic.confidence >= 0.7) {
    return { ...heuristic, method: 'heuristic' };
  }

  // LLM fallback for ambiguous pages
  try {
    const { hasApiKey } = await import('@/lib/ai/providers');
    if (!hasApiKey('openai')) {
      return { ...heuristic, method: 'heuristic' };
    }

    const { generateText } = await import('ai');
    const { getModel } = await import('@/lib/ai/providers');

    const result = await generateText({
      model: getModel('greed-intercept'),
      prompt: `Classify this web page into exactly one category.

URL: ${url}
Title: ${title ?? 'Unknown'}
Content preview: ${bodyExcerpt.slice(0, 500)}

Categories: homepage, about, faq, event, blog_post, service, menu, other

Respond with ONLY the category name, nothing else.`,
      maxTokens: 20,
    });

    const classified = result.text.trim().toLowerCase() as PageType;
    const validTypes: PageType[] = ['homepage', 'about', 'faq', 'event', 'blog_post', 'service', 'menu', 'other'];
    if (validTypes.includes(classified)) {
      return { type: classified, confidence: 0.8, method: 'llm' };
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'website-crawler', sprint: '106' },
    });
  }

  return { ...heuristic, method: 'heuristic' };
}

/**
 * Classify page type by URL path and title heuristics.
 */
export function classifyByHeuristic(
  url: string,
  title: string | null,
): { type: PageType; confidence: number } {
  let path: string;
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch (_e) {
    return { type: 'other', confidence: 0.3 };
  }

  // Homepage detection
  if (path === '/' || path === '' || path === '/index.html' || path === '/index.htm') {
    return { type: 'homepage', confidence: 1.0 };
  }

  // Menu — Magic Engine handles these, skip
  if (path.match(/\/menu($|\/|\?)/)) {
    return { type: 'menu', confidence: 0.9 };
  }

  // FAQ
  if (path.match(/\/faq($|\/|\?)/) || path.includes('/frequently-asked') || path.includes('/questions')) {
    return { type: 'faq', confidence: 0.9 };
  }

  // About
  if (path.match(/\/about($|\/|-|\?)/) || path.includes('/about-us')) {
    return { type: 'about', confidence: 0.9 };
  }

  // Events
  if (path.match(/\/events?($|\/|\?)/) || path.includes('/event/')) {
    return { type: 'event', confidence: 0.9 };
  }

  // Blog
  if (path.match(/\/blog($|\/|\?)/) || path.includes('/post/') || path.includes('/article/')) {
    return { type: 'blog_post', confidence: 0.85 };
  }

  // Service
  if (path.match(/\/services?($|\/|\?)/) || path.includes('/hookah') || path.includes('/catering') || path.includes('/private-events') || path.includes('/vip')) {
    return { type: 'service', confidence: 0.85 };
  }

  // Title-based fallback
  const lowerTitle = (title ?? '').toLowerCase();
  if (lowerTitle.includes('faq') || lowerTitle.includes('frequently asked')) {
    return { type: 'faq', confidence: 0.7 };
  }
  if (lowerTitle.includes('about us') || lowerTitle.includes('our story')) {
    return { type: 'about', confidence: 0.7 };
  }
  if (lowerTitle.includes('event')) {
    return { type: 'event', confidence: 0.6 };
  }

  return { type: 'other', confidence: 0.5 };
}

// ---------------------------------------------------------------------------
// FAQ Extraction
// ---------------------------------------------------------------------------

/**
 * Extract FAQ Q&A pairs from page content.
 * Looks for common patterns: Q:/A:, Question:/Answer:, h3+p, details/summary.
 */
export function extractFAQs(bodyText: string, htmlContent: string): FAQ[] {
  const faqs: FAQ[] = [];

  // Pattern 1: "Q: ...\nA: ..." or "Question: ...\nAnswer: ..."
  const qaPattern = /(?:Q|Question)\s*[:.]\s*(.+?)[\n\r]+\s*(?:A|Answer)\s*[:.]\s*(.+?)(?=(?:\n\s*(?:Q|Question)\s*[:.])|$)/gi;
  let match = qaPattern.exec(bodyText);
  while (match && faqs.length < MAX_FAQS_PER_PAGE) {
    const question = decodeHtmlEntities(match[1].trim());
    const answer = decodeHtmlEntities(match[2].trim());
    if (question && answer) {
      faqs.push({ question, answer });
    }
    match = qaPattern.exec(bodyText);
  }

  if (faqs.length >= MAX_FAQS_PER_PAGE) return faqs.slice(0, MAX_FAQS_PER_PAGE);

  // Pattern 2: h3/h4 headings followed by paragraph (HTML parsing)
  try {
    const $ = cheerio.load(htmlContent);
    $('h3, h4').each((_, el) => {
      if (faqs.length >= MAX_FAQS_PER_PAGE) return;
      const heading = $(el).text().trim();
      if (!heading || !heading.includes('?')) return;
      const nextP = $(el).next('p').text().trim();
      if (nextP && nextP.length > 10) {
        faqs.push({ question: decodeHtmlEntities(heading), answer: decodeHtmlEntities(nextP) });
      }
    });

    // Pattern 3: <details>/<summary> accordion pattern
    $('details').each((_, el) => {
      if (faqs.length >= MAX_FAQS_PER_PAGE) return;
      const summary = $(el).find('summary').text().trim();
      const content = $(el).clone().find('summary').remove().end().text().trim();
      if (summary && content && content.length > 10) {
        faqs.push({ question: decodeHtmlEntities(summary), answer: decodeHtmlEntities(content) });
      }
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'faq-extractor', sprint: '106' } });
  }

  return faqs.slice(0, MAX_FAQS_PER_PAGE);
}

// ---------------------------------------------------------------------------
// Event Data Extraction
// ---------------------------------------------------------------------------

/**
 * Extract event data from page content.
 * Looks for date strings near headings, Schema.org Event microdata.
 */
export function extractEventData(bodyText: string, htmlContent: string): EventData[] {
  const events: EventData[] = [];

  // Pattern 1: ISO date "2026-03-15" near headings
  const isoDatePattern = /(\d{4}-\d{2}-\d{2})/g;
  const usDatePattern = /((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4})/gi;

  // Extract heading + date pairs from HTML
  try {
    const $ = cheerio.load(htmlContent);
    $('h2, h3, h4').each((_, el) => {
      if (events.length >= MAX_EVENTS_PER_PAGE) return;
      const heading = $(el).text().trim();
      if (!heading) return;

      // Check for date in next sibling content
      const nextText = $(el).nextAll().slice(0, 3).text();
      const isoMatch = isoDatePattern.exec(nextText);
      const usMatch = usDatePattern.exec(nextText);

      const startDate = isoMatch?.[1] ?? usMatch?.[1];
      const description = $(el).next('p').text().trim() || undefined;

      events.push({
        name: heading,
        startDate,
        description,
      });

      // Reset regex lastIndex
      isoDatePattern.lastIndex = 0;
      usDatePattern.lastIndex = 0;
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'event-extractor', sprint: '106' } });
  }

  // Pattern 2: Recurring pattern detection ("every Friday", "weekly")
  if (events.length === 0) {
    const recurringPattern = /(?:every|weekly|daily)\s+(\w+)(?:\s*[:-]\s*(.+?))?(?:\.|$)/gi;
    let match = recurringPattern.exec(bodyText);
    while (match && events.length < MAX_EVENTS_PER_PAGE) {
      events.push({
        name: match[2]?.trim() || `Weekly ${match[1]}`,
        description: match[0].trim(),
      });
      match = recurringPattern.exec(bodyText);
    }
  }

  return events.slice(0, MAX_EVENTS_PER_PAGE);
}

// ---------------------------------------------------------------------------
// Robots.txt Parser
// ---------------------------------------------------------------------------

/**
 * Fetch and parse robots.txt for a domain.
 * Returns list of disallowed paths for user-agent *.
 */
export async function fetchRobotsTxt(baseUrl: string): Promise<string[]> {
  try {
    const response = await fetch(`${baseUrl}/robots.txt`, {
      headers: { 'User-Agent': CRAWL_USER_AGENT },
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) return [];

    const text = await response.text();
    const disallowed: string[] = [];
    let inWildcard = false;

    for (const line of text.split('\n')) {
      const trimmed = line.trim().toLowerCase();
      if (trimmed.startsWith('user-agent:')) {
        const agent = trimmed.replace('user-agent:', '').trim();
        inWildcard = agent === '*';
      } else if (inWildcard && trimmed.startsWith('disallow:')) {
        const path = trimmed.replace('disallow:', '').trim();
        if (path) disallowed.push(path);
      }
    }

    return disallowed;
  } catch (_e) {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Sitemap Parser
// ---------------------------------------------------------------------------

/**
 * Parse a sitemap.xml and return all <loc> URLs.
 * Handles sitemap index files with max 3 levels of nesting.
 */
export async function parseSitemap(
  sitemapUrl: string,
  depth: number = 0,
): Promise<string[]> {
  if (depth >= 3) return [];

  try {
    const response = await fetch(sitemapUrl, {
      headers: { 'User-Agent': CRAWL_USER_AGENT },
      signal: AbortSignal.timeout(PAGE_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) return [];

    const text = await response.text();
    if (!text.includes('<urlset') && !text.includes('<sitemapindex')) return [];

    const $ = cheerio.load(text, { xml: true });
    const urls: string[] = [];

    // Direct URL entries
    $('url > loc').each((_, el) => {
      const loc = $(el).text().trim();
      if (loc) urls.push(loc);
    });

    // Nested sitemaps (sitemap index)
    const nestedSitemaps: string[] = [];
    $('sitemap > loc').each((_, el) => {
      const loc = $(el).text().trim();
      if (loc) nestedSitemaps.push(loc);
    });

    for (const nested of nestedSitemaps) {
      const nestedUrls = await parseSitemap(nested, depth + 1);
      urls.push(...nestedUrls);
    }

    // Deduplicate
    return [...new Set(urls)];
  } catch (_e) {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

async function crawlSinglePage(url: string): Promise<CrawledPage> {
  const crawledAt = new Date().toISOString();

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': CRAWL_USER_AGENT },
      signal: AbortSignal.timeout(PAGE_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        url,
        page_type: 'other',
        title: null,
        meta_description: null,
        h1: null,
        body_excerpt: '',
        detected_faqs: [],
        detected_events: [],
        crawled_at: crawledAt,
        http_status: response.status,
        error: `HTTP ${response.status}`,
      };
    }

    const html = await response.text();
    const parsed = parsePage(html);

    const classification = await classifyPageType(url, parsed.title, parsed.openingText);
    const detectedFaqs = classification.type === 'faq' ? extractFAQs(parsed.visibleText, html) : [];
    const detectedEvents = classification.type === 'event' ? extractEventData(parsed.visibleText, html) : [];

    return {
      url,
      page_type: classification.type,
      title: parsed.title || null,
      meta_description: parsed.metaDescription || null,
      h1: parsed.h1 || null,
      body_excerpt: parsed.visibleText.slice(0, 2000),
      detected_faqs: detectedFaqs,
      detected_events: detectedEvents,
      crawled_at: crawledAt,
      http_status: response.status,
    };
  } catch (err) {
    const isTimeout = err instanceof DOMException && err.name === 'AbortError';
    return {
      url,
      page_type: 'other',
      title: null,
      meta_description: null,
      h1: null,
      body_excerpt: '',
      detected_faqs: [],
      detected_events: [],
      crawled_at: crawledAt,
      http_status: 0,
      error: isTimeout ? 'Timeout' : (err instanceof Error ? err.message : String(err)),
    };
  }
}

function normalizeBaseUrl(url: string): string {
  let base = url.trim();
  if (!base.startsWith('http')) base = `https://${base}`;
  base = base.replace(/\/+$/, '');
  return base;
}

function cleanUrl(raw: string, origin: string): string | null {
  try {
    const parsed = new URL(raw);
    // Same-origin only
    if (parsed.origin !== origin) return null;
    // Strip query and fragment
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '') || origin;
  } catch (_e) {
    return null;
  }
}

function isDisallowed(url: string, origin: string, disallowed: string[]): boolean {
  try {
    const path = new URL(url).pathname;
    return disallowed.some((d) => path.startsWith(d));
  } catch (_e) {
    return false;
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
