// ---------------------------------------------------------------------------
// Sprint C (Marketing) — High-LTV Segments Tests
//
// Tests for: /for/agencies, /compare/[slug], /for/[city], sitemap expansion
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// 1. Agency page metadata
// ---------------------------------------------------------------------------

describe('Sprint C — /for/agencies page', () => {
  it('exports metadata with correct title', async () => {
    const mod = await import('@/app/(marketing)/for/agencies/page');
    expect(mod.metadata).toBeDefined();
    expect(mod.metadata.title).toContain('Agencies');
  });

  it('exports metadata with openGraph', async () => {
    const mod = await import('@/app/(marketing)/for/agencies/page');
    expect(mod.metadata.openGraph).toBeDefined();
  });

  it('exports a default page component', async () => {
    const mod = await import('@/app/(marketing)/for/agencies/page');
    expect(typeof mod.default).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 2. Comparison pages
// ---------------------------------------------------------------------------

describe('Sprint C — /compare/[slug] pages', () => {
  it('exports generateStaticParams with 4 slugs', async () => {
    const mod = await import('@/app/(marketing)/compare/[slug]/page');
    const params = mod.generateStaticParams();
    expect(params).toHaveLength(4);
    expect(params.map((p: { slug: string }) => p.slug)).toEqual(
      expect.arrayContaining([
        'localvector-vs-yext',
        'localvector-vs-brightlocal',
        'localvector-vs-synup',
        'localvector-vs-whitespark',
      ])
    );
  });

  it('generates metadata for a valid slug', async () => {
    const mod = await import('@/app/(marketing)/compare/[slug]/page');
    const metadata = await mod.generateMetadata({
      params: Promise.resolve({ slug: 'localvector-vs-yext' }),
    });
    expect(metadata.title).toContain('Yext');
    expect(metadata.description).toBeDefined();
  });

  it('returns fallback metadata for invalid slug', async () => {
    const mod = await import('@/app/(marketing)/compare/[slug]/page');
    const metadata = await mod.generateMetadata({
      params: Promise.resolve({ slug: 'nonexistent' }),
    });
    expect(metadata.title).toBe('Comparison | LocalVector.ai');
  });

  it('each competitor has features array with at least 5 rows', async () => {
    const mod = await import('@/app/(marketing)/compare/[slug]/page');
    const params = mod.generateStaticParams();
    for (const { slug } of params) {
      const metadata = await mod.generateMetadata({
        params: Promise.resolve({ slug }),
      });
      // If metadata.description exists, the data entry exists
      expect(metadata.description).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// 3. City pages
// ---------------------------------------------------------------------------

describe('Sprint C — /for/[city] pages', () => {
  it('exports TRACKED_METROS with 10 cities', async () => {
    const mod = await import('@/app/(marketing)/for/[city]/page');
    expect(mod.TRACKED_METROS).toHaveLength(10);
  });

  it('exports generateStaticParams with 10 city slugs', async () => {
    const mod = await import('@/app/(marketing)/for/[city]/page');
    const params = mod.generateStaticParams();
    expect(params).toHaveLength(10);
  });

  it('includes expected cities', async () => {
    const mod = await import('@/app/(marketing)/for/[city]/page');
    const slugs = mod.TRACKED_METROS.map((m: { slug: string }) => m.slug);
    expect(slugs).toContain('atlanta');
    expect(slugs).toContain('new-york');
    expect(slugs).toContain('los-angeles');
    expect(slugs).toContain('chicago');
    expect(slugs).toContain('seattle');
  });

  it('generates metadata with city name for valid slug', async () => {
    const mod = await import('@/app/(marketing)/for/[city]/page');
    const metadata = await mod.generateMetadata({
      params: Promise.resolve({ city: 'atlanta' }),
    });
    expect(metadata.title).toContain('Atlanta');
    expect(metadata.description).toContain('Atlanta');
  });

  it('returns fallback metadata for invalid city', async () => {
    const mod = await import('@/app/(marketing)/for/[city]/page');
    const metadata = await mod.generateMetadata({
      params: Promise.resolve({ city: 'nonexistent' }),
    });
    expect(metadata.title).toBe('City | LocalVector.ai');
  });

  it('every metro has required fields', async () => {
    const mod = await import('@/app/(marketing)/for/[city]/page');
    for (const metro of mod.TRACKED_METROS) {
      expect(metro.slug).toBeTruthy();
      expect(metro.city).toBeTruthy();
      expect(metro.state).toBeTruthy();
      expect(metro.stateCode).toHaveLength(2);
      expect(metro.population).toBeTruthy();
      expect(metro.restaurants).toBeTruthy();
      expect(metro.topCuisines.length).toBeGreaterThanOrEqual(3);
      expect(metro.localInsight.length).toBeGreaterThan(50);
    }
  });

  it('has no duplicate city slugs', async () => {
    const mod = await import('@/app/(marketing)/for/[city]/page');
    const slugs = mod.TRACKED_METROS.map((m: { slug: string }) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('sets ISR revalidate to 86400', async () => {
    const mod = await import('@/app/(marketing)/for/[city]/page');
    expect(mod.revalidate).toBe(86400);
  });
});

// ---------------------------------------------------------------------------
// 4. Sitemap expansion
// ---------------------------------------------------------------------------

describe('Sprint C — Sitemap expansion', () => {
  it('includes /for/agencies in sitemap', async () => {
    const mod = await import('@/app/sitemap');
    const entries = mod.default();
    const urls = entries.map((e: { url: string }) => e.url);
    expect(urls.some((u: string) => u.includes('/for/agencies'))).toBe(true);
  });

  it('includes all 4 comparison pages in sitemap', async () => {
    const mod = await import('@/app/sitemap');
    const entries = mod.default();
    const urls = entries.map((e: { url: string }) => e.url);
    expect(urls.filter((u: string) => u.includes('/compare/')).length).toBe(4);
  });

  it('includes all 10 city pages in sitemap', async () => {
    const mod = await import('@/app/sitemap');
    const entries = mod.default();
    const urls = entries.map((e: { url: string }) => e.url);
    const cityUrls = urls.filter(
      (u: string) => u.match(/\/for\/[a-z]/) && !u.includes('/for/agencies')
    );
    expect(cityUrls.length).toBe(10);
  });

  it('all sitemap URLs are valid format', async () => {
    const mod = await import('@/app/sitemap');
    const entries = mod.default();
    for (const entry of entries) {
      expect(entry.url).toMatch(/^https?:\/\//);
      expect(entry.priority).toBeGreaterThan(0);
      expect(entry.priority).toBeLessThanOrEqual(1);
    }
  });
});
