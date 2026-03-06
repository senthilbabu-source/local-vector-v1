'use server';

// ---------------------------------------------------------------------------
// app/actions/faq.ts — FAQ Management Server Actions (Sprint 128)
//
// exclude/unhide/regenerate/preview actions for FAQ pairs.
// All actions derive org_id from the authenticated session (AI_RULES §18).
// Content hash exclusion (SHA-256 of question string) per AI_RULES §160.
// ---------------------------------------------------------------------------

import { revalidatePath } from 'next/cache';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/database.types';
import { generateFAQs, applyExclusions } from '@/lib/faq/faq-generator';
import type { FAQPair, FAQGeneratorInput } from '@/lib/faq/faq-generator';
import { pingIndexNow } from '@/lib/indexnow';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionResult<T = void> = T extends void
  ? { success: true } | { success: false; error: string }
  : { success: true; data: T } | { success: false; error: string };

interface FAQPreviewPair extends FAQPair {
  excluded: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function verifyOwnership(
  locationId: string,
  orgId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('locations')
    .select('id')
    .eq('id', locationId)
    .eq('org_id', orgId)
    .maybeSingle();
  return data !== null;
}

// ---------------------------------------------------------------------------
// excludeFAQPair — owner hides a FAQ pair by content hash
// ---------------------------------------------------------------------------

export async function excludeFAQPair(
  locationId: string,
  contentHash: string,
): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const owns = await verifyOwnership(locationId, ctx.orgId);
  if (!owns) return { success: false, error: 'Location not found' };

  const supabase = await createClient();

  // Fetch current excluded hashes
  const { data } = await supabase
    .from('locations')
    .select('faq_excluded_hashes')
    .eq('id', locationId)
    .single();

  const current = (data?.faq_excluded_hashes as string[]) ?? [];
  if (current.includes(contentHash)) {
    return { success: true }; // already excluded
  }

  const { error } = await supabase
    .from('locations')
    .update({ faq_excluded_hashes: [...current, contentHash] })
    .eq('id', locationId);

  if (error) return { success: false, error: error.message };

  revalidatePath('/dashboard');
  return { success: true };
}

// ---------------------------------------------------------------------------
// unhideFAQPair — owner restores a hidden FAQ pair
// ---------------------------------------------------------------------------

export async function unhideFAQPair(
  locationId: string,
  contentHash: string,
): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const owns = await verifyOwnership(locationId, ctx.orgId);
  if (!owns) return { success: false, error: 'Location not found' };

  const supabase = await createClient();

  const { data } = await supabase
    .from('locations')
    .select('faq_excluded_hashes')
    .eq('id', locationId)
    .single();

  const current = (data?.faq_excluded_hashes as string[]) ?? [];
  const updated = current.filter((h) => h !== contentHash);

  const { error } = await supabase
    .from('locations')
    .update({ faq_excluded_hashes: updated })
    .eq('id', locationId);

  if (error) return { success: false, error: error.message };

  revalidatePath('/dashboard');
  return { success: true };
}

// ---------------------------------------------------------------------------
// regenerateFAQs — on-demand regeneration (owner only)
// ---------------------------------------------------------------------------

export async function regenerateFAQs(
  locationId: string,
): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const owns = await verifyOwnership(locationId, ctx.orgId);
  if (!owns) return { success: false, error: 'Location not found' };

  try {
    const supabase = createServiceRoleClient();

    // Fetch location + top 5 menu items
    const { data: loc, error: locError } = await supabase
      .from('locations')
      .select(
        'business_name, city, state, phone, website_url, hours_data, amenities, categories, display_name, operational_status, accepting_new_patients, telehealth_available, insurance_types, specialty_tags',
      )
      .eq('id', locationId)
      .single();

    if (locError || !loc)
      return { success: false, error: 'Location not found' };

    const { data: menuItems } = await supabase
      .from('menu_items')
      .select('name, menu_categories!inner(menu_id, magic_menus!inner(location_id, is_published))')
      .eq('menu_categories.magic_menus.location_id', locationId)
      .eq('menu_categories.magic_menus.is_published', true)
      .limit(5);

    const input: FAQGeneratorInput = {
      name: loc.business_name,
      city: loc.city ?? '',
      state: loc.state ?? '',
      phone: loc.phone,
      website_url: loc.website_url,
      hours_data: loc.hours_data as FAQGeneratorInput['hours_data'],
      amenities: loc.amenities as FAQGeneratorInput['amenities'],
      categories: loc.categories as string[] | null,
      display_name: loc.display_name,
      operational_status: loc.operational_status ?? 'OPERATIONAL',
      menuItemNames: (menuItems ?? []).map((i) => i.name),
      accepting_new_patients: loc.accepting_new_patients,
      telehealth_available: loc.telehealth_available,
      insurance_types: loc.insurance_types as string[] | null,
      specialty_tags: loc.specialty_tags,
    };

    const pairs = generateFAQs(input);

    const { error: updateError } = await supabase
      .from('locations')
      .update({
        faq_cache: pairs as unknown as Json,
        faq_updated_at: new Date().toISOString(),
      })
      .eq('id', locationId);

    if (updateError) return { success: false, error: updateError.message };

    // Sprint 129: Ping IndexNow after FAQ cache update
    const { data: menu } = await supabase
      .from('magic_menus')
      .select('public_slug')
      .eq('location_id', locationId)
      .eq('is_published', true)
      .maybeSingle();

    if (menu?.public_slug) {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.localvector.ai';
      pingIndexNow([`${appUrl}/m/${menu.public_slug}`]).catch(
        (err: unknown) => {
          Sentry.captureException(err, {
            tags: {
              component: 'indexnow',
              sprint: '129',
              action: 'regenerateFAQs',
            },
          });
        },
      );
    }

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'faq-actions', sprint: '128' },
    });
    return { success: false, error: 'Failed to regenerate FAQs' };
  }
}

// ---------------------------------------------------------------------------
// getFAQPreview — returns faq_cache with excluded status per pair
// ---------------------------------------------------------------------------

export async function getFAQPreview(
  locationId: string,
): Promise<ActionResult<FAQPreviewPair[]>> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const owns = await verifyOwnership(locationId, ctx.orgId);
  if (!owns) return { success: false, error: 'Location not found' };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('locations')
    .select('faq_cache, faq_excluded_hashes')
    .eq('id', locationId)
    .single();

  if (error || !data) return { success: false, error: 'Location not found' };

  const allPairs = Array.isArray(data.faq_cache) ? (data.faq_cache as unknown as FAQPair[]) : [];
  const excludedHashes = new Set(
    Array.isArray(data.faq_excluded_hashes) ? (data.faq_excluded_hashes as string[]) : [],
  );

  const preview: FAQPreviewPair[] = allPairs.map((pair) => ({
    ...pair,
    excluded: excludedHashes.has(pair.contentHash),
  }));

  return { success: true, data: preview };
}
