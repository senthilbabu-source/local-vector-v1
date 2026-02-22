import { notFound } from 'next/navigation';
import { cache } from 'react';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MenuItemData = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  is_available: boolean;
  sort_order: number;
};

type CategoryData = {
  id: string;
  name: string;
  sort_order: number;
  menu_items: MenuItemData[];
};

type LocationData = {
  business_name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  website_url: string | null;
};

type PublicMenuData = {
  id: string;
  public_slug: string;
  locations: LocationData | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derives a human-readable display name from a public_slug.
 * Strips the base-36 timestamp suffix added by toUniqueSlug().
 * e.g. "dinner-menu-1m3kx9" → "Dinner Menu"
 */
function slugToDisplayName(slug: string): string {
  const parts = slug.split('-');
  const lastPart = parts[parts.length - 1];
  const isTimestamp = /^[a-z0-9]{6,9}$/.test(lastPart ?? '');
  const nameParts = isTimestamp ? parts.slice(0, -1) : parts;
  return nameParts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(price);
}

/**
 * Safely serialises a JSON-LD schema object for injection into a <script> tag.
 *
 * JSON.stringify handles quote escaping inside string values. We additionally
 * replace < and > with their Unicode equivalents so that a description
 * containing "</script>" cannot prematurely terminate the script tag —
 * a known injection vector when embedding JSON in HTML.
 */
function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
}

// ---------------------------------------------------------------------------
// JSON-LD schema builders
// ---------------------------------------------------------------------------

/**
 * Builds a Schema.org Restaurant object.
 * The `hasMenu` property links to the Menu schema via its @id anchor.
 */
function buildRestaurantSchema(menu: PublicMenuData): Record<string, unknown> {
  const loc = menu.locations;
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: loc?.business_name ?? '',
  };

  if (loc?.address_line1) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: [loc.address_line1, loc.address_line2]
        .filter(Boolean)
        .join(', '),
      addressLocality: loc.city ?? '',
      addressRegion: loc.state ?? '',
      postalCode: loc.zip ?? '',
      addressCountry: 'US',
    };
  }

  if (loc?.phone) schema.telephone = loc.phone;
  if (loc?.website_url) schema.url = loc.website_url;

  // Link to the companion Menu schema defined in the second <script> block
  schema.hasMenu = { '@id': '#menu' };

  return schema;
}

/**
 * Builds a Schema.org Menu object with hasMenuSection (categories) and
 * hasMenuItem (items). Prices are expressed as Offer objects.
 *
 * All string values (name, description) flow through JSON.stringify via
 * safeJsonLd() — no manual escaping is required here.
 */
function buildMenuSchema(
  menuDisplayName: string,
  categories: CategoryData[]
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    '@id': '#menu',
    name: menuDisplayName,
    hasMenuSection: categories.map((cat) => ({
      '@type': 'MenuSection',
      name: cat.name,
      hasMenuItem: cat.menu_items.map((item) => {
        const menuItem: Record<string, unknown> = {
          '@type': 'MenuItem',
          name: item.name,
        };

        // description and price are optional — only include when present
        if (item.description) {
          menuItem.description = item.description;
        }

        if (item.price !== null) {
          menuItem.offers = {
            '@type': 'Offer',
            price: item.price.toFixed(2),
            priceCurrency: item.currency || 'USD',
          };
        }

        return menuItem;
      }),
    })),
  };
}

// ---------------------------------------------------------------------------
// Data fetching — React cache() deduplicates across generateMetadata + Page
// ---------------------------------------------------------------------------

/**
 * Fetches the published menu and its categories/items for the given slug.
 * Wrapped in React cache() so that generateMetadata and the Page component
 * share a single database round-trip per request.
 *
 * Uses the Supabase anon-role client (no auth cookies present for public
 * requests). The Phase 7 RLS migration grants SELECT to the anon role, with
 * row visibility gated by is_published = TRUE via the EXISTS-based policies.
 */
const fetchPublicMenuPage = cache(
  async (
    slug: string
  ): Promise<{ menu: PublicMenuData | null; categories: CategoryData[] }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any;

    // Fetch the menu header + location data.
    // The .eq('is_published', true) guard is an application-level double-check;
    // the anon RLS policy "public_published_menus" already enforces this.
    const { data: menu } = (await supabase
      .from('magic_menus')
      .select(
        'id, public_slug, locations(business_name, address_line1, address_line2, city, state, zip, phone, website_url)'
      )
      .eq('public_slug', slug)
      .eq('is_published', true)
      .single()) as { data: PublicMenuData | null; error: unknown };

    if (!menu) return { menu: null, categories: [] };

    // Fetch categories with their items. RLS "public_published_categories" and
    // "public_menu_items" ensure only data for published menus is returned.
    const { data: categoriesRaw } = (await supabase
      .from('menu_categories')
      .select(
        'id, name, sort_order, menu_items(id, name, description, price, currency, is_available, sort_order)'
      )
      .eq('menu_id', menu.id)
      .order('sort_order', { ascending: true })) as {
      data: CategoryData[] | null;
      error: unknown;
    };

    const categories: CategoryData[] = (categoriesRaw ?? []).map((cat) => ({
      ...cat,
      menu_items: (cat.menu_items ?? []).sort(
        (a, b) => a.sort_order - b.sort_order
      ),
    }));

    return { menu, categories };
  }
);

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { menu } = await fetchPublicMenuPage(slug);

  if (!menu) {
    return { title: 'Menu Not Found' };
  }

  const businessName = menu.locations?.business_name ?? 'Restaurant';
  const menuName = slugToDisplayName(menu.public_slug);
  const city = menu.locations?.city;
  const state = menu.locations?.state;
  const locationSuffix = city ? ` in ${city}${state ? `, ${state}` : ''}` : '';

  return {
    title: `${menuName} — ${businessName}`,
    description: `View the full ${menuName} from ${businessName}${locationSuffix}. Accurate, AI-readable menu data powered by LocalVector.ai.`,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PublicMenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { menu, categories } = await fetchPublicMenuPage(slug);

  // Return 404 for slugs that don't exist or belong to unpublished menus.
  // The RLS policy already filters out unpublished rows, so a null result
  // here covers both "not found" and "not published" cases.
  if (!menu) {
    notFound();
  }

  const loc = menu.locations;
  const businessName = loc?.business_name ?? 'Restaurant';
  const menuDisplayName = slugToDisplayName(menu.public_slug);

  const restaurantSchema = buildRestaurantSchema(menu);
  const menuSchema = buildMenuSchema(menuDisplayName, categories);

  const totalItems = categories.reduce((n, c) => n + c.menu_items.length, 0);

  return (
    <>
      {/* ── JSON-LD: Restaurant ──────────────────────────────────── */}
      {/* Schema.org JSON-LD may appear anywhere in the document.    */}
      {/* safeJsonLd() uses JSON.stringify + Unicode escapes for     */}
      {/* < and > to prevent </script> injection from string values. */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: safeJsonLd(restaurantSchema) }}
      />

      {/* ── JSON-LD: Menu ────────────────────────────────────────── */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: safeJsonLd(menuSchema) }}
      />

      {/* ── Page body ───────────────────────────────────────────── */}
      <div className="min-h-screen bg-slate-50 py-10 px-4">
        <article className="mx-auto max-w-2xl">

          {/* ── Restaurant header ─────────────────────────────────── */}
          <header className="mb-8 border-b border-slate-200 pb-8">
            <h1 className="text-2xl font-bold text-slate-900">{businessName}</h1>

            {loc && (loc.city || loc.address_line1) && (
              <address className="mt-2 not-italic text-sm text-slate-600 leading-relaxed">
                {loc.address_line1 && <span>{loc.address_line1}<br /></span>}
                {loc.address_line2 && <span>{loc.address_line2}<br /></span>}
                {(loc.city || loc.state || loc.zip) && (
                  <span>
                    {[loc.city, loc.state].filter(Boolean).join(', ')}
                    {loc.zip ? ` ${loc.zip}` : ''}
                  </span>
                )}
              </address>
            )}

            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              {loc?.phone && (
                <a
                  href={`tel:${loc.phone}`}
                  className="text-slate-600 hover:text-slate-900"
                >
                  {loc.phone}
                </a>
              )}
              {loc?.website_url && (
                <a
                  href={loc.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  {loc.website_url}
                </a>
              )}
            </div>
          </header>

          {/* ── Menu title + stats ────────────────────────────────── */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900">{menuDisplayName}</h2>
            {totalItems > 0 && (
              <p className="mt-0.5 text-sm text-slate-500">
                {categories.length}{' '}
                {categories.length === 1 ? 'category' : 'categories'},{' '}
                {totalItems} {totalItems === 1 ? 'item' : 'items'}
              </p>
            )}
          </div>

          {/* ── Empty state ───────────────────────────────────────── */}
          {categories.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-400">
              This menu has no categories yet.
            </p>
          )}

          {/* ── Category sections ─────────────────────────────────── */}
          {categories.map((category) => (
            <section
              key={category.id}
              aria-labelledby={`cat-${category.id}`}
              className="mb-8"
            >
              {/* Category heading */}
              <h3
                id={`cat-${category.id}`}
                className="mb-3 border-b border-slate-200 pb-2 text-base font-semibold uppercase tracking-wide text-slate-700"
              >
                {category.name}
              </h3>

              {/* Empty category */}
              {category.menu_items.length === 0 && (
                <p className="text-sm italic text-slate-400">
                  No items in this category yet.
                </p>
              )}

              {/* Item list */}
              {category.menu_items.length > 0 && (
                <ul className="space-y-4">
                  {category.menu_items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-4"
                    >
                      {/* Left: name + description */}
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-medium text-slate-900">
                          {item.name}
                          {!item.is_available && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                              Unavailable
                            </span>
                          )}
                        </h4>
                        {item.description && (
                          <p className="mt-0.5 text-sm text-slate-500 leading-snug">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Right: price */}
                      {item.price !== null && (
                        <span className="shrink-0 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                          {formatPrice(item.price, item.currency)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          {/* ── Page footer ───────────────────────────────────────── */}
          <footer className="mt-10 border-t border-slate-200 pt-6 text-center">
            <p className="text-xs text-slate-400">
              AI-readable menu data powered by{' '}
              <a
                href="https://localvector.ai"
                className="text-indigo-500 hover:underline"
              >
                LocalVector.ai
              </a>
            </p>
          </footer>

        </article>
      </div>
    </>
  );
}
