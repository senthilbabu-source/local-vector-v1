// ---------------------------------------------------------------------------
// lib/llms-txt/llms-txt-data-loader.ts — DB Loader for llms.txt
//
// Loads all data needed to generate a dynamic llms.txt for a given org.
// Uses service-role or RLS-compliant client depending on caller context.
//
// Sprint 97 — Gap #62 (Dynamic llms.txt 30% -> 100%)
// AI_RULES §50: Data loading for llms.txt lives here, never inline in routes.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { HoursData, Amenities } from '@/lib/types/ground-truth';
import type { LLMsTxtInputData } from './llms-txt-generator';

/**
 * Loads all data needed to generate llms.txt for a given org.
 *
 * @param supabase — Supabase client (service-role for public route, RLS for authenticated)
 * @param orgId — Organization ID (derived server-side, never from client params)
 * @returns LLMsTxtInputData or null if org/location not found
 */
export async function loadLLMsTxtData(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<LLMsTxtInputData | null> {
  // ── 1. Load org info ──────────────────────────────────────────────────
  const { data: org } = await supabase
    .from('organizations')
    .select('name, plan')
    .eq('id', orgId)
    .single();

  if (!org) return null;

  // ── 2. Load primary location ──────────────────────────────────────────
  const { data: location } = await supabase
    .from('locations')
    .select(
      'name, business_name, address_line1, city, state, zip, phone, website_url, categories, hours_data, amenities, operational_status, slug'
    )
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!location) return null;

  // ── 3. Load menu highlights (top 5 active items, most recent) ─────────
  // Join through menu_categories to get category name
  const { data: menuItems } = await supabase
    .from('menu_items')
    .select('name, description, price, menu_categories(name)')
    .eq('org_id', orgId)
    .eq('is_available', true)
    .order('created_at', { ascending: false })
    .limit(5);

  const menuHighlights = (menuItems ?? []).map((item) => ({
    name: item.name,
    description: item.description,
    price: item.price ? Number(item.price) : null,
    category: (item.menu_categories as { name: string } | null)?.name ?? null,
  }));

  // ── 4. Load corrections (fixed hallucinations with expected_truth) ────
  const { data: hallucinations } = await supabase
    .from('ai_hallucinations')
    .select('claim_text, expected_truth, model_provider, resolved_at')
    .eq('org_id', orgId)
    .eq('correction_status', 'fixed')
    .not('expected_truth', 'is', null)
    .order('resolved_at', { ascending: false })
    .limit(10);

  const corrections = (hallucinations ?? []).map((h) => ({
    claim_text: h.claim_text,
    expected_truth: h.expected_truth,
    model_provider: h.model_provider,
    resolved_at: h.resolved_at,
  }));

  // ── 5. Derive public menu URL ─────────────────────────────────────────
  // Check if org has a published magic menu
  const { data: publishedMenu } = await supabase
    .from('magic_menus')
    .select('public_slug')
    .eq('org_id', orgId)
    .eq('is_published', true)
    .limit(1)
    .maybeSingle();

  const publicMenuUrl = publishedMenu?.public_slug
    ? `/m/${publishedMenu.public_slug}`
    : null;

  return {
    org: {
      name: org.name,
      plan: org.plan ?? 'trial',
    },
    location: {
      name: location.business_name ?? location.name,
      address_line1: location.address_line1,
      city: location.city,
      state: location.state,
      zip: location.zip,
      phone: location.phone,
      website_url: location.website_url,
      categories: location.categories as string[] | null,
      hours_data: location.hours_data as HoursData | null,
      amenities: location.amenities as Partial<Amenities> | null,
      operational_status: location.operational_status,
    },
    menuHighlights,
    corrections,
    publicMenuUrl,
  };
}

/**
 * Resolves an org ID from a slug.
 * Used by the public llms.txt route to convert slug -> orgId.
 *
 * @param supabase — Supabase client (service-role for public route)
 * @param slug — Organization slug
 * @returns org_id or null if not found
 */
export async function resolveOrgIdFromSlug(
  supabase: SupabaseClient<Database>,
  slug: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single();

  return data?.id ?? null;
}
