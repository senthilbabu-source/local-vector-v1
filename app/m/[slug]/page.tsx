// Server Component — public LLM Honeypot.
// Fetches a published Magic Menu and renders it with Deep Night styling
// plus two Schema.org JSON-LD blocks (Restaurant + Menu) for AI crawlers.
//
// Doc 03 §15 Agent Rule: all JSONB types imported from lib/types/ground-truth.ts.
// AI_RULES §1: column names verified against supabase/migrations/.

import { notFound } from 'next/navigation';
import { cache } from 'react';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import type {
  HoursData,
  DayOfWeek,
  DayHours,
  Amenities,
} from '@/lib/types/ground-truth';

// ---------------------------------------------------------------------------
// Constants (literal strings — Tailwind JIT must see these as-is)
// ---------------------------------------------------------------------------

const ORDERED_DAYS: DayOfWeek[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday:    'Monday',
  tuesday:   'Tuesday',
  wednesday: 'Wednesday',
  thursday:  'Thursday',
  friday:    'Friday',
  saturday:  'Saturday',
  sunday:    'Sunday',
};

// Core amenities we always render, in display order.
const AMENITY_ROWS: { key: keyof Amenities; label: string; negative: string }[] = [
  { key: 'serves_alcohol',      label: 'Full bar (beer, wine, cocktails)', negative: 'No alcohol served' },
  { key: 'has_outdoor_seating', label: 'Outdoor seating',                  negative: 'Indoor seating only' },
  { key: 'takes_reservations',  label: 'Takes reservations',               negative: 'Walk-ins only' },
  { key: 'has_live_music',      label: 'Live music',                       negative: 'No live music' },
  { key: 'has_hookah',          label: 'Hookah lounge',                    negative: 'No hookah' },
  { key: 'is_kid_friendly',     label: 'Kid-friendly',                     negative: 'Not kid-friendly' },
];

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
  id: string;
  business_name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  website_url: string | null;
  hours_data: HoursData | null;
  amenities: Partial<Amenities> | null;
};

type PublicMenuData = {
  id: string;
  public_slug: string;
  location_id: string | null;
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
 * Converts a 24h time string ("17:00") to 12h display ("5:00 PM").
 * Pure arithmetic — no locale-dependent date APIs, no hydration mismatch.
 */
function formatHour(time: string): string {
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr ?? '0', 10);
  const m = parseInt(mStr ?? '0', 10);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Safely serialises a JSON-LD schema object for injection into a <script> tag.
 * Uses JSON.stringify + Unicode escapes for < and > to prevent </script>
 * injection — a known XSS vector when embedding JSON-LD in HTML.
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
 * Builds the Schema.org openingHoursSpecification array from hours_data.
 * Closed days (value = "closed") are omitted — Schema.org convention is to
 * only list open days in openingHoursSpecification.
 * Missing day keys (hours unknown) are also omitted.
 */
function buildOpeningHoursSpecification(
  hoursData: HoursData | null
): Record<string, unknown>[] {
  if (!hoursData) return [];
  return ORDERED_DAYS.flatMap((day) => {
    const hours = hoursData[day];
    if (!hours || hours === 'closed') return [];
    const { open, close } = hours as DayHours;
    return [{
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: DAY_LABELS[day],
      opens:  open,
      closes: close,
    }];
  });
}

/** Builds a Schema.org Restaurant object including openingHoursSpecification. */
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
      streetAddress: [loc.address_line1, loc.address_line2].filter(Boolean).join(', '),
      addressLocality: loc.city ?? '',
      addressRegion:   loc.state ?? '',
      postalCode:      loc.zip ?? '',
      addressCountry:  'US',
    };
  }

  if (loc?.phone)       schema.telephone = loc.phone;
  if (loc?.website_url) schema.url        = loc.website_url;

  const hoursSpec = buildOpeningHoursSpecification(loc?.hours_data ?? null);
  if (hoursSpec.length > 0) {
    schema.openingHoursSpecification = hoursSpec;
  }

  // Link to the companion Menu schema
  schema.hasMenu = { '@id': '#menu' };

  return schema;
}

/** Builds a Schema.org Menu with sections and items. */
function buildMenuSchema(
  menuDisplayName: string,
  categories: CategoryData[]
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type':    'Menu',
    '@id':      '#menu',
    name:       menuDisplayName,
    hasMenuSection: categories.map((cat) => ({
      '@type': 'MenuSection',
      name:    cat.name,
      hasMenuItem: cat.menu_items.map((item) => {
        const mi: Record<string, unknown> = {
          '@type': 'MenuItem',
          name:    item.name,
        };
        if (item.description) mi.description = item.description;
        if (item.price !== null) {
          mi.offers = {
            '@type':         'Offer',
            price:           item.price.toFixed(2),
            priceCurrency:   item.currency || 'USD',
          };
        }
        return mi;
      }),
    })),
  };
}

// ---------------------------------------------------------------------------
// Data fetching — React cache() deduplicates across generateMetadata + Page
// ---------------------------------------------------------------------------

const fetchPublicMenuPage = cache(
  async (slug: string): Promise<{ menu: PublicMenuData | null; categories: CategoryData[] }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any;

    // Fetch menu header + full location data (incl. hours_data and amenities).
    // Double-gated: anon RLS policy + application-level .eq('is_published', true).
    const { data: menu } = (await supabase
      .from('magic_menus')
      .select(
        'id, public_slug, location_id, locations(id, business_name, address_line1, address_line2, city, state, zip, phone, website_url, hours_data, amenities)'
      )
      .eq('public_slug', slug)
      .eq('is_published', true)
      .single()) as { data: PublicMenuData | null; error: unknown };

    if (!menu) return { menu: null, categories: [] };

    // Fetch categories with their items.
    const { data: categoriesRaw } = (await supabase
      .from('menu_categories')
      .select(
        'id, name, sort_order, menu_items(id, name, description, price, currency, is_available, sort_order)'
      )
      .eq('menu_id', menu.id)
      .order('sort_order', { ascending: true })) as { data: CategoryData[] | null; error: unknown };

    const categories: CategoryData[] = (categoriesRaw ?? []).map((cat) => ({
      ...cat,
      menu_items: (cat.menu_items ?? []).sort((a, b) => a.sort_order - b.sort_order),
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

  if (!menu) return { title: 'Menu Not Found' };

  const businessName   = menu.locations?.business_name ?? 'Restaurant';
  const menuName       = slugToDisplayName(menu.public_slug);
  const city           = menu.locations?.city;
  const state          = menu.locations?.state;
  const locationSuffix = city ? ` in ${city}${state ? `, ${state}` : ''}` : '';

  return {
    title:       `${menuName} — ${businessName}`,
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

  if (!menu) notFound();

  const loc             = menu.locations;
  const businessName    = loc?.business_name ?? 'Restaurant';
  const menuDisplayName = slugToDisplayName(menu.public_slug);
  const totalItems      = categories.reduce((n, c) => n + c.menu_items.length, 0);

  const restaurantSchema = buildRestaurantSchema(menu);
  const menuSchema       = buildMenuSchema(menuDisplayName, categories);

  // ── Hours rendering prep ────────────────────────────────────────────────
  const hoursData = loc?.hours_data ?? null;
  const hoursRows: { day: DayOfWeek; label: string; display: string }[] =
    ORDERED_DAYS.map((day) => {
      const h = hoursData?.[day];
      let display: string;
      if (!h)                display = '—';
      else if (h === 'closed') display = 'Closed';
      else                   display = `${formatHour(h.open)} – ${formatHour(h.close)}`;
      return { day, label: DAY_LABELS[day], display };
    });

  // ── Amenity rendering prep ──────────────────────────────────────────────
  const amenities = loc?.amenities ?? null;

  return (
    <>
      {/* ── JSON-LD: Restaurant (+ openingHoursSpecification) ─────── */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: safeJsonLd(restaurantSchema) }}
      />
      {/* ── JSON-LD: Menu ─────────────────────────────────────────── */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: safeJsonLd(menuSchema) }}
      />

      {/* ── Page body ─────────────────────────────────────────────── */}
      <div className="min-h-screen py-10 px-4">
        <article className="mx-auto max-w-2xl space-y-4">

          {/* ── Restaurant header ───────────────────────────────────── */}
          <header className="rounded-2xl bg-surface-dark border border-white/5 px-6 py-6">
            {/* Powered-by badge */}
            <div className="flex items-center gap-1.5 mb-4">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-electric-indigo text-white text-xs font-bold select-none">
                LV
              </span>
              <span className="text-xs text-slate-500">
                LocalVector.ai · AI-verified menu
              </span>
            </div>

            <h1 className="text-2xl font-bold text-white tracking-tight">
              {businessName}
            </h1>

            {loc && (loc.city || loc.address_line1) && (
              <address className="mt-2 not-italic text-sm text-slate-400 leading-relaxed">
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
                  className="text-slate-300 hover:text-white transition"
                >
                  {loc.phone}
                </a>
              )}
              {loc?.website_url && (
                <a
                  href={loc.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-electric-indigo hover:underline"
                >
                  {loc.website_url}
                </a>
              )}
            </div>
          </header>

          {/* ── Operating Hours ──────────────────────────────────────── */}
          {hoursData && (
            <section
              aria-label="Operating hours"
              className="rounded-2xl bg-surface-dark border border-white/5 px-6 py-5"
            >
              <h2 className="text-sm font-semibold text-white mb-3">
                Operating Hours
              </h2>
              <table className="w-full text-sm">
                <tbody>
                  {hoursRows.map(({ day, label, display }) => (
                    <tr key={day} className="border-b border-white/5 last:border-0">
                      <td className="py-1.5 pr-4 text-slate-400 font-medium w-32">
                        {label}
                      </td>
                      <td
                        className={[
                          'py-1.5 tabular-nums',
                          display === 'Closed' ? 'text-slate-600'
                            : display === '—'  ? 'text-slate-700 italic'
                            : 'text-slate-300',
                        ].join(' ')}
                      >
                        {display}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* ── Amenities ────────────────────────────────────────────── */}
          {amenities && (
            <section
              aria-label="Amenities"
              className="rounded-2xl bg-surface-dark border border-white/5 px-6 py-5"
            >
              <h2 className="text-sm font-semibold text-white mb-3">
                Amenities
              </h2>
              <div className="flex flex-wrap gap-2">
                {AMENITY_ROWS.map(({ key, label, negative }) => {
                  const present = amenities[key];
                  if (present === undefined) return null;
                  return (
                    <span
                      key={key}
                      className={[
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                        present
                          ? 'bg-truth-emerald/15 text-truth-emerald'
                          : 'bg-white/5 text-slate-500',
                      ].join(' ')}
                    >
                      {present ? '✓' : '✗'} {present ? label : negative}
                    </span>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Menu title ───────────────────────────────────────────── */}
          <div className="px-1">
            <h2 className="text-xl font-semibold text-white tracking-tight">
              {menuDisplayName}
            </h2>
            {totalItems > 0 && (
              <p className="mt-0.5 text-sm text-slate-500">
                {categories.length}{' '}
                {categories.length === 1 ? 'category' : 'categories'},{' '}
                {totalItems} {totalItems === 1 ? 'item' : 'items'}
              </p>
            )}
          </div>

          {/* ── Empty state ──────────────────────────────────────────── */}
          {categories.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-surface-dark py-10 text-center">
              <p className="text-sm text-slate-500">
                This menu has no categories yet.
              </p>
            </div>
          )}

          {/* ── Category sections ────────────────────────────────────── */}
          {categories.map((category) => (
            <section
              key={category.id}
              aria-labelledby={`cat-${category.id}`}
              className="rounded-2xl bg-surface-dark border border-white/5 px-6 py-5"
            >
              <h3
                id={`cat-${category.id}`}
                className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-white/5 pb-2"
              >
                {category.name}
              </h3>

              {category.menu_items.length === 0 && (
                <p className="text-sm italic text-slate-600">
                  No items in this category yet.
                </p>
              )}

              {category.menu_items.length > 0 && (
                <ul className="space-y-4">
                  {category.menu_items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-medium text-white leading-snug">
                          {item.name}
                          {!item.is_available && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-xs font-medium text-slate-500">
                              Unavailable
                            </span>
                          )}
                        </h4>
                        {item.description && (
                          <p className="mt-0.5 text-xs text-slate-400 leading-snug">
                            {item.description}
                          </p>
                        )}
                      </div>
                      {item.price !== null && (
                        <span className="shrink-0 font-mono text-sm font-semibold text-electric-indigo tabular-nums">
                          {formatPrice(item.price, item.currency)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          {/* ── AI-discovery footer ──────────────────────────────────── */}
          <footer className="rounded-2xl border border-white/5 bg-surface-dark px-6 py-5">
            <p className="text-xs text-slate-500 mb-2 font-medium">
              AI-readable data endpoints
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href={`/m/${slug}/llms.txt`}
                className="text-xs font-mono text-electric-indigo/70 hover:text-electric-indigo transition"
              >
                llms.txt
              </a>
              <a
                href={`/m/${slug}/ai-config.json`}
                className="text-xs font-mono text-electric-indigo/70 hover:text-electric-indigo transition"
              >
                ai-config.json
              </a>
            </div>
            <p className="mt-3 text-xs text-slate-600">
              Menu data maintained and verified by the business owner.{' '}
              Powered by{' '}
              <a
                href="https://localvector.ai"
                className="text-slate-500 hover:text-slate-300 transition"
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
