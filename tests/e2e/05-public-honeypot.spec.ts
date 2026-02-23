// ---------------------------------------------------------------------------
// 05-public-honeypot.spec.ts — Public LLM Honeypot Page
//
// Tests the public menu honeypot at /m/charcoal-n-chill (seeded in seed.sql §4).
// No authentication required — the page is open to all (anon RLS policy).
//
// What this test validates:
//   1. The page renders the business name and menu items from the DB.
//   2. Two <script type="application/ld+json"> blocks are injected:
//        - Schema.org Restaurant schema (with openingHoursSpecification)
//        - Schema.org Menu schema (with hasMenuSection / hasMenuItem)
//   3. GET /m/charcoal-n-chill/llms.txt → 200 + valid Markdown with correct
//      section headers (# BusinessName, ## Operating Hours, ## Menu).
//   4. GET /m/charcoal-n-chill/ai-config.json → 200 + valid GEO Standard JSON
//      containing $schema, entity, data_sources, policies, last_updated.
//
// Seeded data for charcoal-n-chill (seed.sql §4–6, golden tenant):
//   - Business: Charcoal N Chill (org a0eebc99-…, Alpharetta location)
//   - Menu items: Smoked Brisket, Smoked Half Chicken, Truffle Mac & Cheese,
//                 Collard Greens
//   - Hours: set in the migration (Tuesday–Sunday open → openingHoursSpecification
//            will have entries for those days)
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';

// No storageState — public page, no auth required.

const PUBLIC_SLUG   = 'charcoal-n-chill';
const PUBLIC_URL    = `/m/${PUBLIC_SLUG}`;
const LLMS_URL      = `/m/${PUBLIC_SLUG}/llms.txt`;
const AI_CONFIG_URL = `/m/${PUBLIC_SLUG}/ai-config.json`;

test.describe('05 — Public Honeypot: /m/charcoal-n-chill', () => {

  // ── Page render ────────────────────────────────────────────────────────────

  test('renders the business name and seeded menu items', async ({ page }) => {
    await page.goto(PUBLIC_URL);

    // Business name from the golden tenant location (business_name field).
    // level:1 scopes to the <h1> — an <h2> with the same name also appears
    // in the Menu schema section, which would cause a strict mode violation.
    await expect(page.getByRole('heading', { name: 'Charcoal N Chill', level: 1 })).toBeVisible();

    // Category headings from seed.sql §5.
    await expect(page.getByText('BBQ Plates')).toBeVisible();
    await expect(page.getByText('Sides & Starters')).toBeVisible();

    // Item names from seed.sql §6.
    await expect(page.getByText('Smoked Brisket')).toBeVisible();
    await expect(page.getByText('Truffle Mac & Cheese')).toBeVisible();

    // AI-readable data endpoints footer (PublicMenuPage.tsx).
    await expect(page.getByText('AI-readable data endpoints')).toBeVisible();
    await expect(page.getByRole('link', { name: 'llms.txt' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'ai-config.json' })).toBeVisible();
  });

  // ── JSON-LD schemas ────────────────────────────────────────────────────────

  test('injects two valid JSON-LD blocks (Restaurant + Menu schemas)', async ({ page }) => {
    await page.goto(PUBLIC_URL);

    // Extract all JSON-LD script blocks from the DOM.
    const jsonLdBlocks = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      return Array.from(scripts).map((s) => {
        try {
          return JSON.parse(s.textContent ?? '{}');
        } catch {
          return null;
        }
      });
    });

    // Two blocks must be present (Restaurant + Menu).
    expect(jsonLdBlocks.length).toBeGreaterThanOrEqual(2);
    expect(jsonLdBlocks.every((b) => b !== null)).toBe(true);

    // ── Restaurant schema ──────────────────────────────────────────────────────
    const restaurantSchema = jsonLdBlocks.find(
      (b) => b?.['@type'] === 'Restaurant'
    );
    expect(restaurantSchema, 'Restaurant JSON-LD block should be present').toBeDefined();
    expect(restaurantSchema?.name).toBeTruthy();
    expect(restaurantSchema?.['@context']).toBe('https://schema.org');

    // openingHoursSpecification is included when hours_data is set.
    // The golden tenant location has hours configured in the migration.
    expect(
      restaurantSchema?.openingHoursSpecification,
      'openingHoursSpecification should be in the Restaurant schema'
    ).toBeDefined();
    expect(Array.isArray(restaurantSchema?.openingHoursSpecification)).toBe(true);
    expect(restaurantSchema?.openingHoursSpecification?.length).toBeGreaterThan(0);

    // Each spec entry has dayOfWeek, opens, closes (Schema.org convention).
    const firstSpec = restaurantSchema?.openingHoursSpecification?.[0];
    expect(firstSpec?.['@type']).toBe('OpeningHoursSpecification');
    expect(firstSpec?.dayOfWeek).toBeTruthy();
    expect(firstSpec?.opens).toBeTruthy();
    expect(firstSpec?.closes).toBeTruthy();

    // ── Menu schema ───────────────────────────────────────────────────────────
    const menuSchema = jsonLdBlocks.find(
      (b) => b?.['@type'] === 'Menu'
    );
    expect(menuSchema, 'Menu JSON-LD block should be present').toBeDefined();
    expect(menuSchema?.['@context']).toBe('https://schema.org');
    expect(Array.isArray(menuSchema?.hasMenuSection)).toBe(true);
    expect(menuSchema?.hasMenuSection?.length).toBeGreaterThan(0);
  });

  // ── llms.txt endpoint ──────────────────────────────────────────────────────

  test('GET /llms.txt returns 200 with valid Markdown structure', async ({ page }) => {
    const response = await page.request.get(LLMS_URL);

    expect(response.status()).toBe(200);

    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('text/plain');

    const text = await response.text();

    // Document header (llms.txt builder: `# ${businessName}`)
    expect(text).toContain('# Charcoal N Chill');

    // Section headers required by the llms.txt standard.
    expect(text).toContain('## Business Information');
    expect(text).toContain('## Operating Hours');
    expect(text).toContain('## Amenities');
    expect(text).toContain('## Menu');

    // At least one menu category heading (### BBQ Plates or ### Sides & Starters).
    expect(text).toMatch(/### (BBQ Plates|Sides & Starters)/);

    // Item names from seed.sql §6 appear in the menu section.
    expect(text).toContain('Smoked Brisket');

    // AI Config cross-reference footer.
    expect(text).toContain('ai-config.json');
  });

  // ── ai-config.json endpoint ────────────────────────────────────────────────

  test('GET /ai-config.json returns 200 with valid GEO Standard JSON', async ({ page }) => {
    const response = await page.request.get(AI_CONFIG_URL);

    expect(response.status()).toBe(200);

    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');

    const json = await response.json();

    // GEO Standard top-level fields (ai-config.json/route.ts).
    expect(json['$schema']).toBeTruthy();
    expect(json.entity).toBeDefined();
    expect(json.data_sources).toBeDefined();
    expect(json.policies).toBeDefined();
    expect(json.last_updated).toBeTruthy();

    // entity object has a name (business name).
    expect(json.entity?.name).toBeTruthy();
  });
});
