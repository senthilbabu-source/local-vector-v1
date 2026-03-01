// ---------------------------------------------------------------------------
// lib/schema-expansion/schema-expansion-service.ts — Schema Expansion Orchestrator
//
// Sprint 106: Coordinates crawl → classify → generate → persist → score.
// Follows the exact same pattern as lib/nap-sync/nap-sync-service.ts.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { createHash } from 'crypto';
import { crawlWebsite } from './website-crawler';
import { getGeneratorForPageType } from './generators';
import { generateEmbedSnippet, validateSchemaBeforePublish } from './schema-host';
import { pingIndexNow } from '@/lib/indexnow';
import { planSatisfies } from '@/lib/plan-enforcer';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type {
  GroundTruth,
  SchemaGeneratorInput,
  SchemaExpansionResult,
  PageSchemaResult,
  CrawledPage,
} from './types';

// ---------------------------------------------------------------------------
// Main Entry Point — Single Location
// ---------------------------------------------------------------------------

/**
 * Run schema expansion for a single location.
 * Crawls website → generates JSON-LD per page type → persists to page_schemas.
 */
export async function runSchemaExpansion(
  supabase: SupabaseClient<Database>,
  locationId: string,
  orgId: string,
): Promise<SchemaExpansionResult> {
  const runAt = new Date().toISOString();
  const pageResults: PageSchemaResult[] = [];

  // 1. Fetch location data
  const { data: location, error: locError } = await supabase
    .from('locations')
    .select('business_name, website_url, address_line1, city, state, zip, phone, hours_data, amenities, categories, website_slug')
    .eq('id', locationId)
    .single();

  if (locError || !location) {
    throw new Error(`Location not found: ${locationId}`);
  }

  if (!location.website_url) {
    throw new Error('no_website');
  }

  // 2. Fetch org plan for page limits
  const { data: org } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', orgId)
    .single();

  const planTier = (org?.plan as string) ?? 'starter';

  // 3. Build Ground Truth
  const groundTruth: GroundTruth = {
    location_id: locationId,
    org_id: orgId,
    name: location.business_name,
    address: location.address_line1 ?? '',
    city: location.city ?? '',
    state: location.state ?? '',
    zip: location.zip ?? '',
    phone: location.phone ?? '',
    website: location.website_url,
    hours_data: location.hours_data as GroundTruth['hours_data'],
  };

  // 4. Fetch sameAs URLs from listing_platform_ids
  const { data: platformIds } = await supabase
    .from('listing_platform_ids')
    .select('platform, platform_id')
    .eq('location_id', locationId);

  const sameAsUrls = buildSameAsUrls(platformIds ?? []);

  // 5. Crawl the website
  const crawlResult = await crawlWebsite(location.website_url, planTier);

  // 6. Generate slug if not set
  let slug = location.website_slug;
  if (!slug) {
    slug = toSlug(location.business_name);
    await supabase
      .from('locations')
      .update({ website_slug: slug })
      .eq('id', locationId);
  }

  // 7. Generate schemas for each page (skip menu pages)
  for (const page of crawlResult.pages) {
    if (page.page_type === 'menu') {
      pageResults.push({
        url: page.url,
        page_type: 'menu',
        status: 'skipped',
        schema_types: [],
      });
      continue;
    }

    if (page.error) {
      pageResults.push({
        url: page.url,
        page_type: page.page_type,
        status: 'failed',
        schema_types: [],
        error: page.error,
      });
      continue;
    }

    const generator = getGeneratorForPageType(page.page_type);
    if (!generator) {
      pageResults.push({
        url: page.url,
        page_type: page.page_type,
        status: 'skipped',
        schema_types: [],
      });
      continue;
    }

    try {
      const generatorInput: SchemaGeneratorInput = {
        groundTruth,
        page,
        orgId,
        locationId,
        sameAsUrls,
        amenities: location.amenities as Record<string, boolean> | null,
        categories: location.categories as string[] | null,
      };

      const generated = await generator.generate(generatorInput);

      // Validate
      const validation = validateSchemaBeforePublish(generated.json_ld);
      const contentHash = computeContentHash(generated.json_ld);
      const embedSnippet = generateEmbedSnippet(generated.json_ld, page.page_type);
      const publicUrl = `https://schema.localvector.ai/${slug}/${page.page_type}/embed.html`;

      // Determine status
      const isAIGenerated = generated.missing_fields.includes('faqs_auto_generated');
      const status = !validation.valid
        ? 'failed'
        : isAIGenerated
          ? 'pending_review'
          : 'published';

      // Upsert to page_schemas
      const { error: upsertError } = await supabase
        .from('page_schemas')
        .upsert(
          {
            location_id: locationId,
            org_id: orgId,
            page_url: page.url,
            page_type: page.page_type,
            schema_types: generated.schema_types,
            json_ld: generated.json_ld as unknown as Database['public']['Tables']['page_schemas']['Insert']['json_ld'],
            embed_snippet: embedSnippet,
            public_url: status === 'published' ? publicUrl : null,
            content_hash: contentHash,
            status,
            human_approved: status === 'published' && !isAIGenerated,
            confidence: generated.confidence,
            missing_fields: generated.missing_fields,
            validation_errors: validation.errors,
            generated_at: generated.generated_at,
            published_at: status === 'published' ? new Date().toISOString() : null,
            last_crawled_at: page.crawled_at,
          },
          { onConflict: 'location_id,page_url' },
        );

      if (upsertError) {
        Sentry.captureException(upsertError, {
          tags: { component: 'schema-expansion', sprint: '106' },
        });
        pageResults.push({
          url: page.url,
          page_type: page.page_type,
          status: 'failed',
          schema_types: generated.schema_types,
          error: upsertError.message,
        });
        continue;
      }

      // Ping IndexNow for published pages
      if (status === 'published') {
        pingIndexNow([page.url]).catch((err) => {
          Sentry.captureException(err, { tags: { component: 'indexnow', sprint: '106' } });
        });
      }

      pageResults.push({
        url: page.url,
        page_type: page.page_type,
        status: status as 'published' | 'pending_review' | 'failed',
        schema_types: generated.schema_types,
        public_url: status === 'published' ? publicUrl : undefined,
      });
    } catch (err) {
      Sentry.captureException(err, {
        tags: { component: 'schema-expansion', sprint: '106' },
        extra: { url: page.url, page_type: page.page_type },
      });
      pageResults.push({
        url: page.url,
        page_type: page.page_type,
        status: 'failed',
        schema_types: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 8. Calculate health score
  const hasBlog = crawlResult.pages.some((p) => p.page_type === 'blog_post');
  const hasEvents = crawlResult.pages.some((p) => p.page_type === 'event');
  const hasServices = crawlResult.pages.some((p) => p.page_type === 'service');
  const healthScore = calculateSchemaHealthScore(pageResults, hasBlog, hasEvents, hasServices);

  // 9. Update locations table
  await supabase
    .from('locations')
    .update({
      schema_health_score: healthScore,
      schema_last_run_at: runAt,
    })
    .eq('id', locationId);

  return {
    location_id: locationId,
    org_id: orgId,
    pages_crawled: crawlResult.pages.length,
    schemas_generated: pageResults.filter((p) => p.status !== 'skipped' && p.status !== 'failed').length,
    schemas_published: pageResults.filter((p) => p.status === 'published').length,
    schemas_pending_review: pageResults.filter((p) => p.status === 'pending_review').length,
    schema_health_score: healthScore,
    page_results: pageResults,
    run_at: runAt,
  };
}

// ---------------------------------------------------------------------------
// Health Score Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the Schema Health Score (0–100) for a location.
 *
 * Base: 100
 * Deductions for missing high-value page types:
 *   - homepage: -30 (critical)
 *   - faq:      -25
 *   - about:    -15
 *   - event:    -10 (only if events exist on site)
 *   - blog:     -10 (only if blog pages exist)
 *   - service:  -10 (only if service pages exist)
 * Deductions for pending_review: -5 each
 */
export function calculateSchemaHealthScore(
  pageResults: PageSchemaResult[],
  hasBlog: boolean,
  hasEvents: boolean,
  hasServices: boolean,
): number {
  let score = 100;

  const publishedTypes = new Set(
    pageResults
      .filter((p) => p.status === 'published')
      .map((p) => p.page_type),
  );

  // Critical deductions
  if (!publishedTypes.has('homepage')) score -= 30;
  if (!publishedTypes.has('faq')) score -= 25;
  if (!publishedTypes.has('about')) score -= 15;

  // Conditional deductions (only if those page types exist on the site)
  if (hasEvents && !publishedTypes.has('event')) score -= 10;
  if (hasBlog && !publishedTypes.has('blog_post')) score -= 10;
  if (hasServices && !publishedTypes.has('service')) score -= 10;

  // Pending review deductions
  const pendingCount = pageResults.filter((p) => p.status === 'pending_review').length;
  score -= pendingCount * 5;

  // Bonus for sameAs links
  const hasSameAs = pageResults.some((p) =>
    p.schema_types.includes('LocalBusiness') ||
    p.schema_types.includes('Restaurant') ||
    p.schema_types.includes('BarOrPub'),
  );
  if (hasSameAs && publishedTypes.has('homepage')) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

// ---------------------------------------------------------------------------
// Batch Processing — All Locations
// ---------------------------------------------------------------------------

/**
 * Run schema expansion for ALL active Growth+ locations.
 * Called by the monthly schema drift cron.
 */
export async function runSchemaExpansionForAllLocations(
  supabase: SupabaseClient<Database>,
): Promise<{ processed: number; errors: number }> {
  // Fetch all active Growth+ orgs
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, plan')
    .not('plan', 'is', null);

  if (!orgs) return { processed: 0, errors: 0 };

  let processed = 0;
  let errors = 0;

  for (const org of orgs) {
    if (!planSatisfies(org.plan, 'growth')) continue;

    const { data: locations } = await supabase
      .from('locations')
      .select('id')
      .eq('org_id', org.id)
      .eq('is_archived', false);

    if (!locations) continue;

    for (const location of locations) {
      try {
        await runSchemaExpansion(supabase, location.id, org.id);
        processed++;
      } catch (err) {
        errors++;
        Sentry.captureException(err, {
          tags: { cron: 'schema-drift', sprint: '106' },
          extra: { orgId: org.id, locationId: location.id },
        });
      }
    }
  }

  return { processed, errors };
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

function computeContentHash(jsonLd: Record<string, unknown>[]): string {
  return createHash('sha256')
    .update(JSON.stringify(jsonLd))
    .digest('hex');
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildSameAsUrls(
  platformIds: Array<{ platform: string; platform_id: string }>,
): string[] {
  const urls: string[] = [];

  for (const { platform, platform_id } of platformIds) {
    switch (platform) {
      case 'google':
        urls.push(`https://www.google.com/maps/place/?q=place_id:${platform_id}`);
        break;
      case 'yelp':
        urls.push(`https://www.yelp.com/biz/${platform_id}`);
        break;
      case 'apple_maps':
        urls.push(`https://maps.apple.com/?q=${platform_id}`);
        break;
      case 'bing':
        urls.push(`https://www.bing.com/local/details.aspx?id=${platform_id}`);
        break;
    }
  }

  return urls;
}
