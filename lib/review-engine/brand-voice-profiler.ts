// ---------------------------------------------------------------------------
// lib/review-engine/brand-voice-profiler.ts — Brand Voice Profile Builder
//
// Sprint 107: Derives a brand voice profile from website copy, business
// category, and amenities. Manual overrides are never overwritten.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { BrandVoiceProfile } from './types';

/**
 * Returns a default brand voice profile when no website copy is available.
 */
export function getDefaultBrandVoice(businessName: string): BrandVoiceProfile {
  return {
    location_id: '',
    tone: 'warm',
    formality: 'semi-formal',
    use_emojis: false,
    sign_off: `\u2014 The ${businessName} Team`,
    highlight_keywords: [],
    avoid_phrases: ['unfortunately', 'sadly', 'we apologize for any inconvenience'],
    derived_from: 'website_copy',
    last_updated_at: new Date().toISOString(),
  };
}

/**
 * Infers highlight_keywords from business category and amenities.
 */
export function inferHighlightKeywords(
  category: string | null,
  amenities: Record<string, boolean> | null,
  businessName: string,
): string[] {
  const keywords: string[] = [];

  if (category) {
    const lower = category.toLowerCase();
    if (lower.includes('hookah')) keywords.push('premium hookah');
    if (lower.includes('restaurant') || lower.includes('fusion')) keywords.push('fusion cuisine');
    if (lower.includes('lounge') || lower.includes('bar')) keywords.push('lounge experience');
    if (lower.includes('indian')) keywords.push('Indian cuisine');
  }

  if (amenities) {
    if (amenities.has_hookah) keywords.push('hookah lounge');
    if (amenities.has_live_music || amenities.has_dj) keywords.push('live entertainment');
    if (amenities.serves_alcohol) keywords.push('full bar');
    if (amenities.has_outdoor_seating) keywords.push('outdoor seating');
    if (amenities.has_private_rooms) keywords.push('private events');
  }

  // Deduplicate
  return [...new Set(keywords)].slice(0, 8);
}

/**
 * Analyzes website text to infer tone characteristics.
 */
function analyzeToneFromText(text: string): {
  tone: BrandVoiceProfile['tone'];
  formality: BrandVoiceProfile['formality'];
  useEmojis: boolean;
} {
  if (!text || text.length < 50) {
    return { tone: 'warm', formality: 'semi-formal', useEmojis: false };
  }

  const exclamations = (text.match(/!/g) || []).length;
  const sentences = text.split(/[.!?]+/).filter(Boolean).length || 1;
  const exclamationDensity = exclamations / sentences;

  const firstPersonPlural = (text.match(/\b(we|our|us)\b/gi) || []).length;
  const hasEmojis = /[\u{1F300}-\u{1F9FF}]/u.test(text);

  let tone: BrandVoiceProfile['tone'] = 'professional';
  let formality: BrandVoiceProfile['formality'] = 'formal';

  if (exclamationDensity > 0.3) {
    tone = firstPersonPlural > 3 ? 'playful' : 'casual';
    formality = 'casual';
  } else if (firstPersonPlural > 2) {
    tone = 'warm';
    formality = 'semi-formal';
  }

  return { tone, formality, useEmojis: hasEmojis };
}

/**
 * Builds or updates a brand voice profile for a location.
 * Never overwrites manual or hybrid profiles.
 */
export async function deriveOrUpdateBrandVoice(
  supabase: SupabaseClient<Database>,
  locationId: string,
  orgId: string,
): Promise<BrandVoiceProfile> {
  try {
    // Check for existing profile
    const { data: existing } = await supabase
      .from('brand_voice_profiles')
      .select('*')
      .eq('location_id', locationId)
      .maybeSingle();

    // Never overwrite manual profiles
    if (existing && (existing.derived_from === 'manual' || existing.derived_from === 'hybrid')) {
      return {
        location_id: locationId,
        tone: existing.tone as BrandVoiceProfile['tone'],
        formality: existing.formality as BrandVoiceProfile['formality'],
        use_emojis: existing.use_emojis,
        sign_off: existing.sign_off,
        owner_name: existing.owner_name ?? undefined,
        highlight_keywords: existing.highlight_keywords ?? [],
        avoid_phrases: existing.avoid_phrases ?? [],
        custom_instructions: existing.custom_instructions ?? undefined,
        derived_from: existing.derived_from as BrandVoiceProfile['derived_from'],
        last_updated_at: existing.last_updated_at,
      };
    }

    // Fetch location data for business context
    const { data: location } = await supabase
      .from('locations')
      .select('business_name, categories, amenities, website_url')
      .eq('id', locationId)
      .maybeSingle();

    const businessName = location?.business_name ?? 'the business';
    const categoriesJson = location?.categories as Record<string, unknown> | null;
    const category = categoriesJson?.primary as string | null ?? null;
    const amenities = location?.amenities as Record<string, boolean> | null ?? null;

    // Try to extract tone from published page schemas (Sprint 106)
    let toneResult = { tone: 'warm' as BrandVoiceProfile['tone'], formality: 'semi-formal' as BrandVoiceProfile['formality'], useEmojis: false };

    const { data: schemas } = await supabase
      .from('page_schemas')
      .select('json_ld')
      .eq('location_id', locationId)
      .eq('status', 'published')
      .limit(3);

    if (schemas && schemas.length > 0) {
      // Extract text from schema descriptions
      const allText = schemas
        .map((s) => {
          const jsonLd = s.json_ld as unknown[];
          if (!Array.isArray(jsonLd)) return '';
          return jsonLd
            .map((item: unknown) => {
              const obj = item as Record<string, unknown>;
              return [obj.description, obj.name].filter(Boolean).join(' ');
            })
            .join(' ');
        })
        .join(' ');

      if (allText.length >= 50) {
        toneResult = analyzeToneFromText(allText);
      }
    }

    const highlightKeywords = inferHighlightKeywords(category, amenities, businessName);

    const profile: BrandVoiceProfile = {
      location_id: locationId,
      tone: toneResult.tone,
      formality: toneResult.formality,
      use_emojis: toneResult.useEmojis,
      sign_off: `\u2014 The ${businessName} Team`,
      highlight_keywords: highlightKeywords,
      avoid_phrases: ['unfortunately', 'sadly', 'we apologize for any inconvenience'],
      derived_from: 'website_copy',
      last_updated_at: new Date().toISOString(),
    };

    // Upsert to DB
    const { error } = await supabase
      .from('brand_voice_profiles')
      .upsert({
        location_id: locationId,
        org_id: orgId,
        tone: profile.tone,
        formality: profile.formality,
        use_emojis: profile.use_emojis,
        sign_off: profile.sign_off,
        highlight_keywords: profile.highlight_keywords,
        avoid_phrases: profile.avoid_phrases,
        derived_from: profile.derived_from,
        last_updated_at: profile.last_updated_at,
      }, { onConflict: 'location_id' });

    if (error) {
      Sentry.captureMessage(`Brand voice upsert failed: ${error.message}`, {
        tags: { component: 'brand-voice-profiler', sprint: '107' },
      });
    }

    return profile;
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'brand-voice-profiler', sprint: '107' },
    });
    return getDefaultBrandVoice('the business');
  }
}
