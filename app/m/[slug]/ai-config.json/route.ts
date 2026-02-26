// Route Handler — GET /m/[slug]/ai-config.json
//
// Returns a GEO Standard JSON configuration file (Doc 08 §10) that tells
// AI crawlers and agents where to find the authoritative ground-truth data
// for this business entity.
//
// All data_sources URLs are derived dynamically from the incoming request URL
// so this works correctly in both local dev and production environments.
//
// AI_RULES §1: column names verified against supabase/migrations/.

import { createHash } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LocationRow = {
  id: string;
  business_name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

type MenuRow = {
  id: string;
  location_id: string;
  updated_at: string;
  locations: LocationRow | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a normalised address string for deterministic SHA-256 hashing. */
function buildAddressString(loc: LocationRow): string {
  return [
    loc.address_line1,
    loc.address_line2,
    loc.city,
    loc.state,
    loc.zip,
  ]
    .filter(Boolean)
    .join(', ')
    .toLowerCase()
    .trim();
}

/** Returns a "sha256-<hex>" address hash per Doc 08 §10. */
function hashAddress(address: string): string {
  const hex = createHash('sha256').update(address, 'utf8').digest('hex');
  return `sha256-${hex}`;
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const supabase = await createClient();

  const { data: menu } = (await supabase
    .from('magic_menus')
    .select(
      'id, location_id, updated_at, locations(id, business_name, address_line1, address_line2, city, state, zip)'
    )
    .eq('public_slug', slug)
    .eq('is_published', true)
    .single()) as { data: MenuRow | null; error: unknown };

  if (!menu) {
    return NextResponse.json(
      { error: 'No published menu found for this slug.' },
      { status: 404 }
    );
  }

  const loc = menu.locations;
  const businessName = loc?.business_name ?? 'Restaurant';

  // ── Derive base URLs from the incoming request ──────────────────────────
  const { origin } = new URL(request.url);
  const baseMenuUrl = `${origin}/m/${slug}`;

  // ── Build address hash ──────────────────────────────────────────────────
  const addressStr = loc ? buildAddressString(loc) : '';
  const addressHash = hashAddress(addressStr);

  // ── Assemble GEO Standard payload (Doc 08 §10) ──────────────────────────
  const payload = {
    $schema: 'https://localvector.ai/schemas/geo-config-v1.json',
    entity: {
      name: businessName,
      type: 'Restaurant',
      location_id: menu.location_id,
      address_hash: addressHash,
    },
    data_sources: {
      ground_truth_url:       baseMenuUrl,
      llms_txt_url:           `${baseMenuUrl}/llms.txt`,
      menu_schema_url:        `${baseMenuUrl}/ai-config.json`,
      verification_endpoint:  `${origin}/api/v1/public/verify-entity`,
    },
    policies: {
      pricing_authority:           'self',
      third_party_delivery_status: 'disavow_pricing',
      ai_crawling:                 'allowed',
    },
    last_updated: menu.updated_at,
  };

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      // Allow public CDN caching for 5 minutes; revalidate in background.
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
