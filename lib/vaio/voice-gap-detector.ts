// ---------------------------------------------------------------------------
// lib/vaio/voice-gap-detector.ts — Voice query zero-citation gap detector
//
// Detects conversational query clusters with zero citations.
// Triggers autopilot content drafts for voice-specific gaps.
//
// Sprint 109: VAIO
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { VoiceGap, VoiceQueryCategory, VoiceQuery, GroundTruthForVAIO } from './types';
import { createDraft } from '@/lib/autopilot/create-draft';
import { formatHoursForVoice } from './llms-txt-generator';

const MIN_ZERO_QUERIES_FOR_GAP = 3;
const MIN_DAYS_AT_ZERO = 14;

// ---------------------------------------------------------------------------
// Gap Detection
// ---------------------------------------------------------------------------

export async function detectVoiceGaps(
  supabase: SupabaseClient<Database>,
  groundTruth: GroundTruthForVAIO,
  locationId: string,
  orgId: string,
): Promise<VoiceGap[]> {
  const { data: queries } = await supabase
    .from('target_queries')
    .select('id, query_text, query_category, citation_rate, last_run_at')
    .eq('location_id', locationId)
    .eq('query_mode', 'voice')
    .eq('is_active', true);

  if (!queries || queries.length === 0) return [];

  const now = new Date();
  const gaps: VoiceGap[] = [];

  // Group by category
  const byCategory = new Map<string, typeof queries>();
  for (const q of queries) {
    const cat = q.query_category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(q);
  }

  for (const [category, catQueries] of byCategory) {
    // Find zero-citation queries that have been evaluated at least once
    const zeroCitation = catQueries.filter((q) => {
      if (q.citation_rate !== null && q.citation_rate > 0) return false;
      if (!q.last_run_at) return false;

      const lastRun = new Date(q.last_run_at);
      const daysSinceRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60 * 24);
      // Only count if it has been run and we have at least MIN_DAYS_AT_ZERO of data
      return daysSinceRun <= 60; // Exclude very stale queries
    });

    if (zeroCitation.length < MIN_ZERO_QUERIES_FOR_GAP) continue;

    // Calculate weeks at zero (oldest last_run_at among zero-citation queries)
    const oldestRun = zeroCitation.reduce((oldest, q) => {
      const d = new Date(q.last_run_at!);
      return d < oldest ? d : oldest;
    }, now);
    const weeksAtZero = Math.floor((now.getTime() - oldestRun.getTime()) / (1000 * 60 * 60 * 24 * 7));

    if (weeksAtZero < Math.floor(MIN_DAYS_AT_ZERO / 7)) continue;

    const voiceCategory = category as VoiceQueryCategory;
    gaps.push({
      category: voiceCategory,
      queries: zeroCitation.map((q) => q.query_text),
      weeks_at_zero: weeksAtZero,
      suggested_content_type: voiceCategory === 'information' ? 'faq_page' : 'gbp_post',
      suggested_query_answer: buildSuggestedAnswer(voiceCategory, groundTruth),
    });
  }

  return gaps;
}

// ---------------------------------------------------------------------------
// Autopilot Trigger
// ---------------------------------------------------------------------------

export async function triggerVoiceGapDrafts(
  supabase: SupabaseClient<Database>,
  orgId: string,
  locationId: string,
  gaps: VoiceGap[],
): Promise<number> {
  let draftsTriggered = 0;

  // Only trigger for action and discovery gaps (highest voice search impact)
  const actionableGaps = gaps.filter(
    (g) => g.category === 'action' || g.category === 'discovery',
  );

  for (const gap of actionableGaps) {
    const result = await createDraft(
      {
        triggerType: 'voice_gap',
        triggerId: null, // No specific trigger ID for gap clusters
        orgId,
        locationId,
        context: {
          zeroCitationQueries: gap.queries,
          additionalContext: `These are VOICE SEARCH queries (category: ${gap.category}). Write in spoken-word format: short sentences, no markdown, 50–150 words max, starts with the answer directly. Weeks at zero citations: ${gap.weeks_at_zero}.`,
        },
      },
      supabase,
    );

    if (result) draftsTriggered++;
  }

  return draftsTriggered;
}

// ---------------------------------------------------------------------------
// Suggested Answer Builder (pure)
// ---------------------------------------------------------------------------

export function buildSuggestedAnswer(
  category: VoiceQueryCategory,
  groundTruth: GroundTruthForVAIO,
  topReviewKeywords?: string[],
): string {
  const { name, city, address, phone, website, hours, categories, amenities } = groundTruth;

  switch (category) {
    case 'information': {
      if (hours) {
        const formattedHours = formatHoursForVoice(hours);
        return `${name} in ${city} is open ${formattedHours}.`;
      }
      return `${name} is a ${categories[0] ?? 'local business'} located in ${city}.`;
    }
    case 'action': {
      const parts = [`${name} is located at ${address} in ${city}.`];
      if (phone) parts.push(`Call ${phone}`);
      if (website) parts.push(`or visit ${website}`);
      if (phone || website) parts.push('to make a reservation.');
      return parts.join(' ');
    }
    case 'discovery': {
      const topAmenities = Object.entries(amenities)
        .filter(([, v]) => v === true)
        .map(([k]) => k.replace(/^(has_|is_|serves_)/, '').replace(/_/g, ' '))
        .slice(0, 3);
      const amenityStr = topAmenities.length > 0 ? `, offering ${topAmenities.join(', ')}` : '';
      return `${name} is a ${categories[0] ?? 'local business'} in ${city}${amenityStr}.`;
    }
    case 'comparison': {
      if (topReviewKeywords && topReviewKeywords.length > 0) {
        return `${name} in ${city} is known for ${topReviewKeywords.slice(0, 3).join(', ')}.`;
      }
      return `${name} is a popular ${categories[0] ?? 'destination'} in ${city}.`;
    }
    default:
      return `${name} is located in ${city}.`;
  }
}
