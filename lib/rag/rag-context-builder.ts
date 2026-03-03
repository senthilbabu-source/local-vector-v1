// ---------------------------------------------------------------------------
// lib/rag/rag-context-builder.ts — RAG Knowledge Base Assembly (Sprint 133)
//
// Assembles the knowledge base for RAG answering from verified ground truth.
// AI_RULES §166: NEVER include speculative or unknown values in RAG context.
//   If a field is null/unknown, omit it entirely — never include "We don't have X".
//   The model should say "I don't have that info" rather than "We don't have X".
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RAGContext {
  businessName: string;
  address: string;
  phone: string | null;
  website: string | null;
  hours: string; // human-readable, e.g. "Mon–Fri 11am–10pm, Sat–Sun 4pm–2am"
  operationalStatus: string; // "open", "temporarily closed", etc.
  menuItems: RAGMenuItem[];
  amenities: string[]; // only true amenity names: ["hookah", "outdoor seating"]
  corrections: string[]; // verified corrections from ai_audits
  faqPairs: Array<{ question: string; answer: string }>;
}

export interface RAGMenuItem {
  name: string;
  description?: string;
  price?: string; // formatted: "$14.99" or undefined
  category: string;
  dietaryTags: string[];
  isAvailable: boolean;
}

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

/**
 * Build RAG context for a location.
 * Only includes confirmed, non-null data.
 * AI_RULES §166: Omit unknown fields rather than including "we don't have X".
 */
export async function buildRAGContext(
  locationId: string,
  supabase: SupabaseClient<Database>,
): Promise<RAGContext | null> {
  try {
    const [locationResult, menuResult, correctionsResult] = await Promise.all([
      supabase
        .from('locations')
        .select(
          'business_name, address_line1, city, state, zip, phone, website_url, hours_data, operational_status, amenities, faq_cache',
        )
        .eq('id', locationId)
        .single(),

      // Menu items join: menu_items → menu_categories → magic_menus → locations
      supabase
        .from('menu_items')
        .select(
          'name, description, price, currency, dietary_tags, is_available, menu_categories!inner(name, magic_menus!inner(location_id, is_published))',
        )
        .eq('menu_categories.magic_menus.location_id', locationId)
        .eq('menu_categories.magic_menus.is_published', true)
        .eq('is_available', true)
        .order('sort_order'),

      // Verified hallucination corrections
      supabase
        .from('ai_audits')
        .select('response_metadata')
        .eq('location_id', locationId)
        .eq('is_hallucination_detected', true)
        .not('response_metadata', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const loc = locationResult.data;
    if (!loc) return null;

    // Build human-readable hours
    const hours = formatHoursData(
      loc.hours_data as Record<string, unknown> | null,
    );

    // Build amenity list (only TRUE values)
    const amenities = Object.entries(
      (loc.amenities as Record<string, boolean | null>) ?? {},
    )
      .filter(([, v]) => v === true)
      .map(([k]) => k.replace(/_/g, ' '));

    // Build correction strings from ai_audits metadata
    const corrections = (correctionsResult.data ?? [])
      .map((row) => {
        const meta = row.response_metadata as {
          correction?: string;
        } | null;
        return meta?.correction ?? null;
      })
      .filter((c): c is string => c !== null);

    // Build menu items — extract category name from join
    const menuItems: RAGMenuItem[] = (menuResult.data ?? []).map((item) => ({
      name: item.name,
      description: item.description ?? undefined,
      price: item.price ? `$${Number(item.price).toFixed(2)}` : undefined,
      category: (item.menu_categories as unknown as { name: string }).name,
      dietaryTags: Array.isArray(item.dietary_tags)
        ? (item.dietary_tags as string[])
        : [],
      isAvailable: item.is_available ?? true,
    }));

    // FAQ pairs from Sprint 128 cache — map from { question, answer } shape
    const rawFaq = loc.faq_cache;
    const faqPairs: Array<{ question: string; answer: string }> = [];
    if (Array.isArray(rawFaq)) {
      for (const entry of rawFaq) {
        const pair = entry as { question?: string; answer?: string };
        if (pair.question && pair.answer) {
          faqPairs.push({ question: pair.question, answer: pair.answer });
        }
      }
    }

    return {
      businessName: loc.business_name ?? '',
      address: [loc.address_line1, loc.city, loc.state, loc.zip]
        .filter(Boolean)
        .join(', '),
      phone: loc.phone ?? null,
      website: loc.website_url ?? null,
      operationalStatus: loc.operational_status ?? 'open',
      hours,
      menuItems,
      amenities,
      corrections,
      faqPairs,
    };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { service: 'rag-context-builder', sprint: '133' },
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hours formatting — pure, exported for testing
// ---------------------------------------------------------------------------

/**
 * Format hours_data JSONB into human-readable string.
 * Input: { monday: { open: "11:00", close: "22:00" }, ... }
 * Output: "Mon 11am–10pm, Tue 11am–10pm, ..."
 * Returns "Hours not available" if null/incomplete.
 */
export function formatHoursData(
  hoursData: Record<string, unknown> | null,
): string {
  if (!hoursData) return 'Hours not available';

  const days = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];
  const abbr = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const parts: string[] = [];

  for (let i = 0; i < days.length; i++) {
    const day = hoursData[days[i]] as
      | { open?: string; close?: string; closed?: boolean }
      | undefined;
    if (!day) continue;
    if (day.closed) {
      parts.push(`${abbr[i]}: Closed`);
      continue;
    }
    if (day.open && day.close) {
      parts.push(
        `${abbr[i]} ${formatTime(day.open)}\u2013${formatTime(day.close)}`,
      );
    }
  }

  return parts.length > 0 ? parts.join(', ') : 'Hours not available';
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, '0')}${period}`;
}
