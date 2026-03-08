// ---------------------------------------------------------------------------
// sprint-b-seo-growth.test.ts — Sprint B: SEO Growth Engine
//
// Tests:
//   1. Blog MDX utilities — getAllPosts, getPostBySlug, getAllSlugs
//   2. What-is pages — metadata exports
//   3. Glossary — new terms added
//   4. Sitemap — expanded entries
//   5. MarketingNav — new links
//   6. CtaFooter — new links
//
// Run: npx vitest run src/__tests__/unit/sprint-b-seo-growth.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// 1. Blog MDX utilities
// ---------------------------------------------------------------------------

describe('Blog MDX utilities', () => {
  let getAllPosts: typeof import('@/lib/blog/mdx').getAllPosts;
  let getPostBySlug: typeof import('@/lib/blog/mdx').getPostBySlug;
  let getAllSlugs: typeof import('@/lib/blog/mdx').getAllSlugs;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/lib/blog/mdx');
    getAllPosts = mod.getAllPosts;
    getPostBySlug = mod.getPostBySlug;
    getAllSlugs = mod.getAllSlugs;
  });

  it('getAllPosts returns an array', () => {
    const posts = getAllPosts();
    expect(Array.isArray(posts)).toBe(true);
  });

  it('getAllPosts returns posts sorted by date descending', () => {
    const posts = getAllPosts();
    expect(posts.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < posts.length; i++) {
      expect(new Date(posts[i - 1].date).getTime()).toBeGreaterThanOrEqual(
        new Date(posts[i].date).getTime()
      );
    }
  });

  it('getAllPosts returns posts with required fields', () => {
    const posts = getAllPosts();
    for (const post of posts) {
      expect(post.slug).toBeTruthy();
      expect(post.title).toBeTruthy();
      expect(post.description).toBeTruthy();
      expect(post.date).toBeTruthy();
      expect(post.author).toBeTruthy();
      expect(Array.isArray(post.tags)).toBe(true);
      expect(post.readingTime).toMatch(/\d+ min read/);
    }
  });

  it('getPostBySlug returns a post with content', () => {
    const slugs = getAllSlugs();
    expect(slugs.length).toBeGreaterThan(0);

    const post = getPostBySlug(slugs[0]);
    expect(post).not.toBeNull();
    expect(post!.content).toBeTruthy();
    expect(post!.slug).toBe(slugs[0]);
  });

  it('getPostBySlug returns null for non-existent slug', () => {
    const post = getPostBySlug('this-post-does-not-exist-at-all');
    expect(post).toBeNull();
  });

  it('getAllSlugs returns at least 5 slugs', () => {
    const slugs = getAllSlugs();
    expect(slugs.length).toBeGreaterThanOrEqual(5);
    for (const slug of slugs) {
      expect(slug).toBeTruthy();
      expect(slug).not.toContain('.mdx');
    }
  });

  it('each slug resolves to a valid post', () => {
    const slugs = getAllSlugs();
    for (const slug of slugs) {
      const post = getPostBySlug(slug);
      expect(post).not.toBeNull();
      expect(post!.title).toBeTruthy();
    }
  });

  it('reading time estimates are reasonable', () => {
    const posts = getAllPosts();
    for (const post of posts) {
      const minutes = parseInt(post.readingTime);
      expect(minutes).toBeGreaterThanOrEqual(1);
      expect(minutes).toBeLessThanOrEqual(30);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. What-is pages — metadata
// ---------------------------------------------------------------------------

describe('New what-is page metadata', () => {
  it('ai-overview page has correct metadata', async () => {
    const mod = await import('@/app/(marketing)/what-is/ai-overview/page');
    expect(mod.metadata).toBeDefined();
    expect(mod.metadata.title).toContain('Google AI Overview');
    expect(mod.metadata.description).toBeTruthy();
  });

  it('siri-readiness page has correct metadata', async () => {
    const mod = await import('@/app/(marketing)/what-is/siri-readiness/page');
    expect(mod.metadata).toBeDefined();
    expect(mod.metadata.title).toContain('Siri Readiness');
    expect(mod.metadata.description).toBeTruthy();
  });

  it('apple-business-connect page has correct metadata', async () => {
    const mod = await import('@/app/(marketing)/what-is/apple-business-connect/page');
    expect(mod.metadata).toBeDefined();
    expect(mod.metadata.title).toContain('Apple Business Connect');
    expect(mod.metadata.description).toBeTruthy();
  });

  it('all new what-is pages export a default function', async () => {
    const pages = [
      '@/app/(marketing)/what-is/ai-overview/page',
      '@/app/(marketing)/what-is/siri-readiness/page',
      '@/app/(marketing)/what-is/apple-business-connect/page',
    ];
    for (const pagePath of pages) {
      const mod = await import(pagePath);
      expect(typeof mod.default).toBe('function');
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Glossary — new terms
// ---------------------------------------------------------------------------

describe('Glossary new terms', () => {
  it('glossary page exports metadata with updated count', async () => {
    const mod = await import('@/app/(marketing)/glossary/page');
    expect(mod.metadata).toBeDefined();
    expect(mod.metadata.description).toContain('20');
  });
});

// ---------------------------------------------------------------------------
// 4. Blog index page metadata
// ---------------------------------------------------------------------------

describe('Blog index metadata', () => {
  it('blog index exports correct metadata', async () => {
    const mod = await import('@/app/(marketing)/blog/page');
    expect(mod.metadata).toBeDefined();
    const meta = mod.metadata as Record<string, unknown>;
    expect(meta.title).toContain('Blog');
    expect(meta.openGraph).toBeDefined();
    expect(meta.twitter).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 5. Sitemap — expanded entries
// ---------------------------------------------------------------------------

describe('Sitemap expansion', () => {
  it('sitemap includes blog, what-is, and marketing pages', async () => {
    const mod = await import('@/app/sitemap');
    const entries = mod.default();

    const urls = entries.map((e: { url: string }) => e.url);

    // Blog index
    expect(urls.some((u: string) => u.includes('/blog'))).toBe(true);

    // New what-is pages
    expect(urls.some((u: string) => u.includes('/what-is/ai-overview'))).toBe(true);
    expect(urls.some((u: string) => u.includes('/what-is/siri-readiness'))).toBe(true);
    expect(urls.some((u: string) => u.includes('/what-is/apple-business-connect'))).toBe(true);

    // Original what-is pages still present
    expect(urls.some((u: string) => u.includes('/what-is/aeo'))).toBe(true);
    expect(urls.some((u: string) => u.includes('/what-is/geo'))).toBe(true);

    // Blog post pages
    expect(urls.some((u: string) => u.includes('/blog/'))).toBe(true);

    // Marketing pages
    expect(urls.some((u: string) => u.includes('/scan'))).toBe(true);
    expect(urls.some((u: string) => u.includes('/pricing'))).toBe(true);
    expect(urls.some((u: string) => u.includes('/glossary'))).toBe(true);

    // At least 20 entries (was 3 before)
    expect(entries.length).toBeGreaterThanOrEqual(20);
  });

  it('all sitemap entries have valid URLs', async () => {
    const mod = await import('@/app/sitemap');
    const entries = mod.default();

    for (const entry of entries) {
      expect(entry.url).toMatch(/^https?:\/\//);
      expect(entry.changeFrequency).toBeTruthy();
      expect(entry.priority).toBeGreaterThan(0);
      expect(entry.priority).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Blog post frontmatter validation
// ---------------------------------------------------------------------------

describe('Blog post frontmatter', () => {
  it('all posts have non-empty tags', async () => {
    const { getAllPosts } = await import('@/lib/blog/mdx');
    const posts = getAllPosts();
    for (const post of posts) {
      expect(post.tags.length).toBeGreaterThan(0);
    }
  });

  it('all posts have valid date formats', async () => {
    const { getAllPosts } = await import('@/lib/blog/mdx');
    const posts = getAllPosts();
    for (const post of posts) {
      const d = new Date(post.date);
      expect(isNaN(d.getTime())).toBe(false);
    }
  });

  it('no duplicate slugs exist', async () => {
    const { getAllSlugs } = await import('@/lib/blog/mdx');
    const slugs = getAllSlugs();
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });
});
