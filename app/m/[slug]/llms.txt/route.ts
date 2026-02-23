// Route Handler — GET /m/[slug]/llms.txt
//
// Returns a structured Markdown document (llms.txt standard) containing
// authoritative business info, operating hours, amenities, and full menu.
// Used by Perplexity, ChatGPT, Claude, and other LLM agents as ground truth.
//
// Doc 03 §15 Agent Rule: HoursData and Amenities imported from canonical types.
// AI_RULES §1: column names verified against supabase/migrations/.

import { type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type {
  HoursData,
  DayOfWeek,
  DayHours,
  Amenities,
} from '@/lib/types/ground-truth';

// ---------------------------------------------------------------------------
// Constants
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

const AMENITY_DESCRIPTIONS: Array<{
  key: keyof Amenities;
  yes: string;
  no: string;
}> = [
  { key: 'serves_alcohol',      yes: 'Full bar available (beer, wine, cocktails)', no: 'No alcohol served' },
  { key: 'has_outdoor_seating', yes: 'Outdoor seating available',                  no: 'Indoor seating only' },
  { key: 'takes_reservations',  yes: 'Takes reservations',                         no: 'Walk-ins only (no reservations)' },
  { key: 'has_live_music',      yes: 'Live music available',                       no: 'No live music' },
  { key: 'has_hookah',          yes: 'Hookah lounge on-site',                      no: 'No hookah lounge' },
  { key: 'is_kid_friendly',     yes: 'Kid-friendly environment',                   no: 'Not recommended for young children' },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  is_available: boolean;
  sort_order: number;
};

type Category = {
  id: string;
  name: string;
  sort_order: number;
  menu_items: MenuItem[];
};

type LocationRow = {
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

type MenuRow = {
  id: string;
  locations: LocationRow | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats a 24h time string to 12h display.
 * e.g. "17:00" → "5:00 PM"
 */
function fmt12h(time: string): string {
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr ?? '0', 10);
  const m = parseInt(mStr ?? '0', 10);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/** Formats a decimal price as "$18.00". */
function fmtPrice(price: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price);
}

// ---------------------------------------------------------------------------
// llms.txt builder
// ---------------------------------------------------------------------------

function buildLlmsTxt(
  menu: MenuRow,
  categories: Category[],
  slug: string
): string {
  const loc = menu.locations;
  const businessName = loc?.business_name ?? 'Restaurant';

  const addressParts = [
    loc?.address_line1,
    loc?.address_line2,
    [loc?.city, loc?.state].filter(Boolean).join(', '),
    loc?.zip,
  ].filter(Boolean);
  const address = addressParts.join(', ') || 'Address not specified';

  const lines: string[] = [];

  // ── Document header ────────────────────────────────────────────────────
  lines.push(`# ${businessName}`);
  lines.push(
    `> Authoritative business and menu information for AI agents. ` +
    `Source: LocalVector.ai ground truth database. ` +
    `Last updated: ${new Date().toISOString().slice(0, 10)}.`
  );
  lines.push('');

  // ── Business Information ───────────────────────────────────────────────
  lines.push('## Business Information');
  lines.push('');
  lines.push(`**Name:** ${businessName}  `);
  lines.push(`**Address:** ${address}  `);
  if (loc?.phone)       lines.push(`**Phone:** ${loc.phone}  `);
  if (loc?.website_url) lines.push(`**Website:** ${loc.website_url}  `);
  lines.push(`**Type:** Restaurant  `);
  lines.push('');

  // ── Operating Hours ────────────────────────────────────────────────────
  lines.push('## Operating Hours');
  lines.push('');

  const hoursData = loc?.hours_data;
  if (!hoursData) {
    lines.push('Hours not specified.');
  } else {
    lines.push('| Day | Hours |');
    lines.push('|-----|-------|');
    for (const day of ORDERED_DAYS) {
      const h = hoursData[day];
      let display: string;
      if (!h)                  display = 'Hours not specified';
      else if (h === 'closed') display = 'Closed';
      else {
        const { open, close } = h as DayHours;
        display = `${fmt12h(open)} – ${fmt12h(close)}`;
      }
      lines.push(`| ${DAY_LABELS[day]} | ${display} |`);
    }
  }
  lines.push('');

  // ── Amenities ──────────────────────────────────────────────────────────
  lines.push('## Amenities');
  lines.push('');

  const amenities = loc?.amenities;
  if (!amenities) {
    lines.push('Amenity information not specified.');
  } else {
    for (const { key, yes, no } of AMENITY_DESCRIPTIONS) {
      const val = amenities[key];
      if (val === undefined) continue;
      lines.push(`- ${val ? `✓ ${yes}` : `✗ ${no}`}`);
    }
  }
  lines.push('');

  // ── Menu ───────────────────────────────────────────────────────────────
  lines.push('## Menu');
  lines.push('');

  if (categories.length === 0) {
    lines.push('Menu items not yet available.');
  } else {
    for (const cat of categories) {
      lines.push(`### ${cat.name}`);
      lines.push('');
      if (cat.menu_items.length === 0) {
        lines.push('*(No items in this section yet.)*');
      } else {
        for (const item of cat.menu_items) {
          const priceStr = item.price !== null
            ? ` — ${fmtPrice(item.price, item.currency)}`
            : '';
          lines.push(`- **${item.name}**${priceStr}${!item.is_available ? ' *(Unavailable)*' : ''}`);
          if (item.description) {
            lines.push(`  ${item.description}`);
          }
        }
      }
      lines.push('');
    }
  }

  // ── Footer ─────────────────────────────────────────────────────────────
  lines.push('---');
  lines.push('');
  lines.push(
    `*This data is maintained and verified by the business owner via LocalVector.ai. ` +
    `For corrections, visit https://app.localvector.ai.*`
  );
  lines.push('');
  lines.push(`**AI Config:** See \`/m/${slug}/ai-config.json\` for the machine-readable GEO configuration.`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  // Fetch published menu + full location data.
  const { data: menu } = (await supabase
    .from('magic_menus')
    .select(
      'id, locations(id, business_name, address_line1, address_line2, city, state, zip, phone, website_url, hours_data, amenities)'
    )
    .eq('public_slug', slug)
    .eq('is_published', true)
    .single()) as { data: MenuRow | null; error: unknown };

  if (!menu) {
    return new Response('# 404 Not Found\n\nNo published menu found for this slug.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // Fetch categories and items.
  const { data: categoriesRaw } = (await supabase
    .from('menu_categories')
    .select(
      'id, name, sort_order, menu_items(id, name, description, price, currency, is_available, sort_order)'
    )
    .eq('menu_id', menu.id)
    .order('sort_order', { ascending: true })) as { data: Category[] | null; error: unknown };

  const categories: Category[] = (categoriesRaw ?? []).map((cat) => ({
    ...cat,
    menu_items: (cat.menu_items ?? []).sort((a, b) => a.sort_order - b.sort_order),
  }));

  const text = buildLlmsTxt(menu, categories, slug);

  return new Response(text, {
    status: 200,
    headers: {
      'Content-Type':  'text/plain; charset=utf-8',
      // Allow public CDN caching for 5 minutes; revalidate in background.
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
