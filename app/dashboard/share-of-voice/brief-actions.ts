'use server';

import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { buildBriefStructure } from '@/lib/services/content-brief-builder.service';
import { generateBriefContent } from '@/lib/services/content-brief-generator.service';
import type { BriefStructure } from '@/lib/services/content-brief-builder.service';
import type { ContentBrief } from '@/lib/ai/schemas';
import { revalidatePath } from 'next/cache';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GenerateBriefResult {
  success: boolean;
  draftId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// generateContentBrief — Server Action (user-initiated, §5)
// ---------------------------------------------------------------------------

/**
 * Generate a content brief for an SOV gap query.
 * User-initiated (§5) — triggered by button click.
 */
export async function generateContentBrief(
  queryId: string,
): Promise<GenerateBriefResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const supabase = await createClient();

  // Fetch query + location in parallel
  const [queryResult, locationResult] = await Promise.all([
    supabase
      .from('target_queries')
      .select('id, query_text, query_category, location_id')
      .eq('id', queryId)
      .eq('org_id', ctx.orgId)
      .single(),
    supabase
      .from('locations')
      .select('business_name, city, state, phone, website_url, categories, amenities, hours_data')
      .eq('org_id', ctx.orgId)
      .eq('is_primary', true)
      .single(),
  ]);

  if (queryResult.error || !queryResult.data) {
    return { success: false, error: 'Query not found' };
  }
  if (locationResult.error || !locationResult.data) {
    return { success: false, error: 'Location not found' };
  }

  const query = queryResult.data;
  const location = locationResult.data;

  // Check for existing draft with this trigger
  const { data: existingDraft } = await supabase
    .from('content_drafts')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('trigger_type', 'prompt_missing')
    .eq('trigger_id', queryId)
    .in('status', ['draft', 'approved'])
    .maybeSingle();

  if (existingDraft) {
    return { success: false, error: 'A draft already exists for this query' };
  }

  // Fetch SOV gap data for this query
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: sovEvals } = await supabase
    .from('sov_evaluations')
    .select('engine, rank_position, mentioned_competitors')
    .eq('query_id', queryId)
    .eq('org_id', ctx.orgId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  const evals = sovEvals ?? [];
  const totalEngines = new Set(evals.map(e => e.engine)).size;
  const missingEngines = evals.filter(e => e.rank_position === null).length;

  // Collect competitor names mentioned across evaluations
  const competitorsMentioned = new Set<string>();
  for (const e of evals) {
    const competitors = (e.mentioned_competitors as Array<{ name?: string } | string>) ?? [];
    for (const c of competitors) {
      if (typeof c === 'string') {
        competitorsMentioned.add(c);
      } else if (c.name) {
        competitorsMentioned.add(c.name);
      }
    }
  }

  // Layer 1: Pure brief structure
  const structure = buildBriefStructure({
    queryText: query.query_text,
    queryCategory: query.query_category,
    businessName: location.business_name,
    city: location.city ?? '',
    state: location.state ?? '',
  });

  // Layer 2: AI content generation
  const categories = (location.categories as string[]) ?? [];
  const amenities = (location.amenities as Record<string, boolean | undefined>) ?? {};
  const amenityList = Object.entries(amenities)
    .filter(([, v]) => v === true)
    .map(([k]) => k);

  const briefContent = await generateBriefContent({
    queryText: query.query_text,
    queryCategory: query.query_category,
    businessName: location.business_name,
    city: location.city ?? '',
    state: location.state ?? '',
    businessContext: {
      cuisineType: categories[0] ?? null,
      amenities: amenityList,
      categories,
      hoursDescription: location.hours_data ? 'See location settings for details' : null,
      phone: location.phone,
      websiteUrl: location.website_url,
    },
    missingEngineCount: missingEngines,
    totalEngineCount: totalEngines,
    competitorsMentioned: [...competitorsMentioned],
  });

  // Assemble draft content
  const draftContent = await assembleDraftContent(structure, briefContent);

  // Save to content_drafts
  const { data: draft, error: insertError } = await supabase
    .from('content_drafts')
    .insert({
      org_id: ctx.orgId,
      location_id: query.location_id,
      trigger_type: 'prompt_missing',
      trigger_id: queryId,
      draft_title: structure.titleTag,
      draft_content: draftContent,
      target_prompt: query.query_text,
      content_type: structure.contentType,
      status: 'draft',
    })
    .select('id')
    .single();

  if (insertError || !draft) {
    return { success: false, error: 'Failed to save draft' };
  }

  revalidatePath('/dashboard/content-drafts');
  revalidatePath('/dashboard/share-of-voice');

  return { success: true, draftId: draft.id };
}

// ---------------------------------------------------------------------------
// assembleDraftContent — Markdown assembly (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Assemble the draft content from structure + AI-generated content.
 * If AI content is null (no API key), produces structure-only brief.
 */
export async function assembleDraftContent(
  structure: BriefStructure,
  aiContent: ContentBrief | null,
): Promise<string> {
  const sections: string[] = [];

  // Header
  sections.push(`# ${structure.h1}`);
  sections.push('');

  // URL and meta
  sections.push(`**Suggested URL:** ${structure.suggestedUrl}`);
  sections.push(`**Title Tag:** ${structure.titleTag}`);
  sections.push('');

  // Answer Capsule
  if (aiContent?.answerCapsule) {
    sections.push('## Answer Capsule');
    sections.push(aiContent.answerCapsule);
    sections.push('');
  } else {
    sections.push('## Answer Capsule');
    sections.push('_[Write a 40-60 word direct answer to the query here. Include your business name, location, and key differentiator.]_');
    sections.push('');
  }

  // Meta description
  if (aiContent?.metaDescription) {
    sections.push(`**Meta Description:** ${aiContent.metaDescription}`);
    sections.push('');
  }

  // Outline sections
  if (aiContent?.outlineSections) {
    for (const section of aiContent.outlineSections) {
      sections.push(`## ${section.heading}`);
      for (const bullet of section.bullets) {
        sections.push(`- ${bullet}`);
      }
      sections.push('');
    }
  } else {
    sections.push('## Details & Features');
    sections.push('_[Add content about your offerings for this query]_');
    sections.push('');
    sections.push('## Why Choose Us');
    sections.push('_[Highlight unique differentiators]_');
    sections.push('');
  }

  // FAQ section
  sections.push('## Frequently Asked Questions');
  if (aiContent?.faqQuestions) {
    for (const faq of aiContent.faqQuestions) {
      sections.push(`### ${faq.question}`);
      sections.push(faq.answerHint);
      sections.push('');
    }
  } else {
    sections.push('_[Add 3-5 FAQ questions customers would ask about this topic]_');
    sections.push('');
  }

  // Schema recommendations
  sections.push('---');
  sections.push(`**Recommended Schema:** ${structure.recommendedSchemas.join(', ')}`);
  sections.push('');
  sections.push('**llms.txt Entry:**');
  sections.push('```');
  sections.push(structure.llmsTxtEntry);
  sections.push('```');

  return sections.join('\n');
}
