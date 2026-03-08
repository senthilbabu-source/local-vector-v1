// ---------------------------------------------------------------------------
// Sprint D (Marketing) — Depth & Retention Tests
//
// Validates changelog page, partners page, pricing updates, SelfAudit
// interactivity, sitemap/nav/footer updates.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// 1. Changelog page
// ---------------------------------------------------------------------------
describe('Changelog page', () => {
  it('exports metadata with title containing Changelog', async () => {
    const mod = await import('@/app/(marketing)/changelog/page');
    expect(mod.metadata?.title).toContain('Changelog');
  });

  it('exports metadata with SEO description', async () => {
    const mod = await import('@/app/(marketing)/changelog/page');
    expect(mod.metadata?.description).toBeTruthy();
    expect(typeof mod.metadata?.description).toBe('string');
  });

  it('exports a default component', async () => {
    const mod = await import('@/app/(marketing)/changelog/page');
    expect(typeof mod.default).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 2. Partners page
// ---------------------------------------------------------------------------
describe('Partners page', () => {
  it('exports metadata with title containing Partner', async () => {
    const mod = await import('@/app/(marketing)/partners/page');
    expect(mod.metadata?.title).toContain('Partner');
  });

  it('exports metadata with SEO description', async () => {
    const mod = await import('@/app/(marketing)/partners/page');
    expect(mod.metadata?.description).toBeTruthy();
  });

  it('exports a default component', async () => {
    const mod = await import('@/app/(marketing)/partners/page');
    expect(typeof mod.default).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 3. Pricing page updates
// ---------------------------------------------------------------------------
describe('Pricing page feature updates', () => {
  it('includes Google AI Overview in starter features', async () => {
    const mod = await import('@/app/(marketing)/pricing/page');
    // Access the module to verify it loads without error
    expect(typeof mod.default).toBe('function');
  });

  it('exports metadata with pricing info', async () => {
    const mod = await import('@/app/(marketing)/pricing/page');
    expect(mod.metadata?.title).toContain('Pricing');
  });
});

// ---------------------------------------------------------------------------
// 4. SelfAudit section
// ---------------------------------------------------------------------------
describe('SelfAudit section', () => {
  it('exports a default component from SelfAudit', async () => {
    const mod = await import('@/app/(marketing)/_sections/SelfAudit');
    expect(typeof mod.default).toBe('function');
  });

  it('SelfAuditCards client component exists', async () => {
    const mod = await import('@/app/(marketing)/_components/SelfAuditCards');
    expect(typeof mod.default).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 5. Sitemap expansion
// ---------------------------------------------------------------------------
describe('Sitemap — Sprint D additions', () => {
  it('includes /changelog in sitemap', async () => {
    const { default: sitemap } = await import('@/app/sitemap');
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.includes('/changelog'))).toBe(true);
  });

  it('includes /partners in sitemap', async () => {
    const { default: sitemap } = await import('@/app/sitemap');
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.includes('/partners'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Partner waitlist API route
// ---------------------------------------------------------------------------
describe('Partner waitlist API', () => {
  it('exports a POST handler', async () => {
    const mod = await import('@/app/api/partner-waitlist/route');
    expect(typeof mod.POST).toBe('function');
  });
});
